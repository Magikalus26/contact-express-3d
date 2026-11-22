import * as THREE from 'three';
import { MaterialLibrary } from '../materials';
import { INTERACT_LAYER } from '../textures';
import { soundSynth } from '../audio';
import { InteractableItem, WalletStatus, WorldBuildContext } from '../types';
import { PlayerWallet } from '../wallet';

type AtmScreenState =
  | 'IDLE'
  | 'READING'
  | 'PIN'
  | 'CAPTURED'
  | 'MENU'
  | 'WITHDRAW_DISPENSING'
  | 'WITHDRAW_TAKE'
  | 'WITHDRAW_DONE'
  | 'DEPOSIT_OPEN'
  | 'DEPOSIT_COUNTING'
  | 'DEPOSIT_DONE'
  | 'BALANCE'
  | 'STATEMENT'
  | 'EJECTING';


export interface FrancBillSpec {
  value: 50 | 100 | 200 | 500;
  figure: string;
  primary: string;
  secondary: string;
  accent: string;
}

export const FRANC_SPECS: Record<50 | 100 | 200 | 500, FrancBillSpec> = {
  50: {
    value: 50,
    figure: 'SAINT-EXUPÉRY',
    primary: '#2563eb',
    secondary: '#93c5fd',
    accent: '#1e3a8a',
  },
  100: {
    value: 100,
    figure: 'EUGÈNE DELACROIX',
    primary: '#92400e',
    secondary: '#fcd34d',
    accent: '#451a03',
  },
  200: {
    value: 200,
    figure: 'MONTESQUIEU',
    primary: '#15803d',
    secondary: '#86efac',
    accent: '#052e16',
  },
  500: {
    value: 500,
    figure: 'BLAISE PASCAL',
    primary: '#ca8a04',
    secondary: '#fef08a',
    accent: '#713f12',
  },
};

function formatFrancs(val: number): string {
  const neg = val < 0;
  const abs = Math.abs(val);
  const intPart = Math.floor(abs)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const decPart = Math.round((abs - Math.floor(abs)) * 100)
    .toString()
    .padStart(2, '0');
  return `${neg ? '-' : ''}${intPart},${decPart} ₣`;
}

function formatFrancsWhole(val: number): string {
  return `${Math.round(val)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₣`;
}

export interface Atm1990Controller {
  getWalletStatus: () => WalletStatus;
}

const ATM_PRESS_COOLDOWN_MS = 320;

export function buildAtm1990(
  ctx: WorldBuildContext,
  parent: THREE.Group,
  mats: MaterialLibrary,
  posX: number,
  posZ: number,
  wallet: PlayerWallet,
  onWalletChanged: () => void
): Atm1990Controller {
  const atm = new THREE.Group();
  atm.position.set(posX, 0.02, posZ);
  parent.add(atm);

  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  ctx.disposables.push(proxyMat);

  // ============================================================================
  // 1. BANKING STATE & STRICT SINGLE-PRESS DEBOUNCE (320ms LOCK)
  // ============================================================================
  let screenState: AtmScreenState = 'IDLE';
  let pinInput = '';
  let pinAttempts = 0;
  let errorMessage = '';
  let stateTimer = 0;
  let pendingWithdrawAmount: 50 | 100 | 200 | 500 = 100;
  let depositSelectedAmount = 100;
  let lastOperationText = 'CONSULTATION SOLDE';
  let lastOperationAmount = 0;
  let receiptExtruded = false;
  let forgottenAlarmAccum = 0;
  let crtNeedsRedraw = true;
  let lastBlinkPhase = -1;

  // Strict single-press hardware debounce lock for ALL ATM buttons/slots
  let atmLastPressTime = 0;
  const acquireAtmPressLock = (): boolean => {
    const now = performance.now();
    if (now - atmLastPressTime < ATM_PRESS_COOLDOWN_MS) {
      return false;
    }
    atmLastPressTime = now;
    return true;
  };

  const notifyWallet = () => {
    crtNeedsRedraw = true;
    onWalletChanged();
  };

  wallet.subscribe(() => {
    crtNeedsRedraw = true;
  });

  // ============================================================================
  // 2. PROCEDURAL TEXTURES (SOBER 1990 FRENCH BANKING SIGNAGE, CRT 1024x768, CB, FRANCS)
  // ============================================================================
  const makeTexture = (canvas: HTMLCanvasElement): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = ctx.maxAnisotropy;
    tex.needsUpdate = true;
    ctx.disposables.push(tex);
    return tex;
  };

  // --- Sober Institutional French Bank Header Signage (White/Gold on Navy #1B365D) ---
  const canopyCanvas = document.createElement('canvas');
  canopyCanvas.width = 1024;
  canopyCanvas.height = 192;
  {
    const c = canopyCanvas.getContext('2d')!;
    c.fillStyle = '#1B365D';
    c.fillRect(0, 0, 1024, 192);

    // Subtle institutional gold framing rule
    c.strokeStyle = '#D4AF37';
    c.lineWidth = 4;
    c.strokeRect(12, 12, 1000, 168);

    // Classic sober CB emblem on left
    const cbGrad = c.createLinearGradient(34, 34, 166, 154);
    cbGrad.addColorStop(0, '#1d4ed8');
    cbGrad.addColorStop(1, '#15803d');
    c.fillStyle = cbGrad;
    c.fillRect(34, 40, 132, 112);
    c.strokeStyle = '#F8FAFC';
    c.lineWidth = 4;
    c.strokeRect(34, 40, 132, 112);
    c.fillStyle = '#F8FAFC';
    c.font = '800 62px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('CB', 100, 118);

    // White & Gold Printed Institutional Typography
    c.textAlign = 'left';
    c.fillStyle = '#F8FAFC';
    c.font = '800 50px "Plus Jakarta Sans", sans-serif';
    c.fillText('BANQUE NATIONALE', 196, 86);

    c.fillStyle = '#FDE68A';
    c.font = '600 26px "Plus Jakarta Sans", sans-serif';
    c.fillText('DISTRIBUTEUR AUTOMATIQUE DE BILLETS  ·  CARTE BLEUE', 198, 138);
  }
  const canopyTex = makeTexture(canopyCanvas);

  // --- 1990 French Carte Bleue Texture (Front + Back) ---
  const cbFrontCanvas = document.createElement('canvas');
  cbFrontCanvas.width = 512;
  cbFrontCanvas.height = 320;
  {
    const c = cbFrontCanvas.getContext('2d')!;
    const bg = c.createLinearGradient(0, 0, 512, 320);
    bg.addColorStop(0, '#1B365D');
    bg.addColorStop(0.55, '#1d4ed8');
    bg.addColorStop(1, '#15803d');
    c.fillStyle = bg;
    c.fillRect(0, 0, 512, 320);

    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.arc(280, 340, 120 + i * 26, Math.PI, Math.PI * 2);
      c.stroke();
    }

    c.fillStyle = '#F8FAFC';
    c.font = '800 26px "Plus Jakarta Sans", sans-serif';
    c.fillText('CARTE BLEUE', 28, 50);
    c.fillStyle = '#FDE68A';
    c.font = '600 16px "Plus Jakarta Sans", sans-serif';
    c.fillText('BANQUE NATIONALE · FRANCE', 28, 76);

    const cbGrad = c.createLinearGradient(392, 24, 484, 88);
    cbGrad.addColorStop(0, '#1d4ed8');
    cbGrad.addColorStop(1, '#15803d');
    c.fillStyle = cbGrad;
    c.fillRect(392, 24, 92, 62);
    c.strokeStyle = '#F8FAFC';
    c.lineWidth = 3;
    c.strokeRect(392, 24, 92, 62);
    c.fillStyle = '#F8FAFC';
    c.font = '800 38px "Plus Jakarta Sans", sans-serif';
    c.fillText('CB', 410, 68);

    // Gold Smart Chip (ISO 7816)
    c.fillStyle = '#d4af37';
    c.fillRect(46, 114, 72, 56);
    c.strokeStyle = '#713f12';
    c.lineWidth = 2;
    c.strokeRect(46, 114, 72, 56);
    c.beginPath();
    c.moveTo(46, 134);
    c.lineTo(118, 134);
    c.moveTo(46, 152);
    c.lineTo(118, 152);
    c.moveTo(72, 114);
    c.lineTo(72, 170);
    c.moveTo(94, 114);
    c.lineTo(94, 170);
    c.stroke();

    c.fillStyle = '#f8fafc';
    c.font = '700 30px "JetBrains Mono", monospace';
    c.fillText('4974  0190  3482  1990', 34, 224);

    c.fillStyle = '#e0f2fe';
    c.font = '600 14px "JetBrains Mono", monospace';
    c.fillText('EXPIRE FIN 11/93', 280, 260);
    c.font = '700 18px "JetBrains Mono", monospace';
    c.fillText('M. JEAN DUPONT', 34, 290);
  }
  const cbFrontTex = makeTexture(cbFrontCanvas);

  const cbBackCanvas = document.createElement('canvas');
  cbBackCanvas.width = 512;
  cbBackCanvas.height = 320;
  {
    const c = cbBackCanvas.getContext('2d')!;
    c.fillStyle = '#1B365D';
    c.fillRect(0, 0, 512, 320);
    c.fillStyle = '#0f172a';
    c.fillRect(0, 32, 512, 56);
    c.fillStyle = '#f8fafc';
    c.fillRect(28, 120, 340, 44);
    c.fillStyle = '#334155';
    c.font = 'italic 600 22px serif';
    c.fillText('J. Dupont', 48, 150);
  }
  const cbBackTex = makeTexture(cbBackCanvas);

  // --- Authentic 1990 French Franc Banknote Textures ---
  const francTextures: Record<50 | 100 | 200 | 500, THREE.CanvasTexture> = {
    50: makeTexture(createFrancNoteCanvas(FRANC_SPECS[50])),
    100: makeTexture(createFrancNoteCanvas(FRANC_SPECS[100])),
    200: makeTexture(createFrancNoteCanvas(FRANC_SPECS[200])),
    500: makeTexture(createFrancNoteCanvas(FRANC_SPECS[500])),
  };

  // --- Thermal Paper Receipt Dynamic Canvas ---
  const receiptCanvas = document.createElement('canvas');
  receiptCanvas.width = 256;
  receiptCanvas.height = 384;
  const receiptTex = makeTexture(receiptCanvas);

  const redrawReceipt = () => {
    const c = receiptCanvas.getContext('2d')!;
    c.fillStyle = '#f7f5ee';
    c.fillRect(0, 0, 256, 384);

    c.fillStyle = '#1e293b';
    c.textAlign = 'center';
    c.font = '700 17px "JetBrains Mono", monospace';
    c.fillText('BANQUE NATIONALE', 128, 34);
    c.font = '600 12px "JetBrains Mono", monospace';
    c.fillText('RÉSEAU CARTE BLEUE', 128, 54);
    c.fillText('AGENCE CONTACT EXPRESS', 128, 72);
    c.fillText('--------------------------------', 128, 92);

    c.textAlign = 'left';
    c.font = '600 13px "JetBrains Mono", monospace';
    c.fillText('DATE : 19/11/1990', 18, 118);
    c.fillText('DAB  : #0042-FRF', 18, 138);
    c.fillText('CARTE: **** 1990', 18, 158);
    c.fillText('--------------------------------', 18, 180);

    c.font = '700 14px "JetBrains Mono", monospace';
    c.fillText(lastOperationText, 18, 206);
    if (lastOperationAmount !== 0) {
      c.fillText(
        `MONTANT: ${lastOperationAmount > 0 ? '+' : ''}${formatFrancs(lastOperationAmount)}`,
        18,
        232
      );
    }
    c.fillText('SOLDE COMPTE FRF :', 18, 266);
    c.font = '700 17px "JetBrains Mono", monospace';
    c.fillText(formatFrancs(wallet.getBankBalance()), 18, 292);

    c.font = '600 11px "JetBrains Mono", monospace';
    c.textAlign = 'center';
    c.fillText('--------------------------------', 128, 326);
    c.fillText('CONSERVEZ CE TICKET', 128, 348);
    c.fillText('MERCI DE VOTRE VISITE', 128, 366);
    receiptTex.needsUpdate = true;
  };
  redrawReceipt();

  // --- Sober, Crisp 1024x768 1990 French Retail Bank CRT UI (Deep Navy #0F2544, White #F8FAFC, Sky-Blue #93C5FD, Gold/Cream #FDE68A) ---
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = 1024;
  crtCanvas.height = 768;
  const crtTex = makeTexture(crtCanvas);

  const drawCrtScreen = (blinkOn: boolean) => {
    const c = crtCanvas.getContext('2d')!;
    const W = 1024;
    const H = 768;

    // Calm Deep-Navy Institutional Background (#0F2544) with very subtle tube falloff (zero neon/green scanlines)
    const bgGrad = c.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 680);
    bgGrad.addColorStop(0, '#143058');
    bgGrad.addColorStop(1, '#0B1C35');
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    // Top Institutional Header Band
    c.fillStyle = '#1B365D';
    c.fillRect(28, 26, W - 56, 74);
    c.strokeStyle = '#93C5FD';
    c.lineWidth = 2.5;
    c.strokeRect(28, 26, W - 56, 74);

    c.fillStyle = '#F8FAFC';
    c.font = '700 28px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'left';
    c.fillText('BANQUE NATIONALE  ·  RÉSEAU CARTE BLEUE', 48, 72);
    c.fillStyle = '#FDE68A';
    c.font = '700 24px "JetBrains Mono", monospace';
    c.textAlign = 'right';
    c.fillText('NOVEMBRE 1990', W - 48, 72);

    // Clean Footer Bar
    c.strokeStyle = 'rgba(147, 197, 253, 0.35)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(28, H - 72);
    c.lineTo(W - 28, H - 72);
    c.stroke();

    c.fillStyle = '#93C5FD';
    c.font = '600 21px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.fillText('DISTRIBUTEUR CB 1990  ·  FRANC FRANÇAIS (₣)', 34, H - 34);
    c.textAlign = 'right';
    c.fillStyle = '#FDE68A';
    c.fillText(`PORTEFEUILLE : ${formatFrancsWhole(wallet.getTotalCash())}`, W - 34, H - 34);

    // 4 Side-Bezel Aligned Option Rows (aligned precisely with physical 3D bezel keys)
    const rowYs = [235, 350, 465, 580];
    const drawBezelOption = (
      side: 'L' | 'R',
      rowIdx: number,
      label: string,
      highlightGold = false
    ) => {
      const y = rowYs[rowIdx];
      const boxW = 445;
      const boxX = side === 'L' ? 32 : W - 32 - boxW;
      c.fillStyle = highlightGold ? 'rgba(253, 230, 138, 0.14)' : 'rgba(27, 54, 93, 0.85)';
      c.fillRect(boxX, y - 38, boxW, 68);
      c.strokeStyle = highlightGold ? '#FDE68A' : '#93C5FD';
      c.lineWidth = 2.5;
      c.strokeRect(boxX, y - 38, boxW, 68);

      c.fillStyle = highlightGold ? '#FDE68A' : '#F8FAFC';
      c.font = '700 25px "Plus Jakarta Sans", sans-serif';
      if (side === 'L') {
        c.textAlign = 'left';
        c.fillText(`◄   ${label}`, boxX + 18, y + 6);
      } else {
        c.textAlign = 'right';
        c.fillText(`${label}   ►`, boxX + boxW - 18, y + 6);
      }
    };

    c.textAlign = 'center';

    if (screenState === 'IDLE') {
      c.fillStyle = '#F8FAFC';
      c.font = '700 40px "Plus Jakarta Sans", sans-serif';
      c.fillText('BIENVENUE À LA BANQUE NATIONALE', W / 2, 232);
      c.fillStyle = '#FDE68A';
      c.font = '600 28px "Plus Jakarta Sans", sans-serif';
      c.fillText('DISTRIBUTEUR AUTOMATIQUE DE BILLETS · 1990', W / 2, 286);

      c.fillStyle = 'rgba(27, 54, 93, 0.72)';
      c.fillRect(110, 344, W - 220, 156);
      c.strokeStyle = '#FDE68A';
      c.lineWidth = 3;
      c.strokeRect(110, 344, W - 220, 156);

      c.fillStyle = '#F8FAFC';
      c.font = '700 35px "Plus Jakarta Sans", sans-serif';
      c.fillText('INSÉREZ VOTRE CARTE BLEUE', W / 2, 412);
      c.fillStyle = blinkOn ? '#FDE68A' : '#93C5FD';
      c.font = '600 24px "JetBrains Mono", monospace';
      c.fillText('LECTEUR CARTE À DROITE DE L’ÉCRAN   →', W / 2, 466);

      c.fillStyle = '#93C5FD';
      c.font = '600 22px "Plus Jakarta Sans", sans-serif';
      c.fillText('RETRAITS  ·  DÉPÔT ESPÈCES EN FRANCS  ·  SOLDE  ·  MINI-RELEVÉ', W / 2, 582);
    } else if (screenState === 'READING') {
      c.fillStyle = '#F8FAFC';
      c.font = '700 34px "Plus Jakarta Sans", sans-serif';
      c.fillText('LECTURE DE VOTRE CARTE BLEUE EN COURS...', W / 2, 336);
      c.fillStyle = '#93C5FD';
      c.font = '600 24px "Plus Jakarta Sans", sans-serif';
      c.fillText('INTERROGATION DU CENTRE CARTE BLEUE (1990)', W / 2, 404);
      c.fillStyle = '#FDE68A';
      c.font = '700 26px "JetBrains Mono", monospace';
      c.fillText(blinkOn ? '[ ■ ■ ■ ■ ■ ■ □ □ ]' : '[ ■ ■ ■ ■ ■ ■ ■ ■ ]', W / 2, 480);
    } else if (screenState === 'PIN') {
      c.fillStyle = '#F8FAFC';
      c.font = '700 33px "Plus Jakarta Sans", sans-serif';
      c.fillText('COMPOSEZ VOTRE CODE CONFIDENTIEL', W / 2, 200);
      c.fillStyle = '#93C5FD';
      c.font = '600 23px "Plus Jakarta Sans", sans-serif';
      c.fillText("À L'ABRI DES REGARDS SUR LE CLAVIER NUMÉRIQUE", W / 2, 248);

      c.fillStyle = '#1B365D';
      c.fillRect(270, 295, 484, 112);
      c.strokeStyle = '#FDE68A';
      c.lineWidth = 3;
      c.strokeRect(270, 295, 484, 112);

      const masked = Array.from({ length: 4 }, (_, i) => (i < pinInput.length ? '*' : '_')).join(
        '   '
      );
      c.fillStyle = '#F8FAFC';
      c.font = '800 58px "JetBrains Mono", monospace';
      c.fillText(masked, W / 2, 370);

      c.fillStyle = '#F8FAFC';
      c.font = '600 23px "Plus Jakarta Sans", sans-serif';
      c.fillText('PUIS APPUYEZ SUR LA TOUCHE VERTE [VALIDATION]', W / 2, 468);
      c.fillStyle = '#93C5FD';
      c.font = '600 20px "Plus Jakarta Sans", sans-serif';
      c.fillText('TOUCHE JAUNE : CORRECTION   ·   TOUCHE ROUGE : ANNULATION', W / 2, 514);

      if (errorMessage) {
        c.fillStyle = '#FDE68A';
        c.font = '700 26px "Plus Jakarta Sans", sans-serif';
        c.fillText(errorMessage, W / 2, 594);
      }
    } else if (screenState === 'CAPTURED') {
      c.fillStyle = 'rgba(27, 54, 93, 0.9)';
      c.fillRect(72, 210, W - 144, 340);
      c.strokeStyle = '#FDE68A';
      c.lineWidth = 4;
      c.strokeRect(72, 210, W - 144, 340);
      c.fillStyle = '#FDE68A';
      c.font = '800 40px "Plus Jakarta Sans", sans-serif';
      c.fillText('CARTE CAPTURÉE', W / 2, 305);
      c.fillStyle = '#F8FAFC';
      c.font = '700 27px "Plus Jakarta Sans", sans-serif';
      c.fillText('3 CODES CONFIDENTIELS ERRONÉS', W / 2, 374);
      c.fillText('VEUILLEZ CONTACTER VOTRE AGENCE', W / 2, 430);
      c.fillStyle = '#93C5FD';
      c.font = '600 21px "Plus Jakarta Sans", sans-serif';
      c.fillText('RÉINITIALISATION DU DISTRIBUTEUR EN COURS...', W / 2, 502);
    } else if (screenState === 'MENU') {
      c.fillStyle = '#93C5FD';
      c.font = '700 25px "Plus Jakarta Sans", sans-serif';
      c.fillText('SÉLECTIONNEZ VOTRE OPÉRATION AVEC LES TOUCHES LATÉRALES', W / 2, 152);

      drawBezelOption('L', 0, 'RETRAIT 50 ₣');
      drawBezelOption('L', 1, 'RETRAIT 100 ₣');
      drawBezelOption('L', 2, 'RETRAIT 200 ₣');
      drawBezelOption('L', 3, 'RETRAIT 500 ₣');

      drawBezelOption('R', 0, 'DÉPÔT ESPÈCES (FRANCS)');
      drawBezelOption('R', 1, 'CONSULTATION DE SOLDE');
      drawBezelOption('R', 2, 'MINI-RELEVÉ (1990)');
      drawBezelOption('R', 3, 'RESTITUTION CARTE', true);

      if (errorMessage) {
        c.fillStyle = '#FDE68A';
        c.font = '700 24px "Plus Jakarta Sans", sans-serif';
        c.fillText(errorMessage, W / 2, 654);
      }
    } else if (screenState === 'WITHDRAW_DISPENSING') {
      c.fillStyle = '#F8FAFC';
      c.font = '700 35px "Plus Jakarta Sans", sans-serif';
      c.fillText(`PRÉPARATION RETRAIT : ${formatFrancsWhole(pendingWithdrawAmount)}`, W / 2, 320);
      c.fillStyle = '#93C5FD';
      c.font = '600 25px "Plus Jakarta Sans", sans-serif';
      c.fillText('DISTRIBUTION DES BILLETS EN FRANCS EN COURS...', W / 2, 396);
      c.fillStyle = '#FDE68A';
      c.font = '700 24px "JetBrains Mono", monospace';
      c.fillText(
        `COUPURE : ${FRANC_SPECS[pendingWithdrawAmount].value} ₣ (${FRANC_SPECS[pendingWithdrawAmount].figure})`,
        W / 2,
        466
      );
    } else if (screenState === 'WITHDRAW_TAKE') {
      c.fillStyle = 'rgba(27, 54, 93, 0.85)';
      c.fillRect(100, 210, W - 200, 320);
      c.strokeStyle = '#FDE68A';
      c.lineWidth = 3.5;
      c.strokeRect(100, 210, W - 200, 320);
      c.fillStyle = '#F8FAFC';
      c.font = '800 38px "Plus Jakarta Sans", sans-serif';
      c.fillText('VEUILLEZ PRENDRE VOS BILLETS', W / 2, 305);
      c.fillStyle = '#FDE68A';
      c.font = '700 32px "JetBrains Mono", monospace';
      c.fillText(
        `${formatFrancsWhole(pendingWithdrawAmount)} — ${FRANC_SPECS[pendingWithdrawAmount].figure}`,
        W / 2,
        382
      );
      c.fillStyle = blinkOn ? '#FDE68A' : '#93C5FD';
      c.font = '700 25px "Plus Jakarta Sans", sans-serif';
      c.fillText('↓   TRAPPE DE DISTRIBUTION OUVERTE CI-DESSOUS   ↓', W / 2, 466);
    } else if (screenState === 'WITHDRAW_DONE' || screenState === 'DEPOSIT_DONE') {
      c.fillStyle = '#F8FAFC';
      c.font = '700 34px "Plus Jakarta Sans", sans-serif';
      c.fillText(
        screenState === 'WITHDRAW_DONE'
          ? 'RETRAIT EFFECTUÉ AVEC SUCCÈS'
          : 'DÉPÔT EN FRANCS CRÉDITÉ SUR VOTRE COMPTE',
        W / 2,
        220
      );
      c.fillStyle = '#FDE68A';
      c.font = '700 34px "JetBrains Mono", monospace';
      c.fillText(`NOUVEAU SOLDE : ${formatFrancs(wallet.getBankBalance())}`, W / 2, 310);

      drawBezelOption('L', 3, 'IMPRIMER TICKET REÇU');
      drawBezelOption('R', 2, 'RETOUR MENU PRINCIPAL');
      drawBezelOption('R', 3, 'RESTITUTION CARTE', true);
    } else if (screenState === 'DEPOSIT_OPEN') {
      c.fillStyle = '#FDE68A';
      c.font = '700 29px "Plus Jakarta Sans", sans-serif';
      c.fillText('TRAPPE DÉPÔT ESPÈCES INFÉRIEURE OUVERTE', W / 2, 152);

      const availBills = wallet.getBillsTotal();
      if (availBills <= 0) {
        c.fillStyle = '#F8FAFC';
        c.font = '700 30px "Plus Jakarta Sans", sans-serif';
        c.fillText('AUCUN BILLET EN FRANCS DANS VOTRE PORTEFEUILLE', W / 2, 360);
        drawBezelOption('R', 2, 'RETOUR MENU PRINCIPAL');
        drawBezelOption('R', 3, 'RESTITUTION CARTE', true);
      } else {
        drawBezelOption('L', 0, 'DÉPOSER 50 ₣', depositSelectedAmount === 50);
        drawBezelOption('L', 1, 'DÉPOSER 100 ₣', depositSelectedAmount === 100);
        drawBezelOption('L', 2, 'DÉPOSER 200 ₣', depositSelectedAmount === 200);
        drawBezelOption(
          'L',
          3,
          `TOUT (${formatFrancsWhole(availBills)})`,
          depositSelectedAmount === availBills
        );

        drawBezelOption('R', 2, 'RETOUR MENU PRINCIPAL');
        drawBezelOption('R', 3, 'RESTITUTION CARTE', true);

        c.fillStyle = blinkOn ? '#FDE68A' : '#93C5FD';
        c.font = '700 24px "Plus Jakarta Sans", sans-serif';
        c.fillText(
          `VISEZ LA TRAPPE INFÉRIEURE POUR DÉPOSER ${formatFrancsWhole(Math.min(depositSelectedAmount, availBills))} ↓`,
          W / 2,
          654
        );
      }
    } else if (screenState === 'DEPOSIT_COUNTING') {
      c.fillStyle = '#F8FAFC';
      c.font = '700 35px "Plus Jakarta Sans", sans-serif';
      c.fillText('VÉRIFICATION & COMPTAGE DES BILLETS...', W / 2, 350);
      c.fillStyle = '#93C5FD';
      c.font = '600 25px "Plus Jakarta Sans", sans-serif';
      c.fillText('TRAPPE MOTORISÉE FERMÉE · VEUILLEZ PATIENTER', W / 2, 424);
    } else if (screenState === 'BALANCE') {
      c.fillStyle = '#93C5FD';
      c.font = '700 27px "Plus Jakarta Sans", sans-serif';
      c.fillText('CONSULTATION DE SOLDE — COMPTE CHÈQUES FRF', W / 2, 175);

      c.fillStyle = 'rgba(27, 54, 93, 0.85)';
      c.fillRect(100, 218, W - 200, 204);
      c.strokeStyle = '#FDE68A';
      c.lineWidth = 3;
      c.strokeRect(100, 218, W - 200, 204);
      c.fillStyle = '#93C5FD';
      c.font = '600 23px "JetBrains Mono", monospace';
      c.fillText('N° COMPTE : 00042891074 FRF  ·  19/11/1990', W / 2, 274);
      c.fillStyle = '#F8FAFC';
      c.font = '800 44px "JetBrains Mono", monospace';
      c.fillText(`SOLDE : ${formatFrancs(wallet.getBankBalance())}`, W / 2, 362);

      drawBezelOption('L', 3, 'IMPRIMER TICKET SOLDE');
      drawBezelOption('R', 2, 'RETOUR MENU PRINCIPAL');
      drawBezelOption('R', 3, 'RESTITUTION CARTE', true);
    } else if (screenState === 'STATEMENT') {
      c.fillStyle = '#93C5FD';
      c.font = '700 27px "Plus Jakarta Sans", sans-serif';
      c.fillText('MINI-RELEVÉ DES DERNIÈRES OPÉRATIONS (1990)', W / 2, 158);

      c.fillStyle = 'rgba(27, 54, 93, 0.78)';
      c.fillRect(56, 188, W - 112, 242);
      c.strokeStyle = '#93C5FD';
      c.lineWidth = 2;
      c.strokeRect(56, 188, W - 112, 242);

      c.font = '600 23px "JetBrains Mono", monospace';
      const recent = wallet.getTransactions().slice(0, 5);
      recent.forEach((tx, idx) => {
        const ty = 234 + idx * 42;
        c.textAlign = 'left';
        c.fillStyle = '#F8FAFC';
        c.fillText(`${tx.date}  ${tx.label}`, 82, ty);
        c.textAlign = 'right';
        c.fillStyle = tx.amount >= 0 ? '#93C5FD' : '#FDE68A';
        c.fillText(`${tx.amount >= 0 ? '+' : ''}${formatFrancs(tx.amount)}`, W - 82, ty);
      });
      c.textAlign = 'center';

      drawBezelOption('L', 3, 'IMPRIMER MINI-RELEVÉ');
      drawBezelOption('R', 2, 'RETOUR MENU PRINCIPAL');
      drawBezelOption('R', 3, 'RESTITUTION CARTE', true);
    } else if (screenState === 'EJECTING') {
      c.fillStyle = 'rgba(27, 54, 93, 0.9)';
      c.fillRect(72, 200, W - 144, 340);
      c.strokeStyle = '#FDE68A';
      c.lineWidth = 4;
      c.strokeRect(72, 200, W - 144, 340);
      c.fillStyle = blinkOn ? '#FDE68A' : '#F8FAFC';
      c.font = '800 36px "Plus Jakarta Sans", sans-serif';
      c.fillText("N'OUBLIEZ PAS DE RETIRER VOTRE CARTE", W / 2, 315);
      c.fillStyle = '#93C5FD';
      c.font = '700 27px "Plus Jakarta Sans", sans-serif';
      c.fillText('VOTRE CARTE BLEUE EST PRÉSENTÉE À DROITE   →', W / 2, 405);
      c.fillStyle = '#F8FAFC';
      c.font = '600 23px "Plus Jakarta Sans", sans-serif';
      c.fillText('LA BANQUE NATIONALE VOUS REMERCIE DE VOTRE VISITE', W / 2, 480);
    }

    crtTex.needsUpdate = true;
  };

  // ============================================================================
  // 3. SOBER INSTITUTIONAL 1990 FRENCH BANK ATM 3D HARDWARE (ZERO NEON)
  // Matte brushed stainless steel + Navy Blue (#1B365D) + Slate Grey (#4A5568)
  // ============================================================================
  const brushedSteelMat = new THREE.MeshStandardMaterial({
    color: 0xc4cbd3,
    roughness: 0.42,
    metalness: 0.72,
  });
  const bankNavyMat = new THREE.MeshStandardMaterial({
    color: 0x1b365d,
    roughness: 0.48,
    metalness: 0.25,
  });
  const bankSlateMat = new THREE.MeshStandardMaterial({
    color: 0x4a5568,
    roughness: 0.5,
    metalness: 0.42,
  });
  const anodizedSlotMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.38,
    metalness: 0.65,
  });
  const darkRecessMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.68,
    metalness: 0.2,
  });
  const metalKeyMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.34,
    metalness: 0.78,
  });
  // Restrained printed canopy (subtle warm backlit readability, zero neon glow)
  const canopyMat = new THREE.MeshStandardMaterial({
    map: canopyTex,
    emissiveMap: canopyTex,
    emissive: 0xfff8eb,
    emissiveIntensity: 0.28,
    roughness: 0.36,
  });
  // Sober recessed overhead halogen diffuser lens
  const halogenLensMat = new THREE.MeshStandardMaterial({
    color: 0xfff7e6,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.9,
    roughness: 0.25,
  });
  const crtMat = new THREE.MeshStandardMaterial({
    map: crtTex,
    emissiveMap: crtTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.82,
    roughness: 0.18,
    metalness: 0.06,
  });
  ctx.disposables.push(
    brushedSteelMat,
    bankNavyMat,
    bankSlateMat,
    anodizedSlotMat,
    darkRecessMat,
    metalKeyMat,
    canopyMat,
    halogenLensMat,
    crtMat
  );

  // Outer Navy-Blue Institutional Metallic Surround Frame
  const outerSurround = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.22, 0.34), bankNavyMat);
  outerSurround.position.set(0, 1.11, -0.01);
  outerSurround.castShadow = true;
  outerSurround.receiveShadow = true;

  // Recessed Matte Brushed Stainless-Steel Faceplate
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.82, 0.36), brushedSteelMat);
  mainBody.position.set(0, 0.96, 0.01);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;

  // Top Institutional Signage Hood + Recessed Warm-White Halogen Downlight
  const canopyHood = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.32, 0.48), bankNavyMat);
  canopyHood.position.set(0, 2.04, 0.06);
  const canopyFace = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.26), canopyMat);
  canopyFace.position.set(0, 2.04, 0.305);

  const halogenDiffuser = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.09), halogenLensMat);
  halogenDiffuser.rotation.x = Math.PI / 2;
  halogenDiffuser.position.set(-0.1, 1.878, 0.24);

  const halogenLight = new THREE.PointLight(0xfff1d6, 1.8, 2.8, 2.0);
  halogenLight.position.set(-0.1, 1.82, 0.36);

  atm.add(outerSurround, mainBody, canopyHood, canopyFace, halogenDiffuser, halogenLight);
  ctx.disposables.push(
    outerSurround.geometry,
    mainBody.geometry,
    canopyHood.geometry,
    canopyFace.geometry,
    halogenDiffuser.geometry
  );

  // Security convex mirror above CRT
  const secMirror = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), mats.chrome);
  secMirror.scale.set(1.5, 0.75, 0.4);
  secMirror.position.set(-0.2, 1.8, 0.195);
  atm.add(secMirror);
  ctx.disposables.push(secMirror.geometry);

  // --- Clean Recessed 4:3 Rectangular CRT Monitor Housing (Zero Corner Clipping) ---
  const crtBezel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.56, 0.09), bankSlateMat);
  crtBezel.position.set(-0.2, 1.48, 0.165); // front face at z = 0.210
  const crtCavity = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.435, 0.012), darkRecessMat);
  crtCavity.position.set(-0.2, 1.48, 0.206); // front face at z = 0.212
  atm.add(crtBezel, crtCavity);
  ctx.disposables.push(crtBezel.geometry, crtCavity.geometry);

  // Sharp-cornered 4:3 rectangular screen (0.54 x 0.405) offset +0.005m forward of dark recess frame
  const crtGeo = new THREE.PlaneGeometry(0.54, 0.405);
  ctx.disposables.push(crtGeo);

  const crtMesh = new THREE.Mesh(crtGeo, crtMat);
  crtMesh.position.set(-0.2, 1.48, 0.217);
  atm.add(crtMesh);

  // --- 8 Physical Brushed-Metal Side-Bezel Function Keys (4 Left, 4 Right) ---
  const bezelRowYs = [1.561, 1.5, 1.439, 1.379];
  const animatedPressMeshes: Array<{ mesh: THREE.Object3D; restZ: number; press: number }> = [];

  const registerProxy = (
    parentObj: THREE.Object3D,
    size: [number, number, number],
    pos: [number, number, number],
    item: Omit<InteractableItem, 'proxyMesh'>
  ) => {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    ctx.disposables.push(geo);
    const proxy = new THREE.Mesh(geo, proxyMat);
    proxy.position.set(pos[0], pos[1], pos[2]);
    proxy.layers.set(INTERACT_LAYER);
    parentObj.add(proxy);

    const fullItem: InteractableItem = { ...item, proxyMesh: proxy };
    proxy.userData.interactable = fullItem;
    ctx.interactables.push(fullItem);
    return fullItem;
  };

  const getBezelLabel = (side: 'L' | 'R', row: number): string | null => {
    if (screenState === 'MENU') {
      if (side === 'L')
        return ['RETRAIT 50 ₣', 'RETRAIT 100 ₣', 'RETRAIT 200 ₣', 'RETRAIT 500 ₣'][row];
      return [
        'DÉPÔT ESPÈCES (FRANCS)',
        'CONSULTATION DE SOLDE',
        'MINI-RELEVÉ (1990)',
        'RESTITUTION CARTE',
      ][row];
    }
    const availBills = wallet.getBillsTotal();
    if (screenState === 'DEPOSIT_OPEN' && availBills > 0) {
      if (side === 'L')
        return [
          'DÉPOSER 50 ₣',
          'DÉPOSER 100 ₣',
          'DÉPOSER 200 ₣',
          `TOUT (${formatFrancsWhole(availBills)})`,
        ][row];
      if (row === 2) return 'RETOUR MENU PRINCIPAL';
      if (row === 3) return 'RESTITUTION CARTE';
      return null;
    }
    if (screenState === 'DEPOSIT_OPEN' && availBills <= 0) {
      if (side === 'R' && row === 2) return 'RETOUR MENU PRINCIPAL';
      if (side === 'R' && row === 3) return 'RESTITUTION CARTE';
      return null;
    }
    if (
      screenState === 'BALANCE' ||
      screenState === 'STATEMENT' ||
      screenState === 'WITHDRAW_DONE' ||
      screenState === 'DEPOSIT_DONE'
    ) {
      if (side === 'L' && row === 3) return 'IMPRIMER TICKET REÇU';
      if (side === 'R' && row === 2) return 'RETOUR MENU PRINCIPAL';
      if (side === 'R' && row === 3) return 'RESTITUTION CARTE';
      return null;
    }
    return null;
  };

  const handleBezelKeyPress = (side: 'L' | 'R', row: number): boolean => {
    if (!acquireAtmPressLock()) return false;

    const label = getBezelLabel(side, row);
    if (!label) {
      soundSynth.playAtmPiezo('bezel');
      return true;
    }
    soundSynth.playAtmPiezo('bezel');
    errorMessage = '';

    if (screenState === 'MENU') {
      if (side === 'L') {
        const amounts: Array<50 | 100 | 200 | 500> = [50, 100, 200, 500];
        const amt = amounts[row];
        if (wallet.getBankBalance() < amt) {
          errorMessage = 'SOLDE INSUFFISANT POUR CE RETRAIT';
          soundSynth.playAtmPiezo('error');
          crtNeedsRedraw = true;
          return true;
        }
        pendingWithdrawAmount = amt;
        wallet.adjustBankBalance(-amt, 'RETRAIT DAB CONTACT');
        lastOperationText = 'RETRAIT DAB ESPÈCES';
        lastOperationAmount = -amt;
        updateBanknoteVisuals(amt);
        screenState = 'WITHDRAW_DISPENSING';
        stateTimer = 1.25;
        soundSynth.playBillDispenserRollers(amt === 500 ? 6 : 4);
        crtNeedsRedraw = true;
        return true;
      }
      if (row === 0) {
        const availBills = wallet.getBillsTotal();
        depositSelectedAmount = availBills >= 100 ? 100 : availBills;
        screenState = 'DEPOSIT_OPEN';
        crtNeedsRedraw = true;
      } else if (row === 1) {
        lastOperationText = 'CONSULTATION SOLDE';
        lastOperationAmount = 0;
        screenState = 'BALANCE';
        crtNeedsRedraw = true;
      } else if (row === 2) {
        lastOperationText = 'MINI-RELEVÉ (1990)';
        lastOperationAmount = 0;
        screenState = 'STATEMENT';
        crtNeedsRedraw = true;
      } else if (row === 3) {
        triggerCardEjection();
      }
      return true;
    }

    if (screenState === 'DEPOSIT_OPEN') {
      const availBills = wallet.getBillsTotal();
      if (side === 'L' && availBills > 0) {
        const opts = [50, 100, 200, availBills];
        depositSelectedAmount = Math.min(opts[row], availBills);
        crtNeedsRedraw = true;
      } else if (side === 'R' && row === 2) {
        screenState = 'MENU';
        crtNeedsRedraw = true;
      } else if (side === 'R' && row === 3) {
        triggerCardEjection();
      }
      return true;
    }

    if (
      screenState === 'BALANCE' ||
      screenState === 'STATEMENT' ||
      screenState === 'WITHDRAW_DONE' ||
      screenState === 'DEPOSIT_DONE'
    ) {
      if (side === 'L' && row === 3) {
        triggerReceiptPrint();
      } else if (side === 'R' && row === 2) {
        screenState = 'MENU';
        crtNeedsRedraw = true;
      } else if (side === 'R' && row === 3) {
        triggerCardEjection();
      }
    }
    return true;
  };

  const bezelBtnGeo = new THREE.BoxGeometry(0.048, 0.036, 0.032);
  ctx.disposables.push(bezelBtnGeo);

  (['L', 'R'] as const).forEach((side) => {
    const bx = side === 'L' ? -0.525 : 0.125;
    bezelRowYs.forEach((by, row) => {
      const btn = new THREE.Mesh(bezelBtnGeo, metalKeyMat);
      btn.position.set(bx, by, 0.215);
      atm.add(btn);

      const pressState = { mesh: btn, restZ: 0.215, press: 0 };
      animatedPressMeshes.push(pressState);

      registerProxy(atm, [0.072, 0.056, 0.06], [bx, by, 0.222], {
        id: `atm_bezel_${side}_${row}`,
        title: `Touche Écran ${side}${row + 1}`,
        subtitle: 'Touche Fonction CRT 1990',
        kind: 'diegetic_action',
        state: false,
        inspectText: '',
        dynamicVerb: () => 'APPUYER',
        dynamicTitle: () => {
          const lbl = getBezelLabel(side, row);
          if (!lbl) return `Touche Latérale ${side}${row + 1}`;
          return side === 'L' ? `◄ ${lbl}` : `${lbl} ►`;
        },
        dynamicSubtitle: () => 'Touche Métal Latérale · Banque Nationale',
        onInteract: () => {
          if (handleBezelKeyPress(side, row)) {
            pressState.press = 1;
          }
        },
      });
    });
  });

  // --- Right Panel: Non-Glowing Anodized Metal Card Reader Slot & Thermal Receipt Slot ---
  // Printed crisp "CARTE BLEUE" label above anodized metal slot
  const cardLabelCanvas = document.createElement('canvas');
  cardLabelCanvas.width = 192;
  cardLabelCanvas.height = 48;
  {
    const c = cardLabelCanvas.getContext('2d')!;
    c.fillStyle = '#1B365D';
    c.fillRect(0, 0, 192, 48);
    c.fillStyle = '#F8FAFC';
    c.font = '700 18px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('CARTE BLEUE', 96, 30);
  }
  const cardLabelTex = makeTexture(cardLabelCanvas);
  const cardLabelMat = new THREE.MeshStandardMaterial({ map: cardLabelTex, roughness: 0.45 });
  const cardLabelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.048), cardLabelMat);
  cardLabelPlate.position.set(0.42, 1.66, 0.193);

  const cardReaderHousing = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.13, 0.055), bankSlateMat);
  cardReaderHousing.position.set(0.42, 1.56, 0.2);
  const cardAnodizedLip = new THREE.Mesh(
    new THREE.BoxGeometry(0.165, 0.068, 0.04),
    anodizedSlotMat
  );
  cardAnodizedLip.position.set(0.42, 1.56, 0.22);
  const cardSlit = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.012, 0.046), mats.rubberBlack);
  cardSlit.position.set(0.42, 1.56, 0.226);

  // Subtle tiny institutional status indicator dot (8mm matte LED pin, zero neon glow!)
  const cardPinMat = new THREE.MeshStandardMaterial({
    color: 0x3f7d58,
    emissive: 0x2e6b47,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const cardPin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.015, 10), cardPinMat);
  cardPin.rotation.x = Math.PI / 2;
  cardPin.position.set(0.5, 1.595, 0.226);

  atm.add(cardLabelPlate, cardReaderHousing, cardAnodizedLip, cardSlit, cardPin);
  ctx.disposables.push(
    cardLabelMat,
    cardLabelPlate.geometry,
    cardReaderHousing.geometry,
    cardAnodizedLip.geometry,
    cardSlit.geometry,
    cardPinMat,
    cardPin.geometry
  );

  // 3D Carte Bleue Mesh + Stylized 3D Player Hand
  const cardGeo = new THREE.BoxGeometry(0.095, 0.004, 0.145);
  const cbSideMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
  const cbFrontMat = new THREE.MeshStandardMaterial({
    map: cbFrontTex,
    roughness: 0.26,
    metalness: 0.25,
  });
  const cbBackMat = new THREE.MeshStandardMaterial({
    map: cbBackTex,
    roughness: 0.34,
  });
  ctx.disposables.push(cardGeo, cbSideMat, cbFrontMat, cbBackMat);

  const card3D = new THREE.Mesh(cardGeo, [
    cbSideMat,
    cbSideMat,
    cbFrontMat,
    cbBackMat,
    cbSideMat,
    cbSideMat,
  ]);
  card3D.position.set(0.42, 1.56, 0.14);
  card3D.visible = false;
  atm.add(card3D);

  const handGroup = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.65 });
  const cuffMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.78 });
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.036, 0.11), skinMat);
  const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.022, 0.06), skinMat);
  thumb.position.set(-0.045, 0.016, -0.045);
  const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.024, 0.055), skinMat);
  fingers.position.set(0.005, -0.012, -0.055);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.18, 10), cuffMat);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0, -0.01, 0.14);
  handGroup.add(palm, thumb, fingers, sleeve);
  handGroup.position.set(0.42, 1.53, 0.48);
  handGroup.visible = false;
  atm.add(handGroup);
  ctx.disposables.push(
    skinMat,
    cuffMat,
    palm.geometry,
    thumb.geometry,
    fingers.geometry,
    sleeve.geometry
  );

  let cardAnimMode: 'none' | 'inserting' | 'ejected' | 'retrieving' = 'none';
  let cardAnimProgress = 0;

  const triggerCardEjection = () => {
    screenState = 'EJECTING';
    cardAnimMode = 'ejected';
    cardAnimProgress = 0;
    card3D.visible = true;
    card3D.position.set(0.42, 1.56, 0.17);
    forgottenAlarmAccum = 0.25;
    soundSynth.playCardEject();
    crtNeedsRedraw = true;
  };

  registerProxy(atm, [0.26, 0.19, 0.12], [0.42, 1.56, 0.24], {
    id: 'atm_card_slot_insert',
    title: 'Lecteur Carte Bleue (CB 1990)',
    subtitle: 'Fente Motorisée · Banque Nationale',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => screenState === 'IDLE' && wallet.isCardInHand() && cardAnimMode === 'none',
    dynamicVerb: () => 'INSÉRER CARTE BLEUE',
    dynamicTitle: () => 'Lecteur Carte Bleue 1990',
    dynamicSubtitle: () => 'Banque Nationale · Code confidentiel : 1990',
    onInteract: () => {
      if (!acquireAtmPressLock()) return;
      wallet.setCardInHand(false);
      cardAnimMode = 'inserting';
      cardAnimProgress = 0;
      card3D.visible = true;
      handGroup.visible = true;
      pinInput = '';
      errorMessage = '';
      soundSynth.playCardMotorPull();
      notifyWallet();
    },
  });

  registerProxy(atm, [0.24, 0.18, 0.24], [0.42, 1.56, 0.3], {
    id: 'atm_card_retrieve',
    title: 'Carte Bleue Éjectée (CB 1990)',
    subtitle: 'Alarme d’oubli active',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => screenState === 'EJECTING' && cardAnimMode === 'ejected',
    dynamicVerb: () => 'REPRENDRE MA CARTE',
    dynamicTitle: () => 'Carte Bleue (CB 1990)',
    dynamicSubtitle: () => 'Retirer la carte pour terminer',
    onInteract: () => {
      if (!acquireAtmPressLock()) return;
      cardAnimMode = 'retrieving';
      cardAnimProgress = 0;
      handGroup.visible = true;
      soundSynth.playPaperGrab();
      wallet.setCardInHand(true);
      screenState = 'IDLE';
      pinInput = '';
      errorMessage = '';
      crtNeedsRedraw = true;
      notifyWallet();
    },
  });

  // --- Thermal Paper Receipt Slot (Non-Glowing Anodized Metal Bezel) ---
  const receiptLabelCanvas = document.createElement('canvas');
  receiptLabelCanvas.width = 192;
  receiptLabelCanvas.height = 44;
  {
    const c = receiptLabelCanvas.getContext('2d')!;
    c.fillStyle = '#4A5568';
    c.fillRect(0, 0, 192, 44);
    c.fillStyle = '#F8FAFC';
    c.font = '700 17px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('TICKET / REÇU', 96, 28);
  }
  const receiptLabelTex = makeTexture(receiptLabelCanvas);
  const receiptLabelMat = new THREE.MeshStandardMaterial({ map: receiptLabelTex, roughness: 0.45 });
  const receiptLabelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.042), receiptLabelMat);
  receiptLabelPlate.position.set(0.42, 1.39, 0.193);

  const receiptSlotFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.082, 0.045),
    anodizedSlotMat
  );
  receiptSlotFrame.position.set(0.42, 1.32, 0.195);
  const receiptSlit = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.05), mats.rubberBlack);
  receiptSlit.position.set(0.42, 1.32, 0.205);
  atm.add(receiptLabelPlate, receiptSlotFrame, receiptSlit);
  ctx.disposables.push(
    receiptLabelMat,
    receiptLabelPlate.geometry,
    receiptSlotFrame.geometry,
    receiptSlit.geometry
  );

  const receiptMat = new THREE.MeshStandardMaterial({
    map: receiptTex,
    roughness: 0.72,
    side: THREE.DoubleSide,
  });
  const receiptMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.165), receiptMat);
  receiptMesh.position.set(0.42, 1.29, 0.18);
  receiptMesh.rotation.x = -0.35;
  receiptMesh.visible = false;
  atm.add(receiptMesh);
  ctx.disposables.push(receiptMat, receiptMesh.geometry);

  let receiptTargetZ = 0.16;

  const triggerReceiptPrint = () => {
    redrawReceipt();
    receiptExtruded = true;
    receiptMesh.visible = true;
    receiptMesh.position.set(0.42, 1.29, 0.18);
    receiptTargetZ = 0.285;
    soundSynth.playReceiptPrint();
  };

  registerProxy(atm, [0.22, 0.2, 0.2], [0.42, 1.28, 0.28], {
    id: 'atm_receipt_take',
    title: 'Ticket Reçu Thermique (1990)',
    subtitle: 'Banque Nationale · Relevé Imprimé',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => receiptExtruded,
    dynamicVerb: () => 'PRENDRE LE TICKET',
    dynamicTitle: () => 'Ticket Reçu Thermique',
    dynamicSubtitle: () => 'Imprimé le 19/11/1990 · Banque Nationale',
    onInteract: () => {
      if (!acquireAtmPressLock()) return;
      receiptExtruded = false;
      receiptMesh.visible = false;
      receiptTargetZ = 0.16;
      soundSynth.playPaperGrab();
    },
  });

  // ============================================================================
  // 4. RECESSED 3D BRUSHED-STEEL NUMERIC KEYPAD (STRICT SINGLE-PRESS DEBOUNCE)
  // ============================================================================
  const keypadDeck = new THREE.Group();
  keypadDeck.position.set(-0.15, 1.05, 0.335);
  keypadDeck.rotation.x = 0.32;
  atm.add(keypadDeck);

  const deckPlate = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.055, 0.34), bankSlateMat);
  const deckMetalRecess = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.02, 0.28), brushedSteelMat);
  deckMetalRecess.position.y = 0.025;
  const shieldL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.3), mats.stainless);
  shieldL.position.set(-0.33, 0.055, 0);
  const shieldR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.3), mats.stainless);
  shieldR.position.set(0.33, 0.055, 0);
  keypadDeck.add(deckPlate, deckMetalRecess, shieldL, shieldR);
  ctx.disposables.push(
    deckPlate.geometry,
    deckMetalRecess.geometry,
    shieldL.geometry,
    shieldR.geometry
  );

  interface KeyDef {
    code: string;
    label: string;
    row: number;
    col: number;
    bg: string;
    fg: string;
    wide?: boolean;
  }

  const keyDefs: KeyDef[] = [
    { code: '1', label: '1', row: 0, col: 0, bg: '#cbd5e1', fg: '#0f172a' },
    { code: '2', label: '2', row: 0, col: 1, bg: '#cbd5e1', fg: '#0f172a' },
    { code: '3', label: '3', row: 0, col: 2, bg: '#cbd5e1', fg: '#0f172a' },
    { code: 'CANCEL', label: 'ANNUL.', row: 0, col: 3, bg: '#b91c1c', fg: '#ffffff', wide: true },

    { code: '4', label: '4', row: 1, col: 0, bg: '#cbd5e1', fg: '#0f172a' },
    { code: '5', label: '5', row: 1, col: 1, bg: '#cbd5e1', fg: '#0f172a' },
    { code: '6', label: '6', row: 1, col: 2, bg: '#cbd5e1', fg: '#0f172a' },
    { code: 'CORRECT', label: 'CORR.', row: 1, col: 3, bg: '#ca8a04', fg: '#0f172a', wide: true },

    { code: '7', label: '7', row: 2, col: 0, bg: '#cbd5e1', fg: '#0f172a' },
    { code: '8', label: '8', row: 2, col: 1, bg: '#cbd5e1', fg: '#0f172a' },
    { code: '9', label: '9', row: 2, col: 2, bg: '#cbd5e1', fg: '#0f172a' },
    { code: 'VALID', label: 'VALID.', row: 2, col: 3, bg: '#15803d', fg: '#ffffff', wide: true },

    { code: '0', label: '0', row: 3, col: 1, bg: '#cbd5e1', fg: '#0f172a' },
  ];

  const handleKeypadPress = (code: string): boolean => {
    if (!acquireAtmPressLock()) return false;

    if (code === 'CANCEL') {
      soundSynth.playAtmPiezo('cancel');
      if (
        screenState !== 'IDLE' &&
        screenState !== 'EJECTING' &&
        screenState !== 'CAPTURED' &&
        !wallet.isCardInHand()
      ) {
        triggerCardEjection();
      }
      return true;
    }

    if (screenState !== 'PIN') {
      soundSynth.playAtmPiezo(
        code === 'VALID' ? 'confirm' : code === 'CORRECT' ? 'correct' : 'digit'
      );
      return true;
    }

    if (code === 'CORRECT') {
      soundSynth.playAtmPiezo('correct');
      pinInput = pinInput.slice(0, -1);
      errorMessage = '';
      crtNeedsRedraw = true;
      return true;
    }

    if (code === 'VALID') {
      if (pinInput === '1990') {
        soundSynth.playAtmPiezo('confirm');
        pinAttempts = 0;
        pinInput = '';
        errorMessage = '';
        screenState = 'MENU';
        crtNeedsRedraw = true;
      } else {
        pinAttempts++;
        pinInput = '';
        soundSynth.playAtmPiezo('error');
        if (pinAttempts >= 3) {
          screenState = 'CAPTURED';
          stateTimer = 4.2;
          errorMessage = '';
          crtNeedsRedraw = true;
        } else {
          errorMessage = `CODE ERRONÉ — ESSAI ${pinAttempts} / 3 (CODE : 1990)`;
          crtNeedsRedraw = true;
        }
      }
      return true;
    }

    // Strict single digit 0–9
    soundSynth.playAtmPiezo('digit');
    if (pinInput.length < 4) {
      pinInput += code;
      errorMessage = '';
      crtNeedsRedraw = true;
    }
    return true;
  };

  const animatedKeyCaps: Array<{ mesh: THREE.Object3D; restY: number; press: number }> = [];

  keyDefs.forEach((kd) => {
    const keyW = kd.wide ? 0.118 : 0.068;
    const keyD = 0.048;
    const keyH = 0.026;

    const kCanvas = document.createElement('canvas');
    kCanvas.width = kd.wide ? 128 : 96;
    kCanvas.height = 64;
    const kc = kCanvas.getContext('2d')!;
    kc.fillStyle = kd.bg;
    kc.fillRect(0, 0, kCanvas.width, kCanvas.height);
    kc.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    kc.lineWidth = 4;
    kc.strokeRect(2, 2, kCanvas.width - 4, kCanvas.height - 4);
    kc.fillStyle = kd.fg;
    kc.font = kd.wide
      ? '800 24px "Plus Jakarta Sans", sans-serif'
      : '800 40px "JetBrains Mono", monospace';
    kc.textAlign = 'center';
    kc.textBaseline = 'middle';
    kc.fillText(kd.label, kCanvas.width / 2, kCanvas.height / 2 + 2);
    const kTex = makeTexture(kCanvas);

    const kTopMat = new THREE.MeshStandardMaterial({
      map: kTex,
      roughness: 0.35,
      metalness: kd.wide ? 0.12 : 0.6,
    });
    const kSideMat = new THREE.MeshStandardMaterial({
      color: kd.bg,
      roughness: 0.42,
      metalness: kd.wide ? 0.1 : 0.48,
    });
    const kGeo = new THREE.BoxGeometry(keyW, keyH, keyD);
    ctx.disposables.push(kTopMat, kSideMat, kGeo);

    const kx = kd.col < 3 ? -0.205 + kd.col * 0.09 : 0.15;
    const kz = -0.095 + kd.row * 0.064;
    const restY = 0.049;

    const keyMesh = new THREE.Mesh(kGeo, [
      kSideMat,
      kSideMat,
      kTopMat,
      kSideMat,
      kSideMat,
      kSideMat,
    ]);
    keyMesh.position.set(kx, restY, kz);
    keypadDeck.add(keyMesh);

    const pressState = { mesh: keyMesh, restY, press: 0 };
    animatedKeyCaps.push(pressState);

    const fullNames: Record<string, string> = {
      CANCEL: 'Touche Rouge ANNULATION',
      CORRECT: 'Touche Jaune CORRECTION',
      VALID: 'Touche Verte VALIDATION',
    };

    registerProxy(keypadDeck, [keyW + 0.016, 0.055, keyD + 0.014], [kx, restY + 0.01, kz], {
      id: `atm_key_${kd.code}`,
      title: fullNames[kd.code] ?? `Touche Chiffre [ ${kd.label} ]`,
      subtitle: 'Clavier Métallique Chiffré · DAB 1990',
      kind: 'diegetic_action',
      state: false,
      inspectText: '',
      dynamicVerb: () => 'APPUYER',
      dynamicTitle: () => fullNames[kd.code] ?? `Touche [ ${kd.label} ]`,
      dynamicSubtitle: () =>
        screenState === 'PIN'
          ? `Saisie Code PIN (${pinInput.length}/4)`
          : 'Clavier Acier Brossé · Banque Nationale',
      onInteract: () => {
        if (handleKeypadPress(kd.code)) {
          pressState.press = 1;
        }
      },
    });
  });

  // ============================================================================
  // 5. UPPER ANODIZED CASH DISPENSER SHUTTER + 1990 FRANC BANKNOTES
  // ============================================================================
  const dispenserGroup = new THREE.Group();
  dispenserGroup.position.set(-0.15, 0.78, 0.19);
  atm.add(dispenserGroup);

  const dispLabelCanvas = document.createElement('canvas');
  dispLabelCanvas.width = 256;
  dispLabelCanvas.height = 42;
  {
    const c = dispLabelCanvas.getContext('2d')!;
    c.fillStyle = '#1B365D';
    c.fillRect(0, 0, 256, 42);
    c.fillStyle = '#F8FAFC';
    c.font = '700 17px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('RETRAIT BILLETS', 128, 27);
  }
  const dispLabelTex = makeTexture(dispLabelCanvas);
  const dispLabelMat = new THREE.MeshStandardMaterial({ map: dispLabelTex, roughness: 0.45 });
  const dispLabelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.044), dispLabelMat);
  dispLabelPlate.position.set(0, 0.088, 0.025);

  const dispBezel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.135, 0.045), anodizedSlotMat);
  const dispCavity = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.082, 0.08), darkRecessMat);
  dispCavity.position.z = -0.02;
  const upperShutter = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.018), mats.stainless);
  upperShutter.position.set(0, 0, 0.02);
  dispenserGroup.add(dispLabelPlate, dispBezel, dispCavity, upperShutter);
  ctx.disposables.push(
    dispLabelMat,
    dispLabelPlate.geometry,
    dispBezel.geometry,
    dispCavity.geometry,
    upperShutter.geometry
  );

  const banknoteMat = new THREE.MeshStandardMaterial({
    map: francTextures[100],
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const noteGeo = new THREE.BoxGeometry(0.155, 0.004, 0.09);
  ctx.disposables.push(banknoteMat, noteGeo);

  const dispensedNotesGroup = new THREE.Group();
  dispensedNotesGroup.position.set(0, -0.005, -0.04);
  dispensedNotesGroup.visible = false;
  for (let n = 0; n < 3; n++) {
    const note = new THREE.Mesh(noteGeo, banknoteMat);
    note.position.set((n - 1) * 0.018, n * 0.006, n * 0.008);
    note.rotation.y = (n - 1) * 0.05;
    dispensedNotesGroup.add(note);
  }
  dispenserGroup.add(dispensedNotesGroup);

  const updateBanknoteVisuals = (amt: 50 | 100 | 200 | 500) => {
    banknoteMat.map = francTextures[amt];
    banknoteMat.needsUpdate = true;
  };

  registerProxy(dispenserGroup, [0.48, 0.18, 0.24], [0, 0, 0.12], {
    id: 'atm_take_banknotes',
    title: 'Billets en Francs (1990)',
    subtitle: 'Distributeur Billets Ouvert',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => screenState === 'WITHDRAW_TAKE',
    dynamicVerb: () => 'PRENDRE LES BILLETS',
    dynamicTitle: () =>
      `Billets ${formatFrancsWhole(pendingWithdrawAmount)} (${FRANC_SPECS[pendingWithdrawAmount].figure})`,
    dynamicSubtitle: () => 'Ajouter les Francs au portefeuille',
    onInteract: () => {
      if (!acquireAtmPressLock()) return;
      wallet.addBill(pendingWithdrawAmount, 1);
      dispensedNotesGroup.visible = false;
      screenState = 'WITHDRAW_DONE';
      soundSynth.playPaperGrab();
      crtNeedsRedraw = true;
      notifyWallet();
    },
  });

  // ============================================================================
  // 6. LOWER MOTORIZED CASH DEPOSIT SLOT ("TRAPPE DÉPÔT ESPÈCES") — ANODIZED METAL
  // ============================================================================
  const depositGroup = new THREE.Group();
  depositGroup.position.set(-0.15, 0.54, 0.19);
  atm.add(depositGroup);

  const depLabelCanvas = document.createElement('canvas');
  depLabelCanvas.width = 256;
  depLabelCanvas.height = 42;
  {
    const c = depLabelCanvas.getContext('2d')!;
    c.fillStyle = '#4A5568';
    c.fillRect(0, 0, 256, 42);
    c.fillStyle = '#FDE68A';
    c.font = '700 16px "Plus Jakarta Sans", sans-serif';
    c.textAlign = 'center';
    c.fillText('TRAPPE DÉPÔT ESPÈCES', 128, 27);
  }
  const depLabelTex = makeTexture(depLabelCanvas);
  const depLabelMat = new THREE.MeshStandardMaterial({ map: depLabelTex, roughness: 0.45 });
  const depLabelPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.044), depLabelMat);
  depLabelPlate.position.set(0, 0.088, 0.025);

  const depBezel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.135, 0.045), anodizedSlotMat);
  const depCavity = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.082, 0.08), darkRecessMat);
  depCavity.position.z = -0.02;
  const lowerShutter = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.018), mats.stainless);
  lowerShutter.position.set(0, 0, 0.02);

  // Subtle small amber status pin (restrained institutional indicator, zero neon bloom)
  const depositPinMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    emissive: 0xd97706,
    emissiveIntensity: 0.04,
    roughness: 0.35,
  });
  const depositPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.014, 10),
    depositPinMat
  );
  depositPin.rotation.x = Math.PI / 2;
  depositPin.position.set(0.245, 0.088, 0.026);

  const depositNoteMat = new THREE.MeshStandardMaterial({
    map: francTextures[100],
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const depositNotesMesh = new THREE.Mesh(noteGeo, depositNoteMat);
  depositNotesMesh.position.set(0, 0, 0.18);
  depositNotesMesh.visible = false;

  depositGroup.add(depLabelPlate, depBezel, depCavity, lowerShutter, depositPin, depositNotesMesh);
  ctx.disposables.push(
    depLabelMat,
    depLabelPlate.geometry,
    depBezel.geometry,
    depCavity.geometry,
    lowerShutter.geometry,
    depositPinMat,
    depositPin.geometry,
    depositNoteMat
  );

  let depositAnimT = -1;
  let activeDepositAmount = 0;

  registerProxy(depositGroup, [0.54, 0.22, 0.22], [0, 0, 0.1], {
    id: 'atm_deposit_slot',
    title: 'Trappe Dépôt Espèces (Francs)',
    subtitle: 'Trappe Motorisée Inférieure',
    kind: 'diegetic_action',
    state: false,
    inspectText: '',
    isVisible: () => screenState === 'DEPOSIT_OPEN' && wallet.getBillsTotal() > 0,
    dynamicVerb: () => 'DÉPOSER BILLETS EN FRANCS',
    dynamicTitle: () =>
      `Trappe Dépôt (${formatFrancsWhole(Math.min(depositSelectedAmount, wallet.getBillsTotal()))})`,
    dynamicSubtitle: () => 'Insérer vos billets en Francs dans la trappe ouverte',
    onInteract: () => {
      if (!acquireAtmPressLock()) return;
      const amt = wallet.deductBillsAmount(depositSelectedAmount);
      if (amt <= 0) return;
      activeDepositAmount = amt;
      const visualNoteVal: 50 | 100 | 200 | 500 =
        amt >= 500 ? 500 : amt >= 200 ? 200 : amt >= 100 ? 100 : 50;
      depositNoteMat.map = francTextures[visualNoteVal];
      depositNoteMat.needsUpdate = true;
      depositNotesMesh.visible = true;
      depositNotesMesh.position.set(0, 0, 0.16);
      depositAnimT = 0;

      screenState = 'DEPOSIT_COUNTING';
      stateTimer = 1.4;
      soundSynth.playBillDispenserRollers(5);
      crtNeedsRedraw = true;
      notifyWallet();
    },
  });

  // ============================================================================
  // 7. ANIMATION & STATE MACHINE TICK
  // ============================================================================
  drawCrtScreen(true);

  ctx.updaters.push({
    update: (dt, elapsed) => {
      const blinkPhase = Math.floor(elapsed * 2.0) % 2;
      const blinkOn = blinkPhase === 0;

      if (
        crtNeedsRedraw ||
        (blinkPhase !== lastBlinkPhase &&
          (screenState === 'IDLE' ||
            screenState === 'READING' ||
            screenState === 'WITHDRAW_TAKE' ||
            screenState === 'DEPOSIT_OPEN' ||
            screenState === 'EJECTING'))
      ) {
        lastBlinkPhase = blinkPhase;
        crtNeedsRedraw = false;
        drawCrtScreen(blinkOn);
      }

      // Restrained institutional indicator pins (subtle, never flashy neon)
      if (screenState === 'CAPTURED') {
        cardPinMat.color.setHex(0x991b1b);
        cardPinMat.emissive.setHex(0xb91c1c);
        cardPinMat.emissiveIntensity = blinkOn ? 0.65 : 0.1;
      } else if (screenState === 'EJECTING') {
        cardPinMat.color.setHex(0xb45309);
        cardPinMat.emissive.setHex(0xd97706);
        cardPinMat.emissiveIntensity = blinkOn ? 0.7 : 0.12;
      } else {
        cardPinMat.color.setHex(0x2e6b47);
        cardPinMat.emissive.setHex(0x2e6b47);
        cardPinMat.emissiveIntensity = screenState === 'IDLE' ? (blinkOn ? 0.55 : 0.18) : 0.35;
      }

      depositPinMat.emissiveIntensity =
        screenState === 'DEPOSIT_OPEN' && wallet.getBillsTotal() > 0
          ? blinkOn
            ? 0.75
            : 0.1
          : 0.04;

      // 3D Hand & Carte Bleue Insertion / Ejection Animation
      if (cardAnimMode === 'inserting') {
        cardAnimProgress += dt * 1.35;
        if (cardAnimProgress < 0.55) {
          const t = cardAnimProgress / 0.55;
          const zCard = THREE.MathUtils.lerp(0.46, 0.27, t);
          card3D.position.set(0.42, 1.56, zCard);
          handGroup.position.set(0.42, 1.52, zCard + 0.09);
        } else if (cardAnimProgress < 1.0) {
          const t = (cardAnimProgress - 0.55) / 0.45;
          card3D.position.set(0.42, 1.56, THREE.MathUtils.lerp(0.27, 0.13, t));
          handGroup.position.set(
            0.42,
            THREE.MathUtils.lerp(1.52, 1.25, t),
            THREE.MathUtils.lerp(0.36, 0.56, t)
          );
        } else {
          cardAnimMode = 'none';
          card3D.visible = false;
          handGroup.visible = false;
          screenState = 'READING';
          stateTimer = 0.85;
          crtNeedsRedraw = true;
        }
      } else if (cardAnimMode === 'ejected') {
        card3D.position.z = THREE.MathUtils.damp(card3D.position.z, 0.295, 8.5, dt);
      } else if (cardAnimMode === 'retrieving') {
        cardAnimProgress += dt * 2.4;
        if (cardAnimProgress < 1.0) {
          const zCard = THREE.MathUtils.lerp(0.295, 0.52, cardAnimProgress);
          card3D.position.set(0.42, 1.56, zCard);
          handGroup.position.set(0.42, 1.52, zCard + 0.07);
        } else {
          cardAnimMode = 'none';
          card3D.visible = false;
          handGroup.visible = false;
        }
      }

      if (screenState === 'EJECTING' && cardAnimMode === 'ejected') {
        forgottenAlarmAccum -= dt;
        if (forgottenAlarmAccum <= 0) {
          forgottenAlarmAccum = 0.72;
          soundSynth.playForgottenCardBeep();
        }
      }

      if (stateTimer > 0) {
        stateTimer -= dt;
        if (stateTimer <= 0) {
          if (screenState === 'READING') {
            screenState = 'PIN';
            crtNeedsRedraw = true;
          } else if (screenState === 'CAPTURED') {
            wallet.setCardInHand(true);
            pinAttempts = 0;
            pinInput = '';
            screenState = 'IDLE';
            crtNeedsRedraw = true;
            notifyWallet();
          } else if (screenState === 'WITHDRAW_DISPENSING') {
            screenState = 'WITHDRAW_TAKE';
            dispensedNotesGroup.visible = true;
            dispensedNotesGroup.position.set(0, -0.005, -0.02);
            crtNeedsRedraw = true;
          } else if (screenState === 'DEPOSIT_COUNTING') {
            wallet.adjustBankBalance(activeDepositAmount, 'DÉPÔT ESPÈCES DAB');
            lastOperationText = 'DÉPÔT ESPÈCES FRANCS';
            lastOperationAmount = activeDepositAmount;
            activeDepositAmount = 0;
            screenState = 'DEPOSIT_DONE';
            soundSynth.playAtmPiezo('confirm');
            crtNeedsRedraw = true;
            notifyWallet();
          }
        }
      }

      const upperOpen = screenState === 'WITHDRAW_TAKE';
      upperShutter.position.y = THREE.MathUtils.damp(
        upperShutter.position.y,
        upperOpen ? 0.075 : 0,
        9,
        dt
      );
      if (dispensedNotesGroup.visible) {
        dispensedNotesGroup.position.z = THREE.MathUtils.damp(
          dispensedNotesGroup.position.z,
          0.075,
          8,
          dt
        );
      }

      const lowerOpen = screenState === 'DEPOSIT_OPEN' && wallet.getBillsTotal() > 0;
      lowerShutter.position.y = THREE.MathUtils.damp(
        lowerShutter.position.y,
        lowerOpen ? 0.075 : 0,
        9,
        dt
      );
      if (depositAnimT >= 0) {
        depositAnimT += dt * 1.9;
        if (depositAnimT < 1) {
          depositNotesMesh.position.z = THREE.MathUtils.lerp(0.16, -0.04, depositAnimT);
        } else {
          depositNotesMesh.visible = false;
          depositAnimT = -1;
        }
      }

      if (receiptMesh.visible) {
        receiptMesh.position.z = THREE.MathUtils.damp(
          receiptMesh.position.z,
          receiptTargetZ,
          7.5,
          dt
        );
      }

      for (let i = 0; i < animatedPressMeshes.length; i++) {
        const k = animatedPressMeshes[i];
        if (k.press > 0.001) {
          k.press = THREE.MathUtils.damp(k.press, 0, 14, dt);
          k.mesh.position.z = k.restZ - k.press * 0.014;
        } else if (k.mesh.position.z !== k.restZ) {
          k.mesh.position.z = k.restZ;
        }
      }
      for (let i = 0; i < animatedKeyCaps.length; i++) {
        const k = animatedKeyCaps[i];
        if (k.press > 0.001) {
          k.press = THREE.MathUtils.damp(k.press, 0, 16, dt);
          k.mesh.position.y = k.restY - k.press * 0.011;
        } else if (k.mesh.position.y !== k.restY) {
          k.mesh.position.y = k.restY;
        }
      }
    },
  });

  return {
    getWalletStatus: () => wallet.getStatus(),
  };
}

export function createFrancNoteCanvas(spec: FrancBillSpec): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 200;
  const c = canvas.getContext('2d')!;

  const grad = c.createLinearGradient(0, 0, 384, 200);
  grad.addColorStop(0, spec.secondary);
  grad.addColorStop(0.5, '#f8fafc');
  grad.addColorStop(1, spec.secondary);
  c.fillStyle = grad;
  c.fillRect(0, 0, 384, 200);

  c.strokeStyle = spec.primary;
  c.lineWidth = 8;
  c.strokeRect(10, 10, 364, 180);
  c.strokeStyle = spec.accent;
  c.lineWidth = 2;
  c.strokeRect(18, 18, 348, 164);

  c.fillStyle = spec.primary;
  c.beginPath();
  c.arc(294, 102, 52, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = spec.secondary;
  c.beginPath();
  c.arc(294, 92, 22, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(294, 134, 30, Math.PI, Math.PI * 2);
  c.fill();

  c.fillStyle = spec.accent;
  c.font = '800 18px "Plus Jakarta Sans", sans-serif';
  c.fillText('BANQUE DE FRANCE', 30, 46);

  c.fillStyle = spec.primary;
  c.font = '800 58px "JetBrains Mono", monospace';
  c.fillText(`${spec.value} ₣`, 30, 118);

  c.fillStyle = spec.accent;
  c.font = '700 15px "JetBrains Mono", monospace';
  c.fillText(`${spec.value} FRANCS · ${spec.figure}`, 30, 162);

  return canvas;
}
