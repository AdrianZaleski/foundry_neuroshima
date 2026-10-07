import { getHitLocation } from "./damage-resolution.mjs";

export const BURST_MODES = {
  burstShort: { name: "Krótka seria", duration: 1, multiplier: 1 },
  burstLong: { name: "Długa seria", duration: 2, multiplier: 3 },
  fullAuto: { name: "Ogień ciągły", duration: 3, multiplier: 6 }
};
export const isBurstAction = action => Boolean(action && Object.hasOwn(BURST_MODES, action.actionCode));
export function supportsAutomaticFire(weapon) {
  return String(weapon?.system.attackTypes ?? "").split(/[,;\s]+/).includes("A")
    && Number.isSafeInteger(weapon.system.fireRate) && weapon.system.fireRate > 0;
}
export function burstWeaponPenalty(weapon) {
  return [...String(weapon.system.actions ?? "").matchAll(/(?:^|[,\s])WEAPON_AUTO_PENALTY:(\d+)/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}
export function burstSegmentPlan(mode, fireRate, ammunition) {
  if (!Object.hasOwn(BURST_MODES, mode) || !Number.isSafeInteger(fireRate) || fireRate < 1
    || !Number.isSafeInteger(ammunition) || ammunition < 0) throw new Error("Nieprawidłowy tryb, szybkostrzelność lub liczba nabojów.");
  let remaining = ammunition;
  return Array.from({ length: BURST_MODES[mode].duration }, (_, i) => {
    const count = Math.min((i + 1) * fireRate, remaining); remaining -= count; return count;
  });
}
export function burstHits({ naturalResult, adjustedResult, successThreshold, startIndex, count, calledLocation = null }) {
  if (naturalResult === 20) return [];
  const hits = [];
  for (let offset = 0; offset < count; offset++) {
    const index = startIndex + offset;
    if (adjustedResult + index > successThreshold) break;
    hits.push({ bullet: index + 1, locationRoll: naturalResult + index,
      location: calledLocation ?? getHitLocation(naturalResult + index), points: successThreshold - adjustedResult - index });
  }
  return hits;
}
export function burstSegmentPending(action, tick) {
  return isBurstAction(action) && !action.resolved && !action.interrupted
    && tick >= action.startedAtTick && tick <= action.endsAtTick
    && (action.burst?.lastTick ?? action.startedAtTick - 1) < tick;
}
