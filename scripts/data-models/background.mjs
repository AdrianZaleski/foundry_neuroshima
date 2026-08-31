export class NeuroshimaBackgroundDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField } = foundry.data.fields;

    return {
      // Wspólna struktura pozwala przechowywać pochodzenia, profesje oraz
      // specjalizacje w oddzielnych Compendiach bez powielania modeli danych.
      sourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      ruleset: new StringField({
        required: true,
        nullable: false,
        initial: "Neuroshima 1.5"
      }),
      description: new StringField({ required: true, nullable: false, initial: "" }),
      flavorText: new StringField({ required: true, nullable: false, initial: "" }),
      bonus: new StringField({ required: true, nullable: false, initial: "" })
    };
  }
}
