import * as THREE from 'three';
import { MaterialLibrary, addBoxCollider } from '../materials';
import { INTERACT_LAYER } from '../textures';
import { HeldItemHudInfo, InteractableItem, PlayerTool, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { soundSynth } from '../audio';

type StoredToolKind = Exclude<PlayerTool, 'hands'>;

type StoredDrawerEntry =
  | {
      source: 'tool';
      tool: StoredToolKind;
      label: string;
      sublabel: string;
    }
  | {
      source: 'held';
      item: HeldItemHudInfo;
    };

const TOOL_LABELS: Record<StoredToolKind, { label: string; sublabel: string }> = {
  cutter: {
    label: 'Cutter Professionnel 1990',
    sublabel: 'Outil Ouverture Cartons · Lame Rétractable Acier',
  },
  scanner: {
    label: 'Terminal Scan 1990',
    sublabel: 'Lecteur Code-Barres Laser Portable · Écran LCD',
  },
  labeler: {
    label: 'Étiqueteuse Électronique 1990',
    sublabel: 'Imprimante Thermique Prix Francs · Clavier 3D',
  },
  orderer: {
    label: 'Terminal Commande 1990',
    sublabel: 'Saisie Commandes Fournisseurs · Liaison Modem',
  },
};

function createDrawerCardTexture(
  code: string,
  title: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const c = canvas.getContext('2d')!;

  // Authentic 1990 cream filing index card
  c.fillStyle = '#fbf7ec';
  c.fillRect(0, 0, 256, 96);

  // Subtle horizontal blue index ruling lines
  c.strokeStyle = 'rgba(59, 130, 246, 0.25)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(8, 34);
  c.lineTo(248, 34);
  c.moveTo(8, 72);
  c.lineTo(248, 72);
  c.stroke();

  // Top red ruling accent
  c.fillStyle = '#b91c1c';
  c.fillRect(0, 0, 256, 7);

  // Code badge on left
  c.fillStyle = '#1e3a5f';
  c.fillRect(10, 14, 46, 26);
  c.fillStyle = '#ffffff';
  c.font = '800 18px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(code, 33, 28);

  // Auto-fitted drawer title
  c.fillStyle = '#0f172a';
  c.textAlign = 'left';
  let fontSize = 20;
  c.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  while (c.measureText(title).width > 184 && fontSize > 11) {
    fontSize -= 1;
    c.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  }
  c.fillText(title, 64, 28);

  // Subtle archive footer
  c.fillStyle = '#475569';
  c.font = '700 13px "JetBrains Mono", monospace';
  c.fillText('CONTACT EXPRESS · 1990', 14, 56);

  c.strokeStyle = '#94a3b8';
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, 253, 93);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createDrawerStoredItemMesh(
  entry: StoredDrawerEntry,
  mats: MaterialLibrary
): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const grp = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const track = <T extends { dispose: () => void }>(r: T): T => {
    disposables.push(r);
    return r;
  };

  if (entry.source === 'tool') {
    if (entry.tool === 'cutter') {
      // Detailed 1990 yellow/black retractable utility cutter resting flat in drawer
      const yellowMat = track(new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.42 }));
      const gripMat = track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.78 }));
      const bodyGeo = track(new THREE.BoxGeometry(0.165, 0.022, 0.04));
      const gripGeo = track(new THREE.BoxGeometry(0.105, 0.025, 0.044));
      const sliderGeo = track(new THREE.BoxGeometry(0.032, 0.008, 0.018));
      const bladeGeo = track(new THREE.BoxGeometry(0.048, 0.004, 0.022));

      const body = new THREE.Mesh(bodyGeo, yellowMat);
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.set(-0.024, 0, 0);
      const slider = new THREE.Mesh(sliderGeo, gripMat);
      slider.position.set(0.032, 0.014, 0);
      const blade = new THREE.Mesh(bladeGeo, mats.chrome);
      blade.position.set(0.095, 0, 0);
      grp.add(body, grip, slider, blade);
      grp.position.set(0, 0.024, 0.01);
      grp.rotation.y = 0.28;
      return { group: grp, disposables };
    }

    if (entry.tool === 'scanner') {
      const bodyMat = track(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.52 }));
      const lcdMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x84cc16,
          emissive: 0x4d7c0f,
          emissiveIntensity: 0.35,
          roughness: 0.3,
        })
      );
      const emitterMat = track(
        new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.2 })
      );
      const bodyGeo = track(new THREE.BoxGeometry(0.088, 0.042, 0.21));
      const lcdGeo = track(new THREE.BoxGeometry(0.066, 0.005, 0.064));
      const keysGeo = track(new THREE.BoxGeometry(0.064, 0.006, 0.072));
      const emitGeo = track(new THREE.BoxGeometry(0.064, 0.024, 0.012));

      const body = new THREE.Mesh(bodyGeo, bodyMat);
      const lcd = new THREE.Mesh(lcdGeo, lcdMat);
      lcd.position.set(0, 0.023, -0.042);
      const keys = new THREE.Mesh(keysGeo, mats.anthracite);
      keys.position.set(0, 0.023, 0.044);
      const emit = new THREE.Mesh(emitGeo, emitterMat);
      emit.position.set(0, 0, -0.108);
      grp.add(body, lcd, keys, emit);
      grp.position.set(0, 0.032, 0.01);
      grp.rotation.y = 0.18;
      return { group: grp, disposables };
    }

    if (entry.tool === 'labeler') {
      const beigeMat = track(new THREE.MeshStandardMaterial({ color: 0xd6d0c0, roughness: 0.58 }));
      const lcdMat = track(new THREE.MeshStandardMaterial({ color: 0x9ab37c, roughness: 0.35 }));
      const bodyGeo = track(new THREE.BoxGeometry(0.115, 0.046, 0.21));
      const lcdGeo = track(new THREE.BoxGeometry(0.088, 0.005, 0.054));
      const keypadGeo = track(new THREE.BoxGeometry(0.088, 0.007, 0.095));
      const slotGeo = track(new THREE.BoxGeometry(0.072, 0.004, 0.035));

      const body = new THREE.Mesh(bodyGeo, beigeMat);
      const lcd = new THREE.Mesh(lcdGeo, lcdMat);
      lcd.position.set(0, 0.025, -0.05);
      const keypad = new THREE.Mesh(keypadGeo, mats.anthracite);
      keypad.position.set(0, 0.025, 0.036);
      const slot = new THREE.Mesh(slotGeo, mats.whiteMetal);
      slot.position.set(0, 0.014, -0.115);
      grp.add(body, lcd, keypad, slot);
      grp.position.set(0, 0.034, 0.01);
      grp.rotation.y = -0.14;
      return { group: grp, disposables };
    }

    // orderer
    const casingMat = track(new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.48 }));
    const lcdMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0369a1,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      })
    );
    const bodyGeo = track(new THREE.BoxGeometry(0.105, 0.04, 0.2));
    const lcdGeo = track(new THREE.BoxGeometry(0.08, 0.005, 0.068));
    const antGeo = track(new THREE.CylinderGeometry(0.006, 0.008, 0.06, 8));
    antGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, casingMat);
    const lcd = new THREE.Mesh(lcdGeo, lcdMat);
    lcd.position.set(0, 0.022, -0.035);
    const ant = new THREE.Mesh(antGeo, mats.rubberBlack);
    ant.position.set(0.034, 0.004, -0.125);
    grp.add(body, lcd, ant);
    grp.position.set(0, 0.032, 0.015);
    grp.rotation.y = 0.12;
    return { group: grp, disposables };
  }

  // Held items inside drawer
  const kind = entry.item.kind;

  if (kind === 'office_label_roll') {
    const paperMat = track(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 }));
    const coreMat = track(new THREE.MeshStandardMaterial({ color: 0x92643d, roughness: 0.9 }));
    const stripeMat = track(new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 }));
    const rollGeo = track(new THREE.CylinderGeometry(0.056, 0.056, 0.064, 20));
    const coreGeo = track(new THREE.CylinderGeometry(0.022, 0.022, 0.068, 14));
    const tailGeo = track(new THREE.BoxGeometry(0.062, 0.004, 0.085));
    const bandGeo = track(new THREE.BoxGeometry(0.062, 0.005, 0.018));

    const roll = new THREE.Mesh(rollGeo, paperMat);
    roll.position.set(-0.02, 0.04, -0.01);
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.set(-0.02, 0.04, -0.01);
    const tail = new THREE.Mesh(tailGeo, paperMat);
    tail.position.set(0.028, 0.012, 0.048);
    tail.rotation.y = 0.35;
    const band = new THREE.Mesh(bandGeo, stripeMat);
    band.position.set(0.034, 0.013, 0.064);
    band.rotation.y = 0.35;
    grp.add(roll, core, tail, band);
    return { group: grp, disposables };
  }

  if (kind === 'office_invoice_binder') {
    const coverMat = track(new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.62 }));
    const spineLblMat = track(new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 }));
    const pagesMat = track(new THREE.MeshStandardMaterial({ color: 0xf8f6f0, roughness: 0.85 }));
    const coverGeo = track(new THREE.BoxGeometry(0.24, 0.01, 0.3));
    const spineGeo = track(new THREE.BoxGeometry(0.012, 0.068, 0.3));
    const pagesGeo = track(new THREE.BoxGeometry(0.222, 0.05, 0.282));
    const lblGeo = track(new THREE.BoxGeometry(0.005, 0.044, 0.14));
    const ringGeo = track(new THREE.TorusGeometry(0.013, 0.003, 8, 14));

    const topC = new THREE.Mesh(coverGeo, coverMat);
    topC.position.y = 0.066;
    const botC = new THREE.Mesh(coverGeo, coverMat);
    botC.position.y = 0.014;
    const sp = new THREE.Mesh(spineGeo, coverMat);
    sp.position.set(-0.118, 0.04, 0);
    const pg = new THREE.Mesh(pagesGeo, pagesMat);
    pg.position.set(0.004, 0.04, 0);
    const lbl = new THREE.Mesh(lblGeo, spineLblMat);
    lbl.position.set(-0.125, 0.04, -0.02);
    const ring = new THREE.Mesh(ringGeo, mats.chrome);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-0.125, 0.04, 0.095);
    grp.add(topC, botC, sp, pg, lbl, ring);
    grp.rotation.y = 0.08;
    return { group: grp, disposables };
  }

  if (kind === 'plastic_price_rail') {
    const railBackMat = track(new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.42 }));
    const railClearMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xdcf4ff,
        transparent: true,
        opacity: 0.55,
        roughness: 0.16,
      })
    );
    const stripGeo = track(new THREE.BoxGeometry(0.32, 0.022, 0.016));
    const lensGeo = track(new THREE.BoxGeometry(0.32, 0.02, 0.005));
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(stripGeo, railBackMat);
      s.position.set(0, 0.022, -0.036 + i * 0.036);
      const l = new THREE.Mesh(lensGeo, railClearMat);
      l.position.set(0, 0.022, -0.025 + i * 0.036);
      grp.add(s, l);
    }
    grp.rotation.y = 0.08;
    return { group: grp, disposables };
  }

  if (kind === 'price_label') {
    const tagMat = track(new THREE.MeshStandardMaterial({ color: 0xfffef5, roughness: 0.72 }));
    const headMat = track(new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.6 }));
    const tagGeo = track(new THREE.BoxGeometry(0.11, 0.004, 0.068));
    const headGeo = track(new THREE.BoxGeometry(0.11, 0.005, 0.018));
    const tag = new THREE.Mesh(tagGeo, tagMat);
    tag.position.y = 0.012;
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.013, -0.025);
    grp.add(tag, head);
    grp.rotation.y = -0.22;
    return { group: grp, disposables };
  }

  // Generic authentic color-coded small retail product silhouette for any other small item stored in drawer
  const isCyl =
    kind.includes('can') ||
    kind.includes('wine') ||
    kind.includes('beer') ||
    kind.includes('cidre') ||
    kind.includes('pastis') ||
    kind.includes('huile') ||
    kind.includes('jar') ||
    kind.includes('shampoing') ||
    kind.includes('gel_douche') ||
    kind.includes('camembert') ||
    kind.includes('cup');
  const isSphere = kind.startsWith('toy_') || kind.startsWith('produce_');

  let tint = 0xd97706;
  if (kind.startsWith('snacking_can') || kind.startsWith('cafe_')) tint = 0xdc2626;
  else if (kind.startsWith('dairy_') || kind.startsWith('frozen_')) tint = 0x2563eb;
  else if (kind.startsWith('hyg_')) tint = 0x0d9488;
  else if (kind.startsWith('game_') || kind.startsWith('manga_') || kind.startsWith('bd_')) tint = 0x7c3aed;
  else if (kind.startsWith('wine_') || kind.startsWith('beer_')) tint = 0x15803d;
  else if (kind.startsWith('produce_')) tint = 0x65a30d;

  const itemMat = track(new THREE.MeshStandardMaterial({ color: tint, roughness: 0.45 }));
  const accentMat = track(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }));

  if (isSphere) {
    const geo = track(new THREE.SphereGeometry(0.052, 14, 12));
    const m = new THREE.Mesh(geo, itemMat);
    m.position.y = 0.058;
    grp.add(m);
  } else if (isCyl) {
    const geo = track(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 14));
    geo.rotateZ(Math.PI / 2);
    const lblGeo = track(new THREE.CylinderGeometry(0.0415, 0.0415, 0.068, 14));
    lblGeo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, itemMat);
    m.position.y = 0.05;
    const l = new THREE.Mesh(lblGeo, accentMat);
    l.position.y = 0.05;
    grp.add(m, l);
    grp.rotation.y = 0.2;
  } else {
    const geo = track(new THREE.BoxGeometry(0.15, 0.068, 0.19));
    const lblGeo = track(new THREE.BoxGeometry(0.132, 0.004, 0.075));
    const m = new THREE.Mesh(geo, itemMat);
    m.position.y = 0.044;
    const l = new THREE.Mesh(lblGeo, accentMat);
    l.position.set(0, 0.08, 0);
    grp.add(m, l);
    grp.rotation.y = 0.12;
  }

  return { group: grp, disposables };
}

export function buildInteractiveOfficeFilingCabinets(
  ctx: WorldBuildContext,
  office: THREE.Group,
  mats: MaterialLibrary,
  tools: PlayerToolController
): void {
  // Position: East Wall of Manager's Office beside PC Desk (X = +9.50, Z = +3.72)
  // Rotated -Math.PI / 2 so local +Z points straight out into the office (-X),
  // meaning every drawer slides smoothly forward along its local +Z axis!
  const cabinetsRoot = new THREE.Group();
  cabinetsRoot.position.set(9.5, 0, 3.72);
  cabinetsRoot.rotation.y = -Math.PI / 2;
  office.add(cabinetsRoot);

  // Authentic 1990 grey-blue enameled steel filing cabinet finishes
  const cabBodyMat = new THREE.MeshStandardMaterial({
    color: 0x7b8ea3,
    roughness: 0.4,
    metalness: 0.58,
  });
  const cabFrontMat = new THREE.MeshStandardMaterial({
    color: 0x8799ae,
    roughness: 0.36,
    metalness: 0.62,
  });
  const cabInteriorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.68,
    metalness: 0.35,
  });
  const drawerTrayMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.52,
    metalness: 0.55,
  });
  const invisibleProxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(cabBodyMat, cabFrontMat, cabInteriorMat, drawerTrayMat, invisibleProxyMat);

  // Dimensions for 2 side-by-side 5-drawer metal cabinets (10 drawers total)
  const cabW = 0.46;
  const cabH = 1.62;
  const cabD = 0.56;
  const wallT = 0.022;
  const drawerCount = 5;
  const plinthH = 0.06;
  const topCapH = 0.03;
  const usableH = cabH - plinthH - topCapH;
  const slotStep = usableH / drawerCount; // 0.306m per drawer
  const maxSlideDist = 0.38;

  // Shared carcass geometries
  const sideWallGeo = new THREE.BoxGeometry(wallT, cabH, cabD);
  const backWallGeo = new THREE.BoxGeometry(cabW - wallT * 2, cabH, wallT);
  const topCapGeo = new THREE.BoxGeometry(cabW, topCapH, cabD);
  const plinthGeo = new THREE.BoxGeometry(cabW, plinthH, cabD);
  const dividerRailGeo = new THREE.BoxGeometry(cabW - wallT * 2, 0.014, 0.045);
  const lockCylGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.014, 12);
  lockCylGeo.rotateX(Math.PI / 2);

  // Shared drawer tray & hardware geometries (reused across all 10 drawers for locked 60 FPS!)
  const faceW = cabW - 0.036;
  const faceH = slotStep - 0.018;
  const trayW = cabW - 0.068;
  const trayH = 0.165;
  const trayD = 0.47;

  const drawerFaceGeo = new THREE.BoxGeometry(faceW, faceH, 0.022);
  const trayFloorGeo = new THREE.BoxGeometry(trayW, 0.014, trayD);
  const traySideGeo = new THREE.BoxGeometry(0.014, trayH, trayD);
  const trayBackGeo = new THREE.BoxGeometry(trayW, trayH, 0.014);
  const slideRailGeo = new THREE.BoxGeometry(0.008, 0.024, trayD + 0.02);
  const handleBarGeo = new THREE.BoxGeometry(0.135, 0.016, 0.014);
  const handlePostGeo = new THREE.BoxGeometry(0.014, 0.016, 0.024);
  const labelFrameGeo = new THREE.BoxGeometry(0.128, 0.056, 0.008);
  const labelCardGeo = new THREE.PlaneGeometry(0.114, 0.044);
  const frontHitGeo = new THREE.BoxGeometry(faceW + 0.01, faceH, 0.06);
  const slotHitGeo = new THREE.BoxGeometry(trayW - 0.02, 0.17, trayD - 0.06);

  ctx.disposables.push(
    sideWallGeo,
    backWallGeo,
    topCapGeo,
    plinthGeo,
    dividerRailGeo,
    lockCylGeo,
    drawerFaceGeo,
    trayFloorGeo,
    traySideGeo,
    trayBackGeo,
    slideRailGeo,
    handleBarGeo,
    handlePostGeo,
    labelFrameGeo,
    labelCardGeo,
    frontHitGeo,
    slotHitGeo
  );

  // Strict 320ms single-press touch debounce shared across all cabinet handles & interior slots
  let lastActionTime = 0;
  const acquireLock = (): boolean => {
    const now = performance.now();
    if (now - lastActionTime < 320) return false;
    lastActionTime = now;
    return true;
  };

  interface DrawerMeta {
    code: string;
    label: string;
    starter?: StoredDrawerEntry;
  }

  const cabinetSpecs: Array<{
    cabIndex: number;
    localX: number;
    cabTitle: string;
    drawers: DrawerMeta[]; // bottom (0) -> top (4)
  }> = [
    {
      cabIndex: 1,
      localX: -0.242,
      cabTitle: 'Classeur A (Fournitures & Étiquetage)',
      drawers: [
        { code: 'A1', label: 'RÉSERVE DIVERS' },
        { code: 'A2', label: 'RÉGLETTES PRIX' },
        { code: 'A3', label: 'OUTILLAGE' },
        {
          code: 'A4',
          label: 'CUTTER RECHANGE',
          starter: {
            source: 'tool',
            tool: 'cutter',
            label: 'Cutter de Rechange 1990',
            sublabel: 'Lame Acier Rétractable · Réserve Bureau',
          },
        },
        {
          code: 'A5',
          label: 'ÉTIQUETTES 1990',
          starter: {
            source: 'held',
            item: {
              kind: 'office_label_roll',
              label: 'Rouleau Étiquettes 1990',
              sublabel: 'Papier Thermique Prix Francs · Réserve Bureau',
            },
          },
        },
      ],
    },
    {
      cabIndex: 2,
      localX: 0.242,
      cabTitle: 'Classeur B (Factures & Archives 1990)',
      drawers: [
        { code: 'B1', label: 'ARCHIVES 1988' },
        { code: 'B2', label: 'ARCHIVES 1989' },
        { code: 'B3', label: 'REGISTRE HACCP' },
        { code: 'B4', label: 'BONS LIVRAISON' },
        {
          code: 'B5',
          label: 'FACTURES 1990',
          starter: {
            source: 'held',
            item: {
              kind: 'office_invoice_binder',
              label: 'Classeur Factures Fournisseurs 1990',
              sublabel: 'Archive Comptable · Centrale-Achat 90',
            },
          },
        },
      ],
    },
  ];

  interface SlidingDrawerState {
    group: THREE.Group;
    open: boolean;
    curZ: number;
    targetZ: number;
  }
  const animatedDrawers: SlidingDrawerState[] = [];

  for (const cabSpec of cabinetSpecs) {
    const cabGroup = new THREE.Group();
    cabGroup.position.set(cabSpec.localX, 0, 0);
    cabinetsRoot.add(cabGroup);

    // Hollow 4-sided metal carcass shell (real interior cavity when drawers slide open!)
    const leftSide = new THREE.Mesh(sideWallGeo, cabBodyMat);
    leftSide.position.set(-cabW / 2 + wallT / 2, cabH / 2, 0);
    leftSide.castShadow = true;
    leftSide.receiveShadow = true;

    const rightSide = new THREE.Mesh(sideWallGeo, cabBodyMat);
    rightSide.position.set(cabW / 2 - wallT / 2, cabH / 2, 0);
    rightSide.castShadow = true;
    rightSide.receiveShadow = true;

    const backWall = new THREE.Mesh(backWallGeo, cabInteriorMat);
    backWall.position.set(0, cabH / 2, -cabD / 2 + wallT / 2);

    const topCap = new THREE.Mesh(topCapGeo, cabBodyMat);
    topCap.position.set(0, cabH - topCapH / 2, 0);
    topCap.castShadow = true;
    topCap.receiveShadow = true;

    const plinth = new THREE.Mesh(plinthGeo, mats.anthracite);
    plinth.position.set(0, plinthH / 2, 0);

    // Central top chrome lock cylinder
    const lockCyl = new THREE.Mesh(lockCylGeo, mats.chrome);
    lockCyl.position.set(cabW / 2 - 0.055, cabH - topCapH / 2, cabD / 2 + 0.002);

    cabGroup.add(leftSide, rightSide, backWall, topCap, plinth, lockCyl);

    // Build all 5 independent sliding drawers for this cabinet (bottom -> top)
    cabSpec.drawers.forEach((meta, rowIdx) => {
      const centerY = plinthH + slotStep * (rowIdx + 0.5);

      // Thin horizontal cabinet front divider rail below upper drawers
      if (rowIdx > 0) {
        const div = new THREE.Mesh(dividerRailGeo, cabInteriorMat);
        div.position.set(0, plinthH + slotStep * rowIdx, cabD / 2 - 0.025);
        cabGroup.add(div);
      }

      const drawerGroup = new THREE.Group();
      drawerGroup.position.set(0, centerY, 0);
      cabGroup.add(drawerGroup);

      const drawerState: SlidingDrawerState = {
        group: drawerGroup,
        open: false,
        curZ: 0,
        targetZ: 0,
      };
      animatedDrawers.push(drawerState);

      // Drawer Front Faceplate (at local Z = cabD / 2 - 0.011)
      const frontZ = cabD / 2 - 0.011;
      const faceMesh = new THREE.Mesh(drawerFaceGeo, cabFrontMat);
      faceMesh.position.set(0, 0, frontZ);
      faceMesh.castShadow = true;
      faceMesh.receiveShadow = true;

      // Chrome Front Pull Handle (grip bar + twin brackets)
      const handleBar = new THREE.Mesh(handleBarGeo, mats.chrome);
      handleBar.position.set(0, -0.024, frontZ + 0.028);
      const postL = new THREE.Mesh(handlePostGeo, mats.chrome);
      postL.position.set(-0.06, -0.024, frontZ + 0.018);
      const postR = new THREE.Mesh(handlePostGeo, mats.chrome);
      postR.position.set(0.06, -0.024, frontZ + 0.018);

      // Framed Metal Index Label Holder + Procedural 1990 Index Card
      const cardTex = createDrawerCardTexture(meta.code, meta.label, ctx.maxAnisotropy);
      const cardMat = new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.65 });
      ctx.disposables.push(cardTex, cardMat);

      const labelFrame = new THREE.Mesh(labelFrameGeo, mats.stainless);
      labelFrame.position.set(0, 0.056, frontZ + 0.014);
      const labelCard = new THREE.Mesh(labelCardGeo, cardMat);
      labelCard.position.set(0, 0.056, frontZ + 0.019);

      // Open-top 4-sided Steel Storage Tray + Galvanized Telescopic Slide Rails
      const trayBottomY = -faceH / 2 + 0.016;
      const trayCenterZ = frontZ - 0.011 - trayD / 2;

      const trayFloor = new THREE.Mesh(trayFloorGeo, drawerTrayMat);
      trayFloor.position.set(0, trayBottomY, trayCenterZ);
      trayFloor.receiveShadow = true;

      const traySideL = new THREE.Mesh(traySideGeo, drawerTrayMat);
      traySideL.position.set(-trayW / 2 + 0.007, trayBottomY + trayH / 2, trayCenterZ);
      const traySideR = new THREE.Mesh(traySideGeo, drawerTrayMat);
      traySideR.position.set(trayW / 2 - 0.007, trayBottomY + trayH / 2, trayCenterZ);
      const trayBack = new THREE.Mesh(trayBackGeo, drawerTrayMat);
      trayBack.position.set(0, trayBottomY + trayH / 2, trayCenterZ - trayD / 2 + 0.007);

      const railL = new THREE.Mesh(slideRailGeo, mats.galvanized);
      railL.position.set(-trayW / 2 - 0.004, trayBottomY + 0.06, trayCenterZ);
      const railR = new THREE.Mesh(slideRailGeo, mats.galvanized);
      railR.position.set(trayW / 2 + 0.004, trayBottomY + 0.06, trayCenterZ);

      drawerGroup.add(
        faceMesh,
        handleBar,
        postL,
        postR,
        labelFrame,
        labelCard,
        trayFloor,
        traySideL,
        traySideR,
        trayBack,
        railL,
        railR
      );

      // Anchor inside the open drawer tray — moves smoothly with drawerGroup!
      const itemAnchor = new THREE.Group();
      itemAnchor.position.set(0, trayBottomY + 0.008, trayCenterZ + 0.02);
      drawerGroup.add(itemAnchor);

      let storedEntry: StoredDrawerEntry | null = null;
      let storedVisual: { group: THREE.Group; disposables: Array<{ dispose: () => void }> } | null =
        null;

      const setStoredEntry = (next: StoredDrawerEntry | null) => {
        if (storedVisual) {
          itemAnchor.remove(storedVisual.group);
          storedVisual.disposables.forEach((d) => d.dispose());
          storedVisual = null;
        }
        storedEntry = next;
        if (next) {
          storedVisual = createDrawerStoredItemMesh(next, mats);
          itemAnchor.add(storedVisual.group);
        }
      };

      // Pre-stock designated 1990 manager supply drawers at start
      if (meta.starter) {
        setStoredEntry(meta.starter);
      }

      // 1) Drawer Front Handle Interactable: [OUVRIR LE TIROIR] / [FERMER LE TIROIR]
      const frontHit = new THREE.Mesh(frontHitGeo, invisibleProxyMat);
      frontHit.position.set(0, 0, frontZ + 0.022);
      frontHit.layers.set(INTERACT_LAYER);
      drawerGroup.add(frontHit);

      const frontItem: InteractableItem = {
        id: `office_drawer_handle_${meta.code.toLowerCase()}`,
        title: `Tiroir ${meta.code} — ${meta.label}`,
        subtitle: cabSpec.cabTitle,
        kind: 'diegetic_action',
        state: false,
        inspectText: `Tiroir métallique coulissant sur glissières à billes (${meta.code} · ${meta.label}).`,
        proxyMesh: frontHit,
        dynamicVerb: () => (drawerState.open ? 'FERMER LE TIROIR' : 'OUVRIR LE TIROIR'),
        dynamicSubtitle: () =>
          storedEntry
            ? `Contient : ${storedEntry.source === 'tool' ? storedEntry.label : storedEntry.item.label}`
            : `${cabSpec.cabTitle} · Vide`,
        onInteract: () => {
          if (!acquireLock()) return;
          drawerState.open = !drawerState.open;
          drawerState.targetZ = drawerState.open ? maxSlideDist : 0;
          frontItem.state = drawerState.open;
          soundSynth.playMetalDrawerSlide(drawerState.open);
        },
      };
      frontHit.userData.interactable = frontItem;
      ctx.interactables.push(frontItem);

      // 2) Usable 3D Interior Storage Slot Interactable: [RANGER DANS LE TIROIR] / [PRENDRE L'OBJET]
      const slotHit = new THREE.Mesh(slotHitGeo, invisibleProxyMat);
      slotHit.position.set(0, trayBottomY + 0.095, trayCenterZ + 0.015);
      slotHit.layers.set(INTERACT_LAYER);
      drawerGroup.add(slotHit);

      const getPlayerStorableCandidate = (): StoredDrawerEntry | null => {
        const activeTool = tools.getActiveTool();
        if (activeTool !== 'hands') {
          const info = TOOL_LABELS[activeTool];
          return {
            source: 'tool',
            tool: activeTool,
            label: info.label,
            sublabel: info.sublabel,
          };
        }
        const held = tools.getHeldItem();
        if (!held) return null;
        // Full-size warehouse shipping cartons are too large for a filing drawer; everything else fits!
        if (held.kind === 'shipping_carton' || held.kind === 'empty_carton') return null;
        return { source: 'held', item: held };
      };

      const slotItem: InteractableItem = {
        id: `office_drawer_slot_${meta.code.toLowerCase()}`,
        title: `Intérieur Tiroir ${meta.code}`,
        subtitle: 'Emplacement de Rangement 3D',
        kind: 'diegetic_action',
        state: false,
        inspectText: `Bac métallique utilisable du tiroir ${meta.code} pour ranger vos outils, réglettes ou petits objets.`,
        proxyMesh: slotHit,
        isVisible: () => drawerState.curZ > maxSlideDist * 0.48,
        dynamicVerb: () => {
          if (storedEntry) return "PRENDRE L'OBJET";
          return getPlayerStorableCandidate() ? 'RANGER DANS LE TIROIR' : 'TIROIR VIDE';
        },
        dynamicTitle: () => {
          if (storedEntry) {
            return storedEntry.source === 'tool' ? storedEntry.label : storedEntry.item.label;
          }
          const cand = getPlayerStorableCandidate();
          if (cand) {
            const name = cand.source === 'tool' ? cand.label : cand.item.label;
            return `Ranger : ${name}`;
          }
          return `Tiroir ${meta.code} — Emplacement Libre`;
        },
        dynamicSubtitle: () => {
          if (storedEntry) {
            return storedEntry.source === 'tool'
              ? storedEntry.sublabel
              : storedEntry.item.sublabel ?? `Tiroir ${meta.code} · Stocké`;
          }
          const held = tools.getHeldItem();
          if (held && (held.kind === 'shipping_carton' || held.kind === 'empty_carton')) {
            return 'Carton trop volumineux — rangez-le en Réserve (Travées A–E)';
          }
          return getPlayerStorableCandidate()
            ? `Tiroir ${meta.code} · Cliquez pour déposer dans le bac`
            : 'Équipez un outil, une réglette ou un petit objet pour le ranger ici';
        },
        onInteract: () => {
          if (!acquireLock()) return;
          if (drawerState.curZ <= maxSlideDist * 0.45) return;

          if (storedEntry) {
            // Take stored item or tool out of the drawer (with seamless swap if holding another storable item!)
            const taken = storedEntry;
            const swapCandidate = getPlayerStorableCandidate();

            if (taken.source === 'tool') {
              if (swapCandidate && swapCandidate.source === 'held') {
                tools.consumeHeldItem();
                setStoredEntry(swapCandidate);
              } else {
                setStoredEntry(null);
              }
              tools.selectTool(taken.tool, true);
              soundSynth.playMechanicalButtonClick();
            } else {
              if (swapCandidate && swapCandidate.source === 'held') {
                tools.consumeHeldItem();
                setStoredEntry(swapCandidate);
              } else if (swapCandidate && swapCandidate.source === 'tool') {
                setStoredEntry(swapCandidate);
              } else {
                setStoredEntry(null);
              }
              tools.pickUpItem(taken.item);
              soundSynth.playPaperGrab();
            }
            return;
          }

          // Drawer is empty -> place currently held tool or small item inside!
          const candidate = getPlayerStorableCandidate();
          if (!candidate) return;

          if (candidate.source === 'tool') {
            setStoredEntry(candidate);
            tools.selectTool('hands', true);
            soundSynth.playMechanicalButtonClick();
          } else {
            const consumed = tools.consumeHeldItem();
            if (consumed) {
              setStoredEntry({ source: 'held', item: consumed });
              soundSynth.playPaperGrab();
            }
          }
        },
      };
      slotHit.userData.interactable = slotItem;
      ctx.interactables.push(slotItem);
    });
  }

  // Smooth exponential damping for all 10 sliding metallic drawers (Zero GC in update loop!)
  ctx.updaters.push({
    update: (dt) => {
      for (let i = 0; i < animatedDrawers.length; i++) {
        const d = animatedDrawers[i];
        if (Math.abs(d.curZ - d.targetZ) > 0.0004) {
          d.curZ = THREE.MathUtils.damp(d.curZ, d.targetZ, 10.5, dt);
          d.group.position.z = d.curZ;
        } else if (d.curZ !== d.targetZ) {
          d.curZ = d.targetZ;
          d.group.position.z = d.curZ;
        }
      }
    },
  });

  // Preserve exact cabinet footprint collider so player stands comfortably right in front of drawers
  addBoxCollider(ctx, 'office_cabinets_col', 9.18, 9.9, 3.25, 4.22);
}
