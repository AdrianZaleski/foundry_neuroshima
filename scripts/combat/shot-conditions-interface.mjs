import { SHOT_CONDITION_FIELDS, calculateShotConditions, shotNumericInput, shotPercent } from "./shot-conditions.mjs";
import { calculateRangeModifier } from "./range.mjs";
import { calculateDifficultyIndexFromPercentage, DIFFICULTY_LABELS } from "../rolls/roll-helpers.mjs";

const selected = value => value === true || value === "true" || value === "on";

export function shotConditionsHtml() {
  const field = key => {
    const { label, options } = SHOT_CONDITION_FIELDS[key];
    return `<label class="ns-shot-field" for="shot-${key}"><span>${label}</span><select id="shot-${key}" name="${key}">${Object.entries(options).map(([value, [name, percent]]) => `<option value="${value}">${name}${percent === null ? "" : ` (${shotPercent(percent)})`}</option>`).join("")}</select></label>`;
  };
  return `<fieldset><legend>Warunki strzału</legend>
    <p class="ns-shot-hint">Wybierz sytuację w chwili strzału. Warunki ustalasz z MG; nie są odczytywane automatycznie z ruchu tokenów ani ścian.</p>
    <div class="ns-shot-grid">${field("shooterMovement")}${field("shooterExposure")}${field("targetMovement")}${field("targetPosture")}${field("targetCover")}${field("calledLocation")}</div>
    <p class="ns-shot-hint">Postawa i osłona celu dają jedną, większą karę. Wybraną lokację doliczamy osobno — wybieraj tylko widoczną część ciała.</p>
    <label class="ns-shot-field" for="shot-visibility"><span>Utrudnienie za widoczność — ustala MG (%)</span><input id="shot-visibility" name="visibilityPenalty" type="number" value="0" min="0" step="1" required></label>
    <p class="ns-shot-hint">Mgła, dym, ciemność: podręcznik nie podaje stałych wartości. Wpisz uzgodnioną karę; 0 oznacza brak utrudnienia.</p>
  </fieldset>`;
}

// Ta sama funkcja zasila podgląd oraz zatwierdzony strzał.
export function evaluateShotConfiguration(input, context) {
  const conditions = calculateShotConditions(input);
  const includeRange = selected(input.includeRange);
  const distanceText = String(input.distanceMeters ?? "").trim();
  const distanceMeters = distanceText ? shotNumericInput(distanceText, "Odległość do celu", { min: 0 }) : null;
  const rangeResult = distanceMeters === null ? null : calculateRangeModifier(context.weapon, distanceMeters);
  const blockers = [...conditions.blockers];
  if (includeRange && (!rangeResult?.supported || !rangeResult.inRange)) blockers.push(rangeResult?.supported
    ? `Cel poza zasięgiem standardowego strzału (maks. ${rangeResult.maximumDistance} m).`
    : "Wpisz odległość w metrach. Jeśli ustalasz zasięg ręcznie z MG, wyłącz modyfikator zasięgu.");
  const woundPenalty = selected(input.includeWounds) ? context.woundPenalty : 0;
  const armorPenalty = selected(input.includeArmor) ? context.armorPenalty : 0;
  const effectModifier = selected(input.includeEffects) ? context.testModifierPercent : 0;
  const rangeModifier = includeRange && rangeResult?.inRange ? rangeResult.modifierPercent : 0;
  const customModifier = shotNumericInput(input.customModifier ?? 0, "Pozostałe modyfikatory");
  const accuracyModifier = Number(context.weapon.system.accuracyModifier) || 0;
  const breakdown = [
    { label: "Rany strzelca", percent: woundPenalty }, { label: "Pancerz strzelca", percent: armorPenalty },
    { label: "Aktywne efekty", percent: effectModifier }, { label: includeRange ? "Zasięg" : "Zasięg — pominięty", percent: rangeModifier },
    ...conditions.modifiers, { label: "Pozostałe modyfikatory", percent: customModifier }, { label: "Celność broni", percent: accuracyModifier },
    { label: "Ogień automatyczny — broń", percent: context.modeModifier ?? 0 }
  ];
  const totalDifficultyPercentage = breakdown.reduce((sum, entry) => sum + entry.percent, 0);
  const difficultyIndex = calculateDifficultyIndexFromPercentage(totalDifficultyPercentage);
  const difficultyBeforeRoll = Math.min(difficultyIndex + (context.skillLevel > 0 ? 0 : 1), DIFFICULTY_LABELS.length - 1);
  return { conditions, includeRange, distanceMeters, rangeResult, rangeModifier, woundPenalty, armorPenalty,
    effectModifier, customModifier, totalDifficultyPercentage, difficultyBeforeRoll, breakdown, blockers };
}

export function describeShotRange({ includeRange, distanceMeters, rangeResult }) {
  const distance = distanceMeters === null ? "" : `${distanceMeters.toLocaleString("pl-PL")} m — `;
  if (!includeRange) return `${distance}modyfikator zasięgu pominięty (0% w teście).`;
  if (distanceMeters === null) return "Wpisz odległość, aby obliczyć utrudnienie lub ułatwienie za zasięg.";
  if (!rangeResult?.supported) return `${distance}brak tabeli zasięgu dla tej broni. Ustal modyfikator z MG.`;
  if (!rangeResult.inRange) return `${distance}cel poza zasięgiem standardowego strzału (maks. ${rangeResult.maximumDistance} m).`;
  const percent = rangeResult.modifierPercent;
  const effect = percent > 0 ? `utrudnienie ${shotPercent(percent)}`
    : percent < 0 ? `ułatwienie ${shotPercent(percent)}` : "bez utrudnienia ani ułatwienia (0%)";
  return `${distance}${effect}. ${rangeResult.rangeLabel}; przedział do ${rangeResult.bandMaximum} m.`;
}

export function bindShotConfiguration(root, getContext) {
  const form = root.querySelector("form") ?? root;
  const summary = root.querySelector("[data-shot-summary]");
  const details = root.querySelector("[data-shot-breakdown]");
  const error = root.querySelector("[data-shot-error]");
  const submit = root.querySelector('[data-action="ok"]');
  const rangeDescription = root.querySelector("[data-shot-range]");
  if (!summary || !details || !error) return;
  // Podsumowanie i przycisk pozostają widoczne przy przewijaniu warunków.
  const footer = form.querySelector(".form-footer");
  if (footer) form.insertBefore(summary.closest(".ns-shot-summary"), footer);
  const update = () => {
    const input = Object.fromEntries([...form.querySelectorAll("[name]")].map(field => [field.name, field.type === "checkbox" ? field.checked : field.value]));
    try {
      const context = getContext(input.skillKey);
      const result = evaluateShotConfiguration(input, context);
      if (rangeDescription) rangeDescription.textContent = describeShotRange(result);
      summary.textContent = `Razem ${shotPercent(result.totalDifficultyPercentage)} → ${DIFFICULTY_LABELS[result.difficultyBeforeRoll]}${context.skillLevel > 0 ? "" : " (w tym +1 PT za brak Umiejętności)"}`;
      details.textContent = result.breakdown.filter(entry => entry.percent).map(entry => `${entry.label}: ${shotPercent(entry.percent)}`).join(" · ") || "Brak modyfikatorów procentowych.";
      error.textContent = result.blockers.join(" ");
      if (submit) submit.disabled = result.blockers.length > 0;
    } catch (failure) {
      if (rangeDescription) rangeDescription.textContent = "Uzupełnij poprawne parametry, aby obliczyć modyfikator zasięgu.";
      summary.textContent = "Uzupełnij warunki strzału";
      details.textContent = "";
      error.textContent = failure.message;
      if (submit) submit.disabled = true;
    }
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}
