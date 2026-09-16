// UI strings follow BB's interface language (`<html lang>`); English by default.

const en = {
  loading: "Loading…",
  openFailed: "Couldn't open the file",
  parseFailed: "Couldn't read the spreadsheet",
  retry: "Retry",
  refresh: "Reload from disk",
  download: "Download",
  search: "Search in sheet",
  noMatches: "No matches",
  matchOf: "{i} of {n}",
  previousMatch: "Previous match",
  nextMatch: "Next match",
  freezeOn: "Unfreeze first row",
  freezeOff: "Freeze first row",
  copy: "Copy value",
  copied: "Copied",
  openLink: "Open link",
  linkHint: "{mod}+click to open the link",
  hidden: "hidden",
  emptySheet: "This sheet is empty.",
  size: "{rows} rows × {cols} columns",
  sheets: "Sheets",
};

export type I18nKey = keyof typeof en;

const ru: Record<I18nKey, string> = {
  loading: "Загрузка…",
  openFailed: "Не удалось открыть файл",
  parseFailed: "Не удалось прочитать таблицу",
  retry: "Повторить",
  refresh: "Перечитать с диска",
  download: "Скачать",
  search: "Поиск по листу",
  noMatches: "Нет совпадений",
  matchOf: "{i} из {n}",
  previousMatch: "Предыдущее совпадение",
  nextMatch: "Следующее совпадение",
  freezeOn: "Открепить первую строку",
  freezeOff: "Закрепить первую строку",
  copy: "Скопировать значение",
  copied: "Скопировано",
  openLink: "Открыть ссылку",
  linkHint: "{mod}+клик — открыть ссылку",
  hidden: "скрыт",
  emptySheet: "Лист пустой.",
  size: "Строк: {rows}, столбцов: {cols}",
  sheets: "Листы",
};

export type Locale = "en" | "ru";

export function detectLocale(): Locale {
  const lang = globalThis.document?.documentElement?.lang ?? "";
  return lang.toLowerCase().startsWith("ru") ? "ru" : "en";
}

const MOD = /Mac|iPhone|iPad/i.test(globalThis.navigator?.platform ?? globalThis.navigator?.userAgent ?? "") ? "⌘" : "Ctrl";

export function t(key: I18nKey, vars: Record<string, string | number> = {}, locale: Locale = detectLocale()): string {
  return (locale === "ru" ? ru : en)[key].replace("{mod}", MOD).replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}
