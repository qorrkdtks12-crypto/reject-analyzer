function _normalizeCell(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function _parseCsvLine(line, delimiter) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(_normalizeCell(current));
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(_normalizeCell(current));
  return cells;
}

function _parseDelimitedRows(rawText, delimiter) {
  const normalized = String(rawText || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .map((line) => _parseCsvLine(line, delimiter))
    .filter((row) => row.some((cell) => cell.trim()));
}

function _detectDelimiter(ext, mime, rawText) {
  const e = String(ext || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  if (e === "tsv" || m.includes("tab-separated-values")) return "\t";
  const firstLine = String(rawText || "").split(/\r?\n/, 1)[0] || "";
  return firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
}

export function isDelimitedFile(ext, mime) {
  const e = String(ext || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  return (
    e === "csv" ||
    e === "tsv" ||
    m === "text/csv" ||
    m === "application/csv" ||
    m === "text/tab-separated-values" ||
    m.includes("csv")
  );
}

export function formatDelimitedText({ rawText, name, ext, mime, maxRows = 200, maxColumns = 40 }) {
  const delimiter = _detectDelimiter(ext, mime, rawText);
  const fileType = delimiter === "\t" ? "TSV" : "CSV";
  const rows = _parseDelimitedRows(rawText, delimiter)
    .map((row) => row.slice(0, maxColumns));

  if (!rows.length || !rows.some((row) => row.some((cell) => cell.trim()))) {
    return {
      text: "",
      fileType,
      rowCount: 0,
      columnCount: 0,
      warnings: ["CSV에서 읽을 수 있는 텍스트가 거의 없어요. 파일을 다시 저장하거나 주요 표를 복사해 붙여넣어 주세요."],
    };
  }

  const visibleRows = rows.slice(0, maxRows);
  const tableText = visibleRows
    .map((row) => row.map((cell) => cell || "-").join(" | "))
    .join("\n");
  const warnings = [];
  if (rows.length > visibleRows.length) {
    warnings.push(`표가 길어서 처음 ${visibleRows.length.toLocaleString()}행만 가져왔어요.`);
  }

  return {
    text: [
      `파일명: ${name || "file"}`,
      `파일 유형: ${fileType}`,
      "추출 내용:",
      tableText,
    ].join("\n"),
    fileType,
    rowCount: rows.length,
    columnCount: Math.max(...rows.map((row) => row.length)),
    warnings,
  };
}
