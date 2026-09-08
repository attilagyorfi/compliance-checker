# Architektúra-audit — Compliance Checker → hivatkozás-központú kereső

> **0. fázis (felderítés).** Ez a dokumentum a jelenlegi kódbázis állapotát rögzíti a
> „hivatkozás-központú, szabadszavas keresőmotor" brief követelményeivel szemben.
> **Kód nem módosult.** A végén nyitott kérdések — kérlek, ezekre válaszolj, mielőtt
> bármelyik következő fázist elkezdem.

## 0. Vezetői összefoglaló — egy mondatban

A jelenlegi rendszer egy **válasz-központú RAG** (kérdés → LLM-válasz + laza forráslista),
a brief viszont egy **bizonyíték-központú hivatkozási rendszert** kér (találat → pontos
szerkezeti egység + oldalszám + mélylink + idézhető hivatkozás). A kettő közötti szakadék
**nagy, de nem a semmiből indul**: a keresési/rangsorolási mag, a vektortár, a UI-váz és a
deploy készen áll — a hiányzó rész az **ingestion mélysége** (szerkezet, oldalszám, bbox,
ábrák/képletek) és a **megjelenítés** (PDF-nézegető mélylinkkel).

**A legfontosabb két megállapítás elöl:**

1. **Stack-eltérés.** A brief végig **Python-eszközöket** feltételez (PyMuPDF/`fitz`,
   `pdfplumber`, `tesseract`, `huspacy`, `pix2tex`, `BGE-m3`). Ez a projekt **tiszta
   Node/TypeScript** (React + Vite + Express + tRPC + Drizzle + MySQL/TiDB), **egyetlen sor
   Python nélkül**, és Vercel serverless-en fut. Ez a brief legmélyebb, még eldöntetlen
   architektúra-kérdése (lásd Q1–Q2).
2. **A bizonyítékhoz szükséges adat ma nincs meg.** A rendszer **nem tárol oldalszámot,
   bounding boxot, dokumentum-szerkezetet, ábrákat/képleteket, és magát a PDF-bináris
   fájlt sem** — csak a kinyert nyers szöveget. A brief 4–5. követelménye (oldalszám +
   mélylink + kiemelés + idézhető hivatkozás) ezért nem „bekapcsolható", hanem az
   ingestion újratervezését igényli.

---

## 1. Projekt-struktúra, futtatás, függőségek, verziók

| | |
|---|---|
| **Nyelv/runtime** | Node.js (v22 a fejlesztői gépen), **ESM** (`"type": "module"`). **Nincs `engines` megkötés** a package.json-ben. **Nincs Python.** |
| **Frontend** | React 19 + Vite 7 + TypeScript, `wouter` router, TailwindCSS, `streamdown` (Markdown-render). |
| **Backend** | Express 4 + tRPC 11, Drizzle ORM. Egyetlen serverless függvénybe bundle-özve (`api/[...path].js`, esbuild). |
| **Adatbázis** | MySQL 8.0 (lokál Docker) / **TiDB Cloud** (éles). Drizzle migrációk. |
| **LLM/embedding** | **OpenAI felhő**: `gpt-4o-mini` (válasz + önellenőrzés + kérdés-átírás), `text-embedding-3-small` (1536 dim). |
| **PDF-kinyerés** | `pdf-parse` v2 (`PDFParse` osztály) — **csak nyers szöveg**, oldal/pozíció nélkül. |
| **Objektumtár** | `server/storage.ts` — Cloudflare R2 (S3-kompatibilis) modul **létezik**, de a szabvány-PDF ingestion **nem használja** (csak a régi dokumentum-elemző funkcióhoz volt). |
| **Deploy** | Vercel (Hobby, fluid compute, 300s limit) + TiDB Cloud. Auto-deploy `git push`-ra. Éles: `https://compliance-checker-nu.vercel.app`. |
| **Futtatás** | `pnpm dev` (lokál, tsx watch), `pnpm build` (vite + esbuild), `pnpm test` (vitest, 84 teszt), `pnpm check` (tsc). |

**Futási környezet-korlát (kritikus a briefhez):** a Vercel serverless függvény **nem
alkalmas** nehéz ML/OCR-pipeline futtatására (memória- és időkorlát, nincs tartós
folyamat). Bármilyen PyMuPDF/OCR/BGE-m3/rerank feldolgozás **offline/batch** módon kell
fusson (a mérnöki iroda gépén vagy külön szerveren), a kész strukturált adatot a DB-be
írva; a Vercel-runtime csak olvassa. Lásd Q2.

## 2. Jelenlegi ingestion (PDF → kereshető adat)

Két úton kerülnek be szabványok, **ugyanazzal a maggal**:

- **PDF-feltöltés a UI-n** (`regulationSources.createFromPdf`) — a Jogszabályok oldalon.
- **Batch szkriptek** (`seed-tidb-pdfs.mjs`, `seed-eurocode.mjs`) — gitignore-oltak.

A lépések:

1. **Szöveg-kinyerés:** `extractFromPdf()` (`server/documentExtractor.ts`) — `pdf-parse`,
   a teljes dokumentum szövegét **egyetlen stringként** adja vissza. **Nincs oldal-,
   blokk- vagy pozíció-információ.**
2. **Ékezet-javítás:** `fixHungarianMojibake()` — a régi MSZ EN PDF-ek font-kódolási
   hibáit javítja (á→·, é→È stb.). Adatvezérelt térkép, a 32 szabványon validált. **Ez jól
   működik, megtartandó.**
3. **Darabolás:** `chunkText()` (`server/relevanceChunker.ts`) — **karakter-alapú, fix
   méretű, átfedő ablak** (embeddinghez 800/100, a régi compliance-elemzéshez 3000/300).
   **Mondat- és bekezdéshatárt figyelmen kívül hagy** → a chunk mondat közepén kezdődhet és
   végződhet. **Ez közvetlenül ütközik a brief 3. követelményével** (teljes kontextus).
4. **Embedding:** `chunkAndEmbed()` — OpenAI `text-embedding-3-small`, batch-elve (50/hívás).
5. **Tárolás:** `chunk_embeddings` tábla.

**A `chunk_embeddings` tábla tényleges oszlopai:**
`id, source_type, source_id, chunk_index, text, embedding (JSON), embedding_vec (VECTOR(1536), csak TiDB), created_at`.
→ **Nincs `page`, `bbox`, `node_id`, `section`, `heading`.** A `regulation_sources` tábla a
teljes szöveget (`content`), nevet, rövidkódot, szakterületet és sourceType-ot tárol —
**oldalszámot, kiadás-évet, szerkezetet nem.**

**Az eredeti PDF-bináris sehol nem tárolódik** — az ingestion kinyeri a szöveget, majd a
fájlt eldobja. (Az R2-modul kész, de erre nincs bekötve.)

## 3. Beégetett kérdések (a regressziós alapunk)

- **Hely:** `client/src/pages/StandardsSearchPage.tsx`, `exampleQuestions` tömb (jelenleg
  **7 kérdés**: acél kihajlás, csavaros kapcsolat, szélteher, hóteher, vasbeton, talajvizsgálat,
  tervezési alapelvek). Ezek **kliens-oldali, kattintható gyorsgombok** — kitöltik a keresőt
  és lefuttatják ugyanazt a `standardsSearch.search` hívást, mint a szabadszavas keresés.
- **Fontos tisztázás:** a rendszer **már ma is szabadszavas** — nincs „beégetett kérdés →
  beégetett válasz" leképezés. A gyorsgombok csak előre beírt kérdés-szövegek. A brief 1.
  követelménye (szabadszavas) tehát **elvben teljesül**, a probléma a *találat minősége és
  bizonyíthatósága*, nem a kérdés-bevitel.
- **Regresszióhoz megtartandók** — nem törlöm őket.

## 4. Betöltött dokumentumok

- **32 szabvány** (utolsó ellenőrzött állapot), **~8993 chunk-embedding**, mind a TiDB-ben,
  `embedding_vec` vektor-oszloppal. Kör: Eurocode 0/1/2/3/…/8 (MSZ EN 1990–1998) + acél/vasbeton/
  geotechnika/terhelések. Szakterület főleg `statika`.
- **Mind szöveges PDF** (van kimásolható szövegréteg — a kinyerés működött). **Szkennelt/OCR-t
  igénylő dokumentum jelenleg nincs.**
- **Amit NEM tudunk róluk a rendszerben:** kiadás-év (nincs `edition_year` mező),
  hatályosság (`in_force`/`supersedes` mező sincs), oldalszám (sem PDF-fizikai, sem nyomtatott),
  szerkezet (fejezet/szakasz/pont fa). A `name` szabadszöveg (pl. „MSZ EN 1992-1-1").
- A brief említ **OTÉK / TvMI / rendeleteket** is — ezek **jogszabály-struktúrájúak** (§,
  bekezdés, pont), a szabványoktól eltérő számozással. **Jelenleg egy sincs betöltve.**

## 5. Jelenlegi kereső és válaszösszeállítás

**Keresés (`server/routers/standardsSearch.ts`), hibrid:**
- **Kérdés-átírás** (`rewriteQuery`) — csak a válasz-kontextushoz (a keresés az EREDETI
  kérdéssel megy, mert az átírás rontott — ezt már mértük és javítottuk).
- **Lexikai ág:** `keywordSearch` — **egyszerű SQL `LIKE`** a `regulation_sources.content`-en.
  **Nincs magyar lemmatizálás, nincs BM25, nincs szinonima-szótár.** („nyírás" vs „nyíróerő"
  vs „V_Ed" ma nem kapcsolódik.)
- **Szemantikus ág:** `semanticSearch` — TiDB `VEC_COSINE_DISTANCE` a vektor-oszlopon
  (0,5–0,7 mp), JS-cosine fallbackkel (lokál MySQL).
- **Fúzió:** `mergeSearchSources` — Reciprocal Rank Fusion (K=60) + cím-boost + **semantic-top
  garancia** (a szemantikusan legjobb 4 chunk mindig bekerül). **Nincs dedikált neurális
  reranker.**
- **Jelölés/szimbólum exact keresés (`V_Rd,c`): nincs** (a brief kéri).

**Válasz (`generateStructuredAnswer`):**
- `gpt-4o-mini`, téma-tudatos prompt (a források tárgyáról szólnak-e), **önellenőrzés**
  (answerable + passed), **hallucináció-kapu** (ha a modell „nem fedik le"-t ír → tiszta
  figyelmeztetés), megbízhatóság-jelzés (high/medium/low).
- **Kimenet:** szabad Markdown-szöveg + `sources[]` tömb. A `SearchSource` típusban **van**
  `page?` és `chapter?` mező — **de ezeket a keresés soha nem tölti ki** (a chunkból nincs
  honnan), így a UI „N. oldal" sora gyakorlatilag sosem jelenik meg.
- **A brief kötött JSON-kimenete** (`answer_blocks[].chunk_ids`, `primary_hits[].deeplink`,
  `citation`, `no_result_reason`, külön `formulas/figures/tables/related`) **nincs meg** — a
  jelenlegi kimenet lazább, chunk-szintű bizonyíték-kötés nélkül.

## 6. Jelenlegi UI

- React 19 + wouter + tRPC. Fő oldalak: `StandardsSearchPage` (kereső + válasz + források +
  most már **riport-letöltés** nyomtatható PDF-be), `RegulationLibraryPage` (Jogszabályok:
  feltöltés, embedding, elavult-jelzés), `AdminPage` (keresési előzmények), `LoginPage`
  (magic-link + demo-jelszó).
- A találati kártya ma: dokumentumnév + relevancia% + kinyitható **nyers chunk-idézet**
  (`…részlet…`). **Nincs breadcrumb, nincs valódi oldalszám, nincs „ugrás a forráshoz",
  nincs beépített PDF-nézegető.** A `pdfjs-dist` **nincs** a függőségek közt.

## 7. Mit tartunk meg, mit cserélünk — a 6 üzleti követelmény tükrében

| # | Követelmény | Jelenlegi állapot | Teendő |
|---|---|---|---|
| 1 | Szabadszavas keresés | ✅ Már működik | Megtartani; a gyorsgombok maradnak |
| 2 | Fogalmi összefüggések (def/jelölés/képlet/ábra/kivétel) | ❌ Nincs gráf, nincs szimbólum-index, nincs ábra/képlet | **Új**: `symbols`, `edges`, asset-kinyerés |
| 3 | Teljes kontextus (bekezdéshatár + hierarchia) | ❌ Karakter-alapú, bekezdést vág, nincs hierarchia | **Csere**: struktúra-tudatos chunkolás |
| 4 | Oldalszám + mélylink | ❌ Nincs oldalszám, nincs PDF-viewer, nincs tárolt PDF | **Új**: oldal-térkép, PDF-hosting, PDF.js viewer |
| 5 | Idézhető hivatkozás | ⚠️ Van dokumentumnév, de nincs szakasz+oldal | **Bővítés**: szerkezet + oldalszám kell hozzá |
| 6 | Nulla hallucináció + chunk_id minden mondathoz | ⚠️ Van hallucináció-kapu + önellenőrzés, de **nincs mondat→chunk_id kötés** | **Bővítés**: kötött JSON, chunk_id-kötelező |

**Megtartandó (jól működik):** vektor-keresés a TiDB-n, RRF + semantic-top garancia,
ékezet-javítás, hallucináció-kapu/megbízhatóság-jelzés, a deploy- és auth-infrastruktúra,
a beégetett kérdések (regresszió).

**Cserélendő/kiegészítendő:** a teljes ingestion (parser + chunkolás + szerkezet + oldalszám
+ asset), az adatmodell (nodes/assets/symbols/edges), a lexikai ág (magyar lemmatizálás +
szótár), a válasz-kimenet (kötött JSON), a megjelenítés (találati kártya + PDF-viewer).

## 8. A célarchitektúra megvalósíthatósága ezen a stacken

A brief eszközei Python-világból valók. Ezen a Node/Vercel/TiDB stacken a reális út egy
**kétrétegű** felépítés:

- **Offline ingestion-réteg (ahol a nehéz munka történik):** itt van a helye a PyMuPDF/OCR/
  szerkezet-felismerés/ábra-kivágás/embedding feldolgozásnak. Két lehetőség: (a) **külön
  Python batch-pipeline**, amely a strukturált adatot a TiDB-be írja; (b) **Node-only**
  eszközök (pl. `pdfjs-dist` a szöveghez + pozícióhoz), gyengébb magyar nyelvi és képlet-
  kezeléssel. Ez a **Q1** döntés.
- **Runtime-réteg (Vercel):** a keresés (hibrid + rerank), a válasz-összeállítás (kötött
  JSON) és a PDF-viewer — ezek elférnek a serverlessen, HA a nehéz modellek nem itt futnak.
  A `bge-reranker` és a lokális embedding szintén Q1/Q4 döntés (felhő API vs offline).

**Adattár:** a brief SQLite-ot javasol; a projektnek **már van TiDB-je vektor-kereséssel**.
Javaslat: **a meglévő TiDB-t bővítjük** (`nodes`, `assets`, `symbols`, `edges` táblák), nem
vezetünk be külön SQLite-ot. (Q9)

**PDF-hosting a mélylinkhez:** a PDF.js viewernek szüksége van magára a PDF-fájlra. Ezeket
**hostolni kell** (R2-modul kész) — de a szabványok **szerzői jogvédettek**, ezért a teljes
PDF felhőbe töltése és megjelenítése **jogi döntés** (Q3).

## 9. Javasolt fázisozás (a brief szerint, ehhez a stackhez igazítva)

Feature flag: **`SEARCH_ENGINE=legacy|v2`** — a jelenlegi éles demó marad `legacy`, az új
motor `v2` mögött épül, amíg a kiértékelés nem igazolja, hogy jobb. (Egyetértés: Q10.)

1. **Ingestion újratervezés** — parser (oldal + pozíció + szerkezet), bekezdéshatáros
   chunkolás, oldalszám-térkép, idempotens cache. *(A legnagyobb, legkritikusabb blokk.)*
2. **Adatmodell + index** — `nodes/assets/symbols/edges`, magyar lemmatizálás + szótár,
   szimbólum-exact index, rerank.
3. **Lekérdezés + találatösszeállítás** — kötött JSON, chunk_id-kötés, gráfbővítés.
4. **Megjelenítés** — találati kártyák (breadcrumb, idézhető hivatkozás, miniatűrök) +
   PDF.js viewer kiemeléssel.
5. **Kiértékelő harness** — aranykészlet (beégetett + 30 szabadszavas), recall@10/MRR/
   hivatkozás-pontosság/kontextus-teljesség, legacy vs v2 összehasonlítás.

Minden fázis végén megállok, valós példát mutatok, jóváhagyást kérek.

---

## 10. Nyitott kérdések — kérlek, ezekre válaszolj

> Ezek nélkül nem tudok jól tervezni; nem akarok találgatni (a brief is ezt kéri).

**Q1 — Stack (a legfontosabb).** Elfogadható-e egy **különálló Python ingestion-pipeline**
(PyMuPDF, pdfplumber, huspacy, esetleg OCR/pix2tex) a jelenlegi Node-app mellett, amely a
strukturált adatot a közös TiDB-be írja? Vagy maradjon **minden Node/TypeScript** (gyengébb
PDF-struktúra- és magyar-nyelvi kezelés, de egységes stack)?

**Q2 — Hol fusson a nehéz feldolgozás?** A Vercel serverless erre nem alkalmas. Az offline
ingestion futhat: (a) a mérnöki iroda gépén batch-ként, (b) egy külön (mindig futó)
szerveren. Melyik a járható?

**Q3 — PDF-binárisok és szerzői jog.** A mélylinkes viewerhez az eredeti PDF-eket tárolni és
megjeleníteni kell. Jelenleg csak a kinyert szöveg van meg. Szabad-e a **teljes, szerzői
jogvédett szabvány-PDF-eket** felhőbe (R2) tölteni és a felületen megjeleníteni? Vagy csak
korlátozott (pl. csak az adott oldal képe, vízjelzve) megoldás mehet?

**Q4 — Felhő vs offline.** A jelenlegi embedding és válasz-LLM **OpenAI felhő**. A brief
offline-opciót kér (bizalmas dokumentumok). A demóhoz maradhat OpenAI, és az offline mód
(lokális embedding/LLM) későbbi fázis — vagy már most kötelező a lokális működés?

**Q5 — Oldalszám.** A mérnök a **nyomtatott** oldalszámra hivatkozik, ami a szabványoknál
eltér a PDF fizikai lapszámától. Elfogadható-e az automatikus eltolás-detektálás +
felülbírálható `documents.yaml`, vagy a kiadásonkénti eltolást a megbízó megadja?

**Q6 — Aranykészlet (kiértékelés).** A 30+ szabadszavas lekérdezéshez **a mérnök által
elvárt forráshelyek** kellenek (melyik szabvány, melyik szakasz, melyik oldal a helyes
találat). Ezeket **nem találhatom ki** — ki és mikor adja meg? (Én elkészítem a vázat.)

**Q7 — Demó-mérföldkő (hatókör).** A teljes célarchitektúra (gráf + ábrák + képletek + OCR +
rerank + PDF-viewer + export) nagy. Mi a **minimális, „használható és tesztelhető"**
mérföldkő a megbízónak? *Javaslatom:* struktúra-tudatos chunkolás + valódi oldalszám +
idézhető hivatkozás + PDF-viewer deeplinkkel — a fogalmi gráf, ábra/képlet-kivágás és OCR
későbbi fázis. Elfogadod ezt a sorrendet?

**Q8 — Dokumentum-kör.** A jelenlegi 32 mind Eurocode/MSZ EN (szabvány-struktúra). A brief
említ OTÉK/TvMI/rendeleteket is (jogszabály-struktúra: §/bekezdés/pont). Ezek is bejönnek a
v2-be, vagy előbb csak a szabványokra fókuszáljunk?

**Q9 — Adattár.** Egyetértesz, hogy a meglévő **TiDB-t bővítsük** az új táblákkal
(`nodes/assets/symbols/edges`), a brief SQLite-javaslata helyett? (A vektor-keresés már
TiDB-n van.)

**Q10 — Feature flag.** Rendben van, hogy a jelenlegi éles demó marad a `legacy` motor, és
az új `v2` a flag mögött épül, amíg a kiértékelés nem igazolja, hogy egyik metrikában sem
romlik?

---

## 11. Döntések (2026-08, a megbízóval egyeztetve)

- **Q1 → Hibrid stack.** Külön **Python ingestion-pipeline** (PyMuPDF stb.) állítja elő a
  strukturált adatot; a keresés/válasz/UI marad **Node/Vercel**. A közös tár a **TiDB**.
- **Q7 → „Bizonyíték-mag először".** Az első bemutatható mérföldkő: **struktúra-tudatos
  chunkolás (bekezdéshatár + hierarchia) + valódi oldalszám + idézhető hivatkozás +
  PDF-nézegető mélylinkkel/kiemeléssel.** A fogalmi gráf, ábra/képlet-kivágás, szimbólum-
  index és OCR **későbbi fázis**.
- **Q3 → Teljes PDF hostolható (R2).** Az eredeti PDF-ek az objektumtárba kerülnek, a viewer
  a pontos oldalt tölti be kiemeléssel.
- **Q4 → Marad OpenAI felhő** a demóhoz; a lokális/offline mód későbbi, konfigurálható opció.
- **Q9 → TiDB-bővítés** (feltételezve, megerősítendő): a meglévő TiDB-t bővítjük az új
  táblákkal, nem külön SQLite.
- **Q10 → `SEARCH_ENGINE=legacy|v2` flag** (feltételezve, megerősítendő): a jelenlegi demó
  marad `legacy`, a v2 a flag mögött épül.

**Fázis 1 hatóköre a döntések után:** Python parser (PyMuPDF) → szerkezet-fa (fejezet/
szakasz/pont) + bekezdéshatáros chunkok + PDF-fizikai és nyomtatott oldalszám + PDF feltöltés
R2-be. Ábra/képlet/OCR/szimbólum/gráf **nem** ebben a fázisban.

**Nyitva Fázis 1-hez:** Q2 (hol fusson a batch), Q5 (oldalszám-eltolás módja), Q8
(dokumentum-kör: csak szabványok, vagy OTÉK/TvMI is). Q6 (aranykészlet) csak a kiértékelő
fázishoz kell.
