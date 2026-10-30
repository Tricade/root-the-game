'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('../engine.js');

for(const kind of ['central','rack'])test(`${kind} maintenance cannot generate a crisis whose response it blocks`,()=>{
  // Seed 4 raised a power crisis at second 60 in the previous implementation,
  // while these real upgrades still had 60 / 30 seconds left to run.
  const state=E.createState(4);state.sector=8;state.credits=1e12;state.time=1000;
  state.resilience.graceUntil=0;state.policies.power='performance';state.policies.autorepair=false;state.policies.autobackup=false;
  assert.ok(E.act(state,'buyRack').ok);
  assert.ok(E.act(state,'buyServer',{type:'compute',rackId:state.facility.racks[1].id}).ok);
  Object.assign(state.servers[0],{condition:1,status:'failed',fault:'Hardwarefehler',mode:'performance',level:100});
  Object.assign(state.servers[1],{condition:1,status:'online',fault:null,mode:'performance',level:100,powered:true,bootRemaining:0});
  const action=kind==='central'?['upgradeCentral',{system:'cooling'}]:['upgradeRack',{rackId:state.facility.racks[0].id,component:'cooling'}];
  assert.ok(E.act(state,...action).ok);
  const operation=()=>kind==='central'?state.facility.centralOperation:state.facility.operation;
  const duration=operation().total;
  for(let second=1;second<duration;second++){
    E.advance(state,1);
    assert.equal(state.resilience.incident,null,`no blocked crisis at second ${second}`);
    assert.ok(operation());
  }
  E.advance(state,1);assert.equal(operation(),null,'the paid upgrade still completes');
});

test('a requested destination survives cold asset loading; explicit intro replay still works',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','room.js'),'utf8');
  const begin=source.indexOf('  function startArrival(force=false){'),end=source.indexOf('  function updatePlaceNavigation()',begin);
  assert.ok(begin>=0&&end>begin);
  let arrivals=0;
  const context={locationId:'ups',arrivalRequested:false,sessionRestored:false,mounted:true,hidden:false,assetBank:{},renderer:{},isReducedMotion:false,arrival:null,exploring:false,
    document:{querySelector:()=>null,body:{classList:{add(){}}}},localStorage:{getItem:()=>null},sessionStorage:{getItem:()=>null,setItem(){}},
    scene:{environment:{}},arrivalOverlay:{hidden:true},shell:{classList:{add(){}}},sizeRenderer(){},syncAnimation(){},leave(){},
    createArrival(){arrivals++;return {};}};
  vm.createContext(context);vm.runInContext(source.slice(begin,end),context);
  context.startArrival();assert.equal(arrivals,0,'automatic arrival must not discard a selected room');
  context.startArrival(true);assert.equal(arrivals,1,'the settings replay remains available');
  context.arrival=null;context.locationId='hall';context.startArrival();assert.equal(arrivals,2,'normal first arrival remains available');
  context.arrival=null;context.sessionRestored=true;context.startArrival();assert.equal(arrivals,2,'restored hall view is not replaced by the intro');
  context.startArrival(true);assert.equal(arrivals,3,'explicit replay also works after a restore');
  context.arrival=null;context.sessionRestored=false;context.hidden=true;context.startArrival();assert.equal(arrivals,3,'hidden cold-load continuation cannot start the intro');
  context.hidden=false;context.mounted=false;context.startArrival();assert.equal(arrivals,3,'detached room cannot consume the intro');
  context.mounted=true;context.sessionRestored=true;context.assetBank=null;context.startArrival(true);
  assert.equal(arrivals,3);assert.equal(context.arrivalRequested,true,'explicit replay is retained while models load');
  context.assetBank={};context.startArrival();assert.equal(arrivals,4,'queued replay runs after loading despite restored session');
  assert.equal(context.arrivalRequested,false,'request is consumed once');
});
