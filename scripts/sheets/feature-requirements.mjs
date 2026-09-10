import { ATTRIBUTE_LABELS, SKILL_CONFIGURATION } from "../rolls/skill-roll.mjs";
import { calculateAttributeValue, calculateSkillValue, escapeModifierText } from "../effects/modifiers.mjs";
import { checkFeatureRequirements, requirementValues } from "../effects/background-features.mjs";

export function getFeatureRequirementValues(actor) {
  return requirementValues([
    ...Object.entries(ATTRIBUTE_LABELS).map(([key, label]) => [label, calculateAttributeValue(actor, key)]),
    ...Object.entries(SKILL_CONFIGURATION).filter(([, config]) => !config.usesCustomName)
      .map(([key, config]) => [config.label, calculateSkillValue(actor, key)])
  ]);
}

export async function confirmPerkAddition(actor, item) {
  if (!["perk", "trait"].includes(item.type)) return true;
  const status = checkFeatureRequirements(actor, item.system?.requirements, getFeatureRequirementValues(actor), item);
  const needsOverride = status.checks.some(check => check.met !== true);
  const sections = [
    [false, "Brakujące wymagania"],
    [null, "Wymagania do sprawdzenia z MG"],
    [true, "Spełnione wymagania"]
  ].map(([met, label]) => {
    const checks = status.checks.filter(check => check.met === met);
    return checks.length ? `<h3>${label}</h3><ul>${checks.map(check => `<li>${escapeModifierText(check.text)}</li>`).join("")}</ul>` : "";
  }).join("");
  const descriptionSections = [
    ["Opis sztuczki", item.system?.description],
    ["Działanie i bonusy", item.system?.effects]
  ].map(([label, value]) => {
    const text = String(value ?? "").trim();
    return text ? `<h3>${label}</h3><p style="white-space: pre-wrap; overflow-wrap: anywhere;">${escapeModifierText(text)}</p>` : "";
  }).join("");
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Dodawanie sztuczki — wymagania" },
    position: { width: 560 },
    content: `<p><strong>${escapeModifierText(item.name)}</strong> — ${escapeModifierText(actor.name)}</p>
      <div style="max-height: 55vh; overflow-y: auto; padding-right: 8px;">
      ${descriptionSections}
      <p><strong>${status.label}</strong></p>${sections}
      ${needsOverride ? "<p>Możesz dodać sztuczkę mimo tych wymagań, jeśli MG wyraził zgodę.</p>" : ""}</div>`,
    yes: { label: needsOverride ? "Dodaj mimo to" : "Dodaj sztuczkę" },
    no: { label: "Nie dodawaj sztuczki" },
    rejectClose: false,
    modal: true
  });
  return confirmed === true;
}
