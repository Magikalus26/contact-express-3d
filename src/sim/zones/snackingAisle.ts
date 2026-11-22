// V18 Gameplay Module: "Rayon 11 — Snacking Frais, Sandwiches Triangles & Canettes (1990)"
// Replaces the legacy pre-filled dark 2-door glass cabinet along the West wall (X = -9.52, Z = +1.06)
// with a dedicated 3-tier +4°C Grab-and-Go Chilled Display Unit:
//  - Starts 100% EMPTY with BARE metal shelf edges (zero pre-filled blocks, zero pre-installed price rails or tags!)
//  - Étagère Basse (Y = 0.36): 6 columns × 4 deep of 33cl aluminum soda cans (Cola 30141101, Limonade 30141102, Orange 30141103)
//  - Étagère Centrale (Y = 0.94): 6 columns × 4 deep of wedge-shaped prism triangle sandwiches (Jambon 30141104, Poulet 30141105, Thon 30141106)
//  - Étagère Haute (Y = 1.48): 6 slim PAV/SRP cardboard tray lanes × 12 individually wrapped mini cakes (Chocolat 30141107, Madeleine 30141108, Cookie 30141109)
//  - Strict 320ms touch debounce, shared geometries/materials, locked 60 FPS on iPhone 16e.

import * as THREE from 'three';
import { addBoxCollider, MaterialLibrary } from '../materials';
import { ProceduralTextureBank } from '../textures';
import { WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  buildSrpPavLane,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

export function buildSnackingAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const deptRoot = new THREE.Group();
  root.add(deptRoot);

  // ============================================================================
  // 1. SHARED MATERIALS & PROCEDURAL 1990 SNACKING PACKAGING TEXTURES
  // ============================================================================
  const cabinetWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.34,
    metalness: 0.14,
  });
  const snackingTealMat = new THREE.MeshStandardMaterial({
    color: 0x0d9488,
    roughness: 0.36,
    metalness: 0.18,
  });
  const airGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.58,
    metalness: 0.42,
  });
  const coolLedStripMat = new THREE.MeshStandardMaterial({
    color: 0xf0fdfa,
    emissive: 0x99f6e4,
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });
  const aluLidMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.24,
    metalness: 0.85,
  });
  const breadCrustMat = new THREE.MeshStandardMaterial({ color: 0xe7c697, roughness: 0.78 });
  const breadCrumbMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.84 });
  const hamPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.52 });
  const cheeseGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.46 });
  const chickenMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.58 });
  const lettuceGreenMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.62 });
  const tomatoRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 });
  const tunaCreamMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6 });
  const eggYolkMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.48 });
  const clearWrapMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.26,
    roughness: 0.14,
    depthWrite: false,
  });
  const chocoCakeWrapMat = new THREE.MeshStandardMaterial({ color: 0x5c2d16, roughness: 0.36 });
  const madeleineWrapMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.36 });
  const cookieWrapMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.36 });
  const wrapSealMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

  ctx.disposables.push(
    cabinetWhiteMat,
    snackingTealMat,
    airGrilleMat,
    coolLedStripMat,
    aluLidMat,
    breadCrustMat,
    breadCrumbMat,
    hamPinkMat,
    cheeseGoldMat,
    chickenMat,
    lettuceGreenMat,
    tomatoRedMat,
    tunaCreamMat,
    eggYolkMat,
    clearWrapMat,
    chocoCakeWrapMat,
    madeleineWrapMat,
    cookieWrapMat,
    wrapSealMat
  );

  // Digital +4.0°C LED Thermometer CanvasTexture
  const createSnackingThermoMat = () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 88;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0f172a';
    g.fillRect(0, 0, 256, 88);
    g.strokeStyle = '#14b8a6';
    g.lineWidth = 4;
    g.strokeRect(3, 3, 250, 82);
    g.fillStyle = '#020617';
    g.fillRect(14, 14, 134, 60);
    g.fillStyle = '#4ade80';
    g.font = '900 34px "JetBrains Mono", monospace';
    g.fillText('+4.0°C', 22, 56);
    g.fillStyle = '#99f6e4';
    g.font = '800 13px "Plus Jakarta Sans", sans-serif';
    g.fillText('SNACKING', 158, 36);
    g.fillStyle = '#22c55e';
    g.beginPath();
    g.arc(168, 58, 6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#e2e8f0';
    g.font = '700 12px "JetBrains Mono", monospace';
    g.fillText('FRAIS OK', 180, 62);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0x2dd4bf,
      emissiveMap: tex,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Procedural 33cl Aluminum Soda Can Wrap Texture (with EAN-8)
  const createSodaCanMat = (bgHex: string, stripeHex: string, title: string, ean: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 192;
    const g = c.getContext('2d')!;
    g.fillStyle = bgHex;
    g.fillRect(0, 0, 256, 192);
    g.fillStyle = stripeHex;
    g.fillRect(0, 62, 256, 46);
    g.fillStyle = '#ffffff';
    g.font = '900 26px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.fillText(title, 128, 94);
    g.font = '800 14px "JetBrains Mono", monospace';
    g.fillText('33CL · FRAIS +4°C', 128, 130);
    drawEanBarcode(g, ean, 56, 142, 144, 40, {
      showDigits: false,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.26,
      metalness: 0.55,
    });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Procedural Triangle Sandwich Cardboard Sleeve / Front Label Texture (with EAN-8)
  const createSandwichLabelMat = (accentHex: string, title: string, price: string, ean: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fffef8';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = accentHex;
    g.fillRect(0, 0, 256, 38);
    g.fillStyle = '#ffffff';
    g.font = '800 17px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.fillText('SANDWICH TRIANGLE', 128, 25);
    g.fillStyle = '#0f172a';
    g.font = '900 19px "Plus Jakarta Sans", sans-serif';
    g.fillText(title, 128, 66);
    g.fillStyle = '#475569';
    g.font = '700 13px "JetBrains Mono", monospace';
    g.fillText(`FRAIS +4°C · ${price}`, 128, 88);
    drawEanBarcode(g, ean, 44, 96, 168, 54, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Procedural Slim PAV / SRP Front Lip Texture for Individually Wrapped Cakes
  const createPavFrontMat = (bgHex: string, title: string, price: string, ean: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = bgHex;
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#ffffff';
    g.font = '800 15px "Plus Jakarta Sans", sans-serif';
    g.fillText(title, 10, 25);
    g.font = '700 13px "JetBrains Mono", monospace';
    g.fillText(`LOT ×12 · ${price} · EAN ${ean}`, 10, 46);
    drawEanBarcode(g, ean, 12, 52, 154, 38, {
      showDigits: false,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  const canColaMat = createSodaCanMat('#dc2626', '#991b1b', 'COLA', '30141101');
  const canLimonadeMat = createSodaCanMat('#16a34a', '#15803d', 'CITRON', '30141102');
  const canOrangeMat = createSodaCanMat('#ea580c', '#c2410c', 'ORANGE', '30141103');

  const sandJambonLblMat = createSandwichLabelMat('#db2777', 'JAMBON-EMMENTAL', '13,50 ₣', '30141104');
  const sandPouletLblMat = createSandwichLabelMat('#16a34a', 'POULET-CRUDITÉS', '14,90 ₣', '30141105');
  const sandThonLblMat = createSandwichLabelMat('#0284c7', 'THON-ŒUF', '14,50 ₣', '30141106');

  const chocoCakePavMat = createPavFrontMat('#5c2d16', 'GÂTEAU FOURRÉ CHOC.', '5,50 ₣', '30141107');
  const madeleinePavMat = createPavFrontMat('#b45309', 'MADELEINE INDIVID.', '4,80 ₣', '30141108');
  const cookiePavMat = createPavFrontMat('#0369a1', 'COOKIE PÉPITES CHOC.', '5,90 ₣', '30141109');

  // ============================================================================
  // 2. OVERHEAD DEPARTMENT SIGNAGE
  //    "RAYON 11 — SNACKING FRAIS, SANDWICHES & CANETTES"
  // ============================================================================
  {
    const signTex = texBank.createDepartmentSignTexture(
      'RAYON 11 — SNACKING FRAIS, SANDWICHES & CANETTES',
      'CANETTES 33CL · SANDWICHES TRIANGLES · GÂTEAUX EMBALLÉS PAV · +4°C',
      '#0f766e',
      '#fde047'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.34 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 2.36), [
      signMat,
      signMat,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
    ]);
    signMesh.position.set(-8.92, 2.74, 1.06);
    deptRoot.add(signMesh);
    ctx.disposables.push(signTex, signMat, signMesh.geometry);
  }

  // ============================================================================
  // 3. EMPTY 3-TIER +4°C GRAB-AND-GO CHILLED DISPLAY UNIT (X = -9.52, Z = +1.06)
  //    Replaces the legacy pre-filled dark 2-door glass cabinet seamlessly!
  // ============================================================================
  const bayRoot = new THREE.Group();
  bayRoot.position.set(-9.52, 0, 1.06);
  bayRoot.rotation.y = Math.PI / 2; // Local +Z faces +X (into West cold aisle)
  deptRoot.add(bayRoot);

  // Clean commercial white/teal +4°C open-air refrigerated grab-and-go shell
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(2.60, 2.34, 0.12), cabinetWhiteMat);
  backWall.position.set(0, 1.17, -0.02);
  backWall.receiveShadow = true;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.32, 0.86), cabinetWhiteMat);
  plinth.position.set(0, 0.16, 0.35);
  plinth.castShadow = true;
  plinth.receiveShadow = true;

  const plinthGrille = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.04, 0.18), airGrilleMat);
  plinthGrille.position.set(0, 0.26, 0.72);
  plinthGrille.rotation.x = Math.PI / 2;

  const stainlessBumper = new THREE.Mesh(new THREE.BoxGeometry(2.64, 0.05, 0.045), mats.stainless);
  stainlessBumper.position.set(0, 0.14, 0.79);

  const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.28, 0.88), cabinetWhiteMat);
  topCanopy.position.set(0, 2.22, 0.36);
  topCanopy.castShadow = true;

  const canopyTealBand = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.075, 0.02), snackingTealMat);
  canopyTealBand.position.set(0, 2.26, 0.805);

  const topAirCurtain = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.04, 0.18), airGrilleMat);
  topAirCurtain.position.set(0, 2.075, 0.64);

  const innerLed = new THREE.Mesh(new THREE.BoxGeometry(2.46, 0.026, 0.045), coolLedStripMat);
  innerLed.position.set(0, 2.07, 0.44);

  const cheekGeo = new THREE.BoxGeometry(0.055, 2.34, 0.86);
  const cheekL = new THREE.Mesh(cheekGeo, cabinetWhiteMat);
  cheekL.position.set(-1.30, 1.17, 0.35);
  const cheekR = new THREE.Mesh(cheekGeo, cabinetWhiteMat);
  cheekR.position.set(1.30, 1.17, 0.35);

  const thermoMat = createSnackingThermoMat();
  const thermoBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.088, 0.022), airGrilleMat);
  thermoBox.position.set(1.02, 2.16, 0.80);
  const thermoFace = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.076), thermoMat);
  thermoFace.position.set(1.02, 2.16, 0.813);

  bayRoot.add(
    backWall,
    plinth,
    plinthGrille,
    stainlessBumper,
    topCanopy,
    canopyTealBand,
    topAirCurtain,
    innerLed,
    cheekL,
    cheekR,
    thermoBox,
    thermoFace
  );

  ctx.disposables.push(
    backWall.geometry,
    plinth.geometry,
    plinthGrille.geometry,
    stainlessBumper.geometry,
    topCanopy.geometry,
    canopyTealBand.geometry,
    topAirCurtain.geometry,
    innerLed.geometry,
    cheekGeo,
    thermoBox.geometry,
    thermoFace.geometry
  );

  addBoxCollider(ctx, 'rayon11_snacking_col', -9.95, -8.92, -0.26, 2.42);

  // 3 White Metal Shelves starting 100% BARE (0 pre-installed rails, 0 pre-installed price tags!)
  const shelfYs = [0.36, 0.94, 1.48];
  const helper = buildBareShelfWithInstallableRails(ctx, bayRoot, mats, tools, {
    idPrefix: 'rayon11_snacking',
    shelfYs,
    shelfNames: [
      'Snacking +4°C — Étagère Basse (Canettes 33cl)',
      'Snacking +4°C — Étagère Centrale (Sandwiches Triangles)',
      'Snacking +4°C — Étagère Haute (Gâteaux Emballés PAV)',
    ],
    shelfWidth: 2.54,
    shelfDepth: 0.50,
    deckCenterZ: 0.29,
    deckMaterial: cabinetWhiteMat,
    tierSlotXs: [
      [
        [-1.04, -0.64, -0.20],
        [0.20, 0.64, 1.04],
      ],
      [
        [-1.04, -0.64, -0.20],
        [0.20, 0.64, 1.04],
      ],
      [
        [-1.04, -0.64, -0.20],
        [0.20, 0.64, 1.04],
      ],
    ],
    expectedSlotEans: (tierIdx, sideKey, subIdx) => {
      if (tierIdx === 0) {
        if (sideKey === 'L') return subIdx < 2 ? ['30141101'] : ['30141102'];
        return subIdx === 0 ? ['30141102'] : ['30141103'];
      }
      if (tierIdx === 1) {
        if (sideKey === 'L') return subIdx < 2 ? ['30141104'] : ['30141105'];
        return subIdx === 0 ? ['30141105'] : ['30141106'];
      }
      // Tier 2: Wrapped Cakes PAV
      if (sideKey === 'L') return subIdx < 2 ? ['30141107'] : ['30141108'];
      return subIdx === 0 ? ['30141108'] : ['30141109'];
    },
  });

  // ============================================================================
  // 4. SHARED 3D PRODUCT GEOMETRIES & MESH FACTORIES
  // ============================================================================
  // 33cl Aluminum Soda Can (twin-can pair per depth slot so each column looks full & crisp!)
  const canBodyGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.122, 14);
  const canRimGeo = new THREE.CylinderGeometry(0.031, 0.033, 0.01, 14);
  const canTabGeo = new THREE.BoxGeometry(0.016, 0.003, 0.01);

  const buildSodaCanPairMesh = (bodyMat: THREE.Material): THREE.Object3D => {
    const g = new THREE.Group();
    [-0.042, 0.042].forEach((ox) => {
      const body = new THREE.Mesh(canBodyGeo, bodyMat);
      body.position.set(ox, 0.062, 0);
      body.castShadow = true;
      const lid = new THREE.Mesh(canRimGeo, aluLidMat);
      lid.position.set(ox, 0.126, 0);
      const tab = new THREE.Mesh(canTabGeo, aluLidMat);
      tab.position.set(ox, 0.132, 0.004);
      g.add(body, lid, tab);
    });
    return g;
  };

  // Wedge-Shaped Triangular Prism Sandwich Pack (ExtrudeGeometry right-triangle wedge!)
  const triShape = new THREE.Shape();
  triShape.moveTo(-0.062, 0);
  triShape.lineTo(0.062, 0);
  triShape.lineTo(-0.062, 0.125);
  triShape.closePath();

  const sandWedgeGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.068,
    bevelEnabled: false,
  });
  sandWedgeGeo.translate(0, 0, -0.034);
  // Rotate so the triangular filling cross-section faces forward (+Z toward shopper) or clean 3/4 view!
  const fillingStripGeo = new THREE.BoxGeometry(0.012, 0.105, 0.066);
  const sandSleeveGeo = new THREE.PlaneGeometry(0.072, 0.082);
  const sandWrapBoxGeo = new THREE.ExtrudeGeometry(triShape, {
    depth: 0.072,
    bevelEnabled: false,
  });
  sandWrapBoxGeo.translate(0, 0, -0.036);

  const buildTriangleSandwichMesh = (
    fillingMat1: THREE.Material,
    fillingMat2: THREE.Material,
    labelMat: THREE.Material
  ): THREE.Object3D => {
    const g = new THREE.Group();
    // Base bread wedge
    const bread = new THREE.Mesh(sandWedgeGeo, breadCrumbMat);
    bread.position.y = 0.004;
    bread.castShadow = true;

    // Visible layered fillings along the hypotenuse face
    const fill1 = new THREE.Mesh(fillingStripGeo, fillingMat1);
    fill1.position.set(-0.004, 0.062, 0);
    fill1.rotation.z = 0.78;
    const fill2 = new THREE.Mesh(fillingStripGeo, fillingMat2);
    fill2.position.set(0.006, 0.056, 0);
    fill2.rotation.z = 0.78;

    // Clear protective triangular clamshell
    const shell = new THREE.Mesh(sandWrapBoxGeo, clearWrapMat);
    shell.position.y = 0.003;
    shell.scale.set(1.04, 1.03, 1.04);

    // Front printed label decal on vertical face
    const lbl = new THREE.Mesh(sandSleeveGeo, labelMat);
    lbl.position.set(-0.015, 0.058, 0.038);

    g.add(bread, fill1, fill2, shell, lbl);
    g.rotation.y = 0.14;
    return g;
  };

  // Individually Wrapped Mini Cakes / Madeleines / Cookies (12 per Slim PAV tray: 2 cols × 6 rows deep)
  const cakeUnitGeo = new THREE.BoxGeometry(0.088, 0.034, 0.058);
  const cakeSealGeo = new THREE.BoxGeometry(0.098, 0.008, 0.062);
  const cookieUnitGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.022, 12);

  ctx.disposables.push(
    canBodyGeo,
    canRimGeo,
    canTabGeo,
    sandWedgeGeo,
    fillingStripGeo,
    sandSleeveGeo,
    sandWrapBoxGeo,
    cakeUnitGeo,
    cakeSealGeo,
    cookieUnitGeo
  );

  // ============================================================================
  // 5. STOCKING COLUMNS & PAV LANES — ALL 100% EMPTY AT START!
  // ============================================================================
  // --- TIER 0 (ÉTAGÈRE BASSE, Y = 0.36): 33cl Aluminum Soda Cans (6 cols × 4 deep, EMPTY!) ---
  const vCola: MultiDepthVariantSpec = {
    kind: 'snacking_can_cola',
    ean: '30141101',
    label: 'Canette Cola Classique 33cl',
    sublabel: 'Rayon 11 Snacking +4°C · Étagère Basse (4,50 ₣)',
    buildMesh: () => buildSodaCanPairMesh(canColaMat),
  };
  const vLimonade: MultiDepthVariantSpec = {
    kind: 'snacking_can_limonade',
    ean: '30141102',
    label: 'Canette Limonade Citron 33cl',
    sublabel: 'Rayon 11 Snacking +4°C · Étagère Basse (4,20 ₣)',
    buildMesh: () => buildSodaCanPairMesh(canLimonadeMat),
  };
  const vOrange: MultiDepthVariantSpec = {
    kind: 'snacking_can_orange',
    ean: '30141103',
    label: 'Canette Soda Orange 33cl',
    sublabel: 'Rayon 11 Snacking +4°C · Étagère Basse (4,50 ₣)',
    buildMesh: () => buildSodaCanPairMesh(canOrangeMat),
  };

  const canCols: Array<{ x: number; id: string; defaultFirst: MultiDepthVariantSpec[] }> = [
    { x: -1.04, id: 'r11_snk_can_0', defaultFirst: [vCola, vLimonade, vOrange] },
    { x: -0.64, id: 'r11_snk_can_1', defaultFirst: [vCola, vLimonade, vOrange] },
    { x: -0.20, id: 'r11_snk_can_2', defaultFirst: [vLimonade, vCola, vOrange] },
    { x: 0.20, id: 'r11_snk_can_3', defaultFirst: [vLimonade, vCola, vOrange] },
    { x: 0.64, id: 'r11_snk_can_4', defaultFirst: [vOrange, vCola, vLimonade] },
    { x: 1.04, id: 'r11_snk_can_5', defaultFirst: [vOrange, vCola, vLimonade] },
  ];
  canCols.forEach((col) => {
    buildMultiDepthColumn(ctx, bayRoot, helper, tools, {
      id: col.id,
      tierName: 'Étagère Basse (Canettes 33cl)',
      x: col.x,
      y: shelfYs[0] + 0.014,
      shelfBackZ: 0.05,
      shelfFrontZ: 0.53,
      colWidth: 0.34,
      itemHeight: 0.16,
      itemDepth: 0.085,
      depthCount: 4,
      variants: col.defaultFirst,
      initialSlots: [null, null, null, null], // 100% EMPTY AT START
      placementSound: 'can',
    });
  });

  // --- TIER 1 (ÉTAGÈRE CENTRALE, Y = 0.94): Triangle Sandwiches (6 cols × 4 deep, EMPTY!) ---
  const vJambon: MultiDepthVariantSpec = {
    kind: 'snacking_sand_jambon',
    ean: '30141104',
    label: 'Sandwich Triangle Jambon-Emmental',
    sublabel: 'Rayon 11 Snacking +4°C · Étagère Centrale (13,50 ₣)',
    buildMesh: () => buildTriangleSandwichMesh(hamPinkMat, cheeseGoldMat, sandJambonLblMat),
  };
  const vPoulet: MultiDepthVariantSpec = {
    kind: 'snacking_sand_poulet',
    ean: '30141105',
    label: 'Sandwich Triangle Poulet-Crudités',
    sublabel: 'Rayon 11 Snacking +4°C · Étagère Centrale (14,90 ₣)',
    buildMesh: () => buildTriangleSandwichMesh(lettuceGreenMat, tomatoRedMat, sandPouletLblMat),
  };
  const vThon: MultiDepthVariantSpec = {
    kind: 'snacking_sand_thon',
    ean: '30141106',
    label: 'Sandwich Triangle Thon-Œuf',
    sublabel: 'Rayon 11 Snacking +4°C · Étagère Centrale (14,50 ₣)',
    buildMesh: () => buildTriangleSandwichMesh(tunaCreamMat, eggYolkMat, sandThonLblMat),
  };

  const sandCols: Array<{ x: number; id: string; defaultFirst: MultiDepthVariantSpec[] }> = [
    { x: -1.04, id: 'r11_snk_sand_0', defaultFirst: [vJambon, vPoulet, vThon] },
    { x: -0.64, id: 'r11_snk_sand_1', defaultFirst: [vJambon, vPoulet, vThon] },
    { x: -0.20, id: 'r11_snk_sand_2', defaultFirst: [vPoulet, vJambon, vThon] },
    { x: 0.20, id: 'r11_snk_sand_3', defaultFirst: [vPoulet, vJambon, vThon] },
    { x: 0.64, id: 'r11_snk_sand_4', defaultFirst: [vThon, vJambon, vPoulet] },
    { x: 1.04, id: 'r11_snk_sand_5', defaultFirst: [vThon, vJambon, vPoulet] },
  ];
  sandCols.forEach((col) => {
    buildMultiDepthColumn(ctx, bayRoot, helper, tools, {
      id: col.id,
      tierName: 'Étagère Centrale (Sandwiches Triangles)',
      x: col.x,
      y: shelfYs[1] + 0.014,
      shelfBackZ: 0.05,
      shelfFrontZ: 0.53,
      colWidth: 0.34,
      itemHeight: 0.16,
      itemDepth: 0.095,
      depthCount: 4,
      variants: col.defaultFirst,
      initialSlots: [null, null, null, null], // 100% EMPTY AT START
      placementSound: 'foil',
    });
  });

  // --- TIER 2 (ÉTAGÈRE HAUTE, Y = 1.48): Slim PAV/SRP Trays of 12 Wrapped Mini Cakes (6 lanes, EMPTY!) ---
  const buildWrappedCakeInTray = (idx: number, wrapMat: THREE.Material, isCookie: boolean): THREE.Object3D => {
    const colIdx = idx % 2; // 0 = left, 1 = right
    const rowIdx = Math.floor(idx / 2); // 0..5 back-to-front
    const gx = colIdx === 0 ? -0.072 : 0.072;
    const gz = -0.175 + rowIdx * 0.068;

    const unit = new THREE.Group();
    if (isCookie) {
      const disc = new THREE.Mesh(cookieUnitGeo, wrapMat);
      disc.position.y = 0.024;
      const seal = new THREE.Mesh(cakeSealGeo, wrapSealMat);
      seal.position.y = 0.016;
      unit.add(disc, seal);
    } else {
      const pack = new THREE.Mesh(cakeUnitGeo, wrapMat);
      pack.position.y = 0.028;
      const seal = new THREE.Mesh(cakeSealGeo, wrapSealMat);
      seal.position.y = 0.028;
      unit.add(pack, seal);
    }
    unit.position.set(gx, 0, gz);
    return unit;
  };

  [-1.04, -0.64].forEach((cx, i) => {
    buildSrpPavLane(ctx, bayRoot, helper, tools, {
      id: `r11_snk_cake_choco_${i}`,
      x: cx,
      y: shelfYs[2],
      trayKind: 'snacking_cake_choco_pav',
      unitKind: 'snacking_cake_choco_unit',
      trayLabel: 'Plateau PAV Petit Gâteau Fourré Chocolat (×12)',
      unitLabel: 'Petit Gâteau Fourré Chocolat',
      ean: '30141107',
      trayWidth: 0.32,
      trayDepth: 0.44,
      trayHeight: 0.13,
      maxUnits: 12,
      initialHasTray: false, // 100% EMPTY AT START
      initialFlapCut: false,
      initialUnits: 0,
      accentColor: 0x5c2d16,
      frontMat: chocoCakePavMat,
      buildUnitMesh: (idx) => buildWrappedCakeInTray(idx, chocoCakeWrapMat, false),
    });
  });

  [-0.20, 0.20].forEach((cx, i) => {
    buildSrpPavLane(ctx, bayRoot, helper, tools, {
      id: `r11_snk_madeleine_${i}`,
      x: cx,
      y: shelfYs[2],
      trayKind: 'snacking_madeleine_pav',
      unitKind: 'snacking_madeleine_unit',
      trayLabel: 'Plateau PAV Madeleine Individuelle Emballée (×12)',
      unitLabel: 'Madeleine Individuelle Emballée',
      ean: '30141108',
      trayWidth: 0.32,
      trayDepth: 0.44,
      trayHeight: 0.13,
      maxUnits: 12,
      initialHasTray: false, // 100% EMPTY AT START
      initialFlapCut: false,
      initialUnits: 0,
      accentColor: 0xd97706,
      frontMat: madeleinePavMat,
      buildUnitMesh: (idx) => buildWrappedCakeInTray(idx, madeleineWrapMat, false),
    });
  });

  [0.64, 1.04].forEach((cx, i) => {
    buildSrpPavLane(ctx, bayRoot, helper, tools, {
      id: `r11_snk_cookie_${i}`,
      x: cx,
      y: shelfYs[2],
      trayKind: 'snacking_cookie_pav',
      unitKind: 'snacking_cookie_unit',
      trayLabel: 'Plateau PAV Cookie Pépites Chocolat (×12)',
      unitLabel: 'Cookie Pépites Chocolat Individuel',
      ean: '30141109',
      trayWidth: 0.32,
      trayDepth: 0.44,
      trayHeight: 0.13,
      maxUnits: 12,
      initialHasTray: false, // 100% EMPTY AT START
      initialFlapCut: false,
      initialUnits: 0,
      accentColor: 0x0284c7,
      frontMat: cookiePavMat,
      buildUnitMesh: (idx) => buildWrappedCakeInTray(idx, cookieWrapMat, true),
    });
  });
}
