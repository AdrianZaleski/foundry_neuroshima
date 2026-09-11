import assert from "node:assert/strict";
import { test } from "node:test";
import { treatmentPlan, applyTreatmentResult } from "../scripts/health/treatment.mjs";
const wound = (penaltyPercent = 40, injuryType = "serious") => ({ system: { penaltyPercent, injuryType } });
function resolve(injury, method, passed) {
  const result = applyTreatmentResult(injury, treatmentPlan(injury, method), passed, { healer: "Medyk", timestamp: "test" });
  injury.system.penaltyPercent = result["system.penaltyPercent"];
  injury.system.treatment = result["system.treatment"];
}
test("pierwsza pomoc 5, leczenie po niej 10; brak kolejnego leczenia ponad limit", () => {
  const injury = wound();
  resolve(injury, "firstAid", true);
  assert.equal(injury.system.penaltyPercent, 35);
  assert.throws(() => treatmentPlan(injury, "firstAid"));
  resolve(injury, "healing", true);
  assert.equal(injury.system.penaltyPercent, 25);
  assert.equal(injury.system.treatment.totalReduction, 15);
  assert.throws(() => treatmentPlan(injury, "healing"));
});
test("leczenie bez pierwszej pomocy usuwa 15 i wyczerpuje wspólny limit", () => {
  const injury = wound();
  resolve(injury, "healing", true);
  assert.equal(injury.system.penaltyPercent, 25);
  assert.throws(() => treatmentPlan(injury, "firstAid"));
});
test("porażki zwiększają karę i trudność kolejnej próby tej metody", () => {
  const injury = wound(20, "light");
  assert.equal(treatmentPlan(injury, "firstAid").difficulty, 1);
  resolve(injury, "firstAid", false);
  assert.equal(injury.system.penaltyPercent, 25);
  assert.equal(treatmentPlan(injury, "firstAid").difficulty, 2);
  assert.equal(treatmentPlan(injury, "healing").difficulty, 1);
  resolve(injury, "firstAid", false);
  assert.equal(treatmentPlan(injury, "firstAid").difficulty, 3);
  assert.equal(injury.system.treatment.history.length, 2);
});
test("kara nie spada poniżej zera, opatrzenie rany krytycznej jest zapisywane", () => {
  const injury = wound(3, "critical");
  resolve(injury, "firstAid", true);
  assert.equal(injury.system.penaltyPercent, 0);
  assert.equal(injury.system.treatment.stabilized, true);
  assert.equal(injury.system.treatment.totalReduction, 3);
  const other = wound(0, "critical");
  resolve(other, "firstAid", true);
  assert.equal(other.system.treatment.stabilized, true);
});
