import { damageDefinitions } from "../catalogs/combat-reference.mjs";

export const HIT_LOCATION_LABELS = {
  head: "Głowa",
  rightArm: "Prawa ręka",
  leftArm: "Lewa ręka",
  torso: "Tułów",
  rightLeg: "Prawa noga",
  leftLeg: "Lewa noga"
};

const SEVERITY_CODES = ["D", "L", "C", "K"];
const INJURY_TYPES_BY_SEVERITY = {
  D: "abrasion",
  L: "light",
  C: "serious",
  K: "critical"
};

export function getHitLocation(naturalResult) {
  if (naturalResult >= 1 && naturalResult <= 2) return "head";
  if (naturalResult <= 4) return "rightArm";
  if (naturalResult <= 6) return "leftArm";
  if (naturalResult <= 15) return "torso";
  if (naturalResult <= 17) return "rightLeg";
  if (naturalResult <= 19) return "leftLeg";
  return null;
}

function parseDamageCode(damageCode) {
  const match = /^([DS])_([DLCK])$/.exec(String(damageCode ?? "").trim());
  if (!match) return null;
  return { damageKind: match[1], severityCode: match[2] };
}

function getLocationDescription(definition, location) {
  const descriptionKey = location === "leftLeg" || location === "rightLeg"
    ? "leg"
    : location;
  return definition?.locationDescriptions?.[descriptionKey] ?? "";
}

export function resolveDamage({
  damageCode,
  naturalResult,
  armorReduction = 0,
  armorPenetration = 0
}) {
  const parsedDamage = parseDamageCode(damageCode);
  const location = getHitLocation(Number(naturalResult));
  if (!parsedDamage || !location) return null;

  const baseSeverityIndex = SEVERITY_CODES.indexOf(parsedDamage.severityCode);
  const headBonus = location === "head" ? 1 : 0;
  // Nie ograniczamy obrażeń Krytycznych podniesionych trafieniem w głowę.
  // Ten zapasowy poziom może zostać dopiero pochłonięty przez pancerz.
  const incomingSeverityIndex = baseSeverityIndex + headBonus;
  const normalizedArmorReduction = Math.max(0, Math.trunc(Number(armorReduction) || 0));
  const normalizedArmorPenetration = Math.max(0, Math.trunc(Number(armorPenetration) || 0));
  const effectiveArmorReduction = Math.max(
    0,
    normalizedArmorReduction - normalizedArmorPenetration
  );
  const remainingSeverityIndex = incomingSeverityIndex - effectiveArmorReduction;
  const prevented = remainingSeverityIndex < 0;
  const finalSeverityCode = prevented
    ? null
    : SEVERITY_CODES[Math.min(remainingSeverityIndex, SEVERITY_CODES.length - 1)];
  const finalDamageCode = finalSeverityCode
    ? `${parsedDamage.damageKind}_${finalSeverityCode}`
    : null;
  const finalDefinition = damageDefinitions.find(
    (definition) => definition.symbol === finalDamageCode
  ) ?? null;

  return {
    damageKind: parsedDamage.damageKind,
    baseDamageCode: `${parsedDamage.damageKind}_${parsedDamage.severityCode}`,
    baseSeverityCode: parsedDamage.severityCode,
    location,
    locationLabel: HIT_LOCATION_LABELS[location],
    headBonus,
    incomingSeverityIndex,
    armorReduction: normalizedArmorReduction,
    armorPenetration: normalizedArmorPenetration,
    effectiveArmorReduction,
    prevented,
    finalDamageCode,
    finalSeverityCode,
    finalDamageName: finalDefinition?.name ?? "Brak rany",
    injuryType: finalSeverityCode
      ? INJURY_TYPES_BY_SEVERITY[finalSeverityCode]
      : null,
    locationDescription: getLocationDescription(finalDefinition, location),
    armorDurabilityLoss: parsedDamage.damageKind === "S" ? 0 : incomingSeverityIndex >= 3
      ? 3
      : incomingSeverityIndex >= 2 ? 1 : 0
  };
}
