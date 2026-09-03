import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { watchTable } from "@/lib/fdb";

/**
 * Keeps the whole app live: any change in these collections (a new movie, a new
 * episode, an activated subscription, a payment) refreshes the screens that
 * show it — no page refresh needed.
 */
const WATCH: { table: string; keys: string[] }[] = [
  { table: "media", keys: ["luo-titles", "admin-titles", "admin-overview", "home-sections"] },
  { table: "episodes", keys: ["luo-episodes", "luo-all-episodes", "admin-episodes", "admin-overview"] },
  { table: "luo_subscriptions", keys: ["admin-users", "admin-overview", "admin-wallet"] },
  { table: "luo_transactions", keys: ["admin-wallet", "admin-overview", "relworx-transactions"] },
  { table: "profiles", keys: ["admin-users", "admin-overview", "admin-wallet"] },
  { table: "luo_activities", keys: ["admin-overview"] },
];

export function LiveSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const stops = WATCH.map(({ table, keys }) =>
      watchTable(table, () => {
        for (const key of keys) void qc.invalidateQueries({ queryKey: [key] });
        if (table === "luo_subscriptions")
          window.dispatchEvent(new Event("luofilm:subscription-changed"));
      }),
    );
    return () => stops.forEach((stop) => stop());
  }, [qc]);

  return null;
}
