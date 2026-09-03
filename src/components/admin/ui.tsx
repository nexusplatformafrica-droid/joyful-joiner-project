import type { ReactNode } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

/** Soft admin surface: pastel glass panels on a warm gradient. */
export const SOFT_BG =
  "bg-[linear-gradient(160deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_45%,oklch(0.98_0.03_80))] text-[oklch(0.28_0.03_320)]";

export const softField =
  "h-11 w-full min-w-0 rounded-2xl bg-white/70 px-4 text-sm text-[oklch(0.28_0.03_320)] outline-none ring-1 ring-black/5 transition placeholder:opacity-50 focus:bg-white focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]";


export const goldBtn =
  "h-11 rounded-full bg-[linear-gradient(100deg,oklch(0.97_0.05_95),oklch(0.88_0.11_82))] px-5 text-sm font-bold text-[oklch(0.3_0.06_60)] shadow-[0_12px_28px_-14px_oklch(0.8_0.12_75)] transition hover:brightness-105 disabled:opacity-50";

export const ghostBtn =
  "h-11 rounded-full bg-white/70 px-5 text-sm font-semibold ring-1 ring-black/5 transition hover:bg-white disabled:opacity-50";

export function Panel({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className={`rounded-3xl bg-white/60 p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.6)] ring-1 ring-black/5 backdrop-blur ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-bold">{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "gold",
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ReactNode;
  tone?: "gold" | "rose" | "violet" | "mint";
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    gold: "from-[oklch(0.96_0.06_90)] to-[oklch(0.9_0.1_70)]",
    rose: "from-[oklch(0.96_0.05_20)] to-[oklch(0.9_0.09_10)]",
    violet: "from-[oklch(0.96_0.04_310)] to-[oklch(0.9_0.09_300)]",
    mint: "from-[oklch(0.96_0.05_160)] to-[oklch(0.9_0.09_170)]",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${tones[tone]} p-4 text-left shadow-[0_18px_40px_-30px_rgba(0,0,0,0.7)] ring-1 ring-white/50 transition ${
        onClick ? "hover:-translate-y-0.5 hover:brightness-[1.03]" : ""
      }`}
    >
      <span className="absolute -right-6 -top-6 size-20 rounded-full bg-white/40 blur-xl" />
      <div className="relative flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {icon && <span className="grid size-8 place-items-center rounded-2xl bg-white/60">{icon}</span>}
      </div>
      <p className="relative mt-3 text-[26px] font-black leading-none">{value}</p>
      {sub && <p className="relative mt-1.5 text-[11px] opacity-65">{sub}</p>}
    </button>
  );
}

export function SoftArea({
  data,
  color = "oklch(0.72 0.15 40)",
  height = 220,
  prefix = "",
}: {
  data: { day: string; value: number }[];
  color?: string;
  height?: number;
  prefix?: string;
}) {
  const id = `g-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.07)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "rgba(0,0,0,0.45)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.45)" }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            contentStyle={{
              borderRadius: 14,
              border: "none",
              boxShadow: "0 12px 30px -18px rgba(0,0,0,0.6)",
              fontSize: 12,
            }}
            formatter={(v) => [`${prefix}${Number(v).toLocaleString()}`, ""]}
          />
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${id})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Pill({ tone, children }: { tone: "on" | "off" | "warn"; children: ReactNode }) {
  const map = {
    on: "bg-[oklch(0.92_0.09_160)] text-[oklch(0.35_0.09_160)]",
    off: "bg-black/8 opacity-70",
    warn: "bg-[oklch(0.94_0.09_80)] text-[oklch(0.4_0.1_60)]",
  } as const;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${map[tone]}`}>{children}</span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-10 text-center text-[13px] opacity-55">{children}</p>;
}
