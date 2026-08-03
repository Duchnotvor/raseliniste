import { prisma } from "./db";
import { MODE_INFO, type DayMode } from "./week-template";

/**
 * Sdílená příprava dat pro trencadís board (Gideon 2026-08-04) — používá
 * /planovani (plná verze) i veřejná read-only /b/<token> pro kolegyni.
 * Vytaženo z planovani.astro beze změny logiky.
 */

export interface BoardData {
  weekStart: string;
  prevHref: string;
  nextHref: string;
  isCurrentWeek: boolean;
  days: {
    date: string;
    dayName: string;
    dateLabel: string;
    isToday: boolean;
    isPast: boolean;
    modeName: string | null;
    modeLabel: string | null;
    meetings: { time: string; title: string }[];
    busyHours: number;
  }[];
  initialCards: {
    id: string; title: string; priority: "low" | "normal" | "high";
    dueAt: string | null; plannedFor: string | null; tags: string[];
    projectName: string | null; overdue: boolean;
  }[];
  initialBlocks: { id: string; date: string; clientKey: string; label: string }[];
  backlogTotal: number;
  clientTotals: Record<string, number>;
  weekTabs: { label: string; range: string; total: number; href: string; active: boolean }[];
}

const dkey = (d: Date) => d.toLocaleDateString("sv-SE");

function isoWeek(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const MONTHS_GEN = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
function weekRange(mon: Date): string {
  const fri = new Date(mon);
  fri.setDate(fri.getDate() + 4);
  if (mon.getMonth() === fri.getMonth()) {
    return `${mon.getDate()}.–${fri.getDate()}. ${MONTHS_GEN[mon.getMonth()]}`;
  }
  return `${mon.getDate()}. ${MONTHS_GEN[mon.getMonth()]} – ${fri.getDate()}. ${MONTHS_GEN[fri.getMonth()]}`;
}

interface ClientLabelInput {
  tags: string[];
  todoistProjectId: string | null;
  assignedToContact: { displayName: string; clientTag: string | null; isTeam: boolean } | null;
}

/**
 * @param basePath cesta pro week navigaci ("/planovani" nebo "/b/<token>")
 */
export async function buildPlanningBoardData(userId: string, wParam: string | null, basePath: string): Promise<BoardData> {
  const base = wParam && /^\d{4}-\d{2}-\d{2}$/.test(wParam) ? new Date(`${wParam}T00:00:00`) : new Date();
  base.setHours(0, 0, 0, 0);
  const monday = new Date(base);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const todayKey = dkey(new Date());
  const wHref = (m: Date) => `${basePath}?w=${dkey(m)}`;

  // Šablona týdne (F3)
  const templateRows = await prisma.planningDayTemplate.findMany({
    where: { userId },
    orderBy: { weekday: "asc" },
    select: { weekday: true, mode: true, label: true },
  });
  const templateByDay = new Map(templateRows.map((r) => [r.weekday, r]));

  // Schůzky týdne
  const weekEvents = await prisma.calendarEvent.findMany({
    where: {
      deletedRemotely: false,
      source: { not: "LOCAL_ICS" },
      allDay: false,
      AND: [{ startsAt: { gte: monday } }, { startsAt: { lt: nextMonday } }],
    },
    select: { title: true, startsAt: true, endsAt: true },
    orderBy: { startsAt: "asc" },
  });
  const fmtT = (d: Date) => d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit", hour12: false });
  const meetingsByDay = new Map<string, { time: string; title: string }[]>();
  const busyByDay = new Map<string, number>();
  for (const e of weekEvents) {
    const key = dkey(e.startsAt);
    const arr = meetingsByDay.get(key) ?? [];
    if (arr.length < 6) arr.push({ time: fmtT(e.startsAt), title: e.title });
    meetingsByDay.set(key, arr);
    busyByDay.set(key, (busyByDay.get(key) ?? 0) + (e.endsAt.getTime() - e.startsAt.getTime()) / 3_600_000);
  }

  const DAY_FULL = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = dkey(d);
    const tpl = templateByDay.get(i);
    const info = tpl ? MODE_INFO[tpl.mode as DayMode] : null;
    return {
      date: key,
      dayName: DAY_FULL[i],
      dateLabel: `${d.getDate()}. ${d.getMonth() + 1}.`,
      isToday: key === todayKey,
      isPast: key < todayKey,
      modeName: info?.name ?? null,
      modeLabel: tpl?.label ?? null,
      meetings: meetingsByDay.get(key) ?? [],
      busyHours: busyByDay.get(key) ?? 0,
    };
  });

  // Kurátorovaný výběr (Gideon 2026-07-23)
  const horizon = new Date(); horizon.setDate(horizon.getDate() + 14); horizon.setHours(23, 59, 59, 999);
  const taskSelect = {
    id: true, title: true, priority: true, dueAt: true, plannedFor: true, tags: true,
    todoistProjectId: true,
    assignedToContact: { select: { displayName: true, clientTag: true, isTeam: true } },
  } as const;
  const candidateWhere = {
    userId,
    status: "open" as const,
    plannedFor: null,
    OR: [{ dueAt: { lte: horizon } }, { priority: "high" as const }],
  };

  const [weekTasks, overdueTasks, candidateTasks, candidateTotal, prevWeekTotal, nextWeekTotal, allOpen] = await Promise.all([
    prisma.task.findMany({
      where: { userId, status: "open", plannedFor: { gte: monday, lt: nextMonday } },
      select: taskSelect,
    }),
    prisma.task.findMany({
      where: {
        userId, status: "open",
        plannedFor: { lt: new Date(Math.min(monday.getTime(), new Date(new Date().setHours(0, 0, 0, 0)).getTime())) },
      },
      select: taskSelect,
      orderBy: { plannedFor: "asc" },
      take: 30,
    }),
    prisma.task.findMany({
      where: candidateWhere,
      select: taskSelect,
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }],
      take: 150,
    }),
    prisma.task.count({ where: candidateWhere }),
    prisma.task.count({ where: { userId, status: "open", plannedFor: { gte: prevMonday, lt: monday } } }),
    prisma.task.count({ where: { userId, status: "open", plannedFor: { gte: nextMonday, lt: new Date(nextMonday.getTime() + 7 * 86400000) } } }),
    prisma.task.findMany({
      where: { userId, status: "open" },
      select: { tags: true, todoistProjectId: true, assignedToContact: { select: { displayName: true, clientTag: true, isTeam: true } } },
    }),
  ]);

  const weekBlocks = await prisma.planningBlock.findMany({
    where: { userId, date: { gte: monday, lt: nextMonday } },
    select: { id: true, date: true, clientKey: true, label: true },
  });
  const initialBlocks = weekBlocks.map((b) => ({
    id: b.id, date: dkey(b.date), clientKey: b.clientKey, label: b.label,
  }));

  const projects = await prisma.todoistProjectMirror.findMany({
    where: { userId },
    select: { todoistId: true, name: true },
  });
  const projectNames = new Map(projects.map((p) => [p.todoistId, p.name]));

  function clientLabel(t: ClientLabelInput): string {
    const klientTag = t.tags.find((x) => x.startsWith("klient-"));
    if (klientTag) {
      const slug = klientTag.slice("klient-".length).replace(/-/g, " ");
      return slug.charAt(0).toUpperCase() + slug.slice(1);
    }
    if (t.assignedToContact?.clientTag) {
      const s = t.assignedToContact.clientTag.replace(/-/g, " ");
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    if (t.assignedToContact?.isTeam) return t.assignedToContact.displayName;
    if (t.todoistProjectId && projectNames.get(t.todoistProjectId)) return projectNames.get(t.todoistProjectId)!;
    return "Ostatní";
  }

  const toCard = (t: (typeof candidateTasks)[number], overdue = false) => ({
    id: t.id,
    title: t.title,
    priority: t.priority as "low" | "normal" | "high",
    dueAt: t.dueAt?.toISOString() ?? null,
    plannedFor: t.plannedFor ? dkey(t.plannedFor) : null,
    tags: t.tags,
    projectName: clientLabel(t),
    overdue,
  });
  const initialCards = [
    ...overdueTasks.map((t) => toCard(t, true)),
    ...weekTasks.map((t) => toCard(t)),
    ...candidateTasks.map((t) => toCard(t)),
  ];

  // Chip „1 z 11" (Gideon 2026-08-04) — celkové počty per klient
  const clientTotals: Record<string, number> = {};
  for (const t of allOpen) {
    const label = clientLabel(t);
    clientTotals[label] = (clientTotals[label] ?? 0) + 1;
  }

  const weekTabs = [
    { label: `Týden ${isoWeek(prevMonday)}`, range: weekRange(prevMonday), total: prevWeekTotal, href: wHref(prevMonday), active: false },
    { label: `Týden ${isoWeek(monday)}`, range: weekRange(monday), total: weekTasks.length, href: wHref(monday), active: true },
    { label: `Týden ${isoWeek(nextMonday)}`, range: weekRange(nextMonday), total: nextWeekTotal, href: wHref(nextMonday), active: false },
  ];

  const currentMondayKey = dkey(new Date(new Date().setDate(new Date().getDate() - ((new Date().getDay() + 6) % 7))));

  return {
    weekStart: dkey(monday),
    prevHref: wHref(prevMonday),
    nextHref: wHref(nextMonday),
    isCurrentWeek: dkey(monday) === currentMondayKey,
    days,
    initialCards,
    initialBlocks,
    backlogTotal: candidateTotal,
    clientTotals,
    weekTabs,
  };
}
