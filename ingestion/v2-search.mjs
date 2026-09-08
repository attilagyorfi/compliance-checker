/**
 * V2 hibrid keresés-harness — Fázis 2 (ranking).
 *
 * Szemantikus (vektor) + lexikai (magyar szótövezés + szinonima-szótár) ág,
 * Reciprocal Rank Fusion-nel egyesítve, a szakasz-fejléc (breadcrumb) enyhe
 * boostjával. A találat a TELJES bekezdés-egység, pontos hivatkozással.
 *
 * Most mérő-eszköz (CLI): összeveti a tiszta szemantikus alapvonalat a hibriddel
 * néhány ellenőrző kérdésen. A Fázis 3-ban a `hybridSearch()` a tRPC-be kerül a
 * SEARCH_ENGINE=v2 flag mögé.
 *
 * Futtatás a repo gyökeréből:  node ingestion/v2-search.mjs
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { parse as parseYaml } from "yaml";
import pkg from "snowball-stemmers";
const { newStemmer } = pkg;

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const KEY = process.env.OPENAI_API_KEY;
const BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, "");
const EMB = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const stemmer = newStemmer("hungarian");

// ── szótár + szótövezés ─────────────────────────────────────────────────────────
const groups = parseYaml(readFileSync(path.join(HERE, "synonyms.yaml"), "utf-8")).groups;
const docRules = parseYaml(readFileSync(path.join(HERE, "documents.yaml"), "utf-8")).rules;
const stem = (w) => stemmer.stem(w.toLowerCase());
const tokens = (s) => (s.toLowerCase().match(/[\p{L}\p{N}_,]+/gu) || []).filter((t) => t.length >= 3);
// téma-szabályok: a topic-kulcsszavak szótövei → official_id részszöveg
const docRuleStems = docRules.map((r) => ({
  match: r.match, stems: new Set(r.topics.flatMap((t) => tokens(t).map(stem))),
}));
// csoportonként a tagok szótövei (aktiváláshoz) + a nyers tagok (lexikai illesztéshez)
const groupStems = groups.map((g) => ({
  id: g.id, terms: g.terms,
  stems: new Set(g.terms.flatMap((t) => tokens(t).map(stem))),
}));

function expandQuery(query) {
  const qTokens = tokens(query);
  const qStems = new Set(qTokens.map(stem));
  const lexTerms = new Set();
  const activeGroups = [];
  for (const g of groupStems) {
    if ([...qStems].some((s) => g.stems.has(s))) {
      activeGroups.push(g.id);
      g.terms.forEach((t) => lexTerms.add(t.toLowerCase()));
    }
  }
  // a nyers kérdés-szavak is lexikai tagok (a szótáron kívüli fogalmakra)
  qTokens.filter((t) => t.length >= 4).forEach((t) => lexTerms.add(t));
  // jelölés-tokenek (V_Rd,c) exact-illesztéshez
  const symbols = (query.match(/[A-Za-z]+_?[A-Za-z]*(?:,[a-z]+)?/g) || []).filter((s) => /[A-Z].*_|_.*,/.test(s));
  symbols.forEach((s) => lexTerms.add(s.toLowerCase()));
  return { lexTerms: [...lexTerms], activeGroups, qStems: [...qStems] };
}

async function embed(text) {
  const r = await fetch(`${BASE}/v1/embeddings`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: EMB, input: text }),
  });
  return (await r.json()).data[0].embedding;
}

const RERANK_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

/**
 * LLM-alapú újrarangsorolás (kereszt-kódoló): a jelöltek közül a kérdésre
 * legjobban válaszolókat sorolja előre. A modell CSAK rangsorol, tartalmat nem
 * gyárt. Hiba esetén az eredeti sorrend marad (csendes fallback tilos → jelöljük).
 */
async function rerankLLM(query, candidates) {
  const list = candidates.map((c, i) =>
    `[${i}] ${c.breadcrumb ? c.breadcrumb + " — " : ""}${(c.text || "").replace(/\s+/g, " ").slice(0, 320)}`
  ).join("\n");
  try {
    const r = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: RERANK_MODEL, max_completion_tokens: 200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Mérnöki szabvány-kereső újrarangsoroló. A megadott szövegrészletek közül rangsorold azokat, amelyek a legjobban, KÖZVETLENÜL megválaszolják a kérdést. Ügyelj a kérdés tárgyára (pl. "acél" → acélszabvány, ne betonszabvány). Adj vissza JSON-t: {"order":[indexek csökkenő relevancia szerint]}. Csak a legfeljebb 8 legjobb indexet sorold.` },
          { role: "user", content: `Kérdés: "${query}"\n\nSzövegrészletek:\n${list}` },
        ],
      }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const order = JSON.parse(j.choices?.[0]?.message?.content ?? "{}").order;
    if (!Array.isArray(order)) throw new Error("nincs order");
    const seen = new Set();
    const ranked = order.filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length && !seen.has(i) && seen.add(i)).map((i) => candidates[i]);
    // a modell által ki nem választottakat a végére fűzzük (nem dobjuk el)
    candidates.forEach((c, i) => { if (!seen.has(i)) ranked.push(c); });
    return ranked;
  } catch {
    return candidates; // fallback: eredeti sorrend
  }
}

const RRF_K = 60;
function rrf(rankLists, weights) {
  const score = new Map();
  rankLists.forEach((list, li) => {
    list.forEach((id, rank) => {
      score.set(id, (score.get(id) || 0) + (weights[li] || 1) / (RRF_K + rank));
    });
  });
  return score;
}

/**
 * Hibrid keresés. Visszaadja a top-K egységet (teljes bekezdés + hivatkozás).
 * A `semanticOnly` az alapvonal méréséhez.
 */
export async function hybridSearch(conn, query, { topK = 8, semanticOnly = false, rerank = false } = {}) {
  const { lexTerms } = expandQuery(query);

  // 1) szemantikus: vektor-keresés az ablakokon → egységenként a legjobb táv
  const qv = await embed(query);
  const [semRows] = await conn.query(
    `SELECT chunk_id, MIN(VEC_COSINE_DISTANCE(embedding_vec, ?)) dist
     FROM v2_embeddings GROUP BY chunk_id ORDER BY dist LIMIT 40`, [JSON.stringify(qv)]);
  const semRanked = semRows.map((r) => r.chunk_id);

  if (semanticOnly) {
    return hydrate(conn, semRanked.slice(0, topK), query);
  }

  // 2) lexikai: a bővített tagokra illeszkedő egységek, találat-szám szerint
  let lexRanked = [];
  if (lexTerms.length) {
    const likeSql = lexTerms.map(() => "LOWER(text) LIKE ?").join(" OR ");
    const params = lexTerms.map((t) => `%${t}%`);
    const [lexRows] = await conn.query(
      `SELECT id, breadcrumb, text FROM v2_chunks WHERE ${likeSql} LIMIT 400`, params);
    // pontszám: hány DISTINCT tag illeszkedik + enyhe fejléc-boost
    const scored = lexRows.map((r) => {
      const hay = (r.text + " " + (r.breadcrumb || "")).toLowerCase();
      let hits = 0, headHits = 0;
      for (const t of lexTerms) {
        if (hay.includes(t)) hits++;
        if ((r.breadcrumb || "").toLowerCase().includes(t)) headHits++;
      }
      return { id: r.id, score: hits + headHits * 0.5 };
    }).sort((a, b) => b.score - a.score);
    lexRanked = scored.map((s) => s.id);
  }

  // 3) RRF fúzió (a szemantikus kap kicsit nagyobb súlyt)
  const fused = rrf([semRanked, lexRanked], [1.0, 0.9]);

  // 4) dokumentum-téma boost: mely szabvány-családok illenek a kérdés témájához?
  const { qStems } = expandQuery(query);
  const qStemSet = new Set(qStems);
  const wantedMatches = docRuleStems
    .filter((r) => [...r.stems].some((s) => qStemSet.has(s)))
    .map((r) => r.match);

  // a fúziós jelöltek dokumentumának official_id-ja (a boosthoz)
  const cand = [...fused.keys()];
  const officialById = new Map();
  if (cand.length && wantedMatches.length) {
    const [orows] = await conn.query(
      `SELECT ch.id, d.official_id FROM v2_chunks ch JOIN v2_documents d ON d.id=ch.doc_id
       WHERE ch.id IN (${cand.map(() => "?").join(",")})`, cand);
    orows.forEach((r) => officialById.set(r.id, r.official_id || ""));
  }
  const boosted = cand.map((id) => {
    let s = fused.get(id);
    if (wantedMatches.length) {
      const oid = officialById.get(id) || "";
      if (wantedMatches.some((m) => oid.includes(m))) s *= 1.6; // témába vágó szabvány
    }
    return [id, s];
  });

  boosted.sort((a, b) => b[1] - a[1]);
  // rerank esetén szélesebb jelölt-halmazt hidratálunk, majd az LLM rangsorol
  const take = rerank ? Math.max(topK, 12) : topK;
  const hydrated = await hydrate(conn, boosted.slice(0, take).map(([id]) => id), query);
  if (!rerank) return hydrated.slice(0, topK);
  const reranked = await rerankLLM(query, hydrated);
  return reranked.slice(0, topK);
}

async function hydrate(conn, ids, query) {
  if (!ids.length) return [];
  const [rows] = await conn.query(
    `SELECT ch.id, ch.breadcrumb, ch.clause_no, ch.node_key, ch.printed_page, ch.pdf_page,
            ch.text, d.official_id, d.edition_year, d.slug
     FROM v2_chunks ch JOIN v2_documents d ON d.id=ch.doc_id WHERE ch.id IN (${ids.map(() => "?").join(",")})`, ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean).map((r) => ({
    ...r,
    citation: `${r.official_id}${r.edition_year ? ":" + r.edition_year : ""}` +
      (r.node_key ? `, ${r.node_key}. szakasz` : "") + (r.clause_no ? ` (${r.clause_no}) bek.` : "") +
      `, ${r.printed_page}. o.`,
  }));
}

// ── CLI: alapvonal vs hibrid összevetés ellenőrző kérdéseken ──────────────────────
const CHECK = [
  ["nyírás", "1992-1-1|1993|1994"],
  ["acél oszlop kihajlás", "1993-1-1"],
  ["szélteher számítása", "1991-1-4"],
  ["hóteher a tetőn", "1991-1-3"],
  ["vasbeton gerenda nyírási vasalása", "1992-1-1"],
  ["keresztmetszet osztályozás", "1993-1-1"],
  ["acél fáradás vizsgálat", "1993-1-9"],
  ["földrengésre méretezés", "1998"],
];

async function main() {
  const conn = await mysql.createConnection({
    uri: process.env.TIDB_DATABASE_URL, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  });
  const hit = (res, exp) => {
    const re = new RegExp(exp, "i");
    const idx = res.findIndex((r) => re.test(r.official_id) || re.test(r.slug));
    return idx < 0 ? "—" : `top-${idx + 1}`;
  };
  console.log("kérdés | szem. | hibrid | +RERANK | rerank top-1 hivatkozás");
  console.log("-".repeat(105));
  let semOK = 0, hybOK = 0, rrOK = 0;
  const in3 = (x) => x.startsWith("top-") && +x.slice(4) <= 3;
  for (const [q, exp] of CHECK) {
    const base = await hybridSearch(conn, q, { semanticOnly: true });
    const hyb = await hybridSearch(conn, q, {});
    const rr = await hybridSearch(conn, q, { rerank: true });
    const b = hit(base, exp), h = hit(hyb, exp), r = hit(rr, exp);
    if (in3(b)) semOK++; if (in3(h)) hybOK++; if (in3(r)) rrOK++;
    console.log(`${q.padEnd(34)} | ${b.padEnd(5)} | ${h.padEnd(6)} | ${r.padEnd(7)} | ${rr[0]?.citation ?? "-"}`);
  }
  console.log("-".repeat(105));
  console.log(`Várt szabvány TOP-3-ban: szemantikus ${semOK}/${CHECK.length}, hibrid ${hybOK}/${CHECK.length}, +rerank ${rrOK}/${CHECK.length}`);
  await conn.end();
}

if (process.argv[1] && process.argv[1].endsWith("v2-search.mjs")) main();
