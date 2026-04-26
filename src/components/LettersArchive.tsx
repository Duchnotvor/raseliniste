import { useEffect, useState } from "react";
import { Loader2, Plus, Search, Download, Trash2, FileText, RefreshCcw } from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";

interface Letter {
  id: string;
  senderId: string;
  recipientNameSnapshot: string | null;
  bodyFinal: string;
  letterDate: string;
  version: number;
  parentLetterId: string | null;
  pdfPath: string | null;
  pdfGeneratedAt: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  recipient: { id: string; name: string } | null;
}

export default function LettersArchive({
  senders,
}: {
  senders: { id: string; name: string }[];
}) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [senderFilter, setSenderFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (senderFilter) params.set("senderId", senderFilter);
      const res = await fetch("/api/letters?" + params.toString());
      const data = await res.json();
      if (res.ok) setLetters(data.letters);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, senderFilter]);

  async function remove(l: Letter) {
    if (!confirm("Opravdu smazat tento dopis?")) return;
    setBusy(l.id);
    try {
      const res = await fetch(`/api/letters/${l.id}`, { method: "DELETE" });
      if (res.ok) load();
    } finally {
      setBusy(null);
    }
  }

  async function regenerate(l: Letter) {
    setBusy(l.id);
    try {
      const res = await fetch(`/api/letters/${l.id}/regenerate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        window.location.href = `/letters/${data.letter.id}`;
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="glass rounded-xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Hledat v dopisech…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={senderFilter}
          onChange={(e) => setSenderFilter(e.target.value)}
          className="px-3 py-2 rounded-md bg-background/40 border border-border/60 text-sm"
        >
          <option value="">Všichni odesílatelé</option>
          {senders.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <Button onClick={() => (window.location.href = "/letters/new")}>
          <Plus /> Nový dopis
        </Button>
      </div>

      {loading ? (
        <div className="glass rounded-xl p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Načítám…
        </div>
      ) : letters.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-muted-foreground">
          {senders.length === 0 ? (
            <>
              Nejdřív si vytvoř <a href="/settings/letter-senders" className="underline">odesílatele</a>{" "}
              (jméno, logo, sken podpisu, AI prompt). Potom budeš moct psát dopisy.
            </>
          ) : (
            <>Zatím žádné dopisy. Klikni na „Nový dopis".</>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {letters.map((l) => {
            const date = new Date(l.letterDate);
            const previewText = l.bodyFinal.slice(0, 200).replace(/\s+/g, " ");
            return (
              <div
                key={l.id}
                className="glass rounded-xl p-4 hover:bg-white/5 transition-colors"
                style={{ ["--c" as string]: "var(--tint-butter)" }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="size-10 rounded-md grid place-items-center shrink-0"
                    style={{
                      background: "color-mix(in oklch, var(--c) 16%, transparent)",
                      color: "var(--c)",
                    }}
                  >
                    <FileText className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <a href={`/letters/${l.id}`} className="font-medium hover:underline">
                      {l.recipientNameSnapshot ?? "(bez adresáta)"}
                    </a>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {l.sender.name} · v{l.version} · {date.toLocaleDateString("cs-CZ")}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1.5 line-clamp-2">{previewText}…</div>
                  </div>
                  <div className="flex gap-1">
                    <a
                      href={`/api/letters/${l.id}/pdf?download=1`}
                      className="p-2 rounded hover:bg-white/5 text-muted-foreground"
                      title="Stáhnout PDF"
                    >
                      <Download className="size-4" />
                    </a>
                    <button
                      onClick={() => regenerate(l)}
                      disabled={busy === l.id}
                      className="p-2 rounded hover:bg-white/5 text-muted-foreground"
                      title="Vytvořit novou verzi"
                    >
                      <RefreshCcw className="size-4" />
                    </button>
                    <button
                      onClick={() => remove(l)}
                      disabled={busy === l.id}
                      className="p-2 rounded hover:bg-destructive/20 text-muted-foreground"
                      title="Smazat"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
