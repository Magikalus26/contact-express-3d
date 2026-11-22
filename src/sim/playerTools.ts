import * as THREE from 'three';
import { soundSynth } from './audio';
import {
  CatalogProduct,
  drawEanBarcode,
  getProductByEan,
  PRODUCT_CATALOG,
} from './productCatalog';
import {
  HeldItemHudInfo,
  LabelerHudState,
  OrdererHudState,
  PlayerTool,
  ScannerHudState,
  WorldBuildContext,
} from './types';
import { OrderTerminalKeyCode, OrderTerminalModel } from './orderCatalog';

const TOOL_DEBOUNCE_MS = 320;

// Module-scope reusable raycasting & math helpers (Zero GC inside render/input paths)
const _handheldRaycaster = new THREE.Raycaster();
_handheldRaycaster.near = 0.05;
_handheldRaycaster.far = 1.6;
const _ndcVec = new THREE.Vector2();
const _beamStart = new THREE.Vector3();
const _beamMid = new THREE.Vector3();
const _beamFallbackTarget = new THREE.Vector3();
const _camDir = new THREE.Vector3();

export type LabelerRayHit =
  | { kind: 'key'; code: string; displayName: string }
  | { kind: 'take_label'; displayName: string }
  | { kind: 'scanner_btn'; code: 'SCAN' | 'TRANSFERT'; displayName: string }
  | { kind: 'orderer_btn'; code: OrderTerminalKeyCode; displayName: string };

interface LabelerKeyDef {
  code: string;
  legend: string;
  displayName: string;
  bgHex: string;
  sideColor: number;
  textHex: string;
  row: number;
  col: number;
}

const LABELER_KEY_DEFS: LabelerKeyDef[] = [
  // Row 0: Function keys
  { code: 'CODE', legend: 'CODE', displayName: 'CODE (EAN-8 / Catalogue)', bgHex: '#1d3b66', sideColor: 0x162c4d, textHex: '#f1f5f9', row: 0, col: 0 },
  { code: 'PRIX', legend: 'PRIX ₣', displayName: 'PRIX (Saisie ₣)', bgHex: '#1f4478', sideColor: 0x17335c, textHex: '#fef08a', row: 0, col: 1 },
  { code: 'EFFACER', legend: 'EFF.', displayName: 'EFFACER', bgHex: '#991b1b', sideColor: 0x701414, textHex: '#fef2f2', row: 0, col: 2 },
  // Row 1: 1-2-3
  { code: '1', legend: '1', displayName: 'Chiffre 1', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 1, col: 0 },
  { code: '2', legend: '2', displayName: 'Chiffre 2', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 1, col: 1 },
  { code: '3', legend: '3', displayName: 'Chiffre 3', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 1, col: 2 },
  // Row 2: 4-5-6
  { code: '4', legend: '4', displayName: 'Chiffre 4', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 2, col: 0 },
  { code: '5', legend: '5', displayName: 'Chiffre 5', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 2, col: 1 },
  { code: '6', legend: '6', displayName: 'Chiffre 6', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 2, col: 2 },
  // Row 3: 7-8-9
  { code: '7', legend: '7', displayName: 'Chiffre 7', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 3, col: 0 },
  { code: '8', legend: '8', displayName: 'Chiffre 8', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 3, col: 1 },
  { code: '9', legend: '9', displayName: 'Chiffre 9', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 3, col: 2 },
  // Row 4: , - 0 - IMPRIMER
  { code: ',', legend: ',', displayName: 'Virgule (,)', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 4, col: 0 },
  { code: '0', legend: '0', displayName: 'Chiffre 0', bgHex: '#3f4752', sideColor: 0x2b313a, textHex: '#f8fafc', row: 4, col: 1 },
  { code: 'IMPRIMER', legend: 'IMPR.', displayName: 'IMPRIMER', bgHex: '#15803d', sideColor: 0x105e2d, textHex: '#f0fdf4', row: 4, col: 2 },
];

interface HandheldKey3D {
  code: string;
  displayName: string;
  mesh: THREE.Mesh;
  hitMesh: THREE.Mesh;
  frontMat: THREE.MeshStandardMaterial;
  restZ: number;
  pressAnim: number;
  baseEmissive: number;
}

function createRubberKeyTexture(
  legend: string,
  bgHex: string,
  textHex: string,
  maxAniso: number,
  width = 160,
  height = 112
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d')!;

  // Matte 1990 molded rubber keycap face with subtle top bevel lighting
  c.fillStyle = bgHex;
  c.fillRect(0, 0, width, height);

  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.fillRect(4, 4, width - 8, 12);
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.fillRect(4, height - 16, width - 8, 12);

  c.strokeStyle = 'rgba(255,255,255,0.24)';
  c.lineWidth = 4;
  c.strokeRect(4, 4, width - 8, height - 8);

  c.fillStyle = textHex;
  const fontSize =
    legend.length >= 12
      ? 26
      : legend.length >= 8
        ? 30
        : legend.length >= 5
          ? 36
          : legend.length >= 4
            ? 40
            : 62;
  c.font = `900 ${fontSize}px "JetBrains Mono", monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(legend, width / 2, height / 2 + 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

export function drawPriceTagCanvas(
  canvas: HTMLCanvasElement,
  productLabel: string,
  priceText: string,
  ean = '30140101',
  verified = false
): void {
  const c = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;

  // Crisp 1990 white/cream retail shelf price ticket
  c.fillStyle = '#fffef8';
  c.fillRect(0, 0, W, H);

  // Subtle top accent band (authentic 1990 French hypermarché header)
  c.fillStyle = verified ? '#14532d' : '#1b365d';
  c.fillRect(0, 0, W, H * 0.24);
  c.fillStyle = '#ffffff';
  c.font = `800 ${Math.round(H * 0.135)}px "Plus Jakarta Sans", sans-serif`;
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('CONTACT EXPRESS', W * 0.04, H * 0.125);

  c.fillStyle = verified ? '#bbf7d0' : '#fde68a';
  c.textAlign = 'right';
  c.fillText(verified ? '✓ CONFORME' : 'FRF 1990', W * 0.96, H * 0.125);

  // Product Name (exact catalog name)
  c.fillStyle = '#0f172a';
  c.font = `800 ${Math.round(H * 0.145)}px "Plus Jakarta Sans", sans-serif`;
  c.textAlign = 'left';
  c.fillText(productLabel.slice(0, 26).toUpperCase(), W * 0.04, H * 0.41);

  // Bold French Franc Price
  c.fillStyle = '#b91c1c';
  c.font = `900 ${Math.round(H * 0.32)}px "JetBrains Mono", monospace`;
  c.textAlign = 'right';
  c.fillText(priceText, W * 0.96, H * 0.74);

  // Left-side authentic deterministic 8-digit EAN barcode + printed digits
  drawEanBarcode(c, ean, W * 0.03, H * 0.54, W * 0.42, H * 0.4, {
    showDigits: true,
    bgColor: '#fffef8',
    barColor: '#0f172a',
  });

  // Thin crisp border
  c.strokeStyle = verified ? '#16a34a' : '#94a3b8';
  c.lineWidth = verified ? 5 : 3;
  c.strokeRect(2, 2, W - 4, H - 4);
}

export class PlayerToolController {
  private camera: THREE.PerspectiveCamera;
  private activeTool: PlayerTool = 'hands';
  private heldItem: HeldItemHudInfo | null = null;

  // 1990 Electronic Price Labeler state (powered by complete PRODUCT_CATALOG!)
  private labelerRaised = false;
  private inspectPanX = 0;
  private inspectPanY = 0;
  private catalogIndex = 0;
  private currentProduct: CatalogProduct = PRODUCT_CATALOG[0];
  private inputMode: 'price' | 'code' = 'price';
  private codeInput = '';
  private priceDigits = PRODUCT_CATALOG[0].priceInput;
  private syncedFromScanner = false;
  private hasPrintedLabel = false;
  private printedCategory = PRODUCT_CATALOG[0].shortName;
  private printedEan = PRODUCT_CATALOG[0].ean;
  private printedProductName = PRODUCT_CATALOG[0].name;
  private printedPrice = PRODUCT_CATALOG[0].priceText;
  private labelerStatus = 'PRÊT — CLAVIER 3D';
  private labelerStatusTimer = 0;
  private labelerLcdDirty = true;
  private labelerExtrudeAnim = 0;
  private hoveredHandheldCode: string | null = null;

  // 1990 Handheld Barcode Inventory Terminal ("Terminal Scan 1990") state
  private scannerRaised = false;
  private scannedProduct: CatalogProduct | null = null;
  private scannerTransferred = false;
  private scannerStatus = 'PRÊT — VISEZ UN PRODUIT';
  private scannerStatusTimer = 0;
  private scannerLcdDirty = true;
  private scannerLaserTimer = 0;
  private scannerRecoil = 0;

  // Cutter slash & toy squeeze animations
  private cutterSlashAnim = 0;
  private heldSqueezeAnim = 0;
  private lastInputTime = 0;

  // 3D Viewmodel Roots (attached to camera)
  private rootGroup: THREE.Group;

  // Labeler 3D hierarchy
  private labelerGroup: THREE.Group;
  private labelerKeys: HandheldKey3D[] = [];
  private labelerKeyHitMeshes: THREE.Object3D[] = [];
  private labelerSlipMesh: THREE.Mesh;
  private labelerSlipHitMesh: THREE.Mesh;
  private labelerLcdCanvas: HTMLCanvasElement;
  private labelerLcdTex: THREE.CanvasTexture;
  private labelerSlipCanvas: HTMLCanvasElement;
  private labelerSlipTex: THREE.CanvasTexture;

  // Terminal Scan 1990 3D hierarchy
  private scannerGroup: THREE.Group;
  private scannerKeys: HandheldKey3D[] = [];
  private scannerKeyHitMeshes: THREE.Object3D[] = [];
  private scannerLcdCanvas: HTMLCanvasElement;
  private scannerLcdTex: THREE.CanvasTexture;
  private scannerEmitterWin: THREE.Mesh;
  private scannerEmitterMat: THREE.MeshStandardMaterial;
  private scannerStatusLedMat: THREE.MeshStandardMaterial;
  private scannerLaserMesh: THREE.Mesh;

  // 1990 Handheld Store Ordering Terminal ("Terminal Commande 1990") state
  private orderModel: OrderTerminalModel;
  private ordererRaised = false;
  private ordererGroup: THREE.Group;
  private ordererKeys: HandheldKey3D[] = [];
  private ordererKeyHitMeshes: THREE.Object3D[] = [];
  private ordererLcdCanvas: HTMLCanvasElement;
  private ordererLcdTex: THREE.CanvasTexture;
  private ordererModemLedMat: THREE.MeshStandardMaterial;
  private ordererModemFlash = 0;

  // Cutter & Held Props 3D hierarchy
  private cutterGroup: THREE.Group;
  private heldPropGroup: THREE.Group;
  private heldMeshes: Partial<Record<HeldItemHudInfo['kind'], THREE.Object3D>> = {};
  private heldLabelCanvas: HTMLCanvasElement;
  private heldLabelTex: THREE.CanvasTexture;

  private onChanged: () => void;
  private onScannerTriggerRequest?: () => void;

  constructor(
    ctx: WorldBuildContext,
    camera: THREE.PerspectiveCamera,
    orderModel: OrderTerminalModel,
    onChanged: () => void,
    onScannerTriggerRequest?: () => void
  ) {
    this.camera = camera;
    this.orderModel = orderModel;
    this.onChanged = onChanged;
    this.onScannerTriggerRequest = onScannerTriggerRequest;

    this.rootGroup = new THREE.Group();
    camera.add(this.rootGroup);

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xd6d1c4, // Classic sober 1990 French industrial beige
      roughness: 0.56,
      metalness: 0.06,
    });
    const bodyBevelMat = new THREE.MeshStandardMaterial({
      color: 0xc5bfb0,
      roughness: 0.62,
      metalness: 0.08,
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x252a30,
      roughness: 0.76,
      metalness: 0.12,
    });
    const keypadWellMat = new THREE.MeshStandardMaterial({
      color: 0x1e2329,
      roughness: 0.82,
      metalness: 0.08,
    });
    const hitProxyMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    ctx.disposables.push(bodyMat, bodyBevelMat, darkTrimMat, keypadWellMat, hitProxyMat);

    // ========================================================================
    // 1. 1990 PORTABLE ELECTRONIC PRICE LABELER ("ÉTIQUETEUSE 1990") — 100% 3D
    // ========================================================================
    this.labelerGroup = new THREE.Group();
    this.labelerGroup.position.set(0.28, -0.25, -0.46);
    this.labelerGroup.rotation.set(0.16, -0.26, 0.04);
    this.labelerGroup.visible = false;
    this.rootGroup.add(this.labelerGroup);

    const mainChassis = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.166, 0.04), bodyMat);
    mainChassis.position.set(0, -0.036, 0);

    const lowerChin = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.012, 0.038), bodyBevelMat);
    lowerChin.position.set(0, -0.123, -0.001);

    const gripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.146, 0.043), darkTrimMat);
    gripLeft.position.set(-0.067, -0.038, 0);
    const gripRight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.146, 0.043), darkTrimMat);
    gripRight.position.set(0.067, -0.038, 0);

    const gripBack = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.144, 0.018), darkTrimMat);
    gripBack.position.set(0, -0.038, -0.022);

    const brandCanvas = document.createElement('canvas');
    brandCanvas.width = 512;
    brandCanvas.height = 64;
    {
      const bc = brandCanvas.getContext('2d')!;
      bc.fillStyle = '#252a30';
      bc.fillRect(0, 0, 512, 64);
      bc.fillStyle = '#e2e8f0';
      bc.font = '800 26px "JetBrains Mono", monospace';
      bc.textAlign = 'left';
      bc.textBaseline = 'middle';
      bc.fillText('CONTACT-LABEL 90', 18, 33);
      bc.fillStyle = '#fde68a';
      bc.textAlign = 'right';
      bc.fillText('EAN-8 · FRF', 494, 33);
    }
    const brandTex = new THREE.CanvasTexture(brandCanvas);
    brandTex.colorSpace = THREE.SRGBColorSpace;
    brandTex.anisotropy = ctx.maxAnisotropy;
    const brandMat = new THREE.MeshStandardMaterial({ map: brandTex, roughness: 0.55 });
    const brandStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.114, 0.014), brandMat);
    brandStrip.position.set(0, 0.034, 0.0212);

    const keypadWell = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.138, 0.006), keypadWellMat);
    keypadWell.position.set(0, -0.044, 0.0205);

    this.labelerGroup.add(
      mainChassis,
      lowerChin,
      gripLeft,
      gripRight,
      gripBack,
      brandStrip,
      keypadWell
    );
    ctx.disposables.push(
      mainChassis.geometry,
      lowerChin.geometry,
      gripLeft.geometry,
      gripRight.geometry,
      gripBack.geometry,
      brandTex,
      brandMat,
      brandStrip.geometry,
      keypadWell.geometry
    );

    // Angled Upper Monochrome LCD Head
    const lcdHeadGroup = new THREE.Group();
    lcdHeadGroup.position.set(0, 0.046, 0.001);
    lcdHeadGroup.rotation.x = 0.13;
    this.labelerGroup.add(lcdHeadGroup);

    const upperHousing = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.072, 0.042), bodyMat);
    upperHousing.position.set(0, 0.036, 0);

    const slotHood = new THREE.Mesh(new THREE.BoxGeometry(0.126, 0.02, 0.046), darkTrimMat);
    slotHood.position.set(0, 0.078, 0);

    const slotSlitMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const slotSlit = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.005, 0.009), slotSlitMat);
    slotSlit.position.set(0, 0.089, 0.005);

    const lcdBezel = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.06, 0.009), darkTrimMat);
    lcdBezel.position.set(0, 0.034, 0.02);

    this.labelerLcdCanvas = document.createElement('canvas');
    this.labelerLcdCanvas.width = 512;
    this.labelerLcdCanvas.height = 256;
    this.labelerLcdTex = new THREE.CanvasTexture(this.labelerLcdCanvas);
    this.labelerLcdTex.colorSpace = THREE.SRGBColorSpace;
    this.labelerLcdTex.anisotropy = ctx.maxAnisotropy;
    const lcdMat = new THREE.MeshStandardMaterial({
      map: this.labelerLcdTex,
      emissiveMap: this.labelerLcdTex,
      emissive: 0xd9e6c3,
      emissiveIntensity: 0.44,
      roughness: 0.28,
      metalness: 0.04,
    });
    const lcdPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.106, 0.052), lcdMat);
    lcdPlane.position.set(0, 0.034, 0.0258);

    // 3D Printed Paper Price Label that extrudes from the top thermal slit (directly tappable!)
    this.labelerSlipCanvas = document.createElement('canvas');
    this.labelerSlipCanvas.width = 512;
    this.labelerSlipCanvas.height = 220;
    drawPriceTagCanvas(
      this.labelerSlipCanvas,
      this.printedProductName,
      this.printedPrice,
      this.printedEan
    );
    this.labelerSlipTex = new THREE.CanvasTexture(this.labelerSlipCanvas);
    this.labelerSlipTex.colorSpace = THREE.SRGBColorSpace;
    this.labelerSlipTex.anisotropy = ctx.maxAnisotropy;

    const slipEdgeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5ef, roughness: 0.8 });
    const slipFrontMat = new THREE.MeshStandardMaterial({
      map: this.labelerSlipTex,
      emissiveMap: this.labelerSlipTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.16,
      roughness: 0.68,
    });
    this.labelerSlipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.042, 0.002), [
      slipEdgeMat,
      slipEdgeMat,
      slipEdgeMat,
      slipEdgeMat,
      slipFrontMat,
      slipFrontMat,
    ]);
    this.labelerSlipMesh.position.set(0, 0.088, 0.006);
    this.labelerSlipMesh.visible = false;

    this.labelerSlipHitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.114, 0.06, 0.026),
      hitProxyMat
    );
    this.labelerSlipHitMesh.position.set(0, 0.118, 0.008);
    this.labelerSlipHitMesh.userData.labelerAction = {
      kind: 'take_label',
      displayName: "Prendre l'étiquette",
    } as LabelerRayHit;

    lcdHeadGroup.add(
      upperHousing,
      slotHood,
      slotSlit,
      lcdBezel,
      lcdPlane,
      this.labelerSlipMesh,
      this.labelerSlipHitMesh
    );
    ctx.disposables.push(
      upperHousing.geometry,
      slotHood.geometry,
      slotSlit.geometry,
      slotSlitMat,
      lcdBezel.geometry,
      this.labelerLcdTex,
      lcdMat,
      lcdPlane.geometry,
      this.labelerSlipTex,
      slipEdgeMat,
      slipFrontMat,
      this.labelerSlipMesh.geometry,
      this.labelerSlipHitMesh.geometry
    );

    // 15 Individual Raised, Clickable 3D Rubber Keys
    const keyGeo = new THREE.BoxGeometry(0.031, 0.021, 0.0115);
    const keyHitGeo = new THREE.BoxGeometry(0.0345, 0.0242, 0.018);
    ctx.disposables.push(keyGeo, keyHitGeo);

    const colX = [-0.0365, 0.0, 0.0365];
    const rowY = [0.009, -0.0175, -0.044, -0.0705, -0.097];
    const keyRestZ = 0.0285;

    for (const def of LABELER_KEY_DEFS) {
      const kx = colX[def.col];
      const ky = rowY[def.row];

      const keyTex = createRubberKeyTexture(
        def.legend,
        def.bgHex,
        def.textHex,
        ctx.maxAnisotropy
      );
      const sideMat = new THREE.MeshStandardMaterial({
        color: def.sideColor,
        roughness: 0.78,
        metalness: 0.04,
      });
      const baseEmissive = 0.16;
      const frontMat = new THREE.MeshStandardMaterial({
        map: keyTex,
        emissiveMap: keyTex,
        emissive: 0xffffff,
        emissiveIntensity: baseEmissive,
        roughness: 0.68,
        metalness: 0.04,
      });

      const keyMesh = new THREE.Mesh(keyGeo, [
        sideMat,
        sideMat,
        sideMat,
        sideMat,
        frontMat,
        sideMat,
      ]);
      keyMesh.position.set(kx, ky, keyRestZ);

      const hitMesh = new THREE.Mesh(keyHitGeo, hitProxyMat);
      hitMesh.position.set(kx, ky, keyRestZ + 0.002);
      hitMesh.userData.labelerAction = {
        kind: 'key',
        code: def.code,
        displayName: def.displayName,
      } as LabelerRayHit;

      this.labelerGroup.add(keyMesh, hitMesh);
      this.labelerKeyHitMeshes.push(hitMesh);
      this.labelerKeys.push({
        code: def.code,
        displayName: def.displayName,
        mesh: keyMesh,
        hitMesh,
        frontMat,
        restZ: keyRestZ,
        pressAnim: 0,
        baseEmissive,
      });

      ctx.disposables.push(keyTex, sideMat, frontMat);
    }

    // ========================================================================
    // 1B. 1990 HANDHELD BARCODE INVENTORY TERMINAL ("TERMINAL SCAN 1990") — 100% 3D
    // ========================================================================
    this.scannerGroup = new THREE.Group();
    this.scannerGroup.position.set(0.26, -0.22, -0.44);
    this.scannerGroup.rotation.set(0.14, -0.24, 0.03);
    this.scannerGroup.visible = false;
    this.rootGroup.add(this.scannerGroup);

    const scanGreyMat = new THREE.MeshStandardMaterial({
      color: 0x7c848e, // Rugged 1990 industrial slate-grey casing (sober, zero neon)
      roughness: 0.54,
      metalness: 0.14,
    });
    const scanBumperMat = new THREE.MeshStandardMaterial({
      color: 0x2f353d,
      roughness: 0.8,
      metalness: 0.08,
    });
    this.scannerEmitterMat = new THREE.MeshStandardMaterial({
      color: 0x450a0a,
      emissive: 0x991b1b,
      emissiveIntensity: 0.38,
      roughness: 0.22,
    });
    this.scannerStatusLedMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x16a34a,
      emissiveIntensity: 0.3,
      roughness: 0.35,
    });
    ctx.disposables.push(
      scanGreyMat,
      scanBumperMat,
      this.scannerEmitterMat,
      this.scannerStatusLedMat
    );

    // Main ruggedized industrial chassis + top optical head + rubber side guards
    const scChassis = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.21, 0.042), scanGreyMat);
    scChassis.position.set(0, -0.01, 0);

    const scBumperL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.214, 0.046), scanBumperMat);
    scBumperL.position.set(-0.062, -0.01, 0);
    const scBumperR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.214, 0.046), scanBumperMat);
    scBumperR.position.set(0.062, -0.01, 0);
    const scTopCap = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.034, 0.052), scanBumperMat);
    scTopCap.position.set(0, 0.105, -0.004);
    const scBotCap = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.018, 0.046), scanBumperMat);
    scBotCap.position.set(0, -0.118, 0);

    // Top-forward optical red laser emitter window (facing -Z toward store shelves!)
    this.scannerEmitterWin = new THREE.Mesh(
      new THREE.PlaneGeometry(0.072, 0.02),
      this.scannerEmitterMat
    );
    this.scannerEmitterWin.rotation.y = Math.PI;
    this.scannerEmitterWin.position.set(0, 0.106, -0.031);

    // Small sober status LED dot above LCD
    const scLed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0038, 0.0038, 0.004, 10),
      this.scannerStatusLedMat
    );
    scLed.rotation.x = Math.PI / 2;
    scLed.position.set(0.044, 0.083, 0.022);

    // Printed 1990 nameplate strip
    const scBrandCanvas = document.createElement('canvas');
    scBrandCanvas.width = 512;
    scBrandCanvas.height = 64;
    {
      const bc = scBrandCanvas.getContext('2d')!;
      bc.fillStyle = '#252a30';
      bc.fillRect(0, 0, 512, 64);
      bc.fillStyle = '#e2e8f0';
      bc.font = '800 26px "JetBrains Mono", monospace';
      bc.textAlign = 'left';
      bc.textBaseline = 'middle';
      bc.fillText('TERMINAL SCAN 90', 18, 33);
      bc.fillStyle = '#fde68a';
      bc.textAlign = 'right';
      bc.fillText('LASER EAN', 494, 33);
    }
    const scBrandTex = new THREE.CanvasTexture(scBrandCanvas);
    scBrandTex.colorSpace = THREE.SRGBColorSpace;
    scBrandTex.anisotropy = ctx.maxAnisotropy;
    const scBrandMat = new THREE.MeshStandardMaterial({ map: scBrandTex, roughness: 0.55 });
    const scBrandStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.102, 0.013), scBrandMat);
    scBrandStrip.position.set(-0.005, 0.083, 0.0222);

    // Recessed Monochrome LCD Screen (sharp-cornered rectangle)
    const scLcdBezel = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.068, 0.009), darkTrimMat);
    scLcdBezel.position.set(0, 0.037, 0.019);

    this.scannerLcdCanvas = document.createElement('canvas');
    this.scannerLcdCanvas.width = 512;
    this.scannerLcdCanvas.height = 256;
    this.scannerLcdTex = new THREE.CanvasTexture(this.scannerLcdCanvas);
    this.scannerLcdTex.colorSpace = THREE.SRGBColorSpace;
    this.scannerLcdTex.anisotropy = ctx.maxAnisotropy;
    const scLcdMat = new THREE.MeshStandardMaterial({
      map: this.scannerLcdTex,
      emissiveMap: this.scannerLcdTex,
      emissive: 0xcbe0d2,
      emissiveIntensity: 0.42,
      roughness: 0.28,
      metalness: 0.04,
    });
    const scLcdPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.098, 0.056), scLcdMat);
    scLcdPlane.position.set(0, 0.037, 0.0248);

    // Recessed Button Well below LCD
    const scBtnWell = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.092, 0.006), keypadWellMat);
    scBtnWell.position.set(0, -0.054, 0.0205);

    this.scannerGroup.add(
      scChassis,
      scBumperL,
      scBumperR,
      scTopCap,
      scBotCap,
      this.scannerEmitterWin,
      scLed,
      scBrandStrip,
      scLcdBezel,
      scLcdPlane,
      scBtnWell
    );
    ctx.disposables.push(
      scChassis.geometry,
      scBumperL.geometry,
      scBumperR.geometry,
      scTopCap.geometry,
      scBotCap.geometry,
      this.scannerEmitterWin.geometry,
      scLed.geometry,
      scBrandTex,
      scBrandMat,
      scBrandStrip.geometry,
      scLcdBezel.geometry,
      this.scannerLcdTex,
      scLcdMat,
      scLcdPlane.geometry,
      scBtnWell.geometry
    );

    // Two Large Raised Clickable 3D Buttons on Terminal Scan 1990:
    // 1) Yellow [SCAN] trigger button   2) Blue [TRANSFERT ÉTIQ.] button
    const scannerBtnSpecs: Array<{
      code: 'SCAN' | 'TRANSFERT';
      legend: string;
      displayName: string;
      bgHex: string;
      sideColor: number;
      textHex: string;
      y: number;
      w: number;
      h: number;
    }> = [
      {
        code: 'SCAN',
        legend: 'SCAN LASER',
        displayName: 'SCANNER CODE-BARRES',
        bgHex: '#ca8a04',
        sideColor: 0x854d0e,
        textHex: '#0f172a',
        y: -0.031,
        w: 0.088,
        h: 0.034,
      },
      {
        code: 'TRANSFERT',
        legend: 'TRANSFERT ÉTIQ.',
        displayName: 'TRANSFERT ÉTIQUETEUSE',
        bgHex: '#1d4ed8',
        sideColor: 0x1e3a8a,
        textHex: '#f8fafc',
        y: -0.075,
        w: 0.088,
        h: 0.032,
      },
    ];

    const scRestZ = 0.029;
    for (const sbtn of scannerBtnSpecs) {
      const btnGeo = new THREE.BoxGeometry(sbtn.w, sbtn.h, 0.013);
      const btnHitGeo = new THREE.BoxGeometry(sbtn.w + 0.012, sbtn.h + 0.008, 0.022);
      const btnTex = createRubberKeyTexture(
        sbtn.legend,
        sbtn.bgHex,
        sbtn.textHex,
        ctx.maxAnisotropy,
        320,
        112
      );
      const sideMat = new THREE.MeshStandardMaterial({
        color: sbtn.sideColor,
        roughness: 0.72,
        metalness: 0.06,
      });
      const baseEmissive = 0.16;
      const frontMat = new THREE.MeshStandardMaterial({
        map: btnTex,
        emissiveMap: btnTex,
        emissive: 0xffffff,
        emissiveIntensity: baseEmissive,
        roughness: 0.62,
        metalness: 0.05,
      });

      const btnMesh = new THREE.Mesh(btnGeo, [
        sideMat,
        sideMat,
        sideMat,
        sideMat,
        frontMat,
        sideMat,
      ]);
      btnMesh.position.set(0, sbtn.y, scRestZ);

      const hitMesh = new THREE.Mesh(btnHitGeo, hitProxyMat);
      hitMesh.position.set(0, sbtn.y, scRestZ + 0.003);
      hitMesh.userData.labelerAction = {
        kind: 'scanner_btn',
        code: sbtn.code,
        displayName: sbtn.displayName,
      } as LabelerRayHit;

      this.scannerGroup.add(btnMesh, hitMesh);
      this.scannerKeyHitMeshes.push(hitMesh);
      this.scannerKeys.push({
        code: sbtn.code,
        displayName: sbtn.displayName,
        mesh: btnMesh,
        hitMesh,
        frontMat,
        restZ: scRestZ,
        pressAnim: 0,
        baseEmissive,
      });

      ctx.disposables.push(btnGeo, btnHitGeo, btnTex, sideMat, frontMat);
    }

    // World-space animated 3D red laser scan beam (reused, zero GC!)
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0xdc2626,
      transparent: true,
      opacity: 0.85,
    });
    const laserGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 1.0, 6);
    laserGeo.rotateX(Math.PI / 2);
    this.scannerLaserMesh = new THREE.Mesh(laserGeo, laserMat);
    this.scannerLaserMesh.visible = false;
    ctx.scene.add(this.scannerLaserMesh);
    ctx.disposables.push(laserMat, laserGeo);

    // ========================================================================
    // 1C. 1990 HANDHELD STORE ORDERING TERMINAL ("TERMINAL COMMANDE 1990") — 100% 3D
    //     Telxon / MSI industrial style with acoustic coupler cap + 6 clickable 3D keys
    // ========================================================================
    this.ordererGroup = new THREE.Group();
    this.ordererGroup.position.set(0.26, -0.23, -0.45);
    this.ordererGroup.rotation.set(0.15, -0.24, 0.03);
    this.ordererGroup.visible = false;
    this.rootGroup.add(this.ordererGroup);

    const ordChassis = new THREE.Mesh(new THREE.BoxGeometry(0.138, 0.214, 0.042), bodyMat);
    ordChassis.position.set(0, -0.012, 0);
    const ordGripL = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.2, 0.045), darkTrimMat);
    ordGripL.position.set(-0.071, -0.012, 0);
    const ordGripR = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.2, 0.045), darkTrimMat);
    ordGripR.position.set(0.071, -0.012, 0);
    // Acoustic modem coupler cap on top edge
    const ordCoupler = new THREE.Mesh(new THREE.BoxGeometry(0.128, 0.026, 0.046), darkTrimMat);
    ordCoupler.position.set(0, 0.104, -0.002);

    this.ordererModemLedMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      emissive: 0x16a34a,
      emissiveIntensity: 0.3,
      roughness: 0.32,
    });
    const ordLed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.004, 10),
      this.ordererModemLedMat
    );
    ordLed.rotation.x = Math.PI / 2;
    ordLed.position.set(0.052, 0.084, 0.022);

    const ordBrandCanvas = document.createElement('canvas');
    ordBrandCanvas.width = 512;
    ordBrandCanvas.height = 64;
    {
      const bc = ordBrandCanvas.getContext('2d')!;
      bc.fillStyle = '#252a30';
      bc.fillRect(0, 0, 512, 64);
      bc.fillStyle = '#e2e8f0';
      bc.font = '800 24px "JetBrains Mono", monospace';
      bc.textAlign = 'left';
      bc.textBaseline = 'middle';
      bc.fillText('TERMINAL COMMANDE 90', 16, 33);
      bc.fillStyle = '#fde68a';
      bc.textAlign = 'right';
      bc.fillText('MODEM v2.1', 494, 33);
    }
    const ordBrandTex = new THREE.CanvasTexture(ordBrandCanvas);
    ordBrandTex.colorSpace = THREE.SRGBColorSpace;
    ordBrandTex.anisotropy = ctx.maxAnisotropy;
    const ordBrandMat = new THREE.MeshStandardMaterial({ map: ordBrandTex, roughness: 0.55 });
    const ordBrandStrip = new THREE.Mesh(new THREE.PlaneGeometry(0.114, 0.013), ordBrandMat);
    ordBrandStrip.position.set(-0.006, 0.084, 0.0222);

    const ordLcdBezel = new THREE.Mesh(new THREE.BoxGeometry(0.124, 0.078, 0.009), darkTrimMat);
    ordLcdBezel.position.set(0, 0.036, 0.019);

    this.ordererLcdCanvas = document.createElement('canvas');
    this.ordererLcdCanvas.width = 512;
    this.ordererLcdCanvas.height = 320;
    this.orderModel.drawLcd(this.ordererLcdCanvas);
    this.ordererLcdTex = new THREE.CanvasTexture(this.ordererLcdCanvas);
    this.ordererLcdTex.colorSpace = THREE.SRGBColorSpace;
    this.ordererLcdTex.anisotropy = ctx.maxAnisotropy;
    const ordLcdMat = new THREE.MeshStandardMaterial({
      map: this.ordererLcdTex,
      emissiveMap: this.ordererLcdTex,
      emissive: 0xcbe0b8,
      emissiveIntensity: 0.42,
      roughness: 0.28,
      metalness: 0.04,
    });
    const ordLcdPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.114, 0.068), ordLcdMat);
    ordLcdPlane.position.set(0, 0.036, 0.0248);

    const ordKeyWell = new THREE.Mesh(new THREE.BoxGeometry(0.122, 0.098, 0.006), keypadWellMat);
    ordKeyWell.position.set(0, -0.06, 0.0205);

    this.ordererGroup.add(
      ordChassis,
      ordGripL,
      ordGripR,
      ordCoupler,
      ordLed,
      ordBrandStrip,
      ordLcdBezel,
      ordLcdPlane,
      ordKeyWell
    );
    ctx.disposables.push(
      ordChassis.geometry,
      ordGripL.geometry,
      ordGripR.geometry,
      ordCoupler.geometry,
      this.ordererModemLedMat,
      ordLed.geometry,
      ordBrandTex,
      ordBrandMat,
      ordBrandStrip.geometry,
      ordLcdBezel.geometry,
      this.ordererLcdTex,
      ordLcdMat,
      ordLcdPlane.geometry,
      ordKeyWell.geometry
    );

    // Synchronize handheld LCD automatically whenever docked OR handheld terminal updates
    this.orderModel.onChange(() => {
      this.orderModel.drawLcd(this.ordererLcdCanvas);
      this.ordererLcdTex.needsUpdate = true;
      this.onChanged();
    });
    this.orderModel.onTransmitOrder(() => {
      this.ordererModemFlash = 1.2;
    });

    const ordBtnSpecs: Array<{
      code: OrderTerminalKeyCode;
      legend: string;
      displayName: string;
      bgHex: string;
      sideColor: number;
      textHex: string;
      x: number;
      y: number;
    }> = [
      { code: 'HAUT', legend: '▲ HAUT', displayName: 'HAUT (Catalogue)', bgHex: '#3f4752', sideColor: 0x262c34, textHex: '#f8fafc', x: -0.038, y: -0.036 },
      { code: 'QTE+', legend: 'QTÉ +', displayName: 'QTÉ + (+1 carton)', bgHex: '#1d4ed8', sideColor: 0x1e3a8a, textHex: '#fef08a', x: 0.0, y: -0.036 },
      { code: 'VALIDER', legend: 'VALID.', displayName: 'VALIDER (Ligne)', bgHex: '#0f766e', sideColor: 0x115e59, textHex: '#f0fdfa', x: 0.038, y: -0.036 },
      { code: 'BAS', legend: '▼ BAS', displayName: 'BAS (Catalogue)', bgHex: '#3f4752', sideColor: 0x262c34, textHex: '#f8fafc', x: -0.038, y: -0.082 },
      { code: 'QTE-', legend: 'QTÉ -', displayName: 'QTÉ - (-1 carton)', bgHex: '#991b1b', sideColor: 0x701414, textHex: '#fef2f2', x: 0.0, y: -0.082 },
      { code: 'TRANSMETTRE', legend: 'TRANSM.', displayName: 'TRANSMETTRE (Modem)', bgHex: '#15803d', sideColor: 0x105e2d, textHex: '#f0fdf4', x: 0.038, y: -0.082 },
    ];

    const ordKeyGeo = new THREE.BoxGeometry(0.034, 0.034, 0.012);
    const ordKeyHitGeo = new THREE.BoxGeometry(0.037, 0.038, 0.02);
    ctx.disposables.push(ordKeyGeo, ordKeyHitGeo);
    const ordRestZ = 0.0285;

    for (const ob of ordBtnSpecs) {
      const kTex = createRubberKeyTexture(ob.legend, ob.bgHex, ob.textHex, ctx.maxAnisotropy, 180, 128);
      const sideMat = new THREE.MeshStandardMaterial({
        color: ob.sideColor,
        roughness: 0.74,
        metalness: 0.05,
      });
      const baseEmissive = 0.16;
      const frontMat = new THREE.MeshStandardMaterial({
        map: kTex,
        emissiveMap: kTex,
        emissive: 0xffffff,
        emissiveIntensity: baseEmissive,
        roughness: 0.64,
        metalness: 0.05,
      });
      const btnMesh = new THREE.Mesh(ordKeyGeo, [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]);
      btnMesh.position.set(ob.x, ob.y, ordRestZ);

      const hitMesh = new THREE.Mesh(ordKeyHitGeo, hitProxyMat);
      hitMesh.position.set(ob.x, ob.y, ordRestZ + 0.003);
      hitMesh.userData.labelerAction = {
        kind: 'orderer_btn',
        code: ob.code,
        displayName: ob.displayName,
      } as LabelerRayHit;

      this.ordererGroup.add(btnMesh, hitMesh);
      this.ordererKeyHitMeshes.push(hitMesh);
      this.ordererKeys.push({
        code: ob.code,
        displayName: ob.displayName,
        mesh: btnMesh,
        hitMesh,
        frontMat,
        restZ: ordRestZ,
        pressAnim: 0,
        baseEmissive,
      });

      ctx.disposables.push(kTex, sideMat, frontMat);
    }

    // ========================================================================
    // 2. RETRACTABLE UTILITY KNIFE ("CUTTER") 3D VIEWMODEL
    // ========================================================================
    this.cutterGroup = new THREE.Group();
    this.cutterGroup.position.set(0.27, -0.24, -0.44);
    this.cutterGroup.rotation.set(0.18, -0.35, 0.14);
    this.cutterGroup.visible = false;
    this.rootGroup.add(this.cutterGroup);

    const cutterYellowMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.45,
      metalness: 0.1,
    });
    const bladeSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.18,
      metalness: 0.92,
    });
    ctx.disposables.push(cutterYellowMat, bladeSteelMat);

    const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.022, 0.155), cutterYellowMat);
    const cGrip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.016, 0.085), darkTrimMat);
    cGrip.position.set(0, 0, 0.022);
    const cSlider = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.028), darkTrimMat);
    cSlider.position.set(0, 0.015, -0.022);
    const cRail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.018, 0.052), bladeSteelMat);
    cRail.position.set(0, 0, -0.088);
    const cBlade = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.015, 0.048), bladeSteelMat);
    cBlade.position.set(0, 0, -0.125);
    this.cutterGroup.add(cBody, cGrip, cSlider, cRail, cBlade);
    ctx.disposables.push(
      cBody.geometry,
      cGrip.geometry,
      cSlider.geometry,
      cRail.geometry,
      cBlade.geometry
    );

    // ========================================================================
    // 3. CARRIED 3D PROPS VIEWMODEL (WHEN activeTool === 'hands')
    // ========================================================================
    this.heldPropGroup = new THREE.Group();
    this.heldPropGroup.position.set(0.28, -0.25, -0.46);
    this.heldPropGroup.visible = false;
    this.rootGroup.add(this.heldPropGroup);

    this.heldLabelCanvas = document.createElement('canvas');
    this.heldLabelCanvas.width = 512;
    this.heldLabelCanvas.height = 220;
    drawPriceTagCanvas(
      this.heldLabelCanvas,
      PRODUCT_CATALOG[0].shortName,
      PRODUCT_CATALOG[0].priceText,
      PRODUCT_CATALOG[0].ean
    );
    this.heldLabelTex = new THREE.CanvasTexture(this.heldLabelCanvas);
    this.heldLabelTex.colorSpace = THREE.SRGBColorSpace;
    this.heldLabelTex.anisotropy = ctx.maxAnisotropy;
    const heldLabelMat = new THREE.MeshStandardMaterial({
      map: this.heldLabelTex,
      roughness: 0.72,
      side: THREE.DoubleSide,
    });
    const heldLabelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.145, 0.064), heldLabelMat);
    heldLabelMesh.rotation.set(-0.08, -0.22, 0.03);
    this.heldMeshes.price_label = heldLabelMesh;
    this.heldPropGroup.add(heldLabelMesh);
    ctx.disposables.push(this.heldLabelTex, heldLabelMat, heldLabelMesh.geometry);

    // Held 3D Translucent Extruded Plastic Price Rail ("Réglette Plastique 120cm")
    {
      const railHeldGrp = new THREE.Group();
      const heldBackMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        roughness: 0.42,
        metalness: 0.06,
      });
      const heldLipMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.34,
        metalness: 0.2,
      });
      const heldClearMat = new THREE.MeshStandardMaterial({
        color: 0xdcf4ff,
        transparent: true,
        opacity: 0.42,
        roughness: 0.12,
        metalness: 0.1,
        depthWrite: false,
      });
      const rLen = 0.52;
      const rBack = new THREE.Mesh(new THREE.BoxGeometry(rLen, 0.044, 0.006), heldBackMat);
      const rTop = new THREE.Mesh(new THREE.BoxGeometry(rLen, 0.005, 0.013), heldLipMat);
      rTop.position.set(0, 0.021, 0.005);
      const rBot = new THREE.Mesh(new THREE.BoxGeometry(rLen, 0.005, 0.013), heldLipMat);
      rBot.position.set(0, -0.021, 0.005);
      const rFront = new THREE.Mesh(new THREE.BoxGeometry(rLen, 0.042, 0.0025), heldClearMat);
      rFront.position.set(0, 0, 0.011);

      railHeldGrp.add(rBack, rTop, rBot, rFront);
      railHeldGrp.position.set(-0.18, 0.01, -0.04);
      railHeldGrp.rotation.set(0.24, -0.34, 0.18);
      this.heldMeshes.plastic_price_rail = railHeldGrp;
      ctx.disposables.push(
        heldBackMat,
        heldLipMat,
        heldClearMat,
        rBack.geometry,
        rTop.geometry,
        rBot.geometry,
        rFront.geometry
      );
    }

    // Held 3D Carryable Shipping Carton (closed or opened non-empty box carried between pallets & racks)
    {
      const cartonHeldGrp = new THREE.Group();
      const cbMat = new THREE.MeshStandardMaterial({ color: 0xbc9063, roughness: 0.86 });
      const tapeHeldMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.48 });
      const lblHeldMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
      const barHeldMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
      const boxBody = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.24), cbMat);
      const tapeStrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.244), tapeHeldMat);
      tapeStrip.position.set(0, 0.102, 0);
      const lblPatch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.085, 0.004), lblHeldMat);
      lblPatch.position.set(0, 0.01, 0.122);
      const barStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.005), barHeldMat);
      barStripe.position.set(0, -0.012, 0.123);
      cartonHeldGrp.add(boxBody, tapeStrip, lblPatch, barStripe);
      cartonHeldGrp.position.set(-0.08, -0.06, -0.05);
      cartonHeldGrp.rotation.set(0.14, -0.32, 0.04);
      this.heldMeshes.shipping_carton = cartonHeldGrp;
      ctx.disposables.push(
        cbMat,
        tapeHeldMat,
        lblHeldMat,
        barHeldMat,
        boxBody.geometry,
        tapeStrip.geometry,
        lblPatch.geometry,
        barStripe.geometry
      );
    }

    // Held 3D Empty Open-Flap Cardboard Box (ready for Hydraulic Cardboard Baler or Rack)
    {
      const emptyBoxGrp = new THREE.Group();
      const cbMat = new THREE.MeshStandardMaterial({ color: 0xb78b5e, roughness: 0.88 });
      const cbDarkMat = new THREE.MeshStandardMaterial({ color: 0x6b4b2c, roughness: 0.92 });
      const bw = 0.27;
      const bh = 0.18;
      const bd = 0.23;
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.012, bd), cbMat);
      bottom.position.y = -bh / 2 + 0.006;
      const wallF = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.012), cbMat);
      wallF.position.set(0, 0, bd / 2 - 0.006);
      const wallB = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.012), cbMat);
      wallB.position.set(0, 0, -bd / 2 + 0.006);
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.012, bh, bd - 0.02), cbMat);
      wallL.position.set(-bw / 2 + 0.006, 0, 0);
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.012, bh, bd - 0.02), cbMat);
      wallR.position.set(bw / 2 - 0.006, 0, 0);
      const innerShadow = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.026, 0.01, bd - 0.026), cbDarkMat);
      innerShadow.position.y = -bh / 2 + 0.016;
      // Flared open flaps
      const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.01, bd - 0.01), cbMat);
      flapL.position.set(-bw / 2 - 0.035, bh / 2 + 0.025, 0);
      flapL.rotation.z = -0.68;
      const flapR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.01, bd - 0.01), cbMat);
      flapR.position.set(bw / 2 + 0.035, bh / 2 + 0.025, 0);
      flapR.rotation.z = 0.68;
      emptyBoxGrp.add(bottom, wallF, wallB, wallL, wallR, innerShadow, flapL, flapR);
      emptyBoxGrp.position.set(-0.08, -0.06, -0.05);
      emptyBoxGrp.rotation.set(0.18, -0.34, 0.04);
      this.heldMeshes.empty_carton = emptyBoxGrp;
      ctx.disposables.push(
        cbMat,
        cbDarkMat,
        bottom.geometry,
        wallF.geometry,
        wallB.geometry,
        wallL.geometry,
        wallR.geometry,
        innerShadow.geometry,
        flapL.geometry,
        flapR.geometry
      );
    }

    const makeKibbleHeld = (w: number, h: number, d: number, color: number) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
      const g = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(g, m);
      mesh.rotation.y = -0.35;
      ctx.disposables.push(m, g);
      return mesh;
    };

    this.heldMeshes.kibble_large_dog = makeKibbleHeld(0.18, 0.24, 0.1, 0x1d4ed8);
    this.heldMeshes.kibble_large_cat = makeKibbleHeld(0.18, 0.24, 0.1, 0xea580c);
    this.heldMeshes.kibble_med_dog = makeKibbleHeld(0.14, 0.19, 0.08, 0x2563eb);
    this.heldMeshes.kibble_med_cat = makeKibbleHeld(0.14, 0.19, 0.08, 0xf97316);
    this.heldMeshes.kibble_small_dog = makeKibbleHeld(0.11, 0.15, 0.06, 0x3b82f6);
    this.heldMeshes.kibble_small_cat = makeKibbleHeld(0.11, 0.15, 0.06, 0xfb923c);

    const makeHeldTray = (canColor: number) => {
      const grp = new THREE.Group();
      const cbMat = new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.85 });
      const canMat = new THREE.MeshStandardMaterial({ color: canColor, roughness: 0.35, metalness: 0.45 });
      const trayBox = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.24), cbMat);
      grp.add(trayBox);
      const canGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.055, 10);
      for (let iz = -0.075; iz <= 0.08; iz += 0.052) {
        const c1 = new THREE.Mesh(canGeo, canMat);
        c1.position.set(-0.026, 0.032, iz);
        const c2 = new THREE.Mesh(canGeo, canMat);
        c2.position.set(0.026, 0.032, iz);
        grp.add(c1, c2);
      }
      grp.rotation.set(0.18, -0.3, 0);
      ctx.disposables.push(cbMat, canMat, trayBox.geometry, canGeo);
      return grp;
    };
    this.heldMeshes.wet_tray_dog = makeHeldTray(0x1d4ed8);
    this.heldMeshes.wet_tray_cat = makeHeldTray(0xd97706);

    const makeHeldCan = (color: number, isFoil: boolean) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.55 });
      const g = isFoil
        ? new THREE.BoxGeometry(0.082, 0.032, 0.082)
        : new THREE.CylinderGeometry(0.038, 0.038, 0.095, 14);
      const mesh = new THREE.Mesh(g, m);
      ctx.disposables.push(m, g);
      return mesh;
    };
    this.heldMeshes.wet_can_dog = makeHeldCan(0x1e40af, false);
    this.heldMeshes.wet_can_cat = makeHeldCan(0xd97706, true);

    // Held Pet Toys
    const tennisMat = new THREE.MeshStandardMaterial({ color: 0xd9f99d, roughness: 0.92 });
    const tennisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), tennisMat);
    this.heldMeshes.toy_tennis = tennisMesh;
    ctx.disposables.push(tennisMat, tennisMesh.geometry);

    const squeakyGroup = new THREE.Group();
    const sqMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.52 });
    const sqCore = new THREE.Mesh(new THREE.SphereGeometry(0.044, 14, 12), sqMat);
    squeakyGroup.add(sqCore);
    const nubGeo = new THREE.ConeGeometry(0.009, 0.018, 6);
    const dirs = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
      [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, 0.7, -0.7],
    ];
    dirs.forEach(([dx, dy, dz]) => {
      const nub = new THREE.Mesh(nubGeo, sqMat);
      nub.position.set(dx * 0.044, dy * 0.044, dz * 0.044);
      nub.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(dx, dy, dz).normalize()
      );
      squeakyGroup.add(nub);
    });
    this.heldMeshes.toy_squeaky = squeakyGroup;
    ctx.disposables.push(sqMat, sqCore.geometry, nubGeo);

    const catBallMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 });
    const catBallMesh = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 12), catBallMat);
    const bellBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.036, 0.005, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.7 })
    );
    catBallMesh.add(bellBand);
    this.heldMeshes.toy_cat_bell = catBallMesh;
    ctx.disposables.push(
      catBallMat,
      catBallMesh.geometry,
      bellBand.geometry,
      bellBand.material as THREE.Material
    );

    // V25 Manager's Office Filing Cabinet Supplies (Held Viewmodels)
    {
      // 1) Spare Thermal Label Roll ("Rouleau Étiquettes 1990")
      const rollGrp = new THREE.Group();
      const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x92643d, roughness: 0.9 });
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 });
      const outerRoll = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.056, 20), paperMat);
      outerRoll.rotation.z = Math.PI / 2;
      const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.059, 14), coreMat);
      innerCore.rotation.z = Math.PI / 2;
      const labelTail = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.004, 0.078), paperMat);
      labelTail.position.set(0, -0.044, 0.036);
      const labelStripe = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.005, 0.016), stripeMat);
      labelStripe.position.set(0, -0.043, 0.052);
      rollGrp.add(outerRoll, innerCore, labelTail, labelStripe);
      rollGrp.rotation.set(0.25, -0.35, 0.12);
      this.heldMeshes.office_label_roll = rollGrp;
      ctx.disposables.push(
        paperMat,
        coreMat,
        stripeMat,
        outerRoll.geometry,
        innerCore.geometry,
        labelTail.geometry,
        labelStripe.geometry
      );

      // 2) 1990 Supplier Invoices Binder ("Classeur Factures Fournisseurs 1990")
      const binderGrp = new THREE.Group();
      const coverMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.62 });
      const spineLblMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
      const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.85 });
      const ringMetalMat = new THREE.MeshStandardMaterial({
        color: 0xdbe2ea,
        roughness: 0.25,
        metalness: 0.85,
      });
      const coverFront = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.008, 0.27), coverMat);
      coverFront.position.y = 0.026;
      const coverBack = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.008, 0.27), coverMat);
      coverBack.position.y = -0.026;
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.27), coverMat);
      spine.position.x = -0.102;
      const pages = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.044, 0.255), pagesMat);
      pages.position.x = 0.004;
      const spineLabel = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.042, 0.12), spineLblMat);
      spineLabel.position.set(-0.108, 0, -0.02);
      const pullRing = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 8, 14), ringMetalMat);
      pullRing.rotation.y = Math.PI / 2;
      pullRing.position.set(-0.108, 0, 0.085);
      binderGrp.add(coverFront, coverBack, spine, pages, spineLabel, pullRing);
      binderGrp.rotation.set(0.32, -0.28, 0.06);
      this.heldMeshes.office_invoice_binder = binderGrp;
      ctx.disposables.push(
        coverMat,
        spineLblMat,
        pagesMat,
        ringMetalMat,
        coverFront.geometry,
        coverBack.geometry,
        spine.geometry,
        pages.geometry,
        spineLabel.geometry,
        pullRing.geometry
      );
    }

    // Held Hygiene, Beauty & Cleaning 3D Props (Rayon 9)
    {
      // 1) Lessive Liquide Bidon 3L
      const jug = new THREE.Group();
      const jMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.42 });
      const jCapMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36 });
      const jBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.21, 0.085), jMat);
      const jCap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.032, 10), jCapMat);
      jCap.position.set(-0.032, 0.12, 0);
      const jHandle = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.085, 0.024), jMat);
      jHandle.position.set(0.076, 0.02, 0);
      jug.add(jBody, jCap, jHandle);
      jug.rotation.y = -0.32;
      this.heldMeshes.hyg_lessive_3l = jug;
      ctx.disposables.push(jMat, jCapMat, jBody.geometry, jCap.geometry, jHandle.geometry);

      // 2) Papier Toilette Pack x6
      const tp = new THREE.Group();
      const tpMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.6 });
      const tpRollMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 });
      const tpBox = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.16, 0.1), tpMat);
      const tpRollGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.015, 10);
      tp.add(tpBox);
      [-0.062, 0, 0.062].forEach((rx) => {
        const r = new THREE.Mesh(tpRollGeo, tpRollMat);
        r.position.set(rx, 0.086, 0);
        tp.add(r);
      });
      tp.rotation.y = -0.32;
      this.heldMeshes.hyg_tp_pack = tp;
      ctx.disposables.push(tpMat, tpRollMat, tpBox.geometry, tpRollGeo);

      // 3) Shampoing Doux Flacon 400ml
      const sh = new THREE.Group();
      const shMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.36 });
      const shCapMat = new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.32 });
      const shBody = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.165, 0.048), shMat);
      const shCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.028, 10), shCapMat);
      shCap.position.y = 0.095;
      sh.add(shBody, shCap);
      sh.rotation.y = -0.25;
      this.heldMeshes.hyg_shampoing = sh;
      ctx.disposables.push(shMat, shCapMat, shBody.geometry, shCap.geometry);

      // 4) Gel Douche Fraîcheur
      const gd = new THREE.Group();
      const gdMat = new THREE.MeshStandardMaterial({ color: 0x14b8a6, roughness: 0.34 });
      const gdCapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 });
      const gdBody = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.158, 0.046), gdMat);
      const gdCap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.024, 0.03), gdCapMat);
      gdCap.position.y = 0.09;
      gd.add(gdBody, gdCap);
      gd.rotation.y = -0.25;
      this.heldMeshes.hyg_gel_douche = gd;
      ctx.disposables.push(gdMat, gdCapMat, gdBody.geometry, gdCap.geometry);

      // 5) Dentifrice Menthe Carton PAV x12
      const pav = new THREE.Group();
      const cbMat = new THREE.MeshStandardMaterial({ color: 0xb68d65, roughness: 0.85 });
      const dpMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.48 });
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.065, 0.24), cbMat);
      const dBoxGeo = new THREE.BoxGeometry(0.04, 0.032, 0.1);
      pav.add(tray);
      [-0.055, 0, 0.055].forEach((bx) => {
        const b1 = new THREE.Mesh(dBoxGeo, dpMat);
        b1.position.set(bx, 0.042, -0.055);
        const b2 = new THREE.Mesh(dBoxGeo, dpMat);
        b2.position.set(bx, 0.042, 0.055);
        pav.add(b1, b2);
      });
      pav.rotation.set(0.18, -0.28, 0);
      this.heldMeshes.hyg_dentifrice_pav = pav;
      ctx.disposables.push(cbMat, dpMat, tray.geometry, dBoxGeo);

      // 6) Individual Toothpaste Carton Box
      const dtMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.46 });
      const dtMesh = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.038, 0.135), dtMat);
      dtMesh.rotation.set(0.12, -0.35, 0.06);
      this.heldMeshes.hyg_dentifrice_box = dtMesh;
      ctx.disposables.push(dtMat, dtMesh.geometry);
    }

    // Held Bakery & Viennoiserie 3D Props (Rayon 2 — Point Chaud 1990)
    {
      const rawMat = new THREE.MeshStandardMaterial({ color: 0xf3e5ab, roughness: 0.84 });
      const bakedCrustMat = new THREE.MeshStandardMaterial({ color: 0xc67d2e, roughness: 0.6 });
      const scoreMat = new THREE.MeshStandardMaterial({ color: 0xe6b56c, roughness: 0.72 });
      const pastryMat = new THREE.MeshStandardMaterial({ color: 0xd98a2b, roughness: 0.44 });
      const chocMat = new THREE.MeshStandardMaterial({ color: 0x3b1f14, roughness: 0.52 });
      const bagClearMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.34,
        roughness: 0.16,
        depthWrite: false,
      });
      const kraftBandMat = new THREE.MeshStandardMaterial({ color: 0xd6b485, roughness: 0.84 });
      const sliceDarkMat = new THREE.MeshStandardMaterial({ color: 0x7c4a1a, roughness: 0.78 });

      const bagRawGeo = new THREE.CapsuleGeometry(0.022, 0.25, 5, 10);
      bagRawGeo.rotateX(Math.PI / 2);
      const bagBakedGeo = new THREE.CapsuleGeometry(0.028, 0.29, 5, 10);
      bagBakedGeo.rotateX(Math.PI / 2);
      const scoreGeo = new THREE.BoxGeometry(0.03, 0.007, 0.036);
      const croisGeo = new THREE.TorusGeometry(0.038, 0.018, 7, 12, Math.PI * 1.18);
      croisGeo.rotateX(Math.PI / 2);
      const croisMidGeo = new THREE.SphereGeometry(0.022, 8, 8);
      const painGeo = new THREE.BoxGeometry(0.085, 0.042, 0.068);
      const barGeo = new THREE.BoxGeometry(0.088, 0.011, 0.011);
      const brioLobeGeo = new THREE.SphereGeometry(0.04, 8, 8);

      ctx.disposables.push(
        rawMat,
        bakedCrustMat,
        scoreMat,
        pastryMat,
        chocMat,
        bagClearMat,
        kraftBandMat,
        sliceDarkMat,
        bagRawGeo,
        bagBakedGeo,
        scoreGeo,
        croisGeo,
        croisMidGeo,
        painGeo,
        barGeo,
        brioLobeGeo
      );

      // 1) Raw pale baguette dough
      const bagRaw = new THREE.Mesh(bagRawGeo, rawMat);
      bagRaw.rotation.set(0.18, -0.32, 0.08);
      this.heldMeshes.baguette_raw = bagRaw;

      // 2) Raw pale croissant dough
      const crRaw = new THREE.Group();
      const crRawArc = new THREE.Mesh(croisGeo, rawMat);
      const crRawMid = new THREE.Mesh(croisMidGeo, rawMat);
      crRawMid.position.set(0, 0.004, -0.022);
      crRaw.add(crRawArc, crRawMid);
      crRaw.scale.setScalar(0.88);
      crRaw.rotation.set(0.32, -0.25, 0);
      this.heldMeshes.croissant_raw = crRaw;

      // 3) Raw pale pain au chocolat dough
      const pcRaw = new THREE.Group();
      const pcRawB = new THREE.Mesh(painGeo, rawMat);
      const pcRawC1 = new THREE.Mesh(barGeo, chocMat);
      pcRawC1.position.set(0, 0, -0.016);
      const pcRawC2 = new THREE.Mesh(barGeo, chocMat);
      pcRawC2.position.set(0, 0, 0.016);
      pcRaw.add(pcRawB, pcRawC1, pcRawC2);
      pcRaw.scale.setScalar(0.88);
      pcRaw.rotation.set(0.28, -0.32, 0);
      this.heldMeshes.pain_choc_raw = pcRaw;

      // 4) Baked golden baguette
      const bagBaked = new THREE.Group();
      const bbBody = new THREE.Mesh(bagBakedGeo, bakedCrustMat);
      bagBaked.add(bbBody);
      [-0.08, 0, 0.08].forEach((sz) => {
        const sc = new THREE.Mesh(scoreGeo, scoreMat);
        sc.position.set(0, 0.026, sz);
        sc.rotation.y = 0.35;
        bagBaked.add(sc);
      });
      bagBaked.rotation.set(0.18, -0.32, 0.08);
      this.heldMeshes.baguette_baked = bagBaked;

      // 5) Sliced bagged golden baguette
      const bagSliced = new THREE.Group();
      const bsBody = new THREE.Mesh(bagBakedGeo, bakedCrustMat);
      const bsBand = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.024, 0.1), kraftBandMat);
      const bsSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.064, 0.33), bagClearMat);
      const bsRingGeo = new THREE.BoxGeometry(0.058, 0.048, 0.004);
      bagSliced.add(bsBody, bsBand, bsSleeve);
      for (let sz = -0.11; sz <= 0.115; sz += 0.036) {
        const ring = new THREE.Mesh(bsRingGeo, sliceDarkMat);
        ring.position.z = sz;
        bagSliced.add(ring);
      }
      bagSliced.rotation.set(0.18, -0.32, 0.08);
      this.heldMeshes.baguette_sliced = bagSliced;
      ctx.disposables.push(bsBand.geometry, bsSleeve.geometry, bsRingGeo);

      // 6) Baked golden croissant
      const crBaked = new THREE.Group();
      const crBArc = new THREE.Mesh(croisGeo, pastryMat);
      const crBMid = new THREE.Mesh(croisMidGeo, pastryMat);
      crBMid.scale.set(1.3, 0.85, 1.0);
      crBMid.position.set(0, 0.005, -0.024);
      crBaked.add(crBArc, crBMid);
      crBaked.scale.setScalar(1.08);
      crBaked.rotation.set(0.32, -0.25, 0);
      this.heldMeshes.croissant_baked = crBaked;

      // 7) Baked golden pain au chocolat
      const pcBaked = new THREE.Group();
      const pcBB = new THREE.Mesh(painGeo, pastryMat);
      const pcBC1 = new THREE.Mesh(barGeo, chocMat);
      pcBC1.position.set(0, 0, -0.016);
      const pcBC2 = new THREE.Mesh(barGeo, chocMat);
      pcBC2.position.set(0, 0, 0.016);
      pcBaked.add(pcBB, pcBC1, pcBC2);
      pcBaked.scale.setScalar(1.08);
      pcBaked.rotation.set(0.28, -0.32, 0);
      this.heldMeshes.pain_choc_baked = pcBaked;

      // 8) Bagged Brioche Tressée 400g
      const brioche = new THREE.Group();
      [-0.048, 0, 0.048].forEach((bx, idx) => {
        const lobe = new THREE.Mesh(brioLobeGeo, pastryMat);
        lobe.scale.set(1.05, idx === 1 ? 1.05 : 0.92, 0.92);
        lobe.position.x = bx;
        brioche.add(lobe);
      });
      const brBag = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.095, 0.1), bagClearMat);
      brioche.add(brBag);
      brioche.rotation.set(0.22, -0.34, 0.05);
      this.heldMeshes.brioche_bagged = brioche;
      ctx.disposables.push(brBag.geometry);
    }

    // Held Butcher & Charcuterie 3D Props (Rayon 4 — Boucherie & Charcuterie 1990)
    {
      const bBeefMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.42 });
      const bFatMat = new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.58 });
      const bPorkMat = new THREE.MeshStandardMaterial({ color: 0xe09f87, roughness: 0.48 });
      const bHamMat = new THREE.MeshStandardMaterial({ color: 0xf4a2a2, roughness: 0.4 });
      const bRindMat = new THREE.MeshStandardMaterial({ color: 0xfde6d8, roughness: 0.54 });
      const bInoxMat = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.26, metalness: 0.82 });
      const bPaperMat = new THREE.MeshStandardMaterial({ color: 0xfff1f2, roughness: 0.72 });
      const bStripeMat = new THREE.MeshStandardMaterial({ color: 0xfecdd3, roughness: 0.74 });
      const bTicketMat = new THREE.MeshStandardMaterial({ color: 0xfffef8, roughness: 0.52 });
      const bFoamMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 });
      const bMergMat = new THREE.MeshStandardMaterial({ color: 0xb4341c, roughness: 0.44 });
      const bChipMat = new THREE.MeshStandardMaterial({ color: 0xd88c6a, roughness: 0.48 });
      const bFilmMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.28,
        roughness: 0.12,
        depthWrite: false,
      });
      ctx.disposables.push(
        bBeefMat,
        bFatMat,
        bPorkMat,
        bHamMat,
        bRindMat,
        bInoxMat,
        bPaperMat,
        bStripeMat,
        bTicketMat,
        bFoamMat,
        bMergMat,
        bChipMat,
        bFilmMat
      );

      // 1) Raw Beef Primal Cut
      const beefP = new THREE.Group();
      const bpCore = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.12), bBeefMat);
      const bpCap = new THREE.Mesh(new THREE.BoxGeometry(0.222, 0.015, 0.122), bFatMat);
      bpCap.position.y = 0.044;
      beefP.add(bpCore, bpCap);
      beefP.rotation.set(0.18, -0.32, 0.04);
      this.heldMeshes.beef_primal = beefP;
      ctx.disposables.push(bpCore.geometry, bpCap.geometry);

      // 2) Raw Pork Roast Primal
      const porkP = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 12), bPorkMat);
      porkP.rotation.set(0.2, -0.25, Math.PI / 2);
      this.heldMeshes.pork_primal = porkP;
      ctx.disposables.push(porkP.geometry);

      // 3) Cooked Ham Slicer Block
      const hamB = new THREE.Group();
      const hbCore = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.095, 0.18), bHamMat);
      const hbRind = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.016, 0.182), bRindMat);
      hbRind.position.y = 0.052;
      hamB.add(hbCore, hbRind);
      hamB.rotation.set(0.16, -0.32, 0);
      this.heldMeshes.ham_block = hamB;
      ctx.disposables.push(hbCore.geometry, hbRind.geometry);

      // 4) Stainless Platter — Sliced Beef Steaks
      const bPlat = new THREE.Group();
      const plGeo = new THREE.BoxGeometry(0.24, 0.012, 0.15);
      const stGeo = new THREE.BoxGeometry(0.085, 0.018, 0.055);
      bPlat.add(new THREE.Mesh(plGeo, bInoxMat));
      [
        [-0.055, -0.032],
        [0.055, -0.032],
        [-0.055, 0.032],
        [0.055, 0.032],
      ].forEach(([sx, sz]) => {
        const s = new THREE.Mesh(stGeo, bBeefMat);
        s.position.set(sx, 0.014, sz);
        bPlat.add(s);
      });
      bPlat.rotation.set(0.22, -0.28, 0);
      this.heldMeshes.beef_platter = bPlat;
      ctx.disposables.push(plGeo, stGeo);

      // 5) Stainless Platter — Sliced Pork Medallions
      const pPlat = new THREE.Group();
      const pmGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.018, 10);
      pPlat.add(new THREE.Mesh(plGeo, bInoxMat));
      [-0.07, -0.022, 0.024, 0.072].forEach((px) => {
        const m = new THREE.Mesh(pmGeo, bPorkMat);
        m.position.set(px, 0.015, 0);
        pPlat.add(m);
      });
      pPlat.rotation.set(0.22, -0.28, 0);
      this.heldMeshes.pork_platter = pPlat;
      ctx.disposables.push(pmGeo);

      // 6) Fresh Pink Ham Slices on Deli Paper
      const hamSl = new THREE.Group();
      const hpPaper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.004, 0.14), bTicketMat);
      const hpSlGeo = new THREE.BoxGeometry(0.12, 0.005, 0.095);
      hamSl.add(hpPaper);
      for (let i = 0; i < 4; i++) {
        const sl = new THREE.Mesh(hpSlGeo, bHamMat);
        sl.position.set((i - 1.5) * 0.008, 0.006 + i * 0.005, 0);
        hamSl.add(sl);
      }
      hamSl.rotation.set(0.24, -0.28, 0);
      this.heldMeshes.ham_sliced_pack = hamSl;
      ctx.disposables.push(hpPaper.geometry, hpSlGeo);

      // 7–9) Wrapped Butcher Paper Parcels with Printed Weight-Price Sticker
      const makeHeldWrapped = () => {
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.056, 0.13), bPaperMat);
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.204, 0.058, 0.028), bStripeMat);
        const tick = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.003, 0.055), bTicketMat);
        tick.position.y = 0.03;
        g.add(box, band, tick);
        g.rotation.set(0.22, -0.3, 0);
        ctx.disposables.push(box.geometry, band.geometry, tick.geometry);
        return g;
      };
      this.heldMeshes.butcher_wrapped_beef = makeHeldWrapped();
      this.heldMeshes.butcher_wrapped_pork = makeHeldWrapped();
      this.heldMeshes.butcher_wrapped_ham = makeHeldWrapped();

      // 10) Chilled Pre-Packed Tray — Steaks Hachés x6
      const shTray = new THREE.Group();
      const tBaseGeo = new THREE.BoxGeometry(0.21, 0.026, 0.14);
      const tFilmGeo = new THREE.BoxGeometry(0.214, 0.044, 0.144);
      const patGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.012, 10);
      shTray.add(new THREE.Mesh(tBaseGeo, bFoamMat));
      [-0.06, 0, 0.06].forEach((px) => {
        [-0.03, 0.03].forEach((pz) => {
          const p = new THREE.Mesh(patGeo, bBeefMat);
          p.position.set(px, 0.018, pz);
          shTray.add(p);
        });
      });
      const shFilm = new THREE.Mesh(tFilmGeo, bFilmMat);
      shFilm.position.y = 0.012;
      shTray.add(shFilm);
      shTray.rotation.set(0.22, -0.28, 0);
      this.heldMeshes.butcher_tray_steaks = shTray;
      ctx.disposables.push(tBaseGeo, tFilmGeo, patGeo);

      // 11) Chilled Pre-Packed Tray — Merguez & Saucisses x6
      const mgTray = new THREE.Group();
      const sCapGeo = new THREE.CapsuleGeometry(0.01, 0.075, 4, 8);
      sCapGeo.rotateZ(Math.PI / 2);
      mgTray.add(new THREE.Mesh(tBaseGeo, bFoamMat));
      [-0.04, -0.02, 0, 0.02, 0.04].forEach((sz, idx) => {
        const s = new THREE.Mesh(sCapGeo, idx < 3 ? bMergMat : bChipMat);
        s.position.set(0, 0.018, sz);
        mgTray.add(s);
      });
      const mgFilm = new THREE.Mesh(tFilmGeo, bFilmMat);
      mgFilm.position.y = 0.012;
      mgTray.add(mgFilm);
      mgTray.rotation.set(0.22, -0.28, 0);
      this.heldMeshes.butcher_tray_merguez = mgTray;
      ctx.disposables.push(sCapGeo);
    }

    // V12 Wine, Beer & Spirits Held 3D Props (Rayon 8 — Cave à Vins 1990)
    {
      const bordeauxGlassMat = new THREE.MeshStandardMaterial({
        color: 0x143d22,
        roughness: 0.14,
        metalness: 0.12,
      });
      const bourgogneGlassMat = new THREE.MeshStandardMaterial({
        color: 0x4d6b22,
        roughness: 0.14,
        metalness: 0.12,
      });
      const champagneGlassMat = new THREE.MeshStandardMaterial({
        color: 0x0f3b26,
        roughness: 0.12,
        metalness: 0.15,
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
      const foilRedMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.3, metalness: 0.45 });
      const foilGoldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.22, metalness: 0.72 });
      const foilGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.28, metalness: 0.4 });
      const pastisCapMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.32 });
      const creamLblMat = new THREE.MeshStandardMaterial({ color: 0xfef9e7, roughness: 0.72 });
      const darkChampLblMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 });
      const bluePastisLblMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 });
      const sixPackCartonMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.68 });
      const sixPackStripeMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.62 });
      const porcelainMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.22 });
      const wireMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });

      const bordeauxPts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.036, 0.0),
        new THREE.Vector2(0.036, 0.16),
        new THREE.Vector2(0.028, 0.19),
        new THREE.Vector2(0.013, 0.205),
        new THREE.Vector2(0.013, 0.27),
        new THREE.Vector2(0.015, 0.278),
        new THREE.Vector2(0.0, 0.278),
      ];
      const bourgPts = [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.04, 0.0),
        new THREE.Vector2(0.04, 0.13),
        new THREE.Vector2(0.025, 0.19),
        new THREE.Vector2(0.014, 0.23),
        new THREE.Vector2(0.014, 0.28),
        new THREE.Vector2(0.016, 0.288),
        new THREE.Vector2(0.0, 0.288),
      ];
      const bordeauxGeo = new THREE.LatheGeometry(bordeauxPts, 12);
      const bourgGeo = new THREE.LatheGeometry(bourgPts, 12);
      const capGeo = new THREE.CylinderGeometry(0.0145, 0.015, 0.046, 10);
      const champFoilGeo = new THREE.CylinderGeometry(0.0155, 0.024, 0.09, 10);
      const lblBandGeo = new THREE.CylinderGeometry(0.0372, 0.0372, 0.088, 12, 1, true);
      const bourgLblGeo = new THREE.CylinderGeometry(0.0412, 0.0412, 0.082, 12, 1, true);

      const makeHeldBottle = (
        bodyGeo: THREE.BufferGeometry,
        glassMat: THREE.Material,
        foilMat: THREE.Material,
        lblGeo: THREE.BufferGeometry,
        lblMat: THREE.Material,
        tallScaleY = 1,
        isChampagne = false,
        isSwingTop = false
      ) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(bodyGeo, glassMat);
        body.scale.y = tallScaleY;
        body.position.y = -0.11;
        g.add(body);
        const lbl = new THREE.Mesh(lblGeo, lblMat);
        lbl.position.y = -0.025;
        g.add(lbl);
        if (isChampagne) {
          const cf = new THREE.Mesh(champFoilGeo, foilMat);
          cf.position.y = 0.135;
          g.add(cf);
        } else if (isSwingTop) {
          const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.022, 10), porcelainMat);
          plug.position.y = 0.174;
          const wire = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0022, 6, 10), wireMat);
          wire.position.set(0, 0.155, 0.012);
          g.add(plug, wire);
          ctx.disposables.push(plug.geometry, wire.geometry);
        } else {
          const cap = new THREE.Mesh(capGeo, foilMat);
          cap.position.y = 0.145 * tallScaleY + (tallScaleY - 1) * 0.11;
          g.add(cap);
        }
        g.rotation.set(0.14, -0.25, 0.1);
        return g;
      };

      this.heldMeshes.wine_bordeaux = makeHeldBottle(
        bordeauxGeo,
        bordeauxGlassMat,
        foilRedMat,
        lblBandGeo,
        creamLblMat
      );
      this.heldMeshes.wine_bourgogne = makeHeldBottle(
        bourgGeo,
        bourgogneGlassMat,
        foilGoldMat,
        bourgLblGeo,
        creamLblMat
      );
      this.heldMeshes.wine_champagne = makeHeldBottle(
        bourgGeo,
        champagneGlassMat,
        foilGoldMat,
        bourgLblGeo,
        darkChampLblMat,
        1.05,
        true
      );
      this.heldMeshes.beer_ambree = makeHeldBottle(
        bourgGeo,
        amberGlassMat,
        porcelainMat,
        bourgLblGeo,
        creamLblMat,
        1.0,
        false,
        true
      );
      this.heldMeshes.cidre_normandie = makeHeldBottle(
        bourgGeo,
        ciderGlassMat,
        foilGreenMat,
        bourgLblGeo,
        creamLblMat
      );
      this.heldMeshes.pastis_marseille = makeHeldBottle(
        bordeauxGeo,
        pastisGlassMat,
        pastisCapMat,
        lblBandGeo,
        bluePastisLblMat,
        1.14
      );

      // Held 6-Pack Beer Carrier
      const sixP = new THREE.Group();
      const spCarton = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.135, 0.12), sixPackCartonMat);
      spCarton.position.y = -0.02;
      const spBand = new THREE.Mesh(new THREE.BoxGeometry(0.183, 0.048, 0.123), sixPackStripeMat);
      spBand.position.y = -0.015;
      const spHandle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.045, 0.012), sixPackCartonMat);
      spHandle.position.y = 0.07;
      sixP.add(spCarton, spBand, spHandle);
      const miniNeckGeo = new THREE.CylinderGeometry(0.01, 0.012, 0.055, 8);
      const miniCapGeo = new THREE.CylinderGeometry(0.0115, 0.0115, 0.008, 8);
      [-0.052, 0, 0.052].forEach((bx) => {
        [-0.028, 0.028].forEach((bz) => {
          const nk = new THREE.Mesh(miniNeckGeo, amberGlassMat);
          nk.position.set(bx, 0.06, bz);
          const cp = new THREE.Mesh(miniCapGeo, foilGoldMat);
          cp.position.set(bx, 0.09, bz);
          sixP.add(nk, cp);
        });
      });
      sixP.rotation.set(0.18, -0.32, 0.05);
      this.heldMeshes.beer_sixpack = sixP;

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
        creamLblMat,
        darkChampLblMat,
        bluePastisLblMat,
        sixPackCartonMat,
        sixPackStripeMat,
        porcelainMat,
        wireMat,
        bordeauxGeo,
        bourgGeo,
        capGeo,
        champFoilGeo,
        lblBandGeo,
        bourgLblGeo,
        spCarton.geometry,
        spBand.geometry,
        spHandle.geometry,
        miniNeckGeo,
        miniCapGeo
      );
    }

    // V13 Sweet Grocery, Biscuits & Snacks Held 3D Props (Rayon 7B — Épicerie Sucrée 1990)
    {
      const chipsNatMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.28, metalness: 0.22 });
      const chipsBbqMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.28, metalness: 0.22 });
      const foilCrimpsMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35, metalness: 0.35 });
      const biscuitBoxMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.56 });
      const biscuitTrimMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.52 });
      const spreadJarMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.14, metalness: 0.1 });
      const spreadLidMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34 });
      const spreadLblMat = new THREE.MeshStandardMaterial({ color: 0xfffef8, roughness: 0.65 });
      const madPackMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.42 });
      const madWindowMat = new THREE.MeshStandardMaterial({ color: 0xd99b43, roughness: 0.65 });
      const waferPackMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.44 });
      const waferStripeMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.48 });
      const chocoWrapMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.38 });
      const chocoGoldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
      const bonbonBagMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.34 });
      const bonbonAccentMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.38 });
      const pavCardMat = new THREE.MeshStandardMaterial({ color: 0xb68d65, roughness: 0.84 });

      const makeHeldChipBag = (bagMat: THREE.Material) => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.21, 0.068), bagMat);
        body.scale.set(1, 1, 1.05);
        const topCrimp = new THREE.Mesh(new THREE.BoxGeometry(0.156, 0.016, 0.018), foilCrimpsMat);
        topCrimp.position.y = 0.11;
        const botCrimp = new THREE.Mesh(new THREE.BoxGeometry(0.156, 0.016, 0.018), foilCrimpsMat);
        botCrimp.position.y = -0.11;
        g.add(body, topCrimp, botCrimp);
        g.rotation.set(0.14, -0.32, 0.08);
        ctx.disposables.push(body.geometry, topCrimp.geometry, botCrimp.geometry);
        return g;
      };
      this.heldMeshes.snack_chips_nature = makeHeldChipBag(chipsNatMat);
      this.heldMeshes.snack_chips_bbq = makeHeldChipBag(chipsBbqMat);

      // Biscuits Sablés Pur Beurre Box
      const sablesG = new THREE.Group();
      const sbBody = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.13, 0.075), biscuitBoxMat);
      const sbBand = new THREE.Mesh(new THREE.BoxGeometry(0.193, 0.036, 0.078), biscuitTrimMat);
      sbBand.position.y = 0.038;
      sablesG.add(sbBody, sbBand);
      sablesG.rotation.set(0.18, -0.3, 0.04);
      this.heldMeshes.snack_biscuits_sables = sablesG;

      // Pâte à Tartiner Noisettes 400g Glass Jar
      const jarG = new THREE.Group();
      const jBody = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.046, 0.115, 14), spreadJarMat);
      const jLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.049, 0.062, 14, 1, true), spreadLblMat);
      const jLid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.024, 14), spreadLidMat);
      jLid.position.y = 0.068;
      jarG.add(jBody, jLbl, jLid);
      jarG.rotation.set(0.16, -0.25, 0.05);
      this.heldMeshes.snack_pate_tartiner = jarG;

      // Madeleines Moelleuses x12 Pack
      const madG = new THREE.Group();
      const mBody = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.11), madPackMat);
      const mWin = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.055, 0.114), madWindowMat);
      madG.add(mBody, mWin);
      madG.rotation.set(0.18, -0.3, 0.05);
      this.heldMeshes.snack_madeleines = madG;

      // Gaufrettes Fourrées Chocolat Pack
      const wafG = new THREE.Group();
      const wBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.185, 0.068), waferPackMat);
      const wBand = new THREE.Mesh(new THREE.BoxGeometry(0.113, 0.05, 0.071), waferStripeMat);
      wBand.position.y = 0.025;
      wafG.add(wBody, wBand);
      wafG.rotation.set(0.16, -0.3, 0.06);
      this.heldMeshes.snack_gaufrettes = wafG;

      // Slim PAV Tray — Tablettes Chocolat
      const chocoPavG = new THREE.Group();
      const cpTray = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.07, 0.24), pavCardMat);
      chocoPavG.add(cpTray);
      const barMiniGeo = new THREE.BoxGeometry(0.15, 0.095, 0.016);
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(barMiniGeo, i % 2 === 0 ? chocoWrapMat : chocoGoldMat);
        b.position.set(0, 0.045, -0.08 + i * 0.032);
        chocoPavG.add(b);
      }
      chocoPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.snack_choco_pav = chocoPavG;

      // Single Chocolate Bar
      const chocoBarG = new THREE.Group();
      const cbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.015), chocoWrapMat);
      const cbBand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.092, 0.017), chocoGoldMat);
      chocoBarG.add(cbMesh, cbBand);
      chocoBarG.rotation.set(0.18, -0.32, 0.08);
      this.heldMeshes.snack_choco_bar = chocoBarG;

      // Slim PAV Tray — Sachets Bonbons & Confiseries
      const bonPavG = new THREE.Group();
      const bpTray = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.075, 0.24), pavCardMat);
      bonPavG.add(bpTray);
      const pouchMiniGeo = new THREE.BoxGeometry(0.14, 0.11, 0.024);
      for (let i = 0; i < 5; i++) {
        const p = new THREE.Mesh(pouchMiniGeo, i % 2 === 0 ? bonbonBagMat : bonbonAccentMat);
        p.position.set(0, 0.05, -0.075 + i * 0.038);
        bonPavG.add(p);
      }
      bonPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.snack_bonbons_pav = bonPavG;

      // Single Candy Pouch
      const bonBagG = new THREE.Group();
      const bbBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.165, 0.042), bonbonBagMat);
      const bbBand = new THREE.Mesh(new THREE.BoxGeometry(0.123, 0.045, 0.045), bonbonAccentMat);
      bonBagG.add(bbBody, bbBand);
      bonBagG.rotation.set(0.16, -0.3, 0.08);
      this.heldMeshes.snack_bonbons_bag = bonBagG;

      ctx.disposables.push(
        chipsNatMat,
        chipsBbqMat,
        foilCrimpsMat,
        biscuitBoxMat,
        biscuitTrimMat,
        spreadJarMat,
        spreadLidMat,
        spreadLblMat,
        madPackMat,
        madWindowMat,
        waferPackMat,
        waferStripeMat,
        chocoWrapMat,
        chocoGoldMat,
        bonbonBagMat,
        bonbonAccentMat,
        pavCardMat,
        sbBody.geometry,
        sbBand.geometry,
        jBody.geometry,
        jLbl.geometry,
        jLid.geometry,
        mBody.geometry,
        mWin.geometry,
        wBody.geometry,
        wBand.geometry,
        cpTray.geometry,
        barMiniGeo,
        cbMesh.geometry,
        cbBand.geometry,
        bpTray.geometry,
        pouchMiniGeo,
        bbBody.geometry,
        bbBand.geometry
      );
    }

    // V14 Savory Grocery, Pasta, Rice, Canned Goods & Cooking Oils Held 3D Props (Rayon 7A)
    {
      const sunOilMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        roughness: 0.16,
        metalness: 0.08,
      });
      const oliveGlassMat = new THREE.MeshStandardMaterial({
        color: 0x365314,
        roughness: 0.14,
        metalness: 0.16,
      });
      const oilCapYellowMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.4 });
      const oilCapGoldMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.34, metalness: 0.45 });
      const tinSteelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.28, metalness: 0.72 });
      const cassouletLblMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
      const coqBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.42 });
      const pastaYellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.55 });
      const spagRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.42 });
      const riceBoxMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55 });
      const riceBandMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });
      const tomatoGlassMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.18, metalness: 0.1 });
      const greenCanMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.44 });
      const mustardJarMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.22, metalness: 0.08 });
      const creamPaperMat = new THREE.MeshStandardMaterial({ color: 0xfffef8, roughness: 0.65 });
      const lidRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.36 });
      const pavCbMat = new THREE.MeshStandardMaterial({ color: 0xb68d65, roughness: 0.84 });

      // 1) Huile de Tournesol 1L Bottle
      const sunOilG = new THREE.Group();
      const soBody = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.046, 0.195, 14), sunOilMat);
      const soNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.036, 0.055, 12), sunOilMat);
      soNeck.position.y = 0.122;
      const soCap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.024, 12), oilCapYellowMat);
      soCap.position.y = 0.158;
      const soLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.072, 14, 1, true), creamPaperMat);
      sunOilG.add(soBody, soNeck, soCap, soLbl);
      sunOilG.rotation.set(0.14, -0.25, 0.08);
      this.heldMeshes.savory_huile_tournesol = sunOilG;

      // 2) Huile d'Olive Vierge 75cl Tinted Glass Bottle
      const oliveG = new THREE.Group();
      const olBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.185, 14), oliveGlassMat);
      const olNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.022, 0.068, 12), oliveGlassMat);
      olNeck.position.y = 0.125;
      const olCap = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.028, 12), oilCapGoldMat);
      olCap.position.y = 0.168;
      const olLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.082, 14, 1, true), creamPaperMat);
      oliveG.add(olBody, olNeck, olCap, olLbl);
      oliveG.rotation.set(0.14, -0.25, 0.08);
      this.heldMeshes.savory_huile_olive = oliveG;

      // 3) Cassoulet Toulousain 840g Large Tin Can
      const cassG = new THREE.Group();
      const caCan = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.135, 16), tinSteelMat);
      const caLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.115, 16, 1, true), cassouletLblMat);
      cassG.add(caCan, caLbl);
      cassG.rotation.set(0.18, -0.28, 0.05);
      this.heldMeshes.savory_cassoulet = cassG;

      // 4) Pâtes Coquillettes 500g Blue Pack
      const coqG = new THREE.Group();
      const coqBody = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.195, 0.062), coqBlueMat);
      const coqWin = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.075, 0.066), pastaYellowMat);
      coqWin.position.y = -0.025;
      coqG.add(coqBody, coqWin);
      coqG.rotation.set(0.16, -0.32, 0.08);
      this.heldMeshes.savory_coquillettes = coqG;

      // 5) Spaghetti Supérieurs 500g Long Pack
      const spagG = new THREE.Group();
      const spBody = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.255, 0.045), spagRedMat);
      const spWin = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.14, 0.048), pastaYellowMat);
      spagG.add(spBody, spWin);
      spagG.rotation.set(0.18, -0.3, 0.14);
      this.heldMeshes.savory_spaghetti = spagG;

      // 6) Riz Long Grain 1kg Cardboard Box
      const rizG = new THREE.Group();
      const rzBody = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.21, 0.068), riceBoxMat);
      const rzBand = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.052, 0.071), riceBandMat);
      rzBand.position.y = 0.045;
      rizG.add(rzBody, rzBand);
      rizG.rotation.set(0.16, -0.3, 0.06);
      this.heldMeshes.savory_riz = rizG;

      // 7) Sauce Tomate Basilic PAV Tray & Single Jar
      const tomPavG = new THREE.Group();
      const tpTray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.065, 0.24), pavCbMat);
      tomPavG.add(tpTray);
      const miniJarGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.095, 10);
      const miniLidGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.014, 10);
      for (let iz = 0; iz < 3; iz++) {
        [-0.04, 0.04].forEach((ix) => {
          const j = new THREE.Mesh(miniJarGeo, tomatoGlassMat);
          j.position.set(ix, 0.045, -0.065 + iz * 0.065);
          const l = new THREE.Mesh(miniLidGeo, lidRedMat);
          l.position.set(ix, 0.098, -0.065 + iz * 0.065);
          tomPavG.add(j, l);
        });
      }
      tomPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.savory_sauce_tomate_pav = tomPavG;

      const tomJarG = new THREE.Group();
      const tjBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.125, 14), tomatoGlassMat);
      const tjLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.058, 14, 1, true), creamPaperMat);
      const tjLid = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 14), lidRedMat);
      tjLid.position.y = 0.072;
      tomJarG.add(tjBody, tjLbl, tjLid);
      tomJarG.rotation.set(0.16, -0.25, 0.05);
      this.heldMeshes.savory_sauce_tomate_jar = tomJarG;

      // 8) Petits Pois Carottes 400g PAV Tray & Single Tin Can
      const poisPavG = new THREE.Group();
      const ppTray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.24), pavCbMat);
      poisPavG.add(ppTray);
      const miniCanGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.088, 10);
      for (let iz = 0; iz < 3; iz++) {
        [-0.042, 0.042].forEach((ix) => {
          const cn = new THREE.Mesh(miniCanGeo, greenCanMat);
          cn.position.set(ix, 0.044, -0.065 + iz * 0.065);
          poisPavG.add(cn);
        });
      }
      poisPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.savory_petits_pois_pav = poisPavG;

      const poisCanG = new THREE.Group();
      const pcCan = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.115, 14), tinSteelMat);
      const pcLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.095, 14, 1, true), greenCanMat);
      poisCanG.add(pcCan, pcLbl);
      poisCanG.rotation.set(0.16, -0.25, 0.05);
      this.heldMeshes.savory_petits_pois_can = poisCanG;

      // 9) Moutarde de Dijon 250g PAV Tray & Single Glass Jar
      const moutPavG = new THREE.Group();
      const mpTray = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.24), pavCbMat);
      moutPavG.add(mpTray);
      const miniMoutGeo = new THREE.CylinderGeometry(0.026, 0.024, 0.085, 10);
      for (let iz = 0; iz < 3; iz++) {
        [-0.04, 0.04].forEach((ix) => {
          const mj = new THREE.Mesh(miniMoutGeo, mustardJarMat);
          mj.position.set(ix, 0.042, -0.065 + iz * 0.065);
          const ml = new THREE.Mesh(miniLidGeo, oilCapYellowMat);
          ml.position.set(ix, 0.09, -0.065 + iz * 0.065);
          moutPavG.add(mj, ml);
        });
      }
      moutPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.savory_moutarde_pav = moutPavG;

      const moutJarG = new THREE.Group();
      const mjBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.035, 0.105, 14), mustardJarMat);
      const mjLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.037, 0.052, 14, 1, true), creamPaperMat);
      const mjLid = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.018, 14), oilCapYellowMat);
      mjLid.position.y = 0.06;
      moutJarG.add(mjBody, mjLbl, mjLid);
      moutJarG.rotation.set(0.16, -0.25, 0.05);
      this.heldMeshes.savory_moutarde_jar = moutJarG;

      ctx.disposables.push(
        sunOilMat,
        oliveGlassMat,
        oilCapYellowMat,
        oilCapGoldMat,
        tinSteelMat,
        cassouletLblMat,
        coqBlueMat,
        pastaYellowMat,
        spagRedMat,
        riceBoxMat,
        riceBandMat,
        tomatoGlassMat,
        greenCanMat,
        mustardJarMat,
        creamPaperMat,
        lidRedMat,
        pavCbMat,
        soBody.geometry,
        soNeck.geometry,
        soCap.geometry,
        soLbl.geometry,
        olBody.geometry,
        olNeck.geometry,
        olCap.geometry,
        olLbl.geometry,
        caCan.geometry,
        caLbl.geometry,
        coqBody.geometry,
        coqWin.geometry,
        spBody.geometry,
        spWin.geometry,
        rzBody.geometry,
        rzBand.geometry,
        tpTray.geometry,
        miniJarGeo,
        miniLidGeo,
        tjBody.geometry,
        tjLbl.geometry,
        tjLid.geometry,
        ppTray.geometry,
        miniCanGeo,
        pcCan.geometry,
        pcLbl.geometry,
        mpTray.geometry,
        miniMoutGeo,
        mjBody.geometry,
        mjLbl.geometry,
        mjLid.geometry
      );
    }

    // --- V15 Frozen Foods & Ice Cream Held 3D Props (Rayon 6 — Surgelés & Glaces 1990) ---
    {
      const frostYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.52 });
      const frostNavyMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.48 });
      const frostRedMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.56 });
      const frostGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.54 });
      const frostIceBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.42 });
      const frostCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.44 });
      const frostPinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.48 });
      const frostChocoMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.52 });
      const frostOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.48 });
      const frostWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f9ff, roughness: 0.36 });

      // 1) Frites Allumettes Surgelées 1kg (pillow bag)
      const fritesG = new THREE.Group();
      const frBag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.068), frostYellowMat);
      const frBand = new THREE.Mesh(new THREE.BoxGeometry(0.153, 0.075, 0.071), frostNavyMat);
      frBand.position.y = 0.03;
      const frTopSeal = new THREE.Mesh(new THREE.BoxGeometry(0.152, 0.016, 0.014), frostWhiteMat);
      frTopSeal.position.y = 0.115;
      fritesG.add(frBag, frBand, frTopSeal);
      fritesG.rotation.set(0.18, -0.32, 0.06);
      this.heldMeshes.frozen_frites = fritesG;

      // 2) Pizza Royale Surgelée (flat square cardboard box)
      const pizzaG = new THREE.Group();
      const pzBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.036, 0.24), frostRedMat);
      const pzDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.004, 18), frostYellowMat);
      pzDisc.position.set(0, 0.019, 0.01);
      const pzRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.242, 0.012, 0.055), frostGreenMat);
      pzRibbon.position.set(0, 0.015, -0.075);
      pizzaG.add(pzBox, pzDisc, pzRibbon);
      pizzaG.rotation.set(0.45, -0.28, 0.08);
      this.heldMeshes.frozen_pizza = pizzaG;

      // 3) Bâtonnets Colin Panés x10 (ocean-blue frozen fish carton)
      const colinG = new THREE.Group();
      const clBox = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.055, 0.145), frostIceBlueMat);
      const clStrip = new THREE.Mesh(new THREE.BoxGeometry(0.187, 0.018, 0.048), frostYellowMat);
      clStrip.position.set(0, 0.022, 0.025);
      const clStripe = new THREE.Mesh(new THREE.BoxGeometry(0.187, 0.008, 0.032), frostWhiteMat);
      clStripe.position.set(0, 0.028, -0.036);
      colinG.add(clBox, clStrip, clStripe);
      colinG.rotation.set(0.32, -0.3, 0.06);
      this.heldMeshes.frozen_colin = colinG;

      // 4) Haricots Verts Surgelés 1kg (green frozen vegetable bag)
      const haricotsG = new THREE.Group();
      const hvBag = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.215, 0.065), frostGreenMat);
      const hvBand = new THREE.Mesh(new THREE.BoxGeometry(0.151, 0.072, 0.068), frostWhiteMat);
      hvBand.position.y = 0.025;
      const hvIce = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.016, 0.014), frostIceBlueMat);
      hvIce.position.y = 0.112;
      haricotsG.add(hvBag, hvBand, hvIce);
      haricotsG.rotation.set(0.18, -0.32, 0.05);
      this.heldMeshes.frozen_haricots = haricotsG;

      // 5) Bac Glace 3 Parfums 1L (rectangular frosted plastic tub)
      const bacGlaceG = new THREE.Group();
      const bgTub = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.088, 0.118), frostCreamMat);
      const bgLid = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.016, 0.128), frostWhiteMat);
      bgLid.position.y = 0.048;
      const bgStripe1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.10), frostChocoMat);
      bgStripe1.position.set(-0.052, 0.057, 0);
      const bgStripe2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.10), frostPinkMat);
      bgStripe2.position.set(0.052, 0.057, 0);
      bacGlaceG.add(bgTub, bgLid, bgStripe1, bgStripe2);
      bacGlaceG.rotation.set(0.24, -0.3, 0.05);
      this.heldMeshes.frozen_glace_bac = bacGlaceG;

      // 6) Cônes Glacés Vanille-Choco x6 (ice-cream cone box)
      const conesG = new THREE.Group();
      const cnBox = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.082), frostIceBlueMat);
      const cnBand = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.052, 0.084), frostCreamMat);
      cnBand.position.y = 0.015;
      const cnTip = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.026, 0.084), frostChocoMat);
      cnTip.position.y = -0.04;
      conesG.add(cnBox, cnBand, cnTip);
      conesG.rotation.set(0.2, -0.32, 0.05);
      this.heldMeshes.frozen_cones = conesG;

      // 7) Esquimaux Bâtonnets x8 (colorful popsicle multipack box)
      const esqG = new THREE.Group();
      const eqBox = new THREE.Mesh(new THREE.BoxGeometry(0.172, 0.125, 0.075), frostOrangeMat);
      const eqBand = new THREE.Mesh(new THREE.BoxGeometry(0.174, 0.044, 0.078), frostWhiteMat);
      eqBand.position.y = 0.025;
      const eqBar = new THREE.Mesh(new THREE.BoxGeometry(0.174, 0.024, 0.078), frostPinkMat);
      eqBar.position.y = -0.038;
      esqG.add(eqBox, eqBand, eqBar);
      esqG.rotation.set(0.2, -0.3, 0.05);
      this.heldMeshes.frozen_esquimaux = esqG;

      ctx.disposables.push(
        frostYellowMat,
        frostNavyMat,
        frostRedMat,
        frostGreenMat,
        frostIceBlueMat,
        frostCreamMat,
        frostPinkMat,
        frostChocoMat,
        frostOrangeMat,
        frostWhiteMat,
        frBag.geometry,
        frBand.geometry,
        frTopSeal.geometry,
        pzBox.geometry,
        pzDisc.geometry,
        pzRibbon.geometry,
        clBox.geometry,
        clStrip.geometry,
        clStripe.geometry,
        hvBag.geometry,
        hvBand.geometry,
        hvIce.geometry,
        bgTub.geometry,
        bgLid.geometry,
        bgStripe1.geometry,
        bgStripe2.geometry,
        cnBox.geometry,
        cnBand.geometry,
        cnTip.geometry,
        eqBox.geometry,
        eqBand.geometry,
        eqBar.geometry
      );
    }

    // --- V16 Fresh Produce Held 3D Props (Rayon 1 — Primeur 1990) ---
    {
      const crateWoodMat = new THREE.MeshStandardMaterial({ color: 0xc29b6b, roughness: 0.78 });
      const appleGoldenMat = new THREE.MeshStandardMaterial({ color: 0xbef264, roughness: 0.36 });
      const bananaYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.42 });
      const orangeFruitMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.46 });
      const tomatoRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 });
      const stemGreenMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
      const carrotOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.5 });
      const burlapMat = new THREE.MeshStandardMaterial({ color: 0xa68966, roughness: 0.92 });
      const potatoNetMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 });
      const produceBagMat = new THREE.MeshStandardMaterial({
        color: 0xdcfce7,
        transparent: true,
        opacity: 0.65,
        roughness: 0.28,
      });
      const weightStickerMat = new THREE.MeshStandardMaterial({ color: 0xfffef8, roughness: 0.5 });
      const stickerBarMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });

      const miniCrateFloorGeo = new THREE.BoxGeometry(0.19, 0.012, 0.14);
      const miniCrateLongGeo = new THREE.BoxGeometry(0.19, 0.052, 0.01);
      const miniCrateShortGeo = new THREE.BoxGeometry(0.01, 0.052, 0.13);
      const heldFruitSphereGeo = new THREE.SphereGeometry(0.028, 10, 8);
      const heldBananaArcGeo = new THREE.TorusGeometry(0.044, 0.013, 7, 10, Math.PI * 0.78);
      const heldCarrotConeGeo = new THREE.ConeGeometry(0.014, 0.115, 8);
      const heldStemGeo = new THREE.BoxGeometry(0.06, 0.008, 0.008);

      const makeMiniCrateBase = (): THREE.Group => {
        const g = new THREE.Group();
        const fl = new THREE.Mesh(miniCrateFloorGeo, crateWoodMat);
        fl.position.y = -0.02;
        const wF = new THREE.Mesh(miniCrateLongGeo, crateWoodMat);
        wF.position.set(0, 0.008, 0.066);
        const wB = new THREE.Mesh(miniCrateLongGeo, crateWoodMat);
        wB.position.set(0, 0.008, -0.066);
        const wL = new THREE.Mesh(miniCrateShortGeo, crateWoodMat);
        wL.position.set(-0.091, 0.008, 0);
        const wR = new THREE.Mesh(miniCrateShortGeo, crateWoodMat);
        wR.position.set(0.091, 0.008, 0);
        g.add(fl, wF, wB, wL, wR);
        return g;
      };

      // 1) Pommes Golden de France
      const pommesG = makeMiniCrateBase();
      [-0.055, 0, 0.055].forEach((px) => {
        [-0.028, 0.028].forEach((pz) => {
          const ap = new THREE.Mesh(heldFruitSphereGeo, appleGoldenMat);
          ap.position.set(px, 0.015, pz);
          pommesG.add(ap);
        });
      });
      pommesG.rotation.set(0.28, -0.28, 0.05);
      this.heldMeshes.produce_pommes = pommesG;

      // 2) Bananes des Antilles
      const bananesG = makeMiniCrateBase();
      [-0.045, 0, 0.045].forEach((px, idx) => {
        const bn = new THREE.Mesh(heldBananaArcGeo, bananaYellowMat);
        bn.position.set(px, 0.022, (idx - 1) * 0.012);
        bn.rotation.set(0.4, idx * 0.25, 0.55);
        bananesG.add(bn);
      });
      bananesG.rotation.set(0.28, -0.28, 0.05);
      this.heldMeshes.produce_bananes = bananesG;

      // 3) Oranges à Jus
      const orangesG = makeMiniCrateBase();
      [-0.055, 0, 0.055].forEach((px) => {
        [-0.028, 0.028].forEach((pz) => {
          const or = new THREE.Mesh(heldFruitSphereGeo, orangeFruitMat);
          or.position.set(px, 0.016, pz);
          orangesG.add(or);
        });
      });
      orangesG.rotation.set(0.28, -0.28, 0.05);
      this.heldMeshes.produce_oranges = orangesG;

      // 4) Tomates Rondes en Grappe
      const tomatesG = makeMiniCrateBase();
      [-0.052, 0, 0.052].forEach((px) => {
        [-0.026, 0.026].forEach((pz) => {
          const tm = new THREE.Mesh(heldFruitSphereGeo, tomatoRedMat);
          tm.scale.set(1, 0.88, 1);
          tm.position.set(px, 0.013, pz);
          tomatesG.add(tm);
        });
      });
      const vine = new THREE.Mesh(heldStemGeo, stemGreenMat);
      vine.position.set(0, 0.042, 0);
      tomatesG.add(vine);
      tomatesG.rotation.set(0.28, -0.28, 0.05);
      this.heldMeshes.produce_tomates = tomatesG;

      // 5) Carottes Nouvelles Lavées
      const carottesG = makeMiniCrateBase();
      [-0.04, -0.012, 0.016, 0.044].forEach((pz, idx) => {
        const cr = new THREE.Mesh(heldCarrotConeGeo, carrotOrangeMat);
        cr.rotation.z = Math.PI / 2 - 0.12;
        cr.position.set(idx % 2 === 0 ? -0.01 : 0.01, 0.018, pz);
        carottesG.add(cr);
      });
      const leaves = new THREE.Mesh(heldStemGeo, stemGreenMat);
      leaves.position.set(-0.072, 0.028, 0);
      carottesG.add(leaves);
      carottesG.rotation.set(0.28, -0.28, 0.05);
      this.heldMeshes.produce_carottes = carottesG;

      // 6) Pommes de Terre Bintje (Sac 2,5kg burlap/net sack)
      const pdtG = new THREE.Group();
      const pdtBody = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.21, 0.095), burlapMat);
      const pdtBand = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.068, 0.098), potatoNetMat);
      pdtBand.position.y = 0.015;
      const pdtNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.062, 0.04, 10), burlapMat);
      pdtNeck.position.y = 0.12;
      pdtG.add(pdtBody, pdtBand, pdtNeck);
      pdtG.rotation.set(0.18, -0.32, 0.06);
      this.heldMeshes.produce_pommes_de_terre = pdtG;

      // 7) Weighed & Barcode-Stickered Produce Bag ("Sachet Primeur Pesé & Étiqueté")
      const weighedG = new THREE.Group();
      const wbBody = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), produceBagMat);
      wbBody.scale.set(1.05, 1.15, 0.85);
      const wbKnot = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.06, 8), produceBagMat);
      wbKnot.position.y = 0.115;
      const wbFruit1 = new THREE.Mesh(heldFruitSphereGeo, appleGoldenMat);
      wbFruit1.position.set(-0.028, -0.01, 0.01);
      const wbFruit2 = new THREE.Mesh(heldFruitSphereGeo, orangeFruitMat);
      wbFruit2.position.set(0.028, -0.015, 0.012);
      const wbFruit3 = new THREE.Mesh(heldFruitSphereGeo, tomatoRedMat);
      wbFruit3.position.set(0, 0.025, -0.01);
      const wbSticker = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.052, 0.006), weightStickerMat);
      wbSticker.position.set(0, 0.01, 0.076);
      const wbHeader = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.012, 0.007), stickerBarMat);
      wbHeader.position.set(0, 0.028, 0.077);
      weighedG.add(wbBody, wbKnot, wbFruit1, wbFruit2, wbFruit3, wbSticker, wbHeader);
      weighedG.rotation.set(0.14, -0.26, 0.05);
      this.heldMeshes.produce_weighed_bag = weighedG;

      ctx.disposables.push(
        crateWoodMat,
        appleGoldenMat,
        bananaYellowMat,
        orangeFruitMat,
        tomatoRedMat,
        stemGreenMat,
        carrotOrangeMat,
        burlapMat,
        potatoNetMat,
        produceBagMat,
        weightStickerMat,
        stickerBarMat,
        miniCrateFloorGeo,
        miniCrateLongGeo,
        miniCrateShortGeo,
        heldFruitSphereGeo,
        heldBananaArcGeo,
        heldCarrotConeGeo,
        heldStemGeo,
        pdtBody.geometry,
        pdtBand.geometry,
        pdtNeck.geometry,
        wbBody.geometry,
        wbKnot.geometry,
        wbSticker.geometry,
        wbHeader.geometry
      );
    }

    // --- V17 Dairy, Cheese & Yogurt Held 3D Props (Rayon 5 — Crémerie & Fromages 1990) ---
    {
      const milkWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.34 });
      const milkCapRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.36 });
      const milkCapBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.36 });
      const shrinkWrapMat = new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        transparent: true,
        opacity: 0.42,
        roughness: 0.16,
      });
      const creamBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.42 });
      const yogurtSkyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.38 });
      const fruitPinkMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4 });
      const fruitPeachMat = new THREE.MeshStandardMaterial({ color: 0xfb923c, roughness: 0.4 });
      const chocoCupMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.42 });
      const camembertWoodMat = new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.78 });
      const camembertLblMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.56 });
      const emmentalGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.46 });
      const butterFoilGoldMat = new THREE.MeshStandardMaterial({
        color: 0xeab308,
        roughness: 0.22,
        metalness: 0.65,
      });
      const butterBandMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.45 });
      const dairyPavCbMat = new THREE.MeshStandardMaterial({ color: 0xb68d65, roughness: 0.85 });

      const dairyPavTrayGeo = new THREE.BoxGeometry(0.19, 0.055, 0.24);
      const miniTubGeo = new THREE.CylinderGeometry(0.028, 0.023, 0.055, 10);
      const miniPotGeo = new THREE.CylinderGeometry(0.024, 0.02, 0.048, 10);
      const miniEmBagGeo = new THREE.BoxGeometry(0.072, 0.095, 0.028);

      // 1) Lait Frais Entier 1L (White milk bottle with red cap)
      const laitEntierG = new THREE.Group();
      const leBody = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.165, 14), milkWhiteMat);
      const leNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.042, 0.048, 14), milkWhiteMat);
      leNeck.position.y = 0.105;
      const leCap = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.018, 12), milkCapRedMat);
      leCap.position.y = 0.136;
      const leBand = new THREE.Mesh(new THREE.CylinderGeometry(0.0445, 0.0445, 0.062, 14, 1, true), milkCapRedMat);
      leBand.position.y = 0.01;
      laitEntierG.add(leBody, leNeck, leCap, leBand);
      laitEntierG.rotation.set(0.14, -0.25, 0.05);
      this.heldMeshes.dairy_lait_entier = laitEntierG;

      // 2) Pack Lait Demi-Écrémé 6x1L (Shrink-wrapped 6-pack with blue caps)
      const pack6G = new THREE.Group();
      const miniMilkGeo = new THREE.CylinderGeometry(0.026, 0.027, 0.135, 10);
      const miniCapGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.014, 8);
      for (let ix = -1; ix <= 1; ix++) {
        [-0.032, 0.032].forEach((iz) => {
          const mb = new THREE.Mesh(miniMilkGeo, milkWhiteMat);
          mb.position.set(ix * 0.058, 0, iz);
          const mc = new THREE.Mesh(miniCapGeo, milkCapBlueMat);
          mc.position.set(ix * 0.058, 0.074, iz);
          pack6G.add(mb, mc);
        });
      }
      const p6Wrap = new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.145, 0.125), shrinkWrapMat);
      const p6Band = new THREE.Mesh(new THREE.BoxGeometry(0.187, 0.038, 0.127), milkCapBlueMat);
      p6Band.position.y = -0.02;
      pack6G.add(p6Wrap, p6Band);
      pack6G.rotation.set(0.22, -0.32, 0.05);
      this.heldMeshes.dairy_lait_pack6 = pack6G;

      // 3) Crème Fraîche Normandie 50cl (PAV Tray & Single Tub)
      const cremePavG = new THREE.Group();
      cremePavG.add(new THREE.Mesh(dairyPavTrayGeo, dairyPavCbMat));
      for (let iz = 0; iz < 3; iz++) {
        [-0.042, 0.042].forEach((ix) => {
          const mt = new THREE.Mesh(miniTubGeo, milkWhiteMat);
          mt.position.set(ix, 0.035, -0.068 + iz * 0.068);
          cremePavG.add(mt);
        });
      }
      cremePavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.dairy_creme_pav = cremePavG;

      const cremeTubG = new THREE.Group();
      const ctBody = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.043, 0.095, 14), milkWhiteMat);
      const ctLid = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.014, 14), creamBlueMat);
      ctLid.position.y = 0.052;
      const ctBand = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.047, 0.032, 14, 1, true), creamBlueMat);
      cremeTubG.add(ctBody, ctLid, ctBand);
      cremeTubG.rotation.set(0.18, -0.25, 0.05);
      this.heldMeshes.dairy_creme_tub = cremeTubG;

      // 4) Yaourts Nature Brassés x8 (PAV Tray & Pack)
      const ynPavG = new THREE.Group();
      ynPavG.add(new THREE.Mesh(dairyPavTrayGeo, dairyPavCbMat));
      for (let iz = 0; iz < 3; iz++) {
        [-0.042, 0.042].forEach((ix) => {
          const mp = new THREE.Mesh(miniPotGeo, milkWhiteMat);
          mp.position.set(ix, 0.032, -0.068 + iz * 0.068);
          ynPavG.add(mp);
        });
      }
      ynPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.dairy_yaourt_nature_pav = ynPavG;

      const ynPackG = new THREE.Group();
      const ynCard = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.058, 0.088), yogurtSkyMat);
      ynPackG.add(ynCard);
      ynPackG.rotation.set(0.25, -0.3, 0.05);
      this.heldMeshes.dairy_yaourt_nature_pack = ynPackG;

      // 5) Yaourts aux Fruits Mixés x8 (PAV Tray & Pack)
      const yfPavG = new THREE.Group();
      yfPavG.add(new THREE.Mesh(dairyPavTrayGeo, dairyPavCbMat));
      for (let iz = 0; iz < 3; iz++) {
        [-0.042, 0.042].forEach((ix, cIdx) => {
          const mp = new THREE.Mesh(miniPotGeo, (iz + cIdx) % 2 === 0 ? fruitPinkMat : fruitPeachMat);
          mp.position.set(ix, 0.032, -0.068 + iz * 0.068);
          yfPavG.add(mp);
        });
      }
      yfPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.dairy_yaourt_fruits_pav = yfPavG;

      const yfPackG = new THREE.Group();
      const yfCard = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.058, 0.088), fruitPinkMat);
      const yfStripe = new THREE.Mesh(new THREE.BoxGeometry(0.157, 0.022, 0.09), fruitPeachMat);
      yfStripe.position.y = 0.015;
      yfPackG.add(yfCard, yfStripe);
      yfPackG.rotation.set(0.25, -0.3, 0.05);
      this.heldMeshes.dairy_yaourt_fruits_pack = yfPackG;

      // 6) Crèmes Dessert Chocolat x4 (PAV Tray & Pack)
      const chPavG = new THREE.Group();
      chPavG.add(new THREE.Mesh(dairyPavTrayGeo, dairyPavCbMat));
      for (let iz = 0; iz < 3; iz++) {
        [-0.042, 0.042].forEach((ix) => {
          const mp = new THREE.Mesh(miniPotGeo, chocoCupMat);
          mp.position.set(ix, 0.032, -0.068 + iz * 0.068);
          chPavG.add(mp);
        });
      }
      chPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.dairy_creme_choco_pav = chPavG;

      const chPackG = new THREE.Group();
      const chCard = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.055, 0.082), chocoCupMat);
      const chBand = new THREE.Mesh(new THREE.BoxGeometry(0.147, 0.018, 0.084), emmentalGoldMat);
      chBand.position.y = 0.012;
      chPackG.add(chCard, chBand);
      chPackG.rotation.set(0.25, -0.3, 0.05);
      this.heldMeshes.dairy_creme_choco_pack = chPackG;

      // 7) Camembert de Normandie 250g (Round wooden camembert box)
      const camG = new THREE.Group();
      const cmBox = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.036, 18), camembertWoodMat);
      const cmLbl = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.004, 18), camembertLblMat);
      cmLbl.position.y = 0.019;
      const cmRim = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.005, 14), milkCapRedMat);
      cmRim.position.y = 0.02;
      camG.add(cmBox, cmLbl, cmRim);
      camG.rotation.set(0.55, -0.25, 0.08);
      this.heldMeshes.dairy_camembert = camG;

      // 8) Emmental Râpé Sachet 200g (PAV Tray & Single Pouch)
      const emPavG = new THREE.Group();
      emPavG.add(new THREE.Mesh(dairyPavTrayGeo, dairyPavCbMat));
      for (let iz = 0; iz < 4; iz++) {
        [-0.044, 0.044].forEach((ix) => {
          const eb = new THREE.Mesh(miniEmBagGeo, emmentalGoldMat);
          eb.position.set(ix, 0.052, -0.075 + iz * 0.05);
          emPavG.add(eb);
        });
      }
      emPavG.rotation.set(0.22, -0.32, 0.04);
      this.heldMeshes.dairy_emmental_pav = emPavG;

      const emBagG = new THREE.Group();
      const ebBody = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.175, 0.036), emmentalGoldMat);
      const ebStripe = new THREE.Mesh(new THREE.BoxGeometry(0.137, 0.045, 0.038), milkCapRedMat);
      ebStripe.position.y = 0.042;
      emBagG.add(ebBody, ebStripe);
      emBagG.rotation.set(0.18, -0.3, 0.05);
      this.heldMeshes.dairy_emmental_bag = emBagG;

      // 9) Beurre Doux de Baratte 250g (Gold-foil butter block)
      const beurreG = new THREE.Group();
      const brBlock = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.042, 0.078), butterFoilGoldMat);
      const brBand = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.044, 0.08), butterBandMat);
      beurreG.add(brBlock, brBand);
      beurreG.rotation.set(0.35, -0.28, 0.06);
      this.heldMeshes.dairy_beurre = beurreG;

      ctx.disposables.push(
        milkWhiteMat,
        milkCapRedMat,
        milkCapBlueMat,
        shrinkWrapMat,
        creamBlueMat,
        yogurtSkyMat,
        fruitPinkMat,
        fruitPeachMat,
        chocoCupMat,
        camembertWoodMat,
        camembertLblMat,
        emmentalGoldMat,
        butterFoilGoldMat,
        butterBandMat,
        dairyPavCbMat,
        dairyPavTrayGeo,
        miniTubGeo,
        miniPotGeo,
        miniEmBagGeo,
        leBody.geometry,
        leNeck.geometry,
        leCap.geometry,
        leBand.geometry,
        miniMilkGeo,
        miniCapGeo,
        p6Wrap.geometry,
        p6Band.geometry,
        ctBody.geometry,
        ctLid.geometry,
        ctBand.geometry,
        ynCard.geometry,
        yfCard.geometry,
        yfStripe.geometry,
        chCard.geometry,
        chBand.geometry,
        cmBox.geometry,
        cmLbl.geometry,
        cmRim.geometry,
        ebBody.geometry,
        ebStripe.geometry,
        brBlock.geometry,
        brBand.geometry
      );
    }

    // --- V18 Manga, BD & Video Games Held 3D Props (Rayon 11 — Culture Pop 1990) ---
    {
      const consoleBodyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.42 });
      const consoleRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38 });
      const consoleSilverMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 });
      const pongCyanMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.38 });
      const pongNavyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.44 });
      const galaxyVioletMat = new THREE.MeshStandardMaterial({ color: 0x5b21b6, roughness: 0.4 });
      const galaxyPinkMat = new THREE.MeshStandardMaterial({ color: 0xec4899, roughness: 0.38 });
      const voxGreenMat = new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.42 });
      const voxGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.38 });
      const mangaMianMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.56 });
      const mangaYimaiMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.54 });
      const bdClaraMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.5 });
      const pageCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.85 });

      // 1) Console Portable 8-Bit Pack Pong (Chunky boxed console)
      const conG = new THREE.Group();
      const conBox = new THREE.Mesh(new THREE.BoxGeometry(0.195, 0.145, 0.088), consoleBodyMat);
      const conFront = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.105, 0.008), consoleSilverMat);
      conFront.position.set(0, 0.008, 0.045);
      const conStripe = new THREE.Mesh(new THREE.BoxGeometry(0.198, 0.026, 0.09), consoleRedMat);
      conStripe.position.y = -0.048;
      conG.add(conBox, conFront, conStripe);
      conG.rotation.set(0.18, -0.32, 0.05);
      this.heldMeshes.game_console_8bit = conG;

      // 2) Manette Arcade Pro 1990 (Boxed retro arcade pad)
      const padG = new THREE.Group();
      const padBox = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.12, 0.068), pongNavyMat);
      const padAccent = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.032, 0.07), voxGoldMat);
      padAccent.position.y = 0.034;
      const padBtn1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 10), consoleRedMat);
      padBtn1.rotation.x = Math.PI / 2;
      padBtn1.position.set(0.038, -0.01, 0.036);
      const padBtn2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 10), consoleRedMat);
      padBtn2.rotation.x = Math.PI / 2;
      padBtn2.position.set(0.005, -0.02, 0.036);
      padG.add(padBox, padAccent, padBtn1, padBtn2);
      padG.rotation.set(0.18, -0.3, 0.05);
      this.heldMeshes.game_manette_pro = padG;

      // 3) Jeu : Super Pong Championship (1990 boxed cartridge)
      const spG = new THREE.Group();
      const spBox = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.178, 0.032), pongNavyMat);
      const spBand = new THREE.Mesh(new THREE.BoxGeometry(0.127, 0.044, 0.034), pongCyanMat);
      spBand.position.y = 0.048;
      const spPaddle = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.014, 0.035), consoleSilverMat);
      spPaddle.position.y = -0.025;
      spG.add(spBox, spBand, spPaddle);
      spG.rotation.set(0.15, -0.32, 0.04);
      this.heldMeshes.game_super_pong = spG;

      // 4) Jeu : Galaxy Cyber-Quest (1990 boxed cartridge)
      const gcG = new THREE.Group();
      const gcBox = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.178, 0.032), galaxyVioletMat);
      const gcBand = new THREE.Mesh(new THREE.BoxGeometry(0.127, 0.046, 0.034), galaxyPinkMat);
      gcBand.position.y = 0.042;
      const gcStar = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.052, 0.035), voxGoldMat);
      gcStar.rotation.z = Math.PI / 4;
      gcStar.position.y = -0.024;
      gcG.add(gcBox, gcBand, gcStar);
      gcG.rotation.set(0.15, -0.32, 0.04);
      this.heldMeshes.game_galaxy_quest = gcG;

      // 5) Jeu : Voxelitos Adventure (1990 boxed cartridge)
      const vxG = new THREE.Group();
      const vxBox = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.178, 0.032), voxGreenMat);
      const vxBand = new THREE.Mesh(new THREE.BoxGeometry(0.127, 0.046, 0.034), voxGoldMat);
      vxBand.position.y = 0.045;
      const vxGem = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.048, 0.035), consoleRedMat);
      vxGem.position.y = -0.025;
      vxG.add(vxBox, vxBand, vxGem);
      vxG.rotation.set(0.15, -0.32, 0.04);
      this.heldMeshes.game_voxelitos = vxG;

      // 6) Manga : Mianimal Tome 1 (Compact pocket manga volume with cream page block)
      const mmG = new THREE.Group();
      const mmCover = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.168, 0.024), mangaMianMat);
      const mmPages = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.162, 0.02), pageCreamMat);
      mmPages.position.x = 0.004;
      const mmBand = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.036, 0.026), voxGoldMat);
      mmBand.position.y = 0.052;
      mmG.add(mmCover, mmPages, mmBand);
      mmG.rotation.set(0.16, -0.3, 0.04);
      this.heldMeshes.manga_mianimal = mmG;

      // 7) Manga : Les Yimai Tome 1
      const myG = new THREE.Group();
      const myCover = new THREE.Mesh(new THREE.BoxGeometry(0.112, 0.168, 0.024), mangaYimaiMat);
      const myPages = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.162, 0.02), pageCreamMat);
      myPages.position.x = 0.004;
      const myBand = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.036, 0.026), consoleRedMat);
      myBand.position.y = 0.052;
      myG.add(myCover, myPages, myBand);
      myG.rotation.set(0.16, -0.3, 0.04);
      this.heldMeshes.manga_yimai = myG;

      // 8) BD : Clara Godwaie & Louis (Tall French hardcover comic album)
      const bdG = new THREE.Group();
      const bdCover = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.215, 0.018), bdClaraMat);
      const bdPages = new THREE.Mesh(new THREE.BoxGeometry(0.142, 0.208, 0.014), pageCreamMat);
      bdPages.position.x = 0.004;
      const bdSpine = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.216, 0.02), consoleRedMat);
      bdSpine.position.x = -0.068;
      const bdTitle = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.042, 0.02), pageCreamMat);
      bdTitle.position.set(0.008, 0.068, 0);
      bdG.add(bdCover, bdPages, bdSpine, bdTitle);
      bdG.rotation.set(0.14, -0.32, 0.04);
      this.heldMeshes.bd_clara_louis = bdG;

      ctx.disposables.push(
        consoleBodyMat,
        consoleRedMat,
        consoleSilverMat,
        pongCyanMat,
        pongNavyMat,
        galaxyVioletMat,
        galaxyPinkMat,
        voxGreenMat,
        voxGoldMat,
        mangaMianMat,
        mangaYimaiMat,
        bdClaraMat,
        pageCreamMat,
        conBox.geometry,
        conFront.geometry,
        conStripe.geometry,
        padBox.geometry,
        padAccent.geometry,
        padBtn1.geometry,
        padBtn2.geometry,
        spBox.geometry,
        spBand.geometry,
        spPaddle.geometry,
        gcBox.geometry,
        gcBand.geometry,
        gcStar.geometry,
        vxBox.geometry,
        vxBand.geometry,
        vxGem.geometry,
        mmCover.geometry,
        mmPages.geometry,
        mmBand.geometry,
        myCover.geometry,
        myPages.geometry,
        myBand.geometry,
        bdCover.geometry,
        bdPages.geometry,
        bdSpine.geometry,
        bdTitle.geometry
      );
    }

    // --- V18 Grab-and-Go Snacking Held 3D Props (Rayon 11 — Snacking Frais +4°C) ---
    {
      const aluSilverMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.24,
        metalness: 0.82,
      });
      const canRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.28, metalness: 0.55 });
      const canGreenMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.28, metalness: 0.55 });
      const canOrangeMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.28, metalness: 0.55 });
      const canWhiteBandMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
      const sandBreadMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.82 });
      const sandHamMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.52 });
      const sandCheeseMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.46 });
      const sandLettuceMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.62 });
      const sandTomatoMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.42 });
      const sandTunaMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, roughness: 0.6 });
      const sandEggMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.48 });
      const snkPavCbMat = new THREE.MeshStandardMaterial({ color: 0xb68d65, roughness: 0.85 });
      const chocoWrapMat = new THREE.MeshStandardMaterial({ color: 0x5c2d16, roughness: 0.38 });
      const madWrapMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.38 });
      const cookWrapMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.38 });

      const heldCanGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.128, 14);
      const heldCanLidGeo = new THREE.CylinderGeometry(0.034, 0.036, 0.01, 14);
      const heldCanStripeGeo = new THREE.CylinderGeometry(0.037, 0.037, 0.036, 14, 1, true);

      const makeHeldCan = (mainMat: THREE.Material): THREE.Group => {
        const g = new THREE.Group();
        const body = new THREE.Mesh(heldCanGeo, mainMat);
        const lid = new THREE.Mesh(heldCanLidGeo, aluSilverMat);
        lid.position.y = 0.068;
        const band = new THREE.Mesh(heldCanStripeGeo, canWhiteBandMat);
        band.position.y = 0.01;
        g.add(body, lid, band);
        g.rotation.set(0.16, -0.25, 0.05);
        return g;
      };
      this.heldMeshes.snacking_can_cola = makeHeldCan(canRedMat);
      this.heldMeshes.snacking_can_limonade = makeHeldCan(canGreenMat);
      this.heldMeshes.snacking_can_orange = makeHeldCan(canOrangeMat);

      // Triangle Sandwich ExtrudeGeometry (wedge prism)
      const heldTriShape = new THREE.Shape();
      heldTriShape.moveTo(-0.065, -0.05);
      heldTriShape.lineTo(0.065, -0.05);
      heldTriShape.lineTo(-0.065, 0.08);
      heldTriShape.closePath();
      const heldSandGeo = new THREE.ExtrudeGeometry(heldTriShape, { depth: 0.064, bevelEnabled: false });
      heldSandGeo.translate(0, 0, -0.032);
      const heldFillGeo = new THREE.BoxGeometry(0.012, 0.11, 0.066);

      const makeHeldSandwich = (f1: THREE.Material, f2: THREE.Material): THREE.Group => {
        const g = new THREE.Group();
        const wedge = new THREE.Mesh(heldSandGeo, sandBreadMat);
        const l1 = new THREE.Mesh(heldFillGeo, f1);
        l1.position.set(-0.004, 0.014, 0);
        l1.rotation.z = 0.78;
        const l2 = new THREE.Mesh(heldFillGeo, f2);
        l2.position.set(0.006, 0.008, 0);
        l2.rotation.z = 0.78;
        g.add(wedge, l1, l2);
        g.rotation.set(0.22, -0.32, 0.06);
        return g;
      };
      this.heldMeshes.snacking_sand_jambon = makeHeldSandwich(sandHamMat, sandCheeseMat);
      this.heldMeshes.snacking_sand_poulet = makeHeldSandwich(sandLettuceMat, sandTomatoMat);
      this.heldMeshes.snacking_sand_thon = makeHeldSandwich(sandTunaMat, sandEggMat);

      // Slim PAV Trays & Individual Wrapped Cakes (Choco Cake, Madeleine, Cookie)
      const snkPavGeo = new THREE.BoxGeometry(0.185, 0.052, 0.24);
      const miniCakeGeo = new THREE.BoxGeometry(0.068, 0.026, 0.048);
      const heldCakeGeo = new THREE.BoxGeometry(0.115, 0.038, 0.075);
      const heldCookieGeo = new THREE.CylinderGeometry(0.048, 0.048, 0.022, 14);

      const makeCakePav = (wrapMat: THREE.Material): THREE.Group => {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(snkPavGeo, snkPavCbMat));
        for (let iz = 0; iz < 4; iz++) {
          [-0.044, 0.044].forEach((ix) => {
            const p = new THREE.Mesh(miniCakeGeo, wrapMat);
            p.position.set(ix, 0.032, -0.078 + iz * 0.052);
            g.add(p);
          });
        }
        g.rotation.set(0.22, -0.32, 0.04);
        return g;
      };
      this.heldMeshes.snacking_cake_choco_pav = makeCakePav(chocoWrapMat);
      this.heldMeshes.snacking_madeleine_pav = makeCakePav(madWrapMat);
      this.heldMeshes.snacking_cookie_pav = makeCakePav(cookWrapMat);

      const chocoUnit = new THREE.Mesh(heldCakeGeo, chocoWrapMat);
      chocoUnit.rotation.set(0.28, -0.3, 0.05);
      this.heldMeshes.snacking_cake_choco_unit = chocoUnit;

      const madUnit = new THREE.Mesh(heldCakeGeo, madWrapMat);
      madUnit.rotation.set(0.28, -0.3, 0.05);
      this.heldMeshes.snacking_madeleine_unit = madUnit;

      const cookUnit = new THREE.Mesh(heldCookieGeo, cookWrapMat);
      cookUnit.rotation.set(0.55, -0.25, 0.06);
      this.heldMeshes.snacking_cookie_unit = cookUnit;

      ctx.disposables.push(
        aluSilverMat,
        canRedMat,
        canGreenMat,
        canOrangeMat,
        canWhiteBandMat,
        sandBreadMat,
        sandHamMat,
        sandCheeseMat,
        sandLettuceMat,
        sandTomatoMat,
        sandTunaMat,
        sandEggMat,
        snkPavCbMat,
        chocoWrapMat,
        madWrapMat,
        cookWrapMat,
        heldCanGeo,
        heldCanLidGeo,
        heldCanStripeGeo,
        heldSandGeo,
        heldFillGeo,
        snkPavGeo,
        miniCakeGeo,
        heldCakeGeo,
        heldCookieGeo
      );
    }

    // V19 Point Café & Snacking Chaud (Rayon 3) First-Person Held Meshes
    {
      const breadMat = new THREE.MeshStandardMaterial({ color: 0xd49449, roughness: 0.72 });
      const cheeseMat = new THREE.MeshStandardMaterial({ color: 0xf6d365, roughness: 0.48 });
      const hamMat = new THREE.MeshStandardMaterial({ color: 0xf48c94, roughness: 0.58 });
      const grillMat = new THREE.MeshStandardMaterial({ color: 0x45220e, roughness: 0.85 });
      const paperMat = new THREE.MeshStandardMaterial({ color: 0xf8f3e6, roughness: 0.8 });
      const quicheMat = new THREE.MeshStandardMaterial({ color: 0xf5d67b, roughness: 0.52 });
      const crustMat = new THREE.MeshStandardMaterial({ color: 0xc98b3e, roughness: 0.76 });
      const beansBagMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.48, metalness: 0.12 });
      const beansGoldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.35 });
      const cupCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 });
      const cupBrownMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.62 });
      const cremaMat = new THREE.MeshStandardMaterial({ color: 0x5c2e14, roughness: 0.32 });

      // 1. Croque-Monsieur Jambon-Fromage
      const croqueG = new THREE.Group();
      const crB1Geo = new THREE.BoxGeometry(0.115, 0.015, 0.115);
      const crHamGeo = new THREE.BoxGeometry(0.108, 0.008, 0.108);
      const crChGeo = new THREE.BoxGeometry(0.11, 0.009, 0.11);
      const crB1 = new THREE.Mesh(crB1Geo, breadMat);
      const crHam = new THREE.Mesh(crHamGeo, hamMat);
      crHam.position.y = 0.011;
      const crB2 = new THREE.Mesh(crB1Geo, breadMat);
      crB2.position.y = 0.022;
      const crCh = new THREE.Mesh(crChGeo, cheeseMat);
      crCh.position.y = 0.032;
      croqueG.add(crB1, crHam, crB2, crCh);
      croqueG.rotation.set(0.28, -0.3, 0.06);
      this.heldMeshes.cafe_croque_monsieur = croqueG;

      // 2. Panini Jambon-Emmental Grillé
      const paniniG = new THREE.Group();
      const panBodyGeo = new THREE.BoxGeometry(0.105, 0.042, 0.18);
      const panBarGeo = new THREE.BoxGeometry(0.108, 0.004, 0.01);
      const panSleeveGeo = new THREE.BoxGeometry(0.112, 0.046, 0.072);
      const panBody = new THREE.Mesh(panBodyGeo, breadMat);
      const panSleeve = new THREE.Mesh(panSleeveGeo, paperMat);
      panSleeve.position.z = -0.052;
      paniniG.add(panBody, panSleeve);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(panBarGeo, grillMat);
        b.position.set(0, 0.022, -0.015 + i * 0.03);
        b.rotation.y = 0.25;
        paniniG.add(b);
      }
      paniniG.rotation.set(0.24, -0.35, 0.05);
      this.heldMeshes.cafe_panini = paniniG;

      // 3. Part de Quiche Lorraine Chaude
      const quicheG = new THREE.Group();
      const qShape = new THREE.Shape();
      qShape.moveTo(0, 0.08);
      qShape.lineTo(-0.065, -0.05);
      qShape.lineTo(0.065, -0.05);
      qShape.closePath();
      const qGeo = new THREE.ExtrudeGeometry(qShape, { depth: 0.034, bevelEnabled: false });
      qGeo.rotateX(-Math.PI / 2);
      const qRimGeo = new THREE.BoxGeometry(0.132, 0.038, 0.015);
      const qWedge = new THREE.Mesh(qGeo, quicheMat);
      const qRim = new THREE.Mesh(qRimGeo, crustMat);
      qRim.position.set(0, 0.018, -0.054);
      quicheG.add(qWedge, qRim);
      quicheG.rotation.set(0.28, -0.28, 0.06);
      this.heldMeshes.cafe_quiche_lorraine = quicheG;

      // 4. Café Grain Torréfié 1kg (Foil Bag)
      const beansG = new THREE.Group();
      const bBagGeo = new THREE.BoxGeometry(0.135, 0.21, 0.082);
      const bBandGeo = new THREE.BoxGeometry(0.138, 0.06, 0.085);
      const bBag = new THREE.Mesh(bBagGeo, beansBagMat);
      const bBand = new THREE.Mesh(bBandGeo, beansGoldMat);
      bBand.position.y = 0.015;
      beansG.add(bBag, bBand);
      beansG.rotation.set(0.15, -0.28, 0.04);
      this.heldMeshes.cafe_beans_bag = beansG;

      // 5. Lot Gobelets Café x50 (Stacked Paper Cup Sleeve)
      const sleeveG = new THREE.Group();
      const slvGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.26, 16);
      const slvRingGeo = new THREE.CylinderGeometry(0.044, 0.044, 0.025, 16);
      const slvMesh = new THREE.Mesh(slvGeo, cupCreamMat);
      const slvBand = new THREE.Mesh(slvRingGeo, cupBrownMat);
      slvBand.position.y = 0.02;
      sleeveG.add(slvMesh, slvBand);
      sleeveG.rotation.set(0.22, -0.25, 0.14);
      this.heldMeshes.cafe_cup_sleeve = sleeveG;

      // 6. Single Empty Paper Coffee Cup
      const cupGeo = new THREE.CylinderGeometry(0.038, 0.027, 0.092, 16);
      const cupBandGeo = new THREE.CylinderGeometry(0.036, 0.031, 0.03, 16);
      const emptyCupG = new THREE.Group();
      emptyCupG.add(new THREE.Mesh(cupGeo, cupCreamMat));
      const eBand = new THREE.Mesh(cupBandGeo, cupBrownMat);
      eBand.position.y = 0.004;
      emptyCupG.add(eBand);
      emptyCupG.rotation.set(0.18, -0.25, 0.05);
      this.heldMeshes.cafe_paper_cup_empty = emptyCupG;

      // 7. Steaming Fresh Espresso Cup (4,00 ₣)
      const espCupG = new THREE.Group();
      espCupG.add(new THREE.Mesh(cupGeo, cupCreamMat));
      const fBand = new THREE.Mesh(cupBandGeo, cupBrownMat);
      fBand.position.y = 0.004;
      const cremaGeo = new THREE.CylinderGeometry(0.034, 0.032, 0.008, 14);
      const cremaMesh = new THREE.Mesh(cremaGeo, cremaMat);
      cremaMesh.position.y = 0.036;
      espCupG.add(fBand, cremaMesh);
      espCupG.rotation.set(0.22, -0.25, 0.04);
      this.heldMeshes.cafe_espresso_cup = espCupG;

      ctx.disposables.push(
        breadMat,
        cheeseMat,
        hamMat,
        grillMat,
        paperMat,
        quicheMat,
        crustMat,
        beansBagMat,
        beansGoldMat,
        cupCreamMat,
        cupBrownMat,
        cremaMat,
        crB1Geo,
        crHamGeo,
        crChGeo,
        panBodyGeo,
        panBarGeo,
        panSleeveGeo,
        qGeo,
        qRimGeo,
        bBagGeo,
        bBandGeo,
        slvGeo,
        slvRingGeo,
        cupGeo,
        cupBandGeo,
        cremaGeo
      );
    }

    Object.values(this.heldMeshes).forEach((obj) => {
      if (obj && obj !== heldLabelMesh) {
        obj.visible = false;
        this.heldPropGroup.add(obj);
      }
    });

    this.redrawLabelerLcd();
    this.redrawScannerLcd();
    this.syncViewmodelVisibility();

    // Smooth per-frame viewmodel animations & individual 3D rubber key springs
    ctx.updaters.push({
      update: (dt, elapsed) => {
        const isPortrait = this.camera.aspect < 0.82;

        // 1) Étiqueteuse 1990 posture & key springs
        const targetLX = this.labelerRaised ? this.inspectPanX : 0.28;
        const targetLY = this.labelerRaised
          ? (isPortrait ? -0.01 : -0.015) + this.inspectPanY
          : -0.25;
        const targetLZ = this.labelerRaised ? (isPortrait ? -0.355 : -0.31) : -0.46;
        const targetRotY = this.labelerRaised ? 0.0 : -0.26;
        const targetRotX = this.labelerRaised ? -0.025 : 0.16;
        const targetRotZ = this.labelerRaised ? 0.0 : 0.04;

        this.labelerGroup.position.x = THREE.MathUtils.damp(this.labelerGroup.position.x, targetLX, 12, dt);
        this.labelerGroup.position.y = THREE.MathUtils.damp(this.labelerGroup.position.y, targetLY, 12, dt);
        this.labelerGroup.position.z = THREE.MathUtils.damp(this.labelerGroup.position.z, targetLZ, 12, dt);
        this.labelerGroup.rotation.y = THREE.MathUtils.damp(this.labelerGroup.rotation.y, targetRotY, 12, dt);
        this.labelerGroup.rotation.x = THREE.MathUtils.damp(this.labelerGroup.rotation.x, targetRotX, 12, dt);
        this.labelerGroup.rotation.z = THREE.MathUtils.damp(this.labelerGroup.rotation.z, targetRotZ, 12, dt);

        this.animateKeys(this.labelerKeys, dt);

        if (this.hasPrintedLabel) {
          this.labelerSlipMesh.visible = true;
          this.labelerExtrudeAnim = Math.min(1, this.labelerExtrudeAnim + dt * 3.8);
          this.labelerSlipMesh.position.y = THREE.MathUtils.lerp(0.088, 0.118, this.labelerExtrudeAnim);
        } else {
          this.labelerSlipMesh.visible = false;
          this.labelerExtrudeAnim = 0;
        }

        if (this.labelerStatusTimer > 0) {
          this.labelerStatusTimer = Math.max(0, this.labelerStatusTimer - dt);
          if (this.labelerStatusTimer === 0) {
            this.labelerStatus = this.hasPrintedLabel
              ? 'TOUCHER ÉTIQUETTE ↑'
              : this.inputMode === 'code'
                ? 'TAPEZ EAN-8 OU [CODE]'
                : 'PRÊT — CLAVIER 3D';
            this.labelerLcdDirty = true;
          }
        }

        if (this.labelerLcdDirty) {
          this.labelerLcdDirty = false;
          this.redrawLabelerLcd();
        }

        // 2) Terminal Scan 1990 posture, laser beam decay & key springs
        this.scannerRecoil = THREE.MathUtils.damp(this.scannerRecoil, 0, 16, dt);
        const targetSX = this.scannerRaised ? this.inspectPanX : isPortrait ? 0.19 : 0.25;
        const targetSY = this.scannerRaised
          ? (isPortrait ? -0.005 : -0.01) + this.inspectPanY
          : -0.2 + Math.sin(elapsed * 2.1) * 0.0025;
        const targetSZ =
          (this.scannerRaised ? (isPortrait ? -0.34 : -0.3) : -0.43) + this.scannerRecoil * 0.022;
        const targetSRotY = this.scannerRaised ? 0.0 : -0.22;
        const targetSRotX = this.scannerRaised ? -0.02 : 0.12;
        const targetSRotZ = this.scannerRaised ? 0.0 : 0.03;

        this.scannerGroup.position.x = THREE.MathUtils.damp(this.scannerGroup.position.x, targetSX, 12, dt);
        this.scannerGroup.position.y = THREE.MathUtils.damp(this.scannerGroup.position.y, targetSY, 12, dt);
        this.scannerGroup.position.z = THREE.MathUtils.damp(this.scannerGroup.position.z, targetSZ, 12, dt);
        this.scannerGroup.rotation.y = THREE.MathUtils.damp(this.scannerGroup.rotation.y, targetSRotY, 12, dt);
        this.scannerGroup.rotation.x = THREE.MathUtils.damp(this.scannerGroup.rotation.x, targetSRotX, 12, dt);
        this.scannerGroup.rotation.z = THREE.MathUtils.damp(this.scannerGroup.rotation.z, targetSRotZ, 12, dt);

        this.animateKeys(this.scannerKeys, dt);

        if (this.scannerLaserTimer > 0) {
          this.scannerLaserTimer = Math.max(0, this.scannerLaserTimer - dt);
          this.scannerEmitterMat.emissiveIntensity = 1.45;
          this.scannerStatusLedMat.emissiveIntensity = 1.1;
          if (this.scannerLaserTimer === 0) {
            this.scannerLaserMesh.visible = false;
            this.scannerEmitterMat.emissiveIntensity = 0.38;
            this.scannerStatusLedMat.emissiveIntensity = 0.3;
          }
        }

        if (this.scannerStatusTimer > 0) {
          this.scannerStatusTimer = Math.max(0, this.scannerStatusTimer - dt);
          if (this.scannerStatusTimer === 0) {
            this.scannerStatus = this.scannedProduct
              ? this.scannerTransferred
                ? 'TRANSFÉRÉ → ÉTIQUETEUSE'
                : 'APPUYEZ [TRANSFERT ÉTIQ.]'
              : 'PRÊT — VISEZ UN PRODUIT';
            this.scannerLcdDirty = true;
          }
        }

        if (this.scannerLcdDirty) {
          this.scannerLcdDirty = false;
          this.redrawScannerLcd();
        }

        // 2B) Terminal Commande 1990 posture, modem flash & key springs
        const targetOX = this.ordererRaised ? this.inspectPanX : isPortrait ? 0.2 : 0.26;
        const targetOY = this.ordererRaised
          ? (isPortrait ? -0.005 : -0.012) + this.inspectPanY
          : -0.23 + Math.sin(elapsed * 1.9) * 0.0025;
        const targetOZ = this.ordererRaised ? (isPortrait ? -0.35 : -0.305) : -0.45;
        const targetORotY = this.ordererRaised ? 0.0 : -0.24;
        const targetORotX = this.ordererRaised ? -0.02 : 0.15;
        const targetORotZ = this.ordererRaised ? 0.0 : 0.03;

        this.ordererGroup.position.x = THREE.MathUtils.damp(this.ordererGroup.position.x, targetOX, 12, dt);
        this.ordererGroup.position.y = THREE.MathUtils.damp(this.ordererGroup.position.y, targetOY, 12, dt);
        this.ordererGroup.position.z = THREE.MathUtils.damp(this.ordererGroup.position.z, targetOZ, 12, dt);
        this.ordererGroup.rotation.y = THREE.MathUtils.damp(this.ordererGroup.rotation.y, targetORotY, 12, dt);
        this.ordererGroup.rotation.x = THREE.MathUtils.damp(this.ordererGroup.rotation.x, targetORotX, 12, dt);
        this.ordererGroup.rotation.z = THREE.MathUtils.damp(this.ordererGroup.rotation.z, targetORotZ, 12, dt);

        this.animateKeys(this.ordererKeys, dt);

        if (this.ordererModemFlash > 0) {
          this.ordererModemFlash = Math.max(0, this.ordererModemFlash - dt);
          this.ordererModemLedMat.emissiveIntensity =
            0.4 + Math.abs(Math.sin(elapsed * 28)) * 1.1;
        } else {
          this.ordererModemLedMat.emissiveIntensity = 0.3;
        }

        // 3) Utility cutter slash motion
        if (this.cutterSlashAnim > 0) {
          this.cutterSlashAnim = Math.max(0, this.cutterSlashAnim - dt * 5.2);
          const s = Math.sin(this.cutterSlashAnim * Math.PI);
          this.cutterGroup.position.set(0.27 - s * 0.12, -0.24 + s * 0.05, -0.44 - s * 0.14);
          this.cutterGroup.rotation.set(0.18 - s * 0.32, -0.35 + s * 0.42, 0.14 + s * 0.45);
        } else {
          this.cutterGroup.position.set(0.27, -0.24 + Math.sin(elapsed * 1.8) * 0.003, -0.44);
          this.cutterGroup.rotation.set(0.18, -0.35, 0.14);
        }

        // 4) Held item subtle breathing + squeaky ball squash-and-stretch
        if (this.heldSqueezeAnim > 0) {
          this.heldSqueezeAnim = Math.max(0, this.heldSqueezeAnim - dt * 5.5);
          const sq = Math.sin(this.heldSqueezeAnim * Math.PI);
          this.heldPropGroup.scale.set(1 + sq * 0.22, 1 - sq * 0.28, 1 + sq * 0.22);
        } else {
          this.heldPropGroup.scale.set(1, 1, 1);
        }
        this.heldPropGroup.position.y = -0.25 + Math.sin(elapsed * 2.0) * 0.004;
      },
    });
  }

  private animateKeys(keys: HandheldKey3D[], dt: number): void {
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k.pressAnim > 0) {
        k.pressAnim = Math.max(0, k.pressAnim - dt * 6.5);
        const pressDepth = Math.sin(k.pressAnim * Math.PI) * 0.0058;
        k.mesh.position.z = k.restZ - pressDepth;
      } else {
        k.mesh.position.z = k.restZ;
      }
      const isHov = this.hoveredHandheldCode === k.code;
      const desiredEmissive = k.pressAnim > 0 ? 0.42 : isHov ? 0.3 : k.baseEmissive;
      k.frontMat.emissiveIntensity = THREE.MathUtils.damp(
        k.frontMat.emissiveIntensity,
        desiredEmissive,
        18,
        dt
      );
    }
  }

  private acquireLock(): boolean {
    const now = performance.now();
    if (now - this.lastInputTime < TOOL_DEBOUNCE_MS) return false;
    this.lastInputTime = now;
    return true;
  }

  private syncViewmodelVisibility(): void {
    this.labelerGroup.visible = this.activeTool === 'labeler';
    this.scannerGroup.visible = this.activeTool === 'scanner';
    this.ordererGroup.visible = this.activeTool === 'orderer';
    this.cutterGroup.visible = this.activeTool === 'cutter';
    if (this.activeTool !== 'scanner') {
      this.scannerLaserMesh.visible = false;
    }
    const showHeld = this.activeTool === 'hands' && this.heldItem !== null;
    this.heldPropGroup.visible = showHeld;
    if (showHeld && this.heldItem) {
      for (const [k, obj] of Object.entries(this.heldMeshes)) {
        if (obj) obj.visible = k === this.heldItem.kind;
      }
    }
  }

  private redrawLabelerLcd(): void {
    const c = this.labelerLcdCanvas.getContext('2d')!;
    const W = this.labelerLcdCanvas.width;
    const H = this.labelerLcdCanvas.height;

    // Classic 1990 monochrome olive-grey reflective LCD
    c.fillStyle = '#b8c79e';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#364129';
    c.lineWidth = 6;
    c.strokeRect(4, 4, W - 8, H - 8);

    // Header strip
    c.fillStyle = '#25301b';
    c.fillRect(10, 10, W - 20, 42);
    c.fillStyle = '#c8d6af';
    c.font = '800 22px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(this.syncedFromScanner ? 'ETIQUETTE · SYNC SCAN' : 'ETIQUETTE-OS v2.0', 22, 31);
    c.textAlign = 'right';
    c.fillText(`EAN ${this.currentProduct.ean}`, W - 22, 31);

    // Selected Product Name
    c.fillStyle = '#1b2413';
    c.font = '800 23px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(this.currentProduct.name.slice(0, 29), 20, 82);

    // Main Entry Box (EAN Code entry OR Franc Price entry)
    c.fillStyle = '#a3b488';
    c.fillRect(18, 108, W - 36, 78);
    c.strokeStyle = '#25301b';
    c.lineWidth = 3;
    c.strokeRect(18, 108, W - 36, 78);

    if (this.inputMode === 'code') {
      c.fillStyle = '#25301b';
      c.font = '800 22px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText('EAN-8:', 30, 148);

      c.fillStyle = '#11180b';
      c.font = '900 40px "JetBrains Mono", monospace';
      c.textAlign = 'right';
      const masked = this.codeInput.padEnd(8, '_');
      c.fillText(`${masked.slice(0, 4)} ${masked.slice(4, 8)}`, W - 30, 149);
    } else {
      c.fillStyle = '#25301b';
      c.font = '800 24px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText('PRIX:', 32, 148);

      c.fillStyle = '#11180b';
      c.font = '900 44px "JetBrains Mono", monospace';
      c.textAlign = 'right';
      c.fillText(`${this.getFormattedPriceInput()}`, W - 32, 149);
    }

    // Footer status
    c.fillStyle = '#25301b';
    c.font = '800 20px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(this.labelerStatus.slice(0, 32), 20, 222);

    this.labelerLcdTex.needsUpdate = true;
  }

  private redrawScannerLcd(): void {
    const c = this.scannerLcdCanvas.getContext('2d')!;
    const W = this.scannerLcdCanvas.width;
    const H = this.scannerLcdCanvas.height;

    // Sober 1990 monochrome green-grey reflective terminal LCD
    c.fillStyle = '#afc2b2';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#27352c';
    c.lineWidth = 6;
    c.strokeRect(4, 4, W - 8, H - 8);

    // Header
    c.fillStyle = '#1e2c23';
    c.fillRect(10, 10, W - 20, 40);
    c.fillStyle = '#cfe0d2';
    c.font = '800 21px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('TERMINAL SCAN 1990', 20, 30);
    c.textAlign = 'right';
    c.fillText('BASE 45 ART.', W - 20, 30);

    if (!this.scannedProduct) {
      c.fillStyle = '#1d2b22';
      c.font = '800 26px "JetBrains Mono", monospace';
      c.textAlign = 'center';
      c.fillText('AUCUN CODE SCANNÉ', W / 2, 112);
      c.font = '700 20px "JetBrains Mono", monospace';
      c.fillText('VISEZ UN PRODUIT EN RAYON', W / 2, 152);
      c.fillText('PUIS APPUYEZ SUR [SCAN]', W / 2, 182);
    } else {
      const p = this.scannedProduct;
      // Top row: Department + EAN barcode string
      c.fillStyle = '#1b2920';
      c.font = '800 19px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText(`EAN ${p.ean} · ${p.department}`, 20, 74);

      // Full French Product Name
      c.fillStyle = '#0e1711';
      c.font = '800 24px "Plus Jakarta Sans", sans-serif';
      c.fillText(p.name.slice(0, 30), 20, 106);

      // Left mini barcode + Right Official Fixed Franc Price box
      drawEanBarcode(c, p.ean, 20, 126, 208, 72, {
        showDigits: true,
        bgColor: '#c3d5c6',
        barColor: '#121e16',
      });

      c.fillStyle = '#9ab29e';
      c.fillRect(242, 126, 250, 72);
      c.strokeStyle = '#1e2c23';
      c.lineWidth = 3;
      c.strokeRect(242, 126, 250, 72);

      c.fillStyle = '#1e2c23';
      c.font = '800 16px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.fillText('PRIX OFFICIEL', 254, 144);

      c.fillStyle = '#0b140e';
      c.font = '900 36px "JetBrains Mono", monospace';
      c.textAlign = 'right';
      c.fillText(p.priceText, 480, 178);
    }

    // Bottom status bar
    c.fillStyle = '#1e2c23';
    c.font = '800 19px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(this.scannerStatus.slice(0, 34), 20, 228);

    this.scannerLcdTex.needsUpdate = true;
  }

  // ==========================================================================
  // DIRECT 3D HANDHELD BUTTON & PRINTED LABEL RAYCASTING (LABELER + SCANNER)
  // ==========================================================================
  raycastLabelerNdc(ndcX: number, ndcY: number): LabelerRayHit | null {
    if (this.activeTool === 'labeler') {
      if (!this.labelerRaised && !this.hasPrintedLabel) return null;

      this.camera.updateMatrixWorld(true);
      this.labelerGroup.updateMatrixWorld(true);

      _ndcVec.set(ndcX, ndcY);
      _handheldRaycaster.setFromCamera(_ndcVec, this.camera);

      const targets: THREE.Object3D[] = [];
      if (this.labelerRaised) {
        for (let i = 0; i < this.labelerKeyHitMeshes.length; i++) {
          targets.push(this.labelerKeyHitMeshes[i]);
        }
      }
      if (this.hasPrintedLabel) {
        targets.push(this.labelerSlipHitMesh);
      }
      if (targets.length === 0) return null;

      const hits = _handheldRaycaster.intersectObjects(targets, false);
      if (hits.length === 0) return null;
      return (hits[0].object.userData?.labelerAction as LabelerRayHit | undefined) ?? null;
    }

    if (this.activeTool === 'scanner') {
      this.camera.updateMatrixWorld(true);
      this.scannerGroup.updateMatrixWorld(true);

      _ndcVec.set(ndcX, ndcY);
      _handheldRaycaster.setFromCamera(_ndcVec, this.camera);

      const hits = _handheldRaycaster.intersectObjects(this.scannerKeyHitMeshes, false);
      if (hits.length === 0) return null;
      return (hits[0].object.userData?.labelerAction as LabelerRayHit | undefined) ?? null;
    }

    if (this.activeTool === 'orderer') {
      this.camera.updateMatrixWorld(true);
      this.ordererGroup.updateMatrixWorld(true);

      _ndcVec.set(ndcX, ndcY);
      _handheldRaycaster.setFromCamera(_ndcVec, this.camera);

      const hits = _handheldRaycaster.intersectObjects(this.ordererKeyHitMeshes, false);
      if (hits.length === 0) return null;
      return (hits[0].object.userData?.labelerAction as LabelerRayHit | undefined) ?? null;
    }

    return null;
  }

  triggerLabelerAtNdc(ndcX: number, ndcY: number): boolean {
    const hit = this.raycastLabelerNdc(ndcX, ndcY);
    if (!hit) return false;
    if (hit.kind === 'key') {
      this.pressLabelerKey(hit.code);
      return true;
    }
    if (hit.kind === 'take_label') {
      this.takePrintedLabel();
      return true;
    }
    if (hit.kind === 'scanner_btn') {
      this.pressScannerButton(hit.code);
      return true;
    }
    if (hit.kind === 'orderer_btn') {
      this.pressOrdererKey(hit.code);
      return true;
    }
    return false;
  }

  setHoveredLabelerCode(code: string | null): void {
    this.hoveredHandheldCode = code;
  }

  applyLabelerReticlePan(movementX: number, movementY: number): void {
    const sens = 0.00024;
    this.inspectPanX = THREE.MathUtils.clamp(this.inspectPanX - movementX * sens, -0.066, 0.066);
    this.inspectPanY = THREE.MathUtils.clamp(this.inspectPanY + movementY * sens, -0.115, 0.13);
  }

  resetLabelerReticlePan(): void {
    this.inspectPanX = 0;
    this.inspectPanY = 0;
  }

  // ==========================================================================
  // TERMINAL SCAN 1990 ACTIONS (LASER SCAN + SYNC TRANSFER TO LABELER)
  // ==========================================================================
  pressScannerButton(code: 'SCAN' | 'TRANSFERT'): void {
    if (this.activeTool !== 'scanner') return;
    if (!this.acquireLock()) return;

    for (let i = 0; i < this.scannerKeys.length; i++) {
      if (this.scannerKeys[i].code === code) {
        this.scannerKeys[i].pressAnim = 1.0;
        break;
      }
    }

    if (code === 'SCAN') {
      if (this.onScannerTriggerRequest) {
        this.onScannerTriggerRequest();
      } else {
        this.fireScannerLaser(null, null);
      }
      return;
    }

    // TRANSFERT ÉTIQUETEUSE
    if (!this.scannedProduct) {
      this.scannerStatus = 'SCANNEZ UN ARTICLE D’ABORD';
      this.scannerStatusTimer = 1.8;
      this.scannerLcdDirty = true;
      soundSynth.playAtmPiezo('error');
      this.onChanged();
      return;
    }

    this.transferScannedToLabeler(true);
  }

  fireScannerLaser(ean: string | null, worldTarget: THREE.Vector3 | null): boolean {
    if (this.activeTool !== 'scanner') return false;

    // Depress physical yellow SCAN button visually
    for (let i = 0; i < this.scannerKeys.length; i++) {
      if (this.scannerKeys[i].code === 'SCAN') {
        this.scannerKeys[i].pressAnim = 1.0;
        break;
      }
    }

    // Aim 3D red laser beam from emitter window to scanned product world position (or 2.1m ahead)
    this.camera.updateMatrixWorld(true);
    this.scannerGroup.updateMatrixWorld(true);
    this.scannerEmitterWin.getWorldPosition(_beamStart);

    if (worldTarget) {
      _beamFallbackTarget.copy(worldTarget);
    } else {
      this.camera.getWorldDirection(_camDir);
      _beamFallbackTarget.copy(_beamStart).addScaledVector(_camDir, 2.1);
    }

    const dist = Math.max(0.08, _beamStart.distanceTo(_beamFallbackTarget));
    _beamMid.copy(_beamStart).add(_beamFallbackTarget).multiplyScalar(0.5);
    this.scannerLaserMesh.position.copy(_beamMid);
    this.scannerLaserMesh.scale.set(1, 1, dist);
    this.scannerLaserMesh.lookAt(_beamFallbackTarget);
    this.scannerLaserMesh.visible = true;
    this.scannerLaserTimer = 0.24;
    this.scannerRecoil = 1.0;

    const product = getProductByEan(ean);
    if (product) {
      this.scannedProduct = product;
      this.scannerTransferred = false;
      this.scannerStatus = `LU : ${product.priceText} · [TRANSFERT]`;
      this.scannerStatusTimer = 2.6;
      this.scannerLcdDirty = true;
      soundSynth.playBarcodeBeep();
      this.onChanged();
      return true;
    }

    this.scannerStatus = 'AUCUN CODE-BARRES DÉTECTÉ';
    this.scannerStatusTimer = 1.6;
    this.scannerLcdDirty = true;
    soundSynth.playAtmPiezo('correct');
    this.onChanged();
    return false;
  }

  transferScannedToLabeler(bypassLock = false): boolean {
    if (!bypassLock && !this.acquireLock()) return false;
    if (!this.scannedProduct) {
      soundSynth.playAtmPiezo('error');
      return false;
    }

    for (let i = 0; i < this.scannerKeys.length; i++) {
      if (this.scannerKeys[i].code === 'TRANSFERT') {
        this.scannerKeys[i].pressAnim = 1.0;
        break;
      }
    }

    const p = this.scannedProduct;
    this.currentProduct = p;
    const foundIdx = PRODUCT_CATALOG.findIndex((item) => item.ean === p.ean);
    if (foundIdx >= 0) this.catalogIndex = foundIdx;
    this.inputMode = 'price';
    this.codeInput = '';
    this.priceDigits = p.priceInput;
    this.syncedFromScanner = true;
    this.labelerStatus = `SYNC SCAN : ${p.priceText}`;
    this.labelerStatusTimer = 3.2;
    this.labelerLcdDirty = true;

    this.scannerTransferred = true;
    this.scannerStatus = 'TRANSFÉRÉ → ÉTIQUETEUSE OK !';
    this.scannerStatusTimer = 2.8;
    this.scannerLcdDirty = true;

    soundSynth.playDataTransferChirp();
    this.onChanged();
    return true;
  }

  toggleScannerRaised(force?: boolean): void {
    if (this.activeTool !== 'scanner') {
      this.activeTool = 'scanner';
    }
    if (!this.acquireLock()) return;
    this.scannerRaised = force !== undefined ? force : !this.scannerRaised;
    this.labelerRaised = false;
    this.ordererRaised = false;
    this.hoveredHandheldCode = null;
    this.resetLabelerReticlePan();
    soundSynth.playUiTone(false);
    this.syncViewmodelVisibility();
    this.onChanged();
  }

  isScannerRaised(): boolean {
    return this.activeTool === 'scanner' && this.scannerRaised;
  }

  toggleOrdererRaised(force?: boolean): void {
    if (this.activeTool !== 'orderer') {
      this.activeTool = 'orderer';
    }
    if (!this.acquireLock()) return;
    this.ordererRaised = force !== undefined ? force : !this.ordererRaised;
    this.labelerRaised = false;
    this.scannerRaised = false;
    this.hoveredHandheldCode = null;
    this.resetLabelerReticlePan();
    soundSynth.playUiTone(false);
    this.syncViewmodelVisibility();
    this.onChanged();
  }

  isOrdererRaised(): boolean {
    return this.activeTool === 'orderer' && this.ordererRaised;
  }

  pressOrdererKey(code: OrderTerminalKeyCode): void {
    if (this.activeTool !== 'orderer') return;
    if (this.orderModel.pressKey(code)) {
      for (let i = 0; i < this.ordererKeys.length; i++) {
        if (this.ordererKeys[i].code === code) {
          this.ordererKeys[i].pressAnim = 1.0;
          break;
        }
      }
    }
  }

  getOrdererHudState(): OrdererHudState {
    return this.orderModel.getHudState(this.isOrdererRaised());
  }

  isAnyHandheldRaised(): boolean {
    return this.isLabelerRaised() || this.isScannerRaised() || this.isOrdererRaised();
  }

  getScannerHudState(): ScannerHudState {
    return {
      raised: this.isScannerRaised(),
      lastScannedEan: this.scannedProduct?.ean ?? null,
      lastScannedName: this.scannedProduct?.name ?? null,
      lastScannedPrice: this.scannedProduct?.priceText ?? null,
      transferredToLabeler: this.scannerTransferred,
    };
  }

  // ==========================================================================
  // ÉTIQUETEUSE 1990 STATE & 3D KEYPAD LOGIC (FULL CATALOG + EAN-8 ENTRY)
  // ==========================================================================
  getFormattedPriceInput(): string {
    const clean = this.priceDigits.trim();
    const suf = this.currentProduct.unitSuffix ?? '';
    if (!clean) return `0,00 ₣${suf}`;
    if (clean.includes(',')) {
      const [intP, decP] = clean.split(',');
      return `${intP || '0'},${(decP || '').padEnd(2, '0').slice(0, 2)} ₣${suf}`;
    }
    return `${clean},00 ₣${suf}`;
  }

  getActiveTool(): PlayerTool {
    return this.activeTool;
  }

  getHeldItem(): HeldItemHudInfo | null {
    return this.heldItem;
  }

  isLabelerRaised(): boolean {
    return this.activeTool === 'labeler' && this.labelerRaised;
  }

  getLabelerHudState(): LabelerHudState {
    return {
      raised: this.isLabelerRaised(),
      category: this.currentProduct.shortName,
      ean: this.currentProduct.ean,
      productName: this.currentProduct.name,
      inputMode: this.inputMode,
      codeInput: this.codeInput,
      priceInput: this.priceDigits,
      formattedPrice: this.getFormattedPriceInput(),
      hasPrintedLabel: this.hasPrintedLabel,
      printedCategory: this.printedCategory,
      printedEan: this.printedEan,
      printedProductName: this.printedProductName,
      printedPrice: this.printedPrice,
      syncedFromScanner: this.syncedFromScanner,
    };
  }

  selectTool(tool: PlayerTool, bypassDebounce = false): void {
    if (!bypassDebounce && !this.acquireLock()) return;
    this.activeTool = tool;
    if (tool !== 'labeler') {
      this.labelerRaised = false;
    }
    if (tool !== 'scanner') {
      this.scannerRaised = false;
    }
    if (tool !== 'orderer') {
      this.ordererRaised = false;
    }
    this.hoveredHandheldCode = null;
    this.resetLabelerReticlePan();
    soundSynth.playMechanicalButtonClick();
    this.syncViewmodelVisibility();
    this.onChanged();
  }

  toggleLabelerRaised(force?: boolean): void {
    if (this.activeTool !== 'labeler') {
      this.activeTool = 'labeler';
    }
    if (!this.acquireLock()) return;
    this.labelerRaised = force !== undefined ? force : !this.labelerRaised;
    this.scannerRaised = false;
    this.ordererRaised = false;
    this.hoveredHandheldCode = null;
    this.resetLabelerReticlePan();
    soundSynth.playUiTone(false);
    this.syncViewmodelVisibility();
    this.onChanged();
  }

  pressLabelerKey(key: string): void {
    if (this.activeTool !== 'labeler') return;
    if (!this.acquireLock()) return;

    // Physically depress ONLY the exact 3D rubber key pressed
    for (let i = 0; i < this.labelerKeys.length; i++) {
      if (this.labelerKeys[i].code === key) {
        this.labelerKeys[i].pressAnim = 1.0;
        break;
      }
    }

    if (key === 'CODE') {
      if (this.inputMode === 'price') {
        this.inputMode = 'code';
        this.codeInput = '';
        this.labelerStatus = 'TAPEZ EAN 8 CHIFFRES';
        this.labelerStatusTimer = 2.6;
        soundSynth.playAtmPiezo('bezel');
      } else {
        // Pressing CODE again while empty cycles cleanly through the ENTIRE store catalog!
        this.catalogIndex = (this.catalogIndex + 1) % PRODUCT_CATALOG.length;
        this.currentProduct = PRODUCT_CATALOG[this.catalogIndex];
        this.priceDigits = this.currentProduct.priceInput;
        this.codeInput = '';
        this.syncedFromScanner = false;
        this.labelerStatus = `ART. ${this.catalogIndex + 1}/${PRODUCT_CATALOG.length} · ${this.currentProduct.ean}`;
        this.labelerStatusTimer = 2.0;
        soundSynth.playAtmPiezo('bezel');
      }
    } else if (key === 'PRIX') {
      this.inputMode = 'price';
      this.codeInput = '';
      this.priceDigits = '';
      this.syncedFromScanner = false;
      this.labelerStatus = 'SAISIE PRIX (₣)...';
      this.labelerStatusTimer = 2.0;
      soundSynth.playAtmPiezo('bezel');
    } else if (key === 'EFFACER') {
      if (this.inputMode === 'code') {
        this.codeInput = this.codeInput.slice(0, -1);
      } else {
        this.priceDigits = this.priceDigits.slice(0, -1);
      }
      this.labelerStatus = 'EFFACEMENT';
      this.labelerStatusTimer = 1.2;
      soundSynth.playAtmPiezo('correct');
    } else if (key === 'IMPRIMER') {
      // If user typed an 8-digit EAN in code mode, resolve it first
      if (this.inputMode === 'code' && this.codeInput.length === 8) {
        const match = getProductByEan(this.codeInput);
        if (match) {
          this.currentProduct = match;
          this.priceDigits = match.priceInput;
        }
        this.inputMode = 'price';
        this.codeInput = '';
      }

      const priceText = this.getFormattedPriceInput();
      this.printedCategory = this.currentProduct.shortName;
      this.printedEan = this.currentProduct.ean;
      this.printedProductName = this.currentProduct.name;
      this.printedPrice = priceText;
      this.hasPrintedLabel = true;
      this.labelerExtrudeAnim = 0;
      drawPriceTagCanvas(
        this.labelerSlipCanvas,
        this.printedProductName,
        this.printedPrice,
        this.printedEan
      );
      this.labelerSlipTex.needsUpdate = true;
      this.labelerStatus = 'ÉTIQUETTE IMPRIMÉE ↑';
      this.labelerStatusTimer = 2.4;
      soundSynth.playLabelPrint();
    } else if (key === ',') {
      if (this.inputMode === 'price' && !this.priceDigits.includes(',') && this.priceDigits.length < 5) {
        this.priceDigits = (this.priceDigits || '0') + ',';
        soundSynth.playAtmPiezo('digit');
      }
    } else if (/^[0-9]$/.test(key)) {
      if (this.inputMode === 'code') {
        if (this.codeInput.length < 8) {
          this.codeInput += key;
          soundSynth.playAtmPiezo('digit');
          if (this.codeInput.length === 8) {
            const found = getProductByEan(this.codeInput);
            if (found) {
              this.currentProduct = found;
              const idx = PRODUCT_CATALOG.findIndex((p) => p.ean === found.ean);
              if (idx >= 0) this.catalogIndex = idx;
              this.priceDigits = found.priceInput;
              this.inputMode = 'price';
              this.codeInput = '';
              this.syncedFromScanner = false;
              this.labelerStatus = `EAN OK : ${found.priceText}`;
              this.labelerStatusTimer = 2.4;
              soundSynth.playAtmPiezo('confirm');
            } else {
              this.labelerStatus = `EAN ${this.codeInput} INCONNU`;
              this.labelerStatusTimer = 2.2;
              this.codeInput = '';
              soundSynth.playAtmPiezo('error');
            }
          }
        }
      } else {
        const parts = this.priceDigits.split(',');
        if (parts.length === 2) {
          if (parts[1].length < 2) {
            this.priceDigits += key;
            soundSynth.playAtmPiezo('digit');
          }
        } else if (this.priceDigits.length < 4) {
          this.priceDigits = this.priceDigits === '0' ? key : this.priceDigits + key;
          soundSynth.playAtmPiezo('digit');
        }
      }
    }

    this.labelerLcdDirty = true;
    this.onChanged();
  }

  takePrintedLabel(): boolean {
    if (!this.hasPrintedLabel) return false;
    if (!this.acquireLock()) return false;

    this.hasPrintedLabel = false;
    this.labelerRaised = false;
    this.hoveredHandheldCode = null;
    this.resetLabelerReticlePan();
    this.activeTool = 'hands';
    drawPriceTagCanvas(
      this.heldLabelCanvas,
      this.printedProductName,
      this.printedPrice,
      this.printedEan
    );
    this.heldLabelTex.needsUpdate = true;

    this.heldItem = {
      kind: 'price_label',
      label: `Étiquette ${this.printedPrice}`,
      sublabel: `${this.printedProductName} (${this.printedEan})`,
      priceText: this.printedPrice,
      category: this.printedProductName,
      ean: this.printedEan,
      productName: this.printedProductName,
    };

    soundSynth.playPaperGrab();
    this.labelerLcdDirty = true;
    this.syncViewmodelVisibility();
    this.onChanged();
    return true;
  }

  pickUpItem(item: HeldItemHudInfo): boolean {
    if (this.activeTool !== 'hands') {
      this.activeTool = 'hands';
      this.labelerRaised = false;
      this.scannerRaised = false;
      this.ordererRaised = false;
      this.hoveredHandheldCode = null;
      this.resetLabelerReticlePan();
    }
    this.heldItem = item;
    if (item.kind === 'price_label' && item.priceText) {
      drawPriceTagCanvas(
        this.heldLabelCanvas,
        item.productName ?? item.category ?? 'ARTICLE',
        item.priceText,
        item.ean ?? '30140101'
      );
      this.heldLabelTex.needsUpdate = true;
    }
    this.syncViewmodelVisibility();
    this.onChanged();
    return true;
  }

  consumeHeldItem(): HeldItemHudInfo | null {
    const prev = this.heldItem;
    this.heldItem = null;
    this.syncViewmodelVisibility();
    this.onChanged();
    return prev;
  }

  triggerCutterSlash(): void {
    this.cutterSlashAnim = 1.0;
    soundSynth.playCutterSlice();
  }

  triggerHeldToyAction(): boolean {
    if (this.activeTool !== 'hands' || !this.heldItem) return false;
    if (this.heldItem.kind === 'toy_squeaky') {
      this.heldSqueezeAnim = 1.0;
      soundSynth.playSqueakyToy();
      return true;
    }
    if (this.heldItem.kind === 'toy_cat_bell') {
      this.heldSqueezeAnim = 1.0;
      soundSynth.playCatBellJingle();
      return true;
    }
    if (this.heldItem.kind === 'toy_tennis') {
      this.heldSqueezeAnim = 1.0;
      soundSynth.playTennisBounce(1.0);
      return true;
    }
    return false;
  }
}
