import { weightUnitOptions } from "../utils/weight.mjs";
import { ammunitionCompatibilityOptions } from "../catalogs/ammunition-compatibility.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaWeaponSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  // Karta zapisuje zmienione dane automatycznie, tak samo jak karta ekwipunku.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "weapon-sheet"],
    position: {
      width: 540,
      height: 650
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/item/weapon-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.weightUnitOptions = weightUnitOptions;
    context.ammunitionCompatibilityOptions = ammunitionCompatibilityOptions;
    context.ammunitionCompatibilityListId = `weapon-ammunition-${this.item.id}`;

    // Klucze pochodzą z zakładki WEAPON, a polskie nazwy są przeznaczone
    // dla użytkownika karty. Sam klucz pozostaje zapisany w danych Itemu.
    context.weaponClassOptions = {
      ARIFLE: "Karabin automatyczny",
      MACHINEGUN: "Karabin maszynowy",
      RIFLE: "Karabin półautomatyczny",
      MPISTOL: "Pistolet maszynowy",
      PISTOL: "Pistolet",
      REVOLVER: "Rewolwer",
      REPEATER: "Karabin powtarzalny",
      LAUNCHER: "Granatnik",
      BLACKPOWDER: "Broń czarnoprochowa",
      PROJECTILE: "Broń miotana",
      SNIPER: "Karabin snajperski",
      SHOTGUN: "Śrutówka"
    };

    // Zakładka RANGED używa czterech podstawowych kodów obrażeń od broni.
    context.damageOptions = {
      D_D: "Draśnięcie",
      D_L: "Obrażenia lekkie",
      D_C: "Obrażenia ciężkie",
      D_K: "Obrażenia krytyczne"
    };

    return context;
  }
}
