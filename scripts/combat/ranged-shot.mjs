import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  calculateDifficultyIndexFromPercentage,
  calculateFinalDifficultyIndex,
  calculateWoundPenaltyPercent
} from "../rolls/roll-helpers.mjs";
import {
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

function prepareWeaponOptions(weapons) {
  return weapons.map((weapon) => (
    `<option value="${weapon.id}">${foundry.utils.escapeHTML(weapon.name)} — ${weapon.system.currentAmmunition}/${weapon.system.magazineCapacity}</option>`
  )).join("");
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
  const difficultyAfterPercentage = calculateDifficultyIndexFromPercentage(
    difficultyPercentage
  );
  const difficultyBeforeNaturalResult = skillLevel > 0
    ? difficultyAfterPercentage
    : Math.min(difficultyAfterPercentage + 1, DIFFICULTY_LABELS.length - 1);
  const finalDifficultyIndex = calculateFinalDifficultyIndex(
    [naturalResult],
    difficultyBeforeNaturalResult
  );
  const successThreshold = dexterity - DIFFICULTY_MODIFIERS[finalDifficultyIndex];
  const adjustedResult = naturalResult - spentSkillPoints;
  const automaticFailure = naturalResult === 20;
  const testPassed = !automaticFailure && adjustedResult <= successThreshold;

  return {
    adjustedResult,
    automaticFailure,
    testPassed,
    pointsDifference: successThreshold - adjustedResult,
    successThreshold,
    finalDifficultyIndex,
    requiresJamRoll: naturalResult > reliabilityThreshold
  };
}

export function classifyJamSeverity(jamRollResult) {
  if (jamRollResult <= 10) return "minor";
  if (jamRollResult <= 18) return "serious";
  return "critical";
}

async function selectShotConfiguration(actor, target) {
  const weapons = actor.items.filter((item) => (
    item.type === "weapon"
    && item.system.weaponClass !== "LAUNCHER"
    && item.system.weaponClass !== "PROJECTILE"
    && item.system.currentAmmunition > 0
    && item.system.jamState === "ready"
  ));

  if (weapons.length === 0) {
    ui.notifications.warn("Postać nie ma sprawnej, załadowanej broni palnej.");
    return null;
  }

  const woundPenalty = calculateWoundPenaltyPercent(actor);
  const armorPenalty = actor.system.testPenalties?.armorPercent ?? 0;
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Strzał: ${actor.name} → ${target.name}` },
    content: `
      <div class="form-group">
        <label for="neuroshima-shot-weapon">Broń</label>
        <select id="neuroshima-shot-weapon" name="weaponId">
          ${prepareWeaponOptions(weapons)}
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
    `,
    ok: {
      label: "Rzuć 1k20",
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

async function selectSpentSkillPoints(actor, skillName, availablePoints, naturalResult) {
  if (availablePoints <= 0 || naturalResult === 20) return 0;

  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Umiejętność: ${skillName}` },
    content: `
      <p>Naturalny wynik strzału: <strong>${naturalResult}</strong></p>
      <p>Dostępne punkty Umiejętności w tej rundzie: <strong>${availablePoints}</strong></p>
      <div class="form-group">
        <label for="neuroshima-shot-skill-points">Użyte punkty</label>
        <input id="neuroshima-shot-skill-points" type="number" name="spentPoints"
          value="0" min="0" max="${availablePoints}" step="1">
      </div>
    `,
    ok: { label: "Zastosuj" },
    rejectClose: false,
    modal: true
  });

  if (!formData) return 0;
  return Math.max(0, Math.min(Number(formData.spentPoints) || 0, availablePoints));
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
  const configuration = await selectShotConfiguration(actor, target);
  if (!configuration) return false;

  const { weapon, skillKey } = configuration;
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

  const shotRoll = await new foundry.dice.Roll("1d20").evaluate();
  const naturalResult = shotRoll.dice[0].results[0].result;
  const spentSkillPoints = await selectSpentSkillPoints(
    actor,
    RANGED_SKILLS[skillKey],
    skillAvailability.availablePoints,
    naturalResult
  );

  const totalDifficultyPercentage = configuration.woundPenalty
    + configuration.armorPenalty
    + configuration.customModifier
    + weapon.system.accuracyModifier;
  const result = calculateSingleShotResult({
    dexterity: actor.system.attributes.zrecznosc.value,
    naturalResult,
    difficultyPercentage: totalDifficultyPercentage,
    skillLevel,
    spentSkillPoints,
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
      [skillKey]: (skillUsage.spentBySkill[skillKey] ?? 0) + spentSkillPoints
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

  const pointsLabel = result.testPassed
    ? `Punkty Sukcesu: ${Math.max(0, result.pointsDifference)}`
    : `Punkty Porażki: ${Math.abs(Math.min(0, result.pointsDifference))}`;
  const resolution = result.testPassed ? "Trafienie" : "Pudło";
  await shotRoll.toMessage({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: [
      `<strong>Strzał: ${foundry.utils.escapeHTML(actor.name)} → ${foundry.utils.escapeHTML(target.name)}</strong>`,
      `Broń: ${foundry.utils.escapeHTML(weapon.name)}`,
      `Umiejętność: ${RANGED_SKILLS[skillKey]} (${skillLevel}), użyto ${spentSkillPoints}`,
      `Kary i modyfikatory: ${totalDifficultyPercentage}%`,
      `Ostateczny PT: ${DIFFICULTY_LABELS[result.finalDifficultyIndex]}`,
      `Próg sukcesu: ${result.successThreshold}`,
      `Kość: ${naturalResult}${spentSkillPoints > 0 ? ` → ${result.adjustedResult}` : ""}`,
      result.automaticFailure ? "Pechowa 20: automatyczna porażka kości" : pointsLabel,
      `Niezawodność: wynik ${naturalResult} ${result.requiresJamRoll ? ">" : "≤"} ${weapon.system.misfireRoll}`,
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

  await markCurrentSegmentActionResolved(actor, resolution);
  return true;
}
