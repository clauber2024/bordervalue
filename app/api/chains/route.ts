import { NextResponse } from "next/server";
import { chainCatalog } from "../../../lib/chainCatalog";

export async function GET() {
  return NextResponse.json({ chains: chainCatalog });
}

