import { useState } from "react";
import { Loader2, Send, Check } from "lucide-react";
import { Button } from "./ui/Button";

export default function CaptureForm() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<null | { count: number; recordingId: string }>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setPending(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, source: "WEB" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? "Zpracování selhalo.");
        return;
      }
      setResult({ count: data.entriesCount ?? 0, recordingId: data.recordingId });
      setText("");
    } catch {
      setError("Síťová chyba.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-mono">
          Text
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={pending}
          placeholder="Napiš (nebo vlož přepis z Wispr Flow) cokoliv — úkol, myšlenku, deník, kontext. Gemini to rozdělí a klasifikuje."
          className="w-full min-h-[240px] rounded-md border border-border bg-input/40 px-3 py-2.5 text-[15px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          maxLength={20_000}
          required
        />
        <div className="text-xs text-muted-foreground font-mono tabular text-right">
          {text.length.toLocaleString("cs-CZ")} / 20 000
        </div>
      </div>

      {result && (
        <div
          className="rounded-md border px-3 py-2 text-sm flex items-center gap-2"
          style={{
            background: "color-mix(in oklch, var(--tint-sage) 12%, transparent)",
            borderColor: "color-mix(in oklch, var(--tint-sage) 35%, transparent)",
          }}
        >
          <Check className="size-4" style={{ color: "var(--tint-sage)" }} />
          <span>
            Zpracováno · <strong>{result.count}</strong> položek čeká v{" "}
            <a href="/triage" className="underline hover:text-foreground">triage</a>.
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending || text.trim().length === 0}>
          {pending ? <><Loader2 className="animate-spin" /> Posílám přes Gemini…</> : <><Send /> Odeslat</>}
        </Button>
        {result && (
          <a href="/triage" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Otevřít triage →
          </a>
        )}
      </div>
    </form>
  );
}
