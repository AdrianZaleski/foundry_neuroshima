export async function prepareDiseaseCatalog() {
  const compendium = game.packs.get("world.neuroshima-diseases");
  const options = { "": "Lek ogólny / brak powiązania" };
  const namesBySourceCode = {};

  if (!compendium) return { options, namesBySourceCode };

  await compendium.getIndex({ fields: ["system.sourceCode"] });
  const entries = [...compendium.index.values()]
    .filter((entry) => entry.system?.sourceCode)
    .sort((leftEntry, rightEntry) => leftEntry.name.localeCompare(
      rightEntry.name,
      "pl"
    ));

  for (const entry of entries) {
    options[entry.system.sourceCode] = entry.name;
    namesBySourceCode[entry.system.sourceCode] = entry.name;
  }

  return { options, namesBySourceCode };
}

export async function prepareMedicinesByDisease() {
  const compendium = game.packs.get("world.neuroshima-medicines");
  if (!compendium) return {};

  await compendium.getIndex({
    fields: ["system.sourceCode", "system.diseaseSourceCode"]
  });

  const medicinesByDisease = {};
  const entries = [...compendium.index.values()]
    .filter((entry) => entry.system?.diseaseSourceCode)
    .sort((leftEntry, rightEntry) => leftEntry.name.localeCompare(
      rightEntry.name,
      "pl"
    ));

  for (const entry of entries) {
    const diseaseSourceCode = entry.system.diseaseSourceCode;
    medicinesByDisease[diseaseSourceCode] ??= [];
    medicinesByDisease[diseaseSourceCode].push({
      id: entry._id,
      name: entry.name,
      sourceCode: entry.system.sourceCode ?? ""
    });
  }

  return medicinesByDisease;
}
