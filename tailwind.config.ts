import type { Config } from "tailwindcss";

// Liga um token de cor a uma variável CSS que guarda só os canais RGB (sem
// alpha), no padrão que o próprio Tailwind recomenda para cores custom que
// precisam funcionar com qualquer modificador de opacidade (bg-surface-0/95,
// border-border/[0.08]...) -- sem isso, o modificador é silenciosamente
// ignorado sobre uma cor vinda de var(). O tipo `Config` oficial do Tailwind
// não declara essa forma (função) como valor válido em `colors`, mesmo sendo
// suportada em runtime -- só quebra o build de produção (`next build` roda
// checagem de tipos; `next dev` não), então o retorno é tipado como `any` de
// propósito para não brigar com esse gap na tipagem.
function withOpacity(cssVar: string): any {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined ? `rgb(var(${cssVar}))` : `rgb(var(${cssVar}) / ${opacityValue})`;
}

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Aliases semânticos para as cores de estado já usadas cruamente no
        // código (bg-emerald-500/10, text-cyan-400, etc.). Só adiciona
        // sub-chaves novas (soft/line/text) às paletas padrão do Tailwind —
        // nenhuma classe numérica existente (emerald-500, cyan-400...) muda.
        // Sobrescreve os tons pastel (50-400) do Tailwind para reagirem ao
        // tema quando usados como texto (text-cyan-300 etc.) -- ver
        // app/globals.css para a justificativa completa. 500+ ficam
        // intocados (herdados do Tailwind, ja escuros o bastante).
        emerald: {
          soft: "rgba(34,197,94,0.12)",
          line: "rgba(52,211,153,0.28)",
          text: withOpacity("--emerald-300-rgb"),
          50: withOpacity("--emerald-50-rgb"),
          100: withOpacity("--emerald-100-rgb"),
          200: withOpacity("--emerald-200-rgb"),
          300: withOpacity("--emerald-300-rgb"),
          400: withOpacity("--emerald-400-rgb"),
          // Só como FUNDO de badge "invertido" (fundo escuro + texto claro
          // tier 300/400) -- vira pálido no claro em vez de continuar
          // escuro atrás de um texto que agora também escureceu.
          950: withOpacity("--emerald-950-rgb"),
        },
        cyan: {
          soft: "rgba(34,211,238,0.10)",
          line: "rgba(103,232,249,0.22)",
          text: withOpacity("--cyan-300-rgb"),
          50: withOpacity("--cyan-50-rgb"),
          100: withOpacity("--cyan-100-rgb"),
          200: withOpacity("--cyan-200-rgb"),
          300: withOpacity("--cyan-300-rgb"),
          950: withOpacity("--cyan-950-rgb"),
        },
        amber: {
          soft: "rgba(245,158,11,0.12)",
          line: "rgba(252,211,77,0.24)",
          text: withOpacity("--amber-300-rgb"),
          50: withOpacity("--amber-50-rgb"),
          100: withOpacity("--amber-100-rgb"),
          200: withOpacity("--amber-200-rgb"),
          300: withOpacity("--amber-300-rgb"),
          400: withOpacity("--amber-400-rgb"),
          950: withOpacity("--amber-950-rgb"),
        },
        red: {
          50: withOpacity("--red-50-rgb"),
          100: withOpacity("--red-100-rgb"),
          200: withOpacity("--red-200-rgb"),
          300: withOpacity("--red-300-rgb"),
          400: withOpacity("--red-400-rgb"),
          950: withOpacity("--red-950-rgb"),
        },
        rose: {
          soft: "rgba(244,63,94,0.14)",
          line: "rgba(248,113,113,0.30)",
          text: withOpacity("--rose-300-rgb"),
          300: withOpacity("--rose-300-rgb"),
        },
        // Extensão proposta, ainda não usada em nenhum componente existente.
        violet: {
          DEFAULT: "#8b5cf6",
          soft: "rgba(139,92,246,0.14)",
          line: "rgba(167,139,250,0.30)",
          text: "#c4b5fd",
        },
        // Tokens do toggle claro/escuro (Fase A) -- ligados a variáveis CSS
        // (app/globals.css) que trocam de valor sob `html.light`. Nomeado
        // "ink", não "text", para não colidir com as utilities text-{size}.
        // surface/border aceitam QUALQUER modificador de opacidade Tailwind
        // (bg-surface-0/95, border-border/[0.08], divide-border/[0.06]...),
        // já que a var por trás guarda só os canais RGB, não uma cor pronta.
        surface: {
          0: withOpacity("--surface-0-rgb"), // era zinc-950 (e /NN de opacidade)
          1: withOpacity("--surface-1-rgb"), // era zinc-900 (usar com /40, /60 etc.)
        },
        border: {
          DEFAULT: withOpacity("--border-rgb"), // era white (border-white/10, /[0.08], divide-white/[0.06], bg-white/[0.03]...)
        },
        ink: {
          heading: "var(--text-heading)",
          body: "var(--text-body)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
      },
    },
  },
  plugins: [],
};

export default config;
