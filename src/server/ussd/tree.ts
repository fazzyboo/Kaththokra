import "server-only";

/*
  USSD menu tree and screen texts. Copied from src/app/(farmer)/ussd/page.tsx (the spec);
  the page keeps its own copy until F4. Every screen is plain-ASCII Banglish, ≤ 160 chars
  (tests/ussd.test.ts checks all of them).
*/

export type Leaf = { kind: "dx"; name: string; code: string } | { kind: "consult" } | { kind: "unsure" };

export type UssdNode =
  | { id: "MAIN" }
  | { id: "PART"; crop: number }
  | { id: "SYMPTOM"; crop: number; part: number }
  | { id: "RESULT"; crop: number; name: string; code: string }
  | { id: "OTP_WAIT"; name: string; paymentId: string; note?: string }
  | { id: "ALERT_CROP" }
  | { id: "ALERT_UPZ"; crop: number }
  | { id: "ALERT_CONFIRM"; crop: number; upz: string }
  | { id: "FIN"; text: string };

export const CROPS = ["Dhan", "Alu", "Tomato"];
export const CROP_IDS = ["rice", "potato", "tomato"] as const;
export const PARTS = ["Pata", "Kando/Gora", "Shish/Fol"];

export const TREE: Record<string, { label: string; leaf: Leaf }[]> = {
  "1-1": [
    { label: "Chokh-akriti dag, majh dhusor", leaf: { kind: "dx", name: "Blast (Dhan)", code: "RICE_BLAST" } },
    { label: "Badami gol dag", leaf: { kind: "dx", name: "Badami dag (Dhan)", code: "RICE_BROWN_SPOT" } },
    { label: "Pata agay holud/shada shukano", leaf: { kind: "dx", name: "Pata pora (Dhan)", code: "RICE_BLB" } },
    { label: "Holud-komla, gach khato", leaf: { kind: "consult" } },
  ],
  "1-2": [{ label: "Panir kache khole dhusor dag", leaf: { kind: "dx", name: "Khol pora (Dhan)", code: "RICE_SHEATH_BLIGHT" } }],
  "1-3": [{ label: "Shisher gora kalo, venge pore", leaf: { kind: "dx", name: "Blast (Dhan)", code: "RICE_BLAST" } }],
  "2-1": [
    { label: "Kalche veja dag, niche shada", leaf: { kind: "dx", name: "Morok (Alu)", code: "POTATO_LATE_BLIGHT" } },
    { label: "Ring-er moto badami dag", leaf: { kind: "dx", name: "Agam dhosa (Alu)", code: "POTATO_EARLY_BLIGHT" } },
  ],
  "3-1": [
    { label: "Ring-er moto dag, nicher pata", leaf: { kind: "dx", name: "Agam dhosa (Tomato)", code: "TOMATO_EARLY_BLIGHT" } },
    { label: "Kalche veja dag", leaf: { kind: "dx", name: "Nabi dhosa (Tomato)", code: "TOMATO_LATE_BLIGHT" } },
    { label: "Niche jolpai-sobuj aboron", leaf: { kind: "dx", name: "Pata chhata (Tomato)", code: "TOMATO_LEAF_MOLD" } },
  ],
};

export const UNSURE = "Nishchit na. Dealer ba 16123 e call korun. Kono taka kata hoyni.";
export const CONSULT = "Ei lokkhon e krishi officer er sathe kotha bolun ba 16123 e call korun. Kono taka kata hoyni.";

/** Every FIN / status text the server can show (also used by the 160-char test). */
export const MSG = {
  unsure: UNSURE,
  consult: CONSULT,
  review: "Agronomist apnake 24 ghontay call korbe. Kono taka kata hoyni.",
  paidOk: "Dhonnobad! Prescription SMS e jacche.",
  alertOn: "Alert chalu. Bondho korte SMS: PD STOP",
  alertPending: "Alert onurodh pawa geche. Nishchit hole SMS asbe. Bondho korte SMS: PD STOP",
  resend: (ref: string) => `Apnar shesh prescription (Ref ${ref}) abar SMS e jacche. Free.`,
  noPrescription: "Apnar number e kono prescription paoa jayni. Kono taka kata hoyni.",
  resendCapped: "Aj ar abar pathano jabe na. Kal abar chesta korun.",
  lowBalance: "Balance kom (Tk5 lagbe). Kono taka kata hoyni. Recharge kore abar dial korun.",
  locked: "3 bar vul code. Kono taka kata hoyni. Abar dial kore shuru korun.",
  expired: "Code er meyad shesh. Kono taka kata hoyni. Abar dial kore shuru korun.",
  payBusy: "Ekhon payment kora jachhe na. Kono taka kata hoyni. Pore abar chesta korun.",
  notPayable: "Ei rog er prescription ekhono nei. Kono taka kata hoyni. 16123 e call korun.",
  alertBusy: "Ekhon alert chalu kora jachhe na. Pore abar chesta korun.",
  notBanglalink: "Kaththokra shudhu Banglalink number e chole.",
  wrongCode: (left: number) => `Vul code. Aro ${left} bar chesta korte parben.`,
  resumeNote: "Ager payment baki.",
  invalid: "Vul input.",
};

export type Prices = { priceRx: number; priceSubMonthly: number };
const DEFAULT_PRICES: Prices = { priceRx: 5, priceSubMonthly: 20 };

export function screenText(n: UssdNode, prices: Prices = DEFAULT_PRICES): string {
  switch (n.id) {
    case "MAIN":
      return "Kaththokra (lokkhon dekhe rog)\n1 Dhan 2 Alu 3 Tomato\n4 Alert nin/bondho\n5 Shesh prescription";
    case "PART":
      return `${CROPS[n.crop - 1]}: Kon ongsho?\n1 Pata 2 Kando/Gora\n3 Shish/Fol 0 Pichhe`;
    case "SYMPTOM": {
      const opts = TREE[`${n.crop}-${n.part}`] ?? [];
      const lines = opts.map((o, i) => `${i + 1} ${o.label}`);
      lines.push(`${opts.length + 1} Onno 0 Pichhe`);
      return `Ki dekhchen?\n${lines.join("\n")}`;
    }
    case "RESULT":
      return `Shombhabbo: ${n.name}\nPrescription SMS Tk${prices.priceRx}\n1 Haan 2 Agronomist call\n0 Pichhe`;
    case "OTP_WAIT":
      return `${n.note ? `${n.note}\n` : ""}SMS e asha 6 ongker code din:`;
    case "ALERT_CROP":
      return `Alert (Tk${prices.priceSubMonthly}/mash)\n1 Dhan 2 Alu 3 Tomato\n0 Pichhe`;
    case "ALERT_UPZ":
      return "Upazila code din (jemon 101):";
    case "ALERT_CONFIRM":
      return `${CROPS[n.crop - 1]} alert, upazila ${n.upz}\nTk${prices.priceSubMonthly}/mash, saptahe max 2 SMS\n1 Haan 0 Pichhe`;
    case "FIN":
      return n.text;
  }
}

export const MAX_SCREEN = 160;
export const isPlainAscii = (s: string) => /^[\x20-\x7e\n]*$/.test(s);
