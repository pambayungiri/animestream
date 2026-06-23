import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 43200;

export async function GET() {
  try {
    const data = await getProvider().getGenres();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
