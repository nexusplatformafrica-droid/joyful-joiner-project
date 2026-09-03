import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Icon3D } from "@/components/Icon3D";
import { FloatNav } from "@/components/youku/FloatNav";
import { searchTitles } from "@/lib/catalog.functions";
import type { CatalogItem } from "@/lib/moviebox";

export function TopBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (q) {
      setSuggestions([]);
      navigate({ to: "/search", search: { q } });
    }
  };

  // Live recommendations while typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const items = await searchTitles({ data: { q } });
      setSuggestions(items.slice(0, 6));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const searchForm = (auto = false, className = "") => (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="search-glow rounded-full p-[1.5px]">
        <form
          onSubmit={submit}
          className="flex h-9 items-center gap-2 rounded-full bg-background/90 px-4 backdrop-blur-md"
        >
          <Icon3D name="search" className="size-4 shrink-0" />
          <input
            autoFocus={auto}
            aria-label="Search movies and series"
            placeholder="Search movies and series"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/50"
          />
        </form>
      </div>

      {focused && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-11 z-50 overflow-hidden rounded-2xl bg-card/95 p-1.5 shadow-2xl ring-1 ring-border backdrop-blur-xl">
          {suggestions.map((item) => (
            <Link
              key={item.id}
              to="/watch/$id"
              params={{ id: item.id }}
              onClick={() => {
                setFocused(false);
                setSuggestions([]);
              }}
              className="flex items-center gap-3 rounded-xl px-2 py-1.5 transition hover:bg-foreground/10"
            >
              {item.poster ? (
                <img
                  src={item.poster}
                  alt=""
                  className="h-11 w-8 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="h-11 w-8 shrink-0 rounded-md bg-muted" />
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground">{item.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[item.year, item.genre].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className="pointer-events-auto fixed inset-x-0 top-0 z-50 flex flex-col gap-1.5 px-3 pb-1 pt-1.5 lg:h-14 lg:flex-row lg:items-center lg:gap-4 lg:py-0 lg:pl-[calc(var(--sidebar-w)+20px)]">
      {/* Mobile: one row — brand + nav + search all inside the float. */}
      <div className="pointer-events-auto -mx-3 flex justify-center overflow-x-auto px-3 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        <FloatNav onSearch={() => setSearchOpen((v) => !v)} />
      </div>

      {/* Desktop: float nav centred, search on the right. */}
      <div className="pointer-events-auto hidden items-center gap-3 lg:flex lg:h-auto lg:flex-1">
        <div className="flex flex-1 justify-center">
          <FloatNav />
        </div>
        <div className="min-w-0 shrink-0 lg:w-[320px]">{searchForm()}</div>
      </div>

      {searchOpen && (
        <div className="pointer-events-auto absolute inset-x-3 top-[52px] lg:hidden">
          {searchForm(true)}
        </div>
      )}
    </header>
  );
}
