import assert from "node:assert/strict";
import { test } from "node:test";
import { treatInjury } from "../scripts/health/treatment-interface.mjs";

function setup({ cancel = 0, dice = [2, 3, 4], mutate = false } = {}) {
  let inputs = 0;
  const updates = [], messages = [], warnings = [];
  const injury = { id: "wound", uuid: "Actor.patient.Item.wound", type: "injury", name: "Rana", system: { penaltyPercent: 30, injuryType: "light" },
    toObject() { return structuredClone({ system: this.system }); },
    async update(data) { updates.push(data); this.system.penaltyPercent = data["system.penaltyPercent"]; this.system.treatment = data["system.treatment"]; }
  };
  const patient = { uuid: "Actor.patient", name: "Pacjent", isOwner: true, type: "character", items: new Map([["wound", injury]]) };
  const healer = { uuid: "Actor.healer", name: "Medyk", type: "character", isOwner: true, items: [], system: {
    attributes: { spryt: { base: 15 }, zrecznosc: { base: 15 } },
    skills: { pierwszaPomoc: { base: 0 }, leczenieRan: { base: 0 } }, background: {}, activeModifiers: []
  } };
  globalThis.game = { actors: [healer] };
  globalThis.ui = { notifications: { info() {}, warn(text) { warnings.push(text); }, error(text) { throw new Error(text); } } };
  globalThis.foundry = {
    applications: { api: { DialogV2: { input: async () => {
      inputs++;
      if (inputs === cancel) return null;
      return inputs === 1 ? { healer: "0", method: "firstAid", equipment: "0" }
        : { testType: "closed", difficultyIndex: "8", customPenaltyPercent: "0", includeWounds: true, includeArmor: true, includeEffects: true };
    } } } },
    dice: { Roll: class {
      async evaluate() { this.dice = [{ results: dice.map(result => ({ result })) }]; if (mutate) injury.system.penaltyPercent++; return this; }
      async toMessage(message) { messages.push(message); }
    } },
    documents: { ChatMessage: { getSpeaker: ({ actor }) => ({ alias: actor.name }), create: async message => messages.push(message) } }
  };
  return { patient, injury, updates, messages, warnings };
}

test("przebieg testu medyka zmienia wyłącznie wskazaną ranę i zapisuje historię", async () => {
  const state = setup();
  await treatInjury(state.patient, "wound");
  assert.deepEqual(state.warnings, []);
  assert.equal(state.updates.length, 1);
  assert.equal(state.injury.system.penaltyPercent, 25);
  assert.equal(state.injury.system.treatment.history[0].healer, "Medyk");
  assert.equal(state.injury.system.treatment.history[0].difficulty, 1);
  assert.equal(state.messages.length, 2);
});

test("anulowanie dowolnego okna nie zapisuje zabiegu", async () => {
  for (const cancel of [1, 2]) {
    const state = setup({ cancel });
    await treatInjury(state.patient, "wound");
    assert.equal(state.updates.length, 0);
    assert.equal(state.messages.length, 0);
  }
});

test("porażka zwiększa karę i licznik prób", async () => {
  const state = setup({ dice: [18, 18, 18] });
  await treatInjury(state.patient, "wound");
  assert.deepEqual(state.warnings, []);
  assert.equal(state.injury.system.penaltyPercent, 35);
  assert.equal(state.injury.system.treatment.firstAidFailures, 1);
});

test("zmiana rany podczas rzutu blokuje nadpisanie jej danych", async () => {
  const state = setup({ mutate: true });
  await treatInjury(state.patient, "wound");
  assert.equal(state.updates.length, 0);
  assert.match(state.warnings[0], /zmieniła się/);
});
