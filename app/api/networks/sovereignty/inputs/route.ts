import { NextRequest, NextResponse } from "next/server";

// Was reading a local JSON file from outputs/ (gitignored -- never
// deployed to Vercel, so this route always 503'd in production and
// SovereigntySankeyChart/GreenJobsTSBPanel silently fell back to their
// simplified single-product mode). The real published data now lives in
// Postgres, served by the FastAPI backend's own
// /api/networks/sovereignty/inputs route -- proxy to that instead,
// matching the pattern already used by lib/publishedApi.ts for
// /api/chain/*.

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const SUPPORTED_CHAINS = new Set(["silicio", "combustiveis_transicao", "fertilizantes", "aco"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chain = request.nextUrl.searchParams.get("chain")?.trim().toLowerCase();
  if (!chain || !SUPPORTED_CHAINS.has(chain)) {
    return NextResponse.json({ detail: `Cadeia AIPNET não suportada: ${chain ?? ""}` }, { status: 404 });
  }

  try {
    const response = await fetch(
      `${apiBaseUrl()}/api/networks/sovereignty/inputs?chain=${encodeURIComponent(chain)}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return NextResponse.json(
        { detail: `Métricas de soberania da cadeia ${chain} ainda não foram publicadas.` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { detail: `Não foi possível conectar à API Published para a cadeia ${chain}.` },
      { status: 503 },
    );
  }
}

function apiBaseUrl() {
  return (
    process.env.BORDER_VALUE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_BORDER_VALUE_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, "");
}
