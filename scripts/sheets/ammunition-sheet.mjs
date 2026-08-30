import { weightUnitOptions } from "../utils/weight.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaAmmunitionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  // Automatyczny zapis pozwala od razu zobaczyć przeliczoną masę i wartość.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "ammunition-sheet"],
    position: {
      width: 500,
      height: 600
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/item/ammunition-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.weightUnitOptions = weightUnitOptions;

    // Klucze i nazwy pochodzą bezpośrednio z zakładki DIFFICULTY.
    context.craftingDifficultyOptions = {
      EASY: "Łatwy",
      AVERAGE: "Przeciętny",
      PROBLEMATIC: "Problematyczny",
      HARD: "Trudny",
      VHARD: "Bardzo trudny",
      XHARD: "Cholernie trudny",
      LUCKY: "Fart",
      IMPOSSIBLE: "Nie da się"
    };

    return context;
  }
}
