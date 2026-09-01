import { NeuroshimaCharacterDataModel } from "./data-models/character.mjs";
import { NeuroshimaAmmunitionDataModel } from "./data-models/ammunition.mjs";
import { NeuroshimaBackgroundDataModel } from "./data-models/background.mjs";
import { NeuroshimaEquipmentDataModel } from "./data-models/equipment.mjs";
import { NeuroshimaFeatureDataModel } from "./data-models/feature.mjs";
import { NeuroshimaInjuryDataModel } from "./data-models/injury.mjs";
import { NeuroshimaMeleeWeaponDataModel } from "./data-models/melee-weapon.mjs";
import { NeuroshimaDiseaseDataModel } from "./data-models/disease.mjs";
import { NeuroshimaMedicineDataModel } from "./data-models/medicine.mjs";
import { NeuroshimaWeaponDataModel } from "./data-models/weapon.mjs";
import { NeuroshimaArmorDataModel } from "./data-models/armor.mjs";
import { NeuroshimaCharacterSheet } from "./sheets/character-sheet.mjs";
import { NeuroshimaAmmunitionSheet } from "./sheets/ammunition-sheet.mjs";
import { NeuroshimaBackgroundSheet } from "./sheets/background-sheet.mjs";
import { NeuroshimaEquipmentSheet } from "./sheets/equipment-sheet.mjs";
import { NeuroshimaFeatureSheet } from "./sheets/feature-sheet.mjs";
import { NeuroshimaInjurySheet } from "./sheets/injury-sheet.mjs";
import { NeuroshimaMeleeWeaponSheet } from "./sheets/melee-weapon-sheet.mjs";
import { NeuroshimaDiseaseSheet } from "./sheets/disease-sheet.mjs";
import { NeuroshimaMedicineSheet } from "./sheets/medicine-sheet.mjs";
import { NeuroshimaWeaponSheet } from "./sheets/weapon-sheet.mjs";
import { NeuroshimaArmorSheet } from "./sheets/armor-sheet.mjs";
import {
  NeuroshimaCombat
} from "./combat/initiative.mjs";
import { initializeSegmentCombatInterface } from "./combat/segments.mjs";
import {
  initializeCatalogCompendia
} from "./compendia/catalog-compendia.mjs";

// Hak "init" jest uruchamiany jeden raz podczas startu świata Foundry.
// W tym miejscu zgłaszamy Foundry elementy należące do naszego systemu.
Hooks.once("init", () => {
  console.log("Neuroshima | Inicjalizacja systemu");

  // Ustawienie świata pamięta, którą wersję danych katalogowych MG już
  // zsynchronizował. Nie jest widoczne w konfiguracji i działa technicznie.
  game.settings.register(game.system.id, "catalogRevision", {
    scope: "world",
    config: false,
    type: Number,
    default: 0
  });

  // Łączymy typ Actora "character" z modelem danych postaci Neuroshimy.
  CONFIG.Actor.dataModels.character = NeuroshimaCharacterDataModel;

  // Combat Tracker używa otwartego testu inicjatywy Neuroshimy zamiast
  // standardowego pojedynczego rzutu opartego na formule.
  CONFIG.Combat.documentClass = NeuroshimaCombat;
  CONFIG.Combat.initiative.decimals = 0;
  initializeSegmentCombatInterface();

  // Łączymy typ Itemu "equipment" z modelem danych zwykłego ekwipunku.
  CONFIG.Item.dataModels.equipment = NeuroshimaEquipmentDataModel;

  // Typ "weapon" otrzymuje osobny model, ponieważ broń przechowuje
  // inne informacje niż zwykły przedmiot, na przykład magazynek i obrażenia.
  CONFIG.Item.dataModels.weapon = NeuroshimaWeaponDataModel;

  // Amunicja jest osobnym Itemem, ponieważ jej liczba zmienia się niezależnie
  // od broni i stanowi zapas noszony przez konkretną postać.
  CONFIG.Item.dataModels.ammunition = NeuroshimaAmmunitionDataModel;

  // Rana jest Itemem należącym do postaci. Dzięki temu każda rana może mieć
  // własną lokację, rodzaj, karę procentową oraz opis skutków.
  CONFIG.Item.dataModels.injury = NeuroshimaInjuryDataModel;

  // Sztuczki i cechy mają tę samą strukturę danych, lecz pozostają osobnymi
  // typami Itemu, aby można je było niezależnie filtrować w Compendium.
  CONFIG.Item.dataModels.perk = NeuroshimaFeatureDataModel;
  CONFIG.Item.dataModels.trait = NeuroshimaFeatureDataModel;

  // Pochodzenia, profesje i specjalizacje korzystają ze wspólnego modelu,
  // ale są osobnymi typami, aby każdy katalog tworzył własne Compendium.
  CONFIG.Item.dataModels.origin = NeuroshimaBackgroundDataModel;
  CONFIG.Item.dataModels.profession = NeuroshimaBackgroundDataModel;
  CONFIG.Item.dataModels.specialization = NeuroshimaBackgroundDataModel;

  // Broń ręczna ma parametry ataku, obrony i obrażeń zależnych od Budowy,
  // dlatego pozostaje osobnym typem od broni dystansowej.
  CONFIG.Item.dataModels.meleeWeapon = NeuroshimaMeleeWeaponDataModel;

  // Choroba przechowuje kolejne etapy, a lek stan konkretnego opakowania.
  // Powiązanie między nimi opiera się na stabilnym kodzie choroby.
  CONFIG.Item.dataModels.disease = NeuroshimaDiseaseDataModel;
  CONFIG.Item.dataModels.medicine = NeuroshimaMedicineDataModel;
  CONFIG.Item.dataModels.armor = NeuroshimaArmorDataModel;

  // Rejestrujemy własny wygląd karty i ustawiamy go jako domyślny
  // dla wszystkich Actorów typu "character".
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    game.system.id,
    NeuroshimaCharacterSheet,
    {
      types: ["character"],
      makeDefault: true
    }
  );

  // Rejestrujemy osobną kartę przeznaczoną dla Itemów typu "equipment".
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaEquipmentSheet,
    {
      types: ["equipment"],
      makeDefault: true
    }
  );

  // Broń ma własną kartę, niezależną od karty zwykłego ekwipunku.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaWeaponSheet,
    {
      types: ["weapon"],
      makeDefault: true
    }
  );

  // Osobna karta amunicji pokazuje jej ilość, cenę, masę i dane katalogowe.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaAmmunitionSheet,
    {
      types: ["ammunition"],
      makeDefault: true
    }
  );

  // Osobna karta pozwala edytować pojedynczą ranę bez rozbudowywania
  // głównego modelu postaci o sztywną liczbę pól.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaInjurySheet,
    {
      types: ["injury"],
      makeDefault: true
    }
  );

  // Jedna karta obsługuje oba rodzaje zdolności postaci. Nazwa sekcji jest
  // dobierana na podstawie faktycznego typu otwartego Itemu.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaFeatureSheet,
    {
      types: ["perk", "trait"],
      makeDefault: true
    }
  );

  // Wspólna karta udostępnia opisy i dane katalogowe wszystkich trzech
  // elementów historii postaci.
  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaBackgroundSheet,
    {
      types: ["origin", "profession", "specialization"],
      makeDefault: true
    }
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaMeleeWeaponSheet,
    {
      types: ["meleeWeapon"],
      makeDefault: true
    }
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaDiseaseSheet,
    {
      types: ["disease"],
      makeDefault: true
    }
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaMedicineSheet,
    {
      types: ["medicine"],
      makeDefault: true
    }
  );

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Item,
    game.system.id,
    NeuroshimaArmorSheet,
    { types: ["armor"], makeDefault: true }
  );
});

// Kod źródłowy identyfikuje dokładny wariant broni, amunicji albo zdolności.
// Dla Itemów tworzonych ręcznie generujemy go automatycznie, aby użytkownik
// nie musiał wymyślać technicznego i unikalnego oznaczenia.
Hooks.on("preCreateItem", (item) => {
  if (![
    "weapon",
    "ammunition",
    "perk",
    "trait",
    "origin",
    "profession",
    "specialization",
    "meleeWeapon",
    "disease",
    "medicine",
    "armor"
  ].includes(item.type)) return;
  if (item.system.sourceCode) return;

  const codePrefixByType = {
    weapon: "CUSTOM_WEAPON",
    ammunition: "CUSTOM_AMMO",
    perk: "CUSTOM_PERK",
    trait: "CUSTOM_TRAIT",
    origin: "CUSTOM_ORIGIN",
    profession: "CUSTOM_PROFESSION",
    specialization: "CUSTOM_SPECIALIZATION",
    meleeWeapon: "CUSTOM_MELEE_WEAPON",
    disease: "CUSTOM_DISEASE",
    medicine: "CUSTOM_MEDICINE",
    armor: "CUSTOM_ARMOR"
  };
  item.updateSource({
    "system.sourceCode": `${codePrefixByType[item.type]}_${foundry.utils.randomID()}`
  });
});

// Wariant prototypowy tworzy światowe biblioteki na podstawie źródeł
// JSON przechowywanych w repozytorium. Docelowo zastąpią je paczki systemowe.
Hooks.once("ready", async () => {
  await initializeCatalogCompendia();
});
