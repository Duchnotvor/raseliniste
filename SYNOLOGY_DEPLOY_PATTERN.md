# Synology NAS deploy pattern (pro Claude / AI agenty)

> Drop tento soubor do kontextu projektu (např. uložit jako `DEPLOY.md`
> nebo přidat do `CLAUDE.md` / `AGENTS.md`). Claude má podle něj postavit
> deploy pipeline pro Next.js / Node.js / podobnou kontejnerizovanou
> aplikaci na **Synology DSM 7.2+** s **Container Managerem**.

## Cíl

Produkční deploy aplikace na domácí NAS **bez SSH**:

1. Vývojář pushne kód do GitHub repo.
2. **GitHub Actions** postaví Docker image a pushne do **GitHub Container Registry** (ghcr.io).
3. NAS přes Container Manager stáhne image a restartuje kontejner.
4. Databáze běží vedle v druhém kontejneru (Postgres/MariaDB/MySQL), data v named volume.
5. DSM Reverse Proxy + Let's Encrypt řeší HTTPS a doménu.

## Co Claude potřebuje vytvořit

### 1. `Dockerfile` (multi-stage)

Vzor pro Next.js/Node app (uprav `npm ci`, `build`, runtime extras podle projektu):

```dockerfile
FROM node:22-alpine AS base
# Alpine 3.19+ má openssl 3; některé knihovny (Prisma) nutno doplnit
RUN apk add --no-cache libc6-compat openssl

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# su-exec = kontejner start jako root, entrypoint dělá chown, pak drop
# privileges na non-root usera. Vyžadováno pro Synology named volumes.
RUN apk add --no-cache su-exec

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# ... COPY potřebné soubory (standalone, prisma, atd.)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Pokud používáš Prisma:
# COPY --from=builder /app/prisma ./prisma
# COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
# COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh
RUN chown -R nextjs:nodejs /app

# NEBĚŽÍ pod nextjs hned — entrypoint to udělá sám po chownu volumes
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["./docker-entrypoint.sh"]
```

### 2. `docker-entrypoint.sh` (chown + migrate + start)

```sh
#!/bin/sh
set -e

# Phase 1 (root): fix Docker named volume ownership, then drop privileges.
# Synology DSM creates new volumes as root:root; app uid 1001 can't write
# unless we chown. For bindmounts DSM sets admin:users — chown too.
if [ "$(id -u)" = "0" ]; then
  for DIR in "$CACHE_PATH" "$UPLOADS_PATH" "/data/..."; do
    [ -n "$DIR" ] || continue
    mkdir -p "$DIR" 2>/dev/null || true
    chown -R 1001:1001 "$DIR" 2>/dev/null || true
    chmod -R u+rwX,g+rwX "$DIR" 2>/dev/null || true
  done
  exec su-exec nextjs:nodejs "$0" "$@"
fi

# Phase 2 (nextjs): migrations, admin bootstrap, start server.
echo "[entrypoint] Running migrations..."
# Prisma:
# node node_modules/prisma/build/index.js migrate deploy
# Nebo custom:
# node ./scripts/migrate.mjs

echo "[entrypoint] Starting server..."
exec node server.js
```

### 3. `docker-compose.yml` (na NAS — pullí z ghcr)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: myapp_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: myapp
      POSTGRES_PASSWORD: ${DB_PASSWORD:?required}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data_v2:/var/lib/postgresql/data   # v2 = dá se přejmenovat pro reset
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U myapp"]
      interval: 10s

  app:
    # Nahraď GITHUB-USERNAME/REPO malými písmeny
    image: ghcr.io/GITHUB-USERNAME/REPO/app:latest
    container_name: myapp_app
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://myapp:${DB_PASSWORD}@postgres:5432/myapp
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:?required}
      APP_URL: ${APP_URL:-http://localhost:3080}
      CACHE_PATH: /data/cache
      UPLOADS_PATH: /data/uploads
      NODE_ENV: production
    volumes:
      - ./uploads:/data/uploads          # bindmount — File Station upload
      - app_cache:/data/cache            # named volume — vytvoří DSM
    ports:
      - "3080:3000"                      # NEPOUŽÍVEJ 3000 — koliduje s DSM
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data_v2:
  app_cache:
```

### 4. `.env.production` (template)

```
DB_PASSWORD=                          # openssl rand -base64 24 | tr -d '/+='
NEXTAUTH_SECRET=                      # openssl rand -base64 48
APP_URL=https://app.mojedomena.cz
APP_PUBLIC_HOST=app.mojedomena.cz     # pro redirecty ze subdomény
ADMIN_EMAIL=admin@mojedomena.cz
ADMIN_PASSWORD=                       # openssl rand -base64 18 | tr -d '/+=' | cut -c1-20
```

Uživatel ho zkopíruje na NAS jako `.env` (vedle docker-compose.yml).

### 5. `.github/workflows/docker-build.yml`

```yaml
name: Build and push Docker image

on:
  push:
    branches: [main]
  workflow_dispatch: {}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Lowercase repo name
        id: repo
        run: echo "name=$(echo '${{ github.repository }}' | tr '[:upper:]' '[:lower:]')" >> "$GITHUB_OUTPUT"
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          platforms: linux/amd64   # Synology x86 modely (DS720+ a vyšší)
          tags: |
            ghcr.io/${{ steps.repo.outputs.name }}/app:latest
            ghcr.io/${{ steps.repo.outputs.name }}/app:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## DSM-side setup (uživatel udělá ručně, jen 1× na začátku)

1. **DNS** — u správce domény: `A app.mojedomena.cz → public IP NASu`
   (nebo DDNS + CNAME pokud dynamická IP)
2. **Router** — port forward 80 + 443 na NAS
3. **DSM → Control Panel → Security → Certificate** — Let's Encrypt cert pro doménu
4. **DSM → Login Portal → Advanced → Reverse Proxy** — `https://app.mojedomena.cz:443` → `http://localhost:3080`
5. **DSM → Web Station → Služba webu** — pokud je tam "Výchozí server" na 80/443, **smaž ho nebo změň port** (jinak zabírá 443 před Reverse Proxy)
6. **DSM → Container Manager → Registr** — pro private ghcr image přidat PAT; **pro public image není třeba**

## Deploy flow

1. Uživatel udělá **GitHub repo** (private ale image public package — jednodušší než PAT)
2. Push → Actions build (3–6 min)
3. Image je v `ghcr.io/user/repo/app:latest`
4. Na NAS: Container Manager → Project → **Build** (pullí image) → **Start**
5. Příští update: Image → Pull latest → Project → Restart

## 🚩 Hlavní chyby, na které pozor

### 1. Named volume permissions (EACCES při zápisu)
**Symptom:** Kontejner hlásí `EACCES: permission denied, mkdir '/data/cache/…'`
**Příčina:** Docker vytvoří named volume jako `root:root`, aplikace běží jako uid 1001.
**Fix:** Entrypoint jako **root** udělá `chown -R 1001:1001 /data/cache`, pak `exec su-exec nextjs:nodejs …`. Dockerfile **nesmí** mít `USER nextjs` před ENTRYPOINT.

### 2. Synology DSM kolize s portem 443
**Symptom:** Doména ukazuje "Web Station welcome" místo aplikace.
**Příčina:** Web Station "Výchozí server" zabírá 443 dřív než Reverse Proxy.
**Fix:** Smazat "Výchozí server" ve Web Station (DSM → Web Station → Služba webu), nebo změnit jeho port na 8082/8443.

### 3. Prisma + Alpine OpenSSL
**Symptom:** `prisma:warn failed to detect libssl/openssl` + při connect `Could not parse schema engine response: SyntaxError: Unexpected token 'E', "Error load"`
**Fix:** v `schema.prisma`:
```
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```
Plus `apk add openssl` v Dockerfile base.

### 4. Failed migration zamrzne deploy
**Symptom:** `P3009 migrate found failed migrations, new migrations will not be applied`
**Příčina:** Předchozí migrace selhala a zůstala v `_prisma_migrations`.
**Fix:** Self-healing script v entrypointu před `migrate deploy`:

```js
// scripts/heal-migrations.mjs
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const exists = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations') AS ok`
  );
  if (!exists[0]?.ok) process.exit(0);
  await prisma.$executeRawUnsafe(
    `DELETE FROM "_prisma_migrations" WHERE finished_at IS NULL`
  );
} catch (err) {
  console.log('[heal] skip:', err?.message);
} finally {
  await prisma.$disconnect();
}
```

### 5. DSM Reverse Proxy timeout 60 s
**Symptom:** Dlouhé operace (hromadné processing, thumbnails, backup) vracejí HTML error stránku.
**Příčina:** DSM Reverse Proxy zabije connection po 60 s (default).
**Fix:** Buď upravit timeout v Reverse Proxy (Advanced tab), NEBO v endpointu time-boxovat práci na ~50 s, vracet progress (`{done: false, remaining: N}`) a nechat klienta volat v loopu:
```ts
const start = Date.now();
const BUDGET_MS = 50_000;
for (const item of items) {
  if (Date.now() - start > BUDGET_MS) {
    return { done: false, processed, remaining: items.length - i };
  }
  // work
}
return { done: true, processed };
```

### 6. Node.js 'use client' + import order
**Symptom:** Komponenta rozbitá po `sed` úpravě importů.
**Příčina:** `'use client';` musí být **úplně první** řádek; importy musí být **nahoře**, ne uprostřed souboru.
**Fix:** Při hromadných úpravách imports zkontroluj `head -5` každého souboru. Pokud používáš bash, insert **za poslední `^import ` řádek**, ne za první.

### 7. File Station smaže symlinky
**Symptom:** Relativní symlinky nefungují po zkopírování přes File Station.
**Fix:** Použít absolutní cesty nebo bindmounty v compose.

### 8. Volume se neodebere při Project Clear
**Symptom:** Po "Clear" projektu zůstane stará data v DB.
**Fix:** Přejmenuj volume v compose (`postgres_data` → `postgres_data_v2`). Nový volume vznikne prázdný, starý zůstane orphaned. Nebo: Container Manager → levé menu → Volume → manuálně smaž (pokud DSM verze má tu záložku — některé novější ji skryly).

### 9. Environment cookies vs CSP
**Symptom:** "CSRF token missing" v UI.
**Příčina:** Cookie sameSite=strict nepovolí subdoménový cross-cookie sharing.
**Fix:** Pokud používáš subdomény (admin vs public), ponech `sameSite:'strict'` ale ujisti se že requesty jdou na stejný origin jako stránka. Never mixuj http/https v URL.

## Lessons learned (co předejít bolestem)

1. **Nikdy nesahej na `postgres_data` volume** bez zálohy — Project Clear neumí recovery.
2. **Image má být `public`** — zbavíš se PAT tokenů a registry auth na DSM. Source repo může zůstat private.
3. **Debug přes DSM Terminal** (Container → Details → Terminal), **ne SSH** — sdílenější.
4. **Windows/macOS řádkování v `.env`** → Linux shell read se zadrhne na `\r`. Ulož UTF-8 LF.
5. **DSM Reverse Proxy NECACHUJE** — pokud chceš CDN, postav nginx sidecar.
6. **Synology Task Scheduler** má vlastní environment (není bash login). Používej absolutní cesty v skriptech.

## Pro začátek nového projektu — checklist pro Claude

- [ ] Zkopíruj tento `SYNOLOGY_DEPLOY_PATTERN.md` do repa projektu
- [ ] Vytvoř `Dockerfile`, `docker-entrypoint.sh`, `.dockerignore`
- [ ] Vytvoř `docker-compose.yml` pro NAS (používá `image:`, ne `build:`)
- [ ] Vytvoř `.env.production` šablonu s `CHANGE_ME` placeholders + generátor heslel nástroji
- [ ] Vytvoř `.github/workflows/docker-build.yml`
- [ ] Dokumentace v `README-DEPLOY.md` pro uživatele: DNS + port forward + Reverse Proxy + první build
- [ ] Entrypoint: **jako root chown volumes → su-exec nextjs → migrace → start**
- [ ] Health check endpoint (`/api/health`) pro monitoring
- [ ] Admin endpoint pro: zálohu DB, reset admin hesla, healthcheck statistiky
- [ ] **Neřeš** CSRF/CSP/nonce na začátku — přidej až když funguje základ
- [ ] Při prvním tvoření DB migrace: **vytvoř `migration_lock.toml`** ručně v `prisma/migrations/` (`provider = "postgresql"`)

## Formát otázek uživateli (pokud něco není jasné)

Místo "jak mám deploynout?" se ptej přímo:
- **Doména:** Jaký apex + jaké subdomény chceš? (admin + public odděleně?)
- **NAS model:** x86 (DS718+, DS720+ ...) = linux/amd64. ARM (DS220j) = platforms: linux/arm64.
- **Veřejná IP:** Dynamická (DDNS) nebo statická?
- **E-shopy / externí služby:** Potřebují pullovat image z app? Jaké URLs?
- **Velikost dat:** Fotky / PDF / videa? → podle toho navrhnout úložiště (bindmount vs volume).
- **Provoz:** Interní (intranet) nebo internet-facing? → určuje sílu security (CSRF, rate limit, MFA).

---

## Jednoduché zhodnocení pro uživatele

Tenhle pattern řeší:
- ✅ **Žádný SSH** — všechno přes DSM UI + File Station + GitHub Desktop
- ✅ **Rychlý deploy** — git push, za 5 min je na NASu
- ✅ **Perzistentní data** — DB a upload survive image upgrade
- ✅ **HTTPS** — Let's Encrypt zdarma, auto-renew
- ✅ **Multi-projekt** — DSM Reverse Proxy umí víc subdomén na 443

Neřeší:
- ❌ High availability (pokud NAS padne, web padá)
- ❌ Horizontal scaling (1 kontejner = 1 instance)
- ❌ Geografická redundance
- ❌ DDoS (jsi za domácí linkou)

Pro intranet / malý e-shop / interní systém je to **ideální**. Pro Black Friday s 10k návštěvníky nebo regulovaná data — ne.
