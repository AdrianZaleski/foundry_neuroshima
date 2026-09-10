export class NeuroshimaFeatureDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField, BooleanField } = foundry.data.fields;

    return {
      conditionalEffectActive: new BooleanField({ initial: false }),
      selectedSkillGroup: new StringField({ initial: "", blank: true }),
      requiredGender: new StringField({ initial: "", blank: true, choices: ["", "female", "male"] }),
      ignoreGenderRequirement: new BooleanField({ initial: false }),
      applyMechanicalEffects: new BooleanField({ initial: true }),
      // Kod źródłowy pozwoli później rozpoznać rekord pochodzący z katalogu
      // PERK albo TRAIT, niezależnie od nazwy wyświetlanej użytkownikowi.
      sourceCode: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),
      ruleset: new StringField({
        required: true,
        nullable: false,
        initial: "Neuroshima 1.5"
      }),
      requirements: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),
      effects: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),
      description: new StringField({
        required: true,
        nullable: false,
        initial: ""
      })
    };
  }
}
