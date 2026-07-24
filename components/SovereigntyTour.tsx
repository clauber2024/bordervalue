"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";

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

export type SovereigntyTourProps = {
  defaultOpen?: boolean;
  showLauncher?: boolean;
  className?: string;
};

const steps: TourStep[] = [
  {
    targetId: "nib-matrix",
    title: "1. Matriz NIB de Adensamento",
    content:
      "Aqui, o motor cruza o déficit comercial com a capacidade doméstica. Repare nas Enzimas Alfa-Amilase: elas estão no quadrante 'Modernizar/Expandir', indicando que o Brasil tem mercado, mas precisa internalizar a produção biotecnológica.",
  },
  {
    targetId: "vulnerability-radar",
    title: "2. Radar de Soberania (HHI)",
    content:
      "Este módulo monitora a concentração de fornecedores. Veja que para as Enzimas o HHI explodiu para 5.540 por conta do monopólio da Dinamarca. O sistema emitiu Alerta Vermelho de risco crítico de suprimento.",
  },
  {
    targetId: "proportionality-toggle",
    title: "3. Lente RenovaCalc",
    content:
      "Nem toda enzima vai para o combustível. Ao ativar este switch, aplicamos o Fator Proporcional da RenovaCalc, encolhendo os US$ 280M brutos para os 28,4% absorvidos estritamente pelo balanço de massa da Usina Neomille.",
  },
  {
    targetId: "sovereignty-sankey",
    title: "4. Grafo AIPNET de Interdependência",
    content:
      "Veja a jornada da molécula. A linha tracejada cinza avisa que a produção nacional de SAF está protegida por Sigilo Estatístico da PIA, blindando a tomada de decisão de dados parciais ou distorcidos.",
  },
];

const HIGHLIGHT_PADDING = 12;
const CARD_WIDTH = 384;
const CARD_MARGIN = 16;
const CARD_ESTIMATED_HEIGHT = 320;

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
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

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
            className="fixed inset-0 z-50"
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
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{activeStep.content}</p>
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
      top: clamp(highlightRect.top, CARD_MARGIN, viewportHeight - CARD_ESTIMATED_HEIGHT - CARD_MARGIN),
      left: rightSlot,
      width,
    };
  }

  if (leftSlot >= CARD_MARGIN) {
    return {
      top: clamp(highlightRect.top, CARD_MARGIN, viewportHeight - CARD_ESTIMATED_HEIGHT - CARD_MARGIN),
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
