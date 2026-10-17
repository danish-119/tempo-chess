import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

const ROUTES = ["", "/analyze", "/editor", "/review", "/practice", "/play", "/learn", "/learn/openings", "/learn/tactics", "/learn/glossary", "/about", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((r) => ({ url: `${SITE.url}${r}`, changeFrequency: "monthly", priority: r === "" ? 1 : 0.6 }));
}
