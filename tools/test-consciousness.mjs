import test from "node:test";
import assert from "node:assert/strict";
import { consciousnessTrigger, injuryCombatContext, prepareConsciousness } from "../scripts/health/consciousness.mjs";
import { registerConsciousnessInjury, resolveConsciousness, initializeConsciousness } from "../scripts/health/consciousness-interface.mjs";
import { rollAttribute } from "../scripts/rolls/attribute-roll.mjs";

function environment() {
  const flags = {}, dialogs = [], messages = [], errors = [], hooks = {}, answers = [];
  let rolls = 0, dice = [4, 5, 18], statusFails = false;
  const actor = { id: "hero", uuid: "Actor.hero", type: "character", name: "Bohater", isOwner: true,
    items: [], statuses: new Set(), system: { attributes: { budowa: { base: 14 } }, activeModifiers: [], skills: {} },
    getFlag: (scope, key) => flags[key],
    async update(data) {
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split(".").slice(2);
        let target = flags;
        for (const key of keys.slice(0, -1)) target = target[key] ??= {};
        target[keys.at(-1)] = structuredClone(value);
      }
    },
    async toggleStatusEffect(id, { active }) {
      if (statusFails) throw new Error("awaria statusu");
      if (active) this.statuses.add(id); else this.statuses.delete(id);
    }
  };
  const combat = { id: "fight", started: true, round: 1, turn: 0, getCombatantsByActor: candidate => candidate === actor ? [{}] : [] };
  globalThis.game = { combat, user: { id: "creator" } };
  globalThis.Hooks = { on: (name, callback) => hooks[name] = callback };
  globalThis.ui = { notifications: { error: message => errors.push(message), warn: message => errors.push(message) } };
  globalThis.foundry = {
    utils: { randomID: () => "manual", escapeHTML: text => String(text).replaceAll("<", "&lt;").replaceAll(">", "&gt;") },
    applications: { api: { DialogV2: { input: async options => { dialogs.push(options); return answers.shift() ?? null; } } } },
    dice: { Roll: class {
      async evaluate() { rolls++; this.dice = [{ results: dice.map(result => ({ result })) }]; return this; }
      async toMessage(message) { messages.push(message); }
    } },
    documents: { ChatMessage: { getSpeaker: () => ({ actor: "hero" }), create: async message => messages.push(message) } }
  };
  const injury = (id, injuryType = "light", location = "torso", context = injuryCombatContext(actor, combat)) => {
    const item = { id, name: id, type: "injury", parent: actor, system: { injuryType, location, penaltyPercent: 0 },
      getFlag: () => context, updateSource(data) { this.source = data; } };
    actor.items.push(item);
    return item;
  };
  return { actor, combat, flags, dialogs, messages, errors, answers, hooks, injury,
    get rolls() { return rolls; }, set dice(value) { dice = value; }, set statusFails(value) { statusFails = value; } };
}
const proceed = { testType: "open", difficultyIndex: 0, customPenaltyPercent: 0 };

test("okna przytomności nie blokują czatu; zamknięcie nadal zachowuje oczekujący test", async () => {
  const env = environment();
  env.answers.push({ reason: "serious" }, null);
  await resolveConsciousness(env.actor);
  assert.equal(env.dialogs.length, 2);
  assert.ok(env.dialogs.every(dialog => dialog.modal === false));
  assert.equal(env.rolls, 0);
  assert.equal(prepareConsciousness(env.actor).hasPending, true);
  env.answers.push(proceed);
  await resolveConsciousness(env.actor, { manual: false });
  assert.equal(env.dialogs.at(-1).modal, false);
  assert.equal(env.rolls, 1);
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
});

test("zwykły test Współczynnika zachowuje dotychczasowy tryb okna", async () => {
  const env = environment();
  await rollAttribute(env.actor, "budowa");
  assert.equal(env.dialogs[0].modal, true);
});

test("Przesłanki przytomności: ciężka, głowa, >3 lekkie; krytyczna ma pierwszeństwo", () => {
  const check = (injuryType, location = "torso", count = 0) => consciousnessTrigger({ system: { injuryType, location } }, count);
  for (const type of ["abrasion", "bruise"]) assert.equal(check(type, "head", 10), null);
  assert.equal(check("light", "torso", 3), null);
  assert.equal(check("light", "torso", 4).difficultyIndex, 2);
  assert.equal(check("light", "torso", 5).difficultyIndex, 2);
  assert.equal(check("light", "head").difficultyIndex, 2);
  assert.equal(check("serious").difficultyIndex, 2);
  assert.equal(check("serious", "head").difficultyIndex, 2);
  assert.equal(check("critical", "head", 8).difficultyIndex, 5);
});

test("Czwarta lekka rana w pełnej rundzie wyzwala test; leczenie/usunięcie nie cofa licznika", async () => {
  const env = environment();
  for (let i = 1; i <= 3; i++) {
    env.combat.turn = i;
    await registerConsciousnessInjury(env.injury(`w${i}`));
    env.actor.items = []; // Nawet całkowite usunięcie rany nie usuwa faktu otrzymania.
  }
  assert.equal(prepareConsciousness(env.actor).pending.length, 0);
  const fourth = env.injury("w4");
  await registerConsciousnessInjury(fourth);
  assert.match(prepareConsciousness(env.actor).pending[0].reason, /4\./);
  await registerConsciousnessInjury(fourth);
  assert.equal(env.flags.consciousness.lightWounds.fight_1.length, 4);
  assert.equal(prepareConsciousness(env.actor).pending.length, 1);
  await registerConsciousnessInjury(env.injury("w5"));
  assert.equal(prepareConsciousness(env.actor).pending.length, 2);
});

test("Nowa runda/walka nie dziedziczy licznika; opóźniony zapis używa czasu otrzymania", async () => {
  const env = environment();
  const delayed = env.injury("delayed");
  for (let i = 0; i < 3; i++) await registerConsciousnessInjury(env.injury(`w${i}`));
  env.combat.round = 2;
  await registerConsciousnessInjury(delayed);
  assert.equal(prepareConsciousness(env.actor).pending[0].context.round, 1);
  await registerConsciousnessInjury(env.injury("round2"));
  env.combat.id = "other"; env.combat.round = 1;
  await registerConsciousnessInjury(env.injury("otherFight"));
  assert.equal(prepareConsciousness(env.actor).pending.length, 1);
  assert.deepEqual(env.flags.consciousness.lightWounds.other_1, ["otherFight"]);
});

test("Poza walką lekka rana tułowia nie sumuje się; ciężka i głowa nadal wymagają testu", async () => {
  const env = environment(); env.combat.started = false;
  assert.equal(injuryCombatContext(env.actor, env.combat), null);
  for (let i = 0; i < 5; i++) await registerConsciousnessInjury(env.injury(`w${i}`));
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  await registerConsciousnessInjury(env.injury("head", "light", "head"));
  await registerConsciousnessInjury(env.injury("serious", "serious"));
  assert.equal(prepareConsciousness(env.actor).pending.length, 2);
});

test("Anulowanie zostawia test; wznowienie wykonuje zamknięty test Budowy o ustalonym PT", async () => {
  const env = environment();
  await registerConsciousnessInjury(env.injury("heavy", "serious"));
  await resolveConsciousness(env.actor);
  assert.equal(env.rolls, 0);
  assert.equal(prepareConsciousness(env.actor).hasPending, true);
  env.answers.push(proceed);
  await resolveConsciousness(env.actor);
  assert.equal(env.rolls, 1);
  assert.match(env.dialogs[0].content, /value="2" selected/);
  assert.match(env.dialogs[0].content, /Rana ciężka/);
  assert.equal(env.flags.consciousness.checks.heavy.result.testType, "closed");
  assert.equal(env.flags.consciousness.checks.heavy.result.successThreshold, 12);
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  assert.equal(env.actor.statuses.has("unconscious"), false);
  await resolveConsciousness(env.actor, { manual: false });
  assert.equal(env.rolls, 1);
});

test("Krytyczna: Cholernie trudny test; porażka nadaje status i nie zmienia rany", async () => {
  const env = environment(); env.dice = [10, 11, 12];
  const injury = env.injury("critical", "critical", "head");
  await registerConsciousnessInjury(injury);
  env.answers.push(proceed);
  await resolveConsciousness(env.actor);
  assert.match(env.dialogs[0].content, /value="5" selected/);
  assert.equal(env.flags.consciousness.checks.critical.result.successThreshold, 3);
  assert.equal(env.actor.statuses.has("unconscious"), true);
  assert.equal(injury.system.injuryType, "critical");
  assert.match(env.messages.at(-1).content, /traci przytomność/);
});

test("Rany, efekty i naturalne 1/20 używają wspólnej mechaniki Budowy", async () => {
  const env = environment();
  const injury = env.injury("heavy", "serious"); injury.system.penaltyPercent = 30;
  await registerConsciousnessInjury(injury);
  env.dice = [1, 5, 20];
  env.answers.push({ ...proceed, includeWounds: true });
  await resolveConsciousness(env.actor);
  const result = env.flags.consciousness.checks.heavy.result;
  assert.equal(result.finalDifficultyIndex, 3); // 11%+30%, 1 i 20 znoszą się.
  assert.equal(result.successThreshold, 9);
  assert.equal(result.numberOfSuccesses, 2);
});

test("Awaria statusu nie pozwala na przerzucenie zapisanego wyniku", async () => {
  const env = environment(); env.dice = [16, 17, 18]; env.statusFails = true;
  await registerConsciousnessInjury(env.injury("heavy", "serious"));
  env.answers.push(proceed);
  await resolveConsciousness(env.actor);
  assert.equal(env.rolls, 1);
  assert.equal(prepareConsciousness(env.actor).hasPending, true);
  assert.equal(env.errors.length, 1);
  env.statusFails = false;
  await resolveConsciousness(env.actor);
  assert.equal(env.rolls, 1);
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  assert.equal(env.actor.statuses.has("unconscious"), true);
});

test("nieprzytomna postać nie rzuca ponownie po ranach ani ręcznie", async () => {
  const env = environment(); env.actor.statuses.add("unconscious");
  await registerConsciousnessInjury(env.injury("heavy", "serious"));
  await registerConsciousnessInjury(env.injury("critical", "critical"));
  env.answers.push(proceed);
  await resolveConsciousness(env.actor);
  await resolveConsciousness(env.actor, { manual: false });
  assert.equal(env.actor.statuses.has("unconscious"), true);
  assert.equal(env.rolls, 0);
  assert.equal(env.dialogs.length, 0);
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  assert.equal(env.flags.consciousness.checks.heavy.completed, true);
  assert.equal(env.flags.consciousness.checks.critical.result, null);
});

test("pierwsza utrata przytomności kończy resztę kolejki, także po wybudzeniu", async () => {
  const env = environment(); env.dice = [18, 18, 18];
  await registerConsciousnessInjury(env.injury("first", "serious"));
  await registerConsciousnessInjury(env.injury("second", "critical"));
  env.answers.push(proceed, proceed);
  await resolveConsciousness(env.actor);
  assert.equal(env.rolls, 1);
  assert.equal(env.dialogs.length, 1);
  assert.equal(env.flags.consciousness.checks.first.result.testPassed, false);
  assert.equal(env.flags.consciousness.checks.second.result, null);
  assert.equal(env.flags.consciousness.checks.second.completed, true);
  env.actor.statuses.delete("unconscious");
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  await registerConsciousnessInjury(env.injury("new", "serious"));
  env.dice = [2, 3, 4];
  await resolveConsciousness(env.actor, { manual: false });
  assert.equal(env.rolls, 2);
  assert.equal(env.flags.consciousness.checks.new.result.testPassed, true);
});

test("nadanie nieprzytomności przy otwartym oknie zatrzymuje rzut przed kośćmi", async () => {
  const env = environment();
  await registerConsciousnessInjury(env.injury("heavy", "serious"));
  foundry.applications.api.DialogV2.input = async () => {
    env.actor.statuses.add("unconscious");
    return proceed;
  };
  await resolveConsciousness(env.actor);
  assert.equal(env.rolls, 0);
  assert.equal(env.flags.consciousness.checks.heavy.completed, true);
});

test("ręczny status Nieprzytomność zamyka stare testy bez otwierania okien", async () => {
  const env = environment(); initializeConsciousness();
  await registerConsciousnessInjury(env.injury("heavy", "serious"));
  env.actor.statuses.add("unconscious");
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  await env.hooks.createActiveEffect({ parent: env.actor }, {}, "creator");
  env.actor.statuses.delete("unconscious");
  assert.equal(prepareConsciousness(env.actor).hasPending, false);
  assert.equal(env.rolls, 0);
  assert.equal(env.dialogs.length, 0);
});

test("Test ręczny wymaga powodu, można go anulować, brak uprawnień blokuje rzut", async () => {
  const env = environment();
  await resolveConsciousness(env.actor);
  assert.equal(env.flags.consciousness, undefined);
  env.answers.push({ reason: "fourth" }, proceed);
  await resolveConsciousness(env.actor);
  assert.equal(env.flags.consciousness.checks.manual.difficultyIndex, 2);
  const before = env.dialogs.length;
  env.actor.isOwner = false;
  await resolveConsciousness(env.actor);
  assert.equal(env.dialogs.length, before);
});

test("Hak zapisuje rundę; tylko autor tworzenia rejestruje serię nowych ran", async () => {
  const env = environment(); initializeConsciousness();
  const wounds = Array.from({ length: 4 }, (_, i) => env.injury(`w${i}`));
  env.hooks.preCreateItem(wounds[0]);
  assert.deepEqual(wounds[0].source["flags.neuroshima.receivedInCombat"], { combatId: "fight", round: 1, key: "fight_1" });
  env.hooks.createItem(wounds[0], {}, "otherUser");
  assert.equal(env.flags.consciousness, undefined);
  for (const wound of wounds) env.hooks.createItem(wound, {}, "creator");
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(env.flags.consciousness.lightWounds.fight_1.length, 4);
  assert.equal(prepareConsciousness(env.actor).pending.length, 1);
  assert.equal(env.dialogs.length, 1);
  assert.equal(env.hooks.updateItem, undefined);
});

test("Podwójne kliknięcie nie otwiera drugiego testu; nowa rana w trakcie nie ginie", async () => {
  const env = environment();
  await registerConsciousnessInjury(env.injury("first", "serious"));
  let release;
  foundry.applications.api.DialogV2.input = () => new Promise(resolve => { release = resolve; });
  const first = resolveConsciousness(env.actor);
  await resolveConsciousness(env.actor);
  await registerConsciousnessInjury(env.injury("second", "serious"));
  foundry.applications.api.DialogV2.input = async () => null;
  release(proceed);
  await first;
  assert.equal(env.rolls, 1);
  assert.deepEqual(prepareConsciousness(env.actor).pending.map(check => check.id), ["second"]);
});
