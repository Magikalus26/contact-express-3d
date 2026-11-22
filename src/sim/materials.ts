import * as THREE from 'three';
import { ProceduralTextureBank, INTERACT_LAYER } from './textures';
import { ColliderBox, InteractableItem, InteractionKind, WorldBuildContext } from './types';

export class MaterialLibrary {
  readonly asphalt: THREE.MeshStandardMaterial;
  readonly salesTile: THREE.MeshStandardMaterial;
  readonly warehouseEpoxy: THREE.MeshStandardMaterial;
  readonly concrete: THREE.MeshStandardMaterial;
  readonly concreteDark: THREE.MeshStandardMaterial;
  readonly wallPlaster: THREE.MeshStandardMaterial;
  readonly facadeCladding: THREE.MeshStandardMaterial;
  readonly anthracite: THREE.MeshStandardMaterial;
  readonly stainless: THREE.MeshStandardMaterial;
  readonly chrome: THREE.MeshStandardMaterial;
  readonly galvanized: THREE.MeshStandardMaterial;
  readonly oakWood: THREE.MeshStandardMaterial;
  readonly darkWineWood: THREE.MeshStandardMaterial;
  readonly rusticWood: THREE.MeshStandardMaterial;
  readonly hazardStripe: THREE.MeshStandardMaterial;
  readonly chainLink: THREE.MeshStandardMaterial;
  readonly conveyorRubber: THREE.MeshStandardMaterial;
  readonly rubberBlack: THREE.MeshStandardMaterial;
  readonly rackBlue: THREE.MeshStandardMaterial;
  readonly rackOrange: THREE.MeshStandardMaterial;
  readonly palletYellow: THREE.MeshStandardMaterial;
  readonly balerGreen: THREE.MeshStandardMaterial;
  readonly whiteMetal: THREE.MeshStandardMaterial;
  readonly butcherTile: THREE.MeshStandardMaterial;
  readonly cardboard: THREE.MeshStandardMaterial;
  readonly shrinkWrap: THREE.MeshStandardMaterial;
  readonly clearGlass: THREE.MeshPhysicalMaterial;
  readonly frostedGlass: THREE.MeshPhysicalMaterial;
  readonly priceRail: THREE.MeshStandardMaterial;
  readonly whiteProduct: THREE.MeshStandardMaterial;
  readonly glassBottle: THREE.MeshStandardMaterial;
  readonly acousticCeiling: THREE.MeshStandardMaterial;
  readonly warehouseBlockWall: THREE.MeshStandardMaterial;
  readonly officeCarpet: THREE.MeshStandardMaterial;
  readonly hatchedZone: THREE.MeshBasicMaterial;
  readonly retailStripeNavy: THREE.MeshStandardMaterial;
  readonly retailStripeRed: THREE.MeshStandardMaterial;
  readonly retailStripeCream: THREE.MeshStandardMaterial;
  readonly corrugatedCladding: THREE.MeshStandardMaterial;
  readonly concretePlinth: THREE.MeshStandardMaterial;
  readonly rollUpShutter: THREE.MeshStandardMaterial;
  readonly ventGrille: THREE.MeshStandardMaterial;
  readonly emergencyExitSign: THREE.MeshStandardMaterial;
  readonly officeCorkBoard: THREE.MeshStandardMaterial;

  private allMaterials: THREE.Material[] = [];

  constructor(texBank: ProceduralTextureBank, isSoftwareGl: boolean) {
    const reg = <T extends THREE.Material>(m: T): T => {
      this.allMaterials.push(m);
      return m;
    };

    this.asphalt = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createAsphaltTexture(14, 10),
        roughness: 0.88,
        metalness: 0.05,
      })
    );

    // V23: 1990 40x40cm speckled terrazzo / ceramic tiles with paired matte-grout / satin-tile roughnessMap
    const terrazzoTex = texBank.createSupermarketTerrazzoTextures(25, 17.5);
    this.salesTile = reg(
      new THREE.MeshStandardMaterial({
        map: terrazzoTex.map,
        roughnessMap: terrazzoTex.roughnessMap,
        roughness: 1.0,
        metalness: 0.08,
        envMapIntensity: 0.85,
      })
    );

    // V23: Smooth sealed industrial warehouse concrete with paired roughnessMap
    const warehouseConcreteTex = texBank.createWarehouseConcreteTextures(10, 3);
    this.warehouseEpoxy = reg(
      new THREE.MeshStandardMaterial({
        map: warehouseConcreteTex.map,
        roughnessMap: warehouseConcreteTex.roughnessMap,
        roughness: 1.0,
        metalness: 0.1,
        envMapIntensity: 0.65,
      })
    );

    this.concrete = reg(
      new THREE.MeshStandardMaterial({
        color: 0x9ca3af,
        roughness: 0.85,
        metalness: 0.05,
      })
    );

    this.concreteDark = reg(
      new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.88,
        metalness: 0.06,
      })
    );

    // V23: Subtle roller-painted 1990 warm ivory plaster wall texture
    this.wallPlaster = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createPaintedPlasterTexture(6, 2),
        color: 0xffffff,
        roughness: 0.86,
        metalness: 0.02,
      })
    );

    this.facadeCladding = reg(
      new THREE.MeshStandardMaterial({
        color: 0x27303f,
        roughness: 0.52,
        metalness: 0.35,
      })
    );

    this.anthracite = reg(
      new THREE.MeshStandardMaterial({
        color: 0x1e242b,
        roughness: 0.42,
        metalness: 0.55,
      })
    );

    this.stainless = reg(
      new THREE.MeshStandardMaterial({
        color: 0xdbe2ea,
        roughness: 0.24,
        metalness: 0.86,
      })
    );

    this.chrome = reg(
      new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.12,
        metalness: 0.95,
      })
    );

    this.galvanized = reg(
      new THREE.MeshStandardMaterial({
        color: 0xbac4d0,
        roughness: 0.38,
        metalness: 0.78,
      })
    );

    this.oakWood = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createWoodPlankTexture('#c89662', '#9c6b3b', 2, 2),
        roughness: 0.58,
        metalness: 0.04,
      })
    );

    this.darkWineWood = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createWoodPlankTexture('#5c3a24', '#3b2313', 2, 2),
        roughness: 0.52,
        metalness: 0.06,
      })
    );

    this.rusticWood = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createWoodPlankTexture('#a97442', '#784e27', 3, 2),
        roughness: 0.72,
        metalness: 0.03,
      })
    );

    this.hazardStripe = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createHazardStripeTexture(3, 1),
        roughness: 0.45,
        metalness: 0.15,
      })
    );

    this.chainLink = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createChainLinkTexture(16, 5),
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.36,
        metalness: 0.75,
      })
    );

    this.conveyorRubber = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createConveyorBeltTexture(1, 5),
        roughness: 0.78,
        metalness: 0.08,
      })
    );

    this.rubberBlack = reg(
      new THREE.MeshStandardMaterial({
        color: 0x181a1f,
        roughness: 0.85,
        metalness: 0.06,
      })
    );

    this.rackBlue = reg(
      new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        roughness: 0.38,
        metalness: 0.55,
      })
    );

    this.rackOrange = reg(
      new THREE.MeshStandardMaterial({
        color: 0xea580c,
        roughness: 0.36,
        metalness: 0.48,
      })
    );

    this.palletYellow = reg(
      new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.35,
        metalness: 0.52,
      })
    );

    this.balerGreen = reg(
      new THREE.MeshStandardMaterial({
        color: 0x15803d,
        roughness: 0.42,
        metalness: 0.48,
      })
    );

    this.whiteMetal = reg(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.32,
        metalness: 0.28,
      })
    );

    this.butcherTile = reg(
      new THREE.MeshStandardMaterial({
        color: 0x991b1b,
        roughness: 0.28,
        metalness: 0.1,
      })
    );

    this.cardboard = reg(
      new THREE.MeshStandardMaterial({
        color: 0xb58858,
        roughness: 0.85,
        metalness: 0.02,
      })
    );

    this.shrinkWrap = reg(
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        transparent: true,
        opacity: 0.52,
        depthWrite: false,
        roughness: 0.18,
        metalness: 0.05,
      })
    );

    // Performance-friendly clear architectural glass (avoids multi-pass transmission overhead on mobile)
    this.clearGlass = reg(
      new THREE.MeshPhysicalMaterial({
        color: 0xdff2fe,
        transparent: true,
        opacity: isSoftwareGl ? 0.32 : 0.28,
        roughness: 0.08,
        metalness: 0.1,
        reflectivity: 0.9,
        clearcoat: isSoftwareGl ? 0 : 1.0,
        clearcoatRoughness: 0.06,
        depthWrite: false,
      })
    );

    this.frostedGlass = reg(
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.52,
        roughness: 0.38,
        metalness: 0.05,
        depthWrite: false,
      })
    );

    this.priceRail = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createPriceRailTexture(5),
        roughness: 0.45,
        metalness: 0.1,
      })
    );

    this.whiteProduct = reg(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.44,
        metalness: 0.08,
      })
    );

    this.glassBottle = reg(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.14,
        metalness: 0.2,
      })
    );

    // V23: 60x60cm micro-perforated acoustic ceiling tiles + metallic T-bar grid
    const ceilingTex = texBank.createAcousticCeilingTextures(17, 17);
    this.acousticCeiling = reg(
      new THREE.MeshStandardMaterial({
        map: ceilingTex.map,
        roughnessMap: ceilingTex.roughnessMap,
        roughness: 1.0,
        metalness: 0.12,
      })
    );

    // V23: Painted industrial cinder-block masonry for Rear Warehouse interior walls
    this.warehouseBlockWall = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createWarehouseCinderBlockTexture(8, 3),
        color: 0xffffff,
        roughness: 0.88,
        metalness: 0.04,
      })
    );

    // V23: Warm 1990 commercial low-pile office carpet tile floor
    this.officeCarpet = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createOfficeCarpetTexture(4, 3.5),
        color: 0xffffff,
        roughness: 0.94,
        metalness: 0.0,
      })
    );

    // V23: Industrial yellow diagonal hatched safety loading-zone floor overlay
    this.hatchedZone = reg(
      new THREE.MeshBasicMaterial({
        map: texBank.createHatchedLoadingZoneTexture(3, 2),
        transparent: true,
        opacity: 0.84,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      })
    );

    // V23: Classic 1990 French retail horizontal wall stripe bands (navy, red, warm cream)
    this.retailStripeNavy = reg(
      new THREE.MeshStandardMaterial({
        color: 0x1b365d,
        roughness: 0.42,
        metalness: 0.08,
      })
    );
    this.retailStripeRed = reg(
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        roughness: 0.4,
        metalness: 0.06,
      })
    );
    this.retailStripeCream = reg(
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        roughness: 0.52,
        metalness: 0.04,
      })
    );

    // V26: 1990 Vertical Ribbed Corrugated Steel Exterior Cladding ("Bardage Métallique Nervuré")
    const cladTex = texBank.createCorrugatedCladdingTextures(14, 1);
    this.corrugatedCladding = reg(
      new THREE.MeshStandardMaterial({
        map: cladTex.map,
        roughnessMap: cladTex.roughnessMap,
        roughness: 1.0,
        metalness: 0.36,
      })
    );

    // V26: Textured Exterior Concrete Foundation Plinth ("Soubassement Béton")
    this.concretePlinth = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createExteriorConcretePlinthTexture(12, 1),
        roughness: 0.9,
        metalness: 0.04,
      })
    );

    // V26: Corrugated Metal Roll-Up Shutter Door ("Rideau Métallique Quai")
    this.rollUpShutter = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createRollUpShutterTexture(2, 5),
        roughness: 0.42,
        metalness: 0.62,
      })
    );

    // V26: Exterior Industrial Aluminum Ventilation Grille
    this.ventGrille = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createVentGrilleTexture(),
        roughness: 0.45,
        metalness: 0.52,
      })
    );

    // V26: Illuminated "SORTIE DE SECOURS" Exterior Plaque
    const exitTex = texBank.createEmergencyExitSignTexture();
    this.emergencyExitSign = reg(
      new THREE.MeshStandardMaterial({
        map: exitTex,
        emissiveMap: exitTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.45,
        roughness: 0.3,
      })
    );

    // V26: Manager's Office Cork Bulletin Board & Weekly Planning
    this.officeCorkBoard = reg(
      new THREE.MeshStandardMaterial({
        map: texBank.createOfficeCorkBoardTexture(),
        roughness: 0.88,
        metalness: 0.02,
      })
    );
  }

  dispose(): void {
    for (const m of this.allMaterials) {
      m.dispose();
    }
    this.allMaterials = [];
  }
}

const _invisibleProxyMat = new THREE.MeshBasicMaterial({
  visible: false,
});

export function addBoxCollider(
  ctx: WorldBuildContext,
  id: string,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  enabled = true,
  minY = -2,
  maxY = 5
): ColliderBox {
  const box: ColliderBox = {
    id,
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ),
    minY,
    maxY,
    enabled,
  };
  ctx.colliders.push(box);
  return box;
}

export function registerInteractableBox(
  ctx: WorldBuildContext,
  parent: THREE.Object3D,
  opts: {
    id: string;
    title: string;
    subtitle: string;
    kind: InteractionKind;
    initialState?: boolean;
    inspectText: string;
    specs?: string;
    size: [number, number, number];
    position: [number, number, number];
    productEan?: string;
    dynamicProductEan?: () => string | null;
    onToggle?: (nextState: boolean) => void;
  }
): InteractableItem {
  const geo = new THREE.BoxGeometry(opts.size[0], opts.size[1], opts.size[2]);
  ctx.disposables.push(geo);
  const proxy = new THREE.Mesh(geo, _invisibleProxyMat);
  proxy.position.set(opts.position[0], opts.position[1], opts.position[2]);
  proxy.layers.set(INTERACT_LAYER);
  parent.add(proxy);

  const item: InteractableItem = {
    id: opts.id,
    title: opts.title,
    subtitle: opts.subtitle,
    kind: opts.kind,
    state: opts.initialState ?? false,
    inspectText: opts.inspectText,
    specs: opts.specs,
    proxyMesh: proxy,
    productEan: opts.productEan,
    dynamicProductEan: opts.dynamicProductEan,
    onToggle: opts.onToggle,
  };
  proxy.userData.interactable = item;
  ctx.interactables.push(item);
  return item;
}

export interface InstanceEntry {
  pos: [number, number, number];
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  scale?: [number, number, number];
  color?: number;
}

export function buildInstancedMesh(
  ctx: WorldBuildContext,
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  entries: InstanceEntry[],
  castShadow = false
): THREE.InstancedMesh {
  const count = Math.max(1, entries.length);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let hasColor = false;

  entries.forEach((e, idx) => {
    dummy.position.set(e.pos[0], e.pos[1], e.pos[2]);
    dummy.rotation.set(e.rotX ?? 0, e.rotY ?? 0, e.rotZ ?? 0);
    if (e.scale) {
      dummy.scale.set(e.scale[0], e.scale[1], e.scale[2]);
    } else {
      dummy.scale.set(1, 1, 1);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(idx, dummy.matrix);

    if (e.color !== undefined) {
      hasColor = true;
      color.setHex(e.color);
      mesh.setColorAt(idx, color);
    }
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (hasColor && mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingSphere();
  parent.add(mesh);
  return mesh;
}
