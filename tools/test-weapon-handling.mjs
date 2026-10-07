import assert from "node:assert/strict";
import { test } from "node:test";
import { requestWeaponHandling, resolveWeaponHandling, applyWeaponHandling, requestHeldEquipmentChange } from "../scripts/combat/weapon-handling.mjs";
import { weaponHandlingState, usableFirearms, planWeaponHandling, handlingSnapshot } from "../scripts/combat/weapon-handling-state.mjs";
import { advanceSegmentTurn, advanceSegmentRound, prepareActorCombatStatus, interruptSegmentAction, finishSegmentAction, declareSegmentAction, configureCurrentAiming } from "../scripts/combat/segments.mjs";
import { resolveSingleShot, startWeaponShot } from "../scripts/combat/ranged-shot.mjs";
import { prepareWeaponGuidance } from "../scripts/sheets/weapon-guidance.mjs";

function fixture({ inCombat = true, reloadTime = 3 } = {}) {
  class ForcedDeletion {}
  function update(object, changes) {
    for (const [key, value] of Object.entries(changes)) {
      const path = key.split("."); const last = path.pop();
      const target = path.reduce((o, part) => o[part] ??= {}, object);
      if (value instanceof ForcedDeletion) delete target[last];
      else target[last] = structuredClone(value);
    }
  }
  const item = (id, type, system) => ({ id, name: id, type, system, flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; }, async update(data) { update(this, data); } });
  const gun = item("gun", "weapon", { weaponClass: "PISTOL", requiresPreparation: true, prepared: false, safetyOn: false,
    needsCycling: false, requiredHands: 1, jamState: "ready", ammunitionCode: "9mm",
    currentAmmunition: 0, magazineCapacity: 10, loadedAmmunitionSourceCode: "", reloadTime });
  const ammo = item("ammo", "ammunition", { ammunitionSymbol: "9mm", quantity: 20, sourceCode: "AMMO_9",
    unitWeightInKilograms: 0.02 });
  const items = [gun, ammo]; items.get = id => items.find(item => item.id === id);
  const messages = [], warnings = [], dialogs = [], writes = [];
  let answers = [], nextId = 0;
  const actor = { id: "actor", uuid: "Actor.actor", name: "Postać", isOwner: true, items,
    flags: {}, system: { hands: { left: "", right: "" } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(data) { writes.push(data); update(this, data); },
    async updateEmbeddedDocuments(type, changes) { writes.push(changes); changes.forEach(data => update(items.get(data._id), data)); } };
  const combatant = { id: "participant", actor, flags: {},
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async setFlag(scope, key, value) { this.flags[scope] ??= {}; this.flags[scope][key] = { ...this.flags[scope][key], ...structuredClone(value) }; },
    async update(data) { for (const [key, value] of Object.entries(data.flags.neuroshima)) {
      this.flags.neuroshima ??= {}; if (value instanceof ForcedDeletion) delete this.flags.neuroshima[key];
      else this.flags.neuroshima[key] = value;
    } } };
  const combat = { started: inCombat, round: 1, turn: 0, combatant, turns: [combatant], combatants: [combatant],
    flags: { combatSegment: 1 }, getFlag(scope, key) { return this.flags[key]; },
    async setFlag(scope, key, value) { this.flags[key] = value; },
    getCombatantsByActor: value => value === actor ? [combatant] : [],
    async update(changes) { if (changes.round) this.round = changes.round; this.turn = changes.turn ?? this.turn;
      if (changes["flags.neuroshima.combatSegment"]) this.flags.combatSegment = changes["flags.neuroshima.combatSegment"];
      return this; } };
  globalThis.game = { combat: inCombat ? combat : null, user: { isGM: true } };
  globalThis.foundry = { data: { operators: { ForcedDeletion } }, utils: { escapeHTML: String, randomID: () => `action${++nextId}` },
    applications: { api: { DialogV2: { input: async options => { dialogs.push(options); return answers.shift() ?? null; } } } },
    documents: { ChatMessage: { getSpeaker: () => ({}), create: async data => messages.push(data) }, Combat: class {
      async nextRound() { this.round++; this.turn = 0; return this; }
      async nextTurn() { this.turn++; return this; }
    } } };
  globalThis.ui = { notifications: { warn: text => warnings.push(text), info: text => messages.push(text) } };
  const action = () => combatant.getFlag("neuroshima", "segmentAction");
  const reply = (...values) => { answers = values; };
  return { actor, gun, ammo, combat, combatant, writes, messages, warnings, dialogs, action, reply };
}

test("dobycie dopiero w drugim segmencie, potem przygotowanie i gotowość do strzału", async () => {
  const f = fixture();
  f.gun.system.currentAmmunition = 1;
  f.reply({ grip: "right" });
  assert.equal(await requestWeaponHandling(f.actor, "drawWeapon", "gun"), true);
  assert.equal(f.actor.system.hands.right, "");
  assert.equal(usableFirearms(f.actor).length, 0);
  assert.equal(await resolveWeaponHandling(f.actor), false);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.actor.system.hands.right, "gun");
  assert.equal(f.action().resolved, true);
  assert.equal(usableFirearms(f.actor).length, 0);
  await advanceSegmentTurn(f.combat);
  f.reply({});
  assert.equal(await requestWeaponHandling(f.actor, "readyWeapon", "gun"), true);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.combat.round, 2);
  assert.equal(f.gun.system.prepared, true);
  assert.equal(usableFirearms(f.actor).length, 1);
});

test("przeładowanie 9 segmentów przechodzi przez rundy i przenosi naboje tylko na końcu", async () => {
  const f = fixture({ reloadTime: 9 });
  f.actor.system.hands.right = "gun";
  f.reply({ ammunitionId: "ammo", amount: "10" });
  assert.equal(await requestWeaponHandling(f.actor, "changeMagazine", "gun"), true);
  assert.equal(f.action().duration, 9);
  assert.equal(prepareActorCombatStatus(f.actor).action.canFinishEarly, false);
  assert.equal(await finishSegmentAction(f.actor), false);
  for (let tick = 2; tick <= 9; tick++) {
    await advanceSegmentTurn(f.combat);
    assert.equal(f.gun.system.currentAmmunition, tick === 9 ? 10 : 0);
    assert.equal(f.ammo.system.quantity, tick === 9 ? 10 : 20);
  }
  assert.equal(f.combat.round, 3);
  assert.equal(f.action().resolved, true);
  assert.equal(await resolveWeaponHandling(f.actor), false);
  assert.equal(f.writes.length, 1);
});

test("przerwanie zachowuje nabój, zapas i dłonie, ale wykorzystuje bieżący segment", async () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  f.reply({ ammunitionId: "ammo", amount: "10" });
  await requestWeaponHandling(f.actor, "changeMagazine", "gun");
  await advanceSegmentTurn(f.combat);
  await interruptSegmentAction(f.actor);
  assert.equal(prepareActorCombatStatus(f.actor).canDeclareAction, false);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.gun.system.currentAmmunition, 0);
  assert.equal(f.ammo.system.quantity, 20);
  assert.equal(f.actor.system.hands.right, "gun");
  assert.equal(f.writes.length, 0);
});

test("anulowanie formularza nie zajmuje segmentu", async () => {
  const f = fixture(); f.reply(null);
  assert.equal(await requestWeaponHandling(f.actor, "drawWeapon", "gun"), false);
  assert.equal(f.action(), undefined);
  assert.equal(f.writes.length, 0);
});

test("zajęte dłonie, niepoprawny chwyt i za mały zapas blokują deklarację", async () => {
  const f = fixture();
  f.actor.system.hands.right = "ammo";
  f.reply({ grip: "right" });
  assert.equal(await requestWeaponHandling(f.actor, "drawWeapon", "gun"), false);
  f.gun.system.requiredHands = 2;
  assert.throws(() => planWeaponHandling(f.actor, { code: "drawWeapon", weaponId: "gun", grip: "left" }), /obu dłoni/);
  f.actor.system.hands = { right: "gun", left: "ammo" };
  f.reply({ ammunitionId: "ammo", amount: "10" });
  assert.equal(await requestWeaponHandling(f.actor, "changeMagazine", "gun"), false);
  f.actor.system.hands.left = ""; f.ammo.system.quantity = 3;
  f.reply({ ammunitionId: "ammo", amount: "10" });
  assert.equal(await requestWeaponHandling(f.actor, "changeMagazine", "gun"), false);
  assert.equal(f.action(), undefined);
  assert.equal(f.writes.length, 0);
});

test("zmiana amunicji podczas akcji blokuje rozliczenie i przejście dalej do przerwania", async () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  f.reply({ ammunitionId: "ammo", amount: "10" });
  await requestWeaponHandling(f.actor, "changeMagazine", "gun");
  f.ammo.system.quantity = 19;
  await advanceSegmentTurn(f.combat); await advanceSegmentTurn(f.combat);
  assert.equal(f.gun.system.currentAmmunition, 0);
  assert.equal(f.ammo.system.quantity, 19);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.combat.round, 1);
  assert.equal(f.combat.flags.combatSegment, 3);
  await interruptSegmentAction(f.actor);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.combat.round, 2);
});

test("przeskok rundy nie pomija zakończenia obsługi broni", async () => {
  const f = fixture(); f.reply({ grip: "both" });
  await requestWeaponHandling(f.actor, "drawWeapon", "gun");
  await advanceSegmentRound(f.combat);
  assert.equal(f.combat.round, 1);
  assert.equal(f.actor.system.hands.left, "");
});

test("powtórka po zapisie danych i błędzie flagi nie ładuje amunicji ponownie", async () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  const configuration = { id: "receipt", code: "changeMagazine", weaponId: "gun", ammunitionId: "ammo", amount: 5,
    snapshot: handlingSnapshot(f.actor, f.gun, f.ammo) };
  await applyWeaponHandling(f.actor, configuration);
  await applyWeaponHandling(f.actor, configuration);
  assert.equal(f.ammo.system.quantity, 15);
  assert.equal(f.gun.system.currentAmmunition, 5);
  assert.equal(f.writes.length, 1);
});

test("wariant amunicji i jego masa są zachowane, mieszanie wariantów jest blokowane", async () => {
  const f = fixture({ inCombat: false }); f.actor.system.hands.right = "gun";
  f.reply({ ammunitionId: "ammo", amount: "4" });
  await requestWeaponHandling(f.actor, "changeMagazine", "gun");
  assert.equal(f.gun.system.loadedAmmunitionUnitWeight, 0.02);
  assert.equal(f.gun.system.loadedAmmunitionSourceCode, "AMMO_9");
  f.ammo.system.sourceCode = "OTHER";
  f.reply({ ammunitionId: "ammo", amount: "4" });
  assert.equal(await requestWeaponHandling(f.actor, "changeMagazine", "gun"), false);
  assert.equal(f.gun.system.currentAmmunition, 4);
  assert.equal(f.ammo.system.quantity, 16);
});

test("przygotowanie nie usuwa zacięcia ani zabezpieczenia; odbezpieczenie zajmuje jeden segment", async () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  f.gun.system.jamState = "minor"; f.gun.system.safetyOn = true;
  f.reply({}); await requestWeaponHandling(f.actor, "readyWeapon", "gun");
  await advanceSegmentTurn(f.combat);
  assert.equal(f.gun.system.jamState, "minor"); assert.equal(f.gun.system.safetyOn, true);
  await advanceSegmentTurn(f.combat);
  f.reply({}); await requestWeaponHandling(f.actor, "safetyOff", "gun");
  assert.equal(f.gun.system.safetyOn, false);
  assert.equal(f.action().resolved, true);
  assert.equal(prepareActorCombatStatus(f.actor).canDeclareAction, false);
});

test("strzał wymaga chwytu, przygotowania, sprawności, odbezpieczenia i naboju", () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  Object.assign(f.gun.system, { prepared: true, currentAmmunition: 2 });
  assert.equal(weaponHandlingState(f.actor, f.gun).canShoot, true);
  for (const changes of [{prepared:false}, {safetyOn:true}, {needsCycling:true}, {jamState:"minor"}, {currentAmmunition:0}, {requiredHands:2}]) {
    const before = {...f.gun.system}; Object.assign(f.gun.system, changes);
    assert.equal(weaponHandlingState(f.actor, f.gun).canShoot, false);
    f.gun.system = before;
  }
  f.actor.system.hands.right = "";
  assert.equal(usableFirearms(f.actor).length, 0);
});

test("ładowanie bębna dodaje dokładnie jeden nabój po trzech segmentach", async () => {
  const f = fixture(); f.actor.system.hands.right = "gun"; f.gun.system.weaponClass = "REVOLVER";
  f.reply({ammunitionId:"ammo",amount:"1"});
  await requestWeaponHandling(f.actor,"loadRevolverRound","gun");
  await advanceSegmentTurn(f.combat); await advanceSegmentTurn(f.combat);
  assert.equal(f.gun.system.currentAmmunition, 1); assert.equal(f.ammo.system.quantity, 19);
});

test("brak czasu katalogowego wymaga kosztu ustalonego z MG", async () => {
  const f = fixture({ reloadTime: 0 }); f.actor.system.hands.right = "gun";
  f.reply({ammunitionId:"ammo", amount:"5", duration:""});
  assert.equal(await requestWeaponHandling(f.actor,"changeMagazine","gun"),false);
  f.reply({ammunitionId:"ammo", amount:"5", duration:"6"});
  await requestWeaponHandling(f.actor,"changeMagazine","gun");
  assert.equal(f.action().duration,6);
});

test("odłożenie / zmiana chwytu zajmuje uzgodniony czas i nie dobywa nowej broni", async () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  const snapshot = JSON.stringify(f.actor.system.hands);
  assert.equal(await requestHeldEquipmentChange(f.actor,{left:"ammo",right:"gun"},1,snapshot),false);
  assert.equal(await requestHeldEquipmentChange(f.actor,{left:"",right:""},2,snapshot),true);
  assert.equal(f.actor.system.hands.right,"gun");
  await advanceSegmentTurn(f.combat);
  assert.equal(f.actor.system.hands.right,"");
});

test("poza swoją kolejką i bez uprawnień czynność nie zmienia stanu", async () => {
  const f=fixture(); f.combat.combatant={id:"other"};
  assert.equal(await requestWeaponHandling(f.actor,"drawWeapon","gun"),false);
  f.combat.combatant=f.combatant; f.actor.isOwner=false;
  assert.equal(await requestWeaponHandling(f.actor,"drawWeapon","gun"),false);
  assert.equal(f.writes.length,0); assert.equal(f.dialogs.length,0);
});

async function shotFixture({ natural = 18, reliability = 20 } = {}) {
  const f = fixture();
  Object.assign(f.actor.system, { attributes: { zrecznosc: { base: 12 } }, skills: { pistolety: { base: 0 } }, background: {}, activeModifiers: [] });
  f.actor.system.hands.right = "gun";
  Object.assign(f.gun.system, { currentAmmunition: 2, prepared: true, requiresCycling: true, misfireRoll: reliability, accuracyModifier: 0 });
  globalThis.canvas = { tokens: { get: () => ({ id: "target", name: "Cel" }) } };
  let rolls = 0;
  foundry.dice = { Roll: class {
    async evaluate() { this.dice = [{ results: [{ result: rolls++ === 0 ? natural : 5 }] }]; return this; }
    async toMessage(data) { f.messages.push(data); }
  } };
  await declareSegmentAction(f.actor, "Strzał", 1, { actionCode: "shot", effectCode: "rangedShot" });
  await configureCurrentAiming(f.actor, { weaponId: "gun", targetTokenId: "target" });
  f.reply({ skillKey: "pistolety" });
  return { ...f, rolls: () => rolls };
}

test("strzał odejmuje jeden nabój, wymaga cyklu i nie powtarza się po podwójnym kliknięciu", async () => {
  const f = await shotFixture();
  const results = await Promise.all([resolveSingleShot(f.actor), resolveSingleShot(f.actor)]);
  assert.deepEqual(results, [true, false]);
  assert.equal(f.gun.system.currentAmmunition, 1);
  assert.equal(f.gun.system.needsCycling, true);
  assert.equal(f.rolls(), 1);
  assert.equal(await resolveSingleShot(f.actor), false);
  await advanceSegmentTurn(f.combat);
  f.reply({});
  assert.equal(await requestWeaponHandling(f.actor, "pumpAction", "gun"), true);
  assert.equal(f.gun.system.needsCycling, false);
  assert.equal(f.gun.system.currentAmmunition, 1);
  assert.equal(f.action().resolved, true);
});

test("zacięcie nie odejmuje naboju i nie uruchamia cyklu po wystrzale", async () => {
  const f = await shotFixture({ natural: 20, reliability: 10 });
  await resolveSingleShot(f.actor);
  assert.equal(f.gun.system.currentAmmunition, 2);
  assert.equal(f.gun.system.jamState, "minor");
  assert.equal(f.gun.system.needsCycling, false);
  assert.equal(f.action().resolved, true);
});

test("odłożenie broni podczas okna strzału blokuje rzut oraz zużycie naboju", async () => {
  const f = await shotFixture();
  foundry.applications.api.DialogV2.input = async () => { f.actor.system.hands.right = ""; return { skillKey: "pistolety" }; };
  assert.equal(await resolveSingleShot(f.actor), false);
  assert.equal(f.rolls(), 0);
  assert.equal(f.gun.system.currentAmmunition, 2);
  assert.equal(f.action().resolved, undefined);
});

test("podwójne kliknięcie przeładowania nie otwiera dwóch operacji", async () => {
  const f = fixture({ inCombat: false }); f.actor.system.hands.right = "gun";
  f.reply({ ammunitionId: "ammo", amount: "3" });
  const results = await Promise.all([requestWeaponHandling(f.actor, "changeMagazine", "gun"), requestWeaponHandling(f.actor, "changeMagazine", "gun")]);
  assert.deepEqual(results, [true, false]);
  assert.equal(f.gun.system.currentAmmunition, 3);
  assert.equal(f.ammo.system.quantity, 17);
});

test("broń w dłoni z nabojami nie wymaga niejawnego przygotowania, także przy dawnym prepared=false", () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  Object.assign(f.gun.system, { currentAmmunition: 5, requiresPreparation: false, prepared: false });
  const guide = prepareWeaponGuidance(f.actor, f.gun, { canDeclareAction: true }, true);
  assert.equal(usableFirearms(f.actor).length, 1);
  assert.equal(guide.next.action, "shot");
  assert.equal(guide.disabled, false);
  assert.equal(guide.steps.length, 0);
  delete f.gun.system.requiresPreparation;
  assert.equal(weaponHandlingState(f.actor, f.gun).canShoot, true);
});

test("podpowiedź pokazuje wyłącznie potrzebne czynności i ich kolejność", () => {
  const f = fixture(); f.gun.system.requiresPreparation = false; f.gun.system.safetyOn = true;
  const state = () => prepareWeaponGuidance(f.actor, f.gun, { canDeclareAction: true }, true);
  assert.deepEqual(state().steps.map(step => step.action), ["drawWeapon", "changeMagazine", "safetyOff"]);
  f.actor.system.hands.right = "gun";
  assert.equal(state().next.action, "changeMagazine");
  f.gun.system.currentAmmunition = 3;
  assert.equal(state().next.action, "safetyOff");
  f.gun.system.safetyOn = false;
  assert.equal(state().next.action, "shot");
});

test("jawny wyjątek MG zachowuje opis i nie znika po uzupełnieniu magazynka", async () => {
  const f = fixture({ inCombat: false }); f.actor.system.hands.right = "gun";
  f.gun.system.preparationDescription = "Ustawienie wskazane przez MG";
  f.reply({ammunitionId:"ammo", amount:"5"});
  await requestWeaponHandling(f.actor,"changeMagazine","gun");
  const guide = prepareWeaponGuidance(f.actor, f.gun);
  assert.equal(guide.next.action, "readyWeapon");
  assert.equal(guide.next.explanation, "Ustawienie wskazane przez MG");
  assert.equal(guide.next.duration, 2);
});

test("podpowiedź odróżnia czekanie na kolejkę od wykonywanej akcji i gotowości poza walką", () => {
  const f = fixture(); f.actor.system.hands.right = "gun";
  Object.assign(f.gun.system, { currentAmmunition: 5, requiresPreparation: false });
  assert.match(prepareWeaponGuidance(f.actor,f.gun,{inCombat:true},true).unavailable,/swoją kolejkę/);
  const guide = prepareWeaponGuidance(f.actor,f.gun,{inCombat:true, action:{isCurrent:true,name:"Ładowanie",timingDescription:"Pozostały 2 segmenty."}},true);
  assert.match(guide.unavailable,/Ładowanie.*2 segmenty/);
  assert.equal(guide.disabled,true);
  assert.match(prepareWeaponGuidance(f.actor,f.gun).unavailable,/po rozpoczęciu walki/);
});

test("brak zapasu i zajęta dłoń pomocnicza mają czytelną następną czynność", () => {
  const f=fixture(); f.actor.system.hands={left:"ammo",right:"gun"}; f.gun.system.requiresPreparation=false;
  assert.equal(prepareWeaponGuidance(f.actor,f.gun).next.action,"hands");
  f.actor.system.hands.left=""; f.ammo.system.quantity=0;
  const guide=prepareWeaponGuidance(f.actor,f.gun);
  assert.equal(guide.disabled,true); assert.match(guide.unavailable,/Brak zgodnej amunicji/);
});

test("Strzel zachowuje konkretną broń i cel; anulowanie nie deklaruje akcji", async () => {
  const f = await shotFixture();
  delete f.combatant.flags.neuroshima.segmentAction;
  const target = {id:"target",name:"Cel"};
  canvas.tokens.placeables=[target]; game.user.targets=new Set([target]);
  const other={...f.gun,id:"other",system:{...f.gun.system,currentAmmunition:9}};
  f.actor.items.unshift(other); f.actor.system.hands.left="other";
  f.reply(null);
  assert.equal(await startWeaponShot(f.actor,"gun"),false);
  assert.equal(f.action(),undefined);
  f.reply({shotType:"aimingOne",targetTokenId:"target"});
  assert.equal(await startWeaponShot(f.actor,"gun"),true);
  assert.equal(f.action().aimingConfiguration.weaponId,"gun");
  assert.equal(f.action().aimingConfiguration.targetTokenId,"target");
  assert.equal(f.action().duration,2);
  assert.equal(f.gun.system.currentAmmunition,2);
  assert.equal(other.system.currentAmmunition,9);
});
