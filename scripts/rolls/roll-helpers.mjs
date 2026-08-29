// Wspólne dane i funkcje używane przez różne rodzaje testów Neuroshimy.

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

// Po otwarciu okna jako domyślny zaznaczamy poziom "Przeciętny".
const DEFAULT_DIFFICULTY_INDEX = 1;

export async function selectTestConfiguration() {
  // Tworzymy pozycje listy na podstawie tej samej tabeli,
  // której później użyjemy podczas obliczania progu testu.
  const difficultyOptions = DIFFICULTY_LABELS
    .map((difficultyLabel, difficultyIndex) => {
      const thresholdChange = -DIFFICULTY_MODIFIERS[difficultyIndex];
      const thresholdChangeLabel = thresholdChange >= 0 ? `+${thresholdChange}` : thresholdChange;
      const selectedAttribute = difficultyIndex === DEFAULT_DIFFICULTY_INDEX ? "selected" : "";

      return `<option value="${difficultyIndex}" ${selectedAttribute}>${difficultyLabel} (współczynnik ${thresholdChangeLabel})</option>`;
    })
    .join("");

  // DialogV2.input zwraca dane formularza albo null, gdy użytkownik zamknie okno.
  const formData = await foundry.applications.api.DialogV2.input({
    window: {
      title: "Ustawienia testu"
    },
    content: `
      <div class="form-group">
        <label for="neuroshima-test-type">Rodzaj testu</label>
        <select id="neuroshima-test-type" name="testType">
          <option value="closed" selected>Zamknięty</option>
          <option value="open">Otwarty</option>
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-difficulty">Poziom trudności</label>
        <select id="neuroshima-difficulty" name="difficultyIndex">
          ${difficultyOptions}
        </select>
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

  return {
    testType: String(formData.testType),
    startingDifficultyIndex: Number(formData.difficultyIndex)
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
