import { consciousnessTrigger, injuryCombatContext, prepareConsciousness } from "./consciousness.mjs";
import { rollAttribute } from "../rolls/attribute-roll.mjs";
import { escapeModifierText as escape } from "../effects/modifiers.mjs";

const registrations = new Map();
const rolling = new Set();
const scope = "neuroshima";
const checkPath = id => `flags.${scope}.consciousness.checks.${id}`;
const actorKey = actor => actor.uuid ?? actor.id;
const isUnconscious = actor => actor.statuses?.has("unconscious") ?? false;
const skippedCheck = { completed: true, skippedReason: "Postać jest już nieprzytomna" };

async function skipPendingChecks(actor) {
  if (!actor.isOwner || !isUnconscious(actor)) return;
  const checks = actor.getFlag(scope, "consciousness")?.checks ?? {};
  const updates = {};
  for (const check of Object.values(checks)) {
    if (check.completed) continue;
    updates[`${checkPath(check.id)}.completed`] = true;
    if (!check.result) updates[`${checkPath(check.id)}.skippedReason`] = skippedCheck.skippedReason;
  }
  if (Object.keys(updates).length) await actor.update(updates);
}

// Rejestracja nie czeka na dialog: kolejne rany mogą nadejść podczas rzutu.
export async function registerConsciousnessInjury(injury) {
  const actor = injury.parent;
  if (injury.type !== "injury" || actor?.type !== "character" || !actor.isOwner) return;
  const stored = actor.getFlag(scope, "consciousness") ?? {};
  if (stored.checks?.[injury.id]) return;
  const context = injury.getFlag(scope, "receivedInCombat");
  const received = stored.lightWounds?.[context?.key] ?? [];
  const updates = {};
  let lightCount = 0;
  if (context && injury.system.injuryType === "light") {
    if (received.includes(injury.id)) return;
    const ids = [...received, injury.id];
    lightCount = ids.length;
    updates[`flags.${scope}.consciousness.lightWounds.${context.key}`] = ids;
  }
  const trigger = consciousnessTrigger(injury, lightCount);
  if (trigger) updates[checkPath(injury.id)] = {
    ...trigger, id: injury.id, injuryName: injury.name, context, completed: false, result: null,
    ...(isUnconscious(actor) ? skippedCheck : {})
  };
  if (Object.keys(updates).length) await actor.update(updates);
  return trigger;
}

export async function resolveConsciousness(actor, { manual = true } = {}) {
  const key = actorKey(actor);
  if (!actor.isOwner || rolling.has(key)) return;
  rolling.add(key);
  try {
    if (isUnconscious(actor)) { await skipPendingChecks(actor); return; }
    if (!prepareConsciousness(actor).hasPending && manual) {
      const answer = await foundry.applications.api.DialogV2.input({
        window: { title: "Zachowanie przytomności" },
        content: `<p>Test Budowy według dodatkowej reguły zachowania przytomności.</p>
          <label>Powód testu<select name="reason">
            <option value="serious">Rana ciężka</option><option value="head">Co najmniej lekka rana w głowę</option>
            <option value="fourth">Więcej niż 3 lekkie rany w jednej turze</option><option value="critical">Rana krytyczna</option>
          </select></label><p>Poza aktywną walką liczbę lekkich ran w turze ustalasz z MG.</p>`,
        ok: { label: "Przejdź do testu" }, rejectClose: false, modal: false
      });
      const reasons = { serious: "Rana ciężka", head: "Co najmniej lekka rana w głowę",
        fourth: "Więcej niż 3 lekkie rany w jednej turze", critical: "Rana krytyczna" };
      if (!answer || !Object.hasOwn(reasons, answer.reason) || !actor.isOwner) return;
      if (isUnconscious(actor)) { await skipPendingChecks(actor); return; }
      const id = foundry.utils.randomID();
      await actor.update({ [checkPath(id)]: { id, reason: reasons[answer.reason],
        difficultyIndex: answer.reason === "critical" ? 5 : 2, completed: false, result: null } });
    }
    while (actor.isOwner) {
      if (isUnconscious(actor)) { await skipPendingChecks(actor); break; }
      const check = prepareConsciousness(actor).pending[0];
      if (!check) break;
      let result = check.result;
      if (!result) {
        result = await rollAttribute(actor, "budowa", {
          fixedTestType: "closed", fixedDifficultyIndex: check.difficultyIndex,
          modal: false,
          canRoll: () => actor.isOwner && !isUnconscious(actor),
          configurationTitle: `Zachowanie przytomności — ${actor.name}`,
          testTitle: "Zachowanie przytomności — test Budowy",
          testDescription: `${check.reason}${check.injuryName ? `: ${check.injuryName}` : ""}. ${check.context ? `Tura: runda ${check.context.round} Trackera (3 segmenty). ` : ""}Niepowodzenie oznacza utratę przytomności. Zamknięcie okna pozostawia test do rozpatrzenia na karcie.`
        });
        if (!result || !actor.isOwner) {
          await skipPendingChecks(actor);
          break;
        }
        // Wynik przechowujemy przed statusem: ponowienie po błędzie zapisu
        // statusu nie daje nowego rzutu.
        await actor.update({ [`${checkPath(check.id)}.result`]: result });
      }
      if (!result.testPassed) await actor.toggleStatusEffect("unconscious", { active: true });
      await actor.update({ [`${checkPath(check.id)}.completed`]: true });
      const verdict = result.testPassed
        ? (actor.statuses?.has("unconscious") ? "Test zdany. Wcześniejszy stan nieprzytomności pozostaje — ten test nie wybudza postaci." : "Postać zachowuje przytomność.")
        : "Postać traci przytomność. Dodano status Nieprzytomność.";
      await foundry.documents.ChatMessage.create({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
        content: `<p><strong>Zachowanie przytomności — ${escape(actor.name)}</strong></p><p>${escape(check.reason)}</p><p>${verdict}</p>` });
    }
  } catch (error) {
    ui.notifications.error(`Nie zakończono testu przytomności: ${error.message}. Wróć do niego na karcie postaci.`);
  } finally { rolling.delete(key); }
}

export function initializeConsciousness() {
  // Także ręczne nadanie statusu przez MG kończy zaległe testy.
  const onUnconscious = (actor, userId) => {
    if (userId !== game.user.id || actor?.type !== "character" || !isUnconscious(actor)) return;
    return (async () => {
      await skipPendingChecks(actor);
      const { interruptUnconsciousActions } = await import("../combat/segments.mjs");
      await interruptUnconsciousActions();
    })().catch(error => ui.notifications.error(`Nie zakończono obsługi nieprzytomności: ${error.message}`));
  };
  Hooks.on("createActiveEffect", (effect, options, userId) => onUnconscious(effect.parent, userId));
  Hooks.on("updateActiveEffect", (effect, changes, options, userId) => onUnconscious(effect.parent, userId));
  Hooks.on("preCreateItem", injury => {
    if (injury.type !== "injury" || injury.parent?.type !== "character") return;
    // Nowa rana, także skopiowana, otrzymuje czas bieżącego zdarzenia.
    injury.updateSource({ [`flags.${scope}.receivedInCombat`]: injuryCombatContext(injury.parent, game.combat) });
  });
  Hooks.on("createItem", (injury, options, userId) => {
    // Tylko klient zapisujący ranę; pozostali nie otwierają kopii dialogu.
    if (userId !== game.user.id || injury.type !== "injury" || injury.parent?.type !== "character") return;
    const key = actorKey(injury.parent);
    const task = (registrations.get(key) ?? Promise.resolve()).then(() => registerConsciousnessInjury(injury));
    const settled = task.catch(error => ui.notifications.error(`Nie zapisano testu przytomności: ${error.message}. Użyj przycisku na karcie.`));
    registrations.set(key, settled);
    void settled.then(() => {
      if (registrations.get(key) === settled) registrations.delete(key);
      return resolveConsciousness(injury.parent, { manual: false });
    });
  });
}
