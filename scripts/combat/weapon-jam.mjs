import { rollSkill } from "../rolls/skill-roll.mjs";
import {
  calculateSegmentTick,
  configureCurrentJamClearing,
  declareSegmentAction,
  getCombatSegment,
  getSegmentAction,
  markCurrentSegmentActionResolved
} from "./segments.mjs";

const JAM_LABELS = {
  minor: "Lekkie zacięcie",
  serious: "Poważne zacięcie",
  critical: "Krytyczne zacięcie"
};

const JAM_PERKS = {
  quickMinorRepair: "PERK_NOSTRZELAJZLOMIE",
  salvageCriticalJam: "PERK_SZTUKAJESTSZTUKA"
};

function actorHasPerk(actor, sourceCode) {
  return actor.items.some((item) => (
    item.type === "perk" && item.system.sourceCode === sourceCode
  ));
}

function getMinorJamClearingDuration(actor) {
  return actorHasPerk(actor, JAM_PERKS.quickMinorRepair) ? 1 : 3;
}

function getActorCombatant(actor) {
  return game.combat?.getCombatantsByActor(actor)[0] ?? null;
}

function combatIsActive() {
  return Boolean(game.combat?.started);
}

async function publishJamMessage(actor, lines) {
  await foundry.documents.ChatMessage.create({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    content: lines.join("<br>")
  });
}

async function clearWeaponJam(actor, weapon, description) {
  await weapon.update({
    "system.jamState": "ready",
    "system.jamSeverityRoll": 0
  });
  await publishJamMessage(actor, [
    `<strong>${foundry.utils.escapeHTML(weapon.name)}: broń ponownie sprawna</strong>`,
    description
  ]);
  ui.notifications.info(`${weapon.name}: usunięto zacięcie.`);
  return true;
}

export async function configureMinorJamClearing(actor) {
  const combatant = getActorCombatant(actor);
  const action = getSegmentAction(combatant);
  if (
    !combatant
    || game.combat?.combatant?.id !== combatant.id
    || action?.effectCode !== "clearMinorJam"
    || action.jamClearingConfiguration
  ) {
    ui.notifications.warn("Bieżąca akcja nie oczekuje wyboru zaciętej broni.");
    return false;
  }

  const weapons = actor.items.filter((item) => (
    item.type === "weapon" && item.system.jamState === "minor"
  ));
  if (weapons.length === 0) {
    ui.notifications.warn("Postać nie ma broni z lekkim zacięciem.");
    return false;
  }

  const clearingDuration = getMinorJamClearingDuration(actor);
  const options = weapons.map((weapon) => (
    `<option value="${weapon.id}">${foundry.utils.escapeHTML(weapon.name)}</option>`
  )).join("");
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: "Usuwanie lekkiego zacięcia" },
    content: `
      <div class="form-group">
        <label for="neuroshima-clear-jam-weapon">Broń</label>
        <select id="neuroshima-clear-jam-weapon" name="weaponId">${options}</select>
      </div>
      <p>Usunięcie lekkiego zacięcia zajmie <strong>${clearingDuration} ${clearingDuration === 1 ? "segment" : "segmenty"}</strong>.</p>
    `,
    ok: { label: "Rozpocznij", icon: "fas fa-screwdriver-wrench" },
    rejectClose: false,
    modal: true
  });
  if (!formData) return false;

  const weapon = actor.items.get(String(formData.weaponId));
  if (!weapon || weapon.system.jamState !== "minor") return false;
  return configureCurrentJamClearing(actor, {
    weaponId: weapon.id,
    weaponName: weapon.name,
    duration: clearingDuration
  });
}

export async function resolveMinorJamClearing(actor) {
  const combatant = getActorCombatant(actor);
  const action = getSegmentAction(combatant);
  const currentTick = calculateSegmentTick(
    game.combat?.round,
    getCombatSegment(game.combat)
  );
  if (
    !combatant
    || game.combat?.combatant?.id !== combatant.id
    || action?.effectCode !== "clearMinorJam"
    || action.resolved
    || action.interrupted
    || action.endsAtTick !== currentTick
  ) {
    return false;
  }

  const weapon = actor.items.get(action.jamClearingConfiguration?.weaponId);
  if (!weapon || weapon.type !== "weapon") {
    ui.notifications.warn("Nie znaleziono broni wybranej do usunięcia zacięcia.");
    return false;
  }
  if (weapon.system.jamState !== "minor") {
    await markCurrentSegmentActionResolved(actor, "Broń nie ma już lekkiego zacięcia");
    return true;
  }

  await clearWeaponJam(
    actor,
    weapon,
    action.duration === 1
      ? "Lekkie zacięcie usunięto w 1 segmencie dzięki Sztuczce „No strzelaj, złomie!”."
      : "Lekkie zacięcie usunięto po wykorzystaniu całej tury (3 segmentów)."
  );
  await markCurrentSegmentActionResolved(actor, "Usunięto lekkie zacięcie");
  return true;
}

export async function handleWeaponJam(actor, weapon) {
  if (!weapon || weapon.type !== "weapon") {
    ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
    return false;
  }

  const jamState = weapon.system.jamState;
  if (jamState === "ready") {
    ui.notifications.info(`${weapon.name}: broń jest sprawna.`);
    return false;
  }

  if (jamState === "minor") {
    if (!combatIsActive()) {
      return clearWeaponJam(actor, weapon, "Lekkie zacięcie usunięto poza walką.");
    }
    const clearingDuration = getMinorJamClearingDuration(actor);
    const declared = await declareSegmentAction(
      actor,
      `Usuwanie zacięcia: ${weapon.name}`,
      clearingDuration,
      {
        actionCode: "clearMinorJam",
        effectCode: "clearMinorJam",
        requiresTest: false
      }
    );
    if (!declared) return false;
    return configureCurrentJamClearing(actor, {
      weaponId: weapon.id,
      weaponName: weapon.name,
      duration: clearingDuration
    });
  }

  if (combatIsActive()) {
    ui.notifications.warn(
      `${JAM_LABELS[jamState]} można naprawić dopiero po zakończeniu walki.`
    );
    return false;
  }

  if (jamState === "serious") {
    return clearWeaponJam(
      actor,
      weapon,
      "Poważne zacięcie naprawiono po walce; test Rusznikarstwa nie był wymagany."
    );
  }

  if (actorHasPerk(actor, JAM_PERKS.salvageCriticalJam)) {
    return clearWeaponJam(
      actor,
      weapon,
      "Sztuczka „Sztuka jest sztuka”: broń doprowadzono do używalności po kilku godzinach pracy."
    );
  }

  const repairResult = await rollSkill(actor, "rusznikarstwo", {
    fixedTestType: "closed",
    configurationTitle: `Naprawa krytycznego zacięcia: ${weapon.name}`,
    testTitle: `Naprawa krytycznego zacięcia — ${foundry.utils.escapeHTML(weapon.name)}`
  });
  if (!repairResult) return false;
  if (!repairResult.testPassed) {
    await publishJamMessage(actor, [
      `<strong>${foundry.utils.escapeHTML(weapon.name)}: naprawa nieudana</strong>`,
      "Krytyczne zacięcie pozostaje."
    ]);
    return false;
  }

  return clearWeaponJam(
    actor,
    weapon,
    "Krytyczne zacięcie usunięto po zdanym teście Rusznikarstwa."
  );
}
