export function fixture({ inCombat = true, reloadTime = 3 } = {}) {
  class ForcedDeletion {}
  function update(object, changes) {
    for (const [key, value] of Object.entries(changes)) {
      const path = key.split("."); const last = path.pop();
      const target = path.reduce((o, part) => o[part] ??= {}, object);
      if (value instanceof ForcedDeletion) delete target[last];
      else target[last] = structuredClone(value);
    }
  }
  const item = (id, type, system) => ({ id, name: id, type, system, flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; }, async update(data) { update(this, data); } });
  const gun = item("gun", "weapon", { weaponClass: "PISTOL", requiresPreparation: true, prepared: false, safetyOn: false,
    needsCycling: false, requiredHands: 1, jamState: "ready", ammunitionCode: "9mm",
    currentAmmunition: 0, magazineCapacity: 10, loadedAmmunitionSourceCode: "", reloadTime });
  const ammo = item("ammo", "ammunition", { ammunitionSymbol: "9mm", quantity: 20, sourceCode: "AMMO_9",
    unitWeightInKilograms: 0.02 });
  const items = [gun, ammo]; items.get = id => items.find(item => item.id === id);
  const messages = [], warnings = [], dialogs = [], writes = [];
  let answers = [], nextId = 0;
  const actor = { id: "actor", uuid: "Actor.actor", name: "Postać", isOwner: true, items,
    flags: {}, system: { hands: { left: "", right: "" } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(data) { writes.push(data); update(this, data); },
    async updateEmbeddedDocuments(type, changes) { writes.push(changes); changes.forEach(data => update(items.get(data._id), data)); } };
  const combatant = { id: "participant", actor, flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, value) { this.flags[scope] ??= {}; this.flags[scope][key] = { ...this.flags[scope][key], ...structuredClone(value) }; },
    async update(data) { for (const [key, value] of Object.entries(data.flags.neuroshima)) {
      this.flags.neuroshima ??= {}; if (value instanceof ForcedDeletion) delete this.flags.neuroshima[key];
      else this.flags.neuroshima[key] = value;
    } } };
  const combat = { started: inCombat, round: 1, turn: 0, combatant, turns: [combatant], combatants: [combatant],
    flags: { combatSegment: 1 }, getFlag(scope, key) { return this.flags[key]; },
    async setFlag(scope, key, value) { this.flags[key] = value; },
    getCombatantsByActor: value => value === actor ? [combatant] : [],
    async update(changes) { if (changes.round) this.round = changes.round; this.turn = changes.turn ?? this.turn;
      if (changes["flags.neuroshima.combatSegment"]) this.flags.combatSegment = changes["flags.neuroshima.combatSegment"];
      return this; } };
  globalThis.game = { combat: inCombat ? combat : null, user: { isGM: true } };
  globalThis.foundry = { data: { operators: { ForcedDeletion } }, utils: { escapeHTML: String, randomID: () => `action${++nextId}` },
    applications: { api: { DialogV2: { input: async options => { dialogs.push(options); return answers.shift() ?? null; } } } },
    documents: { ChatMessage: { getSpeaker: () => ({}), create: async data => messages.push(data) }, Combat: class {
      async nextRound() { this.round++; this.turn = 0; return this; }
      async nextTurn() { this.turn++; return this; }
    } } };
  globalThis.ui = { notifications: { warn: text => warnings.push(text), info: text => messages.push(text) } };
  const action = () => combatant.getFlag("neuroshima", "segmentAction");
  const reply = (...values) => { answers = values; };
  return { actor, gun, ammo, combat, combatant, writes, messages, warnings, dialogs, action, reply };
}


