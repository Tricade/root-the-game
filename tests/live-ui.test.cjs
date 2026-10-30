'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const E=require('../engine.js');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const format=value=>String(Math.round(value||0));

test('the ordinary live UI updates safely when no per-server elements are mounted',()=>{
  const source=read('app.js'),start=source.indexOf('  function updateLive() {'),end=source.indexOf('\n  function ',start+10);
  assert.ok(start>=0&&end>start);
  const state=E.createState(21);let hardwareUpdates=0,roomUpdates=0;
  const context={state,E,view:'overview',saveMode:'saved',lastChartTime:-1,
    agentOperations:()=>E.getAgentOperations(state),pendingAchievements:()=>[],
    fmt:format,dec:format,compact:format,clock:format,duration:format,tr:value=>value,
    $:()=>null,$$:()=>[],R:{updateLive(model){assert.ok(model.racks.length);hardwareUpdates++;}},
    Room:{isInRoom:()=>false,update(){roomUpdates++;}}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.updateLive();
  assert.equal(hardwareUpdates,1);assert.equal(roomUpdates,1);
});

test('hardware live updates scan attributes once even with a large unmounted fleet',()=>{
  const source=read('rack-ui.js'),start=source.indexOf('    function updateLive(snapshot){'),end=source.indexOf("    window.addEventListener('resize'",start);
  assert.ok(start>=0&&end>start);
  const state=E.createState(22);state.sector=100;state.credits=1e12;
  while(state.servers.length<120){if(!E.act(state,'buyServer',{type:'compute'}).ok)assert.ok(E.act(state,'buyRack').ok);}
  let scans=0;
  const context={E,state:()=>state,document:{querySelectorAll(){scans++;return [];}},
    fmt:format,dec:format,watts:format,speed:format,duration:format,
    rackKey:(id,key)=>id+':'+key,nodeKey:(id,key)=>id+':'+key,names:{online:'Online'},wireLayer:'network',drawCables(){}};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);context.updateLive(E.getRackModel(state));
  assert.ok(scans<=25,`only attribute indexes should scan the DOM, got ${scans}`);
});
