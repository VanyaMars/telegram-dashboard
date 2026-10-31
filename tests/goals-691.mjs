import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const p of ['src/components/GoalsWorkspace.tsx','src/components/RegularGoals.tsx','src/pages/CorePages.tsx','src/pages/Workspace.tsx','src/pages/BufferWorkspace.tsx','src/qa/sandbox.ts','supabase/06-os8-index.ts']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(ast.parseDiagnostics.length,0,'TypeScript syntax '+p);
}
const goals=read('src/components/GoalsWorkspace.tsx'),regular=read('src/components/RegularGoals.tsx'),qa=read('src/qa/sandbox.ts'),buffer=read('src/pages/BufferWorkspace.tsx'),workspace=read('src/pages/Workspace.tsx');
assert.match(goals,/goal_documents_list/);
assert.match(goals,/goal_document_save/);
assert.match(goals,/goal-metric-preview/);
assert.match(goals,/goal-featured-overview/);
assert.match(goals,/task_reschedule/);
assert.match(goals,/task_toggle/);
assert.match(goals,/draftId/);
assert.doesNotMatch(goals,/writeGoalDocument/);
assert.doesNotMatch(regular,/Ручной процент|Ручной прогресс/);
assert.match(qa,/goalDocuments/);
assert.match(qa,/goal_document_save/);
assert.match(qa,/task_reschedule/);
assert.match(buffer,/taskPage/);
assert.doesNotMatch(buffer,/mvp-pages-toggle|workspaceMode/);
assert.match(workspace,/Назад в буфер задач/);
assert.doesNotMatch(workspace,/#\/workspace/);
assert.match(read('supabase/09-goal-documents.sql'),/enable row level security/);
assert.match(read('supabase/06-os8-index.ts'),/telegram_user_id/);
console.log('6.9.1 root cause and safety static tests OK');
