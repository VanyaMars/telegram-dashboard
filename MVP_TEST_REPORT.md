# MVP 6.4 — test report

## Pass (локально)
- `node tests/smoke.mjs`: PASS
- `node tests/workspace.mjs`: PASS
- `node tests/unified.mjs`: PASS
- `node tests/mvp.mjs`: PASS
- Static TS/TSX parser diagnostics: PASS for analytics, income, task-page, Pipeline, Edge Function.
- Migration guards: SQL includes per-user ownership, RLS, non-destructive archive, no DROP TABLE/TRUNCATE.

## Not yet verified
- `npm run build` / `tsc --noEmit`: blocked by unavailable npm registry; install dependencies in GitHub Actions.
- React end-to-end browser tests, mobile rendering and layout screenshot: not performed on full app.
- Supabase migration and new Edge Function deployed to production: not performed.
- Live existing `dashboard task_restore`: source unavailable in this repo; test reattachment after delete/undo with original ID.
- Security fuzzing and performance profiling: not performed.

This is a release candidate, not a production-certified build.
