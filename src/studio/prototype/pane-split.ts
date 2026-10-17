export const LEFT_PANE_SPLIT_STORAGE_KEY = "bb-prototype-left-pane-split";
export const LEFT_PANE_MIN_SECTION = 80;
export const LEFT_PANE_DIVIDER_SIZE = 6;
export const LEFT_PANE_PAGES_COLLAPSED_HEIGHT = 40;
export const LEFT_PANE_LIBRARIES_COLLAPSED_HEIGHT = 32;
export const LEFT_PANE_SPLIT_STEP = 16;

export type LeftPaneSplitState = {
  topRatio: number;
  pagesCollapsed: boolean;
  librariesCollapsed: boolean;
};

export const DEFAULT_LEFT_PANE_SPLIT: LeftPaneSplitState = {
  topRatio: 0.4,
  pagesCollapsed: false,
  librariesCollapsed: false,
};

export function clampRatio(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LEFT_PANE_SPLIT.topRatio;
  return Math.min(0.85, Math.max(0.15, value));
}

export function parseLeftPaneSplit(raw: string | null | undefined): LeftPaneSplitState {
  if (!raw) return { ...DEFAULT_LEFT_PANE_SPLIT };
  try {
    const data = JSON.parse(raw) as Partial<LeftPaneSplitState>;
    return {
      topRatio: clampRatio(typeof data.topRatio === "number" ? data.topRatio : DEFAULT_LEFT_PANE_SPLIT.topRatio),
      pagesCollapsed: data.pagesCollapsed === true,
      librariesCollapsed: data.librariesCollapsed === true,
    };
  } catch {
    return { ...DEFAULT_LEFT_PANE_SPLIT };
  }
}

export function readLeftPaneSplit(): LeftPaneSplitState {
  try {
    return parseLeftPaneSplit(globalThis.localStorage?.getItem(LEFT_PANE_SPLIT_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_LEFT_PANE_SPLIT };
  }
}

export function writeLeftPaneSplit(state: LeftPaneSplitState): void {
  try {
    globalThis.localStorage?.setItem(
      LEFT_PANE_SPLIT_STORAGE_KEY,
      JSON.stringify({
        topRatio: clampRatio(state.topRatio),
        pagesCollapsed: state.pagesCollapsed,
        librariesCollapsed: state.librariesCollapsed,
      }),
    );
  } catch {
    // private mode
  }
}

export function resolveLeftPaneHeights(totalHeight: number, state: LeftPaneSplitState): { top: number; bottom: number } {
  const divider = LEFT_PANE_DIVIDER_SIZE;
  const total = Math.max(0, totalHeight);
  if (total <= divider) return { top: 0, bottom: 0 };

  if (state.pagesCollapsed && state.librariesCollapsed) {
    const top = Math.min(LEFT_PANE_PAGES_COLLAPSED_HEIGHT, total - divider);
    const bottom = Math.max(0, total - divider - top);
    return { top, bottom };
  }

  if (state.pagesCollapsed) {
    const top = LEFT_PANE_PAGES_COLLAPSED_HEIGHT;
    const bottom = Math.max(LEFT_PANE_MIN_SECTION, total - divider - top);
    return { top, bottom };
  }

  if (state.librariesCollapsed) {
    const bottom = LEFT_PANE_LIBRARIES_COLLAPSED_HEIGHT;
    const top = Math.max(LEFT_PANE_MIN_SECTION, total - divider - bottom);
    return { top, bottom };
  }

  const available = total - divider;
  let top = Math.round(available * clampRatio(state.topRatio));
  top = Math.min(Math.max(top, LEFT_PANE_MIN_SECTION), available - LEFT_PANE_MIN_SECTION);
  const bottom = available - top;
  return { top, bottom };
}

export function topRatioFromHeight(totalHeight: number, topHeight: number, state: LeftPaneSplitState): number {
  if (state.pagesCollapsed || state.librariesCollapsed) return state.topRatio;
  const divider = LEFT_PANE_DIVIDER_SIZE;
  const available = Math.max(LEFT_PANE_MIN_SECTION * 2, totalHeight - divider);
  const top = Math.min(Math.max(topHeight, LEFT_PANE_MIN_SECTION), available - LEFT_PANE_MIN_SECTION);
  return clampRatio(top / available);
}

export function togglePagesCollapsed(state: LeftPaneSplitState): LeftPaneSplitState {
  return { ...state, pagesCollapsed: !state.pagesCollapsed };
}

export function toggleLibrariesCollapsed(state: LeftPaneSplitState): LeftPaneSplitState {
  return { ...state, librariesCollapsed: !state.librariesCollapsed };
}

export type SplitDividerKey = "ArrowUp" | "ArrowDown" | "Home" | "End";

export function adjustSplitByKeyboard(
  totalHeight: number,
  state: LeftPaneSplitState,
  key: SplitDividerKey,
): LeftPaneSplitState {
  if (state.pagesCollapsed || state.librariesCollapsed) return state;
  const { top } = resolveLeftPaneHeights(totalHeight, state);
  const divider = LEFT_PANE_DIVIDER_SIZE;
  const available = totalHeight - divider;
  let nextTop = top;
  if (key === "ArrowUp") nextTop -= LEFT_PANE_SPLIT_STEP;
  else if (key === "ArrowDown") nextTop += LEFT_PANE_SPLIT_STEP;
  else if (key === "Home") nextTop = LEFT_PANE_MIN_SECTION;
  else if (key === "End") nextTop = available - LEFT_PANE_MIN_SECTION;
  return { ...state, topRatio: topRatioFromHeight(totalHeight, nextTop, state) };
}
