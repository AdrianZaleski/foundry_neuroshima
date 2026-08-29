export class NeuroshimaCharacterDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, SchemaField } = foundry.data.fields;

    // Każdy z pięciu współczynników ma identyczną strukturę danych.
    // Funkcja pomocnicza chroni nas przed pięciokrotnym powtarzaniem definicji.
    const createAttributeSchema = () => new SchemaField({
      // "base" jest wartością wpisywaną przez użytkownika i zapisywaną w bazie świata.
      base: new NumberField({ required: true, nullable: false, integer: true, min: 1, max: 40, initial: 1 }),

      // "modifier" i "value" są wyliczane przy każdym przygotowaniu danych.
      // persisted: false oznacza, że Foundry nie zapisuje ich w bazie świata.
      modifier: new NumberField({ required: true, nullable: false, integer: true, initial: 0, persisted: false }),
      value: new NumberField({ required: true, nullable: false, integer: true, initial: 1, persisted: false })
    });

    return {
      attributes: new SchemaField({
        zrecznosc: createAttributeSchema(),
        percepcja: createAttributeSchema(),
        charakter: createAttributeSchema(),
        spryt: createAttributeSchema(),
        budowa: createAttributeSchema()
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Wartość końcowa każdego współczynnika jest sumą wartości bazowej
    // oraz modyfikatora pochodzącego na przykład z efektów aktywnych.
    for (const attribute of Object.values(this.attributes)) {
      attribute.value = attribute.base + attribute.modifier;
    }
  }
}
