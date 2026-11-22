import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  ClipboardList,
  Compass,
  Eye,
  Hand,
  Power,
  Printer,
  ScanBarcode,
  Scissors,
  Tag,
  X,
} from 'lucide-react';
import { SupermarketEngine } from './sim/SupermarketEngine';
import { HudSnapshot, PlayerTool } from './sim/types';

const TOOL_ITEMS: Array<{
  id: PlayerTool;
  label: string;
  short: string;
  angleDeg: number;
}> = [
  { id: 'hands', label: 'Mains Vides', short: 'Mains', angleDeg: 180 },
  { id: 'scanner', label: 'Terminal Scan 1990', short: 'Scanner', angleDeg: 157.5 },
  { id: 'labeler', label: 'Étiqueteuse 1990', short: 'Étiquet.', angleDeg: 135 },
  { id: 'orderer', label: 'Terminal Commande 1990', short: 'Commande', angleDeg: 112.5 },
  { id: 'cutter', label: 'Cutter', short: 'Cutter', angleDeg: 90 },
];

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SupermarketEngine | null>(null);
  const joyKnobElRef = useRef<HTMLDivElement | null>(null);

  const [hud, setHud] = useState<HudSnapshot>({
    zoneName: 'Zone 1 — Parking & Façade',
    zoneSubtitle: 'Abri Caddies · Plots Anti-Bélier · DAB CB 1990 & Monnayeur',
    target: null,
    inspection: null,
    pointerLocked: false,
    isTouchDevice: false,
    seatedAtDesk: false,
    activeTool: 'hands',
    heldItem: null,
    labeler: {
      raised: false,
      category: 'Croquettes Chien 10kg',
      ean: '30140101',
      productName: 'Croquettes Chien Grand Sac 10kg',
      inputMode: 'price',
      codeInput: '',
      priceInput: '89,00',
      formattedPrice: '89,00 ₣',
      hasPrintedLabel: false,
      printedCategory: 'Croquettes Chien 10kg',
      printedEan: '30140101',
      printedProductName: 'Croquettes Chien Grand Sac 10kg',
      printedPrice: '89,00 ₣',
      syncedFromScanner: false,
    },
    scanner: {
      raised: false,
      lastScannedEan: null,
      lastScannedName: null,
      lastScannedPrice: null,
      transferredToLabeler: false,
    },
    orderer: {
      raised: false,
      selectedLabel: 'Carton Long Réglettes (×10)',
      selectedQty: 0,
      totalCartons: 0,
      lastStatus: 'PRÊT — SÉLECTIONNEZ UN CARTON',
    },
    wallet: {
      cashFrancs: 200,
      billsTotal: 200,
      coinsTotal: 0,
      bills: { 50: 2, 100: 1, 200: 0, 500: 0 },
      coins: { 10: 0, 5: 0, 2: 0, 1: 0 },
      cardInHand: true,
      bankBalance: 1500,
      storeRevenueFrancs: 0,
      caisse1Revenue: 0,
      caisse2Revenue: 0,
      holdingScanner: false,
    },
  });

  const [toolWheelOpen, setToolWheelOpen] = useState(false);
  const [joyActive, setJoyActive] = useState(false);

  // Multi-touch identifier tracking + strict 320ms single-trigger lock for Mobile Safari (iPhone 16e)
  const joyTouchIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchIdRef = useRef<number | null>(null);
  const labelerTouchIdRef = useRef<number | null>(null);
  const lookPrevRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookMovedRef = useRef<boolean>(false);
  const triggeredOnThisTouchRef = useRef<boolean>(false);
  const lastActionTouchTimeRef = useRef<number>(0);
  const lastUiTapTimeRef = useRef<number>(0);

  const acquireUiDebounce = (): boolean => {
    const now = performance.now();
    if (now - lastUiTapTimeRef.current < 320) return false;
    lastUiTapTimeRef.current = now;
    return true;
  };

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new SupermarketEngine(mountEl, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const updateJoystickTransform = (dx: number, dy: number) => {
    if (joyKnobElRef.current) {
      joyKnobElRef.current.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    }
  };

  // Left virtual joystick handlers (Mobile Safari / iPhone 16e — zero per-frame React state churn)
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchIdRef.current !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    joyTouchIdRef.current = t.identifier;
    joyOriginRef.current = { x: cx, y: cy };

    const maxR = 42;
    const dx = Math.max(-maxR, Math.min(maxR, t.clientX - cx));
    const dy = Math.max(-maxR, Math.min(maxR, t.clientY - cy));
    setJoyActive(true);
    updateJoystickTransform(dx, dy);
    engineRef.current?.setJoystickVector(dx / maxR, -dy / maxR);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joyTouchIdRef.current) {
        const maxR = 42;
        const rawX = t.clientX - joyOriginRef.current.x;
        const rawY = t.clientY - joyOriginRef.current.y;
        const dist = Math.hypot(rawX, rawY);
        const scale = dist > maxR ? maxR / dist : 1;
        const dx = rawX * scale;
        const dy = rawY * scale;
        updateJoystickTransform(dx, dy);
        engineRef.current?.setJoystickVector(dx / maxR, -dy / maxR);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (joyTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joyTouchIdRef.current) {
        joyTouchIdRef.current = null;
        setJoyActive(false);
        updateJoystickTransform(0, 0);
        engineRef.current?.setJoystickVector(0, 0);
        break;
      }
    }
  };

  // Right-thumb camera swipe + Direct 3D Price Labeler finger-tap raycasting (strict 320ms debounce)
  const handleLookStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.changedTouches[0];
    if (!t) return;

    // Direct touch raycasting on the 15 3D rubber buttons & protruding 3D paper label
    if (engineRef.current?.hitTestLabelerAtScreen(t.clientX, t.clientY)) {
      if (e.cancelable) e.preventDefault();
      labelerTouchIdRef.current = t.identifier;
      const now = performance.now();
      if (!triggeredOnThisTouchRef.current && now - lastActionTouchTimeRef.current >= 320) {
        triggeredOnThisTouchRef.current = true;
        lastActionTouchTimeRef.current = now;
        engineRef.current.triggerLabelerAtScreen(t.clientX, t.clientY);
      }
      return;
    }

    if (lookTouchIdRef.current !== null) return;
    lookTouchIdRef.current = t.identifier;
    lookPrevRef.current = { x: t.clientX, y: t.clientY };
    lookMovedRef.current = false;
    triggeredOnThisTouchRef.current = false;
  };

  const handleLookMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchIdRef.current) {
        const dx = t.clientX - lookPrevRef.current.x;
        const dy = t.clientY - lookPrevRef.current.y;
        if (Math.hypot(dx, dy) > 6) {
          lookMovedRef.current = true;
        }
        lookPrevRef.current = { x: t.clientX, y: t.clientY };
        engineRef.current?.applyTouchLookDelta(dx, dy);
        break;
      }
    }
  };

  const handleLookEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const id = e.changedTouches[i].identifier;
      if (labelerTouchIdRef.current !== null && id === labelerTouchIdRef.current) {
        labelerTouchIdRef.current = null;
        triggeredOnThisTouchRef.current = false;
      }
      if (lookTouchIdRef.current !== null && id === lookTouchIdRef.current) {
        lookTouchIdRef.current = null;
        if (!lookMovedRef.current && !triggeredOnThisTouchRef.current) {
          const now = performance.now();
          if (now - lastActionTouchTimeRef.current >= 320) {
            if (e.cancelable) e.preventDefault();
            triggeredOnThisTouchRef.current = true;
            lastActionTouchTimeRef.current = now;
            engineRef.current?.triggerActiveTarget();
          }
        }
      }
    }
  };

  const handleActionButtonTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (triggeredOnThisTouchRef.current) return;
    const now = performance.now();
    if (now - lastActionTouchTimeRef.current < 320) return;
    triggeredOnThisTouchRef.current = true;
    lastActionTouchTimeRef.current = now;
    engineRef.current?.triggerActiveTarget();
  };

  const handleActionButtonTouchEnd = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    triggeredOnThisTouchRef.current = false;
  };

  const handleActionButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (performance.now() - lastActionTouchTimeRef.current < 500) return;
    lastActionTouchTimeRef.current = performance.now();
    engineRef.current?.triggerActiveTarget();
  };

  // Strict single-press debounced button binder for Tool Wheel & Labeler Keypad
  const bindDebouncedAction = (action: () => void) => ({
    onTouchStart: (e: React.TouchEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!acquireUiDebounce()) return;
      action();
    },
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!acquireUiDebounce()) return;
      action();
    },
  });

  const renderToolIcon = (tool: PlayerTool, cls = 'w-5 h-5') => {
    if (tool === 'scanner') return <ScanBarcode className={cls} />;
    if (tool === 'labeler') return <Tag className={cls} />;
    if (tool === 'orderer') return <ClipboardList className={cls} />;
    if (tool === 'cutter') return <Scissors className={cls} />;
    return <Hand className={cls} />;
  };

  const ActionIcon =
    hud.target?.kind === 'door_toggle' || hud.target?.kind === 'diegetic_action'
      ? Hand
      : hud.target?.kind === 'power_toggle'
        ? Power
        : Eye;

  const formattedCash = hud.wallet.cashFrancs
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const coinParts: string[] = [];
  if (hud.wallet.coins[10] > 0) coinParts.push(`${hud.wallet.coins[10]}×10₣`);
  if (hud.wallet.coins[5] > 0) coinParts.push(`${hud.wallet.coins[5]}×5₣`);
  if (hud.wallet.coins[2] > 0) coinParts.push(`${hud.wallet.coins[2]}×2₣`);
  if (hud.wallet.coins[1] > 0) coinParts.push(`${hud.wallet.coins[1]}×1₣`);

  const activeToolMeta = TOOL_ITEMS.find((t) => t.id === hud.activeTool) ?? TOOL_ITEMS[0];

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* Dedicated WebGL Mount Container (Zero backdrop-filter over canvas for locked 60 FPS) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Mobile Touch Look Layer */}
      {hud.isTouchDevice && (
        <div
          className="absolute inset-0 z-10"
          onTouchStart={handleLookStart}
          onTouchMove={handleLookMove}
          onTouchEnd={handleLookEnd}
          onTouchCancel={handleLookEnd}
        />
      )}

      {/* Top-Left Minimal Architectural Location Header */}
      <header className="pointer-events-none absolute top-3 left-3 z-20 max-w-[min(460px,84vw)] rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 shadow-lg">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-emerald-400">
          <Compass className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">CONTACT EXPRESS 3D · NOVEMBRE 1990</span>
        </div>
        <h1 className="mt-0.5 text-sm font-semibold text-slate-100 truncate">
          {hud.zoneName}
        </h1>
        <p className="text-xs text-slate-400 truncate">{hud.zoneSubtitle}</p>
        <div className="mt-1.5 pt-1.5 border-t border-slate-800/90 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300 font-mono">
          <span className="text-amber-300 font-semibold">
            Portefeuille : {formattedCash} ₣
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>Billets {hud.wallet.billsTotal} ₣</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>
            Pièces {hud.wallet.coinsTotal} ₣
            {coinParts.length > 0 ? ` (${coinParts.join(' · ')})` : ''}
          </span>
          {hud.wallet.storeRevenueFrancs > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-emerald-400 font-semibold">
                Recette : {hud.wallet.storeRevenueFrancs} ₣
              </span>
            </>
          )}
          {hud.heldItem && hud.activeTool === 'hands' && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-sky-300 font-semibold">
                En main : {hud.heldItem.label}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Minimal Stand-Up Button when seated at the Manager's 1990 PC Desk */}
      {hud.seatedAtDesk && (
        <button
          type="button"
          {...bindDebouncedAction(() => engineRef.current?.setSeatedAtDesk(false))}
          className="pointer-events-auto absolute top-3 right-3 z-30 px-3.5 py-2 rounded-xl bg-slate-950/92 hover:bg-slate-900 border border-amber-200/40 text-xs font-semibold text-amber-200 shadow-lg cursor-pointer"
        >
          [SE LEVER]
        </button>
      )}

      {/* Center Reticle + Contextual Reticle Label (hidden during direct-tap 3D handheld inspection unless PointerLocked) */}
      {((!hud.labeler.raised && !hud.scanner.raised && !hud.orderer.raised) || hud.pointerLocked) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center">
          <div
            className={`transition-transform duration-150 rounded-full border ${
              hud.target
                ? 'w-3.5 h-3.5 bg-emerald-400/90 border-slate-950 scale-110'
                : 'w-2 h-2 bg-white/90 border-slate-900/80'
            }`}
          />

          {hud.target && !hud.isTouchDevice && (
            <div className="mt-4 rounded-lg bg-slate-950/92 border border-slate-700/90 px-3.5 py-2 text-center shadow-xl max-w-xs">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400">
                <span className="font-mono text-[11px] text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded">
                  E / Clic
                </span>
                <span>[{hud.target.verb}]</span>
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-100">
                {hud.target.title}
              </div>
              <div className="text-[11px] text-slate-400">{hud.target.subtitle}</div>
            </div>
          )}
        </div>
      )}

      {/* Inspection Modal Card (Clean architectural prop details when [EXAMINER] is triggered) */}
      {hud.inspection && (
        <div className="pointer-events-auto absolute top-24 left-1/2 -translate-x-1/2 z-30 w-[min(430px,92vw)] rounded-xl bg-slate-950/95 border border-slate-700 p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-emerald-400 font-medium">
                {hud.inspection.subtitle}
              </div>
              <h2 className="mt-0.5 text-base font-semibold text-slate-100">
                {hud.inspection.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => engineRef.current?.closeInspection()}
              aria-label="Fermer la fiche"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            {hud.inspection.description}
          </p>
          {hud.inspection.specs && (
            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              {hud.inspection.specs}
            </div>
          )}
        </div>
      )}

      {/* 100% Diegetic 3D Price Labeler: zero 2D HTML keypad overlays! */}

      {/* Left Virtual Joystick (Mobile Touch Only — Lowered cleanly now that bottom bar is removed!) */}
      {hud.isTouchDevice && (
        <div
          onTouchStart={handleJoystickStart}
          onTouchMove={handleJoystickMove}
          onTouchEnd={handleJoystickEnd}
          onTouchCancel={handleJoystickEnd}
          className="pointer-events-auto absolute bottom-6 left-5 z-30 w-28 h-28 rounded-full bg-slate-950/75 border-2 border-slate-700/90 flex items-center justify-center shadow-lg"
        >
          <div
            ref={joyKnobElRef}
            className={`w-12 h-12 rounded-full transition-colors ${
              joyActive
                ? 'bg-emerald-500 border-2 border-emerald-200'
                : 'bg-slate-700/90 border border-slate-500'
            }`}
          />
        </div>
      )}

      {/* Contextual Mobile Interact Button (Positioned cleanly above bottom-right tool wheel) */}
      {hud.isTouchDevice && hud.target && !hud.labeler.raised && !hud.scanner.raised && !hud.orderer.raised && (
        <button
          type="button"
          onTouchStart={handleActionButtonTouchStart}
          onTouchEnd={handleActionButtonTouchEnd}
          onTouchCancel={handleActionButtonTouchEnd}
          onClick={handleActionButtonClick}
          className="pointer-events-auto absolute bottom-24 right-5 z-30 min-h-12 px-4 py-2.5 rounded-xl bg-slate-900 active:bg-slate-800 text-slate-50 font-semibold text-xs shadow-xl border border-amber-200/40 flex items-center gap-2"
        >
          <ActionIcon className="w-4 h-4 shrink-0 text-amber-200" />
          <div className="text-left">
            <div className="font-mono text-[11px] leading-tight text-amber-200">
              [{hud.target.verb}]
            </div>
            <div className="text-[11px] font-medium opacity-95 max-w-[165px] truncate">
              {hud.target.title}
            </div>
          </div>
        </button>
      )}

      {/* Compact Diegetic Inspect Toggle ([UTILISER ÉTIQUETEUSE] / [RANGER]) beside bottom-right Tool Wheel */}
      {hud.activeTool === 'labeler' && !toolWheelOpen && (
        <div className="pointer-events-auto absolute bottom-6 right-24 z-30 flex items-center gap-2">
          {hud.labeler.hasPrintedLabel && (
            <button
              type="button"
              {...bindDebouncedAction(() => engineRef.current?.takePrintedLabel())}
              className="px-3 py-2.5 rounded-xl bg-emerald-700 active:bg-emerald-800 text-white font-mono text-[11px] font-bold border border-emerald-400/50 shadow-lg cursor-pointer whitespace-nowrap"
            >
              [PRENDRE L&apos;ÉTIQUETTE]
            </button>
          )}
          <button
            type="button"
            {...bindDebouncedAction(() =>
              engineRef.current?.toggleLabelerRaised(!hud.labeler.raised)
            )}
            className="px-3 py-2.5 rounded-xl bg-slate-900/95 active:bg-slate-800 text-amber-200 font-mono text-[11px] font-bold border border-slate-600 shadow-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{hud.labeler.raised ? '[RANGER]' : '[UTILISER ÉTIQUETEUSE]'}</span>
          </button>
        </div>
      )}

      {/* Compact Diegetic Inspect / Transfer Toggles for Terminal Scan 1990 (Zero 2D Modals) */}
      {hud.activeTool === 'scanner' && !toolWheelOpen && (
        <div className="pointer-events-auto absolute bottom-6 right-24 z-30 flex items-center gap-2">
          {hud.scanner.lastScannedEan && (
            <button
              type="button"
              {...bindDebouncedAction(() => engineRef.current?.transferScannerToLabeler())}
              className={`px-3 py-2.5 rounded-xl font-mono text-[11px] font-bold border shadow-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                hud.scanner.transferredToLabeler
                  ? 'bg-emerald-800/95 text-emerald-100 border-emerald-400/50'
                  : 'bg-sky-800 active:bg-sky-900 text-white border-sky-400/50'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>
                {hud.scanner.transferredToLabeler ? '[SYNC ÉTIQ. OK]' : '[TRANSFERT ÉTIQ.]'}
              </span>
            </button>
          )}
          <button
            type="button"
            {...bindDebouncedAction(() =>
              engineRef.current?.toggleScannerRaised(!hud.scanner.raised)
            )}
            className="px-3 py-2.5 rounded-xl bg-slate-900/95 active:bg-slate-800 text-amber-200 font-mono text-[11px] font-bold border border-slate-600 shadow-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ScanBarcode className="w-3.5 h-3.5" />
            <span>{hud.scanner.raised ? '[RANGER]' : '[INSPECTER SCANNER]'}</span>
          </button>
        </div>
      )}

      {/* Compact Diegetic Inspect Toggle for Terminal Commande 1990 (Zero 2D Modals) */}
      {hud.activeTool === 'orderer' && !toolWheelOpen && (
        <div className="pointer-events-auto absolute bottom-6 right-24 z-30 flex items-center gap-2">
          <button
            type="button"
            {...bindDebouncedAction(() =>
              engineRef.current?.toggleOrdererRaised(!hud.orderer.raised)
            )}
            className="px-3 py-2.5 rounded-xl bg-slate-900/95 active:bg-slate-800 text-amber-200 font-mono text-[11px] font-bold border border-slate-600 shadow-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>{hud.orderer.raised ? '[RANGER]' : '[UTILISER TERMINAL]'}</span>
          </button>
        </div>
      )}

      {/* Bottom-Right Circular Tool Wheel Button + Radial 5-Tool Arc Selector */}
      <div className="pointer-events-auto absolute bottom-5 right-5 z-40">
        {toolWheelOpen && (
          <div className="relative">
            {TOOL_ITEMS.map((item) => {
              const rad = (item.angleDeg * Math.PI) / 180;
              const radius = 122;
              const tx = Math.cos(rad) * radius;
              const ty = -Math.sin(rad) * radius;
              const isSelected = hud.activeTool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  style={{ transform: `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)` }}
                  {...bindDebouncedAction(() => {
                    engineRef.current?.selectTool(item.id);
                    setToolWheelOpen(false);
                  })}
                  className={`absolute right-0 bottom-0 w-12 h-12 rounded-full shadow-2xl border-2 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 border-emerald-200 text-white'
                      : 'bg-slate-900/95 border-slate-600 text-slate-200 hover:bg-slate-800'
                  }`}
                  title={item.label}
                >
                  {renderToolIcon(item.id, 'w-4 h-4')}
                  <span className="mt-0.5 text-[8.5px] font-semibold leading-none tracking-tight">
                    {item.short}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <button
          type="button"
          aria-label="Roue des outils"
          {...bindDebouncedAction(() => setToolWheelOpen((open) => !open))}
          className={`relative w-14 h-14 rounded-full shadow-2xl border-2 flex flex-col items-center justify-center transition-transform active:scale-95 cursor-pointer ${
            toolWheelOpen
              ? 'bg-slate-800 border-amber-300 text-amber-200'
              : 'bg-slate-950/92 border-slate-600 text-slate-100 hover:border-emerald-400'
          }`}
        >
          {renderToolIcon(hud.activeTool, 'w-5 h-5')}
          <span className="mt-0.5 text-[9px] font-semibold leading-none text-slate-300">
            {activeToolMeta.short}
          </span>
        </button>
      </div>
    </div>
  );
}
