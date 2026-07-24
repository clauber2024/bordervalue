"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Landmark,
  X,
} from "lucide-react";

type TourStep = {
  targetId: string;
  title: string;
  content: string;
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

export type SovereigntyTourExtendedProps = {
  defaultOpen?: boolean;
  showLauncher?: boolean;
  className?: string;
};

const steps: TourStep[] = [
  {
    targetId: "nib-matrix",
    title: "1. Matriz NIB de Adensamento Produtivo",
    content:
      "O motor de dados cruza o déficit comercial (Comex) com o Valor da Produção Industrial (PIA). Veja as Enzimas Alfa-Amilase no quadrante 'Modernizar / Expandir': o Brasil possui demanda interna robusta e capacidade inicial instalada de R$ 31 Milhões, revelando a oportunidade exata para aplicação de crédito estruturante.",
  },
  {
    targetId: "vulnerability-radar",
    title: "2. Radar de Soberania & Concentração (HHI)",
    content:
      "Este indicador monitora o Índice Herfindahl-Hirschman (HHI) das importações. Para as Enzimas, o HHI estourou o limite de mercado para 5.540 pontos devido ao monopólio da Dinamarca (72,4% de participação). O sistema aciona o Alerta Vermelho de Risco Crítico de Suprimento.",
  },
  {
    targetId: "indicator-apparent-consumption",
    title: "3. Dependência Externa Real vs. Consumo Aparente",
    content:
      "Aqui mostramos que a Exposição Comercial não é igual à Vulnerabilidade. O Etanol Anidro possui alto fluxo comercial com os EUA, mas sua dependência externa real é de apenas 0,13% devido ao nosso Consumo Aparente interno massivo protegido por base produtiva nacional estável.",
  },
  {
    targetId: "proportionality-toggle",
    title: "4. Lente de Uso Final / Proxy RenovaCalc",
    content:
      "Dados alfandegários puros incluem enzimas para panificação e laticínios. Ative este switch para aplicar a Lente RenovaCalc: o algoritmo encolhe dinamicamente o volume importado em 28,4%, isolando o custo biotecnológico estrito absorvido pelo balanço de massa da Usina Neomille.",
  },
  {
    targetId: "sovereignty-sankey",
    title: "5. Grafo AIPNET & O Nó Fantasma do Bioquerosene",
    content:
      "Rastreie graficamente a rota física e financeira do insumo até à aviação civil. A linha tracejada cinza sinaliza que a produção nacional de SAF está protegida por Sigilo Estatístico da PIA (IBGE), impedindo que a ocultação do dado cegue o planejamento industrial.",
  },
  {
    targetId: "tsb-employment-map",
    title: "6. Impacto Territorial Justo (Módulo TSB)",
    content:
      "Em vez de focar apenas em portos, este indicador mapeia os 78.400 vínculos empregatícios formais e a massa salarial da RAIS alocados na CNAE 1931. Clicar nos municípios aquecidos redistribui a análise para avaliar o impacto socioeconômico regional da transição.",
  },
];

const HIGHLIGHT_PADDING = 12;
const CARD_WIDTH = 448;
const CARD_MARGIN = 16;
const CARD_ESTIMATED_HEIGHT = 380;

export function SovereigntyTourExtended({
  defaultOpen = false,
  showLauncher = true,
  className = "",
}: SovereigntyTourExtendedProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const activeStep = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

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
    const maxWidth = window.innerWidth - CARD_MARGIN * 2;
    const maxHeight = window.innerHeight - CARD_MARGIN * 2;

    setHighlightRect({
      top: Math.max(rect.top - HIGHLIGHT_PADDING, CARD_MARGIN),
      left: Math.max(rect.left - HIGHLIGHT_PADDING, CARD_MARGIN),
      width: Math.min(rect.width + HIGHLIGHT_PADDING * 2, maxWidth),
      height: Math.min(rect.height + HIGHLIGHT_PADDING * 2, maxHeight),
    });
  }, [activeStep.targetId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const target = document.getElementById(activeStep.targetId);
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

    const firstFrame = window.requestAnimationFrame(updateHighlight);
    const settleTimer = window.setTimeout(updateHighlight, 460);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(settleTimer);
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
      if (event.key === "ArrowLeft") goBack();
      if (event.key === "ArrowRight") goForward();
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
          className={`inline-flex items-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 shadow-lg shadow-emerald-950/20 outline-none transition hover:border-emerald-300/45 hover:bg-emerald-400/15 focus-visible:ring-2 focus-visible:ring-emerald-300 ${className}`}
        >
          <Landmark className="h-4 w-4" strokeWidth={1.8} />
          Iniciar modo guiado
        </button>
      ) : null}

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            aria-labelledby="sovereignty-tour-extended-title"
            aria-modal="true"
            className="fixed inset-0 z-50 font-sans"
            role="dialog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={closeTour}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />

            {highlightRect ? (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none fixed z-[51] rounded-xl border border-emerald-200/70 ring-4 ring-emerald-300/20"
                initial={false}
                animate={highlightRect}
                transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.85 }}
                style={{
                  boxShadow:
                    "0 0 0 1px rgba(255,255,255,0.16), 0 0 46px rgba(52,211,153,0.34)",
                }}
              />
            ) : null}

            <motion.aside
              className="fixed z-[52] max-w-md rounded-xl border border-zinc-800/80 bg-zinc-900/95 p-6 font-sans text-zinc-100 shadow-2xl backdrop-blur-2xl"
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1, ...cardPosition }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 360, damping: 34, mass: 0.85 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                    <BarChart3 className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
                      Diagnóstico guiado
                    </p>
                    <p className="mt-1 text-xs font-semibold text-zinc-400">
                      Passo {currentStep + 1} de {steps.length}
                    </p>
                  </div>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Fechar modo guiado"
                  onClick={closeTour}
                  className="rounded-lg p-2 text-zinc-400 outline-none transition hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <X className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div
                aria-label={`Progresso do modo guiado: passo ${currentStep + 1} de ${steps.length}`}
                className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={steps.length}
                aria-valuenow={currentStep + 1}
              >
                <motion.div
                  className="h-full rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.42)]"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep.targetId}
                  className="mt-5"
                  initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                  transition={{ duration: 0.22 }}
                >
                  <h2
                    id="sovereignty-tour-extended-title"
                    className="text-lg font-bold tracking-tight text-white"
                  >
                    {activeStep.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    {activeStep.content}
                  </p>
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
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-zinc-200 outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white/[0.04]"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.7} />
                    Voltar
                  </button>

                  <button
                    type="button"
                    onClick={goForward}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-300 px-3.5 py-2 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-950/30 outline-none transition hover:bg-emerald-200 focus-visible:ring-2 focus-visible:ring-emerald-100"
                  >
                    {isLastStep ? "Concluir onboarding" : "Avançar"}
                    {isLastStep ? (
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                    ) : (
                      <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                    )}
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
    return { top: CARD_MARGIN, left: CARD_MARGIN, width: CARD_WIDTH };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(CARD_WIDTH, viewportWidth - CARD_MARGIN * 2);

  if (!highlightRect) {
    return {
      top: Math.max((viewportHeight - CARD_ESTIMATED_HEIGHT) / 2, CARD_MARGIN),
      left: Math.max((viewportWidth - width) / 2, CARD_MARGIN),
      width,
    };
  }

  const rightSlot = highlightRect.left + highlightRect.width + CARD_MARGIN;
  const leftSlot = highlightRect.left - width - CARD_MARGIN;
  const belowSlot = highlightRect.top + highlightRect.height + CARD_MARGIN;
  const aboveSlot = highlightRect.top - CARD_ESTIMATED_HEIGHT - CARD_MARGIN;

  if (rightSlot + width <= viewportWidth - CARD_MARGIN) {
    return {
      top: clamp(
        highlightRect.top,
        CARD_MARGIN,
        viewportHeight - CARD_ESTIMATED_HEIGHT - CARD_MARGIN,
      ),
      left: rightSlot,
      width,
    };
  }

  if (leftSlot >= CARD_MARGIN) {
    return {
      top: clamp(
        highlightRect.top,
        CARD_MARGIN,
        viewportHeight - CARD_ESTIMATED_HEIGHT - CARD_MARGIN,
      ),
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

  if (aboveSlot >= CARD_MARGIN) {
    return {
      top: aboveSlot,
      left: clamp(highlightRect.left, CARD_MARGIN, viewportWidth - width - CARD_MARGIN),
      width,
    };
  }

  return {
    top: CARD_MARGIN,
    left: clamp((viewportWidth - width) / 2, CARD_MARGIN, viewportWidth - width - CARD_MARGIN),
    width,
  };
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export default SovereigntyTourExtended;
