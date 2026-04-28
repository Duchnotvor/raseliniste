/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Page, Text, View, StyleSheet, pdf, Font } from "@react-pdf/renderer";
import { createElement as h, type ReactElement } from "react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/fonts",
);

let fontsRegistered = false;
function ensureFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "NotoSans",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSans-Regular.ttf") },
      { src: path.join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "NotoSerif",
    fonts: [
      { src: path.join(FONT_DIR, "NotoSerif-Regular.ttf") },
      { src: path.join(FONT_DIR, "NotoSerif-Bold.ttf"), fontWeight: 700 },
    ],
  });
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 60,
    fontSize: 11,
    fontFamily: "NotoSans",
    color: "#1a1a1a",
    lineHeight: 1.55,
  },
  header: { marginBottom: 30 },
  brand: { fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#888", marginBottom: 6 },
  title: { fontFamily: "NotoSerif", fontWeight: 700, fontSize: 26, marginBottom: 8 },
  subtitle: { fontSize: 13, color: "#444" },
  greeting: { fontSize: 13, marginTop: 14, marginBottom: 18 },
  h2: { fontFamily: "NotoSerif", fontWeight: 700, fontSize: 16, marginTop: 16, marginBottom: 8 },
  para: { marginBottom: 8 },
  bullet: { flexDirection: "row", marginBottom: 4, paddingLeft: 4 },
  bulletDot: { width: 10, color: "#b8763c", fontWeight: 700 },
  bulletText: { flex: 1 },
  cta: {
    marginTop: 16,
    backgroundColor: "#f5d8a8",
    padding: 12,
    borderRadius: 8,
    fontSize: 11,
  },
  ctaTitle: { fontFamily: "NotoSerif", fontWeight: 700, fontSize: 13, marginBottom: 4 },
  link: { color: "#b8763c", fontFamily: "NotoSans", fontWeight: 700, fontSize: 10 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 60,
    right: 60,
    borderTop: "1pt solid #cccccc",
    paddingTop: 8,
    fontSize: 8,
    color: "#888",
    textAlign: "center",
  },
});

interface OnboardingData {
  guestName: string;
  projectName: string;
  projectDescription: string | null;
  inviteLink: string;
}

function Bullet({ children }: { children: string }) {
  return h(View, { style: styles.bullet },
    h(Text, { style: styles.bulletDot }, "·"),
    h(Text, { style: styles.bulletText }, children),
  );
}

// =============================================================================
// STANDARD onboarding (krátký záznam)
// =============================================================================
function StandardOnboarding(d: OnboardingData): ReactElement {
  return h(Document, null,
    h(Page as any, { size: "A4", style: styles.page },
      // Hlavička
      h(View, { style: styles.header },
        h(Text, { style: styles.brand }, "Rašeliniště · Studna"),
        h(Text, { style: styles.title }, "Vítej v projektu"),
        h(Text, { style: styles.subtitle }, d.projectName),
      ),

      // Pozdrav
      h(Text, { style: styles.greeting },
        `Ahoj ${d.guestName},\n\nPetr tě pozval do projektu „${d.projectName}". Prosím přečti si tenhle krátký návod, jak to bude fungovat.`,
      ),

      // O projektu
      d.projectDescription && h(View, null,
        h(Text, { style: styles.h2 }, "O projektu"),
        h(Text, { style: styles.para }, d.projectDescription),
      ),

      // Jak to funguje
      h(Text, { style: styles.h2 }, "Jak to funguje"),
      h(Text, { style: styles.para },
        "Když tě napadne myšlenka, postřeh, otázka nebo nápad k projektu — otevřeš odkaz, který ti Petr poslal, a nahraješ si ji hlasem. AI to přepíše a vyextrahuje klíčové body. Petr si to pak v klidu projde.",
      ),

      // Kroky
      h(Text, { style: styles.h2 }, "Krok za krokem"),
      h(Bullet, null, "Otevři odkaz, který ti Petr poslal (najdeš ho dole na této stránce)."),
      h(Bullet, null, 'Klikni na velké tlačítko s mikrofonem („Tap pro záznam").'),
      h(Bullet, null, "Mluv. Vyprávěj normálně, jako bys to říkal Petrovi do telefonu."),
      h(Bullet, null, "Po skončení klikni Stop. Pokud zapomeneš, záznam se sám zastaví po 10 minutách."),
      h(Bullet, null, 'Uvidíš potvrzení „Záznam uložen ✓". Hotovo.'),

      // Tipy
      h(Text, { style: styles.h2 }, "Pár tipů, ať to dobře dopadne"),
      h(Bullet, null, "První otevření tě poprosí o povolení mikrofonu — povol mu to."),
      h(Bullet, null, "Mluv klidně a v relativním tichu. AI rozumí češtině moc dobře."),
      h(Bullet, null, "Jeden záznam = jedna myšlenka / téma. Ne potřeba tlačit tam toho moc — radši víc krátkých."),
      h(Bullet, null, "Nemůžeš si ublížit. Cokoli nahraješ, můžeš nahrát znovu lépe."),
      h(Bullet, null, "Petr vidí jméno autora u každého záznamu, takže se neztratí, kdo co řekl."),

      // CTA
      h(View, { style: styles.cta },
        h(Text, { style: styles.ctaTitle }, "Tvůj odkaz:"),
        h(Text, { style: styles.link }, d.inviteLink),
        h(Text, { style: { ...styles.para, marginTop: 8, marginBottom: 0, fontSize: 10 } },
          "Přidej si ho do oblíbených nebo na plochu telefonu (Safari → Sdílet → Přidat na plochu) — pak ho budeš mít po ruce.",
        ),
      ),

      h(Text, { style: styles.footer },
        "Děkuji, Petr · raseliniste.cz",
      ),
    ),
  );
}

// =============================================================================
// BRIEF onboarding (klíčový brief)
// =============================================================================
function BriefOnboarding(d: OnboardingData): ReactElement {
  return h(Document, null,
    h(Page as any, { size: "A4", style: styles.page },
      h(View, { style: styles.header },
        h(Text, { style: styles.brand }, "Rašeliniště · Studna · Klíčový brief"),
        h(Text, { style: styles.title }, "Klíčový brief k projektu"),
        h(Text, { style: styles.subtitle }, d.projectName),
      ),

      h(Text, { style: styles.greeting },
        `Ahoj ${d.guestName},\n\nPetr tě požádal o tzv. „klíčový brief" — delší audio nahrávku, která pomůže nastavit kontext projektu „${d.projectName}". Ber to jako asi 30-90 minut, ve kterých nahlas vyprávíš to nejdůležitější.`,
      ),

      d.projectDescription && h(View, null,
        h(Text, { style: styles.h2 }, "O projektu"),
        h(Text, { style: styles.para }, d.projectDescription),
      ),

      h(Text, { style: styles.h2 }, "Co to klíčový brief je"),
      h(Text, { style: styles.para },
        "Brief je delší a komplexnější než běžný záznam. Slouží Petrovi jako referenční materiál o projektu — kontext, historie, klíčové postavy, hlavní cíle, otevřené otázky. Vrací se k němu opakovaně. AI ho zpracovává hloubkově (Gemini Pro), takže vznikne strukturovaný dokument: souhrn, glosář pojmů, aktéři, historie rozhodnutí.",
      ),

      h(Text, { style: styles.h2 }, "Co tvůj brief by měl obsahovat"),
      h(Bullet, null, "O čem je projekt — proč vznikl, co řeší, co je cíl."),
      h(Bullet, null, "Stručná historie — kde to začalo, čím vším projekt prošel."),
      h(Bullet, null, "Klíčové postavy — kdo je v týmu, kdo má jakou roli, kdo rozhoduje o čem."),
      h(Bullet, null, "Aktuální stav — co se teď děje, co je rozhodnuté, co se řeší."),
      h(Bullet, null, "Otevřené otázky — co je nedořešeno, kde Petr může pomoct."),
      h(Bullet, null, "Důležitá rozhodnutí, která padla — proč, kdy, kdo."),
      h(Bullet, null, "Pojmy a zkratky, které v projektu používáme."),
    ),

    // Druhá stránka
    h(Page as any, { size: "A4", style: styles.page },
      h(Text, { style: styles.h2 }, "Jak brief nahrát"),
      h(Text, { style: styles.para },
        "Brief NEnahrávej přímo přes web (90 minut v prohlížeči je riskantní — vybitá baterie, výpadek sítě, atd.). Místo toho:",
      ),

      h(Text, { style: { ...styles.h2, fontSize: 14, marginTop: 14 } }, "iPhone — krok za krokem"),
      h(Bullet, null, "Otevři aplikaci Hlasové poznámky (Voice Memos) — má červenou vlnku."),
      h(Bullet, null, "Klepni na velké červené kolečko a začni mluvit."),
      h(Bullet, null, "Telefon klidně polož na stůl. Mluv normálně, můžeš si dát pauzu, vrátit se, zkusit jinak — nevadí."),
      h(Bullet, null, "Po skončení klepni na červený čtvereček (Stop)."),
      h(Bullet, null, 'Klepni na výsledný záznam (často nazvaný „Nový záznam") → tři tečky → Sdílet.'),
      h(Bullet, null, 'Vyber „Uložit do souborů" (Save to Files), nebo si ho pošli e-mailem sobě.'),

      h(Text, { style: { ...styles.h2, fontSize: 14, marginTop: 14 } }, "Android"),
      h(Bullet, null, "Použij vestavěný Záznamník (Recorder), nebo aplikaci Easy Voice Recorder."),
      h(Bullet, null, "Nahraj jako MP3, M4A, WAV nebo WebM."),
      h(Bullet, null, "Soubor si pak najdi v souborovém manažeru nebo v Galerii audio."),

      h(Text, { style: { ...styles.h2, fontSize: 14, marginTop: 14 } }, "Upload do Studny"),
      h(Bullet, null, "Otevři odkaz, který ti Petr poslal (dole na této stránce)."),
      h(Bullet, null, 'Pod tlačítkem mikrofonu klikni „Klíčový brief — nahrát soubor →".'),
      h(Bullet, null, 'Klikni „Vybrat soubor" a najdi audio, které jsi natočil.'),
      h(Bullet, null, 'Klikni „Odeslat brief". Vydrž 1-3 minuty — AI ho zpracovává.'),
      h(Bullet, null, 'Uvidíš potvrzení „Záznam uložen ✓".'),

      h(Text, { style: styles.h2 }, "Tipy pro dobrý brief"),
      h(Bullet, null, "Mluv klidně, neboj se odboček a vsuvek — AI z toho vytáhne strukturu."),
      h(Bullet, null, 'Pokud zapomeneš, vrať se a doplň („A ještě k tomu, na co jsem zapomněl…").'),
      h(Bullet, null, "Pokud děláš pauzu, klidně si ji udělej — nahrávka může být dlouhá."),
      h(Bullet, null, 'Nemusíš mluvit „akademicky" — Petrovi pomáhá tvůj přirozený způsob, jak o projektu přemýšlíš.'),
      h(Bullet, null, "Nestresuj se chybami v řeči — AI je opraví."),

      h(View, { style: styles.cta },
        h(Text, { style: styles.ctaTitle }, "Tvůj odkaz pro upload:"),
        h(Text, { style: styles.link }, d.inviteLink),
        h(Text, { style: { ...styles.para, marginTop: 8, marginBottom: 0, fontSize: 10 } },
          "Pošli si ho i sobě na telefon, kde máš to audio — ať můžeš nahrát přímo z mobilu.",
        ),
      ),

      h(Text, { style: styles.footer },
        "Děkuji, Petr · raseliniste.cz",
      ),
    ),
  );
}

export async function renderOnboardingPdf(
  variant: "standard" | "brief",
  data: OnboardingData,
): Promise<Buffer> {
  ensureFonts();
  const doc = variant === "brief" ? BriefOnboarding(data) : StandardOnboarding(data);
  const stream = await pdf(doc as any).toBuffer();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks);
}
