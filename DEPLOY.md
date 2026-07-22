# Production deploy — Vercel + TiDB Cloud + Cloudflare R2 + Resend + OpenAI

> **Verzió:** V11.13 (Manus-leválasztás után). Ez a guide vezet végig egy nulláról-kezdéses prod-deploy-on, ami **havi ~$0-15-be kerül** kezdetben (mindenki free tieren elindul).

---

## ⚡ GYORS DEMO-DEPLOY (V11.18) — bemutatóhoz

Ez a rövid út a megrendelői bemutatóhoz. **A TiDB-oldal már kész:** a séma fent
van, és be van töltve a 20 szabvány + 5693 chunk-embedding, a DB-oldali
vektor-kereséshez használt `embedding_vec` oszloppal együtt.

### Amit a Vercelen be kell állítani (Environment Variables)

| Változó | Érték / megjegyzés |
|---|---|
| `DATABASE_URL` | **a TiDB connection string** (a `?ssl=` rész nem kell — a kód automatikusan TLS-t használ távoli hosztnál). A végén a **saját adatbázis** neve legyen, ne `/sys`! |
| `OPENAI_API_KEY` | az OpenAI kulcs (válasz-generálás + embeddingek) |
| `BETTER_AUTH_SECRET` | hosszú véletlen string (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | a deploy URL-je, pl. `https://<projekt>.vercel.app` |
| `DEMO_PASSWORD` | **a bemutató jelszava** — ettől jelenik meg a „Demo belépés" a login oldalon |
| `NODE_ENV` | `production` |

Opcionális: `LLM_MODEL` (alap: `gpt-4o-mini`), `EMBEDDING_MODEL`
(alap: `text-embedding-3-small`), `DEMO_USER_EMAIL`, valamint az R2/Resend
változók (a demóhoz nem szükségesek).

### ⚠️ Vercel csomag: Hobby vs Pro

A keresés egy kérdésre **5–12 másodperc** (ebből a DB-keresés csak ~0,5 mp, a
többi az AI-hívás + önellenőrzés). Ezért:

- **Pro** (60 mp függvény-időkorlát): minden kérdés belefér. ✅
- **Hobby** (10 mp): a lassabb kérdések **timeoutolnak**, és a
  `vercel.json`-ban lévő `maxDuration: 60` is hibát adhat deploykor —
  ilyenkor vedd 10-re, de számíts megszakadó keresésekre.

### Deploy

```bash
npx vercel login          # egyszer
npx vercel link           # projekt összekötése
npx vercel --prod         # deploy
```

Vagy egyszerűbben: a Vercel felületén **Import Git Repository** →
`attilagyorfi/compliance-checker` → a fenti env-változók megadása → Deploy.
Ezután minden `git push` automatikusan új deployt indít.

### Ellenőrzés a deploy után

1. `https://<projekt>.vercel.app/login` → **Demo belépés** a `DEMO_PASSWORD`-del
2. Szabványkereső → az egyik beégetett gyorskérdés → jöjjön válasz hivatkozásokkal
3. Jogszabályok oldal → látszik a 20 szabvány, mindegyiknél a chunk-szám

---

## Mit fogunk felépíteni

```
   ┌─────────────────────────────────────────────────┐
   │  https://yourapp.vercel.app  (vagy custom domain) │
   └────────────────────┬────────────────────────────┘
                        │
         ┌──────────────┴────────────────┐
         ▼                               ▼
   Vercel CDN                    Vercel serverless
   (statikus React)             (Express app /api/*)
                                       │
              ┌────────────┬───────────┼──────────┬──────────┐
              ▼            ▼           ▼          ▼          ▼
         TiDB Cloud   Cloudflare    OpenAI    Resend    Better-auth
         (MySQL)         R2          (LLM)    (email)    sessions
                       (storage)             (magic-link)
```

## Költségek (induló pilot — 1 cég, ~20 user)

| Szolgáltatás | Free tier | Várható havi költség |
|---|---|---|
| **Vercel** | Hobby plan: ingyenes | 0 USD (Pro: $20/hó ha SSE-stream gond, vagy ha >10s function) |
| **TiDB Cloud Serverless** | 5GB storage, 250M RUs/hó | 0 USD pilot-on bőven elég |
| **Cloudflare R2** | 10GB storage, no egress fee | 0 USD pilot-on, 0.015 USD/GB efelett |
| **OpenAI** | nincs free, pay-as-you-go | $5-20/hó tipikus pilot (gpt-4o-mini + text-embedding-3-small) |
| **Resend** | 100 e-mail/nap, 3000/hó | 0 USD pilot-on |
| **Custom domain** (opcionális) | Magyar .hu domain ~3000 Ft/év | ~250 Ft/hó |

**Összesen havi ~$5-25** a pilot-fázisban.

---

## 1. TiDB Cloud Serverless (DB)

1. Regisztrálj: https://tidbcloud.com → "Sign up" (Google/GitHub login)
2. Bal felső sarokban: "Create Cluster" → "Serverless" → **válaszd ki a régiót** (EU: Frankfurt javasolt)
3. Cluster név: `compliance-checker-prod`
4. "Create" — pár perc múlva elkészül
5. A cluster oldalán: **"Connect"** gomb
6. Connection method: **"Public Endpoint"**, Connect with: **"General"**
7. Másold ki a `DATABASE_URL`-t (formátum: `mysql://USER.root:PASSWORD@HOST:4000/test?ssl={"rejectUnauthorized":true}`)
8. **Fontos**: A connection string-ben cseréld a végén a `test` adatbázis-nevet `compliance_checker`-re. A TiDB ezt automatikusan létrehozza az első migration-nél.

A migration-t (`pnpm db:push`) ráérünk az 5. lépésben futtatni.

---

## 2. Cloudflare R2 (object storage)

1. Regisztrálj / lépj be: https://dash.cloudflare.com
2. Bal sávban: **R2 Object Storage** → "Create bucket"
3. Bucket név: `compliance-checker-prod`
4. Régió: **EU** (Eastern Europe / Western Europe közül)
5. **Account ID** kimásolása: jobb felső sarokban (Cloudflare dashboard fő oldalán is látszik)
6. Bal sávban: **R2** → "Manage R2 API tokens" → "Create API token"
   - Name: `compliance-checker-prod`
   - Permissions: **Object Read & Write**
   - TTL: Forever (vagy 1 év, lejárat előtt rotálva)
7. Mentsd el: `Access Key ID` + `Secret Access Key` (csak most látod a secret-et!)

Env-változók később (a Vercel project setup-nél):
```
R2_ACCOUNT_ID=<a 6-os lépés Account ID-je>
R2_ACCESS_KEY_ID=<7-es lépés Access Key ID>
R2_SECRET_ACCESS_KEY=<7-es lépés Secret Access Key>
R2_BUCKET=compliance-checker-prod
```

---

## 3. OpenAI (LLM + embeddings)

1. https://platform.openai.com → bejelentkezés
2. Bal sávban: **API keys** → "Create new secret key"
3. Name: `compliance-checker-prod`
4. Permission: **All** (vagy szigorúbban: `Models: read`, `Chat completions: write`, `Embeddings: write`)
5. Mentsd el: `sk-proj-...` formátumú kulcs
6. **Billing**: ha még nincs feltöltve, **Settings → Billing → Add credit balance** (kezdésnek $5-10 elég)
7. Usage limits beállítása ajánlott: **Settings → Limits → Monthly budget** $20-30 a nyugalom kedvéért

Env-változók:
```
OPENAI_API_KEY=sk-proj-...
LLM_MODEL=gpt-4o-mini       # vagy gpt-4o ha komolyabb minőség kell, ~17x drágább
EMBEDDING_MODEL=text-embedding-3-small
```

---

## 4. Resend (magic-link e-mail)

1. https://resend.com → "Sign up"
2. Dashboard → **API Keys** → "Create API Key"
3. Name: `compliance-checker-prod`
4. Permission: **Sending access only**
5. Mentsd el: `re_...` kulcs

A "From" cím (most tesztre):
```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
```

Saját domainen később:
1. Resend dashboard → **Domains** → "Add Domain"
2. Add hozzá pl. `tervmegfeleloseg.hu`
3. A megadott SPF/DKIM/DMARC rekordokat add hozzá a domain DNS-éhez
4. Verify után állítsd: `RESEND_FROM_EMAIL=Compliance Checker <noreply@tervmegfeleloseg.hu>`

---

## 5. Vercel (app hosting)

1. https://vercel.com → "Sign up" / login (GitHub-bal a legegyszerűbb)
2. **New Project** → importáld a `attilagyorfi/compliance-checker` repót
3. Framework Preset: **Other** (a `vercel.json` van a repóban már).
4. Build settings: `vercel.json` adja meg, a Vercel ezt automatikusan átveszi.
5. **Environment Variables** — másold be ezeket (Settings → Environment Variables, mindegyiket "Production" + "Preview" + "Development" envre):

```
# Kötelező
DATABASE_URL=mysql://...        # 1. lépésből (TiDB)
JWT_SECRET=<minimum 32 random karakter>
BETTER_AUTH_SECRET=<másik 32 random karakter>
BETTER_AUTH_URL=https://yourapp.vercel.app  # 6. lépés után pontosítható
NODE_ENV=production

# Cloudflare R2 (2. lépésből)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=compliance-checker-prod

# OpenAI (3. lépésből)
OPENAI_API_KEY=sk-proj-...
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# Resend (4. lépésből)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=onboarding@resend.dev
```

> Tipp: `openssl rand -base64 32` parancs egy biztonságos JWT_SECRET-et ad. Két különböző secret-et használj a JWT_SECRET és BETTER_AUTH_SECRET-nek.

6. **Deploy** gomb. Az első build ~2-3 perc.
7. A deploy után a Vercel kiír egy URL-t (pl. `compliance-checker-xyz.vercel.app`) — másold a `BETTER_AUTH_URL`-be, és redeploy (vagy Vercel CLI-vel `vercel --prod`).

### Schema migráció (TiDB-re)

A TiDB-ben még üres a séma. Lokálisan futtasd:

```powershell
# A .env-ben átmenetileg pointoltatd a DATABASE_URL-t a TiDB connection string-re
# (vagy használj egy temporary .env.prod-migration fájlt)
$env:DATABASE_URL = "mysql://USER:PASS@HOST:4000/compliance_checker?ssl={...}"
pnpm db:push
```

Ez létrehozza mind a 15 táblát + az aktuális séma-állapotot.

Utána az első admin user létrehozása (TiDB-n):

```sql
-- TiDB Cloud SQL editor-ben (vagy bármi MySQL klienssel a connection string-en)
INSERT INTO users (email, name, role, emailVerified) VALUES
  ('te@pelda.hu', 'Saját Neved', 'admin', true);
```

Ezután a `/login` oldalon a `te@pelda.hu` e-mailre kérsz magic-link-et, Resend kiküldi, kattintasz, belépsz adminként.

---

## 6. Custom domain (opcionális)

1. Domain regisztráció: domain.hu / dotroll.hu / namecheap.com (pl. `tervmegfeleloseg.hu`)
2. Vercel project → **Settings → Domains** → "Add" → add meg a domained
3. A Vercel kiír egy DNS-rekordot (A vagy CNAME), amit a domain DNS-felületén kell beállítani
4. Pár perc múlva HTTPS automatikusan kiosztva (Let's Encrypt via Vercel)
5. Frissítsd a Vercel env-eket:
   ```
   BETTER_AUTH_URL=https://tervmegfeleloseg.hu
   ```
6. Resend domain-verify (4. lépés végén leírtak)
7. Redeploy

---

## 7. Smoke-test prod-on

Belépés után:

1. **`/projects`** → "Új projekt" → "Tesztprojekt" — sikeres?
2. **`/knowledge-base`** → drag-drop egy kis PDF-et — sikeres feltöltés? (R2 tesztelés)
3. **`/regulations`** → "Új jogszabály" → URL-alapú forrás. "Letöltés" gomb működik?
4. **`/search`** → "Mik a tűzállósági követelmények?" — válasz jön? (OpenAI tesztelés)
5. **`/admin`** → 1 user látszódik (te), stats grid mutatja az 1 projektet, 0/1/0 stb. számokat.
6. **Bell-ikon** → 0 értesítés (vagy 1, ha egy projekt-tagot adtál hozzá magadnak).
7. **`/settings`** → "Megjelenés" → Sötét téma kapcsoló működik?

Ha bármi furcsa: **Vercel dashboard → Deployments → legutóbbi → Logs** mutatja a function-okból érkező console output-ot.

---

## CI/CD (auto-deploy git push-ra)

A Vercel-nél automatikus: ha a `main` ágra push-olsz GitHub-ra, ~2 perc múlva új deploy fut. Preview branch-ekre is külön deploy-okat ad.

A jelenlegi setup-hoz `.github/workflows/` nem szükséges — Vercel-integráció átveszi.

---

## Hibakeresés

**"Database connection error" prod-on**: a `DATABASE_URL` rossz. A TiDB-knél a `ssl={"rejectUnauthorized":true}` paraméter kötelező, hiánya esetén connection refused.

**"better-auth: invalid signature"** logout után: a `BETTER_AUTH_SECRET` env változott a deploy-ok között → összes user kijelentkezett (várt viselkedés, ha frissítetted a secretet).

**Magic-link e-mail nem érkezik**: Resend dashboard → Logs — ott látszik küldés státusz. Lehet hogy spam-folderbe ment.

**Function timeout** (`504` az `/api/trpc/compliance.startAnalysis`-en): a compliance-elemzés >60s. Vercel Pro plan ($20/hó) szükséges, vagy migráció Railway-re ahol nincs ilyen limit.

**SSE-stream szakad** (`/api/trpc/compliance.statusStream` middle-of-stream cut): Vercel Hobby-n 10s timeout. Pro-n 60s. A frontend úgy van implementálva, hogy "reload" a kész állapotot mutatja, így ez nem blokkoló — csak a real-time progress vész el.

---

## Migráció Vercel-ről máshová (későbbi)

Amikor a Vercel-friction túlnő (SSE-cut, function-timeout, cold-start), a kód már platform-független. Áttelepítés Railway/Render/Fly.io-ra:

1. Új projekt az új platformon, ugyanazok az env-változók
2. A `pnpm start` parancs futtatja az Express-t (`dist/index.js` a `pnpm build` után)
3. Az új URL-re átkötés a Vercel-ről (DNS-szintű)

A DB (TiDB) és R2 ugyanazok maradnak, csak a hosting cserélődik.
