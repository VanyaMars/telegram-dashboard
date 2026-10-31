import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
for(const p of ['src/pages/Workspace.tsx','src/components/TaskPropertyAppearance.tsx','src/components/TaskCustomProperties.tsx','src/qa/sandbox.ts','supabase/06-os8-index.ts']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(ast.parseDiagnostics.length,0,'Invalid syntax in '+p);
}
const w=read('src/pages/Workspace.tsx'),b=read('supabase/06-os8-index.ts');
assert.doesNotMatch(w,/os-property-submit|requestSubmit\(|Ctrl \+ Enter/);
assert.match(w,/task_native_patch/);
assert.match(w,/notesTimer/);
assert.match(w,/saveField\('goal'/);
assert.match(w,/os-category-menu/);
assert.match(w,/Добавить категорию/);
assert.match(w,/TaskPropertyAppearance fieldKey="category"/);
assert.match(read('src/components/TaskCustomProperties.tsx'),/TaskPropertyAppearance fieldKey=\{f.id\}/);
assert.match(b,/act==='task_native_fields'/);
assert.match(b,/act==='task_field_appearance'/);
assert.match(b,/act==='task_native_patch'/);
assert.match(b,/os61_category_id:category\?\.id/);
assert.match(b,/onConflict:'telegram_user_id,task_id'/);
console.log('Native autosave, category picker and property appearance contracts OK');
