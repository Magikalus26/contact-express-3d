import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { INTERACT_LAYER, ProceduralTextureBank } from '../textures';
import { soundSynth } from '../audio';
import { InteractableItem, WorldBuildContext } from '../types';
import { PlayerWallet } from '../wallet';
import { createFrancNoteCanvas, FRANC_SPECS } from './atm1990';

interface CatalogProduct {
  code: string;
  ean: string;
  vfdName: string;
  displayName: string;
  priceFrancs: number;
  shape: 'baguette' | 'box' | 'cylinder' | 'bottle' | 'manga' | 'pack';
  color: number;
  accent: number;
  size: [number, number, number];
}

const PRODUCTS_1990: CatalogProduct[] = [
  {
    code: '301',
    ean: '30140301',
    vfdName: 'BAGUETTE TRADITION',
    displayName: 'Baguette Tradition 250g',
    priceFrancs: 4,
    shape: 'baguette',
    color: 0xd99b43,
    accent: 0xf5d08a,
    size: [0.34, 0.06, 0.07],
  },
  {
    code: '302',
    ean: '30140303',
    vfdName: 'PAIN AU CHOCOLAT',
    displayName: 'Pain au Chocolat',
    priceFrancs: 6,
    shape: 'box',
    color: 0xc27834,
    accent: 0xfef3c7,
    size: [0.16, 0.07, 0.13],
  },
  {
    code: '303',
    ean: '30160103',
    vfdName: 'CAMEMBERT 250G',
    displayName: 'Camembert Normand 250g',
    priceFrancs: 12,
    shape: 'cylinder',
    color: 0xe7d4b5,
    accent: 0x1d4ed8,
    size: [0.12, 0.045, 0.12],
  },
  {
    code: '304',
    ean: '30160101',
    vfdName: 'LAIT ENTIER 1L',
    displayName: 'Brique Lait Entier 1L',
    priceFrancs: 6,
    shape: 'box',
    color: 0xf1f5f9,
    accent: 0x2563eb,
    size: [0.085, 0.19, 0.085],
  },
  {
    code: '305',
    ean: '30180102',
    vfdName: 'CAFE MOULU 250G',
    displayName: 'Café Moulu Arabica 250g',
    priceFrancs: 15,
    shape: 'box',
    color: 0x991b1b,
    accent: 0xfde68a,
    size: [0.11, 0.15, 0.075],
  },
  {
    code: '306',
    ean: '30180101',
    vfdName: 'PATES COQUILLETTES',
    displayName: 'Pâtes Coquillettes 500g',
    priceFrancs: 7,
    shape: 'box',
    color: 0xeab308,
    accent: 0x1e3a8a,
    size: [0.13, 0.17, 0.065],
  },
  {
    code: '307',
    ean: '30210101',
    vfdName: 'MANGA MIANIMAL T1',
    displayName: 'Manga Mianimal Tome 1',
    priceFrancs: 35,
    shape: 'manga',
    color: 0x0284c7,
    accent: 0xf43f5e,
    size: [0.125, 0.025, 0.18],
  },
  {
    code: '308',
    ean: '30160106',
    vfdName: 'COLA FRAIS 1.5L',
    displayName: 'Soda Cola 1,5L',
    priceFrancs: 9,
    shape: 'bottle',
    color: 0x291811,
    accent: 0xdc2626,
    size: [0.09, 0.27, 0.09],
  },
  {
    code: '309',
    ean: '30180103',
    vfdName: 'BISCUITS BEURRE',
    displayName: 'Biscuits Pur Beurre',
    priceFrancs: 11,
    shape: 'box',
    color: 0xb45309,
    accent: 0xfef08a,
    size: [0.17, 0.075, 0.11],
  },
  {
    code: '310',
    ean: '30160104',
    vfdName: 'YAOURTS NATURE X4',
    displayName: 'Yaourts Nature ×4',
    priceFrancs: 10,
    shape: 'pack',
    color: 0xf8fafc,
    accent: 0x16a34a,
    size: [0.14, 0.07, 0.14],
  },
];

interface ScannedLine {
  name: string;
  price: number;
}

interface BeltItemSlot {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  accentMesh: THREE.Mesh;
  proxyMesh: THREE.Mesh;
  active: boolean;
  scanned: boolean;
  bagged: boolean;
  product: CatalogProduct;
  zPos: number;
  targetBagPos: THREE.Vector3;
  bagAnimT: number;
}

type PaymentMode = 'NONE' | 'CASH_OPEN' | 'CB_INSERT' | 'CB_AUTH' | 'CB_APPROVED';

const CHECKOUT_PRESS_COOLDOWN_MS = 320;

export interface HandheldScannerShared {
  heldByLane: number | null;
  pickUp: (laneNum: number) => void;
  putDown: () => void;
  flashLaser: (worldTarget: THREE.Vector3) => void;
}

function formatFrancsTwoDec(v: number): string {
  const whole = Math.floor(Math.abs(v));
  const dec = Math.round((Math.abs(v) - whole) * 100)
    .toString()
    .padStart(2, '0');
  return `${v < 0 ? '-' : ''}${whole},${dec} ₣`;
}

function formatVfdAmount(v: number): string {
  return `${Math.round(v)},00F`;
}

/**
 * Shared first-person 1990 handheld laser barcode scanner ("Douchette Laser")
 * attached cleanly to the player's camera when picked up from Caisse 1 or Caisse 2.
 */
export function createSharedHandheldScanner(
  ctx: WorldBuildContext,
  camera: THREE.Camera,
  wallet: PlayerWallet,
  onWalletChanged: () => void
): HandheldScannerShared {
  const vmGroup = new THREE.Group();
  vmGroup.position.set(0.25, -0.22, -0.44);
  vmGroup.rotation.set(0.08, -0.22, 0.05);
  vmGroup.visible = false;
  camera.add(vmGroup);

  const beigeMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3c8,
    roughness: 0.45,
    metalness: 0.12,
  });
  const slateMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.48,
    metalness: 0.3,
  });
  const triggerMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    roughness: 0.4,
  });
  const emitterGlassMat = new THREE.MeshStandardMaterial({
    color: 0x450a0a,
    emissive: 0x991b1b,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });
  ctx.disposables.push(beigeMat, slateMat, triggerMat, emitterGlassMat);

  // Pistol grip handle + sloped 1990 scanner head + red trigger + dark emitter window
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.13, 0.044), slateMat);
  handle.position.set(0, -0.055, 0.03);
  handle.rotation.x = 0.28;

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.052, 0.135), beigeMat);
  head.position.set(0, 0.015, -0.01);

  const noseBezel = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.048, 0.025), slateMat);
  noseBezel.position.set(0, 0.014, -0.08);

  const emitterWin = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.024), emitterGlassMat);
  emitterWin.rotation.y = Math.PI;
  emitterWin.position.set(0, 0.014, -0.094);

  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.022), triggerMat);
  trigger.position.set(0, -0.022, -0.002);

  vmGroup.add(handle, head, noseBezel, emitterWin, trigger);
  ctx.disposables.push(
    handle.geometry,
    head.geometry,
    noseBezel.geometry,
    emitterWin.geometry,
    trigger.geometry
  );

  // World-space 3D red laser beam mesh (reused, zero GC!)
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    transparent: true,
    opacity: 0.88,
  });
  const laserGeo = new THREE.CylinderGeometry(0.0024, 0.0024, 1.0, 6);
  laserGeo.rotateX(Math.PI / 2); // Align along +Z so lookAt aims the beam cleanly
  const laserBeam = new THREE.Mesh(laserGeo, laserMat);
  laserBeam.visible = false;
  ctx.scene.add(laserBeam);
  ctx.disposables.push(laserMat, laserGeo);

  const _startPos = new THREE.Vector3();
  const _midPos = new THREE.Vector3();
  let laserTimer = 0;
  let recoil = 0;

  const shared: HandheldScannerShared = {
    heldByLane: null,
    pickUp: (laneNum: number) => {
      shared.heldByLane = laneNum;
      vmGroup.visible = true;
      wallet.setHoldingScanner(true);
      soundSynth.playMechanicalButtonClick();
      onWalletChanged();
    },
    putDown: () => {
      shared.heldByLane = null;
      vmGroup.visible = false;
      wallet.setHoldingScanner(false);
      soundSynth.playMechanicalButtonClick();
      onWalletChanged();
    },
    flashLaser: (worldTarget: THREE.Vector3) => {
      if (shared.heldByLane !== null) {
        emitterWin.getWorldPosition(_startPos);
      } else {
        // Shoot from slightly above/behind target (flatbed window origin)
        _startPos.copy(worldTarget).add(new THREE.Vector3(0, -0.12, 0.02));
      }
      const dist = Math.max(0.08, _startPos.distanceTo(worldTarget));
      _midPos.copy(_startPos).add(worldTarget).multiplyScalar(0.5);
      laserBeam.position.copy(_midPos);
      laserBeam.scale.set(1, 1, dist);
      laserBeam.lookAt(worldTarget);
      laserBeam.visible = true;
      laserTimer = 0.2;
      recoil = 1;
    },
  };

  ctx.updaters.push({
    update: (dt, elapsed) => {
      if (laserTimer > 0) {
        laserTimer -= dt;
        emitterGlassMat.emissiveIntensity = 1.4;
        if (laserTimer <= 0) {
          laserBeam.visible = false;
          emitterGlassMat.emissiveIntensity = 0.45;
        }
      }
      if (vmGroup.visible) {
        recoil = THREE.MathUtils.damp(recoil, 0, 16, dt);
        vmGroup.position.set(
          0.25,
          -0.22 + Math.sin(elapsed * 2.2) * 0.003,
          -0.44 + recoil * 0.024
        );
      }
    },
  });

  return shared;
}

export function buildCheckoutLane1990(
  ctx: WorldBuildContext,
  parent: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  laneNum: 1 | 2,
  cx: number,
  wallet: PlayerWallet,
  sharedScanner: HandheldScannerShared,
  onWalletChanged: () => void
): void {
  const checkout = new THREE.Group();
  checkout.position.set(cx, 0, 4.45);
  parent.add(checkout);

  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyMat);

  // Strict single-press hardware debounce lock (320ms) per lane
  let laneLastPressTime = 0;
  const acquirePressLock = (): boolean => {
    const now = performance.now();
    if (now - laneLastPressTime < CHECKOUT_PRESS_COOLDOWN_MS) {
      return false;
    }
    laneLastPressTime = now;
    return true;
  };

  const makeTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
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
  // 1. REGISTER & CHECKOUT LANE STATE
  // ============================================================================
  let laneOpen = true;
  let beltRunning = true;
  let scannedLines: ScannedLine[] = [];
  let pluBuffer = '';
  let paymentMode: PaymentMode = 'NONE';
  let customerTendered = 0;
  let changeDue = 0;
  let changeRemaining = 0;
  let cbTimer = 0;
  let statusNotice = 'PRÊT · SCANNEZ OU [PANIER TEST]';
  let vfdLine1 = `CAISSE ${laneNum} OUVERTE`;
  let vfdLine2 = 'BIENVENUE CONTACT';
  let receiptExtruded = false;
  let receiptTargetY = 0.4;
  let lastPaidMethod = 'ESPÈCES';
  let lastPaidTotal = 0;
  let lastPaidTendered = 0;
  let lastPaidChange = 0;
  let lastPaidItems: ScannedLine[] = [];

  let displayDirty = true;
  let vfdDirty = true;
  let tpeDirty = true;

  const getSubtotal = (): number => {
    let sum = 0;
    for (let i = 0; i < scannedLines.length; i++) sum += scannedLines[i].price;
    return sum;
  };

  // ============================================================================
  // 2. SOBER 1990 MATERIALS & CHECKOUT COUNTER ARCHITECTURE
  // ============================================================================
  const regBeigeMat = new THREE.MeshStandardMaterial({
    color: 0xd5d2c7,
    roughness: 0.48,
    metalness: 0.14,
  });
  const regSlateMat = new THREE.MeshStandardMaterial({
    color: 0x3b4452,
    roughness: 0.5,
    metalness: 0.35,
  });
  const darkRecessMat = new THREE.MeshStandardMaterial({
    color: 0x0f141c,
    roughness: 0.72,
    metalness: 0.15,
  });
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xc9a23b,
    roughness: 0.3,
    metalness: 0.85,
  });
  const dividerOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xc25b1c,
    roughness: 0.42,
    metalness: 0.08,
  });
  const beltMat = mats.conveyorRubber.clone();
  ctx.disposables.push(
    regBeigeMat,
    regSlateMat,
    darkRecessMat,
    brassMat,
    dividerOrangeMat,
    beltMat
  );

  // Main Conveyor Counter Cabinet (0.76m W x 0.88m H x 2.35m L)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.88, 2.35), mats.anthracite);
  body.position.y = 0.44;
  body.castShadow = true;
  body.receiveShadow = true;

  // L-shaped Cashier Side Pod (slightly compact along X so cashier bays are wide & comfortable!)
  const cashierPod = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.88, 0.94), mats.anthracite);
  cashierPod.position.set(-0.62, 0.44, 0.15);
  cashierPod.castShadow = true;
  cashierPod.receiveShadow = true;

  // Stainless Bed, Moving Rubber Belt, Flatbed Scanner Window & Bagging Well
  const stainlessBed = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 2.4), mats.stainless);
  stainlessBed.position.y = 0.9;

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.025, 1.38), beltMat);
  belt.position.set(0.02, 0.925, -0.42);

  // Classic French triangular "CLIENT SUIVANT" divider bar
  const divLabelCanvas = document.createElement('canvas');
  divLabelCanvas.width = 256;
  divLabelCanvas.height = 48;
  {
    const c = divLabelCanvas.getContext('2d')!;
    c.fillStyle = '#c25b1c';
    c.fillRect(0, 0, 256, 48);
    c.fillStyle = '#f8fafc';
    c.font = '800 22px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('CLIENT SUIVANT', 128, 32);
  }
  const divLabelMat = new THREE.MeshStandardMaterial({
    map: makeTexture(divLabelCanvas),
    roughness: 0.4,
  });
  ctx.disposables.push(divLabelMat);
  const dividerBar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.042, 0.045), [
    dividerOrangeMat,
    dividerOrangeMat,
    divLabelMat,
    dividerOrangeMat,
    divLabelMat,
    divLabelMat,
  ]);
  dividerBar.position.set(0.02, 0.958, -1.03);

  const bagWell = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.06, 0.72), mats.stainless);
  bagWell.position.set(0, 0.92, 0.82);
  const bagDivider = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.075, 0.68), mats.chrome);
  bagDivider.position.set(0, 0.96, 0.82);

  const flatScannerFrame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.024, 0.3), regSlateMat);
  flatScannerFrame.position.set(-0.04, 0.924, 0.36);
  const flatScannerGlass = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.24), mats.clearGlass);
  flatScannerGlass.position.set(-0.04, 0.935, 0.36);

  checkout.add(
    body,
    cashierPod,
    stainlessBed,
    belt,
    dividerBar,
    bagWell,
    bagDivider,
    flatScannerFrame,
    flatScannerGlass
  );
  ctx.disposables.push(
    body.geometry,
    cashierPod.geometry,
    stainlessBed.geometry,
    belt.geometry,
    dividerBar.geometry,
    bagWell.geometry,
    bagDivider.geometry,
    flatScannerFrame.geometry,
    flatScannerGlass.geometry
  );

  // Illuminated Overhead Checkout Number Sign ("CAISSE 1 / 2" — dynamically updates OUVERTE / FERMÉE)
  const lanePole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.48, 8), mats.chrome);
  lanePole.position.set(-0.34, 1.64, -0.96);
  const laneSignCanvas = document.createElement('canvas');
  laneSignCanvas.width = 512;
  laneSignCanvas.height = 172;
  const laneSignTex = makeTexture(laneSignCanvas);
  const redrawLaneSign = () => {
    const c = laneSignCanvas.getContext('2d')!;
    c.fillStyle = '#0f172a';
    c.fillRect(0, 0, 512, 172);
    c.fillStyle = laneOpen ? '#15803d' : '#991b1b';
    c.fillRect(0, 0, 512, 22);
    c.fillStyle = '#f8fafc';
    c.textAlign = 'center';
    c.font = '800 58px "Plus Jakarta Sans", sans-serif';
    c.fillText(`CAISSE ${laneNum}`, 256, 94);
    c.fillStyle = laneOpen ? '#fde68a' : '#fca5a5';
    c.font = '700 26px "JetBrains Mono", monospace';
    c.fillText(laneOpen ? 'OUVERTE · ESPÈCES & CB 1990' : 'CAISSE FERMÉE', 256, 142);
    laneSignTex.needsUpdate = true;
  };
  redrawLaneSign();

  const laneSignMat = new THREE.MeshStandardMaterial({
    map: laneSignTex,
    emissiveMap: laneSignTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.65,
    roughness: 0.3,
  });
  const laneSignBox = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.28, 0.14), laneSignMat);
  laneSignBox.position.set(-0.1, 2.38, -0.96);
  checkout.add(lanePole, laneSignBox);
  ctx.disposables.push(lanePole.geometry, laneSignMat, laneSignBox.geometry);

  // Keep Countertop TCG Display on Lane 1 (intact from V1)
  if (laneNum === 1) {
    const tcgStand = new THREE.Group();
    tcgStand.position.set(0.22, 0.92, -1.04);
    const scratchAcrylic = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.26, 0.2),
      mats.clearGlass
    );
    scratchAcrylic.position.y = 0.13;
    const scratchMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 });
    const scratchCards = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.035), scratchMat);
    scratchCards.position.set(0, 0.12, 0);
    scratchCards.rotation.x = -0.25;
    tcgStand.add(scratchAcrylic, scratchCards);
    checkout.add(tcgStand);
    ctx.disposables.push(scratchAcrylic.geometry, scratchMat, scratchCards.geometry);
  }

  // Accurate L-Colliders (leaving generous 0.96m cashier walkway!)
  addBoxCollider(ctx, `checkout_main_${laneNum}`, cx - 0.39, cx + 0.39, 3.25, 5.65);
  addBoxCollider(ctx, `checkout_pod_${laneNum}`, cx - 0.87, cx - 0.34, 4.12, 5.06);

  // ============================================================================
  // 3. PHYSICAL [PANIER TEST] SPAWNER BUTTON & BELT ADVANCE SWITCH
  // ============================================================================
  const animatedButtons: Array<{ mesh: THREE.Object3D; axis: 'y' | 'z'; rest: number; press: number }> = [];

  const makeSmallButtonPlaque = (
    line1: string,
    line2: string,
    bg: string,
    fg: string
  ): THREE.MeshStandardMaterial => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 96;
    const c = cv.getContext('2d')!;
    c.fillStyle = bg;
    c.fillRect(0, 0, 256, 96);
    c.strokeStyle = 'rgba(255,255,255,0.28)';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 248, 88);
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.font = '800 28px "Plus Jakarta Sans", sans-serif';
    c.fillText(line1, 128, 44);
    c.font = '600 18px "JetBrains Mono", monospace';
    c.fillStyle = '#e2e8f0';
    c.fillText(line2, 128, 76);
    const m = new THREE.MeshStandardMaterial({ map: makeTexture(cv), roughness: 0.42 });
    ctx.disposables.push(m);
    return m;
  };

  // [PANIER TEST] physical console box on belt rim (facing cashier -X!)
  const spawnerGroup = new THREE.Group();
  spawnerGroup.position.set(-0.34, 0.94, -0.78);
  spawnerGroup.rotation.y = -Math.PI / 2;
  checkout.add(spawnerGroup);

  const spawnerBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.13), regSlateMat);
  const spawnerBtnMat = makeSmallButtonPlaque('PANIER TEST', '3-4 ARTICLES', '#166534', '#f8fafc');
  const spawnerBtnCap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.026, 0.088), [
    regSlateMat,
    regSlateMat,
    spawnerBtnMat,
    regSlateMat,
    regSlateMat,
    regSlateMat,
  ]);
  spawnerBtnCap.position.set(0, 0.038, 0);
  spawnerGroup.add(spawnerBox, spawnerBtnCap);
  ctx.disposables.push(spawnerBox.geometry, spawnerBtnCap.geometry);

  const spawnerPress = { mesh: spawnerBtnCap, axis: 'y' as const, rest: 0.038, press: 0 };
  animatedButtons.push(spawnerPress);

  registerProxy(spawnerGroup, [0.28, 0.14, 0.18], [0, 0.04, 0], {
    id: `checkout_${laneNum}_panier_test`,
    title: `Panier Test (Caisse ${laneNum})`,
    subtitle: 'Déposer 3 à 4 articles 1990 sur le tapis',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    dynamicVerb: () => 'PANIER TEST',
    dynamicTitle: () => `Panier Test · Caisse ${laneNum}`,
    dynamicSubtitle: () =>
      laneOpen
        ? 'Dépose 3 à 4 articles 1990 sur le tapis roulant'
        : 'Ouvrez d’abord la caisse avec la clé laiton',
    onInteract: () => {
      if (!acquirePressLock()) return;
      spawnerPress.press = 1;
      soundSynth.playMechanicalButtonClick();
      if (!laneOpen) {
        soundSynth.playAtmPiezo('error');
        return;
      }
      spawnTestBasket();
    },
  });

  // Physical Belt Advance Switch ("TAPIS ROULANT") right next to register
  const beltSwitchGroup = new THREE.Group();
  beltSwitchGroup.position.set(-0.34, 0.94, -0.45);
  beltSwitchGroup.rotation.y = -Math.PI / 2;
  checkout.add(beltSwitchGroup);

  const beltSwBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.12), regSlateMat);
  const beltSwCapMat = makeSmallButtonPlaque('TAPIS', 'MARCHE / ARRÊT', '#1e3a5f', '#fde68a');
  const beltSwCap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.08), [
    regSlateMat,
    regSlateMat,
    beltSwCapMat,
    regSlateMat,
    regSlateMat,
    regSlateMat,
  ]);
  beltSwCap.position.set(0, 0.035, 0);
  beltSwitchGroup.add(beltSwBox, beltSwCap);
  ctx.disposables.push(beltSwBox.geometry, beltSwCap.geometry);

  const beltSwPress = { mesh: beltSwCap, axis: 'y' as const, rest: 0.035, press: 0 };
  animatedButtons.push(beltSwPress);

  registerProxy(beltSwitchGroup, [0.24, 0.14, 0.16], [0, 0.04, 0], {
    id: `checkout_${laneNum}_belt_switch`,
    title: `Interrupteur Tapis Roulant (Caisse ${laneNum})`,
    subtitle: 'Avance du tapis caoutchouc',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    dynamicVerb: () => (beltRunning ? 'ARRÊTER LE TAPIS' : 'AVANCER LE TAPIS'),
    dynamicTitle: () => `Tapis Roulant · Caisse ${laneNum}`,
    dynamicSubtitle: () =>
      beltRunning ? 'Tapis en marche · Cellule photoélectrique active' : 'Tapis à l’arrêt',
    onInteract: () => {
      if (!acquirePressLock()) return;
      beltSwPress.press = 1;
      soundSynth.playMechanicalButtonClick();
      beltRunning = !beltRunning;
    },
  });

  // ============================================================================
  // 4. HANDHELD 1990 LASER SCANNER CRADLE ("DOUCHETTE LASER")
  // ============================================================================
  const cradleGroup = new THREE.Group();
  cradleGroup.position.set(-0.34, 0.93, -0.17);
  cradleGroup.rotation.y = -Math.PI / 2;
  checkout.add(cradleGroup);

  const cradleBase = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.14), regSlateMat);
  cradleBase.position.y = 0.02;
  const cradleForkL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.07, 0.08), regSlateMat);
  cradleForkL.position.set(-0.042, 0.055, -0.01);
  const cradleForkR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.07, 0.08), regSlateMat);
  cradleForkR.position.set(0.042, 0.055, -0.01);
  cradleGroup.add(cradleBase, cradleForkL, cradleForkR);
  ctx.disposables.push(cradleBase.geometry, cradleForkL.geometry, cradleForkR.geometry);

  // Docked 3D Douchette Laser inside cradle (hidden when player holds this lane's scanner)
  const dockedScanner = new THREE.Group();
  dockedScanner.position.set(0, 0.075, 0);
  const dockHandle = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.11, 0.04), regSlateMat);
  dockHandle.position.set(0, 0.01, 0.04);
  dockHandle.rotation.x = 0.45;
  const dockHead = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.05, 0.125), regBeigeMat);
  dockHead.position.set(0, 0.055, -0.01);
  dockHead.rotation.x = 0.18;
  const dockTrigger = new THREE.Mesh(
    new THREE.BoxGeometry(0.016, 0.028, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 })
  );
  dockTrigger.position.set(0, 0.028, 0.01);
  dockedScanner.add(dockHandle, dockHead, dockTrigger);
  cradleGroup.add(dockedScanner);
  ctx.disposables.push(
    dockHandle.geometry,
    dockHead.geometry,
    dockTrigger.geometry,
    dockTrigger.material as THREE.Material
  );

  registerProxy(cradleGroup, [0.18, 0.2, 0.2], [0, 0.08, 0], {
    id: `checkout_${laneNum}_scanner_cradle`,
    title: `Douchette Laser 1990 (Caisse ${laneNum})`,
    subtitle: 'Lecteur Code-Barres Laser',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    dynamicVerb: () =>
      sharedScanner.heldByLane === laneNum ? 'POSER LA DOUCHETTE' : 'PRENDRE LA DOUCHETTE',
    dynamicTitle: () => `Douchette Laser 1990 · Caisse ${laneNum}`,
    dynamicSubtitle: () =>
      sharedScanner.heldByLane === laneNum
        ? 'Reposer la douchette sur son socle'
        : 'Prendre en main pour scanner les articles du tapis',
    onInteract: () => {
      if (!acquirePressLock()) return;
      if (sharedScanner.heldByLane === laneNum) {
        sharedScanner.putDown();
      } else {
        sharedScanner.pickUp(laneNum);
      }
    },
  });

  // ============================================================================
  // 5. DUAL-SIDED GREEN VFD SEGMENT POLE DISPLAY ("AFFICHEUR CLIENT")
  // ============================================================================
  const vfdPole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.46, 10), mats.chrome);
  vfdPole.position.set(-0.32, 1.15, 0.48);
  const vfdHousing = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.145, 0.36), regSlateMat);
  vfdHousing.position.set(-0.32, 1.4, 0.48);
  const vfdBezelL = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.12, 0.335), darkRecessMat);
  vfdBezelL.position.set(-0.355, 1.4, 0.48);
  const vfdBezelR = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.12, 0.335), darkRecessMat);
  vfdBezelR.position.set(-0.285, 1.4, 0.48);

  const vfdCanvas = document.createElement('canvas');
  vfdCanvas.width = 512;
  vfdCanvas.height = 160;
  const vfdTex = makeTexture(vfdCanvas);

  const redrawVfd = () => {
    const c = vfdCanvas.getContext('2d')!;
    c.fillStyle = '#071311';
    c.fillRect(0, 0, 512, 160);
    c.strokeStyle = '#1f3a34';
    c.lineWidth = 3;
    c.strokeRect(4, 4, 504, 152);

    // Subtle VFD dot-matrix grid cells
    c.fillStyle = 'rgba(52, 211, 153, 0.08)';
    for (let x = 18; x < 494; x += 24) {
      c.fillRect(x, 22, 18, 48);
      c.fillRect(x, 88, 18, 48);
    }

    if (!laneOpen) {
      c.fillStyle = '#475569';
      c.font = '700 32px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText('--- CAISSE FERMEE ---', 256, 94);
    } else {
      c.fillStyle = '#34d399';
      c.font = '700 30px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText(vfdLine1.slice(0, 22), 20, 58);
      c.fillStyle = '#6ee7b7';
      c.fillText(vfdLine2.slice(0, 22), 20, 124);
    }
    vfdTex.needsUpdate = true;
  };
  redrawVfd();

  const vfdScreenMat = new THREE.MeshStandardMaterial({
    map: vfdTex,
    emissiveMap: vfdTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.78,
    roughness: 0.18,
  });
  // Clean sharp-cornered rectangular VFD screens offset +0.005m forward on BOTH sides (zero clipping)
  const vfdFaceCashier = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.104), vfdScreenMat);
  vfdFaceCashier.rotation.y = -Math.PI / 2;
  vfdFaceCashier.position.set(-0.362, 1.4, 0.48);

  const vfdFaceCustomer = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.104), vfdScreenMat);
  vfdFaceCustomer.rotation.y = Math.PI / 2;
  vfdFaceCustomer.position.set(-0.278, 1.4, 0.48);

  checkout.add(vfdPole, vfdHousing, vfdBezelL, vfdBezelR, vfdFaceCashier, vfdFaceCustomer);
  ctx.disposables.push(
    vfdPole.geometry,
    vfdHousing.geometry,
    vfdBezelL.geometry,
    vfdBezelR.geometry,
    vfdScreenMat,
    vfdFaceCashier.geometry,
    vfdFaceCustomer.geometry
  );

  // ============================================================================
  // 6. 1990 CASH REGISTER CONSOLE, RECTANGULAR SCREEN, BRASS KEY, RECEIPT PRINTER,
  //    SLOPED 3D KEYPAD (ZERO CLIPPING) & MOTORIZED STEEL CASH DRAWER
  // ============================================================================
  // Rotated -PI/2 around Y so local +Z faces world -X (straight toward the cashier!)
  const regRoot = new THREE.Group();
  regRoot.position.set(-0.6, 0.88, 0.15);
  regRoot.rotation.y = -Math.PI / 2;
  checkout.add(regRoot);

  // --- A. Motorized 3D Steel Cash Drawer ("TIROIR-CAISSE") ---
  const drawerShell = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.115, 0.44), regSlateMat);
  drawerShell.position.set(0, 0.058, 0.02);
  regRoot.add(drawerShell);
  ctx.disposables.push(drawerShell.geometry);

  const drawerSlideGroup = new THREE.Group();
  drawerSlideGroup.position.set(0, 0.055, 0.02);
  regRoot.add(drawerSlideGroup);

  const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.014, 0.39), darkRecessMat);
  trayFloor.position.set(0, -0.04, 0);
  const trayFrontFace = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.105, 0.02), regSlateMat);
  trayFrontFace.position.set(0, 0, 0.21);
  const trayHandle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.024), mats.chrome);
  trayHandle.position.set(0, 0.012, 0.228);
  const trayWallL = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.088, 0.39), darkRecessMat);
  trayWallL.position.set(-0.23, 0, 0);
  const trayWallR = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.088, 0.39), darkRecessMat);
  trayWallR.position.set(0.23, 0, 0);
  const trayMidDiv = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.068, 0.012), regSlateMat);
  trayMidDiv.position.set(0, -0.004, 0.005);

  drawerSlideGroup.add(trayFloor, trayFrontFace, trayHandle, trayWallL, trayWallR, trayMidDiv);
  ctx.disposables.push(
    trayFloor.geometry,
    trayFrontFace.geometry,
    trayHandle.geometry,
    trayWallL.geometry,
    trayWallR.geometry,
    trayMidDiv.geometry
  );

  // Banknote stacks (100 ₣ Delacroix & 50 ₣ Saint-Exupéry) inside back row of open drawer
  const franc100Tex = makeTexture(createFrancNoteCanvas(FRANC_SPECS[100]));
  const franc50Tex = makeTexture(createFrancNoteCanvas(FRANC_SPECS[50]));
  const franc200Tex = makeTexture(createFrancNoteCanvas(FRANC_SPECS[200]));
  const bill100Mat = new THREE.MeshStandardMaterial({ map: franc100Tex, roughness: 0.65 });
  const bill50Mat = new THREE.MeshStandardMaterial({ map: franc50Tex, roughness: 0.65 });
  const billSideMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
  const billStackGeo = new THREE.BoxGeometry(0.16, 0.026, 0.095);
  const billClipGeo = new THREE.BoxGeometry(0.022, 0.01, 0.07);
  ctx.disposables.push(bill100Mat, bill50Mat, billSideMat, billStackGeo, billClipGeo);

  const animatedTillPops: Array<{ mesh: THREE.Object3D; restY: number; pop: number }> = [];

  const addDrawerBillBay = (denom: 100 | 50, bx: number, topMat: THREE.Material) => {
    const stack = new THREE.Mesh(billStackGeo, [
      billSideMat,
      billSideMat,
      topMat,
      billSideMat,
      billSideMat,
      billSideMat,
    ]);
    stack.position.set(bx, -0.018, -0.085);
    const clip = new THREE.Mesh(billClipGeo, mats.chrome);
    clip.position.set(bx, 0.002, -0.105);
    drawerSlideGroup.add(stack, clip);

    const popState = { mesh: stack, restY: -0.018, pop: 0 };
    animatedTillPops.push(popState);

    registerProxy(drawerSlideGroup, [0.19, 0.09, 0.14], [bx, 0.01, -0.085], {
      id: `checkout_${laneNum}_till_bill_${denom}`,
      title: `Compartiment Billets ${denom} ₣`,
      subtitle: 'Tiroir-Caisse 1990',
      kind: 'diegetic_action',
      state: false,
      inspectText: '',
      isVisible: () => paymentMode === 'CASH_OPEN' && changeRemaining > 0,
      dynamicVerb: () => `RENDRE ${denom} ₣`,
      dynamicTitle: () => `Billet ${denom} ₣ (${FRANC_SPECS[denom].figure})`,
      dynamicSubtitle: () => `Reste à rendre : ${formatFrancsTwoDec(changeRemaining)}`,
      onInteract: () => {
        if (!acquirePressLock()) return;
        handleGiveChange(denom, false, popState);
      },
    });
  };

  addDrawerBillBay(100, -0.11, bill100Mat);
  addDrawerBillBay(50, 0.11, bill50Mat);

  // Coin compartments (10 ₣, 5 ₣, 2 ₣, 1 ₣) inside front row of open drawer
  const coinCupDenoms: Array<{ denom: 10 | 5 | 2 | 1; x: number; hex: number; radius: number }> = [
    { denom: 10, x: -0.168, hex: 0xc99c32, radius: 0.021 },
    { denom: 5, x: -0.056, hex: 0xd1d5db, radius: 0.023 },
    { denom: 2, x: 0.056, hex: 0xcbd5e1, radius: 0.02 },
    { denom: 1, x: 0.168, hex: 0xdbe2ea, radius: 0.018 },
  ];

  coinCupDenoms.forEach((cInfo, idx) => {
    if (idx > 0) {
      const div = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.064, 0.18), regSlateMat);
      div.position.set(cInfo.x - 0.056, -0.006, 0.1);
      drawerSlideGroup.add(div);
      ctx.disposables.push(div.geometry);
    }

    const coinPileGroup = new THREE.Group();
    coinPileGroup.position.set(cInfo.x, -0.024, 0.098);
    const cMat = new THREE.MeshStandardMaterial({
      color: cInfo.hex,
      roughness: 0.26,
      metalness: 0.85,
    });
    const cGeo = new THREE.CylinderGeometry(cInfo.radius, cInfo.radius, 0.005, 14);
    ctx.disposables.push(cMat, cGeo);

    for (let k = 0; k < 6; k++) {
      const coin = new THREE.Mesh(cGeo, cMat);
      coin.position.set(
        ((k % 3) - 1) * 0.015,
        Math.floor(k / 3) * 0.0055,
        (k % 2 === 0 ? -1 : 1) * 0.014
      );
      coinPileGroup.add(coin);
    }
    drawerSlideGroup.add(coinPileGroup);

    // Small crisp printed compartment label inside front rim
    const lblCv = document.createElement('canvas');
    lblCv.width = 96;
    lblCv.height = 48;
    const lc = lblCv.getContext('2d')!;
    lc.fillStyle = '#1e293b';
    lc.fillRect(0, 0, 96, 48);
    lc.fillStyle = cInfo.denom === 10 ? '#fde68a' : '#f8fafc';
    lc.font = '800 28px "JetBrains Mono", monospace';
    lc.textAlign = 'center';
    lc.fillText(`${cInfo.denom} ₣`, 48, 34);
    const lblMat = new THREE.MeshStandardMaterial({ map: makeTexture(lblCv), roughness: 0.45 });
    const lblMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.032), lblMat);
    lblMesh.rotation.x = -Math.PI / 2;
    lblMesh.position.set(cInfo.x, -0.028, 0.168);
    drawerSlideGroup.add(lblMesh);
    ctx.disposables.push(lblMat, lblMesh.geometry);

    const popState = { mesh: coinPileGroup, restY: -0.024, pop: 0 };
    animatedTillPops.push(popState);

    registerProxy(drawerSlideGroup, [0.1, 0.09, 0.16], [cInfo.x, 0.008, 0.105], {
      id: `checkout_${laneNum}_till_coin_${cInfo.denom}`,
      title: `Compartiment Pièces ${cInfo.denom} ₣`,
      subtitle: 'Tiroir-Caisse 1990',
      kind: 'diegetic_action',
      state: false,
      inspectText: '',
      isVisible: () => paymentMode === 'CASH_OPEN' && changeRemaining > 0,
      dynamicVerb: () => `RENDRE ${cInfo.denom} ₣`,
      dynamicTitle: () => `Pièce ${cInfo.denom} ₣`,
      dynamicSubtitle: () => `Reste à rendre : ${formatFrancsTwoDec(changeRemaining)}`,
      onInteract: () => {
        if (!acquirePressLock()) return;
        handleGiveChange(cInfo.denom, true, popState);
      },
    });
  });

  // Close Drawer Proxy on front handle (visible when open!)
  registerProxy(drawerSlideGroup, [0.46, 0.12, 0.09], [0, 0, 0.23], {
    id: `checkout_${laneNum}_drawer_close`,
    title: `Tiroir-Caisse (Caisse ${laneNum})`,
    subtitle: 'Fermer le tiroir',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => paymentMode === 'CASH_OPEN',
    dynamicVerb: () =>
      changeRemaining === 0 ? 'FERMER LE TIROIR' : `RENDRE ENCORE ${changeRemaining} ₣`,
    dynamicTitle: () =>
      changeRemaining === 0
        ? `Fermer le Tiroir-Caisse (Encaisser ${getSubtotal()} ₣)`
        : `Monnaie incomplète (${changeRemaining} ₣ restants)`,
    dynamicSubtitle: () =>
      changeRemaining === 0
        ? 'Valider l’encaissement et imprimer le ticket'
        : 'Sélectionnez les pièces/billets dans le tiroir ouvert',
    onInteract: () => {
      if (!acquirePressLock()) return;
      if (changeRemaining > 0) {
        statusNotice = `IL RESTE ${changeRemaining} ₣ À RENDRE`;
        displayDirty = true;
        soundSynth.playAtmPiezo('error');
        return;
      }
      completeCashSale();
    },
  });

  // Customer Banknote resting visibly on counter while paying cash
  const customerNoteMat = new THREE.MeshStandardMaterial({
    map: franc100Tex,
    roughness: 0.62,
    side: THREE.DoubleSide,
  });
  const customerNoteMesh = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.003, 0.084), customerNoteMat);
  customerNoteMesh.position.set(0.32, 0.048, -0.18);
  customerNoteMesh.rotation.y = 0.25;
  customerNoteMesh.visible = false;
  regRoot.add(customerNoteMesh);
  ctx.disposables.push(customerNoteMat, customerNoteMesh.geometry);

  // --- B. 1990 Cash Register Body & Sharp-Cornered Rectangular Operator Screen ---
  const regLowerBody = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.11, 0.36), regBeigeMat);
  regLowerBody.position.set(0, 0.165, -0.02);
  const regUpperHood = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.21, 0.18), regBeigeMat);
  regUpperHood.position.set(0, 0.315, -0.095); // front face at z = -0.005
  regRoot.add(regLowerBody, regUpperHood);
  ctx.disposables.push(regLowerBody.geometry, regUpperHood.geometry);

  // Operator Screen (Clean sharp-cornered rectangular PlaneGeometry offset +0.005m forward — zero clipping!)
  const opBezel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.155, 0.014), darkRecessMat);
  opBezel.position.set(0.035, 0.325, -0.002); // front face at z = +0.005

  const opCanvas = document.createElement('canvas');
  opCanvas.width = 512;
  opCanvas.height = 280;
  const opTex = makeTexture(opCanvas);

  const redrawOpDisplay = () => {
    const c = opCanvas.getContext('2d')!;
    c.fillStyle = '#0c1a17';
    c.fillRect(0, 0, 512, 280);
    c.strokeStyle = '#334155';
    c.lineWidth = 4;
    c.strokeRect(4, 4, 504, 272);

    if (!laneOpen) {
      c.fillStyle = '#64748b';
      c.textAlign = 'center';
      c.font = '700 32px "JetBrains Mono", monospace';
      c.fillText(`CAISSE #${laneNum} FERMÉE`, 256, 134);
      c.font = '600 18px "Plus Jakarta Sans", sans-serif';
      c.fillText('TOURNEZ LA CLÉ LAITON POUR OUVRIR', 256, 178);
      opTex.needsUpdate = true;
      return;
    }

    // Header strip
    c.fillStyle = '#1b365d';
    c.fillRect(10, 10, 492, 34);
    c.fillStyle = '#f8fafc';
    c.font = '700 18px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(`CAISSE ${laneNum} · CONTACT EXPRESS 1990`, 18, 33);
    c.textAlign = 'right';
    c.fillStyle = '#fde68a';
    c.fillText(`${scannedLines.length} ART.`, 492, 33);

    // Last 4 scanned lines
    const recent = scannedLines.slice(-4);
    c.font = '600 19px "JetBrains Mono", monospace';
    if (recent.length === 0) {
      c.fillStyle = '#64748b';
      c.textAlign = 'center';
      c.fillText('AUCUN ARTICLE SCANNÉ', 256, 104);
      c.fillText('APPUYEZ SUR [PANIER TEST] OU PLU', 256, 134);
    } else {
      recent.forEach((line, idx) => {
        const ly = 72 + idx * 27;
        c.textAlign = 'left';
        c.fillStyle = '#e2e8f0';
        c.fillText(line.name.slice(0, 22), 18, ly);
        c.textAlign = 'right';
        c.fillStyle = '#6ee7b7';
        c.fillText(formatFrancsTwoDec(line.price), 492, ly);
      });
    }

    // Bottom subtotal & payment status box
    c.fillStyle = '#112622';
    c.fillRect(10, 184, 492, 86);
    c.strokeStyle = '#2e6b58';
    c.lineWidth = 2;
    c.strokeRect(10, 184, 492, 86);

    const total = getSubtotal();
    c.textAlign = 'left';
    c.fillStyle = '#93c5fd';
    c.font = '700 17px "JetBrains Mono", monospace';
    if (pluBuffer) {
      c.fillText(`SAISIE PLU : ${pluBuffer} ₣`, 20, 212);
    } else if (paymentMode === 'CASH_OPEN') {
      c.fillStyle = '#fde68a';
      c.fillText(`REÇU ${customerTendered} ₣ · À RENDRE : ${formatFrancsTwoDec(changeRemaining)}`, 20, 212);
    } else {
      c.fillText(statusNotice.slice(0, 38), 20, 212);
    }

    c.fillStyle = '#f8fafc';
    c.font = '800 30px "JetBrains Mono", monospace';
    c.fillText('TOTAL TTC :', 20, 254);
    c.textAlign = 'right';
    c.fillStyle = '#fde68a';
    c.fillText(formatFrancsTwoDec(total), 492, 254);

    opTex.needsUpdate = true;
  };
  redrawOpDisplay();

  const opScreenMat = new THREE.MeshStandardMaterial({
    map: opTex,
    emissiveMap: opTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.72,
    roughness: 0.2,
  });
  const opScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.256, 0.14), opScreenMat);
  opScreen.position.set(0.035, 0.325, 0.01); // +0.005m forward of bezel (zero clipping!)
  regRoot.add(opBezel, opScreen);
  ctx.disposables.push(opBezel.geometry, opScreenMat, opScreen.geometry);

  // --- C. Brass Lane Power Key Switch (Upper-Right of Register Hood) ---
  const keySwitchGroup = new THREE.Group();
  keySwitchGroup.position.set(0.205, 0.33, -0.004);
  regRoot.add(keySwitchGroup);

  const lockCylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.018, 12), mats.chrome);
  lockCylinder.rotation.x = Math.PI / 2;
  lockCylinder.position.z = 0.006;

  const brassKeyPivot = new THREE.Group();
  brassKeyPivot.position.set(0, 0, 0.015);
  const keyBlade = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.005, 0.022), brassMat);
  keyBlade.position.z = 0.008;
  const keyBow = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.007, 0.028), brassMat);
  keyBow.position.z = 0.028;
  brassKeyPivot.add(keyBlade, keyBow);
  brassKeyPivot.rotation.z = Math.PI / 2; // Vertical = OPEN

  keySwitchGroup.add(lockCylinder, brassKeyPivot);
  ctx.disposables.push(lockCylinder.geometry, keyBlade.geometry, keyBow.geometry);

  registerProxy(keySwitchGroup, [0.085, 0.095, 0.085], [0, 0, 0.025], {
    id: `checkout_${laneNum}_power_key`,
    title: `Clé Laiton Caisse #${laneNum}`,
    subtitle: 'Contacteur Ouvert / Fermé',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    dynamicVerb: () => (laneOpen ? 'FERMER LA CAISSE' : 'OUVRIR LA CAISSE'),
    dynamicTitle: () => `Clé de Caisse #${laneNum} (${laneOpen ? 'OUVERTE' : 'FERMÉE'})`,
    dynamicSubtitle: () => 'Contacteur à clé laiton · Enseigne & Caisse',
    onInteract: () => {
      if (!acquirePressLock()) return;
      laneOpen = !laneOpen;
      soundSynth.playMechanicalButtonClick();
      if (!laneOpen) {
        beltRunning = false;
        paymentMode = 'NONE';
        customerNoteMesh.visible = false;
        laneSignMat.emissiveIntensity = 0.25;
      } else {
        beltRunning = true;
        laneSignMat.emissiveIntensity = 0.65;
        vfdLine1 = `CAISSE ${laneNum} OUVERTE`;
        vfdLine2 = 'BIENVENUE CONTACT';
      }
      redrawLaneSign();
      displayDirty = true;
      vfdDirty = true;
      tpeDirty = true;
    },
  });

  // --- D. Dot-Matrix Paper Receipt Printer & 3D Paper Receipt ---
  const printerSlot = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.016, 0.028), darkRecessMat);
  printerSlot.position.set(-0.155, 0.422, -0.08);
  regRoot.add(printerSlot);
  ctx.disposables.push(printerSlot.geometry);

  const receiptCanvas = document.createElement('canvas');
  receiptCanvas.width = 256;
  receiptCanvas.height = 420;
  const receiptTex = makeTexture(receiptCanvas);

  const redrawReceipt = () => {
    const c = receiptCanvas.getContext('2d')!;
    c.fillStyle = '#f8f6ef';
    c.fillRect(0, 0, 256, 420);
    c.fillStyle = '#1e293b';
    c.textAlign = 'center';
    c.font = '800 18px "JetBrains Mono", monospace';
    c.fillText('CONTACT EXPRESS', 128, 30);
    c.font = '600 12px "JetBrains Mono", monospace';
    c.fillText('SUPERMARCHE · NOVEMBRE 1990', 128, 50);
    c.fillText(`CAISSE #${laneNum}  ·  19/11/1990`, 128, 68);
    c.fillText('--------------------------------', 128, 86);

    let y = 108;
    const shown = lastPaidItems.slice(0, 8);
    c.font = '600 12px "JetBrains Mono", monospace';
    shown.forEach((it) => {
      c.textAlign = 'left';
      c.fillText(it.name.slice(0, 17), 14, y);
      c.textAlign = 'right';
      c.fillText(`${it.price},00 F`, 242, y);
      y += 20;
    });

    c.textAlign = 'center';
    c.fillText('--------------------------------', 128, Math.max(y + 6, 268));
    const totY = Math.max(y + 30, 292);
    c.textAlign = 'left';
    c.font = '800 15px "JetBrains Mono", monospace';
    c.fillText('TOTAL TTC FRANCS:', 14, totY);
    c.textAlign = 'right';
    c.fillText(`${lastPaidTotal},00 F`, 242, totY);

    c.font = '600 12px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(`REGLEMENT : ${lastPaidMethod}`, 14, totY + 24);
    if (lastPaidMethod === 'ESPÈCES') {
      c.fillText(`RECU: ${lastPaidTendered},00F  RENDU: ${lastPaidChange},00F`, 14, totY + 42);
    } else {
      c.fillText('AUTORISATION CB 1990 : OK', 14, totY + 42);
    }

    c.textAlign = 'center';
    c.fillText('MERCI DE VOTRE VISITE', 128, 398);
    receiptTex.needsUpdate = true;
  };
  redrawReceipt();

  const receiptMat = new THREE.MeshStandardMaterial({
    map: receiptTex,
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const receiptMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.175), receiptMat);
  receiptMesh.position.set(-0.155, 0.4, -0.08);
  receiptMesh.rotation.x = -0.18;
  receiptMesh.visible = false;
  regRoot.add(receiptMesh);
  ctx.disposables.push(receiptMat, receiptMesh.geometry);

  registerProxy(regRoot, [0.16, 0.22, 0.14], [-0.155, 0.52, -0.08], {
    id: `checkout_${laneNum}_take_receipt`,
    title: `Ticket de Caisse (Caisse ${laneNum})`,
    subtitle: 'Imprimante Matricielle 1990',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => receiptExtruded,
    dynamicVerb: () => 'PRENDRE LE TICKET',
    dynamicTitle: () => `Ticket Contact Express (${lastPaidTotal},00 ₣)`,
    dynamicSubtitle: () => `${lastPaidMethod} · Imprimé en Novembre 1990`,
    onInteract: () => {
      if (!acquirePressLock()) return;
      receiptExtruded = false;
      receiptMesh.visible = false;
      receiptTargetY = 0.4;
      soundSynth.playPaperGrab();
    },
  });

  // --- E. Sloped 3D Cash Register Keypad (ALL KEYS PROTRUDE CLEANLY — ZERO CLIPPING!) ---
  const keypadDeck = new THREE.Group();
  keypadDeck.position.set(0, 0.205, 0.13);
  keypadDeck.rotation.x = 0.36;
  regRoot.add(keypadDeck);

  const deckPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.024, 0.235), regSlateMat);
  keypadDeck.add(deckPlate);
  ctx.disposables.push(deckPlate.geometry);

  interface RegKeyDef {
    code: string;
    label: string;
    fullName: string;
    x: number;
    z: number;
    w: number;
    bg: string;
    fg: string;
  }

  const regKeys: RegKeyDef[] = [
    // Row 0 (top row, z = -0.076)
    { code: '7', label: '7', fullName: 'Touche [ 7 ]', x: -0.18, z: -0.076, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: '8', label: '8', fullName: 'Touche [ 8 ]', x: -0.118, z: -0.076, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: '9', label: '9', fullName: 'Touche [ 9 ]', x: -0.056, z: -0.076, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: 'PLU', label: 'PLU', fullName: 'Touche PLU (Article Manuel)', x: 0.095, z: -0.076, w: 0.21, bg: '#334155', fg: '#f8fafc' },

    // Row 1 (z = -0.025)
    { code: '4', label: '4', fullName: 'Touche [ 4 ]', x: -0.18, z: -0.025, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: '5', label: '5', fullName: 'Touche [ 5 ]', x: -0.118, z: -0.025, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: '6', label: '6', fullName: 'Touche [ 6 ]', x: -0.056, z: -0.025, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: 'CORR', label: 'CORR.', fullName: 'Touche CORRECTION / Annul.', x: 0.095, z: -0.025, w: 0.21, bg: '#ca8a04', fg: '#0f172a' },

    // Row 2 (z = +0.026)
    { code: '1', label: '1', fullName: 'Touche [ 1 ]', x: -0.18, z: 0.026, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: '2', label: '2', fullName: 'Touche [ 2 ]', x: -0.118, z: 0.026, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: '3', label: '3', fullName: 'Touche [ 3 ]', x: -0.056, z: 0.026, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: 'SUBTOTAL', label: 'SOUS-TOTAL', fullName: 'Touche SOUS-TOTAL', x: 0.095, z: 0.026, w: 0.21, bg: '#1e3a5f', fg: '#fde68a' },

    // Row 3 (bottom row, z = +0.077)
    { code: '0', label: '0', fullName: 'Touche [ 0 ]', x: -0.18, z: 0.077, w: 0.052, bg: '#e2e8f0', fg: '#0f172a' },
    { code: 'CB', label: 'CARTE BLEUE', fullName: 'Touche CARTE BLEUE (CB 1990)', x: -0.058, z: 0.077, w: 0.156, bg: '#1b365d', fg: '#f8fafc' },
    { code: 'CASH', label: 'TOTAL ESPÈCES', fullName: 'Touche TOTAL ESPÈCES (Francs)', x: 0.118, z: 0.077, w: 0.165, bg: '#15803d', fg: '#ffffff' },
  ];

  regKeys.forEach((kd) => {
    const keyD = 0.042;
    const keyH = 0.022;
    const restY = 0.024; // bottom at +0.013 > deckPlate top +0.012 (clean protrusion, zero clipping!)

    const cv = document.createElement('canvas');
    cv.width = kd.w > 0.1 ? 224 : 96;
    cv.height = 72;
    const kc = cv.getContext('2d')!;
    kc.fillStyle = kd.bg;
    kc.fillRect(0, 0, cv.width, cv.height);
    kc.strokeStyle = 'rgba(15,23,42,0.35)';
    kc.lineWidth = 4;
    kc.strokeRect(2, 2, cv.width - 4, cv.height - 4);
    kc.fillStyle = kd.fg;
    kc.textAlign = 'center';
    kc.textBaseline = 'middle';
    kc.font =
      kd.w > 0.1
        ? '800 24px "Plus Jakarta Sans", sans-serif'
        : '800 42px "JetBrains Mono", monospace';
    kc.fillText(kd.label, cv.width / 2, cv.height / 2 + 2);

    const kTopMat = new THREE.MeshStandardMaterial({
      map: makeTexture(cv),
      roughness: 0.36,
      metalness: 0.18,
    });
    const kSideMat = new THREE.MeshStandardMaterial({
      color: kd.bg,
      roughness: 0.44,
      metalness: 0.16,
    });
    const kGeo = new THREE.BoxGeometry(kd.w, keyH, keyD);
    ctx.disposables.push(kTopMat, kSideMat, kGeo);

    const kMesh = new THREE.Mesh(kGeo, [
      kSideMat,
      kSideMat,
      kTopMat,
      kSideMat,
      kSideMat,
      kSideMat,
    ]);
    kMesh.position.set(kd.x, restY, kd.z);
    keypadDeck.add(kMesh);

    const kPress = { mesh: kMesh, axis: 'y' as const, rest: restY, press: 0 };
    animatedButtons.push(kPress);

    registerProxy(keypadDeck, [kd.w + 0.008, 0.048, keyD + 0.008], [kd.x, restY + 0.008, kd.z], {
      id: `checkout_${laneNum}_key_${kd.code}`,
      title: kd.fullName,
      subtitle: `Clavier Caisse #${laneNum}`,
      kind: 'diegetic_action',
      state: false,
      inspectText: '',
      dynamicVerb: () => 'APPUYER',
      dynamicTitle: () => `${kd.fullName} · Caisse ${laneNum}`,
      dynamicSubtitle: () =>
        laneOpen
          ? `Sous-total : ${formatFrancsTwoDec(getSubtotal())}`
          : 'Caisse fermée · Tournez la clé laiton',
      onInteract: () => {
        if (!acquirePressLock()) return;
        kPress.press = 1;
        handleRegisterKey(kd.code);
      },
    });
  });

  // ============================================================================
  // 7. 1990 CORDED CARTE BLEUE TERMINAL ("TERMINAL CB 1990")
  // ============================================================================
  const tpeGroup = new THREE.Group();
  tpeGroup.position.set(-0.33, 0.93, 0.65);
  tpeGroup.rotation.y = -Math.PI / 2 + 0.25;
  checkout.add(tpeGroup);

  const tpeBase = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.055, 0.21), regSlateMat);
  tpeBase.position.set(0, 0.028, 0);
  tpeBase.rotation.x = 0.26;

  // Sharp-cornered rectangular monochrome LCD screen on TPE (offset +0.005m forward!)
  const tpeBezel = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.008, 0.072), darkRecessMat);
  tpeBezel.position.set(0, 0.064, -0.042);
  tpeBezel.rotation.x = 0.26;

  const tpeCanvas = document.createElement('canvas');
  tpeCanvas.width = 256;
  tpeCanvas.height = 144;
  const tpeTex = makeTexture(tpeCanvas);

  const redrawTpeScreen = () => {
    const c = tpeCanvas.getContext('2d')!;
    c.fillStyle = '#0f2544';
    c.fillRect(0, 0, 256, 144);
    c.strokeStyle = '#93c5fd';
    c.lineWidth = 3;
    c.strokeRect(4, 4, 248, 136);

    c.textAlign = 'center';
    if (!laneOpen) {
      c.fillStyle = '#64748b';
      c.font = '700 20px "JetBrains Mono", monospace';
      c.fillText('TERMINAL CB 1990', 128, 62);
      c.fillText('HORS SERVICE', 128, 96);
    } else if (paymentMode === 'CB_INSERT') {
      c.fillStyle = '#fde68a';
      c.font = '800 21px "JetBrains Mono", monospace';
      c.fillText('INSÉRATION CARTE', 128, 56);
      c.fillStyle = '#f8fafc';
      c.font = '700 26px "JetBrains Mono", monospace';
      c.fillText(formatFrancsTwoDec(getSubtotal()), 128, 102);
    } else if (paymentMode === 'CB_AUTH') {
      c.fillStyle = '#93c5fd';
      c.font = '800 18px "JetBrains Mono", monospace';
      c.fillText('AUTORISATION', 128, 56);
      c.fillText('EN COURS...', 128, 86);
      c.fillStyle = '#fde68a';
      c.font = '600 15px "JetBrains Mono", monospace';
      c.fillText('RÉSEAU CB 1990', 128, 118);
    } else if (paymentMode === 'CB_APPROVED') {
      c.fillStyle = '#6ee7b7';
      c.font = '800 22px "JetBrains Mono", monospace';
      c.fillText('PAIEMENT ACCEPTÉ', 128, 64);
      c.fillStyle = '#f8fafc';
      c.font = '700 16px "JetBrains Mono", monospace';
      c.fillText('IMPRESSION TICKET', 128, 102);
    } else {
      c.fillStyle = '#f8fafc';
      c.font = '700 19px "JetBrains Mono", monospace';
      c.fillText('TERMINAL CB 1990', 128, 58);
      c.fillStyle = '#93c5fd';
      c.font = '600 16px "JetBrains Mono", monospace';
      c.fillText('PRÊT · BANQUE CB', 128, 96);
    }
    tpeTex.needsUpdate = true;
  };
  redrawTpeScreen();

  const tpeScreenMat = new THREE.MeshStandardMaterial({
    map: tpeTex,
    emissiveMap: tpeTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.65,
    roughness: 0.22,
  });
  const tpeScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.102, 0.062), tpeScreenMat);
  tpeScreen.rotation.x = -Math.PI / 2 + 0.26;
  tpeScreen.position.set(0, 0.072, -0.04);

  // Curled cord + miniature keypad + card slot + animated Carte Bleue mesh
  const tpeCord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), mats.rubberBlack);
  tpeCord.rotation.z = Math.PI / 2;
  tpeCord.position.set(-0.11, 0.015, -0.06);

  const tpeKeypad = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.008, 0.08), regBeigeMat);
  tpeKeypad.position.set(0, 0.044, 0.044);
  tpeKeypad.rotation.x = 0.26;

  const tpeCardMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.3, metalness: 0.25 });
  const tpeCardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.003, 0.095), tpeCardMat);
  tpeCardMesh.position.set(0, 0.022, 0.14);
  tpeCardMesh.rotation.x = 0.26;
  tpeCardMesh.visible = false;

  tpeGroup.add(tpeBase, tpeBezel, tpeScreen, tpeCord, tpeKeypad, tpeCardMesh);
  ctx.disposables.push(
    tpeBase.geometry,
    tpeBezel.geometry,
    tpeScreenMat,
    tpeScreen.geometry,
    tpeCord.geometry,
    tpeKeypad.geometry,
    tpeCardMat,
    tpeCardMesh.geometry
  );

  registerProxy(tpeGroup, [0.18, 0.14, 0.24], [0, 0.06, 0], {
    id: `checkout_${laneNum}_tpe_cb`,
    title: `Terminal CB 1990 (Caisse ${laneNum})`,
    subtitle: 'Lecteur Carte Bleue Filaire',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    dynamicVerb: () =>
      paymentMode === 'NONE' && getSubtotal() > 0 ? 'ENCAISSER PAR CB 1990' : 'TERMINAL CB 1990',
    dynamicTitle: () => `Terminal CB 1990 · Caisse ${laneNum}`,
    dynamicSubtitle: () =>
      getSubtotal() > 0
        ? `Règlement Carte Bleue : ${formatFrancsTwoDec(getSubtotal())}`
        : 'Scannez d’abord des articles sur le tapis',
    onInteract: () => {
      if (!acquirePressLock()) return;
      handleRegisterKey('CB');
    },
  });

  // ============================================================================
  // 8. SPAWNABLE 3D 1990 GROCERY / BAKERY / MANGA ITEMS ON THE CONVEYOR BELT
  // ============================================================================
  const MAX_BELT_ITEMS = 4;
  const beltSlots: BeltItemSlot[] = [];

  for (let i = 0; i < MAX_BELT_ITEMS; i++) {
    const itemGroup = new THREE.Group();
    itemGroup.visible = false;
    checkout.add(itemGroup);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 });
    const defaultGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const accentGeo = new THREE.BoxGeometry(0.124, 0.032, 0.124);
    ctx.disposables.push(bodyMat, accentMat, defaultGeo, accentGeo);

    const bodyMesh = new THREE.Mesh(defaultGeo, bodyMat);
    bodyMesh.castShadow = true;
    const accentMesh = new THREE.Mesh(accentGeo, accentMat);
    itemGroup.add(bodyMesh, accentMesh);

    const proxyGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    ctx.disposables.push(proxyGeo);
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.layers.set(INTERACT_LAYER);
    itemGroup.add(proxy);

    const slot: BeltItemSlot = {
      group: itemGroup,
      bodyMesh,
      accentMesh,
      proxyMesh: proxy,
      active: false,
      scanned: false,
      bagged: false,
      product: PRODUCTS_1990[0],
      zPos: -0.9,
      targetBagPos: new THREE.Vector3(),
      bagAnimT: 0,
    };

    const interactItem: InteractableItem = {
      id: `checkout_${laneNum}_belt_item_${i}`,
      title: 'Article sur le tapis',
      subtitle: 'Scanner avec la douchette',
      kind: 'diegetic_action',
      state: false,
      inspectText: '',
      proxyMesh: proxy,
      isVisible: () => slot.active && !slot.scanned,
      dynamicProductEan: () => (slot.active ? slot.product.ean : null),
      dynamicVerb: () =>
        sharedScanner.heldByLane === laneNum ? 'SCANNER (DOUCHETTE)' : 'SCANNER ARTICLE',
      dynamicTitle: () => `${slot.product.displayName} — ${formatFrancsTwoDec(slot.product.priceFrancs)}`,
      dynamicSubtitle: () =>
        laneOpen
          ? `EAN ${slot.product.ean} · Code PLU ${slot.product.code} · Caisse ${laneNum}`
          : 'Ouvrez la caisse avec la clé laiton',
      onInteract: () => {
        if (!acquirePressLock()) return;
        scanBeltSlot(slot);
      },
    };
    proxy.userData.interactable = interactItem;
    ctx.interactables.push(interactItem);
    beltSlots.push(slot);
  }

  const _itemWorldPos = new THREE.Vector3();

  function spawnTestBasket(): void {
    // Pick 3 or 4 varied 1990 French products cleanly without duplicates
    const count = Math.random() < 0.5 ? 3 : 4;
    const shuffled = [...PRODUCTS_1990].sort(() => Math.random() - 0.5).slice(0, count);

    for (let i = 0; i < MAX_BELT_ITEMS; i++) {
      const slot = beltSlots[i];
      if (i >= shuffled.length) {
        slot.active = false;
        slot.group.visible = false;
        continue;
      }
      const p = shuffled[i];
      slot.product = p;
      slot.active = true;
      slot.scanned = false;
      slot.bagged = false;
      slot.bagAnimT = 0;

      // Reshape reusable box/cylinder proportions cleanly
      const [sx, sy, sz] = p.size;
      slot.bodyMesh.scale.set(sx / 0.12, sy / 0.12, sz / 0.12);
      slot.accentMesh.scale.set((sx * 1.02) / 0.124, Math.max(0.4, (sy * 0.35) / 0.032), (sz * 1.02) / 0.124);
      (slot.bodyMesh.material as THREE.MeshStandardMaterial).color.setHex(p.color);
      (slot.accentMesh.material as THREE.MeshStandardMaterial).color.setHex(p.accent);

      slot.zPos = -0.84 + i * 0.25;
      const lateralX = 0.02 + (i % 2 === 0 ? -0.09 : 0.09);
      slot.group.position.set(lateralX, 0.94 + sy / 2, slot.zPos);
      slot.group.rotation.y = (i - 1.5) * 0.15;
      slot.group.visible = true;

      // Bagging well resting spot after scan
      slot.targetBagPos.set(-0.14 + (i % 2) * 0.26, 0.955 + sy / 2, 0.68 + Math.floor(i / 2) * 0.24);
    }

    beltRunning = true;
    statusNotice = `PANIER TEST (${count} ARTICLES) SUR TAPIS`;
    vfdLine1 = `PANIER ${count} ARTICLES`;
    vfdLine2 = 'PRET POUR SCANNER';
    displayDirty = true;
    vfdDirty = true;
  }

  function scanBeltSlot(slot: BeltItemSlot): void {
    if (!laneOpen || !slot.active || slot.scanned) return;
    if (paymentMode !== 'NONE') {
      soundSynth.playAtmPiezo('error');
      return;
    }

    slot.group.getWorldPosition(_itemWorldPos);
    sharedScanner.flashLaser(_itemWorldPos);
    soundSynth.playBarcodeBeep();

    slot.scanned = true;
    slot.bagAnimT = 0;
    scannedLines.push({ name: slot.product.vfdName, price: slot.product.priceFrancs });

    const sub = getSubtotal();
    statusNotice = `SCANNÉ : ${slot.product.displayName}`;
    vfdLine1 = slot.product.vfdName;
    vfdLine2 = `${formatVfdAmount(slot.product.priceFrancs)}  TOT:${formatVfdAmount(sub)}`;
    displayDirty = true;
    vfdDirty = true;
  }

  // ============================================================================
  // 9. REGISTER KEYPAD, CASH PAYMENT, EXACT CHANGE & CB 1990 LOGIC
  // ============================================================================
  function handleRegisterKey(code: string): void {
    if (!laneOpen) {
      soundSynth.playAtmPiezo('error');
      return;
    }

    if (paymentMode === 'CB_INSERT' || paymentMode === 'CB_AUTH' || paymentMode === 'CB_APPROVED') {
      soundSynth.playAtmPiezo('error');
      return;
    }

    if (paymentMode === 'CASH_OPEN') {
      if (code === 'CASH' && changeRemaining === 0) {
        completeCashSale();
      } else {
        soundSynth.playAtmPiezo('error');
      }
      return;
    }

    // Numeric keys 0-9
    if (/^[0-9]$/.test(code)) {
      soundSynth.playAtmPiezo('digit');
      if (pluBuffer.length < 3) {
        pluBuffer += code;
        displayDirty = true;
      }
      return;
    }

    if (code === 'PLU') {
      const price = pluBuffer.length > 0 ? Math.max(1, parseInt(pluBuffer, 10)) : 5;
      pluBuffer = '';
      soundSynth.playBarcodeBeep();
      scannedLines.push({ name: 'ARTICLE DIVERS PLU', price });
      const sub = getSubtotal();
      statusNotice = `PLU ENREGISTRÉ : ${price},00 ₣`;
      vfdLine1 = 'ARTICLE DIVERS PLU';
      vfdLine2 = `${formatVfdAmount(price)}  TOT:${formatVfdAmount(sub)}`;
      displayDirty = true;
      vfdDirty = true;
      return;
    }

    if (code === 'CORR') {
      soundSynth.playAtmPiezo('correct');
      if (pluBuffer.length > 0) {
        pluBuffer = pluBuffer.slice(0, -1);
      } else if (scannedLines.length > 0) {
        const removed = scannedLines.pop()!;
        statusNotice = `LIGNE ANNULÉE : -${removed.price},00 ₣`;
        vfdLine1 = 'ANNULATION LIGNE';
        vfdLine2 = `SOUS-TOTAL ${formatVfdAmount(getSubtotal())}`;
        vfdDirty = true;
      }
      displayDirty = true;
      return;
    }

    if (code === 'SUBTOTAL') {
      soundSynth.playAtmPiezo('confirm');
      const sub = getSubtotal();
      statusNotice = `SOUS-TOTAL : ${formatFrancsTwoDec(sub)}`;
      vfdLine1 = 'SOUS-TOTAL TTC';
      vfdLine2 = formatVfdAmount(sub);
      displayDirty = true;
      vfdDirty = true;
      return;
    }

    if (code === 'CASH') {
      const sub = getSubtotal();
      if (sub <= 0) {
        statusNotice = 'SCANNEZ UN ARTICLE AVANT D’ENCAISSER';
        soundSynth.playAtmPiezo('error');
        displayDirty = true;
        return;
      }

      // Customer hands over realistic 1990 Franc bill (50 ₣, 100 ₣, or 200 ₣ — or next 100 ₣ multiple)
      if (sub <= 50) {
        customerTendered = 50;
        customerNoteMat.map = franc50Tex;
      } else if (sub <= 100) {
        customerTendered = 100;
        customerNoteMat.map = franc100Tex;
      } else if (sub <= 200) {
        customerTendered = 200;
        customerNoteMat.map = franc200Tex;
      } else {
        customerTendered = Math.ceil(sub / 100) * 100;
        customerNoteMat.map = franc100Tex;
      }
      customerNoteMat.needsUpdate = true;
      customerNoteMesh.visible = true;

      changeDue = customerTendered - sub;
      changeRemaining = changeDue;
      paymentMode = 'CASH_OPEN';
      soundSynth.playCashDrawerDing();

      statusNotice =
        changeRemaining > 0
          ? `CLIENT DONNE ${customerTendered} ₣ · RENDRE ${changeRemaining} ₣`
          : `APPOINT EXACT (${customerTendered} ₣) · FERMEZ LE TIROIR`;
      vfdLine1 = `RECU  ${formatVfdAmount(customerTendered)}`;
      vfdLine2 = `A RENDRE ${formatVfdAmount(changeRemaining)}`;
      displayDirty = true;
      vfdDirty = true;
      return;
    }

    if (code === 'CB') {
      const sub = getSubtotal();
      if (sub <= 0) {
        statusNotice = 'SCANNEZ UN ARTICLE AVANT PAIEMENT CB';
        soundSynth.playAtmPiezo('error');
        displayDirty = true;
        return;
      }
      paymentMode = 'CB_INSERT';
      cbTimer = 1.05;
      tpeCardMesh.visible = true;
      tpeCardMesh.position.z = 0.145;
      soundSynth.playCardMotorPull();
      statusNotice = 'TERMINAL CB 1990 · INSÉRATION CARTE';
      vfdLine1 = 'CARTE BLEUE 1990';
      vfdLine2 = `MONTANT ${formatVfdAmount(sub)}`;
      displayDirty = true;
      vfdDirty = true;
      tpeDirty = true;
    }
  }

  function handleGiveChange(
    denom: number,
    isCoin: boolean,
    popState: { mesh: THREE.Object3D; restY: number; pop: number }
  ): void {
    if (paymentMode !== 'CASH_OPEN' || changeRemaining <= 0) return;
    if (denom > changeRemaining) {
      statusNotice = `COUPURE ${denom} ₣ TROP ÉLEVÉE (RESTE ${changeRemaining} ₣)`;
      soundSynth.playAtmPiezo('error');
      displayDirty = true;
      return;
    }

    changeRemaining -= denom;
    popState.pop = 1;
    if (isCoin) {
      soundSynth.playCoinCollect();
    } else {
      soundSynth.playPaperGrab();
    }

    if (changeRemaining === 0) {
      statusNotice = 'MONNAIE EXACTE RENDUE · FERMEZ LE TIROIR';
      vfdLine1 = 'MONNAIE RENDUE OK';
      vfdLine2 = 'FERMER LE TIROIR';
      soundSynth.playAtmPiezo('confirm');
    } else {
      statusNotice = `RENDU ${denom} ₣ · RESTE ${changeRemaining} ₣`;
      vfdLine1 = `RENDU -${denom},00F`;
      vfdLine2 = `RESTE ${formatVfdAmount(changeRemaining)}`;
    }
    displayDirty = true;
    vfdDirty = true;
  }

  function finalizeTransaction(method: 'ESPÈCES' | 'CARTE BLEUE'): void {
    const total = getSubtotal();
    lastPaidMethod = method;
    lastPaidTotal = total;
    lastPaidTendered = method === 'ESPÈCES' ? customerTendered : total;
    lastPaidChange = method === 'ESPÈCES' ? changeDue : 0;
    lastPaidItems = [...scannedLines];

    wallet.addStoreRevenue(total, laneNum);

    // Print dot-matrix 1990 paper receipt
    redrawReceipt();
    receiptExtruded = true;
    receiptMesh.visible = true;
    receiptMesh.position.y = 0.4;
    receiptTargetY = 0.51;
    soundSynth.playReceiptPrint();

    // Clear bagged items & reset ticket for next customer
    for (let i = 0; i < beltSlots.length; i++) {
      if (beltSlots[i].scanned) {
        beltSlots[i].active = false;
        beltSlots[i].group.visible = false;
      }
    }
    scannedLines = [];
    pluBuffer = '';
    customerTendered = 0;
    changeDue = 0;
    changeRemaining = 0;
    customerNoteMesh.visible = false;
    paymentMode = 'NONE';

    statusNotice = `ENCAISSÉ ${total},00 ₣ (${method}) · TICKET PRÊT`;
    vfdLine1 = 'MERCI DE VOTRE VISITE';
    vfdLine2 = `PAYE ${formatVfdAmount(total)}`;
    displayDirty = true;
    vfdDirty = true;
    tpeDirty = true;
    onWalletChanged();
  }

  function completeCashSale(): void {
    soundSynth.playDrawerClose();
    finalizeTransaction('ESPÈCES');
  }

  // ============================================================================
  // 10. PER-FRAME ANIMATIONS (BELT, ITEMS, DRAWER, KEY, CB FLOW, RECEIPT)
  // ============================================================================
  ctx.updaters.push({
    update: (dt) => {
      // Docked scanner visibility sync
      dockedScanner.visible = sharedScanner.heldByLane !== laneNum;

      // Brass power key rotation
      const targetKeyRot = laneOpen ? Math.PI / 2 : 0;
      brassKeyPivot.rotation.z = THREE.MathUtils.damp(brassKeyPivot.rotation.z, targetKeyRot, 14, dt);

      // Conveyor belt texture & unscanned items gliding to infrared photo-cell (Z = +0.16)
      let frontItemBlocked = false;
      for (let i = 0; i < beltSlots.length; i++) {
        const s = beltSlots[i];
        if (s.active && !s.scanned && s.zPos >= 0.14) {
          frontItemBlocked = true;
          break;
        }
      }

      if (laneOpen && beltRunning && !frontItemBlocked) {
        if (beltMat.map) {
          beltMat.map.offset.y = (beltMat.map.offset.y - dt * 0.42) % 1;
        }
        for (let i = 0; i < beltSlots.length; i++) {
          const s = beltSlots[i];
          if (s.active && !s.scanned) {
            s.zPos = Math.min(0.15, s.zPos + dt * 0.34);
            s.group.position.z = s.zPos;
          }
        }
      }

      // Smooth slide of scanned items into stainless bagging well
      for (let i = 0; i < beltSlots.length; i++) {
        const s = beltSlots[i];
        if (s.active && s.scanned && !s.bagged) {
          s.bagAnimT = Math.min(1, s.bagAnimT + dt * 2.4);
          s.group.position.lerp(s.targetBagPos, Math.min(1, dt * 8));
          if (s.bagAnimT >= 1) {
            s.bagged = true;
          }
        }
      }

      // Motorized cash drawer slide
      const drawerTargetZ = paymentMode === 'CASH_OPEN' ? 0.36 : 0.02;
      drawerSlideGroup.position.z = THREE.MathUtils.damp(
        drawerSlideGroup.position.z,
        drawerTargetZ,
        10,
        dt
      );

      // 1990 Carte Bleue Terminal sequence
      if (paymentMode === 'CB_INSERT') {
        tpeCardMesh.position.z = THREE.MathUtils.damp(tpeCardMesh.position.z, 0.095, 9, dt);
        cbTimer -= dt;
        if (cbTimer <= 0) {
          paymentMode = 'CB_AUTH';
          cbTimer = 1.45;
          soundSynth.playModemAuth();
          statusNotice = 'AUTORISATION RÉSEAU CB EN COURS...';
          vfdLine1 = 'AUTORISATION CB';
          vfdLine2 = 'PATIENTEZ...';
          displayDirty = true;
          vfdDirty = true;
          tpeDirty = true;
        }
      } else if (paymentMode === 'CB_AUTH') {
        cbTimer -= dt;
        if (cbTimer <= 0) {
          paymentMode = 'CB_APPROVED';
          cbTimer = 1.1;
          soundSynth.playAtmPiezo('confirm');
          soundSynth.playCardEject();
          statusNotice = 'CARTE BLEUE · PAIEMENT ACCEPTÉ';
          vfdLine1 = 'PAIEMENT ACCEPTE';
          vfdLine2 = 'CARTE BLEUE 1990';
          displayDirty = true;
          vfdDirty = true;
          tpeDirty = true;
        }
      } else if (paymentMode === 'CB_APPROVED') {
        tpeCardMesh.position.z = THREE.MathUtils.damp(tpeCardMesh.position.z, 0.16, 9, dt);
        cbTimer -= dt;
        if (cbTimer <= 0) {
          tpeCardMesh.visible = false;
          finalizeTransaction('CARTE BLEUE');
        }
      }

      // Receipt extrusion animation
      if (receiptMesh.visible) {
        receiptMesh.position.y = THREE.MathUtils.damp(
          receiptMesh.position.y,
          receiptTargetY,
          8,
          dt
        );
      }

      // Physical button depression spring-back
      for (let i = 0; i < animatedButtons.length; i++) {
        const b = animatedButtons[i];
        if (b.press > 0.001) {
          b.press = THREE.MathUtils.damp(b.press, 0, 16, dt);
          if (b.axis === 'y') {
            b.mesh.position.y = b.rest - b.press * 0.009;
          } else {
            b.mesh.position.z = b.rest - b.press * 0.009;
          }
        } else {
          if (b.axis === 'y' && b.mesh.position.y !== b.rest) b.mesh.position.y = b.rest;
          if (b.axis === 'z' && b.mesh.position.z !== b.rest) b.mesh.position.z = b.rest;
        }
      }

      // Till coin/bill pop animation when giving change
      for (let i = 0; i < animatedTillPops.length; i++) {
        const p = animatedTillPops[i];
        if (p.pop > 0.001) {
          p.pop = THREE.MathUtils.damp(p.pop, 0, 12, dt);
          p.mesh.position.y = p.restY + p.pop * 0.025;
        } else if (p.mesh.position.y !== p.restY) {
          p.mesh.position.y = p.restY;
        }
      }

      // Redraw procedural displays strictly on state change (zero per-frame canvas overhead!)
      if (displayDirty) {
        displayDirty = false;
        redrawOpDisplay();
      }
      if (vfdDirty) {
        vfdDirty = false;
        redrawVfd();
      }
      if (tpeDirty) {
        tpeDirty = false;
        redrawTpeScreen();
      }
    },
  });

  void texBank;
}
