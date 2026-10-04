import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareInjuryLocations } from "../scripts/sheets/injury-layout.mjs";
import { setupItemAddition } from "./helpers/item-addition-fixture.mjs";

test("mapa ran pokazuje wszystkie lokacje, również puste", () => {
  const groups = prepareInjuryLocations([]);
  assert.equal(groups.length, 7);
  assert.equal(new Set(groups.map(group => group.key)).size, 7);
  assert.ok(groups.every(group => !group.hasInjuries && group.penaltyPercent === 0));
});

test("rana trafia dokładnie do jednej lokacji; kary i rany 0% nie znikają", () => {
  const injuries = [
    { id: "1", location: "head", penaltyPercent: 10 },
    { id: "2", location: "head", penaltyPercent: 30 },
    { id: "3", location: "leftArm", penaltyPercent: 0 },
    { id: "4", location: "general", penaltyPercent: 5 },
    { id: "5", location: "legacy", penaltyPercent: 7 }
  ];
  const before = structuredClone(injuries);
  const groups = prepareInjuryLocations(injuries);
  assert.equal(groups.find(group => group.key === "head").penaltyPercent, 40);
  assert.equal(groups.find(group => group.key === "leftArm").hasInjuries, true);
  assert.deepEqual(groups.find(group => group.key === "general").items.map(item => item.id), ["4", "5"]);
  assert.equal(groups.flatMap(group => group.items).length, injuries.length);
  assert.equal(groups.reduce((sum, group) => sum + group.penaltyPercent, 0), 52);
  assert.deepEqual(injuries, before);
});

test("dodanie rany z mapy zapisuje lokację, a zwykłe dodawanie zachowuje lokację ogólną", async () => {
  setupItemAddition();
  const { NeuroshimaCharacterSheet } = await import("../scripts/sheets/character-sheet.mjs");
  for (const [requested, expected] of [["head", "head"], ["leftArm", "leftArm"], [undefined, "general"], ["invalid", "general"]]) {
    const { actor, saved } = setupItemAddition();
    const draft = await NeuroshimaCharacterSheet.DEFAULT_OPTIONS.actions.createInjury.call({ actor }, {}, { dataset: { location: requested } });
    assert.equal(saved.length, 0);
    assert.equal(draft.item.system.location, expected);
    await draft.confirmAddition();
    assert.equal(saved[0].system.location, expected);
    assert.equal(saved[0].type, "injury");
    assert.equal(saved.length, 1);
  }
});
