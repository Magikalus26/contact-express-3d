import {
  BankTransaction,
  BillBreakdown,
  CoinBreakdown,
  DepartmentStock,
  WalletStatus,
} from './types';

export type FrancBillDenom = 50 | 100 | 200 | 500;
export type AcceptedChangerBillDenom = 50 | 100 | 200;

/**
 * Shared 1990 French Franc financial & inventory store across:
 * - Exterior 1990 ATM (Bank Balance + Ledger + Franc Bills)
 * - Exterior 1990 Monnayeur Automatique (Bills -> Coins)
 * - Caisse 1 & Caisse 2 (Live Store Takings)
 * - Manager's Office CONTACT-OS 90 PC (Compta, Stocks, URSSAF, Dock Pallets)
 */
export class PlayerWallet {
  private bills: BillBreakdown = {
    50: 2,
    100: 1,
    200: 0,
    500: 0,
  };

  private coins: CoinBreakdown = {
    10: 0,
    5: 0,
    2: 0,
    1: 0,
  };

  private cardInHand = true;
  private bankBalance = 1500;
  private caisse1Revenue = 0;
  private caisse2Revenue = 0;
  private cumulativeTurnover = 1850; // Existing Nov 1990 quarter turnover for realistic URSSAF/TVA figures
  private urssafSettled = false;
  private urssafLastPaidAmount = 0;
  private holdingScanner = false;
  private preferredChangerDenom: AcceptedChangerBillDenom | null = 100;

  private transactions: BankTransaction[] = [
    { date: '18/11/90', label: 'VIR. SALAIRE / FONDS', amount: 4200 },
    { date: '17/11/90', label: 'CONTACT EXPRESS 3D', amount: -142.5 },
    { date: '15/11/90', label: 'LIBRAIRIE MANGA', amount: -65 },
    { date: '13/11/90', label: 'BOULANGERIE CENTRE', amount: -18.5 },
  ];

  private departmentStocks: DepartmentStock[] = [
    { id: 'primeur', name: '1. Fruits & Légumes', level: 74, orderedCount: 0 },
    { id: 'boulangerie', name: '2. Boulangerie & Vienn.', level: 58, orderedCount: 0 },
    { id: 'konbini', name: '3. Snacking Konbini', level: 65, orderedCount: 0 },
    { id: 'boucherie', name: '4. Boucherie & Traiteur', level: 62, orderedCount: 0 },
    { id: 'cremerie', name: '5. Crèmerie & Boissons', level: 80, orderedCount: 0 },
    { id: 'surgeles', name: '6. Surgelés & Glaces', level: 84, orderedCount: 0 },
    { id: 'epicerie', name: '7. Épicerie & Conserves', level: 71, orderedCount: 0 },
    { id: 'cave', name: '8. Cave à Vins', level: 88, orderedCount: 0 },
    { id: 'hygiene', name: '9. Hygiène & Entretien', level: 77, orderedCount: 0 },
    { id: 'auto', name: '10. Auto & Animalerie', level: 69, orderedCount: 0 },
    { id: 'manga', name: '11. Manga & Jeux Vidéo', level: 46, orderedCount: 0 },
  ];

  private listeners: Array<() => void> = [];
  private palletListeners: Array<(deptName: string) => void> = [];

  subscribe(fn: () => void): void {
    this.listeners.push(fn);
  }

  onPalletOrdered(fn: (deptName: string) => void): void {
    this.palletListeners.push(fn);
  }

  private emit(): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i]();
    }
  }

  setCardInHand(inHand: boolean): void {
    this.cardInHand = inHand;
    this.emit();
  }

  isCardInHand(): boolean {
    return this.cardInHand;
  }

  getBankBalance(): number {
    return this.bankBalance;
  }

  adjustBankBalance(delta: number, txLabel?: string): void {
    this.bankBalance = Math.round((this.bankBalance + delta) * 100) / 100;
    if (txLabel) {
      this.transactions.unshift({
        date: '19/11/90',
        label: txLabel,
        amount: delta,
      });
    }
    this.emit();
  }

  getTransactions(): BankTransaction[] {
    return this.transactions;
  }

  addStoreRevenue(francs: number, laneNum: 1 | 2 = 1): void {
    if (francs <= 0) return;
    const rounded = Math.round(francs);
    if (laneNum === 1) this.caisse1Revenue += rounded;
    else this.caisse2Revenue += rounded;
    this.cumulativeTurnover += rounded;
    this.urssafSettled = false;
    this.emit();
  }

  getStoreRevenue(): number {
    return this.caisse1Revenue + this.caisse2Revenue;
  }

  getCaisse1Revenue(): number {
    return this.caisse1Revenue;
  }

  getCaisse2Revenue(): number {
    return this.caisse2Revenue;
  }

  transferRevenueToBank(): number {
    const amt = this.getStoreRevenue();
    if (amt <= 0) return 0;
    this.caisse1Revenue = 0;
    this.caisse2Revenue = 0;
    this.adjustBankBalance(amt, 'REM. CAISSES 1&2');
    return amt;
  }

  getDepartmentStocks(): DepartmentStock[] {
    return this.departmentStocks;
  }

  orderStockPallet(deptId?: string): { ok: boolean; deptName: string; reason?: string } {
    const cost = 150;
    if (this.bankBalance < cost) {
      return { ok: false, deptName: '', reason: 'SOLDE BANCAIRE INSUFFISANT (150 ₣)' };
    }
    // Pick specified department or lowest-stocked department
    let target = deptId
      ? this.departmentStocks.find((d) => d.id === deptId)
      : undefined;
    if (!target) {
      target = [...this.departmentStocks].sort((a, b) => a.level - b.level)[0];
    }
    if (!target) return { ok: false, deptName: '', reason: 'RAYON INTROUVABLE' };

    target.level = Math.min(100, target.level + 28);
    target.orderedCount += 1;
    this.adjustBankBalance(-cost, `PALETTE ${target.name.slice(3, 14).toUpperCase()}`);

    for (let i = 0; i < this.palletListeners.length; i++) {
      this.palletListeners[i](target.name);
    }
    return { ok: true, deptName: target.name };
  }

  getUrssafBreakdown(): {
    turnover: number;
    urssaf: number;
    assedic: number;
    tva: number;
    totalDue: number;
    settled: boolean;
    lastPaid: number;
  } {
    const turnover = this.cumulativeTurnover;
    const urssaf = Math.round(turnover * 0.145);
    const assedic = Math.round(turnover * 0.042);
    const tva = Math.round(turnover * 0.186); // Authentic 1990 French standard VAT rate: 18,6%
    const totalDue = this.urssafSettled ? 0 : urssaf + assedic + tva;
    return {
      turnover,
      urssaf,
      assedic,
      tva,
      totalDue,
      settled: this.urssafSettled,
      lastPaid: this.urssafLastPaidAmount,
    };
  }

  payUrssafDeclarations(): { ok: boolean; amount: number; reason?: string } {
    const info = this.getUrssafBreakdown();
    if (info.settled || info.totalDue <= 0) {
      return { ok: false, amount: 0, reason: 'DÉCLARATION DÉJÀ À JOUR' };
    }
    if (this.bankBalance < info.totalDue) {
      return {
        ok: false,
        amount: info.totalDue,
        reason: `SOLDE BANCAIRE INSUFFISANT (${info.totalDue} ₣)`,
      };
    }
    this.urssafSettled = true;
    this.urssafLastPaidAmount = info.totalDue;
    this.adjustBankBalance(-info.totalDue, 'URSSAF/ASSEDIC/TVA 90');
    return { ok: true, amount: info.totalDue };
  }

  setHoldingScanner(holding: boolean): void {
    this.holdingScanner = holding;
    this.emit();
  }

  isHoldingScanner(): boolean {
    return this.holdingScanner;
  }

  getBillsTotal(): number {
    return (
      this.bills[50] * 50 +
      this.bills[100] * 100 +
      this.bills[200] * 200 +
      this.bills[500] * 500
    );
  }

  getCoinsTotal(): number {
    return (
      this.coins[10] * 10 +
      this.coins[5] * 5 +
      this.coins[2] * 2 +
      this.coins[1] * 1
    );
  }

  getTotalCash(): number {
    return this.getBillsTotal() + this.getCoinsTotal();
  }

  addBill(denom: FrancBillDenom, count = 1): void {
    this.bills[denom] += count;
    if (denom === 50 || denom === 100 || denom === 200) {
      this.preferredChangerDenom = denom;
    }
    this.emit();
  }

  addCoins(added: Partial<CoinBreakdown>): void {
    if (added[10]) this.coins[10] += added[10];
    if (added[5]) this.coins[5] += added[5];
    if (added[2]) this.coins[2] += added[2];
    if (added[1]) this.coins[1] += added[1];
    this.emit();
  }

  peekNextChangerBill(): AcceptedChangerBillDenom | null {
    if (this.preferredChangerDenom && this.bills[this.preferredChangerDenom] > 0) {
      return this.preferredChangerDenom;
    }
    if (this.bills[100] > 0) return 100;
    if (this.bills[50] > 0) return 50;
    if (this.bills[200] > 0) return 200;
    return null;
  }

  hasRejected500BillOnly(): boolean {
    return this.peekNextChangerBill() === null && this.bills[500] > 0;
  }

  consumeChangerBill(): AcceptedChangerBillDenom | null {
    const denom = this.peekNextChangerBill();
    if (!denom) return null;
    this.bills[denom] -= 1;
    this.emit();
    return denom;
  }

  deductBillsAmount(requestedAmount: number): number {
    const avail = this.getBillsTotal();
    const target = Math.min(requestedAmount, avail);
    if (target <= 0) return 0;

    const denoms: FrancBillDenom[] = [500, 200, 100, 50];
    const remainingTotal = avail - target;

    const copy: BillBreakdown = { ...this.bills };
    let rem = target;
    for (const d of denoms) {
      const take = Math.min(copy[d], Math.floor(rem / d));
      copy[d] -= take;
      rem -= take * d;
    }

    if (rem === 0) {
      this.bills = copy;
    } else {
      let r = remainingTotal;
      const rebuilt: BillBreakdown = { 50: 0, 100: 0, 200: 0, 500: 0 };
      for (const d of denoms) {
        rebuilt[d] = Math.floor(r / d);
        r -= rebuilt[d] * d;
      }
      this.bills = rebuilt;
    }

    this.emit();
    return target;
  }

  getBillsSummaryText(): string {
    const parts: string[] = [];
    if (this.bills[500] > 0) parts.push(`${this.bills[500]}×500₣`);
    if (this.bills[200] > 0) parts.push(`${this.bills[200]}×200₣`);
    if (this.bills[100] > 0) parts.push(`${this.bills[100]}×100₣`);
    if (this.bills[50] > 0) parts.push(`${this.bills[50]}×50₣`);
    return parts.length > 0 ? parts.join(' · ') : 'Aucun billet';
  }

  getCoinsSummaryText(): string {
    const parts: string[] = [];
    if (this.coins[10] > 0) parts.push(`${this.coins[10]}×10₣`);
    if (this.coins[5] > 0) parts.push(`${this.coins[5]}×5₣`);
    if (this.coins[2] > 0) parts.push(`${this.coins[2]}×2₣`);
    if (this.coins[1] > 0) parts.push(`${this.coins[1]}×1₣`);
    return parts.length > 0 ? parts.join(' · ') : 'Aucune pièce';
  }

  getStatus(): WalletStatus {
    const billsTotal = this.getBillsTotal();
    const coinsTotal = this.getCoinsTotal();
    return {
      cashFrancs: billsTotal + coinsTotal,
      billsTotal,
      coinsTotal,
      bills: { ...this.bills },
      coins: { ...this.coins },
      cardInHand: this.cardInHand,
      bankBalance: this.bankBalance,
      storeRevenueFrancs: this.getStoreRevenue(),
      caisse1Revenue: this.caisse1Revenue,
      caisse2Revenue: this.caisse2Revenue,
      holdingScanner: this.holdingScanner,
    };
  }
}
