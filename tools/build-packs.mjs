import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

// Każda nazwa odpowiada nazwie katalogu podanej w sekcji "packs"
// pliku system.json. Źródła JSON pozostają czytelne dla człowieka i Gita.
const compendiumNames = ["weapons", "ammunition"];
const projectDirectory = process.cwd();

for (const compendiumName of compendiumNames) {
  const sourceDirectory = path.join(
    projectDirectory,
    "packs",
    compendiumName,
    "_source"
  );
  const databaseDirectory = path.join(projectDirectory, "packs", compendiumName);

  // Oficjalne narzędzie Foundry zamienia pojedyncze pliki JSON
  // na bazę LevelDB odczytywaną przez Foundry VTT 14.
  await compilePack(sourceDirectory, databaseDirectory, {
    log: true
  });
}
