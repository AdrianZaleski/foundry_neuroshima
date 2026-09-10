import { genderRequirementMet } from "./trait-bonuses.mjs";

export function isMerchantMind(item) {
  return item.type === "trait" && item.system?.sourceCode === "TRAIT_UMYSLKUPCA";
}

export function collectConditionalFeatureModifiers(actor) {
  const item = [...(actor.items ?? [])].find(item => isMerchantMind(item)
    && item.system.conditionalEffectActive === true
    && item.system.applyMechanicalEffects !== false && genderRequirementMet(actor, item));
  if (!item) return [];
  return Object.entries({ spryt: 2, charakter: 2, budowa: -1, zrecznosc: -1, percepcja: -1 })
    .map(([key, value]) => ({ id: `merchant-mind-${key}`, source: `Cecha: ${item.name}`,
      scope: `attribute.${key}`, value, expiresAt: "" }));
}
