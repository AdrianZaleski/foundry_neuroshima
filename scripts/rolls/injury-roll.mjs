import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  DIFFICULTY_STARTING_PERCENTAGES,
  calculateDifficultyIndexFromPercentage,
  calculateFinalDifficultyIndex,
  calculateWoundPenaltyPercent,
  prepareTestResultMessage
} from "./roll-helpers.mjs";
import {
  applySkillToDieResults,
  calculateDifficultyIndexBeforeCriticalResults,
  prepareSkillDieResultsDescription,
  prepareSliderDescription
} from "./skill-roll.mjs";

export const INJURY_ROLL_CONFIGURATION = {
  abrasion: {
    label: "Draśnięcie",
    difficultyIndex: 1,
    passedPenaltyPercent: 5,
    failedPenaltyPercent: 10
  },
  light: {
    label: "Rana lekka",
    difficultyIndex: 2,
    passedPenaltyPercent: 15,
    failedPenaltyPercent: 30
  },
  serious: {
    label: "Rana ciężka",
    difficultyIndex: 3,
    passedPenaltyPercent: 30,
    failedPenaltyPercent: 60
  },
  critical: {
    label: "Rana krytyczna",
    difficultyIndex: null,
    passedPenaltyPercent: 160,
    failedPenaltyPercent: 160
  }
};

const INJURY_LOCATION_LABELS = {
  general: "Ogólne / inne miejsce",
  head: "Głowa",
  torso: "Tułów",
  leftArm: "Lewa ręka",
  rightArm: "Prawa ręka",
  leftLeg: "Lewa noga",
  rightLeg: "Prawa noga"
};

function describeSuccessCount(numberOfSuccesses) {
  if (numberOfSuccesses === 1) return "1 sukces";
  if ([2, 3, 4].includes(numberOfSuccesses)) return `${numberOfSuccesses} sukcesy`;
  return `${numberOfSuccesses} sukcesów`;
}

function checkboxIsSelected(fieldValue) {
  return fieldValue === true || fieldValue === "true" || fieldValue === "on";
}

async function selectInjuryType(actor, presetInjuryType = "") {
  const woundPenaltyPercent = calculateWoundPenaltyPercent(actor);
  const presetConfiguration = INJURY_ROLL_CONFIGURATION[presetInjuryType];
  const injuryTypeField = presetConfiguration
    ? `
      <p><strong>Rodzaj rany:</strong> ${presetConfiguration.label}</p>
      <input type="hidden" name="injuryType" value="${presetInjuryType}">
    `
    : `
      <div class="form-group">
        <label for="neuroshima-injury-roll-type">Rodzaj rany</label>
        <select id="neuroshima-injury-roll-type" name="injuryType">
          <option value="abrasion">Draśnięcie — test Przeciętny, kara 5% / 10%</option>
          <option value="light">Rana lekka — test Problematyczny, kara 15% / 30%</option>
          <option value="serious">Rana ciężka — test Trudny, kara 30% / 60%</option>
          <option value="critical">Rana krytyczna — bez testu, kara 160%</option>
        </select>
      </div>
    `;

  return foundry.applications.api.DialogV2.input({
    window: { title: "Rzut na ranę" },
    content: `
      ${injuryTypeField}
      <div class="form-group">
        <label>
          <input type="checkbox" name="includeWoundPenalties" checked>
          Uwzględnij aktualne kary z ran (${woundPenaltyPercent}%)
        </label>
      </div>
    `,
    ok: {
      label: "Rozpatrz ranę",
      icon: "fas fa-dice-d20"
    },
    rejectClose: false,
    modal: true
  });
}

async function publishCriticalInjuryResult(actor) {
  await foundry.documents.ChatMessage.create({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    content: [
      "<strong>Rana krytyczna</strong>",
      "Test Odporności na ból: nie wykonuje się",
      "<strong>Kara z rany: 160%</strong>",
      "Jeśli postać nie otrzyma pierwszej pomocy, umiera."
    ].join("<br>")
  });

  return {
    injuryType: "critical",
    testPassed: null,
    penaltyPercent: 160,
    numberOfSuccesses: null
  };
}

export async function rollPainResistanceForInjury(actor, presetInjuryType = "") {
  if (presetInjuryType === "critical") {
    return publishCriticalInjuryResult(actor);
  }

  const formData = await selectInjuryType(actor, presetInjuryType);
  if (!formData) return;

  const injuryType = String(formData.injuryType ?? "");
  const injuryConfiguration = INJURY_ROLL_CONFIGURATION[injuryType];
  if (!injuryConfiguration) {
    ui.notifications.error("Nie znaleziono wybranego rodzaju rany.");
    return;
  }

  if (injuryType === "critical") {
    return publishCriticalInjuryResult(actor);
  }

  const attribute = actor.system.attributes.charakter;
  const skill = actor.system.skills.odpornoscNaBol;
  if (!attribute || !skill) {
    ui.notifications.error("Postać nie ma Charakteru lub umiejętności Odporność na ból.");
    return;
  }

  const skillLevel = Math.max(0, skill.value);
  const includedWoundPenaltyPercent = checkboxIsSelected(formData.includeWoundPenalties)
    ? calculateWoundPenaltyPercent(actor)
    : 0;
  const difficultyPercentageAfterPenalties = DIFFICULTY_STARTING_PERCENTAGES[
    injuryConfiguration.difficultyIndex
  ] + includedWoundPenaltyPercent;
  const difficultyIndexAfterPenalties = calculateDifficultyIndexFromPercentage(
    difficultyPercentageAfterPenalties
  );
  const difficultyIndexBeforeCriticalResults = calculateDifficultyIndexBeforeCriticalResults(
    difficultyIndexAfterPenalties,
    skillLevel
  );
  const roll = await new foundry.dice.Roll("3d20").evaluate();
  const dieResults = roll.dice[0].results.map((dieResultData) => dieResultData.result);
  const finalDifficultyIndex = calculateFinalDifficultyIndex(
    dieResults,
    difficultyIndexBeforeCriticalResults
  );
  const successThreshold = attribute.value - DIFFICULTY_MODIFIERS[finalDifficultyIndex];
  const evaluatedDieResults = applySkillToDieResults(
    dieResults,
    successThreshold,
    skillLevel
  );
  const numberOfSuccesses = evaluatedDieResults.filter(
    (dieResult) => dieResult.adjustedResult <= successThreshold
  ).length;
  const testPassed = numberOfSuccesses >= 2;
  const penaltyPercent = testPassed
    ? injuryConfiguration.passedPenaltyPercent
    : injuryConfiguration.failedPenaltyPercent;
  const penaltyVariant = testPassed ? "mniejsza kara" : "większa kara";

  await roll.toMessage({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: [
      `<strong>${injuryConfiguration.label} — test Odporności na ból</strong>`,
      `Współczynnik: Charakter (${attribute.value})`,
      `Poziom umiejętności: ${skillLevel}`,
      `Suwak: ${prepareSliderDescription(skillLevel)}`,
      `Poziom trudności rany: ${DIFFICULTY_LABELS[injuryConfiguration.difficultyIndex]}`,
      `Uwzględnione kary z ran: ${includedWoundPenaltyPercent}%`,
      `Poziom trudności po karach: ${DIFFICULTY_LABELS[difficultyIndexAfterPenalties]}`,
      `Ostateczny poziom trudności: ${DIFFICULTY_LABELS[finalDifficultyIndex]}`,
      `Próg sukcesu: ${successThreshold}`,
      `Kości: ${prepareSkillDieResultsDescription(evaluatedDieResults, successThreshold)}`,
      `<strong>Liczba sukcesów: ${numberOfSuccesses}</strong>`,
      prepareTestResultMessage(numberOfSuccesses),
      `<div style="margin-top: 8px; font-weight: bold; text-align: center;">Kara z rany: ${penaltyPercent}% (${penaltyVariant})</div>`
    ].join("<br>")
  });

  // Zwracamy komplet rozstrzygnięcia, aby kolejny etap mógł na jego podstawie
  // utworzyć Item rany bez ponownego liczenia testu.
  return {
    injuryType,
    testPassed,
    penaltyPercent,
    numberOfSuccesses,
    includedWoundPenaltyPercent
  };
}

export async function promptToCreateInjuryFromRoll(
  actor,
  injuryResult,
  { location: presetLocation = "", defaultName = "", additionalDescription = "" } = {}
) {
  const injuryConfiguration = INJURY_ROLL_CONFIGURATION[injuryResult?.injuryType];
  if (!injuryConfiguration) return null;

  const locationOptions = Object.entries(INJURY_LOCATION_LABELS)
    .map(([locationKey, locationLabel]) => (
      `<option value="${locationKey}" ${locationKey === presetLocation ? "selected" : ""}>${locationLabel}</option>`
    ))
    .join("");
  const hasPresetLocation = Object.hasOwn(INJURY_LOCATION_LABELS, presetLocation);
  const locationField = hasPresetLocation
    ? `
      <p><strong>Miejsce rany:</strong> ${INJURY_LOCATION_LABELS[presetLocation]}</p>
      <input type="hidden" name="location" value="${presetLocation}">
    `
    : `
      <div class="form-group">
        <label for="neuroshima-rolled-injury-location">Miejsce rany</label>
        <select id="neuroshima-rolled-injury-location" name="location">
          ${locationOptions}
        </select>
      </div>
    `;
  const testResultDescription = injuryResult.testPassed === null
    ? "bez testu Odporności na ból"
    : `test ${injuryResult.testPassed ? "zdany" : "niezdany"}`;

  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: "Dodaj ranę do postaci" },
    content: `
      <p>
        <strong>${injuryConfiguration.label}</strong><br>
        ${testResultDescription}, kara ${injuryResult.penaltyPercent}%
      </p>
      <div class="form-group">
        <label for="neuroshima-rolled-injury-name">Nazwa rany</label>
        <input id="neuroshima-rolled-injury-name" type="text" name="injuryName"
          value="${foundry.utils.escapeHTML(defaultName || injuryConfiguration.label)}">
      </div>
      ${locationField}
    `,
    ok: {
      label: "Dodaj ranę",
      icon: "fas fa-notes-medical"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) return null;

  const location = String(formData.location ?? "");
  if (!Object.hasOwn(INJURY_LOCATION_LABELS, location)) {
    ui.notifications.error("Wybrano nieprawidłowe miejsce rany.");
    return null;
  }

  const injuryName = String(formData.injuryName ?? "").trim()
    || injuryConfiguration.label;
  const resistanceDescription = injuryResult.testPassed === null
    ? "Rana krytyczna — bez testu Odporności na ból."
    : `Test Odporności na ból: ${injuryResult.testPassed ? "zdany" : "niezdany"} (${describeSuccessCount(injuryResult.numberOfSuccesses)}).`;
  const description = [resistanceDescription, String(additionalDescription).trim()]
    .filter(Boolean)
    .join(" ");
  const [createdInjury] = await actor.createEmbeddedDocuments("Item", [
    {
      name: injuryName,
      type: "injury",
      system: {
        injuryType: injuryResult.injuryType,
        location,
        penaltyPercent: injuryResult.penaltyPercent,
        description
      }
    }
  ]);

  ui.notifications.info(
    `Dodano ranę: ${injuryName} — ${INJURY_LOCATION_LABELS[location]}, kara ${injuryResult.penaltyPercent}%.`
  );
  return createdInjury;
}
