import { NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";

export const revalidate = 3600;

export async function GET() {
  try {
    const data = await getProvider().getSchedule();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
