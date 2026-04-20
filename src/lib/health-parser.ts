/**
 * Parser pro Health Auto Export (HAE) JSON formát.
 * Strukturu odvozuje z reálného ročního exportu uživatele:
 *
 *   {
 *     "data": {
 *       "metrics": [
 *         {
 *           "name": "step_count",
 *           "units": "count",
 *           "data": [ { "date": "2025-04-13 00:00:00 +0200", "qty": 12345, "source": "..." }, ... ]
 *         },
 *         ...
 *         {
 *           "name": "blood_pressure",
 *           "units": "mmHg",
 *           "data": [ { "date": "...", "systolic": 120, "diastolic": 80, "source": "..." } ]
 *         },
 *         {
 *           "name": "sleep_analysis",
 *           "units": "hr",
 *           "data": [ { date, source, inBed, asleep, core, deep, rem, awake,
 *                       inBedStart, inBedEnd, sleepStart, sleepEnd, totalSleep } ]
 *         }
 *       ],
 *       "ecg": [
 *         { "start": "...", "source": "EKG", "voltageMeasurements": [...],
 *           "classification": "...", "averageHeartRate": ..., "symptoms": [...] }
 *       ]
 *     }
 *   }
 */

export type MetricRow = {
  type: string;
  recordedAt: Date;
  source: string;
  unit: string | null;
  qty: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  sleepData: Record<string, unknown> | null;
  raw: Record<string, unknown>;
};

export type EcgRow = {
  startedAt: Date;
  source: string;
  classification: string | null;
  averageHr: number | null;
  voltageData: unknown;
  symptoms: unknown | null;
  raw: Record<string, unknown>;
};

/**
 * HAE používá "YYYY-MM-DD HH:mm:ss +HHMM" — V8 `new Date()` to zpracuje,
 * ale pro jistotu uděláme tolerantní parser (přidá T, normalizuje TZ).
 */
export function parseHaeDate(input: unknown): Date | null {
  if (input == null) return null;

  // ECG používá UNIX timestamp v sekundách (s desetinnou částí pro ms)
  if (typeof input === "number" && Number.isFinite(input)) {
    return new Date(input * 1000);
  }

  if (typeof input !== "string") return null;

  // "2025-04-13 00:00:00 +0200"
  //   → "2025-04-13T00:00:00+02:00"
  let s = input.trim();
  s = s.replace(" ", "T");
  // "+0200" → "+02:00", "-0500" → "-05:00"
  s = s.replace(/\s*([+-])(\d{2})(\d{2})$/, "$1$2:$3");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export type ParseStats = {
  metricsByType: Record<string, number>;
  ecgCount: number;
  skippedMissingDate: number;
  skippedMissingSource: number;
};

export type ParseResult = {
  metrics: MetricRow[];
  ecgs: EcgRow[];
  stats: ParseStats;
};

/**
 * Převede HAE payload na row struktury připravené k bulk-insertu.
 * Všechny neznámé/nové typy metrik procházejí — ukládáme je univerzálně
 * (qty + raw), takže přidáním nové metriky v HAE nám nic nerozbije.
 */
export function parseHaePayload(payload: unknown): ParseResult {
  const metrics: MetricRow[] = [];
  const ecgs: EcgRow[] = [];
  const stats: ParseStats = {
    metricsByType: {},
    ecgCount: 0,
    skippedMissingDate: 0,
    skippedMissingSource: 0,
  };

  if (!payload || typeof payload !== "object") return { metrics, ecgs, stats };
  const root = payload as { data?: unknown };
  const data = root.data && typeof root.data === "object" ? (root.data as Record<string, unknown>) : null;
  if (!data) return { metrics, ecgs, stats };

  // ---- metrics[] ----
  const metricsArr = Array.isArray(data.metrics) ? (data.metrics as unknown[]) : [];
  for (const m of metricsArr) {
    if (!m || typeof m !== "object") continue;
    const mObj = m as Record<string, unknown>;
    const type = asString(mObj.name);
    if (!type) continue;
    const unit = asString(mObj.units);
    const items = Array.isArray(mObj.data) ? (mObj.data as unknown[]) : [];

    for (const itemRaw of items) {
      if (!itemRaw || typeof itemRaw !== "object") continue;
      const item = itemRaw as Record<string, unknown>;

      const recordedAt = parseHaeDate(item.date);
      if (!recordedAt) { stats.skippedMissingDate++; continue; }

      const source = asString(item.source) ?? "unknown";
      if (!asString(item.source)) stats.skippedMissingSource++;

      const row: MetricRow = {
        type,
        recordedAt,
        source,
        unit,
        qty: null,
        bpSystolic: null,
        bpDiastolic: null,
        sleepData: null,
        raw: item,
      };

      if (type === "blood_pressure") {
        row.bpSystolic = asNumber(item.systolic);
        row.bpDiastolic = asNumber(item.diastolic);
      } else if (type === "sleep_analysis") {
        // Uložíme celou strukturu fází do JSONB — hodnoty v hodinách,
        // plus časové rozsahy inBedStart/End, sleepStart/End.
        row.sleepData = {
          inBed: asNumber(item.inBed),
          asleep: asNumber(item.asleep),
          core: asNumber(item.core),
          deep: asNumber(item.deep),
          rem: asNumber(item.rem),
          awake: asNumber(item.awake),
          totalSleep: asNumber(item.totalSleep),
          inBedStart: asString(item.inBedStart),
          inBedEnd: asString(item.inBedEnd),
          sleepStart: asString(item.sleepStart),
          sleepEnd: asString(item.sleepEnd),
        };
      } else {
        // Zbylých 14 metrik má prostý `qty` scalar.
        row.qty = asNumber(item.qty);
      }

      metrics.push(row);
      stats.metricsByType[type] = (stats.metricsByType[type] ?? 0) + 1;
    }
  }

  // ---- ecg[] ----
  const ecgArr = Array.isArray(data.ecg) ? (data.ecg as unknown[]) : [];
  for (const eRaw of ecgArr) {
    if (!eRaw || typeof eRaw !== "object") continue;
    const e = eRaw as Record<string, unknown>;
    const startedAt = parseHaeDate(e.start);
    if (!startedAt) { stats.skippedMissingDate++; continue; }

    ecgs.push({
      startedAt,
      source: asString(e.source) ?? "unknown",
      classification: asString(e.classification),
      averageHr: asNumber(e.averageHeartRate ?? e.averageHr),
      voltageData: e.voltageMeasurements ?? null,
      symptoms: e.symptoms ?? null,
      raw: e,
    });
    stats.ecgCount++;
  }

  return { metrics, ecgs, stats };
}
