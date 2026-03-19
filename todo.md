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
