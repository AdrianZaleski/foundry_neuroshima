import {
  convertWeightToKilograms,
  roundWeightInKilograms
} from "../utils/weight.mjs";

export class NeuroshimaEquipmentDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, StringField } = foundry.data.fields;

    return {
      // Liczba sztuk, masa jednej sztuki, cena i opis są zapisywane w bazie świata.
      quantity: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 1
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
        initial: "kg"
      }),
      price: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      description: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),

      // Łączna masa jest zawsze wyliczana z liczby sztuk i masy jednej sztuki.
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

    this.unitWeightInKilograms = convertWeightToKilograms(
      this.unitWeight,
      this.weightUnit
    );
    this.totalWeight = roundWeightInKilograms(
      this.quantity * this.unitWeightInKilograms
    );
  }
}
