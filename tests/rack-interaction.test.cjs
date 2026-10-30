const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

test('rack access opens the door before dispatching hardware controls and waits for the leaf to clear',async()=>{
  const {rackInteraction}=await import('../room.js');
  const cabinet={doorOpen:false,doors:[{rotation:{y:0}}]},calls=[];
  const source=fs.readFileSync(path.join(__dirname,'../room.js'),'utf8'),start=source.indexOf('  function activateTarget('),end=source.indexOf('  function toggleRackDoor(',start);
  const context={rackInteraction,rackRefs:new Map([['rack-1',{cabinet}]]),toggleRackDoor:id=>{calls.push('door:'+id);cabinet.doorOpen=!cabinet.doorOpen;},openServer:(rack,id)=>calls.push('server:'+id),openRack:id=>calls.push('rack:'+id)};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  context.activateTarget('rack-1','server-1');assert.deepEqual(calls,['door:rack-1']);
  context.activateTarget('rack-1','server-1');assert.equal(calls.length,1,'hardware remains covered during the swing');
  cabinet.doors[0].rotation.y=-1.5;context.activateTarget('rack-1','server-1');assert.deepEqual(calls,['door:rack-1','server:server-1']);
  assert.equal(rackInteraction(cabinet,true),'close-door');
  context.activateTarget('rack-1',null);assert.equal(calls.at(-1),'rack:rack-1');
});
