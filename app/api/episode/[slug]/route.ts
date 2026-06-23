import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const data = await getProvider().getEpisode(slug);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
