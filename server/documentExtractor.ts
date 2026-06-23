/**
 * Document text extractor – supports PDF, DOCX, XLSX, DWG/DXF, IFC, RTF, images.
 * All extractors return plain text suitable for LLM processing.
 */

import type { DocumentFileType } from "../drizzle/schema";

// ── File type detection ────────────────────────────────────────────────────────

export function detectFileType(filename: string, mimeType?: string): DocumentFileType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const mime = mimeType?.toLowerCase() ?? "";

  if (ext === "pdf" || mime.includes("pdf")) return "pdf";
  if (ext === "docx" || mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";
  if (ext === "doc") return "docx"; // treat .doc as docx (mammoth handles both)
  if (ext === "xlsx" || ext === "xls" || mime.includes("spreadsheetml") || mime.includes("excel")) return "xlsx";
  if (ext === "dwg") return "dwg";
  if (ext === "dxf") return "dxf";
  if (ext === "ifc") return "ifc";
  if (ext === "rtf") return "rtf";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(ext)) return "jpg";
  return "other";
}

/**
 * Detect the engineering discipline from filename and content hints.
 */
export function detectDiscipline(filename: string, textSample?: string): string {
  const lower = (filename + " " + (textSample ?? "")).toLowerCase();

  if (/tűzv|otsz|tvmi|tűzjelz|sprinkler|tűzoltó|tűzgát/.test(lower)) return "tuzvedelmi";
  if (/statik|tartószerkezet|vasbeton|acélszerkezet|eurocode|alapozás|geotechnik/.test(lower)) return "statika";
  if (/energetik|hőátbocsátás|u-érték|ep-érték|tanúsítvány|tnm|hőszigete/.test(lower)) return "energetika";
  if (/gépészet|fűtés|szellőzés|vízvezeték|csatorna|hvac|klíma/.test(lower)) return "gepeszet";
  if (/villamos|elektromos|erősáram|gyengeáram|mérőhely/.test(lower)) return "villamos";
  if (/közlekedés|parkoló|útcsatlakozás|forgalom/.test(lower)) return "kozlekedes";
  if (/tájépítész|zöldfelület|tereprendezés|növény/.test(lower)) return "tajepiteszet";
  if (/geotechnik|talajmechanik|fúrás|rétegsor/.test(lower)) return "geotechnika";
  if (/építészet|alaprajz|homlokzat|metszet|helyszínrajz/.test(lower)) return "epiteszet";
  return "altalanos";
}

// ── Text extractors ────────────────────────────────────────────────────────────

/**
 * Extract text from a PDF buffer using pdf-parse.
 */
export async function extractFromPdf(buffer: Buffer): Promise<string> {
  try {
    // pdf-parse v2 API: a `PDFParse` osztály, nem default függvény. A korábbi
    // `(pdfModule as any).default ?? pdfModule` hívás v2-vel TypeError-t dobott,
    // ami a catch-ágon latin1-szemetet adott vissza a tényleges PDF-szöveg
    // helyett — csendes minőségromlás. Ez a helyes osztály-alapú használat.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  } catch (err) {
    console.warn("[DocumentExtractor] PDF extraction failed:", err);
    // Fallback: extract printable ASCII (csak végszükség esetén — ez ritka,
    // jelzésértékű, és az OCR-detektálás amúgy is rövid szövegként kezeli).
    return buffer
      .toString("latin1")
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s{3,}/g, "\n")
      .slice(0, 50000);
  }
}

/**
 * Extract text from a DOCX/DOC buffer using mammoth.
 */
export async function extractFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err) {
    console.warn("[DocumentExtractor] DOCX extraction failed:", err);
    return "";
  }
}

/**
 * Extract text from an XLSX/XLS buffer using xlsx.
 */
export async function extractFromXlsx(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const lines: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet);
      lines.push(`=== Munkalap: ${sheetName} ===`);
      lines.push(csv.slice(0, 10000)); // limit per sheet
    }
    return lines.join("\n\n");
  } catch (err) {
    console.warn("[DocumentExtractor] XLSX extraction failed:", err);
    return "";
  }
}

/**
 * Extract text from a DWG/DXF file.
 * DWG is binary – we extract any readable text strings.
 * DXF is ASCII-based – we extract TEXT and MTEXT entities.
 */
export async function extractFromDwgDxf(buffer: Buffer, fileType: "dwg" | "dxf"): Promise<string> {
  try {
    const content = buffer.toString("utf8");

    if (fileType === "dxf") {
      // DXF: extract TEXT and MTEXT entity values
      const lines = content.split("\n");
      const textValues: string[] = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const code = lines[i]?.trim();
        const value = lines[i + 1]?.trim();
        // Group code 1 = primary text value, code 3 = additional text
        if ((code === "1" || code === "3") && value && value.length > 1) {
          textValues.push(value);
        }
      }
      return textValues.join("\n").slice(0, 30000);
    } else {
      // DWG binary: extract printable ASCII strings (min 4 chars)
      const printable = buffer
        .toString("latin1")
        .replace(/[^\x20-\x7E\n\r\t]/g, "\0")
        .split("\0")
        .filter((s) => s.trim().length >= 4)
        .join("\n");
      return printable.slice(0, 30000);
    }
  } catch (err) {
    console.warn("[DocumentExtractor] DWG/DXF extraction failed:", err);
    return "";
  }
}

/**
 * Extract metadata and text from an IFC file.
 * IFC is ASCII-based (STEP format) – we extract property sets and descriptions.
 */
export async function extractFromIfc(buffer: Buffer): Promise<string> {
  try {
    const content = buffer.toString("utf8");
    const lines = content.split("\n");
    const extracted: string[] = [];

    // Extract FILE_DESCRIPTION, FILE_NAME, FILE_SCHEMA header
    const headerLines = lines.slice(0, 20).join("\n");
    extracted.push("=== IFC Fejléc ===");
    extracted.push(headerLines);

    // Extract IFCPROJECT, IFCBUILDING, IFCBUILDINGSTOREY names
    const entityPatterns = [
      /IFCPROJECT\s*\([^)]*'([^']+)'/gi,
      /IFCBUILDING\s*\([^)]*'([^']+)'/gi,
      /IFCBUILDINGSTOREY\s*\([^)]*'([^']+)'/gi,
      /IFCSPACE\s*\([^)]*'([^']+)'/gi,
      /IFCPROPERTYSINGLEVALUE\s*\('([^']+)'/gi,
    ];

    extracted.push("\n=== IFC Entitások ===");
    for (const pattern of entityPatterns) {
      const matches = Array.from(content.matchAll(pattern));
      for (const match of matches.slice(0, 50)) {
        if (match[1]) extracted.push(match[1]);
      }
    }

    return extracted.join("\n").slice(0, 30000);
  } catch (err) {
    console.warn("[DocumentExtractor] IFC extraction failed:", err);
    return "";
  }
}

/**
 * Extract text from an RTF buffer by stripping RTF control codes.
 */
export async function extractFromRtf(buffer: Buffer): Promise<string> {
  try {
    const content = buffer.toString("latin1");
    // Strip RTF control words and groups
    const stripped = content
      .replace(/\\[a-z]+[-]?\d*\s?/gi, " ")
      .replace(/[{}\\]/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return stripped.slice(0, 30000);
  } catch (err) {
    console.warn("[DocumentExtractor] RTF extraction failed:", err);
    return "";
  }
}

// ── Main dispatcher ────────────────────────────────────────────────────────────

export interface ExtractionResult {
  text: string;
  fileType: DocumentFileType;
  discipline: string;
  characterCount: number;
  warning?: string;
}

/**
 * Extract text from any supported document type.
 */
export async function extractDocumentText(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<ExtractionResult> {
  const fileType = detectFileType(filename, mimeType);
  let text = "";
  let warning: string | undefined;

  switch (fileType) {
    case "pdf":
      text = await extractFromPdf(buffer);
      break;
    case "docx":
      text = await extractFromDocx(buffer);
      break;
    case "xlsx":
      text = await extractFromXlsx(buffer);
      break;
    case "dwg":
    case "dxf":
      text = await extractFromDwgDxf(buffer, fileType);
      break;
    case "ifc":
      text = await extractFromIfc(buffer);
      break;
    case "rtf":
      text = await extractFromRtf(buffer);
      break;
    case "jpg":
    case "png":
      text = `[Képfájl: ${filename} – szöveges tartalom nem elérhető]`;
      warning = "Képfájlból szöveg nem nyerhető ki automatikusan.";
      break;
    default:
      // Try generic ASCII extraction
      text = buffer
        .toString("latin1")
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s{3,}/g, "\n")
        .slice(0, 20000);
      warning = "Ismeretlen fájltípus – általános szövegkinyerés alkalmazva.";
  }

  const discipline = detectDiscipline(filename, text.slice(0, 2000));

  return {
    text: text.trim(),
    fileType,
    discipline,
    characterCount: text.length,
    warning,
  };
}
