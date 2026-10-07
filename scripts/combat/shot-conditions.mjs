// Neuroshima 1.5, strony drukowane 183–186, zwłaszcza tabela na s. 185.
export const SHOT_CONDITION_FIELDS = {
  shooterMovement: { label: "Ruch strzelca", options: {
    still: ["Bez biegu", 0], running: ["Bieg", 30], sprinting: ["Sprint / bieg asekuracyjny — tylko ogień na ślepo", null]
  } },
  shooterExposure: { label: "Sposób wychylenia strzelca", options: {
    normal: ["Swobodne strzelanie", 0], narrow: ["Wystawiam tylko głowę, rękę i broń", 20]
  } },
  targetMovement: { label: "Ruch celu", options: {
    still: ["Bez biegu", 0], running: ["Bieg", 20], sprinting: ["Sprint / bieg asekuracyjny", 40]
  } },
  targetPosture: { label: "Postawa celu", options: {
    standing: ["Stoi", 0], kneeling: ["Klęczy", 40], prone: ["Leży", 60]
  } },
  targetCover: { label: "Ile celu widać zza osłony?", options: {
    none: ["Cała sylwetka / brak osłony", 0], twoThirds: ["Około 2/3 sylwetki", 20],
    half: ["Około połowy sylwetki", 40], third: ["Około 1/3 sylwetki / wychylenie", 60],
    narrow: ["Prawie tylko głowa, ręka i broń", 80], hidden: ["Cel całkowicie zasłonięty", null]
  } },
  calledLocation: { label: "Miejsce trafienia", options: {
    random: ["Według naturalnego wyniku kości", 0], torso: ["Tułów", 20],
    leftLeg: ["Lewa noga", 40], rightLeg: ["Prawa noga", 40],
    leftArm: ["Lewa ręka", 60], rightArm: ["Prawa ręka", 60], head: ["Głowa", 80]
  } }
};

export function shotPercent(value) { return `${value > 0 ? "+" : ""}${value}%`; }

export function shotNumericInput(value, label, { min = -Infinity, optional = false } = {}) {
  const text = String(value ?? "").trim();
  if (!text && optional) return 0;
  const number = Number(text);
  if (!text || !Number.isFinite(number) || number < min) throw new Error(`Sprawdź pole „${label}”.`);
  return number;
}

export function calculateShotConditions(input = {}) {
  const selected = {}, modifiers = [], descriptions = [], blockers = [];
  for (const [key, field] of Object.entries(SHOT_CONDITION_FIELDS)) {
    const value = input[key] ?? Object.keys(field.options)[0];
    if (!Object.hasOwn(field.options, value)) throw new Error(`Sprawdź pole „${field.label}”.`);
    const [label, percent] = field.options[value];
    selected[key] = { value, label, percent };
    descriptions.push(`${field.label}: ${label}`);
    if (percent && !["targetPosture", "targetCover"].includes(key)) modifiers.push({ label: `${field.label}: ${label}`, percent });
  }
  if (selected.shooterMovement.value === "sprinting") blockers.push("W sprincie lub biegu asekuracyjnym można strzelać tylko na ślepo. Ten formularz rozstrzyga zwykły strzał do celu.");
  if (selected.targetCover.value === "hidden") blockers.push("Cel jest całkowicie zasłonięty. Zwykły strzał wymaga widocznego celu; strzał przez osłonę lub na ślepo rozpatrz z MG.");
  // Pozycje tabeli są alternatywami dla tej samej widocznej części sylwetki.
  const protection = Math.max(selected.targetPosture.percent ?? 0, selected.targetCover.percent ?? 0);
  if (protection) modifiers.push({ label: `Postawa / osłona celu: ${selected.targetPosture.label}; ${selected.targetCover.label} (jedna kara)`, percent: protection });
  const visibilityPenalty = shotNumericInput(input.visibilityPenalty ?? 0, "Widoczność", { min: 0 });
  if (visibilityPenalty) modifiers.push({ label: "Widoczność — ustalenie MG", percent: visibilityPenalty });
  descriptions.push(`Widoczność: ${shotPercent(visibilityPenalty)} (ustala MG)`);
  return { modifierPercent: modifiers.reduce((sum, entry) => sum + entry.percent, 0), modifiers, descriptions, blockers,
    calledLocation: selected.calledLocation.value === "random" ? null : selected.calledLocation.value,
    selected: Object.fromEntries(Object.entries(selected).map(([key, value]) => [key, value.value])), visibilityPenalty };
}
