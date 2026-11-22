// V18 Gameplay Module: "Rayon 11 — Manga, BD & Jeux Vidéo 1990"
// Features:
//  - 3-Tier Manga, BD & Video Game Wall Gondola along the West front-left wall (X = -9.55, Z = +4.65)
//  - Completely BARE shelf edges at start requiring ordered clip-on transparent plastic price rails (zero z-fighting)
//  - 4-deep back-to-front multi-depth stocking + [FAIRE LE FACING] across all 8 official V18 SKUs (30141101..30141108)
//  - Playable 1990 CRT Video Game Demo Kiosk ("Borne Démo Jeux Vidéo 1990 — SUPER PONG DEMO 1990")
//    with 4:3 CRT TV monitor, 1990 cartridge console, physical clickable 3D arcade buttons (▲ HAUT, ▼ BAS, START),
//    live CanvasTexture Pong rendering against a deliberately forgiving, easy CPU AI, and 8-bit Web Audio feedback.

import * as THREE from 'three';
import { addBoxCollider, MaterialLibrary } from '../materials';
import { INTERACT_LAYER, ProceduralTextureBank } from '../textures';
import { InteractableItem, WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { drawEanBarcode } from '../productCatalog';
import { soundSynth } from '../audio';
import {
  buildBareShelfWithInstallableRails,
  buildMultiDepthColumn,
  MultiDepthVariantSpec,
} from './retailShelfSystem';

interface CoverArtConfig {
  bgTop: string;
  bgBottom: string;
  bandColor: string;
  accentColor: string;
  titleTop: string;
  titleMain: string;
  badge: string;
  ean: string;
  motif: 'console' | 'controller' | 'pong' | 'galaxy' | 'voxelitos' | 'mianimal' | 'yimai' | 'clara';
}

function createRetailCoverTexture(
  ctx: WorldBuildContext,
  cfg: CoverArtConfig
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const g = canvas.getContext('2d')!;

  // Background gradient
  const grad = g.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, cfg.bgTop);
  grad.addColorStop(1, cfg.bgBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 320);

  // Subtle 1990 halftone/grid accent
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 320; y += 16) {
    g.fillRect(0, y, 256, 2);
  }

  // Header band
  g.fillStyle = cfg.bandColor;
  g.fillRect(0, 0, 256, 54);
  g.fillStyle = cfg.accentColor;
  g.fillRect(0, 50, 256, 6);

  // Top subtitle / series banner
  g.fillStyle = '#ffffff';
  g.font = '800 16px "Plus Jakarta Sans", sans-serif';
  g.textAlign = 'center';
  g.fillText(cfg.titleTop, 128, 24);

  // Main title
  g.fillStyle = '#fef08a';
  g.font = '900 20px "Plus Jakarta Sans", sans-serif';
  g.fillText(cfg.titleMain, 128, 45);

  // Center 1990 retro artwork frame
  g.fillStyle = 'rgba(15,23,42,0.42)';
  g.fillRect(20, 68, 216, 140);
  g.strokeStyle = cfg.accentColor;
  g.lineWidth = 3;
  g.strokeRect(20, 68, 216, 140);

  if (cfg.motif === 'console') {
    // 8-Bit handheld / home pack silhouette
    g.fillStyle = '#e2e8f0';
    g.fillRect(62, 84, 132, 108);
    g.fillStyle = '#1e293b';
    g.fillRect(74, 94, 108, 56);
    g.fillStyle = '#22d3ee';
    g.fillRect(84, 112, 8, 22);
    g.fillRect(164, 108, 8, 22);
    g.fillStyle = '#ffffff';
    g.fillRect(124, 118, 8, 8);
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.arc(154, 170, 9, 0, Math.PI * 2);
    g.arc(174, 162, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0f172a';
    g.fillRect(82, 166, 26, 8);
    g.fillRect(91, 157, 8, 26);
  } else if (cfg.motif === 'controller') {
    g.fillStyle = '#1e293b';
    g.fillRect(42, 104, 172, 72);
    g.strokeStyle = '#94a3b8';
    g.lineWidth = 3;
    g.strokeRect(42, 104, 172, 72);
    // D-pad
    g.fillStyle = '#f8fafc';
    g.fillRect(64, 134, 34, 12);
    g.fillRect(75, 123, 12, 34);
    // Arcade buttons
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.arc(156, 144, 12, 0, Math.PI * 2);
    g.arc(186, 132, 12, 0, Math.PI * 2);
    g.fill();
  } else if (cfg.motif === 'pong') {
    g.fillStyle = '#020617';
    g.fillRect(28, 76, 200, 124);
    g.fillStyle = '#22d3ee';
    g.fillRect(44, 104, 10, 44);
    g.fillStyle = '#f43f5e';
    g.fillRect(202, 122, 10, 44);
    g.fillStyle = '#ffffff';
    for (let dy = 82; dy < 194; dy += 16) {
      g.fillRect(126, dy, 4, 8);
    }
    g.fillRect(114, 126, 10, 10);
  } else if (cfg.motif === 'galaxy') {
    g.fillStyle = '#09071f';
    g.fillRect(28, 76, 200, 124);
    g.fillStyle = '#fef08a';
    [
      [44, 92], [88, 104], [190, 90], [210, 148], [62, 174], [148, 166],
    ].forEach(([sx, sy]) => g.fillRect(sx, sy, 4, 4));
    g.fillStyle = '#ec4899';
    g.beginPath();
    g.moveTo(128, 92);
    g.lineTo(166, 168);
    g.lineTo(128, 152);
    g.lineTo(90, 168);
    g.closePath();
    g.fill();
    g.fillStyle = '#38bdf8';
    g.fillRect(122, 118, 12, 22);
  } else if (cfg.motif === 'voxelitos') {
    g.fillStyle = '#064e3b';
    g.fillRect(28, 76, 200, 124);
    g.fillStyle = '#34d399';
    g.fillRect(28, 168, 200, 32);
    // Cute pixel voxel hero block
    g.fillStyle = '#facc15';
    g.fillRect(96, 110, 64, 58);
    g.fillStyle = '#dc2626';
    g.fillRect(92, 98, 72, 16);
    g.fillStyle = '#0f172a';
    g.fillRect(110, 126, 10, 12);
    g.fillRect(136, 126, 10, 12);
  } else if (cfg.motif === 'mianimal') {
    g.fillStyle = '#fff7ed';
    g.fillRect(28, 76, 200, 124);
    g.fillStyle = '#fb923c';
    g.beginPath();
    g.arc(128, 142, 42, 0, Math.PI * 2);
    g.fill();
    // Ears
    g.beginPath();
    g.moveTo(92, 120);
    g.lineTo(84, 86);
    g.lineTo(114, 104);
    g.moveTo(164, 120);
    g.lineTo(172, 86);
    g.lineTo(142, 104);
    g.fill();
    g.fillStyle = '#0f172a';
    g.beginPath();
    g.arc(112, 138, 6, 0, Math.PI * 2);
    g.arc(144, 138, 6, 0, Math.PI * 2);
    g.fill();
  } else if (cfg.motif === 'yimai') {
    g.fillStyle = '#1e1b4b';
    g.fillRect(28, 76, 200, 124);
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.arc(128, 138, 40, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f8fafc';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(74, 178);
    g.lineTo(182, 98);
    g.stroke();
  } else {
    // Clara Godwaie & Louis Franco-Belge BD panel
    g.fillStyle = '#fef3c7';
    g.fillRect(28, 76, 200, 124);
    g.fillStyle = '#38bdf8';
    g.fillRect(36, 84, 184, 64);
    g.fillStyle = '#16a34a';
    g.fillRect(36, 148, 184, 44);
    g.fillStyle = '#ef4444';
    g.beginPath();
    g.arc(102, 132, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2563eb';
    g.beginPath();
    g.arc(154, 136, 20, 0, Math.PI * 2);
    g.fill();
  }

  // Edition badge
  g.fillStyle = cfg.accentColor;
  g.fillRect(20, 214, 216, 24);
  g.fillStyle = '#0f172a';
  g.font = '800 13px "JetBrains Mono", monospace';
  g.fillText(cfg.badge, 128, 231);

  // Scannable EAN-8 barcode strip at bottom
  drawEanBarcode(g, cfg.ean, 28, 246, 200, 62, {
    showDigits: true,
    bgColor: '#ffffff',
    barColor: '#0f172a',
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = ctx.maxAnisotropy;
  ctx.disposables.push(tex);
  return tex;
}

export function buildMangaGamingAisle1990(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const aisleRoot = new THREE.Group();
  root.add(aisleRoot);

  // ============================================================================
  // 0. OVERHEAD DEPARTMENT SIGNAGE (RAYON 11 — MANGA, BD & JEUX VIDÉO 1990)
  // ============================================================================
  {
    const signTex = texBank.createDepartmentSignTexture(
      'RAYON 12 — MANGA, BD & JEUX VIDÉO',
      'BORNE DÉMO PONG 1990 · CONSOLES 8-BIT · CARTOUCHES · MIANIMAL · LES YIMAI · CLARA & LOUIS',
      '#1e1b4b',
      '#22d3ee'
    );
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.34 });
    const signGeo = new THREE.BoxGeometry(2.32, 0.46, 0.06);
    const signMesh = new THREE.Mesh(signGeo, [
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      mats.anthracite,
      signMat,
      signMat,
    ]);
    signMesh.position.set(-8.92, 2.74, 4.65);
    signMesh.rotation.y = Math.PI / 2;
    aisleRoot.add(signMesh);
    ctx.disposables.push(signMat, signGeo);
  }

  // ============================================================================
  // 1. 3-TIER MANGA, BD & VIDEO GAME WALL GONDOLA (WEST WALL X = -9.55, Z = +4.65)
  //    Width = 2.56m (Z = +3.37..+5.93), facing +X into Rayon 11 floor.
  //    Completely BARE shelf lips at start (0 pre-installed rails or price tags).
  // ============================================================================
  {
    const gondola = new THREE.Group();
    gondola.position.set(-9.55, 0, 4.65);
    gondola.rotation.y = Math.PI / 2; // Local +Z faces +X (into the store aisle)
    aisleRoot.add(gondola);

    const shelfW = 2.56;
    const shelfD = 0.54;
    const shelfYs = [0.34, 0.94, 1.50];

    const cabinetDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e2436,
      roughness: 0.56,
      metalness: 0.22,
    });
    const deckSlateMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.48,
      metalness: 0.28,
    });
    const cyanTrimMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      roughness: 0.36,
    });
    const backPanelMat = new THREE.MeshStandardMaterial({
      color: 0x171c2b,
      roughness: 0.65,
      metalness: 0.14,
    });
    const pageCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.85 });
    const darkSideMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });
    const redSpineMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.48 });

    // Gondola chassis: rear perforated backing, side cheeks, base plinth & top canopy
    const backPanel = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 2.08, 0.05), backPanelMat);
    backPanel.position.set(0, 1.04, 0.025);
    backPanel.castShadow = true;
    backPanel.receiveShadow = true;

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.32, shelfD), cabinetDarkMat);
    plinth.position.set(0, 0.16, 0.29);

    const topCanopy = new THREE.Mesh(new THREE.BoxGeometry(shelfW + 0.04, 0.12, shelfD + 0.04), cabinetDarkMat);
    topCanopy.position.set(0, 2.12, 0.30);

    const canopyAccent = new THREE.Mesh(new THREE.BoxGeometry(shelfW + 0.02, 0.032, 0.018), cyanTrimMat);
    canopyAccent.position.set(0, 2.12, 0.585);

    const sideCheekGeo = new THREE.BoxGeometry(0.05, 2.14, shelfD + 0.02);
    const cheekL = new THREE.Mesh(sideCheekGeo, cabinetDarkMat);
    cheekL.position.set(-shelfW / 2 - 0.025, 1.07, 0.29);
    const cheekR = new THREE.Mesh(sideCheekGeo, cabinetDarkMat);
    cheekR.position.set(shelfW / 2 + 0.025, 1.07, 0.29);

    gondola.add(backPanel, plinth, topCanopy, canopyAccent, cheekL, cheekR);
    ctx.disposables.push(
      cabinetDarkMat,
      deckSlateMat,
      cyanTrimMat,
      backPanelMat,
      pageCreamMat,
      darkSideMat,
      redSpineMat,
      backPanel.geometry,
      plinth.geometry,
      topCanopy.geometry,
      canopyAccent.geometry,
      sideCheekGeo
    );

    addBoxCollider(ctx, 'rayon11_manga_gondola_col', -9.95, -8.95, 3.33, 5.97);

    // 3 Bare Shelves with Installable Clip-On Plastic Price Rails (0 pre-installed rails or tags!)
    const shelfHelper = buildBareShelfWithInstallableRails(ctx, gondola, mats, tools, {
      idPrefix: 'rayon11_manga',
      shelfYs,
      shelfNames: [
        'Étagère Basse — Consoles & Manettes',
        'Étagère Centrale — Jeux Cartouches 1990',
        'Étagère Haute — Mangas & Bandes Dessinées',
      ],
      shelfWidth: shelfW,
      shelfDepth: shelfD,
      deckMaterial: deckSlateMat,
      bareLipColor: 0x94a3b8,
      tierSlotXs: [
        [
          [-0.96, -0.34],
          [0.34, 0.96],
        ],
        [
          [-1.02, -0.62, -0.20],
          [0.20, 0.62, 1.02],
        ],
        [
          [-1.02, -0.62, -0.20],
          [0.20, 0.62, 1.02],
        ],
      ],
      expectedSlotEans: (tierIdx, sideKey, subIdx) => {
        if (tierIdx === 0) {
          return sideKey === 'L' ? ['30141301'] : ['30141302'];
        }
        if (tierIdx === 1) {
          if (sideKey === 'L') return subIdx < 2 ? ['30141303'] : ['30141304'];
          return subIdx === 0 ? ['30141304'] : ['30141305'];
        }
        // Tier 2: Manga & BD
        if (sideKey === 'L') return subIdx < 2 ? ['30141306'] : ['30141307'];
        return subIdx === 0 ? ['30141307'] : ['30141308'];
      },
    });

    // Procedural Cover Art Textures for all 8 official Rayon 12 SKUs
    const texConsole = createRetailCoverTexture(ctx, {
      bgTop: '#1e293b',
      bgBottom: '#0f172a',
      bandColor: '#dc2626',
      accentColor: '#facc15',
      titleTop: 'PACK OFFICIEL 1990',
      titleMain: 'CONSOLE 8-BIT',
      badge: 'INCLUS : SUPER PONG',
      ean: '30141301',
      motif: 'console',
    });
    const texManette = createRetailCoverTexture(ctx, {
      bgTop: '#0f172a',
      bgBottom: '#1e1b4b',
      bandColor: '#0284c7',
      accentColor: '#facc15',
      titleTop: 'ACCESSOIRE ARCADE',
      titleMain: 'MANETTE PRO 90',
      badge: 'TURBO · PRÉCISION',
      ean: '30141302',
      motif: 'controller',
    });
    const texSuperPong = createRetailCoverTexture(ctx, {
      bgTop: '#0c4a6e',
      bgBottom: '#020617',
      bandColor: '#0891b2',
      accentColor: '#22d3ee',
      titleTop: 'CARTOUCHE 8-BIT',
      titleMain: 'SUPER PONG',
      badge: 'CHAMPIONSHIP 1990',
      ean: '30141303',
      motif: 'pong',
    });
    const texGalaxy = createRetailCoverTexture(ctx, {
      bgTop: '#4c1d95',
      bgBottom: '#0f0728',
      bandColor: '#be185d',
      accentColor: '#f472b6',
      titleTop: 'CARTOUCHE 8-BIT',
      titleMain: 'GALAXY QUEST',
      badge: 'CYBER-QUEST · 1P/2P',
      ean: '30141304',
      motif: 'galaxy',
    });
    const texVoxelitos = createRetailCoverTexture(ctx, {
      bgTop: '#065f46',
      bgBottom: '#022c22',
      bandColor: '#15803d',
      accentColor: '#facc15',
      titleTop: 'CARTOUCHE 8-BIT',
      titleMain: 'VOXELITOS',
      badge: 'ADVENTURE · ÉD. FR',
      ean: '30141305',
      motif: 'voxelitos',
    });
    const texMianimal = createRetailCoverTexture(ctx, {
      bgTop: '#ea580c',
      bgBottom: '#9a3412',
      bandColor: '#c2410c',
      accentColor: '#fde047',
      titleTop: 'MANGA · TOME 1',
      titleMain: 'MIANIMAL',
      badge: 'COLLECTION MANGA 90',
      ean: '30141306',
      motif: 'mianimal',
    });
    const texYimai = createRetailCoverTexture(ctx, {
      bgTop: '#312e81',
      bgBottom: '#0f172a',
      bandColor: '#b91c1c',
      accentColor: '#f8fafc',
      titleTop: 'MANGA · TOME 1',
      titleMain: 'LES YIMAI',
      badge: 'ÉDITION COLLECTOR',
      ean: '30141307',
      motif: 'yimai',
    });
    const texClara = createRetailCoverTexture(ctx, {
      bgTop: '#1d4ed8',
      bgBottom: '#1e3a8a',
      bandColor: '#dc2626',
      accentColor: '#fef08a',
      titleTop: 'BANDE DESSINÉE',
      titleMain: 'CLARA & LOUIS',
      badge: 'ALBUM CARTONNÉ FR',
      ean: '30141308',
      motif: 'clara',
    });

    const makeFaceMat = (tex: THREE.CanvasTexture) => {
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.42 });
      ctx.disposables.push(m);
      return m;
    };

    const consoleFaceMat = makeFaceMat(texConsole);
    const manetteFaceMat = makeFaceMat(texManette);
    const pongFaceMat = makeFaceMat(texSuperPong);
    const galaxyFaceMat = makeFaceMat(texGalaxy);
    const voxelFaceMat = makeFaceMat(texVoxelitos);
    const mianimalFaceMat = makeFaceMat(texMianimal);
    const yimaiFaceMat = makeFaceMat(texYimai);
    const claraFaceMat = makeFaceMat(texClara);

    // Shared geometries for retail products on gondola
    const consoleBoxGeo = new THREE.BoxGeometry(0.32, 0.25, 0.11);
    const manetteBoxGeo = new THREE.BoxGeometry(0.27, 0.21, 0.095);
    const gameBoxGeo = new THREE.BoxGeometry(0.19, 0.26, 0.055);
    const mangaVolGeo = new THREE.BoxGeometry(0.155, 0.225, 0.042);
    const bdAlbumGeo = new THREE.BoxGeometry(0.215, 0.295, 0.03);
    ctx.disposables.push(consoleBoxGeo, manetteBoxGeo, gameBoxGeo, mangaVolGeo, bdAlbumGeo);

    const makeBoxProduct = (
      geo: THREE.BoxGeometry,
      height: number,
      frontMat: THREE.Material,
      sideMat: THREE.Material,
      rightSideMat: THREE.Material = sideMat
    ): THREE.Object3D => {
      const mesh = new THREE.Mesh(geo, [
        rightSideMat, // +X
        sideMat, // -X
        sideMat, // +Y
        sideMat, // -Y
        frontMat, // +Z (facing aisle)
        frontMat, // -Z
      ]);
      mesh.position.y = height / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    // Variant specs
    const vConsole: MultiDepthVariantSpec = {
      kind: 'game_console_8bit',
      ean: '30141301',
      label: 'Console Portable 8-Bit Pack Pong',
      sublabel: 'Rayon 12 Jeux Vidéo · Étagère Basse (490,00 ₣)',
      buildMesh: () => makeBoxProduct(consoleBoxGeo, 0.25, consoleFaceMat, darkSideMat),
    };
    const vManette: MultiDepthVariantSpec = {
      kind: 'game_manette_pro',
      ean: '30141302',
      label: 'Manette Arcade Pro 1990',
      sublabel: 'Rayon 12 Jeux Vidéo · Étagère Basse (149,00 ₣)',
      buildMesh: () => makeBoxProduct(manetteBoxGeo, 0.21, manetteFaceMat, darkSideMat),
    };
    const vSuperPong: MultiDepthVariantSpec = {
      kind: 'game_super_pong',
      ean: '30141303',
      label: 'Jeu : Super Pong Championship',
      sublabel: 'Rayon 12 Jeux Vidéo · Étagère Centrale (249,00 ₣)',
      buildMesh: () => makeBoxProduct(gameBoxGeo, 0.26, pongFaceMat, darkSideMat),
    };
    const vGalaxy: MultiDepthVariantSpec = {
      kind: 'game_galaxy_quest',
      ean: '30141304',
      label: 'Jeu : Galaxy Cyber-Quest',
      sublabel: 'Rayon 12 Jeux Vidéo · Étagère Centrale (299,00 ₣)',
      buildMesh: () => makeBoxProduct(gameBoxGeo, 0.26, galaxyFaceMat, darkSideMat),
    };
    const vVoxelitos: MultiDepthVariantSpec = {
      kind: 'game_voxelitos',
      ean: '30141305',
      label: 'Jeu : Voxelitos Adventure',
      sublabel: 'Rayon 12 Jeux Vidéo · Étagère Centrale (279,00 ₣)',
      buildMesh: () => makeBoxProduct(gameBoxGeo, 0.26, voxelFaceMat, darkSideMat),
    };
    const vMianimal: MultiDepthVariantSpec = {
      kind: 'manga_mianimal',
      ean: '30141306',
      label: 'Manga : Mianimal Tome 1',
      sublabel: 'Rayon 12 Manga & BD · Étagère Haute (36,00 ₣)',
      buildMesh: () => makeBoxProduct(mangaVolGeo, 0.225, mianimalFaceMat, darkSideMat, pageCreamMat),
    };
    const vYimai: MultiDepthVariantSpec = {
      kind: 'manga_yimai',
      ean: '30141307',
      label: 'Manga : Les Yimai Tome 1',
      sublabel: 'Rayon 12 Manga & BD · Étagère Haute (38,00 ₣)',
      buildMesh: () => makeBoxProduct(mangaVolGeo, 0.225, yimaiFaceMat, darkSideMat, pageCreamMat),
    };
    const vClara: MultiDepthVariantSpec = {
      kind: 'bd_clara_louis',
      ean: '30141308',
      label: 'BD : Clara Godwaie & Louis',
      sublabel: 'Rayon 12 Manga & BD · Étagère Haute (49,00 ₣)',
      buildMesh: () => makeBoxProduct(bdAlbumGeo, 0.295, claraFaceMat, redSpineMat, pageCreamMat),
    };

    // Tier 0 — Étagère Basse (Y = 0.34): Consoles 8-Bit & Manettes Arcade Pro (4 columns × 4 deep)
    const bottomCols: Array<{ x: number; v: MultiDepthVariantSpec; id: string }> = [
      { x: -0.96, v: vConsole, id: 'r11_bot_con_1' },
      { x: -0.34, v: vConsole, id: 'r11_bot_con_2' },
      { x: 0.34, v: vManette, id: 'r11_bot_pad_1' },
      { x: 0.96, v: vManette, id: 'r11_bot_pad_2' },
    ];
    bottomCols.forEach((col) => {
      buildMultiDepthColumn(ctx, gondola, shelfHelper, tools, {
        id: col.id,
        tierName: 'Étagère Basse (Consoles & Manettes)',
        x: col.x,
        y: shelfYs[0] + 0.014,
        shelfBackZ: 0.06,
        shelfFrontZ: 0.54,
        colWidth: 0.52,
        itemHeight: 0.28,
        itemDepth: 0.11,
        depthCount: 4,
        variants: [vConsole, vManette],
        initialSlots: [null, null, null, null],
        placementSound: 'game',
      });
    });

    // Tier 1 — Étagère Centrale (Y = 0.94): Boxed Video Game Cartridges (6 columns × 4 deep)
    const midCols: Array<{ x: number; v: MultiDepthVariantSpec; id: string }> = [
      { x: -1.02, v: vSuperPong, id: 'r11_mid_pong_1' },
      { x: -0.62, v: vSuperPong, id: 'r11_mid_pong_2' },
      { x: -0.20, v: vGalaxy, id: 'r11_mid_gal_1' },
      { x: 0.20, v: vGalaxy, id: 'r11_mid_gal_2' },
      { x: 0.62, v: vVoxelitos, id: 'r11_mid_vox_1' },
      { x: 1.02, v: vVoxelitos, id: 'r11_mid_vox_2' },
    ];
    midCols.forEach((col) => {
      buildMultiDepthColumn(ctx, gondola, shelfHelper, tools, {
        id: col.id,
        tierName: 'Étagère Centrale (Jeux Vidéo)',
        x: col.x,
        y: shelfYs[1] + 0.014,
        shelfBackZ: 0.06,
        shelfFrontZ: 0.54,
        colWidth: 0.34,
        itemHeight: 0.29,
        itemDepth: 0.08,
        depthCount: 4,
        variants: [vSuperPong, vGalaxy, vVoxelitos],
        initialSlots: [null, null, null, null],
        placementSound: 'game',
      });
    });

    // Tier 2 — Étagère Haute (Y = 1.50): Manga Volumes & Hardcover BD Albums (6 columns × 4 deep)
    const topCols: Array<{ x: number; v: MultiDepthVariantSpec; id: string }> = [
      { x: -1.02, v: vMianimal, id: 'r11_top_mian_1' },
      { x: -0.62, v: vMianimal, id: 'r11_top_mian_2' },
      { x: -0.20, v: vYimai, id: 'r11_top_yim_1' },
      { x: 0.20, v: vYimai, id: 'r11_top_yim_2' },
      { x: 0.62, v: vClara, id: 'r11_top_cla_1' },
      { x: 1.02, v: vClara, id: 'r11_top_cla_2' },
    ];
    topCols.forEach((col) => {
      buildMultiDepthColumn(ctx, gondola, shelfHelper, tools, {
        id: col.id,
        tierName: 'Étagère Haute (Mangas & BD)',
        x: col.x,
        y: shelfYs[2] + 0.014,
        shelfBackZ: 0.06,
        shelfFrontZ: 0.54,
        colWidth: 0.34,
        itemHeight: 0.32,
        itemDepth: 0.07,
        depthCount: 4,
        variants: [vMianimal, vYimai, vClara],
        initialSlots: [null, null, null, null],
        placementSound: 'game',
      });
    });
  }

  // ============================================================================
  // 2. PLAYABLE 1990 CRT VIDEO GAME DEMO KIOSK ("BORNE DÉMO JEUX VIDÉO 1990 — MINI-PONG")
  //    Positioned at X = -7.55, Z = +5.95 facing North (-Z) into the Rayon 11 floor.
  //    100% diegetic 3D hardware: 4:3 CRT TV monitor (live CanvasTexture), 1990 cartridge
  //    console with inserted Pong cartridge, sloped podium with physical clickable 3D
  //    arcade buttons (▲ HAUT, ▼ BAS, green START/RESET). ZERO 2D HTML popups!
  // ============================================================================
  {
    const kiosk = new THREE.Group();
    kiosk.position.set(-7.55, 0, 5.95);
    kiosk.rotation.y = Math.PI; // Local +Z faces North (-Z) toward the player
    aisleRoot.add(kiosk);

    addBoxCollider(ctx, 'rayon11_pong_kiosk_col', -8.02, -7.08, 5.55, 6.40);

    const kioskBlueMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.44,
      metalness: 0.22,
    });
    const kioskDarkMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.52,
      metalness: 0.26,
    });
    const kioskYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.38,
      metalness: 0.12,
    });
    const crtBezelMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937,
      roughness: 0.42,
      metalness: 0.18,
    });
    const consoleGreyMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.48,
      metalness: 0.1,
    });
    const cartCyanMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.36,
    });
    const powerLedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.2,
    });
    const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

    // Cabinet base, body, side panels, console shelf, and sloped arcade control podium
    const basePlinth = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 0.68), kioskDarkMat);
    basePlinth.position.set(0, 0.07, 0);
    basePlinth.castShadow = true;

    const mainTower = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.84, 0.54), kioskBlueMat);
    mainTower.position.set(0, 1.06, -0.02);
    mainTower.castShadow = true;
    mainTower.receiveShadow = true;

    const stripeGeo = new THREE.BoxGeometry(0.025, 1.78, 0.08);
    const stripeL = new THREE.Mesh(stripeGeo, kioskYellowMat);
    stripeL.position.set(-0.365, 1.06, 0.21);
    const stripeR = new THREE.Mesh(stripeGeo, kioskYellowMat);
    stripeR.position.set(0.365, 1.06, 0.21);

    // Backlit 1990 Top Marquee ("SUPER PONG DEMO 1990 · ESSAI GRATUIT")
    const mqCanvas = document.createElement('canvas');
    mqCanvas.width = 512;
    mqCanvas.height = 128;
    const mqc = mqCanvas.getContext('2d')!;
    mqc.fillStyle = '#0f172a';
    mqc.fillRect(0, 0, 512, 128);
    mqc.fillStyle = '#06b6d4';
    mqc.fillRect(0, 0, 512, 12);
    mqc.fillRect(0, 116, 512, 12);
    mqc.fillStyle = '#facc15';
    mqc.font = '900 36px "Plus Jakarta Sans", sans-serif';
    mqc.textAlign = 'center';
    mqc.fillText('SUPER PONG DEMO 1990', 256, 62);
    mqc.fillStyle = '#e0f2fe';
    mqc.font = '800 20px "JetBrains Mono", monospace';
    mqc.fillText('BORNE DÉMO JEUX VIDÉO · ESSAI GRATUIT', 256, 98);
    const mqTex = new THREE.CanvasTexture(mqCanvas);
    mqTex.colorSpace = THREE.SRGBColorSpace;
    const mqMat = new THREE.MeshStandardMaterial({
      map: mqTex,
      emissiveMap: mqTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.72,
      roughness: 0.24,
    });
    const marqueeBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.22, 0.36), kioskDarkMat);
    marqueeBox.position.set(0, 2.04, 0.08);
    const marqueeFace = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 0.175), mqMat);
    marqueeFace.position.set(0, 2.04, 0.265);

    // 4:3 CRT Television Monitor Housing at standing eye level (Y = 1.50)
    const crtOuter = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.50, 0.34), crtBezelMat);
    crtOuter.position.set(0, 1.50, 0.16);
    crtOuter.rotation.x = -0.08;

    const crtRecess = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.04), kioskDarkMat);
    crtRecess.position.set(0, 1.50, 0.322);
    crtRecess.rotation.x = -0.08;

    // Live 4:3 Retro Pong CRT CanvasTexture (256x192)
    const crtCanvas = document.createElement('canvas');
    crtCanvas.width = 256;
    crtCanvas.height = 192;
    const crtCtx = crtCanvas.getContext('2d')!;
    const crtTex = new THREE.CanvasTexture(crtCanvas);
    crtTex.colorSpace = THREE.SRGBColorSpace;
    crtTex.minFilter = THREE.LinearFilter;
    crtTex.magFilter = THREE.NearestFilter;

    const crtScreenMat = new THREE.MeshStandardMaterial({
      map: crtTex,
      emissiveMap: crtTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.92,
      roughness: 0.16,
      metalness: 0.04,
    });
    const crtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.50, 0.375), crtScreenMat);
    crtScreen.position.set(0, 1.502, 0.345);
    crtScreen.rotation.x = -0.08;

    // 1990 Cartridge Console on dedicated display shelf below CRT (Y = 1.12)
    const consoleShelf = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.035, 0.30), kioskDarkMat);
    consoleShelf.position.set(0, 1.10, 0.24);

    const consoleUnit = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.068, 0.22), consoleGreyMat);
    consoleUnit.position.set(0, 1.152, 0.25);

    const consoleDarkBand = new THREE.Mesh(new THREE.BoxGeometry(0.324, 0.02, 0.08), kioskDarkMat);
    consoleDarkBand.position.set(0, 1.168, 0.29);

    const insertedCart = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.026), cartCyanMat);
    insertedCart.position.set(0, 1.21, 0.23);

    const powerLed = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.01, 0.01), powerLedMat);
    powerLed.position.set(-0.11, 1.16, 0.36);

    // Sloped Arcade Control Podium (Y = 0.90, angled toward standing player)
    const podiumGroup = new THREE.Group();
    podiumGroup.position.set(0, 0.90, 0.34);
    podiumGroup.rotation.x = 0.38; // Ergonomic arcade deck tilt toward player
    kiosk.add(podiumGroup);

    const podiumDeck = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.30), kioskDarkMat);
    const podiumTrim = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.016, 0.26), kioskBlueMat);
    podiumTrim.position.y = 0.062;
    podiumGroup.add(podiumDeck, podiumTrim);

    // Printed Arcade Deck Legend Decal (▲ HAUT | ▼ BAS | START)
    const deckCanvas = document.createElement('canvas');
    deckCanvas.width = 512;
    deckCanvas.height = 160;
    const dc = deckCanvas.getContext('2d')!;
    dc.fillStyle = '#0f172a';
    dc.fillRect(0, 0, 512, 160);
    dc.strokeStyle = '#22d3ee';
    dc.lineWidth = 4;
    dc.strokeRect(8, 8, 496, 144);
    dc.fillStyle = '#e0f2fe';
    dc.font = '900 22px "JetBrains Mono", monospace';
    dc.textAlign = 'center';
    dc.fillText('▲ HAUT', 112, 138);
    dc.fillText('▼ BAS', 248, 138);
    dc.fillStyle = '#4ade80';
    dc.fillText('START / RESET', 396, 138);
    const deckTex = new THREE.CanvasTexture(deckCanvas);
    deckTex.colorSpace = THREE.SRGBColorSpace;
    const deckFaceMat = new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.45 });
    const deckLabelPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.22), deckFaceMat);
    deckLabelPlane.rotation.x = -Math.PI / 2;
    deckLabelPlane.position.set(0, 0.072, 0);
    podiumGroup.add(deckLabelPlane);

    kiosk.add(
      basePlinth,
      mainTower,
      stripeL,
      stripeR,
      marqueeBox,
      marqueeFace,
      crtOuter,
      crtRecess,
      crtScreen,
      consoleShelf,
      consoleUnit,
      consoleDarkBand,
      insertedCart,
      powerLed
    );

    ctx.disposables.push(
      kioskBlueMat,
      kioskDarkMat,
      kioskYellowMat,
      crtBezelMat,
      consoleGreyMat,
      cartCyanMat,
      powerLedMat,
      proxyMat,
      basePlinth.geometry,
      mainTower.geometry,
      stripeGeo,
      mqTex,
      mqMat,
      marqueeBox.geometry,
      marqueeFace.geometry,
      crtOuter.geometry,
      crtRecess.geometry,
      crtTex,
      crtScreenMat,
      crtScreen.geometry,
      consoleShelf.geometry,
      consoleUnit.geometry,
      consoleDarkBand.geometry,
      insertedCart.geometry,
      powerLed.geometry,
      podiumDeck.geometry,
      podiumTrim.geometry,
      deckTex,
      deckFaceMat,
      deckLabelPlane.geometry
    );

    // ============================================================================
    // RETRO PONG ENGINE (VERY EASY, FORGIVING AI)
    // ============================================================================
    const W = 256;
    const H = 192;
    const PADDLE_W = 7;
    const PLAYER_PADDLE_H = 54; // Extra generous paddle for fun first-person 3D arcade control!
    const CPU_PADDLE_H = 38;
    const BALL_SIZE = 7;
    const WIN_SCORE = 5;

    type PongMode = 'attract' | 'playing' | 'gameover';
    let mode: PongMode = 'attract';
    let scorePlayer = 0;
    let scoreCpu = 0;
    let winnerText = '';
    let playerY = H / 2;
    let playerVelY = 0;
    let cpuY = H / 2;
    let ballX = W / 2;
    let ballY = H / 2;
    let ballVX = 96;
    let ballVY = 44;
    let servePause = 0;
    let cpuDriftTimer = 0;
    let cpuAimOffset = 0;
    let drawAccum = 0;
    let crtDirty = true;

    const resetBall = (towardPlayer: boolean) => {
      ballX = W / 2;
      ballY = 48 + Math.random() * (H - 96);
      const speed = 96;
      const angle = (Math.random() - 0.5) * 0.65;
      ballVX = (towardPlayer ? -1 : 1) * speed * Math.cos(angle);
      ballVY = speed * Math.sin(angle);
      servePause = 0.55;
      crtDirty = true;
    };

    const startPongGame = () => {
      mode = 'playing';
      scorePlayer = 0;
      scoreCpu = 0;
      winnerText = '';
      playerY = H / 2;
      playerVelY = 0;
      cpuY = H / 2;
      resetBall(false);
      soundSynth.playPongTone('start');
      crtDirty = true;
    };

    const drawPongCrt = (elapsed: number) => {
      // Deep CRT phosphor backdrop
      crtCtx.fillStyle = '#030b12';
      crtCtx.fillRect(0, 0, W, H);

      // Court border
      crtCtx.strokeStyle = '#164e63';
      crtCtx.lineWidth = 2;
      crtCtx.strokeRect(4, 4, W - 8, H - 8);

      // Center dashed net
      crtCtx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      for (let ny = 10; ny < H - 10; ny += 12) {
        crtCtx.fillRect(W / 2 - 1, ny, 2, 6);
      }

      // Score header
      crtCtx.font = '900 11px "JetBrains Mono", monospace';
      crtCtx.textAlign = 'center';
      crtCtx.fillStyle = '#38bdf8';
      crtCtx.fillText('VOUS', W * 0.25, 19);
      crtCtx.fillStyle = '#fb7185';
      crtCtx.fillText('CPU (FACILE)', W * 0.75, 19);

      crtCtx.font = '900 24px "JetBrains Mono", monospace';
      crtCtx.fillStyle = '#e0f2fe';
      crtCtx.fillText(String(scorePlayer), W * 0.25, 43);
      crtCtx.fillText(String(scoreCpu), W * 0.75, 43);

      // Left Player Paddle (bright cyan)
      crtCtx.fillStyle = '#22d3ee';
      crtCtx.fillRect(14, Math.round(playerY - PLAYER_PADDLE_H / 2), PADDLE_W, PLAYER_PADDLE_H);

      // Right Easy-CPU Paddle (retro coral)
      crtCtx.fillStyle = '#f43f5e';
      crtCtx.fillRect(W - 14 - PADDLE_W, Math.round(cpuY - CPU_PADDLE_H / 2), PADDLE_W, CPU_PADDLE_H);

      // Ball (bright white-green phosphor square)
      crtCtx.fillStyle = '#f8fafc';
      crtCtx.fillRect(
        Math.round(ballX - BALL_SIZE / 2),
        Math.round(ballY - BALL_SIZE / 2),
        BALL_SIZE,
        BALL_SIZE
      );

      // Attract or Game Over overlay right on the CRT phosphor screen
      if (mode === 'attract') {
        crtCtx.fillStyle = 'rgba(2, 6, 23, 0.76)';
        crtCtx.fillRect(20, 56, W - 40, 88);
        crtCtx.strokeStyle = '#22d3ee';
        crtCtx.lineWidth = 2;
        crtCtx.strokeRect(20, 56, W - 40, 88);

        crtCtx.fillStyle = '#facc15';
        crtCtx.font = '900 16px "JetBrains Mono", monospace';
        crtCtx.fillText('SUPER PONG 1990', W / 2, 82);
        crtCtx.fillStyle = '#bae6fd';
        crtCtx.font = '700 11px "JetBrains Mono", monospace';
        crtCtx.fillText('BOUTONS ▲ HAUT / ▼ BAS', W / 2, 102);

        if (Math.floor(elapsed * 2.2) % 2 === 0) {
          crtCtx.fillStyle = '#4ade80';
          crtCtx.font = '900 12px "JetBrains Mono", monospace';
          crtCtx.fillText('APPUYEZ SUR [START]', W / 2, 128);
        }
      } else if (mode === 'gameover') {
        crtCtx.fillStyle = 'rgba(2, 6, 23, 0.84)';
        crtCtx.fillRect(18, 56, W - 36, 86);
        crtCtx.strokeStyle = scorePlayer >= WIN_SCORE ? '#4ade80' : '#facc15';
        crtCtx.lineWidth = 2;
        crtCtx.strokeRect(18, 56, W - 36, 86);

        crtCtx.fillStyle = scorePlayer >= WIN_SCORE ? '#4ade80' : '#facc15';
        crtCtx.font = '900 16px "JetBrains Mono", monospace';
        crtCtx.fillText(winnerText, W / 2, 84);
        crtCtx.fillStyle = '#e2e8f0';
        crtCtx.font = '700 12px "JetBrains Mono", monospace';
        crtCtx.fillText(`SCORE FINAL : ${scorePlayer} - ${scoreCpu}`, W / 2, 106);
        crtCtx.fillStyle = '#38bdf8';
        crtCtx.font = '800 11px "JetBrains Mono", monospace';
        crtCtx.fillText('REJOUER : [START]', W / 2, 128);
      }

      // Subtle authentic 1990 CRT horizontal scanlines
      crtCtx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      for (let sy = 0; sy < H; sy += 4) {
        crtCtx.fillRect(0, sy, W, 1);
      }

      crtTex.needsUpdate = true;
    };

    drawPongCrt(0);

    // ============================================================================
    // 3 PHYSICAL CLICKABLE 3D ARCADE BUTTONS ON THE PODIUM (▲ HAUT, ▼ BAS, START)
    // ============================================================================
    const bezelGeo = new THREE.CylinderGeometry(0.056, 0.062, 0.018, 16);
    const capGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.028, 16);
    const btnHitGeo = new THREE.BoxGeometry(0.145, 0.085, 0.145);
    const bezelDarkMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.45 });
    const cyanBtnMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.45,
      roughness: 0.25,
    });
    const greenBtnMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    ctx.disposables.push(bezelGeo, capGeo, btnHitGeo, bezelDarkMat, cyanBtnMat, greenBtnMat);

    interface ArcadeBtnAnim {
      cap: THREE.Mesh;
      pressAnim: number;
      baseY: number;
    }
    const btnAnims: ArcadeBtnAnim[] = [];
    let lastPaddlePress = 0;
    let lastStartPress = 0;

    const addArcadeButton = (cfg: {
      id: string;
      x: number;
      mat: THREE.Material;
      title: string;
      subtitle: string;
      verb: () => string;
      onPress: () => void;
    }) => {
      const bz = new THREE.Mesh(bezelGeo, bezelDarkMat);
      bz.position.set(cfg.x, 0.076, -0.02);
      const cap = new THREE.Mesh(capGeo, cfg.mat);
      cap.position.set(cfg.x, 0.094, -0.02);
      podiumGroup.add(bz, cap);

      const animState: ArcadeBtnAnim = { cap, pressAnim: 0, baseY: 0.094 };
      btnAnims.push(animState);

      const hit = new THREE.Mesh(btnHitGeo, proxyMat);
      hit.position.set(cfg.x, 0.095, -0.02);
      hit.layers.set(INTERACT_LAYER);
      podiumGroup.add(hit);

      const item: InteractableItem = {
        id: cfg.id,
        title: cfg.title,
        subtitle: cfg.subtitle,
        kind: 'diegetic_action',
        state: false,
        inspectText: cfg.subtitle,
        proxyMesh: hit,
        dynamicVerb: cfg.verb,
        dynamicSubtitle: () =>
          mode === 'playing'
            ? `Score en direct : VOUS ${scorePlayer} — ${scoreCpu} CPU (Facile)`
            : 'Borne Démo CRT 1990 · Appuyez sur START puis jouez avec ▲ HAUT / ▼ BAS',
        onInteract: () => {
          animState.pressAnim = 1.0;
          cfg.onPress();
        },
      };
      hit.userData.interactable = item;
      ctx.interactables.push(item);
    };

    // Button 1: ▲ HAUT (responsive physical arcade microswitch — 55ms debounce)
    addArcadeButton({
      id: 'pong_kiosk_btn_up',
      x: -0.20,
      mat: cyanBtnMat,
      title: 'Borne Pong 1990 — Bouton ▲ HAUT',
      subtitle: 'Déplace votre raquette vers le haut',
      verb: () => (mode === 'playing' ? 'RAQUETTE ▲ HAUT' : 'TESTER BOUTON ▲ HAUT'),
      onPress: () => {
        const now = performance.now();
        if (now - lastPaddlePress < 55) return;
        lastPaddlePress = now;
        if (mode !== 'playing') {
          startPongGame();
        }
        playerY = Math.max(22 + PLAYER_PADDLE_H / 2, playerY - 22);
        playerVelY = -65;
        soundSynth.playAtmPiezo('digit');
        crtDirty = true;
      },
    });

    // Button 2: ▼ BAS (responsive physical arcade microswitch — 55ms debounce)
    addArcadeButton({
      id: 'pong_kiosk_btn_down',
      x: -0.02,
      mat: cyanBtnMat,
      title: 'Borne Pong 1990 — Bouton ▼ BAS',
      subtitle: 'Déplace votre raquette vers le bas',
      verb: () => (mode === 'playing' ? 'RAQUETTE ▼ BAS' : 'TESTER BOUTON ▼ BAS'),
      onPress: () => {
        const now = performance.now();
        if (now - lastPaddlePress < 55) return;
        lastPaddlePress = now;
        if (mode !== 'playing') {
          startPongGame();
        }
        playerY = Math.min(H - 10 - PLAYER_PADDLE_H / 2, playerY + 22);
        playerVelY = 65;
        soundSynth.playAtmPiezo('digit');
        crtDirty = true;
      },
    });

    // Button 3: START / RESET (strict 320ms single-press touch debounce)
    addArcadeButton({
      id: 'pong_kiosk_btn_start',
      x: 0.20,
      mat: greenBtnMat,
      title: 'Borne Pong 1990 — Bouton START / RESET',
      subtitle: 'Lance ou réinitialise la partie Super Pong Demo 1990',
      verb: () =>
        mode === 'playing'
          ? 'RECOMMENCER PARTIE PONG [RESET]'
          : 'LANCER SUPER PONG DEMO [START]',
      onPress: () => {
        const now = performance.now();
        if (now - lastStartPress < 320) return;
        lastStartPress = now;
        startPongGame();
      },
    });

    // Per-frame Pong simulation & physical button spring animation (throttled CRT texture upload for locked 60 FPS)
    ctx.updaters.push({
      update: (dt, elapsed) => {
        // 1) Physical 3D arcade button cap depression springs
        for (let i = 0; i < btnAnims.length; i++) {
          const b = btnAnims[i];
          if (b.pressAnim > 0) {
            b.pressAnim = Math.max(0, b.pressAnim - dt * 11);
            b.cap.position.y = b.baseY - b.pressAnim * 0.011;
          } else {
            b.cap.position.y = b.baseY;
          }
        }

        // 2) Pong Physics
        if (mode === 'attract') {
          // Gentle attract-mode background bounce
          ballX += ballVX * dt * 0.55;
          ballY += ballVY * dt * 0.55;
          if (ballY < 16 || ballY > H - 16) ballVY = -ballVY;
          if (ballX < 28 || ballX > W - 28) ballVX = -ballVX;
          playerY = THREE.MathUtils.damp(playerY, THREE.MathUtils.clamp(ballY, 44, H - 38), 3.0, dt);
          cpuY = THREE.MathUtils.damp(cpuY, THREE.MathUtils.clamp(ballY, 44, H - 38), 2.5, dt);
        } else if (mode === 'playing') {
          // Smooth player glide after button tap
          if (Math.abs(playerVelY) > 1) {
            playerY = THREE.MathUtils.clamp(
              playerY + playerVelY * dt,
              14 + PLAYER_PADDLE_H / 2,
              H - 10 - PLAYER_PADDLE_H / 2
            );
            playerVelY = THREE.MathUtils.damp(playerVelY, 0, 9.0, dt);
          }

          // Deliberately VERY EASY CPU AI: slow speed (46 px/s) + gentle drift error + only reacts when ball crosses center
          cpuDriftTimer -= dt;
          if (cpuDriftTimer <= 0) {
            cpuDriftTimer = 0.75 + Math.random() * 0.6;
            cpuAimOffset = (Math.random() - 0.5) * 34;
          }
          const cpuTarget = ballVX > 0 && ballX > W * 0.48 ? ballY + cpuAimOffset : H / 2;
          const cpuDiff = cpuTarget - cpuY;
          if (Math.abs(cpuDiff) > 8) {
            const maxStep = 46 * dt;
            cpuY += THREE.MathUtils.clamp(cpuDiff, -maxStep, maxStep);
            cpuY = THREE.MathUtils.clamp(cpuY, 14 + CPU_PADDLE_H / 2, H - 10 - CPU_PADDLE_H / 2);
          }

          if (servePause > 0) {
            servePause = Math.max(0, servePause - dt);
          } else {
            ballX += ballVX * dt;
            ballY += ballVY * dt;

            // Top / bottom wall bounce
            if (ballY - BALL_SIZE / 2 <= 8) {
              ballY = 8 + BALL_SIZE / 2;
              ballVY = Math.abs(ballVY);
              soundSynth.playPongTone('wall');
            } else if (ballY + BALL_SIZE / 2 >= H - 8) {
              ballY = H - 8 - BALL_SIZE / 2;
              ballVY = -Math.abs(ballVY);
              soundSynth.playPongTone('wall');
            }

            // Player (Left) paddle collision
            const playerRightX = 14 + PADDLE_W;
            if (
              ballVX < 0 &&
              ballX - BALL_SIZE / 2 <= playerRightX &&
              ballX + BALL_SIZE / 2 >= 12 &&
              Math.abs(ballY - playerY) <= PLAYER_PADDLE_H / 2 + BALL_SIZE / 2 + 2
            ) {
              ballX = playerRightX + BALL_SIZE / 2 + 0.5;
              const hitNorm = THREE.MathUtils.clamp((ballY - playerY) / (PLAYER_PADDLE_H / 2), -1, 1);
              const nextSpeed = Math.min(148, Math.hypot(ballVX, ballVY) * 1.04);
              const bounceAngle = hitNorm * 0.78;
              ballVX = Math.abs(nextSpeed * Math.cos(bounceAngle));
              ballVY = nextSpeed * Math.sin(bounceAngle);
              soundSynth.playPongTone('paddle');
            }

            // CPU (Right) paddle collision
            const cpuLeftX = W - 14 - PADDLE_W;
            if (
              ballVX > 0 &&
              ballX + BALL_SIZE / 2 >= cpuLeftX &&
              ballX - BALL_SIZE / 2 <= W - 12 &&
              Math.abs(ballY - cpuY) <= CPU_PADDLE_H / 2 + BALL_SIZE / 2
            ) {
              ballX = cpuLeftX - BALL_SIZE / 2 - 0.5;
              const hitNorm = THREE.MathUtils.clamp((ballY - cpuY) / (CPU_PADDLE_H / 2), -1, 1);
              const nextSpeed = Math.min(142, Math.hypot(ballVX, ballVY) * 1.02);
              const bounceAngle = hitNorm * 0.65;
              ballVX = -Math.abs(nextSpeed * Math.cos(bounceAngle));
              ballVY = nextSpeed * Math.sin(bounceAngle);
              soundSynth.playPongTone('paddle');
            }

            // Scoring
            if (ballX > W + 4) {
              scorePlayer += 1;
              if (scorePlayer >= WIN_SCORE) {
                mode = 'gameover';
                winnerText = 'VICTOIRE ! BRAVO !';
                soundSynth.playPongTone('win');
              } else {
                soundSynth.playPongTone('score');
                resetBall(false);
              }
              crtDirty = true;
            } else if (ballX < -4) {
              scoreCpu += 1;
              if (scoreCpu >= WIN_SCORE) {
                mode = 'gameover';
                winnerText = 'FIN DE PARTIE';
                soundSynth.playPongTone('score');
              } else {
                soundSynth.playPongTone('wall');
                resetBall(true);
              }
              crtDirty = true;
            }
          }
        }

        // 3) Throttled CRT CanvasTexture redraw (~30 FPS while playing, ~8 FPS on attract/gameover)
        drawAccum += dt;
        const interval = mode === 'playing' ? 1 / 30 : 0.14;
        if (crtDirty || drawAccum >= interval) {
          drawAccum = 0;
          crtDirty = false;
          drawPongCrt(elapsed);
        }
      },
    });
  }
}
