"use client";

import React from "react";
import {
  Building2,
  Download,
  Search,
  Sparkles,
  UserCheck,
} from "lucide-react";

export function HeaderTopBar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/88 px-4 py-3.5 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold tracking-wide text-white">
                Border Value
              </span>
              <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                v1.0.0-rc.1
              </span>
            </div>
            <span className="block text-[10px] font-medium text-zinc-400">
              Cadeias Verdes | Plataforma Analítica de Estado
            </span>
          </div>
        </div>

        <label className="relative w-full md:w-[28rem]">
          <span className="sr-only">Buscar produto conceitual, NCM ou cadeia</span>
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Buscar produto conceitual, NCM ou cadeia..."
            className="h-10 w-full rounded-xl border border-white/10 bg-zinc-900/80 pl-9 pr-4 text-xs text-zinc-200 outline-none transition placeholder:text-zinc-500 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/10"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-2 rounded-xl border border-white/5 bg-zinc-900/60 px-3 py-1.5 text-xs sm:flex">
            <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
            <div className="text-right">
              <span className="block text-[10px] font-bold leading-tight text-zinc-200">
                Gabinete MDIC / BNDES
              </span>
              <span className="block text-[9px] text-zinc-500">
                Acesso nível ministerial
              </span>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-zinc-950 shadow-lg transition hover:bg-emerald-400 hover:shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Briefing
          </button>

          <span className="hidden items-center gap-1.5 rounded-xl border border-cyan-500/15 bg-cyan-500/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-cyan-300 lg:inline-flex">
            <Building2 className="h-3.5 w-3.5" />
            NIB
          </span>
        </div>
      </div>
    </header>
  );
}

