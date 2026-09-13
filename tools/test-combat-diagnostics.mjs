import test from "node:test";
import assert from "node:assert/strict";
import { prepareCombatDiagnostics } from "../scripts/diagnostics/combat-diagnostics.mjs";

test("Raport odróżnia aktywnego strzelca od dwóch uczestników rozliczonego pojedynku", () => {
  const ids = ["AwXQsWFpt01iyqZM", "YtHQOM9avmyoW9L1", "myYvFME3XkYjNibb"];
  const actors = ids.map(id => ({ id, name: id, items: [], system: { skills: {} }, getFlag: () => null }));
  const participants = actors.map((actor, index) => ({ id: `participant${index}`, actor, getFlag: () => null }));
  const duels = [{ hostId: ids[0], trackerRound: 2, configurations: [{ id: ids[0] }, { id: ids[1] }], state: { segment: 4, history: [] } }];
  // Kolejność kolekcji nie musi być kolejnością Inicjatywy, jak w raporcie użytkownika.
  const combat = { id: "combat", started: true, round: 2, turn: 0, combatant: participants[2],
    combatants: participants, turns: [participants[2], participants[0], participants[1]],
    getFlag: (scope, key) => key === "meleeDuels" ? duels : key === "combatSegment" ? 1 : null,
    getCombatantsByActor: actor => participants.filter(participant => participant.actor.id === actor.id) };
  participants.forEach(participant => { participant.parent = combat; });
  globalThis.game = { combat, system: { id: "neuroshima", version: "test" }, user: { targets: [] } };
  globalThis.canvas = { scene: null };
  const report = prepareCombatDiagnostics(actors[2]);
  const shooter = report.combat.combatants[2];
  assert.equal(shooter.actorCombatStatus.canDeclareAction, true);
  assert.equal(shooter.actionBlockReason, null);
  assert.equal(shooter.meleeRoundSpent, false);
  assert.equal(shooter.effectiveSegmentAction, null);
  assert.equal(report.combat.combatants[0].meleeRoundSpent, true);
  assert.equal(report.combat.meleeDuels.length, 1);
  assert.equal(report.combat.meleeBlocksAdvance, false);
  assert.deepEqual(report.combat.turnOrder, ["participant2", "participant0", "participant1"]);
});
