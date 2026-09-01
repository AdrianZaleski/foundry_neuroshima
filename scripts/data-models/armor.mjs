import {
  convertWeightToKilograms,
  roundWeightInKilograms
} from "../utils/weight.mjs";

const ARMOR_LOCATIONS = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];

function locationSchema() {
  const { BooleanField, NumberField, SchemaField } = foundry.data.fields;
  return new SchemaField({
    protected: new BooleanField({ required: true, nullable: false, initial: false }),
    reduction: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
    cuttingReduction: new NumberField({ required: true, nullable: false, integer: true, min: -1, initial: -1 }),
    ballisticReduction: new NumberField({ required: true, nullable: false, integer: true, min: -1, initial: -1 }),
    coverageChance: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 100, initial: 100 }),
    maxDurability: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
    currentDurability: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 })
  });
}

export class NeuroshimaArmorDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { BooleanField, NumberField, StringField } = foundry.data.fields;
    const schema = {
      sourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      equipped: new BooleanField({ required: true, nullable: false, initial: false }),
      armorClass: new StringField({
        required: true,
        nullable: false,
        choices: ["custom", "light", "medium", "heavy", "superHeavy"],
        initial: "custom"
      }),
      penaltyScope: new StringField({
        required: true,
        nullable: false,
        choices: ["dexterity", "perception"],
        initial: "dexterity"
      }),
      penaltyPercent: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
      price: new NumberField({ required: true, nullable: false, min: 0, initial: 0 }),
      availabilityPercent: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: 100, initial: 0 }),
      unitWeight: new NumberField({ required: true, nullable: false, min: 0, initial: 0 }),
      weightUnit: new StringField({ required: true, nullable: false, choices: ["g", "kg"], initial: "kg" }),
      description: new StringField({ required: true, nullable: false, initial: "" }),
      weightInKilograms: new NumberField({ required: true, nullable: false, min: 0, initial: 0, persisted: false })
    };
    for (const location of ARMOR_LOCATIONS) schema[location] = locationSchema();
    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.weightInKilograms = roundWeightInKilograms(
      convertWeightToKilograms(this.unitWeight, this.weightUnit)
    );
  }
}
