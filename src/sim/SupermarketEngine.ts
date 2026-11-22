import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MaterialLibrary } from './materials';
import { INTERACT_LAYER, ProceduralTextureBank } from './textures';
import { soundSynth } from './audio';
import {
  ActionVerb,
  ColliderBox,
  DampedUpdater,
  HudSnapshot,
  InspectionCardData,
  InteractableItem,
  PlayerTool,
  TargetPrompt,
  WorldBuildContext,
  ZoneId,
} from './types';
import { Atm1990Controller } from './zones/atm1990';
import { buildCheckoutsAndOffice } from './zones/checkoutsAndOffice';
import { buildArchitectureAndOutdoorFront } from './zones/outdoorFront';
import { buildMainSalesFloorDepartments } from './zones/salesFloor';
import { buildWarehouseAndLoadingDock } from './zones/warehouseAndDock';
import { PlayerWallet } from './wallet';
import { LabelerRayHit, PlayerToolController } from './playerTools';
import { getProductByEan } from './productCatalog';
import { OrderTerminalKeyCode, OrderTerminalModel } from './orderCatalog';

// Module-scope reusable math vectors (Zero GC inside render loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _ndcCenter = new THREE.Vector2(0, 0);
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class SupermarketEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private texBank: ProceduralTextureBank;
  private mats: MaterialLibrary;

  private colliders: ColliderBox[] = [];
  private interactables: InteractableItem[] = [];
  private updaters: DampedUpdater[] = [];
  private disposables: Array<{ dispose: () => void }> = [];

  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private lastRaycastTime = 0;

  // Player state
  private playerPos = new THREE.Vector3(0, 0, 13.8);
  private currentGroundY = 0;
  private yaw = 0; // 0 looks toward -Z (storefront)
  private pitch = -0.03;
  private readonly eyeHeight = 1.68;
  private readonly playerRadius = 0.33;

  // Input state
  private keys: Record<string, boolean> = {};
  private joystick = { x: 0, y: 0 };
  private isDraggingLook = false;
  private dragStartPos = { x: 0, y: 0 };
  private dragMoved = false;
  private pointerLocked = false;
  private isTouchDevice = false;
  private lastTouchEventTime = 0;
  private lastDiegeticTriggerTime = 0;

  // Active HUD / Interaction state
  private hoveredItem: InteractableItem | null = null;
  private hoveredUv: THREE.Vector2 | null = null;
  private hoveredWorldPoint: THREE.Vector3 | null = null;
  private hoveredLabelerHit: LabelerRayHit | null = null;
  private lastLabelerHoverTime = 0;
  private seatedAtDesk = false;
  private activeInspection: InspectionCardData | null = null;
  private onHudChange: (snapshot: HudSnapshot) => void;
  private lastHudKey = '';
  private wallet = new PlayerWallet();
  private orderModel = new OrderTerminalModel();
  private tools!: PlayerToolController;
  private atmController!: Atm1990Controller;

  // Loop control
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, onHudChange: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudChange = onHudChange;
    this.isTouchDevice =
      'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // 1. Detect Software WebGL (SwiftShader / llvmpipe / Basic Render)
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize WebGLRenderer (clamped DPR <= 2.0 for iPhone 16e 60 FPS)
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    container.appendChild(this.renderer.domElement);

    // 3. Scene, Sky Fog & Camera
    this.scene = new THREE.Scene();
    const skyColor = new THREE.Color(0xd5e4f2);
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog(0xd5e4f2, 26, 86);

    const aspect =
      (container.clientWidth || window.innerWidth) /
      Math.max(1, container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 130);
    this.camera.layers.enable(0);
    this.camera.layers.disable(INTERACT_LAYER);
    this.scene.add(this.camera);

    // 4. Studio Environment Map (RoomEnvironment + PMREMGenerator)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = envRT.texture;
    this.disposables.push(envRT);
    pmrem.dispose();

    // 5. V23 Balanced Warm/Cool Glare-Free Architectural Lighting Rig (zero mid-air point-light glare orbs!)
    const hemiLight = new THREE.HemisphereLight(0xf3f7ff, 0x94a3b8, 1.24);
    hemiLight.position.set(0, 25, 0);
    this.scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff6e5, 1.72);
    sunLight.position.set(14, 24, 18);
    sunLight.castShadow = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      sunLight.shadow.mapSize.set(1024, 1024);
      sunLight.shadow.camera.near = 2;
      sunLight.shadow.camera.far = 64;
      const d = 19;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    this.scene.add(sunLight);

    const rimFill = new THREE.DirectionalLight(0xdbeafe, 0.56);
    rimFill.position.set(-12, 14, -22);
    this.scene.add(rimFill);

    // Clean, even 4000K fluorescent-bounce interior fill (zero specular blobs on floor/coolers)
    const interiorFillLight = new THREE.AmbientLight(0xf8fafc, 0.34);
    this.scene.add(interiorFillLight);

    // 6. Raycaster restricted to Layer 1 proxy colliders
    this.raycaster.layers.set(INTERACT_LAYER);
    this.raycaster.near = 0.05;
    this.raycaster.far = 3.5;

    // 7. Build All 5 Architectural Zones & 11 Retail Departments
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.texBank = new ProceduralTextureBank(maxAniso);
    this.mats = new MaterialLibrary(this.texBank, this.isSoftwareGl);

    const buildCtx: WorldBuildContext = {
      scene: this.scene,
      maxAnisotropy: maxAniso,
      isSoftwareGl: this.isSoftwareGl,
      colliders: this.colliders,
      interactables: this.interactables,
      updaters: this.updaters,
      disposables: this.disposables,
    };

    this.tools = new PlayerToolController(
      buildCtx,
      this.camera,
      this.orderModel,
      () => this.emitHudSnapshot(true),
      () => this.performHandheldScan()
    );

    const frontResult = buildArchitectureAndOutdoorFront(
      buildCtx,
      this.mats,
      this.texBank,
      () => this.playerPos,
      this.wallet,
      () => this.emitHudSnapshot(true),
      (on) => {
        hemiLight.intensity = on ? 1.24 : 0.62;
        interiorFillLight.intensity = on ? 0.34 : 0.06;
        rimFill.intensity = on ? 0.56 : 0.25;
      }
    );
    this.atmController = frontResult.atmController;
    buildMainSalesFloorDepartments(buildCtx, this.mats, this.texBank, this.tools);
    buildCheckoutsAndOffice(
      buildCtx,
      this.mats,
      this.texBank,
      this.wallet,
      this.orderModel,
      this.tools,
      this.camera,
      this.renderer,
      () => this.emitHudSnapshot(true),
      () => this.seatedAtDesk,
      (seated) => this.setSeatedAtDesk(seated)
    );
    buildWarehouseAndLoadingDock(
      buildCtx,
      this.mats,
      this.texBank,
      this.wallet,
      this.tools,
      this.orderModel,
      () => this.playerPos
    );

    // Pre-compile shaders on hardware GPUs
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.syncCameraTransform();
    this.bindEvents();
    this.emitHudSnapshot(true);

    // Start paced render loop
    this.clock.start();
    this.tick();
  }

  // ==========================================================================
  // PUBLIC CONTROLS API (For React HUD & Mobile Dual-Thumb Controls)
  // ==========================================================================
  setJoystickVector(x: number, y: number): void {
    this.joystick.x = THREE.MathUtils.clamp(x, -1, 1);
    this.joystick.y = THREE.MathUtils.clamp(y, -1, 1);
  }

  applyTouchLookDelta(dx: number, dy: number): void {
    const sensitivity = 0.0042;
    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - dy * sensitivity,
      -Math.PI * 0.44,
      Math.PI * 0.44
    );
  }

  setSeatedAtDesk(seated: boolean): void {
    if (this.seatedAtDesk === seated) return;
    this.seatedAtDesk = seated;
    this.activeInspection = null;
    if (seated) {
      this.yaw = -Math.PI / 2;
      this.pitch = -0.09;
    } else {
      this.playerPos.set(7.05, 0, 5.15);
      this.currentGroundY = 0;
    }
    this.updateRaycast(true);
    this.emitHudSnapshot(true);
  }

  selectTool(tool: PlayerTool): void {
    this.tools.selectTool(tool);
  }

  toggleLabelerRaised(force?: boolean): void {
    this.tools.toggleLabelerRaised(force);
  }

  toggleScannerRaised(force?: boolean): void {
    this.tools.toggleScannerRaised(force);
  }

  toggleOrdererRaised(force?: boolean): void {
    this.tools.toggleOrdererRaised(force);
  }

  pressOrdererKey(code: OrderTerminalKeyCode): void {
    this.tools.pressOrdererKey(code);
  }

  transferScannerToLabeler(): void {
    this.tools.transferScannedToLabeler();
  }

  pressLabelerKey(key: string): void {
    this.tools.pressLabelerKey(key);
  }

  takePrintedLabel(): void {
    this.tools.takePrintedLabel();
  }

  private getInteractableEan(item: InteractableItem | null): string | null {
    if (!item) return null;
    if (item.dynamicProductEan) return item.dynamicProductEan();
    return item.productEan ?? null;
  }

  performHandheldScan(): void {
    if (!this.tools || this.tools.getActiveTool() !== 'scanner') return;
    let targetItem = this.hoveredItem;
    let targetPt = this.hoveredWorldPoint;

    // When scanner is raised close to the camera, cast a fresh center ray into the store shelf ahead
    if (!targetItem) {
      this.raycaster.setFromCamera(_ndcCenter, this.camera);
      const hits = this.raycaster.intersectObjects(this.scene.children, true);
      for (let i = 0; i < hits.length; i++) {
        const candidate = hits[i].object.userData?.interactable as InteractableItem | undefined;
        if (candidate && (!candidate.isVisible || candidate.isVisible())) {
          targetItem = candidate;
          targetPt = hits[i].point.clone();
          break;
        }
      }
    }

    const ean = this.getInteractableEan(targetItem);
    this.tools.fireScannerLaser(ean, targetPt);
    this.emitHudSnapshot(true);
  }

  private getCanvasNdc(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * 2 - 1,
      y: -((clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  hitTestLabelerAtScreen(clientX: number, clientY: number): boolean {
    if (!this.tools) return false;
    const ndc = this.getCanvasNdc(clientX, clientY);
    if (!ndc) return false;
    return this.tools.raycastLabelerNdc(ndc.x, ndc.y) !== null;
  }

  triggerLabelerAtScreen(clientX: number, clientY: number): boolean {
    if (!this.tools) return false;
    const ndc = this.getCanvasNdc(clientX, clientY);
    if (!ndc) return false;
    return this.tools.triggerLabelerAtNdc(ndc.x, ndc.y);
  }

  triggerActiveTarget(): void {
    if (this.tools && this.tools.isAnyHandheldRaised()) {
      const hitHandheld = this.tools.triggerLabelerAtNdc(0, 0);
      if (!hitHandheld && this.tools.isScannerRaised()) {
        const now = performance.now();
        if (now - this.lastDiegeticTriggerTime >= 320) {
          this.lastDiegeticTriggerTime = now;
          this.performHandheldScan();
        }
      }
      this.updateRaycast(true);
      this.emitHudSnapshot(true);
      return;
    }

    if (this.tools && this.tools.getActiveTool() === 'scanner') {
      const hoveredEan = this.getInteractableEan(this.hoveredItem);
      if (hoveredEan || !this.hoveredItem) {
        const now = performance.now();
        if (now - this.lastDiegeticTriggerTime < 320) return;
        this.lastDiegeticTriggerTime = now;
        this.performHandheldScan();
        return;
      }
    }

    if (!this.hoveredItem) {
      // Allow squeezing/bouncing a held pet toy in open space
      this.tools.triggerHeldToyAction();
      return;
    }
    const item = this.hoveredItem;
    if (item.isVisible && !item.isVisible()) return;

    if (item.kind === 'diegetic_action') {
      const now = performance.now();
      if (now - this.lastDiegeticTriggerTime < 320) return;
      this.lastDiegeticTriggerTime = now;
      if (item.onInteractUv && this.hoveredUv) {
        item.onInteractUv(this.hoveredUv);
      } else {
        item.onInteract?.();
      }
      this.updateRaycast(true);
      this.emitHudSnapshot(true);
      return;
    }

    soundSynth.playUiTone(item.kind === 'door_toggle');

    if (item.kind === 'door_toggle' || item.kind === 'power_toggle') {
      item.state = !item.state;
      item.onToggle?.(item.state);
      this.emitHudSnapshot(true);
    } else {
      this.activeInspection = {
        title: item.dynamicTitle ? item.dynamicTitle() : item.title,
        subtitle: item.dynamicSubtitle ? item.dynamicSubtitle() : item.subtitle,
        description: item.dynamicInspectText ? item.dynamicInspectText() : item.inspectText,
        specs: item.dynamicSpecs ? item.dynamicSpecs() : item.specs,
      };
      this.emitHudSnapshot(true);
    }
  }

  closeInspection(): void {
    if (this.activeInspection) {
      this.activeInspection = null;
      this.emitHudSnapshot(true);
    }
  }

  teleportToZone(zone: ZoneId): void {
    this.activeInspection = null;
    this.seatedAtDesk = false;
    switch (zone) {
      case 'parking':
        this.playerPos.set(0, 0, 13.8);
        this.yaw = 0;
        this.pitch = -0.02;
        break;
      case 'atm':
        this.playerPos.set(7.24, 0, 7.82);
        this.yaw = 0;
        this.pitch = -0.18;
        break;
      case 'monnayeur':
        this.playerPos.set(9.02, 0, 7.78);
        this.yaw = 0;
        this.pitch = -0.16;
        break;
      case 'sales_floor':
        this.playerPos.set(1.4, 0, 2.8);
        this.yaw = 0.15;
        this.pitch = -0.05;
        break;
      case 'manga_corner':
        this.playerPos.set(-7.6, 0, 4.4);
        this.yaw = 0.65;
        this.pitch = -0.04;
        break;
      case 'checkouts':
        this.playerPos.set(-4.05, 0, 4.62);
        this.yaw = -Math.PI / 2;
        this.pitch = -0.22;
        break;
      case 'office': {
        // Ensure office door is open if teleporting inside
        const offDoor = this.interactables.find((i) => i.id === 'office_door_toggle');
        if (offDoor && !offDoor.state) {
          offDoor.state = true;
          offDoor.onToggle?.(true);
        }
        this.playerPos.set(7.05, 0, 5.15);
        this.yaw = -Math.PI / 2;
        this.pitch = -0.14;
        break;
      }
      case 'warehouse': {
        const whDoor = this.interactables.find((i) => i.id === 'warehouse_doors_toggle');
        if (whDoor && !whDoor.state) {
          whDoor.state = true;
          whDoor.onToggle?.(true);
        }
        this.playerPos.set(-1.4, 0, -9.2);
        this.yaw = -0.35;
        this.pitch = -0.04;
        break;
      }
      case 'loading_dock':
        this.playerPos.set(3.2, -0.95, -16.8);
        this.yaw = 0.72;
        this.pitch = 0.04;
        break;
    }
    this.currentGroundY = this.groundHeightAt(this.playerPos.x, this.playerPos.z);
    this.syncCameraTransform();
    this.updateRaycast(true);
    this.emitHudSnapshot(true);
  }

  // ==========================================================================
  // PHYSICS, GROUND HEIGHT & CIRCLE-VS-AABB COLLISION
  // ==========================================================================
  private groundHeightAt(x: number, z: number): number {
    // Indoor building & front parking
    if (z >= -13.15) return 0.0;
    // Raised concrete loading dock slab
    if (z >= -14.8 && x >= -5.2 && x <= 3.6) return 0.0;
    // Concrete dock stairs (X = 3.55..4.95, Z = -13.15 down to -15.45)
    if (x >= 3.5 && x <= 4.95 && z <= -13.15 && z >= -15.45) {
      const t = (-13.15 - z) / (15.45 - 13.15);
      return THREE.MathUtils.lerp(0.0, -0.95, THREE.MathUtils.clamp(t, 0, 1));
    }
    // Lower fenced truck yard
    return -0.95;
  }

  private resolveCollisions(nx: number, nz: number): void {
    const r = this.playerRadius;
    let x = nx;
    let z = nz;

    // 2 relaxation passes prevent corner wedging
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.colliders.length; i++) {
        const box = this.colliders[i];
        if (!box.enabled) continue;

        const closestX = THREE.MathUtils.clamp(x, box.minX, box.maxX);
        const closestZ = THREE.MathUtils.clamp(z, box.minZ, box.maxZ);
        const dx = x - closestX;
        const dz = z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < r * r) {
          if (distSq > 1e-7) {
            const dist = Math.sqrt(distSq);
            const push = r - dist;
            x += (dx / dist) * push;
            z += (dz / dist) * push;
          } else {
            // Center inside AABB fallback: push out via nearest edge
            const leftPen = Math.abs(x - box.minX);
            const rightPen = Math.abs(box.maxX - x);
            const backPen = Math.abs(z - box.minZ);
            const frontPen = Math.abs(box.maxZ - z);
            const minPen = Math.min(leftPen, rightPen, backPen, frontPen);
            if (minPen === leftPen) x = box.minX - r;
            else if (minPen === rightPen) x = box.maxX + r;
            else if (minPen === backPen) z = box.minZ - r;
            else z = box.maxZ + r;
          }
        }
      }
    }

    this.playerPos.x = x;
    this.playerPos.z = z;
  }

  private updateMovement(dt: number): void {
    let moveZ = 0;
    let moveX = 0;

    // Physical WASD / ZQSD (event.code KeyW/KeyA/KeyS/KeyD matches both QWERTY & French AZERTY!) + Arrows
    if (this.keys['KeyW'] || this.keys['KeyZ'] || this.keys['ArrowUp']) moveZ += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ -= 1;
    if (this.keys['KeyA'] || this.keys['KeyQ'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    // Combine with mobile left-thumb virtual joystick
    moveX += this.joystick.x;
    moveZ += this.joystick.y;

    const mag = Math.hypot(moveX, moveZ);
    if (this.seatedAtDesk) {
      if (mag > 0.35) {
        this.setSeatedAtDesk(false);
      } else {
        this.syncCameraTransform(dt);
        return;
      }
    }

    if (mag > 1e-3) {
      const clampedMag = Math.min(1, mag);
      const normX = (moveX / mag) * clampedMag;
      const normZ = (moveZ / mag) * clampedMag;

      const sprint = this.keys['ShiftLeft'] || this.keys['ShiftRight'] ? 1.48 : 1.0;
      const speed = 3.85 * sprint;

      _forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      _right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

      _moveVec
        .set(0, 0, 0)
        .addScaledVector(_forward, normZ * speed * dt)
        .addScaledVector(_right, normX * speed * dt);

      this.resolveCollisions(
        this.playerPos.x + _moveVec.x,
        this.playerPos.z + _moveVec.z
      );

      // Dismiss inspection card automatically if player walks away
      if (this.activeInspection && clampedMag > 0.35) {
        this.activeInspection = null;
      }
    }

    const targetGround = this.groundHeightAt(this.playerPos.x, this.playerPos.z);
    this.currentGroundY = THREE.MathUtils.damp(this.currentGroundY, targetGround, 14, dt);
    this.playerPos.y = this.currentGroundY;
    this.syncCameraTransform(dt);
  }

  private syncCameraTransform(dt = 0): void {
    _euler.set(this.pitch, this.yaw, 0);
    this.camera.quaternion.setFromEuler(_euler);

    const targetX = this.seatedAtDesk ? 7.68 : this.playerPos.x;
    const targetY = this.seatedAtDesk ? 1.16 : this.playerPos.y + this.eyeHeight;
    const targetZ = this.seatedAtDesk ? 5.15 : this.playerPos.z;

    if (dt > 0) {
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, targetX, 12, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, targetY, 12, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, targetZ, 12, dt);
    } else {
      this.camera.position.set(targetX, targetY, targetZ);
    }
  }

  // ==========================================================================
  // LAYER-1 RETICLE RAYCASTING & ZONE DETECTION
  // ==========================================================================
  private updateRaycast(force = false): void {
    const now = performance.now();
    const minInterval =
      this.seatedAtDesk || this.tools?.isAnyHandheldRaised() || this.hoveredItem?.onHoverUv
        ? 24
        : 55;
    if (!force && now - this.lastRaycastTime < minInterval) return;
    this.lastRaycastTime = now;

    if (this.tools && this.tools.isAnyHandheldRaised()) {
      const lHit = this.tools.raycastLabelerNdc(0, 0);
      this.hoveredLabelerHit = lHit;
      this.hoveredItem = null;
      this.hoveredUv = null;
      this.hoveredWorldPoint = null;
      if (this.pointerLocked) {
        const code =
          lHit &&
          (lHit.kind === 'key' || lHit.kind === 'scanner_btn' || lHit.kind === 'orderer_btn')
            ? lHit.code
            : null;
        this.tools.setHoveredLabelerCode(code);
      }
      this.emitHudSnapshot(false);
      return;
    }
    this.hoveredLabelerHit = null;

    this.raycaster.setFromCamera(_ndcCenter, this.camera);
    const hits = this.raycaster.intersectObjects(this.scene.children, true);

    let nextItem: InteractableItem | null = null;
    let nextUv: THREE.Vector2 | null = null;
    let nextPoint: THREE.Vector3 | null = null;
    for (let i = 0; i < hits.length; i++) {
      const candidate = hits[i].object.userData?.interactable as InteractableItem | undefined;
      if (candidate && (!candidate.isVisible || candidate.isVisible())) {
        nextItem = candidate;
        nextUv = hits[i].uv ? hits[i].uv!.clone() : null;
        nextPoint = hits[i].point.clone();
        break;
      }
    }

    this.hoveredItem = nextItem;
    this.hoveredUv = nextUv;
    this.hoveredWorldPoint = nextPoint;
    if (nextItem && nextUv && nextItem.onHoverUv) {
      nextItem.onHoverUv(nextUv);
    }
    this.emitHudSnapshot(false);
  }

  private computeZoneInfo(): { name: string; subtitle: string } {
    const x = this.playerPos.x;
    const z = this.playerPos.z;

    if (z > 6.8 && z < 9.2 && x > 5.8 && x < 9.85) {
      if (x >= 8.3) {
        return {
          name: 'Monnayeur Automatique — Francs 1990',
          subtitle: 'Change Billets 50/100/200 ₣ → Pièces 10₣ / 5₣ / 2₣ / 1₣',
        };
      }
      return {
        name: 'DAB Bancaire CB 1990 — Banque Nationale',
        subtitle: 'Terminal CRT 1990 · Clavier Acier & Trappe Dépôt Francs',
      };
    }
    if (z > 7.05) {
      return {
        name: 'Zone 1 — Parking & Façade',
        subtitle: 'Abri Caddies · Plots Anti-Bélier · DAB CB 1990 & Monnayeur',
      };
    }
    if (z < -13.05) {
      return {
        name: 'Zone 5 — Quai de Livraison & Cour Clôturée',
        subtitle: 'Grillage Galvanisé · Portail Coulissant · Camion 12T',
      };
    }
    if (z < -7.0) {
      return {
        name: 'Zone 5 — Entrepôt Arrière (Réserve)',
        subtitle: 'Racks à Palettes · Transpalette · Presse à Carton',
      };
    }
    if (x > 6.15 && z > 3.15) {
      return {
        name: 'Zone 4 — Bureau du Gérant',
        subtitle: 'PC 1990 CONTACT-OS 90 · Tour, Écran CRT, Souris & Clavier 3D',
      };
    }
    if (x < -1.8 && x > -6.4 && z > 3.0) {
      return {
        name: 'Zone 3 — Caisses 1 & 2 (Franc 1990)',
        subtitle: 'Douchette Laser · Tapis Roulant · Tiroir-Caisse & Terminal CB 1990',
      };
    }
    if (x <= -6.4 && z >= 2.8) {
      return {
        name: 'Rayon 12 — Manga, BD & Jeux Vidéo (1990)',
        subtitle: 'Borne Démo CRT Pong Jouable · Consoles 8-Bit · Cartouches, Mangas & Réglettes Prix',
      };
    }
    if (x >= 1.4 && x <= 5.8 && z >= 3.0) {
      return {
        name: 'Rayon 1 — Primeur : Fruits & Légumes (1990)',
        subtitle: 'Étalages Bois Inclinés · Cagettes · Balance Libre-Service 1990 & Réglettes Prix',
      };
    }
    if (x >= 6.5 && z >= -1.42 && z <= 3.0) {
      return {
        name: 'Rayon 2 — Boulangerie & Viennoiserie (Point Chaud 1990)',
        subtitle: 'Four Convection Inox · Trancheuse à Pain · Paniers Osier Multi-Profondeur',
      };
    }
    if (x >= 6.5 && z >= -4.65 && z < -1.42) {
      return {
        name: 'Rayon 3 — Point Café & Snacking Chaud',
        subtitle: 'Vitrine Chauffante +65°C · Expresso 1990 · Micro-Ondes & Réglettes Prix',
      };
    }
    if (x >= 1.8 && z <= -4.45) {
      return {
        name: 'Rayon 4 — Boucherie & Charcuterie (1990)',
        subtitle: 'Billot & Couteau · Trancheuse Jambon · Balance 1990 & Vitrine Réfrigérée',
      };
    }
    if (x <= -7.8 && z >= -0.35 && z < 2.65) {
      return {
        name: 'Rayon 11 — Snacking Frais, Sandwiches & Canettes (+4 °C)',
        subtitle: 'Canettes 33cl · Sandwiches Triangles · Gâteaux Emballés PAV & Réglettes Prix',
      };
    }
    if (x <= -7.8 && z < -0.35) {
      return {
        name: 'Rayon 5 — Crémerie, Fromages & Yaourts (1990)',
        subtitle: 'Vitrine Murale +4°C · Lait, Yaourts PAV, Camembert, Beurre & Réglettes Prix',
      };
    }
    if (x <= -5.2 && z < 1.8) {
      return {
        name: 'Rayon 6 — Surgelés & Glaces (1990)',
        subtitle: 'Bacs Bahuts Coulissants -18°C · Armoire Vitrée Glaces · Réglettes Prix',
      };
    }
    if (x >= -5.2 && x < -1.6 && z >= -3.85 && z <= 2.25) {
      return {
        name: 'Rayon 7A — Épicerie Salée & Pâtes (1990)',
        subtitle: 'Huiles · Cassoulet · Coquillettes · Spaghetti · Riz · Sauces, Conserves & Moutarde PAV',
      };
    }
    if (x >= -1.6 && x < 1.25 && z >= -3.85 && z <= 2.25) {
      return {
        name: 'Rayon 7B — Épicerie Sucrée & Snacks (1990)',
        subtitle: 'Chips · Sablés · Pâte à Tartiner · Madeleines · Gaufrettes · Chocolats & Bonbons PAV',
      };
    }
    if (x >= 1.25 && x < 4.55 && z >= -3.85 && z <= 2.25) {
      return {
        name: 'Rayon 8 — Cave à Vins, Bières & Spiritueux (1990)',
        subtitle: 'Bordeaux · Bourgogne · Champagne · Bières 6×25cl · Cidre & Pastis',
      };
    }
    if (x >= 4.55 && x < 6.5 && z >= -3.8 && z < -0.95) {
      return {
        name: 'Rayon 9 — Hygiène, Beauté & Entretien',
        subtitle: 'Lessives 3L · Papier Toilette · Shampoings · Gels Douche · Dentifrices PAV',
      };
    }
    if (x >= 4.55 && x < 6.5 && z >= -0.95 && z <= 2.3) {
      return {
        name: 'Rayon 10 — Animalerie (Chien & Chat)',
        subtitle: 'Croquettes 1/3/10kg · Pâtées Présentoirs PAV · Réglettes Prix & Jouets',
      };
    }
    return {
      name: 'Zone 2 — Surface de Vente Principale',
      subtitle: 'Épicerie · Cave à Vins · Hygiène · Animalerie',
    };
  }

  private getVerbForItem(item: InteractableItem): ActionVerb {
    if (item.dynamicVerb) {
      return item.dynamicVerb();
    }
    if (item.kind === 'door_toggle') {
      return item.state ? 'FERMER' : 'OUVRIR';
    }
    if (item.kind === 'power_toggle') {
      return item.state ? 'ÉTEINDRE' : 'ALLUMER';
    }
    return 'EXAMINER';
  }

  private emitHudSnapshot(force: boolean): void {
    const zone = this.computeZoneInfo();
    const wallet = this.atmController
      ? this.atmController.getWalletStatus()
      : this.wallet.getStatus();

    const activeTool = this.tools ? this.tools.getActiveTool() : 'hands';
    const heldItem = this.tools ? this.tools.getHeldItem() : null;
    const labeler = this.tools
      ? this.tools.getLabelerHudState()
      : {
          raised: false,
          category: 'Croquettes Chien 10kg',
          ean: '30140101',
          productName: 'Croquettes Chien Grand Sac 10kg',
          inputMode: 'price' as const,
          codeInput: '',
          priceInput: '89,00',
          formattedPrice: '89,00 ₣',
          hasPrintedLabel: false,
          printedCategory: 'Croquettes Chien 10kg',
          printedEan: '30140101',
          printedProductName: 'Croquettes Chien Grand Sac 10kg',
          printedPrice: '89,00 ₣',
          syncedFromScanner: false,
        };
    const scanner = this.tools
      ? this.tools.getScannerHudState()
      : {
          raised: false,
          lastScannedEan: null,
          lastScannedName: null,
          lastScannedPrice: null,
          transferredToLabeler: false,
        };
    const orderer = this.tools
      ? this.tools.getOrdererHudState()
      : this.orderModel.getHudState(false);

    let target: TargetPrompt | null = null;
    if (this.tools && this.tools.isAnyHandheldRaised() && this.hoveredLabelerHit) {
      if (this.hoveredLabelerHit.kind === 'key') {
        target = {
          id: `labeler_key_${this.hoveredLabelerHit.code}`,
          verb: 'APPUYER',
          title: `Touche ${this.hoveredLabelerHit.displayName}`,
          subtitle: 'Étiqueteuse Électronique 1990 (3D)',
          kind: 'diegetic_action',
        };
      } else if (this.hoveredLabelerHit.kind === 'scanner_btn') {
        target = {
          id: `scanner_btn_${this.hoveredLabelerHit.code}`,
          verb: 'APPUYER',
          title: this.hoveredLabelerHit.displayName,
          subtitle: 'Terminal Scan 1990 (Bouton 3D)',
          kind: 'diegetic_action',
        };
      } else if (this.hoveredLabelerHit.kind === 'orderer_btn') {
        target = {
          id: `orderer_btn_${this.hoveredLabelerHit.code}`,
          verb: 'APPUYER',
          title: this.hoveredLabelerHit.displayName,
          subtitle: 'Terminal Commande 1990 (Bouton 3D)',
          kind: 'diegetic_action',
        };
      } else {
        target = {
          id: 'labeler_take_printed_label',
          verb: "PRENDRE L'ÉTIQUETTE",
          title: `${labeler.printedProductName} · ${labeler.printedPrice}`,
          subtitle: `EAN ${labeler.printedEan} · Étiquette papier (3D)`,
          kind: 'diegetic_action',
        };
      }
    } else if (this.hoveredItem && (!this.hoveredItem.isVisible || this.hoveredItem.isVisible())) {
      const hoveredEan = activeTool === 'scanner' ? this.getInteractableEan(this.hoveredItem) : null;
      if (hoveredEan) {
        const prod = getProductByEan(hoveredEan);
        target = {
          id: `scan_${this.hoveredItem.id}_${hoveredEan}`,
          verb: 'SCANNER CODE-BARRES',
          title: prod
            ? prod.name
            : this.hoveredItem.dynamicTitle
              ? this.hoveredItem.dynamicTitle()
              : this.hoveredItem.title,
          subtitle: `EAN ${hoveredEan} · Terminal Scan 1990`,
          kind: 'diegetic_action',
        };
      } else {
        target = {
          id: this.hoveredItem.id,
          verb: this.getVerbForItem(this.hoveredItem),
          title: this.hoveredItem.dynamicTitle
            ? this.hoveredItem.dynamicTitle()
            : this.hoveredItem.title,
          subtitle: this.hoveredItem.dynamicSubtitle
            ? this.hoveredItem.dynamicSubtitle()
            : this.hoveredItem.subtitle,
          kind: this.hoveredItem.kind,
        };
      }
    }

    const coinKey = `${wallet.coins[10]}-${wallet.coins[5]}-${wallet.coins[2]}-${wallet.coins[1]}`;
    const billKey = `${wallet.bills[500]}-${wallet.bills[200]}-${wallet.bills[100]}-${wallet.bills[50]}`;
    const toolKey = `${activeTool}|${heldItem?.kind ?? ''}|${heldItem?.priceText ?? ''}|${labeler.raised}|${labeler.ean}|${labeler.inputMode}|${labeler.codeInput}|${labeler.priceInput}|${labeler.hasPrintedLabel}|${labeler.syncedFromScanner}|${scanner.raised}|${scanner.lastScannedEan ?? ''}|${scanner.transferredToLabeler}|${orderer.raised}|${orderer.selectedLabel}|${orderer.selectedQty}|${orderer.totalCartons}|${orderer.lastStatus}`;
    const key = `${zone.name}|${target?.id ?? ''}|${target?.verb ?? ''}|${target?.title ?? ''}|${this.activeInspection?.title ?? ''}|${this.pointerLocked}|${this.seatedAtDesk}|${wallet.cashFrancs}|${wallet.bankBalance}|${billKey}|${coinKey}|${wallet.cardInHand}|${wallet.storeRevenueFrancs}|${wallet.holdingScanner}|${toolKey}`;
    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;

    this.onHudChange({
      zoneName: zone.name,
      zoneSubtitle: zone.subtitle,
      target,
      inspection: this.activeInspection,
      pointerLocked: this.pointerLocked,
      isTouchDevice: this.isTouchDevice,
      seatedAtDesk: this.seatedAtDesk,
      activeTool,
      heldItem,
      labeler,
      scanner,
      orderer,
      wallet,
    });
  }

  // ==========================================================================
  // DOM EVENTS & RENDER LOOP (With Software-WebGL Fence Pacing)
  // ==========================================================================
  private onKeyDown = (e: KeyboardEvent) => {
    this.keys[e.code] = true;
    const labelerUp = this.tools.isLabelerRaised();
    const scannerUp = this.tools.isScannerRaised();
    const ordererUp = this.tools.isOrdererRaised();
    const handheldUp = labelerUp || scannerUp || ordererUp;

    if (e.code === 'Escape') {
      this.closeInspection();
      if (this.seatedAtDesk) this.setSeatedAtDesk(false);
      if (labelerUp) this.tools.toggleLabelerRaised(false);
      if (scannerUp) this.tools.toggleScannerRaised(false);
      if (ordererUp) this.tools.toggleOrdererRaised(false);
      return;
    }

    // Physical keyboard shortcuts also press the physical 3D rubber buttons when labeler is raised
    if (labelerUp && !this.seatedAtDesk) {
      if (e.code === 'KeyR') {
        this.tools.toggleLabelerRaised(false);
        return;
      }
      if (e.code === 'KeyE') {
        this.triggerActiveTarget();
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        this.tools.pressLabelerKey(e.key);
        return;
      }
      if (e.key === ',' || e.key === '.') {
        this.tools.pressLabelerKey(',');
        return;
      }
      if (e.code === 'Backspace') {
        this.tools.pressLabelerKey('EFFACER');
        return;
      }
      if (e.code === 'Enter') {
        this.tools.pressLabelerKey('IMPRIMER');
        return;
      }
      if (e.code === 'KeyC') {
        this.tools.pressLabelerKey('CODE');
        return;
      }
      if (e.code === 'KeyP') {
        this.tools.pressLabelerKey('PRIX');
        return;
      }
    }

    if (scannerUp && !this.seatedAtDesk) {
      if (e.code === 'KeyR') {
        this.tools.toggleScannerRaised(false);
        return;
      }
      if (e.code === 'KeyT') {
        this.tools.transferScannedToLabeler();
        return;
      }
    }

    if (ordererUp && !this.seatedAtDesk) {
      if (e.code === 'KeyR') {
        this.tools.toggleOrdererRaised(false);
        return;
      }
      if (e.code === 'ArrowUp') {
        this.tools.pressOrdererKey('HAUT');
        return;
      }
      if (e.code === 'ArrowDown') {
        this.tools.pressOrdererKey('BAS');
        return;
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        this.tools.pressOrdererKey('QTE+');
        return;
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        this.tools.pressOrdererKey('QTE-');
        return;
      }
      if (e.code === 'KeyV') {
        this.tools.pressOrdererKey('VALIDER');
        return;
      }
      if (e.code === 'Enter') {
        this.tools.pressOrdererKey('TRANSMETTRE');
        return;
      }
    }

    if (e.code === 'KeyE' || e.code === 'Enter') {
      this.triggerActiveTarget();
    } else if (e.code === 'Space' && this.seatedAtDesk) {
      this.setSeatedAtDesk(false);
    } else if (!this.seatedAtDesk && !handheldUp && e.code === 'Digit1') {
      this.tools.selectTool('hands');
    } else if (!this.seatedAtDesk && !handheldUp && e.code === 'Digit2') {
      this.tools.selectTool('scanner');
    } else if (!this.seatedAtDesk && !handheldUp && e.code === 'Digit3') {
      this.tools.selectTool('labeler');
    } else if (!this.seatedAtDesk && !handheldUp && e.code === 'Digit4') {
      this.tools.selectTool('orderer');
    } else if (!this.seatedAtDesk && !handheldUp && e.code === 'Digit5') {
      this.tools.selectTool('cutter');
    } else if (!this.seatedAtDesk && e.code === 'KeyR' && this.tools.getActiveTool() === 'labeler') {
      this.tools.toggleLabelerRaised();
    } else if (!this.seatedAtDesk && e.code === 'KeyR' && this.tools.getActiveTool() === 'scanner') {
      this.tools.toggleScannerRaised();
    } else if (!this.seatedAtDesk && e.code === 'KeyR' && this.tools.getActiveTool() === 'orderer') {
      this.tools.toggleOrdererRaised();
    } else if (!this.seatedAtDesk && e.code === 'KeyT' && this.tools.getActiveTool() === 'scanner') {
      this.tools.transferScannedToLabeler();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onWindowTouchStart = () => {
    this.lastTouchEventTime = performance.now();
  };

  private onPointerDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (performance.now() - this.lastTouchEventTime < 600) return;

    // Direct mouse-click raycasting on the 15 3D rubber buttons & extruded paper label
    if (document.pointerLockElement !== this.renderer.domElement) {
      if (this.triggerLabelerAtScreen(e.clientX, e.clientY)) {
        return;
      }
    }

    this.isDraggingLook = true;
    this.dragMoved = false;
    this.dragStartPos.x = e.clientX;
    this.dragStartPos.y = e.clientY;
  };

  private onPointerMove = (e: MouseEvent) => {
    if (document.pointerLockElement === this.renderer.domElement) {
      if (this.tools.isAnyHandheldRaised()) {
        this.tools.applyLabelerReticlePan(e.movementX, e.movementY);
        return;
      }
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - e.movementY * sens,
        -Math.PI * 0.44,
        Math.PI * 0.44
      );
      return;
    }

    if (this.isDraggingLook) {
      const dx = e.clientX - this.dragStartPos.x;
      const dy = e.clientY - this.dragStartPos.y;
      if (Math.hypot(dx, dy) > 4) {
        this.dragMoved = true;
      }
      this.dragStartPos.x = e.clientX;
      this.dragStartPos.y = e.clientY;

      const sens = 0.0032;
      this.yaw -= dx * sens;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - dy * sens,
        -Math.PI * 0.44,
        Math.PI * 0.44
      );
      return;
    }

    // Throttled desktop hover highlight on 3D labeler, scanner & ordering terminal buttons when unlocked
    if (
      this.tools.isLabelerRaised() ||
      this.tools.getActiveTool() === 'scanner' ||
      this.tools.getActiveTool() === 'orderer'
    ) {
      const now = performance.now();
      if (now - this.lastLabelerHoverTime >= 35) {
        this.lastLabelerHoverTime = now;
        const ndc = this.getCanvasNdc(e.clientX, e.clientY);
        const hit = ndc ? this.tools.raycastLabelerNdc(ndc.x, ndc.y) : null;
        const code =
          hit &&
          (hit.kind === 'key' || hit.kind === 'scanner_btn' || hit.kind === 'orderer_btn')
            ? hit.code
            : null;
        this.tools.setHoveredLabelerCode(code);
        this.renderer.domElement.style.cursor = hit ? 'pointer' : '';
      }
    } else if (this.renderer.domElement.style.cursor) {
      this.renderer.domElement.style.cursor = '';
    }
  };

  private onPointerUp = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (performance.now() - this.lastTouchEventTime < 600) {
      this.isDraggingLook = false;
      return;
    }
    const wasDragging = this.isDraggingLook;
    this.isDraggingLook = false;

    if (document.pointerLockElement === this.renderer.domElement) {
      this.triggerActiveTarget();
      return;
    }

    if (!wasDragging) return;

    if (!this.dragMoved) {
      if (this.tools.isAnyHandheldRaised()) {
        // Click outside the 3D buttons while raised doesn't hijack the cursor with PointerLock
        return;
      }
      // If aiming at an interactable when unlocked, trigger it; otherwise try requesting PointerLock
      if (this.hoveredItem) {
        this.triggerActiveTarget();
      } else if (!this.isTouchDevice && this.renderer.domElement.requestPointerLock) {
        try {
          const lockPromise = this.renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
          lockPromise?.catch?.(() => {
            // Silently fall back to click-and-drag look inside restricted iframes
          });
        } catch {
          // Silently fall back to click-and-drag look
        }
      }
    }
  };

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.tools.resetLabelerReticlePan();
    this.emitHudSnapshot(true);
  };

  private onResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
  };

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    window.addEventListener('touchstart', this.onWindowTouchStart, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.container);
    }
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    dom.addEventListener('mousedown', this.onPointerDown);
    window.addEventListener('mousemove', this.onPointerMove);
    window.addEventListener('mouseup', this.onPointerUp);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const dt = Math.min(this.clock.getDelta(), 0.08);
    const elapsed = this.clock.elapsedTime;

    this.updateMovement(dt);

    for (let i = 0; i < this.updaters.length; i++) {
      this.updaters[i].update(dt, elapsed);
    }

    this.updateRaycast(false);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    const dom = this.renderer.domElement;
    window.removeEventListener('touchstart', this.onWindowTouchStart);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    dom.removeEventListener('mousedown', this.onPointerDown);
    window.removeEventListener('mousemove', this.onPointerMove);
    window.removeEventListener('mouseup', this.onPointerUp);

    this.texBank.dispose();
    this.mats.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];

    soundSynth.dispose();

    this.renderer.dispose();
    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}
