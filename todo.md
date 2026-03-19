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
