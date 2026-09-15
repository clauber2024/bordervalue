"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // O servidor nao sabe a escolha persistida no localStorage do cliente --
  // renderiza um placeholder neutro ate montar, pra nao arriscar mismatch de
  // hidratacao no icone.
  if (!mounted) {
    return <div className="h-9 w-9 shrink-0 rounded-xl border border-border bg-surface-1" aria-hidden />;
  }

  const isLight = resolvedTheme === "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isLight ? "dark" : "light")}
      aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
      title={isLight ? "Tema escuro" : "Tema claro"}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-1 text-ink-muted transition hover:border-emerald-300/25 hover:text-ink-heading"
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
