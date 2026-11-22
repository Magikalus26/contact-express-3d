import * as THREE from 'three';
import {
  MaterialLibrary,
  addBoxCollider,
} from '../materials';
import { ProceduralTextureBank } from '../textures';
import { soundSynth } from '../audio';
import { WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  buildSrpPavLane,
} from './retailShelfSystem';

/**
 * RAYON 10 — "ANIMALERIE — CHIEN & CHAT"
 * V9 Upgrade:
 * - Zero pre-spawned loose cardboard boxes or price-rail trolleys on the sales floor!
 * - Bare metal shelf lips at start (manual clip-on plastic rails ordered via Terminal Commande 1990)
 * - Multi-depth back-to-front shelf stocking (3–4 depth slots + [FAIRE LE FACING]) for all kibble bags
 * - Deep SRP/PAV perforated cardboard trays for wet food with front flap cuttable via Cutter
 * - All 3 tactile pet toys (Tennis Ball, Squeaky Ball, Cat Bell Ball) intact
 */
export function buildPetSupplyAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  // ============================================================================
  // 1. PROCEDURAL TEXTURES FOR KIBBLE BAGS, WET FOOD CANS & TENNIS BALL
  // ============================================================================
  const makeBagTexture = (
    brand: string,
    weight: string,
    animal: 'CHIEN' | 'CHAT',
    bgHex: string,
    accentHex: string,
    ean: string
  ): THREE.CanvasTexture => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 384;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, 256, 384);

    c.fillStyle = accentHex;
    c.fillRect(0, 0, 256, 52);
    c.fillStyle = '#ffffff';
    c.font = '800 23px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText(brand, 128, 35);

    c.fillStyle = '#f8fafc';
    c.beginPath();
    c.arc(128, 146, 62, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = accentHex;
    if (animal === 'CHIEN') {
      c.beginPath();
      c.arc(128, 142, 30, 0, Math.PI * 2);
      c.fill();
      c.fillRect(88, 124, 16, 36);
      c.fillRect(152, 124, 16, 36);
      c.fillStyle = '#f8fafc';
      c.beginPath();
      c.arc(117, 138, 4.5, 0, Math.PI * 2);
      c.arc(139, 138, 4.5, 0, Math.PI * 2);
      c.fill();
    } else {
      c.beginPath();
      c.arc(128, 150, 28, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(100, 138);
      c.lineTo(108, 108);
      c.lineTo(124, 128);
      c.fill();
      c.beginPath();
      c.moveTo(156, 138);
      c.lineTo(148, 108);
      c.lineTo(132, 128);
      c.fill();
      c.fillStyle = '#f8fafc';
      c.beginPath();
      c.arc(118, 146, 4, 0, Math.PI * 2);
      c.arc(138, 146, 4, 0, Math.PI * 2);
      c.fill();
    }

    c.fillStyle = '#ffffff';
    c.font = '800 20px "Plus Jakarta Sans", sans-serif';
    c.fillText(`CROQUETTES ${animal}`, 128, 234);

    c.fillStyle = '#fef08a';
    c.fillRect(52, 248, 152, 42);
    c.fillStyle = '#0f172a';
    c.font = '900 28px "JetBrains Mono", monospace';
    c.fillText(weight, 128, 279);

    drawEanBarcode(c, ean, 38, 302, 180, 70, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    ctx.disposables.push(tex);
    return tex;
  };

  const bagTexLargeDog = makeBagTexture("CROQ'CHIEN", '10 KG', 'CHIEN', '#1d4ed8', '#1e3a8a', '30140101');
  const bagTexLargeCat = makeBagTexture("FELI'CROQ", '8 KG', 'CHAT', '#ea580c', '#9a3412', '30140104');
  const bagTexMedDog = makeBagTexture("CROQ'CHIEN", '3 KG', 'CHIEN', '#2563eb', '#1e3a8a', '30140102');
  const bagTexMedCat = makeBagTexture("FELI'CROQ", '3 KG', 'CHAT', '#f97316', '#9a3412', '30140105');
  const bagTexSmallDog = makeBagTexture("CROQ'CHIEN", '1 KG', 'CHIEN', '#3b82f6', '#1e40af', '30140103');
  const bagTexSmallCat = makeBagTexture("FELI'CROQ", '1 KG', 'CHAT', '#fb923c', '#c2410c', '30140106');

  const makeBagMaterials = (tex: THREE.CanvasTexture, sideHex: number) => {
    const frontMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 });
    const sideMat = new THREE.MeshStandardMaterial({ color: sideHex, roughness: 0.68 });
    ctx.disposables.push(frontMat, sideMat);
    return [sideMat, sideMat, sideMat, sideMat, frontMat, frontMat];
  };

  const bagMats = {
    kibble_large_dog: makeBagMaterials(bagTexLargeDog, 0x1e40af),
    kibble_large_cat: makeBagMaterials(bagTexLargeCat, 0xc2410c),
    kibble_med_dog: makeBagMaterials(bagTexMedDog, 0x1d4ed8),
    kibble_med_cat: makeBagMaterials(bagTexMedCat, 0xea580c),
    kibble_small_dog: makeBagMaterials(bagTexSmallDog, 0x2563eb),
    kibble_small_cat: makeBagMaterials(bagTexSmallCat, 0xf97316),
  };

  const makeTrayFrontTex = (title: string, bgHex: string, ean: string): THREE.CanvasTexture => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.strokeRect(6, 6, 244, 116);
    c.fillStyle = '#ffffff';
    c.font = '800 22px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(title, 128, 30);
    drawEanBarcode(c, ean, 44, 50, 168, 66, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    ctx.disposables.push(tex);
    return tex;
  };
  const dogTrayFrontMat = new THREE.MeshStandardMaterial({
    map: makeTrayFrontTex('PÂTÉE CHIEN LOT', '#1e3a8a', '30140107'),
    roughness: 0.72,
  });
  const catTrayFrontMat = new THREE.MeshStandardMaterial({
    map: makeTrayFrontTex('PÂTÉE CHAT LOT', '#b45309', '30140108'),
    roughness: 0.72,
  });
  const dogCanMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.34,
    metalness: 0.48,
  });
  const catFoilMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.28,
    metalness: 0.62,
  });
  ctx.disposables.push(dogTrayFrontMat, catTrayFrontMat, dogCanMat, catFoilMat);

  // Tennis ball felt + white curved seam texture
  const tennisCanvas = document.createElement('canvas');
  tennisCanvas.width = 256;
  tennisCanvas.height = 128;
  {
    const tc = tennisCanvas.getContext('2d')!;
    tc.fillStyle = '#d9f99d';
    tc.fillRect(0, 0, 256, 128);
    tc.strokeStyle = '#ffffff';
    tc.lineWidth = 7;
    tc.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 64 + Math.sin((x / 256) * Math.PI * 2) * 34;
      if (x === 0) tc.moveTo(x, y);
      else tc.lineTo(x, y);
    }
    tc.stroke();
  }
  const tennisTex = new THREE.CanvasTexture(tennisCanvas);
  tennisTex.colorSpace = THREE.SRGBColorSpace;
  const tennisBallMat = new THREE.MeshStandardMaterial({ map: tennisTex, roughness: 0.92 });
  const squeakyBallMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.48 });
  const catBallMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.42 });
  const catBellGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.82,
  });
  ctx.disposables.push(tennisTex, tennisBallMat, squeakyBallMat, catBallMat, catBellGoldMat);

  // ============================================================================
  // 2. DEDICATED 3-TIER PET SUPPLY GONDOLA AT X = +5.95, Z = +0.55 (len = 2.60m)
  // ============================================================================
  const gondRoot = new THREE.Group();
  gondRoot.position.set(5.95, 0, 0.55);
  root.add(gondRoot);

  const gondLen = 2.6;
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.94, gondLen), mats.anthracite);
  spine.position.y = 0.97;
  spine.castShadow = true;
  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, gondLen), mats.anthracite);
  basePlinth.position.y = 0.07;
  const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, gondLen + 0.04), mats.anthracite);
  topCanopy.position.y = 1.9;
  gondRoot.add(spine, basePlinth, topCanopy);
  ctx.disposables.push(spine.geometry, basePlinth.geometry, topCanopy.geometry);

  const petSignTex = texBank.createDepartmentSignTexture(
    'ANIMALERIE — CHIEN & CHAT',
    'CROQUETTES 1kg · 3kg · 10kg  ·  PÂTÉES  ·  JOUETS',
    '#1b365d',
    '#f59e0b'
  );
  const petSignFaceMat = new THREE.MeshStandardMaterial({ map: petSignTex, roughness: 0.35 });
  const petSignMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 2.36), [
    petSignFaceMat,
    petSignFaceMat,
    mats.anthracite,
    mats.anthracite,
    mats.anthracite,
    mats.anthracite,
  ]);
  petSignMesh.position.set(0, 2.18, 0);
  gondRoot.add(petSignMesh);
  ctx.disposables.push(petSignFaceMat, petSignMesh.geometry);

  addBoxCollider(ctx, 'pet_supply_gondola_col', 5.38, 6.52, -0.78, 1.88);

  const petFace = new THREE.Group();
  petFace.rotation.y = -Math.PI / 2;
  gondRoot.add(petFace);

  const shelfYs = [0.16, 0.72, 1.24];
  const shelfNames = ['Étagère Basse', 'Étagère Centrale', 'Étagère Haute'];

  // Standardized Bare Metal Shelf Edges + Installable 120cm Plastic Rails + 4 Price Slots per Rail
  const helper = buildBareShelfWithInstallableRails(ctx, petFace, mats, tools, {
    idPrefix: 'pet',
    shelfYs,
    shelfNames,
    shelfWidth: 2.56,
    shelfDepth: 0.5,
    tierSlotXs: [
      [[-1.04, -0.74, -0.44, -0.16], [0.18, 0.48, 0.78, 1.06]],
      [[-1.08, -0.8, -0.5, -0.22], [0.14, 0.42, 0.72, 1.0]],
      [[-1.08, -0.78, -0.45, -0.16], [0.2, 0.5, 0.82, 1.1]],
    ],
    expectedSlotEans: (tierIdx, sideKey, subIdx) => {
      if (tierIdx === 0) return sideKey === 'L' ? ['30140101'] : ['30140104'];
      if (tierIdx === 1) {
        if (sideKey === 'L') return subIdx <= 1 ? ['30140102'] : ['30140105'];
        return subIdx <= 1 ? ['30140107'] : ['30140108'];
      }
      if (sideKey === 'L') return subIdx <= 1 ? ['30140103'] : ['30140106'];
      if (subIdx === 0) return ['30140109'];
      if (subIdx === 1) return ['30140110'];
      return ['30140111'];
    },
  });

  // ============================================================================
  // 3. MULTI-DEPTH KIBBLE BAG COLUMNS (3 DEPTH SLOTS FOR 10/3KG, 4 FOR 1KG)
  // ============================================================================
  const largeBodyGeo = new THREE.BoxGeometry(0.3, 0.42, 0.13);
  const largeCrimpGeo = new THREE.BoxGeometry(0.285, 0.032, 0.045);
  const medBodyGeo = new THREE.BoxGeometry(0.22, 0.32, 0.11);
  const medCrimpGeo = new THREE.BoxGeometry(0.21, 0.025, 0.038);
  const smallBodyGeo = new THREE.BoxGeometry(0.16, 0.23, 0.085);
  const smallCrimpGeo = new THREE.BoxGeometry(0.15, 0.02, 0.03);
  ctx.disposables.push(
    largeBodyGeo,
    largeCrimpGeo,
    medBodyGeo,
    medCrimpGeo,
    smallBodyGeo,
    smallCrimpGeo
  );

  const makeBagBuilder = (
    kind: keyof typeof bagMats,
    bodyGeo: THREE.BoxGeometry,
    crimpGeo: THREE.BoxGeometry,
    h: number
  ) => () => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bagMats[kind]);
    body.position.y = h / 2;
    const crimp = new THREE.Mesh(crimpGeo, bagMats[kind][0]);
    crimp.position.y = h + h * 0.035;
    grp.add(body, crimp);
    return grp;
  };

  const largeVariants = [
    {
      kind: 'kibble_large_dog' as const,
      ean: '30140101',
      label: 'Croquettes Chien Grand Sac 10kg',
      sublabel: 'Étagère Basse (10kg)',
      buildMesh: makeBagBuilder('kibble_large_dog', largeBodyGeo, largeCrimpGeo, 0.42),
    },
    {
      kind: 'kibble_large_cat' as const,
      ean: '30140104',
      label: 'Croquettes Chat Grand Sac 8kg',
      sublabel: 'Étagère Basse (8kg)',
      buildMesh: makeBagBuilder('kibble_large_cat', largeBodyGeo, largeCrimpGeo, 0.42),
    },
  ];

  const medVariants = [
    {
      kind: 'kibble_med_dog' as const,
      ean: '30140102',
      label: 'Croquettes Chien Sac Moyen 3kg',
      sublabel: 'Étagère Centrale (3kg)',
      buildMesh: makeBagBuilder('kibble_med_dog', medBodyGeo, medCrimpGeo, 0.32),
    },
    {
      kind: 'kibble_med_cat' as const,
      ean: '30140105',
      label: 'Croquettes Chat Sac Moyen 3kg',
      sublabel: 'Étagère Centrale (3kg)',
      buildMesh: makeBagBuilder('kibble_med_cat', medBodyGeo, medCrimpGeo, 0.32),
    },
  ];

  const smallVariants = [
    {
      kind: 'kibble_small_dog' as const,
      ean: '30140103',
      label: 'Croquettes Chien Petit Sac 1kg',
      sublabel: 'Étagère Haute (1kg)',
      buildMesh: makeBagBuilder('kibble_small_dog', smallBodyGeo, smallCrimpGeo, 0.23),
    },
    {
      kind: 'kibble_small_cat' as const,
      ean: '30140106',
      label: 'Croquettes Chat Petit Sac 1kg',
      sublabel: 'Étagère Haute (1kg)',
      buildMesh: makeBagBuilder('kibble_small_cat', smallBodyGeo, smallCrimpGeo, 0.23),
    },
  ];

  // Bottom Shelf (Y = 0.16): 6 columns × 3 depth slots (100% EMPTY AT START)
  const bottomCols: Array<{ x: number; init: Array<'kibble_large_dog' | 'kibble_large_cat' | null> }> = [
    { x: -1.04, init: [null, null, null] },
    { x: -0.66, init: [null, null, null] },
    { x: -0.28, init: [null, null, null] },
    { x: 0.18, init: [null, null, null] },
    { x: 0.56, init: [null, null, null] },
    { x: 0.94, init: [null, null, null] },
  ];
  bottomCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, petFace, helper, tools, {
      id: `bag_10kg_${i}`,
      tierName: 'Étagère Basse (10/8kg)',
      x: col.x,
      y: 0.16,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.32,
      itemHeight: 0.45,
      itemDepth: 0.135,
      depthCount: 3,
      variants: largeVariants,
      initialSlots: col.init,
    });
  });

  // Middle Shelf Left (Y = 0.72): 4 columns × 3 depth slots (100% EMPTY AT START)
  const medCols: Array<{ x: number; init: Array<'kibble_med_dog' | 'kibble_med_cat' | null> }> = [
    { x: -1.08, init: [null, null, null] },
    { x: -0.8, init: [null, null, null] },
    { x: -0.5, init: [null, null, null] },
    { x: -0.22, init: [null, null, null] },
  ];
  medCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, petFace, helper, tools, {
      id: `bag_3kg_${i}`,
      tierName: 'Étagère Centrale (3kg)',
      x: col.x,
      y: 0.72,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.24,
      itemHeight: 0.35,
      itemDepth: 0.115,
      depthCount: 3,
      variants: medVariants,
      initialSlots: col.init,
    });
  });

  // Top Shelf Left (Y = 1.24): 6 columns × 4 depth slots (100% EMPTY AT START)
  const smallCols: Array<{ x: number; init: Array<'kibble_small_dog' | 'kibble_small_cat' | null> }> = [
    { x: -1.12, init: [null, null, null, null] },
    { x: -0.9, init: [null, null, null, null] },
    { x: -0.68, init: [null, null, null, null] },
    { x: -0.42, init: [null, null, null, null] },
    { x: -0.2, init: [null, null, null, null] },
    { x: 0.02, init: [null, null, null, null] },
  ];
  smallCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, petFace, helper, tools, {
      id: `bag_1kg_${i}`,
      tierName: 'Étagère Haute (1kg)',
      x: col.x,
      y: 1.24,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.18,
      itemHeight: 0.26,
      itemDepth: 0.09,
      depthCount: 4,
      variants: smallVariants,
      initialSlots: col.init,
    });
  });

  // ============================================================================
  // 4. DEEP SRP / PAV WET FOOD TRAYS WITH PERFORATED FRONT FLAP (MIDDLE SHELF RIGHT)
  // ============================================================================
  const dogCanGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.095, 12);
  const catFoilGeo = new THREE.BoxGeometry(0.08, 0.036, 0.082);
  ctx.disposables.push(dogCanGeo, catFoilGeo);

  const wetLaneSpecs: Array<{
    id: string;
    x: number;
    animal: 'dog' | 'cat';
    initialHasTray: boolean;
    initialFlapCut: boolean;
    initialCans: number;
  }> = [
    { id: 'wet_lane_dog_1', x: 0.14, animal: 'dog', initialHasTray: false, initialFlapCut: false, initialCans: 0 },
    { id: 'wet_lane_dog_2', x: 0.42, animal: 'dog', initialHasTray: false, initialFlapCut: false, initialCans: 0 },
    { id: 'wet_lane_cat_1', x: 0.72, animal: 'cat', initialHasTray: false, initialFlapCut: false, initialCans: 0 },
    { id: 'wet_lane_cat_2', x: 1.0, animal: 'cat', initialHasTray: false, initialFlapCut: false, initialCans: 0 },
  ];

  const rowZs = [-0.15, -0.05, 0.05, 0.15];
  const colXs = [-0.046, 0.046];

  wetLaneSpecs.forEach((lane) => {
    const isDog = lane.animal === 'dog';
    buildSrpPavLane(ctx, petFace, helper, tools, {
      id: lane.id,
      x: lane.x,
      y: 0.72,
      trayKind: isDog ? 'wet_tray_dog' : 'wet_tray_cat',
      unitKind: isDog ? 'wet_can_dog' : 'wet_can_cat',
      trayLabel: isDog ? 'Pâtée Chien Boîtes Lot (PAV)' : 'Pâtée Chat Barquettes Lot (PAV)',
      unitLabel: isDog ? 'Boîte Pâtée Chien 400g' : 'Barquette Pâtée Chat 100g',
      ean: isDog ? '30140107' : '30140108',
      trayWidth: 0.21,
      trayDepth: 0.44,
      trayHeight: 0.11,
      maxUnits: 8,
      initialHasTray: lane.initialHasTray,
      initialFlapCut: lane.initialFlapCut,
      initialUnits: lane.initialCans,
      accentColor: isDog ? 0x3b82f6 : 0xf59e0b,
      frontMat: isDog ? dogTrayFrontMat : catTrayFrontMat,
      buildUnitMesh: (idx) => {
        const r = Math.floor(idx / 2);
        const c = idx % 2;
        const m = new THREE.Mesh(
          isDog ? dogCanGeo : catFoilGeo,
          isDog ? dogCanMat : catFoilMat
        );
        m.position.set(colXs[c], isDog ? 0.06 : 0.032, rowZs[r]);
        return m;
      },
    });
  });

  // ============================================================================
  // 5. INTERACTIVE PET TOYS BIN & DISPLAY SECTION (TOP SHELF RIGHT, Y = 1.24)
  // ============================================================================
  const toyBin = new THREE.Group();
  toyBin.position.set(0.76, 1.24, 0.34);
  petFace.add(toyBin);

  const binFloor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.016, 0.34), mats.anthracite);
  binFloor.position.y = 0.008;
  const binFrontGlass = new THREE.Mesh(
    new THREE.BoxGeometry(0.86, 0.085, 0.012),
    helper.clearPlasticRailMat
  );
  binFrontGlass.position.set(0, 0.05, 0.165);
  const binDiv1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.32), mats.anthracite);
  binDiv1.position.set(-0.14, 0.05, 0);
  const binDiv2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.32), mats.anthracite);
  binDiv2.position.set(0.14, 0.05, 0);
  toyBin.add(binFloor, binFrontGlass, binDiv1, binDiv2);
  ctx.disposables.push(
    binFloor.geometry,
    binFrontGlass.geometry,
    binDiv1.geometry,
    binDiv2.geometry
  );

  // Toy 1: Yellow Tennis Balls
  const tennisGroup = new THREE.Group();
  tennisGroup.position.set(-0.28, 0.06, 0.02);
  toyBin.add(tennisGroup);
  const tennisSphereGeo = new THREE.SphereGeometry(0.044, 14, 12);
  ctx.disposables.push(tennisSphereGeo);
  const tb1 = new THREE.Mesh(tennisSphereGeo, tennisBallMat);
  const tb2 = new THREE.Mesh(tennisSphereGeo, tennisBallMat);
  tb2.position.set(0.06, 0, -0.06);
  const tb3 = new THREE.Mesh(tennisSphereGeo, tennisBallMat);
  tb3.position.set(-0.05, 0, -0.07);
  tennisGroup.add(tb1, tb2, tb3);

  let tennisBounceAnim = 0;
  helper.addHitbox(tennisGroup, {
    id: 'pet_toy_tennis',
    size: [0.24, 0.16, 0.28],
    pos: [0, 0.04, -0.02],
    title: 'Balle de Tennis Chien',
    subtitle: 'Feutre Jaune Optique · EAN 30140109',
    productEan: '30140109',
    verb: () => {
      const held = tools.getHeldItem();
      if (tools.getActiveTool() === 'hands' && held?.kind === 'toy_tennis') return 'REPOSER BALLE DE TENNIS';
      if (tools.getActiveTool() === 'hands' && !held) return 'PRENDRE BALLE DE TENNIS';
      return 'FAIRE REBONDIR LA BALLE';
    },
    onInteract: () => {
      if (!helper.acquireLock()) return;
      const held = tools.getHeldItem();
      if (tools.getActiveTool() === 'hands' && held?.kind === 'toy_tennis') {
        tools.consumeHeldItem();
        tennisBounceAnim = 1.0;
        soundSynth.playTennisBounce(0.9);
      } else if (tools.getActiveTool() === 'hands' && !held) {
        tools.pickUpItem({
          kind: 'toy_tennis',
          label: 'Balle de Tennis Chien',
          sublabel: 'Cliquez dans le vide pour faire rebondir',
        });
        soundSynth.playTennisBounce(1.0);
      } else {
        tennisBounceAnim = 1.0;
        soundSynth.playTennisBounce(1.0);
      }
    },
  });

  // Toy 2: Spiky Squeaky Dog Ball
  const squeakyGroup = new THREE.Group();
  squeakyGroup.position.set(0.0, 0.062, 0.02);
  toyBin.add(squeakyGroup);

  const sqSphere = new THREE.Mesh(new THREE.SphereGeometry(0.046, 14, 12), squeakyBallMat);
  squeakyGroup.add(sqSphere);
  const spikeGeo = new THREE.ConeGeometry(0.009, 0.019, 6);
  const spikeDirs = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7],
    [0.7, -0.7, 0], [-0.7, -0.7, 0],
  ];
  spikeDirs.forEach(([dx, dy, dz]) => {
    const sp = new THREE.Mesh(spikeGeo, squeakyBallMat);
    sp.position.set(dx * 0.045, dy * 0.045, dz * 0.045);
    sp.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx, dy, dz).normalize()
    );
    squeakyGroup.add(sp);
  });
  ctx.disposables.push(sqSphere.geometry, spikeGeo);

  let squeakAnim = 0;
  helper.addHitbox(squeakyGroup, {
    id: 'pet_toy_squeaky',
    size: [0.24, 0.16, 0.28],
    pos: [0, 0.04, -0.02],
    title: 'Balle Couineuse Pouic',
    subtitle: 'Caoutchouc Souple · EAN 30140110',
    productEan: '30140110',
    verb: () => {
      const held = tools.getHeldItem();
      if (tools.getActiveTool() === 'hands' && held?.kind === 'toy_squeaky') return 'REPOSER BALLE COUINEUSE';
      return 'PRESSER (POUIC-POUIC !)';
    },
    onInteract: () => {
      if (!helper.acquireLock()) return;
      squeakAnim = 1.0;
      soundSynth.playSqueakyToy();
      const held = tools.getHeldItem();
      if (tools.getActiveTool() === 'hands' && held?.kind === 'toy_squeaky') {
        tools.consumeHeldItem();
      }
    },
  });

  // Toy 3: Cat Bell Ball
  const catToyGroup = new THREE.Group();
  catToyGroup.position.set(0.28, 0.056, 0.02);
  toyBin.add(catToyGroup);

  const cbSphere = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 12), catBallMat);
  const cbRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 8, 16), catBellGoldMat);
  const cbRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.005, 8, 16), catBellGoldMat);
  cbRing2.rotation.y = Math.PI / 2;
  catToyGroup.add(cbSphere, cbRing1, cbRing2);
  ctx.disposables.push(cbSphere.geometry, cbRing1.geometry, cbRing2.geometry);

  let catToyJingleAnim = 0;
  helper.addHitbox(catToyGroup, {
    id: 'pet_toy_cat_bell',
    size: [0.24, 0.16, 0.28],
    pos: [0, 0.04, -0.02],
    title: 'Balle Grelot Chat',
    subtitle: 'Balle Légère Colorée · EAN 30140111',
    productEan: '30140111',
    verb: () => {
      const held = tools.getHeldItem();
      if (tools.getActiveTool() === 'hands' && held?.kind === 'toy_cat_bell') return 'REPOSER BALLE CHAT';
      if (tools.getActiveTool() === 'hands' && !held) return 'PRENDRE BALLE CHAT (GRELOT)';
      return 'FAIRE TINTER LE GRELOT';
    },
    onInteract: () => {
      if (!helper.acquireLock()) return;
      catToyJingleAnim = 1.0;
      soundSynth.playCatBellJingle();
      const held = tools.getHeldItem();
      if (tools.getActiveTool() === 'hands' && held?.kind === 'toy_cat_bell') {
        tools.consumeHeldItem();
      } else if (tools.getActiveTool() === 'hands' && !held) {
        tools.pickUpItem({
          kind: 'toy_cat_bell',
          label: 'Balle à Grelot Chat',
          sublabel: 'Cliquez pour faire tinter le grelot',
        });
      }
    },
  });

  // ============================================================================
  // 6. EAST FACE OF GONDOLA 4 SOUTH (100% EMPTY WHITE SHELVES — ZERO PLACEHOLDER CUBES)
  // ============================================================================
  [0.72, 1.24].forEach((sy) => {
    const deckE = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, gondLen), mats.whiteMetal);
    deckE.position.set(0.27, sy - 0.014, 0);
    gondRoot.add(deckE);
    ctx.disposables.push(deckE.geometry);
  });

  // ============================================================================
  // 7. INTERACTIVE PET TOY ANIMATIONS
  // ============================================================================
  ctx.updaters.push({
    update: (dt) => {
      if (tennisBounceAnim > 0) {
        tennisBounceAnim = Math.max(0, tennisBounceAnim - dt * 3.2);
        tb1.position.y = Math.abs(Math.sin(tennisBounceAnim * Math.PI * 2)) * 0.095;
      } else {
        tb1.position.y = 0;
      }

      if (squeakAnim > 0) {
        squeakAnim = Math.max(0, squeakAnim - dt * 4.2);
        const sq = Math.abs(Math.sin(squeakAnim * Math.PI * 2));
        squeakyGroup.scale.set(1 + sq * 0.24, 1 - sq * 0.3, 1 + sq * 0.24);
      } else {
        squeakyGroup.scale.set(1, 1, 1);
      }

      if (catToyJingleAnim > 0) {
        catToyJingleAnim = Math.max(0, catToyJingleAnim - dt * 3.6);
        catToyGroup.rotation.z = Math.sin(catToyJingleAnim * Math.PI * 6) * 0.35;
        catToyGroup.position.y = 0.056 + Math.abs(Math.sin(catToyJingleAnim * Math.PI * 3)) * 0.04;
      } else {
        catToyGroup.rotation.z = 0;
        catToyGroup.position.y = 0.056;
      }
    },
  });
}
