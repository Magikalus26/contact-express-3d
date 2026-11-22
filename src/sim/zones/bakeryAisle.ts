import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { ProceduralTextureBank, INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { HeldItemHudInfo, InteractableItem, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
} from './retailShelfSystem';

const BAKERY_ACTION_COOLDOWN_MS = 320;
const OVEN_BAKE_DURATION_SEC = 12.0;
const SLICER_DURATION_SEC = 2.35;

// Pre-allocated color constants for zero-GC oven browning interpolation
const RAW_DOUGH_COLOR = new THREE.Color('#F3E5AB');
const BAKED_CRUST_COLOR = new THREE.Color('#C67D2E');
const COIL_COLD_EMISSIVE = new THREE.Color('#1a1210');
const COIL_HOT_EMISSIVE = new THREE.Color('#ff3d12');

type RawDoughKind = 'baguette_raw' | 'croissant_raw' | 'pain_choc_raw';

function isRawDoughKind(kind: HeldItemHudInfo['kind'] | undefined): kind is RawDoughKind {
  return kind === 'baguette_raw' || kind === 'croissant_raw' || kind === 'pain_choc_raw';
}

function getBakedResultForRaw(raw: RawDoughKind): {
  kind: HeldItemHudInfo['kind'];
  label: string;
  sublabel: string;
  ean: string;
  shortAction: string;
} {
  if (raw === 'baguette_raw') {
    return {
      kind: 'baguette_baked',
      label: 'Baguette Tradition 250g (Cuite)',
      sublabel: 'Sortie du four · Poser en rayon ou trancher',
      ean: '30140301',
      shortAction: 'BAGUETTE DORÉE',
    };
  }
  if (raw === 'croissant_raw') {
    return {
      kind: 'croissant_baked',
      label: 'Croissant Pur Beurre (Cuit)',
      sublabel: 'Sorti du four · Poser en vitrine boulangerie',
      ean: '30140302',
      shortAction: 'CROISSANT DORÉ',
    };
  }
  return {
    kind: 'pain_choc_baked',
    label: 'Pain au Chocolat (Cuit)',
    sublabel: 'Sorti du four · Poser en vitrine boulangerie',
    ean: '30140303',
    shortAction: 'PAIN CHOC. DORÉ',
  };
}

/**
 * V10 DEPARTMENT 2 — "RAYON 2 — BOULANGERIE & VIENNOISERIE (POINT CHAUD 1990)"
 * Positioned along the East Wall (X = 8.78..9.95, Z = -1.42..+2.76), facing WEST (-X):
 *  1) South Module (Z = +1.46): 3-Tier Oak & Wicker Display Rack with bare metal shelf edges
 *     (clip-on 120cm plastic rails + 4 side-by-side price labels per rail) and multi-depth
 *     columns (3–4 back-to-front slots + [FAIRE LE FACING]) for Baguettes (whole & sliced),
 *     Croissants Pur Beurre, Pains au Chocolat, and Brioches Tressées 400g.
 *  2) Center Module (Z = -0.34): 100% Diegetic 3D Stainless-Steel Bakery Convection Oven
 *     ("Four Point Chaud 1990") with hinged glass door, perforated aluminum baking tray,
 *     glowing red heating coils, physical 3D timer dial, green [DÉMARRER CUISSON] button,
 *     12-second smooth rising (1.0 -> 1.24x) & browning (#F3E5AB -> #C67D2E) + mechanical DING!
 *  3) North Module (Z = -1.12): Interactive 3D Electric Bread Slicer ("Trancheuse à Pain 1990")
 *     with clear hinged safety hood, 15 oscillating parallel steel blades, green start button,
 *     synthesized motor/cutting SFX, producing bagged sliced baguettes (EAN 30140301).
 */
export function buildBakeryAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const deptRoot = new THREE.Group();
  root.add(deptRoot);

  // Combined clean wall-side collider replacing legacy bakery_and_slicer
  addBoxCollider(ctx, 'bakery_and_slicer', 8.78, 9.95, -1.42, 2.76);

  // Overhead 1990 French Department Sign
  {
    const signTex = texBank.createDepartmentSignTexture(
      'BOULANGERIE — POINT CHAUD 1990',
      'FOUR CONVECTION · BAGUETTES · VIENNOISERIES · TRANCHEUSE',
      '#78350f',
      '#f59e0b'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.36 });
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.48, 0.06), [
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      signMat,
      signMat,
    ]);
    signMesh.position.set(9.12, 2.72, 0.65);
    signMesh.rotation.y = -Math.PI / 2;
    deptRoot.add(signMesh);
    ctx.disposables.push(signMat, signMesh.geometry);
  }

  // Local debounce & hitbox registration helper for oven & slicer diegetic controls
  let lastLocalAction = 0;
  const acquireLocalLock = (): boolean => {
    const now = performance.now();
    if (now - lastLocalAction < BAKERY_ACTION_COOLDOWN_MS) return false;
    lastLocalAction = now;
    return true;
  };

  const proxyHiddenMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyHiddenMat);

  const registerDiegeticBox = (
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
  ): THREE.Mesh => {
    const geo = new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
    ctx.disposables.push(geo);
    const proxy = new THREE.Mesh(geo, proxyHiddenMat);
    proxy.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
    proxy.layers.set(INTERACT_LAYER);
    parent.add(proxy);

    const item: InteractableItem = {
      id: opts.id,
      title: opts.title,
      subtitle: opts.subtitle,
      kind: 'diegetic_action',
      state: false,
      inspectText: opts.subtitle,
      proxyMesh: proxy,
      productEan: opts.productEan,
      dynamicProductEan: opts.dynamicProductEan,
      dynamicVerb: opts.verb,
      dynamicTitle: opts.dynamicTitle,
      dynamicSubtitle: opts.dynamicSubtitle,
      isVisible: opts.isVisible,
      onInteract: opts.onInteract,
    };
    proxy.userData.interactable = item;
    ctx.interactables.push(item);
    return proxy;
  };

  // ============================================================================
  // SHARED PROCEDURAL BAKERY MATERIALS & GEOMETRIES
  // ============================================================================
  const wickerMat = new THREE.MeshStandardMaterial({ color: 0xc28e53, roughness: 0.84 });
  const wickerRimMat = new THREE.MeshStandardMaterial({ color: 0x9a6b38, roughness: 0.78 });
  const goldenCrustMat = new THREE.MeshStandardMaterial({ color: 0xc67d2e, roughness: 0.62 });
  const goldenScoreMat = new THREE.MeshStandardMaterial({ color: 0xe6b56c, roughness: 0.72 });
  const pastryGlazeMat = new THREE.MeshStandardMaterial({ color: 0xd98a2b, roughness: 0.44 });
  const chocolateTipMat = new THREE.MeshStandardMaterial({ color: 0x3b1f14, roughness: 0.52 });
  const briocheGoldMat = new THREE.MeshStandardMaterial({ color: 0xd48d2d, roughness: 0.48 });
  const clearBagMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.34,
    roughness: 0.16,
    metalness: 0.05,
    depthWrite: false,
  });
  const kraftSleeveMat = new THREE.MeshStandardMaterial({ color: 0xd6b485, roughness: 0.85 });
  const sliceLineMat = new THREE.MeshStandardMaterial({ color: 0x7c4a1a, roughness: 0.78 });
  const sneezeGlassMat = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.24,
    roughness: 0.1,
    metalness: 0.08,
    depthWrite: false,
  });
  ctx.disposables.push(
    wickerMat,
    wickerRimMat,
    goldenCrustMat,
    goldenScoreMat,
    pastryGlazeMat,
    chocolateTipMat,
    briocheGoldMat,
    clearBagMat,
    kraftSleeveMat,
    sliceLineMat,
    sneezeGlassMat
  );

  // Reusable bakery product geometries
  const baguetteBodyGeo = new THREE.CapsuleGeometry(0.032, 0.34, 5, 10);
  baguetteBodyGeo.rotateX(Math.PI / 2); // Aligned back-to-front along Z inside basket!
  const baguetteScoreGeo = new THREE.BoxGeometry(0.036, 0.008, 0.042);

  const slicedSleeveGeo = new THREE.BoxGeometry(0.088, 0.074, 0.38);
  const sliceRingGeo = new THREE.BoxGeometry(0.068, 0.056, 0.004);

  const croissantArcGeo = new THREE.TorusGeometry(0.042, 0.02, 7, 12, Math.PI * 1.18);
  croissantArcGeo.rotateX(Math.PI / 2);
  const croissantCenterGeo = new THREE.SphereGeometry(0.024, 8, 8);

  const painChocBodyGeo = new THREE.BoxGeometry(0.092, 0.046, 0.072);
  const painChocBarGeo = new THREE.BoxGeometry(0.095, 0.012, 0.012);

  const briocheLobeGeo = new THREE.SphereGeometry(0.048, 9, 8);
  const briocheBagGeo = new THREE.BoxGeometry(0.22, 0.115, 0.125);
  const briocheTagGeo = new THREE.PlaneGeometry(0.11, 0.065);

  ctx.disposables.push(
    baguetteBodyGeo,
    baguetteScoreGeo,
    slicedSleeveGeo,
    sliceRingGeo,
    croissantArcGeo,
    croissantCenterGeo,
    painChocBodyGeo,
    painChocBarGeo,
    briocheLobeGeo,
    briocheBagGeo,
    briocheTagGeo
  );

  // Brioche printed front bag label with authentic EAN 30140304
  const briocheLabelCv = document.createElement('canvas');
  briocheLabelCv.width = 256;
  briocheLabelCv.height = 152;
  {
    const c = briocheLabelCv.getContext('2d')!;
    c.fillStyle = '#fffbeb';
    c.fillRect(0, 0, 256, 152);
    c.fillStyle = '#92400e';
    c.fillRect(0, 0, 256, 36);
    c.fillStyle = '#fef3c7';
    c.font = '800 18px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('BRIOCHE TRESSÉE 400G', 128, 18);
    c.fillStyle = '#78350f';
    c.font = '700 13px "JetBrains Mono", monospace';
    c.fillText('PUR BEURRE · POINT CHAUD', 128, 52);
    drawEanBarcode(c, '30140304', 28, 66, 200, 76, {
      showDigits: true,
      bgColor: '#ffffff',
      barColor: '#0f172a',
    });
  }
  const briocheLabelTex = new THREE.CanvasTexture(briocheLabelCv);
  briocheLabelTex.colorSpace = THREE.SRGBColorSpace;
  briocheLabelTex.anisotropy = ctx.maxAnisotropy;
  const briocheLabelMat = new THREE.MeshStandardMaterial({ map: briocheLabelTex, roughness: 0.45 });
  ctx.disposables.push(briocheLabelTex, briocheLabelMat);

  // Bakery product mesh builders for multi-depth shelf columns
  const buildWholeBaguetteMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const loaf = new THREE.Mesh(baguetteBodyGeo, goldenCrustMat);
    loaf.position.y = 0.036;
    g.add(loaf);
    [-0.1, 0, 0.1].forEach((sz) => {
      const score = new THREE.Mesh(baguetteScoreGeo, goldenScoreMat);
      score.position.set(0, 0.066, sz);
      score.rotation.y = 0.35;
      g.add(score);
    });
    return g;
  };

  const buildSlicedBaguetteMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const loaf = new THREE.Mesh(baguetteBodyGeo, goldenCrustMat);
    loaf.position.y = 0.038;
    g.add(loaf);
    // Visible slice score rings along the bagged loaf
    for (let sz = -0.14; sz <= 0.145; sz += 0.036) {
      const ring = new THREE.Mesh(sliceRingGeo, sliceLineMat);
      ring.position.set(0, 0.038, sz);
      g.add(ring);
    }
    // Kraft paper lower band + translucent plastic bakery sleeve
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.12), kraftSleeveMat);
    band.position.set(0, 0.036, 0.02);
    ctx.disposables.push(band.geometry);
    const sleeve = new THREE.Mesh(slicedSleeveGeo, clearBagMat);
    sleeve.position.y = 0.04;
    sleeve.renderOrder = 3;
    g.add(band, sleeve);
    return g;
  };

  const buildCroissantMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(croissantArcGeo, pastryGlazeMat);
    arc.position.set(0, 0.024, 0.008);
    const mid = new THREE.Mesh(croissantCenterGeo, pastryGlazeMat);
    mid.scale.set(1.35, 0.88, 1.0);
    mid.position.set(0, 0.028, -0.028);
    g.add(arc, mid);
    return g;
  };

  const buildPainChocMesh = (): THREE.Group => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(painChocBodyGeo, pastryGlazeMat);
    body.position.y = 0.026;
    const bar1 = new THREE.Mesh(painChocBarGeo, chocolateTipMat);
    bar1.position.set(0, 0.024, -0.018);
    const bar2 = new THREE.Mesh(painChocBarGeo, chocolateTipMat);
    bar2.position.set(0, 0.024, 0.018);
    g.add(body, bar1, bar2);
    return g;
  };

  const buildBriocheBaggedMesh = (): THREE.Group => {
    const g = new THREE.Group();
    [-0.056, 0, 0.056].forEach((bx, idx) => {
      const lobe = new THREE.Mesh(briocheLobeGeo, briocheGoldMat);
      lobe.scale.set(1.05, idx === 1 ? 1.05 : 0.92, 0.95);
      lobe.position.set(bx, 0.052, 0);
      g.add(lobe);
    });
    const bag = new THREE.Mesh(briocheBagGeo, clearBagMat);
    bag.position.y = 0.058;
    bag.renderOrder = 3;
    const tag = new THREE.Mesh(briocheTagGeo, briocheLabelMat);
    tag.position.set(0, 0.058, 0.064);
    g.add(bag, tag);
    return g;
  };

  // ============================================================================
  // 1. SOUTH MODULE (Z = +1.46): 3-TIER OAK & WICKER BAKERY DISPLAY RACK
  //    Bare metal shelf lips at start -> clip-on plastic rails + 4 labels/rail
  //    Multi-depth wicker baskets & pastry shelves (3-4 deep + [FAIRE LE FACING])
  // ============================================================================
  {
    const rackRoot = new THREE.Group();
    rackRoot.position.set(9.35, 0, 1.46);
    deptRoot.add(rackRoot);

    const rackFace = new THREE.Group();
    rackFace.rotation.y = -Math.PI / 2; // Local +Z faces WEST toward aisle!
    rackRoot.add(rackFace);

    const rackWidth = 2.58;
    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(rackWidth, 0.4, 0.56), mats.oakWood);
    basePlinth.position.set(0, 0.2, 0.28);
    basePlinth.castShadow = true;
    basePlinth.receiveShadow = true;

    const backBoard = new THREE.Mesh(new THREE.BoxGeometry(rackWidth, 2.08, 0.06), mats.oakWood);
    backBoard.position.set(0, 1.04, 0.01);

    const sideCheekL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.08, 0.56), mats.oakWood);
    sideCheekL.position.set(-rackWidth / 2 - 0.025, 1.04, 0.28);
    const sideCheekR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.08, 0.56), mats.oakWood);
    sideCheekR.position.set(rackWidth / 2 + 0.025, 1.04, 0.28);

    const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(rackWidth + 0.1, 0.08, 0.58), mats.oakWood);
    topCanopy.position.set(0, 2.06, 0.29);

    rackFace.add(basePlinth, backBoard, sideCheekL, sideCheekR, topCanopy);
    ctx.disposables.push(
      basePlinth.geometry,
      backBoard.geometry,
      sideCheekL.geometry,
      sideCheekR.geometry,
      topCanopy.geometry
    );

    // Stainless bakery tongs hanging on the left oak side cheek
    const tongArmGeo = new THREE.BoxGeometry(0.018, 0.22, 0.014);
    const tongL = new THREE.Mesh(tongArmGeo, mats.chrome);
    tongL.position.set(-rackWidth / 2 - 0.02, 1.18, 0.56);
    tongL.rotation.z = 0.12;
    const tongR = new THREE.Mesh(tongArmGeo, mats.chrome);
    tongR.position.set(-rackWidth / 2 + 0.005, 1.18, 0.56);
    tongR.rotation.z = -0.12;
    rackFace.add(tongL, tongR);
    ctx.disposables.push(tongArmGeo);

    const shelfYs = [0.42, 0.96, 1.48];
    const shelfNames = [
      'Boulangerie Bas (Baguettes)',
      'Boulangerie Centre (Viennoiseries)',
      'Boulangerie Haut (Brioches)',
    ];

    // Standardized bare shelves requiring ordered clip-on 120cm plastic rails & printed price tags!
    const helper = buildBareShelfWithInstallableRails(ctx, rackFace, mats, tools, {
      idPrefix: 'bak',
      shelfYs,
      shelfNames,
      shelfWidth: 2.56,
      shelfDepth: 0.5,
      tierSlotXs: [
        // Bottom: Baguette Tradition 250g (30140301)
        [[-1.06, -0.76, -0.46, -0.16], [0.16, 0.46, 0.76, 1.06]],
        // Middle: Croissant Pur Beurre (Left) & Pain au Chocolat (Right)
        [[-1.06, -0.76, -0.46, -0.16], [0.16, 0.46, 0.76, 1.06]],
        // Top: Brioche Tressée 400g (30140304)
        [[-1.04, -0.74, -0.44, -0.14], [0.16, 0.46, 0.76, 1.04]],
      ],
      expectedSlotEans: (tierIdx, sideKey) => {
        if (tierIdx === 0) return ['30140301'];
        if (tierIdx === 1) return sideKey === 'L' ? ['30140302'] : ['30140303'];
        return ['30140304'];
      },
    });

    // Wicker basket deck liners & clear acrylic sneeze guards (kept cleanly above the bare shelf lip!)
    const wickerDeckGeo = new THREE.BoxGeometry(2.5, 0.016, 0.46);
    const wickerFrontTrimGeo = new THREE.BoxGeometry(2.5, 0.036, 0.016);
    const sneezeGeo = new THREE.BoxGeometry(2.5, 0.14, 0.012);
    ctx.disposables.push(wickerDeckGeo, wickerFrontTrimGeo, sneezeGeo);

    shelfYs.forEach((sy, idx) => {
      const liner = new THREE.Mesh(wickerDeckGeo, wickerMat);
      liner.position.set(0, sy + 0.008, 0.29);
      const trim = new THREE.Mesh(wickerFrontTrimGeo, wickerRimMat);
      trim.position.set(0, sy + 0.022, 0.52);
      rackFace.add(liner, trim);

      // Clear pastry sneeze guard on Viennoiserie middle tier (recessed slightly so price rail is 100% clear)
      if (idx === 1) {
        const guard = new THREE.Mesh(sneezeGeo, sneezeGlassMat);
        guard.position.set(0, sy + 0.11, 0.522);
        guard.renderOrder = 3;
        rackFace.add(guard);
      }
    });

    // Tier 0 (Y = 0.44): Baguette Tradition 250g — 6 Multi-Depth Wicker Basket Columns (3 deep: back-to-front)
    // Accepts BOTH freshly baked whole baguettes ('baguette_baked') AND sliced bagged baguettes ('baguette_sliced')!
    const baguetteCols: Array<{
      x: number;
      init: Array<'baguette_baked' | 'baguette_sliced' | null>;
    }> = [
      { x: -1.04, init: [null, null, null] },
      { x: -0.62, init: [null, null, null] },
      { x: -0.2, init: [null, null, null] },
      { x: 0.22, init: [null, null, null] },
      { x: 0.64, init: [null, null, null] },
      { x: 1.06, init: [null, null, null] },
    ];
    baguetteCols.forEach((col, i) => {
      buildMultiDepthColumn(ctx, rackFace, helper, tools, {
        id: `bak_baguette_col_${i}`,
        tierName: 'Panier Baguettes Tradition',
        x: col.x,
        y: 0.436,
        shelfFrontZ: 0.52,
        shelfBackZ: 0.07,
        colWidth: 0.36,
        itemHeight: 0.18,
        itemDepth: 0.13,
        depthCount: 3,
        variants: [
          {
            kind: 'baguette_baked',
            ean: '30140301',
            label: 'Baguette Tradition 250g',
            sublabel: 'Rayon Boulangerie · Panier Osier (Entière)',
            buildMesh: buildWholeBaguetteMesh,
          },
          {
            kind: 'baguette_sliced',
            ean: '30140301',
            label: 'Baguette Tradition 250g (Tranchée)',
            sublabel: 'Rayon Boulangerie · Sachet Tranché',
            buildMesh: buildSlicedBaguetteMesh,
          },
        ],
        initialSlots: col.init,
      });
    });

    // Tier 1 Left (Y = 0.98): Croissant Pur Beurre — 4 Multi-Depth Columns × 4 deep (100% EMPTY AT START)
    const croissantCols: Array<{ x: number; init: Array<'croissant_baked' | null> }> = [
      { x: -1.04, init: [null, null, null, null] },
      { x: -0.74, init: [null, null, null, null] },
      { x: -0.44, init: [null, null, null, null] },
      { x: -0.14, init: [null, null, null, null] },
    ];
    croissantCols.forEach((col, i) => {
      buildMultiDepthColumn(ctx, rackFace, helper, tools, {
        id: `bak_croissant_col_${i}`,
        tierName: 'Vitrine Croissants Pur Beurre',
        x: col.x,
        y: 0.976,
        shelfFrontZ: 0.51,
        shelfBackZ: 0.07,
        colWidth: 0.24,
        itemHeight: 0.16,
        itemDepth: 0.095,
        depthCount: 4,
        variants: [
          {
            kind: 'croissant_baked',
            ean: '30140302',
            label: 'Croissant Pur Beurre',
            sublabel: 'Rayon Boulangerie · Viennoiserie',
            buildMesh: buildCroissantMesh,
          },
        ],
        initialSlots: col.init,
      });
    });

    // Tier 1 Right (Y = 0.98): Pain au Chocolat — 4 Multi-Depth Columns × 4 deep (100% EMPTY AT START)
    const painChocCols: Array<{ x: number; init: Array<'pain_choc_baked' | null> }> = [
      { x: 0.16, init: [null, null, null, null] },
      { x: 0.46, init: [null, null, null, null] },
      { x: 0.76, init: [null, null, null, null] },
      { x: 1.06, init: [null, null, null, null] },
    ];
    painChocCols.forEach((col, i) => {
      buildMultiDepthColumn(ctx, rackFace, helper, tools, {
        id: `bak_pain_choc_col_${i}`,
        tierName: 'Vitrine Pains au Chocolat',
        x: col.x,
        y: 0.976,
        shelfFrontZ: 0.51,
        shelfBackZ: 0.07,
        colWidth: 0.24,
        itemHeight: 0.16,
        itemDepth: 0.09,
        depthCount: 4,
        variants: [
          {
            kind: 'pain_choc_baked',
            ean: '30140303',
            label: 'Pain au Chocolat',
            sublabel: 'Rayon Boulangerie · Viennoiserie',
            buildMesh: buildPainChocMesh,
          },
        ],
        initialSlots: col.init,
      });
    });

    // Tier 2 (Y = 1.50): Brioche Tressée 400g — 6 Multi-Depth Columns × 3 deep (100% EMPTY AT START)
    const briocheCols: Array<{ x: number; init: Array<'brioche_bagged' | null> }> = [
      { x: -1.04, init: [null, null, null] },
      { x: -0.62, init: [null, null, null] },
      { x: -0.2, init: [null, null, null] },
      { x: 0.22, init: [null, null, null] },
      { x: 0.64, init: [null, null, null] },
      { x: 1.06, init: [null, null, null] },
    ];
    briocheCols.forEach((col, i) => {
      buildMultiDepthColumn(ctx, rackFace, helper, tools, {
        id: `bak_brioche_col_${i}`,
        tierName: 'Étagère Brioches Tressées 400g',
        x: col.x,
        y: 1.496,
        shelfFrontZ: 0.52,
        shelfBackZ: 0.07,
        colWidth: 0.36,
        itemHeight: 0.2,
        itemDepth: 0.135,
        depthCount: 3,
        variants: [
          {
            kind: 'brioche_bagged',
            ean: '30140304',
            label: 'Brioche Tressée 400g',
            sublabel: 'Rayon Boulangerie · Sachet Frais',
            buildMesh: buildBriocheBaggedMesh,
          },
        ],
        initialSlots: col.init,
      });
    });
  }

  // ============================================================================
  // 2. CENTER MODULE (Z = -0.34): 100% DIEGETIC 3D STAINLESS BAKERY CONVECTION OVEN
  //    ("FOUR POINT CHAUD 1990")
  // ============================================================================
  {
    const ovenRoot = new THREE.Group();
    ovenRoot.position.set(9.35, 0, -0.34);
    ovenRoot.rotation.y = -Math.PI / 2; // Local +Z faces WEST toward player!
    deptRoot.add(ovenRoot);

    const brushedInoxMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.28,
      metalness: 0.78,
    });
    const darkInoxMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.42,
      metalness: 0.62,
    });
    const ovenInteriorMat = new THREE.MeshStandardMaterial({
      color: 0x26292e,
      roughness: 0.58,
      metalness: 0.45,
    });
    const ovenGlassMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.26,
      roughness: 0.08,
      metalness: 0.12,
      depthWrite: false,
    });
    const coilMat = new THREE.MeshStandardMaterial({
      color: 0x3b302e,
      emissive: COIL_COLD_EMISSIVE.clone(),
      emissiveIntensity: 0.0,
      roughness: 0.45,
      metalness: 0.6,
    });
    const ovenLampMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xffb347,
      emissiveIntensity: 0.08,
      roughness: 0.25,
    });
    const bakeliteMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.44 });
    const startBtnMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x16a34a,
      emissiveIntensity: 0.18,
      roughness: 0.38,
    });
    const pilotLedMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.05,
      roughness: 0.28,
    });
    ctx.disposables.push(
      brushedInoxMat,
      darkInoxMat,
      ovenInteriorMat,
      ovenGlassMat,
      coilMat,
      ovenLampMat,
      bakeliteMat,
      startBtnMat,
      pilotLedMat
    );

    // Lower stainless base cabinet & pull-out tray prep counter (Y = 0..0.86)
    const lowerBase = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.84, 0.72), brushedInoxMat);
    lowerBase.position.set(0, 0.42, 0.02);
    lowerBase.castShadow = true;
    lowerBase.receiveShadow = true;

    const lowerVent = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.5, 0.02), darkInoxMat);
    lowerVent.position.set(0, 0.4, 0.382);

    // Protruding Stainless Prep Shelf right under the oven door for loading/unloading the baking tray!
    const prepShelf = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.036, 0.34), brushedInoxMat);
    prepShelf.position.set(0, 0.858, 0.45);
    prepShelf.castShadow = true;
    prepShelf.receiveShadow = true;

    ovenRoot.add(lowerBase, lowerVent, prepShelf);
    ctx.disposables.push(lowerBase.geometry, lowerVent.geometry, prepShelf.geometry);

    // Upper Convection Oven Shell (Y = 0.88..1.74, hollow cavity facing +Z)
    const ovenTop = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.1, 0.72), brushedInoxMat);
    ovenTop.position.set(0, 1.69, 0.02);
    const ovenBot = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.06, 0.72), brushedInoxMat);
    ovenBot.position.set(0, 0.91, 0.02);
    const ovenBack = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.74, 0.12), brushedInoxMat);
    ovenBack.position.set(0, 1.3, -0.28);
    const ovenWallL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.74, 0.64), brushedInoxMat);
    ovenWallL.position.set(-0.39, 1.3, 0.06);
    const ovenWallR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.74, 0.64), brushedInoxMat);
    ovenWallR.position.set(0.32, 1.3, 0.06); // Houses right-side analog control panel!
    const ovenHoodVent = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.12, 0.56), darkInoxMat);
    ovenHoodVent.position.set(0, 1.8, -0.02);

    // Dark enameled interior lining walls
    const cavBack = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.68), ovenInteriorMat);
    cavBack.position.set(-0.07, 1.3, -0.215);
    const cavFloor = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.58), ovenInteriorMat);
    cavFloor.rotation.x = -Math.PI / 2;
    cavFloor.position.set(-0.07, 0.945, 0.08);
    const cavCeil = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.58), ovenInteriorMat);
    cavCeil.rotation.x = Math.PI / 2;
    cavCeil.position.set(-0.07, 1.635, 0.08);

    // Interior warm lamp panel + convection fan grille
    const ovenLamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.12), ovenLampMat);
    ovenLamp.position.set(-0.07, 1.622, 0.06);
    const fanGrille = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.015, 16), darkInoxMat);
    fanGrille.rotation.x = Math.PI / 2;
    fanGrille.position.set(-0.07, 1.32, -0.205);

    // Interior Stainless Rack Slide Rails (3 levels)
    const railGeo = new THREE.BoxGeometry(0.018, 0.014, 0.52);
    [1.1, 1.26, 1.42].forEach((ry) => {
      const rl = new THREE.Mesh(railGeo, mats.chrome);
      rl.position.set(-0.34, ry, 0.08);
      const rr = new THREE.Mesh(railGeo, mats.chrome);
      rr.position.set(0.2, ry, 0.08);
      ovenRoot.add(rl, rr);
    });

    // Top & bottom tubular glowing heating elements
    const coilGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.46, 8);
    coilGeo.rotateX(Math.PI / 2);
    [-0.22, -0.07, 0.08].forEach((cx) => {
      const topCoil = new THREE.Mesh(coilGeo, coilMat);
      topCoil.position.set(cx, 1.595, 0.06);
      const botCoil = new THREE.Mesh(coilGeo, coilMat);
      botCoil.position.set(cx, 0.975, 0.06);
      ovenRoot.add(topCoil, botCoil);
    });

    ovenRoot.add(
      ovenTop,
      ovenBot,
      ovenBack,
      ovenWallL,
      ovenWallR,
      ovenHoodVent,
      cavBack,
      cavFloor,
      cavCeil,
      ovenLamp,
      fanGrille
    );
    ctx.disposables.push(
      ovenTop.geometry,
      ovenBot.geometry,
      ovenBack.geometry,
      ovenWallL.geometry,
      ovenWallR.geometry,
      ovenHoodVent.geometry,
      cavBack.geometry,
      cavFloor.geometry,
      cavCeil.geometry,
      ovenLamp.geometry,
      fanGrille.geometry,
      railGeo,
      coilGeo
    );

    // Right-Side Analog Control Fascia Canvas ("FOUR POINT CHAUD 1990 · 200°C · 12s")
    const panelCv = document.createElement('canvas');
    panelCv.width = 256;
    panelCv.height = 512;
    const panelTex = new THREE.CanvasTexture(panelCv);
    panelTex.colorSpace = THREE.SRGBColorSpace;
    panelTex.anisotropy = ctx.maxAnisotropy;
    const panelMat = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.42 });
    const panelPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.66), panelMat);
    panelPlane.position.set(0.32, 1.3, 0.382);
    ovenRoot.add(panelPlane);
    ctx.disposables.push(panelTex, panelMat, panelPlane.geometry);

    const redrawOvenPanel = (statusLine: string, timerSec: number, tempLabel: string) => {
      const c = panelCv.getContext('2d')!;
      c.fillStyle = '#1e293b';
      c.fillRect(0, 0, 256, 512);
      c.strokeStyle = '#94a3b8';
      c.lineWidth = 6;
      c.strokeRect(6, 6, 244, 500);

      c.fillStyle = '#f59e0b';
      c.fillRect(14, 16, 228, 48);
      c.fillStyle = '#0f172a';
      c.font = '900 21px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('POINT CHAUD 90', 128, 40);

      // Thermostat scale arc label
      c.fillStyle = '#e2e8f0';
      c.font = '800 18px "JetBrains Mono", monospace';
      c.fillText(`TEMP: ${tempLabel}`, 128, 92);

      // Mechanical timer gauge ticks around knob region (Y ~ 185)
      c.strokeStyle = '#cbd5e1';
      c.lineWidth = 4;
      c.beginPath();
      c.arc(128, 194, 62, Math.PI * 0.75, Math.PI * 2.25);
      c.stroke();

      c.fillStyle = '#fef08a';
      c.font = '900 22px "JetBrains Mono", monospace';
      c.fillText(`${Math.ceil(timerSec).toString().padStart(2, '0')} SEC`, 128, 286);

      // Status strip
      c.fillStyle = '#0f172a';
      c.fillRect(18, 316, 220, 44);
      c.fillStyle = timerSec > 0 ? '#fb923c' : '#86efac';
      c.font = '800 18px "JetBrains Mono", monospace';
      c.fillText(statusLine, 128, 338);

      // Start button legend
      c.fillStyle = '#cbd5e1';
      c.font = '800 16px "JetBrains Mono", monospace';
      c.fillText('CUISSON', 128, 466);
      panelTex.needsUpdate = true;
    };
    redrawOvenPanel('PRÊT · 200°C', 0, '200°C');

    // Physical 3D Rotary Temperature / Timer Dial
    const dialPivot = new THREE.Group();
    dialPivot.position.set(0.32, 1.38, 0.398);
    const dialCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.028, 16), bakeliteMat);
    dialCyl.rotation.x = Math.PI / 2;
    const dialPointer = new THREE.Mesh(
      new THREE.BoxGeometry(0.008, 0.032, 0.032),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    dialPointer.position.set(0, 0.016, 0.002);
    dialPivot.add(dialCyl, dialPointer);
    ovenRoot.add(dialPivot);
    ctx.disposables.push(dialCyl.geometry, dialPointer.geometry, dialPointer.material as THREE.Material);

    // Physical 3D Green [DÉMARRER CUISSON] Button + Amber Heating Pilot Lamp
    const startBtnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.056, 0.026), startBtnMat);
    const startBtnRestZ = 0.396;
    startBtnMesh.position.set(0.32, 1.11, startBtnRestZ);
    const pilotLed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 10), pilotLedMat);
    pilotLed.position.set(0.32, 1.21, 0.388);
    ovenRoot.add(startBtnMesh, pilotLed);
    ctx.disposables.push(startBtnMesh.geometry, pilotLed.geometry);

    // Hinged Glass Oven Door (pivots at left edge x = -0.355)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.355, 1.29, 0.385);
    ovenRoot.add(doorPivot);

    const doorFrameT = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.05, 0.032), brushedInoxMat);
    doorFrameT.position.set(0.285, 0.335, 0);
    const doorFrameB = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.05, 0.032), brushedInoxMat);
    doorFrameB.position.set(0.285, -0.335, 0);
    const doorFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.032), brushedInoxMat);
    doorFrameL.position.set(0.025, 0, 0);
    const doorFrameR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.032), brushedInoxMat);
    doorFrameR.position.set(0.545, 0, 0);
    const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.62), ovenGlassMat);
    doorGlass.position.set(0.285, 0, 0.004);
    doorGlass.renderOrder = 4;
    const doorHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.38, 10), bakeliteMat);
    doorHandle.position.set(0.54, 0, 0.048);
    const handlePostT = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.04), mats.chrome);
    handlePostT.position.set(0.54, 0.14, 0.024);
    const handlePostB = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.04), mats.chrome);
    handlePostB.position.set(0.54, -0.14, 0.024);

    doorPivot.add(
      doorFrameT,
      doorFrameB,
      doorFrameL,
      doorFrameR,
      doorGlass,
      doorHandle,
      handlePostT,
      handlePostB
    );
    ctx.disposables.push(
      doorFrameT.geometry,
      doorFrameB.geometry,
      doorFrameL.geometry,
      doorFrameR.geometry,
      doorGlass.geometry,
      doorHandle.geometry,
      handlePostT.geometry,
      handlePostB.geometry
    );

    // Perforated Aluminum Baking Tray ("Plaque de Cuisson") + 6 Dynamic Dough Slots
    const perfCv = document.createElement('canvas');
    perfCv.width = 256;
    perfCv.height = 256;
    {
      const c = perfCv.getContext('2d')!;
      c.fillStyle = '#cbd5e1';
      c.fillRect(0, 0, 256, 256);
      c.fillStyle = '#475569';
      for (let py = 14; py < 250; py += 16) {
        for (let px = 14; px < 250; px += 16) {
          c.beginPath();
          c.arc(px, py, 3.2, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.strokeStyle = '#64748b';
      c.lineWidth = 10;
      c.strokeRect(5, 5, 246, 246);
    }
    const perfTex = new THREE.CanvasTexture(perfCv);
    perfTex.colorSpace = THREE.SRGBColorSpace;
    const trayAlumMat = new THREE.MeshStandardMaterial({
      map: perfTex,
      roughness: 0.34,
      metalness: 0.72,
    });
    const trayRimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.32,
      metalness: 0.8,
    });

    const trayGroup = new THREE.Group();
    const trayStagingPos = new THREE.Vector3(-0.07, 0.885, 0.45);
    const trayInsidePos = new THREE.Vector3(-0.07, 1.268, 0.08);
    trayGroup.position.copy(trayStagingPos);
    ovenRoot.add(trayGroup);

    const traySheet = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.012, 0.42), trayAlumMat);
    const trayLipF = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.022, 0.012), trayRimMat);
    trayLipF.position.set(0, 0.01, 0.205);
    const trayLipB = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.022, 0.012), trayRimMat);
    trayLipB.position.set(0, 0.01, -0.205);
    const trayLipL = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.42), trayRimMat);
    trayLipL.position.set(-0.24, 0.01, 0);
    const trayLipR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.42), trayRimMat);
    trayLipR.position.set(0.24, 0.01, 0);
    trayGroup.add(traySheet, trayLipF, trayLipB, trayLipL, trayLipR);
    ctx.disposables.push(
      perfTex,
      trayAlumMat,
      trayRimMat,
      traySheet.geometry,
      trayLipF.geometry,
      trayLipB.geometry,
      trayLipL.geometry,
      trayLipR.geometry
    );

    // Dedicated dynamic dough material whose color smoothly interpolates #F3E5AB -> #C67D2E!
    const trayDoughMat = new THREE.MeshStandardMaterial({
      color: RAW_DOUGH_COLOR.clone(),
      roughness: 0.72,
    });
    ctx.disposables.push(trayDoughMat);

    const MAX_TRAY_PIECES = 6;
    interface TrayDoughSlot {
      root: THREE.Group;
      bagMesh: THREE.Mesh;
      croisMesh: THREE.Group;
      painMesh: THREE.Group;
    }
    const trayDoughSlots: TrayDoughSlot[] = [];

    // 6 neatly arranged positions on the perforated aluminum baking tray
    const baguetteXs = [-0.185, -0.111, -0.037, 0.037, 0.111, 0.185];
    const pastryCoords: Array<[number, number]> = [
      [-0.145, -0.095],
      [0.0, -0.095],
      [0.145, -0.095],
      [-0.145, 0.095],
      [0.0, 0.095],
      [0.145, 0.095],
    ];

    const trayBagGeo = new THREE.CapsuleGeometry(0.024, 0.28, 5, 10);
    trayBagGeo.rotateX(Math.PI / 2);
    ctx.disposables.push(trayBagGeo);

    for (let i = 0; i < MAX_TRAY_PIECES; i++) {
      const slotGrp = new THREE.Group();
      slotGrp.visible = false;
      trayGroup.add(slotGrp);

      const bagMesh = new THREE.Mesh(trayBagGeo, trayDoughMat);
      bagMesh.position.set(baguetteXs[i], 0.03, 0);

      const croisMesh = new THREE.Group();
      const cArc = new THREE.Mesh(croissantArcGeo, trayDoughMat);
      const cMid = new THREE.Mesh(croissantCenterGeo, trayDoughMat);
      cMid.scale.set(1.3, 0.85, 1.0);
      cMid.position.set(0, 0.004, -0.026);
      croisMesh.add(cArc, cMid);
      croisMesh.position.set(pastryCoords[i][0], 0.026, pastryCoords[i][1]);

      const painMesh = new THREE.Group();
      const pBody = new THREE.Mesh(painChocBodyGeo, trayDoughMat);
      const pBar1 = new THREE.Mesh(painChocBarGeo, chocolateTipMat);
      pBar1.position.set(0, -0.002, -0.018);
      const pBar2 = new THREE.Mesh(painChocBarGeo, chocolateTipMat);
      pBar2.position.set(0, -0.002, 0.018);
      painMesh.add(pBody, pBar1, pBar2);
      painMesh.position.set(pastryCoords[i][0], 0.03, pastryCoords[i][1]);

      slotGrp.add(bagMesh, croisMesh, painMesh);
      trayDoughSlots.push({ root: slotGrp, bagMesh, croisMesh, painMesh });
    }

    // Oven State Machine
    type TrayLocation = 'staging_raw' | 'inside_raw' | 'baking' | 'inside_baked' | 'staging_baked';
    let doorOpen = false;
    let doorAngle = 0;
    let trayLoc: TrayLocation = 'staging_raw';
    let trayKind: RawDoughKind | null = null;
    let trayCount = 0;
    let bakeElapsed = 0;
    let bakeProgress = 0; // 0 = pale raw, 1 = golden baked
    let startBtnPress = 0;
    let dialTempMode = 0; // 0 = 200°C, 1 = 210°C, 2 = 190°C
    const tempLabels = ['200°C', '210°C', '190°C'];
    let lastDrawnSec = -1;

    const syncTrayDoughMeshes = () => {
      trayDoughMat.color.copy(RAW_DOUGH_COLOR).lerp(BAKED_CRUST_COLOR, bakeProgress);
      const riseScale = THREE.MathUtils.lerp(1.0, 1.24, bakeProgress);

      for (let i = 0; i < trayDoughSlots.length; i++) {
        const s = trayDoughSlots[i];
        const active = trayKind !== null && i < trayCount;
        s.root.visible = active;
        if (!active) continue;
        s.bagMesh.visible = trayKind === 'baguette_raw';
        s.croisMesh.visible = trayKind === 'croissant_raw';
        s.painMesh.visible = trayKind === 'pain_choc_raw';
        // Smooth rising expansion during baking
        s.bagMesh.scale.set(riseScale, riseScale, 1 + (riseScale - 1) * 0.45);
        s.croisMesh.scale.setScalar(riseScale);
        s.painMesh.scale.setScalar(riseScale);
      }
    };
    syncTrayDoughMeshes();

    // 1) Staging Perforated Baking Tray Hitbox (when outside on the stainless prep shelf)
    registerDiegeticBox(ovenRoot, {
      id: 'bakery_oven_staging_tray',
      size: [0.56, 0.18, 0.48],
      pos: [-0.07, 0.94, 0.45],
      title: 'Plaque de Cuisson Perforée (Alu)',
      subtitle: 'Posez des pâtons crus depuis un carton boulangerie ouvert',
      isVisible: () => trayLoc === 'staging_raw' || trayLoc === 'staging_baked',
      dynamicTitle: () => {
        if (trayLoc === 'staging_baked' && trayKind) {
          return `Fournée Dorée — ${getBakedResultForRaw(trayKind).label} (${trayCount})`;
        }
        return `Plaque de Cuisson Alu (${trayCount}/${MAX_TRAY_PIECES})`;
      },
      dynamicSubtitle: () => {
        if (trayLoc === 'staging_baked' && trayKind) {
          return `${trayCount} pièce(s) chaude(s) prête(s) à mettre en rayon (ou à trancher)`;
        }
        if (trayCount === 0) {
          return 'Commandez des cartons surgelés (Terminal Commande 1990) puis posez les pâtons crus ici';
        }
        return 'Ouvrez la porte du Four Point Chaud puis cliquez dans la chambre pour [ENFOURNER]';
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (trayLoc === 'staging_baked' && trayKind && trayCount > 0) {
          if (tools.getActiveTool() === 'hands' && !held) {
            return `PRENDRE ${getBakedResultForRaw(trayKind).shortAction} (${trayCount})`;
          }
          return `FOURNÉE PRÊTE (${trayCount}) — MAINS LIBRES`;
        }
        if (tools.getActiveTool() === 'hands' && held && isRawDoughKind(held.kind)) {
          if (trayCount >= MAX_TRAY_PIECES) {
            return `PLAQUE PLEINE (${MAX_TRAY_PIECES}/${MAX_TRAY_PIECES}) — ENFOURNER`;
          }
          if (trayKind !== null && trayKind !== held.kind) {
            return 'UN SEUL TYPE DE PÂTON PAR PLAQUE';
          }
          return `POSER SUR LA PLAQUE (${trayCount + 1}/${MAX_TRAY_PIECES})`;
        }
        if (trayCount > 0) {
          return `PLAQUE GARNIE (${trayCount}/${MAX_TRAY_PIECES}) — OUVRIR FOUR`;
        }
        return 'PLAQUE VIDE (POSER PÂTONS CRUS)';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        const held = tools.getHeldItem();

        // Unloading freshly baked golden pieces one-by-one into player hands
        if (trayLoc === 'staging_baked' && trayKind && trayCount > 0) {
          if (tools.getActiveTool() === 'hands' && !held) {
            const res = getBakedResultForRaw(trayKind);
            trayCount -= 1;
            if (trayCount === 0) {
              trayKind = null;
              trayLoc = 'staging_raw';
              bakeProgress = 0;
              redrawOvenPanel('PRÊT · ' + tempLabels[dialTempMode], 0, tempLabels[dialTempMode]);
            }
            syncTrayDoughMeshes();
            tools.pickUpItem({
              kind: res.kind,
              label: res.label,
              sublabel: res.sublabel,
              ean: res.ean,
            });
            soundSynth.playBagThump();
          } else {
            soundSynth.playAtmPiezo('error');
          }
          return;
        }

        // Loading pale raw dough pieces onto the perforated tray
        if (trayLoc === 'staging_raw' && tools.getActiveTool() === 'hands' && held && isRawDoughKind(held.kind)) {
          if (trayCount < MAX_TRAY_PIECES && (trayKind === null || trayKind === held.kind)) {
            trayKind = held.kind;
            trayCount += 1;
            bakeProgress = 0;
            tools.consumeHeldItem();
            syncTrayDoughMeshes();
            soundSynth.playBagThump();
            redrawOvenPanel(`PLAQUE ${trayCount}/${MAX_TRAY_PIECES}`, 0, tempLabels[dialTempMode]);
          } else {
            soundSynth.playAtmPiezo('error');
          }
          return;
        }

        soundSynth.playUiTone(false);
      },
    });

    // 2) Hinged Glass Oven Door Hitbox (attached to doorPivot so it swings cleanly with the door!)
    registerDiegeticBox(doorPivot, {
      id: 'bakery_oven_door',
      size: [0.58, 0.7, 0.11],
      pos: [0.285, 0, 0.02],
      title: 'Porte Vitrée — Four Point Chaud 1990',
      subtitle: 'Double vitrage ventilé · Ouverture latérale',
      verb: () => {
        if (trayLoc === 'baking') {
          return `CUISSON EN COURS (${Math.ceil(OVEN_BAKE_DURATION_SEC - bakeElapsed)}s)`;
        }
        return doorOpen ? 'FERMER PORTE DU FOUR' : 'OUVRIR PORTE DU FOUR';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        if (trayLoc === 'baking') {
          soundSynth.playAtmPiezo('error');
          return;
        }
        doorOpen = !doorOpen;
        if (doorOpen) soundSynth.playUiTone(true);
        else soundSynth.playMechanicalButtonClick();
      },
    });

    // 3) Oven Interior Cavity Hitbox (Visible ONLY when door is open: [ENFOURNER] / [DÉFOURNER LA FOURNÉE])
    registerDiegeticBox(ovenRoot, {
      id: 'bakery_oven_cavity',
      size: [0.54, 0.58, 0.44],
      pos: [-0.07, 1.29, 0.08],
      title: 'Chambre de Cuisson Inox — Four Point Chaud',
      subtitle: 'Glissières chromées · Convection chaleur tournante',
      isVisible: () => doorOpen,
      verb: () => {
        if (trayLoc === 'inside_baked') {
          return 'DÉFOURNER LA FOURNÉE';
        }
        if (trayLoc === 'staging_raw' && trayCount > 0) {
          return `ENFOURNER LA PLAQUE (${trayCount} PÂTONS)`;
        }
        if (trayLoc === 'inside_raw') {
          return 'PLAQUE ENFOURNÉE — FERMER PORTE';
        }
        return 'FOUR VIDE — GARNIR LA PLAQUE';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        if (!doorOpen) return;

        if (trayLoc === 'staging_raw' && trayCount > 0) {
          trayLoc = 'inside_raw';
          soundSynth.playOvenRackSlide();
          redrawOvenPanel('FERMER PORTE', 0, tempLabels[dialTempMode]);
          return;
        }
        if (trayLoc === 'inside_baked') {
          trayLoc = 'staging_baked';
          soundSynth.playOvenRackSlide();
          redrawOvenPanel('DÉFOURNÉE !', 0, tempLabels[dialTempMode]);
          return;
        }
        if (trayLoc === 'inside_raw') {
          // Allow pulling back out to staging if user wants to add more dough pieces
          trayLoc = 'staging_raw';
          soundSynth.playOvenRackSlide();
          redrawOvenPanel(`PLAQUE ${trayCount}/${MAX_TRAY_PIECES}`, 0, tempLabels[dialTempMode]);
          return;
        }
        soundSynth.playAtmPiezo('error');
      },
    });

    // 4) Physical 3D Temperature/Timer Dial Hitbox
    registerDiegeticBox(ovenRoot, {
      id: 'bakery_oven_dial',
      size: [0.14, 0.14, 0.09],
      pos: [0.32, 1.38, 0.41],
      title: 'Thermostat & Minuterie 1990',
      subtitle: 'Sélecteur rotatif mécanique 190°C – 210°C',
      verb: () =>
        trayLoc === 'baking'
          ? `MINUTERIE : ${Math.ceil(OVEN_BAKE_DURATION_SEC - bakeElapsed)}s`
          : `RÉGLER THERMOSTAT (${tempLabels[dialTempMode]})`,
      onInteract: () => {
        if (!acquireLocalLock()) return;
        if (trayLoc === 'baking') return;
        dialTempMode = (dialTempMode + 1) % tempLabels.length;
        soundSynth.playAtmPiezo('bezel');
        redrawOvenPanel('PRÊT · ' + tempLabels[dialTempMode], 0, tempLabels[dialTempMode]);
      },
    });

    // 5) Physical 3D Green [DÉMARRER CUISSON] Start Button Hitbox
    registerDiegeticBox(ovenRoot, {
      id: 'bakery_oven_start_btn',
      size: [0.14, 0.12, 0.09],
      pos: [0.32, 1.11, 0.41],
      title: 'Bouton Vert — Démarrer Cuisson',
      subtitle: 'Cycle convection 12 secondes · Dorure & levée',
      verb: () => {
        if (trayLoc === 'baking') {
          return `CUISSON EN COURS (${Math.ceil(OVEN_BAKE_DURATION_SEC - bakeElapsed)}s)`;
        }
        if (trayLoc === 'inside_baked') {
          return 'CUISSON TERMINÉE — OUVRIR PORTE';
        }
        if (trayLoc !== 'inside_raw') {
          return "ENFOURNER LA PLAQUE D'ABORD";
        }
        if (doorOpen) {
          return "FERMER LA PORTE D'ABORD";
        }
        return 'DÉMARRER CUISSON';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        startBtnPress = 1.0;

        if (trayLoc === 'inside_raw' && !doorOpen) {
          trayLoc = 'baking';
          bakeElapsed = 0;
          bakeProgress = 0;
          lastDrawnSec = -1;
          soundSynth.playAtmPiezo('confirm');
          redrawOvenPanel('CUISSON...', OVEN_BAKE_DURATION_SEC, tempLabels[dialTempMode]);
        } else {
          soundSynth.playAtmPiezo('error');
        }
      },
    });

    // Per-frame smooth animations for Oven Door, Tray Sliding, 12s Baking Rising/Browning & Heating Coils
    ctx.updaters.push({
      update: (dt) => {
        // 1) Hinged door smooth swing
        const targetDoorAngle = doorOpen ? -1.62 : 0;
        doorAngle = THREE.MathUtils.damp(doorAngle, targetDoorAngle, 8, dt);
        doorPivot.rotation.y = doorAngle;

        // 2) Perforated tray smooth glide between staging prep shelf & oven interior rails
        const targetTrayPos =
          trayLoc === 'staging_raw' || trayLoc === 'staging_baked' ? trayStagingPos : trayInsidePos;
        trayGroup.position.x = THREE.MathUtils.damp(trayGroup.position.x, targetTrayPos.x, 9, dt);
        trayGroup.position.y = THREE.MathUtils.damp(trayGroup.position.y, targetTrayPos.y, 9, dt);
        trayGroup.position.z = THREE.MathUtils.damp(trayGroup.position.z, targetTrayPos.z, 9, dt);

        // 3) Green start button spring depression
        if (startBtnPress > 0) {
          startBtnPress = Math.max(0, startBtnPress - dt * 6.5);
        }
        startBtnMesh.position.z = startBtnRestZ - startBtnPress * 0.011;

        // 4) 12-Second Baking Cycle (Heating coils glow, dial sweeps down, dough rises & browns!)
        const isBaking = trayLoc === 'baking';
        if (isBaking) {
          bakeElapsed = Math.min(OVEN_BAKE_DURATION_SEC, bakeElapsed + dt);
          bakeProgress = bakeElapsed / OVEN_BAKE_DURATION_SEC;
          syncTrayDoughMeshes();

          const remaining = Math.max(0, OVEN_BAKE_DURATION_SEC - bakeElapsed);
          const ceilSec = Math.ceil(remaining);
          if (ceilSec !== lastDrawnSec) {
            lastDrawnSec = ceilSec;
            redrawOvenPanel('CUISSON...', remaining, tempLabels[dialTempMode]);
          }

          // Rotate mechanical timer dial smoothly toward 0
          dialPivot.rotation.z = -(remaining / OVEN_BAKE_DURATION_SEC) * Math.PI * 1.4;

          if (bakeElapsed >= OVEN_BAKE_DURATION_SEC) {
            trayLoc = 'inside_baked';
            bakeProgress = 1.0;
            syncTrayDoughMeshes();
            soundSynth.playOvenDing();
            redrawOvenPanel('CUISSON OK!', 0, tempLabels[dialTempMode]);
          }
        } else {
          const restDialAngle = -dialTempMode * 0.55;
          dialPivot.rotation.z = THREE.MathUtils.damp(dialPivot.rotation.z, restDialAngle, 10, dt);
        }

        // Smooth warm-red heating elements & interior halogen glow
        const targetHeat = isBaking ? 1.0 : 0.0;
        const nextHeat = THREE.MathUtils.damp(coilMat.emissiveIntensity, targetHeat * 1.35, 3.5, dt);
        coilMat.emissiveIntensity = nextHeat;
        coilMat.emissive.copy(COIL_COLD_EMISSIVE).lerp(COIL_HOT_EMISSIVE, Math.min(1, nextHeat));
        ovenLampMat.emissiveIntensity = THREE.MathUtils.damp(
          ovenLampMat.emissiveIntensity,
          isBaking ? 0.95 : doorOpen ? 0.35 : 0.08,
          6,
          dt
        );
        pilotLedMat.emissiveIntensity = THREE.MathUtils.damp(
          pilotLedMat.emissiveIntensity,
          isBaking ? 1.15 : trayLoc === 'inside_baked' ? 0.45 : 0.06,
          8,
          dt
        );
      },
    });
  }

  // ============================================================================
  // 3. NORTH MODULE (Z = -1.12): INTERACTIVE 3D ELECTRIC BREAD SLICER
  //    ("TRANCHEUSE À PAIN 1990")
  // ============================================================================
  {
    const slicerRoot = new THREE.Group();
    slicerRoot.position.set(9.35, 0, -1.12);
    slicerRoot.rotation.y = -Math.PI / 2; // Local +Z faces WEST toward player!
    deptRoot.add(slicerRoot);

    const slicerWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.36,
      metalness: 0.14,
    });
    const slicerLidGlassMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      metalness: 0.1,
      depthWrite: false,
    });
    const slicerBtnMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x16a34a,
      emissiveIntensity: 0.18,
      roughness: 0.38,
    });
    const redKnobMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
    ctx.disposables.push(slicerWhiteMat, slicerLidGlassMat, slicerBtnMat, redKnobMat);

    // Lower painted steel body & crumb drawer
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.88, 0.66), slicerWhiteMat);
    sBody.position.set(0, 0.44, 0.02);
    sBody.castShadow = true;
    sBody.receiveShadow = true;

    const crumbDrawer = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.04), mats.anthracite);
    crumbDrawer.position.set(0, 0.28, 0.352);

    // Front nameplate strip
    const sPlateCv = document.createElement('canvas');
    sPlateCv.width = 256;
    sPlateCv.height = 64;
    {
      const c = sPlateCv.getContext('2d')!;
      c.fillStyle = '#1e293b';
      c.fillRect(0, 0, 256, 64);
      c.fillStyle = '#fef08a';
      c.font = '900 18px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('TRANCHEUSE PAIN 90', 128, 22);
      c.fillStyle = '#e2e8f0';
      c.font = '700 14px "JetBrains Mono", monospace';
      c.fillText('LAMES INOX · PAS 11 MM', 128, 46);
    }
    const sPlateTex = new THREE.CanvasTexture(sPlateCv);
    sPlateTex.colorSpace = THREE.SRGBColorSpace;
    const sPlateMat = new THREE.MeshStandardMaterial({ map: sPlateTex, roughness: 0.4 });
    const sPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), sPlateMat);
    sPlate.position.set(0, 0.72, 0.352);

    // Stainless sloped upper slicing deck & side cheeks
    const sDeck = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.56), mats.stainless);
    sDeck.position.set(0, 0.92, 0.02);
    sDeck.rotation.x = 0.16;

    const sWallL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.56), mats.stainless);
    sWallL.position.set(-0.26, 1.08, 0.02);
    const sWallR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.32, 0.56), mats.stainless);
    sWallR.position.set(0.26, 1.08, 0.02);
    const sBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.32, 0.04), mats.stainless);
    sBack.position.set(0, 1.08, -0.25);

    slicerRoot.add(sBody, crumbDrawer, sPlate, sDeck, sWallL, sWallR, sBack);
    ctx.disposables.push(
      sBody.geometry,
      crumbDrawer.geometry,
      sPlateTex,
      sPlateMat,
      sPlate.geometry,
      sDeck.geometry,
      sWallL.geometry,
      sWallR.geometry,
      sBack.geometry
    );

    // 15 Individual Animated Reciprocating Parallel Steel Blades (2 alternating combs!)
    const bladeGeo = new THREE.BoxGeometry(0.0045, 0.22, 0.16);
    ctx.disposables.push(bladeGeo);
    const bladeCombA = new THREE.Group();
    const bladeCombB = new THREE.Group();
    slicerRoot.add(bladeCombA, bladeCombB);

    for (let i = 0; i < 15; i++) {
      const bx = -0.21 + i * 0.03;
      const bMesh = new THREE.Mesh(bladeGeo, mats.chrome);
      bMesh.position.set(bx, 1.08, 0.02);
      bMesh.rotation.x = 0.18;
      if (i % 2 === 0) bladeCombA.add(bMesh);
      else bladeCombB.add(bMesh);
    }

    // Side Mechanical Lever + Red Bakelite Ball Knob (animates smoothly while slicing)
    const leverPivot = new THREE.Group();
    leverPivot.position.set(0.305, 0.96, 0.06);
    const leverArm = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.32, 8), mats.chrome);
    leverArm.position.set(0, 0.16, 0);
    const leverKnob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), redKnobMat);
    leverKnob.position.set(0, 0.32, 0);
    leverPivot.add(leverArm, leverKnob);
    slicerRoot.add(leverPivot);
    ctx.disposables.push(leverArm.geometry, leverKnob.geometry);

    // Physical 3D Green Start Button on Front Control Corner
    const sStartBtn = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.05, 0.024), slicerBtnMat);
    const sBtnRestZ = 0.358;
    sStartBtn.position.set(0.2, 0.82, sBtnRestZ);
    slicerRoot.add(sStartBtn);
    ctx.disposables.push(sStartBtn.geometry);

    // Clear Hinged Safety Hood/Lid (pivots around back edge z = -0.24, y = 1.24)
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.24, -0.24);
    slicerRoot.add(lidPivot);

    const lidTopGlass = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.014, 0.54), slicerLidGlassMat);
    lidTopGlass.position.set(0, 0.02, 0.27);
    lidTopGlass.renderOrder = 4;
    const lidFrontLip = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.16, 0.014), slicerLidGlassMat);
    lidFrontLip.position.set(0, -0.06, 0.54);
    lidFrontLip.renderOrder = 4;
    const lidHandle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.02, 0.028), mats.anthracite);
    lidHandle.position.set(0, -0.1, 0.556);
    lidPivot.add(lidTopGlass, lidFrontLip, lidHandle);
    ctx.disposables.push(lidTopGlass.geometry, lidFrontLip.geometry, lidHandle.geometry);

    // Loaded Whole Baguette & Output Sliced Bagged Baguette inside Chute
    const loadedBaguetteMesh = buildWholeBaguetteMesh();
    loadedBaguetteMesh.rotation.y = Math.PI / 2; // Horizontal across the 15 parallel blades!
    loadedBaguetteMesh.position.set(0, 0.99, -0.1);
    loadedBaguetteMesh.visible = false;

    const slicedOutputMesh = buildSlicedBaguetteMesh();
    slicedOutputMesh.rotation.y = Math.PI / 2;
    slicedOutputMesh.position.set(0, 0.94, 0.21);
    slicedOutputMesh.visible = false;

    slicerRoot.add(loadedBaguetteMesh, slicedOutputMesh);

    // Bread Slicer State Machine
    type SlicerState = 'empty' | 'loaded' | 'slicing' | 'done';
    let slicerState: SlicerState = 'empty';
    let lidOpen = true;
    let lidAngle = -0.95;
    let sliceElapsed = 0;
    let sBtnPress = 0;

    // 1) Chute Hitbox: Load baked baguette (`[TRANCHER LA BAGUETTE]`) or pick up sliced bagged baguette
    registerDiegeticBox(slicerRoot, {
      id: 'bakery_slicer_chute',
      size: [0.54, 0.34, 0.54],
      pos: [0, 1.05, 0.06],
      title: 'Trancheuse à Pain 1990 (Goulotte)',
      subtitle: '15 lames parallèles oscillantes · Pas 11 mm',
      dynamicProductEan: () => (slicerState === 'done' ? '30140301' : null),
      dynamicSubtitle: () => {
        if (slicerState === 'empty') {
          return 'Tenez une Baguette Dorée cuite pour la charger dans la trancheuse';
        }
        if (slicerState === 'loaded') {
          return lidOpen
            ? 'Baguette chargée — Fermez le capot de sécurité puis lancez la trancheuse'
            : 'Capot fermé — Appuyez sur le bouton vert [LANCER TRANCHEUSE]';
        }
        if (slicerState === 'slicing') {
          return 'Découpe en cours — Lames oscillantes inox actives';
        }
        return 'Baguette tranchée en sachet prête — Récupérez pour mettre en rayon !';
      },
      verb: () => {
        const held = tools.getHeldItem();
        if (slicerState === 'empty') {
          if (tools.getActiveTool() === 'hands' && held?.kind === 'baguette_baked') {
            return 'TRANCHER LA BAGUETTE (CHARGER)';
          }
          return 'TRANCHEUSE VIDE (BAGUETTE CUITE REQUISE)';
        }
        if (slicerState === 'loaded') {
          return lidOpen ? 'FERMER CAPOT DE SÉCURITÉ' : 'PRÊT — APPUYER BOUTON VERT';
        }
        if (slicerState === 'slicing') {
          return 'DÉCOUPE EN COURS...';
        }
        if (tools.getActiveTool() === 'hands' && !held) {
          return 'PRENDRE BAGUETTE TRANCHÉE';
        }
        return 'BAGUETTE TRANCHÉE PRÊTE (MAINS LIBRES)';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        const held = tools.getHeldItem();

        if (slicerState === 'empty' && tools.getActiveTool() === 'hands' && held?.kind === 'baguette_baked') {
          lidOpen = true;
          slicerState = 'loaded';
          loadedBaguetteMesh.visible = true;
          loadedBaguetteMesh.position.set(0, 0.99, -0.1);
          slicedOutputMesh.visible = false;
          tools.consumeHeldItem();
          soundSynth.playBagThump();
          return;
        }

        if (slicerState === 'loaded' && lidOpen) {
          lidOpen = false;
          soundSynth.playMechanicalButtonClick();
          return;
        }

        if (slicerState === 'done' && tools.getActiveTool() === 'hands' && !held) {
          slicerState = 'empty';
          slicedOutputMesh.visible = false;
          lidOpen = true;
          tools.pickUpItem({
            kind: 'baguette_sliced',
            label: 'Baguette Tradition 250g (Tranchée)',
            sublabel: 'Ensachée · À poser en panier boulangerie',
            ean: '30140301',
          });
          soundSynth.playPlasticSlide();
          return;
        }

        soundSynth.playUiTone(false);
      },
    });

    // 2) Clear Hinged Safety Hood Hitbox
    registerDiegeticBox(slicerRoot, {
      id: 'bakery_slicer_lid',
      size: [0.54, 0.16, 0.28],
      pos: [0, 1.32, 0.16],
      title: 'Capot Transparent de Sécurité',
      subtitle: 'Verrouillage obligatoire avant mise en marche des lames',
      verb: () => {
        if (slicerState === 'slicing') return 'CAPOT VERROUILLÉ (LAMES ACTIVES)';
        return lidOpen ? 'FERMER CAPOT SÉCURITÉ' : 'OUVRIR CAPOT SÉCURITÉ';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        if (slicerState === 'slicing') {
          soundSynth.playAtmPiezo('error');
          return;
        }
        lidOpen = !lidOpen;
        if (lidOpen) soundSynth.playUiTone(true);
        else soundSynth.playMechanicalButtonClick();
      },
    });

    // 3) Green Physical Start Switch / Side Lever Hitbox
    registerDiegeticBox(slicerRoot, {
      id: 'bakery_slicer_start',
      size: [0.22, 0.24, 0.24],
      pos: [0.24, 0.88, 0.3],
      title: 'Interrupteur Vert — Lancer Trancheuse',
      subtitle: 'Démarre les 15 lames parallèles oscillantes',
      verb: () => {
        if (slicerState === 'slicing') return 'TRANCHAGE EN COURS...';
        if (slicerState === 'done') return 'PRENDRE BAGUETTE TRANCHÉE';
        if (slicerState === 'empty') return "CHARGER UNE BAGUETTE D'ABORD";
        if (lidOpen) return "FERMER LE CAPOT D'ABORD";
        return 'LANCER TRANCHEUSE';
      },
      onInteract: () => {
        if (!acquireLocalLock()) return;
        sBtnPress = 1.0;

        if (slicerState === 'loaded' && !lidOpen) {
          slicerState = 'slicing';
          sliceElapsed = 0;
          soundSynth.playBreadSlicerRun(SLICER_DURATION_SEC);
        } else {
          soundSynth.playAtmPiezo('error');
        }
      },
    });

    // Per-frame smooth animations for Safety Lid, 15 Oscillating Parallel Blades, Side Lever & Baguette Feed
    ctx.updaters.push({
      update: (dt, elapsed) => {
        const targetLidAngle = lidOpen ? -0.95 : 0;
        lidAngle = THREE.MathUtils.damp(lidAngle, targetLidAngle, 10, dt);
        lidPivot.rotation.x = lidAngle;

        if (sBtnPress > 0) {
          sBtnPress = Math.max(0, sBtnPress - dt * 6.5);
        }
        sStartBtn.position.z = sBtnRestZ - sBtnPress * 0.011;

        if (slicerState === 'slicing') {
          sliceElapsed = Math.min(SLICER_DURATION_SEC, sliceElapsed + dt);
          const t = sliceElapsed / SLICER_DURATION_SEC;

          // Rapid opposing vertical oscillation of the 15 parallel steel blades!
          const osc = Math.sin(elapsed * 48) * 0.022;
          bladeCombA.position.y = osc;
          bladeCombB.position.y = -osc;

          // Mechanical lever pulls forward & baguette glides smoothly through the blades
          leverPivot.rotation.x = THREE.MathUtils.lerp(0.0, 0.72, t);
          loadedBaguetteMesh.position.z = THREE.MathUtils.lerp(-0.1, 0.2, t);
          loadedBaguetteMesh.position.y = THREE.MathUtils.lerp(0.99, 0.94, t);

          if (sliceElapsed >= SLICER_DURATION_SEC) {
            slicerState = 'done';
            loadedBaguetteMesh.visible = false;
            slicedOutputMesh.visible = true;
            lidOpen = true; // Pop hood cleanly open for instant retrieval!
            bladeCombA.position.y = 0;
            bladeCombB.position.y = 0;
            soundSynth.playAtmPiezo('confirm');
          }
        } else {
          bladeCombA.position.y = THREE.MathUtils.damp(bladeCombA.position.y, 0, 14, dt);
          bladeCombB.position.y = THREE.MathUtils.damp(bladeCombB.position.y, 0, 14, dt);
          leverPivot.rotation.x = THREE.MathUtils.damp(leverPivot.rotation.x, 0, 8, dt);
        }
      },
    });
  }
}
