import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";

const path = "outputs/diagnostico_cobertura_2024/diagnostico_cobertura_2024.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const before = await wb.render({sheetName:"NCM finais 9-90-99", range:"A1:G18", scale:1.4, format:"png"});
await fs.writeFile("outputs/diagnostico_cobertura_2024/auditoria_before.png", new Uint8Array(await before.arrayBuffer()));
const summary = await wb.inspect({kind:"workbook,sheet,table", maxChars:12000, tableMaxRows:12, tableMaxCols:20, tableMaxCellChars:140});
console.log(summary.ndjson);
for (const s of wb.worksheets.items) {
  const used = s.getUsedRange();
  console.log(`SHEET ${s.name} USED ${used?.address ?? "none"}`);
  if (used) {
    const match = await wb.inspect({kind:"match", sheetId:s.name, searchTerm:"gen", options:{useRegex:false,maxResults:200}, maxChars:12000});
    console.log(match.ndjson);
  }
}
