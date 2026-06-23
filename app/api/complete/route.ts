import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 7200;

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getProvider().getComplete(page);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
