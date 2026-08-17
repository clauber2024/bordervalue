"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";

type TourStepBullet = {
  label: string;
  text: string;
};

type TourStep = {
  targetId: string;
  title: string;
  bullets: TourStepBullet[];
  note?: string;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type CardPosition = {
  top: number;
  left: number;
  width: number;
};

export type SovereigntyTourProps = {
  defaultOpen?: boolean;
  showLauncher?: boolean;
  className?: string;
};

const steps: TourStep[] = [
  {
    targetId: "tour-hero",
    title: "1. Diagnóstico executivo",
    bullets: [
      { label: "Cobertura", text: "2.902 registros de comércio exterior (Jan-Jun 2026), cruzando Comex Stat, PIA e RAIS." },
      { label: "Saldo", text: "superavitário em US$ 2,3 bi." },
      { label: "Ponto de atenção", text: "um único insumo, Eletrodos de grafite, concentra o alerta de prioridade institucional da cadeia." },
    ],
    note: "Pergunta de Estado: onde o Brasil já lidera (minério, aço bruto) e onde a siderurgia ainda depende de ligas e equipamentos importados?",
  },
  {
    targetId: "tour-aipnet-backbone",
    title: "2. Espinha Dorsal de Transformação",
    bullets: [
      { label: "Etapa 1, Carga Primária", text: "minério de ferro é majoritariamente nacional; o redutor fóssil (coque/carvão mineral) é ~100% importado — cerca de US$ 2 bi/ano, concentrados em EUA (34,5%), Austrália (23,7%) e Colômbia (22,6%)." },
      { label: "Etapa 2, Sucata Ferrosa", text: "base da rota elétrica (EAF). O Brasil exporta cerca de 32x mais sucata do que importa — indicando um potencial de reciclagem doméstica ainda a ser otimizado." },
      { label: "Etapas 3–5", text: "seguem domésticas até a Etapa 4, Ligas e Tecnologia de Processo, marcada como Gargalo de Soberania: é aqui que mora a dependência real da cadeia." },
    ],
  },
  {
    targetId: "tour-sankey",
    title: "3. Fluxo AIPNET por produto conceitual",
    bullets: [
      { label: "Leitura", text: "distribui os US$ 3,1 bi importados pela cadeia entre os 16 insumos mapeados e seus fornecedores; a espessura das bandas é valor FOB, não sequência produtiva. Carvão vegetal (biorredução) é o único sem comércio exterior -- não aparece aqui, só nos painéis de produção doméstica." },
      { label: "Concentração de valor", text: "a pauta importada é dominada pelo Carvão Mineral/Coque -- US$ 2,1 bi, 66,8% de tudo o que a cadeia importa -- não porque seja o insumo mais dependente de um único fornecedor, mas porque é o de maior volume financeiro." },
    ],
    note: "Volume em dólares e concentração geográfica de fornecedor são eixos diferentes -- avance para o Diagnóstico de Soberania (Passo 4) para ver a dependência externa real, insumo a insumo.",
  },
  {
    targetId: "tour-vulnerability",
    title: "4. Diagnóstico de soberania industrial",
    bullets: [
      { label: "Eletrodos de grafite", text: "líder real do eixo -- 26,9% de dependência externa, a maior da cadeia -- com HHI de 7.636 (alta concentração) e 87,2% das importações vindas de um único país, a China." },
      { label: "Minério de ferro", text: "o oposto — HHI de quase 10.000 nas importações é irrelevante (o Brasil importa quase nada, US$ 7,4 mi); a concentração real está do lado das exportações, 68% das quais vão para a China." },
      { label: "⚡ Ferro-esponja e redução direta", text: "aparece com 75,0% de participação chinesa, mas isso não é dependência externa real — não há dado de produção doméstica para calcular o indicador completo, e o fluxo em si é irrisório (US$ 99.930 no semestre). O que importa aqui é outro eixo: Vetor de Powershoring da rota DRI-hidrogênio verde para substituir o Carvão Mineral/Coque importado (Passo 3)." },
    ],
    note: "Hoje, 0 dos 16 insumos cruzam o limiar de dependência externa crítica (>75%) real. O único número que chega perto (Ferro-esponja, 75,0%) não é dependência real -- é ruído estatístico de baixíssimo volume.",
  },
  {
    targetId: "tour-mass-energy",
    title: "5. Balanço de massa e energia por etapa",
    bullets: [
      { label: "BF-BOF (alto-forno a coque)", text: "16–18 GJ/t de aço bruto, rota dominante no parque nacional e também globalmente — a China responde por 53,8% do aço bruto mundial, majoritariamente por essa rota." },
      { label: "⚡ Alto-forno a carvão vegetal (biorredução)", text: "já é 16,5% de todo o consumo energético do setor Ferro-Gusa e Aço no Brasil (BEN/EPE 2024) — mesma ordem de grandeza de energia do alto-forno a coque, mas com fator de emissão de 0,7 tCO2e/t contra 2,2 tCO2e/t da rota a coque (IABr 2024). Agora é insumo próprio do catálogo (16º), sem código NCM porque não cruza fronteira — ver Diagnóstico de Soberania para a tese completa." },
      { label: "EAF (forno elétrico a arco)", text: "2,1–2,4 GJ/t — cerca de 1/8 da energia da rota a coque — alimentado por sucata doméstica e por uma matriz elétrica nacional >84% renovável." },
    ],
    note: "São duas alavancas de descarbonização já disponíveis para a siderurgia brasileira -- carvão vegetal na etapa de redução e EAF na etapa elétrica -- e nenhuma das duas depende de tecnologia ainda não madura. A rota EAF já responde por ~29,1% do aço bruto mundial em 2024.",
  },
  {
    targetId: "tour-nib-matrix",
    title: "6. Matriz de priorização NIB",
    bullets: [
      { label: "Leitura", text: "cruza dependência externa com capacidade doméstica instalada para recomendar, por insumo, se a resposta de política é monitorar, modernizar ou expandir capacidade." },
      { label: "Insumo em destaque", text: "Eletrodos de grafite, dado o tripé HHI 7.636 + 87,2% China + rota crítica para o forno elétrico a arco." },
    ],
    note: "Sua interrupção forçaria a volta à rota primária a coque, mais intensiva em carbono e mais exposta ao CBAM.",
  },
  {
    targetId: "tour-carbon",
    title: "7. Exposição de carbono da pauta importada",
    bullets: [
      { label: "Pauta importada", text: "93,4% (US$ 2,9 bi) vem de insumos em rota fóssil dominante -- liderado pelo Carvão Mineral/Coque, o maior item da pauta." },
      { label: "Matriz elétrica nacional", text: "mais de 84% renovável (BEN/EPE), oferecendo vantagem competitiva estrutural para quem produz no Brasil." },
      { label: "⚡ Oportunidade de powershoring", text: "a rota EAF/DRI limpo desloca a pegada de carbono da pauta importada para a matriz elétrica nacional, posicionando o Brasil como fornecedor global de aço de baixo carbono." },
    ],
    note: "É esse contraste que torna a rota EAF (Etapa 2 da Espinha Dorsal) tão vantajosa no caso brasileiro: o gargalo de carbono está na pauta importada, não na eletricidade que move a produção doméstica.",
  },
  {
    targetId: "tour-green-jobs",
    title: "8. Empregos verdes e transição justa",
    bullets: [
      { label: "Vínculos formais", text: "275.318 (RAIS 2024) em atividades associadas à cadeia do aço, com massa salarial de R$ 1,18 bi." },
      { label: "Alta exposição TSB", text: "siderurgia primária e tubos sem costura (CNAE 2411/2421/2422/2423/2424) — 'setor industrial de transição'." },
      { label: "Exposição baixa a intermediária", text: "reciclagem de sucata e estruturas metálicas (CNAE 2599/2512), com predominância de atividades convencionais." },
    ],
  },
  {
    targetId: "tour-technical-drawer",
    title: "9. Dados primários e governança",
    bullets: [
      { label: "Fontes", text: "Comex Stat (Jan-Jun 2026), IBGE PIA-Produto (2024) e MTE RAIS (2024), cruzados por NCM, CNAE e PRODLIST." },
      { label: "Este painel", text: "é onde você audita cada número que viu nos passos anteriores." },
    ],
    note: "Inclui ressalvas metodológicas, como cestas NCM que agregam produtos heterogêneos.",
  },
];

const HIGHLIGHT_PADDING = 12;
const CARD_WIDTH = 384;
const CARD_MARGIN = 16;
const CARD_ESTIMATED_HEIGHT = 320;
// HeaderTopBar is sticky top-0 z-50 (px-4 py-2.5 + icon/text ~52px tall).
// The tour card's own z-index was already above that (z-[52]), but its
// root wrapper matched the header at z-50 -- same z-index means the later
// DOM node wins regardless of children's z-index, and HeaderTopBar renders
// after the tour in the page tree, so it painted over the card whenever the
// card's computed top landed near the viewport's top edge. This floor keeps
// the card clear of the header's band entirely, independent of that fix.
const CARD_TOP_MIN = 72;

export function SovereigntyTour({
  defaultOpen = false,
  showLauncher = true,
  className = "",
}: SovereigntyTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const openTour = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  }, []);

  const goForward = useCallback(() => {
    if (isLastStep) {
      closeTour();
      return;
    }

    setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
  }, [closeTour, isLastStep]);

  const updateHighlight = useCallback(() => {
    if (!isOpen) return;

    const target = document.getElementById(activeStep.targetId);
    if (!target) {
      setHighlightRect(null);
      return;
    }

    const rect = target.getBoundingClientRect();
    setHighlightRect({
      top: Math.max(rect.top - HIGHLIGHT_PADDING, CARD_MARGIN),
      left: Math.max(rect.left - HIGHLIGHT_PADDING, CARD_MARGIN),
      width: Math.min(rect.width + HIGHLIGHT_PADDING * 2, window.innerWidth - CARD_MARGIN * 2),
      height: Math.min(rect.height + HIGHLIGHT_PADDING * 2, window.innerHeight - CARD_MARGIN * 2),
    });
  }, [activeStep.targetId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const target = document.getElementById(activeStep.targetId);
    // The target can be an ancestor of the collapsible content (e.g. the
    // NIB matrix chart anchor sits inside a <details> wrapper) or a wrapper
    // around it (e.g. TechnicalDrawer renders its own <details> as its
    // root, nested under the tour-technical-drawer anchor div) -- check
    // both directions instead of assuming one.
    const detailsTarget = target?.closest("details") ?? target?.querySelector("details");
    if (detailsTarget && !detailsTarget.open) {
      detailsTarget.open = true;
    }
    // "center" reads nicely for a short target, but a tall one (e.g. the
    // vulnerability chart with many bars) can be taller than the viewport
    // itself -- centering it then pushes its top edge above the visible
    // area, under the sticky HeaderTopBar, regardless of scroll-margin
    // (which only fully applies to "start"/"nearest"). Fall back to "start"
    // whenever the target won't fit, so scroll-mt-* actually keeps the
    // header clear of it.
    const targetHeight = target?.getBoundingClientRect().height ?? 0;
    const fitsInViewport = targetHeight <= window.innerHeight - CARD_TOP_MIN;
    target?.scrollIntoView({ behavior: "smooth", block: fitsInViewport ? "center" : "start", inline: "nearest" });

    const firstFrame = window.requestAnimationFrame(updateHighlight);
    const secondFrame = window.setTimeout(updateHighlight, 420);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(secondFrame);
    };
  }, [activeStep.targetId, isOpen, updateHighlight]);

  useEffect(() => {
    if (!isOpen) return;

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    window.addEventListener("scroll", updateHighlight, true);

    return () => {
      window.removeEventListener("resize", updateHighlight);
      window.removeEventListener("scroll", updateHighlight, true);
    };
  }, [isOpen, updateHighlight]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeTour();
      if (event.key === "ArrowRight") goForward();
      if (event.key === "ArrowLeft") goBack();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeTour, goBack, goForward, isOpen]);

  const cardPosition = useMemo(
    () => getCardPosition(highlightRect),
    [highlightRect],
  );

  return (
    <>
      {showLauncher ? (
        <button
          type="button"
          onClick={openTour}
          className={`inline-flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-lg shadow-cyan-950/25 outline-none transition hover:border-cyan-300/45 hover:bg-cyan-400/15 focus-visible:ring-2 focus-visible:ring-cyan-300 ${className}`}
        >
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
          Iniciar modo guiado
        </button>
      ) : null}

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            aria-labelledby="sovereignty-tour-title"
            aria-modal="true"
            className="fixed inset-0 z-[55]"
            role="dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <SpotlightBackdrop highlightRect={highlightRect} onClick={closeTour} />

            {highlightRect ? (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none fixed z-[51] rounded-xl border border-cyan-200/70 ring-4 ring-cyan-300/20"
                initial={false}
                animate={highlightRect}
                transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.85 }}
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.18), 0 0 44px rgba(34,211,238,0.38)",
                }}
              />
            ) : null}

            <motion.aside
              className="fixed z-[52] max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/90 p-6 text-zinc-100 shadow-2xl backdrop-blur-xl"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, ...cardPosition }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.85 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/10 text-cyan-200">
                    <Sparkles className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">
                    Passo {currentStep + 1} de {steps.length}
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Fechar modo guiado"
                  onClick={closeTour}
                  className="rounded-lg p-2 text-zinc-400 outline-none transition hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                <motion.div
                  className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.45)]"
                  initial={false}
                  animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep.targetId}
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.22 }}
                  className="mt-5"
                >
                  <h2 id="sovereignty-tour-title" className="text-lg font-bold tracking-tight text-white">
                    {activeStep.title}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                    {activeStep.bullets.map((bullet) => (
                      <li key={bullet.label} className="flex gap-2">
                        <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                        <span>
                          <strong className="font-semibold text-white">{bullet.label}:</strong> {bullet.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {activeStep.note ? (
                    <p className="mt-3 text-xs leading-5 text-zinc-500">{activeStep.note}</p>
                  ) : null}
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={closeTour}
                  className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-zinc-400 outline-none transition hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-500"
                >
                  Pular modo guiado
                </button>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={isFirstStep}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-zinc-200 outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.04]"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={goForward}
                    className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-300 px-3.5 py-2 text-sm font-bold text-zinc-950 shadow-lg shadow-cyan-950/30 outline-none transition hover:bg-cyan-200 focus-visible:ring-2 focus-visible:ring-cyan-100"
                  >
                    {isLastStep ? "Concluir onboarding" : "Avançar"}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function getCardPosition(highlightRect: HighlightRect | null): CardPosition {
  if (typeof window === "undefined") {
    return { top: CARD_TOP_MIN, left: CARD_MARGIN, width: CARD_WIDTH };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(CARD_WIDTH, viewportWidth - CARD_MARGIN * 2);

  if (!highlightRect) {
    return {
      top: Math.max((viewportHeight - CARD_ESTIMATED_HEIGHT) / 2, CARD_TOP_MIN),
      left: Math.max((viewportWidth - width) / 2, CARD_MARGIN),
      width,
    };
  }

  const rightSlot = highlightRect.left + highlightRect.width + CARD_MARGIN;
  const leftSlot = highlightRect.left - width - CARD_MARGIN;
  const belowSlot = Math.max(highlightRect.top + highlightRect.height + CARD_MARGIN, CARD_TOP_MIN);
  const aboveSlot = highlightRect.top - CARD_ESTIMATED_HEIGHT - CARD_MARGIN;

  if (rightSlot + width <= viewportWidth - CARD_MARGIN) {
    return {
      top: clamp(highlightRect.top, CARD_TOP_MIN, viewportHeight - CARD_ESTIMATED_HEIGHT - CARD_MARGIN),
      left: rightSlot,
      width,
    };
  }

  if (leftSlot >= CARD_MARGIN) {
    return {
      top: clamp(highlightRect.top, CARD_TOP_MIN, viewportHeight - CARD_ESTIMATED_HEIGHT - CARD_MARGIN),
      left: leftSlot,
      width,
    };
  }

  if (belowSlot + CARD_ESTIMATED_HEIGHT <= viewportHeight - CARD_MARGIN) {
    return {
      top: belowSlot,
      left: clamp(highlightRect.left, CARD_MARGIN, viewportWidth - width - CARD_MARGIN),
      width,
    };
  }

  if (aboveSlot >= CARD_TOP_MIN) {
    return {
      top: aboveSlot,
      left: clamp(highlightRect.left, CARD_MARGIN, viewportWidth - width - CARD_MARGIN),
      width,
    };
  }

  return {
    top: CARD_TOP_MIN,
    left: clamp((viewportWidth - width) / 2, CARD_MARGIN, viewportWidth - width - CARD_MARGIN),
    width,
  };
}

function SpotlightBackdrop({
  highlightRect,
  onClick,
}: {
  highlightRect: HighlightRect | null;
  onClick: () => void;
}) {
  if (!highlightRect || typeof window === "undefined") {
    return <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClick} />;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const highlightTop = clamp(highlightRect.top, 0, viewportHeight);
  const highlightLeft = clamp(highlightRect.left, 0, viewportWidth);
  const highlightRight = clamp(highlightRect.left + highlightRect.width, 0, viewportWidth);
  const highlightBottom = clamp(highlightRect.top + highlightRect.height, 0, viewportHeight);

  const panes: CSSProperties[] = [
    {
      top: 0,
      left: 0,
      width: "100vw",
      height: highlightTop,
    },
    {
      top: highlightBottom,
      left: 0,
      width: "100vw",
      height: Math.max(viewportHeight - highlightBottom, 0),
    },
    {
      top: highlightTop,
      left: 0,
      width: highlightLeft,
      height: Math.max(highlightBottom - highlightTop, 0),
    },
    {
      top: highlightTop,
      left: highlightRight,
      width: Math.max(viewportWidth - highlightRight, 0),
      height: Math.max(highlightBottom - highlightTop, 0),
    },
  ];

  return (
    <>
      {panes.map((style, index) => (
        <div
          key={index}
          className="fixed z-50 bg-black/60 backdrop-blur-sm"
          style={style}
          onClick={onClick}
        />
      ))}
    </>
  );
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export default SovereigntyTour;
