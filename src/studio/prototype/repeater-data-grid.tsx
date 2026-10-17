import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "../../shared/i18n";
import type { WireframeElement } from "./model";
import { normalizeRepeaterData, parseCsvGrid, parseTsvGrid, repeaterColumns, repeaterData } from "./containers";

export function RepeaterDataGrid({
  repeater,
  onUpdate,
}: {
  repeater: WireframeElement;
  onUpdate: (patch: { columns?: string[]; data: string[][] }) => void;
}) {
  const t = useT();
  const columns = repeaterColumns(repeater);
  const data = repeaterData(repeater);

  const setCell = (row: number, col: number, value: string) => {
    const next = data.map((r) => [...r]);
    while (next.length <= row) next.push(columns.map(() => ""));
    next[row]![col] = value;
    onUpdate({ data: normalizeRepeaterData(columns, next) });
  };

  const addRow = () => onUpdate({ data: [...data, columns.map(() => "")] });
  const removeRow = (index: number) => onUpdate({ data: data.filter((_, i) => i !== index) });
  const addColumn = () => {
    const name = `Col ${columns.length + 1}`;
    const nextColumns = [...columns, name];
    const nextData = data.map((row) => [...row, ""]);
    onUpdate({ columns: nextColumns, data: normalizeRepeaterData(nextColumns, nextData) });
  };

  const applyPaste = (text: string) => {
    const grid = text.includes("\t") ? parseTsvGrid(text) : parseCsvGrid(text);
    if (!grid.length) return;
    const [head, ...body] = grid;
    const headerLooksLikeColumns = head.every((cell) => cell.trim().length > 0);
    const nextColumns = headerLooksLikeColumns && body.length ? head : columns;
    const rows = headerLooksLikeColumns && body.length ? body : grid;
    onUpdate({ columns: nextColumns, data: normalizeRepeaterData(nextColumns, rows) });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={addRow}>{t("protoRepeaterAddRow")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={addColumn}>{t("protoRepeaterAddColumn")}</Button>
      </div>
      <div className="overflow-auto rounded border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col} className="border border-border bg-muted px-1 py-0.5 text-left font-medium">{col}</th>
              ))}
              <th className="border border-border bg-muted px-1 py-0.5" />
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((col, colIndex) => (
                  <td key={`${col}-${colIndex}`} className="border border-border p-0">
                    <input
                      className="w-full min-w-16 bg-transparent px-1 py-0.5 outline-none"
                      value={row[colIndex] ?? ""}
                      onChange={(event) => setCell(rowIndex, colIndex, event.target.value)}
                    />
                  </td>
                ))}
                <td className="border border-border p-0">
                  <button type="button" className="px-2 text-muted-foreground hover:text-foreground" onClick={() => removeRow(rowIndex)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("protoRepeaterPasteHint")}
        <Textarea rows={3} placeholder={t("protoRepeaterPastePlaceholder")} onPaste={(event) => {
          const text = event.clipboardData.getData("text/plain");
          if (!text.trim()) return;
          event.preventDefault();
          applyPaste(text);
        }} />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("protoRepeaterImportCsv")}
        <input
          type="file"
          accept=".csv,text/csv"
          className="text-xs"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            applyPaste(await file.text());
            event.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
