import { prepareDiseaseCatalog } from "../catalogs/health-reference.mjs";

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
    const diseaseCatalog = await prepareDiseaseCatalog();

    // Nieznany kod zachowujemy jako dodatkową opcję, aby edycja Itemu nie
    // usuwała własnego powiązania tylko dlatego, że brak go w Compendium.
    if (
      this.item.system.diseaseSourceCode
      && !diseaseCatalog.options[this.item.system.diseaseSourceCode]
    ) {
      diseaseCatalog.options[this.item.system.diseaseSourceCode] =
        `Nieznana choroba (${this.item.system.diseaseSourceCode})`;
    }

    context.diseaseOptions = diseaseCatalog.options;
    context.linkedDiseaseName = diseaseCatalog.namesBySourceCode[
      this.item.system.diseaseSourceCode
    ] ?? "";
    return context;
  }
}
