// Shared server-side web errors: English by default, matching Russian keys.
const en = {
  invalid: "Not a web address: {detail}",
  protocol: "Only http and https pages open here: {detail}",
  port: "Port {detail} doesn't open here",
  host: "Host not found: {detail}",
  internal: "Internal addresses don't open here: {detail}",
  size: "Larger than {detail}",
  timeout: "Timed out: {detail}",
  redirects: "Too many redirects: {detail}",
  http: "HTTP {detail}",
  connection: "Couldn't load the page: {detail}",
};
export type WebErrorKey = keyof typeof en;
const ru: Record<WebErrorKey, string> = {
  invalid: "Некорректный веб-адрес: {detail}",
  protocol: "Поддерживаются только страницы http и https: {detail}",
  port: "Порт {detail} недоступен для загрузки",
  host: "Хост не найден: {detail}",
  internal: "Загрузка внутренних адресов запрещена: {detail}",
  size: "Размер превышает {detail}",
  timeout: "Время ожидания истекло: {detail}",
  redirects: "Слишком много перенаправлений: {detail}",
  http: "Ошибка HTTP {detail}",
  connection: "Не удалось загрузить страницу: {detail}",
};
export function webErrorMessage(key: WebErrorKey, detail: string, locale: "en" | "ru" = "en"): string {
  return (locale === "ru" ? ru : en)[key].replace("{detail}", detail);
}
