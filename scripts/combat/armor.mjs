import { HIT_LOCATION_LABELS } from "./damage-resolution.mjs";

function getAttributeValue(actor, key) {
  return Math.max(0, Number(actor.system.attributes?.[key]?.value) || 0);
}

export function calculateArmorPenaltyPercent(actor, attributeKey = "zrecznosc") {
  const equippedArmor = actor.items.filter((item) => item.type === "armor" && item.system.equipped);
  let penalty = equippedArmor.reduce((sum, item) => {
    const applies = item.system.penaltyScope === "perception"
      ? attributeKey === "percepcja"
      : attributeKey === "zrecznosc";
    return sum + (applies ? Math.max(0, Number(item.system.penaltyPercent) || 0) : 0);
  }, 0);

  if (attributeKey === "zrecznosc" && penalty > 0) {
    const build = getAttributeValue(actor, "budowa");
    const mitigation = build > 18 ? 30 : build > 16 ? 20 : build > 14 ? 10 : 0;
    penalty = Math.max(0, penalty - mitigation);
  }

  // Zgodność ze starszymi kartami bez Itemów pancerza.
  if (equippedArmor.length === 0 && attributeKey === "zrecznosc") {
    return Math.max(0, Number(actor.system.testPenalties?.armorPercent) || 0);
  }
  return penalty;
}

function getReduction(locationData, damageType) {
  const special = damageType === "cutting"
    ? locationData.cuttingReduction
    : damageType === "ballistic" ? locationData.ballisticReduction : -1;
  return Number(special) >= 0 ? Number(special) : Number(locationData.reduction) || 0;
}

export function getArmorCoveringLocation(actor, location, damageType = "ballistic") {
  return actor.items
    .filter((item) => item.type === "armor" && item.system.equipped)
    .map((item) => ({ item, locationData: item.system[location] }))
    .filter(({ locationData }) => locationData?.protected && locationData.currentDurability > 0)
    .map(({ item, locationData }) => ({
      item,
      reduction: Math.max(0, Math.trunc(getReduction(locationData, damageType))),
      coverageChance: Math.max(0, Math.min(100, Math.trunc(locationData.coverageChance || 0))),
      currentDurability: locationData.currentDurability
    }));
}

export async function selectArmorForHit(actor, location, damageType = "ballistic") {
  const candidates = getArmorCoveringLocation(actor, location, damageType);
  if (candidates.length === 0) return null;
  let selected = candidates[0];
  if (candidates.length > 1) {
    const options = candidates.map(({ item, reduction, currentDurability }) => (
      `<option value="${item.id}">${foundry.utils.escapeHTML(item.name)} — Red. ${reduction}, Wyt. ${currentDurability}</option>`
    )).join("");
    const formData = await foundry.applications.api.DialogV2.input({
      window: { title: `Pancerz: ${HIT_LOCATION_LABELS[location]}` },
      content: `<p>Wybierz element, który przyjmuje trafienie. Redukcje nie sumują się.</p><select name="armorId">${options}</select>`,
      ok: { label: "Wybierz", icon: "fas fa-shield-halved" }, rejectClose: false, modal: true
    });
    selected = candidates.find(({ item }) => item.id === formData?.armorId) ?? selected;
  }

  if (selected.coverageChance < 100) {
    const roll = await new foundry.dice.Roll("1d20").evaluate();
    const result = roll.total;
    const threshold = Math.floor(selected.coverageChance / 5);
    if (result > threshold) return { ...selected, covered: false, coverageRoll: result };
    return { ...selected, covered: true, coverageRoll: result };
  }
  return { ...selected, covered: true, coverageRoll: null };
}

export async function applyArmorDurabilityLoss(armorSelection, location, loss) {
  if (!armorSelection?.covered || loss <= 0) return 0;
  const current = Math.max(0, Number(armorSelection.item.system[location]?.currentDurability) || 0);
  const applied = Math.min(current, Math.max(0, Math.trunc(loss)));
  if (applied > 0) {
    await armorSelection.item.update({ [`system.${location}.currentDurability`]: current - applied });
  }
  return applied;
}
