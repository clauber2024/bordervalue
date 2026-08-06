import { NextResponse } from "next/server";
import { publishedApiBaseUrl } from "../../../../lib/publishedApi";

export async function POST() {
  const secret = process.env.ADMIN_TRIGGER_SECRET;
  if (!secret) {
    return NextResponse.json(
      { detail: "ADMIN_TRIGGER_SECRET nao configurado no servidor." },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(`${publishedApiBaseUrl()}/api/admin/refresh`, {
      method: "POST",
      headers: { "X-Admin-Secret": secret },
      cache: "no-store",
    });
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch {
    return NextResponse.json({ detail: "Erro de conexao com a API do backend." }, { status: 502 });
  }
}
