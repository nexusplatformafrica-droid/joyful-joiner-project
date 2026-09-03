/**
 * Catalog access layer.
 *
 * These run in whichever runtime calls them: during SSR they hit the upstream
 * from the server, and in the browser they hit it directly (the catalog sends
 * permissive CORS headers). That keeps the app working on hosts whose egress
 * IPs the catalog blocks — the shell renders, the browser fills in the data.
 */
import {
  fetchDetails,
  fetchRelated,
  fetchHome,
  fetchSources,
  fetchPlayback,
  searchCatalog,
  unavailableTitle,
  type CatalogItem,
  type StreamSource,
  type Playback,
  type TitleDetails,
} from "./moviebox";

export type HomeData = {
  hero: CatalogItem[];
  rows: { title: string; items: CatalogItem[] }[];
  trending?: CatalogItem[];
  comingSoon?: CatalogItem[];
  degraded?: boolean;
};

export async function getHome(): Promise<HomeData> {
  try {
    return await fetchHome();
  } catch (error) {
    console.error(error);
    return { hero: [], rows: [], trending: [], comingSoon: [], degraded: true };
  }
}


export async function searchTitles({
  data,
}: {
  data: { q: string; page?: number };
}): Promise<CatalogItem[]> {
  try {
    return await searchCatalog(data.q, data.page ?? 1);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getTitle({
  data,
}: {
  data: { id: string };
}): Promise<TitleDetails & { unavailable?: boolean }> {
  try {
    return await fetchDetails(data.id);
  } catch (error) {
    console.error(error);
    return unavailableTitle(data.id);
  }
}

export async function getSources({
  data,
}: {
  data: { id: string; season?: number; episode?: number };
}): Promise<StreamSource[]> {
  try {
    return await fetchSources(data.id, data.season ?? 0, data.episode ?? 0);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getRelated({
  data,
}: {
  data: { id: string; title: string; genre: string | null; type: "movie" | "series" };
}): Promise<CatalogItem[]> {
  try {
    return await fetchRelated(data);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getPlayback({
  data,
}: {
  data: { id: string; season?: number; episode?: number; resourceId?: string | undefined };
}): Promise<Playback | null> {
  try {
    return await fetchPlayback(data.id, data.season ?? 0, data.episode ?? 0, data.resourceId);
  } catch (error) {
    console.error(error);
    return null;
  }
}
