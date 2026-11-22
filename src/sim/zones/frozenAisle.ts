import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { INTERACT_LAYER, ProceduralTextureBank } from '../textures';
import { InteractableItem, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import { soundSynth } from '../audio';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

const FREEZER_ACTION_COOLDOWN_MS = 320;

interface MistPuffParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
  baseScale: number;
}

/**
 * V15 DEPARTMENT 6 — "RAYON 6 — SURGELÉS & GLACES (1990)"
 * Positioned along the left-center cold aisle (X = -6.5, Z = -4.78..+1.19), facing +X:
 * - 2 Horizontal Commercial Chest Freezers ("Bacs Bahuts Surgelés -18°C") with:
 *   • Smooth interactive 3D sliding tempered-glass lids ([COULISSER LA VITRE]) + cold mist puffs
 *   • Digital -18°C LED thermometer readouts
 *   • Interior wire divider baskets with 3-deep back-to-front multi-depth stocking & [FAIRE LE FACING]
 *   • Bare front metal price-holder rails (zero pre-installed rails or price tags at game start!)
 * - 1 Vertical 3-Tier Glass-Door Ice Cream Cabinet ("Armoire Vitrée Glaces -18.5°C") with:
 *   • Dual independently hinged opening tempered-glass doors ([OUVRIR / FERMER LA PORTE VITRÉE]) + cold mist
 *   • 3 interior wire shelves with bare front price-holder rails (zero pre-installed rails or tags!)
 *   • 4-deep back-to-front multi-depth columns for Ice Cream Tubs, Cones & Popsicles
 * - Strict 320ms touch debounce, shared geometries/materials, zero GC in animation loop (locked 60 FPS).
 */
export function buildFrozenAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const deptRoot = new THREE.Group();
  root.add(deptRoot);

  // Shared 320ms interaction debounce for glass lids & freezer doors
  let lastFreezerAction = 0;
  const acquireFreezerLock = (): boolean => {
    const now = performance.now();
    if (now - lastFreezerAction < FREEZER_ACTION_COOLDOWN_MS) return false;
    lastFreezerAction = now;
    return true;
  };

  // ============================================================================
  // 1. SHARED MATERIALS, PROCEDURAL PACKAGING TEXTURES & DIGITAL -18°C DISPLAYS
  // ============================================================================
  const freezerBodyWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.36,
    metalness: 0.14,
  });
  const freezerTrimBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.42,
    metalness: 0.18,
  });
  const freezerBumperDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.62,
    metalness: 0.15,
  });
  const freezerCavityMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.5,
    metalness: 0.12,
  });
  const wireGridMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.28,
    metalness: 0.72,
  });
  const alumFrameMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.26,
    metalness: 0.78,
  });
  const temperedGlassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.34,
    roughness: 0.08,
    metalness: 0.15,
    depthWrite: false,
  });
  const glassFrostRimMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff,
    transparent: true,
    opacity: 0.58,
    roughness: 0.32,
    depthWrite: false,
  });
  const cabinetLedBarMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff,
    emissive: 0xbae6fd,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  });
  const proxyHiddenMat = new THREE.MeshBasicMaterial({ visible: false });

  ctx.disposables.push(
    freezerBodyWhiteMat,
    freezerTrimBlueMat,
    freezerBumperDarkMat,
    freezerCavityMat,
    wireGridMat,
    alumFrameMat,
    temperedGlassMat,
    glassFrostRimMat,
    cabinetLedBarMat,
    proxyHiddenMat
  );

  const createThermometerMat = (tempStr: string, labelStr: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0f172a';
    g.fillRect(0, 0, 256, 96);
    g.strokeStyle = '#334155';
    g.lineWidth = 5;
    g.strokeRect(4, 4, 248, 88);
    // Digital LED box
    g.fillStyle = '#020617';
    g.fillRect(16, 16, 148, 64);
    g.fillStyle = '#38bdf8';
    g.font = '800 34px "JetBrains Mono", monospace';
    g.fillText(tempStr, 24, 60);
    // Right status indicator
    g.fillStyle = '#94a3b8';
    g.font = '700 13px "Plus Jakarta Sans", sans-serif';
    g.fillText(labelStr, 174, 38);
    g.fillStyle = '#22c55e';
    g.beginPath();
    g.arc(186, 62, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#cbd5e1';
    g.font = '700 12px "JetBrains Mono", monospace';
    g.fillText('FROID OK', 198, 66);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0x0ea5e9,
      emissiveMap: tex,
      emissiveIntensity: 0.42,
      roughness: 0.25,
    });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Procedural frosted packaging face texture with EAN-8 barcode
  const createFrozenPackMat = (opts: {
    bg: string;
    band: string;
    title: string;
    sub: string;
    ean: string;
    price: string;
    textColor?: string;
  }) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, 256, 256);

    // Subtle frosted corner vignette
    g.fillStyle = 'rgba(224, 242, 254, 0.28)';
    g.fillRect(0, 0, 256, 18);
    g.fillRect(0, 238, 256, 18);

    // Header brand band
    g.fillStyle = opts.band;
    g.fillRect(0, 22, 256, 54);
    g.fillStyle = '#ffffff';
    g.font = '800 22px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.fillText(opts.title, 128, 56);

    // Subtitle + snowflake badge
    g.fillStyle = opts.textColor ?? '#0f172a';
    g.font = '700 16px "Plus Jakarta Sans", sans-serif';
    g.fillText(opts.sub, 128, 104);
    g.font = '700 13px "JetBrains Mono", monospace';
    g.fillStyle = '#0369a1';
    g.fillText(`* SURGELÉ -18°C · ${opts.price}`, 128, 128);
    g.textAlign = 'left';

    // Crisp EAN-8 barcode strip
    drawEanBarcode(g, opts.ean, 28, 148, 200, 74, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.44 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Packaging materials for the 7 V15 Frozen Products
  const fritesFaceMat = createFrozenPackMat({
    bg: '#fef08a',
    band: '#1d4ed8',
    title: 'FRITES ALLUMETTES',
    sub: 'POMMES DE TERRE · 1 KG',
    ean: '30140801',
    price: '11,90 ₣',
  });
  const pizzaFaceMat = createFrozenPackMat({
    bg: '#dc2626',
    band: '#15803d',
    title: 'PIZZA ROYALE',
    sub: 'JAMBON · CHAMPIGNONS',
    ean: '30140802',
    price: '18,50 ₣',
    textColor: '#fef9c3',
  });
  const colinFaceMat = createFrozenPackMat({
    bg: '#0284c7',
    band: '#0f172a',
    title: 'COLIN PANÉS ×10',
    sub: 'FILET DE COLIN DORE',
    ean: '30140803',
    price: '16,20 ₣',
    textColor: '#ffffff',
  });
  const haricotsFaceMat = createFrozenPackMat({
    bg: '#dcfce7',
    band: '#15803d',
    title: 'HARICOTS VERTS',
    sub: 'EXTRA-FINS · 1 KG',
    ean: '30140804',
    price: '10,80 ₣',
  });
  const glaceBacFaceMat = createFrozenPackMat({
    bg: '#fef3c7',
    band: '#be185d',
    title: 'GLACE 3 PARFUMS',
    sub: 'VANILLE · FRAISE · CHOCO',
    ean: '30140805',
    price: '19,50 ₣',
  });
  const conesFaceMat = createFrozenPackMat({
    bg: '#e0f2fe',
    band: '#1e3a8a',
    title: 'CÔNES GLACÉS ×6',
    sub: 'VANILLE & CHOCOLAT',
    ean: '30140806',
    price: '17,80 ₣',
  });
  const esquimauxFaceMat = createFrozenPackMat({
    bg: '#ffedd5',
    band: '#ea580c',
    title: 'ESQUIMAUX ×8',
    sub: 'BÂTONNETS ASSORTIS',
    ean: '30140807',
    price: '15,40 ₣',
  });

  const fritesSideMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
  const pizzaSideMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.52 });
  const colinSideMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.45 });
  const haricotsSideMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.52 });
  const glaceTubBodyMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.4 });
  const glaceTubLidMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.32 });
  const conesSideMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 });
  const esquimauxSideMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.48 });

  ctx.disposables.push(
    fritesSideMat,
    pizzaSideMat,
    colinSideMat,
    haricotsSideMat,
    glaceTubBodyMat,
    glaceTubLidMat,
    conesSideMat,
    esquimauxSideMat
  );

  // Shared product geometries (reused across all depth slots for minimal GPU memory & locked 60 FPS)
  const fritesBagGeo = new THREE.BoxGeometry(0.28, 0.085, 0.21);
  const pizzaBoxGeo = new THREE.BoxGeometry(0.32, 0.048, 0.24);
  const colinBoxGeo = new THREE.BoxGeometry(0.28, 0.075, 0.21);
  const haricotsBagGeo = new THREE.BoxGeometry(0.28, 0.085, 0.21);
  const glaceTubGeo = new THREE.BoxGeometry(0.26, 0.115, 0.14);
  const glaceLidGeo = new THREE.BoxGeometry(0.272, 0.018, 0.15);
  const conesBoxGeo = new THREE.BoxGeometry(0.27, 0.155, 0.125);
  const esqBoxGeo = new THREE.BoxGeometry(0.27, 0.145, 0.12);

  ctx.disposables.push(
    fritesBagGeo,
    pizzaBoxGeo,
    colinBoxGeo,
    haricotsBagGeo,
    glaceTubGeo,
    glaceLidGeo,
    conesBoxGeo,
    esqBoxGeo
  );

  // Variant Specs for Multi-Depth Columns
  const fritesVariant: MultiDepthVariantSpec = {
    kind: 'frozen_frites',
    ean: '30140801',
    label: 'Frites Allumettes Surgelées 1kg',
    sublabel: '11,90 ₣ · Surgelés -18°C',
    buildMesh: () => {
      const g = new THREE.Group();
      // 2 neatly stacked frozen bags per slot for visible depth inside chest basket
      [0.044, 0.132].forEach((py, idx) => {
        const m = new THREE.Mesh(fritesBagGeo, [
          fritesSideMat,
          fritesSideMat,
          fritesFaceMat,
          fritesSideMat,
          fritesFaceMat,
          fritesSideMat,
        ]);
        m.position.set(idx === 1 ? 0.008 : 0, py, 0);
        m.rotation.y = idx === 1 ? 0.04 : -0.02;
        g.add(m);
      });
      return g;
    },
  };

  const pizzaVariant: MultiDepthVariantSpec = {
    kind: 'frozen_pizza',
    ean: '30140802',
    label: 'Pizza Royale Surgelée',
    sublabel: '18,50 ₣ · Surgelés -18°C',
    buildMesh: () => {
      const g = new THREE.Group();
      [0.025, 0.076, 0.127].forEach((py, idx) => {
        const m = new THREE.Mesh(pizzaBoxGeo, [
          pizzaSideMat,
          pizzaSideMat,
          pizzaFaceMat,
          pizzaSideMat,
          pizzaSideMat,
          pizzaSideMat,
        ]);
        m.position.set(0, py, 0);
        m.rotation.y = (idx - 1) * 0.025;
        g.add(m);
      });
      return g;
    },
  };

  const colinVariant: MultiDepthVariantSpec = {
    kind: 'frozen_colin',
    ean: '30140803',
    label: 'Bâtonnets Colin Panés x10',
    sublabel: '16,20 ₣ · Surgelés -18°C',
    buildMesh: () => {
      const g = new THREE.Group();
      [0.04, 0.118].forEach((py, idx) => {
        const m = new THREE.Mesh(colinBoxGeo, [
          colinSideMat,
          colinSideMat,
          colinFaceMat,
          colinSideMat,
          colinFaceMat,
          colinSideMat,
        ]);
        m.position.set(0, py, 0);
        m.rotation.y = idx === 1 ? -0.03 : 0.02;
        g.add(m);
      });
      return g;
    },
  };

  const haricotsVariant: MultiDepthVariantSpec = {
    kind: 'frozen_haricots',
    ean: '30140804',
    label: 'Haricots Verts Surgelés 1kg',
    sublabel: '10,80 ₣ · Surgelés -18°C',
    buildMesh: () => {
      const g = new THREE.Group();
      [0.044, 0.132].forEach((py, idx) => {
        const m = new THREE.Mesh(haricotsBagGeo, [
          haricotsSideMat,
          haricotsSideMat,
          haricotsFaceMat,
          haricotsSideMat,
          haricotsFaceMat,
          haricotsSideMat,
        ]);
        m.position.set(idx === 1 ? -0.006 : 0, py, 0);
        m.rotation.y = idx === 1 ? -0.04 : 0.02;
        g.add(m);
      });
      return g;
    },
  };

  const glaceBacVariant: MultiDepthVariantSpec = {
    kind: 'frozen_glace_bac',
    ean: '30140805',
    label: 'Bac Glace 3 Parfums 1L',
    sublabel: '19,50 ₣ · Armoire Glaces -18°C',
    buildMesh: () => {
      const g = new THREE.Group();
      const tub = new THREE.Mesh(glaceTubGeo, [
        glaceTubBodyMat,
        glaceTubBodyMat,
        glaceTubBodyMat,
        glaceTubBodyMat,
        glaceBacFaceMat,
        glaceBacFaceMat,
      ]);
      tub.position.y = 0.058;
      const lid = new THREE.Mesh(glaceLidGeo, [
        glaceTubLidMat,
        glaceTubLidMat,
        glaceBacFaceMat,
        glaceTubLidMat,
        glaceTubLidMat,
        glaceTubLidMat,
      ]);
      lid.position.y = 0.123;
      g.add(tub, lid);
      return g;
    },
  };

  const conesVariant: MultiDepthVariantSpec = {
    kind: 'frozen_cones',
    ean: '30140806',
    label: 'Cônes Glacés Vanille-Choco x6',
    sublabel: '17,80 ₣ · Armoire Glaces -18°C',
    buildMesh: () => {
      const m = new THREE.Mesh(conesBoxGeo, [
        conesSideMat,
        conesSideMat,
        conesSideMat,
        conesSideMat,
        conesFaceMat,
        conesFaceMat,
      ]);
      m.position.y = 0.078;
      return m;
    },
  };

  const esquimauxVariant: MultiDepthVariantSpec = {
    kind: 'frozen_esquimaux',
    ean: '30140807',
    label: 'Esquimaux Bâtonnets x8',
    sublabel: '15,40 ₣ · Armoire Glaces -18°C',
    buildMesh: () => {
      const m = new THREE.Mesh(esqBoxGeo, [
        esquimauxSideMat,
        esquimauxSideMat,
        esquimauxSideMat,
        esquimauxSideMat,
        esquimauxFaceMat,
        esquimauxFaceMat,
      ]);
      m.position.y = 0.073;
      return m;
    },
  };

  // ============================================================================
  // 2. REUSABLE COLD MIST PUFF SYSTEM (ZERO GC ALLOCATION PER FRAME)
  // ============================================================================
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 64;
  mistCanvas.height = 64;
  const mc = mistCanvas.getContext('2d')!;
  const mGrad = mc.createRadialGradient(32, 32, 4, 32, 32, 30);
  mGrad.addColorStop(0, 'rgba(224, 242, 254, 0.72)');
  mGrad.addColorStop(0.55, 'rgba(224, 242, 254, 0.28)');
  mGrad.addColorStop(1, 'rgba(224, 242, 254, 0.0)');
  mc.fillStyle = mGrad;
  mc.fillRect(0, 0, 64, 64);
  const mistTex = new THREE.CanvasTexture(mistCanvas);
  const mistGeo = new THREE.PlaneGeometry(0.46, 0.46);
  ctx.disposables.push(mistTex, mistGeo);

  const mistPuffs: MistPuffParticle[] = [];

  const createMistPoolForGroup = (parent: THREE.Group, count: number): MistPuffParticle[] => {
    const pool: MistPuffParticle[] = [];
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: mistTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      ctx.disposables.push(mat);
      const mesh = new THREE.Mesh(mistGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      parent.add(mesh);
      const p: MistPuffParticle = {
        mesh,
        mat,
        life: 0,
        maxLife: 1.1,
        vx: 0,
        vy: 0,
        vz: 0,
        baseScale: 0.8,
      };
      pool.push(p);
      mistPuffs.push(p);
    }
    return pool;
  };

  const triggerMistBurst = (
    pool: MistPuffParticle[],
    originX: number,
    originY: number,
    originZ: number,
    spreadX: number,
    forwardVz: number
  ) => {
    pool.forEach((p, idx) => {
      const offsetFrac = pool.length > 1 ? idx / (pool.length - 1) - 0.5 : 0;
      p.mesh.position.set(
        originX + offsetFrac * spreadX,
        originY + (idx % 2) * 0.05,
        originZ + (idx % 3 - 1) * 0.06
      );
      p.mesh.rotation.set(
        -0.35 + (idx % 2) * 0.25,
        offsetFrac * 0.6,
        idx * 0.7
      );
      p.vx = offsetFrac * 0.14;
      p.vy = 0.08 + (idx % 2) * 0.04;
      p.vz = forwardVz;
      p.maxLife = 1.05 + (idx % 3) * 0.18;
      p.life = p.maxLife;
      p.baseScale = 0.65 + (idx % 2) * 0.22;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
    });
  };

  // ============================================================================
  // 3. OVERHEAD DEPARTMENT SIGN (DOUBLE-SIDED 1990 RETAIL BANNER)
  // ============================================================================
  {
    const signTex = texBank.createDepartmentSignTexture(
      'RAYON 6 — SURGELÉS & GLACES',
      '-18°C · FRITES · PIZZAS · POISSONS PANÉS · LÉGUMES · ARMOIRE GLACES',
      '#0c4a6e',
      '#38bdf8'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.34 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 3.6), [
      signMat,
      signMat,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
    ]);
    signMesh.position.set(-6.5, 2.72, -1.75);
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6);
    const r1 = new THREE.Mesh(rodGeo, mats.chrome);
    r1.position.set(-6.5, 3.25, -3.1);
    const r2 = new THREE.Mesh(rodGeo, mats.chrome);
    r2.position.set(-6.5, 3.25, -0.4);
    deptRoot.add(signMesh, r1, r2);
    ctx.disposables.push(signTex, signMat, signMesh.geometry, rodGeo);
  }

  // ============================================================================
  // 4. TWO HORIZONTAL SLIDING-GLASS CHEST FREEZERS ("BACS BAHUTS -18°C")
  // ============================================================================
  const chestConfigs = [
    {
      id: 'chest_freezer_1',
      name: 'Bac Bahut #1 — Frites & Pizzas',
      zPos: 0.25,
      tempStr: '-18.4°C',
      leftVariant: fritesVariant,
      rightVariant: pizzaVariant,
      colEans: ['30140801', '30140801', '30140802', '30140802'],
      initialCols: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ] as Array<Array<'frozen_frites' | 'frozen_pizza' | null>>,
    },
    {
      id: 'chest_freezer_2',
      name: 'Bac Bahut #2 — Poissons Panés & Légumes',
      zPos: -1.78,
      tempStr: '-18.2°C',
      leftVariant: colinVariant,
      rightVariant: haricotsVariant,
      colEans: ['30140803', '30140803', '30140804', '30140804'],
      initialCols: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ] as Array<Array<'frozen_colin' | 'frozen_haricots' | null>>,
    },
  ];

  // Shared chest geometries
  const chestW = 1.88;
  const chestD = 1.14;
  const chestWallH = 0.86;
  const chestBaseGeo = new THREE.BoxGeometry(chestW, 0.54, chestD);
  const chestFrontWallGeo = new THREE.BoxGeometry(chestW, 0.34, 0.11);
  const chestSideWallGeo = new THREE.BoxGeometry(0.10, 0.34, chestD - 0.22);
  const chestBumperGeo = new THREE.BoxGeometry(chestW + 0.04, 0.055, chestD + 0.04);
  const chestRimRailGeo = new THREE.BoxGeometry(chestW + 0.02, 0.045, 0.06);
  const chestRimSideGeo = new THREE.BoxGeometry(0.06, 0.045, chestD + 0.02);
  const chestBasketFloorGeo = new THREE.BoxGeometry(1.64, 0.012, 0.86);
  const wireDivGeo = new THREE.BoxGeometry(0.012, 0.26, 0.86);
  const wireBarXGeo = new THREE.BoxGeometry(1.64, 0.008, 0.008);
  const wireBarZGeo = new THREE.BoxGeometry(0.008, 0.008, 0.86);
  const lidGlassGeo = new THREE.BoxGeometry(0.86, 0.014, 0.94);
  const lidFrameLongGeo = new THREE.BoxGeometry(0.89, 0.022, 0.024);
  const lidFrameSideGeo = new THREE.BoxGeometry(0.024, 0.022, 0.94);
  const lidHandleGeo = new THREE.BoxGeometry(0.032, 0.032, 0.26);
  const thermoBoxGeo = new THREE.BoxGeometry(0.24, 0.09, 0.024);
  const thermoFaceGeo = new THREE.PlaneGeometry(0.22, 0.078);

  ctx.disposables.push(
    chestBaseGeo,
    chestFrontWallGeo,
    chestSideWallGeo,
    chestBumperGeo,
    chestRimRailGeo,
    chestRimSideGeo,
    chestBasketFloorGeo,
    wireDivGeo,
    wireBarXGeo,
    wireBarZGeo,
    lidGlassGeo,
    lidFrameLongGeo,
    lidFrameSideGeo,
    lidHandleGeo,
    thermoBoxGeo,
    thermoFaceGeo
  );

  const animatedSliders: Array<{
    leftLid: THREE.Group;
    rightLid: THREE.Group;
    getTargets: () => [number, number];
  }> = [];

  chestConfigs.forEach((cfg) => {
    const chestGroup = new THREE.Group();
    chestGroup.position.set(-6.5, 0, cfg.zPos);
    chestGroup.rotation.y = Math.PI / 2; // Local +Z faces +X (central aisle)
    deptRoot.add(chestGroup);

    // Insulated commercial body with recessed cold well (real hollow cavity!)
    const lowerBase = new THREE.Mesh(chestBaseGeo, freezerBodyWhiteMat);
    lowerBase.position.y = 0.27;
    lowerBase.castShadow = true;
    lowerBase.receiveShadow = true;

    const frontWall = new THREE.Mesh(chestFrontWallGeo, freezerBodyWhiteMat);
    frontWall.position.set(0, 0.70, chestD / 2 - 0.055);
    const backWall = new THREE.Mesh(chestFrontWallGeo, freezerBodyWhiteMat);
    backWall.position.set(0, 0.70, -(chestD / 2 - 0.055));
    const leftWall = new THREE.Mesh(chestSideWallGeo, freezerBodyWhiteMat);
    leftWall.position.set(-(chestW / 2 - 0.05), 0.70, 0);
    const rightWall = new THREE.Mesh(chestSideWallGeo, freezerBodyWhiteMat);
    rightWall.position.set(chestW / 2 - 0.05, 0.70, 0);

    // Dark plinth kickplate & trolley bumper strip
    const bumperBot = new THREE.Mesh(chestBumperGeo, freezerBumperDarkMat);
    bumperBot.position.y = 0.08;
    const bumperMid = new THREE.Mesh(chestBumperGeo, freezerTrimBlueMat);
    bumperMid.position.y = 0.42;

    // Upper sliding-track perimeter frame
    const rimF = new THREE.Mesh(chestRimRailGeo, freezerTrimBlueMat);
    rimF.position.set(0, chestWallH, chestD / 2 - 0.02);
    const rimB = new THREE.Mesh(chestRimRailGeo, freezerTrimBlueMat);
    rimB.position.set(0, chestWallH, -(chestD / 2 - 0.02));
    const rimL = new THREE.Mesh(chestRimSideGeo, freezerTrimBlueMat);
    rimL.position.set(-(chestW / 2 - 0.02), chestWallH, 0);
    const rimR = new THREE.Mesh(chestRimSideGeo, freezerTrimBlueMat);
    rimR.position.set(chestW / 2 - 0.02, chestWallH, 0);

    // Frosted inner cavity floor + wire divider baskets
    const cavityFloor = new THREE.Mesh(chestBasketFloorGeo, freezerCavityMat);
    cavityFloor.position.set(0, 0.548, 0);
    chestGroup.add(
      lowerBase,
      frontWall,
      backWall,
      leftWall,
      rightWall,
      bumperBot,
      bumperMid,
      rimF,
      rimB,
      rimL,
      rimR,
      cavityFloor
    );

    // Wire basket grid rods & 3 vertical lane dividers separating the 4 columns
    [-0.44, 0, 0.44].forEach((dx) => {
      const div = new THREE.Mesh(wireDivGeo, wireGridMat);
      div.position.set(dx, 0.68, 0);
      chestGroup.add(div);
    });
    for (let rz = -0.36; rz <= 0.37; rz += 0.18) {
      const barX = new THREE.Mesh(wireBarXGeo, wireGridMat);
      barX.position.set(0, 0.562, rz);
      chestGroup.add(barX);
    }
    for (let rx = -0.78; rx <= 0.79; rx += 0.26) {
      const barZ = new THREE.Mesh(wireBarZGeo, wireGridMat);
      barZ.position.set(rx, 0.562, 0);
      chestGroup.add(barZ);
    }

    // Digital -18°C Thermometer mounted on front right housing
    const thermoMat = createThermometerMat(cfg.tempStr, 'BAHUT');
    const thermoBox = new THREE.Mesh(thermoBoxGeo, freezerBumperDarkMat);
    thermoBox.position.set(0.68, 0.64, chestD / 2 + 0.01);
    const thermoFace = new THREE.Mesh(thermoFaceGeo, thermoMat);
    thermoFace.position.set(0.68, 0.64, chestD / 2 + 0.024);
    chestGroup.add(thermoBox, thermoFace);

    // Reusable cold mist pool for this chest freezer
    const chestMist = createMistPoolForGroup(chestGroup, 5);

    // Bare front metal price-holder rail along local +Z = +0.57 at Y = 0.82
    const chestHelper = buildBareShelfWithInstallableRails(ctx, chestGroup, mats, tools, {
      idPrefix: cfg.id,
      shelfYs: [0.834],
      shelfNames: [cfg.name],
      shelfWidth: 1.80,
      shelfDepth: 0.96,
      deckCenterZ: 0.09,
      singleSegment: true,
      skipDeckMesh: true,
      bareLipColor: 0xcbd5e1,
      tierSlotXs: [[[-0.66, -0.22, 0.22, 0.66], []]],
      expectedSlotEans: (_t, _s, subIdx) => [cfg.colEans[subIdx] ?? cfg.colEans[0]],
    });

    // 4 Multi-Depth Wire Basket Columns (3 slots back-to-front per column)
    const colXs = [-0.66, -0.22, 0.22, 0.66];
    colXs.forEach((cx, colIdx) => {
      const isLeftBay = colIdx < 2;
      const spec = isLeftBay ? cfg.leftVariant : cfg.rightVariant;
      buildMultiDepthColumn(ctx, chestGroup, chestHelper, tools, {
        id: `${cfg.id}_col_${colIdx}`,
        tierName: `${cfg.name} · Panier ${colIdx + 1}`,
        x: cx,
        y: 0.568,
        shelfBackZ: -0.37,
        shelfFrontZ: 0.41,
        colWidth: 0.39,
        itemHeight: 0.24,
        itemDepth: 0.24,
        depthCount: 3,
        variants: [spec],
        initialSlots: cfg.initialCols[colIdx],
        placementSound: 'frozen',
      });
    });

    // Dual Interactive Sliding Tempered-Glass Lids (staggered Y tracks so zero z-fighting!)
    type LidMode = 'closed' | 'left_open' | 'right_open';
    let lidMode: LidMode = 'closed';

    const buildSlidingLid = (side: 'left' | 'right', trackY: number, handleOffsetX: number) => {
      const lidGrp = new THREE.Group();
      lidGrp.position.set(side === 'left' ? -0.45 : 0.45, trackY, 0);
      chestGroup.add(lidGrp);

      const pane = new THREE.Mesh(lidGlassGeo, temperedGlassMat);
      const frameF = new THREE.Mesh(lidFrameLongGeo, alumFrameMat);
      frameF.position.z = 0.47;
      const frameB = new THREE.Mesh(lidFrameLongGeo, alumFrameMat);
      frameB.position.z = -0.47;
      const frameL = new THREE.Mesh(lidFrameSideGeo, alumFrameMat);
      frameL.position.x = -0.435;
      const frameR = new THREE.Mesh(lidFrameSideGeo, alumFrameMat);
      frameR.position.x = 0.435;
      const handle = new THREE.Mesh(lidHandleGeo, mats.chrome);
      handle.position.set(handleOffsetX, 0.022, 0);

      // Subtle frosted rim stripe inside lid
      const frostStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(0.84, 0.06),
        glassFrostRimMat
      );
      frostStrip.rotation.x = -Math.PI / 2;
      frostStrip.position.set(0, 0.009, 0.42);
      ctx.disposables.push(frostStrip.geometry);

      lidGrp.add(pane, frameF, frameB, frameL, frameR, handle, frostStrip);

      // Proxy hitbox parented directly to the sliding lid — moves out of the way when slid open!
      const lidHitGeo = new THREE.BoxGeometry(0.88, 0.09, 0.96);
      ctx.disposables.push(lidHitGeo);
      const lidHit = new THREE.Mesh(lidHitGeo, proxyHiddenMat);
      lidHit.position.set(0, 0.02, 0);
      lidHit.layers.set(INTERACT_LAYER);
      lidGrp.add(lidHit);

      const interactItem: InteractableItem = {
        id: `${cfg.id}_lid_${side}`,
        title: `${cfg.name} — Vitre ${side === 'left' ? 'Gauche' : 'Droite'}`,
        subtitle: `Couvercle verre trempé coulissant (${cfg.tempStr})`,
        kind: 'diegetic_action',
        state: false,
        inspectText: 'Couvercle vitré coulissant isolant basse consommation (-18°C).',
        proxyMesh: lidHit,
        dynamicSubtitle: () => {
          if (lidMode === 'closed') {
            return `Vitre fermée (${cfg.tempStr}) — Appuyez pour faire coulisser et accéder aux paniers`;
          }
          if ((side === 'left' && lidMode === 'left_open') || (side === 'right' && lidMode === 'right_open')) {
            return 'Bac ouvert — Appuyez pour refermer la vitre coulissante';
          }
          return 'Autre côté ouvert — Appuyez pour faire coulisser et ouvrir ce compartiment';
        },
        dynamicVerb: () => {
          if (
            (side === 'left' && lidMode === 'left_open') ||
            (side === 'right' && lidMode === 'right_open')
          ) {
            return 'REFERMER LA VITRE';
          }
          return 'COULISSER LA VITRE';
        },
        onInteract: () => {
          if (!acquireFreezerLock()) return;
          const prevMode = lidMode;
          if (side === 'left') {
            lidMode = lidMode === 'left_open' ? 'closed' : 'left_open';
          } else {
            lidMode = lidMode === 'right_open' ? 'closed' : 'right_open';
          }
          const isOpening = lidMode !== 'closed';
          soundSynth.playFreezerGlassSlide(isOpening);
          if (lidMode !== prevMode) {
            const burstX = lidMode === 'left_open' ? -0.45 : lidMode === 'right_open' ? 0.45 : 0;
            triggerMistBurst(chestMist, burstX, 0.87, 0.04, 0.65, 0.08);
          }
        },
      };
      lidHit.userData.interactable = interactItem;
      ctx.interactables.push(interactItem);

      return lidGrp;
    };

    const leftLid = buildSlidingLid('left', 0.886, -0.37);
    const rightLid = buildSlidingLid('right', 0.908, 0.37);

    animatedSliders.push({
      leftLid,
      rightLid,
      getTargets: () => {
        if (lidMode === 'left_open') return [0.42, 0.45];
        if (lidMode === 'right_open') return [-0.45, -0.42];
        return [-0.45, 0.45];
      },
    });

    // Solid world-space AABB collider matching rotated chest freezer footprint
    addBoxCollider(
      ctx,
      `${cfg.id}_col`,
      -6.5 - chestD / 2 - 0.02,
      -6.5 + chestD / 2 + 0.02,
      cfg.zPos - chestW / 2 - 0.02,
      cfg.zPos + chestW / 2 + 0.02
    );
  });

  // ============================================================================
  // 5. 3-TIER VERTICAL GLASS-DOOR ICE CREAM CABINET ("ARMOIRE VITRÉE GLACES -18.5°C")
  // ============================================================================
  const animatedDoors: Array<{
    pivot: THREE.Group;
    getTargetAngle: () => number;
  }> = [];

  {
    const cabW = 1.66;
    const cabH = 2.18;
    const cabD = 1.04;
    const cabZPos = -3.95;

    const cabGroup = new THREE.Group();
    cabGroup.position.set(-6.5, 0, cabZPos);
    cabGroup.rotation.y = Math.PI / 2; // Local +Z faces +X (central aisle)
    deptRoot.add(cabGroup);

    // Insulated cabinet outer shell (hollow front interior!)
    const cabBack = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, 0.14), freezerBodyWhiteMat);
    cabBack.position.set(0, cabH / 2, -cabD / 2 + 0.07);
    cabBack.castShadow = true;
    cabBack.receiveShadow = true;

    const cabSideGeo = new THREE.BoxGeometry(0.08, cabH, cabD);
    const cabSideL = new THREE.Mesh(cabSideGeo, freezerBodyWhiteMat);
    cabSideL.position.set(-cabW / 2 + 0.04, cabH / 2, 0);
    cabSideL.castShadow = true;
    const cabSideR = new THREE.Mesh(cabSideGeo, freezerBodyWhiteMat);
    cabSideR.position.set(cabW / 2 - 0.04, cabH / 2, 0);
    cabSideR.castShadow = true;

    // Lower compressor base + dark ventilation grille
    const cabPlinth = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.14, 0.28, cabD - 0.04), freezerBumperDarkMat);
    cabPlinth.position.set(0, 0.14, 0.01);
    const cabInnerFloor = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.16, 0.03, cabD - 0.16), freezerCavityMat);
    cabInnerFloor.position.set(0, 0.29, -0.02);

    // Top illuminated canopy header ("GLACES & CRÈMES GLACÉES · -18°C")
    const cabTopBox = new THREE.Mesh(new THREE.BoxGeometry(cabW, 0.26, cabD), freezerTrimBlueMat);
    cabTopBox.position.set(0, cabH - 0.13, 0);
    const canopyTex = texBank.createDepartmentSignTexture(
      'GLACES & CRÈMES GLACÉES',
      '-18.5 °C · BACS 1L · CÔNES · ESQUIMAUX',
      '#0369a1',
      '#7dd3fc'
    );
    const canopyFaceMat = new THREE.MeshStandardMaterial({
      map: canopyTex,
      emissive: 0x38bdf8,
      emissiveMap: canopyTex,
      emissiveIntensity: 0.28,
      roughness: 0.28,
    });
    const canopyFront = new THREE.Mesh(new THREE.PlaneGeometry(cabW - 0.08, 0.20), canopyFaceMat);
    canopyFront.position.set(0, cabH - 0.13, cabD / 2 + 0.004);

    // Interior cool-white emissive strip + digital -18.5°C LED thermometer on top mullion
    const innerLightBar = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.24, 0.025, 0.05), cabinetLedBarMat);
    innerLightBar.position.set(0, cabH - 0.28, 0.34);

    const cabThermoMat = createThermometerMat('-18.5°C', 'GLACES');
    const cabThermoBox = new THREE.Mesh(thermoBoxGeo, freezerBumperDarkMat);
    cabThermoBox.position.set(0, 0.18, cabD / 2 + 0.006);
    const cabThermoFace = new THREE.Mesh(thermoFaceGeo, cabThermoMat);
    cabThermoFace.position.set(0, 0.18, cabD / 2 + 0.020);

    // Narrow center mullion post between the 2 glass doors
    const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.035, 1.64, 0.04), alumFrameMat);
    centerMullion.position.set(0, 1.10, cabD / 2 - 0.02);

    cabGroup.add(
      cabBack,
      cabSideL,
      cabSideR,
      cabPlinth,
      cabInnerFloor,
      cabTopBox,
      canopyFront,
      innerLightBar,
      cabThermoBox,
      cabThermoFace,
      centerMullion
    );
    ctx.disposables.push(
      cabBack.geometry,
      cabSideGeo,
      cabPlinth.geometry,
      cabInnerFloor.geometry,
      cabTopBox.geometry,
      canopyTex,
      canopyFaceMat,
      canopyFront.geometry,
      innerLightBar.geometry,
      centerMullion.geometry
    );

    // 3 Interior Wire Shelves (Y = 0.36, 0.90, 1.44)
    const tierYs = [0.36, 0.90, 1.44];
    const cabWireLongGeo = new THREE.BoxGeometry(1.50, 0.008, 0.008);
    const cabWireDepthGeo = new THREE.BoxGeometry(0.008, 0.008, 0.68);
    ctx.disposables.push(cabWireLongGeo, cabWireDepthGeo);

    tierYs.forEach((sy) => {
      for (let wz = -0.28; wz <= 0.40; wz += 0.11) {
        const wireX = new THREE.Mesh(cabWireLongGeo, wireGridMat);
        wireX.position.set(0, sy - 0.005, wz);
        cabGroup.add(wireX);
      }
      for (let wx = -0.70; wx <= 0.71; wx += 0.20) {
        const wireZ = new THREE.Mesh(cabWireDepthGeo, wireGridMat);
        wireZ.position.set(wx, sy - 0.005, 0.06);
        cabGroup.add(wireZ);
      }
    });

    // Bare front metal price-holder rails inside the vertical ice cream cabinet (starts 100% BARE!)
    const cabHelper = buildBareShelfWithInstallableRails(ctx, cabGroup, mats, tools, {
      idPrefix: 'ice_cream_cabinet',
      shelfYs: tierYs,
      shelfNames: [
        'Armoire Glaces — Niveau Bas (Bacs 1L)',
        'Armoire Glaces — Niveau Milieu (Cônes)',
        'Armoire Glaces — Niveau Haut (Esquimaux)',
      ],
      shelfWidth: 1.50,
      shelfDepth: 0.70,
      deckCenterZ: 0.06, // Front lip at local Z = +0.41 (9cm behind closed doors at Z = +0.50!)
      singleSegment: true,
      skipDeckMesh: true,
      bareLipColor: 0xcbd5e1,
      tierSlotXs: [
        [[-0.48, 0, 0.48], []],
        [[-0.48, 0, 0.48], []],
        [[-0.48, 0, 0.48], []],
      ],
      expectedSlotEans: (tierIdx) => {
        if (tierIdx === 0) return ['30140805'];
        if (tierIdx === 1) return ['30140806'];
        return ['30140807'];
      },
    });

    // 3 Tiers × 3 Multi-Depth Columns (4 slots back-to-front per column!)
    const cabColXs = [-0.48, 0, 0.48];
    const cabTierSpecs: Array<{
      variant: MultiDepthVariantSpec;
      itemH: number;
      itemD: number;
      tierLabel: string;
      initial: Array<Array<'frozen_glace_bac' | 'frozen_cones' | 'frozen_esquimaux' | null>>;
    }> = [
      {
        variant: glaceBacVariant,
        itemH: 0.16,
        itemD: 0.15,
        tierLabel: 'Armoire Glaces — Bacs 1L',
        initial: [
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
      },
      {
        variant: conesVariant,
        itemH: 0.18,
        itemD: 0.14,
        tierLabel: 'Armoire Glaces — Cônes',
        initial: [
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
      },
      {
        variant: esquimauxVariant,
        itemH: 0.17,
        itemD: 0.14,
        tierLabel: 'Armoire Glaces — Esquimaux',
        initial: [
          [null, null, null, null],
          [null, null, null, null],
          [null, null, null, null],
        ],
      },
    ];

    cabTierSpecs.forEach((tSpec, tIdx) => {
      cabColXs.forEach((cx, cIdx) => {
        buildMultiDepthColumn(ctx, cabGroup, cabHelper, tools, {
          id: `ice_cab_t${tIdx}_c${cIdx}`,
          tierName: `${tSpec.tierLabel} · Col. ${cIdx + 1}`,
          x: cx,
          y: tierYs[tIdx],
          shelfBackZ: -0.26,
          shelfFrontZ: 0.37,
          colWidth: 0.42,
          itemHeight: tSpec.itemH,
          itemDepth: tSpec.itemD,
          depthCount: 4,
          variants: [tSpec.variant],
          initialSlots: tSpec.initial[cIdx],
          placementSound: 'frozen',
        });
      });
    });

    // Cold mist pool for cabinet doors
    const cabMist = createMistPoolForGroup(cabGroup, 6);

    // Dual Hinged Opening Tempered-Glass Doors (Left & Right)
    const doorW = 0.75;
    const doorH = 1.62;
    const doorGlassGeo = new THREE.BoxGeometry(doorW - 0.08, doorH - 0.08, 0.016);
    const doorRailTopGeo = new THREE.BoxGeometry(doorW, 0.045, 0.036);
    const doorStileGeo = new THREE.BoxGeometry(0.045, doorH, 0.036);
    const doorHandleBarGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.44, 10);
    const doorHandleStandGeo = new THREE.BoxGeometry(0.02, 0.02, 0.045);
    const doorHitGeo = new THREE.BoxGeometry(doorW, doorH, 0.09);

    ctx.disposables.push(
      doorGlassGeo,
      doorRailTopGeo,
      doorStileGeo,
      doorHandleBarGeo,
      doorHandleStandGeo,
      doorHitGeo
    );

    const buildHingedGlassDoor = (side: 'left' | 'right') => {
      const sign = side === 'left' ? 1 : -1; // local direction from hinge toward door center
      const pivot = new THREE.Group();
      pivot.position.set(side === 'left' ? -0.775 : 0.775, 1.10, cabD / 2 - 0.01);
      cabGroup.add(pivot);

      const centerOffsetX = sign * (doorW / 2);

      const glassPane = new THREE.Mesh(doorGlassGeo, temperedGlassMat);
      glassPane.position.set(centerOffsetX, 0, 0);
      const topRail = new THREE.Mesh(doorRailTopGeo, alumFrameMat);
      topRail.position.set(centerOffsetX, doorH / 2 - 0.022, 0);
      const botRail = new THREE.Mesh(doorRailTopGeo, alumFrameMat);
      botRail.position.set(centerOffsetX, -doorH / 2 + 0.022, 0);
      const stileOuter = new THREE.Mesh(doorStileGeo, alumFrameMat);
      stileOuter.position.set(sign * 0.022, 0, 0);
      const stileInner = new THREE.Mesh(doorStileGeo, alumFrameMat);
      stileInner.position.set(sign * (doorW - 0.022), 0, 0);

      // Vertical brushed-chrome pull handle on inner edge
      const handleX = sign * (doorW - 0.07);
      const handleBar = new THREE.Mesh(doorHandleBarGeo, mats.chrome);
      handleBar.position.set(handleX, -0.02, 0.052);
      const standTop = new THREE.Mesh(doorHandleStandGeo, mats.chrome);
      standTop.position.set(handleX, 0.16, 0.028);
      const standBot = new THREE.Mesh(doorHandleStandGeo, mats.chrome);
      standBot.position.set(handleX, -0.20, 0.028);

      // Subtle frosted lower condensation tint on glass door
      const frostBand = new THREE.Mesh(
        new THREE.PlaneGeometry(doorW - 0.10, 0.14),
        glassFrostRimMat
      );
      frostBand.position.set(centerOffsetX, -doorH / 2 + 0.11, 0.01);
      ctx.disposables.push(frostBand.geometry);

      pivot.add(
        glassPane,
        topRail,
        botRail,
        stileOuter,
        stileInner,
        handleBar,
        standTop,
        standBot,
        frostBand
      );

      // Interactable proxy hitbox parented to door pivot — swings completely out of way when opened!
      const hitMesh = new THREE.Mesh(doorHitGeo, proxyHiddenMat);
      hitMesh.position.set(centerOffsetX, 0, 0.01);
      hitMesh.layers.set(INTERACT_LAYER);
      pivot.add(hitMesh);

      let isOpen = false;
      const openAngle = side === 'left' ? -Math.PI * 0.56 : Math.PI * 0.56;

      const interactItem: InteractableItem = {
        id: `ice_cream_door_${side}`,
        title: `Armoire Vitrée Glaces — Porte ${side === 'left' ? 'Gauche' : 'Droite'}`,
        subtitle: 'Porte vitrée grand froid (-18.5 °C)',
        kind: 'diegetic_action',
        state: false,
        inspectText: 'Porte double vitrage antibuée à joint magnétique grand froid (-18.5 °C).',
        proxyMesh: hitMesh,
        dynamicSubtitle: () =>
          isOpen
            ? 'Porte vitrée ouverte — Accès libre aux 3 étagères glaces et réglettes prix'
            : 'Porte fermée (-18.5 °C) — Appuyez pour ouvrir et réapprovisionner les glaces',
        dynamicVerb: () => (isOpen ? 'FERMER LA PORTE VITRÉE' : 'OUVRIR LA PORTE VITRÉE'),
        onInteract: () => {
          if (!acquireFreezerLock()) return;
          isOpen = !isOpen;
          soundSynth.playFreezerDoorSeal(isOpen);
          triggerMistBurst(cabMist, side === 'left' ? -0.36 : 0.36, 0.95, 0.48, 0.45, 0.24);
        },
      };
      hitMesh.userData.interactable = interactItem;
      ctx.interactables.push(interactItem);

      animatedDoors.push({
        pivot,
        getTargetAngle: () => (isOpen ? openAngle : 0),
      });
    };

    buildHingedGlassDoor('left');
    buildHingedGlassDoor('right');

    // Solid world-space AABB collider matching rotated cabinet footprint
    addBoxCollider(
      ctx,
      'ice_cream_cabinet_col',
      -6.5 - cabD / 2 - 0.02,
      -6.5 + cabD / 2 + 0.02,
      cabZPos - cabW / 2 - 0.02,
      cabZPos + cabW / 2 + 0.02
    );
  }

  // ============================================================================
  // 6. PER-FRAME ANIMATION LOOP (SLIDING LIDS, HINGED DOORS & COLD MIST PUFFS)
  // ============================================================================
  ctx.updaters.push({
    update: (dt) => {
      for (let i = 0; i < animatedSliders.length; i++) {
        const s = animatedSliders[i];
        const [tL, tR] = s.getTargets();
        s.leftLid.position.x = THREE.MathUtils.damp(s.leftLid.position.x, tL, 9.5, dt);
        s.rightLid.position.x = THREE.MathUtils.damp(s.rightLid.position.x, tR, 9.5, dt);
      }

      for (let i = 0; i < animatedDoors.length; i++) {
        const d = animatedDoors[i];
        d.pivot.rotation.y = THREE.MathUtils.damp(d.pivot.rotation.y, d.getTargetAngle(), 8.5, dt);
      }

      for (let i = 0; i < mistPuffs.length; i++) {
        const p = mistPuffs[i];
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.life = 0;
          p.mesh.visible = false;
          p.mat.opacity = 0;
          continue;
        }
        const progress = 1 - p.life / p.maxLife;
        p.mesh.position.x += p.vx * dt;
        // Cold air briefly rises then sinks gently like real -18°C freezer vapor
        p.mesh.position.y += (p.vy - progress * 0.24) * dt;
        p.mesh.position.z += p.vz * dt;
        const scale = p.baseScale * (1 + progress * 0.9);
        p.mesh.scale.setScalar(scale);
        const fadeIn = Math.min(1, progress * 5);
        const fadeOut = 1 - progress;
        p.mat.opacity = fadeIn * fadeOut * 0.52;
      }
    },
  });
}
