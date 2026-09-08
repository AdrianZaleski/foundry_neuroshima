import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmPerkAddition } from "../scripts/sheets/feature-requirements.mjs";

const actor = {
  name: "Test", system: {
    background: { originSourceCode: "ORIGIN_VEGAS" },
    attributes: { zrecznosc: { base: 13 } },
    skills: { bronReczna: { base: 3 } }, activeModifiers: []
  }, items: []
};
const perk = { name: "Aramis", type: "perk", system: { requirements: "Zręczność 14+, Broń ręczna 5+" } };
let dialog;
let answer;
globalThis.foundry = { applications: { api: { DialogV2: {
  confirm: async config => { dialog = config; return answer; }
} } } };

test("brakująca umiejętność i premia pochodzenia są widoczne przed decyzją", async () => {
  answer = true;
  assert.equal(await confirmPerkAddition(actor, perk), true);
  assert.match(dialog.content, /Brakujące wymagania.*Broń ręczna 5\+ \(obecnie 3\)/s);
  assert.match(dialog.content, /Spełnione wymagania.*Zręczność 14\+ \(obecnie 14\)/s);
  assert.equal(dialog.yes.label, "Dodaj mimo to");
  assert.equal(dialog.no.label, "Nie dodawaj sztuczki");
});

test("odmowa i zamknięcie okna nie pozwalają dodać sztuczki", async () => {
  for (const result of [false, null, undefined]) {
    answer = result;
    assert.equal(await confirmPerkAddition(actor, perk), false);
  }
  assert.equal(dialog.rejectClose, false);
});

test("spełnione wymagania mają zwykłe potwierdzenie, warunki opisowe są jawne", async () => {
  answer = true;
  await confirmPerkAddition(actor, { ...perk, system: { requirements: "Zręczność 14+" } });
  assert.equal(dialog.yes.label, "Dodaj sztuczkę");
  await confirmPerkAddition(actor, { ...perk, name: "<b>Próba</b>", system: { requirements: "zgoda <MG>" } });
  assert.match(dialog.content, /Wymagania do sprawdzenia z MG/);
  assert.match(dialog.content, /&lt;MG&gt;/);
  assert.doesNotMatch(dialog.content, /<b>Próba/);
  assert.equal(dialog.yes.label, "Dodaj mimo to");
});

test("przedmioty innych typów nie otwierają okna sztuczki", async () => {
  dialog = null;
  assert.equal(await confirmPerkAddition(actor, { type: "weapon" }), true);
  assert.equal(dialog, null);
});
