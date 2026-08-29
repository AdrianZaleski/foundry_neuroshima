import { rollAttribute } from "../rolls/attribute-roll.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NeuroshimaCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // DEFAULT_OPTIONS opisuje zachowanie okna karty wspólne dla każdej postaci.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "character-sheet"],
    actions: {
      // Foundry wywoła tę metodę po kliknięciu elementu
      // posiadającego atrybut data-action="rollAttribute".
      rollAttribute: this.#onRollAttribute
    },
    position: {
      width: 520,
      height: 420
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  // PARTS wskazuje plik Handlebars odpowiedzialny za zawartość okna karty.
  static PARTS = {
    main: {
      template: "systems/neuroshima/templates/actor/character-sheet.hbs"
    }
  };

  async _prepareContext(options) {
    // Najpierw pobieramy standardowe dane przygotowane przez Foundry.
    const context = await super._prepareContext(options);

    // Udostępniamy szablonowi kartę Actora oraz jej dane systemowe.
    context.actor = this.actor;
    context.system = this.actor.system;

    return context;
  }

  // Parametry "event" i "target" są przekazywane przez mechanizm akcji Foundry.
  // "target" oznacza przycisk, który został kliknięty przez użytkownika.
  static async #onRollAttribute(event, target) {
    const attributeKey = target.dataset.attribute;
    await rollAttribute(this.actor, attributeKey);
  }
}
