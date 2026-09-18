import test from "node:test";
import assert from "node:assert/strict";
import { healingTargets, healOverTime } from "../scripts/health/healing-interface.mjs";

function actor(uuid, penalties = []) {
  const items = penalties.map((penaltyPercent, index) => ({ id: String(index), name: "Siniak", type: "injury",
    system: { injuryType: "bruise", penaltyPercent }, toObject() { return { system: structuredClone(this.system) }; } }));
  items.get = id => items.find(item => item.id === id);
  return { id: "shared", uuid, name: "Ten obrywa", type: "character", isOwner: true, items, updates: [],
    async updateEmbeddedDocuments(type, updates) { this.updates.push(...updates); } };
}

test("Gojenie rozróżnia wzorzec i dwa tokeny z tym samym actorId", () => {
  const world = actor("Actor.shared"), first = actor("Scene.a.Token.one.Actor.shared"), second = actor("Scene.a.Token.two.Actor.shared");
  const targets = healingTargets(first, [world], [{ name: "Scena", tokens: [
    {name:"Pierwszy",actor:first,actorLink:false}, {name:"Drugi",actor:second,actorLink:false},
    {name:"Połączony",actor:world,actorLink:true} ] }]);
  assert.equal(targets.length,3);
  assert.equal(targets[1].actor,first);
  assert.equal(targets[2].actor,second);
  assert.match(targets[1].label,/Pierwszy.*Scena/);
});

test("Grupowe gojenie zapisuje rany wybranego tokena i pomija jego rany 0%", async () => {
  const world = actor("Actor.shared"), token = actor("Scene.a.Token.one.Actor.shared", [10,60,0]);
  const dialogs = [], warnings = [];
  globalThis.game = { user:{isGM:true,id:"gm"}, actors:[world], scenes:[{name:"Scena",tokens:[{name:"Ten obrywa",actor:token,actorLink:false}]}] };
  globalThis.ui = {notifications:{info:()=>{},warn:message=>warnings.push(message)}};
  globalThis.foundry = {applications:{api:{DialogV2:{
    input:async options=>{dialogs.push(options);return {days:"13",actor1:"on",mode1:"rest"};},
    confirm:async options=>{dialogs.push(options);return true;}
  }}}};
  await healOverTime(token,true);
  assert.deepEqual(warnings,[]);
  assert.equal(world.updates.length,0);
  assert.equal(token.updates.length,2);
  assert.ok(token.updates.every(update=>update["system.penaltyPercent"]===0));
  assert.match(dialogs[0].content,/name="actor1" checked/);
  assert.match(dialogs[0].content,/ran z karą: 2/);
  assert.match(dialogs[1].content,/token na scenie/);
  assert.equal(token.updates[0]["system.healing.history"].length,1);
});
