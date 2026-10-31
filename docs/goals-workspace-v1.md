# Personal OS 6.9 Goals Workspace · Compatibility implementation

Status: **frontend candidate PR, not released**, based on current verified live schema and Edge contracts.

## UX and models
- No top-level Focus timer, Income page or Repeats UI. Task income and Analytics income remain. Old focus/repeat database rows intentionally preserved and not deleted.
- Two sections in Goals: **Цели** (os8_regular_goals) and **Стратегические цели** (ambitious_goals), filtered by one Active/Closed segmented control.
- Cards: title, real created_at age, real closedAt (if available), linked-task count, narrow progress and 0-2 user-selected indicators.
- Goal detail deep-link /goal/{regular|strategic}/{uuid}, with Overview / Tasks / Analytics tabs. Existing task-page deep links remain intact.
- Progress: unweighted average of available measurable sources (numeric main value for strategic, linked-task completed ratio, percentage/number/checkbox fields). Fields without a meaningful numeric target do not contribute. Average is an explicit temporary policy and subject to user review.
- Historical points are shown **only** for real strategic goal_history events, not made-up daily series. Ordinary goal analytics is a current snapshot.

## Data compatibility strategy: no production migration
The verified live os8.goal_save accepts title, description (max 6000), period, starts_on, ends_on and progress. The verified dashboard.goal_save accepts ambitious goal notes (max 6000), and numeric fields. A dedicated persisted metrics/closure table does not exist.

To make new UI functional **without deploying a new Supabase Edge Function or SQL migration**, v1 encodes additional properties in a reversible, versioned suffix to existing description/notes:
- Marker: \`[PERSONAL_OS_GOAL_DOCUMENT_V1]\`
- Payload: JSON \`{version:1,closedAt,previousProgress,fields:[{id,label,type,value,start,target,unit,options,featured}]}\`
- Decoding validates the marker and schema; unknown/invalid legacy text remains unchanged; old notes remain visible in editors; original created_at and goal IDs are untouched.
- Max 24 fields, 2 featured, payload 5900 chars, backend validation limit 6000.
- This is a **compatibility bridge**, not the final ideal database architecture. Do not edit raw encoded description with an older frontend after using new metrics: old code might overwrite the suffix. Future normalization should migrate validated JSON to a new tenant-owned table in staging first, retaining original notes and exact timestamps.
- Regular goal closure: os8.goal_save progresses to 100 and already sets completed=true, while actual closedAt comes from the suffix. Reopening restores previous manual progress. Legacy goals marked completed before v1 show **Closed · date unknown** rather than an invented duration.
- Strategic goal closure: closedAt stored in versioned notes suffix only. Existing historic numeric progress is not reset when closed.

## Tasks and links
- Task creation uses the existing os6.task_save_and_link. For regular goals it then uses the verified os9.regular_goal_set by task ID; retry reuses the ID to avoid duplicates on partial failure.
- Strategic links use verified os6.goal_id binding; regular links use os9. No new action name introduced.
- Existing goals' aggregate regular task counts come from os9.regular_goal_stats, not from calendar snapshots.
- **Task list limitation**: currently displayed task rows are sourced from Buffer/Today and 60 days back + 61 days ahead, because the live os6 calendar endpoint caps each request to 66 days. Regular goal aggregate total/done is exact; rows outside the window are disclosed. For strategic goals, linked-task count is known from os6.links, but historical completion of off-window rows cannot be fully verified without a new tenant-scoped bulk endpoint.
- A later backend release should add an authenticated, owner-filtered \`goal_tasks_list\` API and normalized \`goal_properties\` storage, tested against a separate staging project.

## Acceptance / rollback
- Verify all legacy tests, TS/Vite build and new Goals Workspace/Playwright browser scenarios on PR head.
- Guest QA stores its data locally; real Telegram WebView, old notes compatibility and multi-device synchronization need device acceptance.
- Rollback frontend by reverting PR; no SQL backout, no loss of linked tasks, history or earnings. Metadata suffix remains stored in notes and is readable by this implementation on re-deploy.
