// Generuje ukázkové PDF dopisů (obě šablony) pro vizuální kontrolu.
// Použití: node scripts/preview-letter-pdf.mjs
import { writeFileSync } from "node:fs";
import { renderLetterPdf } from "../src/lib/letter-pdf.ts";

const baseSender = {
  name: "Petr Perina",
  legalName: "Petr Perina, OSVČ",
  ico: "12345678",
  dic: "CZ8501012345",
  addressLines: ["Vinohradská 1234/56", "120 00 Praha 2"],
  email: "petr@raseliniste.cz",
  phone: "+420 777 123 456",
  web: "raseliniste.cz",
  bankAccount: "1234567890/0100",
  logoPath: null,
  signaturePath: null,
};

// === 1) Profesionální (classic) ===
const pdfClassic = await renderLetterPdf({
  sender: { ...baseSender, pdfTheme: "classic" },
  recipient: {
    name: "Jana Nováková",
    addressLines: ["Korunní 89", "120 00 Praha 2"],
    showAddress: true,
  },
  letterDate: new Date("2026-04-24"),
  place: "V Praze",
  body: `Vážená paní Nováková,

děkuji za Váš e-mail z minulého týdne, ve kterém jste se ptala na možnosti spolupráce v oblasti webových služeb. S potěšením Vám sděluji, že navržené téma odpovídá tomu, na co se v současné době soustředím, a rád bych se s Vámi setkal a podrobnosti probral osobně.

Navrhuji termín 5. května 2026 v 10:00 v naší kanceláři na Vinohradské, kde si v klidu projdeme zadání i orientační rozpočet.

S pozdravem,
Petr Perina`,
});
writeFileSync("/tmp/preview-classic.pdf", pdfClassic);
console.log("✓ /tmp/preview-classic.pdf");

// === 2) Osobní (personal) ===
const pdfPersonal = await renderLetterPdf({
  sender: { ...baseSender, pdfTheme: "personal" },
  recipient: null, // i kdybys ho zadal, šablona ho nezobrazí
  letterDate: new Date("2026-04-24"),
  place: "V Praze",
  body: `Milá babičko,

děkuji moc za pohlednici z Tatry — krásná! Hned jsem ji pověsil na ledničku vedle té tvé staré z Krkonoš.

Tady všechno běží v pořádku, jen práce je teď trochu víc. Ale na víkendy už zase chodíme na procházky do Stromovky, takže pohyb mám.

Pošlu fotky až budu mít chvíli a slibuju, že na začátku června přijedu.

Měj se krásně, opatruj se,
Petr`,
});
writeFileSync("/tmp/preview-personal.pdf", pdfPersonal);
console.log("✓ /tmp/preview-personal.pdf");
