import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "../../shared/i18n";
import {
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  pasteTableTsv,
  readTable,
  setTableCell,
  tableCellNav,
  writeTable,
  type TableModel,
} from "./inspector-model";
import type { WireframeElement } from "./model";

export function InspectorTableEditor({ el, onChange }: { el: WireframeElement; onChange: (el: WireframeElement) => void }) {
  const t = useT();
  const [model, setModel] = useState<TableModel>(() => readTable(el));
  const [focus, setFocus] = useState({ row: 0, col: 0 });

  useEffect(() => {
    setModel(readTable(el));
  }, [el.id, el.props.columns, el.props.rows, el.props.cells, el.props.headers]);

  const commit = (next: TableModel) => {
    setModel(next);
    onChange(writeTable(el, next));
  };

  const onCellKey = (event: KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      const next = tableCellNav(row, col, model.columns, model.rows, event.key === "Tab" ? "Tab" : "Enter", event.shiftKey);
      setFocus(next);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "v") {
      event.preventDefault();
      void navigator.clipboard.readText().then((text) => {
        commit(pasteTableTsv(model, text, row, col));
      });
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => commit(insertTableRow(model, model.rows))}>{t("protoTableAddRow")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => commit(deleteTableRow(model, model.rows - 1))}>{t("protoTableDelRow")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => commit(insertTableColumn(model, model.columns))}>{t("protoTableAddCol")}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => commit(deleteTableColumn(model, model.columns - 1))}>{t("protoTableDelCol")}</Button>
      </div>
      <div className="overflow-auto rounded border border-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {model.headers.map((header, col) => (
                <th key={col} className="border border-border bg-muted p-1">
                  <Input
                    className="h-7 text-xs"
                    value={header}
                    onChange={(event) => {
                      const headers = [...model.headers];
                      headers[col] = event.target.value;
                      commit({ ...model, headers });
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c} className="border border-border p-0">
                    <Input
                      className="h-7 rounded-none border-0 text-xs"
                      value={cell}
                      autoFocus={focus.row === r && focus.col === c}
                      onFocus={() => setFocus({ row: r, col: c })}
                      onChange={(event) => commit(setTableCell(model, r, c, event.target.value))}
                      onKeyDown={(event) => onCellKey(event, r, c)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">{t("protoTablePasteHint")}</p>
    </div>
  );
}
