import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, Send, MessageCircle, CheckCheck, ExternalLink, Users, Zap, Square } from "lucide-react";
import { db as supabase } from "@/lib/db";
import {
  callmebotKeyFor,
  normalisePhone,
  sendWhatsappBlast,
  waLink,
  type SendResult,
} from "@/lib/whatsapp.functions";
import { startBrowserBlast, type BrowserBlastHandle } from "@/lib/whatsapp-browser";
import { Empty, Panel, Pill, goldBtn, ghostBtn, softField } from "./ui";


type Row = { id: string; display_name: string | null; phone: string | null; email: string | null };

const TEMPLATES: { label: string; body: string }[] = [
  {
    label: "New release",
    body: "Hi {name} 👋\nNew on LUOFILM.SITE: *{title}* is out now — watch or download it free.\nhttps://luofilm.site",
  },
  {
    label: "New episodes",
    body: "Hi {name} 👋\nFresh episodes of *{title}* have just been added on LUOFILM.SITE.\nhttps://luofilm.site",
  },
  {
    label: "Luo translated",
    body: "Hi {name} 👋\n*{title}* is now available in Luo translation on LUOFILM.SITE.\nhttps://luofilm.site/luo",
  },
];

async function loadPeople() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).filter((u) => (u.phone ?? "").replace(/\D/g, "").length >= 9);
}

export function NotifyTab() {
  const send = useServerFn(sendWhatsappBlast);
  const people = useQuery({ queryKey: ["notify-people"], queryFn: loadPeople });
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(TEMPLATES[0]!.body);
  const [results, setResults] = useState<SendResult[]>([]);

  const rows = useMemo(() => {
    const list = people.data ?? [];
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) =>
      [u.display_name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(t)),
    );
  }, [people.data, q]);

  const selected = rows.filter((u) => picked[u.id]);
  const render = (u: Row) =>
    body
      .replaceAll("{name}", u.display_name?.split(" ")[0] || "there")
      .replaceAll("{title}", title || "a new title");

  const blast = useMutation({
    mutationFn: async (target?: Row[]) => {
      const list = target ?? selected;
      const recipients = list.map((u) => ({ phone: u.phone!, message: render(u) }));
      return send({ data: { recipients } });
    },
    onSuccess: (res) => {
      setResults(res.results);
      const ok = res.results.filter((r) => r.ok).length;
      if (ok) toast.success(`Sent to ${ok} user${ok > 1 ? "s" : ""}`);
      const missing = res.results.length - ok;
      if (missing) toast.message(`${missing} need a CallMeBot key — use the manual links below`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // One click, no confirmation: fires to every user with a phone number.
  const sendToEveryone = () => {
    const all = people.data ?? [];
    if (all.length === 0) {
      toast.error("No users with a phone number yet");
      return;
    }
    setPicked(Object.fromEntries(all.map((u) => [u.id, true])));
    blast.mutate(all);
  };


  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Panel
        title={`Users with WhatsApp · ${rows.length}`}
        action={
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 opacity-45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or number"
              className={`${softField} w-56 pl-9`}
            />
          </label>
        }
      >
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            className={ghostBtn}
            onClick={() => setPicked(Object.fromEntries(rows.map((u) => [u.id, true])))}
          >
            Select all
          </button>
          <button type="button" className={ghostBtn} onClick={() => setPicked({})}>
            Clear
          </button>
        </div>

        {people.isLoading ? (
          <Empty>Loading users…</Empty>
        ) : rows.length === 0 ? (
          <Empty>No users with a phone number yet.</Empty>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {rows.map((u) => {
              const has = !!callmebotKeyFor(u.phone ?? "");
              return (
                <li key={u.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/65 px-3 py-2.5 transition hover:bg-white">
                    <input
                      type="checkbox"
                      checked={!!picked[u.id]}
                      onChange={(e) => setPicked((p) => ({ ...p, [u.id]: e.target.checked }))}
                      className="size-4 accent-[oklch(0.8_0.12_75)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {u.display_name ?? "Unnamed"}
                      </span>
                      <span className="block truncate text-[12px] opacity-60">
                        +{normalisePhone(u.phone ?? "")}
                      </span>
                    </span>
                    <Pill tone={has ? "on" : "off"}>{has ? "Auto" : "Manual"}</Pill>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel title="Message">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setBody(t.body)}
                className={`${ghostBtn} h-9 px-4 text-[12px]`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Movie / series title (used as {title})"
            className={`${softField} mt-3`}
          />

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className={`${softField} mt-3 h-auto resize-y py-3 leading-relaxed`}
          />
          <p className="mt-2 text-[11px] opacity-60">
            Use <b>{"{name}"}</b> for the user&apos;s name and <b>{"{title}"}</b> for the release title.
          </p>

          {selected[0] && (
            <div className="mt-3 rounded-2xl bg-[oklch(0.96_0.05_150)] p-3 text-[12px] leading-relaxed whitespace-pre-wrap ring-1 ring-black/5">
              <span className="mb-1 flex items-center gap-1.5 font-bold opacity-70">
                <MessageCircle className="size-3.5" /> Preview · {selected[0].display_name ?? "user"}
              </span>
              {render(selected[0])}
            </div>
          )}

          <button
            type="button"
            disabled={selected.length === 0 || blast.isPending}
            onClick={() => blast.mutate(undefined)}
            className={`${goldBtn} mt-4 flex w-full items-center justify-center gap-2`}
          >
            <Send className="size-4" />
            {blast.isPending ? "Sending…" : `Send to ${selected.length} user${selected.length === 1 ? "" : "s"}`}
          </button>

          <button
            type="button"
            disabled={blast.isPending || (people.data ?? []).length === 0}
            onClick={sendToEveryone}
            className={`${ghostBtn} mt-2 flex w-full items-center justify-center gap-2`}
          >
            <Users className="size-4" />
            {blast.isPending
              ? "Sending…"
              : `Send to all ${(people.data ?? []).length} users now`}
          </button>

        </Panel>

        {results.length > 0 && (
          <Panel title="Delivery">
            {results.some((r) => !r.ok) && (
              <button
                type="button"
                className={`${ghostBtn} mb-3 flex w-full items-center justify-center gap-2`}
                onClick={() =>
                  results
                    .filter((r) => !r.ok && r.fallback)
                    .forEach((r, i) => setTimeout(() => window.open(r.fallback!, "_blank"), i * 400))
                }
              >
                <ExternalLink className="size-4" />
                Open all {results.filter((r) => !r.ok).length} remaining chats
              </button>
            )}
            <ul className="space-y-2 text-[12px]">
              {results.map((r) => (
                <li
                  key={r.phone}
                  className="flex items-center gap-2 rounded-2xl bg-white/65 px-3 py-2 ring-1 ring-black/5"
                >
                  <span className="flex-1 truncate">+{r.phone}</span>

                  {r.ok ? (
                    <span className="flex items-center gap-1 font-semibold text-[oklch(0.55_0.14_150)]">
                      <CheckCheck className="size-4" /> Sent
                    </span>
                  ) : (
                    <a
                      href={r.fallback}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-semibold underline"
                      title={r.detail ?? "No CallMeBot key for this number"}
                    >
                      Send manually <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed opacity-60">
              Fully automatic sending uses the WhatsApp Cloud API once its keys are saved — no action
              needed from your users. Anything it can’t deliver falls back to one-tap chat links here.
            </p>

          </Panel>
        )}
      </div>
    </div>
  );
}
