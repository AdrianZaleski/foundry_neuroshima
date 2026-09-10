import { getTraitBonusDefinition, getRequiredGender } from "../effects/trait-bonuses.mjs";
const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaFeatureSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "feature-sheet"],
    position: {
      width: 520,
      height: 560
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/item/feature-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    const definition = getTraitBonusDefinition(this.item);
    context.skillGroupOptions = definition?.groups ? { "": "Wybierz pakiet", ...definition.groups } : null;
    context.hasGenderRequirement = Boolean(getRequiredGender(this.item));
    context.genderOptions = { "": "Brak dodatkowego ograniczenia", female: "Tylko kobiety", male: "Tylko mężczyźni" };
    context.featureTypeName = this.item.type === "trait" ? "Cecha" : "Sztuczka";

    return context;
  }
}
