import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import "./globals.css";
import { InstituteShell } from "../components/InstituteShell";
import { EPLUS_SHELL_HEIGHT_PX } from "../lib/eplusShell";

export const metadata: Metadata = {
  title: "Painel Analítico Border Value",
  description: "Produto principal para explorar dependência externa, concentração e produção nacional por cadeia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ "--eplus-shell-h": `${EPLUS_SHELL_HEIGHT_PX}px` } as CSSProperties}>
        <InstituteShell>{children}</InstituteShell>
      </body>
    </html>
  );
}
