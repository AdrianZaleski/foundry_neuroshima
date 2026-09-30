// Wspólne dane i funkcje używane przez różne rodzaje testów Neuroshimy.
import { calculateArmorPenaltyPercent } from "../combat/armor.mjs";
import {
  collectAttributeModifierSources,
  collectSkillModifierSources,
  collectTestModifierSources,
  describeModifierSources,
  sumModifierSources
} from "../effects/modifiers.mjs";

// Liczba określa, o ile obniżamy współczynnik podczas obliczania progu testu.
export const DIFFICULTY_MODIFIERS = [-2, 0, 2, 5, 8, 11, 15, 20, 24];

export const DIFFICULTY_LABELS = [
  "Łatwy",
  "Przeciętny",
  "Problematyczny",
  "Trudny",
  "Bardzo trudny",
  "Cholernie trudny",
  "Fart",
  "Mistrzowski",
  "Arcymistrzowski"
];

// Każdy poziom trudności ma początkową wartość procentową. Dodanie kar
// przesuwa wynik do odpowiedniego przedziału z tabeli PT.
export const DIFFICULTY_STARTING_PERCENTAGES = [
  -20,
  0,
  11,
  31,
  61,
  91,
  121,
  161,
  201
];

const DIFFICULTY_MAXIMUM_PERCENTAGES = [
  -1,
  10,
  30,
  60,
  90,
  120,
  160,
  200,
  Number.POSITIVE_INFINITY
];

// Po otwarciu okna jako domyślny zaznaczamy poziom "Przeciętny".
const DEFAULT_DIFFICULTY_INDEX = 1;

export function calculateDifficultyIndexFromPercentage(difficultyPercentage) {
  const matchingIndex = DIFFICULTY_MAXIMUM_PERCENTAGES.findIndex(
    (maximumPercentage) => difficultyPercentage <= maximumPercentage
  );

  // Ostatni przedział nie ma górnej granicy, więc zabezpieczenie powinno być
  // potrzebne wyłącznie w przypadku nieprawidłowej wartości wejściowej.
  return matchingIndex === -1 ? DIFFICULTY_LABELS.length - 1 : matchingIndex;
}

export function calculateWoundPenaltyPercent(actor) {
  return actor.items
    .filter((item) => item.type === "injury")
    .reduce(
      (currentSum, injuryItem) => currentSum + injuryItem.system.penaltyPercent,
      0
    );
}

function checkboxIsSelected(fieldValue) {
  return fieldValue === true || fieldValue === "true" || fieldValue === "on";
}

export async function selectTestConfiguration(
  actor,
  {
    fixedTestType = "",
    windowTitle = "Ustawienia testu",
    attributeKey = "",
    skillKey = "",
    fixedDifficultyIndex = null,
    initialDifficultyIndex = DEFAULT_DIFFICULTY_INDEX,
    fixedPenaltyPercent = 0
  } = {}
) {
  const woundPenaltyPercent = calculateWoundPenaltyPercent(actor);
  const armorPenaltyPercent = calculateArmorPenaltyPercent(actor, attributeKey);
  const attributeModifierSources = collectAttributeModifierSources(actor, attributeKey);
  const skillModifierSources = skillKey
    ? collectSkillModifierSources(actor, skillKey)
    : [];
  const testModifierSources = collectTestModifierSources(actor, {
    attributeKey,
    skillKey
  });
  const testModifierPercent = sumModifierSources(testModifierSources);
  const valueModifierSources = [...attributeModifierSources, ...skillModifierSources];
  const valueModifierDescription = describeModifierSources(valueModifierSources);
  const testModifierDescription = describeModifierSources(testModifierSources, "%");

  // Tworzymy pozycje listy na podstawie tej samej tabeli,
  // której później użyjemy podczas obliczania progu testu.
  const initialDifficulty = Number.isInteger(initialDifficultyIndex) && initialDifficultyIndex >= 0
    && initialDifficultyIndex < DIFFICULTY_LABELS.length ? initialDifficultyIndex : DEFAULT_DIFFICULTY_INDEX;
  const difficultyOptions = DIFFICULTY_LABELS
    .map((difficultyLabel, difficultyIndex) => {
      const thresholdChange = -DIFFICULTY_MODIFIERS[difficultyIndex];
      const thresholdChangeLabel = thresholdChange >= 0 ? `+${thresholdChange}` : thresholdChange;
      const selectedAttribute = difficultyIndex === (fixedDifficultyIndex ?? initialDifficulty) ? "selected" : "";

      return `<option value="${difficultyIndex}" ${selectedAttribute}>${difficultyLabel} (współczynnik ${thresholdChangeLabel})</option>`;
    })
    .join("");

  // DialogV2.input zwraca dane formularza albo null, gdy użytkownik zamknie okno.
  const testTypeField = fixedTestType
    ? `
      <p><strong>Rodzaj testu:</strong> ${fixedTestType === "open" ? "Otwarty" : "Zamknięty"}</p>
      <input type="hidden" name="testType" value="${fixedTestType}">
    `
    : `
      <div class="ns-test-field">
        <label for="neuroshima-test-type">Rodzaj testu</label>
        <select id="neuroshima-test-type" name="testType">
          <option value="closed" selected>Zamknięty</option>
          <option value="open">Otwarty</option>
        </select>
      </div>
    `;
  const formData = await foundry.applications.api.DialogV2.input({
    classes: ["neuroshima-test-dialog"],
    window: { title: windowTitle, resizable: true },
    position: { width: 520 },
    content: `
      <div class="ns-test-settings">
        ${testTypeField}
        <div class="ns-test-field">
          <label for="neuroshima-difficulty">Bazowy poziom trudności</label>
          <select id="neuroshima-difficulty" name="difficultyIndex" ${fixedDifficultyIndex !== null ? "disabled" : ""}>${difficultyOptions}</select>
        </div>
        <hr>
        <p><strong>Modyfikatory wartości:</strong> ${valueModifierDescription}</p>
        <label class="ns-test-check"><input type="checkbox" name="includeWounds" checked><span>Uwzględnij rany (${woundPenaltyPercent}%)</span></label>
        <label class="ns-test-check"><input type="checkbox" name="includeArmor" checked><span>Uwzględnij pancerz (${armorPenaltyPercent}%)</span></label>
        <div>
          <label class="ns-test-check"><input type="checkbox" name="includeEffects" checked><span>Uwzględnij aktywne efekty (${testModifierPercent}%)</span></label>
          <p class="ns-test-hint">${testModifierDescription}</p>
        </div>
        <div class="ns-test-field">
          <label for="neuroshima-custom-penalty">Dodatkowa modyfikacja</label>
          <div class="ns-percent-field"><input id="neuroshima-custom-penalty" type="number" name="customPenaltyPercent" value="0" step="1" aria-describedby="neuroshima-penalty-help"><span>%</span></div>
        </div>
        <p class="ns-test-hint" id="neuroshima-penalty-help">Wartości dodatnie = utrudnienie (np. +20%). Wartości ujemne = ułatwienie (np. −20%).</p>
        <p class="ns-test-hint">Modyfikator wynikający z akcji: ${Number(fixedPenaltyPercent) || 0}%. Rany, pancerz, efekty i dodatkowa modyfikacja zmieniają bazowy poziom trudności.</p>
      </div>
    `,
    ok: {
      label: "Rzuć 3k20",
      icon: "fas fa-dice-d20"
    },
    rejectClose: false,
    modal: true
  });

  if (!formData) {
    return null;
  }

  const startingDifficultyIndex = fixedDifficultyIndex ?? Number(formData.difficultyIndex);
  const includedWoundPenaltyPercent = checkboxIsSelected(formData.includeWounds)
    ? woundPenaltyPercent
    : 0;
  const includedArmorPenaltyPercent = checkboxIsSelected(formData.includeArmor)
    ? armorPenaltyPercent
    : 0;
  const includedTestModifierPercent = checkboxIsSelected(formData.includeEffects)
    ? testModifierPercent
    : 0;
  const customPenaltyPercent = (Number(formData.customPenaltyPercent) || 0) + (Number(fixedPenaltyPercent) || 0);
  const totalPenaltyPercent = includedWoundPenaltyPercent
    + includedArmorPenaltyPercent
    + includedTestModifierPercent
    + customPenaltyPercent;
  const difficultyPercentageAfterPenalties = DIFFICULTY_STARTING_PERCENTAGES[
    startingDifficultyIndex
  ] + totalPenaltyPercent;

  return {
    testType: String(formData.testType),
    startingDifficultyIndex,
    includedWoundPenaltyPercent,
    includedArmorPenaltyPercent,
    includedTestModifierPercent,
    customPenaltyPercent,
    totalPenaltyPercent,
    attributeModifierSources,
    skillModifierSources,
    testModifierSources: checkboxIsSelected(formData.includeEffects)
      ? testModifierSources
      : [],
    difficultyPercentageAfterPenalties,
    difficultyIndexAfterPercentagePenalties: calculateDifficultyIndexFromPercentage(
      difficultyPercentageAfterPenalties
    )
  };
}

export function calculateFinalDifficultyIndex(dieResults, difficultyIndexBeforeCriticalResults) {
  let finalDifficultyIndex = difficultyIndexBeforeCriticalResults;

  // Uwzględniamy wyłącznie naturalne wyniki rzutu, zanim zmieni je umiejętność.
  for (const dieResult of dieResults) {
    if (dieResult === 1) {
      finalDifficultyIndex -= 1;
    }

    if (dieResult === 20) {
      finalDifficultyIndex += 1;
    }
  }

  // Nie pozwalamy wyjść poza pierwszą i ostatnią pozycję listy trudności.
  return Math.max(0, Math.min(finalDifficultyIndex, DIFFICULTY_LABELS.length - 1));
}

export function prepareTestResultMessage(numberOfSuccesses) {
  return prepareTestVerdictMessage(numberOfSuccesses >= 2);
}

export function prepareTestVerdictMessage(testPassed) {
  const testResultLabel = testPassed ? "Test zdany" : "Test niezdany";
  const testResultBackgroundColor = testPassed ? "#2e7d32" : "#b71c1c";

  return `
    <div style="
      margin-top: 8px;
      padding: 6px;
      border-radius: 4px;
      background-color: ${testResultBackgroundColor};
      color: white;
      font-weight: bold;
      text-align: center;
    ">
      ${testResultLabel}
    </div>
  `;
}
