import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import type { SolarSovereigntyResponse } from "../../../../../types/solar-sovereignty";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const chain = request.nextUrl.searchParams.get("chain")?.trim().toLowerCase();
  const sources: Record<string, string[]> = {
    silicio: ["solar_sovereignty_2026", "solar_input_metrics.json"],
    combustiveis_transicao: ["sector_sovereignty_combustiveis_transicao_2026", "sector_input_metrics.json"],
    fertilizantes: ["sector_sovereignty_fertilizantes_2026", "sector_input_metrics.json"],
    aco: ["sector_sovereignty_aco_2026", "sector_input_metrics.json"],
  };
  const sourceParts = chain ? sources[chain] : undefined;
  if (!sourceParts) {
    return NextResponse.json({ detail: `Cadeia AIPNET não suportada: ${chain ?? ""}` }, { status: 404 });
  }

  try {
    const source = path.join(
      process.cwd(),
      "outputs",
      ...sourceParts,
    );
    const payload = JSON.parse(await readFile(source, "utf8")) as SolarSovereigntyResponse;
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { detail: `Métricas de soberania da cadeia ${chain} ainda não foram publicadas.` },
      { status: 503 },
    );
  }
}
