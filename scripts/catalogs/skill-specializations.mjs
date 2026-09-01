// Specjalizacje obejmują całe grupy umiejętności. Mapa pochodzi z poprzedniej
// karty Roll20 i używa stabilnych kodów katalogowych zapisanych na Actorze.
const SKILL_GROUPS = {
  walkaWrecz: ["bijatyka", "bronReczna", "rzucanie"],
  bronStrzelecka: ["pistolety", "karabiny", "bronMaszynowa"],
  bronDystansowa: ["luk", "kusza", "proca"],
  prowadzeniePojazdow: ["samochod", "ciezarowka", "motocykl"],
  zdolnosciManualne: ["kradziezKieszonkowa", "zwinneDlonie", "otwieranieZamkow"],
  orientacjaWTerenie: ["wyczucieKierunku", "tropienie", "przygotowaniePulapki"],
  spostrzegawczosc: ["nasluchiwanie", "wypatrywanie", "czujnosc"],
  kamuflaz: ["skradanieSie", "ukrywanieSie", "maskowanie"],
  przetrwanie: ["lowiectwo", "zdobywanieWody", "znajomoscTerenu"],
  negocjacje: ["perswazja", "zastraszanie", "zdolnosciPrzywodcze"],
  empatia: ["postrzeganieEmocji", "blef", "opiekaNadZwierzetami"],
  silaWoli: ["odpornoscNaBol", "niezlomnosc", "morale"],
  medycyna: ["leczenieRan", "leczenieChorob", "pierwszaPomoc"],
  technika: ["mechanika", "elektronika", "komputery"],
  sprzet: ["maszynyCiezkie", "wozyBojowe", "kutry"],
  pirotechnika: ["rusznikarstwo", "wyrzutnie", "materialyWybuchowe"],
  wiedzaOgolnaPierwsza: ["wiedzaOgolna1", "wiedzaOgolna2", "wiedzaOgolna3"],
  wiedzaOgolnaDruga: ["wiedzaOgolna4", "wiedzaOgolna5", "wiedzaOgolna6"],
  sprawnosc: ["plywanie", "wspinaczka", "kondycja"],
  jezdziectwo: ["jazdaKonna", "powozenie", "ujezdzanie"]
};

const SPECIALIZATION_GROUPS = {
  SPEC_TECH: [
    "prowadzeniePojazdow",
    "medycyna",
    "technika",
    "wiedzaOgolnaPierwsza",
    "sprzet",
    "pirotechnika"
  ],
  SPEC_WARRIOR: [
    "walkaWrecz",
    "bronStrzelecka",
    "bronDystansowa",
    "silaWoli",
    "pirotechnika"
  ],
  SPEC_RANGER: [
    "sprawnosc",
    "jezdziectwo",
    "bronDystansowa",
    "medycyna",
    "orientacjaWTerenie",
    "spostrzegawczosc",
    "kamuflaz",
    "przetrwanie"
  ],
  SPEC_ROGUE: [
    "zdolnosciManualne",
    "negocjacje",
    "empatia",
    "kamuflaz"
  ]
};

export const SPECIALIZATION_LABELS = {
  SPEC_TECH: "Technik",
  SPEC_WARRIOR: "Wojownik",
  SPEC_RANGER: "Ranger",
  SPEC_ROGUE: "Cwaniak"
};

// Odwrócona mapa jest metadanymi każdej umiejętności. Pozwala później użyć
// tych samych powiązań również przy rozwoju postaci i liczeniu kosztów PD.
export const SPECIALIZATIONS_BY_SKILL = Object.fromEntries(
  Object.keys(SKILL_GROUPS)
    .flatMap((groupKey) => SKILL_GROUPS[groupKey])
    .map((skillKey) => [
      skillKey,
      Object.entries(SPECIALIZATION_GROUPS)
        .filter(([, groupKeys]) => groupKeys.some(
          (groupKey) => SKILL_GROUPS[groupKey].includes(skillKey)
        ))
        .map(([specializationCode]) => specializationCode)
    ])
);

export function getSpecializedSkillKeys(specializationCode) {
  return new Set(
    Object.entries(SPECIALIZATIONS_BY_SKILL)
      .filter(([, specializationCodes]) => specializationCodes.includes(specializationCode))
      .map(([skillKey]) => skillKey)
  );
}
