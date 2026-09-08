import assert from "node:assert/strict";
import { test } from "node:test";

class Field {
  constructor(options) { this.options = options; }
}
class SchemaField {
  constructor(fields) { this.fields = fields; }
}
globalThis.foundry = {
  abstract: { TypeDataModel: class {} },
  data: { fields: { ArrayField: Field, BooleanField: Field, NumberField: Field,
    StringField: Field, SchemaField } }
};
const { NeuroshimaCharacterDataModel } = await import("../scripts/data-models/character.mjs");

test("brak wyboru premii u starszego Actora jest dozwolonym stanem pola", () => {
  const field = NeuroshimaCharacterDataModel.defineSchema().background.fields.originBonusAttribute;
  assert.equal(field.options.initial, "");
  // Foundry 14 StringField ustawia blank=false, jeżeli podano choices.
  // Samo dodanie pustego tekstu do choices nie wystarcza do walidacji.
  assert.equal(field.options.blank, true);
  assert.ok(field.options.choices.includes(field.options.initial));
});
