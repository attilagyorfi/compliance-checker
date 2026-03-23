# Tervmegfelelőség-ellenőrző – TODO

- [x] Adatbázis séma: analyses, documents táblák
- [x] Backend: fájlfeltöltés S3-ra (PDF)
- [x] Backend: PDF szöveg kinyerés (pdf-parse)
- [x] Backend: AI elemzés tRPC endpoint (LLM chunking + összevetés)
- [x] Backend: elemzés státusz lekérdezés
- [x] Backend: riport lekérdezés
- [x] Frontend: CSS téma (M Mérnöki arculat)
- [x] Frontend: Header komponens (logó + navigáció)
- [x] Frontend: Feltöltési oldal (drag & drop)
- [x] Frontend: Feldolgozás oldal (progress indikátor)
- [x] Frontend: Eredmény oldal (kártyás megjelenítés, státusz badge-ek)
- [x] Frontend: Riportok oldal (korábbi elemzések listája)
- [x] PDF export funkció
- [x] Vitest tesztek (8/8 sikeres)

## Bővítés – Valóságos mérnöki munkafolyamat

### Adatbázis
- [x] Séma bővítés: regulation_sources, platform_credentials táblák
- [x] Migráció futtatása (SQL direkt)

### Backend – Dokumentumtípus-kezelés
- [x] DOCX szövegkinyérés (mammoth)
- [x] XLSX szövegkinyérés (xlsx)
- [x] DWG/DXF metaadat kinyérés (szöveg alapú)
- [x] IFC metaadat kinyérés (text parse)
- [x] Automatikus szövegkinyérés fájltípus alapján

### Backend – Jogszabályi forrás integráció
- [x] NJT (njt.hu) scraper: jogszabály szöveg letöltés URL alapján
- [x] net.jogtar.hu scraper: alternatív forrás
- [x] Regulation source kezelő: mentés/frissítés DB-be (tRPC router)
- [x] AI elemzés bővítése: könyvtári források on-the-fly fetch + cache

### Backend – Platform credential kezelés
- [x] Platform credentials tábla (MSZT, Jogtár, Építésijog.hu, EUR-Lex)
- [x] Titkosított credential tárolás (AES-256)
- [x] Platform bejelentkezés + tartalom lekérés (scraper keretrendszer)
- [x] Kapcsolat tesztélés funkció

### Frontend – Multi-dokumentum feltöltés
- [x] Több fájl egyidejű feltöltése (drag & drop, max 20 fájl)
- [x] Fájlonkénti szakterület-jelölés (legördulő)
- [x] Feltöltési folyamat fájlonkénti státusz
- [x] Fájltípus ikonok (PDF, DOCX, XLSX, DWG, IFC)

### Frontend – Jogszabályi forrás kezelő
- [x] Jogszabály könyvtár oldal (mentett jogszabályok listája)
- [x] Jogszabály hozzáadása URL alapján (NJT, net.jogtar.hu)
- [x] Jogszabály kategória-kezelés (szakterület szerint)
- [x] Jogszabály frissítés gomb

### Frontend – Platform bejelentkezés kezelő
- [x] Platform kapcsolatok oldal (MSZT, Jogtár, Építésijog.hu, EUR-Lex)
- [x] Kapcsolat-tesztelés gomb
- [x] Kapcsolat státusz jelzés (zöld/piros)
- [x] Credential titkosítás jelzése a UI-ban

### Tesztek
- [x] Dokumentumtípus kinyérés tesztek
- [x] Regulation source scraper tesztek
- [x] Credential kezelés tesztek
- [x] Vitest tesztek: 14/14 sikeres

## Bővítés V3 – MSZT integráció, szabadszavas kereső, hallucináció-kezelés

### Adatbázis
- [x] search_queries tábla (keresési előzmények)
- [x] search_settings tábla (felhasználói beállítások)

### Backend – MSZT integráció
- [x] MSZT credential mentés/lekérés tRPC endpoint (meglévő platformCredentials router)
- [x] MSZT session kezelés keretrendszer (regulationScraper.ts)
- [x] MSZT szabványkeresés endpoint (standardsSearch router)
- [x] MSZT tartalom letöltés + cache (regulationSources tábla)

### Backend – Szabadszavas kereső
- [x] Query rewriting (AI-val kérdés pontosítása)
- [x] Hybrid search (keyword + szemantikus)
- [x] Releváns forrásrészek kiválasztása
- [x] Strukturált válasz generálás (max 10 mondat + hivatkozások)
- [x] Self-check lépés (hallucináció szűrés)
- [x] Confidence score számítás
- [x] Bővebb válasz funkció
- [x] Fallback válasz ha nincs elegendő forrás

### Backend – Keresési előzmények
- [x] Keresés mentése DB-be
- [x] Előzmények listázása
- [x] Előzmény törlése

### Frontend – MSZT belépő ablak
- [x] MSZT credential dialog (Platform kapcsolatok oldalon)
- [x] Kapcsolat tesztelés gomb
- [x] Státusz jelzés

### Frontend – Szabványkereső oldal
- [x] Természetes nyelvű kérdés beviteli mező
- [x] Keresési mód választó (szabvány / belső dok. / kombinált)
- [x] Válasz hossz beállítás (rövid / standard / részletes)
- [x] Működési mód (gyors / pontos)
- [x] Strukturált válasz megjelenítés (összefoglaló + hivatkozások táblázat)
- [x] Bővebb válasz gomb
- [x] Confidence badge
- [x] Forrás kártyák (dokumentum, oldal, fejezet, link)

### Frontend – Keresési előzmények oldal
- [x] Előzmények listája (kérdés, válasz, időpont)
- [x] Keresés az előzményekben
- [x] Előzmény részletek megjelenítése

### Tesztek
- [x] Kereső backend tesztek
- [x] Strukturált válasz tesztek
- [x] Vitest tesztek: 18/18 sikeres

## Bővítés V4 – Internetes keresés a Szabványkeresőben

### Backend
- [x] Internetes keresés modul (webSearch.ts – DuckDuckGo HTML scraper, domain rangsorolás, tartalom kinyerés)
- [x] Weboldal tartalom letöltés + szöveg kinyerés (cheerio alapú)
- [x] Keresési mód bővítése: "web" és "combined_with_web" opciók
- [x] Webes találatok forrásként való kezelése (dokumentumnév, URL, excerpt)
- [x] SearchSource típus bővítve sourceType mezővel
- [x] DB séma: search_mode enum bővítve

### Frontend
- [x] "Internetes keresés" opció a keresési logika választóban (zöld)
- [x] "Kombinált + Web" opció (könyvtár + internet, teljes szélességű gomb)
- [x] Webes forrás kártyák megkülönböztetett megjelenítése (zöld border, Globe ikon, "Internetes forrás" badge)
- [x] Keresési folyamat jelzése: kontextuális szöveg web módhoz
- [x] Figyelmeztető info box web módok esetén (hosszabb keresési idő)

### Tesztek
- [x] Vitest: 18/18 sikeres (meglévő tesztek változatlanul zöldek)

## Javítások V5

- [x] Ellenőrzés menüpont törlése (Header + App.tsx)
- [x] Platformok menüpont törlése (Header + App.tsx)
- [x] Tudástár menüpont hozzáadása (Header + App.tsx + KnowledgeBasePage.tsx)
- [x] Főoldal "Elemzés indítása" CTA → /search átirányítás
- [x] Tudástár oldal: dokumentum feltöltés, lista, törlés
- [x] Tudástár backend: tRPC router + DB tábla
- [x] Szabványkereső: URL beviteli mező internetes keresés módhoz
- [x] Szabványkereső: URL-alapú tartalom letöltés + keresés
- [x] Jogszabályok oldal: csak feltöltött dokumentumok, AI kategória-felismerés
- [x] Jogszabályok backend: dokumentum kategória AI elemzés
- [x] Lábléc: 2025 → 2026 javítás

## V6 – Professzionális szintre emelés

### 1. BLOKK – Stabilizáció és biztonság

#### 1.1 Jogosultságkezelés
- [x] users tábla: role enum bővítése (admin / internal / reviewer)
- [x] projects tábla
- [x] project_members tábla

#### 1.2 Audit log
- [x] audit_logs tábla
- [x] auditLog() helper
- [x] Naplózás: feltöltés, elemzés indítás, elemzés befejezés, hiba

#### 1.3 Privát fájltárolás
- [x] storageGet() presigned URL wrapper (meglévő storage.ts)
- [x] PDF export: generálási metaadat

#### 1.4 Compliance engine – bizonyíték-alapú findingok
- [x] ComplianceResult típus bővítése: severity, confidence, regulationExcerpt, planExcerpt, nextStep
- [x] LLM prompt + JSON schema frissítése
- [x] reszben_megfelel státusz hozzáadva

#### 1.5 Releváncia-alapú chunkolás
- [x] selectRelevantChunks() TF-IDF alapú (relevanceChunker.ts)
- [x] Top-K releváns chunk kiválasztása

#### 1.6 OCR
- [x] tesseract.js integráció
- [x] Szkennélt PDF detektálás
- [x] OCR fallback a compliance engine-ben

#### 1.7 Queue-alapú feldolgozás
- [x] In-memory queue + retry logika (analysisQueue.ts, max 3 próbálkozás, exponenciális backoff)
- [x] Hibáállapot kezelés

### 2. BLOKK – Workflow és UX

#### 2.1 Projektalapú működés
- [x] projects tábla + project_members tábla
- [ ] analyses/knowledgeBase/searchQueries: projectId FK (későbbi fejállesztés)
- [ ] ProjectsPage + ProjectDetailPage (későbbi fejlesztés)

#### 2.2 Workflow státuszok
- [x] analyses: workflowStatus mező (compliance router-ben)
- [x] Finding státusz kezelés (severity, confidence)
- [ ] Státusz változtatás endpointok (későbbi fejlesztés)

#### 2.3 Operatív dashboard
- [x] DashboardPage: stat kártyák, szűrhető elemzéslista, workflow badge-ek
- [x] Gyors műveletek gombok

#### 2.4 Finding kártya
- [x] Státusz, súlyosság, confidence, idézett részlet, tervdokumentum-részlet
- [x] Confidence progress bar, severity badge
- [x] "Miért ezt állítja?" bizonyíték panel
- [ ] Felelős személy, review gomb, megjegyzés (későbbi fejlesztés)

#### 2.5 Valós idejű státuszjelzés
- [x] SSE endpoint (compliance router-ben)
- [x] Lépésenkénti státuszjelzés (progressStep mező)

#### 2.6 UX újrastruktúrálás
- [x] Új navigáció: Dashboard / Szabványkereső / Tudástár / Jogszabályok / Előzmények
- [x] Header + App.tsx frissítése
- [x] Stale /analysis linkek javítása

### 3. BLOKK – Keresés és forráskezelés

#### 3.1 Szemantikus keresés
- [x] TF-IDF alapú relevancia-ponozás (relevanceChunker.ts)
- [ ] Embedding + cosine similarity (későbbi fejlesztés)

#### 3.2 Forrás megbízhatóság
- [x] regulationSources: lastFetched, fetchStatus mezők
- [ ] Elavultsági figyelmeztetés (későbbi fejlesztés)

#### 3.3 "Miért ezt állítja?" panel
- [x] FindingEvidencePanel beépítve a ResultCard komponensbe (regulationExcerpt + planExcerpt idézetek)

### Tesztek
- [x] Compliance engine bővítés tesztek
- [x] Vitest: 18/18 sikeres
