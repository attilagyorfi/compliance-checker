/**
 * DEP0169 (url.parse deprecation) célzott elnyomása.
 *
 * Egy tranzitív függőség (a better-auth / cookie-kezelés láncában) a Node régi
 * `url.parse()`-ját hívja, ami DEP0169 deprecation-warningot vált ki. A
 * figyelmeztetés ártalmatlan — a válaszok helyesek —, de a Vercel a runtime-
 * logban "error" szintre emeli, ami félrevezető. Itt KIZÁRÓLAG ezt az egy
 * figyelmeztetést nyomjuk el; minden más warning változatlanul megjelenik.
 *
 * Ezt a modult a szerver-belépőknek LEGELSŐKÉNT kell importálniuk.
 */

const originalEmitWarning = process.emitWarning.bind(process);

(process as unknown as { emitWarning: typeof process.emitWarning }).emitWarning = ((
  warning: string | Error,
  ...args: unknown[]
) => {
  const opts = args[0];
  const code =
    opts && typeof opts === "object" && "code" in opts
      ? (opts as { code?: string }).code
      : typeof args[1] === "string"
        ? args[1]
        : undefined;
  const text = typeof warning === "string" ? warning : warning?.message ?? "";
  if (code === "DEP0169" || text.includes("url.parse()")) return;
  return (originalEmitWarning as (...a: unknown[]) => void)(warning, ...args);
}) as typeof process.emitWarning;
