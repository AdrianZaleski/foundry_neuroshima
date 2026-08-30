const sampleCompendiumDefinitions = [
  {
    name: "neuroshima-weapons-sample",
    label: "Neuroshima: Broń (próbka)",
    sourceFiles: [
      "packs/weapons/_source/ak-kalash.json",
      "packs/weapons/_source/m16-a2.json",
      "packs/weapons/_source/glock-17.json"
    ]
  },
  {
    name: "neuroshima-ammunition-sample",
    label: "Neuroshima: Amunicja (próbka)",
    sourceFiles: [
      "packs/ammunition/_source/ammo-762ak.json",
      "packs/ammunition/_source/ammo-556.json",
      "packs/ammunition/_source/ammo-9.json"
    ]
  }
];

// Odczytujemy jeden plik JSON przez serwer Foundry, tak samo jak szablony HBS.
async function loadSourceDocument(relativePath) {
  const response = await fetch(`systems/${game.system.id}/${relativePath}`);

  if (!response.ok) {
    throw new Error(`Nie udało się odczytać źródła Compendium: ${relativePath}`);
  }

  return response.json();
}

// Światowe Compendium jest zapisywane w konkretnym świecie. W tym prototypie
// służy do sprawdzenia biblioteki bez wymagania zewnętrznego kompilatora LevelDB.
async function getOrCreateWorldCompendium(definition) {
  const collectionId = `world.${definition.name}`;
  const existingCompendium = game.packs.get(collectionId);

  if (existingCompendium) return existingCompendium;

  return foundry.documents.collections.CompendiumCollection.createCompendium({
    name: definition.name,
    label: definition.label,
    type: "Item",
    package: "world",
    system: game.system.id
  });
}

async function fillCompendium(compendium, definition) {
  // Indeks zawiera lekką listę wpisów bez otwierania wszystkich dokumentów.
  await compendium.getIndex();

  const sourceDocuments = await Promise.all(
    definition.sourceFiles.map((sourceFile) => loadSourceDocument(sourceFile))
  );
  const missingDocuments = sourceDocuments.filter(
    (sourceDocument) => !compendium.index.has(sourceDocument._id)
  );

  if (missingDocuments.length === 0) return 0;

  // keepId zachowuje stabilne identyfikatory z plików JSON. Dzięki temu
  // ponowne uruchomienie świata nie tworzy duplikatów tych samych wpisów.
  await foundry.documents.Item.createDocuments(missingDocuments, {
    pack: compendium.collection,
    keepId: true
  });

  return missingDocuments.length;
}

export async function initializeSampleCompendia() {
  // Tylko MG może tworzyć Compendia i zapisywać w nich dokumenty.
  if (!game.user.isGM) return;

  try {
    let createdDocumentCount = 0;

    for (const definition of sampleCompendiumDefinitions) {
      const compendium = await getOrCreateWorldCompendium(definition);
      createdDocumentCount += await fillCompendium(compendium, definition);
    }

    if (createdDocumentCount > 0) {
      ui.notifications.info(
        `Neuroshima: dodano ${createdDocumentCount} wpisów do próbnych Compendiów.`
      );
    }
  } catch (error) {
    console.error("Neuroshima | Nie udało się przygotować próbnych Compendiów", error);
    ui.notifications.error(
      "Neuroshima: nie udało się przygotować próbnych Compendiów. Szczegóły zapisano w konsoli."
    );
  }
}
