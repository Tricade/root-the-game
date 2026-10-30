'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const E=require('../engine.js');

test('shared per-update read models agree with fresh models and do not retain stale state',()=>{
  const state=E.createState(17);state.credits=1e9;
  for(const mutate of [()=>{},()=>{state.servers[0].powered=false;},()=>{state.servers[0].powered=true;state.servers[0].bootRemaining=15;},()=>{state.servers[0].bootRemaining=0;state.servers[0].status='failed';}]){
    mutate();const before=JSON.stringify(state),metrics=E.getMetrics(state),racks=E.getRackModel(state,metrics);
    assert.deepEqual(racks,E.getRackModel(state));
    assert.deepEqual(E.getResilience(state,racks,metrics),E.getResilience(state));
    assert.equal(JSON.stringify(state),before,'read models must be pure');
  }
});

test('protection overview computes fleet metrics and rack model once per request',()=>{
  let source=fs.readFileSync(path.join(__dirname,'..','engine.js'),'utf8');
  for(const name of ['getMetrics','getRackModel']){
    const pattern=new RegExp('(function '+name+'\\([^\\n]+\\) \\{)');
    assert.ok(pattern.test(source));
    source=source.replace(pattern,'$1 globalThis.calls.'+name+'++;');
  }
  const context={module:{exports:{}},calls:{getMetrics:0,getRackModel:0}};
  vm.runInNewContext(source,context);const engine=context.module.exports;
  const state=engine.createState(29);state.sector=100;state.credits=1e12;
  while(state.servers.length<120){const result=engine.act(state,'buyServer',{type:'compute'});if(!result.ok)assert.ok(engine.act(state,'buyRack').ok);}
  context.calls.getMetrics=0;context.calls.getRackModel=0;
  const result=engine.getResilience(state);
  assert.equal(result.servers.length,120);
  assert.equal(context.calls.getRackModel,1);
  assert.equal(context.calls.getMetrics,1);
});

test('fleet read models do not linearly search the rack array for every server',()=>{
  const state=E.createState(31);state.sector=100;state.credits=1e12;
  while(state.servers.length<120){if(!E.act(state,'buyServer',{type:'compute'}).ok)assert.ok(E.act(state,'buyRack').ok);}
  let searches=0;
  state.facility.racks.find=function(...args){searches++;return Array.prototype.find.apply(this,args);};
  E.getMetrics(state);E.getRackModel(state);E.getResilience(state);
  assert.ok(searches<=5,`read-model rack searches must stay bounded, got ${searches}`);
});
