import assert from "node:assert/strict";
import { test } from "node:test";
import { openItemAddition, getAdditionCatalog } from "../scripts/sheets/item-addition.mjs";
import { setupItemAddition } from "./helpers/item-addition-fixture.mjs";

test("edycja, Enter, akcje formularza i anulowanie nie zapisują nowej pozycji", async () => {
  const { actor, saved } = setupItemAddition();
  const sheet = await openItemAddition(actor, "disease");
  await sheet._processSubmitData(null, null, { name: "Choroba", "system.description": "Opis" });
  await sheet.item.update({ "system.stages.first.modifiers": [{ value: 20 }] });
  assert.equal(sheet.item.system.stages.first.modifiers[0].value, 20);
  assert.equal(saved.length, 0);
  await sheet.constructor.DEFAULT_OPTIONS.actions.cancelAddition.call(sheet);
  assert.equal(saved.length, 0);
  assert.equal(sheet.rendered, false);
});

test("zatwierdzenie zapisuje najnowsze wartości formularza dokładnie raz", async () => {
  const { actor, saved } = setupItemAddition();
  const sheet = await openItemAddition(actor, "armor");
  sheet.formData = { name: "  Kamizelka  ", "system.penaltyPercent": 20 };
  await Promise.all([sheet.confirmAddition(), sheet.confirmAddition()]);
  await sheet.confirmAddition();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].name, "Kamizelka");
  assert.equal(saved[0].system.penaltyPercent, 20);
  assert.equal(saved[0]._id, undefined);
  assert.equal(sheet.rendered, false);
});

test("katalog pokazuje tylko dostępne wpisy właściwego typu i chroni nazwy HTML", async () => {
  const { actor, addPack, dialogs, saved } = setupItemAddition();
  addPack([{ _id: "a", name: '<Pancerz "A">', type: "armor" }, { _id: "w", name: "Broń", type: "weapon" }]);
  addPack([{ _id: "b", name: "Ukryty", type: "armor" }], { visible: false });
  addPack([{ _id: "c", name: "Aktor", type: "armor" }], { documentName: "Actor" });
  const catalog = await getAdditionCatalog("armor");
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].entries.length, 1);
  await openItemAddition(actor, "armor");
  assert.match(dialogs[0].content, /&lt;Pancerz &quot;A&quot;>/);
  assert.match(dialogs[0].content, /Katalog &lt;test>/);
  assert.doesNotMatch(dialogs[0].content, /Ukryty|Broń|Aktor/);
  assert.equal(saved.length, 0);
});

test("wybór z kompendium otwiera kopię z opisem i statystykami bez zmiany źródła", async () => {
  const { actor, addPack, saved } = setupItemAddition();
  const source = { _id: "a", name: "Kamizelka", type: "armor", folder: "folder", ownership: { default: 0 },
    system: { description: "Opis kamizelki", penaltyPercent: 10, sourceCode: "ARMOR_A" } };
  addPack([source]);
  foundry.applications.api.DialogV2.input = async () => ({ choice: "0" });
  const sheet = await openItemAddition(actor, "armor");
  assert.equal(sheet.item.system.description, "Opis kamizelki");
  assert.equal(sheet.item.system.penaltyPercent, 10);
  assert.equal(saved.length, 0);
  sheet.formData = { "system.penaltyPercent": 30 };
  await sheet.confirmAddition();
  assert.equal(source.system.penaltyPercent, 10);
  assert.equal(saved[0].system.penaltyPercent, 30);
  assert.equal(saved[0].system.sourceCode, "ARMOR_A");
  assert.equal(saved[0].folder, undefined);
  assert.equal(saved[0].ownership, undefined);
});

test("zamknięcie wyboru lub podglądu z kompendium nie tworzy pozycji", async () => {
  const { actor, addPack, saved, drafts } = setupItemAddition();
  addPack([{ _id: "a", name: "Choroba", type: "disease", system: {} }]);
  foundry.applications.api.DialogV2.input = async () => null;
  assert.equal(await openItemAddition(actor, "disease"), null);
  assert.equal(drafts.length, 0);
  foundry.applications.api.DialogV2.input = async () => ({ choice: "0" });
  const sheet = await openItemAddition(actor, "disease");
  await sheet.close();
  await sheet.confirmAddition();
  assert.equal(saved.length, 0);
});

test("brak wpisu w kompendium nie tworzy pustego zamiennika", async () => {
  const { actor, addPack, errors, saved, drafts } = setupItemAddition();
  const pack = addPack([{ _id: "a", name: "Pancerz", type: "armor" }]);
  pack.getDocument = async () => null;
  foundry.applications.api.DialogV2.input = async () => ({ choice: "0" });
  assert.equal(await openItemAddition(actor, "armor"), null);
  assert.equal(errors.length, 1);
  assert.equal(drafts.length, 0);
  assert.equal(saved.length, 0);
});

test("błąd indeksu ostrzega i nadal pozwala wypełnić własną pozycję", async () => {
  const { actor, addPack, warnings, saved } = setupItemAddition();
  addPack([]).getIndex = async () => { throw new Error("offline"); };
  const sheet = await openItemAddition(actor, "medicine");
  assert.ok(sheet.rendered);
  assert.equal(warnings.length, 1);
  assert.equal(saved.length, 0);
});

test("walidacja i utrata uprawnień blokują zapis", async () => {
  const { actor, saved } = setupItemAddition();
  const sheet = await openItemAddition(actor, "equipment");
  sheet.form.reportValidity = () => false;
  await sheet.confirmAddition();
  sheet.form.reportValidity = () => true;
  sheet.formData = { name: "  " };
  await sheet.confirmAddition();
  sheet.formData = { name: "Plecak" };
  actor.isOwner = false;
  await sheet.confirmAddition();
  assert.equal(await openItemAddition(actor, "armor"), null);
  assert.equal(saved.length, 0);
});

test("błąd zapisu pozostawia formularz i jego dane do ponowienia", async () => {
  const { actor, errors, saved } = setupItemAddition();
  const sheet = await openItemAddition(actor, "armor");
  sheet.formData = { name: "Pancerz testowy" };
  const create = actor.createEmbeddedDocuments;
  actor.createEmbeddedDocuments = async () => { throw new Error("Brak połączenia"); };
  await sheet.confirmAddition();
  assert.equal(errors.length, 1);
  assert.equal(sheet.rendered, true);
  assert.equal(sheet.item.name, "Pancerz testowy");
  actor.createEmbeddedDocuments = create;
  await sheet.confirmAddition();
  assert.equal(saved.length, 1);
});

test("wymagania sprawdzane są dla uzupełnionej sztuczki, a duplikaty są blokowane", async () => {
  const { actor, saved, dialogs, warnings } = setupItemAddition();
  const sheet = await openItemAddition(actor, "perk");
  sheet.formData = { name: "Moja sztuczka", "system.requirements": "zgoda MG" };
  foundry.applications.api.DialogV2.confirm = async options => { dialogs.push(options); return false; };
  await sheet.confirmAddition();
  assert.equal(saved.length, 0);
  assert.match(dialogs[0].content, /Moja sztuczka/);
  assert.match(dialogs[0].content, /zgoda MG/);
  actor.items = [{ name: "Moja sztuczka", type: "perk", system: {} }];
  await sheet.confirmAddition();
  assert.equal(warnings.length, 1);
  assert.equal(dialogs.length, 1);
  assert.equal(saved.length, 0);
});

test("wszystkie przyciski dodawania otwierają draft bez wpisu na karcie", async () => {
  const { actor, saved } = setupItemAddition();
  const { NeuroshimaCharacterSheet: Sheet } = await import("../scripts/sheets/character-sheet.mjs");
  const actions = { createArmor: "armor", createDisease: "disease", createMedicine: "medicine",
    createEquipment: "equipment", createWeapon: "weapon", createMeleeWeapon: "meleeWeapon", createAmmunition: "ammunition" };
  for (const [action, type] of Object.entries(actions)) {
    const draft = await Sheet.DEFAULT_OPTIONS.actions[action].call({ actor });
    assert.equal(draft.item.type, type);
  }
  for (const type of ["perk", "trait"]) {
    const draft = await Sheet.DEFAULT_OPTIONS.actions.createFeature.call({ actor }, {}, { dataset: { featureType: type } });
    assert.equal(draft.item.type, type);
  }
  assert.equal(saved.length, 0);
});
