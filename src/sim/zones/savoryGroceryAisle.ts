import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { ProceduralTextureBank } from '../textures';
import { HeldItemHudInfo, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  buildSrpPavLane,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

/**
 * V14 DEPARTMENT 7A — "RAYON 7A — ÉPICERIE SALÉE & PÂTES (1990)"
 * Positioned on Gondola 1 (X = -3.2, Z = -0.9, total length 5.20m) in sober 1990 French retail styling.
 * Features:
 * - Zero pre-spawned loose cardboard boxes (ordered via Terminal Commande 1990 -> Warehouse dock)
 * - Both EAST (+X) and WEST (-X) central 2.56m merchandising bays feature 3 bare metal tiers
 *   (zero pre-installed plastic rails or price tags at game start)
 * - Tier 0 (Étagère Basse): Huile de Tournesol 1L, Huile d'Olive Vierge 75cl, Cassoulet Toulousain 840g (4 deep)
 * - Tier 1 (Étagère Centrale): Pâtes Coquillettes 500g, Spaghetti Supérieurs 500g, Riz Long Grain 1kg (4 deep)
 *   + Slim SRP/PAV Cardboard Trays for Sauce Tomate Basilic Bocaux (cuttable front flaps!)
 * - Tier 2 (Étagère Haute): Slim SRP/PAV Perforated Cardboard Trays for Petits Pois Carottes 400g &
 *   Moutarde de Dijon 250g sliding deep to the back wall, with front tear-away flaps cuttable by Cutter!
 * - Strict 320ms touch debounce and shared geometries/materials for locked 60 FPS on iPhone 16e.
 */
export function buildSavoryGroceryAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const gondRoot = new THREE.Group();
  gondRoot.position.set(-3.2, 0, -0.9);
  root.add(gondRoot);

  const totalLen = 5.2;
  const activeBayLen = 2.56;

  // ============================================================================
  // 1. 1990 GONDOLA STRUCTURE + DECORATIVE PASTA & CONSERVES ENDCAP ALCOVES
  // ============================================================================
  const harvestAccentMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.56 });
  const endcapShelfMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
  ctx.disposables.push(harvestAccentMat, endcapShelfMat);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.94, totalLen), mats.anthracite);
  spine.position.y = 0.97;
  spine.castShadow = true;
  spine.receiveShadow = true;

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, totalLen), mats.anthracite);
  basePlinth.position.y = 0.07;

  const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, totalLen + 0.04), mats.anthracite);
  topCanopy.position.y = 1.91;

  // Sober harvest-olive retail cornice trim along top canopy
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.028, totalLen + 0.04), harvestAccentMat);
  topTrim.position.y = 1.95;

  gondRoot.add(spine, basePlinth, topCanopy, topTrim);
  ctx.disposables.push(spine.geometry, basePlinth.geometry, topCanopy.geometry, topTrim.geometry);

  // Vertical bay dividers framing the central 2.56m interactive bays from the North/South display alcoves
  const dividerGeo = new THREE.BoxGeometry(1.06, 1.82, 0.06);
  ctx.disposables.push(dividerGeo);
  [-1.31, 1.31, -2.57, 2.57].forEach((pz) => {
    const div = new THREE.Mesh(dividerGeo, mats.anthracite);
    div.position.set(0, 0.99, pz);
    gondRoot.add(div);
  });

  // Double-sided 1990 French Retail Overhead Sign facing BOTH East & West aisles
  const signTex = texBank.createDepartmentSignTexture(
    'ÉPICERIE SALÉE · PÂTES & CONSERVES',
    'HUILES · CASSOULET · COQUILLETTES · SPAGHETTI · RIZ · SAUCES & MOUTARDE',
    '#1e293b',
    '#eab308'
  );
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.35 });
  const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 3.2), [
    signMat,
    signMat,
    mats.anthracite,
    mats.anthracite,
    mats.anthracite,
    mats.anthracite,
  ]);
  signMesh.position.set(0, 2.24, 0);
  gondRoot.add(signMesh);
  ctx.disposables.push(signMat, signMesh.geometry);

  // Exact Gondola 1 collision footprint (matches V1-V13 store grid)
  addBoxCollider(ctx, 'gondola_savory_pasta', -3.76, -2.64, -3.5, 1.7);

  // ============================================================================
  // 2. PROCEDURAL 1990 PACKAGING TEXTURES (WITH CRISP PRINTED EAN-8 BARCODES)
  // ============================================================================
  const makePackLabelMat = (
    brand: string,
    title: string,
    weight: string,
    bgHex: string,
    bannerHex: string,
    textHex: string,
    ean: string
  ): THREE.MeshStandardMaterial => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, 256, 256);

    c.fillStyle = bannerHex;
    c.fillRect(0, 0, 256, 48);
    c.strokeStyle = bannerHex;
    c.lineWidth = 4;
    c.strokeRect(4, 4, 248, 248);

    c.fillStyle = '#ffffff';
    c.font = '800 18px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(brand, 128, 24);

    c.fillStyle = textHex;
    c.font = '900 21px "Plus Jakarta Sans", sans-serif';
    c.fillText(title, 128, 88);

    c.fillStyle = bannerHex;
    c.fillRect(42, 114, 172, 34);
    c.fillStyle = '#ffffff';
    c.font = '800 17px "JetBrains Mono", monospace';
    c.fillText(weight, 128, 131);

    drawEanBarcode(c, ean, 34, 162, 188, 78, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.44 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  const makePavTrayFrontMat = (
    title: string,
    bgHex: string,
    ean: string
  ): THREE.MeshStandardMaterial => {
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
    c.font = '800 17px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(title, 128, 28);
    drawEanBarcode(c, ean, 44, 48, 168, 68, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Core Materials
  const sunOilGlassMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.16,
    metalness: 0.08,
  });
  const oliveGlassMat = new THREE.MeshStandardMaterial({
    color: 0x365314,
    roughness: 0.14,
    metalness: 0.18,
  });
  const yellowCapMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.4 });
  const goldCapMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.34,
    metalness: 0.48,
  });
  const tinSteelMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.28,
    metalness: 0.72,
  });
  const cassouletBandMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.48 });
  const coqBodyMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42 });
  const spagBodyMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.42 });
  const rizBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.56 });
  const tomatoGlassMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.18,
    metalness: 0.1,
  });
  const tomatoLidMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.36 });
  const peasCanMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.42 });
  const mustardJarMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.22,
    metalness: 0.08,
  });
  const whiteLabelMat = new THREE.MeshStandardMaterial({ color: 0xfffef8, roughness: 0.62 });

  ctx.disposables.push(
    sunOilGlassMat,
    oliveGlassMat,
    yellowCapMat,
    goldCapMat,
    tinSteelMat,
    cassouletBandMat,
    coqBodyMat,
    spagBodyMat,
    rizBodyMat,
    tomatoGlassMat,
    tomatoLidMat,
    peasCanMat,
    mustardJarMat,
    whiteLabelMat
  );

  // Label Materials with crisp EAN-8 Barcodes
  const sunOilLblMat = makePackLabelMat(
    'SOLEIL D’OR 90',
    'HUILE TOURNESOL',
    '1 LITRE · PURE',
    '#fef9c3',
    '#ca8a04',
    '#713f12',
    '30140701'
  );
  const oliveLblMat = makePackLabelMat(
    'PROVENCE 1990',
    "HUILE D'OLIVE",
    'VIERGE 75CL',
    '#ecfccb',
    '#3f6212',
    '#1a2e05',
    '30140702'
  );
  const cassouletLblMat = makePackLabelMat(
    'TERROIR SUD',
    'CASSOULET',
    'TOULOUSAIN 840G',
    '#fef2f2',
    '#991b1b',
    '#450a0a',
    '30140703'
  );
  const coqLblMat = makePackLabelMat(
    'PÂTES DE FRANCE',
    'COQUILLETTES',
    'BLÉ DUR 500G',
    '#dbeafe',
    '#1d4ed8',
    '#1e3a8a',
    '30140704'
  );
  const spagLblMat = makePackLabelMat(
    'PÂTES DE FRANCE',
    'SPAGHETTI',
    'SUPÉRIEURS 500G',
    '#fee2e2',
    '#b91c1c',
    '#7f1d1d',
    '30140705'
  );
  const rizLblMat = makePackLabelMat(
    'CAMARGUE 1990',
    'RIZ LONG GRAIN',
    'QUALITÉ 1KG',
    '#fef3c7',
    '#15803d',
    '#14532d',
    '30140706'
  );

  const tomatoPavFrontMat = makePavTrayFrontMat('SAUCE TOMATE BASILIC ×8', '#b91c1c', '30140707');
  const peasPavFrontMat = makePavTrayFrontMat('PETITS POIS CAROTTES ×8', '#15803d', '30140708');
  const mustardPavFrontMat = makePavTrayFrontMat('MOUTARDE DE DIJON ×8', '#a16207', '30140709');

  // Decorative Promotional Savory Alcoves in North & South Endcaps (Z = ±1.94, zero fake rails!)
  const promoBoxGeo = new THREE.BoxGeometry(0.36, 0.22, 0.32);
  ctx.disposables.push(promoBoxGeo);
  [-1.94, 1.94].forEach((alcoveZ) => {
    [0.16, 0.72, 1.26].forEach((sy, tierIdx) => {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.03, 1.16), endcapShelfMat);
      deck.position.set(0, sy - 0.015, alcoveZ);
      gondRoot.add(deck);
      ctx.disposables.push(deck.geometry);

      [-0.26, 0.26].forEach((px, pIdx) => {
        const promoMat =
          tierIdx === 0
            ? pIdx === 0
              ? sunOilLblMat
              : cassouletLblMat
            : tierIdx === 1
              ? pIdx === 0
                ? coqLblMat
                : spagLblMat
              : rizLblMat;
        const box = new THREE.Mesh(promoBoxGeo, promoMat);
        box.position.set(px, sy + 0.11, alcoveZ);
        gondRoot.add(box);
      });
    });
  });

  // ============================================================================
  // 3. SHARED PRODUCT GEOMETRIES & MESH BUILDERS (ALL 9 V14 PRODUCTS)
  // ============================================================================
  const sunBodyGeo = new THREE.CylinderGeometry(0.044, 0.046, 0.2, 14);
  const sunNeckGeo = new THREE.CylinderGeometry(0.017, 0.036, 0.056, 12);
  const sunCapGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.022, 12);
  const sunLblGeo = new THREE.PlaneGeometry(0.072, 0.1);

  const oliveBodyGeo = new THREE.CylinderGeometry(0.038, 0.04, 0.19, 14);
  const oliveNeckGeo = new THREE.CylinderGeometry(0.015, 0.022, 0.07, 12);
  const oliveCapGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.028, 12);
  const oliveLblGeo = new THREE.PlaneGeometry(0.064, 0.095);

  const cassCanGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.142, 16);
  const cassBandGeo = new THREE.CylinderGeometry(0.057, 0.057, 0.122, 16, 1, true);
  const cassLblGeo = new THREE.PlaneGeometry(0.092, 0.11);

  const coqPackGeo = new THREE.BoxGeometry(0.145, 0.21, 0.064);
  const coqLblGeo = new THREE.PlaneGeometry(0.128, 0.18);

  const spagPackGeo = new THREE.BoxGeometry(0.088, 0.265, 0.048);
  const spagLblGeo = new THREE.PlaneGeometry(0.078, 0.22);

  const rizBoxGeo = new THREE.BoxGeometry(0.155, 0.22, 0.074);
  const rizLblGeo = new THREE.PlaneGeometry(0.138, 0.195);

  // PAV Unit Geometries (2×4 rows inside each deep 0.44m slim cardboard tray)
  const pavJarGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.11, 12);
  const pavJarLblGeo = new THREE.CylinderGeometry(0.037, 0.037, 0.05, 12, 1, true);
  const pavJarLidGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.016, 12);

  const pavCanGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.105, 12);
  const pavCanLblGeo = new THREE.CylinderGeometry(0.039, 0.039, 0.086, 12, 1, true);

  const pavMustardGeo = new THREE.CylinderGeometry(0.034, 0.031, 0.098, 12);
  const pavMustardLblGeo = new THREE.CylinderGeometry(0.035, 0.033, 0.046, 12, 1, true);
  const pavMustardLidGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 12);

  ctx.disposables.push(
    sunBodyGeo,
    sunNeckGeo,
    sunCapGeo,
    sunLblGeo,
    oliveBodyGeo,
    oliveNeckGeo,
    oliveCapGeo,
    oliveLblGeo,
    cassCanGeo,
    cassBandGeo,
    cassLblGeo,
    coqPackGeo,
    coqLblGeo,
    spagPackGeo,
    spagLblGeo,
    rizBoxGeo,
    rizLblGeo,
    pavJarGeo,
    pavJarLblGeo,
    pavJarLidGeo,
    pavCanGeo,
    pavCanLblGeo,
    pavMustardGeo,
    pavMustardLblGeo,
    pavMustardLidGeo
  );

  const buildSunflowerOilMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(sunBodyGeo, sunOilGlassMat);
    body.position.y = 0.102;
    const neck = new THREE.Mesh(sunNeckGeo, sunOilGlassMat);
    neck.position.y = 0.228;
    const cap = new THREE.Mesh(sunCapGeo, yellowCapMat);
    cap.position.y = 0.264;
    const lbl = new THREE.Mesh(sunLblGeo, sunOilLblMat);
    lbl.position.set(0, 0.105, 0.0465);
    g.add(body, neck, cap, lbl);
    return g;
  };

  const buildOliveOilMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(oliveBodyGeo, oliveGlassMat);
    body.position.y = 0.097;
    const neck = new THREE.Mesh(oliveNeckGeo, oliveGlassMat);
    neck.position.y = 0.224;
    const cap = new THREE.Mesh(oliveCapGeo, goldCapMat);
    cap.position.y = 0.268;
    const lbl = new THREE.Mesh(oliveLblGeo, oliveLblMat);
    lbl.position.set(0, 0.102, 0.0405);
    g.add(body, neck, cap, lbl);
    return g;
  };

  const buildCassouletMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const can = new THREE.Mesh(cassCanGeo, tinSteelMat);
    can.position.y = 0.072;
    const band = new THREE.Mesh(cassBandGeo, cassouletBandMat);
    band.position.y = 0.072;
    const lbl = new THREE.Mesh(cassLblGeo, cassouletLblMat);
    lbl.position.set(0, 0.072, 0.058);
    g.add(can, band, lbl);
    return g;
  };

  const buildCoquillettesMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(coqPackGeo, coqBodyMat);
    body.position.y = 0.106;
    const lbl = new THREE.Mesh(coqLblGeo, coqLblMat);
    lbl.position.set(0, 0.106, 0.0335);
    g.add(body, lbl);
    return g;
  };

  const buildSpaghettiMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(spagPackGeo, spagBodyMat);
    body.position.y = 0.134;
    const lbl = new THREE.Mesh(spagLblGeo, spagLblMat);
    lbl.position.set(0, 0.134, 0.0255);
    g.add(body, lbl);
    return g;
  };

  const buildRizMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(rizBoxGeo, rizBodyMat);
    body.position.y = 0.111;
    const lbl = new THREE.Mesh(rizLblGeo, rizLblMat);
    lbl.position.set(0, 0.111, 0.0385);
    g.add(body, lbl);
    return g;
  };

  // Multi-depth Variant Specs
  const sunOilVariant: MultiDepthVariantSpec = {
    kind: 'savory_huile_tournesol',
    ean: '30140701',
    label: 'Huile de Tournesol 1L',
    sublabel: 'Épicerie Salée & Pâtes · 11,50 ₣',
    buildMesh: buildSunflowerOilMesh,
  };
  const oliveOilVariant: MultiDepthVariantSpec = {
    kind: 'savory_huile_olive',
    ean: '30140702',
    label: "Huile d'Olive Vierge 75cl",
    sublabel: 'Épicerie Salée & Pâtes · 26,00 ₣',
    buildMesh: buildOliveOilMesh,
  };
  const cassouletVariant: MultiDepthVariantSpec = {
    kind: 'savory_cassoulet',
    ean: '30140703',
    label: 'Cassoulet Toulousain 840g',
    sublabel: 'Épicerie Salée & Pâtes · 17,80 ₣',
    buildMesh: buildCassouletMesh,
  };
  const coquillettesVariant: MultiDepthVariantSpec = {
    kind: 'savory_coquillettes',
    ean: '30140704',
    label: 'Pâtes Coquillettes 500g',
    sublabel: 'Épicerie Salée & Pâtes · 5,40 ₣',
    buildMesh: buildCoquillettesMesh,
  };
  const spaghettiVariant: MultiDepthVariantSpec = {
    kind: 'savory_spaghetti',
    ean: '30140705',
    label: 'Spaghetti Supérieurs 500g',
    sublabel: 'Épicerie Salée & Pâtes · 5,80 ₣',
    buildMesh: buildSpaghettiMesh,
  };
  const rizVariant: MultiDepthVariantSpec = {
    kind: 'savory_riz',
    ean: '30140706',
    label: 'Riz Long Grain 1kg',
    sublabel: 'Épicerie Salée & Pâtes · 12,20 ₣',
    buildMesh: buildRizMesh,
  };

  // ============================================================================
  // 4. BUILD BOTH EAST (+X) & WEST (-X) 3-TIER INTERACTIVE SAVORY GROCERY FACES
  //    - 100% Bare metal shelf fronts at start (clip-on transparent plastic rails!)
  //    - Tier 0 (Étagère Basse): Oils & Large Cassoulet Tins (4-deep + Facing)
  //    - Tier 1 (Étagère Centrale): Coquillettes, Spaghetti, Rice (4-deep) + Sauce Tomate PAV
  //    - Tier 2 (Étagère Haute): Petits Pois Carottes PAV & Moutarde de Dijon PAV
  // ============================================================================
  const shelfYs = [0.16, 0.72, 1.26];
  const shelfNames = [
    'Étagère Basse (Huiles & Cassoulet)',
    'Étagère Centrale (Pâtes, Riz & Sauces PAV)',
    'Étagère Haute (Conserves Légumes & Moutarde PAV)',
  ];

  const buildSavoryFace = (faceKey: 'east' | 'west', rotY: number) => {
    const faceGroup = new THREE.Group();
    faceGroup.rotation.y = rotY;
    gondRoot.add(faceGroup);

    // 3 Bare Metal Tiers with manual clip-on 120cm plastic rails & 4 visible price tags/rail
    const helper = buildBareShelfWithInstallableRails(ctx, faceGroup, mats, tools, {
      idPrefix: `savory_${faceKey}`,
      shelfYs,
      shelfNames,
      shelfWidth: activeBayLen,
      shelfDepth: 0.5,
      tierSlotXs: [
        // Tier 0 (Bottom): Tournesol (L0-L1), Olive (L2-L3), Cassoulet (R0-R3)
        [[-1.06, -0.76, -0.44, -0.14], [0.22, 0.52, 0.82, 1.08]],
        // Tier 1 (Middle): Coquillettes (L0-L1), Spaghetti (L2-L3), Riz (R0-R1), Sauce Tomate PAV (R2-R3)
        [[-1.08, -0.78, -0.46, -0.14], [0.18, 0.48, 0.82, 1.12]],
        // Tier 2 (Top): Petits Pois PAV (Left), Moutarde Dijon PAV (Right)
        [[-1.02, -0.72, -0.42, -0.14], [0.18, 0.48, 0.78, 1.06]],
      ],
      expectedSlotEans: (tierIdx, sideKey, subIdx) => {
        if (tierIdx === 0) {
          if (sideKey === 'L') return subIdx <= 1 ? ['30140701'] : ['30140702'];
          return ['30140703'];
        }
        if (tierIdx === 1) {
          if (sideKey === 'L') return subIdx <= 1 ? ['30140704'] : ['30140705'];
          return subIdx <= 1 ? ['30140706'] : ['30140707'];
        }
        return sideKey === 'L' ? ['30140708'] : ['30140709'];
      },
    });

    // ------------------------------------------------------------------------
    // TIER 0 — ÉTAGÈRE BASSE (Y = 0.16): HUILES DE CUISSON & CASSOULET 840G
    // ------------------------------------------------------------------------
    const bottomCols: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      colWidth: number;
      itemHeight: number;
      itemDepth: number;
      sound: 'bag' | 'glass' | 'tin';
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.06,
        variant: sunOilVariant,
        colWidth: 0.24,
        itemHeight: 0.28,
        itemDepth: 0.095,
        sound: 'bag',
        init: [null, null, null, null],
      },
      {
        x: -0.74,
        variant: sunOilVariant,
        colWidth: 0.24,
        itemHeight: 0.28,
        itemDepth: 0.095,
        sound: 'bag',
        init: [null, null, null, null],
      },
      {
        x: -0.38,
        variant: oliveOilVariant,
        colWidth: 0.24,
        itemHeight: 0.28,
        itemDepth: 0.088,
        sound: 'glass',
        init: [null, null, null, null],
      },
      {
        x: -0.06,
        variant: oliveOilVariant,
        colWidth: 0.24,
        itemHeight: 0.28,
        itemDepth: 0.088,
        sound: 'glass',
        init: [null, null, null, null],
      },
      {
        x: 0.42,
        variant: cassouletVariant,
        colWidth: 0.32,
        itemHeight: 0.16,
        itemDepth: 0.112,
        sound: 'tin',
        init: [null, null, null, null],
      },
      {
        x: 0.92,
        variant: cassouletVariant,
        colWidth: 0.32,
        itemHeight: 0.16,
        itemDepth: 0.112,
        sound: 'tin',
        init: [null, null, null, null],
      },
    ];

    bottomCols.forEach((c, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `savory_${faceKey}_bot_${idx}`,
        tierName: shelfNames[0],
        x: c.x,
        y: shelfYs[0],
        shelfFrontZ: 0.52,
        shelfBackZ: 0.06,
        colWidth: c.colWidth,
        itemHeight: c.itemHeight,
        itemDepth: c.itemDepth,
        depthCount: 4,
        variants: [c.variant],
        initialSlots: c.init,
        placementSound: c.sound,
      });
    });

    // ------------------------------------------------------------------------
    // TIER 1 — ÉTAGÈRE CENTRALE (Y = 0.72): PÂTES, RIZ (4-DEEP) + SAUCE TOMATE PAV
    // ------------------------------------------------------------------------
    const midCols: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      colWidth: number;
      itemHeight: number;
      itemDepth: number;
      sound: 'foil' | 'bag';
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.08,
        variant: coquillettesVariant,
        colWidth: 0.25,
        itemHeight: 0.22,
        itemDepth: 0.072,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: -0.78,
        variant: coquillettesVariant,
        colWidth: 0.25,
        itemHeight: 0.22,
        itemDepth: 0.072,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: -0.46,
        variant: spaghettiVariant,
        colWidth: 0.25,
        itemHeight: 0.27,
        itemDepth: 0.062,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: -0.14,
        variant: spaghettiVariant,
        colWidth: 0.25,
        itemHeight: 0.27,
        itemDepth: 0.062,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: 0.18,
        variant: rizVariant,
        colWidth: 0.26,
        itemHeight: 0.23,
        itemDepth: 0.082,
        sound: 'bag',
        init: [null, null, null, null],
      },
      {
        x: 0.48,
        variant: rizVariant,
        colWidth: 0.26,
        itemHeight: 0.23,
        itemDepth: 0.082,
        sound: 'bag',
        init: [null, null, null, null],
      },
    ];

    midCols.forEach((c, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `savory_${faceKey}_mid_${idx}`,
        tierName: shelfNames[1],
        x: c.x,
        y: shelfYs[1],
        shelfFrontZ: 0.52,
        shelfBackZ: 0.06,
        colWidth: c.colWidth,
        itemHeight: c.itemHeight,
        itemDepth: c.itemDepth,
        depthCount: 4,
        variants: [c.variant],
        initialSlots: c.init,
        placementSound: c.sound,
      });
    });

    // Right side of Tier 1: 2 Slim PAV/SRP Cardboard Trays for Sauce Tomate Basilic Bocaux (×8)
    const tomatoPavLanes = [
      { x: 0.82, hasTray: false, flapCut: false, units: 0 },
      { x: 1.12, hasTray: false, flapCut: false, units: 0 },
    ];

    tomatoPavLanes.forEach((lane, idx) => {
      buildSrpPavLane(ctx, faceGroup, helper, tools, {
        id: `savory_${faceKey}_tomato_pav_${idx}`,
        x: lane.x,
        y: shelfYs[1],
        trayKind: 'savory_sauce_tomate_pav',
        unitKind: 'savory_sauce_tomate_jar',
        trayLabel: 'Présentoir PAV Sauce Tomate Basilic (×8)',
        unitLabel: 'Bocal Sauce Tomate Basilic',
        ean: '30140707',
        trayWidth: 0.25,
        trayDepth: 0.44,
        trayHeight: 0.13,
        maxUnits: 8,
        initialHasTray: lane.hasTray,
        initialFlapCut: lane.flapCut,
        initialUnits: lane.units,
        accentColor: 0xdc2626,
        frontMat: tomatoPavFrontMat,
        buildUnitMesh: (uIdx) => {
          // 2×4 grid of glass tomato-basil jars lined deep back-to-front inside the PAV tray
          const col = uIdx % 2;
          const row = Math.floor(uIdx / 2);
          const g = new THREE.Group();
          const body = new THREE.Mesh(pavJarGeo, tomatoGlassMat);
          body.position.y = 0.06;
          const lbl = new THREE.Mesh(pavJarLblGeo, whiteLabelMat);
          lbl.position.y = 0.06;
          const lid = new THREE.Mesh(pavJarLidGeo, tomatoLidMat);
          lid.position.y = 0.122;
          g.add(body, lbl, lid);
          g.position.set(col === 0 ? -0.048 : 0.048, 0, -0.15 + row * 0.1);
          return g;
        },
      });
    });

    // ------------------------------------------------------------------------
    // TIER 2 — ÉTAGÈRE HAUTE (Y = 1.26): SLIM SRP/PAV TRAYS (PETITS POIS & MOUTARDE)
    //          Sliding deep to the back wall, with front tear-away flaps for Cutter!
    // ------------------------------------------------------------------------
    const peasPavLanes = [
      { x: -1.0, hasTray: false, flapCut: false, units: 0 },
      { x: -0.6, hasTray: false, flapCut: false, units: 0 },
      { x: -0.2, hasTray: false, flapCut: false, units: 0 },
    ];

    peasPavLanes.forEach((lane, idx) => {
      buildSrpPavLane(ctx, faceGroup, helper, tools, {
        id: `savory_${faceKey}_peas_pav_${idx}`,
        x: lane.x,
        y: shelfYs[2],
        trayKind: 'savory_petits_pois_pav',
        unitKind: 'savory_petits_pois_can',
        trayLabel: 'Présentoir PAV Petits Pois Carottes 400g (×8)',
        unitLabel: 'Boîte Petits Pois Carottes 400g',
        ean: '30140708',
        trayWidth: 0.28,
        trayDepth: 0.44,
        trayHeight: 0.12,
        maxUnits: 8,
        initialHasTray: lane.hasTray,
        initialFlapCut: lane.flapCut,
        initialUnits: lane.units,
        accentColor: 0x16a34a,
        frontMat: peasPavFrontMat,
        buildUnitMesh: (uIdx) => {
          // 2×4 grid of 400g green vegetable tin cans lined deep back-to-front inside PAV tray
          const col = uIdx % 2;
          const row = Math.floor(uIdx / 2);
          const g = new THREE.Group();
          const can = new THREE.Mesh(pavCanGeo, tinSteelMat);
          can.position.y = 0.058;
          const lbl = new THREE.Mesh(pavCanLblGeo, peasCanMat);
          lbl.position.y = 0.058;
          g.add(can, lbl);
          g.position.set(col === 0 ? -0.054 : 0.054, 0, -0.15 + row * 0.1);
          return g;
        },
      });
    });

    const mustardPavLanes = [
      { x: 0.22, hasTray: false, flapCut: false, units: 0 },
      { x: 0.62, hasTray: false, flapCut: false, units: 0 },
      { x: 1.02, hasTray: false, flapCut: false, units: 0 },
    ];

    mustardPavLanes.forEach((lane, idx) => {
      buildSrpPavLane(ctx, faceGroup, helper, tools, {
        id: `savory_${faceKey}_mustard_pav_${idx}`,
        x: lane.x,
        y: shelfYs[2],
        trayKind: 'savory_moutarde_pav',
        unitKind: 'savory_moutarde_jar',
        trayLabel: 'Présentoir PAV Moutarde de Dijon 250g (×8)',
        unitLabel: 'Pot Moutarde de Dijon 250g',
        ean: '30140709',
        trayWidth: 0.28,
        trayDepth: 0.44,
        trayHeight: 0.12,
        maxUnits: 8,
        initialHasTray: lane.hasTray,
        initialFlapCut: lane.flapCut,
        initialUnits: lane.units,
        accentColor: 0xca8a04,
        frontMat: mustardPavFrontMat,
        buildUnitMesh: (uIdx) => {
          // 2×4 grid of glass Dijon mustard jars lined deep back-to-front inside PAV tray
          const col = uIdx % 2;
          const row = Math.floor(uIdx / 2);
          const g = new THREE.Group();
          const jar = new THREE.Mesh(pavMustardGeo, mustardJarMat);
          jar.position.y = 0.055;
          const lbl = new THREE.Mesh(pavMustardLblGeo, whiteLabelMat);
          lbl.position.y = 0.055;
          const lid = new THREE.Mesh(pavMustardLidGeo, yellowCapMat);
          lid.position.y = 0.11;
          g.add(jar, lbl, lid);
          g.position.set(col === 0 ? -0.052 : 0.052, 0, -0.15 + row * 0.1);
          return g;
        },
      });
    });
  };

  // Mount interactive 3-tier Savory Grocery & Pasta shelving on BOTH East (+X) and West (-X) faces!
  buildSavoryFace('east', Math.PI / 2);
  buildSavoryFace('west', -Math.PI / 2);
}
