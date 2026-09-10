import assert from "node:assert/strict";
import { test } from "node:test";
import { SKILL_GROUPS } from "../scripts/catalogs/skill-specializations.mjs";
import { calculateSkillValue } from "../scripts/effects/modifiers.mjs";
import { checkFeatureRequirements } from "../scripts/effects/background-features.mjs";
const actor = item => ({ items: [item], system: { identity: {}, background: {}, activeModifiers: [], skills: Object.fromEntries(Object.values(SKILL_GROUPS).flat().map(key => [key, { base: 0 }])) } });

test("wybór pakietu przenosi +2 i nie akceptuje pakietu spoza listy", () => {
  for (const type of ["trait", "perk"]) {
    const item = { type, name: "Urodzony morderca", system: { sourceCode: `${type.toUpperCase()}_URODZONYMORDERCA` } };
    const a = actor(item);
    assert.equal(calculateSkillValue(a, "pistolety"), 0);
    item.system.selectedSkillGroup = "bronStrzelecka";
    assert.equal(calculateSkillValue(a, "pistolety"), 2);
    item.system.selectedSkillGroup = "silaWoli";
    assert.equal(calculateSkillValue(a, "pistolety"), 0);
    assert.equal(calculateSkillValue(a, "morale"), 2);
    item.system.selectedSkillGroup = "medycyna";
    assert.equal(calculateSkillValue(a, "pierwszaPomoc"), 0);
  }
});

test("Doktor Quinn wymaga kobiety, także w wersji sztuczki; wyjątek jest jawny", () => {
  for (const type of ["trait", "perk"]) {
    const item = { type, name: "Doktor Quinn", system: { sourceCode: `${type.toUpperCase()}_DOKTORQUINN` } };
    const a = actor(item);
    for (const gender of ["", "male", "other"]) {
      a.system.identity.gender = gender;
      assert.equal(calculateSkillValue(a, "pierwszaPomoc"), 0);
      assert.equal(checkFeatureRequirements(a, "", {}, item).label, "Wymagania niespełnione");
    }
    a.system.identity.gender = "female";
    assert.equal(calculateSkillValue(a, "pierwszaPomoc"), 4);
    a.system.identity.gender = "male";
    item.system.ignoreGenderRequirement = true;
    assert.equal(calculateSkillValue(a, "pierwszaPomoc"), 4);
    item.system.applyMechanicalEffects = false;
    assert.equal(calculateSkillValue(a, "pierwszaPomoc"), 0);
  }
});
