// Complete 1990 French Supermarket Product Catalog ("CONTACT EXPRESS 3D")
// Every product has a unique 8-digit EAN barcode and a fixed official price in French Francs (₣).

export interface CatalogProduct {
  ean: string;
  name: string;
  shortName: string;
  department: string;
  priceCents: number;
  priceInput: string;
  priceText: string;
  unitSuffix?: string;
}

function makeProduct(
  ean: string,
  name: string,
  shortName: string,
  department: string,
  priceCents: number,
  unitSuffix = ''
): CatalogProduct {
  const whole = Math.floor(priceCents / 100);
  const dec = (priceCents % 100).toString().padStart(2, '0');
  const priceInput = `${whole},${dec}`;
  return {
    ean,
    name,
    shortName,
    department,
    priceCents,
    priceInput,
    priceText: `${priceInput} ₣${unitSuffix}`,
    unitSuffix: unitSuffix || undefined,
  };
}

export const PRODUCT_CATALOG: CatalogProduct[] = [
  // ============================================================================
  // MATÉRIEL RAYON — RÉGLETTES PLASTIQUES PORTE-ÉTIQUETTES (V21 EAN 30140001)
  // ============================================================================
  makeProduct('30140001', 'Barres / Réglettes Plastiques Porte-Étiquettes (Lot ×10)', 'RÉGLETTES PVC ×10', 'MATÉRIEL RAYON', 12000),

  // ============================================================================
  // RAYON ANIMALERIE (11 OFFICIAL ITEMS — EXACT V8 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140101', 'Croquettes Chien Grand Sac 10kg', 'CROQ. CHIEN 10KG', 'ANIMALERIE', 8900),
  makeProduct('30140102', 'Croquettes Chien Sac Moyen 3kg', 'CROQ. CHIEN 3KG', 'ANIMALERIE', 3650),
  makeProduct('30140103', 'Croquettes Chien Petit Sac 1kg', 'CROQ. CHIEN 1KG', 'ANIMALERIE', 1490),
  makeProduct('30140104', 'Croquettes Chat Grand Sac 8kg', 'CROQ. CHAT 8KG', 'ANIMALERIE', 7900),
  makeProduct('30140105', 'Croquettes Chat Sac Moyen 3kg', 'CROQ. CHAT 3KG', 'ANIMALERIE', 3450),
  makeProduct('30140106', 'Croquettes Chat Petit Sac 1kg', 'CROQ. CHAT 1KG', 'ANIMALERIE', 1350),
  makeProduct('30140107', 'Pâtée Chien Boîtes Lot', 'PÂTÉE CHIEN LOT', 'ANIMALERIE', 2400),
  makeProduct('30140108', 'Pâtée Chat Barquettes Lot', 'PÂTÉE CHAT LOT', 'ANIMALERIE', 2150),
  makeProduct('30140109', 'Balle de Tennis Chien', 'BALLE TENNIS CHIEN', 'ANIMALERIE', 950),
  makeProduct('30140110', 'Balle Couineuse Pouic', 'BALLE COUINEUSE', 'ANIMALERIE', 1200),
  makeProduct('30140111', 'Balle Grelot Chat', 'BALLE GRELOT CHAT', 'ANIMALERIE', 800),

  // ============================================================================
  // RAYON 1 — PRIMEUR : FRUITS & LÉGUMES (6 OFFICIAL V16 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140901', 'Pommes Golden de France', 'POMMES GOLDEN FR', 'PRIMEUR', 980, '/kg'),
  makeProduct('30140902', 'Bananes des Antilles', 'BANANES ANTILLES', 'PRIMEUR', 1150, '/kg'),
  makeProduct('30140903', 'Oranges à Jus', 'ORANGES À JUS', 'PRIMEUR', 890, '/kg'),
  makeProduct('30140904', 'Tomates Rondes en Grappe', 'TOMATES GRAPPE', 'PRIMEUR', 1240, '/kg'),
  makeProduct('30140905', 'Carottes Nouvelles Lavées', 'CAROTTES LAVÉES', 'PRIMEUR', 650, '/kg'),
  makeProduct('30140906', 'Pommes de Terre Bintje (Sac 2,5kg)', 'P. DE TERRE 2,5KG', 'PRIMEUR', 1400),
  makeProduct('30110101', 'Pommes Golden Filet 1kg', 'POMMES GOLDEN 1KG', 'PRIMEUR', 1150),
  makeProduct('30110102', 'Oranges à Jus Filet 2kg', 'ORANGES JUS 2KG', 'PRIMEUR', 1400),

  // ============================================================================
  // RAYON 2 — BOULANGERIE & VIENNOISERIE (4 OFFICIAL V10 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140301', 'Baguette Tradition 250g', 'BAGUETTE TRADITION', 'BOULANGERIE', 450),
  makeProduct('30140302', 'Croissant Pur Beurre', 'CROISSANT BEURRE', 'BOULANGERIE', 520),
  makeProduct('30140303', 'Pain au Chocolat', 'PAIN AU CHOCOLAT', 'BOULANGERIE', 580),
  makeProduct('30140304', 'Brioche Tressée 400g', 'BRIOCHE TRESSÉE', 'BOULANGERIE', 1650),

  // ============================================================================
  // RAYON 3 — POINT CAFÉ & SNACKING CHAUD (5 OFFICIAL V19 EAN BARCODES + EXPRESSO)
  // ============================================================================
  makeProduct('30141201', 'Croque-Monsieur Jambon-Fromage', 'CROQUE-MONSIEUR', 'POINT CAFÉ', 1250),
  makeProduct('30141202', 'Panini Jambon-Emmental Grillé', 'PANINI GRILLÉ', 'POINT CAFÉ', 1500),
  makeProduct('30141203', 'Part de Quiche Lorraine Chaude', 'QUICHE LORRAINE', 'POINT CAFÉ', 1100),
  makeProduct('30141204', 'Café Grain Torréfié 1kg', 'CAFÉ GRAIN 1KG', 'POINT CAFÉ', 3200),
  makeProduct('30141205', 'Lot Gobelets Café x50', 'GOBELETS CAFÉ X50', 'POINT CAFÉ', 1400),
  makeProduct('30141206', 'Café Expresso 1990 (Gobelet)', 'CAFÉ EXPRESSO', 'POINT CAFÉ', 400),
  // Legacy references kept for backward compatibility
  makeProduct('30130101', 'Croque-Monsieur Jambon-Fromage', 'CROQUE-MONSIEUR', 'POINT CAFÉ', 1250),
  makeProduct('30130102', 'Café Expresso 1990 (Gobelet)', 'CAFÉ EXPRESSO', 'POINT CAFÉ', 400),
  makeProduct('30130103', 'Panini Jambon-Emmental Grillé', 'PANINI GRILLÉ', 'POINT CAFÉ', 1500),

  // ============================================================================
  // RAYON 4 — BOUCHERIE & CHARCUTERIE (5 OFFICIAL V11 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140401', 'Faux-Filet de Bœuf (Pièce)', 'FAUX-FILET BŒUF', 'BOUCHERIE', 6800, '/kg'),
  makeProduct('30140402', 'Rôti de Porc Filet (Pièce)', 'RÔTI PORC FILET', 'BOUCHERIE', 4200, '/kg'),
  makeProduct('30140403', 'Jambon Blanc Supérieur', 'JAMBON BLANC SUP.', 'BOUCHERIE', 4600, '/kg'),
  makeProduct('30140404', 'Barquettes Steaks Hachés ×6', 'STEAKS HACHÉS X6', 'BOUCHERIE', 2950),
  makeProduct('30140405', 'Barquettes Merguez & Saucisses ×6', 'MERGUEZ SAUC. X6', 'BOUCHERIE', 2600),

  // ============================================================================
  // RAYON 5 — CRÉMERIE, FROMAGES & YAOURTS (9 OFFICIAL V17 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30141001', 'Lait Frais Entier 1L', 'LAIT ENTIER 1L', 'CRÉMERIE', 590),
  makeProduct('30141002', 'Pack Lait Demi-Écrémé 6x1L', 'PACK LAIT 6X1L', 'CRÉMERIE', 2650),
  makeProduct('30141003', 'Crème Fraîche Normandie 50cl', 'CRÈME FRAÎCHE 50CL', 'CRÉMERIE', 1140),
  makeProduct('30141004', 'Yaourts Nature Brassés x8', 'YAOURTS NATURE X8', 'CRÉMERIE', 1090),
  makeProduct('30141005', 'Yaourts aux Fruits Mixés x8', 'YAOURTS FRUITS X8', 'CRÉMERIE', 1350),
  makeProduct('30141006', 'Crèmes Dessert Chocolat x4', 'CRÈMES CHOCOLAT X4', 'CRÉMERIE', 920),
  makeProduct('30141007', 'Camembert de Normandie 250g', 'CAMEMBERT NORM. 250G', 'CRÉMERIE', 1480),
  makeProduct('30141008', 'Emmental Râpé Sachet 200g', 'EMMENTAL RÂPÉ 200G', 'CRÉMERIE', 1260),
  makeProduct('30141009', 'Beurre Doux de Baratte 250g', 'BEURRE BARATTE 250G', 'CRÉMERIE', 980),
  makeProduct('30160101', 'Brique Lait Entier 1L', 'LAIT ENTIER 1L', 'CRÈMERIE', 600),
  makeProduct('30160102', 'Beurre Demi-Sel 250g', 'BEURRE DEMI-SEL', 'CRÈMERIE', 980),
  makeProduct('30160103', 'Camembert Normand 250g', 'CAMEMBERT 250G', 'CRÈMERIE', 1200),
  makeProduct('30160104', 'Yaourts Nature ×4', 'YAOURTS NATURE X4', 'CRÈMERIE', 1000),
  makeProduct('30160105', "Jus d'Orange Frais 1L", 'JUS ORANGE 1L', 'CRÈMERIE', 1350),
  makeProduct('30160106', 'Soda Cola 1,5L', 'SODA COLA 1,5L', 'CRÈMERIE', 900),
  makeProduct('30160107', 'Boisson Tonique Agrumes', 'BOISSON TONIQUE', 'CRÈMERIE', 850),
  makeProduct('30160108', 'Sandwich Triangle Jambon', 'SANDWICH JAMBON', 'CRÈMERIE', 1450),

  // ============================================================================
  // SURGELÉS & GLACES (RAYON 6 — 7 OFFICIAL V15 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140801', 'Frites Allumettes Surgelées 1kg', 'FRITES ALLUM. 1KG', 'SURGELÉS', 1190),
  makeProduct('30140802', 'Pizza Royale Surgelée', 'PIZZA ROYALE SURG.', 'SURGELÉS', 1850),
  makeProduct('30140803', 'Bâtonnets Colin Panés x10', 'COLIN PANÉS X10', 'SURGELÉS', 1620),
  makeProduct('30140804', 'Haricots Verts Surgelés 1kg', 'HARICOTS VERTS 1KG', 'SURGELÉS', 1080),
  makeProduct('30140805', 'Bac Glace 3 Parfums 1L', 'BAC GLACE 3 PARF.', 'SURGELÉS', 1950),
  makeProduct('30140806', 'Cônes Glacés Vanille-Choco x6', 'CÔNES GLACÉS X6', 'SURGELÉS', 1780),
  makeProduct('30140807', 'Esquimaux Bâtonnets x8', 'ESQUIMAUX X8', 'SURGELÉS', 1540),
  makeProduct('30170101', 'Bac Glace Vanille 1L', 'GLACE VANILLE 1L', 'SURGELÉS', 2250),
  makeProduct('30170102', 'Pizza Feu de Bois 400g', 'PIZZA FEU DE BOIS', 'SURGELÉS', 2490),
  makeProduct('30170103', 'Frites Surgelées 1kg', 'FRITES SURG. 1KG', 'SURGELÉS', 1380),

  // ============================================================================
  // ÉPICERIE SALÉE & SUCRÉE
  // ============================================================================
  makeProduct('30180101', 'Pâtes Coquillettes 500g', 'COQUILLETTES 500G', 'ÉPICERIE', 700),
  makeProduct('30180102', 'Café Moulu Arabica 250g', 'CAFÉ ARABICA 250G', 'ÉPICERIE', 1500),
  makeProduct('30180103', 'Biscuits Pur Beurre', 'BISCUITS BEURRE', 'ÉPICERIE', 1100),
  makeProduct('30180104', 'Chips Ondulées Sel 150g', 'CHIPS SEL 150G', 'ÉPICERIE', 890),

  // ============================================================================
  // RAYON 7A — ÉPICERIE SALÉE & PÂTES (9 OFFICIAL V14 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140701', 'Huile de Tournesol 1L', 'HUILE TOURNESOL 1L', 'ÉPICERIE SALÉE', 1150),
  makeProduct('30140702', "Huile d'Olive Vierge 75cl", 'HUILE OLIVE 75CL', 'ÉPICERIE SALÉE', 2600),
  makeProduct('30140703', 'Cassoulet Toulousain 840g', 'CASSOULET 840G', 'ÉPICERIE SALÉE', 1780),
  makeProduct('30140704', 'Pâtes Coquillettes 500g', 'COQUILLETTES 500G', 'ÉPICERIE SALÉE', 540),
  makeProduct('30140705', 'Spaghetti Supérieurs 500g', 'SPAGHETTI 500G', 'ÉPICERIE SALÉE', 580),
  makeProduct('30140706', 'Riz Long Grain 1kg', 'RIZ LONG GRAIN 1KG', 'ÉPICERIE SALÉE', 1220),
  makeProduct('30140707', 'Sauce Tomate Basilic Bocaux', 'SAUCE TOMATE BAS.', 'ÉPICERIE SALÉE', 960),
  makeProduct('30140708', 'Petits Pois Carottes 400g', 'PETITS POIS 400G', 'ÉPICERIE SALÉE', 690),
  makeProduct('30140709', 'Moutarde de Dijon 250g', 'MOUTARDE DIJON 250G', 'ÉPICERIE SALÉE', 750),

  // ============================================================================
  // RAYON 7B — ÉPICERIE SUCRÉE & SNACKS (8 OFFICIAL V13 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140601', 'Chips Nature Craquantes 200g', 'CHIPS NATURE 200G', 'ÉPICERIE SUCRÉE', 890),
  makeProduct('30140602', 'Chips Barbecue & Paprika 200g', 'CHIPS BBQ 200G', 'ÉPICERIE SUCRÉE', 950),
  makeProduct('30140603', 'Biscuits Sablés Pur Beurre', 'SABLÉS PUR BEURRE', 'ÉPICERIE SUCRÉE', 1380),
  makeProduct('30140604', 'Pâte à Tartiner Noisettes 400g', 'PÂTE TARTINER 400G', 'ÉPICERIE SUCRÉE', 1650),
  makeProduct('30140605', 'Madeleines Moelleuses ×12', 'MADELEINES X12', 'ÉPICERIE SUCRÉE', 1120),
  makeProduct('30140606', 'Gaufrettes Fourrées Chocolat', 'GAUFRETTES CHOC.', 'ÉPICERIE SUCRÉE', 980),
  makeProduct('30140607', 'Tablettes Chocolat Lait/Noisettes', 'CHOCOLAT LAIT/NOIS.', 'ÉPICERIE SUCRÉE', 1050),
  makeProduct('30140608', 'Sachets Bonbons & Confiseries', 'BONBONS CONFISERIE', 'ÉPICERIE SUCRÉE', 1200),

  // ============================================================================
  // RAYON 8 — CAVE À VINS, BIÈRES & SPIRITUEUX (7 OFFICIAL V12 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140501', 'Bordeaux Rouge AOC 1988 75cl', 'BORDEAUX AOC 1988', 'CAVE À VINS', 3800),
  makeProduct('30140502', 'Bourgogne Blanc 75cl', 'BOURGOGNE BLANC', 'CAVE À VINS', 4450),
  makeProduct('30140503', 'Champagne Brut Réserve 75cl', 'CHAMPAGNE BRUT', 'CAVE À VINS', 11500),
  makeProduct('30140504', 'Pack Bières Blondes 6×25cl', 'BIÈRES BLONDES X6', 'CAVE À VINS', 2200),
  makeProduct('30140505', 'Bière Ambrée 75cl Bouchon Mécanique', 'BIÈRE AMBRÉE 75CL', 'CAVE À VINS', 1850),
  makeProduct('30140506', 'Cidre Brut de Normandie 75cl', 'CIDRE BRUT 75CL', 'CAVE À VINS', 1400),
  makeProduct('30140507', 'Pastis de Marseille 1L', 'PASTIS MARSEILLE 1L', 'CAVE À VINS', 7600),

  // ============================================================================
  // RAYON 9 — HYGIÈNE, BEAUTÉ & ENTRETIEN (5 OFFICIAL V9 EAN BARCODES & FRANC PRICES)
  // ============================================================================
  makeProduct('30140201', 'Lessive Liquide Bidon 3L', 'LESSIVE BIDON 3L', 'HYGIÈNE', 5400),
  makeProduct('30140202', 'Papier Toilette Pack x6', 'PAPIER TOIL. X6', 'HYGIÈNE', 1950),
  makeProduct('30140203', 'Shampoing Doux Flacon 400ml', 'SHAMPOING 400ML', 'HYGIÈNE', 1690),
  makeProduct('30140204', 'Gel Douche Fraîcheur', 'GEL DOUCHE FRAÎCH.', 'HYGIÈNE', 1450),
  makeProduct('30140205', 'Dentifrice Menthe Carton PAV', 'DENTIFRICE PAV', 'HYGIÈNE', 1180),

  // ============================================================================
  // RAYON 11 — SNACKING FRAIS, SANDWICHES TRIANGLES & CANETTES (9 OFFICIAL EAN BARCODES & 1990 FRANC PRICES)
  // ============================================================================
  makeProduct('30141101', 'Canette Cola Classique 33cl', 'COLA CLASSIQUE 33CL', 'SNACKING FRAIS', 450),
  makeProduct('30141102', 'Canette Limonade Citron 33cl', 'LIMONADE CITRON 33CL', 'SNACKING FRAIS', 420),
  makeProduct('30141103', 'Canette Soda Orange 33cl', 'SODA ORANGE 33CL', 'SNACKING FRAIS', 450),
  makeProduct('30141104', 'Sandwich Triangle Jambon-Emmental', 'SANDW. JAMBON-EMM.', 'SNACKING FRAIS', 1350),
  makeProduct('30141105', 'Sandwich Triangle Poulet-Crudités', 'SANDW. POULET-CRUD.', 'SNACKING FRAIS', 1490),
  makeProduct('30141106', 'Sandwich Triangle Thon-Œuf', 'SANDW. THON-ŒUF', 'SNACKING FRAIS', 1450),
  makeProduct('30141107', 'Petit Gâteau Fourré Chocolat', 'GÂTEAU FOURRÉ CHOC.', 'SNACKING FRAIS', 550),
  makeProduct('30141108', 'Madeleine Individuelle Emballée', 'MADELEINE INDIVID.', 'SNACKING FRAIS', 480),
  makeProduct('30141109', 'Cookie Pépites Chocolat Individuel', 'COOKIE PÉPITES CHOC.', 'SNACKING FRAIS', 590),

  // ============================================================================
  // RAYON 12 — MANGA, BD & JEUX VIDÉO (8 OFFICIAL EAN BARCODES & 1990 FRANC PRICES)
  // ============================================================================
  makeProduct('30141301', 'Console Portable 8-Bit Pack Pong', 'CONSOLE 8-BIT PONG', 'JEUX VIDÉO', 49000),
  makeProduct('30141302', 'Manette Arcade Pro 1990', 'MANETTE ARCADE PRO', 'JEUX VIDÉO', 14900),
  makeProduct('30141303', 'Jeu : Super Pong Championship', 'SUPER PONG CHAMP.', 'JEUX VIDÉO', 24900),
  makeProduct('30141304', 'Jeu : Galaxy Cyber-Quest', 'GALAXY CYBER-QUEST', 'JEUX VIDÉO', 29900),
  makeProduct('30141305', 'Jeu : Voxelitos Adventure', 'VOXELITOS ADVENT.', 'JEUX VIDÉO', 27900),
  makeProduct('30141306', 'Manga : Mianimal Tome 1', 'MANGA MIANIMAL T1', 'MANGA & BD', 3600),
  makeProduct('30141307', 'Manga : Les Yimai Tome 1', 'MANGA LES YIMAI T1', 'MANGA & BD', 3800),
  makeProduct('30141308', 'BD : Clara Godwaie & Louis', 'BD CLARA & LOUIS', 'MANGA & BD', 4900),

  // Legacy Culture Pop references (preserved for compatibility)
  makeProduct('30210101', 'Manga Mianimal Tome 1', 'MANGA MIANIMAL T1', 'CULTURE POP', 3500),
  makeProduct('30210102', 'Manga Voxelitos Tome 1', 'MANGA VOXELITOS T1', 'CULTURE POP', 3500),
  makeProduct('30210103', 'Console Rétro 16-Bit', 'CONSOLE 16-BIT', 'CULTURE POP', 129000),
  makeProduct('30210104', 'Cartouche Voxelitos DX', 'VOXELITOS DX', 'CULTURE POP', 34900),
];

const CATALOG_BY_EAN = new Map<string, CatalogProduct>();
for (const p of PRODUCT_CATALOG) {
  CATALOG_BY_EAN.set(p.ean, p);
}

export function getProductByEan(ean: string | null | undefined): CatalogProduct | undefined {
  if (!ean) return undefined;
  return CATALOG_BY_EAN.get(ean.trim());
}

export function parseFrancPriceToCents(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^\d,.]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const val = Number.parseFloat(cleaned);
  if (!Number.isFinite(val)) return null;
  return Math.round(val * 100);
}

export function formatFrancCents(cents: number): string {
  const safe = Math.max(0, Math.round(cents));
  const whole = Math.floor(safe / 100);
  const dec = (safe % 100).toString().padStart(2, '0');
  return `${whole},${dec} ₣`;
}

// Authentic EAN-8 left-hand digit module patterns (7 modules each)
const EAN_PATTERNS = [
  '0001101', // 0
  '0011001', // 1
  '0010011', // 2
  '0111101', // 3
  '0100011', // 4
  '0110001', // 5
  '0101111', // 6
  '0111011', // 7
  '0110111', // 8
  '0001011', // 9
];

/**
 * Renders a crisp, deterministic 1990 EAN-8 barcode with guard bars and 8 printed digits
 * onto any 2D canvas context (used on 3D product packages, cartons, price tags & scanner LCD).
 */
export function drawEanBarcode(
  c: CanvasRenderingContext2D,
  ean: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: {
    showDigits?: boolean;
    bgColor?: string;
    barColor?: string;
    digitColor?: string;
  }
): void {
  const digits = ean.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  const showDigits = opts?.showDigits !== false;
  const bgColor = opts?.bgColor ?? '#ffffff';
  const barColor = opts?.barColor ?? '#0f172a';
  const digitColor = opts?.digitColor ?? barColor;

  if (bgColor !== 'transparent') {
    c.fillStyle = bgColor;
    c.fillRect(x, y, w, h);
  }

  // Build 67-module EAN-8 bitstring: 101 + 4 digits (28) + 01010 + 4 digits (28) + 101
  let bits = '101';
  for (let i = 0; i < 4; i++) {
    bits += EAN_PATTERNS[Number(digits[i]) % 10];
  }
  bits += '01010';
  for (let i = 4; i < 8; i++) {
    // Complement pattern on right half (authentic EAN-8 encoding)
    const pat = EAN_PATTERNS[Number(digits[i]) % 10];
    for (let j = 0; j < pat.length; j++) {
      bits += pat[j] === '1' ? '0' : '1';
    }
  }
  bits += '101';

  const padX = Math.max(4, w * 0.06);
  const padTop = Math.max(2, h * 0.08);
  const digitBandH = showDigits ? Math.max(12, h * 0.28) : 0;
  const barAreaW = w - padX * 2;
  const barH = Math.max(6, h - padTop * 2 - digitBandH);
  const modW = barAreaW / bits.length;

  c.fillStyle = barColor;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') {
      const isGuard = i < 3 || i >= bits.length - 3 || (i >= 31 && i <= 35);
      const bh = isGuard && showDigits ? barH + digitBandH * 0.28 : barH;
      c.fillRect(x + padX + i * modW, y + padTop, Math.max(1, Math.ceil(modW)), bh);
    }
  }

  if (showDigits) {
    const fontSize = Math.max(10, Math.round(digitBandH * 0.88));
    c.fillStyle = digitColor;
    c.font = `700 ${fontSize}px "JetBrains Mono", monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    const formatted = `${digits.slice(0, 4)} ${digits.slice(4, 8)}`;
    c.fillText(formatted, x + w / 2, y + h - Math.max(1, h * 0.04));
  }
}
