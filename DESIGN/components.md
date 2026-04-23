# Komponenty a utility

## Glass utility (`src/styles/global.css`)

Tři úrovně průhledného skla. Vybírej podle důležitosti povrchu.

### `.glass` — default

Základní karta. Používá se na 90 % karet v appce.

```css
background: var(--card);              /* 4,5 % white wash */
backdrop-filter: blur(24px) saturate(140%);
border: 1px solid var(--border);      /* 10 % white alfa */
box-shadow:
  inset 0 1px 0 0 oklch(100% 0 0 / 0.08),   /* jemný horní glow (rim light) */
  0 20px 60px -30px oklch(0% 0 0 / 0.6);    /* mírný stín pod kartou */
```

**Kombinace:** `<div class="glass rounded-xl p-5">`

### `.glass-strong` — wow povrchy

Výraznější, pro modály, login, zásadní CTA karty.

```css
background: oklch(100% 0 0 / 0.08);         /* 8 % wash */
backdrop-filter: blur(32px) saturate(150%); /* vyšší blur */
border: 1px solid oklch(100% 0 0 / 0.14);   /* výraznější obrys */
box-shadow: vyšší inset + větší drop        /* dramatičtější stín */
```

Použití: `<div class="glass-strong rounded-xl p-6">`

### `.glass-subtle` — disabled / hint panely

Téměř neviditelné, jen naznačení povrchu.

```css
background: oklch(100% 0 0 / 0.025);  /* 2,5 % */
backdrop-filter: blur(12px) saturate(130%);
border: 1px solid oklch(100% 0 0 / 0.06);
```

Použití: disabled položky, info tipy.

---

## Button (`src/components/ui/Button.tsx`)

Shadcn-style s CVA varianty.

### Varianty

| Variant | Použití | Příklad |
|---|---|---|
| `default` | Primary CTA | Uložit, Odeslat, Přidat |
| `outline` | Sekundární akce | Test připojení, Zrušit |
| `ghost` | Destruktivní / neutrální | Smazat, Zavřít |
| `destructive` | Warnings | Opravdu smazat kontakt |
| `glass` | Uvnitř karty | (skoro nepoužívané) |
| `secondary` | Alternativní CTA | (skoro nepoužívané) |

### Velikosti

- `default` — h-9 px-4 (běžné)
- `sm` — h-8 px-3 text-xs (v toolbaru, cardech)
- `lg` — h-10 px-6 text-base (login, hero)
- `icon` — size-9 (jen ikona)

### Struktura

```tsx
<Button onClick={save} disabled={saving}>
  {saving ? <><Loader2 className="animate-spin" /> Ukládám…</> : <><Check /> Uložit</>}
</Button>
```

**Pravidlo:** Loading state vždy přes `<Loader2 className="animate-spin" />` + text „Ukládám…" / „Odesílám…" / „Načítám…". Nikdy ne spinner bez textu.

---

## Input (`src/components/ui/Input.tsx`)

```tsx
<div className="relative">
  <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
  <Input type="email" value={email} onChange={...} className="pl-9" />
</div>
```

**Pattern:** ikona vlevo přes `absolute left-3`, input padding `pl-9` (36 px).

Nativní `<input>` / `<select>` / `<textarea>` styluje se takto:

```html
<input class="w-full px-3 py-2.5 rounded-md bg-background/40 border border-border/60
              focus:border-primary focus:outline-none text-base" />
```

**Proč nativní:** na mobilu vyvolá správnou klávesnici (`type="tel"` → číselník, `type="email"` → @), iOS date picker, Select list. Custom picker je horší UX.

---

## Karta modulu (ukázkový pattern)

```astro
<div class="glass rounded-xl p-4" style={`--c: var(--tint-${tint});`}>
  <div class="flex items-start gap-3">
    <!-- Ikona v „pill" boxíku s barevným tintem -->
    <div class="size-10 rounded-md grid place-items-center"
         style="background: color-mix(in oklch, var(--c) 16%, transparent); color: var(--c);">
      <Icon class="size-5" />
    </div>
    <div class="flex-1 min-w-0">
      <h3 class="font-serif text-lg">Titulek karty</h3>
      <p class="text-sm text-muted-foreground mt-0.5">Popis</p>
    </div>
  </div>
</div>
```

---

## Badge / chip

Nepoužíváme samostatnou komponentu, inline:

```html
<!-- Tint badge -->
<span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider"
      style="background: color-mix(in oklch, var(--c) 20%, transparent); color: var(--c);">
  VIP
</span>

<!-- Neutrální -->
<span class="px-1.5 py-0.5 rounded bg-white/5 text-[11px] font-mono">
  mobile
</span>
```

---

## KPI karta (Dashboard)

```astro
<div class="glass rounded-xl p-4" style={`--c: var(--tint-${tint});`}>
  <div class="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] font-mono text-muted-foreground">
    <Icon style="color: var(--c);" class="size-3.5" />
    {label}
  </div>
  <div class="mt-1 font-serif text-3xl tabular">{value}</div>
  <div class="text-xs text-muted-foreground tabular">{delta}</div>
</div>
```

---

## Modal / dialog

Full-screen backdrop + centrovaná `.glass-strong` karta:

```tsx
<div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
     onClick={() => onClose(false)}>
  <div className="glass-strong rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5"
       onClick={(e) => e.stopPropagation()}>
    {/* content */}
  </div>
</div>
```

**Pravidlo:** klik na backdrop = close, klik uvnitř = stopPropagation.

---

## Toast (nahoře, transient)

```tsx
{toast && (
  <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md text-sm font-medium shadow-lg ${
    toast.type === "ok"
      ? "bg-[var(--tint-sage)]/90 text-black"
      : "bg-destructive/90 text-destructive-foreground"
  }`}>
    {toast.text}
  </div>
)}
```

Auto-dismiss po 3,2 s (`setTimeout`).

---

## Scrollbar

WebKit stylovaný v `global.css`, 8 px širý, 8 % bílý track, 15 % na hover. Firefox default — na desktopu úplně OK.

---

## Focus ring

`:focus-visible` — 2 px outline v `--ring` (peach), 2 px offset, 2 px radius. Aplikuje se automaticky na vše focusable. Nemodifikovat.
