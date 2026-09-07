import { prepareMedicinesByDisease } from "../catalogs/health-reference.mjs";
import {
  parseEffectCodes,
  prepareDiseaseStageModifiers
} from "../catalogs/effect-definitions.mjs";
import { ATTRIBUTE_LABELS } from "../rolls/attribute-roll.mjs";
import { SKILL_CONFIGURATION } from "../rolls/skill-roll.mjs";
import {
  escapeModifierText,
  formatSignedModifier
} from "../effects/modifiers.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export const diseaseStageOptions = {
  first: "Etap pierwszy",
  second: "Etap drugi",
  third: "Etap trzeci",
  terminal: "Stan terminalny"
};

function describeMechanicalModifier(modifier) {
  const [scopeType, scopeSubtype, scopeKey] = modifier.scope.split(".");
  const note = modifier.note ? ` (${modifier.note})` : "";

  if (scopeType === "attribute") {
    return `${ATTRIBUTE_LABELS[scopeSubtype] ?? scopeSubtype}: ${formatSignedModifier(modifier.value)}${note}`;
  }

  if (scopeType === "test" && scopeSubtype === "skill") {
    const skillName = SKILL_CONFIGURATION[scopeKey]?.label ?? scopeKey;
    const changeType = modifier.value >= 0 ? "kara" : "premia";
    return `Testy — ${skillName}: ${changeType} ${Math.abs(modifier.value)}%${note}`;
  }

  if (scopeType === "test" && scopeSubtype === "attribute") {
    const attributeName = ATTRIBUTE_LABELS[scopeKey] ?? scopeKey;
    const changeType = modifier.value >= 0 ? "kara" : "premia";
    return `Testy — ${attributeName}: ${changeType} ${Math.abs(modifier.value)}%${note}`;
  }

  if (scopeType === "test" && scopeSubtype === "all") {
    const changeType = modifier.value >= 0 ? "kara" : "premia";
    return `Wszystkie testy: ${changeType} ${Math.abs(modifier.value)}%${note}`;
  }

  return `${modifier.scope}: ${formatSignedModifier(modifier.value)}${note}`;
}

function prepareStageEntries(diseaseItem) {
  return Object.entries(diseaseItem.system.stages).map(([key, stage]) => {
    const source = `Choroba: ${diseaseItem.name}`;
    const effectiveModifiers = prepareDiseaseStageModifiers(stage, source);
    const unsupportedEffects = parseEffectCodes(stage.effect, source).unsupportedCodes;
    return {
      key,
      label: diseaseStageOptions[key] ?? key,
      stage,
      mechanicalEffects: effectiveModifiers.map((modifier, index) => ({
        index,
        label: describeMechanicalModifier(modifier)
      })),
      unsupportedEffects
    };
  });
}

function prepareModifierScopeOptions(selectedScope) {
  const options = [{ value: "test.all", label: "Wszystkie testy — zmiana PT w %" }];
  for (const [key, label] of Object.entries(ATTRIBUTE_LABELS)) {
    options.push({ value: `attribute.${key}`, label: `${label} — zmiana wartości` });
    options.push({ value: `test.attribute.${key}`, label: `Testy ${label} — zmiana PT w %` });
  }
  for (const [key, configuration] of Object.entries(SKILL_CONFIGURATION)) {
    options.push({
      value: `test.skill.${key}`,
      label: `Testy: ${configuration.label} — zmiana PT w %`
    });
  }
  return options.map((option) => (
    `<option value="${option.value}"${option.value === selectedScope ? " selected" : ""}>${escapeModifierText(option.label)}</option>`
  )).join("");
}

async function promptForStageModifier(existingModifier = null) {
  const modifier = existingModifier ?? { scope: "test.all", value: 0, note: "" };
  const formData = await foundry.applications.api.DialogV2.input({
    window: { title: existingModifier ? "Edytuj zmianę stadium" : "Dodaj zmianę stadium" },
    content: `
      <div class="form-group">
        <label for="neuroshima-disease-modifier-scope">Czego dotyczy</label>
        <select id="neuroshima-disease-modifier-scope" name="scope">
          ${prepareModifierScopeOptions(modifier.scope)}
        </select>
      </div>
      <div class="form-group">
        <label for="neuroshima-disease-modifier-note">Warunek lub uwaga</label>
        <input id="neuroshima-disease-modifier-note" type="text" name="note" value="${escapeModifierText(modifier.note)}" placeholder="np. tylko przy testach ruchowych">
      </div>
      <div class="form-group">
        <label for="neuroshima-disease-modifier-value">Wartość</label>
        <input id="neuroshima-disease-modifier-value" type="number" name="value" value="${Number(modifier.value) || 0}" step="1">
      </div>
      <p><small>Dla Współczynnika wpisz np. -3. Dla trudności testu kara to +30%, a premia -20%.</small></p>
    `,
    ok: { label: "Zapisz", icon: "fas fa-check" },
    rejectClose: false,
    modal: true
  });
  if (!formData) return null;
  return {
    id: existingModifier?.id || foundry.utils.randomID(),
    scope: String(formData.scope),
    value: Math.trunc(Number(formData.value) || 0),
    note: String(formData.note ?? "").trim()
  };
}

function getEditableStageModifiers(diseaseItem, stageKey) {
  const stage = diseaseItem.system.stages?.[stageKey];
  if (!stage) return null;
  const source = `Choroba: ${diseaseItem.name}`;
  return prepareDiseaseStageModifiers(stage, source).map((modifier) => ({
    id: modifier.id || foundry.utils.randomID(),
    scope: modifier.scope,
    value: modifier.value,
    note: modifier.note ?? ""
  }));
}

export class NeuroshimaDiseaseSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["neuroshima", "disease-sheet"],
    actions: {
      addStageModifier: this.#onAddStageModifier,
      editStageModifier: this.#onEditStageModifier,
      deleteStageModifier: this.#onDeleteStageModifier
    },
    position: { width: 620, height: 760 },
    form: { closeOnSubmit: false, submitOnChange: true }
  };

  static PARTS = {
    main: { template: "systems/neuroshima/templates/item/disease-sheet.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.item = this.item;
    context.system = this.item.system;
    context.diseaseStageOptions = diseaseStageOptions;
    context.stageEntries = prepareStageEntries(this.item);
    const medicinesByDisease = await prepareMedicinesByDisease();
    context.linkedMedicines = medicinesByDisease[this.item.system.sourceCode] ?? [];
    return context;
  }

  static async #onAddStageModifier(event, target) {
    const stageKey = target.dataset.stageKey;
    const modifiers = getEditableStageModifiers(this.item, stageKey);
    if (!modifiers) return;
    const modifier = await promptForStageModifier();
    if (!modifier) return;
    await this.item.update({
      [`system.stages.${stageKey}.modifiersConfigured`]: true,
      [`system.stages.${stageKey}.modifiers`]: [...modifiers, modifier]
    });
  }

  static async #onEditStageModifier(event, target) {
    const stageKey = target.dataset.stageKey;
    const modifierIndex = Number(target.dataset.modifierIndex);
    const modifiers = getEditableStageModifiers(this.item, stageKey);
    if (!modifiers?.[modifierIndex]) return;
    const modifier = await promptForStageModifier(modifiers[modifierIndex]);
    if (!modifier) return;
    modifiers[modifierIndex] = modifier;
    await this.item.update({
      [`system.stages.${stageKey}.modifiersConfigured`]: true,
      [`system.stages.${stageKey}.modifiers`]: modifiers
    });
  }

  static async #onDeleteStageModifier(event, target) {
    const stageKey = target.dataset.stageKey;
    const modifierIndex = Number(target.dataset.modifierIndex);
    const modifiers = getEditableStageModifiers(this.item, stageKey);
    if (!modifiers?.[modifierIndex]) return;
    modifiers.splice(modifierIndex, 1);
    await this.item.update({
      [`system.stages.${stageKey}.modifiersConfigured`]: true,
      [`system.stages.${stageKey}.modifiers`]: modifiers
    });
  }
}
