import { NextRequest, NextResponse } from "next/server";

// Proxies to the FastAPI backend's /api/energy-context/{chain_name},
// matching the pattern used by app/api/networks/sovereignty/inputs/route.ts
// and lib/publishedApi.ts for /api/chain/*.

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const SUPPORTED_CHAINS = new Set(["silicio", "combustiveis_transicao", "fertilizantes", "aco"]);

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { chain_name: string } },
) {
  const chain = params.chain_name?.trim().toLowerCase();
  if (!chain || !SUPPORTED_CHAINS.has(chain)) {
    return NextResponse.json({ detail: `Cadeia não suportada: ${chain ?? ""}` }, { status: 404 });
  }

  const year = request.nextUrl.searchParams.get("year");
  const query = year ? `?year=${encodeURIComponent(year)}` : "";

  try {
    const response = await fetch(
      `${apiBaseUrl()}/api/energy-context/${encodeURIComponent(chain)}${query}`,
      { cache: "no-store", headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return NextResponse.json(
        { detail: `Contexto energético BEN da cadeia ${chain} ainda não foi publicado.` },
        { status: response.status },
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload);
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
