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
  copied: "Copied",
  openLink: "Open link",
  linkHint: "{mod}+click to open the link",
  hidden: "hidden",
  emptySheet: "This sheet is empty.",
  size: "{rows} rows × {cols} columns",
  sheets: "Sheets",
  quote: "Quote in chat",
  comment: "Comment in chat…",
  copyCells: "Copy",
  copyReference: "Copy reference",
  edit: "Edit",
  clear: "Clear",
  quoted: "Added to chat",
  commentTitle: "Comment in chat",
  commentPlaceholder: "What's wrong or what should change?",
  addToChat: "Add to chat",
  cancel: "Cancel",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  unsaved: "Unsaved: {n}",
  undo: "Undo",
  discard: "Discard changes",
  conflict: "The file changed on disk since you opened it.",
  reloadTheirs: "Reload and discard my edits",
  overwrite: "Apply my edits to the new version",
  saveFailed: "Couldn't save",
  readOnlyBadge: "read-only",
  readOnly: "Read-only format: editing works for .xlsx, .xlsm, .csv and .tsv.",
  staleHint: "Excel recalculates this formula when it opens the file",
  more: "Not included: {rows} more rows, {cols} more columns.",
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
  copied: "Скопировано",
  openLink: "Открыть ссылку",
  linkHint: "{mod}+клик — открыть ссылку",
  hidden: "скрыт",
  emptySheet: "Лист пустой.",
  size: "Строк: {rows}, столбцов: {cols}",
  sheets: "Листы",
  quote: "Цитата в чат",
  comment: "Комментарий в чат…",
  copyCells: "Копировать",
  copyReference: "Копировать ссылку на ячейки",
  edit: "Изменить",
  clear: "Очистить",
  quoted: "Добавлено в чат",
  commentTitle: "Комментарий в чат",
  commentPlaceholder: "Что не так или что нужно поправить?",
  addToChat: "Добавить в чат",
  cancel: "Отмена",
  save: "Сохранить",
  saving: "Сохранение…",
  saved: "Сохранено",
  unsaved: "Не сохранено: {n}",
  undo: "Отменить",
  discard: "Отменить все правки",
  conflict: "Файл изменился на диске, пока был открыт.",
  reloadTheirs: "Перечитать, мои правки отбросить",
  overwrite: "Применить мои правки к новой версии",
  saveFailed: "Не удалось сохранить",
  readOnlyBadge: "только просмотр",
  readOnly: "Формат только для просмотра: править можно .xlsx, .xlsm, .csv и .tsv.",
  staleHint: "Excel пересчитает эту формулу при открытии файла",
  more: "Не вошло: ещё строк — {rows}, столбцов — {cols}.",
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
