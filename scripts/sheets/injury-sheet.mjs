const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaInjurySheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "injury-sheet"],
    position: {
      width: 480,
      height: 440
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/item/injury-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;

    // Klucze są zapisywane w danych. Polskie nazwy widzi użytkownik.
    context.locationOptions = {
      general: "Ogólne / inny efekt",
      head: "Głowa",
      torso: "Tułów",
      leftArm: "Lewa ręka",
      rightArm: "Prawa ręka",
      leftLeg: "Lewa noga",
      rightLeg: "Prawa noga"
    };
    context.injuryTypeOptions = {
      abrasion: "Draśnięcie (D)",
      light: "Rana lekka (L)",
      serious: "Rana ciężka (C)",
      critical: "Rana krytyczna (K)"
    };

    return context;
  }
}
