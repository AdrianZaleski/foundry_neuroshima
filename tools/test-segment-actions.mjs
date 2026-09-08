import assert from "node:assert/strict";
import { test } from "node:test";
import {
  declareSegmentAction, configureCurrentAiming, markCurrentSegmentActionResolved,
  passSegment, prepareActorCombatStatus
} from "../scripts/combat/segments.mjs";

class ForcedDeletion {}
globalThis.foundry = {
  data: { operators: { ForcedDeletion } },
  utils: { escapeHTML: (value) => value },
  documents: { ChatMessage: { create: async () => {}, getSpeaker: () => ({}) } }
};
globalThis.ui = { notifications: { warn: () => {} } };

// Emulate object merging by Document.setFlag, including preservation of keys
// omitted from the new value. A plain assignment would hide the regression.
function participant(id) {
  const flags = {};
  return {
    id, actor: { id, name: id },
    getFlag: (_scope, key) => flags[key],
    async setFlag(_scope, key, value) {
      flags[key] = { ...flags[key], ...value };
    },
    async update(data) {
      for (const [key, value] of Object.entries(data.flags.neuroshima)) {
        if (value instanceof ForcedDeletion) delete flags[key];
        else flags[key] = value;
      }
    }
  };
}

test("kolejne strzały po pasie nie dziedziczą rozstrzygnięcia ani konfiguracji", async () => {
  const shooter = participant("shooter");
  const target = participant("target");
  let segment = 1;
  const combat = {
    started: true, round: 1, combatant: shooter,
    getFlag: () => segment,
    getCombatantsByActor: (actor) => [shooter, target].filter(p => p.actor === actor)
  };
  globalThis.game = { combat };
  for (let tick = 1; tick <= 4; tick++) {
    combat.round = Math.floor((tick - 1) / 3) + 1;
    segment = ((tick - 1) % 3) + 1;
    combat.combatant = shooter;
    assert.equal(await declareSegmentAction(shooter.actor, "Strzał", 1, {
      actionCode: "shot", effectCode: "rangedShot", requiresTest: true
    }), true);
    const action = shooter.getFlag("neuroshima", "segmentAction");
    for (const key of ["resolved", "resolution", "aimingConfiguration", "interrupted", "jamClearingConfiguration"]) {
      assert.equal(Object.hasOwn(action, key), false, `${key} at tick ${tick}`);
    }
    assert.equal(prepareActorCombatStatus(shooter.actor).action.canConfigureAiming, true);
    await configureCurrentAiming(shooter.actor, { weaponId: `weapon-${tick}`, targetTokenId: "target" });
    assert.equal(prepareActorCombatStatus(shooter.actor).action.canResolveShot, true);
    await markCurrentSegmentActionResolved(shooter.actor, "Trafienie");
    assert.equal(prepareActorCombatStatus(shooter.actor).action.canResolveShot, false);
    assert.equal(await declareSegmentAction(shooter.actor, "Strzał", 1), false);
    combat.combatant = target;
    assert.equal(await passSegment(target.actor), true);
    // Also exercise stale metadata left by interruption and jam clearing.
    await shooter.setFlag("neuroshima", "segmentAction", {
      interrupted: true, jamClearingConfiguration: { weaponId: "old" }
    });
  }
});
