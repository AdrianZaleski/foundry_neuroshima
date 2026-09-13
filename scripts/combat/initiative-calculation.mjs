import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, calculateDifficultyIndexFromPercentage, calculateFinalDifficultyIndex } from '../rolls/roll-helpers.mjs';

export function applySkillToOpenInitiativeDice(dieResults, skillLevel) {
  const sortedDice = dieResults
    .map((naturalResult, originalIndex) => ({
      naturalResult,
      adjustedResult: naturalResult,
      originalIndex,
      usedSkillPoints: 0
    }))
    .sort((leftDie, rightDie) => (
      leftDie.naturalResult - rightDie.naturalResult
      || leftDie.originalIndex - rightDie.originalIndex
    ));

  const consideredDice = sortedDice.slice(0, 2);
  const discardedDie = sortedDice[2];

  // W otwartym teście poprawiamy aktualnie gorszą z dwóch rozpatrywanych
  // kości. Przy remisie punkty rozkładają się naprzemiennie.
  for (let spentPoint = 0; spentPoint < skillLevel; spentPoint += 1) {
    const selectedDie = consideredDice[0].adjustedResult
      >= consideredDice[1].adjustedResult
      ? consideredDice[0]
      : consideredDice[1];
    selectedDie.adjustedResult -= 1;
    selectedDie.usedSkillPoints += 1;
  }

  return { consideredDice, discardedDie };
}

export function calculateInitiativeResult({
  attributeValue,
  dieResults,
  skillLevel,
  usesSkill,
  difficultyPercentage,
  weaponModifier = 0
}) {
  const difficultyAfterPercentage = calculateDifficultyIndexFromPercentage(
    difficultyPercentage
  );
  const sliderSteps = usesSkill && skillLevel > 0
    ? Math.floor(skillLevel / 4)
    : 0;
  const difficultyBeforeCriticalResults = usesSkill && skillLevel > 0
    ? difficultyAfterPercentage - sliderSteps
    : difficultyAfterPercentage + 1;
  const boundedDifficultyBeforeCriticalResults = Math.max(
    0,
    Math.min(difficultyBeforeCriticalResults, DIFFICULTY_LABELS.length - 1)
  );
  const finalDifficultyIndex = calculateFinalDifficultyIndex(
    dieResults,
    boundedDifficultyBeforeCriticalResults
  );
  const successThreshold = attributeValue
    - DIFFICULTY_MODIFIERS[finalDifficultyIndex]
    + weaponModifier;
  const openDice = applySkillToOpenInitiativeDice(dieResults, skillLevel);
  const decisiveResult = Math.max(
    ...openDice.consideredDice.map((die) => die.adjustedResult)
  );

  return {
    initiativeScore: successThreshold - decisiveResult,
    successThreshold,
    sliderSteps,
    difficultyAfterPercentage,
    finalDifficultyIndex,
    ...openDice
  };
}


