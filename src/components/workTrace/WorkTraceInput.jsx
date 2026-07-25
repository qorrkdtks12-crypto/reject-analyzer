// src/components/workTrace/WorkTraceInput.jsx
// Main input UI for work trace paste/upload → AI experience extraction.
import { useCallback, useEffect, useRef, useState } from "react";
import { extractTextFromFile } from "@/lib/extract/extractTextFromFile.js";
import { extractExperienceCandidates } from "@/lib/workTrace/extractExperienceCandidates.js";
import ExperienceCandidateReview from "./ExperienceCandidateReview.jsx";

const ACCEPTED_TYPES = ".pdf,.docx,.txt,.csv,.tsv,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,application/csv,text/tab-separated-values,image/png,image/jpeg,image/webp";

const AI_CONVERSATION_SAMPLE_TEXT = [
  "이번 주에는 CS 문의를 유형별로 분류하고 FAQ 문구를 정리했습니다.",
  "반복 질문 답변 시간을 줄이기 위해 상담팀과 공유했고, 다음 주에는 배송 지연 문의까지 같은 방식으로 정리하기로 했습니다.",
].join("\n");

const WORK_TRACE_SAMPLE_TEXT = [
  "월요일에는 정기 회의에서 고객 문의 증가 원인을 공유했고, FAQ 문구를 수정했습니다.",
  "수요일에는 상담팀과 반복 문의 기준을 맞췄고, 금요일에는 주간보고에 처리 결과와 다음 액션을 정리했습니다.",
].join("\n");

// ─── Pending review preservation (survives login redirect) ─────────────────
// Restores an in-progress analysis result that was preserved before a login
// round-trip. sessionStorage only, TTL-bound — never persisted long-term.
const DEFAULT_INPUT_SOURCE_TYPE = "manual_work_log";
const COMPOSER_PLACEHOLDER = "오늘 한 일, 카톡/슬랙 대화, 회의록, 업무보고, 서비스 URL을 그대로 붙여넣어 주세요.";
const COMPOSER_HELPER_TEXT = "선택하지 않아도 괜찮아요. PASSMAP이 내용에서 업무 맥락을 찾아드립니다.";

const INPUT_SOURCE_OPTIONS = [
  {
    id: "manual_work_log",
    label: "직접 업무 기록",
    helperText: "오늘 한 일, 회의 내용, 고객 대응처럼 기억나는 업무 흔적을 그대로 적어주세요.",
    placeholder: "예: 이번 주 고객 문의 12건을 유형별로 분류하고, 반복 문의 대응 기준과 FAQ 문구를 정리했습니다.",
    ctaLabel: "경험 초안 만들기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "conversation_text",
    label: "카톡/슬랙 등 대화형 텍스트",
    helperText: "업무 대화 내용을 붙여넣고, 내가 실제로 한 일과 결정한 내용을 함께 남겨주세요.",
    placeholder: "예: 슬랙/카톡 대화에서 업무와 관련된 부분을 붙여넣고, 내가 맡은 역할이나 처리한 일을 덧붙여주세요.",
    ctaLabel: "대화에서 경험 추출하기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "meeting_document",
    label: "회의록 PDF / Word",
    helperText: "회의록 파일을 첨부하거나 주요 내용을 붙여넣어 주세요. 파일·이미지 첨부 버튼을 사용할 수 있고, 내 액션 아이템이 드러날수록 좋습니다.",
    placeholder: "예: 회의록의 핵심 논의, 내가 맡은 후속 작업, 결정된 일정과 결과를 붙여넣어주세요.",
    ctaLabel: "회의록에서 경험 추출하기",
    inputMethod: "file",
    sourceMode: "work_trace",
  },
  {
    id: "spreadsheet_task_list",
    label: "엑셀 업무 리스트",
    helperText: "CSV/TSV 파일을 첨부하거나 주요 행과 열을 복사해 붙여넣을 수 있어요. 엑셀 파일은 CSV로 저장해 올리면 가장 안정적으로 읽을 수 있어요.",
    placeholder: "예: 엑셀의 업무명, 담당 역할, 상태, 결과 열을 복사해서 붙여넣어주세요.",
    ctaLabel: "업무 리스트에서 경험 만들기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "notion",
    label: "노션",
    helperText: "Notion 연동은 아직 준비 중입니다. 지금은 페이지 내용을 복사해서 붙여넣어 주세요.",
    placeholder: "예: Notion 업무 페이지의 목표, 작업 내용, 결과, 회고를 복사해서 붙여넣어주세요.",
    ctaLabel: "노션에서 경험 정리하기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "erp_csv",
    label: "ERP 내려받은 CSV",
    helperText: "ERP에서 내려받은 CSV/TSV 파일을 첨부하거나 주요 행과 열을 그대로 붙여넣을 수 있어요.",
    placeholder: "예: ERP에서 내려받은 업무명, 처리일, 담당자, 상태, 결과 열을 붙여넣어주세요.",
    ctaLabel: "CSV에서 경험 추출하기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "project_settlement",
    label: "프로젝트 정산표",
    helperText: "정산표를 CSV/TSV로 저장해 첨부하거나 내가 맡은 검수, 정리, 조율, 개선 내용을 중심으로 붙여넣어 주세요. 엑셀 파일은 CSV로 저장해 올리면 가장 안정적으로 읽을 수 있어요.",
    placeholder: "예: 프로젝트 정산 항목, 이슈, 조정 내용, 최종 결과를 붙여넣어주세요.",
    ctaLabel: "정산표에서 경험 만들기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "customer_voc",
    label: "고객 VOC 리스트",
    helperText: "VOC CSV/TSV 파일을 첨부하거나 원문과 함께 분류, 대응, 개선 제안처럼 내가 한 일을 남겨주세요.",
    placeholder: "예: 고객 VOC 목록과 내가 분류한 기준, 대응 방식, 개선 결과를 붙여넣어주세요.",
    ctaLabel: "VOC에서 경험 정리하기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "weekly_report",
    label: "주간업무 보고서",
    helperText: "주간업무 보고서 파일이나 CSV/TSV 표를 첨부할 수 있어요. 진행 업무, 성과, 이슈, 다음 액션을 그대로 넣어주세요.",
    placeholder: "예: 이번 주 진행 업무, 완료 결과, 협업 내용, 다음 주 계획을 붙여넣어주세요.",
    ctaLabel: "주간보고에서 경험 만들기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "image_screenshot",
    label: "이미지 / 스크린샷",
    helperText: "파일·이미지 첨부 버튼으로 올릴 수 있습니다. 인식이 부족하면 텍스트를 함께 붙여넣어 주세요.",
    placeholder: "예: 스크린샷에서 확인되는 업무 상황과 내가 처리한 내용을 설명해 주세요.",
    ctaLabel: "이미지에서 경험 추출하기",
    inputMethod: "file",
    sourceMode: "work_trace",
  },
  {
    id: "service_url",
    label: "웹/앱 서비스 URL",
    helperText: "URL 크롤링은 아직 하지 않습니다. 링크와 내가 맡은 역할을 함께 입력해 경험으로 정리합니다.",
    placeholder: "예: URL을 붙여넣고, 해당 서비스/화면에서 내가 기획·개선·운영한 내용을 설명해 주세요.",
    ctaLabel: "URL에서 경험 정리하기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
  {
    id: "audio_recording",
    label: "상담/회의 녹음",
    helperText: "오디오 분석은 준비 중입니다. 지금은 회의 전사 텍스트나 요약을 붙여넣어 주세요.",
    placeholder: "예: 상담/회의 녹음의 주요 대화, 내가 결정하거나 처리한 내용, 결과를 텍스트로 붙여넣어주세요.",
    ctaLabel: "녹음에서 경험 추출하기",
    inputMethod: "text",
    sourceMode: "work_trace",
  },
];

function getInputSourceDisplayLabel(id, fallback) {
  switch (id) {
    case "manual_work_log":
      return "자동 감지";
    case "conversation_text":
      return "카톡/슬랙 대화";
    case "meeting_document":
      return "회의록";
    case "spreadsheet_task_list":
      return "업무 리스트/엑셀";
    case "erp_csv":
      return "ERP CSV";
    case "notion":
      return "Notion";
    case "project_settlement":
      return "프로젝트 정산표";
    case "customer_voc":
      return "VOC/고객 문의";
    case "weekly_report":
      return "주간업무 보고서";
    case "image_screenshot":
      return "이미지/스크린샷";
    case "service_url":
      return "URL";
    case "audio_recording":
      return "녹음 전사";
    default:
      return fallback;
  }
}

const AI_CONVERSATION_INPUT_CONFIG = {
  helperText: "ChatGPT, Claude, Gemini 등 AI와 나눈 업무 대화는 내부적으로 AI 대화 전용 흐름으로 분석합니다.",
  placeholder: "ChatGPT, Gemini, Claude와 나눈 업무 대화를 붙여넣어 주세요. 내가 실제로 한 일과 결정한 내용을 함께 남기면 더 정확합니다.",
  ctaLabel: "AI 대화에서 경험 초안 만들기",
};

const FILE_EMPHASIS_SOURCE_TYPES = new Set([
  "meeting_document",
  "spreadsheet_task_list",
  "erp_csv",
  "project_settlement",
  "customer_voc",
  "weekly_report",
  "image_screenshot",
]);

const INTEGRATION_TOOLS = [
  { name: "Google Calendar", status: "연결 가능" },
  { name: "Gmail / 네이버메일", status: "준비 중" },
  { name: "Notion", status: "준비 중" },
  { name: "Slack", status: "준비 중" },
  { name: "GitHub / Jira", status: "준비 중" },
  { name: "Google Drive", status: "준비 중" },
  { name: "Figma", status: "준비 중" },
  { name: "ERP / 그룹웨어", status: "후순위" },
];

const PENDING_REVIEW_KEY = "PASSMAP_PENDING_WORK_TRACE_REVIEW";
const PENDING_REVIEW_TTL_MS = 60 * 60 * 1000; // 1 hour

function clearPendingWorkTraceReview() {
  try { sessionStorage.removeItem(PENDING_REVIEW_KEY); } catch (_) {}
}

function loadPendingWorkTraceReview() {
  let parsed;
  try {
    const raw = sessionStorage.getItem(PENDING_REVIEW_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || parsed.version !== 1 || typeof parsed.savedAt !== "number") {
    clearPendingWorkTraceReview();
    return null;
  }
  if (Date.now() - parsed.savedAt > PENDING_REVIEW_TTL_MS) {
    clearPendingWorkTraceReview();
    return null;
  }
  return parsed;
}

// ─── External intake (e.g. browser extension selection) ───────────────────
// Receives a payload that an external tool wrote into sessionStorage so the
// AI conversation tab can auto-populate without a copy/paste step. Strict
// validation + 1h TTL. The key is consumed (removed) on successful restore.
const EXTERNAL_INTAKE_KEY = "PASSMAP_EXTERNAL_INTAKE";
const EXTERNAL_INTAKE_TTL_MS = 60 * 60 * 1000; // 1 hour
const EXTERNAL_INTAKE_MIN_RAW_TEXT_LENGTH = 30;
const VALID_EXTERNAL_INTAKE_SOURCE_MODES = new Set(["work_trace", "ai_conversation"]);
const VALID_EXTERNAL_INTAKE_IMPORT_METHODS = new Set([
  "manual_paste_or_txt",
  "browser_extension_selection",
  "browser_extension_current_conversation",
]);
const VALID_EXTERNAL_INTAKE_SOURCE_PLATFORMS = new Set([
  "manual",
  "chatgpt",
  "claude",
  "gemini",
  "browser_extension",
]);
const DEFAULT_IMPORT_METHOD = "manual_paste_or_txt";
const DEFAULT_SOURCE_PLATFORM = "manual";
const DEFAULT_EXTERNAL_INTAKE_METADATA = null;
const VALID_CAPTURE_MODES = new Set(["current_conversation", "selection"]);
const QA_CANDIDATE_REVIEW_SEED_KEY = "passmap:qa-candidate-review-seed:v1";
const QA_CANDIDATE_REVIEW_TOUR_ARMED_KEY = "passmap:first-record-candidate-review-tour-armed:v1";
const QA_CANDIDATE_REVIEW_TOUR_DISMISSED_KEY = "passmap:first-record-candidate-review-tour-dismissed:v1";
const QA_CANDIDATE_REVIEW_TOUR_COMPLETED_KEY = "passmap:first-record-candidate-review-tour-completed:v1";

const QA_CANDIDATE_REVIEW_RAW_TEXT = [
  "오늘 고객 문의 12건을 유형별로 분류하고 반복 문의 기준을 정리했다.",
  "상담팀과 공유해 다음 주부터 같은 기준으로 응대하기로 했다.",
  "처리 시간이 줄었고 FAQ 문구도 함께 개선했다.",
].join("\n");

const QA_CANDIDATE_REVIEW_RESULT = {
  ok: true,
  sourceType: "work_report",
  sourceMode: "work_trace",
  detectedPeriod: null,
  summary: "고객 문의를 유형화하고 반복 문의 대응 기준을 정리한 업무 기록입니다.",
  candidates: [
    {
      title: "고객 문의 유형화 및 FAQ 개선",
      role: "고객 문의 대응 기준 정리 담당",
      situation: "반복되는 고객 문의가 늘어나 상담 기준을 맞출 필요가 있었습니다.",
      task: "문의 유형을 분류하고 상담팀이 공통으로 쓸 대응 기준을 정리했습니다.",
      actions: [
        "고객 문의 12건을 유형별로 분류",
        "반복 문의 기준과 FAQ 문구 정리",
        "상담팀에 다음 주 적용 기준 공유",
      ],
      result: [
        "반복 문의 대응 시간이 줄어드는 흐름을 확인",
        "FAQ 문구 개선으로 상담 기준을 통일",
      ],
      resumePotential: "high",
      confidenceLevel: "high",
      collaboration: ["상담팀과 반복 문의 기준 공유 및 적용 방식 조율"],
      skills: ["정보 구조화", "고객 이해", "운영 개선"],
      job_tags: ["CX", "운영", "서비스기획"],
      industry_tags: [],
      suggestedResumeBullet:
        "고객 문의 12건을 유형별로 분류하고 반복 문의 대응 기준과 FAQ 문구를 정리해 상담팀의 응대 기준 통일에 기여했습니다.",
      missingInfoQuestions: ["정확히 얼마나 시간이 줄었는지 수치가 있으면 더 강한 이력서 문장이 됩니다."],
      riskNotes: ["성과 수치가 아직 제한적이므로 과장 표현은 피해야 합니다."],
      evidenceTexts: [
        "고객 문의 12건을 유형별로 분류하고 반복 문의 기준을 정리했다.",
        "상담팀과 공유해 다음 주부터 같은 기준으로 응대하기로 했다.",
      ],
    },
    {
      title: "상담팀 대응 기준 공유",
      role: "운영 기준 공유 담당",
      situation: "상담 기준이 사람마다 달라 반복 문의 처리 품질을 맞춰야 했습니다.",
      task: "정리한 문의 유형과 기준을 상담팀이 실제로 활용할 수 있게 공유했습니다.",
      actions: ["반복 문의 기준 문서화", "상담팀에 적용 방식 공유"],
      result: ["다음 주부터 같은 기준으로 응대하기로 합의"],
      resumePotential: "medium",
      confidenceLevel: "medium",
      collaboration: ["상담팀과 응대 기준 적용 일정 협의"],
      skills: ["협업 커뮤니케이션", "문서화"],
      job_tags: ["운영", "고객지원"],
      industry_tags: [],
      suggestedResumeBullet:
        "반복 문의 대응 기준을 문서화하고 상담팀과 적용 방식을 공유해 고객 응대 기준을 맞췄습니다.",
      missingInfoQuestions: [],
      riskNotes: [],
      evidenceTexts: ["상담팀과 공유해 다음 주부터 같은 기준으로 응대하기로 했다."],
    },
  ],
};

function getDevCandidateReviewQaSeed() {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("qaCandidateReview") === "1";
    const fromStorage = window.localStorage.getItem(QA_CANDIDATE_REVIEW_SEED_KEY) === "1";
    if (!fromQuery && !fromStorage) return null;

    if (params.get("qaTourReset") === "1") {
      window.localStorage.removeItem(QA_CANDIDATE_REVIEW_TOUR_DISMISSED_KEY);
      window.localStorage.removeItem(QA_CANDIDATE_REVIEW_TOUR_COMPLETED_KEY);
    }
    window.sessionStorage.setItem(QA_CANDIDATE_REVIEW_TOUR_ARMED_KEY, "1");
    return {
      rawText: QA_CANDIDATE_REVIEW_RAW_TEXT,
      result: QA_CANDIDATE_REVIEW_RESULT,
    };
  } catch {
    return null;
  }
}

function clearExternalIntake() {
  try { sessionStorage.removeItem(EXTERNAL_INTAKE_KEY); } catch (_) {}
}

function loadExternalIntake() {
  let parsed;
  try {
    const raw = sessionStorage.getItem(EXTERNAL_INTAKE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || parsed.version !== 1 || typeof parsed.savedAt !== "number") {
    clearExternalIntake();
    return null;
  }
  if (Date.now() - parsed.savedAt > EXTERNAL_INTAKE_TTL_MS) {
    clearExternalIntake();
    return null;
  }
  if (typeof parsed.rawText !== "string" || parsed.rawText.trim().length < EXTERNAL_INTAKE_MIN_RAW_TEXT_LENGTH) {
    clearExternalIntake();
    return null;
  }
  if (!VALID_EXTERNAL_INTAKE_SOURCE_MODES.has(parsed.sourceMode)) {
    clearExternalIntake();
    return null;
  }
  if (!VALID_EXTERNAL_INTAKE_IMPORT_METHODS.has(parsed.importMethod)) {
    clearExternalIntake();
    return null;
  }
  const sourcePlatform = typeof parsed.sourcePlatform === "string"
    ? parsed.sourcePlatform.trim().toLowerCase()
    : DEFAULT_SOURCE_PLATFORM;
  parsed.sourcePlatform = VALID_EXTERNAL_INTAKE_SOURCE_PLATFORMS.has(sourcePlatform)
    ? sourcePlatform
    : "browser_extension";
  const captureMode = typeof parsed.captureMode === "string"
    ? parsed.captureMode.trim().toLowerCase()
    : "";
  parsed.captureMode = VALID_CAPTURE_MODES.has(captureMode)
    ? captureMode
    : parsed.importMethod === "browser_extension_selection"
    ? "selection"
    : parsed.importMethod === "browser_extension_current_conversation"
    ? "current_conversation"
    : "";
  parsed.sourceUrl = typeof parsed.sourceUrl === "string" ? parsed.sourceUrl.trim() : "";
  parsed.sourceTitle = typeof parsed.sourceTitle === "string" ? parsed.sourceTitle.trim() : "";
  parsed.capturedAt = typeof parsed.capturedAt === "number" ? parsed.capturedAt : parsed.savedAt;
  return parsed;
}

function getPlatformName(sourcePlatform) {
  switch (sourcePlatform) {
    case "chatgpt":
      return "ChatGPT";
    case "claude":
      return "Claude";
    case "gemini":
      return "Gemini";
    default:
      return "브라우저";
  }
}

function getCaptureKind(captureMode, importMethod) {
  if (captureMode === "current_conversation" || importMethod === "browser_extension_current_conversation") {
    return "current_conversation";
  }
  if (captureMode === "selection" || importMethod === "browser_extension_selection") {
    return "selection";
  }
  return "unknown";
}

function getExternalIntakeSourceLabel(metadata) {
  if (!metadata) return "브라우저 확장으로 가져온 내용";
  const kind = getCaptureKind(metadata.captureMode, metadata.importMethod);
  const platformName = getPlatformName(metadata.sourcePlatform);
  if (kind === "current_conversation") return `${platformName}에서 가져온 현재 대화`;
  if (kind === "selection") return `${platformName}에서 가져온 선택 텍스트`;
  return "브라우저 확장으로 가져온 내용";
}

function getExternalIntakeChipLabel(metadata) {
  if (!metadata) return "브라우저 확장 내용";
  const kind = getCaptureKind(metadata.captureMode, metadata.importMethod);
  const platformName = getPlatformName(metadata.sourcePlatform);
  if (kind === "current_conversation") return `${platformName} 현재 대화`;
  if (kind === "selection") return `${platformName} 선택 텍스트`;
  return "브라우저 확장 내용";
}

function getPrivacyReviewMessage(metadata) {
  const kind = getCaptureKind(metadata?.captureMode, metadata?.importMethod);
  if (kind === "current_conversation") {
    return "브라우저 확장으로 가져온 AI 대화입니다. 개인정보, 회사 기밀, 고객정보, 토큰, 원문 전체가 포함되지 않았는지 확인한 뒤 분석을 시작하세요.";
  }
  return "브라우저 확장으로 가져온 선택 텍스트입니다. 개인정보, 회사 기밀, 고객정보, 토큰이 포함되지 않았는지 확인한 뒤 분석을 시작하세요.";
}

function formatExternalCapturedAt(value) {
  if (typeof value !== "number") return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatShortUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const path = `${url.pathname || ""}${url.search || ""}${url.hash || ""}`;
    const shortPath = path.length > 36 ? `${path.slice(0, 36)}...` : path;
    return `${url.hostname}${shortPath}`;
  } catch (_) {
    return value.length > 56 ? `${value.slice(0, 56)}...` : value;
  }
}

function ExternalIntakeMetadataBox({ metadata }) {
  if (!metadata) return null;
  const capturedAt = formatExternalCapturedAt(metadata.capturedAt || metadata.savedAt);
  const shortUrl = formatShortUrl(metadata.sourceUrl);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
      <div className="font-semibold text-slate-700">{getExternalIntakeSourceLabel(metadata)}</div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
        {metadata.sourceTitle && (
          <span className="max-w-full truncate">
            <span className="text-slate-400">페이지</span> {metadata.sourceTitle}
          </span>
        )}
        {shortUrl && (
          <span className="max-w-full truncate">
            <span className="text-slate-400">URL</span> {shortUrl}
          </span>
        )}
        {capturedAt && (
          <span>
            <span className="text-slate-400">캡처</span> {capturedAt}
          </span>
        )}
      </div>
    </div>
  );
}

function FileChip({ name, charCount, onRemove }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
      <span className="max-w-[160px] truncate font-medium">{name}</span>
      {typeof charCount === "number" && (
        <span className="text-slate-400">({charCount.toLocaleString()}자)</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 text-slate-400 hover:text-slate-700"
          aria-label="파일 제거"
        >
          ×
        </button>
      )}
    </div>
  );
}

function buildAnalysisRawText({ rawText, inputSourceType, serviceUrl, serviceRole }) {
  if (inputSourceType !== "service_url") return rawText;
  const trimmedUrl = String(serviceUrl || "").trim();
  const trimmedRole = String(serviceRole || "").trim();
  const trimmedRawText = String(rawText || "").trim();
  return [
    "자료 유형: 웹/앱 서비스 URL",
    trimmedUrl ? `URL: ${trimmedUrl}` : "",
    trimmedRole ? `내 역할/기여: ${trimmedRole}` : "",
    trimmedRawText,
  ].filter(Boolean).join("\n");
}

function IntegrationImportSection({ collapsedByDefault = false }) {
  const body = (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-slate-500">
        아직 자동 연동은 제공하지 않아요. 지금은 내용을 복사해 붙여넣어 주세요.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {INTEGRATION_TOOLS.map((tool) => (
          <div
            key={tool.name}
            className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
          >
            <span className="min-w-0 truncate text-[12px] font-medium text-slate-700">{tool.name}</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              tool.status === "연결 가능"
                ? "bg-emerald-50 text-emerald-700"
                : tool.status === "후순위"
                ? "bg-slate-200 text-slate-600"
                : "bg-amber-50 text-amber-700"
            }`}>
              {tool.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (collapsedByDefault) {
    return (
      <details className="rounded-xl border border-slate-200 bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">연동해서 가져오기</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              캘린더, 메일, 드라이브, 협업툴에서 업무 흔적을 불러와 경험으로 정리할 수 있어요.
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500">
            보기
          </span>
        </summary>
        <div className="border-t border-slate-100 px-3 pb-3 pt-3">
          {body}
        </div>
      </details>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">연동해서 가져오기</h3>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          캘린더, 메일, 드라이브, 협업툴에서 업무 흔적을 불러와 경험으로 정리할 수 있어요.
        </p>
      </div>
      <div className="mt-3">
        {body}
      </div>
    </section>
  );
}

export default function WorkTraceInput({ className = "", careerRoleLabel = "", jobId = "", onOpenResumeView = null, onOpenAnalysis = null, onOpenLogin = null, onOpenAssetMap = null, onFlowStepChange = null, layout = "compact", initialRecordDate = null, sourceMode = "work_trace", inputSourceTourId = null, textareaTourId = null, draftButtonTourId = null }) {
  const isWeb = layout === "web";
  const mode = sourceMode === "ai_conversation" ? "ai_conversation" : "work_trace";
  const isAiMode = mode === "ai_conversation";
  const [rawText, setRawText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [extractState, setExtractState] = useState(null); // null | "loading" | "done" | "error"
  const [extractError, setExtractError] = useState(null);
  const [candidates, setCandidates] = useState(null);
  const [fileExtracting, setFileExtracting] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [pendingReviewState, setPendingReviewState] = useState(null);
  const [sourceImportMethod, setSourceImportMethod] = useState(DEFAULT_IMPORT_METHOD);
  const [sourcePlatform, setSourcePlatform] = useState(DEFAULT_SOURCE_PLATFORM);
  const [privacyReviewRequired, setPrivacyReviewRequired] = useState(false);
  const [externalIntakeMetadata, setExternalIntakeMetadata] = useState(DEFAULT_EXTERNAL_INTAKE_METADATA);
  const [inputSourceType, setInputSourceType] = useState(DEFAULT_INPUT_SOURCE_TYPE);
  const [serviceUrl, setServiceUrl] = useState("");
  const [serviceRole, setServiceRole] = useState("");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [qaCandidateReviewSeeded, setQaCandidateReviewSeeded] = useState(false);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const selectedInputSource = INPUT_SOURCE_OPTIONS.find((option) => option.id === inputSourceType)
    || INPUT_SOURCE_OPTIONS[0];
  const activeInputSource = isAiMode ? AI_CONVERSATION_INPUT_CONFIG : selectedInputSource;
  const isServiceUrlSource = !isAiMode && inputSourceType === "service_url";
  const shouldEmphasizeFileButton = !isAiMode && FILE_EMPHASIS_SOURCE_TYPES.has(inputSourceType);
  const analysisRawText = buildAnalysisRawText({ rawText, inputSourceType, serviceUrl, serviceRole });

  // Restore an in-progress review preserved before a login redirect (mount only).
  // Pending review takes priority over external intake; external intake is only
  // consumed when no pending review applies to the current tab.
  useEffect(() => {
    const qaSeed = getDevCandidateReviewQaSeed();
    if (qaSeed) {
      setRawText(qaSeed.rawText);
      setCandidates(qaSeed.result);
      setExtractState("done");
      setPendingReviewState(null);
      setSourceImportMethod(DEFAULT_IMPORT_METHOD);
      setSourcePlatform(DEFAULT_SOURCE_PLATFORM);
      setQaCandidateReviewSeeded(true);
      return;
    }

    const pending = loadPendingWorkTraceReview();
    if (pending && pending.sourceMode === mode) {
      const restoredResult = pending.result;
      if (restoredResult && Array.isArray(restoredResult.candidates)
        && pending.rawText && typeof pending.rawText === "string") {
        setRawText(pending.rawText);
        setCandidates(restoredResult);
        setExtractState("done");
        setPendingReviewState({
          statuses: pending.statuses ?? null,
          differReasons: pending.differReasons ?? null,
          userEditedTexts: pending.userEditedTexts ?? null,
        });
        setSourceImportMethod(pending.sourceImportMethod || DEFAULT_IMPORT_METHOD);
        setSourcePlatform(pending.result?.sourcePlatform || DEFAULT_SOURCE_PLATFORM);
        return;
      }
    }
    // No applicable pending review — try external intake (e.g. browser extension).
    const intake = loadExternalIntake();
    if (!intake) return;
    if (intake.sourceMode !== mode) return; // wait for the tab that matches
    setRawText(intake.rawText);
    setSourceImportMethod(intake.importMethod);
    setSourcePlatform(intake.sourcePlatform || "browser_extension");
    setPrivacyReviewRequired(intake.privacyReviewRequired === true);
    const intakeMetadata = {
      sourcePlatform: intake.sourcePlatform || "browser_extension",
      importMethod: intake.importMethod,
      captureMode: intake.captureMode || "",
      sourceUrl: intake.sourceUrl || "",
      sourceTitle: intake.sourceTitle || "",
      capturedAt: intake.capturedAt || intake.savedAt,
      savedAt: intake.savedAt,
    };
    setExternalIntakeMetadata(intakeMetadata);
    setAttachedFiles([{
      name: getExternalIntakeChipLabel(intakeMetadata),
      charCount: intake.rawText.length,
    }]);
    clearExternalIntake();
    // extractState stays null so the user reviews and presses the run button.
  }, [mode]);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    try { e.target.value = ""; } catch {}

    setFileExtracting(true);
    setFileError(null);
    try {
      const res = await extractTextFromFile(file, "work_trace");
      if (res.ok && res.text) {
        setRawText((prev) => {
          const sep = prev.trim() ? "\n\n" : "";
          return prev + sep + res.text;
        });
        setAttachedFiles((prev) => [
          ...prev,
          {
            name: res.meta?.name || file.name,
            charCount: res.meta?.charCount ?? res.text.length,
          },
        ]);
      } else {
        const warn = Array.isArray(res.meta?.warnings) && res.meta.warnings.length
          ? res.meta.warnings[0]
          : null;
        setFileError(
          res.message || warn || "아직 이 파일 형식은 직접 읽지 못해요. PDF, DOCX, TXT, CSV, 이미지 파일을 사용하거나 내용을 복사해 붙여넣어 주세요."
        );
      }
    } catch {
      setFileError("아직 이 파일 형식은 직접 읽지 못해요. PDF, DOCX, TXT, CSV, 이미지 파일을 사용하거나 내용을 복사해 붙여넣어 주세요.");
    } finally {
      setFileExtracting(false);
    }
  }, []);

  const handleExtract = useCallback(async () => {
    if (!analysisRawText.trim()) return;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setExtractState("loading");
    setExtractError(null);
    setCandidates(null);
    setPendingReviewState(null);

    const result = await extractExperienceCandidates({ rawText: analysisRawText, signal: ctrl.signal, careerRoleLabel, jobId, sourceMode: mode });

    if (ctrl.signal.aborted) return;

    if (result.ok) {
      setCandidates({
        ...result,
        sourcePlatform: isAiMode ? sourcePlatform : DEFAULT_SOURCE_PLATFORM,
      });
      setExtractState("done");
    } else {
      setExtractError(result.message || "경험 분석 중 오류가 발생했어요.");
      setExtractState("error");
    }
  }, [analysisRawText, careerRoleLabel, jobId, mode, isAiMode, sourcePlatform]);

  const handleReset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setRawText("");
    setAttachedFiles([]);
    setExtractState(null);
    setExtractError(null);
    setCandidates(null);
    setFileError(null);
    setPendingReviewState(null);
    setSourceImportMethod(DEFAULT_IMPORT_METHOD);
    setSourcePlatform(DEFAULT_SOURCE_PLATFORM);
    setPrivacyReviewRequired(false);
    setExternalIntakeMetadata(DEFAULT_EXTERNAL_INTAKE_METADATA);
    setServiceUrl("");
    setServiceRole("");
    setSampleOpen(false);
    setQaCandidateReviewSeeded(false);
    clearPendingWorkTraceReview();
  }, []);

  const isLoading = extractState === "loading";
  const hasEnoughInput = analysisRawText.trim().length >= 30;
  const canExtract = hasEnoughInput && !isLoading;
  const buttonLabel = activeInputSource.ctaLabel;
  const loadingLabel = "경험 초안 만드는 중...";

  const currentFlowStep = extractState === "done" && candidates ? "review" : "input";
  useEffect(() => {
    if (typeof onFlowStepChange === "function") onFlowStepChange(currentFlowStep);
  }, [currentFlowStep, onFlowStepChange]);

  if (extractState === "done" && candidates) {
    return (
      <ExperienceCandidateReview
        result={candidates}
        rawText={analysisRawText}
        onBack={handleReset}
        onOpenResumeView={onOpenResumeView}
        onOpenAnalysis={onOpenAnalysis}
        onOpenLogin={onOpenLogin}
        onOpenAssetMap={onOpenAssetMap}
        layout={layout}
        initialRecordDate={initialRecordDate}
        sourceMode={mode}
        sourceImportMethod={sourceImportMethod}
        initialReviewState={pendingReviewState}
        qaSaveBypass={qaCandidateReviewSeeded}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {isAiMode && privacyReviewRequired && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
          {getPrivacyReviewMessage(externalIntakeMetadata)}
        </p>
      )}

      <ExternalIntakeMetadataBox metadata={externalIntakeMetadata} />


      {isAiMode && (
        <p className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-2 text-[11px] leading-relaxed text-violet-800">
          {activeInputSource.helperText}
        </p>
      )}


      <textarea
        data-tour-id={textareaTourId || undefined}
        className={`w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200 disabled:opacity-60 ${isWeb ? "min-h-[360px]" : "min-h-[180px]"}`}
        placeholder={isAiMode ? activeInputSource.placeholder : COMPOSER_PLACEHOLDER}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        disabled={isLoading}
      />

      {sampleOpen && (
        <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          {isAiMode ? AI_CONVERSATION_SAMPLE_TEXT : WORK_TRACE_SAMPLE_TEXT}
        </pre>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSampleOpen((value) => !value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {sampleOpen ? "예시 닫기" : "예시 보기"}
        </button>

        <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium hover:bg-slate-50 ${shouldEmphasizeFileButton ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-700"} ${fileExtracting || isLoading ? "pointer-events-none opacity-50" : ""}`}>
          {fileExtracting ? (
            <span className="animate-pulse">읽는 중…</span>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              파일·이미지 첨부
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            disabled={fileExtracting || isLoading}
          />
        </label>

        {!isAiMode && (
          <label
            data-tour-id={inputSourceTourId || undefined}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-600"
          >
            <span className="shrink-0 text-slate-400">자료 유형</span>
            <select
              id="work-trace-input-source-type"
              value={inputSourceType}
              onChange={(e) => setInputSourceType(e.target.value)}
              disabled={isLoading}
              className="max-w-[180px] bg-transparent text-xs font-semibold text-slate-700 outline-none disabled:opacity-60"
              aria-label="자료 유형"
            >
              {INPUT_SOURCE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {getInputSourceDisplayLabel(option.id, option.label)}
                </option>
              ))}
            </select>
          </label>
        )}

        {attachedFiles.map((f, i) => (
          <FileChip
            key={i}
            name={f.name}
            charCount={f.charCount}
            onRemove={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          />
        ))}
      </div>

      {!isAiMode && (
        <p className="text-[11px] leading-relaxed text-slate-400">
          {isServiceUrlSource
            ? "URL도 위 입력창에 그대로 붙여넣어 주세요. 필요하면 아래 보조 입력에 역할만 덧붙일 수 있어요."
            : COMPOSER_HELPER_TEXT}
        </p>
      )}

      {!isAiMode && shouldEmphasizeFileButton && (
        <p className="text-[11px] leading-relaxed text-violet-700">
          PDF, DOCX, TXT, CSV, TSV, 이미지 파일을 올리거나 핵심 내용을 그대로 붙여넣어도 됩니다. 엑셀 파일은 CSV로 저장해 올리면 가장 안정적으로 읽을 수 있어요.
        </p>
      )}

      {isServiceUrlSource && (
        <details className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            URL 역할 보조 입력
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="work-trace-service-url">
                서비스 URL
              </label>
              <input
                id="work-trace-service-url"
                type="url"
                inputMode="url"
                value={serviceUrl}
                onChange={(e) => setServiceUrl(e.target.value)}
                disabled={isLoading}
                placeholder="https://..."
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200 disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700" htmlFor="work-trace-service-role">
                내가 맡은 역할
              </label>
              <textarea
                id="work-trace-service-role"
                value={serviceRole}
                onChange={(e) => setServiceRole(e.target.value)}
                disabled={isLoading}
                placeholder="예: 서비스 화면에서 직접 기획·개선·운영·분석한 내용을 적어주세요."
                className="mt-1.5 min-h-[80px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-200 disabled:opacity-60"
              />
            </div>
          </div>
        </details>
      )}

      {isAiMode && (
        <p className="text-[11px] leading-relaxed text-slate-400">
          개인정보와 회사 기밀은 지우고 붙여넣어 주세요.
        </p>
      )}

      {fileError && (
        <p className="text-[11px] text-amber-700">
          {fileError}
        </p>
      )}

      {analysisRawText.trim().length > 0 && analysisRawText.trim().length < 30 && (
        <p className="text-[11px] text-slate-400">
          조금 더 입력하면 분석을 시작할 수 있어요. (현재 {analysisRawText.trim().length}자 / 최소 30자)
        </p>
      )}

      {extractState === "error" && extractError && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          {extractError}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          data-tour-id={draftButtonTourId || undefined}
          onClick={handleExtract}
          disabled={!canExtract}
          className="flex-1 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {loadingLabel}
            </span>
          ) : (
            buttonLabel
          )}
        </button>

        {(rawText || serviceUrl || serviceRole || extractState) && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40"
          >
            초기화
          </button>
        )}
      </div>

      {currentFlowStep === "input" && (
        <IntegrationImportSection collapsedByDefault />
      )}
    </div>
  );
}
