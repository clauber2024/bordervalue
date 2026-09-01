import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { InstituteShell } from "../components/InstituteShell";

export const metadata: Metadata = {
  title: "Painel Analítico Border Value",
  description: "Produto principal para explorar dependência externa, concentração e produção nacional por cadeia.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <InstituteShell>{children}</InstituteShell>
      </body>
    </html>
  );
}
