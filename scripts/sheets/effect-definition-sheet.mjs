import { getEffectAutomationDefinition } from "../catalogs/effect-definitions.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaEffectDefinitionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "effect-definition-sheet"],
    position: { width: 520, height: 430 },
    form: { closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = {
    main: { template: "systems/neuroshima/templates/item/effect-definition-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const automation = getEffectAutomationDefinition(this.item.system.sourceCode);
    context.item = this.item;
    context.system = this.item.system;
    context.isAutomated = Boolean(automation);
    context.automationDescription = automation?.scope.startsWith("attribute.")
      ? "Zmienia wartość wskazanego Współczynnika."
      : automation?.scope.startsWith("test.skill.")
        ? "Zmienia procentową trudność testów wskazanej Umiejętności."
        : "Efekt pozostaje opisowy i wymaga rozstrzygnięcia przez MG.";
    return context;
  }
}
