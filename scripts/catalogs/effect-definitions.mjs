const ATTRIBUTE_EFFECT_KEYS = {
  ATR_BUD: "budowa",
  ATR_ZRE: "zrecznosc",
  ATR_CHA: "charakter",
  ATT_CHA: "charakter",
  ATR_SPR: "spryt",
  ATT_SPR: "spryt",
  ATR_PER: "percepcja",
  ATT_PER: "percepcja"
};

const SKILL_EFFECT_KEYS = {
  SKILL_KONDYCJA: "kondycja",
  SKILL_PLYWANIE: "plywanie",
  SKILL_WSPINACZKA: "wspinaczka",
  SKILL_JAZDAKONNO: "jazdaKonna",
  SKILL_POWOZENIE: "powozenie",
  SKILL_UJEZDZANIE: "ujezdzanie",
  SKILL_BIJATYKA: "bijatyka",
  SKILL_BRONRECZNA: "bronReczna",
  SKILL_RZUCANIE: "rzucanie",
  SKILL_SAMOCHOD: "samochod",
  SKILL_MOTOCYKL: "motocykl",
  SKILL_CIEZAROWKA: "ciezarowka",
  SKILL_KRADZIEZKIESZONKOWA: "kradziezKieszonkowa",
  SKILL_OTWIERANIEZAMKOW: "otwieranieZamkow",
  SKILL_ZWINNEDLONIE: "zwinneDlonie",
  SKILL_PISTOLETY: "pistolety",
  SKILL_KARABINY: "karabiny",
  SKILL_BRONMASZYNOWA: "bronMaszynowa",
  SKILL_LUK: "luk",
  SKILL_KUSZA: "kusza",
  SKILL_PROCA: "proca",
  SKILL_ZASTRASZANIE: "zastraszanie",
  SKILL_PERSWAZJA: "perswazja",
  SKILL_ZDOLNOSCIPRZYWODCZE: "zdolnosciPrzywodcze",
  SKILL_POSTRZEGANIEEMOCJI: "postrzeganieEmocji",
  SKILL_BLEF: "blef",
  SKILL_OPIEKANADZWIERZETAMI: "opiekaNadZwierzetami",
  SKILL_ODPORNOSCNABOL: "odpornoscNaBol",
  SKILL_NIEZLOMNOSC: "niezlomnosc",
  SKILL_MORALE: "morale",
  SKILL_PIERWSZAPOMOC: "pierwszaPomoc",
  SKILL_LECZENIERAN: "leczenieRan",
  SKILL_LECZENIECHOROB: "leczenieChorob",
  SKILL_MECHANIKA: "mechanika",
  SKILL_ELEKTRONIKA: "elektronika",
  SKILL_KOMPUTERY: "komputery",
  SKILL_MASZYNYCIEZKIE: "maszynyCiezkie",
  SKILL_WOZYBOJOWE: "wozyBojowe",
  SKILL_KUTRY: "kutry",
  SKILL_RUSZNIKARSTWO: "rusznikarstwo",
  SKILL_WYRZUTNIE: "wyrzutnie",
  SKILL_MATERIALYWYBUCHOWE: "materialyWybuchowe",
  SKILL_WYCZUCIEKIERUNKU: "wyczucieKierunku",
  SKILL_PRZYGOTOWANIEPULAPKI: "przygotowaniePulapki",
  SKILL_TROPIENIE: "tropienie",
  SKILL_NASLUCHIWANIE: "nasluchiwanie",
  SKILL_WYPATRYWANIE: "wypatrywanie",
  SKILL_CZUJNOSC: "czujnosc",
  SKILL_SKRADANIESIE: "skradanieSie",
  SKILL_UKRYWANIESIE: "ukrywanieSie",
  SKILL_MASKOWANIE: "maskowanie",
  SKILL_LOWIECTWO: "lowiectwo",
  SKILL_ZNAJOMOSCTERENU: "znajomoscTerenu",
  SKILL_ZDOBYWANIEWODY: "zdobywanieWody"
};

function normalizeEffectCode(effectCode) {
  return String(effectCode ?? "").trim().replace(/_BONUS$/, "");
}

export function getEffectAutomationDefinition(effectCode) {
  const normalizedCode = normalizeEffectCode(effectCode);
  const attributeKey = ATTRIBUTE_EFFECT_KEYS[normalizedCode];
  if (attributeKey) {
    return {
      effectCode: normalizedCode,
      scope: `attribute.${attributeKey}`,
      valueMode: "direct"
    };
  }

  const skillKey = SKILL_EFFECT_KEYS[normalizedCode];
  if (skillKey) {
    return {
      effectCode: normalizedCode,
      scope: `test.skill.${skillKey}`,
      // W źródle dodatnia wartość jest premią. Silnik PT przechowuje dodatnią
      // karę, dlatego znak odwracamy podczas tworzenia modyfikatora.
      valueMode: "invertedTestPercentage"
    };
  }

  return null;
}

export function convertEffectValue(definition, sourceValue) {
  const numericValue = Math.trunc(Number(sourceValue) || 0);
  return definition?.valueMode === "invertedTestPercentage"
    ? -numericValue
    : numericValue;
}

export function parseEffectCodes(effectText, source) {
  const modifiers = [];
  const unsupportedCodes = [];

  for (const rawPart of String(effectText ?? "").split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    // Część danych chorób pomija dwukropek, np. ATR_ZRE-4.
    const match = part.match(/^([A-Z][A-Z0-9_]*?)\s*:?[ ]*([+-]?\d+)$/);
    if (!match) {
      unsupportedCodes.push(part);
      continue;
    }

    const [, effectCode, value] = match;
    const definition = getEffectAutomationDefinition(effectCode);
    if (!definition) {
      unsupportedCodes.push(part);
      continue;
    }

    modifiers.push({
      id: "",
      source,
      scope: definition.scope,
      value: convertEffectValue(definition, value),
      expiresAt: ""
    });
  }

  return { modifiers, unsupportedCodes };
}

const DISEASE_SUMMARY_ATTRIBUTE_KEYS = {
  budowa: "budowa",
  zręczność: "zrecznosc",
  charakter: "charakter",
  spryt: "spryt",
  percepcja: "percepcja"
};

const SOCIAL_TEST_SKILL_KEYS = [
  "zastraszanie",
  "perswazja",
  "zdolnosciPrzywodcze",
  "blef"
];

function createParsedModifier(source, scope, value, id = "", note = "") {
  return {
    id,
    source,
    scope,
    value: Math.trunc(Number(value) || 0),
    note: String(note ?? "").trim(),
    expiresAt: ""
  };
}

// Starsze rekordy chorób nie mają kodów EFFECT. Wyciągamy wyłącznie proste,
// jednoznaczne zapisy liczbowe, a resztę pozostawiamy jako tekst zasad.
export function parseDiseaseSummaryModifiers(summaryText, source) {
  const summary = String(summaryText ?? "");
  const modifiers = [];
  const attributePattern = /(Budowa|Zręczność|Charakter|Spryt|Percepcja)\s*:?\s*([+-]\d+)/giu;

  for (const match of summary.matchAll(attributePattern)) {
    const followingText = summary.slice(match.index + match[0].length);
    // „Budowa -3 przy testach ruchowych” nie jest globalną zmianą Budowy.
    // Taki warunek pozostawiamy w zasadach opisowych do ręcznego rozpisania.
    if (/^\s+(?:w|przy)\s+testach/iu.test(followingText)) continue;
    const attributeKey = DISEASE_SUMMARY_ATTRIBUTE_KEYS[match[1].toLocaleLowerCase("pl")];
    if (!attributeKey) continue;
    modifiers.push(createParsedModifier(source, `attribute.${attributeKey}`, match[2]));
  }

  const allTestsMatch = summary.match(/([+-]\d+)%\s+do wszystkich testów/iu);
  if (allTestsMatch) {
    modifiers.push(createParsedModifier(source, "test.all", allTestsMatch[1]));
  }

  const conditioningMatch = summary.match(/testy\s+Kondycji\s*([+-]\d+)%/iu);
  if (conditioningMatch) {
    modifiers.push(createParsedModifier(
      source,
      "test.skill.kondycja",
      conditioningMatch[1]
    ));
  }

  const socialTestsMatch = summary.match(/testy kontaktów z ludźmi\s*([+-]\d+)%/iu);
  if (socialTestsMatch) {
    for (const skillKey of SOCIAL_TEST_SKILL_KEYS) {
      modifiers.push(createParsedModifier(
        source,
        `test.skill.${skillKey}`,
        socialTestsMatch[1]
      ));
    }
  }

  return modifiers;
}

export function prepareDiseaseStageModifiers(stage, source) {
  const storedModifiers = [...(stage?.modifiers ?? [])];
  if (stage?.modifiersConfigured || storedModifiers.length) {
    return storedModifiers.map((modifier) => createParsedModifier(
      source,
      modifier.scope,
      modifier.value,
      modifier.id,
      modifier.note
    ));
  }

  const codedModifiers = parseEffectCodes(stage?.effect, source).modifiers;
  if (codedModifiers.length) return codedModifiers;

  return parseDiseaseSummaryModifiers(stage?.summary, source);
}
