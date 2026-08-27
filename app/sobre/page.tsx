import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Compass,
  Cpu,
  Factory,
  Fingerprint,
  Globe2,
  GraduationCap,
  HeartPulse,
  Layers,
  Leaf,
  Lock,
  MapPin,
  Network,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Users,
  Wheat,
} from "lucide-react";

export const metadata: Metadata = {
  title: "O que é o Border Value | Border Value",
  description:
    "Border Value é uma infraestrutura analítica de Estado para a soberania industrial e a transição energética brasileira.",
};

const CHAINS = [
  {
    icon: Leaf,
    name: "Biocombustíveis",
    tone: "text-emerald-300 border-emerald-800/60 bg-emerald-950/40",
    description:
      "Foco na descarbonização da matriz de transportes, utilizando o Ciclo de Vida (LCA) para garantir que o combustível verde não gere passivos ambientais na colheita.",
  },
  {
    icon: Wheat,
    name: "Fertilizantes",
    tone: "text-amber-300 border-amber-800/60 bg-amber-950/40",
    description:
      "Insumo crítico para a segurança alimentar; o objetivo é reduzir a vulnerabilidade do agronegócio frente a crises geopolíticas.",
  },
  {
    icon: Factory,
    name: "Aço",
    tone: "text-zinc-300 border-zinc-700/60 bg-zinc-900/60",
    description:
      "O alicerce da infraestrutura verde, essencial para a fabricação de aerogeradores, máquinas e novas plantas industriais.",
  },
  {
    icon: Cpu,
    name: "Silício",
    tone: "text-cyan-300 border-cyan-800/60 bg-cyan-950/40",
    description:
      "O \"coração\" da era solar. O monitoramento aqui é vital para evitar o estrangulamento da transição energética por monopólios externos.",
  },
];

const PILLARS = [
  {
    icon: Globe2,
    label: "Comércio Exterior",
    source: "Comex Stat",
    tag: "O Termômetro Global",
    description:
      "Registra o valor FOB e peso líquido de tudo o que entra e sai, revelando quem são nossos parceiros e competidores reais.",
  },
  {
    icon: Factory,
    label: "Produção Nacional",
    source: "PIA-Produto / IBGE",
    tag: "A Capacidade de Entrega",
    description:
      "Mostra o que a indústria brasileira efetivamente fabrica, o valor dessa produção e o potencial de suprir o mercado interno.",
  },
  {
    icon: Users,
    label: "Emprego e Transição Justa",
    source: "W-HDI (IDH-Trabalhador)",
    tag: "O Mapa do Desenvolvimento Humano",
    description:
      "Em vez de apenas contar vagas, este índice mede a qualidade do emprego através da saúde (acidentes), educação e renda.",
  },
];

const REFINE_STEPS = [
  {
    step: "1",
    title: "Identificação (NCM)",
    description: "Localizamos o \"código de barras\" global do produto.",
  },
  {
    step: "2",
    title: "Corte de Precisão (Fator Alpha)",
    description:
      "Aplicamos o coeficiente de proporcionalidade (ex: apenas a parcela de enzimas ou aço usada especificamente naquela cadeia energética).",
  },
  {
    step: "3",
    title: "Produto Conceitual",
    description:
      "Geramos uma métrica limpa, que reflete a realidade da política pública, e não apenas a burocracia aduaneira.",
  },
];

const GLOSSARY = [
  {
    icon: Layers,
    term: "Produto Conceitual",
    definition:
      "É a tradução pedagógica de códigos complexos. Em vez de lidar com termos técnicos indecifráveis, o gestor visualiza nomes claros como \"Silício Grau Solar\" ou \"Aço para Eólicas\".",
  },
  {
    icon: Fingerprint,
    term: "NCM",
    definition: "O \"CPF das Mercadorias\". Um código de 8 dígitos que identifica mundialmente qualquer item comercializado.",
  },
  {
    icon: ScanSearch,
    term: "CNAE e PRODLIST",
    definition:
      "O \"Catálogo de Competências\". A CNAE diz quem é a empresa (ex: fabricação de adubos) e o PRODLIST diz o que ela produz especificamente (ex: ureia).",
  },
  {
    icon: ShieldAlert,
    term: "Índice HHI (Alerta de Monopólio)",
    definition:
      "Mede a concentração de mercado. O limite crítico é 1.800. No Polissilício e Wafers, a concentração na China atinge entre 95% e 97% — um \"Alerta HHI Extremo\", indicando que a soberania solar do Brasil pode ser interrompida por uma única decisão externa.",
  },
  {
    icon: Compass,
    term: "Fator Alpha",
    definition:
      "O ajuste fino. É a porcentagem (fonte proxy: RenovaCalc) que garante que o dado reportado seja fiel ao uso final estratégico do produto.",
  },
  {
    icon: TrendingDown,
    term: "Consumo Aparente",
    definition:
      "A demanda real do país. Calculado como: Produção Nacional + Importação − Exportação. É quanto o Brasil precisa \"respirar\" daquele produto para funcionar.",
  },
  {
    icon: TrendingDown,
    term: "Déficit Comercial",
    definition: "O sinal de alerta financeiro: quando gastamos mais comprando de fora do que ganhamos vendendo para o mundo.",
  },
  {
    icon: Network,
    term: "Espinha Dorsal (Jornada Molecular)",
    definition:
      "O \"Fluxo de Sistemas\". Rastreia o produto desde a extração (ex: quartzo), passando pelo processamento (Silício Metalúrgico), até o produto final (Módulos Fotovoltaicos), identificando exatamente em qual etapa a cadeia brasileira está \"quebrada\".",
  },
  {
    icon: Lock,
    term: "Sigilo Estatístico da PIA",
    definition:
      "Uma trava de segurança estratégica. Quando um setor estratégico possui poucos produtores (como o SAF), o IBGE protege esses dados — não é falta de informação, é blindagem para que competidores internacionais não descubram custos e volumes de indústrias nascentes brasileiras.",
  },
];

const CAPABILITIES = [
  {
    icon: ShieldAlert,
    title: "Antecipar Crises Geopolíticas",
    description: "Identificar dependências em mercados com HHI extremo antes que elas se tornem gargalos de produção.",
  },
  {
    icon: HeartPulse,
    title: "Validar a Sustentabilidade Real",
    description:
      "Usar os 9 processos de Ciclo de Vida para garantir que a transição energética brasileira seja tecnicamente verde e socialmente justa.",
  },
  {
    icon: MapPin,
    title: "Localizar Oportunidades de Investimento",
    description: "Cruzar o Déficit Comercial com a massa salarial territorial para saber onde abrir novas fábricas e qualificar pessoas.",
  },
];

export default function SobrePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/88 px-4 py-2.5 backdrop-blur-xl sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 to-emerald-700/10 text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-mono text-xs font-extrabold tracking-wide text-white sm:text-sm">
              BORDER VALUE
            </span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1.5 font-mono text-xs font-bold text-zinc-950 shadow-lg transition hover:bg-emerald-400"
          >
            Entrar no Painel
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        {/* Hero */}
        <section className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            <Compass className="h-4 w-4" /> Border Value Intelligence · Infraestrutura de Estado
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-5xl">
            A Bússola da Soberania Industrial e Transição Energética
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            O Border Value é uma infraestrutura analítica de Estado, desenhada para converter a complexidade dos
            fluxos globais em inteligência estratégica para a reindustrialização do Brasil. Mais do que uma
            plataforma de dados, funciona como um sistema de navegação para a soberania industrial, mapeando as
            cadeias produtivas essenciais para uma transição energética que seja, acima de tudo, justa e competitiva.
          </p>

          <blockquote className="mx-auto mt-8 max-w-2xl rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 text-left backdrop-blur-xl">
            <p className="text-sm italic leading-6 text-zinc-300 sm:text-base">
              &ldquo;O Border Value transforma o ruído estatístico em coordenadas de precisão, permitindo que o gestor
              público identifique onde o Brasil deve produzir, proteger e inovar para garantir sua segurança
              energética.&rdquo;
            </p>
          </blockquote>
        </section>

        {/* Cadeias estratégicas */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="Cadeias estratégicas para a autonomia nacional"
            title="Quatro eixos onde a dependência externa é um risco de segurança nacional"
          />
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {CHAINS.map((chain) => (
              <div
                key={chain.name}
                className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 backdrop-blur-xl transition hover:border-white/20"
              >
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${chain.tone}`}>
                  <chain.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-bold text-white">{chain.name}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{chain.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Três pilares */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="A engrenagem por trás dos dados"
            title="Três pilares cruzados para uma visão 360° de cada setor"
            description="Para garantir a transparência, cada análise acompanha um Nível de Confiança (alta, média ou baixa), permitindo que o gestor saiba a precisão da informação que está consumindo."
          />
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div
                key={pillar.label}
                className="flex flex-col rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 backdrop-blur-xl"
              >
                <div className="flex items-center gap-2.5">
                  <pillar.icon className="h-4 w-4 text-cyan-300" />
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                    {pillar.source}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-bold text-white">{pillar.label}</h3>
                <p className="mt-1 text-xs font-semibold text-emerald-300">&ldquo;{pillar.tag}&rdquo;</p>
                <p className="mt-3 text-xs leading-5 text-zinc-400">{pillar.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-amber-800/40 bg-amber-950/20 p-5 backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-300">O &ldquo;pulo do gato&rdquo; para o gestor</p>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              A plataforma calcula automaticamente a <strong className="text-white">Razão de Dependência Externa</strong>{" "}
              (Importação / Consumo Aparente). Se este número for alto e o nível de confiança dos dados for elevado, o
              gestor tem em mãos uma evidência irrefutável de vulnerabilidade que exige intervenção política ou
              investimento.
            </p>
          </div>
        </section>

        {/* Lente de uso final */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="Precisão cirúrgica na análise"
            title="A Lente de Uso Final: o Fator Alpha como funil de pureza"
            description="Nas estatísticas tradicionais, um produto é apenas um número. No Border Value, o Fator Alpha separa o que é estratégico do que é apenas ruído."
          />

          <div className="mt-8 rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-6 backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-300">A metáfora do filtro de pureza</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Considere a produção de cana-de-açúcar. Uma análise bruta misturaria o açúcar destinado à alimentação
              com a cana destinada ao etanol combustível. Através da lente do Ciclo de Vida (LCA), a plataforma
              analisa os <strong className="text-zinc-200">9 Processos Unitários</strong> — desde a preparação do
              solo e aplicação de químicos até o uso final nos carros. Isso permite aplicar o Fator Alpha,
              utilizando pesos matemáticos da <strong className="text-zinc-200">RenovaCalc-V7 (ANP)</strong>, para
              isolar apenas o volume de insumos que efetivamente sustenta a cadeia de biocombustíveis.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {REFINE_STEPS.map((item) => (
              <div key={item.step} className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 backdrop-blur-xl">
                <span className="font-mono text-2xl font-bold text-emerald-400">{item.step}</span>
                <h3 className="mt-2 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Glossário */}
        <section className="mt-20">
          <SectionHeading eyebrow="Glossário amigável" title="Traduzindo o &ldquo;economês&rdquo;" />
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GLOSSARY.map((item) => (
              <details
                key={item.term}
                className="group rounded-xl border border-white/[0.08] bg-zinc-900/40 p-4 backdrop-blur-xl open:border-cyan-400/25"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2.5 text-sm font-bold text-white">
                  <item.icon className="h-4 w-4 shrink-0 text-cyan-300" />
                  {item.term}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-600 transition group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-xs leading-5 text-zinc-400">{item.definition}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Conclusão */}
        <section className="mt-20">
          <SectionHeading
            eyebrow="O valor da informação para a soberania"
            title="O Border Value retira a venda dos olhos do Estado brasileiro"
            description="Ao integrar dados de comércio, produção e o desenvolvimento humano dos trabalhadores (W-HDI), a plataforma oferece três capacidades críticas para o gestor."
          />
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <div key={capability.title} className="rounded-2xl border border-white/[0.08] bg-zinc-900/40 p-5 backdrop-blur-xl">
                <capability.icon className="h-5 w-5 text-emerald-400" />
                <h3 className="mt-3 text-sm font-bold text-white">{capability.title}</h3>
                <p className="mt-2 text-xs leading-5 text-zinc-400">{capability.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-emerald-800/40 bg-emerald-950/20 p-8 text-center backdrop-blur-xl">
            <GraduationCap className="h-6 w-6 text-emerald-400" />
            <p className="max-w-xl text-sm leading-6 text-zinc-300">
              Esta plataforma é um compromisso com o desenvolvimento baseado em evidências, garantindo que o Brasil
              não apenas participe da transição energética, mas a lidere com soberania e inteligência de dados.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-mono text-xs font-bold text-zinc-950 shadow-lg transition hover:bg-emerald-400"
            >
              Explorar o painel de cadeias
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p> : null}
    </div>
  );
}
