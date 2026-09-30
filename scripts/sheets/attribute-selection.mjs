import { ATTRIBUTE_LABELS } from "../rolls/attribute-roll.mjs";
import { DIFFICULTY_LABELS } from "../rolls/roll-helpers.mjs";

export function attributeSelection(attributeKey, difficultyIndex) {
  if (!Object.hasOwn(ATTRIBUTE_LABELS, attributeKey) || !Number.isInteger(difficultyIndex)
    || difficultyIndex < 0 || difficultyIndex >= DIFFICULTY_LABELS.length) return null;
  return { attributeKey, difficultyIndex, label: `${ATTRIBUTE_LABELS[attributeKey]} — ${DIFFICULTY_LABELS[difficultyIndex]}` };
}

export function displayAttributeSelection(element, selection) {
  for (const button of element.querySelectorAll('[data-action="selectAttributeLevel"]')) {
    const selected = selection?.attributeKey === button.dataset.attribute
      && selection?.difficultyIndex === Number(button.dataset.difficulty);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  const roll = element.querySelector('[data-action="rollSelectedAttribute"]');
  if (roll) roll.disabled = !selection;
  const label = element.querySelector('[data-attribute-selection-label]');
  if (label) label.textContent = selection?.label ?? "Wybierz próg w tabeli";
}
