## 6.12.0 — Task UX and completed-task library

- Shared restrained appearance informed by Apple HIG; consistent controls, neutral content surfaces, system fonts and simpler mobile layouts.
- Document-first task page with optional properties, income and nested pages; secondary task and Workflow actions in menus.
- Contextual insertion/formatting controls follow the native caret and available viewport; visible text caret, compact checklists and focused insertion dialogs.
- Completed tasks across all dates, search, pagination, open contents and undo completion; separate template/archive views.
- No schema migration; os8 task_library applies owner-scoped filters and pagination on the server.

## 6.11.0 — Task document editor

- Rich text, nested lists, compact checklists and collapsible sections; old text blocks remain editable.
- Custom priorities, per-task custom property visibility, recoverable removal of shared property definitions, optional notes and separate deadline.
- Block menu, editable Pipeline title, mobile stage/action creation, stage copy and action transfer.
- Task duplication with independent page tree and Pipeline, reusable templates, archive/restore, completion in the editor.
- Local document drafts, ordered autosave and retry; database snapshots restore custom values and goal links on deletion Undo.

# Personal OS 6.1 — Changelog

**Добавлено**
- Новая светлая Premium UI дизайн-система (glass cards, молочно-белые поверхности, лавандовые/мятные/персиковые акценты).
- Модульный React + TypeScript + Vite, публикация GitHub Pages через GitHub Actions.
- Центральный экран «Главное» с KPI, задачами, целями, финансами, спортом и динамикой недели.
- Выдвижная боковая панель и нижнее меню «Главное / Сегодня / Цели / Аналитика».
- Перенесённый в боковое меню Буфер, категории, календарь и все существующие 6.0 модули.
- Статус синхронизации в облаке и справка в шапке, номер версии внизу.
- Учёт личного часового пояса и переход через полночь.
- Перетаскивание задач и сохранение пользовательского порядка на сервере.
- Постоянные пользовательские категории: создание, переименование, цвет, иконка, сортировка, безопасное удаление.
- Новая Edge Function `os61` и добавочная SQL-миграция.

**Сохранено**
- Авторизация по Telegram ID, действующие `dashboard`/`os6`/`telegram-webhook`.
- Все прежние записи задач, целей, KPI, финансов, спорта и истории.
- Формула прогресса дня до 200%; недельный KPI из подтверждённых действий.
- Отмена удаления задачи, связь задач с целями, повторения, вызовы, фокус-таймер, обзоры.

**Не меняется**
- URL Mini App и тарифы GitHub Pages + Supabase Free.
- Настройка Cron/напоминаний (отложена по запросу пользователя).
