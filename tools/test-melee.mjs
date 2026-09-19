import test from "node:test";
import assert from "node:assert/strict";
import { createMeleeRound, spendMeleePoints, resolveMeleeExchange, meleeManeuverBonuses } from "../scripts/combat/melee.mjs";

const round = (first = [3, 6, 19], second = [12, 13, 18], skill = 0) => createMeleeRound({
  fighters: [{ id: "a", dice: first, skill }, { id: "b", dice: second, skill }], initiative: "a"
});
const exchange = (state, attackDice, defenseDice, attackThreshold = 12, defenseThreshold = 12) =>
  resolveMeleeExchange(state, { attackDice, defenseDice, attackThreshold, defenseThreshold });

test("Poprawianie kości zatrzymuje się na 1 i pobiera tylko potrzebne punkty", () => {
  const initial = round([5,12,20], undefined, 8);
  const action = { fighterId: "a", targetId: "a", dieIndex: 0, points: 8 };
  const next = spendMeleePoints(initial, action);
  assert.equal(next.fighters[0].dice[0].value, 1);
  assert.equal(next.fighters[0].spent, 4);
  assert.equal(next.history.at(-1).points, 4);
  assert.deepEqual(spendMeleePoints(next, action), next);
  const limited = spendMeleePoints(round([12,3,20], undefined, 2), action);
  assert.equal(limited.fighters[0].dice[0].value, 10);
  assert.equal(limited.fighters[0].spent, 2);
  assert.throws(() => spendMeleePoints(initial, {...action,dieIndex:2}), /Naturalnej 20/);
});

test("Screen: trzy porażki obu stron rozliczają trzy remisowe segmenty", () => {
  const state = round([12,20,11], [4,15,2], 3);
  const result = exchange(state, [0,1,2], [0,1,2], 10, 1);
  assert.equal(result.exchange.failedDiceDraw, true);
  assert.equal(result.exchange.hit, false);
  assert.equal(result.exchange.counterHit, false);
  assert.equal(result.exchange.initiativeChanged, false);
  assert.equal(result.state.initiative, "a");
  assert.equal(result.state.segment, 4);
  assert.ok(result.state.fighters.every(fighter => fighter.dice.every(die => die.used)));
  assert.equal(state.segment, 1);
});

test("Grupa porażek nie maskuje udanej obrony; remis dwóch segmentów zostawia trzeci", () => {
  const state = round([12,20,11], [4,15,2]);
  assert.throws(() => exchange(state, [0,1,2], [0,1,2], 10, 4), /Cios łączony/);
  const result = exchange(state, [0,1], [0,1], 10, 1);
  assert.equal(result.state.segment, 3);
  assert.equal(result.state.fighters[0].dice[2].used, false);
});

test("Przykład 1, strona 195: remis, trafienie, dwie porażki", () => {
  let state = round();
  let result = exchange(state, [1], [0]);
  assert.equal(result.exchange.hit, false);
  result = exchange(result.state, [0], [1]);
  assert.equal(result.exchange.hit, true);
  result = exchange(result.state, [2], [2]);
  assert.equal(result.exchange.hit, false);
  assert.equal(result.state.initiative, "a");
  assert.equal(result.state.segment, 4);
  assert.equal(state.fighters[0].dice[0].used, false);
});

test("Przykład 2: przejęcie Inicjatywy zmienia atakującego w trzecim segmencie", () => {
  let result = exchange(round([11, 13, 18], [12, 9, 8]), [0], [0]);
  result = exchange(result.state, [2], [1]);
  assert.equal(result.exchange.initiativeChanged, true);
  assert.equal(result.state.initiative, "b");
  result = exchange(result.state, [2], [1]);
  assert.equal(result.exchange.attackerId, "b");
  assert.equal(result.exchange.hit, true);
});

test("Przykład 3: dwa sukcesy obrony nie zmniejszają ciosu za trzy sukcesy", () => {
  let state = round([2, 16, 19], [9, 12, 19], 4);
  state = spendMeleePoints(state, { fighterId: "a", targetId: "a", dieIndex: 2, points: 3 });
  const result = exchange(state, [0, 1, 2], [0, 1, 2], 16, 15);
  assert.equal(result.exchange.hit, true);
  assert.equal(result.exchange.attackSuccesses, 3);
  assert.equal(result.exchange.defenseSuccesses, 2);
  assert.equal(result.exchange.segment, 1);
  assert.equal(result.state.segment, 4);
});

test("Wspólna pula obejmuje poprawianie swoich i psucie cudzych kości", () => {
  let state = round([12, 15, 19], [10, 11, 12], 4);
  state = spendMeleePoints(state, { fighterId: "a", targetId: "a", dieIndex: 1, points: 2 });
  state = spendMeleePoints(state, { fighterId: "a", targetId: "b", dieIndex: 0, points: 2 });
  assert.equal(state.fighters[0].spent, 4);
  assert.equal(state.fighters[1].dice[0].value, 12);
  assert.throws(() => spendMeleePoints(state, { fighterId: "a", targetId: "a", dieIndex: 0, points: 1 }));
});

test("Naturalne 20 zawsze przegrywa, zmodyfikowane 20 nie jest naturalnym", () => {
  assert.equal(exchange(round([20, 2, 3]), [0], [0], 30, 0).exchange.hit, false);
  assert.throws(() => spendMeleePoints(round([20, 2, 3], undefined, 4), { fighterId: "a", targetId: "a", dieIndex: 0, points: 1 }));
  const state = spendMeleePoints(round([19, 2, 3], undefined, 4), { fighterId: "b", targetId: "a", dieIndex: 0, points: 1 });
  assert.equal(exchange(state, [0], [0], 20, 0).exchange.hit, true);
});

test("Walidacja zużytych kości, podwójnego wyboru i końca tury", () => {
  const state = exchange(round(), [0], [0]).state;
  assert.throws(() => exchange(state, [0], [1]));
  assert.throws(() => exchange(state, [1, 1], [1, 2]));
  assert.throws(() => exchange(state, [1], [1, 2]));
  assert.throws(() => spendMeleePoints(state, { fighterId: "a", targetId: "a", dieIndex: 0, points: 1 }));
  const ended = exchange(round([1, 2, 3], [1, 2, 3]), [0, 1, 2], [0, 1, 2]).state;
  assert.throws(() => exchange(ended, [0], [0]));
});

test("Zepsuty cios łączony wymaga ponownego wyboru bez utraty kości", () => {
  const state = round([1, 2, 19]);
  assert.throws(() => exchange(state, [0, 1, 2], [0, 1, 2]));
  assert.equal(state.segment, 1);
  assert.equal(state.fighters[0].dice.every(die => !die.used), true);
  assert.equal(exchange(state, [0, 1], [0, 1]).exchange.attackSuccesses, 2);
});

test("Nieprawidłowe rzuty i ułamkowe punkty są odrzucane", () => {
  assert.throws(() => round([0, 2, 3]));
  assert.throws(() => round([1, 2]));
  assert.throws(() => spendMeleePoints(round(), { fighterId: "a", targetId: "b", dieIndex: 0, points: -1 }));
  assert.throws(() => spendMeleePoints(round(), { fighterId: "a", targetId: "b", dieIndex: 0, points: 0.5 }));
  assert.throws(() => exchange(round(), [0], [0], NaN));
});

const maneuverRound = (first, second) => createMeleeRound({ initiative: "a", fighters: [
  { id: "a", dice: [18, 19, 18], skill: 4, ...first },
  { id: "b", dice: [14, 14, 14], skill: 4, ...second }
] });

test("Kara Szarży obniża atak i obronę, wygasa wraz z pierwszą turą", () => {
  const fighters = [{ id: "a", dice: [3, 6, 19], skill: 2, charge: 3, chargePenalty: 3 },
    { id: "b", dice: [3, 6, 19], skill: 2 }];
  const first = createMeleeRound({ fighters, initiative: "b" });
  assert.deepEqual(meleeManeuverBonuses(first.fighters[0]), { attack: -3, defense: -3 });
  const second = createMeleeRound({ fighters, initiative: "b", round: 2 });
  assert.deepEqual(meleeManeuverBonuses(second.fighters[0]), { attack: 0, defense: 0 });
  assert.equal(second.fighters[0].charge, 0);
});

test("Pełna obrona: bonus +2 i przejęcie dopiero po dwóch kolejnych przewagach", () => {
  let result = exchange(maneuverRound({}, { maneuver: "fullDefense" }), [0], [0]);
  assert.equal(result.exchange.defenseThreshold, 14);
  assert.equal(result.exchange.initiativeChanged, false);
  assert.equal(result.state.fighters[1].defenseAdvantage, 1);
  result = exchange(result.state, [1], [1]);
  assert.equal(result.exchange.initiativeChanged, true);
  assert.equal(result.state.initiative, "b");
  assert.equal(result.state.fighters[1].defenseAdvantage, 0);
});

test("Remis przerywa sekwencję Pełnej obrony", () => {
  let result = exchange(maneuverRound({ dice: [18, 2, 18] }, { maneuver: "fullDefense" }), [0], [0]);
  result = exchange(result.state, [1], [1]);
  assert.equal(result.state.fighters[1].defenseAdvantage, 0);
  result = exchange(result.state, [2], [2]);
  assert.equal(result.exchange.initiativeChanged, false);
});

test("Furia: bonus +2 do ataku oraz cios przeciwnika przy utracie Inicjatywy", () => {
  const state = maneuverRound({ dice: [14, 18, 19], maneuver: "fury" }, { dice: [19, 12, 11] });
  let result = exchange(state, [0], [0]);
  assert.equal(result.exchange.hit, true);
  assert.equal(result.exchange.attackThreshold, 14);
  result = exchange(result.state, [1], [1]);
  assert.equal(result.exchange.counterHit, true);
  assert.equal(result.exchange.counterHitSuccesses, 1);
  assert.equal(result.exchange.initiativeChanged, true);
});

test("Furia i Pełna obrona: kontrcios dopiero przy rzeczywistym przejęciu", () => {
  let result = exchange(maneuverRound({ maneuver: "fury" }, { maneuver: "fullDefense" }), [0], [0]);
  assert.equal(result.exchange.counterHit, false);
  result = exchange(result.state, [1], [1]);
  assert.equal(result.exchange.counterHit, true);
});

test("Deklaracje: limit tempa, Inicjatywa i zakaz łączenia z Pełną obroną", () => {
  assert.throws(() => maneuverRound({ tempo: 4 }, {}));
  assert.throws(() => maneuverRound({ tempo: 2, skill: 1 }, {}));
  assert.throws(() => maneuverRound({}, { tempo: 1 }));
  assert.throws(() => maneuverRound({ tempo: 1, maneuver: "fullDefense" }, {}));
  assert.throws(() => maneuverRound({ maneuver: "unknown" }, {}));
  assert.equal(maneuverRound({ tempo: 3, maneuver: "fury" }, {}).tempo, 3);
});

test("Starszy zapis bez manewrów nadal rozstrzyga zwykłą walkę", () => {
  const state = round();
  delete state.tempo;
  for (const fighter of state.fighters) { delete fighter.maneuver; delete fighter.defenseAdvantage; }
  assert.equal(exchange(state, [0], [2]).exchange.hit, true);
});
