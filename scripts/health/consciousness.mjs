// Reguła dodatkowa z fragmentu podręcznika dostarczonego przez użytkownika.
export function consciousnessTrigger(injury, lightCount = 0) {
  const { injuryType, location } = injury.system;
  if (injuryType === "critical") return { difficultyIndex: 5, reason: "Rana krytyczna" };
  const reasons = [];
  if (injuryType === "serious") reasons.push("Rana ciężka");
  if (["light", "serious"].includes(injuryType) && location === "head") reasons.push("Co najmniej lekka rana w głowę");
  if (injuryType === "light" && lightCount > 3) reasons.push(`${lightCount}. lekka rana w tej turze`);
  return reasons.length ? { difficultyIndex: 2, reason: reasons.join("; ") } : null;
}

export function injuryCombatContext(actor, combat) {
  if (!combat?.started || !combat.getCombatantsByActor(actor).length) return null;
  return { combatId: combat.id, round: combat.round, key: `${combat.id}_${combat.round}` };
}

export function prepareConsciousness(actor) {
  const stored = actor.getFlag?.("neuroshima", "consciousness") ?? {};
  const unconscious = actor.statuses?.has("unconscious") ?? false;
  const pending = unconscious ? [] : Object.values(stored.checks ?? {}).filter(check => !check.completed);
  return { pending, hasPending: pending.length > 0, unconscious };
}
