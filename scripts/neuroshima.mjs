import { NeuroshimaCharacterDataModel } from "./data-models/character.mjs";
import { NeuroshimaCharacterSheet } from "./sheets/character-sheet.mjs";

Hooks.once("init", () => {
  console.log("Neuroshima | Inicjalizacja systemu");

  CONFIG.Actor.dataModels.character = NeuroshimaCharacterDataModel;

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.Actor,
    game.system.id,
    NeuroshimaCharacterSheet,
    {
      types: ["character"],
      makeDefault: true
    }
  );
});
