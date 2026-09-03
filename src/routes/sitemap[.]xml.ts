import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { CATEGORIES } from "@/lib/categories";
import { restListTitles } from "@/lib/luo-rest";

const BASE_URL = "https://luofilm.site";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "hourly", priority: "1.0" },
          { path: "/luo", changefreq: "daily", priority: "0.9" },
          { path: "/luganda", changefreq: "daily", priority: "0.9" },
          { path: "/tutorial", changefreq: "monthly", priority: "0.7" },
        ];

        for (const c of CATEGORIES) {
          if (c.slug === "home") continue;
          entries.push({ path: `/category/${c.slug}`, changefreq: "daily", priority: "0.6" });
        }

        for (const t of await restListTitles()) {
          entries.push({
            path: `/${t.language}/${encodeURIComponent(t.id)}`,
            ...(t.updatedAt ? { lastmod: t.updatedAt } : {}),
            changefreq: "weekly",
            priority: "0.8",
          });
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
