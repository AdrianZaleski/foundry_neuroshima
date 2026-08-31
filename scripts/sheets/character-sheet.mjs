import { rollAttribute } from "../rolls/attribute-roll.mjs";
import { rollSkill } from "../rolls/skill-roll.mjs";
import { ammunitionNamesBySymbol } from "../catalogs/ammunition-compatibility.mjs";
import {
  damageNamesBySymbol,
  describeAttackTypes
} from "../catalogs/combat-reference.mjs";
import {
  prepareDiseaseCatalog,
  prepareMedicinesByDisease
} from "../catalogs/health-reference.mjs";
import { rollNeuroshimaInitiative } from "../combat/initiative.mjs";

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

const meleeDamageThresholdNames = {
  below10: "Budowa < 10",
  below12: "Budowa < 12",
  below13: "Budowa < 13",
  below14: "Budowa < 14",
  below15: "Budowa < 15",
  below16: "Budowa < 16",
  below18: "Budowa < 18",
  below19: "Budowa < 19"
};

const diseaseStageNames = {
  first: "Etap pierwszy",
  second: "Etap drugi",
  third: "Etap trzeci",
  terminal: "Stan terminalny"
};

const diseaseStageOrder = Object.keys(diseaseStageNames);

async function changeDiseaseStage(characterSheet, target, direction) {
  const diseaseItem = characterSheet.actor.items.get(target.dataset.itemId);
  if (!diseaseItem || diseaseItem.type !== "disease") {
    ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
    return;
  }

  const currentIndex = diseaseStageOrder.indexOf(diseaseItem.system.currentStage);
  const safeCurrentIndex = Math.max(0, currentIndex);
  const nextIndex = Math.min(
    diseaseStageOrder.length - 1,
    Math.max(0, safeCurrentIndex + direction)
  );
  if (nextIndex === currentIndex) return;

  await diseaseItem.update({ "system.currentStage": diseaseStageOrder[nextIndex] });
}

function describeMeleeDamageProfile(damageByBuild) {
  return Object.entries(meleeDamageThresholdNames)
    .filter(([damageKey]) => damageByBuild[damageKey])
    .map(([damageKey, thresholdName]) => (
      `${thresholdName}: ${damageByBuild[damageKey]}`
    ))
    .join(" | ");
}

// Actor zapisuje wyłącznie stabilny kod wybranego wpisu. Czytelne nazwy oraz
// opisy pobieramy z indeksu Compendium, dzięki czemu aktualizacja katalogu nie
// wymaga przepisywania danych wszystkich postaci w świecie.
async function prepareBackgroundCatalog(compendiumId, selectedSourceCode) {
  const customOptionLabel = "Własne / brak wyboru katalogowego";
  const compendium = game.packs.get(compendiumId);

  if (!compendium) {
    return {
      options: { "": customOptionLabel },
      selectedEntry: null
    };
  }

  await compendium.getIndex({
    fields: [
      "system.sourceCode",
      "system.ruleset",
      "system.description",
      "system.flavorText",
      "system.bonus"
    ]
  });

  const entries = [...compendium.index.values()]
    .map((entry) => ({
      name: entry.name,
      sourceCode: entry.system?.sourceCode ?? "",
      ruleset: entry.system?.ruleset ?? "",
      description: entry.system?.description ?? "",
      flavorText: entry.system?.flavorText ?? "",
      bonus: entry.system?.bonus ?? ""
    }))
    .filter((entry) => entry.sourceCode)
    .sort((leftEntry, rightEntry) => leftEntry.name.localeCompare(
      rightEntry.name,
      "pl"
    ));

  const options = { "": customOptionLabel };
  for (const entry of entries) options[entry.sourceCode] = entry.name;

  const selectedEntry = entries.find(
    (entry) => entry.sourceCode === selectedSourceCode
  ) ?? null;

  // Nie usuwamy kodu, którego nie ma już w katalogu. Taki wpis pozostaje
  // widoczny na liście i może zostać świadomie zmieniony przez użytkownika.
  if (selectedSourceCode && !selectedEntry) {
    options[selectedSourceCode] = `Nieznany wpis (${selectedSourceCode})`;
  }

  return { options, selectedEntry };
}

export class NeuroshimaCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // DEFAULT_OPTIONS opisuje zachowanie okna karty wspólne dla każdej postaci.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "character-sheet"],
    actions: {
      // Foundry wywoła tę metodę po kliknięciu elementu
      // posiadającego atrybut data-action="rollAttribute".
      rollAttribute: this.#onRollAttribute,
      rollSkill: this.#onRollSkill,
      rollInitiative: this.#onRollInitiative,
      saveActorName: this.#onSaveActorName,

      // Każda rana jest osobnym Itemem osadzonym w postaci.
      createInjury: this.#onCreateInjury,
      editInjury: this.#onEditInjury,
      deleteInjury: this.#onDeleteInjury,

      // Sztuczki i cechy korzystają ze wspólnej obsługi, a ich dokładny typ
      // jest przekazywany przez przycisk tworzenia.
      createFeature: this.#onCreateFeature,
      editFeature: this.#onEditFeature,
      deleteFeature: this.#onDeleteFeature,

      // Te trzy akcje obsługują przedmioty zapisane wewnątrz konkretnej postaci.
      createEquipment: this.#onCreateEquipment,
      editEquipment: this.#onEditEquipment,
      deleteEquipment: this.#onDeleteEquipment,

      // Broń jest osobnym typem Itemu, dlatego otrzymuje osobne akcje.
      createWeapon: this.#onCreateWeapon,
      editWeapon: this.#onEditWeapon,
      deleteWeapon: this.#onDeleteWeapon,
      reloadWeapon: this.#onReloadWeapon,

      createMeleeWeapon: this.#onCreateMeleeWeapon,
      editMeleeWeapon: this.#onEditMeleeWeapon,
      deleteMeleeWeapon: this.#onDeleteMeleeWeapon,

      // Zapas amunicji jest niezależny od nabojów znajdujących się w broni.
      createAmmunition: this.#onCreateAmmunition,
      editAmmunition: this.#onEditAmmunition,
      deleteAmmunition: this.#onDeleteAmmunition,

      createDisease: this.#onCreateDisease,
      editDisease: this.#onEditDisease,
      deleteDisease: this.#onDeleteDisease,
      previousDiseaseStage: this.#onPreviousDiseaseStage,
      nextDiseaseStage: this.#onNextDiseaseStage,

      createMedicine: this.#onCreateMedicine,
      editMedicine: this.#onEditMedicine,
      deleteMedicine: this.#onDeleteMedicine,
      consumeMedicine: this.#onConsumeMedicine
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

  // TABS jest natywną konfiguracją zakładek ApplicationV2 w Foundry 14.
  // Foundry zapamiętuje aktywną zakładkę podczas ponownego renderowania karty.
  static TABS = {
    sheet: {
      tabs: [
        { id: "main", icon: "fa-solid fa-user", label: "Główne" },
        { id: "details", icon: "fa-solid fa-address-card", label: "Postać" },
        { id: "skills", icon: "fa-solid fa-list-check", label: "Umiejętności" },
        { id: "health", icon: "fa-solid fa-heart-pulse", label: "Zdrowie" },
        { id: "inventory", icon: "fa-solid fa-box-open", label: "Ekwipunek" }
      ],
      initial: "main"
    }
  };

  // Każda zakładka ma własny, mniejszy szablon Handlebars. Zmiana układu
  // ekwipunku nie wymaga dzięki temu edycji pól umiejętności albo ran.
  static PARTS = {
    navigation: {
      template: "templates/generic/tab-navigation.hbs"
    },
    main: {
      template: "systems/neuroshima/templates/actor/parts/main-tab.hbs"
    },
    details: {
      template: "systems/neuroshima/templates/actor/parts/details-tab.hbs"
    },
    skills: {
      template: "systems/neuroshima/templates/actor/parts/skills-tab.hbs"
    },
    health: {
      template: "systems/neuroshima/templates/actor/parts/health-tab.hbs"
    },
    inventory: {
      template: "systems/neuroshima/templates/actor/parts/inventory-tab.hbs"
    }
  };

  async _prepareContext(options) {
    // Najpierw pobieramy standardowe dane przygotowane przez Foundry.
    const context = await super._prepareContext(options);

    // Udostępniamy szablonowi kartę Actora oraz jej dane systemowe.
    context.actor = this.actor;
    context.system = this.actor.system;

    const [
      originCatalog,
      professionCatalog,
      specializationCatalog,
      diseaseCatalog,
      medicinesByDisease
    ] = await Promise.all([
      prepareBackgroundCatalog(
        "world.neuroshima-origins",
        this.actor.system.background.originSourceCode
      ),
      prepareBackgroundCatalog(
        "world.neuroshima-professions",
        this.actor.system.background.professionSourceCode
      ),
      prepareBackgroundCatalog(
        "world.neuroshima-specializations",
        this.actor.system.background.specializationSourceCode
      ),
      prepareDiseaseCatalog(),
      prepareMedicinesByDisease()
    ]);

    context.originOptions = originCatalog.options;
    context.professionOptions = professionCatalog.options;
    context.specializationOptions = specializationCatalog.options;
    context.selectedOrigin = originCatalog.selectedEntry;
    context.selectedProfession = professionCatalog.selectedEntry;
    context.selectedSpecialization = specializationCatalog.selectedEntry;

    // Choroba przeciągnięta z Compendium staje się niezależnym Itemem Actora.
    // Aktualny etap można dzięki temu zmieniać bez modyfikowania wzorca.
    context.diseaseItems = this.actor.items
      .filter((item) => item.type === "disease")
      .map((item) => {
        const currentStage = item.system.stages[item.system.currentStage];
        return {
          id: item.id,
          name: item.name,
          currentStageName: diseaseStageNames[item.system.currentStage]
            ?? item.system.currentStage,
          currentStageSummary: currentStage?.summary ?? "",
          currentStageDescription: currentStage?.description ?? "",
          currentStageEffect: currentStage?.effect ?? "",
          medicationDescription: item.system.medicationDescription,
          linkedMedicines: medicinesByDisease[item.system.sourceCode] ?? [],
          canMoveBack: diseaseStageOrder.indexOf(item.system.currentStage) > 0,
          canMoveForward: diseaseStageOrder.indexOf(item.system.currentStage)
            < diseaseStageOrder.length - 1
        };
      });

    context.medicineItems = this.actor.items
      .filter((item) => item.type === "medicine")
      .map((item) => ({
        id: item.id,
        name: item.name,
        diseaseName: diseaseCatalog.namesBySourceCode[item.system.diseaseSourceCode]
          ?? item.system.diseaseSourceCode
          ?? "",
        quantity: item.system.quantity,
        packageSize: item.system.packageSize,
        price: item.system.price,
        availability: item.system.availability,
        effect: item.system.effect,
        effectDurationHours: item.system.effectDurationHours,
        flavorText: item.system.flavorText
      }));

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

    // Cechy i sztuczki są osadzonymi Itemami. Przygotowujemy dwie listy,
    // aby karta mogła pokazać je osobno mimo wspólnego modelu danych.
    const prepareFeatureItem = (item) => ({
      id: item.id,
      name: item.name,
      requirements: item.system.requirements,
      effects: item.system.effects,
      description: item.system.description
    });

    context.perkItems = this.actor.items
      .filter((item) => item.type === "perk")
      .map(prepareFeatureItem);

    context.traitItems = this.actor.items
      .filter((item) => item.type === "trait")
      .map(prepareFeatureItem);

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

    context.meleeWeaponItems = this.actor.items
      .filter((item) => item.type === "meleeWeapon")
      .map((item) => ({
        id: item.id,
        name: item.name,
        armorPenetration: item.system.armorPenetration,
        attackBonus: item.system.attackBonus,
        defenseBonus: item.system.defenseBonus,
        multipleOpponentsBonus: item.system.multipleOpponentsBonus,
        requiredBuild: item.system.requiredBuild,
        initiativeBonus: item.system.initiativeBonus,
        damageProfileDescription: describeMeleeDamageProfile(
          item.system.damageByBuild
        ),
        weight: item.system.weightInKilograms
      }));

    const meleeWeaponWeightSum = context.meleeWeaponItems.reduce(
      (currentSum, item) => currentSum + item.weight,
      0
    );
    context.totalMeleeWeaponWeight = Math.round(meleeWeaponWeightSum * 1000) / 1000;

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

    // Łączne obciążenie obejmuje obecnie zwykły ekwipunek, oba rodzaje broni
    // oraz amunicję.
    // Kolejne typy przedmiotów, na przykład pancerz, dołączymy później.
    const carriedWeightSum = equipmentWeightSum
      + meleeWeaponWeightSum
      + weaponWeightSum
      + ammunitionWeightSum;
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

  static async #onRollInitiative() {
    const activeCombat = game.combat;
    const combatant = activeCombat?.combatants.find(
      (candidate) => candidate.actor?.id === this.actor.id
    );

    if (combatant) {
      await activeCombat.rollInitiative(combatant.id);
      return;
    }

    await rollNeuroshimaInitiative(this.actor);
    ui.notifications.info(
      "Actor nie uczestniczy w aktywnej walce. Wynik zapisano tylko na czacie."
    );
  }

  static async #onSaveActorName(event, target) {
    const actorNameInput = target.closest("header")?.querySelector("[data-actor-name]");
    const newActorName = actorNameInput?.value.trim();

    if (!newActorName) {
      ui.notifications.warn("Ksywa postaci nie może być pusta.");
      return;
    }

    if (newActorName === this.actor.name) return;
    await this.actor.update({ name: newActorName });
    ui.notifications.info(`Zapisano ksywę: ${newActorName}.`);
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

  static async #onCreateDisease() {
    const [createdDisease] = await this.actor.createEmbeddedDocuments("Item", [
      { name: "Nowa choroba", type: "disease" }
    ]);
    await createdDisease.sheet.render({ force: true });
  }

  static async #onEditDisease(event, target) {
    const diseaseItem = this.actor.items.get(target.dataset.itemId);
    if (!diseaseItem || diseaseItem.type !== "disease") {
      ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
      return;
    }
    await diseaseItem.sheet.render({ force: true });
  }

  static async #onDeleteDisease(event, target) {
    const diseaseItem = this.actor.items.get(target.dataset.itemId);
    if (!diseaseItem || diseaseItem.type !== "disease") {
      ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
      return;
    }

    const safeDiseaseName = foundry.utils.escapeHTML(diseaseItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Usuwanie choroby" },
      content: `<p>Czy na pewno usunąć chorobę <strong>${safeDiseaseName}</strong>?</p>`,
      modal: true
    });
    if (!deletionConfirmed) return;
    await this.actor.deleteEmbeddedDocuments("Item", [diseaseItem.id]);
  }

  static async #onPreviousDiseaseStage(event, target) {
    await changeDiseaseStage(this, target, -1);
  }

  static async #onNextDiseaseStage(event, target) {
    await changeDiseaseStage(this, target, 1);
  }

  static async #onCreateMedicine() {
    const [createdMedicine] = await this.actor.createEmbeddedDocuments("Item", [
      { name: "Nowy lek", type: "medicine" }
    ]);
    await createdMedicine.sheet.render({ force: true });
  }

  static async #onEditMedicine(event, target) {
    const medicineItem = this.actor.items.get(target.dataset.itemId);
    if (!medicineItem || medicineItem.type !== "medicine") {
      ui.notifications.warn("Nie znaleziono tego leku na karcie postaci.");
      return;
    }
    await medicineItem.sheet.render({ force: true });
  }

  static async #onConsumeMedicine(event, target) {
    const medicineItem = this.actor.items.get(target.dataset.itemId);
    if (!medicineItem || medicineItem.type !== "medicine") {
      ui.notifications.warn("Nie znaleziono tego leku na karcie postaci.");
      return;
    }
    if (medicineItem.system.quantity <= 0) {
      ui.notifications.warn(`Brak dawek leku ${medicineItem.name}.`);
      return;
    }

    await medicineItem.update({ "system.quantity": medicineItem.system.quantity - 1 });
    ui.notifications.info(
      `${medicineItem.name}: zużyto jedną dawkę. Efekt należy rozstrzygnąć zgodnie z opisem.`
    );
  }

  static async #onDeleteMedicine(event, target) {
    const medicineItem = this.actor.items.get(target.dataset.itemId);
    if (!medicineItem || medicineItem.type !== "medicine") {
      ui.notifications.warn("Nie znaleziono tego leku na karcie postaci.");
      return;
    }

    const safeMedicineName = foundry.utils.escapeHTML(medicineItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Usuwanie leku" },
      content: `<p>Czy na pewno usunąć lek <strong>${safeMedicineName}</strong>?</p>`,
      modal: true
    });
    if (!deletionConfirmed) return;
    await this.actor.deleteEmbeddedDocuments("Item", [medicineItem.id]);
  }

  static async #onCreateFeature(event, target) {
    const featureType = target.dataset.featureType;
    const featureTypeNames = {
      perk: "Nowa sztuczka",
      trait: "Nowa cecha"
    };

    if (!featureTypeNames[featureType]) {
      ui.notifications.warn("Nieznany rodzaj zdolności postaci.");
      return;
    }

    const [createdFeature] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: featureTypeNames[featureType],
        type: featureType
      }
    ]);

    await createdFeature.sheet.render({ force: true });
  }

  static async #onEditFeature(event, target) {
    const itemId = target.dataset.itemId;
    const featureItem = this.actor.items.get(itemId);

    if (!featureItem || !["perk", "trait"].includes(featureItem.type)) {
      ui.notifications.warn("Nie znaleziono tej sztuczki lub cechy na karcie postaci.");
      return;
    }

    await featureItem.sheet.render({ force: true });
  }

  static async #onDeleteFeature(event, target) {
    const itemId = target.dataset.itemId;
    const featureItem = this.actor.items.get(itemId);

    if (!featureItem || !["perk", "trait"].includes(featureItem.type)) {
      ui.notifications.warn("Nie znaleziono tej sztuczki lub cechy na karcie postaci.");
      return;
    }

    const safeFeatureName = foundry.utils.escapeHTML(featureItem.name);
    const featureTypeName = featureItem.type === "trait" ? "cechę" : "sztuczkę";
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie zdolności"
      },
      content: `<p>Czy na pewno usunąć ${featureTypeName} <strong>${safeFeatureName}</strong>?</p>`,
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

  static async #onCreateMeleeWeapon() {
    const [createdWeapon] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa broń ręczna",
        type: "meleeWeapon"
      }
    ]);

    await createdWeapon.sheet.render({ force: true });
  }

  static async #onEditMeleeWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const meleeWeaponItem = this.actor.items.get(itemId);

    if (!meleeWeaponItem || meleeWeaponItem.type !== "meleeWeapon") {
      ui.notifications.warn("Nie znaleziono tej broni ręcznej na karcie postaci.");
      return;
    }

    await meleeWeaponItem.sheet.render({ force: true });
  }

  static async #onDeleteMeleeWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const meleeWeaponItem = this.actor.items.get(itemId);

    if (!meleeWeaponItem || meleeWeaponItem.type !== "meleeWeapon") {
      ui.notifications.warn("Nie znaleziono tej broni ręcznej na karcie postaci.");
      return;
    }

    const safeWeaponName = foundry.utils.escapeHTML(meleeWeaponItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie broni ręcznej"
      },
      content: `<p>Czy na pewno usunąć broń <strong>${safeWeaponName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
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
