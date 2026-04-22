import { useEffect, useState } from "react";
import { Loader2, Search, ExternalLink, Trash2, Check, BookOpen, Lightbulb } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

type NoteType = "KNOWLEDGE" | "THOUGHT";

interface Note {
  id: string;
  type: NoteType;
  text: string;
  rationale: string | null;
  knowledgeCategory: string | null;
  knowledgeUrl: string | null;
  knowledgeTags: string[];
  hashtags: string[];
  completedAt: string | null;
  createdAt: string;
}

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | NoteType>("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (typeFilter) params.set("type", typeFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (tagFilter) params.set("tag", tagFilter);
      if (showArchived) params.set("includeCompleted", "1");
      const res = await fetch("/api/notes?" + params.toString());
      const data = await res.json();
      if (res.ok) {
        setNotes(data.entries);
        setCategories(data.categories ?? []);
        setTags(data.tags ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, typeFilter, categoryFilter, tagFilter, showArchived]);

  async function archive(n: Note, done: boolean) {
    setBusy(n.id);
    try {
      const res = await fetch(`/api/notes/${n.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed: done }),
      });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(n: Note) {
    if (!confirm("Opravdu smazat poznámku?")) return;
    setBusy(n.id);
    try {
      const res = await fetch(`/api/notes/${n.id}`, { method: "DELETE" });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass rounded-xl p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Hledat v poznámkách…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as NoteType | "")}
            className="px-3 py-2 rounded-md bg-background/40 border border-border/60 text-sm"
          >
            <option value="">Vše</option>
            <option value="KNOWLEDGE">Knowledge</option>
            <option value="THOUGHT">Myšlenky</option>
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="size-4"
            />
            Archiv
          </label>
        </div>

        {(categories.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(categoryFilter === c ? "" : c)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  categoryFilter === c
                    ? "bg-[var(--tint-mint)]/25 text-foreground"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {c}
              </button>
            ))}
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTagFilter(tagFilter === t ? "" : t)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  tagFilter === t
                    ? "bg-[var(--tint-lavender)]/25 text-foreground"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                #{t.replace(/^#/, "")}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="glass rounded-xl p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Načítám…
        </div>
      ) : notes.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">
          Zatím žádné poznámky. Diktuj do Rašeliniště — Gemini rozpozná knowledge/myšlenky a přistanou tady.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notes.map((n) => {
            const Icon = n.type === "KNOWLEDGE" ? BookOpen : Lightbulb;
            const tint = n.type === "KNOWLEDGE" ? "mint" : "butter";
            return (
              <div
                key={n.id}
                className="glass rounded-xl p-4 flex flex-col gap-2"
                style={{
                  ["--c" as string]: `var(--tint-${tint})`,
                  opacity: n.completedAt ? 0.55 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="size-8 rounded-md grid place-items-center shrink-0"
                    style={{
                      background: "color-mix(in oklch, var(--c) 16%, transparent)",
                      color: "var(--c)",
                    }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm whitespace-pre-wrap break-words">{n.text}</div>
                    {n.knowledgeUrl && (
                      <a
                        href={n.knowledgeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3" />
                        {n.knowledgeUrl.replace(/^https?:\/\//, "").slice(0, 50)}
                      </a>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-mono text-muted-foreground">
                      {n.knowledgeCategory && (
                        <span className="px-1.5 py-0.5 rounded bg-[var(--tint-mint)]/15 text-[var(--tint-mint)]">
                          {n.knowledgeCategory}
                        </span>
                      )}
                      {n.knowledgeTags?.map((t) => (
                        <span key={t} className="opacity-80">#{t.replace(/^#/, "")}</span>
                      ))}
                      {n.hashtags?.filter((h) => !n.knowledgeTags?.includes(h)).map((h) => (
                        <span key={h} className="opacity-80">#{h.replace(/^#/, "")}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => archive(n, !n.completedAt)}
                    disabled={busy === n.id}
                    className="p-1.5 rounded hover:bg-white/5 transition-colors text-muted-foreground text-xs font-mono"
                    title={n.completedAt ? "Vrátit z archivu" : "Archivovat"}
                  >
                    {n.completedAt ? "↩" : <Check className="size-4" />}
                  </button>
                  <button
                    onClick={() => remove(n)}
                    disabled={busy === n.id}
                    className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-muted-foreground"
                    title="Smazat"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
