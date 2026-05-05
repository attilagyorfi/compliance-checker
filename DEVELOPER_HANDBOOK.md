# M Mérnöki – Tervmegfelelőség-ellenőrző: Fejlesztői Kézikönyv

> **Verzió:** V9 (2026. május 5.)  
> **Projekt:** `compliance-checker`  
> **Élő URL:** https://compliance-lkoz8hck.manus.space  
> **Stack:** React 19 + Vite 7 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB  
> **Platform:** Manus WebDev (hosting + auth + DB + S3 storage)

---

## 1. Projekt áttekintés és célok

Az **M Mérnöki Tervmegfelelőség-ellenőrző** egy AI-alapú webalkalmazás, amelyet az M Mérnöki Iroda Kft. számára fejlesztettünk. A rendszer célja, hogy a mérnöki tervdokumentumok (PDF, DOCX, XLSX, DWG, IFC) megfelelőségét automatikusan ellenőrizze a vonatkozó magyar és európai építési jogszabályok, szabványok alapján.

A platform három fő funkcionális pillérre épül. Az első a **Compliance Engine**: tervdokumentumok feltöltése után az AI elvégzi a jogszabályi összevetést, és strukturált, bizonyíték-alapú megfelelőségi riportot generál (finding-szintű indoklással, idézetekkel, súlyossági besorolással). A második a **Szabványkereső**: természetes nyelvű kérdésekre ad szakmai választ a feltöltött jogszabályok, az MSZT Szabványtár, a Tudástár dokumentumai és az internet alapján. A harmadik a **Forráskezelő**: a jogszabályi könyvtár (NJT-ről letöltött tartalmak), a Tudástár (belső feltöltött dokumentumok) és a platform-kapcsolatok (MSZT, Jogtár, EUR-Lex) kezelése.

---

## 2. Technológiai stack

| Réteg | Technológia | Megjegyzés |
|---|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.9 | Wouter router, shadcn/ui + Radix UI |
| Stílus | Tailwind CSS 4 | OKLCH színek, CSS változók |
| Backend | Express 4, tRPC 11, Node.js 22 | tsx watch fejlesztéshez |
| API réteg | tRPC + React Query 5 | Superjson transzformer |
| Adatbázis | MySQL/TiDB (Drizzle ORM 0.44) | Drizzle-kit migrációk |
| Fájltárolás | AWS S3 (Manus beépített) | `storagePut` / `storageGet` helperek |
| Auth | Manus OAuth 2.0 | JWT session cookie |
| AI | Manus beépített LLM API | `invokeLLM()` helper, JSON schema output |
| Tesztek | Vitest | 18/18 teszt zöld |
| Dokumentum-kinyerés | pdf-parse, mammoth, xlsx, tesseract.js | OCR fallback szkennelt PDF-hez |
| Web scraping | cheerio, node fetch | DuckDuckGo HTML scraper |

---

## 3. Könyvtárstruktúra

```
compliance-checker/
├── client/
│   ├── src/
│   │   ├── _core/hooks/useAuth.ts        ← Auth hook (useAuth())
│   │   ├── components/
│   │   │   ├── Header.tsx                ← Navigáció (5 menüpont)
│   │   │   ├── DashboardLayout.tsx       ← Sidebar layout (nem használt aktívan)
│   │   │   └── ui/                       ← shadcn/ui komponensek
│   │   ├── pages/
│   │   │   ├── Home.tsx                  ← Főoldal (landing + CTA)
│   │   │   ├── DashboardPage.tsx         ← Operatív dashboard
│   │   │   ├── AnalysisPage.tsx          ← Dokumentum feltöltés + elemzés indítás
│   │   │   ├── ResultPage.tsx            ← Elemzés eredmény (finding kártyák)
│   │   │   ├── ReportsPage.tsx           ← Korábbi elemzések listája
│   │   │   ├── StandardsSearchPage.tsx   ← Szabványkereső (fő funkció)
│   │   │   ├── SearchHistoryPage.tsx     ← Keresési előzmények
│   │   │   ├── KnowledgeBasePage.tsx     ← Tudástár (belső dok. feltöltés)
│   │   │   ├── RegulationLibraryPage.tsx ← Jogszabályi könyvtár
│   │   │   └── PlatformConnectionsPage.tsx ← Platform kapcsolatok (MSZT stb.)
│   │   ├── App.tsx                       ← Route definíciók
│   │   ├── main.tsx                      ← tRPC + QueryClient provider
│   │   └── index.css                     ← Globális téma (sötét, M Mérnöki arculat)
├── server/
│   ├── _core/                            ← Framework plumbing (NE MÓDOSÍTSD)
│   │   ├── index.ts                      ← Express szerver belépőpont
│   │   ├── context.ts                    ← tRPC context (ctx.user)
│   │   ├── llm.ts                        ← invokeLLM() helper
│   │   ├── oauth.ts                      ← Manus OAuth flow
│   │   └── env.ts                        ← Környezeti változók
│   ├── routers/
│   │   ├── compliance.ts                 ← Fő compliance engine (upload + analyze + SSE)
│   │   ├── standardsSearch.ts            ← Szabványkereső (query rewrite + hybrid search)
│   │   ├── regulationSources.ts          ← Jogszabályi könyvtár CRUD
│   │   ├── platformCredentials.ts        ← Platform credential kezelés
│   │   ├── knowledgeBase.ts              ← Tudástár dokumentum kezelés
│   │   └── pdfExport.ts                  ← PDF riport generálás
│   ├── routers.ts                        ← AppRouter összeállítás
│   ├── db.ts                             ← Drizzle DB helper függvények
│   ├── documentExtractor.ts              ← Multi-format szövegkinyerés
│   ├── regulationScraper.ts              ← NJT/MSZT scraper + login
│   ├── relevanceChunker.ts               ← TF-IDF alapú chunk kiválasztás
│   ├── analysisQueue.ts                  ← In-memory queue + retry (max 3x)
│   ├── auditLog.ts                       ← Audit log helper
│   ├── webSearch.ts                      ← DuckDuckGo web keresés
│   ├── pdfReport.ts                      ← PDFKit riport generátor
│   ├── storage.ts                        ← S3 wrapper
│   └── compliance.test.ts               ← Vitest tesztek
├── drizzle/
│   └── schema.ts                         ← Teljes DB séma (9 tábla)
├── seed-regulations.mjs                  ← Jogszabály seed script (NJT tartalmak)
├── todo.md                               ← Projekt előzmények és backlog
└── DEVELOPER_HANDBOOK.md                 ← Ez a fájl
```

---

## 4. Adatbázis séma

A projekt MySQL/TiDB adatbázist használ Drizzle ORM-mel. Az összes tábla definíciója a `drizzle/schema.ts` fájlban található.

### Táblák összefoglalója

| Tábla | Leírás | Kulcs mezők |
|---|---|---|
| `users` | Bejelentkezett felhasználók | `openId`, `role` (user/admin/reviewer) |
| `projects` | Mérnöki projektek | `name`, `workflowStatus`, `discipline`, `ownerId` |
| `project_members` | Projekt tagok | `projectId`, `userId`, `role` (owner/member/reviewer) |
| `audit_logs` | Audit napló | `eventType`, `resourceType`, `userId`, `metadata` |
| `analyses` | Compliance elemzések | `status`, `workflowStatus`, `progressStep`, `results` (JSON), `planDocuments` (JSON) |
| `regulation_sources` | Jogszabályi könyvtár | `name`, `shortCode`, `discipline`, `sourceType`, `content` (MEDIUMTEXT), `syncStatus` |
| `platform_credentials` | Platform belépők | `platform` (mszt/jogtar/epitesijog/eurlex), `encryptedPassword`, `status` |
| `search_queries` | Keresési előzmények | `question`, `searchMode`, `answer`, `confidence`, `sources` (JSON) |
| `search_settings` | Felhasználói kereső beállítások | `answerLength`, `operationMode`, `searchMode` |
| `knowledge_base_documents` | Tudástár dokumentumok | `name`, `s3Url`, `extractedText`, `fileType` |

### Fontos megjegyzések a sémáról

A `regulation_sources.content` oszlop `MEDIUMTEXT` típusú (max 16 MB), mert a jogszabályok szövege meghaladhatja a TEXT típus 65 KB-os korlátját. Ez a módosítás közvetlenül SQL-lel lett elvégezve (`ALTER TABLE`), a Drizzle schema-ban a `mediumtext()` típus van megadva.

A `search_queries` táblában a `userId` és `projectId` oszlopok snake_case nevűek a DB-ben (`user_id`, `project_id`), de a Drizzle schema camelCase property neveket használ explicit column mapping-gel (`int("user_id")`).

A `ComplianceResult` típus a `analyses.results` JSON mezőben tárolódik, és tartalmaz: `id`, `title`, `status` (megfelel/reszben_megfelel/bizonytalan/nem_felel_meg), `severity` (kritikus/kozepes/alacsony), `confidence` (0–100), `regulationExcerpt`, `planExcerpt`, `nextStep`, `workflowStatus`.

---

## 5. tRPC router térkép

Az `AppRouter` a következő routereket tartalmazza:

```
auth.me                         → Bejelentkezett felhasználó lekérése
auth.logout                     → Kijelentkezés (cookie törlés)
compliance.uploadDocument       → Dokumentum feltöltés S3-ra (base64)
compliance.startAnalysis        → Compliance elemzés indítása
compliance.getAnalysis          → Elemzés státusz/eredmény lekérése
compliance.listAnalyses         → Elemzések listája
compliance.statusStream         → SSE stream (valós idejű státusz)
pdf.exportReport                → PDF riport generálás
regulationSources.list          → Jogszabályok listája
regulationSources.addSource     → Új jogszabály hozzáadása URL alapján
regulationSources.updateSource  → Jogszabály frissítése
regulationSources.deleteSource  → Jogszabály törlése
regulationSources.fetchContent  → Tartalom letöltés NJT/net.jogtar.hu-ról
platformCredentials.list        → Platform kapcsolatok listája
platformCredentials.save        → Credential mentése (AES-256 titkosítással)
platformCredentials.testConnection → Kapcsolat tesztelése
platformCredentials.delete      → Credential törlése
standardsSearch.search          → Szabványkereső (fő endpoint)
standardsSearch.extendAnswer    → Bővebb válasz generálás
standardsSearch.listHistory     → Keresési előzmények
standardsSearch.deleteHistory   → Előzmény törlése
knowledgeBase.list              → Tudástár dokumentumok listája
knowledgeBase.upload            → Dokumentum feltöltés Tudástárba
knowledgeBase.delete            → Dokumentum törlése
knowledgeBase.getTextsForSearch → Szövegek kereséshez (internal search mode)
system.notifyOwner              → Értesítés küldése az alkalmazás tulajdonosának
```

---

## 6. A Compliance Engine működése

A compliance elemzés folyamata a `server/routers/compliance.ts` fájlban van implementálva, és az `analysisQueue.ts` által kezelt in-memory queue-n keresztül fut.

Az elemzés lépései a következők. Először a felhasználó feltölti a tervdokumentumot (PDF/DOCX/stb.) és kiválasztja a vonatkozó jogszabályokat. A `uploadDocument` endpoint base64 kódolással fogadja a fájlt, és S3-ra menti. Ezután a `startAnalysis` endpoint létrehozza az elemzési rekordot `processing` státusszal, és az `analysisQueue`-ba helyezi a feladatot. A queue feldolgozó kinyeri a szöveget a dokumentumból (`extractTextFromDocument`), majd ha a dokumentum szkennelt PDF, OCR-t futtat (`tesseract.js`). A `buildRelevantExcerpt` (TF-IDF alapú) kiválasztja a leginkább releváns részeket a jogszabályból. Az LLM elvégzi az összevetést és JSON schema alapján strukturált findingokat generál. Az eredmény visszakerül az adatbázisba, a státusz `completed`-re vált. Az SSE stream (`statusStream`) valós időben értesíti a frontendet a `progressStep` mezőn keresztül.

A retry logika: ha az elemzés hibával végződik, a queue automatikusan újrapróbálja exponenciális backoff-fal, maximum 3 alkalommal.

---

## 7. A Szabványkereső működése

A `server/routers/standardsSearch.ts` implementálja a természetes nyelvű kereső funkciót. A keresési folyamat négy lépésből áll.

**1. Query rewriting:** Az LLM pontosítja a felhasználó kérdését technikai keresési lekérdezéssé (pl. "milyen tűzállósági követelmények?" → "Tartószerkezetek tűzvédelmi osztályozása és tűzállósági teljesítménykövetelményei az építési jogszabályokban").

**2. Forráskeresés (hybrid search):** A keresési módtól függően különböző forrásokat kérdez le. `internal` módban a `regulation_sources` táblát keresi keyword alapon (OR feltételek az összes kulcsszóra). `mszt` módban az MSZT Szabványtárba lép be és ott keres. `web` módban a DuckDuckGo HTML scraper-t használja. `combined` és `combined_with_web` módban ezeket kombinálja. A Tudástár dokumentumait (`knowledge_base_documents.extractedText`) a `knowledgeBase.getTextsForSearch` endpoint adja vissza, és ezek is bekerülnek a forrásokba.

**3. Strukturált válasz generálás:** Az LLM a forrásrészletek alapján szakmai választ generál, hivatkozásokkal ([1], [2] stb. formátumban). A válasz hossza konfigurálható (rövid/standard/részletes).

**4. Self-check (Pontos módban):** Egy második LLM hívás ellenőrzi, hogy a generált válasz minden állítása visszavezethető-e a forrásokra. Ha nem, a `selfCheckPassed` false lesz, és a UI figyelmeztetést jelenít meg.

A keresési előzmények automatikusan mentődnek a `search_queries` táblába.

---

## 8. Platform kapcsolatok és MSZT integráció

A `server/routers/platformCredentials.ts` kezeli a külső platform belépési adatait. A jelszavak AES-256-CBC titkosítással tárolódnak a DB-ben; a titkosítási kulcs a `JWT_SECRET` env változóból van levezetve.

Az MSZT Szabványtár (`http://szabvanykonyvtar.mszt.hu`) integrációja a `server/regulationScraper.ts` fájlban van. A `loginToMszt` függvény:

1. Lekéri a login oldalt és kinyeri a CSRF tokent.
2. POST kéréssel bejelentkezik (`_username`, `_password`, `_csrf_token` mezőkkel).
3. 15 másodperces timeout-ot alkalmaz (`AbortSignal.timeout(15000)`).
4. A redirect utáni oldal HTML tartalmát elemzi: ha "már bejelentkezett valaki" üzenetet tartalmaz, barátságos hibaüzenetet ad vissza.
5. Sikeres bejelentkezés esetén visszaadja a session cookie-t.

**Fontos korlátozás:** Az MSZT szerver egyszerre csak egy aktív munkamenetet engedélyez felhasználónként. Ha a bejelentkezés "már bejelentkezett valaki" hibát ad, 20 percet kell várni az automatikus kijelentkezésig.

---

## 9. Dokumentum-kinyerés

A `server/documentExtractor.ts` a következő formátumokat támogatja:

| Formátum | Könyvtár | Megjegyzés |
|---|---|---|
| PDF | pdf-parse + tesseract.js | OCR fallback szkennelt PDF-hez |
| DOCX | mammoth | Szöveg + alapvető formázás |
| XLSX | xlsx | CSV konverzió |
| DWG/DXF | ASCII szöveg scraping | Csak metaadatok |
| IFC | STEP header + property parse | Épületmodell metaadatok |
| RTF | Kontrol kód szűrés | Alapvető szöveg |

Az OCR detektálás logikája: ha a kinyert szöveg hossza / fájlméret arány < 0.01 és a szöveg < 500 karakter, a rendszer szkennelt PDF-nek tekinti és OCR-t futtat.

---

## 10. Web keresés modul

A `server/webSearch.ts` DuckDuckGo HTML scraper alapú web keresést valósít meg (nem API kulcs szükséges). A `webSearchStandards` függvény:

1. DuckDuckGo-n keres a kérdésre (HTML scraping, cheerio alapú).
2. A találatokat domain rangsorolás alapján szűri (njt.hu, mszt.hu, jogtar.hu, epitesijog.hu előnyt kap).
3. A top 3-5 URL tartalmát letölti és szövegét kinyeri.
4. Visszaadja a forrásokat `sourceType: "web"` jelöléssel.

A `fetchUrlSources` függvény egyedi URL-ek tartalmát tölti le (a Szabványkereső URL beviteli mezőjéhez).

---

## 11. Jogszabályi könyvtár és seed adatok

A `regulation_sources` táblában jelenleg 16 bejegyzés van:

- **ID 1–12:** Előre definiált jogszabályok (TÉKA, OTSZ, TNM, Méptv., stb.) – tartalom nélkül, csak metaadatokkal. Ezeket a Jogszabályok oldalon lehet URL alapján feltölteni.
- **ID 30001–30004:** Valódi szöveggel feltöltött jogszabályok (seed-regulations.mjs script által):
  - OTSZ (54/2014 BM rendelet) – ~68 KB szöveg
  - OTÉK (253/1997 Korm. rendelet) – ~68 KB szöveg
  - Épkiv (312/2012 Korm. rendelet) – ~68 KB szöveg
  - Étv. (1997 LXXVIII. törvény) – ~68 KB szöveg

A `seed-regulations.mjs` script újrafuttatható, ha a DB-t törlik és újra kell tölteni. A script az NJT-ről letöltött szövegeket a projekt gyökérkönyvtárában lévő `*.txt` fájlokból olvassa.

---

## 12. Fejlesztési munkafolyamat

### Helyi fejlesztés

```bash
cd /home/ubuntu/compliance-checker
pnpm dev          # Express + Vite fejlesztői szerver (port 3000)
pnpm test         # Vitest tesztek futtatása
pnpm db:push      # Drizzle séma generálás + migráció
pnpm tsc --noEmit # TypeScript ellenőrzés
```

### Új feature hozzáadása (Build Loop)

1. **Séma frissítés:** `drizzle/schema.ts` módosítása, majd `pnpm db:push`.
2. **DB helper:** `server/db.ts`-ben új query helper függvény.
3. **tRPC router:** `server/routers/<feature>.ts` létrehozása, regisztrálás `server/routers.ts`-ben.
4. **Frontend:** `client/src/pages/<Feature>Page.tsx` létrehozása, route hozzáadása `App.tsx`-ben.
5. **Tesztek:** `server/compliance.test.ts`-ben vagy új `*.test.ts` fájlban.

### Környezeti változók

A következő változók automatikusan injektálódnak a Manus platformon:

| Változó | Leírás |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie aláírási kulcs (AES titkosításhoz is használt) |
| `BUILT_IN_FORGE_API_KEY` | Manus LLM API kulcs (szerver oldali) |
| `BUILT_IN_FORGE_API_URL` | Manus LLM API URL |
| `VITE_APP_ID` | OAuth alkalmazás ID |
| `OAUTH_SERVER_URL` | OAuth backend URL |

---

## 13. Navigáció és oldalak

Az alkalmazás navigációja a `client/src/components/Header.tsx`-ben van definiálva, 5 menüponttal:

| Menüpont | Route | Leírás |
|---|---|---|
| Dashboard | `/dashboard` | Operatív áttekintés, elemzéslista, statisztikák |
| Szabványkereső | `/search` | Természetes nyelvű kereső (fő funkció) |
| Tudástár | `/knowledge-base` | Belső dokumentumok feltöltése és kezelése |
| Jogszabályok | `/regulations` | Jogszabályi könyvtár (NJT URL alapján) |
| Előzmények | `/history` | Keresési előzmények |

A főoldal (`/`) egy landing page CTA-val, amely a `/search` oldalra irányít. A `/analysis` oldalon lehet új elemzést indítani, a `/result/:id` oldalon az eredményeket megtekinteni, a `/reports` oldalon a korábbi elemzéseket listázni.

A platform kapcsolatok a `/platforms` route-on érhetők el (nem szerepel a navigációban, de a Szabványkereső alján lévő "Platform beállítások" linkre kattintva érhető el).

---

## 14. Tesztek

A tesztek a `server/compliance.test.ts` fájlban vannak, Vitest keretrendszerrel. Jelenleg **18/18 teszt zöld**. A tesztek lefedik:

- Dokumentumtípus kinyerés (PDF, DOCX, XLSX, DWG, IFC)
- Regulation source scraper (NJT, net.jogtar.hu)
- Platform credential kezelés (AES titkosítás/visszafejtés)
- Kereső backend (query rewriting, keyword search, structured answer)
- Strukturált válasz és self-check logika
- Compliance engine (finding generálás, severity, confidence)

```bash
pnpm test                    # Összes teszt
pnpm test -- --reporter=verbose  # Részletes kimenet
```

---

## 15. Ismert korlátok és nyitott fejlesztési területek

Az alábbi funkciók szándékosan halasztva lettek, és a jövőbeli fejlesztés célpontjai:

**Projektalapú működés:** A `projects` és `project_members` táblák léteznek, de az `analyses`, `knowledge_base_documents` és `search_queries` táblák `projectId` FK mezői nincsenek aktívan használva. Hiányoznak a `ProjectsPage` és `ProjectDetailPage` oldalak.

**Workflow státusz változtatás:** A finding-szintű workflow státuszok (nyitott/ellenőrzés_alatt/elfogadva stb.) megjelennek a UI-ban, de nincsenek backend endpointok a státusz módosítására. Hiányzik a felelős személy hozzárendelése és a review gomb.

**Szemantikus keresés:** Jelenleg TF-IDF alapú keyword keresés van. Embedding + cosine similarity alapú valódi szemantikus keresés még nem implementált.

**Elavultsági figyelmeztetés:** A `regulation_sources` táblában van `lastSyncAt` és `syncStatus` mező, de az elavult forrásokra vonatkozó UI figyelmeztetés még hiányzik.

**MSZT session cache:** Az MSZT bejelentkezés minden keresésnél újra lefut. Egy szerver oldali session cache (Map alapú, 15 perces TTL) bevezetésével a párhuzamos bejelentkezési probléma elkerülhető lenne.

**Embedding alapú keresés:** A jelenlegi keyword keresés nem találja meg a szemantikailag hasonló, de eltérő szavakkal leírt tartalmakat. OpenAI/Manus embedding API + cosine similarity bevezetése jelentősen javítaná a keresési pontosságot.

**Több jogszabály tartalommal:** Jelenleg csak 4 jogszabálynak van tényleges szövege (ID 30001–30004). A többi 12 bejegyzés (ID 1–12) tartalom nélküli. Ezeket a Jogszabályok oldalon lehet URL alapján feltölteni, vagy a `seed-regulations.mjs` script bővítésével.

---

## 16. Biztonsági megfontolások

A platform credential jelszavak AES-256-CBC titkosítással tárolódnak. A titkosítási kulcs a `JWT_SECRET` első 32 karakteréből van levezetve (`crypto.scryptSync`). A titkosítás és visszafejtés a `server/routers/platformCredentials.ts`-ben van implementálva.

Az audit log (`server/auditLog.ts`) minden kritikus eseményt naplóz: dokumentum feltöltés, elemzés indítás, elemzés befejezés, hiba. A naplók az `audit_logs` táblában tárolódnak.

A fájlok S3-on tárolódnak, nem a szerveren. A presigned URL-ek (`storageGet`) időkorlátosak. A `regulation_sources.content` oszlopban tárolt jogszabályszövegek publikusan elérhető forrásokból származnak (NJT).

---

## 17. Deployment

Az alkalmazás a Manus WebDev platformon fut. A deployment folyamata:

1. `pnpm test` – tesztek zöldek
2. `webdev_save_checkpoint` – checkpoint mentése
3. Publish gomb a Manus Management UI-ban

Az élő URL: **https://compliance-lkoz8hck.manus.space**

A szerver build: `vite build && esbuild server/_core/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`

---

## 18. Ajánlott következő fejlesztési lépések

Az alábbi fejlesztések a legmagasabb üzleti értéket képviselik, és a meglévő architektúrára természetesen ráépíthetők.

**A. Projektalapú szervezés (V10):** A `ProjectsPage` és `ProjectDetailPage` oldalak megvalósítása, ahol az elemzések, Tudástár dokumentumok és keresési előzmények projekthez rendelhetők. A `project_members` tábla alapján jogosultság-kezelés (ki láthat mit).

**B. Finding review workflow (V11):** Backend endpointok a finding-szintű workflow státusz módosítására (`updateFindingStatus`), felelős személy hozzárendelése, megjegyzések. A `ResultPage`-en review gomb és megjegyzés mező.

**C. Szemantikus keresés (V12):** Embedding generálás a jogszabályszövegekhez (Manus beépített embedding API vagy OpenAI), cosine similarity alapú keresés. Ez a `relevanceChunker.ts` bővítésével valósítható meg.

**D. Automatikus jogszabály-frissítés (V13):** Scheduled task (Manus ütemező) a `regulation_sources` tartalmának automatikus frissítésére az NJT-ről. Elavultsági figyelmeztetés a UI-ban, ha egy forrás > 30 napja nem lett frissítve.

**E. MSZT session cache (V10 részeként):** Szerver oldali Map-alapú session cache a MSZT cookie-hoz (15 perces TTL), hogy elkerüljük a párhuzamos bejelentkezési problémát és gyorsítsuk a keresést.

---

## 19. Hasznos parancsok és hivatkozások

```bash
# Fejlesztői szerver indítása
cd /home/ubuntu/compliance-checker && pnpm dev

# Tesztek futtatása
pnpm test

# TypeScript ellenőrzés
pnpm tsc --noEmit

# DB séma push (interaktív – minden kérdésnél Enter)
pnpm db:push

# Jogszabály seed (ha a DB-t törölték)
node seed-regulations.mjs

# Szerver log ellenőrzése
tail -50 .manus-logs/devserver.log
tail -30 .manus-logs/browserConsole.log
```

**Fontos URL-ek:**
- Élő alkalmazás: https://compliance-lkoz8hck.manus.space
- NJT jogszabály forrás: https://njt.hu/jogszabaly/{év}-{szám}-{verzió}
- MSZT Szabványtár: http://szabvanykonyvtar.mszt.hu

---

*Ez a kézikönyv a V9 verzió állapotát tükrözi (2026. május 5.). A projekt a Manus WebDev platformon fut és fejleszthető tovább.*
