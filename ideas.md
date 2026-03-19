# Tervmegfelelőség-ellenőrző – Design Ötletek

<response>
<text>
## 1. ötlet: Mérnöki Precizitás / Technical Blueprint

**Design Movement:** Industrial Modernism – Bauhaus-inspired precision meets contemporary engineering software

**Core Principles:**
- Fehér dominancia, strukturált rács, precíz vonalak
- Minden elem funkcionális célt szolgál, dekoráció minimális
- Adatok és státuszok vizuálisan azonnal érthetők
- Az M Mérnöki arculat (#7CA9D3 acélkék, #161718 sötét) következetesen érvényesül

**Color Philosophy:**
- Alap: #FFFFFF fehér háttér
- Elsődleges: #7CA9D3 (acélkék – az M Mérnöki brand szín)
- Sötét: #161718 (header, hangsúlyos szöveg)
- Szürke skála: #F5F5F5, #E8E8E8, #9CA3AF
- Státuszok: #22C55E (megfelel), #EAB308 (bizonytalan), #EF4444 (nem felel meg)

**Layout Paradigm:**
- Bal oldali fix navigáció (sidebar) + jobb oldali tartalom
- Feltöltési oldal: középre igazított, nagy whitespace, drag-and-drop zóna
- Eredmény oldal: kártyás grid, szűrősáv felül

**Signature Elements:**
- Vékony acélkék vízszintes vonal szekciók között
- Kártyák: fehér háttér, enyhe árnyék, bal oldali színes sáv (státusz szerint)
- Header: sötét (#161718) háttér, fehér szöveg, M Mérnöki logó

**Interaction Philosophy:**
- Hover: enyhe emelkedés (box-shadow növekedés)
- Drag-and-drop: kék keret megjelenése
- Progress: animált vonal/sáv

**Animation:**
- Kártyák: fade-in + slide-up belépéskor
- Progress bar: smooth fill animáció
- Státusz badge: scale-in animáció

**Typography System:**
- Heading: Open Sans Bold/SemiBold (a brand fontja)
- Body: Open Sans Regular
- Monospace: JetBrains Mono (szabályhivatkozásokhoz)
</text>
<probability>0.08</probability>
</response>

<response>
<text>
## 2. ötlet: Dokumentum-orientált / Document Office

**Design Movement:** Swiss International Style – tiszta grid, tipográfia-vezérelt hierarchia

**Core Principles:**
- A dokumentum maga a főszereplő
- Kétoszlopos layout: bal dokumentum-lista, jobb tartalom
- Minden elem a dokumentumfeldolgozás metaforáját követi

**Color Philosophy:**
- Papírfehér (#FAFAFA) alap
- Sötétkék (#1E3A5F) header és hangsúlyok
- Acélkék (#7CA9D3) linkek és akcentusok
- Halványszürke (#F0F0F0) kártyák háttere

**Layout Paradigm:**
- Dokumentum-explorer bal oldalt (lista nézet)
- Részletes eredmény jobb oldalt (olvasható, tagolt)
- Felül: breadcrumb navigáció

**Signature Elements:**
- Dokumentum-ikon animáció feltöltéskor
- Táblázatos összefoglaló a riport tetején
- Szabályhivatkozások footnote stílusban

**Interaction Philosophy:**
- Kattintásra kinyíló részletek (accordion)
- Szűrés státusz szerint (tab bar)

**Animation:**
- Dokumentum "lapozás" animáció feldolgozáskor
- Accordion smooth expand/collapse

**Typography System:**
- Heading: Source Serif Pro (dokumentum jelleg)
- Body: Open Sans
</text>
<probability>0.06</probability>
</response>

<response>
<text>
## 3. ötlet: Dashboard Pro / Engineering Command Center

**Design Movement:** Enterprise SaaS – professzionális belső eszköz, adatvezérelt

**Core Principles:**
- Kompakt, információsűrű layout
- Gyors áttekinthetőség: összesítő számok felül, részletek alul
- Professzionális, bizalomkeltő megjelenés

**Color Philosophy:**
- Fehér (#FFFFFF) fő háttér
- Világosszürke (#F8FAFC) szekció háttér
- Acélkék (#7CA9D3) elsődleges akció
- Sötét (#161718) navigáció

**Layout Paradigm:**
- Top navigation bar (M Mérnöki logóval)
- Kétlépéses flow: Feltöltés → Eredmény
- Eredmény oldalon: összesítő kártyák + részletes lista

**Signature Elements:**
- Összesítő statisztika kártyák (megfelel/bizonytalan/nem felel meg számok)
- Státusz badge-ek bal oldali sávval
- PDF export gomb prominensen

**Interaction Philosophy:**
- Minden kártyán expand/collapse
- Szűrés és keresés az eredményekben

**Animation:**
- Counter animáció az összesítő számoknál
- Smooth scroll az eredményekhez

**Typography System:**
- Open Sans (brand font) végig
- Különböző súlyok a hierarchiához
</text>
<probability>0.09</probability>
</response>

---

## Választott design: **3. ötlet – Dashboard Pro / Engineering Command Center**

Ez a megközelítés a legjobban illeszkedik az M Mérnöki Iroda professzionális, mérnöki karakteréhez, és a legjobb demózhatóságot biztosítja. A top navigation, az összesítő kártyák és a részletes eredménylista együtt adja a legmeggyőzőbb pilot élményt.
