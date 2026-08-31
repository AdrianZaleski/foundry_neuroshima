import { rollAttribute } from "../rolls/attribute-roll.mjs";
import { rollSkill } from "../rolls/skill-roll.mjs";
import { ammunitionNamesBySymbol } from "../catalogs/ammunition-compatibility.mjs";
import {
  damageNamesBySymbol,
  describeAttackTypes
} from "../catalogs/combat-reference.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

// Karta postaci pokazuje polskie nazwy zamiast technicznych kodów zapisanych
// w danych broni. Nieznany kod nadal zostanie pokazany, aby nie ukrywać danych.
const weaponClassNames = {
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

const injuryLocationNames = {
  general: "Ogólne / inny efekt",
  head: "Głowa",
  torso: "Tułów",
  leftArm: "Lewa ręka",
  rightArm: "Prawa ręka",
  leftLeg: "Lewa noga",
  rightLeg: "Prawa noga"
};

const injuryTypeNames = {
  abrasion: "Draśnięcie",
  light: "Rana lekka",
  serious: "Rana ciężka",
  critical: "Rana krytyczna"
};

export class NeuroshimaCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // DEFAULT_OPTIONS opisuje zachowanie okna karty wspólne dla każdej postaci.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "character-sheet"],
    actions: {
      // Foundry wywoła tę metodę po kliknięciu elementu
      // posiadającego atrybut data-action="rollAttribute".
      rollAttribute: this.#onRollAttribute,
      rollSkill: this.#onRollSkill,

      // Każda rana jest osobnym Itemem osadzonym w postaci.
      createInjury: this.#onCreateInjury,
      editInjury: this.#onEditInjury,
      deleteInjury: this.#onDeleteInjury,

      // Te trzy akcje obsługują przedmioty zapisane wewnątrz konkretnej postaci.
      createEquipment: this.#onCreateEquipment,
      editEquipment: this.#onEditEquipment,
      deleteEquipment: this.#onDeleteEquipment,

      // Broń jest osobnym typem Itemu, dlatego otrzymuje osobne akcje.
      createWeapon: this.#onCreateWeapon,
      editWeapon: this.#onEditWeapon,
      deleteWeapon: this.#onDeleteWeapon,
      reloadWeapon: this.#onReloadWeapon,

      // Zapas amunicji jest niezależny od nabojów znajdujących się w broni.
      createAmmunition: this.#onCreateAmmunition,
      editAmmunition: this.#onEditAmmunition,
      deleteAmmunition: this.#onDeleteAmmunition
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

    // Kary wszystkich ran sumujemy przy każdym wyświetleniu karty.
    // Nie zapisujemy sumy, ponieważ zawsze wynika z aktualnej listy ran.
    context.injuryItems = this.actor.items
      .filter((item) => item.type === "injury")
      .map((item) => ({
        id: item.id,
        name: item.name,
        locationName: injuryLocationNames[item.system.location] ?? item.system.location,
        injuryTypeName: injuryTypeNames[item.system.injuryType] ?? item.system.injuryType,
        damageValue: item.system.damageValue,
        penaltyPercent: item.system.penaltyPercent
      }));

    context.totalWoundPenaltyPercent = context.injuryItems.reduce(
      (currentSum, injury) => currentSum + injury.penaltyPercent,
      0
    );

    context.totalDamageValue = context.injuryItems.reduce(
      (currentSum, injury) => currentSum + injury.damageValue,
      0
    );

    // Actor może posiadać różne typy Itemów. Ta lista zawiera wyłącznie
    // zwykły ekwipunek; broń przygotowujemy osobno poniżej.
    context.equipmentItems = this.actor.items
      .filter((item) => item.type === "equipment")
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.system.quantity,
        unitWeight: item.system.unitWeight,
        weightUnit: item.system.weightUnit,
        totalWeight: item.system.totalWeight,
        price: item.system.price
      }));

    // Łączna masa ekwipunku jest informacją wyliczaną. Nie zapisujemy jej
    // osobno, ponieważ zawsze można ją odtworzyć z przedmiotów postaci.
    const equipmentWeightSum = context.equipmentItems.reduce(
      (currentSum, item) => currentSum + item.totalWeight,
      0
    );
    context.totalEquipmentWeight = Math.round(equipmentWeightSum * 1000) / 1000;

    // Broń również jest osadzonym Itemem, ale pokazujemy ją na osobnej liście,
    // ponieważ posiada magazynek oraz parametry potrzebne później w walce.
    context.weaponItems = this.actor.items
      .filter((item) => item.type === "weapon")
      .map((item) => ({
        id: item.id,
        name: item.name,
        weaponClassName: weaponClassNames[item.system.weaponClass] ?? item.system.weaponClass,
        ammunitionCode: item.system.ammunitionCode,
        ammunitionName: ammunitionNamesBySymbol[item.system.ammunitionCode]
          ?? item.system.ammunitionCode,
        currentAmmunition: item.system.currentAmmunition,
        magazineCapacity: item.system.magazineCapacity,
        damageName: damageNamesBySymbol[item.system.damageCode]
          ?? item.system.damageCode,
        attackTypeNames: describeAttackTypes(item.system.attackTypes),
        range: item.system.range,
        armorPenetration: item.system.armorPenetration,
        weight: item.system.totalWeight
      }));

    const weaponWeightSum = context.weaponItems.reduce(
      (currentSum, item) => currentSum + item.weight,
      0
    );
    context.totalWeaponWeight = Math.round(weaponWeightSum * 1000) / 1000;

    // Każdy Item amunicji reprezentuje jeden zapas konkretnego rodzaju nabojów.
    context.ammunitionItems = this.actor.items
      .filter((item) => item.type === "ammunition")
      .map((item) => ({
        id: item.id,
        name: item.name,
        ammunitionSymbol: item.system.ammunitionSymbol,
        ammunitionCompatibilityName: ammunitionNamesBySymbol[item.system.ammunitionSymbol]
          ?? item.system.ammunitionSymbol,
        quantity: item.system.quantity,
        totalPrice: item.system.totalPrice,
        totalWeight: item.system.totalWeight
      }));

    const ammunitionWeightSum = context.ammunitionItems.reduce(
      (currentSum, item) => currentSum + item.totalWeight,
      0
    );
    context.totalAmmunitionWeight = Math.round(ammunitionWeightSum * 1000) / 1000;

    const ammunitionPriceSum = context.ammunitionItems.reduce(
      (currentSum, item) => currentSum + item.totalPrice,
      0
    );
    context.totalAmmunitionPrice = Math.round(ammunitionPriceSum * 100) / 100;

    // Łączne obciążenie obejmuje obecnie zwykły ekwipunek, broń i amunicję.
    // Kolejne typy przedmiotów, na przykład pancerz, dołączymy później.
    const carriedWeightSum = equipmentWeightSum + weaponWeightSum + ammunitionWeightSum;
    context.totalCarriedWeight = Math.round(carriedWeightSum * 1000) / 1000;

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

  static async #onCreateInjury() {
    const [createdInjury] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa rana",
        type: "injury"
      }
    ]);

    await createdInjury.sheet.render({ force: true });
  }

  static async #onEditInjury(event, target) {
    const itemId = target.dataset.itemId;
    const injuryItem = this.actor.items.get(itemId);

    if (!injuryItem || injuryItem.type !== "injury") {
      ui.notifications.warn("Nie znaleziono tej rany na karcie postaci.");
      return;
    }

    await injuryItem.sheet.render({ force: true });
  }

  static async #onDeleteInjury(event, target) {
    const itemId = target.dataset.itemId;
    const injuryItem = this.actor.items.get(itemId);

    if (!injuryItem || injuryItem.type !== "injury") {
      ui.notifications.warn("Nie znaleziono tej rany na karcie postaci.");
      return;
    }

    const safeInjuryName = foundry.utils.escapeHTML(injuryItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie rany"
      },
      content: `<p>Czy na pewno usunąć ranę <strong>${safeInjuryName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
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

  // Nowa broń powstaje bezpośrednio wewnątrz postaci i od razu otwiera
  // własną kartę, na której można uzupełnić jej parametry.
  static async #onCreateWeapon() {
    const [createdWeapon] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa broń",
        type: "weapon"
      }
    ]);

    await createdWeapon.sheet.render({ force: true });
  }

  static async #onEditWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const weaponItem = this.actor.items.get(itemId);

    if (!weaponItem || weaponItem.type !== "weapon") {
      ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
      return;
    }

    await weaponItem.sheet.render({ force: true });
  }

  // Przeładowanie porównuje kod wymagany przez broń z symbolem kompatybilności
  // zapasu amunicji. Nie opiera się na nazwach widocznych dla użytkownika.
  static async #onReloadWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const weaponItem = this.actor.items.get(itemId);

    if (!weaponItem || weaponItem.type !== "weapon") {
      ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
      return;
    }

    const magazineCapacity = weaponItem.system.magazineCapacity;
    const currentAmmunition = weaponItem.system.currentAmmunition;

    if (magazineCapacity <= 0) {
      ui.notifications.warn("Ta broń nie ma określonej pojemności magazynka.");
      return;
    }

    if (currentAmmunition >= magazineCapacity) {
      ui.notifications.info(`Magazynek broni ${weaponItem.name} jest już pełny.`);
      return;
    }

    const requiredAmmunitionSymbol = weaponItem.system.ammunitionCode.trim();

    if (!requiredAmmunitionSymbol) {
      ui.notifications.warn("Broń nie ma określonego kodu wymaganej amunicji.");
      return;
    }

    // Bierzemy pod uwagę tylko zgodne zapasy, w których pozostał co najmniej
    // jeden nabój. Puste Itemy pozostają na karcie, ale nie można ich użyć.
    const compatibleAmmunitionItems = this.actor.items.filter((item) => (
      item.type === "ammunition"
      && item.system.quantity > 0
      && item.system.ammunitionSymbol.trim() === requiredAmmunitionSymbol
    ));

    if (compatibleAmmunitionItems.length === 0) {
      ui.notifications.warn(`Brak amunicji zgodnej z kodem ${requiredAmmunitionSymbol}.`);
      return;
    }

    let selectedAmmunitionItem = compatibleAmmunitionItems[0];

    // Kilka wariantów może mieć ten sam symbol, na przykład zwykłe i sportowe
    // strzały. W takiej sytuacji użytkownik wybiera konkretny zapas.
    if (compatibleAmmunitionItems.length > 1) {
      const ammunitionOptions = compatibleAmmunitionItems
        .map((ammunitionItem) => {
          const safeName = foundry.utils.escapeHTML(ammunitionItem.name);
          return `<option value="${ammunitionItem.id}">${safeName} (${ammunitionItem.system.quantity} szt.)</option>`;
        })
        .join("");

      const formData = await foundry.applications.api.DialogV2.input({
        window: {
          title: `Przeładowanie: ${weaponItem.name}`
        },
        content: `
          <div class="form-group">
            <label for="neuroshima-ammunition-item">Wybierz zapas amunicji</label>
            <select id="neuroshima-ammunition-item" name="ammunitionItemId">
              ${ammunitionOptions}
            </select>
          </div>
        `,
        ok: {
          label: "Przeładuj"
        },
        rejectClose: false,
        modal: true
      });

      if (!formData) return;

      selectedAmmunitionItem = this.actor.items.get(String(formData.ammunitionItemId));

      if (!selectedAmmunitionItem || selectedAmmunitionItem.type !== "ammunition") {
        ui.notifications.warn("Nie znaleziono wybranego zapasu amunicji.");
        return;
      }
    }

    const missingAmmunition = magazineCapacity - currentAmmunition;
    const transferredAmmunition = Math.min(
      missingAmmunition,
      selectedAmmunitionItem.system.quantity
    );

    const loadedAmmunitionSourceCode = weaponItem.system.loadedAmmunitionSourceCode;
    const selectedAmmunitionSourceCode = selectedAmmunitionItem.system.sourceCode;

    // Nie mieszamy automatycznie dwóch specjalnych wariantów w jednym
    // magazynku. Najpierw trzeba opróżnić magazynek na karcie broni.
    if (
      currentAmmunition > 0
      && loadedAmmunitionSourceCode
      && loadedAmmunitionSourceCode !== selectedAmmunitionSourceCode
    ) {
      ui.notifications.warn(
        "W magazynku znajduje się inny wariant amunicji. Najpierw opróżnij magazynek."
      );
      return;
    }

    // Oba dokumenty aktualizujemy jednym wywołaniem Foundry. Dzięki temu
    // magazynek i zapas nie rozjadą się w połowie operacji.
    await this.actor.updateEmbeddedDocuments("Item", [
      {
        _id: weaponItem.id,
        "system.currentAmmunition": currentAmmunition + transferredAmmunition,
        "system.loadedAmmunitionSourceCode": selectedAmmunitionSourceCode,
        // Broń przechowuje masę jednego załadowanego naboju w kilogramach.
        // Dzięki temu późniejsza zmiana jednostki na Itemie amunicji nie psuje magazynka.
        "system.loadedAmmunitionUnitWeight": selectedAmmunitionItem.system.unitWeightInKilograms
      },
      {
        _id: selectedAmmunitionItem.id,
        "system.quantity": selectedAmmunitionItem.system.quantity - transferredAmmunition
      }
    ]);

    ui.notifications.info(
      `${weaponItem.name}: załadowano ${transferredAmmunition} szt. amunicji.`
    );
  }

  // Potwierdzenie chroni przed przypadkowym usunięciem całej broni wraz
  // z zapisanym stanem magazynka i pozostałymi danymi egzemplarza.
  static async #onDeleteWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const weaponItem = this.actor.items.get(itemId);

    if (!weaponItem || weaponItem.type !== "weapon") {
      ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
      return;
    }

    const safeWeaponName = foundry.utils.escapeHTML(weaponItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie broni"
      },
      content: `<p>Czy na pewno usunąć broń <strong>${safeWeaponName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  // Amunicję tworzymy wewnątrz postaci, ponieważ jej ilość jest prywatnym
  // stanem tej postaci i będzie się później zmniejszać podczas przeładowania.
  static async #onCreateAmmunition() {
    const [createdAmmunition] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa amunicja",
        type: "ammunition"
      }
    ]);

    await createdAmmunition.sheet.render({ force: true });
  }

  static async #onEditAmmunition(event, target) {
    const itemId = target.dataset.itemId;
    const ammunitionItem = this.actor.items.get(itemId);

    if (!ammunitionItem || ammunitionItem.type !== "ammunition") {
      ui.notifications.warn("Nie znaleziono tej amunicji na karcie postaci.");
      return;
    }

    await ammunitionItem.sheet.render({ force: true });
  }

  // Usuwamy cały zapas danego rodzaju amunicji, dlatego operacja wymaga
  // wyraźnego potwierdzenia użytkownika.
  static async #onDeleteAmmunition(event, target) {
    const itemId = target.dataset.itemId;
    const ammunitionItem = this.actor.items.get(itemId);

    if (!ammunitionItem || ammunitionItem.type !== "ammunition") {
      ui.notifications.warn("Nie znaleziono tej amunicji na karcie postaci.");
      return;
    }

    const safeAmmunitionName = foundry.utils.escapeHTML(ammunitionItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie amunicji"
      },
      content: `<p>Czy na pewno usunąć amunicję <strong>${safeAmmunitionName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }
}
