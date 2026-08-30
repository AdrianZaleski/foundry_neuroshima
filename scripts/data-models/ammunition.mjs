import {
  convertWeightToKilograms,
  roundWeightInKilograms
} from "../utils/weight.mjs";

export class NeuroshimaAmmunitionDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, StringField } = foundry.data.fields;

    return {
      // Kod źródłowy identyfikuje konkretny wariant amunicji w zakładce AMMO.
      // Przykładem jest osobny kod dla zwykłej i sportowej strzały.
      sourceCode: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),

      // Symbol amunicji określa rodzinę kompatybilności z bronią.
      // To jego będziemy później porównywać z kodem amunicji zapisanym w broni.
      ammunitionSymbol: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),
      quantity: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 1
      }),
      unitPrice: new NumberField({
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
      craftingDifficulty: new StringField({
        required: true,
        nullable: false,
        initial: "AVERAGE"
      }),
      description: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),

      // Pole Effect z arkusza przechowujemy w oryginalnej postaci.
      // Kody takie jak WEAPON_RANGE lub ARMOR_PIERCING zinterpretujemy później.
      effectCode: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),
      unitWeight: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      weightUnit: new StringField({
        required: true,
        nullable: false,
        choices: ["g", "kg"],
        initial: "g"
      }),

      // Wartości łączne wynikają z ilości i nie są osobno zapisywane w świecie.
      totalPrice: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0,
        persisted: false
      }),
      totalWeight: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0,
        persisted: false
      }),
      unitWeightInKilograms: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0,
        persisted: false
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Cena i masa całego zapasu wynikają z liczby sztuk.
    this.totalPrice = Math.round(this.quantity * this.unitPrice * 100) / 100;
    this.unitWeightInKilograms = convertWeightToKilograms(
      this.unitWeight,
      this.weightUnit
    );
    this.totalWeight = roundWeightInKilograms(
      this.quantity * this.unitWeightInKilograms
    );
  }
}
