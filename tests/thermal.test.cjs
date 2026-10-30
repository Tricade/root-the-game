'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),E=require('../engine.js');
function hot(){const s=E.createState(912);s.credits=1e8;s.servers[0].level=8;s.policies.autorepair=false;s.policies.autobackup=false;s.policies.autocontract=false;s.resilience.graceUntil=1e9;s.jobs=[];return s;}
const rack=s=>E.getRackModel(s).racks[0];
test('cooling upgrade retains heat at start, cools gradually and resumes without temperature jumps',()=>{
 const s=hot(),before=rack(s).temperature;assert.ok(before>35);
 assert.equal(E.act(s,'upgradeRack',{rackId:s.facility.racks[0].id,component:'cooling'}).ok,true);
 assert.equal(rack(s).temperature,before);assert.equal(rack(s).powerW,42);
 E.advance(s,1);const one=rack(s).temperature;assert.ok(one<before&&one>before-1);
 E.advance(s,44);const half=rack(s).temperature;assert.ok(half<one&&half>22);
 E.advance(s,44);const almost=rack(s).temperature;E.advance(s,1);
 assert.equal(s.facility.operation,null);assert.equal(s.facility.racks[0].coolingLevel,2);
 assert.ok(rack(s).temperature>22&&Math.abs(rack(s).temperature-almost)<1);
 assert.ok(E.getMetrics(s).capacity>0);E.advance(s,900);
 assert.ok(Math.abs(rack(s).temperature-rack(s).targetTemperature)<.1);
});
test('temperature survives save reload during maintenance and online/offline slicing agrees',()=>{
 const s=hot();E.act(s,'upgradeRack',{rackId:s.facility.racks[0].id,component:'cooling'});E.advance(s,35);
 const restored=E.normalizeState(JSON.parse(JSON.stringify(s)));assert.equal(rack(restored).temperature,rack(s).temperature);
 const batched=structuredClone(s);E.advance(batched,120);
 for(let i=0;i<120;i++)E.advance(restored,1);
 assert.ok(Math.abs(rack(restored).temperature-rack(batched).temperature)<1e-10);
 assert.deepEqual(restored.facility,batched.facility);
});
test('power changes preserve temperature while pure read models and failed actions do not mutate state',()=>{
 const s=hot(),before=rack(s).temperature;
 const snapshot=JSON.stringify(s);for(let i=0;i<4;i++){E.getMetrics(s);E.getRackModel(s);E.quoteHardware(s,'upgradeRack',{rackId:s.facility.racks[0].id,component:'cooling'});}
 assert.equal(JSON.stringify(s),snapshot);assert.equal(E.act(s,'upgradeRack',{rackId:'missing',component:'cooling'}).ok,false);assert.equal(JSON.stringify(s),snapshot);
 E.act(s,'setServerPower',{id:s.servers[0].id,on:false});assert.equal(rack(s).temperature,before);assert.equal(E.getMetrics(s).capacity,0);
 E.advance(s,30);assert.ok(rack(s).temperature<before&&rack(s).temperature>22);
 E.act(s,'setServerPower',{id:s.servers[0].id,on:true});E.advance(s,30);assert.ok(E.getMetrics(s).capacity>0);
});
test('old v3 saves without temperature remain valid; new temperatures are validated and retained',()=>{
 const s=hot();assert.equal(Object.hasOwn(E.normalizeState(s).facility.racks[0],'temperature'),false);
 s.facility.racks[0].temperature=48.2;assert.equal(E.normalizeState(s).facility.racks[0].temperature,48.2);
 for(const value of [null,'48',NaN,Infinity]){s.facility.racks[0].temperature=value;assert.throws(()=>E.normalizeState(s));}
 s.facility.racks[0].temperature=150;assert.equal(E.normalizeState(s).facility.racks[0].temperature,100);
 s.facility.racks[0].temperature=4;assert.equal(E.normalizeState(s).facility.racks[0].temperature,22);
});
test('only the maintained rack cools from shutdown and dashboard reports the warmest rack',()=>{
 const s=hot();s.sector=2;E.act(s,'buyRack');E.act(s,'buyServer',{type:'edge',rackId:s.facility.racks[1].id});
 s.facility.racks[0].temperature=45;s.facility.racks[1].temperature=27;
 assert.equal(E.getMetrics(s).maxRackTemperature,45);
 E.act(s,'upgradeRack',{rackId:s.facility.racks[0].id,component:'cooling'});E.advance(s,10);
 const rows=E.getRackModel(s).racks;assert.equal(rows[0].status,'maintenance');assert.equal(rows[1].servers[0].status,'online');assert.ok(rows[0].temperature>22);assert.equal(E.getMetrics(s).maxRackTemperature,Math.max(...rows.map(x=>x.temperature)));
});
test('twelve-hour catch-up retains finite temperatures and bounds under high load',()=>{
 const s=hot();s.servers[0].level=30;E.advance(s,43200);const r=rack(s);assert.ok(Number.isFinite(r.temperature)&&r.temperature>=22&&r.temperature<=100);assert.ok(Math.abs(r.temperature-r.targetTemperature)<.01);assert.equal(E.normalizeState(s).facility.racks[0].temperature,r.temperature);
});
