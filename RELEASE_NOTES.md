# Personal OS 6.2 - Workspace upgrade

Additive release based on Personal OS 6.1.

## New files
- src/lib/workspace.ts
- src/pages/Workspace.tsx and workspace.css
- src/components/WorkspaceDatabase.tsx
- src/components/WorkspacePipeline.tsx
- supabase/03-workspace-schema.sql
- supabase/04-os7-index.ts
- tests/workspace.mjs
- WORKSPACE_README.md and WORKSPACE_TEST_REPORT.md

## Updated files
- src/App.tsx, src/AppContext.tsx, src/types.ts, src/lib/api.ts
- src/components/Icons.tsx (Cloud icon build compatibility)
- package.json, .github/workflows/deploy.yml

## Retained
- Existing dashboard/os6/os61 Edge Functions, Telegram webhook, earlier database tables and functionality.

## Install in order
1. Backup GitHub code and database.
2. Run 03-workspace-schema.sql in Supabase SQL Editor.
3. Create new Edge Function os7 from 04-os7-index.ts, Verify JWT OFF only with Telegram initData validation kept intact.
4. Upload React source and workflow files to GitHub, run Actions build.
5. Test before treating as deployed. See README.md.
