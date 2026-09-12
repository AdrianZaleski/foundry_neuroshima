export const HEALING_MODES = { rest: "Odpoczynek", noRest: "Bez odpoczynku", neglected: "Zaniedbana rana" };
export function planHealing(injury, days, mode) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650 || !Object.hasOwn(HEALING_MODES, mode)) throw new Error("Podaj liczbę dni od 1 do 3650 i warunki gojenia.");
  const before = injury.system.penaltyPercent;
  const oldPending = injury.system.healing?.pendingDay ?? 0;
  let pendingDay = oldPending, reduction = 0;
  if (injury.system.injuryType === "bruise") {
    reduction = days * 30;
    pendingDay = 0;
  } else if (mode === "rest") reduction = days * 5;
  else if (mode === "noRest") {
    reduction = Math.floor((days + oldPending) / 2) * 5;
    pendingDay = (days + oldPending) % 2;
  }
  const after = Math.max(0, before - reduction);
  if (after === 0) pendingDay = 0;
  return { before, after, pendingDay, days, mode: injury.system.injuryType === "bruise" ? "Siniaki — 30% dziennie" : HEALING_MODES[mode] };
}

export function healingUpdate(injury, plan, userId, timestamp) {
  return { _id: injury.id, "system.penaltyPercent": plan.after,
    "system.healing.pendingDay": plan.pendingDay,
    "system.healing.history": [...(injury.system.healing?.history ?? []), { timestamp, userId, days: plan.days, mode: plan.mode, before: plan.before, after: plan.after }] };
}
