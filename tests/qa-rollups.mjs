import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real local transport, not a copy of its calculations. No server,
// Telegram token, Supabase client, browser profile or production data is used.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),cache=new Map(),storage=new Map();
const globals={console,URLSearchParams,Date,Intl,crypto:webcrypto,window:{location:{search:'?qa=1'}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:()=>{throw Error('QA must not fetch production')}};
function load(file){
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{...globals,module,exports:module.exports,require:p=>load(resolve(dirname(file),p+'.ts'))},{filename:file});
 return module.exports;
}
const {startQASession,qaRequest}=load(resolve(root,'src/qa/sandbox.ts'));
const session=startQASession('Patch QA');
const call=(action,fields={})=>qaRequest('os8',action,fields);
const regular=(await call('goals_list')).goals[0];
const tasks=(await call('goal_tasks_list',{kind:'regular',goalId:regular.id})).tasks;
assert.ok(tasks.length>=2);
const number=(await call('task_property_define',{name:'Count',fieldType:'number'})).id;
const duration=(await call('task_property_define',{name:'Minutes',fieldType:'duration'})).id;
const text=(await call('task_property_define',{name:'Context',fieldType:'text'})).id;
await call('task_property_set',{taskId:tasks[0].id,propertyId:number,value:'2.5'});
await call('task_property_set',{taskId:tasks[1].id,propertyId:number,value:'4'});
await call('task_property_set',{taskId:tasks[0].id,propertyId:duration,value:'90'});
const outside=(await qaRequest('dashboard','tasks_list',{day:'1900-01-01'})).buffer.find(t=>!tasks.some(x=>x.id===t.id));
assert.ok(outside);await call('task_property_set',{taskId:outside.id,propertyId:number,value:'999'});
const goal={kind:'regular',goalId:regular.id};
await call('goal_rollup_save',{...goal,propertyId:number,label:'Количество',target:10});
await call('goal_rollup_save',{...goal,propertyId:duration,label:'Практика',target:120});
let result=await call('goal_rollup_get',goal);
assert.equal(result.linkedTasks,tasks.length);
assert.equal(result.rollups.find(r=>r.property_id===number).total,6.5);
assert.equal(result.rollups.find(r=>r.property_id===duration).total,90);
assert.equal(result.fields.some(f=>f.id===text),false);
// Upsert, validation, removal and isolation by goal kind/ID.
await call('goal_rollup_save',{...goal,propertyId:number,label:'Новое имя',target:null});
result=await call('goal_rollup_get',goal);assert.equal(result.rollups.length,2);
assert.equal(result.rollups.find(r=>r.property_id===number).target,null);
for(const patch of [{target:0},{target:-1},{target:Infinity},{label:''},{propertyId:text},{propertyId:webcrypto.randomUUID()},{kind:'unknown'},{goalId:webcrypto.randomUUID()}])
 await assert.rejects(()=>call('goal_rollup_save',{...goal,propertyId:number,label:'Count',target:10,...patch}));
const strategic=(await qaRequest('dashboard','goals_list')).goals[0];
assert.equal((await call('goal_rollup_get',{kind:'strategic',goalId:strategic.id})).rollups.length,0);
await call('goal_rollup_save',{...goal,propertyId:duration,remove:true});
// New module instance simulates reload; the session and rollup survive.
cache.clear();const reloaded=load(resolve(root,'src/qa/sandbox.ts'));
assert.equal(reloaded.readQASession().id,session.id);
result=await reloaded.qaRequest('os8','goal_rollup_get',goal);
assert.equal(result.rollups.length,1);assert.equal(result.rollups[0].total,6.5);
console.log('QA rollups: linked-only totals, types, targets, upsert, invalid input, removal, goal isolation and persistence PASS');
