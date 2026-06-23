import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { id, mirror, quality } = await req.json();
    if (!id || mirror === undefined || !quality) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    const src = await getProvider().getEmbedUrl(Number(id), Number(mirror), quality);
    return NextResponse.json({ src });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch embed" }, { status: 500 });
  }
}
