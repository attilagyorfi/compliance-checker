/**
 * V2 hibrid keresés (szerver-oldal) — Fázis 3.
 *
 * A Fázis 2-ben mért kereső-réteg beépítve a tRPC-be, a `SEARCH_ENGINE=v2` flag
 * mögé. Szemantikus (vektor) + lexikai (magyar szótövezés + szinonima-szótár) ág,
 * RRF-fúzió, dokumentum-téma boost, majd LLM cross-encoder rerank. A találat a
 * TELJES bekezdés-egység, pontos, idézhető hivatkozással.
 *
 * A legacy keresőt (standardsSearch.search) nem érinti. Csak a v2_* táblákból
 * olvas. Node/Vercel-kompatibilis (nincs Python runtime).
 */

import { sql } from "drizzle-orm";
import stemmerPkg from "snowball-stemmers";
import { getDb } from "../db";
import { getEmbedding } from "../embeddings";
import { invokeLLM } from "../_core/llm";
import { synonymGroups, docRules } from "./config.generated";

const stemmer = stemmerPkg.newStemmer("hungarian");
const stem = (w: string) => stemmer.stem(w.toLowerCase());
// Magyar-tudatos tokenizálás unicode property escape nélkül (a szerver tsconfig
// célja nem támogatja a \p{L}/u mintát) — explicit magyar karakter-osztály.
const tokenize = (s: string) =>
  (s.toLowerCase().match(/[a-z0-9áéíóöőúüű_,]+/gi) || []).filter((t) => t.length >= 3);

// előfeldolgozott csoport-/szabály-szótövek
const groupStems = synonymGroups.map((g) => ({
  terms: g.terms,
  stems: new Set(g.terms.flatMap((t) => tokenize(t).map(stem))),
}));
const ruleStems = docRules.map((r) => ({
  match: r.match,
  stems: new Set(r.topics.flatMap((t) => tokenize(t).map(stem))),
}));

export interface EvidenceHit {
  chunkId: number;
  breadcrumb: string;
  sectionNumber: string | null;
  clauseNo: string | null;
  printedPage: number | null;
  pdfPage: number | null;
  text: string;
  officialId: string;
  editionYear: number | null;
  slug: string;
  citation: string;
}

function expandQuery(query: string) {
  const qStems = new Set(tokenize(query).map(stem));
  const qStemArr = Array.from(qStems);
  const lexTerms = new Set<string>();
  for (const g of groupStems) {
    if (qStemArr.some((s) => g.stems.has(s))) g.terms.forEach((t) => lexTerms.add(t.toLowerCase()));
  }
  tokenize(query).filter((t) => t.length >= 4).forEach((t) => lexTerms.add(t));
  const wantedMatches = ruleStems.filter((r) => Array.from(r.stems).some((s) => qStems.has(s))).map((r) => r.match);
  return { lexTerms: Array.from(lexTerms), wantedMatches };
}

const RRF_K = 60;

/** DB rows kinyerése a drizzle mysql2 execute [rows, fields] alakjából. */
function rows<T = Record<string, unknown>>(res: unknown): T[] {
  const r = Array.isArray(res) ? (res[0] as unknown) : res;
  return Array.isArray(r) ? (r as T[]) : [];
}

export async function hybridSearchV2(
  query: string,
  opts: { topK?: number; rerank?: boolean } = {}
): Promise<EvidenceHit[]> {
  const { topK = 8, rerank = true } = opts;
  const db = await getDb();
  if (!db) return [];
  const { lexTerms, wantedMatches } = expandQuery(query);

  // 1) szemantikus: vektor-keresés az ablakokon → egységenként legjobb táv
  const qv = await getEmbedding(query);
  if (!qv) return [];
  const lit = JSON.stringify(qv);
  const semRes = await db.execute(sql`
    SELECT chunk_id AS chunkId, MIN(VEC_COSINE_DISTANCE(embedding_vec, ${lit})) dist
    FROM v2_embeddings GROUP BY chunk_id ORDER BY dist LIMIT 40`);
  const semRanked = rows<{ chunkId: number }>(semRes).map((r) => Number(r.chunkId));

  // 2) lexikai: a bővített tagokra illeszkedő egységek, találat-szám szerint
  let lexRanked: number[] = [];
  if (lexTerms.length) {
    const likeParts = lexTerms.map((t) => sql`LOWER(text) LIKE ${"%" + t + "%"}`);
    const lexRes = await db.execute(sql`
      SELECT id, breadcrumb, text FROM v2_chunks WHERE ${sql.join(likeParts, sql` OR `)} LIMIT 400`);
    const scored = rows<{ id: number; breadcrumb: string; text: string }>(lexRes).map((r) => {
      const hay = (r.text + " " + (r.breadcrumb || "")).toLowerCase();
      const bc = (r.breadcrumb || "").toLowerCase();
      let hits = 0, head = 0;
      for (const t of lexTerms) { if (hay.includes(t)) hits++; if (bc.includes(t)) head++; }
      return { id: Number(r.id), score: hits + head * 0.5 };
    }).sort((a, b) => b.score - a.score);
    lexRanked = scored.map((s) => s.id);
  }

  // 3) RRF fúzió (a szemantikus kicsit nagyobb súllyal)
  const fused = new Map<number, number>();
  const add = (list: number[], w: number) =>
    list.forEach((id, rank) => fused.set(id, (fused.get(id) || 0) + w / (RRF_K + rank)));
  add(semRanked, 1.0);
  add(lexRanked, 0.9);
  if (fused.size === 0) return [];

  // 4) dokumentum-téma boost
  const cand = Array.from(fused.keys());
  if (wantedMatches.length) {
    const oidRes = await db.execute(sql`
      SELECT ch.id, d.official_id AS oid FROM v2_chunks ch JOIN v2_documents d ON d.id = ch.doc_id
      WHERE ch.id IN (${sql.join(cand.map((i) => sql`${i}`), sql`,`)})`);
    const oidById = new Map(rows<{ id: number; oid: string }>(oidRes).map((r) => [Number(r.id), r.oid || ""]));
    for (const id of cand) {
      const oid = oidById.get(id) || "";
      if (wantedMatches.some((m) => oid.includes(m))) fused.set(id, (fused.get(id) as number) * 1.6);
    }
  }

  const ranked = Array.from(fused.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const take = rerank ? Math.max(topK, 12) : topK;
  let hits = await hydrate(db, ranked.slice(0, take));
  if (rerank) hits = await rerankLLM(query, hits);
  return hits.slice(0, topK);
}

async function hydrate(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ids: number[]): Promise<EvidenceHit[]> {
  if (!ids.length) return [];
  const res = await db.execute(sql`
    SELECT ch.id, ch.breadcrumb, ch.clause_no AS clauseNo, ch.node_key AS nodeKey,
           ch.printed_page AS printedPage, ch.pdf_page AS pdfPage, ch.text,
           d.official_id AS officialId, d.edition_year AS editionYear, d.slug
    FROM v2_chunks ch JOIN v2_documents d ON d.id = ch.doc_id
    WHERE ch.id IN (${sql.join(ids.map((i) => sql`${i}`), sql`,`)})`);
  const byId = new Map<number, EvidenceHit>();
  for (const r of rows<Record<string, unknown>>(res)) {
    const nodeKey = (r.nodeKey as string) || null;
    const officialId = (r.officialId as string) || "";
    const editionYear = r.editionYear != null ? Number(r.editionYear) : null;
    const clauseNo = (r.clauseNo as string) || null;
    const printedPage = r.printedPage != null ? Number(r.printedPage) : null;
    const citation =
      `${officialId}${editionYear ? ":" + editionYear : ""}` +
      (nodeKey ? `, ${nodeKey}. szakasz` : "") +
      (clauseNo ? ` (${clauseNo}) bek.` : "") +
      (printedPage != null ? `, ${printedPage}. o.` : "");
    byId.set(Number(r.id), {
      chunkId: Number(r.id),
      breadcrumb: (r.breadcrumb as string) || "",
      sectionNumber: nodeKey,
      clauseNo,
      printedPage,
      pdfPage: r.pdfPage != null ? Number(r.pdfPage) : null,
      text: (r.text as string) || "",
      officialId,
      editionYear,
      slug: (r.slug as string) || "",
      citation,
    });
  }
  return ids.map((id) => byId.get(id)).filter((x): x is EvidenceHit => Boolean(x));
}

/** LLM cross-encoder rerank — csak rangsorol, tartalmat nem gyárt. Hibánál marad az eredeti sorrend. */
async function rerankLLM(query: string, cands: EvidenceHit[]): Promise<EvidenceHit[]> {
  if (cands.length <= 1) return cands;
  const list = cands.map((c, i) =>
    `[${i}] ${c.breadcrumb ? c.breadcrumb + " — " : ""}${c.text.replace(/\s+/g, " ").slice(0, 320)}`
  ).join("\n");
  try {
    const resp = await invokeLLM({
      messages: [
        { role: "system", content: `Mérnöki szabvány-kereső újrarangsoroló. A szövegrészletek közül rangsorold azokat, amelyek KÖZVETLENÜL megválaszolják a kérdést. Ügyelj a kérdés tárgyára (pl. "acél" → acélszabvány, ne betonszabvány). Válasz JSON: {"order":[indexek csökkenő relevancia szerint]}. Legfeljebb 8 indexet sorolj.` },
        { role: "user", content: `Kérdés: "${query}"\n\nSzövegrészletek:\n${list}` },
      ],
      response_format: { type: "json_object" },
    });
    const content = resp.choices?.[0]?.message?.content;
    const order = JSON.parse(typeof content === "string" ? content : "{}").order;
    if (!Array.isArray(order)) return cands;
    const seen = new Set<number>();
    const ranked: EvidenceHit[] = [];
    for (const i of order) {
      if (Number.isInteger(i) && i >= 0 && i < cands.length && !seen.has(i)) { seen.add(i); ranked.push(cands[i]!); }
    }
    cands.forEach((c, i) => { if (!seen.has(i)) ranked.push(c); });
    return ranked;
  } catch {
    return cands;
  }
}
