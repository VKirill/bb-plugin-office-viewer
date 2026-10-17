// Ready-made form and UI block templates (grouped wireframe elements).
import type { I18nKey } from "../../shared/i18n.ts";
import { newGroupId } from "./canvas-math.ts";
import { defaultElement, snap, type ElementType, type PropValue, type WireframeElement } from "./model.ts";

export const TEMPLATE_DRAG_PREFIX = "proto-template:";

export type TemplateCategory = "forms" | "interface";

export type TemplatePart = {
  type: ElementType;
  x: number;
  y: number;
  w?: number;
  h?: number;
  props?: Record<string, PropValue>;
};

export type PrototypeTemplate = {
  id: string;
  category: TemplateCategory;
  labelKey: I18nKey;
  keywords: string[];
  w: number;
  h: number;
  parts: readonly TemplatePart[];
};

function part(type: ElementType, x: number, y: number, w?: number, h?: number, props?: Record<string, PropValue>): TemplatePart {
  return { type, x, y, w, h, props };
}

export const FORM_TEMPLATES: readonly PrototypeTemplate[] = [
  {
    id: "tpl-login",
    category: "forms",
    labelKey: "protoTplLogin",
    keywords: ["вход", "логин", "login", "авторизация"],
    w: 288,
    h: 272,
    parts: [
      part("Heading", 0, 0, 288, 40, { text: "Вход", level: 2 }),
      part("TextField", 0, 56, 288, 40, { placeholder: "Электронная почта", value: "" }),
      part("TextField", 0, 104, 288, 40, { placeholder: "Пароль", value: "" }),
      part("Button", 0, 168, 288, 40, { text: "Войти", variant: "default" }),
      part("Button", 0, 224, 288, 32, { text: "Забыли пароль?", variant: "link" }),
    ],
  },
  {
    id: "tpl-register",
    category: "forms",
    labelKey: "protoTplRegister",
    keywords: ["регистрация", "signup", "аккаунт"],
    w: 288,
    h: 360,
    parts: [
      part("Heading", 0, 0, 288, 40, { text: "Регистрация", level: 2 }),
      part("TextField", 0, 56, 288, 40, { placeholder: "Имя", value: "" }),
      part("TextField", 0, 104, 288, 40, { placeholder: "Электронная почта", value: "" }),
      part("TextField", 0, 152, 288, 40, { placeholder: "Пароль", value: "" }),
      part("Checkbox", 0, 208, 288, 32, { text: "Согласен с условиями", checked: false }),
      part("Button", 0, 256, 288, 40, { text: "Создать аккаунт", variant: "default" }),
    ],
  },
  {
    id: "tpl-checkout",
    category: "forms",
    labelKey: "protoTplCheckout",
    keywords: ["заказ", "оформление", "checkout", "корзина"],
    w: 320,
    h: 400,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Оформление заказа", level: 2 }),
      part("Text", 0, 48, 320, 24, { text: "Контактные данные" }),
      part("TextField", 0, 80, 320, 40, { placeholder: "Телефон", value: "" }),
      part("TextField", 0, 128, 320, 40, { placeholder: "Адрес доставки", value: "" }),
      part("ChoicePicker", 0, 176, 320, 40, { options: ["Стандартная", "Экспресс"], value: "Стандартная" }),
      part("Divider", 0, 232, 320, 8, {}),
      part("Text", 0, 248, 160, 24, { text: "Итого: 4 990 ₽" }),
      part("Button", 160, 288, 160, 40, { text: "Оплатить", variant: "default" }),
    ],
  },
  {
    id: "tpl-contact",
    category: "forms",
    labelKey: "protoTplContact",
    keywords: ["контакт", "обратная связь", "contact"],
    w: 320,
    h: 360,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Связаться с нами", level: 2 }),
      part("TextField", 0, 56, 320, 40, { placeholder: "Ваше имя", value: "" }),
      part("TextField", 0, 104, 320, 40, { placeholder: "Электронная почта", value: "" }),
      part("TextArea", 0, 152, 320, 96, { placeholder: "Сообщение", value: "" }),
      part("Button", 0, 264, 320, 40, { text: "Отправить", variant: "default" }),
    ],
  },
  {
    id: "tpl-password",
    category: "forms",
    labelKey: "protoTplPassword",
    keywords: ["пароль", "сброс", "reset"],
    w: 288,
    h: 280,
    parts: [
      part("Heading", 0, 0, 288, 40, { text: "Сброс пароля", level: 2 }),
      part("Paragraph", 0, 48, 288, 48, { text: "Введите почту — пришлём ссылку для сброса." }),
      part("TextField", 0, 112, 288, 40, { placeholder: "Электронная почта", value: "" }),
      part("Button", 0, 168, 288, 40, { text: "Отправить ссылку", variant: "default" }),
    ],
  },
  {
    id: "tpl-newsletter",
    category: "forms",
    labelKey: "protoTplNewsletter",
    keywords: ["рассылка", "подписка", "newsletter"],
    w: 320,
    h: 200,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Подписка на новости", level: 3 }),
      part("TextField", 0, 56, 200, 40, { placeholder: "Электронная почта", value: "" }),
      part("Button", 216, 56, 104, 40, { text: "Подписаться", variant: "default" }),
      part("Checkbox", 0, 112, 320, 32, { text: "Согласен на обработку данных", checked: false }),
    ],
  },
  {
    id: "tpl-feedback",
    category: "forms",
    labelKey: "protoTplFeedback",
    keywords: ["отзыв", "feedback", "оценка"],
    w: 320,
    h: 320,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Оставить отзыв", level: 2 }),
      part("Text", 0, 48, 320, 24, { text: "Оценка" }),
      part("Slider", 0, 80, 280, 32, { value: 80, min: 0, max: 100 }),
      part("TextArea", 0, 128, 320, 96, { placeholder: "Ваш комментарий", value: "" }),
      part("Button", 0, 240, 320, 40, { text: "Отправить отзыв", variant: "default" }),
    ],
  },
  {
    id: "tpl-survey",
    category: "forms",
    labelKey: "protoTplSurvey",
    keywords: ["опрос", "survey", "анкета"],
    w: 320,
    h: 360,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Короткий опрос", level: 2 }),
      part("Text", 0, 48, 320, 24, { text: "Как часто вы пользуетесь сервисом?" }),
      part("Radio", 0, 80, 320, 32, { text: "Ежедневно", checked: true }),
      part("Radio", 0, 112, 320, 32, { text: "Раз в неделю", checked: false }),
      part("Radio", 0, 144, 320, 32, { text: "Реже", checked: false }),
      part("Text", 0, 192, 320, 24, { text: "Что улучшить?" }),
      part("TextArea", 0, 224, 320, 72, { placeholder: "Ваш ответ", value: "" }),
      part("Button", 0, 312, 320, 40, { text: "Отправить", variant: "default" }),
    ],
  },
  {
    id: "tpl-payment",
    category: "forms",
    labelKey: "protoTplPayment",
    keywords: ["оплата", "карта", "payment"],
    w: 320,
    h: 320,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Оплата картой", level: 2 }),
      part("TextField", 0, 56, 320, 40, { placeholder: "Номер карты", value: "" }),
      part("TextField", 0, 104, 152, 40, { placeholder: "ММ/ГГ", value: "" }),
      part("TextField", 168, 104, 152, 40, { placeholder: "CVC", value: "" }),
      part("TextField", 0, 152, 320, 40, { placeholder: "Имя на карте", value: "" }),
      part("Button", 0, 216, 320, 40, { text: "Оплатить 2 490 ₽", variant: "default" }),
    ],
  },
  {
    id: "tpl-address",
    category: "forms",
    labelKey: "protoTplAddress",
    keywords: ["адрес", "доставка", "address"],
    w: 320,
    h: 360,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Адрес доставки", level: 2 }),
      part("TextField", 0, 56, 320, 40, { placeholder: "Город", value: "" }),
      part("TextField", 0, 104, 320, 40, { placeholder: "Улица, дом", value: "" }),
      part("TextField", 0, 152, 152, 40, { placeholder: "Квартира", value: "" }),
      part("TextField", 168, 152, 152, 40, { placeholder: "Индекс", value: "" }),
      part("TextField", 0, 200, 320, 40, { placeholder: "Комментарий курьеру", value: "" }),
      part("Button", 0, 256, 320, 40, { text: "Сохранить адрес", variant: "default" }),
    ],
  },
  {
    id: "tpl-otp",
    category: "forms",
    labelKey: "protoTplOtp",
    keywords: ["код", "otp", "подтверждение", "sms"],
    w: 288,
    h: 240,
    parts: [
      part("Heading", 0, 0, 288, 40, { text: "Подтверждение", level: 2 }),
      part("Paragraph", 0, 48, 288, 40, { text: "Введите код из SMS" }),
      part("TextField", 0, 104, 288, 40, { placeholder: "000000", value: "" }),
      part("Button", 0, 160, 288, 40, { text: "Подтвердить", variant: "default" }),
      part("Button", 0, 208, 288, 32, { text: "Отправить код снова", variant: "link" }),
    ],
  },
  {
    id: "tpl-profile",
    category: "forms",
    labelKey: "protoTplProfile",
    keywords: ["профиль", "настройки", "profile"],
    w: 320,
    h: 360,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Профиль", level: 2 }),
      part("Avatar", 0, 56, 48, 48, { initials: "ИП" }),
      part("TextField", 64, 56, 256, 40, { placeholder: "Отображаемое имя", value: "Иван Петров" }),
      part("TextField", 0, 120, 320, 40, { placeholder: "Электронная почта", value: "" }),
      part("TextField", 0, 168, 320, 40, { placeholder: "Телефон", value: "" }),
      part("Switch", 0, 224, 320, 32, { text: "Уведомления по почте", checked: true }),
      part("Button", 0, 272, 320, 40, { text: "Сохранить", variant: "default" }),
    ],
  },
  {
    id: "tpl-booking",
    category: "forms",
    labelKey: "protoTplBooking",
    keywords: ["бронирование", "запись", "booking"],
    w: 320,
    h: 360,
    parts: [
      part("Heading", 0, 0, 320, 40, { text: "Запись на услугу", level: 2 }),
      part("DatePicker", 0, 56, 320, 40, { placeholder: "Дата" }),
      part("ChoicePicker", 0, 104, 320, 40, { options: ["10:00", "12:00", "15:00"], value: "10:00" }),
      part("TextField", 0, 152, 320, 40, { placeholder: "Ваше имя", value: "" }),
      part("TextField", 0, 200, 320, 40, { placeholder: "Телефон", value: "" }),
      part("Button", 0, 256, 320, 40, { text: "Забронировать", variant: "default" }),
    ],
  },
];

export const INTERFACE_TEMPLATES: readonly PrototypeTemplate[] = [
  {
    id: "tpl-header",
    category: "interface",
    labelKey: "protoTplHeader",
    keywords: ["шапка", "header", "навигация"],
    w: 640,
    h: 56,
    parts: [
      part("Header", 0, 0, 640, 56, { text: "Логотип" }),
      part("Nav", 200, 8, 320, 40, { items: ["Главная", "Каталог", "Контакты"] }),
      part("Button", 520, 8, 112, 40, { text: "Войти", variant: "outline" }),
    ],
  },
  {
    id: "tpl-pricing",
    category: "interface",
    labelKey: "protoTplPricing",
    keywords: ["тариф", "цена", "pricing"],
    w: 480,
    h: 280,
    parts: [
      part("Heading", 0, 0, 480, 40, { text: "Тарифы", level: 2 }),
      part("Card", 0, 56, 144, 200, { title: "Базовый", text: "990 ₽/мес" }),
      part("Card", 168, 56, 144, 200, { title: "Про", text: "1 990 ₽/мес" }),
      part("Card", 336, 56, 144, 200, { title: "Команда", text: "4 990 ₽/мес" }),
      part("Button", 168, 232, 144, 40, { text: "Выбрать", variant: "default" }),
    ],
  },
  {
    id: "tpl-table-filters",
    category: "interface",
    labelKey: "protoTplTableFilters",
    keywords: ["таблица", "фильтр", "table"],
    w: 480,
    h: 296,
    parts: [
      part("SearchField", 0, 0, 200, 40, { placeholder: "Поиск", value: "" }),
      part("ChoicePicker", 216, 0, 160, 40, { options: ["Все статусы", "Активные"], value: "Все статусы" }),
      part("Button", 392, 0, 88, 40, { text: "Фильтр", variant: "outline" }),
      part("Table", 0, 56, 480, 184, { columns: 4, rows: 4 }),
      part("Pagination", 120, 248, 240, 32, { pages: 5, current: 1 }),
    ],
  },
  {
    id: "tpl-hero",
    category: "interface",
    labelKey: "protoTplHero",
    keywords: ["hero", "баннер", "первый экран"],
    w: 640,
    h: 240,
    parts: [
      part("Box", 0, 0, 640, 240, { fill: "light", border: true, radius: 8, text: "" }),
      part("Heading", 32, 48, 360, 48, { text: "Заголовок продукта", level: 1 }),
      part("Paragraph", 32, 104, 400, 64, { text: "Краткое описание ценности и призыв к действию." }),
      part("Button", 32, 176, 160, 40, { text: "Начать", variant: "default" }),
      part("Button", 200, 176, 160, 40, { text: "Подробнее", variant: "outline" }),
    ],
  },
  {
    id: "tpl-footer",
    category: "interface",
    labelKey: "protoTplFooter",
    keywords: ["подвал", "footer"],
    w: 640,
    h: 120,
    parts: [
      part("Divider", 0, 0, 640, 8, {}),
      part("Text", 16, 24, 200, 24, { text: "© Компания" }),
      part("Breadcrumbs", 16, 56, 400, 32, { items: ["О нас", "Политика", "Поддержка"] }),
      part("Nav", 400, 48, 224, 40, { items: ["VK", "Telegram"] }),
    ],
  },
  {
    id: "tpl-sidebar",
    category: "interface",
    labelKey: "protoTplSidebar",
    keywords: ["sidebar", "меню", "боковая"],
    w: 240,
    h: 320,
    parts: [
      part("Box", 0, 0, 240, 320, { fill: "light", border: true, radius: 0, text: "" }),
      part("Heading", 16, 16, 208, 32, { text: "Разделы", level: 3 }),
      part("Menu", 8, 56, 224, 200, { orientation: "vertical", items: ["Дашборд", "Заказы", "Клиенты", "Настройки"] }),
    ],
  },
  {
    id: "tpl-stats",
    category: "interface",
    labelKey: "protoTplStats",
    keywords: ["метрики", "статистика", "dashboard"],
    w: 480,
    h: 120,
    parts: [
      part("Card", 0, 0, 144, 96, { title: "Выручка", text: "1,2 млн ₽" }),
      part("Card", 168, 0, 144, 96, { title: "Заказы", text: "348" }),
      part("Card", 336, 0, 144, 96, { title: "Конверсия", text: "4,2%" }),
    ],
  },
  {
    id: "tpl-product",
    category: "interface",
    labelKey: "protoTplProduct",
    keywords: ["товар", "карточка", "product"],
    w: 320,
    h: 360,
    parts: [
      part("Image", 0, 0, 320, 160, { alt: "Товар" }),
      part("Heading", 0, 176, 320, 32, { text: "Название товара", level: 3 }),
      part("Text", 0, 216, 160, 24, { text: "2 490 ₽" }),
      part("Badge", 176, 216, 80, 24, { text: "Новинка" }),
      part("Button", 0, 256, 320, 40, { text: "В корзину", variant: "default" }),
    ],
  },
  {
    id: "tpl-faq",
    category: "interface",
    labelKey: "protoTplFaq",
    keywords: ["faq", "вопросы"],
    w: 400,
    h: 280,
    parts: [
      part("Heading", 0, 0, 400, 40, { text: "Частые вопросы", level: 2 }),
      part("List", 0, 56, 400, 200, { items: ["Как оформить заказ?", "Способы оплаты", "Доставка и возврат"] }),
    ],
  },
  {
    id: "tpl-search-results",
    category: "interface",
    labelKey: "protoTplSearchResults",
    keywords: ["поиск", "результаты"],
    w: 400,
    h: 320,
    parts: [
      part("SearchField", 0, 0, 400, 40, { placeholder: "Поиск по каталогу", value: "куртка" }),
      part("Text", 0, 48, 400, 24, { text: "Найдено: 12" }),
      part("List", 0, 80, 400, 200, { items: ["Куртка зимняя", "Куртка демисезон", "Куртка утеплённая"] }),
      part("Pagination", 80, 288, 240, 32, { pages: 3, current: 1 }),
    ],
  },
  {
    id: "tpl-empty",
    category: "interface",
    labelKey: "protoTplEmpty",
    keywords: ["пусто", "empty"],
    w: 320,
    h: 240,
    parts: [
      part("Placeholder", 96, 16, 128, 96, { text: "Пусто" }),
      part("Heading", 0, 128, 320, 32, { text: "Пока ничего нет", level: 3 }),
      part("Paragraph", 16, 168, 288, 48, { text: "Добавьте первый элемент или измените фильтры." }),
      part("Button", 80, 200, 160, 40, { text: "Создать", variant: "default" }),
    ],
  },
  {
    id: "tpl-confirm",
    category: "interface",
    labelKey: "protoTplConfirm",
    keywords: ["подтверждение", "modal", "диалог"],
    w: 360,
    h: 200,
    parts: [
      part("Modal", 0, 0, 360, 200, { title: "Удалить запись?", text: "Действие нельзя отменить." }),
      part("Button", 16, 144, 152, 40, { text: "Отмена", variant: "outline" }),
      part("Button", 192, 144, 152, 40, { text: "Удалить", variant: "destructive" }),
    ],
  },
  {
    id: "tpl-user-menu",
    category: "interface",
    labelKey: "protoTplUserMenu",
    keywords: ["пользователь", "меню", "аккаунт"],
    w: 240,
    h: 200,
    parts: [
      part("Card", 0, 0, 240, 200, { title: "Иван Петров", text: "ivan@example.com" }),
      part("Menu", 8, 88, 224, 96, { orientation: "vertical", items: ["Профиль", "Выйти"] }),
    ],
  },
  {
    id: "tpl-notifications",
    category: "interface",
    labelKey: "protoTplNotifications",
    keywords: ["уведомления", "notifications"],
    w: 320,
    h: 280,
    parts: [
      part("Heading", 0, 0, 320, 32, { text: "Уведомления", level: 3 }),
      part("Alert", 0, 40, 320, 72, { variant: "info", title: "Новый заказ", text: "Заказ #1042 ожидает обработки" }),
      part("Alert", 0, 120, 320, 72, { variant: "info", title: "Сообщение", text: "Ответ службы поддержки" }),
      part("Button", 0, 208, 320, 40, { text: "Показать все", variant: "link" }),
    ],
  },
  {
    id: "tpl-breadcrumbs",
    category: "interface",
    labelKey: "protoTplBreadcrumbs",
    keywords: ["крошки", "breadcrumbs", "навигация"],
    w: 480,
    h: 80,
    parts: [
      part("Breadcrumbs", 0, 0, 480, 32, { items: ["Главная", "Каталог", "Куртки"] }),
      part("Heading", 0, 40, 480, 40, { text: "Зимние куртки", level: 2 }),
    ],
  },
];

export const TEMPLATE_LIST: readonly PrototypeTemplate[] = [...FORM_TEMPLATES, ...INTERFACE_TEMPLATES];

export const TEMPLATE_BY_ID: Record<string, PrototypeTemplate> = Object.fromEntries(TEMPLATE_LIST.map((item) => [item.id, item]));

export function filterTemplates(
  templates: readonly PrototypeTemplate[],
  query: string,
  label: (template: PrototypeTemplate) => string,
): PrototypeTemplate[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...templates];
  return templates.filter(
    (template) =>
      label(template).toLowerCase().includes(q) ||
      template.id.toLowerCase().includes(q) ||
      template.keywords.some((word) => word.toLowerCase().includes(q)),
  );
}

export function elementsFromTemplate(
  template: PrototypeTemplate,
  originX: number,
  originY: number,
  existing: readonly WireframeElement[],
): WireframeElement[] {
  const groupId = newGroupId();
  const placed: WireframeElement[] = [];
  let pool = [...existing];
  for (const spec of template.parts) {
    let el = defaultElement(spec.type, originX + spec.x, originY + spec.y, pool);
    if (spec.w !== undefined) el = { ...el, w: spec.w };
    if (spec.h !== undefined) el = { ...el, h: spec.h };
    if (spec.props) el = { ...el, props: { ...el.props, ...structuredClone(spec.props) } };
    if (spec.type === "Line" && el.props.orientation === "vertical") el = { ...el, w: 8, h: spec.h ?? 160 };
    if (spec.type === "Arrow" && el.props.orientation === "vertical") el = { ...el, w: 24, h: spec.h ?? 120 };
    if (spec.type === "Menu" && el.props.orientation === "vertical") el = { ...el, w: spec.w ?? 140, h: spec.h ?? 160 };
    el = { ...el, groupId };
    placed.push(el);
    pool = [...pool, el];
  }
  return placed;
}

export function previewElementsForTemplate(templateId: string): WireframeElement[] {
  const template = TEMPLATE_BY_ID[templateId];
  if (!template) return [];
  return elementsFromTemplate(template, 0, 0, []);
}

export function templatePreviewBounds(elements: readonly WireframeElement[]): { w: number; h: number } {
  if (!elements.length) return { w: 40, h: 40 };
  let right = 0;
  let bottom = 0;
  for (const el of elements) {
    right = Math.max(right, el.x + el.w);
    bottom = Math.max(bottom, el.y + el.h);
  }
  return { w: Math.max(1, right), h: Math.max(1, bottom) };
}

export function insertTemplateElements(
  templateId: string,
  centerX: number,
  centerY: number,
  existing: readonly WireframeElement[],
): WireframeElement[] | null {
  const template = TEMPLATE_BY_ID[templateId];
  if (!template) return null;
  const ox = snap(centerX - template.w / 2);
  const oy = snap(centerY - template.h / 2);
  return elementsFromTemplate(template, ox, oy, existing);
}
