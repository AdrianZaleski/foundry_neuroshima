import { BACKGROUND_BONUSES } from "../catalogs/background-bonuses.mjs";
import { collectTraitSkillModifiers } from "./trait-bonuses.mjs";
import { parseEffectCodes } from "../catalogs/effect-definitions.mjs";

export function collectBackgroundFeatureModifiers(actor) {
  const background = actor.system.background ?? {};
  const modifiers = [];
  for (const type of ["origin", "profession"]) {
    const code = background[`${type}SourceCode`];
    const entry = BACKGROUND_BONUSES.find(e => e.type === type && e.sourceCode === code);
    if (!entry) continue;
    let bonus = entry.bonus;
    if (bonus === "ATR_ANY_BONUS:1") {
      const codes = { budowa: "BUD", zrecznosc: "ZRE", charakter: "CHA", spryt: "SPR", percepcja: "PER" };
      bonus = codes[background.originBonusAttribute]
        ? `ATR_${codes[background.originBonusAttribute]}:1` : "";
    }
    modifiers.push(...parseEffectCodes(bonus, `${type === "origin" ? "Pochodzenie" : "Profesja"}: ${entry.name}`).modifiers);
  }
  for (const item of actor.items ?? []) {
    if (!["perk", "trait"].includes(item.type) || item.system.applyMechanicalEffects === false) continue;
    modifiers.push(...parseEffectCodes(item.system.effects, `${item.type === "perk" ? "Sztuczka" : "Cecha"}: ${item.name}`).modifiers);
  }
  return [...modifiers, ...collectTraitSkillModifiers(actor)];
}

const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replaceAll("ł", "l").toLowerCase().replace(/[^a-z0-9]/g, "");

// Nie zgadujemy alternatyw, wymagań fabularnych ani nazw nieznanych statystyk.
export function checkFeatureRequirements(actor, text, values) {
  const checks = String(text ?? "").split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).map(part => {
    if (/^(ORIGIN|CLASS)_[A-Z0-9_]+$/.test(part)) {
      const type = part.startsWith("ORIGIN_") ? "origin" : "profession";
      const entry = BACKGROUND_BONUSES.find(e => e.sourceCode === part);
      return { text: entry?.name ?? part, met: actor.system.background?.[`${type}SourceCode`] === part };
    }
    const match = part.match(/^(.+?)\s+(\d+)\+$/);
    if (match) {
      const value = values[normalize(match[1])];
      if (value !== undefined) return { text: `${part} (obecnie ${value})`, met: value >= Number(match[2]) };
    }
    return { text: part, met: null };
  });
  return {
    checks,
    label: checks.some(c => c.met === false) ? "Wymagania niespełnione"
      : checks.some(c => c.met === null) ? "Wymaga sprawdzenia przez MG"
      : checks.length ? "Wymagania spełnione" : "Brak wymagań",
    details: checks.map(c => `${c.met === null ? "Do sprawdzenia" : c.met ? "Spełnione" : "Niespełnione"}: ${c.text}`).join("; ")
  };
}

export function requirementValues(entries) {
  return Object.fromEntries(entries.map(([name, value]) => [normalize(name), value]));
}
