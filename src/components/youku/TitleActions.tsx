import { useEffect, useState } from "react";
import { Download, Heart, MessageCircle, Share2, FileText, Check } from "lucide-react";
import { DownloadDialog } from "./DownloadDialog";

type Cast = { name: string; character: string | null; avatar: string | null };

type StreamSource = {
  id: string;
  url: string;
  resolution: number;
  codec: string | null;
  size: string | null;
  captions: { label: string; url: string }[];
};

type Comment = { id: string; name: string; text: string; at: number };

type Props = {
  titleId: string;
  titleName: string;
  description: string | null;
  cast: Cast[];
  sources: StreamSource[];
  downloadName: string;
  shareImage?: string | null;
  blobDownload?: boolean | undefined;
  catalogId?: string | undefined;
  season?: number | undefined;
  episode?: number | undefined;
  extraResolutions?: number[] | undefined;
};

const pill =
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold ring-1 transition sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-xs";

export function TitleActions({
  titleId,
  titleName,
  description,
  cast,
  sources,
  downloadName,
  shareImage,
  blobDownload,
  catalogId,
  season,
  episode,
  extraResolutions,
}: Props) {
  const [panel, setPanel] = useState<"synopsis" | "comments" | null>(null);
  const [liked, setLiked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  const likeKey = `luofilm:like:${titleId}`;
  const commentKey = `luofilm:comments:${titleId}`;

  useEffect(() => {
    try {
      setLiked(localStorage.getItem(likeKey) === "1");
      setComments(JSON.parse(localStorage.getItem(commentKey) ?? "[]"));
    } catch {
      /* storage unavailable */
    }
  }, [likeKey, commentKey]);

  const toggleLike = () => {
    setLiked((value) => {
      const next = !value;
      try {
        localStorage.setItem(likeKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const share = async () => {
    if (typeof window === "undefined") return;
    const shared = new URL(window.location.href);
    shared.searchParams.set("shareTitle", titleName);
    if (description) shared.searchParams.set("shareDescription", description.slice(0, 155));
    if (shareImage?.startsWith("https://")) shared.searchParams.set("shareImage", shareImage);
    const url = shared.toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: titleName, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed */
    }
  };

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [{ id: crypto.randomUUID(), name: "You", text, at: Date.now() }, ...comments];
    setComments(next);
    setDraft("");
    try {
      localStorage.setItem(commentKey, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const toggle = (value: "synopsis" | "comments") =>
    setPanel((current) => (current === value ? null : value));

  return (
    <div className="mt-4">
      <div className="-mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
        <button
          onClick={toggleLike}
          className={`${pill} ${
            liked
              ? "bg-brand text-brand-foreground ring-brand"
              : "bg-card text-muted-foreground ring-border hover:text-foreground"
          }`}
        >
          <Heart className={`size-4 ${liked ? "fill-current" : ""}`} />
          {liked ? "Liked" : "Like"}
        </button>

        <button
          onClick={share}
          className={`${pill} bg-card text-muted-foreground ring-border hover:text-foreground`}
        >
          {copied ? <Check className="size-4 text-brand" /> : <Share2 className="size-4" />}
          {copied ? "Copied" : "Share"}
        </button>

        <button
          onClick={() => toggle("comments")}
          className={`${pill} ${
            panel === "comments"
              ? "bg-brand text-brand-foreground ring-brand"
              : "bg-card text-muted-foreground ring-border hover:text-foreground"
          }`}
        >
          <MessageCircle className="size-4" />
          Comment{comments.length ? ` (${comments.length})` : ""}
        </button>

        <button
          onClick={() => toggle("synopsis")}
          className={`${pill} ${
            panel === "synopsis"
              ? "bg-brand text-brand-foreground ring-brand"
              : "bg-card text-muted-foreground ring-border hover:text-foreground"
          }`}
        >
          <FileText className="size-4" />
          Synopsis
        </button>

        <button
          onClick={() => setDownloadOpen(true)}
          data-tour="download"
          className={`${pill} bg-card text-muted-foreground ring-border hover:text-foreground`}
        >
          <Download className="size-4" />
          Download
        </button>
      </div>

      {panel === "synopsis" && (
        <div className="mt-3 rounded-[1rem] bg-card p-4 ring-1 ring-border">
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description ?? "No synopsis available for this title yet."}
          </p>

          {!!cast.length && (
            <>
              <h3 className="mt-4 text-[11px] uppercase tracking-widest text-muted-foreground">
                Cast &amp; crew
              </h3>
              <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
                {cast.map((person) => (
                  <div key={`${person.name}-${person.character ?? ""}`} className="w-20 shrink-0 text-center">
                    <div className="mx-auto size-20 overflow-hidden rounded-full bg-muted ring-1 ring-border">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt={person.name}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-sm font-bold text-muted-foreground">
                          {person.name.slice(0, 1)}
                        </div>
                      )}
                    </div>
                    <p className="mt-1.5 truncate text-[11px] font-semibold text-foreground">
                      {person.name}
                    </p>
                    {person.character && (
                      <p className="truncate text-[10px] text-muted-foreground">{person.character}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {panel === "comments" && (
        <div className="mt-3 rounded-[1rem] bg-card p-4 ring-1 ring-border">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addComment()}
              placeholder="Add a comment…"
              className="min-w-0 flex-1 rounded-full bg-background px-4 py-2 text-sm text-foreground outline-none ring-1 ring-border focus:ring-brand"
            />
            <button
              onClick={addComment}
              className="rounded-full bg-brand px-4 py-2 text-xs font-bold text-brand-foreground"
            >
              Post
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {comments.length ? (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand/20 text-[11px] font-bold text-brand">
                    {comment.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground">
                      {comment.name} · {new Date(comment.at).toLocaleDateString()}
                    </p>
                    <p className="break-words text-sm text-foreground">{comment.text}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No comments yet — be the first to say something.
              </p>
            )}
          </div>
        </div>
      )}

      <DownloadDialog
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
        sources={sources}
        baseName={downloadName}
        blobDownload={blobDownload}
        catalogId={catalogId}
        season={season}
        episode={episode}
        extraResolutions={extraResolutions}
      />
    </div>
  );
}
