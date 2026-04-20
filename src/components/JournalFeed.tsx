import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Search,
  Smartphone,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

type Location = {
  lat: number;
  lng: number;
  name?: string;
  accuracy?: number;
};

type JournalEntry = {
  id: string;
  text: string;
  rawExcerpt: string | null;
  hashtags: string[];
  location: Location | null;
  status: "PENDING" | "CONFIRMED" | "DISCARDED";
  createdAt: string;
  confirmedAt: string | null;
  recording: { source: string; createdAt: string; rawText: string };
};

function mapsUrl(loc: Location): string {
  // Universal maps link — iOS otevře Apple Maps, Android Google Maps, desktop Google.
  return `https://maps.apple.com/?ll=${loc.lat},${loc.lng}&q=${encodeURIComponent(loc.name ?? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`)}`;
}

function formatCoords(loc: Location): string {
  return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
}

const TINT_BUTTER = "oklch(88% 0.12 92)";

function fmtTime(s: string): string {
  return new Date(s).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

function dayLabel(d: Date): string {
  const today = startOfDay(new Date());
  const diff = daysBetween(today, d);
  if (diff === 0) return "Dnes";
  if (diff === 1) return "Včera";
  if (diff === 2) return "Předevčírem";
  if (diff < 7) return d.toLocaleDateString("cs-CZ", { weekday: "long" });
  if (diff < 365) return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long" });
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
}

function groupByDay(entries: JournalEntry[]): Array<{ key: string; label: string; entries: JournalEntry[] }> {
  const groups = new Map<string, { label: string; entries: JournalEntry[] }>();
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const key = d.toISOString().slice(0, 10);
    if (!groups.has(key)) groups.set(key, { label: dayLabel(d), entries: [] });
    groups.get(key)!.entries.push(e);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, v]) => ({ key, ...v }));
}

export default function JournalFeed() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range filter
  type DatePreset = "7d" | "30d" | "90d" | "year" | "all" | "custom";
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [dateOpen, setDateOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Tags panel — agregovaný seznam všech tagů s počty
  const [allTags, setAllTags] = useState<Array<{ tag: string; count: number }>>([]);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [tagSearch, setTagSearch] = useState("");

  // Compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [newText, setNewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Toggle zobrazení originálu per entry
  const [showOriginal, setShowOriginal] = useState<Set<string>>(new Set());

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const PAGE_SIZE = 30;

  // Spočítá from/to ISO podle presetu
  function computeDateRange(): { from?: string; to?: string } {
    const now = new Date();
    const startOfNow = startOfDay(now);
    const endOfToday = new Date(startOfNow);
    endOfToday.setHours(23, 59, 59, 999);

    switch (datePreset) {
      case "7d": {
        const f = new Date(startOfNow);
        f.setDate(f.getDate() - 7);
        return { from: f.toISOString(), to: endOfToday.toISOString() };
      }
      case "30d": {
        const f = new Date(startOfNow);
        f.setDate(f.getDate() - 30);
        return { from: f.toISOString(), to: endOfToday.toISOString() };
      }
      case "90d": {
        const f = new Date(startOfNow);
        f.setDate(f.getDate() - 90);
        return { from: f.toISOString(), to: endOfToday.toISOString() };
      }
      case "year": {
        const f = new Date(now.getFullYear(), 0, 1);
        return { from: f.toISOString(), to: endOfToday.toISOString() };
      }
      case "custom": {
        return {
          from: customFrom ? new Date(customFrom + "T00:00:00").toISOString() : undefined,
          to: customTo ? new Date(customTo + "T23:59:59").toISOString() : undefined,
        };
      }
      case "all":
      default:
        return {};
    }
  }

  async function load(append = false) {
    if (append) setLoadingMore(true); else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (append) params.set("offset", String(entries.length));
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (tagFilter) params.set("tag", tagFilter);
      const { from, to } = computeDateRange();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/journal/entries?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Načtení selhalo.");
        return;
      }
      setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries));
      setTotal(data.total);
    } catch {
      setError("Síťová chyba.");
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }

  // Reload při změně filtru
  useEffect(() => { load(false); }, [debouncedSearch, tagFilter, datePreset, customFrom, customTo]);

  const hasMore = entries.length < total;

  // Načti agregovaný seznam tagů — obnovuj po každé změně entries (nový
  // zápis mohl přidat nový tag, smazání ubrat počet).
  async function loadTags() {
    try {
      const res = await fetch("/api/journal/tags");
      const data = await res.json();
      if (res.ok) setAllTags(data.tags);
    } catch {
      // silent — tag panel je nice-to-have, ne blocker
    }
  }
  useEffect(() => { loadTags(); }, [entries.length]);

  async function submitNew(e: React.FormEvent, opts: { redact: boolean }) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/journal/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: newText.trim(), redact: opts.redact }),
      });
      if (res.ok) {
        setNewText("");
        setComposeOpen(false);
        load();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit(id: string) {
    const res = await fetch(`/api/journal/entries/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: editText.trim() }),
    });
    if (res.ok) {
      const { entry } = await res.json();
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...entry } : e)));
      setEditingId(null);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm("Smazat tento zápis?")) return;
    const res = await fetch(`/api/journal/entries/${id}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });
    if (res.ok) setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function toggleOriginal(id: string) {
    setShowOriginal((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const groups = useMemo(() => groupByDay(entries), [entries]);

  // Filtered tagy podle search (pro expanded mode)
  const filteredTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.tag.includes(q));
  }, [allTags, tagSearch]);

  const TOP_N = 10;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Hledat v zápisech…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setDateOpen((v) => !v)} title="Časové období">
          <CalendarRange />
          {datePreset === "all"
            ? "Vše"
            : datePreset === "7d"
              ? "7 dní"
              : datePreset === "30d"
                ? "30 dní"
                : datePreset === "90d"
                  ? "90 dní"
                  : datePreset === "year"
                    ? "Letos"
                    : "Vlastní"}
          {dateOpen ? <ChevronUp /> : <ChevronDown />}
        </Button>
        <Button onClick={() => setComposeOpen((v) => !v)}>
          {composeOpen ? <X /> : <Plus />}
          {composeOpen ? "Zavřít" : "Nový zápis"}
        </Button>
      </div>

      {/* Date range expand */}
      {dateOpen && (
        <div className="glass-subtle rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: "all" as const, label: "Vše" },
              { id: "7d" as const, label: "Posledních 7 dní" },
              { id: "30d" as const, label: "Posledních 30 dní" },
              { id: "90d" as const, label: "Posledních 90 dní" },
              { id: "year" as const, label: "Tento rok" },
              { id: "custom" as const, label: "Vlastní období…" },
            ]).map((p) => {
              const active = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDatePreset(p.id)}
                  className={`px-3 py-1 rounded-md text-xs transition-colors ${
                    active ? "bg-white/15 text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {datePreset === "custom" && (
            <div className="flex items-center gap-2 text-xs pt-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-white/5 border border-border rounded-md px-2 py-1 text-foreground font-mono"
              />
              <span className="text-muted-foreground">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-white/5 border border-border rounded-md px-2 py-1 text-foreground font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Tag filter panel — top N chips + expand */}
      {allTags.length > 0 && (
        <div className="glass-subtle rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="size-3.5 text-muted-foreground" />

            {/* Aktivní filtr */}
            {tagFilter ? (
              <>
                <button
                  type="button"
                  onClick={() => setTagFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/15 text-foreground"
                  title="Zrušit filtr"
                >
                  <X className="size-3" /> #{tagFilter}
                </button>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                  aktivní filtr
                </span>
              </>
            ) : (
              <>
                {/* Top N chips — vždy nejpoužívanější */}
                {allTags.slice(0, TOP_N).map((t) => (
                  <button
                    key={t.tag}
                    type="button"
                    onClick={() => setTagFilter(t.tag)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                    title={`${t.count} ${t.count === 1 ? "zápis" : t.count < 5 ? "zápisy" : "zápisů"}`}
                  >
                    <span>#{t.tag}</span>
                    <span className="font-mono tabular text-[10px] opacity-60">{t.count}</span>
                  </button>
                ))}

                {/* Expand tlačítko pokud je tagů víc */}
                {allTags.length > TOP_N && (
                  <button
                    type="button"
                    onClick={() => setTagsExpanded((v) => !v)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors font-mono"
                  >
                    {tagsExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {tagsExpanded ? "sbalit" : `+${allTags.length - TOP_N} dalších`}
                  </button>
                )}

                <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                  {allTags.length} tagů
                </span>
              </>
            )}
          </div>

          {/* Expand panel: search + všechny tagy seskupené */}
          {tagsExpanded && !tagFilter && (
            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  placeholder="Filtrovat tagy…"
                  autoFocus
                  className="h-8 w-full rounded-md border border-border bg-input/40 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>
              <div className="max-h-60 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5 pr-1">
                  {filteredTags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Nic nenalezeno.</span>
                  ) : (
                    filteredTags.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => { setTagFilter(t.tag); setTagsExpanded(false); setTagSearch(""); }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <span>#{t.tag}</span>
                        <span className="font-mono tabular text-[10px] opacity-60">{t.count}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compose */}
      {composeOpen && (
        <form
          onSubmit={(e) => submitNew(e, { redact: false })}
          className="glass rounded-xl p-4 space-y-3"
          style={{ ["--c" as string]: TINT_BUTTER }}
        >
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Co se dneska stalo? Jak se cítíš?"
            autoFocus
            disabled={submitting}
            maxLength={20_000}
            className="w-full min-h-[160px] rounded-md border border-border bg-input/40 px-3 py-2.5 text-[15px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <Button type="submit" disabled={submitting || !newText.trim()}>
              {submitting ? <><Loader2 className="animate-spin" /> Ukládám…</> : <><Check /> Uložit 1:1</>}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={submitting || !newText.trim()}
              onClick={(e) => submitNew(e as unknown as React.FormEvent, { redact: true })}
              title="Učeše text přes Gemini a doplní hashtagy (~3 s)"
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Uložit + učesat
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setComposeOpen(false); setNewText(""); }}>
              Zrušit
            </Button>
            <span className="ml-auto text-xs text-muted-foreground font-mono tabular">
              {newText.length} / 20 000
            </span>
          </div>
        </form>
      )}

      {/* Stats */}
      {!loading && !error && (
        <div className="text-xs text-muted-foreground font-mono tabular">
          {debouncedSearch || tagFilter ? (
            <>nalezeno <span className="text-foreground">{total}</span> zápisů</>
          ) : (
            <><span className="text-foreground">{total}</span> zápisů celkem</>
          )}
        </div>
      )}

      {loading && (
        <div className="glass rounded-xl p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Načítám…
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">{error}</div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="glass rounded-xl py-16 text-center space-y-3">
          <BookOpen className="size-8 mx-auto text-muted-foreground" />
          <p className="font-serif text-xl text-foreground/90">
            {debouncedSearch || tagFilter ? "Nic se nenašlo." : "Zatím žádné zápisy."}
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {debouncedSearch || tagFilter
              ? "Zkus jiné slovo nebo tag."
              : 'Diktuj přes iPhone Shortcut nebo si napiš zápis ručně tlačítkem „Nový zápis".'}
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="font-serif text-xl mb-3 flex items-baseline gap-3 flex-wrap">
                <span>{group.label}</span>
                <span className="text-xs font-mono text-muted-foreground tabular">
                  {new Date(group.key).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
                  {group.entries.length} {group.entries.length === 1 ? "zápis" : group.entries.length < 5 ? "zápisy" : "zápisů"}
                </span>
              </h2>

              <div className="space-y-2.5">
                {group.entries.map((e) => {
                  const hasRedaction = e.recording.rawText && e.recording.rawText.trim() !== e.text.trim();
                  const isShowingOriginal = showOriginal.has(e.id);
                  const displayText = isShowingOriginal ? e.recording.rawText : e.text;

                  return (
                    <article
                      key={e.id}
                      className="glass rounded-xl p-4 relative overflow-hidden"
                      style={{ ["--c" as string]: TINT_BUTTER }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-2 rounded-full mt-2 shrink-0" style={{ background: "var(--c)" }} />
                        <div className="flex-1 min-w-0">
                          {/* Meta řádek */}
                          <div className="flex items-center gap-2 mb-1.5 text-xs flex-wrap">
                            <span className="font-mono tabular text-muted-foreground">{fmtTime(e.createdAt)}</span>
                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                              {e.recording.source === "SHORTCUT" && <Smartphone className="size-3" />}
                              {e.recording.source.toLowerCase()}
                            </span>
                            {e.location && (
                              <a
                                href={mapsUrl(e.location)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                title={`Otevřít v mapách · ${formatCoords(e.location)}${e.location.accuracy ? ` (±${Math.round(e.location.accuracy)} m)` : ""}`}
                              >
                                <MapPin className="size-3" />
                                {e.location.name ?? formatCoords(e.location)}
                              </a>
                            )}
                            {hasRedaction && (
                              <button
                                type="button"
                                onClick={() => toggleOriginal(e.id)}
                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                                title={isShowingOriginal ? "Zobrazit učesaný text" : "Zobrazit původní znění"}
                              >
                                <Eye className="size-3" />
                                {isShowingOriginal ? "redigováno" : "originál"}
                              </button>
                            )}
                            {e.status === "PENDING" && (
                              <span className="text-[9px] uppercase tracking-widest font-mono rounded px-1.5 py-0.5 bg-white/5 text-muted-foreground">
                                neconfirmed
                              </span>
                            )}
                          </div>

                          {/* Text / editor */}
                          {editingId === e.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(ev) => setEditText(ev.target.value)}
                                autoFocus
                                className="w-full min-h-[120px] rounded-md border border-border bg-input/40 px-3 py-2 text-[15px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => saveEdit(e.id)}><Check /> Uložit</Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Zrušit</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p
                                className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words cursor-text ${isShowingOriginal ? "text-muted-foreground italic" : ""}`}
                                onClick={() => { setEditingId(e.id); setEditText(e.text); }}
                                title="Klikni pro úpravu (upravuje se redigovaná verze)"
                              >
                                {displayText}
                              </p>

                              {/* Hashtagy */}
                              {e.hashtags.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {e.hashtags.map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => setTagFilter(t)}
                                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] transition-colors"
                                      style={{
                                        background: "color-mix(in oklch, var(--c) 14%, transparent)",
                                        color: "var(--c)",
                                      }}
                                    >
                                      #{t}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="mt-2 flex items-center justify-end gap-0.5 opacity-40 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={() => { setEditingId(e.id); setEditText(e.text); }}
                                  aria-label="Upravit"
                                  title="Upravit"
                                >
                                  <Edit2 className="size-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7"
                                  onClick={() => deleteEntry(e.id)}
                                  aria-label="Smazat"
                                  title="Smazat"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Načíst starší */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => load(true)} disabled={loadingMore}>
                {loadingMore ? (
                  <><Loader2 className="animate-spin" /> Načítám…</>
                ) : (
                  <>Načíst starší · zbývá {total - entries.length}</>
                )}
              </Button>
            </div>
          )}

          {!hasMore && entries.length > PAGE_SIZE && (
            <div className="text-center text-xs text-muted-foreground font-mono pt-2">
              konec · všechny zápisy načteny
            </div>
          )}
        </div>
      )}
    </div>
  );
}
