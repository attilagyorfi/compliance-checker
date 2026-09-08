# Ingestion pipeline (v2, hivatkozás-központú kereső) — Fázis 1

Hibrid felállás: **Python parse-ol** (PyMuPDF, hálózat nélkül), **Node ír a TiDB-be +
embeddel** (mysql2 + OpenAI fetch). Ez azért kell, mert a Windows a venv `python.exe`
kimenő kapcsolatát a 4000-es TiDB-porton tiltja (WinError 10013), a Node viszont működik.

A legacy sémát (`regulation_sources` / `chunk_embeddings`) NEM érinti — a v2 külön
táblákban (`v2_documents`, `v2_nodes`, `v2_chunks`, `v2_embeddings`) él, a
`SEARCH_ENGINE=v2` flag mögé kerül majd.

## Előfeltételek
- Python 3.13 + venv: `python -m venv .venv && .venv/Scripts/pip install -r requirements.txt`
- Node (a repo-gyökér `.env`-jében: `TIDB_DATABASE_URL`, `OPENAI_API_KEY`).
- Eredeti PDF-ek: `../../client_anyag` és `../../client_anyag_uj`.

## Futtatás
```bash
# 1) PDF → strukturált JSON (ingestion/preview/<slug>.json), hálózat nélkül
ingestion/.venv/Scripts/python.exe ingestion/parse_all.py            # [--only 1992]

# 2) JSON → TiDB v2 táblák + embedding (a repo gyökeréből)
node ingestion/ingest-v2.mjs                                          # [--only 1992] [--schema-only]
```
Mindkét lépés idempotens (checksum-alapú skip; változásnál újraír). Slug szerint
dedupál (A1 módosítás, kiadás-év, „magyar" változat külön marad).

## Amit előállít
- **Szerkezet-fa**: fejezet → szakasz → alszakasz (számozás + tipográfia).
- **Bekezdéshatáros egységek** (`(n)` pont / bekezdés) — SOHA nem vág mondat közepén;
  ez a megjelenítés legkisebb egysége.
- **Két oldalszám**: PDF-fizikai lap + nyomtatott oldal (a fejlécből, auto-eltolással).
- **Kereső-ablakok**: a hosszú egységekből átfedő ablakok, mindegyikhez embedding
  (a megjelenítés mindig a TELJES egységet adja vissza).

## Fázis 1 hatókör — NINCS még benne
Ábra/képlet-kivágás, OCR (szkennelt PDF), szimbólum-index (`V_Rd,c`), fogalmi gráf,
rerank, PDF-nézegető. Ezek a következő fázisok.

## Ismert finomítandók
- Néhány eltérő tipográfiájú dokumentumnál a szerkezet-felismerés lapos (pl.
  `MSZ EN 1993-1-7`: 1 csomópont) — a font-alapú fejléc-heurisztika ott nem fog.
- A táblázatos szakaszok néha egy nagy egységbe torlódnak (a táblázat-fázis oldja meg).
- A ranking még nyers szemantikus — a magyar lemmatizálás + BM25 + rerank (Fázis 2–3)
  javítja.
