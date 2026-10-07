export const UNCONSCIOUS_ACTION_MESSAGE = "Postać jest nieprzytomna i nie może wykonywać akcji. MG musi najpierw zdjąć status Nieprzytomność.";
export const isUnconscious = actor => actor?.statuses?.has("unconscious") ?? false;
export function allowCombatAction(actor) {
  if (!isUnconscious(actor)) return true;
  ui.notifications.warn(UNCONSCIOUS_ACTION_MESSAGE);
  return false;
}
export function assertCombatAction(actor) {
  if (isUnconscious(actor)) throw new Error(UNCONSCIOUS_ACTION_MESSAGE);
}
