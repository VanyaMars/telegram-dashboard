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
assert.doesNotMatch(pages,/workspaceMode|showPages|mvp-pages-toggle/);
assert.match(pages,/taskPage/);
assert.match(pipeline,/LayoutGroup/);assert.match(pipeline,/useReducedMotion/);
assert.match(read('package.json'),/"version": "6\.15\.0"/);

// ProDesk brand identity and non-destructive property presentation.
assert.match(read('src/App.tsx'),/>ProDesk<\/strong>/);
assert.match(read('src/App.tsx'),/Оседлай хаос/);
assert.match(read('src/lib/version.ts'),/ProDesk · v/);
assert.match(read('index.html'),/ProDesk — Оседлай хаос/);
assert.match(read('src/prodesk-brand.css'),/\.task-inspector \.os-property-rows\{border-top:0!important\}/);
assert.match(read('src/prodesk-brand.css'),/font-variant-numeric:tabular-nums/);
assert.match(read('public/prodesk-mark.svg'),/<svg[\s\S]*<path /);
assert.ok(!read('src/lib/api.ts').includes('goal_target_mode'),'No invented backend contract');
console.log('6.8 integrated static checks: Home, Goals, Pages, Income, Pipeline and build label OK');

assert.match(read('src/components/WorkspacePipeline.tsx'),/let committed=false/);
assert.match(read('src/pages/Workspace.tsx'),/Назад/);
assert.doesNotMatch(read('src/components/RegularGoals.tsx'),/Ручной прогресс|Ручной процент/);


const prodeskFlow=read('src/App.tsx'),taskDoc=read('src/components/TaskDocument.tsx'),pipelineFlow=read('src/components/WorkspacePipeline.tsx'),os8Source=read('supabase/06-os8-index.ts');
assert.match(prodeskFlow,/sidebar-section-toggle/);
assert.match(prodeskFlow,/recentTasks\.slice\(0,10\)/);
assert.match(prodeskFlow,/readSaveState/);
assert.match(taskDoc,/paragraphTop/,'Editor gutter must follow active paragraph rather than caret wrapping');
assert.doesNotMatch(taskDoc,/className="editor-save-hint"/);
assert.match(pipelineFlow,/os-four-dot-grip/);
assert.match(pipelineFlow,/workflow_reorder/);
assert.match(read('src/pages/CorePages.tsx'),/\['working','В работе'\]/);
assert.match(os8Source,/act==='task_rollover'/);
assert.match(os8Source,/act==='task_library'/);
assert.match(os8Source,/os9_regular_goal_tasks/);
assert.match(read('src/AppContext.tsx'),/request\('os8','task_rollover'/);
console.log('ProDesk flow 6.15: sidebar, recent tasks, stable gutter, cloud, working view and rollover contracts OK');
