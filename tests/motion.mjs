import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const motionFiles=[
 'src/components/OSMotion.tsx','src/components/MotionNumber.tsx',
 'src/components/PlanScore.tsx','src/components/UI.tsx',
 'src/components/RegularGoals.tsx','src/components/Tasks.tsx',
 'src/pages/HabitsPage.tsx','src/App.tsx','src/main.tsx'
];
for(const file of motionFiles){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(source.parseDiagnostics.length,0,'Motion TSX must parse: '+file);
}
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.dependencies.motion,'14.6.0','Use a pinned Motion release');
assert.match(read('src/main.tsx'),/OSMotionProvider/);
const shell=read('src/App.tsx');
assert.match(shell,/MotionRoute screen=\{tab\}/,'Routes are keyed by selected tab');
assert.match(shell,/layoutId="os-bottom-active"/,'Mobile selection animates between tabs');
const provider=read('src/components/OSMotion.tsx');
assert.match(provider,/reducedMotion="user"/);
assert.match(provider,/useReducedMotion/);
assert.match(provider,/LazyMotion/);
const score=read('src/components/PlanScore.tsx');
assert.match(score,/MotionNumber/);
assert.match(score,/motion-progress-fill/);
assert.match(read('src/components/UI.tsx'),/whileHover/);
assert.match(read('src/pages/HabitsPage.tsx'),/whileTap/);
assert.match(read('src/components/Tasks.tsx'),/whileTap/);
const css=read('src/styles.css');
assert.match(css,/\.motion-route \.page-stack\{animation:none\}/);
assert.match(css,/prefers-reduced-motion:reduce/);
assert.match(css,/\.motion-progress-fill\{transition:none!important\}/);
assert.ok(!read('src/lib/api.ts').includes('motion'),'The new UX must not modify API request handling');
console.log('✓ 6.6 Motion: TSX syntax, route policy, KPI animation, gestures, accessibility, integration');
