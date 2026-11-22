import * as THREE from 'three';

export type ActionVerb = string;

export type InteractionKind = 'door_toggle' | 'power_toggle' | 'inspect' | 'diegetic_action';

export type PlayerTool = 'hands' | 'scanner' | 'labeler' | 'orderer' | 'cutter';

export type LabelerCategory =
  | 'CROQUETTES CHIEN'
  | 'CROQUETTES CHAT'
  | 'PÂTÉE'
  | 'JOUETS'
  | string;

export interface ScannerHudState {
  raised: boolean;
  lastScannedEan: string | null;
  lastScannedName: string | null;
  lastScannedPrice: string | null;
  transferredToLabeler: boolean;
}

export interface OrdererHudState {
  raised: boolean;
  selectedLabel: string;
  selectedQty: number;
  totalCartons: number;
  lastStatus: string;
}

export interface LabelerHudState {
  raised: boolean;
  category: string;
  ean: string;
  productName: string;
  inputMode: 'price' | 'code';
  codeInput: string;
  priceInput: string;
  formattedPrice: string;
  hasPrintedLabel: boolean;
  printedCategory: string;
  printedEan: string;
  printedProductName: string;
  printedPrice: string;
  syncedFromScanner: boolean;
}

export interface HeldItemHudInfo {
  kind:
    | 'kibble_large_dog'
    | 'kibble_large_cat'
    | 'kibble_med_dog'
    | 'kibble_med_cat'
    | 'kibble_small_dog'
    | 'kibble_small_cat'
    | 'wet_tray_dog'
    | 'wet_tray_cat'
    | 'wet_can_dog'
    | 'wet_can_cat'
    | 'hyg_lessive_3l'
    | 'hyg_tp_pack'
    | 'hyg_shampoing'
    | 'hyg_gel_douche'
    | 'hyg_dentifrice_pav'
    | 'hyg_dentifrice_box'
    | 'baguette_raw'
    | 'croissant_raw'
    | 'pain_choc_raw'
    | 'baguette_baked'
    | 'baguette_sliced'
    | 'croissant_baked'
    | 'pain_choc_baked'
    | 'brioche_bagged'
    | 'beef_primal'
    | 'pork_primal'
    | 'ham_block'
    | 'beef_platter'
    | 'pork_platter'
    | 'ham_sliced_pack'
    | 'butcher_wrapped_beef'
    | 'butcher_wrapped_pork'
    | 'butcher_wrapped_ham'
    | 'butcher_tray_steaks'
    | 'butcher_tray_merguez'
    | 'wine_bordeaux'
    | 'wine_bourgogne'
    | 'wine_champagne'
    | 'beer_sixpack'
    | 'beer_ambree'
    | 'cidre_normandie'
    | 'pastis_marseille'
    | 'snack_chips_nature'
    | 'snack_chips_bbq'
    | 'snack_biscuits_sables'
    | 'snack_pate_tartiner'
    | 'snack_madeleines'
    | 'snack_gaufrettes'
    | 'snack_choco_pav'
    | 'snack_choco_bar'
    | 'snack_bonbons_pav'
    | 'snack_bonbons_bag'
    | 'savory_huile_tournesol'
    | 'savory_huile_olive'
    | 'savory_cassoulet'
    | 'savory_coquillettes'
    | 'savory_spaghetti'
    | 'savory_riz'
    | 'savory_sauce_tomate_pav'
    | 'savory_sauce_tomate_jar'
    | 'savory_petits_pois_pav'
    | 'savory_petits_pois_can'
    | 'savory_moutarde_pav'
    | 'savory_moutarde_jar'
    | 'frozen_frites'
    | 'frozen_pizza'
    | 'frozen_colin'
    | 'frozen_haricots'
    | 'frozen_glace_bac'
    | 'frozen_cones'
    | 'frozen_esquimaux'
    | 'produce_pommes'
    | 'produce_bananes'
    | 'produce_oranges'
    | 'produce_tomates'
    | 'produce_carottes'
    | 'produce_pommes_de_terre'
    | 'produce_weighed_bag'
    | 'dairy_lait_entier'
    | 'dairy_lait_pack6'
    | 'dairy_creme_pav'
    | 'dairy_creme_tub'
    | 'dairy_yaourt_nature_pav'
    | 'dairy_yaourt_nature_pack'
    | 'dairy_yaourt_fruits_pav'
    | 'dairy_yaourt_fruits_pack'
    | 'dairy_creme_choco_pav'
    | 'dairy_creme_choco_pack'
    | 'dairy_camembert'
    | 'dairy_emmental_pav'
    | 'dairy_emmental_bag'
    | 'dairy_beurre'
    | 'game_console_8bit'
    | 'game_manette_pro'
    | 'game_super_pong'
    | 'game_galaxy_quest'
    | 'game_voxelitos'
    | 'manga_mianimal'
    | 'manga_yimai'
    | 'bd_clara_louis'
    | 'snacking_can_cola'
    | 'snacking_can_limonade'
    | 'snacking_can_orange'
    | 'snacking_sand_jambon'
    | 'snacking_sand_poulet'
    | 'snacking_sand_thon'
    | 'snacking_cake_choco_pav'
    | 'snacking_cake_choco_unit'
    | 'snacking_madeleine_pav'
    | 'snacking_madeleine_unit'
    | 'snacking_cookie_pav'
    | 'snacking_cookie_unit'
    | 'cafe_croque_monsieur'
    | 'cafe_panini'
    | 'cafe_quiche_lorraine'
    | 'cafe_beans_bag'
    | 'cafe_cup_sleeve'
    | 'cafe_paper_cup_empty'
    | 'cafe_espresso_cup'
    | 'price_label'
    | 'plastic_price_rail'
    | 'shipping_carton'
    | 'empty_carton'
    | 'toy_tennis'
    | 'toy_squeaky'
    | 'toy_cat_bell'
    | 'office_label_roll'
    | 'office_invoice_binder';
  label: string;
  sublabel?: string;
  priceText?: string;
  category?: string;
  ean?: string;
  productName?: string;
  cartonData?: {
    defId: string;
    opened: boolean;
    remaining: number;
    pickIdx: number;
  };
}

export type ZoneId =
  | 'parking'
  | 'atm'
  | 'monnayeur'
  | 'sales_floor'
  | 'manga_corner'
  | 'checkouts'
  | 'office'
  | 'warehouse'
  | 'loading_dock';

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY?: number;
  maxY?: number;
  enabled: boolean;
}

export interface InteractableItem {
  id: string;
  title: string;
  subtitle: string;
  kind: InteractionKind;
  state: boolean;
  inspectText: string;
  specs?: string;
  proxyMesh: THREE.Object3D;
  productEan?: string;
  dynamicProductEan?: () => string | null;
  onToggle?: (nextState: boolean) => void;
  onInteract?: () => void;
  onHoverUv?: (uv: THREE.Vector2) => void;
  onInteractUv?: (uv: THREE.Vector2) => void;
  dynamicVerb?: () => string;
  dynamicTitle?: () => string;
  dynamicSubtitle?: () => string;
  dynamicInspectText?: () => string;
  dynamicSpecs?: () => string;
  isVisible?: () => boolean;
}

export interface DampedUpdater {
  update: (dt: number, elapsed: number) => void;
}

export interface TargetPrompt {
  id: string;
  verb: ActionVerb;
  title: string;
  subtitle: string;
  kind: InteractionKind;
}

export interface InspectionCardData {
  title: string;
  subtitle: string;
  description: string;
  specs?: string;
}

export interface BillBreakdown {
  50: number;
  100: number;
  200: number;
  500: number;
}

export interface CoinBreakdown {
  10: number;
  5: number;
  2: number;
  1: number;
}

export interface BankTransaction {
  date: string;
  label: string;
  amount: number;
}

export interface DepartmentStock {
  id: string;
  name: string;
  level: number; // 0..100 %
  orderedCount: number;
}

export interface WalletStatus {
  cashFrancs: number;
  billsTotal: number;
  coinsTotal: number;
  bills: BillBreakdown;
  coins: CoinBreakdown;
  cardInHand: boolean;
  bankBalance: number;
  storeRevenueFrancs: number;
  caisse1Revenue: number;
  caisse2Revenue: number;
  holdingScanner: boolean;
}

export interface HudSnapshot {
  zoneName: string;
  zoneSubtitle: string;
  target: TargetPrompt | null;
  inspection: InspectionCardData | null;
  pointerLocked: boolean;
  isTouchDevice: boolean;
  seatedAtDesk: boolean;
  activeTool: PlayerTool;
  heldItem: HeldItemHudInfo | null;
  labeler: LabelerHudState;
  scanner: ScannerHudState;
  orderer: OrdererHudState;
  wallet: WalletStatus;
}

export interface WorldBuildContext {
  scene: THREE.Scene;
  maxAnisotropy: number;
  isSoftwareGl: boolean;
  colliders: ColliderBox[];
  interactables: InteractableItem[];
  updaters: DampedUpdater[];
  disposables: Array<{ dispose: () => void }>;
}
