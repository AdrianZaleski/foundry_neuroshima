export class NeuroshimaDiseaseDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const {
      ArrayField,
      BooleanField,
      NumberField,
      SchemaField,
      StringField
    } = foundry.data.fields;

    const createModifier = () => new SchemaField({
      id: new StringField({ required: true, nullable: false, initial: "" }),
      scope: new StringField({ required: true, nullable: false, initial: "test.all" }),
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 0 }),
      note: new StringField({ required: true, nullable: false, initial: "" })
    });

    const createStage = () => new SchemaField({
      summary: new StringField({ required: true, nullable: false, initial: "" }),
      description: new StringField({ required: true, nullable: false, initial: "" }),
      effect: new StringField({ required: true, nullable: false, initial: "" }),
      modifiersConfigured: new BooleanField({
        required: true,
        nullable: false,
        initial: false
      }),
      modifiers: new ArrayField(createModifier(), {
        required: true,
        nullable: false,
        initial: []
      })
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
      applyMechanicalEffects: new BooleanField({
        required: true,
        nullable: false,
        initial: true
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
