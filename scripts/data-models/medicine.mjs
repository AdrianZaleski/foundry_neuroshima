export class NeuroshimaMedicineDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, StringField } = foundry.data.fields;

    return {
      sourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      diseaseSourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      packageSize: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      quantity: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      price: new NumberField({ required: true, nullable: false, min: 0, initial: 0 }),
      availability: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        max: 100,
        initial: 0
      }),
      description: new StringField({ required: true, nullable: false, initial: "" }),
      flavorText: new StringField({ required: true, nullable: false, initial: "" }),
      effect: new StringField({ required: true, nullable: false, initial: "" }),
      effectDurationHours: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      })
    };
  }
}
