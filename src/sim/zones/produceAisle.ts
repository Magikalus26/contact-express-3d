import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { INTERACT_LAYER, ProceduralTextureBank } from '../textures';
import { HeldItemHudInfo, InteractableItem, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import { soundSynth } from '../audio';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

const PRODUCE_ACTION_COOLDOWN_MS = 320;

interface ProduceScalePluDef {
  keyNum: number;
  kind: HeldItemHudInfo['kind'];
  ean: string;
  shortLabel: string;
  fullName: string;
  priceCents: number; // Franc centimes per kg (or fixed pack price for Bintje 2.5kg)
  isPerKg: boolean;
  defaultWeightKg: number;
  priceText: string;
  iconBg: string;
  iconFg: string;
}

const PRODUCE_SCALE_PLUS: ProduceScalePluDef[] = [
  {
    keyNum: 1,
    kind: 'produce_pommes',
    ean: '30140901',
    shortLabel: 'POMMES',
    fullName: 'Pommes Golden de France',
    priceCents: 980,
    isPerKg: true,
    defaultWeightKg: 1.14,
    priceText: '9,80 ₣/kg',
    iconBg: '#ecfccb',
    iconFg: '#65a30d',
  },
  {
    keyNum: 2,
    kind: 'produce_bananes',
    ean: '30140902',
    shortLabel: 'BANANES',
    fullName: 'Bananes des Antilles',
    priceCents: 1150,
    isPerKg: true,
    defaultWeightKg: 0.92,
    priceText: '11,50 ₣/kg',
    iconBg: '#fef9c3',
    iconFg: '#ca8a04',
  },
  {
    keyNum: 3,
    kind: 'produce_oranges',
    ean: '30140903',
    shortLabel: 'ORANGES',
    fullName: 'Oranges à Jus',
    priceCents: 890,
    isPerKg: true,
    defaultWeightKg: 1.36,
    priceText: '8,90 ₣/kg',
    iconBg: '#ffedd5',
    iconFg: '#ea580c',
  },
  {
    keyNum: 4,
    kind: 'produce_tomates',
    ean: '30140904',
    shortLabel: 'TOMATES',
    fullName: 'Tomates Rondes en Grappe',
    priceCents: 1240,
    isPerKg: true,
    defaultWeightKg: 0.86,
    priceText: '12,40 ₣/kg',
    iconBg: '#fee2e2',
    iconFg: '#dc2626',
  },
  {
    keyNum: 5,
    kind: 'produce_carottes',
    ean: '30140905',
    shortLabel: 'CAROTTES',
    fullName: 'Carottes Nouvelles Lavées',
    priceCents: 650,
    isPerKg: true,
    defaultWeightKg: 1.08,
    priceText: '6,50 ₣/kg',
    iconBg: '#ffedd5',
    iconFg: '#c2410c',
  },
  {
    keyNum: 6,
    kind: 'produce_pommes_de_terre',
    ean: '30140906',
    shortLabel: 'P. DE TERRE',
    fullName: 'Pommes de Terre Bintje (2,5kg)',
    priceCents: 1400,
    isPerKg: false,
    defaultWeightKg: 2.5,
    priceText: '14,00 ₣',
    iconBg: '#fef3c7',
    iconFg: '#92400e',
  },
];

function formatFrancs(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const whole = Math.floor(safe / 100);
  const dec = (safe % 100).toString().padStart(2, '0');
  return `${whole},${dec} ₣`;
}

/**
 * V16 DEPARTMENT 1 — "RAYON 1 — PRIMEUR : FRUITS & LÉGUMES (1990)"
 * Positioned right of the entrance (X = +1.72..+5.19, Z = +4.22..+5.54):
 * - Double-Sided 3-Tier Sloped Wooden Produce Market Stand ("Étalage Primeur Bois 1990")
 *   with classic forest-green & cream market awning valance & bare front price-holder edges
 *   (zero pre-installed plastic rails or price tags at start!)
 * - Multi-Depth Back-to-Front Crate & Bag Stocking (3 slots deep + [FAIRE LE FACING])
 *   with inclined slatted wooden display bins for Pommes Golden, Bananes, Oranges, Tomates,
 *   Carottes and lower deck for Pommes de Terre Bintje 2,5kg sacks
 * - 100% Diegetic 3D 1990 Self-Service Produce Weighing Scale ("Balance Primeur Libre-Service 1990"):
 *   stainless pan, VFD green-segment readout, 6 protruding 3D physical pictogram keys ([1]..[6]),
 *   and side thermal weight-price barcode sticker printer ([PRENDRE L'ÉTIQUETTE-POIDS])!
 * - Strict 320ms single-press touch debounce, shared geometries/materials, locked 60 FPS on iPhone 16e.
 */
export function buildProduceAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const deptRoot = new THREE.Group();
  root.add(deptRoot);

  // ============================================================================
  // 1. SHARED MATERIALS & PROCEDURAL PRODUCE CRATE / BAG MESH BUILDERS
  // ============================================================================
  const marketGreenMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.62 });
  const awningCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.68 });
  const poplarCrateMat = new THREE.MeshStandardMaterial({ color: 0xd6b482, roughness: 0.78 });
  const crateCornerMat = new THREE.MeshStandardMaterial({ color: 0xa67c52, roughness: 0.82 });
  const appleGoldenMat = new THREE.MeshStandardMaterial({ color: 0xbef264, roughness: 0.34 });
  const appleBlushMat = new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.38 });
  const bananaYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.42 });
  const bananaTipMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.6 });
  const orangeFruitMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 });
  const tomatoRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.28 });
  const vineGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.58 });
  const carrotOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.48 });
  const burlapMat = new THREE.MeshStandardMaterial({ color: 0xb0906a, roughness: 0.92 });
  const potatoBandMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 });
  const scaleBeigeMat = new THREE.MeshStandardMaterial({ color: 0xdad4c8, roughness: 0.48 });
  const scaleDarkMat = new THREE.MeshStandardMaterial({ color: 0x1e242b, roughness: 0.68 });
  const produceRollMat = new THREE.MeshStandardMaterial({
    color: 0xbbf7d0,
    transparent: true,
    opacity: 0.68,
    roughness: 0.32,
  });
  const proxyHiddenMat = new THREE.MeshBasicMaterial({ visible: false });

  ctx.disposables.push(
    marketGreenMat,
    awningCreamMat,
    poplarCrateMat,
    crateCornerMat,
    appleGoldenMat,
    appleBlushMat,
    bananaYellowMat,
    bananaTipMat,
    orangeFruitMat,
    tomatoRedMat,
    vineGreenMat,
    carrotOrangeMat,
    burlapMat,
    potatoBandMat,
    scaleBeigeMat,
    scaleDarkMat,
    produceRollMat,
    proxyHiddenMat
  );

  // Shared geometries for wooden produce crates & fruits (reused across all depth slots!)
  const crateFloorGeo = new THREE.BoxGeometry(0.46, 0.014, 0.145);
  const crateWallLongGeo = new THREE.BoxGeometry(0.46, 0.072, 0.012);
  const crateWallShortGeo = new THREE.BoxGeometry(0.012, 0.072, 0.13);
  const cratePostGeo = new THREE.BoxGeometry(0.02, 0.095, 0.02);
  const fruitSphereGeo = new THREE.SphereGeometry(0.036, 9, 7);
  const bananaArcGeo = new THREE.TorusGeometry(0.052, 0.016, 7, 10, Math.PI * 0.78);
  const carrotConeGeo = new THREE.ConeGeometry(0.017, 0.13, 8);
  const vineStemGeo = new THREE.BoxGeometry(0.28, 0.01, 0.012);
  const potatoSackGeo = new THREE.BoxGeometry(0.34, 0.19, 0.14);
  const potatoNeckGeo = new THREE.CylinderGeometry(0.052, 0.08, 0.045, 10);

  ctx.disposables.push(
    crateFloorGeo,
    crateWallLongGeo,
    crateWallShortGeo,
    cratePostGeo,
    fruitSphereGeo,
    bananaArcGeo,
    carrotConeGeo,
    vineStemGeo,
    potatoSackGeo,
    potatoNeckGeo
  );

  // Procedural front label strip texture for Bintje 2.5kg burlap sacks
  const potatoLblCanvas = document.createElement('canvas');
  potatoLblCanvas.width = 256;
  potatoLblCanvas.height = 128;
  const plc = potatoLblCanvas.getContext('2d')!;
  plc.fillStyle = '#fef3c7';
  plc.fillRect(0, 0, 256, 128);
  plc.fillStyle = '#15803d';
  plc.fillRect(0, 0, 256, 28);
  plc.fillStyle = '#ffffff';
  plc.font = '800 15px "Plus Jakarta Sans", sans-serif';
  plc.textAlign = 'center';
  plc.fillText('POMMES DE TERRE BINTJE', 128, 20);
  plc.fillStyle = '#78350f';
  plc.font = '800 16px "JetBrains Mono", monospace';
  plc.fillText('SAC 2,5 KG · 14,00 ₣', 128, 52);
  plc.textAlign = 'left';
  drawEanBarcode(plc, '30140906', 28, 62, 200, 58, {
    showDigits: true,
    bgColor: '#ffffff',
    barColor: '#0f172a',
  });
  const potatoLblTex = new THREE.CanvasTexture(potatoLblCanvas);
  potatoLblTex.colorSpace = THREE.SRGBColorSpace;
  const potatoLblMat = new THREE.MeshStandardMaterial({ map: potatoLblTex, roughness: 0.72 });
  const potatoLblPlaneGeo = new THREE.PlaneGeometry(0.26, 0.12);
  ctx.disposables.push(potatoLblTex, potatoLblMat, potatoLblPlaneGeo);

  // Helper building a slotted wooden produce crate ("Cagette Primeur")
  const buildSlattedCrateShell = (crateMat = poplarCrateMat): THREE.Group => {
    const g = new THREE.Group();
    const fl = new THREE.Mesh(crateFloorGeo, crateMat);
    fl.position.y = 0.008;
    const wF = new THREE.Mesh(crateWallLongGeo, crateMat);
    wF.position.set(0, 0.048, 0.068);
    const wB = new THREE.Mesh(crateWallLongGeo, crateMat);
    wB.position.set(0, 0.048, -0.068);
    const wL = new THREE.Mesh(crateWallShortGeo, crateMat);
    wL.position.set(-0.224, 0.048, 0);
    const wR = new THREE.Mesh(crateWallShortGeo, crateMat);
    wR.position.set(0.224, 0.048, 0);
    g.add(fl, wF, wB, wL, wR);
    [
      [-0.22, -0.064],
      [0.22, -0.064],
      [-0.22, 0.064],
      [0.22, 0.064],
    ].forEach(([px, pz]) => {
      const p = new THREE.Mesh(cratePostGeo, crateCornerMat);
      p.position.set(px, 0.05, pz);
      g.add(p);
    });
    return g;
  };

  // Multi-depth Variant Specs for all 6 V16 Produce Items
  const pommesVariant: MultiDepthVariantSpec = {
    kind: 'produce_pommes',
    ean: '30140901',
    label: 'Pommes Golden de France',
    sublabel: 'Rayon 1 Primeur · 9,80 ₣/kg',
    buildMesh: () => {
      const g = buildSlattedCrateShell();
      for (let i = 0; i < 5; i++) {
        const ax = -0.16 + i * 0.08;
        [-0.025, 0.025].forEach((az, zIdx) => {
          const m = new THREE.Mesh(fruitSphereGeo, (i + zIdx) % 2 === 0 ? appleGoldenMat : appleBlushMat);
          m.position.set(ax, 0.065 + (zIdx === 0 ? 0.012 : 0), az);
          m.scale.set(1, 0.92, 1);
          g.add(m);
        });
      }
      return g;
    },
  };

  const bananesVariant: MultiDepthVariantSpec = {
    kind: 'produce_bananes',
    ean: '30140902',
    label: 'Bananes des Antilles',
    sublabel: 'Rayon 1 Primeur · 11,50 ₣/kg',
    buildMesh: () => {
      const g = buildSlattedCrateShell(mats.cardboard);
      for (let i = 0; i < 4; i++) {
        const bx = -0.14 + i * 0.092;
        const b1 = new THREE.Mesh(bananaArcGeo, bananaYellowMat);
        b1.position.set(bx, 0.072, -0.015);
        b1.rotation.set(0.35, i * 0.3, 0.45);
        const b2 = new THREE.Mesh(bananaArcGeo, bananaYellowMat);
        b2.position.set(bx + 0.016, 0.082, 0.018);
        b2.rotation.set(0.5, i * 0.25 + 0.4, 0.55);
        g.add(b1, b2);
      }
      return g;
    },
  };

  const orangesVariant: MultiDepthVariantSpec = {
    kind: 'produce_oranges',
    ean: '30140903',
    label: 'Oranges à Jus',
    sublabel: 'Rayon 1 Primeur · 8,90 ₣/kg',
    buildMesh: () => {
      const g = buildSlattedCrateShell();
      for (let i = 0; i < 5; i++) {
        const ox = -0.16 + i * 0.08;
        [-0.025, 0.025].forEach((oz, zIdx) => {
          const m = new THREE.Mesh(fruitSphereGeo, orangeFruitMat);
          m.position.set(ox, 0.068 + (zIdx === 1 ? 0.01 : 0), oz);
          g.add(m);
        });
      }
      return g;
    },
  };

  const tomatesVariant: MultiDepthVariantSpec = {
    kind: 'produce_tomates',
    ean: '30140904',
    label: 'Tomates Rondes en Grappe',
    sublabel: 'Rayon 1 Primeur · 12,40 ₣/kg',
    buildMesh: () => {
      const g = buildSlattedCrateShell();
      for (let i = 0; i < 5; i++) {
        const tx = -0.155 + i * 0.078;
        [-0.024, 0.024].forEach((tz) => {
          const m = new THREE.Mesh(fruitSphereGeo, tomatoRedMat);
          m.scale.set(1, 0.85, 1);
          m.position.set(tx, 0.06, tz);
          g.add(m);
        });
      }
      const stem = new THREE.Mesh(vineStemGeo, vineGreenMat);
      stem.position.set(0, 0.096, 0);
      g.add(stem);
      return g;
    },
  };

  const carottesVariant: MultiDepthVariantSpec = {
    kind: 'produce_carottes',
    ean: '30140905',
    label: 'Carottes Nouvelles Lavées',
    sublabel: 'Rayon 1 Primeur · 6,50 ₣/kg',
    buildMesh: () => {
      const g = buildSlattedCrateShell();
      for (let i = 0; i < 6; i++) {
        const cx = -0.15 + i * 0.06;
        const c1 = new THREE.Mesh(carrotConeGeo, carrotOrangeMat);
        c1.rotation.z = Math.PI / 2 - 0.14;
        c1.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.2;
        c1.position.set(cx, 0.064, -0.022);
        const c2 = new THREE.Mesh(carrotConeGeo, carrotOrangeMat);
        c2.rotation.z = Math.PI / 2 + 0.12;
        c2.position.set(cx, 0.072, 0.022);
        g.add(c1, c2);
      }
      const foliage = new THREE.Mesh(vineStemGeo, vineGreenMat);
      foliage.position.set(-0.14, 0.088, 0);
      foliage.scale.set(0.45, 1.8, 2.2);
      g.add(foliage);
      return g;
    },
  };

  const pdtVariant: MultiDepthVariantSpec = {
    kind: 'produce_pommes_de_terre',
    ean: '30140906',
    label: 'Pommes de Terre Bintje (Sac 2,5kg)',
    sublabel: 'Rayon 1 Primeur · 14,00 ₣',
    buildMesh: () => {
      const g = new THREE.Group();
      const sack = new THREE.Mesh(potatoSackGeo, burlapMat);
      sack.position.y = 0.095;
      const neck = new THREE.Mesh(potatoNeckGeo, potatoBandMat);
      neck.position.y = 0.21;
      const lbl = new THREE.Mesh(potatoLblPlaneGeo, potatoLblMat);
      lbl.position.set(0, 0.1, 0.072);
      g.add(sack, neck, lbl);
      return g;
    },
  };

  // ============================================================================
  // 2. OVERHEAD DEPARTMENT SIGN ("RAYON 1 — PRIMEUR : FRUITS & LÉGUMES")
  // ============================================================================
  {
    const signTex = texBank.createDepartmentSignTexture(
      'RAYON 1 — PRIMEUR · FRUITS & LÉGUMES',
      'ARRIVAGE DU JOUR · ÉTALAGES BOIS · BALANCE LIBRE-SERVICE 1990',
      '#14532d',
      '#a3e635'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.36 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.48, 0.08), [
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      signMat,
      signMat,
    ]);
    signMesh.position.set(3.55, 2.74, 4.9);
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6);
    const r1 = new THREE.Mesh(rodGeo, mats.chrome);
    r1.position.set(2.45, 3.25, 4.9);
    const r2 = new THREE.Mesh(rodGeo, mats.chrome);
    r2.position.set(4.65, 3.25, 4.9);
    deptRoot.add(signMesh, r1, r2);
    ctx.disposables.push(signTex, signMat, signMesh.geometry, rodGeo);
  }

  // ============================================================================
  // 3. DOUBLE-SIDED 3-TIER SLOPED WOODEN PRODUCE MARKET STAND
  //    Center: (3.85, 0, 4.95) — Length 2.64m (X = 2.53..5.17), Depth 1.12m (Z = 4.39..5.51)
  // ============================================================================
  {
    const standRoot = new THREE.Group();
    standRoot.position.set(3.85, 0, 4.95);
    deptRoot.add(standRoot);

    const standW = 2.60;

    // Central rustic timber spine, wooden plinth & side market end panels
    const spine = new THREE.Mesh(new THREE.BoxGeometry(standW, 1.94, 0.08), mats.rusticWood);
    spine.position.y = 0.97;
    spine.castShadow = true;
    spine.receiveShadow = true;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(standW + 0.04, 0.22, 1.10), mats.rusticWood);
    plinth.position.y = 0.11;
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const sideCheekGeo = new THREE.BoxGeometry(0.055, 1.88, 1.12);
    const sideL = new THREE.Mesh(sideCheekGeo, mats.rusticWood);
    sideL.position.set(-standW / 2 - 0.025, 0.96, 0);
    const sideR = new THREE.Mesh(sideCheekGeo, mats.rusticWood);
    sideR.position.set(standW / 2 + 0.025, 0.96, 0);

    // Classic 1990 French market canopy awning valance (alternating forest green & cream stripes!)
    const awningTop = new THREE.Mesh(new THREE.BoxGeometry(standW + 0.14, 0.08, 1.24), marketGreenMat);
    awningTop.position.y = 1.96;
    const stripeGeo = new THREE.BoxGeometry(0.26, 0.16, 1.26);
    for (let sx = -1.17; sx <= 1.18; sx += 0.26) {
      const idx = Math.round((sx + 1.17) / 0.26);
      const st = new THREE.Mesh(stripeGeo, idx % 2 === 0 ? marketGreenMat : awningCreamMat);
      st.position.set(sx, 1.88, 0);
      standRoot.add(st);
    }

    standRoot.add(spine, plinth, sideL, sideR, awningTop);
    ctx.disposables.push(spine.geometry, plinth.geometry, sideCheekGeo, awningTop.geometry, stripeGeo);

    // Sloped oak bin deck geometry (tilted toward the aisle for tiers 1 & 2)
    const slopedDeckGeo = new THREE.BoxGeometry(standW - 0.02, 0.028, 0.50);
    const flatLowerDeckGeo = new THREE.BoxGeometry(standW - 0.02, 0.028, 0.50);
    const retainerLipGeo = new THREE.BoxGeometry(standW - 0.02, 0.045, 0.018);
    ctx.disposables.push(slopedDeckGeo, flatLowerDeckGeo, retainerLipGeo);

    const buildProduceStandFace = (
      sideTag: 'north' | 'south',
      rotY: number,
      midLeft: MultiDepthVariantSpec,
      midRight: MultiDepthVariantSpec,
      topLeft: MultiDepthVariantSpec,
      topRight: MultiDepthVariantSpec
    ) => {
      const faceGroup = new THREE.Group();
      faceGroup.rotation.y = rotY;
      standRoot.add(faceGroup);

      // Tier 0 (Y = 0.24): Flat lower deck for 2.5kg Potato Sacks
      const d0 = new THREE.Mesh(flatLowerDeckGeo, mats.oakWood);
      d0.position.set(0, 0.226, 0.29);
      d0.receiveShadow = true;
      faceGroup.add(d0);

      // Tier 1 (Y = 0.78) & Tier 2 (Y = 1.32): Gently sloped wooden market bins (tilt = 0.15 rad)
      [0.78, 1.32].forEach((ty) => {
        const slopedDeck = new THREE.Mesh(slopedDeckGeo, mats.oakWood);
        slopedDeck.position.set(0, ty + 0.036, 0.29);
        slopedDeck.rotation.x = 0.15;
        slopedDeck.receiveShadow = true;
        // Front oak wooden crate-retainer rail along front lip (Z = 0.53)
        const retainer = new THREE.Mesh(retainerLipGeo, mats.rusticWood);
        retainer.position.set(0, ty + 0.018, 0.53);
        faceGroup.add(slopedDeck, retainer);
      });

      // Bare front display edges at game start (zero pre-installed rails or price tags!)
      const colXs = [-0.94, -0.32, 0.32, 0.94];
      const helper = buildBareShelfWithInstallableRails(ctx, faceGroup, mats, tools, {
        idPrefix: `produce_${sideTag}`,
        shelfYs: [0.24, 0.78, 1.32],
        shelfNames: [
          `Primeur (${sideTag === 'north' ? 'Nord' : 'Sud'}) — Étage Bas`,
          `Primeur (${sideTag === 'north' ? 'Nord' : 'Sud'}) — Étage Central`,
          `Primeur (${sideTag === 'north' ? 'Nord' : 'Sud'}) — Étage Haut`,
        ],
        shelfWidth: 2.54,
        shelfDepth: 0.50,
        skipDeckMesh: true,
        bareLipColor: 0x8c6239,
        tierSlotXs: [
          [
            [-0.94, -0.32],
            [0.32, 0.94],
          ],
          [
            [-0.94, -0.32],
            [0.32, 0.94],
          ],
          [
            [-0.94, -0.32],
            [0.32, 0.94],
          ],
        ],
        expectedSlotEans: (tierIdx, sideKey) => {
          if (tierIdx === 0) return ['30140906'];
          if (tierIdx === 1) return sideKey === 'L' ? [midLeft.ean] : [midRight.ean];
          return sideKey === 'L' ? [topLeft.ean] : [topRight.ean];
        },
      });

      // Tier 0 (Étage Bas): 4 Multi-Depth Columns of Pommes de Terre Bintje 2.5kg sacks (100% EMPTY AT START)
      colXs.forEach((cx, idx) => {
        buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
          id: `produce_${sideTag}_t0_c${idx}`,
          tierName: 'Étage Bas — Pommes de Terre 2,5kg',
          x: cx,
          y: 0.242,
          shelfBackZ: 0.05,
          shelfFrontZ: 0.52,
          colWidth: 0.56,
          itemHeight: 0.24,
          itemDepth: 0.145,
          depthCount: 3,
          variants: [pdtVariant],
          initialSlots: [null, null, null],
          placementSound: 'produce',
        });
      });

      // Tier 1 (Étage Central — Sloped Wooden Bin): 2 Left + 2 Right columns (100% EMPTY AT START)
      colXs.forEach((cx, idx) => {
        const spec = idx < 2 ? midLeft : midRight;
        buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
          id: `produce_${sideTag}_t1_c${idx}`,
          tierName: `Étage Central — ${spec.label}`,
          x: cx,
          y: 0.785,
          shelfBackZ: 0.06,
          shelfFrontZ: 0.515,
          colWidth: 0.56,
          itemHeight: 0.16,
          itemDepth: 0.145,
          depthCount: 3,
          variants: [spec],
          initialSlots: [null, null, null],
          placementSound: 'produce',
          slotTiltX: 0.15,
          slopeRisePerZ: 0.152,
        });
      });

      // Tier 2 (Étage Haut — Sloped Wooden Bin): 2 Left + 2 Right columns (100% EMPTY AT START)
      colXs.forEach((cx, idx) => {
        const spec = idx < 2 ? topLeft : topRight;
        buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
          id: `produce_${sideTag}_t2_c${idx}`,
          tierName: `Étage Haut — ${spec.label}`,
          x: cx,
          y: 1.325,
          shelfBackZ: 0.06,
          shelfFrontZ: 0.515,
          colWidth: 0.56,
          itemHeight: 0.16,
          itemDepth: 0.145,
          depthCount: 3,
          variants: [spec],
          initialSlots: [null, null, null],
          placementSound: 'produce',
          slotTiltX: 0.15,
          slopeRisePerZ: 0.152,
        });
      });
    };

    // North Face (facing -Z toward store aisles): Pommes, Oranges, Bananes, Tomates + Pommes de Terre
    buildProduceStandFace('north', Math.PI, pommesVariant, orangesVariant, bananesVariant, tomatesVariant);
    // South Face (facing +Z toward entrance): Carottes, Tomates, Pommes, Bananes + Pommes de Terre
    buildProduceStandFace('south', 0, carottesVariant, tomatesVariant, pommesVariant, bananesVariant);

    addBoxCollider(ctx, 'produce_stand_col', 2.50, 5.20, 4.36, 5.54);
  }

  // ============================================================================
  // 4. 100% DIEGETIC 3D 1990 SELF-SERVICE PRODUCE WEIGHING SCALE
  //    ("BALANCE PRIMEUR LIBRE-SERVICE 1990") at X = 2.02, Z = 4.65
  //    - Stainless weighing pan, VFD green-segment readout, 6 protruding 3D pictogram keys,
  //      side thermal adhesive barcode weight-price sticker printer, and 320ms debounce!
  // ============================================================================
  {
    const scaleStand = new THREE.Group();
    scaleStand.position.set(2.02, 0, 4.65);
    scaleStand.rotation.y = Math.PI * 0.85; // Faces North-West toward entrance & main aisle
    deptRoot.add(scaleStand);

    let lastScaleAction = 0;
    const acquireScaleLock = (): boolean => {
      const now = performance.now();
      if (now - lastScaleAction < PRODUCE_ACTION_COOLDOWN_MS) return false;
      lastScaleAction = now;
      return true;
    };

    // Sturdy rustic-wood & anthracite pedestal stand + integrated roll of produce bags
    const pedFoot = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.06, 0.50), scaleDarkMat);
    pedFoot.position.y = 0.03;
    const pedCol = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.82, 0.38), mats.rusticWood);
    pedCol.position.y = 0.45;
    pedCol.castShadow = true;
    pedCol.receiveShadow = true;
    const pedTable = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.045, 0.50), mats.oakWood);
    pedTable.position.y = 0.88;
    pedTable.castShadow = true;

    // Chrome side dispenser arm holding a translucent roll of produce bags
    const rollArm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 8), mats.chrome);
    rollArm.rotation.z = Math.PI / 2;
    rollArm.position.set(-0.34, 0.78, 0.06);
    const bagRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.18, 12), produceRollMat);
    bagRoll.rotation.z = Math.PI / 2;
    bagRoll.position.set(-0.36, 0.78, 0.06);

    scaleStand.add(pedFoot, pedCol, pedTable, rollArm, bagRoll);
    ctx.disposables.push(
      pedFoot.geometry,
      pedCol.geometry,
      pedTable.geometry,
      rollArm.geometry,
      bagRoll.geometry
    );

    // 1990 Electronic Scale Housing resting on pedestal table (Y = 0.90)
    const scaleRoot = new THREE.Group();
    scaleRoot.position.set(0, 0.902, 0);
    scaleStand.add(scaleRoot);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.088, 0.38), scaleBeigeMat);
    chassis.position.set(0, 0.044, 0.01);
    chassis.castShadow = true;

    // Sloped front keypad console for the 6 protruding 3D pictogram keys
    const keyDeck = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.045, 0.19), scaleDarkMat);
    keyDeck.position.set(0, 0.072, 0.16);
    keyDeck.rotation.x = 0.46;

    // Stainless-steel weighing pan with raised rear lip
    const panBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.018, 0.24), mats.stainless);
    panBase.position.set(-0.02, 0.102, -0.05);
    const panRim = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.022, 0.014), mats.stainless);
    panRim.position.set(-0.02, 0.114, -0.168);

    // Side thermal weight-price sticker printer + paper exit slot
    const printerHousing = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.105, 0.22), scaleDarkMat);
    printerHousing.position.set(0.245, 0.055, -0.02);
    const printerSlotMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const printerSlot = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.016, 0.11), printerSlotMat);
    printerSlot.position.set(0.301, 0.068, -0.02);

    // Chrome display pole + VFD Green-Segment Readout Head
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.42, 10), mats.chrome);
    pole.position.set(-0.18, 0.28, -0.14);
    const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.058), scaleDarkMat);
    headBox.position.set(0, 0.48, -0.14);

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
      emissiveIntensity: 0.78,
      roughness: 0.22,
    });
    const vfdFront = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.138), vfdMat);
    vfdFront.position.set(0, 0.48, -0.109);
    const vfdBack = new THREE.Mesh(new THREE.PlaneGeometry(0.39, 0.138), vfdMat);
    vfdBack.rotation.y = Math.PI;
    vfdBack.position.set(0, 0.48, -0.171);

    scaleRoot.add(
      chassis,
      keyDeck,
      panBase,
      panRim,
      printerHousing,
      printerSlot,
      pole,
      headBox,
      vfdFront,
      vfdBack
    );
    ctx.disposables.push(
      chassis.geometry,
      keyDeck.geometry,
      panBase.geometry,
      panRim.geometry,
      printerHousing.geometry,
      printerSlot.geometry,
      printerSlotMat,
      pole.geometry,
      headBox.geometry,
      vfdTex,
      vfdMat,
      vfdFront.geometry,
      vfdBack.geometry
    );

    // Visual produce meshes resting on the stainless weighing pan (toggled by panItemKind!)
    const panMeshes = new Map<HeldItemHudInfo['kind'], THREE.Object3D>();
    const panMeshSpecs: Array<{ kind: HeldItemHudInfo['kind']; build: () => THREE.Object3D; scale: number }> = [
      { kind: 'produce_pommes', build: pommesVariant.buildMesh, scale: 0.68 },
      { kind: 'produce_bananes', build: bananesVariant.buildMesh, scale: 0.68 },
      { kind: 'produce_oranges', build: orangesVariant.buildMesh, scale: 0.68 },
      { kind: 'produce_tomates', build: tomatesVariant.buildMesh, scale: 0.68 },
      { kind: 'produce_carottes', build: carottesVariant.buildMesh, scale: 0.68 },
      { kind: 'produce_pommes_de_terre', build: pdtVariant.buildMesh, scale: 0.85 },
    ];
    panMeshSpecs.forEach((sp) => {
      const m = sp.build();
      m.position.set(-0.02, 0.112, -0.05);
      m.scale.setScalar(sp.scale);
      m.visible = false;
      scaleRoot.add(m);
      panMeshes.set(sp.kind, m);
    });

    // Dynamic thermal adhesive weight-price barcode sticker emerging from side printer slot
    const stickerCanvas = document.createElement('canvas');
    stickerCanvas.width = 256;
    stickerCanvas.height = 176;
    const stickerTex = new THREE.CanvasTexture(stickerCanvas);
    stickerTex.colorSpace = THREE.SRGBColorSpace;
    stickerTex.anisotropy = ctx.maxAnisotropy;
    const stickerMat = new THREE.MeshStandardMaterial({
      map: stickerTex,
      emissiveMap: stickerTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.18,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });
    const extrudedStickerMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.074), stickerMat);
    extrudedStickerMesh.rotation.x = -Math.PI / 2;
    extrudedStickerMesh.position.set(0.325, 0.072, -0.02);
    extrudedStickerMesh.visible = false;
    scaleRoot.add(extrudedStickerMesh);
    ctx.disposables.push(stickerTex, stickerMat, extrudedStickerMesh.geometry);

    // Electronic Scale State
    let panKind: HeldItemHudInfo['kind'] | null = null;
    let panWeightKg = 0;
    let activePlu: ProduceScalePluDef | null = null;
    let printedStickerInfo: {
      plu: ProduceScalePluDef;
      weightKg: number;
      totalCents: number;
    } | null = null;
    let stickerExtrudeAnim = 0;
    let statusLine = 'POSEZ UN ARTICLE · APPUYEZ SUR LA TOUCHE [1-6]';

    const computeTotalCents = (plu: ProduceScalePluDef, weightKg: number): number =>
      plu.isPerKg ? Math.round(weightKg * plu.priceCents) : plu.priceCents;

    const drawWeightSticker = (plu: ProduceScalePluDef, weightKg: number, totalCents: number) => {
      const c = stickerCanvas.getContext('2d')!;
      c.fillStyle = '#fffef8';
      c.fillRect(0, 0, 256, 176);
      c.fillStyle = '#14532d';
      c.fillRect(0, 0, 256, 30);
      c.fillStyle = '#ffffff';
      c.font = '800 14px "Plus Jakarta Sans", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(`CONTACT EXPRESS · PRIMEUR [${plu.keyNum}]`, 128, 15);

      c.fillStyle = '#0f172a';
      c.font = '800 15px "JetBrains Mono", monospace';
      c.fillText(plu.fullName.slice(0, 24).toUpperCase(), 128, 48);

      c.font = '700 13px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText(`POIDS: ${weightKg.toFixed(3)} kg`, 14, 70);
      c.textAlign = 'right';
      c.fillText(plu.priceText, 242, 70);

      c.fillStyle = '#15803d';
      c.font = '900 24px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(`TOTAL : ${formatFrancs(totalCents)}`, 128, 98);

      drawEanBarcode(c, plu.ean, 28, 114, 200, 56, {
        showDigits: true,
        bgColor: '#fffef8',
        barColor: '#0f172a',
      });
      stickerTex.needsUpdate = true;
    };

    const redrawVfd = () => {
      const c = vfdCanvas.getContext('2d')!;
      c.fillStyle = '#06120c';
      c.fillRect(0, 0, 512, 192);
      c.strokeStyle = '#334155';
      c.lineWidth = 6;
      c.strokeRect(4, 4, 504, 184);

      // Top header bar
      c.fillStyle = '#0f291c';
      c.fillRect(10, 10, 492, 32);
      c.fillStyle = '#86efac';
      c.font = '800 16px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText('BALANCE PRIMEUR 1990 · LIBRE-SERVICE', 20, 31);
      c.textAlign = 'right';
      c.fillText(activePlu ? `PLU [${activePlu.keyNum}] ${activePlu.shortLabel}` : 'PRÊT', 492, 31);

      // 3 Classic Green VFD Numeric Segment Boxes (POIDS | PRIX/KG | TOTAL)
      const weightText = `${panWeightKg.toFixed(3)} kg`;
      const unitPriceText = activePlu ? activePlu.priceText.replace('/kg', '') : '00,00 ₣';
      const totalCents = activePlu && panWeightKg > 0 ? computeTotalCents(activePlu, panWeightKg) : 0;
      const totalText = formatFrancs(totalCents);

      const cols: Array<{ label: string; value: string; x: number; w: number; highlight?: boolean }> = [
        { label: 'POIDS (KG)', value: weightText, x: 14, w: 154 },
        { label: activePlu && !activePlu.isPerKg ? 'PRIX SAC' : 'PRIX / KG', value: unitPriceText, x: 178, w: 154 },
        { label: 'TOTAL À PAYER', value: totalText, x: 342, w: 156, highlight: true },
      ];

      cols.forEach((col) => {
        c.fillStyle = '#030a07';
        c.fillRect(col.x, 52, col.w, 88);
        c.strokeStyle = col.highlight ? '#22c55e' : '#14532d';
        c.lineWidth = 2;
        c.strokeRect(col.x, 52, col.w, 88);

        c.fillStyle = '#4ade80';
        c.font = '700 13px "JetBrains Mono", monospace';
        c.textAlign = 'center';
        c.fillText(col.label, col.x + col.w / 2, 72);

        c.fillStyle = col.highlight ? '#bbf7d0' : '#4ade80';
        c.font = '900 25px "JetBrains Mono", monospace';
        c.fillText(col.value, col.x + col.w / 2, 118);
      });

      // Bottom status line
      c.fillStyle = '#86efac';
      c.font = '700 15px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText(statusLine.slice(0, 48), 256, 168);
      vfdTex.needsUpdate = true;
    };

    const syncPanVisuals = () => {
      panMeshes.forEach((mesh, k) => {
        mesh.visible = panKind === k;
      });
    };

    redrawVfd();

    // Helper to register hitboxes on scaleRoot
    const addScaleHitbox = (opts: {
      id: string;
      size: [number, number, number];
      pos: [number, number, number];
      rotX?: number;
      title: string;
      subtitle: string;
      verb: () => string;
      dynamicSubtitle?: () => string;
      isVisible?: () => boolean;
      dynamicProductEan?: () => string | null;
      onInteract: () => void;
    }) => {
      const geo = new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
      ctx.disposables.push(geo);
      const hit = new THREE.Mesh(geo, proxyHiddenMat);
      hit.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
      if (opts.rotX) hit.rotation.x = opts.rotX;
      hit.layers.set(INTERACT_LAYER);
      scaleRoot.add(hit);
      const item: InteractableItem = {
        id: opts.id,
        title: opts.title,
        subtitle: opts.subtitle,
        kind: 'diegetic_action',
        state: false,
        inspectText: opts.subtitle,
        proxyMesh: hit,
        dynamicVerb: opts.verb,
        dynamicSubtitle: opts.dynamicSubtitle,
        isVisible: opts.isVisible,
        dynamicProductEan: opts.dynamicProductEan,
        onInteract: opts.onInteract,
      };
      hit.userData.interactable = item;
      ctx.interactables.push(item);
    };

    const isWeighableProduce = (kind: HeldItemHudInfo['kind'] | undefined): boolean =>
      kind === 'produce_pommes' ||
      kind === 'produce_bananes' ||
      kind === 'produce_oranges' ||
      kind === 'produce_tomates' ||
      kind === 'produce_carottes' ||
      kind === 'produce_pommes_de_terre';

    // A) Stainless Weighing Pan Hitbox
    addScaleHitbox({
      id: 'produce_scale_pan',
      size: [0.38, 0.24, 0.28],
      pos: [-0.02, 0.18, -0.05],
      title: 'Plateau de Pesée — Balance Primeur 1990',
      subtitle: 'Posez vos fruits ou légumes puis appuyez sur la touche pictogramme [1–6]',
      dynamicProductEan: () => printedStickerInfo?.plu.ean ?? activePlu?.ean ?? null,
      dynamicSubtitle: () => {
        const held = tools.getHeldItem();
        if (!panKind) {
          if (tools.getActiveTool() === 'hands' && isWeighableProduce(held?.kind)) {
            return `Appuyez pour poser « ${held!.label} » sur le plateau inox`;
          }
          return 'Prenez des fruits/légumes dans le rayon puis posez-les ici pour peser';
        }
        if (printedStickerInfo) {
          return `Pesé (${printedStickerInfo.weightKg.toFixed(3)} kg · ${formatFrancs(printedStickerInfo.totalCents)}) — Prenez l'étiquette-poids à droite ou retirez l'article`;
        }
        return `Poids détecté : ${panWeightKg.toFixed(3)} kg — Appuyez sur la touche [1–6] correspondante`;
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (!panKind) {
          if (tools.getActiveTool() === 'hands' && isWeighableProduce(held?.kind)) {
            return 'POSER SUR LA BALANCE';
          }
          return 'PLATEAU VIDE (TENIR PRIMEUR)';
        }
        if (tools.getActiveTool() === 'hands' && !held) {
          return printedStickerInfo ? "PRENDRE SACHET PESÉ & ÉTIQUETÉ" : 'RETIRER DU PLATEAU';
        }
        return 'PLATEAU OCCUPÉ';
      },
      onInteract: () => {
        if (!acquireScaleLock()) return;
        const held = tools.getHeldItem();
        if (!panKind) {
          if (tools.getActiveTool() === 'hands' && held && isWeighableProduce(held.kind)) {
            const matchedPlu = PRODUCE_SCALE_PLUS.find((p) => p.kind === held.kind) ?? PRODUCE_SCALE_PLUS[0];
            panKind = held.kind;
            // Realistic slight variation (±40g) for loose produce, exact 2.500 kg for Bintje sack
            const jitter = matchedPlu.isPerKg ? ((Math.floor(performance.now()) % 9) - 4) * 0.015 : 0;
            panWeightKg = Math.max(0.25, Number((matchedPlu.defaultWeightKg + jitter).toFixed(3)));
            activePlu = null;
            printedStickerInfo = null;
            extrudedStickerMesh.visible = false;
            statusLine = `POIDS ${panWeightKg.toFixed(3)} KG · APPUYEZ SUR [${matchedPlu.keyNum}] ${matchedPlu.shortLabel}`;
            tools.consumeHeldItem();
            syncPanVisuals();
            redrawVfd();
            soundSynth.playWoodenCrateRustle(false);
          } else {
            soundSynth.playAtmPiezo('error');
          }
          return;
        }
        // Empty hands: pick up either the labeled weighed bag or raw produce off the pan
        if (tools.getActiveTool() === 'hands' && !held) {
          if (printedStickerInfo) {
            const info = printedStickerInfo;
            tools.pickUpItem({
              kind: 'produce_weighed_bag',
              label: `${info.plu.fullName} (${info.weightKg.toFixed(3)} kg)`,
              sublabel: `Étiquette-Poids ${formatFrancs(info.totalCents)} · Prêt Caisse`,
              priceText: formatFrancs(info.totalCents),
              ean: info.plu.ean,
              productName: info.plu.fullName,
            });
            soundSynth.playPaperGrab();
          } else {
            const matchedPlu = PRODUCE_SCALE_PLUS.find((p) => p.kind === panKind) ?? PRODUCE_SCALE_PLUS[0];
            tools.pickUpItem({
              kind: panKind,
              label: matchedPlu.fullName,
              sublabel: `Rayon 1 Primeur · ${matchedPlu.priceText}`,
              ean: matchedPlu.ean,
            });
            soundSynth.playWoodenCrateRustle(false);
          }
          panKind = null;
          panWeightKg = 0;
          activePlu = null;
          printedStickerInfo = null;
          extrudedStickerMesh.visible = false;
          statusLine = 'POSEZ UN ARTICLE · APPUYEZ SUR LA TOUCHE [1-6]';
          syncPanVisuals();
          redrawVfd();
        }
      },
    });

    // B) 6 Protruding 3D Physical Pictogram Keys ([1] POMMES .. [6] P. DE TERRE)
    interface ScaleKeyAnim {
      mesh: THREE.Mesh;
      basePos: THREE.Vector3;
      pressAnim: number;
    }
    const scaleKeyAnims: ScaleKeyAnim[] = [];
    const keyCapGeo = new THREE.BoxGeometry(0.115, 0.022, 0.068);
    ctx.disposables.push(keyCapGeo);

    const createPictogramKeyMat = (plu: ProduceScalePluDef) => {
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 96;
      const g = c.getContext('2d')!;
      g.fillStyle = plu.iconBg;
      g.fillRect(0, 0, 160, 96);
      g.strokeStyle = '#334155';
      g.lineWidth = 5;
      g.strokeRect(3, 3, 154, 90);

      // Key badge number top-left
      g.fillStyle = '#0f172a';
      g.fillRect(8, 8, 30, 26);
      g.fillStyle = '#ffffff';
      g.font = '900 18px "JetBrains Mono", monospace';
      g.textAlign = 'center';
      g.fillText(`${plu.keyNum}`, 23, 27);

      // Stylized fruit/vegetable pictogram top-right
      g.fillStyle = plu.iconFg;
      if (plu.keyNum === 1 || plu.keyNum === 3 || plu.keyNum === 4) {
        g.beginPath();
        g.arc(124, 28, 16, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#15803d';
        g.fillRect(122, 8, 4, 9);
      } else if (plu.keyNum === 2) {
        g.lineWidth = 9;
        g.strokeStyle = '#eab308';
        g.beginPath();
        g.arc(120, 28, 16, 0.25, Math.PI * 0.9);
        g.stroke();
      } else if (plu.keyNum === 5) {
        g.beginPath();
        g.moveTo(106, 22);
        g.lineTo(144, 34);
        g.lineTo(114, 42);
        g.closePath();
        g.fill();
      } else {
        g.fillRect(108, 14, 32, 26);
      }

      // Crisp French produce label & price along bottom
      g.fillStyle = '#0f172a';
      g.font = '900 16px "Plus Jakarta Sans", sans-serif';
      g.textAlign = 'center';
      g.fillText(plu.shortLabel, 80, 64);
      g.fillStyle = '#15803d';
      g.font = '800 14px "JetBrains Mono", monospace';
      g.fillText(plu.priceText, 80, 84);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.36 });
      ctx.disposables.push(tex, mat);
      return mat;
    };

    const keyDeckAngle = 0.46;
    const cosA = Math.cos(keyDeckAngle);
    const sinA = Math.sin(keyDeckAngle);

    PRODUCE_SCALE_PLUS.forEach((plu, idx) => {
      const col = idx % 3; // 0, 1, 2
      const row = Math.floor(idx / 3); // 0 (top), 1 (bottom)
      const localX = (col - 1) * 0.136;
      const deckLocalZ = row === 0 ? -0.042 : 0.042;
      const deckLocalY = 0.03;

      const worldX = localX;
      const worldY = 0.072 + deckLocalY * cosA - deckLocalZ * sinA;
      const worldZ = 0.16 + deckLocalY * sinA + deckLocalZ * cosA;

      const topMat = createPictogramKeyMat(plu);
      const keyMesh = new THREE.Mesh(keyCapGeo, [
        scaleBeigeMat,
        scaleBeigeMat,
        topMat,
        scaleBeigeMat,
        scaleBeigeMat,
        scaleBeigeMat,
      ]);
      keyMesh.position.set(worldX, worldY, worldZ);
      keyMesh.rotation.x = keyDeckAngle;
      scaleRoot.add(keyMesh);

      const kAnim: ScaleKeyAnim = {
        mesh: keyMesh,
        basePos: keyMesh.position.clone(),
        pressAnim: 0,
      };
      scaleKeyAnims.push(kAnim);

      addScaleHitbox({
        id: `produce_scale_key_${plu.keyNum}`,
        size: [0.125, 0.048, 0.076],
        pos: [worldX, worldY + 0.008, worldZ + 0.006],
        rotX: keyDeckAngle,
        title: `Touche [${plu.keyNum}] ${plu.fullName}`,
        subtitle: `Tarif officiel : ${plu.priceText} · EAN ${plu.ean}`,
        dynamicSubtitle: () =>
          panKind
            ? `Calculer (${panWeightKg.toFixed(3)} kg × ${plu.priceText}) et imprimer l'étiquette-poids`
            : `Tarif ${plu.priceText} — Posez d'abord un article sur le plateau pour imprimer`,
        verb: () =>
          panKind
            ? `PESER [${plu.keyNum}] ${plu.shortLabel}`
            : `TOUCHE [${plu.keyNum}] ${plu.shortLabel}`,
        onInteract: () => {
          if (!acquireScaleLock()) return;
          kAnim.pressAnim = 1.0;
          soundSynth.playAtmPiezo('digit');
          activePlu = plu;
          if (!panKind || panWeightKg <= 0) {
            statusLine = `PLU [${plu.keyNum}] ${plu.shortLabel} — POSEZ UN ARTICLE SUR LE PLATEAU`;
            redrawVfd();
            return;
          }
          const totalCents = computeTotalCents(plu, panWeightKg);
          printedStickerInfo = { plu, weightKg: panWeightKg, totalCents };
          drawWeightSticker(plu, panWeightKg, totalCents);
          extrudedStickerMesh.visible = true;
          stickerExtrudeAnim = 0;
          statusLine = `ÉTIQUETTE IMPRIMÉE · ${formatFrancs(totalCents)} · PRENEZ À DROITE`;
          redrawVfd();
          soundSynth.playLabelPrint();
        },
      });
    });

    // C) Side Thermal Sticker Printer Slot Hitbox ([PRENDRE L'ÉTIQUETTE-POIDS])
    addScaleHitbox({
      id: 'produce_scale_printer_sticker',
      size: [0.16, 0.14, 0.16],
      pos: [0.33, 0.08, -0.02],
      title: 'Étiquette-Poids Code-Barres — Balance Primeur 1990',
      subtitle: 'Ticket adhésif thermique avec poids, prix Francs et code-barres EAN-8',
      isVisible: () => printedStickerInfo !== null,
      dynamicProductEan: () => printedStickerInfo?.plu.ean ?? null,
      dynamicSubtitle: () =>
        printedStickerInfo
          ? `${printedStickerInfo.plu.fullName} · ${printedStickerInfo.weightKg.toFixed(3)} kg · TOTAL ${formatFrancs(printedStickerInfo.totalCents)}`
          : 'Aucune étiquette imprimée',
      verb: () => "PRENDRE L'ÉTIQUETTE-POIDS",
      onInteract: () => {
        if (!acquireScaleLock()) return;
        if (!printedStickerInfo) return;
        const info = printedStickerInfo;
        tools.pickUpItem({
          kind: 'produce_weighed_bag',
          label: `${info.plu.fullName} (${info.weightKg.toFixed(3)} kg)`,
          sublabel: `Étiquette-Poids ${formatFrancs(info.totalCents)} · EAN ${info.plu.ean}`,
          priceText: formatFrancs(info.totalCents),
          ean: info.plu.ean,
          productName: info.plu.fullName,
        });
        panKind = null;
        panWeightKg = 0;
        activePlu = null;
        printedStickerInfo = null;
        extrudedStickerMesh.visible = false;
        statusLine = 'ÉTIQUETTE COLLÉE · PRÊT POUR PASSAGE CAISSE';
        syncPanVisuals();
        redrawVfd();
        soundSynth.playPaperGrab();
      },
    });

    // Per-frame spring key animations & thermal sticker extrusion
    ctx.updaters.push({
      update: (dt) => {
        for (let i = 0; i < scaleKeyAnims.length; i++) {
          const ka = scaleKeyAnims[i];
          if (ka.pressAnim > 0) {
            ka.pressAnim = Math.max(0, ka.pressAnim - dt * 6.5);
            const depth = Math.sin(ka.pressAnim * Math.PI) * 0.009;
            ka.mesh.position.set(
              ka.basePos.x,
              ka.basePos.y - depth * cosA,
              ka.basePos.z - depth * sinA
            );
          } else {
            ka.mesh.position.copy(ka.basePos);
          }
        }
        if (printedStickerInfo && extrudedStickerMesh.visible) {
          stickerExtrudeAnim = Math.min(1, stickerExtrudeAnim + dt * 4.2);
          extrudedStickerMesh.position.x = THREE.MathUtils.lerp(0.285, 0.345, stickerExtrudeAnim);
        }
      },
    });

    addBoxCollider(ctx, 'produce_scale_pedestal_col', 1.72, 2.34, 4.35, 4.95);
  }
}
