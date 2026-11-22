import * as THREE from 'three';
import { MaterialLibrary } from '../materials';
import { INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { CoinBreakdown, InteractableItem, WorldBuildContext } from '../types';
import { AcceptedChangerBillDenom, PlayerWallet } from '../wallet';
import { createFrancNoteCanvas, FRANC_SPECS } from './atm1990';

type MonnayeurState =
  | 'IDLE'
  | 'INSERTING'
  | 'REJECTING'
  | 'BILL_INSERTED'
  | 'RETURNING'
  | 'DISPENSING'
  | 'COINS_READY'
  | 'COLLECTING';

type CoinDenom = 10 | 5 | 2 | 1;

interface FallingCoin {
  mesh: THREE.Mesh;
  active: boolean;
  denom: CoinDenom;
  delay: number;
  elapsed: number;
  vx: number;
  vy: number;
  vz: number;
  rotVx: number;
  rotVz: number;
  restY: number;
  settled: boolean;
  collectStartPos: THREE.Vector3;
}

const MONNAYEUR_PRESS_COOLDOWN_MS = 320;
const MAX_COIN_POOL = 44;

function computeCoinBreakdown(
  billValue: AcceptedChangerBillDenom,
  mode: 'all_10' | 'panache'
): CoinBreakdown {
  if (mode === 'all_10') {
    return { 10: billValue / 10, 5: 0, 2: 0, 1: 0 };
  }
  // Authentic French retail change mix summing to exact bill value
  if (billValue === 50) {
    // 2x10 + 4x5 + 3x2 + 4x1 = 20 + 20 + 6 + 4 = 50 ₣ (13 coins)
    return { 10: 2, 5: 4, 2: 3, 1: 4 };
  }
  if (billValue === 100) {
    // 5x10 + 6x5 + 7x2 + 6x1 = 50 + 30 + 14 + 6 = 100 ₣ (24 coins)
    return { 10: 5, 5: 6, 2: 7, 1: 6 };
  }
  // 200 ₣: 12x10 + 10x5 + 10x2 + 10x1 = 120 + 50 + 20 + 10 = 200 ₣ (42 coins)
  return { 10: 12, 5: 10, 2: 10, 1: 10 };
}

function formatCoinBreakdown(b: CoinBreakdown): string {
  const parts: string[] = [];
  if (b[10] > 0) parts.push(`${b[10]}×10₣`);
  if (b[5] > 0) parts.push(`${b[5]}×5₣`);
  if (b[2] > 0) parts.push(`${b[2]}×2₣`);
  if (b[1] > 0) parts.push(`${b[1]}×1₣`);
  return parts.join(' · ');
}

function totalCoinsValue(b: CoinBreakdown): number {
  return b[10] * 10 + b[5] * 5 + b[2] * 2 + b[1];
}

function totalCoinsCount(b: CoinBreakdown): number {
  return b[10] + b[5] + b[2] + b[1];
}

export function buildMonnayeur1990(
  ctx: WorldBuildContext,
  parent: THREE.Group,
  mats: MaterialLibrary,
  posX: number,
  posZ: number,
  wallet: PlayerWallet,
  onWalletChanged: () => void
): void {
  const root = new THREE.Group();
  root.position.set(posX, 0.02, posZ);
  parent.add(root);

  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyMat);

  // ============================================================================
  // 1. MACHINE STATE & STRICT SINGLE-PRESS DEBOUNCE (320ms LOCK)
  // ============================================================================
  let state: MonnayeurState = 'IDLE';
  let insertedBill: AcceptedChangerBillDenom | null = null;
  let trayBreakdown: CoinBreakdown = { 10: 0, 5: 0, 2: 0, 1: 0 };
  let animProgress = 0;
  let rejectFlashTimer = 0;
  let dispenseTimer = 0;
  let dispenseDuration = 1.0;
  let displayedLedAmount = 0;
  let ledTextOverride: string | null = null;
  let lastLedKey = '';

  let monnayeurLastPressTime = 0;
  const acquirePressLock = (): boolean => {
    const now = performance.now();
    if (now - monnayeurLastPressTime < MONNAYEUR_PRESS_COOLDOWN_MS) {
      return false;
    }
    monnayeurLastPressTime = now;
    return true;
  };

  const makeTexture = (canvas: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    if (repeatX > 1 || repeatY > 1) {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeatX, repeatY);
    }
    tex.needsUpdate = true;
    ctx.disposables.push(tex);
    return tex;
  };

  const registerProxy = (
    parentObj: THREE.Object3D,
    size: [number, number, number],
    pos: [number, number, number],
    item: Omit<InteractableItem, 'proxyMesh'>
  ) => {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    ctx.disposables.push(geo);
    const proxy = new THREE.Mesh(geo, proxyMat);
    proxy.position.set(pos[0], pos[1], pos[2]);
    proxy.layers.set(INTERACT_LAYER);
    parentObj.add(proxy);

    const fullItem: InteractableItem = { ...item, proxyMesh: proxy };
    proxy.userData.interactable = fullItem;
    ctx.interactables.push(fullItem);
    return fullItem;
  };

  // ============================================================================
  // 2. PROCEDURAL TEXTURES (HAMMERED SLATE-GREY, SIGNAGE, 7-SEG LED, COINS)
  // ============================================================================
  // Matte hammered slate-grey 1990 French industrial enamel texture
  const hammeredCanvas = document.createElement('canvas');
  hammeredCanvas.width = 256;
  hammeredCanvas.height = 256;
  {
    const c = hammeredCanvas.getContext('2d')!;
    c.fillStyle = '#47525e';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 650; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = 1.5 + Math.random() * 3.5;
      c.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(15,23,42,0.09)';
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  }
  const hammeredTex = makeTexture(hammeredCanvas, 2, 4);

  // Top sober printed industrial header signage (zero neon)
  const headerCanvas = document.createElement('canvas');
  headerCanvas.width = 1024;
  headerCanvas.height = 256;
  {
    const c = headerCanvas.getContext('2d')!;
    c.fillStyle = '#1e293b';
    c.fillRect(0, 0, 1024, 256);

    c.strokeStyle = '#94a3b8';
    c.lineWidth = 5;
    c.strokeRect(14, 14, 996, 228);

    c.fillStyle = '#f8fafc';
    c.textAlign = 'center';
    c.font = '800 54px "Plus Jakarta Sans", sans-serif';
    c.fillText('MONNAYEUR AUTOMATIQUE', 512, 98);

    c.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(64, 126);
    c.lineTo(960, 126);
    c.stroke();

    c.fillStyle = '#fde68a';
    c.font = '700 34px "JetBrains Mono", monospace';
    c.fillText('BILLETS 50₣ / 100₣ / 200₣  →  PIÈCES EN FRANCS', 512, 186);

    c.fillStyle = '#cbd5e1';
    c.font = '600 20px "Plus Jakarta Sans", sans-serif';
    c.fillText('CHANGE SANS FRAIS · PIÈCES 10₣ · 5₣ · 2₣ · 1₣', 512, 224);
  }
  const headerTex = makeTexture(headerCanvas);

  // Crisp 4-digit red 7-segment LED canvas ("000 ₣", "050 ₣", "100 ₣", "200 ₣")
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 512;
  ledCanvas.height = 160;
  const ledTex = makeTexture(ledCanvas);

  const draw7SegDigit = (
    c: CanvasRenderingContext2D,
    ch: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    // Segment map: [a(top), b(tr), c(br), d(bot), e(bl), f(tl), g(mid)]
    const map: Record<string, number[]> = {
      '0': [1, 1, 1, 1, 1, 1, 0],
      '1': [0, 1, 1, 0, 0, 0, 0],
      '2': [1, 1, 0, 1, 1, 0, 1],
      '3': [1, 1, 1, 1, 0, 0, 1],
      '4': [0, 1, 1, 0, 0, 1, 1],
      '5': [1, 0, 1, 1, 0, 1, 1],
      '6': [1, 0, 1, 1, 1, 1, 1],
      '7': [1, 1, 1, 0, 0, 0, 0],
      '8': [1, 1, 1, 1, 1, 1, 1],
      '9': [1, 1, 1, 1, 0, 1, 1],
      '-': [0, 0, 0, 0, 0, 0, 1],
      E: [1, 0, 0, 1, 1, 1, 1],
      r: [0, 0, 0, 0, 1, 0, 1],
      F: [1, 0, 0, 0, 1, 1, 1],
      ' ': [0, 0, 0, 0, 0, 0, 0],
    };
    const segs = map[ch] ?? map[' '];
    const t = 11;
    const halfH = h / 2;

    const fillSeg = (on: boolean, drawFn: () => void) => {
      c.fillStyle = on ? '#ef4444' : 'rgba(110, 22, 22, 0.22)';
      c.beginPath();
      drawFn();
      c.closePath();
      c.fill();
    };

    const drawH = (sx: number, sy: number, sw: number) => {
      c.moveTo(sx + t * 0.5, sy);
      c.lineTo(sx + sw - t * 0.5, sy);
      c.lineTo(sx + sw, sy + t * 0.5);
      c.lineTo(sx + sw - t * 0.5, sy + t);
      c.lineTo(sx + t * 0.5, sy + t);
      c.lineTo(sx, sy + t * 0.5);
    };
    const drawV = (sx: number, sy: number, sh: number) => {
      c.moveTo(sx + t * 0.5, sy);
      c.lineTo(sx + t, sy + t * 0.5);
      c.lineTo(sx + t, sy + sh - t * 0.5);
      c.lineTo(sx + t * 0.5, sy + sh);
      c.lineTo(sx, sy + sh - t * 0.5);
      c.lineTo(sx, sy + t * 0.5);
    };

    // a
    fillSeg(segs[0] === 1, () => drawH(x + 4, y, w - 8));
    // b
    fillSeg(segs[1] === 1, () => drawV(x + w - t, y + 4, halfH - 6));
    // c
    fillSeg(segs[2] === 1, () => drawV(x + w - t, y + halfH + 2, halfH - 6));
    // d
    fillSeg(segs[3] === 1, () => drawH(x + 4, y + h - t, w - 8));
    // e
    fillSeg(segs[4] === 1, () => drawV(x, y + halfH + 2, halfH - 6));
    // f
    fillSeg(segs[5] === 1, () => drawV(x, y + 4, halfH - 6));
    // g
    fillSeg(segs[6] === 1, () => drawH(x + 4, y + halfH - t * 0.5, w - 8));
  };

  const redrawLed = (val: number, overrideText: string | null) => {
    const key = overrideText ?? `NUM_${val}`;
    if (key === lastLedKey) return;
    lastLedKey = key;

    const c = ledCanvas.getContext('2d')!;
    c.fillStyle = '#0c0d10';
    c.fillRect(0, 0, 512, 160);

    c.strokeStyle = '#334155';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 504, 152);

    const str = overrideText
      ? overrideText.padStart(3, ' ').slice(0, 3)
      : Math.max(0, Math.min(999, Math.round(val)))
          .toString()
          .padStart(3, '0');

    draw7SegDigit(c, str[0], 34, 26, 72, 108);
    draw7SegDigit(c, str[1], 132, 26, 72, 108);
    draw7SegDigit(c, str[2], 230, 26, 72, 108);

    // 4th position: crisp 7-segment-style Franc symbol "F" + horizontal bar
    draw7SegDigit(c, 'F', 356, 26, 66, 108);
    c.fillStyle = '#ef4444';
    c.fillRect(348, 92, 54, 8);
    c.fillStyle = '#94a3b8';
    c.font = '700 18px "JetBrains Mono", monospace';
    c.textAlign = 'right';
    c.fillText('FRF', 488, 134);

    ledTex.needsUpdate = true;
  };
  redrawLed(0, null);

  // Reusable Franc banknote textures (exact 1990 Banque de France artwork)
  const francTextures: Record<50 | 100 | 200 | 500, THREE.CanvasTexture> = {
    50: makeTexture(createFrancNoteCanvas(FRANC_SPECS[50])),
    100: makeTexture(createFrancNoteCanvas(FRANC_SPECS[100])),
    200: makeTexture(createFrancNoteCanvas(FRANC_SPECS[200])),
    500: makeTexture(createFrancNoteCanvas(FRANC_SPECS[500])),
  };

  // Authentic 1990 French Franc Coin Face Textures
  const createCoinFaceTexture = (denom: CoinDenom): THREE.CanvasTexture => {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const c = cv.getContext('2d')!;
    const cx = 64;
    const cy = 64;

    if (denom === 10) {
      // Iconic 1988–1990 Bi-Metallic 10 Francs (Brass-gold outer ring + Nickel-silver center)
      c.fillStyle = '#caa038';
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = '#8a6918';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, cy, 60, 0, Math.PI * 2);
      c.stroke();

      c.fillStyle = '#d4dbe3';
      c.beginPath();
      c.arc(cx, cy, 40, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#64748b';
      c.lineWidth = 2;
      c.stroke();

      c.fillStyle = '#334155';
      c.textAlign = 'center';
      c.font = '800 28px "Plus Jakarta Sans", sans-serif';
      c.fillText('10 F', cx, cy + 8);
      c.font = '700 11px "JetBrains Mono", monospace';
      c.fillText('1990', cx, cy + 26);
    } else {
      // Nickel-silver 5F, 2F, 1F Semeuse coins
      const grad = c.createRadialGradient(50, 48, 10, 64, 64, 62);
      grad.addColorStop(0, '#eef2f6');
      grad.addColorStop(0.7, '#cbd5e1');
      grad.addColorStop(1, '#94a3b8');
      c.fillStyle = grad;
      c.fillRect(0, 0, 128, 128);

      c.strokeStyle = '#64748b';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(cx, cy, 58, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = '#94a3b8';
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(cx, cy, 51, 0, Math.PI * 2);
      c.stroke();

      c.fillStyle = '#334155';
      c.textAlign = 'center';
      c.font = '800 34px "Plus Jakarta Sans", sans-serif';
      c.fillText(`${denom} F`, cx, cy + 10);
      c.font = '700 12px "JetBrains Mono", monospace';
      c.fillText('RF 1990', cx, cy + 32);
    }

    return makeTexture(cv);
  };

  const coinFaceTextures: Record<CoinDenom, THREE.CanvasTexture> = {
    10: createCoinFaceTexture(10),
    5: createCoinFaceTexture(5),
    2: createCoinFaceTexture(2),
    1: createCoinFaceTexture(1),
  };

  // Printed label helper for industrial machine plaques
  const makePlaqueMaterial = (
    title: string,
    subtitle: string,
    bgHex: string,
    titleHex: string,
    subHex: string,
    borderHex: string,
    w = 512,
    h = 96
  ): THREE.MeshStandardMaterial => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = borderHex;
    c.lineWidth = 4;
    c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = titleHex;
    c.textAlign = 'left';
    c.font = '800 28px "Plus Jakarta Sans", sans-serif';
    c.fillText(title, 20, subtitle ? 42 : h / 2 + 10);
    if (subtitle) {
      c.fillStyle = subHex;
      c.font = '600 19px "JetBrains Mono", monospace';
      c.fillText(subtitle, 20, 74);
    }
    const mat = new THREE.MeshStandardMaterial({
      map: makeTexture(cv),
      roughness: 0.42,
      metalness: 0.12,
    });
    ctx.disposables.push(mat);
    return mat;
  };

  const makeKeyCapMaterial = (digit: string, bgHex: string, fgHex: string): THREE.MeshStandardMaterial => {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 6;
    c.strokeRect(8, 8, 112, 112);
    c.fillStyle = fgHex;
    c.textAlign = 'center';
    c.font = '800 62px "JetBrains Mono", monospace';
    c.fillText(digit, 64, 86);
    const mat = new THREE.MeshStandardMaterial({
      map: makeTexture(cv),
      roughness: 0.36,
      metalness: 0.25,
    });
    ctx.disposables.push(mat);
    return mat;
  };

  // ============================================================================
  // 3. SOBER 1990 INDUSTRIAL CABINET, SIGNAGE, LED READOUT & BILL VALIDATOR
  // ============================================================================
  const hammeredSteelMat = new THREE.MeshStandardMaterial({
    map: hammeredTex,
    color: 0xbec7d2,
    roughness: 0.58,
    metalness: 0.52,
  });
  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xc5ccd4,
    roughness: 0.4,
    metalness: 0.74,
  });
  const anodizedDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2d3748,
    roughness: 0.44,
    metalness: 0.58,
  });
  const darkCavityMat = new THREE.MeshStandardMaterial({
    color: 0x0f141c,
    roughness: 0.75,
    metalness: 0.15,
  });
  const headerMat = new THREE.MeshStandardMaterial({
    map: headerTex,
    roughness: 0.38,
    metalness: 0.15,
  });
  const ledScreenMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    emissiveMap: ledTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.78,
    roughness: 0.2,
    metalness: 0.08,
  });
  // Physical matte glass status lamps (no neon bloom!)
  const readyLampMat = new THREE.MeshStandardMaterial({
    color: 0x2f7d4f,
    emissive: 0x226b40,
    emissiveIntensity: 0.42,
    roughness: 0.32,
  });
  const rejectLampMat = new THREE.MeshStandardMaterial({
    color: 0x5c2323,
    emissive: 0xb91c1c,
    emissiveIntensity: 0.03,
    roughness: 0.34,
  });
  ctx.disposables.push(
    hammeredSteelMat,
    brushedSteelMat,
    anodizedDarkMat,
    darkCavityMat,
    headerMat,
    ledScreenMat,
    readyLampMat,
    rejectLampMat
  );

  // Heavy Matte Hammered Slate-Grey Armored Cabinet + Steel Mounting Plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.12, 0.4), anodizedDarkMat);
  plinth.position.set(0, 0.06, 0);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.94, 1.9, 0.36), hammeredSteelMat);
  cabinet.position.set(0, 1.07, 0);
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;

  // Recessed Brushed Stainless-Steel Front Faceplate
  const faceplate = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.44, 0.03), brushedSteelMat);
  faceplate.position.set(0, 1.02, 0.175);
  faceplate.receiveShadow = true;

  // Top Printed Industrial Signage Canopy (sober, no neon glow)
  const headerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.28, 0.4), anodizedDarkMat);
  headerFrame.position.set(0, 1.9, 0.01);
  const headerFace = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.22), headerMat);
  headerFace.position.set(0, 1.9, 0.214);

  // Security tubular barrel keylock on left door rim + hinge pins on right
  const lockBezel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 12), mats.chrome);
  lockBezel.rotation.x = Math.PI / 2;
  lockBezel.position.set(-0.43, 1.18, 0.184);
  const lockCore = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.022, 10), anodizedDarkMat);
  lockCore.rotation.x = Math.PI / 2;
  lockCore.position.set(-0.43, 1.18, 0.186);

  root.add(plinth, cabinet, faceplate, headerFrame, headerFace, lockBezel, lockCore);
  ctx.disposables.push(
    plinth.geometry,
    cabinet.geometry,
    faceplate.geometry,
    headerFrame.geometry,
    headerFace.geometry,
    lockBezel.geometry,
    lockCore.geometry
  );

  // --- 4-Digit Red 7-Segment LED Readout (Upper-Left Faceplate) ---
  const ledBezel = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.145, 0.032), anodizedDarkMat);
  ledBezel.position.set(-0.17, 1.56, 0.194);
  const ledScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.102), ledScreenMat);
  ledScreen.position.set(-0.17, 1.56, 0.212);
  const ledTitleMat = makePlaqueMaterial(
    'MONTANT INSÉRÉ',
    '',
    '#334155',
    '#f8fafc',
    '#cbd5e1',
    '#64748b',
    384,
    56
  );
  const ledTitlePlate = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.036), ledTitleMat);
  ledTitlePlate.position.set(-0.17, 1.655, 0.192);
  root.add(ledBezel, ledScreen, ledTitlePlate);
  ctx.disposables.push(ledBezel.geometry, ledScreen.geometry, ledTitlePlate.geometry);

  // --- Bill Validator Slot ("FENTE À BILLETS") + PRÊT / BILLET REFUSÉ Status Lamps ---
  const valGroup = new THREE.Group();
  valGroup.position.set(0.2, 1.54, 0.195);
  root.add(valGroup);

  const valLabelMat = makePlaqueMaterial(
    'FENTE À BILLETS',
    '50₣ · 100₣ · 200₣',
    '#1e293b',
    '#f8fafc',
    '#fde68a',
    '#64748b',
    384,
    92
  );
  const valLabelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.068), valLabelMat);
  valLabelPlate.position.set(0, 0.115, -0.002);

  const valHousing = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.135, 0.055), anodizedDarkMat);
  const valBezel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.068, 0.042), brushedSteelMat);
  valBezel.position.set(0, -0.015, 0.024);
  const valMouth = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.012, 0.048), mats.rubberBlack);
  valMouth.position.set(0, -0.018, 0.028);

  // Two matte glass status lamps ("PRÊT" green / "BILLET REFUSÉ" red)
  const lampCollarGeo = new THREE.CylinderGeometry(0.013, 0.014, 0.012, 12);
  const lampLensGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.016, 12);
  ctx.disposables.push(lampCollarGeo, lampLensGeo);

  const readyCollar = new THREE.Mesh(lampCollarGeo, mats.chrome);
  readyCollar.rotation.x = Math.PI / 2;
  readyCollar.position.set(-0.075, 0.036, 0.026);
  const readyLamp = new THREE.Mesh(lampLensGeo, readyLampMat);
  readyLamp.rotation.x = Math.PI / 2;
  readyLamp.position.set(-0.075, 0.036, 0.028);

  const rejectCollar = new THREE.Mesh(lampCollarGeo, mats.chrome);
  rejectCollar.rotation.x = Math.PI / 2;
  rejectCollar.position.set(0.03, 0.036, 0.026);
  const rejectLamp = new THREE.Mesh(lampLensGeo, rejectLampMat);
  rejectLamp.rotation.x = Math.PI / 2;
  rejectLamp.position.set(0.03, 0.036, 0.028);

  // Tiny printed "PRÊT / REFUSÉ" legend strip beside the two jewel lamps
  const lampLegendCanvas = document.createElement('canvas');
  lampLegendCanvas.width = 256;
  lampLegendCanvas.height = 40;
  {
    const c = lampLegendCanvas.getContext('2d')!;
    c.fillStyle = '#2d3748';
    c.fillRect(0, 0, 256, 40);
    c.fillStyle = '#cbd5e1';
    c.font = '700 17px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText('PRÊT', 26, 26);
    c.fillText('REFUSÉ', 152, 26);
  }
  const lampLegendMat = new THREE.MeshStandardMaterial({
    map: makeTexture(lampLegendCanvas),
    roughness: 0.45,
  });
  const lampLegend = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.026), lampLegendMat);
  lampLegend.position.set(0, 0.056, 0.029);

  valGroup.add(
    valLabelPlate,
    valHousing,
    valBezel,
    valMouth,
    readyCollar,
    readyLamp,
    rejectCollar,
    rejectLamp,
    lampLegend
  );
  ctx.disposables.push(
    valLabelPlate.geometry,
    valHousing.geometry,
    valBezel.geometry,
    valMouth.geometry,
    lampLegendMat,
    lampLegend.geometry
  );

  // Animated 3D Banknote + Stylized Player Hand for Bill Insertion / Return
  const activeNoteMat = new THREE.MeshStandardMaterial({
    map: francTextures[100],
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const activeNoteGeo = new THREE.BoxGeometry(0.14, 0.0035, 0.088);
  const activeNoteMesh = new THREE.Mesh(activeNoteGeo, activeNoteMat);
  activeNoteMesh.position.set(0, -0.018, 0.12);
  activeNoteMesh.visible = false;
  valGroup.add(activeNoteMesh);
  ctx.disposables.push(activeNoteMat, activeNoteGeo);

  const handGroup = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.65 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.78 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.034, 0.105), skinMat);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.02, 0.058), skinMat);
  thumb.position.set(-0.044, 0.015, -0.042);
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.022, 0.052), skinMat);
  fingers.position.set(0.004, -0.012, -0.05);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.054, 0.17, 10), cuffMat);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0, -0.01, 0.13);
  handGroup.add(palm, thumb, fingers, sleeve);
  handGroup.visible = false;
  valGroup.add(handGroup);
  ctx.disposables.push(
    skinMat,
    cuffMat,
    palm.geometry,
    thumb.geometry,
    fingers.geometry,
    sleeve.geometry
  );

  let animatingBillDenom: 50 | 100 | 200 | 500 = 100;

  registerProxy(valGroup, [0.3, 0.22, 0.16], [0, 0.01, 0.04], {
    id: 'monnayeur_bill_slot',
    title: 'Fente à Billets (Monnayeur 1990)',
    subtitle: 'Accepte 50 ₣ · 100 ₣ · 200 ₣',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => state === 'IDLE',
    dynamicVerb: () => {
      const nextBill = wallet.peekNextChangerBill();
      if (nextBill) return `INSÉRER UN BILLET (${nextBill} ₣)`;
      if (wallet.hasRejected500BillOnly()) return 'INSÉRER BILLET 500 ₣';
      return 'INSÉRER UN BILLET (50₣ / 100₣ / 200₣)';
    },
    dynamicTitle: () => {
      const nextBill = wallet.peekNextChangerBill();
      if (nextBill) {
        return `Fente à Billets · Billet ${nextBill} ₣ (${FRANC_SPECS[nextBill].figure})`;
      }
      if (wallet.hasRejected500BillOnly()) {
        return 'Fente à Billets · Coupure 500 ₣ non acceptée';
      }
      return 'Fente à Billets · Aucun billet 50/100/200 ₣';
    },
    dynamicSubtitle: () => {
      const nextBill = wallet.peekNextChangerBill();
      if (nextBill) {
        return `Portefeuille billets : ${wallet.getBillsSummaryText()}`;
      }
      return 'Retirez un billet de 50, 100 ou 200 ₣ au DAB voisin';
    },
    onInteract: () => {
      if (!acquirePressLock()) return;
      if (state !== 'IDLE') return;

      const consumed = wallet.consumeChangerBill();
      if (consumed) {
        animatingBillDenom = consumed;
        insertedBill = consumed;
        activeNoteMat.map = francTextures[consumed];
        activeNoteMat.needsUpdate = true;
        activeNoteMesh.visible = true;
        handGroup.visible = true;
        state = 'INSERTING';
        animProgress = 0;
        soundSynth.playCardMotorPull();
        onWalletChanged();
        return;
      }

      if (wallet.hasRejected500BillOnly()) {
        // Authentic 500 ₣ rejection animation!
        animatingBillDenom = 500;
        activeNoteMat.map = francTextures[500];
        activeNoteMat.needsUpdate = true;
        activeNoteMesh.visible = true;
        handGroup.visible = true;
        state = 'REJECTING';
        animProgress = 0;
        rejectFlashTimer = 1.6;
        ledTextOverride = 'Err';
        soundSynth.playBillReject();
        return;
      }

      // Empty wallet: brief red lamp + reject tone
      rejectFlashTimer = 1.1;
      ledTextOverride = '---';
      soundSynth.playBillReject();
    },
  });

  // ============================================================================
  // 4. THREE PHYSICAL 3D INDUSTRIAL PUSH-BUTTONS (STRICT 320ms SINGLE-PRESS)
  // ============================================================================
  const buttonDeck = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.39, 0.02), anodizedDarkMat);
  buttonDeck.position.set(0, 1.2, 0.193);
  root.add(buttonDeck);
  ctx.disposables.push(buttonDeck.geometry);

  const animatedButtons: Array<{ mesh: THREE.Object3D; restZ: number; press: number }> = [];

  const buttonSpecs: Array<{
    id: string;
    rowY: number;
    keyDigit: string;
    keyBg: string;
    keyFg: string;
    title: string;
    subtitle: string;
    plaqueBg: string;
    plaqueBorder: string;
    action: () => void;
    verbFn: () => string;
    subtitleFn: () => string;
  }> = [
    {
      id: 'monnayeur_btn_10f',
      rowY: 1.315,
      keyDigit: '1',
      keyBg: '#b48a2c',
      keyFg: '#0f172a',
      title: '[1] PIÈCES DE 10 ₣',
      subtitle: 'TOUT EN PIÈCES BI-MÉTAL 10 FRANCS',
      plaqueBg: '#1e293b',
      plaqueBorder: '#caa038',
      verbFn: () =>
        state === 'BILL_INSERTED' && insertedBill
          ? `DISTRIBUER ${insertedBill / 10}×10 ₣`
          : 'APPUYER [1] PIÈCES 10 ₣',
      subtitleFn: () =>
        state === 'BILL_INSERTED' && insertedBill
          ? `${insertedBill / 10} pièces bi-métal de 10 Francs (${insertedBill} ₣)`
          : 'Insérez d’abord un billet de 50, 100 ou 200 ₣',
      action: () => triggerDispense('all_10'),
    },
    {
      id: 'monnayeur_btn_panache',
      rowY: 1.195,
      keyDigit: '2',
      keyBg: '#254a7c',
      keyFg: '#f8fafc',
      title: '[2] PANACHÉ 10₣/5₣/2₣/1₣',
      subtitle: 'ASSORTIMENT MONNAIE POUR LA CAISSE',
      plaqueBg: '#1e293b',
      plaqueBorder: '#93c5fd',
      verbFn: () =>
        state === 'BILL_INSERTED' && insertedBill
          ? `DISTRIBUER PANACHÉ (${insertedBill} ₣)`
          : 'APPUYER [2] PANACHÉ',
      subtitleFn: () => {
        if (state === 'BILL_INSERTED' && insertedBill) {
          const b = computeCoinBreakdown(insertedBill, 'panache');
          return formatCoinBreakdown(b);
        }
        return 'Assortiment réaliste 10 ₣ / 5 ₣ / 2 ₣ / 1 ₣';
      },
      action: () => triggerDispense('panache'),
    },
    {
      id: 'monnayeur_btn_cancel',
      rowY: 1.075,
      keyDigit: '3',
      keyBg: '#8b2635',
      keyFg: '#f8fafc',
      title: '[3] ANNULER / RENDRE BILLET',
      subtitle: 'RESTITUTION DU BILLET INSÉRÉ',
      plaqueBg: '#231f24',
      plaqueBorder: '#9f4a54',
      verbFn: () =>
        state === 'BILL_INSERTED' && insertedBill
          ? `RENDRE LE BILLET (${insertedBill} ₣)`
          : 'APPUYER [3] ANNULER',
      subtitleFn: () =>
        state === 'BILL_INSERTED' && insertedBill
          ? `Annule le change et restitue votre billet de ${insertedBill} ₣`
          : 'Aucun billet en attente dans le lecteur',
      action: () => triggerReturnBill(),
    },
  ];

  const collarGeo = new THREE.BoxGeometry(0.115, 0.088, 0.022);
  const capGeo = new THREE.BoxGeometry(0.088, 0.068, 0.032);
  const plaqueGeo = new THREE.PlaneGeometry(0.53, 0.086);
  const capSideMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.4,
  });
  ctx.disposables.push(collarGeo, capGeo, plaqueGeo, capSideMat);

  buttonSpecs.forEach((spec) => {
    const collar = new THREE.Mesh(collarGeo, brushedSteelMat);
    collar.position.set(-0.275, spec.rowY, 0.205);
    root.add(collar);

    const frontMat = makeKeyCapMaterial(spec.keyDigit, spec.keyBg, spec.keyFg);
    const cap = new THREE.Mesh(capGeo, [
      capSideMat,
      capSideMat,
      capSideMat,
      capSideMat,
      frontMat,
      capSideMat,
    ]);
    const restZ = 0.222;
    cap.position.set(-0.275, spec.rowY, restZ);
    root.add(cap);

    const pressState = { mesh: cap, restZ, press: 0 };
    animatedButtons.push(pressState);

    const plaqueMat = makePlaqueMaterial(
      spec.title,
      spec.subtitle,
      spec.plaqueBg,
      '#f8fafc',
      '#cbd5e1',
      spec.plaqueBorder,
      640,
      104
    );
    const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
    plaque.position.set(0.07, spec.rowY, 0.205);
    root.add(plaque);

    registerProxy(root, [0.68, 0.1, 0.09], [0, spec.rowY, 0.22], {
      id: spec.id,
      title: spec.title,
      subtitle: spec.subtitle,
      kind: 'diegetic_action',
      state: false,
      inspectText: '',
      dynamicVerb: spec.verbFn,
      dynamicTitle: () => spec.title,
      dynamicSubtitle: spec.subtitleFn,
      onInteract: () => {
        if (!acquirePressLock()) return;
        pressState.press = 1;
        soundSynth.playMechanicalButtonClick();
        spec.action();
      },
    });
  });

  // ============================================================================
  // 5. DEEP RECESSED STAINLESS-STEEL COIN TRAY ("BAC À PIÈCES") + 3D COINS
  // ============================================================================
  const trayGroup = new THREE.Group();
  trayGroup.position.set(0, 0.72, 0.185);
  root.add(trayGroup);

  const trayLabelMat = makePlaqueMaterial(
    'BAC À PIÈCES  ·  MONNAIE EN FRANCS',
    '',
    '#334155',
    '#f8fafc',
    '#cbd5e1',
    '#64748b',
    512,
    56
  );
  const trayLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.044), trayLabelMat);
  trayLabel.position.set(0, 0.185, 0.008);

  // Stainless steel surround frame + deep recessed tray cavity
  const trayTopBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.032, 0.085), brushedSteelMat);
  trayTopBar.position.set(0, 0.145, 0.015);
  const trayBotBar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.042, 0.125), brushedSteelMat);
  trayBotBar.position.set(0, -0.132, 0.035);
  const trayLeftCheek = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.3, 0.115), brushedSteelMat);
  trayLeftCheek.position.set(-0.282, 0.008, 0.028);
  const trayRightCheek = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.3, 0.115), brushedSteelMat);
  trayRightCheek.position.set(0.282, 0.008, 0.028);

  // Dark inner back wall & sloped stainless dispensing floor + front retaining lip
  const trayBackWall = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.25, 0.02), darkCavityMat);
  trayBackWall.position.set(0, 0.01, -0.075);
  const trayInnerFloor = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.018, 0.18), mats.stainless);
  trayInnerFloor.position.set(0, -0.105, 0.005);
  trayInnerFloor.rotation.x = 0.16;
  const trayFrontLip = new THREE.Mesh(new THREE.BoxGeometry(0.53, 0.044, 0.016), brushedSteelMat);
  trayFrontLip.position.set(0, -0.098, 0.088);

  // Hinged internal chute baffle flap (kicks forward when coins cascade down)
  const bafflePivot = new THREE.Group();
  bafflePivot.position.set(0, 0.125, -0.02);
  const baffleFlap = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.01), mats.stainless);
  baffleFlap.position.set(0, -0.06, 0);
  bafflePivot.add(baffleFlap);

  trayGroup.add(
    trayLabel,
    trayTopBar,
    trayBotBar,
    trayLeftCheek,
    trayRightCheek,
    trayBackWall,
    trayInnerFloor,
    trayFrontLip,
    bafflePivot
  );
  ctx.disposables.push(
    trayLabel.geometry,
    trayTopBar.geometry,
    trayBotBar.geometry,
    trayLeftCheek.geometry,
    trayRightCheek.geometry,
    trayBackWall.geometry,
    trayInnerFloor.geometry,
    trayFrontLip.geometry,
    baffleFlap.geometry
  );

  // --- Pre-allocated 3D French Franc Coin Pool (Zero GC during cascade!) ---
  const coinSpecs: Record<CoinDenom, { radius: number; thickness: number; edgeHex: number }> = {
    10: { radius: 0.022, thickness: 0.0046, edgeHex: 0xc99c32 }, // Bi-metallic brass rim 10 F
    5: { radius: 0.0255, thickness: 0.0042, edgeHex: 0xcbd5e1 }, // Large silver-nickel 5 F
    2: { radius: 0.023, thickness: 0.0038, edgeHex: 0xd1d5db }, // Silver-nickel 2 F
    1: { radius: 0.0205, thickness: 0.0036, edgeHex: 0xd8dee6 }, // Silver-nickel 1 F
  };

  const coinGeometries: Record<CoinDenom, THREE.CylinderGeometry> = {
    10: new THREE.CylinderGeometry(coinSpecs[10].radius, coinSpecs[10].radius, coinSpecs[10].thickness, 18),
    5: new THREE.CylinderGeometry(coinSpecs[5].radius, coinSpecs[5].radius, coinSpecs[5].thickness, 18),
    2: new THREE.CylinderGeometry(coinSpecs[2].radius, coinSpecs[2].radius, coinSpecs[2].thickness, 18),
    1: new THREE.CylinderGeometry(coinSpecs[1].radius, coinSpecs[1].radius, coinSpecs[1].thickness, 18),
  };
  ctx.disposables.push(coinGeometries[10], coinGeometries[5], coinGeometries[2], coinGeometries[1]);

  const coinMaterials: Record<CoinDenom, THREE.Material[]> = {
    10: makeCoinMaterials(10),
    5: makeCoinMaterials(5),
    2: makeCoinMaterials(2),
    1: makeCoinMaterials(1),
  };

  function makeCoinMaterials(denom: CoinDenom): THREE.Material[] {
    const edgeMat = new THREE.MeshStandardMaterial({
      color: coinSpecs[denom].edgeHex,
      roughness: 0.25,
      metalness: 0.88,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      map: coinFaceTextures[denom],
      roughness: 0.24,
      metalness: 0.78,
    });
    ctx.disposables.push(edgeMat, faceMat);
    return [edgeMat, faceMat, faceMat];
  }

  const coinPool: FallingCoin[] = [];
  for (let i = 0; i < MAX_COIN_POOL; i++) {
    const mesh = new THREE.Mesh(coinGeometries[10], coinMaterials[10]);
    mesh.visible = false;
    trayGroup.add(mesh);
    coinPool.push({
      mesh,
      active: false,
      denom: 10,
      delay: 0,
      elapsed: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rotVx: 0,
      rotVz: 0,
      restY: -0.095,
      settled: false,
      collectStartPos: new THREE.Vector3(),
    });
  }

  // Spawn 3D coin cascade inside the stainless steel tray
  const launchCoinCascade = (breakdown: CoinBreakdown) => {
    const list: CoinDenom[] = [];
    const denoms: CoinDenom[] = [10, 5, 2, 1];
    for (const d of denoms) {
      for (let k = 0; k < breakdown[d]; k++) {
        list.push(d);
      }
    }
    // Shuffle slightly so bi-metallic 10F and silver coins intermix naturally in panaché mode
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }

    const count = Math.min(list.length, MAX_COIN_POOL);
    for (let i = 0; i < MAX_COIN_POOL; i++) {
      const c = coinPool[i];
      if (i >= count) {
        c.active = false;
        c.mesh.visible = false;
        continue;
      }
      const denom = list[i];
      c.denom = denom;
      c.mesh.geometry = coinGeometries[denom];
      c.mesh.material = coinMaterials[denom];
      c.active = true;
      c.settled = false;
      c.elapsed = 0;
      c.delay = i * 0.034 + Math.random() * 0.015;

      // Start hidden inside the upper chute mouth
      const startX = (Math.random() - 0.5) * 0.28;
      c.mesh.position.set(startX, 0.11, -0.045);
      c.mesh.rotation.set(
        (Math.random() - 0.5) * 1.4,
        Math.random() * Math.PI * 2,
        (Math.random() - 0.5) * 1.4
      );
      c.mesh.visible = false;

      // Velocity: tumble forward & spread across tray floor
      c.vx = (Math.random() - 0.5) * 0.36;
      c.vy = -0.35 - Math.random() * 0.35;
      c.vz = 0.24 + Math.random() * 0.26;
      c.rotVx = (Math.random() - 0.5) * 14;
      c.rotVz = (Math.random() - 0.5) * 14;

      // Stack coins naturally into a glistening mound in the tray
      const layer = Math.floor(i / 11);
      c.restY = -0.094 + layer * 0.0044 + Math.random() * 0.002;
    }

    dispenseDuration = Math.max(0.95, count * 0.034 + 0.52);
    dispenseTimer = 0;
  };

  // Actions invoked by the 3 physical push-buttons
  function triggerDispense(mode: 'all_10' | 'panache'): void {
    if (state !== 'BILL_INSERTED' || !insertedBill) {
      rejectFlashTimer = 0.65;
      soundSynth.playBillReject();
      return;
    }

    trayBreakdown = computeCoinBreakdown(insertedBill, mode);
    const totalCount = totalCoinsCount(trayBreakdown);
    insertedBill = null;
    state = 'DISPENSING';
    launchCoinCascade(trayBreakdown);
    soundSynth.playCoinCascade(totalCount);
  }

  function triggerReturnBill(): void {
    if (state !== 'BILL_INSERTED' || !insertedBill) {
      rejectFlashTimer = 0.65;
      soundSynth.playBillReject();
      return;
    }

    animatingBillDenom = insertedBill;
    activeNoteMat.map = francTextures[insertedBill];
    activeNoteMat.needsUpdate = true;
    activeNoteMesh.visible = true;
    handGroup.visible = true;
    state = 'RETURNING';
    animProgress = 0;
    soundSynth.playCardEject();
  }

  // Coin Tray Pickup Interactable ("[RÉCUPÉRER LES PIÈCES]")
  registerProxy(trayGroup, [0.58, 0.32, 0.24], [0, -0.01, 0.04], {
    id: 'monnayeur_collect_coins',
    title: 'Bac à Pièces (Francs 1990)',
    subtitle: 'Pièces en Francs disponibles',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => state === 'COINS_READY',
    dynamicVerb: () => 'RÉCUPÉRER LES PIÈCES',
    dynamicTitle: () => `Pièces en Francs (${totalCoinsValue(trayBreakdown)} ₣)`,
    dynamicSubtitle: () => formatCoinBreakdown(trayBreakdown),
    onInteract: () => {
      if (!acquirePressLock()) return;
      if (state !== 'COINS_READY') return;

      wallet.addCoins(trayBreakdown);
      soundSynth.playCoinCollect();
      state = 'COLLECTING';
      animProgress = 0;
      for (let i = 0; i < coinPool.length; i++) {
        if (coinPool[i].active) {
          coinPool[i].collectStartPos.copy(coinPool[i].mesh.position);
        }
      }
      onWalletChanged();
    },
  });

  // ============================================================================
  // 6. PER-FRAME ANIMATION & COIN CASCADE PHYSICS
  // ============================================================================
  ctx.updaters.push({
    update: (dt, elapsed) => {
      const blinkOn = Math.floor(elapsed * 2.5) % 2 === 0;

      // Physical 3D push-button spring return
      for (let i = 0; i < animatedButtons.length; i++) {
        const b = animatedButtons[i];
        if (b.press > 0.001) {
          b.press = THREE.MathUtils.damp(b.press, 0, 15, dt);
          b.mesh.position.z = b.restZ - b.press * 0.013;
        } else if (b.mesh.position.z !== b.restZ) {
          b.mesh.position.z = b.restZ;
        }
      }

      // Reject status lamp timer
      if (rejectFlashTimer > 0) {
        rejectFlashTimer -= dt;
        rejectLampMat.color.setHex(0xb91c1c);
        rejectLampMat.emissiveIntensity = blinkOn ? 0.65 : 0.18;
        if (rejectFlashTimer <= 0) {
          rejectLampMat.color.setHex(0x5c2323);
          rejectLampMat.emissiveIntensity = 0.03;
          ledTextOverride = null;
        }
      }

      // Ready lamp (subtle matte jewel indicator — zero neon)
      if (state === 'IDLE') {
        readyLampMat.color.setHex(0x2f7d4f);
        readyLampMat.emissiveIntensity = 0.42;
      } else if (state === 'BILL_INSERTED') {
        readyLampMat.color.setHex(0x3a945e);
        readyLampMat.emissiveIntensity = blinkOn ? 0.58 : 0.3;
      } else {
        readyLampMat.color.setHex(0x27573b);
        readyLampMat.emissiveIntensity = 0.16;
      }

      // Bill insertion animation (3D hand feeding Franc note into rollers)
      if (state === 'INSERTING') {
        animProgress += dt * 1.45;
        if (animProgress < 0.55) {
          const t = animProgress / 0.55;
          const zNote = THREE.MathUtils.lerp(0.24, 0.075, t);
          activeNoteMesh.position.set(0, -0.018, zNote);
          handGroup.position.set(0, -0.05, zNote + 0.085);
        } else if (animProgress < 1.0) {
          const t = (animProgress - 0.55) / 0.45;
          activeNoteMesh.position.set(0, -0.018, THREE.MathUtils.lerp(0.075, -0.04, t));
          handGroup.position.set(
            0,
            THREE.MathUtils.lerp(-0.05, -0.24, t),
            THREE.MathUtils.lerp(0.16, 0.32, t)
          );
        } else {
          activeNoteMesh.visible = false;
          handGroup.visible = false;
          state = 'BILL_INSERTED';
          displayedLedAmount = insertedBill ?? 0;
          ledTextOverride = null;
          soundSynth.playAtmPiezo('confirm');
        }
      }

      // Rejected 500 ₣ bill animation (enters partway, buzzes, spits back out)
      if (state === 'REJECTING') {
        animProgress += dt * 1.2;
        if (animProgress < 0.42) {
          const t = animProgress / 0.42;
          const zNote = THREE.MathUtils.lerp(0.22, 0.04, t);
          activeNoteMesh.position.set(0, -0.018, zNote);
          handGroup.position.set(0, -0.05, zNote + 0.085);
        } else if (animProgress < 1.0) {
          const t = (animProgress - 0.42) / 0.58;
          const zNote = THREE.MathUtils.lerp(0.04, 0.26, t);
          activeNoteMesh.position.set(0, -0.018, zNote);
          handGroup.position.set(0, -0.05, zNote + 0.085);
        } else {
          activeNoteMesh.visible = false;
          handGroup.visible = false;
          state = 'IDLE';
          ledTextOverride = null;
        }
      }

      // Returned bill animation ([3] ANNULER / RENDRE BILLET)
      if (state === 'RETURNING') {
        animProgress += dt * 1.5;
        if (animProgress < 1.0) {
          const zNote = THREE.MathUtils.lerp(-0.03, 0.25, animProgress);
          activeNoteMesh.position.set(0, -0.018, zNote);
          handGroup.position.set(0, -0.05, zNote + 0.085);
        } else {
          activeNoteMesh.visible = false;
          handGroup.visible = false;
          if (insertedBill) {
            wallet.addBill(animatingBillDenom, 1);
            insertedBill = null;
          }
          displayedLedAmount = 0;
          state = 'IDLE';
          soundSynth.playPaperGrab();
          onWalletChanged();
        }
      }

      // Coin cascade physics & baffle flap recoil
      let targetBaffleRot = 0;
      if (state === 'DISPENSING') {
        dispenseTimer += dt;
        const frac = THREE.MathUtils.clamp(dispenseTimer / dispenseDuration, 0, 1);
        displayedLedAmount = Math.round(totalCoinsValue(trayBreakdown) * (1 - frac));
        targetBaffleRot = -0.34 - Math.sin(elapsed * 26) * 0.09;

        for (let i = 0; i < coinPool.length; i++) {
          const c = coinPool[i];
          if (!c.active) continue;
          c.elapsed += dt;
          if (c.elapsed < c.delay) continue;

          if (!c.mesh.visible) {
            c.mesh.visible = true;
          }
          if (c.settled) continue;

          // Gravity + tray boundary collisions
          c.vy -= 6.8 * dt;
          c.mesh.position.x += c.vx * dt;
          c.mesh.position.y += c.vy * dt;
          c.mesh.position.z += c.vz * dt;

          // Keep coins neatly inside stainless steel tray walls
          if (c.mesh.position.x < -0.22) {
            c.mesh.position.x = -0.22;
            c.vx = Math.abs(c.vx) * 0.42;
          } else if (c.mesh.position.x > 0.22) {
            c.mesh.position.x = 0.22;
            c.vx = -Math.abs(c.vx) * 0.42;
          }
          if (c.mesh.position.z > 0.062) {
            c.mesh.position.z = 0.062;
            c.vz = -Math.abs(c.vz) * 0.35;
          } else if (c.mesh.position.z < -0.052) {
            c.mesh.position.z = -0.052;
            c.vz = Math.abs(c.vz) * 0.45;
          }

          // Floor bounce + flat settling
          if (c.mesh.position.y <= c.restY) {
            c.mesh.position.y = c.restY;
            if (Math.abs(c.vy) > 0.32) {
              c.vy = -c.vy * 0.34;
              c.vx *= 0.65;
              c.vz *= 0.65;
            } else {
              c.vy = 0;
              c.vx = 0;
              c.vz = 0;
              c.settled = true;
              // Settle mostly flat with subtle natural overlap tilt
              c.mesh.rotation.x = (Math.random() - 0.5) * 0.24;
              c.mesh.rotation.z = (Math.random() - 0.5) * 0.24;
            }
          } else {
            c.mesh.rotation.x += c.rotVx * dt;
            c.mesh.rotation.z += c.rotVz * dt;
          }
        }

        if (dispenseTimer >= dispenseDuration) {
          displayedLedAmount = 0;
          state = 'COINS_READY';
          // Snap any remaining coins cleanly to rest
          for (let i = 0; i < coinPool.length; i++) {
            const c = coinPool[i];
            if (c.active && !c.settled) {
              c.mesh.visible = true;
              c.mesh.position.y = c.restY;
              c.mesh.rotation.x = (Math.random() - 0.5) * 0.22;
              c.mesh.rotation.z = (Math.random() - 0.5) * 0.22;
              c.settled = true;
            }
          }
        }
      }

      // Coin scoop-out collection animation
      if (state === 'COLLECTING') {
        animProgress += dt * 3.2;
        const t = THREE.MathUtils.clamp(animProgress, 0, 1);
        for (let i = 0; i < coinPool.length; i++) {
          const c = coinPool[i];
          if (!c.active) continue;
          c.mesh.position.set(
            THREE.MathUtils.lerp(c.collectStartPos.x, 0, t),
            THREE.MathUtils.lerp(c.collectStartPos.y, 0.04, t),
            THREE.MathUtils.lerp(c.collectStartPos.z, 0.26, t)
          );
          c.mesh.scale.setScalar(1 - t * 0.7);
        }
        if (t >= 1) {
          for (let i = 0; i < coinPool.length; i++) {
            coinPool[i].active = false;
            coinPool[i].mesh.visible = false;
            coinPool[i].mesh.scale.setScalar(1);
          }
          trayBreakdown = { 10: 0, 5: 0, 2: 0, 1: 0 };
          state = 'IDLE';
        }
      }

      bafflePivot.rotation.x = THREE.MathUtils.damp(bafflePivot.rotation.x, targetBaffleRot, 14, dt);

      // Update 4-digit red 7-segment LED display
      if (state === 'BILL_INSERTED' && insertedBill) {
        redrawLed(insertedBill, null);
      } else {
        redrawLed(displayedLedAmount, ledTextOverride);
      }
    },
  });
}
