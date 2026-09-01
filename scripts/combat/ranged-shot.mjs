import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  calculateDifficultyIndexFromPercentage,
  calculateFinalDifficultyIndex,
  calculateWoundPenaltyPercent
} from "../rolls/roll-helpers.mjs";
import {
  configureCurrentAiming,
  consumeAimingPreparation,
  getAimingPreparation,
  getSegmentAction,
  markCurrentSegmentActionResolved
} from "./segments.mjs";

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

async function selectShotConfiguration(actor, target, aimingPreparation) {
  const weapons = getUsableFirearms(actor);

  if (weapons.length === 0) {
    ui.notifications.warn("Postać nie ma sprawnej, załadowanej broni palnej.");
    return null;
  }

  const woundPenalty = calculateWoundPenaltyPercent(actor);
  const armorPenalty = actor.system.testPenalties?.armorPercent ?? 0;
  const aimingDescription = aimingPreparation
    ? `<p>Przygotowane celowanie: <strong>${foundry.utils.escapeHTML(aimingPreparation.weaponName)}</strong> → <strong>${foundry.utils.escapeHTML(aimingPreparation.targetName)}</strong> (+${aimingPreparation.bonusDice}k20). Premia działa tylko dla tej broni i celu.</p>`
    : "";
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Strzał: ${actor.name} → ${target.name}` },
    content: `
      <div class="form-group">
        <label for="neuroshima-shot-weapon">Broń</label>
        <select id="neuroshima-shot-weapon" name="weaponId">
          ${prepareWeaponOptions(weapons, aimingPreparation?.weaponId)}
        </select>
      </div>
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
      ${aimingDescription}
    `,
    ok: {
      label: "Rzuć",
      icon: "fas fa-crosshairs"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return null;
  const weapon = actor.items.get(String(formData.weaponId));
  if (!weapon || weapon.type !== "weapon") return null;

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
    ui.notifications.warn("Celowanie może ustawić tylko aktualnie działająca postać.");
    return false;
  }
  if (action?.effectCode !== "aiming" || action.aimingConfiguration) {
    ui.notifications.warn("Bieżąca akcja nie oczekuje ustawienia celowania.");
    return false;
  }

  const targets = [...game.user.targets];
  if (targets.length !== 1) {
    ui.notifications.warn("Wskaż dokładnie jeden token jako cel celowania.");
    return false;
  }

  const weapons = getUsableFirearms(actor);
  if (weapons.length === 0) {
    ui.notifications.warn("Postać nie ma sprawnej, załadowanej broni palnej.");
    return false;
  }

  const target = targets[0];
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Celowanie: ${actor.name} → ${target.name}` },
    content: `
      <div class="form-group">
        <label for="neuroshima-aiming-weapon">Broń</label>
        <select id="neuroshima-aiming-weapon" name="weaponId">
          ${prepareWeaponOptions(weapons)}
        </select>
      </div>
      <p>Premia po zakończeniu: <strong>+${action.aimingBonusDice}k20</strong>.</p>
    `,
    ok: { label: "Rozpocznij celowanie", icon: "fas fa-crosshairs" },
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

export async function resolveSingleShot(actor) {
  const combatant = getActorCombatant(actor);
  const action = getSegmentAction(combatant);
  if (!combatant || game.combat?.combatant?.id !== combatant.id) {
    ui.notifications.warn("Strzał może rozstrzygnąć tylko aktualnie działająca postać.");
    return false;
  }
  if (action?.actionCode !== "shot" || action.resolved) {
    ui.notifications.warn("Bieżąca akcja nie jest nierozstrzygniętym strzałem.");
    return false;
  }

  const targets = [...game.user.targets];
  if (targets.length !== 1) {
    ui.notifications.warn("Wskaż dokładnie jeden token jako cel strzału.");
    return false;
  }

  const target = targets[0];
  const aimingPreparation = getAimingPreparation(combatant);
  const configuration = await selectShotConfiguration(
    actor,
    target,
    aimingPreparation
  );
  if (!configuration) return false;

  const { weapon, skillKey } = configuration;
  const usesPreparedAiming = Boolean(
    aimingPreparation
    && aimingPreparation.weaponId === weapon.id
    && aimingPreparation.targetTokenId === target.id
  );
  const aimingBonusDice = usesPreparedAiming
    ? Math.max(0, Math.min(aimingPreparation.bonusDice, 2))
    : 0;
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
    // Przy zacięciu podręcznik nie rozstrzyga jednoznacznie, czy nabój został
    // zużyty. W takim przypadku stan magazynka pozostawiamy bez zmian, a
    // ewentualne ręczne odjęcie naboju jest decyzją MG.
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
  const resolution = result.testPassed ? "Trafienie" : "Pudło";
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
      `Celowanie: ${usesPreparedAiming ? `+${aimingBonusDice}k20` : "brak"}`,
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
        ? "Amunicja: nie odjęto naboju — decyzja MG"
        : `Amunicja: pozostało ${ammunitionAfterSuccessfulDischarge}`,
      jamResult ? `Stan broni: ${JAM_STATE_LABELS[jamResult.jamState]}` : "Stan broni: sprawna",
      `<strong>${resolution}</strong>`
    ].join("<br>")
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

  await consumeAimingPreparation(combatant);
  await markCurrentSegmentActionResolved(actor, resolution);
  return true;
}
