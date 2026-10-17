# Fix: opacity from the Style panel does not change the element on the canvas

Owner: set an element's opacity to 10 % in the Style tab → nothing changes on the canvas.

What I checked (do not repeat blindly, confirm): inspector-style-panel.tsx «Прозрачность» ScrubField calls `applyStyleField("opacity", value/100)`; inspector.tsx `applyStyleField` writes `style.base.opacity` (or `style.effects[target]` when a state is picked); model.ts zod schema has `opacity`; `stylePatchToInline` maps opacity; canvas.tsx ≈ line 226 spreads `stylePatchToInline(resolveStylePatch(el, "base"))` into the element wrapper. So the bug is elsewhere: candidates — the ScrubField never calls onChange for typed/scrubbed values (only on blur/Enter, or with a string), `styleTarget` stays on a non-base state so the value goes into effects and the canvas only renders base, the canvas used for the page is a different render path (e.g. page/board component, group wrapper, ElementFace or the live drag preview ignoring `style`), `updateMany` not committing, or a later style key overriding (`opacity-80` class for locked, a child `bg-*` covering).

Do:
1. Reproduce in a unit-level check first: extract the element wrapper style computation used by the canvas into a pure function (e.g. `elementBoxStyle(el, previewTarget)` in inspector-model.ts or canvas-math.ts) and write a failing test for opacity 0.1 → `opacity: 0.1`; also a test for the inspector field → patch path (ScrubField value parsing: «10», «10%», scrub) if logic is extractable.
2. Find the real root cause in the running UI path and fix it so opacity — and every other Style field (fill, border, radius, font, colour, text align, shadow, padding) — visibly applies on the canvas immediately, in PNG export and in Slides (which reuses the board). When a «Просмотр состояния» effect is selected, the canvas shows base+effect for the selected element; otherwise base.
3. Report the root cause in one sentence.

- Completed and accepted in Lane Pilot run `lprun_38203a8bf69c43f294a012b07bded797` (task `prototype-style-apply-fix`).
