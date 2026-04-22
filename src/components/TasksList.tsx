import { useEffect, useState } from "react";
import { Check, CheckSquare, ExternalLink, Loader2, Send, Trash2, Sun, Calendar, CloudMoon, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";

type When = "TODAY" | "THIS_WEEK" | "SOMEDAY";

interface TaskEntry {
  id: string;
  text: string;
  suggestedProject: string | null;
  suggestedWhen: When | null;
  rationale: string | null;
  hashtags: string[];
  todoistTaskId: string | null;
  todoistProjectId: string | null;
  completedAt: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

const WHEN_META: Record<When | "NONE", { label: string; icon: typeof Sun; tint: string }> = {
  TODAY: { label: "Dnes", icon: Sun, tint: "peach" },
  THIS_WEEK: { label: "Tento týden", icon: Calendar, tint: "sky" },
  SOMEDAY: { label: "Někdy", icon: CloudMoon, tint: "lavender" },
  NONE: { label: "Bez termínu", icon: CloudMoon, tint: "sage" },
};

export default function TasksList({ todoistConfigured }: { todoistConfigured: boolean }) {
  const [entries, setEntries] = useState<TaskEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = showCompleted ? "/api/tasks?includeCompleted=1" : "/api/tasks";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setEntries(data.entries);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showCompleted]);

  async function pushTodoist(e: TaskEntry) {
    setBusy(e.id);
    try {
      const res = await fetch(`/api/tasks/${e.id}/todoist`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Push do Todoistu selhal.");
        return;
      }
      load();
    } finally {
      setBusy(null);
    }
  }

  async function markDone(e: TaskEntry, done: boolean) {
    setBusy(e.id);
    try {
      const res = await fetch(`/api/tasks/${e.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ completed: done }),
      });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(e: TaskEntry) {
    if (!confirm("Opravdu smazat úkol?")) return;
    setBusy(e.id);
    try {
      const res = await fetch(`/api/tasks/${e.id}`, { method: "DELETE" });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  // Grupování podle when
  const groups: Record<When | "NONE", TaskEntry[]> = {
    TODAY: [],
    THIS_WEEK: [],
    SOMEDAY: [],
    NONE: [],
  };
  for (const e of entries) {
    const key = (e.suggestedWhen ?? "NONE") as When | "NONE";
    groups[key].push(e);
  }

  const unfinishedCount = entries.filter((e) => !e.completedAt).length;

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Načítám…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          {unfinishedCount} {unfinishedCount === 1 ? "úkol" : unfinishedCount < 5 ? "úkoly" : "úkolů"}
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="size-4"
          />
          Zobrazit hotové
        </label>
      </div>

      {!todoistConfigured && (
        <div className="glass rounded-md px-4 py-3 text-sm text-muted-foreground">
          Tip: nastav Todoist v <strong>Nastavení → Todoist (Firewall)</strong> a získej tlačítko „Do Todoistu" u každého úkolu.
        </div>
      )}

      {entries.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">
          Zatím žádné úkoly. Diktuj do Rašeliniště (Capture) a Triage je sem pošle.
        </div>
      ) : (
        <div className="space-y-5">
          {(["TODAY", "THIS_WEEK", "SOMEDAY", "NONE"] as const).map((when) => {
            const list = groups[when];
            if (list.length === 0) return null;
            const meta = WHEN_META[when];
            const Icon = meta.icon;
            return (
              <div key={when}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Icon className="size-4" style={{ color: `var(--tint-${meta.tint})` }} />
                  <h2 className="font-serif text-lg">{meta.label}</h2>
                  <span className="text-xs font-mono text-muted-foreground">· {list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((e) => (
                    <TaskCard
                      key={e.id}
                      entry={e}
                      busy={busy === e.id}
                      onPush={() => pushTodoist(e)}
                      onDone={() => markDone(e, !e.completedAt)}
                      onDelete={() => remove(e)}
                      showTodoistButton={todoistConfigured}
                      tint={meta.tint}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  entry,
  busy,
  onPush,
  onDone,
  onDelete,
  showTodoistButton,
  tint,
}: {
  entry: TaskEntry;
  busy: boolean;
  onPush: () => void;
  onDone: () => void;
  onDelete: () => void;
  showTodoistButton: boolean;
  tint: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDone = Boolean(entry.completedAt);
  const inTodoist = Boolean(entry.todoistTaskId);
  const hasDetails = Boolean(entry.rationale || entry.hashtags?.length || entry.suggestedProject);

  return (
    <div
      className="glass rounded-xl p-4"
      style={{
        ["--c" as string]: `var(--tint-${tint})`,
        opacity: isDone ? 0.55 : 1,
      }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onDone}
          disabled={busy}
          className="mt-0.5 size-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors disabled:opacity-50"
          style={{
            borderColor: isDone ? "var(--c)" : "rgba(255,255,255,0.25)",
            background: isDone ? "color-mix(in oklch, var(--c) 30%, transparent)" : "transparent",
          }}
          title={isDone ? "Vrátit jako nehotové" : "Označit jako hotové"}
        >
          {isDone && <Check className="size-3.5" style={{ color: "var(--c)" }} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className={`text-sm ${isDone ? "line-through" : ""}`}>{entry.text}</div>

          <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px] font-mono text-muted-foreground">
            {entry.suggestedProject && (
              <span className="px-1.5 py-0.5 rounded bg-white/5">{entry.suggestedProject}</span>
            )}
            {entry.hashtags?.slice(0, 3).map((h) => (
              <span key={h} className="opacity-80">#{h.replace(/^#/, "")}</span>
            ))}
            {inTodoist && (
              <span className="flex items-center gap-1 text-[var(--tint-sage)]">
                <ExternalLink className="size-3" /> v Todoistu
              </span>
            )}
            {hasDetails && (
              <button
                onClick={() => setExpanded((x) => !x)}
                className="ml-auto flex items-center gap-0.5 hover:text-foreground"
              >
                {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                {expanded ? "méně" : "více"}
              </button>
            )}
          </div>

          {expanded && entry.rationale && (
            <div className="mt-2 text-xs text-muted-foreground italic border-l-2 pl-2" style={{ borderColor: "var(--c)" }}>
              {entry.rationale}
            </div>
          )}
        </div>

        <div className="flex items-start gap-1">
          {showTodoistButton && !inTodoist && !isDone && (
            <Button size="sm" variant="outline" onClick={onPush} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <><Send /> Todoist</>}
            </Button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="p-1.5 rounded hover:bg-destructive/20 transition-colors text-muted-foreground"
            title="Smazat"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
