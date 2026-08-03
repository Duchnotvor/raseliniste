import { useMemo, useState } from "react";

/**
 * Nástěnka mozaiky — trencadís kanban (DESIGN/board_work, replikace 1:1).
 * Nahrazuje původní PlanningBoard (Gideon 2026-08-01: „takhle to chci").
 *
 * Data zůstávají z ADHD plánování: Task.plannedFor (API /api/ukoly/:id),
 * PlanningBlock (API /api/planovani/blok), kurátorovaný backlog, WIP limit,
 * AI návrh týdne. Vizuál, typografie, barvy a chování dle README handoffu —
 * deterministické střepy (FNV-1a hash), žádné Math.random().
 *
 * Odchylky od prototypu (vědomé, kryté Gideonovými odpověďmi 2026-08-01):
 *  - avatary vynechány → místo nich ✓ „hotovo" kruh ve stejné geometrii
 *  - tray = klientské skupiny (chip s počtem; tah = klientský BLOK na den,
 *    klik = rozbalení úkolů) — 150 úkolů v plochém tray nedává smysl
 *  - bloky = větší střep s úkoly klienta uvnitř
 *  - týdny = klouzavé (minulý/aktuální/další přes ?w=), ne 3 fixní
 */

// ============================================================================
// Design konstanty a derivační pravidla (portováno přesně z prototypu)
// ============================================================================

const CHAOS = 0.55;
const DAY_ACCENTS = ["#7C6AA6", "#E0692A", "#2B5EA7", "#B4823A", "#2F8049"];
const SHARD_COLORS = [
  "#37B0AC", "#1FA5A0", "#C1553A", "#DE6A45", "#CE9A34", "#E9B23C", "#B4823A",
  "#2B5EA7", "#4C8C3F", "#8FA36B", "#7B8E3C", "#7C6AA6", "#2F8049",
];
const PAGE_BG = "#EFE7D6";

/** FNV-1a → [0,1) — deterministické, střepy se mezi rendery nepřeskládají */
function rnd(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

function mix(hex: string, target: string, amt: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(hex), b = p(target);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * amt).toString(16).padStart(2, "0")).join("");
}

function lum(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
const textOn = (hex: string) => (lum(hex) > 0.6 ? "rgba(42,36,28,0.86)" : "rgba(255,252,244,0.97)");
const metaOn = (hex: string) => (lum(hex) > 0.6 ? "rgba(42,36,28,0.6)" : "rgba(255,252,244,0.75)");
const soft = (hex: string) => mix(hex, PAGE_BG, 0.26);

function shard(id: string) {
  const r = (k: string) => rnd(id + "|" + k);
  return {
    radius: `${(9 + r("a") * 7) | 0}px ${(6 + r("b") * 5) | 0}px ${(10 + r("c") * 7) | 0}px ${(6 + r("d") * 5) | 0}px`,
    rot: `${((r("e") - 0.5) * 3 * CHAOS).toFixed(2)}deg`,
  };
}

interface LetterTile { ch: string; bg: string; text: string; radius: string; rot: string; shiftY: string; padX: string }
function letterTiles(name: string, accent: string): LetterTile[] {
  return name.split("").map((ch, i) => {
    const r = (k: string) => rnd(name + i + k);
    const t = r("t");
    const base = mix(accent, PAGE_BG, 0.3);
    const bg = t < 0.4 ? mix(base, "#17403f", 0.06 + r("m") * 0.1)
      : t < 0.72 ? base
      : t < 0.88 ? mix(base, "#E9B23C", 0.12 + r("m") * 0.14)
      : mix(base, "#FFF6E2", 0.1 + r("m") * 0.12);
    return {
      ch, bg,
      text: textOn(bg),
      radius: `${(3 + r("a") * 4) | 0}px ${(2 + r("b") * 4) | 0}px ${(3 + r("c") * 5) | 0}px ${(2 + r("d") * 4) | 0}px`,
      rot: `${((r("e") - 0.5) * 8 * CHAOS).toFixed(2)}deg`,
      shiftY: `${((r("f") - 0.5) * 3 * CHAOS).toFixed(1)}px`,
      padX: `${(3 + r("g") * 2) | 0}px`,
    };
  });
}

function mosaicMark(seed: string, active: boolean) {
  const palette = active ? ["#C1553A", "#E9B23C", "#17789E", "#2F8049"] : ["#B8AC96", "#C4B49A", "#ADA48F", "#BFB39B"];
  return Array.from({ length: 4 }, (_, i) => {
    const r = (k: string) => rnd(seed + "mark" + i + k);
    return {
      bg: palette[(r("p") * palette.length) | 0],
      grow: (0.7 + r("g") * 1.1).toFixed(2),
      radius: `${(1 + r("a") * 3) | 0}px ${(1 + r("b") * 2) | 0}px ${(1 + r("c") * 3) | 0}px ${(1 + r("d") * 2) | 0}px`,
      rot: `${((r("e") - 0.5) * 10).toFixed(1)}deg`,
    };
  });
}

function plural(n: number, one: string, few: string, many: string): string {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

/** Stabilní barva klienta z palety střepů */
function colorFor(label: string): string {
  return SHARD_COLORS[(rnd("c|" + label) * SHARD_COLORS.length) | 0];
}

/** Slug klienta — stejná sémantika jako dřív (unikátnost bloku per den+klient) */
function clientKeyOf(label: string): string {
  return label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Fonty (naimportované v planovani.astro přes @fontsource)
const F_BARLOW = "'Barlow', sans-serif";
const F_COND = "'Barlow Semi Condensed', sans-serif";

const GLAZE_CARD = "linear-gradient(158deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 45%, rgba(0,0,0,0.06))";
const GLAZE_TILE = "linear-gradient(155deg, rgba(255,255,255,0.16), rgba(255,255,255,0) 55%, rgba(0,0,0,0.07))";
const GLAZE_MARK = "linear-gradient(150deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 60%, rgba(0,0,0,0.07))";

// ============================================================================
// Datové typy (shodné s původním boardem — API se nemění)
// ============================================================================

export interface PlanCard {
  id: string;
  title: string;
  priority: "low" | "normal" | "high";
  dueAt: string | null;
  plannedFor: string | null;
  tags: string[];
  projectName: string | null;
  overdue?: boolean;
}

export interface DayInfo {
  date: string;
  dayName: string;      // "Pondělí"
  dateLabel: string;    // "4. 8."
  isToday: boolean;
  isPast: boolean;
  modeName?: string | null;
  modeLabel?: string | null;
  meetings: { time: string; title: string }[];
  busyHours: number;
}

export interface PlanBlock { id: string; date: string; clientKey: string; label: string }

export interface WeekTab { label: string; range: string; total: number; href: string; active: boolean }

interface Props {
  weekStart: string;
  days: DayInfo[];            // 5 dnů Po–Pá
  initialCards: PlanCard[];
  initialBlocks: PlanBlock[];
  backlogTotal: number;
  /** Celkové počty otevřených úkolů per klient (i mimo kurátorovaný výběr) */
  clientTotals: Record<string, number>;
  weekTabs: WeekTab[];
  prevHref: string;
  nextHref: string;
  /** Veřejný read-only režim (/b/<token> pro kolegyni) — bez drag&drop,
   *  dokončování, AI a mazání; jen prohlížení + week navigace. */
  readOnly?: boolean;
}

const WIP_LIMIT = 3;
const PRIO_ORDER = ["high", "normal", "low"];

export default function TrencadisBoard({ weekStart, days, initialCards, initialBlocks, backlogTotal, clientTotals, weekTabs, prevHref, nextHref, readOnly = false }: Props) {
  const [cards, setCards] = useState<PlanCard[]>(initialCards);
  const [blocks, setBlocks] = useState<PlanBlock[]>(initialBlocks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragGroup, setDragGroup] = useState<string | null>(null);
  const [dragBlockId, setDragBlockId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null); // date | "pool" | null
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ---- AI návrh týdne (beze změny logiky) ----
  interface Proposal { taskId: string; title: string; date: string; reason: string | null }
  const [aiBusy, setAiBusy] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  async function askAi() {
    setAiBusy(true); setError(null); setProposals(null);
    try {
      const res = await fetch("/api/planovani/navrh", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ week: weekStart }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Návrh selhal."); return; }
      setProposals(data.proposals);
      setAiWarnings(data.warnings ?? []);
      setChecked(new Set((data.proposals as Proposal[]).map((p) => p.taskId)));
    } catch { setError("Síťová chyba při AI návrhu."); }
    finally { setAiBusy(false); }
  }

  async function confirmProposals() {
    if (!proposals) return;
    const chosen = proposals.filter((p) => checked.has(p.taskId));
    if (chosen.length === 0) { setProposals(null); return; }
    setConfirming(true);
    try {
      const res = await fetch("/api/planovani/potvrdit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments: chosen.map((p) => ({ taskId: p.taskId, date: p.date })) }),
      });
      if (!res.ok) { setError("Potvrzení se nepovedlo."); return; }
      window.location.reload();
    } finally { setConfirming(false); }
  }

  // ---- data ----
  const backlogCards = useMemo(
    () => cards
      .filter((c) => c.plannedFor === null || c.overdue)
      .filter((c) => !filter || c.title.toLowerCase().includes(filter.toLowerCase()) || c.projectName?.toLowerCase().includes(filter.toLowerCase())),
    [cards, filter],
  );

  const backlogGroups = useMemo(() => {
    const overdue = backlogCards.filter((c) => c.overdue);
    const rest = backlogCards.filter((c) => !c.overdue);
    const map = new Map<string, PlanCard[]>();
    for (const c of rest) {
      const key = c.projectName ?? "Ostatní";
      (map.get(key) ?? map.set(key, []).get(key)!).push(c);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => PRIO_ORDER.indexOf(a.priority) - PRIO_ORDER.indexOf(b.priority) || (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
    }
    return { overdue, groups: [...map.entries()].sort((a, b) => b[1].length - a[1].length) };
  }, [backlogCards]);

  const byDay = useMemo(() => {
    const map = new Map<string, PlanCard[]>();
    for (const d of days) map.set(d.date, []);
    for (const c of cards) {
      if (c.plannedFor && !c.overdue && map.has(c.plannedFor)) map.get(c.plannedFor)!.push(c);
    }
    for (const arr of map.values()) arr.sort((a, b) => PRIO_ORDER.indexOf(a.priority) - PRIO_ORDER.indexOf(b.priority));
    return map;
  }, [cards, days]);

  // ---- akce (beze změny — stejná API) ----
  async function move(cardId: string, target: string | null) {
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, plannedFor: target, overdue: false } : c)));
    setError(null);
    const res = await fetch(`/api/ukoly/${cardId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ plannedFor: target }),
    }).catch(() => null);
    if (!res || !res.ok) { setCards(prev); setError("Uložení se nepovedlo — zkus to znovu."); }
  }

  async function createBlock(label: string, date: string) {
    const clientKey = clientKeyOf(label);
    if (blocks.some((b) => b.date === date && b.clientKey === clientKey)) return;
    const tempId = `temp-${cards.length}-${blocks.length}-${date}-${clientKey}`;
    setBlocks((bs) => [...bs, { id: tempId, date, clientKey, label }]);
    const res = await fetch("/api/planovani/blok", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, clientKey, label }),
    }).catch(() => null);
    if (!res || !res.ok) { setBlocks((bs) => bs.filter((b) => b.id !== tempId)); setError("Blok se nepodařilo uložit."); return; }
    const data = await res.json().catch(() => null);
    if (!data?.block?.id) { setBlocks((bs) => bs.filter((b) => b.id !== tempId)); setError("Blok se nepodařilo uložit (neplatná odpověď)."); return; }
    setBlocks((bs) => bs.map((b) => (b.id === tempId ? { ...b, id: data.block.id } : b)));
  }

  async function moveBlock(blockId: string, date: string) {
    const prev = blocks;
    setBlocks((bs) => bs
      .filter((b) => !(b.date === date && b.id !== blockId && b.clientKey === bs.find((x) => x.id === blockId)?.clientKey))
      .map((b) => (b.id === blockId ? { ...b, date } : b)));
    const res = await fetch("/api/planovani/blok", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: blockId, date }),
    }).catch(() => null);
    if (!res || !res.ok) { setBlocks(prev); setError("Přesun bloku se nepovedl."); }
  }

  async function removeBlock(blockId: string) {
    const prev = blocks;
    setBlocks((bs) => bs.filter((b) => b.id !== blockId));
    const res = await fetch(`/api/planovani/blok?id=${encodeURIComponent(blockId)}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) { setBlocks(prev); setError("Smazání bloku se nepovedlo."); }
  }

  async function complete(cardId: string) {
    const prev = cards;
    setCards((cs) => cs.filter((c) => c.id !== cardId));
    const res = await fetch(`/api/ukoly/${cardId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    }).catch(() => null);
    if (!res || !res.ok) { setCards(prev); setError("Dokončení se nepovedlo — zkus to znovu."); }
  }

  function onDragEnd() { setDragId(null); setDragGroup(null); setDragBlockId(null); setOver(null); }
  function allowDrop(target: string) {
    return (e: React.DragEvent) => {
      if (!dragId && !dragGroup && !dragBlockId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== target) setOver(target);
    };
  }
  function dropOnDay(date: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      if (dragGroup) createBlock(dragGroup, date);
      else if (dragBlockId) moveBlock(dragBlockId, date);
      else if (dragId) move(dragId, date);
      onDragEnd();
    };
  }
  function dropOnTray(e: React.DragEvent) {
    e.preventDefault();
    if (dragId) move(dragId, null);
    onDragEnd();
  }

  const fmtDue = (iso: string) => {
    const d = new Date(iso);
    return `do ${d.getDate()}. ${d.getMonth() + 1}.`;
  };
  const dayLabelFor = (date: string) => {
    const d = days.find((x) => x.date === date);
    return d ? `${d.dayName} ${d.dateLabel}` : date;
  };

  // ==========================================================================
  // UI kousky
  // ==========================================================================

  /** Chip volného střepu — jednotlivý úkol v tray */
  function Chip({ c }: { c: PlanCard }) {
    const s = shard(c.id);
    const hex = soft(colorFor(c.projectName ?? "Ostatní"));
    return (
      <div
        draggable={!readOnly}
        onDragStart={(e) => { if (readOnly) return; setDragId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
        onDragEnd={onDragEnd}
        style={{
          display: "flex", alignItems: "center", gap: 9, background: "rgba(255,252,244,0.72)",
          borderRadius: s.radius, transform: `rotate(${s.rot})`, padding: "7px 12px", cursor: readOnly ? "default" : "grab",
          boxShadow: "inset 0 0 0 1px rgba(74,58,36,0.14)", opacity: dragId === c.id ? 0.45 : 1,
        }}
      >
        <span style={{ flex: "0 0 auto", width: 9, height: 9, borderRadius: "2px 1px 3px 1px", background: hex }} />
        <span style={{ fontFamily: F_BARLOW, fontWeight: 600, fontSize: 13.5, color: "#3A3226" }}>{c.title}</span>
        <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, fontWeight: 600, color: c.overdue ? "#A8412C" : "#948a79", whiteSpace: "nowrap" }}>
          {c.overdue ? "z minula" : c.dueAt ? fmtDue(c.dueAt) : (c.projectName ?? "")}
        </span>
        {c.priority === "high" && (
          <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, fontWeight: 600, color: "#fff", background: "#A8412C", borderRadius: 4, padding: "1px 6px" }}>urgentní</span>
        )}
      </div>
    );
  }

  /** Chip klienta — tah na den = BLOK, klik = rozbalit úkoly */
  function ClientChip({ name, count }: { name: string; count: number }) {
    const s = shard("grp|" + name);
    const hex = colorFor(name);
    const openNow = expanded.has(name) || filter.length > 0;
    return (
      <button
        type="button"
        draggable={!readOnly}
        onDragStart={(e) => { if (readOnly) return; setDragGroup(name); e.dataTransfer.effectAllowed = "copy"; }}
        onDragEnd={onDragEnd}
        onClick={() => setExpanded((s2) => { const n = new Set(s2); if (n.has(name)) n.delete(name); else n.add(name); return n; })}
        title="Klik = rozbalit úkoly · přetáhni na den = blok pro celého klienta"
        style={{
          display: "flex", alignItems: "center", gap: 9, background: openNow ? "#FFFCF4" : "rgba(255,252,244,0.72)",
          border: "none", borderRadius: s.radius, transform: `rotate(${s.rot})`, padding: "7px 12px",
          cursor: "grab", boxShadow: `inset 0 0 0 1px ${openNow ? "rgba(23,64,63,0.4)" : "rgba(74,58,36,0.14)"}`,
          opacity: dragGroup === name ? 0.45 : 1,
        }}
      >
        <span style={{ flex: "0 0 auto", width: 9, height: 9, borderRadius: "2px 1px 3px 1px", background: hex }} />
        <span style={{ fontFamily: F_BARLOW, fontWeight: 600, fontSize: 13.5, color: "#3A3226" }}>{name}</span>
        {/* Gideon 2026-08-04: „1 úkol" mátlo vs. počet v Todoistu → „1 z 11"
            (aktuální k naplánování z celkových otevřených úkolů klienta) */}
        <span
          title={`${count} aktuálních k naplánování (termín do 14 dnů / vysoká priorita) z ${clientTotals[name] ?? count} otevřených úkolů klienta — zbytek je v Todoistu`}
          style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, fontWeight: 600, color: "#948a79" }}
        >
          {(clientTotals[name] ?? count) > count
            ? `${count} z ${clientTotals[name]} ${plural(clientTotals[name], "úkolu", "úkolů", "úkolů")}`
            : `${count} ${plural(count, "úkol", "úkoly", "úkolů")}`}
        </span>
      </button>
    );
  }

  /** Karta úkolu — keramický střep v denním sloupci */
  function Card({ c }: { c: PlanCard }) {
    const s = shard(c.id);
    const hex = soft(colorFor(c.projectName ?? "Ostatní"));
    const tCol = textOn(hex), mCol = metaOn(hex);
    const dueLate = c.dueAt && c.plannedFor && new Date(c.dueAt) < new Date(`${c.plannedFor}T00:00:00`);
    return (
      <div
        draggable={!readOnly}
        onDragStart={(e) => { if (readOnly) return; setDragId(c.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", c.id); }}
        onDragEnd={onDragEnd}
        style={{
          backgroundColor: hex, backgroundImage: GLAZE_CARD, borderRadius: s.radius,
          transform: `rotate(${s.rot})`, padding: "13px 14px 12px",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), 0 5px 12px -10px rgba(42,36,28,0.45)",
          cursor: readOnly ? "default" : "grab", opacity: dragId === c.id ? 0.45 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px 6px", marginBottom: 9 }}>
          {c.projectName && (
            <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10.5, fontWeight: 600, color: "#2A241C", background: "rgba(255,252,244,0.92)", borderRadius: 4, padding: "2px 8px" }}>
              {c.projectName}
            </span>
          )}
          {c.priority === "high" && (
            <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 10, fontWeight: 600, color: "#fff", background: "#A8412C", borderRadius: 4, padding: "2px 6px" }}>urgentní</span>
          )}
        </div>
        <div style={{ fontFamily: F_BARLOW, fontWeight: 600, fontSize: 15, lineHeight: 1.28, color: tCol }}>{c.title}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
          <span style={{ fontFamily: F_BARLOW, fontSize: 11.5, color: dueLate ? "#A8412C" : mCol, fontWeight: dueLate ? 600 : 400 }}>
            {c.dueAt ? fmtDue(c.dueAt) : ""}
          </span>
          {!readOnly && <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              value=""
              onChange={(e) => { if (e.target.value) move(c.id, e.target.value === "tray" ? null : e.target.value); }}
              title="Přesunout"
              className="pointer-fine:hidden"
              style={{ fontFamily: F_COND, fontSize: 10, background: "rgba(255,252,244,0.6)", border: "none", borderRadius: 4, color: "#2A241C", padding: "2px 3px", maxWidth: 64 }}
            >
              <option value="">→ den</option>
              <option value="tray">Volné střepy</option>
              {days.map((d) => <option key={d.date} value={d.date}>{d.dayName}</option>)}
            </select>
            <button
              type="button"
              onClick={() => complete(c.id)}
              title="Hotovo"
              style={{
                width: 24, height: 24, borderRadius: "50%", background: "#2A241C", color: "#F1EAD8",
                fontFamily: F_BARLOW, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center",
                justifyContent: "center", boxShadow: "inset 0 0 0 1.5px rgba(255,252,244,0.5)", border: "none", cursor: "pointer",
              }}
            >✓</button>
          </span>}
        </div>
      </div>
    );
  }

  /** Klientský blok — větší střep, úkoly klienta se vypisují samy */
  function BlockCard({ b }: { b: PlanBlock }) {
    const s = shard("blk|" + b.id);
    const hex = soft(colorFor(b.label));
    const tCol = textOn(hex), mCol = metaOn(hex);
    const blockTasks = cards
      .filter((c) => (c.plannedFor === null || c.overdue) && clientKeyOf(c.projectName ?? "") === b.clientKey)
      .sort((a, x) => PRIO_ORDER.indexOf(a.priority) - PRIO_ORDER.indexOf(x.priority) || (a.dueAt ?? "9999").localeCompare(x.dueAt ?? "9999"))
      .slice(0, 6);
    return (
      <div
        draggable={!readOnly}
        onDragStart={(e) => { if (readOnly) return; setDragBlockId(b.id); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={onDragEnd}
        style={{
          backgroundColor: hex, backgroundImage: GLAZE_CARD, borderRadius: s.radius,
          transform: `rotate(${s.rot})`, padding: "13px 14px 12px",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12), 0 5px 12px -10px rgba(42,36,28,0.45)",
          cursor: readOnly ? "default" : "grab", opacity: dragBlockId === b.id ? 0.45 : 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
          <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10.5, fontWeight: 600, color: "#2A241C", background: "rgba(255,252,244,0.92)", borderRadius: 4, padding: "2px 8px" }}>blok</span>
          {!readOnly && <button
            type="button" onClick={() => removeBlock(b.id)} title="Zrušit blok"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: mCol, fontSize: 13, lineHeight: 1, padding: 2 }}
          >×</button>}
        </div>
        <div style={{ fontFamily: F_BARLOW, fontWeight: 600, fontSize: 15, lineHeight: 1.28, color: tCol }}>{b.label}</div>
        {blockTasks.length > 0 ? (
          <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            {blockTasks.map((t) => (
              <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: F_BARLOW, fontSize: 11.5, lineHeight: 1.3, color: mCol }}>
                <span style={{ width: 5, height: 5, borderRadius: "1px 2px 1px 2px", background: t.priority === "high" ? "#A8412C" : mCol, flex: "0 0 auto" }} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                {t.dueAt && <span style={{ flex: "0 0 auto", fontSize: 10.5 }}>{fmtDue(t.dueAt)}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ marginTop: 8, fontFamily: F_BARLOW, fontSize: 11.5, fontStyle: "italic", color: mCol }}>žádné aktuální úkoly — volný blok</div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  const trayHighlight = over === "pool";

  return (
    <div style={{ color: "#2A241C", fontFamily: F_BARLOW }}>
      {/* ---- Week navigator ---- */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, marginBottom: 14 }}>
        <a
          href={prevHref}
          className="trc-arrow"
          style={{ flex: "0 0 auto", border: "1px solid rgba(42,36,28,0.18)", background: "rgba(255,252,244,0.5)", borderRadius: "10px 6px 9px 7px", width: 42, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BARLOW, fontSize: 16, fontWeight: 600, color: "#6b6153", textDecoration: "none" }}
        >‹</a>
        <div style={{ flex: 1, display: "flex", gap: 8, minWidth: 0 }}>
          {weekTabs.map((w) => {
            const marks = mosaicMark(w.label + w.range, w.active);
            return (
              <a
                key={w.href}
                href={w.href}
                style={{
                  flex: 1, minWidth: 0, textAlign: "left", cursor: "pointer", textDecoration: "none",
                  background: w.active ? "#FFFCF4" : "rgba(255,252,244,0.35)",
                  border: `1px solid ${w.active ? "rgba(23,64,63,0.55)" : "rgba(42,36,28,0.16)"}`,
                  borderRadius: w.active ? "11px 7px 12px 8px" : "9px 6px 10px 7px",
                  padding: "11px 15px 10px", display: "flex", alignItems: "center", gap: 13,
                  boxShadow: w.active ? "0 4px 14px -10px rgba(42,36,28,0.6)" : "none",
                }}
              >
                <span style={{ flex: "0 0 auto", alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 1.5, width: 7 }}>
                  {marks.map((m, i) => (
                    <span key={i} style={{ flex: `${m.grow} 1 0`, display: "block", backgroundColor: m.bg, backgroundImage: GLAZE_MARK, borderRadius: m.radius, transform: `rotate(${m.rot})` }} />
                  ))}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 14, fontWeight: 600, color: w.active ? "#17403f" : "#7d7365" }}>{w.label}</span>
                  <span style={{ display: "block", fontFamily: F_BARLOW, fontSize: 13, color: w.active ? "#6b6153" : "#948a79", marginTop: 3, whiteSpace: "nowrap" }}>{w.range}</span>
                </span>
                <span style={{ flex: "0 0 auto", textAlign: "right", fontFamily: F_BARLOW, fontSize: 12, fontWeight: 600, color: w.active ? "#6b6153" : "#948a79", whiteSpace: "nowrap" }}>
                  {w.total} {plural(w.total, "úkol", "úkoly", "úkolů")}
                  {w.active && backlogTotal > 0 ? ` · ${backlogTotal} ${plural(backlogTotal, "volný", "volné", "volných")}` : ""}
                </span>
              </a>
            );
          })}
        </div>
        <a
          href={nextHref}
          className="trc-arrow"
          style={{ flex: "0 0 auto", border: "1px solid rgba(42,36,28,0.18)", background: "rgba(255,252,244,0.5)", borderRadius: "7px 9px 6px 10px", width: 42, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F_BARLOW, fontSize: 16, fontWeight: 600, color: "#6b6153", textDecoration: "none" }}
        >›</a>
      </div>

      {error && (
        <div style={{ fontFamily: F_BARLOW, fontSize: 13, color: "#A8412C", margin: "0 0 10px", fontWeight: 600 }}>{error}</div>
      )}

      {/* ---- AI návrh (panel) ---- */}
      {proposals && (
        <div style={{ margin: "0 0 14px", padding: "14px 16px", background: "#FFFCF4", border: "1px solid rgba(23,64,63,0.35)", borderRadius: "11px 7px 12px 8px", boxShadow: "0 4px 14px -10px rgba(42,36,28,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 13, fontWeight: 600, color: "#17403f" }}>
              Návrh týdne — {proposals.length} {plural(proposals.length, "úkol", "úkoly", "úkolů")}
            </span>
            <button type="button" onClick={() => setProposals(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b6153", fontSize: 15 }}>×</button>
          </div>
          {aiWarnings.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, fontFamily: F_BARLOW, fontSize: 12, color: "#A8412C" }}>
              {aiWarnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
          {proposals.length === 0 ? (
            <div style={{ fontFamily: F_BARLOW, fontSize: 13, color: "#6b6153" }}>AI nenašla nic k naplánování.</div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {proposals.map((p) => (
                <label key={p.taskId} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontFamily: F_BARLOW, fontSize: 13.5, padding: "5px 8px", background: "rgba(216,198,160,0.35)", borderRadius: "7px 5px 8px 5px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={checked.has(p.taskId)}
                    onChange={(e) => setChecked((s2) => { const n = new Set(s2); if (e.target.checked) n.add(p.taskId); else n.delete(p.taskId); return n; })}
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 11, fontWeight: 600, color: "#17789E", marginRight: 8 }}>{dayLabelFor(p.date)}</span>
                    {p.title}
                    {p.reason && <span style={{ display: "block", fontSize: 12, color: "#6b6153" }}>{p.reason}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
          {proposals.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <button
                type="button" onClick={confirmProposals} disabled={confirming}
                style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12, fontWeight: 600, color: "#FFFCF4", background: "#17403f", border: "none", borderRadius: "8px 5px 9px 6px", padding: "8px 14px", cursor: "pointer", opacity: confirming ? 0.6 : 1 }}
              >{confirming ? "Ukládám…" : `Potvrdit vybrané (${checked.size})`}</button>
              <button
                type="button" onClick={() => setProposals(null)}
                style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.12em", fontSize: 12, fontWeight: 600, color: "#6b6153", background: "none", border: "none", cursor: "pointer" }}
              >Zrušit</button>
            </div>
          )}
        </div>
      )}

      {/* ---- Tray: Volné střepy ---- */}
      <div
        onDragOver={allowDrop("pool")}
        onDrop={dropOnTray}
        style={{
          margin: "0 0 14px", padding: "12px 14px",
          background: trayHighlight ? "#E3D2AC" : "rgba(216,198,160,0.45)",
          border: "1.5px dashed rgba(74,58,36,0.35)", borderRadius: 12,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}
      >
        <div style={{ flex: "0 0 auto", maxWidth: 200 }}>
          <div style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.16em", fontSize: 12, fontWeight: 600, color: "#17403f" }}>Volné střepy</div>
          <div style={{ fontFamily: F_BARLOW, fontSize: 12, color: "#6b6153", marginTop: 3 }}>{readOnly ? "Čeká na naplánování" : "Přetáhni je do dne v týdnu"}</div>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Hledat…"
            style={{ marginTop: 7, width: "100%", fontFamily: F_BARLOW, fontSize: 12.5, background: "rgba(255,252,244,0.72)", border: "1px solid rgba(74,58,36,0.2)", borderRadius: "6px 4px 7px 4px", padding: "5px 8px", color: "#2A241C" }}
          />
          {!readOnly && <button
            type="button" onClick={askAi} disabled={aiBusy}
            style={{ marginTop: 7, fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 11, fontWeight: 600, color: "#C1553A", background: "rgba(255,252,244,0.72)", border: "1px solid rgba(193,85,58,0.4)", borderRadius: "7px 5px 8px 5px", padding: "6px 10px", cursor: "pointer", opacity: aiBusy ? 0.6 : 1 }}
          >{aiBusy ? "Skládám návrh…" : "✦ Navrhnout týden (AI)"}</button>}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          {backlogGroups.overdue.map((c) => <Chip key={c.id} c={c} />)}
          {backlogGroups.groups.map(([name, groupCards]) => {
            const openNow = expanded.has(name) || filter.length > 0;
            return (
              <span key={name} style={{ display: "contents" }}>
                <ClientChip name={name} count={groupCards.length} />
                {openNow && groupCards.map((c) => <Chip key={c.id} c={c} />)}
              </span>
            );
          })}
          {backlogCards.length === 0 && (
            <div style={{ fontFamily: F_BARLOW, fontSize: 13, color: "rgba(74,58,36,0.55)", padding: "8px 2px" }}>
              {filter ? "Nic nenalezeno." : "Všechny střepy jsou rozdělené — sem můžeš vrátit úkol zpátky."}
            </div>
          )}
        </div>
      </div>

      {/* ---- Board: 5 denních sloupců ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5" style={{ gap: 14, alignItems: "start", paddingTop: 4 }}>
        {days.map((d, di) => {
          const accent = DAY_ACCENTS[di];
          const cardsIn = byDay.get(d.date) ?? [];
          const blocksIn = blocks.filter((b) => b.date === d.date);
          const isOver = over === d.date;
          const count = cardsIn.length + blocksIn.length;
          const wipOver = count > WIP_LIMIT;
          const tiles = letterTiles(d.dayName, accent);
          return (
            <div
              key={d.date}
              onDragOver={allowDrop(d.date)}
              onDrop={dropOnDay(d.date)}
              style={{
                minWidth: 0, background: isOver ? "#E3D2AC" : "#D8C6A0", borderRadius: 14, overflow: "hidden",
                boxShadow: `inset 0 2px 8px rgba(74,58,36,0.22), 0 1px 0 rgba(255,255,255,0.4)${isOver ? `, 0 0 0 2px ${accent}` : ""}`,
                opacity: d.isPast ? 0.72 : 1,
              }}
            >
              {/* Hlavička — jméno dne jako trencadís */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 11px 11px", background: "linear-gradient(180deg, rgba(74,58,36,0.09), rgba(74,58,36,0) 92%)" }}>
                <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "flex-end", gap: 1, overflow: "hidden" }}>
                  {tiles.map((l, i) => (
                    <span
                      key={i}
                      style={{
                        flex: "0 1 auto", display: "block", padding: `7px ${l.padX} 6px`,
                        backgroundColor: l.bg, backgroundImage: GLAZE_TILE, borderRadius: l.radius,
                        transform: `rotate(${l.rot}) translateY(${l.shiftY})`,
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.14), 0 2px 5px -5px rgba(42,36,28,0.5)",
                        fontFamily: F_COND, textTransform: "uppercase", fontWeight: 600, fontSize: 14, lineHeight: 1.2, color: l.text,
                      }}
                    >{l.ch}</span>
                  ))}
                </span>
                <span style={{ flex: "0 0 auto", fontFamily: F_BARLOW, fontSize: 11.5, fontWeight: 600, color: wipOver ? "#A8412C" : "rgba(58,50,38,0.62)" }}>
                  {wipOver ? `${count}!` : count}
                </span>
              </div>
              {/* Meta: datum · dnes · režim dne · schůzky */}
              <div style={{ padding: "0 11px 2px", display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10.5, fontWeight: 600, color: d.isToday ? "#C1553A" : "rgba(58,50,38,0.55)" }}>
                  {d.dateLabel}{d.isToday ? " · dnes" : ""}{d.modeName ? ` · ${d.modeName}${d.modeLabel ? ` (${d.modeLabel})` : ""}` : ""}
                </div>
                {d.meetings.length > 0 && (
                  <div style={{ fontFamily: F_BARLOW, fontSize: 11, lineHeight: 1.4, color: "rgba(58,50,38,0.62)" }}>
                    {d.meetings.map((m, i) => (
                      <span key={i} style={{ whiteSpace: "nowrap" }}>
                        {m.time} {m.title.length > 22 ? `${m.title.slice(0, 21)}…` : m.title}{i < d.meetings.length - 1 ? " · " : ""}
                      </span>
                    ))}
                    {d.busyHours > 0 && <span style={{ opacity: 0.7 }}> ({d.busyHours.toFixed(1)} h)</span>}
                  </div>
                )}
              </div>
              {/* Karty */}
              <div style={{ display: "flex", flexDirection: "column", gap: 9, padding: "9px 11px 13px" }}>
                {blocksIn.map((b) => <BlockCard key={b.id} b={b} />)}
                {cardsIn.map((c) => <Card key={c.id} c={c} />)}
                {!readOnly && (
                  <div style={{ border: "1.5px dashed rgba(74,58,36,0.4)", borderRadius: "10px 7px 11px 8px", padding: 10, textAlign: "center", fontFamily: F_COND, textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 11.5, fontWeight: 600, color: "rgba(74,58,36,0.6)" }}>
                    {isOver ? "↓ pusť střep sem" : "+ přetáhni střep"}
                  </div>
                )}
                {readOnly && count === 0 && (
                  <div style={{ padding: "6px 2px", textAlign: "center", fontFamily: F_BARLOW, fontSize: 12, fontStyle: "italic", color: "rgba(74,58,36,0.5)" }}>nic naplánováno</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .trc-arrow:hover { background: #FFFCF4 !important; color: #C1553A !important; }
        @media (pointer: fine) { .pointer-fine\\:hidden { display: none; } }
      `}</style>
    </div>
  );
}
