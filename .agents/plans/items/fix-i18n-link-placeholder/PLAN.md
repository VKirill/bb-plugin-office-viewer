# Fix: i18n coverage test fails on the «https://» placeholder

`node --experimental-strip-types --test src/studio/i18n-coverage.test.ts` fails: `studio tsx has no hard-coded UI words` reports `prototype/inspector-interactions.tsx "https://"` — the «Открыть ссылку» action's URL input has a literal `placeholder="https://"` (added by prototype-interactions-preview).

Fix it the clean way: move the placeholder to an i18n key (e.g. `protoLinkPlaceholder`: RU «https://пример.рф», EN «https://example.com») and use `t()` there. Do not weaken the coverage test. Run the whole studio test set to make sure nothing else is hard-coded.

## Completion
- [x] Translate the interactions inspector link URL placeholder and restore the i18n coverage test.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `fix-i18n-link-placeholder`).
