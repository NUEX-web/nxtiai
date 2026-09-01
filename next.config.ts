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
};

export default nextConfig;
