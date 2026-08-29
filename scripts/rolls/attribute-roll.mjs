// Klucze są technicznymi nazwami zapisanymi w modelu danych,
// a wartości są polskimi nazwami wyświetlanymi użytkownikowi.
const ATTRIBUTE_LABELS = {
  zrecznosc: "Zręczność",
  percepcja: "Percepcja",
  charakter: "Charakter",
  spryt: "Spryt",
  budowa: "Budowa"
};

// Kolejność odpowiada poziomom trudności używanym przez kartę Roll20.
// Liczba mówi, o ile zmniejszamy wartość współczynnika, aby otrzymać próg testu.
const DIFFICULTY_MODIFIERS = [-2, 0, 2, 5, 8, 11, 15, 20, 24];
const DIFFICULTY_LABELS = [
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

async function selectStartingDifficultyIndex() {
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
      title: "Wybierz poziom trudności"
    },
    content: `
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

  return Number(formData.difficultyIndex);
}

function calculateFinalDifficultyIndex(dieResults, startingDifficultyIndex) {
  let difficultyIndex = startingDifficultyIndex;

  // Każda wyrzucona 1 ułatwia test o jeden poziom,
  // a każda wyrzucona 20 utrudnia go o jeden poziom.
  for (const dieResult of dieResults) {
    if (dieResult === 1) {
      difficultyIndex -= 1;
    }

    if (dieResult === 20) {
      difficultyIndex += 1;
    }
  }

  // Nie pozwalamy wyjść poza pierwszą i ostatnią pozycję listy trudności.
  return Math.max(0, Math.min(difficultyIndex, DIFFICULTY_LABELS.length - 1));
}

function prepareDieResultsDescription(dieResults, successThreshold) {
  return dieResults
    .map((dieResult) => {
      const resultDescription = dieResult <= successThreshold ? "sukces" : "porażka";
      return `${dieResult} (${resultDescription})`;
    })
    .join(", ");
}

export async function rollAttribute(actor, attributeKey) {
  // Odczytujemy właściwy współczynnik na podstawie przycisku klikniętego na karcie.
  const attribute = actor.system.attributes[attributeKey];

  // To zabezpieczenie zatrzymuje rzut, gdy karta przekaże nieistniejący klucz.
  if (!attribute) {
    ui.notifications.error("Nie znaleziono wybranego współczynnika.");
    return;
  }

  const attributeLabel = ATTRIBUTE_LABELS[attributeKey];

  // Najpierw pytamy użytkownika o trudność. Zamknięcie okna przerywa cały test.
  const startingDifficultyIndex = await selectStartingDifficultyIndex();

  if (startingDifficultyIndex === null) {
    return;
  }

  // Foundry sam losuje trzy kości dwudziestościenne i przechowuje ich wyniki.
  const roll = await new foundry.dice.Roll("3d20").evaluate();

  // Pierwszy element tablicy "dice" zawiera wszystkie trzy wyniki z zapisu 3d20.
  const dieResults = roll.dice[0].results.map((dieResultData) => dieResultData.result);
  const finalDifficultyIndex = calculateFinalDifficultyIndex(dieResults, startingDifficultyIndex);
  const startingDifficultyLabel = DIFFICULTY_LABELS[startingDifficultyIndex];
  const finalDifficultyLabel = DIFFICULTY_LABELS[finalDifficultyIndex];
  const successThreshold = attribute.value - DIFFICULTY_MODIFIERS[finalDifficultyIndex];
  const numberOfSuccesses = dieResults.filter((dieResult) => dieResult <= successThreshold).length;
  const dieResultsDescription = prepareDieResultsDescription(dieResults, successThreshold);

  // Gotowy rzut publikujemy na czacie jako wiadomość przypisaną do postaci.
  await roll.toMessage({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: [
      `<strong>Test: ${attributeLabel}</strong>`,
      `Wartość współczynnika: ${attribute.value}`,
      `Początkowy poziom trudności: ${startingDifficultyLabel}`,
      `Ostateczny poziom trudności: ${finalDifficultyLabel}`,
      `Próg sukcesu: ${successThreshold}`,
      `Kości: ${dieResultsDescription}`,
      `<strong>Liczba sukcesów: ${numberOfSuccesses}</strong>`
    ].join("<br>")
  });
}
