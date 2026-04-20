# Rašeliniště — Deploy na Synology DS718+

Step-by-step pro první deploy. Postupuj v pořadí.

---

## Co je tu ve složce

- `README.md` — tenhle návod
- `docker-compose.yml` — kopie finální verze (to co nahraješ do DSM Container Manageru)
- `env-template.txt` — šablona `.env` s komentářem, co kam dát + jak vygenerovat secrets
- `task-scheduler-monthly-health.sh` — příkaz pro DSM Task Scheduler (měsíční health report)

---

## Checklist (odkudkoliv se vrátit)

### 1. GitHub setup ⬜
- [ ] GitHub repo existuje pod `<user>/raseliniste` (nebo jiný název)
- [ ] `docker-compose.yml` má správnou `image:` URL (ghcr.io/<user>/raseliniste/app:latest)
- [ ] První commit + push na `main` proveden
- [ ] GitHub Actions build doběhl (~5 min) — Actions tab → zelená
- [ ] Image v ghcr.io přepnutý na **Public** (Packages → Package settings)

### 2. DSM prerekvizity ⬜
- [ ] DNS: `A www.raseliniste.cz → <veřejná IP NASu>` (nebo DDNS + CNAME)
- [ ] Router port forward: 80 + 443 → NAS
- [ ] DSM Web Station → Služba webu → **„Výchozí server" smazaný** (jinak zabírá 443)
- [ ] DSM Control Panel → Security → Certificate → Let's Encrypt pro `www.raseliniste.cz`
- [ ] DSM Login Portal → Advanced → Reverse Proxy: `https://www.raseliniste.cz:443` → `http://localhost:3333`

### 3. Container Manager ⬜
- [ ] File Station: vytvořit složku `/docker/raseliniste/`
- [ ] Upload `docker-compose.yml` + `.env` (vyplněné dle `env-template.txt`)
- [ ] Container Manager → Project → Create → **source: local, composefile: /docker/raseliniste/docker-compose.yml**
- [ ] Build → Start
- [ ] Ověřit `raseliniste_app` a `raseliniste_db` běží (zelené)

### 4. První uživatel ⬜
- [ ] Container Manager → `raseliniste_app` → Terminal → `npm run db:seed`
- [ ] Browser: `https://www.raseliniste.cz/login`
- [ ] Login: `Gideon` / heslo z `ADMIN_PASSWORD`
- [ ] Po hesle se zobrazí „Registrace passkey" → Touch ID / Face ID
- [ ] Dostal ses na dashboard? ✅

### 5. Tokens + integrace ⬜
- [ ] `/settings/tokens` → vytvořit 3 tokeny: „iPhone Capture", „iPhone Deník", „Health Auto Export"
- [ ] Zkopírovat plain tokeny do Notes (nebo password manageru) — zobrazí se jen jednou
- [ ] iPhone: vytvořit 2 Shortcuty dle `/settings/shortcuts`
- [ ] iPhone: nakonfigurovat HAE aplikaci dle `/settings/ingest`

### 6. Email (Resend) ⬜ (volitelné, ale doporučené)
- [ ] Registrace na `resend.com`
- [ ] Add domain `raseliniste.cz` → DNS záznamy u registrátora (SPF, DKIM, MX)
- [ ] API Keys → Create → doplnit do `.env` jako `RESEND_API_KEY`
- [ ] Restart kontejneru (Container Manager → Project → Restart)
- [ ] `/settings/reports` → zadat tvůj soukromý email

### 7. Měsíční cron ⬜ (volitelné)
- [ ] DSM Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script
- [ ] Zkopíruj příkaz z `task-scheduler-monthly-health.sh`
- [ ] Schedule: Monthly, Last day, 23:00
- [ ] Ručně otestovat: pravý klik → Run → zkontrolovat v `/health` že přibyla analýza

---

## Krok 1 — GitHub repo (první push)

Pokud repo ještě **neexistuje** na GitHubu:

```bash
# volby (dle toho co máš):
# a) gh CLI
gh repo create <user>/raseliniste --private --source=. --remote=origin --push

# b) ručně:
# 1. GitHub.com → New Repository → jméno: raseliniste, Private
# 2. lokálně:
cd "~/CLOUDS/CLOUDE PROJECTS/raseliniste"
git remote add origin git@github.com:<user>/raseliniste.git
git branch -M main
```

Pak:

```bash
git add -A
git commit -m "Plný scaffold: Auth + Capture + Deník + Zdraví + Settings"
git push -u origin main
```

GitHub Actions se automaticky spustí (`.github/workflows/docker-build.yml`) a postaví Docker image na `ghcr.io/<user>/raseliniste/app:latest` (lowercase).

**Poznámka:** Actions publikují image do ghcr.io se jménem `ghcr.io/<owner-lowercase>/<repo-lowercase>/app`. Ujisti se, že `docker-compose.yml` v kořeni + v této složce má **správnou URL**.

---

## Krok 2 — Image public

Po doběhnutí Actions:

1. GitHub → Profile → **Packages** (tab vedle Repositories)
2. Klik na `<repo>` package
3. Vpravo **Package settings** (nebo „…" menu)
4. Scroll dolů → **Change visibility** → **Public**

Proč: Synology Container Manager pak nepotřebuje PAT (personal access token) pro ghcr.io. Tím pádem odpadá jedna třída problémů. Tvé source repo může klidně zůstat Private.

---

## Krok 3 — `.env` na NASu

V File Station vytvoř `/docker/raseliniste/.env`. Obsah podle `env-template.txt`. Nejdůležitější:

- `DB_PASSWORD` — vygeneruj: `openssl rand -base64 24 | tr -d '/+='`
- `SESSION_SECRET` — vygeneruj: `openssl rand -base64 48`
- `APP_URL=https://www.raseliniste.cz`
- `ADMIN_USERNAME=Gideon`
- `ADMIN_PASSWORD` — vygeneruj: `openssl rand -base64 18 | tr -d '/+=' | cut -c1-20`
- `GEMINI_API_KEY` — z AI Studio (stejný jaký máš lokálně, nebo nový)
- `RESEND_API_KEY`, `NOTIFICATION_FROM`, `NOTIFICATION_EMAIL` — viz Krok 6
- `CRON_SECRET` — vygeneruj: `openssl rand -base64 32`

**Důležité:** Linux line endings (LF, ne CRLF). Pokud to editoruješ na Windows, ulož jako UTF-8 LF. Jinak Docker bash rozbije import.

---

## Krok 4 — Container Manager Project

1. **Upload** `docker-compose.yml` + `.env` do `/docker/raseliniste/`
2. Container Manager → **Project** → **Create**
3. Project name: `raseliniste`
4. Path: `/docker/raseliniste`
5. Source: **Use existing docker-compose.yml**
6. Next → **Build** → ~3 min se pullí image a spouští
7. Ověř: oba kontejnery `raseliniste_app` + `raseliniste_db` běží (zelený status)

**Pokud něco selže:**
- Container Manager → Logs → hledej `ERROR` nebo Prisma hlášky
- Nejčastější: `.env` syntax chyba (chybí uvozovky, CRLF)
- Pokud volume permissions EACCES → entrypoint to má řešit sám, ale pokud ne: Container Manager → Project → Clear → znovu Start (volume se vytvoří čistě)

---

## Krok 5 — První seed

V Container Manager → container `raseliniste_app` → **Terminal** (pravý sloupec) → `bash`:

```bash
npm run db:seed
# Výstup: [seed] Vytvořen admin user 'Gideon'.
```

Pokud dostaneš `User 'Gideon' už existuje — seed přeskočen`, je to OK.

---

## Krok 6 — První login z prohlížeče

1. Otevři `https://www.raseliniste.cz/login` (pozor: **nová doména**, jiný `rpID` než localhost)
2. Username: `Gideon`, Password: z `ADMIN_PASSWORD`
3. Po hesle → zobrazí se „Registrace passkey"
4. Potvrdit Touch ID (Mac) / Face ID (iPhone) → dostaneš se na Dashboard ✅

**Pokud ti příště nefunguje Touch ID z jiného zařízení** — enrollni další passkey z něho (každé zařízení samostatně).

---

## Krok 7 — Tokens pro iPhone

`/settings/tokens` → **Nový token**:

1. **„iPhone Capture"** → POST `/api/ingest` s Bearer auth
2. **„iPhone Deník"** → POST `/api/journal/ingest` s x-api-key
3. **„Health Auto Export"** → POST `/api/health-ingest` s x-api-key

Po vytvoření **hned zkopíruj plain token** (ukáže se jednou, pak jen hash). Každý na iPhonu do 1 Shortcutu / aplikace.

---

## Krok 8 — iPhone Shortcuty a HAE

- `/settings/shortcuts` — 2 karty s kompletním návodem (Rasel Capture + Rasel Deník)
- `/settings/ingest` — 6-krokový návod pro Health Auto Export aplikaci

Obojí je v aplikaci, přístupné po přihlášení. Copy-to-clipboard tlačítka u URL / headers / curl příkazů.

---

## Krok 9 — Resend email (volitelné)

Aby měsíční zdravotní reporty chodily na mail:

1. `resend.com` → registrace
2. Domains → Add `raseliniste.cz` → zobrazí TXT (SPF, DKIM) + MX záznamy
3. Přidat u registrátora domény (kde máš DNS)
4. Počkat 10-30 min na ověření
5. API Keys → Create → zkopírovat
6. V `.env` na NASu doplnit:
   ```
   RESEND_API_KEY=re_xxx
   NOTIFICATION_FROM=reports@raseliniste.cz
   ```
7. `/settings/reports` v aplikaci → zadat soukromou adresu (např. petr@seznam.cz)
8. Container Manager → Project → Restart

---

## Krok 10 — Měsíční cron

1. DSM Control Panel → **Task Scheduler** → Create → **Scheduled Task → User-defined script**
2. General:
   - Task name: `Raseliniste monthly health report`
   - User: `root`
3. Schedule:
   - Run on: **Monthly**
   - Day of month: **Last day**
   - First run time: `23:00`
4. Task Settings → Run command: obsah souboru `task-scheduler-monthly-health.sh`
5. OK
6. **Test** — pravý klik na task → **Run** → hned ověř v `/health` že přibyla analýza s badge „měsíční"

---

## Update flow (později)

Jakmile udělám další změnu a pushnu na `main`:

1. GitHub Actions se spustí (~5 min)
2. Na NASu: Container Manager → **Image** (levé menu) → najdi `ghcr.io/…/app:latest` → **Pull latest**
3. Container Manager → Project `raseliniste` → **Restart**
4. Migrace se pustí automaticky v entrypointu

---

## Když něco nejde

1. **Logy:** Container Manager → `raseliniste_app` → Log. Hledej `ERROR` / Prisma / `Gemini`.
2. **DB shell:** Container Manager → `raseliniste_db` → Terminal → `psql -U raseliniste raseliniste`
3. **Health check z venku:**
   - `curl https://www.raseliniste.cz/login` — má vrátit HTML
   - `curl https://www.raseliniste.cz/api/auth/me` — má vrátit 401
4. **Reverse proxy problém** — pokud doména ukazuje Web Station welcome, zkontroluj smazaný „Výchozí server" a že Reverse Proxy míří na `localhost:3333` (ne 3000).

---

*Poslední aktualizace: před prvním deployem 2026-04-20.*
