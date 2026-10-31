import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

for(const path of ['src/components/OSMotion.tsx','src/components/UI.tsx','src/components/MotionNumber.tsx',
 'src/components/PremiumControls.tsx','src/components/PlanScore.tsx','src/components/Tasks.tsx',
 'src/pages/HabitsPage.tsx','src/App.tsx','src/pages/CorePages.tsx']){
 const source=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(source.parseDiagnostics.length,0,'Valid TSX: '+path);
}
const motion=ts.createSourceFile('src/components/motionTokens.ts',read('src/components/motionTokens.ts'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(motion.parseDiagnostics.length,0);
const css=read('src/premium.css');
for(const value of ['#F5F6F8','#242835','#6658D9','#277561']){
 assert.ok(css.includes(value),'Calm Precision token missing: '+value);
}
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/focus-visible/);
assert.match(read('src/App.tsx'),/premium\.css/);
assert.match(read('src/App.tsx'),/layoutId="os-sidebar-selection"/);
assert.match(read('src/components/OSMotion.tsx'),/mode="sync"/);
assert.doesNotMatch(read('src/components/OSMotion.tsx'),/mode="wait"/);
assert.match(read('src/components/MotionNumber.tsx'),/useRef\(target\)/);
assert.match(read('src/components/UI.tsx'),/initial=\{false\} animate=\{\{scaleX:/);
assert.match(read('src/components/PlanScore.tsx'),/scaleX:mainPercent\/100/);
assert.match(read('src/components/PremiumControls.tsx'),/aria-busy/);
assert.doesNotMatch(read('src/App.tsx'),/label:'Фокус-таймер'|label:'Повторения'|label:'Доходы'/);
assert.doesNotMatch(read('src/pages/CorePages.tsx'),/open\('focus'\)/);
assert.match(read('src/components/Tasks.tsx'),/scale:0\.975/);
assert.match(read('src/pages/HabitsPage.tsx'),/scale:0\.975/);
console.log('6.8 foundations: tokens, Motion policy, accessible buttons and truthful progress OK');
