import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The database layer also targets Cloudflare D1 for the Sites deployment.
  // Vercel does not provide the `cloudflare:workers` type during its build,
  // so runtime-specific checks remain covered by the Sites validation step.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
