import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { BACKGROUND_BONUSES } from "../scripts/catalogs/background-bonuses.mjs";
import { checkFeatureRequirements, requirementValues } from "../scripts/effects/background-features.mjs";
import { calculateAttributeValue, collectTestModifierSources } from "../scripts/effects/modifiers.mjs";

const actor = () => ({ system: {
  background: { originSourceCode: "ORIGIN_POLUDNIOWAHEGEMONIA", professionSourceCode: "CLASS_MEDYK" },
  attributes: { budowa: { base: 10 }, zrecznosc: { base: 12 } },
  activeModifiers: []
}, items: [] });

test("premia pochodzenia zmienia się bez modyfikacji bazy i kumulowania", () => {
  const a = actor();
  assert.equal(calculateAttributeValue(a, "budowa"), 11);
  assert.equal(calculateAttributeValue(a, "budowa"), 11);
  a.system.background.originSourceCode = "ORIGIN_VEGAS";
  assert.equal(calculateAttributeValue(a, "budowa"), 10);
  assert.equal(calculateAttributeValue(a, "zrecznosc"), 13);
  a.system.background.originSourceCode = "";
  assert.equal(calculateAttributeValue(a, "zrecznosc"), 12);
  assert.equal(a.system.attributes.budowa.base, 10);
});

test("nieznane pochodzenie wymaga jawnego wyboru premii", () => {
  const a = actor();
  a.system.background.originSourceCode = "ORIGIN_UNKNOWN";
  assert.equal(calculateAttributeValue(a, "budowa"), 10);
  a.system.background.originBonusAttribute = "budowa";
  assert.equal(calculateAttributeValue(a, "budowa"), 11);
});

test("wymagania rozróżniają próg, profesję, pochodzenie i nierozpoznany warunek", () => {
  const a = actor();
  const values = requirementValues([["Zręczność", 12], ["Broń ręczna", 5]]);
  assert.equal(checkFeatureRequirements(a, "Zręczność 12+, Broń ręczna 5+", values).label, "Wymagania spełnione");
  assert.equal(checkFeatureRequirements(a, "Zręczność 14+", values).label, "Wymagania niespełnione");
  assert.equal(checkFeatureRequirements(a, "CLASS_MEDYK", values).label, "Wymagania spełnione");
  assert.equal(checkFeatureRequirements(a, "ORIGIN_VEGAS", values).label, "Wymagania niespełnione");
  assert.equal(checkFeatureRequirements(a, "Zręczność lub Budowa 12+", values).label, "Wymaga sprawdzenia przez MG");
});

test("premie cech respektują znak procentów, wyłączenie i usunięcie", () => {
  const a = actor();
  a.items.push({ type: "trait", name: "Próba", system: { effects: "ATR_BUD:2, SKILL_PISTOLETY:10, warunek fabularny" } });
  assert.equal(calculateAttributeValue(a, "budowa"), 13);
  assert.equal(collectTestModifierSources(a, { skillKey: "pistolety" })[0].value, -10);
  a.items[0].system.applyMechanicalEffects = false;
  assert.equal(calculateAttributeValue(a, "budowa"), 11);
  a.items = [];
  assert.equal(collectTestModifierSources(a, { skillKey: "pistolety" }).length, 0);
});

test("parametry tła są zgodne z katalogami źródłowymi", () => {
  const entries = ["origins", "professions"].flatMap(name => JSON.parse(readFileSync(new URL(`../packs/catalogs/${name}.json`, import.meta.url))));
  assert.deepEqual(BACKGROUND_BONUSES.map(e => [e.sourceCode, e.bonus]), entries.map(e => [e.system.sourceCode, e.system.bonus]));
});
