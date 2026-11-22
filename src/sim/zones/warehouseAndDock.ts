import * as THREE from 'three';
import {
  MaterialLibrary,
  addBoxCollider,
  buildInstancedMesh,
  InstanceEntry,
  registerInteractableBox,
} from '../materials';
import { INTERACT_LAYER, ProceduralTextureBank } from '../textures';
import { InteractableItem, WorldBuildContext } from '../types';
import { PlayerWallet } from '../wallet';
import { PlayerToolController } from '../playerTools';
import {
  ORDER_CATALOG,
  OrderableCartonDef,
  OrderTerminalKeyCode,
  OrderTerminalModel,
} from '../orderCatalog';
import { drawEanBarcode } from '../productCatalog';
import { soundSynth } from '../audio';

export function buildWarehouseAndLoadingDock(
  ctx: WorldBuildContext,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  wallet: PlayerWallet,
  tools: PlayerToolController,
  orderModel: OrderTerminalModel,
  getPlayerPos?: () => THREE.Vector3
): void {
  const root = new THREE.Group();
  ctx.scene.add(root);

  const wallH = 4.2;

  // ============================================================================
  // 1. PARTITION WALL AT Z = -7.0 & DOUBLE SWINGING WAREHOUSE DOORS ("PORTES BATTANTES")
  // Doorway opening: X = -2.8 to X = -0.4 (2.4m wide x 2.55m tall)
  // ============================================================================
  const addWallSeg = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    colId?: string
  ) => {
    const g = new THREE.BoxGeometry(w, h, d);
    ctx.disposables.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
    if (colId) {
      addBoxCollider(ctx, colId, x - w / 2, x + w / 2, z - d / 2, z + d / 2);
    }
    return m;
  };

  // Partition wall segments at Z = -7.0
  addWallSeg(7.2, wallH, 0.24, -6.4, wallH / 2, -7.0, mats.wallPlaster, 'part_wall_left');
  addWallSeg(10.4, wallH, 0.24, 4.8, wallH / 2, -7.0, mats.wallPlaster, 'part_wall_right');
  addWallSeg(2.4, wallH - 2.55, 0.24, -1.6, 2.55 + (wallH - 2.55) / 2, -7.0, mats.wallPlaster);

  // Sign above warehouse swinging doors
  const whSignTex = texBank.createDepartmentSignTexture(
    'RÉSERVE & QUAI DE LIVRAISON',
    'ACCÈS LOGISTIQUE · PORTES BATTANTES À HUBLOTS',
    '#334155',
    '#f59e0b'
  );
  const whSignMat = new THREE.MeshStandardMaterial({ map: whSignTex, roughness: 0.35 });
  const whSign = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.42, 0.06), whSignMat);
  whSign.position.set(-1.6, 2.86, -6.86);
  root.add(whSign);
  ctx.disposables.push(whSignMat, whSign.geometry);

  // V24: Heavy Double Swinging Warehouse Doors ("Portes Battantes Va-et-Vient — Réserve")
  //      True circular porthole cutout via ExtrudeGeometry + aligned glass pane, brushed metal
  //      trim bezel, black rubber EPDM gasket, stainless kick-plates, and automatic walk-through
  //      damped spring swing physics (±85° in player walking direction within 1.8m)
  const pvcDoorMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.44,
    metalness: 0.22,
  });
  ctx.disposables.push(pvcDoorMat);

  const leafW = 1.18;
  const leafH = 2.54;
  const leafThick = 0.056;
  const portholeR = 0.245;
  const portholeY = 1.7;

  // Shared circular porthole geometries (identical circular profile & radius!)
  const portholeGlassGeo = new THREE.CylinderGeometry(portholeR - 0.004, portholeR - 0.004, 0.016, 32);
  portholeGlassGeo.rotateX(Math.PI / 2);
  const portholeGasketGeo = new THREE.TorusGeometry(portholeR, 0.024, 12, 32);
  const portholeMetalTrimGeo = new THREE.TorusGeometry(portholeR + 0.022, 0.009, 10, 32);
  const kickPlateGeo = new THREE.BoxGeometry(leafW - 0.06, 0.62, leafThick + 0.012);
  const pushBandGeo = new THREE.BoxGeometry(leafW - 0.06, 0.2, leafThick + 0.012);
  const meetingSealGeo = new THREE.BoxGeometry(0.024, leafH - 0.02, leafThick + 0.006);
  const hingeBarrelGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.14, 10);
  ctx.disposables.push(
    portholeGlassGeo,
    portholeGasketGeo,
    portholeMetalTrimGeo,
    kickPlateGeo,
    pushBandGeo,
    meetingSealGeo,
    hingeBarrelGeo
  );

  const buildSwingLeaf = (hingeX: number, dirSign: 1 | -1) => {
    const pivot = new THREE.Group();
    pivot.position.set(hingeX, 0, -7.0);
    root.add(pivot);

    const offset = (leafW / 2) * dirSign;

    // Single solid door leaf with a true circular porthole cutout (zero square corners!)
    const minX = dirSign > 0 ? 0 : -leafW;
    const maxX = dirSign > 0 ? leafW : 0;
    const doorShape = new THREE.Shape();
    doorShape.moveTo(minX, 0.01);
    doorShape.lineTo(maxX, 0.01);
    doorShape.lineTo(maxX, leafH);
    doorShape.lineTo(minX, leafH);
    doorShape.closePath();

    const holePath = new THREE.Path();
    holePath.absarc(offset, portholeY, portholeR, 0, Math.PI * 2, true);
    doorShape.holes.push(holePath);

    const doorPanelGeo = new THREE.ExtrudeGeometry(doorShape, {
      depth: leafThick,
      bevelEnabled: false,
      curveSegments: 32,
    });
    doorPanelGeo.translate(0, 0, -leafThick / 2);
    ctx.disposables.push(doorPanelGeo);

    const doorPanel = new THREE.Mesh(doorPanelGeo, pvcDoorMat);
    doorPanel.castShadow = true;
    doorPanel.receiveShadow = true;

    // Brushed stainless-steel lower kick-plate & mid-height cart push-plate ("plaques de poussée inox")
    const kickPlate = new THREE.Mesh(kickPlateGeo, mats.stainless);
    kickPlate.position.set(offset, 0.34, 0);
    const pushBand = new THREE.Mesh(pushBandGeo, mats.stainless);
    pushBand.position.set(offset, 1.04, 0);

    // Center meeting-edge black rubber bumper seal
    const meetingSeal = new THREE.Mesh(meetingSealGeo, mats.rubberBlack);
    meetingSeal.position.set(dirSign * (leafW - 0.012), leafH / 2, 0);

    // Aligned circular clear glass disc + wrapping black EPDM gasket + dual stainless bezel trim rings
    const portholeGlass = new THREE.Mesh(portholeGlassGeo, mats.clearGlass);
    portholeGlass.position.set(offset, portholeY, 0);

    const portholeGasket = new THREE.Mesh(portholeGasketGeo, mats.rubberBlack);
    portholeGasket.position.set(offset, portholeY, 0);
    portholeGasket.scale.set(1, 1, 1.48);

    const trimFront = new THREE.Mesh(portholeMetalTrimGeo, mats.stainless);
    trimFront.position.set(offset, portholeY, leafThick / 2 + 0.004);
    const trimBack = new THREE.Mesh(portholeMetalTrimGeo, mats.stainless);
    trimBack.position.set(offset, portholeY, -leafThick / 2 - 0.004);

    // Double-action spring hinge barrels along outer hinge edge
    [0.42, 1.28, 2.14].forEach((hy) => {
      const barrel = new THREE.Mesh(hingeBarrelGeo, mats.stainless);
      barrel.position.set(dirSign * 0.008, hy, 0);
      pivot.add(barrel);
    });

    pivot.add(
      doorPanel,
      kickPlate,
      pushBand,
      meetingSeal,
      portholeGlass,
      portholeGasket,
      trimFront,
      trimBack
    );
    return pivot;
  };

  const leftSwingPivot = buildSwingLeaf(-2.8, 1);
  const rightSwingPivot = buildSwingLeaf(-0.4, -1);
  const swingDoorCol = addBoxCollider(ctx, 'warehouse_swing_doors', -2.8, -0.4, -7.14, -6.86, true);

  // Automatic walk-through proximity (1.8m) + directional latch + damped va-et-vient spring physics
  const SWING_MAX_RAD = (85 * Math.PI) / 180; // ±85° away from approaching player
  let swingAngle = 0;
  let swingVelocity = 0;
  let manualOpen = false;
  let manualDir: 1 | -1 = 1;
  let autoActive = false;
  let autoSwingDir: 1 | -1 = 1;

  ctx.updaters.push({
    update: (rawDt) => {
      const dt = Math.min(rawDt, 0.05);

      if (getPlayerPos) {
        const p = getPlayerPos();
        const dist = Math.hypot(p.x - -1.6, p.z - -7.0);
        // Trigger hands-free auto-open within 1.8m; slight 0.15m release hysteresis prevents chatter
        const nextAuto = autoActive ? dist <= 1.95 : dist <= 1.8;
        if (nextAuto && !autoActive) {
          // Latch swing direction on entry so doors swing away from the player (never back into their face!)
          // p.z >= -7.0 (Sales Floor -> Warehouse -Z) => +85°; p.z < -7.0 (Warehouse -> Sales Floor +Z) => -85°
          autoSwingDir = p.z >= -7.0 ? 1 : -1;
        }
        autoActive = nextAuto;
      }

      const targetAngle = autoActive
        ? autoSwingDir * SWING_MAX_RAD
        : manualOpen
          ? manualDir * SWING_MAX_RAD
          : 0;

      // Second-order spring physics: snappy open push, gentle underdamped va-et-vient bounce-back when closing
      const isOpening = Math.abs(targetAngle) > 0.01;
      const stiffness = isOpening ? 48.0 : 24.0;
      const damping = isOpening ? 11.8 : 4.6;

      const accel = (targetAngle - swingAngle) * stiffness - swingVelocity * damping;
      swingVelocity += accel * dt;
      swingAngle += swingVelocity * dt;

      // Clamp hard physical hinge stops at ±92°
      const hardLimit = (92 * Math.PI) / 180;
      if (swingAngle > hardLimit) {
        swingAngle = hardLimit;
        if (swingVelocity > 0) swingVelocity = 0;
      } else if (swingAngle < -hardLimit) {
        swingAngle = -hardLimit;
        if (swingVelocity < 0) swingVelocity = 0;
      }

      // Snap tiny residual oscillation to clean 0 when closed & settled
      if (!isOpening && Math.abs(swingAngle) < 0.002 && Math.abs(swingVelocity) < 0.005) {
        swingAngle = 0;
        swingVelocity = 0;
      }

      leftSwingPivot.rotation.y = swingAngle;
      rightSwingPivot.rotation.y = -swingAngle;

      // Keep doorway collider completely open while player approaches, walks through, or holds doors open
      swingDoorCol.enabled = !autoActive && !manualOpen && Math.abs(swingAngle) < 0.25;
    },
  });

  registerInteractableBox(ctx, root, {
    id: 'warehouse_doors_toggle',
    title: 'Portes Battantes Va-et-Vient Entrepôt',
    subtitle: 'Ouverture Automatique au Passage · Hublots Circulaires',
    kind: 'door_toggle',
    initialState: false,
    inspectText:
      'Double porte battante va-et-vient à charnières à ressort avec hublots circulaires alignés et plaques de poussée inox. S’ouvre automatiquement à votre approche (1,8 m), même les bras chargés.',
    size: [2.4, 2.5, 0.35],
    position: [-1.6, 1.25, -7.0],
    onToggle: (open) => {
      manualOpen = open;
      if (open && getPlayerPos) {
        const p = getPlayerPos();
        manualDir = p.z >= -7.0 ? 1 : -1;
      }
      if (!open) {
        autoActive = false;
      }
    },
  });

  // ============================================================================
  // 2. INDOOR REAR WAREHOUSE (Z = -7.0 to -13.0, X = -10.0 to +10.0 = 120 m²)
  //    V23: Sealed Industrial Concrete Floor, Yellow Pedestrian Walkways,
  //    Hatched Pallet Loading Zones, Painted Cinder-Block Walls & Safety Signage
  // ============================================================================
  const whFloorGeo = new THREE.PlaneGeometry(20.0, 6.0);
  ctx.disposables.push(whFloorGeo);
  const whFloor = new THREE.Mesh(whFloorGeo, mats.warehouseEpoxy);
  whFloor.rotation.x = -Math.PI / 2;
  whFloor.position.set(0, 0.007, -10.0);
  whFloor.receiveShadow = true;
  root.add(whFloor);

  // Yellow painted pedestrian walkway lines & hatched pallet loading-zone borders
  const yellowLineMat = new THREE.MeshBasicMaterial({
    color: 0xeab308,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  ctx.disposables.push(yellowLineMat);

  const addFloorLine = (w: number, d: number, x: number, z: number) => {
    const g = new THREE.PlaneGeometry(w, d);
    ctx.disposables.push(g);
    const m = new THREE.Mesh(g, yellowLineMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.013, z);
    root.add(m);
  };

  const addHatchedLoadingZone = (x: number, z: number, w: number, d: number) => {
    const g = new THREE.PlaneGeometry(w, d);
    ctx.disposables.push(g);
    const hatch = new THREE.Mesh(g, mats.hatchedZone);
    hatch.rotation.x = -Math.PI / 2;
    hatch.position.set(x, 0.011, z);
    root.add(hatch);

    // Crisp 0.08m solid yellow perimeter border frame around the hatched zone
    const border = 0.08;
    addFloorLine(w, border, x, z - d / 2 + border / 2);
    addFloorLine(w, border, x, z + d / 2 - border / 2);
    addFloorLine(border, d, x - w / 2 + border / 2, z);
    addFloorLine(border, d, x + w / 2 - border / 2, z);
  };

  // Main north-south pedestrian & pallet-jack corridor from swinging doors to loading dock
  addFloorLine(0.09, 5.75, -3.22, -10.0);
  addFloorLine(0.09, 5.75, 0.02, -10.0);
  // East-west safety walkway borders flanking rack aisles
  addFloorLine(5.8, 0.08, -6.2, -10.92);
  addFloorLine(5.8, 0.08, -6.2, -9.08);
  addFloorLine(6.4, 0.08, 6.4, -10.92);
  // Hatched yellow pallet loading zone under Delivery Pallets #1 & #2 (X = 0.14..3.06, Z = -10.28..-8.62)
  addHatchedLoadingZone(1.6, -9.45, 2.92, 1.66);
  // Hatched yellow loading-dock safety apron in front of Dock Portal (X = -3.15..+0.75, Z = -12.78..-11.36)
  addHatchedLoadingZone(-1.2, -12.07, 3.9, 1.42);

  // Rear Exterior Warehouse Wall at Z = -13.0 with Open Loading Dock Portal at X = -3.4 to +1.0 (4.4m wide)
  addWallSeg(6.6, wallH, 0.26, -6.7, wallH / 2, -13.0, mats.facadeCladding, 'rear_wall_left');
  addWallSeg(9.0, wallH, 0.26, 5.5, wallH / 2, -13.0, mats.facadeCladding, 'rear_wall_right');
  addWallSeg(4.4, 1.15, 0.26, -1.2, wallH - 0.575, -13.0, mats.facadeCladding);

  // V26: Interactive Corrugated Metal Roll-Up Shutter Door ("Rideau Métallique Quai de Livraison")
  //      Starts rolled UP (open) so delivery dock remains 100% freely walkable; toggle via wall switch!
  {
    const shutterW = 4.38;
    const shutterMaxH = 3.04;

    // Interior & Exterior Galvanized Shutter Drum Housing above Dock Portal
    addWallSeg(4.64, 0.42, 0.42, -1.2, 3.16, -12.82, mats.galvanized);
    addWallSeg(4.64, 0.44, 0.42, -1.2, 3.18, -13.24, mats.galvanized);

    // Heavy Galvanized Vertical U-Channel Guide Tracks flanking the 4.4m portal
    const trackGeo = new THREE.BoxGeometry(0.11, shutterMaxH + 0.08, 0.16);
    ctx.disposables.push(trackGeo);
    [-3.42, 1.02].forEach((tx) => {
      const tr = new THREE.Mesh(trackGeo, mats.galvanized);
      tr.position.set(tx, shutterMaxH / 2, -13.08);
      root.add(tr);
    });

    // Animated Corrugated Steel Shutter Curtain (anchored at top Y = 3.04m, scales cleanly downward)
    const curtainPivot = new THREE.Group();
    curtainPivot.position.set(-1.2, shutterMaxH, -13.06);
    root.add(curtainPivot);

    const curtainGeo = new THREE.BoxGeometry(shutterW, shutterMaxH, 0.055);
    curtainGeo.translate(0, -shutterMaxH / 2, 0);
    ctx.disposables.push(curtainGeo);
    const curtainMesh = new THREE.Mesh(curtainGeo, mats.rollUpShutter);
    curtainMesh.castShadow = true;
    curtainMesh.receiveShadow = true;
    curtainPivot.add(curtainMesh);

    // Yellow-and-black hazard bottom safety bar moving with the bottom edge of the shutter
    const bottomBarGeo = new THREE.BoxGeometry(shutterW + 0.04, 0.12, 0.085);
    ctx.disposables.push(bottomBarGeo);
    const bottomBar = new THREE.Mesh(bottomBarGeo, mats.hazardStripe);
    bottomBar.position.set(-1.2, shutterMaxH - 0.14, -13.06);
    root.add(bottomBar);

    // Dynamic collider: disabled when rolled open (default), enabled when lowered
    const dockShutterCol = addBoxCollider(ctx, 'dock_shutter_col', -3.4, 1.0, -13.18, -12.92, false);

    // Dual-sided Industrial Wall Control Box (Interior Warehouse side & Exterior Dock side at X = 1.38)
    const switchBoxGeo = new THREE.BoxGeometry(0.18, 0.28, 0.09);
    const btnGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.025, 10);
    btnGeo.rotateX(Math.PI / 2);
    const btnGreenMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x16a34a,
      emissiveIntensity: 0.7,
      roughness: 0.35,
    });
    const btnRedMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xdc2626,
      emissiveIntensity: 0.55,
      roughness: 0.35,
    });
    ctx.disposables.push(switchBoxGeo, btnGeo, btnGreenMat, btnRedMat);

    const buildSwitchBox = (zPos: number, dirSign: 1 | -1) => {
      const boxGrp = new THREE.Group();
      boxGrp.position.set(1.42, 1.38, zPos);
      const box = new THREE.Mesh(switchBoxGeo, mats.anthracite);
      const upBtn = new THREE.Mesh(btnGeo, btnGreenMat);
      upBtn.position.set(0, 0.055, dirSign * 0.05);
      const dnBtn = new THREE.Mesh(btnGeo, btnRedMat);
      dnBtn.position.set(0, -0.055, dirSign * 0.05);
      boxGrp.add(box, upBtn, dnBtn);
      root.add(boxGrp);
    };
    buildSwitchBox(-12.82, 1);
    buildSwitchBox(-13.18, -1);

    let shutterOpen = true; // Starts rolled UP so dock is open and walkable
    let shutterCloseFactor = 0.08; // 0.08 = rolled up (lip visible), 1.0 = fully closed
    let shutterLockTs = 0;

    curtainPivot.scale.y = shutterCloseFactor;
    bottomBar.position.y = shutterMaxH - shutterCloseFactor * shutterMaxH + 0.06;

    ctx.updaters.push({
      update: (dt: number) => {
        const target = shutterOpen ? 0.08 : 1.0;
        shutterCloseFactor = THREE.MathUtils.damp(shutterCloseFactor, target, 4.2, dt);
        curtainPivot.scale.y = shutterCloseFactor;
        bottomBar.position.y = shutterMaxH - shutterCloseFactor * shutterMaxH + 0.06;
        dockShutterCol.enabled = shutterCloseFactor > 0.42;
      },
    });

    const toggleDockShutter = () => {
      const now = performance.now();
      if (now - shutterLockTs < 320) return;
      shutterLockTs = now;
      shutterOpen = !shutterOpen;
      soundSynth.playMetalDrawerSlide(!shutterOpen);
    };

    // Register both interior & exterior control switches with 320ms debounce
    const shutterHitMat = new THREE.MeshBasicMaterial({ visible: false });
    ctx.disposables.push(shutterHitMat);
    const registerShutterSwitch = (id: string, zPos: number) => {
      const hitGeo = new THREE.BoxGeometry(0.45, 0.55, 0.35);
      ctx.disposables.push(hitGeo);
      const hitMesh = new THREE.Mesh(hitGeo, shutterHitMat);
      hitMesh.position.set(1.42, 1.38, zPos);
      hitMesh.layers.set(INTERACT_LAYER);
      root.add(hitMesh);

      const item: InteractableItem = {
        id,
        title: 'Commande Rideau Métallique Quai',
        subtitle: 'Rideau Ondulé Motorisé 1990',
        kind: 'diegetic_action',
        state: true,
        proxyMesh: hitMesh,
        inspectText:
          'Rideau métallique en acier galvanisé ondulé protégeant le quai de livraison. Actionnez le boîtier pour ouvrir ou fermer le quai.',
        dynamicSubtitle: () =>
          shutterOpen
            ? 'Rideau relevé · Quai ouvert aux livraisons'
            : 'Rideau abaissé · Quai de livraison fermé',
        dynamicVerb: () => (shutterOpen ? 'FERMER RIDEAU QUAI' : 'OUVRIR RIDEAU QUAI'),
        onInteract: toggleDockShutter,
      };
      hitMesh.userData.interactable = item;
      ctx.interactables.push(item);
    };
    registerShutterSwitch('dock_shutter_switch_in', -12.76);
    registerShutterSwitch('dock_shutter_switch_out', -13.24);

    // Exterior Loading Dock Shelter Canopy Hood ("Auvent Quai de Livraison") + Crisp Exterior Sign
    const canopyGrp = new THREE.Group();
    canopyGrp.position.set(-1.2, 3.55, -13.76);
    root.add(canopyGrp);

    const hoodRoof = new THREE.Mesh(new THREE.BoxGeometry(5.15, 0.16, 1.28), mats.anthracite);
    hoodRoof.castShadow = true;
    hoodRoof.receiveShadow = true;
    const hoodSoffit = new THREE.Mesh(new THREE.BoxGeometry(4.95, 0.02, 1.12), mats.whiteMetal);
    hoodSoffit.position.y = -0.085;
    const hoodNavyTrim = new THREE.Mesh(new THREE.BoxGeometry(5.18, 0.06, 0.03), mats.retailStripeNavy);
    hoodNavyTrim.position.set(0, 0.04, -0.65);
    const hoodRedTrim = new THREE.Mesh(new THREE.BoxGeometry(5.18, 0.04, 0.03), mats.retailStripeRed);
    hoodRedTrim.position.set(0, -0.02, -0.65);
    // Diagonal steel support struts anchoring dock canopy to rear wall
    const strutGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.92, 8);
    [-2.25, 2.25].forEach((sx) => {
      const st = new THREE.Mesh(strutGeo, mats.galvanized);
      st.position.set(sx, -0.28, 0.25);
      st.rotation.x = -0.82;
      canopyGrp.add(st);
    });
    // Crisp Exterior Dock Header Sign mounted above canopy fascia (facing -Z toward yard)
    const dockSignTex = texBank.createDepartmentSignTexture(
      'QUAI DE LIVRAISON',
      'RÉCEPTION MARCHANDISES · CONTACT EXPRESS',
      '#1e293b',
      '#dc2626'
    );
    const dockSignMat = new THREE.MeshStandardMaterial({ map: dockSignTex, roughness: 0.42 });
    const dockSignBack = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.52, 0.06), mats.anthracite);
    dockSignBack.position.set(0, 0.34, -0.62);
    const dockSignFace = new THREE.Mesh(new THREE.PlaneGeometry(3.68, 0.44), dockSignMat);
    dockSignFace.position.set(0, 0.34, -0.655);
    dockSignFace.rotation.y = Math.PI;

    canopyGrp.add(hoodRoof, hoodSoffit, hoodNavyTrim, hoodRedTrim, dockSignBack, dockSignFace);
    ctx.disposables.push(
      hoodRoof.geometry,
      hoodSoffit.geometry,
      hoodNavyTrim.geometry,
      hoodRedTrim.geometry,
      strutGeo,
      dockSignMat,
      dockSignBack.geometry,
      dockSignFace.geometry
    );
  }

  // V23: Painted Industrial Cinder-Block Interior Cladding on All 4 Rear Warehouse Walls
  const addBlockCladding = (w: number, h: number, x: number, y: number, z: number, rotY: number) => {
    const g = new THREE.PlaneGeometry(w, h);
    ctx.disposables.push(g);
    const m = new THREE.Mesh(g, mats.warehouseBlockWall);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.receiveShadow = true;
    root.add(m);
  };
  // West & East inner warehouse walls (Z = -12.86..-7.13)
  addBlockCladding(5.76, wallH, -9.855, wallH / 2, -10.0, Math.PI / 2);
  addBlockCladding(5.76, wallH, 9.855, wallH / 2, -10.0, -Math.PI / 2);
  // North rear wall inner faces (left, right, and lintel above loading dock portal)
  addBlockCladding(6.48, wallH, -6.64, wallH / 2, -12.855, 0);
  addBlockCladding(8.88, wallH, 5.44, wallH / 2, -12.855, 0);
  addBlockCladding(4.4, 1.15, -1.2, wallH - 0.575, -12.855, 0);
  // South partition wall north faces (left, right, and lintel above swinging doors)
  addBlockCladding(7.06, wallH, -6.35, wallH / 2, -7.135, Math.PI);
  addBlockCladding(10.26, wallH, 4.75, wallH / 2, -7.135, Math.PI);
  addBlockCladding(2.4, wallH - 2.55, -1.6, 2.55 + (wallH - 2.55) / 2, -7.135, Math.PI);

  // Industrial yellow-and-black safety wainscot striping + dark concrete kickboard around warehouse walls
  const addWhWallStripe = (w: number, x: number, z: number, rotY: number) => {
    const sg = new THREE.PlaneGeometry(w, 0.14);
    const kg = new THREE.PlaneGeometry(w, 0.16);
    ctx.disposables.push(sg, kg);
    const s = new THREE.Mesh(sg, mats.hazardStripe);
    s.position.set(x, 1.12, z);
    s.rotation.y = rotY;
    const k = new THREE.Mesh(kg, mats.concreteDark);
    k.position.set(x, 0.08, z);
    k.rotation.y = rotY;
    root.add(s, k);
  };
  addWhWallStripe(5.72, -9.84, -10.0, Math.PI / 2);
  addWhWallStripe(5.72, 9.84, -10.0, -Math.PI / 2);
  addWhWallStripe(6.44, -6.64, -12.84, 0);
  addWhWallStripe(8.84, 5.44, -12.84, 0);
  addWhWallStripe(7.02, -6.35, -7.15, Math.PI);
  addWhWallStripe(10.22, 4.75, -7.15, Math.PI);

  // Structural Dock Portal Corner Piers with Yellow-and-Black Hazard Corner Guards
  const dockPierGeo = new THREE.BoxGeometry(0.24, wallH, 0.24);
  const dockGuardGeo = new THREE.BoxGeometry(0.27, 1.4, 0.27);
  ctx.disposables.push(dockPierGeo, dockGuardGeo);
  [-3.48, 1.08].forEach((px) => {
    const pier = new THREE.Mesh(dockPierGeo, mats.concrete);
    pier.position.set(px, wallH / 2, -12.76);
    const guard = new THREE.Mesh(dockGuardGeo, mats.hazardStripe);
    guard.position.set(px, 0.78, -12.76);
    root.add(pier, guard);
  });

  // Framed Industrial Warehouse Zone & Safety Signage on Cinder-Block Walls
  const addFramedWarehouseSign = (
    title: string,
    sub: string,
    bg: string,
    accent: string,
    w: number,
    h: number,
    x: number,
    y: number,
    z: number,
    rotY: number
  ) => {
    const tex = texBank.createDepartmentSignTexture(title, sub, bg, accent);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42 });
    const frameGeo = new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.035);
    const faceGeo = new THREE.PlaneGeometry(w, h);
    ctx.disposables.push(mat, frameGeo, faceGeo);
    const frame = new THREE.Mesh(frameGeo, mats.anthracite);
    frame.position.set(x, y, z);
    frame.rotation.y = rotY;
    const face = new THREE.Mesh(faceGeo, mat);
    face.position.z = 0.02;
    frame.add(face);
    root.add(frame);
  };

  addFramedWarehouseSign(
    'QUAI DE RÉCEPTION & LIVRAISONS',
    'PORT DES EPI OBLIGATOIRE · DÉGAGEMENT PERMANENT',
    '#1e293b',
    '#eab308',
    3.6,
    0.46,
    -1.2,
    3.58,
    -12.82,
    0
  );
  addFramedWarehouseSign(
    'ZONE 5 — RÉSERVE LOGISTIQUE 1990',
    'PALETTIERS TRAVÉES A–E · PRESSE À BALLES CARTONS',
    '#0f172a',
    '#38bdf8',
    3.2,
    0.44,
    9.82,
    2.78,
    -10.0,
    -Math.PI / 2
  );

  // ============================================================================
  // 2B. V21 UNIFIED CARRYABLE SHIPPING BOX & INTERACTIVE PALLET RACK STORAGE SYSTEM
  //     Replaces all static placeholder blocks with 5 department-organized labeled
  //     pallet bays (Travées A–E), 14 real scannable starter reserve boxes (including
  //     2 starter boxes of Plastic Price Rails EAN 30140001), and free store/grab!
  // ============================================================================
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.45 });
  const innerDarkCbMat = new THREE.MeshStandardMaterial({ color: 0x5c3e23, roughness: 0.94 });
  const railPvcBackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.42, metalness: 0.06 });
  const railPvcClearMat = new THREE.MeshStandardMaterial({
    color: 0xdcf4ff,
    transparent: true,
    opacity: 0.48,
    roughness: 0.14,
    metalness: 0.08,
    depthWrite: false,
  });
  const handleAccentMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
  const slotGuideMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const proxyHiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(
    tapeMat,
    innerDarkCbMat,
    railPvcBackMat,
    railPvcClearMat,
    handleAccentMat,
    slotGuideMat,
    proxyHiddenMat
  );

  // Shared box geometries (reused across all rack & delivery slots for locked 60 FPS)
  const stdW = 0.48;
  const stdH = 0.34;
  const stdD = 0.5;
  const crateH = 0.24;
  const longW = 1.08;
  const longH = 0.19;
  const longD = 0.28;

  const sharedStdBodyGeo = new THREE.BoxGeometry(stdW, stdH, stdD);
  const sharedStdInnerGeo = new THREE.BoxGeometry(stdW - 0.036, 0.02, stdD - 0.036);
  const sharedStdFlapGeo = new THREE.BoxGeometry(stdW / 2 - 0.004, 0.012, stdD - 0.01);
  const sharedStdTapeGeo = new THREE.BoxGeometry(0.065, 0.016, stdD + 0.006);
  const sharedStdLblGeo = new THREE.PlaneGeometry(0.34, 0.21);
  const sharedCrateLblGeo = new THREE.PlaneGeometry(0.32, 0.16);
  const sharedHandleGeo = new THREE.BoxGeometry(0.14, 0.032, 0.014);

  const sharedCrateBaseGeo = new THREE.BoxGeometry(stdW, 0.03, stdD);
  const sharedCrateWallLongGeo = new THREE.BoxGeometry(stdW, 0.075, 0.018);
  const sharedCrateWallShortGeo = new THREE.BoxGeometry(0.018, 0.075, stdD - 0.036);
  const sharedCratePostGeo = new THREE.BoxGeometry(0.032, crateH, 0.032);
  const sharedCrateFruitBedGeo = new THREE.BoxGeometry(stdW - 0.06, 0.13, stdD - 0.06);
  const sharedCrateFruitDomeGeo = new THREE.SphereGeometry(0.048, 8, 6);

  const sharedLongBottomGeo = new THREE.BoxGeometry(longW, 0.014, longD);
  const sharedLongWallFGeo = new THREE.BoxGeometry(longW, longH, 0.014);
  const sharedLongWallSGeo = new THREE.BoxGeometry(0.014, longH, longD - 0.024);
  const sharedLongFlapGeo = new THREE.BoxGeometry(longW - 0.012, 0.012, longD / 2 - 0.004);
  const sharedLongTapeGeo = new THREE.BoxGeometry(longW + 0.008, 0.015, 0.056);
  const sharedLongLblGeo = new THREE.PlaneGeometry(0.42, 0.155);
  const sharedLongRailStripGeo = new THREE.BoxGeometry(longW - 0.06, 0.028, 0.018);

  const sharedSlotGuideStdGeo = new THREE.PlaneGeometry(0.52, 0.54);
  const sharedSlotGuideLongGeo = new THREE.PlaneGeometry(1.12, 0.34);

  ctx.disposables.push(
    sharedStdBodyGeo,
    sharedStdInnerGeo,
    sharedStdFlapGeo,
    sharedStdTapeGeo,
    sharedStdLblGeo,
    sharedCrateLblGeo,
    sharedHandleGeo,
    sharedCrateBaseGeo,
    sharedCrateWallLongGeo,
    sharedCrateWallShortGeo,
    sharedCratePostGeo,
    sharedCrateFruitBedGeo,
    sharedCrateFruitDomeGeo,
    sharedLongBottomGeo,
    sharedLongWallFGeo,
    sharedLongWallSGeo,
    sharedLongFlapGeo,
    sharedLongTapeGeo,
    sharedLongLblGeo,
    sharedLongRailStripGeo,
    sharedSlotGuideStdGeo,
    sharedSlotGuideLongGeo
  );

  // Cached shipping label materials per carton defId (sharp EAN-8 barcode + product name + department tag)
  const labelMatCache = new Map<string, THREE.MeshStandardMaterial>();
  const fruitMatCache = new Map<number, THREE.MeshStandardMaterial>();

  const getCategoryBannerColor = (category: OrderableCartonDef['category']): string => {
    switch (category) {
      case 'MATÉRIEL RAYON':
        return '#0369a1';
      case 'POINT CAFÉ & SNACKING CHAUD':
        return '#92400e';
      case 'SNACKING & BOISSONS FRAÎCHES':
        return '#0d9488';
      case 'MANGA, BD & JEUX VIDÉO':
        return '#4338ca';
      case 'CRÉMERIE & FROMAGES':
        return '#0284c7';
      case 'PRIMEUR (FRUITS & LÉGUMES)':
        return '#15803d';
      case 'SURGELÉS & GLACES':
        return '#0369a1';
      case 'ÉPICERIE SALÉE & PÂTES':
        return '#3f6212';
      case 'ÉPICERIE SUCRÉE & SNACKS':
        return '#c2410c';
      case 'CAVE À VINS & BIÈRES':
        return '#581c87';
      case 'BOUCHERIE & CHARCUTERIE':
        return '#7f1d1d';
      case 'BOULANGERIE (POINT CHAUD)':
        return '#78350f';
      case 'HYGIÈNE & ENTRETIEN':
        return '#0f5257';
      case 'ANIMALERIE':
      default:
        return '#1b365d';
    }
  };

  const getShippingLabelMat = (def: OrderableCartonDef): THREE.MeshStandardMaterial => {
    const existing = labelMatCache.get(def.id);
    if (existing) return existing;

    const cv = document.createElement('canvas');
    cv.width = 320;
    cv.height = 192;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fafaf5';
    c.fillRect(0, 0, 320, 192);
    c.strokeStyle = '#334155';
    c.lineWidth = 4;
    c.strokeRect(2, 2, 316, 188);

    // Top department color strip
    c.fillStyle = getCategoryBannerColor(def.category);
    c.fillRect(4, 4, 312, 34);
    c.fillStyle = '#ffffff';
    c.font = '800 15px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`RÉSERVE · ${def.category.slice(0, 22)}`, 12, 21);

    // Exact product name (auto-scaled so nothing clips)
    c.fillStyle = '#0f172a';
    let nameFont = 18;
    const displayName = def.boxLabel;
    c.font = `900 ${nameFont}px "JetBrains Mono", monospace`;
    while (c.measureText(displayName).width > 296 && nameFont > 11) {
      nameFont -= 1;
      c.font = `900 ${nameFont}px "JetBrains Mono", monospace`;
    }
    c.fillText(displayName, 12, 58);

    c.fillStyle = '#475569';
    c.font = '700 13px "JetBrains Mono", monospace';
    const subTag = def.isWoodenCrate
      ? `CAGETTE BOIS ×${def.unitsPerCarton} · ACCÈS DIRECT`
      : def.isLongRailBox
        ? `LOT ×${def.unitsPerCarton} RÉGLETTES 120cm · SCELLÉ`
        : `COLIS ×${def.unitsPerCarton} UNITÉS · OUVRIR AU CUTTER`;
    c.fillText(subTag, 12, 82);

    // Scannable high-contrast EAN-8 barcode
    drawEanBarcode(c, def.primaryEan, 36, 96, 248, 84, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 });
    ctx.disposables.push(tex, mat);
    labelMatCache.set(def.id, mat);
    return mat;
  };

  const getFruitMat = (colorHex: number): THREE.MeshStandardMaterial => {
    const existing = fruitMatCache.get(colorHex);
    if (existing) return existing;
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.48 });
    ctx.disposables.push(mat);
    fruitMatCache.set(colorHex, mat);
    return mat;
  };

  const playCategoryUnboxSound = (def: OrderableCartonDef): void => {
    if (def.isLongRailBox) {
      soundSynth.playPlasticSlide();
    } else if (def.category === 'SNACKING & BOISSONS FRAÎCHES') {
      if (def.primaryEan <= '30141103') {
        soundSynth.playSodaCanClink(true);
      } else {
        soundSynth.playFoilSnackRustle(true);
      }
    } else if (def.category === 'MANGA, BD & JEUX VIDÉO') {
      soundSynth.playGameBoxClack(true);
    } else if (def.category === 'CRÉMERIE & FROMAGES') {
      soundSynth.playDairyChillPlace(true);
    } else if (def.category === 'PRIMEUR (FRUITS & LÉGUMES)') {
      soundSynth.playWoodenCrateRustle(true);
    } else if (def.category === 'SURGELÉS & GLACES') {
      soundSynth.playFrozenPackFrost(true);
    } else if (def.category === 'CAVE À VINS & BIÈRES') {
      soundSynth.playGlassBottleClink(true);
    } else if (def.category === 'ÉPICERIE SALÉE & PÂTES') {
      soundSynth.playTinCanClink(true);
    } else if (def.category === 'ÉPICERIE SUCRÉE & SNACKS') {
      soundSynth.playFoilSnackRustle(true);
    }
  };

  const playCategoryPickSound = (def: OrderableCartonDef, itemKind: string): void => {
    if (itemKind === 'plastic_price_rail') {
      soundSynth.playPlasticRailPickup();
    } else if (def.category === 'POINT CAFÉ & SNACKING CHAUD') {
      if (itemKind === 'cafe_beans_bag') {
        soundSynth.playCoffeeBeansPour();
      } else if (itemKind === 'cafe_cup_sleeve') {
        soundSynth.playPaperGrab();
      } else {
        soundSynth.playHotSnackPlace();
      }
    } else if (def.category === 'SNACKING & BOISSONS FRAÎCHES') {
      if (
        itemKind === 'snacking_can_cola' ||
        itemKind === 'snacking_can_limonade' ||
        itemKind === 'snacking_can_orange'
      ) {
        soundSynth.playSodaCanClink(false);
      } else {
        soundSynth.playFoilSnackRustle(false);
      }
    } else if (def.category === 'MANGA, BD & JEUX VIDÉO') {
      soundSynth.playGameBoxClack(false);
    } else if (def.category === 'CRÉMERIE & FROMAGES') {
      soundSynth.playDairyChillPlace(false);
    } else if (def.category === 'PRIMEUR (FRUITS & LÉGUMES)') {
      soundSynth.playWoodenCrateRustle(false);
    } else if (def.category === 'SURGELÉS & GLACES') {
      soundSynth.playFrozenPackFrost(false);
    } else if (
      def.category === 'CAVE À VINS & BIÈRES' ||
      itemKind === 'snack_pate_tartiner' ||
      itemKind === 'savory_huile_olive' ||
      itemKind === 'savory_sauce_tomate_pav' ||
      itemKind === 'savory_moutarde_pav'
    ) {
      soundSynth.playGlassBottleClink(false);
    } else if (itemKind === 'savory_cassoulet' || itemKind === 'savory_petits_pois_pav') {
      soundSynth.playTinCanClink(false);
    } else if (
      def.category === 'ÉPICERIE SUCRÉE & SNACKS' ||
      itemKind === 'savory_coquillettes' ||
      itemKind === 'savory_spaghetti'
    ) {
      soundSynth.playFoilSnackRustle(false);
    } else {
      soundSynth.playBagThump();
    }
  };

  interface StoredBoxVisual {
    def: OrderableCartonDef;
    opened: boolean;
    remaining: number;
    pickIdx: number;
    openAnim: number;
    dropAnim: number;
    meshGroup: THREE.Group;
    flapA: THREE.Group | null;
    flapB: THREE.Group | null;
    flapAxis: 'z' | 'x';
    tapeMesh: THREE.Mesh | null;
    railMeshes: THREE.Mesh[];
    contentsGroup: THREE.Group | null;
  }

  interface WarehouseStorageSlot {
    id: string;
    bayLabel: string;
    isDeliveryPallet: boolean;
    preferLongBox: boolean;
    slotGroup: THREE.Group;
    guidePad: THREE.Mesh;
    box: StoredBoxVisual | null;
    placeBox: (
      def: OrderableCartonDef,
      opts?: { opened?: boolean; remaining?: number; pickIdx?: number; animateDrop?: boolean }
    ) => void;
    clearBox: () => void;
  }

  const allStorageSlots: WarehouseStorageSlot[] = [];
  let warehouseBoxActionLock = 0;

  const isHoldingCarryableBox = (): boolean => {
    if (tools.getActiveTool() !== 'hands') return false;
    const h = tools.getHeldItem();
    return h?.kind === 'shipping_carton' || h?.kind === 'empty_carton';
  };

  const buildBoxVisual = (
    def: OrderableCartonDef,
    openedInit: boolean,
    remainingInit: number
  ): StoredBoxVisual => {
    const grp = new THREE.Group();
    const lblMat = getShippingLabelMat(def);
    const railMeshes: THREE.Mesh[] = [];
    let flapA: THREE.Group | null = null;
    let flapB: THREE.Group | null = null;
    let flapAxis: 'z' | 'x' = 'z';
    let tapeMesh: THREE.Mesh | null = null;
    let contentsGroup: THREE.Group | null = null;

    if (def.isLongRailBox) {
      // Detailed 1.08m long corrugated shipping box for 10 transparent PVC price rails (EAN 30140001)
      const bot = new THREE.Mesh(sharedLongBottomGeo, mats.cardboard);
      bot.position.y = 0.007;
      bot.castShadow = true;
      bot.receiveShadow = true;
      const wallF = new THREE.Mesh(sharedLongWallFGeo, mats.cardboard);
      wallF.position.set(0, longH / 2, longD / 2 - 0.007);
      wallF.castShadow = true;
      const wallB = new THREE.Mesh(sharedLongWallFGeo, mats.cardboard);
      wallB.position.set(0, longH / 2, -longD / 2 + 0.007);
      const wallL = new THREE.Mesh(sharedLongWallSGeo, mats.cardboard);
      wallL.position.set(-longW / 2 + 0.007, longH / 2, 0);
      const wallR = new THREE.Mesh(sharedLongWallSGeo, mats.cardboard);
      wallR.position.set(longW / 2 - 0.007, longH / 2, 0);
      grp.add(bot, wallF, wallB, wallL, wallR);

      // Visible stacked PVC price rails inside the long box (up to 10 strips, 2 rows x 5 cols)
      for (let i = 0; i < 10; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const strip = new THREE.Mesh(
          sharedLongRailStripGeo,
          i % 2 === 0 ? railPvcClearMat : railPvcBackMat
        );
        strip.position.set(0, 0.042 + row * 0.052, -0.095 + col * 0.047);
        strip.visible = i < remainingInit;
        grp.add(strip);
        railMeshes.push(strip);
      }

      // Crisp scannable shipping labels on BOTH long faces (+Z front & -Z back)
      const lblF = new THREE.Mesh(sharedLongLblGeo, lblMat);
      lblF.position.set(0, longH * 0.52, longD / 2 + 0.003);
      const lblB = new THREE.Mesh(sharedLongLblGeo, lblMat);
      lblB.position.set(0, longH * 0.52, -longD / 2 - 0.003);
      lblB.rotation.y = Math.PI;
      grp.add(lblF, lblB);

      // Front/back hinged top flaps opening outward around X axis
      flapAxis = 'x';
      flapA = new THREE.Group();
      flapA.position.set(0, longH, -longD / 2);
      const flapAMesh = new THREE.Mesh(sharedLongFlapGeo, mats.cardboard);
      flapAMesh.position.set(0, 0.006, longD / 4);
      flapA.add(flapAMesh);

      flapB = new THREE.Group();
      flapB.position.set(0, longH, longD / 2);
      const flapBMesh = new THREE.Mesh(sharedLongFlapGeo, mats.cardboard);
      flapBMesh.position.set(0, 0.006, -longD / 4);
      flapB.add(flapBMesh);

      tapeMesh = new THREE.Mesh(sharedLongTapeGeo, tapeMat);
      tapeMesh.position.set(0, longH + 0.008, 0);
      tapeMesh.visible = !openedInit;
      if (openedInit) {
        flapA.rotation.x = -2.0;
        flapB.rotation.x = 2.0;
      }
      grp.add(flapA, flapB, tapeMesh);
    } else if (def.isWoodenCrate) {
      // Open-top slatted wooden produce crate ("Cagette Primeur")
      const crateBase = new THREE.Mesh(sharedCrateBaseGeo, mats.oakWood);
      crateBase.position.y = 0.015;
      crateBase.castShadow = true;
      crateBase.receiveShadow = true;
      grp.add(crateBase);

      [0.068, 0.175].forEach((sy) => {
        const sN = new THREE.Mesh(sharedCrateWallLongGeo, mats.oakWood);
        sN.position.set(0, sy, -stdD / 2 + 0.009);
        const sS = new THREE.Mesh(sharedCrateWallLongGeo, mats.oakWood);
        sS.position.set(0, sy, stdD / 2 - 0.009);
        const sL = new THREE.Mesh(sharedCrateWallShortGeo, mats.oakWood);
        sL.position.set(-stdW / 2 + 0.009, sy, 0);
        const sR = new THREE.Mesh(sharedCrateWallShortGeo, mats.oakWood);
        sR.position.set(stdW / 2 - 0.009, sy, 0);
        grp.add(sN, sS, sL, sR);
      });
      [
        [-stdW / 2 + 0.018, -stdD / 2 + 0.018],
        [stdW / 2 - 0.018, -stdD / 2 + 0.018],
        [-stdW / 2 + 0.018, stdD / 2 - 0.018],
        [stdW / 2 - 0.018, stdD / 2 - 0.018],
      ].forEach(([px, pz]) => {
        const post = new THREE.Mesh(sharedCratePostGeo, mats.rusticWood);
        post.position.set(px, crateH / 2, pz);
        grp.add(post);
      });

      contentsGroup = new THREE.Group();
      const fruitMat = getFruitMat(def.crateFruitColor ?? 0x84cc16);
      const fruitBed = new THREE.Mesh(sharedCrateFruitBedGeo, fruitMat);
      fruitBed.position.y = 0.11;
      contentsGroup.add(fruitBed);
      for (let fx = -0.14; fx <= 0.15; fx += 0.14) {
        for (let fz = -0.15; fz <= 0.16; fz += 0.15) {
          const fm = new THREE.Mesh(sharedCrateFruitDomeGeo, fruitMat);
          fm.position.set(fx, 0.19, fz);
          contentsGroup.add(fm);
        }
      }
      contentsGroup.visible = remainingInit > 0;
      grp.add(contentsGroup);

      const lblF = new THREE.Mesh(sharedCrateLblGeo, lblMat);
      lblF.position.set(0, crateH * 0.52, stdD / 2 + 0.004);
      const lblB = new THREE.Mesh(sharedCrateLblGeo, lblMat);
      lblB.position.set(0, crateH * 0.52, -stdD / 2 - 0.004);
      lblB.rotation.y = Math.PI;
      grp.add(lblF, lblB);
    } else {
      // Standard corrugated shipping carton with hinged animated top flaps & front/back EAN shipping labels
      const body = new THREE.Mesh(sharedStdBodyGeo, mats.cardboard);
      body.position.y = stdH / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      grp.add(body);

      const innerTop = new THREE.Mesh(sharedStdInnerGeo, innerDarkCbMat);
      innerTop.position.y = stdH + 0.001;
      grp.add(innerTop);

      const lblF = new THREE.Mesh(sharedStdLblGeo, lblMat);
      lblF.position.set(0, stdH * 0.54, stdD / 2 + 0.004);
      const lblB = new THREE.Mesh(sharedStdLblGeo, lblMat);
      lblB.position.set(0, stdH * 0.54, -stdD / 2 - 0.004);
      lblB.rotation.y = Math.PI;
      grp.add(lblF, lblB);

      // Subtle front carry grip notch below label
      const grip = new THREE.Mesh(sharedHandleGeo, handleAccentMat);
      grip.position.set(0, 0.065, stdD / 2 + 0.004);
      grp.add(grip);

      flapAxis = 'z';
      flapA = new THREE.Group();
      flapA.position.set(-stdW / 2, stdH, 0);
      const flapAMesh = new THREE.Mesh(sharedStdFlapGeo, mats.cardboard);
      flapAMesh.position.set(stdW / 4, 0.006, 0);
      flapA.add(flapAMesh);

      flapB = new THREE.Group();
      flapB.position.set(stdW / 2, stdH, 0);
      const flapBMesh = new THREE.Mesh(sharedStdFlapGeo, mats.cardboard);
      flapBMesh.position.set(-stdW / 4, 0.006, 0);
      flapB.add(flapBMesh);

      tapeMesh = new THREE.Mesh(sharedStdTapeGeo, tapeMat);
      tapeMesh.position.set(0, stdH + 0.008, 0);
      tapeMesh.visible = !openedInit;
      if (openedInit) {
        flapA.rotation.z = 2.05;
        flapB.rotation.z = -2.05;
      }
      grp.add(flapA, flapB, tapeMesh);
    }

    return {
      def,
      opened: openedInit,
      remaining: remainingInit,
      pickIdx: 0,
      openAnim: openedInit ? 1 : 0,
      dropAnim: 0,
      meshGroup: grp,
      flapA,
      flapB,
      flapAxis,
      tapeMesh,
      railMeshes,
      contentsGroup,
    };
  };

  const createStorageSlot = (
    parent: THREE.Object3D,
    opts: {
      id: string;
      bayLabel: string;
      pos: [number, number, number];
      rotY?: number;
      isDeliveryPallet?: boolean;
      preferLongBox?: boolean;
    }
  ): WarehouseStorageSlot => {
    const slotGroup = new THREE.Group();
    slotGroup.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    slotGroup.rotation.y = opts.rotY ?? 0;
    parent.add(slotGroup);

    const preferLong = Boolean(opts.preferLongBox);
    const guidePad = new THREE.Mesh(
      preferLong ? sharedSlotGuideLongGeo : sharedSlotGuideStdGeo,
      slotGuideMat
    );
    guidePad.rotation.x = -Math.PI / 2;
    guidePad.position.y = 0.008;
    guidePad.visible = false;
    slotGroup.add(guidePad);

    // Hitbox 1: Empty slot placement zone (visible ONLY when empty & carrying shipping_carton / empty_carton)
    const emptyHitGeo = new THREE.BoxGeometry(
      preferLong ? 1.1 : 0.54,
      0.34,
      preferLong ? 0.36 : 0.54
    );
    ctx.disposables.push(emptyHitGeo);
    const emptyHitMesh = new THREE.Mesh(emptyHitGeo, proxyHiddenMat);
    emptyHitMesh.position.y = 0.17;
    emptyHitMesh.layers.set(INTERACT_LAYER);
    slotGroup.add(emptyHitMesh);

    // Hitbox 2: Occupied box main body (Open with Cutter / Grab Closed Box / Take 1 Item / Grab Empty Box / Scan EAN)
    const boxHitGeo = new THREE.BoxGeometry(
      preferLong ? 1.12 : 0.54,
      0.38,
      preferLong ? 0.36 : 0.54
    );
    ctx.disposables.push(boxHitGeo);
    const boxHitMesh = new THREE.Mesh(boxHitGeo, proxyHiddenMat);
    boxHitMesh.position.y = 0.19;
    boxHitMesh.layers.set(INTERACT_LAYER);
    slotGroup.add(boxHitMesh);

    // Hitbox 3: Dedicated lower-front carry handle strip on opened non-empty boxes so player can relocate opened boxes too!
    const carryHitGeo = new THREE.BoxGeometry(preferLong ? 0.52 : 0.36, 0.1, 0.08);
    ctx.disposables.push(carryHitGeo);
    const carryHitMesh = new THREE.Mesh(carryHitGeo, proxyHiddenMat);
    carryHitMesh.position.set(0, 0.06, preferLong ? longD / 2 + 0.03 : stdD / 2 + 0.03);
    carryHitMesh.layers.set(INTERACT_LAYER);
    slotGroup.add(carryHitMesh);

    const slot: WarehouseStorageSlot = {
      id: opts.id,
      bayLabel: opts.bayLabel,
      isDeliveryPallet: Boolean(opts.isDeliveryPallet),
      preferLongBox: preferLong,
      slotGroup,
      guidePad,
      box: null,
      clearBox: () => {
        if (slot.box) {
          slotGroup.remove(slot.box.meshGroup);
          slot.box = null;
        }
      },
      placeBox: (def, boxOpts) => {
        slot.clearBox();
        const openedInit = boxOpts?.opened ?? Boolean(def.isWoodenCrate);
        const remainingInit = boxOpts?.remaining ?? def.unitsPerCarton;
        const vis = buildBoxVisual(def, openedInit, remainingInit);
        vis.pickIdx = boxOpts?.pickIdx ?? 0;
        vis.dropAnim = boxOpts?.animateDrop ? 1.0 : 0;
        if (vis.dropAnim > 0) {
          vis.meshGroup.position.y = 0.16;
        }
        slotGroup.add(vis.meshGroup);
        slot.box = vis;

        // Resize & orient box cleanly so long rail boxes placed on narrower bays run front-to-back without clipping rack uprights
        const rotateLongInNarrow = Boolean(def.isLongRailBox && !preferLong);
        vis.meshGroup.rotation.y = rotateLongInNarrow ? Math.PI / 2 : 0;
        const wScale = rotateLongInNarrow
          ? 0.62
          : def.isLongRailBox
            ? 1.0
            : preferLong
              ? 0.52
              : 1.0;
        const hScale = def.isLongRailBox ? 0.62 : def.isWoodenCrate ? 0.72 : 1.0;
        const dScale = rotateLongInNarrow ? 1.85 : 1.0;
        boxHitMesh.scale.set(wScale, hScale, dScale);
        boxHitMesh.position.y = 0.19 * hScale;
        carryHitMesh.position.z = (rotateLongInNarrow ? longW : def.isLongRailBox ? longD : stdD) / 2 + 0.03;
      },
    };

    const pickUpWholeBoxFromSlot = (b: StoredBoxVisual) => {
      const isEmpty = b.remaining <= 0;
      const boxKind = isEmpty ? 'empty_carton' : 'shipping_carton';
      const statusTxt = isEmpty
        ? 'Carton vide · À jeter dans la Presse à Carton ou ranger'
        : b.opened
          ? `Carton ouvert (${b.remaining}/${b.def.unitsPerCarton}) · Poser sur rack réserve`
          : `Carton scellé (×${b.remaining}) · Poser sur rack réserve`;
      tools.pickUpItem({
        kind: boxKind,
        label: isEmpty ? `Carton Vide (${b.def.boxLabel.slice(0, 18)})` : b.def.boxLabel,
        sublabel: statusTxt,
        ean: b.def.primaryEan,
        cartonData: {
          defId: b.def.id,
          opened: b.opened,
          remaining: b.remaining,
          pickIdx: b.pickIdx,
        },
      });
      slot.clearBox();
      soundSynth.playBagThump();
    };

    // Interactable 1: Empty Slot ("RANGER LE CARTON EN RÉSERVE")
    const emptyInteract: InteractableItem = {
      id: `${opts.id}_empty_slot`,
      title: opts.bayLabel,
      subtitle: 'Emplacement palette disponible',
      kind: 'diegetic_action',
      state: false,
      inspectText: `Emplacement de stockage libre sur ${opts.bayLabel}.`,
      proxyMesh: emptyHitMesh,
      isVisible: () => !slot.box && isHoldingCarryableBox(),
      dynamicVerb: () =>
        opts.isDeliveryPallet ? 'POSER LE CARTON SUR LA PALETTE' : 'RANGER LE CARTON EN RÉSERVE',
      dynamicSubtitle: () => {
        const held = tools.getHeldItem();
        return held ? `Déposer : ${held.label}` : opts.bayLabel;
      },
      onInteract: () => {
        const now = performance.now();
        if (now - warehouseBoxActionLock < 320) return;
        warehouseBoxActionLock = now;

        const held = tools.getHeldItem();
        if (
          slot.box ||
          tools.getActiveTool() !== 'hands' ||
          !held ||
          (held.kind !== 'shipping_carton' && held.kind !== 'empty_carton')
        ) {
          return;
        }
        const def =
          ORDER_CATALOG.find((d) => d.id === held.cartonData?.defId) ?? ORDER_CATALOG[0];
        const consumed = tools.consumeHeldItem();
        if (!consumed) return;
        slot.placeBox(def, {
          opened: held.cartonData?.opened ?? held.kind === 'empty_carton',
          remaining: held.cartonData?.remaining ?? (held.kind === 'empty_carton' ? 0 : def.unitsPerCarton),
          pickIdx: held.cartonData?.pickIdx ?? 0,
          animateDrop: true,
        });
        soundSynth.playBagThump();
      },
    };
    emptyHitMesh.userData.interactable = emptyInteract;
    ctx.interactables.push(emptyInteract);

    // Interactable 2: Occupied Shipping Box Main Body
    const boxInteract: InteractableItem = {
      id: `${opts.id}_box_body`,
      title: opts.bayLabel,
      subtitle: 'Carton logistique réserve',
      kind: 'diegetic_action',
      state: false,
      inspectText: 'Carton logistique étiqueté avec code-barres EAN scannable.',
      proxyMesh: boxHitMesh,
      isVisible: () => slot.box !== null,
      dynamicTitle: () => (slot.box ? slot.box.def.boxLabel : opts.bayLabel),
      dynamicProductEan: () => {
        if (!slot.box) return null;
        const b = slot.box;
        if (b.def.isLongRailBox) return b.def.primaryEan;
        return b.def.cycleItems[b.pickIdx % b.def.cycleItems.length].ean ?? b.def.primaryEan;
      },
      dynamicSubtitle: () => {
        const b = slot.box;
        if (!b) return opts.bayLabel;
        if (!b.opened) {
          return `EAN ${b.def.primaryEan} · Scellé (${b.remaining} u.) · Cutter : ouvrir · Mains : porter`;
        }
        if (b.remaining <= 0) {
          return 'Carton vide · Prendre pour jeter dans la Presse à Carton';
        }
        const next = b.def.cycleItems[b.pickIdx % b.def.cycleItems.length];
        return `Reste ${b.remaining}/${b.def.unitsPerCarton} · ${next.label} (${opts.bayLabel})`;
      },
      dynamicVerb: () => {
        const b = slot.box;
        if (!b) return 'INSPECTER';
        const activeTool = tools.getActiveTool();
        const held = tools.getHeldItem();
        if (!b.opened) {
          if (activeTool === 'cutter') return 'OUVRIR LE CARTON AU CUTTER';
          if (activeTool === 'hands' && !held) return 'PRENDRE LE CARTON';
          return 'SCELLÉ (CUTTER POUR OUVRIR · MAINS VIDES POUR PORTER)';
        }
        if (b.remaining <= 0) {
          if (activeTool === 'hands' && !held) return 'PRENDRE LE CARTON VIDE';
          return 'CARTON VIDE (MAINS VIDES POUR PRENDRE)';
        }
        if (activeTool !== 'hands' || held) {
          return activeTool !== 'hands'
            ? 'ÉQUIPER LES MAINS POUR PRENDRE'
            : 'MAINS OCCUPÉES (POSER L’ARTICLE D’ABORD)';
        }
        const next = b.def.cycleItems[b.pickIdx % b.def.cycleItems.length];
        return `PRENDRE (${b.remaining}/${b.def.unitsPerCarton}) : ${next.label.slice(0, 18).toUpperCase()}`;
      },
      onInteract: () => {
        const now = performance.now();
        if (now - warehouseBoxActionLock < 320) return;
        warehouseBoxActionLock = now;

        const b = slot.box;
        if (!b) return;
        const activeTool = tools.getActiveTool();
        const held = tools.getHeldItem();

        if (!b.opened) {
          if (activeTool === 'cutter') {
            b.opened = true;
            if (b.tapeMesh) b.tapeMesh.visible = false;
            tools.triggerCutterSlash();
            playCategoryUnboxSound(b.def);
            return;
          }
          if (activeTool === 'hands' && !held) {
            pickUpWholeBoxFromSlot(b);
            return;
          }
          soundSynth.playAtmPiezo('error');
          return;
        }

        if (b.remaining <= 0) {
          if (activeTool === 'hands' && !held) {
            pickUpWholeBoxFromSlot(b);
          } else {
            soundSynth.playAtmPiezo('error');
          }
          return;
        }

        if (activeTool !== 'hands' || held) {
          soundSynth.playAtmPiezo('error');
          return;
        }

        // Take 1 individual unit out of opened shipping box
        const item = b.def.cycleItems[b.pickIdx % b.def.cycleItems.length];
        b.pickIdx += 1;
        b.remaining -= 1;
        if (b.def.isLongRailBox && b.remaining >= 0 && b.remaining < b.railMeshes.length) {
          b.railMeshes[b.remaining].visible = false;
        }
        if (b.contentsGroup && b.remaining <= 0) {
          b.contentsGroup.visible = false;
        }
        tools.pickUpItem(item);
        playCategoryPickSound(b.def, item.kind);
      },
    };
    boxHitMesh.userData.interactable = boxInteract;
    ctx.interactables.push(boxInteract);

    // Interactable 3: Lower-front grab handle to relocate an already-opened non-empty carton!
    const carryInteract: InteractableItem = {
      id: `${opts.id}_box_carry_handle`,
      title: opts.bayLabel,
      subtitle: 'Poignée carton ouvert',
      kind: 'diegetic_action',
      state: false,
      inspectText: 'Saisissez la base du carton pour le déplacer entre le quai et les racks.',
      proxyMesh: carryHitMesh,
      isVisible: () =>
        slot.box !== null &&
        slot.box.opened &&
        slot.box.remaining > 0 &&
        tools.getActiveTool() === 'hands' &&
        tools.getHeldItem() === null,
      dynamicTitle: () => (slot.box ? slot.box.def.boxLabel : opts.bayLabel),
      dynamicSubtitle: () =>
        slot.box
          ? `Déplacer le carton (${slot.box.remaining}/${slot.box.def.unitsPerCarton} restants)`
          : opts.bayLabel,
      dynamicVerb: () => 'PRENDRE LE CARTON',
      onInteract: () => {
        const now = performance.now();
        if (now - warehouseBoxActionLock < 320) return;
        warehouseBoxActionLock = now;
        if (!slot.box || tools.getActiveTool() !== 'hands' || tools.getHeldItem() !== null) return;
        pickUpWholeBoxFromSlot(slot.box);
      },
    };
    carryHitMesh.userData.interactable = carryInteract;
    ctx.interactables.push(carryInteract);

    allStorageSlots.push(slot);
    return slot;
  };

  // Animate box drops, flap opening & glowing empty-slot guide pads when carrying a box
  ctx.updaters.push({
    update: (dt) => {
      const showGuides = isHoldingCarryableBox();
      for (let i = 0; i < allStorageSlots.length; i++) {
        const s = allStorageSlots[i];
        s.guidePad.visible = showGuides && s.box === null;
        const b = s.box;
        if (!b) continue;
        if (b.dropAnim > 0) {
          b.dropAnim = Math.max(0, b.dropAnim - dt * 6);
          b.meshGroup.position.y = b.dropAnim * 0.16;
        } else if (b.meshGroup.position.y !== 0) {
          b.meshGroup.position.y = 0;
        }
        const targetOpen = b.opened ? 1 : 0;
        if (b.flapA && b.flapB && Math.abs(b.openAnim - targetOpen) > 0.005) {
          b.openAnim = THREE.MathUtils.damp(b.openAnim, targetOpen, 10, dt);
          if (b.flapAxis === 'x') {
            b.flapA.rotation.x = -b.openAnim * 2.0;
            b.flapB.rotation.x = b.openAnim * 2.0;
          } else {
            b.flapA.rotation.z = b.openAnim * 2.05;
            b.flapB.rotation.z = -b.openAnim * 2.05;
          }
        }
      }
    },
  });

  // --- 5 Labeled, Department-Organized Industrial Pallet Rack Bays (TRAVÉES A à E) ---
  const findCatalogDef = (id: string): OrderableCartonDef | undefined =>
    ORDER_CATALOG.find((d) => d.id === id);

  interface RackBayConfig {
    id: string;
    x: number;
    z: number;
    width: number;
    facingRotY: number; // 0 = faces +Z (South into aisle), Math.PI = faces -Z (North into aisle)
    signTitle: string;
    signSub: string;
    signBg: string;
    signAccent: string;
    bayShortLabel: string;
    colXs: number[];
    preferLongBox?: boolean;
    starterDefs: Array<{ tier: 0 | 1; col: number; defId: string }>;
  }

  const buildOrganizedPalletBay = (cfg: RackBayConfig) => {
    const rack = new THREE.Group();
    rack.position.set(cfg.x, 0, cfg.z);
    rack.rotation.y = cfg.facingRotY;
    root.add(rack);

    const depth = 1.1;
    const rackH = 3.55;

    // Blue steel uprights & cross-braces
    const postGeo = new THREE.BoxGeometry(0.085, rackH, 0.085);
    const braceGeo = new THREE.BoxGeometry(0.045, 0.045, depth);
    const beamGeo = new THREE.BoxGeometry(cfg.width, 0.1, 0.065);
    const palletDeckGeo = new THREE.BoxGeometry(cfg.width - 0.16, 0.12, 0.96);
    ctx.disposables.push(postGeo, braceGeo, beamGeo, palletDeckGeo);

    const postXs = cfg.width > 3.6 ? [-cfg.width / 2, 0, cfg.width / 2] : [-cfg.width / 2, cfg.width / 2];
    postXs.forEach((ux) => {
      [-depth / 2, depth / 2].forEach((uz) => {
        const p = new THREE.Mesh(postGeo, mats.rackBlue);
        p.position.set(ux, rackH / 2, uz);
        p.castShadow = true;
        rack.add(p);
      });
      [0.6, 1.8, 3.0].forEach((by) => {
        const b = new THREE.Mesh(braceGeo, mats.rackBlue);
        b.position.set(ux, by, 0);
        rack.add(b);
      });
    });

    // Bright Safety-Orange Horizontal Load Beams (Level 1 at Y = 1.24m, Level 2 at Y = 2.46m)
    [1.24, 2.46].forEach((ly) => {
      [-depth / 2, depth / 2].forEach((lz) => {
        const beam = new THREE.Mesh(beamGeo, mats.rackOrange);
        beam.position.set(0, ly, lz);
        rack.add(beam);
      });
    });

    // Wooden Euro-Pallet Decking on Level 0 (Y = 0.06), Level 1 (Y = 1.32), and top Reserve Level 2 (Y = 2.54)
    [0.06, 1.32, 2.54].forEach((py) => {
      const deck = new THREE.Mesh(palletDeckGeo, mats.rusticWood);
      deck.position.set(0, py, 0);
      deck.receiveShadow = true;
      rack.add(deck);
    });

    // Crisp Auto-Fitted Overhead Bay Header Board mounted cleanly at Level 2 front face (+Z in local rack space)
    const baySignTex = texBank.createDepartmentSignTexture(
      cfg.signTitle,
      cfg.signSub,
      cfg.signBg,
      cfg.signAccent
    );
    const baySignMat = new THREE.MeshStandardMaterial({ map: baySignTex, roughness: 0.36 });
    const signW = Math.min(cfg.width - 0.14, 3.85);
    const baySign = new THREE.Mesh(new THREE.BoxGeometry(signW, 0.36, 0.05), baySignMat);
    baySign.position.set(0, 2.84, depth / 2 + 0.04);
    rack.add(baySign);
    ctx.disposables.push(baySignMat, baySign.geometry);

    // Interactive Storage Slots on Level 0 (Y = 0.12) & Level 1 (Y = 1.38) — effortlessly reachable!
    const tierYs: [number, number] = [0.12, 1.38];
    const slotZ = cfg.preferLongBox ? 0.22 : 0.2;
    const createdSlots: WarehouseStorageSlot[][] = [[], []];

    tierYs.forEach((ty, tierIdx) => {
      cfg.colXs.forEach((cx, colIdx) => {
        const s = createStorageSlot(rack, {
          id: `${cfg.id}_t${tierIdx}_c${colIdx}`,
          bayLabel: `${cfg.bayShortLabel} · Niv.${tierIdx + 1}`,
          pos: [cx, ty, slotZ],
          rotY: 0,
          isDeliveryPallet: false,
          preferLongBox: cfg.preferLongBox,
        });
        createdSlots[tierIdx].push(s);
      });
    });

    // Populate initial minimum reserve stock cleanly on this bay
    cfg.starterDefs.forEach((st) => {
      const def = findCatalogDef(st.defId);
      const targetSlot = createdSlots[st.tier]?.[st.col];
      if (def && targetSlot) {
        targetSlot.placeBox(def, { animateDrop: false });
      }
    });

    // Collider sized tightly around the steel frame so player can stand right up to the front edge
    addBoxCollider(
      ctx,
      `${cfg.id}_col`,
      cfg.x - cfg.width / 2 - 0.05,
      cfg.x + cfg.width / 2 + 0.05,
      cfg.z - depth / 2 - 0.05,
      cfg.z + depth / 2 + 0.05
    );
  };

  // TRAVÉE A — MATÉRIEL & RÉGLETTES PLASTIQUES (2 Starter Boxes of Plastic Price-Rail Strips EAN 30140001 at eye level + 2 open slots)
  buildOrganizedPalletBay({
    id: 'travee_a',
    x: -8.1,
    z: -11.9,
    width: 2.6,
    facingRotY: 0,
    signTitle: 'TRAVÉE A — MATÉRIEL & RÉGLETTES PLASTIQUES',
    signSub: 'BARRES PORTE-ÉTIQUETTES PVC 120cm · LOT ×10',
    signBg: '#0c4a6e',
    signAccent: '#38bdf8',
    bayShortLabel: 'Travée A (Matériel)',
    colXs: [-0.62, 0.62],
    preferLongBox: true,
    starterDefs: [
      { tier: 1, col: 0, defId: 'carton_price_rails' },
      { tier: 1, col: 1, defId: 'carton_price_rails' },
    ],
  });

  // TRAVÉE B — FRAIS, CRÉMERIE, BOUCHERIE & BOULANGERIE (4 Starter Boxes + 2 open slots)
  buildOrganizedPalletBay({
    id: 'travee_b',
    x: -5.45,
    z: -11.9,
    width: 2.6,
    facingRotY: 0,
    signTitle: 'TRAVÉE B — FRAIS, CRÉMERIE, BOUCHERIE & BOULANGERIE',
    signSub: 'LAIT · JAMBON · BAGUETTES · POINT CAFÉ',
    signBg: '#7f1d1d',
    signAccent: '#f97316',
    bayShortLabel: 'Travée B (Frais)',
    colXs: [-0.82, 0.0, 0.82],
    starterDefs: [
      { tier: 1, col: 0, defId: 'carton_lait_frais_entier' },
      { tier: 1, col: 1, defId: 'carton_ham_block' },
      { tier: 1, col: 2, defId: 'carton_baguette_raw' },
      { tier: 0, col: 0, defId: 'carton_croque_monsieur' },
    ],
  });

  // TRAVÉE C — ÉPICERIE SALÉE, SUCRÉE & SNACKING (3 Starter Boxes at eye level + 5 open slots)
  buildOrganizedPalletBay({
    id: 'travee_c',
    x: -6.8,
    z: -8.1,
    width: 4.6,
    facingRotY: Math.PI,
    signTitle: 'TRAVÉE C — ÉPICERIE SALÉE, SUCRÉE & SNACKING',
    signSub: 'PÂTES COQUILLETTES · CHIPS NATURE · CANETTE COLA 33CL',
    signBg: '#78350f',
    signAccent: '#f59e0b',
    bayShortLabel: 'Travée C (Épicerie)',
    colXs: [-1.62, -0.54, 0.54, 1.62],
    starterDefs: [
      { tier: 1, col: 0, defId: 'carton_coquillettes' },
      { tier: 1, col: 1, defId: 'carton_chips_nature' },
      { tier: 1, col: 2, defId: 'carton_canette_cola_33cl' },
    ],
  });

  // TRAVÉE D — CAVE À VINS, BIÈRES, HYGIÈNE & ANIMALERIE (3 Starter Boxes at eye level + 3 open slots)
  buildOrganizedPalletBay({
    id: 'travee_d',
    x: 3.65,
    z: -11.9,
    width: 3.05,
    facingRotY: 0,
    signTitle: 'TRAVÉE D — CAVE À VINS, BIÈRES, HYGIÈNE & ANIMALERIE',
    signSub: 'BORDEAUX 1988 · LESSIVE 3L · CROQUETTES CHIEN 3KG',
    signBg: '#3b0764',
    signAccent: '#c084fc',
    bayShortLabel: 'Travée D (Cave/Hyg.)',
    colXs: [-0.96, 0.0, 0.96],
    starterDefs: [
      { tier: 1, col: 0, defId: 'carton_wine_bordeaux' },
      { tier: 1, col: 1, defId: 'carton_lessive_3l' },
      { tier: 1, col: 2, defId: 'carton_croq_3kg' },
    ],
  });

  // TRAVÉE E — PRIMEUR & SURGELÉS (2 Starter Boxes at eye level + 4 open slots)
  buildOrganizedPalletBay({
    id: 'travee_e',
    x: 6.78,
    z: -11.9,
    width: 3.05,
    facingRotY: 0,
    signTitle: 'TRAVÉE E — PRIMEUR & SURGELÉS',
    signSub: 'POMMES GOLDEN · FRITES ALLUMETTES SURGELÉES',
    signBg: '#14532d',
    signAccent: '#4ade80',
    bayShortLabel: 'Travée E (Primeur/Surg.)',
    colXs: [-0.96, 0.0, 0.96],
    starterDefs: [
      { tier: 1, col: 0, defId: 'cagette_pommes_golden' },
      { tier: 1, col: 1, defId: 'carton_frozen_frites' },
    ],
  });

  // --- Yellow Manual Hydraulic Pallet Jack ("Transpalette Manuel") at X = -3.8, Z = -9.9 ---
  {
    const jack = new THREE.Group();
    jack.position.set(-3.75, 0, -9.9);
    jack.rotation.y = 0.35;
    root.add(jack);

    // Twin yellow steel forks
    const forkGeo = new THREE.BoxGeometry(0.16, 0.055, 1.15);
    const forkL = new THREE.Mesh(forkGeo, mats.palletYellow);
    forkL.position.set(-0.19, 0.085, 0.35);
    const forkR = new THREE.Mesh(forkGeo, mats.palletYellow);
    forkR.position.set(0.19, 0.085, 0.35);

    // Fork bridge + hydraulic pump column + steer wheels + front tandem rollers
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.22), mats.palletYellow);
    bridge.position.set(0, 0.2, -0.26);
    const pumpCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.34, 12), mats.anthracite);
    pumpCyl.position.set(0, 0.34, -0.38);
    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 10), mats.chrome);
    pistonRod.position.set(0, 0.54, -0.38);

    // Angled T-handle drawbar ("Timon")
    const drawbar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.78, 8), mats.anthracite);
    drawbar.position.set(0, 0.86, -0.48);
    drawbar.rotation.x = -0.24;
    const tGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 8), mats.rubberBlack);
    tGrip.rotation.z = Math.PI / 2;
    tGrip.position.set(0, 1.22, -0.57);

    const steerWheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12);
    const swL = new THREE.Mesh(steerWheelGeo, mats.rubberBlack);
    swL.rotation.z = Math.PI / 2;
    swL.position.set(-0.11, 0.09, -0.42);
    const swR = new THREE.Mesh(steerWheelGeo, mats.rubberBlack);
    swR.rotation.z = Math.PI / 2;
    swR.position.set(0.11, 0.09, -0.42);

    ctx.disposables.push(
      forkGeo,
      bridge.geometry,
      pumpCyl.geometry,
      pistonRod.geometry,
      drawbar.geometry,
      tGrip.geometry,
      steerWheelGeo
    );
    jack.add(forkL, forkR, bridge, pumpCyl, pistonRod, drawbar, tGrip, swL, swR);

    addBoxCollider(ctx, 'pallet_jack_col', -4.25, -3.25, -10.55, -9.15);
    registerInteractableBox(ctx, jack, {
      id: 'inspect_pallet_jack',
      title: 'Transpalette Hydraulique Manuel 2,5 T',
      subtitle: 'Fourches Acier 1150 mm · Pompe Hydraulique & Timon',
      kind: 'inspect',
      inspectText:
        'Transpalette manuel jaune de manutention équipé de galets tandem polyuréthane, corps de pompe hydraulique étanche et poignée de commande 3 positions.',
      specs: 'Capacité 2 500 kg · Largeur fourches 540 mm',
      size: [0.75, 1.3, 1.65],
      position: [0, 0.65, 0.1],
    });
  }

  // --- V9/V21 Rear Warehouse Delivery Pallets (Start CLEAN — receive Terminal Commande 1990 & CENTRALE-ACHAT 90 orders) ---
  //     Uses the exact same unified carryable/storable box slots so ordered boxes can be opened here OR stored onto Travées A–E!
  {
    const deliveryRoot = new THREE.Group();
    root.add(deliveryRoot);

    const palletCoords: Array<{ x: number; z: number; label: string; colId: string }> = [
      { x: 2.35, z: -9.45, label: 'Palette Réception #1', colId: 'wh_delivery_pallet_1' },
      { x: 0.85, z: -9.45, label: 'Palette Réception #2', colId: 'wh_delivery_pallet_2' },
    ];

    const eurPalletGeo = new THREE.BoxGeometry(1.16, 0.14, 1.38);
    ctx.disposables.push(eurPalletGeo);

    palletCoords.forEach((p) => {
      const base = new THREE.Mesh(eurPalletGeo, mats.rusticWood);
      base.position.set(p.x, 0.07, p.z);
      base.castShadow = true;
      base.receiveShadow = true;
      deliveryRoot.add(base);
      addBoxCollider(ctx, p.colId, p.x - 0.6, p.x + 0.6, p.z - 0.72, p.z + 0.72);
    });

    // Painted overhead signage for "ZONE RÉCEPTION COMMANDES"
    const zoneSignTex = texBank.createDepartmentSignTexture(
      'ZONE RÉCEPTION COMMANDES',
      'PALETTES LIVRAISON · TRANSPORTEZ VERS LES TRAVÉES A–E OU OUVREZ ICI',
      '#1e293b',
      '#f59e0b'
    );
    const zoneSignMat = new THREE.MeshStandardMaterial({ map: zoneSignTex, roughness: 0.4 });
    const zoneSign = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.36, 0.05), zoneSignMat);
    zoneSign.position.set(1.6, 2.35, -7.16);
    zoneSign.rotation.y = Math.PI;
    deliveryRoot.add(zoneSign);
    ctx.disposables.push(zoneSignMat, zoneSign.geometry);

    // 4 dedicated long-box slots on Pallet #1 (aligned along pallet Z axis)
    const deliveryLongSlots: WarehouseStorageSlot[] = [
      [2.12, 0.14, -9.45],
      [2.58, 0.14, -9.45],
      [2.12, 0.34, -9.45],
      [2.58, 0.34, -9.45],
    ].map((pos, idx) =>
      createStorageSlot(deliveryRoot, {
        id: `wh_delivery_long_${idx}`,
        bayLabel: 'Palette Réception #1',
        pos: [pos[0], pos[1], pos[2]],
        rotY: Math.PI / 2,
        isDeliveryPallet: true,
        preferLongBox: true,
      })
    );

    // 8 dedicated standard/crate delivery slots across Pallet #2 (2x2x2 stack)
    const deliveryStdSlots: WarehouseStorageSlot[] = [
      [0.58, 0.14, -9.74],
      [1.12, 0.14, -9.74],
      [0.58, 0.14, -9.16],
      [1.12, 0.14, -9.16],
      [0.58, 0.48, -9.74],
      [1.12, 0.48, -9.74],
      [0.58, 0.48, -9.16],
      [1.12, 0.48, -9.16],
    ].map((pos, idx) =>
      createStorageSlot(deliveryRoot, {
        id: `wh_delivery_std_${idx}`,
        bayLabel: 'Palette Réception #2',
        pos: [pos[0], pos[1], pos[2]],
        rotY: 0,
        isDeliveryPallet: true,
        preferLongBox: false,
      })
    );

    let overflowCounter = 0;

    orderModel.onTransmitOrder((lines) => {
      for (const line of lines) {
        for (let q = 0; q < line.qty; q++) {
          if (line.def.isLongRailBox) {
            const freeLong =
              deliveryLongSlots.find((s) => s.box === null) ??
              allStorageSlots.find((s) => s.preferLongBox && s.box === null);
            if (freeLong) {
              freeLong.placeBox(line.def, { animateDrop: true });
            } else {
              // Dynamic overflow slot above Pallet #1
              const idx = ++overflowCounter;
              const ovSlot = createStorageSlot(deliveryRoot, {
                id: `wh_delivery_long_ov_${idx}`,
                bayLabel: 'Palette Réception #1',
                pos: [2.12 + (idx % 2) * 0.46, 0.54 + Math.floor(idx / 2) * 0.2, -9.45],
                rotY: Math.PI / 2,
                isDeliveryPallet: true,
                preferLongBox: true,
              });
              ovSlot.placeBox(line.def, { animateDrop: true });
            }
          } else {
            const freeStd =
              deliveryStdSlots.find((s) => s.box === null) ??
              allStorageSlots.find((s) => !s.preferLongBox && s.box === null);
            if (freeStd) {
              freeStd.placeBox(line.def, { animateDrop: true });
            } else {
              // Dynamic overflow slot above Pallet #2
              const idx = ++overflowCounter;
              const col = idx % 4;
              const tier = Math.floor(idx / 4);
              const ovSlot = createStorageSlot(deliveryRoot, {
                id: `wh_delivery_std_ov_${idx}`,
                bayLabel: 'Palette Réception #2',
                pos: [
                  col % 2 === 0 ? 0.58 : 1.12,
                  0.82 + tier * 0.34,
                  col < 2 ? -9.74 : -9.16,
                ],
                rotY: 0,
                isDeliveryPallet: true,
                preferLongBox: false,
              });
              ovSlot.placeBox(line.def, { animateDrop: true });
            }
          }
        }
      }
    });
  }

  // --- V9 Warehouse Receiving Desk ("Bureau Réception") + Docked 3D "Terminal Commande 1990" ---
  //     Positioned at X = 4.35, Z = -8.45 facing -Z (into the warehouse corridor, clear of baler!)
  {
    const deskGroup = new THREE.Group();
    deskGroup.position.set(4.35, 0, -8.45);
    deskGroup.rotation.y = Math.PI; // Local +Z faces -Z (toward warehouse aisle & pallets)
    root.add(deskGroup);

    // Industrial steel receiving stand (0.95m wide x 0.92m tall x 0.62m deep)
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.045, 0.62), mats.rusticWood);
    deskTop.position.set(0, 0.92, 0);
    deskTop.castShadow = true;
    deskTop.receiveShadow = true;
    const deskShelf = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.52), mats.anthracite);
    deskShelf.position.set(0, 0.36, 0);
    const deskLegGeo = new THREE.BoxGeometry(0.045, 0.9, 0.045);
    ctx.disposables.push(deskTop.geometry, deskShelf.geometry, deskLegGeo);
    [
      [-0.44, -0.27],
      [0.44, -0.27],
      [-0.44, 0.27],
      [0.44, 0.27],
    ].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(deskLegGeo, mats.anthracite);
      leg.position.set(lx, 0.45, lz);
      deskGroup.add(leg);
    });
    deskGroup.add(deskTop, deskShelf);

    // Small clipboard / receiving ledger prop beside the terminal
    const ledger = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.32), mats.whiteMetal);
    ledger.position.set(-0.28, 0.95, 0.02);
    ledger.rotation.y = 0.14;
    deskGroup.add(ledger);
    ctx.disposables.push(ledger.geometry);

    // Acoustic Modem Coupler Cradle + Docked 3D "Terminal Commande 1990" (Angled cleanly at 32° for effortless first-person reading & button clicks!)
    const dockStation = new THREE.Group();
    dockStation.position.set(0.14, 0.945, 0.02);
    deskGroup.add(dockStation);

    const cradleMat = new THREE.MeshStandardMaterial({
      color: 0x262c34,
      roughness: 0.72,
      metalness: 0.18,
    });
    const termBodyMat = new THREE.MeshStandardMaterial({
      color: 0xd4cfc2,
      roughness: 0.56,
      metalness: 0.08,
    });
    const modemCupMat = new THREE.MeshStandardMaterial({
      color: 0x1e242b,
      roughness: 0.85,
    });
    const dockLedMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x15803d,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    ctx.disposables.push(cradleMat, termBodyMat, modemCupMat, dockLedMat);

    // Heavy black acoustic modem base + telephone handset acoustic coupler cups
    const cradleBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.36), cradleMat);
    cradleBase.position.set(0, 0.03, 0);
    const cupGeo = new THREE.CylinderGeometry(0.036, 0.04, 0.045, 14);
    const cupL = new THREE.Mesh(cupGeo, modemCupMat);
    cupL.position.set(-0.17, 0.08, -0.09);
    const cupR = new THREE.Mesh(cupGeo, modemCupMat);
    cupR.position.set(-0.17, 0.08, 0.07);
    const dockLed = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.012), dockLedMat);
    dockLed.position.set(-0.17, 0.064, 0.16);
    dockStation.add(cradleBase, cupL, cupR, dockLed);
    ctx.disposables.push(cradleBase.geometry, cupGeo, dockLed.geometry);

    // Angled 1990 Telxon/MSI Ordering Terminal Unit seated in cradle
    const termPivot = new THREE.Group();
    termPivot.position.set(0.05, 0.15, 0.01);
    termPivot.rotation.x = -0.68; // Tilted toward standing player eye level
    dockStation.add(termPivot);

    const termChassis = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.065), termBodyMat);
    const termBezel = new THREE.Mesh(new THREE.BoxGeometry(0.285, 0.175, 0.012), cradleMat);
    termBezel.position.set(0, 0.088, 0.032);
    const keyWell = new THREE.Mesh(new THREE.BoxGeometry(0.285, 0.155, 0.008), modemCupMat);
    keyWell.position.set(0, -0.092, 0.032);
    termPivot.add(termChassis, termBezel, keyWell);
    ctx.disposables.push(termChassis.geometry, termBezel.geometry, keyWell.geometry);

    // Live 512x320 Monochrome LCD synced with OrderTerminalModel
    const dockLcdCanvas = document.createElement('canvas');
    dockLcdCanvas.width = 512;
    dockLcdCanvas.height = 320;
    orderModel.drawLcd(dockLcdCanvas);
    const dockLcdTex = new THREE.CanvasTexture(dockLcdCanvas);
    dockLcdTex.colorSpace = THREE.SRGBColorSpace;
    dockLcdTex.anisotropy = ctx.maxAnisotropy;
    const dockLcdMat = new THREE.MeshStandardMaterial({
      map: dockLcdTex,
      emissiveMap: dockLcdTex,
      emissive: 0xcbe0b8,
      emissiveIntensity: 0.42,
      roughness: 0.28,
    });
    const dockLcdMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.265, 0.158), dockLcdMat);
    dockLcdMesh.position.set(0, 0.088, 0.0395);
    termPivot.add(dockLcdMesh);
    ctx.disposables.push(dockLcdTex, dockLcdMat, dockLcdMesh.geometry);

    orderModel.onChange(() => {
      orderModel.drawLcd(dockLcdCanvas);
      dockLcdTex.needsUpdate = true;
    });

    // 6 Clickable Physical 3D Rubber Keys on the Docked Terminal (HAUT, BAS, QTE+, QTE-, VALIDER, TRANSMETTRE)
    const dockKeys: Array<{
      code: OrderTerminalKeyCode;
      legend: string;
      verb: string;
      bg: string;
      side: number;
      fg: string;
      x: number;
      y: number;
      w: number;
    }> = [
      { code: 'HAUT', legend: '▲ HAUT', verb: 'MONTER CATALOGUE', bg: '#374151', side: 0x1f2937, fg: '#f8fafc', x: -0.092, y: -0.052, w: 0.082 },
      { code: 'QTE+', legend: 'QTÉ +', verb: 'AUGMENTER QUANTITÉ (+1)', bg: '#1e40af', side: 0x1e3a8a, fg: '#fef08a', x: 0.0, y: -0.052, w: 0.082 },
      { code: 'VALIDER', legend: 'VALIDER', verb: 'VALIDER LIGNE COMMANDE', bg: '#0f766e', side: 0x115e59, fg: '#f0fdfa', x: 0.092, y: -0.052, w: 0.082 },
      { code: 'BAS', legend: '▼ BAS', verb: 'DESCENDRE CATALOGUE', bg: '#374151', side: 0x1f2937, fg: '#f8fafc', x: -0.092, y: -0.125, w: 0.082 },
      { code: 'QTE-', legend: 'QTÉ -', verb: 'RÉDUIRE QUANTITÉ (-1)', bg: '#991b1b', side: 0x7f1d1d, fg: '#fef2f2', x: 0.0, y: -0.125, w: 0.082 },
      { code: 'TRANSMETTRE', legend: 'TRANSM.', verb: 'TRANSMETTRE COMMANDE (MODEM)', bg: '#15803d', side: 0x14532d, fg: '#f0fdf4', x: 0.092, y: -0.125, w: 0.082 },
    ];

    const dockBtnAnims: Array<{ mesh: THREE.Mesh; restZ: number; press: number }> = [];
    const dockHitMat = new THREE.MeshBasicMaterial({ visible: false });
    ctx.disposables.push(dockHitMat);

    dockKeys.forEach((dk) => {
      const cv = document.createElement('canvas');
      cv.width = 160;
      cv.height = 96;
      const c = cv.getContext('2d')!;
      c.fillStyle = dk.bg;
      c.fillRect(0, 0, 160, 96);
      c.strokeStyle = 'rgba(255,255,255,0.28)';
      c.lineWidth = 4;
      c.strokeRect(4, 4, 152, 88);
      c.fillStyle = dk.fg;
      c.font = '900 28px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(dk.legend, 80, 50);

      const kTex = new THREE.CanvasTexture(cv);
      kTex.colorSpace = THREE.SRGBColorSpace;
      const frontMat = new THREE.MeshStandardMaterial({ map: kTex, roughness: 0.62 });
      const sideMat = new THREE.MeshStandardMaterial({ color: dk.side, roughness: 0.72 });
      const kGeo = new THREE.BoxGeometry(dk.w, 0.056, 0.018);
      const kMesh = new THREE.Mesh(kGeo, [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]);
      const restZ = 0.044;
      kMesh.position.set(dk.x, dk.y, restZ);
      termPivot.add(kMesh);

      const hGeo = new THREE.BoxGeometry(dk.w + 0.008, 0.064, 0.032);
      const hMesh = new THREE.Mesh(hGeo, dockHitMat);
      hMesh.position.set(dk.x, dk.y, restZ + 0.004);
      hMesh.layers.set(INTERACT_LAYER);
      termPivot.add(hMesh);

      const anim = { mesh: kMesh, restZ, press: 0 };
      dockBtnAnims.push(anim);

      const item: InteractableItem = {
        id: `wh_order_term_btn_${dk.code}`,
        title: `Terminal Commande 1990 · [${dk.legend}]`,
        subtitle: 'Socle Modem Acoustique · Bureau Réception Entrepôt',
        kind: 'diegetic_action',
        state: false,
        inspectText: 'Terminal de commande centrale 1990 sur socle modem acoustique.',
        proxyMesh: hMesh,
        dynamicVerb: () => dk.verb,
        dynamicSubtitle: () =>
          `${orderModel.getSelectedDef().shortLabel} · Panier : ${orderModel.getTotalCartons()} carton(s)`,
        onInteract: () => {
          if (orderModel.pressKey(dk.code)) {
            anim.press = 1.0;
          }
        },
      };
      hMesh.userData.interactable = item;
      ctx.interactables.push(item);

      ctx.disposables.push(kTex, frontMat, sideMat, kGeo, hGeo);
    });

    ctx.updaters.push({
      update: (dt) => {
        for (let i = 0; i < dockBtnAnims.length; i++) {
          const a = dockBtnAnims[i];
          if (a.press > 0) {
            a.press = Math.max(0, a.press - dt * 6.5);
            a.mesh.position.z = a.restZ - Math.sin(a.press * Math.PI) * 0.008;
          } else {
            a.mesh.position.z = a.restZ;
          }
        }
      },
    });

    addBoxCollider(ctx, 'wh_receiving_desk_col', 3.82, 4.88, -8.82, -8.08);
  }

  // --- V21 Interactive 1990 Hydraulic Cardboard Baler ("PRESSE À CARTON 16T") at X = +7.4, Z = -8.35 ---
  {
    const baler = new THREE.Group();
    baler.position.set(7.4, 0, -8.35);
    root.add(baler);

    // Heavy green steel compaction chamber
    const lowerChamber = new THREE.Mesh(new THREE.BoxGeometry(1.52, 1.24, 1.15), mats.balerGreen);
    lowerChamber.position.y = 0.62;
    lowerChamber.castShadow = true;

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.48, 1.38, 0.12), mats.balerGreen);
    backWall.position.set(0, 1.88, 0.52);

    // Side structural columns up to top hydraulic beam
    const colL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.65, 1.15), mats.balerGreen);
    colL.position.set(-0.68, 1.325, 0);
    const colR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.65, 1.15), mats.balerGreen);
    colR.position.set(0.68, 1.325, 0);
    const topHead = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.28, 1.18), mats.balerGreen);
    topHead.position.set(0, 2.58, 0);

    // Overhead crisp machine title plate ("PRESSE À CARTON 16T")
    const balerSignTex = texBank.createDepartmentSignTexture(
      'PRESSE À CARTON 16T',
      'JETEZ CARTONS VIDES · ABATTEZ LE LEVIER VERT',
      '#14532d',
      '#facc15'
    );
    const balerSignMat = new THREE.MeshStandardMaterial({ map: balerSignTex, roughness: 0.35 });
    const balerSign = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.28, 0.04), balerSignMat);
    balerSign.position.set(0, 2.58, -0.61);
    balerSign.rotation.y = Math.PI;

    // Dynamic compacted cardboard bale at bottom of chamber (grows taller with every compacted batch!)
    const baleGroup = new THREE.Group();
    baleGroup.position.set(0, 1.24, 0);
    const baleMesh = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.26, 0.88), mats.cardboard);
    baleMesh.position.y = 0.13;
    const strapGeo = new THREE.BoxGeometry(1.16, 0.018, 0.9);
    const strap1 = new THREE.Mesh(strapGeo, mats.anthracite);
    strap1.position.y = 0.08;
    const strap2 = new THREE.Mesh(strapGeo, mats.anthracite);
    strap2.position.y = 0.19;
    baleGroup.add(baleMesh, strap1, strap2);

    // 4 visible loose empty-cardboard-box slots inside the chamber that squish flat under the hydraulic platen!
    const looseGroup = new THREE.Group();
    looseGroup.position.set(0, 1.52, 0);
    const looseCartonGeo = new THREE.BoxGeometry(0.5, 0.22, 0.42);
    const looseOffsets: Array<[number, number, number, number]> = [
      [-0.27, 0.11, -0.1, 0.14],
      [0.26, 0.11, 0.08, -0.18],
      [-0.22, 0.32, 0.09, -0.09],
      [0.24, 0.32, -0.08, 0.22],
    ];
    const looseMeshes: THREE.Mesh[] = looseOffsets.map(([lx, ly, lz, ry]) => {
      const m = new THREE.Mesh(looseCartonGeo, mats.cardboard);
      m.position.set(lx, ly, lz);
      m.rotation.y = ry;
      m.visible = false;
      looseGroup.add(m);
      return m;
    });

    // Top Hydraulic Cylinder + Moving Chromed Piston Rod + Orange Pressing Platen
    const hydCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.72, 16),
      mats.anthracite
    );
    hydCylinder.position.set(0, 3.04, 0);

    const pistonAssembly = new THREE.Group();
    pistonAssembly.position.set(0, 2.22, 0);
    const chromeRod = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.92, 14), mats.chrome);
    chromeRod.position.y = 0.38;
    const platen = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.1, 0.94), mats.rackOrange);
    platen.position.y = -0.08;
    pistonAssembly.add(chromeRod, platen);

    // Sliding Yellow Safety Cage Door on Front (-Z face facing into warehouse aisle)
    const cageGroup = new THREE.Group();
    cageGroup.position.set(0, 1.68, -0.58);
    const cageFrame = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.72, 0.04), mats.chainLink);
    const cageTopRail = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.06, 0.06), mats.palletYellow);
    cageTopRail.position.y = 0.34;
    const cageBotRail = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.06, 0.06), mats.palletYellow);
    cageBotRail.position.y = -0.34;
    cageGroup.add(cageFrame, cageTopRail, cageBotRail);

    // Side Electrical Control Box + Physical 3D Green Hydraulic Lever!
    const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.46, 0.26), mats.whiteMetal);
    ctrlBox.position.set(-0.91, 1.44, -0.38);

    const greenLampMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.35,
    });
    const amberLampMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.15,
    });
    const lampGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 12);
    const greenLamp = new THREE.Mesh(lampGeo, greenLampMat);
    greenLamp.rotation.x = Math.PI / 2;
    greenLamp.position.set(-0.97, 1.56, -0.52);
    const amberLamp = new THREE.Mesh(lampGeo, amberLampMat);
    amberLamp.rotation.x = Math.PI / 2;
    amberLamp.position.set(-0.85, 1.56, -0.52);

    // Physical 3D Green Hydraulic Compaction Lever (pivots downward when pulled!)
    const leverPivot = new THREE.Group();
    leverPivot.position.set(-0.91, 1.38, -0.51);
    const leverBase = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.05), mats.anthracite);
    const leverShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.26, 10), mats.chrome);
    leverShaft.position.set(0, 0.1, -0.07);
    leverShaft.rotation.x = -0.52;
    const leverKnobMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x15803d,
      emissiveIntensity: 0.35,
      roughness: 0.32,
    });
    const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), leverKnobMat);
    leverKnob.position.set(0, 0.21, -0.14);
    leverPivot.add(leverBase, leverShaft, leverKnob);

    ctx.disposables.push(
      lowerChamber.geometry,
      backWall.geometry,
      colL.geometry,
      colR.geometry,
      topHead.geometry,
      balerSignMat,
      balerSign.geometry,
      baleMesh.geometry,
      strapGeo,
      looseCartonGeo,
      hydCylinder.geometry,
      chromeRod.geometry,
      platen.geometry,
      cageFrame.geometry,
      cageTopRail.geometry,
      cageBotRail.geometry,
      ctrlBox.geometry,
      greenLampMat,
      amberLampMat,
      lampGeo,
      leverBase.geometry,
      leverShaft.geometry,
      leverKnobMat,
      leverKnob.geometry
    );
    baler.add(
      lowerChamber,
      backWall,
      colL,
      colR,
      topHead,
      balerSign,
      baleGroup,
      looseGroup,
      hydCylinder,
      pistonAssembly,
      cageGroup,
      ctrlBox,
      greenLamp,
      amberLamp,
      leverPivot
    );

    let cageOpen = true;
    let looseInChamber = 0;
    let compactedTotal = 2;
    let crushActive = false;
    let crushTimer = 0;
    let crushMerged = false;
    let balerActionLock = 0;
    const CRUSH_CYCLE_SEC = 2.0;

    const syncBaleAndLoose = () => {
      const baleScaleY = Math.min(2.15, 0.85 + compactedTotal * 0.14);
      baleGroup.scale.set(1, baleScaleY, 1);
      looseGroup.position.y = 1.24 + 0.26 * baleScaleY;
      for (let i = 0; i < looseMeshes.length; i++) {
        looseMeshes[i].visible = i < looseInChamber;
      }
      amberLampMat.emissiveIntensity = looseInChamber > 0 ? 1.2 : 0.12;
    };
    syncBaleAndLoose();

    ctx.updaters.push({
      update: (dt) => {
        const cageTargetY = cageOpen ? 2.34 : 1.68;
        cageGroup.position.y = THREE.MathUtils.damp(cageGroup.position.y, cageTargetY, 7.5, dt);

        if (crushActive) {
          crushTimer += dt;
          const t = Math.min(1, crushTimer / CRUSH_CYCLE_SEC);
          // 0..0.52 = downward crush stroke, 0.52..1.0 = upward return stroke
          let pistonNorm = 0;
          if (t < 0.52) {
            const p = t / 0.52;
            pistonNorm = p * p * (3 - 2 * p);
          } else {
            const p = (t - 0.52) / 0.48;
            pistonNorm = 1 - p * p * (3 - 2 * p);
          }

          const topY = 2.22;
          const bottomY = Math.min(1.88, looseGroup.position.y + 0.14);
          pistonAssembly.position.y = THREE.MathUtils.lerp(topY, bottomY, pistonNorm);

          // Physically squish loaded empty cartons as the orange platen presses down
          if (!crushMerged && looseInChamber > 0) {
            const squish = Math.max(0.14, 1 - pistonNorm * 0.88);
            looseGroup.scale.set(1, squish, 1);
          }

          // At bottom of stroke, merge crushed cartons into the compacted bale
          if (!crushMerged && t >= 0.52) {
            crushMerged = true;
            if (looseInChamber > 0) {
              compactedTotal += looseInChamber;
              looseInChamber = 0;
            }
            looseGroup.scale.set(1, 1, 1);
            syncBaleAndLoose();
          }

          // Pull green hydraulic lever down while active
          leverPivot.rotation.x = THREE.MathUtils.damp(leverPivot.rotation.x, -1.15, 10, dt);
          greenLampMat.emissiveIntensity = 1.9;

          if (crushTimer >= CRUSH_CYCLE_SEC) {
            crushActive = false;
            crushTimer = 0;
            crushMerged = false;
            cageOpen = true;
            greenLampMat.emissiveIntensity = 0.35;
          }
        } else {
          pistonAssembly.position.y = THREE.MathUtils.damp(pistonAssembly.position.y, 2.22, 6.0, dt);
          leverPivot.rotation.x = THREE.MathUtils.damp(leverPivot.rotation.x, 0, 8.0, dt);
        }
      },
    });

    addBoxCollider(ctx, 'baler_col', 6.32, 8.28, -9.0, -7.68);

    // Interactable 1: Compaction Chamber (Load Empty Carton OR Toggle Safety Cage)
    const chamberHitGeo = new THREE.BoxGeometry(1.3, 0.92, 0.55);
    ctx.disposables.push(chamberHitGeo);
    const chamberHitMesh = new THREE.Mesh(chamberHitGeo, proxyHiddenMat);
    chamberHitMesh.position.set(0, 1.72, -0.45);
    chamberHitMesh.layers.set(INTERACT_LAYER);
    baler.add(chamberHitMesh);

    const chamberInteract: InteractableItem = {
      id: 'baler_chamber_load',
      title: 'Presse à Carton Hydraulique 16T',
      subtitle: 'Chambre de Compactage Verticale',
      kind: 'diegetic_action',
      state: false,
      inspectText:
        'Jetez vos cartons vides dans la chambre de compactage puis actionnez le levier hydraulique vert pour les écraser en balle.',
      proxyMesh: chamberHitMesh,
      dynamicSubtitle: () =>
        crushActive
          ? 'Compactage hydraulique en cours…'
          : `Dans la presse : ${looseInChamber}/4 carton(s) vide(s) · Balle : ${compactedTotal} cartons`,
      dynamicVerb: () => {
        if (crushActive) return 'COMPACTAGE EN COURS…';
        const holdingEmpty =
          tools.getActiveTool() === 'hands' && tools.getHeldItem()?.kind === 'empty_carton';
        if (holdingEmpty) {
          return looseInChamber < 4
            ? 'JETER LE CARTON VIDE DANS LA PRESSE'
            : 'CHAMBRE PLEINE (ACTIONNER LE LEVIER VERT)';
        }
        return cageOpen ? 'FERMER LA GRILLE DE SÉCURITÉ' : 'OUVRIR LA GRILLE DE SÉCURITÉ';
      },
      onInteract: () => {
        const now = performance.now();
        if (now - balerActionLock < 320 || crushActive) return;
        balerActionLock = now;

        const holdingEmpty =
          tools.getActiveTool() === 'hands' && tools.getHeldItem()?.kind === 'empty_carton';
        if (holdingEmpty) {
          if (looseInChamber >= 4) {
            soundSynth.playAtmPiezo('error');
            return;
          }
          const consumed = tools.consumeHeldItem();
          if (!consumed) return;
          cageOpen = true;
          looseInChamber += 1;
          syncBaleAndLoose();
          soundSynth.playBagThump();
          soundSynth.playPaperGrab();
          return;
        }

        cageOpen = !cageOpen;
        soundSynth.playMechanicalButtonClick();
      },
    };
    chamberHitMesh.userData.interactable = chamberInteract;
    ctx.interactables.push(chamberInteract);

    // Interactable 2: Physical 3D Green Hydraulic Compaction Lever ("COMPACTER LES CARTONS")
    const leverHitGeo = new THREE.BoxGeometry(0.46, 0.58, 0.42);
    ctx.disposables.push(leverHitGeo);
    const leverHitMesh = new THREE.Mesh(leverHitGeo, proxyHiddenMat);
    leverHitMesh.position.set(-0.91, 1.48, -0.48);
    leverHitMesh.layers.set(INTERACT_LAYER);
    baler.add(leverHitMesh);

    const leverInteract: InteractableItem = {
      id: 'baler_hydraulic_lever',
      title: 'Levier Hydraulique Vert — Presse à Carton',
      subtitle: 'Vérin 16 Tonnes · Compactage Automatique',
      kind: 'diegetic_action',
      state: false,
      inspectText:
        'Abaissez ce levier vert pour fermer la grille de sécurité et compacter hydrauliquement les cartons vides.',
      proxyMesh: leverHitMesh,
      dynamicSubtitle: () =>
        crushActive
          ? 'Cycle vérin 16T en cours…'
          : looseInChamber > 0
            ? `${looseInChamber} carton(s) vide(s) prêt(s) à compacter · Balle : ${compactedTotal}`
            : `Chambre vide · Balle compactée : ${compactedTotal} cartons`,
      dynamicVerb: () => {
        if (crushActive) return 'COMPACTAGE EN COURS…';
        return looseInChamber > 0
          ? `COMPACTER LES CARTONS (${looseInChamber})`
          : 'COMPACTER LES CARTONS (CYCLE À VIDE)';
      },
      onInteract: () => {
        const now = performance.now();
        if (now - balerActionLock < 320 || crushActive) return;
        balerActionLock = now;

        cageOpen = false;
        crushActive = true;
        crushTimer = 0;
        crushMerged = false;
        soundSynth.playHydraulicBalerCrush(looseInChamber > 0);
      },
    };
    leverHitMesh.userData.interactable = leverInteract;
    ctx.interactables.push(leverInteract);
  }

  // ============================================================================
  // 3. OUTDOOR REAR LOADING DOCK, CONCRETE STAIRS, CHAIN-LINK FENCE & BOX TRUCK
  // Dock Platform: X = -5.2 to +3.6, Z = -13.0 to -14.8 (Y = 0.0)
  // Concrete Stairs: X = +3.6 to +4.9, Z = -13.2 (Y=0) down to Z = -15.4 (Y=-0.95)
  // Fenced Truck Yard: X = -11.0 to +11.0, Z = -13.0 to -20.2 (Y = -0.95)
  // ============================================================================
  {
    const yard = new THREE.Group();
    root.add(yard);

    // Lower paved asphalt truck yard at Y = -0.95
    const yardAsphaltGeo = new THREE.PlaneGeometry(22.4, 7.6);
    ctx.disposables.push(yardAsphaltGeo);
    const yardAsphalt = new THREE.Mesh(yardAsphaltGeo, mats.asphalt);
    yardAsphalt.rotation.x = -Math.PI / 2;
    yardAsphalt.position.set(0, -0.945, -16.6);
    yardAsphalt.receiveShadow = true;
    yard.add(yardAsphalt);

    // Concrete Loading Dock Platform (X = -5.2 to +3.6, Z = -13.0 to -14.8, top at Y = 0.0)
    const dockSlab = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.96, 1.85), mats.concrete);
    dockSlab.position.set(-0.8, -0.48, -13.92);
    dockSlab.receiveShadow = true;
    yard.add(dockSlab);
    ctx.disposables.push(dockSlab.geometry);

    // V26: Heavy Ribbed Black Rubber Dock Bumpers ("Butoirs de Quai") with Galvanized Steel Backing Plates
    const bumperPlateGeo = new THREE.BoxGeometry(0.42, 0.56, 0.04);
    const bumperBlockGeo = new THREE.BoxGeometry(0.32, 0.48, 0.14);
    const bumperRibGeo = new THREE.BoxGeometry(0.045, 0.46, 0.04);
    ctx.disposables.push(bumperPlateGeo, bumperBlockGeo, bumperRibGeo);
    [-2.8, -1.2, 0.4, 2.2].forEach((bx) => {
      const bGrp = new THREE.Group();
      bGrp.position.set(bx, -0.28, -14.86);
      const plate = new THREE.Mesh(bumperPlateGeo, mats.galvanized);
      const block = new THREE.Mesh(bumperBlockGeo, mats.rubberBlack);
      block.position.z = -0.07;
      bGrp.add(plate, block);
      [-0.1, 0, 0.1].forEach((rx) => {
        const rib = new THREE.Mesh(bumperRibGeo, mats.rubberBlack);
        rib.position.set(rx, 0, -0.15);
        bGrp.add(rib);
      });
      yard.add(bGrp);
    });
    // Vertical rubber dock-portal wall protection bumpers flanking the roll-up shutter at Z = -13.18
    const wallBumperGeo = new THREE.BoxGeometry(0.24, 1.65, 0.12);
    ctx.disposables.push(wallBumperGeo);
    [-3.62, 1.22].forEach((wx) => {
      const wb = new THREE.Mesh(wallBumperGeo, mats.rubberBlack);
      wb.position.set(wx, 0.92, -13.19);
      yard.add(wb);
    });

    // Yellow safety tubular guardrails on dock edges (preventing accidental drop off dock while leaving stairs open!)
    const railMat = mats.palletYellow;
    // Left dock guardrail (X = -5.15, Z = -13.0 to -14.8)
    const leftRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.05, 1.8), railMat);
    leftRail.position.set(-5.15, 0.525, -13.9);
    // Front dock safety barriers on left & right of truck bay (leaving truck inspection view & stairs X=+3.6..+4.9 open!)
    const frontRailL = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.05, 0.08), railMat);
    frontRailL.position.set(-4.0, 0.525, -14.78);
    const frontRailR = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.05, 0.08), railMat);
    frontRailR.position.set(2.05, 0.525, -14.78);
    yard.add(leftRail, frontRailL, frontRailR);
    ctx.disposables.push(leftRail.geometry, frontRailL.geometry, frontRailR.geometry);

    // Colliders along dock drop-offs (player cannot fall off vertical drop, must use stairs at X = 3.6..4.9!)
    addBoxCollider(ctx, 'dock_guard_west', -5.3, -5.0, -14.9, -12.9);
    addBoxCollider(ctx, 'dock_drop_front', -5.2, 3.6, -14.92, -14.68);
    // East of building rear wall (X = +4.9 to +11.0 at Z = -13.1)
    addBoxCollider(ctx, 'dock_east_cliff', 4.92, 11.1, -13.25, -12.9);
    addBoxCollider(ctx, 'dock_west_cliff', -11.1, -5.15, -13.25, -12.9);

    // 5-Step Concrete Staircase + Handrail (X = +3.6 to +4.9, Z = -13.15 down to Z = -15.4)
    for (let st = 0; st < 5; st++) {
      const stepH = 0.95 * (1 - st / 5);
      const stepZ = -13.35 - st * 0.44;
      const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, stepH, 0.46), mats.concrete);
      stepMesh.position.set(4.25, -0.95 + stepH / 2, stepZ);
      stepMesh.receiveShadow = true;
      yard.add(stepMesh);
      ctx.disposables.push(stepMesh.geometry);
    }
    const stairHandrail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 2.35), railMat);
    stairHandrail.position.set(4.92, 0.05, -14.25);
    stairHandrail.rotation.x = -0.39;
    yard.add(stairHandrail);
    ctx.disposables.push(stairHandrail.geometry);
    addBoxCollider(ctx, 'stair_outer_rail', 4.86, 5.05, -15.45, -13.05);

    // --- Industrial Galvanized Chain-Link Security Fencing ("Grillage") & Sliding Truck Gate ---
    const fenceH = 2.65;
    const yardY = -0.95;

    // Instanced Galvanized Fence Posts around perimeter (X = ±10.8, Z = -13.0 to -20.0; North line Z = -20.0)
    const fPostGeo = new THREE.CylinderGeometry(0.042, 0.042, fenceH, 8);
    ctx.disposables.push(fPostGeo);
    const postEntries: InstanceEntry[] = [];

    for (let fz = -13.0; fz >= -20.01; fz -= 2.33) {
      postEntries.push({ pos: [-10.8, yardY + fenceH / 2, fz] });
      postEntries.push({ pos: [10.8, yardY + fenceH / 2, fz] });
    }
    for (let fx = -10.8; fx <= 10.81; fx += 2.4) {
      // Leave gate gap from X = -4.2 to X = +1.8
      if (fx < -4.1 || fx > 1.7) {
        postEntries.push({ pos: [fx, yardY + fenceH / 2, -20.0] });
      }
    }
    postEntries.push({ pos: [-4.2, yardY + fenceH / 2, -20.0] });
    postEntries.push({ pos: [1.8, yardY + fenceH / 2, -20.0] });
    buildInstancedMesh(ctx, yard, fPostGeo, mats.galvanized, postEntries, false);

    // Chain-Link Mesh Panels + Top Rails
    const addFenceSpan = (
      x: number,
      z: number,
      length: number,
      rotY: number,
      colId: string,
      minX: number,
      maxX: number,
      minZ: number,
      maxZ: number
    ) => {
      const meshPlane = new THREE.Mesh(new THREE.PlaneGeometry(length, fenceH - 0.1), mats.chainLink);
      meshPlane.position.set(x, yardY + fenceH / 2, z);
      meshPlane.rotation.y = rotY;
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(length, 0.05, 0.05), mats.galvanized);
      topBar.position.set(x, yardY + fenceH, z);
      topBar.rotation.y = rotY;
      yard.add(meshPlane, topBar);
      ctx.disposables.push(meshPlane.geometry, topBar.geometry);
      addBoxCollider(ctx, colId, minX, maxX, minZ, maxZ);
    };

    addFenceSpan(-10.8, -16.5, 7.0, Math.PI / 2, 'fence_west', -10.95, -10.65, -20.1, -12.9);
    addFenceSpan(10.8, -16.5, 7.0, Math.PI / 2, 'fence_east', 10.65, 10.95, -20.1, -12.9);
    addFenceSpan(-7.5, -20.0, 6.6, 0, 'fence_north_w', -10.9, -4.2, -20.15, -19.85);
    addFenceSpan(6.3, -20.0, 9.0, 0, 'fence_north_e', 1.8, 10.9, -20.15, -19.85);

    // Sliding Metal Truck Gate ("Portail Coulissant Poids Lourds", 6.0m wide at Z = -19.92)
    const gateGroup = new THREE.Group();
    gateGroup.position.set(-1.2, yardY, -19.92);
    yard.add(gateGroup);

    const gateFrame = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.08, 0.08), mats.galvanized);
    gateFrame.position.y = fenceH - 0.08;
    const gateBot = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.1, 0.08), mats.galvanized);
    gateBot.position.y = 0.12;
    const gateMesh = new THREE.Mesh(new THREE.PlaneGeometry(6.0, fenceH - 0.24), mats.chainLink);
    gateMesh.position.y = fenceH / 2;
    const gateSignTex = texBank.createDepartmentSignTexture(
      'ACCÈS CAMIONS LIVRAISON',
      'PORTAIL COULISSANT MOTORISÉ · STATIONNEMENT INTERDIT',
      '#1e293b',
      '#ef4444'
    );
    const gateSignMat = new THREE.MeshStandardMaterial({ map: gateSignTex, roughness: 0.4 });
    const gateSign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.36, 0.04), gateSignMat);
    gateSign.position.set(0, 1.55, 0.04);
    ctx.disposables.push(
      gateFrame.geometry,
      gateBot.geometry,
      gateMesh.geometry,
      gateSignMat,
      gateSign.geometry
    );
    gateGroup.add(gateFrame, gateBot, gateMesh, gateSign);

    // Keep player inside yard even when gate slides open by placing an outer road curb just past gate at Z = -21.2
    addBoxCollider(ctx, 'outer_road_bound', -11.0, 11.0, -21.5, -21.1);
    const truckGateCol = addBoxCollider(ctx, 'truck_gate_col', -4.25, 1.85, -20.08, -19.76, true);

    let gateSlideTargetX = -1.2;
    ctx.updaters.push({
      update: (dt) => {
        gateGroup.position.x = THREE.MathUtils.damp(gateGroup.position.x, gateSlideTargetX, 5.5, dt);
      },
    });

    registerInteractableBox(ctx, gateGroup, {
      id: 'sliding_truck_gate_toggle',
      title: 'Portail Coulissant Sécurité Quai',
      subtitle: 'Grillage Acier Galvanisé · Rail au Sol',
      kind: 'door_toggle',
      initialState: false,
      inspectText: 'Portail industriel autoportant en acier galvanisé sécurisant la cour logistique.',
      size: [6.0, 2.4, 0.35],
      position: [0, 1.25, 0],
      onToggle: (open) => {
        gateSlideTargetX = open ? 4.6 : -1.2;
        truckGateCol.enabled = !open;
      },
    });

    // --- Parked White Box Delivery Truck ("Camion de Livraison Frigorifique") at X = -1.2, Z = -17.35 ---
    buildBoxDeliveryTruck(ctx, yard, mats, texBank, -1.2, yardY, -17.35);

    // --- Dynamic 3D Restock Pallet Spawner on Rear Concrete Loading Dock (Triggered from Office PC Stocks_Entrepot.exe) ---
    const dockPalletsGroup = new THREE.Group();
    yard.add(dockPalletsGroup);

    const dockSlotsX = [-3.8, -2.4, -1.0, 0.4, 1.8];
    let spawnedPalletCount = 0;

    const spawnDockRestockPallet = (deptName: string) => {
      const slotIdx = spawnedPalletCount % dockSlotsX.length;
      const tier = Math.floor(spawnedPalletCount / dockSlotsX.length);
      spawnedPalletCount += 1;

      const px = dockSlotsX[slotIdx];
      const py = tier * 0.94;
      const pz = -13.86;

      const palletUnit = new THREE.Group();
      palletUnit.position.set(px, py, pz);
      dockPalletsGroup.add(palletUnit);

      // Wooden EUR pallet base
      const baseWood = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.14, 0.92), mats.rusticWood);
      baseWood.position.y = 0.07;
      baseWood.castShadow = true;
      baseWood.receiveShadow = true;
      palletUnit.add(baseWood);
      ctx.disposables.push(baseWood.geometry);

      // 4 stacked cardboard cartons (2x2x2)
      const cartonGeo = new THREE.BoxGeometry(0.46, 0.36, 0.38);
      ctx.disposables.push(cartonGeo);
      for (let bx = -0.25; bx <= 0.26; bx += 0.5) {
        for (let bz = -0.2; bz <= 0.21; bz += 0.4) {
          const cLow = new THREE.Mesh(cartonGeo, mats.cardboard);
          cLow.position.set(bx, 0.32, bz);
          const cHigh = new THREE.Mesh(cartonGeo, mats.cardboard);
          cHigh.position.set(bx, 0.69, bz);
          palletUnit.add(cLow, cHigh);
        }
      }

      // Frosted shrink-wrap film enclosing the load
      const wrapMesh = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.78, 0.86), mats.shrinkWrap);
      wrapMesh.position.y = 0.53;
      palletUnit.add(wrapMesh);
      ctx.disposables.push(wrapMesh.geometry);

      // Crisp printed 1990 logistics delivery slip label on front & back
      const labelCanvas = document.createElement('canvas');
      labelCanvas.width = 512;
      labelCanvas.height = 256;
      const lc = labelCanvas.getContext('2d')!;
      lc.fillStyle = '#f8fafc';
      lc.fillRect(0, 0, 512, 256);
      lc.fillStyle = '#1b365d';
      lc.fillRect(0, 0, 512, 54);
      lc.fillStyle = '#ffffff';
      lc.font = '800 24px "Plus Jakarta Sans", sans-serif';
      lc.fillText('CONTACT EXPRESS · LIVRAISON QUAI', 18, 36);
      lc.fillStyle = '#0f172a';
      lc.font = '800 28px "Plus Jakarta Sans", sans-serif';
      lc.fillText(deptName.toUpperCase(), 18, 112);
      lc.fillStyle = '#475569';
      lc.font = '600 20px "JetBrains Mono", monospace';
      lc.fillText(`PALETTE EUR #${String(spawnedPalletCount).padStart(3, '0')} · 19/11/1990`, 18, 158);
      lc.fillText('COMMANDE CONTACT-OS 90 · 150,00 F', 18, 194);
      // Barcode stripes
      lc.fillStyle = '#0f172a';
      for (let i = 0; i < 34; i++) {
        lc.fillRect(18 + i * 13, 208, i % 3 === 0 ? 6 : 3, 34);
      }
      const labelTex = new THREE.CanvasTexture(labelCanvas);
      labelTex.colorSpace = THREE.SRGBColorSpace;
      const labelMat = new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55 });
      const labelPlaneN = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.27), labelMat);
      labelPlaneN.position.set(0, 0.56, 0.436);
      const labelPlaneS = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.27), labelMat);
      labelPlaneS.rotation.y = Math.PI;
      labelPlaneS.position.set(0, 0.56, -0.436);
      palletUnit.add(labelPlaneN, labelPlaneS);
      ctx.disposables.push(labelTex, labelMat, labelPlaneN.geometry, labelPlaneS.geometry);
    };

    wallet.onPalletOrdered((deptName) => {
      spawnDockRestockPallet(deptName);
    });
  }
}

function buildBoxDeliveryTruck(
  ctx: WorldBuildContext,
  parent: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tx: number,
  ty: number,
  tz: number
): void {
  // Truck backed up to dock: Rear cargo doors near Z = -14.98, Cab facing North (-Z) toward gate!
  const truck = new THREE.Group();
  truck.position.set(tx, ty, tz);
  parent.add(truck);

  // Chassis frame rails
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.24, 4.9), mats.anthracite);
  chassis.position.set(0, 0.62, 0.15);

  // White Insulated Box Cargo Body (2.35m wide x 2.35m tall x 3.65m long, rear at +Z = +2.32 -> world Z = -15.03)
  const cargoBox = new THREE.Mesh(new THREE.BoxGeometry(2.34, 2.34, 3.65), mats.whiteMetal);
  cargoBox.position.set(0, 1.92, 0.5);
  cargoBox.castShadow = true;

  // Side livery signage ("CONTACT LOGISTIQUE FRAIS")
  const sideTex = texBank.createDepartmentSignTexture(
    'CONTACT LOGISTIQUE',
    'TRANSPORT FRIGORIFIQUE MULTI-TEMPÉRATURES',
    '#0f2942',
    '#10b981'
  );
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.3 });
  const liveryL = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.72), sideMat);
  liveryL.rotation.y = -Math.PI / 2;
  liveryL.position.set(-1.175, 2.15, 0.5);
  const liveryR = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 0.72), sideMat);
  liveryR.rotation.y = Math.PI / 2;
  liveryR.position.set(1.175, 2.15, 0.5);

  // Overhead Refrigeration Unit ("Groupe Frigo") above cab
  const reeferUnit = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.46, 0.42), mats.whiteMetal);
  reeferUnit.position.set(0, 2.75, -1.52);

  // Aerodynamic Cab at -Z end (facing -Z)
  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(2.16, 1.78, 1.48), mats.whiteMetal);
  cabBody.position.set(0, 1.56, -2.14);
  cabBody.castShadow = true;

  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 0.78), mats.anthracite);
  windshield.rotation.y = Math.PI;
  windshield.position.set(0, 1.88, -2.885);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.36, 0.22), mats.anthracite);
  frontBumper.position.set(0, 0.68, -2.86);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.42, 0.05), mats.anthracite);
  grille.position.set(0, 1.15, -2.89);

  // Toggleable Truck Headlights & Rear Marker Lights
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.1,
  });
  const hlGeo = new THREE.BoxGeometry(0.28, 0.16, 0.04);
  const hlL = new THREE.Mesh(hlGeo, headlightMat);
  hlL.position.set(-0.82, 0.74, -2.97);
  const hlR = new THREE.Mesh(hlGeo, headlightMat);
  hlR.position.set(0.82, 0.74, -2.97);

  const tlL = new THREE.Mesh(hlGeo, tailMat);
  tlL.position.set(-0.92, 0.68, 2.33);
  const tlR = new THREE.Mesh(hlGeo, tailMat);
  tlR.position.set(0.92, 0.68, 2.33);

  // Side mirrors
  [-1.16, 1.16].forEach((mx) => {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.16), mats.anthracite);
    mirror.position.set(mx, 1.88, -2.55);
    truck.add(mirror);
    ctx.disposables.push(mirror.geometry);
  });

  // 6 Heavy Rubber Wheels + Steel Rims
  const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.28, 18);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 12);
  ctx.disposables.push(
    chassis.geometry,
    cargoBox.geometry,
    sideMat,
    liveryL.geometry,
    liveryR.geometry,
    reeferUnit.geometry,
    cabBody.geometry,
    windshield.geometry,
    frontBumper.geometry,
    grille.geometry,
    headlightMat,
    tailMat,
    hlGeo,
    tireGeo,
    rimGeo
  );

  [
    [-0.98, -2.18],
    [0.98, -2.18],
    [-0.98, 1.25],
    [0.98, 1.25],
    [-0.98, 0.25],
    [0.98, 0.25],
  ].forEach(([wx, wz]) => {
    const tire = new THREE.Mesh(tireGeo, mats.rubberBlack);
    tire.rotation.z = Math.PI / 2;
    tire.position.set(wx, 0.46, wz);
    const rim = new THREE.Mesh(rimGeo, mats.galvanized);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(wx, 0.46, wz);
    truck.add(tire, rim);
  });

  truck.add(
    chassis,
    cargoBox,
    liveryL,
    liveryR,
    reeferUnit,
    cabBody,
    windshield,
    frontBumper,
    grille,
    hlL,
    hlR,
    tlL,
    tlR
  );

  addBoxCollider(ctx, 'delivery_truck_col', tx - 1.22, tx + 1.22, tz - 3.02, tz + 2.38);

  registerInteractableBox(ctx, truck, {
    id: 'delivery_truck_lights',
    title: 'Camion Frigorifique 12T — Contact Logistique',
    subtitle: 'Accosté aux Butoirs de Quai · Groupe Froid & Feux',
    kind: 'power_toggle',
    initialState: true,
    inspectText:
      'Porteur frigorifique 12 tonnes accosté au quai de déchargement avec caisse isotherme, groupe froid frontal et feux de position.',
    size: [2.4, 2.6, 5.3],
    position: [0, 1.4, -0.3],
    onToggle: (on) => {
      headlightMat.emissiveIntensity = on ? 1.5 : 0.0;
      tailMat.emissiveIntensity = on ? 1.1 : 0.05;
    },
  });
}
