import { NeuroshimaCharacterDataModel } from "./data-models/character.mjs";
import { NeuroshimaAmmunitionDataModel } from "./data-models/ammunition.mjs";
import { NeuroshimaEquipmentDataModel } from "./data-models/equipment.mjs";
import { NeuroshimaFeatureDataModel } from "./data-models/feature.mjs";
import { NeuroshimaInjuryDataModel } from "./data-models/injury.mjs";
import { NeuroshimaWeaponDataModel } from "./data-models/weapon.mjs";
import { NeuroshimaCharacterSheet } from "./sheets/character-sheet.mjs";
import { NeuroshimaAmmunitionSheet } from "./sheets/ammunition-sheet.mjs";
import { NeuroshimaEquipmentSheet } from "./sheets/equipment-sheet.mjs";
import { NeuroshimaFeatureSheet } from "./sheets/feature-sheet.mjs";
import { NeuroshimaInjurySheet } from "./sheets/injury-sheet.mjs";
import { NeuroshimaWeaponSheet } from "./sheets/weapon-sheet.mjs";
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
});

// Kod źródłowy identyfikuje dokładny wariant broni, amunicji albo zdolności.
// Dla Itemów tworzonych ręcznie generujemy go automatycznie, aby użytkownik
// nie musiał wymyślać technicznego i unikalnego oznaczenia.
Hooks.on("preCreateItem", (item) => {
  if (!["weapon", "ammunition", "perk", "trait"].includes(item.type)) return;
  if (item.system.sourceCode) return;

  const codePrefixByType = {
    weapon: "CUSTOM_WEAPON",
    ammunition: "CUSTOM_AMMO",
    perk: "CUSTOM_PERK",
    trait: "CUSTOM_TRAIT"
  };
  item.updateSource({
    "system.sourceCode": `${codePrefixByType[item.type]}_${foundry.utils.randomID()}`
  });
});

// Wariant prototypowy tworzy dwie światowe biblioteki na podstawie źródeł
// JSON przechowywanych w repozytorium. Docelowo zastąpią je paczki systemowe.
Hooks.once("ready", async () => {
  await initializeCatalogCompendia();
});
