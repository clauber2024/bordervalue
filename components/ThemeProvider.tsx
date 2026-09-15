"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// defaultTheme="dark" + enableSystem={false}: ninguém que nunca tocar no
// toggle deve ver o tema mudar sozinho por preferência do SO -- o dashboard
// continua exatamente como hoje até a primeira escolha manual do usuário.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
    </NextThemesProvider>
  );
}
