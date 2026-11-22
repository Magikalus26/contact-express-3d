import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { ProceduralTextureBank } from '../textures';
import { HeldItemHudInfo, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

/**
 * V12 DEPARTMENT 8 — "RAYON 8 — CAVE À VINS, BIÈRES & SPIRITUEUX (1990)"
 * Positioned on Gondola 3 (X = +3.1, Z = -0.9, total length 5.20m) in rich dark wine-cellar oak.
 * Features:
 * - Zero pre-spawned loose cardboard boxes (ordered via Terminal Commande 1990 -> Warehouse dock)
 * - Both EAST (+X) and WEST (-X) central 2.56m cellar bays feature 3 bare dark-wood tiers
 *   (zero pre-installed plastic rails or price tags at game start)
 * - All 7 official V12 EAN-8 products (30140501..30140507) with 4 back-to-front depth slots
 *   (Profondeur 1 [Fond] -> Profondeur 4 [Façade]), glass-clink placement audio, and [FAIRE LE FACING]
 * - Angled wooden wine bottle cradles on Étagère Centrale + oak wine barrel & wooden Bordeaux crate endcaps
 */
export function buildWineCellarAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const gondRoot = new THREE.Group();
  gondRoot.position.set(3.1, 0, -0.9);
  root.add(gondRoot);

  const totalLen = 5.2;
  const activeBayLen = 2.56;

  // ============================================================================
  // 1. DARK-OAK WINE CELLAR GONDOLA ARCHITECTURE + OAK BARREL ENDCAPS
  // ============================================================================
  const cellarWoodMat = mats.darkWineWood;
  const trimWoodMat = new THREE.MeshStandardMaterial({ color: 0x3b1f0e, roughness: 0.72 });
  const barrelOakMat = new THREE.MeshStandardMaterial({ color: 0x6b3e1f, roughness: 0.76 });
  const barrelHoopMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    roughness: 0.45,
    metalness: 0.65,
  });
  const cratePineMat = new THREE.MeshStandardMaterial({ color: 0xb68a56, roughness: 0.8 });
  const warmCoveMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xd97706,
    emissiveIntensity: 0.68,
    roughness: 0.35,
  });
  ctx.disposables.push(trimWoodMat, barrelOakMat, barrelHoopMat, cratePineMat, warmCoveMat);

  // Central spine, plinth, top canopy & vertical cellar bay pilasters
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.94, totalLen), cellarWoodMat);
  spine.position.y = 0.97;
  spine.castShadow = true;
  spine.receiveShadow = true;

  const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.14, totalLen), trimWoodMat);
  basePlinth.position.y = 0.07;

  const topCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(1.14, 0.09, totalLen + 0.04),
    trimWoodMat
  );
  topCanopy.position.y = 1.915;

  gondRoot.add(spine, basePlinth, topCanopy);
  ctx.disposables.push(spine.geometry, basePlinth.geometry, topCanopy.geometry);

  // Dark oak vertical pilasters separating central 2.56m interactive bays from barrel endcaps
  const pilasterGeo = new THREE.BoxGeometry(1.1, 1.84, 0.08);
  ctx.disposables.push(pilasterGeo);
  [-1.32, 1.32, -2.56, 2.56].forEach((pz) => {
    const pil = new THREE.Mesh(pilasterGeo, trimWoodMat);
    pil.position.set(0, 0.99, pz);
    gondRoot.add(pil);
  });

  // Subtle warm cellar cove strips under canopy over East & West interactive bays
  const coveGeo = new THREE.BoxGeometry(0.04, 0.02, activeBayLen - 0.14);
  ctx.disposables.push(coveGeo);
  [-0.46, 0.46].forEach((cx) => {
    const cove = new THREE.Mesh(coveGeo, warmCoveMat);
    cove.position.set(cx, 1.86, 0);
    gondRoot.add(cove);
  });

  // Double-sided 1990 French Department Header Sign facing BOTH East & West aisles
  const signTex = texBank.createDepartmentSignTexture(
    'CAVE À VINS · BIÈRES & SPIRITUEUX',
    'BORDEAUX · BOURGOGNE · CHAMPAGNE · BIÈRES 6×25CL · CIDRE & PASTIS',
    '#451a03',
    '#d97706'
  );
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.36 });
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

  // Authentic Oak Wine Barrels & Wooden Vintage Crates in North & South Endcap Alcoves (Z = ±1.94)
  const barrelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.68, 14);
  const hoopGeo = new THREE.TorusGeometry(0.283, 0.01, 6, 16);
  const woodCrateGeo = new THREE.BoxGeometry(0.42, 0.24, 0.56);
  ctx.disposables.push(barrelGeo, hoopGeo, woodCrateGeo);

  const crateTexCv = document.createElement('canvas');
  crateTexCv.width = 256;
  crateTexCv.height = 128;
  {
    const c = crateTexCv.getContext('2d')!;
    c.fillStyle = '#c49a6c';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#5c3a21';
    c.lineWidth = 4;
    c.strokeRect(8, 8, 240, 112);
    c.fillStyle = '#3b1f0e';
    c.font = '800 22px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('GRAND VIN DE BORDEAUX', 128, 46);
    c.font = '700 18px "JetBrains Mono", monospace';
    c.fillText('RÉCOLTE 1988 · 6×75CL', 128, 84);
  }
  const crateTex = new THREE.CanvasTexture(crateTexCv);
  crateTex.colorSpace = THREE.SRGBColorSpace;
  const crateStampMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.78 });
  ctx.disposables.push(crateTex, crateStampMat);

  [-1.94, 1.94].forEach((alcoveZ) => {
    // Oak display deck inside endcap alcove
    const alcoveDeck = new THREE.Mesh(
      new THREE.BoxGeometry(1.04, 0.032, 1.16),
      cellarWoodMat
    );
    alcoveDeck.position.set(0, 0.88, alcoveZ);
    gondRoot.add(alcoveDeck);
    ctx.disposables.push(alcoveDeck.geometry);

    // Standing oak wine barrel on lower plinth
    const barrel = new THREE.Mesh(barrelGeo, barrelOakMat);
    barrel.position.set(0, 0.48, alcoveZ);
    gondRoot.add(barrel);

    [-0.22, 0.22].forEach((hy) => {
      const hoop = new THREE.Mesh(hoopGeo, barrelHoopMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(0, 0.48 + hy, alcoveZ);
      gondRoot.add(hoop);
    });

    // Two stacked wooden Bordeaux crates on the upper alcove deck
    [-0.25, 0.25].forEach((cx, cIdx) => {
      const cr = new THREE.Mesh(woodCrateGeo, [
        crateStampMat,
        crateStampMat,
        cratePineMat,
        cratePineMat,
        cratePineMat,
        cratePineMat,
      ]);
      cr.position.set(cx, 1.02 + cIdx * 0.0, alcoveZ);
      gondRoot.add(cr);
    });
    const topCr = new THREE.Mesh(woodCrateGeo, [
      crateStampMat,
      crateStampMat,
      cratePineMat,
      cratePineMat,
      cratePineMat,
      cratePineMat,
    ]);
    topCr.position.set(0, 1.26, alcoveZ);
    gondRoot.add(topCr);
  });

  // Exact Gondola 3 collision footprint (matches V1-V11 supermarket aisle grid)
  addBoxCollider(ctx, 'gondola_wine_cellar', 2.54, 3.66, -3.5, 1.7);

  // ============================================================================
  // 2. SHARED 3D BOTTLE & 6-PACK MATERIALS, TEXTURES & GEOMETRIES (60 FPS SAFE)
  // ============================================================================
  const makeBottleLabelMat = (
    topTitle: string,
    mainLine: string,
    subLine: string,
    bgHex: string,
    headerHex: string,
    titleHex: string,
    ean: string
  ): THREE.MeshStandardMaterial => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 192;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, 256, 192);
    c.fillStyle = headerHex;
    c.fillRect(0, 0, 256, 36);
    c.strokeStyle = headerHex;
    c.lineWidth = 4;
    c.strokeRect(4, 4, 248, 184);

    c.fillStyle = '#ffffff';
    c.font = '800 17px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(topTitle, 128, 18);

    c.fillStyle = titleHex;
    c.font = '900 22px Georgia, serif';
    c.fillText(mainLine, 128, 66);

    c.fillStyle = '#475569';
    c.font = '700 15px "JetBrains Mono", monospace';
    c.fillText(subLine, 128, 92);

    drawEanBarcode(c, ean, 34, 108, 188, 72, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.56 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  const bordeauxGlassMat = new THREE.MeshStandardMaterial({
    color: 0x143d22,
    roughness: 0.14,
    metalness: 0.14,
  });
  const bourgogneGlassMat = new THREE.MeshStandardMaterial({
    color: 0x4d6b22,
    roughness: 0.14,
    metalness: 0.12,
  });
  const champagneGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f3b26,
    roughness: 0.12,
    metalness: 0.16,
  });
  const amberGlassMat = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.15,
    metalness: 0.1,
  });
  const ciderGlassMat = new THREE.MeshStandardMaterial({
    color: 0x2c4a1c,
    roughness: 0.16,
    metalness: 0.1,
  });
  const pastisGlassMat = new THREE.MeshStandardMaterial({
    color: 0xd9a036,
    roughness: 0.14,
    metalness: 0.1,
  });

  const foilRedMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.28, metalness: 0.45 });
  const foilGoldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.22, metalness: 0.72 });
  const foilGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.28, metalness: 0.4 });
  const pastisCapMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.32 });
  const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
  const beerCartonMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.66 });

  ctx.disposables.push(
    bordeauxGlassMat,
    bourgogneGlassMat,
    champagneGlassMat,
    amberGlassMat,
    ciderGlassMat,
    pastisGlassMat,
    foilRedMat,
    foilGoldMat,
    foilGreenMat,
    pastisCapMat,
    porcelainMat,
    wireMat,
    beerCartonMat
  );

  // Individual Bottle & 6-Pack Labels with Crisp Printed EAN-8 Barcodes
  const bordeauxLblMat = makeBottleLabelMat(
    'CHÂTEAU GRAND CRU',
    'BORDEAUX AOC',
    '1988 · 75 CL',
    '#fef9e7',
    '#7f1d1d',
    '#7f1d1d',
    '30140501'
  );
  const bourgogneLblMat = makeBottleLabelMat(
    'DOMAINE CÔTE D’OR',
    'BOURGOGNE',
    'BLANC · 75 CL',
    '#fffbeb',
    '#b45309',
    '#78350f',
    '30140502'
  );
  const champagneLblMat = makeBottleLabelMat(
    'MAISON RÉSERVE',
    'CHAMPAGNE',
    'BRUT · 75 CL',
    '#1e293b',
    '#ca8a04',
    '#fde047',
    '30140503'
  );
  const beerSixLblMat = makeBottleLabelMat(
    'BRASSERIE DU NORD',
    'BIÈRES BLONDES',
    'PACK 6 × 25 CL',
    '#fef3c7',
    '#b45309',
    '#78350f',
    '30140504'
  );
  const beerAmbreeLblMat = makeBottleLabelMat(
    'GARDE ARTISANALE',
    'BIÈRE AMBRÉE',
    'BOUCHON MÉC. 75CL',
    '#fff7ed',
    '#9a3412',
    '#7c2d12',
    '30140505'
  );
  const cidreLblMat = makeBottleLabelMat(
    'VERGERS DU BOCAGE',
    'CIDRE BRUT',
    'NORMANDIE 75 CL',
    '#f0fdf4',
    '#15803d',
    '#14532d',
    '30140506'
  );
  const pastisLblMat = makeBottleLabelMat(
    'ANIS DE PROVENCE',
    'PASTIS MARSEILLE',
    '45° · 1 LITRE',
    '#fef08a',
    '#1d4ed8',
    '#1e3a8a',
    '30140507'
  );

  // Reusable Bottle & Carrier Geometries
  const bordeauxPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.038, 0.0),
    new THREE.Vector2(0.038, 0.165),
    new THREE.Vector2(0.029, 0.198),
    new THREE.Vector2(0.0135, 0.214),
    new THREE.Vector2(0.0135, 0.282),
    new THREE.Vector2(0.0155, 0.292),
    new THREE.Vector2(0.0, 0.292),
  ];
  const bourgPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.042, 0.0),
    new THREE.Vector2(0.042, 0.135),
    new THREE.Vector2(0.026, 0.198),
    new THREE.Vector2(0.0145, 0.24),
    new THREE.Vector2(0.0145, 0.29),
    new THREE.Vector2(0.0165, 0.298),
    new THREE.Vector2(0.0, 0.298),
  ];
  const bordeauxGeo = new THREE.LatheGeometry(bordeauxPts, 12);
  const bourgGeo = new THREE.LatheGeometry(bourgPts, 12);
  const capGeo = new THREE.CylinderGeometry(0.015, 0.0155, 0.048, 10);
  const champFoilGeo = new THREE.CylinderGeometry(0.016, 0.025, 0.092, 10);
  const bordeauxLblGeo = new THREE.PlaneGeometry(0.068, 0.095);
  const bourgLblGeo = new THREE.PlaneGeometry(0.072, 0.088);
  const swingPlugGeo = new THREE.CylinderGeometry(0.013, 0.0115, 0.024, 10);
  const swingWireGeo = new THREE.TorusGeometry(0.0165, 0.0022, 6, 10);

  const sixPackBodyGeo = new THREE.BoxGeometry(0.21, 0.155, 0.135);
  const sixPackHandleGeo = new THREE.BoxGeometry(0.18, 0.052, 0.014);
  const sixPackFrontLblGeo = new THREE.PlaneGeometry(0.192, 0.132);
  const miniNeckGeo = new THREE.CylinderGeometry(0.011, 0.013, 0.06, 8);
  const miniCapGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 8);

  ctx.disposables.push(
    bordeauxGeo,
    bourgGeo,
    capGeo,
    champFoilGeo,
    bordeauxLblGeo,
    bourgLblGeo,
    swingPlugGeo,
    swingWireGeo,
    sixPackBodyGeo,
    sixPackHandleGeo,
    sixPackFrontLblGeo,
    miniNeckGeo,
    miniCapGeo
  );

  // Mesh Builders for All 7 V12 Products
  const buildBordeauxBottle = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bordeauxGeo, bordeauxGlassMat);
    const cap = new THREE.Mesh(capGeo, foilRedMat);
    cap.position.y = 0.27;
    const lbl = new THREE.Mesh(bordeauxLblGeo, bordeauxLblMat);
    lbl.position.set(0, 0.105, 0.039);
    g.add(body, cap, lbl);
    return g;
  };

  const buildBourgogneBottle = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bourgGeo, bourgogneGlassMat);
    const cap = new THREE.Mesh(capGeo, foilGoldMat);
    cap.position.y = 0.274;
    const lbl = new THREE.Mesh(bourgLblGeo, bourgogneLblMat);
    lbl.position.set(0, 0.092, 0.043);
    g.add(body, cap, lbl);
    return g;
  };

  const buildChampagneBottle = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bourgGeo, champagneGlassMat);
    body.scale.set(1.04, 1.05, 1.04);
    const foil = new THREE.Mesh(champFoilGeo, foilGoldMat);
    foil.position.y = 0.268;
    const lbl = new THREE.Mesh(bourgLblGeo, champagneLblMat);
    lbl.position.set(0, 0.095, 0.045);
    g.add(body, foil, lbl);
    return g;
  };

  const buildBeerSixPack = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(sixPackBodyGeo, beerCartonMat);
    body.position.y = 0.078;
    const handle = new THREE.Mesh(sixPackHandleGeo, beerCartonMat);
    handle.position.y = 0.18;
    const lbl = new THREE.Mesh(sixPackFrontLblGeo, beerSixLblMat);
    lbl.position.set(0, 0.078, 0.069);
    g.add(body, handle, lbl);
    [-0.06, 0, 0.06].forEach((bx) => {
      [-0.032, 0.032].forEach((bz) => {
        const nk = new THREE.Mesh(miniNeckGeo, amberGlassMat);
        nk.position.set(bx, 0.175, bz);
        const cp = new THREE.Mesh(miniCapGeo, foilGoldMat);
        cp.position.set(bx, 0.208, bz);
        g.add(nk, cp);
      });
    });
    return g;
  };

  const buildBeerAmbreeBottle = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bourgGeo, amberGlassMat);
    const plug = new THREE.Mesh(swingPlugGeo, porcelainMat);
    plug.position.y = 0.305;
    const wire = new THREE.Mesh(swingWireGeo, wireMat);
    wire.position.set(0, 0.286, 0.014);
    const lbl = new THREE.Mesh(bourgLblGeo, beerAmbreeLblMat);
    lbl.position.set(0, 0.092, 0.043);
    g.add(body, plug, wire, lbl);
    return g;
  };

  const buildCidreBottle = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bourgGeo, ciderGlassMat);
    const cap = new THREE.Mesh(capGeo, foilGreenMat);
    cap.position.y = 0.274;
    const lbl = new THREE.Mesh(bourgLblGeo, cidreLblMat);
    lbl.position.set(0, 0.092, 0.043);
    g.add(body, cap, lbl);
    return g;
  };

  const buildPastisBottle = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bordeauxGeo, pastisGlassMat);
    body.scale.set(1.0, 1.15, 1.0);
    const cap = new THREE.Mesh(capGeo, pastisCapMat);
    cap.position.y = 0.312;
    const lbl = new THREE.Mesh(bordeauxLblGeo, pastisLblMat);
    lbl.position.set(0, 0.118, 0.039);
    g.add(body, cap, lbl);
    return g;
  };

  // Multi-depth Variant Specs
  const bordeauxVariant: MultiDepthVariantSpec = {
    kind: 'wine_bordeaux',
    ean: '30140501',
    label: 'Bordeaux Rouge AOC 1988 75cl',
    sublabel: 'Cave à Vins · 38,00 ₣',
    buildMesh: buildBordeauxBottle,
  };
  const bourgogneVariant: MultiDepthVariantSpec = {
    kind: 'wine_bourgogne',
    ean: '30140502',
    label: 'Bourgogne Blanc 75cl',
    sublabel: 'Cave à Vins · 44,50 ₣',
    buildMesh: buildBourgogneBottle,
  };
  const champagneVariant: MultiDepthVariantSpec = {
    kind: 'wine_champagne',
    ean: '30140503',
    label: 'Champagne Brut Réserve 75cl',
    sublabel: 'Cave à Vins · 115,00 ₣',
    buildMesh: buildChampagneBottle,
  };
  const beerSixVariant: MultiDepthVariantSpec = {
    kind: 'beer_sixpack',
    ean: '30140504',
    label: 'Pack Bières Blondes 6×25cl',
    sublabel: 'Cave à Vins · 22,00 ₣',
    buildMesh: buildBeerSixPack,
  };
  const beerAmbreeVariant: MultiDepthVariantSpec = {
    kind: 'beer_ambree',
    ean: '30140505',
    label: 'Bière Ambrée 75cl Bouchon Méc.',
    sublabel: 'Cave à Vins · 18,50 ₣',
    buildMesh: buildBeerAmbreeBottle,
  };
  const cidreVariant: MultiDepthVariantSpec = {
    kind: 'cidre_normandie',
    ean: '30140506',
    label: 'Cidre Brut de Normandie 75cl',
    sublabel: 'Cave à Vins · 14,00 ₣',
    buildMesh: buildCidreBottle,
  };
  const pastisVariant: MultiDepthVariantSpec = {
    kind: 'pastis_marseille',
    ean: '30140507',
    label: 'Pastis de Marseille 1L',
    sublabel: 'Cave à Vins · 76,00 ₣',
    buildMesh: buildPastisBottle,
  };

  // ============================================================================
  // 3. BUILD BOTH EAST (+X) & WEST (-X) 3-TIER INTERACTIVE CELLAR FACES
  //    - 100% Bare dark-wood shelf fronts at game start (clip-on transparent plastic rails!)
  //    - 4 Back-to-Front depth slots per column (Profondeur 1 [Fond] -> Profondeur 4 [Façade])
  //    - Wooden bottle-cradle slats on Étagère Centrale
  // ============================================================================
  const shelfYs = [0.16, 0.74, 1.28];
  const shelfNames = [
    'Étagère Basse (Bières & Cidre)',
    'Étagère Centrale (Vins & Champagne)',
    'Étagère Haute (Pastis & Bières Spéciales)',
  ];
  const cradleDividerGeo = new THREE.BoxGeometry(0.018, 0.048, 0.46);
  const cradleFrontStopGeo = new THREE.BoxGeometry(activeBayLen - 0.06, 0.022, 0.018);
  ctx.disposables.push(cradleDividerGeo, cradleFrontStopGeo);

  const buildCellarFace = (faceKey: 'east' | 'west', rotY: number) => {
    const faceGroup = new THREE.Group();
    faceGroup.rotation.y = rotY;
    gondRoot.add(faceGroup);

    // 3 Bare Dark-Oak Tiers with manual clip-on 120cm plastic rails & 4 visible price tags/rail
    const helper = buildBareShelfWithInstallableRails(ctx, faceGroup, mats, tools, {
      idPrefix: `wine_${faceKey}`,
      shelfYs,
      shelfNames,
      shelfWidth: activeBayLen,
      shelfDepth: 0.5,
      deckMaterial: cellarWoodMat,
      bareLipColor: 0x5c3a21,
      tierSlotXs: [
        // Tier 0 (Bottom): Packs Bières Blondes (Left) & Cidre Brut Normandie (Right)
        [[-1.02, -0.74, -0.46, -0.18], [0.18, 0.46, 0.74, 1.02]],
        // Tier 1 (Middle): Bordeaux (Left 3), Bourgogne (Center 3), Champagne (Right 2)
        [[-1.08, -0.78, -0.48, -0.16], [0.16, 0.48, 0.8, 1.1]],
        // Tier 2 (Top): Pastis de Marseille 1L (Left) & Bière Ambrée 75cl (Right)
        [[-1.02, -0.74, -0.46, -0.18], [0.18, 0.46, 0.74, 1.02]],
      ],
      expectedSlotEans: (tierIdx, sideKey, subIdx) => {
        if (tierIdx === 0) return sideKey === 'L' ? ['30140504'] : ['30140506'];
        if (tierIdx === 1) {
          if (sideKey === 'L') return subIdx <= 2 ? ['30140501'] : ['30140502'];
          return subIdx <= 1 ? ['30140502'] : ['30140503'];
        }
        return sideKey === 'L' ? ['30140507'] : ['30140505'];
      },
    });

    // Dark-oak wooden bottle cradle dividers & front retainer strip on Étagère Centrale (Y = 0.74)
    const frontStop = new THREE.Mesh(cradleFrontStopGeo, trimWoodMat);
    frontStop.position.set(0, shelfYs[1] + 0.011, 0.52);
    faceGroup.add(frontStop);
    [-1.24, -0.93, -0.63, -0.32, 0.0, 0.32, 0.64, 0.95, 1.24].forEach((dx) => {
      const div = new THREE.Mesh(cradleDividerGeo, trimWoodMat);
      div.position.set(dx, shelfYs[1] + 0.024, 0.29);
      faceGroup.add(div);
    });

    // ------------------------------------------------------------------------
    // TIER 0 — ÉTAGÈRE BASSE (Y = 0.16): PACK BIÈRES BLONDES & CIDRE NORMANDIE
    // ------------------------------------------------------------------------
    const bottomSpecs: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      colWidth: number;
      itemHeight: number;
      itemDepth: number;
      depthCount: number;
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.0,
        variant: beerSixVariant,
        colWidth: 0.34,
        itemHeight: 0.23,
        itemDepth: 0.135,
        depthCount: 3,
        init: [null, null, null],
      },
      {
        x: -0.6,
        variant: beerSixVariant,
        colWidth: 0.34,
        itemHeight: 0.23,
        itemDepth: 0.135,
        depthCount: 3,
        init: [null, null, null],
      },
      {
        x: -0.2,
        variant: beerSixVariant,
        colWidth: 0.34,
        itemHeight: 0.23,
        itemDepth: 0.135,
        depthCount: 3,
        init: [null, null, null],
      },
      {
        x: 0.2,
        variant: cidreVariant,
        colWidth: 0.32,
        itemHeight: 0.31,
        itemDepth: 0.095,
        depthCount: 4,
        init: [null, null, null, null],
      },
      {
        x: 0.6,
        variant: cidreVariant,
        colWidth: 0.32,
        itemHeight: 0.31,
        itemDepth: 0.095,
        depthCount: 4,
        init: [null, null, null, null],
      },
      {
        x: 1.0,
        variant: cidreVariant,
        colWidth: 0.32,
        itemHeight: 0.31,
        itemDepth: 0.095,
        depthCount: 4,
        init: [null, null, null, null],
      },
    ];

    bottomSpecs.forEach((sp, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `wine_${faceKey}_bot_${idx}`,
        tierName: shelfNames[0],
        x: sp.x,
        y: shelfYs[0],
        shelfFrontZ: 0.52,
        shelfBackZ: 0.06,
        colWidth: sp.colWidth,
        itemHeight: sp.itemHeight,
        itemDepth: sp.itemDepth,
        depthCount: sp.depthCount,
        variants: [sp.variant],
        initialSlots: sp.init,
        placementSound: 'glass',
      });
    });

    // ------------------------------------------------------------------------
    // TIER 1 — ÉTAGÈRE CENTRALE (Y = 0.74): BORDEAUX, BOURGOGNE & CHAMPAGNE
    //          4 Back-to-Front depth slots in angled dark-wood bottle cradles!
    // ------------------------------------------------------------------------
    const middleSpecs: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.08,
        variant: bordeauxVariant,
        init: [null, null, null, null],
      },
      {
        x: -0.78,
        variant: bordeauxVariant,
        init: [null, null, null, null],
      },
      {
        x: -0.48,
        variant: bordeauxVariant,
        init: [null, null, null, null],
      },
      {
        x: -0.16,
        variant: bourgogneVariant,
        init: [null, null, null, null],
      },
      {
        x: 0.16,
        variant: bourgogneVariant,
        init: [null, null, null, null],
      },
      {
        x: 0.48,
        variant: bourgogneVariant,
        init: [null, null, null, null],
      },
      {
        x: 0.8,
        variant: champagneVariant,
        init: [null, null, null, null],
      },
      {
        x: 1.1,
        variant: champagneVariant,
        init: [null, null, null, null],
      },
    ];

    middleSpecs.forEach((sp, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `wine_${faceKey}_mid_${idx}`,
        tierName: shelfNames[1],
        x: sp.x,
        y: shelfYs[1],
        shelfFrontZ: 0.5,
        shelfBackZ: 0.08,
        colWidth: 0.27,
        itemHeight: 0.33,
        itemDepth: 0.095,
        depthCount: 4,
        variants: [sp.variant],
        initialSlots: sp.init,
        placementSound: 'glass',
        slotTiltX: -0.1, // Authentic slight wine-cellar cradle lean toward customer aisle
      });
    });

    // ------------------------------------------------------------------------
    // TIER 2 — ÉTAGÈRE HAUTE (Y = 1.28): PASTIS DE MARSEILLE 1L & BIÈRE AMBRÉE
    // ------------------------------------------------------------------------
    const topSpecs: Array<{
      x: number;
      variant: MultiDepthVariantSpec;
      itemHeight: number;
      init: Array<HeldItemHudInfo['kind'] | null>;
    }> = [
      {
        x: -1.0,
        variant: pastisVariant,
        itemHeight: 0.36,
        init: [null, null, null, null],
      },
      {
        x: -0.6,
        variant: pastisVariant,
        itemHeight: 0.36,
        init: [null, null, null, null],
      },
      {
        x: -0.2,
        variant: pastisVariant,
        itemHeight: 0.36,
        init: [null, null, null, null],
      },
      {
        x: 0.2,
        variant: beerAmbreeVariant,
        itemHeight: 0.33,
        init: [null, null, null, null],
      },
      {
        x: 0.6,
        variant: beerAmbreeVariant,
        itemHeight: 0.33,
        init: [null, null, null, null],
      },
      {
        x: 1.0,
        variant: beerAmbreeVariant,
        itemHeight: 0.33,
        init: [null, null, null, null],
      },
    ];

    topSpecs.forEach((sp, idx) => {
      buildMultiDepthColumn(ctx, faceGroup, helper, tools, {
        id: `wine_${faceKey}_top_${idx}`,
        tierName: shelfNames[2],
        x: sp.x,
        y: shelfYs[2],
        shelfFrontZ: 0.52,
        shelfBackZ: 0.06,
        colWidth: 0.32,
        itemHeight: sp.itemHeight,
        itemDepth: 0.095,
        depthCount: 4,
        variants: [sp.variant],
        initialSlots: sp.init,
        placementSound: 'glass',
      });
    });
  };

  // Mount interactive dark-oak wine cellar shelving on BOTH East (+X) and West (-X) faces!
  buildCellarFace('east', Math.PI / 2);
  buildCellarFace('west', -Math.PI / 2);
}
