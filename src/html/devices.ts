// Office Viewer — screen presets for the HTML layout viewer, the hardware drawn
// around each screen, and the arithmetic that fits device mockups into the panel.

export type DeviceKind = "phone" | "tablet" | "desktop";
/** What surrounds the screen, and which system bars cover part of it. */
export type Hardware = "island" | "notch" | "punch-hole" | "home-button" | "tablet" | "mac-laptop" | "pc-laptop" | "monitor" | "none";
/** CSS pixels as the device naturally stands: phones and tablets upright, computers wide. */
export type Device = {
  id: string;
  name: string;
  kind: DeviceKind;
  hardware: Hardware;
  width: number;
  height: number;
  /** Share of screens of its kind, %. */
  share?: number;
  /** One of the few screens a layout is checked on: the narrowest and widest common ones of each kind. */
  main?: boolean;
};
export type Size = { w: number; h: number };
export type Insets = { top: number; right: number; bottom: number; left: number };

/** Screens people actually use (StatCounter, Russia, September 2026), plus current iPhones for reference. Main ones first. */
export const DEVICES: Device[] = [
  { id: "galaxy-a", name: "Samsung Galaxy A", kind: "phone", hardware: "punch-hole", width: 360, height: 800, share: 10.2, main: true },
  { id: "iphone-11", name: "iPhone 11 / XR", kind: "phone", hardware: "notch", width: 414, height: 896, share: 13.6, main: true },
  { id: "redmi-note", name: "Xiaomi Redmi Note", kind: "phone", hardware: "punch-hole", width: 393, height: 873, share: 8.2 },
  { id: "iphone-12", name: "iPhone 12–14", kind: "phone", hardware: "notch", width: 390, height: 844, share: 5.1 },
  { id: "iphone-17", name: "iPhone 16 Pro / 17", kind: "phone", hardware: "island", width: 402, height: 874 },
  { id: "iphone-pro-max", name: "iPhone 16 / 17 Pro Max", kind: "phone", hardware: "island", width: 440, height: 956 },
  { id: "ipad-classic", name: "iPad 9.7″ / mini", kind: "tablet", hardware: "home-button", width: 768, height: 1024, share: 18.5, main: true },
  { id: "android-tab-686", name: "Android tablet", kind: "tablet", hardware: "tablet", width: 686, height: 1098, share: 10.9 },
  { id: "android-tab-800", name: "Android tablet", kind: "tablet", hardware: "tablet", width: 800, height: 1280, share: 7.1 },
  { id: "ipad-air", name: "iPad Air / iPad 10", kind: "tablet", hardware: "tablet", width: 820, height: 1180 },
  { id: "laptop-hd", name: "Laptop HD", kind: "desktop", hardware: "pc-laptop", width: 1366, height: 768, share: 7.7, main: true },
  { id: "full-hd", name: "Full HD monitor", kind: "desktop", hardware: "monitor", width: 1920, height: 1080, share: 37.3, main: true },
  { id: "laptop-fhd", name: "Laptop 15.6″, 125%", kind: "desktop", hardware: "pc-laptop", width: 1536, height: 864, share: 9.8 },
  { id: "macbook-air", name: "MacBook Air 13″", kind: "desktop", hardware: "mac-laptop", width: 1470, height: 956 },
  { id: "qhd", name: "2K monitor", kind: "desktop", hardware: "monitor", width: 2560, height: 1440, share: 4.8 },
];

export const MAIN_DEVICES = DEVICES.filter((device) => device.main).map((device) => device.id);

/** Common media-query widths, shown on the ruler and offered as one-click widths. */
export const BREAKPOINTS = [320, 360, 375, 414, 768, 1024, 1280, 1440, 1920];

export const MIN_SIDE = 240;
export const MAX_SIDE = 3840;

export const deviceById = (id: string) => DEVICES.find((device) => device.id === id) ?? null;

/** A device turned from how it naturally stands swaps its sides. */
export const turned = (size: Size, rotated: boolean): Size => (rotated ? { w: size.h, h: size.w } : size);

export const clampSide = (value: number) => Math.round(Math.min(MAX_SIDE, Math.max(MIN_SIDE, value)));

const all = (value: number): Insets => ({ top: value, right: value, bottom: value, left: value });

/** A device mockup in its own CSS pixels: the case around the screen, the system bars on it, the page between them. */
export type Mockup = {
  screen: Size;
  /** The case from the screen edge outwards. */
  bezel: Insets;
  /** Status bar, home indicator, browser and OS bars: the screen the page doesn't get. */
  bars: Insets;
  /** The page's own viewport. */
  viewport: Size;
  /** Laptop deck or monitor stand under the case. */
  foot: number;
  /** How far a laptop deck sticks out on each side. */
  overhang: number;
  /** The whole mockup. */
  outer: Size;
  radius: number;
};

export function mockup(hardware: Hardware, screen: Size): Mockup {
  const landscape = screen.w > screen.h;
  let bezel = all(0);
  let bars = all(0);
  let foot = 0;
  let overhang = 0;
  let radius = 0;
  switch (hardware) {
    case "island":
    case "notch": {
      // Safari keeps the page out of the status bar and the home indicator; sideways, out of the camera's safe area.
      const status = hardware === "island" ? 54 : 47;
      bezel = all(14);
      bars = landscape ? { top: 0, right: status, bottom: 21, left: status } : { top: status, right: 0, bottom: 34, left: 0 };
      radius = 56;
      break;
    }
    case "punch-hole":
      bezel = all(10);
      bars = landscape ? { top: 24, right: 0, bottom: 0, left: 32 } : { top: 32, right: 0, bottom: 16, left: 0 };
      radius = 40;
      break;
    case "home-button":
      bezel = landscape ? { top: 24, right: 72, bottom: 24, left: 72 } : { top: 72, right: 24, bottom: 72, left: 24 };
      bars = { top: 20, right: 0, bottom: 0, left: 0 };
      radius = 44;
      break;
    case "tablet":
      bezel = all(20);
      bars = { top: 24, right: 0, bottom: 20, left: 0 };
      radius = 36;
      break;
    case "mac-laptop":
      // macOS menu bar, then the browser's tabs and address bar.
      bezel = { top: 18, right: 14, bottom: 22, left: 14 };
      bars = { top: 33 + 80, right: 0, bottom: 0, left: 0 };
      foot = 20;
      overhang = Math.round(screen.w * 0.06);
      radius = 14;
      break;
    case "pc-laptop":
      // Browser tabs and address bar above, the Windows taskbar below.
      bezel = { top: 16, right: 14, bottom: 26, left: 14 };
      bars = { top: 80, right: 0, bottom: 48, left: 0 };
      foot = 20;
      overhang = Math.round(screen.w * 0.06);
      radius = 12;
      break;
    case "monitor":
      bezel = { top: 14, right: 14, bottom: 30, left: 14 };
      bars = { top: 80, right: 0, bottom: 48, left: 0 };
      foot = Math.round(screen.h * 0.16);
      radius = 10;
      break;
    case "none":
      break;
  }
  return {
    screen,
    bezel,
    bars,
    viewport: { w: screen.w - bars.left - bars.right, h: screen.h - bars.top - bars.bottom },
    foot,
    overhang,
    outer: { w: screen.w + bezel.left + bezel.right + 2 * overhang, h: screen.h + bezel.top + bezel.bottom + foot },
    radius,
  };
}

/**
 * Frames in rows of `columns`, the number of columns picked for the largest scale (at most 1) at which they fit
 * `area`. `extra` is unscaled room each frame takes beside its page and each row above it (caption); a column is
 * never narrower than `minWidth`.
 */
export function fitGrid(frames: Size[], area: Size, gap: number, extra: Size, minWidth = 0): { scale: number; columns: number } {
  let best = { scale: 0, columns: 1 };
  for (let columns = 1; columns <= frames.length; columns++) {
    const rows: Size[][] = [];
    for (let at = 0; at < frames.length; at += columns) rows.push(frames.slice(at, at + columns));
    const height = area.h - (gap + extra.h) * rows.length + gap;
    let scale = Math.min(1, height / rows.reduce((sum, row) => sum + Math.max(...row.map((frame) => frame.h)), 0));
    for (const row of rows) {
      const room = area.w - (gap + extra.w) * row.length + gap;
      // Columns held at `minWidth` don't shrink with the scale: share the rest of the room among the others.
      for (let pass = 0; pass < 4; pass++) {
        const fixed = row.filter((frame) => frame.w * scale < minWidth);
        const free = row.reduce((sum, frame) => sum + (frame.w * scale < minWidth ? 0 : frame.w), 0);
        if (!free) break;
        scale = Math.min(scale, (room - fixed.length * minWidth) / free);
      }
    }
    if (scale > best.scale + 1e-9) best = { scale, columns };
  }
  return { scale: Math.max(0.05, best.scale), columns: best.columns };
}
