import * as THREE from 'three';
import { INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { InteractableItem, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';

const RAIL_BOX_COOLDOWN_MS = 320;
const FLAP_OPEN_RAD = (115 * Math.PI) / 180; // 115 degrees outward fold

function createCorrugatedOuterTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 256;
  const c = cv.getContext('2d')!;

  // Warm corrugated kraft cardboard base
  c.fillStyle = '#c19668';
  c.fillRect(0, 0, 1024, 256);

  // Subtle vertical corrugation flute shading & kraft fiber grain
  for (let x = 0; x < 1024; x += 6) {
    c.fillStyle = x % 12 === 0 ? 'rgba(92,58,28,0.08)' : 'rgba(255,235,205,0.05)';
    c.fillRect(x, 0, 3, 256);
  }
  for (let i = 0; i < 420; i++) {
    const gx = (i * 97) % 1024;
    const gy = (i * 53) % 256;
    c.fillStyle = i % 2 === 0 ? 'rgba(65,42,20,0.09)' : 'rgba(245,220,185,0.07)';
    c.fillRect(gx, gy, 4 + (i % 7), 2);
  }

  // Top & bottom subtle fold border lines
  c.strokeStyle = 'rgba(55,34,15,0.32)';
  c.lineWidth = 4;
  c.strokeRect(4, 4, 1016, 248);

  // Crisp black industrial stencil markings (Left & Center)
  c.fillStyle = '#171717';
  c.fillRect(28, 26, 708, 6);
  c.fillRect(28, 134, 708, 4);

  c.font = '900 32px "JetBrains Mono", monospace';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('RÉGLETTES PLASTIQUE 120cm', 34, 68);

  c.font = '800 24px "JetBrains Mono", monospace';
  c.fillText('FRAGILE — LOT DE 10  ·  PVC TRANSPARENT', 34, 110);

  // Small handling pictograms ("HAUT ↑↑" + Fragile glass icon + Keep dry)
  c.strokeStyle = '#171717';
  c.lineWidth = 3;
  // Box 1: Up arrows
  c.strokeRect(34, 152, 68, 72);
  c.font = '900 34px sans-serif';
  c.textAlign = 'center';
  c.fillText('↑↑', 68, 184);
  c.font = '800 13px "JetBrains Mono", monospace';
  c.fillText('HAUT', 68, 212);

  // Box 2: Fragile wine glass silhouette
  c.strokeRect(114, 152, 68, 72);
  c.beginPath();
  c.moveTo(136, 164);
  c.lineTo(160, 164);
  c.lineTo(156, 184);
  c.lineTo(140, 184);
  c.closePath();
  c.fill();
  c.fillRect(146, 184, 4, 18);
  c.fillRect(138, 200, 20, 4);
  c.font = '800 11px "JetBrains Mono", monospace';
  c.fillText('FRAGILE', 148, 215);

  // Logistics ref text
  c.textAlign = 'left';
  c.font = '700 18px "JetBrains Mono", monospace';
  c.fillText('CONTACT EXPRESS ÉQUIPEMENT RAYON · RÉF. REG-120-PVC', 200, 178);
  c.font = '700 16px "JetBrains Mono", monospace';
  c.fillText('POIDS BRUT : 2,4 KG   |   OUVRIR AU CUTTER SUR BANDE CENTRALE', 200, 208);

  // Realistic white adhesive barcode shipping label on right end
  c.fillStyle = '#fafaf5';
  c.fillRect(764, 24, 232, 206);
  c.strokeStyle = '#334155';
  c.lineWidth = 3;
  c.strokeRect(764, 24, 232, 206);

  c.fillStyle = '#0f172a';
  c.fillRect(764, 24, 232, 34);
  c.fillStyle = '#ffffff';
  c.font = '800 16px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.fillText('EXPÉDITION RAYONNAGE', 880, 42);

  c.fillStyle = '#0f172a';
  c.textAlign = 'left';
  c.font = '800 18px "JetBrains Mono", monospace';
  c.fillText('LOT #90-11-402', 778, 82);
  c.font = '700 14px "JetBrains Mono", monospace';
  c.fillText('QTÉ : 10 × 120cm', 778, 108);

  // Crisp EAN-128 barcode stripes
  for (let b = 0; b < 34; b++) {
    const bw = b % 4 === 0 ? 4 : b % 3 === 0 ? 3 : 2;
    c.fillRect(778 + b * 6, 126, bw, 70);
  }
  c.font = '700 13px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.fillText('3 451990 120010', 880, 212);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createCorrugatedInnerTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const c = cv.getContext('2d')!;

  // Slightly darker raw inner corrugated kraft board
  c.fillStyle = '#9f764d';
  c.fillRect(0, 0, 512, 256);
  for (let x = 0; x < 512; x += 6) {
    c.fillStyle = x % 12 === 0 ? 'rgba(55,34,16,0.14)' : 'rgba(235,205,170,0.06)';
    c.fillRect(x, 0, 3, 256);
  }
  // Subtle inner corner crease shadows
  const grad = c.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(30,18,8,0.08)');
  grad.addColorStop(0.82, 'rgba(30,18,8,0.04)');
  grad.addColorStop(1, 'rgba(20,12,5,0.28)');
  c.fillStyle = grad;
  c.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createCorrugatedPlainTexture(maxAniso: number): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 128;
  const c = cv.getContext('2d')!;

  c.fillStyle = '#bf9366';
  c.fillRect(0, 0, 512, 128);
  for (let x = 0; x < 512; x += 6) {
    c.fillStyle = x % 12 === 0 ? 'rgba(80,50,24,0.08)' : 'rgba(255,235,205,0.05)';
    c.fillRect(x, 0, 3, 128);
  }
  c.strokeStyle = 'rgba(62,38,18,0.26)';
  c.lineWidth = 4;
  c.strokeRect(2, 2, 508, 124);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export interface PriceRailShippingBoxOptions {
  id: string;
  position: [number, number, number];
  rotationY?: number;
  initialCount?: number;
  locationLabel: string;
}

/**
 * Builds an ultra-detailed 1.25m long corrugated cardboard shipping box containing
 * 10 individual translucent plastic shelf price rails ("CARTON LONG — RÉGLETTES x10").
 * Sealed with brown packing tape; sliced open with the Cutter to fold all 4 flaps 115° outward.
 */
export function buildPriceRailShippingBox(
  ctx: WorldBuildContext,
  parent: THREE.Object3D,
  tools: PlayerToolController,
  opts: PriceRailShippingBoxOptions
): THREE.Group {
  const boxGroup = new THREE.Group();
  boxGroup.position.set(opts.position[0], opts.position[1], opts.position[2]);
  if (opts.rotationY) boxGroup.rotation.y = opts.rotationY;
  parent.add(boxGroup);

  const L = 1.25; // 1.25 m long narrow shipping box
  const W = 0.25; // 0.25 m wide
  const H = 0.20; // 0.20 m tall
  const T = 0.011; // Realistic corrugated cardboard wall thickness

  const outerSideTex = createCorrugatedOuterTexture(ctx.maxAnisotropy);
  const innerTex = createCorrugatedInnerTexture(ctx.maxAnisotropy);
  const plainKraftTex = createCorrugatedPlainTexture(ctx.maxAnisotropy);

  const outerSideMat = new THREE.MeshStandardMaterial({
    map: outerSideTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const plainKraftMat = new THREE.MeshStandardMaterial({
    map: plainKraftTex,
    roughness: 0.88,
    metalness: 0.02,
  });
  const innerKraftMat = new THREE.MeshStandardMaterial({
    map: innerTex,
    roughness: 0.92,
    metalness: 0.01,
  });
  const edgeFluteMat = new THREE.MeshStandardMaterial({
    color: 0x8c643e,
    roughness: 0.94,
  });
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0x9e6b38,
    roughness: 0.32,
    metalness: 0.04,
  });

  // Translucent plastic rail stack materials inside box
  const railStripBackMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.42,
    metalness: 0.05,
  });
  const railStripClearMat = new THREE.MeshStandardMaterial({
    color: 0xd9f2ff,
    transparent: true,
    opacity: 0.46,
    roughness: 0.14,
    metalness: 0.12,
    depthWrite: false,
  });
  const railStripLipMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.34,
    metalness: 0.2,
  });

  ctx.disposables.push(
    outerSideTex,
    innerTex,
    plainKraftTex,
    outerSideMat,
    plainKraftMat,
    innerKraftMat,
    edgeFluteMat,
    tapeMat,
    railStripBackMat,
    railStripClearMat,
    railStripLipMat
  );

  // --- 1. HOLLOW 5-PANEL CORRUGATED BOX SHELL (OUTER GRAPHICS + INNER CORRUGATED WALLS) ---
  const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(L, T, W), [
    edgeFluteMat,
    edgeFluteMat,
    innerKraftMat,
    plainKraftMat,
    edgeFluteMat,
    edgeFluteMat,
  ]);
  floorMesh.position.set(0, T / 2, 0);
  floorMesh.receiveShadow = true;

  const frontWallGeo = new THREE.BoxGeometry(L, H, T);
  const frontWall = new THREE.Mesh(frontWallGeo, [
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
    outerSideMat, // +Z outer
    innerKraftMat, // -Z inner
  ]);
  frontWall.position.set(0, H / 2, W / 2 - T / 2);
  frontWall.castShadow = true;
  frontWall.receiveShadow = true;

  const backWall = new THREE.Mesh(frontWallGeo, [
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
    innerKraftMat, // +Z inner
    outerSideMat, // -Z outer
  ]);
  backWall.position.set(0, H / 2, -W / 2 + T / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;

  const endWallGeo = new THREE.BoxGeometry(T, H, W - T * 2);
  const leftEndWall = new THREE.Mesh(endWallGeo, [
    innerKraftMat, // +X inner
    plainKraftMat, // -X outer
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
  ]);
  leftEndWall.position.set(-L / 2 + T / 2, H / 2, 0);
  leftEndWall.castShadow = true;

  const rightEndWall = new THREE.Mesh(endWallGeo, [
    plainKraftMat, // +X outer
    innerKraftMat, // -X inner
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
    edgeFluteMat,
  ]);
  rightEndWall.position.set(L / 2 - T / 2, H / 2, 0);
  rightEndWall.castShadow = true;

  boxGroup.add(floorMesh, frontWall, backWall, leftEndWall, rightEndWall);
  ctx.disposables.push(floorMesh.geometry, frontWallGeo, endWallGeo);

  // --- 2. FOUR DISTINCT ARTICULATED 3D CARDBOARD FLAPS (2 LONG SIDE + 2 SHORT END) ---
  const flapThick = 0.008;

  // 2 Short End Flaps (hinged along X = ±L/2, lie just under the long flaps when closed)
  const shortFlapLen = 0.115;
  const shortFlapGeo = new THREE.BoxGeometry(shortFlapLen, flapThick, W - T * 2.2);
  const shortFlapMats = [
    edgeFluteMat,
    edgeFluteMat,
    plainKraftMat,
    innerKraftMat,
    edgeFluteMat,
    edgeFluteMat,
  ];

  const flapEndL = new THREE.Group();
  flapEndL.position.set(-L / 2 + T * 0.6, H - 0.003, 0);
  const flapEndLMesh = new THREE.Mesh(shortFlapGeo, shortFlapMats);
  flapEndLMesh.position.set(shortFlapLen / 2, flapThick / 2, 0);
  flapEndL.add(flapEndLMesh);

  const flapEndR = new THREE.Group();
  flapEndR.position.set(L / 2 - T * 0.6, H - 0.003, 0);
  const flapEndRMesh = new THREE.Mesh(shortFlapGeo, shortFlapMats);
  flapEndRMesh.position.set(-shortFlapLen / 2, flapThick / 2, 0);
  flapEndR.add(flapEndRMesh);

  // 2 Long Side Flaps (hinged along Z = ±W/2, meet tightly at Z = 0 under the packing tape)
  const longFlapDepth = W / 2 - 0.004;
  const longFlapGeo = new THREE.BoxGeometry(L - 0.006, flapThick, longFlapDepth);
  const longFlapMats = [
    edgeFluteMat,
    edgeFluteMat,
    plainKraftMat,
    innerKraftMat,
    edgeFluteMat,
    edgeFluteMat,
  ];

  const flapSideFront = new THREE.Group();
  flapSideFront.position.set(0, H + 0.004, W / 2 - T * 0.5);
  const flapSideFrontMesh = new THREE.Mesh(longFlapGeo, longFlapMats);
  flapSideFrontMesh.position.set(0, flapThick / 2, -longFlapDepth / 2);
  flapSideFront.add(flapSideFrontMesh);

  const flapSideBack = new THREE.Group();
  flapSideBack.position.set(0, H + 0.004, -W / 2 + T * 0.5);
  const flapSideBackMesh = new THREE.Mesh(longFlapGeo, longFlapMats);
  flapSideBackMesh.position.set(0, flapThick / 2, longFlapDepth / 2);
  flapSideBack.add(flapSideBackMesh);

  boxGroup.add(flapEndL, flapEndR, flapSideFront, flapSideBack);
  ctx.disposables.push(shortFlapGeo, longFlapGeo);

  // --- 3. BROWN PACKING TAPE STRIP ALONG THE 1.25M TOP SEAM + END TABS ---
  const tapeTop = new THREE.Mesh(new THREE.BoxGeometry(L + 0.004, 0.003, 0.056), tapeMat);
  tapeTop.position.set(0, H + 0.014, 0);

  // Cut tape stubs wrapped 4.5cm down the short end walls (stay glued after cutter slices top seam!)
  const tapeStubGeo = new THREE.BoxGeometry(0.003, 0.055, 0.056);
  const tapeStubL = new THREE.Mesh(tapeStubGeo, tapeMat);
  tapeStubL.position.set(-L / 2 - 0.001, H - 0.018, 0);
  const tapeStubR = new THREE.Mesh(tapeStubGeo, tapeMat);
  tapeStubR.position.set(L / 2 + 0.001, H - 0.018, 0);

  boxGroup.add(tapeTop, tapeStubL, tapeStubR);
  ctx.disposables.push(tapeTop.geometry, tapeStubGeo);

  // --- 4. NEAT STACK OF 10 INDIVIDUAL TRANSLUCENT PLASTIC PRICE RAILS INSIDE BOX ---
  const totalCount = opts.initialCount ?? 10;
  let remainingRails = totalCount;

  const railLength = 1.18;
  const rBackGeo = new THREE.BoxGeometry(railLength, 0.005, 0.048);
  const rClearGeo = new THREE.BoxGeometry(railLength, 0.003, 0.046);
  const rLipGeo = new THREE.BoxGeometry(railLength, 0.012, 0.005);
  ctx.disposables.push(rBackGeo, rClearGeo, rLipGeo);

  const railVisualGroups: THREE.Group[] = [];
  // Stack 2 neat side-by-side columns × 5 layers high inside the 0.25m × 0.20m hollow cavity
  for (let i = 0; i < totalCount; i++) {
    const col = i % 2; // 0 or 1
    const layer = Math.floor(i / 2); // 0..4
    const rGrp = new THREE.Group();
    const rz = col === 0 ? -0.052 : 0.052;
    const ry = T + 0.012 + layer * 0.026;
    rGrp.position.set(0, ry, rz);

    const rb = new THREE.Mesh(rBackGeo, railStripBackMat);
    const rc = new THREE.Mesh(rClearGeo, railStripClearMat);
    rc.position.y = 0.009;
    const rl1 = new THREE.Mesh(rLipGeo, railStripLipMat);
    rl1.position.set(0, 0.005, -0.022);
    const rl2 = new THREE.Mesh(rLipGeo, railStripLipMat);
    rl2.position.set(0, 0.005, 0.022);

    rGrp.add(rb, rc, rl1, rl2);
    boxGroup.add(rGrp);
    railVisualGroups.push(rGrp);
  }

  const syncRailStackVisibility = () => {
    for (let i = 0; i < railVisualGroups.length; i++) {
      railVisualGroups[i].visible = i < remainingRails;
    }
  };
  syncRailStackVisibility();

  // --- 5. STATE, SMOOTH 115° FLAP ANIMATION & GENEROUS INTERACTION HITBOX ---
  let opened = false;
  let openAnim = 0;
  let lastTapTime = 0;

  ctx.updaters.push({
    update: (dt) => {
      const target = opened ? 1 : 0;
      if (Math.abs(openAnim - target) > 0.002) {
        openAnim = THREE.MathUtils.damp(openAnim, target, 8.5, dt);
        // Long side flaps open first, short end flaps follow slightly behind for crisp physical feel
        const longProgress = THREE.MathUtils.clamp(openAnim * 1.12, 0, 1);
        const endProgress = THREE.MathUtils.clamp((openAnim - 0.14) / 0.86, 0, 1);

        flapSideFront.rotation.x = longProgress * FLAP_OPEN_RAD;
        flapSideBack.rotation.x = -longProgress * FLAP_OPEN_RAD;
        flapEndL.rotation.z = endProgress * FLAP_OPEN_RAD;
        flapEndR.rotation.z = -endProgress * FLAP_OPEN_RAD;
      }
    },
  });

  const hitGeo = new THREE.BoxGeometry(L + 0.12, H + 0.18, W + 0.18);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(hitGeo, hitMat);
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.position.set(0, H * 0.56, 0);
  hitMesh.layers.set(INTERACT_LAYER);
  boxGroup.add(hitMesh);

  const item: InteractableItem = {
    id: opts.id,
    title: 'Carton Long — Réglettes Porte-Étiquettes ×10',
    subtitle: `${opts.locationLabel} · Réglettes Plastique 120 cm`,
    kind: 'diegetic_action',
    state: false,
    inspectText:
      'Carton d’expédition long (125 cm) contenant 10 réglettes porte-étiquettes en plastique transparent extrudé.',
    proxyMesh: hitMesh,
    dynamicTitle: () =>
      opened
        ? `Carton Ouvert — Réglettes Plastique (${remainingRails}/${totalCount})`
        : 'Carton Long Scellé — Réglettes Plastique ×10',
    dynamicSubtitle: () => {
      if (!opened) {
        return tools.getActiveTool() === 'cutter'
          ? 'Ruban adhésif intact — Tranchez la bande centrale au Cutter'
          : 'Scellé par ruban adhésif — Équipez le Cutter (Roue Outils)';
      }
      if (remainingRails === 0) {
        return 'Carton vide — Toutes les réglettes plastique ont été retirées';
      }
      if (tools.getHeldItem()?.kind === 'plastic_price_rail') {
        return 'Vous tenez déjà 1 réglette — Clipsez-la d’abord sur un bord de rayon nu';
      }
      return `Réglettes plastique transparentes 120 cm · ${remainingRails}/${totalCount} restantes`;
    },
    dynamicVerb: () => {
      if (!opened) {
        return tools.getActiveTool() === 'cutter'
          ? 'OUVRIR AU CUTTER'
          : 'SCELLÉ (ÉQUIPER LE CUTTER)';
      }
      if (remainingRails === 0) {
        return 'CARTON VIDE (0/10)';
      }
      if (tools.getActiveTool() !== 'hands') {
        return `PRENDRE RÉGLETTE (CHOISIR MAINS VIDES · ${remainingRails}/10)`;
      }
      if (tools.getHeldItem()) {
        return tools.getHeldItem()?.kind === 'plastic_price_rail'
          ? '1 RÉGLETTE EN MAIN (CLIPSER SUR RAYON)'
          : 'MAINS OCCUPÉES (POSER ARTICLE D’ABORD)';
      }
      return 'PRENDRE UNE RÉGLETTE PLASTIQUE';
    },
    onInteract: () => {
      const now = performance.now();
      if (now - lastTapTime < RAIL_BOX_COOLDOWN_MS) return;
      lastTapTime = now;

      if (!opened) {
        if (tools.getActiveTool() === 'cutter') {
          opened = true;
          tapeTop.visible = false;
          tools.triggerCutterSlash();
        } else {
          soundSynth.playAtmPiezo('error');
        }
        return;
      }

      if (remainingRails <= 0) {
        soundSynth.playAtmPiezo('error');
        return;
      }

      // Strictly requires Mains Vides & empty hands so the player carries strictly ONE rail at a time
      if (tools.getActiveTool() !== 'hands' || tools.getHeldItem() !== null) {
        soundSynth.playAtmPiezo('error');
        return;
      }

      remainingRails -= 1;
      syncRailStackVisibility();
      tools.pickUpItem({
        kind: 'plastic_price_rail',
        label: 'Réglette Plastique 120 cm',
        sublabel: 'À clipser sur le bord métal nu du rayon',
      });
      soundSynth.playPlasticRailPickup();
    },
  };

  hitMesh.userData.interactable = item;
  ctx.interactables.push(item);

  return boxGroup;
}
