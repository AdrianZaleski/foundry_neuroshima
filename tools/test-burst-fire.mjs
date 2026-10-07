import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "./burst-test-fixture.mjs";
import { BURST_MODES, burstHits, burstSegmentPlan, supportsAutomaticFire, burstWeaponPenalty } from "../scripts/combat/burst-fire.mjs";
import { declareSegmentAction, configureCurrentAiming, advanceSegmentTurn, advanceSegmentRound, interruptSegmentAction, finishSegmentAction, prepareActorCombatStatus } from "../scripts/combat/segments.mjs";
import { resolveSingleShot, startWeaponShot } from "../scripts/combat/ranged-shot.mjs";
import { evaluateShotConfiguration } from "../scripts/combat/shot-conditions-interface.mjs";

async function setup({mode="fullAuto", natural=18, ammo=30, rate=3, damage="D_K", reliability=20, skill=0, dexterity=12}={}) {
  const f=fixture(); let rolls=0;
  Object.assign(f.actor.system,{attributes:{zrecznosc:{base:dexterity}},skills:{bronMaszynowa:{base:skill}},background:{},activeModifiers:[]});
  f.actor.system.hands.right="gun";
  Object.assign(f.gun.system,{currentAmmunition:ammo,prepared:true,attackTypes:"S,A",fireRate:rate,misfireRoll:reliability,damageCode:damage,armorPenetration:0});
  const items=[];items.get=id=>items.find(item=>item.id===id);
  const targetActor={id:"victim",uuid:"Actor.victim",type:"character",isOwner:true,name:"Cel",items,system:{attributes:{charakter:{base:12}},skills:{odpornoscNaBol:{base:0}},background:{},activeModifiers:[]},
    async createEmbeddedDocuments(type,records){const added=records.map(record=>({...structuredClone(record),id:record._id}));items.push(...added);return added;}};
  const target={id:"target",name:"Cel",actor:targetActor};
  globalThis.canvas={tokens:{get:()=>target,placeables:[target]}};game.user.targets=new Set([target]);
  globalThis.fromUuid=async()=>targetActor;
  foundry.dice={Roll:class{constructor(formula){this.formula=formula;}async evaluate(){rolls++;this.total=rolls===1?natural:5;this.dice=[{results:Array.from({length:this.formula==="3d20"?3:1},()=>({result:this.total}))}];return this;}async toMessage(data){f.messages.push(data);}}};
  await declareSegmentAction(f.actor,BURST_MODES[mode].name,BURST_MODES[mode].duration,{actionCode:mode,effectCode:"rangedShot"});
  await configureCurrentAiming(f.actor,{weaponId:"gun",targetTokenId:"target",targetName:"Cel"});
  f.reply({skillKey:"bronMaszynowa",includeRange:false},{die0Points:0});
  return {...f,targetActor,rolls:()=>rolls};
}

test("tryby zużywają X / 3X / 6X, ograniczone magazynkiem",()=>{
  assert.deepEqual(burstSegmentPlan("burstShort",3,30),[3]);
  assert.deepEqual(burstSegmentPlan("burstLong",3,30),[3,6]);
  assert.deepEqual(burstSegmentPlan("fullAuto",3,30),[3,6,9]);
  assert.deepEqual(burstSegmentPlan("fullAuto",3,5),[3,2,0]);
  assert.throws(()=>burstSegmentPlan("fullAuto",0,30));
});
test("tylko A daje serie; B i sama klasa broni nie wystarczają",()=>{
  assert.equal(supportsAutomaticFire({system:{attackTypes:"S,B",fireRate:3}}),false);
  assert.equal(supportsAutomaticFire({system:{attackTypes:"S, A",fireRate:3}}),true);
});
test("PS+1 trafień i przesuwanie lokacji ponad granicą segmentu",()=>{
  const input={naturalResult:2,adjustedResult:0,successThreshold:5,calledLocation:null};
  assert.deepEqual(burstHits({...input,startIndex:0,count:3}).map(h=>h.location),["head","rightArm","rightArm"]);
  assert.deepEqual(burstHits({...input,startIndex:3,count:6}).map(h=>[h.bullet,h.location]),[[4,"leftArm"],[5,"leftArm"],[6,"torso"]]);
  assert.deepEqual(burstHits({...input,naturalResult:20,startIndex:0,count:3}),[]);
  assert.equal(burstHits({...input,calledLocation:"head",startIndex:3,count:1})[0].location,"head");
});
test("kara konkretnej broni za automat wchodzi do wspólnego podglądu",()=>{
  const weapon={system:{actions:"WEAPON_AUTO_PENALTY:50",accuracyModifier:0}};
  assert.equal(burstWeaponPenalty(weapon),50);
  assert.equal(evaluateShotConfiguration({}, {weapon,modeModifier:50,skillLevel:1}).totalDifficultyPercentage,50);
});
test("ogień ciągły: jeden rzut, 3/6/9 pocisków i koniec w trzecim segmencie",async()=>{
  const f=await setup(); assert.equal(await resolveSingleShot(f.actor),true);
  assert.equal(f.gun.system.currentAmmunition,27);assert.equal(f.action().resolved,undefined);
  assert.equal(prepareActorCombatStatus(f.actor).action.canAdvanceAfterAction,true);
  await advanceSegmentTurn(f.combat);assert.equal(f.gun.system.currentAmmunition,21);
  await advanceSegmentTurn(f.combat);assert.equal(f.gun.system.currentAmmunition,12);
  assert.equal(f.action().resolved,true);assert.equal(f.rolls(),1);
  assert.equal(await resolveSingleShot(f.actor),false);
});
test("krótka i długa seria kończą się zgodnie z kosztem",async()=>{
  for(const mode of ["burstShort","burstLong"]){const f=await setup({mode});await resolveSingleShot(f.actor);
    if(mode==="burstLong")await advanceSegmentTurn(f.combat);
    assert.equal(f.action().resolved,true);assert.equal(f.action().burst.totalFired,mode==="burstShort"?3:9);}
});
test("pusty magazynek kończy ogień w segmencie ostatnich dostępnych pocisków",async()=>{
  const f=await setup({ammo:5});await resolveSingleShot(f.actor);await advanceSegmentTurn(f.combat);
  assert.equal(f.gun.system.currentAmmunition,0);assert.equal(f.action().resolved,true);assert.equal(f.action().endsAtTick,2);
});
test("przerwanie zachowuje oddane strzały, skrócenie akcji jest zabronione",async()=>{
  const f=await setup();await resolveSingleShot(f.actor);
  assert.equal(await finishSegmentAction(f.actor),false);
  assert.equal(await interruptSegmentAction(f.actor),true);await advanceSegmentTurn(f.combat);
  assert.equal(f.gun.system.currentAmmunition,27);assert.match(f.action().resolution,/3 nabojów/);
});
test("brak rzutu nie pozwala przeskoczyć segmentu ani rundy",async()=>{
  const f=await setup();await advanceSegmentTurn(f.combat);assert.equal(f.combat.flags.combatSegment,1);
  await advanceSegmentRound(f.combat);assert.equal(f.combat.round,1);
  await resolveSingleShot(f.actor);await advanceSegmentRound(f.combat);assert.equal(f.combat.round,1);
});
test("seria rozpoczęta w trzecim segmencie przechodzi do następnej rundy",async()=>{
  const f=await setup();const action=f.action();action.startedAtTick=3;action.endsAtTick=5;f.combat.flags.combatSegment=3;
  await resolveSingleShot(f.actor);await advanceSegmentTurn(f.combat);await advanceSegmentTurn(f.combat);
  assert.equal(f.combat.round,2);assert.equal(f.action().resolved,true);assert.equal(f.rolls(),1);
});
test("zacięcie kończy serię bez zużycia amunicji",async()=>{
  const f=await setup({natural:20,reliability:10});await resolveSingleShot(f.actor);
  assert.equal(f.gun.system.currentAmmunition,30);assert.equal(f.gun.system.jamState,"minor");assert.equal(f.action().resolved,true);
});
test("naturalna 20 bez zacięcia zużywa amunicję, lecz nie trafia",async()=>{
  const f=await setup({natural:20,mode:"burstShort"});await resolveSingleShot(f.actor);
  assert.equal(f.gun.system.currentAmmunition,27);assert.equal(f.targetActor.items.length,0);
});
test("osobna rana dla każdego trafienia; punkty Umiejętności wydawane raz",async()=>{
  const f=await setup({natural:7,skill:2,mode:"burstLong"});f.reply({skillKey:"bronMaszynowa"},{die0Points:2});
  await resolveSingleShot(f.actor);await advanceSegmentTurn(f.combat);
  assert.equal(f.targetActor.items.length,8);assert.equal(f.action().burst.totalHits,8);
  assert.equal(f.combatant.getFlag("neuroshima","combatSkillUsage").spentBySkill.bronMaszynowa,2);
  assert.equal(f.rolls(),1);
});
test("zamknięcie testu bólu zachowuje pociski i czeka na wznowienie",async()=>{
  const f=await setup({mode:"burstShort",natural:7,damage:"D_L"});f.reply({skillKey:"bronMaszynowa"},null);
  assert.equal(await resolveSingleShot(f.actor),false);assert.equal(f.gun.system.currentAmmunition,27);
  assert.equal(await interruptSegmentAction(f.actor),false);await advanceSegmentTurn(f.combat);assert.equal(f.combat.flags.combatSegment,1);
  assert.equal(await resolveSingleShot(f.actor),false);assert.equal(f.gun.system.currentAmmunition,27);assert.equal(f.rolls(),1);
  f.reply({},{},{});assert.equal(await resolveSingleShot(f.actor),true);
  assert.equal(f.targetActor.items.length,3);assert.equal(f.gun.system.currentAmmunition,27);assert.equal(f.rolls(),4);
});
test("błąd końcowego zapisu nie powtarza amunicji, ran ani rzutu",async()=>{
  const f=await setup({mode:"burstShort",natural:7});const original=f.combatant.setFlag.bind(f.combatant);let fail=true;
  f.combatant.setFlag=async(scope,key,value)=>{if(key==="segmentAction"&&value.resolved&&fail){fail=false;throw new Error("przerwane połączenie");}return original(scope,key,value);};
  assert.equal(await resolveSingleShot(f.actor),false);assert.equal(f.targetActor.items.length,3);
  assert.equal(await resolveSingleShot(f.actor),true);assert.equal(f.targetActor.items.length,3);
  assert.equal(f.gun.system.currentAmmunition,27);assert.equal(f.rolls(),1);assert.equal(f.action().burst.totalFired,3);
});
test("gracz bez uprawnień do celu zostawia obrażenia dla MG",async()=>{
  const f=await setup({mode:"burstShort",natural:7});f.targetActor.isOwner=false;
  assert.equal(await resolveSingleShot(f.actor),false);assert.equal(f.targetActor.items.length,0);
  f.targetActor.isOwner=true;assert.equal(await resolveSingleShot(f.actor),true);
  assert.equal(f.targetActor.items.length,3);assert.equal(f.gun.system.currentAmmunition,27);
});
test("pancerz zużywa się między pociskami, następne trafienie przechodzi przez zniszczoną osłonę",async()=>{
  const f=await setup({mode:"burstShort",natural:7});
  const armor={...f.gun,id:"armor",name:"Pancerz",type:"armor",flags:{},system:{equipped:true,torso:{protected:true,currentDurability:4,reduction:4,coverageChance:100}}};
  f.targetActor.items.push(armor);
  assert.equal(await resolveSingleShot(f.actor),true);
  assert.equal(armor.system.torso.currentDurability,0);
  assert.equal(f.targetActor.items.filter(i=>i.type==="injury").length,1);
  assert.deepEqual(f.action().burst.segment.hits.map(h=>h.damage.prevented),[true,true,false]);
});
test("okno Strzel oferuje A z liczbą nabojów; po usunięciu A odrzuca serię",async()=>{
  const f=await setup();delete f.combatant.flags.neuroshima.segmentAction;
  f.reply(null);await startWeaponShot(f.actor,"gun");
  assert.match(f.dialogs.at(-1).content,/Ogień ciągły — 3 seg., 18 nabojów/);
  f.gun.system.attackTypes="S,B";f.reply({shotType:"fullAuto",targetTokenId:"target"});
  assert.equal(await startWeaponShot(f.actor,"gun"),false);assert.doesNotMatch(f.dialogs.at(-1).content,/value="fullAuto"/);
  assert.equal(f.gun.system.currentAmmunition,30);
});
test("anulowanie warunków nie wykonuje rzutu ani nie zużywa nabojów",async()=>{
  const f=await setup();f.reply(null);assert.equal(await resolveSingleShot(f.actor),false);
  assert.equal(f.rolls(),0);assert.equal(f.gun.system.currentAmmunition,30);assert.equal(await interruptSegmentAction(f.actor),true);
});
test("zmiana stanu broni przed kontynuacją wymaga przerwania, nie zabiera amunicji",async()=>{
  const f=await setup();await resolveSingleShot(f.actor);f.gun.system.currentAmmunition=25;
  await advanceSegmentTurn(f.combat);assert.equal(f.gun.system.currentAmmunition,25);
  assert.equal(f.action().burst.totalFired,3);assert.equal(await interruptSegmentAction(f.actor),true);
});
test("podwójne kliknięcie wykonuje tylko jeden rzut i jeden segment",async()=>{
  const f=await setup();assert.deepEqual(await Promise.all([resolveSingleShot(f.actor),resolveSingleShot(f.actor)]),[true,false]);
  assert.equal(f.rolls(),1);assert.equal(f.gun.system.currentAmmunition,27);
});

test("utrata przytomności między segmentami kończy dalszy ogień bez nowych nabojów",async()=>{
  const f=await setup();await resolveSingleShot(f.actor);
  f.actor.statuses=new Set(["unconscious"]);
  await advanceSegmentTurn(f.combat);
  assert.equal(f.action().interrupted,true);assert.equal(f.gun.system.currentAmmunition,27);
  assert.equal(f.action().burst.totalFired,3);assert.equal(f.rolls(),1);
});

test("nieprzytomny strzelec dokańcza tylko skutki już oddanych pocisków",async()=>{
  const f=await setup({natural:7,damage:"D_L"});f.reply({skillKey:"bronMaszynowa"},null);
  assert.equal(await resolveSingleShot(f.actor),false);
  f.actor.statuses=new Set(["unconscious"]);
  f.targetActor.statuses=new Set(["unconscious"]);
  f.reply({},{},{});
  assert.equal(await resolveSingleShot(f.actor),true);
  assert.equal(f.targetActor.items.length,3);assert.equal(f.rolls(),4);
  assert.equal(f.gun.system.currentAmmunition,27);assert.equal(f.action().resolved,true);
  assert.match(f.action().resolution,/nieprzytomność/);
});

test("utrata przytomności przy otwartych warunkach serii blokuje rzut i amunicję",async()=>{
  const f=await setup();
  foundry.applications.api.DialogV2.input=async()=>{f.actor.statuses=new Set(["unconscious"]);return {skillKey:"bronMaszynowa"};};
  assert.equal(await resolveSingleShot(f.actor),false);
  assert.equal(f.gun.system.currentAmmunition,30);assert.equal(f.rolls(),0);
});
