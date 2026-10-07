import { test } from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./burst-test-fixture.mjs";
import { declareSegmentAction, selectSegmentAction, prepareActorCombatStatus, advanceSegmentTurn, interruptUnconsciousActions } from "../scripts/combat/segments.mjs";
import { startWeaponShot, resolveSingleShot } from "../scripts/combat/ranged-shot.mjs";
import { requestWeaponHandling, resolveWeaponHandling } from "../scripts/combat/weapon-handling.mjs";
import { resolveMinorJamClearing } from "../scripts/combat/weapon-jam.mjs";
import { prepareWeaponGuidance } from "../scripts/sheets/weapon-guidance.mjs";
import { assertTrackerExchange, assertTrackerStart } from "../scripts/combat/melee-tracker.mjs";

function asleep() {
  const f = fixture();
  f.actor.statuses = new Set(["unconscious"]);
  f.actor.system.hands.right = "gun";
  Object.assign(f.gun.system, { prepared: true, currentAmmunition: 10 });
  return f;
}

test("nieprzytomność blokuje deklaracje, strzał, przeładowanie i inicjatywę także MG", async () => {
  const f = asleep(); assert.equal(game.user.isGM, true);
  const { rollNeuroshimaInitiative } = await import("../scripts/combat/initiative.mjs");
  assert.equal(prepareActorCombatStatus(f.actor).canDeclareAction, false);
  assert.equal(await declareSegmentAction(f.actor, "Bieg", 1), false);
  assert.equal(await selectSegmentAction(f.actor), false);
  assert.equal(await startWeaponShot(f.actor, "gun"), false);
  assert.equal(await resolveSingleShot(f.actor), false);
  assert.equal(await requestWeaponHandling(f.actor, "changeMagazine", "gun"), false);
  assert.equal(await rollNeuroshimaInitiative(f.actor), null);
  assert.equal(f.dialogs.length, 0);
  assert.equal(f.gun.system.currentAmmunition, 10);
  const guidance = prepareWeaponGuidance(f.actor, f.gun, prepareActorCombatStatus(f.actor), true);
  assert.equal(guidance.disabled, true);
  assert.match(guidance.unavailable, /nieprzytomna/);
});

test("zdjęcie statusu przywraca akcje, sama rola MG nie obchodzi blokady", async () => {
  const f = asleep(); f.actor.statuses.delete("unconscious");
  assert.equal(prepareActorCombatStatus(f.actor).canDeclareAction, true);
  assert.equal(await declareSegmentAction(f.actor, "Bieg", 1), true);
});

test("wcześniej zadeklarowany strzał celowany jest przerywany i nie blokuje Trackera", async () => {
  const f = asleep();
  await f.combatant.setFlag("neuroshima", "segmentAction", { actionCode: "aimingTwo", effectCode: "rangedShot", duration: 3,
    startedAtTick: 1, endsAtTick: 3, aimingConfiguration: { weaponId: "gun", targetTokenId: "target" } });
  assert.equal(prepareActorCombatStatus(f.actor).action.canFinishEarly, false);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.action().interrupted, true);
  assert.match(f.action().resolution, /nieprzytomności/);
  assert.equal(f.combat.flags.combatSegment, 2);
  assert.equal(f.gun.system.currentAmmunition, 10);
});

test("nieprzytomna postać nie kończy przeładowania ani usuwania zacięcia", async () => {
  const f = asleep();
  await f.combatant.setFlag("neuroshima", "segmentAction", { effectCode: "weaponHandling", startedAtTick: 1, endsAtTick: 1, handlingConfiguration: {} });
  assert.equal(await resolveWeaponHandling(f.actor), false);
  await f.combatant.setFlag("neuroshima", "segmentAction", { effectCode: "clearMinorJam", startedAtTick: 1, endsAtTick: 1, jamClearingConfiguration: { weaponId: "gun" } });
  f.gun.system.jamState = "minor";
  assert.equal(await resolveMinorJamClearing(f.actor), false);
  assert.equal(f.gun.system.jamState, "minor");
});

test("nieprzytomna postać nie rozpoczyna ani nie kontynuuje wymiany wręcz", () => {
  const f = asleep(); const duel = { configurations: [{ id: f.actor.id }], trackerRound: 1, state: { segment: 1 } };
  assert.throws(() => assertTrackerStart(f.combat, duel), /nieprzytomna/);
  assert.throws(() => assertTrackerExchange(f.combat, duel), /nieprzytomna/);
});

test("pojedynek kończy się po utracie przytomności dopiero po rozliczeniu oczekujących ran", async () => {
  const f = asleep();
  const duel = { configurations: [{ id: f.actor.id }], damageHits: [{ completed: false }] };
  f.combat.flags.meleeDuels = [duel];
  await interruptUnconsciousActions(f.combat);
  assert.equal(f.combat.flags.meleeDuels[0].ended, undefined);
  duel.damageHits[0].completed = true;
  await interruptUnconsciousActions(f.combat);
  assert.equal(f.combat.flags.meleeDuels[0].ended, true);
});
