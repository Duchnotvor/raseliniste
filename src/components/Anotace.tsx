import { useEffect, useRef, useState } from "react";
import { MessageSquarePlus, ListChecks, X, Copy, Check, Trash2 } from "lucide-react";

/**
 * DOČASNÉ komentování UI přímo v prohlížeči (Gideon 2026-08-08, dle jeho
 * návodu _komentovani-v-prohlizeci.md z WP projektu, adaptace pro Rašeliniště):
 *
 *  - „Poznámka" → picking režim: hover obtáhne prvek, klik otevře okénko,
 *    text + Uložit (Cmd+Enter). Esc zavře, další klik na FAB režim vypne.
 *  - „Seznam (N)" → všechny poznámky, mazání, „Zkopírovat pro Clauda"
 *    (JSON balík do schránky → vložit do chatu), „Smazat vše".
 *  - Ukládá se JEN do localStorage (žádný server/DB) — poznámka nese text,
 *    URL, selektor, popis prvku, šířku okna a čas.
 *
 *  AŽ SE DOLADÍ: smazat tento soubor + mount v Shell.astro. Nic víc.
 */

interface Note {
  id: string;
  text: string;
  url: string;
  selektor: string;
  popis: string;
  sirka: number;
  cas: string;
}

const LS_KEY = "raseliniste-anotace";

function loadNotes(): Note[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function saveNotes(notes: Note[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(notes)); } catch { /* full */ }
}

/** CSS cesta k prvku — tag.třídy:nth-of-type > … (max 4 úrovně).
 *  nth-of-type se přidává, když má prvek sourozence stejného tagu —
 *  jednoznačnost i u ikon/prvků bez textu a s generickými třídami. */
function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 4) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) { parts.unshift(`${part}#${cur.id}`); break; }
    const cls = Array.from(cur.classList).filter((c) => !c.startsWith("hover:") && c.length < 40).slice(0, 2);
    if (cls.length) part += "." + cls.join(".");
    const parent = cur.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = cur.parentElement;
  }
  return parts.join(" > ");
}

export default function Anotace() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [draft, setDraft] = useState<{ x: number; y: number; selektor: string; popis: string } | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const pickingRef = useRef(false);
  pickingRef.current = picking;
  const hoverElRef = useRef<Element | null>(null);

  useEffect(() => { setNotes(loadNotes()); }, []);

  // Picking režim: hover outline + click zachycení (capture, ať předběhneme appku)
  useEffect(() => {
    if (!picking) return;
    const OUTLINE = "2px solid #FF5C2E";
    const over = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el || (el as HTMLElement).closest?.("[data-anotace-ui]")) return;
      if (hoverElRef.current && hoverElRef.current !== el) {
        (hoverElRef.current as HTMLElement).style.outline = "";
      }
      hoverElRef.current = el;
      (el as HTMLElement).style.outline = OUTLINE;
      (el as HTMLElement).style.outlineOffset = "1px";
    };
    const out = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && !el.closest?.("[data-anotace-ui]")) el.style.outline = "";
    };
    const click = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || el.closest?.("[data-anotace-ui]")) return;
      e.preventDefault();
      e.stopPropagation();
      el.style.outline = "";
      const popis = (el.innerText ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || `<${el.tagName.toLowerCase()}>`;
      setDraft({
        x: Math.min(e.clientX, window.innerWidth - 340),
        y: Math.min(e.clientY + 10, window.innerHeight - 220),
        selektor: cssPath(el),
        popis,
      });
      setDraftText("");
      setPicking(false);
    };
    document.addEventListener("mouseover", over, true);
    document.addEventListener("mouseout", out, true);
    document.addEventListener("click", click, true);
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mouseover", over, true);
      document.removeEventListener("mouseout", out, true);
      document.removeEventListener("click", click, true);
      document.body.style.cursor = "";
      if (hoverElRef.current) (hoverElRef.current as HTMLElement).style.outline = "";
    };
  }, [picking]);

  // Esc zavře okénko / vypne picking
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDraft(null); setPicking(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function save() {
    if (!draft || !draftText.trim()) return;
    const note: Note = {
      id: `${Date.now()}-${notes.length}`,
      text: draftText.trim(),
      url: location.pathname + location.search,
      selektor: draft.selektor,
      popis: draft.popis,
      sirka: window.innerWidth,
      cas: new Date().toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    };
    const next = [...notes, note];
    setNotes(next);
    saveNotes(next);
    setDraft(null);
  }

  function remove(id: string) {
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(next);
  }

  async function copyAll() {
    const payload = notes.map(({ id: _id, ...rest }) => rest);
    await navigator.clipboard.writeText(
      `Komentáře k UI Rašeliniště (${notes.length}):\n\`\`\`json\n${JSON.stringify(payload, null, 1)}\n\`\`\``,
    ).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10,
    fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid var(--border)",
    background: "var(--card)", color: "var(--foreground)", boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  };

  return (
    <div data-anotace-ui>
      {/* FABy vpravo dole */}
      <div style={{ position: "fixed", right: 14, bottom: 76, zIndex: 9998, display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          type="button"
          onClick={() => { setPicking((v) => !v); setDraft(null); }}
          style={{ ...btnBase, ...(picking ? { background: "#FF5C2E", color: "#fff", borderColor: "#FF5C2E" } : {}) }}
          title="Klikni a pak vyber prvek na stránce, ke kterému chceš napsat poznámku"
        >
          <MessageSquarePlus size={15} /> {picking ? "Vyber prvek…" : "Poznámka"}
        </button>
        <button type="button" onClick={() => setListOpen((v) => !v)} style={btnBase}>
          <ListChecks size={15} /> Seznam{notes.length > 0 ? ` (${notes.length})` : ""}
        </button>
      </div>

      {/* Okénko nové poznámky */}
      {draft && (
        <div
          style={{
            position: "fixed", left: draft.x, top: draft.y, zIndex: 9999, width: 320,
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "var(--muted-foreground)", marginBottom: 6, wordBreak: "break-all" }}>
            {draft.selektor}
            <span style={{ display: "block", color: "var(--foreground)", opacity: 0.7 }}>„{draft.popis}"</span>
          </div>
          <textarea
            autoFocus
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
            placeholder="Co s tím je?"
            rows={3}
            style={{ width: "100%", fontSize: 13, padding: 8, borderRadius: 8, background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={save} disabled={!draftText.trim()} style={{ ...btnBase, background: "#FF5C2E", color: "#fff", borderColor: "#FF5C2E", opacity: draftText.trim() ? 1 : 0.5 }}>
              Uložit
            </button>
            <button type="button" onClick={() => setDraft(null)} style={{ ...btnBase, boxShadow: "none" }}>Zrušit</button>
            <span style={{ fontSize: 10, color: "var(--muted-foreground)", alignSelf: "center", marginLeft: "auto" }}>Cmd+Enter</span>
          </div>
        </div>
      )}

      {/* Seznam poznámek */}
      {listOpen && (
        <div
          style={{
            position: "fixed", right: 14, bottom: 160, zIndex: 9999, width: 380, maxHeight: "60vh",
            overflowY: "auto", background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <strong style={{ fontSize: 13 }}>Poznámky ({notes.length})</strong>
            <button type="button" onClick={copyAll} disabled={notes.length === 0} style={{ ...btnBase, boxShadow: "none", padding: "5px 9px", marginLeft: "auto", opacity: notes.length ? 1 : 0.5 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Zkopírováno" : "Zkopírovat pro Clauda"}
            </button>
            <button type="button" onClick={() => setListOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)" }}>
              <X size={15} />
            </button>
          </div>
          {notes.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted-foreground)", fontStyle: "italic" }}>
              Zatím nic. Klikni na „Poznámka" a vyber prvek na stránce.
            </div>
          ) : (
            <>
              {notes.map((n) => (
                <div key={n.id} style={{ borderTop: "1px solid var(--border)", padding: "8px 0", fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>{n.text}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--muted-foreground)", wordBreak: "break-all" }}>
                        {n.url} · „{n.popis}" · {n.sirka}px · {n.cas}
                      </div>
                    </div>
                    <button type="button" onClick={() => remove(n.id)} title="Smazat poznámku" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", alignSelf: "flex-start" }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { if (confirm("Smazat všechny poznámky?")) { setNotes([]); saveNotes([]); } }}
                style={{ ...btnBase, boxShadow: "none", marginTop: 10, fontSize: 11, color: "var(--muted-foreground)" }}
              >
                <Trash2 size={12} /> Smazat vše
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
