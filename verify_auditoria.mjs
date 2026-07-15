import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const path = "outputs/auditoria_manual_concla_2024/auditoria_manual_concla_codigos_genericos_2024.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
console.log((await wb.inspect({kind:"table", sheetId:"Resumo", range:"G4:H10", include:"values,formulas", tableMaxRows:10, tableMaxCols:4, maxChars:4000})).ndjson);
console.log((await wb.inspect({kind:"table", sheetId:"NCM finais 9-90-99", range:"H2:L12", include:"values,formulas", tableMaxRows:12, tableMaxCols:5, maxChars:7000})).ndjson);
console.log((await wb.inspect({kind:"match", searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options:{useRegex:true,maxResults:100}, summary:"final formula error scan", maxChars:3000})).ndjson);
