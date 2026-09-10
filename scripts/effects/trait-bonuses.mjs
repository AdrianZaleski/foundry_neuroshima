// Jawne interpretacje packs/catalogs/traits.json. Nie wyciągamy liczb
// z dowolnego opisu: liczba może oznaczać warunek, koszt lub limit użyć.
import { SKILL_GROUPS } from "../catalogs/skill-specializations.mjs";
export const TRAIT_BONUSES = {
  TRAIT_URODZONYMORDERCA: {
    skills: [], groups: { walkaWrecz: "Walka wręcz", bronStrzelecka: "Broń strzelecka", bronDystansowa: "Broń dystansowa", silaWoli: "Siła woli", pirotechnika: "Pirotechnika" },
    bonus: 2, summary: "+2 do Umiejętności wybranego pakietu Wojownika."
  },
  TRAIT_SZLACHETNIEURODZONY: {
    skills: [], groups: { negocjacje: "Negocjacje", empatia: "Empatia", silaWoli: "Siła woli" },
    bonus: 2, summary: "+2 do Umiejętności wybranego pakietu opartego o Charakter."
  },
  TRAIT_HAZARDZISTA: {
    skills: ["kradziezKieszonkowa", "zwinneDlonie", "otwieranieZamkow"],
    bonus: 2, summary: "Zdolności manualne: +2 do każdej Umiejętności."
  },
  TRAIT_DOKTORQUINN: {
    skills: ["pierwszaPomoc", "leczenieRan", "leczenieChorob"],
    minimum: 4, summary: "Medycyna: minimalny poziom 4. Wymagana płeć: kobieta."
  },
  TRAIT_KOLESZWANYKONIEM: {
    skills: ["jazdaKonna", "powozenie", "ujezdzanie"],
    minimum: 2, summary: "Jeździectwo: minimalny poziom 2. Przerzuty i ułatwienie dotyczące wierzchowca pozostają opisowe."
  },
  TRAIT_SWOJEPRZESZEDLEM: {
    skills: ["bijatyka", "bronReczna", "rzucanie", "odpornoscNaBol", "niezlomnosc", "morale"],
    minimum: 1, summary: "Walka wręcz i Siła woli: minimalny poziom 1."
  },
  TRAIT_WYSZKOLENIE: {
    skills: ["pistolety", "karabiny", "bronMaszynowa", "rusznikarstwo", "wyrzutnie", "materialyWybuchowe"],
    minimum: 1, summary: "Broń strzelecka i Pirotechnika: minimalny poziom 1."
  }
};

// Katalog PERK zawiera także odpowiednik startowej cechy Vegas.
// Łączymy wyłącznie potwierdzony odpowiednik, nie wszystkie kody PERK/TRAIT.
export function getTraitBonusCode(item) {
  const code = String(item.system?.sourceCode ?? "").trim();
  if (item.type === "perk" && ["PERK_HAZARDZISTA", "PERK_URODZONYMORDERCA", "PERK_SZLACHETNIEURODZONY", "PERK_DOKTORQUINN"].includes(code)) return code.replace("PERK_", "TRAIT_");
  return item.type === "trait" && TRAIT_BONUSES[code] ? code : null;
}

export function getTraitBonusDefinition(item) {
  return TRAIT_BONUSES[getTraitBonusCode(item)] ?? null;
}

export function getRequiredGender(item) {
  if (getTraitBonusCode(item) === "TRAIT_DOKTORQUINN") return "female";
  const match = String(item.system?.requirements ?? "").match(/(?:^|[,;\n])\s*Płeć:\s*(Kobieta|Mężczyzna)\s*(?=$|[,;\n])/iu);
  return match ? (match[1].toLocaleLowerCase("pl") === "kobieta" ? "female" : "male") : item.system?.requiredGender ?? "";
}

export function genderRequirementMet(actor, item) {
  const required = getRequiredGender(item);
  return !required || item.system?.ignoreGenderRequirement === true || actor.system.identity?.gender === required;
}

export function describeTraitAutomation(actor, item) {
  const definition = getTraitBonusDefinition(item);
  if (!genderRequirementMet(actor, item)) return "Efekt nieaktywny: niespełniony wymóg płci (lub płeć nie została wybrana).";
  if (!definition) return "Wymóg płci spełniony. Działanie według opisu; rozpoznane kody premii naliczane automatycznie.";
  if (definition.groups) {
    const label = definition.groups[item.system.selectedSkillGroup];
    return label ? `Automatycznie: ${label}, +2 do każdej Umiejętności.` : "Wybierz pakiet w edycji zdolności — premia jeszcze nie działa.";
  }
  return `Automatycznie: ${definition.summary}`;
}

export function collectTraitSkillModifiers(actor) {
  const seen = new Set();
  const additions = [];
  const floors = new Map();
  for (const item of actor.items ?? []) {
    const code = getTraitBonusCode(item);
    const definition = getTraitBonusDefinition(item);
    if (!definition || item.system.applyMechanicalEffects === false || seen.has(code) || !genderRequirementMet(actor, item)) continue;
    seen.add(code);
    const skills = definition.groups
      ? (definition.groups[item.system.selectedSkillGroup] ? SKILL_GROUPS[item.system.selectedSkillGroup] : [])
      : definition.skills;
    for (const key of skills) {
      if (!actor.system.skills?.[key]) continue;
      const modifier = {
        id: `trait-${item.id ?? code}-${key}`, source: `${item.type === "perk" ? "Sztuczka" : "Cecha"}: ${item.name}`,
        scope: `skill.${key}`, value: definition.bonus ?? 0, expiresAt: ""
      };
      if (definition.bonus) additions.push(modifier);
      if (definition.minimum > (floors.get(key)?.minimum ?? 0)) {
        floors.set(key, { ...modifier, minimum: definition.minimum });
      }
    }
  }
  for (const [key, floor] of floors) {
    const bonus = additions.filter(m => m.scope === floor.scope).reduce((sum, m) => sum + m.value, 0);
    const value = Math.max(0, floor.minimum - Number(actor.system.skills[key].base) - bonus);
    if (value) additions.push({ ...floor, value });
  }
  return additions;
}
