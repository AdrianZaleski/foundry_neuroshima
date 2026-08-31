// Wartość obrażeń odpowiada oznaczeniom używanym na referencyjnej karcie Roll20.
// Przechowujemy rodzaj rany, a liczbę wyliczamy, aby oba pola nie mogły się rozjechać.
const DAMAGE_VALUE_BY_INJURY_TYPE = {
  abrasion: 1,
  light: 3,
  serious: 9,
  critical: 27
};

export class NeuroshimaInjuryDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const { NumberField, StringField } = foundry.data.fields;

    return {
      // Lokacja pozwoli później osobno rozpatrywać skutki ran głowy,
      // tułowia oraz kończyn.
      location: new StringField({
        required: true,
        nullable: false,
        choices: [
          "general",
          "head",
          "torso",
          "leftArm",
          "rightArm",
          "leftLeg",
          "rightLeg"
        ],
        initial: "general"
      }),

      // Typ określa ciężar rany. Pełne nazwy pokazuje karta Itemu.
      injuryType: new StringField({
        required: true,
        nullable: false,
        choices: ["abrasion", "light", "serious", "critical"],
        initial: "abrasion"
      }),

      // Kara jest wartością procentową wynikającą z konkretnej rany.
      // Użytkownik wpisuje ją zgodnie z otrzymanym efektem rany.
      penaltyPercent: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0
      }),
      description: new StringField({
        required: true,
        nullable: false,
        initial: ""
      }),

      // Wartość obrażeń jest wyliczana z rodzaju rany i nie jest zapisywana.
      damageValue: new NumberField({
        required: true,
        nullable: false,
        integer: true,
        min: 0,
        initial: 0,
        persisted: false
      })
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.damageValue = DAMAGE_VALUE_BY_INJURY_TYPE[this.injuryType] ?? 0;
  }
}
