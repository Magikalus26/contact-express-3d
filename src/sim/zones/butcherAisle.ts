import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { ProceduralTextureBank, INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { HeldItemHudInfo, InteractableItem, WorldBuildContext } from '../types';
import { drawPriceTagCanvas, PlayerToolController } from '../playerTools';
import { drawEanBarcode, getProductByEan, parseFrancPriceToCents } from '../productCatalog';
import { buildMultiDepthColumn, ShelfHelperHandle } from './retailShelfSystem';

const BUTCHER_COOLDOWN_MS = 320;
const CHOP_DURATION_SEC = 1.45;
const HAM_STROKE_DURATION_SEC = 0.52;
const MAX_HAM_SLICES = 6;

interface ScalePluDef {
  plu: string;
  ean: string;
  shortName: string;
  labelName: string;
  pricePerKgCents: number;
  pricePerKgText: string;
  wrappedKind: 'butcher_wrapped_beef' | 'butcher_wrapped_pork' | 'butcher_wrapped_ham';
}

const SCALE_PLUS: Record<string, ScalePluDef> = {
  '101': {
    plu: '101',
    ean: '30140401',
    shortName: 'FAUX-FILET BŒUF',
    labelName: 'Faux-Filet de Bœuf (Paquet)',
    pricePerKgCents: 6800,
    pricePerKgText: '68,00 ₣/kg',
    wrappedKind: 'butcher_wrapped_beef',
  },
  '102': {
    plu: '102',
    ean: '30140402',
    shortName: 'RÔTI PORC FILET',
    labelName: 'Rôti de Porc Filet (Paquet)',
    pricePerKgCents: 4200,
    pricePerKgText: '42,00 ₣/kg',
    wrappedKind: 'butcher_wrapped_pork',
  },
  '103': {
    plu: '103',
    ean: '30140403',
    shortName: 'JAMBON BLANC SUP.',
    labelName: 'Jambon Blanc Supérieur (Paquet)',
    pricePerKgCents: 4600,
    pricePerKgText: '46,00 ₣/kg',
    wrappedKind: 'butcher_wrapped_ham',
  },
};

function formatFrancsFromCents(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const w = Math.floor(safe / 100);
  const d = (safe % 100).toString().padStart(2, '0');
  return `${w},${d} ₣`;
}

function makeScaleKeyTexture(
  legend: string,
  bgHex: string,
  textHex: string,
  maxAniso: number
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 96;
  const c = cv.getContext('2d')!;
  c.fillStyle = bgHex;
  c.fillRect(0, 0, 128, 96);
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.fillRect(4, 4, 120, 10);
  c.strokeStyle = 'rgba(255,255,255,0.28)';
  c.lineWidth = 4;
  c.strokeRect(3, 3, 122, 90);
  c.fillStyle = textHex;
  const fs = legend.length >= 6 ? 20 : legend.length >= 4 ? 26 : 46;
  c.font = `900 ${fs}px "JetBrains Mono", monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(legend, 64, 50);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

/**
 * V11 DEPARTMENT 4 — "RAYON 4 — BOUCHERIE & CHARCUTERIE (1990)"
 * Walk-behind authentic 1990 French Carrefour Contact Butcher & Deli zone:
 *  1) Back-Wall Prep Workbench (Z = -6.86..-6.36):
 *     - Solid End-Grain Oak Butcher Block & Animated 3D Knife ([DÉCOUPER AU COUTEAU]) -> Stainless Platter
 *     - 1990 Chromed Rotary Ham Slicer with green power switch, spinning steel blade & sliding carriage ([TRANCHER LE JAMBON])
 *  2) Walk-Behind Service Corridor (Z = -6.34..-5.32, 1.02m wide, open left & right!)
 *  3) Front Refrigerated Curved-Glass Display Counter (X = 2.35..7.45, Z = -5.32..-4.42):
 *     - Rear Sliding Glass Doors (Left & Right panels)
 *     - 100% Diegetic 3D Electronic Weighing Scale ("Balance Électronique 1990") with dual-sided VFD pole display,
 *       16 individual clickable 3D keypad keys (0-9, PLU 101/102/103, TARE, EFF, IMPRIMER TICKET),
 *       white/pink butcher paper wrap & extruded 3D adhesive weight-price barcode ticket ([COLLER ÉTIQUETTE POIDS-PRIX])
 *     - 10 Multi-Depth Chilled Display Columns (3 back-to-front depth slots + [FAIRE LE FACING]) for all 5 V11 products
 *     - 4 Bare 120cm Front Price-Rail Segments at start (clip-on plastic rails + 3 visible price labels per rail)
 */
export function buildButcherAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const deptRoot = new THREE.Group();
  root.add(deptRoot);

  // Overhead 1990 French Department Sign mounted along rear wall
  {
    const signTex = texBank.createDepartmentSignTexture(
      'BOUCHERIE & CHARCUTERIE 1990',
      'VIANDES FRANÇAISES · BILLOT · TRANCHEUSE JAMBON · BALANCE POIDS-PRIX',
      '#7f1d1d',
      '#f87171'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.36 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.52, 0.06), [
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      signMat,
      signMat,
    ]);
    signMesh.position.set(4.9, 2.84, -6.78);
    deptRoot.add(signMesh);
    ctx.disposables.push(signMat, signMesh.geometry);
  }

  // Two clean colliders leaving a spacious 1.02m walk-behind butcher corridor (Z = -6.34..-5.32)!
  addBoxCollider(ctx, 'butcher_back_bench_col', 2.58, 7.22, -6.88, -6.34);
  addBoxCollider(ctx, 'butcher_counter_col', 2.33, 7.47, -5.32, -4.42);

  // Shared lock & hitbox helper
  let lastActionMs = 0;
  const acquireLock = (): boolean => {
    const now = performance.now();
    if (now - lastActionMs < BUTCHER_COOLDOWN_MS) return false;
    lastActionMs = now;
    return true;
  };

  const proxyHiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  const clearPlasticRailMat = new THREE.MeshStandardMaterial({
    color: 0xe2f4ff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.12,
    depthWrite: false,
  });
  ctx.disposables.push(proxyHiddenMat, clearPlasticRailMat);

  const addHitbox: ShelfHelperHandle['addHitbox'] = (parent, opts) => {
    const geo = new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
    ctx.disposables.push(geo);
    const proxy = new THREE.Mesh(geo, proxyHiddenMat);
    proxy.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
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
      productEan: opts.productEan,
      dynamicProductEan: opts.dynamicProductEan,
      dynamicVerb: opts.verb,
      dynamicTitle: opts.dynamicTitle,
      dynamicSubtitle: opts.dynamicSubtitle,
      isVisible: opts.isVisible,
      onHoverUv: opts.onHoverUv,
      onInteract: opts.onInteract,
    };
    proxy.userData.interactable = item;
    ctx.interactables.push(item);
    return proxy;
  };

  const shelfHelper: ShelfHelperHandle = {
    addHitbox,
    acquireLock,
    clearPlasticRailMat,
  };

  // ============================================================================
  // SHARED BUTCHER & DELI MATERIALS & PROCEDURAL MESH BUILDERS
  // ============================================================================
  const beefMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.42 });
  const beefMarbleMat = new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.58 });
  const porkMat = new THREE.MeshStandardMaterial({ color: 0xe09f87, roughness: 0.48 });
  const porkTwineMat = new THREE.MeshStandardMaterial({ color: 0xf5f5dc, roughness: 0.88 });
  const hamPinkMat = new THREE.MeshStandardMaterial({ color: 0xf4a2a2, roughness: 0.4 });
  const hamRindMat = new THREE.MeshStandardMaterial({ color: 0xfde6d8, roughness: 0.55 });
  const deliPaperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.76 });
  const butcherWrapPaperMat = new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.72 });
  const butcherWrapStripeMat = new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.74 });
  const trayFoamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
  const clearWrapMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.28,
    roughness: 0.12,
    depthWrite: false,
  });
  const steakPattyMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.52 });
  const merguezMat = new THREE.MeshStandardMaterial({ color: 0xb4341c, roughness: 0.44 });
  const chipolataMat = new THREE.MeshStandardMaterial({ color: 0xd88c6a, roughness: 0.48 });
  const brushedInoxMat = new THREE.MeshStandardMaterial({
    color: 0xdbe2ea,
    roughness: 0.26,
    metalness: 0.82,
  });
  ctx.disposables.push(
    beefMat,
    beefMarbleMat,
    porkMat,
    porkTwineMat,
    hamPinkMat,
    hamRindMat,
    deliPaperMat,
    butcherWrapPaperMat,
    butcherWrapStripeMat,
    trayFoamMat,
    clearWrapMat,
    steakPattyMat,
    merguezMat,
    chipolataMat,
    brushedInoxMat
  );

  // Reusable geometries
  const platterGeo = new THREE.BoxGeometry(0.32, 0.014, 0.19);
  const steakSliceGeo = new THREE.BoxGeometry(0.11, 0.022, 0.072);
  const steakFatGeo = new THREE.BoxGeometry(0.112, 0.008, 0.012);
  const porkMedalGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.024, 12);
  const hamSliceGeo = new THREE.BoxGeometry(0.14, 0.006, 0.11);
  const wrapParcelGeo = new THREE.BoxGeometry(0.24, 0.068, 0.16);
  const wrapBandGeo = new THREE.BoxGeometry(0.244, 0.07, 0.036);
  const prepackTrayGeo = new THREE.BoxGeometry(0.26, 0.032, 0.17);
  const prepackFilmGeo = new THREE.BoxGeometry(0.264, 0.056, 0.174);
  const pattyGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.016, 12);
  const sausageGeo = new THREE.CapsuleGeometry(0.012, 0.09, 4, 8);
  sausageGeo.rotateZ(Math.PI / 2);
  const stickerPlaneGeo = new THREE.PlaneGeometry(0.095, 0.062);

  ctx.disposables.push(
    platterGeo,
    steakSliceGeo,
    steakFatGeo,
    porkMedalGeo,
    hamSliceGeo,
    wrapParcelGeo,
    wrapBandGeo,
    prepackTrayGeo,
    prepackFilmGeo,
    pattyGeo,
    sausageGeo,
    stickerPlaneGeo
  );

  const makeTrayStickerMat = (title: string, price: string, ean: string): THREE.MeshStandardMaterial => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 160;
    const c = cv.getContext('2d')!;
    c.fillStyle = '#fffef8';
    c.fillRect(0, 0, 256, 160);
    c.fillStyle = '#7f1d1d';
    c.fillRect(0, 0, 256, 32);
    c.fillStyle = '#ffffff';
    c.font = '800 16px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(title, 128, 16);
    c.fillStyle = '#b91c1c';
    c.font = '900 26px "JetBrains Mono", monospace';
    c.fillText(price, 128, 56);
    drawEanBarcode(c, ean, 28, 76, 200, 74, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  const beefStickerMat = makeTrayStickerMat('FAUX-FILET BŒUF', '30,60 ₣', '30140401');
  const porkStickerMat = makeTrayStickerMat('RÔTI PORC FILET', '26,04 ₣', '30140402');
  const hamStickerMat = makeTrayStickerMat('JAMBON BLANC SUP.', '12,88 ₣', '30140403');
  const steaksStickerMat = makeTrayStickerMat('STEAKS HACHÉS ×6', '29,50 ₣', '30140404');
  const merguezStickerMat = makeTrayStickerMat('MERGUEZ & SAUC. ×6', '26,00 ₣', '30140405');

  const buildBeefPlatterMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const pl = new THREE.Mesh(platterGeo, brushedInoxMat);
    pl.position.y = 0.008;
    g.add(pl);
    [
      [-0.075, -0.042],
      [0.075, -0.042],
      [-0.075, 0.042],
      [0.075, 0.042],
    ].forEach(([sx, sz]) => {
      const st = new THREE.Mesh(steakSliceGeo, beefMat);
      st.position.set(sx, 0.025, sz);
      const fat = new THREE.Mesh(steakFatGeo, beefMarbleMat);
      fat.position.set(sx, 0.037, sz - 0.02);
      g.add(st, fat);
    });
    return g;
  };

  const buildPorkPlatterMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const pl = new THREE.Mesh(platterGeo, brushedInoxMat);
    pl.position.y = 0.008;
    g.add(pl);
    [-0.095, -0.032, 0.032, 0.095].forEach((px, idx) => {
      const m = new THREE.Mesh(porkMedalGeo, porkMat);
      m.position.set(px, 0.026, idx % 2 === 0 ? -0.015 : 0.015);
      g.add(m);
    });
    return g;
  };

  const buildHamSlicedMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.004, 0.16), deliPaperMat);
    paper.position.y = 0.003;
    ctx.disposables.push(paper.geometry);
    g.add(paper);
    for (let i = 0; i < 5; i++) {
      const sl = new THREE.Mesh(hamSliceGeo, hamPinkMat);
      sl.position.set(-0.02 + i * 0.01, 0.009 + i * 0.0065, 0);
      sl.rotation.y = (i - 2) * 0.06;
      g.add(sl);
    }
    return g;
  };

  const buildWrappedButcherParcelMesh = (stickerMat: THREE.Material): THREE.Group => {
    const g = new THREE.Group();
    const parcel = new THREE.Mesh(wrapParcelGeo, butcherWrapPaperMat);
    parcel.position.y = 0.036;
    const stripe = new THREE.Mesh(wrapBandGeo, butcherWrapStripeMat);
    stripe.position.y = 0.036;
    const ticket = new THREE.Mesh(stickerPlaneGeo, stickerMat);
    ticket.rotation.x = -Math.PI / 2;
    ticket.position.set(0, 0.072, 0);
    g.add(parcel, stripe, ticket);
    return g;
  };

  const buildSteaksHachesTrayMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(prepackTrayGeo, trayFoamMat);
    tray.position.y = 0.016;
    g.add(tray);
    [-0.078, 0, 0.078].forEach((px) => {
      [-0.038, 0.038].forEach((pz) => {
        const p = new THREE.Mesh(pattyGeo, steakPattyMat);
        p.position.set(px, 0.036, pz);
        g.add(p);
      });
    });
    const film = new THREE.Mesh(prepackFilmGeo, clearWrapMat);
    film.position.y = 0.03;
    film.renderOrder = 3;
    const lbl = new THREE.Mesh(stickerPlaneGeo, steaksStickerMat);
    lbl.rotation.x = -Math.PI / 2;
    lbl.position.set(0.05, 0.059, 0.02);
    g.add(film, lbl);
    return g;
  };

  const buildMerguezTrayMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const tray = new THREE.Mesh(prepackTrayGeo, trayFoamMat);
    tray.position.y = 0.016;
    g.add(tray);
    [-0.052, -0.026, 0.0, 0.026, 0.052].forEach((sz, idx) => {
      const s = new THREE.Mesh(sausageGeo, idx < 3 ? merguezMat : chipolataMat);
      s.position.set(0, 0.036, sz);
      g.add(s);
    });
    const film = new THREE.Mesh(prepackFilmGeo, clearWrapMat);
    film.position.y = 0.03;
    film.renderOrder = 3;
    const lbl = new THREE.Mesh(stickerPlaneGeo, merguezStickerMat);
    lbl.rotation.x = -Math.PI / 2;
    lbl.position.set(0.05, 0.059, 0.02);
    g.add(film, lbl);
    return g;
  };

  // ============================================================================
  // 1. BACK-WALL BUTCHER PREP WORKBENCH (Z = -6.86..-6.36, X = 2.60..7.20)
  //    Left: Oak Butcher Block & Animated 3D Knife
  //    Right: 1990 Chromed Rotary Ham Slicer
  // ============================================================================
  {
    const benchRoot = new THREE.Group();
    benchRoot.position.set(4.9, 0, -6.61);
    deptRoot.add(benchRoot);

    const benchTop = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.06, 0.5), brushedInoxMat);
    benchTop.position.y = 0.85;
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    const benchSplash = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.14, 0.03), brushedInoxMat);
    benchSplash.position.set(0, 0.94, -0.235);
    const benchShelf = new THREE.Mesh(new THREE.BoxGeometry(4.48, 0.03, 0.44), brushedInoxMat);
    benchShelf.position.y = 0.24;
    const legGeo = new THREE.BoxGeometry(0.05, 0.84, 0.05);
    [-2.2, -0.75, 0.75, 2.2].forEach((lx) => {
      [-0.21, 0.21].forEach((lz) => {
        const leg = new THREE.Mesh(legGeo, brushedInoxMat);
        leg.position.set(lx, 0.42, lz);
        benchRoot.add(leg);
      });
    });
    benchRoot.add(benchTop, benchSplash, benchShelf);
    ctx.disposables.push(benchTop.geometry, benchSplash.geometry, benchShelf.geometry, legGeo);

    // --------------------------------------------------------------------------
    // 1A. END-GRAIN OAK BUTCHER BLOCK & 3D KNIFE ("BILLOT & COUTEAU DE BOUCHER")
    //     Local X = -1.15 (World X = 3.75)
    // --------------------------------------------------------------------------
    const blockGrp = new THREE.Group();
    blockGrp.position.set(-1.15, 0.88, 0.02);
    benchRoot.add(blockGrp);

    const oakBoardMat = new THREE.MeshStandardMaterial({ color: 0xb98249, roughness: 0.72 });
    const knifeHandleMat = new THREE.MeshStandardMaterial({ color: 0x3f2314, roughness: 0.62 });
    const knifeBladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.92,
    });
    ctx.disposables.push(oakBoardMat, knifeHandleMat, knifeBladeMat);

    const cuttingBoard = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.075, 0.4), oakBoardMat);
    cuttingBoard.position.y = 0.038;
    cuttingBoard.castShadow = true;
    cuttingBoard.receiveShadow = true;
    blockGrp.add(cuttingBoard);
    ctx.disposables.push(cuttingBoard.geometry);

    // Raw primal meat blocks placed on cutting board
    const rawBeefBlock = new THREE.Group();
    const rbCore = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.095, 0.15), beefMat);
    rbCore.position.y = 0.125;
    const rbFatCap = new THREE.Mesh(new THREE.BoxGeometry(0.282, 0.018, 0.152), beefMarbleMat);
    rbFatCap.position.y = 0.175;
    rawBeefBlock.add(rbCore, rbFatCap);
    rawBeefBlock.visible = false;

    const rawPorkBlock = new THREE.Group();
    const rpCore = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.28, 12), porkMat);
    rpCore.rotation.z = Math.PI / 2;
    rpCore.position.y = 0.145;
    rawPorkBlock.add(rpCore);
    [-0.08, 0, 0.08].forEach((tx) => {
      const twine = new THREE.Mesh(new THREE.TorusGeometry(0.069, 0.004, 6, 14), porkTwineMat);
      twine.rotation.y = Math.PI / 2;
      twine.position.set(tx, 0.145, 0);
      rawPorkBlock.add(twine);
      ctx.disposables.push(twine.geometry);
    });
    rawPorkBlock.visible = false;

    // 3D Butcher Knife (animated chopping pivot)
    const knifePivot = new THREE.Group();
    const knifeRestPos = new THREE.Vector3(0.22, 0.085, 0.04);
    knifePivot.position.copy(knifeRestPos);
    const kBlade = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.052, 0.22), knifeBladeMat);
    kBlade.position.set(0, 0.018, -0.05);
    const kHandle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.12), knifeHandleMat);
    kHandle.position.set(0, 0.026, 0.11);
    knifePivot.add(kBlade, kHandle);
    knifePivot.rotation.z = Math.PI / 2; // Resting flat on board when idle

    // Adjacent Stainless Display Platter Output Slot (Local X = +0.52 relative to blockGrp)
    const outputBeefPlatter = buildBeefPlatterMesh();
    outputBeefPlatter.position.set(0.54, 0.005, 0);
    outputBeefPlatter.visible = false;
    const outputPorkPlatter = buildPorkPlatterMesh();
    outputPorkPlatter.position.set(0.54, 0.005, 0);
    outputPorkPlatter.visible = false;

    blockGrp.add(rawBeefBlock, rawPorkBlock, knifePivot, outputBeefPlatter, outputPorkPlatter);
    ctx.disposables.push(
      rbCore.geometry,
      rbFatCap.geometry,
      rpCore.geometry,
      kBlade.geometry,
      kHandle.geometry
    );

    type BlockState = 'empty' | 'raw_loaded' | 'chopping' | 'platter_ready';
    let blockState: BlockState = 'empty';
    let blockMeatType: 'beef' | 'pork' | null = null;
    let chopElapsed = 0;

    addHitbox(blockGrp, {
      id: 'butcher_cutting_board',
      size: [0.7, 0.28, 0.46],
      pos: [0, 0.15, 0],
      title: 'Billot & Couteau de Boucher (Chêne)',
      subtitle: 'Découpez pièces de Faux-Filet de Bœuf ou Rôti de Porc',
      dynamicSubtitle: () => {
        if (blockState === 'empty') {
          return 'Commandez Faux-Filet / Rôti de Porc puis posez la pièce crue sur le billot';
        }
        if (blockState === 'raw_loaded') {
          return blockMeatType === 'beef'
            ? 'Pièce de Faux-Filet posée — Découpez au couteau pour préparer le Plateau Inox'
            : 'Rôti de Porc posé — Découpez au couteau pour préparer le Plateau Inox';
        }
        if (blockState === 'chopping') {
          return 'Découpe au couteau de boucher en cours...';
        }
        return 'Plateau Inox prêt à droite du billot — Prenez-le pour peser ou mettre en vitrine';
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (blockState === 'empty') {
          if (
            tools.getActiveTool() === 'hands' &&
            (held?.kind === 'beef_primal' || held?.kind === 'pork_primal')
          ) {
            return 'POSER SUR LE BILLOT';
          }
          return 'BILLOT VIDE (PIÈCE BŒUF OU PORC)';
        }
        if (blockState === 'raw_loaded') {
          return 'DÉCOUPER AU COUTEAU';
        }
        if (blockState === 'chopping') {
          return 'DÉCOUPE EN COURS...';
        }
        return 'PRENDRE LE PLATEAU INOX À DROITE';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        const held = tools.getHeldItem();

        if (
          blockState === 'empty' &&
          tools.getActiveTool() === 'hands' &&
          (held?.kind === 'beef_primal' || held?.kind === 'pork_primal')
        ) {
          blockMeatType = held.kind === 'beef_primal' ? 'beef' : 'pork';
          blockState = 'raw_loaded';
          rawBeefBlock.visible = blockMeatType === 'beef';
          rawPorkBlock.visible = blockMeatType === 'pork';
          tools.consumeHeldItem();
          soundSynth.playBagThump();
          return;
        }

        if (blockState === 'raw_loaded') {
          blockState = 'chopping';
          chopElapsed = 0;
          soundSynth.playButcherKnifeChop();
          return;
        }

        soundSynth.playUiTone(false);
      },
    });

    addHitbox(blockGrp, {
      id: 'butcher_platter_output',
      size: [0.38, 0.2, 0.3],
      pos: [0.54, 0.1, 0],
      title: 'Plateau Inox — Viande Découpée',
      subtitle: 'À peser sur la Balance 1990 ou placer en vitrine réfrigérée',
      isVisible: () => blockState === 'platter_ready',
      dynamicProductEan: () =>
        blockMeatType === 'beef' ? '30140401' : blockMeatType === 'pork' ? '30140402' : null,
      verb: () => {
        const held = tools.getHeldItem();
        if (tools.getActiveTool() === 'hands' && !held) {
          return blockMeatType === 'beef'
            ? 'PRENDRE PLATEAU FAUX-FILET'
            : 'PRENDRE PLATEAU RÔTI PORC';
        }
        return 'PLATEAU INOX PRÊT (MAINS LIBRES)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        if (blockState !== 'platter_ready' || !blockMeatType) return;
        if (tools.getActiveTool() !== 'hands' || tools.getHeldItem()) {
          soundSynth.playAtmPiezo('error');
          return;
        }
        const isBeef = blockMeatType === 'beef';
        blockState = 'empty';
        blockMeatType = null;
        outputBeefPlatter.visible = false;
        outputPorkPlatter.visible = false;
        tools.pickUpItem({
          kind: isBeef ? 'beef_platter' : 'pork_platter',
          label: isBeef
            ? 'Plateau Inox — Faux-Filet de Bœuf'
            : 'Plateau Inox — Rôti de Porc Filet',
          sublabel: 'Peser sur la Balance 1990 ou placer en vitrine',
          ean: isBeef ? '30140401' : '30140402',
        });
        soundSynth.playPlasticSlide();
      },
    });

    ctx.updaters.push({
      update: (dt) => {
        if (blockState === 'chopping') {
          chopElapsed = Math.min(CHOP_DURATION_SEC, chopElapsed + dt);
          const t = chopElapsed / CHOP_DURATION_SEC;
          const chopWave = Math.abs(Math.sin(t * Math.PI * 4));
          // Vertical butcher chopping motion sweeping across the meat block
          knifePivot.rotation.z = THREE.MathUtils.damp(knifePivot.rotation.z, 0, 16, dt);
          knifePivot.position.x = THREE.MathUtils.lerp(-0.1, 0.1, t);
          knifePivot.position.y = 0.12 + chopWave * 0.13;
          knifePivot.rotation.x = -0.25 + chopWave * 0.45;

          if (chopElapsed >= CHOP_DURATION_SEC) {
            blockState = 'platter_ready';
            rawBeefBlock.visible = false;
            rawPorkBlock.visible = false;
            outputBeefPlatter.visible = blockMeatType === 'beef';
            outputPorkPlatter.visible = blockMeatType === 'pork';
            soundSynth.playAtmPiezo('confirm');
          }
        } else {
          knifePivot.position.x = THREE.MathUtils.damp(knifePivot.position.x, knifeRestPos.x, 10, dt);
          knifePivot.position.y = THREE.MathUtils.damp(knifePivot.position.y, knifeRestPos.y, 10, dt);
          knifePivot.rotation.x = THREE.MathUtils.damp(knifePivot.rotation.x, 0, 10, dt);
          knifePivot.rotation.z = THREE.MathUtils.damp(knifePivot.rotation.z, Math.PI / 2, 10, dt);
        }
      },
    });

    // --------------------------------------------------------------------------
    // 1B. 1990 CHROMED ROTARY MEAT SLICER ("TRANCHEUSE À JAMBON 1990")
    //     Local X = +0.95 (World X = 5.85)
    // --------------------------------------------------------------------------
    const slicerGrp = new THREE.Group();
    slicerGrp.position.set(0.95, 0.88, 0.02);
    benchRoot.add(slicerGrp);

    const slicerBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.4), mats.chrome);
    slicerBase.position.y = 0.05;
    slicerBase.castShadow = true;

    const bladeHousing = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.26), brushedInoxMat);
    bladeHousing.position.set(-0.16, 0.18, -0.01);

    // Aligned Parent Pivot Group for Circular Blade & Guard (~25° ergonomic tilt along carriage length)
    const bladePivotGroup = new THREE.Group();
    bladePivotGroup.position.set(-0.04, 0.255, 0.01);
    bladePivotGroup.rotation.z = Math.PI / 2 - 0.436; // Fixed ~25° tilt applied ONLY to parent group

    // Rear Protective Blade Guard Plate (static child of bladePivotGroup, parallel behind the blade)
    const bladeGuardPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.164, 0.164, 0.01, 24),
      brushedInoxMat
    );
    bladeGuardPlate.position.y = 0.018;

    // Central Chrome Retaining Hub Cap (static child of bladePivotGroup)
    const bladeHubCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.04, 0.022, 16),
      mats.chrome
    );
    bladeHubCap.position.y = -0.004;

    // Spinning Circular Stainless Steel Blade (rotates ONLY around its local central Y normal axis)
    const bladeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.155, 0.014, 24),
      knifeBladeMat
    );
    // Subtle dark radial index groove so in-plane blade spin is unmistakably visible
    const bladeMark = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.0155, 0.27),
      mats.anthracite
    );
    bladeDisc.add(bladeMark);
    bladePivotGroup.add(bladeGuardPlate, bladeDisc, bladeHubCap);

    // Physical 3D Green Power Toggle Switch + Pilot LED on front base
    const slicerSwitchMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x16a34a,
      emissiveIntensity: 0.15,
      roughness: 0.38,
    });
    const slicerLedMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      emissive: 0x22c55e,
      emissiveIntensity: 0.04,
      roughness: 0.3,
    });
    const slicerSwitchMesh = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.034, 0.03), slicerSwitchMat);
    slicerSwitchMesh.position.set(-0.18, 0.06, 0.205);
    const slicerLed = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 8), slicerLedMat);
    slicerLed.position.set(-0.11, 0.06, 0.205);

    // Chrome Slide Rail along Z beneath the sliding meat carriage
    const carriageRail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.36, 12),
      mats.chrome
    );
    carriageRail.rotation.x = Math.PI / 2;
    carriageRail.position.set(0.11, 0.125, 0.01);

    // Sliding Angled Stainless Meat Carriage + Spiked Pusher Arm (Bras Pousse-Talon) + Red/Chromed Push Lever
    const carriageGrp = new THREE.Group();
    const CARRIAGE_HOME_Z = 0.04;
    const CARRIAGE_CUT_Z = -0.15;
    carriageGrp.position.set(0.11, 0.19, CARRIAGE_HOME_Z);

    const cSlideBlock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.09), mats.chrome);
    cSlideBlock.position.set(0, -0.045, 0);

    const cTray = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.26), brushedInoxMat);
    cTray.rotation.z = -0.26;

    const cWall = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.26), brushedInoxMat);
    cWall.position.set(0.095, 0.072, 0);
    cWall.rotation.z = -0.26;

    const redPusherMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.28,
      metalness: 0.08,
    });

    // Vertical chrome guide rod + Animated Spiked Pusher Arm ("Bras Pousse-Talon")
    const pusherGuideRod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.26, 10),
      mats.chrome
    );
    pusherGuideRod.position.set(0.12, 0.12, -0.02);

    const pusherArmGrp = new THREE.Group();
    pusherArmGrp.position.set(0.02, 0.21, -0.01);
    pusherArmGrp.rotation.z = 0.28; // Raised open when carriage is empty

    const pusherBar = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.014, 0.026), mats.chrome);
    pusherBar.position.set(0.04, 0.018, 0);
    const pusherPlate = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.012, 0.14), brushedInoxMat);
    pusherPlate.position.set(-0.01, 0, 0);
    const pusherKnob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), redPusherMat);
    pusherKnob.position.set(-0.01, 0.032, 0);

    const spikeGeo = new THREE.ConeGeometry(0.006, 0.016, 6);
    const spikeOffsets: Array<[number, number]> = [
      [-0.035, -0.04],
      [0.015, -0.04],
      [-0.035, 0],
      [0.015, 0],
      [-0.035, 0.04],
      [0.015, 0.04],
    ];
    spikeOffsets.forEach(([sx, sz]) => {
      const sp = new THREE.Mesh(spikeGeo, mats.chrome);
      sp.rotation.x = Math.PI; // Pointing downward into the ham block
      sp.position.set(sx, -0.012, sz);
      pusherArmGrp.add(sp);
    });
    pusherArmGrp.add(pusherBar, pusherPlate, pusherKnob);

    // Distinct Clickable 3D Red/Chromed Carriage Push-Handle / Lever ("Poignée du Chariot")
    const carriageLeverGrp = new THREE.Group();
    carriageLeverGrp.position.set(0.11, 0.04, 0.145);

    const leverStem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.012, 0.12, 10),
      mats.chrome
    );
    leverStem.rotation.x = Math.PI / 2 - 0.38;
    leverStem.position.set(0, 0.015, 0.035);

    const leverCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.017, 0.016, 12),
      mats.chrome
    );
    leverCollar.rotation.x = 0.25;
    leverCollar.position.set(0, 0.042, 0.082);

    const leverGrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.019, 0.095, 14),
      redPusherMat
    );
    leverGrip.rotation.x = 0.25;
    leverGrip.position.set(0, 0.092, 0.095);

    const leverTopCap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), redPusherMat);
    leverTopCap.position.set(0, 0.138, 0.107);

    carriageLeverGrp.add(leverStem, leverCollar, leverGrip, leverTopCap);

    // Mounted 3D Whole Cooked Ham Block (shrinks progressively on each slicing pass)
    const mountedHam = new THREE.Group();
    const hamCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.19), hamPinkMat);
    hamCore.position.set(0.005, 0.068, 0);
    const hamTopRind = new THREE.Mesh(new THREE.BoxGeometry(0.144, 0.018, 0.192), hamRindMat);
    hamTopRind.position.set(0.005, 0.123, 0);
    mountedHam.add(hamCore, hamTopRind);
    mountedHam.rotation.z = -0.26;
    mountedHam.visible = false;

    carriageGrp.add(
      cSlideBlock,
      cTray,
      cWall,
      pusherGuideRod,
      pusherArmGrp,
      carriageLeverGrp,
      mountedHam
    );

    // Stainless Steel Receiving Platter + Deli Paper Sheet (Left of blade) stacking fresh pink slices
    const receivingPlatter = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.014, 0.24),
      brushedInoxMat
    );
    receivingPlatter.position.set(-0.38, 0.008, 0.03);
    const deliPaperCatch = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.004, 0.19), deliPaperMat);
    deliPaperCatch.position.set(-0.38, 0.017, 0.03);

    const caughtSlices: THREE.Mesh[] = [];
    for (let i = 0; i < MAX_HAM_SLICES; i++) {
      const sl = new THREE.Mesh(hamSliceGeo, hamPinkMat);
      sl.position.set(-0.38 + (i - 2.5) * 0.012, 0.023 + i * 0.0065, 0.03 + (i % 2 === 0 ? -0.008 : 0.008));
      sl.rotation.y = (i - 2.5) * 0.07;
      sl.visible = false;
      slicerGrp.add(sl);
      caughtSlices.push(sl);
    }

    slicerGrp.add(
      slicerBase,
      bladeHousing,
      bladePivotGroup,
      slicerSwitchMesh,
      slicerLed,
      carriageRail,
      carriageGrp,
      receivingPlatter,
      deliPaperCatch
    );
    ctx.disposables.push(
      slicerBase.geometry,
      bladeHousing.geometry,
      bladeGuardPlate.geometry,
      bladeHubCap.geometry,
      bladeDisc.geometry,
      bladeMark.geometry,
      slicerSwitchMat,
      slicerLedMat,
      slicerSwitchMesh.geometry,
      slicerLed.geometry,
      carriageRail.geometry,
      cSlideBlock.geometry,
      cTray.geometry,
      cWall.geometry,
      redPusherMat,
      pusherGuideRod.geometry,
      pusherBar.geometry,
      pusherPlate.geometry,
      pusherKnob.geometry,
      spikeGeo,
      leverStem.geometry,
      leverCollar.geometry,
      leverGrip.geometry,
      leverTopCap.geometry,
      hamCore.geometry,
      hamTopRind.geometry,
      receivingPlatter.geometry,
      deliPaperCatch.geometry
    );

    let slicerPowerOn = false;
    let bladeSpinSpeed = 0;
    let hamLoaded = false;
    let hamRemainingSlices = 0;
    let slicesProduced = 0;
    let strokeActive = false;
    let strokeElapsed = 0;
    let strokeSliceAwarded = false;

    const isHoldingSlicableHam = (): boolean => {
      if (tools.getActiveTool() !== 'hands') return false;
      const held = tools.getHeldItem();
      if (!held) return false;
      return (
        held.kind === 'ham_block' ||
        held.kind === 'ham_sliced_pack' ||
        (held.ean === '30140403' && held.kind !== 'butcher_wrapped_ham')
      );
    };

    const tryLoadHamOnCarriage = (): boolean => {
      if (!hamLoaded && isHoldingSlicableHam()) {
        hamLoaded = true;
        hamRemainingSlices = MAX_HAM_SLICES;
        mountedHam.visible = true;
        mountedHam.scale.set(1, 1, 1);
        mountedHam.position.set(0, 0, 0);
        tools.consumeHeldItem();
        soundSynth.playBagThump();
        return true;
      }
      return false;
    };

    const tryPushCarriageStroke = (): void => {
      if (!hamLoaded) {
        if (!tryLoadHamOnCarriage()) {
          soundSynth.playUiTone(false);
        }
        return;
      }
      if (!slicerPowerOn) {
        soundSynth.playAtmPiezo('error');
        return;
      }
      if (strokeActive) return;
      if (slicesProduced >= MAX_HAM_SLICES) {
        soundSynth.playAtmPiezo('error');
        return;
      }
      strokeActive = true;
      strokeElapsed = 0;
      strokeSliceAwarded = false;
      soundSynth.playHamSlicerStroke();
    };

    // 1) Physical 3D Green Power Toggle Switch Hitbox
    addHitbox(slicerGrp, {
      id: 'butcher_ham_slicer_power',
      size: [0.16, 0.14, 0.12],
      pos: [-0.15, 0.075, 0.215],
      title: 'Interrupteur Vert — Trancheuse à Jambon 1990',
      subtitle: 'Mise en rotation de la lame circulaire inox',
      verb: () => (slicerPowerOn ? 'ÉTEINDRE TRANCHEUSE' : 'ALLUMER TRANCHEUSE'),
      onInteract: () => {
        if (!acquireLock()) return;
        if (strokeActive) {
          soundSynth.playAtmPiezo('error');
          return;
        }
        slicerPowerOn = !slicerPowerOn;
        soundSynth.playHamSlicerToggle(slicerPowerOn);
      },
    });

    // 2) Generous Stainless Meat Carriage & Pusher Arm Hitbox (attached to carriageGrp so it moves with the carriage!)
    addHitbox(carriageGrp, {
      id: 'butcher_ham_slicer_carriage',
      size: [0.38, 0.38, 0.36],
      pos: [0.0, 0.12, 0.0],
      title: 'Chariot de la Trancheuse — Jambon 1990',
      subtitle: 'Posez un Jambon Blanc Supérieur puis actionnez le chariot',
      dynamicSubtitle: () => {
        if (!hamLoaded) {
          if (isHoldingSlicableHam()) {
            return 'Appuyez pour poser le Jambon Blanc Supérieur sur le chariot inox et abaisser le bras pousse-talon';
          }
          if (slicesProduced > 0) {
            return `${slicesProduced} tranche(s) sur le plateau inox à gauche · Tenez un Jambon Blanc Supérieur pour recharger`;
          }
          return 'Tenez un Jambon Blanc Supérieur (30140403) pour le poser sur le chariot';
        }
        if (!slicerPowerOn) {
          return 'Jambon calé sous le bras pousse-talon — Allumez l’interrupteur vert à gauche pour démarrer la lame';
        }
        if (slicesProduced >= MAX_HAM_SLICES) {
          return 'Plateau récepteur plein (6 tranches) — Prenez les tranches à gauche';
        }
        return `Jambon prêt (${hamRemainingSlices} coupes restantes · ${slicesProduced}/${MAX_HAM_SLICES} tranches sur le plateau)`;
      },
      verb: () => {
        if (!hamLoaded) {
          if (isHoldingSlicableHam()) {
            return 'POSER LE JAMBON SUR LE CHARIOT';
          }
          return slicesProduced > 0
            ? 'PRENDRE LES TRANCHES À GAUCHE'
            : 'CHARIOT VIDE (TENIR BLOC JAMBON)';
        }
        if (!slicerPowerOn) {
          return 'ALLUMER TRANCHEUSE';
        }
        if (strokeActive) {
          return 'TRANCHAGE EN COURS...';
        }
        if (slicesProduced >= MAX_HAM_SLICES) {
          return 'PLATEAU PLEIN — PRENDRE TRANCHES';
        }
        return 'ACTIONNER LE CHARIOT (TRANCHER)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        if (!hamLoaded) {
          if (!tryLoadHamOnCarriage()) {
            soundSynth.playUiTone(false);
          }
          return;
        }
        tryPushCarriageStroke();
      },
    });

    // 3) Distinct Clickable 3D Red/Chromed Carriage Push-Handle / Lever ("Poignée du Chariot")
    addHitbox(carriageGrp, {
      id: 'butcher_ham_slicer_lever',
      size: [0.24, 0.26, 0.24],
      pos: [0.11, 0.09, 0.22],
      title: 'Poignée du Chariot — Trancheuse à Jambon 1990',
      subtitle: 'Poussez le levier rouge pour faire glisser le chariot devant la lame',
      dynamicSubtitle: () => {
        if (!hamLoaded) {
          if (isHoldingSlicableHam()) {
            return 'Appuyez pour poser le Jambon Blanc Supérieur sur le chariot inox et abaisser le bras pousse-talon';
          }
          return 'Posez d’abord un Jambon Blanc Supérieur (30140403) sur le chariot inox';
        }
        if (!slicerPowerOn) {
          return 'Jambon calé — Allumez l’interrupteur vert à gauche pour lancer la lame circulaire';
        }
        if (slicesProduced >= MAX_HAM_SLICES) {
          return '6 tranches prêtes sur le plateau inox à gauche — Prenez-les avant de continuer';
        }
        return `Appuyez pour glisser le chariot et découper une tranche (${slicesProduced}/${MAX_HAM_SLICES} tranches)`;
      },
      verb: () => {
        if (!hamLoaded) {
          if (isHoldingSlicableHam()) {
            return 'POSER LE JAMBON SUR LE CHARIOT';
          }
          return 'POSER UN JAMBON D’ABORD';
        }
        if (!slicerPowerOn) {
          return 'ALLUMER TRANCHEUSE';
        }
        if (strokeActive) {
          return 'GLISSEMENT DU CHARIOT...';
        }
        if (slicesProduced >= MAX_HAM_SLICES) {
          return 'PRENDRE LES TRANCHES À GAUCHE';
        }
        return 'ACTIONNER LE CHARIOT (TRANCHER)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        tryPushCarriageStroke();
      },
    });

    // 4) Stainless Receiving Platter Fresh Ham Slices Output Hitbox
    addHitbox(slicerGrp, {
      id: 'butcher_ham_slices_output',
      size: [0.34, 0.2, 0.3],
      pos: [-0.38, 0.09, 0.03],
      title: 'Plateau Récepteur — Tranches de Jambon Blanc Supérieur',
      subtitle: 'Tranches fraîches sur papier charcuterie · Prêtes à peser sur la Balance 1990',
      dynamicSubtitle: () =>
        `${slicesProduced} tranche${slicesProduced > 1 ? 's' : ''} fraîche${slicesProduced > 1 ? 's' : ''} sur papier charcuterie · Peser sur la Balance 1990 ou mettre en vitrine`,
      isVisible: () => slicesProduced > 0,
      productEan: '30140403',
      verb: () => {
        const held = tools.getHeldItem();
        if (tools.getActiveTool() === 'hands' && !held) {
          return 'PRENDRE LES TRANCHES DE JAMBON';
        }
        return 'TRANCHES PRÊTES (MAINS LIBRES)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        if (slicesProduced <= 0) return;
        if (tools.getActiveTool() !== 'hands' || tools.getHeldItem()) {
          soundSynth.playAtmPiezo('error');
          return;
        }
        const count = slicesProduced;
        slicesProduced = 0;
        caughtSlices.forEach((s) => (s.visible = false));
        tools.pickUpItem({
          kind: 'ham_sliced_pack',
          label: `Jambon Blanc Supérieur (${count} tr.)`,
          sublabel: 'Peser sur la Balance 1990 ou placer en vitrine',
          ean: '30140403',
        });
        soundSynth.playPlasticSlide();
      },
    });

    ctx.updaters.push({
      update: (dt) => {
        bladeSpinSpeed = THREE.MathUtils.damp(bladeSpinSpeed, slicerPowerOn ? 18 : 0, 4.5, dt);
        if (bladeSpinSpeed > 0.05) {
          // Spin ONLY the inner blade mesh around its true central cylinder normal axis (local Y)
          bladeDisc.rotation.y += bladeSpinSpeed * dt;
        }
        slicerSwitchMesh.rotation.x = THREE.MathUtils.damp(
          slicerSwitchMesh.rotation.x,
          slicerPowerOn ? -0.35 : 0.25,
          14,
          dt
        );
        slicerLedMat.emissiveIntensity = THREE.MathUtils.damp(
          slicerLedMat.emissiveIntensity,
          slicerPowerOn ? 1.15 : 0.04,
          8,
          dt
        );

        // Animate Spiked Pusher Arm ("bras pousse-talon"): lowers onto ham when loaded, raises open when empty
        const remainingRatio = hamLoaded ? Math.max(0.25, hamRemainingSlices / MAX_HAM_SLICES) : 0;
        const targetPusherY = hamLoaded ? 0.115 + remainingRatio * 0.045 : 0.215;
        const targetPusherRotZ = hamLoaded ? -0.26 : 0.28;
        pusherArmGrp.position.y = THREE.MathUtils.damp(pusherArmGrp.position.y, targetPusherY, 11, dt);
        pusherArmGrp.rotation.z = THREE.MathUtils.damp(pusherArmGrp.rotation.z, targetPusherRotZ, 11, dt);

        // Smoothly shrink mounted ham block as slices are cut
        if (hamLoaded) {
          const targetScaleX = Math.max(0.32, 0.22 + (hamRemainingSlices / MAX_HAM_SLICES) * 0.78);
          mountedHam.scale.x = THREE.MathUtils.damp(mountedHam.scale.x, targetScaleX, 10, dt);
          mountedHam.scale.y = THREE.MathUtils.damp(
            mountedHam.scale.y,
            0.78 + (hamRemainingSlices / MAX_HAM_SLICES) * 0.22,
            10,
            dt
          );
        }

        // Single manual carriage push stroke: smoothly translate along chrome rail past spinning blade and back
        if (strokeActive) {
          strokeElapsed = Math.min(HAM_STROKE_DURATION_SEC, strokeElapsed + dt);
          const t = strokeElapsed / HAM_STROKE_DURATION_SEC;
          const slideCurve = Math.sin(t * Math.PI); // 0 -> 1 -> 0 smooth forward cut & return
          carriageGrp.position.z = THREE.MathUtils.lerp(CARRIAGE_HOME_Z, CARRIAGE_CUT_Z, slideCurve);
          carriageLeverGrp.rotation.x = -0.18 * slideCurve;

          if (!strokeSliceAwarded && t >= 0.48) {
            strokeSliceAwarded = true;
            if (slicesProduced < MAX_HAM_SLICES) {
              slicesProduced++;
              for (let i = 0; i < caughtSlices.length; i++) {
                caughtSlices[i].visible = i < slicesProduced;
              }
            }
            hamRemainingSlices = Math.max(0, hamRemainingSlices - 1);
            if (hamRemainingSlices === 0) {
              soundSynth.playAtmPiezo('confirm');
            }
          }

          if (strokeElapsed >= HAM_STROKE_DURATION_SEC) {
            strokeActive = false;
            carriageLeverGrp.rotation.x = 0;
            if (hamRemainingSlices <= 0) {
              hamLoaded = false;
              mountedHam.visible = false;
            }
          }
        } else {
          carriageGrp.position.z = THREE.MathUtils.damp(carriageGrp.position.z, CARRIAGE_HOME_Z, 12, dt);
          carriageLeverGrp.rotation.x = THREE.MathUtils.damp(carriageLeverGrp.rotation.x, 0, 12, dt);
        }
      },
    });
  }

  // ============================================================================
  // 2. FRONT REFRIGERATED CURVED-GLASS BUTCHER COUNTER (X = 2.35..7.45, Z = -5.32..-4.42)
  //    - Curved front glass canopy + rosy meat display lighting
  //    - Rear Sliding Glass Doors (Left & Right)
  //    - 100% Diegetic 3D Electronic Weighing Scale ("Balance Électronique 1990")
  //    - 10 Multi-Depth Chilled Display Columns (3 back-to-front slots + [FAIRE LE FACING])
  //    - 4 Bare 120cm Front Price-Rail Segments (clip-on rails + 3 visible price labels/rail)
  // ============================================================================
  {
    const counterRoot = new THREE.Group();
    counterRoot.position.set(4.9, 0, -4.87); // Local +Z faces SOUTH toward customer aisle!
    deptRoot.add(counterRoot);

    const len = 5.1;
    // Lower red-tiled base + stainless bumper + chilled stainless display bed + rear marble service ledge
    const base = new THREE.Mesh(new THREE.BoxGeometry(len, 0.78, 0.9), mats.butcherTile);
    base.position.y = 0.39;
    base.castShadow = true;
    base.receiveShadow = true;

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.07, 0.05), mats.stainless);
    bumper.position.set(0, 0.22, 0.475);

    const chilledBed = new THREE.Mesh(new THREE.BoxGeometry(len - 0.08, 0.03, 0.76), brushedInoxMat);
    chilledBed.position.set(0, 0.795, 0.04);
    chilledBed.receiveShadow = true;

    const rearMarbleTop = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.32), mats.whiteMetal);
    rearMarbleTop.position.set(0, 1.24, -0.32);
    rearMarbleTop.castShadow = true;
    rearMarbleTop.receiveShadow = true;

    // Side tempered glass end cheeks
    const sideGlassGeo = new THREE.BoxGeometry(0.025, 0.46, 0.86);
    const sideGlassL = new THREE.Mesh(sideGlassGeo, mats.clearGlass);
    sideGlassL.position.set(-len / 2 + 0.02, 1.02, 0);
    const sideGlassR = new THREE.Mesh(sideGlassGeo, mats.clearGlass);
    sideGlassR.position.set(len / 2 - 0.02, 1.02, 0);

    // Curved front glass canopy facing +Z
    const curvedGlassGeo = new THREE.CylinderGeometry(
      0.5,
      0.5,
      len - 0.06,
      14,
      1,
      true,
      0,
      Math.PI * 0.52
    );
    const curvedGlass = new THREE.Mesh(curvedGlassGeo, mats.clearGlass);
    curvedGlass.rotation.z = Math.PI / 2;
    curvedGlass.position.set(0, 0.78, -0.04);

    // Warm rosy butcher lighting strip + single soft point light (60 FPS safe)
    const bLedMat = new THREE.MeshStandardMaterial({
      color: 0xffe4e6,
      emissive: 0xfda4af,
      emissiveIntensity: 1.35,
    });
    const bLedBar = new THREE.Mesh(new THREE.BoxGeometry(len - 0.24, 0.028, 0.045), bLedMat);
    bLedBar.position.set(0, 1.2, -0.14);
    const bLight = new THREE.PointLight(0xffe4e6, 2.8, 5.2, 1.8);
    bLight.position.set(0, 1.12, 0.1);

    counterRoot.add(
      base,
      bumper,
      chilledBed,
      rearMarbleTop,
      sideGlassL,
      sideGlassR,
      curvedGlass,
      bLedBar,
      bLight
    );
    ctx.disposables.push(
      base.geometry,
      bumper.geometry,
      chilledBed.geometry,
      rearMarbleTop.geometry,
      sideGlassGeo,
      curvedGlassGeo,
      bLedMat,
      bLedBar.geometry
    );

    // --------------------------------------------------------------------------
    // 2A. REAR SLIDING GLASS DOORS ("PORTES COULISSANTES ARRIÈRE")
    // --------------------------------------------------------------------------
    const rearGlassMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,
    });
    ctx.disposables.push(rearGlassMat);

    const doorPanelGeo = new THREE.BoxGeometry(2.42, 0.42, 0.016);
    const doorGripGeo = new THREE.BoxGeometry(0.03, 0.16, 0.032);
    ctx.disposables.push(doorPanelGeo, doorGripGeo);

    const rearDoorL = new THREE.Group();
    rearDoorL.position.set(-1.24, 1.0, -0.42);
    const rdlPane = new THREE.Mesh(doorPanelGeo, rearGlassMat);
    const rdlGrip = new THREE.Mesh(doorGripGeo, mats.chrome);
    rdlGrip.position.set(-1.05, 0, -0.018);
    rearDoorL.add(rdlPane, rdlGrip);

    const rearDoorR = new THREE.Group();
    rearDoorR.position.set(1.24, 1.0, -0.45);
    const rdrPane = new THREE.Mesh(doorPanelGeo, rearGlassMat);
    const rdrGrip = new THREE.Mesh(doorGripGeo, mats.chrome);
    rdrGrip.position.set(1.05, 0, -0.018);
    rearDoorR.add(rdrPane, rdrGrip);

    counterRoot.add(rearDoorL, rearDoorR);

    let rearDoorLOpen = false;
    let rearDoorROpen = false;

    addHitbox(rearDoorL, {
      id: 'butcher_rear_door_left',
      size: [2.35, 0.42, 0.12],
      pos: [0, 0, -0.02],
      title: 'Vitre Coulissante Arrière (Gauche)',
      subtitle: 'Ouvrez pour garnir Faux-Filet, Rôti de Porc et Jambon Blanc',
      verb: () => (rearDoorLOpen ? 'FERMER VITRE ARRIÈRE GAUCHE' : 'OUVRIR VITRE ARRIÈRE GAUCHE'),
      onInteract: () => {
        if (!acquireLock()) return;
        rearDoorLOpen = !rearDoorLOpen;
        soundSynth.playPlasticSlide();
      },
    });

    addHitbox(rearDoorR, {
      id: 'butcher_rear_door_right',
      size: [2.35, 0.42, 0.12],
      pos: [0, 0, -0.02],
      title: 'Vitre Coulissante Arrière (Droite)',
      subtitle: 'Ouvrez pour garnir Steaks Hachés et Merguez & Saucisses',
      verb: () => (rearDoorROpen ? 'FERMER VITRE ARRIÈRE DROITE' : 'OUVRIR VITRE ARRIÈRE DROITE'),
      onInteract: () => {
        if (!acquireLock()) return;
        rearDoorROpen = !rearDoorROpen;
        soundSynth.playPlasticSlide();
      },
    });

    ctx.updaters.push({
      update: (dt) => {
        rearDoorL.position.x = THREE.MathUtils.damp(
          rearDoorL.position.x,
          rearDoorLOpen ? 0.35 : -1.24,
          10,
          dt
        );
        rearDoorR.position.x = THREE.MathUtils.damp(
          rearDoorR.position.x,
          rearDoorROpen ? -0.35 : 1.24,
          10,
          dt
        );
      },
    });

    // --------------------------------------------------------------------------
    // 2B. 10 MULTI-DEPTH REFRIGERATED DISPLAY COLUMNS (3 SLOTS DEEP + FACING!)
    //     Spanning local X = -2.22..+2.22 on the chilled stainless deck (Y = 0.81)
    // --------------------------------------------------------------------------
    const chilledCols: Array<{
      id: string;
      x: number;
      tierName: string;
      colWidth: number;
      variants: Array<{
        kind: HeldItemHudInfo['kind'];
        ean: string;
        label: string;
        sublabel: string;
        buildMesh: () => THREE.Object3D;
      }>;
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      // Faux-Filet de Bœuf (30140401)
      {
        id: 'butcher_col_beef_0',
        x: -2.14,
        tierName: 'Vitrine Faux-Filet de Bœuf',
        colWidth: 0.42,
        variants: [
          {
            kind: 'beef_platter',
            ean: '30140401',
            label: 'Faux-Filet de Bœuf (Plateau Inox)',
            sublabel: 'Rayon Boucherie · 68,00 ₣/kg',
            buildMesh: buildBeefPlatterMesh,
          },
          {
            kind: 'butcher_wrapped_beef',
            ean: '30140401',
            label: 'Faux-Filet de Bœuf (Paquet Pesé)',
            sublabel: 'Papier Boucher Étiqueté · 30,60 ₣',
            buildMesh: () => buildWrappedButcherParcelMesh(beefStickerMat),
          },
        ],
        init: [null, null, null],
      },
      {
        id: 'butcher_col_beef_1',
        x: -1.66,
        tierName: 'Vitrine Faux-Filet de Bœuf',
        colWidth: 0.42,
        variants: [
          {
            kind: 'beef_platter',
            ean: '30140401',
            label: 'Faux-Filet de Bœuf (Plateau Inox)',
            sublabel: 'Rayon Boucherie · 68,00 ₣/kg',
            buildMesh: buildBeefPlatterMesh,
          },
          {
            kind: 'butcher_wrapped_beef',
            ean: '30140401',
            label: 'Faux-Filet de Bœuf (Paquet Pesé)',
            sublabel: 'Papier Boucher Étiqueté · 30,60 ₣',
            buildMesh: () => buildWrappedButcherParcelMesh(beefStickerMat),
          },
        ],
        init: [null, null, null],
      },
      // Rôti de Porc Filet (30140402)
      {
        id: 'butcher_col_pork_0',
        x: -1.16,
        tierName: 'Vitrine Rôti de Porc Filet',
        colWidth: 0.42,
        variants: [
          {
            kind: 'pork_platter',
            ean: '30140402',
            label: 'Rôti de Porc Filet (Plateau Inox)',
            sublabel: 'Rayon Boucherie · 42,00 ₣/kg',
            buildMesh: buildPorkPlatterMesh,
          },
          {
            kind: 'butcher_wrapped_pork',
            ean: '30140402',
            label: 'Rôti de Porc Filet (Paquet Pesé)',
            sublabel: 'Papier Boucher Étiqueté · 26,04 ₣',
            buildMesh: () => buildWrappedButcherParcelMesh(porkStickerMat),
          },
        ],
        init: [null, null, null],
      },
      {
        id: 'butcher_col_pork_1',
        x: -0.68,
        tierName: 'Vitrine Rôti de Porc Filet',
        colWidth: 0.42,
        variants: [
          {
            kind: 'pork_platter',
            ean: '30140402',
            label: 'Rôti de Porc Filet (Plateau Inox)',
            sublabel: 'Rayon Boucherie · 42,00 ₣/kg',
            buildMesh: buildPorkPlatterMesh,
          },
          {
            kind: 'butcher_wrapped_pork',
            ean: '30140402',
            label: 'Rôti de Porc Filet (Paquet Pesé)',
            sublabel: 'Papier Boucher Étiqueté · 26,04 ₣',
            buildMesh: () => buildWrappedButcherParcelMesh(porkStickerMat),
          },
        ],
        init: [null, null, null], // Empty column ready for fresh cut platters!
      },
      // Jambon Blanc Supérieur (30140403)
      {
        id: 'butcher_col_ham_0',
        x: -0.2,
        tierName: 'Vitrine Jambon Blanc Supérieur',
        colWidth: 0.4,
        variants: [
          {
            kind: 'ham_sliced_pack',
            ean: '30140403',
            label: 'Jambon Blanc Supérieur (Tranché)',
            sublabel: 'Charcuterie Coupe · 46,00 ₣/kg',
            buildMesh: buildHamSlicedMesh,
          },
          {
            kind: 'butcher_wrapped_ham',
            ean: '30140403',
            label: 'Jambon Blanc Supérieur (Paquet Pesé)',
            sublabel: 'Papier Boucher Étiqueté · 12,88 ₣',
            buildMesh: () => buildWrappedButcherParcelMesh(hamStickerMat),
          },
        ],
        init: [null, null, null],
      },
      {
        id: 'butcher_col_ham_1',
        x: 0.26,
        tierName: 'Vitrine Jambon Blanc Supérieur',
        colWidth: 0.4,
        variants: [
          {
            kind: 'ham_sliced_pack',
            ean: '30140403',
            label: 'Jambon Blanc Supérieur (Tranché)',
            sublabel: 'Charcuterie Coupe · 46,00 ₣/kg',
            buildMesh: buildHamSlicedMesh,
          },
          {
            kind: 'butcher_wrapped_ham',
            ean: '30140403',
            label: 'Jambon Blanc Supérieur (Paquet Pesé)',
            sublabel: 'Papier Boucher Étiqueté · 12,88 ₣',
            buildMesh: () => buildWrappedButcherParcelMesh(hamStickerMat),
          },
        ],
        init: [null, null, null],
      },
      // Barquettes Steaks Hachés x6 (30140404)
      {
        id: 'butcher_col_steaks_0',
        x: 0.74,
        tierName: 'Vitrine Barquettes Steaks Hachés ×6',
        colWidth: 0.4,
        variants: [
          {
            kind: 'butcher_tray_steaks',
            ean: '30140404',
            label: 'Barquettes Steaks Hachés ×6',
            sublabel: 'Rayon Boucherie · 29,50 ₣',
            buildMesh: buildSteaksHachesTrayMesh,
          },
        ],
        init: [null, null, null],
      },
      {
        id: 'butcher_col_steaks_1',
        x: 1.2,
        tierName: 'Vitrine Barquettes Steaks Hachés ×6',
        colWidth: 0.4,
        variants: [
          {
            kind: 'butcher_tray_steaks',
            ean: '30140404',
            label: 'Barquettes Steaks Hachés ×6',
            sublabel: 'Rayon Boucherie · 29,50 ₣',
            buildMesh: buildSteaksHachesTrayMesh,
          },
        ],
        init: [null, null, null],
      },
      // Barquettes Merguez & Saucisses x6 (30140405)
      {
        id: 'butcher_col_merguez_0',
        x: 1.68,
        tierName: 'Vitrine Barquettes Merguez & Saucisses ×6',
        colWidth: 0.4,
        variants: [
          {
            kind: 'butcher_tray_merguez',
            ean: '30140405',
            label: 'Barquettes Merguez & Saucisses ×6',
            sublabel: 'Rayon Boucherie · 26,00 ₣',
            buildMesh: buildMerguezTrayMesh,
          },
        ],
        init: [null, null, null],
      },
      {
        id: 'butcher_col_merguez_1',
        x: 2.14,
        tierName: 'Vitrine Barquettes Merguez & Saucisses ×6',
        colWidth: 0.4,
        variants: [
          {
            kind: 'butcher_tray_merguez',
            ean: '30140405',
            label: 'Barquettes Merguez & Saucisses ×6',
            sublabel: 'Rayon Boucherie · 26,00 ₣',
            buildMesh: buildMerguezTrayMesh,
          },
        ],
        init: [null, null, null], // Empty for ordered carton stocking!
      },
    ];

    chilledCols.forEach((col) => {
      buildMultiDepthColumn(ctx, counterRoot, shelfHelper, tools, {
        id: col.id,
        tierName: col.tierName,
        x: col.x,
        y: 0.812,
        shelfFrontZ: 0.36,
        shelfBackZ: -0.32,
        colWidth: col.colWidth,
        itemHeight: 0.16,
        itemDepth: 0.19,
        depthCount: 3,
        variants: col.variants,
        initialSlots: col.init,
      });
    });

    // --------------------------------------------------------------------------
    // 2C. 4 BARE 120CM FRONT PRICE-RAIL SEGMENTS AT START (ZERO PRE-INSTALLED RAILS)
    //     Mounted cleanly along the front customer-facing lip (Y = 0.755, Z = +0.45)
    //     Unobstructed by glass, verified +0.008m / +0.011m Z-offset & renderOrder!
    // --------------------------------------------------------------------------
    const bareMetalLipMat = new THREE.MeshStandardMaterial({
      color: 0xdbe2ea,
      roughness: 0.42,
      metalness: 0.48,
    });
    const railBackMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
    const railLipMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.35,
      metalness: 0.25,
    });
    ctx.disposables.push(bareMetalLipMat, railBackMat, railLipMat);

    const railY = 0.755;
    const frontEdgeZ = 0.452;
    const fullBareLip = new THREE.Mesh(new THREE.BoxGeometry(len - 0.06, 0.038, 0.005), bareMetalLipMat);
    fullBareLip.position.set(0, railY, frontEdgeZ);
    counterRoot.add(fullBareLip);
    ctx.disposables.push(fullBareLip.geometry);

    const segLen = 1.22;
    const segBackGeo = new THREE.BoxGeometry(segLen, 0.048, 0.004);
    const segLipGeo = new THREE.BoxGeometry(segLen, 0.0045, 0.012);
    const segClearGeo = new THREE.PlaneGeometry(segLen, 0.044);
    const segPreviewGeo = new THREE.BoxGeometry(segLen, 0.052, 0.016);
    ctx.disposables.push(segBackGeo, segLipGeo, segClearGeo, segPreviewGeo);

    interface ButcherRailSeg {
      installed: boolean;
      railGroup: THREE.Group;
      previewMesh: THREE.Mesh;
      previewMat: THREE.MeshStandardMaterial;
      hoverTimer: number;
      snapAnim: number;
    }
    interface ButcherRailSlot {
      category: string;
      priceText: string;
      ean: string;
      verified: boolean;
      expectedEans: string[];
      hasLabel: boolean;
      mesh: THREE.Mesh;
      canvas: HTMLCanvasElement;
      tex: THREE.CanvasTexture;
      slideAnim: number;
      baseX: number;
    }

    const railSegs: ButcherRailSeg[] = [];
    const railSlots: ButcherRailSlot[] = [];

    const segConfigs: Array<{
      key: string;
      label: string;
      centerX: number;
      slots: Array<{ x: number; eans: string[] }>;
    }> = [
      {
        key: 'seg0',
        label: 'Gauche (Bœuf)',
        centerX: -1.86,
        slots: [
          { x: -2.2, eans: ['30140401'] },
          { x: -1.86, eans: ['30140401'] },
          { x: -1.52, eans: ['30140401'] },
        ],
      },
      {
        key: 'seg1',
        label: 'Centre-Gauche (Porc)',
        centerX: -0.62,
        slots: [
          { x: -0.96, eans: ['30140402'] },
          { x: -0.62, eans: ['30140402'] },
          { x: -0.28, eans: ['30140402', '30140403'] },
        ],
      },
      {
        key: 'seg2',
        label: 'Centre-Droite (Jambon / Steaks)',
        centerX: 0.62,
        slots: [
          { x: 0.28, eans: ['30140403'] },
          { x: 0.62, eans: ['30140404'] },
          { x: 0.96, eans: ['30140404'] },
        ],
      },
      {
        key: 'seg3',
        label: 'Droite (Merguez & Saucisses)',
        centerX: 1.86,
        slots: [
          { x: 1.52, eans: ['30140405'] },
          { x: 1.86, eans: ['30140405'] },
          { x: 2.2, eans: ['30140405'] },
        ],
      },
    ];

    segConfigs.forEach((sc) => {
      const railGroup = new THREE.Group();
      railGroup.position.set(sc.centerX, railY, frontEdgeZ);
      railGroup.visible = false;
      counterRoot.add(railGroup);

      const rb = new THREE.Mesh(segBackGeo, railBackMat);
      rb.position.set(0, 0, 0.004);
      const rt = new THREE.Mesh(segLipGeo, railLipMat);
      rt.position.set(0, 0.023, 0.007);
      const rbot = new THREE.Mesh(segLipGeo, railLipMat);
      rbot.position.set(0, -0.023, 0.007);
      const rc = new THREE.Mesh(segClearGeo, clearPlasticRailMat);
      rc.position.set(0, 0, 0.011);
      rc.renderOrder = 4;
      railGroup.add(rb, rt, rbot, rc);

      const previewMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.0,
        roughness: 0.25,
        depthWrite: false,
      });
      ctx.disposables.push(previewMat);
      const previewMesh = new THREE.Mesh(segPreviewGeo, previewMat);
      previewMesh.position.set(sc.centerX, railY, frontEdgeZ + 0.008);
      previewMesh.visible = false;
      counterRoot.add(previewMesh);

      const segState: ButcherRailSeg = {
        installed: false,
        railGroup,
        previewMesh,
        previewMat,
        hoverTimer: 0,
        snapAnim: 0,
      };
      railSegs.push(segState);

      addHitbox(counterRoot, {
        id: `butcher_bare_edge_${sc.key}`,
        size: [segLen, 0.14, 0.12],
        pos: [sc.centerX, railY, frontEdgeZ + 0.025],
        title: `Bord Métal Nu — Vitrine Boucherie (${sc.label})`,
        subtitle: 'Aucune réglette plastique installée — Étiquetage verrouillé',
        isVisible: () => !segState.installed,
        onHoverUv: () => {
          segState.hoverTimer = 0.16;
        },
        verb: () => {
          const held = tools.getHeldItem();
          if (tools.getActiveTool() === 'hands' && held?.kind === 'plastic_price_rail') {
            return 'CLIPSER LA RÉGLETTE SUR LA VITRINE';
          }
          if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
            return "RÉGLETTE REQUISE D'ABORD";
          }
          return 'BORD MÉTAL NU (CLIPSER RÉGLETTE)';
        },
        onInteract: () => {
          if (!acquireLock()) return;
          const held = tools.getHeldItem();
          if (tools.getActiveTool() === 'hands' && held?.kind === 'plastic_price_rail') {
            segState.installed = true;
            segState.railGroup.visible = true;
            segState.previewMesh.visible = false;
            segState.snapAnim = 1.0;
            segState.railGroup.position.z = frontEdgeZ + 0.045;
            tools.consumeHeldItem();
            soundSynth.playPlasticRailSnap();
          } else {
            soundSynth.playAtmPiezo('error');
          }
        },
      });

      sc.slots.forEach((sl, sIdx) => {
        const tagCv = document.createElement('canvas');
        tagCv.width = 512;
        tagCv.height = 144;
        const tagTex = new THREE.CanvasTexture(tagCv);
        tagTex.colorSpace = THREE.SRGBColorSpace;
        tagTex.anisotropy = ctx.maxAnisotropy;
        const tagMat = new THREE.MeshStandardMaterial({
          map: tagTex,
          emissive: 0xffffff,
          emissiveMap: tagTex,
          emissiveIntensity: 0.14,
          roughness: 0.55,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.036), tagMat);
        tagMesh.position.set(sl.x, railY, frontEdgeZ + 0.008);
        tagMesh.renderOrder = 2;
        tagMesh.visible = false;
        counterRoot.add(tagMesh);
        ctx.disposables.push(tagTex, tagMat, tagMesh.geometry);

        const slotState: ButcherRailSlot = {
          category: '',
          priceText: '',
          ean: sl.eans[0],
          verified: false,
          expectedEans: sl.eans,
          hasLabel: false,
          mesh: tagMesh,
          canvas: tagCv,
          tex: tagTex,
          slideAnim: 0,
          baseX: sl.x,
        };
        railSlots.push(slotState);

        addHitbox(counterRoot, {
          id: `butcher_price_rail_${sc.key}_${sIdx}`,
          size: [0.3, 0.11, 0.09],
          pos: [sl.x, railY, frontEdgeZ + 0.02],
          title: `Réglette Vitrine Boucherie — ${sc.label} #${sIdx + 1}`,
          subtitle: 'Porte-étiquettes transparent clipsé (tarifs ₣/kg et ₣)',
          isVisible: () => segState.installed,
          verb: () => {
            const held = tools.getHeldItem();
            if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
              return "GLISSER L'ÉTIQUETTE DANS LA RÉGLETTE";
            }
            if (slotState.hasLabel) {
              return slotState.verified
                ? `ÉTIQUETTE CONFORME : ${slotState.priceText}`
                : `LIRE PRIX : ${slotState.priceText}`;
            }
            return 'RÉGLETTE VIDE (IMPRIMER ÉTIQUETTE)';
          },
          dynamicSubtitle: () => {
            if (slotState.hasLabel) {
              return slotState.verified
                ? `✓ ÉTIQUETTE CONFORME : ${slotState.priceText} · ${slotState.category}`
                : `${slotState.category} — ${slotState.priceText} (EAN ${slotState.ean})`;
            }
            const refProd = getProductByEan(slotState.expectedEans[0]);
            return refProd
              ? `Prévu : ${refProd.name} (${refProd.priceText}) — Scannez puis imprimez`
              : "Imprimez un tarif sur l'Étiqueteuse 3D 1990";
          },
          onInteract: () => {
            if (!acquireLock()) return;
            if (!segState.installed) {
              soundSynth.playAtmPiezo('error');
              return;
            }
            const held = tools.getHeldItem();
            if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
              const prodLabel = held.productName ?? held.category ?? 'BOUCHERIE';
              const price = held.priceText ?? '68,00 ₣/kg';
              const ean = held.ean ?? slotState.expectedEans[0];
              const printedCents = parseFrancPriceToCents(price);
              const matchesExpected = slotState.expectedEans.some((exp) => {
                const p = getProductByEan(exp);
                return p && printedCents !== null && p.priceCents === printedCents;
              });
              const scannedProd = getProductByEan(ean);
              const matchesOwn =
                Boolean(scannedProd) &&
                printedCents !== null &&
                scannedProd!.priceCents === printedCents;
              const isVerified = matchesExpected || matchesOwn;

              slotState.category = prodLabel;
              slotState.priceText = price;
              slotState.ean = ean;
              slotState.verified = isVerified;
              slotState.hasLabel = true;
              drawPriceTagCanvas(slotState.canvas, prodLabel, price, ean, isVerified);
              slotState.tex.needsUpdate = true;
              slotState.mesh.visible = true;
              slotState.slideAnim = 1.0;
              tools.consumeHeldItem();
              soundSynth.playPlasticSlide();
              if (isVerified) soundSynth.playLabelMatchChime();
            } else {
              soundSynth.playUiTone(false);
            }
          },
        });
      });
    });

    ctx.updaters.push({
      update: (dt) => {
        const holdingRail =
          tools.getActiveTool() === 'hands' && tools.getHeldItem()?.kind === 'plastic_price_rail';
        for (let i = 0; i < railSegs.length; i++) {
          const seg = railSegs[i];
          if (!seg.installed) {
            if (seg.hoverTimer > 0) seg.hoverTimer = Math.max(0, seg.hoverTimer - dt);
            seg.previewMesh.visible = holdingRail;
            if (holdingRail) {
              seg.previewMat.opacity = THREE.MathUtils.damp(
                seg.previewMat.opacity,
                seg.hoverTimer > 0 ? 0.56 : 0.16,
                14,
                dt
              );
            } else {
              seg.previewMat.opacity = 0;
            }
          } else if (seg.snapAnim > 0) {
            seg.snapAnim = Math.max(0, seg.snapAnim - dt * 7.5);
            seg.railGroup.position.z =
              seg.snapAnim === 0
                ? frontEdgeZ
                : THREE.MathUtils.damp(seg.railGroup.position.z, frontEdgeZ, 18, dt);
          }
        }
        for (let i = 0; i < railSlots.length; i++) {
          const rs = railSlots[i];
          if (rs.slideAnim > 0) {
            rs.slideAnim = Math.max(0, rs.slideAnim - dt * 4.5);
            rs.mesh.position.x = rs.baseX - rs.slideAnim * 0.11;
          }
        }
      },
    });

    // --------------------------------------------------------------------------
    // 2D. 100% DIEGETIC 3D ELECTRONIC WEIGHING SCALE & WEIGHT-PRICE PRINTER
    //     ("BALANCE ÉLECTRONIQUE 1990") mounted on rear marble ledge (X = 0, Y = 1.27, Z = -0.32)
    //     Rotated Math.PI so local +Z faces the butcher in the walk-behind corridor (-Z world)!
    // --------------------------------------------------------------------------
    const scaleRoot = new THREE.Group();
    scaleRoot.position.set(0.0, 1.27, -0.32);
    scaleRoot.rotation.y = Math.PI; // Faces the butcher behind the counter!
    counterRoot.add(scaleRoot);

    const scaleBeigeMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.52 });
    const scaleDarkMat = new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.72 });
    ctx.disposables.push(scaleBeigeMat, scaleDarkMat);

    // Main commercial scale chassis + angled tactile keypad deck + side thermal printer body
    const sBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.085, 0.34), scaleBeigeMat);
    sBase.position.set(0, 0.042, 0);
    sBase.castShadow = true;

    const sConsole = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.14), scaleBeigeMat);
    sConsole.position.set(0, 0.068, 0.13);
    sConsole.rotation.x = 0.42;

    const sPanBase = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.018, 0.24), brushedInoxMat);
    sPanBase.position.set(-0.04, 0.098, -0.04);
    const sPanRim = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.012, 0.012), brushedInoxMat);
    sPanRim.position.set(-0.04, 0.106, -0.155);

    // Side thermal weight-price ticket printer housing + dark paper slot
    const sPrinter = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.22), scaleDarkMat);
    sPrinter.position.set(0.24, 0.052, -0.02);
    const sPrinterSlot = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.014, 0.11),
      new THREE.MeshBasicMaterial({ color: 0x05070a })
    );
    sPrinterSlot.position.set(0.296, 0.064, -0.02);

    // Tall Chrome Pole + Dual-Sided VFD Segment Display Head (readable by butcher AND customer!)
    const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.38, 10), mats.chrome);
    sPole.position.set(-0.18, 0.26, -0.12);
    const sHeadBox = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.145, 0.055), scaleDarkMat);
    sHeadBox.position.set(0.0, 0.44, -0.12);

    const vfdCanvas = document.createElement('canvas');
    vfdCanvas.width = 512;
    vfdCanvas.height = 192;
    const vfdTex = new THREE.CanvasTexture(vfdCanvas);
    vfdTex.colorSpace = THREE.SRGBColorSpace;
    vfdTex.anisotropy = ctx.maxAnisotropy;
    const vfdMat = new THREE.MeshStandardMaterial({
      map: vfdTex,
      emissiveMap: vfdTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.22,
    });
    const vfdFront = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.122), vfdMat);
    vfdFront.position.set(0.0, 0.44, -0.091); // Faces butcher (+Z local)
    const vfdBack = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.122), vfdMat);
    vfdBack.rotation.y = Math.PI;
    vfdBack.position.set(0.0, 0.44, -0.149); // Faces customer (-Z local = +Z world)

    scaleRoot.add(
      sBase,
      sConsole,
      sPanBase,
      sPanRim,
      sPrinter,
      sPrinterSlot,
      sPole,
      sHeadBox,
      vfdFront,
      vfdBack
    );
    ctx.disposables.push(
      sBase.geometry,
      sConsole.geometry,
      sPanBase.geometry,
      sPanRim.geometry,
      sPrinter.geometry,
      sPrinterSlot.geometry,
      sPrinterSlot.material as THREE.Material,
      sPole.geometry,
      sHeadBox.geometry,
      vfdTex,
      vfdMat,
      vfdFront.geometry,
      vfdBack.geometry
    );

    // Visual items resting on the Stainless Weighing Pan
    const panBeefMesh = buildBeefPlatterMesh();
    panBeefMesh.position.set(-0.04, 0.108, -0.04);
    panBeefMesh.scale.setScalar(0.84);
    panBeefMesh.visible = false;

    const panPorkMesh = buildPorkPlatterMesh();
    panPorkMesh.position.set(-0.04, 0.108, -0.04);
    panPorkMesh.scale.setScalar(0.84);
    panPorkMesh.visible = false;

    const panHamMesh = buildHamSlicedMesh();
    panHamMesh.position.set(-0.04, 0.108, -0.04);
    panHamMesh.scale.setScalar(0.95);
    panHamMesh.visible = false;

    // Wrapped white/pink French Butcher Paper Parcel on the pan + Dynamic Applied Sticker!
    const panWrappedGroup = new THREE.Group();
    panWrappedGroup.position.set(-0.04, 0.108, -0.04);
    panWrappedGroup.visible = false;
    const pwBox = new THREE.Mesh(wrapParcelGeo, butcherWrapPaperMat);
    pwBox.position.y = 0.036;
    const pwStripe = new THREE.Mesh(wrapBandGeo, butcherWrapStripeMat);
    pwStripe.position.y = 0.036;

    // Dynamic canvas shared by extruded ticket AND stuck sticker on top of butcher paper parcel!
    const ticketCv = document.createElement('canvas');
    ticketCv.width = 256;
    ticketCv.height = 176;
    const ticketTex = new THREE.CanvasTexture(ticketCv);
    ticketTex.colorSpace = THREE.SRGBColorSpace;
    ticketTex.anisotropy = ctx.maxAnisotropy;
    const ticketMat = new THREE.MeshStandardMaterial({
      map: ticketTex,
      emissiveMap: ticketTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.16,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const stuckTicketMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.075), ticketMat);
    stuckTicketMesh.rotation.x = -Math.PI / 2;
    stuckTicketMesh.position.set(0, 0.073, 0);
    stuckTicketMesh.visible = false;
    panWrappedGroup.add(pwBox, pwStripe, stuckTicketMesh);

    // 3D Extruded Weight-Price Barcode Label emerging from side printer slot!
    const extrudedTicketMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.095, 0.068), ticketMat);
    extrudedTicketMesh.rotation.x = -Math.PI / 2;
    extrudedTicketMesh.position.set(0.32, 0.066, -0.02);
    extrudedTicketMesh.visible = false;

    scaleRoot.add(panBeefMesh, panPorkMesh, panHamMesh, panWrappedGroup, extrudedTicketMesh);
    ctx.disposables.push(
      ticketTex,
      ticketMat,
      stuckTicketMesh.geometry,
      extrudedTicketMesh.geometry
    );

    // Scale Electronic State Machine
    type PanItemType = 'beef' | 'pork' | 'ham' | null;
    type PanStage = 'empty' | 'unwrapped' | 'ticket_extruded' | 'labeled_ready';
    let panType: PanItemType = null;
    let panStage: PanStage = 'empty';
    let rawWeightGrams = 0;
    let tareGrams = 0;
    let selectedPluCode = '101';
    let typedDigits = '';
    let scaleStatus = 'POSEZ VIANDE · CHOISISSEZ PLU';
    let ticketExtrudeAnim = 0;

    const getNetWeightKg = (): number => Math.max(0, (rawWeightGrams - tareGrams) / 1000);

    const drawTicketCanvas = (plu: ScalePluDef, weightKg: number, totalCents: number) => {
      const c = ticketCv.getContext('2d')!;
      c.fillStyle = '#fffef8';
      c.fillRect(0, 0, 256, 176);
      c.fillStyle = '#7f1d1d';
      c.fillRect(0, 0, 256, 30);
      c.fillStyle = '#ffffff';
      c.font = '800 15px "Plus Jakarta Sans", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(`CONTACT EXPRESS · PLU ${plu.plu}`, 128, 15);

      c.fillStyle = '#0f172a';
      c.font = '800 16px "JetBrains Mono", monospace';
      c.fillText(plu.shortName, 128, 48);

      c.font = '700 13px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText(`POIDS: ${weightKg.toFixed(3)} kg`, 14, 70);
      c.textAlign = 'right';
      c.fillText(plu.pricePerKgText, 242, 70);

      c.fillStyle = '#b91c1c';
      c.font = '900 24px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(`TOTAL : ${formatFrancsFromCents(totalCents)}`, 128, 98);

      drawEanBarcode(c, plu.ean, 28, 114, 200, 56, {
        showDigits: true,
        bgColor: '#fffef8',
        barColor: '#0f172a',
      });
      ticketTex.needsUpdate = true;
    };

    const redrawVfd = () => {
      const c = vfdCanvas.getContext('2d')!;
      c.fillStyle = '#09120e';
      c.fillRect(0, 0, 512, 192);
      c.strokeStyle = '#334155';
      c.lineWidth = 6;
      c.strokeRect(4, 4, 504, 184);

      const plu = SCALE_PLUS[selectedPluCode] ?? SCALE_PLUS['101'];
      const weightKg = getNetWeightKg();
      const totalCents = Math.round(weightKg * plu.pricePerKgCents);

      // Top VFD labels (1990 green/amber vacuum fluorescent segments)
      c.fillStyle = '#86efac';
      c.font = '800 15px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText('POIDS (kg)', 22, 26);
      c.fillText('PRIX / KG', 194, 26);
      c.fillStyle = '#fbbf24';
      c.fillText('TOTAL À PAYER', 348, 26);

      // Crisp bright 7-segment style numeric row
      c.fillStyle = '#4ade80';
      c.font = '900 36px "JetBrains Mono", monospace';
      c.fillText(weightKg.toFixed(3), 20, 68);
      c.fillText(formatFrancsFromCents(plu.pricePerKgCents).replace(' ₣', ''), 190, 68);
      c.fillStyle = '#f59e0b';
      c.fillText(formatFrancsFromCents(totalCents), 344, 68);

      // Middle PLU info line
      c.fillStyle = '#13241c';
      c.fillRect(16, 102, 480, 34);
      c.fillStyle = '#bbf7d0';
      c.font = '800 18px "JetBrains Mono", monospace';
      const typedPreview = typedDigits ? `SAISIE: ${typedDigits}_` : `PLU ${plu.plu} · ${plu.shortName}`;
      c.fillText(typedPreview, 24, 119);
      c.textAlign = 'right';
      c.fillText(tareGrams > 0 ? `TARE:${(tareGrams / 1000).toFixed(3)}` : 'TARE:0.000', 488, 119);

      // Bottom operator guidance bar
      c.fillStyle = '#fbbf24';
      c.font = '800 16px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText(scaleStatus.slice(0, 42), 20, 162);

      vfdTex.needsUpdate = true;
    };
    redrawVfd();

    // 16 Individual Clickable 3D Tactile Keys on the Angled Scale Console
    interface ScaleKeyNode {
      code: string;
      mesh: THREE.Mesh;
      restZ: number;
      pressAnim: number;
    }
    const scaleKeyNodes: ScaleKeyNode[] = [];
    const keypadGroup = new THREE.Group();
    keypadGroup.position.set(0, 0.088, 0.13);
    keypadGroup.rotation.x = -Math.PI / 2 + 0.42;
    scaleRoot.add(keypadGroup);

    const scaleKeyDefs: Array<{
      code: string;
      legend: string;
      title: string;
      bg: string;
      fg: string;
      col: number;
      row: number;
    }> = [
      // Top PLU Row (row 0)
      { code: 'PLU101', legend: 'PLU101', title: 'PLU 101 BŒUF (68,00 ₣/kg)', bg: '#7f1d1d', fg: '#fef2f2', col: 0, row: 0 },
      { code: 'PLU102', legend: 'PLU102', title: 'PLU 102 PORC (42,00 ₣/kg)', bg: '#9a3412', fg: '#fff7ed', col: 1, row: 0 },
      { code: 'PLU103', legend: 'PLU103', title: 'PLU 103 JAMBON (46,00 ₣/kg)', bg: '#9d174d', fg: '#fdf2f8', col: 2, row: 0 },
      { code: 'TARE', legend: 'TARE', title: 'TARE (Remise à zéro)', bg: '#1d4ed8', fg: '#eff6ff', col: 3, row: 0 },
      // Numeric 7-8-9 + EFF (row 1)
      { code: '7', legend: '7', title: 'Chiffre 7', bg: '#334155', fg: '#f8fafc', col: 0, row: 1 },
      { code: '8', legend: '8', title: 'Chiffre 8', bg: '#334155', fg: '#f8fafc', col: 1, row: 1 },
      { code: '9', legend: '9', title: 'Chiffre 9', bg: '#334155', fg: '#f8fafc', col: 2, row: 1 },
      { code: 'EFF', legend: 'EFF.', title: 'Effacer saisie', bg: '#b91c1c', fg: '#fef2f2', col: 3, row: 1 },
      // Numeric 4-5-6 + 0 (row 2)
      { code: '4', legend: '4', title: 'Chiffre 4', bg: '#334155', fg: '#f8fafc', col: 0, row: 2 },
      { code: '5', legend: '5', title: 'Chiffre 5', bg: '#334155', fg: '#f8fafc', col: 1, row: 2 },
      { code: '6', legend: '6', title: 'Chiffre 6', bg: '#334155', fg: '#f8fafc', col: 2, row: 2 },
      { code: '0', legend: '0', title: 'Chiffre 0', bg: '#334155', fg: '#f8fafc', col: 3, row: 2 },
      // Numeric 1-2-3 + IMPRIMER TICKET (row 3)
      { code: '1', legend: '1', title: 'Chiffre 1', bg: '#334155', fg: '#f8fafc', col: 0, row: 3 },
      { code: '2', legend: '2', title: 'Chiffre 2', bg: '#334155', fg: '#f8fafc', col: 1, row: 3 },
      { code: '3', legend: '3', title: 'Chiffre 3', bg: '#334155', fg: '#f8fafc', col: 2, row: 3 },
      { code: 'PRINT', legend: 'IMPR.', title: 'IMPRIMER TICKET POIDS-PRIX', bg: '#15803d', fg: '#f0fdf4', col: 3, row: 3 },
    ];

    const skGeo = new THREE.BoxGeometry(0.088, 0.025, 0.012);
    const skSideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
    ctx.disposables.push(skGeo, skSideMat);

    const handleScaleKeyPress = (code: string) => {
      if (code === 'PLU101') {
        selectedPluCode = '101';
        typedDigits = '';
        scaleStatus = 'PLU 101 BŒUF (68,00 ₣/kg)';
        soundSynth.playAtmPiezo('bezel');
      } else if (code === 'PLU102') {
        selectedPluCode = '102';
        typedDigits = '';
        scaleStatus = 'PLU 102 PORC (42,00 ₣/kg)';
        soundSynth.playAtmPiezo('bezel');
      } else if (code === 'PLU103') {
        selectedPluCode = '103';
        typedDigits = '';
        scaleStatus = 'PLU 103 JAMBON (46,00 ₣/kg)';
        soundSynth.playAtmPiezo('bezel');
      } else if (code === 'TARE') {
        tareGrams = tareGrams > 0 ? 0 : Math.min(rawWeightGrams, 20);
        scaleStatus = tareGrams > 0 ? 'TARE ACTIVÉE (-20g)' : 'TARE ANNULÉE';
        soundSynth.playAtmPiezo('bezel');
      } else if (code === 'EFF') {
        typedDigits = '';
        scaleStatus = 'SAISIE EFFACÉE';
        soundSynth.playAtmPiezo('correct');
      } else if (code === 'PRINT') {
        if (panStage !== 'unwrapped' || !panType) {
          scaleStatus = 'POSEZ UNE VIANDE SUR LE PLATEAU';
          soundSynth.playAtmPiezo('error');
        } else {
          const plu = SCALE_PLUS[selectedPluCode] ?? SCALE_PLUS['101'];
          const wKg = getNetWeightKg();
          const tot = Math.round(wKg * plu.pricePerKgCents);
          drawTicketCanvas(plu, wKg, tot);
          panStage = 'ticket_extruded';
          ticketExtrudeAnim = 0;
          panBeefMesh.visible = false;
          panPorkMesh.visible = false;
          panHamMesh.visible = false;
          panWrappedGroup.visible = true;
          stuckTicketMesh.visible = false;
          extrudedTicketMesh.visible = true;
          scaleStatus = `TICKET IMPRIMÉ (${formatFrancsFromCents(tot)}) — COLLER`;
          soundSynth.playLabelPrint();
        }
      } else if (/^\d$/.test(code)) {
        typedDigits = (typedDigits + code).slice(0, 3);
        soundSynth.playAtmPiezo('digit');
        if (SCALE_PLUS[typedDigits]) {
          selectedPluCode = typedDigits;
          scaleStatus = `PLU ${typedDigits} : ${SCALE_PLUS[typedDigits].shortName}`;
          typedDigits = '';
          soundSynth.playAtmPiezo('confirm');
        } else {
          scaleStatus = `CODE PLU : ${typedDigits} (101/102/103)`;
        }
      }
      redrawVfd();
    };

    scaleKeyDefs.forEach((kd) => {
      const kx = -0.155 + kd.col * 0.103;
      const ky = 0.044 - kd.row * 0.03;
      const kTex = makeScaleKeyTexture(kd.legend, kd.bg, kd.fg, ctx.maxAnisotropy);
      const kFaceMat = new THREE.MeshStandardMaterial({
        map: kTex,
        emissiveMap: kTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.14,
        roughness: 0.56,
      });
      ctx.disposables.push(kTex, kFaceMat);

      const kMesh = new THREE.Mesh(skGeo, [
        skSideMat,
        skSideMat,
        skSideMat,
        skSideMat,
        kFaceMat,
        skSideMat,
      ]);
      const restZ = 0.01;
      kMesh.position.set(kx, ky, restZ);
      keypadGroup.add(kMesh);

      const node: ScaleKeyNode = { code: kd.code, mesh: kMesh, restZ, pressAnim: 0 };
      scaleKeyNodes.push(node);

      addHitbox(keypadGroup, {
        id: `butcher_scale_key_${kd.code}`,
        size: [0.094, 0.028, 0.028],
        pos: [kx, ky, restZ + 0.008],
        title: `Balance 1990 — ${kd.title}`,
        subtitle: 'Clavier tactile 3D diégétique',
        verb: () => (kd.code === 'PRINT' ? 'IMPRIMER TICKET POIDS-PRIX' : `APPUYER [${kd.legend}]`),
        onInteract: () => {
          if (!acquireLock()) return;
          node.pressAnim = 1.0;
          handleScaleKeyPress(kd.code);
        },
      });
    });

    // Weighing Pan Hitbox ([POSER SUR LA BALANCE] / [PRENDRE PAQUET ÉTIQUETÉ])
    addHitbox(scaleRoot, {
      id: 'butcher_scale_pan',
      size: [0.36, 0.18, 0.28],
      pos: [-0.04, 0.16, -0.04],
      title: 'Plateau Inox — Balance Électronique 1990',
      subtitle: 'Pesez vos pièces/plateaux, sélectionnez le PLU et imprimez le ticket',
      dynamicSubtitle: () => {
        if (panStage === 'empty') {
          return 'Posez un plateau de bœuf/porc ou du jambon tranché pour peser et emballer';
        }
        if (panStage === 'unwrapped') {
          return `Sur plateau : ${getNetWeightKg().toFixed(3)} kg — Choisissez PLU 101/102/103 puis [IMPR.]`;
        }
        if (panStage === 'ticket_extruded') {
          return 'Emballé en papier boucher — Cliquez sur le ticket imprimé à droite pour [COLLER]';
        }
        return 'Paquet boucher emballé & étiqueté prêt — Prenez-le pour la vitrine !';
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (panStage === 'empty') {
          if (
            tools.getActiveTool() === 'hands' &&
            held &&
            (held.kind === 'beef_platter' ||
              held.kind === 'pork_platter' ||
              held.kind === 'ham_sliced_pack' ||
              held.kind === 'beef_primal' ||
              held.kind === 'pork_primal' ||
              held.kind === 'ham_block')
          ) {
            return 'POSER SUR LA BALANCE';
          }
          return 'BALANCE VIDE (POSER VIANDE / JAMBON)';
        }
        if (panStage === 'unwrapped') {
          return 'SÉLECTIONNER PLU & APPUYER [IMPR.]';
        }
        if (panStage === 'ticket_extruded') {
          return 'COLLER ÉTIQUETTE POIDS-PRIX';
        }
        if (tools.getActiveTool() === 'hands' && !held) {
          return 'PRENDRE PAQUET BOUCHER ÉTIQUETÉ';
        }
        return 'PAQUET ÉTIQUETÉ PRÊT (MAINS LIBRES)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        const held = tools.getHeldItem();

        if (panStage === 'empty' && tools.getActiveTool() === 'hands' && held) {
          if (held.kind === 'beef_platter' || held.kind === 'beef_primal') {
            panType = 'beef';
            rawWeightGrams = 450;
            selectedPluCode = '101';
            panBeefMesh.visible = true;
          } else if (held.kind === 'pork_platter' || held.kind === 'pork_primal') {
            panType = 'pork';
            rawWeightGrams = 620;
            selectedPluCode = '102';
            panPorkMesh.visible = true;
          } else if (held.kind === 'ham_sliced_pack' || held.kind === 'ham_block') {
            panType = 'ham';
            rawWeightGrams = 280;
            selectedPluCode = '103';
            panHamMesh.visible = true;
          } else {
            soundSynth.playAtmPiezo('error');
            return;
          }
          tareGrams = 0;
          panStage = 'unwrapped';
          tools.consumeHeldItem();
          scaleStatus = `PESÉ ${(rawWeightGrams / 1000).toFixed(3)} kg — APPUYEZ [IMPR.]`;
          redrawVfd();
          soundSynth.playBagThump();
          return;
        }

        // Allow applying extruded label directly from pan click too for ultra-smooth touch UX!
        if (panStage === 'ticket_extruded') {
          panStage = 'labeled_ready';
          extrudedTicketMesh.visible = false;
          stuckTicketMesh.visible = true;
          scaleStatus = 'ÉTIQUETTE COLLÉE — PRENDRE PAQUET';
          redrawVfd();
          soundSynth.playStickerPeelApply();
          return;
        }

        if (panStage === 'labeled_ready' && panType) {
          if (tools.getActiveTool() !== 'hands' || held) {
            soundSynth.playAtmPiezo('error');
            return;
          }
          const plu = SCALE_PLUS[selectedPluCode] ?? SCALE_PLUS['101'];
          const wKg = getNetWeightKg();
          const totStr = formatFrancsFromCents(Math.round(wKg * plu.pricePerKgCents));
          const pickedKind =
            panType === 'beef'
              ? 'butcher_wrapped_beef'
              : panType === 'pork'
                ? 'butcher_wrapped_pork'
                : 'butcher_wrapped_ham';
          panType = null;
          panStage = 'empty';
          rawWeightGrams = 0;
          tareGrams = 0;
          panWrappedGroup.visible = false;
          stuckTicketMesh.visible = false;
          scaleStatus = 'PRÊT — POSEZ ARTICLE SUIVANT';
          redrawVfd();
          tools.pickUpItem({
            kind: pickedKind,
            label: `${plu.labelName} · ${totStr}`,
            sublabel: `${wKg.toFixed(3)} kg · Étiquette poids-prix EAN ${plu.ean}`,
            ean: plu.ean,
          });
          soundSynth.playPlasticSlide();
          return;
        }

        soundSynth.playUiTone(false);
      },
    });

    // Side Printer Extruded 3D Weight-Price Label Hitbox ([COLLER ÉTIQUETTE POIDS-PRIX])
    addHitbox(scaleRoot, {
      id: 'butcher_scale_ticket_slot',
      size: [0.18, 0.14, 0.18],
      pos: [0.33, 0.08, -0.02],
      title: 'Étiquette Poids-Prix Imprimée (3D)',
      subtitle: 'Ticket adhésif code-barres sorti de la Balance 1990',
      isVisible: () => panStage === 'ticket_extruded',
      verb: () => 'COLLER ÉTIQUETTE POIDS-PRIX',
      onInteract: () => {
        if (!acquireLock()) return;
        if (panStage !== 'ticket_extruded') return;
        panStage = 'labeled_ready';
        extrudedTicketMesh.visible = false;
        stuckTicketMesh.visible = true;
        scaleStatus = 'ÉTIQUETTE COLLÉE — PRENDRE PAQUET';
        redrawVfd();
        soundSynth.playStickerPeelApply();
      },
    });

    ctx.updaters.push({
      update: (dt) => {
        for (let i = 0; i < scaleKeyNodes.length; i++) {
          const kn = scaleKeyNodes[i];
          if (kn.pressAnim > 0) {
            kn.pressAnim = Math.max(0, kn.pressAnim - dt * 7.5);
            kn.mesh.position.z = kn.restZ - kn.pressAnim * 0.006;
          }
        }
        if (panStage === 'ticket_extruded') {
          ticketExtrudeAnim = Math.min(1, ticketExtrudeAnim + dt * 3.5);
          extrudedTicketMesh.position.x = THREE.MathUtils.lerp(0.28, 0.345, ticketExtrudeAnim);
        }
      },
    });
  }
}
