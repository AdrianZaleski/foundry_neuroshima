import assert from "node:assert/strict";
import { test } from "node:test";
import { purchaseDevelopment } from "../scripts/development/interface.mjs";

test("anulowanie nic nie zapisuje, potwierdzenie zapisuje razem poziom, PD i historię", async () => {
  let confirmed = false;
  const updates = [];
  globalThis.game = { user: { id: "gm" } };
  globalThis.ui = { notifications: { info: () => {}, warn: message => { throw new Error(message); } } };
  globalThis.foundry = { utils: { randomID: () => "purchase" }, applications: { api: { DialogV2: {
    input: async () => ({ choice: "0" }), confirm: async () => confirmed
  } } } };
  const actor = { uuid: "Actor.test", isOwner: true, update: async data => updates.push(data), system: {
    attributes: {}, skills: { pistolety: { base: 0 } }, background: { specializationSourceCode: "SPEC_WARRIOR" },
    development: { experiencePoints: 300, history: [], session: 1 }
  } };
  await purchaseDevelopment(actor);
  assert.equal(updates.length, 0);
  confirmed = true;
  await purchaseDevelopment(actor);
  assert.equal(updates.length, 1);
  assert.equal(updates[0]["system.skills.pistolety.base"], 1);
  assert.equal(updates[0]["system.development.experiencePoints"], 100);
  assert.equal(updates[0]["system.development.history"][0].session, 1);
});
