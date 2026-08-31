const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const backgroundTypeNames = {
  origin: "Pochodzenie",
  profession: "Profesja",
  specialization: "Specjalizacja"
};

export class NeuroshimaBackgroundSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "background-sheet"],
    position: {
      width: 560,
      height: 620
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/item/background-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    context.item = this.item;
    context.system = this.item.system;
    context.backgroundTypeName = backgroundTypeNames[this.item.type] ?? this.item.type;

    return context;
  }
}
