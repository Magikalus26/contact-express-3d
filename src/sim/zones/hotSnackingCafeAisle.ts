// V19 Final Aisle Module: "Rayon 3 — Point Café & Snacking Chaud (1990)"
// Replaces the legacy Konbini sign and pre-filled warmer along the East Wall (X = 9.35, Z = -2.9).
// Features:
//  - Auto-fitted overhead header sign: "RAYON 3 — POINT CAFÉ & SNACKING CHAUD (1990)"
//  - 100% EMPTY Heated Glass Display Case ("Vitrine Chauffante +65°C") at start:
//    * Physical 3D red/amber heating rocker switch ([ALLUMER / ÉTEINDRE CHAUFFE]) + analog thermometer
//    * Smoothly sliding glass access doors ([OUVRIR / FERMER PORTES VITRINE])
//    * 2 glass shelves with bare metal front edges requiring ordered plastic price rails & scanned Franc labels
//    * 6 multi-depth back-to-front columns (Profondeur 1 [Fond] -> Profondeur 3 [Façade] + [FAIRE LE FACING])
//      for Croque-Monsieur (30141201), Panini Grillé (30141202), and Quiche Lorraine (30141203)
//  - Interactive 1990 Espresso Machine ("Machine à Café Expresso 1990") + Paper Cup Dispenser:
//    * Empty top bean hopper refilled with Café Grain Torréfié 1kg (30141204)
//    * Empty countertop cup dispenser refilled with Lot Gobelets Café x50 (30141205)
//    * Cup spout placement + physical 3D brew button ([COULER UN CAFÉ EXPRESSO — 4,00 ₣]) with steam & audio
//  - Interactive 1990 Commercial Microwave ("Four Micro-Ondes 1990"):
//    * Hinged door ([OUVRIR / FERMER MICRO-ONDES]), turntable food slot, interior warm light,
//      rotary timer dial, physical 3D start button ([CHAUFFER 30 SEC]), turntable spin & mechanical DING!

import * as THREE from 'three';
import { addBoxCollider, MaterialLibrary } from '../materials';
import { INTERACT_LAYER, ProceduralTextureBank } from '../textures';
import { HeldItemHudInfo, InteractableItem, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { soundSynth } from '../audio';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

const CAFE_COOLDOWN_MS = 320;
const ESPRESSO_BREW_SEC = 3.2;
const MICROWAVE_CYCLE_SEC = 3.2;

type MicrowavableKind =
  | 'cafe_croque_monsieur'
  | 'cafe_panini'
  | 'cafe_quiche_lorraine'
  | 'snacking_sand_jambon'
  | 'snacking_sand_poulet'
  | 'snacking_sand_thon';

function isMicrowavableKind(kind: HeldItemHudInfo['kind'] | undefined): kind is MicrowavableKind {
  return (
    kind === 'cafe_croque_monsieur' ||
    kind === 'cafe_panini' ||
    kind === 'cafe_quiche_lorraine' ||
    kind === 'snacking_sand_jambon' ||
    kind === 'snacking_sand_poulet' ||
    kind === 'snacking_sand_thon'
  );
}

function createMenuStripTexture(ctx: WorldBuildContext): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 160;
  const g = cv.getContext('2d')!;

  g.fillStyle = '#3b1518';
  g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#d97706';
  g.fillRect(0, 0, 1024, 10);
  g.fillRect(0, 150, 1024, 10);

  g.fillStyle = '#fef3c7';
  g.font = '800 30px "Plus Jakarta Sans", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('POINT CAFÉ & SNACKING CHAUD · TARIFS 1990', 512, 48);

  g.fillStyle = '#fbbf24';
  g.font = '700 24px "JetBrains Mono", monospace';
  g.fillText(
    'EXPRESSO 4,00 ₣  ·  CROQUE 12,50 ₣  ·  PANINI 15,00 ₣  ·  QUICHE 11,00 ₣',
    512,
    108
  );

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ctx.maxAnisotropy;
  ctx.disposables.push(tex);
  return tex;
}

function createGaugeDialTexture(
  ctx: WorldBuildContext,
  title: string,
  unit: string,
  accentHex: string
): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 160;
  cv.height = 160;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#f8fafc';
  g.beginPath();
  g.arc(80, 80, 76, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#334155';
  g.lineWidth = 6;
  g.stroke();

  // Arc ticks
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const r0 = i % 2 === 0 ? 52 : 58;
    const r1 = 68;
    g.strokeStyle = i >= 7 ? accentHex : '#1e293b';
    g.lineWidth = i % 2 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(80 + Math.cos(a) * r0, 80 + Math.sin(a) * r0);
    g.lineTo(80 + Math.cos(a) * r1, 80 + Math.sin(a) * r1);
    g.stroke();
  }

  g.fillStyle = '#0f172a';
  g.font = '800 18px "JetBrains Mono", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(title, 80, 56);
  g.fillStyle = accentHex;
  g.font = '800 20px "JetBrains Mono", monospace';
  g.fillText(unit, 80, 118);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ctx.maxAnisotropy;
  ctx.disposables.push(tex);
  return tex;
}

function createEspressoBadgeTexture(ctx: WorldBuildContext): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 96;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#1f2937';
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = '#d97706';
  g.lineWidth = 5;
  g.strokeRect(4, 4, 248, 88);
  g.fillStyle = '#fef3c7';
  g.font = '900 26px "Plus Jakarta Sans", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('EXPRESSO 1990', 128, 36);
  g.fillStyle = '#fbbf24';
  g.font = '800 20px "JetBrains Mono", monospace';
  g.fillText('CAFÉ GRAIN · 4,00 ₣', 128, 68);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ctx.maxAnisotropy;
  ctx.disposables.push(tex);
  return tex;
}

export function buildHotSnackingCafeAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyMat);

  let lastActionTime = 0;
  const acquireLock = (): boolean => {
    const now = performance.now();
    if (now - lastActionTime < CAFE_COOLDOWN_MS) return false;
    lastActionTime = now;
    return true;
  };

  const addActionHitbox = (
    parent: THREE.Object3D,
    opts: {
      id: string;
      size: [number, number, number];
      pos: [number, number, number];
      title: string;
      subtitle: string;
      verb: () => string;
      dynamicTitle?: () => string;
      dynamicSubtitle?: () => string;
      isVisible?: () => boolean;
      productEan?: string;
      dynamicProductEan?: () => string | null;
      onInteract: () => void;
    }
  ) => {
    const geo = new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
    ctx.disposables.push(geo);
    const mesh = new THREE.Mesh(geo, proxyMat);
    mesh.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    mesh.layers.set(INTERACT_LAYER);
    parent.add(mesh);

    const item: InteractableItem = {
      id: opts.id,
      title: opts.title,
      subtitle: opts.subtitle,
      kind: 'diegetic_action',
      state: false,
      inspectText: opts.subtitle,
      proxyMesh: mesh,
      productEan: opts.productEan,
      dynamicProductEan: opts.dynamicProductEan,
      dynamicVerb: opts.verb,
      dynamicTitle: opts.dynamicTitle,
      dynamicSubtitle: opts.dynamicSubtitle,
      isVisible: opts.isVisible,
      onInteract: opts.onInteract,
    };
    mesh.userData.interactable = item;
    ctx.interactables.push(item);
    return mesh;
  };

  // ============================================================================
  // 0. OVERHEAD AUTO-FITTED SIGNAGE ("RAYON 3 — POINT CAFÉ & SNACKING CHAUD (1990)")
  // ============================================================================
  {
    const signTex = texBank.createDepartmentSignTexture(
      'RAYON 3 — POINT CAFÉ & SNACKING CHAUD (1990)',
      'PANINIS · CROQUE-MONSIEUR · QUICHES · CAFÉ EXPRESSO',
      '#7c1d28',
      '#f59e0b'
    );
    const signFaceMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 });
    const signGeo = new THREE.BoxGeometry(2.56, 0.48, 0.06);
    ctx.disposables.push(signFaceMat, signGeo);

    const sign = new THREE.Mesh(signGeo, [
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      signFaceMat,
      signFaceMat,
    ]);
    sign.position.set(9.1, 2.72, -2.9);
    sign.rotation.y = -Math.PI / 2;
    root.add(sign);
  }

  // ============================================================================
  // 1. SERVICE COUNTER BASE & 1990 BACKSPLASH (Facing WEST -X -> local +Z)
  // ============================================================================
  const counterRoot = new THREE.Group();
  counterRoot.position.set(9.35, 0, -2.9);
  counterRoot.rotation.y = -Math.PI / 2;
  root.add(counterRoot);

  const counterBodyGeo = new THREE.BoxGeometry(2.78, 0.9, 0.92);
  const counterBody = new THREE.Mesh(counterBodyGeo, mats.anthracite);
  counterBody.position.set(0, 0.45, 0);
  counterBody.castShadow = true;
  counterBody.receiveShadow = true;

  // Front burgundy 1990 trim panel
  const burgundyTrimMat = new THREE.MeshStandardMaterial({
    color: 0x7c1d28,
    roughness: 0.45,
    metalness: 0.12,
  });
  const frontFasciaGeo = new THREE.BoxGeometry(2.74, 0.72, 0.025);
  const frontFascia = new THREE.Mesh(frontFasciaGeo, burgundyTrimMat);
  frontFascia.position.set(0, 0.48, 0.462);

  const brassAccentMat = new THREE.MeshStandardMaterial({
    color: 0xd99b38,
    roughness: 0.28,
    metalness: 0.82,
  });
  const frontRailTrimGeo = new THREE.BoxGeometry(2.76, 0.032, 0.03);
  const frontRailTrim = new THREE.Mesh(frontRailTrimGeo, brassAccentMat);
  frontRailTrim.position.set(0, 0.85, 0.468);

  const worktopGeo = new THREE.BoxGeometry(2.82, 0.05, 0.98);
  const worktop = new THREE.Mesh(worktopGeo, mats.stainless);
  worktop.position.set(0, 0.925, 0);
  worktop.receiveShadow = true;

  // Backsplash + 1990 Franc tariff board behind the counter
  const backsplashGeo = new THREE.BoxGeometry(2.78, 0.92, 0.04);
  const backsplash = new THREE.Mesh(backsplashGeo, mats.whiteMetal);
  backsplash.position.set(0, 1.41, -0.46);

  const menuTex = createMenuStripTexture(ctx);
  const menuMat = new THREE.MeshStandardMaterial({ map: menuTex, roughness: 0.38 });
  const menuBoardGeo = new THREE.PlaneGeometry(2.58, 0.34);
  const menuBoard = new THREE.Mesh(menuBoardGeo, menuMat);
  menuBoard.position.set(0, 1.88, -0.435);

  counterRoot.add(counterBody, frontFascia, frontRailTrim, worktop, backsplash, menuBoard);
  ctx.disposables.push(
    counterBodyGeo,
    burgundyTrimMat,
    frontFasciaGeo,
    brassAccentMat,
    frontRailTrimGeo,
    worktopGeo,
    backsplashGeo,
    menuMat,
    menuBoardGeo
  );

  // ============================================================================
  // SHARED COMPOSITE HOT-SNACK PROCEDURAL MESHES (Croque, Panini, Quiche)
  // ============================================================================
  const toastedBreadMat = new THREE.MeshStandardMaterial({ color: 0xd49449, roughness: 0.72 });
  const meltedCheeseMat = new THREE.MeshStandardMaterial({ color: 0xf6d365, roughness: 0.48 });
  const hamSliceMat = new THREE.MeshStandardMaterial({ color: 0xf48c94, roughness: 0.58 });
  const paniniRollMat = new THREE.MeshStandardMaterial({ color: 0xdca45a, roughness: 0.68 });
  const grillMarkMat = new THREE.MeshStandardMaterial({ color: 0x45220e, roughness: 0.85 });
  const parchmentMat = new THREE.MeshStandardMaterial({ color: 0xf8f3e6, roughness: 0.82 });
  const quicheCrustMat = new THREE.MeshStandardMaterial({ color: 0xc98b3e, roughness: 0.76 });
  const quicheCustardMat = new THREE.MeshStandardMaterial({ color: 0xf5d67b, roughness: 0.52 });
  const lardonMat = new THREE.MeshStandardMaterial({ color: 0x993d34, roughness: 0.68 });

  const croqueBreadGeo = new THREE.BoxGeometry(0.115, 0.015, 0.115);
  const croqueHamGeo = new THREE.BoxGeometry(0.108, 0.008, 0.108);
  const croqueCheeseGeo = new THREE.BoxGeometry(0.11, 0.009, 0.11);
  const croqueTrayGeo = new THREE.BoxGeometry(0.13, 0.004, 0.13);

  const paniniBodyGeo = new THREE.BoxGeometry(0.11, 0.042, 0.185);
  const paniniGrillGeo = new THREE.BoxGeometry(0.112, 0.004, 0.011);
  const paniniSleeveGeo = new THREE.BoxGeometry(0.118, 0.046, 0.075);

  const quicheShape = new THREE.Shape();
  quicheShape.moveTo(0, 0.085);
  quicheShape.lineTo(-0.068, -0.055);
  quicheShape.lineTo(0.068, -0.055);
  quicheShape.closePath();
  const quicheWedgeGeo = new THREE.ExtrudeGeometry(quicheShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });
  quicheWedgeGeo.rotateX(-Math.PI / 2);
  const quicheCrustGeo = new THREE.BoxGeometry(0.14, 0.042, 0.016);
  const lardonGeo = new THREE.BoxGeometry(0.015, 0.006, 0.012);

  ctx.disposables.push(
    toastedBreadMat,
    meltedCheeseMat,
    hamSliceMat,
    paniniRollMat,
    grillMarkMat,
    parchmentMat,
    quicheCrustMat,
    quicheCustardMat,
    lardonMat,
    croqueBreadGeo,
    croqueHamGeo,
    croqueCheeseGeo,
    croqueTrayGeo,
    paniniBodyGeo,
    paniniGrillGeo,
    paniniSleeveGeo,
    quicheWedgeGeo,
    quicheCrustGeo,
    lardonGeo
  );

  const buildCroqueMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(croqueTrayGeo, parchmentMat);
    paper.position.y = 0.002;
    const b1 = new THREE.Mesh(croqueBreadGeo, toastedBreadMat);
    b1.position.y = 0.011;
    const ham = new THREE.Mesh(croqueHamGeo, hamSliceMat);
    ham.position.y = 0.022;
    const b2 = new THREE.Mesh(croqueBreadGeo, toastedBreadMat);
    b2.position.y = 0.032;
    const cheese = new THREE.Mesh(croqueCheeseGeo, meltedCheeseMat);
    cheese.position.y = 0.042;
    g.add(paper, b1, ham, b2, cheese);
    return g;
  };

  const buildPaniniMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const roll = new THREE.Mesh(paniniBodyGeo, paniniRollMat);
    roll.position.y = 0.023;
    const cheeseEdge = new THREE.Mesh(
      new THREE.BoxGeometry(0.114, 0.008, 0.16),
      meltedCheeseMat
    );
    cheeseEdge.position.y = 0.021;
    ctx.disposables.push(cheeseEdge.geometry);
    const sleeve = new THREE.Mesh(paniniSleeveGeo, parchmentMat);
    sleeve.position.set(0, 0.024, -0.056);
    g.add(roll, cheeseEdge, sleeve);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(paniniGrillGeo, grillMarkMat);
      bar.position.set(0, 0.045, -0.02 + i * 0.032);
      bar.rotation.y = 0.25;
      g.add(bar);
    }
    return g;
  };

  const buildQuicheMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(croqueTrayGeo, parchmentMat);
    paper.position.y = 0.002;
    const wedge = new THREE.Mesh(quicheWedgeGeo, quicheCustardMat);
    wedge.position.set(0, 0.005, 0.008);
    const crustRim = new THREE.Mesh(quicheCrustGeo, quicheCrustMat);
    crustRim.position.set(0, 0.023, -0.058);
    g.add(paper, wedge, crustRim);
    const lardonOffsets: Array<[number, number]> = [
      [-0.022, -0.015],
      [0.024, -0.02],
      [0.0, 0.025],
      [-0.01, -0.036],
    ];
    lardonOffsets.forEach(([lx, lz]) => {
      const l = new THREE.Mesh(lardonGeo, lardonMat);
      l.position.set(lx, 0.044, lz);
      g.add(l);
    });
    return g;
  };

  // ============================================================================
  // 2. STATION 1 (SOUTH, local X = +0.76): HEATED GLASS DISPLAY CASE (+65°C)
  //    100% EMPTY AT START · BARE METAL RAILS · SLIDING GLASS DOORS · HEAT SWITCH
  // ============================================================================
  {
    const warmer = new THREE.Group();
    warmer.position.set(0.76, 0.95, 0.02);
    counterRoot.add(warmer);

    const caseW = 1.06;
    const caseH = 0.66;
    const caseD = 0.56;

    // Stainless base plinth, canopy, and corner posts
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.06, caseD), mats.stainless);
    baseMesh.position.set(0, 0.03, 0.02);
    const topMesh = new THREE.Mesh(new THREE.BoxGeometry(caseW, 0.05, caseD), mats.stainless);
    topMesh.position.set(0, caseH - 0.025, 0.02);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(caseW - 0.02, caseH - 0.1, 0.02), mats.stainless);
    backWall.position.set(0, caseH / 2, -caseD / 2 + 0.03);
    warmer.add(baseMesh, topMesh, backWall);
    ctx.disposables.push(baseMesh.geometry, topMesh.geometry, backWall.geometry);

    const postGeo = new THREE.BoxGeometry(0.032, caseH - 0.08, 0.032);
    ctx.disposables.push(postGeo);
    [
      [-caseW / 2 + 0.018, -caseD / 2 + 0.038],
      [caseW / 2 - 0.018, -caseD / 2 + 0.038],
      [-caseW / 2 + 0.018, caseD / 2 + 0.002],
      [caseW / 2 - 0.018, caseD / 2 + 0.002],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(postGeo, mats.chrome);
      p.position.set(px, caseH / 2, pz);
      warmer.add(p);
    });

    // Side clear glass panels
    const sideGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xe6f4ff,
      transparent: true,
      opacity: 0.26,
      roughness: 0.08,
      metalness: 0.05,
      depthWrite: false,
    });
    const sideGlassGeo = new THREE.BoxGeometry(0.012, caseH - 0.12, caseD - 0.06);
    const glassL = new THREE.Mesh(sideGlassGeo, sideGlassMat);
    glassL.position.set(-caseW / 2 + 0.014, caseH / 2, 0.02);
    const glassR = new THREE.Mesh(sideGlassGeo, sideGlassMat);
    glassR.position.set(caseW / 2 - 0.014, caseH / 2, 0.02);
    warmer.add(glassL, glassR);
    ctx.disposables.push(sideGlassMat, sideGlassGeo);

    // 2 Transparent Tempered Glass Shelves (Y = 0.08 and Y = 0.35 — 100% EMPTY AT START!)
    const shelfGlassGeo = new THREE.BoxGeometry(caseW - 0.08, 0.014, 0.48);
    const lowerGlassShelf = new THREE.Mesh(shelfGlassGeo, sideGlassMat);
    lowerGlassShelf.position.set(0, 0.073, 0.02);
    const upperGlassShelf = new THREE.Mesh(shelfGlassGeo, sideGlassMat);
    upperGlassShelf.position.set(0, 0.343, 0.02);
    warmer.add(lowerGlassShelf, upperGlassShelf);
    ctx.disposables.push(shelfGlassGeo);

    // Warm Amber LED Strip & Point Light (toggled by physical 3D red/amber heating switch!)
    const amberStripMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.0,
      roughness: 0.3,
    });
    const amberStrip = new THREE.Mesh(new THREE.BoxGeometry(caseW - 0.12, 0.02, 0.05), amberStripMat);
    amberStrip.position.set(0, caseH - 0.06, 0.08);
    const amberLight = new THREE.PointLight(0xf59e0b, 0.0, 2.5, 2.0);
    amberLight.position.set(0, 0.45, 0.16);
    warmer.add(amberStrip, amberLight);
    ctx.disposables.push(amberStrip.geometry, amberStripMat);

    // Physical 3D Red/Amber Heating Rocker Switch + Analog +65°C Thermometer on Left Frame Pillar
    let heatingOn = false;
    const switchHousing = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 0.036), mats.anthracite);
    switchHousing.position.set(-caseW / 2 - 0.028, 0.16, 0.22);
    const switchRockerMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0xf97316,
      emissiveIntensity: 0.12,
      roughness: 0.32,
    });
    const switchRocker = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.044, 0.026), switchRockerMat);
    switchRocker.position.set(-caseW / 2 - 0.028, 0.16, 0.244);
    switchRocker.rotation.x = 0.24;

    const thermoTex = createGaugeDialTexture(ctx, 'CHAUFFE', '+65°C', '#ea580c');
    const thermoFace = new THREE.Mesh(
      new THREE.CircleGeometry(0.044, 20),
      new THREE.MeshStandardMaterial({ map: thermoTex, roughness: 0.35 })
    );
    thermoFace.position.set(-caseW / 2 - 0.028, 0.31, 0.244);
    const thermoNeedlePivot = new THREE.Group();
    thermoNeedlePivot.position.set(-caseW / 2 - 0.028, 0.31, 0.247);
    const thermoNeedle = new THREE.Mesh(
      new THREE.BoxGeometry(0.005, 0.032, 0.003),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    thermoNeedle.position.y = 0.012;
    thermoNeedlePivot.add(thermoNeedle);
    thermoNeedlePivot.rotation.z = 2.0; // Cold (20°C)

    warmer.add(switchHousing, switchRocker, thermoFace, thermoNeedlePivot);
    ctx.disposables.push(
      switchHousing.geometry,
      switchRockerMat,
      switchRocker.geometry,
      thermoFace.geometry,
      thermoFace.material as THREE.Material,
      thermoNeedle.geometry,
      thermoNeedle.material as THREE.Material
    );

    addActionHitbox(warmer, {
      id: 'cafe_warmer_heat_switch',
      size: [0.12, 0.24, 0.12],
      pos: [-caseW / 2 - 0.03, 0.22, 0.23],
      title: 'Interrupteur Vitrine Chauffante (+65 °C)',
      subtitle: 'Thermostat ambré pour Croque-Monsieur, Paninis & Quiches',
      verb: () => (heatingOn ? 'ÉTEINDRE CHAUFFE (+65°C)' : 'ALLUMER CHAUFFE (+65°C)'),
      dynamicSubtitle: () =>
        heatingOn
          ? 'Chauffe ACTIVE (+65 °C) · Éclairage ambré allumé'
          : 'Chauffe ÉTEINTE (20 °C) · Basculer pour préchauffer la vitrine',
      onInteract: () => {
        if (!acquireLock()) return;
        heatingOn = !heatingOn;
        soundSynth.playMechanicalButtonClick();
      },
    });

    // Dual Sliding Glass Service Doors (smoothly open sideways along chrome tracks!)
    let doorsOpen = false;
    const doorW = (caseW - 0.08) / 2;
    const doorH = caseH - 0.13;
    const doorGeo = new THREE.BoxGeometry(doorW, doorH, 0.012);
    const doorHandleGeo = new THREE.BoxGeometry(0.016, 0.12, 0.022);
    ctx.disposables.push(doorGeo, doorHandleGeo);

    const leftDoor = new THREE.Group();
    leftDoor.position.set(-doorW / 2, caseH / 2, 0.292);
    const leftDoorPane = new THREE.Mesh(doorGeo, sideGlassMat);
    const leftHandle = new THREE.Mesh(doorHandleGeo, mats.chrome);
    leftHandle.position.set(doorW / 2 - 0.03, 0, 0.012);
    leftDoor.add(leftDoorPane, leftHandle);

    const rightDoor = new THREE.Group();
    rightDoor.position.set(doorW / 2, caseH / 2, 0.306);
    const rightDoorPane = new THREE.Mesh(doorGeo, sideGlassMat);
    const rightHandle = new THREE.Mesh(doorHandleGeo, mats.chrome);
    rightHandle.position.set(-doorW / 2 + 0.03, 0, 0.012);
    rightDoor.add(rightDoorPane, rightHandle);
    warmer.add(leftDoor, rightDoor);

    // Door hitboxes: full glass clickable when closed, compact top/side handle clickable when open
    addActionHitbox(warmer, {
      id: 'cafe_warmer_doors_closed_hit',
      size: [caseW - 0.06, caseH - 0.18, 0.07],
      pos: [0, caseH / 2 + 0.03, 0.315],
      title: 'Portes Vitrées Coulissantes (Vitrine +65°C)',
      subtitle: 'Faites coulisser pour réapprovisionner le snacking chaud',
      isVisible: () => !doorsOpen,
      verb: () => 'OUVRIR PORTES VITRINE',
      onInteract: () => {
        if (!acquireLock()) return;
        doorsOpen = true;
        soundSynth.playPlasticSlide();
      },
    });

    addActionHitbox(warmer, {
      id: 'cafe_warmer_doors_handle_hit',
      size: [0.16, 0.32, 0.12],
      pos: [caseW / 2 + 0.03, caseH / 2, 0.28],
      title: 'Poignée Portes Vitrine Chauffante',
      subtitle: 'Ouvrir ou fermer les portes vitrées coulissantes',
      verb: () => (doorsOpen ? 'FERMER PORTES VITRINE' : 'OUVRIR PORTES VITRINE'),
      onInteract: () => {
        if (!acquireLock()) return;
        doorsOpen = !doorsOpen;
        soundSynth.playPlasticSlide();
      },
    });

    // Bare Metal Shelf Front Edges + Installable Transparent Plastic Price Rails + 3 Scanned Franc Labels/tier
    const warmerHelper = buildBareShelfWithInstallableRails(ctx, warmer, mats, tools, {
      idPrefix: 'r3_cafe_warmer',
      shelfYs: [0.08, 0.35],
      shelfNames: ['Vitrine Chauffante · Étagère Basse', 'Vitrine Chauffante · Étagère Haute'],
      shelfWidth: caseW - 0.06,
      shelfDepth: 0.48,
      deckCenterZ: 0.105, // front rail lip sits cleanly at Z = 0.345 (exterior of glass!)
      skipDeckMesh: true,
      singleSegment: true,
      bareLipColor: 0xcbd5e1,
      tierSlotXs: [
        [[-0.31, 0.0, 0.31], []],
        [[-0.31, 0.0, 0.31], []],
      ],
      expectedSlotEans: (_tierIdx, _sideKey, subIdx) => {
        if (subIdx === 0) return ['30141201', '30141202', '30141203'];
        if (subIdx === 1) return ['30141202', '30141201', '30141203'];
        return ['30141203', '30141201', '30141202'];
      },
    });

    // Multi-Depth Back-to-Front Columns (3 columns × 2 tiers × 3 deep = 18 hot snack slots, ALL EMPTY AT START!)
    const vCroque: MultiDepthVariantSpec = {
      kind: 'cafe_croque_monsieur',
      ean: '30141201',
      label: 'Croque-Monsieur Jambon-Fromage',
      sublabel: 'Rayon 3 · Vitrine Chauffante +65°C (12,50 ₣)',
      buildMesh: () => buildCroqueMesh(),
    };
    const vPanini: MultiDepthVariantSpec = {
      kind: 'cafe_panini',
      ean: '30141202',
      label: 'Panini Jambon-Emmental Grillé',
      sublabel: 'Rayon 3 · Vitrine Chauffante +65°C (15,00 ₣)',
      buildMesh: () => buildPaniniMesh(),
    };
    const vQuiche: MultiDepthVariantSpec = {
      kind: 'cafe_quiche_lorraine',
      ean: '30141203',
      label: 'Part de Quiche Lorraine Chaude',
      sublabel: 'Rayon 3 · Vitrine Chauffante +65°C (11,00 ₣)',
      buildMesh: () => buildQuicheMesh(),
    };

    const allHotVariants = [vCroque, vPanini, vQuiche];
    const colXs = [-0.31, 0.0, 0.31];
    const shelfYs = [0.08, 0.35];
    const tierLabels = ['Vitrine +65°C (Bas)', 'Vitrine +65°C (Haut)'];

    shelfYs.forEach((sy, tIdx) => {
      colXs.forEach((cx, cIdx) => {
        buildMultiDepthColumn(ctx, warmer, warmerHelper, tools, {
          id: `r3_warmer_t${tIdx}_c${cIdx}`,
          tierName: tierLabels[tIdx],
          x: cx,
          y: sy,
          shelfFrontZ: 0.24,
          shelfBackZ: -0.17,
          colWidth: 0.28,
          itemHeight: 0.16,
          itemDepth: 0.14,
          depthCount: 3,
          variants: allHotVariants,
          initialSlots: [null, null, null], // 100% EMPTY AT START!
          placementSound: 'hot_snack',
        });
      });
    });

    // Smooth animation updater for warming lights, rocker switch, thermometer needle, and sliding glass doors
    ctx.updaters.push({
      update: (dt) => {
        const targetStrip = heatingOn ? 2.1 : 0.0;
        const targetLight = heatingOn ? 2.4 : 0.0;
        amberStripMat.emissiveIntensity = THREE.MathUtils.damp(
          amberStripMat.emissiveIntensity,
          targetStrip,
          7,
          dt
        );
        amberLight.intensity = THREE.MathUtils.damp(amberLight.intensity, targetLight, 7, dt);
        switchRocker.rotation.x = THREE.MathUtils.damp(
          switchRocker.rotation.x,
          heatingOn ? -0.24 : 0.24,
          14,
          dt
        );
        switchRockerMat.emissiveIntensity = THREE.MathUtils.damp(
          switchRockerMat.emissiveIntensity,
          heatingOn ? 1.8 : 0.12,
          10,
          dt
        );
        thermoNeedlePivot.rotation.z = THREE.MathUtils.damp(
          thermoNeedlePivot.rotation.z,
          heatingOn ? -1.45 : 2.0,
          2.2,
          dt
        );

        // Slide doors open toward sides (stacked neatly at left/right edges when open)
        const targetLeftX = doorsOpen ? -caseW / 2 + 0.05 : -doorW / 2;
        const targetRightX = doorsOpen ? caseW / 2 - 0.05 : doorW / 2;
        const targetDoorScaleX = doorsOpen ? 0.16 : 1.0;
        leftDoor.position.x = THREE.MathUtils.damp(leftDoor.position.x, targetLeftX, 9, dt);
        rightDoor.position.x = THREE.MathUtils.damp(rightDoor.position.x, targetRightX, 9, dt);
        leftDoor.scale.x = THREE.MathUtils.damp(leftDoor.scale.x, targetDoorScaleX, 9, dt);
        rightDoor.scale.x = THREE.MathUtils.damp(rightDoor.scale.x, targetDoorScaleX, 9, dt);
      },
    });
  }

  // ============================================================================
  // 3. STATION 2 (CENTER, local X = -0.14): 1990 ESPRESSO MACHINE & CUP DISPENSER
  // ============================================================================
  {
    const coffeeStation = new THREE.Group();
    coffeeStation.position.set(-0.08, 0.95, 0.0);
    counterRoot.add(coffeeStation);

    // 3A. Composite 1990 Commercial Espresso Machine
    const machine = new THREE.Group();
    machine.position.set(0.06, 0, -0.02);
    coffeeStation.add(machine);

    const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.44), mats.anthracite);
    mBody.position.set(0, 0.24, 0);
    mBody.castShadow = true;

    const mChromeHeader = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.15, 0.48), mats.stainless);
    mChromeHeader.position.set(0, 0.42, 0.02);

    const badgeTex = createEspressoBadgeTexture(ctx);
    const badgeMat = new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.35 });
    const badgeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.095), badgeMat);
    badgeMesh.position.set(0, 0.42, 0.262);

    // Brushed chrome group-head + twin brass portafilter spouts
    const groupHead = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.052, 0.06, 16), mats.chrome);
    groupHead.position.set(-0.04, 0.31, 0.23);
    const portafilterHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.14, 10), mats.anthracite);
    portafilterHandle.rotation.x = Math.PI / 2;
    portafilterHandle.position.set(-0.04, 0.28, 0.31);
    const spoutL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.036, 8), brassAccentMat);
    spoutL.position.set(-0.06, 0.265, 0.23);
    const spoutR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.036, 8), brassAccentMat);
    spoutR.position.set(-0.02, 0.265, 0.23);

    // Stainless drip tray grate
    const dripTray = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.22), mats.stainless);
    dripTray.position.set(0, 0.025, 0.24);
    const dripGrate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.008, 0.16), mats.chrome);
    dripGrate.position.set(0, 0.052, 0.24);

    // Pressure gauge on right front panel
    const barTex = createGaugeDialTexture(ctx, 'BARS', '9 BAR', '#0284c7');
    const barDial = new THREE.Mesh(
      new THREE.CircleGeometry(0.038, 18),
      new THREE.MeshStandardMaterial({ map: barTex, roughness: 0.3 })
    );
    barDial.position.set(0.14, 0.25, 0.223);

    // Top Clear Acrylic Bean Hopper + Dynamic Roasted Coffee Beans Fill
    const hopperGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeff6ff,
      transparent: true,
      opacity: 0.34,
      roughness: 0.1,
      depthWrite: false,
    });
    const hopperShell = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.075, 0.2, 18), hopperGlassMat);
    hopperShell.position.set(0, 0.59, -0.02);
    const hopperLid = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.122, 0.022, 18), mats.anthracite);
    hopperLid.position.set(0, 0.7, -0.02);

    const roastedBeansMat = new THREE.MeshStandardMaterial({ color: 0x3b2114, roughness: 0.88 });
    const beansFillMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.068, 0.17, 14), roastedBeansMat);
    beansFillMesh.position.set(0, 0.51, -0.02);
    beansFillMesh.scale.y = 0.001;
    beansFillMesh.visible = false;

    // Physical 3D Brew Push Button (Chunky Emerald/Chrome Switch)
    const brewBtnBase = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.038, 0.02, 16), mats.chrome);
    brewBtnBase.rotation.x = Math.PI / 2;
    brewBtnBase.position.set(0.135, 0.355, 0.262);
    const brewBtnMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x22c55e,
      emissiveIntensity: 0.65,
      roughness: 0.28,
    });
    const brewBtnCap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 16), brewBtnMat);
    brewBtnCap.rotation.x = Math.PI / 2;
    brewBtnCap.position.set(0.135, 0.355, 0.275);

    // Espresso pouring streams (visible while brewing)
    const coffeeLiquidMat = new THREE.MeshStandardMaterial({
      color: 0x2c160c,
      roughness: 0.2,
      metalness: 0.05,
    });
    const streamGeo = new THREE.CylinderGeometry(0.0045, 0.0035, 0.17, 8);
    const streamL = new THREE.Mesh(streamGeo, coffeeLiquidMat);
    streamL.position.set(-0.06, 0.17, 0.23);
    streamL.visible = false;
    const streamR = new THREE.Mesh(streamGeo, coffeeLiquidMat);
    streamR.position.set(-0.02, 0.17, 0.23);
    streamR.visible = false;

    // Placed Paper Cup on Drip Tray
    const cupGroup = new THREE.Group();
    cupGroup.position.set(-0.04, 0.056, 0.23);
    cupGroup.visible = false;
    const cupPaperMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.72 });
    const cupStripeMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.62 });
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.026, 0.088, 16), cupPaperMat);
    cupBody.position.y = 0.044;
    const cupBand = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.028, 16), cupStripeMat);
    cupBand.position.y = 0.048;
    const cremaMat = new THREE.MeshStandardMaterial({ color: 0x5c2e14, roughness: 0.35 });
    const cupCrema = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.008, 14), cremaMat);
    cupCrema.position.y = 0.02;
    cupCrema.visible = false;
    cupGroup.add(cupBody, cupBand, cupCrema);

    // Animated Steam Puffs above cup
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const steamPuffs: THREE.Mesh[] = [];
    const puffGeo = new THREE.SphereGeometry(0.018, 8, 6);
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(puffGeo, steamMat.clone());
      puff.position.set(-0.04, 0.15 + i * 0.035, 0.23);
      puff.visible = false;
      machine.add(puff);
      steamPuffs.push(puff);
      ctx.disposables.push(puff.material as THREE.Material);
    }

    machine.add(
      mBody,
      mChromeHeader,
      badgeMesh,
      groupHead,
      portafilterHandle,
      spoutL,
      spoutR,
      dripTray,
      dripGrate,
      barDial,
      hopperShell,
      hopperLid,
      beansFillMesh,
      brewBtnBase,
      brewBtnCap,
      streamL,
      streamR,
      cupGroup
    );
    ctx.disposables.push(
      mBody.geometry,
      mChromeHeader.geometry,
      badgeMat,
      badgeMesh.geometry,
      groupHead.geometry,
      portafilterHandle.geometry,
      spoutL.geometry,
      spoutR.geometry,
      dripTray.geometry,
      dripGrate.geometry,
      barDial.geometry,
      barDial.material as THREE.Material,
      hopperGlassMat,
      hopperShell.geometry,
      hopperLid.geometry,
      roastedBeansMat,
      beansFillMesh.geometry,
      brewBtnBase.geometry,
      brewBtnMat,
      brewBtnCap.geometry,
      coffeeLiquidMat,
      streamGeo,
      cupPaperMat,
      cupStripeMat,
      cupBody.geometry,
      cupBand.geometry,
      cremaMat,
      cupCrema.geometry,
      steamMat,
      puffGeo
    );

    // Espresso State (Starts EMPTY: 0 beans, 0 cups in dispenser!)
    let beanServings = 0;
    const maxBeanServings = 20;
    let cupState: 'none' | 'empty' | 'brewing' | 'ready' = 'none';
    let brewTimer = 0;
    let brewBtnAnim = 0;

    // Hitbox 1: Top Bean Hopper
    addActionHitbox(machine, {
      id: 'cafe_espresso_hopper',
      size: [0.28, 0.26, 0.28],
      pos: [0, 0.6, -0.02],
      title: 'Trémie Grains — Machine à Café Expresso 1990',
      subtitle: 'Recharger avec Café Grain Torréfié 1kg (EAN 30141204)',
      dynamicProductEan: () => (beanServings > 0 ? '30141204' : null),
      dynamicSubtitle: () =>
        beanServings > 0
          ? `Trémie remplie : ${beanServings}/${maxBeanServings} doses d’expresso`
          : 'Trémie VIDE — Commandez "Café Grain Torréfié 1kg" (30141204)',
      verb: () => {
        const held = tools.getHeldItem();
        if (tools.getActiveTool() === 'hands' && held?.kind === 'cafe_beans_bag') {
          return 'REMPLIR TRÉMIE CAFÉ GRAIN (1KG)';
        }
        return beanServings > 0 ? `TRÉMIE (${beanServings} DOSES)` : 'TRÉMIE VIDE (CAFÉ GRAIN 1KG)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        const held = tools.getHeldItem();
        if (tools.getActiveTool() === 'hands' && held?.kind === 'cafe_beans_bag') {
          beanServings = maxBeanServings;
          tools.consumeHeldItem();
          soundSynth.playCoffeeBeansPour();
        } else {
          soundSynth.playAtmPiezo('error');
        }
      },
    });

    // Hitbox 2: Drip Tray / Cup Spout Slot
    addActionHitbox(machine, {
      id: 'cafe_espresso_spout_slot',
      size: [0.22, 0.22, 0.24],
      pos: [-0.04, 0.15, 0.24],
      title: 'Buse Expresso & Grille Égouttoir',
      subtitle: 'Poser un gobelet café vide ou récupérer l’expresso chaud',
      dynamicProductEan: () => (cupState === 'ready' ? '30141206' : null),
      dynamicSubtitle: () => {
        if (cupState === 'brewing') return 'Extraction expresso 9 bars en cours…';
        if (cupState === 'ready') return 'Café Expresso 1990 fumant prêt (4,00 ₣ · EAN 30141206)';
        if (cupState === 'empty') return 'Gobelet en place — Appuyez sur le bouton vert [COULER UN CAFÉ]';
        return 'Aucun gobelet — Prenez un gobelet au distributeur à côté';
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (cupState === 'brewing') return 'EXTRACTION EXPRESSO…';
        if (cupState === 'ready') {
          return tools.getActiveTool() === 'hands' && !held
            ? 'PRENDRE CAFÉ EXPRESSO (4,00 ₣)'
            : 'EXPRESSO PRÊT (MAINS VIDES)';
        }
        if (cupState === 'empty') {
          if (tools.getActiveTool() === 'hands' && !held) return 'RETIRER GOBELET VIDE';
          return 'GOBELET PRÊT SOUS LA BUSE';
        }
        if (tools.getActiveTool() === 'hands' && held?.kind === 'cafe_paper_cup_empty') {
          return 'POSER GOBELET SOUS LA BUSE';
        }
        return 'POSER UN GOBELET CAFÉ ICI';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        const held = tools.getHeldItem();
        if (cupState === 'none' && tools.getActiveTool() === 'hands' && held?.kind === 'cafe_paper_cup_empty') {
          cupState = 'empty';
          cupGroup.visible = true;
          cupCrema.visible = false;
          tools.consumeHeldItem();
          soundSynth.playPlasticSlide();
          return;
        }
        if (cupState === 'empty' && tools.getActiveTool() === 'hands' && !held) {
          cupState = 'none';
          cupGroup.visible = false;
          tools.pickUpItem({
            kind: 'cafe_paper_cup_empty',
            label: 'Gobelet Café 1990 (Vide)',
            sublabel: 'À poser sous la buse de la Machine Expresso',
            ean: '30141205',
          });
          soundSynth.playPaperGrab();
          return;
        }
        if (cupState === 'ready' && tools.getActiveTool() === 'hands' && !held) {
          cupState = 'none';
          cupGroup.visible = false;
          cupCrema.visible = false;
          tools.pickUpItem({
            kind: 'cafe_espresso_cup',
            label: 'Café Expresso 1990 (Chaud)',
            sublabel: 'Expresso grain fraîchement coulé · 4,00 ₣',
            ean: '30141206',
          });
          soundSynth.playUiTone(false);
        }
      },
    });

    // Hitbox 3: Physical 3D Brew Button ([COULER UN CAFÉ EXPRESSO — 4,00 ₣])
    addActionHitbox(machine, {
      id: 'cafe_espresso_brew_btn',
      size: [0.14, 0.14, 0.12],
      pos: [0.135, 0.355, 0.27],
      title: 'Bouton Extraction — Machine à Café Expresso 1990',
      subtitle: 'Couler un café expresso grain (4,00 ₣)',
      verb: () => {
        if (cupState === 'brewing') return 'COULAGE EXPRESSO EN COURS…';
        if (beanServings <= 0) return 'REMPLIR TRÉMIE CAFÉ D’ABORD';
        if (cupState === 'none') return 'POSER UN GOBELET D’ABORD';
        if (cupState === 'ready') return 'PRENDRE LE CAFÉ PRÊT D’ABORD';
        return 'COULER UN CAFÉ EXPRESSO — 4,00 ₣';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        brewBtnAnim = 1.0;
        if (cupState === 'empty' && beanServings > 0) {
          beanServings = Math.max(0, beanServings - 1);
          cupState = 'brewing';
          brewTimer = 0;
          cupCrema.visible = true;
          cupCrema.position.y = 0.018;
          soundSynth.playEspressoBrew(ESPRESSO_BREW_SEC);
        } else {
          soundSynth.playAtmPiezo('error');
        }
      },
    });

    // 3B. Countertop Paper Cup Dispenser ("Distributeur Gobelets Café") right beside machine
    const dispenser = new THREE.Group();
    dispenser.position.set(-0.34, 0, 0.08);
    coffeeStation.add(dispenser);

    const dispBase = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.03, 16), mats.anthracite);
    dispBase.position.y = 0.015;
    const dispTube = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.36, 16), hopperGlassMat);
    dispTube.position.y = 0.21;
    const dispCollar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 8, 20), mats.chrome);
    dispCollar.rotation.x = Math.PI / 2;
    dispCollar.position.y = 0.39;
    const cupStackMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.32, 14), cupPaperMat);
    cupStackMesh.position.y = 0.03;
    cupStackMesh.visible = false;
    dispenser.add(dispBase, dispTube, dispCollar, cupStackMesh);
    ctx.disposables.push(dispBase.geometry, dispTube.geometry, dispCollar.geometry, cupStackMesh.geometry);

    let dispenserCups = 0;
    const maxDispenserCups = 50;

    addActionHitbox(dispenser, {
      id: 'cafe_cup_dispenser',
      size: [0.18, 0.44, 0.18],
      pos: [0, 0.22, 0],
      title: 'Distributeur de Gobelets Café 1990',
      subtitle: 'Recharger avec Lot Gobelets Café x50 (EAN 30141205)',
      dynamicProductEan: () => (dispenserCups > 0 ? '30141205' : null),
      dynamicSubtitle: () =>
        dispenserCups > 0
          ? `${dispenserCups}/${maxDispenserCups} gobelets disponibles · EAN 30141205`
          : 'Distributeur VIDE — Commandez "Lot Gobelets Café x50" (30141205)',
      verb: () => {
        const held = tools.getHeldItem();
        if (tools.getActiveTool() === 'hands' && held?.kind === 'cafe_cup_sleeve') {
          return 'RECHARGER GOBELETS (+50)';
        }
        if (tools.getActiveTool() === 'hands' && !held && dispenserCups > 0) {
          return `PRENDRE UN GOBELET CAFÉ (${dispenserCups})`;
        }
        return dispenserCups > 0 ? `GOBELETS (${dispenserCups}/50)` : 'DISTRIBUTEUR VIDE (LOT x50)';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        const held = tools.getHeldItem();
        if (tools.getActiveTool() === 'hands' && held?.kind === 'cafe_cup_sleeve') {
          dispenserCups = maxDispenserCups;
          tools.consumeHeldItem();
          soundSynth.playPlasticSlide();
          return;
        }
        if (tools.getActiveTool() === 'hands' && !held && dispenserCups > 0) {
          dispenserCups -= 1;
          tools.pickUpItem({
            kind: 'cafe_paper_cup_empty',
            label: 'Gobelet Café 1990 (Vide)',
            sublabel: 'À poser sous la buse de la Machine Expresso',
            ean: '30141205',
          });
          soundSynth.playPaperGrab();
        } else {
          soundSynth.playAtmPiezo('error');
        }
      },
    });

    // Espresso & Dispenser Animation Updater
    ctx.updaters.push({
      update: (dt, elapsed) => {
        // Bean fill scale
        const fillRatio = beanServings / maxBeanServings;
        beansFillMesh.visible = fillRatio > 0.01;
        if (beansFillMesh.visible) {
          const sy = THREE.MathUtils.damp(beansFillMesh.scale.y, fillRatio, 7, dt);
          beansFillMesh.scale.y = sy;
          beansFillMesh.position.y = 0.495 + sy * 0.085;
        }

        // Cup dispenser stack height
        const cupRatio = dispenserCups / maxDispenserCups;
        cupStackMesh.visible = cupRatio > 0.01;
        if (cupStackMesh.visible) {
          const sy = THREE.MathUtils.damp(cupStackMesh.scale.y, cupRatio, 8, dt);
          cupStackMesh.scale.y = sy;
          cupStackMesh.position.y = 0.035 + sy * 0.16;
        }

        // Brew button depression spring
        brewBtnAnim = THREE.MathUtils.damp(brewBtnAnim, 0, 12, dt);
        brewBtnCap.position.z = 0.275 - brewBtnAnim * 0.011;

        // Brewing cycle progress
        if (cupState === 'brewing') {
          brewTimer += dt;
          const p = THREE.MathUtils.clamp(brewTimer / ESPRESSO_BREW_SEC, 0, 1);
          const pouring = p > 0.16 && p < 0.94;
          streamL.visible = pouring;
          streamR.visible = pouring;
          cupCrema.position.y = THREE.MathUtils.lerp(0.018, 0.076, p);
          brewBtnMat.emissiveIntensity = 1.3 + Math.sin(elapsed * 14) * 0.45;
          if (brewTimer >= ESPRESSO_BREW_SEC) {
            cupState = 'ready';
            streamL.visible = false;
            streamR.visible = false;
            brewBtnMat.emissiveIntensity = 0.65;
            soundSynth.playLabelMatchChime();
          }
        } else {
          streamL.visible = false;
          streamR.visible = false;
          brewBtnMat.emissiveIntensity = cupState === 'empty' && beanServings > 0 ? 1.05 : 0.25;
        }

        // Animated rising steam wisps while brewing or hot coffee waiting
        const showSteam = cupState === 'brewing' || cupState === 'ready';
        for (let i = 0; i < steamPuffs.length; i++) {
          const puff = steamPuffs[i];
          puff.visible = showSteam;
          if (showSteam) {
            const phase = (elapsed * 0.85 + i * 0.33) % 1;
            puff.position.y = 0.145 + phase * 0.13;
            puff.position.x = -0.04 + Math.sin(elapsed * 2.5 + i * 2) * 0.012;
            const sc = 0.65 + phase * 1.1;
            puff.scale.setScalar(sc);
            (puff.material as THREE.MeshBasicMaterial).opacity = Math.sin(phase * Math.PI) * 0.38;
          }
        }
      },
    });
  }

  // ============================================================================
  // 4. STATION 3 (NORTH, local X = -0.98): 1990 COMMERCIAL MICROWAVE
  //    HINGED DOOR · ROTATING GLASS TURNTABLE · WARM LIGHT · 30 SEC BUTTON · DING!
  // ============================================================================
  {
    const micro = new THREE.Group();
    micro.position.set(-0.98, 0.95, 0.0);
    counterRoot.add(micro);

    const mwW = 0.56;
    const mwH = 0.34;
    const mwD = 0.42;

    const shellMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.42, metalness: 0.18 });
    const cavityMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.3 });

    // Hollow cabinet constructed from walls so opening the hinged door reveals the true 3D interior cavity!
    const topWall = new THREE.Mesh(new THREE.BoxGeometry(mwW, 0.025, mwD), shellMat);
    topWall.position.set(0, mwH - 0.0125, 0);
    const botWall = new THREE.Mesh(new THREE.BoxGeometry(mwW, 0.03, mwD), shellMat);
    botWall.position.set(0, 0.015, 0);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(mwW, mwH, 0.028), shellMat);
    backWall.position.set(0, mwH / 2, -mwD / 2 + 0.014);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.026, mwH, mwD), shellMat);
    leftWall.position.set(-mwW / 2 + 0.013, mwH / 2, 0);
    // Right control column (houses timer dial & start button)
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(0.145, mwH, mwD), shellMat);
    rightPanel.position.set(mwW / 2 - 0.0725, mwH / 2, 0);
    // Cavity divider wall
    const cavityBack = new THREE.Mesh(new THREE.BoxGeometry(0.39, mwH - 0.055, 0.01), cavityMat);
    cavityBack.position.set(-0.06, mwH / 2, -mwD / 2 + 0.032);
    micro.add(topWall, botWall, backWall, leftWall, rightPanel, cavityBack);

    // Interior warm halogen bulb & glowing ceiling diffuser
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.0,
    });
    const bulbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.1), bulbMat);
    bulbMesh.position.set(-0.06, mwH - 0.03, 0.02);
    const microLight = new THREE.PointLight(0xfde047, 0.0, 1.4, 2.0);
    microLight.position.set(-0.06, mwH - 0.08, 0.02);
    micro.add(bulbMesh, microLight);

    // Rotating Glass Turntable Plate
    const turntablePivot = new THREE.Group();
    turntablePivot.position.set(-0.06, 0.04, 0.01);
    const glassPlateMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.55,
      roughness: 0.12,
      depthWrite: false,
    });
    const plateDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.125, 0.012, 24), glassPlateMat);
    const plateRing = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.005, 8, 20), mats.chrome);
    plateRing.rotation.x = Math.PI / 2;
    plateRing.position.y = -0.005;
    turntablePivot.add(plateDisc, plateRing);
    micro.add(turntablePivot);

    // Food preview slot mounted on turntable (supports Croque, Panini, Quiche & Triangle Sandwiches!)
    const turntableFoodGroup = new THREE.Group();
    turntableFoodGroup.position.set(0, 0.008, 0);
    turntablePivot.add(turntableFoodGroup);

    const mwCroque = buildCroqueMesh();
    const mwPanini = buildPaniniMesh();
    const mwQuiche = buildQuicheMesh();
    // Triangle sandwich mesh for heating Rayon 11 sandwiches too!
    const triShape = new THREE.Shape();
    triShape.moveTo(-0.06, 0);
    triShape.lineTo(0.06, 0);
    triShape.lineTo(-0.06, 0.11);
    triShape.closePath();
    const triGeo = new THREE.ExtrudeGeometry(triShape, { depth: 0.06, bevelEnabled: false });
    triGeo.translate(0, 0, -0.03);
    const mwTriangleSand = new THREE.Mesh(triGeo, toastedBreadMat);
    mwTriangleSand.rotation.x = Math.PI / 2;
    mwTriangleSand.position.y = 0.032;

    const mwMeshes: Record<string, THREE.Object3D> = {
      cafe_croque_monsieur: mwCroque,
      cafe_panini: mwPanini,
      cafe_quiche_lorraine: mwQuiche,
      snacking_sand_jambon: mwTriangleSand,
      snacking_sand_poulet: mwTriangleSand,
      snacking_sand_thon: mwTriangleSand,
    };
    [mwCroque, mwPanini, mwQuiche, mwTriangleSand].forEach((m) => {
      m.visible = false;
      turntableFoodGroup.add(m);
    });

    // Hinged Front Door (pivoted on Left edge at X = -mwW/2 + 0.01, Z = +mwD/2)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-mwW / 2 + 0.012, mwH / 2, mwD / 2);
    micro.add(doorPivot);

    const doorW = 0.405;
    const doorH = mwH - 0.03;
    // Frame around viewing window so interior turntable is clearly visible when door is closed!
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.05, 0.022), mats.anthracite);
    frameTop.position.set(doorW / 2, doorH / 2 - 0.025, 0.01);
    const frameBot = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.05, 0.022), mats.anthracite);
    frameBot.position.set(doorW / 2, -doorH / 2 + 0.025, 0.01);
    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.045, doorH, 0.022), mats.anthracite);
    frameL.position.set(0.0225, 0, 0.01);
    const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.055, doorH, 0.022), mats.anthracite);
    frameR.position.set(doorW - 0.0275, 0, 0.01);

    const mwWindowMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0xfde047,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 0.48,
      roughness: 0.14,
      depthWrite: false,
    });
    const mwWindow = new THREE.Mesh(new THREE.BoxGeometry(doorW - 0.095, doorH - 0.095, 0.008), mwWindowMat);
    mwWindow.position.set(doorW / 2 - 0.005, 0, 0.01);

    const mwHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.21, 10), mats.chrome);
    mwHandle.position.set(doorW - 0.028, 0, 0.038);
    doorPivot.add(frameTop, frameBot, frameL, frameR, mwWindow, mwHandle);

    // Control Panel Face: Rotary Mechanical Timer Dial + Physical 3D Start Button ([CHAUFFER 30 SEC])
    const ctrlFace = new THREE.Mesh(new THREE.BoxGeometry(0.125, mwH - 0.04, 0.012), mats.anthracite);
    ctrlFace.position.set(mwW / 2 - 0.0725, mwH / 2, mwD / 2 + 0.004);
    const timerDialPivot = new THREE.Group();
    timerDialPivot.position.set(mwW / 2 - 0.0725, mwH * 0.67, mwD / 2 + 0.022);
    const timerKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.024, 16), mats.chrome);
    timerKnob.rotation.x = Math.PI / 2;
    const timerPointer = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.022, 0.008), mats.anthracite);
    timerPointer.position.set(0, 0.01, 0.012);
    timerDialPivot.add(timerKnob, timerPointer);

    const startBtnMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0xf97316,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    const startBtnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.052, 0.024), startBtnMat);
    startBtnMesh.position.set(mwW / 2 - 0.0725, mwH * 0.28, mwD / 2 + 0.018);

    micro.add(ctrlFace, timerDialPivot, startBtnMesh);
    ctx.disposables.push(
      shellMat,
      cavityMat,
      topWall.geometry,
      botWall.geometry,
      backWall.geometry,
      leftWall.geometry,
      rightPanel.geometry,
      cavityBack.geometry,
      bulbMat,
      bulbMesh.geometry,
      glassPlateMat,
      plateDisc.geometry,
      plateRing.geometry,
      triGeo,
      frameTop.geometry,
      frameBot.geometry,
      frameL.geometry,
      frameR.geometry,
      mwWindowMat,
      mwWindow.geometry,
      mwHandle.geometry,
      ctrlFace.geometry,
      timerKnob.geometry,
      timerPointer.geometry,
      startBtnMat,
      startBtnMesh.geometry
    );

    // Microwave State
    let mwDoorOpen = false;
    let mwHeating = false;
    let mwTimer = 0;
    let mwStartBtnAnim = 0;
    let loadedItem: HeldItemHudInfo | null = null;
    let loadedIsHot = false;

    const syncTurntableFood = () => {
      [mwCroque, mwPanini, mwQuiche, mwTriangleSand].forEach((m) => {
        m.visible = false;
      });
      if (loadedItem && mwMeshes[loadedItem.kind]) {
        mwMeshes[loadedItem.kind].visible = true;
      }
    };

    // Hitbox 1: Hinged Door (on doorPivot so it swings out of the way when opened!)
    addActionHitbox(doorPivot, {
      id: 'cafe_microwave_door',
      size: [doorW, doorH, 0.07],
      pos: [doorW / 2, 0, 0.02],
      title: 'Porte du Four Micro-Ondes 1990',
      subtitle: 'Ouvrir ou fermer la porte du micro-ondes',
      verb: () => {
        if (mwHeating) return 'CHAUFFAGE EN COURS…';
        return mwDoorOpen ? 'FERMER MICRO-ONDES' : 'OUVRIR MICRO-ONDES';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        if (mwHeating) {
          soundSynth.playAtmPiezo('error');
          return;
        }
        mwDoorOpen = !mwDoorOpen;
        soundSynth.playUiTone(true);
      },
    });

    // Hitbox 2: Interior Glass Turntable Food Slot (accessible when door is OPEN)
    addActionHitbox(micro, {
      id: 'cafe_microwave_turntable',
      size: [0.34, 0.24, 0.3],
      pos: [-0.06, 0.16, 0.04],
      title: 'Plateau Tournant — Four Micro-Ondes 1990',
      subtitle: 'Déposer un croque-monsieur, panini, quiche ou sandwich',
      isVisible: () => mwDoorOpen && !mwHeating,
      dynamicProductEan: () => loadedItem?.ean ?? null,
      dynamicSubtitle: () => {
        if (!loadedItem) return 'Plateau vide — Posez un croque-monsieur, panini ou sandwich';
        return loadedIsHot
          ? `${loadedItem.label} CHAUD prêt à retirer !`
          : `${loadedItem.label} posé — Fermez la porte et lancez [CHAUFFER 30 SEC]`;
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (!loadedItem) {
          if (tools.getActiveTool() === 'hands' && isMicrowavableKind(held?.kind)) {
            return 'POSER DANS LE MICRO-ONDES';
          }
          return 'PLATEAU MICRO-ONDES VIDE';
        }
        if (tools.getActiveTool() === 'hands' && !held) {
          return loadedIsHot ? 'RETIRER SNACK CHAUD !' : 'RETIRER DU MICRO-ONDES';
        }
        return 'RETIRER AVEC MAINS VIDES';
      },
      onInteract: () => {
        if (!acquireLock() || !mwDoorOpen || mwHeating) return;
        const held = tools.getHeldItem();
        if (!loadedItem && tools.getActiveTool() === 'hands' && held && isMicrowavableKind(held.kind)) {
          loadedItem = { ...held };
          loadedIsHot = false;
          tools.consumeHeldItem();
          syncTurntableFood();
          soundSynth.playHotSnackPlace();
          return;
        }
        if (loadedItem && tools.getActiveTool() === 'hands' && !held) {
          const outItem: HeldItemHudInfo = {
            ...loadedItem,
            sublabel: loadedIsHot
              ? 'Chauffé au Micro-Ondes 1990 · Bien chaud !'
              : loadedItem.sublabel,
          };
          loadedItem = null;
          loadedIsHot = false;
          syncTurntableFood();
          tools.pickUpItem(outItem);
          soundSynth.playHotSnackPlace();
        }
      },
    });

    // Hitbox 3: Physical 3D Start Button ([CHAUFFER 30 SEC])
    addActionHitbox(micro, {
      id: 'cafe_microwave_start_btn',
      size: [0.14, 0.28, 0.1],
      pos: [mwW / 2 - 0.0725, mwH * 0.45, mwD / 2 + 0.03],
      title: 'Bouton Départ — Four Micro-Ondes 1990',
      subtitle: 'Cycle réchauffage 30 secondes + plateau tournant + clochette DING!',
      verb: () => {
        if (mwHeating) {
          const secsLeft = Math.max(1, Math.ceil((1 - mwTimer / MICROWAVE_CYCLE_SEC) * 30));
          return `CHAUFFAGE… (${secsLeft} SEC)`;
        }
        if (mwDoorOpen) return 'FERMER LA PORTE D’ABORD';
        if (!loadedItem) return 'POSER UN SNACK D’ABORD';
        return 'CHAUFFER 30 SEC';
      },
      onInteract: () => {
        if (!acquireLock()) return;
        mwStartBtnAnim = 1.0;
        if (!mwHeating && !mwDoorOpen && loadedItem) {
          mwHeating = true;
          mwTimer = 0;
          loadedIsHot = false;
          soundSynth.playMicrowaveRun(MICROWAVE_CYCLE_SEC);
        } else {
          soundSynth.playAtmPiezo('error');
        }
      },
    });

    // Microwave Per-Frame Animation Updater
    ctx.updaters.push({
      update: (dt) => {
        // Hinged door smooth swing (0 -> -108 deg)
        const targetDoorAngle = mwDoorOpen ? -1.88 : 0.0;
        doorPivot.rotation.y = THREE.MathUtils.damp(doorPivot.rotation.y, targetDoorAngle, 10, dt);

        // Start button press spring
        mwStartBtnAnim = THREE.MathUtils.damp(mwStartBtnAnim, 0, 12, dt);
        startBtnMesh.position.z = mwD / 2 + 0.018 - mwStartBtnAnim * 0.009;

        if (mwHeating) {
          mwTimer += dt;
          const p = THREE.MathUtils.clamp(mwTimer / MICROWAVE_CYCLE_SEC, 0, 1);
          turntablePivot.rotation.y += dt * 1.9;
          timerDialPivot.rotation.z = THREE.MathUtils.lerp(-2.2, 0.0, p);
          bulbMat.emissiveIntensity = THREE.MathUtils.damp(bulbMat.emissiveIntensity, 2.4, 12, dt);
          microLight.intensity = THREE.MathUtils.damp(microLight.intensity, 2.2, 12, dt);
          mwWindowMat.emissiveIntensity = THREE.MathUtils.damp(mwWindowMat.emissiveIntensity, 0.65, 10, dt);
          startBtnMat.emissiveIntensity = 1.6;

          if (mwTimer >= MICROWAVE_CYCLE_SEC) {
            mwHeating = false;
            loadedIsHot = true;
            timerDialPivot.rotation.z = 0;
            soundSynth.playMicrowaveDing();
          }
        } else {
          const interiorGlow = mwDoorOpen ? 0.9 : 0.0;
          bulbMat.emissiveIntensity = THREE.MathUtils.damp(bulbMat.emissiveIntensity, interiorGlow, 8, dt);
          microLight.intensity = THREE.MathUtils.damp(microLight.intensity, mwDoorOpen ? 0.9 : 0.0, 8, dt);
          mwWindowMat.emissiveIntensity = THREE.MathUtils.damp(mwWindowMat.emissiveIntensity, 0.0, 8, dt);
          startBtnMat.emissiveIntensity = loadedItem && !mwDoorOpen ? 0.95 : 0.25;
        }
      },
    });
  }

  // Solid counter AABB collider matching the East Wall counter footprint
  addBoxCollider(ctx, 'rayon3_cafe_snacking_counter', 8.78, 9.95, -4.35, -1.45);
}
