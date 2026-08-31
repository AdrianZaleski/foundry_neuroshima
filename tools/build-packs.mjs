import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

// Każda nazwa odpowiada jednemu czytelnemu katalogowi JSON oraz przyszłej
// systemowej paczce LevelDB.
const compendiumNames = ["weapons", "ammunition", "perks", "traits"];
const projectDirectory = process.cwd();

for (const compendiumName of compendiumNames) {
  const catalogPath = path.join(
    projectDirectory,
    "packs",
    "catalogs",
    `${compendiumName}.json`
  );
  const databaseDirectory = path.join(projectDirectory, "packs", compendiumName);
  const sourceDocuments = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const temporaryDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), `neuroshima-${compendiumName}-`)
  );

  try {
    // Narzędzie Foundry oczekuje osobnego pliku dla każdego dokumentu.
    // Tymczasowe pliki powstają wyłącznie na czas kompilacji paczki.
    await Promise.all(sourceDocuments.map((sourceDocument) => {
      const documentPath = path.join(temporaryDirectory, `${sourceDocument._id}.json`);
      return fs.writeFile(documentPath, JSON.stringify(sourceDocument, null, 2));
    }));

    // Oficjalne narzędzie Foundry zamienia pliki JSON na bazę LevelDB.
    await compilePack(temporaryDirectory, databaseDirectory, { log: true });
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
