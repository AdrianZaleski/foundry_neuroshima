import test from "node:test";
import assert from "node:assert/strict";
import { saveActorNickname } from "../scripts/sheets/actor-name.mjs";

test("Ponowny zapis tej samej ksywki naprawia wzorzec, sceny i Tracker", async () => {
  const actor = { id: "a", name: "Nowa", async update(data) { this.saved = data; } };
  const scene = { tokens: [{ id: "t", actorId: "a", name: "Stara" }, { id: "other", actorId: "b", name: "Stara" }],
    async updateEmbeddedDocuments(type, updates) { this.saved = updates; } };
  const combat = { combatants: [{ id: "c", actorId: "a", name: "Stara" }],
    async updateEmbeddedDocuments(type, updates) { this.saved = updates; } };
  globalThis.game = { scenes: [scene], combats: [combat] };
  await saveActorNickname(actor, "Nowa");
  assert.deepEqual(actor.saved, { name: "Nowa", "prototypeToken.name": "Nowa" });
  assert.deepEqual(scene.saved, [{ _id: "t", name: "Nowa" }]);
  assert.deepEqual(combat.saved, [{ _id: "c", name: "Nowa" }]);
});

test("Zapis z tokenu naprawia też źródłowego Actora i lokalne nazwy innych kopii", async () => {
  const token = { id: "t", actorId: "a", name: "Stara", parent: { id: "s" } };
  const actor = { id: "a", isToken: true, token, name: "Nowa", async update(data) { this.saved = data; } };
  token.actor = actor;
  const source = { id: "a", name: "Stara", async update(data) { this.saved = data; } };
  const copy = { id: "a", isToken: true, name: "Stara", async update(data) { this.saved = data; } };
  const scene = { tokens: [token, { id: "t2", actorId: "a", name: "Stara", actor: copy }],
    async updateEmbeddedDocuments(type, updates) { this.saved = updates; } };
  const combat = { combatants: [{ id: "c", actorId: "a", tokenId: "t", sceneId: "s", name: "Stara" },
    { id: "other", actorId: "a", tokenId: "t2", sceneId: "s", name: "Stara" }],
    async updateEmbeddedDocuments(type, updates) { this.saved = updates; } };
  globalThis.game = { actors: new Map([["a", source]]), scenes: [scene], combats: [combat] };
  await saveActorNickname(actor, " Nowa ");
  assert.deepEqual(actor.saved, { name: "Nowa" });
  assert.deepEqual(source.saved, { name: "Nowa", "prototypeToken.name": "Nowa" });
  assert.deepEqual(copy.saved, { name: "Nowa" });
  assert.deepEqual(scene.saved, [{ _id: "t", name: "Nowa" }, { _id: "t2", name: "Nowa" }]);
  assert.deepEqual(combat.saved, [{ _id: "c", name: "Nowa" }, { _id: "other", name: "Nowa" }]);
});
