// Dedicated 1990 Store Ordering Terminal ("Terminal Commande 1990" — COMMANDE-CENTRALE v2.1)
// Shared reactive model synchronizing the docked warehouse receiving terminal and the handheld 3D tool.

import { soundSynth } from './audio';
import { getProductByEan } from './productCatalog';
import { HeldItemHudInfo, OrdererHudState } from './types';

export type OrderCategory =
  | 'MATÉRIEL RAYON'
  | 'POINT CAFÉ & SNACKING CHAUD'
  | 'SNACKING & BOISSONS FRAÎCHES'
  | 'MANGA, BD & JEUX VIDÉO'
  | 'CRÉMERIE & FROMAGES'
  | 'PRIMEUR (FRUITS & LÉGUMES)'
  | 'SURGELÉS & GLACES'
  | 'ÉPICERIE SALÉE & PÂTES'
  | 'ÉPICERIE SUCRÉE & SNACKS'
  | 'CAVE À VINS & BIÈRES'
  | 'BOUCHERIE & CHARCUTERIE'
  | 'BOULANGERIE (POINT CHAUD)'
  | 'HYGIÈNE & ENTRETIEN'
  | 'ANIMALERIE';

export const ORDER_CATEGORIES: OrderCategory[] = [
  'MATÉRIEL RAYON',
  'PRIMEUR (FRUITS & LÉGUMES)',
  'BOULANGERIE (POINT CHAUD)',
  'POINT CAFÉ & SNACKING CHAUD',
  'BOUCHERIE & CHARCUTERIE',
  'CRÉMERIE & FROMAGES',
  'SURGELÉS & GLACES',
  'ÉPICERIE SALÉE & PÂTES',
  'ÉPICERIE SUCRÉE & SNACKS',
  'CAVE À VINS & BIÈRES',
  'HYGIÈNE & ENTRETIEN',
  'ANIMALERIE',
  'SNACKING & BOISSONS FRAÎCHES',
  'MANGA, BD & JEUX VIDÉO',
];

export interface OrderableCartonDef {
  id: string;
  category: OrderCategory;
  shortLabel: string;
  boxLabel: string;
  subtitle: string;
  primaryEan: string;
  isLongRailBox?: boolean;
  /** True for open-top slatted wooden produce crates ("Cagettes Primeur") that can be unloaded directly without Cutter */
  isWoodenCrate?: boolean;
  crateFruitColor?: number;
  unitsPerCarton: number;
  cycleItems: HeldItemHudInfo[];
}

export const ORDER_CATALOG: OrderableCartonDef[] = [
  // 1. MATÉRIEL RAYON
  {
    id: 'carton_price_rails',
    category: 'MATÉRIEL RAYON',
    shortLabel: 'Carton Long Réglettes (×10)',
    boxLabel: 'RÉGLETTES PLASTIQUE 120cm ×10',
    subtitle: '10 réglettes transparentes porte-étiquettes 120 cm',
    primaryEan: '30140001',
    isLongRailBox: true,
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'plastic_price_rail',
        label: 'Réglette Plastique 120 cm',
        sublabel: 'À clipser sur le bord métal nu du rayon',
        ean: '30140001',
      },
    ],
  },

  // 1-CAFE. POINT CAFÉ & SNACKING CHAUD (RAYON 3 — VITRINE CHAUFFANTE +65°C & EXPRESSO 1990)
  {
    id: 'carton_croque_monsieur',
    category: 'POINT CAFÉ & SNACKING CHAUD',
    shortLabel: 'Croque-Monsieur (×10)',
    boxLabel: 'CROQUE-MONSIEUR JAMBON-FROM. ×10',
    subtitle: 'Colis frais 10 pièces · Vitrine +65°C · 12,50 ₣',
    primaryEan: '30141201',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'cafe_croque_monsieur',
        label: 'Croque-Monsieur Jambon-Fromage',
        sublabel: 'Rayon 3 · Vitrine Chauffante +65°C ou Micro-Ondes (12,50 ₣)',
        ean: '30141201',
      },
    ],
  },
  {
    id: 'carton_panini_grille',
    category: 'POINT CAFÉ & SNACKING CHAUD',
    shortLabel: 'Panini Jambon-Emm. (×8)',
    boxLabel: 'PANINI JAMBON-EMMENTAL GRILLÉ ×8',
    subtitle: 'Colis frais 8 paninis · Vitrine +65°C · 15,00 ₣',
    primaryEan: '30141202',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'cafe_panini',
        label: 'Panini Jambon-Emmental Grillé',
        sublabel: 'Rayon 3 · Vitrine Chauffante +65°C ou Micro-Ondes (15,00 ₣)',
        ean: '30141202',
      },
    ],
  },
  {
    id: 'carton_quiche_lorraine',
    category: 'POINT CAFÉ & SNACKING CHAUD',
    shortLabel: 'Quiche Lorraine Part (×8)',
    boxLabel: 'PARTS QUICHE LORRAINE CHAUDE ×8',
    subtitle: 'Colis frais 8 parts · Vitrine +65°C · 11,00 ₣',
    primaryEan: '30141203',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'cafe_quiche_lorraine',
        label: 'Part de Quiche Lorraine Chaude',
        sublabel: 'Rayon 3 · Vitrine Chauffante +65°C ou Micro-Ondes (11,00 ₣)',
        ean: '30141203',
      },
    ],
  },
  {
    id: 'carton_cafe_grain_1kg',
    category: 'POINT CAFÉ & SNACKING CHAUD',
    shortLabel: 'Café Grain Torréfié 1kg (×4)',
    boxLabel: 'CAFÉ GRAIN TORRÉFIÉ 1KG ×4',
    subtitle: 'Sacs recharge trémie Machine Expresso · 32,00 ₣',
    primaryEan: '30141204',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'cafe_beans_bag',
        label: 'Café Grain Torréfié 1kg',
        sublabel: 'Rayon 3 · À verser dans la trémie Machine à Café (32,00 ₣)',
        ean: '30141204',
      },
    ],
  },
  {
    id: 'carton_gobelets_cafe_50',
    category: 'POINT CAFÉ & SNACKING CHAUD',
    shortLabel: 'Lot Gobelets Café ×50 (×4)',
    boxLabel: 'MANCHONS GOBELETS CAFÉ ×50 (×4)',
    subtitle: '4 manchons de 50 gobelets · Distributeur · 14,00 ₣',
    primaryEan: '30141205',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'cafe_cup_sleeve',
        label: 'Lot Gobelets Café x50',
        sublabel: 'Rayon 3 · À charger dans le distributeur gobelets (14,00 ₣)',
        ean: '30141205',
      },
    ],
  },

  // 1-SNACKING. SNACKING & BOISSONS FRAÎCHES (RAYON 11 — +4°C GRAB-AND-GO)
  {
    id: 'carton_canette_cola_33cl',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Canette Cola 33cl (×12)',
    boxLabel: 'CANETTES COLA CLASSIQUE 33CL ×12',
    subtitle: 'Pack 12 canettes alu rouges · Bas · 4,50 ₣',
    primaryEan: '30141101',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'snacking_can_cola',
        label: 'Canette Cola Classique 33cl',
        sublabel: 'Rayon 11 Snacking +4°C · Étagère Basse (4,50 ₣)',
        ean: '30141101',
      },
    ],
  },
  {
    id: 'carton_canette_limonade_33cl',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Canette Limonade 33cl (×12)',
    boxLabel: 'CANETTES LIMONADE CITRON 33CL ×12',
    subtitle: 'Pack 12 canettes alu vertes · Bas · 4,20 ₣',
    primaryEan: '30141102',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'snacking_can_limonade',
        label: 'Canette Limonade Citron 33cl',
        sublabel: 'Rayon 11 Snacking +4°C · Étagère Basse (4,20 ₣)',
        ean: '30141102',
      },
    ],
  },
  {
    id: 'carton_canette_orange_33cl',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Canette Soda Orange 33cl (×12)',
    boxLabel: 'CANETTES SODA ORANGE 33CL ×12',
    subtitle: 'Pack 12 canettes alu orange · Bas · 4,50 ₣',
    primaryEan: '30141103',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'snacking_can_orange',
        label: 'Canette Soda Orange 33cl',
        sublabel: 'Rayon 11 Snacking +4°C · Étagère Basse (4,50 ₣)',
        ean: '30141103',
      },
    ],
  },
  {
    id: 'carton_sandwich_jambon_emmental',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Sandwich Jambon-Emm. (×8)',
    boxLabel: 'SANDW. TRIANGLE JAMBON-EMM. ×8',
    subtitle: 'Colis frais 8 triangles · Centrale · 13,50 ₣',
    primaryEan: '30141104',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'snacking_sand_jambon',
        label: 'Sandwich Triangle Jambon-Emmental',
        sublabel: 'Rayon 11 Snacking +4°C · Étagère Centrale (13,50 ₣)',
        ean: '30141104',
      },
    ],
  },
  {
    id: 'carton_sandwich_poulet_crudites',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Sandwich Poulet-Crud. (×8)',
    boxLabel: 'SANDW. TRIANGLE POULET-CRUD. ×8',
    subtitle: 'Colis frais 8 triangles · Centrale · 14,90 ₣',
    primaryEan: '30141105',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'snacking_sand_poulet',
        label: 'Sandwich Triangle Poulet-Crudités',
        sublabel: 'Rayon 11 Snacking +4°C · Étagère Centrale (14,90 ₣)',
        ean: '30141105',
      },
    ],
  },
  {
    id: 'carton_sandwich_thon_oeuf',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Sandwich Thon-Œuf (×8)',
    boxLabel: 'SANDW. TRIANGLE THON-ŒUF ×8',
    subtitle: 'Colis frais 8 triangles · Centrale · 14,50 ₣',
    primaryEan: '30141106',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'snacking_sand_thon',
        label: 'Sandwich Triangle Thon-Œuf',
        sublabel: 'Rayon 11 Snacking +4°C · Étagère Centrale (14,50 ₣)',
        ean: '30141106',
      },
    ],
  },
  {
    id: 'carton_gateau_choco_pav',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Gâteau Fourré Choc. PAV (×4)',
    boxLabel: 'GÂTEAU FOURRÉ CHOC. · PAV ×12 (×4)',
    subtitle: '4 plateaux PAV (×12 gâteaux) · Haute · 5,50 ₣',
    primaryEan: '30141107',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'snacking_cake_choco_pav',
        label: 'Plateau PAV Petit Gâteau Chocolat (×12)',
        sublabel: 'Rayon 11 · Glisser au fond + découper rabat (5,50 ₣)',
        ean: '30141107',
      },
    ],
  },
  {
    id: 'carton_madeleine_ind_pav',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Madeleine Individ. PAV (×4)',
    boxLabel: 'MADELEINE INDIVID. · PAV ×12 (×4)',
    subtitle: '4 plateaux PAV (×12 madeleines) · Haute · 4,80 ₣',
    primaryEan: '30141108',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'snacking_madeleine_pav',
        label: 'Plateau PAV Madeleine Individuelle (×12)',
        sublabel: 'Rayon 11 · Glisser au fond + découper rabat (4,80 ₣)',
        ean: '30141108',
      },
    ],
  },
  {
    id: 'carton_cookie_ind_pav',
    category: 'SNACKING & BOISSONS FRAÎCHES',
    shortLabel: 'Cookie Pépites Choc. PAV (×4)',
    boxLabel: 'COOKIE PÉPITES CHOC. · PAV ×12 (×4)',
    subtitle: '4 plateaux PAV (×12 cookies) · Haute · 5,90 ₣',
    primaryEan: '30141109',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'snacking_cookie_pav',
        label: 'Plateau PAV Cookie Pépites Chocolat (×12)',
        sublabel: 'Rayon 11 · Glisser au fond + découper rabat (5,90 ₣)',
        ean: '30141109',
      },
    ],
  },

  // 1-MANGA. MANGA, BD & JEUX VIDÉO (RAYON 12 — CULTURE POP 1990)
  {
    id: 'carton_console_8bit_pong',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Console 8-Bit Pack Pong (×4)',
    boxLabel: 'CONSOLES 8-BIT PACK PONG ×4',
    subtitle: 'Carton 4 boîtes console · Étagère Basse · 490,00 ₣',
    primaryEan: '30141301',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'game_console_8bit',
        label: 'Console Portable 8-Bit Pack Pong',
        sublabel: 'Rayon 12 Jeux Vidéo · Étagère Basse (490,00 ₣)',
        ean: '30141301',
      },
    ],
  },
  {
    id: 'carton_manette_arcade_pro',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Manette Arcade Pro 1990 (×6)',
    boxLabel: 'MANETTES ARCADE PRO 1990 ×6',
    subtitle: 'Carton 6 boîtes manette · Étagère Basse · 149,00 ₣',
    primaryEan: '30141302',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'game_manette_pro',
        label: 'Manette Arcade Pro 1990',
        sublabel: 'Rayon 12 Jeux Vidéo · Étagère Basse (149,00 ₣)',
        ean: '30141302',
      },
    ],
  },
  {
    id: 'carton_jeu_super_pong',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Jeu Super Pong Champ. (×8)',
    boxLabel: 'JEU SUPER PONG CHAMP. ×8',
    subtitle: 'Carton 8 cartouches boîtes · Centrale · 249,00 ₣',
    primaryEan: '30141303',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'game_super_pong',
        label: 'Jeu : Super Pong Championship',
        sublabel: 'Rayon 12 Jeux Vidéo · Étagère Centrale (249,00 ₣)',
        ean: '30141303',
      },
    ],
  },
  {
    id: 'carton_jeu_galaxy_quest',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Jeu Galaxy Cyber-Quest (×8)',
    boxLabel: 'JEU GALAXY CYBER-QUEST ×8',
    subtitle: 'Carton 8 cartouches boîtes · Centrale · 299,00 ₣',
    primaryEan: '30141304',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'game_galaxy_quest',
        label: 'Jeu : Galaxy Cyber-Quest',
        sublabel: 'Rayon 12 Jeux Vidéo · Étagère Centrale (299,00 ₣)',
        ean: '30141304',
      },
    ],
  },
  {
    id: 'carton_jeu_voxelitos',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Jeu Voxelitos Adventure (×8)',
    boxLabel: 'JEU VOXELITOS ADVENTURE ×8',
    subtitle: 'Carton 8 cartouches boîtes · Centrale · 279,00 ₣',
    primaryEan: '30141305',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'game_voxelitos',
        label: 'Jeu : Voxelitos Adventure',
        sublabel: 'Rayon 12 Jeux Vidéo · Étagère Centrale (279,00 ₣)',
        ean: '30141305',
      },
    ],
  },
  {
    id: 'carton_manga_mianimal',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Manga Mianimal T1 (×12)',
    boxLabel: 'MANGA MIANIMAL TOME 1 ×12',
    subtitle: 'Carton 12 tomes manga · Étagère Haute · 36,00 ₣',
    primaryEan: '30141306',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'manga_mianimal',
        label: 'Manga : Mianimal Tome 1',
        sublabel: 'Rayon 12 Manga & BD · Étagère Haute (36,00 ₣)',
        ean: '30141306',
      },
    ],
  },
  {
    id: 'carton_manga_yimai',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'Manga Les Yimai T1 (×12)',
    boxLabel: 'MANGA LES YIMAI TOME 1 ×12',
    subtitle: 'Carton 12 tomes manga · Étagère Haute · 38,00 ₣',
    primaryEan: '30141307',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'manga_yimai',
        label: 'Manga : Les Yimai Tome 1',
        sublabel: 'Rayon 12 Manga & BD · Étagère Haute (38,00 ₣)',
        ean: '30141307',
      },
    ],
  },
  {
    id: 'carton_bd_clara_louis',
    category: 'MANGA, BD & JEUX VIDÉO',
    shortLabel: 'BD Clara & Louis (×10)',
    boxLabel: 'BD CLARA GODWAIE & LOUIS ×10',
    subtitle: 'Carton 10 albums cartonnés · Haute · 49,00 ₣',
    primaryEan: '30141308',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'bd_clara_louis',
        label: 'BD : Clara Godwaie & Louis',
        sublabel: 'Rayon 12 Manga & BD · Étagère Haute (49,00 ₣)',
        ean: '30141308',
      },
    ],
  },

  // 1-CREMERIE. CRÉMERIE & FROMAGES (RAYON 5 — +4°C)
  {
    id: 'carton_lait_frais_entier',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Lait Frais Entier 1L (×6)',
    boxLabel: 'LAIT FRAIS ENTIER 1L ×6',
    subtitle: 'Carton 6 bout. bouchon rouge · Bas · 5,90 ₣',
    primaryEan: '30141001',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'dairy_lait_entier',
        label: 'Lait Frais Entier 1L',
        sublabel: 'Rayon 5 Crémerie · Étagère Basse (5,90 ₣)',
        ean: '30141001',
      },
    ],
  },
  {
    id: 'carton_pack_lait_6x1l',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Pack Lait 1/2 Écr. 6x1L (×4)',
    boxLabel: 'PACKS LAIT 1/2 ÉCR. 6×1L ×4',
    subtitle: 'Lot 4 packs filmés 6L · Étagère Basse · 26,50 ₣',
    primaryEan: '30141002',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'dairy_lait_pack6',
        label: 'Pack Lait Demi-Écrémé 6x1L',
        sublabel: 'Rayon 5 Crémerie · Étagère Basse (26,50 ₣)',
        ean: '30141002',
      },
    ],
  },
  {
    id: 'carton_creme_fraiche_pav',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Crème Fraîche 50cl PAV (×4)',
    boxLabel: 'CRÈME FRAÎCHE 50CL · PAV ×4',
    subtitle: '4 plateaux PAV (×6 pots) · Bas · 11,40 ₣',
    primaryEan: '30141003',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'dairy_creme_pav',
        label: 'Plateau PAV Crème Fraîche 50cl (×6)',
        sublabel: 'Rayon 5 · Glisser au fond + découper rabat (11,40 ₣)',
        ean: '30141003',
      },
    ],
  },
  {
    id: 'carton_yaourts_nature_pav',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Yaourts Nature ×8 PAV (×4)',
    boxLabel: 'YAOURTS NATURE ×8 · PAV ×4',
    subtitle: '4 plateaux PAV · Étagère Centrale · 10,90 ₣',
    primaryEan: '30141004',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'dairy_yaourt_nature_pav',
        label: 'Plateau PAV Yaourts Nature ×8',
        sublabel: 'Rayon 5 · Glisser au fond + découper rabat (10,90 ₣)',
        ean: '30141004',
      },
    ],
  },
  {
    id: 'carton_yaourts_fruits_pav',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Yaourts Fruits ×8 PAV (×4)',
    boxLabel: 'YAOURTS FRUITS ×8 · PAV ×4',
    subtitle: '4 plateaux PAV · Étagère Centrale · 13,50 ₣',
    primaryEan: '30141005',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'dairy_yaourt_fruits_pav',
        label: 'Plateau PAV Yaourts Fruits ×8',
        sublabel: 'Rayon 5 · Glisser au fond + découper rabat (13,50 ₣)',
        ean: '30141005',
      },
    ],
  },
  {
    id: 'carton_cremes_choco_pav',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Crèmes Chocolat ×4 PAV (×4)',
    boxLabel: 'CRÈMES CHOCOLAT ×4 · PAV ×4',
    subtitle: '4 plateaux PAV · Étagère Centrale · 9,20 ₣',
    primaryEan: '30141006',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'dairy_creme_choco_pav',
        label: 'Plateau PAV Crèmes Chocolat ×4',
        sublabel: 'Rayon 5 · Glisser au fond + découper rabat (9,20 ₣)',
        ean: '30141006',
      },
    ],
  },
  {
    id: 'carton_camembert_normandie',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Camembert Norm. 250g (×10)',
    boxLabel: 'CAMEMBERT NORMANDIE ×10',
    subtitle: 'Carton 10 boîtes bois · Étagère Haute · 14,80 ₣',
    primaryEan: '30141007',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'dairy_camembert',
        label: 'Camembert de Normandie 250g',
        sublabel: 'Rayon 5 Crémerie · Étagère Haute (14,80 ₣)',
        ean: '30141007',
      },
    ],
  },
  {
    id: 'carton_emmental_rape_pav',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Emmental Râpé 200g PAV (×4)',
    boxLabel: 'EMMENTAL RÂPÉ 200G · PAV ×4',
    subtitle: '4 plateaux PAV sachets · Étagère Haute · 12,60 ₣',
    primaryEan: '30141008',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'dairy_emmental_pav',
        label: 'Plateau PAV Emmental Râpé 200g',
        sublabel: 'Rayon 5 · Glisser au fond + découper rabat (12,60 ₣)',
        ean: '30141008',
      },
    ],
  },
  {
    id: 'carton_beurre_baratte',
    category: 'CRÉMERIE & FROMAGES',
    shortLabel: 'Beurre Doux Baratte 250g (×12)',
    boxLabel: 'BEURRE DOUX BARATTE ×12',
    subtitle: 'Carton 12 plaquettes or · Étagère Haute · 9,80 ₣',
    primaryEan: '30141009',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'dairy_beurre',
        label: 'Beurre Doux de Baratte 250g',
        sublabel: 'Rayon 5 Crémerie · Étagère Haute (9,80 ₣)',
        ean: '30141009',
      },
    ],
  },

  // 1-PRIMEUR. PRIMEUR (FRUITS & LÉGUMES — RAYON 1)
  {
    id: 'cagette_pommes_golden',
    category: 'PRIMEUR (FRUITS & LÉGUMES)',
    shortLabel: 'Cagette Pommes Golden (×6)',
    boxLabel: 'CAGETTE POMMES GOLDEN ×6',
    subtitle: 'Cagette bois claire-voie · 9,80 ₣/kg',
    primaryEan: '30140901',
    isWoodenCrate: true,
    crateFruitColor: 0xbef264,
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'produce_pommes',
        label: 'Pommes Golden de France',
        sublabel: 'Rayon 1 Primeur · 9,80 ₣/kg',
        ean: '30140901',
      },
    ],
  },
  {
    id: 'cagette_bananes_antilles',
    category: 'PRIMEUR (FRUITS & LÉGUMES)',
    shortLabel: 'Cagette Bananes Antilles (×6)',
    boxLabel: 'CAGETTE BANANES ANTILLES ×6',
    subtitle: 'Cagette bois/carton régimes · 11,50 ₣/kg',
    primaryEan: '30140902',
    isWoodenCrate: true,
    crateFruitColor: 0xfacc15,
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'produce_bananes',
        label: 'Bananes des Antilles',
        sublabel: 'Rayon 1 Primeur · 11,50 ₣/kg',
        ean: '30140902',
      },
    ],
  },
  {
    id: 'cagette_oranges_jus',
    category: 'PRIMEUR (FRUITS & LÉGUMES)',
    shortLabel: 'Cagette Oranges à Jus (×6)',
    boxLabel: 'CAGETTE ORANGES À JUS ×6',
    subtitle: 'Cagette bois claire-voie · 8,90 ₣/kg',
    primaryEan: '30140903',
    isWoodenCrate: true,
    crateFruitColor: 0xf97316,
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'produce_oranges',
        label: 'Oranges à Jus',
        sublabel: 'Rayon 1 Primeur · 8,90 ₣/kg',
        ean: '30140903',
      },
    ],
  },
  {
    id: 'cagette_tomates_grappe',
    category: 'PRIMEUR (FRUITS & LÉGUMES)',
    shortLabel: 'Cagette Tomates Grappe (×6)',
    boxLabel: 'CAGETTE TOMATES GRAPPE ×6',
    subtitle: 'Plateau bois maraîcher · 12,40 ₣/kg',
    primaryEan: '30140904',
    isWoodenCrate: true,
    crateFruitColor: 0xdc2626,
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'produce_tomates',
        label: 'Tomates Rondes en Grappe',
        sublabel: 'Rayon 1 Primeur · 12,40 ₣/kg',
        ean: '30140904',
      },
    ],
  },
  {
    id: 'cagette_carottes_lavees',
    category: 'PRIMEUR (FRUITS & LÉGUMES)',
    shortLabel: 'Cagette Carottes Lavées (×6)',
    boxLabel: 'CAGETTE CAROTTES LAVÉES ×6',
    subtitle: 'Cagette bois maraîchère · 6,50 ₣/kg',
    primaryEan: '30140905',
    isWoodenCrate: true,
    crateFruitColor: 0xea580c,
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'produce_carottes',
        label: 'Carottes Nouvelles Lavées',
        sublabel: 'Rayon 1 Primeur · 6,50 ₣/kg',
        ean: '30140905',
      },
    ],
  },
  {
    id: 'carton_pommes_de_terre_bintje',
    category: 'PRIMEUR (FRUITS & LÉGUMES)',
    shortLabel: 'Pommes de Terre 2,5kg (×6)',
    boxLabel: 'P. DE TERRE BINTJE 2,5KG ×6',
    subtitle: 'Carton 6 sacs filet · Étage Bas · 14,00 ₣',
    primaryEan: '30140906',
    isWoodenCrate: false,
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'produce_pommes_de_terre',
        label: 'Pommes de Terre Bintje (Sac 2,5kg)',
        sublabel: 'Rayon 1 Primeur · Étage Bas (14,00 ₣)',
        ean: '30140906',
      },
    ],
  },

  // 1A. SURGELÉS & GLACES (RAYON 6 — -18°C)
  {
    id: 'carton_frozen_frites',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Frites Allumettes 1kg (×10)',
    boxLabel: 'FRITES ALLUMETTES SURG. ×10',
    subtitle: 'Carton 10 sachets -18°C · Bac Bahut · 11,90 ₣',
    primaryEan: '30140801',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'frozen_frites',
        label: 'Frites Allumettes Surgelées 1kg',
        sublabel: 'Rayon 6 · Bac Bahut Surgelés (11,90 ₣)',
        ean: '30140801',
      },
    ],
  },
  {
    id: 'carton_frozen_pizza',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Pizza Royale Surgelée (×8)',
    boxLabel: 'PIZZA ROYALE SURGELÉE ×8',
    subtitle: 'Carton 8 boîtes -18°C · Bac Bahut · 18,50 ₣',
    primaryEan: '30140802',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'frozen_pizza',
        label: 'Pizza Royale Surgelée',
        sublabel: 'Rayon 6 · Bac Bahut Surgelés (18,50 ₣)',
        ean: '30140802',
      },
    ],
  },
  {
    id: 'carton_frozen_colin',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Bâtonnets Colin Panés ×10 (×10)',
    boxLabel: 'BÂTONNETS COLIN PANÉS ×10',
    subtitle: 'Carton 10 boîtes -18°C · Bac Bahut · 16,20 ₣',
    primaryEan: '30140803',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'frozen_colin',
        label: 'Bâtonnets Colin Panés x10',
        sublabel: 'Rayon 6 · Bac Bahut Surgelés (16,20 ₣)',
        ean: '30140803',
      },
    ],
  },
  {
    id: 'carton_frozen_haricots',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Haricots Verts Surgelés 1kg (×10)',
    boxLabel: 'HARICOTS VERTS SURGELÉS ×10',
    subtitle: 'Carton 10 sachets -18°C · Bac Bahut · 10,80 ₣',
    primaryEan: '30140804',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'frozen_haricots',
        label: 'Haricots Verts Surgelés 1kg',
        sublabel: 'Rayon 6 · Bac Bahut Surgelés (10,80 ₣)',
        ean: '30140804',
      },
    ],
  },
  {
    id: 'carton_frozen_glace_bac',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Bac Glace 3 Parfums 1L (×6)',
    boxLabel: 'BACS GLACE 3 PARFUMS 1L ×6',
    subtitle: 'Carton 6 bacs -18°C · Armoire Bas · 19,50 ₣',
    primaryEan: '30140805',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'frozen_glace_bac',
        label: 'Bac Glace 3 Parfums 1L',
        sublabel: 'Rayon 6 · Armoire Glaces Bas (19,50 ₣)',
        ean: '30140805',
      },
    ],
  },
  {
    id: 'carton_frozen_cones',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Cônes Vanille-Choco ×6 (×8)',
    boxLabel: 'CÔNES GLACÉS VANILLE-CHOC ×8',
    subtitle: 'Carton 8 boîtes -18°C · Armoire Mil. · 17,80 ₣',
    primaryEan: '30140806',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'frozen_cones',
        label: 'Cônes Glacés Vanille-Choco x6',
        sublabel: 'Rayon 6 · Armoire Glaces Milieu (17,80 ₣)',
        ean: '30140806',
      },
    ],
  },
  {
    id: 'carton_frozen_esquimaux',
    category: 'SURGELÉS & GLACES',
    shortLabel: 'Esquimaux Bâtonnets ×8 (×8)',
    boxLabel: 'ESQUIMAUX BÂTONNETS ×8 (×8)',
    subtitle: 'Carton 8 boîtes -18°C · Armoire Haut · 15,40 ₣',
    primaryEan: '30140807',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'frozen_esquimaux',
        label: 'Esquimaux Bâtonnets x8',
        sublabel: 'Rayon 6 · Armoire Glaces Haut (15,40 ₣)',
        ean: '30140807',
      },
    ],
  },

  // 1B. ÉPICERIE SALÉE & PÂTES (RAYON 7A)
  {
    id: 'carton_huile_tournesol',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Huile de Tournesol 1L (×6)',
    boxLabel: 'HUILE DE TOURNESOL 1L ×6',
    subtitle: 'Carton 6 bout. 1L · Étagère Basse · 11,50 ₣',
    primaryEan: '30140701',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'savory_huile_tournesol',
        label: 'Huile de Tournesol 1L',
        sublabel: 'Rayon 7A · Étagère Basse (11,50 ₣)',
        ean: '30140701',
      },
    ],
  },
  {
    id: 'carton_huile_olive',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: "Huile d'Olive Vierge 75cl (×6)",
    boxLabel: "HUILE D'OLIVE VIERGE 75CL ×6",
    subtitle: 'Carton 6 bout. verre · Étagère Basse · 26,00 ₣',
    primaryEan: '30140702',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'savory_huile_olive',
        label: "Huile d'Olive Vierge 75cl",
        sublabel: 'Rayon 7A · Étagère Basse (26,00 ₣)',
        ean: '30140702',
      },
    ],
  },
  {
    id: 'carton_cassoulet',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Cassoulet Toulousain 840g (×6)',
    boxLabel: 'CASSOULET TOULOUSAIN 840G ×6',
    subtitle: 'Carton 6 boîtes · Étagère Basse · 17,80 ₣',
    primaryEan: '30140703',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'savory_cassoulet',
        label: 'Cassoulet Toulousain 840g',
        sublabel: 'Rayon 7A · Étagère Basse (17,80 ₣)',
        ean: '30140703',
      },
    ],
  },
  {
    id: 'carton_coquillettes',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Pâtes Coquillettes 500g (×12)',
    boxLabel: 'PÂTES COQUILLETTES 500G ×12',
    subtitle: 'Carton 12 paquets · Étagère Centr. · 5,40 ₣',
    primaryEan: '30140704',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'savory_coquillettes',
        label: 'Pâtes Coquillettes 500g',
        sublabel: 'Rayon 7A · Étagère Centrale (5,40 ₣)',
        ean: '30140704',
      },
    ],
  },
  {
    id: 'carton_spaghetti',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Spaghetti Supérieurs 500g (×12)',
    boxLabel: 'SPAGHETTI SUPÉRIEURS 500G ×12',
    subtitle: 'Carton 12 paquets · Étagère Centr. · 5,80 ₣',
    primaryEan: '30140705',
    unitsPerCarton: 12,
    cycleItems: [
      {
        kind: 'savory_spaghetti',
        label: 'Spaghetti Supérieurs 500g',
        sublabel: 'Rayon 7A · Étagère Centrale (5,80 ₣)',
        ean: '30140705',
      },
    ],
  },
  {
    id: 'carton_riz_long',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Riz Long Grain 1kg (×8)',
    boxLabel: 'RIZ LONG GRAIN 1KG ×8',
    subtitle: 'Carton 8 boîtes · Étagère Centr. · 12,20 ₣',
    primaryEan: '30140706',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'savory_riz',
        label: 'Riz Long Grain 1kg',
        sublabel: 'Rayon 7A · Étagère Centrale (12,20 ₣)',
        ean: '30140706',
      },
    ],
  },
  {
    id: 'carton_sauce_tomate_pav',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Sauce Tomate Bocaux PAV (×4)',
    boxLabel: 'PRÉSENTOIRS PAV SAUCE TOMATE ×4',
    subtitle: '4 cartons PAV (×8 boc.) · Étagère Centr. · 9,60 ₣',
    primaryEan: '30140707',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'savory_sauce_tomate_pav',
        label: 'Présentoir PAV Sauce Tomate Basilic (×8)',
        sublabel: 'Rayon 7A · Étagère Centrale (Glisser au fond)',
        ean: '30140707',
      },
    ],
  },
  {
    id: 'carton_petits_pois_pav',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Petits Pois 400g PAV (×4)',
    boxLabel: 'PRÉSENTOIRS PAV PETITS POIS ×4',
    subtitle: '4 cartons PAV (×8 boîtes) · Étagère Haute · 6,90 ₣',
    primaryEan: '30140708',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'savory_petits_pois_pav',
        label: 'Présentoir PAV Petits Pois Carottes (×8)',
        sublabel: 'Rayon 7A · Étagère Haute (Glisser au fond)',
        ean: '30140708',
      },
    ],
  },
  {
    id: 'carton_moutarde_pav',
    category: 'ÉPICERIE SALÉE & PÂTES',
    shortLabel: 'Moutarde Dijon 250g PAV (×4)',
    boxLabel: 'PRÉSENTOIRS PAV MOUTARDE DIJON ×4',
    subtitle: '4 cartons PAV (×8 pots) · Étagère Haute · 7,50 ₣',
    primaryEan: '30140709',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'savory_moutarde_pav',
        label: 'Présentoir PAV Moutarde de Dijon (×8)',
        sublabel: 'Rayon 7A · Étagère Haute (Glisser au fond)',
        ean: '30140709',
      },
    ],
  },

  // 1B. ÉPICERIE SUCRÉE & SNACKS (RAYON 7B)
  {
    id: 'carton_chips_nature',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Chips Nature 200g (×10)',
    boxLabel: 'CHIPS NATURE CRAQUANTES ×10',
    subtitle: 'Carton 10 sachets · Étagère Basse · 8,90 ₣',
    primaryEan: '30140601',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'snack_chips_nature',
        label: 'Chips Nature Craquantes 200g',
        sublabel: 'Rayon 7B · Étagère Basse (8,90 ₣)',
        ean: '30140601',
      },
    ],
  },
  {
    id: 'carton_chips_bbq',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Chips BBQ & Paprika 200g (×10)',
    boxLabel: 'CHIPS BBQ & PAPRIKA ×10',
    subtitle: 'Carton 10 sachets · Étagère Basse · 9,50 ₣',
    primaryEan: '30140602',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'snack_chips_bbq',
        label: 'Chips Barbecue & Paprika 200g',
        sublabel: 'Rayon 7B · Étagère Basse (9,50 ₣)',
        ean: '30140602',
      },
    ],
  },
  {
    id: 'carton_biscuits_sables',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Biscuits Sablés Beurre (×8)',
    boxLabel: 'BISCUITS SABLÉS PUR BEURRE ×8',
    subtitle: 'Carton 8 boîtes · Étagère Basse · 13,80 ₣',
    primaryEan: '30140603',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'snack_biscuits_sables',
        label: 'Biscuits Sablés Pur Beurre',
        sublabel: 'Rayon 7B · Étagère Basse (13,80 ₣)',
        ean: '30140603',
      },
    ],
  },
  {
    id: 'carton_pate_tartiner',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Pâte à Tartiner 400g (×6)',
    boxLabel: 'PÂTE À TARTINER NOISETTES ×6',
    subtitle: 'Carton 6 pots verre · Étagère Centr. · 16,50 ₣',
    primaryEan: '30140604',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'snack_pate_tartiner',
        label: 'Pâte à Tartiner Noisettes 400g',
        sublabel: 'Rayon 7B · Étagère Centrale (16,50 ₣)',
        ean: '30140604',
      },
    ],
  },
  {
    id: 'carton_madeleines',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Madeleines Moelleuses ×12 (×8)',
    boxLabel: 'MADELEINES MOELLEUSES ×8',
    subtitle: 'Carton 8 sachets · Étagère Centr. · 11,20 ₣',
    primaryEan: '30140605',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'snack_madeleines',
        label: 'Madeleines Moelleuses ×12',
        sublabel: 'Rayon 7B · Étagère Centrale (11,20 ₣)',
        ean: '30140605',
      },
    ],
  },
  {
    id: 'carton_gaufrettes',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Gaufrettes Chocolat (×10)',
    boxLabel: 'GAUFRETTES FOURRÉES CHOC. ×10',
    subtitle: 'Carton 10 paquets · Étagère Centr. · 9,80 ₣',
    primaryEan: '30140606',
    unitsPerCarton: 10,
    cycleItems: [
      {
        kind: 'snack_gaufrettes',
        label: 'Gaufrettes Fourrées Chocolat',
        sublabel: 'Rayon 7B · Étagère Centrale (9,80 ₣)',
        ean: '30140606',
      },
    ],
  },
  {
    id: 'carton_choco_pav',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Chocolat Lait/Nois. PAV (×4)',
    boxLabel: 'PRÉSENTOIRS PAV CHOCOLAT ×4',
    subtitle: '4 cartons PAV (×10 tabl.) · Étagère Haute · 10,50 ₣',
    primaryEan: '30140607',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'snack_choco_pav',
        label: 'Présentoir PAV Tablettes Chocolat (×10)',
        sublabel: 'Rayon 7B · Étagère Haute (Glisser au fond)',
        ean: '30140607',
      },
    ],
  },
  {
    id: 'carton_bonbons_pav',
    category: 'ÉPICERIE SUCRÉE & SNACKS',
    shortLabel: 'Bonbons & Confis. PAV (×4)',
    boxLabel: 'PRÉSENTOIRS PAV BONBONS ×4',
    subtitle: '4 cartons PAV (×8 sach.) · Étagère Haute · 12,00 ₣',
    primaryEan: '30140608',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'snack_bonbons_pav',
        label: 'Présentoir PAV Sachets Bonbons (×8)',
        sublabel: 'Rayon 7B · Étagère Haute (Glisser au fond)',
        ean: '30140608',
      },
    ],
  },

  // 1B. CAVE À VINS & BIÈRES (RAYON 8)
  {
    id: 'carton_wine_bordeaux',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Bordeaux Rouge AOC 1988 (×6)',
    boxLabel: 'BORDEAUX ROUGE AOC 1988 ×6',
    subtitle: 'Carton 6 bout. 75cl · Cave · 38,00 ₣',
    primaryEan: '30140501',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'wine_bordeaux',
        label: 'Bordeaux Rouge AOC 1988 75cl',
        sublabel: 'Cave à Vins · Étagère Centrale (38,00 ₣)',
        ean: '30140501',
      },
    ],
  },
  {
    id: 'carton_wine_bourgogne',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Bourgogne Blanc 75cl (×6)',
    boxLabel: 'BOURGOGNE BLANC 75CL ×6',
    subtitle: 'Carton 6 bout. 75cl · Cave · 44,50 ₣',
    primaryEan: '30140502',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'wine_bourgogne',
        label: 'Bourgogne Blanc 75cl',
        sublabel: 'Cave à Vins · Étagère Centrale (44,50 ₣)',
        ean: '30140502',
      },
    ],
  },
  {
    id: 'carton_wine_champagne',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Champagne Brut Réserve (×3)',
    boxLabel: 'CHAMPAGNE BRUT RÉSERVE ×3',
    subtitle: 'Caisse 3 bout. 75cl · Cave · 115,00 ₣',
    primaryEan: '30140503',
    unitsPerCarton: 3,
    cycleItems: [
      {
        kind: 'wine_champagne',
        label: 'Champagne Brut Réserve 75cl',
        sublabel: 'Cave à Vins · Étagère Centrale (115,00 ₣)',
        ean: '30140503',
      },
    ],
  },
  {
    id: 'carton_beer_sixpack',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Pack Bières Blondes 6×25 (×4)',
    boxLabel: 'PACKS BIÈRES BLONDES 6×25 ×4',
    subtitle: 'Caisse 4 packs ×6 · Étagère Basse · 22,00 ₣',
    primaryEan: '30140504',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'beer_sixpack',
        label: 'Pack Bières Blondes 6×25cl',
        sublabel: 'Cave à Vins · Étagère Basse (22,00 ₣)',
        ean: '30140504',
      },
    ],
  },
  {
    id: 'carton_beer_ambree',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Bière Ambrée 75cl Méc. (×6)',
    boxLabel: 'BIÈRE AMBRÉE 75CL MÉC. ×6',
    subtitle: 'Caisse 6 bout. bouchon méc. · 18,50 ₣',
    primaryEan: '30140505',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'beer_ambree',
        label: 'Bière Ambrée 75cl Bouchon Mécanique',
        sublabel: 'Cave à Vins · Étagère Haute (18,50 ₣)',
        ean: '30140505',
      },
    ],
  },
  {
    id: 'carton_cidre_normandie',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Cidre Brut Normandie 75cl (×6)',
    boxLabel: 'CIDRE BRUT NORMANDIE ×6',
    subtitle: 'Caisse 6 bout. 75cl · Étagère Basse · 14,00 ₣',
    primaryEan: '30140506',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'cidre_normandie',
        label: 'Cidre Brut de Normandie 75cl',
        sublabel: 'Cave à Vins · Étagère Basse (14,00 ₣)',
        ean: '30140506',
      },
    ],
  },
  {
    id: 'carton_pastis_marseille',
    category: 'CAVE À VINS & BIÈRES',
    shortLabel: 'Pastis de Marseille 1L (×6)',
    boxLabel: 'PASTIS DE MARSEILLE 1L ×6',
    subtitle: 'Caisse 6 bout. 1L · Étagère Haute · 76,00 ₣',
    primaryEan: '30140507',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'pastis_marseille',
        label: 'Pastis de Marseille 1L',
        sublabel: 'Cave à Vins · Étagère Haute (76,00 ₣)',
        ean: '30140507',
      },
    ],
  },

  // 2. BOUCHERIE & CHARCUTERIE (RAYON 4)
  {
    id: 'carton_beef_primal',
    category: 'BOUCHERIE & CHARCUTERIE',
    shortLabel: 'Faux-Filet Bœuf Pièces (×4)',
    boxLabel: 'FAUX-FILET BŒUF À TRANCHER ×4',
    subtitle: 'Frais +2°C · Découper au billot · 68,00 ₣/kg',
    primaryEan: '30140401',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'beef_primal',
        label: 'Faux-Filet de Bœuf (Pièce à trancher)',
        sublabel: 'À découper sur le billot de boucherie',
        ean: '30140401',
      },
    ],
  },
  {
    id: 'carton_pork_primal',
    category: 'BOUCHERIE & CHARCUTERIE',
    shortLabel: 'Rôti de Porc Filet (×4)',
    boxLabel: 'RÔTI DE PORC FILET ×4',
    subtitle: 'Frais +2°C · Découper au billot · 42,00 ₣/kg',
    primaryEan: '30140402',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'pork_primal',
        label: 'Rôti de Porc Filet (Pièce)',
        sublabel: 'À découper sur le billot de boucherie',
        ean: '30140402',
      },
    ],
  },
  {
    id: 'carton_ham_block',
    category: 'BOUCHERIE & CHARCUTERIE',
    shortLabel: 'Jambon Blanc Bloc (×4)',
    boxLabel: 'JAMBON BLANC BLOC TRANCHEUSE ×4',
    subtitle: 'Frais +2°C · Trancheuse jambon · 46,00 ₣/kg',
    primaryEan: '30140403',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'ham_block',
        label: 'Jambon Blanc Supérieur (Bloc)',
        sublabel: 'À charger sur la trancheuse à jambon',
        ean: '30140403',
      },
    ],
  },
  {
    id: 'carton_steaks_haches',
    category: 'BOUCHERIE & CHARCUTERIE',
    shortLabel: 'Barq. Steaks Hachés ×6 (×6)',
    boxLabel: 'BARQUETTES STEAKS HACHÉS ×6',
    subtitle: 'Prêt vitrine · Rayon 4 · 29,50 ₣',
    primaryEan: '30140404',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'butcher_tray_steaks',
        label: 'Barquette Steaks Hachés ×6',
        sublabel: 'Vitrine Boucherie · Mise en profondeur',
        ean: '30140404',
      },
    ],
  },
  {
    id: 'carton_merguez_saucisses',
    category: 'BOUCHERIE & CHARCUTERIE',
    shortLabel: 'Barq. Merguez & Sauc. ×6 (×6)',
    boxLabel: 'BARQUETTES MERGUEZ SAUCISSES ×6',
    subtitle: 'Prêt vitrine · Rayon 4 · 26,00 ₣',
    primaryEan: '30140405',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'butcher_tray_merguez',
        label: 'Barquette Merguez & Saucisses ×6',
        sublabel: 'Vitrine Boucherie · Mise en profondeur',
        ean: '30140405',
      },
    ],
  },

  // 3. BOULANGERIE (POINT CHAUD — RAYON 2)
  {
    id: 'carton_baguette_raw',
    category: 'BOULANGERIE (POINT CHAUD)',
    shortLabel: 'Baguettes Crues 250g (×20)',
    boxLabel: 'PÂTONS BAGUETTE TRADITION ×20',
    subtitle: 'Surgelé · Cuire au Four Point Chaud · 4,50 ₣',
    primaryEan: '30140301',
    unitsPerCarton: 20,
    cycleItems: [
      {
        kind: 'baguette_raw',
        label: 'Pâton Baguette Tradition (Cru)',
        sublabel: 'À poser sur la plaque du Four Point Chaud',
        ean: '30140301',
      },
    ],
  },
  {
    id: 'carton_croissant_raw',
    category: 'BOULANGERIE (POINT CHAUD)',
    shortLabel: 'Croissants Beurre Crus (×30)',
    boxLabel: 'PÂTONS CROISSANT PUR BEURRE ×30',
    subtitle: 'Surgelé · Cuire au Four Point Chaud · 5,20 ₣',
    primaryEan: '30140302',
    unitsPerCarton: 30,
    cycleItems: [
      {
        kind: 'croissant_raw',
        label: 'Croissant Pur Beurre (Cru)',
        sublabel: 'À poser sur la plaque du Four Point Chaud',
        ean: '30140302',
      },
    ],
  },
  {
    id: 'carton_pain_choc_raw',
    category: 'BOULANGERIE (POINT CHAUD)',
    shortLabel: 'Pains Chocolat Crus (×30)',
    boxLabel: 'PÂTONS PAIN AU CHOCOLAT ×30',
    subtitle: 'Surgelé · Cuire au Four Point Chaud · 5,80 ₣',
    primaryEan: '30140303',
    unitsPerCarton: 30,
    cycleItems: [
      {
        kind: 'pain_choc_raw',
        label: 'Pain au Chocolat (Cru)',
        sublabel: 'À poser sur la plaque du Four Point Chaud',
        ean: '30140303',
      },
    ],
  },
  {
    id: 'carton_brioche_bagged',
    category: 'BOULANGERIE (POINT CHAUD)',
    shortLabel: 'Brioche Tressée 400g (×8)',
    boxLabel: 'BRIOCHE TRESSÉE SACHET ×8',
    subtitle: 'Prête en sachet · Rayon 2 Haut · 16,50 ₣',
    primaryEan: '30140304',
    unitsPerCarton: 8,
    cycleItems: [
      {
        kind: 'brioche_bagged',
        label: 'Brioche Tressée 400g (Sachet)',
        sublabel: 'Rayon Boulangerie · Étagère Haute',
        ean: '30140304',
      },
    ],
  },

  // 3. HYGIÈNE & ENTRETIEN (RAYON 9)
  {
    id: 'carton_lessive_3l',
    category: 'HYGIÈNE & ENTRETIEN',
    shortLabel: 'Lessive Bidon 3L (×4)',
    boxLabel: 'LESSIVE LIQUIDE BIDON 3L',
    subtitle: 'Rayon 9 · Étagère Basse · 54,00 ₣',
    primaryEan: '30140201',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'hyg_lessive_3l',
        label: 'Lessive Liquide Bidon 3L',
        sublabel: 'Rayon Hygiène · Étagère Basse',
        ean: '30140201',
      },
    ],
  },
  {
    id: 'carton_papier_toilette',
    category: 'HYGIÈNE & ENTRETIEN',
    shortLabel: 'Papier Toilette Pack ×6 (×4)',
    boxLabel: 'PAPIER TOILETTE PACK ×6',
    subtitle: 'Rayon 9 · Étagère Basse · 19,50 ₣',
    primaryEan: '30140202',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'hyg_tp_pack',
        label: 'Papier Toilette Pack x6',
        sublabel: 'Rayon Hygiène · Étagère Basse',
        ean: '30140202',
      },
    ],
  },
  {
    id: 'carton_shampoing',
    category: 'HYGIÈNE & ENTRETIEN',
    shortLabel: 'Shampoing Doux 400ml (×6)',
    boxLabel: 'SHAMPOING DOUX FLACON 400ML',
    subtitle: 'Rayon 9 · Étagère Centrale · 16,90 ₣',
    primaryEan: '30140203',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'hyg_shampoing',
        label: 'Shampoing Doux Flacon 400ml',
        sublabel: 'Rayon Hygiène · Étagère Centrale',
        ean: '30140203',
      },
    ],
  },
  {
    id: 'carton_gel_douche',
    category: 'HYGIÈNE & ENTRETIEN',
    shortLabel: 'Gel Douche Fraîcheur (×6)',
    boxLabel: 'GEL DOUCHE FRAÎCHEUR',
    subtitle: 'Rayon 9 · Étagère Centrale · 14,50 ₣',
    primaryEan: '30140204',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'hyg_gel_douche',
        label: 'Gel Douche Fraîcheur',
        sublabel: 'Rayon Hygiène · Étagère Centrale',
        ean: '30140204',
      },
    ],
  },
  {
    id: 'carton_dentifrice_pav',
    category: 'HYGIÈNE & ENTRETIEN',
    shortLabel: 'Dentifrice (Carton PAV ×12)',
    boxLabel: 'DENTIFRICE MENTHE CARTON PAV',
    subtitle: 'Rayon 9 · Étagère Haute · 11,80 ₣',
    primaryEan: '30140205',
    unitsPerCarton: 3,
    cycleItems: [
      {
        kind: 'hyg_dentifrice_pav',
        label: 'Dentifrice Menthe Carton PAV ×12',
        sublabel: 'Présentoir PAV · Glisser au fond (Étagère Haute)',
        ean: '30140205',
      },
    ],
  },

  // 3. ANIMALERIE (RAYON 10)
  {
    id: 'carton_croq_10kg',
    category: 'ANIMALERIE',
    shortLabel: 'Croquettes Chien/Chat 10/8kg',
    boxLabel: 'CROQUETTES GRAND SAC 10/8KG',
    subtitle: 'Rayon 10 · Étagère Basse',
    primaryEan: '30140101',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'kibble_large_dog',
        label: 'Croquettes Chien Grand Sac 10kg',
        sublabel: 'Rayon Animalerie · Étagère Basse',
        ean: '30140101',
      },
      {
        kind: 'kibble_large_cat',
        label: 'Croquettes Chat Grand Sac 8kg',
        sublabel: 'Rayon Animalerie · Étagère Basse',
        ean: '30140104',
      },
    ],
  },
  {
    id: 'carton_croq_3kg',
    category: 'ANIMALERIE',
    shortLabel: 'Croquettes Chien/Chat 3kg',
    boxLabel: 'CROQUETTES SAC MOYEN 3KG',
    subtitle: 'Rayon 10 · Étagère Centrale',
    primaryEan: '30140102',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'kibble_med_dog',
        label: 'Croquettes Chien Sac Moyen 3kg',
        sublabel: 'Rayon Animalerie · Étagère Centrale',
        ean: '30140102',
      },
      {
        kind: 'kibble_med_cat',
        label: 'Croquettes Chat Sac Moyen 3kg',
        sublabel: 'Rayon Animalerie · Étagère Centrale',
        ean: '30140105',
      },
    ],
  },
  {
    id: 'carton_croq_1kg',
    category: 'ANIMALERIE',
    shortLabel: 'Croquettes Chien/Chat 1kg',
    boxLabel: 'CROQUETTES PETIT SAC 1KG',
    subtitle: 'Rayon 10 · Étagère Haute',
    primaryEan: '30140103',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'kibble_small_dog',
        label: 'Croquettes Chien Petit Sac 1kg',
        sublabel: 'Rayon Animalerie · Étagère Haute',
        ean: '30140103',
      },
      {
        kind: 'kibble_small_cat',
        label: 'Croquettes Chat Petit Sac 1kg',
        sublabel: 'Rayon Animalerie · Étagère Haute',
        ean: '30140106',
      },
    ],
  },
  {
    id: 'carton_patee_pav',
    category: 'ANIMALERIE',
    shortLabel: 'Pâtée Chien/Chat (Carton PAV)',
    boxLabel: 'PÂTÉE CHIEN & CHAT PAV',
    subtitle: 'Rayon 10 · Étagère Centrale',
    primaryEan: '30140107',
    unitsPerCarton: 4,
    cycleItems: [
      {
        kind: 'wet_tray_dog',
        label: 'Pâtée Chien Boîtes Lot (PAV)',
        sublabel: 'Présentoir fin · Glisser au fond',
        ean: '30140107',
      },
      {
        kind: 'wet_tray_cat',
        label: 'Pâtée Chat Barquettes Lot (PAV)',
        sublabel: 'Présentoir fin · Glisser au fond',
        ean: '30140108',
      },
    ],
  },
  {
    id: 'carton_jouets_pet',
    category: 'ANIMALERIE',
    shortLabel: 'Jouets Chien & Chat (×6)',
    boxLabel: 'JOUETS ANIMALERIE ASSORTIS',
    subtitle: 'Rayon 10 · Étagère Haute',
    primaryEan: '30140109',
    unitsPerCarton: 6,
    cycleItems: [
      {
        kind: 'toy_tennis',
        label: 'Balle de Tennis Chien',
        sublabel: 'Rayon Animalerie · Jouets',
        ean: '30140109',
      },
      {
        kind: 'toy_squeaky',
        label: 'Balle Couineuse Pouic',
        sublabel: 'Rayon Animalerie · Jouets',
        ean: '30140110',
      },
      {
        kind: 'toy_cat_bell',
        label: 'Balle Grelot Chat',
        sublabel: 'Rayon Animalerie · Jouets',
        ean: '30140111',
      },
    ],
  },
];

export interface OrderedCartonLine {
  def: OrderableCartonDef;
  qty: number;
}

export type OrderTerminalKeyCode =
  | 'HAUT'
  | 'BAS'
  | 'QTE+'
  | 'QTE-'
  | 'VALIDER'
  | 'TRANSMETTRE';

const ORDER_DEBOUNCE_MS = 320;

export class OrderTerminalModel {
  private selectedIndex = 0;
  private quantities: Record<string, number> = {};
  private statusText = 'PRÊT — SÉLECTIONNEZ UN CARTON';
  private lastPressTime = 0;
  private transmissionCount = 0;
  private changeListeners: Array<() => void> = [];
  private transmitListeners: Array<(lines: OrderedCartonLine[]) => void> = [];

  onChange(fn: () => void): () => void {
    this.changeListeners.push(fn);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== fn);
    };
  }

  onTransmitOrder(fn: (lines: OrderedCartonLine[]) => void): () => void {
    this.transmitListeners.push(fn);
    return () => {
      this.transmitListeners = this.transmitListeners.filter((l) => l !== fn);
    };
  }

  private notifyChange(): void {
    for (let i = 0; i < this.changeListeners.length; i++) {
      this.changeListeners[i]();
    }
  }

  getSelectedDef(): OrderableCartonDef {
    return ORDER_CATALOG[this.selectedIndex];
  }

  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  getQty(id: string): number {
    return this.quantities[id] ?? 0;
  }

  getTotalCartons(): number {
    let total = 0;
    for (const q of Object.values(this.quantities)) {
      total += q;
    }
    return total;
  }

  getUnitPriceCents(def: OrderableCartonDef): number {
    if (def.isLongRailBox) return 1200; // 12,00 F par réglette plastique 120 cm (120,00 F le carton de 10)
    const prod = getProductByEan(def.primaryEan);
    if (prod) return prod.priceCents;
    return 1500;
  }

  getCartonPriceCents(def: OrderableCartonDef): number {
    return this.getUnitPriceCents(def) * def.unitsPerCarton;
  }

  getCartTotalCents(): number {
    let total = 0;
    for (const def of ORDER_CATALOG) {
      const q = this.quantities[def.id] ?? 0;
      if (q > 0) {
        total += q * this.getCartonPriceCents(def);
      }
    }
    return total;
  }

  adjustCartonQty(defId: string, delta: number): number {
    const def = ORDER_CATALOG.find((d) => d.id === defId);
    if (!def) return 0;
    const prev = this.quantities[defId] ?? 0;
    const next = Math.max(0, Math.min(9, prev + delta));
    if (next === 0) {
      delete this.quantities[defId];
      this.statusText = `RETIRÉ : ${def.shortLabel.slice(0, 20)}`;
    } else {
      this.quantities[defId] = next;
      this.statusText = `PC CENTRALE : ${next}× ${def.shortLabel.slice(0, 18)}`;
    }
    this.notifyChange();
    return next;
  }

  clearCart(): void {
    this.quantities = {};
    this.statusText = 'PANIER VIDÉ (CENTRALE-ACHAT 90)';
    this.notifyChange();
  }

  transmitFromPc(): { ok: boolean; totalCartons: number; totalCents: number } {
    const lines: OrderedCartonLine[] = [];
    let totalCents = 0;
    for (const def of ORDER_CATALOG) {
      const q = this.getQty(def.id);
      if (q > 0) {
        lines.push({ def, qty: q });
        totalCents += q * this.getCartonPriceCents(def);
      }
    }
    if (lines.length === 0) {
      return { ok: false, totalCartons: 0, totalCents: 0 };
    }
    const totalCartons = lines.reduce((acc, l) => acc + l.qty, 0);
    this.quantities = {};
    this.transmissionCount += 1;
    this.statusText = `LIVRÉ AU QUAI (${totalCartons} CART.)`;
    soundSynth.playCentraleAchatModemAndPrinter();
    for (let i = 0; i < this.transmitListeners.length; i++) {
      this.transmitListeners[i](lines);
    }
    this.notifyChange();
    return { ok: true, totalCartons, totalCents };
  }

  getStatusText(): string {
    return this.statusText;
  }

  getTransmissionCount(): number {
    return this.transmissionCount;
  }

  getHudState(raised: boolean): OrdererHudState {
    const def = this.getSelectedDef();
    return {
      raised,
      selectedLabel: def.shortLabel,
      selectedQty: this.getQty(def.id),
      totalCartons: this.getTotalCartons(),
      lastStatus: this.statusText,
    };
  }

  pressKey(code: OrderTerminalKeyCode): boolean {
    const now = performance.now();
    if (now - this.lastPressTime < ORDER_DEBOUNCE_MS) return false;
    this.lastPressTime = now;

    const current = this.getSelectedDef();
    const curQty = this.getQty(current.id);

    if (code === 'HAUT') {
      this.selectedIndex = (this.selectedIndex - 1 + ORDER_CATALOG.length) % ORDER_CATALOG.length;
      this.statusText = `${this.getSelectedDef().category}`;
      soundSynth.playAtmPiezo('digit');
    } else if (code === 'BAS') {
      this.selectedIndex = (this.selectedIndex + 1) % ORDER_CATALOG.length;
      this.statusText = `${this.getSelectedDef().category}`;
      soundSynth.playAtmPiezo('digit');
    } else if (code === 'QTE+') {
      const next = Math.min(4, curQty + 1);
      this.quantities[current.id] = next;
      this.statusText = `AJOUTÉ : ${next}× ${current.shortLabel.slice(0, 18)}`;
      soundSynth.playAtmPiezo('bezel');
    } else if (code === 'QTE-') {
      const next = Math.max(0, curQty - 1);
      this.quantities[current.id] = next;
      this.statusText =
        next === 0
          ? `RETIRÉ : ${current.shortLabel.slice(0, 20)}`
          : `QTÉ : ${next}× ${current.shortLabel.slice(0, 18)}`;
      soundSynth.playAtmPiezo('correct');
    } else if (code === 'VALIDER') {
      // Quick-confirm adds 1 carton if currently 0, else confirms current line quantity
      const next = curQty === 0 ? 1 : curQty;
      this.quantities[current.id] = next;
      this.statusText = `LIGNE VALIDÉE (${next}×) — [TRANSMETTRE]`;
      soundSynth.playAtmPiezo('confirm');
    } else if (code === 'TRANSMETTRE') {
      const lines: OrderedCartonLine[] = [];
      for (const def of ORDER_CATALOG) {
        const q = this.getQty(def.id);
        if (q > 0) {
          lines.push({ def, qty: q });
        }
      }
      // If user hits TRANSMETTRE directly on a highlighted item with qty 0, order 1× of it smoothly
      if (lines.length === 0) {
        lines.push({ def: current, qty: 1 });
      }
      const totalDelivered = lines.reduce((acc, l) => acc + l.qty, 0);
      this.quantities = {};
      this.transmissionCount += 1;
      this.statusText = `TRANSMISSION CENTRALE OK (${totalDelivered} CART.)`;
      soundSynth.playAcousticModemBurst();
      for (let i = 0; i < this.transmitListeners.length; i++) {
        this.transmitListeners[i](lines);
      }
    }

    this.notifyChange();
    return true;
  }

  /**
   * Renders the sober 1990 monochrome Telxon/MSI LCD OS ("COMMANDE-CENTRALE v2.1 — 1990")
   * onto either the docked warehouse receiving terminal or the handheld 3D tool canvas.
   */
  drawLcd(canvas: HTMLCanvasElement): void {
    const c = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;

    // Authentic 1990 reflective olive-grey industrial LCD
    c.fillStyle = '#b4c5a4';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#25311d';
    c.lineWidth = 6;
    c.strokeRect(4, 4, W - 8, H - 8);

    // Header bar
    c.fillStyle = '#1f2b18';
    c.fillRect(10, 10, W - 20, 40);
    c.fillStyle = '#d3e2c4';
    c.font = '800 18px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText('COMMANDE-CENTRALE v2.1 — 1990', 20, 30);
    c.textAlign = 'right';
    const total = this.getTotalCartons();
    c.fillText(`PANIER:${total}`, W - 20, 30);

    // Current category strip
    const selDef = this.getSelectedDef();
    c.fillStyle = '#9db18b';
    c.fillRect(14, 56, W - 28, 28);
    c.fillStyle = '#141e0f';
    c.font = '800 16px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(`CAT: ${selDef.category}`, 22, 70);
    c.textAlign = 'right';
    c.fillText(`${this.selectedIndex + 1}/${ORDER_CATALOG.length}`, W - 22, 70);

    // 5-row scrollable list window centered around selectedIndex
    const visibleRows = 5;
    let startIdx = Math.max(0, this.selectedIndex - 2);
    if (startIdx + visibleRows > ORDER_CATALOG.length) {
      startIdx = Math.max(0, ORDER_CATALOG.length - visibleRows);
    }

    for (let r = 0; r < visibleRows; r++) {
      const idx = startIdx + r;
      if (idx >= ORDER_CATALOG.length) break;
      const item = ORDER_CATALOG[idx];
      const qty = this.getQty(item.id);
      const isSel = idx === this.selectedIndex;
      const rowY = 92 + r * 34;

      if (isSel) {
        c.fillStyle = '#1f2b18';
        c.fillRect(14, rowY, W - 28, 30);
      }

      c.fillStyle = isSel ? '#dce8cf' : '#1b2615';
      c.font = `${isSel ? '800' : '700'} 16px "JetBrains Mono", monospace`;
      c.textAlign = 'left';
      const prefix = isSel ? '▸ ' : '  ';
      c.fillText(`${prefix}${item.shortLabel.slice(0, 29)}`, 20, rowY + 15);

      c.textAlign = 'right';
      const qtyBadge = qty > 0 ? `[×${qty}]` : '[ 0 ]';
      c.fillText(qtyBadge, W - 22, rowY + 15);
    }

    // Bottom status bar (Acoustic Modem Transmission Status)
    c.fillStyle = '#25311d';
    c.fillRect(10, H - 46, W - 20, 36);
    c.fillStyle = '#d3e2c4';
    c.font = '800 16px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText(this.statusText.slice(0, 38), 20, H - 28);
  }
}
