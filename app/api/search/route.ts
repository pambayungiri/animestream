import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q) return NextResponse.json([]);
  try {
    const data = await getProvider().search(q);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
