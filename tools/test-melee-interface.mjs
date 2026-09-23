import test from "node:test";
import assert from "node:assert/strict";
import { openMeleeDuel, openMeleePlayerPanel, handleMeleeRequest, bindMeleePointLimit, bindMeleeDiceSelection, rollMeleeBerserkMorale } from "../scripts/combat/melee-interface.mjs";
import { trackedDuels, findTrackedDuel, meleeTrackerAction } from "../scripts/combat/melee-tracker.mjs";
import { advanceSegmentTurn } from "../scripts/combat/segments.mjs";

function setup(answers, isGM = true, diceSequence = []) {
  const writes = [], messages = [], warnings = [], infos = [], dialogs = [];
  let stored = null, rolls = 0, painRoll = false;
  const actor = id => ({ id, name: id, type: "character", items: [], system: {
    attributes: { zrecznosc: { base: 12 }, budowa: { base: 12 }, charakter: { base: 12 } },
    skills: { bijatyka: { base: 2 }, morale: { base: 4 }, odpornoscNaBol: { base: 0 } }, activeModifiers: [], background: {}
  }, getFlag: () => stored, setFlag: async (system, key, value) => { stored = structuredClone(value); writes.push(value); } });
  const host = actor("a"), opponent = actor("b");
  const actors = [host, opponent];
  actors.get = id => actors.find(entry => entry.id === id);
  const gm = { id: "gm", name: "MG", isGM: true, active: true };
  const player = { id: "player", name: "Tester", isGM: false, active: true };
  const users = [gm, player];
  users.get = id => users.find(entry => entry.id === id);
  for (const current of actors) {
    current.isOwner = true;
    current.testUserPermission = user => user.isGM || (user.id === "player" && current.id === "b");
  }
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } };
  globalThis.game = { actors, user: isGM ? gm : player, users,
    combats: { get: id => game.combat?.id === id ? game.combat : null },
    socket: { emit: () => {}, on: () => {} } };
  globalThis.ui = { notifications: { warn: message => warnings.push(message), info: message => infos.push(message) } };
  globalThis.foundry = { utils: { escapeHTML: value => String(value) }, applications: { api: { DialogV2: {
    wait: async options => {
      dialogs.push(options);
      if (options.window.title === "Wydaj punkty Umiejętności") {
        const selection = answers.shift();
        return selection ? { ...selection, action: selection.action ?? "spend" } : { action: "cancel" };
      }
      const data = answers.shift();
      if (!data) return null;
      if (data.action === "points") {
        const button = options.buttons.find(entry => entry.action === "points");
        return button.callback(null, null, null);
      }
      if (["exchange", "combined"].includes(data.action)) {
        const fields = answers.shift();
        if (!fields) return null;
        if (data.action === "exchange") return { action: "exchange",
          [`attack${fields.attackDie}`]: "on", [`defense${fields.defenseDie}`]: "on" };
        return { ...fields, action: data.action };
      }
      return data;
    },
    input: async options => {
      dialogs.push(options);
      if (options.window.title.startsWith("Obrażenia —")) return { damageCode: "S_D", naturalResult: options.content.match(/name="naturalResult"><option value="(\d+)"/)?.[1] ?? "10", damageType: "blunt", armorPenetration: "0" };
      if (options.window.title.startsWith("Siniaki —")) { painRoll = true; return { attributeKey: "charakter" }; }
      return answers.shift() ?? null;
    }, confirm: async () => true
  } } }, dice: { Roll: class {
    async evaluate() { if (painRoll) { painRoll = false; this.dice = [{results: [3,4,19].map(result => ({result}))}]; return this; } rolls++; this.dice = [{ results: (diceSequence.shift() ?? [3, 6, 19]).map(result => ({ result })) }]; return this; }
    async toMessage(message) { messages.push(message); }
  } }, documents: { ChatMessage: { getSpeaker: ({ actor }) => ({ alias: actor?.name ?? "MG" }), create: async message => messages.push(message) } } };
  for (const actor of actors) {
    actor.items.get = id => actor.items.find(item => item.id === id);
    actor.createEmbeddedDocuments = async (type, data) => {
      const created = data.map(item => ({ ...item, id: item._id }));
      actor.items.push(...created);
      return created;
    };
  }
  return { host, writes, messages, warnings, infos, dialogs, state: () => stored, rolls: () => rolls };
}
const start = [{ opponent: "b" }, { weapon0: "", weapon1: "", skill0: "bijatyka", skill1: "bijatyka", initiative: "a" }, { maneuver0: "standard", maneuver1: "standard", tempo0: "0" }];

test("Okna pojedynku pozostaja niemodalne", async () => {
  const environment = setup([...start]);
  await openMeleeDuel(environment.host);
  assert.ok(environment.dialogs.length > 0);
  assert.equal(environment.dialogs.every(dialog => dialog.modal === false), true);
});

test("Dwa sukcesy ze screena: poprawa wyboru zachowuje kości i rozlicza cios za dwa sukcesy", async () => {
  const environment = setup([...start,
    {action:"combined"},{attack0:true,attack1:true,attack2:true,defense0:true,defense1:true,defense2:true},
    {action:"combined"},{attack0:true,attack1:true,defense0:true,defense1:true},
    {action:"exchange"},{attackDie:"2",defenseDie:"2"}
  ],true,[[2,7,11],[20,17,7]]);
  environment.host.system.attributes.zrecznosc.base = 10;
  game.actors.get("b").system.attributes.zrecznosc.base = 1;
  await openMeleeDuel(environment.host);
  assert.equal(environment.warnings.length,1);
  assert.match(environment.warnings[0],/Kości ataku z porażką: 3/);
  const panels = environment.dialogs.filter(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.match(panels[1].content,/name="attack2"[^>]*type="checkbox"[^>]*checked/);
  const exchanges = environment.state().state.history.filter(entry=>entry.type==="exchange");
  assert.equal(exchanges[0].attackSuccesses,2);
  assert.equal(exchanges[0].hit,true);
  assert.equal(exchanges[0].cost,2);
  assert.equal(exchanges[1].failedDiceDraw,true);
  assert.equal(environment.state().state.segment,4);
  assert.equal(environment.rolls(),2);
});

test("Przycisk panelu rozlicza zaznaczone kości bez dodatkowego okna wyboru", async () => {
  const environment = setup([...start]);
  const originalFormData = globalThis.FormData;
  let clicks = 0;
  globalThis.FormData = class { constructor(form) { return form; } };
  foundry.applications.api.DialogV2.wait = async options => {
    if (clicks++) return null;
    assert.ok(options.content.includes('name="attack0"'));
    assert.ok(options.content.includes('name="defense2"'));
    assert.equal(options.content.includes('name="points"'), false);
    return options.buttons.find(button => button.action === "exchange").callback(null,
      { form: [["attack0", "on"], ["defense2", "on"], ["points", "1"]] });
  };
  try { await openMeleeDuel(environment.host); }
  finally { globalThis.FormData = originalFormData; }
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.segment, 2);
  assert.equal(environment.state().state.history[0].hit, true);
  assert.equal(environment.dialogs.some(dialog => ["Pojedynczy cios", "Cios łączony"].includes(dialog.window.title)), false);
});

test("Przypadek ze screena: 15, 3, 13 przeciw progowi 6 pozwala rozegrać całą rundę", async () => {
  const environment = setup([...start,
    { action: "points" }, { fighterId: "a", targetId: "a", die: "1", points: "3" },
    { action: "exchange" }, { attackDie: "1", defenseDie: "0" },
    { action: "exchange" }, { attackDie: "0", defenseDie: "1" },
    { action: "exchange" }, { attackDie: "2", defenseDie: "2" }
  ], true, [[18, 3, 13], [16, 8, 18]]);
  environment.host.system.attributes.zrecznosc.base = 6;
  environment.host.system.skills.bijatyka.base = 3;
  game.actors.get("b").system.attributes.zrecznosc.base = 1;
  game.actors.get("b").system.skills.bijatyka.base = 0;
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.segment, 4);
  const exchanges = environment.state().state.history.filter(entry => entry.type === "exchange");
  assert.deepEqual(exchanges.map(entry => entry.hit), [true, false, false]);
  const panels = environment.dialogs.filter(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.equal(panels.some(dialog => dialog.content.includes('value="combined"')), false);
  assert.ok(panels.some(dialog => dialog.content.includes("18 → 15 — porażka")));
  assert.ok(panels.some(dialog => dialog.content.includes("3 → 3 — sukces")));
});

test("Panel zapisuje cios i wznawia bez ponownego rzutu", async () => {
  const environment = setup([...start, { action: "exchange" }, { attackDie: "0", defenseDie: "2" }]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.segment, 2);
  assert.equal(environment.state().state.history[0].hit, true);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.messages.length, 5);
  await openMeleeDuel(environment.host);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.state().state.segment, 2);
});

test("Anulowanie ustawień nie rzuca kości i niczego nie zapisuje", async () => {
  for (const answers of [[], [start[0]]]) {
    const environment = setup(answers);
    await openMeleeDuel(environment.host);
    assert.equal(environment.writes.length, 0);
    assert.equal(environment.rolls(), 0);
  }
});

test("Nieprawidłowy wybór kości nie zużywa segmentu", async () => {
  const environment = setup([...start, { action: "exchange" }, { attack0: true }]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.state().state.segment, 1);
  assert.equal(environment.writes.length, 2);
  assert.equal(environment.warnings.length, 1);
});

test("Przegrana Szarża daje karę pierwszej tury i nie zabiera puli punktów walki", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll", charge0: "3" }, start[2]],
    true, [[17, 18, 19], [2, 3, 4]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().opening.winnerId, "b");
  assert.equal(environment.state().state.fighters[0].chargePenalty, 3);
  assert.equal(environment.state().state.fighters[0].spent, 0);
  assert.equal(environment.rolls(), 4);
});

test("Wygrana Szarża daje premię Inicjatywy bez premii do późniejszych ciosów", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll", charge0: "2" }, start[2]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().opening.winnerId, "a");
  assert.equal(environment.state().state.fighters[0].chargePenalty, 0);
  assert.equal(environment.rolls(), 4);
});

test("Remis zachowuje deklaracje i wymaga powtórzenia obu rzutów", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll" }, {}, start[2]],
    true, [[3, 6, 19], [3, 6, 19], [3, 4, 5], [15, 16, 17]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().opening.attempts.length, 2);
  assert.equal(environment.state().opening.winnerId, "a");
  assert.equal(environment.rolls(), 6);
});

test("Zamknięcie przed manewrami zachowuje rozstrzygniętą Inicjatywę", async () => {
  const answers = [start[0], { ...start[1], initiativeMode: "roll", charge0: "1" }, null];
  const environment = setup(answers);
  await openMeleeDuel(environment.host);
  assert.equal(environment.state().state, null);
  assert.equal(environment.rolls(), 2);
  answers.push(start[2]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.rolls(), 4);
  assert.equal(environment.state().opening.attempts.length, 1);
});

test("Szarżujący nie może wybrać Pełnej obrony nawet po wygranej", async () => {
  const environment = setup([start[0], { ...start[1], initiativeMode: "roll", charge0: "1" },
    { maneuver0: "fullDefense" }, start[2]]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.warnings.length, 1);
  assert.match(environment.warnings[0], /Szarża/);
  assert.equal(environment.state().state.fighters[0].maneuver, "standard");
});

test("Edytor punktów wymaga jawnego wyboru przed zapisem", async () => {
  const environment = setup([...start, { action: "points" },
    { fighterId: "a", targetId: "b", die: "1", points: "2" }]);
  await openMeleeDuel(environment.host);
  const editor = environment.dialogs.find(dialog => dialog.window.title === "Wydaj punkty Umiejętności");
  const panel = environment.dialogs.find(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.ok(editor);
  assert.equal(panel.content.includes('name="fighterId"'), false);
  assert.match(editor.content, /a — 2 pkt/);
  assert.match(editor.content, /Kość 1: 3 → 3/);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.fighters[0].spent, 2);
  assert.equal(environment.state().state.fighters[1].dice[0].value, 5);
});

test("Anulowanie edytora nie wydaje domyślnych punktów", async () => {
  const environment = setup([...start, { action: "points" }, null]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.deepEqual(environment.infos, ["Anulowano wydawanie punktów."]);
  assert.equal(environment.state().state.fighters[0].spent, 0);
  assert.equal(environment.state().state.fighters[1].spent, 0);
  assert.deepEqual(environment.state().state.fighters[0].dice.map(die => die.value), [3, 6, 19]);
  assert.deepEqual(environment.state().state.fighters[1].dice.map(die => die.value), [3, 6, 19]);
});

test("Gracz nie może prowadzić panelu MG", async () => {
  const environment = setup([...start], false);
  await openMeleeDuel(environment.host);
  assert.equal(environment.writes.length, 0);
  assert.equal(environment.rolls(), 0);
});

test("Zwiększone tempo podnosi PT obu stron, Furia dodaje bonus tylko do ataku", async () => {
  const environment = setup([...start.slice(0, 2), { maneuver0: "fury", maneuver1: "fullDefense", tempo0: "2" },
    { action: "exchange" }, { attackDie: "0", defenseDie: "1" }]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  const exchange = environment.state().state.history[0];
  assert.equal(exchange.attackThreshold, 9);
  assert.equal(exchange.defenseThreshold, 9);
  assert.equal(environment.state().state.tempo, 2);
  assert.match(environment.messages[0].flavor, /Furia/);
  assert.match(environment.messages[0].flavor, /Wsp.*tempo: 2/);
  assert.match(environment.messages[1].flavor, /Wsp.*tempo: 2/);
});



test("Ujemny próg jest jednoznaczny i oznacza niemożliwy sukces", async () => {
  const environment = setup([...start.slice(0, 2),
    { maneuver0: "standard", maneuver1: "fullDefense", tempo0: "3" }]);
  environment.host.system.skills.bijatyka.base = 3;
  const defender = game.actors.get("b");
  defender.system.attributes.zrecznosc.base = 5;
  defender.items.push({ type: "injury", system: { penaltyPercent: 15 } });
  await openMeleeDuel(environment.host);
  const panel = environment.dialogs.find(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.match(panel.content, /próg <strong>−4<\/strong> — <strong>sukces niemożliwy<\/strong>/);
  assert.deepEqual(environment.warnings, []);
});

test("Błędna deklaracja nie rzuca kości; można poprawić wybór przed turą", async () => {
  const environment = setup([...start.slice(0, 2), { maneuver0: "fullDefense", tempo0: "1" },
    { maneuver0: "standard", maneuver1: "standard", tempo0: "1" }]);
  await openMeleeDuel(environment.host);
  assert.equal(environment.warnings.length, 1);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.state().state.tempo, 1);
});

test("Anulowanie deklaracji następnej tury zachowuje stare kości", async () => {
  const answers = [...start, { action: "exchange" }, { attackDie: "0", defenseDie: "0" },
    { action: "exchange" }, { attackDie: "1", defenseDie: "1" },
    { action: "exchange" }, { attackDie: "2", defenseDie: "2" }, { action: "next" }, null];
  const environment = setup(answers);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.rolls(), 2);
  assert.equal(environment.state().state.segment, 4);
  assert.equal(environment.state().state.round, 1);
});

test("Test Morale włącza Berserka obrońcy i zmienia jego kości w kontratak", async () => {
  const environment = setup([...start, { action: "berserk" }], true,
    [[3, 6, 19], [3, 6, 19], [1, 2, 3]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  const defender = environment.state().state.fighters.find(fighter => fighter.id === "b");
  assert.equal(defender.berserk, true);
  assert.equal(defender.berserkAttemptedRound, 1);
  assert.equal(environment.state().state.history.at(-1).type, "berserk");
  assert.equal(environment.rolls(), 3);
  const panels = environment.dialogs.filter(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.match(panels.at(-1).content, /atakuje jako berserker/);
  assert.match(panels.at(-1).content, /Obie strony atakują/);
  assert.ok(environment.messages.some(message => message.flavor?.includes("Tryb Berserka — test Morale")));
});

test("Automatyczny Berserk bestii lub robota nie wymaga testu Morale", async () => {
  const environment = setup([start[0], { ...start[1], automaticBerserk1: "on" }, start[2]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.state().state.fighters.find(fighter => fighter.id === "b").berserk, true);
  assert.equal(environment.rolls(), 2);
  const panel = environment.dialogs.find(dialog => dialog.window.title.startsWith("Pojedynek —"));
  assert.match(panel.content, /atakuje jako berserker/);
  assert.equal(panel.content.includes("Test Morale — Berserk"), false);
});

test("Panel rozlicza 3 sukcesy atakującego przeciw 2 sukcesom Berserkera", async () => {
  const environment = setup([start[0], { ...start[1], automaticBerserk1: "on" }, start[2],
    { action: "combined" },
    { attack0: true, attack1: true, attack2: true, defense0: true, defense1: true, defense2: true }
  ], true, [[3, 4, 5], [5, 19, 6]]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  const exchange = environment.state().state.history.find(entry => entry.type === "exchange");
  assert.equal(exchange.attackSuccesses, 3);
  assert.equal(exchange.hit, true);
  assert.equal(exchange.berserkHitSuccesses, 2);
  assert.equal(exchange.berserkHit, true);
  assert.equal(exchange.cost, 3);
  assert.equal(environment.state().state.segment, 4);
  assert.equal(environment.state().damageHits.length, 2);
});

test("Faktyczna kara pancerza ułatwia test Morale Berserka", async () => {
  const environment = setup([], true, [[7, 8, 19]]);
  environment.host.items.push({ type: "armor", system: { equipped: true, penaltyScope: "dexterity", penaltyPercent: 30 } });
  const result = await rollMeleeBerserkMorale(environment.host);
  assert.equal(result.armorAid, 30);
  assert.equal(result.finalDifficulty, 3);
  assert.match(environment.messages[0].flavor, /Kara pancerza pomaga: −30 PT/);
});

function attachCombat() {
  const flags = { combatSegment: 1, meleeDuels: [] };
  const segmentActions = {};
  const participants = game.actors.map(actor => ({ id: actor.id, actor,
    getFlag: (scope, key) => key === "segmentAction" ? segmentActions[actor.id] ?? null : null,
    async setFlag(scope, key, value) { if (key === "segmentAction") segmentActions[actor.id] = structuredClone(value); } }));
  const combat = { id: "combat", started: true, round: 1, turn: 0, combatants: participants, turns: participants,
    get combatant() { return participants[this.turn]; },
    getFlag: (scope, key) => flags[key],
    async setFlag(scope, key, value) { flags[key] = structuredClone(value); },
    async update(data) {
      if (data.turn !== undefined) this.turn = data.turn;
      if (data["flags.neuroshima.combatSegment"] !== undefined) flags.combatSegment = data["flags.neuroshima.combatSegment"];
      return this;
    } };
  foundry.documents.Combat = class {
    async nextTurn() { this.turn++; return this; }
    async nextRound() { this.round++; this.turn = 0; return this; }
  };
  combat.segmentActions = segmentActions;
  game.combat = combat;
  return combat;
}

test("Gracz widzi jawne kości i może zapisać wybór oraz wydać własne punkty", async () => {
  const answers = [...start];
  const environment = setup(answers);
  const combat = attachCombat();
  await openMeleeDuel(environment.host);
  game.user = game.users.get("player");
  answers.push({ action: "close" });
  await openMeleePlayerPanel(game.actors.get("b"));
  const panel = environment.dialogs.find(dialog => dialog.window.title.startsWith("Decyzje pojedynku"));
  assert.ok(panel);
  assert.match(panel.content, /Kość 1: 3 → 3 — sukces/);
  assert.match(panel.content, /Punkty Umiejętności: <strong>2\/2/);
  assert.ok(panel.buttons.some(button => button.action === "select"));
  assert.ok(panel.buttons.some(button => button.action === "points"));
  assert.match(panel.content, /Wybór przeciwnika:<\/strong> jeszcze nie zapisany/);

  let duel = findTrackedDuel(combat, "b");
  await combat.setFlag("neuroshima", "meleeDuels", trackedDuels(combat).map(entry => entry.hostId === duel.hostId
    ? { ...entry, playerSelections: { a: { round: entry.state.round, segment: entry.state.segment, dice: [0, 2] } } }
    : entry));
  answers.push({ action: "close" });
  await openMeleePlayerPanel(game.actors.get("b"));
  const refreshedPanel = environment.dialogs.filter(dialog => dialog.window.title.startsWith("Decyzje pojedynku")).at(-1);
  assert.match(refreshedPanel.content, /Wybór przeciwnika:<\/strong> 2 kości/);
  assert.doesNotMatch(refreshedPanel.content, /Wybór przeciwnika:[\s\S]*kości 1, 3/);

  game.user = game.users.get("gm");
  duel = findTrackedDuel(combat, "b");
  const base = { type: "meleeRequest", requestId: "request", userId: "player",
    combatId: combat.id, hostId: duel.hostId, actorId: "b",
    round: duel.state.round, segment: duel.state.segment };
  await handleMeleeRequest({ ...base, action: "selectDice", dice: [0, 1] });
  duel = findTrackedDuel(combat, "b");
  assert.deepEqual(duel.playerSelections.b.dice, [0, 1]);
  await handleMeleeRequest({ ...base, action: "spendPoints", targetId: "a", dieIndex: 0, points: 1 });
  duel = findTrackedDuel(combat, "b");
  assert.equal(duel.state.fighters.find(fighter => fighter.id === "b").spent, 1);
  assert.equal(duel.state.fighters.find(fighter => fighter.id === "a").dice[0].value, 4);
  assert.deepEqual(duel.playerSelections, {});
});

test("Albert może rozpocząć pojedynek po wcześniejszym Pasie Ulricha w tym samym segmencie", async () => {
  const answers = [{ opponent: "a" },
    { weapon0: "", weapon1: "", skill0: "bijatyka", skill1: "bijatyka", initiative: "b" },
    { maneuver0: "standard", maneuver1: "standard", tempo0: "0" }];
  const environment = setup(answers);
  const combat = attachCombat();
  combat.segmentActions.a = { name: "Pas", actionCode: "pass", duration: 1,
    startedRound: 1, startedSegment: 1, startedAtTick: 1, endsAtTick: 1 };
  combat.turn = 1;
  await openMeleeDuel(game.actors.get("b"));
  assert.deepEqual(environment.warnings, []);
  const duel = findTrackedDuel(combat, "b");
  assert.ok(duel);
  assert.equal(duel.trackerStartSegment, 1);
  assert.equal(duel.state.segment, 1);
  assert.equal(environment.rolls(), 2);
});

test("Start w trzecim segmencie przerywa strzał i rozlicza jedną wymianę", async () => {
  const answers = [...start, { action: "exchange" }, { attackDie: "0", defenseDie: "0" }];
  const environment = setup(answers, true, [[19, 3, 4], [19, 6, 7]]);
  const combat = attachCombat();
  await combat.setFlag("neuroshima", "combatSegment", 3);
  combat.segmentActions.b = { name: "Strzał celowany", effectCode: "rangedShot",
    startedAtTick: 1, endsAtTick: 3, resolved: false };
  await openMeleeDuel(environment.host);
  const duel = findTrackedDuel(combat, "a");
  assert.deepEqual(environment.warnings, []);
  assert.equal(duel.trackerStartSegment, 3);
  assert.equal(duel.state.segment, 4);
  assert.equal(duel.state.history.filter(entry => entry.type === "exchange").length, 1);
  const firstPanel = environment.dialogs.find(dialog => dialog.window.title === "Pojedynek — tura 1, segment 3");
  assert.match(firstPanel.content, /Pozostał 1 segment tej rundy/);
  assert.match(firstPanel.content, /data-melee-dice="attack"/);
  assert.equal(typeof firstPanel.render, "function");
  assert.equal(combat.segmentActions.b.interrupted, true);
  assert.equal(combat.segmentActions.b.resolved, true);
  assert.match(combat.segmentActions.b.resolution, /brak strzału/);
  assert.equal(combat.round, 2);
  assert.equal(environment.rolls(), 2);
  answers.push({ action: "next" }, start[2]);
  await openMeleeDuel(environment.host);
  assert.equal(findTrackedDuel(combat, "a").trackerStartSegment, 1);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 1);
  assert.equal(environment.rolls(), 4);
});

test("Remis całej puli kończy turę Trackera bez okna obrażeń", async () => {
  const environment = setup([...start, {action:"combined"},
    {attack0:true,attack1:true,attack2:true,defense0:true,defense1:true,defense2:true}],true,[[12,20,11],[4,15,2]]);
  environment.host.system.attributes.zrecznosc.base = 10;
  game.actors.get("b").system.attributes.zrecznosc.base = 1;
  const combat = attachCombat();
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  const duel = findTrackedDuel(combat,"a");
  assert.equal(duel.state.initiative,"a");
  assert.equal(duel.state.segment,4);
  assert.deepEqual(duel.damageHits,[]);
  assert.equal(combat.round,2);
  assert.equal(environment.dialogs.some(dialog=>dialog.window.title.startsWith("Obrażenia —")),false);
  assert.ok(environment.messages.some(message=>message.content?.includes("Remis — obie strony bez sukcesów")));
});

test("Panel Trackera zapisuje jedną wymianę obu postaci i wznawia z karty przeciwnika", async () => {
  const answers = [...start, { action: "exchange" }, { attackDie: "0", defenseDie: "2" }];
  const environment = setup(answers);
  const combat = attachCombat();
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(environment.writes.length, 0);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 2);
  assert.equal(meleeTrackerAction(combat, "a").duration, 1);
  assert.equal(meleeTrackerAction(combat, "b").duration, 1);
  await openMeleeDuel(game.actors.get("b"));
  assert.equal(environment.rolls(), 2);
  // Kolejna wymiana odbywa się nadal w pierwszym segmencie Trackera.
  answers.push({ action: "exchange" }, { attackDie: "1", defenseDie: "0" });
  await openMeleeDuel(game.actors.get("b"));
  assert.equal(findTrackedDuel(combat, "a").state.segment, 3);
  assert.equal(combat.getFlag("neuroshima", "combatSegment"), 1);
  assert.equal(environment.rolls(), 2);
});

test("Nowa runda Trackera daje nowe kości dopiero po deklaracji manewrów", async () => {
  const answers = [...start, { action: "combined" }, { attack0: true, attack1: true, attack2: true, defense0: true, defense1: true, defense2: true }];
  const environment = setup(answers, true, [[2, 3, 4], [12, 13, 14]]);
  const combat = attachCombat();
  await openMeleeDuel(environment.host);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 4);
  assert.equal(environment.rolls(), 2);
  assert.equal(combat.round, 2);
  combat.round = 2;
  answers.push({ action: "next" }, start[2]);
  await openMeleeDuel(environment.host);
  assert.deepEqual(environment.warnings, []);
  assert.equal(findTrackedDuel(combat, "a").trackerRound, 2);
  assert.equal(findTrackedDuel(combat, "a").state.round, 2);
  assert.equal(findTrackedDuel(combat, "a").state.segment, 1);
  assert.equal(environment.rolls(), 4);
});

test("Anulowane obrażenia ostatniego ciosu blokują Tracker; wznowienie rani token, nie wzorzec", async () => {
  const environment = setup([...start, { action:"combined" },
    {attack0:true,attack1:true,attack2:true,defense0:true,defense1:true,defense2:true}],true,[[3,4,5],[13,14,15]]);
  const combat = attachCombat();
  const worldActor = game.actors.get("b");
  const tokenActor = { ...worldActor, items: [] };
  tokenActor.items.get = id => tokenActor.items.find(item => item.id === id);
  tokenActor.createEmbeddedDocuments = async (type,data) => {
    const created = data.map(item => ({...item,id:item._id})); tokenActor.items.push(...created); return created;
  };
  combat.combatants[1].actor = tokenActor;
  const originalInput = foundry.applications.api.DialogV2.input;
  foundry.applications.api.DialogV2.input = async options => options.window.title.startsWith("Obrażenia —") ? null : originalInput(options);
  await openMeleeDuel(environment.host);
  assert.equal(findTrackedDuel(combat,"a").state.segment,4);
  assert.equal(findTrackedDuel(combat,"a").damageHits[0].completed,false);
  await advanceSegmentTurn(combat);
  assert.equal(combat.round,1);
  assert.equal(combat.turn,0);
  foundry.applications.api.DialogV2.input = originalInput;
  await openMeleeDuel(environment.host);
  assert.equal(combat.round,2);
  assert.equal(tokenActor.items.length,1);
  assert.equal(worldActor.items.length,0);
  assert.equal(environment.rolls(),2);
});

test("Panel ogranicza wybór kości do pozostałych segmentów", () => {
  const input = checked => ({ checked, disabled: false, listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; } });
  const attack = [input(true), input(true), input(true)];
  const defense = [input(true), input(true), input(false)];
  const root = { querySelectorAll: selector => selector.includes('"attack"') ? attack : defense };
  bindMeleeDiceSelection(root, 1);
  assert.deepEqual(attack.map(entry => entry.checked), [true, false, false]);
  assert.deepEqual(defense.map(entry => entry.checked), [true, false, false]);
  attack[1].checked = true;
  attack[1].listeners.change();
  assert.equal(attack[1].checked, false);
});

 test("Limit punktów: pula 4, wpisane 10, zmiana na postać bez punktów", () => {
  const field = value => ({value,listeners:{},addEventListener(type,handler){this.listeners[type]=handler;}});
  const spender = field("a"), points = field("10"), button = {}, hint = {};
  const elements = {'[name="fighterId"]':spender,'[name="points"]':points,'button[data-action="points"]':button,'[data-point-limit]':hint};
  bindMeleePointLimit({querySelector:selector=>elements[selector]},[{id:"a",skill:8,spent:4},{id:"b",skill:3,spent:3}]);
  assert.equal(points.max,"4");
  assert.equal(points.value,"4");
  points.value="10"; points.listeners.input();
  assert.equal(points.value,"4");
  spender.value="b"; spender.listeners.change();
  assert.equal(points.max,"0");
  assert.equal(points.disabled,true);
  assert.equal(button.disabled,true);
  spender.value="a"; spender.listeners.change();
  assert.equal(points.disabled,false);
  assert.equal(button.disabled,false);
  assert.equal(points.value,"1");
});

test("Edytor pokazuje aktualne wyniki kości wybranej postaci", () => {
  const field = value => ({ value, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } });
  const spender = field("a"), target = field("a"), points = field("1"), button = {}, hint = {};
  const dieSelect = { value: "1", options: [
    { value: "1", textContent: "", disabled: false },
    { value: "2", textContent: "", disabled: false },
    { value: "3", textContent: "", disabled: false }
  ] };
  const elements = {
    '[name="fighterId"]': spender, '[name="targetId"]': target, '[name="die"]': dieSelect,
    '[name="points"]': points, 'button[data-action="spend"]': button, '[data-point-limit]': hint
  };
  const fighters = [
    { id: "a", skill: 8, spent: 0, dice: [
      { natural: 10, value: 7, used: false }, { natural: 9, value: 9, used: false }, { natural: 4, value: 4, used: false }
    ] },
    { id: "b", skill: 4, spent: 0, dice: [
      { natural: 20, value: 20, used: true }, { natural: 13, value: 15, used: false }, { natural: 7, value: 7, used: false }
    ] }
  ];
  const thresholdHint = {};
  elements['[data-target-threshold]'] = thresholdHint;
  bindMeleePointLimit({ querySelector: selector => elements[selector] }, fighters, { a: 7, b: -4 });
  assert.equal(dieSelect.options[0].textContent, "Kość 1: 10 → 7 — sukces (próg 7)");
  target.value = "b";
  target.listeners.change();
  assert.equal(dieSelect.options[0].textContent, "Kość 1: 20 → 20 — porażka (próg −4) — zużyta");
  assert.equal(dieSelect.options[1].textContent, "Kość 2: 13 → 15 — porażka (próg −4)");
  assert.match(thresholdHint.textContent, /Próg wybranej postaci: −4.*Sukces jest niemożliwy/);
  assert.equal(dieSelect.options[0].disabled, true);
  assert.equal(dieSelect.value, "2");
});
