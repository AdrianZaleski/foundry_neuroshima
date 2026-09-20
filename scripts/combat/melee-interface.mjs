import { createMeleeRound, spendMeleePoints, resolveMeleeExchange, enterMeleeBerserk,
  MELEE_MANEUVER_LABELS, meleeManeuverBonuses, validateMeleeDeclarations, describeMeleeDice, meleeDieSucceeds } from "./melee.mjs";
import { calculateAttributeValue, calculateSkillValue, collectTestModifierSources,
  sumModifierSources, escapeModifierText as escape } from "../effects/modifiers.mjs";
import { calculateArmorPenaltyPercent } from "./armor.mjs";
import { calculateInitiativeResult } from "./initiative-calculation.mjs";
import { MELEE_DUELS_FLAG, trackedDuels, findTrackedDuel, assertTrackerStart, interruptRangedShotsForMelee,
  assertTrackerExchange, assertTrackerNextRound, assertTrackerParticipants } from "./melee-tracker.mjs";
import { advanceSegmentTurn } from "./segments.mjs";
import { createMeleeDamageHits, resolveMeleeDamageHit, meleeDamageProfile } from "./melee-damage.mjs";
import { calculateWoundPenaltyPercent, calculateDifficultyIndexFromPercentage, calculateFinalDifficultyIndex,
  DIFFICULTY_MODIFIERS, DIFFICULTY_LABELS, DIFFICULTY_STARTING_PERCENTAGES } from "../rolls/roll-helpers.mjs";
import { calculateDifficultyIndexBeforeCriticalResults, applySkillToDieResults,
  prepareSkillDieResultsDescription } from "../rolls/skill-roll.mjs";

const FLAG = "meleeDuel";
let busy = false;
const checked = value => value === true || value === "on" || value === "true";
const formatMeleeThreshold = threshold => threshold < 0 ? `−${Math.abs(threshold)}` : String(threshold);
export function bindMeleePointLimit(root, fighters, thresholds = {}) {
  const spender = root.querySelector('[name="fighterId"]');
  const target = root.querySelector('[name="targetId"]');
  const dieSelect = root.querySelector('[name="die"]');
  const points = root.querySelector('[name="points"]');
  if (!spender || !points) return;
  const button = root.querySelector('button[data-action="spend"]') ?? root.querySelector('button[data-action="points"]');
  const hint = root.querySelector('[data-point-limit]');
  const thresholdHint = root.querySelector('[data-target-threshold]');
  const updateDice = () => {
    if (!target || !dieSelect) return;
    const fighter = fighters.find(entry => entry.id === target.value);
    const options = Array.from(dieSelect.options ?? []);
    const threshold = thresholds[fighter?.id];
    if (thresholdHint) thresholdHint.textContent = Number.isFinite(threshold)
      ? `Próg wybranej postaci: ${formatMeleeThreshold(threshold)}.${threshold < 1 ? " Sukces jest niemożliwy nawet po obniżeniu kości do 1." : ""}`
      : "";
    for (const [index, option] of options.entries()) {
      const die = fighter?.dice?.[index];
      if (!die) continue;
      const outcome = Number.isFinite(threshold) ? meleeDieSucceeds(die, threshold) ? "sukces" : "porażka" : "";
      const comparison = Number.isFinite(threshold) ? ` — ${outcome} (próg ${formatMeleeThreshold(threshold)})` : "";
      option.textContent = `Kość ${index + 1}: ${die.natural} → ${die.value}${comparison}${die.used ? " — zużyta" : ""}`;
      option.disabled = Boolean(die.used);
    }
    const selected = options.find(option => option.value === dieSelect.value);
    if (selected?.disabled) {
      const available = options.find(option => !option.disabled);
      if (available) dieSelect.value = available.value;
    }
  };
  const update = () => {
    const fighter = fighters.find(entry => entry.id === spender.value);
    const available = fighter ? Math.max(0, fighter.skill - fighter.spent) : 0;
    points.max = String(available);
    points.min = available ? "1" : "0";
    points.disabled = available === 0;
    if (button) button.disabled = available === 0;
    if (hint) hint.textContent = `Dostępne punkty: ${available}.`;
    if (!available) points.value = "0";
    else if (points.value !== "") points.value = String(Math.max(1, Math.min(available, Math.trunc(Number(points.value) || 1))));
  };
  spender.addEventListener("change", update);
  target?.addEventListener("change", updateDice);
  points.addEventListener("input", update);
  points.addEventListener("change", () => { if (!points.value) points.value = "1"; update(); });
  update();
  updateDice();
}

export function bindMeleeDiceSelection(root, maximum) {
  const limit = Math.max(0, Math.min(3, Number(maximum) || 0));
  for (const group of ["attack", "defense"]) {
    const inputs = Array.from(root.querySelectorAll(`input[data-melee-dice="${group}"]`) ?? []);
    const enforce = changed => {
      const selected = inputs.filter(input => input.checked && !input.disabled);
      if (selected.length <= limit) return;
      if (changed?.checked) changed.checked = false;
      else for (const input of selected.slice(limit)) input.checked = false;
    };
    enforce();
    for (const input of inputs) input.addEventListener("change", () => enforce(input));
  }
}

const input = (title, content, label = "Dalej") => foundry.applications.api.DialogV2.input({
  window: { title }, position: { width: 650 }, content,
  ok: { label }, rejectClose: false, modal: false
});
async function editMeleePoints(state, actors, thresholds) {
  const actorOptions = actors.map(actor => {
    const fighter = state.fighters.find(entry => entry.id === actor.id);
    const available = fighter ? Math.max(0, fighter.skill - fighter.spent) : 0;
    return `<option value="${actor.id}">${escape(actor.name)} — ${available} pkt</option>`;
  }).join("");
  const initialFighter = state.fighters[0];
  const initialThreshold = thresholds[initialFighter.id];
  const diceOptions = initialFighter.dice.map((die, index) => `<option value="${index + 1}" ${die.used ? "disabled" : ""}>Kość ${index + 1}: ${die.natural} → ${die.value} — ${meleeDieSucceeds(die, initialThreshold) ? "sukces" : "porażka"} (próg ${formatMeleeThreshold(initialThreshold)})${die.used ? " — zużyta" : ""}</option>`).join("");
  return foundry.applications.api.DialogV2.wait({
    window: { title: "Wydaj punkty Umiejętności" },
    position: { width: 480 }, rejectClose: false, modal: false,
    render: (event, dialog) => bindMeleePointLimit(dialog.element, state.fighters, thresholds),
    content: `<p>Wybierz świadomie, kto wydaje punkty i którą kość zmienia. Własną kość obniżasz, a kość przeciwnika podwyższasz.</p>
      <div class="form-group"><label for="melee-spender">Kto wydaje</label><select id="melee-spender" name="fighterId">${actorOptions}</select></div>
      <div class="form-group"><label for="melee-target">Czyja kość</label><select id="melee-target" name="targetId">${actorOptions}</select></div>
      <div class="form-group"><label for="melee-die">Numer kości</label><select id="melee-die" name="die">${diceOptions}</select></div>
      <div class="form-group"><label for="melee-points">Liczba punktów</label><input id="melee-points" name="points" type="number" min="1" step="1" value="1"></div>
      <p data-point-limit></p>
      <p data-target-threshold></p>`,
    buttons: [
      { action: "spend", label: "Zatwierdź wydatek", default: true,
        callback: (event, button) => ({ ...Object.fromEntries(new FormData(button.form)), action: "spend" }) },
      { action: "cancel", label: "Anuluj", callback: () => ({ action: "cancel" }) }
    ]
  });
}

function duelActor(id, combat = null) {
  return combat ? [...combat.combatants].find(entry => entry.actor?.id === id)?.actor : game.actors.get(id);
}

function profile(actor, weaponId, skillKey, tempo = 0) {
  const weapon = weaponId ? actor.items.get(weaponId) : null;
  if (weaponId && weapon?.type !== "meleeWeapon") throw new Error("Wybrana broń nie jest już dostępna.");
  const buildPenalty = Math.max(0, (weapon?.system.requiredBuild ?? 0) - calculateAttributeValue(actor, "budowa")) * 10;
  const penalty = calculateWoundPenaltyPercent(actor) + calculateArmorPenaltyPercent(actor)
    + buildPenalty + sumModifierSources(collectTestModifierSources(actor, { attributeKey: "zrecznosc", skillKey }));
  const threshold = calculateAttributeValue(actor, "zrecznosc")
    - DIFFICULTY_MODIFIERS[Math.min(DIFFICULTY_MODIFIERS.length - 1,
      calculateDifficultyIndexFromPercentage(penalty) + tempo)];
  return { attack: threshold + (weapon?.system.attackBonus ?? 0),
    defense: threshold + (weapon?.system.defenseBonus ?? 0), penalty,
    weaponName: weapon?.name ?? "Pięści" };
}

export async function rollMeleeBerserkMorale(actor) {
  const skillLevel = Math.max(0, calculateSkillValue(actor, "morale"));
  const woundPenalty = calculateWoundPenaltyPercent(actor);
  const armorAid = calculateArmorPenaltyPercent(actor);
  const effectPenalty = sumModifierSources(collectTestModifierSources(actor, { attributeKey: "charakter", skillKey: "morale" }));
  const percentage = DIFFICULTY_STARTING_PERCENTAGES[5] + woundPenalty + effectPenalty - armorAid;
  const difficultyAfterPenalties = calculateDifficultyIndexFromPercentage(percentage);
  const difficultyBeforeCriticals = calculateDifficultyIndexBeforeCriticalResults(difficultyAfterPenalties, skillLevel);
  const roll = await new foundry.dice.Roll("3d20").evaluate();
  const dice = roll.dice[0].results.map(result => result.result);
  const finalDifficulty = calculateFinalDifficultyIndex(dice, difficultyBeforeCriticals);
  const threshold = calculateAttributeValue(actor, "charakter") - DIFFICULTY_MODIFIERS[finalDifficulty];
  const evaluatedDice = applySkillToDieResults(dice, threshold, skillLevel);
  const successes = evaluatedDice.filter(die => die.adjustedResult <= threshold).length;
  const passed = successes >= 2;
  await roll.toMessage({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
    flavor: ["<strong>Tryb Berserka — test Morale</strong>",
      "Trudność bazowa: Cholernie trudny.",
      "Kara pancerza pomaga: −" + armorAid + " PT; rany i efekty: +" + (woundPenalty + effectPenalty) + " PT.",
      "Trudność końcowa: " + DIFFICULTY_LABELS[finalDifficulty] + "; próg Charakteru: " + formatMeleeThreshold(threshold) + ".",
      "Kości: " + prepareSkillDieResultsDescription(evaluatedDice, threshold) + ".",
      "Sukcesy: " + successes + " — " + (passed ? "test zdany, Berserk aktywny" : "test niezdany") + "."].join("<br>") }, { rollMode: "publicroll" });
  return { passed, successes, armorAid, woundPenalty, effectPenalty, finalDifficulty, threshold, dice, evaluatedDice };
}
async function declareManeuvers(configurations, initiative, previousState = null, opening = null, combat = null) {
  const fighters = configurations.map(configuration => {
    const actor = duelActor(configuration.id, combat);
    if (!actor) throw new Error("Nie znaleziono uczestnika pojedynku.");
    const charge = previousState ? 0 : opening?.charges?.[actor.id] ?? 0;
    const previous = previousState?.fighters.find(entry => entry.id === actor.id);
    return { id: actor.id, name: actor.name, charge,
      chargePenalty: charge && opening?.winnerId !== actor.id ? charge : 0,
      skill: Math.max(0, calculateSkillValue(actor, configuration.skillKey)),
      berserk: Boolean(configuration.automaticBerserk || previous?.berserk),
      berserkAttemptedRound: previous?.berserkAttemptedRound ?? 0 };
  });
  while (true) {
    const data = await input("Manewry — przed rzutem nowej tury", `<p>Wybierz manewry obu stron przed rzutem. Furia: +2 do ataku, lecz utrata Inicjatywy oznacza również trafienie przez przeciwnika. Pełna obrona: +2 do obrony, przejęcie Inicjatywy po dwóch kolejnych udanych obronach przeciw nieudanym atakom.</p>
      ${fighters.map((fighter, index) => `<h3>${escape(fighter.name)}</h3><p>Szarża: ${fighter.charge}; kara pierwszej tury: −${fighter.chargePenalty} do Zręczności.${fighter.berserk ? " <strong>Tryb Berserka aktywny.</strong>" : ""}</p><select name="maneuver${index}">${Object.entries(MELEE_MANEUVER_LABELS).filter(([key]) => (!fighter.charge || key !== "fullDefense") && (!fighter.berserk || key !== "fullDefense")).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select>
        ${fighter.id === initiative ? `<label>Zwiększone tempo — poziomy PT obu stron<input type="number" name="tempo${index}" min="0" max="${Math.min(3, fighter.skill)}" step="1" value="0"></label>` : ""}`).join("")}
      <p>Tempo może zwiększyć posiadacz Inicjatywy, najwyżej o 3 poziomy i nie więcej niż wartość Umiejętności. Można je łączyć z Furią, ale nie z Pełną obroną. Wybory obowiązują przez całą turę.</p>`, "Zatwierdź i rzuć 3k20");
    if (!data) return null;
    try {
      const declarations = fighters.map((fighter, index) => {
        const maneuver = data[`maneuver${index}`] ?? "standard";
        const previous = previousState?.fighters.find(entry => entry.id === fighter.id);
        return { ...fighter, maneuver, tempo: Number(data[`tempo${index}`] ?? 0),
          defenseAdvantage: maneuver === "fullDefense" && previous?.maneuver === "fullDefense"
            ? previous.defenseAdvantage ?? 0 : 0 };
      });
      validateMeleeDeclarations(declarations, initiative);
      return declarations;
    } catch (error) { ui.notifications.warn(error.message); }
  }
}

async function rollFighters(declarations, combat = null) {
  const fighters = [];
  const sharedTempo = Math.max(0, ...declarations.map(entry => entry.tempo ?? 0));
  for (const declaration of declarations) {
    const actor = duelActor(declaration.id, combat);
    if (!actor) throw new Error("Nie znaleziono uczestnika pojedynku.");
    const roll = await new foundry.dice.Roll("3d20").evaluate();
    await roll.toMessage({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
      flavor: `Walka wręcz — ${MELEE_MANEUVER_LABELS[declaration.maneuver]}, Wspólne zwiększone tempo: ${sharedTempo} (poziomy PT obu stron); jawne kości nowej tury` }, { rollMode: "publicroll" });
    fighters.push({ ...declaration,
      dice: roll.dice[0].results.map(result => result.result) });
  }
  return fighters;
}

async function setup(host) {
  const actors = [...game.actors].filter(actor => actor.type === "character" && actor.id !== host.id);
  if (!actors.length) throw new Error("Dodaj drugą postać do świata.");
  const selected = await input("Pojedynek wręcz — przeciwnik", `<p>Jeśli rozpoczynająca postać jest w aktywnej walce, pojedynek zostanie połączony z jej Trackerem. Obie postacie muszą w niej uczestniczyć. W segmencie 2 lub 3 rozpocznij zwarcie podczas kolejki jednej z nich; pierwsza tura wykorzysta tylko segmenty pozostałe w rundzie. Poza walką panel działa samodzielnie. Trafienia prowadzą do rozliczenia obrażeń i zapisu na karcie. Dodatkowi przeciwnicy nie są jeszcze automatyczni.</p>
    <select name="opponent">${actors.map(actor => `<option value="${actor.id}">${escape(actor.name)}</option>`).join("")}</select>`);
  if (!selected) return null;
  const opponent = actors.find(actor => actor.id === selected.opponent);
  if (!opponent) throw new Error("Nie znaleziono przeciwnika.");
  const pair = [host, opponent];
  const configuration = await input("Broń i Inicjatywa", `${pair.map((actor, index) => `<h3>${escape(actor.name)}</h3>
    <label>Broń<select name="weapon${index}"><option value="">Pięści</option>${actor.items.filter(item => item.type === "meleeWeapon").map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join("")}</select></label>
    <label>Umiejętność<select name="skill${index}"><option value="bijatyka">Bijatyka (pięści, kastet)</option><option value="bronReczna">Broń ręczna</option></select></label>
    <label>Szarża — premia do Inicjatywy<input name="charge${index}" type="number" min="0" max="3" step="1" value="0"></label>
    <label><input name="automaticBerserk${index}" type="checkbox"> Automatyczny Tryb Berserka (bestia, robot lub cecha — bez testu Morale)</label>`).join("")}
    <p>Szarżę deklarujesz przed testem Zręczności: +1 do +3. Przegrana daje taką samą karę do Zręczności przez pierwszą turę. Szarżujący nie może w niej wybrać Pełnej obrony.</p>
    <label>Ustalenie Inicjatywy<select name="initiativeMode"><option value="roll">Rzuć otwarte testy obu stron</option><option value="manual">Inicjatywa już ustalona (bez Szarży)</option></select></label>
    <label>Posiadacz już ustalonej Inicjatywy<select name="initiative">${pair.map(actor => `<option value="${actor.id}">${escape(actor.name)}</option>`).join("")}</select></label>`);
  if (!configuration) return null;
  const configurations = pair.map((actor, index) => ({ id: actor.id,
    weaponId: String(configuration[`weapon${index}`] ?? ""), skillKey: configuration[`skill${index}`],
    automaticBerserk: checked(configuration[`automaticBerserk${index}`]) }));
  for (const entry of configurations) {
    if (!["bijatyka", "bronReczna"].includes(entry.skillKey)) throw new Error("Nieprawidłowa Umiejętność.");
    if (!entry.weaponId && entry.skillKey !== "bijatyka") throw new Error("Pięści korzystają z Bijatyki.");
    profile(game.actors.get(entry.id), entry.weaponId, entry.skillKey);
  }
  const charges = Object.fromEntries(pair.map((actor, index) => [actor.id, Number(configuration[`charge${index}`] ?? 0)]));
  if (Object.values(charges).some(value => !Number.isInteger(value) || value < 0 || value > 3)) throw new Error("Szarża wymaga wartości od 0 do 3.");
  if (configuration.initiativeMode === "roll") {
    return { configurations, state: null, opening: { charges, winnerId: null, attempts: [] } };
  }
  if (Object.values(charges).some(Boolean)) throw new Error("Szarża wymaga rzutu Inicjatywy w panelu.");
  if (!pair.some(actor => actor.id === configuration.initiative)) throw new Error("Nieprawidłowa Inicjatywa.");
  return { configurations, state: null, opening: { charges, winnerId: configuration.initiative, attempts: [] } };
}

async function rollOpening(configurations, opening, combat = null) {
  const results = [];
  for (const configuration of configurations) {
    const actor = duelActor(configuration.id, combat);
    if (!actor) throw new Error("Nie znaleziono uczestnika pojedynku.");
    const current = profile(actor, configuration.weaponId, configuration.skillKey);
    const weapon = configuration.weaponId ? actor.items.get(configuration.weaponId) : null;
    const charge = opening.charges[actor.id];
    const roll = await new foundry.dice.Roll("3d20").evaluate();
    const result = calculateInitiativeResult({ attributeValue: calculateAttributeValue(actor, "zrecznosc") + charge,
      dieResults: roll.dice[0].results.map(die => die.result),
      skillLevel: Math.max(0, calculateSkillValue(actor, configuration.skillKey)), usesSkill: true,
      difficultyPercentage: current.penalty, weaponModifier: weapon?.system.initiativeBonus ?? 0 });
    await roll.toMessage({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
      flavor: `Inicjatywa pojedynku: ${result.initiativeScore}; Szarża +${charge}; broń ${escape(current.weaponName)} (premia ${weapon?.system.initiativeBonus ?? 0}); kary ${current.penalty}%.` }, { rollMode: "publicroll" });
    results.push({ id: actor.id, ...result });
  }
  const winnerId = results[0].initiativeScore === results[1].initiativeScore ? null
    : results[0].initiativeScore > results[1].initiativeScore ? results[0].id : results[1].id;
  return { ...opening, winnerId, attempts: [...opening.attempts, results] };
}

// Pojedynek w Trackerze zapisuje się na Combat, samodzielny na Actorze.
// Porównanie wersji zapobiega nadpisaniu zmian po zamknięciu starego okna.
export async function openMeleeDuel(host) {
  if (!game.user.isGM || busy) return;
  busy = true;
  try {
    const activeCombat = game.combat;
    const existing = findTrackedDuel(activeCombat, host.id);
    const legacy = host.getFlag("neuroshima", FLAG);
    const combat = existing || (!legacy && activeCombat?.started
      && [...activeCombat.combatants].some(participant => participant.actor?.id === host.id)) ? activeCombat : null;
    const hostId = existing?.hostId ?? host.id;
    const read = () => combat ? trackedDuels(combat).find(entry => entry.hostId === hostId && !entry.ended) ?? null
      : host.getFlag("neuroshima", FLAG) ?? null;
    const clock = () => combat ? JSON.stringify([combat.round, combat.turn, combat.getFlag("neuroshima", "combatSegment"), combat.started]) : "";
    let clockSnapshot = clock();
    let snapshot = JSON.stringify(read());
    const save = async value => {
      if (!game.user.isGM || JSON.stringify(read()) !== snapshot || clock() !== clockSnapshot) {
        throw new Error("Stan pojedynku zmienił się. Otwórz panel ponownie.");
      }
      if (combat) {
        if (value) assertTrackerParticipants(combat, value);
        const entry = value ? { ...value, hostId } : { ...read(), ended: true };
        await combat.setFlag("neuroshima", MELEE_DUELS_FLAG,
          [...trackedDuels(combat).filter(item => item.hostId !== hostId), entry]);
      } else await host.setFlag("neuroshima", FLAG, value);
      snapshot = JSON.stringify(read());
    };
    let duel = read();
    let selectedDice = {};
    if (!duel) {
      duel = await setup(host);
      if (!duel) return;
      if (combat) {
        assertTrackerStart(combat, duel);
        const trackerStartSegment = Number(combat.getFlag("neuroshima", "combatSegment")) || 1;
        await interruptRangedShotsForMelee(combat, duel);
        duel = { ...duel, trackerRound: combat.round, trackerStartSegment, hostId };
      }
      await save(duel);
    }
    while (duel) {
      clockSnapshot = clock();
      if (combat) {
        try { assertTrackerParticipants(combat, duel); }
        catch (error) {
          const ended = await foundry.applications.api.DialogV2.confirm({ window: { title: "Pojedynek niedostępny" },
            content: `<p>${escape(error.message)}</p><p>Zakończyć ten pojedynek i odblokować dalszą walkę?</p>`, rejectClose: false });
          if (ended) await save(null);
          break;
        }
      }
      if (!duel.state) {
        if (combat && (combat.round !== duel.trackerRound || (combat.getFlag("neuroshima", "combatSegment") || 1) !== (duel.trackerStartSegment ?? 1))) {
          throw new Error("Tracker przesunięto przed przygotowaniem pojedynku. Przywróć rundę i segment, w którym go rozpoczęto.");
        }
        if (!duel.opening.winnerId) {
          if (duel.opening.attempts.length) {
            const retry = await input("Remis Inicjatywy", "<p>Obie strony mają ten sam wynik. Powtórz testy z tymi samymi deklaracjami Szarży albo zamknij okno i wróć później.</p>", "Powtórz testy");
            if (!retry) break;
          }
          duel = { ...duel, opening: await rollOpening(duel.configurations, duel.opening, combat) };
          await save(duel);
          if (!duel.opening.winnerId) continue;
        }
        const declarations = await declareManeuvers(duel.configurations, duel.opening.winnerId, null, duel.opening, combat);
        if (!declarations) break;
        duel = { ...duel, state: createMeleeRound({ fighters: await rollFighters(declarations, combat),
          initiative: duel.opening.winnerId, startSegment: combat ? duel.trackerStartSegment ?? 1 : 1 }) };
        await save(duel);
      }
      const { state, configurations } = duel;
      let exchangeReady = true, nextRoundReady = true;
      if (combat) {
        try { assertTrackerExchange(combat, duel); } catch { exchangeReady = false; }
        try { assertTrackerNextRound(combat, duel); } catch { nextRoundReady = false; }
      }
      const actors = configurations.map(entry => duelActor(entry.id, combat));
      if (actors.some(actor => !actor)) throw new Error("Brakuje uczestnika. Przywróć go przed wznowieniem pojedynku.");
      const pending = duel.damageHits?.find(hit => !hit.completed);
      if (pending) {
        const finished = await resolveMeleeDamageHit(pending, actors.find(actor => actor.id === pending.targetId), async hit => {
          const updated = { ...duel, damageHits: duel.damageHits.map(entry => entry.id === hit.id ? hit : entry) };
          await save(updated);
          duel = updated;
        });
        if (!finished) break;
        if (combat && duel.state.segment === 4 && duel.damageHits.every(hit => hit.completed)) {
          await advanceSegmentTurn(combat);
          break;
        }
        continue;
      }
      const profiles = configurations.map((entry, index) => profile(actors[index], entry.weaponId, entry.skillKey, state.tempo ?? 0));
      const attackerIndex = configurations.findIndex(entry => entry.id === state.initiative);
      const defenderIndex = 1 - attackerIndex;
      const defenderFighter = state.fighters[defenderIndex];
      const roleThresholds = configurations.map((entry, index) => index === attackerIndex || state.fighters[index].berserk
        ? profiles[index].attack + meleeManeuverBonuses(state.fighters[index]).attack
        : profiles[index].defense + meleeManeuverBonuses(state.fighters[index]).defense);
      const attackChoices = describeMeleeDice(state.fighters[attackerIndex], roleThresholds[attackerIndex]).filter(die => !die.used);
      const defenseChoices = describeMeleeDice(defenderFighter, roleThresholds[defenderIndex]).filter(die => !die.used);
      const successfulAttackDice = attackChoices.filter(die => die.succeeds);
      const remainingSegments = Math.max(0, 4 - state.segment);
      const canAct = state.segment <= 3 && exchangeReady;
      const canAdvance = combat && configurations.some(entry => entry.id === combat.combatant?.actor?.id) && !exchangeReady;
      const canAttemptBerserk = canAct && !defenderFighter.berserk
        && defenderFighter.maneuver !== "fullDefense" && defenderFighter.berserkAttemptedRound !== state.round;
      const thresholdsByFighter = Object.fromEntries(state.fighters.map((fighter, index) => [fighter.id, roleThresholds[index]]));
      const summary = [attackerIndex, defenderIndex].map((index, role) => {
        const fighter = state.fighters[index];
        const build = calculateAttributeValue(actors[index], "budowa");
        const weapon = configurations[index].weaponId ? actors[index].items.get(configurations[index].weaponId) : null;
        const damageLabels = { S_D: "drobny siniak", S_L: "siniak", S_C: "ciężki siniak", S_K: "krytyczny siniak",
          D_D: "draśnięcie", D_L: "rana lekka", D_C: "rana ciężka", D_K: "rana krytyczna" };
        const damagePreview = [1, 2, 3].map(successes => {
          const damage = meleeDamageProfile(weapon, build, successes);
          return `${successes}: ${damageLabels[damage.damageCode] ?? "ustala MG"}`;
        }).join(" · ");
        const key = role ? "defense" : "attack";
        const threshold = roleThresholds[index];
        return `<section style="flex:1;min-width:220px;padding:12px;border:1px solid var(--color-border-light-primary,#666);border-radius:6px;">
          <h3>${escape(actors[index].name)} — ${role && !fighter.berserk ? "broni się" : fighter.berserk ? "atakuje jako berserker" : "atakuje"}</h3>
          <p>${escape(profiles[index].weaponName)} · próg <strong>${formatMeleeThreshold(threshold)}</strong>${threshold < 1 ? " — <strong>sukces niemożliwy</strong>" : ""} · kara ${profiles[index].penalty}%</p>
          <p><strong>Budowa ${build}</strong> — obrażenia za sukcesy:<br>${damagePreview}</p>
          <small>Przed uwzględnieniem lokacji trafienia i pancerza.</small>
          <p>Punkty Umiejętności: <strong>${fighter.skill - fighter.spent}/${fighter.skill}</strong> · ${MELEE_MANEUVER_LABELS[fighter.maneuver ?? "standard"]}${fighter.berserk ? " · <strong>Tryb Berserka</strong>" : ""}</p>
          ${describeMeleeDice(fighter, threshold).map(die => `<div class="form-group">
            <input id="melee-${key}-${die.index}" name="${key}${die.index}" data-melee-dice="${key}" type="checkbox" ${die.used || !canAct ? "disabled" : ""} ${!die.used && checked(selectedDice[`${key}${die.index}`]) ? "checked" : ""}>
            <label for="melee-${key}-${die.index}">${escape(die.label)}</label></div>`).join("")}
          ${fighter.chargePenalty ? `<p>Kara Szarży: −${fighter.chargePenalty}</p>` : ""}
          ${fighter.maneuver === "fullDefense" ? `<p>Przewaga obrony: ${fighter.defenseAdvantage ?? 0}/2</p>` : ""}
        </section>`;
      }).join("");
      const actions = canAct ? [["exchange", defenderFighter.berserk ? "Rozstrzygnij wymianę" : "Rozstrzygnij cios"], ["points", "Wydaj punkty"]]
        : state.segment > 3 && nextRoundReady ? [["next", "Nowa tura"]] : [["wait", "Zamknij"]];
      if (canAttemptBerserk) actions.push(["berserk", "Test Morale — Berserk"]);
      if (canAdvance) actions.push(["tracker", "Dalej w Trackerze"]);
      actions.push(["end", "Zakończ pojedynek"]);
      const lastExchange = state.history.filter(entry => entry.type === "exchange").at(-1);
      const selectionInstruction = remainingSegments === 1
        ? "<strong>Pozostał 1 segment tej rundy.</strong> Wybierz dokładnie po jednej kości obu stron."
        : `<strong>Pozostały ${remainingSegments} segmenty tej rundy.</strong> Wybierz po jednej kości obu stron albo po 2${remainingSegments === 3 ? "–3" : ""} na cios łączony.`;
      const data = await foundry.applications.api.DialogV2.wait({
        window: { title: `Pojedynek — tura ${state.round}, ${state.segment > 3 ? "koniec tury" : `segment ${state.segment}`}` },
        position: { width: 760 }, rejectClose: false, modal: false,
        render: (event, dialog) => bindMeleeDiceSelection(dialog.element, remainingSegments),
        content: `<div style="display:flex;flex-wrap:wrap;gap:12px;">${summary}</div>
          <p>Zwiększone tempo: ${state.tempo ?? 0}. ${combat ? `Tracker: runda ${combat.round}, segment ${combat.getFlag("neuroshima", "combatSegment") || 1}.` : ""}</p>
          ${lastExchange ? `<p><strong>Ostatnia wymiana:</strong> ${lastExchange.attackSuccesses} sukcesów pierwszego ataku / ${lastExchange.defenseSuccesses} ${lastExchange.defenderBerserk ? "kontrataku" : "obrony"}. ${lastExchange.defenderBerserk ? [lastExchange.hit ? "Pierwszy atak trafia." : "Pierwszy atak chybia.", lastExchange.berserkHit ? "Berserker trafia." : "Berserker chybia."].join(" ") : lastExchange.hit ? "Trafienie." : lastExchange.counterHit ? "Kontrcios przy Furii." : lastExchange.initiativeChanged ? "Przejęcie Inicjatywy." : lastExchange.failedDiceDraw ? "Remis — obie strony bez sukcesów. Inicjatywa bez zmian." : "Brak trafienia."}</p>` : ""}
          ${canAct ? defenderFighter.berserk
            ? `<p>${selectionInstruction} <strong>Obie strony atakują.</strong> Kości ${escape(actors[defenderIndex].name)} nie bronią — mogą zadać drugie, równoczesne trafienie. Cios łączony atakującego wymaga samych sukcesów; Berserker zadaje własny cios za liczbę swoich udanych kości, a porażki tylko zużywają segmenty.</p>`
            : `<p>${selectionInstruction} Cios łączony wymaga sukcesów ataku. Możesz też zaznaczyć równą liczbę porażek obu stron, aby rozliczyć te segmenty razem jako remis, bez obrażeń i zmiany Inicjatywy. Dostępne sukcesy: ${successfulAttackDice.length}.</p>` : ""}`,
        buttons: actions.map(([action, label]) => action === "points"
          ? { action, label, callback: async (event, button) => {
            const formValues = button?.form ? Object.fromEntries(new FormData(button.form)) : {};
            const points = await editMeleePoints(state, actors, thresholdsByFighter);
            return { ...formValues, action, points };
          } }
          : { action, label, callback: (event, button) => ({ ...Object.fromEntries(new FormData(button.form)), action }) })
      });
      if (!data) break;
      selectedDice = data;
      try {
        if (clock() !== clockSnapshot) throw new Error("Tracker zmienił się podczas wyboru. Otwórz panel ponownie.");
        if (data.action === "wait") break;
        if (data.action === "tracker" && canAdvance) {
          await advanceSegmentTurn(combat);
          continue;
        }
        if (data.action === "end") {
          const confirmed = await foundry.applications.api.DialogV2.confirm({ window: { title: "Zakończ pojedynek" },
            content: "<p>Zakończyć pojedynek? Wyniki wymian pozostaną na czacie.</p>", rejectClose: false });
          if (confirmed) { await save(null); break; }
        } else if (data.action === "berserk" && canAttemptBerserk) {
          const result = await rollMeleeBerserkMorale(actors[defenderIndex]);
          duel = { ...duel, state: enterMeleeBerserk(state, { fighterId: defenderFighter.id, passed: result.passed }) };
          await save(duel);
          ui.notifications.info(result.passed
            ? `${escape(actors[defenderIndex].name)} wchodzi w Tryb Berserka.`
            : `Test Morale nieudany — ${escape(actors[defenderIndex].name)} nie wchodzi w Tryb Berserka.`);
        } else if (data.action === "next" && state.segment > 3) {
          if (combat) assertTrackerNextRound(combat, duel);
          const declarations = await declareManeuvers(configurations, state.initiative, state, null, combat);
          if (!declarations) continue;
          duel = { ...duel, ...(combat ? { trackerRound: combat.round, trackerStartSegment: 1 } : {}),
            state: createMeleeRound({ fighters: await rollFighters(declarations, combat), initiative: state.initiative, round: state.round + 1 }) };
          await save(duel);
        } else if (data.action === "points" && state.segment <= 3) {
          if (combat) assertTrackerExchange(combat, duel);
          const points = data.points;
          if (points?.action !== "spend") {
            ui.notifications.info("Anulowano wydawanie punktów.");
            continue;
          }
          duel = { ...duel, state: spendMeleePoints(state, { fighterId: points.fighterId, targetId: points.targetId, dieIndex: Number(points.die) - 1, points: Number(points.points) }) };
          await save(duel);
          if (points.fighterId === points.targetId) {
            const fighter = duel.state.fighters.find(entry => entry.id === points.fighterId);
            const before = state.fighters.find(entry => entry.id === points.fighterId);
            const spent = fighter.spent - before.spent;
            const value = fighter.dice[Number(points.die) - 1].value;
            if (value === 1 || spent < Number(points.points)) {
              ui.notifications.info(`${value === 1 ? "Kość osiągnęła najniższą wartość: 1." : `Kość obniżono do ${value}.`} Wydano ${spent} pkt; pozostało ${fighter.skill - fighter.spent}.`);
            }
          }
        } else if (["exchange", "combined"].includes(data.action) && state.segment <= 3) {
          if (combat) assertTrackerExchange(combat, duel);
          const attackDice = [0, 1, 2].filter(index => checked(data[`attack${index}`]));
          const defenseDice = [0, 1, 2].filter(index => checked(data[`defense${index}`]));
          if (!attackDice.length || !defenseDice.length) throw new Error("Wybierz przynajmniej jedną kość ataku i obrony.");
          const currentProfiles = configurations.map((entry, index) => profile(actors[index], entry.weaponId, entry.skillKey, state.tempo ?? 0));
          if (JSON.stringify(currentProfiles) !== JSON.stringify(profiles)) {
            throw new Error("Modyfikatory lub broń zmieniły się. Sprawdź nowe progi i wybierz kości ponownie.");
          }
          const result = resolveMeleeExchange(state, { attackDice,
            defenseDice, attackThreshold: profiles[attackerIndex].attack,
            defenseThreshold: defenderFighter.berserk ? profiles[defenderIndex].attack : profiles[defenderIndex].defense });
          duel = { ...duel, state: result.state,
            damageHits: [...(duel.damageHits ?? []), ...createMeleeDamageHits(state, result.exchange, configurations, actors)] };
          await save(duel);
          const exchange = result.exchange;
          selectedDice = {};
          await foundry.documents.ChatMessage.create({ content: `<h3>Pojedynek wręcz — tura ${state.round}, segment ${state.segment}</h3>
            <p>${escape(actors[attackerIndex].name)} → ${escape(actors[defenderIndex].name)}; koszt ${exchange.cost} segmentów.</p>
            <p>Sukcesy pierwszego ataku: ${exchange.attackSuccesses}; ${exchange.defenderBerserk ? "kontrataku Berserkera" : "obrony"}: ${exchange.defenseSuccesses}.</p>
            <p>Atak: ${MELEE_MANEUVER_LABELS[exchange.attackerManeuver]}; ${exchange.defenderBerserk ? "kontratak" : "obrona"}: ${MELEE_MANEUVER_LABELS[exchange.defenderManeuver]}; Zwiększone tempo: ${state.tempo ?? 0}.</p>
            ${exchange.counterHit ? `<p>Furia: ${escape(actors[attackerIndex].name)} traci Inicjatywę i otrzymuje cios za ${exchange.counterHitSuccesses} sukces. Obrażenia oczekują na rozliczenie w panelu.</p>` : ""}
            ${exchange.defenderBerserk ? `<p>${exchange.hit ? `${escape(actors[attackerIndex].name)} trafia za ${exchange.attackSuccesses} sukcesy.` : `${escape(actors[attackerIndex].name)} chybia.`} ${exchange.berserkHit ? `${escape(actors[defenderIndex].name)} trafia równocześnie za ${exchange.berserkHitSuccesses} sukcesy.` : `${escape(actors[defenderIndex].name)} chybia.`} Inicjatywa bez zmian.</p>`
              : `<p>${exchange.hit ? `Trafienie za ${exchange.attackSuccesses} sukcesy. Obrażenia oczekują na rozliczenie w panelu.` : exchange.initiativeChanged ? "Obrońca przejmuje Inicjatywę od następnego segmentu." : exchange.failedDiceDraw ? "Remis — obie strony bez sukcesów. Bez obrażeń, Inicjatywa bez zmian." : "Brak trafienia. Inicjatywa bez zmian."}</p>`}` });
          if (duel.damageHits.some(hit => !hit.completed)) continue;
          if (combat && duel.state.segment === 4) {
            await advanceSegmentTurn(combat);
            // Po rozliczeniu rundy zamykamy panel, aby MG mógł obsłużyć
            // następnego uczestnika. Kości i wynik pozostają zapisane.
            break;
          }
        }
      } catch (error) {
        // Błędy wyboru nie kasują rzutu. Po błędzie zapisu odczytujemy
        // stan rzeczywiście zachowany w świecie przed kolejną operacją.
        ui.notifications.warn(error.message);
        if (JSON.stringify(read()) !== snapshot || clock() !== clockSnapshot) break;
        duel = read();
      }
    }
  } catch (error) { ui.notifications.warn(error.message); }
  finally { busy = false; }
}
