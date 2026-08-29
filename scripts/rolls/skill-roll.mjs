import {
  DIFFICULTY_LABELS,
  DIFFICULTY_MODIFIERS,
  calculateFinalDifficultyIndex,
  prepareTestResultMessage,
  prepareTestVerdictMessage,
  selectTestConfiguration
} from "./roll-helpers.mjs";

const ATTRIBUTE_LABELS = {
  zrecznosc: "Zręczność",
  percepcja: "Percepcja",
  charakter: "Charakter",
  spryt: "Spryt",
  budowa: "Budowa"
};

// Funkcja pomocnicza tworzy powiązanie umiejętności ze współczynnikiem.
// Dzięki niej nie powtarzamy dla każdego wpisu trzech identycznych właściwości.
function createSkillConfiguration(
  skillLabel,
  attributeKey,
  attributeLabel,
  usesCustomName = false,
  usesCustomAttribute = false
) {
  return {
    label: skillLabel,
    attributeKey,
    attributeLabel,
    usesCustomName,
    usesCustomAttribute
  };
}

// Każda standardowa umiejętność ma stałą nazwę i przypisany współczynnik.
const SKILL_CONFIGURATION = {
  bijatyka: createSkillConfiguration("Bijatyka", "zrecznosc", "Zręczność"),
  bronReczna: createSkillConfiguration("Broń ręczna", "zrecznosc", "Zręczność"),
  rzucanie: createSkillConfiguration("Rzucanie", "zrecznosc", "Zręczność"),
  pistolety: createSkillConfiguration("Pistolety", "zrecznosc", "Zręczność"),
  karabiny: createSkillConfiguration("Karabiny", "zrecznosc", "Zręczność"),
  bronMaszynowa: createSkillConfiguration("Broń maszynowa", "zrecznosc", "Zręczność"),
  luk: createSkillConfiguration("Łuk", "zrecznosc", "Zręczność"),
  kusza: createSkillConfiguration("Kusza", "zrecznosc", "Zręczność"),
  proca: createSkillConfiguration("Proca", "zrecznosc", "Zręczność"),
  samochod: createSkillConfiguration("Samochód", "zrecznosc", "Zręczność"),
  ciezarowka: createSkillConfiguration("Ciężarówka", "zrecznosc", "Zręczność"),
  motocykl: createSkillConfiguration("Motocykl", "zrecznosc", "Zręczność"),
  kradziezKieszonkowa: createSkillConfiguration("Kradzież kieszonkowa", "zrecznosc", "Zręczność"),
  zwinneDlonie: createSkillConfiguration("Zwinne dłonie", "zrecznosc", "Zręczność"),
  otwieranieZamkow: createSkillConfiguration("Otwieranie zamków", "zrecznosc", "Zręczność"),
  wyczucieKierunku: createSkillConfiguration("Wyczucie kierunku", "percepcja", "Percepcja"),
  tropienie: createSkillConfiguration("Tropienie", "percepcja", "Percepcja"),
  przygotowaniePulapki: createSkillConfiguration("Przygotowanie pułapki", "percepcja", "Percepcja"),
  nasluchiwanie: createSkillConfiguration("Nasłuchiwanie", "percepcja", "Percepcja"),
  wypatrywanie: createSkillConfiguration("Wypatrywanie/Przeszukiwanie", "percepcja", "Percepcja"),
  czujnosc: createSkillConfiguration("Czujność", "percepcja", "Percepcja"),
  skradanieSie: createSkillConfiguration("Skradanie się", "percepcja", "Percepcja"),
  ukrywanieSie: createSkillConfiguration("Ukrywanie się", "percepcja", "Percepcja"),
  maskowanie: createSkillConfiguration("Maskowanie", "percepcja", "Percepcja"),
  lowiectwo: createSkillConfiguration("Łowiectwo", "percepcja", "Percepcja"),
  zdobywanieWody: createSkillConfiguration("Zdobywanie wody", "percepcja", "Percepcja"),
  znajomoscTerenu: createSkillConfiguration("Znajomość terenu", "percepcja", "Percepcja"),
  perswazja: createSkillConfiguration("Perswazja", "charakter", "Charakter"),
  zastraszanie: createSkillConfiguration("Zastraszanie", "charakter", "Charakter"),
  zdolnosciPrzywodcze: createSkillConfiguration("Zdolności przywódcze", "charakter", "Charakter"),
  postrzeganieEmocji: createSkillConfiguration("Postrzeganie emocji", "charakter", "Charakter"),
  blef: createSkillConfiguration("Blef", "charakter", "Charakter"),
  opiekaNadZwierzetami: createSkillConfiguration("Opieka nad zwierzętami", "charakter", "Charakter"),
  odpornoscNaBol: createSkillConfiguration("Odporność na ból", "charakter", "Charakter"),
  niezlomnosc: createSkillConfiguration("Niezłomność", "charakter", "Charakter"),
  morale: createSkillConfiguration("Morale", "charakter", "Charakter"),
  leczenieRan: createSkillConfiguration("Leczenie ran", "spryt", "Spryt"),
  leczenieChorob: createSkillConfiguration("Leczenie chorób", "spryt", "Spryt"),
  pierwszaPomoc: createSkillConfiguration("Pierwsza pomoc", "spryt", "Spryt"),
  mechanika: createSkillConfiguration("Mechanika", "spryt", "Spryt"),
  elektronika: createSkillConfiguration("Elektronika", "spryt", "Spryt"),
  komputery: createSkillConfiguration("Komputery", "spryt", "Spryt"),
  maszynyCiezkie: createSkillConfiguration("Maszyny ciężkie", "spryt", "Spryt"),
  wozyBojowe: createSkillConfiguration("Wozy bojowe", "spryt", "Spryt"),
  kutry: createSkillConfiguration("Kutry", "spryt", "Spryt"),
  rusznikarstwo: createSkillConfiguration("Rusznikarstwo", "spryt", "Spryt"),
  wyrzutnie: createSkillConfiguration("Wyrzutnie", "spryt", "Spryt"),
  materialyWybuchowe: createSkillConfiguration("Materiały wybuchowe", "spryt", "Spryt"),
  wiedzaOgolna1: createSkillConfiguration("Wiedza ogólna 1", "spryt", "Spryt", true),
  wiedzaOgolna2: createSkillConfiguration("Wiedza ogólna 2", "spryt", "Spryt", true),
  wiedzaOgolna3: createSkillConfiguration("Wiedza ogólna 3", "spryt", "Spryt", true),
  wiedzaOgolna4: createSkillConfiguration("Wiedza ogólna 4", "spryt", "Spryt", true),
  wiedzaOgolna5: createSkillConfiguration("Wiedza ogólna 5", "spryt", "Spryt", true),
  wiedzaOgolna6: createSkillConfiguration("Wiedza ogólna 6", "spryt", "Spryt", true),
  plywanie: createSkillConfiguration("Pływanie", "budowa", "Budowa"),
  wspinaczka: createSkillConfiguration("Wspinaczka", "budowa", "Budowa"),
  kondycja: createSkillConfiguration("Kondycja", "budowa", "Budowa"),
  jazdaKonna: createSkillConfiguration("Jazda konna", "budowa", "Budowa"),
  powozenie: createSkillConfiguration("Powożenie", "budowa", "Budowa"),
  ujezdzanie: createSkillConfiguration("Ujeżdżanie", "budowa", "Budowa"),
  wlasnaUmiejetnosc1: createSkillConfiguration("Własna umiejętność 1", "zrecznosc", "Zręczność", true, true),
  wlasnaUmiejetnosc2: createSkillConfiguration("Własna umiejętność 2", "zrecznosc", "Zręczność", true, true),
  wlasnaUmiejetnosc3: createSkillConfiguration("Własna umiejętność 3", "zrecznosc", "Zręczność", true, true)
};

function calculateDifficultyIndexBeforeCriticalResults(startingDifficultyIndex, skillLevel) {
  // Brak umiejętności utrudnia test o jeden poziom.
  if (skillLevel === 0) {
    return startingDifficultyIndex + 1;
  }

  // W zwykłym teście każde pełne 4 punkty umiejętności
  // ułatwiają test o jeden poziom zgodnie z zasadą Suwaka.
  const numberOfSliderSteps = Math.floor(skillLevel / 4);
  return startingDifficultyIndex - numberOfSliderSteps;
}

function prepareSliderDescription(skillLevel) {
  if (skillLevel === 0) {
    return "utrudnienie o 1 poziom za brak umiejętności";
  }

  const numberOfSliderSteps = Math.floor(skillLevel / 4);

  if (numberOfSliderSteps === 0) {
    return "bez zmiany poziomu trudności";
  }

  const levelWord = numberOfSliderSteps === 1 ? "poziom" : "poziomy";
  return `ułatwienie o ${numberOfSliderSteps} ${levelWord}`;
}

function applySkillToDieResults(dieResults, successThreshold, skillLevel) {
  // Zachowujemy pierwotną pozycję każdej kości, aby po obliczeniach
  // wyświetlić wyniki w tej samej kolejności, w której zostały wyrzucone.
  const evaluatedDieResults = dieResults.map((naturalResult, originalIndex) => ({
    naturalResult,
    adjustedResult: naturalResult,
    originalIndex,
    usedSkillPoints: 0
  }));

  const sortedDieResults = [...evaluatedDieResults].sort(
    (firstDie, secondDie) => firstDie.naturalResult - secondDie.naturalResult
  );

  let remainingSkillPoints = skillLevel;

  // Najpierw poprawiamy kości wymagające najmniejszej liczby punktów.
  // W ten sposób automatycznie uzyskujemy największą możliwą liczbę sukcesów.
  for (const dieResult of sortedDieResults) {
    const requiredSkillPoints = Math.max(0, dieResult.naturalResult - successThreshold);

    if (requiredSkillPoints <= remainingSkillPoints) {
      dieResult.adjustedResult -= requiredSkillPoints;
      dieResult.usedSkillPoints = requiredSkillPoints;
      remainingSkillPoints -= requiredSkillPoints;
    }
  }

  // Podręcznik wymaga rozdzielenia całego poziomu umiejętności.
  // Jeżeli zostały punkty, dokładamy je do najłatwiejszej niezdanej kości.
  // Gdy wszystkie kości są już zdane, obniżamy najwyższy z ich wyników.
  if (remainingSkillPoints > 0) {
    const failedDieResult = sortedDieResults.find(
      (dieResult) => dieResult.adjustedResult > successThreshold
    );
    const selectedDieResult = failedDieResult ?? sortedDieResults[sortedDieResults.length - 1];

    selectedDieResult.adjustedResult -= remainingSkillPoints;
    selectedDieResult.usedSkillPoints += remainingSkillPoints;
    remainingSkillPoints = 0;
  }

  return evaluatedDieResults.sort(
    (firstDie, secondDie) => firstDie.originalIndex - secondDie.originalIndex
  );
}

function prepareSkillDieResultsDescription(evaluatedDieResults, successThreshold) {
  return evaluatedDieResults
    .map((dieResult) => {
      const resultDescription = dieResult.adjustedResult <= successThreshold ? "sukces" : "porażka";

      if (dieResult.usedSkillPoints > 0) {
        return `${dieResult.naturalResult} → ${dieResult.adjustedResult} (${resultDescription}, użyto ${dieResult.usedSkillPoints})`;
      }

      return `${dieResult.naturalResult} (${resultDescription})`;
    })
    .join(", ");
}

function applySkillToOpenTestDieResults(dieResults, skillLevel) {
  const sortedDieResults = dieResults
    .map((naturalResult) => ({
      naturalResult,
      adjustedResult: naturalResult,
      usedSkillPoints: 0
    }))
    .sort((firstDie, secondDie) => firstDie.naturalResult - secondDie.naturalResult);

  // Najwyższa kość nie bierze udziału w dalszym rozstrzyganiu testu otwartego.
  const consideredDieResults = sortedDieResults.slice(0, 2);
  const discardedDieResult = sortedDieResults[2];

  // Każdy punkt umiejętności obniża aktualnie gorszą z dwóch kości.
  // Przy remisie punkty trafiają naprzemiennie, ponieważ po każdym obniżeniu
  // ponownie wybieramy kość z wyższym wynikiem.
  for (let usedSkillPoint = 0; usedSkillPoint < skillLevel; usedSkillPoint += 1) {
    const selectedDieResult = consideredDieResults[0].adjustedResult >= consideredDieResults[1].adjustedResult
      ? consideredDieResults[0]
      : consideredDieResults[1];

    selectedDieResult.adjustedResult -= 1;
    selectedDieResult.usedSkillPoints += 1;
  }

  return {
    consideredDieResults,
    discardedDieResult
  };
}

export async function rollSkill(actor, skillKey) {
  const skillConfiguration = SKILL_CONFIGURATION[skillKey];
  const skill = actor.system.skills[skillKey];

  if (!skillConfiguration || !skill) {
    ui.notifications.error("Nie znaleziono wybranej umiejętności.");
    return;
  }

  const selectedAttributeKey = skillConfiguration.usesCustomAttribute
    ? skill.attributeKey
    : skillConfiguration.attributeKey;
  const selectedAttributeLabel = ATTRIBUTE_LABELS[selectedAttributeKey];
  const attribute = actor.system.attributes[selectedAttributeKey];

  if (!attribute || !selectedAttributeLabel) {
    ui.notifications.error("Wybrana umiejętność nie ma prawidłowego współczynnika.");
    return;
  }

  const customSkillName = skillConfiguration.usesCustomName ? skill.name.trim() : "";
  const displayedSkillName = customSkillName || skillConfiguration.label;
  const testConfiguration = await selectTestConfiguration();

  if (testConfiguration === null) {
    return;
  }

  const { testType, startingDifficultyIndex } = testConfiguration;

  // Wartość końcowa może być zmieniana przez efekty, ale nie może spaść poniżej zera.
  const skillLevel = Math.max(0, skill.value);
  const difficultyIndexBeforeCriticalResults = calculateDifficultyIndexBeforeCriticalResults(
    startingDifficultyIndex,
    skillLevel
  );

  const roll = await new foundry.dice.Roll("3d20").evaluate();
  const dieResults = roll.dice[0].results.map((dieResultData) => dieResultData.result);
  const finalDifficultyIndex = calculateFinalDifficultyIndex(
    dieResults,
    difficultyIndexBeforeCriticalResults
  );

  const successThreshold = attribute.value - DIFFICULTY_MODIFIERS[finalDifficultyIndex];
  let resultDescriptionLines;

  if (testType === "open") {
    const openTestResults = applySkillToOpenTestDieResults(dieResults, skillLevel);
    const decisiveDieResult = Math.max(
      ...openTestResults.consideredDieResults.map((dieResult) => dieResult.adjustedResult)
    );
    const pointsDifference = successThreshold - decisiveDieResult;
    const testPassed = pointsDifference >= 0;
    const pointsDescription = testPassed
      ? `Punkty Sukcesu: ${pointsDifference}`
      : `Punkty Porażki: ${Math.abs(pointsDifference)}`;
    const consideredDiceDescription = prepareSkillDieResultsDescription(
      openTestResults.consideredDieResults,
      successThreshold
    );

    resultDescriptionLines = [
      "Rodzaj testu: Otwarty",
      `Rozpatrywane kości: ${consideredDiceDescription}`,
      `Odrzucona najwyższa kość: ${openTestResults.discardedDieResult.naturalResult}`,
      `<strong>${pointsDescription}</strong>`,
      prepareTestVerdictMessage(testPassed)
    ];
  } else {
    const evaluatedDieResults = applySkillToDieResults(dieResults, successThreshold, skillLevel);
    const numberOfSuccesses = evaluatedDieResults.filter(
      (dieResult) => dieResult.adjustedResult <= successThreshold
    ).length;
    const dieResultsDescription = prepareSkillDieResultsDescription(
      evaluatedDieResults,
      successThreshold
    );

    resultDescriptionLines = [
      "Rodzaj testu: Zamknięty",
      `Kości: ${dieResultsDescription}`,
      `<strong>Liczba sukcesów: ${numberOfSuccesses}</strong>`,
      prepareTestResultMessage(numberOfSuccesses)
    ];
  }

  await roll.toMessage({
    speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: [
      `<strong>Test umiejętności: ${displayedSkillName}</strong>`,
      `Współczynnik: ${selectedAttributeLabel} (${attribute.value})`,
      `Poziom umiejętności: ${skillLevel}`,
      `Suwak: ${prepareSliderDescription(skillLevel)}`,
      `Początkowy poziom trudności: ${DIFFICULTY_LABELS[startingDifficultyIndex]}`,
      `Ostateczny poziom trudności: ${DIFFICULTY_LABELS[finalDifficultyIndex]}`,
      `Próg sukcesu: ${successThreshold}`,
      ...resultDescriptionLines
    ].join("<br>")
  });
}
