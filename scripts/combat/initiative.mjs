import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  calculateDifficultyIndexFromPercentage,
  calculateFinalDifficultyIndex,
  calculateWoundPenaltyPercent
} from "../rolls/roll-helpers.mjs";

const INITIATIVE_SKILLS = {
  bijatyka: "Bijatyka",
  bronReczna: "Broń ręczna",
  rzucanie: "Rzucanie",
  pistolety: "Pistolety",
  karabiny: "Karabiny",
  bronMaszynowa: "Broń maszynowa",
  luk: "Łuk",
  kusza: "Kusza",
  proca: "Proca"
};

const INITIATIVE_ATTRIBUTES = {
  zrecznosc: "Zręczność",
  percepcja: "Percepcja"
};

function checkboxIsSelected(value) {
  return value === true || value === "true" || value === "on";
}

function prepareSkillOptions(actor) {
  const options = [
    '<option value="" selected>Bez umiejętności (+1 PT)</option>'
  ];

  for (const [skillKey, skillName] of Object.entries(INITIATIVE_SKILLS)) {
    const skillLevel = Math.max(0, actor.system.skills?.[skillKey]?.value ?? 0);
    options.push(
      `<option value="${skillKey}">${skillName} (${skillLevel})</option>`
    );
  }

  return options.join("");
}

function prepareMeleeWeaponOptions(actor) {
  const options = ['<option value="" selected>Brak modyfikatora broni</option>'];

  for (const weapon of actor.items.filter((item) => item.type === "meleeWeapon")) {
    const modifier = weapon.system.initiativeBonus ?? 0;
    const modifierLabel = modifier >= 0 ? `+${modifier}` : String(modifier);
    options.push(
      `<option value="${weapon.id}">${foundry.utils.escapeHTML(weapon.name)} (${modifierLabel})</option>`
    );
  }

  return options.join("");
}

export function applySkillToOpenInitiativeDice(dieResults, skillLevel) {
  const sortedDice = dieResults
    .map((naturalResult, originalIndex) => ({
      naturalResult,
      adjustedResult: naturalResult,
      originalIndex,
      usedSkillPoints: 0
    }))
    .sort((leftDie, rightDie) => (
      leftDie.naturalResult - rightDie.naturalResult
      || leftDie.originalIndex - rightDie.originalIndex
    ));

  const consideredDice = sortedDice.slice(0, 2);
  const discardedDie = sortedDice[2];

  // W otwartym teście poprawiamy aktualnie gorszą z dwóch rozpatrywanych
  // kości. Przy remisie punkty rozkładają się naprzemiennie.
  for (let spentPoint = 0; spentPoint < skillLevel; spentPoint += 1) {
    const selectedDie = consideredDice[0].adjustedResult
      >= consideredDice[1].adjustedResult
      ? consideredDice[0]
      : consideredDice[1];
    selectedDie.adjustedResult -= 1;
    selectedDie.usedSkillPoints += 1;
  }

  return { consideredDice, discardedDie };
}

export function calculateInitiativeResult({
  attributeValue,
  dieResults,
  skillLevel,
  usesSkill,
  difficultyPercentage,
  weaponModifier = 0
}) {
  const difficultyAfterPercentage = calculateDifficultyIndexFromPercentage(
    difficultyPercentage
  );
  const sliderSteps = usesSkill && skillLevel > 0
    ? Math.floor(skillLevel / 4)
    : 0;
  const difficultyBeforeCriticalResults = usesSkill && skillLevel > 0
    ? difficultyAfterPercentage - sliderSteps
    : difficultyAfterPercentage + 1;
  const boundedDifficultyBeforeCriticalResults = Math.max(
    0,
    Math.min(difficultyBeforeCriticalResults, DIFFICULTY_LABELS.length - 1)
  );
  const finalDifficultyIndex = calculateFinalDifficultyIndex(
    dieResults,
    boundedDifficultyBeforeCriticalResults
  );
  const successThreshold = attributeValue
    - DIFFICULTY_MODIFIERS[finalDifficultyIndex]
    + weaponModifier;
  const openDice = applySkillToOpenInitiativeDice(dieResults, skillLevel);
  const decisiveResult = Math.max(
    ...openDice.consideredDice.map((die) => die.adjustedResult)
  );

  return {
    initiativeScore: successThreshold - decisiveResult,
    successThreshold,
    sliderSteps,
    difficultyAfterPercentage,
    finalDifficultyIndex,
    ...openDice
  };
}

async function selectInitiativeConfiguration(actor) {
  const woundPenalty = calculateWoundPenaltyPercent(actor);
  const armorPenalty = actor.system.testPenalties?.armorPercent ?? 0;
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: `Inicjatywa: ${actor.name}` },
    content: `
      <div class="form-group">
        <label for="neuroshima-initiative-attribute">Testowany współczynnik</label>
        <select id="neuroshima-initiative-attribute" name="attributeKey">
          <option value="zrecznosc" selected>Zręczność</option>
          <option value="percepcja">Percepcja (wariant sytuacyjny)</option>
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-initiative-skill">Umiejętność używanej broni</label>
        <select id="neuroshima-initiative-skill" name="skillKey">
          ${prepareSkillOptions(actor)}
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-initiative-weapon">Broń ręczna</label>
        <select id="neuroshima-initiative-weapon" name="meleeWeaponId">
          ${prepareMeleeWeaponOptions(actor)}
        </select>
      </div>
      <hr>
      <div class="form-group">
        <label>
          <input type="checkbox" name="includeWounds" checked>
          Uwzględnij rany (${woundPenalty}%)
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="includeArmor" checked>
          Uwzględnij pancerz (${armorPenalty}%)
        </label>
      </div>
      <div class="form-group">
        <label for="neuroshima-initiative-penalty">Inne utrudnienie lub ułatwienie</label>
        <input id="neuroshima-initiative-penalty" type="number"
          name="customPenaltyPercent" value="0" step="1"> %
      </div>
    `,
    ok: {
      label: "Rzuć inicjatywę",
      icon: "fas fa-dice-d20"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return null;

  const skillKey = String(formData.skillKey ?? "");
  const meleeWeaponId = String(formData.meleeWeaponId ?? "");
  const meleeWeapon = meleeWeaponId ? actor.items.get(meleeWeaponId) : null;

  return {
    attributeKey: String(formData.attributeKey),
    skillKey,
    skillLevel: skillKey
      ? Math.max(0, actor.system.skills?.[skillKey]?.value ?? 0)
      : 0,
    weaponName: meleeWeapon?.name ?? "",
    weaponModifier: meleeWeapon?.system.initiativeBonus ?? 0,
    includedWoundPenalty: checkboxIsSelected(formData.includeWounds)
      ? woundPenalty
      : 0,
    includedArmorPenalty: checkboxIsSelected(formData.includeArmor)
      ? armorPenalty
      : 0,
    customPenalty: Number(formData.customPenaltyPercent) || 0
  };
}

function describeInitiativeDice(consideredDice) {
  return consideredDice.map((die) => {
    if (die.usedSkillPoints === 0) return String(die.naturalResult);
    return `${die.naturalResult} → ${die.adjustedResult} (użyto ${die.usedSkillPoints})`;
  }).join(", ");
}

export async function rollNeuroshimaInitiative(actor, { messageOptions = {} } = {}) {
  const configuration = await selectInitiativeConfiguration(actor);
  if (!configuration) return null;

  const attribute = actor.system.attributes?.[configuration.attributeKey];
  if (!attribute) {
    ui.notifications.error("Nie znaleziono współczynnika inicjatywy.");
    return null;
  }

  const roll = await new foundry.dice.Roll("3d20").evaluate();
  const dieResults = roll.dice[0].results.map((die) => die.result);
  const totalPenalty = configuration.includedWoundPenalty
    + configuration.includedArmorPenalty
    + configuration.customPenalty;
  const result = calculateInitiativeResult({
    attributeValue: attribute.value,
    dieResults,
    skillLevel: configuration.skillLevel,
    usesSkill: Boolean(configuration.skillKey),
    difficultyPercentage: totalPenalty,
    weaponModifier: configuration.weaponModifier
  });
  const skillName = configuration.skillKey
    ? INITIATIVE_SKILLS[configuration.skillKey]
    : "Bez umiejętności";
  const weaponDescription = configuration.weaponName
    ? `${configuration.weaponName} (${configuration.weaponModifier >= 0 ? "+" : ""}${configuration.weaponModifier})`
    : "brak";

  await roll.toMessage({
    ...messageOptions,
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: [
      "<strong>Otwarty test inicjatywy</strong>",
      `Współczynnik: ${INITIATIVE_ATTRIBUTES[configuration.attributeKey]} (${attribute.value})`,
      `Umiejętność: ${skillName} (${configuration.skillLevel})`,
      `Suwak umiejętności: ${result.sliderSteps} poziom(y)`,
      `Modyfikator broni: ${weaponDescription}`,
      `Kary procentowe: ${totalPenalty}%`,
      `Ostateczny PT: ${DIFFICULTY_LABELS[result.finalDifficultyIndex]}`,
      `Próg sukcesu: ${result.successThreshold}`,
      `Rozpatrywane kości: ${describeInitiativeDice(result.consideredDice)}`,
      `Odrzucona kość: ${result.discardedDie.naturalResult}`,
      `<strong>Wynik inicjatywy: ${result.initiativeScore}</strong>`
    ].join("<br>")
  });

  return {
    score: result.initiativeScore,
    roll,
    configuration,
    result
  };
}

export class NeuroshimaCombat extends foundry.documents.Combat {
  async rollInitiative(ids, options = {}) {
    const combatantIds = Array.isArray(ids) ? ids : [ids];

    for (const combatantId of combatantIds) {
      const combatant = this.combatants.get(combatantId);
      if (!combatant?.actor) {
        ui.notifications.warn("Uczestnik walki nie ma przypisanego Actora.");
        continue;
      }

      const initiativeRoll = await rollNeuroshimaInitiative(combatant.actor, {
        messageOptions: options.messageOptions ?? {}
      });
      if (!initiativeRoll) continue;

      await this.setInitiative(combatantId, initiativeRoll.score);
    }

    // Nie korzystamy z Object.groupBy, ponieważ Foundry może działać na
    // wersji Chromium, która nie udostępnia jeszcze tej funkcji.
    const combatantsByInitiative = new Map();

    for (const combatant of this.turns) {
      if (combatant.initiative === null) continue;

      const scoreKey = String(combatant.initiative);
      const combatantsWithScore = combatantsByInitiative.get(scoreKey) ?? [];
      combatantsWithScore.push(combatant);
      combatantsByInitiative.set(scoreKey, combatantsWithScore);
    }

    const ties = [...combatantsByInitiative.values()].filter(
      (combatantsWithScore) => combatantsWithScore.length > 1
    );

    for (const tiedCombatants of ties) {
      const tiedNames = tiedCombatants.map((combatant) => combatant.name).join(", ");
      ui.notifications.warn(
        `Remis inicjatywy (${tiedCombatants[0].initiative}): ${tiedNames}. Powtórz rzuty remisujących.`
      );
    }

    return this;
  }
}
