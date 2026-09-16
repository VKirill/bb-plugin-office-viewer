// Function catalog for formula autocomplete: English name as stored in files,
// the Russian Excel name users may type, argument signature and a short hint.

export type FunctionInfo = { name: string; ru: string; args: string; en: string; hint: string };

const f = (name: string, ru: string, args: string, en: string, hint: string): FunctionInfo => ({ name, ru, args, en, hint });

export const FUNCTIONS: FunctionInfo[] = [
  f("SUM", "СУММ", "number1, [number2], …", "Adds numbers", "Сумма чисел"),
  f("AVERAGE", "СРЗНАЧ", "number1, [number2], …", "Average of numbers", "Среднее значение"),
  f("COUNT", "СЧЁТ", "value1, [value2], …", "Counts cells with numbers", "Количество чисел"),
  f("COUNTA", "СЧЁТЗ", "value1, [value2], …", "Counts non-empty cells", "Количество непустых ячеек"),
  f("COUNTBLANK", "СЧИТАТЬПУСТОТЫ", "range", "Counts empty cells", "Количество пустых ячеек"),
  f("MIN", "МИН", "number1, [number2], …", "Smallest number", "Наименьшее значение"),
  f("MAX", "МАКС", "number1, [number2], …", "Largest number", "Наибольшее значение"),
  f("MEDIAN", "МЕДИАНА", "number1, [number2], …", "Median", "Медиана"),
  f("ROUND", "ОКРУГЛ", "number, num_digits", "Rounds to digits", "Округление до знаков"),
  f("ROUNDUP", "ОКРУГЛВВЕРХ", "number, num_digits", "Rounds up", "Округление вверх"),
  f("ROUNDDOWN", "ОКРУГЛВНИЗ", "number, num_digits", "Rounds down", "Округление вниз"),
  f("ABS", "ABS", "number", "Absolute value", "Модуль числа"),
  f("INT", "ЦЕЛОЕ", "number", "Rounds down to an integer", "Целая часть"),
  f("MOD", "ОСТАТ", "number, divisor", "Remainder", "Остаток от деления"),
  f("POWER", "СТЕПЕНЬ", "number, power", "Raises to a power", "Возведение в степень"),
  f("SQRT", "КОРЕНЬ", "number", "Square root", "Квадратный корень"),
  f("PRODUCT", "ПРОИЗВЕД", "number1, [number2], …", "Multiplies numbers", "Произведение"),
  f("SUMPRODUCT", "СУММПРОИЗВ", "array1, [array2], …", "Sum of products", "Сумма произведений"),
  f("IF", "ЕСЛИ", "logical_test, value_if_true, [value_if_false]", "Checks a condition", "Условие: если … то … иначе"),
  f("IFS", "ЕСЛИМН", "test1, value1, [test2, value2], …", "Several conditions", "Несколько условий"),
  f("IFERROR", "ЕСЛИОШИБКА", "value, value_if_error", "Value if error", "Значение при ошибке"),
  f("IFNA", "ЕСНД", "value, value_if_na", "Value if #N/A", "Значение при #Н/Д"),
  f("AND", "И", "logical1, [logical2], …", "All conditions true", "Все условия истинны"),
  f("OR", "ИЛИ", "logical1, [logical2], …", "Any condition true", "Хотя бы одно условие истинно"),
  f("NOT", "НЕ", "logical", "Negates", "Логическое отрицание"),
  f("SWITCH", "ПЕРЕКЛЮЧ", "expression, value1, result1, …, [default]", "Chooses by value", "Выбор по значению"),
  f("SUMIF", "СУММЕСЛИ", "range, criteria, [sum_range]", "Sum by one condition", "Сумма по условию"),
  f("SUMIFS", "СУММЕСЛИМН", "sum_range, criteria_range1, criteria1, …", "Sum by conditions", "Сумма по нескольким условиям"),
  f("COUNTIF", "СЧЁТЕСЛИ", "range, criteria", "Count by one condition", "Количество по условию"),
  f("COUNTIFS", "СЧЁТЕСЛИМН", "criteria_range1, criteria1, …", "Count by conditions", "Количество по нескольким условиям"),
  f("AVERAGEIF", "СРЗНАЧЕСЛИ", "range, criteria, [average_range]", "Average by condition", "Среднее по условию"),
  f("AVERAGEIFS", "СРЗНАЧЕСЛИМН", "average_range, criteria_range1, criteria1, …", "Average by conditions", "Среднее по нескольким условиям"),
  f("MAXIFS", "МАКСЕСЛИ", "max_range, criteria_range1, criteria1, …", "Max by conditions", "Максимум по условиям"),
  f("MINIFS", "МИНЕСЛИ", "min_range, criteria_range1, criteria1, …", "Min by conditions", "Минимум по условиям"),
  f("VLOOKUP", "ВПР", "lookup_value, table_array, col_index, [range_lookup]", "Looks up in the first column", "Поиск по первому столбцу"),
  f("HLOOKUP", "ГПР", "lookup_value, table_array, row_index, [range_lookup]", "Looks up in the first row", "Поиск по первой строке"),
  f("XLOOKUP", "ПРОСМОТРX", "lookup_value, lookup_array, return_array, [if_not_found]", "Looks up and returns a match", "Поиск и возврат значения"),
  f("INDEX", "ИНДЕКС", "array, row_num, [column_num]", "Value at a position", "Значение по номеру строки и столбца"),
  f("MATCH", "ПОИСКПОЗ", "lookup_value, lookup_array, [match_type]", "Position of a value", "Позиция значения"),
  f("XMATCH", "ПОИСКПОЗX", "lookup_value, lookup_array, [match_mode]", "Position of a value", "Позиция значения"),
  f("CHOOSE", "ВЫБОР", "index, value1, [value2], …", "Picks by index", "Выбор по номеру"),
  f("UNIQUE", "УНИК", "array", "Unique values", "Уникальные значения"),
  f("FILTER", "ФИЛЬТР", "array, include, [if_empty]", "Filters a range", "Фильтрация диапазона"),
  f("SORT", "СОРТ", "array, [sort_index], [sort_order]", "Sorts a range", "Сортировка диапазона"),
  f("CONCAT", "СЦЕП", "text1, [text2], …", "Joins text", "Объединение текста"),
  f("TEXTJOIN", "ОБЪЕДИНИТЬ", "delimiter, ignore_empty, text1, …", "Joins with a delimiter", "Объединение через разделитель"),
  f("LEFT", "ЛЕВСИМВ", "text, [num_chars]", "Characters from the left", "Символы слева"),
  f("RIGHT", "ПРАВСИМВ", "text, [num_chars]", "Characters from the right", "Символы справа"),
  f("MID", "ПСТР", "text, start_num, num_chars", "Characters from the middle", "Символы из середины"),
  f("LEN", "ДЛСТР", "text", "Text length", "Длина текста"),
  f("TRIM", "СЖПРОБЕЛЫ", "text", "Removes extra spaces", "Удаление лишних пробелов"),
  f("UPPER", "ПРОПИСН", "text", "Uppercase", "Прописные буквы"),
  f("LOWER", "СТРОЧН", "text", "Lowercase", "Строчные буквы"),
  f("PROPER", "ПРОПНАЧ", "text", "Capitalizes words", "Каждое слово с прописной"),
  f("SUBSTITUTE", "ПОДСТАВИТЬ", "text, old_text, new_text, [instance]", "Replaces text", "Замена текста"),
  f("FIND", "НАЙТИ", "find_text, within_text, [start_num]", "Finds text (case-sensitive)", "Поиск текста с учётом регистра"),
  f("SEARCH", "ПОИСК", "find_text, within_text, [start_num]", "Finds text", "Поиск текста"),
  f("TEXT", "ТЕКСТ", "value, format_text", "Formats a value as text", "Число в текст по формату"),
  f("VALUE", "ЗНАЧЕН", "text", "Text to number", "Текст в число"),
  f("TODAY", "СЕГОДНЯ", "", "Today's date", "Сегодняшняя дата"),
  f("NOW", "ТДАТА", "", "Current date and time", "Текущие дата и время"),
  f("DATE", "ДАТА", "year, month, day", "Builds a date", "Дата из года, месяца, дня"),
  f("YEAR", "ГОД", "date", "Year of a date", "Год"),
  f("MONTH", "МЕСЯЦ", "date", "Month of a date", "Месяц"),
  f("DAY", "ДЕНЬ", "date", "Day of a date", "День"),
  f("WEEKDAY", "ДЕНЬНЕД", "date, [return_type]", "Day of the week", "День недели"),
  f("EOMONTH", "КОНМЕСЯЦА", "start_date, months", "End of month", "Последний день месяца"),
  f("EDATE", "ДАТАМЕС", "start_date, months", "Date months away", "Дата через N месяцев"),
  f("DATEDIF", "РАЗНДАТ", "start_date, end_date, unit", "Difference between dates", "Разница между датами"),
  f("NETWORKDAYS", "ЧИСТРАБДНИ", "start_date, end_date, [holidays]", "Working days", "Рабочие дни"),
  f("WORKDAY", "РАБДЕНЬ", "start_date, days, [holidays]", "Date after working days", "Дата через рабочие дни"),
  f("PMT", "ПЛТ", "rate, nper, pv, [fv], [type]", "Loan payment", "Платёж по кредиту"),
  f("FV", "БС", "rate, nper, pmt, [pv], [type]", "Future value", "Будущая стоимость"),
  f("NPV", "ЧПС", "rate, value1, [value2], …", "Net present value", "Чистая приведённая стоимость"),
  f("ISBLANK", "ЕПУСТО", "value", "Is the cell empty", "Ячейка пустая"),
  f("ISNUMBER", "ЕЧИСЛО", "value", "Is a number", "Значение — число"),
  f("ISTEXT", "ЕТЕКСТ", "value", "Is text", "Значение — текст"),
  f("RANK", "РАНГ", "number, ref, [order]", "Rank in a list", "Ранг числа"),
  f("LARGE", "НАИБОЛЬШИЙ", "array, k", "k-th largest", "k-е наибольшее"),
  f("SMALL", "НАИМЕНЬШИЙ", "array, k", "k-th smallest", "k-е наименьшее"),
  f("STDEV", "СТАНДОТКЛОН", "number1, [number2], …", "Standard deviation", "Стандартное отклонение"),
  f("HYPERLINK", "ГИПЕРССЫЛКА", "link_location, [friendly_name]", "Creates a link", "Гиперссылка"),
];

const BY_RU = new Map(FUNCTIONS.map((fn) => [fn.ru.toUpperCase(), fn.name]));

/** Functions Excel stores with the `_xlfn.` prefix inside files. */
export const FUTURE_FUNCTIONS = new Set([
  "XLOOKUP", "XMATCH", "UNIQUE", "FILTER", "SORT", "SORTBY", "SEQUENCE", "RANDARRAY", "IFS", "SWITCH", "MAXIFS", "MINIFS",
  "CONCAT", "TEXTJOIN", "IFNA", "DAYS", "LET", "LAMBDA", "XOR", "STDEV.S", "STDEV.P", "VAR.S", "VAR.P", "TEXTBEFORE", "TEXTAFTER",
  "TEXTSPLIT", "VSTACK", "HSTACK", "TAKE", "DROP", "CHOOSECOLS", "CHOOSEROWS", "TOCOL", "TOROW", "WRAPCOLS", "WRAPROWS",
]);

export function functionByName(name: string): FunctionInfo | undefined {
  const upper = name.toUpperCase();
  return FUNCTIONS.find((fn) => fn.name === upper || fn.ru.toUpperCase() === upper);
}

export function englishName(name: string): string | undefined {
  return BY_RU.get(name.toUpperCase());
}
