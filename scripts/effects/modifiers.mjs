function normalizeModifierValue(value) {
  const modifierValue = Number(value);
  return Number.isFinite(modifierValue) ? Math.trunc(modifierValue) : 0;
}

export function modifierIsActive(modifier, currentTime = Date.now()) {
  if (!modifier || modifier.enabled === false) return false;

  const expiresAt = String(modifier.expiresAt ?? "").trim();
  if (!expiresAt) return true;

  const expirationTime = Date.parse(expiresAt);
  return Number.isNaN(expirationTime) || expirationTime > currentTime;
}

export function collectModifiersForScope(modifiers, scope, currentTime = Date.now()) {
  return [...(modifiers ?? [])]
    .filter((modifier) => (
      modifier.scope === scope && modifierIsActive(modifier, currentTime)
    ))
    .map((modifier) => ({
      id: modifier.id,
      source: String(modifier.source ?? "Efekt bez nazwy").trim() || "Efekt bez nazwy",
      value: normalizeModifierValue(modifier.value),
      scope: modifier.scope,
      expiresAt: String(modifier.expiresAt ?? "")
    }));
}

export function sumModifierSources(modifierSources) {
  return modifierSources.reduce((sum, modifier) => sum + modifier.value, 0);
}

export function collectAttributeModifierSources(actor, attributeKey) {
  const attribute = actor.system.attributes?.[attributeKey];
  if (!attribute) return [];

  const manualModifier = normalizeModifierValue(attribute.manualModifier);
  const sources = collectModifiersForScope(
    actor.system.activeModifiers,
    `attribute.${attributeKey}`
  );

  if (manualModifier !== 0) {
    sources.unshift({
      id: `manual-attribute-${attributeKey}`,
      source: "Modyfikator ręczny",
      value: manualModifier,
      scope: `attribute.${attributeKey}`,
      expiresAt: ""
    });
  }

  return sources;
}

export function collectSkillModifierSources(actor, skillKey) {
  if (!actor.system.skills?.[skillKey]) return [];
  return collectModifiersForScope(actor.system.activeModifiers, `skill.${skillKey}`);
}

export function collectTestModifierSources(actor) {
  return collectModifiersForScope(actor.system.activeModifiers, "test.all");
}

export function calculateAttributeValue(actor, attributeKey) {
  const attribute = actor.system.attributes?.[attributeKey];
  if (!attribute) return 0;
  return Number(attribute.base) + sumModifierSources(
    collectAttributeModifierSources(actor, attributeKey)
  );
}

export function calculateSkillValue(actor, skillKey) {
  const skill = actor.system.skills?.[skillKey];
  if (!skill) return 0;
  return Number(skill.base) + sumModifierSources(
    collectSkillModifierSources(actor, skillKey)
  );
}

export function formatSignedModifier(value, suffix = "") {
  const numberValue = normalizeModifierValue(value);
  const sign = numberValue >= 0 ? "+" : "";
  return `${sign}${numberValue}${suffix}`;
}

export function escapeModifierText(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function describeModifierSources(modifierSources, suffix = "") {
  if (!modifierSources.length) return "brak";
  return modifierSources
    .map((modifier) => (
      `${escapeModifierText(modifier.source)} ${formatSignedModifier(modifier.value, suffix)}`
    ))
    .join(", ");
}
