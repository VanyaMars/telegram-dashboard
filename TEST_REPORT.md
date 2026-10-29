# Personal OS 6.1 — Verification notes

## Completed in container

- [x] TypeScript/TSX syntax transpilation across all frontend modules and Edge Function.
- [x] Basic static TypeScript check with reduced local compatibility typings (not a substitute for real `tsc` after dependency installation).
- [x] Date calculations for Stockholm (UTC crossing midnight), Los Angeles, year change and ISO week.
- [x] Score formula: `1/1 important + 3/5 extra = 160%`; full extra -> `200%`.
- [x] Migration contains no DROP/TRUNCATE of old tables and imports legacy category names.
- [x] Authorization checks and server-side owner-based mutations present in `os61`.
- [x] Layout prototype inspected at widths 320 px, 390 px, 1440 px; horizontal overflow 0 px.
- [x] GitHub Actions workflow installs, checks and builds before deploy.

## Not verifiable in this isolated container

- [ ] Full production `npm install` and Vite build (npm registry unavailable).
- [ ] Full runtime integration with current Supabase project, real Telegram `initData`, and other user accounts.
- [ ] Gesture smoothness/keyboard flows on a real iOS Telegram client.
- [ ] Background Cron notifications (deliberately not installed in 6.1).

**Deployment gate:** GitHub Actions must show green for `npm run test:smoke` and `npm run build` before checking the published web app. Do not claim production verification before live tests.
