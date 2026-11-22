import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
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

/**
 * V17 DEPARTMENT 5 — "RAYON 5 — CRÉMERIE, FROMAGES & YAOURTS (1990)"
 * Positioned along the West Cold Wall (X = -9.95..-8.92, Z = -5.60..+2.42, facing +X):
 * - Two seamlessly joined 2.56m Open-Air +4°C Commercial Chilled Dairy Wall Cabinets
 *   (Bay A North Z = -4.22, Bay B Center-South Z = -1.60; total 5.12m linear) featuring:
 *   • White commercial insulated steel housing, top chilled air-curtain diffuser grille & base bumper
 *   • Digital +4.0°C / +3.8°C LED thermometer readouts
 *   • 3 white metal shelves starting 100% BARE (zero pre-installed plastic price rails or price tags!)
 *   • Étagère Basse (Y = 0.36): Lait Frais Entier 1L (4 deep), Pack Lait 6x1L (4 deep) & Crème Fraîche 50cl PAV
 *   • Étagère Centrale (Y = 0.94): Slim SRP/PAV trays for Yaourts Nature x8, Yaourts Fruits x8 & Crèmes Chocolat x4
 *   • Étagère Haute (Y = 1.48): Camembert de Normandie 250g (4 deep), Emmental Râpé 200g PAV & Beurre Doux 250g (4 deep)
 * - Cohesive 2-Door Glass Cold Drinks & Grab-and-Go End Cooler on the South end (Z = +1.08)
 * - Strict 320ms touch debounce, shared geometries/materials, locked 60 FPS on iPhone 16e.
 */
export function buildDairyAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const deptRoot = new THREE.Group();
  root.add(deptRoot);

  // ============================================================================
  // 1. SHARED MATERIALS & PROCEDURAL DAIRY PACKAGING / PAV TEXTURES
  // ============================================================================
  const cabinetWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.34,
    metalness: 0.14,
  });
  const dairyBlueTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.38,
    metalness: 0.18,
  });
  const airCurtainGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.4,
  });
  const coolLedStripMat = new THREE.MeshStandardMaterial({
    color: 0xf0f9ff,
    emissive: 0xbae6fd,
    emissiveIntensity: 1.25,
    roughness: 0.2,
  });
  const milkBottleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
  const redCapMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
  const blueCapMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
  const shrinkFilmMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.38,
    roughness: 0.14,
  });
  const creamTubLidMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4 });
  const yogurtSkyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.38 });
  const yogurtFruitPinkMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.42 });
  const yogurtFruitPeachMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.42 });
  const chocoCupMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.42 });
  const camembertWoodMat = new THREE.MeshStandardMaterial({ color: 0xdcb98a, roughness: 0.78 });
  const emmentalYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.44 });
  const butterGoldFoilMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.22,
    metalness: 0.62,
  });

  ctx.disposables.push(
    cabinetWhiteMat,
    dairyBlueTrimMat,
    airCurtainGrilleMat,
    coolLedStripMat,
    milkBottleMat,
    redCapMat,
    blueCapMat,
    shrinkFilmMat,
    creamTubLidMat,
    yogurtSkyMat,
    yogurtFruitPinkMat,
    yogurtFruitPeachMat,
    chocoCupMat,
    camembertWoodMat,
    emmentalYellowMat,
    butterGoldFoilMat
  );

  // Digital +4°C Thermometer CanvasTexture builder
  const createDairyThermoMat = (tempText: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 88;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0f172a';
    g.fillRect(0, 0, 256, 88);
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 4;
    g.strokeRect(3, 3, 250, 82);
    g.fillStyle = '#020617';
    g.fillRect(14, 14, 134, 60);
    g.fillStyle = '#4ade80';
    g.font = '900 34px "JetBrains Mono", monospace';
    g.fillText(tempText, 22, 56);
    g.fillStyle = '#bae6fd';
    g.font = '800 13px "Plus Jakarta Sans", sans-serif';
    g.fillText('RIDEAU D’AIR', 158, 36);
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
      emissive: 0x38bdf8,
      emissiveMap: tex,
      emissiveIntensity: 0.4,
      roughness: 0.25,
    });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Procedural front lip texture for Slim PAV / SRP cardboard trays with EAN-8 barcode
  const createPavFrontMat = (bgHex: string, title: string, price: string, ean: string) => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = bgHex;
    g.fillRect(0, 0, 256, 96);
    g.fillStyle = '#ffffff';
    g.font = '800 16px "Plus Jakarta Sans", sans-serif';
    g.fillText(title, 10, 26);
    g.font = '700 13px "JetBrains Mono", monospace';
    g.fillText(`+4°C · ${price} · EAN ${ean}`, 10, 48);
    drawEanBarcode(g, ean, 12, 54, 152, 36, {
      showDigits: false,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.56 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  // Procedural packaging face textures for Camembert top, Butter block & Milk wrap
  const createCamembertTopMat = () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fef3c7';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#991b1b';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(128, 128, 114, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#14532d';
    g.font = '900 22px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.fillText('CAMEMBERT', 128, 86);
    g.fillStyle = '#991b1b';
    g.font = '800 17px "Plus Jakarta Sans", sans-serif';
    g.fillText('DE NORMANDIE', 128, 112);
    g.fillStyle = '#0f172a';
    g.font = '700 14px "JetBrains Mono", monospace';
    g.fillText('LAIT CRU · 250G · 14,80 ₣', 128, 138);
    g.textAlign = 'left';
    drawEanBarcode(g, '30141007', 48, 152, 160, 52, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.52 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  const createButterFaceMat = () => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d')!;
    g.fillStyle = '#facc15';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#1e3a8a';
    g.fillRect(0, 14, 256, 44);
    g.fillStyle = '#ffffff';
    g.font = '900 21px "Plus Jakarta Sans", sans-serif';
    g.textAlign = 'center';
    g.fillText('BEURRE DOUX BARATTE', 128, 43);
    g.fillStyle = '#1e3a8a';
    g.font = '800 14px "JetBrains Mono", monospace';
    g.fillText('250 G · 9,80 ₣ · +4°C', 128, 80);
    g.textAlign = 'left';
    drawEanBarcode(g, '30141009', 36, 92, 184, 58, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28, metalness: 0.35 });
    ctx.disposables.push(tex, mat);
    return mat;
  };

  const camembertTopMat = createCamembertTopMat();
  const butterFaceMat = createButterFaceMat();
  const cremePavFrontMat = createPavFrontMat('#0369a1', 'CRÈME FRAÎCHE 50CL', '11,40 ₣', '30141003');
  const ynPavFrontMat = createPavFrontMat('#0284c7', 'YAOURTS NATURE ×8', '10,90 ₣', '30141004');
  const yfPavFrontMat = createPavFrontMat('#e11d48', 'YAOURTS FRUITS ×8', '13,50 ₣', '30141005');
  const chPavFrontMat = createPavFrontMat('#451a03', 'CRÈMES CHOCOLAT ×4', '9,20 ₣', '30141006');
  const emPavFrontMat = createPavFrontMat('#b45309', 'EMMENTAL RÂPÉ 200G', '12,60 ₣', '30141008');

  // Shared product geometries (reused across all depth slots & PAV lanes for locked 60 FPS!)
  const milkBodyGeo = new THREE.CylinderGeometry(0.044, 0.046, 0.21, 12);
  const milkNeckGeo = new THREE.CylinderGeometry(0.022, 0.044, 0.055, 12);
  const milkCapGeo = new THREE.CylinderGeometry(0.023, 0.023, 0.018, 10);
  const milkBandGeo = new THREE.CylinderGeometry(0.0465, 0.0465, 0.075, 12, 1, true);
  const pack6MilkGeo = new THREE.CylinderGeometry(0.036, 0.037, 0.19, 10);
  const pack6CapGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.016, 8);
  const pack6WrapGeo = new THREE.BoxGeometry(0.25, 0.20, 0.17);
  const pack6BandGeo = new THREE.BoxGeometry(0.252, 0.048, 0.172);
  const cremeTubGeo = new THREE.CylinderGeometry(0.052, 0.043, 0.095, 12);
  const cremeLidGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.014, 12);
  const yogurtPackGeo = new THREE.BoxGeometry(0.14, 0.075, 0.088);
  const chocoPackGeo = new THREE.BoxGeometry(0.132, 0.068, 0.082);
  const camembertBoxGeo = new THREE.CylinderGeometry(0.064, 0.064, 0.038, 16);
  const emmentalBagGeo = new THREE.BoxGeometry(0.145, 0.155, 0.038);
  const butterBlockGeo = new THREE.BoxGeometry(0.14, 0.048, 0.085);

  ctx.disposables.push(
    milkBodyGeo,
    milkNeckGeo,
    milkCapGeo,
    milkBandGeo,
    pack6MilkGeo,
    pack6CapGeo,
    pack6WrapGeo,
    pack6BandGeo,
    cremeTubGeo,
    cremeLidGeo,
    yogurtPackGeo,
    chocoPackGeo,
    camembertBoxGeo,
    emmentalBagGeo,
    butterBlockGeo
  );

  // Multi-Depth Variant Specs
  const laitEntierVariant: MultiDepthVariantSpec = {
    kind: 'dairy_lait_entier',
    ean: '30141001',
    label: 'Lait Frais Entier 1L',
    sublabel: 'Rayon 5 Crémerie · 5,90 ₣',
    buildMesh: () => {
      const g = new THREE.Group();
      [-0.06, 0.06].forEach((ox) => {
        const b = new THREE.Mesh(milkBodyGeo, milkBottleMat);
        b.position.set(ox, 0.105, 0);
        const n = new THREE.Mesh(milkNeckGeo, milkBottleMat);
        n.position.set(ox, 0.238, 0);
        const c = new THREE.Mesh(milkCapGeo, redCapMat);
        c.position.set(ox, 0.273, 0);
        const r = new THREE.Mesh(milkBandGeo, redCapMat);
        r.position.set(ox, 0.125, 0);
        g.add(b, n, c, r);
      });
      return g;
    },
  };

  const laitPack6Variant: MultiDepthVariantSpec = {
    kind: 'dairy_lait_pack6',
    ean: '30141002',
    label: 'Pack Lait Demi-Écrémé 6x1L',
    sublabel: 'Rayon 5 Crémerie · 26,50 ₣',
    buildMesh: () => {
      const g = new THREE.Group();
      for (let ix = -1; ix <= 1; ix++) {
        [-0.042, 0.042].forEach((iz) => {
          const b = new THREE.Mesh(pack6MilkGeo, milkBottleMat);
          b.position.set(ix * 0.078, 0.095, iz);
          const c = new THREE.Mesh(pack6CapGeo, blueCapMat);
          c.position.set(ix * 0.078, 0.198, iz);
          g.add(b, c);
        });
      }
      const wrap = new THREE.Mesh(pack6WrapGeo, shrinkFilmMat);
      wrap.position.y = 0.102;
      const band = new THREE.Mesh(pack6BandGeo, blueCapMat);
      band.position.y = 0.072;
      g.add(wrap, band);
      return g;
    },
  };

  const camembertVariant: MultiDepthVariantSpec = {
    kind: 'dairy_camembert',
    ean: '30141007',
    label: 'Camembert de Normandie 250g',
    sublabel: 'Rayon 5 Crémerie · 14,80 ₣',
    buildMesh: () => {
      const g = new THREE.Group();
      // 2 neatly stacked round wooden camembert boxes side-by-side
      [-0.072, 0.072].forEach((ox) => {
        [0.02, 0.06, 0.10].forEach((oy, idx) => {
          const box = new THREE.Mesh(camembertBoxGeo, [
            camembertWoodMat,
            camembertTopMat,
            camembertWoodMat,
          ]);
          box.position.set(ox, oy, 0);
          box.rotation.y = idx * 0.35;
          g.add(box);
        });
      });
      return g;
    },
  };

  const beurreVariant: MultiDepthVariantSpec = {
    kind: 'dairy_beurre',
    ean: '30141009',
    label: 'Beurre Doux de Baratte 250g',
    sublabel: 'Rayon 5 Crémerie · 9,80 ₣',
    buildMesh: () => {
      const g = new THREE.Group();
      [0.025, 0.076, 0.127].forEach((oy) => {
        const block = new THREE.Mesh(butterBlockGeo, [
          butterGoldFoilMat,
          butterGoldFoilMat,
          butterFaceMat,
          butterGoldFoilMat,
          butterFaceMat,
          butterGoldFoilMat,
        ]);
        block.position.set(0, oy, 0);
        g.add(block);
      });
      return g;
    },
  };

  // ============================================================================
  // 2. OVERHEAD DEPARTMENT SIGN ("RAYON 5 — CRÉMERIE, FROMAGES & YAOURTS")
  // ============================================================================
  {
    const signTex = texBank.createDepartmentSignTexture(
      'RAYON 5 — CRÉMERIE · FROMAGES & YAOURTS',
      '+4°C · LAIT FRAIS · CRÈME · YAOURTS PAV · CAMEMBERT & BEURRE DE BARATTE',
      '#0c4a6e',
      '#38bdf8'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.34 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.46, 4.8), [
      signMat,
      signMat,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
    ]);
    signMesh.position.set(-8.92, 2.74, -2.9);
    deptRoot.add(signMesh);
    ctx.disposables.push(signTex, signMat, signMesh.geometry);
  }

  // ============================================================================
  // 3. TWO MODULAR 2.56m OPEN-AIR +4°C CHILLED DAIRY WALL CABINET BAYS
  //    Facing +X (rotation.y = Math.PI / 2) along West Wall (X = -9.45)
  // ============================================================================
  const bayConfigs = [
    { idPrefix: 'dairy_bay_a', zCenter: -4.22, tempText: '+4.0°C', bayTitle: 'Crémerie Nord' },
    { idPrefix: 'dairy_bay_b', zCenter: -1.60, tempText: '+3.8°C', bayTitle: 'Crémerie Sud' },
  ];

  const cabBackGeo = new THREE.BoxGeometry(2.60, 2.34, 0.12);
  const cabTopGeo = new THREE.BoxGeometry(2.62, 0.28, 0.88);
  const cabPlinthGeo = new THREE.BoxGeometry(2.62, 0.32, 0.86);
  const cabCheekGeo = new THREE.BoxGeometry(0.055, 2.34, 0.86);
  const cabBumperGeo = new THREE.BoxGeometry(2.64, 0.05, 0.045);
  const airGrilleGeo = new THREE.BoxGeometry(2.44, 0.04, 0.18);
  const ledStripGeo = new THREE.BoxGeometry(2.46, 0.026, 0.045);
  const thermoBoxGeo = new THREE.BoxGeometry(0.24, 0.088, 0.022);
  const thermoFaceGeo = new THREE.PlaneGeometry(0.22, 0.076);

  ctx.disposables.push(
    cabBackGeo,
    cabTopGeo,
    cabPlinthGeo,
    cabCheekGeo,
    cabBumperGeo,
    airGrilleGeo,
    ledStripGeo,
    thermoBoxGeo,
    thermoFaceGeo
  );

  bayConfigs.forEach((bay) => {
    const bayRoot = new THREE.Group();
    bayRoot.position.set(-9.52, 0, bay.zCenter);
    bayRoot.rotation.y = Math.PI / 2; // Local +Z faces +X (into West cold aisle!)
    deptRoot.add(bayRoot);

    // Commercial white steel +4°C open-air refrigerated cabinet shell
    const backWall = new THREE.Mesh(cabBackGeo, cabinetWhiteMat);
    backWall.position.set(0, 1.17, -0.02);
    backWall.receiveShadow = true;

    const plinth = new THREE.Mesh(cabPlinthGeo, cabinetWhiteMat);
    plinth.position.set(0, 0.16, 0.35);
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const plinthReturnGrille = new THREE.Mesh(airGrilleGeo, airCurtainGrilleMat);
    plinthReturnGrille.position.set(0, 0.26, 0.72);
    plinthReturnGrille.rotation.x = Math.PI / 2;

    const stainlessBumper = new THREE.Mesh(cabBumperGeo, mats.stainless);
    stainlessBumper.position.set(0, 0.14, 0.79);

    const topCanopy = new THREE.Mesh(cabTopGeo, cabinetWhiteMat);
    topCanopy.position.set(0, 2.22, 0.36);
    topCanopy.castShadow = true;

    const canopyBlueBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.62, 0.075, 0.02),
      dairyBlueTrimMat
    );
    canopyBlueBand.position.set(0, 2.26, 0.805);
    ctx.disposables.push(canopyBlueBand.geometry);

    // Chilled air-curtain diffuser louvre grille & interior cool-white fluorescent strip
    const topAirCurtain = new THREE.Mesh(airGrilleGeo, airCurtainGrilleMat);
    topAirCurtain.position.set(0, 2.075, 0.64);
    const innerLed = new THREE.Mesh(ledStripGeo, coolLedStripMat);
    innerLed.position.set(0, 2.07, 0.44);

    // Side insulated cheeks separating bays
    const cheekL = new THREE.Mesh(cabCheekGeo, cabinetWhiteMat);
    cheekL.position.set(-1.30, 1.17, 0.35);
    const cheekR = new THREE.Mesh(cabCheekGeo, cabinetWhiteMat);
    cheekR.position.set(1.30, 1.17, 0.35);

    // Digital +4°C Thermometer mounted on top fascia
    const thermoMat = createDairyThermoMat(bay.tempText);
    const thermoBox = new THREE.Mesh(thermoBoxGeo, airCurtainGrilleMat);
    thermoBox.position.set(1.02, 2.16, 0.80);
    const thermoFace = new THREE.Mesh(thermoFaceGeo, thermoMat);
    thermoFace.position.set(1.02, 2.16, 0.813);

    bayRoot.add(
      backWall,
      plinth,
      plinthReturnGrille,
      stainlessBumper,
      topCanopy,
      canopyBlueBand,
      topAirCurtain,
      innerLed,
      cheekL,
      cheekR,
      thermoBox,
      thermoFace
    );

    // 3 White Metal Shelves with BARE Front Edges at Start (zero rails, zero price tags!)
    const shelfYs = [0.36, 0.94, 1.48];
    const helper = buildBareShelfWithInstallableRails(ctx, bayRoot, mats, tools, {
      idPrefix: bay.idPrefix,
      shelfYs,
      shelfNames: [
        `${bay.bayTitle} — Étagère Basse (Lait & Crème)`,
        `${bay.bayTitle} — Étagère Centrale (Yaourts & Desserts PAV)`,
        `${bay.bayTitle} — Étagère Haute (Fromages & Beurre)`,
      ],
      shelfWidth: 2.54,
      shelfDepth: 0.50,
      deckCenterZ: 0.29,
      deckMaterial: cabinetWhiteMat,
      tierSlotXs: [
        [
          [-1.02, -0.64, -0.18],
          [0.28, 0.72, 1.06],
        ],
        [
          [-1.02, -0.64, -0.20],
          [0.18, 0.64, 1.02],
        ],
        [
          [-1.00, -0.58, -0.14],
          [0.22, 0.64, 1.02],
        ],
      ],
      expectedSlotEans: (tierIdx, sideKey, subIdx) => {
        if (tierIdx === 0) {
          if (sideKey === 'L') return subIdx < 2 ? ['30141001'] : ['30141002'];
          return subIdx === 0 ? ['30141002'] : ['30141003'];
        }
        if (tierIdx === 1) {
          if (sideKey === 'L') return subIdx < 2 ? ['30141004'] : ['30141005'];
          return subIdx === 0 ? ['30141005'] : ['30141006'];
        }
        if (sideKey === 'L') return subIdx < 2 ? ['30141007'] : ['30141008'];
        return subIdx === 0 ? ['30141008'] : ['30141009'];
      },
    });

    // ---- TIER 0 (ÉTAGÈRE BASSE, Y = 0.36): Lait Entier 1L, Pack Lait 6x1L & Crème Fraîche PAV ----
    [-1.02, -0.64].forEach((cx, i) => {
      buildMultiDepthColumn(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_lait_entier_${i}`,
        tierName: 'Étagère Basse — Lait Frais Entier 1L',
        x: cx,
        y: shelfYs[0],
        shelfBackZ: 0.05,
        shelfFrontZ: 0.53,
        colWidth: 0.34,
        itemHeight: 0.29,
        itemDepth: 0.10,
        depthCount: 4,
        variants: [laitEntierVariant],
        initialSlots: [null, null, null, null],
        placementSound: 'dairy',
      });
    });

    [-0.18, 0.28].forEach((cx, i) => {
      buildMultiDepthColumn(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_lait_pack6_${i}`,
        tierName: 'Étagère Basse — Pack Lait Demi-Écrémé 6x1L',
        x: cx,
        y: shelfYs[0],
        shelfBackZ: 0.05,
        shelfFrontZ: 0.53,
        colWidth: 0.40,
        itemHeight: 0.22,
        itemDepth: 0.115,
        depthCount: 4,
        variants: [laitPack6Variant],
        initialSlots: [null, null, null, null],
        placementSound: 'dairy',
      });
    });

    [0.72, 1.06].forEach((cx, i) => {
      buildSrpPavLane(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_creme_pav_${i}`,
        x: cx,
        y: shelfYs[0],
        trayKind: 'dairy_creme_pav',
        unitKind: 'dairy_creme_tub',
        trayLabel: 'Plateau PAV Crème Fraîche 50cl (×6)',
        unitLabel: 'Crème Fraîche Normandie 50cl',
        ean: '30141003',
        trayWidth: 0.28,
        trayDepth: 0.44,
        trayHeight: 0.13,
        maxUnits: 6,
        initialHasTray: false,
        initialFlapCut: false,
        initialUnits: 0,
        accentColor: 0x0369a1,
        frontMat: cremePavFrontMat,
        buildUnitMesh: (idx) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const g = new THREE.Group();
          const tub = new THREE.Mesh(cremeTubGeo, milkBottleMat);
          tub.position.y = 0.058;
          const lid = new THREE.Mesh(cremeLidGeo, creamTubLidMat);
          lid.position.y = 0.11;
          g.add(tub, lid);
          g.position.set(col === 0 ? -0.064 : 0.064, 0, -0.14 + row * 0.138);
          return g;
        },
      });
    });

    // ---- TIER 1 (ÉTAGÈRE CENTRALE, Y = 0.94): Slim PAV Yogurt & Chocolate Dessert Trays ----
    [-1.02, -0.64].forEach((cx, i) => {
      buildSrpPavLane(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_yaourt_nature_pav_${i}`,
        x: cx,
        y: shelfYs[1],
        trayKind: 'dairy_yaourt_nature_pav',
        unitKind: 'dairy_yaourt_nature_pack',
        trayLabel: 'Plateau PAV Yaourts Nature ×8',
        unitLabel: 'Yaourts Nature Brassés x8',
        ean: '30141004',
        trayWidth: 0.34,
        trayDepth: 0.44,
        trayHeight: 0.125,
        maxUnits: 4,
        initialHasTray: false,
        initialFlapCut: false,
        initialUnits: 0,
        accentColor: 0x0284c7,
        frontMat: ynPavFrontMat,
        buildUnitMesh: (idx) => {
          const pack = new THREE.Mesh(yogurtPackGeo, yogurtSkyMat);
          pack.position.set(0, 0.048, -0.155 + idx * 0.103);
          return pack;
        },
      });
    });

    [-0.20, 0.18].forEach((cx, i) => {
      buildSrpPavLane(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_yaourt_fruits_pav_${i}`,
        x: cx,
        y: shelfYs[1],
        trayKind: 'dairy_yaourt_fruits_pav',
        unitKind: 'dairy_yaourt_fruits_pack',
        trayLabel: 'Plateau PAV Yaourts Fruits ×8',
        unitLabel: 'Yaourts aux Fruits Mixés x8',
        ean: '30141005',
        trayWidth: 0.34,
        trayDepth: 0.44,
        trayHeight: 0.125,
        maxUnits: 4,
        initialHasTray: false,
        initialFlapCut: false,
        initialUnits: 0,
        accentColor: 0xe11d48,
        frontMat: yfPavFrontMat,
        buildUnitMesh: (idx) => {
          const pack = new THREE.Mesh(
            yogurtPackGeo,
            idx % 2 === 0 ? yogurtFruitPinkMat : yogurtFruitPeachMat
          );
          pack.position.set(0, 0.048, -0.155 + idx * 0.103);
          return pack;
        },
      });
    });

    [0.64, 1.02].forEach((cx, i) => {
      buildSrpPavLane(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_creme_choco_pav_${i}`,
        x: cx,
        y: shelfYs[1],
        trayKind: 'dairy_creme_choco_pav',
        unitKind: 'dairy_creme_choco_pack',
        trayLabel: 'Plateau PAV Crèmes Chocolat ×4',
        unitLabel: 'Crèmes Dessert Chocolat x4',
        ean: '30141006',
        trayWidth: 0.34,
        trayDepth: 0.44,
        trayHeight: 0.12,
        maxUnits: 4,
        initialHasTray: false,
        initialFlapCut: false,
        initialUnits: 0,
        accentColor: 0x451a03,
        frontMat: chPavFrontMat,
        buildUnitMesh: (idx) => {
          const pack = new THREE.Mesh(chocoPackGeo, chocoCupMat);
          pack.position.set(0, 0.045, -0.155 + idx * 0.103);
          return pack;
        },
      });
    });

    // ---- TIER 2 (ÉTAGÈRE HAUTE, Y = 1.48): Camembert, Emmental Râpé PAV & Beurre Doux ----
    [-1.00, -0.58].forEach((cx, i) => {
      buildMultiDepthColumn(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_camembert_${i}`,
        tierName: 'Étagère Haute — Camembert de Normandie 250g',
        x: cx,
        y: shelfYs[2],
        shelfBackZ: 0.05,
        shelfFrontZ: 0.53,
        colWidth: 0.36,
        itemHeight: 0.15,
        itemDepth: 0.115,
        depthCount: 4,
        variants: [camembertVariant],
        initialSlots: [null, null, null, null],
        placementSound: 'dairy',
      });
    });

    [-0.14, 0.22].forEach((cx, i) => {
      buildSrpPavLane(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_emmental_pav_${i}`,
        x: cx,
        y: shelfYs[2],
        trayKind: 'dairy_emmental_pav',
        unitKind: 'dairy_emmental_bag',
        trayLabel: 'Plateau PAV Emmental Râpé 200g',
        unitLabel: 'Emmental Râpé Sachet 200g',
        ean: '30141008',
        trayWidth: 0.32,
        trayDepth: 0.44,
        trayHeight: 0.15,
        maxUnits: 6,
        initialHasTray: false,
        initialFlapCut: false,
        initialUnits: 0,
        accentColor: 0xb45309,
        frontMat: emPavFrontMat,
        buildUnitMesh: (idx) => {
          const bag = new THREE.Mesh(emmentalBagGeo, emmentalYellowMat);
          bag.position.set(0, 0.088, -0.175 + idx * 0.068);
          return bag;
        },
      });
    });

    [0.64, 1.02].forEach((cx, i) => {
      buildMultiDepthColumn(ctx, bayRoot, helper, tools, {
        id: `${bay.idPrefix}_beurre_${i}`,
        tierName: 'Étagère Haute — Beurre Doux de Baratte 250g',
        x: cx,
        y: shelfYs[2],
        shelfBackZ: 0.05,
        shelfFrontZ: 0.53,
        colWidth: 0.34,
        itemHeight: 0.17,
        itemDepth: 0.10,
        depthCount: 4,
        variants: [beurreVariant],
        initialSlots: [null, null, null, null],
        placementSound: 'dairy',
      });
    });
  });

  // West Wall Crémerie Bays A & B Collider (Z = -5.65..-0.28; Z = -0.26..+2.42 is now Rayon 11 Snacking Frais!)
  addBoxCollider(ctx, 'wall_coolers_col', -9.95, -8.92, -5.65, -0.28);
}
