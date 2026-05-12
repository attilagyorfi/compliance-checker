# M Mérnöki – Tervmegfelelőség-ellenőrző: Fejlesztői Kézikönyv

> **Verzió:** V11.11 (2026. május 8.)
> **Projekt:** `compliance-checker`
> **Élő URL:** https://compliance-lkoz8hck.manus.space
> **Stack:** React 19 + Vite 7 + Express 4 + tRPC 11 + Drizzle ORM + MySQL/TiDB
> **Platform:** Manus WebDev (hosting + auth + DB + S3 storage)
>
> **V11.6 – V11.11 változásnapló (V11.5-höz képest):**
> - **V11.6 (a) Projekt-import** — `projects.import` endpoint, JSON-validáció a kliens + szerver oldalon, file-picker dialog a ProjectsPage-en. Tagság NEM kerül vissza, fájl-binárisok sem.
> - **V11.7 (b) Soft-delete** — `regulation_sources` és `knowledge_base_documents` táblákon új `deletedAt` timestamp. delete most soft-delete + chunk_embeddings cascade cleanup. Új `restore` és `permanentDelete` endpointok. UI: "Mutasd a törölteket" toggle + Visszaállítás/Végleges törlés gombok.
> - **V11.8 (c) Bulk a /regulations-on** — `regulationSources.deleteMany` + `restoreMany` endpointok. UI: checkbox-os kijelölési modell, sticky bulk action bar (kontext-érzékeny — csak aktív, csak törölt, vagy vegyes kijelölés különböző gombsorokkal).
> - **V11.9 (d) Admin dashboard** — új `/admin` route, `admin` tRPC router (stats / listUsers / changeUserRole / listAllProjects / emptyTrash). Header conditional "Admin" nav-item csak role: "admin" user-eknek. Kuka-ürítés végleges törléshez.
> - **V11.10 (e) Per-projekt audit-link** — `audit.list` új `resourceId` filterrel, AuditPage URL-search-param olvasás, ProjectDetailPage Settings-tab új "Projekt napló" link.
> - **V11.11 (f) Értesítések** — új `notifications` tábla, `notifications` tRPC router (list / unreadCount / markRead / markAllRead / delete). Trigger-pontok: analízis befejezés és tag-hozzáadás. Header-be Bell ikon dropdown-nal és piros badge-dzsel. Email-küldés helye (`server/notifications.ts → sendEmail`) placeholder-ben, SMTP_HOST env változó esetén aktivál.
>
> **DEPLOY-FONTOS:** pnpm db:push szükséges a chunk_embeddings (V11), deletedAt oszlopok (V11.7), és notifications tábla (V11.11) prod DB-be való telepítéséhez. A backend mind try/catch-vel rendelkezik, ami a hiányzó oszlopok hibáját graceful módon kezeli, így ha a deploy elcsúszik a db:push-tól, semmi nem törik — csak ezek a feature-ek nem aktívak.
>
> **V11.5 változásnapló (V11.4-hez képest):**
> - **Teljes dark mode (V11.5):** új `.dark { ... }` CSS-blokk az `index.css`-ben OKLCH-tokenekkel a Tailwind 4 alapváltozóira (background, foreground, card, popover, secondary, muted, accent, destructive, border, input, ring, sidebar.*, chart.*) + 11 page-level neutrál CSS-var (`--page-bg`, `--surface`, `--line`, `--text-strong/default/muted/faint` stb.) és 4 info-banner változó. A `@theme inline` aliasokon át Tailwind utility-k (`bg-surface`, `text-text-muted`, `border-line` stb.) automatikusan swap-elnek. Sed-batch refactor 16 page-fájlban: `bg-white`, `bg-gray-50/100`, `border-gray-200/100`, `text-gray-{300..900}` és inline `style={{ borderColor: "#e5e7eb" }}` típusú konstansok mind CSS-var-driven utility-re/value-ra. Brand-színek (#7CA9D3) és szemantikus state-színek (red/amber/green megfelelőségi badge-ek) szándékosan érintetlenek.
> - **Toggle UI:** Header-ben Sun/Moon ikon mind asztali, mind mobil nézetben. SettingsPage-en külön "Megjelenés" kártya Világos/Sötét gombpárral. `App.tsx` `ThemeProvider switchable={true}`, választás localStorage-ban perzisztálva.
>
> **V11.4 változásnapló (V11.3.1-hez képest):**
> - **Tudástár bulk-műveletek (V11.4.c):** új `knowledgeBase.deleteMany` endpoint atomic batch törléshez. `KnowledgeBasePage`-en checkbox-os kijelölési modell + sticky bulk action bar (Embeddings tömeges generálása szekvenciális loop-pal és progress-counter-ral, tömeges törlés egy kérésben, Mégse).
>
> **V11.3 változásnapló (V11.2-höz képest):**
> - **Polish (V11.2.1):** ActiveProjectSelector és ProjectScopeBanner auto-clear ha a stored aktív-projekt eltűnt (törölve más böngészőben/usernél). KnowledgeBasePage upload onSuccess invalidate-eli a getEmbeddingCounts-t.
> - **Projekt-export (V11.3.b):** `projects.export({ id })` protected endpoint — JSON snapshot a projekt minden adatáról (metaadat + tagok + analízisek + KB + keresések), audit-logolva. UI: ProjectDetailPage Beállítások-tabján "JSON letöltése" gomb.
> - **Audit-log nézet (V11.3.c):** új `/audit` route + `AuditPage` esemény-megoszlás widgettel, szűrőkkel (eventType / resourceType / sinceDays) és paginációval. Backend: új `audit` tRPC router (list / summary / resourceTypes), mind protected.
> - **Beállítások oldal (V11.3.d):** új `/settings` route + `SettingsPage` a Szabványkereső per-user alapértelmezéseihez (searchMode / operationMode / answerLength). Backend: új `searchSettings` router (get / upsert / reset), a `search_settings` táblát userId-vel kulcsolva. A StandardsSearchPage betöltődéskor alkalmazza a mentett értékeket; az adott keresésnél a user szabadon felülírhatja.
>
> **V11.2 változásnapló (V11.1-hez képest):**
> - **Globális "aktív projekt" context:** új `ProjectContext` provider (`client/src/contexts/ProjectContext.tsx`) localStorage-perzisztált aktív-projekt id-vel. A `Header`-be új `ActiveProjectSelector` dropdown került (asztalon a nav-bar jobb oldalán, mobilon a hamburger-menüben), ami listázza a `projects.list` eredményét és engedi a switch-et / "Minden projekt" feloldást.
> - **Page-szintű automatikus szűrés:** ha be van állítva aktív projekt, a `DashboardPage`, `ReportsPage`, `KnowledgeBasePage`, `SearchHistoryPage` listázásai automatikusan erre szűrnek (a `projectId` opcionális paramétert átadják a backend listing endpointoknak). A `StandardsSearchPage` és `AnalysisPage` create-flow-i alapértelmezetten az aktív projekthez kötik az új keresést / analízist.
> - **Project-scope banner:** új `ProjectScopeBanner` komponens (`client/src/components/ProjectScopeBanner.tsx`) — egységes kék sáv a szűrt oldalak tetején, "Projekt megnyitása" linkkel és "Feloldás" gombbal.
>
> **V11.1 változásnapló (V11.0-hoz képest):**
> - **/regulations route drift-fix (G + H):** A `RegulationLibraryPage` immár ténylegesen a `regulation_sources` táblát kezeli, nem a Tudástárt. Funkciók: lista, "Új jogszabály" dialog (URL alapú), per-source "Letöltés" (fetchContent), "Embeddings" (regenerateEmbeddings, V11.C), "Törlés", stale-warning badge, "Mind frissítése (30+ nap)" bulk gomb.
> - **Embedding-backfill UI a Tudástáron is:** `KnowledgeBasePage` minden dokumentum-kártyán Sparkles-gomb és chunk-szám badge — a `knowledgeBase.regenerateEmbeddings` és `knowledgeBase.getEmbeddingCounts` endpointokra építve.
> - **Új endpointok:** `regulationSources.getEmbeddingCounts` és `knowledgeBase.getEmbeddingCounts` (batched per-source chunk-szám lekérés, üres tömb ha a `chunk_embeddings` tábla még nincs deployolva).
>
> **V11.0 változásnapló (V10.0-hoz képest):**
> - **Szemantikus keresés (V10.18.C):** új `chunk_embeddings` tábla (polymorphic, regulation + KB), `getEmbedding()` és `cosineSimilarity()` helperek (`server/embeddings.ts`), `regulationSources.regenerateEmbeddings` és `knowledgeBase.regenerateEmbeddings` backfill endpointok. A Szabványkereső `internal` / `combined` / `combined_with_web` módjai semantikus + keyword találatokat egyesítenek (`mergeSearchSources`); az embedding API hiánya esetén transzparensen keyword-only fallback.
> - **Automatikus jogszabály-frissítés alapja (V10.18.D):** `regulationSources.refreshAllStale({ olderThanDays })` endpoint az elavult források bulk re-fetchelésére, a `fetchContent` immár `lastSyncAt` + `syncStatus` + `lastSyncError` mezőket is karbantart. UI: `AnalysisPage` forrás-pickerében "Elavult (N napja)" badge + sárga sávban "Mind frissítése" gomb. (Manus ütemező integráció a user oldalán: a `refreshAllStale` egy scheduled task-ből hívható.)
> - **Élő MSZT-keresés (V10.18.F, kísérleti):** `searchMsztLive()` a `regulationScraper.ts`-ben + bekötés a Szabványkereső `mszt` / `combined` / `combined_with_web` módjaiba. **Feature-flag mögött:** csak akkor aktív, ha `ENABLE_LIVE_MSZT_SEARCH=true` env változó van beállítva. MSZT-credential és session-cache szükséges hozzá. A scraping-szelekciók best-effort jellegűek (több CSS selector-fallback), érdemes prod-on validálni az MSZT aktuális HTML-jén.
>
> **V10.0 változásnapló (V9-hez képest):**
> - **Projektalapú szervezés:** új `/projects` és `/projects/:id` oldalak; `projects` és `projectMembers` tRPC routerek. Az `analyses`, `knowledge_base_documents` és `search_queries` táblák `projectId` mezője az új create-flow-kban perzisztálódik, és a listázó endpointok opcionálisan szűrnek rá. A projekt detail oldal négy adat-tabbal (Elemzések / Tudástár / Keresések / Tagok).
> - **RBAC project_members alapján:** owner / member / reviewer szerepkörök; a projekt létrehozója automatikusan owner. A `projects.update` és `projects.delete` mutáció owner-only; a `projectMembers.add/changeRole/remove` szintén owner-only, az utolsó owner törlését/lefokozását letiltva.
> - **Finding review workflow:** a `ResultPage` minden findinghez kibontható "Felülvizsgálat" panel — workflow-státusz dropdown (nyitott / ellenőrzés alatt / elfogadva / elutasítva / javítva / lezárva), felelős (név/e-mail), megjegyzés. A backend `compliance.updateFindingStatus` endpoint perzisztál és audit-logol.
> - **MSZT session cache (V10.E):** `withSessionCache` generikus helper + `getMsztSession` 15 perces TTL-lel, sha256-os passwordHash kulccsal (auto-invalidálás jelszóváltáskor). A `regulationSources.fetchContent` az új cache-en keresztül fut.
>
> **V9.1 változásnapló (V9-hez képest):**
> - Tudástár-integráció: a `knowledge_base_documents.extractedText` mezőből származó tartalmak ténylegesen bekerülnek a Szabványkereső találatai közé (`internal` / `combined` / `combined_with_web` módokban).
> - Platform credential titkosítás: az XOR + base64 (pilot) helyett valódi **AES-256-CBC** scrypt-tel származtatott kulccsal és per-encryption random IV-vel; a régi formátumú DB-rekordok backward-compatible módon visszafejthetők.
> - MSZT/Jogtár/Építésijog login: a session cookie-k formátum-helyesen kerülnek átadásra (`Set-Cookie` response → `Cookie` request konverzió, attribútumok lestripelve).
> - Szabványkereső UI: a keresési módok (különösen `mszt`) leírásai pontosabban tükrözik a tényleges viselkedést.

---

## 1. Projekt áttekintés és célok

Az **M Mérnöki Tervmegfelelőség-ellenőrző** egy AI-alapú webalkalmazás, amelyet az M Mérnöki Iroda Kft. számára fejlesztettünk. A rendszer célja, hogy a mérnöki tervdokumentumok (PDF, DOCX, XLSX, DWG, IFC) megfelelőségét automatikusan ellenőrizze a vonatkozó magyar és európai építési jogszabályok, szabványok alapján.

A platform három fő funkcionális pillérre épül. Az első a **Compliance Engine**: tervdokumentumok feltöltése után az AI elvégzi a jogszabályi összevetést, és strukturált, bizonyíték-alapú megfelelőségi riportot generál (finding-szintű indoklással, idézetekkel, súlyossági besorolással). A második a **Szabványkereső**: természetes nyelvű kérdésekre ad szakmai választ a feltöltött jogszabályok, az MSZT Szabványtár, a Tudástár dokumentumai és az internet alapján. A harmadik a **Forráskezelő**: a jogszabályi könyvtár (NJT-ről letöltött tartalmak), a Tudástár (belső feltöltött dokumentumok) és a platform-kapcsolatok (MSZT, Jogtár, EUR-Lex) kezelése.

---

## 2. Technológiai stack

| Réteg | Technológia | Megjegyzés |
|---|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.9 | Wouter router (3.7.1 patch a `patches/` mappában), shadcn/ui + Radix UI |
| UI extras | framer-motion, recharts, streamdown, sonner, lucide-react | Animáció, chart, streamelt markdown, toast, ikonok |
| Stílus | Tailwind CSS 4 | OKLCH színek, CSS változók |
| Backend | Express 4, tRPC 11, Node.js 22 | tsx watch fejlesztéshez |
| API réteg | tRPC + React Query 5 | Superjson transzformer |
| Adatbázis | MySQL/TiDB (Drizzle ORM 0.44) | Drizzle-kit migrációk |
| Fájltárolás | AWS S3 (Manus beépített) | `storagePut` / `storageGet` helperek |
| Auth | Manus OAuth 2.0 | JWT session cookie (`jose` lib) |
| AI | Manus beépített LLM API | `invokeLLM()` helper, JSON schema output |
| Tesztek | Vitest | 74/74 teszt zöld |
| Dokumentum-kinyerés | pdf-parse, mammoth, xlsx, tesseract.js | OCR fallback szkennelt PDF-hez |
| Web scraping | cheerio, node fetch | DuckDuckGo HTML scraper |
| Build pluginek | `vite-plugin-manus-runtime`, `@builder.io/vite-plugin-jsx-loc` | Manus-specifikus dev integráció |

---

## 3. Könyvtárstruktúra

```
compliance-checker/
├── client/
│   ├── src/
│   │   ├── _core/hooks/useAuth.ts        ← Auth hook (useAuth())
│   │   ├── contexts/
│   │   │   ├── ThemeContext.tsx          ← Téma (light/dark)
│   │   │   └── ProjectContext.tsx        ← Aktív projekt globális state (V11.2)
│   │   ├── components/
│   │   │   ├── Header.tsx                ← Navigáció (6 menüpont) + aktív-projekt selector (V11.2)
│   │   │   ├── ProjectScopeBanner.tsx    ← Sárga sáv listázó oldalakon (V11.2)
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
│   ├── embeddings.ts                     ← getEmbedding + cosineSimilarity + chunkAndEmbed (V11)
│   ├── compliance.test.ts                ← Vitest tesztek (router + scraper + cookie + AES)
│   └── auth.logout.test.ts               ← Auth logout teszt
├── shared/
│   ├── const.ts                          ← Megosztott konstansok (cookie név, timeout, hibaüzenetek)
│   ├── types.ts                          ← Megosztott típus-export (re-export drizzle/schema-ból)
│   └── _core/errors.ts                   ← Hiba-típusok
├── drizzle/
│   └── schema.ts                         ← Teljes DB séma (10 tábla)
├── patches/
│   └── wouter@3.7.1.patch                ← Wouter router pnpm patch (lásd `package.json` patchedDependencies)
├── seed-regulations.mjs                  ← Jogszabály seed script (NJT tartalmak)
├── todo.md                               ← Verziónapló (V1–V9 retrospektíva, nem aktív backlog)
├── ideas.md                              ← UI design koncepciók (Concept 3 = "Dashboard Pro" lett kiválasztva)
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
| `chunk_embeddings` | Szemantikus keresés chunk-szintű embeddings (V11) | `sourceType` (regulation/knowledge_base), `sourceId`, `chunkIndex`, `text`, `embedding` (JSON: number[]) |

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
regulationSources.getById       → Jogszabály részletes lekérése
regulationSources.create        → Új jogszabály hozzáadása URL alapján
regulationSources.update        → Jogszabály frissítése
regulationSources.delete        → Jogszabály törlése
regulationSources.fetchContent  → Tartalom letöltés (lastSyncAt + syncStatus karbantartással)
regulationSources.refreshAllStale       → Összes 30+ napja elavult forrás bulk re-fetchelése (V11)
regulationSources.regenerateEmbeddings  → Chunk embeddings backfill egy forráshoz (V11)
regulationSources.getEmbeddingCounts    → Per-source chunk-szám (V11.1, RegulationLibraryPage badge)
platformCredentials.list        → Platform kapcsolatok listája
platformCredentials.save        → Credential mentése (AES-256 titkosítással)
platformCredentials.testConnection → Kapcsolat tesztelése
platformCredentials.delete      → Credential törlése
standardsSearch.search          → Szabványkereső (fő endpoint)
standardsSearch.extendAnswer    → Bővebb válasz generálás
standardsSearch.listHistory     → Keresési előzmények
standardsSearch.deleteHistory   → Előzmény törlése
knowledgeBase.list              → Tudástár dokumentumok listája (opcionális projektId szűrő)
knowledgeBase.upload            → Dokumentum feltöltés Tudástárba (opcionális projektId)
knowledgeBase.delete            → Dokumentum törlése (chunk_embeddings cascade-cleanup)
knowledgeBase.getTextsForSearch → Szövegek kereséshez (külső API, a search router közvetlen DB-elérést használ)
knowledgeBase.regenerateEmbeddings → Chunk embeddings backfill egy KB-dokumentumhoz (V11)
knowledgeBase.getEmbeddingCounts → Per-document chunk-szám (V11.1)
projects.list                   → Projektek listája (opcionális includeDeleted)
projects.getById                → Projekt lekérése azonosító alapján
projects.create                 → Új projekt (protected, auto-bootstrappel owner-membership-et)
projects.update                 → Projekt módosítása (owner-only)
projects.delete                 → Projekt soft-delete (owner-only)
projectMembers.list             → Projekt-tagok listája
projectMembers.add              → Tag hozzáadása e-mail alapján (owner-only)
projectMembers.changeRole       → Tag szerepkörének módosítása (owner-only, utolsó owner védve)
projectMembers.remove           → Tag eltávolítása (owner-only, utolsó owner védve)
projects.export                 → Projekt-adatok JSON-export (V11.3, member-only, audit-logolva)
audit.list                      → Audit-napló listázása szűrőkkel + paginálással (V11.3, protected)
audit.summary                   → Esemény-megoszlás eventType szerint (V11.3, protected)
audit.resourceTypes             → Distinct resourceType-ok (V11.3, protected)
searchSettings.get              → Felhasználói keresési alapértelmezések (V11.3, protected)
searchSettings.upsert           → Beállítások mentése/frissítése (V11.3, protected)
searchSettings.reset            → Beállítások törlése = alapértelmezésre (V11.3, protected)
compliance.updateWorkflowStatus → Elemzés-szintű workflow státusz módosítása
compliance.updateFindingStatus  → Finding-szintű workflow + reviewNote + assignedTo módosítása
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

**2. Forráskeresés (hybrid search):** A keresési módtól függően különböző forrásokat kérdez le keyword alapon (OR feltételek az összes kulcsszóra). A módok pontos viselkedése:

| Mód | Forrás |
|---|---|
| `internal` | `regulation_sources` (kivéve `sourceType="mszt"`) + `knowledge_base_documents` (Tudástár) — keyword + szemantikus |
| `mszt` | Azok a `regulation_sources` rekordok, ahol `sourceType="mszt"` (importált MSZT-eredetű tartalmak) — keyword + szemantikus. Ha `ENABLE_LIVE_MSZT_SEARCH=true` env van + MSZT credential konfigurálva, **élő MSZT-keresés** is hozzájön (V11). |
| `combined` | `regulation_sources` (összes) + `knowledge_base_documents` (Tudástár) — keyword + szemantikus + opcionálisan élő MSZT (feature flag esetén) |
| `web` | DuckDuckGo HTML scraper, vagy a felhasználó által megadott URL-ek (`fetchUrlSources`) |
| `combined_with_web` | `combined` (jogszabályok + Tudástár + szemantikus + opcionálisan élő MSZT) **+** web források, dedupelve URL alapján |

**Találat-egyesítés (`mergeSearchSources`):** a keyword és szemantikus találatok dedupelve kerülnek egy listába (`documentName + excerpt-prefix` kulccsal), magasabb `relevanceScore` nyer ütközéskor. Az eredmények relevancia szerint csökkenőleg rendezve, max 10 darab.

A Tudástár dokumentumai a `searchKnowledgeBase` helper-rel, közvetlenül DB-ből kerülnek be (`knowledgeBaseDocuments.extractedText` mező); a `knowledgeBase.getTextsForSearch` tRPC endpoint létezik, de a `standardsSearch.search` belső flow nem használja (közvetlen DB-elérés gyorsabb, és így a relevancia-pontozás közös a `keywordSearch`-csel). A szemantikus oldalon a `chunk_embeddings` táblából töltjük az előre generált chunk-embeddingeket; a query is embedelődik query-time-ban a `getEmbedding()`-en keresztül, és cosine similarity-vel pontozódik.

**3. Strukturált válasz generálás:** Az LLM a forrásrészletek alapján szakmai választ generál, hivatkozásokkal ([1], [2] stb. formátumban). A válasz hossza konfigurálható (rövid/standard/részletes).

**4. Self-check (Pontos módban):** Egy második LLM hívás ellenőrzi, hogy a generált válasz minden állítása visszavezethető-e a forrásokra. Ha nem, a `selfCheckPassed` false lesz, és a UI figyelmeztetést jelenít meg.

A keresési előzmények automatikusan mentődnek a `search_queries` táblába.

---

## 8. Platform kapcsolatok és MSZT integráció

A `server/routers/platformCredentials.ts` kezeli a külső platform belépési adatait (CRUD + `testConnection`), de a jelszó-titkosítás (`encryptPassword` / `decryptPassword`) és a platform-login funkciók (`loginToMszt`, `loginToJogtar`, `loginToEpitesijog`) a `server/regulationScraper.ts` fájlban vannak.

A jelszavak **AES-256-CBC** titkosítással tárolódnak: a kulcs a `JWT_SECRET` env változóból `crypto.scryptSync` segítségével származtatódik (32 byte), minden titkosítás új random 16 byte IV-t használ. Output formátum: `<base64 IV>:<base64 ciphertext>`. **Backward compatibility:** ha a DB-ben a régi (V9 előtti) XOR + base64 formátumban van jelszó (kettőspont nélküli base64), a `decryptPassword` automatikusan a régi algoritmussal fejti vissza — így a meglévő platform-credentialek nem törnek el a frissítéskor; ahogy a felhasználó újra menti, áttitkosítódnak.

Az MSZT Szabványtár (`http://szabvanykonyvtar.mszt.hu`) integrációja a `regulationScraper.ts` `loginToMszt` függvénye. Lépések:

1. Lekéri a login oldalt és kinyeri a CSRF tokent (Symfony `_csrf_token`) + a PHPSESSID cookie-t.
2. POST `/login_check`-re bejelentkezik (`_username`, `_password`, `_csrf_token` mezőkkel).
3. 15 másodperces timeout-ot alkalmaz (`AbortSignal.timeout(15000)`).
4. A redirect utáni oldal HTML tartalmát elemzi: ha "már bejelentkezett valaki" üzenetet tartalmaz, barátságos hibaüzenetet ad vissza.
5. Sikeres bejelentkezés esetén visszaadja a teljes session cookie-stringet (Cookie request-header formátumban).

**Cookie-helper függvények** (`cookieHeaderFromResponse`, `mergeCookies`): a `Set-Cookie` response header attribútumokkal érkezik (Path, HttpOnly, Expires, SameSite stb.), de a `Cookie` request header csak `name=value; name=value` párokat fogad. A két helper konvertál köztük, és kezeli a több Set-Cookie esetét (`Headers.getSetCookie()` ha elérhető, különben regex-szel tördelve).

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
| Projektek | `/projects` | Projekt-lista (V10) |
| Szabványkereső | `/search` | Természetes nyelvű kereső (fő funkció) |
| Tudástár | `/knowledge-base` | Belső dokumentumok feltöltése és kezelése |
| Jogszabályok | `/regulations` | Jogszabályi könyvtár — `regulation_sources` CRUD, tartalom-letöltés, embedding-backfill, stale-warning (V11.1) |
| Előzmények | `/search-history` | Keresési előzmények |
| Audit | `/audit` | Audit-napló (V11.3) — esemény-megoszlás, szűrők, paginálás, JSON metadata expand |

A header jobb oldalán **Beállítások ikon** (fogaskerék) is — `/settings` route, a Szabványkereső per-user alapértelmezéseivel.

A `/projects/:id` route a projekt-részletes oldal, négy adat-tabbal (Elemzések, Tudástár, Keresések, Tagok) és egy beállítások-tabbal. A Tagok-tab az owner számára add/changeRole/remove műveleteket biztosít.

**Aktív projekt (V11.2):** A header jobb oldalán lévő dropdown (`ActiveProjectSelector`) megengedi, hogy a felhasználó kiválassza melyik projekttel dolgozik. Az aktív projekt localStorage-ben perzisztálódik (`active-project-id` kulcs alatt). Hatása:
- `Dashboard`, `Riportok`, `Tudástár`, `Előzmények` listázásai automatikusan szűrnek az aktív projektre.
- Új analízis (`/analysis`) és új keresés (`/search`) automatikusan ehhez a projekthez rendelődik.
- A szűrt oldalakon kék `ProjectScopeBanner` jelzi az aktív projektet, "Feloldás" gombbal a teljes nézethez visszatéréshez.
- A `Projektek` és `Jogszabályok` oldalakat nem érinti — workspace-szintűek.

A főoldal (`/`) egy landing page CTA-val, amely a `/search` oldalra irányít. A `/analysis` oldalon lehet új elemzést indítani, a `/result/:id` oldalon az eredményeket megtekinteni, a `/reports` oldalon a korábbi elemzéseket listázni.

A platform kapcsolatok a `/platforms` route-on érhetők el (nem szerepel a navigációban, de a Szabványkereső alján lévő "Platform beállítások" linkre kattintva érhető el).

---

## 14. Tesztek

A tesztek a `server/compliance.test.ts` és `server/auth.logout.test.ts` fájlokban vannak, Vitest keretrendszerrel. Jelenleg **54/54 teszt zöld**. A tesztek lefedik:

- Dokumentumtípus kinyerés (PDF, DOCX, XLSX, DWG, IFC)
- Regulation source scraper (NJT, net.jogtar.hu)
- Platform credential kezelés:
  - AES-256-CBC titkosítás/visszafejtés (encrypt/decrypt inverse)
  - IV randomizáció (azonos plaintext → eltérő ciphertext, mindkettő ugyanarra fejtődik vissza)
  - Legacy XOR formátum backward-compatible visszafejtése
- Cookie helperek (`cookieHeaderFromResponse` attribútum-stripping, többszörös Set-Cookie kezelés, `mergeCookies` névszerinti override)
- MSZT session cache (`withSessionCache`): cache hit, TTL lejárat, password-change auto-invalidálás, sikertelen login nem cache-elés, multi-user szeparáció
- Kereső backend (query rewriting, keyword search, structured answer)
- Strukturált válasz és self-check logika
- Compliance engine (finding generálás, severity, confidence)
- Auth logout (cookie törlés)
- Projects router (list / getById / create / update / delete — protected mutáció auth-igény)
- ProjectMembers router (list / add / changeRole / remove — protected mutáció auth-igény)
- Embedding helperek (`cosineSimilarity` identitás / orthogonális / opposite / dim-mismatch graceful, `getEmbedding` graceful nullret API hiányzásánál)
- MSZT live search feature flag (`isMsztLiveSearchEnabled` true/false toggle, `searchMsztLive` üres tömböt ad flag-off állapotban hálózat nélkül)
- Embedding-counts endpointok (`regulationSources.getEmbeddingCounts` és `knowledgeBase.getEmbeddingCounts` graceful empty-array fallback DB hiányában)
- Projects router export endpoint (auth required)
- Audit router (list / summary / resourceTypes — mind auth required)
- SearchSettings router (get / upsert / reset — mind auth required)

```bash
pnpm test                    # Összes teszt
pnpm test -- --reporter=verbose  # Részletes kimenet
```

---

## 15. Ismert korlátok és nyitott fejlesztési területek

Az alábbi funkciók szándékosan halasztva lettek, és a jövőbeli fejlesztés célpontjai:

**~~Projektalapú működés~~ (V10.0-ban implementálva):** `/projects` lista + `/projects/:id` detail oldal négy adat-tabbal és Tagok-tabbal. Az `analyses`, `knowledge_base_documents` és `search_queries` create-flow-i opcionálisan rögzítik a `projectId`-t, a listing endpointok szűrnek rá. RBAC `project_members` alapján (owner / member / reviewer) — a projekt-mutációk és a tagság-kezelés owner-only.

**~~Workflow státusz változtatás~~ (V10.0-ban implementálva):** A `ResultPage` minden findinghez kibontható "Felülvizsgálat" panel, workflow-státusz dropdown + felelős + megjegyzés mezőkkel. A `compliance.updateFindingStatus` backend endpoint perzisztál és audit-logol.

**~~Szemantikus keresés~~ (V11.0-ban kész):** `chunk_embeddings` tábla + `getEmbedding`/`cosineSimilarity` helperek + `semanticSearch` az `internal`/`combined`/`combined_with_web` módokban. Az embeddingek manuálisan generálódnak a `regulationSources.regenerateEmbeddings` és `knowledgeBase.regenerateEmbeddings` endpointokkal. Ha az embedding API nem érhető el, a rendszer transzparensen visszaesik keyword-only keresésre.

**~~Elavultsági figyelmeztetés~~ (V11.0-ban kész):** Az `AnalysisPage` forrás-pickerében sárga "Elavult (N napja)" badge minden 30+ napja nem frissített forrásnál + sárga sávban "Mind frissítése" gomb a `regulationSources.refreshAllStale` endpointtal. A `fetchContent` immár `lastSyncAt` + `syncStatus` + `lastSyncError` mezőket karbantart.

**MSZT session cache:** A `regulationSources.fetchContent` (jogszabály-tartalom letöltés) flow-nál minden hívás új MSZT bejelentkezést indít. Több MSZT URL egymás utáni feltöltésekor egy szerver oldali Map-alapú session cache (15 perces TTL) gyorsítaná a folyamatot és csökkentené az "egyszerre csak egy session" korlátba ütközés esélyét. (Megjegyzés: a Szabványkereső `mszt` módja **nem** használ élő MSZT-keresést, csak a már korábban importált tartalmakat — így a cache hatása ehhez a flow-hoz nem releváns.)

**~~Embedding alapú keresés~~ (V11.0-ban kész):** lásd fent. A `getEmbedding()` először `text-embedding-3-small`, majd `gemini-embedding-001`, majd `embedding-001` modelleket próbál a Manus forge API-n; ha mind hibát ad, a `embeddingApiAvailable` cache-be `false` kerül a process élettartamára (kerüljük a felesleges retry-okat).

**Több jogszabály tartalommal:** Jelenleg csak 4 jogszabálynak van tényleges szövege (ID 30001–30004). A többi 12 bejegyzés (ID 1–12) tartalom nélküli. Ezeket a Jogszabályok oldalon lehet URL alapján feltölteni, vagy a `seed-regulations.mjs` script bővítésével.

---

## 16. Biztonsági megfontolások

A platform credential jelszavak **AES-256-CBC** titkosítással tárolódnak. A titkosítási kulcs a `JWT_SECRET`-ből `crypto.scryptSync(secret, salt, 32)` segítségével származtatódik (a teljes secret bemegy, a scrypt 32 byte kulcsot ad ki); minden titkosítás új random 16 byte IV-t használ. A titkosítás és visszafejtés a `server/regulationScraper.ts`-ben van implementálva (`encryptPassword`, `decryptPassword` exportált függvények), és a `routers/platformCredentials.ts` ezeket használja a `saveCredentials` / `testConnection` flow-kban. A backward-compatible legacy XOR-decode a `decryptLegacyXor` belső függvényben.

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

**~~A. Projektalapú szervezés~~ (V10.0-ban kész):** `/projects` + `/projects/:id` oldalak, projects + projectMembers routerek, projectId FK-k bekötve, RBAC owner/member/reviewer.

**~~B. Finding review workflow~~ (V10.0-ban kész):** ResultPage Felülvizsgálat panel + `compliance.updateFindingStatus` endpoint.

**~~C. Szemantikus keresés~~ (V11.0-ban kész):** Embedding generálás a jogszabályszövegekhez (Manus beépített embedding API vagy OpenAI), cosine similarity alapú keresés. Ez a `relevanceChunker.ts` bővítésével valósítható meg.

**~~D. Automatikus jogszabály-frissítés~~ (V11.0-ban félkész):** A `regulationSources.refreshAllStale` endpoint és az `AnalysisPage`-en a "Mind frissítése" gomb kész. Ami még hiányzik: egy Manus oldali scheduled task ami napi vagy heti rendszerességgel automatikusan hívja az endpointot — ezt a Manus Management UI-ban kell beállítani (`https://compliance-lkoz8hck.manus.space/api/trpc/regulationSources.refreshAllStale`).

**~~E. MSZT session cache~~ (V10.0-ban kész):** `withSessionCache` generikus helper + `getMsztSession` 15 perces TTL-lel, sha256-os passwordHash kulccsal a `regulationScraper.ts`-ben. A `regulationSources.fetchContent` MSZT ágon az új cache-en keresztül fut.

**~~F. Élő MSZT-keresés~~ (V11.0-ban kísérleti):** `searchMsztLive()` implementálva a `regulationScraper.ts`-ben, bekötve a Szabványkereső `mszt` / `combined` / `combined_with_web` módjaiba. **Feature-flag mögött** (`ENABLE_LIVE_MSZT_SEARCH=true`) — alapértelmezetten kikapcsolva, mert az MSZT HTML-szelekciók best-effort-ok és prod-on validálni kell. Bekapcsolása: env változó beállítása + MSZT credential mentése a Platform-kapcsolatok oldalon. A scraping többféle CSS selector-t próbál (`.search-result`, `.standard-item`, `.result-item` stb.); ha az MSZT változtatja a markup-ot, a selectorok bővítendők.

**~~G. Embedding-backfill UI~~ (V11.1-ben kész):** A `RegulationLibraryPage` minden source-kártyán "Embeddings" gomb (`Sparkles` ikon) hívja a `regulationSources.regenerateEmbeddings`-t, és chunk-szám badge mutatja a `getEmbeddingCounts` eredményét. A `KnowledgeBasePage`-en ugyanez minden dokumentum-kártya jobb felső sarkában. Egy oldal-szintű "Szemantikus keresés inaktív" hint is megjelenik, ha 0 forráshoz van embedding.

**~~H. /regulations route drift-fix~~ (V11.1-ben kész):** A `RegulationLibraryPage.tsx` átírva valódi regulation-source manager-ré (`regulationSources.list` + `getEmbeddingCounts`). A "Jogszabályok" menüpont most CRUD + tartalom-letöltés + embedding-generálás műveleteket biztosít, listával, szakterület-szűréssel, kereséssel, stale-warning-gal és bulk-frissítés gombbal.

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
