"use client";

import codeDescriptions from "../data/code_descriptions.json";

type CodeKind = "ncm" | "prodlist" | "cnae";

const TABLES = codeDescriptions as Record<CodeKind, Record<string, string>>;

export function describeCode(kind: CodeKind, code: string): string | undefined {
  return TABLES[kind]?.[code];
}

export function CodeTooltip({ kind, code, className }: { kind: CodeKind; code: string; className?: string }) {
  const description = describeCode(kind, code);
  if (!description) return <span className={className}>{code}</span>;

  return (
    <span tabIndex={0} className="group/tip relative inline-block cursor-help outline-none">
      <span className={className}>{code}</span>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-64 -translate-x-1/2 rounded-md border border-white/10 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug text-zinc-200 opacity-0 shadow-lg shadow-black/40 transition-opacity duration-100 group-hover/tip:visible group-hover/tip:opacity-100 group-focus/tip:visible group-focus/tip:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}

export default CodeTooltip;
