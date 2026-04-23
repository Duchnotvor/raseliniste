# Paleta barev

Všechny barvy v **OKLCH** (`oklch(L C h)` — lightness 0-100 %, chroma 0-0.4,
hue 0-360°). Výhoda: pastely mají vyrovnanou vnímanou světlost.

Zdroj: `src/styles/global.css` (sekce `:root`).

---

## Pozadí a text

| Token | Hodnota | Použití |
|---|---|---|
| `--background` | `oklch(14% 0.025 260)` | Hluboká půlnoční modř. Celá appka. |
| `--foreground` | `oklch(98% 0.01 240)` | Primární text (skoro bílá s jemným modravým nádechem). |
| `--muted-foreground` | `oklch(78% 0.02 240)` | Sekundární text, popisky, timestamps. |
| `--card` | `oklch(100% 0 0 / 0.045)` | Transparentní 4,5 % bílý wash na skle. Základ `.glass`. |
| `--popover` | `oklch(22% 0.04 255 / 0.85)` | Dropdowny, tooltips. Tmavší, semi-transparent. |

**Důvod:** při 14 % L pozadí mají pastelové blobs (40-45 % L) silný kontrast
a působí jako „světelné zdroje za sklem" bez únavy očí.

---

## Primary a system

| Token | Hodnota | Použití |
|---|---|---|
| `--primary` | `oklch(82% 0.12 45)` | Peach. Hlavní CTA tlačítka, aktivní stavy. |
| `--primary-foreground` | `oklch(22% 0.05 45)` | Tmavý text NA peach pozadí (kontrast). |
| `--secondary` | `oklch(100% 0 0 / 0.06)` | Ghost / neutrální tlačítko. |
| `--accent` | `oklch(100% 0 0 / 0.08)` | Hover background. |
| `--destructive` | `oklch(72% 0.18 20)` | Delete, chyba. Teplá červená. |
| `--border` | `oklch(100% 0 0 / 0.1)` | Obrys skla, 10 % bílá alfa. |
| `--ring` | `oklch(82% 0.12 45)` | Focus ring (stejná barva jako primary). |

---

## Pastelové tinty — jádro vizuálního jazyka

8 barev, každý modul má svou. Všechny mají ~80-88 % L pro maximální
čitelnost na tmavém pozadí a 0,09-0,12 chroma pro tlumenost (pastel, ne
plná saturace).

| Tint | Hodnota | Hue | Význam / modul |
|---|---|---|---|
| `--tint-peach` | `oklch(82% 0.12 45)` | 45° — oranžová-růžová | **Úkoly**, akce, primary |
| `--tint-butter` | `oklch(88% 0.12 92)` | 92° — žlutá | **Deník**, pozitivní stav |
| `--tint-sage` | `oklch(84% 0.09 145)` | 145° — zelenošedá | **Finance**, úspěch (✓), stability |
| `--tint-mint` | `oklch(84% 0.10 165)` | 165° — mátová | **Poznámky**, knowledge, growth |
| `--tint-sky` | `oklch(82% 0.11 225)` | 225° — modrá | **Kalendář**, info |
| `--tint-lavender` | `oklch(80% 0.11 290)` | 290° — fialová | **Kontakty**, people, thoughts |
| `--tint-pink` | `oklch(82% 0.11 345)` | 345° — růžová | **Soubory**, neutrální |
| `--tint-rose` | `oklch(82% 0.11 15)` | 15° — červená-růžová | **Zdraví**, AI, urgent |

### Jak použít tint v komponentě

```astro
<div style="--c: var(--tint-peach);" class="glass rounded-xl p-4">
  <Icon style="color: var(--c);" />
  <div style="background: color-mix(in oklch, var(--c) 16%, transparent);">
    Jemný badge pozadí
  </div>
</div>
```

**Pravidlo:** `color-mix(in oklch, var(--c) X%, transparent)` kde:
- `X = 16 %` → jemný badge, KPI box
- `X = 20 %` → hover state
- `X = 8 %` → velmi jemný glow
- Text vždy `color: var(--c)` při plné sytosti

---

## Radiální blobs pozadí

Pod celou appkou tři pevné (`background-attachment: fixed`) radiální
gradienty:

1. **Lavender/fialový blob** vpravo nahoře → `oklch(40% 0.15 300 / 0.35)`
2. **Sky/modrý blob** vlevo dole → `oklch(45% 0.14 200 / 0.35)`
3. **Peach/teplý blob** ve středu → `oklch(38% 0.12 40 / 0.18)`

Blobs nemají `filter: blur`, jejich měkkost dělá velikost a `transparent 60%` fallback v gradientu.

---

## Chart colors (Recharts)

| CSS var | Mapuje na | Graph line |
|---|---|---|
| `--chart-1` | `--tint-peach` | Primární metrika |
| `--chart-2` | `--tint-sky` | Sekundární |
| `--chart-3` | `--tint-mint` | 3. série |
| `--chart-4` | `--tint-lavender` | 4. série |
| `--chart-5` | `--tint-butter` | 5. série / highlight |

Pravidlo: **max 5 čar v grafu**, jinak přestane být čitelné. Přes 5 metrik
→ rozdělit na dva grafy nebo použít tooltip.

---

## Kontrast — absolutní minima

Vycházíme z WCAG AA, ale s přísnějšími limity (Petr = horší zrak):

- **Primary text na pozadí:** 98 % L vs. 14 % L → poměr 16:1 (WCAG AAA)
- **Muted text:** 78 % L → poměr ~6:1 (AA large, AAA s obavou u small)
- **Nikdy nepoužívej text pod 70 % L** na main surface
- **Placeholder** může být 50 % L, ale musí být jasně odlišitelný od reálné hodnoty

Testovat: otevřít stránku s `prefers-contrast: more` emulací v DevTools.
