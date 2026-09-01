export const COMBAT_ACTIONS = {
  shot: {
    name: "Strzał",
    duration: 1,
    requiresTest: true
  },
  aiming: {
    name: "Celowanie",
    duration: null,
    requiresTest: false
  },
  safetyOff: {
    name: "Odbezpieczenie broni",
    duration: 1,
    requiresTest: false
  },
  pumpAction: {
    name: "Przeładowanie pompki",
    duration: 1,
    requiresTest: false
  },
  kneel: {
    name: "Przyklęknięcie",
    duration: 1,
    requiresTest: false
  },
  dropProne: {
    name: "Pad na ziemię",
    duration: 1,
    requiresTest: false
  },
  leanFromCover: {
    name: "Wychylenie zza osłony",
    duration: 1,
    requiresTest: false
  },
  returnToCover: {
    name: "Schowanie za osłonę",
    duration: 1,
    requiresTest: false
  },
  runOrJump: {
    name: "Bieg lub skok",
    duration: 1,
    requiresTest: false
  },
  crawl: {
    name: "Czołganie",
    duration: 1,
    requiresTest: false
  },
  spotHiddenTarget: {
    name: "Wypatrzenie ukrytego przeciwnika",
    duration: 1,
    requiresTest: true
  },
  bowShot: {
    name: "Strzał z łuku",
    duration: 2,
    requiresTest: true
  },
  throwKnife: {
    name: "Rzut nożem",
    duration: 2,
    requiresTest: true
  },
  drawWeapon: {
    name: "Dobycie broni",
    duration: 2,
    requiresTest: false
  },
  readyWeapon: {
    name: "Przygotowanie broni",
    duration: 2,
    requiresTest: false
  },
  standFromKneeling: {
    name: "Powstanie z przyklęku",
    duration: 2,
    requiresTest: false
  },
  changeMagazine: {
    name: "Zmiana magazynka",
    duration: 3,
    requiresTest: false
  },
  standFromProne: {
    name: "Podniesienie się z pozycji leżącej",
    duration: 3,
    requiresTest: false
  },
  loadSling: {
    name: "Załadowanie procy",
    duration: 3,
    requiresTest: false
  },
  nockArrow: {
    name: "Dobycie i założenie strzały",
    duration: 3,
    requiresTest: false
  },
  loadRevolverRound: {
    name: "Załadowanie jednego naboju do bębna",
    duration: 3,
    requiresTest: false
  }
};

export function prepareCombatActionOptions() {
  const groupedActions = new Map([
    [1, []],
    [2, []],
    [3, []],
    ["variable", []]
  ]);

  for (const [actionCode, action] of Object.entries(COMBAT_ACTIONS)) {
    const groupKey = action.duration ?? "variable";
    groupedActions.get(groupKey).push({ actionCode, ...action });
  }

  const fixedGroups = [1, 2, 3].map((duration) => {
    const options = groupedActions.get(duration).map((action) => {
      const testLabel = action.requiresTest ? " — wymaga testu" : "";
      return `<option value="${action.actionCode}">${action.name}${testLabel}</option>`;
    }).join("");
    return `<optgroup label="Akcje za ${duration} ${duration === 1 ? "segment" : "segmenty"}">${options}</optgroup>`;
  });

  const variableOptions = groupedActions.get("variable").map((action) => (
    `<option value="${action.actionCode}">${action.name} — koszt wybierany</option>`
  )).join("");

  return [
    ...fixedGroups,
    `<optgroup label="Koszt wybierany">${variableOptions}<option value="custom">Własna akcja</option></optgroup>`
  ].join("");
}

export function resolveCombatAction(actionCode, customName, selectedDuration) {
  const catalogAction = COMBAT_ACTIONS[actionCode];
  const variableDuration = Math.max(1, Math.min(Number(selectedDuration) || 1, 3));

  if (!catalogAction) {
    return {
      actionCode: "custom",
      name: String(customName ?? "").trim(),
      duration: variableDuration,
      requiresTest: false,
      isCustom: true
    };
  }

  return {
    actionCode,
    name: catalogAction.name,
    duration: catalogAction.duration ?? variableDuration,
    requiresTest: catalogAction.requiresTest,
    isCustom: false
  };
}
