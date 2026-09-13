import test from "node:test";
import assert from "node:assert/strict";
import { openMeleeDuel } from "../scripts/combat/melee-interface.mjs";
import { findTrackedDuel, meleeTrackerAction } from "../scripts/combat/melee-tracker.mjs";

function setup(answers, isGM = true, diceSequence = []) {
  const writes = [], messages = [], warnings = [], dialogs = [];
  let stored = null, rolls = 0;
  const actor = id => ({ id, name: id, type: "character", items: [], system: {
    attributes: { zrecznosc: { base: 12 }, budowa: { base: 12 } },
    skills: { bijatyka: { base: 2 } }, activeModifiers: [], background: {}
  }, getFlag: () => stored, setFlag: async (system, key, value) => { stored = structuredClone(value); writes.push(value); } });
  const host = actor("a"), opponent = actor("b");
  const actors = [host, opponent];
  actors.get = id => actors.find(entry => entry.id === id);
  globalThis.game = { actors, user: { isGM: isGM, id: "gm" } };
  globalThis.ui = { notifications: { warn: message => warnings.push(message) } };
  globalThis.foundry = { applications: { api: { DialogV2: {
    input: async options => { dialogs.push(options); return answers.shift() ?? null; }, confirm: async () => true
  } } }, dice: { Roll: class {
    async evaluate() { rolls++; this.dice = [{ results: (diceSequence.shift() ?? [3, 6, 19]).map(result => ({ result })) }]; return this; }
    async toMessage(message) { messages.push(message); }
  } }, documents: { ChatMessage: { getSpeaker: ({ actor }) => ({ alias: actor?.name ?? "MG" }), create: async message => messages.push(message) } } };
  return { host, writes, messages, warnings, dialogs, state: () => stored, rolls: () => rolls };
}
const start = [{ opponent: "b" }, { weapon0: "", weapon1: "", skill0: "bijatyka", skill1: "bijatyka", initiative: "a" }, { maneuver0: "standard", maneuver1: "standard", tempo0: "0" }];

test("Przypadek ze screena: 15, 3, 13 przeciw progowi 6 pozwala rozegrać całą rundę", async () => {
  const environment = setup([...start,
    { action: "points" }, { fighterId: "a", targetId: "a", die: "1", points: "3" },
    { action: "exchange" }, { attackDie: "1", defenseDie: "0" },
    { action: "exchange" }, { attackDie: "0", defenseDie: "1" },
    { action: "exchange" }, { attackDie: "2", defenseDie: "2" }
  ], true, [[18, 3, 13], [16, 8, 18]]);
  environment.host.system.attributes.zrecznosc.base = 6;
  environment.host.system.skills.bijatyka.base = 3;
  game.actors.get("b").system.attributes.zrecznosc.base = 1;
  game.actors.get("b").system.skills.bijatyka.base = 0;
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.segment, 4);
  const exchanges = environment.state().state.history.filter(entry => entry.type === "exchange");
  assert.deepEqual(exchanges.map(entry => entry.hit), [true, false, false]);
  const panels = environment.dialogs.filter(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.equal(panels.some(dialog => dialog.content.includes('value="combined"')), false);
  assert.ok(panels.some(dialog => dialog.content.includes("18 → 15 — porażka")));
  assert.ok(panels.some(dialog => dialog.content.includes("3 → 3 — sukces")));
});

test("Panel zapisuje cios i wznawia bez ponownego rzutu", async () => {
  const environment = setup([...start, { action: "exchange" }, { attackDie: "0", defenseDie: "2" }]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.segment, 2);
  assert.equal(environment.state().state.history[0].hit, true);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.messages.length, 3);
  await openMeleeDuel(environment.host);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.state().state.segment, 2);
});

test("Anulowanie ustawień nie rzuca kości i niczego nie zapisuje", async () => {
  for (const answers of [[], [start[0]]]) {
    const environment = setup(answers);
    await openMeleeDuel(environment.host);
    assert.equal(environment.writes.length, 0);
    assert.equal(environment.rolls(), 0);
  }
});

test("Nieprawidłowy wybór kości nie zużywa segmentu", async () => {
  const environment = setup([...start, { action: "exchange" }, { attack0: true }]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.state().state.segment, 1);
  assert.equal(environment.writes.length, 2);
  assert.equal(environment.warnings.length, 1);
});

test("Przegrana Szarża daje karę pierwszej tury i nie zabiera puli punktów walki", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll", charge0: "3" }, start[2]],
    true, [[17, 18, 19], [2, 3, 4]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().opening.winnerId, "b");
  assert.equal(environment.state().state.fighters[0].chargePenalty, 3);
  assert.equal(environment.state().state.fighters[0].spent, 0);
  assert.equal(environment.rolls(), 4);
});

test("Wygrana Szarża daje premię Inicjatywy bez premii do późniejszych ciosów", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll", charge0: "2" }, start[2]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().opening.winnerId, "a");
  assert.equal(environment.state().state.fighters[0].chargePenalty, 0);
  assert.equal(environment.rolls(), 4);
});

test("Remis zachowuje deklaracje i wymaga powtórzenia obu rzutów", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll" }, {}, start[2]],
    true, [[3, 6, 19], [3, 6, 19], [3, 4, 5], [15, 16, 17]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().opening.attempts.length, 2);
  assert.equal(environment.state().opening.winnerId, "a");
  assert.equal(environment.rolls(), 6);
});

test("Zamknięcie przed manewrami zachowuje rozstrzygniętą Inicjatywę", async () => {
  const answers = [start[0], { ...start[1], initiativeMode: "roll", charge0: "1" }, null];
  const environment = setup(answers);
  await openMeleeDuel(environment.host);
  assert.equal(environment.state().state, null);
  assert.equal(environment.rolls(), 2);
  answers.push(start[2]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.rolls(), 4);
  assert.equal(environment.state().opening.attempts.length, 1);
});

test("Szarżujący nie może wybrać Pełnej obrony nawet po wygranej", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll", charge0: "1" },
    { maneuver0: "fullDefense" }, start[2]]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.warnings.length, 1);
  assert.match(environment.warnings[0], /Szarża/);
  assert.equal(environment.state().state.fighters[0].maneuver, "standard");
});

test("Wydatek punktów pozostaje po zamknięciu panelu", async () => {
  const environment = setup([...start, { action: "points" }, { fighterId: "a", targetId: "b", die: "1", points: "2" }]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.fighters[0].spent, 2);
  assert.equal(environment.state().state.fighters[1].dice[0].value, 5);
});

test("Gracz nie może prowadzić panelu MG", async () => {
  const environment = setup([...start], false);
  await openMeleeDuel(environment.host);
  assert.equal(environment.writes.length, 0);
  assert.equal(environment.rolls(), 0);
});

test("Zwiększone tempo podnosi PT obu stron, Furia dodaje bonus tylko do ataku", async () => {
  const environment = setup([...start.slice(0, 2), { maneuver0: "fury", maneuver1: "fullDefense", tempo0: "2" },
    { action: "exchange" }, { attackDie: "0", defenseDie: "1" }]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  const exchange = environment.state().state.history[0];
  assert.equal(exchange.attackThreshold, 9);
  assert.equal(exchange.defenseThreshold, 9);
  assert.equal(environment.state().state.tempo, 2);
  assert.match(environment.messages[0].flavor, /Furia/);
});

test("Błędna deklaracja nie rzuca kości; można poprawić wybór przed turą", async () => {
  const environment = setup([...start.slice(0, 2), { maneuver0: "fullDefense", tempo0: "1" },
    { maneuver0: "standard", maneuver1: "standard", tempo0: "1" }]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.warnings.length, 1);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.state().state.tempo, 1);
});

test("Anulowanie deklaracji następnej tury zachowuje stare kości", async () => {
  const answers = [...start, { action: "exchange" }, { attackDie: "0", defenseDie: "0" },
    { action: "exchange" }, { attackDie: "1", defenseDie: "1" },
    { action: "exchange" }, { attackDie: "2", defenseDie: "2" }, { action: "next" }, null];
  const environment = setup(answers);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.state().state.segment, 4);
  assert.equal(environment.state().state.round, 1);
});

function attachCombat() {
  const flags = { combatSegment: 1, meleeDuels: [] };
  const participants = game.actors.map(actor => ({ id: actor.id, actor, getFlag: () => null }));
  const combat = { started: true, round: 1, turn: 0, combatants: participants, turns: participants,
    get combatant() { return participants[this.turn]; },
    getFlag: (scope, key) => flags[key],
    async setFlag(scope, key, value) { flags[key] = structuredClone(value); },
    async update(data) {
      if (data.turn !== undefined) this.turn = data.turn;
      if (data["flags.neuroshima.combatSegment"] !== undefined) flags.combatSegment = data["flags.neuroshima.combatSegment"];
      return this;
    } };
  foundry.documents.Combat = class {
    async nextTurn() { this.turn++; return this; }
    async nextRound() { this.round++; this.turn = 0; return this; }
  };
  game.combat = combat;
  return combat;
}

test("Panel Trackera zapisuje jedną wymianę obu postaci i wznawia z karty przeciwnika", async () => {
  const answers = [...start, { action: "exchange" }, { attackDie: "0", defenseDie: "2" }];
  const environment = setup(answers);
  const combat = attachCombat();
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.writes.length, 0);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 2);
  assert.equal(meleeTrackerAction(combat, "a").duration, 1);
  assert.equal(meleeTrackerAction(combat, "b").duration, 1);
  await openMeleeDuel(game.actors.get("b"));
  assert.equal(environment.rolls(), 2);
  // Kolejna wymiana odbywa się nadal w pierwszym segmencie Trackera.
  answers.push({ action: "exchange" }, { attackDie: "1", defenseDie: "0" });
  await openMeleeDuel(game.actors.get("b"));
  assert.equal(findTrackedDuel(combat, "a").state.segment, 3);
  assert.equal(combat.getFlag("neuroshima", "combatSegment"), 1);
  assert.equal(environment.rolls(), 2);
});

test("Nowa runda Trackera daje nowe kości dopiero po deklaracji manewrów", async () => {
  const answers = [...start, { action: "combined" }, { attack0: true, attack1: true, attack2: true, defense0: true, defense1: true, defense2: true }];
  const environment = setup(answers, true, [[2, 3, 4], [12, 13, 14]]);
  const combat = attachCombat();
  await openMeleeDuel(environment.host);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 4);
  assert.equal(environment.rolls(), 2);
  assert.equal(combat.round, 2);
  combat.round = 2;
  answers.push({ action: "next" }, start[2]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(findTrackedDuel(combat, "a").trackerRound, 2);
  assert.equal(findTrackedDuel(combat, "a").state.round, 2);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 1);
  assert.equal(environment.rolls(), 4);
});
