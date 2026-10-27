import { brandIconSvg } from "@/lib/brand-assets";
export const runtime = "edge";
export function GET(request: Request) {
  const variant = new URL(request.url).searchParams.get("variant") === "mobile" ? "mobile" : "system";
  return new Response(brandIconSvg(variant), { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
}
