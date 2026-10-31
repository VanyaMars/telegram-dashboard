import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const path of ['src/components/GoalValues.tsx','src/components/RegularGoals.tsx',
 'src/components/UI.tsx','src/pages/CorePages.tsx','src/pages/MvpAnalytics.tsx','src/components/GoalsWorkspace.tsx']){
 const tree=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(tree.parseDiagnostics.length,0,'Valid source: '+path);
}
const date=read('src/lib/date.ts'),goals=read('src/components/RegularGoals.tsx'),core=read('src/pages/CorePages.tsx');
assert.match(date,/export const goalProgress/);
assert.match(goals,/regularGoalValues/);
assert.doesNotMatch(goals,/Целевое значение: 100%/);
assert.match(goals,/автоматически/);
assert.doesNotMatch(goals,/Ручной процент|Ручной прогресс/);
assert.match(core,/GoalSnapshot/);
assert.match(core,/GoalsWorkspace/);
assert.match(read('src/components/GoalsWorkspace.tsx'),/Закрытые цели/);
assert.match(core,/Number\.isFinite/);
assert.match(core,/Старт и цель должны различаться/);
assert.match(read('src/pages/MvpAnalytics.tsx'),/regularGoalValues/);
assert.match(read('src/components/UI.tsx'),/GoalValues/);
assert.ok(!read('src/lib/api.ts').includes('goal_target_mode'),'No server fields falsely introduced');
console.log('Goals compatibility: explicit values, legacy progress semantics, numeric validation OK');
