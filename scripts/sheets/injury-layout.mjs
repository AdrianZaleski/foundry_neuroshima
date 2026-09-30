// View data only: keep the Item values and healing rules authoritative.
export const INJURY_LOCATIONS = {
  general: "Ogólne / inny efekt",
  head: "Głowa",
  torso: "Tułów",
  leftArm: "Lewa ręka",
  rightArm: "Prawa ręka",
  leftLeg: "Lewa noga",
  rightLeg: "Prawa noga"
};

export function prepareInjuryLocations(injuries) {
  return ["torso", "head", "leftArm", "rightArm", "leftLeg", "rightLeg", "general"].map(key => {
    const items = injuries.filter(injury => (
      Object.hasOwn(INJURY_LOCATIONS, injury.location) ? injury.location : "general"
    ) === key);
    return {
      key,
      label: INJURY_LOCATIONS[key],
      items,
      hasInjuries: items.length > 0,
      penaltyPercent: items.reduce((sum, injury) => sum + injury.penaltyPercent, 0)
    };
  });
}
