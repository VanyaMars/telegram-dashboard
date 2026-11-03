# Task UX revision — 6.12

## Analysis and design basis

The task editor mixed document content, metadata, financial fields, reusable blocks and secondary actions at the same visual level. Each text block exposed a separate fixed toolbar. Completed tasks were available only in collapsible groups for the selected day. The library endpoint exposed templates/archive, with no completed-task query.

Apple Human Interface Guidelines consulted on 2026-11-03:

- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout): hierarchy, grouping and coherent spacing.
- [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars): primary actions visible, secondary actions in menus, predictable placement.
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials): reserve glass for controls/navigation; keep content legible.
- [Design resources](https://developer.apple.com/design/resources/): the current macOS resource is [macOS 27 in Figma](https://www.figma.com/community/file/1651309434229735362/macos-27), within the requested 26+ range. The Community file could not be retrieved in this environment. This implementation follows published HIG principles and is not a pixel reproduction of inspected Figma layers.

## Result

- Shared neutral surfaces, system fonts, restrained borders, blue primary actions, semantic green completion, consistent navigation, menus and dialog styling. Glass is limited to chrome/contextual controls.
- Home removes repeated empty task content and decorative hero elements; mobile goal cards use the available width.
- Task page opens as a document. Completion, priority, properties and More form one command area. Properties, income and nested pages use progressive disclosure. Long titles wrap.
- One contextual editing toolbar belongs to the focused editor. It follows the native caret coordinates on input, selection changes, scrolling and viewport changes; typing reserves room above bottom navigation/keyboard. Native caret and selection remain the browser's responsibility, including IME.
- Slash at the start of a line opens insertion choices; compact checklists, formatting, collapsible sections and local-draft autosave remain supported.
- External block insertion opens the shared focused dialog and preserves the current text. Pipeline rename uses the same dialog style. Workflow actions are in a per-row menu rather than a permanent row of arrows.
- Buffer has separate Active, Completed, Templates and Archive views. Completed spans all dates, supports title search, pagination, opening contents, and undoing completion while preserving the original task ID and scheduled day. Returning from a task restores the selected library view.

## Backend and release

Deploy `supabase/06-os8-index.ts` as `os8` before the frontend. No schema migration is required. `task_library` validates view/offset, scopes every query to the Telegram-verified owner, applies filters in PostgreSQL, escapes LIKE metacharacters and returns at most 50 rows plus `hasMore`. Its default legacy mode continues to support the previous frontend.

Telegram HMAC verification, owner allowlist and all unrelated actions remain intact. No user records are migrated or rewritten by deployment.

## Verification

- TypeScript and production Vite build.
- Existing static regression suites plus `tests/task-library.mjs`, which executes the real Edge handler with signed test Telegram data and a recording database adapter: ownership, date independence, filtering, search escaping, pagination and rejected requests.
- Browser tests cover 320/390/430/1440 widths, caret geometry, one focused toolbar, a reduced viewport representing available keyboard space, compact multi-item checklists, save/reload, properties, templates/archive, stage/action creation and transfer, and a completed task scheduled in 2020.
- Real database schema and query compatibility checked read-only against an impossible owner ID; QA browser fixtures never call production Edge functions.
- Screenshots reviewed for desktop and mobile. Physical iOS/Android Telegram keyboard behaviour remains a device acceptance check; viewport simulation does not replace a real device.

## Rollback

Revert this frontend commit to 6.11 and redeploy the previous `os8` source from main commit `031b4cc05b333265df86823add5568ab1bc0cf57`. No database rollback is necessary.
