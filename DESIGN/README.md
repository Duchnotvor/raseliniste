# Rašeliniště — Design System

Vizuální jazyk appky. Hlavní myšlenka: **Apple VisionOS-inspired „Liquid Glass"**
— tmavá půlnoční modř, nad ní tlumené pastelové light-blobs, povrchy řešené
průhledným sklem s `backdrop-blur`.

Zdroj pravdy pro barvy + utility je **`src/styles/global.css`**. Tento adresář
jen popisuje *proč to je takhle* a *jak to používat*.

## Obsah

- **`README.md`** — tento přehled, rychlý start.
- **`palette.md`** — kompletní paleta barev (pozadí, foreground, pastelové tinty, destructive).
- **`typography.md`** — fonty, velikosti, kdy použít který.
- **`components.md`** — glass utility (`.glass`, `.glass-strong`, `.glass-subtle`), tlačítka, karty, formuláře.
- **`modules.md`** — mapování „který modul má jaký tint" (Úkoly = peach, Zdraví = rose …).
- **`motion.md`** — animace, fade-in při mountu, reduced-motion.
- **`tone-of-voice.md`** — textace, tykání vs. vykání, délka popisků.

## Základní pilíře

1. **Dark-only.** Žádný light mode. Pozadí je hluboká `oklch(14% 0.025 260)` půlnoční modř. Uživatel (Petr) má **zhoršený zrak**, takže foreground drží 98 % jas.
2. **OKLCH colorspace.** Všechny barvy v `oklch(L C h)` formátu. Díky tomu jsou pastely vyrovnané ve vnímaném jasu (žlutá neprská víc než modrá).
3. **Liquid Glass.** Karty nejsou solidní `bg-card`, ale **průhledné vrstvy** přes `backdrop-filter: blur(24px) saturate(140%)`. Přes transparentní tint prosvítají radiální pastelové blobs z pozadí → živé, nikdy ne ploché.
4. **Každý modul = jeden pastel.** Úkoly peach, poznámky mint, deník butter, zdraví rose, kontakty lavender. Ikona v sidebaru, KPI kartička, badge v tabulce — vše jednou barvou sjednocené.
5. **Fraunces serif pro nadpisy, Geist sans pro body, Geist Mono pro data.** Typografický trojhlas, konzistentní napříč appkou.
6. **Kontrast je must-have.** Žádné tmavé texty pod 70 % L. Muted info je 78 %, primární text 98 %. Placeholdery se drží okolo 50 %, ale nikdy pod.
7. **Mobilní UX na prvním místě.** Sidebar je off-canvas pod `lg`. Formuláře jsou nativní (`<input type="date">`, `<select>`) — iOS picker pořád funguje.
8. **Hutnost informací, ne prázdné plochy.** Petr preferuje info-dense layouty. Karty jsou kompaktní, v tabulkách je víc řádků, padding je uměřený.

## Rychlý start pro komponent

1. **Potřebuješ kartu?** `class="glass rounded-xl p-5"` — základní glass panel.
2. **Potřebuješ „wow" panel** (login, modály)? `class="glass-strong rounded-xl p-6"` — výraznější stín, vyšší blur.
3. **Jemný hint** (info tipy, disabled karty)? `class="glass-subtle"`.
4. **Chceš barevný akcent modulu?** `style="--c: var(--tint-peach)"` na kořen komponenty, pak uvnitř `color: var(--c)` nebo `background: color-mix(in oklch, var(--c) 16%, transparent)`.
5. **Hlavní nadpis?** `<h1 class="font-serif text-3xl tracking-tight">` (Fraunces).
6. **Datum, ID, číslo?** `<span class="font-mono text-xs">` (Geist Mono).
7. **Placeholder stránka?** Container `max-w-2xl mx-auto` uvnitř `<Shell>`.

## Co NEDĚLAT

- **Neměň barvy v komponentě.** Všechny tinty jsou v `global.css`. Když chceš novou, přidej ji mezi `--tint-*` proměnné.
- **Nepoužívej plné `bg-white`** na povrchy — porušuje liquid glass princip. Max `bg-white/5` nebo `bg-white/10` pro hover.
- **Nepřidávej light mode.** Rozhodnutí definitivní.
- **Nepiš animace delší než 400 ms.** Cítí se pomale.
- **Žádné hand-drawn efekty** (rough.js, wobble, sketch-style). Petr 4× zamítl.
- **Neohrožuj kontrast** — nikdy `text-muted-foreground` na `bg-muted` (obě jsou světlé).

## Rozhodnutí, která se už NEMĚNÍ

- **Dark-only** (2025-Q4)
- **OKLCH místo HSL** — kvůli vnímanému jasu
- **Fraunces/Geist/Geist Mono** typografický trojhlas
- **Liquid Glass** jako primární vizuální jazyk (po 4 zamítnutých alternativách)
- **Tailwind v4** (ne v3) — `@theme` syntax, CSS-first config
- **Lucide ikony** — Astro via `astro-icon`, React via `lucide-react`
