/**
 * Minimalistický parser .vcf (vCard 2.1 / 3.0 / 4.0).
 *
 * Řeší to, co iPhone Kontakty reálně exportují:
 *   BEGIN:VCARD / END:VCARD bloky
 *   FN / N:Prijmeni;Jmeno;...
 *   TEL;type=CELL;type=VOICE:+420777...
 *   TEL;TYPE=CELL:...
 *   EMAIL;type=INTERNET;type=HOME:foo@bar.cz
 *   UID:xxxxx
 *   NOTE:...
 *
 * Quoted-printable a BASE64 fotky ignorujeme.
 * Continuation lines (řádek začíná mezerou) skládáme zpět.
 */

export interface ParsedContact {
  displayName: string;
  firstName?: string;
  lastName?: string;
  note?: string;
  externalId?: string;
  phones: { number: string; label?: string }[];
  emails: { email: string; label?: string }[];
}

function unfoldLines(text: string): string[] {
  // vCard spec: řádky začínající mezerou nebo tabulátorem jsou continuation
  // předchozího logického řádku.
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function extractLabel(params: string[]): string | undefined {
  // Hledej TYPE= hodnotu (mobile/work/home/...)
  const typeParam = params.find((p) => p.toUpperCase().startsWith("TYPE="));
  if (typeParam) {
    const values = typeParam.substring(5).split(",");
    const priority = ["CELL", "MOBILE", "IPHONE", "WORK", "HOME", "OTHER", "INTERNET", "VOICE"];
    for (const v of values) {
      const upper = v.toUpperCase();
      if (priority.includes(upper)) {
        if (upper === "CELL" || upper === "MOBILE" || upper === "IPHONE") return "mobile";
        return upper.toLowerCase();
      }
    }
  }
  // Nebo bez TYPE= (vCard 2.1: TEL;CELL;VOICE:...)
  for (const p of params) {
    const upper = p.toUpperCase();
    if (upper === "CELL" || upper === "MOBILE" || upper === "IPHONE") return "mobile";
    if (["WORK", "HOME", "OTHER"].includes(upper)) return upper.toLowerCase();
  }
  return undefined;
}

function decodeValue(raw: string, params: string[]): string {
  // Quoted-printable podpora (vCard 2.1)
  const isQP = params.some((p) => p.toUpperCase() === "ENCODING=QUOTED-PRINTABLE");
  if (isQP) {
    try {
      return raw.replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    } catch {
      return raw;
    }
  }
  return raw.replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\n/gi, "\n").replace(/\\\\/g, "\\");
}

function parseVCard(block: string[]): ParsedContact | null {
  const contact: ParsedContact = {
    displayName: "",
    phones: [],
    emails: [],
  };

  for (const line of block) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const head = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const parts = head.split(";");
    const key = parts[0].toUpperCase();
    const params = parts.slice(1);
    const decoded = decodeValue(value, params);

    if (key === "FN") {
      contact.displayName = decoded.trim();
    } else if (key === "N") {
      // N:Prijmeni;Jmeno;Middle;Prefix;Suffix
      const nparts = decoded.split(";");
      if (nparts[0]) contact.lastName = nparts[0].trim() || undefined;
      if (nparts[1]) contact.firstName = nparts[1].trim() || undefined;
    } else if (key === "TEL") {
      const label = extractLabel(params);
      const num = decoded.trim();
      if (num) contact.phones.push({ number: num, label });
    } else if (key === "EMAIL") {
      const label = extractLabel(params);
      const em = decoded.trim();
      if (em) contact.emails.push({ email: em, label });
    } else if (key === "NOTE") {
      contact.note = decoded.trim() || undefined;
    } else if (key === "UID") {
      contact.externalId = decoded.trim() || undefined;
    }
  }

  // Fallback na displayName z N:
  if (!contact.displayName) {
    const full = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
    contact.displayName = full || "(bez jména)";
  }

  // Kontakty bez telefonu ani emailu přeskakujeme
  if (contact.phones.length === 0 && contact.emails.length === 0) return null;

  return contact;
}

export function parseVCardFile(text: string): ParsedContact[] {
  const lines = unfoldLines(text);
  const contacts: ParsedContact[] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    const upper = line.toUpperCase().trim();
    if (upper === "BEGIN:VCARD") {
      current = [];
    } else if (upper === "END:VCARD") {
      if (current) {
        const c = parseVCard(current);
        if (c) contacts.push(c);
      }
      current = null;
    } else if (current) {
      current.push(line);
    }
  }
  return contacts;
}
