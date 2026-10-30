/** Original ROOT furniture geometry. Offline; no downloaded meshes or runtime dependencies.
 * Node 24 / the project's vendored Three.js 0.186.1. Rebuild: node tools/asset-generator/build_interiors.mjs
 */
import * as T from '../../vendor/three.module.js';
import { RoundedBoxGeometry } from '../../vendor/RoundedBoxGeometry.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const outputFlag=process.argv.indexOf('--output-root');
if(outputFlag>=0&&!process.argv[outputFlag+1])throw new Error('--output-root requires a directory');
const outputRoot=outputFlag<0?project:path.resolve(process.argv[outputFlag+1]);
const assetDir=path.join(outputRoot,'asset-pack/assets/interiors'),sourceDir=path.join(outputRoot,'asset-pack/source/interiors');
const textureDir=path.join(outputRoot,'asset-pack/textures/interiors');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const materials={
  fabric:{name:'root_fabric_petrol',color:[.065,.14,.115,1],rough:.96,base:'root-weave-color.png',normal:'root-weave-normal.png',normalScale:.16},
  chair:{name:'root_fabric_graphite',color:[.045,.060,.070,1],rough:.96,base:'root-weave-color.png',normal:'root-weave-normal.png',normalScale:.16},
  accent:{name:'root_fabric_sand',color:[.50,.36,.21,1],rough:.98,base:'root-weave-color.png',normal:'root-weave-normal.png',normalScale:.18},
  seam:{name:'root_seam',color:[.11,.17,.15,1],rough:1},
  black:{name:'root_polymer',color:[.018,.025,.028,1],rough:.66},
  steel:{name:'root_satin_steel',color:[.28,.32,.34,1],metal:.88,rough:.34},
  coat:{name:'root_powder_coat',color:[.055,.07,.075,1],metal:.55,rough:.58},
  ceramic:{name:'root_ceramic',color:[.70,.73,.68,1],rough:.30},
  pot:{name:'root_plant_pot',color:[.05,.09,.08,1],rough:.79},
  leaf:{name:'root_leaf',color:[.055,.15,.035,1],rough:.63,base:'root-leaf-color.png'},
  stem:{name:'root_stem',color:[.07,.16,.045,1],rough:.75},
  vein:{name:'root_leaf_vein',color:[.21,.34,.12,1],rough:.76},
  soil:{name:'root_soil',color:[.028,.016,.009,1],rough:1},
  wood:{name:'root_walnut',color:[.8,.68,.54,1],rough:.84,base:'walnut-color.jpg',normal:'walnut-normal.jpg',normalScale:.2},
  screen:{name:'root_coffee_screen',color:[.008,.019,.023,1],rough:.25},
  indicator:{name:'root_coffee_indicator',color:[.18,.45,.23,1],rough:.3,emissive:[.08,.18,.09]}
};

function mesh(parent,name,geometry,material,at=[0,0,0],rotation=[0,0,0]){
  const result=new T.Mesh(geometry);result.userData.material=material;result.name=name;
  result.position.set(...at);result.rotation.set(...rotation);parent.add(result);return result;
}
function rounded(parent,name,size,at,material,radius=.025,detail=3,rotation=[0,0,0]){
  return mesh(parent,name,new RoundedBoxGeometry(...size,detail,Math.min(radius,...size.map(v=>v*.47))),material,at,rotation);
}
function cylinder(parent,name,radius,height,at,material,axis='y',segments=24){
  const geometry=new T.CylinderGeometry(radius,radius,height,segments,1,false);
  if(axis==='x')geometry.rotateZ(Math.PI/2);if(axis==='z')geometry.rotateX(Math.PI/2);
  return mesh(parent,name,geometry,material,at);
}
function tube(parent,name,points,radius,material,segments=32,radial=8,corners=false){
  const vectors=points.map(p=>new T.Vector3(...p));
  let curve=new T.CatmullRomCurve3(vectors,false,'centripetal');
  if(corners){
    curve=new T.CurvePath();let previous=vectors[0];
    for(let i=1;i<vectors.length-1;i++){
      const at=vectors[i],before=vectors[i-1],after=vectors[i+1],r=Math.min(.025,at.distanceTo(before)*.35,at.distanceTo(after)*.35);
      const a=at.clone().addScaledVector(before.clone().sub(at).normalize(),r),b=at.clone().addScaledVector(after.clone().sub(at).normalize(),r);
      curve.add(new T.LineCurve3(previous,a));curve.add(new T.QuadraticBezierCurve3(a,at,b));previous=b;
    }
    curve.add(new T.LineCurve3(previous,vectors.at(-1)));
  }
  return mesh(parent,name,new T.TubeGeometry(curve,segments,radius,radial,false),material);
}
function group(parent,name,at=[0,0,0],turn=0){const g=new T.Group();g.name=name;g.position.set(...at);g.rotation.y=turn;parent.add(g);return g;}
function lathe(parent,name,profile,at,material,segments=32){
  return mesh(parent,name,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),segments),material,at);
}
function seam(parent,name,w,d,y,at,material=materials.seam,detail=32){
  const points=[],r=Math.min(.055,w*.15,d*.15);
  for(const [cx,cz,start] of [[w/2-r,d/2-r,0],[-w/2+r,d/2-r,Math.PI/2],[-w/2+r,-d/2+r,Math.PI],[w/2-r,-d/2+r,Math.PI*1.5]])
    for(let i=0;i<=6;i++){const a=start+i/6*Math.PI/2;points.push([at[0]+cx+r*Math.cos(a),y,at[2]+cz+r*Math.sin(a)]);}
  points.push(points[0]);tube(parent,name,points,.0019,material,detail,5);
}

// A closed, shaped back cushion with a narrow waist and a curved lumbar section.
function chairBack(detail){
  const nx=detail?18:8,ny=detail?22:9,positions=[],uv=[],indices=[];
  for(const side of [1,-1])for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    const v=y/ny,u=x/nx*2-1,width=.49+.035*Math.sin(v*Math.PI)-.10*Math.exp(-(((v-.22)/.19)**2));
    const xx=u*width/2,yy=.65+v*.55,zz=-.205-v*.11+.033*u*u+.024*Math.sin(v*Math.PI*2);
    positions.push(xx,yy,zz+side*.035);uv.push(x/nx,v);
  }
  const row=nx+1,layer=row*(ny+1);
  function quad(a,b,c,d,reverse=false){indices.push(...(reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d]));}
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*row+x;quad(a,a+1,a+row+1,a+row);quad(a+layer,a+1+layer,a+row+1+layer,a+row+layer,true);}
  for(let y=0;y<ny;y++){const a=y*row,b=a+nx;quad(a,a+row,a+row+layer,a+layer);quad(b,b+layer,b+row+layer,b+row);}
  for(let x=0;x<nx;x++){quad(x,x+layer,x+1+layer,x+1);const a=ny*row+x;quad(a,a+1,a+1+layer,a+layer);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function buildChair(parent,high){
  const d=high?3:1,segments=high?28:12;
  cylinder(parent,'Gaslift cylinder',.031,.27,[0,.285,0],materials.coat,'y',segments);
  cylinder(parent,'Gaslift piston',.015,.21,[0,.415,0],materials.steel,'y',segments);
  rounded(parent,'Tilt mechanism',[.25,.075,.22],[0,.47,-.025],materials.black,.022,d);
  cylinder(parent,'Central five-star hub',.062,.09,[0,.155,0],materials.coat,'y',segments);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,g=group(parent,'Caster assembly '+i,[Math.sin(a)*.308,0,Math.cos(a)*.308],a);
    tube(parent,'Base spoke '+i,[[Math.sin(a)*.035,.17,Math.cos(a)*.035],[Math.sin(a)*.17,.153,Math.cos(a)*.17],[Math.sin(a)*.308,.117,Math.cos(a)*.308]],.022,materials.coat,high?14:5,high?8:5);
    cylinder(g,'Caster stem',.012,.07,[0,.105,0],materials.steel,'y',segments);
    rounded(g,'Caster fork',[.083,.045,.053],[0,.079,.015],materials.black,.014,d);
    for(const side of [-1,1]){
      cylinder(g,'Twin wheel tyre',.049,.023,[side*.032,.049,.022],materials.black,'x',segments);
      cylinder(g,'Recessed wheel hub',.022,.024,[side*.033,.049,.022],materials.coat,'x',segments);
    }
  }
  rounded(parent,'Seat shell',[.565,.073,.535],[0,.509,.005],materials.black,.035,d);
  const seat=rounded(parent,'Waterfall seat cushion',[.553,.115,.525],[0,.567,.025],materials.chair,.054,d);
  // Mild saddle shaping, with a rounded front edge and no paper-thin surfaces.
  const p=seat.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(y>0)p.setY(i,y-.010*Math.cos(x/.28*Math.PI/2)**2*Math.cos(z/.27*Math.PI/2)**2);}
  seat.geometry.computeVertexNormals();
  if(high)seam(parent,'Seat welt',.535,.501,.567,[0,0,.025],materials.seam,64);
  mesh(parent,'Shaped lumbar upholstery',chairBack(high),materials.chair);
  for(const side of [-1,1]){
    tube(parent,'Connected back support '+side,[[side*.185,.475,-.13],[side*.205,.65,-.26],[side*.215,1.10,-.36]],.014,materials.coat,high?18:7,8);
    tube(parent,'Armrest upright '+side,[[side*.263,.478,-.05],[side*.32,.59,-.055],[side*.325,.754,.04]],.018,materials.coat,high?14:6,8);
    rounded(parent,'Adjustable armrest '+side,[.077,.047,.32],[side*.325,.771,.047],materials.black,.021,d);
    cylinder(parent,'Headrest rail '+side,.009,.16,[side*.08,1.20,-.315],materials.steel,'y',segments);
  }
  rounded(parent,'Supported headrest',[.305,.145,.079],[0,1.279,-.315],materials.chair,.035,d);
  cylinder(parent,'Tilt tension knob',.036,.065,[.17,.45,.075],materials.black,'x',segments);
  tube(parent,'Height lever',[[.08,.473,.07],[.19,.463,.13],[.235,.463,.13]],.007,materials.steel,8,6);
  rounded(parent,'Height lever grip',[.075,.018,.045],[.23,.463,.13],materials.black,.007,d);
}

function buildSofa(parent,high){
  const d=high?4:1;
  for(const x of [-.88,.88]){
    tube(parent,'Continuous steel sled',[[x,.187,-.31],[x,.037,-.31],[x,.016,-.27],[x,.016,.26],[x,.037,.31],[x,.187,.31]],.014,materials.coat,high?40:12,high?8:5,true);
    for(const z of [-.22,.22])rounded(parent,'Floor pad',[.055,.008,.065],[x,.004,z],materials.black,.003,1);
  }
  rounded(parent,'Structural deck',[2.04,.145,.74],[0,.245,0],materials.coat,.032,d);
  rounded(parent,'Upholstered deck',[2.10,.09,.79],[0,.337,.005],materials.fabric,.043,d);
  rounded(parent,'Upholstered back',[2.19,.66,.19],[0,.608,-.344],materials.fabric,.083,d,[-.07,0,0]);
  for(const x of [-1.045,1.045])rounded(parent,'Padded armrest',[.17,.58,.86],[x,.59,0],materials.fabric,.075,d);
  for(const x of [-.675,0,.675]){
    rounded(parent,'Individual seat cushion',[.652,.18,.652],[x,.465,.049],materials.fabric,.075,d);
    rounded(parent,'Individual back pad',[.655,.425,.15],[x,.731,-.234],materials.fabric,.065,d,[-.11,0,0]);
    if(high){seam(parent,'Seat upholstery piping',.622,.621,.47,[x,0,.049],materials.seam,72);}
  }
  rounded(parent,'Lumbar pillow',[.36,.31,.115],[.73,.704,-.103],materials.accent,.05,d,[-.16,0,-.16]);
}

function cup(parent,x,y,z,high){
  lathe(parent,'Ceramic cup',[[0,0],[.029,0],[.035,.012],[.038,.075],[.034,.077],[.030,.016],[0,.016]],[x,y,z],materials.ceramic,high?28:12);
  const points=[];for(let i=0;i<=16;i++){const a=-Math.PI/2+i/16*Math.PI;points.push([x+.031+Math.cos(a)*.029,y+.039+Math.sin(a)*.025,z]);}
  tube(parent,'Cup handle',points,.005,materials.ceramic,high?24:10,6);
}
function buildCoffee(parent,high){
  const d=high?3:1,s=high?28:12;
  for(const x of [-.82,.82])for(const z of [-.235,.235]){
    cylinder(parent,'Levelling foot',.025,.11,[x,.055,z],materials.coat,'y',s);
    cylinder(parent,'Rubber foot pad',.03,.008,[x,.004,z],materials.black,'y',s);
  }
  rounded(parent,'Service counter carcass',[1.98,.86,.65],[0,.53,0],materials.coat,.018,d);
  rounded(parent,'Timber worktop',[2.02,.047,.70],[0,.982,0],materials.wood,.014,d);
  for(let i=0;i<3;i++){
    const x=(i-1)*.65;
    rounded(parent,'Cabinet door',[.625,.755,.029],[x,.54,.343],materials.coat,.012,d);
    tube(parent,'Cabinet pull',[[x-.09,.83,.361],[x-.09,.83,.385],[x+.09,.83,.385],[x+.09,.83,.361]],.006,materials.steel,high?20:7,6);
  }
  const machine=group(parent,'ROOT espresso station',[-.31,1.005,-.015]);
  rounded(machine,'Machine base',[.62,.055,.43],[0,.028,0],materials.steel,.019,d);
  rounded(machine,'Rear heat exchanger enclosure',[.605,.44,.12],[0,.245,-.148],materials.steel,.031,d);
  for(const side of [-1,1])rounded(machine,'Machine side panel',[.055,.48,.365],[side*.285,.273,-.005],materials.coat,.022,d);
  rounded(machine,'Brew head bridge',[.605,.155,.365],[0,.44,-.005],materials.steel,.035,d);
  rounded(machine,'Control fascia',[.48,.105,.018],[0,.451,.189],materials.black,.013,d);
  rounded(machine,'Status display',[.085,.038,.007],[0,.46,.202],materials.screen,.005,d);
  rounded(machine,'Status indicator',[.039,.004,.003],[0,.46,.207],materials.indicator,.001,d);
  rounded(machine,'Drip tray',[.49,.028,.27],[0,.069,.076],materials.coat,.008,d);
  for(let i=0;i<(high?20:8);i++){
    const n=high?20:8;cylinder(machine,'Drip tray grate',.002,.25,[-.228+i*.456/(n-1),.088,.076],materials.steel,'z',6);
  }
  for(const x of [-.12,.12]){
    cylinder(machine,'Brew group',.047,.07,[x,.335,.085],materials.steel,'y',s);
    cylinder(machine,'Portafilter bowl',.045,.025,[x,.29,.085],materials.coat,'y',s);
    cylinder(machine,'Portafilter handle',.012,.13,[x,.289,.176],materials.black,'z',s);
    cylinder(machine,'Brew outlet',.006,.028,[x,.266,.085],materials.steel,'y',s);
    cup(machine,x,.090,.084,high);
    cylinder(machine,'Control button',.013,.012,[x,.451,.207],materials.coat,'z',s);
  }
  for(const side of [-1,1])tube(machine,'Steam wand',[[side*.267,.381,.09],[side*.283,.35,.18],[side*.267,.19,.20],[side*.235,.15,.19]],.006,materials.steel,high?24:8,8);
  const grinder=group(parent,'Coffee grinder',[.29,1.0055,-.025]);
  rounded(grinder,'Grinder base',[.20,.04,.25],[0,.02,0],materials.black,.014,d);
  rounded(grinder,'Grinder motor enclosure',[.165,.265,.175],[0,.158,-.02],materials.coat,.034,d);
  lathe(grinder,'Bean hopper',[[.041,.275],[.071,.34],[.076,.43],[.067,.436],[.064,.35],[.036,.285]],[0,0,0],materials.black,s);
  cylinder(grinder,'Hopper lid',.079,.015,[0,.44,0],materials.coat,'y',s);
  rounded(grinder,'Ground coffee chute',[.055,.044,.07],[0,.26,.09],materials.steel,.01,d);
  for(let i=0;i<3;i++)cup(parent,.69,1.0055+i*.062,.11,high);
  cylinder(parent,'Coffee tin',.067,.18,[.67,1.10,-.18],materials.coat,'y',s);
  cylinder(parent,'Coffee tin lid',.069,.014,[.67,1.197,-.18],materials.steel,'y',s);
}

function leaf(parent,start,end,width,high){
  const along=new T.Vector3(...end).sub(new T.Vector3(...start)),axis=along.clone().normalize();
  const across=new T.Vector3().crossVectors(axis,new T.Vector3(0,1,0)).normalize();
  const normal=new T.Vector3().crossVectors(across,axis).normalize();
  const rows=high?10:6,cols=high?4:2,pos=[],uv=[],indices=[];
  for(const side of [1,-1])for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
    const t=i/rows,u=j/cols*2-1,span=(.025+.975*Math.sin(Math.PI*t)**.75)*width;
    const v=new T.Vector3(...start).addScaledVector(along,t).addScaledVector(across,u*span)
      .addScaledVector(normal,(1-u*u)*Math.sin(Math.PI*t)*.014+side*.0012);
    pos.push(v.x,v.y,v.z);uv.push(j/cols,t);
  }
  const row=cols+1,layer=(rows+1)*row;
  const quad=(a,b,c,d,reverse)=>indices.push(...(reverse?[a,c,b,a,d,c]:[a,b,c,a,c,d]));
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*row+j;quad(a,a+1,a+row+1,a+row,false);quad(a+layer,a+1+layer,a+row+1+layer,a+row+layer,true);}
  for(let i=0;i<rows;i++){const a=i*row,b=a+cols;quad(a,a+layer,a+row+layer,a+row,false);quad(b,b+row,b+row+layer,b+layer,false);}
  for(let j=0;j<cols;j++){quad(j,j+1,j+1+layer,j+layer,false);const a=rows*row+j;quad(a,a+layer,a+1+layer,a+1,false);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(pos,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();mesh(parent,'Curved compound leaf',geometry,materials.leaf);
}
function buildPlant(parent,high){
  const s=high?40:16;
  lathe(parent,'Ceramic planter',[[0,0],[.132,0],[.139,.025],[.176,.355],[.182,.375],[.180,.39],[.163,.39],[.16,.37],[.127,.03],[0,.03]],[0,0,0],materials.pot,s);
  cylinder(parent,'Recessed potting soil',.158,.015,[0,.36,0],materials.soil,'y',s);
  const count=high?7:5;
  for(let i=0;i<count;i++){
    const a=i*2.39996,h=.84+(i%4)*.095;
    const start=[Math.cos(a)*.04,.365,Math.sin(a)*.04],end=[Math.cos(a)*.205,h+.38,Math.sin(a)*.205];
    const stem=[];for(let j=0;j<=14;j++){const t=j/14;stem.push([start[0]+(end[0]-start[0])*t*t,.365+(end[1]-.365)*t,start[2]+(end[2]-start[2])*t*t]);}
    tube(parent,'Connected leaf stem',stem,.0045,materials.stem,high?28:12,6);
    for(let j=0;j<5;j++){
      const t=.38+j*.13,at=new T.Vector3(start[0]+(end[0]-start[0])*t*t,.365+(end[1]-.365)*t,start[2]+(end[2]-start[2])*t*t);
      for(const side of [-1,1]){
        const angle=a+side*1.1,length=.13+(1-t)*.08;
        const tip=at.clone().add(new T.Vector3(Math.cos(angle)*length,.035+length*.28,Math.sin(angle)*length));
        leaf(parent,at.toArray(),tip.toArray(),.037+(1-t)*.02,high);
      }
    }
    const t=.90;leaf(parent,[start[0]+(end[0]-start[0])*t*t,.365+(end[1]-.365)*t,start[2]+(end[2]-start[2])*t*t],
      [end[0],end[1]+.04,end[2]],.034,high);
  }
}

// Minimal deterministic glTF 2.0 exporter for our static geometry, materials and
// explicit LOD/collision hierarchy. It never reads a foreign mesh file.
function exportModel(root,key){
  const chunks=[],bufferViews=[],accessors=[],meshes=[],nodes=[],mats=[],textures=[],images=[];let byteLength=0;
  const matMap=new Map(),textureMap=new Map();
  function append(array,target){const bytes=Buffer.from(array.buffer,array.byteOffset,array.byteLength),at=byteLength;
    chunks.push(bytes);byteLength+=bytes.length;const pad=(4-byteLength%4)%4;if(pad){chunks.push(Buffer.alloc(pad));byteLength+=pad;}
    const id=bufferViews.length;bufferViews.push({buffer:0,byteOffset:at,byteLength:bytes.length,...(target?{target}:{})});return id;}
  function texture(file){if(textureMap.has(file))return textureMap.get(file);const id=textures.length;images.push({uri:'../../textures/interiors/'+file});textures.push({source:images.length-1,sampler:0});textureMap.set(file,id);return id;}
  function material(spec){if(matMap.has(spec.name))return matMap.get(spec.name);const pbr={baseColorFactor:spec.color,metallicFactor:spec.metal||0,roughnessFactor:spec.rough};
    if(spec.base)pbr.baseColorTexture={index:texture(spec.base)};
    const result={name:spec.name,pbrMetallicRoughness:pbr};
    if(spec.normal)result.normalTexture={index:texture(spec.normal),scale:spec.normalScale};if(spec.emissive)result.emissiveFactor=spec.emissive;
    const id=mats.length;mats.push(result);matMap.set(spec.name,id);return id;}
  function accessor(array,size,type,target,bounds=false){const result={bufferView:append(array,target),byteOffset:0,componentType:type,count:array.length/size,type:size===1?'SCALAR':size===2?'VEC2':'VEC3'};
    if(bounds){result.min=Array.from({length:size},(_,i)=>Infinity);result.max=result.min.map(()=>-Infinity);for(let i=0;i<array.length;i++){const c=i%size;result.min[c]=Math.min(result.min[c],array[i]);result.max[c]=Math.max(result.max[c],array[i]);}}
    const id=accessors.length;accessors.push(result);return id;}
  function node(object){const id=nodes.length,result={name:object.name};nodes.push(result);
    if(object.position.lengthSq())result.translation=object.position.toArray();if(object.quaternion.angleTo(new T.Quaternion())>1e-8)result.rotation=object.quaternion.toArray();
    if(object.userData.extras)result.extras=object.userData.extras;
    if(object.isMesh){const g=object.geometry,p=g.attributes.position,n=g.attributes.normal,u=g.attributes.uv;
      const original=g.index?.array||Array.from({length:p.count},(_,i)=>i),clean=[];
      const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
      for(let i=0;i<original.length;i+=3){a.fromBufferAttribute(p,original[i]);b.fromBufferAttribute(p,original[i+1]);c.fromBufferAttribute(p,original[i+2]);
        if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-18)clean.push(original[i],original[i+1],original[i+2]);}
      g.setIndex(clean);
      const attributes={POSITION:accessor(new Float32Array(p.array),3,5126,34962,true),NORMAL:accessor(new Float32Array(n.array),3,5126,34962)};
      if(u){
        const coords=new Float32Array(u.array);
        // Upholstery weave is a millimetre-scale material, not a broad checker.
        // Position-based UVs retain that scale on cushions of different sizes.
        if(object.userData.material.base==='root-weave-color.png')for(let i=0;i<p.count;i++){
          const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
          coords[i*2]=(ay>ax&&ay>az?p.getX(i):ax>az?p.getZ(i):p.getX(i))/.08;
          coords[i*2+1]=(ay>ax&&ay>az?p.getZ(i):p.getY(i))/.08;
        }
        attributes.TEXCOORD_0=accessor(coords,2,5126,34962);
      }
      const index=g.index.array,wide=p.count>65535,idx=wide?new Uint32Array(index):new Uint16Array(index);
      result.mesh=meshes.length;meshes.push({name:object.name,primitives:[{attributes,indices:accessor(idx,1,wide?5125:5123,34963),material:material(object.userData.material)}]});}
    if(object.children.length)result.children=object.children.map(node);return id;}
  const rootId=node(root);const binary=Buffer.concat(chunks),doc={asset:{version:'2.0',generator:'ROOT original interiors / build_interiors.mjs 1.0'},scene:0,scenes:[{nodes:[rootId]}],nodes,meshes,materials:mats,
    buffers:[{byteLength:binary.length}],bufferViews,accessors,...(images.length?{images,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}]}:{})};
  const raw=Buffer.from(JSON.stringify(doc)),json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]),glb=Buffer.alloc(28+json.length+binary.length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(json.length,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);
  glb.writeUInt32LE(binary.length,20+json.length);glb.writeUInt32LE(0x004e4942,24+json.length);binary.copy(glb,28+json.length);
  return {glb,binary,doc};
}

// Original, repeatable weave and leaf color maps. PNG encoding uses Node zlib.
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=crc>>>1^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function png(width,height,pixel){const rows=Buffer.alloc((width*3+1)*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const color=pixel(x,y);for(let c=0;c<3;c++)rows[y*(width*3+1)+1+x*3+c]=Math.max(0,Math.min(255,Math.round(color[c])));}
  function chunk(type,data){const name=Buffer.from(type),result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);name.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([name,data])),data.length+8);return result;}
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);}

await Promise.all([assetDir,sourceDir,textureDir,path.join(outputRoot,'asset-pack/docs')].map(folder=>fs.mkdir(folder,{recursive:true})));
const tex=[
  ['root-weave-color.png',(x,y)=>{const n=((x*73+y*151+(x*y)%37)%17)-8,v=190+n+Math.sin(x*Math.PI/3)*12+Math.cos(y*Math.PI/3)*9;return [v,v,v];}],
  ['root-weave-normal.png',(x,y)=>[128+Math.cos(x*Math.PI/3)*22,128+Math.sin(y*Math.PI/3)*18,251]],
  ['root-leaf-color.png',(x,y)=>{const u=x/255,v=y/255,vein=Math.exp(-(((u-.5)/.025)**2))*28,edge=Math.abs(u-.5)*30;return [170-edge+vein*.4,185-edge+vein,145-edge+vein*.2+Math.sin(v*96+Math.abs(u-.5)*32)*5];}]
];
const textureManifest=[];for(const [file,pixel] of tex){const bytes=png(256,256,pixel);await fs.writeFile(path.join(textureDir,file),bytes);textureManifest.push({file,sha256:sha(bytes),bytes:bytes.length,source:'tools/asset-generator/build_interiors.mjs',provenance:'original procedural texture'});}
const records=[];
for(const [key,build] of Object.entries({chair:buildChair,sofa:buildSofa,coffee:buildCoffee,plant:buildPlant})){
  const root=new T.Group();root.name='ROOT '+key;root.userData.extras={provenance:'original ROOT procedural model',source:'tools/asset-generator/build_interiors.mjs',units:'meters',front:'+Z'};
  const lod=group(root,'LOD0');build(lod,true);const bounds=new T.Box3().setFromObject(lod),size=bounds.getSize(new T.Vector3());
  const low=group(root,'LOD1');build(low,false);
  const collider=mesh(root,'collider_'+key,new T.BoxGeometry(size.x,size.y,size.z),materials.black,bounds.getCenter(new T.Vector3()).toArray());collider.userData.extras={collisionProxy:true};
  const result=exportModel(root,key);await fs.writeFile(path.join(assetDir,key+'.glb'),result.glb);
  const editable=structuredClone(result.doc);editable.buffers[0].uri=key+'.bin';await fs.writeFile(path.join(sourceDir,key+'.gltf'),JSON.stringify(editable,null,2)+'\n');await fs.writeFile(path.join(sourceDir,key+'.bin'),result.binary);
  let triangles=0;lod.traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;});
  const record={key,provenance:'original ROOT procedural geometry',source:'tools/asset-generator/build_interiors.mjs',license:'CC0-1.0',sha256:sha(result.glb),bytes:result.glb.length,trianglesLOD0:triangles,dimensionsM:size.toArray().map(n=>+n.toFixed(5)),boundsMinM:bounds.min.toArray().map(n=>+n.toFixed(5)),boundsMaxM:bounds.max.toArray().map(n=>+n.toFixed(5)),textures:[...new Set(result.doc.images?.map(image=>path.basename(image.uri))||[])]};records.push(record);
  console.log(key,record.dimensionsM,triangles+' triangles',result.glb.length+' bytes');
}
const previous=JSON.parse(await fs.readFile(path.join(project,'asset-pack/docs/interior_manifest.json'),'utf8'));
await fs.writeFile(path.join(outputRoot,'asset-pack/docs/interior_manifest.json'),JSON.stringify([...records,...textureManifest,...previous.filter(record=>record.key?.startsWith('walnut-'))],null,2)+'\n');
