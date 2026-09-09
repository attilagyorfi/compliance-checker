/**
 * Config-generátor — a szerkeszthető YAML-ekből (synonyms.yaml + documents.yaml)
 * egy TypeScript modult ír: server/v2/config.generated.ts.
 *
 * Miért: a runtime Vercel-serverless bundle (esbuild) nem olvas tetszőleges
 * repo-fájlt fs-sel; egy importált TS-modul viszont tisztán bundle-özik (tsc,
 * tsx, esbuild egyaránt). A mérnökök a YAML-t szerkesztik, majd:
 *     node ingestion/gen-config.mjs
 * (a build is lefuttatja, lásd package.json).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const REPO = path.join(HERE, "..");
const groups = parse(readFileSync(path.join(HERE, "synonyms.yaml"), "utf-8")).groups;
const rules = parse(readFileSync(path.join(HERE, "documents.yaml"), "utf-8")).rules;

const out = `// AUTOMATIKUSAN GENERÁLT — NE SZERKESZD.
// Forrás: ingestion/synonyms.yaml + ingestion/documents.yaml
// Újragenerálás: node ingestion/gen-config.mjs
export interface SynonymGroup { id: string; terms: string[]; }
export interface DocRule { match: string; topics: string[]; }

export const synonymGroups: SynonymGroup[] = ${JSON.stringify(groups, null, 2)};

export const docRules: DocRule[] = ${JSON.stringify(rules, null, 2)};
`;

const target = path.join(REPO, "server", "v2", "config.generated.ts");
writeFileSync(target, out, "utf-8");
console.log(`Generálva: ${target} (${groups.length} szinonima-csoport, ${rules.length} dok-szabály)`);
