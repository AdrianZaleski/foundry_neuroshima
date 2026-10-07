import { weightUnitOptions } from "../utils/weight.mjs";
import { captureFieldState, restoreFieldState } from "./sheet-view-state.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class NeuroshimaArmorSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "armor-sheet"],
    position: { width: 680, height: 720 },
    window: { resizable: true },
    form: { closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = {
    main: { template: "systems/neuroshima/templates/item/armor-sheet.hbs", scrollable: [""] }
  };

  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    state.neuroshimaField = captureFieldState(priorElement);
    // Przywrócimy pole bez przewijania; zwykły focus Foundry przesuwa też okno nadrzędne.
    if (state.neuroshimaField) state.focus = undefined;
  }

  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    restoreFieldState(newElement, state.neuroshimaField, state.scrollPositions);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.weightUnitOptions = weightUnitOptions;
    context.armorClassOptions = {
      custom: "Własny / mieszany",
      light: "Lekki",
      medium: "Średni",
      heavy: "Ciężki",
      superHeavy: "Superciężki"
    };
    context.penaltyScopeOptions = {
      dexterity: "Wszystkie testy Zręczności",
      perception: "Tylko testy Percepcji"
    };
    context.locations = [
      ["head", "Głowa"], ["torso", "Tułów"],
      ["leftArm", "Lewa ręka"], ["rightArm", "Prawa ręka"],
      ["leftLeg", "Lewa noga"], ["rightLeg", "Prawa noga"]
    ].map(([key, label]) => ({ key, label, data: this.item.system[key] }));
    return context;
  }
}
