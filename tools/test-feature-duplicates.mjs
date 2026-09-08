import assert from "node:assert/strict";
import { test } from "node:test";
import { findDuplicateFeature, initializeFeatureDuplicateGuard } from "../scripts/effects/feature-duplicates.mjs";

const trait = { type: "trait", name: "Hazardzista", system: { sourceCode: "TRAIT_HAZARDZISTA" } };
test("ta sama cecha jest rozpoznawana po kodzie mimo zmiany nazwy", () => {
  const actor = { items: [trait] };
  assert.equal(findDuplicateFeature(actor, { ...trait, name: "Inna nazwa" }), trait);
  assert.equal(findDuplicateFeature(actor, { ...trait, system: { sourceCode: "TRAIT_INNA" } }), null);
});
test("własne cechy i sztuczki są rozpoznawane po nazwie", () => {
  const perk = { type: "perk", name: "Aramis", system: {} };
  assert.equal(findDuplicateFeature({ items: [perk] }, { ...perk, name: " aramis " }), perk);
  assert.equal(findDuplicateFeature({ items: [trait] }, { type: "weapon", name: "Hazardzista" }), null);
});
test("blokada zatrzymuje zapis duplikatu na Actorze, pozwala na katalog i nową cechę", () => {
  let callback;
  globalThis.Hooks = { on: (name, handler) => { assert.equal(name, "preCreateItem"); callback = handler; } };
  globalThis.ui = { notifications: { warn: () => {} } };
  initializeFeatureDuplicateGuard();
  const parent = { documentName: "Actor", name: "Test", items: [trait] };
  assert.equal(callback({ ...trait, parent }), false);
  assert.equal(callback(trait), undefined);
  parent.items = [];
  assert.equal(callback({ ...trait, parent }), undefined);
});
