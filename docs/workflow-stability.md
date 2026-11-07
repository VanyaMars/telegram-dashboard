# Workflow list stability

## Reproduction and cause

The supplied 15-second recording shows actions being added to a Pipeline stage, followed by completion. Each optimistic action used a temporary ID as its React key. Replacing it with the saved ID made AnimatePresence retain the exiting temporary row while mounting a new confirmed row. Both rows briefly occupied space and pushed the input down and back up.

## Behavior

- Keep the same mounted row across the temporary-to-saved ID handoff, including subsequent data refreshes.
- Expand or collapse only an inserted/deleted row over 180 ms. Explicit reordering retains position animation; ordinary confirmations do not trigger stage/list springs.
- Keep the next-action/completion message in a fixed two-line slot so changing status does not shift the stages below it.
- Focus the add field without forced scrolling. Deletion immediately removes the action locally; failed deletion restores it and shows an error. Successful deletion remains hidden during reconciliation, including stale reads.
- Preserve existing confirmation dialogs, editing, ordering and saved IDs. Reduced motion uses zero-duration row transitions.

## Verification

The new `tests/e2e/workflow-stability.spec.ts` uses the real QA transport with a test-only 400 ms delay. At 320, 390, 430 and 1440 CSS px it checks mounted-node identity, absence of duplicate rows, sampled input-position bounds, completion stability, input focus and deletion persistence after reload. Separate cases cover failed creation/deletion and reduced motion. External HTTPS requests are blocked; data is disposable local QA data.

Run the complete browser suite, all `tests/*.mjs`, and `npm run build`. Actual results and current-head CI are recorded in the PR.

NOT RUN: physical iOS/Android Telegram WebView, native keyboard behavior, FPS profiling, authenticated production CRUD. Browser viewport tests do not establish physical-device performance.

## Release and rollback

Frontend-only fix; no schema, API contract, Supabase, authentication, or production-data changes. Review and release this branch separately. Rollback is a frontend revert and rebuild; no stored-data rollback is required.
