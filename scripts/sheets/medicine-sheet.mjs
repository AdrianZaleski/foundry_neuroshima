const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaMedicineSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "medicine-sheet"],
    position: { width: 560, height: 680 },
    form: { closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = {
    main: { template: "systems/neuroshima/templates/item/medicine-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    return context;
  }
}
