"""
Szabvány-PDF strukturált feldolgozó — Fázis 1 (bizonyíték-mag).

Egy PDF-ből előállítja:
  - a szerkezet-fát (fejezet → szakasz → alszakasz), a számozásból + tipográfiából,
  - bekezdéshatáros egységeket (bekezdés / (n) pont), SOHA nem vágva mondat közepén,
  - dokumentumonkénti PDF-fizikai és NYOMTATOTT oldalszámot (a fejlécből detektálva),
  - stabil csomópont-azonosítókat (pl. MSZ_EN_1992_1_1__6.2.2).

Ábra/képlet/OCR/szimbólum/gráf NEM ebben a fázisban — csak a hivatkozás-mag.

Használat:
    python parse_pdf.py "<pdf út>" [--preview]

A PyMuPDF (a pdf-parse-szal ellentétben) tiszta magyar szöveget ad, ezért itt
nincs szükség ékezet-javításra.
"""

import sys
import re
import json
import os
from collections import Counter
import pymupdf

# ── Minták ──────────────────────────────────────────────────────────────────────
# Szakasz-fejléc: számozás (1, 6.2, 6.2.2) + cím. A záró pont opcionális.
RE_HEADING = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
# Számozott bekezdés/pont: (1), (7)P, (12)  — az Eurocode "P" = alapelv.
RE_CLAUSE = re.compile(r"^\((\d+)\)\s*(P)?\b")
# Fejléc/lábléc: a dokumentum-azonosító + nyomtatott oldalszám.
RE_HEADER_PAGE = re.compile(r"MSZ\s*E?N?[\d\-\.\s/]*:\s*\d{4}\s+(\d+)\b")
RE_STANDALONE_NUM = re.compile(r"^\s*(\d{1,4})\s*$")


def official_id_from_name(name: str) -> str:
    m = re.search(r"MSZ\s*E?N?E?\s*[\d\-\.]+(?::\d{4})?", name, re.I)
    return (m.group(0) if m else name).strip()


def make_slug(name: str) -> str:
    """Stabil slug az alap szabványszámból + a megkülönböztető utótagokból
    (A1/A2 módosítás, kiadás-év, 'magyar' változat). A leíró cím-szavakat
    (pl. 'Acelszerkezetek') elhagyja — azok ugyanaz a szabvány."""
    bm = re.search(r"MSZ\s*E?N?E?\s*[\d\-\.]+", name, re.I)
    base = bm.group(0) if bm else name
    rest = name[bm.end():] if bm else ""
    tokens = []
    # A '_' szóalkotó karakter, ezért a \b nem működik "_A1"/"_2002" előtt —
    # explicit szeparátor-osztályt használunk.
    yr = re.search(r"(?:^|[_\s/\-])((?:19|20)\d{2})(?=$|[_\s/\-.])", rest)
    if yr:
        tokens.append(yr.group(1))
    am = re.search(r"(?:^|[_\s/\-])A(\d+)(?=$|[_\s/\-.])", rest, re.I)
    if am:
        tokens.append("A" + am.group(1))
    if re.search(r"magyar|\bhu\b", rest, re.I):
        tokens.append("magyar")
    slug = base + ("_" + "_".join(tokens) if tokens else "")
    return re.sub(r"[^A-Za-z0-9]+", "_", slug).strip("_")


def node_id(doc_slug: str, number: str) -> str:
    return f"{doc_slug}__{number}"


def extract_lines(page):
    """Sorok listája: (text, max_font_size, y_top, is_bold) — fentről lefelé."""
    d = page.get_text("dict")
    lines = []
    for block in d.get("blocks", []):
        if block.get("type") != 0:  # 0 = szöveg
            continue
        for ln in block.get("lines", []):
            spans = ln.get("spans", [])
            if not spans:
                continue
            text = "".join(s["text"] for s in spans).strip()
            if not text:
                continue
            size = max(s["size"] for s in spans)
            # a pymupdf flags bit 4 (16) ~ félkövér a font neve alapján is
            bold = any(("bold" in s.get("font", "").lower()) or (s.get("flags", 0) & 16) for s in spans)
            y = min(s["bbox"][1] for s in spans)
            bbox = [
                min(s["bbox"][0] for s in spans), y,
                max(s["bbox"][2] for s in spans),
                max(s["bbox"][3] for s in spans),
            ]
            lines.append({"text": text, "size": round(size, 1), "y": y, "bold": bold, "bbox": bbox})
    lines.sort(key=lambda l: l["y"])
    return lines


def detect_printed_page(lines, page_height):
    """A nyomtatott oldalszám a fejlécből (dok-id + szám) vagy a margóban álló számból."""
    top = [l for l in lines if l["y"] < page_height * 0.12]
    bottom = [l for l in lines if l["y"] > page_height * 0.88]
    for l in top + bottom:
        m = RE_HEADER_PAGE.search(l["text"])
        if m:
            return int(m.group(1))
    for l in top + bottom:
        m = RE_STANDALONE_NUM.match(l["text"])
        if m:
            return int(m.group(1))
    return None


def is_header_footer(line, page_height):
    """Fejléc/lábléc sor-e (kihagyandó a törzsből)."""
    if line["y"] < page_height * 0.10 or line["y"] > page_height * 0.90:
        t = line["text"]
        if RE_HEADER_PAGE.search(t) or RE_STANDALONE_NUM.match(t) or "Mérnöki Iroda" in t:
            return True
    return False


def parse(pdf_path: str):
    doc = pymupdf.open(pdf_path)
    fname = os.path.splitext(os.path.basename(pdf_path))[0]
    doc_slug = make_slug(fname)

    # törzs-betűméret (medián-szerű mód) a fejléc-detektáláshoz
    size_counter = Counter()
    per_page = []
    for pno in range(doc.page_count):
        page = doc[pno]
        lines = extract_lines(page)
        ph = page.rect.height
        for l in lines:
            size_counter[l["size"]] += 1
        per_page.append((pno, lines, ph))
    body_size = size_counter.most_common(1)[0][0] if size_counter else 10.0

    # nyomtatott oldalszám + eltolás
    printed_by_page = {}
    for pno, lines, ph in per_page:
        p = detect_printed_page(lines, ph)
        if p is not None:
            printed_by_page[pno] = p
    offsets = Counter((pno + 1) - printed for pno, printed in printed_by_page.items())
    offset = offsets.most_common(1)[0][0] if offsets else 0
    offset_conf = (offsets.most_common(1)[0][1] / len(printed_by_page)) if printed_by_page else 0.0

    def printed_page(pno):
        if pno in printed_by_page:
            return printed_by_page[pno]
        return (pno + 1) - offset if offsets else None

    # szerkezet-fa + egységek
    nodes = []
    chunks = []
    node_by_number = {}
    cur_path = []          # aktív csomópontok (breadcrumb), (number, heading) párok
    cur_chunk = None

    def breadcrumb():
        return " › ".join(f"{n} {h}".strip() for n, h in cur_path)

    def flush():
        nonlocal cur_chunk
        if cur_chunk and cur_chunk["text"].strip():
            cur_chunk["text"] = re.sub(r"[ \t]+", " ", cur_chunk["text"]).strip()
            chunks.append(cur_chunk)
        cur_chunk = None

    for pno, lines, ph in per_page:
        body = [l for l in lines if not is_header_footer(l, ph)]
        for l in body:
            t = l["text"]
            mh = RE_HEADING.match(t)
            heading_like = bool(mh) and (l["size"] >= body_size + 0.4 or l["bold"]) and len(t) < 90
            if heading_like:
                number, heading = mh.group(1), mh.group(2).strip()
                # Kizárás 1: ábra/táblázat/kép feliratok — ezek NEM szerkezeti
                # csomópontok (későbbi fázisban asset-ek lesznek), és külön
                # (ábra-)számozási névtérbe tartoznak.
                is_caption = bool(re.match(r"^(ábr|t[áa]bl|k[ée]p|megjegyz|p[ée]ld|jelmagyar)", heading, re.I))
                # Kizárás 2: front-matter — évszám-"szám" vagy kisbetűvel kezdődő
                # "cím" (pl. "[2010] február", "[2] kiadás, 2010. április").
                is_meta = bool(re.fullmatch(r"(19|20)\d{2}", number)) or heading[:1].islower()
                if not is_caption and not is_meta:
                    flush()
                    depth = number.count(".") + 1
                    cur_path = cur_path[: depth - 1]
                    cur_path.append((number, heading))
                    node = {
                        "id": node_id(doc_slug, number),
                        "type": "chapter" if depth == 1 else "section",
                        "number": number, "heading": heading, "depth": depth,
                        "pdf_page": pno + 1, "printed_page": printed_page(pno),
                        "breadcrumb": breadcrumb(),
                    }
                    nodes.append(node)
                    node_by_number[number] = node
                    continue
                # kizárt "fejléc" → a törzshöz csapjuk (lásd lentebb)
            # SZÁMOZOTT BEKEZDÉS / PONT: új egység
            mc = RE_CLAUSE.match(t)
            if mc:
                flush()
                cur_chunk = {
                    "id": f"{doc_slug}__{cur_path[-1][0] if cur_path else '0'}__({mc.group(1)}){mc.group(2) or ''}",
                    "unit": "clause", "clause_no": mc.group(1),
                    "breadcrumb": breadcrumb(),
                    "node_number": cur_path[-1][0] if cur_path else None,
                    "pdf_page": pno + 1, "printed_page": printed_page(pno),
                    "bbox": l["bbox"], "text": t,
                }
                continue
            # törzs: folytatás vagy önálló bekezdés
            if cur_chunk:
                cur_chunk["text"] += " " + t
                # A bbox a bekezdés SORAINAK UNIÓJA (a kezdő oldalon), hogy a
                # kiemelés a teljes szakaszt fedje, ne csak az első sort/jelölőt.
                # Lapváltásnál nem bővítünk (a koordináták a másik lap terében vannak).
                if cur_chunk.get("pdf_page") == pno + 1:
                    b, nb = cur_chunk["bbox"], l["bbox"]
                    cur_chunk["bbox"] = [min(b[0], nb[0]), min(b[1], nb[1]),
                                         max(b[2], nb[2]), max(b[3], nb[3])]
            else:
                cur_chunk = {
                    "id": f"{doc_slug}__{cur_path[-1][0] if cur_path else '0'}__p{len(chunks)}",
                    "unit": "paragraph", "clause_no": None,
                    "breadcrumb": breadcrumb(),
                    "node_number": cur_path[-1][0] if cur_path else None,
                    "pdf_page": pno + 1, "printed_page": printed_page(pno),
                    "bbox": l["bbox"], "text": t,
                }
    flush()
    doc.close()

    return {
        "document": {
            "title": fname, "official_id": official_id_from_name(fname),
            "slug": doc_slug, "page_count": len(per_page),
            "printed_offset": offset, "offset_confidence": round(offset_conf, 2),
            "pages_with_printed_num": len(printed_by_page),
        },
        "nodes": nodes,
        "chunks": chunks,
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Használat: python parse_pdf.py <pdf>"); sys.exit(1)
    result = parse(sys.argv[1])
    out_dir = os.path.join(os.path.dirname(__file__), "preview")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, result["document"]["slug"] + ".json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    d = result["document"]
    print(f"OK: {d['official_id']} | {d['page_count']} oldal | "
          f"{len(result['nodes'])} csomópont | {len(result['chunks'])} egység | "
          f"oldalszám-eltolás={d['printed_offset']} (bizt={d['offset_confidence']}, "
          f"{d['pages_with_printed_num']} oldalon talált nyomtatott számot)")
    print(f"JSON: {out_path}")
