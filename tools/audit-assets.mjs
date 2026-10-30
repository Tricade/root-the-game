/** Read-only complete GLB audit. Run with Node 24 from any working directory. */
import * as T from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { prepareAssetGeometry } from '../room-assets.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
export async function loadGeometry(file){const loader=new GLTFLoader();loader.register(()=>({name:'ROOT_audit_geometry_only',loadTexture:async()=>new T.Texture()}));
  const bytes=await fs.readFile(file);return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;}
export function visibleLod(root){const remove=[];root.traverse(n=>{if(n.name==='LOD1'||n.name.startsWith('collider_'))remove.push(n);});remove.forEach(n=>n.removeFromParent());root.updateMatrixWorld(true);return root;}
function triangles(root){const result=[];root.updateMatrixWorld(true);
  root.traverse(mesh=>{if(!mesh.isMesh)return;for(let p=mesh;p;p=p.parent)if(!p.visible)return;
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count||p.count;
    for(let i=0;i<count;i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));
      const n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));result.push({node:mesh.name,material:mesh.material.name,mesh:mesh.id,v,normal:n,area:n.length()/2});}
  });return result;}
export function geometryStats(root){const list=triangles(root),seen=new Set();let duplicates=0,degenerate=0,nonfinite=0;
  for(const t of list){if(t.v.some(v=>!v.toArray().every(Number.isFinite))){nonfinite++;continue;}if(t.area<1e-12){degenerate++;continue;}
    const p=t.v.map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(','));const key=[p.join('|'),[p[1],p[2],p[0]].join('|'),[p[2],p[0],p[1]].join('|')].sort()[0];
    if(seen.has(key))duplicates++;else seen.add(key);}
  return {triangles:list.length,nonfinite,degenerate,duplicates};}
const signedArea=poly=>poly.reduce((sum,p,i)=>{const q=poly[(i+1)%poly.length];return sum+p[0]*q[1]-q[0]*p[1];},0)/2;
export function intersectionArea(subject,clip){
  let output=signedArea(subject)<0?[...subject].reverse():subject;
  const boundary=signedArea(clip)<0?[...clip].reverse():clip;
  for(let j=0;j<boundary.length;j++){
    const a=boundary[j],b=boundary[(j+1)%boundary.length],input=output;output=[];if(!input.length)break;
    const cross=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);let start=input.at(-1);
    for(const end of input){const cs=cross(start),ce=cross(end);
      if((ce>=-1e-10)!==(cs>=-1e-10)){const t=cs/(cs-ce);output.push([start[0]+t*(end[0]-start[0]),start[1]+t*(end[1]-start[1])]);}
      if(ce>=-1e-10)output.push(end);start=end;
    }
  }return Math.abs(signedArea(output));
}
// Same-facing, differently shaded surfaces only. Interior opposite-facing joins
// are not evidence of visible z-fighting; candidate results still need inspection.
export function coplanarOverlaps(root,{differentMaterials=true,minArea=1e-8}={}){
  const groups=new Map();for(const t of triangles(root)){
    if(t.area<1e-12)continue;const n=t.normal.clone().normalize(),d=n.dot(t.v[0]);
    const key=[n.x,n.y,n.z,d].map(v=>Math.round(v*1e6)).join(':');
    const axis=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)].indexOf(Math.max(Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)));
    t.plane=key;t.p=t.v.map(v=>axis===0?[v.y,v.z]:axis===1?[v.x,v.z]:[v.x,v.y]);
    t.bounds=[Math.min(...t.p.map(v=>v[0])),Math.min(...t.p.map(v=>v[1])),Math.max(...t.p.map(v=>v[0])),Math.max(...t.p.map(v=>v[1]))];
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);
  }
  const results=[];
  for(const items of groups.values()){
    items.sort((a,b)=>a.bounds[0]-b.bounds[0]);
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length&&items[j].bounds[0]<items[i].bounds[2]-1e-8;j++){
      const a=items[i],b=items[j];if(differentMaterials&&a.material===b.material)continue;
      if(a.bounds[1]>=b.bounds[3]-1e-8||b.bounds[1]>=a.bounds[3]-1e-8)continue;
      const projected=intersectionArea(a.p,b.p);if(projected<=minArea)continue;
      const n=a.normal.clone().normalize(),major=Math.max(Math.abs(n.x),Math.abs(n.y),Math.abs(n.z));
      results.push({area:projected/major,plane:a.plane,a:{node:a.node,material:a.material},b:{node:b.node,material:b.material}});
    }
  }return results.sort((a,b)=>b.area-a.area);
}
async function files(dir){const result=[];for(const entry of await fs.readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);if(entry.isDirectory())result.push(...await files(full));else if(entry.isFile()&&entry.name.endsWith('.glb'))result.push(full);
}return result.sort();}
export async function audit(){
  const results=[];for(const file of await files(path.join(root,'asset-pack/assets'))){
    const relative=path.relative(path.join(root,'asset-pack'),file).replaceAll('\\','/'),bytes=await fs.readFile(file),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
    const scene=visibleLod(await loadGeometry(file)),before=geometryStats(scene);
    const keys={'rack_42u':'rack','rack_18u':'rack18','fire_door_module':'door','server_1u_edge':'edge','server_2u_compute':'compute','server_3u_storage':'storage','server_4u_ai':'ai','switch_8port':'switch8','switch_16port':'switch16'};
    const repairs=prepareAssetGeometry(scene,keys[path.basename(file,'.glb')]||path.basename(file,'.glb'));
    const after=geometryStats(scene),bounds=new T.Box3().setFromObject(scene),missing=[];
    for(const image of doc.images||[])if(image.uri){
      const target=path.resolve(path.dirname(file),image.uri),allowed=path.join(root,'asset-pack/textures')+path.sep;
      if(!target.startsWith(allowed)){missing.push(image.uri);continue;}try{await fs.access(target);}catch{missing.push(image.uri);}
    }
    const overlaps=coplanarOverlaps(scene);
    results.push({file:relative,provenance:relative.startsWith('assets/interiors/')?'original ROOT furniture':relative.startsWith('assets/facility/')?'locally generated facility':'user-supplied pack',sha256:hash(bytes),bytes:bytes.length,
      boundsMinM:bounds.min.toArray(),boundsMaxM:bounds.max.toArray(),raw:before,runtime:after,surfaceRepairs:repairs,missingTextures:missing,coplanarCandidates:overlaps.length,largestCandidates:overlaps.slice(0,6)});
  }return results;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=await audit(),outputAt=process.argv.indexOf('--output');
  if(outputAt>=0){if(!process.argv[outputAt+1])throw new Error('--output requires a path');await fs.writeFile(path.resolve(process.argv[outputAt+1]),JSON.stringify(result,null,2)+'\n');}
  for(const r of result)console.log(`${r.file}: ${r.runtime.triangles} triangles; invalid ${r.runtime.nonfinite}; degenerate ${r.runtime.degenerate}; duplicates ${r.runtime.duplicates}; coplanar candidates ${r.coplanarCandidates}; missing textures ${r.missingTextures.length}`);
  if(result.some(r=>r.runtime.nonfinite||r.runtime.degenerate||r.runtime.duplicates||r.missingTextures.length))process.exitCode=1;
}
