import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac,webcrypto} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
// Execute the real Edge handler with Telegram signatures and a recording database adapter.
const token='local-test-token',owner=123456;
const init=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:owner})});
const signed=[...init].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
init.set('hash',createHmac('sha256',createHmac('sha256','WebAppData').update(token).digest()).update(signed).digest('hex'));
let handler,calls=[],rows=Array.from({length:51},(_,i)=>({id:String(i),completed:true,day:'2020-01-15'}));
const adapter=new Proxy({}, {get:(_,method)=>method==='then'?(resolve=>Promise.resolve({data:rows,error:null}).then(resolve)):(...args)=>{calls.push([method,...args]);return adapter}});
const context=vm.createContext({TextEncoder,URLSearchParams,Response,Request,crypto:webcrypto,console,createClient:()=>({from:table=>{calls.push(['from',table]);return adapter}}),Deno:{env:{get:key=>({TG_BOT_TOKEN:token,SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test',TG_ALLOWED_USER_ID:String(owner)})[key]},serve:fn=>handler=fn}});
const source=readFileSync(new URL('../supabase/06-os8-index.ts',import.meta.url),'utf8').replace(/^import .*;$/m,'');
vm.runInContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,context);
async function call(body){calls=[];const r=await handler(new Request('https://example.test/os8',{method:'POST',body:JSON.stringify({initData:init.toString(),action:'task_library',...body})}));return {status:r.status,body:await r.json()}}
let result=await call({view:'completed',query:'100%_done',offset:50});assert.equal(result.status,200);assert.equal(result.body.tasks.length,50);assert.equal(result.body.hasMore,true);assert.deepEqual(calls.find(c=>c[0]==='eq'&&c[1]==='telegram_user_id'),['eq','telegram_user_id',owner]);assert.deepEqual(calls.find(c=>c[0]==='eq'&&c[1]==='completed'),['eq','completed',true]);assert.equal(calls.some(c=>c[1]==='day'),false,'Completed tasks must span all dates');assert.deepEqual(calls.find(c=>c[0]==='ilike'),['ilike','title','%100\\%\\_done%']);assert.deepEqual(calls.find(c=>c[0]==='range'),['range',50,100]);
for(const [view,key] of [['templates','template'],['archive','archived']]){await call({view});assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='task_options->>'+key&&c[2]==='true'))}
rows=[];result=await call({view:'completed'});assert.deepEqual(result.body.tasks,[]);assert.equal(result.body.hasMore,false);
for(const fields of [{view:'unknown'},{offset:-1},{offset:1.1},{offset:100001}]){assert.equal((await call(fields)).status,400);assert.equal(calls.length,0)}
assert.equal((await call({initData:'forged'})).status,401);assert.equal(calls.length,0);

// A carry-over must be scoped to the signed user and never select completed tasks.
calls=[];
const target=new Date().toISOString().slice(0,10);
const rolloverResponse=await handler(new Request('https://example.test/os8',{method:'POST',body:JSON.stringify({initData:init.toString(),action:'task_rollover',today:target})}));
assert.equal(rolloverResponse.status,200);
assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='telegram_user_id'&&c[2]===owner));
assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='completed'&&c[2]===false));
assert.ok(calls.some(c=>c[0]==='lt'&&c[1]==='day'&&c[2]===target));
result=await call({view:'working'});
assert.equal(result.status,200);
assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='completed'&&c[2]===false));
assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='os9_regular_goal_tasks'));
assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='os6_task_goal'));
console.log('Task library Edge handler: signed auth, owner scope, all dates, filters, escaping, pagination and invalid input OK');
