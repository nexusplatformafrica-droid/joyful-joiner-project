import { createFileRoute } from "@tanstack/react-router";
import { LuoWatch } from "@/components/luo/LuoWatch";
import { restGetTitle } from "@/lib/luo-rest";

const SITE_URL = "https://luofilm.site";
type ShareSearch = { shareTitle?: string; shareDescription?: string; shareImage?: string };

function shareSearch(search: Record<string, unknown>): ShareSearch {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
  const result: ShareSearch = {};
  const title = text(search['shareTitle']);
  const description = text(search['shareDescription']);
  const image = text(search['shareImage']);
  if (title) result.shareTitle = title;
  if (description) result.shareDescription = description;
  if (image) result.shareImage = image;
  return result;
}

export const Route = createFileRoute("/luo/$id")({
  validateSearch: shareSearch,
  loaderDeps: ({ search }) => search,
  // Fetched server-side so WhatsApp / Facebook / X link previews show the real
  // poster, title and description of the shared movie.
  loader: ({ params, deps }) => {
    if (deps.shareTitle) {
      return {
        id: params.id,
        title: deps.shareTitle,
        description: deps.shareDescription ?? null,
        poster: deps.shareImage?.startsWith("https://") ? deps.shareImage : null,
        language: "luo" as const,
        updatedAt: null,
      };
    }
    return Promise.race([
      restGetTitle(params.id).catch(() => null),
      new Promise<null>((r) => setTimeout(() => r(null), 5000)),
    ]);
  },
  head: ({ params, loaderData }) => {
    const name = loaderData?.title ?? "Luo Translated Movie";
    const title = `${name} in Luo — Watch free on LUOFILM.SITE`;
    const description =
      loaderData?.description?.slice(0, 155) ??
      `Watch ${name} translated in Luo, free and in HD, on LUOFILM.SITE.`;
    const meta: { title?: string; name?: string; property?: string; content?: string }[] = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "video.movie" },
      { property: "og:site_name", content: "LUOFILM.SITE" },
      { property: "og:url", content: `${SITE_URL}/luo/${params.id}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (loaderData?.poster?.startsWith("https://")) {
      meta.push({ property: "og:image", content: loaderData.poster });
      meta.push({ property: "og:image:alt", content: `${name} poster` });
      meta.push({ name: "twitter:image", content: loaderData.poster });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: `${SITE_URL}/luo/${params.id}` }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Movie",
            name: `${name} (Luo translation)`,
            description,
            inLanguage: "luo",
            ...(loaderData?.poster ? { image: loaderData.poster } : {}),
          }),
        },
      ],
    };
  },
  component: () => <LuoWatch id={Route.useParams().id} language="luo" />,
});
