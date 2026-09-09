import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/server/plan-usage";
import { PLAN_CONFIG } from "@/lib/server/plans";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ history: [] });
    }

    // Plan-based cap (lib/server/plans.ts) -- null means unlimited, in
    // which case 200 is just a sane page size, not a plan restriction.
    const plan = await getUserPlan(supabase, user.id);
    const historyLimit = PLAN_CONFIG[plan].limits.historyLimit ?? 200;

    const { data: history, error } = await supabase
      .from("rewrites_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(historyLimit);

    if (error) {
      console.error("Error fetching rewrite history:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/history:", error);
    return NextResponse.json({ history: [] });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      // Clear all history for user
      const { error } = await supabase
        .from("rewrites_history")
        .delete()
        .eq("user_id", user.id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase
      .from("rewrites_history")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/history:", error);
    return NextResponse.json({ error: "Failed to delete history item." }, { status: 500 });
  }
}
