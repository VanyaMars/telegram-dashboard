import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const files=['src/components/GoalsWorkspace.tsx','src/lib/goalDocument.ts','src/components/RegularGoals.tsx','src/pages/CorePages.tsx','src/App.tsx','src/lib/navigation.ts'];
for(const path of files){
 const script=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(script.parseDiagnostics.length,0,'TypeScript parsing: '+path);
}
const goals=read('src/components/GoalsWorkspace.tsx'),doc=read('src/lib/goalDocument.ts'),routes=read('src/lib/navigation.ts'),shell=read('src/App.tsx');
for(const heading of ['Закрытые цели','Стратегические цели','Показатели','Задачи','Аналитика','Сохранить показатели','Создать и привязать','Вернуть в активные']){
 assert.ok(goals.includes(heading),'Goal UX: '+heading);
}
for(const type of ['number','percent','text','checkbox','date','select'])assert.ok(doc.includes(type),'Field type: '+type);
assert.match(doc,/PERSONAL_OS_GOAL_DOCUMENT_V1/);
assert.match(doc,/featured\.length>2/);
assert.match(doc,/result\.length>5900/);
assert.match(goals,/regular_goal_set/);
assert.match(goals,/task_save_and_link/);
assert.match(goals,/goalFieldProgress/);
assert.match(routes,/#\\\/goal/);
for(const text of ["Фокус-таймер","Повторения","label:'Доходы'"])assert.ok(!shell.includes(text),'Removed nav: '+text);
assert.ok(!read('src/pages/MvpAnalytics.tsx').includes('Фокус по задачам'));
assert.ok(read('src/pages/MvpAnalytics.tsx').includes('Полученный доход'),'Income remains in Analytics');
assert.ok(read('src/components/TaskIncome.tsx').includes('income'),'Income remains in task pages');
console.log('Goal Workspace: typed properties, closed status, links, routes and removed modules OK');
