import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { InstituteShell } from "../components/InstituteShell";
import { EPLUS_SHELL_HEIGHT_PX } from "../lib/eplusShell";
import { ThemeProvider } from "../components/ThemeProvider";

export const metadata: Metadata = {
  title: "Painel Analítico Border Value",
  description: "Produto principal para explorar dependência externa, concentração e produção nacional por cadeia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body style={{ "--eplus-shell-h": `${EPLUS_SHELL_HEIGHT_PX}px` } as CSSProperties}>
        {/* ThemeProvider fica só em volta do dashboard (children) -- a
        InstituteShell (faixa institucional) nunca reage ao tema. */}
        <InstituteShell>
          <ThemeProvider>{children}</ThemeProvider>
        </InstituteShell>
      </body>
    </html>
  );
}
