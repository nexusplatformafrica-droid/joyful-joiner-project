import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LayoutDashboard, Users, Film, Wallet, Settings, ShieldCheck, MessageCircle } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { useIsAdmin } from "@/hooks/useAuth";
import { claimFirstAdmin } from "@/lib/db";
import { Overview, type AdminTab } from "@/components/admin/Overview";
import { UsersTab } from "@/components/admin/UsersTab";
import { ContentTab } from "@/components/admin/ContentTab";
import { NotifyTab } from "@/components/admin/NotifyTab";
import { WalletTab } from "@/components/admin/WalletTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { SOFT_BG, goldBtn } from "@/components/admin/ui";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — LUOFILM.SITE" },
      { name: "description", content: "Manage users, content, wallet and subscription settings on LUOFILM.SITE." },
      { property: "og:title", content: "Admin Dashboard — LUOFILM.SITE" },
      {
        property: "og:description",
        content: "Manage users, content, wallet and subscription settings on LUOFILM.SITE.",
      },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS: { k: AdminTab; t: string; i: typeof Users }[] = [
  { k: "overview", t: "Overview", i: LayoutDashboard },
  { k: "users", t: "Users", i: Users },
  { k: "content", t: "Content", i: Film },
  { k: "notify", t: "Notify", i: MessageCircle },
  { k: "wallet", t: "Wallet", i: Wallet },
  { k: "settings", t: "Settings", i: Settings },
];

function AdminPage() {
  const { isAdmin, checking, user } = useIsAdmin();
  const [tab, setTab] = useState<AdminTab>("overview");

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="px-2 pb-28 sm:px-4 lg:px-6 lg:pb-10">
          <div className={`mt-3 rounded-[32px] p-4 sm:p-6 ${SOFT_BG}`}>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-[24px] font-black leading-tight tracking-tight">Admin dashboard</h1>
                <p className="text-[12px] opacity-60">LUOFILM.SITE control centre</p>
              </div>
              <span className="flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-semibold ring-1 ring-black/5">
                <ShieldCheck className="size-4 text-[oklch(0.6_0.14_150)]" />
                {user?.email ?? "not signed in"}
              </span>
            </header>

            {checking ? (
              <p className="py-16 text-center text-[13px] opacity-60">Checking access…</p>
            ) : !user ? (
              <p className="py-16 text-center text-[13px] opacity-70">
                Sign in with the Login button above to open the dashboard.
              </p>
            ) : !isAdmin ? (
              <div className="py-16 text-center">
                <p className="text-[13px] opacity-70">
                  This account is not an admin yet. If no admin exists, claim it now.
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const ok = await claimFirstAdmin();
                      if (!ok) {
                        toast.error("An admin already exists.");
                        return;
                      }
                      toast.success("You are now the admin");
                      window.location.reload();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not claim admin access");
                    }
                  }}
                  className={`${goldBtn} mt-4`}
                >
                  Claim admin access
                </button>
              </div>
            ) : (
              <>
                <nav className="mt-5 flex flex-wrap gap-1.5 rounded-full bg-white/60 p-1.5 ring-1 ring-black/5">
                  {TABS.map((t) => (
                    <button
                      key={t.k}
                      type="button"
                      onClick={() => setTab(t.k)}
                      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition ${
                        tab === t.k
                          ? "bg-[linear-gradient(100deg,oklch(0.96_0.05_95),oklch(0.89_0.11_78))] shadow-[0_10px_24px_-16px_oklch(0.8_0.12_75)]"
                          : "opacity-60 hover:opacity-90"
                      }`}
                    >
                      <t.i className="size-4" /> {t.t}
                    </button>
                  ))}
                </nav>

                <div className="mt-5">
                  {tab === "overview" && <Overview go={setTab} />}
                  {tab === "users" && <UsersTab />}
                  {tab === "content" && <ContentTab userId={user.id} />}
                  {tab === "notify" && <NotifyTab />}
                  {tab === "wallet" && <WalletTab />}
                  {tab === "settings" && <SettingsTab />}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
