import { HIT_LOCATION_LABELS, resolveDamage } from "./damage-resolution.mjs";
import { selectArmorForHit } from "./armor.mjs";
import { rollPainResistanceForInjury } from "../rolls/injury-roll.mjs";

// Każdy pocisk ma trwałe id rany i etap rozliczenia. Zamknięcie okna
// lub awaria zapisu nie powtarza testu bólu ani zużycia pancerza.
export async function resolveProjectileInjury(hit, target, weapon, persist) {
  if (hit.completed) return true;
  if (!target?.isOwner) { ui.notifications.warn("Obrażenia serii oczekują na MG lub właściciela celu. MG może wznowić je na karcie strzelca."); return false; }
  const save = async changes => { hit = { ...hit, ...changes }; await persist(hit); };
  if (!hit.location) {
    const answer = await foundry.applications.api.DialogV2.input({ window: { title: `Lokacja pocisku ${hit.bullet} — decyzja MG` },
      content: `<p>Wynik lokacji ${hit.locationRoll} wykracza poza tabelę 1–19. Wskaż lokację uzgodnioną z MG.</p><select name="location">${Object.entries(HIT_LOCATION_LABELS).map(([key,label])=>`<option value="${key}">${label}</option>`).join("")}</select>`,
      ok: { label: "Zatwierdź lokację" }, rejectClose: false, modal: true });
    if (!answer || !Object.hasOwn(HIT_LOCATION_LABELS, answer.location)) return false;
    await save({ location: answer.location });
  }
  if (!hit.damage) {
    const armor = await selectArmorForHit(target, hit.location, "ballistic");
    const damage = resolveDamage({ damageCode: weapon.damageCode, naturalResult: hit.locationRoll,
      hitLocation: hit.location, armorReduction: armor?.covered ? armor.reduction : 0, armorPenetration: weapon.armorPenetration });
    if (!damage) throw new Error("Nieprawidłowy kod obrażeń broni.");
    await save({ damage, armorId: armor?.covered ? armor.item.id : null });
  }
  if (!hit.damage.prevented && !hit.pain) {
    const pain = await rollPainResistanceForInjury(target, hit.damage.injuryType);
    if (!pain) return false;
    await save({ pain });
  }
  if (!hit.damage.prevented && !target.items.get(hit.id)) {
    await target.createEmbeddedDocuments("Item", [{ _id: hit.id, name: `${hit.damage.finalDamageName} — pocisk ${hit.bullet}`,
      type: "injury", system: { injuryType: hit.pain.injuryType, location: hit.location, penaltyPercent: hit.pain.penaltyPercent,
        description: `${weapon.name}: seria, pocisk ${hit.bullet}; lokacja ${HIT_LOCATION_LABELS[hit.location]}.` },
      flags: { neuroshima: { burstHitId: hit.id } } }], { keepId: true });
  }
  if (hit.armorId && hit.damage.armorDurabilityLoss > 0) {
    const armor = target.items.get(hit.armorId);
    if (!armor) throw new Error("Przywróć pancerz przyjmujący trafienie, aby dokończyć obrażenia.");
    if (!armor.getFlag("neuroshima", "burstHits")?.[hit.id]) {
      await armor.update({ [`system.${hit.location}.currentDurability`]: Math.max(0, armor.system[hit.location].currentDurability - hit.damage.armorDurabilityLoss),
        [`flags.neuroshima.burstHits.${hit.id}`]: true });
    }
  }
  await save({ completed: true });
  return true;
}
