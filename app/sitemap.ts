import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const root = (process.env.NEXT_PUBLIC_PROAR_ROOT_DOMAIN || process.env.PROAR_ROOT_DOMAIN || "proar.online").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return [
    { url: `https://${root}`, changeFrequency: "weekly", priority: 1 },
    { url: `https://${root}/termos`, changeFrequency: "monthly", priority: 0.3 },
    { url: `https://${root}/privacidade`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
