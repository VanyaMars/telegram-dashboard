import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const w=read('src/pages/Workspace.tsx'),c=read('src/components/TaskCustomProperties.tsx');
for(const [path,source] of [['src/pages/Workspace.tsx',w],['src/components/TaskCustomProperties.tsx',c]]){
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,'Syntax error: '+path);
}
assert.match(w,/TaskPageProperties key=\{taskData.id\}/);
assert.match(w,/pipelineProperties=\{taskPipelineProperties\(data\)\}/);
assert.match(w,/<TaskCustomProperties taskId=\{task.id\} pipelineProperties=\{pipelineProperties\}\s*\/>/,'Custom property editor must be inside TaskPageProperties');
for(const label of ['Категория','Приоритет','Дата','Связь с целью','Заметки'])assert.ok(w.includes(label),'Lost native field: '+label);
assert.match(w,/request\('os9','regular_goal_set'/);
assert.match(w,/saveTask\(\{id:task.id/);
assert.match(c,/<div className="os-custom-property-add">/);
assert.doesNotMatch(c,/<form/,'Nested form breaks native task save');
assert.match(c,/task_property_set/);
console.log('Native and custom properties share one form without removing original server bindings');
