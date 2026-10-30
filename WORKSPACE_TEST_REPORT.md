# Personal OS 6.2 Workspace — test report

## Source audit

- Base project: Personal OS 6.1 React/TypeScript/Vite archive in the conversation, NOT a fresh clone of the current GitHub repository.
- Existing server actions `dashboard`, `os6`, `os61` preserved. No existing Supabase table is altered or dropped.
- New action API isolated under separate Edge Function `os7`.

## Passed checks

- TypeScript/TSX syntactic parsing of all `src` and Edge Function files: **PASS**.
- Existing `npm run test:smoke`: **PASS**.
- New `npm run test:workspace`: **PASS** (Split completion 100% / 50% / empty=0%, weighted 5 of 10 = 50%, October 2026 calendar, new 8-table schema, Telegram verifier guard, mobile split CSS).
- Chromium visual render at widths 320 / 390 / 768 / 1440 pixels: **PASS**, `document.documentElement.scrollWidth === window.innerWidth` for each.
- Mobile preview: Pipeline tabs and one selected Split card visible without horizontal page overflow.
- Desktop preview: horizontal Split columns inside a local scrolling container.
- Previously reported `CloudCheck` import problem is addressed by using the existing `Cloud` icon alias.

## Checks unavailable in this environment

- `npm install` timed out because the npm registry is unavailable in this runtime, so **full `npm run build` with installed React dependencies was NOT executed here**. GitHub Actions must run the production build.
- There is no authenticated access to your live Supabase, so the migration/Edge Function was **not executed against your database**.
- Actual Telegram WebView tests on iOS/Android were **not run**.
- End-to-end CRUD against a real Postgres instance and multiple Telegram users is **not yet verified**.

## Acceptance tests to complete on deployed environment

1. Create Page → reload → persists.
2. Add 8 block types → reload → persists.
3. Create Data Source → add 7 field types → add record → open as Page.
4. Switch four Views → no duplicate records.
5. Save View filter and sort → reload → settings persist.
6. Create 3 Split and 10 Workflow items → 5 completed → 50% Pipeline progress.
7. Reorder blocks, splits, and items → reload → order persists.
8. 320 / 360 / 375 / 390 / 430 px device checks in actual Telegram.
9. Two Telegram accounts → attempts to access another account's UUID are rejected.
10. Regression: old tasks, goals, finance and notifications remain unaffected.

**Do not treat this release as production-verified until GitHub Actions build is green and live checks pass.**