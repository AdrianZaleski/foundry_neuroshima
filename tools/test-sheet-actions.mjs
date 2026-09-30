import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { selectTestConfiguration } from "../scripts/rolls/roll-helpers.mjs";
import { attributeSelection } from "../scripts/sheets/attribute-selection.mjs";
import { configureHeldEquipment, prepareHeldEquipment } from "../scripts/sheets/held-equipment.mjs";

const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function setup() {
  const dialogs = [], messages = [], warnings = [];
  const actor = { items: [], system: { attributes: { zrecznosc: { base: 14 } }, skills: {}, background: {}, activeModifiers: [] } };
  globalThis.ui = { notifications: { warn: text => warnings.push(text), error: text => warnings.push(text) } };
  globalThis.foundry = {
    utils: { escapeHTML: escape },
    applications: { sheets: { ActorSheetV2: class {} }, api: {
      HandlebarsApplicationMixin: Base => Base,
      DialogV2: { input: async options => {
        dialogs.push(options);
        return { testType: "closed", difficultyIndex: options.content.match(/value="(\d+)" selected/)?.[1] ?? "1", customPenaltyPercent: "0" };
      }, confirm: async () => true }
    } },
    documents: { Combat: class {}, ChatMessage: { getSpeaker: () => ({}) } },
    dice: { Roll: class {
      async evaluate() { this.dice = [{ results: [5,6,7].map(result => ({ result })) }]; return this; }
      async toMessage(message) { messages.push(message); }
    } }
  };
  return { actor, dialogs, messages, warnings };
}

test("zaznaczony poziom trafia do okna i obliczeń rzutu, a zwykły test pozostaje przeciętny", async () => {
  const { actor, dialogs, messages } = setup();
  const { NeuroshimaCharacterSheet: Sheet } = await import("../scripts/sheets/character-sheet.mjs");
  const sheet = { actor, attributeTestSelection: attributeSelection("zrecznosc", 2) };
  await Sheet.DEFAULT_OPTIONS.actions.rollSelectedAttribute.call(sheet);
  assert.match(dialogs[0].content, /value="2" selected/);
  assert.match(messages[0].flavor, /Początkowy poziom trudności: Problematyczny/);
  assert.match(messages[0].flavor, /Próg sukcesu: 12/);
  await Sheet.DEFAULT_OPTIONS.actions.rollAttribute.call({ actor }, {}, { dataset: { attribute: "zrecznosc" } });
  assert.match(dialogs[1].content, /value="1" selected/);
  assert.equal(attributeSelection("missing", 1), null);
  assert.equal(attributeSelection("zrecznosc", -1), null);
});

test("typ i bazowy poziom są na górze; dodatnia kara utrudnia, ujemna ułatwia", async () => {
  const { actor, dialogs } = setup();
  await selectTestConfiguration(actor);
  const html = dialogs[0].content;
  assert.ok(html.indexOf('id="neuroshima-test-type"') < html.indexOf('id="neuroshima-difficulty"'));
  assert.ok(html.indexOf('id="neuroshima-difficulty"') < html.indexOf('name="includeWounds"'));
  assert.match(html, /Wartości dodatnie = utrudnienie/);
  assert.match(html, /Wartości ujemne = ułatwienie/);
  for (const [percent, expected] of [[20, 2], [-20, 0]]) {
    foundry.applications.api.DialogV2.input = async () => ({ testType: "closed", difficultyIndex: "1", customPenaltyPercent: String(percent) });
    const config = await selectTestConfiguration(actor);
    assert.equal(config.difficultyIndexAfterPercentagePenalties, expected);
  }
});

test("wybrany próg nie omija ran, a ustalona trudność zabiegu nadal ma pierwszeństwo", async () => {
  const { actor, dialogs } = setup();
  actor.items = [{ type: "injury", system: { penaltyPercent: 20 } }];
  foundry.applications.api.DialogV2.input = async options => {
    dialogs.push(options);
    return { testType: "closed", difficultyIndex: "2", customPenaltyPercent: "0", includeWounds: true };
  };
  const config = await selectTestConfiguration(actor, { initialDifficultyIndex: 2 });
  assert.equal(config.startingDifficultyIndex, 2);
  assert.equal(config.difficultyIndexAfterPercentagePenalties, 3);
  const fixed = await selectTestConfiguration(actor, { initialDifficultyIndex: 0, fixedDifficultyIndex: 3 });
  assert.equal(fixed.startingDifficultyIndex, 3);
  assert.match(dialogs[1].content, /name="difficultyIndex" disabled/);
});

test("usunięcie rany z karą usuwa Item; anulowanie zachowuje ranę", async () => {
  setup();
  const { NeuroshimaCharacterSheet: Sheet } = await import("../scripts/sheets/character-sheet.mjs");
  const calls = [];
  const injury = { id: "w", type: "injury", name: "Ciężka rana", system: { penaltyPercent: 70 } };
  const actor = { items: new Map([["w", injury]]), deleteEmbeddedDocuments: async (...args) => calls.push(args) };
  await Sheet.DEFAULT_OPTIONS.actions.deleteInjury.call({ actor }, {}, { dataset: { itemId: "w" } });
  assert.deepEqual(calls, [["Item", ["w"]]]);
  foundry.applications.api.DialogV2.confirm = async () => false;
  await Sheet.DEFAULT_OPTIONS.actions.deleteInjury.call({ actor }, {}, { dataset: { itemId: "w" } });
  assert.equal(calls.length, 1);
});

test("dłonie rozróżniają dwa przedmioty, chwyt oburącz i brak dostępnego przedmiotu", () => {
  const { actor } = setup();
  actor.items = [{ id: "gun", type: "weapon", name: "Karabin", system: {} }, { id: "lamp", type: "equipment", name: "Latarka", system: { quantity: 1 } }];
  actor.system.hands = { left: "lamp", right: "gun" };
  assert.equal(prepareHeldEquipment(actor).leftName, "Latarka");
  assert.equal(prepareHeldEquipment(actor).bothHands, false);
  actor.system.hands.left = "gun";
  assert.equal(prepareHeldEquipment(actor).bothHands, true);
  actor.items = [];
  assert.equal(prepareHeldEquipment(actor).rightName, "Wolna");
  assert.equal(prepareHeldEquipment(actor).bothHands, false);
});

test("wybór dłoni zapisuje oba pola razem i odrzuca przedmiot usunięty podczas wyboru", async () => {
  const { actor, warnings } = setup();
  const updates = [];
  actor.update = async data => updates.push(data);
  actor.items = [{ id: "gun", type: "weapon", name: '<Broń "test">', system: {} }];
  foundry.applications.api.DialogV2.input = async options => {
    assert.match(options.content, /&lt;Broń &quot;test&quot;>/);
    return { left: "gun", right: "gun" };
  };
  await configureHeldEquipment(actor);
  assert.deepEqual(updates, [{ "system.hands.left": "gun", "system.hands.right": "gun" }]);
  foundry.applications.api.DialogV2.input = async () => { actor.items = []; return { left: "gun", right: "" }; };
  await configureHeldEquipment(actor);
  assert.equal(updates.length, 1);
  assert.equal(warnings.length, 1);
  foundry.applications.api.DialogV2.input = async () => null;
  await configureHeldEquipment(actor);
  assert.equal(updates.length, 1);
});

test("PD ma jedno edytowalne pole w formularzu, w nagłówku", async () => {
  const header = await readFile(new URL("../templates/actor/parts/header.hbs", import.meta.url), "utf8");
  const details = await readFile(new URL("../templates/actor/parts/details-tab.hbs", import.meta.url), "utf8");
  assert.match(header, /name="system.development.experiencePoints"[^>]+min="0"/);
  assert.doesNotMatch(details, /name="system.development.experiencePoints"/);
});
