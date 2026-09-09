import type { NextConfig } from "next";
import path from "path";

/**
 * turbopack.root pins the project root explicitly. Without this, Turbopack
 * scans parent directories for lockfiles to infer a workspace root and can
 * land on the user's home directory (seen here as "ignored package-lock.json
 * in C:\Users\shaik because it would include your home directory"). This
 * project is not a monorepo, so the root is simply this directory.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  // pdf-parse (and its dependency @napi-rs/canvas, a native module) must be
  // resolved from node_modules at runtime, not bundled into the serverless
  // function. Without this, Turbopack inlines pdf-parse's module graph --
  // including code paths that reference browser-only globals like
  // DOMMatrix -- into the function bundle, which crashes every PDF upload
  // with "ReferenceError: DOMMatrix is not defined" (see
  // lib/server/documents/extract.ts's extractPdf, which also passes an
  // explicit Node-compatible CanvasFactory for the same underlying reason:
  // pdf-parse's default CanvasFactory is browser-only).
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
