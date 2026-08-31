import {
  convertWeightToKilograms,
  roundWeightInKilograms
} from "../utils/weight.mjs";

export class NeuroshimaMeleeWeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, SchemaField, StringField } = foundry.data.fields;

    const createDamageField = () => new StringField({
      required: true,
      nullable: false,
      initial: ""
    });

    return {
      sourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      weaponType: new StringField({ required: true, nullable: false, initial: "" }),
      armorPenetration: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      attackBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      defenseBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      multipleOpponentsBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      requiredBuild: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      initiativeBonus: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),

      // Arkusz zapisuje trzy wyniki obrażeń rozdzielone ukośnikami. Na tym
      // etapie zachowujemy dokładny tekst źródłowy dla każdego progu Budowy,
      // ponieważ część kodów jest niepełna albo używa starszej notacji.
      damageByBuild: new SchemaField({
        below10: createDamageField(),
        below12: createDamageField(),
        below13: createDamageField(),
        below14: createDamageField(),
        below15: createDamageField(),
        below16: createDamageField(),
        below18: createDamageField(),
        below19: createDamageField()
      }),

      weight: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      weightUnit: new StringField({
        required: true,
        nullable: false,
        choices: ["g", "kg"],
        initial: "kg"
      }),
      weightInKilograms: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0,
        persisted: false
      }),
      price: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      availability: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        max: 100,
        initial: 0
      }),
      description: new StringField({ required: true, nullable: false, initial: "" })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.weightInKilograms = roundWeightInKilograms(
      convertWeightToKilograms(this.weight, this.weightUnit)
    );
  }
}
