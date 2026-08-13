"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  Component,
  Cpu,
  Factory,
  Layers,
  Lock,
  Plug,
  Recycle,
  ShieldAlert,
  Search,
  ChevronDown,
  Check,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import type { ElementType } from "react";
import type { SolarInputMetric } from "../types/solar-sovereignty";
import { transitionFuelDestinations } from "../lib/transitionFuelTopology";
import { SAMPLE_SHIPMENT_THRESHOLD_USD } from "./SovereigntySankeyChart";

type SupplyNode = {
  id: string;
  name: string;
  country: string;
  flag: string;
  stage: string;
  description: string;
  isCritical: boolean;
  isVulnerable: boolean;
  alertMessage?: string;
  relatedInputs?: string[];
  relatedDestinations?: string[];
  icon: ElementType;
};

// Classificação por produção doméstica ativa (PIA): SEGURO = capacidade nacional consolidada,
// IMPORTACAO = sem produção nacional relevante (exposição cambial/aduaneira), FORNECIMENTO =
// capacidade nacional parcial/emergente (risco de disponibilidade, não de câmbio).
type RiscoParalelo = "FORNECIMENTO" | "IMPORTACAO" | "SEGURO";

type ParallelInput = {
  id: string;
  name: string;
  risk: RiscoParalelo;
  description: string;
  /** Present when the item sits outside the silicon/PV semiconductor NCM
   * chapter (8541) -- flags it explicitly so it isn't silently folded into
   * the chain's own mass/value balance. */
  ncmOutsideChain?: string;
  icon: ElementType;
};

type ValueChain = {
  id: string;
  name: string;
  category: string;
  hhiGlobal: string;
  primaryVulnerability: string;
  nodes: SupplyNode[];
  parallelInputs?: ParallelInput[];
};

const number = new Intl.NumberFormat("pt-BR");

// Matches the band language already used by this component's own hardcoded
// hhiGlobal strings (e.g. "9.100 · alto risco", "7.800 · risco moderado-alto").
function hhiRiskDescriptor(hhi: number): string {
  if (hhi >= 8000) return "alto risco";
  if (hhi >= 5000) return "risco moderado-alto";
  if (hhi >= 2500) return "risco moderado";
  return "risco controlado";
}

const parallelRiskLabel: Record<RiscoParalelo, string> = {
  FORNECIMENTO: "Atenção de Fornecimento",
  IMPORTACAO: "Atenção de Importação",
  SEGURO: "Nacional / Seguro",
};

const parallelRiskClass: Record<RiscoParalelo, string> = {
  FORNECIMENTO: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  IMPORTACAO: "border-red-500/30 bg-red-500/10 text-red-300",
  SEGURO: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

const solarNodes: SupplyNode[] = [
  {
    id: "quartzo_silica_br",
    name: "Quartzo / Sílica",
    country: "Brasil",
    flag: "🇧🇷",
    stage: "Extração",
    description: "Matéria-prima abundante no território nacional.",
    relatedInputs: ["Quartzo de alta pureza", "Sílica industrial", "Energia e logística mineral"],
    isCritical: false,
    isVulnerable: false,
    icon: Factory,
  },
  {
    id: "silicio_grau_metalurgico_br",
    name: "Silício Grau Metalúrgico / Si-GM",
    country: "Brasil",
    flag: "🇧🇷",
    stage: "Processamento",
    description: "Redução carbotérmica inicial da sílica.",
    relatedInputs: ["Quartzo de alta pureza", "Carvão vegetal e redutores", "Eletrodos de carbono", "Energia elétrica"],
    isCritical: false,
    isVulnerable: false,
    icon: Layers,
  },
  {
    id: "polissilicio_cn",
    name: "Polissilício",
    country: "China",
    flag: "🇨🇳",
    stage: "Refinamento",
    description: "Purificação de grau solar em alta pureza.",
    isCritical: true,
    isVulnerable: false,
    alertMessage:
      "Alerta HHI Extremo: monopólio chinês de mais de 97% na produção global de wafers.",
    relatedInputs: ["Silício grau metalúrgico", "Triclorossilano", "Hidrogênio de alta pureza", "Ácido clorídrico", "Reatores de deposição"],
    icon: Cpu,
  },
  {
    id: "lingotes_silicio_cn",
    name: "Lingotes de Silício (Cz)",
    country: "China",
    flag: "🇨🇳",
    stage: "Cristalização",
    description: "Crescimento de lingotes monocristalinos pelo processo Czochralski, etapa intensiva em corte e controle de estrutura cristalina anterior ao fatiamento.",
    isCritical: true,
    isVulnerable: true,
    alertMessage:
      "Concentração Geopolítica: a etapa de crescimento de lingotes (Cz) está na mesma geografia e cadeia de fornecedores dos wafers, herdando sua concentração extrema na China.",
    relatedInputs: ["Polissilício solar", "Cadinho de quartzo", "Fornos de crescimento Cz", "Fio diamantado"],
    icon: Layers,
  },
  {
    id: "wafers_fotovoltaicos_cn",
    name: "Wafers Fotovoltaicos",
    country: "China",
    flag: "🇨🇳",
    stage: "Componentes avançados",
    description: "Fatiamento de lingotes em wafers para células solares.",
    isCritical: true,
    isVulnerable: true,
    alertMessage:
      "Risco Geopolítico Crítico: A China detém o monopólio extremo de mais de 97% da capacidade mundial de produção de Wafers fotovoltaicos, criando um estrangulamento de soberania para a montagem nacional.",
    relatedInputs: ["Lingotes monocristalinos", "Cadinho de quartzo", "Fio diamantado", "Equipamentos de corte e limpeza"],
    icon: ShieldAlert,
  },
  {
    id: "celulas_fotovoltaicas_cn",
    name: "Células Fotovoltaicas",
    country: "China",
    flag: "🇨🇳",
    stage: "Produção de células",
    description: "Conversão do wafer em junção p-n semicondutora (dopagem, difusão, deposição) -- etapa de fabricação de semicondutores que o Brasil não possui.",
    isCritical: true,
    isVulnerable: true,
    alertMessage:
      "Gargalo de Soberania: o Brasil não possui fabricação de células fotovoltaicas (conversão wafer → junção p-n); toda a montagem nacional de módulos depende de células importadas.",
    relatedInputs: ["Wafers fotovoltaicos", "Pasta de prata", "Reatores de difusão e deposição"],
    icon: Cpu,
  },
  {
    id: "modulos_fotovoltaicos_br",
    name: "Módulos Fotovoltaicos",
    country: "Brasil",
    flag: "🇧🇷",
    stage: "Montagem",
    description: "Encapsulamento e montagem final de módulos a partir de células majoritariamente importadas -- capacidade nacional real, mas não elimina a dependência a montante.",
    relatedInputs: ["Células fotovoltaicas", "Vidro solar", "Encapsulantes EVA/POE", "Fitas de cobre", "Molduras de alumínio", "Backsheet", "Caixa de junção"],
    isCritical: false,
    isVulnerable: false,
    icon: Zap,
  },
];

const valueChains: ValueChain[] = [
  {
    id: "solar-pv",
    name: "Sistema Solar Fotovoltaico",
    category: "Energia solar e fotovoltaica",
    hhiGlobal: "9.100 · alto risco",
    primaryVulnerability: "Wafers fotovoltaicos — China (97%)",
    nodes: solarNodes,
    parallelInputs: [
      {
        id: "vidro_temperado",
        name: "Vidros Temperados de Segurança",
        risk: "FORNECIMENTO",
        description: "Cobertura frontal dos módulos, exige disponibilidade de capacidade fabril e logística de grandes volumes.",
        icon: Component,
      },
      {
        id: "inversores_solares",
        name: "Inversores Solares",
        risk: "IMPORTACAO",
        description: "Conversão CC/CA da geração fotovoltaica, majoritariamente importada da China. Segundo a ABSOLAR, fabricantes instalados no Brasil produzem menos de 5% do que o setor solar demanda.",
        ncmOutsideChain: "NCM 8504.40.90 -- eletrônica de potência, fora do capítulo 8541 (semicondutores) da cadeia de silício",
        icon: Zap,
      },
      {
        id: "fios_cobre",
        name: "Fios de Cobre",
        risk: "SEGURO",
        description: "Condutores elétricos do sistema, com capacidade produtiva doméstica consolidada.",
        icon: Cable,
      },
    ],
  },
  {
    id: "onshore-wind",
    name: "Tecnologias Eólicas Onshore",
    category: "Energia eólica",
    hhiGlobal: "7.800 · risco moderado-alto",
    primaryVulnerability: "Ímãs permanentes de terras raras",
    nodes: [
      {
        id: "terras_raras_br",
        name: "Terras Raras",
        country: "Brasil",
        flag: "🇧🇷",
        stage: "Extração",
        description: "Reservas nacionais de neodímio e praseodímio em desenvolvimento.",
        isCritical: false,
        isVulnerable: false,
        icon: Factory,
      },
      {
        id: "oxidos_cn",
        name: "Separação e Óxidos",
        country: "China",
        flag: "🇨🇳",
        stage: "Processamento",
        description: "Refino químico e separação de terras raras pesadas.",
        isCritical: true,
        isVulnerable: false,
        alertMessage: "Concentração superior a 85% no refino químico asiático.",
        icon: Layers,
      },
      {
        id: "imas_cn",
        name: "Ligas e Ímãs Permanentes",
        country: "China",
        flag: "🇨🇳",
        stage: "Componentes avançados",
        description: "Ímãs de alta potência empregados nos geradores eólicos.",
        isCritical: true,
        isVulnerable: true,
        alertMessage: "Cerca de 90% dos ímãs de geradores depende da cadeia chinesa.",
        icon: ShieldAlert,
      },
      {
        id: "aerogeradores_br",
        name: "Nacelles e Torres",
        country: "Brasil",
        flag: "🇧🇷",
        stage: "Produto final",
        description: "Montagem de aerogeradores no parque industrial nacional.",
        isCritical: false,
        isVulnerable: false,
        icon: Zap,
      },
    ],
  },
  {
    id: "battery-storage",
    name: "Baterias de Íons de Lítio",
    category: "Armazenamento e eletromobilidade",
    hhiGlobal: "8.800 · alto risco",
    primaryVulnerability: "Cátodos e refino químico de lítio",
    nodes: [
      {
        id: "litio_br",
        name: "Lítio Primário",
        country: "Brasil",
        flag: "🇧🇷",
        stage: "Extração",
        description: "Extração de espodumênio no Vale do Lítio em Minas Gerais.",
        isCritical: false,
        isVulnerable: false,
        icon: Factory,
      },
      {
        id: "litio_quimico_cn",
        name: "Lítio Grau Bateria",
        country: "China",
        flag: "🇨🇳",
        stage: "Refinamento",
        description: "Conversão química para carbonato e hidróxido de alta pureza.",
        isCritical: true,
        isVulnerable: false,
        alertMessage: "A China controla mais de 70% da capacidade global de refino químico.",
        icon: Cpu,
      },
      {
        id: "catodos_cn",
        name: "Precursores e Cátodos",
        country: "China",
        flag: "🇨🇳",
        stage: "Componentes avançados",
        description: "Síntese de materiais ativos para químicas NMC e LFP.",
        isCritical: true,
        isVulnerable: true,
        alertMessage: "Dependência superior a 80% em precursores catódicos importados.",
        icon: ShieldAlert,
      },
      {
        id: "packs_br",
        name: "Packs de Baterias",
        country: "Brasil",
        flag: "🇧🇷",
        stage: "Produto final",
        description: "Integração para armazenamento estacionário e veículos elétricos.",
        isCritical: false,
        isVulnerable: false,
        icon: Zap,
      },
    ],
  },
  {
    id: "transition-fuels",
    name: "Combustíveis de Transição",
    category: "Combustíveis de baixo carbono",
    hhiGlobal: "em homologação",
    primaryVulnerability: "insumos importados com maior dependência no diagnóstico comercial",
    nodes: [
      { id: "fuel_feedstocks_br", name: "Biomassa e Insumos", country: "Brasil", flag: "🇧🇷", stage: "Insumo", description: "Base agroindustrial, resíduos e insumos necessários às rotas de baixo carbono.", relatedInputs: ["Gás natural / proxy biometano"], isCritical: false, isVulnerable: false, icon: Factory },
      { id: "fuel_conversion_br", name: "Conversão e Bioprocessos Nacional", country: "Brasil", flag: "🇧🇷", stage: "Insumo", description: "Fermentação e transesterificação com base agroindustrial consolidada -- rota de baixo carbono já operada em escala no Brasil.", relatedInputs: ["Etanol", "Biodiesel"], isCritical: false, isVulnerable: false, icon: Layers },
      { id: "fuel_conversion_imported", name: "Moléculas de Base Importadas", country: "Múltiplas origens", flag: "🌐", stage: "Insumo", description: "Hidrogênio, amônia e metanol comercializados hoje dependem majoritariamente de produção ou insumo importado, mesmo quando servem de base a rotas de baixo carbono.", relatedInputs: ["Hidrogênio", "Amônia", "Metanol"], isCritical: true, isVulnerable: true, alertMessage: "O diagnóstico comercial mostra dependência externa elevada para amônia e metanol e ausência de produção doméstica comparável para hidrogênio -- diferente da rota consolidada de etanol/biodiesel.", icon: ShieldAlert },
      { id: "fuel_advanced_inputs", name: "Tecnologias de Conversão", country: "Múltiplas origens", flag: "🌐", stage: "Tecnologia habilitadora", description: "Catalisadores, enzimas e eletrolisadores condicionam a escala, a produtividade e a intensidade de carbono das rotas.", relatedInputs: ["Enzimas e biocatalisadores", "Catalisadores preparados", "Eletrolisadores / proxy de equipamentos"], isCritical: true, isVulnerable: true, alertMessage: "Evidência disponível: a IEA estima que a China reúne quase 60% da capacidade mundial de fabricação de eletrolisadores. Essa é uma concentração geográfica publicada, não um HHI por empresa. Para enzimas e catalisadores, a leitura permanece baseada na dependência e nos fornecedores observados nas importações brasileiras.", icon: ShieldAlert },
      { id: "fuel_final_br", name: "Combustíveis e Usos Finais", country: "Brasil", flag: "🇧🇷", stage: "Aplicação final", description: "Hidrogênio renovável, SAF, biometano e e-combustíveis abastecem aviação, indústria e transporte pesado.", relatedInputs: ["Combustíveis de aviação / proxy SAF"], relatedDestinations: transitionFuelDestinations, isCritical: false, isVulnerable: false, icon: Zap },
    ],
  },
  {
    id: "strategic-fertilizers",
    name: "Fertilizantes Estratégicos",
    category: "Segurança produtiva",
    hhiGlobal: "em homologação",
    primaryVulnerability: "nutrientes e intermediários com alta exposição externa",
    nodes: [
      { id: "fertilizer_resources", name: "Recursos Minerais e Gás", country: "Brasil", flag: "🇧🇷", stage: "Matéria-prima", description: "Gás natural, rocha fosfática e recursos potássicos formam a base da cadeia.", relatedInputs: ["Gás natural", "Rocha fosfática"], isCritical: false, isVulnerable: false, icon: Factory },
      { id: "fertilizer_intermediates", name: "Intermediários Químicos", country: "Múltiplas origens", flag: "🌐", stage: "Insumo", description: "Amônia, ureia, ácido fosfórico e sais potássicos concentram a exposição comercial.", relatedInputs: ["Amônia", "Ureia fertilizante", "Sulfato de amônio", "Fosfato diamônico (DAP)", "Fosfato monoamônico (MAP)", "Superfosfatos", "Cloreto de potássio"], isCritical: true, isVulnerable: true, alertMessage: "O grau de dependência e concentração varia por nutriente e deve ser consultado no diagnóstico abaixo.", icon: ShieldAlert },
      { id: "fertilizer_blending_br", name: "Formulação e Mistura", country: "Brasil", flag: "🇧🇷", stage: "Transformação", description: "Mistura, granulação e formulação adaptam nutrientes às necessidades agronômicas.", relatedInputs: ["Fertilizantes NPK"], isCritical: false, isVulnerable: false, icon: Layers },
      { id: "fertilizer_use_br", name: "Oferta ao Setor Agropecuário", country: "Brasil", flag: "🇧🇷", stage: "Transformação", description: "Distribuição e aplicação conectam a segurança de suprimento à produção de alimentos.", isCritical: false, isVulnerable: false, icon: Zap },
    ],
  },
  {
    id: "green-steel",
    name: "Aço e Materiais Estratégicos",
    category: "Descarbonização industrial",
    hhiGlobal: "em homologação",
    primaryVulnerability: "ligas, insumos e equipamentos críticos indicados pelo diagnóstico comercial",
    nodes: [
      { id: "steel_inputs_br", name: "Insumos Primários e Redutores", country: "Brasil + importado", flag: "🇧🇷🌐", stage: "Carga primária", description: "Minério de ferro extraído e beneficiado no Brasil (mineração física, sem feedstock fóssil no minério em si) e carvão mineral/coque importado (EUA, Austrália e Colômbia respondem por ~81%, sem concentração dominante de um único país) -- maior componente de valor da pauta de importação da cadeia (~US$2 bi), exposto ao CBAM europeu. Contrasta com o carvão vegetal (biorredução), rota de baixo carbono estruturalmente doméstica do Brasil, que não cruza fronteira em volume comparável para virar uma métrica de comércio exterior própria. Minério e carvão são insumos concomitantes (entram juntos na carga), não uma sequência entre si.", relatedInputs: ["Minério de ferro", "Carvão mineral e coque siderúrgico"], isCritical: false, isVulnerable: false, icon: Factory },
      { id: "steel_scrap_br", name: "Sucata Ferrosa", country: "Brasil", flag: "🇧🇷", stage: "Insumo reciclado", description: "Sucata ferrosa reciclada, insumo da rota elétrica (EAF) -- pegada de carbono muito menor que a rota primária a carvão. O Brasil exportou cerca de 32x mais sucata do que importou no período mapeado, sinalizando potencial de reciclagem doméstica ainda não totalmente aproveitado.", relatedInputs: ["Sucata ferrosa"], isCritical: false, isVulnerable: false, icon: Recycle },
      { id: "steel_reduction_br", name: "Redução e Aciaria", country: "Brasil", flag: "🇧🇷", stage: "Transformação", description: "Altos-fornos a coque/carvão mineral importado, redução direta e fornos elétricos convertem a carga em aço bruto. O carvão vegetal (biorredução), rota de baixo carbono estruturalmente doméstica do Brasil, não aparece como insumo comercial rastreável nesta base -- não cruza fronteira em volume comparável ao redutor fóssil importado, então é um dado de contexto/produção, não uma métrica AIPNET de comércio exterior. Fundentes (calcário/dolomita) e gás natural (redutor da rota DRI) também compõem o processo, mas com comércio exterior real e marginal demais (calcário) ou impossível de atribuir por NCM (gás natural, cesta multiuso) para virar insumo AIPNET próprio.", relatedInputs: ["Ferro-gusa", "Ferro-esponja e redução direta"], isCritical: false, isVulnerable: false, icon: Layers },
      { id: "steel_alloys_global", name: "Ligas e Tecnologia de Processo", country: "Múltiplas origens", flag: "🌐", stage: "Transformação", description: "Ferroligas, refratários e equipamentos condicionam qualidade e descarbonização.", relatedInputs: ["Ferroligas", "Eletrodos de grafite", "Materiais refratários"], isCritical: true, isVulnerable: true, alertMessage: "Itens críticos são identificados pelo risco comercial observado; a topologia não atribui concentração sem homologação.", icon: ShieldAlert },
      { id: "steel_products_br", name: "Aços e Bens da Transição", country: "Brasil", flag: "🇧🇷", stage: "Equipamento e uso final", description: "Chapas, tubos, cabos e estruturas abastecem energia, mobilidade e infraestrutura verde.", relatedInputs: ["Laminados planos a quente", "Laminados planos a frio", "Tubos de aço", "Estruturas de aço"], isCritical: false, isVulnerable: false, icon: Zap },
    ],
  },
];

export type AipnetAnalysisFocus = { nodeId: string; stage: string; input?: string };

const nodeInputStages: Record<string, string[]> = {
  quartzo_silica_br: ["extracao"],
  silicio_grau_metalurgico_br: ["processamento"],
  polissilicio_cn: ["refinamento"],
  lingotes_silicio_cn: ["componentes_avancados"],
  wafers_fotovoltaicos_cn: ["componentes_avancados"],
  celulas_fotovoltaicas_cn: ["produto_final"],
  modulos_fotovoltaicos_br: ["produto_final"],
  fuel_feedstocks_br: ["insumos"],
  fuel_advanced_inputs: ["insumos_tecnologicos", "equipamentos"],
  fuel_final_br: ["aplicacoes_finais"],
  fertilizer_resources: ["materias_primas"],
  fertilizer_intermediates: ["intermediarios", "nitrogenados", "fosfatados", "potassicos"],
  fertilizer_blending_br: ["formulacao"],
  steel_inputs_br: ["base_mineral", "reducao"],
  steel_scrap_br: ["base_mineral"],
  steel_reduction_br: ["reducao"],
  steel_alloys_global: ["aciaria"],
  steel_products_br: ["transformacao", "bens_transicao"],
};

// Only steel's base_mineral stage holds two distinct inputs (minério de
// ferro, sucata ferrosa) that need their own dedicated nodes -- every other
// chain's nodeInputStages entry already maps 1:1 (or many-inputs-to-one on
// purpose, e.g. fertilizer_intermediates) onto a single node, so this exact
// input_id filter only needs entries for the two steel nodes that split a
// shared stage.
const nodeInputIds: Record<string, string[]> = {
  steel_inputs_br: ["minerio_ferro", "carvao_mineral_coque"],
  steel_scrap_br: ["sucata_ferrosa"],
  steel_reduction_br: ["ferro_gusa", "ferro_esponja"],
};

const dashboardChainMap: Record<string, string> = {
  silicio: "solar-pv",
  combustiveis_transicao: "transition-fuels",
  fertilizantes: "strategic-fertilizers",
  aco: "green-steel",
  eolica: "onshore-wind",
  baterias: "battery-storage",
};

export function AipnetSystemsFlow({ chainId, inputs = [], onAnalysisFocus, onViewFlowEvidence }: { chainId?: string; inputs?: SolarInputMetric[]; onAnalysisFocus?: (focus: AipnetAnalysisFocus) => void; onViewFlowEvidence?: () => void }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedChainId, setSelectedChainId] = useState(valueChains[0].id);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const activeChainId = chainId ? dashboardChainMap[chainId] ?? selectedChainId : selectedChainId;
  const currentChain = valueChains.find((chain) => chain.id === activeChainId) ?? valueChains[0];
  const resolvedNodes = currentChain.nodes.map((node) => {
    const stages = nodeInputStages[node.id];
    if (!inputs.length || !stages?.length) return node;
    const ids = nodeInputIds[node.id];
    const relatedInputs = inputs
      .filter((input) => stages.includes(input.stage) && (!ids || ids.includes(input.input_id)))
      .map((input) => input.label);
    return relatedInputs.length ? { ...node, relatedInputs } : node;
  });

  useEffect(() => {
    setSelectedNodeId(null);
    setIsPickerOpen(false);
  }, [chainId]);
  const selectedNode = resolvedNodes.find((node) => node.id === selectedNodeId) ?? null;
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");
  const filteredChains = valueChains.filter((chain) =>
    `${chain.name} ${chain.category}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery),
  );

  function computeTopExposure(inputSet: SolarInputMetric[]) {
    return [...inputSet]
      .map((input) => ({
        input,
        value: input.external_dependency ?? input.global_china_share ?? input.china_share_brazilian_imports,
        // global_china_share is a structural figure, not derived from Brazil's
        // own trade sample -- the other two are, so they need the materiality
        // floor or a near-empty trade record (e.g. ferro-esponja's $3,559
        // total import base) can win this "maior exposição mensurada" banner
        // on a percentage that isn't a real signal.
        isSampleDerived: input.external_dependency !== null || input.global_china_share === null,
        metric: input.external_dependency !== null
          ? "dependência externa"
          : input.global_china_share !== null
            ? "concentração geográfica global"
            : "participação chinesa nas importações",
      }))
      .filter((item) => !item.isSampleDerived || item.input.imports_value_usd >= SAMPLE_SHIPMENT_THRESHOLD_USD)
      // Same collapse as buildSectorExecutiveHeroAlert in MainAnalyticalDashboard.tsx:
      // apparent consumption (production + imports - exports) can go near-zero
      // for export-dominant inputs, sending external_dependency past 100% (e.g.
      // aco's ferroligas hit 354x). The display below already clamps to 1 before
      // formatting, but the sort itself compared raw values, so the broken
      // multiple still won this banner (and, via dynamicHhiGlobal, the header
      // HHI badge) over genuinely higher-risk inputs.
      .sort((left, right) => Math.min(right.value, 1) - Math.min(left.value, 1))[0];
  }

  // dynamicHhiGlobal (header badge) stays chain-wide regardless of selection --
  // it's labeled "Concentração global", not per-stage. Only the bridge banner
  // below narrows to the selected stage's own inputs, so clicking through
  // etapas 1-4 actually changes what "maior exposição mensurada" reports
  // instead of always repeating the chain-wide figure.
  const chainTopExposure = computeTopExposure(inputs);
  const selectedStageInputs = selectedNodeId
    ? inputs.filter((input) => nodeInputStages[selectedNodeId]?.includes(input.stage))
    : [];
  const selectedStageTopExposure = selectedStageInputs.length ? computeTopExposure(selectedStageInputs) : undefined;
  const topExposure = selectedStageTopExposure ?? chainTopExposure;
  // fertilizantes/combustiveis_transicao/aco shipped with a static "em
  // homologação" placeholder for hhiGlobal from before real per-input HHI
  // data existed for them -- it's stale now that supplier_hhi_brazil is
  // real and populated (e.g. eletrodos de grafite genuinely computes to
  // 7557). Compute a real header figure from the same materiality-gated
  // topExposure input already derived above instead of leaving the
  // placeholder up once the underlying data exists.
  const dynamicHhiGlobal = currentChain.hhiGlobal === "em homologação" && chainTopExposure
    ? `${number.format(Math.round(chainTopExposure.input.supplier_hhi_brazil))} · ${hhiRiskDescriptor(chainTopExposure.input.supplier_hhi_brazil)}`
    : currentChain.hhiGlobal;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 text-zinc-100 shadow-2xl backdrop-blur-xl md:p-8">
      <div className="pointer-events-none absolute left-[65%] top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/5 blur-3xl" />

      <header className="relative mb-8 flex flex-col justify-between gap-4 border-b border-zinc-800/80 pb-6 md:flex-row md:items-end">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            AIPNET · Geopolítica de Estado
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Plataforma analítica de soberania produtiva
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            {chainId ? "Conecte etapas produtivas e gargalos ao diagnóstico quantitativo desta cadeia." : "Compare border hops e gargalos estruturais nas cadeias da transição energética."}
          </p>
        </div>
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-right">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Concentração global
          </span>
          <strong className="font-mono text-sm text-red-300">HHI {dynamicHhiGlobal}</strong>
        </div>
      </header>

      <div className="relative z-40 mb-8 flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/45 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-cyan-300">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Cadeia ativa</span>
            <strong className="text-sm text-white">{currentChain.name}</strong>
          </div>
        </div>
        {!chainId ? <div className="relative md:w-96">
          <button
            type="button"
            aria-expanded={isPickerOpen}
            onClick={() => setIsPickerOpen((isOpen) => !isOpen)}
            className="flex w-full items-center justify-between rounded-xl border border-zinc-700/80 bg-zinc-950/80 px-4 py-2.5 text-left text-xs text-zinc-200 outline-none transition hover:border-zinc-500 focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span className="truncate">{currentChain.name}</span>
            <ChevronDown className={`h-4 w-4 transition ${isPickerOpen ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {isPickerOpen ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-full overflow-hidden rounded-2xl border border-zinc-700/80 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-2xl"
              >
                <label className="relative mb-2 block">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <span className="sr-only">Buscar cadeia</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar cadeia ou tecnologia..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-3 text-xs text-zinc-200 outline-none focus:border-cyan-500/50"
                  />
                </label>
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {filteredChains.map((chain) => (
                    <button
                      type="button"
                      key={chain.id}
                      onClick={() => {
                        setSelectedChainId(chain.id);
                        setIsPickerOpen(false);
                        setSearchQuery("");
                        setSelectedNodeId(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition ${chain.id === currentChain.id ? "border border-cyan-500/30 bg-cyan-500/10" : "hover:bg-zinc-900"}`}
                    >
                      <span><strong className="block text-zinc-100">{chain.name}</strong><span className="text-[10px] text-zinc-500">{chain.category}</span></span>
                      {chain.id === currentChain.id ? <Check className="h-4 w-4 text-cyan-300" /> : null}
                    </button>
                  ))}
                  {!filteredChains.length ? <p className="px-3 py-4 text-center text-xs text-zinc-500">Nenhuma cadeia encontrada.</p> : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div> : null}
      </div>

      <div className="relative mb-4 flex items-center gap-2">
        <Layers className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Espinha Dorsal de Transformação · {currentChain.name}
        </h3>
      </div>

      <AnimatePresence mode="wait">
      <motion.div key={currentChain.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`relative grid grid-cols-1 gap-4 ${resolvedNodes.length === 5 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        {resolvedNodes.map((node, index) => {
          const Icon = node.icon;
          const isChokepoint = node.isCritical;

          return (
            <div key={node.id} className="group/node relative flex">
              {index < resolvedNodes.length - 1 ? (
                <ArrowRight className="absolute -right-4 top-1/2 z-20 hidden h-5 w-5 -translate-y-1/2 text-zinc-600 md:block" />
              ) : null}

              {/* Tooltip de Estado — risco geopolítico do elo, em glassmorphism.
                  Suprimido quando o node está selecionado: o painel de
                  detalhamento abaixo já mostra o mesmo alertMessage, e o
                  cursor tende a continuar sobre o card logo após o clique
                  que selecionou, duplicando o texto na tela. */}
              {isChokepoint && node.alertMessage && selectedNodeId !== node.id ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 w-64 -translate-x-1/2 rounded-xl border border-red-500/30 bg-zinc-950/95 p-3.5 text-xs leading-relaxed text-zinc-200 opacity-0 shadow-2xl backdrop-blur-xl transition-opacity duration-200 group-hover/node:opacity-100 group-focus-within/node:opacity-100"
                >
                  <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-red-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Risco Geopolítico
                  </span>
                  {node.alertMessage}
                </div>
              ) : null}

              <motion.article
                tabIndex={0}
                role="button"
                aria-pressed={selectedNodeId === node.id}
                aria-label={`${node.stage}: ${node.name}, ${node.country}`}
                onClick={() => setSelectedNodeId((selectedId) => selectedId === node.id ? null : node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedNodeId((selectedId) => selectedId === node.id ? null : node.id);
                  }
                }}
                whileHover={{ scale: 1.025, y: -4 }}
                animate={
                  isChokepoint
                    ? {
                        borderColor: ["rgba(239,68,68,0.35)", "rgba(239,68,68,0.7)", "rgba(239,68,68,0.35)"],
                        boxShadow: [
                          "0 0 0px rgba(239,68,68,0)",
                          "0 0 20px rgba(239,68,68,0.22)",
                          "0 0 0px rgba(239,68,68,0)",
                        ],
                      }
                    : undefined
                }
                transition={isChokepoint ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" } : undefined}
                style={isChokepoint ? { borderWidth: 2, borderStyle: "solid" } : undefined}
                className={`relative flex min-h-64 w-full cursor-pointer flex-col rounded-2xl border p-5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-300 ${selectedNodeId === node.id ? "ring-2 ring-cyan-300/70" : ""} ${
                  isChokepoint
                    ? "bg-red-950/25"
                    : "border-white/[0.08] bg-zinc-900/40 backdrop-blur-xl hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full border border-zinc-700/70 bg-zinc-900/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    Etapa {index + 1}
                  </span>
                  <span className="text-xs text-zinc-300">{node.flag} {node.country}</span>
                </div>
                <div className="mt-5 flex items-start gap-3">
                  <div className={`rounded-xl border p-2.5 ${isChokepoint ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-cyan-500/25 bg-cyan-500/10 text-cyan-300"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{node.stage}</p>
                    <h3 className="mt-1 text-sm font-bold leading-snug text-white">{node.name}</h3>
                  </div>
                </div>
                <p className="mt-4 flex-1 text-xs leading-5 text-zinc-400">{node.description}</p>
                <div className="mt-4 border-t border-zinc-800/70 pt-3">
                  {isChokepoint ? (
                    <Status icon={ShieldAlert} label={node.isVulnerable ? "Gargalo de Soberania" : "Concentração Crítica"} className="text-red-300" />
                  ) : (
                    <Status icon={Lock} label="Capacidade Nacional" className="text-emerald-300" />
                  )}
                  {node.id === "steel_reduction_br" ? (
                    <div
                      className="mt-2.5 flex items-center gap-1.5 border-t border-zinc-800/50 pt-2.5 text-[10px] font-medium text-emerald-200/80"
                      title="Matriz elétrica nacional (SIN): >84% renovável (BEN/EPE). A rota elétrica (EAF, forno a arco) usa cerca de 1/8 da energia da rota integrada a coque -- comparação de intensidade energética por rota (IEA Iron and Steel Technology Roadmap / World Steel Association) disponível no balanço de massa e energia abaixo."
                    >
                      <Plug className="h-3.5 w-3.5 shrink-0" />
                      <span>Eletricidade da rede &gt;84% renovável (BEN/EPE) -- rota EAF ≈1/8 da energia da rota a coque</span>
                    </div>
                  ) : null}
                </div>
              </motion.article>
            </div>
          );
        })}
      </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedNode ? (
          <motion.aside
            key={selectedNode.id}
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            className="relative mt-8 overflow-hidden rounded-2xl border border-cyan-300/20 bg-zinc-950/75 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="max-w-3xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">Etapa selecionada · detalhe da cadeia</p>
                <h3 className="mt-2 text-xl font-bold text-white">{selectedNode.name}</h3>
                <p className="mt-1 text-xs text-zinc-500">{selectedNode.stage} · {selectedNode.country}</p>
                <p className="mt-4 text-sm leading-6 text-zinc-300">{selectedNode.description}</p>
                {selectedNode.alertMessage ? (
                  <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                    <p>{selectedNode.alertMessage}</p>
                  </div>
                ) : null}
                {selectedNode.relatedDestinations?.length ? (
                  <div className="mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Destinos e aplicações mapeados</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedNode.relatedDestinations.map((destination) => (
                        <span key={destination} className="rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-1.5 text-xs text-emerald-100">
                          {destination}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] leading-4 text-zinc-600">Os destinos são tecnológicos e qualitativos; a largura do Sankey representa a fatura de importação/exportação dos insumos, não a participação do consumo por modal.</p>
                  </div>
                ) : null}
                {selectedNode.relatedInputs?.length ? (
                  <div className="mt-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Insumos e componentes relacionados</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedNode.relatedInputs.map((input) => (
                        <button
                          type="button"
                          key={input}
                          onClick={() => onAnalysisFocus?.({ nodeId: selectedNode.id, stage: selectedNode.stage, input })}
                          className="rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-300/30 hover:bg-cyan-400/10 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        >
                          {input}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[10px] leading-4 text-zinc-600">Selecione um insumo para localizar sua evidência no diagnóstico de soberania.</p>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => onAnalysisFocus?.({ nodeId: selectedNode.id, stage: selectedNode.stage })}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  Ver diagnóstico desta etapa
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onAnalysisFocus?.({ nodeId: "all", stage: "Todas as etapas" })}
                  className="ml-2 mt-5 inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  Ver todas as etapas
                </button>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 md:w-72">
                <DetailMetric label="Posição" value={`Etapa ${resolvedNodes.findIndex((node) => node.id === selectedNode.id) + 1}`} />
                <DetailMetric label="Situação" value={selectedNode.isVulnerable ? "Gargalo" : selectedNode.isCritical ? "Crítica" : "Nacional"} />
                {structuralExposure(selectedNode.id) ? (
                  <DetailMetric label="Concentração" value={structuralExposure(selectedNode.id) ?? ""} className="col-span-2 text-red-300" />
                ) : null}
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* Renders after the selected-stage detail panel, not before it --
          this is a complement/unfold of the chain's parallel dependencies,
          not the primary content the user should read first. */}
      {currentChain.parallelInputs?.length ? (
        <div className="relative mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Component className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
              Insumos e Subcomponentes Paralelos
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {currentChain.parallelInputs.map((item) => {
              const ParallelIcon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 backdrop-blur-xl transition hover:border-white/20"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/80 p-2.5 text-zinc-300">
                      <ParallelIcon className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${parallelRiskClass[item.risk]}`}>
                      {parallelRiskLabel[item.risk]}
                    </span>
                  </div>
                  <h4 className="mt-4 text-sm font-bold text-white">{item.name}</h4>
                  <p className="mt-1.5 text-xs leading-5 text-zinc-400">{item.description}</p>
                  {item.ncmOutsideChain ? (
                    <p className="mt-2 border-t border-white/10 pt-2 font-mono text-[10px] leading-4 text-amber-300/80">
                      {item.ncmOutsideChain}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {topExposure ? (
        <div className="relative mt-10 flex flex-col gap-4 rounded-2xl border border-red-500/25 bg-zinc-950/65 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300">
                Ponte para o diagnóstico quantitativo
                {selectedStageTopExposure && selectedNode ? ` · ${selectedNode.name}` : ""}
              </p>
              <h3 className="mt-1 text-sm font-bold text-white">
                Maior exposição {selectedStageTopExposure ? "desta etapa" : "mensurada"}: {topExposure.input.label}
              </h3>
              <p className="mt-2 max-w-4xl text-xs leading-5 text-zinc-400">
                {topExposure.metric}: <strong className="font-mono text-red-300">{(Math.min(topExposure.value, 1) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>. Consulte fornecedores, HHI, comércio e ressalvas metodológicas no diagnóstico abaixo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onViewFlowEvidence?.()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Ver evidências
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function Status({ icon: Icon, label, className }: { icon: ElementType; label: string; className: string }) {
  return (
    <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function DetailMetric({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.07] bg-white/[0.04] p-3 ${className}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      <strong className="mt-1 block text-sm">{value}</strong>
    </div>
  );
}

function structuralExposure(nodeId: string) {
  if (nodeId === "polissilicio_cn") return "95% · HHI mínimo 9.025";
  if (nodeId === "lingotes_silicio_cn") return "97% · HHI mínimo 9.409";
  if (nodeId === "wafers_fotovoltaicos_cn") return "97% · HHI mínimo 9.409";
  return null;
}

export default AipnetSystemsFlow;
