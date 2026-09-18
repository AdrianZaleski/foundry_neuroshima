import test from "node:test";
import assert from "node:assert/strict";
import { meleeDamageProfile, normalizeMeleeDamageCode, createMeleeDamageHits, resolveMeleeDamageHit } from "../scripts/combat/melee-damage.mjs";
import { createMeleeRound, resolveMeleeExchange } from "../scripts/combat/melee.mjs";
import { blocksMeleeAdvance, assertTrackerNextRound } from "../scripts/combat/melee-tracker.mjs";

test("Pięści: granice Budowy i odróżnienie siniaków od ran", () => {
  for (const [build, expected] of [[10,"S_D"],[11,"S_L"],[12,"S_L"],[14,"S_L"],[15,"S_C"],[18,"S_C"],[19,"S_C"]]) {
    assert.equal(meleeDamageProfile(null, build, 3).damageCode, expected);
  }
  assert.equal(meleeDamageProfile(null,18,1).damageCode,"S_L");
  assert.equal(normalizeMeleeDamageCode("D_sC"),"S_C");
  assert.equal(normalizeMeleeDamageCode("D_C"),"D_C");
  assert.equal(normalizeMeleeDamageCode("D_"),null);
});
test("Urwany kastet korzysta z podręcznika; własny pełny profil ma pierwszeństwo", () => {
  const weapon = { system: { sourceCode:"MELEE_2", damageByBuild:{below10:"D/L/L",below12:"D_L/"} } };
  assert.equal(meleeDamageProfile(weapon,12,3).damageCode,"D_C");
  assert.equal(meleeDamageProfile(weapon,19,3).damageCode,"D_K");
  weapon.system.damageByBuild = {below19:"D/D/D"};
  assert.equal(meleeDamageProfile(weapon,19,3).damageCode,"D_D");
  assert.equal(meleeDamageProfile({system:{sourceCode:"MELEE_4"}},12,1).damageCode,null);
});
test("Cios łączony bierze pełne trzy sukcesy; Furia wskazuje właściwego poszkodowanego", () => {
  const configurations=[{id:"a",weaponId:""},{id:"b",weaponId:""}];
  const actors=configurations.map(({id})=>({id,name:id,system:{attributes:{budowa:{base:12}},activeModifiers:[]}}));
  let state=createMeleeRound({initiative:"a",fighters:[{id:"a",skill:0,dice:[3,4,5]},{id:"b",skill:0,dice:[3,4,19]}]});
  let result=resolveMeleeExchange(state,{attackDice:[0,1,2],defenseDice:[0,1,2],attackThreshold:12,defenseThreshold:12});
  let hits=createMeleeDamageHits(state,result.exchange,configurations,actors);
  assert.equal(hits[0].successes,3);
  assert.equal(hits[0].damageCode,"S_L");
  assert.equal(hits[0].naturalResult,3);
  state=createMeleeRound({initiative:"a",fighters:[{id:"a",skill:0,maneuver:"fury",dice:[19,19,19]},{id:"b",skill:0,dice:[3,4,5]}]});
  result=resolveMeleeExchange(state,{attackDice:[0],defenseDice:[0],attackThreshold:12,defenseThreshold:12});
  hits=createMeleeDamageHits(state,result.exchange,configurations,actors);
  assert.equal(hits[0].targetId,"a");
  assert.equal(hits[0].sourceId,"b");
});

function environment(answers=[]) {
  const items=[]; items.get=id=>items.find(item=>item.id===id);
  const actor={name:"Cel",items,system:{attributes:{charakter:{base:12}},skills:{odpornoscNaBol:{base:0}},activeModifiers:[]},
    async createEmbeddedDocuments(type,data) { const created=data.map(item=>({...item,id:item._id}));items.push(...created);return created; }};
  globalThis.foundry={applications:{api:{DialogV2:{input:async()=>answers.shift()??null}}},
    documents:{ChatMessage:{getSpeaker:()=>({}),create:async()=>{}}},
    dice:{Roll:class {async evaluate(){this.total=19;this.dice=[{results:[3,4,19].map(result=>({result}))}];return this;}async toMessage(){}}}};
  let stored;
  return {actor,answers,get stored(){return stored;},persist:async hit=>{stored=structuredClone(hit);}};
}
const hit=()=>({id:"1234567890abcdef",sourceName:"Napastnik",weaponName:"Pięści",successes:1,
  spec:{damageCode:"S_D",naturalResult:10,damageType:"blunt",armorPenetration:0},completed:false});
function addArmor(env,reduction=0) {
  const marks={}; let updates=0;
  const armor={id:"armor",name:"Pancerz",type:"armor",system:{equipped:true,torso:{protected:true,currentDurability:6,reduction,cuttingReduction:2,coverageChance:100}},
    getFlag:()=>marks,async update(data){updates++;this.system.torso.currentDurability=data["system.torso.currentDurability"];marks[Object.keys(data).find(key=>key.startsWith("flags.")).split(".").at(-1)]=true;}};
  env.actor.items.push(armor);return {armor,get updates(){return updates;}};
}
test("Anulowanie siniaków zachowuje trafienie; wznowienie zapisuje jeden siniak",async()=>{
  const env=environment();
  assert.equal(await resolveMeleeDamageHit(hit(),env.actor,env.persist),false);
  assert.equal(env.actor.items.length,0);
  env.answers.push({penaltyPercent:"15"});
  assert.equal(await resolveMeleeDamageHit(env.stored,env.actor,env.persist),true);
  assert.equal(env.actor.items[0].system.injuryType,"bruise");
  assert.equal(env.actor.items[0].system.penaltyPercent,15);
  await resolveMeleeDamageHit(env.stored,env.actor,env.persist);
  assert.equal(env.actor.items.length,1);
});
test("Pancerz tnący zatrzymuje lekką ranę; nietrafiona osłona nie redukuje",async()=>{
  const env=environment();const {armor}=addArmor(env);
  let current=hit();current.spec={...current.spec,damageCode:"D_L",damageType:"cutting"};
  await resolveMeleeDamageHit(current,env.actor,env.persist);
  assert.equal(env.stored.result.prevented,true);
  assert.equal(env.actor.items.length,1);
  armor.system.torso.coverageChance=50;
  current=hit();
  await resolveMeleeDamageHit(current,env.actor,env.persist);
  assert.equal(env.stored.armor.covered,false);
  assert.equal(env.stored.result.prevented,false);
});
test("Rana lekka wywołuje test bólu i zapisuje wynik na karcie",async()=>{
  const env=environment([{injuryType:"light",includeWoundPenalties:true,includeEffects:true}]);
  const current=hit();current.spec.damageCode="D_L";
  await resolveMeleeDamageHit(current,env.actor,env.persist);
  assert.equal(env.actor.items[0].system.injuryType,"light");
  assert.equal(env.actor.items[0].system.penaltyPercent,15);
});
test("Awaria zapisu po ranie i pancerzu nie powiela żadnego skutku",async()=>{
  const env=environment();const armorState=addArmor(env);
  const current=hit();current.spec.damageCode="D_K";
  await assert.rejects(()=>resolveMeleeDamageHit(current,env.actor,async value=>{
    if(value.completed)throw new Error("awaria zapisu");
    await env.persist(value);
  }),/awaria/);
  assert.equal(env.actor.items.filter(item=>item.type==="injury").length,1);
  assert.equal(armorState.armor.system.torso.currentDurability,3);
  await resolveMeleeDamageHit(env.stored,env.actor,env.persist);
  assert.equal(env.actor.items.filter(item=>item.type==="injury").length,1);
  assert.equal(armorState.updates,1);
});
test("Trzy zużyte segmenty nie pozwalają pominąć oczekujących obrażeń",()=>{
  const duel={configurations:[{id:"a"},{id:"b"}],trackerRound:1,state:{segment:4},damageHits:[{completed:false}]};
  const combat={started:true,round:1,combatant:{actor:{id:"a"}},combatants:[{actor:{id:"a"}},{actor:{id:"b"}}],getFlag:(scope,key)=>key==="meleeDuels"?[duel]:1};
  assert.equal(blocksMeleeAdvance(combat),true);
  combat.round=2;
  assert.throws(()=>assertTrackerNextRound(combat,duel),/obrażenia/);
});
