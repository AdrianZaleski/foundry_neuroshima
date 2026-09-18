// Stan pojedynku jest niezależny od dokumentów Foundry. Inicjatywa należy
// do relacji dwóch walczących, a nie do całej listy uczestników walki.
function integer(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Nieprawidłowa wartość: ${label}.`);
  }
  return value;
}

export const MELEE_MANEUVER_LABELS = { standard: "Zwykła walka", fury: "Furia", fullDefense: "Pełna obrona" };

export function validateMeleeDeclarations(fighters, initiative) {
  for (const fighter of fighters) {
    const maneuver = fighter.maneuver ?? "standard";
    const charge = integer(fighter.charge ?? 0, 0, 3, "Szarża");
    if (charge && maneuver === "fullDefense") throw new Error("Szarża wyklucza Pełną obronę w pierwszej turze.");
    if (!Object.hasOwn(MELEE_MANEUVER_LABELS, maneuver)) throw new Error("Nieznany manewr.");
    const tempo = integer(fighter.tempo ?? 0, 0, 3, "Zwiększone tempo");
    if (tempo > fighter.skill) throw new Error("Zwiększone tempo nie może przekroczyć Umiejętności.");
    if (tempo && fighter.id !== initiative) throw new Error("Tempo zwiększa tylko posiadacz Inicjatywy.");
    if (tempo && maneuver === "fullDefense") throw new Error("Nie można łączyć Zwiększonego tempa z Pełną obroną.");
  }
}

export function meleeManeuverBonuses(fighter) {
  const penalty = fighter.chargePenalty ?? 0;
  return { attack: (fighter.maneuver === "fury" ? 2 : 0) - penalty,
    defense: (fighter.maneuver === "fullDefense" ? 2 : 0) - penalty };
}

export function createMeleeRound({ fighters, initiative, round = 1 }) {
  if (!Array.isArray(fighters) || fighters.length !== 2 || fighters[0].id === fighters[1].id) {
    throw new Error("Pojedynek wymaga dwóch różnych uczestników.");
  }
  if (!fighters.some(fighter => fighter.id === initiative)) throw new Error("Wybierz posiadacza Inicjatywy.");
  validateMeleeDeclarations(fighters, initiative);
  return {
    round: integer(round, 1, Number.MAX_SAFE_INTEGER, "tura"), segment: 1, initiative,
    tempo: Math.max(...fighters.map(fighter => fighter.tempo ?? 0)),
    fighters: fighters.map(fighter => {
      if (!fighter.id || fighter.dice?.length !== 3) throw new Error("Każdy uczestnik musi mieć trzy kości.");
      return { id: fighter.id, skill: integer(fighter.skill, 0, 100, "Umiejętność"), spent: 0,
        maneuver: fighter.maneuver ?? "standard",
        charge: round === 1 ? integer(fighter.charge ?? 0, 0, 3, "Szarża") : 0,
        chargePenalty: round === 1 ? integer(fighter.chargePenalty ?? 0, 0, 3, "kara Szarży") : 0,
        defenseAdvantage: fighter.maneuver === "fullDefense"
          ? integer(fighter.defenseAdvantage ?? 0, 0, 1, "przewaga obrony") : 0,
        dice: fighter.dice.map((natural, index) => ({ index,
          natural: integer(natural, 1, 20, "k20"), value: natural, used: false })) };
    }), history: []
  };
}

export function spendMeleePoints(state, { fighterId, targetId, dieIndex, points }) {
  const next = structuredClone(state);
  const fighter = next.fighters.find(entry => entry.id === fighterId);
  const target = next.fighters.find(entry => entry.id === targetId);
  integer(points, 1, 100, "wydawane punkty");
  integer(dieIndex, 0, 2, "kość");
  if (next.segment > 3 || !fighter || !target) throw new Error("Brak aktywnej tury pojedynku.");
  if (fighter.spent + points > fighter.skill) throw new Error("Za mało punktów Umiejętności.");
  const die = target.dice[dieIndex];
  if (die.used) throw new Error("Ta kość została już wykorzystana.");
  if (fighterId === targetId) {
    if (die.natural === 20) throw new Error("Naturalnej 20 nie można naprawić.");
    if (die.value - points < 1) throw new Error("Nie można obniżyć wyniku poniżej 1.");
    die.value -= points;
  } else die.value += points;
  fighter.spent += points;
  next.history.push({ type: "points", segment: next.segment, fighterId, targetId, dieIndex, points });
  return next;
}

export function meleeDieSucceeds(die, threshold) {
  if (!Number.isFinite(threshold)) throw new Error("Nieprawidłowy próg testu.");
  return die.natural !== 20 && die.value <= threshold;
}

export function describeMeleeDice(fighter, threshold) {
  return fighter.dice.map(die => ({ ...die,
    succeeds: meleeDieSucceeds(die, threshold),
    label: `Kość ${die.index + 1}: ${die.natural} → ${die.value} — ${die.used ? "zużyta" : meleeDieSucceeds(die, threshold) ? "sukces" : "porażka"}`
  }));
}

export function resolveMeleeExchange(state, { attackDice, defenseDice, attackThreshold, defenseThreshold }) {
  const next = structuredClone(state);
  const attacker = next.fighters.find(fighter => fighter.id === next.initiative);
  const defender = next.fighters.find(fighter => fighter.id !== next.initiative);
  if (!Array.isArray(attackDice) || !Array.isArray(defenseDice)
    || attackDice.length !== defenseDice.length || attackDice.length < 1
    || attackDice.length > 4 - next.segment) throw new Error("Wybierz równą liczbę dostępnych kości obu stron.");
  const select = (fighter, indices) => {
    if (new Set(indices).size !== indices.length) throw new Error("Nie można użyć tej samej kości dwukrotnie.");
    return indices.map(index => {
      integer(index, 0, 2, "kość");
      if (fighter.dice[index].used) throw new Error("Ta kość została już wykorzystana.");
      return fighter.dice[index];
    });
  };
  const attacking = select(attacker, attackDice);
  const defending = select(defender, defenseDice);
  attackThreshold += meleeManeuverBonuses(attacker).attack;
  defenseThreshold += meleeManeuverBonuses(defender).defense;
  const attackSuccesses = attacking.filter(die => meleeDieSucceeds(die, attackThreshold)).length;
  const defenseSuccesses = defending.filter(die => meleeDieSucceeds(die, defenseThreshold)).length;
  // Kilka par porażek można rozliczyć razem jako kolejne remisowe
  // segmenty. Nie jest to cios łączony i nie powstają z niego obrażenia.
  const failedDiceDraw = attackSuccesses === 0 && defenseSuccesses === 0;
  // Bez ustalenia kosztu częściowo zepsutego ciosu nie zgadujemy, które
  // kości wracają do puli: gracz wybiera ponownie cios za pozostałe sukcesy.
  if (attackDice.length > 1 && attackSuccesses !== attackDice.length && !failedDiceDraw) {
    const failedNumbers = attackDice.filter((index, position) => !meleeDieSucceeds(attacking[position], attackThreshold)).map(index => index + 1);
    throw new Error(`Cios łączony: zaznaczono ${attackDice.length} kości ataku, ale sukcesów jest ${attackSuccesses}. Kości ataku z porażką: ${failedNumbers.join(", ")}. Odznacz je i wybierz tyle samo kości obrony co kości ataku. Porażki możesz rozegrać osobno; grupowy remis wymaga samych porażek obu stron.`);
  }
  const hit = attackSuccesses > defenseSuccesses;
  const defenseWon = attackSuccesses === 0 && defenseSuccesses > 0;
  // Pełna obrona wymaga dwóch kolejnych skutecznych obron przeciw
  // nieudanym atakom. Remis lub trafienie przerywa tę sekwencję.
  defender.defenseAdvantage = defender.maneuver === "fullDefense" && defenseWon
    ? (defender.defenseAdvantage ?? 0) + 1 : 0;
  const initiativeChanged = defenseWon && (defender.maneuver !== "fullDefense" || defender.defenseAdvantage >= 2);
  const counterHit = initiativeChanged && attacker.maneuver === "fury";
  if (initiativeChanged) defender.defenseAdvantage = 0;
  const exchange = { type: "exchange", segment: next.segment, cost: attackDice.length,
    attackerId: attacker.id, defenderId: defender.id, attackDice, defenseDice,
    attackThreshold, defenseThreshold, attackSuccesses, defenseSuccesses, hit, initiativeChanged, failedDiceDraw,
    counterHit, counterHitSuccesses: counterHit ? defenseSuccesses : 0,
    attackerManeuver: attacker.maneuver ?? "standard", defenderManeuver: defender.maneuver ?? "standard" };
  for (const die of [...attacking, ...defending]) die.used = true;
  if (initiativeChanged) next.initiative = defender.id;
  next.segment += attackDice.length;
  next.history.push(exchange);
  return { state: next, exchange };
}
