import type { ReactNode } from "react";
import { Montserrat } from "next/font/google";
import { EPLUS_SHELL_HEIGHT_PX } from "../lib/eplusShell";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Paleta oficial — Manual de Identidade Visual, Instituto E+ (2025).
// Escopo: só a casca institucional (esta faixa). O dashboard em si
// continua na paleta dark do Border Value, sem nenhuma linha alterada.
const EPLUS = {
  ink: "#03254d", // azul marinho — cor institucional (manual, seç. 2.1)
  accent: "#eb682f", // laranja do "+" no arquivo oficial da logo
  lime: "#d9f453", // verde-limão — cor principal (manual, seç. 3)
  violet: "#4d41ff", // azul-violeta — cor principal (manual, seç. 3)
  muted: "#6a6c6c", // cinza escuro — cor auxiliar
  border: "rgba(3, 37, 77, 0.16)",
};

// Logo aplicada sempre sobre fundo branco estável e sólido — nunca sobre o
// glassmorphism escuro do dashboard (regra do manual, seç. 2.3/2.4: não
// aplicar diretamente sobre fundos instáveis).
const LOGO_WIDTH = 119;
const LOGO_HEIGHT = 24;

function GradientRule({ flip = false }: { flip?: boolean }) {
  return (
    <div
      aria-hidden
      className={`absolute inset-x-0 h-[3px] ${flip ? "bottom-0" : "top-0"}`}
      style={{
        background: `linear-gradient(90deg, ${EPLUS.violet}, ${EPLUS.lime}, ${EPLUS.accent})`,
      }}
    />
  );
}

function TopBand() {
  return (
    <div
      className={`${montserrat.className} sticky top-0 z-[60] overflow-hidden border-b bg-white`}
      style={{ borderColor: EPLUS.border, height: EPLUS_SHELL_HEIGHT_PX }}
    >
      <GradientRule />
      <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-8">
        <img
          src="/brand/eplus-logo-2025.svg"
          alt="Instituto E+"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          className="h-6 w-auto shrink-0"
        />
        <span
          className="hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold sm:inline-flex"
          style={{ color: EPLUS.ink, borderColor: EPLUS.border, background: "rgba(3,37,77,0.05)" }}
        >
          Border Value · um produto do Instituto E+
        </span>
      </div>
    </div>
  );
}

function BottomBand() {
  return (
    <div
      className={`${montserrat.className} relative border-t bg-white`}
      style={{ borderColor: EPLUS.border }}
    >
      <GradientRule flip />
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-6 sm:px-8">
        <div className="flex max-w-lg flex-col gap-2">
          <img
            src="/brand/eplus-logo-2025.svg"
            alt="Instituto E+"
            width={LOGO_WIDTH}
            height={LOGO_HEIGHT}
            className="h-6 w-auto"
          />
          <p className="text-[12px] leading-relaxed" style={{ color: EPLUS.muted }}>
            O Border Value é uma ferramenta analítica do Instituto E+ para diagnóstico de
            soberania de insumos da transição energética.
          </p>
        </div>
        <a
          href="https://emaisenergia.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap text-sm font-semibold underline-offset-4 hover:underline"
          style={{ color: EPLUS.ink }}
        >
          Conhecer o Instituto E+ →
        </a>
      </div>
      <div className="mx-auto max-w-[1240px] px-4 pb-4 sm:px-8">
        <p
          className="border-t pt-3 text-[11px]"
          style={{ color: EPLUS.muted, borderColor: EPLUS.border }}
        >
          Logotipo e paleta conforme o Manual de Identidade Visual do Instituto E+ (2025).
        </p>
      </div>
    </div>
  );
}

export function InstituteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopBand />
      {children}
      <BottomBand />
    </>
  );
}
