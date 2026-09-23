// Pojedynek i zużycie jego segmentów mają jeden zapis na dokumencie Combat.
// Dzięki temu nie trzeba zapisywać osobno akcji obu Combatantów.
export const MELEE_DUELS_FLAG = "meleeDuels";
export function trackedDuels(combat) {
  const value = combat?.getFlag?.("neuroshima", MELEE_DUELS_FLAG);
  return Array.isArray(value) ? value : [];
}
const segmentOf = combat => Number(combat.getFlag("neuroshima", "combatSegment")) || 1;
const includesActor = (duel, id) => duel.configurations.some(entry => entry.id === id);

export function findTrackedDuel(combat, actorId) {
  return trackedDuels(combat).find(duel => !duel.ended && includesActor(duel, actorId));
}

export function assertTrackerParticipants(combat, duel) {
  if (!combat?.started) throw new Error("Najpierw rozpocznij walkę w Trackerze.");
  for (const entry of duel.configurations) {
    const matches = [...combat.combatants].filter(participant => participant.actor?.id === entry.id);
    if (matches.length !== 1) throw new Error("Każda postać pojedynku musi mieć dokładnie jeden token w tej walce.");
  }
}

export function assertTrackerStart(combat, duel) {
  assertTrackerParticipants(combat, duel);
  const segment = segmentOf(combat);
  if (!includesActor(duel, combat.combatant?.actor?.id)) {
    throw new Error("Zwarcie rozpocznij podczas kolejki jednej z jego stron.");
  }
  const tick = (combat.round - 1) * 3 + segment;
  for (const entry of duel.configurations) {
    if (findTrackedDuel(combat, entry.id)) throw new Error("Postać już uczestniczy w pojedynku tej walki.");
    const participant = [...combat.combatants].find(candidate => candidate.actor?.id === entry.id);
    const action = participant.getFlag("neuroshima", "segmentAction");
    const interruptedShot = action?.effectCode === "rangedShot" && !action.resolved
      && !action.interrupted && action.startedAtTick <= tick && action.endsAtTick >= tick;
    const arrivingAction = participant.id === combat.combatant?.id && action?.endsAtTick === tick;
    const participantIndex = combat.turns.findIndex(candidate => candidate.id === participant.id);
    const completedEarlierThisSegment = participantIndex < combat.turn && action?.endsAtTick === tick;
    if (action && action.endsAtTick >= tick && !interruptedShot && !arrivingAction && !completedEarlierThisSegment) {
      throw new Error("Postać ma już zadeklarowaną akcję. Dokończ ją przed pojedynkiem.");
    }
    if (meleeTrackerAction(combat, entry.id)) throw new Error("Postać zużyła już segment na wcześniejszy pojedynek.");
  }
}

export async function interruptRangedShotsForMelee(combat, duel) {
  const segment = segmentOf(combat);
  const tick = (combat.round - 1) * 3 + segment;
  const interrupted = [];
  for (const entry of duel.configurations) {
    const participant = [...combat.combatants].find(candidate => candidate.actor?.id === entry.id);
    const action = participant?.getFlag("neuroshima", "segmentAction");
    if (action?.effectCode !== "rangedShot" || action.resolved || action.interrupted
      || action.startedAtTick > tick || action.endsAtTick < tick) continue;
    const changed = { ...action, endsAtTick: tick, interrupted: true, resolved: true,
      resolution: "Przerwano przez rozpoczęcie walki wręcz — brak strzału" };
    await participant.setFlag("neuroshima", "segmentAction", changed);
    interrupted.push(entry.id);
    await foundry.documents.ChatMessage.create({
      speaker: foundry.documents.ChatMessage.getSpeaker({ actor: participant.actor }),
      content: `<strong>${foundry.utils.escapeHTML(participant.actor.name)}</strong>: akcja „${foundry.utils.escapeHTML(action.name)}” została przerwana przez rozpoczęcie walki wręcz. Strzał nie padł.`
    });
  }
  return interrupted;
}

export function assertTrackerExchange(combat, duel) {
  assertTrackerParticipants(combat, duel);
  if (duel.trackerRound !== combat.round || !duel.state || duel.state.segment > 3
    || duel.state.segment < segmentOf(combat)) {
    throw new Error("Poczekaj na właściwą rundę pojedynku w Combat Trackerze.");
  }
  if (!includesActor(duel, combat.combatant?.actor?.id)) throw new Error("Teraz działa inny uczestnik Trackera.");
}

export function assertTrackerNextRound(combat, duel) {
  assertTrackerParticipants(combat, duel);
  if (duel.damageHits?.some(hit => !hit.completed)) throw new Error("Najpierw rozlicz oczekujące obrażenia pojedynku.");
  if (duel.state?.segment !== 4 || combat.round !== duel.trackerRound + 1 || segmentOf(combat) !== 1) {
    throw new Error("Nowe kości wymagają ukończenia tury pojedynku i rozpoczęcia następnej rundy Trackera.");
  }
}

export function meleeTrackerAction(combat, actorId) {
  if (!combat?.started) return null;
  const segment = segmentOf(combat);
  for (const duel of trackedDuels(combat)) {
    if (duel.trackerRound !== combat.round || !includesActor(duel, actorId)) continue;
    if (duel.state?.segment === 4) {
      const startedSegment = Math.max(1, Math.min(Number(duel.trackerStartSegment) || 1, 3));
      const tick = (combat.round - 1) * 3 + startedSegment;
      return { name: "Walka wręcz — runda rozliczona", duration: 4 - startedSegment, actionCode: "melee",
        effectCode: "melee", resolved: true, requiresTest: false, startedRound: combat.round,
        startedSegment, startedAtTick: tick, endsAtTick: tick + (3 - startedSegment) };
    }
    const exchange = duel.state?.history.find(entry => entry.type === "exchange"
      && entry.segment <= segment && entry.segment + entry.cost > segment);
    if (!exchange) continue;
    const tick = (combat.round - 1) * 3 + exchange.segment;
    return { name: "Pojedynek wręcz", duration: exchange.cost, actionCode: "melee",
      effectCode: "melee", resolved: true, requiresTest: false,
      startedRound: combat.round, startedSegment: exchange.segment,
      startedAtTick: tick, endsAtTick: tick + exchange.cost - 1 };
  }
  return null;
}

export function meleeRoundSpent(combat, actorId) {
  return Boolean(combat?.started && trackedDuels(combat).some(duel => duel.trackerRound === combat.round
    && includesActor(duel, actorId) && duel.state?.segment === 4));
}

export function blocksMeleeAdvance(combat, wholeRound = false) {
  if (!combat?.started) return false;
  return trackedDuels(combat).some(duel => {
    if (duel.damageHits?.some(hit => !hit.completed)) return wholeRound || includesActor(duel, combat.combatant?.actor?.id);
    if (duel.ended) return false;
    const pending = duel.trackerRound < combat.round || !duel.state
      || (duel.trackerRound === combat.round && duel.state.segment <= 3);
    return pending && (wholeRound || includesActor(duel, combat.combatant?.actor?.id));
  });
}
