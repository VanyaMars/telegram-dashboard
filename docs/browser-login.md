# Вход в ProDesk через Telegram из браузера

Браузер открывает Telegram Login для действующего бота ProDesk. Подписанный
Telegram ID из поля `id` используется в существующих запросах к
`telegram_user_id`. У Telegram OIDC поле `sub` имеет другое назначение.
Сессия ProDesk живёт до 12 часов в текущей вкладке и переживает её
перезагрузку. Вход в Mini App продолжает проходить через Telegram `initData`.

## Настройка и проверка

1. В BotFather выбери нужного бота, открой **Login Widget** и добавь точный
   URL возврата. Для действующего GitHub Pages это
   `https://vanyamars.github.io/telegram-dashboard/`. Telegram должен
   использовать подпись RS256.
2. В Supabase Edge Function Secrets сохрани `TG_OIDC_CLIENT_SECRET` из Login
   Widget, `PRODESK_WEB_REDIRECT_URL` с тем же URL и
   `PRODESK_WEB_SESSION_SECRET` со случайным 32-байтным ключом в HEX.
   Ключ можно создать командой `openssl rand -hex 32`. `TG_BOT_TOKEN` уже
   используется текущим ботом, а его числовой префикс задаёт ожидаемый
   Client ID. `TG_ALLOWED_USER_ID`, если задан, применяется к обоим способам
   входа.
3. В тестовом проекте используй тестового бота и установи `VITE_SUPABASE_URL`
   в URL этого проекта и укажи HTTPS-адрес тестового сайта в
   `PRODESK_WEB_REDIRECT_URL` и BotFather. Разверни `dashboard`, `os6`, `os61`, `os7`, `os8`, `os9`,
   затем `browser-auth` из этой ветки, по одной функции за раз.
   Используй версию Supabase CLI с поддержкой `entrypoint` из
   `supabase/config.toml`. Проверь точный ref перед запуском
   `supabase functions deploy <slug> --project-ref <ref>`.
4. В тестовом браузере подтверди вход в Telegram. Сравни задачи и цели с тем
   же аккаунтом в Mini App, измени тестовую задачу и проверь синхронизацию.
   Проверь перезагрузку, выход, отмену входа, просроченную сессию и аккаунт
   вне списка доступа, если для теста включён список.
5. После проверки сохрани копии действующих Edge Functions. В рабочем проекте
   разверни шесть функций данных, затем `browser-auth`. После отдельной
   проверки опубликуй GitHub Pages. Миграция базы не нужна.

## Откат

Отключи выдачу браузерных сессий удалением `TG_OIDC_CLIENT_SECRET`. Для
немедленной отмены всех выданных сессий удали или замени
`PRODESK_WEB_SESSION_SECRET`. При полном откате верни прежний GitHub Pages
и сохранённые версии Edge Functions.
