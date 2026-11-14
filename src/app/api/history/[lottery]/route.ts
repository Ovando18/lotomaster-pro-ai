import { NextResponse } from "next/server";
import { fetchHistory } from "@/lib/server/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, ctx: { params: Promise<{ lottery: string }> }) {
  const { lottery } = await ctx.params;
  const limit = Math.min(1000, parseInt(new URL(req.url).searchParams.get("limit") ?? "300", 10) || 300);
  try {
    const result = await fetchHistory(lottery, limit);
    return NextResponse.json(result, { headers: { "cache-control": "s-maxage=600, stale-while-revalidate=3600" } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, draws: [] }, { status: 502 });
  }
}
