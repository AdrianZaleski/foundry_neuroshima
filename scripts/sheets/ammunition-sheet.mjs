import { weightUnitOptions } from "../utils/weight.mjs";
import { ammunitionCompatibilityOptions } from "../catalogs/ammunition-compatibility.mjs";
import {
  openRelatedWeaponOrAmmunition,
  prepareRelationsForAmmunition
} from "../compendia/weapon-ammunition-relations.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaAmmunitionSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  // Automatyczny zapis pozwala od razu zobaczyć przeliczoną masę i wartość.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "ammunition-sheet"],
    actions: {
      openRelatedItem: this.#onOpenRelatedItem
    },
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

  static async #onOpenRelatedItem(event, target) {
    await openRelatedWeaponOrAmmunition(this, target);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.weightUnitOptions = weightUnitOptions;
    context.ammunitionCompatibilityOptions = ammunitionCompatibilityOptions;
    context.ammunitionCompatibilityListId = `ammunition-symbols-${this.item.id}`;
    context.weaponRelations = await prepareRelationsForAmmunition(this.item);

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
