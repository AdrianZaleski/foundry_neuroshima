import assert from "node:assert/strict";
import { test } from "node:test";
import { planHealing, healingUpdate } from "../scripts/health/healing.mjs";
const wound = (injuryType = "light", penaltyPercent = 40, pendingDay = 0) => ({ id: "a", system: { injuryType, penaltyPercent, healing: { pendingDay, history: [] } } });
test("gojenie normalne, zaniedbanie i dolna granica kary", () => {
  assert.equal(planHealing(wound(), 2, "rest").after, 30);
  assert.equal(planHealing(wound(), 10, "neglected").after, 40);
  assert.equal(planHealing(wound(), 10, "rest").after, 0);
});
test("niepełny dzień bez odpoczynku przechodzi do kolejnego rozliczenia", () => {
  const first = planHealing(wound(), 1, "noRest");
  assert.equal(first.after, 40);
  assert.equal(first.pendingDay, 1);
  assert.equal(planHealing(wound("light", first.after, first.pendingDay), 1, "noRest").after, 35);
  assert.equal(planHealing(wound("light", 40, 1), 1, "neglected").pendingDay, 1);
});
test("siniaki mają osobne tempo 30 dziennie niezależnie od odpoczynku", () => {
  for (const mode of ["rest", "noRest", "neglected"]) {
    assert.equal(planHealing(wound("bruise", 70), 2, mode).after, 10);
    assert.equal(planHealing(wound("bruise", 20), 1, mode).after, 0);
  }
});
test("historia jest dodawana bez kasowania rany i zabiegów", () => {
  const item = wound();
  const update = healingUpdate(item, planHealing(item, 1, "rest"), "gm", "today");
  assert.equal(update["system.healing.history"][0].before, 40);
  assert.equal(update["system.penaltyPercent"], 35);
  assert.equal(update["system.treatment"], undefined);
  assert.throws(() => planHealing(item, -1, "rest"));
  assert.throws(() => planHealing(item, 1.5, "rest"));
});
