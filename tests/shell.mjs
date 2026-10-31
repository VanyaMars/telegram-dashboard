import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const file of ['src/App.tsx','src/pages/MvpAnalytics.tsx','src/lib/navigation.ts','src/types.ts']){
 const script=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(script.parseDiagnostics.length,0,'Valid screen/route source: '+file);
}
const app=read('src/App.tsx'),an=read('src/pages/MvpAnalytics.tsx'),navigation=read('src/lib/navigation.ts');
assert.doesNotMatch(app,/label:'Страницы'/,'Pages must not be a separate sidebar item');
assert.match(app,/label:'Буфер задач'/);
assert.doesNotMatch(read('src/pages/BufferWorkspace.tsx'),/Дополнительные страницы и базы|os-workspace-panel/);
assert.match(read('src/pages/BufferWorkspace.tsx'),/taskPage/);
assert.match(read('src/pages/Workspace.tsx'),/Назад в буфер задач/);
assert.doesNotMatch(app,/label:'Доходы'/);
assert.doesNotMatch(app,/label:'Фокус-таймер'|label:'Повторения'/);
assert.match(app,/case 'analytics':return <MvpAnalyticsPage\/>/);
assert.doesNotMatch(app,/case 'income':|case 'focus':|case 'repeats':/);
assert.match(app,/MoreBottomItem/);
assert.match(app,/layoutId="os-bottom-active"/);
assert.match(app,/mobilePrimary/);
assert.doesNotMatch(navigation,/'income'|'focus'|'repeats'/);
assert.match(an,/getIncomeSummary/);
assert.doesNotMatch(an,/focusIncome|Фокус по задачам/);
assert.match(an,/os-income-section/);
assert.match(an,/доход учитывается по дате получения/i);
assert.doesNotMatch(read('src/lib/api.ts'),/goals_target_v2/);
console.log('6.8 Shell: Pages, Income, mobile More, analytics income source and legacy API separation OK');
