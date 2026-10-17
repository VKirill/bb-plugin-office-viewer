# Re-number release 0.9.0 as 0.8.10

BB installed this plugin with the source range `^0.8.1`, which does not accept 0.9.0, and reinstalling would delete the plugin's settings. Ship the same content as 0.8.10:
1. package.json and package-lock.json root version: 0.9.0 -> 0.8.10 (no reinstall).
2. CHANGELOG.md: rename the heading `## 0.9.0 — 2026-10-17` to `## 0.8.10 — 2026-10-17`; keep its text.
Nothing else changes.

## Completion
- [x] Ship the Axure parity batch as version 0.8.10 without reinstalling the plugin.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `release-0.8.10`).
