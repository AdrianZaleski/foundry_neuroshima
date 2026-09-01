import { weightUnitOptions } from "../utils/weight.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaArmorSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "armor-sheet"],
    position: { width: 680, height: 720 },
    form: { closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = {
    main: { template: "systems/neuroshima/templates/item/armor-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.weightUnitOptions = weightUnitOptions;
    context.armorClassOptions = {
      custom: "Własny / mieszany",
      light: "Lekki",
      medium: "Średni",
      heavy: "Ciężki",
      superHeavy: "Superciężki"
    };
    context.penaltyScopeOptions = {
      dexterity: "Wszystkie testy Zręczności",
      perception: "Tylko testy Percepcji"
    };
    context.locations = [
      ["head", "Głowa"], ["torso", "Tułów"],
      ["leftArm", "Lewa ręka"], ["rightArm", "Prawa ręka"],
      ["leftLeg", "Lewa noga"], ["rightLeg", "Prawa noga"]
    ].map(([key, label]) => ({ key, label, data: this.item.system[key] }));
    return context;
  }
}
