import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, Search, Crown, Ban } from "lucide-react";
import { db as supabase } from "@/lib/db";
import { fullDate, getPlans, money, seriesByDay, timeAgo, type Plan } from "@/lib/admin";
import { Empty, Panel, Pill, SoftArea, Stat, ghostBtn, goldBtn, softField } from "./ui";

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  last_seen: string | null;
  created_at: string;
};

async function loadUsers() {
  const [profiles, subs] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("luo_subscriptions").select("*").order("created_at", { ascending: false }),
  ]);
  if (profiles.error) throw profiles.error;
  return { profiles: (profiles.data ?? []) as Row[], subs: subs.data ?? [] };
}

const isActive = (s: { status: string; expires_at: string | null }) =>
  s.status === "active" && (!s.expires_at || new Date(s.expires_at).getTime() > Date.now());

export function UsersTab() {
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const users = useQuery({ queryKey: ["admin-users"], queryFn: loadUsers });

  const rows = useMemo(() => {
    const list = users.data?.profiles ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) =>
      [u.display_name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(t)),
    );
  }, [users.data, q]);

  if (openId) {
    const user = (users.data?.profiles ?? []).find((u) => u.id === openId);
    return <UserDetail user={user} onBack={() => setOpenId(null)} />;
  }

  const subsFor = (id: string) => (users.data?.subs ?? []).filter((s) => s.user_id === id);

  return (
    <Panel
      title={`Users · ${rows.length}`}
      action={
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-45" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone"
            className={`${softField} w-64 pl-9`}
          />
        </label>
      }
    >
      {users.isLoading ? (
        <Empty>Loading users…</Empty>
      ) : rows.length === 0 ? (
        <Empty>No users found.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wide opacity-55">
              <tr>
                <th className="px-3">Name</th>
                <th className="px-3">Email</th>
                <th className="px-3">Phone</th>
                <th className="px-3">Subscription</th>
                <th className="px-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const active = subsFor(u.id).find(isActive);
                return (
                  <tr
                    key={u.id}
                    onClick={() => setOpenId(u.id)}
                    className="cursor-pointer bg-white/65 transition hover:bg-white"
                  >
                    <td className="rounded-l-2xl px-3 py-3 font-semibold">
                      {u.display_name ?? "—"}
                    </td>
                    <td className="px-3 py-3 opacity-75">{u.email ?? "—"}</td>
                    <td className="px-3 py-3 opacity-75">{u.phone ?? "—"}</td>
                    <td className="px-3 py-3">
                      {active ? <Pill tone="on">{active.plan_name}</Pill> : <Pill tone="off">Free</Pill>}
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 opacity-70">{timeAgo(u.last_seen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function UserDetail({ user, onBack }: { user: Row | undefined; onBack: () => void }) {
  const qc = useQueryClient();
  const id = user?.id ?? "";
  const [tier, setTier] = useState<"vip" | "svip">("vip");
  const [planId, setPlanId] = useState("");

  const plans = useQuery({ queryKey: ["plans"], queryFn: getPlans });
  const detail = useQuery({
    queryKey: ["admin-user", id],
    enabled: !!id,
    queryFn: async () => {
      const [subs, tx, acts] = await Promise.all([
        supabase.from("luo_subscriptions").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("luo_transactions").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabase.from("luo_activities").select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(50),
      ]);
      return { subs: subs.data ?? [], tx: tx.data ?? [], acts: acts.data ?? [] };
    },
  });

  const tierPlans: Plan[] = (plans.data?.[tier] ?? []) as Plan[];
  const chosen = tierPlans.find((p) => p.id === planId) ?? tierPlans[0];
  const active = (detail.data?.subs ?? []).find(isActive);

  const activate = useMutation({
    mutationFn: async () => {
      if (!chosen) throw new Error("Pick a plan first");
      const expires = new Date(Date.now() + chosen.days * 86400000).toISOString();
      const { data, error } = await supabase
        .from("luo_subscriptions")
        .insert({
          user_id: id,
          plan_id: chosen.id,
          plan_name: chosen.name,
          tier,
          amount: chosen.price,
          status: "active",
          expires_at: expires,
        })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("luo_transactions").insert({
        user_id: id,
        subscription_id: data.id,
        kind: "subscription",
        amount: chosen.price,
        method: "manual",
        note: "Activated manually by admin",
        status: "success",
      });
    },
    onSuccess: () => {
      toast.success("Subscription activated");
      void qc.invalidateQueries({ queryKey: ["admin-user", id] });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("luo_subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", id)
        .eq("status", "active");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription deactivated");
      void qc.invalidateQueries({ queryKey: ["admin-user", id] });
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const spend = (detail.data?.tx ?? [])
    .filter((t) => t.status === "success")
    .reduce((s, t) => s + Number(t.amount), 0);
  const chart = seriesByDay(detail.data?.acts ?? [], 14);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className={`${ghostBtn} inline-flex items-center gap-2`}>
        <ArrowLeft className="size-4" /> All users
      </button>

      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-16 place-items-center rounded-3xl bg-[linear-gradient(140deg,oklch(0.95_0.06_90),oklch(0.88_0.11_60))] text-[22px] font-black">
            {(user?.display_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[19px] font-black leading-tight">{user?.display_name ?? "Unnamed user"}</p>
            <p className="flex flex-wrap items-center gap-3 text-[12px] opacity-70">
              <span className="flex items-center gap-1">
                <Mail className="size-3.5" /> {user?.email ?? "—"}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="size-3.5" /> {user?.phone ?? "—"}
              </span>
            </p>
          </div>
          <div className="ml-auto">
            {active ? <Pill tone="on">Active · {active.plan_name}</Pill> : <Pill tone="off">No membership</Pill>}
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total spent" value={money(spend)} tone="gold" sub={`${detail.data?.tx.length ?? 0} transactions`} />
        <Stat label="Subscriptions" value={detail.data?.subs.length ?? 0} tone="violet" sub="lifetime" />
        <Stat label="Last seen" value={timeAgo(user?.last_seen)} tone="mint" sub={`Joined ${fullDate(user?.created_at)}`} />
      </div>

      <Panel title="Engagement · last 14 days">
        <SoftArea data={chart} color="oklch(0.65 0.14 200)" height={200} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Membership control">
          <div className="grid grid-cols-2 gap-2">
            {(["vip", "svip"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTier(k);
                  setPlanId("");
                }}
                className={`h-10 rounded-2xl text-[13px] font-bold transition ${
                  tier === k ? "bg-white shadow" : "bg-white/50 opacity-65"
                }`}
              >
                {k === "vip" ? "VIP Member" : "SVIP Member"}
              </button>
            ))}
          </div>
          <select
            className={`${softField} mt-3`}
            value={chosen?.id ?? ""}
            onChange={(e) => setPlanId(e.target.value)}
          >
            {tierPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.price)} · {p.days} days
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={activate.isPending}
              onClick={() => activate.mutate()}
              className={`${goldBtn} inline-flex items-center gap-2`}
            >
              <Crown className="size-4" /> Activate plan
            </button>
            <button
              type="button"
              disabled={!active || deactivate.isPending}
              onClick={() => deactivate.mutate()}
              className={`${ghostBtn} inline-flex items-center gap-2 text-[oklch(0.55_0.18_25)]`}
            >
              <Ban className="size-4" /> Deactivate active plan
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {(detail.data?.subs ?? []).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-3 py-2 text-[12px]">
                <span className="font-semibold">
                  {s.plan_name} <span className="opacity-60">· {s.tier.toUpperCase()}</span>
                </span>
                <span className="opacity-65">{money(Number(s.amount))}</span>
                <span className="opacity-60">exp {fullDate(s.expires_at)}</span>
                {isActive(s) ? <Pill tone="on">active</Pill> : <Pill tone="off">{s.status}</Pill>}
              </div>
            ))}
            {(detail.data?.subs.length ?? 0) === 0 && <Empty>No subscriptions yet.</Empty>}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Transactions">
            {(detail.data?.tx.length ?? 0) === 0 ? (
              <Empty>No transactions.</Empty>
            ) : (
              <ul className="space-y-2">
                {detail.data?.tx.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-3 py-2 text-[12px]">
                    <span className="font-semibold">{money(Number(t.amount), t.currency)}</span>
                    <span className="opacity-65">{t.method ?? t.kind}</span>
                    <span className="opacity-55">{fullDate(t.created_at)}</span>
                    <Pill tone={t.status === "success" ? "on" : "warn"}>{t.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Recent activity">
            {(detail.data?.acts.length ?? 0) === 0 ? (
              <Empty>Nothing clicked yet.</Empty>
            ) : (
              <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {detail.data?.acts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-3 py-2 text-[12px]">
                    <span className="min-w-0 truncate">
                      <b>{a.action}</b>
                      {a.target ? <span className="opacity-65"> · {a.target}</span> : null}
                    </span>
                    <span className="shrink-0 opacity-55">{timeAgo(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
