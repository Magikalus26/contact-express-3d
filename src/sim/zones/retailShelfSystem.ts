import * as THREE from 'three';
import { MaterialLibrary } from '../materials';
import { INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { HeldItemHudInfo, InteractableItem, WorldBuildContext } from '../types';
import { drawPriceTagCanvas, PlayerToolController } from '../playerTools';
import { getProductByEan, parseFrancPriceToCents } from '../productCatalog';

const SHELF_ACTION_COOLDOWN_MS = 320;

export interface BareShelfRailsConfig {
  idPrefix: string;
  shelfYs: number[];
  shelfNames: string[];
  shelfWidth: number;
  shelfDepth: number;
  /** Per tier: [left4SlotXs, right4SlotXs] */
  tierSlotXs: Array<[number[], number[]]>;
  /** Expected official catalog EAN(s) for each (tierIdx, sideKey, subIdx) */
  expectedSlotEans: (tierIdx: number, sideKey: 'L' | 'R', subIdx: number) => string[];
  /** Optional custom shelf deck material (defaults to mats.whiteMetal) */
  deckMaterial?: THREE.Material;
  /** Optional bare front lip color hex (defaults to 0xdbe2ea painted steel) */
  bareLipColor?: number;
  /** Optional single full-width rail segment instead of split Left/Right 120cm rails (for freezers/cabinets) */
  singleSegment?: boolean;
  /** Optional skip solid metal deck box when custom wire racks or chest freezers supply the deck */
  skipDeckMesh?: boolean;
  /** Optional custom deck center Z (defaults to 0.29) */
  deckCenterZ?: number;
}

interface PriceRailSlotState {
  category: string;
  priceText: string;
  ean: string;
  verified: boolean;
  expectedEans: string[];
  hasLabel: boolean;
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  tex: THREE.CanvasTexture;
  slideAnim: number;
  baseX: number;
}

interface PriceRailSegmentState {
  installed: boolean;
  railGroup: THREE.Group;
  previewMesh: THREE.Mesh;
  previewMat: THREE.MeshStandardMaterial;
  hoverTimer: number;
  snapAnim: number;
  targetZ: number;
}

export interface MultiDepthVariantSpec {
  kind: HeldItemHudInfo['kind'];
  ean: string;
  label: string;
  sublabel: string;
  buildMesh: () => THREE.Object3D;
}

export interface MultiDepthColumnConfig {
  id: string;
  tierName: string;
  x: number;
  y: number;
  /** Z of shelf front lip (typically 0.54) */
  shelfFrontZ: number;
  /** Z of shelf back wall (typically 0.05) */
  shelfBackZ: number;
  colWidth: number;
  itemHeight: number;
  itemDepth: number;
  depthCount: number; // 3 or 4 back-to-front slots
  variants: MultiDepthVariantSpec[];
  /** Length = depthCount, index 0 = deepest back (Fond), index depthCount-1 = front lip (Façade) */
  initialSlots: Array<HeldItemHudInfo['kind'] | null>;
  /** Optional tactile sound on placement/pickup */
  placementSound?: 'bag' | 'glass' | 'foil' | 'tin' | 'frozen' | 'produce' | 'dairy' | 'game' | 'can' | 'hot_snack';
  /** Optional X-axis cradle tilt in radians for angled wine racks or sloped produce bins */
  slotTiltX?: number;
  /** Optional vertical Y rise per meter toward back (-Z) for sloped wooden produce bins */
  slopeRisePerZ?: number;
}

export interface SrpPavLaneConfig {
  id: string;
  x: number;
  y: number;
  trayKind: HeldItemHudInfo['kind'];
  unitKind: HeldItemHudInfo['kind'];
  trayLabel: string;
  unitLabel: string;
  ean: string;
  trayWidth: number;
  trayDepth: number;
  trayHeight: number;
  maxUnits: number;
  initialHasTray: boolean;
  initialFlapCut: boolean;
  initialUnits: number;
  accentColor: number;
  frontMat: THREE.Material;
  buildUnitMesh: (idx: number) => THREE.Object3D;
}

export interface ShelfHelperHandle {
  addHitbox: (
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
      onHoverUv?: (uv: THREE.Vector2) => void;
      onInteract: () => void;
    }
  ) => THREE.Mesh;
  acquireLock: () => boolean;
  clearPlasticRailMat: THREE.MeshStandardMaterial;
}

/**
 * Standardized bare 3-tier retail shelves with manual clip-on 120cm transparent plastic rails
 * and 4 side-by-side visible paper price labels per rail (using the verified +0.008m / +0.011m Z-offset).
 */
export function buildBareShelfWithInstallableRails(
  ctx: WorldBuildContext,
  faceGroup: THREE.Group,
  mats: MaterialLibrary,
  tools: PlayerToolController,
  cfg: BareShelfRailsConfig
): ShelfHelperHandle {
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyMat);

  let lastActionTime = 0;
  const acquireLock = (): boolean => {
    const now = performance.now();
    if (now - lastActionTime < SHELF_ACTION_COOLDOWN_MS) return false;
    lastActionTime = now;
    return true;
  };

  const addHitbox: ShelfHelperHandle['addHitbox'] = (parent, opts) => {
    const geo = new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
    ctx.disposables.push(geo);
    const proxy = new THREE.Mesh(geo, proxyMat);
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
      onHoverUv: opts.onHoverUv,
      onInteract: opts.onInteract,
    };
    proxy.userData.interactable = item;
    ctx.interactables.push(item);
    return proxy;
  };

  const bareMetalLipMat = new THREE.MeshStandardMaterial({
    color: cfg.bareLipColor ?? 0xdbe2ea,
    roughness: 0.42,
    metalness: cfg.bareLipColor ? 0.18 : 0.48,
  });
  const railBackMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.45,
    metalness: 0.05,
  });
  const clearPlasticRailMat = new THREE.MeshStandardMaterial({
    color: 0xe2f4ff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.12,
    depthWrite: false,
  });
  const railLipMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.25,
  });
  ctx.disposables.push(bareMetalLipMat, railBackMat, clearPlasticRailMat, railLipMat);

  const railSegments: PriceRailSegmentState[] = [];
  const railSlots: PriceRailSlotState[] = [];
  const segLen = cfg.singleSegment ? Math.max(0.6, cfg.shelfWidth - 0.06) : 1.24;
  const deckCenterZ = cfg.deckCenterZ ?? 0.29;
  const shelfFrontZ = deckCenterZ + cfg.shelfDepth / 2; // 0.54 when deckCenterZ = 0.29, shelfDepth = 0.50

  const segBackGeo = new THREE.BoxGeometry(segLen, 0.048, 0.004);
  const segLipGeo = new THREE.BoxGeometry(segLen, 0.0045, 0.012);
  const segClearGeo = new THREE.PlaneGeometry(segLen, 0.044);
  const segPreviewGeo = new THREE.BoxGeometry(segLen, 0.052, 0.016);
  ctx.disposables.push(segBackGeo, segLipGeo, segClearGeo, segPreviewGeo);

  cfg.shelfYs.forEach((sy, sIdx) => {
    if (!cfg.skipDeckMesh) {
      const deckH = sIdx > 0 ? 0.032 : 0.02;
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(cfg.shelfWidth, deckH, cfg.shelfDepth),
        cfg.deckMaterial ?? mats.whiteMetal
      );
      deck.position.set(0, sy - deckH / 2, deckCenterZ);
      deck.receiveShadow = true;
      faceGroup.add(deck);
      ctx.disposables.push(deck.geometry);
    }

    const railY = sy - 0.014;
    const bareMetalLip = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.shelfWidth, 0.036, 0.004),
      bareMetalLipMat
    );
    bareMetalLip.position.set(0, railY, shelfFrontZ + 0.001);
    faceGroup.add(bareMetalLip);
    ctx.disposables.push(bareMetalLip.geometry);

    const segDefs: Array<{
      sideKey: 'L' | 'R';
      sideLabel: string;
      centerX: number;
      slotXs: number[];
    }> = cfg.singleSegment
      ? [{ sideKey: 'L', sideLabel: 'Façade', centerX: 0, slotXs: cfg.tierSlotXs[sIdx][0] }]
      : [
          { sideKey: 'L', sideLabel: 'Gauche', centerX: -0.635, slotXs: cfg.tierSlotXs[sIdx][0] },
          { sideKey: 'R', sideLabel: 'Droite', centerX: 0.635, slotXs: cfg.tierSlotXs[sIdx][1] },
        ];

    segDefs.forEach((segDef) => {
      const railGroup = new THREE.Group();
      railGroup.position.set(segDef.centerX, railY, shelfFrontZ);
      railGroup.visible = false;
      faceGroup.add(railGroup);

      const railBack = new THREE.Mesh(segBackGeo, railBackMat);
      railBack.position.set(0, 0, 0.004);
      const railTopLip = new THREE.Mesh(segLipGeo, railLipMat);
      railTopLip.position.set(0, 0.023, 0.007);
      const railBotLip = new THREE.Mesh(segLipGeo, railLipMat);
      railBotLip.position.set(0, -0.023, 0.007);
      const railClearFront = new THREE.Mesh(segClearGeo, clearPlasticRailMat);
      railClearFront.position.set(0, 0, 0.011);
      railClearFront.renderOrder = 4;
      railGroup.add(railBack, railTopLip, railBotLip, railClearFront);

      const previewMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.0,
        roughness: 0.25,
        depthWrite: false,
      });
      ctx.disposables.push(previewMat);
      const previewMesh = new THREE.Mesh(segPreviewGeo, previewMat);
      previewMesh.position.set(segDef.centerX, railY, shelfFrontZ + 0.008);
      previewMesh.visible = false;
      faceGroup.add(previewMesh);

      const segState: PriceRailSegmentState = {
        installed: false,
        railGroup,
        previewMesh,
        previewMat,
        hoverTimer: 0,
        snapAnim: 0,
        targetZ: shelfFrontZ,
      };
      railSegments.push(segState);

      addHitbox(faceGroup, {
        id: `${cfg.idPrefix}_bare_edge_${sIdx}_${segDef.sideKey}`,
        size: [segLen, 0.12, 0.11],
        pos: [segDef.centerX, railY, shelfFrontZ + 0.02],
        title: `Bord Métal Nu — ${cfg.shelfNames[sIdx]} (${segDef.sideLabel})`,
        subtitle: 'Aucune réglette plastique installée — Étiquetage verrouillé',
        isVisible: () => {
          if (segState.installed) return false;
          const held = tools.getHeldItem();
          if (tools.getActiveTool() === 'hands' && held && isPlaceableOnShelf(held.kind)) {
            return false;
          }
          return true;
        },
        onHoverUv: () => {
          segState.hoverTimer = 0.16;
        },
        dynamicSubtitle: () => {
          const held = tools.getHeldItem();
          if (tools.getActiveTool() === 'hands' && held?.kind === 'plastic_price_rail') {
            return 'Réglette 120 cm alignée — Appuyez pour clipser sur le rebord métal';
          }
          if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
            return 'Impossible de glisser une étiquette sans réglette plastique !';
          }
          return 'Commandez un carton de réglettes (Terminal Commande 1990) puis clipsez-les ici';
        },
        verb: () => {
          const held = tools.getHeldItem();
          if (tools.getActiveTool() === 'hands' && held?.kind === 'plastic_price_rail') {
            return 'CLIPSER LA RÉGLETTE SUR LE RAYON';
          }
          if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
            return "RÉGLETTE REQUISE D'ABORD";
          }
          return 'BORD MÉTAL NU (CLIPSER RÉGLETTE)';
        },
        onInteract: () => {
          if (!acquireLock()) return;
          const held = tools.getHeldItem();
          if (tools.getActiveTool() === 'hands' && held?.kind === 'plastic_price_rail') {
            segState.installed = true;
            segState.railGroup.visible = true;
            segState.previewMesh.visible = false;
            segState.snapAnim = 1.0;
            segState.railGroup.position.z = shelfFrontZ + 0.045;
            tools.consumeHeldItem();
            soundSynth.playPlasticRailSnap();
          } else {
            soundSynth.playAtmPiezo('error');
          }
        },
      });

      segDef.slotXs.forEach((lx, subIdx) => {
        const tagCanvas = document.createElement('canvas');
        tagCanvas.width = 512;
        tagCanvas.height = 144;
        const tagTex = new THREE.CanvasTexture(tagCanvas);
        tagTex.colorSpace = THREE.SRGBColorSpace;
        tagTex.anisotropy = ctx.maxAnisotropy;
        const tagMat = new THREE.MeshStandardMaterial({
          map: tagTex,
          emissive: 0xffffff,
          emissiveMap: tagTex,
          emissiveIntensity: 0.14,
          roughness: 0.55,
          metalness: 0.0,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        });
        const tagMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.036), tagMat);
        tagMesh.position.set(lx, railY, shelfFrontZ + 0.008);
        tagMesh.renderOrder = 2;
        tagMesh.visible = false;
        faceGroup.add(tagMesh);
        ctx.disposables.push(tagTex, tagMat, tagMesh.geometry);

        const expectedEans = cfg.expectedSlotEans(sIdx, segDef.sideKey, subIdx);
        const slotState: PriceRailSlotState = {
          category: '',
          priceText: '',
          ean: expectedEans[0],
          verified: false,
          expectedEans,
          hasLabel: false,
          mesh: tagMesh,
          canvas: tagCanvas,
          tex: tagTex,
          slideAnim: 0,
          baseX: lx,
        };
        railSlots.push(slotState);

        addHitbox(faceGroup, {
          id: `${cfg.idPrefix}_price_rail_${sIdx}_${segDef.sideKey}_${subIdx}`,
          size: [0.27, 0.095, 0.085],
          pos: [lx, railY, shelfFrontZ + 0.018],
          title: `Réglette Plastique — ${cfg.shelfNames[sIdx]} (${segDef.sideLabel} #${subIdx + 1})`,
          subtitle: 'Porte-étiquettes transparent clipsé sur le rayon',
          isVisible: () => {
            if (!segState.installed) return false;
            const held = tools.getHeldItem();
            if (tools.getActiveTool() === 'hands' && held && isPlaceableOnShelf(held.kind)) {
              return false;
            }
            return true;
          },
          verb: () => {
            const held = tools.getHeldItem();
            if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
              return "GLISSER L'ÉTIQUETTE DANS LA RÉGLETTE";
            }
            if (slotState.hasLabel) {
              return slotState.verified
                ? `ÉTIQUETTE CONFORME : ${slotState.priceText}`
                : `LIRE PRIX : ${slotState.priceText}`;
            }
            return 'RÉGLETTE VIDE (IMPRIMER ÉTIQUETTE)';
          },
          dynamicSubtitle: () => {
            if (slotState.hasLabel) {
              return slotState.verified
                ? `✓ ÉTIQUETTE CONFORME : ${slotState.priceText} · ${slotState.category}`
                : `${slotState.category} — ${slotState.priceText} (EAN ${slotState.ean})`;
            }
            const refProd = getProductByEan(slotState.expectedEans[0]);
            return refProd
              ? `Emplacement prévu : ${refProd.name} (Scannez pour obtenir le tarif)`
              : "Imprimez un prix sur l'Étiqueteuse 3D 1990 pour le glisser ici";
          },
          onInteract: () => {
            if (!acquireLock()) return;
            if (!segState.installed) {
              soundSynth.playAtmPiezo('error');
              return;
            }
            const held = tools.getHeldItem();
            if (tools.getActiveTool() === 'hands' && held?.kind === 'price_label') {
              const prodLabel = held.productName ?? held.category ?? 'ARTICLE';
              const price = held.priceText ?? '19,50 ₣';
              const ean = held.ean ?? slotState.expectedEans[0];
              const printedCents = parseFrancPriceToCents(price);

              const matchesExpectedSlot = slotState.expectedEans.some((expEan) => {
                const prod = getProductByEan(expEan);
                return prod && printedCents !== null && prod.priceCents === printedCents;
              });
              const scannedProd = getProductByEan(ean);
              const matchesOwnCatalogPrice =
                Boolean(scannedProd) &&
                printedCents !== null &&
                scannedProd!.priceCents === printedCents;
              const isVerified = matchesExpectedSlot || matchesOwnCatalogPrice;

              slotState.category = prodLabel;
              slotState.priceText = price;
              slotState.ean = ean;
              slotState.verified = isVerified;
              slotState.hasLabel = true;
              drawPriceTagCanvas(slotState.canvas, prodLabel, price, ean, isVerified);
              slotState.tex.needsUpdate = true;
              slotState.mesh.visible = true;
              slotState.slideAnim = 1.0;
              tools.consumeHeldItem();
              soundSynth.playPlasticSlide();
              if (isVerified) {
                soundSynth.playLabelMatchChime();
              }
            } else {
              soundSynth.playUiTone(false);
            }
          },
        });
      });
    });
  });

  ctx.updaters.push({
    update: (dt) => {
      const holdingRail =
        tools.getActiveTool() === 'hands' && tools.getHeldItem()?.kind === 'plastic_price_rail';

      for (let i = 0; i < railSegments.length; i++) {
        const seg = railSegments[i];
        if (!seg.installed) {
          if (seg.hoverTimer > 0) {
            seg.hoverTimer = Math.max(0, seg.hoverTimer - dt);
          }
          seg.previewMesh.visible = holdingRail;
          if (holdingRail) {
            const targetOp = seg.hoverTimer > 0 ? 0.56 : 0.16;
            const targetEm = seg.hoverTimer > 0 ? 0.62 : 0.18;
            seg.previewMat.opacity = THREE.MathUtils.damp(seg.previewMat.opacity, targetOp, 14, dt);
            seg.previewMat.emissiveIntensity = THREE.MathUtils.damp(
              seg.previewMat.emissiveIntensity,
              targetEm,
              14,
              dt
            );
          } else {
            seg.previewMat.opacity = 0;
          }
        } else if (seg.snapAnim > 0) {
          seg.snapAnim = Math.max(0, seg.snapAnim - dt * 7.5);
          if (seg.snapAnim === 0) {
            seg.railGroup.position.z = seg.targetZ;
          } else {
            seg.railGroup.position.z = THREE.MathUtils.damp(
              seg.railGroup.position.z,
              seg.targetZ,
              18,
              dt
            );
          }
        }
      }

      for (let i = 0; i < railSlots.length; i++) {
        const rs = railSlots[i];
        if (rs.slideAnim > 0) {
          rs.slideAnim = Math.max(0, rs.slideAnim - dt * 4.5);
          rs.mesh.position.x = rs.baseX - rs.slideAnim * 0.11;
        }
      }
    },
  });

  return { addHitbox, acquireLock, clearPlasticRailMat };
}

// ============================================================================
// V20 GLOBAL PRODUCT REGISTRY & FREE-ANYWHERE SHELF PLACEMENT / PICKUP ENGINE
// ============================================================================
type PlacementSoundKind = NonNullable<MultiDepthColumnConfig['placementSound']>;

interface RegisteredProductSpec {
  kind: HeldItemHudInfo['kind'];
  ean: string;
  label: string;
  sublabel: string;
  buildMesh: () => THREE.Object3D;
  placementSound?: PlacementSoundKind;
}

interface GlobalShelfProductRegistry {
  sharedUnitBoxGeo: THREE.BoxGeometry;
  sharedProxyMat: THREE.MeshBasicMaterial;
  variants: Map<HeldItemHudInfo['kind'], RegisteredProductSpec>;
  pavConfigs: Map<HeldItemHudInfo['kind'], SrpPavLaneConfig>;
  fallbackMaterials: Map<string, THREE.MeshStandardMaterial>;
}

const _shelfRegistryByCtx = new WeakMap<WorldBuildContext, GlobalShelfProductRegistry>();
const _fitBox = new THREE.Box3();
const _fitSize = new THREE.Vector3();
const _fitCenter = new THREE.Vector3();

function getShelfRegistry(ctx: WorldBuildContext): GlobalShelfProductRegistry {
  let reg = _shelfRegistryByCtx.get(ctx);
  if (!reg) {
    const sharedUnitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
    const sharedProxyMat = new THREE.MeshBasicMaterial({ visible: false });
    ctx.disposables.push(sharedUnitBoxGeo, sharedProxyMat);
    reg = {
      sharedUnitBoxGeo,
      sharedProxyMat,
      variants: new Map(),
      pavConfigs: new Map(),
      fallbackMaterials: new Map(),
    };
    _shelfRegistryByCtx.set(ctx, reg);
  }
  return reg;
}

function isPlaceableOnShelf(kind: HeldItemHudInfo['kind']): boolean {
  return (
    kind !== 'price_label' &&
    kind !== 'plastic_price_rail' &&
    kind !== 'shipping_carton' &&
    kind !== 'empty_carton'
  );
}

function playPlacementAudio(sound?: PlacementSoundKind, isSlide = false): void {
  if (sound === 'glass') {
    soundSynth.playGlassBottleClink(false);
  } else if (sound === 'foil') {
    soundSynth.playFoilSnackRustle(false);
  } else if (sound === 'tin') {
    soundSynth.playTinCanClink(false);
  } else if (sound === 'frozen') {
    soundSynth.playFrozenPackFrost(false);
  } else if (sound === 'produce') {
    soundSynth.playWoodenCrateRustle(false);
  } else if (sound === 'dairy') {
    soundSynth.playDairyChillPlace(false);
  } else if (sound === 'game') {
    soundSynth.playGameBoxClack(false);
  } else if (sound === 'can') {
    soundSynth.playSodaCanClink(false);
  } else if (sound === 'hot_snack') {
    soundSynth.playHotSnackPlace();
  } else if (isSlide) {
    soundSynth.playPlasticSlide();
  } else {
    soundSynth.playBagThump();
  }
}

function getFallbackMat(
  ctx: WorldBuildContext,
  reg: GlobalShelfProductRegistry,
  hex: number,
  roughness = 0.58
): THREE.MeshStandardMaterial {
  const key = `${hex}_${roughness}`;
  let m = reg.fallbackMaterials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: hex, roughness, metalness: 0.06 });
    ctx.disposables.push(m);
    reg.fallbackMaterials.set(key, m);
  }
  return m;
}

/**
 * Builds a clean, grounded procedural 3D mesh for any non-shelf-registered held item
 * (e.g., raw bakery dough, butcher primal cuts, coffee bags, cup sleeves, pet toys)
 * so literally any carryable article in the store can be placed onto any shelf slot.
 */
function buildFallbackProductMesh(
  ctx: WorldBuildContext,
  reg: GlobalShelfProductRegistry,
  kind: HeldItemHudInfo['kind']
): THREE.Object3D {
  const g = new THREE.Group();
  const makeBox = (w: number, h: number, d: number, color: number, y: number, rough = 0.6) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    ctx.disposables.push(geo);
    const mesh = new THREE.Mesh(geo, getFallbackMat(ctx, reg, color, rough));
    mesh.position.y = y;
    g.add(mesh);
    return mesh;
  };
  const makeCyl = (rt: number, rb: number, h: number, color: number, y: number, rough = 0.5) => {
    const geo = new THREE.CylinderGeometry(rt, rb, h, 14);
    ctx.disposables.push(geo);
    const mesh = new THREE.Mesh(geo, getFallbackMat(ctx, reg, color, rough));
    mesh.position.y = y;
    g.add(mesh);
    return mesh;
  };

  if (kind === 'toy_tennis' || kind === 'toy_squeaky' || kind === 'toy_cat_bell') {
    const col = kind === 'toy_tennis' ? 0xd9f99d : kind === 'toy_squeaky' ? 0xfb7185 : 0x38bdf8;
    const r = kind === 'toy_cat_bell' ? 0.036 : 0.044;
    const geo = new THREE.SphereGeometry(r, 14, 12);
    ctx.disposables.push(geo);
    const ball = new THREE.Mesh(geo, getFallbackMat(ctx, reg, col, 0.52));
    ball.position.y = r;
    g.add(ball);
    return g;
  }

  if (kind === 'cafe_espresso_cup' || kind === 'cafe_paper_cup_empty') {
    makeCyl(0.036, 0.026, 0.092, 0xf8fafc, 0.046, 0.45);
    makeCyl(0.038, 0.038, 0.012, 0x7c2d12, 0.095, 0.4);
    if (kind === 'cafe_espresso_cup') {
      makeCyl(0.032, 0.032, 0.004, 0x3b1f0f, 0.086, 0.25);
    }
    return g;
  }

  if (kind === 'cafe_cup_sleeve') {
    makeCyl(0.038, 0.036, 0.22, 0xf1f5f9, 0.11, 0.5);
    makeCyl(0.04, 0.04, 0.032, 0x78350f, 0.11, 0.55);
    return g;
  }

  if (kind === 'cafe_beans_bag') {
    makeBox(0.11, 0.2, 0.075, 0x451a03, 0.1, 0.65);
    makeBox(0.09, 0.08, 0.078, 0xfef3c7, 0.11, 0.5);
    return g;
  }

  if (kind === 'produce_weighed_bag') {
    makeCyl(0.055, 0.072, 0.14, 0xe2f4ff, 0.07, 0.35);
    makeBox(0.055, 0.035, 0.008, 0xffffff, 0.08, 0.6).position.z = 0.068;
    return g;
  }

  if (
    kind === 'beef_primal' ||
    kind === 'pork_primal' ||
    kind === 'ham_block' ||
    kind === 'beef_platter' ||
    kind === 'pork_platter' ||
    kind === 'ham_sliced_pack'
  ) {
    const meatCol =
      kind.includes('beef') ? 0x991b1b : kind.includes('pork') ? 0xfca5a5 : 0xf472b6;
    makeBox(0.18, 0.02, 0.13, 0xf8fafc, 0.01, 0.4);
    makeBox(0.14, 0.055, 0.095, meatCol, 0.045, 0.52);
    return g;
  }

  if (kind === 'baguette_raw' || kind === 'croissant_raw' || kind === 'pain_choc_raw') {
    makeBox(0.16, 0.055, 0.09, 0xfef3c7, 0.0275, 0.72);
    return g;
  }

  // Generic crisp 1990 retail carton/pack fallback
  makeBox(0.12, 0.15, 0.08, 0xdbeafe, 0.075, 0.52);
  makeBox(0.1, 0.045, 0.084, 0x1d4ed8, 0.09, 0.45);
  return g;
}

/**
 * Builds a self-contained visual SRP/PAV tray mesh for cross-shelf placement onto standard columns.
 */
function buildCompactPavTrayMesh(ctx: WorldBuildContext, cfg: SrpPavLaneConfig): THREE.Object3D {
  const g = new THREE.Group();
  const cbMat = new THREE.MeshStandardMaterial({ color: 0xb68d65, roughness: 0.86 });
  ctx.disposables.push(cbMat);
  const w = cfg.trayWidth;
  const d = Math.min(cfg.trayDepth, 0.24);
  const h = cfg.trayHeight;

  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), cbMat);
  base.position.set(0, 0.006, 0);
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.75, 0.01), cbMat);
  back.position.set(0, h * 0.375, -d / 2 + 0.005);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.01, h * 0.65, d), cbMat);
  sideL.position.set(-w / 2 + 0.005, h * 0.325, 0);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.01, h * 0.65, d), cbMat);
  sideR.position.set(w / 2 - 0.005, h * 0.325, 0);
  const front = new THREE.Mesh(new THREE.BoxGeometry(w, Math.min(0.06, h * 0.55), 0.012), [
    cbMat,
    cbMat,
    cbMat,
    cbMat,
    cfg.frontMat,
    cbMat,
  ]);
  front.position.set(0, Math.min(0.03, h * 0.275), d / 2 - 0.006);

  ctx.disposables.push(base.geometry, back.geometry, sideL.geometry, sideR.geometry, front.geometry);
  g.add(base, back, sideL, sideR, front);

  const sampleUnits = Math.min(3, cfg.maxUnits);
  for (let i = 0; i < sampleUnits; i++) {
    const u = cfg.buildUnitMesh(i);
    u.scale.setScalar(0.82);
    u.position.set((i - (sampleUnits - 1) / 2) * (w * 0.26), 0.012, 0);
    g.add(u);
  }
  return g;
}

/**
 * Normalizes a mesh so it sits flush at y = 0, centered on X/Z, and gently scaled down if
 * it exceeds the target slot bounds (used only for cross-shelf placement from another department).
 */
function wrapAndFitCrossShelfMesh(
  rawMesh: THREE.Object3D,
  maxW: number,
  maxH: number,
  maxD: number
): THREE.Object3D {
  const wrapper = new THREE.Group();
  wrapper.add(rawMesh);
  wrapper.updateMatrixWorld(true);
  _fitBox.setFromObject(rawMesh);
  if (!_fitBox.isEmpty()) {
    _fitBox.getSize(_fitSize);
    _fitBox.getCenter(_fitCenter);
    rawMesh.position.x -= _fitCenter.x;
    rawMesh.position.z -= _fitCenter.z;
    rawMesh.position.y -= _fitBox.min.y;
    const sx = _fitSize.x > maxW ? maxW / _fitSize.x : 1;
    const sy = _fitSize.y > maxH ? maxH / _fitSize.y : 1;
    const sz = _fitSize.z > maxD ? maxD / _fitSize.z : 1;
    const s = Math.min(1, sx, sy, sz);
    if (s < 0.999) {
      wrapper.scale.setScalar(s);
    }
  }
  return wrapper;
}

/**
 * Standardized Multi-Depth Retail Shelf Column (3 or 4 back-to-front depth slots).
 * V20 Free-Anywhere Overhaul:
 * - Aim directly at ANY occupied slot (Fond, Milieu, Façade) to grab it ([PRENDRE L'ARTICLE]).
 * - Hold ANY product or PAV tray and aim at ANY empty depth slot on ANY shelf to place it ([POSER ICI]).
 * - Preserves [FAIRE LE FACING] on the front lip whenever stocked items sit behind an empty front slot.
 */
export function buildMultiDepthColumn(
  ctx: WorldBuildContext,
  faceGroup: THREE.Group,
  helper: ShelfHelperHandle,
  tools: PlayerToolController,
  cfg: MultiDepthColumnConfig
): void {
  const registry = getShelfRegistry(ctx);

  const colGroup = new THREE.Group();
  colGroup.position.set(cfg.x, cfg.y, 0);
  faceGroup.add(colGroup);

  const usableDepth = Math.max(0.14, cfg.shelfFrontZ - cfg.shelfBackZ);
  const minZ = cfg.shelfBackZ + cfg.itemDepth * 0.5 + 0.01;
  const maxZ = cfg.shelfFrontZ - cfg.itemDepth * 0.5 - 0.015;
  const depthZs: number[] = [];
  for (let d = 0; d < cfg.depthCount; d++) {
    const t = cfg.depthCount === 1 ? 1 : d / (cfg.depthCount - 1);
    depthZs.push(THREE.MathUtils.lerp(minZ, maxZ, t));
  }
  const slotStepZ =
    cfg.depthCount > 1
      ? Math.max(0.08, Math.abs(depthZs[1] - depthZs[0]))
      : Math.max(0.12, usableDepth);

  // Subtle column guide strip on shelf deck so depth slots are clearly legible when empty
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0x94a3b8,
    transparent: true,
    opacity: 0.24,
  });
  const markerPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.colWidth * 0.86, Math.max(0.16, usableDepth - 0.04)),
    markerMat
  );
  markerPlane.rotation.x = -Math.PI / 2;
  markerPlane.position.set(0, 0.004, (cfg.shelfBackZ + cfg.shelfFrontZ) * 0.5);
  colGroup.add(markerPlane);
  ctx.disposables.push(markerMat, markerPlane.geometry);

  // One shared cyan translucent hover pad per column (highlights whichever empty depth slot the player aims at)
  const hoverPadMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const hoverPadMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.colWidth * 0.88, Math.max(0.08, slotStepZ * 0.86)),
    hoverPadMat
  );
  hoverPadMesh.rotation.x = -Math.PI / 2;
  hoverPadMesh.visible = false;
  colGroup.add(hoverPadMesh);
  ctx.disposables.push(hoverPadMat, hoverPadMesh.geometry);

  const variantMap = new Map<HeldItemHudInfo['kind'], MultiDepthVariantSpec>();
  for (const v of cfg.variants) {
    variantMap.set(v.kind, v);
    if (!registry.variants.has(v.kind)) {
      registry.variants.set(v.kind, {
        kind: v.kind,
        ean: v.ean,
        label: v.label,
        sublabel: v.sublabel,
        buildMesh: v.buildMesh,
        placementSound: cfg.placementSound,
      });
    }
  }

  const slopeRise = cfg.slopeRisePerZ ?? 0;
  const getSlopeY = (zPos: number): number =>
    slopeRise !== 0 ? Math.max(0, (maxZ - zPos) * slopeRise) : 0;

  const getDepthLabel = (d: number): string => {
    if (cfg.depthCount <= 1) return 'FAÇADE';
    if (d === 0) return 'FOND';
    if (d === cfg.depthCount - 1) return 'FAÇADE';
    return cfg.depthCount === 3 ? 'MILIEU' : `MILIEU ${d}`;
  };

  interface DepthSlotNode {
    kind: HeldItemHudInfo['kind'] | null;
    itemInfo: HeldItemHudInfo | null;
    holder: THREE.Group;
    targetZ: number;
    meshes: Map<HeldItemHudInfo['kind'], THREE.Object3D>;
    proxy: THREE.Mesh;
  }

  const getOrCreateSlotMesh = (
    node: DepthSlotNode,
    kind: HeldItemHudInfo['kind']
  ): THREE.Object3D => {
    const existing = node.meshes.get(kind);
    if (existing) return existing;

    const nativeSpec = variantMap.get(kind);
    let mesh: THREE.Object3D;
    if (nativeSpec) {
      mesh = nativeSpec.buildMesh();
    } else {
      const regSpec = registry.variants.get(kind);
      const raw = regSpec
        ? regSpec.buildMesh()
        : buildFallbackProductMesh(ctx, registry, kind);
      mesh = wrapAndFitCrossShelfMesh(
        raw,
        cfg.colWidth * 0.92,
        Math.max(0.18, cfg.itemHeight * 1.15),
        Math.max(0.11, slotStepZ * 0.96)
      );
    }
    mesh.visible = false;
    node.holder.add(mesh);
    node.meshes.set(kind, mesh);
    return mesh;
  };

  const slotNodes: DepthSlotNode[] = [];
  let hoveredSlotIdx = -1;
  let hoveredSlotTimer = 0;

  const updateSlotProxyBounds = (d: number) => {
    const node = slotNodes[d];
    const z = depthZs[d];
    const baseY = getSlopeY(z);
    if (node.kind === null) {
      // Razor-thin deck pad so empty front slots never occlude occupied or empty slots behind them
      node.proxy.scale.set(cfg.colWidth * 0.94, 0.022, slotStepZ * 0.94);
      node.proxy.position.set(0, baseY + 0.011, z);
    } else {
      const h = Math.max(0.1, cfg.itemHeight);
      node.proxy.scale.set(cfg.colWidth * 0.94, h, slotStepZ * 0.94);
      node.proxy.position.set(0, baseY + h * 0.5, z);
    }
  };

  const syncVisuals = () => {
    let any = false;
    for (let i = 0; i < slotNodes.length; i++) {
      const node = slotNodes[i];
      if (node.kind !== null) {
        any = true;
        getOrCreateSlotMesh(node, node.kind);
      }
      node.meshes.forEach((mesh, k) => {
        mesh.visible = node.kind === k;
      });
      updateSlotProxyBounds(i);
    }
    markerPlane.visible = !any;
  };

  const countFilled = (): number => {
    let n = 0;
    for (let i = 0; i < slotNodes.length; i++) {
      if (slotNodes[i].kind !== null) n++;
    }
    return n;
  };

  const needsFacing = (): boolean => {
    const frontIdx = slotNodes.length - 1;
    return slotNodes[frontIdx].kind === null && countFilled() > 0;
  };

  const defaultVariant = cfg.variants[0];

  for (let d = 0; d < cfg.depthCount; d++) {
    const holder = new THREE.Group();
    holder.position.set(0, getSlopeY(depthZs[d]), depthZs[d]);
    if (cfg.slotTiltX) {
      holder.rotation.x = cfg.slotTiltX;
    }
    colGroup.add(holder);

    const proxy = new THREE.Mesh(registry.sharedUnitBoxGeo, registry.sharedProxyMat);
    proxy.layers.set(INTERACT_LAYER);
    colGroup.add(proxy);

    const initialKind = cfg.initialSlots[d] ?? null;
    const initVariant = initialKind ? variantMap.get(initialKind) : undefined;
    const initialInfo: HeldItemHudInfo | null = initialKind
      ? {
          kind: initialKind,
          label: initVariant?.label ?? defaultVariant.label,
          sublabel: initVariant?.sublabel ?? defaultVariant.sublabel,
          ean: initVariant?.ean ?? defaultVariant.ean,
        }
      : null;

    const node: DepthSlotNode = {
      kind: initialKind,
      itemInfo: initialInfo,
      holder,
      targetZ: depthZs[d],
      meshes: new Map(),
      proxy,
    };
    slotNodes.push(node);

    const depthIdx = d;
    const posTag = getDepthLabel(depthIdx);

    const slotItem: InteractableItem = {
      id: `${cfg.id}_slot_${depthIdx}`,
      title: `${defaultVariant.label} — ${cfg.tierName}`,
      subtitle: `Emplacement ${posTag} (${depthIdx + 1}/${cfg.depthCount})`,
      kind: 'diegetic_action',
      state: false,
      inspectText: `Emplacement ${posTag} — ${cfg.tierName}`,
      proxyMesh: proxy,
      isVisible: () => {
        const activeTool = tools.getActiveTool();
        const held = tools.getHeldItem();
        if (node.kind === null) {
          return activeTool === 'hands' && !!held && isPlaceableOnShelf(held.kind);
        }
        return (activeTool === 'hands' && !held) || activeTool === 'scanner';
      },
      dynamicProductEan: () => {
        if (!node.kind) return null;
        return (
          node.itemInfo?.ean ??
          variantMap.get(node.kind)?.ean ??
          registry.variants.get(node.kind)?.ean ??
          null
        );
      },
      dynamicTitle: () => {
        if (node.kind !== null) {
          return (
            node.itemInfo?.label ??
            variantMap.get(node.kind)?.label ??
            registry.variants.get(node.kind)?.label ??
            cfg.tierName
          );
        }
        return `Emplacement Libre (${posTag}) — ${cfg.tierName}`;
      },
      dynamicSubtitle: () => {
        const filled = countFilled();
        if (node.kind === null) {
          return `Profondeur ${posTag} · Stock colonne ${filled}/${cfg.depthCount} · Placement libre`;
        }
        const ean =
          node.itemInfo?.ean ??
          variantMap.get(node.kind)?.ean ??
          registry.variants.get(node.kind)?.ean ??
          '';
        return `Position ${posTag} (${filled}/${cfg.depthCount})${ean ? ` · EAN ${ean}` : ''}`;
      },
      dynamicVerb: () => {
        const activeTool = tools.getActiveTool();
        const held = tools.getHeldItem();
        if (node.kind === null) {
          if (activeTool === 'hands' && held && isPlaceableOnShelf(held.kind)) {
            return `POSER ICI (${posTag})`;
          }
          return `EMPLACEMENT LIBRE (${posTag})`;
        }
        if (activeTool === 'hands' && !held) {
          return `PRENDRE L'ARTICLE (${posTag})`;
        }
        return `EN RAYON (${posTag})`;
      },
      onHoverUv: () => {
        if (node.kind === null) {
          hoveredSlotIdx = depthIdx;
          hoveredSlotTimer = 0.14;
        }
      },
      onInteract: () => {
        if (!helper.acquireLock()) return;
        const activeTool = tools.getActiveTool();
        const held = tools.getHeldItem();

        // 1) Free-Anywhere Placement into this exact empty depth slot (Front, Middle, or Back)
        if (node.kind === null) {
          if (activeTool === 'hands' && held && isPlaceableOnShelf(held.kind)) {
            const placedInfo: HeldItemHudInfo = { ...held };
            node.kind = placedInfo.kind;
            node.itemInfo = placedInfo;
            node.holder.position.z = Math.min(cfg.shelfFrontZ + 0.06, depthZs[depthIdx] + 0.08);
            node.targetZ = depthZs[depthIdx];
            tools.consumeHeldItem();
            syncVisuals();
            const soundKind =
              registry.variants.get(placedInfo.kind)?.placementSound ?? cfg.placementSound;
            playPlacementAudio(soundKind, false);
          }
          return;
        }

        // 2) Direct Free-Depth Pickup of ANY stocked article (Fond, Milieu, or Façade)
        if (activeTool === 'hands' && !held) {
          const pickedKind = node.kind;
          const nativeV = variantMap.get(pickedKind);
          const regV = registry.variants.get(pickedKind);
          const pickedInfo: HeldItemHudInfo = node.itemInfo
            ? { ...node.itemInfo }
            : {
                kind: pickedKind,
                label: nativeV?.label ?? regV?.label ?? defaultVariant.label,
                sublabel: nativeV?.sublabel ?? regV?.sublabel ?? cfg.tierName,
                ean: nativeV?.ean ?? regV?.ean ?? defaultVariant.ean,
              };
          node.kind = null;
          node.itemInfo = null;
          syncVisuals();
          tools.pickUpItem(pickedInfo);
          const soundKind = regV?.placementSound ?? cfg.placementSound;
          playPlacementAudio(soundKind, false);
        }
      },
    };

    proxy.userData.interactable = slotItem;
    ctx.interactables.push(slotItem);
  }

  // Dedicated low-profile front-lip [FAIRE LE FACING] strip (visible only when front slot is empty & rear stock exists)
  helper.addHitbox(colGroup, {
    id: `${cfg.id}_facing_lip`,
    size: [cfg.colWidth * 0.96, 0.056, 0.06],
    pos: [0, getSlopeY(cfg.shelfFrontZ) + 0.028, cfg.shelfFrontZ - 0.018],
    title: `Façade Libre — ${cfg.tierName}`,
    subtitle: 'Tirer les articles en retrait vers la façade',
    isVisible: () => needsFacing() && tools.getActiveTool() === 'hands' && !tools.getHeldItem(),
    dynamicSubtitle: () =>
      `Stock : ${countFilled()}/${cfg.depthCount} en retrait · Avancez en façade [FAIRE LE FACING]`,
    verb: () => 'FAIRE LE FACING (AVANCER EN FAÇADE)',
    onInteract: () => {
      if (!helper.acquireLock()) return;
      if (!needsFacing()) return;

      const present: Array<{ kind: HeldItemHudInfo['kind']; info: HeldItemHudInfo | null; fromZ: number }> = [];
      for (let i = 0; i < slotNodes.length; i++) {
        if (slotNodes[i].kind !== null) {
          present.push({
            kind: slotNodes[i].kind!,
            info: slotNodes[i].itemInfo,
            fromZ: depthZs[i],
          });
        }
      }
      const offset = slotNodes.length - present.length;
      for (let i = 0; i < slotNodes.length; i++) {
        if (i < offset) {
          slotNodes[i].kind = null;
          slotNodes[i].itemInfo = null;
        } else {
          const entry = present[i - offset];
          slotNodes[i].kind = entry.kind;
          slotNodes[i].itemInfo = entry.info;
          slotNodes[i].holder.position.z = entry.fromZ;
          slotNodes[i].targetZ = depthZs[i];
        }
      }
      syncVisuals();
      playPlacementAudio(cfg.placementSound, true);
    },
  });

  syncVisuals();

  ctx.updaters.push({
    update: (dt) => {
      for (let i = 0; i < slotNodes.length; i++) {
        const n = slotNodes[i];
        if (Math.abs(n.holder.position.z - n.targetZ) > 0.0005) {
          n.holder.position.z = THREE.MathUtils.damp(n.holder.position.z, n.targetZ, 12, dt);
        } else {
          n.holder.position.z = n.targetZ;
        }
        if (slopeRise !== 0) {
          n.holder.position.y = getSlopeY(n.holder.position.z);
        }
      }

      if (hoveredSlotTimer > 0) {
        hoveredSlotTimer = Math.max(0, hoveredSlotTimer - dt);
        const holdingPlaceable =
          tools.getActiveTool() === 'hands' &&
          !!tools.getHeldItem() &&
          isPlaceableOnShelf(tools.getHeldItem()!.kind);
        if (
          holdingPlaceable &&
          hoveredSlotIdx >= 0 &&
          hoveredSlotIdx < slotNodes.length &&
          slotNodes[hoveredSlotIdx].kind === null
        ) {
          hoverPadMesh.visible = true;
          hoverPadMesh.position.set(
            0,
            getSlopeY(depthZs[hoveredSlotIdx]) + 0.008,
            depthZs[hoveredSlotIdx]
          );
        } else {
          hoverPadMesh.visible = false;
        }
      } else if (hoverPadMesh.visible) {
        hoverPadMesh.visible = false;
      }
    },
  });
}

/**
 * Standardized SRP / PAV (Prêt-à-Vendre) Deep Shelf-Ready Perforated Cardboard Tray Lane.
 * V20 Free-Anywhere Overhaul:
 * - Accepts ANY registered PAV tray or ANY individual product when empty ([POSER ICI]).
 * - Allows direct pickup of sealed/empty PAV trays ([PRENDRE LE PRÉSENTOIR PAV]) or stocked units ([PRENDRE L'ARTICLE]).
 */
export function buildSrpPavLane(
  ctx: WorldBuildContext,
  faceGroup: THREE.Group,
  helper: ShelfHelperHandle,
  tools: PlayerToolController,
  cfg: SrpPavLaneConfig
): void {
  const registry = getShelfRegistry(ctx);

  // Register this PAV tray & its individual unit globally so they can be placed on ANY shelf across all 11 departments
  if (!registry.pavConfigs.has(cfg.trayKind)) {
    registry.pavConfigs.set(cfg.trayKind, cfg);
  }
  if (!registry.variants.has(cfg.trayKind)) {
    registry.variants.set(cfg.trayKind, {
      kind: cfg.trayKind,
      ean: cfg.ean,
      label: cfg.trayLabel,
      sublabel: `Présentoir PAV · EAN ${cfg.ean}`,
      buildMesh: () => buildCompactPavTrayMesh(ctx, cfg),
    });
  }
  if (!registry.variants.has(cfg.unitKind)) {
    registry.variants.set(cfg.unitKind, {
      kind: cfg.unitKind,
      ean: cfg.ean,
      label: cfg.unitLabel,
      sublabel: `Article PAV · EAN ${cfg.ean}`,
      buildMesh: () => {
        const u = cfg.buildUnitMesh(0);
        return wrapAndFitCrossShelfMesh(u, 0.24, 0.28, 0.24);
      },
    });
  }

  const laneRoot = new THREE.Group();
  laneRoot.position.set(cfg.x, cfg.y, 0);
  faceGroup.add(laneRoot);

  const trayCardboardMat = new THREE.MeshStandardMaterial({
    color: 0xb68d65,
    roughness: 0.86,
  });
  const perfFlapMat = new THREE.MeshStandardMaterial({
    color: 0xc29b72,
    roughness: 0.82,
  });
  const guideMat = new THREE.MeshBasicMaterial({
    color: cfg.accentColor,
    transparent: true,
    opacity: 0.22,
  });
  ctx.disposables.push(trayCardboardMat, perfFlapMat, guideMat);

  const guidePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.trayWidth, cfg.trayDepth),
    guideMat
  );
  guidePlane.rotation.x = -Math.PI / 2;
  guidePlane.position.set(0, 0.004, 0.29);
  laneRoot.add(guidePlane);
  ctx.disposables.push(guidePlane.geometry);

  const trayGroup = new THREE.Group();
  const restZ = 0.29;
  trayGroup.position.set(0, 0, cfg.initialHasTray ? restZ : 0.62);
  trayGroup.visible = cfg.initialHasTray;
  laneRoot.add(trayGroup);

  const w = cfg.trayWidth;
  const d = cfg.trayDepth;
  const h = cfg.trayHeight;

  const floorCb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), trayCardboardMat);
  floorCb.position.set(0, 0.005, 0);
  const backCb = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), trayCardboardMat);
  backCb.position.set(0, h / 2, -d / 2 + 0.005);
  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.01, h * 0.85, d), trayCardboardMat);
  sideL.position.set(-w / 2 + 0.005, h * 0.425, 0);
  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.01, h * 0.85, d), trayCardboardMat);
  sideR.position.set(w / 2 - 0.005, h * 0.425, 0);

  const frontLipMats: THREE.Material[] = [
    trayCardboardMat,
    trayCardboardMat,
    trayCardboardMat,
    trayCardboardMat,
    cfg.frontMat,
    trayCardboardMat,
  ];
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.044, 0.012), frontLipMats);
  frontLip.position.set(0, 0.023, d / 2 - 0.006);

  // Tear-away perforated cardboard front flap (sealed until sliced open with Cutter!)
  const tearFlapPivot = new THREE.Group();
  tearFlapPivot.position.set(0, 0.044, d / 2 - 0.004);
  const flapH = Math.max(0.055, h - 0.044);
  const tearFlapMesh = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.006, flapH, 0.01),
    perfFlapMat
  );
  tearFlapMesh.position.set(0, flapH / 2, 0);
  const perfStrip = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.012, 0.008, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x7c2d12 })
  );
  perfStrip.position.set(0, 0.008, 0.001);
  tearFlapPivot.add(tearFlapMesh, perfStrip);

  const dynamicUnitsHolder = new THREE.Group();
  trayGroup.add(floorCb, backCb, sideL, sideR, frontLip, tearFlapPivot, dynamicUnitsHolder);

  // Holder for freely placed single products on an empty PAV lane
  const looseItemHolder = new THREE.Group();
  looseItemHolder.position.set(0, 0, restZ);
  laneRoot.add(looseItemHolder);
  const looseMeshes = new Map<HeldItemHudInfo['kind'], THREE.Object3D>();

  ctx.disposables.push(
    floorCb.geometry,
    backCb.geometry,
    sideL.geometry,
    sideR.geometry,
    frontLip.geometry,
    tearFlapMesh.geometry,
    perfStrip.geometry,
    perfStrip.material as THREE.Material
  );

  // Active PAV config (supports native OR any other PAV tray placed freely into this lane!)
  let activePavCfg: SrpPavLaneConfig = cfg;
  const cachedPavUnitSets = new Map<HeldItemHudInfo['kind'], THREE.Object3D[]>();

  const ensurePavUnitsFor = (pav: SrpPavLaneConfig): THREE.Object3D[] => {
    let list = cachedPavUnitSets.get(pav.trayKind);
    if (!list) {
      list = [];
      for (let i = 0; i < pav.maxUnits; i++) {
        const u = pav.buildUnitMesh(i);
        u.visible = false;
        dynamicUnitsHolder.add(u);
        list.push(u);
      }
      cachedPavUnitSets.set(pav.trayKind, list);
    }
    return list;
  };

  let hasTray = cfg.initialHasTray;
  let flapCut = cfg.initialFlapCut;
  let unitCount = cfg.initialUnits;
  let slideTargetZ = restZ;
  let looseItem: HeldItemHudInfo | null = null;

  const syncLane = () => {
    trayGroup.visible = hasTray;
    guidePlane.visible = !hasTray && !looseItem;
    tearFlapPivot.visible = hasTray && !flapCut;
    frontLipMats[4] = activePavCfg.frontMat;

    cachedPavUnitSets.forEach((list, trayK) => {
      const showSet = hasTray && trayK === activePavCfg.trayKind;
      for (let i = 0; i < list.length; i++) {
        list[i].visible = showSet && i < unitCount;
      }
    });
    if (hasTray) {
      const activeList = ensurePavUnitsFor(activePavCfg);
      for (let i = 0; i < activeList.length; i++) {
        activeList[i].visible = i < unitCount;
      }
    }

    looseMeshes.forEach((mesh, k) => {
      mesh.visible = !hasTray && looseItem?.kind === k;
    });
  };
  syncLane();

  ctx.updaters.push({
    update: (dt) => {
      if (hasTray) {
        trayGroup.position.z = THREE.MathUtils.damp(trayGroup.position.z, slideTargetZ, 9, dt);
      }
      if (looseItem) {
        looseItemHolder.position.z = THREE.MathUtils.damp(looseItemHolder.position.z, restZ, 12, dt);
      }
    },
  });

  helper.addHitbox(laneRoot, {
    id: cfg.id,
    size: [w + 0.03, h + 0.08, d + 0.06],
    pos: [0, h / 2 + 0.02, 0.3],
    title: cfg.trayLabel,
    subtitle: 'Emplacement PAV libre (placement de tout produit ou présentoir)',
    dynamicProductEan: () => {
      if (hasTray) return activePavCfg.ean;
      if (looseItem) return looseItem.ean ?? registry.variants.get(looseItem.kind)?.ean ?? null;
      return null;
    },
    dynamicTitle: () => {
      if (hasTray) return activePavCfg.trayLabel;
      if (looseItem) return looseItem.label;
      return `Emplacement Libre — ${cfg.trayLabel}`;
    },
    dynamicSubtitle: () => {
      if (looseItem) {
        return `Article posé librement${looseItem.ean ? ` · EAN ${looseItem.ean}` : ''}`;
      }
      if (!hasTray) {
        return 'Emplacement libre — Posez un présentoir PAV ou n’importe quel article';
      }
      if (!flapCut) {
        return `Rabat frontal fermé — Découpez au Cutter ou saisissez à mains nues · EAN ${activePavCfg.ean}`;
      }
      return `Présentoir PAV ouvert · ${unitCount}/${activePavCfg.maxUnits} unités · EAN ${activePavCfg.ean}`;
    },
    verb: () => {
      const activeTool = tools.getActiveTool();
      const held = tools.getHeldItem();

      if (looseItem) {
        if (activeTool === 'hands' && !held) return "PRENDRE L'ARTICLE";
        return 'ARTICLE EN RAYON';
      }

      if (!hasTray) {
        if (activeTool === 'hands' && held && isPlaceableOnShelf(held.kind)) {
          return registry.pavConfigs.has(held.kind)
            ? 'POSER ICI (PRÉSENTOIR PAV)'
            : 'POSER ICI';
        }
        return 'EMPLACEMENT LIBRE';
      }

      if (!flapCut) {
        if (activeTool === 'cutter') return 'DÉCOUPER RABAT PAV AU CUTTER';
        if (activeTool === 'hands' && !held) return 'PRENDRE LE PRÉSENTOIR PAV';
        return 'RABAT PAV FERMÉ (ÉQUIPER CUTTER)';
      }

      if (activeTool === 'hands' && held?.kind === activePavCfg.unitKind && unitCount < activePavCfg.maxUnits) {
        return `POSER ICI (${unitCount + 1}/${activePavCfg.maxUnits})`;
      }
      if (activeTool === 'hands' && !held && unitCount > 0) {
        return `PRENDRE L'ARTICLE (${unitCount}/${activePavCfg.maxUnits})`;
      }
      if (activeTool === 'hands' && !held && unitCount === 0) {
        return 'RETIRER PRÉSENTOIR PAV VIDE';
      }
      return `PRÉSENTOIR PAV (${unitCount}/${activePavCfg.maxUnits})`;
    },
    onInteract: () => {
      if (!helper.acquireLock()) return;
      const activeTool = tools.getActiveTool();
      const held = tools.getHeldItem();

      // 1) Pick up a freely placed loose article
      if (looseItem) {
        if (activeTool === 'hands' && !held) {
          const picked = looseItem;
          looseItem = null;
          syncLane();
          tools.pickUpItem(picked);
          playPlacementAudio(registry.variants.get(picked.kind)?.placementSound, false);
        }
        return;
      }

      // 2) Empty lane: accept ANY PAV tray OR ANY individual product freely!
      if (!hasTray) {
        if (activeTool === 'hands' && held && isPlaceableOnShelf(held.kind)) {
          const matchedPav = registry.pavConfigs.get(held.kind);
          if (matchedPav) {
            activePavCfg = matchedPav;
            hasTray = true;
            flapCut = false;
            unitCount = matchedPav.maxUnits;
            trayGroup.position.z = 0.62;
            slideTargetZ = restZ;
            tools.consumeHeldItem();
            syncLane();
            soundSynth.playPlasticSlide();
          } else {
            // Place any single product freely onto this lane
            looseItem = { ...held };
            if (!looseMeshes.has(looseItem.kind)) {
              const regSpec = registry.variants.get(looseItem.kind);
              const raw = regSpec
                ? regSpec.buildMesh()
                : buildFallbackProductMesh(ctx, registry, looseItem.kind);
              const fitted = wrapAndFitCrossShelfMesh(
                raw,
                w * 0.9,
                Math.max(0.2, h * 1.4),
                d * 0.85
              );
              looseItemHolder.add(fitted);
              looseMeshes.set(looseItem.kind, fitted);
            }
            looseItemHolder.position.z = 0.56;
            tools.consumeHeldItem();
            syncLane();
            playPlacementAudio(registry.variants.get(looseItem.kind)?.placementSound, false);
          }
        }
        return;
      }

      // 3) Installed PAV tray with intact front flap: cut with Cutter OR pick up whole tray with empty hands!
      if (hasTray && !flapCut) {
        if (activeTool === 'cutter') {
          flapCut = true;
          tools.triggerCutterSlash();
          syncLane();
        } else if (activeTool === 'hands' && !held) {
          hasTray = false;
          unitCount = 0;
          syncLane();
          tools.pickUpItem({
            kind: activePavCfg.trayKind,
            label: activePavCfg.trayLabel,
            sublabel: `Présentoir PAV · EAN ${activePavCfg.ean}`,
            ean: activePavCfg.ean,
          });
          soundSynth.playPlasticSlide();
        } else {
          soundSynth.playAtmPiezo('error');
        }
        return;
      }

      // 4) Open PAV tray: place unit back, grab individual unit, or remove empty tray
      if (hasTray && flapCut) {
        if (activeTool === 'hands' && held?.kind === activePavCfg.unitKind && unitCount < activePavCfg.maxUnits) {
          unitCount += 1;
          tools.consumeHeldItem();
          syncLane();
          soundSynth.playPlasticSlide();
          return;
        }
        if (activeTool === 'hands' && !held && unitCount > 0) {
          unitCount -= 1;
          syncLane();
          tools.pickUpItem({
            kind: activePavCfg.unitKind,
            label: activePavCfg.unitLabel,
            sublabel: `Présentoir PAV · EAN ${activePavCfg.ean}`,
            ean: activePavCfg.ean,
          });
          soundSynth.playUiTone(false);
          return;
        }
        if (activeTool === 'hands' && !held && unitCount === 0) {
          hasTray = false;
          flapCut = false;
          syncLane();
          soundSynth.playPlasticSlide();
        }
      }
    },
  });
}
