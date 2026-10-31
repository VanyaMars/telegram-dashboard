# Goals data normalization — v6.9.1

PROPOSED, **not executed**. The deployed os8 source was confirmed byte-for-byte identical to the GitHub copy before this change. User reports raw JSON in notes because v6.9.0 appended a legacy marker to goal descriptions.

- New owner-scoped os10_goal_documents table stores typed fields (JSONB) and closure timestamp. RLS enabled; anon and authenticated SQL roles have no table grants. Edge functions verify Telegram initData HMAC and goal ownership.
- Existing os8 adds goal_documents_list and goal_document_save. Save validates 0-24 fields, <=2 featured, plain notesBody, persists metadata first, then replaces old legacy description with user-readable notes. No new secrets.
- Existing legacy marker can be decoded **read-only** in frontend for backward compatibility; new saves must not append metadata to notes.
- Future deletion cleanup should check ownership and dependent documents; no destructive cleanup in this PR.

Required release gates (separate authorization): restorable backup, staging migration and staged os8 deploy; happy-path, legacy data, denied foreign goal, expired/bad HMAC, linked tasks, errors and retries; explicit approval for production migration and Edge deployment; finally frontend merge. Never publish frontend with new API before backend is ready. Roll back frontend/Edge first, preserve the additive table and data.
