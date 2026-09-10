import { getSpecializedSkillKeys } from "../catalogs/skill-specializations.mjs";

// Tabelę kosztów przekazuje wywołujący. Brak zatwierdzonego kosztu blokuje
// zakup zamiast zastępować go domyślną lub wyliczoną na oko wartością.
export function quoteDevelopment(actor, kind, key, costs) {
  if (!["skills", "attributes"].includes(kind)) throw new Error("Nieznany rodzaj rozwoju.");
  const statistic = actor.system[kind]?.[key];
  if (!statistic) throw new Error("Nie znaleziono rozwijanej wartości.");
  const from = Number(statistic.base);
  if (!Number.isInteger(from) || from < 0) throw new Error("Nieprawidłowa wartość bazowa.");
  const to = from + 1;
  if (to > (kind === "skills" ? 20 : 40)) throw new Error("Osiągnięto maksymalny poziom karty.");
  const specialized = kind === "skills" && getSpecializedSkillKeys(actor.system.background?.specializationSourceCode).has(key);
  const table = kind === "attributes" ? costs?.attributes : specialized ? costs?.specializedSkills : costs?.skills;
  const cost = table?.[to];
  if (!Number.isSafeInteger(cost) || cost <= 0) throw new Error("Brak zatwierdzonego kosztu dla tego poziomu.");
  const balance = actor.system.development.experiencePoints;
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error("Nieprawidłowe saldo PD.");
  const session = actor.system.development.session ?? 1;
  if (!actor.system.development.ignoreSessionLimit && (actor.system.development.history ?? []).some(entry => entry.session === session && entry.kind === kind && entry.key === key)) {
    throw new Error("Ta wartość została już podniesiona po tej sesji.");
  }
  return { kind, key, from, to, cost, specialized, balance, session, affordable: balance >= cost };
}

export function prepareDevelopmentPurchase(actor, quote, costs, { id, timestamp, label, userId }) {
  const current = quoteDevelopment(actor, quote.kind, quote.key, costs);
  if (["from", "to", "cost", "specialized", "balance", "session"].some(key => current[key] !== quote[key])) {
    throw new Error("Dane postaci lub koszt zmieniły się. Otwórz zakup ponownie.");
  }
  if (!current.affordable) throw new Error("Za mało Punktów Doświadczenia.");
  return {
    [`system.${current.kind}.${current.key}.base`]: current.to,
    "system.development.experiencePoints": current.balance - current.cost,
    "system.development.history": [...(actor.system.development.history ?? []), {
      id, timestamp, label, userId, session: current.session, kind: current.kind, key: current.key,
      from: current.from, to: current.to, cost: current.cost,
      specialized: current.specialized,
      balanceBefore: current.balance, balanceAfter: current.balance - current.cost
    }]
  };
}
