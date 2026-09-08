import { ATTRIBUTE_LABELS, rollAttribute } from "../rolls/attribute-roll.mjs";
import { SKILL_CONFIGURATION, rollSkill } from "../rolls/skill-roll.mjs";
import {
  promptToCreateInjuryFromRoll,
  rollPainResistanceForInjury
} from "../rolls/injury-roll.mjs";
import { ammunitionNamesBySymbol } from "../catalogs/ammunition-compatibility.mjs";
import {
  SPECIALIZATION_LABELS,
  getSpecializedSkillKeys
} from "../catalogs/skill-specializations.mjs";
import {
  damageNamesBySymbol,
  describeAttackTypes
} from "../catalogs/combat-reference.mjs";
import {
  prepareDiseaseCatalog,
  prepareMedicinesByDisease
} from "../catalogs/health-reference.mjs";
import { rollNeuroshimaInitiative } from "../combat/initiative.mjs";
import {
  advanceSegmentTurn,
  cancelCurrentSegmentActionDeclaration,
  finishSegmentAction,
  interruptSegmentAction,
  passSegment,
  prepareActorCombatStatus,
  selectSegmentAction
} from "../combat/segments.mjs";
import {
  JAM_STATE_LABELS,
  configureAiming,
  resolveSingleShot
} from "../combat/ranged-shot.mjs";
import {
  configureMinorJamClearing,
  handleWeaponJam,
  resolveMinorJamClearing
} from "../combat/weapon-jam.mjs";
import { calculateArmorPenaltyPercent } from "../combat/armor.mjs";
import { downloadCombatDiagnostics } from "../diagnostics/combat-diagnostics.mjs";
import {
  calculateAttributeValue,
  collectAutomaticModifierSources,
  escapeModifierText,
  formatSignedModifier,
  modifierIsActive
} from "../effects/modifiers.mjs";
import {
  convertEffectValue,
  getEffectAutomationDefinition,
  parseEffectCodes,
  prepareDiseaseStageModifiers
} from "../catalogs/effect-definitions.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

// Karta postaci pokazuje polskie nazwy zamiast technicznych kodów zapisanych
// w danych broni. Nieznany kod nadal zostanie pokazany, aby nie ukrywać danych.
const weaponClassNames = {
  ARIFLE: "Karabin automatyczny",
  MACHINEGUN: "Karabin maszynowy",
  RIFLE: "Karabin półautomatyczny",
  MPISTOL: "Pistolet maszynowy",
  PISTOL: "Pistolet",
  REVOLVER: "Rewolwer",
  REPEATER: "Karabin powtarzalny",
  LAUNCHER: "Granatnik",
  BLACKPOWDER: "Broń czarnoprochowa",
  PROJECTILE: "Broń miotana",
  SNIPER: "Karabin snajperski",
  SHOTGUN: "Śrutówka"
};

const injuryLocationNames = {
  general: "Ogólne / inny efekt",
  head: "Głowa",
  torso: "Tułów",
  leftArm: "Lewa ręka",
  rightArm: "Prawa ręka",
  leftLeg: "Lewa noga",
  rightLeg: "Prawa noga"
};

const injuryTypeNames = {
  abrasion: "Draśnięcie",
  light: "Rana lekka",
  serious: "Rana ciężka",
  critical: "Rana krytyczna"
};

const meleeDamageThresholdNames = {
  below10: "Budowa < 10",
  below12: "Budowa < 12",
  below13: "Budowa < 13",
  below14: "Budowa < 14",
  below15: "Budowa < 15",
  below16: "Budowa < 16",
  below18: "Budowa < 18",
  below19: "Budowa < 19"
};

const diseaseStageNames = {
  first: "Etap pierwszy",
  second: "Etap drugi",
  third: "Etap trzeci",
  terminal: "Stan terminalny"
};

const diseaseStageOrder = Object.keys(diseaseStageNames);

async function changeDiseaseStage(characterSheet, target, direction) {
  const diseaseItem = characterSheet.actor.items.get(target.dataset.itemId);
  if (!diseaseItem || diseaseItem.type !== "disease") {
    ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
    return;
  }

  const currentIndex = diseaseStageOrder.indexOf(diseaseItem.system.currentStage);
  const safeCurrentIndex = Math.max(0, currentIndex);
  const nextIndex = Math.min(
    diseaseStageOrder.length - 1,
    Math.max(0, safeCurrentIndex + direction)
  );
  if (nextIndex === currentIndex) return;

  await diseaseItem.update({ "system.currentStage": diseaseStageOrder[nextIndex] });
}

function describeMeleeDamageProfile(damageByBuild) {
  return Object.entries(meleeDamageThresholdNames)
    .filter(([damageKey]) => damageByBuild[damageKey])
    .map(([damageKey, thresholdName]) => (
      `${thresholdName}: ${damageByBuild[damageKey]}`
    ))
    .join(" | ");
}

function getDisplayedSkillName(actor, skillKey) {
  const configuration = SKILL_CONFIGURATION[skillKey];
  const skill = actor.system.skills?.[skillKey];
  if (!configuration) return skillKey;
  if (!configuration.usesCustomName) return configuration.label;
  return String(skill?.name ?? "").trim() || configuration.label;
}

function getModifierScopeLabel(actor, scope) {
  if (scope === "test.all") return "Wszystkie testy — zmiana procentowa PT";

  const [scopeType, scopeSubtype, scopeKey] = String(scope).split(".");
  if (scopeType === "attribute") {
    return `Współczynnik: ${ATTRIBUTE_LABELS[scopeSubtype] ?? scopeSubtype}`;
  }
  if (scopeType === "skill") {
    return `Poziom Umiejętności: ${getDisplayedSkillName(actor, scopeSubtype)}`;
  }
  if (scopeType === "test" && scopeSubtype === "skill") {
    return `Testy Umiejętności: ${getDisplayedSkillName(actor, scopeKey)}`;
  }
  if (scopeType === "test" && scopeSubtype === "attribute") {
    return `Testy Współczynnika: ${ATTRIBUTE_LABELS[scopeKey] ?? scopeKey}`;
  }
  return scope;
}

function describeDiseaseModifier(actor, modifier) {
  const [scopeType, scopeSubtype, scopeKey] = modifier.scope.split(".");
  const note = modifier.note ? ` (${modifier.note})` : "";
  if (scopeType === "attribute") {
    return `${ATTRIBUTE_LABELS[scopeSubtype] ?? scopeSubtype} ${formatSignedModifier(modifier.value)}${note}`;
  }
  if (scopeType === "test" && scopeSubtype === "skill") {
    const changeType = modifier.value >= 0 ? "kara" : "premia";
    return `${getDisplayedSkillName(actor, scopeKey)}: ${changeType} ${Math.abs(modifier.value)}%${note}`;
  }
  return `${getModifierScopeLabel(actor, modifier.scope)} ${formatSignedModifier(modifier.value)}${note}`;
}

function prepareModifierScopeOptions(actor, selectedScope) {
  const prepareOption = (scope, label) => {
    const selected = scope === selectedScope ? " selected" : "";
    return `<option value="${scope}"${selected}>${escapeModifierText(label)}</option>`;
  };
  const attributeOptions = Object.entries(ATTRIBUTE_LABELS)
    .map(([key, label]) => prepareOption(`attribute.${key}`, label))
    .join("");
  const skillOptions = Object.keys(actor.system.skills)
    .map((key) => prepareOption(`skill.${key}`, getDisplayedSkillName(actor, key)))
    .join("");

  return `
    <optgroup label="Trudność testu">
      ${prepareOption("test.all", "Wszystkie testy — wartość procentowa PT")}
    </optgroup>
    <optgroup label="Współczynniki — zmiana wartości">
      ${attributeOptions}
    </optgroup>
    <optgroup label="Umiejętności — zmiana poziomu">
      ${skillOptions}
    </optgroup>
    <optgroup label="Testy Umiejętności — zmiana procentowa PT">
      ${Object.keys(actor.system.skills)
        .map((key) => prepareOption(
          `test.skill.${key}`,
          getDisplayedSkillName(actor, key)
        ))
        .join("")}
    </optgroup>
  `;
}

async function prepareAutomatedEffectCatalog() {
  const compendium = game.packs.get("world.neuroshima-effects");
  if (!compendium) return [];
  await compendium.getIndex({ fields: ["system.sourceCode", "system.description"] });
  return [...compendium.index.values()]
    .map((entry) => ({
      id: entry.id ?? entry._id,
      name: entry.name,
      sourceCode: entry.system?.sourceCode ?? "",
      description: entry.system?.description ?? "",
      automation: getEffectAutomationDefinition(entry.system?.sourceCode)
    }))
    .filter((entry) => entry.automation)
    .sort((left, right) => left.name.localeCompare(right.name, "pl"));
}

async function promptForCatalogModifier(actor) {
  const definitions = await prepareAutomatedEffectCatalog();
  if (!definitions.length) {
    ui.notifications.warn(
      "Kompendium efektów nie jest jeszcze dostępne. Po dodaniu nowego typu Item uruchom ponownie Foundry."
    );
    return null;
  }
  const definitionOptions = definitions.map((definition) => (
    `<option value="${definition.id}">${escapeModifierText(definition.name)} — ${definition.sourceCode}</option>`
  )).join("");
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: "Efekt z Kompendium" },
    content: `
      <div class="form-group">
        <label for="neuroshima-effect-definition">Definicja</label>
        <select id="neuroshima-effect-definition" name="definitionId">${definitionOptions}</select>
      </div>
      <div class="form-group">
        <label for="neuroshima-effect-source-value">Wartość kodu</label>
        <input id="neuroshima-effect-source-value" type="number" name="sourceValue" value="0" step="1">
      </div>
      <p><small>Wpisz wartość zgodnie ze źródłem: dodatnia oznacza premię, ujemna karę. System sam przeliczy ją na właściwy rodzaj modyfikatora.</small></p>
      <div class="form-group">
        <label for="neuroshima-effect-expires">Wygasa</label>
        <input id="neuroshima-effect-expires" type="datetime-local" name="expiresAt">
        <small>Puste pole oznacza efekt stały.</small>
      </div>
    `,
    ok: { label: "Dodaj efekt", icon: "fas fa-wand-magic-sparkles" },
    rejectClose: false,
    modal: true
  });
  if (!formData) return null;

  const definition = definitions.find(
    (entry) => entry.id === String(formData.definitionId)
  );
  if (!definition) return null;
  return {
    id: foundry.utils.randomID(),
    source: `${definition.name} [${definition.sourceCode}]`,
    scope: definition.automation.scope,
    value: convertEffectValue(definition.automation, formData.sourceValue),
    enabled: true,
    expiresAt: String(formData.expiresAt ?? "")
  };
}

async function promptForModifier(actor, existingModifier = null) {
  const modifier = existingModifier ?? {
    source: "",
    scope: "test.all",
    value: 0,
    enabled: true,
    expiresAt: ""
  };
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: existingModifier ? "Edycja efektu" : "Nowy efekt" },
    content: `
      <div class="form-group">
        <label for="neuroshima-modifier-source">Źródło efektu</label>
        <input id="neuroshima-modifier-source" type="text" name="source"
          value="${escapeModifierText(modifier.source)}" required>
      </div>
      <div class="form-group">
        <label for="neuroshima-modifier-scope">Zakres</label>
        <select id="neuroshima-modifier-scope" name="scope">
          ${prepareModifierScopeOptions(actor, modifier.scope)}
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-modifier-value">Wartość</label>
        <input id="neuroshima-modifier-value" type="number" name="value"
          value="${Number(modifier.value) || 0}" step="1">
      </div>
      <p><small>Dla Współczynnika i Umiejętności wartość dodatnia jest premią. Dla testów dodatnia wartość jest karą procentową, a ujemna ułatwieniem.</small></p>
      <div class="form-group">
        <label for="neuroshima-modifier-expires">Wygasa</label>
        <input id="neuroshima-modifier-expires" type="datetime-local"
          name="expiresAt" value="${escapeModifierText(modifier.expiresAt)}">
        <small>Puste pole oznacza efekt stały.</small>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" name="enabled" ${modifier.enabled === false ? "" : "checked"}>
          Efekt włączony
        </label>
      </div>
    `,
    ok: { label: "Zapisz", icon: "fas fa-check" },
    rejectClose: false,
    modal: true
  });
  if (!formData) return null;

  const source = String(formData.source ?? "").trim();
  if (!source) {
    ui.notifications.warn("Wpisz źródło efektu.");
    return null;
  }

  return {
    id: modifier.id ?? foundry.utils.randomID(),
    source,
    scope: String(formData.scope),
    value: Math.trunc(Number(formData.value) || 0),
    enabled: [true, "true", "on"].includes(formData.enabled),
    expiresAt: String(formData.expiresAt ?? "")
  };
}

function getStoredModifiers(actor) {
  return foundry.utils.deepClone(actor.toObject().system.activeModifiers ?? []);
}

// Actor zapisuje wyłącznie stabilny kod wybranego wpisu. Czytelne nazwy oraz
// opisy pobieramy z indeksu Compendium, dzięki czemu aktualizacja katalogu nie
// wymaga przepisywania danych wszystkich postaci w świecie.
async function prepareBackgroundCatalog(compendiumId, selectedSourceCode) {
  const customOptionLabel = "Własne / brak wyboru katalogowego";
  const compendium = game.packs.get(compendiumId);

  if (!compendium) {
    return {
      options: { "": customOptionLabel },
      selectedEntry: null
    };
  }

  await compendium.getIndex({
    fields: [
      "system.sourceCode",
      "system.ruleset",
      "system.description",
      "system.flavorText",
      "system.bonus"
    ]
  });

  const entries = [...compendium.index.values()]
    .map((entry) => ({
      name: entry.name,
      sourceCode: entry.system?.sourceCode ?? "",
      ruleset: entry.system?.ruleset ?? "",
      description: entry.system?.description ?? "",
      flavorText: entry.system?.flavorText ?? "",
      bonus: entry.system?.bonus ?? ""
    }))
    .filter((entry) => entry.sourceCode)
    .sort((leftEntry, rightEntry) => leftEntry.name.localeCompare(
      rightEntry.name,
      "pl"
    ));

  const options = { "": customOptionLabel };
  for (const entry of entries) options[entry.sourceCode] = entry.name;

  const selectedEntry = entries.find(
    (entry) => entry.sourceCode === selectedSourceCode
  ) ?? null;

  // Nie usuwamy kodu, którego nie ma już w katalogu. Taki wpis pozostaje
  // widoczny na liście i może zostać świadomie zmieniony przez użytkownika.
  if (selectedSourceCode && !selectedEntry) {
    options[selectedSourceCode] = `Nieznany wpis (${selectedSourceCode})`;
  }

  return { options, selectedEntry };
}

export class NeuroshimaCharacterSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  // DEFAULT_OPTIONS opisuje zachowanie okna karty wspólne dla każdej postaci.
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "character-sheet"],
    actions: {
      // Foundry wywoła tę metodę po kliknięciu elementu
      // posiadającego atrybut data-action="rollAttribute".
      rollAttribute: this.#onRollAttribute,
      rollSkill: this.#onRollSkill,
      rollInjury: this.#onRollInjury,
      rollInitiative: this.#onRollInitiative,
      downloadCombatDiagnostics: this.#onDownloadCombatDiagnostics,
      declareSegmentAction: this.#onDeclareSegmentAction,
      passSegment: this.#onPassSegment,
      finishSegmentAction: this.#onFinishSegmentAction,
      interruptSegmentAction: this.#onInterruptSegmentAction,
      advanceAfterSegmentAction: this.#onAdvanceAfterSegmentAction,
      cancelUnconfiguredShot: this.#onCancelUnconfiguredShot,
      configureAiming: this.#onConfigureAiming,
      resolveSingleShot: this.#onResolveSingleShot,
      configureJamClearing: this.#onConfigureJamClearing,
      handleWeaponJam: this.#onHandleWeaponJam,
      saveActorName: this.#onSaveActorName,
      createModifier: this.#onCreateModifier,
      createCatalogModifier: this.#onCreateCatalogModifier,
      editModifier: this.#onEditModifier,
      toggleModifier: this.#onToggleModifier,
      deleteModifier: this.#onDeleteModifier,

      // Każda rana jest osobnym Itemem osadzonym w postaci.
      createInjury: this.#onCreateInjury,
      editInjury: this.#onEditInjury,
      deleteInjury: this.#onDeleteInjury,

      // Sztuczki i cechy korzystają ze wspólnej obsługi, a ich dokładny typ
      // jest przekazywany przez przycisk tworzenia.
      createFeature: this.#onCreateFeature,
      editFeature: this.#onEditFeature,
      deleteFeature: this.#onDeleteFeature,

      // Te trzy akcje obsługują przedmioty zapisane wewnątrz konkretnej postaci.
      createEquipment: this.#onCreateEquipment,
      editEquipment: this.#onEditEquipment,
      deleteEquipment: this.#onDeleteEquipment,
      createArmor: this.#onCreateArmor,
      editArmor: this.#onEditArmor,
      deleteArmor: this.#onDeleteArmor,
      toggleArmor: this.#onToggleArmor,

      // Broń jest osobnym typem Itemu, dlatego otrzymuje osobne akcje.
      createWeapon: this.#onCreateWeapon,
      editWeapon: this.#onEditWeapon,
      deleteWeapon: this.#onDeleteWeapon,
      reloadWeapon: this.#onReloadWeapon,

      createMeleeWeapon: this.#onCreateMeleeWeapon,
      editMeleeWeapon: this.#onEditMeleeWeapon,
      deleteMeleeWeapon: this.#onDeleteMeleeWeapon,

      // Zapas amunicji jest niezależny od nabojów znajdujących się w broni.
      createAmmunition: this.#onCreateAmmunition,
      editAmmunition: this.#onEditAmmunition,
      deleteAmmunition: this.#onDeleteAmmunition,

      createDisease: this.#onCreateDisease,
      editDisease: this.#onEditDisease,
      deleteDisease: this.#onDeleteDisease,
      previousDiseaseStage: this.#onPreviousDiseaseStage,
      nextDiseaseStage: this.#onNextDiseaseStage,
      toggleDiseaseEffects: this.#onToggleDiseaseEffects,

      createMedicine: this.#onCreateMedicine,
      editMedicine: this.#onEditMedicine,
      deleteMedicine: this.#onDeleteMedicine,
      consumeMedicine: this.#onConsumeMedicine
    },
    position: {
      width: 520,
      // Większa wysokość pozwala zobaczyć pierwszą grupę umiejętności bez przewijania.
      height: 560
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true
    }
  };

  // TABS jest natywną konfiguracją zakładek ApplicationV2 w Foundry 14.
  // Foundry zapamiętuje aktywną zakładkę podczas ponownego renderowania karty.
  static TABS = {
    sheet: {
      tabs: [
        { id: "main", icon: "fa-solid fa-user", label: "Główne" },
        { id: "details", icon: "fa-solid fa-address-card", label: "Postać" },
        { id: "skills", icon: "fa-solid fa-list-check", label: "Umiejętności" },
        { id: "health", icon: "fa-solid fa-heart-pulse", label: "Zdrowie" },
        { id: "inventory", icon: "fa-solid fa-box-open", label: "Ekwipunek" }
      ],
      initial: "main"
    }
  };

  // Każda zakładka ma własny, mniejszy szablon Handlebars. Zmiana układu
  // ekwipunku nie wymaga dzięki temu edycji pól umiejętności albo ran.
  static PARTS = {
    navigation: {
      template: "templates/generic/tab-navigation.hbs"
    },
    main: {
      template: "systems/neuroshima/templates/actor/parts/main-tab.hbs"
    },
    details: {
      template: "systems/neuroshima/templates/actor/parts/details-tab.hbs"
    },
    skills: {
      template: "systems/neuroshima/templates/actor/parts/skills-tab.hbs"
    },
    health: {
      template: "systems/neuroshima/templates/actor/parts/health-tab.hbs"
    },
    inventory: {
      template: "systems/neuroshima/templates/actor/parts/inventory-tab.hbs"
    }
  };

  _onRender(context, options) {
    super._onRender(context, options);

    const specializationCode = this.actor.system.background.specializationSourceCode;
    const specializedSkillKeys = getSpecializedSkillKeys(specializationCode);
    const specializationLabel = SPECIALIZATION_LABELS[specializationCode];
    if (!specializationLabel || specializedSkillKeys.size === 0) return;

    for (const button of this.element.querySelectorAll("[data-action='rollSkill'][data-skill]")) {
      if (!specializedSkillKeys.has(button.dataset.skill)) continue;

      const title = `Umiejętność specjalizacji: ${specializationLabel}`;
      button.classList.add("specialization-skill");
      button.title = title;

      // Pola jednej umiejętności znajdują się między jej przyciskiem a
      // poprzednim przyciskiem (lub nagłówkiem grupy). Obejmuje to również
      // dodatkowe pole nazwy w Wiedzy ogólnej.
      let skillPart = button.previousElementSibling;
      while (skillPart && !["BUTTON", "H3"].includes(skillPart.tagName)) {
        skillPart.classList.add("specialization-skill");
        skillPart.title = title;
        skillPart = skillPart.previousElementSibling;
      }

      if (skillPart?.tagName === "H3") {
        skillPart.classList.add("specialization-skill-heading");
        skillPart.title = title;
      }
    }
  }

  async _prepareContext(options) {
    // Najpierw pobieramy standardowe dane przygotowane przez Foundry.
    const context = await super._prepareContext(options);

    // Udostępniamy szablonowi kartę Actora oraz jej dane systemowe.
    context.actor = this.actor;
    context.system = this.actor.system;
    context.combatStatus = prepareActorCombatStatus(this.actor);
    context.attributeFinalValues = Object.fromEntries(
      Object.keys(ATTRIBUTE_LABELS).map((attributeKey) => [
        attributeKey,
        calculateAttributeValue(this.actor, attributeKey)
      ])
    );
    const prepareModifierEntry = (modifier, editable) => {
      const isActive = modifierIsActive(modifier);
      const expirationTime = Date.parse(modifier.expiresAt);
      return {
        id: modifier.id,
        source: modifier.source,
        scopeLabel: getModifierScopeLabel(this.actor, modifier.scope),
        valueLabel: formatSignedModifier(
          modifier.value,
          modifier.scope.startsWith("test.") ? "%" : ""
        ),
        enabled: modifier.enabled,
        isExpired: modifier.enabled && !isActive,
        canToggle: !(modifier.enabled && !isActive),
        editable,
        statusLabel: !modifier.enabled
          ? "wyłączony"
          : (isActive ? "aktywny" : "wygasł"),
        expiresLabel: modifier.expiresAt && !Number.isNaN(expirationTime)
          ? new Intl.DateTimeFormat("pl-PL", {
            dateStyle: "short",
            timeStyle: "short"
          }).format(expirationTime)
          : "bezterminowo"
      };
    };
    context.modifierEntries = [
      ...this.actor.system.activeModifiers.map((modifier) => (
        prepareModifierEntry(modifier, true)
      )),
      ...collectAutomaticModifierSources(this.actor).map((modifier) => ({
        ...prepareModifierEntry({ ...modifier, enabled: true }, false),
        statusLabel: "automatyczny"
      }))
    ];

    const [
      originCatalog,
      professionCatalog,
      specializationCatalog,
      diseaseCatalog,
      medicinesByDisease
    ] = await Promise.all([
      prepareBackgroundCatalog(
        "world.neuroshima-origins",
        this.actor.system.background.originSourceCode
      ),
      prepareBackgroundCatalog(
        "world.neuroshima-professions",
        this.actor.system.background.professionSourceCode
      ),
      prepareBackgroundCatalog(
        "world.neuroshima-specializations",
        this.actor.system.background.specializationSourceCode
      ),
      prepareDiseaseCatalog(),
      prepareMedicinesByDisease()
    ]);

    context.originOptions = originCatalog.options;
    context.professionOptions = professionCatalog.options;
    context.specializationOptions = specializationCatalog.options;
    context.selectedOrigin = originCatalog.selectedEntry;
    context.selectedProfession = professionCatalog.selectedEntry;
    context.selectedSpecialization = specializationCatalog.selectedEntry;

    // Choroba przeciągnięta z Compendium staje się niezależnym Itemem Actora.
    // Aktualny etap można dzięki temu zmieniać bez modyfikowania wzorca.
    context.diseaseItems = this.actor.items
      .filter((item) => item.type === "disease")
      .map((item) => {
        const currentStage = item.system.stages[item.system.currentStage];
        const source = `Choroba: ${item.name}`;
        const parsedEffects = parseEffectCodes(currentStage?.effect, source);
        const stageModifiers = prepareDiseaseStageModifiers(currentStage, source);
        return {
          id: item.id,
          name: item.name,
          currentStageName: diseaseStageNames[item.system.currentStage]
            ?? item.system.currentStage,
          currentStageSummary: currentStage?.summary ?? "",
          currentStageDescription: currentStage?.description ?? "",
          currentStageEffect: currentStage?.effect ?? "",
          mechanicalEffects: stageModifiers.map((modifier) => (
            describeDiseaseModifier(this.actor, modifier)
          )),
          unsupportedEffects: parsedEffects.unsupportedCodes,
          mechanicalEffectsEnabled: item.system.applyMechanicalEffects !== false,
          medicationDescription: item.system.medicationDescription,
          linkedMedicines: medicinesByDisease[item.system.sourceCode] ?? [],
          canMoveBack: diseaseStageOrder.indexOf(item.system.currentStage) > 0,
          canMoveForward: diseaseStageOrder.indexOf(item.system.currentStage)
            < diseaseStageOrder.length - 1
        };
      });

    context.medicineItems = this.actor.items
      .filter((item) => item.type === "medicine")
      .map((item) => ({
        id: item.id,
        name: item.name,
        diseaseName: diseaseCatalog.namesBySourceCode[item.system.diseaseSourceCode]
          ?? item.system.diseaseSourceCode
          ?? "",
        quantity: item.system.quantity,
        packageSize: item.system.packageSize,
        price: item.system.price,
        availability: item.system.availability,
        effect: item.system.effect,
        effectDurationHours: item.system.effectDurationHours,
        flavorText: item.system.flavorText
      }));

    // Słownik zasila listy wyboru współczynnika przy własnych umiejętnościach.
    // Klucz jest zapisywany w danych, a polska nazwa jest wyświetlana użytkownikowi.
    context.attributeOptions = {
      zrecznosc: "Zręczność",
      percepcja: "Percepcja",
      charakter: "Charakter",
      spryt: "Spryt",
      budowa: "Budowa"
    };

    // Kary wszystkich ran sumujemy przy każdym wyświetleniu karty.
    // Nie zapisujemy sumy, ponieważ zawsze wynika z aktualnej listy ran.
    context.injuryItems = this.actor.items
      .filter((item) => item.type === "injury")
      .map((item) => ({
        id: item.id,
        name: item.name,
        locationName: injuryLocationNames[item.system.location] ?? item.system.location,
        injuryTypeName: injuryTypeNames[item.system.injuryType] ?? item.system.injuryType,
        damageValue: item.system.damageValue,
        penaltyPercent: item.system.penaltyPercent
      }));

    context.totalWoundPenaltyPercent = context.injuryItems.reduce(
      (currentSum, injury) => currentSum + injury.penaltyPercent,
      0
    );

    context.totalDamageValue = context.injuryItems.reduce(
      (currentSum, injury) => currentSum + injury.damageValue,
      0
    );

    // Cechy i sztuczki są osadzonymi Itemami. Przygotowujemy dwie listy,
    // aby karta mogła pokazać je osobno mimo wspólnego modelu danych.
    const prepareFeatureItem = (item) => ({
      id: item.id,
      name: item.name,
      requirements: item.system.requirements,
      effects: item.system.effects,
      description: item.system.description
    });

    context.perkItems = this.actor.items
      .filter((item) => item.type === "perk")
      .map(prepareFeatureItem);

    context.traitItems = this.actor.items
      .filter((item) => item.type === "trait")
      .map(prepareFeatureItem);

    // Actor może posiadać różne typy Itemów. Ta lista zawiera wyłącznie
    // zwykły ekwipunek; broń przygotowujemy osobno poniżej.
    context.equipmentItems = this.actor.items
      .filter((item) => item.type === "equipment")
      .map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.system.quantity,
        unitWeight: item.system.unitWeight,
        weightUnit: item.system.weightUnit,
        totalWeight: item.system.totalWeight,
        price: item.system.price
      }));

    context.armorItems = this.actor.items
      .filter((item) => item.type === "armor")
      .map((item) => {
        const protectedLocations = [
          ["head", "głowa"], ["torso", "tułów"],
          ["leftArm", "lewa ręka"], ["rightArm", "prawa ręka"],
          ["leftLeg", "lewa noga"], ["rightLeg", "prawa noga"]
        ].filter(([key]) => item.system[key]?.protected)
          .map(([key, label]) => `${label}: Red. ${item.system[key].reduction}, Wyt. ${item.system[key].currentDurability}/${item.system[key].maxDurability}`);
        return {
          id: item.id,
          name: item.name,
          equipped: item.system.equipped,
          penaltyPercent: item.system.penaltyPercent,
          protectedLocations: protectedLocations.join(" | "),
          weight: item.system.weightInKilograms
        };
      });
    const armorWeightSum = context.armorItems.reduce(
      (sum, item) => sum + item.weight,
      0
    );
    context.totalArmorWeight = Math.round(armorWeightSum * 1000) / 1000;
    context.equippedDexterityArmorPenalty = calculateArmorPenaltyPercent(
      this.actor,
      "zrecznosc"
    );
    context.equippedPerceptionArmorPenalty = calculateArmorPenaltyPercent(
      this.actor,
      "percepcja"
    );

    // Łączna masa ekwipunku jest informacją wyliczaną. Nie zapisujemy jej
    // osobno, ponieważ zawsze można ją odtworzyć z przedmiotów postaci.
    const equipmentWeightSum = context.equipmentItems.reduce(
      (currentSum, item) => currentSum + item.totalWeight,
      0
    );
    context.totalEquipmentWeight = Math.round(equipmentWeightSum * 1000) / 1000;

    context.meleeWeaponItems = this.actor.items
      .filter((item) => item.type === "meleeWeapon")
      .map((item) => ({
        id: item.id,
        name: item.name,
        armorPenetration: item.system.armorPenetration,
        attackBonus: item.system.attackBonus,
        defenseBonus: item.system.defenseBonus,
        multipleOpponentsBonus: item.system.multipleOpponentsBonus,
        requiredBuild: item.system.requiredBuild,
        initiativeBonus: item.system.initiativeBonus,
        damageProfileDescription: describeMeleeDamageProfile(
          item.system.damageByBuild
        ),
        weight: item.system.weightInKilograms
      }));

    const meleeWeaponWeightSum = context.meleeWeaponItems.reduce(
      (currentSum, item) => currentSum + item.weight,
      0
    );
    context.totalMeleeWeaponWeight = Math.round(meleeWeaponWeightSum * 1000) / 1000;

    // Broń również jest osadzonym Itemem, ale pokazujemy ją na osobnej liście,
    // ponieważ posiada magazynek oraz parametry potrzebne później w walce.
    context.weaponItems = this.actor.items
      .filter((item) => item.type === "weapon")
      .map((item) => ({
        id: item.id,
        name: item.name,
        weaponClassName: weaponClassNames[item.system.weaponClass] ?? item.system.weaponClass,
        ammunitionCode: item.system.ammunitionCode,
        ammunitionName: ammunitionNamesBySymbol[item.system.ammunitionCode]
          ?? item.system.ammunitionCode,
        currentAmmunition: item.system.currentAmmunition,
        magazineCapacity: item.system.magazineCapacity,
        damageName: damageNamesBySymbol[item.system.damageCode]
          ?? item.system.damageCode,
        attackTypeNames: describeAttackTypes(item.system.attackTypes),
        range: item.system.range,
        armorPenetration: item.system.armorPenetration,
        isJammed: item.system.jamState !== "ready",
        jamStateLabel: JAM_STATE_LABELS[item.system.jamState]
          ?? item.system.jamState,
        weight: item.system.totalWeight
      }));

    const weaponWeightSum = context.weaponItems.reduce(
      (currentSum, item) => currentSum + item.weight,
      0
    );
    context.totalWeaponWeight = Math.round(weaponWeightSum * 1000) / 1000;

    // Każdy Item amunicji reprezentuje jeden zapas konkretnego rodzaju nabojów.
    context.ammunitionItems = this.actor.items
      .filter((item) => item.type === "ammunition")
      .map((item) => ({
        id: item.id,
        name: item.name,
        ammunitionSymbol: item.system.ammunitionSymbol,
        ammunitionCompatibilityName: ammunitionNamesBySymbol[item.system.ammunitionSymbol]
          ?? item.system.ammunitionSymbol,
        quantity: item.system.quantity,
        totalPrice: item.system.totalPrice,
        totalWeight: item.system.totalWeight
      }));

    const ammunitionWeightSum = context.ammunitionItems.reduce(
      (currentSum, item) => currentSum + item.totalWeight,
      0
    );
    context.totalAmmunitionWeight = Math.round(ammunitionWeightSum * 1000) / 1000;

    const ammunitionPriceSum = context.ammunitionItems.reduce(
      (currentSum, item) => currentSum + item.totalPrice,
      0
    );
    context.totalAmmunitionPrice = Math.round(ammunitionPriceSum * 100) / 100;

    // Łączne obciążenie obejmuje obecnie zwykły ekwipunek, oba rodzaje broni
    // oraz amunicję.
    // Kolejne typy przedmiotów, na przykład pancerz, dołączymy później.
    const carriedWeightSum = equipmentWeightSum
      + meleeWeaponWeightSum
      + weaponWeightSum
      + ammunitionWeightSum
      + armorWeightSum;
    context.totalCarriedWeight = Math.round(carriedWeightSum * 1000) / 1000;

    return context;
  }

  // Parametry "event" i "target" są przekazywane przez mechanizm akcji Foundry.
  // "target" oznacza przycisk, który został kliknięty przez użytkownika.
  static async #onRollAttribute(event, target) {
    const attributeKey = target.dataset.attribute;
    await rollAttribute(this.actor, attributeKey);
  }

  // Klucz umiejętności odczytujemy z przycisku i przekazujemy do mechaniki testu.
  static async #onRollSkill(event, target) {
    const skillKey = target.dataset.skill;
    await rollSkill(this.actor, skillKey);
  }

  static async #onCreateModifier() {
    const modifier = await promptForModifier(this.actor);
    if (!modifier) return;
    await this.actor.update({
      "system.activeModifiers": [...getStoredModifiers(this.actor), modifier]
    });
  }

  static async #onCreateCatalogModifier() {
    const modifier = await promptForCatalogModifier(this.actor);
    if (!modifier) return;
    await this.actor.update({
      "system.activeModifiers": [...getStoredModifiers(this.actor), modifier]
    });
  }

  static async #onEditModifier(event, target) {
    const modifiers = getStoredModifiers(this.actor);
    const modifierIndex = modifiers.findIndex(
      (modifier) => modifier.id === target.dataset.modifierId
    );
    if (modifierIndex === -1) {
      ui.notifications.warn("Nie znaleziono tego efektu.");
      return;
    }
    const updatedModifier = await promptForModifier(
      this.actor,
      modifiers[modifierIndex]
    );
    if (!updatedModifier) return;
    modifiers[modifierIndex] = updatedModifier;
    await this.actor.update({ "system.activeModifiers": modifiers });
  }

  static async #onToggleModifier(event, target) {
    const modifiers = getStoredModifiers(this.actor);
    const modifier = modifiers.find(
      (entry) => entry.id === target.dataset.modifierId
    );
    if (!modifier) return;
    modifier.enabled = !modifier.enabled;
    await this.actor.update({ "system.activeModifiers": modifiers });
  }

  static async #onDeleteModifier(event, target) {
    const modifiers = getStoredModifiers(this.actor);
    const modifier = modifiers.find(
      (entry) => entry.id === target.dataset.modifierId
    );
    if (!modifier) return;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Usuwanie efektu" },
      content: `<p>Czy na pewno usunąć efekt <strong>${escapeModifierText(modifier.source)}</strong>?</p>`,
      modal: true
    });
    if (!confirmed) return;
    await this.actor.update({
      "system.activeModifiers": modifiers.filter((entry) => entry.id !== modifier.id)
    });
  }

  static async #onRollInjury() {
    const injuryResult = await rollPainResistanceForInjury(this.actor);
    if (!injuryResult) return;

    const createdInjury = await promptToCreateInjuryFromRoll(this.actor, injuryResult);
    if (createdInjury) this.render();
  }

  static async #onRollInitiative() {
    const activeCombat = game.combat;
    const combatant = activeCombat?.combatants.find(
      (candidate) => candidate.actor?.id === this.actor.id
    );

    if (combatant) {
      await activeCombat.rollInitiative(combatant.id);
      return;
    }

    await rollNeuroshimaInitiative(this.actor);
    ui.notifications.info(
      "Actor nie uczestniczy w aktywnej walce. Wynik zapisano tylko na czacie."
    );
  }

  static async #onDeclareSegmentAction() {
    const declared = await selectSegmentAction(this.actor);
    if (declared) {
      let combatStatus = prepareActorCombatStatus(this.actor);
      if (combatStatus.action?.canConfigureAiming) {
        const configured = await configureAiming(this.actor);
        if (!configured) {
          // Broń albo cel mogły zniknąć pomiędzy zatwierdzeniem deklaracji a
          // wyborem konfiguracji. Cofamy wtedy deklarację, aby segment nie
          // został zajęty akcją, której nie da się rozstrzygnąć.
          await cancelCurrentSegmentActionDeclaration(this.actor);
          ui.notifications.warn(
            "Strzał nie został zadeklarowany — wybór broni i celu nie został zakończony."
          );
          this.render();
          return;
        }
        combatStatus = prepareActorCombatStatus(this.actor);
      }
      if (combatStatus.action?.canConfigureJamClearing) {
        await configureMinorJamClearing(this.actor);
        combatStatus = prepareActorCombatStatus(this.actor);
      }
      if (
        combatStatus.action?.effectCode === "clearMinorJam"
        && !combatStatus.action.isPending
        && !combatStatus.action.resolved
      ) {
        await resolveMinorJamClearing(this.actor);
      }
      if (combatStatus.action?.canResolveShot) {
        // Zwykły strzał kończy się w segmencie deklaracji. Warianty celowane
        // zostaną rozstrzygnięte dopiero po dotarciu do ich ostatniego segmentu.
        await resolveSingleShot(this.actor);
      }
    }
    this.render();
  }

  static #onDownloadCombatDiagnostics() {
    downloadCombatDiagnostics(this.actor);
  }

  static async #onPassSegment() {
    await passSegment(this.actor);
    this.render();
  }

  static async #onFinishSegmentAction() {
    await finishSegmentAction(this.actor);
    const combatStatus = prepareActorCombatStatus(this.actor);
    if (combatStatus.action?.canResolveShot) {
      await resolveSingleShot(this.actor);
    }
    this.render();
  }

  static async #onInterruptSegmentAction() {
    await interruptSegmentAction(this.actor);
    this.render();
  }

  static async #onAdvanceAfterSegmentAction() {
    const combatStatus = prepareActorCombatStatus(this.actor);
    if (!combatStatus.action?.canAdvanceAfterAction) {
      ui.notifications.warn("Najpierw dokończ albo rozstrzygnij bieżącą akcję.");
      return;
    }
    await advanceSegmentTurn(game.combat);
    this.render();
  }

  static async #onCancelUnconfiguredShot() {
    const cancelled = await cancelCurrentSegmentActionDeclaration(this.actor);
    if (cancelled) {
      ui.notifications.info("Cofnięto niekompletną deklarację strzału.");
    }
    this.render();
  }

  static async #onResolveSingleShot() {
    await resolveSingleShot(this.actor);
    this.render();
  }

  static async #onConfigureAiming() {
    await configureAiming(this.actor);
    this.render();
  }

  static async #onConfigureJamClearing() {
    const configured = await configureMinorJamClearing(this.actor);
    if (configured) await resolveMinorJamClearing(this.actor);
    this.render();
  }

  static async #onHandleWeaponJam(event, target) {
    const weaponItem = this.actor.items.get(target.dataset.itemId);
    const handled = await handleWeaponJam(this.actor, weaponItem);
    if (handled) {
      const combatStatus = prepareActorCombatStatus(this.actor);
      if (combatStatus.action?.canConfigureJamClearing) {
        await configureMinorJamClearing(this.actor);
      }
    }
    this.render();
  }

  static async #onSaveActorName(event, target) {
    const actorNameInput = target.closest("header")?.querySelector("[data-actor-name]");
    const newActorName = actorNameInput?.value.trim();

    if (!newActorName) {
      ui.notifications.warn("Ksywa postaci nie może być pusta.");
      return;
    }

    if (newActorName === this.actor.name) return;
    await this.actor.update({ name: newActorName });
    ui.notifications.info(`Zapisano ksywę: ${newActorName}.`);
  }

  static async #onCreateInjury() {
    const [createdInjury] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa rana",
        type: "injury"
      }
    ]);

    await createdInjury.sheet.render({ force: true });
  }

  static async #onEditInjury(event, target) {
    const itemId = target.dataset.itemId;
    const injuryItem = this.actor.items.get(itemId);

    if (!injuryItem || injuryItem.type !== "injury") {
      ui.notifications.warn("Nie znaleziono tej rany na karcie postaci.");
      return;
    }

    await injuryItem.sheet.render({ force: true });
  }

  static async #onDeleteInjury(event, target) {
    const itemId = target.dataset.itemId;
    const injuryItem = this.actor.items.get(itemId);

    if (!injuryItem || injuryItem.type !== "injury") {
      ui.notifications.warn("Nie znaleziono tej rany na karcie postaci.");
      return;
    }

    const safeInjuryName = foundry.utils.escapeHTML(injuryItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie rany"
      },
      content: `<p>Czy na pewno usunąć ranę <strong>${safeInjuryName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  static async #onCreateDisease() {
    const [createdDisease] = await this.actor.createEmbeddedDocuments("Item", [
      { name: "Nowa choroba", type: "disease" }
    ]);
    await createdDisease.sheet.render({ force: true });
  }

  static async #onEditDisease(event, target) {
    const diseaseItem = this.actor.items.get(target.dataset.itemId);
    if (!diseaseItem || diseaseItem.type !== "disease") {
      ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
      return;
    }
    await diseaseItem.sheet.render({ force: true });
  }

  static async #onDeleteDisease(event, target) {
    const diseaseItem = this.actor.items.get(target.dataset.itemId);
    if (!diseaseItem || diseaseItem.type !== "disease") {
      ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
      return;
    }

    const safeDiseaseName = foundry.utils.escapeHTML(diseaseItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Usuwanie choroby" },
      content: `<p>Czy na pewno usunąć chorobę <strong>${safeDiseaseName}</strong>?</p>`,
      modal: true
    });
    if (!deletionConfirmed) return;
    await this.actor.deleteEmbeddedDocuments("Item", [diseaseItem.id]);
  }

  static async #onPreviousDiseaseStage(event, target) {
    await changeDiseaseStage(this, target, -1);
  }

  static async #onNextDiseaseStage(event, target) {
    await changeDiseaseStage(this, target, 1);
  }

  static async #onToggleDiseaseEffects(event, target) {
    const diseaseItem = this.actor.items.get(target.dataset.itemId);
    if (!diseaseItem || diseaseItem.type !== "disease") {
      ui.notifications.warn("Nie znaleziono tej choroby na karcie postaci.");
      return;
    }
    await diseaseItem.update({
      "system.applyMechanicalEffects": diseaseItem.system.applyMechanicalEffects === false
    });
  }

  static async #onCreateMedicine() {
    const [createdMedicine] = await this.actor.createEmbeddedDocuments("Item", [
      { name: "Nowy lek", type: "medicine" }
    ]);
    await createdMedicine.sheet.render({ force: true });
  }

  static async #onEditMedicine(event, target) {
    const medicineItem = this.actor.items.get(target.dataset.itemId);
    if (!medicineItem || medicineItem.type !== "medicine") {
      ui.notifications.warn("Nie znaleziono tego leku na karcie postaci.");
      return;
    }
    await medicineItem.sheet.render({ force: true });
  }

  static async #onConsumeMedicine(event, target) {
    const medicineItem = this.actor.items.get(target.dataset.itemId);
    if (!medicineItem || medicineItem.type !== "medicine") {
      ui.notifications.warn("Nie znaleziono tego leku na karcie postaci.");
      return;
    }
    if (medicineItem.system.quantity <= 0) {
      ui.notifications.warn(`Brak dawek leku ${medicineItem.name}.`);
      return;
    }

    await medicineItem.update({ "system.quantity": medicineItem.system.quantity - 1 });
    ui.notifications.info(
      `${medicineItem.name}: zużyto jedną dawkę. Efekt należy rozstrzygnąć zgodnie z opisem.`
    );
  }

  static async #onDeleteMedicine(event, target) {
    const medicineItem = this.actor.items.get(target.dataset.itemId);
    if (!medicineItem || medicineItem.type !== "medicine") {
      ui.notifications.warn("Nie znaleziono tego leku na karcie postaci.");
      return;
    }

    const safeMedicineName = foundry.utils.escapeHTML(medicineItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Usuwanie leku" },
      content: `<p>Czy na pewno usunąć lek <strong>${safeMedicineName}</strong>?</p>`,
      modal: true
    });
    if (!deletionConfirmed) return;
    await this.actor.deleteEmbeddedDocuments("Item", [medicineItem.id]);
  }

  static async #onCreateFeature(event, target) {
    const featureType = target.dataset.featureType;
    const featureTypeNames = {
      perk: "Nowa sztuczka",
      trait: "Nowa cecha"
    };

    if (!featureTypeNames[featureType]) {
      ui.notifications.warn("Nieznany rodzaj zdolności postaci.");
      return;
    }

    const [createdFeature] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: featureTypeNames[featureType],
        type: featureType
      }
    ]);

    await createdFeature.sheet.render({ force: true });
  }

  static async #onEditFeature(event, target) {
    const itemId = target.dataset.itemId;
    const featureItem = this.actor.items.get(itemId);

    if (!featureItem || !["perk", "trait"].includes(featureItem.type)) {
      ui.notifications.warn("Nie znaleziono tej sztuczki lub cechy na karcie postaci.");
      return;
    }

    await featureItem.sheet.render({ force: true });
  }

  static async #onDeleteFeature(event, target) {
    const itemId = target.dataset.itemId;
    const featureItem = this.actor.items.get(itemId);

    if (!featureItem || !["perk", "trait"].includes(featureItem.type)) {
      ui.notifications.warn("Nie znaleziono tej sztuczki lub cechy na karcie postaci.");
      return;
    }

    const safeFeatureName = foundry.utils.escapeHTML(featureItem.name);
    const featureTypeName = featureItem.type === "trait" ? "cechę" : "sztuczkę";
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie zdolności"
      },
      content: `<p>Czy na pewno usunąć ${featureTypeName} <strong>${safeFeatureName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  // Tworzymy nowy Item bezpośrednio wewnątrz Actora. Taki przedmiot należy
  // wyłącznie do tej postaci i może mieć własną ilość, masę, cenę oraz opis.
  static async #onCreateEquipment() {
    const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowy przedmiot",
        type: "equipment"
      }
    ]);

    // Po utworzeniu od razu otwieramy kartę przedmiotu do uzupełnienia.
    await createdItem.sheet.render({ force: true });
  }

  static async #onCreateArmor() {
    const [createdArmor] = await this.actor.createEmbeddedDocuments("Item", [
      { name: "Nowy pancerz", type: "armor" }
    ]);
    await createdArmor.sheet.render({ force: true });
  }

  static async #onEditArmor(event, target) {
    const armor = this.actor.items.get(target.dataset.itemId);
    if (!armor || armor.type !== "armor") {
      ui.notifications.warn("Nie znaleziono tego pancerza na karcie postaci.");
      return;
    }
    await armor.sheet.render({ force: true });
  }

  static async #onToggleArmor(event, target) {
    const armor = this.actor.items.get(target.dataset.itemId);
    if (!armor || armor.type !== "armor") return;
    await armor.update({ "system.equipped": !armor.system.equipped });
  }

  static async #onDeleteArmor(event, target) {
    const armor = this.actor.items.get(target.dataset.itemId);
    if (!armor || armor.type !== "armor") {
      ui.notifications.warn("Nie znaleziono tego pancerza na karcie postaci.");
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Usuwanie pancerza" },
      content: `<p>Czy na pewno usunąć pancerz <strong>${foundry.utils.escapeHTML(armor.name)}</strong>?</p>`,
      modal: true
    });
    if (confirmed) await this.actor.deleteEmbeddedDocuments("Item", [armor.id]);
  }

  // Identyfikator z przycisku pozwala odnaleźć właściwy Item należący do Actora.
  static async #onEditEquipment(event, target) {
    const itemId = target.dataset.itemId;
    const equipmentItem = this.actor.items.get(itemId);

    if (!equipmentItem) {
      ui.notifications.warn("Nie znaleziono tego przedmiotu na karcie postaci.");
      return;
    }

    await equipmentItem.sheet.render({ force: true });
  }

  // Usunięcie osadzonego Itemu jest trwałe, dlatego najpierw pytamy użytkownika
  // o potwierdzenie i pokazujemy nazwę przedmiotu, którego dotyczy operacja.
  static async #onDeleteEquipment(event, target) {
    const itemId = target.dataset.itemId;
    const equipmentItem = this.actor.items.get(itemId);

    if (!equipmentItem) {
      ui.notifications.warn("Nie znaleziono tego przedmiotu na karcie postaci.");
      return;
    }

    // Nazwa jest tekstem wpisanym przez użytkownika, więc przed umieszczeniem
    // jej w kodzie HTML zamieniamy znaki specjalne na bezpieczną postać.
    const safeItemName = foundry.utils.escapeHTML(equipmentItem.name);

    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie przedmiotu"
      },
      content: `<p>Czy na pewno usunąć przedmiot <strong>${safeItemName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  // Nowa broń powstaje bezpośrednio wewnątrz postaci i od razu otwiera
  // własną kartę, na której można uzupełnić jej parametry.
  static async #onCreateWeapon() {
    const [createdWeapon] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa broń",
        type: "weapon"
      }
    ]);

    await createdWeapon.sheet.render({ force: true });
  }

  static async #onCreateMeleeWeapon() {
    const [createdWeapon] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa broń ręczna",
        type: "meleeWeapon"
      }
    ]);

    await createdWeapon.sheet.render({ force: true });
  }

  static async #onEditMeleeWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const meleeWeaponItem = this.actor.items.get(itemId);

    if (!meleeWeaponItem || meleeWeaponItem.type !== "meleeWeapon") {
      ui.notifications.warn("Nie znaleziono tej broni ręcznej na karcie postaci.");
      return;
    }

    await meleeWeaponItem.sheet.render({ force: true });
  }

  static async #onDeleteMeleeWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const meleeWeaponItem = this.actor.items.get(itemId);

    if (!meleeWeaponItem || meleeWeaponItem.type !== "meleeWeapon") {
      ui.notifications.warn("Nie znaleziono tej broni ręcznej na karcie postaci.");
      return;
    }

    const safeWeaponName = foundry.utils.escapeHTML(meleeWeaponItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie broni ręcznej"
      },
      content: `<p>Czy na pewno usunąć broń <strong>${safeWeaponName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  static async #onEditWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const weaponItem = this.actor.items.get(itemId);

    if (!weaponItem || weaponItem.type !== "weapon") {
      ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
      return;
    }

    await weaponItem.sheet.render({ force: true });
  }

  // Przeładowanie porównuje kod wymagany przez broń z symbolem kompatybilności
  // zapasu amunicji. Nie opiera się na nazwach widocznych dla użytkownika.
  static async #onReloadWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const weaponItem = this.actor.items.get(itemId);

    if (!weaponItem || weaponItem.type !== "weapon") {
      ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
      return;
    }

    const magazineCapacity = weaponItem.system.magazineCapacity;
    const currentAmmunition = weaponItem.system.currentAmmunition;

    if (magazineCapacity <= 0) {
      ui.notifications.warn("Ta broń nie ma określonej pojemności magazynka.");
      return;
    }

    if (currentAmmunition >= magazineCapacity) {
      ui.notifications.info(`Magazynek broni ${weaponItem.name} jest już pełny.`);
      return;
    }

    const requiredAmmunitionSymbol = weaponItem.system.ammunitionCode.trim();

    if (!requiredAmmunitionSymbol) {
      ui.notifications.warn("Broń nie ma określonego kodu wymaganej amunicji.");
      return;
    }

    // Bierzemy pod uwagę tylko zgodne zapasy, w których pozostał co najmniej
    // jeden nabój. Puste Itemy pozostają na karcie, ale nie można ich użyć.
    const compatibleAmmunitionItems = this.actor.items.filter((item) => (
      item.type === "ammunition"
      && item.system.quantity > 0
      && item.system.ammunitionSymbol.trim() === requiredAmmunitionSymbol
    ));

    if (compatibleAmmunitionItems.length === 0) {
      ui.notifications.warn(`Brak amunicji zgodnej z kodem ${requiredAmmunitionSymbol}.`);
      return;
    }

    let selectedAmmunitionItem = compatibleAmmunitionItems[0];

    // Kilka wariantów może mieć ten sam symbol, na przykład zwykłe i sportowe
    // strzały. W takiej sytuacji użytkownik wybiera konkretny zapas.
    if (compatibleAmmunitionItems.length > 1) {
      const ammunitionOptions = compatibleAmmunitionItems
        .map((ammunitionItem) => {
          const safeName = foundry.utils.escapeHTML(ammunitionItem.name);
          return `<option value="${ammunitionItem.id}">${safeName} (${ammunitionItem.system.quantity} szt.)</option>`;
        })
        .join("");

      const formData = await foundry.applications.api.DialogV2.input({
        window: {
          title: `Przeładowanie: ${weaponItem.name}`
        },
        content: `
          <div class="form-group">
            <label for="neuroshima-ammunition-item">Wybierz zapas amunicji</label>
            <select id="neuroshima-ammunition-item" name="ammunitionItemId">
              ${ammunitionOptions}
            </select>
          </div>
        `,
        ok: {
          label: "Przeładuj"
        },
        rejectClose: false,
        modal: true
      });

      if (!formData) return;

      selectedAmmunitionItem = this.actor.items.get(String(formData.ammunitionItemId));

      if (!selectedAmmunitionItem || selectedAmmunitionItem.type !== "ammunition") {
        ui.notifications.warn("Nie znaleziono wybranego zapasu amunicji.");
        return;
      }
    }

    const missingAmmunition = magazineCapacity - currentAmmunition;
    const transferredAmmunition = Math.min(
      missingAmmunition,
      selectedAmmunitionItem.system.quantity
    );

    const loadedAmmunitionSourceCode = weaponItem.system.loadedAmmunitionSourceCode;
    const selectedAmmunitionSourceCode = selectedAmmunitionItem.system.sourceCode;

    // Nie mieszamy automatycznie dwóch specjalnych wariantów w jednym
    // magazynku. Najpierw trzeba opróżnić magazynek na karcie broni.
    if (
      currentAmmunition > 0
      && loadedAmmunitionSourceCode
      && loadedAmmunitionSourceCode !== selectedAmmunitionSourceCode
    ) {
      ui.notifications.warn(
        "W magazynku znajduje się inny wariant amunicji. Najpierw opróżnij magazynek."
      );
      return;
    }

    // Oba dokumenty aktualizujemy jednym wywołaniem Foundry. Dzięki temu
    // magazynek i zapas nie rozjadą się w połowie operacji.
    await this.actor.updateEmbeddedDocuments("Item", [
      {
        _id: weaponItem.id,
        "system.currentAmmunition": currentAmmunition + transferredAmmunition,
        "system.loadedAmmunitionSourceCode": selectedAmmunitionSourceCode,
        // Broń przechowuje masę jednego załadowanego naboju w kilogramach.
        // Dzięki temu późniejsza zmiana jednostki na Itemie amunicji nie psuje magazynka.
        "system.loadedAmmunitionUnitWeight": selectedAmmunitionItem.system.unitWeightInKilograms
      },
      {
        _id: selectedAmmunitionItem.id,
        "system.quantity": selectedAmmunitionItem.system.quantity - transferredAmmunition
      }
    ]);

    ui.notifications.info(
      `${weaponItem.name}: załadowano ${transferredAmmunition} szt. amunicji.`
    );
  }

  // Potwierdzenie chroni przed przypadkowym usunięciem całej broni wraz
  // z zapisanym stanem magazynka i pozostałymi danymi egzemplarza.
  static async #onDeleteWeapon(event, target) {
    const itemId = target.dataset.itemId;
    const weaponItem = this.actor.items.get(itemId);

    if (!weaponItem || weaponItem.type !== "weapon") {
      ui.notifications.warn("Nie znaleziono tej broni na karcie postaci.");
      return;
    }

    const safeWeaponName = foundry.utils.escapeHTML(weaponItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie broni"
      },
      content: `<p>Czy na pewno usunąć broń <strong>${safeWeaponName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }

  // Amunicję tworzymy wewnątrz postaci, ponieważ jej ilość jest prywatnym
  // stanem tej postaci i będzie się później zmniejszać podczas przeładowania.
  static async #onCreateAmmunition() {
    const [createdAmmunition] = await this.actor.createEmbeddedDocuments("Item", [
      {
        name: "Nowa amunicja",
        type: "ammunition"
      }
    ]);

    await createdAmmunition.sheet.render({ force: true });
  }

  static async #onEditAmmunition(event, target) {
    const itemId = target.dataset.itemId;
    const ammunitionItem = this.actor.items.get(itemId);

    if (!ammunitionItem || ammunitionItem.type !== "ammunition") {
      ui.notifications.warn("Nie znaleziono tej amunicji na karcie postaci.");
      return;
    }

    await ammunitionItem.sheet.render({ force: true });
  }

  // Usuwamy cały zapas danego rodzaju amunicji, dlatego operacja wymaga
  // wyraźnego potwierdzenia użytkownika.
  static async #onDeleteAmmunition(event, target) {
    const itemId = target.dataset.itemId;
    const ammunitionItem = this.actor.items.get(itemId);

    if (!ammunitionItem || ammunitionItem.type !== "ammunition") {
      ui.notifications.warn("Nie znaleziono tej amunicji na karcie postaci.");
      return;
    }

    const safeAmmunitionName = foundry.utils.escapeHTML(ammunitionItem.name);
    const deletionConfirmed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: "Usuwanie amunicji"
      },
      content: `<p>Czy na pewno usunąć amunicję <strong>${safeAmmunitionName}</strong>?</p>`,
      modal: true
    });

    if (!deletionConfirmed) return;

    await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
  }
}
