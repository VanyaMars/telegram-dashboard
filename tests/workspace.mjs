import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root=process.cwd();
const src=(f)=>fs.readFileSync(path.join(root,f),'utf8');
const files=['src/pages/Workspace.tsx','src/components/WorkspaceDatabase.tsx','src/components/WorkspacePipeline.tsx','src/lib/workspace.ts','supabase/04-os7-index.ts'];
for(const file of files){
 const ast=ts.createSourceFile(file,src(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(ast.parseDiagnostics.length,0,`TS syntax errors in ${file}`);
}
const compiled=ts.transpileModule(src('src/lib/workspace.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
vm.runInNewContext(compiled,{exports:mod.exports,module:mod,require:()=>({request(){}}),Date,Array,Set,Math,String,Number});
const {splitProgress,pipelineProgress,calendarDays}=mod.exports;
const splits=[{id:'a'},{id:'b'},{id:'c'}];
const tasks=[...[true,true,true].map(completed=>({split_id:'a',completed})),...[true,true,false,false].map(completed=>({split_id:'b',completed})),...[false,false,false].map(completed=>({split_id:'c',completed}))];
assert.equal(splitProgress(tasks.filter(t=>t.split_id==='a')),100);
assert.equal(splitProgress(tasks.filter(t=>t.split_id==='b')),50);
assert.equal(splitProgress([]),0);
assert.equal(pipelineProgress(splits,tasks),50);
assert.equal(calendarDays(2026,9).filter(Boolean).length,31);
const migration=src('supabase/03-workspace-schema.sql');
for(const table of ['os7_pages','os7_blocks','os7_data_sources','os7_fields','os7_records','os7_views','os7_splits','os7_workflow_items']){
 assert.ok(migration.includes(`public.${table}`));
 assert.ok(migration.includes(`'${table}'`));
}
assert.ok(src('supabase/04-os7-index.ts').includes('verifyTelegram('));
assert.ok(src('supabase/04-os7-index.ts').includes("const uid=await verifyTelegram"));
assert.ok(src('src/pages/workspace.css').includes('@media(max-width:600px)'));
assert.ok(src('src/pages/workspace.css').includes('.os-pipe-columns{display:block;overflow:visible'));
console.log('Workspace tests: syntax, progress, calendar, schema, auth guards, mobile split OK');
