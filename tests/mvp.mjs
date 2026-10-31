import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const file of ['src/pages/MvpAnalytics.tsx','src/components/TaskIncome.tsx','src/pages/CorePages.tsx','src/pages/Workspace.tsx','src/components/WorkspacePipeline.tsx','supabase/08-os9-index.ts']){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(ast.parseDiagnostics.length,0,`Syntax error ${file}`);
}
const score=read('src/components/PlanScore.tsx');
assert.ok(score.includes('mainPercent')&&score.includes('plan-score-track'));
assert.ok(!score.includes('plan-score-caption'),'broken legacy caption must be absent');
const css=read('src/styles.css');assert.match(css,/\.hero-result \.plan-score-track.*width:100%/);
assert.match(read('src/pages/Workspace.tsx'),/os-task-page-only/);
assert.doesNotMatch(read('src/pages/Workspace.tsx'),/os-page-gallery|Все страницы/);
assert.match(read('src/components/WorkspacePipeline.tsx'),/Сначала введи название этапа/);
assert.match(read('src/pages/CorePages.tsx'),/buffer-categories/);
assert.ok(!read('src/pages/ExtraPages.tsx').includes('<SectionHead title="Цели на неделю"')); 
const sql=read('supabase/07-os9-mvp.sql');
for(const key of ['create table if not exists public.os9_task_income','enable row level security','os9_task_page_archive','drop trigger if exists os8_task_cleanup','os8_create_page_for_task'])assert.ok(sql.includes(key),key);
assert.doesNotMatch(sql,/\bdrop\s+table\b|\btruncate\s+table\b/i);
const backend=read('supabase/08-os9-index.ts');
for(const name of ['verify(String(body?.initData','telegram_user_id',"act==='income_summary'",'confirmed'])assert.ok(backend.includes(name),name);
assert.ok(backend.includes('TG_BOT_TOKEN'));
assert.ok(read('src/pages/MvpAnalytics.tsx').includes('getIncomeSummary'));
assert.ok(read('src/pages/MvpAnalytics.tsx').includes('buffer.length'));
console.log('✓ 6.4 MVP: TS syntax, progress, UX, income ownership, archive migration, product analytics');
