const AMMUNITION_COMPENDIUM_NAMES = [
  "world.neuroshima-ammunition-sample",
  "neuroshima.ammunition",
  "neuroshima.ammunition-sample"
];

const WEAPON_COMPENDIUM_NAMES = [
  "world.neuroshima-weapons-sample",
  "neuroshima.weapons",
  "neuroshima.weapons-sample"
];

function findCompendium(knownNames, sourceNameFragment) {
  for (const compendiumName of knownNames) {
    const compendium = game.packs.get(compendiumName);
    if (compendium) return compendium;
  }

  // Wyszukiwanie po technicznej nazwie pozwoli zachować relacje po przejściu
  // ze światowych Compendiów prototypowych na docelowe paczki systemowe.
  return game.packs.find((compendium) => (
    compendium.documentName === "Item"
    && String(compendium.metadata?.name ?? "").includes(sourceNameFragment)
  )) ?? null;
}

function compareByPolishName(leftItem, rightItem) {
  return leftItem.name.localeCompare(rightItem.name, "pl");
}

function normalizeAmmunitionSymbol(value) {
  return String(value ?? "").trim();
}

function prepareCatalogRelation(compendium, entry, details) {
  return {
    id: entry.id ?? entry._id,
    name: entry.name,
    source: "compendium",
    packId: compendium.collection,
    details
  };
}

function getOwningActor(item) {
  return item.parent?.documentName === "Actor" ? item.parent : null;
}

export async function prepareRelationsForWeapon(weapon) {
  const ammunitionSymbol = normalizeAmmunitionSymbol(weapon.system.ammunitionCode);
  const ammunitionCompendium = findCompendium(
    AMMUNITION_COMPENDIUM_NAMES,
    "ammunition"
  );
  let catalogItems = [];

  if (ammunitionCompendium && ammunitionSymbol) {
    await ammunitionCompendium.getIndex({
      fields: [
        "system.ammunitionSymbol",
        "system.unitPrice",
        "system.availability",
        "system.effectCode"
      ]
    });
    catalogItems = [...ammunitionCompendium.index.values()]
      .filter((entry) => (
        normalizeAmmunitionSymbol(entry.system?.ammunitionSymbol) === ammunitionSymbol
      ))
      .map((entry) => {
        const details = [
          `cena ${entry.system?.unitPrice ?? 0}`,
          `dostępność ${entry.system?.availability ?? 0}%`,
          entry.system?.effectCode ? `efekt ${entry.system.effectCode}` : ""
        ].filter(Boolean).join(", ");
        return prepareCatalogRelation(ammunitionCompendium, entry, details);
      })
      .sort(compareByPolishName);
  }

  const actor = getOwningActor(weapon);
  const actorItems = actor && ammunitionSymbol
    ? actor.items
      .filter((item) => (
        item.type === "ammunition"
        && normalizeAmmunitionSymbol(item.system.ammunitionSymbol) === ammunitionSymbol
      ))
      .map((item) => ({
        id: item.id,
        name: item.name,
        source: "actor",
        details: `${item.system.quantity ?? 0} szt., wartość ${item.system.totalPrice ?? 0}`
      }))
      .sort(compareByPolishName)
    : [];

  return {
    ammunitionSymbol,
    compendiumAvailable: Boolean(ammunitionCompendium),
    catalogItems,
    actorItems
  };
}

export async function prepareRelationsForAmmunition(ammunition) {
  const ammunitionSymbol = normalizeAmmunitionSymbol(ammunition.system.ammunitionSymbol);
  const weaponCompendium = findCompendium(WEAPON_COMPENDIUM_NAMES, "weapon");
  let catalogItems = [];

  if (weaponCompendium && ammunitionSymbol) {
    await weaponCompendium.getIndex({
      fields: [
        "system.ammunitionCode",
        "system.weaponClass",
        "system.magazineCapacity",
        "system.damageCode",
        "system.armorPenetration"
      ]
    });
    catalogItems = [...weaponCompendium.index.values()]
      .filter((entry) => (
        normalizeAmmunitionSymbol(entry.system?.ammunitionCode) === ammunitionSymbol
      ))
      .map((entry) => {
        const details = [
          entry.system?.weaponClass ?? "",
          `mag. ${entry.system?.magazineCapacity ?? 0}`,
          `obrażenia ${entry.system?.damageCode ?? "—"}`,
          `PP ${entry.system?.armorPenetration ?? 0}`
        ].filter(Boolean).join(", ");
        return prepareCatalogRelation(weaponCompendium, entry, details);
      })
      .sort(compareByPolishName);
  }

  const actor = getOwningActor(ammunition);
  const actorItems = actor && ammunitionSymbol
    ? actor.items
      .filter((item) => (
        item.type === "weapon"
        && normalizeAmmunitionSymbol(item.system.ammunitionCode) === ammunitionSymbol
      ))
      .map((item) => ({
        id: item.id,
        name: item.name,
        source: "actor",
        details: `${item.system.currentAmmunition ?? 0}/${item.system.magazineCapacity ?? 0} nabojów, PP ${item.system.armorPenetration ?? 0}`
      }))
      .sort(compareByPolishName)
    : [];

  return {
    ammunitionSymbol,
    compendiumAvailable: Boolean(weaponCompendium),
    catalogItems,
    actorItems
  };
}

export async function openRelatedWeaponOrAmmunition(sheet, target) {
  const itemId = String(target.dataset.relatedItemId ?? "");
  const source = String(target.dataset.relatedSource ?? "");
  let relatedItem = null;

  if (source === "actor") {
    relatedItem = getOwningActor(sheet.item)?.items.get(itemId) ?? null;
  } else if (source === "compendium") {
    const packId = String(target.dataset.relatedPackId ?? "");
    relatedItem = await game.packs.get(packId)?.getDocument(itemId) ?? null;
  }

  if (!relatedItem) {
    ui.notifications.warn("Nie znaleziono powiązanego wpisu. Odśwież kartę po synchronizacji Compendiów.");
    return;
  }

  await relatedItem.sheet.render({ force: true });
}
