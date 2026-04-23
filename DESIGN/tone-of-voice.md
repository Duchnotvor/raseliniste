# Tone of voice

Jak komunikuje appka s uživatelem (i s volajícími na /call-log).

## Základní pravidla

- **Čeština.** Primární jazyk, anglicismy minimum. „Login" ok, „inbox" ok, ale ne „submitnout" nebo „processování".
- **Stručně.** Jedna věta, max dvě. Petr preferuje přímou komunikaci bez vaty.
- **Bez výmluv.** Když něco selže, napiš co a proč, ne „Něco se pokazilo".
- **Bez emocí v UI.** Žádné „Úžasně! Skvěle!" (leda u test mailů a podobných pozitivních potvrzení).
- **Čas ve formátu český** — 22. dubna 2026, 14:35.

## Tykání vs. vykání

| Kontext | Forma |
|---|---|
| Appka → Petr (všechny interní stránky) | **Tykání** |
| /call-log (cizí volající) | **Vykání** |
| /call-log/thanks (potvrzení cizímu) | **Vykání** |
| Oslovení VIP na /call-log | **Tykání** („Ahoj, Jano") — protože VIP jsou blízcí |
| Email notifikace (Petrovi) | **Tykání** |
| Emaily mimo Petra (zatím žádné) | vykání |

## Příklady textace

### Empty stavy (tykání, krátké, akční)

> „Zatím žádné úkoly. Diktuj do Rašeliniště (Capture) a Triage je sem pošle."

> „Žádné nevyřízené vzkazy. 🎯"

> „Zatím žádné poznámky. Diktuj do Rašeliniště — Gemini rozpozná knowledge/myšlenky a přistanou tady."

### Error zprávy (konkrétní, actionable)

> „Telefonní číslo není platné."

> „Todoist 401: token není platný. Zkontroluj v Nastavení → Todoist."

> „Přihlášení selhalo: SMTP 535 authentication failed."

Špatně: „Něco se pokazilo.", „Nastala chyba."

### Úspěchy (krátké potvrzení)

> „Uloženo ✓"

> „Úkol odeslán do Todoistu ✓"

> „Vzkaz doručen"

Špatně: „Úspěšně uloženo!", „Gratulujeme, vzkaz byl odeslán."

### Loading

> „Načítám…"

> „Ukládám…"

> „Odesílám…"

> „Importuji… 47 % (470/1035)"

Vždy tři tečky na konci (ne „...", ale Unicode `…` = U+2026).

### Placeholders v inputech

> „+420 777 123 456" (ne „zadejte telefonní číslo")

> „S čím voláš?" (ne „napište zprávu")

> „oko@raseliniste.cz" (ne „email adresa")

Placeholder je **konkrétní příklad**, ne abstraktní nápověda.

### Label nad inputem

Vždy `uppercase tracking-[0.15em] font-mono text-[10px]` + konkrétní název. Nepoužívat placeholder místo labelu.

```html
<label class="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
  Tvoje číslo
</label>
```

### Tlačítka

Slovesa v rozkazovacím způsobu nebo infinitivu:

- „Uložit", „Smazat", „Odeslat", „Přidat", „Potvrdit"
- Ne „OK", „Provést", „Vykonat"
- Destrukce: „Opravdu smazat?" v confirm dialogu (ne „Jsi si jistý?")

### Stránky s AI výstupem (zdravotní analýza)

Gemini produkuje markdown. Prompt mu říká:
- Česky
- Max 3 doporučení
- Bez emotiv
- Tykat Petrovi
- Citovat konkrétní čísla

Výsledek se renderuje přes `.prose-rasel` třídu (viz `global.css`).

## Co NIKDY

- ❌ „Uživateli, …" — nikdy neoslovovat jako „uživatel"
- ❌ Imperativ „MUSÍTE" / „NESMÍTE"
- ❌ Formální floskule („S pozdravem, Váš systém")
- ❌ Vysvětlovat co je appka („Rašeliniště je systém pro…")
- ❌ Reklama nebo gamifikace („Dnešní streak: 5 dní! 🔥")
- ❌ Cookies warning, GDPR konsent (jsi jediný uživatel)

## Signature na /call-log pro volající

Zvláštní vyjímka — tady píšeš **Gideonovým** hlasem, ne appkovým:

- „Gideon je teď ponořen do práce a není na příjmu."
- „Hned jakmile se vynoří a projde si vaše zadání, dá vám vědět."

Tón: **suverénní, klidný, mírně literární** (Gideon je charakter). Vykání,
ale ne úřední. Vytvářet dojem, že volající komunikuje s konkrétní osobou,
ne s robotem.
