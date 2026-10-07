import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./burst-test-fixture.mjs";
import { selectSegmentAction } from "../scripts/combat/segments.mjs";
import { prepareCombatActionOptions } from "../scripts/combat/action-catalog.mjs";
import { prepareWeaponGuidance } from "../scripts/sheets/weapon-guidance.mjs";

function readyWeapon(attackTypes = "S") {
  const f = fixture();
  f.actor.system.hands = { left: "gun", right: "gun" };
  Object.assign(f.gun.system, { prepared: true, currentAmmunition: 30, attackTypes, fireRate: 2 });
  return f;
}

test("domyślną akcją jest Strzał, również przy broni automatycznej", () => {
  for (const automaticFireAvailable of [false, true]) {
    const options = prepareCombatActionOptions({ automaticFireAvailable });
    assert.match(options, /<option value="shot" selected>/);
    assert.ok(options.indexOf('value="shot"') < options.indexOf('value="burstShort"'));
    assert.equal((options.match(/ selected/g) ?? []).length, 1);
  }
});

test("gotowy AK z trybem S może zadeklarować strzał w pierwszym segmencie", async () => {
  const f = readyWeapon(); f.reply({ actionCode: "shot" });
  assert.equal(await selectSegmentAction(f.actor), true);
  assert.equal(f.action().actionCode, "shot");
  assert.equal(f.action().startedAtTick, 1);
  assert.deepEqual(f.warnings, []);
  assert.match(f.dialogs[0].content, /value="burstShort" disabled/);
  assert.match(prepareWeaponGuidance(f.actor, f.gun).next.explanation, /zwykłego lub celowanego/);
});

test("próba niedostępnej serii wyjaśnia brak trybu A, bez błędu gotowości", async () => {
  const f = readyWeapon(); f.reply({ actionCode: "burstShort" });
  assert.equal(await selectSegmentAction(f.actor), false);
  assert.match(f.warnings[0], /Broń jest gotowa.*trybu A/);
  assert.equal(f.action(), undefined);
  assert.equal(f.gun.system.currentAmmunition, 30);
});

test("gotowa broń z S,A nadal pozwala zadeklarować serię", async () => {
  const f = readyWeapon("S,A"); f.reply({ actionCode: "burstLong" });
  assert.equal(await selectSegmentAction(f.actor), true);
  assert.doesNotMatch(f.dialogs[0].content, /value="burstLong" disabled/);
  assert.equal(f.action().duration, 2);
});

test("zabezpieczona broń z A pozostaje zablokowana", async () => {
  const f = readyWeapon("S,A"); f.gun.system.safetyOn = true;
  f.reply({ actionCode: "shot" });
  assert.equal(await selectSegmentAction(f.actor), false);
  assert.match(f.warnings[0], /Brak gotowej broni/);
});
