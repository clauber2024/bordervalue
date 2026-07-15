import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "outputs/diagnostico_cobertura_2024/diagnostico_cobertura_2024.xlsx";
const outputDir = "outputs/auditoria_manual_concla_2024";
const outputPath = `${outputDir}/auditoria_manual_concla_codigos_genericos_2024.xlsx`;
const currentUrl = "https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json";
const conclaUrl = "https://concla.ibge.gov.br/classificacoes/correspondencias/produtos.html";
const historical = {
  "39069049":"Outros polímeros acrílicos, em blocos irregulares, pedaços, pós, etc",
  "39072990":"Outros poliéteres, em formas primárias, não classificados em códigos anteriores",
  "93059090":"Partes e acessórios para outras armas",
  "85258029":"Outras câmeras de vídeo de imagens fixas",
  "85177099":"Outras partes para aparelhos de telefonia/telegrafia",
  "96121019":"Outras fitas impressoras de plástico",
  "94054090":"Outros aparelhos elétricos de iluminação, de outras matérias",
  "29299029":"Outros N,N-Dialquilfosforoamidatos e seus derivados",
  "38220090":"Outros reagentes de diagnóstico ou de laboratório",
  "84717019":"Outras unidades de discos magnéticos",
  "94039090":"Partes para móveis, de outras matérias",
  "94019090":"Partes para assentos, de outras matérias",
  "85271990":"Outros aparelhos receptores de radiodifusão, à pilha/elétricos, etc",
  "28444090":"Outros elementos, isotopos e compostos, radioativos, etc.",
  "84733099":"Outras partes e acessórios para máquinas automáticas de processamento de dados",
  "34021190":"Outros agentes orgânicos de superfície, aniônicos",
  "20029090":"Outros tomates preparados ou conservados, exceto em vinagre ou em ácido acético",
  "74199990":"Aparelhos para cozinhar/aquecer, de cobre, não elétrico, uso doméstico"
};

const raw = JSON.parse(await fs.readFile("dados/cache/ncm_vigente.json", "utf8"));
const cleanCode = (v) => String(v ?? "").replace(/\D/g, "").padStart(8, "0");
const stripHtml = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
const current = new Map(raw.Nomenclaturas
  .map(x => [String(x.Codigo).replace(/\D/g, ""), stripHtml(x.Descricao)])
  .filter(([c]) => c.length === 8));

const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
const sheet = wb.worksheets.getItem("NCM finais 9-90-99");
const values = sheet.getRange("A3:G2033").values;
const audit = [];
const counts = {"Genérico residual":0, "Genérico amplo":0, "Específico — falso positivo do sufixo":0};
for (const row of values) {
  const code = cleanCode(row[0]);
  const isHistorical = !current.has(code);
  const description = current.get(code) ?? historical[code] ?? "Não localizado";
  const d = description.toLocaleLowerCase("pt-BR");
  let decision, reason;
  if (/\b(outro|outra|outros|outras|demais)\b/.test(d) || /não classificad|não especificad/.test(d)) {
    decision = "Genérico residual";
    reason = "A denominação oficial contém categoria residual (outro/outra/demais ou equivalente).";
  } else if (/^partes\b|^parte\b/.test(d)) {
    decision = "Genérico amplo";
    reason = "A denominação oficial identifica apenas partes/acessórios, sem produto final específico.";
  } else {
    decision = "Específico — falso positivo do sufixo";
    reason = "A denominação oficial é específica; o final 9/90/99, isoladamente, não torna o código genérico.";
  }
  counts[decision]++;
  const source = isHistorical
    ? `https://api-comexstat.mdic.gov.br/tables/ncm/${code}`
    : currentUrl;
  audit.push([description, decision, reason, isHistorical ? "Comex Stat — código histórico de 2024" : raw.Data_Ultima_Atualizacao_NCM, source]);
}

sheet.getRange("H2:L2").values = [["Descrição oficial da NCM", "Resultado da auditoria", "Justificativa", "Base consultada", "Fonte oficial"]];
sheet.getRange("H3:L2033").values = audit;
sheet.getRange("H2:L2033").format = {font:{name:"Aptos", size:10}, verticalAlignment:"top"};
sheet.getRange("H2:L2").format = {fill:"#1F4E78", font:{bold:true,color:"#FFFFFF",size:10}, wrapText:true, verticalAlignment:"center"};
sheet.getRange("H3:L2033").format.wrapText = true;
sheet.getRange("H:H").format.columnWidth = 38;
sheet.getRange("I:I").format.columnWidth = 28;
sheet.getRange("J:J").format.columnWidth = 54;
sheet.getRange("K:K").format.columnWidth = 30;
sheet.getRange("L:L").format.columnWidth = 52;
sheet.freezePanes.freezeRows(2);
sheet.freezePanes.freezeColumns(1);
sheet.getRange("I3:I2033").conditionalFormats.add("containsText", {text:"falso positivo", format:{fill:"#E2F0D9",font:{color:"#375623"}}});
sheet.getRange("I3:I2033").conditionalFormats.add("containsText", {text:"Genérico residual", format:{fill:"#FFF2CC",font:{color:"#7F6000"}}});
sheet.getRange("I3:I2033").conditionalFormats.add("containsText", {text:"Genérico amplo", format:{fill:"#FCE4D6",font:{color:"#843C0C"}}});

const summary = wb.worksheets.getItem("Resumo");
summary.getRange("G4:H10").values = [
  ["Auditoria manual CONCLA/NCM", "Resultado"],
  ["Códigos conferidos", values.length],
  ["Genéricos residuais", counts["Genérico residual"]],
  ["Genéricos amplos", counts["Genérico amplo"]],
  ["Falsos positivos do sufixo", counts["Específico — falso positivo do sufixo"]],
  ["Referência CONCLA", conclaUrl],
  ["Data da auditoria", "2026-07-14"]
];
summary.getRange("G4:H4").format = {fill:"#1F4E78",font:{bold:true,color:"#FFFFFF"}};
summary.getRange("G5:H10").format = {fill:"#D9EAF7",font:{color:"#1F1F1F"},wrapText:true};
summary.getRange("G:G").format.columnWidth = 30;
summary.getRange("H:H").format.columnWidth = 52;

await fs.mkdir(outputDir, {recursive:true});
const preview = await wb.render({sheetName:"NCM finais 9-90-99", range:"A1:L16", scale:1.1, format:"png"});
await fs.writeFile(`${outputDir}/preview_auditoria.png`, new Uint8Array(await preview.arrayBuffer()));
const summaryPreview = await wb.render({sheetName:"Resumo", range:"A1:H10", scale:1.2, format:"png"});
await fs.writeFile(`${outputDir}/preview_resumo.png`, new Uint8Array(await summaryPreview.arrayBuffer()));
const out = await SpreadsheetFile.exportXlsx(wb);
await out.save(outputPath);
console.log(JSON.stringify({outputPath, counts, total:values.length}));
