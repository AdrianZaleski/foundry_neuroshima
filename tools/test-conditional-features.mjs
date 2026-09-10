import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateAttributeValue } from "../scripts/effects/modifiers.mjs";

test("Umysł kupca włącza komplet premii i kar, wyłączenie przywraca bazę", () => {
  const item = { type: "trait", name: "Umysł kupca", system: { sourceCode: "TRAIT_UMYSLKUPCA" } };
  const actor = { items: [item], system: { background: {}, activeModifiers: [],
    attributes: Object.fromEntries(["spryt", "charakter", "budowa", "zrecznosc", "percepcja"].map(key => [key, { base: 10 }])) } };
  assert.equal(calculateAttributeValue(actor, "spryt"), 10);
  item.system.conditionalEffectActive = true;
  for (const key of Object.keys(actor.system.attributes)) {
    assert.equal(calculateAttributeValue(actor, key), ["spryt", "charakter"].includes(key) ? 12 : 9);
    assert.equal(actor.system.attributes[key].base, 10);
  }
  actor.items.push(structuredClone(item));
  assert.equal(calculateAttributeValue(actor, "spryt"), 12);
  actor.items.pop();
  item.system.conditionalEffectActive = false;
  assert.equal(calculateAttributeValue(actor, "spryt"), 10);
  assert.equal(calculateAttributeValue(actor, "budowa"), 10);
  item.system.conditionalEffectActive = true;
  item.system.applyMechanicalEffects = false;
  assert.equal(calculateAttributeValue(actor, "spryt"), 10);
  actor.items = [];
  assert.equal(calculateAttributeValue(actor, "spryt"), 10);
});
