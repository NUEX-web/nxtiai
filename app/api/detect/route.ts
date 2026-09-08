import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limiter";
import { detectAiText } from "@/lib/server/providers/detector";
import { RateLimitError, ValidationError, toErrorResponse } from "@/lib/server/errors";

export const runtime = "nodejs";

const TEXT_MAX_LENGTH = 5000;

const detectRequestSchema = z.object({
  text: z
    .string({ error: "text is required." })
    .trim()
    .min(1, "Enter some text to check.")
    .max(TEXT_MAX_LENGTH, `Text must be ${TEXT_MAX_LENGTH} characters or fewer.`),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Own rate-limit bucket (namespaced identifier) so heavy AI Detector
    // use never eats into a visitor's /api/rewrite budget, or vice versa.
    const identifier = `detect:${getClientIdentifier(request)}`;
    const rate = checkRateLimit(identifier);
    if (!rate.allowed) {
      throw new RateLimitError(rate.retryAfterMs);
    }

    const rawBody: unknown = await request.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON.");
    });
    const parsed = detectRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const result = await detectAiText(parsed.data.text);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
