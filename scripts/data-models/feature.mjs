export class NeuroshimaFeatureDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField } = foundry.data.fields;

    return {
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
