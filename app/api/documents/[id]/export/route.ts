import { NextResponse } from "next/server";
import { NotImplementedError, UnauthorizedError, ValidationError, toErrorResponse } from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import { loadOwnedDocument } from "@/lib/server/documents/access";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type ExportFormat = "txt" | "docx" | "pdf";

function isExportFormat(value: unknown): value is ExportFormat {
  return value === "txt" || value === "docx" || value === "pdf";
}

/**
 * Export API boundary for a processed document. TXT is fully implemented
 * -- the processed result already *is* plain text, so returning it as a
 * download is real, not simulated. DOCX/PDF are not implemented yet: this
 * returns a clean, explicit 501 rather than a fake or empty file, per the
 * explicit "do not fake export functionality" requirement. The request/
 * response shape (POST { format }, a real file for txt, a typed
 * NOT_IMPLEMENTED error otherwise) is the boundary a future DOCX/PDF
 * generator plugs into without changing anything upstream of this route.
 */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const document = await loadOwnedDocument(supabase, user.id, id);

    if (document.status !== "ready" || !document.result_text) {
      throw new ValidationError("This document hasn't finished processing yet.");
    }

    const body: unknown = await request.json().catch(() => ({}));
    const format = body && typeof body === "object" && "format" in body ? (body as { format: unknown }).format : "txt";
    if (!isExportFormat(format)) {
      throw new ValidationError("Unsupported export format. Use txt, docx, or pdf.");
    }

    if (format === "docx" || format === "pdf") {
      throw new NotImplementedError(
        `Exporting as ${format.toUpperCase()} isn't built yet -- for now, copy the result from the editor or export as TXT.`
      );
    }

    const baseName = document.filename.replace(/\.[^.]+$/, "") || "document";
    return new NextResponse(document.result_text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}-nxtiai.txt"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
