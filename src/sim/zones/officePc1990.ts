import * as THREE from 'three';
import { MaterialLibrary } from '../materials';
import { INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { InteractableItem, WorldBuildContext } from '../types';
import { PlayerWallet } from '../wallet';
import {
  ORDER_CATALOG,
  ORDER_CATEGORIES,
  OrderCategory,
  OrderTerminalModel,
} from '../orderCatalog';

type OsStage = 'OFF' | 'NO_SIGNAL' | 'BIOS' | 'LOGIN' | 'DESKTOP';
type DesktopAppId = 'centrale' | 'compta' | 'stocks' | 'urssaf' | 'cctv' | null;

const ORDER_CAT_SHORT: Record<OrderCategory, string> = {
  'MATÉRIEL RAYON': 'Réglettes',
  'PRIMEUR (FRUITS & LÉGUMES)': 'Primeur',
  'BOULANGERIE (POINT CHAUD)': 'Boulangerie',
  'POINT CAFÉ & SNACKING CHAUD': 'Café/Chaud',
  'BOUCHERIE & CHARCUTERIE': 'Boucherie',
  'CRÉMERIE & FROMAGES': 'Crémerie',
  'SURGELÉS & GLACES': 'Surgelés',
  'ÉPICERIE SALÉE & PÂTES': 'Épic. Salée',
  'ÉPICERIE SUCRÉE & SNACKS': 'Épic. Sucrée',
  'CAVE À VINS & BIÈRES': 'Cave Vins',
  'HYGIÈNE & ENTRETIEN': 'Hygiène',
  ANIMALERIE: 'Animalerie',
  'SNACKING & BOISSONS FRAÎCHES': 'Snacking',
  'MANGA, BD & JEUX VIDÉO': 'Manga/Jeux',
};

function formatFrancsCents(cents: number): string {
  const francs = cents / 100;
  const intPart = Math.floor(francs)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decPart = String(Math.round(cents % 100)).padStart(2, '0');
  return `${intPart},${decPart} ₣`;
}

interface UiHitRect {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  onClick: () => void;
}

interface KeyCapAnim {
  mesh: THREE.Mesh;
  restY: number;
  pressDepth: number;
  pressTimer: number;
}

interface CctvCameraPreset {
  id: number;
  code: string;
  name: string;
  pos: [number, number, number];
  lookAt: [number, number, number];
}

const CCTV_PRESETS: CctvCameraPreset[] = [
  {
    id: 0,
    code: 'CAM 01',
    name: 'CAISSES 1 & 2',
    pos: [-1.1, 3.35, 6.05],
    lookAt: [-3.9, 1.05, 4.35],
  },
  {
    id: 1,
    code: 'CAM 02',
    name: 'RAYON MANGA / JEUX',
    pos: [-5.4, 3.35, 2.05],
    lookAt: [-8.9, 1.1, 5.1],
  },
  {
    id: 2,
    code: 'CAM 03',
    name: 'BOUCHERIE & TRAITEUR',
    pos: [1.6, 3.35, -3.55],
    lookAt: [5.9, 1.05, -6.15],
  },
  {
    id: 3,
    code: 'CAM 04',
    name: 'ENTREPÔT & QUAI GRILLAGÉ',
    pos: [-4.6, 3.2, -16.85],
    lookAt: [-0.8, 0.45, -13.65],
  },
];

const PC_PRESS_COOLDOWN_MS = 320;
const CRT_W = 1024;
const CRT_H = 768;

function formatFr(amount: number): string {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const intStr = Math.floor(abs)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decStr = Math.round((abs - Math.floor(abs)) * 100)
    .toString()
    .padStart(2, '0');
  return `${neg ? '-' : ''}${intStr},${decStr} F`;
}

function formatFrInt(amount: number): string {
  return `${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F`;
}

export function buildOfficeWorkstation1990(
  ctx: WorldBuildContext,
  deskGroup: THREE.Group,
  officeGroup: THREE.Group,
  mats: MaterialLibrary,
  wallet: PlayerWallet,
  orderModel: OrderTerminalModel,
  renderer: THREE.WebGLRenderer,
  onWalletChanged: () => void,
  isSeatedAtDesk: () => boolean,
  setSeatedAtDesk: (seated: boolean) => void
): void {
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyMat);

  // Workstation root sits cleanly on top of the Oak Manager's Desk (top at Y = 0.785)
  // Rotated -PI/2 around Y so local +Z faces world -X (directly toward seated player at X = 7.48!)
  // Local -X = Player's LEFT (Tower), Local +X = Player's RIGHT (Mousepad + Mouse)
  const ws = new THREE.Group();
  ws.position.set(0, 0.785, 0);
  ws.rotation.y = -Math.PI / 2;
  deskGroup.add(ws);

  // ============================================================================
  // 1. SOBER 1990 BEIGE HARDWARE MATERIALS (ZERO NEON)
  // ============================================================================
  const beigePlastic = new THREE.MeshStandardMaterial({
    color: 0xd8d2c3,
    roughness: 0.62,
    metalness: 0.06,
  });
  const beigeDark = new THREE.MeshStandardMaterial({
    color: 0xbcb5a4,
    roughness: 0.68,
    metalness: 0.08,
  });
  const beigeKey = new THREE.MeshStandardMaterial({
    color: 0xe6e1d3,
    roughness: 0.56,
    metalness: 0.04,
  });
  const beigeModKey = new THREE.MeshStandardMaterial({
    color: 0xc2bba9,
    roughness: 0.6,
    metalness: 0.05,
  });
  const darkBezelRecess = new THREE.MeshStandardMaterial({
    color: 0x1b1f24,
    roughness: 0.75,
    metalness: 0.12,
  });
  const mousepadMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    metalness: 0.0,
  });
  const towerPowerLedMat = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    emissive: 0x16a34a,
    emissiveIntensity: 0.0,
    roughness: 0.3,
  });
  const towerHddLedMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    emissive: 0xd97706,
    emissiveIntensity: 0.0,
    roughness: 0.3,
  });
  const monitorPowerLedMat = new THREE.MeshStandardMaterial({
    color: 0x14532d,
    emissive: 0x16a34a,
    emissiveIntensity: 0.0,
    roughness: 0.3,
  });

  ctx.disposables.push(
    beigePlastic,
    beigeDark,
    beigeKey,
    beigeModKey,
    darkBezelRecess,
    mousepadMat,
    towerPowerLedMat,
    towerHddLedMat,
    monitorPowerLedMat
  );

  // ============================================================================
  // 2. WORKSTATION & OS STATE + STRICT 320ms SINGLE-PRESS DEBOUNCE
  // ============================================================================
  let pcTowerOn = false;
  let crtMonitorOn = false;
  let osStage: OsStage = 'OFF';
  let bootProgress = 0; // 0..1 over ~2.6s
  let degaussTimer = 0;
  let hddActivityTimer = 0;
  let passwordInput = '';
  let loginError = '';
  let activeApp: DesktopAppId = null;
  let selectedStockDeptId = wallet.getDepartmentStocks()[10]?.id ?? 'manga';
  let selectedOrderCat: OrderCategory = 'MATÉRIEL RAYON';
  let orderPage = 0;
  let activeCctvIdx = 0;
  let statusBanner = '';
  let statusBannerTimer = 0;

  // Virtual OS cursor (pixels on 1024x768 CRT canvas)
  let cursorX = CRT_W * 0.5;
  let cursorY = CRT_H * 0.5;
  let mouseTargetX = 0;
  let mouseTargetZ = 0;
  let mouseLeftPressTimer = 0;
  let towerBtnAnim = 0;
  let monitorBtnAnim = 0;

  let crtDirty = true;
  let lastClockSec = -1;
  let lastHitRects: UiHitRect[] = [];
  let hoveredRectLabel = '';

  let pcLastPressTime = 0;
  const acquirePcPressLock = (): boolean => {
    const now = performance.now();
    if (now - pcLastPressTime < PC_PRESS_COOLDOWN_MS) return false;
    pcLastPressTime = now;
    return true;
  };

  const triggerHddActivity = (duration = 0.45) => {
    hddActivityTimer = Math.max(hddActivityTimer, duration);
    if (pcTowerOn) {
      soundSynth.playHddSeek();
    }
  };

  const showStatus = (msg: string) => {
    statusBanner = msg;
    statusBannerTimer = 3.6;
    crtDirty = true;
  };

  wallet.subscribe(() => {
    crtDirty = true;
  });
  orderModel.onChange(() => {
    crtDirty = true;
  });

  // Helper: register a clickable Layer-1 interactable box attached to a parent group
  const addInteractiveHitbox = (
    parent: THREE.Object3D,
    opts: {
      id: string;
      size: [number, number, number];
      pos: [number, number, number];
      rotX?: number;
      title: string;
      subtitle: string;
      verb: () => string;
      dynamicTitle?: () => string;
      onInteract?: () => void;
      onHoverUv?: (uv: THREE.Vector2) => void;
      onInteractUv?: (uv: THREE.Vector2) => void;
      usePlane?: boolean;
    }
  ): THREE.Mesh => {
    const geo = opts.usePlane
      ? new THREE.PlaneGeometry(opts.size[0], opts.size[1])
      : new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
    ctx.disposables.push(geo);
    const proxy = new THREE.Mesh(geo, proxyMat);
    proxy.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    if (opts.rotX) proxy.rotation.x = opts.rotX;
    proxy.layers.set(INTERACT_LAYER);
    parent.add(proxy);

    const item: InteractableItem = {
      id: opts.id,
      title: opts.title,
      subtitle: opts.subtitle,
      kind: 'diegetic_action',
      state: false,
      inspectText: opts.subtitle,
      proxyMesh: proxy,
      dynamicVerb: opts.verb,
      dynamicTitle: opts.dynamicTitle,
      onInteract: opts.onInteract,
      onHoverUv: opts.onHoverUv,
      onInteractUv: opts.onInteractUv,
    };
    proxy.userData.interactable = item;
    ctx.interactables.push(item);
    return proxy;
  };

  // ============================================================================
  // 3. LIVE 4-CHANNEL CCTV WEBGL RENDER-TO-TEXTURE (THROTTLED 4 Hz, ZERO LAG)
  // ============================================================================
  const CCTV_W = 256;
  const CCTV_H = 160;
  const cctvCamera = new THREE.PerspectiveCamera(60, CCTV_W / CCTV_H, 0.15, 42);
  cctvCamera.layers.enable(0);
  cctvCamera.layers.disable(INTERACT_LAYER);

  const cctvTarget = ctx.isSoftwareGl
    ? null
    : new THREE.WebGLRenderTarget(CCTV_W, CCTV_H, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        depthBuffer: true,
      });
  if (cctvTarget) ctx.disposables.push(cctvTarget);

  const cctvPixelBuf = cctvTarget ? new Uint8Array(CCTV_W * CCTV_H * 4) : null;
  const cctvCanvas = document.createElement('canvas');
  cctvCanvas.width = CCTV_W;
  cctvCanvas.height = CCTV_H;
  const cctvCtx = cctvCanvas.getContext('2d')!;
  const cctvImgData = cctvCtx.createImageData(CCTV_W, CCTV_H);
  let lastCctvCaptureTime = 0;

  const captureLiveCctvFrame = () => {
    const preset = CCTV_PRESETS[activeCctvIdx] ?? CCTV_PRESETS[0];
    if (cctvTarget && cctvPixelBuf && !ctx.isSoftwareGl) {
      cctvCamera.position.set(preset.pos[0], preset.pos[1], preset.pos[2]);
      cctvCamera.lookAt(preset.lookAt[0], preset.lookAt[1], preset.lookAt[2]);
      cctvCamera.updateMatrixWorld();

      const prevTarget = renderer.getRenderTarget();
      const prevShadow = renderer.shadowMap.enabled;
      renderer.shadowMap.enabled = false;
      renderer.setRenderTarget(cctvTarget);
      renderer.clear();
      renderer.render(ctx.scene, cctvCamera);
      renderer.readRenderTargetPixels(cctvTarget, 0, 0, CCTV_W, CCTV_H, cctvPixelBuf);
      renderer.setRenderTarget(prevTarget);
      renderer.shadowMap.enabled = prevShadow;

      // Flip Y and apply subtle 1990 low-saturation CCTV security monitor tint
      const dst = cctvImgData.data;
      for (let y = 0; y < CCTV_H; y++) {
        const srcRow = (CCTV_H - 1 - y) * CCTV_W * 4;
        const dstRow = y * CCTV_W * 4;
        for (let x = 0; x < CCTV_W; x++) {
          const si = srcRow + x * 4;
          const di = dstRow + x * 4;
          const r = cctvPixelBuf[si];
          const g = cctvPixelBuf[si + 1];
          const b = cctvPixelBuf[si + 2];
          const lum = r * 0.299 + g * 0.587 + b * 0.114;
          // 65% grayscale + 35% muted color with slight cool phosphor balance
          dst[di] = Math.min(255, lum * 0.65 + r * 0.32);
          dst[di + 1] = Math.min(255, lum * 0.68 + g * 0.34);
          dst[di + 2] = Math.min(255, lum * 0.64 + b * 0.35);
          dst[di + 3] = 255;
        }
      }
      cctvCtx.putImageData(cctvImgData, 0, 0);
    } else {
      // Crisp schematic CCTV fallback when running on Software WebGL
      cctvCtx.fillStyle = '#141c24';
      cctvCtx.fillRect(0, 0, CCTV_W, CCTV_H);
      cctvCtx.strokeStyle = '#334155';
      cctvCtx.lineWidth = 1;
      for (let gx = 16; gx < CCTV_W; gx += 32) {
        cctvCtx.beginPath();
        cctvCtx.moveTo(gx, 0);
        cctvCtx.lineTo(gx, CCTV_H);
        cctvCtx.stroke();
      }
      for (let gy = 16; gy < CCTV_H; gy += 32) {
        cctvCtx.beginPath();
        cctvCtx.moveTo(0, gy);
        cctvCtx.lineTo(CCTV_W, gy);
        cctvCtx.stroke();
      }
      cctvCtx.fillStyle = '#cbd5e1';
      cctvCtx.font = '700 14px monospace';
      cctvCtx.fillText(`${preset.code} — ${preset.name}`, 14, 72);
      cctvCtx.fillStyle = '#94a3b8';
      cctvCtx.font = '600 11px monospace';
      cctvCtx.fillText('SIGNAL VIDÉO COAXIAL ACTIF', 14, 96);
    }
    crtDirty = true;
  };

  // ============================================================================
  // 4. OS POWER STATE TRANSITIONS & INPUT HANDLERS
  // ============================================================================
  const syncOsPowerState = (justPoweredDisplayOn: boolean) => {
    if (!crtMonitorOn) {
      osStage = 'OFF';
      crtDirty = true;
      return;
    }
    if (!pcTowerOn) {
      osStage = 'NO_SIGNAL';
      crtDirty = true;
      return;
    }
    if (justPoweredDisplayOn || osStage === 'OFF' || osStage === 'NO_SIGNAL') {
      degaussTimer = 0.42;
      soundSynth.playCrtDegauss();
      if (bootProgress < 1) {
        osStage = 'BIOS';
        triggerHddActivity(1.4);
      } else {
        osStage = activeApp !== null ? 'DESKTOP' : 'LOGIN';
      }
      crtDirty = true;
    }
  };

  const togglePcTowerPower = () => {
    if (!acquirePcPressLock()) return;
    towerBtnAnim = 1.0;
    pcTowerOn = !pcTowerOn;
    soundSynth.playMechanicalButtonClick();
    soundSynth.setPcFanHum(pcTowerOn);

    if (pcTowerOn) {
      bootProgress = 0;
      passwordInput = '';
      loginError = '';
      activeApp = null;
      triggerHddActivity(1.8);
      if (crtMonitorOn) {
        osStage = 'BIOS';
        degaussTimer = 0.35;
        soundSynth.playCrtDegauss();
      }
    } else {
      bootProgress = 0;
      passwordInput = '';
      loginError = '';
      activeApp = null;
      osStage = crtMonitorOn ? 'NO_SIGNAL' : 'OFF';
    }
    crtDirty = true;
  };

  const toggleCrtMonitorPower = () => {
    if (!acquirePcPressLock()) return;
    monitorBtnAnim = 1.0;
    crtMonitorOn = !crtMonitorOn;
    soundSynth.playMechanicalButtonClick();
    syncOsPowerState(crtMonitorOn);
  };

  const submitLoginPassword = () => {
    if (passwordInput === '1234') {
      loginError = '';
      osStage = 'DESKTOP';
      triggerHddActivity(0.75);
      soundSynth.playPcBiosBeep();
      showStatus('SESSION GÉRANT OUVERTE · CONTACT-OS 90');
    } else {
      loginError = 'MOT DE PASSE INCORRECT (INDICE POST-IT : 1234)';
      passwordInput = '';
      soundSynth.playAtmPiezo('error');
    }
    crtDirty = true;
  };

  const handleOsKeyInput = (keyCode: string) => {
    if (!pcTowerOn || !crtMonitorOn) return;
    if (osStage === 'LOGIN') {
      if (keyCode === 'ENTER') {
        submitLoginPassword();
        return;
      }
      if (keyCode === 'BACKSPACE') {
        passwordInput = passwordInput.slice(0, -1);
        loginError = '';
        crtDirty = true;
        return;
      }
      if (keyCode === 'ESC') {
        passwordInput = '';
        loginError = '';
        crtDirty = true;
        return;
      }
      if (keyCode.length === 1 && passwordInput.length < 8) {
        passwordInput += keyCode;
        loginError = '';
        crtDirty = true;
        if (passwordInput === '1234') {
          // Convenience: wait for ENTER or let user press VALIDER — keep authentic manual submit, or show hint
          crtDirty = true;
        }
      }
    } else if (osStage === 'DESKTOP') {
      if (keyCode === 'ESC' && activeApp !== null) {
        activeApp = null;
        crtDirty = true;
      } else if (activeApp === 'cctv') {
        if (keyCode === '1') {
          activeCctvIdx = 0;
          captureLiveCctvFrame();
        } else if (keyCode === '2') {
          activeCctvIdx = 1;
          captureLiveCctvFrame();
        } else if (keyCode === '3') {
          activeCctvIdx = 2;
          captureLiveCctvFrame();
        } else if (keyCode === '4') {
          activeCctvIdx = 3;
          captureLiveCctvFrame();
        }
      }
    }
  };

  // ============================================================================
  // 5. CONTACT-OS 90 CANVAS RENDERER (1024x768 SHARP RECTANGULAR 4:3 CRT)
  // ============================================================================
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = CRT_W;
  crtCanvas.height = CRT_H;
  const crtTex = new THREE.CanvasTexture(crtCanvas);
  crtTex.colorSpace = THREE.SRGBColorSpace;
  crtTex.anisotropy = ctx.maxAnisotropy;
  ctx.disposables.push(crtTex);

  const drawBevelBox = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    fill = '#d4d0c8',
    pressed = false
  ) => {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    c.fillStyle = pressed ? '#52525b' : '#ffffff';
    c.fillRect(x, y, w, 3);
    c.fillRect(x, y, 3, h);
    c.fillStyle = pressed ? '#ffffff' : '#52525b';
    c.fillRect(x, y + h - 3, w, 3);
    c.fillRect(x + w - 3, y, 3, h);
  };

  const renderCrtCanvas = (elapsed: number) => {
    const c = crtCanvas.getContext('2d')!;
    const hitRects: UiHitRect[] = [];

    const addButton = (
      id: string,
      label: string,
      x: number,
      y: number,
      w: number,
      h: number,
      onClick: () => void,
      opts?: { fill?: string; textColor?: string; font?: string; active?: boolean }
    ) => {
      const hovered =
        cursorX >= x && cursorX <= x + w && cursorY >= y && cursorY <= y + h;
      const fill = opts?.active
        ? '#1b365d'
        : hovered
          ? '#e5e2db'
          : (opts?.fill ?? '#d4d0c8');
      drawBevelBox(c, x, y, w, h, fill, false);
      if (hovered) {
        c.strokeStyle = '#1b365d';
        c.lineWidth = 2;
        c.strokeRect(x + 4, y + 4, w - 8, h - 8);
      }
      c.fillStyle = opts?.active ? '#f8fafc' : (opts?.textColor ?? '#0f172a');
      c.font = opts?.font ?? '700 22px "Plus Jakarta Sans", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(label, x + w / 2, y + h / 2 + 1);
      hitRects.push({ id, label, x, y, w, h, onClick });
    };

    // 1. OFF / NO SIGNAL
    if (osStage === 'OFF') {
      c.fillStyle = '#0c1014';
      c.fillRect(0, 0, CRT_W, CRT_H);
      lastHitRects = [];
      hoveredRectLabel = '';
      crtTex.needsUpdate = true;
      return;
    }

    if (osStage === 'NO_SIGNAL') {
      c.fillStyle = '#0f1318';
      c.fillRect(0, 0, CRT_W, CRT_H);
      c.strokeStyle = '#475569';
      c.lineWidth = 3;
      c.strokeRect(272, 314, 480, 140);
      c.fillStyle = '#e2e8f0';
      c.font = '700 28px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('MONITEUR ALLUMÉ', CRT_W / 2, 360);
      c.fillStyle = '#fbbf24';
      c.font = '600 22px "JetBrains Mono", monospace';
      c.fillText('ALLUMEZ LA TOUR PC À GAUCHE', CRT_W / 2, 412);
      lastHitRects = [];
      hoveredRectLabel = '';
      crtTex.needsUpdate = true;
      return;
    }

    // 2. BIOS BOOT SEQUENCE (640 Ko OK - CONTACT-OS 90)
    if (osStage === 'BIOS') {
      c.fillStyle = '#0b0d10';
      c.fillRect(0, 0, CRT_W, CRT_H);
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';

      c.fillStyle = '#f8fafc';
      c.font = '700 26px "JetBrains Mono", monospace';
      c.fillText('CONTACT-BIOS v1.90  (C) 1990 CONTACT INFORMATIQUE FRANCE', 48, 76);
      c.fillStyle = '#94a3b8';
      c.font = '600 22px "JetBrains Mono", monospace';
      c.fillText('PROCESSEUR : 80386DX-25 MHz  ·  COPROCESSEUR 80387 PRÉSENT', 48, 122);

      const ramKo = Math.min(640, Math.floor(bootProgress * 1150));
      c.fillStyle = '#e2e8f0';
      c.fillText(
        `TEST MÉMOIRE DE BASE : ${String(ramKo).padStart(3, '0')} Ko ${ramKo >= 640 ? 'OK' : '...'}`,
        48,
        186
      );

      if (bootProgress > 0.35) {
        c.fillText('MÉMOIRE ÉTENDUE      : 3 072 Ko OK', 48, 228);
        c.fillText('DISQUE DUR C:        : CONNER CP3044 40 Mo  [PRÊT]', 48, 270);
        c.fillText('LECTEUR A:           : 3,5" 1,44 Mo         [PRÊT]', 48, 312);
        c.fillText('CARTE RÉSEAU CAISSES : LIEN CAISSE 1 & 2    [CONNECTÉ]', 48, 354);
      }

      if (bootProgress > 0.55) {
        c.fillStyle = '#fde68a';
        c.font = '700 26px "JetBrains Mono", monospace';
        c.fillText('640 Ko OK - DÉMARRAGE DE CONTACT-OS 90...', 48, 446);

        // Classic segmented BIOS loading bar
        c.strokeStyle = '#cbd5e1';
        c.lineWidth = 3;
        c.strokeRect(48, 480, 928, 46);
        const barFrac = THREE.MathUtils.clamp((bootProgress - 0.55) / 0.45, 0, 1);
        const segs = Math.floor(barFrac * 24);
        c.fillStyle = '#cbd5e1';
        for (let i = 0; i < segs; i++) {
          c.fillRect(58 + i * 38, 490, 30, 26);
        }
      }

      c.fillStyle = '#64748b';
      c.font = '600 18px "JetBrains Mono", monospace';
      c.fillText('SYSTEME D’EXPLOITATION DE GESTION SUPERMARCHÉ · NOVEMBRE 1990', 48, 718);

      // Subtle degauss horizontal brightness flash during first 0.4s
      if (degaussTimer > 0) {
        c.fillStyle = `rgba(255, 255, 255, ${(degaussTimer / 0.42) * 0.45})`;
        c.fillRect(0, 0, CRT_W, CRT_H);
      }

      lastHitRects = [];
      hoveredRectLabel = '';
      crtTex.needsUpdate = true;
      return;
    }

    // 3. SOBER 1990 DESKTOP BACKDROP (Teal-Slate #2b5868)
    c.fillStyle = '#2b5868';
    c.fillRect(0, 0, CRT_W, CRT_H);

    // Subtle 1990 tiled grid texture
    c.fillStyle = 'rgba(255,255,255,0.03)';
    for (let y = 0; y < CRT_H; y += 8) {
      c.fillRect(0, y, CRT_W, 1);
    }

    // 4. LOGIN SCREEN (Password "1234" — via 3D keyboard OR clickable on-screen keypad)
    if (osStage === 'LOGIN') {
      const wx = 182;
      const wy = 92;
      const ww = 660;
      const wh = 584;
      drawBevelBox(c, wx, wy, ww, wh, '#d4d0c8');

      // Title bar
      c.fillStyle = '#1b365d';
      c.fillRect(wx + 6, wy + 6, ww - 12, 48);
      c.fillStyle = '#ffffff';
      c.font = '700 24px "Plus Jakarta Sans", sans-serif';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('CONTACT-OS 90  —  OUVERTURE DE SESSION', wx + 22, wy + 30);

      c.fillStyle = '#0f172a';
      c.font = '700 24px "Plus Jakarta Sans", sans-serif';
      c.textAlign = 'center';
      c.fillText('POSTE DU GÉRANT · CONTACT EXPRESS 3D', CRT_W / 2, wy + 92);

      c.fillStyle = '#334155';
      c.font = '600 19px "JetBrains Mono", monospace';
      c.fillText('SAISISSEZ LE CODE SUR LE CLAVIER 3D OU CI-DESSOUS', CRT_W / 2, wy + 128);

      // Password input box
      drawBevelBox(c, wx + 130, wy + 152, 400, 56, '#ffffff', true);
      const masked = '* '.repeat(passwordInput.length).trim();
      const blinkCaret = Math.floor(elapsed * 2) % 2 === 0 ? '_' : '';
      c.fillStyle = '#0f172a';
      c.font = '700 32px "JetBrains Mono", monospace';
      c.fillText(masked + (passwordInput.length < 8 ? blinkCaret : ''), CRT_W / 2, wy + 181);

      if (loginError) {
        c.fillStyle = '#991b1b';
        c.font = '700 18px "Plus Jakarta Sans", sans-serif';
        c.fillText(loginError, CRT_W / 2, wy + 228);
      } else {
        c.fillStyle = '#475569';
        c.font = '600 17px "JetBrains Mono", monospace';
        c.fillText('MOT DE PASSE (POST-IT SUR ÉCRAN) : 1234', CRT_W / 2, wy + 228);
      }

      // Large on-screen numeric keypad for effortless mouse/reticle login on iPhone 16e
      const padDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'EFF.', '0', 'OK'];
      const padStartX = wx + 136;
      const padStartY = wy + 254;
      const btnW = 120;
      const btnH = 68;
      const gapX = 14;
      const gapY = 12;

      padDigits.forEach((d, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const bx = padStartX + col * (btnW + gapX);
        const by = padStartY + row * (btnH + gapY);
        if (d === 'EFF.') {
          addButton('login_clear', 'EFF.', bx, by, btnW, btnH, () => handleOsKeyInput('BACKSPACE'), {
            fill: '#e2d7c5',
          });
        } else if (d === 'OK') {
          addButton('login_ok', 'VALIDER', bx, by, btnW, btnH, () => submitLoginPassword(), {
            fill: '#1b365d',
            textColor: '#ffffff',
          });
        } else {
          addButton(`login_${d}`, d, bx, by, btnW, btnH, () => handleOsKeyInput(d), {
            font: '800 28px "JetBrains Mono", monospace',
          });
        }
      });
    }

    // 5. DESKTOP & 4 MANAGEMENT APPS
    if (osStage === 'DESKTOP') {
      // Top Desktop Bar
      drawBevelBox(c, 0, 0, CRT_W, 52, '#d4d0c8');
      addButton('btn_lock', 'VERROUILLER', 10, 8, 168, 36, () => {
        osStage = 'LOGIN';
        passwordInput = '';
        activeApp = null;
        crtDirty = true;
      }, { font: '700 18px "Plus Jakarta Sans", sans-serif' });

      c.fillStyle = '#0f172a';
      c.font = '700 20px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('CONTACT-OS 90 · GESTION MAGASIN', CRT_W / 2 - 20, 26);

      // Authentic 1990 Clock
      const secs = Math.floor(elapsed) % 60;
      const mins = (32 + Math.floor(elapsed / 60)) % 60;
      const clockText = `NOVEMBRE 1990  14:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      drawBevelBox(c, CRT_W - 318, 8, 308, 36, '#cbd5e1', true);
      c.fillStyle = '#0f172a';
      c.font = '700 18px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(clockText, CRT_W - 164, 27);

      // 5 Large Desktop Application Icons (CENTRALE-ACHAT 90 + 4 management apps)
      const icons: Array<{
        id: DesktopAppId;
        title: string;
        sub: string;
        badge: string;
        accent: string;
      }> = [
        {
          id: 'centrale',
          title: 'CENTRALE-ACHAT 90',
          sub: 'Commandes Fournisseurs · 11 Rayons',
          badge: 'ACHAT',
          accent: '#0f766e',
        },
        {
          id: 'compta',
          title: 'Compta_Contact.exe',
          sub: 'Recettes Caisses & Trésorerie',
          badge: 'FRF',
          accent: '#1b365d',
        },
        {
          id: 'stocks',
          title: 'Stocks_Entrepot.exe',
          sub: 'Suivi Stocks & Palettes Quai',
          badge: 'STK',
          accent: '#9a3412',
        },
        {
          id: 'urssaf',
          title: 'URSSAF_Declar.exe',
          sub: 'Cotisations & TVA 18,6 % (1990)',
          badge: 'TVA',
          accent: '#166534',
        },
        {
          id: 'cctv',
          title: 'Videosurveill.exe',
          sub: 'Contrôle 4 Caméras en Direct',
          badge: 'CAM',
          accent: '#334155',
        },
      ];

      if (activeApp === null) {
        // 3 icons on top row + 2 centered icons on bottom row (large touch-friendly targets)
        const iw = 296;
        const ih = 226;
        const gapX = 24;
        const topRowStartX = Math.round((CRT_W - (iw * 3 + gapX * 2)) / 2);
        const botRowStartX = Math.round((CRT_W - (iw * 2 + gapX)) / 2);

        icons.forEach((ic, idx) => {
          const isTop = idx < 3;
          const col = isTop ? idx : idx - 3;
          const ix = (isTop ? topRowStartX : botRowStartX) + col * (iw + gapX);
          const iy = isTop ? 104 : 362;
          const hovered =
            cursorX >= ix && cursorX <= ix + iw && cursorY >= iy && cursorY <= iy + ih;

          drawBevelBox(c, ix, iy, iw, ih, hovered ? '#ece9e2' : '#d4d0c8');
          if (hovered) {
            c.strokeStyle = '#1b365d';
            c.lineWidth = 3;
            c.strokeRect(ix + 5, iy + 5, iw - 10, ih - 10);
          }

          // Program emblem square
          const embW = 136;
          const embH = 92;
          const embX = ix + Math.round((iw - embW) / 2);
          c.fillStyle = ic.accent;
          c.fillRect(embX, iy + 22, embW, embH);
          c.strokeStyle = '#f8fafc';
          c.lineWidth = 3;
          c.strokeRect(embX + 6, iy + 28, embW - 12, embH - 12);
          c.fillStyle = '#f8fafc';
          c.font = ic.badge.length > 3
            ? '800 32px "JetBrains Mono", monospace'
            : '800 38px "JetBrains Mono", monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(ic.badge, ix + iw / 2, iy + 68);

          // Live cart count badge on CENTRALE-ACHAT 90 icon
          if (ic.id === 'centrale') {
            const cartCount = orderModel.getTotalCartons();
            if (cartCount > 0) {
              c.fillStyle = '#b91c1c';
              c.fillRect(embX + embW - 40, iy + 14, 48, 28);
              c.fillStyle = '#ffffff';
              c.font = '800 17px "JetBrains Mono", monospace';
              c.fillText(`×${cartCount}`, embX + embW - 16, iy + 29);
            }
          }

          // Program label
          c.fillStyle = '#0f172a';
          c.font = '800 20px "JetBrains Mono", monospace';
          c.fillText(ic.title, ix + iw / 2, iy + 146);
          c.fillStyle = '#334155';
          c.font = '600 14px "Plus Jakarta Sans", sans-serif';
          c.fillText(ic.sub, ix + iw / 2, iy + 174);
          c.fillStyle = '#64748b';
          c.font = '700 13px "JetBrains Mono", monospace';
          c.fillText('CLIC GAUCHE POUR OUVRIR', ix + iw / 2, iy + 202);

          hitRects.push({
            id: `open_${ic.id}`,
            label: `OUVRIR ${ic.title}`,
            x: ix,
            y: iy,
            w: iw,
            h: ih,
            onClick: () => {
              activeApp = ic.id;
              triggerHddActivity(0.5);
              if (ic.id === 'cctv') {
                captureLiveCctvFrame();
              }
              crtDirty = true;
            },
          });
        });

        // Bottom quick summary bar
        const cartCartons = orderModel.getTotalCartons();
        drawBevelBox(c, 34, CRT_H - 96, CRT_W - 68, 66, '#d4d0c8');
        c.fillStyle = '#0f172a';
        c.font = '700 19px "JetBrains Mono", monospace';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(
          `BANQUE : ${formatFr(wallet.getBankBalance())}  |  CAISSES : ${formatFrInt(wallet.getStoreRevenue())}  |  CENTRALE : ${cartCartons} cart.`,
          54,
          CRT_H - 63
        );
      } else {
        // ACTIVE APPLICATION WINDOW CHROME
        const wx = 26;
        const wy = 66;
        const ww = CRT_W - 52;
        const wh = CRT_H - 86;
        drawBevelBox(c, wx, wy, ww, wh, '#d4d0c8');

        const titleMap: Record<Exclude<DesktopAppId, null>, string> = {
          centrale: 'CENTRALE-ACHAT 90 — Commandes Fournisseurs (11 Rayons)',
          compta: 'Compta_Contact.exe  —  COMPTABILITÉ & TRÉSORERIE (FRF)',
          stocks: 'Stocks_Entrepot.exe  —  STOCKS DES 11 RAYONS & QUAI',
          urssaf: 'URSSAF_Declarations.exe  —  COTISATIONS & TVA 18,6 % (1990)',
          cctv: 'Videosurveillance.exe  —  CONTRÔLE 4 CAMÉRAS EN DIRECT',
        };

        // Navy Window Title Bar
        c.fillStyle = activeApp === 'centrale' ? '#0f4c5c' : '#1b365d';
        c.fillRect(wx + 6, wy + 6, ww - 12, 52);
        c.fillStyle = '#ffffff';
        c.font = '700 22px "Plus Jakarta Sans", sans-serif';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.fillText(titleMap[activeApp], wx + 22, wy + 32);

        // Extra-large, legible [ X ] Close Button (68x42px for easy mobile aiming)
        addButton(
          'win_close',
          'X',
          wx + ww - 80,
          wy + 11,
          68,
          42,
          () => {
            activeApp = null;
            crtDirty = true;
          },
          { fill: '#b91c1c', textColor: '#ffffff', font: '800 26px "JetBrains Mono", monospace' }
        );

        const cx = wx + 22;
        const cy = wy + 70;
        const cw = ww - 44;

        // ---------------- APP 0: CENTRALE-ACHAT 90 — Commandes Fournisseurs ----------------
        if (activeApp === 'centrale') {
          // 1. 14 Department & Supply Category Tabs (2 rows × 7 tabs)
          const tabsPerRow = 7;
          const tabGapX = 6;
          const tabGapY = 6;
          const tabW = Math.floor((cw - tabGapX * (tabsPerRow - 1)) / tabsPerRow);
          const tabH = 35;

          ORDER_CATEGORIES.forEach((cat, idx) => {
            const col = idx % tabsPerRow;
            const row = Math.floor(idx / tabsPerRow);
            const tx = cx + col * (tabW + tabGapX);
            const ty = cy + row * (tabH + tabGapY);
            const isActive = cat === selectedOrderCat;

            let catQty = 0;
            for (const d of ORDER_CATALOG) {
              if (d.category === cat) catQty += orderModel.getQty(d.id);
            }
            const shortLbl = ORDER_CAT_SHORT[cat];
            const btnLabel = catQty > 0 ? `${shortLbl} (${catQty})` : shortLbl;

            addButton(
              `cat_tab_${idx}`,
              btnLabel,
              tx,
              ty,
              tabW,
              tabH,
              () => {
                selectedOrderCat = cat;
                orderPage = 0;
                soundSynth.playAtmPiezo('digit');
                crtDirty = true;
              },
              {
                active: isActive,
                fill: catQty > 0 ? '#fef3c7' : '#d4d0c8',
                textColor: catQty > 0 ? '#92400e' : '#0f172a',
                font: '700 14px "Plus Jakarta Sans", sans-serif',
              }
            );
          });

          // 2. Filtered Catalog Table (6 rows/page, high-contrast 1990 Windows 98 ledger)
          const catItems = ORDER_CATALOG.filter((d) => d.category === selectedOrderCat);
          const rowsPerPage = 6;
          const totalPages = Math.max(1, Math.ceil(catItems.length / rowsPerPage));
          if (orderPage >= totalPages) orderPage = totalPages - 1;
          const pageItems = catItems.slice(
            orderPage * rowsPerPage,
            orderPage * rowsPerPage + rowsPerPage
          );

          const tblY = cy + 84;
          const tblH = 352;
          drawBevelBox(c, cx, tblY, cw, tblH, '#ffffff', true);

          // Table column headers
          c.fillStyle = '#0f4c5c';
          c.fillRect(cx + 4, tblY + 4, cw - 8, 34);
          c.fillStyle = '#ffffff';
          c.font = '700 15px "JetBrains Mono", monospace';
          c.textBaseline = 'middle';
          c.textAlign = 'left';
          c.fillText(`CATÉGORIE : ${selectedOrderCat}`, cx + 14, tblY + 21);
          c.textAlign = 'center';
          c.fillText('CODE EAN', cx + 455, tblY + 21);
          c.textAlign = 'right';
          c.fillText('PRIX UNIT.', cx + 615, tblY + 21);
          c.fillText('CARTON', cx + 738, tblY + 21);
          c.textAlign = 'center';
          c.fillText('QTÉ', cx + cw - 92, tblY + 21);

          const rowStartY = tblY + 42;
          const rowH = 50;

          pageItems.forEach((def, rIdx) => {
            const ry = rowStartY + rIdx * rowH;
            const qty = orderModel.getQty(def.id);
            const unitCents = orderModel.getUnitPriceCents(def);
            const cartonCents = orderModel.getCartonPriceCents(def);

            if (qty > 0) {
              c.fillStyle = '#ecfdf5';
              c.fillRect(cx + 4, ry, cw - 8, rowH - 2);
            } else if (rIdx % 2 === 1) {
              c.fillStyle = '#f8fafc';
              c.fillRect(cx + 4, ry, cw - 8, rowH - 2);
            }

            // Product name & pack subtitle
            c.textAlign = 'left';
            c.textBaseline = 'middle';
            c.fillStyle = '#0f172a';
            c.font = '700 17px "Plus Jakarta Sans", sans-serif';
            c.fillText(def.shortLabel.slice(0, 31), cx + 14, ry + 17);
            c.fillStyle = '#475569';
            c.font = '600 13px "Plus Jakarta Sans", sans-serif';
            c.fillText(def.subtitle.slice(0, 44), cx + 14, ry + 36);

            // EAN barcode
            c.textAlign = 'center';
            c.fillStyle = '#334155';
            c.font = '600 15px "JetBrains Mono", monospace';
            c.fillText(def.primaryEan, cx + 455, ry + 25);

            // Unit price in Francs (₣)
            c.textAlign = 'right';
            c.fillStyle = '#0f172a';
            c.font = '700 16px "JetBrains Mono", monospace';
            c.fillText(formatFrancsCents(unitCents), cx + 615, ry + 25);

            // Carton subtotal in Francs (₣)
            c.fillStyle = '#0f4c5c';
            c.font = '700 16px "JetBrains Mono", monospace';
            c.fillText(formatFrancsCents(cartonCents), cx + 738, ry + 25);

            // Large touch-friendly [-] / qty / [+] controls
            const minusX = cx + cw - 172;
            const plusX = cx + cw - 60;
            const btnY = ry + 5;
            addButton(
              `ord_minus_${def.id}`,
              '−',
              minusX,
              btnY,
              48,
              40,
              () => {
                orderModel.adjustCartonQty(def.id, -1);
                soundSynth.playAtmPiezo('correct');
                crtDirty = true;
              },
              {
                fill: qty > 0 ? '#fee2e2' : '#e2e8f0',
                textColor: qty > 0 ? '#991b1b' : '#64748b',
                font: '800 24px "JetBrains Mono", monospace',
              }
            );

            // Quantity readout box
            drawBevelBox(c, minusX + 54, btnY, 52, 40, qty > 0 ? '#fef9c3' : '#f1f5f9', true);
            c.fillStyle = qty > 0 ? '#0f172a' : '#64748b';
            c.font = '800 22px "JetBrains Mono", monospace';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(String(qty), minusX + 80, btnY + 21);

            addButton(
              `ord_plus_${def.id}`,
              '+',
              plusX,
              btnY,
              48,
              40,
              () => {
                orderModel.adjustCartonQty(def.id, 1);
                soundSynth.playAtmPiezo('bezel');
                crtDirty = true;
              },
              {
                fill: '#dcfce7',
                textColor: '#166534',
                font: '800 24px "JetBrains Mono", monospace',
              }
            );
          });

          // 3. Pagination & Clear Cart strip (cy + 444, height 38)
          const navY = cy + 444;
          addButton(
            'ord_prev_page',
            '◄ PRÉC.',
            cx,
            navY,
            136,
            38,
            () => {
              if (orderPage > 0) {
                orderPage -= 1;
                soundSynth.playAtmPiezo('digit');
                crtDirty = true;
              }
            },
            {
              fill: orderPage > 0 ? '#d4d0c8' : '#cbd5e1',
              textColor: orderPage > 0 ? '#0f172a' : '#64748b',
              font: '700 16px "JetBrains Mono", monospace',
            }
          );

          drawBevelBox(c, cx + 146, navY, 178, 38, '#f1f5f9', true);
          c.fillStyle = '#0f172a';
          c.font = '700 16px "JetBrains Mono", monospace';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(`PAGE ${orderPage + 1} / ${totalPages}`, cx + 235, navY + 19);

          addButton(
            'ord_next_page',
            'SUIV. ►',
            cx + 334,
            navY,
            136,
            38,
            () => {
              if (orderPage < totalPages - 1) {
                orderPage += 1;
                soundSynth.playAtmPiezo('digit');
                crtDirty = true;
              }
            },
            {
              fill: orderPage < totalPages - 1 ? '#d4d0c8' : '#cbd5e1',
              textColor: orderPage < totalPages - 1 ? '#0f172a' : '#64748b',
              font: '700 16px "JetBrains Mono", monospace',
            }
          );

          c.textAlign = 'center';
          c.fillStyle = '#334155';
          c.font = '600 15px "JetBrains Mono", monospace';
          c.fillText(
            `${catItems.length} réf. · Quai arrière`,
            cx + 622,
            navY + 19
          );

          const totalCartons = orderModel.getTotalCartons();
          const totalCents = orderModel.getCartTotalCents();

          addButton(
            'ord_clear_cart',
            'VIDER PANIER',
            cx + cw - 178,
            navY,
            178,
            38,
            () => {
              if (totalCartons > 0) {
                orderModel.clearCart();
                soundSynth.playAtmPiezo('cancel');
                showStatus('PANIER CENTRALE-ACHAT 90 VIDÉ');
                crtDirty = true;
              }
            },
            {
              fill: totalCartons > 0 ? '#e2d7c5' : '#cbd5e1',
              textColor: totalCartons > 0 ? '#7c2d12' : '#64748b',
              font: '700 15px "Plus Jakarta Sans", sans-serif',
            }
          );

          // 4. Live Order Cart Total + [VALIDER & LIVRER AU QUAI] Action Bar (cy + 492, height 72)
          const footY = cy + 492;
          const totalBoxW = 472;
          drawBevelBox(c, cx, footY, totalBoxW, 70, '#f8fafc', true);
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.fillStyle = '#475569';
          c.font = '700 16px "JetBrains Mono", monospace';
          c.fillText(
            `PANIER SYNCHRONISÉ : ${totalCartons} CARTON${totalCartons > 1 ? 'S' : ''}`,
            cx + 16,
            footY + 22
          );
          c.fillStyle = '#0f172a';
          c.font = '800 24px "JetBrains Mono", monospace';
          c.fillText(
            `Total Commande : ${formatFrancsCents(totalCents)}`,
            cx + 16,
            footY + 50
          );

          const submitX = cx + totalBoxW + 14;
          const submitW = cw - totalBoxW - 14;
          addButton(
            'ord_submit_deliver',
            totalCartons > 0
              ? 'VALIDER & LIVRER AU QUAI'
              : 'SÉLECTIONNEZ DES CARTONS (+)',
            submitX,
            footY,
            submitW,
            70,
            () => {
              const res = orderModel.transmitFromPc();
              if (res.ok) {
                triggerHddActivity(1.0);
                showStatus(
                  `LIVRAISON QUAI OK : ${res.totalCartons} CARTON(S) · ${formatFrancsCents(res.totalCents)}`
                );
                crtDirty = true;
              } else {
                soundSynth.playAtmPiezo('error');
                showStatus('AJOUTEZ AU MOINS 1 CARTON AVEC [+] AVANT DE VALIDER');
              }
            },
            {
              fill: totalCartons > 0 ? '#15803d' : '#94a3b8',
              textColor: '#ffffff',
              font: '800 22px "Plus Jakarta Sans", sans-serif',
            }
          );
        }

        // ---------------- APP 1: Compta_Contact.exe ----------------
        if (activeApp === 'compta') {
          const c1 = wallet.getCaisse1Revenue();
          const c2 = wallet.getCaisse2Revenue();
          const totalRev = wallet.getStoreRevenue();
          const bankBal = wallet.getBankBalance();

          // 3 KPI Boxes
          const boxW = (cw - 28) / 3;
          const kpis = [
            { label: 'CAISSE 1 (JOUR)', val: formatFrInt(c1), sub: 'Espèces & CB' },
            { label: 'CAISSE 2 (JOUR)', val: formatFrInt(c2), sub: 'Espèces & CB' },
            { label: 'SOLDE BANQUE (DAB)', val: formatFr(bankBal), sub: 'Synchronisé DAB 1990' },
          ];
          kpis.forEach((k, i) => {
            const bx = cx + i * (boxW + 14);
            drawBevelBox(c, bx, cy, boxW, 118, '#f8fafc', true);
            c.fillStyle = '#475569';
            c.font = '700 17px "Plus Jakarta Sans", sans-serif';
            c.textAlign = 'left';
            c.fillText(k.label, bx + 16, cy + 28);
            c.fillStyle = i === 2 ? '#1b365d' : '#0f172a';
            c.font = '800 32px "JetBrains Mono", monospace';
            c.fillText(k.val, bx + 16, cy + 70);
            c.fillStyle = '#64748b';
            c.font = '600 15px "Plus Jakarta Sans", sans-serif';
            c.fillText(k.sub, bx + 16, cy + 100);
          });

          // Transfer Button
          addButton(
            'compta_transfer',
            totalRev > 0
              ? `TRANSFÉRER RECETTE (${formatFrInt(totalRev)}) VERS BANQUE`
              : 'AUCUNE RECETTE CAISSE À TRANSFÉRER (0 F)',
            cx,
            cy + 134,
            cw,
            66,
            () => {
              const moved = wallet.transferRevenueToBank();
              if (moved > 0) {
                triggerHddActivity(0.7);
                soundSynth.playAtmPiezo('confirm');
                showStatus(`REM. BANQUE EFFECTUÉE : +${formatFrInt(moved)}`);
                onWalletChanged();
              } else {
                soundSynth.playAtmPiezo('error');
                showStatus('ENCAISSEZ DES ARTICLES AUX CAISSES 1 OU 2 D’ABORD');
              }
            },
            {
              fill: totalRev > 0 ? '#1b365d' : '#b8b3a8',
              textColor: totalRev > 0 ? '#ffffff' : '#475569',
              font: '800 22px "Plus Jakarta Sans", sans-serif',
            }
          );

          // Ledger Table
          drawBevelBox(c, cx, cy + 216, cw, 330, '#ffffff', true);
          c.fillStyle = '#1b365d';
          c.fillRect(cx + 4, cy + 220, cw - 8, 40);
          c.fillStyle = '#ffffff';
          c.font = '700 19px "JetBrains Mono", monospace';
          c.textAlign = 'left';
          c.fillText('DATE       LIBELLÉ OPÉRATION BANCAIRE', cx + 18, cy + 241);
          c.textAlign = 'right';
          c.fillText('MONTANT (FRF)', cx + cw - 18, cy + 241);

          const txs = wallet.getTransactions().slice(0, 6);
          txs.forEach((tx, idx) => {
            const ry = cy + 284 + idx * 42;
            if (idx % 2 === 1) {
              c.fillStyle = '#f1f5f9';
              c.fillRect(cx + 4, ry - 20, cw - 8, 40);
            }
            c.textAlign = 'left';
            c.fillStyle = '#0f172a';
            c.font = '600 20px "JetBrains Mono", monospace';
            c.fillText(`${tx.date}   ${tx.label}`, cx + 18, ry);
            c.textAlign = 'right';
            c.fillStyle = tx.amount >= 0 ? '#15803d' : '#991b1b';
            c.font = '700 20px "JetBrains Mono", monospace';
            c.fillText(`${tx.amount >= 0 ? '+' : ''}${formatFr(tx.amount)}`, cx + cw - 18, ry);
          });
        }

        // ---------------- APP 2: Stocks_Entrepot.exe ----------------
        if (activeApp === 'stocks') {
          const depts = wallet.getDepartmentStocks();
          const colW = (cw - 16) / 2;

          depts.forEach((dept, idx) => {
            const col = idx < 6 ? 0 : 1;
            const row = idx < 6 ? idx : idx - 6;
            const dx = cx + col * (colW + 16);
            const dy = cy + row * 72;
            const dh = 64;
            const selected = dept.id === selectedStockDeptId;
            const hovered =
              cursorX >= dx && cursorX <= dx + colW && cursorY >= dy && cursorY <= dy + dh;

            drawBevelBox(
              c,
              dx,
              dy,
              colW,
              dh,
              selected ? '#dbeafe' : hovered ? '#f1f5f9' : '#f8fafc',
              selected
            );

            c.textAlign = 'left';
            c.textBaseline = 'middle';
            c.fillStyle = '#0f172a';
            c.font = '700 18px "Plus Jakarta Sans", sans-serif';
            c.fillText(dept.name, dx + 12, dy + 22);

            // Stock progress bar
            const barX = dx + 12;
            const barY = dy + 38;
            const barW = colW - 104;
            c.fillStyle = '#cbd5e1';
            c.fillRect(barX, barY, barW, 16);
            c.fillStyle = dept.level < 55 ? '#b91c1c' : dept.level < 75 ? '#d97706' : '#15803d';
            c.fillRect(barX, barY, Math.round((barW * dept.level) / 100), 16);

            c.textAlign = 'right';
            c.fillStyle = '#0f172a';
            c.font = '700 19px "JetBrains Mono", monospace';
            c.fillText(`${dept.level}%`, dx + colW - 12, dy + 44);

            hitRects.push({
              id: `dept_${dept.id}`,
              label: `SÉLECTIONNER ${dept.name}`,
              x: dx,
              y: dy,
              w: colW,
              h: dh,
              onClick: () => {
                selectedStockDeptId = dept.id;
                crtDirty = true;
              },
            });
          });

          // Info panel in 12th slot (col 1, row 5)
          const infoX = cx + colW + 16;
          const infoY = cy + 5 * 72;
          drawBevelBox(c, infoX, infoY, colW, 64, '#e2e8f0', true);
          c.textAlign = 'left';
          c.fillStyle = '#1e293b';
          c.font = '700 17px "JetBrains Mono", monospace';
          c.fillText(`SOLDE BANQUE : ${formatFr(wallet.getBankBalance())}`, infoX + 14, infoY + 22);
          c.fillStyle = '#475569';
          c.font = '600 15px "Plus Jakarta Sans", sans-serif';
          c.fillText('Livraison immédiate sur le Quai Arrière (CAM 04)', infoX + 14, infoY + 46);

          const selectedDept = depts.find((d) => d.id === selectedStockDeptId) ?? depts[0];
          addButton(
            'stocks_order_pallet',
            `COMMANDER PALETTE (${selectedDept.name.slice(0, 18).toUpperCase()}) — 150 F`,
            cx,
            cy + 452,
            cw,
            78,
            () => {
              const res = wallet.orderStockPallet(selectedStockDeptId);
              if (res.ok) {
                triggerHddActivity(0.85);
                soundSynth.playAtmPiezo('confirm');
                showStatus(`PALETTE LIVRÉE SUR QUAI ARRIÈRE : ${res.deptName.toUpperCase()}`);
                onWalletChanged();
              } else {
                soundSynth.playAtmPiezo('error');
                showStatus(res.reason ?? 'COMMANDE IMPOSSIBLE');
              }
            },
            {
              fill: '#1b365d',
              textColor: '#ffffff',
              font: '800 22px "Plus Jakarta Sans", sans-serif',
            }
          );
        }

        // ---------------- APP 3: URSSAF_Declarations.exe ----------------
        if (activeApp === 'urssaf') {
          const u = wallet.getUrssafBreakdown();

          drawBevelBox(c, cx, cy, cw, 396, '#ffffff', true);
          c.fillStyle = '#0f172a';
          c.font = '800 24px "Plus Jakarta Sans", sans-serif';
          c.textAlign = 'left';
          c.fillText('BORDEREAU TRIMESTRIEL — 4e TRIMESTRE 1990', cx + 22, cy + 36);

          // Status badge
          const badgeFill = u.settled ? '#166534' : '#b45309';
          c.fillStyle = badgeFill;
          c.fillRect(cx + cw - 336, cy + 14, 314, 44);
          c.fillStyle = '#ffffff';
          c.font = '800 20px "JetBrains Mono", monospace';
          c.textAlign = 'center';
          c.fillText(u.settled ? 'SITUATION : À JOUR' : 'SITUATION : À RÉGLER', cx + cw - 179, cy + 37);

          const rows: Array<[string, string, boolean]> = [
            ['CHIFFRE D’AFFAIRES DÉCLARÉ (TRIMESTRE)', formatFr(u.turnover), false],
            ['COTISATIONS URSSAF (14,5 %)', formatFr(u.urssaf), false],
            ['COTISATIONS ASSEDIC (4,2 %)', formatFr(u.assedic), false],
            ['TVA COLLECTÉE — TAUX NORMAL 1990 (18,6 %)', formatFr(u.tva), false],
            [
              u.settled ? 'DERNIER RÈGLEMENT ENREGISTRÉ' : 'TOTAL COTISATIONS & TVA À RÉGLER',
              formatFr(u.settled ? u.lastPaid : u.totalDue),
              true,
            ],
          ];

          rows.forEach(([lbl, val, bold], idx) => {
            const ry = cy + 102 + idx * 58;
            if (bold) {
              c.fillStyle = '#e2e8f0';
              c.fillRect(cx + 14, ry - 26, cw - 28, 52);
            } else if (idx % 2 === 1) {
              c.fillStyle = '#f8fafc';
              c.fillRect(cx + 14, ry - 24, cw - 28, 48);
            }
            c.textAlign = 'left';
            c.fillStyle = '#0f172a';
            c.font = bold
              ? '800 22px "Plus Jakarta Sans", sans-serif'
              : '600 20px "Plus Jakarta Sans", sans-serif';
            c.fillText(lbl, cx + 24, ry);

            c.textAlign = 'right';
            c.fillStyle = bold ? (u.settled ? '#166534' : '#991b1b') : '#1e293b';
            c.font = bold
              ? '800 26px "JetBrains Mono", monospace'
              : '700 22px "JetBrains Mono", monospace';
            c.fillText(val, cx + cw - 24, ry);
          });

          c.textAlign = 'left';
          c.fillStyle = '#475569';
          c.font = '700 19px "JetBrains Mono", monospace';
          c.fillText(`SOLDE BANCAIRE DISPONIBLE : ${formatFr(wallet.getBankBalance())}`, cx + 8, cy + 426);

          addButton(
            'urssaf_pay',
            u.settled
              ? 'SITUATION FISCALE & SOCIALE À JOUR'
              : `DÉCLARER & RÉGLER COTISATIONS (${formatFrInt(u.totalDue)})`,
            cx,
            cy + 454,
            cw,
            78,
            () => {
              const res = wallet.payUrssafDeclarations();
              if (res.ok) {
                triggerHddActivity(0.8);
                soundSynth.playAtmPiezo('confirm');
                showStatus(`RÈGLEMENT URSSAF/TVA VALIDÉ : -${formatFrInt(res.amount)} · À JOUR`);
                onWalletChanged();
              } else {
                soundSynth.playAtmPiezo('error');
                showStatus(res.reason ?? 'PAIEMENT IMPOSSIBLE');
              }
            },
            {
              fill: u.settled ? '#166534' : '#1b365d',
              textColor: '#ffffff',
              font: '800 22px "Plus Jakarta Sans", sans-serif',
            }
          );
        }

        // ---------------- APP 4: Videosurveillance.exe ----------------
        if (activeApp === 'cctv') {
          const preset = CCTV_PRESETS[activeCctvIdx] ?? CCTV_PRESETS[0];

          // Live CCTV viewport frame (688x430)
          const vx = cx;
          const vy = cy;
          const vw = 688;
          const vh = 430;
          drawBevelBox(c, vx, vy, vw, vh, '#0f172a', true);
          c.drawImage(cctvCanvas, vx + 6, vy + 6, vw - 12, vh - 12);

          // Subtle 1990 VHS CRT scanlines over CCTV feed
          c.fillStyle = 'rgba(0, 0, 0, 0.14)';
          for (let sy = vy + 6; sy < vy + vh - 6; sy += 4) {
            c.fillRect(vx + 6, sy, vw - 12, 1);
          }

          // Top-left live timestamp & camera OSD
          c.fillStyle = 'rgba(15, 23, 42, 0.78)';
          c.fillRect(vx + 16, vy + 16, 420, 38);
          c.fillStyle = '#f8fafc';
          c.font = '700 20px "JetBrains Mono", monospace';
          c.textAlign = 'left';
          c.textBaseline = 'middle';
          c.fillText(`${preset.code} : ${preset.name}`, vx + 26, vy + 35);

          // Top-right REC indicator
          const recDot = Math.floor(elapsed * 2) % 2 === 0;
          c.fillStyle = 'rgba(15, 23, 42, 0.78)';
          c.fillRect(vx + vw - 134, vy + 16, 118, 38);
          if (recDot) {
            c.fillStyle = '#dc2626';
            c.beginPath();
            c.arc(vx + vw - 110, vy + 35, 7, 0, Math.PI * 2);
            c.fill();
          }
          c.fillStyle = '#f8fafc';
          c.fillText('REC', vx + vw - 94, vy + 35);

          // Bottom timestamp bar
          const secs2 = Math.floor(elapsed) % 60;
          const mins2 = (32 + Math.floor(elapsed / 60)) % 60;
          c.fillStyle = 'rgba(15, 23, 42, 0.78)';
          c.fillRect(vx + 16, vy + vh - 50, 354, 34);
          c.fillStyle = '#e2e8f0';
          c.font = '600 18px "JetBrains Mono", monospace';
          c.fillText(
            `19/11/1990  14:${String(mins2).padStart(2, '0')}:${String(secs2).padStart(2, '0')}  VHS-SP`,
            vx + 26,
            vy + vh - 33
          );

          // Right-hand Channel Selector Buttons (4 big touch-friendly buttons)
          const selX = vx + vw + 16;
          const selW = cw - vw - 16;
          CCTV_PRESETS.forEach((cam, idx) => {
            addButton(
              `cctv_cam_${idx}`,
              `${cam.code}`,
              selX,
              vy + idx * 110,
              selW,
              96,
              () => {
                activeCctvIdx = idx;
                triggerHddActivity(0.25);
                captureLiveCctvFrame();
              },
              {
                active: activeCctvIdx === idx,
                font: '800 24px "JetBrains Mono", monospace',
              }
            );
            // Subtitle underneath button label
            c.fillStyle = activeCctvIdx === idx ? '#cbd5e1' : '#334155';
            c.font = '600 13px "Plus Jakarta Sans", sans-serif';
            c.textAlign = 'center';
            c.fillText(cam.name.slice(0, 20), selX + selW / 2, vy + idx * 110 + 74);
          });

          // Bottom camera info bar
          drawBevelBox(c, cx, cy + 448, cw, 82, '#e2e8f0', true);
          c.textAlign = 'left';
          c.fillStyle = '#0f172a';
          c.font = '700 20px "JetBrains Mono", monospace';
          c.fillText(
            `FLUX EN DIRECT : ${preset.code} — ${preset.name}`,
            cx + 18,
            cy + 476
          );
          c.fillStyle = '#475569';
          c.font = '600 17px "Plus Jakarta Sans", sans-serif';
          c.fillText(
            'Sélectionnez une caméra à droite ou appuyez sur les touches 1 à 4 du clavier 3D.',
            cx + 18,
            cy + 506
          );
        }
      }
    }

    // Status notification strip (bottom-center toast inside OS)
    if (statusBanner && statusBannerTimer > 0 && (osStage === 'DESKTOP' || osStage === 'LOGIN')) {
      c.fillStyle = '#0f172a';
      c.fillRect(140, CRT_H - 54, CRT_W - 280, 40);
      c.strokeStyle = '#fde68a';
      c.lineWidth = 2;
      c.strokeRect(140, CRT_H - 54, CRT_W - 280, 40);
      c.fillStyle = '#fde68a';
      c.font = '700 18px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(statusBanner, CRT_W / 2, CRT_H - 34);
    }

    // Classic Crisp White-with-Black-Outline 1990 Arrow Mouse Cursor
    if (osStage === 'LOGIN' || osStage === 'DESKTOP') {
      const mx = cursorX;
      const my = cursorY;
      c.save();
      c.beginPath();
      c.moveTo(mx, my);
      c.lineTo(mx, my + 28);
      c.lineTo(mx + 8, my + 21);
      c.lineTo(mx + 14, my + 31);
      c.lineTo(mx + 19, my + 28);
      c.lineTo(mx + 13, my + 18);
      c.lineTo(mx + 22, my + 18);
      c.closePath();
      c.fillStyle = '#ffffff';
      c.fill();
      c.lineWidth = 2.5;
      c.strokeStyle = '#0f172a';
      c.stroke();
      c.restore();
    }

    // Subtle degauss flash on initial power-up
    if (degaussTimer > 0) {
      c.fillStyle = `rgba(255, 255, 255, ${(degaussTimer / 0.42) * 0.35})`;
      c.fillRect(0, 0, CRT_W, CRT_H);
    }

    lastHitRects = hitRects;
    let foundHover = '';
    for (let i = hitRects.length - 1; i >= 0; i--) {
      const r = hitRects[i];
      if (cursorX >= r.x && cursorX <= r.x + r.w && cursorY >= r.y && cursorY <= r.y + r.h) {
        foundHover = r.label;
        break;
      }
    }
    hoveredRectLabel = foundHover;
    crtTex.needsUpdate = true;
  };

  // ============================================================================
  // 6. 3D BEIGE DESKTOP PC TOWER (LEFT SIDE: localX = -0.54, localZ = -0.08)
  // ============================================================================
  const towerGroup = new THREE.Group();
  towerGroup.position.set(-0.54, 0, -0.08);
  ws.add(towerGroup);

  const towerChassis = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.43, 0.42), beigePlastic);
  towerChassis.position.set(0, 0.215, 0);
  towerChassis.castShadow = true;
  towerChassis.receiveShadow = true;

  // Front recessed panel detailing + 5.25" bay + 3.5" floppy drive + intake vents
  const towerFrontFace = new THREE.Mesh(new THREE.BoxGeometry(0.194, 0.41, 0.014), beigeDark);
  towerFrontFace.position.set(0, 0.215, 0.208);

  const bay525 = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.046, 0.012), beigePlastic);
  bay525.position.set(0, 0.355, 0.215);
  const bay35 = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.03, 0.012), beigePlastic);
  bay35.position.set(0, 0.295, 0.215);
  const floppySlot = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.006, 0.008), darkBezelRecess);
  floppySlot.position.set(0, 0.295, 0.222);

  // Lower front vent slats
  const ventGeo = new THREE.BoxGeometry(0.15, 0.008, 0.006);
  ctx.disposables.push(ventGeo);
  for (let i = 0; i < 6; i++) {
    const vent = new THREE.Mesh(ventGeo, darkBezelRecess);
    vent.position.set(0, 0.045 + i * 0.018, 0.217);
    towerGroup.add(vent);
  }

  // Printed badge "CONTACT 386DX"
  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 256;
  badgeCanvas.height = 64;
  {
    const bc = badgeCanvas.getContext('2d')!;
    bc.fillStyle = '#1b365d';
    bc.fillRect(0, 0, 256, 64);
    bc.fillStyle = '#f8fafc';
    bc.font = '800 26px "JetBrains Mono", monospace';
    bc.textAlign = 'center';
    bc.textBaseline = 'middle';
    bc.fillText('CONTACT 386DX', 128, 32);
  }
  const badgeTex = new THREE.CanvasTexture(badgeCanvas);
  badgeTex.colorSpace = THREE.SRGBColorSpace;
  const badgeMat = new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.4 });
  const badgePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.028), badgeMat);
  badgePlane.position.set(0, 0.398, 0.217);

  // Clickable 3D Square Power Switch + Green POWER LED + Amber HDD LED
  const towerPowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.044, 0.012), darkBezelRecess);
  towerPowerFrame.position.set(-0.042, 0.205, 0.214);
  const towerPowerBtn = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.032, 0.022), beigeKey);
  towerPowerBtn.position.set(-0.042, 0.205, 0.222);

  const powerLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.008), towerPowerLedMat);
  powerLedMesh.position.set(0.026, 0.214, 0.217);
  const hddLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.008), towerHddLedMat);
  hddLedMesh.position.set(0.056, 0.214, 0.217);

  ctx.disposables.push(
    towerChassis.geometry,
    towerFrontFace.geometry,
    bay525.geometry,
    bay35.geometry,
    floppySlot.geometry,
    badgeTex,
    badgeMat,
    badgePlane.geometry,
    towerPowerFrame.geometry,
    towerPowerBtn.geometry,
    powerLedMesh.geometry,
    hddLedMesh.geometry
  );
  towerGroup.add(
    towerChassis,
    towerFrontFace,
    bay525,
    bay35,
    floppySlot,
    badgePlane,
    towerPowerFrame,
    towerPowerBtn,
    powerLedMesh,
    hddLedMesh
  );

  // Clickable PC Tower Power Button Hitbox
  addInteractiveHitbox(towerGroup, {
    id: 'pc_tower_power_btn',
    size: [0.09, 0.09, 0.07],
    pos: [-0.042, 0.205, 0.23],
    title: 'Unité Centrale 1990 — Bouton Marche/Arrêt',
    subtitle: 'Tour PC Beige 386DX · LED POWER & HDD',
    verb: () => (pcTowerOn ? 'ÉTEINDRE LA TOUR PC' : 'ALLUMER LA TOUR PC'),
    onInteract: togglePcTowerPower,
  });

  // ============================================================================
  // 7. 15-INCH RECTANGULAR 4:3 CRT MONITOR (CENTER: localX = 0.0, localZ = -0.14)
  //    SHARP-CORNERED 4:3 SCREEN OFFSET +0.005m FORWARD — ZERO CORNER CLIPPING!
  // ============================================================================
  const monGroup = new THREE.Group();
  monGroup.position.set(0.0, 0, -0.14);
  ws.add(monGroup);

  // Swivel stand base + neck
  const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.024, 0.26), beigeDark);
  standBase.position.set(0, 0.012, 0.0);
  const standNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.095, 0.072, 16), beigeDark);
  standNeck.position.set(0, 0.056, -0.01);

  // Main CRT front cabinet (0.50m wide x 0.415m tall, centered at Y = 0.295)
  const monCabinetRear = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.31, 0.24), beigeDark);
  monCabinetRear.position.set(0, 0.295, -0.12);
  monCabinetRear.castShadow = true;

  const monCabinetMid = new THREE.Mesh(new THREE.BoxGeometry(0.495, 0.41, 0.16), beigePlastic);
  monCabinetMid.position.set(0, 0.295, 0.025);
  monCabinetMid.castShadow = true;

  // Clean 4-bar rectangular bezel framing the 0.42 x 0.315 CRT screen (ZERO corner clipping!)
  const scrW = 0.42;
  const scrH = 0.315;
  const scrCenterY = 0.312;
  const bezelZ = 0.112;

  const bezelTop = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.044, 0.024), beigePlastic);
  bezelTop.position.set(0, scrCenterY + scrH / 2 + 0.022, bezelZ);
  const bezelBot = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.062, 0.024), beigePlastic);
  bezelBot.position.set(0, scrCenterY - scrH / 2 - 0.031, bezelZ);
  const bezelL = new THREE.Mesh(new THREE.BoxGeometry(0.04, scrH, 0.024), beigePlastic);
  bezelL.position.set(-(scrW / 2 + 0.02), scrCenterY, bezelZ);
  const bezelR = new THREE.Mesh(new THREE.BoxGeometry(0.04, scrH, 0.024), beigePlastic);
  bezelR.position.set(scrW / 2 + 0.02, scrCenterY, bezelZ);

  // Dark inner recess plane behind screen
  const recessPlane = new THREE.Mesh(new THREE.PlaneGeometry(scrW + 0.012, scrH + 0.012), darkBezelRecess);
  recessPlane.position.set(0, scrCenterY, 0.112);

  // Sharp-cornered rectangular 4:3 CRT Screen Plane offset +0.005m forward (Z = 0.117)
  const crtScreenMat = new THREE.MeshStandardMaterial({
    map: crtTex,
    emissiveMap: crtTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.02,
    roughness: 0.22,
    metalness: 0.05,
  });
  const crtScreenMesh = new THREE.Mesh(new THREE.PlaneGeometry(scrW, scrH), crtScreenMat);
  crtScreenMesh.position.set(0, scrCenterY, 0.117);

  // Independent Clickable 3D Monitor Power Button on bottom-right bezel + LED
  const monPowerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.028, 0.01), darkBezelRecess);
  monPowerFrame.position.set(0.185, scrCenterY - scrH / 2 - 0.032, bezelZ + 0.012);
  const monPowerBtn = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.02, 0.018), beigeKey);
  monPowerBtn.position.set(0.185, scrCenterY - scrH / 2 - 0.032, bezelZ + 0.018);

  const monLedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.007, 0.008), monitorPowerLedMat);
  monLedMesh.position.set(0.145, scrCenterY - scrH / 2 - 0.032, bezelZ + 0.014);

  // Yellow Post-it Note stuck on bottom-left bezel ("CODE: 1234")
  const postItCanvas = document.createElement('canvas');
  postItCanvas.width = 256;
  postItCanvas.height = 256;
  {
    const pc = postItCanvas.getContext('2d')!;
    pc.fillStyle = '#fef08a';
    pc.fillRect(0, 0, 256, 256);
    pc.fillStyle = '#fde047';
    pc.fillRect(0, 0, 256, 36);
    pc.fillStyle = '#1e293b';
    pc.font = '700 32px "Plus Jakarta Sans", sans-serif';
    pc.textAlign = 'center';
    pc.fillText('CODE PC :', 128, 108);
    pc.fillStyle = '#1b365d';
    pc.font = '800 68px "JetBrains Mono", monospace';
    pc.fillText('1234', 128, 194);
  }
  const postItTex = new THREE.CanvasTexture(postItCanvas);
  postItTex.colorSpace = THREE.SRGBColorSpace;
  const postItMat = new THREE.MeshStandardMaterial({ map: postItTex, roughness: 0.85 });
  const postItMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.072, 0.072), postItMat);
  postItMesh.position.set(-0.205, scrCenterY - scrH / 2 - 0.015, bezelZ + 0.014);
  postItMesh.rotation.z = 0.06;

  ctx.disposables.push(
    standBase.geometry,
    standNeck.geometry,
    monCabinetRear.geometry,
    monCabinetMid.geometry,
    bezelTop.geometry,
    bezelBot.geometry,
    bezelL.geometry,
    bezelR.geometry,
    recessPlane.geometry,
    crtScreenMat,
    crtScreenMesh.geometry,
    monPowerFrame.geometry,
    monPowerBtn.geometry,
    monLedMesh.geometry,
    postItTex,
    postItMat,
    postItMesh.geometry
  );
  monGroup.add(
    standBase,
    standNeck,
    monCabinetRear,
    monCabinetMid,
    bezelTop,
    bezelBot,
    bezelL,
    bezelR,
    recessPlane,
    crtScreenMesh,
    monPowerFrame,
    monPowerBtn,
    monLedMesh,
    postItMesh
  );

  // Independent Monitor Power Button Hitbox
  addInteractiveHitbox(monGroup, {
    id: 'crt_monitor_power_btn',
    size: [0.075, 0.065, 0.06],
    pos: [0.185, scrCenterY - scrH / 2 - 0.032, bezelZ + 0.022],
    title: 'Écran Cathodique 15" — Interrupteur Moniteur',
    subtitle: 'Alimentation Indépendante Écran CRT 4:3',
    verb: () => (crtMonitorOn ? 'ÉTEINDRE LE MONITEUR' : 'ALLUMER LE MONITEUR'),
    onInteract: toggleCrtMonitorPower,
  });

  // Direct 3D CRT UV Raycast Surface (Controls OS Cursor + Synchronized 3D Ball Mouse!)
  const updateCursorFromUv = (uv: THREE.Vector2) => {
    const nx = THREE.MathUtils.clamp(uv.x, 0, 1);
    const ny = THREE.MathUtils.clamp(1 - uv.y, 0, 1);
    const nextX = nx * CRT_W;
    const nextY = ny * CRT_H;
    if (Math.abs(nextX - cursorX) > 1.2 || Math.abs(nextY - cursorY) > 1.2) {
      cursorX = nextX;
      cursorY = nextY;
      // Map screen UV smoothly onto mousepad motion range (±0.075m X, ±0.055m Z)
      mouseTargetX = (nx - 0.5) * 0.15;
      mouseTargetZ = (ny - 0.5) * 0.11;
      crtDirty = true;
    }
  };

  const triggerVirtualLeftClick = (uv?: THREE.Vector2) => {
    if (!acquirePcPressLock()) return;
    if (uv) updateCursorFromUv(uv);

    mouseLeftPressTimer = 1.0;
    soundSynth.playMouseClick();

    if (!crtMonitorOn) {
      showStatus('ALLUMEZ LE MONITEUR (BOUTON BAS-DROITE)');
      return;
    }
    if (!pcTowerOn) {
      showStatus('ALLUMEZ LA TOUR PC (À GAUCHE)');
      return;
    }
    if (osStage !== 'LOGIN' && osStage !== 'DESKTOP') return;

    // Re-evaluate against current UI hit rects
    for (let i = lastHitRects.length - 1; i >= 0; i--) {
      const r = lastHitRects[i];
      if (cursorX >= r.x && cursorX <= r.x + r.w && cursorY >= r.y && cursorY <= r.y + r.h) {
        r.onClick();
        return;
      }
    }
  };

  addInteractiveHitbox(monGroup, {
    id: 'crt_screen_surface',
    usePlane: true,
    size: [scrW, scrH, 0.01],
    pos: [0, scrCenterY, 0.119],
    title: 'Écran CRT 15" — CONTACT-OS 90',
    subtitle: 'Visez une icône ou un bouton puis cliquez',
    verb: () => {
      if (!crtMonitorOn) return 'MONITEUR ÉTEINT';
      if (!pcTowerOn) return 'TOUR PC ÉTEINTE';
      if (osStage === 'BIOS') return 'DÉMARRAGE BIOS...';
      return hoveredRectLabel ? `CLIC GAUCHE · ${hoveredRectLabel}` : 'CLIC GAUCHE';
    },
    dynamicTitle: () => {
      if (!crtMonitorOn) return 'Écran Cathodique 15" (Éteint)';
      if (!pcTowerOn) return 'Écran Cathodique 15" (Pas de signal)';
      if (osStage === 'LOGIN') return 'CONTACT-OS 90 — Connexion Gérant';
      if (osStage === 'DESKTOP') return 'CONTACT-OS 90 — Bureau';
      return 'CONTACT-OS 90 — BIOS 1990';
    },
    onHoverUv: updateCursorFromUv,
    onInteractUv: (uv) => triggerVirtualLeftClick(uv),
    onInteract: () => triggerVirtualLeftClick(),
  });

  // ============================================================================
  // 8. MOUSEPAD & SYNCHRONIZED 3D BEIGE BALL MOUSE (RIGHT: localX = +0.44, localZ = +0.18)
  // ============================================================================
  const padOriginX = 0.44;
  const padOriginZ = 0.18;

  const mousepad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.005, 0.22), mousepadMat);
  mousepad.position.set(padOriginX, 0.0025, padOriginZ);
  mousepad.receiveShadow = true;
  ws.add(mousepad);
  ctx.disposables.push(mousepad.geometry);

  const mouseGroup = new THREE.Group();
  mouseGroup.position.set(padOriginX, 0.005, padOriginZ);
  ws.add(mouseGroup);

  // Classic 1990 boxy-curved beige ball mouse body + separate depressible Left & Right buttons
  const mouseBase = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.022, 0.104), beigePlastic);
  mouseBase.position.set(0, 0.011, 0);
  mouseBase.castShadow = true;

  const mousePalm = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.06), beigePlastic);
  mousePalm.position.set(0, 0.024, 0.02);

  const mouseLeftBtn = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.036), beigeKey);
  mouseLeftBtn.position.set(-0.016, 0.026, -0.03);
  const mouseRightBtn = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.036), beigeKey);
  mouseRightBtn.position.set(0.016, 0.026, -0.03);

  const mouseCord = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.18, 6), beigeDark);
  mouseCord.rotation.x = Math.PI / 2;
  mouseCord.position.set(0, 0.01, -0.14);

  ctx.disposables.push(
    mouseBase.geometry,
    mousePalm.geometry,
    mouseLeftBtn.geometry,
    mouseRightBtn.geometry,
    mouseCord.geometry
  );
  mouseGroup.add(mouseBase, mousePalm, mouseLeftBtn, mouseRightBtn, mouseCord);

  addInteractiveHitbox(mouseGroup, {
    id: 'pc_beige_mouse',
    size: [0.085, 0.05, 0.12],
    pos: [0, 0.022, 0],
    title: 'Souris à Boule Beige 1990',
    subtitle: 'Synchronisée en temps réel avec le curseur CRT',
    verb: () => 'CLIC GAUCHE',
    onInteract: () => triggerVirtualLeftClick(),
  });

  // ============================================================================
  // 9. PHYSICAL 3D MECHANICAL KEYBOARD (CENTER FRONT: localX = -0.02, localZ = +0.20)
  //    PROTRUDING ZERO-CLIPPING KEYCAPS (0-9, A-Z, ENTER, BACKSPACE, ESC)
  // ============================================================================
  const kbGroup = new THREE.Group();
  kbGroup.position.set(-0.02, 0.014, 0.21);
  kbGroup.rotation.x = 0.13;
  ws.add(kbGroup);

  const kbBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.022, 0.175), beigePlastic);
  kbBase.position.set(0, 0, 0);
  kbBase.castShadow = true;
  kbBase.receiveShadow = true;
  const kbWell = new THREE.Mesh(new THREE.BoxGeometry(0.436, 0.006, 0.148), beigeDark);
  kbWell.position.set(0, 0.011, 0.004);
  kbGroup.add(kbBase, kbWell);
  ctx.disposables.push(kbBase.geometry, kbWell.geometry);

  const keyAnims: KeyCapAnim[] = [];
  const keyTexCache = new Map<string, THREE.MeshStandardMaterial>();

  const getKeyCapMat = (label: string, isMod: boolean): THREE.MeshStandardMaterial => {
    const cacheKey = `${label}_${isMod ? 1 : 0}`;
    const existing = keyTexCache.get(cacheKey);
    if (existing) return existing;

    const kc = document.createElement('canvas');
    kc.width = 128;
    kc.height = 128;
    const g = kc.getContext('2d')!;
    g.fillStyle = isMod ? '#c9c2b2' : '#ece7da';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#9ca3af';
    g.lineWidth = 6;
    g.strokeRect(4, 4, 120, 120);
    g.fillStyle = '#0f172a';
    g.font =
      label.length > 2
        ? '800 32px "JetBrains Mono", monospace'
        : '800 58px "JetBrains Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 64, 66);

    const tex = new THREE.CanvasTexture(kc);
    tex.colorSpace = THREE.SRGBColorSpace;
    const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    ctx.disposables.push(tex, topMat);
    keyTexCache.set(cacheKey, topMat);
    return topMat;
  };

  interface KeySpec {
    label: string;
    code: string;
    wUnits?: number;
    isMod?: boolean;
  }

  const kbRows: KeySpec[][] = [
    [
      { label: 'ESC', code: 'ESC', wUnits: 1.15, isMod: true },
      { label: '1', code: '1' },
      { label: '2', code: '2' },
      { label: '3', code: '3' },
      { label: '4', code: '4' },
      { label: '5', code: '5' },
      { label: '6', code: '6' },
      { label: '7', code: '7' },
      { label: '8', code: '8' },
      { label: '9', code: '9' },
      { label: '0', code: '0' },
      { label: '←', code: 'BACKSPACE', wUnits: 1.35, isMod: true },
    ],
    [
      { label: 'A', code: 'A' },
      { label: 'Z', code: 'Z' },
      { label: 'E', code: 'E' },
      { label: 'R', code: 'R' },
      { label: 'T', code: 'T' },
      { label: 'Y', code: 'Y' },
      { label: 'U', code: 'U' },
      { label: 'I', code: 'I' },
      { label: 'O', code: 'O' },
      { label: 'P', code: 'P' },
      { label: 'ENT', code: 'ENTER', wUnits: 2.1, isMod: true },
    ],
    [
      { label: 'Q', code: 'Q' },
      { label: 'S', code: 'S' },
      { label: 'D', code: 'D' },
      { label: 'F', code: 'F' },
      { label: 'G', code: 'G' },
      { label: 'H', code: 'H' },
      { label: 'J', code: 'J' },
      { label: 'K', code: 'K' },
      { label: 'L', code: 'L' },
      { label: 'M', code: 'M' },
      { label: 'OK', code: 'ENTER', wUnits: 1.8, isMod: true },
    ],
    [
      { label: 'W', code: 'W' },
      { label: 'X', code: 'X' },
      { label: 'C', code: 'C' },
      { label: 'V', code: 'V' },
      { label: 'B', code: 'B' },
      { label: 'N', code: 'N' },
      { label: 'ESPACE', code: ' ', wUnits: 4.8, isMod: true },
    ],
  ];

  const unitPitch = 0.0325;
  const rowZPositions = [-0.048, -0.015, 0.018, 0.051];
  const keyH = 0.016;
  const keyRestY = 0.022; // Cleanly raised well above kbWell (top at 0.014) — ZERO clipping!

  kbRows.forEach((row, rIdx) => {
    const totalUnits = row.reduce((acc, k) => acc + (k.wUnits ?? 1), 0);
    let cursorUnits = -totalUnits / 2;

    row.forEach((spec) => {
      const u = spec.wUnits ?? 1;
      const centerX = (cursorUnits + u / 2) * unitPitch;
      cursorUnits += u;

      const kw = u * unitPitch - 0.0045;
      const kd = 0.0265;
      const geo = new THREE.BoxGeometry(kw, keyH, kd);
      ctx.disposables.push(geo);

      const sideMat = spec.isMod ? beigeModKey : beigeKey;
      const topMat = getKeyCapMat(spec.label, Boolean(spec.isMod));
      const keyMesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
      keyMesh.position.set(centerX, keyRestY, rowZPositions[rIdx]);
      kbGroup.add(keyMesh);

      const anim: KeyCapAnim = {
        mesh: keyMesh,
        restY: keyRestY,
        pressDepth: 0.0065,
        pressTimer: 0,
      };
      keyAnims.push(anim);

      addInteractiveHitbox(kbGroup, {
        id: `pc_key_${rIdx}_${spec.label}`,
        size: [kw + 0.003, 0.024, kd + 0.003],
        pos: [centerX, keyRestY + 0.004, rowZPositions[rIdx]],
        title: `Clavier Mécanique — Touche [${spec.label}]`,
        subtitle: 'Saisie physique directe sur CONTACT-OS 90',
        verb: () => `TOUCHE ${spec.label}`,
        onInteract: () => {
          if (!acquirePcPressLock()) return;
          anim.pressTimer = 1.0;
          soundSynth.playKeyboardClack();
          handleOsKeyInput(spec.code);
        },
      });
    });
  });

  // ============================================================================
  // 10. ERGONOMIC SWIVEL CHAIR ON WEST SIDE OF DESK (X = 7.45, Z = 5.15, FACING +X)
  //     CLICK TO [S'ASSEOIR AU BUREAU] / [SE LEVER]
  // ============================================================================
  const chair = new THREE.Group();
  chair.position.set(7.45, 0, 5.15);
  officeGroup.add(chair);

  const starBase = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.05, 5), mats.anthracite);
  starBase.position.y = 0.06;
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.38, 10), mats.chrome);
  piston.position.y = 0.26;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.48), mats.rubberBlack);
  seat.position.y = 0.47;
  // Backrest on WEST (-X) side of seat so chair faces EAST (+X) directly toward desk & CRT!
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.56, 0.44), mats.rubberBlack);
  backrest.position.set(-0.21, 0.78, 0);
  backrest.rotation.z = 0.1;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.05), mats.anthracite);
  armL.position.set(-0.02, 0.66, -0.24);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.05), mats.anthracite);
  armR.position.set(-0.02, 0.66, 0.24);

  ctx.disposables.push(
    starBase.geometry,
    piston.geometry,
    seat.geometry,
    backrest.geometry,
    armL.geometry,
    armR.geometry
  );
  chair.add(starBase, piston, seat, backrest, armL, armR);

  addInteractiveHitbox(chair, {
    id: 'office_chair_sit_toggle',
    size: [0.58, 0.98, 0.58],
    pos: [0, 0.52, 0],
    title: 'Fauteuil de Direction Ergonomique',
    subtitle: 'Poste de travail CONTACT-OS 90',
    verb: () => (isSeatedAtDesk() ? 'SE LEVER' : "S'ASSEOIR AU BUREAU"),
    onInteract: () => {
      if (!acquirePcPressLock()) return;
      soundSynth.playUiTone(true);
      setSeatedAtDesk(!isSeatedAtDesk());
    },
  });

  // ============================================================================
  // 11. ANIMATION & OS UPDATE LOOP (ZERO GC, THROTTLED CCTV & CLOCK)
  // ============================================================================
  renderCrtCanvas(0);

  ctx.updaters.push({
    update: (dt, elapsed) => {
      // 1. Hardware LEDs
      towerPowerLedMat.emissiveIntensity = pcTowerOn ? 1.4 : 0.0;
      monitorPowerLedMat.emissiveIntensity = crtMonitorOn ? 1.4 : 0.0;

      if (hddActivityTimer > 0) {
        hddActivityTimer = Math.max(0, hddActivityTimer - dt);
        const flicker = Math.sin(elapsed * 42) > -0.15 ? 1.8 : 0.25;
        towerHddLedMat.emissiveIntensity = pcTowerOn ? flicker : 0.0;
      } else {
        towerHddLedMat.emissiveIntensity = 0.0;
      }

      // 2. Physical Button & Keycap Depress Springs
      if (towerBtnAnim > 0) {
        towerBtnAnim = Math.max(0, towerBtnAnim - dt * 5.5);
      }
      towerPowerBtn.position.z = 0.222 - Math.sin(towerBtnAnim * Math.PI) * 0.008;

      if (monitorBtnAnim > 0) {
        monitorBtnAnim = Math.max(0, monitorBtnAnim - dt * 5.5);
      }
      monPowerBtn.position.z = bezelZ + 0.018 - Math.sin(monitorBtnAnim * Math.PI) * 0.007;

      if (mouseLeftPressTimer > 0) {
        mouseLeftPressTimer = Math.max(0, mouseLeftPressTimer - dt * 7.5);
      }
      mouseLeftBtn.position.y = 0.026 - Math.sin(mouseLeftPressTimer * Math.PI) * 0.0045;

      // Synchronized 3D Beige Ball Mouse gliding smoothly on the mousepad
      mouseGroup.position.x = THREE.MathUtils.damp(
        mouseGroup.position.x,
        padOriginX + mouseTargetX,
        14,
        dt
      );
      mouseGroup.position.z = THREE.MathUtils.damp(
        mouseGroup.position.z,
        padOriginZ + mouseTargetZ,
        14,
        dt
      );

      for (let i = 0; i < keyAnims.length; i++) {
        const k = keyAnims[i];
        if (k.pressTimer > 0) {
          k.pressTimer = Math.max(0, k.pressTimer - dt * 7.0);
          k.mesh.position.y = k.restY - Math.sin(k.pressTimer * Math.PI) * k.pressDepth;
        }
      }

      // 3. CRT Degauss & Emissive Warmth
      if (degaussTimer > 0) {
        degaussTimer = Math.max(0, degaussTimer - dt);
        crtDirty = true;
      }
      const targetEmissive =
        osStage === 'OFF' ? 0.02 : osStage === 'NO_SIGNAL' ? 0.45 : 0.88;
      crtScreenMat.emissiveIntensity = THREE.MathUtils.damp(
        crtScreenMat.emissiveIntensity,
        targetEmissive,
        9,
        dt
      );

      // 4. BIOS Boot Progression (~2.5s)
      if (pcTowerOn && bootProgress < 1) {
        bootProgress = Math.min(1, bootProgress + dt * 0.4);
        if (crtMonitorOn && osStage === 'BIOS') {
          crtDirty = true;
        }
        if (bootProgress >= 1) {
          soundSynth.playPcBiosBeep();
          if (crtMonitorOn) {
            osStage = 'LOGIN';
            crtDirty = true;
          }
        }
      }

      // 5. Status Toast Decay
      if (statusBannerTimer > 0) {
        statusBannerTimer = Math.max(0, statusBannerTimer - dt);
        if (statusBannerTimer === 0) {
          statusBanner = '';
          crtDirty = true;
        }
      }

      // 6. Live 1-Second OS Clock & Caret Tick
      const curSec = Math.floor(elapsed * 2);
      if (curSec !== lastClockSec) {
        lastClockSec = curSec;
        if (osStage === 'LOGIN' || osStage === 'DESKTOP') {
          crtDirty = true;
        }
      }

      // 7. Throttled Live 4-Channel CCTV Render-to-Texture (4 Hz ONLY when Videosurveillance.exe open)
      if (pcTowerOn && crtMonitorOn && osStage === 'DESKTOP' && activeApp === 'cctv') {
        const now = performance.now();
        if (now - lastCctvCaptureTime >= 250) {
          lastCctvCaptureTime = now;
          captureLiveCctvFrame();
        }
      }

      // 8. Redraw CRT Canvas only when dirty
      if (crtDirty) {
        crtDirty = false;
        renderCrtCanvas(elapsed);
      }
    },
  });
}
