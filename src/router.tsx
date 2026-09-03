import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Keep fetched rows (and therefore their already-loaded posters) around so
  // scrolling or refocusing the tab never blanks artwork that is on screen.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        staleTime: 5 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
      },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading a page the moment a link is hovered/touched so Luo and
    // Luganda open instantly instead of waiting for the click.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 30 * 1000,
  });

  return router;
};
