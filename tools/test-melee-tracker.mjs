import test from "node:test";
import assert from "node:assert/strict";
import { createMeleeRound, resolveMeleeExchange } from "../scripts/combat/melee.mjs";
import { assertTrackerStart, assertTrackerExchange, assertTrackerNextRound,
  meleeTrackerAction, blocksMeleeAdvance } from "../scripts/combat/melee-tracker.mjs";
import { passSegment, prepareActorCombatStatus, advanceSegmentTurn, advanceSegmentRound } from "../scripts/combat/segments.mjs";

function setup() {
  const flags = { combatSegment: 1, meleeDuels: [] };
  const participants = ["a", "b", "c"].map(id => ({ id, actor: { id, name: id }, getFlag: () => null }));
  const combat = { started: true, round: 1, turn: 0, combatants: participants, turns: participants,
    get combatant() { return participants[this.turn]; },
    getFlag: (scope, key) => flags[key],
    getCombatantsByActor: actor => participants.filter(participant => participant.actor.id === actor.id),
    async setFlag(scope, key, value) { flags[key] = value; },
    async update(data) {
      if (data.turn !== undefined) this.turn = data.turn;
      if (data["flags.neuroshima.combatSegment"] !== undefined) flags.combatSegment = data["flags.neuroshima.combatSegment"];
      return this;
    } };
  participants.forEach(participant => { participant.parent = combat; });
  const duel = { hostId: "a", trackerRound: 1, configurations: [{ id: "a" }, { id: "b" }],
    state: createMeleeRound({ initiative: "a", fighters: [{ id: "a", skill: 0, dice: [2, 3, 4] }, { id: "b", skill: 0, dice: [12, 13, 14] }] }) };
  const warnings = [];
  globalThis.ui = { notifications: { warn: value => warnings.push(value) } };
  globalThis.game = { combat };
  globalThis.foundry = { documents: { Combat: class {
    async nextTurn() { this.turn++; return this; }
    async nextRound() { this.round++; this.turn = 0; return this; }
  }, ChatMessage: { create: async () => {}, getSpeaker: () => ({}) } }, utils: { escapeHTML: value => value } };
  return { combat, flags, duel, participants, warnings };
}

test("Łączenie wymaga wolnych postaci i pierwszego segmentu", () => {
  const { combat, flags, duel } = setup();
  assert.doesNotThrow(() => assertTrackerStart(combat, duel));
  flags.combatSegment = 2;
  assert.throws(() => assertTrackerStart(combat, duel));
  flags.combatSegment = 1;
  combat.turn = 1;
  assert.throws(() => assertTrackerStart(combat, duel));
  combat.turn = 0;
  flags.meleeDuels = [duel];
  assert.throws(() => assertTrackerStart(combat, duel));
});

test("Cios za trzy segmenty zajmuje oba tokeny od pierwszego segmentu", async () => {
  const { combat, flags, duel, participants } = setup();
  duel.state = resolveMeleeExchange(duel.state, { attackDice: [0, 1, 2], defenseDice: [0, 1, 2], attackThreshold: 12, defenseThreshold: 12 }).state;
  flags.meleeDuels = [duel];
  for (const segment of [1, 2, 3]) {
    flags.combatSegment = segment;
    for (const participant of participants.slice(0, 2)) {
      combat.turn = participants.indexOf(participant);
      assert.equal(meleeTrackerAction(combat, participant.actor.id).endsAtTick, 3);
      const status = prepareActorCombatStatus(participant.actor, combat);
      assert.equal(status.canDeclareAction, false);
      assert.equal(status.action.canFinishEarly, false);
      assert.equal(await passSegment(participant.actor), false);
    }
  }
  assert.equal(meleeTrackerAction(combat, "c"), null);
});

test("Tracker nie pomija nierozstrzygniętej wymiany ani całej tury", async () => {
  const { combat, flags, duel, warnings } = setup();
  flags.meleeDuels = [duel];
  assert.equal(blocksMeleeAdvance(combat), true);
  await advanceSegmentTurn(combat);
  assert.equal(combat.turn, 0);
  combat.turn = 2;
  assert.equal(blocksMeleeAdvance(combat), false);
  await advanceSegmentRound(combat);
  assert.equal(combat.round, 1);
  assert.equal(warnings.length, 2);
});

test("Wymiana jest dostępna tylko we właściwym segmencie i kolejce uczestników", () => {
  const { combat, duel, flags } = setup();
  assert.doesNotThrow(() => assertTrackerExchange(combat, duel));
  combat.turn = 2;
  assert.throws(() => assertTrackerExchange(combat, duel));
  combat.turn = 0;
  flags.combatSegment = 2;
  assert.throws(() => assertTrackerExchange(combat, duel));
});

test("Nowa pula dopiero w następnej rundzie; zakończenie nie zwraca segmentów", () => {
  const { combat, flags, duel } = setup();
  duel.state = resolveMeleeExchange(duel.state, { attackDice: [0, 1, 2], defenseDice: [0, 1, 2], attackThreshold: 12, defenseThreshold: 12 }).state;
  flags.meleeDuels = [duel];
  assert.throws(() => assertTrackerNextRound(combat, duel));
  duel.ended = true;
  assert.equal(meleeTrackerAction(combat, "a").duration, 3);
  assert.equal(blocksMeleeAdvance(combat), false);
  combat.round = 2;
  assert.doesNotThrow(() => assertTrackerNextRound(combat, duel));
  assert.equal(meleeTrackerAction(combat, "a"), null);
  duel.ended = false;
  assert.equal(blocksMeleeAdvance(combat), true);
});

test("Trzy osobne ciosy rozliczają się bez zmiany segmentu Trackera", async () => {
  const { combat, flags, duel } = setup();
  flags.meleeDuels = [duel];
  for (let index = 0; index < 3; index++) {
    assert.doesNotThrow(() => assertTrackerExchange(combat, duel));
    duel.state = resolveMeleeExchange(duel.state, { attackDice: [index], defenseDice: [index], attackThreshold: 12, defenseThreshold: 12 }).state;
    if (index < 2) {
      await advanceSegmentTurn(combat);
      assert.equal(combat.turn, 0);
      assert.equal(flags.combatSegment, 1);
    }
  }
  await advanceSegmentTurn(combat);
  assert.equal(combat.combatant.actor.id, "c");
  assert.equal(flags.combatSegment, 1);
});

test("Walka mieszana: pozostały uczestnik ma kolejkę w każdym segmencie", async () => {
  const { combat, flags, duel } = setup();
  duel.state = resolveMeleeExchange(duel.state, { attackDice: [0, 1, 2], defenseDice: [0, 1, 2], attackThreshold: 12, defenseThreshold: 12 }).state;
  flags.meleeDuels = [duel];
  for (const segment of [1, 2, 3]) {
    await advanceSegmentTurn(combat);
    assert.equal(combat.combatant.actor.id, "c");
    assert.equal(flags.combatSegment, segment);
    assert.equal(combat.round, 1);
  }
  await advanceSegmentTurn(combat);
  assert.equal(combat.round, 2);
  assert.equal(combat.combatant.actor.id, "a");
  assert.equal(blocksMeleeAdvance(combat), true);
});
