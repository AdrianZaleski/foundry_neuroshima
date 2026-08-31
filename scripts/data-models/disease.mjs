export class NeuroshimaDiseaseDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { SchemaField, StringField } = foundry.data.fields;

    const createStage = () => new SchemaField({
      summary: new StringField({ required: true, nullable: false, initial: "" }),
      description: new StringField({ required: true, nullable: false, initial: "" }),
      effect: new StringField({ required: true, nullable: false, initial: "" })
    });

    return {
      sourceCode: new StringField({ required: true, nullable: false, initial: "" }),
      description: new StringField({ required: true, nullable: false, initial: "" }),
      currentStage: new StringField({
        required: true,
        nullable: false,
        choices: ["first", "second", "third", "terminal"],
        initial: "first"
      }),
      stages: new SchemaField({
        first: createStage(),
        second: createStage(),
        third: createStage(),
        terminal: createStage()
      }),
      medicationDescription: new StringField({
        required: true,
        nullable: false,
        initial: ""
      })
    };
  }
}
