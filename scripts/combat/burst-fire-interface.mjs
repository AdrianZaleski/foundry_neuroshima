import { BURST_MODES, burstHits, burstSegmentPending, supportsAutomaticFire } from "./burst-fire.mjs";
import { getSegmentAction, getCombatSegment, calculateSegmentTick } from "./segments.mjs";
import { selectShotConfiguration, calculateAvailableCombatSkillPoints, calculateRangedShotResult, selectSpentSkillPoints, classifyJamSeverity, JAM_STATE_LABELS } from "./ranged-shot.mjs";
import { calculateAttributeValue, calculateSkillValue } from "../effects/modifiers.mjs";
import { usableFirearms } from "./weapon-handling-state.mjs";
import { resolveProjectileInjury } from "./projectile-injury.mjs";
import { HIT_LOCATION_LABELS, resolveDamage } from "./damage-resolution.mjs";
import { isUnconscious, allowCombatAction } from "./action-access.mjs";
const scope = "neuroshima";
const snapshot = weapon => JSON.stringify({ fireRate: weapon.system.fireRate, attackTypes: weapon.system.attackTypes,
  damageCode: weapon.system.damageCode, armorPenetration: weapon.system.armorPenetration,
  ammo: weapon.system.loadedAmmunitionSourceCode, misfireRoll: weapon.system.misfireRoll,
  accuracy: weapon.system.accuracyModifier, actions: weapon.system.actions });
const escape = value => foundry.utils.escapeHTML(String(value));

export async function resolveBurstFire(actor) {
  try { return await resolveBurst(actor); }
  catch (error) { ui.notifications.warn(`Nie zakończono serii: ${error.message} Wznów rozliczenie na karcie strzelca.`); return false; }
}

async function resolveBurst(actor) {
  const combat = game.combat;
  const combatant = combat?.getCombatantsByActor(actor)[0];
  let action = getSegmentAction(combatant);
  const tick = calculateSegmentTick(combat?.round, getCombatSegment(combat));
  if (!actor.isOwner || combat?.combatant?.id !== combatant?.id || !burstSegmentPending(action, tick)) return false;
  const committed = action.burst?.segment?.tick === tick
    && actor.items.get(action.aimingConfiguration?.weaponId)?.getFlag(scope, "burstReceipt") === `${action.burst.id}_${tick}`;
  if (!committed && !allowCombatAction(actor)) return false;
  const weapon = actor.items.get(action.aimingConfiguration?.weaponId);
  const target = canvas.tokens?.get(action.aimingConfiguration?.targetTokenId);
  if (!weapon || !target?.actor || target.actor.type !== "character") throw new Error("Wybierz broń oraz cel z kartą postaci na bieżącej scenie.");
  const current = () => {
    const latest = getSegmentAction(combatant);
    return actor.isOwner && game.combat === combat && combat.combatant?.id === combatant.id
      && calculateSegmentTick(combat.round, getCombatSegment(combat)) === tick
      && latest?.startedAtTick === action.startedAtTick && latest.actionCode === action.actionCode
      && !latest.resolved && !latest.interrupted;
  };
  let state = action.burst ? structuredClone(action.burst) : null;
  const save = async (changes = {}) => {
    if (!current()) throw new Error("Bieżąca akcja lub segment zmieniły się.");
    action = { ...getSegmentAction(combatant), ...changes, burst: structuredClone(state) };
    await combatant.setFlag(scope, "segmentAction", action);
  };
  if (!state) {
    if (tick !== action.startedAtTick) throw new Error("Wróć do pierwszego segmentu serii albo przerwij niezaczętą akcję.");
    if (!supportsAutomaticFire(weapon) || !usableFirearms(actor).includes(weapon)) throw new Error("Broń nie jest gotowa do ognia automatycznego (wymagany tryb A).");
    if (!resolveDamage({ damageCode: weapon.system.damageCode, naturalResult: 7 })) throw new Error("Popraw kod obrażeń broni przed rozpoczęciem serii.");
    const initialSnapshot = snapshot(weapon), initialAmmo = weapon.system.currentAmmunition;
    const config = await selectShotConfiguration(actor, target, action.aimingConfiguration, combatant.token?.object, { burst: true });
    if (!config) return false;
    if (isUnconscious(actor) || !current() || snapshot(weapon) !== initialSnapshot || weapon.system.currentAmmunition !== initialAmmo || !usableFirearms(actor).includes(weapon)) throw new Error("Stan strzelca lub broni zmienił się podczas wyboru warunków.");
    const skillLevel = Math.max(0, calculateSkillValue(actor, "bronMaszynowa"));
    const stored = combatant.getFlag(scope, "combatSkillUsage");
    const usage = stored?.round === combat.round ? structuredClone(stored) : { round: combat.round, spentBySkill: {} };
    const available = calculateAvailableCombatSkillPoints(actor, usage, "bronMaszynowa");
    if (available.blockedByPreviousSpending) { ui.notifications.warn("Nie można użyć Broni maszynowej: wcześniejsze wydatki przekroczyły limit wspólnej puli Umiejętności."); return false; }
    const roll = await new foundry.dice.Roll("1d20").evaluate();
    const natural = roll.dice[0].results[0].result;
    const spent = await selectSpentSkillPoints(actor, "Broń maszynowa", available.availablePoints, [natural]);
    if (isUnconscious(actor) || !current() || snapshot(weapon) !== initialSnapshot || weapon.system.currentAmmunition !== initialAmmo || !usableFirearms(actor).includes(weapon)) throw new Error("Stan strzelca lub broni zmienił się podczas testu.");
    const result = calculateRangedShotResult({ dexterity: calculateAttributeValue(actor, "zrecznosc"), naturalResults: [natural],
      difficultyPercentage: config.totalDifficultyPercentage, skillLevel, spentSkillPointsByDie: spent, reliabilityThreshold: weapon.system.misfireRoll });
    usage.spentBySkill.bronMaszynowa = (usage.spentBySkill.bronMaszynowa ?? 0) + spent[0];
    state = { id: foundry.utils.randomID(), lastTick: tick - 1, totalFired: 0, totalHits: 0,
      expectedAmmo: initialAmmo, weaponSnapshot: initialSnapshot, targetUuid: target.actor?.uuid,
      weapon: { name: weapon.name, damageCode: weapon.system.damageCode, armorPenetration: weapon.system.armorPenetration },
      fireRate: weapon.system.fireRate, calledLocation: config.conditions.calledLocation, result, usage,
      conditions: config.conditions.descriptions, breakdown: config.breakdown, totalDifficulty: config.totalDifficultyPercentage };
    // Jeden wynik dla całej serii, zapisany przed zużyciem amunicji.
    await save();
    await roll.toMessage({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }), flavor:
      `<strong>${BURST_MODES[action.actionCode].name}: ${escape(weapon.name)} → ${escape(target.name)}</strong><br>Jeden rzut na całą serię: ${natural}; wydane punkty Umiejętności: ${spent[0]}.<br>Warunki: ${config.conditions.descriptions.map(escape).join("; ")}<br>Modyfikatory: ${config.breakdown.map(entry => `${escape(entry.label)} ${entry.percent}%`).join("; ")}<br>Suma: ${config.totalDifficultyPercentage}%; próg ${result.successThreshold}; wynik po Umiejętności ${result.evaluatedDice[0].adjustedResult}.<br>Pierwszy pocisk: ${result.testPassed ? `${result.pointsDifference} PS` : "brak trafienia"}. Kolejne pogarszają wynik i przesuwają lokację o 1.` });
  }
  if (state.lastTick >= tick) return false;
  if (state.lastTick !== tick - 1) throw new Error("Nie rozliczono wcześniejszego segmentu serii.");
  if (!state.usageApplied) {
    await combatant.setFlag(scope, "combatSkillUsage", state.usage);
    state.usageApplied = true; await save();
  }
  if (!state.segment || state.segment.tick !== tick) {
    if (snapshot(weapon) !== state.weaponSnapshot || weapon.system.currentAmmunition !== state.expectedAmmo || !usableFirearms(actor).includes(weapon)) throw new Error("Stan broni lub amunicja zmieniły się w trakcie serii. Przywróć stan albo przerwij dalszy ogień.");
    const index = tick - action.startedAtTick + 1;
    const count = Math.min(index * state.fireRate, state.expectedAmmo);
    let jam = null;
    if (index === 1 && state.result.requiresJamRoll) {
      const roll = await new foundry.dice.Roll("1d20").evaluate();
      const result = roll.dice[0].results[0].result;
      jam = { state: classifyJamSeverity(result), result };
    }
    const hits = jam ? [] : burstHits({ naturalResult: state.result.evaluatedDice[0].naturalResult,
      adjustedResult: state.result.evaluatedDice[0].adjustedResult, successThreshold: state.result.successThreshold,
      startIndex: state.totalFired, count, calledLocation: state.calledLocation });
    state.segment = { tick, count: jam ? 0 : count, jam, before: state.expectedAmmo,
      after: state.expectedAmmo - (jam ? 0 : count), hits: hits.map(hit => ({ ...hit, id: foundry.utils.randomID() })), completed: false };
    await save();
  }
  const segment = state.segment;
  const receipt = `${state.id}_${tick}`;
  if (weapon.getFlag(scope, "burstReceipt") !== receipt) {
    if (!allowCombatAction(actor)) return false;
    if (!current() || snapshot(weapon) !== state.weaponSnapshot || weapon.system.currentAmmunition !== segment.before || !usableFirearms(actor).includes(weapon)) throw new Error("Broń lub amunicja zmieniły się przed zapisem segmentu.");
    await weapon.update({ "system.currentAmmunition": segment.after,
      ...(segment.jam ? { "system.jamState": segment.jam.state, "system.jamSeverityRoll": segment.jam.result } : {}),
      [`flags.${scope}.burstReceipt`]: receipt });
  }
  for (let i = 0; i < segment.hits.length; i++) {
    const targetActor = state.targetUuid && globalThis.fromUuid ? await fromUuid(state.targetUuid) : target.actor;
    const done = await resolveProjectileInjury(segment.hits[i], targetActor, state.weapon, async hit => {
      segment.hits[i] = hit; await save();
    });
    if (!done) return false;
  }
  segment.completed = true;
  state.lastTick = tick;
  state.expectedAmmo = segment.after;
  state.totalFired += segment.count;
  state.totalHits += segment.hits.length;
  const ended = isUnconscious(actor) || segment.jam || segment.after === 0 || tick === action.endsAtTick;
  await save(ended ? { endsAtTick: tick, resolved: true,
      resolution: segment.jam ? `Zacięcie (${segment.jam.result}) — brak wystrzału`
        : `Seria zakończona: ${state.totalFired} nabojów, ${state.totalHits} trafień${isUnconscious(actor) ? "; dalszy ogień przerwany — nieprzytomność" : segment.after === 0 ? "; pusty magazynek" : ""}` } : {});
  await foundry.documents.ChatMessage.create({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }), content:
    `<strong>${BURST_MODES[action.actionCode].name} — segment ${tick - action.startedAtTick + 1}</strong><p>Wystrzelono ${segment.count}; pozostało ${segment.after}. Trafienia: ${segment.hits.length}.</p><p>${segment.hits.map(hit => `Pocisk ${hit.bullet}: ${HIT_LOCATION_LABELS[hit.location] ?? "lokacja MG"}, ${hit.damage?.prevented ? "zatrzymany przez pancerz" : escape(hit.damage?.finalDamageName ?? "rana")}`).join("<br>")}</p>${segment.jam ? `<p>Zacięcie: ${JAM_STATE_LABELS[segment.jam.state]}, k20 = ${segment.jam.result}. Amunicja bez zmiany.</p>` : ""}` });
  return true;
}
