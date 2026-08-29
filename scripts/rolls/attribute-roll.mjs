// Klucze są technicznymi nazwami zapisanymi w modelu danych,
// a wartości są polskimi nazwami wyświetlanymi użytkownikowi.
const ATTRIBUTE_LABELS = {
  zrecznosc: "Zręczność",
  percepcja: "Percepcja",
  charakter: "Charakter",
  spryt: "Spryt",
  budowa: "Budowa"
};

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

  // Gotowy rzut publikujemy na czacie jako wiadomość przypisaną do postaci.
  await roll.toMessage({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: `<strong>Test: ${attributeLabel}</strong><br>Wartość końcowa: ${attribute.value}`
  });
}
