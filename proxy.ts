import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 renamed the "middleware" file convention to "proxy" (same
 * mechanism, same execution point — see nextjs.org/docs/app/api-reference/
 * file-conventions/proxy#migration-to-proxy). This is that rename, applied
 * via the same transform the official codemod performs: file renamed
 * middleware.ts -> proxy.ts, exported function renamed middleware -> proxy.
 * The Supabase session-refresh logic in lib/supabase/middleware.ts is
 * unchanged — only the entrypoint's name and location moved.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
