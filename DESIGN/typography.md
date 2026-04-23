# Typografie

Tři fonty, tři role. Žádné odchylky.

## Stack

| Font | Role | CSS var | Kdy použít |
|---|---|---|---|
| **Fraunces Variable** | Display serif | `--font-serif` | H1–H3, nadpisy karet, hero texty |
| **Geist Variable** | Body sans | `--font-sans` | Všechen běžný text, labely, odstavce |
| **Geist Mono Variable** | Mono | `--font-mono` | Data (čísla, ID, timestamps), kód, placeholder labely |

Načítají se přes `@fontsource-variable/*` v `src/layouts/Base.astro`.

## Základní velikosti

Root: `html { font-size: 15.5px }` — o něco větší než standard (16px).
Důvod: Petr má zhoršený zrak, default je příjemnější.

| Tailwind | px (computed) | Kde |
|---|---|---|
| `text-[10px]` | 10 | Uppercase metadata (`uppercase tracking-[0.15em] font-mono`) |
| `text-xs` | 12 | Secondary info, timestamps, hashtags |
| `text-sm` | 14 | Default body, labely formulářů |
| `text-base` | 15.5 | Větší body (textarea input) |
| `text-lg` | 17 | Nadpisy karet, sekční H3 |
| `text-xl` | 20 | H2 sekční, větší karta |
| `text-2xl` | 24 | H1 sekce, dashboard subheader |
| `text-3xl` | 30 | Stránkové nadpisy (Shell heading) |
| `text-4xl` | 36 | /call-log hero, login |
| `text-5xl` | 48 | Login hero „Rašeliniště" |

## Fraunces (serif) — pravidla

- **Jen pro nadpisy a hero texty.** Nikdy pro paragraph copy (ztrácí čitelnost při 14 px).
- `letter-spacing: -0.015em` (tighter) — dělá to autoomaticky `h1, h2, h3, .font-serif`.
- Font-weight: **400 default**, `600-700` pro extra důraz.
- Varianty stylu (italic, soft): **nepoužívat**. Fraunces má spoustu opticalních velikostí, ale appka používá jen defaultní.

## Geist Sans — pravidla

- **Veškerý body text.**
- Výchozí `font-weight: 400`, tučný `500-600` pro důraz.
- Font feature settings: `"ss01", "cv01", "cv11"` (aktivované v `html, body`) — moderní tvary `a`, `g`, `l`.
- `line-height: 1.5` defaultní, `leading-relaxed` (1.625) pro long-form.

## Geist Mono — pravidla

Vždy když zobrazuješ **technická data** nebo **strukturovaný kontent**, který není prose:

- Čísla — telefonní, IDs, tokeny, počty
- Timestamps — `DD. M. YYYY, HH:mm`
- Uppercase metadata labely — `text-[10px] uppercase tracking-[0.15em]`
- Kód, paths
- Hashtagy

Nesaha se na něj výpisy řetězců z AI (to je běžný text → sans).

## Tabular nums

Pro tabulky / grafy / dashboardy s čísly:

```html
<span class="tabular">1 234,56</span>
```

`.tabular` je utility (`font-variant-numeric: tabular-nums`) — čísla se srovnají do sloupců.

## Nadpisy — struktura

```astro
<!-- Stránkový nadpis (v Shell přes `heading` prop) -->
<h1 class="font-serif text-3xl tracking-tight">Úkoly</h1>

<!-- Sekční -->
<h2 class="font-serif text-xl">Dnes</h2>

<!-- Karta -->
<h3 class="font-serif text-lg">Todoist API token</h3>

<!-- Label / metadata nad inputem -->
<label class="text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground">
  Tvoje číslo
</label>
```

## Barvy textu v kontextu

- **H1-H3** → `text-foreground` (98 % L)
- **Paragraph body** → `text-foreground` default
- **Popisky, meta** → `text-muted-foreground` (78 % L)
- **Uppercase labely** → `text-muted-foreground` + `font-mono`
- **Disabled** → `opacity-45` na celém elementu, nikdy vlastní tmavší barvu

## Co nedělat

- ❌ **Serif v body** — Fraunces při 14 px ztrácí.
- ❌ **Mono pro běžný text** — ztrácí rytmus.
- ❌ **Font weight 300 nebo nižší** — na tmavém pozadí mizí.
- ❌ **Italic** — s Fraunces se tlouče, v sans je to moc subtle.
- ❌ **`tracking-widest` na body** — mění to sans v display.
