import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const paths=['src/App.tsx','src/AppContext.tsx','src/pages/CorePages.tsx','src/pages/BufferWorkspace.tsx','src/pages/MvpAnalytics.tsx','src/components/RegularGoals.tsx','src/components/WorkspacePipeline.tsx','src/components/GoalValues.tsx','src/lib/navigation.ts'];
for(const p of paths){const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0,'Invalid integrated source: '+p)}
const app=read('src/App.tsx'),core=read('src/pages/CorePages.tsx'),analytics=read('src/pages/MvpAnalytics.tsx'),pages=read('src/pages/BufferWorkspace.tsx'),pipeline=read('src/components/WorkspacePipeline.tsx');
assert.match(core,/СЛЕДУЮЩИЙ ШАГ/);assert.match(core,/GoalSnapshot/);assert.match(core,/GoalsWorkspace/);assert.match(core,/today-task-group--/);
assert.doesNotMatch(app,/case 'income':|case 'focus':|case 'repeats':/);
assert.doesNotMatch(app,/label:'Страницы'/);assert.match(app,/mobilePrimary/);
assert.doesNotMatch(core,/today-start-focus/);
assert.doesNotMatch(core,/Начать фокус|Начать с 5 минут|open\('focus'\)/);
assert.doesNotMatch(analytics,/focusIncome|Фокус по задачам/);assert.match(analytics,/GoalValues/);assert.match(analytics,/regularGoalValues/);
assert.match(pages,/workspaceMode/);assert.match(pages,/!editingPage&&!workspaceMode&&<BufferPage/);
assert.match(pipeline,/LayoutGroup/);assert.match(pipeline,/useReducedMotion/);
assert.match(read('package.json'),/6\.9\.0/);
assert.ok(!read('src/lib/api.ts').includes('goal_target_mode'),'No invented backend contract');
console.log('6.8 integrated static checks: Home, Goals, Pages, Income, Pipeline and build label OK');

assert.match(read('src/components/WorkspacePipeline.tsx'),/let committed=false/);
assert.match(read('src/pages/BufferWorkspace.tsx'),/setShowPages\(false\)/);
