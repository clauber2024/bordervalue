import type { ConceptualProduct } from "../components/ConceptualProductCard";

export type SelectOption = readonly [string, string];

export const chains: readonly SelectOption[] = [
  ["all", "Todas"],
  ["fertilizers", "Fertilizantes"],
  ["hydrogen-ammonia", "Hidrogênio e amônia"],
  ["critical-minerals", "Minerais críticos"],
  ["transition-fuels", "Combustíveis de transição"],
];

export const chainAliases: Record<string, string> = {
  fertilizers: "Fertilizantes",
  "hydrogen-ammonia": "Hidrogênio e amônia",
  "critical-minerals": "Minerais críticos",
  "transition-fuels": "Combustíveis de transição",
};

export const indicators: readonly SelectOption[] = [
  ["externalDependency", "Dependência externa"],
  ["hhi", "Concentração HHI"],
  ["imports", "Importações"],
  ["exports", "Exportações"],
  ["production", "Produção nacional"],
  ["supplierShare", "Fornecedor principal"],
];

export const periods: readonly SelectOption[] = [
  ["2026-H1", "2026 H1"],
  ["2026-Q2", "2026 Q2"],
  ["2026-Q1", "2026 Q1"],
  ["2025", "2025"],
];

export const products: ConceptualProduct[] = [
  {
    id: "urea",
    name: "Ureia fertilizante",
    shortDescription: "Insumo nitrogenado critico para a produtividade agricola brasileira.",
    chain: "Fertilizantes",
    productionStage: "Insumo primario",
    metrics: {
      imports: 2450000000,
      exports: 78000000,
      externalDependency: 86,
      hhi: 3180,
      mainSupplier: { country: "Russia", share: 31 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["310210"],
      ncm: ["31021010", "31021090"],
      cnae: ["2013", "4683"],
      prodlist: ["2052.2010"],
    },
    sources: ["Comex Stat 2026 H1", "PIA-Produto 2024", "RAIS 2024"],
    methodology:
      "Agregação conceitual por NCM e PRODLIST com rateio CNAE ponderado por valor de produção PIA quando disponível.",
  },
  {
    id: "green-ammonia",
    name: "Amonia e derivados",
    shortDescription: "Base quimica para fertilizantes, hidrogenio e combustiveis de transicao.",
    chain: "Hidrogenio e amonia",
    productionStage: "Intermediario industrial",
    metrics: {
      imports: 1120000000,
      exports: 185000000,
      externalDependency: 68,
      hhi: 2410,
      mainSupplier: { country: "Trinidad and Tobago", share: 24 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["281410"],
      ncm: ["28141000"],
      cnae: ["2011"],
      prodlist: ["2011.2050"],
    },
    sources: ["Comex Stat 2026 H1", "PIA-Produto 2024"],
    methodology:
      "Recorte exploratorio; a NCM identifica produto relacionado a transicao, nao a rota de emissao.",
  },
  {
    id: "methanol",
    name: "Metanol",
    shortDescription: "Derivado quimico com uso industrial e potencial em rotas de combustiveis de baixo carbono.",
    chain: "Combustiveis de transicao",
    productionStage: "Intermediario industrial",
    metrics: {
      imports: 640000000,
      exports: 92000000,
      externalDependency: 54,
      hhi: 1720,
      mainSupplier: { country: "Chile", share: 16 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["290511"],
      ncm: ["29051100"],
      cnae: ["2011", "2029"],
      prodlist: ["2011.2090"],
    },
    sources: ["Comex Stat 2026 H1", "PIA-Produto 2024"],
  },
  {
    id: "hydrogen",
    name: "Hidrogenio",
    shortDescription: "Molecula base para rotas industriais, combustiveis sinteticos e descarbonizacao de insumos.",
    chain: "Hidrogenio e amonia",
    productionStage: "Molecula principal",
    metrics: {
      imports: 270131108,
      exports: 14628,
      externalDependency: 99,
      hhi: 4200,
      mainSupplier: { country: "United States", share: 28 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["280410"],
      ncm: ["28041000"],
      cnae: ["2011", "3520"],
      prodlist: ["2011.2040"],
    },
    sources: ["Comex Stat 2026 H1", "Estrutura analitica hidrogenio/amonia"],
    methodology:
      "A NCM mede hidrogenio comercial, mas nao distingue hidrogenio renovavel, eletrolitico, azul ou cinza sem fonte complementar.",
  },
  {
    id: "ammonia",
    name: "Amonia",
    shortDescription: "Intermediario quimico para fertilizantes e potencial vetor energetico/maritimo.",
    chain: "Hidrogenio e amonia",
    productionStage: "Derivado de hidrogenio",
    metrics: {
      imports: 3427110548,
      exports: 121808699,
      externalDependency: 97,
      hhi: 3920,
      mainSupplier: { country: "Trinidad and Tobago", share: 24 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["281410", "281420"],
      ncm: ["28141000", "28142000"],
      cnae: ["2011"],
      prodlist: ["2011.2050"],
    },
    sources: ["Comex Stat 2026 H1", "PIA-Produto 2024", "Estrutura analitica hidrogenio/amonia"],
    methodology:
      "A leitura separa molecula e derivados; a rota de baixa emissao depende de base complementar de plantas, capacidade e intensidade de emissoes.",
  },
  {
    id: "ethanol",
    name: "Etanol",
    shortDescription: "Biocombustivel brasileiro com conexao direta a rotas ATJ, quimica renovavel e combustiveis sinteticos.",
    chain: "Combustiveis de transicao",
    productionStage: "Molecula principal",
    metrics: {
      imports: 195733627,
      exports: 216511131,
      externalDependency: 47,
      hhi: 1280,
      mainSupplier: { country: "Brazil", share: 52 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["220710", "220720"],
      ncm: ["22071010", "22071090", "22072010"],
      cnae: ["1931", "1932"],
      prodlist: ["1931.2010"],
    },
    sources: ["Comex Stat 2026 H1", "Recortes combustiveis transicao"],
    methodology:
      "Recorte inclui etanol como molecula, insumo e aplicacao final; NCM nao certifica intensidade de emissao ou rota ATJ.",
  },
  {
    id: "saf",
    name: "SAF e combustiveis de aviacao",
    shortDescription: "Combustiveis sustentaveis de aviacao e insumos de HEFA, ATJ, FT e e-SAF.",
    chain: "Combustiveis de transicao",
    productionStage: "Aplicacao final",
    metrics: {
      imports: 390299495,
      exports: 1422570440,
      externalDependency: 22,
      hhi: 1640,
      mainSupplier: { country: "Brazil", share: 57 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["271019", "151800", "382600"],
      ncm: ["27101911", "15180090", "38260000"],
      cnae: ["1921", "1932", "2029"],
      prodlist: ["1921.2080", "1932.2010"],
    },
    sources: ["Comex Stat 2026 H1", "Recortes combustiveis transicao"],
    methodology:
      "A NCM de combustivel de aviacao nao separa produto fossil de SAF certificado; a leitura exige certificacao, blend, rota e intensidade de emissoes.",
  },
  {
    id: "maritime-low-emission-fuels",
    name: "Combustiveis maritimos de baixa emissao",
    shortDescription: "Amonia, metanol, biocombustiveis e combustiveis sinteticos para transporte maritimo.",
    chain: "Combustiveis de transicao",
    productionStage: "Aplicacao final",
    metrics: {
      imports: 398811256,
      exports: 101354414,
      externalDependency: 80,
      hhi: 2980,
      mainSupplier: { country: "China", share: 26 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["271019", "290511", "281410"],
      ncm: ["27101929", "29051100", "28141000"],
      cnae: ["1921", "2011"],
      prodlist: ["1921.2120", "2011.2050"],
    },
    sources: ["Comex Stat 2026 H1", "Recortes combustiveis transicao"],
    methodology:
      "Recorte exploratorio para bunkering e combustiveis maritimos; classificar baixa emissao requer rota, terminal, certificacao e intensidade well-to-wake.",
  },
  {
    id: "lithium-carbonate",
    name: "Carbonato de litio",
    shortDescription: "Insumo mineral estrategico para baterias, armazenamento e eletrificacao industrial.",
    chain: "Minerais criticos",
    productionStage: "Material refinado",
    metrics: {
      imports: 410000000,
      exports: 36000000,
      externalDependency: 72,
      hhi: 2860,
      mainSupplier: { country: "Chile", share: 42 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["283691"],
      ncm: ["28369100"],
      cnae: ["0899", "2019"],
      prodlist: ["2019.9040"],
    },
    sources: ["Comex Stat 2026 H1", "PIA-Produto 2024", "ANM/AMB complementar"],
    methodology:
      "Recorte analítico transversal de minerais críticos; a camada ANM/AMB qualifica materialidade, sem substituir PIA-Produto.",
  },
  {
    id: "rare-earth-magnets",
    name: "Imas permanentes e terras raras",
    shortDescription: "Componentes relevantes para motores eletricos, geradores e cadeias de transicao energetica.",
    chain: "Minerais criticos",
    productionStage: "Componente tecnologico",
    metrics: {
      imports: 590000000,
      exports: 44000000,
      externalDependency: 81,
      hhi: 3640,
      mainSupplier: { country: "China", share: 48 },
      confidenceLevel: "low",
    },
    technicalCodes: {
      hs: ["850511", "280530"],
      ncm: ["85051100", "28053090"],
      cnae: ["2599", "2651"],
      prodlist: ["2599.2120"],
    },
    sources: ["Comex Stat 2026 H1", "PIA-Produto 2024", "ANM/AMB complementar"],
    methodology:
      "Agrupamento conceitual sujeito a validacao especialista, pois NCMs de componentes podem combinar usos energeticos e usos industriais gerais.",
  },
  {
    id: "green-steel-iron",
    name: "Ferro e aco verde",
    shortDescription: "Base mineral exportadora com oportunidade em pelotizacao, reducao direta e siderurgia com hidrogenio.",
    chain: "Minerais criticos",
    productionStage: "Mineral primario e liga",
    metrics: {
      imports: 197130583,
      exports: 16371720103,
      externalDependency: 1,
      hhi: 980,
      mainSupplier: { country: "Brazil", share: 81 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["2601", "7201", "7202"],
      ncm: ["26011100", "26011200", "72011000"],
      cnae: ["0710", "2411", "2412"],
      prodlist: ["0710.2010", "2411.2010"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas", "ANM/AMB complementar"],
    methodology:
      "Grande base exportadora; o gargalo de transicao esta em reducao direta, H2 verde, acos especiais e componentes industriais.",
  },
  {
    id: "copper-electrification",
    name: "Cobre para eletrificacao",
    shortDescription: "Insumo sistemico para redes eletricas, motores, inversores, eolica, solar e veiculos eletricos.",
    chain: "Minerais criticos",
    productionStage: "Mineral, refino e condutores",
    metrics: {
      imports: 1992724108,
      exports: 4288057266,
      externalDependency: 32,
      hhi: 2140,
      mainSupplier: { country: "Chile", share: 35 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["2603", "7403", "7408"],
      ncm: ["26030090", "74031100", "74081100"],
      cnae: ["0729", "2441", "2733"],
      prodlist: ["2441.2010"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Prioridade alta por eletrificacao; a oportunidade brasileira esta em refino, fios, cabos, barramentos, motores e inversores.",
  },
  {
    id: "niobium-advanced-materials",
    name: "Nióbio e materiais avançados",
    shortDescription: "Especialidade brasileira para ligas, aços avançados, baterias com nióbio e supercondutores.",
    chain: "Minerais criticos",
    productionStage: "Liga e material avancado",
    metrics: {
      imports: 23157819,
      exports: 1510270097,
      externalDependency: 2,
      hhi: 760,
      mainSupplier: { country: "Brazil", share: 98 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["2615", "7202"],
      ncm: ["26159000", "72029300"],
      cnae: ["0729", "2424"],
      prodlist: ["2424.2030"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Especialidade brasileira; prioridade e diversificar aplicacoes alem do ferroniobio.",
  },
  {
    id: "phosphate-potash-fertilizers",
    name: "Fosfato e potassio para fertilizantes",
    shortDescription: "Cadeia critica para resiliencia agroindustrial, bioenergia e fertilizantes de baixo carbono.",
    chain: "Minerais criticos",
    productionStage: "Quimico mineral processado",
    metrics: {
      imports: 5883237780,
      exports: 138529648,
      externalDependency: 98,
      hhi: 4020,
      mainSupplier: { country: "Canada", share: 31 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["2510", "3104", "3105"],
      ncm: ["25102010", "31042090", "31053000"],
      cnae: ["0891", "2013"],
      prodlist: ["2013.2010"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Alta dependência importadora em fertilizantes; entra tanto em minerais estratégicos quanto em segurança produtiva da bioeconomia.",
  },
  {
    id: "silicon-solar-semiconductors",
    name: "Silicio para solar e semicondutores",
    shortDescription: "Cadeia de quartzo, silicio, polisilicio, wafers, celulas, modulos e eletronica de potencia.",
    chain: "Minerais criticos",
    productionStage: "Material processado e componente",
    metrics: {
      imports: 609190960,
      exports: 234193395,
      externalDependency: 72,
      hhi: 3380,
      mainSupplier: { country: "China", share: 52 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2506", "2804", "8541"],
      ncm: ["25061000", "28046100", "85414300"],
      cnae: ["0899", "2610"],
      prodlist: ["2610.2045"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Cadeia exemplar de salto entre base mineral, energia limpa e tecnologia; gargalo em polisilicio, wafers, celulas e modulos.",
  },
  {
    id: "aluminum-bauxite-electrification",
    name: "Aluminio e bauxita para eletrificacao",
    shortDescription: "Material intensivo em energia para cabos, redes, solar, eolica e veiculos leves.",
    chain: "Minerais criticos",
    productionStage: "Metal e semimanufaturado",
    metrics: {
      imports: 1052916398,
      exports: 2560498768,
      externalDependency: 29,
      hhi: 1860,
      mainSupplier: { country: "Brazil", share: 59 },
      confidenceLevel: "high",
    },
    technicalCodes: {
      hs: ["2606", "2818", "7601"],
      ncm: ["26060012", "28182010", "76011000"],
      cnae: ["0729", "2441"],
      prodlist: ["2441.2030"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Competitividade depende de energia limpa e adensamento em alumina, aluminio baixo carbono, extrudados, cabos e componentes.",
  },
  {
    id: "nickel-batteries-alloys",
    name: "Niquel para baterias e ligas",
    shortDescription: "Material para baterias NMC/NCA, aco inox, ligas industriais e rotas de hidrogenio.",
    chain: "Minerais criticos",
    productionStage: "Mineral e liga",
    metrics: {
      imports: 164076003,
      exports: 147067471,
      externalDependency: 53,
      hhi: 2420,
      mainSupplier: { country: "Canada", share: 21 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2604", "7502", "7505"],
      ncm: ["26040000", "75021010", "75051200"],
      cnae: ["0729", "2449"],
      prodlist: ["2449.2020"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Relevante para baterias de alta densidade e ligas; gargalo em sulfato de niquel, precursores catodicos e reciclagem.",
  },
  {
    id: "graphite-batteries",
    name: "Grafite para baterias",
    shortDescription: "Material de anodos, armazenamento estacionário, refratários e materiais avançados.",
    chain: "Minerais criticos",
    productionStage: "Material processado",
    metrics: {
      imports: 17742834,
      exports: 20212539,
      externalDependency: 47,
      hhi: 2760,
      mainSupplier: { country: "China", share: 45 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2504", "3801"],
      ncm: ["25041000", "38011000"],
      cnae: ["0899", "2399"],
      prodlist: ["2399.2090"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Gargalo global em anodos de baterias; Brasil tem potencial mineral, mas precisa purificacao e esferizacao battery grade.",
  },
  {
    id: "cobalt-batteries",
    name: "Cobalto para baterias",
    shortDescription: "Material critico global para baterias NMC/NCA, superligas, catalisadores e reciclagem.",
    chain: "Minerais criticos",
    productionStage: "Quimico e liga",
    metrics: {
      imports: 20952872,
      exports: 5542351,
      externalDependency: 79,
      hhi: 3580,
      mainSupplier: { country: "China", share: 36 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2605", "8105"],
      ncm: ["26050000", "81052010"],
      cnae: ["0729", "2449"],
      prodlist: ["2449.2090"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Comércio brasileiro observado é baixo, mas a criticidade global justifica monitoramento de refino, sais e reciclagem.",
  },
  {
    id: "manganese-batteries-steel",
    name: "Manganes para baterias e aco",
    shortDescription: "Material para baterias LMFP/NMC, ligas e aços especiais.",
    chain: "Minerais criticos",
    productionStage: "Mineral, liga e quimico",
    metrics: {
      imports: 37613653,
      exports: 84207030,
      externalDependency: 31,
      hhi: 1980,
      mainSupplier: { country: "Brazil", share: 62 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2602", "8111"],
      ncm: ["26020010", "81110010"],
      cnae: ["0729", "2424"],
      prodlist: ["2424.2050"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Pode ganhar relevancia com quimicas de bateria mais intensivas em manganes; gargalo em grau bateria e precursores.",
  },
  {
    id: "tantalum-tin-electronics",
    name: "Tantalo e estanho para eletronica",
    shortDescription: "Base para capacitores, soldas, componentes eletronicos e rastreabilidade de materiais.",
    chain: "Minerais criticos",
    productionStage: "Metal e componente",
    metrics: {
      imports: 10037411,
      exports: 235054665,
      externalDependency: 4,
      hhi: 1450,
      mainSupplier: { country: "Brazil", share: 79 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2609", "2615", "8001"],
      ncm: ["26090000", "26159000", "80011000"],
      cnae: ["0729", "2449"],
      prodlist: ["2449.2110"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Importante para complexidade tecnologica; adensamento passa por refino, capacitores, soldas e componentes.",
  },
  {
    id: "vanadium-storage-steel",
    name: "Vanadio para armazenamento e aco",
    shortDescription: "Opcao para baterias de fluxo, armazenamento estacionario e aços de alto desempenho.",
    chain: "Minerais criticos",
    productionStage: "Quimico e liga",
    metrics: {
      imports: 8271857,
      exports: 81749614,
      externalDependency: 9,
      hhi: 1580,
      mainSupplier: { country: "Brazil", share: 68 },
      confidenceLevel: "medium",
    },
    technicalCodes: {
      hs: ["2615", "2825", "7202"],
      ncm: ["26159000", "28253010", "72029200"],
      cnae: ["0729", "2424"],
      prodlist: ["2424.2090"],
    },
    sources: ["Comex Stat 2026 H1", "Cadeias minerais estrategicas"],
    methodology:
      "Relevante para eletrolitos de baterias de fluxo, oxidos e ligas especiais; prioridade media com potencial tecnologico.",
  },
];

export const territories: readonly SelectOption[] = [
  ["all", "Todos"],
  ...Array.from(
    new Map(products.map((product) => [supplierTerritory(product.metrics.mainSupplier.country), product.metrics.mainSupplier.country])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1])),
];

export function productOptionsForChain(chain: string): readonly SelectOption[] {
  const chainLabel = chainAliases[chain];
  const visibleProducts = chain === "all" || !chainLabel ? products : products.filter((product) => product.chain === chainLabel);

  return [["all", "Todos"], ...visibleProducts.map((product) => [product.id, product.name] as const)];
}

export function supplierTerritory(country: string) {
  return (
    {
      Russia: "RU",
      "Trinidad and Tobago": "TT",
      Chile: "CL",
      China: "CN",
      Brazil: "BR",
      Canada: "CA",
      "United States": "US",
    }[country] ?? "all"
  );
}

export function supplierCoordinates(country: string): [number, number] {
  const coordinates: Record<string, [number, number]> = {
    Russia: [96, 61.5],
    "Trinidad and Tobago": [-61.2, 10.5],
    Chile: [-71.5, -35.7],
    China: [104.2, 35.9],
    Brazil: [-53.2, -10.3],
    Canada: [-106.3, 56.1],
    "United States": [-98.6, 39.8],
  };

  return coordinates[country] ?? [-53.2, -10.3];
}
