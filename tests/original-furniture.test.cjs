const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process'),{promisify}=require('node:util'),run=promisify(execFile);

test('all furniture and procedural material maps reproduce offline from project source; retired model maps are absent',async t=>{
  const root=path.resolve(__dirname,'..'),temporary=await fs.mkdtemp(path.join(os.tmpdir(),'ROOT-original-furniture-'));
  t.after(async()=>{const target=path.resolve(temporary),base=path.resolve(os.tmpdir())+path.sep;
    assert.ok(target.startsWith(base)&&path.basename(target).startsWith('ROOT-original-furniture-'));await fs.rm(target,{recursive:true,force:true});});
  const result=await run(process.execPath,['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',path.join(root,'tools/asset-generator/build_interiors.mjs'),'--output-root',temporary],{cwd:root,timeout:15000,maxBuffer:1024*1024});
  assert.match(result.stdout,/chair/);assert.match(result.stdout,/sofa/);
  const manifest=JSON.parse(await fs.readFile(path.join(temporary,'asset-pack/docs/interior_manifest.json'),'utf8'));
  for(const key of ['chair','sofa','coffee','plant']){
    const relative=path.join('asset-pack/assets/interiors',key+'.glb');
    assert.deepEqual(await fs.readFile(path.join(temporary,relative)),await fs.readFile(path.join(root,relative)),key+' is exactly reproduced from original source');
    const record=manifest.find(r=>r.key===key);assert.equal(record.provenance,'original ROOT procedural geometry');assert.equal(record.source,'tools/asset-generator/build_interiors.mjs');
    assert.equal(record.download,undefined,'no furniture download is part of this build');
  }
  for(const file of ['root-weave-color.png','root-weave-normal.png','root-leaf-color.png']){
    const relative=path.join('asset-pack/textures/interiors',file);
    assert.deepEqual(await fs.readFile(path.join(temporary,relative)),await fs.readFile(path.join(root,relative)),file+' is generated locally');
  }
  const textures=await fs.readdir(path.join(root,'asset-pack/textures/interiors'));
  assert.equal(textures.some(file=>/^(chair|sofa|coffee|plant)-\d+\.(png|jpg)$/.test(file)),false,'downloaded model-specific maps are retired');
});
