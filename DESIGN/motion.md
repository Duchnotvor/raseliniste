# Animace a motion

Všechno v appce je **rychlé**. Když animace trvá víc než 400 ms, pohni tím dolů.

## Základní principy

- **Jemnost > efektnost.** Easing `cubic-bezier(0.2, 0.8, 0.2, 1)` — měkký out.
- **Transform + opacity only.** Žádné animace `width`, `height`, `top`, `left` — jsou drahé a trhané.
- **Respekt `prefers-reduced-motion`** — viz globální override v `global.css`.

## Globální mount animation

Na **první** 3 děti `<main>` se aplikuje jemný fade-up:

```css
@keyframes rasel-fade-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
main > :is(section, div, h1):first-child,
main > :is(section, div):nth-child(-n+3) {
  animation: rasel-fade-up 360ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
main > :nth-child(2) { animation-delay: 40ms; }
main > :nth-child(3) { animation-delay: 80ms; }
```

- Trvání: **360 ms**
- Stagger: 40 ms mezi prvky
- Transform: jen `translateY(4px → 0)`, žádný scale

**Reduced motion:** `@media (prefers-reduced-motion: reduce) { main > * { animation: none !important; } }` — úplně vypne.

## Transitions pro interaktivitu

| Prvek | Property | Duration | Easing |
|---|---|---|---|
| Hover na kartě | `background-color, border-color, transform` | 180 ms | `ease` |
| Button hover | `background-color, opacity` | default Tailwind (150 ms) | `ease` |
| Modal open/close | `opacity + transform scale(0.98 → 1)` | 200 ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Sidebar (mobile) | `transform translateX` | default CSS | default |
| Toast slide-in | — (jen opacity fade) | 200 ms | ease |

## `.glass-hover` utility

```css
.glass-hover { transition: background-color 180ms, border-color 180ms, transform 180ms; }
.glass-hover:hover {
  background: oklch(100% 0 0 / 0.06);
  border-color: oklch(100% 0 0 / 0.15);
}
```

Klikatelné glass karty. Na pohyblivých kartách NEpoužívat `transform: translateY(-2px)` na hover — roztrhá to layout.

## Loading stavy

**Spinner:** `<Loader2 className="animate-spin size-4" />` (Lucide). Tailwind `animate-spin` = 1 s linear.

Combine s textem: `<><Loader2 /> Ukládám…</>`. Nikdy spinner sám.

**Skeleton:** zatím nepoužíváme. Pokud někdy budeme, použijeme `tw-animate-css` (`animate-pulse`).

## Čeho se vyhnout

- ❌ **Spring animace** (framer-motion) — overkill, nic nepotřebuje nic jiného než CSS transition.
- ❌ **Parallax** na scroll — působí amatérsky + zmatek UX.
- ❌ **Wobble, shake, bounce** — není to Duolingo.
- ❌ **Delay > 100 ms** v sekvenci — uživatel čeká a je naštvaný.
- ❌ **Scrollování navázané na animaci** — ztrácí kontrolu.
- ❌ **Hand-drawn / sketch-style** (rough.js wobble) — 4× zamítnuté.

## Jediná přípustná „wow" animace

Fade-up při mountu. A i ta je jen 4 px pohyb. Všechno ostatní je **instant** nebo **subtle transition**.

**Poznámka:** Pokud budeš přidávat nový loading flow (dlouhý job, import),
použij **progress bar s procenty** (`0% → 100%`), ne abstraktní spinner.
Uživatel chce vidět, že to postupuje.
