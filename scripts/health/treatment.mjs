export function treatmentPlan(injury, method) {
  if (!["firstAid", "healing"].includes(method)) throw new Error("Nieznany rodzaj zabiegu.");
  const state = injury.system.treatment ?? {};
  const available = Math.max(0, 15 - (state.totalReduction ?? 0));
  const reduction = method === "firstAid" ? Math.min(available, Math.max(0, 5 - (state.firstAidReduction ?? 0))) : available;
  const canStabilize = method === "firstAid" && injury.system.injuryType === "critical" && !state.stabilized;
  if ((!reduction || injury.system.penaltyPercent <= 0) && !canStabilize) throw new Error("Ta metoda nie może już zmniejszyć kary tej rany.");
  const failures = method === "firstAid" ? state.firstAidFailures ?? 0 : state.healingFailures ?? 0;
  return { method, reduction, difficulty: Math.min(8, (["abrasion", "light"].includes(injury.system.injuryType) ? 1 : 2) + failures) };
}

export function applyTreatmentResult(injury, plan, passed, details) {
  const current = treatmentPlan(injury, plan.method);
  if (current.reduction !== plan.reduction || current.difficulty !== plan.difficulty) throw new Error("Stan leczenia zmienił się. Rozpocznij zabieg ponownie.");
  const state = injury.system.treatment ?? {};
  const before = injury.system.penaltyPercent;
  const removed = passed ? Math.min(before, plan.reduction) : 0;
  const after = passed ? before - removed : before + 5;
  return {
    "system.penaltyPercent": after,
    "system.treatment": {
      firstAidReduction: (state.firstAidReduction ?? 0) + (plan.method === "firstAid" ? removed : 0),
      totalReduction: (state.totalReduction ?? 0) + removed,
      firstAidFailures: (state.firstAidFailures ?? 0) + (!passed && plan.method === "firstAid" ? 1 : 0),
      healingFailures: (state.healingFailures ?? 0) + (!passed && plan.method === "healing" ? 1 : 0),
      stabilized: state.stabilized || (passed && injury.system.injuryType === "critical"),
      history: [...(state.history ?? []), { ...details, method: plan.method === "firstAid" ? "Pierwsza pomoc" : "Leczenie ran", passed, before, after, difficulty: plan.difficulty }]
    }
  };
}
