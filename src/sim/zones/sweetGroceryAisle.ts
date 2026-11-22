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
 * V13 DEPARTMENT 7B — "RAYON 7B — ÉPICERIE SUCRÉE & SNACKS (1990)"
 * Positioned on Gondola 2 (X = 0.0, Z = -0.9, total length 5.20m) in sober 1990 French retail styling.
 * Features:
 * - Zero pre-spawned loose cardboard boxes (ordered via Terminal Commande 1990 -> Warehouse dock)
 * - Both EAST (+X) and WEST (-X) central 2.56m merchandising bays feature 3 bare metal tiers
 *   (zero pre-installed plastic rails or price tags at game start)
 * - Tier 0 (Étagère Basse): Chips Nature 200g, Chips BBQ & Paprika 200g, Biscuits Sablés Pur Beurre (4 deep)
 * - Tier 1 (Étagère Centrale): Pâte à Tartiner Noisettes 400g (glass jars), Madeleines ×12, Gaufrettes Chocolat (4 deep)
 * - Tier 2 (Étagère Haute): Slim SRP/PAV Perforated Cardboard Trays for Tablettes Chocolat & Sachets Bonbons
 *   sliding deep to the back wall, with front tear-away flaps cuttable by the Cutter!
 * - Strict 320ms touch debounce and shared geometries/materials for locked 60 FPS on iPhone 16e.
 */
export function buildSweetGroceryAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const gondRoot = new THREE.Group();
  gondRoot.position.set(0.0, 0, -0.9);
  root.add(gondRoot);

  const totalLen = 5.2;
  const activeBayLen = 2.56;

  // ============================================================================
  // 1. 1990 GONDOLA STRUCTURE + PROMOTIONAL BISCUIT & SNACK ENDCAP ALCOVES
  // ============================================================================
  const warmAccentMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
  const endcapShelfMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.45 });
  ctx.disposables.push(warmAccentMat, endcapShelfMat);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.94, totalLen), mats.anthracite);
  spine.position.y = 0.97;
  spine.castShadow = true;
  spine.receiveShadow = true;

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, totalLen), mats.anthracite);
  basePlinth.position.y = 0.07;

  const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.08, totalLen + 0.04), mats.anthracite);
  topCanopy.position.y = 1.91;

  // Warm caramel retail cornice band along top canopy
  const topTrim = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.028, totalLen + 0.04), warmAccentMat);
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
    'ÉPICERIE SUCRÉE · BISCUITS & SNACKS',
    'CHIPS · SABLÉS PUR BEURRE · PÂTE À TARTINER · MADELEINES · CHOCOLATS & BONBONS',
    '#7c2d12',
    '#f59e0b'
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

  // Exact Gondola 2 collision footprint (matches V1-V12 store grid)
  addBoxCollider(ctx, 'gondola_sweet_snacks', -0.56, 0.56, -3.5, 1.7);

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
    c.font = '900 22px "Plus Jakarta Sans", sans-serif';
    c.fillText(title, 128, 88);

    c.fillStyle = bannerHex;
    c.fillRect(46, 114, 164, 34);
    c.fillStyle = '#ffffff';
    c.font = '800 18px "JetBrains Mono", monospace';
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
    c.font = '800 18px "Plus Jakarta Sans", sans-serif';
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

  // Materials
  const chipsNatBodyMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.26,
    metalness: 0.24,
  });
  const chipsBbqBodyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.26,
    metalness: 0.24,
  });
  const foilSeamMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    roughness: 0.32,
    metalness: 0.36,
  });
  const sablesBodyMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.56 });
  const spreadGlassMat = new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.14,
    metalness: 0.12,
  });
  const spreadLidMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34 });
  const madeleineBodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.42 });
  const waferBodyMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.46 });
  const chocoWrapA = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.38 });
  const chocoWrapB = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.38 });
  const bonbonMatA = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.32 });
  const bonbonMatB = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.32 });
  const bonbonMatC = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.32 });

  ctx.disposables.push(
    chipsNatBodyMat,
    chipsBbqBodyMat,
    foilSeamMat,
    sablesBodyMat,
    spreadGlassMat,
    spreadLidMat,
    madeleineBodyMat,
    waferBodyMat,
    chocoWrapA,
    chocoWrapB,
    bonbonMatA,
    bonbonMatB,
    bonbonMatC
  );

  // Label Materials with EAN-8 Barcodes
  const chipsNatLblMat = makePackLabelMat(
    'CRAQ’OR 1990',
    'CHIPS NATURE',
    '200G · SALÉES',
    '#fef08a',
    '#ca8a04',
    '#713f12',
    '30140601'
  );
  const chipsBbqLblMat = makePackLabelMat(
    'CRAQ’OR 1990',
    'CHIPS BBQ',
    'PAPRIKA 200G',
    '#fee2e2',
    '#b91c1c',
    '#7f1d1d',
    '30140602'
  );
  const sablesLblMat = makePackLabelMat(
    'BISCUITERIE 90',
    'SABLÉS BEURRE',
    'PUR BEURRE',
    '#fef9c3',
    '#b45309',
    '#78350f',
    '30140603'
  );
  const spreadLblMat = makePackLabelMat(
    'NOISETTE D’OR',
    'PÂTE TARTINER',
    'NOISETTES 400G',
    '#fffef8',
    '#991b1b',
    '#1e293b',
    '30140604'
  );
  const madeleineLblMat = makePackLabelMat(
    'FOURNIL DOUX',
    'MADELEINES ×12',
    'MOELLEUSES',
    '#ffedd5',
    '#c2410c',
    '#7c2d12',
    '30140605'
  );
  const waferLblMat = makePackLabelMat(
    'CHOC’CROQ',
    'GAUFRETTES',
    'CHOCOLAT',
    '#fef3c7',
    '#7c2d12',
    '#451a03',
    '30140606'
  );

  const chocoPavFrontMat = makePavTrayFrontMat('CHOCOLAT LAIT/NOISETTES ×10', '#581c87', '30140607');
  const bonbonPavFrontMat = makePavTrayFrontMat('BONBONS & CONFISERIES ×8', '#be185d', '30140608');

  // Decorative Promotional Snack Stack in North & South Endcap Alcoves (Z = ±1.94, zero fake rails!)
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
              ? chipsNatLblMat
              : chipsBbqLblMat
            : tierIdx === 1
              ? sablesLblMat
              : madeleineLblMat;
        const box = new THREE.Mesh(promoBoxGeo, promoMat);
        box.position.set(px, sy + 0.11, alcoveZ);
        gondRoot.add(box);
      });
    });
  });

  // ============================================================================
  // 3. SHARED PRODUCT GEOMETRIES & MESH BUILDERS (ALL 8 V13 PRODUCTS)
  // ============================================================================
  const chipBagGeo = new THREE.BoxGeometry(0.165, 0.24, 0.072);
  const chipCrimpGeo = new THREE.BoxGeometry(0.172, 0.018, 0.018);
  const chipLblGeo = new THREE.PlaneGeometry(0.145, 0.19);

  const sablesBoxGeo = new THREE.BoxGeometry(0.22, 0.145, 0.088);
  const sablesLblGeo = new THREE.PlaneGeometry(0.195, 0.125);

  const spreadJarGeo = new THREE.CylinderGeometry(0.052, 0.048, 0.13, 14);
  const spreadLidGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.025, 14);
  const spreadLblGeo = new THREE.PlaneGeometry(0.086, 0.076);

  const madPackGeo = new THREE.BoxGeometry(0.21, 0.115, 0.11);
  const madLblGeo = new THREE.PlaneGeometry(0.185, 0.098);

  const waferPackGeo = new THREE.BoxGeometry(0.125, 0.21, 0.076);
  const waferLblGeo = new THREE.PlaneGeometry(0.108, 0.18);

  const chocoBarGeo = new THREE.BoxGeometry(0.165, 0.095, 0.018);
  const bonbonPouchGeo = new THREE.BoxGeometry(0.145, 0.12, 0.028);

  ctx.disposables.push(
    chipBagGeo,
    chipCrimpGeo,
    chipLblGeo,
    sablesBoxGeo,
    sablesLblGeo,
    spreadJarGeo,
    spreadLidGeo,
    spreadLblGeo,
    madPackGeo,
    madLblGeo,
    waferPackGeo,
    waferLblGeo,
    chocoBarGeo,
    bonbonPouchGeo
  );

  const buildChipBagMesh = (bodyMat: THREE.Material, lblMat: THREE.Material): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(chipBagGeo, bodyMat);
    body.position.y = 0.128;
    const topC = new THREE.Mesh(chipCrimpGeo, foilSeamMat);
    topC.position.y = 0.252;
    const botC = new THREE.Mesh(chipCrimpGeo, foilSeamMat);
    botC.position.y = 0.008;
    const lbl = new THREE.Mesh(chipLblGeo, lblMat);
    lbl.position.set(0, 0.128, 0.0375);
    g.add(body, topC, botC, lbl);
    return g;
  };

  const buildSablesBoxMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(sablesBoxGeo, sablesBodyMat);
    body.position.y = 0.074;
    const lbl = new THREE.Mesh(sablesLblGeo, sablesLblMat);
    lbl.position.set(0, 0.074, 0.0455);
    g.add(body, lbl);
    return g;
  };

  const buildSpreadJarMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(spreadJarGeo, spreadGlassMat);
    body.position.y = 0.066;
    const lid = new THREE.Mesh(spreadLidGeo, spreadLidMat);
    lid.position.y = 0.142;
    const lbl = new THREE.Mesh(spreadLblGeo, spreadLblMat);
    lbl.position.set(0, 0.068, 0.0525);
    g.add(body, lid, lbl);
    return g;
  };

  const buildMadeleinesMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(madPackGeo, madeleineBodyMat);
    body.position.y = 0.059;
    const lbl = new THREE.Mesh(madLblGeo, madeleineLblMat);
    lbl.position.set(0, 0.059, 0.0565);
    g.add(body, lbl);
    return g;
  };

  const buildGaufrettesMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(waferPackGeo, waferBodyMat);
    body.position.y = 0.106;
    const lbl = new THREE.Mesh(waferLblGeo, waferLblMat);
    lbl.position.set(0, 0.106, 0.0395);
    g.add(body, lbl);
    return g;
  };

  // Multi-depth Variant Specs
  const chipsNatVariant: MultiDepthVariantSpec = {
    kind: 'snack_chips_nature',
    ean: '30140601',
    label: 'Chips Nature Craquantes 200g',
    sublabel: 'Épicerie Sucrée & Snacks · 8,90 ₣',
    buildMesh: () => buildChipBagMesh(chipsNatBodyMat, chipsNatLblMat),
  };
  const chipsBbqVariant: MultiDepthVariantSpec = {
    kind: 'snack_chips_bbq',
    ean: '30140602',
    label: 'Chips Barbecue & Paprika 200g',
    sublabel: 'Épicerie Sucrée & Snacks · 9,50 ₣',
    buildMesh: () => buildChipBagMesh(chipsBbqBodyMat, chipsBbqLblMat),
  };
  const sablesVariant: MultiDepthVariantSpec = {
    kind: 'snack_biscuits_sables',
    ean: '30140603',
    label: 'Biscuits Sablés Pur Beurre',
    sublabel: 'Épicerie Sucrée & Snacks · 13,80 ₣',
    buildMesh: buildSablesBoxMesh,
  };
  const spreadVariant: MultiDepthVariantSpec = {
    kind: 'snack_pate_tartiner',
    ean: '30140604',
    label: 'Pâte à Tartiner Noisettes 400g',
    sublabel: 'Épicerie Sucrée & Snacks · 16,50 ₣',
    buildMesh: buildSpreadJarMesh,
  };
  const madeleineVariant: MultiDepthVariantSpec = {
    kind: 'snack_madeleines',
    ean: '30140605',
    label: 'Madeleines Moelleuses ×12',
    sublabel: 'Épicerie Sucrée & Snacks · 11,20 ₣',
    buildMesh: buildMadeleinesMesh,
  };
  const gaufretteVariant: MultiDepthVariantSpec = {
    kind: 'snack_gaufrettes',
    ean: '30140606',
    label: 'Gaufrettes Fourrées Chocolat',
    sublabel: 'Épicerie Sucrée & Snacks · 9,80 ₣',
    buildMesh: buildGaufrettesMesh,
  };

  // ============================================================================
  // 4. BUILD BOTH EAST (+X) & WEST (-X) 3-TIER INTERACTIVE SWEET GROCERY FACES
  //    - 100% Bare metal shelf fronts at start (clip-on transparent plastic rails!)
  //    - Tier 0 & Tier 1: Multi-depth 4-slot columns + [FAIRE LE FACING]
  //    - Tier 2: Slim SRP/PAV perforated cardboard trays (Chocolats & Bonbons)
  // ============================================================================
  const shelfYs = [0.16, 0.72, 1.26];
  const shelfNames = [
    'Étagère Basse (Chips & Sablés)',
    'Étagère Centrale (Pâte à Tartiner, Madeleines & Gaufrettes)',
    'Étagère Haute (Présentoirs PAV Chocolats & Bonbons)',
  ];

  const buildSweetFace = (faceKey: 'east' | 'west', rotY: number) => {
    const faceGroup = new THREE.Group();
    faceGroup.rotation.y = rotY;
    gondRoot.add(faceGroup);

    // 3 Bare Metal Tiers with manual clip-on 120cm plastic rails & 4 visible price tags/rail
    const helper = buildBareShelfWithInstallableRails(ctx, faceGroup, mats, tools, {
      idPrefix: `sweet_${faceKey}`,
      shelfYs,
      shelfNames,
      shelfWidth: activeBayLen,
      shelfDepth: 0.5,
      tierSlotXs: [
        // Tier 0 (Bottom): Chips Nature (L0-L1), Chips BBQ (L2-L3), Biscuits Sablés (R0-R3)
        [[-1.06, -0.76, -0.44, -0.14], [0.22, 0.52, 0.82, 1.08]],
        // Tier 1 (Middle): Pâte à Tartiner (L0-L1), Madeleines (L2-R1), Gaufrettes (R2-R3)
        [[-1.06, -0.76, -0.42, -0.12], [0.18, 0.48, 0.78, 1.06]],
        // Tier 2 (Top): Chocolat PAV (Left), Bonbons PAV (Right)
        [[-1.02, -0.72, -0.42, -0.14], [0.18, 0.48, 0.78, 1.06]],
      ],
      expectedSlotEans: (tierIdx, sideKey, subIdx) => {
        if (tierIdx === 0) {
          if (sideKey === 'L') return subIdx <= 1 ? ['30140601'] : ['30140602'];
          return ['30140603'];
        }
        if (tierIdx === 1) {
          if (sideKey === 'L') return subIdx <= 1 ? ['30140604'] : ['30140605'];
          return subIdx <= 1 ? ['30140605'] : ['30140606'];
        }
        return sideKey === 'L' ? ['30140607'] : ['30140608'];
      },
    });

    // ------------------------------------------------------------------------
    // TIER 0 — ÉTAGÈRE BASSE (Y = 0.16): CHIPS NATURE, CHIPS BBQ & SABLÉS BEURRE
    // ------------------------------------------------------------------------
    const bottomCols: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      colWidth: number;
      itemHeight: number;
      itemDepth: number;
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.04,
        variant: chipsNatVariant,
        colWidth: 0.28,
        itemHeight: 0.26,
        itemDepth: 0.082,
        init: [null, null, null, null],
      },
      {
        x: -0.72,
        variant: chipsNatVariant,
        colWidth: 0.28,
        itemHeight: 0.26,
        itemDepth: 0.082,
        init: [null, null, null, null],
      },
      {
        x: -0.36,
        variant: chipsBbqVariant,
        colWidth: 0.28,
        itemHeight: 0.26,
        itemDepth: 0.082,
        init: [null, null, null, null],
      },
      {
        x: -0.02,
        variant: chipsBbqVariant,
        colWidth: 0.28,
        itemHeight: 0.26,
        itemDepth: 0.082,
        init: [null, null, null, null],
      },
      {
        x: 0.42,
        variant: sablesVariant,
        colWidth: 0.36,
        itemHeight: 0.16,
        itemDepth: 0.095,
        init: [null, null, null, null],
      },
      {
        x: 0.92,
        variant: sablesVariant,
        colWidth: 0.36,
        itemHeight: 0.16,
        itemDepth: 0.095,
        init: [null, null, null, null],
      },
    ];

    bottomCols.forEach((c, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `sweet_${faceKey}_bot_${idx}`,
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
        placementSound: 'foil',
      });
    });

    // ------------------------------------------------------------------------
    // TIER 1 — ÉTAGÈRE CENTRALE (Y = 0.72): PÂTE À TARTINER, MADELEINES, GAUFRETTES
    // ------------------------------------------------------------------------
    const midCols: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      colWidth: number;
      itemHeight: number;
      itemDepth: number;
      sound: 'glass' | 'foil';
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.04,
        variant: spreadVariant,
        colWidth: 0.26,
        itemHeight: 0.16,
        itemDepth: 0.105,
        sound: 'glass',
        init: [null, null, null, null],
      },
      {
        x: -0.74,
        variant: spreadVariant,
        colWidth: 0.26,
        itemHeight: 0.16,
        itemDepth: 0.105,
        sound: 'glass',
        init: [null, null, null, null],
      },
      {
        x: -0.34,
        variant: madeleineVariant,
        colWidth: 0.34,
        itemHeight: 0.13,
        itemDepth: 0.11,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: 0.08,
        variant: madeleineVariant,
        colWidth: 0.34,
        itemHeight: 0.13,
        itemDepth: 0.11,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: 0.56,
        variant: gaufretteVariant,
        colWidth: 0.28,
        itemHeight: 0.22,
        itemDepth: 0.084,
        sound: 'foil',
        init: [null, null, null, null],
      },
      {
        x: 0.94,
        variant: gaufretteVariant,
        colWidth: 0.28,
        itemHeight: 0.22,
        itemDepth: 0.084,
        sound: 'foil',
        init: [null, null, null, null],
      },
    ];

    midCols.forEach((c, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `sweet_${faceKey}_mid_${idx}`,
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

    // ------------------------------------------------------------------------
    // TIER 2 — ÉTAGÈRE HAUTE (Y = 1.26): SLIM SRP/PAV TRAYS (CHOCOLATS & BONBONS)
    //          Sliding deep to the back wall, with front tear-away flaps for Cutter!
    // ------------------------------------------------------------------------
    const chocoPavLanes = [
      { x: -1.0, hasTray: false, flapCut: false, units: 0 },
      { x: -0.6, hasTray: false, flapCut: false, units: 0 },
      { x: -0.2, hasTray: false, flapCut: false, units: 0 },
    ];

    chocoPavLanes.forEach((lane, idx) => {
      buildSrpPavLane(ctx, faceGroup, helper, tools, {
        id: `sweet_${faceKey}_choco_pav_${idx}`,
        x: lane.x,
        y: shelfYs[2],
        trayKind: 'snack_choco_pav',
        unitKind: 'snack_choco_bar',
        trayLabel: 'Présentoir PAV Tablettes Chocolat (×10)',
        unitLabel: 'Tablette Chocolat Lait/Noisettes',
        ean: '30140607',
        trayWidth: 0.28,
        trayDepth: 0.44,
        trayHeight: 0.12,
        maxUnits: 10,
        initialHasTray: lane.hasTray,
        initialFlapCut: lane.flapCut,
        initialUnits: lane.units,
        accentColor: 0x7c3aed,
        frontMat: chocoPavFrontMat,
        buildUnitMesh: (uIdx) => {
          // 10 standing chocolate bars lined back-to-front inside the slim PAV tray
          const bar = new THREE.Mesh(chocoBarGeo, uIdx % 2 === 0 ? chocoWrapA : chocoWrapB);
          bar.position.set(0, 0.055, -0.16 + uIdx * 0.036);
          return bar;
        },
      });
    });

    const bonbonPavLanes = [
      { x: 0.22, hasTray: false, flapCut: false, units: 0 },
      { x: 0.62, hasTray: false, flapCut: false, units: 0 },
      { x: 1.02, hasTray: false, flapCut: false, units: 0 },
    ];

    bonbonPavLanes.forEach((lane, idx) => {
      buildSrpPavLane(ctx, faceGroup, helper, tools, {
        id: `sweet_${faceKey}_bonbon_pav_${idx}`,
        x: lane.x,
        y: shelfYs[2],
        trayKind: 'snack_bonbons_pav',
        unitKind: 'snack_bonbons_bag',
        trayLabel: 'Présentoir PAV Sachets Bonbons (×8)',
        unitLabel: 'Sachet Bonbons & Confiseries',
        ean: '30140608',
        trayWidth: 0.28,
        trayDepth: 0.44,
        trayHeight: 0.13,
        maxUnits: 8,
        initialHasTray: lane.hasTray,
        initialFlapCut: lane.flapCut,
        initialUnits: lane.units,
        accentColor: 0xec4899,
        frontMat: bonbonPavFrontMat,
        buildUnitMesh: (uIdx) => {
          // 8 colorful standing candy pouches lined back-to-front inside the slim PAV tray
          const matsArr = [bonbonMatA, bonbonMatB, bonbonMatC];
          const pouch = new THREE.Mesh(bonbonPouchGeo, matsArr[uIdx % matsArr.length]);
          pouch.position.set(0, 0.068, -0.15 + uIdx * 0.043);
          return pouch;
        },
      });
    });
  };

  // Mount interactive 3-tier Sweet Grocery & Snacks shelving on BOTH East (+X) and West (-X) faces!
  buildSweetFace('east', Math.PI / 2);
  buildSweetFace('west', -Math.PI / 2);
}
