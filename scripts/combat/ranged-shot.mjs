import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  calculateDifficultyIndexFromPercentage,
  calculateFinalDifficultyIndex,
  calculateWoundPenaltyPercent
} from "../rolls/roll-helpers.mjs";
import {
  calculateSegmentTick,
  configureCurrentAiming,
  getCombatSegment,
  getSegmentAction,
  markCurrentSegmentActionResolved
} from "./segments.mjs";
import { damageNamesBySymbol } from "../catalogs/combat-reference.mjs";
import {
  promptToCreateInjuryFromRoll,
  rollPainResistanceForInjury
} from "../rolls/injury-roll.mjs";
import { getHitLocation, resolveDamage } from "./damage-resolution.mjs";
import {
  applyArmorDurabilityLoss,
  calculateArmorPenaltyPercent,
  selectArmorForHit
} from "./armor.mjs";

const SYSTEM_ID = "neuroshima";
const SKILL_USAGE_FLAG = "combatSkillUsage";

const RANGED_SKILLS = {
  pistolety: "Pistolety",
  karabiny: "Karabiny",
  bronMaszynowa: "Broń maszynowa",
  luk: "Łuk",
  kusza: "Kusza",
  proca: "Proca"
};

export const JAM_STATE_LABELS = {
  ready: "Sprawna",
  minor: "Lekkie zacięcie",
  serious: "Poważne zacięcie",
  critical: "Krytyczne zacięcie"
};

function checkboxIsSelected(value) {
  return value === true || value === "true" || value === "on";
}

function getActorCombatant(actor) {
  return game.combat?.getCombatantsByActor(actor)[0] ?? null;
}

function prepareSkillOptions(actor) {
  return Object.entries(RANGED_SKILLS).map(([skillKey, skillName]) => {
    const skillLevel = Math.max(0, actor.system.skills?.[skillKey]?.value ?? 0);
    return `<option value="${skillKey}">${skillName} (${skillLevel})</option>`;
  }).join("");
}

function prepareWeaponOptions(weapons, selectedWeaponId = "") {
  return weapons.map((weapon) => (
    `<option value="${weapon.id}" ${weapon.id === selectedWeaponId ? "selected" : ""}>${foundry.utils.escapeHTML(weapon.name)} — ${weapon.system.currentAmmunition}/${weapon.system.magazineCapacity}</option>`
  )).join("");
}

function getUsableFirearms(actor) {
  return actor.items.filter((item) => (
    item.type === "weapon"
    && item.system.weaponClass !== "LAUNCHER"
    && item.system.weaponClass !== "PROJECTILE"
    && item.system.currentAmmunition > 0
    && item.system.jamState === "ready"
  ));
}

function getCurrentSkillUsage(combatant, round) {
  const storedUsage = combatant.getFlag(SYSTEM_ID, SKILL_USAGE_FLAG);
  if (!storedUsage || storedUsage.round !== round) {
    return { round, spentBySkill: {} };
  }

  return {
    round,
    spentBySkill: { ...storedUsage.spentBySkill }
  };
}

function getUsedSkillKeys(skillUsage) {
  return Object.entries(skillUsage.spentBySkill)
    .filter(([, spentPoints]) => spentPoints > 0)
    .map(([skillKey]) => skillKey);
}

export function calculateAvailableCombatSkillPoints(actor, skillUsage, selectedSkillKey) {
  const usedSkillKeys = getUsedSkillKeys(skillUsage);
  const skillKeysAfterSelection = usedSkillKeys.includes(selectedSkillKey)
    ? usedSkillKeys
    : [...usedSkillKeys, selectedSkillKey];
  const divisor = Math.max(1, skillKeysAfterSelection.length);

  // Wprowadzenie drugiej albo trzeciej Umiejętności obniża limit również dla
  // wcześniej używanych pul. Nie pozwalamy zrobić tego po wydaniu zbyt wielu
  // punktów, ponieważ wcześniejszych wyników kości nie można już cofnąć.
  for (const skillKey of usedSkillKeys) {
    const skillLevel = Math.max(0, actor.system.skills?.[skillKey]?.value ?? 0);
    const revisedLimit = Math.floor(skillLevel / divisor);
    if ((skillUsage.spentBySkill[skillKey] ?? 0) > revisedLimit) {
      return {
        availablePoints: 0,
        divisor,
        blockedByPreviousSpending: true
      };
    }
  }

  const selectedSkillLevel = Math.max(
    0,
    actor.system.skills?.[selectedSkillKey]?.value ?? 0
  );
  const selectedSkillLimit = Math.floor(selectedSkillLevel / divisor);
  const alreadySpent = skillUsage.spentBySkill[selectedSkillKey] ?? 0;

  return {
    availablePoints: Math.max(0, selectedSkillLimit - alreadySpent),
    divisor,
    blockedByPreviousSpending: false
  };
}

export function calculateSingleShotResult({
  dexterity,
  naturalResult,
  difficultyPercentage,
  skillLevel,
  spentSkillPoints,
  reliabilityThreshold
}) {
  const rangedResult = calculateRangedShotResult({
    dexterity,
    naturalResults: [naturalResult],
    difficultyPercentage,
    skillLevel,
    spentSkillPointsByDie: [spentSkillPoints],
    reliabilityThreshold
  });
  const [evaluatedDie] = rangedResult.evaluatedDice;

  return {
    ...rangedResult,
    adjustedResult: evaluatedDie.adjustedResult,
    automaticFailure: evaluatedDie.automaticFailure
  };
}

export function calculateRangedShotResult({
  dexterity,
  naturalResults,
  difficultyPercentage,
  skillLevel,
  spentSkillPointsByDie,
  reliabilityThreshold
}) {
  const difficultyAfterPercentage = calculateDifficultyIndexFromPercentage(
    difficultyPercentage
  );
  const difficultyBeforeNaturalResult = skillLevel > 0
    ? difficultyAfterPercentage
    : Math.min(difficultyAfterPercentage + 1, DIFFICULTY_LABELS.length - 1);
  const finalDifficultyIndex = calculateFinalDifficultyIndex(
    naturalResults,
    difficultyBeforeNaturalResult
  );
  const successThreshold = dexterity - DIFFICULTY_MODIFIERS[finalDifficultyIndex];
  const evaluatedDice = naturalResults.map((naturalResult, dieIndex) => {
    const spentSkillPoints = Math.max(0, spentSkillPointsByDie[dieIndex] ?? 0);
    const adjustedResult = naturalResult - spentSkillPoints;
    const automaticFailure = naturalResult === 20;
    const succeeded = !automaticFailure && adjustedResult <= successThreshold;
    return {
      naturalResult,
      adjustedResult,
      spentSkillPoints,
      automaticFailure,
      succeeded,
      pointsDifference: successThreshold - adjustedResult
    };
  });
  const successfulDice = evaluatedDice.filter((die) => die.succeeded);
  const ordinaryFailedDice = evaluatedDice.filter(
    (die) => !die.succeeded && !die.automaticFailure
  );
  const testPassed = successfulDice.length > 0;
  const pointsDifference = testPassed
    ? Math.max(...successfulDice.map((die) => die.pointsDifference))
    : ordinaryFailedDice.length > 0
      ? Math.max(...ordinaryFailedDice.map((die) => die.pointsDifference))
      : 0;

  return {
    evaluatedDice,
    testPassed,
    pointsDifference,
    successThreshold,
    finalDifficultyIndex,
    requiresJamRoll: naturalResults.some(
      (naturalResult) => naturalResult > reliabilityThreshold
    )
  };
}

export function classifyJamSeverity(jamRollResult) {
  if (jamRollResult <= 10) return "minor";
  if (jamRollResult <= 18) return "serious";
  return "critical";
}

async function selectShotConfiguration(actor, target, shotPreparation) {
  const weapon = actor.items.get(String(shotPreparation?.weaponId ?? ""));
  if (!weapon || !getUsableFirearms(actor).includes(weapon)) {
    ui.notifications.warn("Wybrana broń nie jest już sprawna albo nie ma amunicji.");
    return null;
  }

  const woundPenalty = calculateWoundPenaltyPercent(actor);
  const armorPenalty = calculateArmorPenaltyPercent(actor, "zrecznosc");
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Strzał: ${actor.name} → ${target.name}` },
    content: `
      <p>
        Broń: <strong>${foundry.utils.escapeHTML(weapon.name)}</strong><br>
        Cel: <strong>${foundry.utils.escapeHTML(target.name)}</strong>
      </p>
      <div class="form-group">
        <label for="neuroshima-shot-skill">Umiejętność</label>
        <select id="neuroshima-shot-skill" name="skillKey">
          ${prepareSkillOptions(actor)}
        </select>
      </div>
      <hr>
      <div class="form-group">
        <label><input type="checkbox" name="includeWounds" checked> Uwzględnij rany (${woundPenalty}%)</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" name="includeArmor" checked> Uwzględnij pancerz (${armorPenalty}%)</label>
      </div>
      <div class="form-group">
        <label for="neuroshima-shot-modifier">Odległość, ruch, osłona i inne warunki</label>
        <input id="neuroshima-shot-modifier" type="number" name="customModifier" value="0" step="1"> %
      </div>
    `,
    ok: {
      label: "Rzuć",
      icon: "fas fa-crosshairs"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return null;

  return {
    weapon,
    skillKey: String(formData.skillKey),
    woundPenalty: checkboxIsSelected(formData.includeWounds) ? woundPenalty : 0,
    armorPenalty: checkboxIsSelected(formData.includeArmor) ? armorPenalty : 0,
    customModifier: Number(formData.customModifier) || 0
  };
}

async function selectSpentSkillPoints(actor, skillName, availablePoints, naturalResults) {
  if (availablePoints <= 0 || naturalResults.every((result) => result === 20)) {
    return naturalResults.map(() => 0);
  }

  const dieInputs = naturalResults.map((naturalResult, dieIndex) => {
    const disabled = naturalResult === 20 ? "disabled" : "";
    return `
      <div class="form-group">
        <label for="neuroshima-shot-skill-points-${dieIndex}">Kość ${dieIndex + 1}: ${naturalResult}</label>
        <input id="neuroshima-shot-skill-points-${dieIndex}" type="number"
          name="die${dieIndex}Points" value="0" min="0" max="${availablePoints}" step="1" ${disabled}>
      </div>
    `;
  }).join("");

  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Umiejętność: ${skillName}` },
    content: `
      <p>Naturalne wyniki strzału: <strong>${naturalResults.join(", ")}</strong></p>
      <p>Dostępne punkty Umiejętności w tej rundzie: <strong>${availablePoints}</strong></p>
      <p>Rozdziel maksymalnie tę pulę pomiędzy kości. Naturalnej 20 nie można poprawić.</p>
      ${dieInputs}
    `,
    ok: { label: "Zastosuj" },
    rejectClose: false,
    modal: true
  });

  if (!formData) return naturalResults.map(() => 0);

  let remainingPoints = availablePoints;
  return naturalResults.map((naturalResult, dieIndex) => {
    if (naturalResult === 20) return 0;
    const requestedPoints = Math.max(0, Number(formData[`die${dieIndex}Points`]) || 0);
    const assignedPoints = Math.min(requestedPoints, remainingPoints);
    remainingPoints -= assignedPoints;
    return assignedPoints;
  });
}

export async function configureAiming(actor) {
  const combatant = getActorCombatant(actor);
  const action = getSegmentAction(combatant);
  if (!combatant || game.combat?.combatant?.id !== combatant.id) {
    ui.notifications.warn("Strzał może przygotować tylko aktualnie działająca postać.");
    return false;
  }
  if (action?.effectCode !== "rangedShot" || action.aimingConfiguration) {
    ui.notifications.warn("Bieżąca akcja nie oczekuje wyboru broni i celu.");
    return false;
  }

  const targets = [...game.user.targets];
  if (targets.length !== 1) {
    ui.notifications.warn("Wskaż dokładnie jeden token jako cel strzału.");
    return false;
  }

  const weapons = getUsableFirearms(actor);
  if (weapons.length === 0) {
    ui.notifications.warn("Postać nie ma sprawnej, załadowanej broni palnej.");
    return false;
  }

  const target = targets[0];
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Przygotowanie strzału: ${actor.name} → ${target.name}` },
    content: `
      <div class="form-group">
        <label for="neuroshima-aiming-weapon">Broń</label>
        <select id="neuroshima-aiming-weapon" name="weaponId">
          ${prepareWeaponOptions(weapons)}
        </select>
      </div>
      <p>
        Czas akcji: <strong>${action.duration} ${action.duration === 1 ? "segment" : "segmenty"}</strong><br>
        Rzut po zakończeniu: <strong>${1 + action.aimingBonusDice}k20</strong>
      </p>
    `,
    ok: { label: "Zapisz broń i cel", icon: "fas fa-crosshairs" },
    rejectClose: false,
    modal: true
  });
  if (!formData) return false;

  const weapon = actor.items.get(String(formData.weaponId));
  if (!weapon || !weapons.includes(weapon)) return false;

  return configureCurrentAiming(actor, {
    weaponId: weapon.id,
    weaponName: weapon.name,
    targetTokenId: target.id,
    targetName: target.name
  });
}

async function rollJamSeverity(actor, weapon) {
  const jamRoll = await new foundry.dice.Roll("1d20").evaluate();
  const jamRollResult = jamRoll.dice[0].results[0].result;
  const jamState = classifyJamSeverity(jamRollResult);

  await weapon.update({
    "system.jamState": jamState,
    "system.jamSeverityRoll": jamRollResult
  });
  return { jamState, jamRollResult, jamRoll };
}

async function selectHitDie(evaluatedDice) {
  const successfulDice = evaluatedDice
    .map((die, dieIndex) => ({ ...die, dieIndex }))
    .filter((die) => die.succeeded);
  if (successfulDice.length <= 1) return successfulDice[0] ?? null;

  const defaultDie = successfulDice.reduce((bestDie, die) => (
    die.pointsDifference > bestDie.pointsDifference ? die : bestDie
  ));
  const options = successfulDice.map((die) => (
    `<option value="${die.dieIndex}" ${die.dieIndex === defaultDie.dieIndex ? "selected" : ""}>Kość ${die.dieIndex + 1}: naturalne ${die.naturalResult}, PS ${die.pointsDifference}</option>`
  )).join("");
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: "Wybierz kość trafienia" },
    content: `
      <p>Więcej niż jedna kość trafiła. Wybierz kość, której naturalny wynik określi lokację.</p>
      <div class="form-group">
        <label for="neuroshima-hit-die">Kość trafienia</label>
        <select id="neuroshima-hit-die" name="dieIndex">${options}</select>
      </div>
    `,
    ok: { label: "Wybierz" },
    rejectClose: false,
    modal: true
  });
  if (!formData) return defaultDie;
  return successfulDice.find(
    (die) => die.dieIndex === Number(formData.dieIndex)
  ) ?? defaultDie;
}

async function publishDamageResolution(
  shooter,
  target,
  weapon,
  hitDie,
  damageResult,
  armorSelection,
  appliedDurabilityLoss
) {
  const baseDamageName = damageNamesBySymbol[damageResult.baseDamageCode]
    ?? damageResult.baseDamageCode;
  const finalDamageDescription = damageResult.prevented
    ? "<strong>Pancerz zatrzymał obrażenia — brak rany.</strong>"
    : `<strong>Końcowy skutek: ${foundry.utils.escapeHTML(damageResult.finalDamageName)}</strong>`;
  const armorName = armorSelection?.covered
    ? foundry.utils.escapeHTML(armorSelection.item.name)
    : "brak ochrony";
  const coverageDescription = armorSelection?.coverageRoll !== null
    && armorSelection?.coverageRoll !== undefined
    ? `Test osłony pancerza: k20 = ${armorSelection.coverageRoll} — ${armorSelection.covered ? "chroni" : "nie chroni"}`
    : null;
  const armorDurabilityDescription = damageResult.armorReduction > 0
    && damageResult.armorDurabilityLoss > 0
    ? `Wytrzymałość pancerza: −${appliedDurabilityLoss}${appliedDurabilityLoss < damageResult.armorDurabilityLoss ? " (pełne zużycie elementu)" : ""}`
    : "Wytrzymałość pancerza: bez zmiany";

  await foundry.documents.ChatMessage.create({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor: shooter }),
    content: [
      `<strong>Skutek trafienia: ${foundry.utils.escapeHTML(target.name)}</strong>`,
      `Kość trafienia: ${hitDie.naturalResult}`,
      `Lokacja: <strong>${damageResult.locationLabel}</strong>`,
      `Obrażenia broni: ${foundry.utils.escapeHTML(baseDamageName)}`,
      damageResult.headBonus ? "Trafienie w głowę: obrażenia zwiększone o 1 poziom" : null,
      `Pancerz: ${armorName}`,
      coverageDescription,
      `Redukcja pancerza: ${damageResult.armorReduction}`,
      `Przebicie Pancerza: ${damageResult.armorPenetration}`,
      `Skuteczna Redukcja: ${damageResult.effectiveArmorReduction}`,
      armorDurabilityDescription,
      finalDamageDescription,
      damageResult.locationDescription
        ? `Skutek dla lokacji: ${foundry.utils.escapeHTML(damageResult.locationDescription)}`
        : null
    ].filter(Boolean).join("<br>")
  });
}

async function resolveHitConsequences(shooter, target, weapon, shotResult) {
  const hitDie = await selectHitDie(shotResult.evaluatedDice);
  if (!hitDie) return;
  const location = getHitLocation(hitDie.naturalResult);
  const targetActor = target.actor;
  const armorSelection = targetActor && location
    ? await selectArmorForHit(targetActor, location, "ballistic")
    : null;
  const armorReduction = armorSelection?.covered ? armorSelection.reduction : 0;
  const damageResult = resolveDamage({
    damageCode: weapon.system.damageCode,
    naturalResult: hitDie.naturalResult,
    armorReduction,
    armorPenetration: weapon.system.armorPenetration
  });
  if (!damageResult) {
    ui.notifications.error("Nie można rozpatrzyć obrażeń: broń ma nieprawidłowy kod obrażeń.");
    return;
  }

  const appliedDurabilityLoss = targetActor?.isOwner
    ? await applyArmorDurabilityLoss(
      armorSelection,
      damageResult.location,
      damageResult.armorDurabilityLoss
    )
    : 0;
  await publishDamageResolution(
    shooter,
    target,
    weapon,
    hitDie,
    damageResult,
    armorSelection,
    appliedDurabilityLoss
  );
  if (damageResult.prevented) return;

  if (!targetActor || targetActor.type !== "character") {
    ui.notifications.warn("Cel nie jest Aktorem postaci — ranę rozpatrzono tylko w czacie.");
    return;
  }
  if (!targetActor.isOwner) {
    ui.notifications.warn("Nie masz uprawnień do wykonania testu ani dodania rany temu Aktorowi.");
    return;
  }

  const injuryResult = await rollPainResistanceForInjury(
    targetActor,
    damageResult.injuryType
  );
  if (!injuryResult) return;
  await promptToCreateInjuryFromRoll(targetActor, injuryResult, {
    location: damageResult.location,
    defaultName: damageResult.finalDamageName,
    additionalDescription: damageResult.locationDescription
  });
}

export async function resolveSingleShot(actor) {
  const combatant = getActorCombatant(actor);
  const action = getSegmentAction(combatant);
  if (!combatant || game.combat?.combatant?.id !== combatant.id) {
    ui.notifications.warn("Strzał może rozstrzygnąć tylko aktualnie działająca postać.");
    return false;
  }
  const currentTick = calculateSegmentTick(
    game.combat?.round,
    getCombatSegment(game.combat)
  );
  if (
    action?.effectCode !== "rangedShot"
    || action.resolved
    || action.interrupted
    || action.endsAtTick !== currentTick
  ) {
    ui.notifications.warn("Bieżąca akcja nie jest nierozstrzygniętym strzałem.");
    return false;
  }

  const shotPreparation = action.aimingConfiguration;
  if (!shotPreparation) {
    ui.notifications.warn("Najpierw wybierz broń i cel strzału.");
    return false;
  }
  const target = canvas.tokens?.get(shotPreparation.targetTokenId) ?? null;
  if (!target) {
    ui.notifications.warn("Wybrany cel nie jest już dostępny na tej scenie.");
    return false;
  }
  const configuration = await selectShotConfiguration(
    actor,
    target,
    shotPreparation
  );
  if (!configuration) return false;

  const { weapon, skillKey } = configuration;
  const aimingBonusDice = Math.max(0, Math.min(action.aimingBonusDice, 2));
  const numberOfDice = 1 + aimingBonusDice;
  const skillLevel = Math.max(0, actor.system.skills?.[skillKey]?.value ?? 0);
  const skillUsage = getCurrentSkillUsage(combatant, game.combat.round);
  const skillAvailability = calculateAvailableCombatSkillPoints(
    actor,
    skillUsage,
    skillKey
  );
  if (skillAvailability.blockedByPreviousSpending) {
    ui.notifications.warn(
      "Nie można użyć kolejnej Umiejętności w tej rundzie: wcześniej wydano więcej punktów, niż pozwala nowy podział puli."
    );
  }

  const shotRoll = await new foundry.dice.Roll(`${numberOfDice}d20`).evaluate();
  const naturalResults = shotRoll.dice[0].results.map((die) => die.result);
  const spentSkillPointsByDie = await selectSpentSkillPoints(
    actor,
    RANGED_SKILLS[skillKey],
    skillAvailability.availablePoints,
    naturalResults
  );
  const totalSpentSkillPoints = spentSkillPointsByDie.reduce(
    (sum, spentPoints) => sum + spentPoints,
    0
  );

  const totalDifficultyPercentage = configuration.woundPenalty
    + configuration.armorPenalty
    + configuration.customModifier
    + weapon.system.accuracyModifier;
  const result = calculateRangedShotResult({
    dexterity: actor.system.attributes.zrecznosc.value,
    naturalResults,
    difficultyPercentage: totalDifficultyPercentage,
    skillLevel,
    spentSkillPointsByDie,
    reliabilityThreshold: weapon.system.misfireRoll
  });
  const ammunitionAfterSuccessfulDischarge = Math.max(
    0,
    weapon.system.currentAmmunition - 1
  );

  const updatedSkillUsage = {
    round: game.combat.round,
    spentBySkill: {
      ...skillUsage.spentBySkill,
      [skillKey]: (skillUsage.spentBySkill[skillKey] ?? 0) + totalSpentSkillPoints
    }
  };
  await combatant.setFlag(SYSTEM_ID, SKILL_USAGE_FLAG, updatedSkillUsage);

  let jamResult = null;
  if (result.requiresJamRoll) {
    jamResult = await rollJamSeverity(actor, weapon);
  } else {
    // Nabój odejmujemy wyłącznie wtedy, gdy broń rzeczywiście wystrzeliła.
    await weapon.update({
      "system.currentAmmunition": ammunitionAfterSuccessfulDischarge
    });
  }

  const allDiceAreAutomaticFailures = result.evaluatedDice.every(
    (die) => die.automaticFailure
  );
  const pointsLabel = result.testPassed
    ? `Punkty Sukcesu: ${Math.max(0, result.pointsDifference)}`
    : allDiceAreAutomaticFailures
      ? "Automatyczna porażka wszystkich kości"
      : `Punkty Porażki: ${Math.abs(Math.min(0, result.pointsDifference))}`;
  const shotDischarged = !jamResult;
  const resolution = jamResult
    ? "Zacięcie — broń nie wystrzeliła"
    : result.testPassed ? "Trafienie" : "Pudło";
  const diceDescription = result.evaluatedDice.map((die, dieIndex) => {
    const adjustedDescription = die.spentSkillPoints > 0
      ? `${die.naturalResult} → ${die.adjustedResult}`
      : String(die.naturalResult);
    const verdict = die.automaticFailure
      ? "pechowa 20"
      : die.succeeded ? "sukces" : "porażka";
    return `k${dieIndex + 1}: ${adjustedDescription} (${verdict})`;
  }).join(", ");
  const riskyNaturalResults = naturalResults.filter(
    (naturalResult) => naturalResult > weapon.system.misfireRoll
  );
  await shotRoll.toMessage({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: [
      `<strong>Strzał: ${foundry.utils.escapeHTML(actor.name)} → ${foundry.utils.escapeHTML(target.name)}</strong>`,
      `Broń: ${foundry.utils.escapeHTML(weapon.name)}`,
      `Celowanie: ${aimingBonusDice > 0 ? `+${aimingBonusDice}k20` : "brak"}`,
      `Umiejętność: ${RANGED_SKILLS[skillKey]} (${skillLevel}), użyto ${totalSpentSkillPoints}`,
      `Kary i modyfikatory: ${totalDifficultyPercentage}%`,
      `Ostateczny PT: ${DIFFICULTY_LABELS[result.finalDifficultyIndex]}`,
      `Próg sukcesu: ${result.successThreshold}`,
      `Kości: ${diceDescription}`,
      pointsLabel,
      result.requiresJamRoll
        ? `Niezawodność: ${riskyNaturalResults.join(", ")} > ${weapon.system.misfireRoll}`
        : `Niezawodność: wszystkie kości ≤ ${weapon.system.misfireRoll}`,
      result.requiresJamRoll
        ? "Amunicja: nie odjęto naboju — broń nie wystrzeliła"
        : `Amunicja: pozostało ${ammunitionAfterSuccessfulDischarge}`,
      jamResult ? `Stan broni: ${JAM_STATE_LABELS[jamResult.jamState]}` : "Stan broni: sprawna",
      jamResult ? "Pocisk nie opuścił broni — wynik trafienia nie zadaje obrażeń." : null,
      `<strong>${resolution}</strong>`
    ].filter(Boolean).join("<br>")
  });

  if (jamResult) {
    await jamResult.jamRoll.toMessage({
      speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
      flavor: [
        `<strong>Zacięcie: ${foundry.utils.escapeHTML(weapon.name)}</strong>`,
        `Wynik: ${jamResult.jamRollResult}`,
        `<strong>${JAM_STATE_LABELS[jamResult.jamState]}</strong>`
      ].join("<br>")
    });
  }

  if (shotDischarged && result.testPassed) {
    await resolveHitConsequences(actor, target, weapon, result);
  }

  await markCurrentSegmentActionResolved(actor, resolution);
  return true;
}
