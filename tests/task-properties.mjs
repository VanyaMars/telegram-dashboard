import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const p of ['src/components/TaskCustomProperties.tsx','src/components/GoalTaskRollups.tsx','src/components/GoalsWorkspace.tsx','src/pages/Workspace.tsx','supabase/06-os8-index.ts']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(ast.parseDiagnostics.length,0,'Syntax: '+p);
}
assert.match(read('src/pages/Workspace.tsx'),/TaskCustomProperties taskId/);
assert.match(read('src/components/GoalsWorkspace.tsx'),/GoalTaskRollups kind/);
assert.match(read('supabase/06-os8-index.ts'),/task_property_set/);
assert.match(read('supabase/06-os8-index.ts'),/goal_rollup_get/);
assert.match(read('supabase/10-task-property-engine.sql'),/enable row level security/);
const model=read('src/lib/workspace.ts');
assert.match(model,/taskPipelineProperties/);
assert.match(read('src/pages/Workspace.tsx'),/pipelineProperties=\\{taskPipelineProperties\\(data\\)\\}/);
assert.match(read('src/components/TaskCustomProperties.tsx'),/role="progressbar"/);
assert.match(model,/percent:pipelineProgress\\(splits,items\\)/);
console.log('Task property and goal rollup static contracts OK');
