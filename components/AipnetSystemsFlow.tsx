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

type DescriptionBullet = { label: string; text: string };

type SupplyNode = {
  id: string;
  name: string;
  country: string;
  flag: string;
  stage: string;
  description: string;
  // Optional scannable variants of `description` -- when present, the card
  // (cardBullets) and/or the detail drawer (detailBullets) render these as
  // a labeled list instead of the plain-paragraph `description`, which
  // still stays as the fallback for any node that doesn't set them.
  cardBullets?: DescriptionBullet[];
  detailBullets?: DescriptionBullet[];
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
    cardBullets: [
      { label: "🟢 Quartzito", text: "Superávit de US$94,9 mi -- extração nacional dominante, importação irrelevante (1,5% da amostra vem da China)." },
      { label: "🟢 Quartzo", text: "Superávit de US$15,0 mi, fornecedor pouco concentrado (0,5% China)." },
      { label: "Sílica Industrial", text: "Comércio marginal (déficit residual de US$1,3 mi) -- volume pequeno demais para sinalizar risco." },
    ],
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
    cardBullets: [
      { label: "🟢 Silício Grau Metalúrgico", text: "Superávit de US$211,2 mi -- Brasil é exportador líquido; a fração que é importada vem majoritariamente da China (84,1%), mas é pequena frente ao volume exportado." },
      { label: "🔴 Eletrodos de Carbono", text: "87,7% das importações vêm da China -- déficit de US$24,2 mi neste insumo de processo (redução carbotérmica)." },
    ],
    detailBullets: [
      { label: "🟢 Silício Grau Metalúrgico", text: "US$222,6 mi exportados contra US$11,4 mi importados -- saldo positivo de US$211,2 mi. Concentração de 84,1% China aplica-se só à fatia importada, residual frente à exportação." },
      { label: "🔴 Eletrodos de Carbono", text: "US$28,7 mi importados contra US$4,5 mi exportados -- déficit de US$24,2 mi, com 87,7% de origem chinesa. Insumo de processo (redutor), não o produto final da etapa." },
    ],
    relatedInputs: ["Quartzo de alta pureza", "Carvão vegetal e redutores", "Eletrodos de carbono", "Energia elétrica"],
    isCritical: true,
    isVulnerable: false,
    alertMessage: "O Si-GM em si é superavitário e soberano; o gargalo real desta etapa está nos eletrodos de carbono importados para a redução, concentrados na China.",
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
      "Alerta HHI Extremo: concentração global de 85% na produção de polissilício grau solar (estrutural, independente do volume ainda pequeno comercializado pelo Brasil).",
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
      "Risco Geopolítico Crítico: A China detém 95% da capacidade mundial de produção de Wafers fotovoltaicos, criando um estrangulamento de soberania para a montagem nacional.",
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
    cardBullets: [
      { label: "🔴 Módulo Fotovoltaico Pronto", text: "98,4% das importações vêm da China -- déficit de US$598,7 mi, o maior valor importado da cadeia inteira; 63,8% de dependência externa aparente." },
      { label: "🔴 Vidro Solar e Molduras de Alumínio", text: "87,1% e 82,0% de origem chinesa, respectivamente -- componentes de montagem também concentrados." },
      { label: "🟢 Fitas de Cobre", text: "Único item superavitário desta etapa (US$7,2 mi), com fornecedor menos concentrado (16,4% China)." },
    ],
    detailBullets: [
      { label: "🔴 Módulo Fotovoltaico Pronto", text: "US$598,9 mi importados contra US$0,26 mi exportados -- o Brasil monta parte da demanda internamente, mas importa o módulo já pronto em volume muito maior do que monta a partir de componentes." },
      { label: "🔴 Vidro Solar", text: "87,1% de origem chinesa, déficit de US$20,3 mi." },
      { label: "🔴 Molduras de Alumínio", text: "82,0% de origem chinesa, déficit de US$20,5 mi." },
      { label: "Encapsulantes EVA/POE", text: "Déficit de US$12,2 mi, concentração moderada (19,0% China)." },
      { label: "🟢 Fitas de Cobre", text: "Superávit de US$7,2 mi -- único componente de montagem em que o Brasil exporta mais do que importa." },
    ],
    relatedInputs: ["Células fotovoltaicas", "Vidro solar", "Encapsulantes EVA/POE", "Fitas de cobre", "Molduras de alumínio", "Backsheet", "Caixa de junção"],
    isCritical: true,
    isVulnerable: true,
    alertMessage: "A montagem final é onde a cadeia solar brasileira concentra o maior valor de importação: US$598,7 mi em módulos prontos, majoritariamente da China (98,4%), acima da soma de todos os componentes importados separadamente -- a 'capacidade nacional' de montagem convive com uma rota paralela de módulo importado pronto que hoje domina em valor.",
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
      { id: "fuel_feedstocks_br", name: "Biomassa e Insumos", country: "Brasil", flag: "🇧🇷", stage: "Insumo", description: "Base agroindustrial, resíduos e insumos necessários às rotas de baixo carbono.", cardBullets: [
        { label: "🔴 Gás Natural / Proxy Biometano", text: "Déficit de US$1,01 bi -- sem concentração chinesa (0% da amostra), mas dependente de importação para cobrir a demanda das rotas que usam gás como base." },
      ], relatedInputs: ["Gás natural / proxy biometano"], isCritical: true, isVulnerable: false, alertMessage: "Déficit real, mas de fornecedor diversificado -- não é uma concentração geográfica de risco.", icon: Factory },
      { id: "fuel_conversion_br", name: "Conversão e Bioprocessos Nacional", country: "Brasil", flag: "🇧🇷", stage: "Insumo", description: "Fermentação e transesterificação com base agroindustrial consolidada -- rota de baixo carbono já operada em escala no Brasil.", cardBullets: [
        { label: "🟢 Etanol", text: "Superávit de US$117,4 mi, sem concentração chinesa -- rota consolidada da agroindústria nacional." },
        { label: "🟢 Biodiesel", text: "Superávit de US$84,7 mi, comércio exterior praticamente sem participação chinesa." },
      ], relatedInputs: ["Etanol", "Biodiesel"], isCritical: false, isVulnerable: false, icon: Layers },
      { id: "fuel_conversion_imported", name: "Moléculas de Base Importadas", country: "Múltiplas origens", flag: "🌐", stage: "Insumo", description: "Hidrogênio, amônia e metanol comercializados hoje dependem majoritariamente de produção ou insumo importado, mesmo quando servem de base a rotas de baixo carbono.", cardBullets: [
        { label: "🔴 Metanol", text: "98,6% de dependência externa -- déficit de US$367,9 mi, a maior exposição desta etapa." },
        { label: "🔴 Amônia", text: "Déficit de US$72,4 mi -- concentração global (não da amostra brasileira) de 30% na China." },
        { label: "Hidrogênio", text: "Comércio quase inexistente na amostra (US$1,8 mil importados) -- reflete ausência de produção/mercado doméstico comparável, não uma métrica de dependência percentual." },
      ], relatedInputs: ["Hidrogênio", "Amônia", "Metanol"], isCritical: true, isVulnerable: true, alertMessage: "O diagnóstico comercial mostra dependência externa elevada para amônia e, sobretudo, metanol (98,6%) -- e ausência de produção doméstica comparável para hidrogênio -- diferente da rota consolidada de etanol/biodiesel.", icon: ShieldAlert },
      { id: "fuel_advanced_inputs", name: "Tecnologias de Conversão", country: "Múltiplas origens", flag: "🌐", stage: "Tecnologia habilitadora", description: "Catalisadores, enzimas e eletrolisadores condicionam a escala, a produtividade e a intensidade de carbono das rotas.", cardBullets: [
        { label: "Eletrolisadores", text: "Déficit de US$76,3 mi -- 15,9% da amostra brasileira vem da China, mas a IEA estima concentração global de ~60% da capacidade de fabricação." },
        { label: "Enzimas e Catalisadores", text: "Déficits de US$152,0 mi e US$215,3 mi -- fornecedor relativamente diversificado na amostra brasileira (22,9% e 11,6% China)." },
      ], relatedInputs: ["Enzimas e biocatalisadores", "Catalisadores preparados", "Eletrolisadores / proxy de equipamentos"], isCritical: true, isVulnerable: true, alertMessage: "Evidência disponível: a IEA estima que a China reúne quase 60% da capacidade mundial de fabricação de eletrolisadores. Essa é uma concentração geográfica publicada, não um HHI por empresa. Para enzimas e catalisadores, a leitura permanece baseada na dependência e nos fornecedores observados nas importações brasileiras.", icon: ShieldAlert },
      { id: "fuel_final_br", name: "Combustíveis e Usos Finais", country: "Brasil", flag: "🇧🇷", stage: "Aplicação final", description: "Hidrogênio renovável, SAF, biometano e e-combustíveis abastecem aviação, indústria e transporte pesado.", cardBullets: [
        { label: "🟢 Combustíveis de Aviação / Proxy SAF", text: "Superávit de US$1,43 bi -- maior saldo positivo em valor desta cadeia, sem concentração chinesa." },
      ], relatedInputs: ["Combustíveis de aviação / proxy SAF"], relatedDestinations: transitionFuelDestinations, isCritical: false, isVulnerable: false, icon: Zap },
    ],
  },
  {
    id: "strategic-fertilizers",
    name: "Fertilizantes Estratégicos",
    category: "Segurança produtiva",
    hhiGlobal: "em homologação",
    primaryVulnerability: "nutrientes e intermediários com alta exposição externa",
    nodes: [
      { id: "fertilizer_resources", name: "Recursos Minerais e Gás", country: "Brasil", flag: "🇧🇷", stage: "Matéria-prima", description: "Gás natural, rocha fosfática e recursos potássicos formam a base da cadeia.", cardBullets: [
        { label: "🔴 Gás Natural", text: "Déficit de US$1,01 bi -- sem concentração chinesa (0% da amostra), mas dependente de importação para cobrir a demanda da cadeia." },
        { label: "🔴 Rocha Fosfática", text: "Déficit de US$83,3 mi, concentração de fornecedor moderada-alta (HHI 5.660), sem participação chinesa relevante." },
      ], detailBullets: [
        { label: "🔴 Gás Natural", text: "US$1,01 bi importados contra US$1,9 mi exportados -- déficit quase total, fornecedor diversificado (não chinês)." },
        { label: "🔴 Rocha Fosfática", text: "US$83,4 mi importados contra US$87,1 mil exportados -- déficit de US$83,3 mi, HHI 5.660 indica concentração de fornecedor relevante mesmo sem predominância chinesa." },
      ], relatedInputs: ["Gás natural", "Rocha fosfática"], isCritical: true, isVulnerable: false, alertMessage: "Déficit real nas duas matérias-primas de base -- risco de dependência de importação, não de concentração chinesa especificamente.", icon: Factory },
      { id: "fertilizer_intermediates", name: "Intermediários Químicos", country: "Múltiplas origens", flag: "🌐", stage: "Insumo", description: "Amônia, ureia, ácido fosfórico e sais potássicos concentram a exposição comercial.", cardBullets: [
        { label: "🔴 Cloreto de Potássio", text: "Maior déficit em valor de toda a cadeia de fertilizantes -- US$2,99 bi, 70,8% de dependência externa; sem produção doméstica de potássio em escala." },
        { label: "🔴 Sulfato de Amônio", text: "99,8% das importações vêm da China -- maior concentração de fornecedor único da cadeia (déficit de US$556,5 mi, 77,5% de dependência externa)." },
        { label: "🔴 Ureia, MAP e Superfosfatos", text: "Déficits de US$1,07 bi, US$1,29 bi e US$1,32 bi -- entre 56% e 74% de dependência externa cada, com fornecedor diversificado (não concentrado na China)." },
      ], detailBullets: [
        { label: "🔴 Cloreto de Potássio (Potássicos)", text: "US$2,997 bi importados contra US$10,1 mi exportados -- maior linha de importação isolada da cadeia de fertilizantes; extração/produção doméstica de potássio ainda incipiente." },
        { label: "🔴 Sulfato de Amônio (Nitrogenados)", text: "US$562,9 mi importados, 99,8% de origem chinesa -- fornecedor único de fato, déficit de US$556,5 mi." },
        { label: "🔴 Ureia (Nitrogenados)", text: "Déficit de US$1,07 bi, 73,7% de dependência externa; apenas 3,3% das importações vêm da China -- risco de volume, não de concentração geográfica." },
        { label: "🔴 Fosfato Monoamônico / MAP", text: "Déficit de US$1,29 bi, 56,0% de dependência externa, fornecedor diversificado (0,98% China)." },
        { label: "🔴 Superfosfatos", text: "Déficit de US$1,32 bi, 56,5% de dependência externa, 9,8% de origem chinesa." },
        { label: "Amônia", text: "Déficit de US$72,4 mi -- concentração global de 30% na China (estrutural), mas a amostra de importação brasileira não aponta a China como fornecedor principal." },
        { label: "Fosfato Diamônico / DAP", text: "Comércio residual (déficit de US$15,7 mi) -- menor volume da cesta de intermediários." },
      ], relatedInputs: ["Amônia", "Ureia fertilizante", "Sulfato de amônio", "Fosfato diamônico (DAP)", "Fosfato monoamônico (MAP)", "Superfosfatos", "Cloreto de potássio"], isCritical: true, isVulnerable: true, alertMessage: "Nutriente por nutriente: o maior risco de valor está no cloreto de potássio (US$2,99 bi, sem produção doméstica em escala); o maior risco de concentração de fornecedor está no sulfato de amônio (99,8% China). Os demais têm déficit relevante mas fornecedor diversificado.", icon: ShieldAlert },
      { id: "fertilizer_blending_br", name: "Formulação e Mistura", country: "Brasil", flag: "🇧🇷", stage: "Transformação", description: "Mistura, granulação e formulação adaptam nutrientes às necessidades agronômicas.", cardBullets: [
        { label: "🟢 Fertilizantes NPK", text: "Dependência externa de apenas 1,9% -- a formulação final (mistura/granulação) é majoritariamente doméstica, mesmo com os intermediários importados a montante." },
      ], detailBullets: [
        { label: "🟢 Fertilizantes NPK", text: "Déficit de US$221,5 mi frente a uma cesta de intermediários que soma bilhões -- a etapa de formulação em si tem dependência externa de só 1,9%, evidência de capacidade real de mistura e granulação nacional." },
      ], relatedInputs: ["Fertilizantes NPK"], isCritical: false, isVulnerable: false, icon: Layers },
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
      { id: "steel_inputs_br", name: "Insumos Primários e Redutores", country: "Brasil + importado", flag: "🇧🇷🌐", stage: "Carga primária", description: "Minério de ferro extraído e beneficiado no Brasil e carvão mineral/coque importado (~US$2 bi/ano) entram juntos na carga -- insumos concomitantes, não uma sequência entre si.", cardBullets: [
        { label: "🟢 Minério de Ferro", text: "Superávit de US$15,8 bi -- extraído e beneficiado no Brasil (mineração primária), importação irrelevante (0,008% da amostra)." },
        { label: "🔴 Carvão Mineral e Coque", text: "Déficit de US$2,05 bi -- ~100% importado (EUA, Austrália, Colômbia) para a rota primária tradicional; concentração de fornecedor não é chinesa." },
        { label: "Soberania Nacional", text: "Contraste direto com o carvão vegetal doméstico (biorredução), que zera a dependência do redutor fóssil importado na etapa de redução -- já responde por 16,5% do consumo energético do setor Ferro-Gusa e Aço no Brasil (BEN/EPE 2024). Ver Etapa 3 para o detalhamento." },
      ], detailBullets: [
        { label: "🟢 Minério de Ferro", text: "US$15,84 bi de exportação contra US$7,4 mi de importação -- soberania plena na base mineral, maior ativo de saldo comercial da cadeia." },
        { label: "🔴 Carvão Mineral e Coque Siderúrgico", text: "US$2,05 bi de importação anual, quase sem contrapartida de exportação (US$126 mil) -- 100% dependente de fornecimento externo (EUA, Austrália, Colômbia), sem substituto doméstico na rota a coque." },
        { label: "Combinação de Carga", text: "Minério e combustível/redutor entram de forma concomitante no processo termoquímico." },
        { label: "Exposição ao CBAM", text: "O coque fóssil importado é o maior responsável pela pegada de carbono da siderurgia integrada nacional." },
      ], relatedInputs: ["Minério de ferro", "Carvão mineral e coque siderúrgico"], isCritical: true, isVulnerable: false, alertMessage: "Déficit real de US$2,05 bi em carvão mineral e coque -- fornecedor diversificado (EUA, Austrália, Colômbia), não concentração chinesa. O minério de ferro, em contraste, é soberania plena.", icon: Factory },
      { id: "steel_scrap_br", name: "Sucata Ferrosa", country: "Brasil", flag: "🇧🇷", stage: "Insumo reciclado", description: "Sucata ferrosa reciclada, insumo da rota elétrica (EAF).", cardBullets: [
        { label: "Rota Elétrica (EAF)", text: "Pegada de carbono muito menor que a rota primária a carvão -- roda na matriz elétrica nacional, majoritariamente renovável." },
        { label: "🟢 Potencial de Reciclagem", text: "Superávit de US$173,2 mi -- o Brasil exportou cerca de 32x mais sucata do que importou no período mapeado, sinalizando reciclagem doméstica ainda não totalmente aproveitada." },
      ], detailBullets: [
        { label: "Rota Elétrica (EAF)", text: "Pegada de carbono muito menor que a rota primária a carvão -- roda na matriz elétrica nacional, majoritariamente renovável." },
        { label: "🟢 Potencial de Reciclagem", text: "US$178,8 mi exportados contra US$5,6 mi importados (32x) -- reciclagem doméstica consolidada, fornecedor pouco concentrado (0,45% China)." },
      ], relatedInputs: ["Sucata ferrosa"], isCritical: false, isVulnerable: false, icon: Recycle },
      { id: "steel_reduction_br", name: "Redução e Aciaria", country: "Brasil", flag: "🇧🇷", stage: "Transformação", description: "Altos-fornos (coque/carvão mineral), redução direta (DRI) e fornos elétricos (EAF) convertem a carga em aço bruto.", cardBullets: [
        { label: "🟢 Ferro-Gusa", text: "Superávit de US$965,2 mi -- Brasil exporta o excedente da rota integrada; os 96,9% de \"origem China\" na amostra de importação vêm de uma base de apenas US$42 mil, sem significado estatístico." },
        { label: "🟢 Carvão Vegetal (Biorredução)", text: "Rota de baixo carbono estruturalmente doméstica -- 16,5% do consumo energético do setor Ferro-Gusa e Aço em 2024 (BEN/EPE), sem código NCM próprio, então entra como dado de produção/energia, não como métrica de comércio exterior." },
        { label: "Gás Natural (Rota DRI)", text: "Redutor importante, mas impossível de isolar via NCM por ser uma cesta comercial multiuso." },
        { label: "Fundentes (Calcário/Dolomita)", text: "Compõem o processo, mas têm comércio exterior marginal nesta pauta." },
      ], detailBullets: [
        { label: "🟢 Ferro-Gusa (NCM 7201)", text: "US$965,2 mi de saldo positivo (US$965,2 mi exportados contra US$42,3 mil importados) -- item estruturalmente exportador da cadeia." },
        { label: "🟢 Carvão Vegetal (Biorredução)", text: "Rota de baixo carbono estruturalmente doméstica -- 16,5% do consumo energético do setor Ferro-Gusa e Aço em 2024 (BEN/EPE), sem código NCM próprio, então entra como dado de produção/energia, não como métrica de comércio exterior." },
        { label: "Ferro-Esponja e Redução Direta", text: "Comércio residual (déficit de US$94,7 mil) -- amostra pequena demais (base de US$99,9 mil) para atribuir concentração de fornecedor com confiança." },
        { label: "Gás Natural (Rota DRI)", text: "Redutor importante, mas impossível de isolar via NCM por ser uma cesta comercial multiuso." },
        { label: "Fundentes (Calcário/Dolomita)", text: "Compõem o processo, mas têm comércio exterior marginal nesta pauta." },
      ], relatedInputs: ["Ferro-gusa", "Carvão vegetal (biorredução)", "Ferro-esponja e redução direta"], isCritical: false, isVulnerable: false, icon: Layers },
      { id: "steel_alloys_global", name: "Ligas e Tecnologia de Processo", country: "Múltiplas origens", flag: "🌐", stage: "Transformação", description: "Ferroligas, refratários e equipamentos condicionam qualidade e descarbonização.", cardBullets: [
        { label: "🟢 Ferro-Nióbio e Ferro-Níquel", text: "Ativos de soberania, não gargalo -- juntos, US$2,3 bi de saldo comercial positivo (CBMM domina a oferta mundial de nióbio; Brasil processa níquel doméstico para ligas de inoxidável). Estavam consolidados dentro da cesta agregada \"Ferroligas\" nas versões internas anteriores da modelagem, antes desta apuração desmembrar cada sub-código." },
        { label: "🔴 Eletrodos de Grafite", text: "87,2% das importações vêm da China -- maior exposição desta etapa." },
        { label: "🔴 Refratários e demais ferroligas", text: "Materiais refratários com 48,8% de importação chinesa (déficit de US$33 mi); as ferroligas remanescentes (sem nióbio/níquel) ainda escondem sub-códigos importadores líquidos sob um saldo agregado positivo." },
      ], detailBullets: [
        { label: "🟢 Ferro-Nióbio (NCM 7202.93.00)", text: "US$1,68 bi de exportação, praticamente sem importação -- monopólio brasileiro via CBMM. Produção doméstica está sob sigilo estatístico no PIA/PRODLIST, consistente com produtor único." },
        { label: "🟢 Ferro-Níquel (NCM 7202.60.00)", text: "US$655,7 mi de exportação -- insumo de liga inoxidável processado no Brasil (Vale Onça Puma, Anglo American Barro Alto/Codemin)." },
        { label: "🔴 Eletrodos de Grafite", text: "87,2% das importações vêm da China -- maior concentração de fornecedor único desta etapa." },
        { label: "🔴 Materiais Refratários", text: "48,8% de importação chinesa e déficit comercial de US$33 mi; cesta cobre também usos em cimento, vidro e fundição fora da siderurgia." },
        { label: "🔴 Ferroligas remanescentes", text: "Sem nióbio/níquel, a cesta ainda é superavitária (US$262 mi), mas o superávit concentra em ferrossilício (72022100) enquanto 5 sub-códigos seguem importadores líquidos -- ver detalhamento técnico." },
      ], relatedInputs: ["Ferroligas", "Ferro-nióbio", "Ferro-níquel", "Eletrodos de grafite", "Materiais refratários"], isCritical: true, isVulnerable: true, alertMessage: "Itens críticos são identificados pelo risco comercial observado; a topologia não atribui concentração sem homologação. Ferro-nióbio e ferro-níquel são exceção deliberada -- ver cesta detalhada no card.", icon: ShieldAlert },
      { id: "steel_products_br", name: "Aços e Bens da Transição", country: "Brasil", flag: "🇧🇷", stage: "Equipamento e uso final", description: "Chapas, tubos, cabos e estruturas abastecem energia, mobilidade e infraestrutura verde.", cardBullets: [
        { label: "🔴 Aços Elétricos (GO/GNO)", text: "60,1% das importações vêm da China -- maior concentração de fornecedor desta etapa (déficit de US$92,6 mi)." },
        { label: "🔴 Estruturas de Aço", text: "57,5% das importações vêm da China -- déficit de US$69,2 mi." },
        { label: "Tubos e Laminados Planos", text: "Déficits relevantes (destaque para US$251,9 mi em tubos de aço), mas fornecedor bem mais diversificado -- entre 2,5% e 22,3% China." },
      ], detailBullets: [
        { label: "🔴 Aços Elétricos (GO/GNO)", text: "60,1% das importações concentradas na China -- déficit de US$92,6 mi. É o item de maior concentração de fornecedor único desta etapa, usado em transformadores e motores elétricos." },
        { label: "🔴 Estruturas de Aço", text: "57,5% das importações concentradas na China -- déficit de US$69,2 mi." },
        { label: "Tubos de Aço", text: "Maior déficit absoluto da etapa (US$293,2 mi importados contra US$41,3 mi exportados), mas apenas 2,5% da amostra vem da China -- déficit de volume, não de concentração geográfica." },
        { label: "Laminados Planos a Quente", text: "Déficit de US$74,9 mi, 22,3% das importações da China -- exposição moderada, sem monopólio configurado." },
        { label: "Laminados Planos a Frio", text: "Déficit de US$24,2 mi, 15,2% das importações da China -- menor exposição de concentração entre os produtos desta etapa." },
      ], relatedInputs: ["Laminados planos a quente", "Laminados planos a frio", "Tubos de aço", "Estruturas de aço", "Aços elétricos (grão orientado/não orientado)"], isCritical: true, isVulnerable: false, alertMessage: "Diferente das etapas anteriores (exportadoras líquidas), esta etapa importa mais do que exporta em todos os 5 itens -- a concentração de fornecedor real está em aços elétricos (60,1% China) e estruturas de aço (57,5%); os demais têm fornecedor diversificado ou déficit por volume, não por dependência de um único país.", icon: Zap },
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
  steel_reduction_br: ["ferro_gusa", "carvao_vegetal", "ferro_esponja"],
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
                {node.cardBullets?.length ? (
                  <ul className="mt-4 flex-1 space-y-2">
                    {node.cardBullets.map((bullet) => (
                      <li key={bullet.label} className="text-xs leading-5 text-zinc-400">
                        <span className="font-semibold text-zinc-200">{bullet.label}: </span>
                        {bullet.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 flex-1 text-xs leading-5 text-zinc-400">{node.description}</p>
                )}
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
                {selectedNode.detailBullets?.length ? (
                  <ol className="mt-3 space-y-2">
                    {selectedNode.detailBullets.map((bullet, index) => (
                      <li key={bullet.label} className="flex gap-2 text-sm leading-6 text-zinc-300">
                        <span className="font-mono text-xs text-cyan-300">{index + 1}.</span>
                        <span>
                          <span className="font-semibold text-zinc-100">{bullet.label}: </span>
                          {bullet.text}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
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
