'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');

test('batching keeps server internals out of cabinet shadow-casting batches',async()=>{
  const THREE=await import('../vendor/three.module.js');const {batchRackSurfaces}=await import('../room-assets.js');
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();material.name='mat_powder_coat_dark';
  for(const castShadow of [false,true])for(let i=0;i<2;i++){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2,.3,.4),material);mesh.castShadow=castShadow;mesh.receiveShadow=true;mesh.position.x=i;root.add(mesh);
  }
  const owned=[];batchRackSurfaces(root,new Set(),owned);
  assert.equal(owned.length,2);assert.equal(root.children.length,2);
  assert.deepEqual(root.children.map(mesh=>mesh.castShadow).sort(),[false,true]);
});

test('rack batching preserves world bounds and leaves live hinges, fans and interaction targets intact',async()=>{
  const THREE=await import('../vendor/three.module.js');
  const {batchRackSurfaces}=await import('../room-assets.js');
  const root=new THREE.Group();root.position.set(2,0,-3);root.rotation.y=Math.PI/2;
  const material=new THREE.MeshStandardMaterial();material.name='mat_powder_coat_dark';
  const geometry=new THREE.BoxGeometry(.3,.4,.5),owned=[],excluded=new Set();
  for(const x of [-.6,.6]){const holder=new THREE.Group();holder.position.set(x,.7,0);root.add(holder);holder.add(new THREE.Mesh(geometry,material));}
  const live=[];
  for(const name of ['rack_door_front','server_fan_01','led_power']){const group=new THREE.Group();group.name=name;const mesh=new THREE.Mesh(geometry,material);group.add(mesh);root.add(group);live.push(mesh);}
  const target=new THREE.Mesh(geometry,material);root.add(target);excluded.add(target);
  const before=new THREE.Box3().setFromObject(root);
  let sourceDisposals=0;geometry.addEventListener('dispose',()=>sourceDisposals++);
  batchRackSurfaces(root,excluded,owned);
  const after=new THREE.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6,'baking retains metric transforms');
  assert.equal(owned.length,1,'two rigid objects become one owned surface');
  for(const mesh of [...live,target])assert.ok(mesh.parent,'interactive and animated objects retain their identities');
  assert.equal(sourceDisposals,0,'shared asset geometry remains valid for other racks');
  owned.forEach(item=>item.dispose());assert.equal(sourceDisposals,0);
});

test('raised-floor tiles use the rack walking datum and remain above the support slab',async()=>{
  const THREE=await import('../vendor/three.module.js');const {buildAssetHall}=await import('../room-assets.js');
  const source=new THREE.BoxGeometry(.6,.04,.6);source.translate(0,-.02,0);
  const material=new THREE.MeshStandardMaterial();
  const bank={make(key){const group=new THREE.Group();if(key==='floor'||key==='vent')group.add(new THREE.Mesh(source,material));return group;}};
  const scene=new THREE.Scene(),materials=new Proxy({},{get:()=>material});
  const hall=buildAssetHall({bank,scene,materials});scene.updateMatrixWorld(true);
  const tiles=[];hall.group.traverse(mesh=>{if(mesh.isInstancedMesh)tiles.push(mesh);});
  assert.equal(tiles.length,3,'solid tiles, server vents and replacement covers');
  for(const mesh of tiles){const bounds=new THREE.Box3().setFromObject(mesh);assert.ok(Math.abs(bounds.max.y)<1e-7);assert.ok(bounds.min.y>-.185,'the slab must not occlude the tile');}
  hall.setServerRoom(false);
  assert.equal(hall.group.getObjectByName('server-services').visible,false,'control/plant rooms have no trays, CRACs, vents or aisle lighting');
  assert.equal(hall.group.getObjectByName('closed-floor').visible,true);
  assert.equal(hall.coolingFans.length,0,'hidden CRAC fans need no animation');
  hall.setServerRoom(true);
  assert.equal(hall.group.getObjectByName('server-services').visible,true);
  assert.equal(hall.group.getObjectByName('closed-floor').visible,false,'vent covers cannot overlap the server vents');
});
