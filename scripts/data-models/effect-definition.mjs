export class NeuroshimaEffectDefinitionDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { StringField } = foundry.data.fields;
    return {
      sourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      description: new StringField({ required: true, nullable: false, initial: "" })
    };
  }
}
