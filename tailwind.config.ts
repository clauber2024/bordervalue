import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Aliases semânticos para as cores de estado já usadas cruamente no
        // código (bg-emerald-500/10, text-cyan-400, etc.). Só adiciona
        // sub-chaves novas (soft/line/text) às paletas padrão do Tailwind —
        // nenhuma classe numérica existente (emerald-500, cyan-400...) muda.
        emerald: {
          soft: "rgba(34,197,94,0.12)",
          line: "rgba(52,211,153,0.28)",
          text: "#6ee7b7",
        },
        cyan: {
          soft: "rgba(34,211,238,0.10)",
          line: "rgba(103,232,249,0.22)",
          text: "#67e8f9",
        },
        amber: {
          soft: "rgba(245,158,11,0.12)",
          line: "rgba(252,211,77,0.24)",
          text: "#fcd34d",
        },
        rose: {
          soft: "rgba(244,63,94,0.14)",
          line: "rgba(248,113,113,0.30)",
          text: "#fca5a5",
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
        // Aviso: o modificador de opacidade do Tailwind (ex. bg-surface-0/50)
        // não funciona sobre estes tokens (o valor já é hex/rgba via var()) --
        // cada opacidade usada precisa ser seu próprio token, como já feito
        // abaixo com surface-0/1/2.
        surface: {
          0: "var(--surface-0)",
          1: "var(--surface-1)",
          2: "var(--surface-2)",
        },
        border: {
          DEFAULT: "var(--border-default)",
          subtle: "var(--border-subtle)",
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
