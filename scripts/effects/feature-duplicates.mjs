import { getTraitBonusCode } from "./trait-bonuses.mjs";

export function findDuplicateFeature(actor, item) {
  if (!["perk", "trait"].includes(item.type)) return null;
  const code = String(item.system?.sourceCode ?? "").trim();
  const name = String(item.name ?? "").trim().toLocaleLowerCase("pl");
  return [...(actor.items ?? [])].find(existing => {
    const bonusCode = getTraitBonusCode(item);
    if (bonusCode && bonusCode === getTraitBonusCode(existing)) return true;
    if (existing.type !== item.type) return false;
    const existingCode = String(existing.system?.sourceCode ?? "").trim();
    if (code && existingCode) return code === existingCode;
    return name && name === String(existing.name ?? "").trim().toLocaleLowerCase("pl");
  }) ?? null;
}

export function preventDuplicateFeature(actor, item) {
  if (!findDuplicateFeature(actor, item)) return false;
  ui.notifications.warn(`${actor.name} już posiada „${item.name}”. Nie dodano drugiego egzemplarza.`);
  return true;
}

export function initializeFeatureDuplicateGuard() {
  Hooks.on("preCreateItem", item => {
    if (item.parent?.documentName === "Actor" && preventDuplicateFeature(item.parent, item)) return false;
  });
}
