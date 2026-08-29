const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaEquipmentSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  // Ustawienia definiują rozmiar okna i automatyczny zapis zmienianych pól.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "equipment-sheet"],
    position: {
      width: 480,
      height: 420
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  // Szablon odpowiada za widoczną zawartość karty zwykłego przedmiotu.
  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/item/equipment-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Item jest całym dokumentem przedmiotu, a system zawiera dane naszego systemu.
    context.item = this.item;
    context.system = this.item.system;

    return context;
  }
}
