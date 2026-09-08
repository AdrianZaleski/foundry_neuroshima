// Jawne interpretacje packs/catalogs/traits.json. Nie wyciągamy liczb
// z dowolnego opisu: liczba może oznaczać warunek, koszt lub limit użyć.
export const TRAIT_BONUSES = {
  TRAIT_HAZARDZISTA: {
    skills: ["kradziezKieszonkowa", "zwinneDlonie", "otwieranieZamkow"],
    bonus: 2, summary: "Zdolności manualne: +2 do każdej Umiejętności."
  },
  TRAIT_DOKTORQUINN: {
    skills: ["pierwszaPomoc", "leczenieRan", "leczenieChorob"],
    minimum: 4, summary: "Medycyna: minimalny poziom 4. Warunek z opisu postaci ocenia MG."
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
  if (item.type === "perk" && code === "PERK_HAZARDZISTA") return "TRAIT_HAZARDZISTA";
  return item.type === "trait" && TRAIT_BONUSES[code] ? code : null;
}

export function getTraitBonusDefinition(item) {
  return TRAIT_BONUSES[getTraitBonusCode(item)] ?? null;
}

export function collectTraitSkillModifiers(actor) {
  const seen = new Set();
  const additions = [];
  const floors = new Map();
  for (const item of actor.items ?? []) {
    const code = getTraitBonusCode(item);
    const definition = getTraitBonusDefinition(item);
    if (!definition || item.system.applyMechanicalEffects === false || seen.has(code)) continue;
    seen.add(code);
    for (const key of definition.skills) {
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
