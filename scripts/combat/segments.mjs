import {
  prepareCombatActionOptions,
  resolveCombatAction
} from "./action-catalog.mjs";

const SYSTEM_ID = "neuroshima";
const COMBAT_SEGMENT_FLAG = "combatSegment";
const COMBATANT_ACTION_FLAG = "segmentAction";
const AIMING_PREPARATION_FLAG = "aimingPreparation";
const SKILL_USAGE_FLAG = "combatSkillUsage";
const SEGMENTS_PER_ROUND = 3;

function clampSegment(segment) {
  return Math.max(1, Math.min(Number(segment) || 1, SEGMENTS_PER_ROUND));
}

function escapeForChat(value) {
  return foundry.utils.escapeHTML(String(value ?? ""));
}

async function createCombatMessage(content, actor = null) {
  await foundry.documents.ChatMessage.create({
    speaker: foundry.documents.ChatMessage.getSpeaker(actor ? { actor } : {}),
    content
  });
}

export function calculateSegmentTick(round, segment) {
  const safeRound = Math.max(1, Number(round) || 1);
  return ((safeRound - 1) * SEGMENTS_PER_ROUND) + clampSegment(segment);
}

export function getCombatSegment(combat) {
  return clampSegment(combat?.getFlag(SYSTEM_ID, COMBAT_SEGMENT_FLAG));
}

export function getSegmentAction(combatant) {
  return combatant?.getFlag(SYSTEM_ID, COMBATANT_ACTION_FLAG) ?? null;
}

function findActorCombatant(combat, actor) {
  if (!combat || !actor) return null;
  return combat.getCombatantsByActor(actor)[0] ?? null;
}

function actionConsumesTick(action, currentTick) {
  if (!action) return false;
  return currentTick >= action.startedAtTick && currentTick <= action.endsAtTick;
}

function describeActionTiming(action, currentTick) {
  const remainingAfterCurrentSegment = Math.max(0, action.endsAtTick - currentTick);

  if (remainingAfterCurrentSegment === 0) {
    return "Akcja zajmuje bieżący segment.";
  }

  const segmentWord = remainingAfterCurrentSegment === 1 ? "segment" : "segmenty";
  return `Po bieżącym pozostanie: ${remainingAfterCurrentSegment} ${segmentWord}.`;
}

export function prepareActorCombatStatus(actor, combat = game.combat) {
  const combatant = findActorCombatant(combat, actor);

  if (!combatant) {
    return {
      inCombat: false,
      started: false
    };
  }

  const segment = getCombatSegment(combat);
  const round = Math.max(1, Number(combat.round) || 1);
  const currentTick = calculateSegmentTick(round, segment);
  const action = getSegmentAction(combatant);
  const consumesCurrentSegment = actionConsumesTick(action, currentTick);
  const isActiveTurn = combat.started && combat.combatant?.id === combatant.id;

  return {
    inCombat: true,
    started: combat.started,
    combatantId: combatant.id,
    round,
    segment,
    isActiveTurn,
    canDeclareAction: isActiveTurn && !consumesCurrentSegment,
    consumesCurrentSegment,
    action: action ? {
      ...action,
      durationLabel: action.duration === 1
        ? "1 segment"
        : `${action.duration} segmenty`,
      isCurrent: consumesCurrentSegment,
      isPending: consumesCurrentSegment && action.endsAtTick > currentTick,
      canFinishEarly: isActiveTurn
        && consumesCurrentSegment
        && action.endsAtTick > currentTick
        && action.effectCode !== "clearMinorJam",
      canInterrupt: isActiveTurn
        && consumesCurrentSegment
        && !action.resolved
        && (
          action.endsAtTick > currentTick
          || ["rangedShot", "clearMinorJam"].includes(action.effectCode)
        ),
      finishEarlyLabel: action.effectCode === "rangedShot"
        ? "Zakończ wcześniej i strzel"
        : "Zakończ wcześniej",
      interruptLabel: action.effectCode === "rangedShot"
        ? "Przerwij akcję bez strzału"
        : "Przerwij akcję",
      canResolveShot: isActiveTurn
        && consumesCurrentSegment
        && action.effectCode === "rangedShot"
        && action.endsAtTick === currentTick
        && Boolean(action.aimingConfiguration)
        && !action.interrupted
        && !action.resolved,
      canConfigureAiming: isActiveTurn
        && consumesCurrentSegment
        && action.effectCode === "rangedShot"
        && !action.aimingConfiguration,
      canConfigureJamClearing: isActiveTurn
        && consumesCurrentSegment
        && action.effectCode === "clearMinorJam"
        && !action.jamClearingConfiguration,
      timingDescription: consumesCurrentSegment
        ? describeActionTiming(action, currentTick)
        : "Poprzednia akcja jest zakończona."
    } : null
  };
}

async function requireActiveCombatant(actor) {
  const combat = game.combat;
  const combatant = findActorCombatant(combat, actor);

  if (!combat || !combatant) {
    ui.notifications.warn("Postać nie uczestniczy w aktywnej walce.");
    return null;
  }

  if (!combat.started) {
    ui.notifications.warn("Najpierw rozpocznij walkę w Combat Trackerze.");
    return null;
  }

  if (combat.combatant?.id !== combatant.id) {
    ui.notifications.warn("Teraz działa inny uczestnik walki.");
    return null;
  }

  return { combat, combatant };
}

export async function declareSegmentAction(actor, actionName, duration, metadata = {}) {
  const activeParticipant = await requireActiveCombatant(actor);
  if (!activeParticipant) return false;

  const { combat, combatant } = activeParticipant;
  const safeName = String(actionName ?? "").trim();
  const safeDuration = Math.max(1, Math.min(Number(duration) || 1, SEGMENTS_PER_ROUND));
  const segment = getCombatSegment(combat);
  const round = Math.max(1, Number(combat.round) || 1);
  const currentTick = calculateSegmentTick(round, segment);
  const previousAction = getSegmentAction(combatant);

  if (!safeName) {
    ui.notifications.warn("Podaj nazwę wykonywanej akcji.");
    return false;
  }

  if (actionConsumesTick(previousAction, currentTick)) {
    ui.notifications.warn("Bieżący segment jest już zajęty przez wcześniej zadeklarowaną akcję.");
    return false;
  }

  const action = {
    name: safeName,
    duration: safeDuration,
    actionCode: metadata.actionCode ?? "custom",
    requiresTest: Boolean(metadata.requiresTest),
    isCustom: Boolean(metadata.isCustom),
    effectCode: metadata.effectCode ?? "",
    aimingBonusDice: Number(metadata.aimingBonusDice) || 0,
    startedRound: round,
    startedSegment: segment,
    startedAtTick: currentTick,
    endsAtTick: currentTick + safeDuration - 1
  };

  // Stary, osobny zapis przygotowanego celowania nie jest już używany.
  // Strzał przechowuje broń, cel i liczbę kości we własnej akcji.
  await combatant.unsetFlag(SYSTEM_ID, AIMING_PREPARATION_FLAG);

  await combatant.setFlag(SYSTEM_ID, COMBATANT_ACTION_FLAG, action);

  const endingDescription = safeDuration === 1
    ? "Akcja kończy się w tym segmencie."
    : `Akcja potrwa ${safeDuration} segmenty.`;
  await createCombatMessage([
    `<strong>${escapeForChat(actor.name)}: ${escapeForChat(safeName)}</strong>`,
    `Runda ${round}, segment ${segment}.`,
    endingDescription,
    action.requiresTest ? "Rozstrzygnięcie wymaga testu." : "Akcja nie wymaga testu."
  ].join("<br>"), actor);

  return true;
}

export async function passSegment(actor) {
  return declareSegmentAction(actor, "Pas", 1, {
    actionCode: "pass",
    requiresTest: false
  });
}

async function changeCurrentAction(actor, changeType) {
  const activeParticipant = await requireActiveCombatant(actor);
  if (!activeParticipant) return false;

  const { combat, combatant } = activeParticipant;
  const action = getSegmentAction(combatant);
  const segment = getCombatSegment(combat);
  const round = Math.max(1, Number(combat.round) || 1);
  const currentTick = calculateSegmentTick(round, segment);
  const canInterruptUnresolvedShotAtEnd = changeType === "interrupted"
    && ["rangedShot", "clearMinorJam"].includes(action?.effectCode)
    && !action.resolved
    && action.endsAtTick === currentTick;

  if (
    !actionConsumesTick(action, currentTick)
    || (action.endsAtTick <= currentTick && !canInterruptUnresolvedShotAtEnd)
  ) {
    ui.notifications.warn("Postać nie wykonuje obecnie wielosegmentowej akcji.");
    return false;
  }

  const changedAction = {
    ...action,
    endsAtTick: currentTick,
    manuallyFinished: changeType === "finished",
    interrupted: changeType === "interrupted",
    ...(action.effectCode === "rangedShot" && changeType === "finished"
      ? { aimingBonusDice: Math.min(2, currentTick - action.startedAtTick) }
      : {}),
    ...(action.effectCode === "rangedShot" && changeType === "interrupted"
      ? { resolved: true, resolution: "Przerwano — brak strzału" }
      : {})
  };
  await combatant.setFlag(SYSTEM_ID, COMBATANT_ACTION_FLAG, changedAction);

  const resultLabel = changeType === "finished" ? "zakończona wcześniej" : "przerwana";
  await createCombatMessage(
    `<strong>${escapeForChat(actor.name)}</strong>: akcja „${escapeForChat(action.name)}” została ${resultLabel}.`,
    actor
  );

  return true;
}

export async function finishSegmentAction(actor) {
  return changeCurrentAction(actor, "finished");
}

export async function interruptSegmentAction(actor) {
  return changeCurrentAction(actor, "interrupted");
}

export async function markCurrentSegmentActionResolved(actor, resolution) {
  const combat = game.combat;
  const combatant = findActorCombatant(combat, actor);
  const action = getSegmentAction(combatant);
  if (!combatant || !action) return;

  await combatant.setFlag(SYSTEM_ID, COMBATANT_ACTION_FLAG, {
    ...action,
    resolved: true,
    resolution
  });
}

export async function configureCurrentAiming(actor, aimingConfiguration) {
  const activeParticipant = await requireActiveCombatant(actor);
  if (!activeParticipant) return false;

  const { combat, combatant } = activeParticipant;
  const action = getSegmentAction(combatant);
  const currentTick = calculateSegmentTick(combat.round, getCombatSegment(combat));
  if (
    !actionConsumesTick(action, currentTick)
    || action.effectCode !== "rangedShot"
  ) {
    ui.notifications.warn("Bieżąca akcja nie jest przygotowywanym strzałem.");
    return false;
  }

  const configuredAction = { ...action, aimingConfiguration };
  await combatant.setFlag(SYSTEM_ID, COMBATANT_ACTION_FLAG, configuredAction);

  return true;
}

export async function configureCurrentJamClearing(actor, jamClearingConfiguration) {
  const activeParticipant = await requireActiveCombatant(actor);
  if (!activeParticipant) return false;

  const { combat, combatant } = activeParticipant;
  const action = getSegmentAction(combatant);
  const currentTick = calculateSegmentTick(combat.round, getCombatSegment(combat));
  if (
    !actionConsumesTick(action, currentTick)
    || action.effectCode !== "clearMinorJam"
  ) {
    ui.notifications.warn("Bieżąca akcja nie jest usuwaniem lekkiego zacięcia.");
    return false;
  }

  const configuredDuration = Math.max(
    1,
    Math.min(Number(jamClearingConfiguration.duration) || action.duration, 3)
  );
  await combatant.setFlag(SYSTEM_ID, COMBATANT_ACTION_FLAG, {
    ...action,
    duration: configuredDuration,
    endsAtTick: action.startedAtTick + configuredDuration - 1,
    jamClearingConfiguration
  });
  return true;
}

export async function selectSegmentAction(actor) {
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Akcja: ${actor.name}` },
    content: `
      <div class="form-group">
        <label for="neuroshima-segment-action-code">Akcja</label>
        <select id="neuroshima-segment-action-code" name="actionCode" autofocus>
          ${prepareCombatActionOptions()}
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-segment-action-duration">Koszt własnej akcji</label>
        <select id="neuroshima-segment-action-duration" name="duration">
          <option value="1" selected>1 segment</option>
          <option value="2">2 segmenty</option>
          <option value="3">3 segmenty</option>
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-segment-action-name">Nazwa własnej akcji</label>
        <input id="neuroshima-segment-action-name" type="text" name="customName"
          placeholder="Wypełnij tylko dla opcji Własna akcja">
      </div>
      <p><small>Przy akcjach katalogowych wybór liczby segmentów jest ignorowany.</small></p>
    `,
    ok: {
      label: "Zadeklaruj",
      icon: "fas fa-hourglass-start"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return false;
  const selectedAction = resolveCombatAction(
    String(formData.actionCode),
    formData.customName,
    formData.duration
  );
  if (selectedAction.effectCode === "clearMinorJam") {
    const hasMinorJam = actor.items.some((item) => (
      item.type === "weapon" && item.system.jamState === "minor"
    ));
    if (!hasMinorJam) {
      ui.notifications.warn("Postać nie ma broni z lekkim zacięciem.");
      return false;
    }
    const hasQuickClearingPerk = actor.items.some((item) => (
      item.type === "perk"
      && item.system.sourceCode === "PERK_NOSTRZELAJZLOMIE"
    ));
    if (hasQuickClearingPerk) selectedAction.duration = 1;
  }
  return declareSegmentAction(
    actor,
    selectedAction.name,
    selectedAction.duration,
    selectedAction
  );
}

async function announceSegment(combat) {
  await createCombatMessage(
    `<strong>Runda ${Math.max(1, Number(combat.round) || 1)} — segment ${getCombatSegment(combat)} z ${SEGMENTS_PER_ROUND}</strong>`
  );
}

async function announceCompletedAction(combat) {
  const combatant = combat.combatant;
  let action = getSegmentAction(combatant);
  if (!combatant?.actor || !action || action.duration <= 1) return;

  const currentTick = calculateSegmentTick(combat.round, getCombatSegment(combat));
  if (action.endsAtTick !== currentTick) return;

  if (
    action.effectCode === "rangedShot"
    && action.aimingConfiguration
    && !action.interrupted
    && !action.resolved
  ) {
    const { resolveSingleShot } = await import("./ranged-shot.mjs");
    await resolveSingleShot(combatant.actor);
    action = getSegmentAction(combatant) ?? action;
  }

  if (
    action.effectCode === "clearMinorJam"
    && action.jamClearingConfiguration
    && !action.interrupted
    && !action.resolved
  ) {
    const { resolveMinorJamClearing } = await import("./weapon-jam.mjs");
    await resolveMinorJamClearing(combatant.actor);
    action = getSegmentAction(combatant) ?? action;
  }

  await createCombatMessage(
    `<strong>${escapeForChat(combatant.name)}</strong> kończy akcję „${escapeForChat(action.name)}”. Bieżący segment jest przez nią zajęty.`,
    combatant.actor
  );
}

function currentUnresolvedShot(combat) {
  const combatant = combat.combatant;
  const action = getSegmentAction(combatant);
  const currentTick = calculateSegmentTick(combat.round, getCombatSegment(combat));
  if (
    !combatant?.actor
    || !actionConsumesTick(action, currentTick)
    || action?.effectCode !== "rangedShot"
    || action.endsAtTick !== currentTick
    || action.interrupted
    || action.resolved
  ) {
    return null;
  }
  return { actor: combatant.actor, action };
}

function preventAdvanceForUnresolvedShot(combat) {
  const unresolvedShot = currentUnresolvedShot(combat);
  if (!unresolvedShot) return false;

  ui.notifications.warn(
    `${unresolvedShot.actor.name} musi najpierw rozstrzygnąć zadeklarowany strzał.`
  );
  const actorSheet = unresolvedShot.actor.sheet;
  if (actorSheet?.rendered) actorSheet.render();
  return true;
}

function currentUnresolvedJamClearing(combat) {
  const combatant = combat.combatant;
  const action = getSegmentAction(combatant);
  const currentTick = calculateSegmentTick(combat.round, getCombatSegment(combat));
  if (
    !combatant?.actor
    || !actionConsumesTick(action, currentTick)
    || action?.effectCode !== "clearMinorJam"
    || action.endsAtTick !== currentTick
    || action.interrupted
    || action.resolved
  ) {
    return null;
  }
  return { actor: combatant.actor, action };
}

function preventAdvanceForUnresolvedJamClearing(combat) {
  const unresolvedClearing = currentUnresolvedJamClearing(combat);
  if (!unresolvedClearing) return false;

  ui.notifications.warn(
    `${unresolvedClearing.actor.name} musi dokończyć usuwanie lekkiego zacięcia.`
  );
  const actorSheet = unresolvedClearing.actor.sheet;
  if (actorSheet?.rendered) actorSheet.render();
  return true;
}

export async function startSegmentCombat(combat) {
  if (combat.turns.length === 0) {
    ui.notifications.warn("Nie można rozpocząć walki bez uczestników.");
    return combat;
  }

  const actionResets = combat.combatants.map((combatant) => ({
      _id: combatant.id,
      [`flags.${SYSTEM_ID}.-=${COMBATANT_ACTION_FLAG}`]: null,
      [`flags.${SYSTEM_ID}.-=${AIMING_PREPARATION_FLAG}`]: null,
      [`flags.${SYSTEM_ID}.-=${SKILL_USAGE_FLAG}`]: null
    }));

  if (actionResets.length > 0) {
    await combat.updateEmbeddedDocuments("Combatant", actionResets);
  }

  await combat.setFlag(SYSTEM_ID, COMBAT_SEGMENT_FLAG, 1);
  const startedCombat = await foundry.documents.Combat.prototype.startCombat.call(combat);
  await announceSegment(combat);
  return startedCombat;
}

export async function advanceSegmentTurn(combat) {
  if (!combat.started || combat.turns.length === 0) return combat;
  if (preventAdvanceForUnresolvedShot(combat)) return combat;
  if (preventAdvanceForUnresolvedJamClearing(combat)) return combat;

  const segment = getCombatSegment(combat);
  const isLastParticipant = combat.turn >= combat.turns.length - 1;

  if (!isLastParticipant) {
    const updatedCombat = await foundry.documents.Combat.prototype.nextTurn.call(combat);
    await announceCompletedAction(combat);
    return updatedCombat;
  }

  if (segment < SEGMENTS_PER_ROUND) {
    const updatedCombat = await combat.update({
      turn: 0,
      [`flags.${SYSTEM_ID}.${COMBAT_SEGMENT_FLAG}`]: segment + 1
    });
    await announceSegment(combat);
    await announceCompletedAction(combat);
    return updatedCombat;
  }

  await combat.setFlag(SYSTEM_ID, COMBAT_SEGMENT_FLAG, 1);
  const updatedCombat = await foundry.documents.Combat.prototype.nextRound.call(combat);
  await announceSegment(combat);
  await announceCompletedAction(combat);
  return updatedCombat;
}

export async function rewindSegmentTurn(combat) {
  if (!combat.started || combat.turns.length === 0) return combat;

  const segment = getCombatSegment(combat);

  if (combat.turn > 0) {
    return foundry.documents.Combat.prototype.previousTurn.call(combat);
  }

  if (segment > 1) {
    return combat.update({
      turn: Math.max(0, combat.turns.length - 1),
      [`flags.${SYSTEM_ID}.${COMBAT_SEGMENT_FLAG}`]: segment - 1
    });
  }

  if (combat.round <= 1) return combat;

  return combat.update({
    round: combat.round - 1,
    turn: Math.max(0, combat.turns.length - 1),
    [`flags.${SYSTEM_ID}.${COMBAT_SEGMENT_FLAG}`]: SEGMENTS_PER_ROUND
  });
}

export async function advanceSegmentRound(combat) {
  if (preventAdvanceForUnresolvedShot(combat)) return combat;
  if (preventAdvanceForUnresolvedJamClearing(combat)) return combat;
  await combat.setFlag(SYSTEM_ID, COMBAT_SEGMENT_FLAG, 1);
  const updatedCombat = await foundry.documents.Combat.prototype.nextRound.call(combat);
  await announceSegment(combat);
  await announceCompletedAction(combat);
  return updatedCombat;
}

export async function rewindSegmentRound(combat) {
  await combat.setFlag(SYSTEM_ID, COMBAT_SEGMENT_FLAG, 1);
  return foundry.documents.Combat.prototype.previousRound.call(combat);
}

function rerenderOpenCombatantSheets(combat) {
  for (const combatant of combat.combatants) {
    const actorSheet = combatant.actor?.sheet;
    if (actorSheet?.rendered) actorSheet.render();
  }
}

function renderCombatClock(combatTracker, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const combat = combatTracker.viewed ?? game.combat;
  if (!root || !combat?.started) return;

  root.querySelector("[data-neuroshima-combat-clock]")?.remove();

  const clock = document.createElement("div");
  clock.dataset.neuroshimaCombatClock = "true";
  clock.style.padding = "6px 8px";
  clock.style.textAlign = "center";
  clock.style.fontWeight = "bold";
  clock.style.borderBottom = "1px solid var(--color-border-light-primary)";
  clock.textContent = `Runda ${combat.round} — segment ${getCombatSegment(combat)} z ${SEGMENTS_PER_ROUND}`;

  const combatantList = root.querySelector(".combat-tracker, .directory-list");
  if (combatantList?.parentElement) {
    combatantList.parentElement.insertBefore(clock, combatantList);
  } else {
    root.prepend(clock);
  }
}

export function initializeSegmentCombatInterface() {
  Hooks.on("renderCombatTracker", renderCombatClock);
  Hooks.on("updateCombat", (combat) => rerenderOpenCombatantSheets(combat));
  Hooks.on("updateCombatant", (combatant) => {
    const actorSheet = combatant.actor?.sheet;
    if (actorSheet?.rendered) actorSheet.render();
  });
}
