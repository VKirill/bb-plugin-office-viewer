# Prototype: one screen-size control instead of three duplicates

Owner screenshot: device presets appear twice — icon segmented control in the top toolbar (laptop / odd tablet icon / phone) and text buttons «Компьютер | Планшет | Телефон» in the style bar — plus separate W and H fields and a raw `#ffffff` text field. Confusing and inconsistent.

Make one control, Figma/Axure-like:
1. Remove the device segmented control from the top toolbar (toolbar.tsx) and the three text buttons from the page style bar (shell.tsx style bar).
2. In the page style bar (nothing selected) put a single **«Размер экрана»** dropdown button showing the current preset and size, e.g. `[🖥 Компьютер · 1280 × 800 ▾]`. Its menu: groups Компьютер (1920×1080, 1440×900, 1280×800), Ноутбук (1366×768), Планшет (iPad 820×1180, iPad Pro 1024×1366, Android 800×1280), Телефон (iPhone 15 393×852, iPhone SE 375×667, Android 412×915), each item with an icon and size; a «Свой размер…» item; and an orientation toggle (portrait/landscape) in the menu footer that swaps W/H. Use consistent icons from the registry (desktop/laptop/tablet/phone, all same style; replace the odd tablet icon).
3. Next to it compact W and H number inputs (small, 64 px, «Ш»/«В» labels inside or as prefixes) that edit the size; editing them switches the dropdown label to «Свой размер».
4. Background: a colour swatch button (circle with the colour + popover with theme presets — white, light grey, dark, transparent checkerboard — and a hex input) instead of the raw `#ffffff` field.
5. Also tidy the top toolbar: keep groups with one separator between groups, all icon buttons 28 px with tooltips; the prototype name field narrower (max 180 px, inline-edit look: no border until hover/focus). The Pages/Inspector pane toggles stay as the two panel icons.
6. Keep `CANVAS_PRESETS` in model.ts as the single source; extend it with the list above (id, group, label RU/EN, w, h, icon). Test that every preset has positive sizes and a unique id, and that orientation swap is correct (pure helpers in model or a small `devices.ts` + test).

## Completion
- [x] Replace duplicate device controls with one preset dropdown, compact dimensions, and colour swatch.

## History
### 2026-10-17
- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-screen-size`).
