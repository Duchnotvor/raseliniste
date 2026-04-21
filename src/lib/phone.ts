import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

const DEFAULT_COUNTRY: CountryCode = "CZ";

/**
 * Normalizuj telefonní číslo do E.164 (např. "+420777123456").
 * Pokud je číslo neplatné, vrátí null.
 *
 * Akceptuje:
 *  - "+420 777 123 456"
 *  - "777123456"          (default CZ)
 *  - "00420777123456"
 *  - "(777) 123-456"
 */
export function normalizePhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  if (!raw) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  try {
    const parsed = parsePhoneNumberFromString(cleaned, country);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.number; // E.164
  } catch {
    return null;
  }
}

/**
 * Hezky formátuj číslo pro zobrazení (např. "+420 777 123 456").
 * Pokud neplatné, vrátí raw.
 */
export function formatPhone(raw: string, country: CountryCode = DEFAULT_COUNTRY): string {
  try {
    const parsed = parsePhoneNumberFromString(raw, country);
    if (!parsed || !parsed.isValid()) return raw;
    return parsed.formatInternational();
  } catch {
    return raw;
  }
}
