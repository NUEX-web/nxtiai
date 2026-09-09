import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, getVoiceProfileCount } from "@/lib/server/plan-usage";
import { PLAN_CONFIG } from "@/lib/server/plans";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ voices: [] });
    }

    const { data: voices, error } = await supabase
      .from("custom_voices")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching custom voices:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ voices: voices || [] });
  } catch (error) {
    console.error("Unexpected error in GET /api/voices:", error);
    return NextResponse.json({ voices: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "You must be signed in to create custom voice profiles." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, tone, formality, vocabularyLevel, customInstructions } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Voice name is required." }, { status: 400 });
    }

    // Plan-based limit (lib/server/plans.ts is the single source of
    // truth) -- same pattern as app/api/rewrite/route.ts.
    const plan = await getUserPlan(supabase, user.id);
    const limit = PLAN_CONFIG[plan].limits.voiceProfileLimit;
    if (limit !== null) {
      const existingCount = await getVoiceProfileCount(supabase, user.id);
      if (existingCount >= limit) {
        return NextResponse.json(
          {
            error: `The ${PLAN_CONFIG[plan].name} plan is limited to ${limit} saved voice profile${limit === 1 ? "" : "s"}. Upgrade for more, or delete an existing one first.`,
          },
          { status: 402 }
        );
      }
    }

    const { data: voice, error } = await supabase
      .from("custom_voices")
      .insert({
        user_id: user.id,
        name: name.trim(),
        tone: tone || "neutral",
        formality: formality || "neutral",
        vocabulary_level: vocabularyLevel || "standard",
        custom_instructions: customInstructions ? customInstructions.trim() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error inserting custom voice:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ voice }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/voices:", error);
    return NextResponse.json({ error: "Failed to create voice profile." }, { status: 500 });
  }
}
