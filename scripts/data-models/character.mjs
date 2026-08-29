export class NeuroshimaCharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, SchemaField } = foundry.data.fields;
    const createAttributeField = () => new SchemaField({
      base: new NumberField({ required: true, nullable: false, integer: true, min: 1, max: 40, initial: 1 }),
      modifier: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false }),
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 1, persisted: false })
    });

    return {
      attributes: new SchemaField({
        zrecznosc: createAttributeField(),
        percepcja: createAttributeField(),
        charakter: createAttributeField(),
        spryt: createAttributeField(),
        budowa: createAttributeField()
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    for (const attribute of Object.values(this.attributes)) {
      attribute.value = attribute.base + attribute.modifier;
    }
  }
}
