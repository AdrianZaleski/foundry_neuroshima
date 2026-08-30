const catalogCompendiumDefinitions = [
  {
    // Zachowujemy techniczną nazwę próbnego Compendium, aby istniejący świat
    // dostał nowe wpisy zamiast drugiego, zduplikowanego Compendium.
    name: "neuroshima-weapons-sample",
    label: "Neuroshima: Broń dystansowa",
    catalogFile: "packs/catalogs/weapons.json"
  },
  {
    name: "neuroshima-ammunition-sample",
    label: "Neuroshima: Amunicja",
    catalogFile: "packs/catalogs/ammunition.json"
  }
];

// Katalog jest tablicą kompletnych dokumentów Item. Pobieramy go przez serwer
// Foundry jednym żądaniem zamiast odczytywać setki małych plików osobno.
async function loadCatalog(relativePath) {
  const response = await fetch(`systems/${game.system.id}/${relativePath}`);

  if (!response.ok) {
    throw new Error(`Nie udało się odczytać katalogu Compendium: ${relativePath}`);
  }

  return response.json();
}

// Światowe Compendium jest zapisywane w konkretnym świecie. Nadal używamy
// tego prostego wariantu prototypowego, zanim zbudujemy systemowe paczki LevelDB.
async function getOrCreateWorldCompendium(definition) {
  const collectionId = `world.${definition.name}`;
  const existingCompendium = game.packs.get(collectionId);

  if (existingCompendium) {
    // Pierwsza wersja miała w nazwie dopisek „próbka”. Zmieniamy wyłącznie
    // nazwę widoczną dla użytkownika, bez usuwania istniejącego Compendium.
    if (existingCompendium.title !== definition.label) {
      await existingCompendium.configure({ label: definition.label });
    }

    return existingCompendium;
  }

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

  const sourceDocuments = await loadCatalog(definition.catalogFile);
  const missingDocuments = sourceDocuments.filter(
    (sourceDocument) => !compendium.index.has(sourceDocument._id)
  );

  if (missingDocuments.length === 0) return 0;

  // Dzielimy pierwszy import na mniejsze partie, aby pojedyncza operacja
  // sieciowa nie musiała przenosić wszystkich opisów broni naraz.
  const importBatchSize = 50;

  for (let startIndex = 0; startIndex < missingDocuments.length; startIndex += importBatchSize) {
    const documentBatch = missingDocuments.slice(
      startIndex,
      startIndex + importBatchSize
    );

    // keepId zachowuje stabilne identyfikatory z katalogu JSON. Dzięki temu
    // ponowne uruchomienie świata nie tworzy duplikatów tych samych wpisów.
    await foundry.documents.Item.createDocuments(documentBatch, {
      pack: compendium.collection,
      keepId: true
    });
  }

  return missingDocuments.length;
}

export async function initializeCatalogCompendia() {
  // Tylko MG może tworzyć Compendia i zapisywać w nich dokumenty.
  if (!game.user.isGM) return;

  try {
    let createdDocumentCount = 0;

    for (const definition of catalogCompendiumDefinitions) {
      const compendium = await getOrCreateWorldCompendium(definition);
      createdDocumentCount += await fillCompendium(compendium, definition);
    }

    if (createdDocumentCount > 0) {
      ui.notifications.info(
        `Neuroshima: dodano ${createdDocumentCount} wpisów do Kompendiów.`
      );
    }
  } catch (error) {
    console.error("Neuroshima | Nie udało się przygotować Kompendiów", error);
    ui.notifications.error(
      "Neuroshima: nie udało się przygotować Kompendiów. Szczegóły zapisano w konsoli."
    );
  }
}
