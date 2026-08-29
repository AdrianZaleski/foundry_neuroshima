export class NeuroshimaWeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, StringField } = foundry.data.fields;

    return {
      // Kod źródłowy pozwoli później połączyć wpis z rekordem w arkuszu danych.
      // Nie jest on nazwą wyświetlaną graczowi, lecz stabilnym identyfikatorem.
      sourceCode: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),

      // Klasa broni wskazuje ogólny rodzaj, na przykład pistolet albo karabin.
      weaponClass: new StringField({
        required: true,
        nullable: false,
        initial: "PISTOL"
      }),

      // Na razie zapisujemy kod amunicji z arkusza. Po utworzeniu typu Item
      // dla amunicji kod stanie się podstawą właściwego powiązania danych.
      ammunitionCode: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),

      magazineCapacity: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      currentAmmunition: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      misfireRoll: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        max: 20,
        initial: 20
      }),
      accuracyModifier: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0
      }),
      range: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      fireRate: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 1,
        initial: 1
      }),

      // Arkusz może podawać kilka rodzajów ataku, na przykład "S,A".
      // Rozdzielimy je na osobne opcje dopiero podczas tworzenia walki.
      attackTypes: new StringField({
        required: true,
        nullable: false,
        initial: "S"
      }),
      reloadTime: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      armorPenetration: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      damageCode: new StringField({
        required: true,
        nullable: false,
        initial: "D_L"
      }),
      requiredStrength: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),

      // Znaczenie kodów z kolumny Holster wymaga jeszcze potwierdzenia,
      // dlatego przechowujemy je bez zgadywania ich interpretacji.
      holsterCode: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),
      price: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      availability: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        max: 100,
        initial: 0
      }),

      // Masa nie występuje w zakładce RANGED, ale jest potrzebna podczas
      // późniejszego sumowania całego obciążenia postaci.
      weight: new NumberField({
        required: true,
        nullable: false,
        min: 0,
        initial: 0
      }),
      actions: new StringField({
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
