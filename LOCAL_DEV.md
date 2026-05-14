# Lokális fejlesztői környezet

Ez az útmutató bemutatja, hogyan futtasd a Compliance Checker alkalmazást a saját gépeden Manus érintése nélkül. **Csak fejlesztésre / tesztelésre** — production-deploy továbbra is a Manus WebDev platformján történik.

## Mit fogsz kapni

- MySQL DB lokálisan (Docker containerben, izolált a rendszertől)
- Express + Vite dev szerver futtatva `localhost:3000`-en
- Egy admin szerepkörű dev-user, akinek a nevében minden protected endpoint elérhető
- Hot-reload — fájlmódosításra a kód újratöltődik
- 74/74 vitest még mindig zöld lokálisan is

## Mit NEM kapsz lokálisan

- Manus OAuth — egy env-gated dev-bypass helyettesíti (`LOCAL_DEV_USER_ID` env)
- Manus LLM API — a Szabványkereső, compliance-elemzés és embeddings nem fog működni (de a UI körbenézhető)
- S3 file storage — a dokumentum-feltöltés várhatóan hibára fut

A core UI-funkciók (Projektek, Tudástár-lista, /audit, /admin, /settings, dark mode, soft-delete, bulk-műveletek, projekt-export/import) viszont **mind működnek**.

---

## 1. Előfeltételek

- **Node.js 22+** és **pnpm** — már kéne hogy legyen, ha a CI eddig is futott.
- **Docker Desktop** Windows-ra (legegyszerűbb MySQL setup-hoz). Alternatív: natív MySQL Server install — akkor a Docker lépést kihagyod, és a `.env`-ben a saját connection-string-edet adod meg.

## 2. MySQL elindítása Docker-rel

A repo gyökerében:

```bash
docker compose up -d
```

Ez egy MySQL 8.4 containert indít a 127.0.0.1:3306 porton, az alábbi credential-ekkel:
- DB: `compliance_checker`
- User: `compliance` / `compliance_dev_pw`
- Root: `root` / `root_dev_pw`

Ellenőrzés: `docker compose ps` — a státusznak `(healthy)`-nek kell lennie 10-15 másodperc után.

**Megállítás (adatok megmaradnak):** `docker compose down`
**Tisztítás (mindent töröl):** `docker compose down -v`

## 3. `.env` fájl

Másold át a sablont:

```bash
cp .env.example .env
```

A default értékek illeszkednek a Docker-compose-hoz. **De a `LOCAL_DEV_USER_ID` mezőt egyelőre hagyd üresen** — az 5. lépésben fogjuk kitölteni.

## 4. Séma-migráció

```bash
pnpm install         # ha még nincs node_modules
pnpm db:push
```

Ez létrehozza az összes táblát (users, projects, projectMembers, audit_logs, analyses, regulation_sources, platform_credentials, search_queries, search_settings, knowledge_base_documents, chunk_embeddings, notifications). Interaktív kérdéseknél nyomj Entert.

## 5. Dev user létrehozása

```bash
node seed-dev-user.mjs
```

Ez kiír valami olyat:
```
[seed-dev-user] Új user létrehozva. ID: 1

A .env-be állítsd be:
  LOCAL_DEV_USER_ID=1
```

Másold be a `LOCAL_DEV_USER_ID=1` sort a `.env` fájlba.

## 6. App indítása

```bash
pnpm dev
```

Ez egy Express + Vite szervert indít a `http://localhost:3000` címen. Hot-reload aktív — a fájlokat mentve azonnal frissül a böngészőben.

A console-ban várhatóan ezt látod:
- "vite ready in XX ms"
- "Server listening on port 3000"

## 7. Tesztek lokálisan

```bash
pnpm test           # vitest run, egyszer lefut
pnpm test -- --watch # watch módban
pnpm run check      # tsc --noEmit
```

A `74/74 teszt zöld`-nek kell maradnia.

---

## Mit nézz meg a böngészőben

| URL | Mit |
|---|---|
| `http://localhost:3000/` | Landing page |
| `/dashboard` | Operatív dashboard |
| `/projects` | Projekt-lista, "Új projekt" gomb |
| `/projects/:id` | Részletes oldal 5 tabbal |
| `/knowledge-base` | Tudástár (üres lesz lokálisan) |
| `/regulations` | Jogszabálykönyvtár (üres lesz, kivéve ha seedeled — lásd `seed-regulations.mjs`) |
| `/audit` | Audit napló (lokálisan keletkező eseményekkel) |
| `/admin` | Admin dashboard — csak akkor látszik a nav-ban, ha admin role |
| `/settings` | Beállítások (theme toggle is itt) |

Header jobb oldalán: aktív-projekt selector, Bell ikon (értesítésekkel), Sun/Moon toggle, fogaskerék.

## Tipikus dev-flow

```bash
# Reggel:
docker compose up -d
pnpm dev

# Egész nap: kódolsz, böngészőből tesztelsz, fájlt mentesz, hot-reload újratölt.

# Tesztet futtatsz mielőtt commit-olnál:
pnpm test && pnpm run check

# Este:
# Ctrl+C a dev szerveren
docker compose stop    # nem törli az adatokat
```

## Production deploy különbsége

A `LOCAL_DEV_USER_ID` env változó **csak `NODE_ENV !== "production"` mellett** hat (server/_core/context.ts → `maybeLoadDevUser` → első ellenőrzés). Production build-ben a sor nullára ágazik, így a Manus OAuth flow lép helyébe akkor is, ha valaki accidentally beállítja az env-et.

Plusz prod-on a `.env` fájl alapból nincs jelen — Manus saját env-injection mechanizmusát használja.

## Hibakeresés

**"DATABASE_URL nincs beállítva"** → a `.env` fájlt nem találta. Ellenőrizd, hogy a repo gyökerében van, és `.env`-nek hívják (nem `.env.example`-nak).

**"Connection refused (ECONNREFUSED)" :3306** → a Docker container nem fut. `docker compose up -d`, várj 10 mp-et, próbáld újra.

**"Table 'compliance_checker.users' doesn't exist"** → a séma-migráció nem futott. `pnpm db:push`, majd `node seed-dev-user.mjs`.

**A protected endpointok 401/UNAUTHORIZED-ot adnak** → a `LOCAL_DEV_USER_ID` env nincs beállítva, vagy nem a `seed-dev-user.mjs`-szel létrehozott ID-re mutat. Restartolj `pnpm dev`-et az env-frissítés után.

**A Szabványkereső "LLM hiba"-t ad** → ez várt lokálisan, mert a `BUILT_IN_FORGE_API_KEY` nincs beállítva. A UI körbenézhető, csak az LLM-igénylő flow-k nem mennek.
