# Personal OS — MVP backlog after 6.4

## Implemented in candidate 6.4
- [x] Progress rail fills card, no broken text, 100–200% color states.
- [x] Replace old weekly task/sales/sport targets from visible settings and top-level KPI cards.
- [x] Full-width task-page, Back, categories and search by section in buffer.
- [x] Explicit validation for missing Split title, compact enter/submit controls.
- [x] Text block autosave with indicator and retry.
- [x] Confirmed earned-income field for work-related task page with currency/date.
- [x] Analytics for goals, linked regular-goal task counts, buffer, discipline, challenges, tasks and confirmed income.
- [x] Archive task pages on delete and reconnect on restore using old ID.

## P0/P1 to validate before production
- [ ] GitHub Actions: TypeScript build and Vite publication green.
- [ ] Supabase staging: migrations and os9 auth/ownership verified (user A cannot access B).
- [ ] Task delete/Undo restores same task ID, page blocks and Pipeline; actual dashboard task_restore implementation may differ.
- [ ] Work-task income remains in analytics after task deletion and can be viewed on restore.
- [ ] New/old page content survives Telegram WebView refresh, MacBook and iPhone.
- [ ] Test superseded submissions: rapid textarea changes, network offline/online, stale server reply.
- [ ] Analytics accuracy against hand-calculated small dataset, specifically time zone, planned vs completion date.
- [ ] Add completion timestamps; current os6 metrics may reflect scheduled date instead.
- [ ] Implement consistent caching/selective refresh to avoid full app bootstrap after every small mutation.

## P2 (MVP iteration)
- [ ] Consistent goal linking from quick-task modal as well as task-page (currently page-only for regular goals).
- [ ] Optional true 5-minute warm-up mode in Focus that persists across minimized Telegram; current Home CTA opens Focus.
- [ ] Separate trash / archived-pages management and retention/restore UI.
- [ ] Live field-edit autosave status for date/category, not only content blocks.
- [ ] Test screen readers, reduced motion, keyboard focus, 320/390/768/1440 px in actual deployed app.
- [ ] User test: first capture, next action, plan, execute, completed task and one weekly review with three non-developers.

The audit skill `Personal OS MVP Auditor` provides the repeatable checklists and analytics rubric.
