import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/final_border_value_2026";
const csvPath = `${outputDir}/matriz_auditoria_published_ncm.csv`;
const summaryPath = `${outputDir}/matriz_auditoria_published_ncm_resumo.json`;
const workbookPath = `${outputDir}/matriz_auditoria_published_ncm.xlsx`;

const csvText = (await fs.readFile(csvPath, "utf8")).replace(/^\uFEFF/, "");
const summary = JSON.parse(await fs.readFile(summaryPath, "utf8"));

const workbook = await Workbook.fromCSV(csvText, { sheetName: "Matriz Published" });
const matrix = workbook.worksheets.getItem("Matriz Published");
matrix.showGridLines = false;
const used = matrix.getUsedRange();
const rowCount = used.rowCount;
const colCount = used.columnCount;

matrix.freezePanes.freezeRows(1);
matrix.freezePanes.freezeColumns(4);
matrix.getRangeByIndexes(0, 0, 1, colCount).format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
  verticalAlignment: "center",
};
matrix.getRangeByIndexes(0, 0, rowCount, colCount).format.font = { name: "Aptos", size: 10 };
matrix.getRangeByIndexes(1, 8, rowCount - 1, 4).format.numberFormat = "$#,##0";
matrix.getRangeByIndexes(1, 12, rowCount - 1, 1).format.numberFormat = "0.0%";
matrix.getRangeByIndexes(1, 28, rowCount - 1, 1).format.numberFormat = "$#,##0";
matrix.getRange("D:D").format.numberFormat = "00000000";
matrix.getRange("A:A").format.columnWidth = 15;
matrix.getRange("B:B").format.columnWidth = 13;
matrix.getRange("C:C").format.columnWidth = 30;
matrix.getRange("D:D").format.columnWidth = 12;
matrix.getRange("E:E").format.columnWidth = 28;
matrix.getRange("F:F").format.columnWidth = 52;
matrix.getRange("I:M").format.columnWidth = 14;
matrix.getRange("Q:S").format.columnWidth = 28;
matrix.getRange("T:U").format.columnWidth = 24;
matrix.getRange("Z:AB").format.columnWidth = 28;
matrix.getRange("AD:AH").format.columnWidth = 34;
matrix.getRange("AI:AM").format.columnWidth = 24;
matrix.getRange("E:F").format.wrapText = true;
matrix.getRange("AE:AH").format.wrapText = true;
matrix.getRange("AI:AM").format.fill = "#FFF2CC";
matrix.getRange("AI1:AM1").format.fill = "#7F6000";
matrix.getRange("AI1:AM1").format.font = { bold: true, color: "#FFFFFF" };

matrix.getRange(`AI2:AI${rowCount}`).dataValidation = {
  rule: { type: "list", values: ["Aprovado", "Ressalva", "Revisar", "Excluir"] },
};
matrix.getRange(`B2:B${rowCount}`).conditionalFormats.add("containsText", {
  text: "Alta",
  format: { fill: "#FCE4D6", font: { color: "#843C0C", bold: true } },
});
matrix.getRange(`AD2:AD${rowCount}`).conditionalFormats.add("containsText", {
  text: "Excluir",
  format: { fill: "#F4CCCC", font: { color: "#990000", bold: true } },
});
matrix.getRange(`AD2:AD${rowCount}`).conditionalFormats.add("containsText", {
  text: "Revisar",
  format: { fill: "#FCE4D6", font: { color: "#843C0C", bold: true } },
});
matrix.getRange(`AD2:AD${rowCount}`).conditionalFormats.add("containsText", {
  text: "Ressalva",
  format: { fill: "#FFF2CC", font: { color: "#7F6000" } },
});
matrix.tables.add(`A1:AM${rowCount}`, true, "MatrizPublishedTable");

const headers = matrix.getRangeByIndexes(0, 0, 1, colCount).values[0];
const data = matrix.getRangeByIndexes(0, 0, rowCount, colCount).values;
const specialistColumns = [
  "audit_id",
  "prioridade_revisao",
  "ncm",
  "descricao_ncm",
  "tema_auditoria",
  "trade_value_usd",
  "decisao_sugerida",
  "acao_recomendada",
  "justificativa_sugerida",
  "published_audit_action",
  "salvaguarda_pia_rais",
  "decisao_especialista",
  "justificativa_especialista",
  "fonte_complementar",
  "responsavel",
  "data_decisao",
];
const specialistIndexes = specialistColumns.map((name) => headers.indexOf(name));
const specialistValues = data.map((row) => specialistIndexes.map((index) => row[index]));

const fila = workbook.worksheets.add("Fila Especialista");
fila.showGridLines = false;
fila.getRangeByIndexes(0, 0, specialistValues.length, specialistValues[0].length).values = specialistValues;
fila.freezePanes.freezeRows(1);
fila.freezePanes.freezeColumns(3);
fila.getRangeByIndexes(0, 0, 1, specialistColumns.length).format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF" },
  wrapText: true,
  verticalAlignment: "center",
};
fila.getRangeByIndexes(0, 0, specialistValues.length, specialistColumns.length).format.font = { name: "Aptos", size: 10 };
fila.getRange("A:A").format.columnWidth = 15;
fila.getRange("B:B").format.columnWidth = 13;
fila.getRange("C:C").format.columnWidth = 12;
fila.getRange("D:D").format.columnWidth = 28;
fila.getRange("E:E").format.columnWidth = 30;
fila.getRange("F:F").format.columnWidth = 16;
fila.getRange("G:G").format.columnWidth = 16;
fila.getRange("H:K").format.columnWidth = 42;
fila.getRange("L:P").format.columnWidth = 24;
fila.getRange("D:E").format.wrapText = true;
fila.getRange("H:K").format.wrapText = true;
fila.getRange("L:P").format.fill = "#FFF2CC";
fila.getRange("L1:P1").format = { fill: "#7F6000", font: { bold: true, color: "#FFFFFF" }, wrapText: true };
fila.getRange(`F2:F${rowCount}`).format.numberFormat = "$#,##0";
fila.getRange("C:C").format.numberFormat = "00000000";
fila.getRange(`L2:L${rowCount}`).dataValidation = {
  rule: { type: "list", values: ["Aprovado", "Ressalva", "Revisar", "Excluir"] },
};
fila.getRange(`B2:B${rowCount}`).conditionalFormats.add("containsText", {
  text: "Alta",
  format: { fill: "#FCE4D6", font: { color: "#843C0C", bold: true } },
});
fila.getRange(`G2:G${rowCount}`).conditionalFormats.add("containsText", {
  text: "Excluir",
  format: { fill: "#F4CCCC", font: { color: "#990000", bold: true } },
});
fila.getRange(`G2:G${rowCount}`).conditionalFormats.add("containsText", {
  text: "Revisar",
  format: { fill: "#FCE4D6", font: { color: "#843C0C", bold: true } },
});
fila.getRange(`G2:G${rowCount}`).conditionalFormats.add("containsText", {
  text: "Ressalva",
  format: { fill: "#FFF2CC", font: { color: "#7F6000" } },
});
fila.tables.add(`A1:P${rowCount}`, true, "FilaEspecialistaTable");

const resumo = workbook.worksheets.add("Resumo");
resumo.showGridLines = false;
resumo.getRange("A1:F1").merge();
resumo.getRange("A1:F1").values = [["Matriz de Auditoria NCM para Metadados Published"]];
resumo.getRange("A1:F1").format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF", size: 14 },
  horizontalAlignment: "center",
};
resumo.getRange("A3:B8").values = [
  ["Indicador", "Valor"],
  ["Linhas na matriz", summary.linhas_matriz],
  ["NCMs sem ponte oficial", summary.ncm_sem_ponte],
  ["NCMs genéricas 9/90/99", summary.ncm_genericos],
  ["NCMs em recortes de transição", summary.ncm_recorte_transicao],
  ["Valor comercial auditado (US$)", summary.valor_total_auditado_usd],
];
resumo.getRange("D3:F7").values = [
  ["Decisão sugerida", "NCMs", "Leitura Published"],
  ["Ressalva", summary.decisoes_sugeridas.Ressalva ?? 0, "Publicar com alerta metodológico."],
  ["Excluir", summary.decisoes_sugeridas.Excluir ?? 0, "Não publicar como item industrial mapeado; manter auditoria."],
  ["Revisar", summary.decisoes_sugeridas.Revisar ?? 0, "Reter até decisão especialista."],
  ["Aprovado", summary.decisoes_sugeridas.Aprovado ?? 0, "Publicar como indicador regular."],
];
resumo.getRange("A10:F16").values = [
  ["Como usar", "", "", "", "", ""],
  ["1", "Revise primeiro as linhas de prioridade Alta.", "", "", "", ""],
  ["2", "Preencha a coluna decisao_especialista na aba Matriz Published.", "", "", "", ""],
  ["3", "Registre justificativa, fonte, responsável e data.", "", "", "", ""],
  ["4", "A coluna published_audit_action indica a ação esperada na camada Published.", "", "", "", ""],
  ["5", "A coluna salvaguarda_pia_rais indica quando RAIS deve apoiar rateio 1:N sob PIA sigilosa ou ausente.", "", "", "", ""],
  ["6", "Nenhuma ponte manual deve ser promovida sem fonte oficial ou validação especialista rastreável.", "", "", "", ""],
];
resumo.getRange("A3:F3").format = { fill: "#D9EAF7", font: { bold: true } };
resumo.getRange("D3:F3").format = { fill: "#D9EAF7", font: { bold: true } };
resumo.getRange("A10:F10").merge();
resumo.getRange("A10:F10").format = { fill: "#D9EAF7", font: { bold: true } };
resumo.getRange("B8").format.numberFormat = "$#,##0";
resumo.getRange("A:F").format.font = { name: "Aptos", size: 10 };
resumo.getRange("A:A").format.columnWidth = 24;
resumo.getRange("B:B").format.columnWidth = 24;
resumo.getRange("D:D").format.columnWidth = 22;
resumo.getRange("E:E").format.columnWidth = 12;
resumo.getRange("F:F").format.columnWidth = 48;

const regras = workbook.worksheets.add("Regras");
regras.showGridLines = false;
regras.getRange("A1:D1").merge();
regras.getRange("A1:D1").values = [["Contrato de decisão especialista -> Published"]];
regras.getRange("A1:D1").format = {
  fill: "#1F4E78",
  font: { bold: true, color: "#FFFFFF", size: 13 },
  horizontalAlignment: "center",
};
regras.getRange("A3:D8").values = [
  ["Decisão", "Quando usar", "Ação Published", "Observação"],
  ["Aprovado", "Ponte e leitura setorial defensáveis.", "published_standard", "Manter fonte, ponte e regra de rateio."],
  ["Ressalva", "Há genericidade, PIA sigilosa/ausente, uso final indeterminado ou recorte de transição sem certificação ambiental.", "published_with_warning", "Publicar com alerta explícito."],
  ["Revisar", "Há ambiguidade material ou possível ponte industrial sem fonte suficiente.", "published_hold_pending_manual_bridge_decision", "Reter da leitura conclusiva."],
  ["Excluir", "Item fora do escopo industrial ou sem base para publicação setorial.", "published_exclude_industrial_mapping_keep_audit_metadata", "Não apagar: manter como metadado auditado."],
  ["PIA/RAIS", "PIA sigilosa ou ausente em rateio 1:N.", "published_with_pia_status_warning", "RAIS pode calibrar distribuição territorial/setorial, mas não substitui produção PIA."],
];
regras.getRange("A3:D3").format = { fill: "#D9EAF7", font: { bold: true } };
regras.getRange("A:D").format.font = { name: "Aptos", size: 10 };
regras.getRange("A:D").format.wrapText = true;
regras.getRange("A:A").format.columnWidth = 18;
regras.getRange("B:B").format.columnWidth = 44;
regras.getRange("C:C").format.columnWidth = 48;
regras.getRange("D:D").format.columnWidth = 56;

const scan = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(scan.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const previewResumo = await workbook.render({ sheetName: "Resumo", range: "A1:F16", scale: 1.2, format: "png" });
await fs.writeFile(`${outputDir}/preview_matriz_auditoria_published_resumo.png`, new Uint8Array(await previewResumo.arrayBuffer()));
const previewMatriz = await workbook.render({ sheetName: "Matriz Published", range: "A1:AM18", scale: 0.75, format: "png" });
await fs.writeFile(`${outputDir}/preview_matriz_auditoria_published_matriz.png`, new Uint8Array(await previewMatriz.arrayBuffer()));
const previewFila = await workbook.render({ sheetName: "Fila Especialista", range: "A1:P18", scale: 0.9, format: "png" });
await fs.writeFile(`${outputDir}/preview_matriz_auditoria_published_fila.png`, new Uint8Array(await previewFila.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(workbookPath);
console.log(JSON.stringify({ workbookPath, rowCount, colCount }));
