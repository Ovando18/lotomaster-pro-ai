import { NextResponse } from "next/server";
import { fetchDraw } from "@/lib/server/sources";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ lottery: string }> }) {
  const { lottery } = await ctx.params;
  const contestParam = new URL(req.url).searchParams.get("contest");
  const contest = contestParam ? parseInt(contestParam, 10) : undefined;
  try {
    const result = await fetchDraw(lottery, contest);
    return NextResponse.json(result, {
      headers: { "cache-control": contest ? "s-maxage=86400, stale-while-revalidate=604800" : "s-maxage=300, stale-while-revalidate=1800" },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
