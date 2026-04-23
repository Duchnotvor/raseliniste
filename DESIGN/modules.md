# Moduly a jejich tinty

Každý funkční modul má svůj pastelový tint. Konzistentně napříč:

- Ikona v sidebaru
- KPI kartička na dashboardu
- Badge / accent v listingu
- Border-left status indikátor, kde je potřeba

## Mapa

| Modul | Tint | Ikona (Lucide) | Kde se objevuje |
|---|---|---|---|
| **Dashboard** | peach | `layout-dashboard` | `/` |
| **Triage** | peach | `inbox` | `/triage` |
| **Capture** | mint | `edit-3` | `/capture` |
| **Úkoly** | peach | `check-square` | `/tasks` |
| **Poznámky** | mint | `notebook-pen` | `/notes` |
| **Deník** | butter | `book-open` | `/journal` |
| **Kalendář** | sky | `calendar` | (brzy) |
| **Zdraví** | rose | `heart-pulse` | `/health` |
| **Kontakty** | lavender | `users` | `/contacts` |
| **Firewall** | peach | `shield` | `/firewall` |
| **Finance** | sage | `wallet` | (brzy) |
| **Soubory** | pink | `folder` | (brzy) |
| **Gemini chat** | rose | `sparkles` | (brzy) |
| **Claude kouč** | lavender | `compass` | (brzy) |
| **Superlist** | mint | `list-todo` | (brzy) |
| **Plaud** | butter | `mic` | (brzy) |

## Settings sub-moduly

| Položka | Tint | Ikona | Co to je |
|---|---|---|---|
| Todoist (Firewall) | mint | `plug` | Todoist token + projekty |
| E-mail (SMTP) | butter | `mail` | SMTP server pro notifikace |
| iPhone Shortcuty | peach | `smartphone` | Návod na shortcuty |
| Napojení Health | rose | `cable` | HAE API klíč + guide |
| Rašeliniště API tokeny | lavender | `key` | Bearer tokeny pro `/api/ingest` |

## Logika přiřazení barev

- **peach** (oranžo-růžová, teplá) — **akce**, primary flow, to co dělám (úkoly, capture → triage, firewall obrana)
- **mint** (zelenomodrá) — **kreativita / růst** (poznámky, capture input, Todoist integrace)
- **butter** (teplá žlutá) — **osobní / měkké** (deník, mail, Plaud osobní nahrávky)
- **sky** (studenější modrá) — **čas / struktura** (kalendář)
- **rose** (teplá červeno-růžová) — **zdraví / AI / naléhavost** (health, Gemini chat, urgent vzkazy)
- **lavender** (fialová) — **lidé / myšlenky / tokeny** (kontakty, API klíče, Claude kouč)
- **sage** (šedozelená) — **peníze, stabilita** (finance, success checkmarky, VIP OK status)
- **pink** (růžová) — **soubory, neutrální** (files)

## Pravidlo aplikace

Když přidáváš novou funkci v existujícím modulu, **dědíš jeho tint**.

Když zakládáš zcela nový modul:

1. Podívej se do seznamu výše, která sémantika nejvíc sedí
2. Nikdy **nepoužívej dvě barvy v jednom modulu** (kromě destructive pro errory a sage pro ✓ status, to jsou systémové)
3. Pokud kategorie nesedí na žádnou ze 8, zamysli se, jestli je to opravdu nový modul nebo podmodul něčeho existujícího

## Ukázka: barevný akcent v Triage karty

```tsx
const TYPE_META: Record<EntryType, { label, icon, tint }> = {
  TASK:      { label: "Úkol",      icon: ListTodo,  tint: "peach"    },
  JOURNAL:   { label: "Deník",     icon: BookOpen,  tint: "butter"   },
  THOUGHT:   { label: "Myšlenka",  icon: Lightbulb, tint: "lavender" },
  CONTEXT:   { label: "Kontext",   icon: Info,      tint: "sky"      },
  KNOWLEDGE: { label: "Knowledge", icon: Library,   tint: "mint"     },
};
```

Každý EntryType má vlastní tint → karta v Triage je odlišná podle typu.

## Sémantické barvy (mimo moduly)

- **sage** → úspěch, ✓, „v Todoistu"
- **destructive** (`oklch(72% 0.18 20)`) → chyby, smazání, varování
- **butter** → upozornění (trojúhelník alert), nenaléhavé
- **rose** → urgentní VIP, naléhavé warnings

Tyhle barvy se mixují do modulových barev (např. sage checkmark na peach
Úkolu — konzistentní).
