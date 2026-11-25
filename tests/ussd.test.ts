import assert from "node:assert/strict";
import { test } from "node:test";
import { UPAZILAS } from "@/lib/data";
import { CROPS, MAX_SCREEN, MSG, TREE, isPlainAscii, screenText, type UssdNode } from "@/server/ussd/tree";

/** Every screen the USSD service can render, with worst-case values filled in. */
function allScreens(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const prices = [
    { priceRx: 5, priceSubMonthly: 20 },
    { priceRx: 999, priceSubMonthly: 9999 }, // admin may raise prices
  ];
  const add = (name: string, n: UssdNode) => prices.forEach((p) => out.push({ name: `${name} @Tk${p.priceRx}`, text: screenText(n, p) }));

  add("MAIN", { id: "MAIN" });
  CROPS.forEach((_, i) => add(`PART ${i + 1}`, { id: "PART", crop: i + 1 }));
  for (const key of Object.keys(TREE)) {
    const [crop, part] = key.split("-").map(Number);
    add(`SYMPTOM ${key}`, { id: "SYMPTOM", crop, part });
    for (const o of TREE[key]) {
      if (o.leaf.kind === "dx") add(`RESULT ${o.leaf.code}`, { id: "RESULT", crop, name: o.leaf.name, code: o.leaf.code });
      if (o.leaf.kind === "dx") add(`OTP_WAIT resume ${o.leaf.code}`, { id: "OTP_WAIT", name: o.leaf.name, paymentId: "p-0000", note: MSG.resumeNote });
    }
  }
  add("OTP_WAIT", { id: "OTP_WAIT", name: "x", paymentId: "p-0000" });
  add("ALERT_CROP", { id: "ALERT_CROP" });
  CROPS.forEach((_, i) => add(`ALERT_UPZ ${i + 1}`, { id: "ALERT_UPZ", crop: i + 1 }));
  CROPS.forEach((_, i) => UPAZILAS.forEach((u) => add(`ALERT_CONFIRM ${i + 1} ${u.num}`, { id: "ALERT_CONFIRM", crop: i + 1, upz: u.num })));

  for (const [k, v] of Object.entries(MSG)) {
    if (typeof v === "string") out.push({ name: `MSG.${k}`, text: v });
  }
  out.push({ name: "MSG.resend", text: MSG.resend("PD-999999") });
  for (let left = 1; left <= 3; left++) out.push({ name: `MSG.wrongCode(${left})`, text: MSG.wrongCode(left) });

  // Prefixed re-prompts (the service drops the prefix if it would overflow, but check the raw screens anyway).
  return out;
}

test("every USSD screen is ≤ 160 chars", () => {
  const over = allScreens().filter((s) => s.text.length > MAX_SCREEN);
  assert.deepEqual(over.map((s) => `${s.name}: ${s.text.length}`), []);
});

test("every USSD screen is plain ASCII", () => {
  const bad = allScreens().filter((s) => !isPlainAscii(s.text));
  assert.deepEqual(bad.map((s) => s.name), []);
});

test("every screen is non-empty", () => {
  assert.ok(allScreens().every((s) => s.text.trim().length > 0));
});
