import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search,
  Send,
  MessageCircle,
  CheckCheck,
  ExternalLink,
  Users,
  Zap,
  Square,
  Mail,
  Film,
} from "lucide-react";
import { db as supabase } from "@/lib/db";
import {
  callmebotKeyFor,
  normalisePhone,
  sendWhatsappBlast,
  type SendResult,
} from "@/lib/whatsapp.functions";
import { sendEmailBlast, type EmailResult } from "@/lib/email.functions";
import { renderNotifyEmail, renderNotifyText, SITE_URL, type NotifyContent } from "@/lib/email-template";
import { startBrowserBlast, type BrowserBlastHandle } from "@/lib/whatsapp-browser";
import { listAllEpisodes, listAllLuoTitles, type LuoEpisode, type LuoTitle } from "@/lib/luo";
import { Empty, Panel, Pill, goldBtn, ghostBtn, softField } from "./ui";

type Row = { id: string; display_name: string | null; phone: string | null; email: string | null };
type Channel = "whatsapp" | "email";

const TEMPLATES: { label: string; body: string }[] = [
  {
    label: "New release",
    body: "New on LUOFILM.SITE: *{title}* is out now — watch or download it free.\n{link}",
  },
  {
    label: "New episodes",
    body: "Fresh episodes of *{title}* have just been added on LUOFILM.SITE.\n{link}",
  },
  {
    label: "Luo translated",
    body: "*{title}* is now available in Luo translation on LUOFILM.SITE.\n{link}",
  },
];

async function loadPeople() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Row[];
}

const hasPhone = (u: Row) => (u.phone ?? "").replace(/\D/g, "").length >= 9;
const hasEmail = (u: Row) => /.+@.+\..+/.test(u.email ?? "");

export function NotifyTab() {
  const send = useServerFn(sendWhatsappBlast);
  const sendMail = useServerFn(sendEmailBlast);
  const people = useQuery({ queryKey: ["notify-people"], queryFn: loadPeople });
  const titles = useQuery({ queryKey: ["notify-titles"], queryFn: listAllLuoTitles });
  const episodes = useQuery({ queryKey: ["notify-episodes"], queryFn: listAllEpisodes });

  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [titleId, setTitleId] = useState("");
  const [episodeId, setEpisodeId] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [subject, setSubject] = useState("New on LUOFILM.SITE");
  const [body, setBody] = useState(TEMPLATES[0]!.body);
  const [results, setResults] = useState<SendResult[]>([]);
  const [mailResults, setMailResults] = useState<EmailResult[]>([]);
  const [serverless, setServerless] = useState(true);
  const [gap, setGap] = useState(8);
  const [progress, setProgress] = useState<{ i: number; total: number } | null>(null);
  const runRef = useRef<BrowserBlastHandle | null>(null);
  useEffect(() => () => runRef.current?.stop(), []);

  const chosenTitle: LuoTitle | undefined = (titles.data ?? []).find((t) => t.id === titleId);
  const titleEpisodes: LuoEpisode[] = useMemo(
    () => (episodes.data ?? []).filter((e) => e.title_id === titleId).sort((a, b) => a.season - b.season || a.episode - b.episode),
    [episodes.data, titleId],
  );
  const chosenEpisode = titleEpisodes.find((e) => e.id === episodeId);

  const content: NotifyContent | null = chosenTitle
    ? {
        title: chosenTitle.title,
        episode: chosenEpisode
          ? `S${chosenEpisode.season} · E${chosenEpisode.episode}${chosenEpisode.name ? ` — ${chosenEpisode.name}` : ""}`
          : null,
        posterUrl: chosenTitle.poster_url,
        link: `${SITE_URL}/${chosenTitle.language === "luganda" ? "luganda" : "luo"}/${chosenTitle.id}`,
        language: chosenTitle.language === "luganda" ? "Luganda" : "Luo",
        vj: chosenTitle.vj,
      }
    : manualTitle
      ? { title: manualTitle, link: SITE_URL }
      : null;

  const displayTitle = content
    ? `${content.title}${content.episode ? ` (${content.episode})` : ""}`
    : "a new title";

  // Up to 4 other library titles shown as recommendations in the email.
  const recommendations: NotifyContent[] = useMemo(
    () =>
      (titles.data ?? [])
        .filter((t) => t.id !== titleId && t.poster_url)
        .slice(0, 4)
        .map((t) => ({
          title: t.title,
          posterUrl: t.poster_url,
          link: `${SITE_URL}/${t.language === "luganda" ? "luganda" : "luo"}/${t.id}`,
        })),
    [titles.data, titleId],
  );

  const rows = useMemo(() => {
    const list = (people.data ?? []).filter(channel === "email" ? hasEmail : hasPhone);
    const t = q.trim().toLowerCase();
    if (!t) return list;
    return list.filter((u) => [u.display_name, u.email, u.phone].some((v) => (v ?? "").toLowerCase().includes(t)));
  }, [people.data, q, channel]);

  const selected = rows.filter((u) => picked[u.id]);

  const render = (u: Row) =>
    body
      .replaceAll("{name}", u.display_name?.split(" ")[0] || "there")
      .replaceAll("{title}", displayTitle)
      .replaceAll("{link}", content?.link || SITE_URL);

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
      if (missing) toast.message(`${missing} could not be delivered automatically — use the links below`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mailBlast = useMutation({
    mutationFn: async (target?: Row[]) => {
      const list = target ?? selected;
      const recipients = list.map((u) => {
        const name = u.display_name?.split(" ")[0] || null;
        const text = render(u).replace(/\*/g, "");
        return {
          email: u.email!,
          html: renderNotifyEmail({ name, heading: subject, body: text, content, recommendations }),
          text: renderNotifyText({ name, body: text, content }),
        };
      });
      return sendMail({ data: { subject, recipients } });
    },
    onSuccess: (res) => {
      setMailResults(res.results);
      if (!res.configured) {
        toast.error("Add your Resend API key in src/lib/email.functions.ts to send emails");
        return;
      }
      const ok = res.results.filter((r) => r.ok).length;
      toast.success(`Emailed ${ok} user${ok === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Serverless WhatsApp: runs in this browser only, driving WhatsApp Web tab by tab.
  const runBrowser = (list: Row[]) => {
    if (list.length === 0) {
      toast.error("No users with a phone number yet");
      return;
    }
    runRef.current?.stop();
    setResults([]);
    setProgress({ i: 0, total: list.length });
    try {
      const handle = startBrowserBlast(
        list.map((u) => ({ phone: u.phone!, message: render(u) })),
        Math.max(2, gap) * 1000,
        (e) => setProgress({ i: e.done ? e.total : e.index + 1, total: e.total }),
      );
      runRef.current = handle;
      handle.promise
        .then((n) => {
          toast.success(`Opened ${n} chat${n === 1 ? "" : "s"} in WhatsApp Web`);
          setResults(list.map((u) => ({ phone: normalisePhone(u.phone ?? ""), ok: true, status: "sent" as const })));
        })
        .catch((err: Error) => toast.error(err.message))
        .finally(() => setProgress(null));
    } catch (err) {
      setProgress(null);
      toast.error(err instanceof Error ? err.message : "Could not start");
    }
  };

  const stopBrowser = () => {
    runRef.current?.stop();
    setProgress(null);
  };

  const sendNow = (list: Row[]) => {
    if (list.length === 0) {
      toast.error(channel === "email" ? "No users with an email yet" : "No users with a phone number yet");
      return;
    }
    if (channel === "email") mailBlast.mutate(list);
    else if (serverless) runBrowser(list);
    else blast.mutate(list);
  };

  // One click, no confirmation: fires to every reachable user.
  const sendToEveryone = () => {
    const all = (people.data ?? []).filter(channel === "email" ? hasEmail : hasPhone);
    setPicked(Object.fromEntries(all.map((u) => [u.id, true])));
    sendNow(all);
  };

  const busy = blast.isPending || mailBlast.isPending || !!progress;
  const reachable = (people.data ?? []).filter(channel === "email" ? hasEmail : hasPhone).length;
  const previewUser = selected[0] ?? rows[0];
  const previewHtml = previewUser
    ? renderNotifyEmail({
        name: previewUser.display_name?.split(" ")[0] || null,
        heading: subject,
        body: render(previewUser).replace(/\*/g, ""),
        content,
      })
    : "";

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Panel
        title={`${channel === "email" ? "Users with email" : "Users with WhatsApp"} · ${rows.length}`}
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
          <Empty>{channel === "email" ? "No users with an email yet." : "No users with a phone number yet."}</Empty>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {rows.map((u) => {
              const auto = channel === "email" ? true : !!callmebotKeyFor(u.phone ?? "");
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
                      <span className="block truncate text-[13px] font-semibold">{u.display_name ?? "Unnamed"}</span>
                      <span className="block truncate text-[12px] opacity-60">
                        {channel === "email" ? u.email : `+${normalisePhone(u.phone ?? "")}`}
                      </span>
                    </span>
                    <Pill tone={auto ? "on" : "off"}>{auto ? "Auto" : "Manual"}</Pill>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel title="Message">
          <div className="mb-3 flex gap-2">
            {(["whatsapp", "email"] as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setChannel(c);
                  setPicked({});
                }}
                className={`${channel === c ? goldBtn : ghostBtn} h-9 flex-1 justify-center gap-2 text-[12px]`}
              >
                {c === "email" ? <Mail className="size-4" /> : <MessageCircle className="size-4" />}
                {c === "email" ? "Email" : "WhatsApp"}
              </button>
            ))}
          </div>

          {/* Pick the movie / episode this notification is about */}
          <div className="rounded-2xl bg-white/65 p-3 ring-1 ring-black/5">
            <span className="flex items-center gap-1.5 text-[12px] font-bold opacity-70">
              <Film className="size-3.5" /> What are you announcing?
            </span>
            <select
              value={titleId}
              onChange={(e) => {
                setTitleId(e.target.value);
                setEpisodeId("");
              }}
              className={`${softField} mt-2`}
            >
              <option value="">— Pick from your library —</option>
              {(titles.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.language === "luganda" ? "Luganda" : "Luo"}
                  {t.kind === "series" ? " · series" : ""}
                </option>
              ))}
            </select>

            {titleId && titleEpisodes.length > 0 && (
              <select value={episodeId} onChange={(e) => setEpisodeId(e.target.value)} className={`${softField} mt-2`}>
                <option value="">Whole series (no specific episode)</option>
                {titleEpisodes.map((e) => (
                  <option key={e.id} value={e.id}>
                    S{e.season} · E{e.episode}
                    {e.name ? ` — ${e.name}` : ""}
                  </option>
                ))}
              </select>
            )}

            {!titleId && (
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                placeholder="…or type a title manually"
                className={`${softField} mt-2`}
              />
            )}

            {chosenTitle && (
              <div className="mt-3 flex items-center gap-3">
                {chosenTitle.poster_url && (
                  <img src={chosenTitle.poster_url} alt="" className="h-16 w-11 rounded-lg object-cover" />
                )}
                <div className="min-w-0 text-[12px]">
                  <div className="truncate font-bold">{displayTitle}</div>
                  <div className="truncate opacity-60">{content?.link}</div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => {
                  setBody(t.body);
                  setSubject(t.label === "New episodes" ? "New episodes just dropped" : "New on LUOFILM.SITE");
                }}
                className={`${ghostBtn} h-9 px-4 text-[12px]`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {channel === "email" && (
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className={`${softField} mt-3`}
            />
          )}

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className={`${softField} mt-3 h-auto resize-y py-3 leading-relaxed`}
          />
          <p className="mt-2 text-[11px] opacity-60">
            Use <b>{"{name}"}</b>, <b>{"{title}"}</b> and <b>{"{link}"}</b> — they are filled per user.
          </p>

          {channel === "whatsapp" && previewUser && (
            <div className="mt-3 rounded-2xl bg-[oklch(0.96_0.05_150)] p-3 text-[12px] leading-relaxed whitespace-pre-wrap ring-1 ring-black/5">
              <span className="mb-1 flex items-center gap-1.5 font-bold opacity-70">
                <MessageCircle className="size-3.5" /> Preview · {previewUser.display_name ?? "user"}
              </span>
              {render(previewUser)}
            </div>
          )}

          {channel === "email" && previewHtml && (
            <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-black/10">
              <iframe title="Email preview" srcDoc={previewHtml} className="h-[380px] w-full bg-black" />
            </div>
          )}

          {channel === "whatsapp" && (
            <div className="mt-4 rounded-2xl bg-white/65 p-3 ring-1 ring-black/5">
              <label className="flex cursor-pointer items-center gap-3 text-[13px] font-semibold">
                <input
                  type="checkbox"
                  checked={serverless}
                  onChange={(e) => setServerless(e.target.checked)}
                  className="size-4 accent-[oklch(0.8_0.12_75)]"
                />
                <Zap className="size-4" />
                Serverless mode — send from this browser
              </label>
              {serverless && (
                <div className="mt-2 flex items-center gap-2 text-[12px] opacity-70">
                  <span>Seconds between chats</span>
                  <input
                    type="number"
                    min={2}
                    max={60}
                    value={gap}
                    onChange={(e) => setGap(Number(e.target.value) || 8)}
                    className={`${softField} h-8 w-20`}
                  />
                </div>
              )}
              <p className="mt-2 text-[11px] leading-relaxed opacity-60">
                WhatsApp has no free API that delivers to people who never opted in — this mode opens each chat in your
                own WhatsApp Web. For true one-click delivery to everyone, use the Email channel.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={selected.length === 0 || busy}
            onClick={() => sendNow(selected)}
            className={`${goldBtn} mt-3 flex w-full items-center justify-center gap-2`}
          >
            <Send className="size-4" />
            {busy ? "Sending…" : `Send to ${selected.length} user${selected.length === 1 ? "" : "s"}`}
          </button>

          <button
            type="button"
            disabled={busy || reachable === 0}
            onClick={sendToEveryone}
            className={`${ghostBtn} mt-2 flex w-full items-center justify-center gap-2`}
          >
            <Users className="size-4" />
            {busy ? "Sending…" : `Send to all ${reachable} users now`}
          </button>

          {progress && (
            <div className="mt-3 space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-[oklch(0.8_0.12_75)] transition-all"
                  style={{ width: `${(progress.i / Math.max(1, progress.total)) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[12px] opacity-70">
                <span>
                  {progress.i} / {progress.total} chats opened
                </span>
                <button
                  type="button"
                  onClick={stopBrowser}
                  className="flex items-center gap-1 font-semibold underline"
                >
                  <Square className="size-3.5" /> Stop
                </button>
              </div>
            </div>
          )}
        </Panel>

        {channel === "email" && mailResults.length > 0 && (
          <Panel title="Email delivery">
            <ul className="space-y-2 text-[12px]">
              {mailResults.map((r) => (
                <li
                  key={r.email}
                  className="flex items-center gap-2 rounded-2xl bg-white/65 px-3 py-2 ring-1 ring-black/5"
                >
                  <span className="flex-1 truncate">{r.email}</span>
                  {r.ok ? (
                    <span className="flex items-center gap-1 font-semibold text-[oklch(0.55_0.14_150)]">
                      <CheckCheck className="size-4" /> Sent
                    </span>
                  ) : (
                    <span className="truncate font-semibold opacity-60" title={r.detail}>
                      Failed
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {channel === "whatsapp" && results.length > 0 && (
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
                      title={r.detail ?? "No automatic route for this number"}
                    >
                      Send manually <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
