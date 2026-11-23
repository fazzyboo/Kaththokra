"use client";

import { useState } from "react";
import { PageHeader } from "@/components/farmer/Shell";
import { cn } from "@/lib/cn";
import { USSD_CODE } from "@/lib/data";
import { useT } from "@/lib/i18n";

/*
  Feature-phone USSD simulator (SRS §4). Every screen is plain-ASCII Banglish, ≤ 160 chars.
  The side log shows which Applink calls each step would make, for the demo.
*/

type Leaf = { kind: "dx"; name: string; code: string } | { kind: "consult" } | { kind: "unsure" };
type Node =
  | { id: "IDLE" }
  | { id: "MAIN" }
  | { id: "PART"; crop: number }
  | { id: "SYMPTOM"; crop: number; part: number }
  | { id: "RESULT"; name: string }
  | { id: "OTP_WAIT"; name: string }
  | { id: "ALERT_CROP" }
  | { id: "ALERT_UPZ"; crop: number }
  | { id: "ALERT_CONFIRM"; crop: number; upz: string }
  | { id: "FIN"; text: string };

const CROPS = ["Dhan", "Alu", "Tomato"];
const PARTS = ["Pata", "Kando/Gora", "Shish/Fol"];

const TREE: Record<string, { label: string; leaf: Leaf }[]> = {
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

const UNSURE = "Nishchit na. Dealer ba 16123 e call korun. Kono taka kata hoyni.";
const CONSULT = "Ei lokkhon e krishi officer er sathe kotha bolun ba 16123 e call korun. Kono taka kata hoyni.";

function screenText(n: Node): string {
  switch (n.id) {
    case "IDLE":
      return "";
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
      return `Shombhabbo: ${n.name}\nPrescription SMS Tk5\n1 Haan 2 Agronomist call\n0 Pichhe`;
    case "OTP_WAIT":
      return "SMS e asha 6 ongker code din:";
    case "ALERT_CROP":
      return "Alert (Tk20/mash)\n1 Dhan 2 Alu 3 Tomato\n0 Pichhe";
    case "ALERT_UPZ":
      return "Upazila code din (jemon 101):";
    case "ALERT_CONFIRM":
      return `${CROPS[n.crop - 1]} alert, upazila ${n.upz}\nTk20/mash, saptahe max 2 SMS\n1 Haan 0 Pichhe`;
    case "FIN":
      return n.text;
  }
}

export default function UssdPage() {
  const { t } = useT();
  const [stack, setStack] = useState<Node[]>([{ id: "IDLE" }]);
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const node = stack[stack.length - 1];
  const text = screenText(node);
  const live = node.id !== "IDLE" && node.id !== "FIN";

  const push = (n: Node, calls: string[]) => {
    setStack((s) => [...s, n]);
    setLog((l) => [...calls, ...l].slice(0, 14));
  };
  const fin = (text: string, calls: string[]) => push({ id: "FIN", text }, [...calls, "mt-fin"]);

  const send = () => {
    const v = input.trim();
    setInput("");
    if (node.id === "IDLE" || node.id === "FIN") {
      if (v === USSD_CODE || v === "*") {
        setStack([{ id: "IDLE" }, { id: "MAIN" }]);
        setLog((l) => ["mo-init → mt-cont (main menu)", ...l].slice(0, 14));
      }
      return;
    }
    if (v === "00") return setStack([{ id: "IDLE" }, { id: "MAIN" }]);
    if (v === "0") return setStack((s) => (s.length > 2 ? s.slice(0, -1) : s));
    const k = Number(v);
    switch (node.id) {
      case "MAIN":
        if (k >= 1 && k <= 3) return push({ id: "PART", crop: k }, ["mo-cont → mt-cont"]);
        if (k === 4) return push({ id: "ALERT_CROP" }, ["mo-cont → mt-cont"]);
        if (k === 5) return fin("Apnar shesh prescription (Ref PD-482193) abar SMS e jacche. Free.", ["/sms/send (re-send, no charge)"]);
        break;
      case "PART":
        if (k >= 1 && k <= 3) return push({ id: "SYMPTOM", crop: node.crop, part: k }, ["mo-cont → mt-cont"]);
        break;
      case "SYMPTOM": {
        const opts = TREE[`${node.crop}-${node.part}`] ?? [];
        const o = opts[k - 1];
        if (!o) return fin(UNSURE, ["Onno → free end"]);
        if (o.leaf.kind === "consult") return fin(CONSULT, ["Tungro path → free end"]);
        if (o.leaf.kind === "unsure") return fin(UNSURE, ["free end"]);
        return push({ id: "RESULT", name: o.leaf.name }, [`leaf → ${o.leaf.code}, class A`]);
      }
      case "RESULT":
        if (k === 1) return push({ id: "OTP_WAIT", name: node.name }, ["/caas/direct/debit Tk5 → P1003 + correlator", "price confirmed by user"]);
        if (k === 2) return fin("Agronomist apnake 24 ghontay call korbe. Kono taka kata hoyni.", ["review queue (free)"]);
        break;
      case "OTP_WAIT":
        if (/^\d{6}$/.test(v)) {
          const ref = `PD-${Math.floor(1000 + Math.random() * 8999)}`;
          return fin(`Dhonnobad! Prescription SMS e jacche. Ref ${ref}`, [
            "/caas/otp/verify (same correlator)",
            "charging notification S1000 → PAID",
            "/sms/send prescription (DLR=1)",
          ]);
        }
        break;
      case "ALERT_CROP":
        if (k >= 1 && k <= 3) return push({ id: "ALERT_UPZ", crop: k }, ["mo-cont → mt-cont"]);
        break;
      case "ALERT_UPZ":
        if (/^\d{3}$/.test(v)) return push({ id: "ALERT_CONFIRM", crop: node.crop, upz: v }, ["mo-cont → mt-cont"]);
        break;
      case "ALERT_CONFIRM":
        if (k === 1) return fin("Alert chalu. Bondho korte SMS: PD STOP", ["/subscription/send action 1"]);
        break;
    }
    // invalid input: re-prompt once (SRS §4 rules)
    setLog((l) => ["invalid input → re-prompt", ...l].slice(0, 14));
  };

  const press = (k: string) => setInput((i) => (i + k).slice(0, 12));
  const end = () => {
    setStack([{ id: "IDLE" }]);
    setInput("");
    if (live) setLog((l) => ["session closed (pending payment kept 5 min)", ...l].slice(0, 14));
  };

  return (
    <div>
      <PageHeader
        back="/help"
        title={t("বাটন ফোনে কাঠঠোকরা", "Kaththokra on a button phone")}
        subtitle={t(`ইন্টারনেট ছাড়া ${USSD_CODE} ডায়াল করে লক্ষণ বেছে রোগ জানুন। নিচে চেষ্টা করে দেখুন।`, `Dial ${USSD_CODE} without internet and pick the symptoms. Try it below.`)}
      />

      <div className="mx-auto w-[17.5rem] rounded-[2.6rem] bg-[#1d2420] px-5 pb-7 pt-8 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)]">
        <div className="rounded-xl bg-[#c9d4b4] p-3 font-mono text-[0.78rem] leading-[1.35] text-[#1f2a17] shadow-inner" aria-live="polite">
          <div className="flex justify-between text-[0.65rem] opacity-70">
            <span>Banglalink</span>
            <span>{live ? "USSD" : "12:41"}</span>
          </div>
          <div className="mt-1.5 h-[9.5rem] overflow-hidden whitespace-pre-wrap">{node.id === "IDLE" ? t("কোড ডায়াল করুন:\n", "Dial the code:\n") + USSD_CODE : text}</div>
          <div className="mt-1 flex items-center justify-between border-t border-[#1f2a17]/25 pt-1">
            <span className="min-h-[1.1rem] tracking-widest">{input || (live ? "_" : "")}</span>
            {text ? <span className="text-[0.6rem] opacity-60">{text.length}/160</span> : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <button onClick={send} className="h-9 rounded-full bg-[#2f7d4f] text-xs font-semibold text-white" aria-label="Send">
            {node.id === "IDLE" || node.id === "FIN" ? "Call" : "Send"}
          </button>
          <button onClick={() => setInput((i) => i.slice(0, -1))} className="h-9 rounded-full bg-[#3a443d] text-xs text-white/80" aria-label="Clear">
            C
          </button>
          <button onClick={end} className="h-9 rounded-full bg-[#b3332c] text-xs font-semibold text-white" aria-label="End">
            End
          </button>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((k) => (
            <button key={k} onClick={() => press(k)} className="h-11 rounded-xl bg-[#2b332e] text-lg font-medium text-white active:bg-[#3a443d]">
              {k}
            </button>
          ))}
        </div>
        {node.id === "IDLE" || node.id === "FIN" ? (
          <button onClick={() => setInput(USSD_CODE)} className="mt-3 w-full text-center text-xs text-white/60 underline">
            {t(`${USSD_CODE} বসান`, `Type ${USSD_CODE}`)}
          </button>
        ) : null}
      </div>

      <section className="mt-8">
        <h2 className="mb-2 font-semibold">{t("পেছনে যা ঘটছে", "What happens behind it")}</h2>
        {log.length === 0 ? (
          <p className="text-sm text-ink-3">{t("ডায়াল করলে এখানে Applink কল দেখাবে।", "Applink calls show up here once you dial.")}</p>
        ) : (
          <ol className="space-y-1.5">
            {log.map((l, i) => (
              <li key={`${l}-${i}`} className={cn("rounded-lg px-3 py-1.5 font-mono text-xs", i === 0 ? "bg-leaf-50 text-leaf-900" : "bg-mist text-ink-2")}>
                {l}
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-sm text-ink-3">
          {t("০ = পিছনে, ০০ = প্রধান মেনু। অনিশ্চিত হলে কখনো টাকা কাটা হয় না।", "0 = back, 00 = main menu. Uncertain paths are never charged.")}
        </p>
      </section>
    </div>
  );
}
