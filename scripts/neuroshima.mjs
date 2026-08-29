import { NeuroshimaCharacterDataModel } from "./data-models/character.mjs";
import { NeuroshimaEquipmentDataModel } from "./data-models/equipment.mjs";
import { NeuroshimaCharacterSheet } from "./sheets/character-sheet.mjs";
import { NeuroshimaEquipmentSheet } from "./sheets/equipment-sheet.mjs";

// Hak "init" jest uruchamiany jeden raz podczas startu świata Foundry.
// W tym miejscu zgłaszamy Foundry elementy należące do naszego systemu.
Hooks.once("init", () => {
  console.log("Neuroshima | Inicjalizacja systemu");

  // Łączymy typ Actora "character" z modelem danych postaci Neuroshimy.
  CONFIG.Actor.dataModels.character = NeuroshimaCharacterDataModel;

  // Łączymy typ Itemu "equipment" z modelem danych zwykłego ekwipunku.
  CONFIG.Item.dataModels.equipment = NeuroshimaEquipmentDataModel;

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
});
