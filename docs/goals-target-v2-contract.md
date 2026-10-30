# Personal OS 6.8 · G01 Goals 2.0 · Compatibility Contract (draft)

Status: **proposal only**. This file is not a deployed Supabase schema, a working API, or authorization to migrate production.

## Verified current contracts (GitHub main at bd17e3fd)

- **Ambitious goals:** `src/types.ts` and `dashboard goals_save` client already use `start_value`, `current_value`, `target_value`, `unit`, `deadline`; UI can show explicit current/target with no new backend fields.
- **Ordinary goals:** `os8.goals_list/goal_save` and `RegularGoal` only expose `progress` (0–100 manual) and periods; `os9.regular_goal_stats` returns completed and total linked task counts. No durable numeric target/current/unit fields are currently proven.
- **Income and weight:** numeric goals do not automatically read os9 income or body-weight logs. No fabricated metrics.

## Compatibility policy implemented in PR

- Ambitious: `progress = clamp((current-start)/(target-start),0,1)*100`; works for decrease and increase. First paint shows real numbers; percentage is rounded only for display.
- Existing ordinary goal **with linked tasks**: display `Сейчас: done задач` / `Целевое значение: total задач`, with explicit **Автоматически** source. `total` is a dynamic linked count, **not** a fixed user target.
- Existing ordinary goal **without links**: display `Сейчас: progress%` / `Целевое значение: 100%`, with **Ручной процент** source.
- Never silently migrate a legacy goal into a numeric or fixed-action mode; preserve ID, period, linked task relations, manual value and history.

## Proposed additive server contract (NOT IMPLEMENTED)

Discuss typed data fields after checking actual live PostgreSQL table `os8_regular_goals` and deployed os8 Edge Function. Possible explicit modes:

1. `manual_percent`: current 0..100, target 100, legacy fallback;
2. `linked_dynamic`: current=done, target=currently linked total, legacy fallback;
3. `linked_fixed`: current=done in period, target=user-set integer N >= 1;
4. `numeric`: start/current/target finite values, unit, direction inferred by start vs target.

For numeric goals persist (not just display) start_value/current_value/target_value/unit and mode; for fixed linked persist target_count. These are **proposed names only**, not existing columns. Validate finite values, comma decimal input normalization, units, start != target, period boundaries and ownership.

## Rollout prerequisites

1. Inspect deployed `os8` handler, live schema, owner filtering, backups and test environment. GitHub source is not deployment evidence.
2. Prepare an **additive** DB migration and backwards-compatible Edge function support; verify Telegram HMAC, tenant filters and negative access checks in staging. Keep old `goal_save` and `goals_list` compatible.
3. Extend QA adapter with exact server semantics; test all four modes, edit/reload, 107→100→90 decrease, 1500→2100→3000 growth, target=0, empty/nonfinite validation, fixed N and legacy data.
4. Only after explicit authorization: controlled production migration, backend rollout, frontend feature flag and rollback. A frontend revert must not delete new columns or overwrite goals.

Current PR deliberately changes *only* frontend labels, presentation and numeric editing validation. It does not change APIs, RLS, Edge Functions, SQL, production data, or existing goal IDs.
