import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "outputs/final_border_value_2026";
const workbookPath = `${outputDir}/border_value_indicadores_finais_2026.xlsx`;

const csvSheets = [
  ["Resumo CNAE", "border_value_indicadores_finais_cnae.csv"],
  ["Top Produtos", "border_value_indicadores_finais_cnae_prodlist.csv", 500],
  ["Subbuckets NAO", "nao_mapeado_subbuckets.csv"],
  ["NCM Sem Ponte", "ncm_sem_ponte_priorizacao.csv", 200],
  ["Rankings CNAE", "rankings_cnae.csv"],
  ["Rankings Produto", "rankings_prodlist.csv"],
  ["Mudancas Mensais", "mudancas_mensais_cnae.csv"],
  ["Concentracao", "concentracao_produtos_cnae.csv"],
  ["Recortes Setoriais", "rankings_setoriais_consolidados.csv"],
  ["Recortes Produtos", "rankings_produtos_consolidados.csv"],
  ["Produtos Nao Mapeados", "produtos_nao_mapeados.csv"],
  ["Conc Relevante", "concentracao_setorial_relevante.csv"],
  ["Mudancas Relevantes", "mudancas_mensais_setoriais_relevantes.csv"],
  ["Resumo Recortes", "recortes_setoriais_resumo.csv"],
  ["Comp Periodos", "comparacao_periodos_cnae_2024h1_2026h1.csv"],
  ["Ranking Variacao", "rankings_variacao_periodos_cnae.csv"],
  ["Serie Historica", "serie_historica_mensal_cnae_fluxo.csv", 1000],
  ["Cadeias Minerais", "priorizacao_cadeias_minerais_estrategicas.csv"],
  ["Producao ANM", "fact_anm_mineral_production.csv"],
  ["Fontes ANM", "fontes_anm_amb_status.csv"],
  ["Criticidade Min", "referencia_criticidade_minerais.csv"],
  ["Minerais Etapas", "indicadores_cadeias_minerais_etapa.csv"],
  ["Minerais NCM", "drivers_cadeias_minerais_ncm.csv", 500],
  ["Comb Transicao", "indicadores_combustiveis_transicao_camada.csv"],
  ["Comb NCM", "drivers_combustiveis_transicao_ncm.csv", 500],
  ["Comb Fontes", "fontes_complementares_combustiveis_transicao.csv"],
  ["H2 Amonia Estrut", "estrutura_analitica_hidrogenio_amonia.csv"],
];

const workbook = Workbook.create();
let first = true;
for (const [sheetName, fileName, maxRows] of csvSheets) {
  let csvText = await fs.readFile(`${outputDir}/${fileName}`, "utf8");
  csvText = csvText.replace(/^\uFEFF/, "");
  if (maxRows) {
    const lines = csvText.trimEnd().split(/\r?\n/);
    csvText = `${lines.slice(0, maxRows + 1).join("\n")}\n`;
  }
  if (first) {
    await workbook.fromCSV(csvText, {
      sheetName,
      renameFirstIfOnlyNewSpreadsheet: true,
    });
    first = false;
  } else {
    await workbook.fromCSV(csvText, { sheetName });
  }
}

const overview = workbook.worksheets.add("Metodologia");
overview.getRange("A1:D1").values = [["Border Value 2026", "", "", ""]];
overview.getRange("A1:D1").merge();
overview.getRange("A3:D29").values = [
  ["Item", "Definicao", "Fonte", "Observacao"],
  ["Dependencia externa", "Importacoes / consumo aparente", "CNAE e Prodlist", "Consumo aparente = producao domestica comparavel + importacoes - exportacoes"],
  ["Penetracao das importacoes", "Mesmo denominador de consumo aparente", "CNAE e Prodlist", "Calculada apenas com producao domestica comparavel"],
  ["Orientacao exportadora", "Exportacoes / producao domestica comparavel", "CNAE e Prodlist", "Nula quando producao e sigilosa, ausente ou nao comparavel"],
  ["Saldo comercial", "Exportacoes - importacoes", "CNAE e produto", "Valores FOB em US$"],
  ["Prioridade setorial", "40% relevancia economica, 40% vulnerabilidade externa, 20% transicao energetica", "CNAE", "Score de 0 a 1"],
  ["Produto", "Comercio alocado por NCM-Prodlist-CNAE + PIA Prodlist", "Prodlist", "Aba Top Produtos mostra os 500 maiores; recorte completo esta no CSV"],
  ["Nao mapeado", "Bucket NAO_MAPEADO / NCM_SEM_PONTE", "NCM", "Mantido para reconciliar com o total oficial"],
  ["Subbuckets NAO_MAPEADO", "Separacao entre primario fora do escopo Prodlist e lacunas de ponte", "NCM", "Nao cria correspondencia manual sem fonte CONCLA/IBGE"],
  ["Cadeias minerais", "Modulo transversal de minerais estrategicos para transicao", "NCM e cadeia", "Seed curada para validacao especialista; nao altera a ponte CONCLA"],
  ["ANM/AMB", "Producao mineral bruta e beneficiada por substancia", "Substancia mineral", "Camada complementar; nao substitui PIA-Produto"],
  ["Combustiveis da transicao", "Modulo transversal para hidrogenio, amonia, SAF, metanol, etanol e combustiveis maritimos", "NCM e prefixos curados", "Classificacao preliminar; baixa emissao nao e inferivel apenas pela NCM"],
  ["Etapas da cadeia", "Molecula, insumos, equipamentos, derivados, aplicacoes, rotas, projetos e fluxos", "Seed combustiveis", "Permite filtros proprios no dashboard"],
  ["Fontes complementares", "Projetos, capacidade, certificacao, rota tecnologica e intensidade de emissoes", "Levantamento setorial", "Necessarias para distinguir verde, azul, renovavel ou baixa emissao"],
  ["RAIS", "Vinculos formais, massa salarial e salario medio por CNAE, UF e municipio", "RAIS 2024", "Camada territorial e social; score emprego-plataforma e preliminar"],
  ["Mapas", "Mapa mundial por parceiro comercial e mapa municipal RAIS", "Comex Stat, dimensoes pais/municipio e malhas IBGE", "Visualizacao exploratoria integrada aos filtros"],
  ["Criticidade mineral", "Referencia de pesos estrategicos por mineral-base", "IEA e contexto setorial", "Usada no strategic_score das cadeias minerais"],
  ["Recortes setoriais", "Rankings consolidados por valor, importacao, deficit, dependencia, prioridade e mudanca", "CNAE", "Abas Recortes Setoriais, Conc Relevante e Mudancas Relevantes"],
  ["Comparacao entre periodos", "2026 H1 contra 2024 H1, com serie mensal historica de apoio", "CNAE e fluxo", "Abas Comp Periodos, Ranking Variacao e Serie Historica"],
  ["Produtos nao mapeados", "Ranking separado do bucket NCM_SEM_PONTE", "NCM", "Nao compete com produtos Prodlist mapeados"],
  ["Overrides", "Template para correspondencias manuais defensaveis", "NCM", "Arquivo ncm_prodlist_overrides_template.csv"],
  ["Sigilo estatistico", "PIA marcada como X", "PIA-Produto/SIDRA", "Nao imputar, redistribuir ou reidentificar valores protegidos"],
  ["Indisponibilidade PIA", "Marcadores -, .., ... ou ausencia de linha", "PIA-Produto/SIDRA", "Bloqueia indicadores dependentes de producao comparavel"],
  ["Defasagem temporal", "Comercio 2026 H1 combinado com producao PIA 2024", "Comex Stat e PIA", "Interpretar dependencia como aproximacao analitica"],
  ["Defasagem classificatoria", "Versoes NCM, Prodlist e CONCLA podem divergir", "CONCLA/IBGE e Comex Stat", "Revisar codigos novos, extintos, genericos e sem ponte"],
  ["Ponte 1:N", "Uma NCM pode se vincular a multiplas CNAEs", "Ponte NCM-Prodlist-CNAE", "Distribuicao setorial depende da regra de alocacao documentada"],
  ["Comparabilidade", "Comparacoes entre anos exigem mesma base ou conciliacao", "Manifest e documentacao", "Registrar periodos, versoes e tratamentos de lacunas"],
];
overview.getRange("A30:B54").values = [
  ["Arquivo", "Conteudo"],
  ["border_value_indicadores_finais_cnae.csv", "Indicadores finais por CNAE"],
  ["border_value_indicadores_finais_cnae_prodlist.csv", "Indicadores finais por CNAE e Prodlist"],
  ["comercio_alocado_cnae_prodlist_fluxo_periodo.csv", "Recorte CNAE, produto, fluxo e mes"],
  ["nao_mapeado_subbuckets.csv", "Resumo do NAO_MAPEADO por sub-bucket e familia"],
  ["ncm_sem_ponte_priorizacao.csv", "Ranking de NCM sem ponte por valor"],
  ["ncm_prodlist_overrides_template.csv", "Template para auditoria manual"],
  ["rankings_setoriais_consolidados.csv", "Top 10 por principais rankings setoriais"],
  ["rankings_produtos_consolidados.csv", "Top 10 de produtos mapeados por principais criterios"],
  ["produtos_nao_mapeados.csv", "Itens agregados fora da ponte Prodlist-CNAE"],
  ["recortes_setoriais_resumo.csv", "Resumo por tier e relevancia para transicao"],
  ["comparacao_periodos_cnae_2024h1_2026h1.csv", "Comparacao CNAE entre 2024 H1 e 2026 H1"],
  ["rankings_variacao_periodos_cnae.csv", "Rankings das maiores variacoes entre periodos"],
  ["serie_historica_mensal_cnae_fluxo.csv", "Serie mensal por CNAE e fluxo para contexto historico"],
  ["priorizacao_cadeias_minerais_estrategicas.csv", "Priorizacao de cadeias minerais estrategicas"],
  ["fact_anm_mineral_production.csv", "Producao mineral ANM/AMB normalizada por substancia e mineral-base"],
  ["fontes_anm_amb_status.csv", "Status de acesso/cache/leitura das fontes ANM/AMB"],
  ["referencia_criticidade_minerais.csv", "Pesos e justificativas de criticidade por mineral-base"],
  ["indicadores_cadeias_minerais_etapa.csv", "Indicadores por cadeia mineral e etapa"],
  ["drivers_cadeias_minerais_ncm.csv", "Principais NCMs por cadeia mineral"],
  ["indicadores_combustiveis_transicao_camada.csv", "Indicadores de hidrogenio, amonia, SAF, metanol, etanol e combustiveis maritimos por etapa da cadeia"],
  ["drivers_combustiveis_transicao_ncm.csv", "NCMs observadas por recorte de combustivel e etapa"],
  ["fontes_complementares_combustiveis_transicao.csv", "Campos complementares necessarios para validar rota, certificacao e intensidade de emissoes"],
  ["estrutura_analitica_hidrogenio_amonia.csv", "Camadas obrigatorias de leitura para hidrogenio e amonia"],
  ["employment_platform_cnae.csv", "RAIS agregada por CNAE com vinculo ao escopo da plataforma e score preliminar"],
];
overview.getRange("F3:H9").values = [
  ["Atividade", "Fase", "Tratamento"],
  ["RAIS", "Consolidacao, documentacao e testes", "Camada oficial integrada; validar, documentar e testar."],
  ["Cartografia municipal", "Consolidacao, documentacao e testes", "Revisar malhas, dimensoes e aderencia ao dashboard."],
  ["Mapa mundial", "Consolidacao, documentacao e testes", "Validar a visualizacao de parceiros comerciais ja incorporada."],
  ["Integracao", "Consolidacao, documentacao e testes", "Tratar como fechamento operacional dos modulos existentes."],
  ["Automacao", "Consolidacao, documentacao e testes", "Endurecer reproducao e atualizacao, sem abrir frente inicial."],
  ["Hidrogenio e amonia", "Consolidacao, documentacao e testes", "Documentar ressalvas, fontes complementares e testes do recorte."],
];

for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  if (!used) continue;
  sheet.showGridLines = false;
  const header = sheet.getRangeByIndexes(0, 0, 1, used.columnCount);
  header.format = {
    fill: "#164E63",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
  used.format.borders = {
    insideHorizontal: { style: "thin", color: "#E5E7EB" },
    top: { style: "thin", color: "#CBD5E1" },
    bottom: { style: "thin", color: "#CBD5E1" },
  };
  used.format.autofitColumns();
  used.format.autofitRows();
  sheet.freezePanes.freezeRows(1);
}

overview.getRange("A1:D1").format = {
  fill: "#0F766E",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
overview.getRange("A3:D3").format = {
  fill: "#164E63",
  font: { bold: true, color: "#FFFFFF" },
};
overview.getRange("A30:B30").format = {
  fill: "#164E63",
  font: { bold: true, color: "#FFFFFF" },
};
overview.getRange("A:D").format.wrapText = true;
overview.getRange("A:A").format.columnWidth = 28;
overview.getRange("B:B").format.columnWidth = 48;
overview.getRange("C:C").format.columnWidth = 20;
overview.getRange("D:D").format.columnWidth = 60;

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({
  sheetName: "Metodologia",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview_Metodologia.png`, new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(workbookPath);
console.log(workbookPath);
