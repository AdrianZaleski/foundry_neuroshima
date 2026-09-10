import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { TRAIT_BONUSES } from "../scripts/effects/trait-bonuses.mjs";
import { calculateSkillValue, collectSkillModifierSources } from "../scripts/effects/modifiers.mjs";
import { getFeatureRequirementValues } from "../scripts/sheets/feature-requirements.mjs";
import { checkFeatureRequirements } from "../scripts/effects/background-features.mjs";
import { findDuplicateFeature } from "../scripts/effects/feature-duplicates.mjs";

const catalog = JSON.parse(readFileSync(new URL("../packs/catalogs/traits.json", import.meta.url)));
const perks = JSON.parse(readFileSync(new URL("../packs/catalogs/perks.json", import.meta.url)));

test("Hazardzista z PERK jak w raporcie nalicza trzy premie i współdzieli tożsamość z TRAIT", () => {
  const actor = fixture("TRAIT_HAZARDZISTA");
  const trait = actor.items[0];
  const perk = structuredClone(perks.find(item => item.system.sourceCode === "PERK_HAZARDZISTA"));
  actor.items = [perk];
  for (const key of ["kradziezKieszonkowa", "zwinneDlonie", "otwieranieZamkow"]) {
    assert.equal(calculateSkillValue(actor, key), 2);
    assert.match(collectSkillModifierSources(actor, key)[0].source, /^Sztuczka: /);
  }
  assert.equal(findDuplicateFeature(actor, trait), perk);
  actor.items = [trait];
  assert.equal(findDuplicateFeature(actor, perk), trait);
  actor.items.push(perk);
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 2);
  trait.system.applyMechanicalEffects = false;
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 2);
  perk.system.applyMechanicalEffects = false;
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 0);
});
function fixture(code, base = 0) {
  const item = structuredClone(catalog.find(item => item.system.sourceCode === code));
  assert.ok(item, code);
  return { items: [item], system: { identity: { gender: "female" }, background: {}, attributes: {}, activeModifiers: [],
    skills: Object.fromEntries(TRAIT_BONUSES[code].skills.map(key => [key, { base }]))
  } };
}

test("wszystkie pięć cech stosuje premię lub minimalny poziom z katalogu", () => {
  for (const [code, definition] of Object.entries(TRAIT_BONUSES)) {
    const actor = fixture(code);
    for (const key of definition.skills) {
      assert.equal(calculateSkillValue(actor, key), definition.bonus ?? definition.minimum);
      assert.match(collectSkillModifierSources(actor, key)[0].source, /^Cecha: /);
      assert.equal(actor.system.skills[key].base, 0);
    }
  }
});

test("Hazardzista dodaje 2 do rozwiniętej umiejętności, duplikat nie dubluje premii", () => {
  const actor = fixture("TRAIT_HAZARDZISTA", 5);
  actor.items.push(structuredClone(actor.items[0]));
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 7);
  actor.items[0].system.applyMechanicalEffects = false;
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 7);
  actor.items[1].system.applyMechanicalEffects = false;
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 5);
});

test("minimalny poziom nie obniża wyższego i nie dodaje się do niego", () => {
  const actor = fixture("TRAIT_DOKTORQUINN", 6);
  assert.equal(calculateSkillValue(actor, "pierwszaPomoc"), 6);
  actor.system.skills.pierwszaPomoc.base = 2;
  assert.equal(calculateSkillValue(actor, "pierwszaPomoc"), 4);
  actor.system.activeModifiers.push({ source: "Kara", scope: "skill.pierwszaPomoc", value: -1 });
  assert.equal(calculateSkillValue(actor, "pierwszaPomoc"), 3);
  actor.items = [];
  assert.equal(calculateSkillValue(actor, "pierwszaPomoc"), 1);
});

test("wymagania sztuczki uwzględniają przyznane umiejętności", () => {
  const actor = fixture("TRAIT_WYSZKOLENIE");
  assert.equal(checkFeatureRequirements(actor, "Pistolety 1+", getFeatureRequirementValues(actor)).label, "Wymagania spełnione");
  actor.items = [];
  assert.equal(checkFeatureRequirements(actor, "Pistolety 1+", getFeatureRequirementValues(actor)).label, "Wymagania niespełnione");
});

test("kod cechy na innym typie i nieznana cecha nie przyznają premii", () => {
  const actor = fixture("TRAIT_HAZARDZISTA");
  actor.items[0].type = "perk";
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 0);
  actor.items[0].type = "trait";
  actor.items[0].system.sourceCode = "TRAIT_UNKNOWN";
  assert.equal(calculateSkillValue(actor, "zwinneDlonie"), 0);
});
