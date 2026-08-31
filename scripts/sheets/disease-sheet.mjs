import { prepareMedicinesByDisease } from "../catalogs/health-reference.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export const diseaseStageOptions = {
  first: "Etap pierwszy",
  second: "Etap drugi",
  third: "Etap trzeci",
  terminal: "Stan terminalny"
};

export class NeuroshimaDiseaseSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "disease-sheet"],
    position: { width: 620, height: 760 },
    form: { closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = {
    main: { template: "systems/neuroshima/templates/item/disease-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.diseaseStageOptions = diseaseStageOptions;
    const medicinesByDisease = await prepareMedicinesByDisease();
    context.linkedMedicines = medicinesByDisease[this.item.system.sourceCode] ?? [];
    return context;
  }
}
