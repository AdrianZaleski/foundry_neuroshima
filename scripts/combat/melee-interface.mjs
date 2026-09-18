import { createMeleeRound, spendMeleePoints, resolveMeleeExchange,
  MELEE_MANEUVER_LABELS, meleeManeuverBonuses, validateMeleeDeclarations, describeMeleeDice } from "./melee.mjs";
import { calculateAttributeValue, calculateSkillValue, collectTestModifierSources,
  sumModifierSources, escapeModifierText as escape } from "../effects/modifiers.mjs";
import { calculateArmorPenaltyPercent } from "./armor.mjs";
import { calculateInitiativeResult } from "./initiative-calculation.mjs";
import { MELEE_DUELS_FLAG, trackedDuels, findTrackedDuel, assertTrackerStart,
  assertTrackerExchange, assertTrackerNextRound, assertTrackerParticipants } from "./melee-tracker.mjs";
import { advanceSegmentTurn } from "./segments.mjs";
import { createMeleeDamageHits, resolveMeleeDamageHit, meleeDamageProfile } from "./melee-damage.mjs";
import { calculateWoundPenaltyPercent, calculateDifficultyIndexFromPercentage,
  DIFFICULTY_MODIFIERS } from "../rolls/roll-helpers.mjs";

const FLAG = "meleeDuel";
let busy = false;
const checked = value => value === true || value === "on" || value === "true";
const input = (title, content, label = "Dalej") => foundry.applications.api.DialogV2.input({
  window: { title }, position: { width: 650 }, content,
  ok: { label }, rejectClose: false, modal: true
});

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

async function declareManeuvers(configurations, initiative, previousState = null, opening = null, combat = null) {
  const fighters = configurations.map(configuration => {
    const actor = duelActor(configuration.id, combat);
    if (!actor) throw new Error("Nie znaleziono uczestnika pojedynku.");
    const charge = previousState ? 0 : opening?.charges?.[actor.id] ?? 0;
    return { id: actor.id, name: actor.name, charge,
      chargePenalty: charge && opening?.winnerId !== actor.id ? charge : 0,
      skill: Math.max(0, calculateSkillValue(actor, configuration.skillKey)) };
  });
  while (true) {
    const data = await input("Manewry — przed rzutem nowej tury", `<p>Wybierz manewry obu stron przed rzutem. Furia: +2 do ataku, lecz utrata Inicjatywy oznacza również trafienie przez przeciwnika. Pełna obrona: +2 do obrony, przejęcie Inicjatywy po dwóch kolejnych udanych obronach przeciw nieudanym atakom.</p>
      ${fighters.map((fighter, index) => `<h3>${escape(fighter.name)}</h3><p>Szarża: ${fighter.charge}; kara pierwszej tury: −${fighter.chargePenalty} do Zręczności.</p><select name="maneuver${index}">${Object.entries(MELEE_MANEUVER_LABELS).filter(([key]) => !fighter.charge || key !== "fullDefense").map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select>
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
  for (const declaration of declarations) {
    const actor = duelActor(declaration.id, combat);
    if (!actor) throw new Error("Nie znaleziono uczestnika pojedynku.");
    const roll = await new foundry.dice.Roll("3d20").evaluate();
    await roll.toMessage({ speaker: foundry.documents.ChatMessage.getSpeaker({ actor }),
      flavor: `Walka wręcz — ${MELEE_MANEUVER_LABELS[declaration.maneuver]}, Zwiększone tempo: ${declaration.tempo}; jawne kości nowej tury` }, { rollMode: "publicroll" });
    fighters.push({ ...declaration,
      dice: roll.dice[0].results.map(result => result.result) });
  }
  return fighters;
}

async function setup(host) {
  const actors = [...game.actors].filter(actor => actor.type === "character" && actor.id !== host.id);
  if (!actors.length) throw new Error("Dodaj drugą postać do świata.");
  const selected = await input("Pojedynek wręcz — przeciwnik", `<p>Jeśli rozpoczynająca postać jest w aktywnej walce, pojedynek zostanie połączony z jej Trackerem. Obie postacie muszą w niej uczestniczyć; rozpocznij w pierwszym segmencie, przed ich akcjami. Poza walką panel działa samodzielnie. Trafienia prowadzą do rozliczenia obrażeń i zapisu na karcie. Dodatkowi przeciwnicy nie są jeszcze automatyczni.</p>
    <select name="opponent">${actors.map(actor => `<option value="${actor.id}">${escape(actor.name)}</option>`).join("")}</select>`);
  if (!selected) return null;
  const opponent = actors.find(actor => actor.id === selected.opponent);
  if (!opponent) throw new Error("Nie znaleziono przeciwnika.");
  const pair = [host, opponent];
  const configuration = await input("Broń i Inicjatywa", `${pair.map((actor, index) => `<h3>${escape(actor.name)}</h3>
    <label>Broń<select name="weapon${index}"><option value="">Pięści</option>${actor.items.filter(item => item.type === "meleeWeapon").map(item => `<option value="${item.id}">${escape(item.name)}</option>`).join("")}</select></label>
    <label>Umiejętność<select name="skill${index}"><option value="bijatyka">Bijatyka (pięści, kastet)</option><option value="bronReczna">Broń ręczna</option></select></label>
    <label>Szarża — premia do Inicjatywy<input name="charge${index}" type="number" min="0" max="3" step="1" value="0"></label>`).join("")}
    <p>Szarżę deklarujesz przed testem Zręczności: +1 do +3. Przegrana daje taką samą karę do Zręczności przez pierwszą turę. Szarżujący nie może w niej wybrać Pełnej obrony.</p>
    <label>Ustalenie Inicjatywy<select name="initiativeMode"><option value="roll">Rzuć otwarte testy obu stron</option><option value="manual">Inicjatywa już ustalona (bez Szarży)</option></select></label>
    <label>Posiadacz już ustalonej Inicjatywy<select name="initiative">${pair.map(actor => `<option value="${actor.id}">${escape(actor.name)}</option>`).join("")}</select></label>`);
  if (!configuration) return null;
  const configurations = pair.map((actor, index) => ({ id: actor.id,
    weaponId: String(configuration[`weapon${index}`] ?? ""), skillKey: configuration[`skill${index}`] }));
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
        duel = { ...duel, trackerRound: combat.round, hostId };
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
        if (combat && (combat.round !== duel.trackerRound || (combat.getFlag("neuroshima", "combatSegment") || 1) !== 1)) {
          throw new Error("Tracker przesunięto przed przygotowaniem pojedynku. Przywróć rundę i pierwszy segment, w którym go rozpoczęto.");
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
        duel = { ...duel, state: createMeleeRound({ fighters: await rollFighters(declarations, combat), initiative: duel.opening.winnerId }) };
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
      const attackChoices = describeMeleeDice(state.fighters[attackerIndex], profiles[attackerIndex].attack + meleeManeuverBonuses(state.fighters[attackerIndex]).attack).filter(die => !die.used);
      const defenseChoices = describeMeleeDice(state.fighters[defenderIndex], profiles[defenderIndex].defense + meleeManeuverBonuses(state.fighters[defenderIndex]).defense).filter(die => !die.used);
      const successfulAttackDice = attackChoices.filter(die => die.succeeds);
      const canAct = state.segment <= 3 && exchangeReady;
      const canAdvance = combat && configurations.some(entry => entry.id === combat.combatant?.actor?.id) && !exchangeReady;
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
        const threshold = role ? profiles[index].defense + meleeManeuverBonuses(fighter).defense
          : profiles[index].attack + meleeManeuverBonuses(fighter).attack;
        return `<section style="flex:1;min-width:220px;padding:12px;border:1px solid var(--color-border-light-primary,#666);border-radius:6px;">
          <h3>${escape(actors[index].name)} — ${role ? "broni się" : "atakuje"}</h3>
          <p>${escape(profiles[index].weaponName)} · próg <strong>${threshold}</strong> · kara ${profiles[index].penalty}%</p>
          <p><strong>Budowa ${build}</strong> — obrażenia za sukcesy:<br>${damagePreview}</p>
          <small>Przed uwzględnieniem lokacji trafienia i pancerza.</small>
          <p>Punkty Umiejętności: <strong>${fighter.skill - fighter.spent}/${fighter.skill}</strong> · ${MELEE_MANEUVER_LABELS[fighter.maneuver ?? "standard"]}</p>
          ${describeMeleeDice(fighter, threshold).map(die => `<div class="form-group">
            <input id="melee-${key}-${die.index}" name="${key}${die.index}" type="checkbox" ${die.used || !canAct ? "disabled" : ""} ${!die.used && checked(selectedDice[`${key}${die.index}`]) ? "checked" : ""}>
            <label for="melee-${key}-${die.index}">${escape(die.label)}</label></div>`).join("")}
          ${fighter.chargePenalty ? `<p>Kara Szarży: −${fighter.chargePenalty}</p>` : ""}
          ${fighter.maneuver === "fullDefense" ? `<p>Przewaga obrony: ${fighter.defenseAdvantage ?? 0}/2</p>` : ""}
        </section>`;
      }).join("");
      const actorOptions = actors.map(actor => `<option value="${actor.id}">${escape(actor.name)}</option>`).join("");
      const actions = canAct ? [["exchange", "Rozstrzygnij cios"], ["points", "Wydaj punkty"]]
        : state.segment > 3 && nextRoundReady ? [["next", "Nowa tura"]] : [["wait", "Zamknij"]];
      if (canAdvance) actions.push(["tracker", "Dalej w Trackerze"]);
      actions.push(["end", "Zakończ pojedynek"]);
      const lastExchange = state.history.filter(entry => entry.type === "exchange").at(-1);
      const data = await foundry.applications.api.DialogV2.wait({
        window: { title: `Pojedynek — tura ${state.round}, ${state.segment > 3 ? "koniec tury" : `segment ${state.segment}`}` },
        position: { width: 760 }, rejectClose: false, modal: true,
        content: `<div style="display:flex;flex-wrap:wrap;gap:12px;">${summary}</div>
          <p>Zwiększone tempo: ${state.tempo ?? 0}. ${combat ? `Tracker: runda ${combat.round}, segment ${combat.getFlag("neuroshima", "combatSegment") || 1}.` : ""}</p>
          ${lastExchange ? `<p><strong>Ostatni cios:</strong> ${lastExchange.attackSuccesses} sukcesów ataku / ${lastExchange.defenseSuccesses} obrony. ${lastExchange.hit ? "Trafienie." : lastExchange.counterHit ? "Kontrcios przy Furii." : lastExchange.initiativeChanged ? "Przejęcie Inicjatywy." : lastExchange.failedDiceDraw ? "Remis — obie strony bez sukcesów. Inicjatywa bez zmian." : "Brak trafienia."}</p>` : ""}
          ${canAct ? `<p>Zaznacz po jednej kości obu stron albo po 2–3 na cios łączony. Cios łączony wymaga sukcesów ataku. Możesz też zaznaczyć równą liczbę porażek obu stron, aby rozliczyć te segmenty razem jako remis, bez obrażeń i zmiany Inicjatywy. Dostępne sukcesy: ${successfulAttackDice.length}.</p>
          <details><summary>Punkty Umiejętności — popraw lub zepsuj kość</summary>
            <div class="form-group"><label for="melee-spender">Kto wydaje</label><select id="melee-spender" name="fighterId">${actorOptions}</select></div>
            <div class="form-group"><label for="melee-target">Czyja kość</label><select id="melee-target" name="targetId">${actorOptions}</select></div>
            <div class="form-group"><label for="melee-die">Numer kości</label><select id="melee-die" name="die"><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>
            <div class="form-group"><label for="melee-points">Liczba punktów</label><input id="melee-points" name="points" type="number" min="1" step="1" value="1"></div>
            <p>Ustaw wydatek i kliknij „Wydaj punkty”. Własną kość obniżasz, przeciwnika podwyższasz.</p>
          </details>` : ""}`,
        buttons: actions.map(([action, label]) => ({ action, label,
          callback: (event, button) => ({ ...Object.fromEntries(new FormData(button.form)), action }) }))
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
        } else if (data.action === "next" && state.segment > 3) {
          if (combat) assertTrackerNextRound(combat, duel);
          const declarations = await declareManeuvers(configurations, state.initiative, state, null, combat);
          if (!declarations) continue;
          duel = { ...duel, ...(combat ? { trackerRound: combat.round } : {}), state: createMeleeRound({ fighters: await rollFighters(declarations, combat), initiative: state.initiative, round: state.round + 1 }) };
          await save(duel);
        } else if (data.action === "points" && state.segment <= 3) {
          if (combat) assertTrackerExchange(combat, duel);
          const points = data;
          duel = { ...duel, state: spendMeleePoints(state, { fighterId: points.fighterId, targetId: points.targetId, dieIndex: Number(points.die) - 1, points: Number(points.points) }) };
          await save(duel);
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
            defenseDice, attackThreshold: profiles[attackerIndex].attack, defenseThreshold: profiles[defenderIndex].defense });
          duel = { ...duel, state: result.state,
            damageHits: [...(duel.damageHits ?? []), ...createMeleeDamageHits(state, result.exchange, configurations, actors)] };
          await save(duel);
          const exchange = result.exchange;
          selectedDice = {};
          await foundry.documents.ChatMessage.create({ content: `<h3>Pojedynek wręcz — tura ${state.round}, segment ${state.segment}</h3>
            <p>${escape(actors[attackerIndex].name)} → ${escape(actors[defenderIndex].name)}; koszt ${exchange.cost} segmentów.</p>
            <p>Sukcesy ataku: ${exchange.attackSuccesses}; obrony: ${exchange.defenseSuccesses}.</p>
            <p>Atak: ${MELEE_MANEUVER_LABELS[exchange.attackerManeuver]}; obrona: ${MELEE_MANEUVER_LABELS[exchange.defenderManeuver]}; Zwiększone tempo: ${state.tempo ?? 0}.</p>
            ${exchange.counterHit ? `<p>Furia: ${escape(actors[attackerIndex].name)} traci Inicjatywę i otrzymuje cios za ${exchange.counterHitSuccesses} sukces. Obrażenia oczekują na rozliczenie w panelu.</p>` : ""}
            <p>${exchange.hit ? `Trafienie za ${exchange.attackSuccesses} sukcesy. Obrażenia oczekują na rozliczenie w panelu.` : exchange.initiativeChanged ? "Obrońca przejmuje Inicjatywę od następnego segmentu." : exchange.failedDiceDraw ? "Remis — obie strony bez sukcesów. Bez obrażeń, Inicjatywa bez zmian." : "Brak trafienia. Inicjatywa bez zmian."}</p>` });
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
