import { rollAttribute } from "../rolls/attribute-roll.mjs";
import { rollSkill } from "../rolls/skill-roll.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class NeuroshimaCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // DEFAULT_OPTIONS opisuje zachowanie okna karty wspólne dla każdej postaci.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "character-sheet"],
    actions: {
      // Foundry wywoła tę metodę po kliknięciu elementu
      // posiadającego atrybut data-action="rollAttribute".
      rollAttribute: this.#onRollAttribute,
      rollSkill: this.#onRollSkill,

      // Te trzy akcje obsługują przedmioty zapisane wewnątrz konkretnej postaci.
      createEquipment: this.#onCreateEquipment,
      editEquipment: this.#onEditEquipment,
      deleteEquipment: this.#onDeleteEquipment
    },
    position: {
      width: 520,
      // Większa wysokość pozwala zobaczyć pierwszą grupę umiejętności bez przewijania.
      height: 560
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

    // Słownik zasila listy wyboru współczynnika przy własnych umiejętnościach.
    // Klucz jest zapisywany w danych, a polska nazwa jest wyświetlana użytkownikowi.
    context.attributeOptions = {
      zrecznosc: "Zręczność",
      percepcja: "Percepcja",
      charakter: "Charakter",
      spryt: "Spryt",
      budowa: "Budowa"
    };

    // Actor może posiadać różne typy Itemów. Na tej liście pokazujemy obecnie
    // tylko zwykły ekwipunek, ponieważ broń i pancerz dodamy w kolejnych etapach.
    context.equipmentItems = this.actor.items
      .filter((item) => item.type === "equipment")
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.system.quantity,
        unitWeight: item.system.unitWeight,
        totalWeight: item.system.totalWeight,
        price: item.system.price
      }));

    // Łączna masa ekwipunku jest informacją wyliczaną. Nie zapisujemy jej
    // osobno, ponieważ zawsze można ją odtworzyć z przedmiotów postaci.
    const equipmentWeightSum = context.equipmentItems.reduce(
      (currentSum, item) => currentSum + item.totalWeight,
      0
    );
    context.totalEquipmentWeight = Math.round(equipmentWeightSum * 100) / 100;

    return context;
  }

  // Parametry "event" i "target" są przekazywane przez mechanizm akcji Foundry.
  // "target" oznacza przycisk, który został kliknięty przez użytkownika.
  static async #onRollAttribute(event, target) {
    const attributeKey = target.dataset.attribute;
    await rollAttribute(this.actor, attributeKey);
  }

  // Klucz umiejętności odczytujemy z przycisku i przekazujemy do mechaniki testu.
  static async #onRollSkill(event, target) {
    const skillKey = target.dataset.skill;
    await rollSkill(this.actor, skillKey);
  }

  // Tworzymy nowy Item bezpośrednio wewnątrz Actora. Taki przedmiot należy
  // wyłącznie do tej postaci i może mieć własną ilość, masę, cenę oraz opis.
  static async #onCreateEquipment() {
    const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowy przedmiot",
        type: "equipment"
      }
    ]);

    // Po utworzeniu od razu otwieramy kartę przedmiotu do uzupełnienia.
    await createdItem.sheet.render({ force: true });
  }

  // Identyfikator z przycisku pozwala odnaleźć właściwy Item należący do Actora.
  static async #onEditEquipment(event, target) {
    const itemId = target.dataset.itemId;
    const equipmentItem = this.actor.items.get(itemId);

    if (!equipmentItem) {
      ui.notifications.warn("Nie znaleziono tego przedmiotu na karcie postaci.");
      return;
    }

    await equipmentItem.sheet.render({ force: true });
  }

  // Usunięcie osadzonego Itemu jest trwałe, dlatego najpierw pytamy użytkownika
  // o potwierdzenie i pokazujemy nazwę przedmiotu, którego dotyczy operacja.
  static async #onDeleteEquipment(event, target) {
    const itemId = target.dataset.itemId;
    const equipmentItem = this.actor.items.get(itemId);

    if (!equipmentItem) {
      ui.notifications.warn("Nie znaleziono tego przedmiotu na karcie postaci.");
      return;
    }

    // Nazwa jest tekstem wpisanym przez użytkownika, więc przed umieszczeniem
    // jej w kodzie HTML zamieniamy znaki specjalne na bezpieczną postać.
    const safeItemName = foundry.utils.escapeHTML(equipmentItem.name);

    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie przedmiotu"
      },
      content: `<p>Czy na pewno usunąć przedmiot <strong>${safeItemName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }
}
