import * as THREE from 'three';
import { MaterialLibrary } from '../materials';
import { ProceduralTextureBank } from '../textures';
import { WorldBuildContext } from '../types';
import { PlayerToolController } from '../playerTools';
import { buildPetSupplyAisle1990 } from './petSupplyAisle';
import { buildHygieneAisle1990 } from './hygieneAisle';
import { buildBakeryAisle1990 } from './bakeryAisle';
import { buildHotSnackingCafeAisle1990 } from './hotSnackingCafeAisle';
import { buildButcherAisle1990 } from './butcherAisle';
import { buildWineCellarAisle1990 } from './wineCellarAisle';
import { buildSweetGroceryAisle1990 } from './sweetGroceryAisle';
import { buildSavoryGroceryAisle1990 } from './savoryGroceryAisle';
import { buildFrozenAisle1990 } from './frozenAisle';
import { buildProduceAisle1990 } from './produceAisle';
import { buildDairyAisle1990 } from './dairyAisle';
import { buildSnackingAisle1990 } from './snackingAisle';
import { buildMangaGamingAisle1990 } from './mangaGamingAisle';

export function buildMainSalesFloorDepartments(
  ctx: WorldBuildContext,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  const root = new THREE.Group();
  ctx.scene.add(root);

  // ============================================================================
  // DEPT 1: FRUITS & LÉGUMES (V16 — 1990 Primeur Sloped Stands & Weighing Scale Printer)
  // Right of Entrance (X = +1.72..+5.20, Z = +4.35..+5.54)
  // ============================================================================
  buildProduceAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 2: V10 BOULANGERIE & VIENNOISERIE — POINT CHAUD 1990 (Oven, Slicer, Multi-Depth Baskets)
  // ============================================================================
  buildBakeryAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 3: V19 POINT CAFÉ & SNACKING CHAUD (1990) — Empty Warmer, Espresso Machine & Microwave
  // Replaces legacy Konbini counter along East Wall (X = +8.8..+9.9, Z = -4.35..-1.45)
  // ============================================================================
  buildHotSnackingCafeAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 4: V11 BOUCHERIE & CHARCUTERIE 1990 (Billot, Trancheuse Jambon, Balance 1990 & Vitrine)
  // ============================================================================
  buildButcherAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 5: CRÉMERIE, FROMAGES & YAOURTS (V17 — +4°C Open-Air Dairy Wall Display & PAV Trays)
  // Left Perimeter Wall (X = -9.95..-8.92, Z = -5.65..-0.28)
  // ============================================================================
  buildDairyAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 11: SNACKING FRAIS, SANDWICHES TRIANGLES & CANETTES (V18 — +4°C Empty Grab-and-Go Display)
  // Replaces legacy dark glass cabinet on Left Wall (X = -9.95..-8.92, Z = -0.26..+2.42)
  // ============================================================================
  buildSnackingAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 6: SURGELÉS & GLACES (V15 — 1990 Sliding Glass Chest Freezers & Vertical Ice Cream Cabinet)
  // Left-Center Cold Aisle (X = -7.08..-5.92, Z = -4.78..+1.19)
  // ============================================================================
  buildFrozenAisle1990(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 7A, 7B, 8, 9, 10: CENTRAL GROCERY GONDOLAS, CAVE À VINS, HYGIÈNE & ANIMALERIE
  // ============================================================================
  buildCentralGondolasAndAisles(ctx, root, mats, texBank, tools);

  // ============================================================================
  // DEPT 11: MANGA, BD & JEUX VIDÉO (V18 — 3-Tier Bare-Rail Gondola & Playable 1990 CRT Pong Kiosk)
  // Front-Left Corner (X = -9.95..-7.08, Z = +3.33..+6.40)
  // ============================================================================
  buildMangaGamingAisle1990(ctx, root, mats, texBank, tools);
}

function buildCentralGondolasAndAisles(
  ctx: WorldBuildContext,
  root: THREE.Group,
  mats: MaterialLibrary,
  texBank: ProceduralTextureBank,
  tools: PlayerToolController
): void {
  // --- V14 DEPT 7A: DEDICATED 3-TIER SAVORY GROCERY, PASTA, OILS & CANNED GOODS ("RAYON 7A — ÉPICERIE SALÉE & PÂTES 1990") ---
  buildSavoryGroceryAisle1990(ctx, root, mats, texBank, tools);

  // --- V13 DEPT 7B: DEDICATED 3-TIER SWEET GROCERY, BISCUITS & SNACKS ("RAYON 7B — ÉPICERIE SUCRÉE & SNACKS 1990") ---
  buildSweetGroceryAisle1990(ctx, root, mats, texBank, tools);

  // --- V12 DEPT 8: DEDICATED 3-TIER WINE, BEER & SPIRITS CELLAR ("RAYON 8 — CAVE À VINS, BIÈRES & SPIRITUEUX 1990") ---
  buildWineCellarAisle1990(ctx, root, mats, texBank, tools);

  // --- V9 DEPT 9: DEDICATED 3-TIER HYGIENE, BEAUTY & CLEANING AISLE ("RAYON HYGIÈNE, BEAUTÉ & ENTRETIEN") ---
  buildHygieneAisle1990(ctx, root, mats, texBank, tools);

  // --- V6/V9 DEPT 10: DEDICATED 3-TIER PET SUPPLY AISLE ("RAYON ANIMALERIE — CHIEN & CHAT") ---
  buildPetSupplyAisle1990(ctx, root, mats, texBank, tools);
}

