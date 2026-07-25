// src/lib/extract/extractTextFromFile.node.js
// Node.js implementation of extractTextFromFile.
// Supports: TXT (fs.readFile), DOCX (mammoth), PDF (pdfjs-dist/legacy)
//
// @param {string} file  - absolute or relative file path
// @param {"jd" | "resume"} kind
//
// Return shape (same as browser):
// { ok, text, meta: { kind, mime, ext, charCount, warnings: [], confidenceHint, extractBranch } }
//
// Failure codes:
//   TXT_EXTRACT_FAILED   — fs.readFile error or empty after normalize
//   DOCX_EXTRACT_FAILED  — mammoth error
//   DOCX_PARSE_ERROR     — mammoth parse-level error
//   PDF_EXTRACT_FAILED   — pdfjs error
//   PDF_PARSE_ERROR      — invalid/corrupt PDF
//   UNSUPPORTED_FORMAT   — ext not in txt/docx/pdf

import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { formatDelimitedText } from "./formatDelimitedText.js";
import { buildResumeImportQuality } from "../resume/buildResumeImportQuality.js";

// keep in sync with extractTextFromFile.browser.js
function _ext(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function _normalizeText(t) {
  if (!t) return "";
  return String(t)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function _extractTxt(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  return { text: _normalizeText(raw), warnings: [] };
}

async function _extractDocx(filePath) {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default || mammothModule;
  const res = await mammoth.extractRawText({ path: filePath });
  const text = _normalizeText(res?.value || "");
  const warnings = [];
  if (Array.isArray(res?.messages) && res.messages.length) {
    warnings.push("DOCX 변환 과정에서 일부 서식이 유실되었을 수 있어요.");
  }
  return { text, warnings };
}

async function _extractPdf(filePath) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // Node.js requires a valid workerSrc — resolve worker file as a file:// URL
  if (pdfjs?.GlobalWorkerOptions) {
    try {
      const _require = createRequire(import.meta.url);
      const workerPath = _require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
    } catch {
      // fallback: attempt empty string (older pdfjs versions)
      pdfjs.GlobalWorkerOptions.workerSrc = "";
    }
  }

  const data = new Uint8Array(await fs.readFile(filePath));
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;

  let fullText = "";
  const warnings = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = (content?.items || [])
      .map((it) => (typeof it?.str === "string" ? it.str.replace(/\u0000/g, "") : ""))
      .filter((s) => s.length > 0);
    fullText += strings.join(" ") + "\n\n";
  }

  const text = _normalizeText(fullText);
  const pages = pdf.numPages || 0;
  if (pages >= 2 && text.length < 350) {
    warnings.push("PDF에서 텍스트가 거의 추출되지 않았어요. 스캔(이미지) PDF일 수 있어요.");
  }
  return { text, warnings, pages };
}

const _MIME_BY_EXT = {
  txt: "text/plain",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
};

const _ERROR_BY_BRANCH = {
  txt: "TXT_EXTRACT_FAILED",
  docx: "DOCX_EXTRACT_FAILED",
  pdf: "PDF_EXTRACT_FAILED",
  csv: "CSV_EXTRACT_FAILED",
  tsv: "CSV_EXTRACT_FAILED",
};

export async function extractTextFromFile(file, kind) {
  const filePath = String(file || "");
  const name = path.basename(filePath);
  const ext = _ext(name);
  const mime = _MIME_BY_EXT[ext] || "";

  const meta = {
    kind: kind || null,
    name,
    mime,
    ext,
    charCount: 0,
    warnings: [],
    confidenceHint: "unknown",
    extractBranch: "unsupported",
    failureStage: null,
    textSource: "local",
    transportOk: undefined,
    failureReason: null,
    failureMessage: null,
  };

  const _fail = (errorCode, message, stage) => {
    meta.failureStage = stage || "local-extract";
    meta.failureReason = errorCode;
    meta.failureMessage = message || errorCode;
    const quality = buildResumeImportQuality({ text: "", meta, kind: kind || "resume", ok: false });
    meta.extractionQuality = quality.extractionQuality;
    meta.sectionSummary = quality.sectionSummary;
    meta.layoutHints = quality.layoutHints;
    return { ok: false, text: "", error: errorCode, message: message || errorCode, meta };
  };

  try {
    let text = "";

    if (ext === "csv" || ext === "tsv") {
      meta.extractBranch = ext;
      const raw = await fs.readFile(filePath, "utf-8");
      const r = formatDelimitedText({ rawText: raw, name, ext, mime });
      text = _normalizeText(r.text);
      meta.tableRowCount = r.rowCount;
      meta.tableColumnCount = r.columnCount;
      meta.warnings.push(...(r.warnings || []));
      meta.confidenceHint = text.length > 100 ? "high" : "low";
    } else if (ext === "txt") {
      meta.extractBranch = "txt";
      const r = await _extractTxt(filePath);
      text = r.text;
      meta.warnings.push(...r.warnings);
      meta.confidenceHint = "high";
    } else if (ext === "docx") {
      meta.extractBranch = "docx";
      const r = await _extractDocx(filePath);
      text = r.text;
      meta.warnings.push(...r.warnings);
      meta.confidenceHint = text.length > 500 ? "high" : "medium";
    } else if (ext === "pdf") {
      meta.extractBranch = "pdf";
      const r = await _extractPdf(filePath);
      text = r.text;
      meta.warnings.push(...r.warnings);
      if (r.pages != null) meta.pages = r.pages;
      meta.confidenceHint = text.length > 800 ? "medium" : "low";
    } else {
      meta.warnings.push("Unsupported file format. Supported (Node): PDF, DOCX, TXT, CSV, TSV.");
      return _fail("UNSUPPORTED_FORMAT", "Unsupported file format", "type-detect");
    }

    meta.charCount = text.length;

    if (meta.charCount > 0 && meta.charCount < 200) {
      meta.warnings.push("추출된 텍스트가 너무 짧아요. 내용 누락 여부를 확인해 주세요.");
    }

    if (!text.trim()) {
      const errorCode = _ERROR_BY_BRANCH[meta.extractBranch] || "FILE_READ_FAILED";
      meta.warnings.push("파일에서 텍스트를 추출하지 못했어요. 내용이 없는 파일일 수 있어요.");
      return _fail(errorCode, "Empty text after extraction", "empty-text");
    }

    meta.failureStage = null;
    meta.failureReason = null;
    meta.failureMessage = null;
    const quality = buildResumeImportQuality({ text, meta, kind: kind || "resume", ok: true });
    meta.extractionQuality = quality.extractionQuality;
    meta.sectionSummary = quality.sectionSummary;
    meta.layoutHints = quality.layoutHints;
    return { ok: true, text, meta };

  } catch (e) {
    const msg = String(e?.message || e || "");
    meta.warnings.push(`파일에서 텍스트를 추출하는 중 오류가 발생했어요. (${msg.slice(0, 120)})`);
    meta.failureMessage = msg.slice(0, 200);

    // classify specific parse errors
    if (meta.extractBranch === "pdf" && /invalid pdf|formaterror|unexpected end/i.test(msg)) {
      return _fail("PDF_PARSE_ERROR", msg.slice(0, 120), "local-extract");
    }
    if (meta.extractBranch === "docx" && /mammoth|not a valid zip/i.test(msg)) {
      return _fail("DOCX_PARSE_ERROR", msg.slice(0, 120), "local-extract");
    }

    const errorCode = _ERROR_BY_BRANCH[meta.extractBranch] || "FILE_READ_FAILED";
    return _fail(errorCode, msg.slice(0, 120) || errorCode, "local-extract");
  }
}
