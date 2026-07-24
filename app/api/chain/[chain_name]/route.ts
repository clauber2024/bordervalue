import { NextRequest, NextResponse } from "next/server";
import { loadDashboardPublishedProducts } from "../../../../lib/dashboardData";
import { fetchPublishedChain } from "../../../../lib/publishedApi";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { chain_name: string } },
) {
  const localProducts = loadDashboardPublishedProducts(params.chain_name, request.nextUrl.searchParams);

  if (localProducts?.length) {
    return NextResponse.json(localProducts);
  }

  try {
    const products = await fetchPublishedChain(params.chain_name, request.nextUrl.searchParams);

    if (!products.length) {
      return NextResponse.json(
        { detail: `Cadeia inexistente ou sem dados publicados: ${params.chain_name}` },
        { status: 404 },
      );
    }

    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { detail: "Erro de conexao com a API Published." },
      { status: 502 },
    );
  }
}
