const catalogCompendiumDefinitions = [
  {
    // Zachowujemy techniczną nazwę próbnego Compendium, aby istniejący świat
    // dostał nowe wpisy zamiast drugiego, zduplikowanego Compendium.
    name: "neuroshima-weapons-sample",
    label: "Neuroshima: Broń dystansowa",
    itemType: "weapon",
    catalogFile: "packs/catalogs/weapons.json"
  },
  {
    name: "neuroshima-ammunition-sample",
    label: "Neuroshima: Amunicja",
    itemType: "ammunition",
    catalogFile: "packs/catalogs/ammunition.json"
  },
  {
    name: "neuroshima-perks",
    label: "Neuroshima: Sztuczki",
    itemType: "perk",
    catalogFile: "packs/catalogs/perks.json"
  },
  {
    name: "neuroshima-traits",
    label: "Neuroshima: Cechy",
    itemType: "trait",
    catalogFile: "packs/catalogs/traits.json"
  },
  {
    name: "neuroshima-origins",
    label: "Neuroshima: Pochodzenia",
    itemType: "origin",
    catalogFile: "packs/catalogs/origins.json"
  },
  {
    name: "neuroshima-professions",
    label: "Neuroshima: Profesje",
    itemType: "profession",
    catalogFile: "packs/catalogs/professions.json"
  },
  {
    name: "neuroshima-specializations",
    label: "Neuroshima: Specjalizacje",
    itemType: "specialization",
    catalogFile: "packs/catalogs/specializations.json"
  }
];

// Zwiększamy numer po zmianie danych katalogowych. MG wykona wtedy jednorazową
// synchronizację istniejących Kompendiów ze źródłami JSON w repozytorium.
export const catalogRevision = 4;

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

async function synchronizeCompendium(compendium, definition, updateExistingDocuments) {
  // Indeks zawiera lekką listę wpisów bez otwierania wszystkich dokumentów.
  await compendium.getIndex();

  const sourceDocuments = await loadCatalog(definition.catalogFile);
  const missingDocuments = sourceDocuments.filter(
    (sourceDocument) => !compendium.index.has(sourceDocument._id)
  );
  const existingDocuments = updateExistingDocuments
    ? sourceDocuments.filter((sourceDocument) => compendium.index.has(sourceDocument._id))
    : [];

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

  for (let startIndex = 0; startIndex < existingDocuments.length; startIndex += importBatchSize) {
    const documentBatch = existingDocuments.slice(
      startIndex,
      startIndex + importBatchSize
    );

    // Aktualizujemy tylko wzorce w Compendium. Itemy wcześniej przeciągnięte
    // do Actorów są niezależnymi kopiami i zachowują własny stan.
    await foundry.documents.Item.updateDocuments(documentBatch, {
      pack: compendium.collection
    });
  }

  return {
    createdDocumentCount: missingDocuments.length,
    updatedDocumentCount: existingDocuments.length
  };
}

export async function initializeCatalogCompendia() {
  // Tylko MG może tworzyć Compendia i zapisywać w nich dokumenty.
  if (!game.user.isGM) return;

  // Dozwolone podtypy dokumentów są wczytywane przez serwer z system.json.
  // Po dodaniu nowego typu samo odświeżenie przeglądarki przeładowuje skrypty,
  // ale nie manifest serwera. Zatrzymujemy wtedy import i prosimy o pełny
  // restart Foundry zamiast generować serię błędów walidacji dokumentów.
  const configuredItemTypes = game.documentTypes?.Item;
  const availableItemTypes = new Set(
    Array.isArray(configuredItemTypes)
      ? configuredItemTypes
      : Object.keys(configuredItemTypes ?? game.system.documentTypes?.Item ?? {})
  );
  const missingItemTypes = [...new Set(
    catalogCompendiumDefinitions.map((definition) => definition.itemType)
  )].filter((itemType) => !availableItemTypes.has(itemType));

  if (missingItemTypes.length > 0) {
    const missingTypesDescription = missingItemTypes.join(", ");
    console.error(
      `Neuroshima | Serwer nie wczytał typów Item: ${missingTypesDescription}. `
      + "Wymagane jest pełne ponowne uruchomienie Foundry."
    );
    ui.notifications.error(
      "Neuroshima: dodano nowe typy przedmiotów. Zamknij i uruchom ponownie "
      + "serwer Foundry, a następnie otwórz świat ponownie."
    );
    return;
  }

  try {
    let createdDocumentCount = 0;
    let updatedDocumentCount = 0;
    const savedCatalogRevision = game.settings.get(
      game.system.id,
      "catalogRevision"
    );
    const updateExistingDocuments = savedCatalogRevision < catalogRevision;

    for (const definition of catalogCompendiumDefinitions) {
      const compendium = await getOrCreateWorldCompendium(definition);
      const synchronizationResult = await synchronizeCompendium(
        compendium,
        definition,
        updateExistingDocuments
      );
      createdDocumentCount += synchronizationResult.createdDocumentCount;
      updatedDocumentCount += synchronizationResult.updatedDocumentCount;
    }

    if (updateExistingDocuments) {
      await game.settings.set(
        game.system.id,
        "catalogRevision",
        catalogRevision
      );
    }

    if (createdDocumentCount > 0 || updatedDocumentCount > 0) {
      ui.notifications.info(
        `Neuroshima: dodano ${createdDocumentCount} i zaktualizowano ${updatedDocumentCount} wpisów Kompendiów.`
      );
    }
  } catch (error) {
    console.error("Neuroshima | Nie udało się przygotować Kompendiów", error);
    ui.notifications.error(
      "Neuroshima: nie udało się przygotować Kompendiów. Szczegóły zapisano w konsoli."
    );
  }
}
