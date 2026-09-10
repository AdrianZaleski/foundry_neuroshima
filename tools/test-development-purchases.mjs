import assert from "node:assert/strict";
import { test } from "node:test";
import { quoteDevelopment, prepareDevelopmentPurchase } from "../scripts/development/purchases.mjs";
import { DEVELOPMENT_COSTS } from "../scripts/development/costs.mjs";
// Ceny wyłącznie testowe, nie są tabelą zasad Neuroshimy.
const costs = { skills: { 1: 20 }, specializedSkills: { 1: 10 }, attributes: { 11: 50 } };
const actor = () => ({ system: { background: { specializationSourceCode: "SPEC_WARRIOR" },
  skills: { pistolety: { base: 0, value: 2 }, mechanika: { base: 0 } },
  attributes: { budowa: { base: 10, value: 11 } }, development: { experiencePoints: 50, history: [] } } });
const metadata = { id: "test", timestamp: "2026-09-10", label: "Pistolety", userId: "test" };

test("tabela odpowiada podręcznikowi, Specjalizacja zachowuje koszt pierwszego poziomu", () => {
  assert.equal(DEVELOPMENT_COSTS.skills[9], 900);
  assert.equal(DEVELOPMENT_COSTS.skills[12], 2400);
  assert.equal(DEVELOPMENT_COSTS.skills[20], 4000);
  assert.equal(DEVELOPMENT_COSTS.specializedSkills[1], 200);
  assert.equal(DEVELOPMENT_COSTS.specializedSkills[9], 720);
  assert.equal(DEVELOPMENT_COSTS.attributes[16], 3200);
  assert.equal(DEVELOPMENT_COSTS.attributes[20], 6000);
  assert.equal(DEVELOPMENT_COSTS.attributes[21], 6300);
  assert.equal(DEVELOPMENT_COSTS.attributes[5], undefined);
});

test("limit dotyczy danej wartości po sesji; kolejna sesja go zwalnia", () => {
  const a = actor();
  a.system.development.session = 1;
  a.system.development.history = [{ kind: "skills", key: "pistolety", session: 1 }];
  assert.throws(() => quoteDevelopment(a, "skills", "pistolety", costs), /już podniesiona/);
  a.system.development.ignoreSessionLimit = true;
  assert.equal(quoteDevelopment(a, "skills", "pistolety", costs).cost, 10);
  a.system.development.ignoreSessionLimit = false;
  assert.throws(() => quoteDevelopment(a, "skills", "pistolety", costs), /już podniesiona/);
  assert.equal(quoteDevelopment(a, "skills", "mechanika", costs).cost, 20);
  a.system.development.session = 2;
  assert.equal(quoteDevelopment(a, "skills", "pistolety", costs).cost, 10);
});

test("wycena uwzględnia Specjalizację i nie kupuje bonusów z efektów", () => {
  const a = actor();
  assert.equal(quoteDevelopment(a, "skills", "pistolety", costs).cost, 10);
  assert.equal(quoteDevelopment(a, "skills", "mechanika", costs).cost, 20);
  assert.equal(quoteDevelopment(a, "attributes", "budowa", costs).to, 11);
});
test("poziom, PD i historia są przygotowane do wspólnego zapisu", () => {
  const a = actor();
  const data = prepareDevelopmentPurchase(a, quoteDevelopment(a, "skills", "pistolety", costs), costs, metadata);
  assert.equal(data["system.skills.pistolety.base"], 1);
  assert.equal(data["system.development.experiencePoints"], 40);
  assert.equal(data["system.development.history"][0].cost, 10);
  assert.equal(a.system.development.experiencePoints, 50);
});
test("brak tabeli, brak PD i nieaktualna wycena blokują zakup", () => {
  const a = actor();
  assert.throws(() => quoteDevelopment(a, "skills", "pistolety", {}), /Brak zatwierdzonego/);
  const quote = quoteDevelopment(a, "skills", "pistolety", costs);
  a.system.development.experiencePoints = 0;
  assert.throws(() => prepareDevelopmentPurchase(a, quote, costs, metadata), /zmieniły/);
  assert.throws(() => prepareDevelopmentPurchase(a, quoteDevelopment(a, "skills", "pistolety", costs), costs, metadata), /Za mało/);
});
