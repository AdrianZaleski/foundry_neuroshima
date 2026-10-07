import test from "node:test";
import assert from "node:assert/strict";
import { calculateShotConditions } from "../scripts/combat/shot-conditions.mjs";
import { evaluateShotConfiguration, describeShotRange } from "../scripts/combat/shot-conditions-interface.mjs";
import { resolveDamage } from "../scripts/combat/damage-resolution.mjs";
import { selectShotConfiguration, resolveHitConsequences, resolveSingleShot } from "../scripts/combat/ranged-shot.mjs";

test("opis ręcznej odległości używa tej samej kary co test: karabin 11 m = 0%, 21 m = +10%", () => {
  const context = { weapon: { system: { weaponClass: "ARIFLE", range: 350 } }, skillLevel: 1 };
  const at11 = evaluateShotConfiguration({ distanceMeters: "11", includeRange: true }, context);
  const at21 = evaluateShotConfiguration({ distanceMeters: "21", includeRange: true }, context);
  assert.match(describeShotRange(at11), /11 m — bez utrudnienia ani ułatwienia \(0%\).*do 20 m/);
  assert.match(describeShotRange(at21), /21 m — utrudnienie \+10%.*do 30 m/);
  assert.equal(at21.totalDifficultyPercentage, 10);
});

test("opis zasięgu nazywa ułatwienie i wyłączenie modyfikatora", () => {
  const context = { weapon: { system: { weaponClass: "SHOTGUN" } }, skillLevel: 1 };
  const included = evaluateShotConfiguration({ distanceMeters: "5", includeRange: true }, context);
  assert.match(describeShotRange(included), /ułatwienie -30%/);
  assert.equal(included.totalDifficultyPercentage, -30);
  const omitted = evaluateShotConfiguration({ distanceMeters: "5", includeRange: false }, context);
  assert.match(describeShotRange(omitted), /pominięty \(0% w teście\)/);
  assert.equal(omitted.totalDifficultyPercentage, 0);
});

test("brak odległości, nieobsługiwana broń i cel poza zasięgiem nie pokazują starej kary", () => {
  const context = { weapon: { system: { weaponClass: "PISTOL" } }, skillLevel: 1 };
  assert.match(describeShotRange(evaluateShotConfiguration({ includeRange: true }, context)), /Wpisz odległość/);
  assert.match(describeShotRange(evaluateShotConfiguration({ distanceMeters: "81", includeRange: true }, context)), /poza zasięgiem/);
  context.weapon.system.weaponClass = "UNKNOWN";
  assert.match(describeShotRange(evaluateShotConfiguration({ distanceMeters: "11", includeRange: true }, context)), /brak tabeli/);
});

test("Tabela strzelania: ruch własny +30, celu +20/+40, wąskie wychylenie +20", () => {
  assert.equal(calculateShotConditions().modifierPercent, 0);
  assert.equal(calculateShotConditions({ shooterMovement: "running" }).modifierPercent, 30);
  assert.equal(calculateShotConditions({ targetMovement: "running" }).modifierPercent, 20);
  assert.equal(calculateShotConditions({ targetMovement: "sprinting" }).modifierPercent, 40);
  assert.equal(calculateShotConditions({ shooterExposure: "narrow" }).modifierPercent, 20);
  assert.equal(calculateShotConditions({ shooterMovement: "running", targetMovement: "running", shooterExposure: "narrow" }).modifierPercent, 70);
});

test("Osłona i postawa dają jedną większą karę, a nie dwie za tę samą sylwetkę", () => {
  for (const [cover, percent] of [["none",0],["twoThirds",20],["half",40],["third",60],["narrow",80]]) {
    assert.equal(calculateShotConditions({ targetCover: cover }).modifierPercent, percent);
    assert.equal(calculateShotConditions({ targetCover: cover, targetPosture: "kneeling" }).modifierPercent, Math.max(percent, 40));
    assert.equal(calculateShotConditions({ targetCover: cover, targetPosture: "prone" }).modifierPercent, Math.max(percent, 60));
  }
});

test("Lokacje: tułów +20, każda noga +40, każda ręka +60, głowa +80", () => {
  for (const [location, percent] of [["torso",20],["leftLeg",40],["rightLeg",40],["leftArm",60],["rightArm",60],["head",80]]) {
    const result = calculateShotConditions({ calledLocation: location, targetCover: "half" });
    assert.equal(result.modifierPercent, percent + 40);
    assert.equal(result.calledLocation, location);
  }
  assert.equal(calculateShotConditions().calledLocation, null);
});

test("Sprint strzelca i pełna osłona blokują zwykły strzał, sam sprint celu nie blokuje", () => {
  assert.equal(calculateShotConditions({ shooterMovement: "sprinting" }).blockers.length, 1);
  assert.equal(calculateShotConditions({ targetCover: "hidden" }).blockers.length, 1);
  assert.equal(calculateShotConditions({ targetMovement: "sprinting" }).blockers.length, 0);
});

const context = { weapon: { system: { weaponClass: "PISTOL", range: 80, accuracyModifier: -10 } },
  woundPenalty: 15, armorPenalty: 10, testModifierPercent: -10, skillLevel: 1 };
test("Podgląd i rozliczenie sumują zasięg, rany, efekty i warunki dokładnie raz", () => {
  const input = { distanceMeters: 20, includeRange: true, includeWounds: true, includeArmor: true, includeEffects: true,
    shooterMovement: "running", targetMovement: "running", targetCover: "half", targetPosture: "kneeling",
    visibilityPenalty: 20, customModifier: -15 };
  const result = evaluateShotConfiguration(input, context);
  assert.equal(result.conditions.modifierPercent, 110);
  assert.equal(result.totalDifficultyPercentage, 120); // 15+10-10+20+110-15-10
  assert.equal(result.difficultyBeforeRoll, 5);
  assert.equal(result.blockers.length, 0);
  const noRange = evaluateShotConfiguration({ ...input, includeRange: false }, context);
  assert.equal(noRange.totalDifficultyPercentage, 100);
  assert.equal(evaluateShotConfiguration(input, { ...context, skillLevel: 0 }).difficultyBeforeRoll, 6);
});

test("Błędne wartości, dystans poza zasięgiem i nieznane warianty nie przechodzą walidacji", () => {
  for (const value of [-10, "tekst", Infinity]) assert.throws(() => calculateShotConditions({ visibilityPenalty: value }));
  assert.throws(() => calculateShotConditions({ targetCover: "__proto__" }));
  assert.throws(() => evaluateShotConfiguration({ distanceMeters: -1 }, context));
  assert.throws(() => evaluateShotConfiguration({ customModifier: "NaN" }, context));
  assert.equal(evaluateShotConfiguration({ distanceMeters: 100, includeRange: true }, context).blockers.length, 1);
  assert.equal(evaluateShotConfiguration({ includeRange: true }, context).blockers.length, 1);
  assert.equal(evaluateShotConfiguration({ distanceMeters: 100, includeRange: false }, context).blockers.length, 0);
});

test("Wybrana lokacja steruje obrażeniami; naturalne 1–2 nie przenoszą strzału z nogi do głowy", () => {
  const head = resolveDamage({ damageCode: "D_L", naturalResult: 12, hitLocation: "head" });
  assert.equal(head.location, "head"); assert.equal(head.finalSeverityCode, "C");
  const leg = resolveDamage({ damageCode: "D_L", naturalResult: 2, hitLocation: "leftLeg" });
  assert.equal(leg.location, "leftLeg"); assert.equal(leg.finalSeverityCode, "L");
  assert.equal(resolveDamage({ damageCode: "D_L", naturalResult: 2 }).location, "head");
  assert.equal(resolveDamage({ damageCode: "D_K", naturalResult: 9, hitLocation: "head", armorReduction: 1 }).finalSeverityCode, "K");
  assert.equal(resolveDamage({ damageCode: "D_L", naturalResult: 2, hitLocation: "typo" }), null);
});

function environment() {
  const dialogs = [], answers = [], messages = [], warnings = [], created = [], rolls = [];
  function update(object, changes) {
    for (const [path, value] of Object.entries(changes)) {
      const parts = path.split(".");
      const target = parts.slice(0,-1).reduce((target, key) => target[key] ??= {}, object);
      target[parts.at(-1)] = value;
    }
  }
  const weapon = { id: "gun", type: "weapon", name: "Pistolet", system: { weaponClass: "PISTOL", currentAmmunition: 3,
    magazineCapacity: 10, range: 80, misfireRoll: 20, accuracyModifier: 0, jamState: "ready", damageCode: "D_L", armorPenetration: 0 },
    update: async changes => update(weapon, changes) };
  const items = [weapon]; items.get = id => items.find(item => item.id === id);
  const actor = { id: "hero", uuid: "Actor.hero", name: "Strzelec", isOwner: true, items,
    system: { hands: { right: "gun" }, attributes: { zrecznosc: { base: 14 } }, skills: { pistolety: { base: 0 } }, activeModifiers: [] } };
  const targetActor = { type: "character", name: "Cel", isOwner: true, items: [],
    system: { attributes: { charakter: { base: 14 } }, skills: { odpornoscNaBol: { base: 0 } }, activeModifiers: [] },
    createEmbeddedDocuments: async (type, data) => { created.push(...data); return data; } };
  const target = { id: "target", name: "Cel", actor: targetActor };
  const action = { effectCode: "rangedShot", startedAtTick: 1, endsAtTick: 1, aimingBonusDice: 0,
    aimingConfiguration: { weaponId: "gun", targetTokenId: "target" } };
  const flags = { segmentAction: action };
  const combatant = { id: "combatant", actor, getFlag: (scope,key) => flags[key],
    setFlag: async (scope,key,value) => flags[key] = value };
  globalThis.game = { combat: { round: 1, combatant, getCombatantsByActor: () => [combatant], getFlag: () => 1 } };
  globalThis.canvas = { tokens: { get: () => target } };
  globalThis.ui = { notifications: { warn: text => warnings.push(text), error: text => warnings.push(text), info: text => messages.push(text) } };
  globalThis.foundry = { utils: { escapeHTML: String },
    applications: { api: { DialogV2: { input: async options => { dialogs.push(options); return answers.shift() ?? null; } } } },
    dice: { Roll: class { constructor(formula) { this.formula = formula; }
      async evaluate() { rolls.push(this.formula); this.dice = [{ results: [8].map(result => ({result})) }]; return this; }
      async toMessage(data) { messages.push(data); } } },
    documents: { ChatMessage: { getSpeaker: () => ({}), create: async data => messages.push(data) } } };
  return { actor, weapon, target, targetActor, action, flags, dialogs, answers, messages, warnings, created, rolls };
}

test("okno warunków strzału i serii nie blokuje zakładek ani czatu", async () => {
  for (const burst of [false, true]) {
    const env = environment();
    await selectShotConfiguration(env.actor, env.target, env.action.aimingConfiguration, null, { burst });
    assert.equal(env.dialogs[0].modal, false);
    assert.equal(env.dialogs[0].rejectClose, false);
    assert.equal(env.rolls.length, 0);
    assert.equal(env.weapon.system.currentAmmunition, 3);
  }
});

test("Zamknięcie okna warunków zachowuje nabój i nierozstrzygniętą akcję", async () => {
  const env = environment();
  assert.equal(await resolveSingleShot(env.actor), false);
  assert.equal(env.weapon.system.currentAmmunition, 3);
  assert.equal(env.action.resolved, undefined);
  assert.equal(env.rolls.length, 0);
  assert.match(env.dialogs[0].content, /name="targetCover"/);
  assert.match(env.dialogs[0].content, /data-shot-summary/);
});

test("utrata przytomności przy otwartym oknie pojedynczego strzału blokuje rzut", async () => {
  const env = environment();
  foundry.applications.api.DialogV2.input = async () => {
    env.actor.statuses = new Set(["unconscious"]);
    return { skillKey: "pistolety" };
  };
  assert.equal(await resolveSingleShot(env.actor), false);
  assert.equal(env.rolls.length, 0);
  assert.equal(env.weapon.system.currentAmmunition, 3);
});

test("Walidacja warunków zatrzymuje rzut i zużycie naboju również bez interfejsu podglądu", async () => {
  for (const invalid of [{ shooterMovement: "sprinting" }, { targetCover: "hidden" }, { visibilityPenalty: -10 }, { skillKey: "missing" }]) {
    const env = environment(); env.answers.push({ skillKey: "pistolety", ...invalid });
    assert.equal(await resolveSingleShot(env.actor), false);
    assert.equal(env.weapon.system.currentAmmunition, 3);
    assert.equal(env.rolls.length, 0);
    assert.equal(env.warnings.length, 1);
  }
});

test("Pełny strzał bierze sumę warunków do rzutu i opisuje ją na czacie", async () => {
  const env = environment();
  env.answers.push({ skillKey: "pistolety", shooterMovement: "running", targetCover: "half", visibilityPenalty: 20 });
  assert.equal(await resolveSingleShot(env.actor), true);
  const message = env.messages.find(message => message.flavor)?.flavor;
  assert.match(message, /Suma kar i modyfikatorów: 90%/);
  assert.match(message, /Próg sukcesu: 3/); // Bardzo trudny + brak Umiejętności = Cholernie trudny.
  assert.match(message, /Postawa \/ osłona celu/);
  assert.match(message, /Widoczność.*20%/);
  assert.match(message, /Pudło/);
  assert.equal(env.weapon.system.currentAmmunition, 2);
  assert.equal(env.created.length, 0);
});

test("Trafienie w wybraną nogę pomija pancerz tułowia i zapisuje ranę właśnie nogi", async () => {
  const env = environment();
  env.targetActor.items.push({ type: "armor", name: "Kamizelka", system: { equipped: true,
    torso: { protected: true, reduction: 4, currentDurability: 5, coverageChance: 100 } } });
  env.answers.push({ injuryType: "light" }, { location: "leftLeg", injuryName: "Postrzał nogi" });
  await resolveHitConsequences(env.actor, env.target, env.weapon, { evaluatedDice: [
    { naturalResult: 2, pointsDifference: 5, succeeded: true }, { naturalResult: 8, pointsDifference: 2, succeeded: true }
  ] }, "leftLeg");
  assert.equal(env.dialogs.filter(dialog => dialog.window.title === "Wybierz kość trafienia").length, 0);
  assert.equal(env.created[0].system.location, "leftLeg");
  assert.equal(env.created[0].system.injuryType, "light");
  assert.match(env.messages.find(message => message.content)?.content, /Lewa noga/);
});

test("Wybrana głowa używa hełmu i zwiększa obrażenia tylko raz", async () => {
  const env = environment(); const updates = [];
  env.targetActor.items.push({ type: "armor", name: "Hełm", system: { equipped: true,
    head: { protected: true, reduction: 1, currentDurability: 5, coverageChance: 100 } }, update: async changes => updates.push(changes) });
  env.answers.push({ injuryType: "light" }, { location: "head", injuryName: "Postrzał głowy" });
  await resolveHitConsequences(env.actor, env.target, env.weapon, { evaluatedDice: [{ naturalResult: 12, pointsDifference: 1, succeeded: true }] }, "head");
  assert.equal(env.created[0].system.location, "head");
  assert.equal(env.created[0].system.injuryType, "light"); // Lekka -> Ciężka -> hełm -> Lekka.
  assert.deepEqual(updates, [{ "system.head.currentDurability": 4 }]);
});

test("Pełna ścieżka strzału przekazuje wybraną głowę do nowej rany", async () => {
  const env = environment(); env.actor.system.attributes.zrecznosc.base = 100;
  env.answers.push({ skillKey: "pistolety", calledLocation: "head" },
    { injuryType: "serious" }, { location: "head", injuryName: "Postrzał głowy" });
  assert.equal(await resolveSingleShot(env.actor), true);
  assert.equal(env.created[0].system.location, "head");
  assert.equal(env.created[0].system.injuryType, "serious");
  assert.equal(env.weapon.system.currentAmmunition, 2);
  assert.match(env.messages.find(message => message.flavor)?.flavor, /Miejsce trafienia: Głowa/);
  assert.ok(env.messages.some(message => message.content?.includes("Lokacja wybrana przed rzutem")));
});

test("Warunki z dialogu zachowują konkretną lokację, normalny strzał nadal losuje z kości", async () => {
  const env = environment();
  env.answers.push({ skillKey: "pistolety", calledLocation: "rightArm", customModifier: -20 });
  const result = await selectShotConfiguration(env.actor, env.target, env.action.aimingConfiguration, null);
  assert.equal(result.conditions.calledLocation, "rightArm");
  assert.equal(result.totalDifficultyPercentage, 40);
  env.answers.push({ injuryType: "light" }, { location: "rightArm", injuryName: "Rana ręki" });
  await resolveHitConsequences(env.actor, env.target, env.weapon, { evaluatedDice: [{ naturalResult: 4, pointsDifference: 1, succeeded: true }] });
  assert.equal(env.created[0].system.location, "rightArm");
});
