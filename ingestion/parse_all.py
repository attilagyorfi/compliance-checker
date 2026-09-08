"""
Batch-parser — Fázis 1 (hibrid felállás, Python-oldal).

Minden szabvány-PDF-et strukturált JSON-ná alakít (szerkezet-fa + bekezdéshatáros
egységek + oldalszámok), és a fájl checksum-jával együtt kiírja az
`ingestion/preview/<slug>.json` fájlba. HÁLÓZATOT NEM használ — az embeddinget és a
DB-írást a Node-oldali betöltő (ingest-v2.mjs) végzi (a Windows a venv python.exe
kimenő kapcsolatát a 4000-es TiDB-porton tiltja, a Node mysql2 viszont működik).

Slug (hivatalos azonosító) szerint dedupál — első nyer.

Használat:  python parse_all.py [--only 1992]
"""

import os
import re
import sys
import json
import glob
import hashlib

from parse_pdf import parse, make_slug

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "preview")
PDF_DIRS = [
    r"C:\Users\User\test_code\compliance_checker\client_anyag",
    r"C:\Users\User\test_code\compliance_checker\client_anyag_uj",
]


def slug_of(fname: str) -> str:
    return make_slug(fname)


def main():
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1].lower()
    os.makedirs(OUT, exist_ok=True)

    seen, files = set(), []
    for d in PDF_DIRS:
        for p in sorted(glob.glob(os.path.join(d, "*.pdf"))):
            fname = os.path.splitext(os.path.basename(p))[0]
            s = slug_of(fname)
            if only and only not in s.lower() and only not in fname.lower():
                continue
            if s in seen:
                print(f"  dedup: {fname}")
                continue
            seen.add(s); files.append(p)

    print(f"{len(files)} PDF feldolgozása…")
    for p in files:
        checksum = hashlib.sha256(open(p, "rb").read()).hexdigest()
        result = parse(p)
        result["document"]["checksum"] = checksum
        result["document"]["source_path"] = p
        out_path = os.path.join(OUT, result["document"]["slug"] + ".json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False)
        d = result["document"]
        print(f"  {d['official_id']}: {len(result['nodes'])} csomópont, "
              f"{len(result['chunks'])} egység, eltolás {d['printed_offset']} "
              f"(bizt {d['offset_confidence']})")
    print(f"\nKész. JSON-ok: {OUT}")


if __name__ == "__main__":
    main()
