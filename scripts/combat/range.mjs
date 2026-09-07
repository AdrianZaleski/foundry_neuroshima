const RANGE_TABLES = {
  pistol: {
    label: "P — pistolety",
    bands: [[10, 0], [20, 20], [30, 40], [40, 80], [60, 120], [80, 160]]
  },
  machinePistol: {
    label: "PM — pistolety maszynowe",
    bands: [[10, 0], [20, 10], [30, 20], [40, 30], [60, 40], [80, 60], [100, 80], [150, 120], [200, 160]]
  },
  rifle: {
    label: "K — karabiny i karabinki",
    bands: [[10, 0], [20, 0], [30, 10], [40, 10], [60, 20], [80, 20], [100, 30], [150, 40], [200, 60], [250, 80], [300, 120], [400, 160]]
  },
  sniper: {
    label: "S — karabiny wyborowe",
    bands: [[10, 0], [20, 0], [30, 10], [40, 10], [60, 20], [80, 20], [100, 30], [150, 30], [200, 40], [250, 40], [300, 60], [400, 80], [600, 100], [1000, 120], [1500, 160]]
  },
  shotgun: {
    label: "ŚR — śrutówki",
    bands: [[10, -30], [20, 0], [30, 30]]
  }
};

const RANGE_GROUP_BY_WEAPON_CLASS = {
  PISTOL: "pistol",
  REVOLVER: "pistol",
  BLACKPOWDER: "pistol",
  MPISTOL: "machinePistol",
  ARIFLE: "rifle",
  MACHINEGUN: "rifle",
  RIFLE: "rifle",
  REPEATER: "rifle",
  LAUNCHER: "machinePistol",
  SNIPER: "sniper",
  SHOTGUN: "shotgun"
};

export function getRangeTableForWeaponClass(weaponClass) {
  const rangeGroup = RANGE_GROUP_BY_WEAPON_CLASS[String(weaponClass ?? "")];
  if (!rangeGroup) return null;
  return { rangeGroup, ...RANGE_TABLES[rangeGroup] };
}

function getRangeTableForWeapon(weapon) {
  const weaponClass = String(weapon?.system?.weaponClass ?? "");
  const normalizedName = String(weapon?.name ?? "").toLocaleLowerCase("pl");

  // Tabela podręcznika umieszcza samopały karabinowe i Winchestery w grupie
  // PM, mimo że katalog przedmiotów klasyfikuje je szerzej jako karabiny.
  if (
    (weaponClass === "RIFLE" && normalizedName.includes("samopał"))
    || (weaponClass === "REPEATER" && normalizedName.includes("winchester"))
  ) {
    return { rangeGroup: "machinePistol", ...RANGE_TABLES.machinePistol };
  }

  return getRangeTableForWeaponClass(weaponClass);
}

export function calculateRangeModifier(weapon, distanceMeters) {
  const numericDistance = Number(distanceMeters);
  const table = getRangeTableForWeapon(weapon);
  if (!table || !Number.isFinite(numericDistance) || numericDistance < 0) {
    return { supported: false, inRange: false, distanceMeters: numericDistance };
  }

  const tableMaximum = table.bands.at(-1)[0];
  const weaponMaximum = Number(weapon.system.range) > 0
    ? Number(weapon.system.range)
    : tableMaximum;
  const maximumDistance = Math.min(tableMaximum, weaponMaximum);
  const matchingBand = table.bands.find(([maximum]) => (
    numericDistance <= maximum && maximum <= tableMaximum
  ));

  if (!matchingBand || numericDistance > maximumDistance) {
    return {
      supported: true,
      inRange: false,
      rangeGroup: table.rangeGroup,
      rangeLabel: table.label,
      distanceMeters: numericDistance,
      maximumDistance
    };
  }

  const [bandMaximum, modifierPercent] = matchingBand;
  return {
    supported: true,
    inRange: true,
    rangeGroup: table.rangeGroup,
    rangeLabel: table.label,
    distanceMeters: numericDistance,
    maximumDistance,
    bandMaximum,
    modifierPercent
  };
}

function convertSceneDistanceToMeters(distance, unit) {
  const normalizedUnit = String(unit ?? "").trim().toLocaleLowerCase("pl");
  if (["km", "kilometr", "kilometry", "kilometrów"].includes(normalizedUnit)) {
    return distance * 1000;
  }
  if (["ft", "foot", "feet", "stopa", "stopy", "stóp"].includes(normalizedUnit)) {
    return distance * 0.3048;
  }
  if (["yd", "yard", "yards", "jard", "jardy", "jardów"].includes(normalizedUnit)) {
    return distance * 0.9144;
  }
  // Metry oraz puste lub własne jednostki sceny traktujemy jak metry. Dzięki
  // temu standardowe mapy Neuroshimy nie wymagają dodatkowej konfiguracji.
  return distance;
}

export function measureTokenDistanceMeters(sourceToken, targetToken) {
  const activeCanvas = globalThis.canvas;
  if (!sourceToken?.center || !targetToken?.center || !activeCanvas?.grid?.measurePath) {
    return null;
  }
  const measurement = activeCanvas.grid.measurePath([
    sourceToken.center,
    targetToken.center
  ]);
  const sceneDistance = Number(measurement?.distance);
  if (!Number.isFinite(sceneDistance)) return null;
  const meters = convertSceneDistanceToMeters(
    sceneDistance,
    activeCanvas.grid?.units ?? activeCanvas.scene?.grid?.units
  );
  return Math.round(meters * 10) / 10;
}
