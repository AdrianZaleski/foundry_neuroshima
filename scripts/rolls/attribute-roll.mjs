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

// Na obecnym etapie każdy test rozpoczyna się od poziomu "Przeciętny".
const DEFAULT_DIFFICULTY_INDEX = 1;

function calculateFinalDifficultyIndex(dieResults) {
  let difficultyIndex = DEFAULT_DIFFICULTY_INDEX;

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

  // Foundry sam losuje trzy kości dwudziestościenne i przechowuje ich wyniki.
  const roll = await new foundry.dice.Roll("3d20").evaluate();

  // Pierwszy element tablicy "dice" zawiera wszystkie trzy wyniki z zapisu 3d20.
  const dieResults = roll.dice[0].results.map((dieResultData) => dieResultData.result);
  const finalDifficultyIndex = calculateFinalDifficultyIndex(dieResults);
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
      `Poziom trudności: ${finalDifficultyLabel}`,
      `Próg sukcesu: ${successThreshold}`,
      `Kości: ${dieResultsDescription}`,
      `<strong>Liczba sukcesów: ${numberOfSuccesses}</strong>`
    ].join("<br>")
  });
}
