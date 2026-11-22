import * as THREE from 'three';
import {
  MaterialLibrary,
  addBoxCollider,
} from '../materials';
import { ProceduralTextureBank } from '../textures';
import { WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  buildSrpPavLane,
} from './retailShelfSystem';

/**
 * V9 DEPARTMENT 9 — "RAYON 9 — HYGIÈNE, BEAUTÉ & ENTRETIEN"
 * Positioned at X = +5.95, Z = -2.25 (directly north of Rayon 10 — Animalerie, facing WEST).
 * Features:
 * - Bare steel shelf lips at game start (manual clip-on 120cm plastic rails + 4 side-by-side visible labels/rail)
 * - Multi-depth back-to-front shelf stocking (3–4 depth slots + [FAIRE LE FACING])
 * - Deep SRP/PAV perforated cardboard trays for Dentifrice Menthe (cuttable front flap with Cutter)
 * - Exact V9 EAN-8 barcodes & official Franc prices (30140201 .. 30140205)
 */
export function buildHygieneAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const gondRoot = new THREE.Group();
  gondRoot.position.set(5.95, 0, -2.25);
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

  // Sober 1990 French Retail Header Sign
  const hygSignTex = texBank.createDepartmentSignTexture(
    'HYGIÈNE, BEAUTÉ & ENTRETIEN',
    'LESSIVES 3L · PAPIER TOILETTE · SHAMPOINGS · GELS DOUCHE · DENTIFRICES',
    '#0f5257',
    '#38bdf8'
  );
  const hygSignMat = new THREE.MeshStandardMaterial({ map: hygSignTex, roughness: 0.35 });
  const hygSignMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 2.36), [
    hygSignMat,
    hygSignMat,
    mats.anthracite,
    mats.anthracite,
    mats.anthracite,
    mats.anthracite,
  ]);
  hygSignMesh.position.set(0, 2.18, 0);
  gondRoot.add(hygSignMesh);
  ctx.disposables.push(hygSignMat, hygSignMesh.geometry);

  addBoxCollider(ctx, 'gondola_hygiene', 5.38, 6.52, -3.58, -0.92);

  // Local WEST-facing merchandising frame (+Z points WEST toward central sales aisle)
  const hygFace = new THREE.Group();
  hygFace.rotation.y = -Math.PI / 2;
  gondRoot.add(hygFace);

  const shelfYs = [0.16, 0.72, 1.24];
  const shelfNames = ['Étagère Basse', 'Étagère Centrale', 'Étagère Haute'];

  // 1) Bare metal shelves + clip-on 120cm plastic rails + 4 side-by-side price slots per rail
  const helper = buildBareShelfWithInstallableRails(ctx, hygFace, mats, tools, {
    idPrefix: 'hyg',
    shelfYs,
    shelfNames,
    shelfWidth: 2.56,
    shelfDepth: 0.5,
    tierSlotXs: [
      // Bottom: Lessive 3L (Left) & Papier Toilette Pack x6 (Right)
      [[-1.04, -0.74, -0.44, -0.16], [0.18, 0.48, 0.78, 1.06]],
      // Middle: Shampoing Doux 400ml (Left) & Gel Douche Fraîcheur (Right)
      [[-1.06, -0.76, -0.46, -0.18], [0.18, 0.48, 0.78, 1.06]],
      // Top: Dentifrice Menthe Carton PAV x12 across entire tier
      [[-1.02, -0.72, -0.42, -0.14], [0.16, 0.46, 0.76, 1.04]],
    ],
    expectedSlotEans: (tierIdx, sideKey) => {
      if (tierIdx === 0) return sideKey === 'L' ? ['30140201'] : ['30140202'];
      if (tierIdx === 1) return sideKey === 'L' ? ['30140203'] : ['30140204'];
      return ['30140205'];
    },
  });

  // ============================================================================
  // 2. PROCEDURAL 1990 PACKAGING TEXTURES (WITH CRISP PRINTED EAN-8 BARCODES)
  // ============================================================================
  const makeLabelTex = (
    brand: string,
    sub: string,
    vol: string,
    bgHex: string,
    accentHex: string,
    ean: string
  ): THREE.CanvasTexture => {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 320;
    const c = cv.getContext('2d')!;
    c.fillStyle = bgHex;
    c.fillRect(0, 0, 256, 320);

    c.fillStyle = accentHex;
    c.fillRect(0, 0, 256, 56);
    c.fillStyle = '#ffffff';
    c.font = '800 24px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(brand, 128, 28);

    c.fillStyle = '#0f172a';
    c.font = '800 22px "Plus Jakarta Sans", sans-serif';
    c.fillText(sub, 128, 102);

    c.fillStyle = accentHex;
    c.fillRect(46, 130, 164, 44);
    c.fillStyle = '#ffffff';
    c.font = '900 26px "JetBrains Mono", monospace';
    c.fillText(vol, 128, 152);

    drawEanBarcode(c, ean, 34, 198, 188, 96, {
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

  // Lessive 3L Jug Materials
  const lessiveLabelTex = makeLabelTex('SUPER-LAV 90', 'LESSIVE LIQUIDE', 'BIDON 3L', '#dbeafe', '#1d4ed8', '30140201');
  const lessiveBodyMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 });
  const lessiveCapMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38 });
  const lessiveFrontMat = new THREE.MeshStandardMaterial({ map: lessiveLabelTex, roughness: 0.45 });

  // Toilet Paper Pack x6 Materials
  const tpLabelTex = makeLabelTex('DOUCEUR-6', 'PAPIER TOILETTE', 'PACK ×6', '#fce7f3', '#db2777', '30140202');
  const tpWrapMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.58 });
  const tpFrontMat = new THREE.MeshStandardMaterial({ map: tpLabelTex, roughness: 0.52 });
  const tpRollWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });

  // Shampoing 400ml Materials
  const shampLabelTex = makeLabelTex('SOIN DOUX', 'SHAMPOING', '400 ML', '#fff1f2', '#be185d', '30140203');
  const shampBodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.36 });
  const shampCapMat = new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.32 });
  const shampFrontMat = new THREE.MeshStandardMaterial({ map: shampLabelTex, roughness: 0.42 });

  // Gel Douche Materials
  const gelLabelTex = makeLabelTex('OCÉAN 90', 'GEL DOUCHE', 'FRAÎCHEUR', '#ccfbf1', '#0f766e', '30140204');
  const gelBodyMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.34 });
  const gelCapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
  const gelFrontMat = new THREE.MeshStandardMaterial({ map: gelLabelTex, roughness: 0.4 });

  // Dentifrice PAV Tray & Toothpaste Box Materials
  const dentTrayCv = document.createElement('canvas');
  dentTrayCv.width = 256;
  dentTrayCv.height = 128;
  {
    const c = dentTrayCv.getContext('2d')!;
    c.fillStyle = '#0f766e';
    c.fillRect(0, 0, 256, 128);
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.strokeRect(6, 6, 244, 116);
    c.fillStyle = '#ffffff';
    c.font = '800 20px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('DENTIFRICE MENTHE ×12', 128, 30);
    drawEanBarcode(c, '30140205', 44, 50, 168, 66, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
  }
  const dentTrayTex = new THREE.CanvasTexture(dentTrayCv);
  dentTrayTex.colorSpace = THREE.SRGBColorSpace;
  const dentTrayFrontMat = new THREE.MeshStandardMaterial({ map: dentTrayTex, roughness: 0.65 });
  const dentBoxBodyMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.48 });
  const dentBoxMintMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.46 });

  ctx.disposables.push(
    lessiveBodyMat,
    lessiveCapMat,
    lessiveFrontMat,
    tpWrapMat,
    tpFrontMat,
    tpRollWhiteMat,
    shampBodyMat,
    shampCapMat,
    shampFrontMat,
    gelBodyMat,
    gelCapMat,
    gelFrontMat,
    dentTrayTex,
    dentTrayFrontMat,
    dentBoxBodyMat,
    dentBoxMintMat
  );

  // Shared Geometries (reused cleanly across all depth slots!)
  const lessiveBodyGeo = new THREE.BoxGeometry(0.18, 0.28, 0.11);
  const lessiveLabelGeo = new THREE.PlaneGeometry(0.15, 0.2);
  const lessiveCapGeo = new THREE.CylinderGeometry(0.025, 0.028, 0.042, 10);
  const lessiveHandleGeo = new THREE.BoxGeometry(0.032, 0.11, 0.03);

  const tpPackGeo = new THREE.BoxGeometry(0.28, 0.22, 0.13);
  const tpFrontGeo = new THREE.PlaneGeometry(0.24, 0.18);
  const tpRollGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.02, 10);

  const shampBodyGeo = new THREE.BoxGeometry(0.088, 0.21, 0.058);
  const shampLabelGeo = new THREE.PlaneGeometry(0.074, 0.15);
  const shampCapGeo = new THREE.CylinderGeometry(0.018, 0.022, 0.032, 10);

  const gelBodyGeo = new THREE.BoxGeometry(0.084, 0.2, 0.056);
  const gelLabelGeo = new THREE.PlaneGeometry(0.072, 0.14);
  const gelCapGeo = new THREE.BoxGeometry(0.044, 0.028, 0.034);

  const dentBoxGeo = new THREE.BoxGeometry(0.052, 0.042, 0.155);
  const dentStripeGeo = new THREE.BoxGeometry(0.054, 0.014, 0.157);

  ctx.disposables.push(
    lessiveBodyGeo,
    lessiveLabelGeo,
    lessiveCapGeo,
    lessiveHandleGeo,
    tpPackGeo,
    tpFrontGeo,
    tpRollGeo,
    shampBodyGeo,
    shampLabelGeo,
    shampCapGeo,
    gelBodyGeo,
    gelLabelGeo,
    gelCapGeo,
    dentBoxGeo,
    dentStripeGeo
  );

  const buildLessiveJugMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(lessiveBodyGeo, lessiveBodyMat);
    body.position.y = 0.14;
    const lbl = new THREE.Mesh(lessiveLabelGeo, lessiveFrontMat);
    lbl.position.set(0, 0.14, 0.056);
    const cap = new THREE.Mesh(lessiveCapGeo, lessiveCapMat);
    cap.position.set(-0.042, 0.3, 0);
    const handle = new THREE.Mesh(lessiveHandleGeo, lessiveBodyMat);
    handle.position.set(0.095, 0.17, 0);
    g.add(body, lbl, cap, handle);
    return g;
  };

  const buildTpPackMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const pack = new THREE.Mesh(tpPackGeo, tpWrapMat);
    pack.position.y = 0.11;
    const lbl = new THREE.Mesh(tpFrontGeo, tpFrontMat);
    lbl.position.set(0, 0.11, 0.066);
    g.add(pack, lbl);
    [-0.085, 0, 0.085].forEach((rx) => {
      const roll = new THREE.Mesh(tpRollGeo, tpRollWhiteMat);
      roll.position.set(rx, 0.222, 0);
      g.add(roll);
    });
    return g;
  };

  const buildShampoingMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(shampBodyGeo, shampBodyMat);
    body.position.y = 0.105;
    const lbl = new THREE.Mesh(shampLabelGeo, shampFrontMat);
    lbl.position.set(0, 0.105, 0.03);
    const cap = new THREE.Mesh(shampCapGeo, shampCapMat);
    cap.position.set(0, 0.225, 0);
    g.add(body, lbl, cap);
    return g;
  };

  const buildGelDoucheMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(gelBodyGeo, gelBodyMat);
    body.position.y = 0.1;
    const lbl = new THREE.Mesh(gelLabelGeo, gelFrontMat);
    lbl.position.set(0, 0.1, 0.029);
    const cap = new THREE.Mesh(gelCapGeo, gelCapMat);
    cap.position.set(0, 0.214, 0);
    g.add(body, lbl, cap);
    return g;
  };

  // ============================================================================
  // 3. ÉTAGÈRE BASSE (Y = 0.16): LESSIVE 3L (LEFT) & PAPIER TOILETTE x6 (RIGHT)
  //    Each column supports 3 back-to-front depth slots + [FAIRE LE FACING]!
  // ============================================================================
  const lessiveCols: Array<{ x: number; init: Array<'hyg_lessive_3l' | null> }> = [
    { x: -1.04, init: [null, null, null] },
    { x: -0.68, init: [null, null, null] },
    { x: -0.32, init: [null, null, null] },
  ];
  lessiveCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, hygFace, helper, tools, {
      id: `hyg_lessive_col_${i}`,
      tierName: 'Étagère Basse (Lessive 3L)',
      x: col.x,
      y: 0.16,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.28,
      itemHeight: 0.34,
      itemDepth: 0.12,
      depthCount: 3,
      variants: [
        {
          kind: 'hyg_lessive_3l',
          ean: '30140201',
          label: 'Lessive Liquide Bidon 3L',
          sublabel: 'Rayon Hygiène · Étagère Basse',
          buildMesh: buildLessiveJugMesh,
        },
      ],
      initialSlots: col.init,
    });
  });

  const tpCols: Array<{ x: number; init: Array<'hyg_tp_pack' | null> }> = [
    { x: 0.22, init: [null, null, null] },
    { x: 0.6, init: [null, null, null] },
    { x: 0.98, init: [null, null, null] },
  ];
  tpCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, hygFace, helper, tools, {
      id: `hyg_tp_col_${i}`,
      tierName: 'Étagère Basse (Papier Toilette)',
      x: col.x,
      y: 0.16,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.32,
      itemHeight: 0.25,
      itemDepth: 0.135,
      depthCount: 3,
      variants: [
        {
          kind: 'hyg_tp_pack',
          ean: '30140202',
          label: 'Papier Toilette Pack x6',
          sublabel: 'Rayon Hygiène · Étagère Basse',
          buildMesh: buildTpPackMesh,
        },
      ],
      initialSlots: col.init,
    });
  });

  // ============================================================================
  // 4. ÉTAGÈRE CENTRALE (Y = 0.72): SHAMPOING 400ML (LEFT) & GEL DOUCHE (RIGHT)
  //    Each column supports 4 back-to-front depth slots + [FAIRE LE FACING]!
  // ============================================================================
  const shampCols: Array<{ x: number; init: Array<'hyg_shampoing' | null> }> = [
    { x: -1.08, init: [null, null, null, null] },
    { x: -0.82, init: [null, null, null, null] },
    { x: -0.56, init: [null, null, null, null] },
    { x: -0.3, init: [null, null, null, null] },
  ];
  shampCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, hygFace, helper, tools, {
      id: `hyg_shamp_col_${i}`,
      tierName: 'Étagère Centrale (Shampoing 400ml)',
      x: col.x,
      y: 0.72,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.2,
      itemHeight: 0.25,
      itemDepth: 0.068,
      depthCount: 4,
      variants: [
        {
          kind: 'hyg_shampoing',
          ean: '30140203',
          label: 'Shampoing Doux Flacon 400ml',
          sublabel: 'Rayon Hygiène · Étagère Centrale',
          buildMesh: buildShampoingMesh,
        },
      ],
      initialSlots: col.init,
    });
  });

  const gelCols: Array<{ x: number; init: Array<'hyg_gel_douche' | null> }> = [
    { x: 0.2, init: [null, null, null, null] },
    { x: 0.46, init: [null, null, null, null] },
    { x: 0.72, init: [null, null, null, null] },
    { x: 0.98, init: [null, null, null, null] },
  ];
  gelCols.forEach((col, i) => {
    buildMultiDepthColumn(ctx, hygFace, helper, tools, {
      id: `hyg_gel_col_${i}`,
      tierName: 'Étagère Centrale (Gel Douche)',
      x: col.x,
      y: 0.72,
      shelfFrontZ: 0.54,
      shelfBackZ: 0.06,
      colWidth: 0.2,
      itemHeight: 0.24,
      itemDepth: 0.066,
      depthCount: 4,
      variants: [
        {
          kind: 'hyg_gel_douche',
          ean: '30140204',
          label: 'Gel Douche Fraîcheur',
          sublabel: 'Rayon Hygiène · Étagère Centrale',
          buildMesh: buildGelDoucheMesh,
        },
      ],
      initialSlots: col.init,
    });
  });

  // ============================================================================
  // 5. ÉTAGÈRE HAUTE (Y = 1.24): DENTIFRICE MENTHE CARTON PAV (×12)
  //    6 deep SRP/PAV perforated cardboard trays sliding to the shelf back wall!
  // ============================================================================
  const pavLanes: Array<{
    x: number;
    hasTray: boolean;
    flapCut: boolean;
    units: number;
  }> = [
    { x: -1.0, hasTray: false, flapCut: false, units: 0 },
    { x: -0.6, hasTray: false, flapCut: false, units: 0 },
    { x: -0.2, hasTray: false, flapCut: false, units: 0 },
    { x: 0.2, hasTray: false, flapCut: false, units: 0 },
    { x: 0.6, hasTray: false, flapCut: false, units: 0 },
    { x: 1.0, hasTray: false, flapCut: false, units: 0 },
  ];

  pavLanes.forEach((lane, idx) => {
    buildSrpPavLane(ctx, hygFace, helper, tools, {
      id: `hyg_dentifrice_pav_${idx}`,
      x: lane.x,
      y: 1.24,
      trayKind: 'hyg_dentifrice_pav',
      unitKind: 'hyg_dentifrice_box',
      trayLabel: 'Dentifrice Menthe Carton PAV (×12)',
      unitLabel: 'Étui Dentifrice Menthe',
      ean: '30140205',
      trayWidth: 0.34,
      trayDepth: 0.44,
      trayHeight: 0.14,
      maxUnits: 12,
      initialHasTray: lane.hasTray,
      initialFlapCut: lane.flapCut,
      initialUnits: lane.units,
      accentColor: 0x0ea5e9,
      frontMat: dentTrayFrontMat,
      buildUnitMesh: (uIdx) => {
        // 3 columns × 2 rows deep × 2 stacked layers = 12 toothpaste boxes inside tray
        const layer = Math.floor(uIdx / 6);
        const rem = uIdx % 6;
        const row = Math.floor(rem / 3); // 0 = back, 1 = front
        const col = rem % 3;
        const g = new THREE.Group();
        const box = new THREE.Mesh(dentBoxGeo, dentBoxBodyMat);
        const stripe = new THREE.Mesh(dentStripeGeo, dentBoxMintMat);
        g.add(box, stripe);
        g.position.set(
          (col - 1) * 0.088,
          0.032 + layer * 0.045,
          row === 0 ? -0.09 : 0.09
        );
        return g;
      },
    });
  });

  // ============================================================================
  // 6. EAST FACE OF HYGIENE GONDOLA (100% EMPTY WHITE SHELVES — ZERO PLACEHOLDER CUBES)
  // ============================================================================
  [0.72, 1.24].forEach((sy) => {
    const deckE = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.028, gondLen), mats.whiteMetal);
    deckE.position.set(0.27, sy - 0.014, 0);
    gondRoot.add(deckE);
    ctx.disposables.push(deckE.geometry);
  });
}
