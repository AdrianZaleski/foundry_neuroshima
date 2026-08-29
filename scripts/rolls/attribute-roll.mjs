import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  calculateFinalDifficultyIndex,
  prepareTestResultMessage,
  selectStartingDifficultyIndex
} from "./roll-helpers.mjs";

// Klucze są technicznymi nazwami zapisanymi w modelu danych,
// a wartości są polskimi nazwami wyświetlanymi użytkownikowi.
const ATTRIBUTE_LABELS = {
  zrecznosc: "Zręczność",
  percepcja: "Percepcja",
  charakter: "Charakter",
  spryt: "Spryt",
  budowa: "Budowa"
};

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

  // Zgodnie z zasadami Neuroshimy cały test wymaga sukcesu na co najmniej dwóch kościach.
  const testResultMessage = prepareTestResultMessage(numberOfSuccesses);

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
      `<strong>Liczba sukcesów: ${numberOfSuccesses}</strong>`,
      testResultMessage
    ].join("<br>")
  });
}
