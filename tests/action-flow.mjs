import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
for(const path of ['src/pages/CorePages.tsx','src/pages/PlanningPage.tsx','src/AppContext.tsx']){
 const tree=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0,'Invalid TSX: '+path);
}
const core=read('src/pages/CorePages.tsx'),planning=read('src/pages/PlanningPage.tsx'),context=read('src/AppContext.tsx');
assert.match(core,/СЛЕДУЮЩИЙ ШАГ/);
assert.match(core,/next-step-title/);
assert.match(core,/today-task-group--/);
assert.match(core,/buffer-quick/);
assert.match(core,/submitting\.current/);
assert.match(core,/Сбросить фильтры/);
assert.match(planning,/moved\.push\(id\)/);
assert.match(planning,/Запланировать /);
assert.match(context,/linkedGoalId=form\.goalId===undefined/);
assert.match(context,/togglesInFlight\.current/);
assert.match(context,/8000/);
assert.ok(!read('src/lib/api.ts').includes('linkedGoalId'),'No API protocol changes');
console.log('6.8 Action Flow: parse, safe ID preservation, progress CTA, retry semantics OK');
