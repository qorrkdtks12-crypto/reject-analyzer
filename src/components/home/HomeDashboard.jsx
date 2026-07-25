import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Lightbulb, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { homeDashboardMock, PASSMAP_DEMO_RANGE_RECORDS } from "./homeDashboardMock.js";
import {
  EXPERIENCE_DEMO_RECORDS,
  adaptExperienceRecordToCareerAssetSignalRecord,
} from "./experienceDemoRecords.js";
import { downloadPassmapCalendarIcs } from "@/lib/calendarExport.js";
import { useToast } from "@/components/ui/use-toast";
import {
  buildCalendarEntriesByDate,
  buildCalendarMonthViewModel,
  deriveCalendarSummary,
  deriveMonthlyAssetSummary,
} from "./homeDashboardCalendarUtils.js";
import { buildCareerAssetSignals } from "./careerAssetSignalUtils.js";
import { supabase } from "@/lib/supabaseClient.js";
import {
  createWorkRecord,
  deleteWorkRecord,
  listCalendarWorkRecords,
  listExperienceCardsForWorkRecordIds,
  updateWorkRecord,
} from "@/lib/workRecordRepository.js";
import { updateGoogleCalendarEventForWorkRecord } from "@/lib/googleCalendarSync.js";
import { getSession, onAuthStateChange } from "@/lib/auth.js";
import FirstRecordGuidedTour from "@/components/onboarding/FirstRecordGuidedTour.jsx";
import { FIRST_RECORD_TOUR_IDS } from "@/components/onboarding/firstRecordTourSteps.js";
import CalendarDateDrawer from "@/components/calendar/CalendarDateDrawer.jsx";
import CalendarGridView from "@/components/calendar/CalendarGridView.jsx";
import GoogleCalendarCandidatePanel from "@/components/calendar/GoogleCalendarCandidatePanel.jsx";
import CalendarProjectActionCreateDrawer from "@/components/calendar/CalendarProjectActionCreateDrawer.jsx";
import CalendarProjectActionDrawer from "@/components/calendar/CalendarProjectActionDrawer.jsx";
import CalendarProjectView from "@/components/calendar/CalendarProjectView.jsx";
import CalendarRecommendationPanel from "@/components/calendar/CalendarRecommendationPanel.jsx";
import CalendarViewTabs from "@/components/calendar/CalendarViewTabs.jsx";
import CalendarWeeklyView from "@/components/calendar/CalendarWeeklyView.jsx";
import { getDateRecordStatus, getDateStatusLabel } from "@/components/calendar/calendarRecordStatus.js";
import { buildMonthlyCalendarSummary, buildWeeklyCalendarSummary } from "@/components/calendar/calendarSummaryUtils.js";
import { buildProjectGroupsFromRecords } from "@/components/calendar/projectActionAdapter.js";
import { buildCalendarRecommendedActions } from "@/components/calendar/recommendedActionUtils.js";
import {
  MANUAL_GITHUB_PR_DEFAULT_CHANGED_FILES,
  buildManualGithubPrImportDisplay,
  buildManualGithubPrImportPayload,
} from "@/lib/experience/manualGithubPrImport.js";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function SectionHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="space-y-0.5">
        <h3 className="text-sm font-semibold leading-snug text-slate-900 sm:text-[22px]">{title}</h3>
        {description ? <p className="text-xs leading-relaxed text-slate-500 sm:text-[15px]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const AI_CAPTURE_ONBOARDING_STEPS = [
  "Chrome 확장을 설치하거나 새로고침합니다.",
  "PASSMAP AI Inbox에서 연결 코드를 발급합니다.",
  "확장 popup에 코드를 입력해 PASSMAP 연결됨을 확인합니다.",
  "ChatGPT 대화방에서 PASSMAP AI Inbox에 후보로 저장을 누릅니다.",
  "Inbox에서 맞는 내용만 이력서 재료로 확정합니다.",
];

const EMPTY_MANUAL_GITHUB_PR_FORM = {
  repository: "",
  prNumber: "",
  title: "",
  body: "",
  mergedAt: "",
  additions: "",
  deletions: "",
  changedFilesSummary: MANUAL_GITHUB_PR_DEFAULT_CHANGED_FILES,
};
const GITHUB_INSTALLATION_ID_QUERY_KEY = `installation_${"id"}`;
const GITHUB_CONNECTION_CALLBACK_QUERY_KEYS = ["code", "state", GITHUB_INSTALLATION_ID_QUERY_KEY, "setup_action"];

function readGithubConnectionCallbackQuery(search) {
  const params = new URLSearchParams(search || "");
  const code = String(params.get("code") || "").trim();
  const state = String(params.get("state") || "").trim();
  const installationId = String(params.get(GITHUB_INSTALLATION_ID_QUERY_KEY) || "").trim();
  const setupAction = String(params.get("setup_action") || "").trim();
  return {
    hasCandidate: GITHUB_CONNECTION_CALLBACK_QUERY_KEYS.some((key) => params.has(key)),
    isComplete: Boolean(code && state),
    payload: {
      code,
      state,
      [GITHUB_INSTALLATION_ID_QUERY_KEY]: installationId,
      setup_action: setupAction,
    },
  };
}

function clearGithubConnectionCallbackQuery() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search || "");
  GITHUB_CONNECTION_CALLBACK_QUERY_KEYS.forEach((key) => params.delete(key));
  const nextSearch = params.toString();
  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
  );
}

function getSafeGithubConnectionMessage(value, fallback) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message) return fallback;
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}

function AiCaptureOnboardingCard({
  onOpenAiInbox,
  primaryActionLabel,
  primaryActionLoading = false,
  primaryActionDisabled = false,
  onPrimaryAction,
}) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <section
      data-tour-id={FIRST_RECORD_TOUR_IDS.aiCaptureCard}
      className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
            <Sparkles className="h-3.5 w-3.5" />
            이력서 후보 자동 수집
          </div>
          <h3 className="mt-3 text-xl font-semibold leading-snug text-slate-950 sm:text-[26px]">
            업무 자동 수집
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            ChatGPT와 GitHub 활동에서 이력서에 쓸 만한 업무 후보를 자동으로 모읍니다. 맞는 내용만 확인하고 경력 기록으로 확정하세요.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <Button
            size="sm"
            className="h-10 rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
            disabled={primaryActionDisabled || primaryActionLoading}
            onClick={onPrimaryAction || undefined}
          >
            {primaryActionLoading ? "처리 중..." : primaryActionLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50"
            onClick={onOpenAiInbox || undefined}
          >
            AI Inbox 보기
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-4 text-sm text-slate-500 hover:bg-slate-50"
            onClick={() => setGuideOpen((prev) => !prev)}
          >
            연결 방법 보기
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-950">GitHub PR 자동 분석</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            연결한 저장소의 merged PR을 읽고 업무 후보를 만듭니다.
          </p>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-950">ChatGPT 기록 수집</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            AI 대화에서 나온 업무 내용을 후보로 보내고, 필요한 내용만 확정할 수 있습니다.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onOpenAiInbox || undefined}
            >
              연결 코드 발급하기
            </Button>
          </div>
        </div>
      </div>

      {guideOpen ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <ol className="grid gap-2 sm:grid-cols-5">
            {AI_CAPTURE_ONBOARDING_STEPS.map((step, index) => (
              <li key={step} className="rounded-2xl bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-600">
                <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="block">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            전체 대화 원문을 저장하지 않고, 업무 후보에 필요한 짧은 근거만 보냅니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}

const EXPERIENCE_SIGNAL_DEFS = [
  {
    key: "customer_response",
    label: "문의 대응",
    emptyMessage: "이번 달에는 문의 대응 경험이 아직 감지되지 않았어요. 고객/사용자 문의를 처리했거나 피드백을 반영한 일이 있다면 기록해보세요.",
  },
  {
    key: "issue_coordination",
    label: "이슈 조율",
    emptyMessage: "이번 달에는 이슈 조율 경험이 아직 감지되지 않았어요. 일정, 범위, 이해관계자 간 의견을 맞춘 일이 있다면 기록해보세요.",
  },
  {
    key: "document_report",
    label: "문서·보고",
    emptyMessage: "이번 달에는 문서·보고 경험이 아직 감지되지 않았어요. 회의록, 보고서, 가이드, 정리 문서를 만든 일이 있다면 기록해보세요.",
  },
  {
    key: "operation_improvement",
    label: "운영 개선",
    emptyMessage: "이번 달에는 운영 개선 경험이 아직 감지되지 않았어요. 반복 업무를 줄였거나 프로세스를 바꾼 일이 있다면 기록해보세요.",
  },
  {
    key: "personal_work",
    label: "개인 업무",
    emptyMessage: "이번 달에는 개인 업무 기록이 아직 감지되지 않았어요. 혼자 처리한 업무도 경험 자산이 될 수 있어요.",
  },
  {
    key: "team_project",
    label: "팀 프로젝트",
    emptyMessage: "이번 달에는 팀 프로젝트 기록이 아직 감지되지 않았어요. 함께 진행한 프로젝트나 협업 기록을 남겨보세요.",
  },
  {
    key: "work_record",
    label: "업무 기록",
    emptyMessage: "이번 달에는 업무 기록이 아직 없어요. 오늘 한 일을 한 줄로 남겨보세요.",
  },
];

const EXPERIENCE_SIGNAL_LABEL_BY_KEY = Object.fromEntries(
  EXPERIENCE_SIGNAL_DEFS.map((item) => [item.key, item.label])
);

function normalizeExperienceSignalLabel(value) {
  const safeValue = String(value || "").trim();
  if (safeValue === "문서/보고") return "문서·보고";
  return safeValue;
}

function ExperienceSignalFilterBar({ options, selectedKey, onSelect }) {
  const sortedOptions = [
    ...options.filter((item) => item.key === "all"),
    ...options
      .filter((item) => item.key !== "all")
      .sort((a, b) => (b.count > 0) - (a.count > 0) || b.count - a.count),
  ];
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-500">이번 달 경험 신호</div>
      <div className="flex flex-wrap gap-1.5">
        {sortedOptions.map((item) => {
          const selected = selectedKey === item.key;
          const empty = item.count === 0 && item.key !== "all";
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(item.key)}
              className={[
                "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                selected
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                empty && !selected ? "opacity-30" : "",
              ].join(" ")}
            >
              <span>{item.label}</span>
              <span className={selected ? "text-white/75" : "text-slate-400"}>{item.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const isRangeRecord = (record) => {
  const isPassmapSource =
    record?.source === "passmap" || record?.source === "passmap-demo";
  const isRangeType =
    record?.recordType === "personal" ||
    record?.recordType === "teamProject" ||
    record?.workType === "개인 업무" ||
    record?.workType === "팀 프로젝트";
  return (
    isPassmapSource &&
    isRangeType &&
    record?.startDate &&
    record?.endDate &&
    record.startDate !== record.endDate
  );
};

const getWeekRangeSegments = (records, weekDays) => {
  const weekStart = weekDays?.[0]?.date;
  const weekEnd = weekDays?.[weekDays.length - 1]?.date;
  if (!weekStart || !weekEnd) return [];
  return (records || [])
    .filter(isRangeRecord)
    .filter((record) => record.startDate <= weekEnd && record.endDate >= weekStart)
    .slice(0, 2)
    .map((record, index) => {
      const segmentStart = record.startDate < weekStart ? weekStart : record.startDate;
      const segmentEnd = record.endDate > weekEnd ? weekEnd : record.endDate;
      const startIndex = weekDays.findIndex((day) => day.date === segmentStart);
      const endIndex = weekDays.findIndex((day) => day.date === segmentEnd);
      if (startIndex < 0 || endIndex < 0) return null;
      return {
        record,
        lane: index,
        startColumn: startIndex + 1,
        endColumn: endIndex + 2,
        isSegmentStart: segmentStart === record.startDate,
        isSegmentEnd: segmentEnd === record.endDate,
      };
    })
    .filter(Boolean);
};

const GENERIC_WORK_TYPES = new Set(["이번 주 기록", "개인 업무", "팀 프로젝트"]);

function getCalendarWorkTypeLabel(type) {
  const safeType = String(type || "").trim();
  if (safeType === "이번 주 기록") return "업무 기록";
  return normalizeExperienceSignalLabel(safeType);
}

function normalizeGoogleCalendarSyncStatus(status) {
  const safeStatus = String(status || "").trim().toLowerCase();
  if (safeStatus === "synced") return "synced";
  if (safeStatus === "failed") return "failed";
  if (!safeStatus || safeStatus === "none") return "pending";
  return "unknown";
}

function getGoogleCalendarSyncStatusLabel(status) {
  const normalized = normalizeGoogleCalendarSyncStatus(status);
  if (normalized === "synced") return "연동 완료";
  if (normalized === "failed") return "연동 실패";
  if (normalized === "pending") return "연동 대기";
  return "확인 필요";
}

function buildGoogleCalendarSyncStatusSummary(records = []) {
  return records.reduce(
    (acc, record) => {
      const status = normalizeGoogleCalendarSyncStatus(record?.googleCalendarSyncStatus);
      if (status === "synced") acc.synced += 1;
      else if (status === "failed") acc.failed += 1;
      else if (status === "pending") acc.pending += 1;
      else acc.unknown += 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, synced: 0, pending: 0, failed: 0, unknown: 0 }
  );
}

function getWorkCalendarWeekDays(dateStr) {
  if (!dateStr) return [];
  const parts = dateStr.split("-").map(Number);
  const ref = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = ref.getDay();
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  });
}

function getWorkCalendarRecordTypeLabel(record) {
  if (record?.source === "passmap-demo") return "예시 기록";
  if (record?.recordType === "personal" || record?.workType === "개인 업무") return "개인 업무";
  if (record?.recordType === "teamProject" || record?.workType === "팀 프로젝트") return "팀 프로젝트";
  return "업무 기록";
}

function formatWorkCalendarPeriod(record) {
  if (record?.startDate && record?.endDate && record.startDate !== record.endDate) {
    return `${record.startDate} ~ ${record.endDate}`;
  }
  return record?.startDate || record?.date || "날짜 미지정";
}

const CALENDAR_VIEW_OPTIONS = [
  { key: "grid", label: "그리드뷰", ariaLabel: "월간 캘린더에서 날짜별 기록 상태 보기" },
  { key: "weekly", label: "위클리뷰", ariaLabel: "선택한 주의 기록 흐름 보기" },
  { key: "project", label: "프로젝트뷰", ariaLabel: "프로젝트별 기록 흐름 보기" },
];
const SHOW_LEGACY_CALENDAR_GRID_VIEW = false;
const SHOW_LEGACY_CALENDAR_WEEKLY_VIEW = false;
const SHOW_LEGACY_CALENDAR_LIST_VIEW = false;

function shiftDateByDays(dateStr, offsetDays) {
  if (!dateStr) return dateStr;
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentYearMonth() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function toMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function recordTouchesMonth(record, year, month) {
  const monthKey = toMonthKey(year, month);
  const dateKey = String(record?.date || "").slice(0, 7);
  const startKey = String(record?.startDate || record?.date || "").slice(0, 7);
  const endKey = String(record?.endDate || record?.startDate || record?.date || "").slice(0, 7);
  if (dateKey === monthKey || startKey === monthKey || endKey === monthKey) return true;
  const startDate = String(record?.startDate || record?.date || "");
  const endDate = String(record?.endDate || record?.startDate || record?.date || "");
  if (!startDate || !endDate) return false;
  const monthStart = `${monthKey}-01`;
  const monthEnd = `${monthKey}-31`;
  return startDate <= monthEnd && endDate >= monthStart;
}

function formatWeekRangeLabel(weekDates) {
  if (!weekDates || weekDates.length < 7) return "";
  const DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
  const fmt = (dateStr) => {
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return `${parts[1]}.${parts[2]}(${DOW_KO[d.getDay()]})`;
  };
  return `${fmt(weekDates[0])} - ${fmt(weekDates[6])}`;
}

function SummaryMetricCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">{label}</div>
      <div className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900 sm:text-[17px]">{value}</div>
    </div>
  );
}

function pickUniqueCompact(values = [], limit = 4) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit);
}

function stringifySearchValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function getRecordSearchText(record) {
  const rawPayload = record?.raw_payload || record?.rawPayload || record?.payload || null;
  return [
    record?.title,
    record?.summary,
    record?.description,
    record?.reflectedSentence,
    record?.workType,
    stringifySearchValue(record?.raw_payload),
    stringifySearchValue(record?.rawPayload),
    stringifySearchValue(record?.payload),
    rawPayload?.description,
    rawPayload?.summary,
    rawPayload?.title,
    ...(Array.isArray(record?.strengthTags) ? record.strengthTags : []),
    ...(Array.isArray(record?.skillTags) ? record.skillTags : []),
    ...(Array.isArray(record?.workTags) ? record.workTags : []),
    ...(Array.isArray(rawPayload?.strengthTags) ? rawPayload.strengthTags : []),
    ...(Array.isArray(rawPayload?.skillTags) ? rawPayload.skillTags : []),
    ...(Array.isArray(rawPayload?.workTags) ? rawPayload.workTags : []),
  ].filter(Boolean).join(" ");
}

function getRecordRawPayload(record) {
  const rawPayload = record?.rawPayload || record?.raw_payload || record?.payload || null;
  if (!rawPayload) return null;
  if (typeof rawPayload === "object") return rawPayload;
  if (typeof rawPayload === "string") return hdSafeParsePayload(rawPayload);
  return null;
}

function getRecordSignalSearchText(record) {
  const rawPayload = getRecordRawPayload(record) || {};
  const experienceSignals = Array.isArray(rawPayload.experienceSignals) ? rawPayload.experienceSignals : [];
  return [
    getRecordSearchText(record),
    record?.recordType,
    rawPayload?.recordType,
    rawPayload?.workType,
    ...(Array.isArray(rawPayload?.roleTags) ? rawPayload.roleTags : []),
    ...(Array.isArray(rawPayload?.resultTags) ? rawPayload.resultTags : []),
    ...(Array.isArray(rawPayload?.collaborationTags) ? rawPayload.collaborationTags : []),
    ...experienceSignals.flatMap((item) => [
      item?.label,
      item?.signalType,
      item?.evidenceText,
      item?.suggestedResumeAngle,
    ]),
  ].filter(Boolean).map(normalizeExperienceSignalLabel).join(" ");
}

function getExperienceSignalKeysForRecord(record) {
  const keys = new Set();
  const rawPayload = getRecordRawPayload(record) || {};
  const recordType = String(record?.recordType || rawPayload?.recordType || "").trim();
  const workType = String(record?.workType || rawPayload?.workType || rawPayload?.track || record?.work_type || "").trim();
  const text = getRecordSignalSearchText(record);

  if (recordType === "personal" || workType === "개인 업무") keys.add("personal_work");
  if (recordType === "teamProject" || workType === "팀 프로젝트" || workType === "project") keys.add("team_project");
  if (/(문의|고객|사용자|VOC|피드백|응대)/i.test(text)) keys.add("customer_response");
  if (/(이슈|조율|협업|논의|공유|일정|이해관계자)/.test(text)) keys.add("issue_coordination");
  if (/(문서|보고|리포트|가이드|정리|회의록)/.test(text)) keys.add("document_report");
  if (/(개선|운영|프로세스|자동화|효율|기준|반복|병목)/.test(text)) keys.add("operation_improvement");
  if (keys.size === 0) keys.add("work_record");

  return keys;
}

function recordHasExperienceSignal(record, signalKey) {
  if (signalKey === "all") return true;
  return getExperienceSignalKeysForRecord(record).has(signalKey);
}

function recordsHaveExperienceSignal(records = [], signalKey) {
  if (signalKey === "all") return true;
  return records.some((record) => recordHasExperienceSignal(record, signalKey));
}

function buildExperienceSignalFilterOptions(records = []) {
  const counts = Object.fromEntries(EXPERIENCE_SIGNAL_DEFS.map((item) => [item.key, 0]));
  for (const record of records) {
    for (const key of getExperienceSignalKeysForRecord(record)) {
      if (Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
    }
  }
  return [
    { key: "all", label: "전체", count: records.length },
    ...EXPERIENCE_SIGNAL_DEFS.map((item) => ({
      key: item.key,
      label: item.label,
      count: counts[item.key] || 0,
    })),
  ];
}

function getExperienceSignalEmptyMessage(signalKey) {
  return EXPERIENCE_SIGNAL_DEFS.find((item) => item.key === signalKey)?.emptyMessage || "";
}

function getExperienceSignalLabel(signalKey) {
  return signalKey === "all" ? "전체" : EXPERIENCE_SIGNAL_LABEL_BY_KEY[signalKey] || "";
}

function deriveExperienceSignalsFromRecords(records = [], limit = 4) {
  const keys = new Set();
  for (const record of records) {
    for (const key of getExperienceSignalKeysForRecord(record)) keys.add(key);
  }
  return EXPERIENCE_SIGNAL_DEFS
    .filter((item) => keys.has(item.key))
    .map((item) => item.label)
    .slice(0, limit);
}

function deriveConnectableRolesFromRecords(records = [], limit = 3) {
  const text = records.map(getRecordSearchText).join(" ");
  const roles = [];
  if (/(기획|요구사항|정책|우선순위|프로덕트|서비스)/.test(text)) roles.push("서비스기획 · PM");
  if (/(데이터|분석|지표|리포트|SQL|대시보드)/i.test(text)) roles.push("데이터 기반 운영");
  if (/(고객|사용자|문의|VOC|피드백|응대)/i.test(text)) roles.push("고객 경험 운영");
  if (/(협업|조율|공유|커뮤니케이션|일정|회의)/.test(text)) roles.push("프로젝트 운영");
  if (/(콘텐츠|문서|가이드|교육|온보딩)/.test(text)) roles.push("콘텐츠 · 운영기획");

  return pickUniqueCompact(roles, limit);
}

function deriveExperienceFlowAction(records = []) {
  const text = records.map(getRecordSearchText).join(" ");
  if (!records.length) {
    return "오늘 해결한 문제, 협업한 사람, 결과로 달라진 점 중 하나만 적어도 경험 신호를 찾을 수 있어요.";
  }
  if (!/\d/.test(text)) return "성과 수치나 사용자 반응을 추가하면 이력서 후보의 설득력이 높아져요.";
  if (!/(고객|사용자|문의|VOC|피드백|응대)/i.test(text)) return "누구에게 어떤 변화가 있었는지 한 줄만 보완하면 직무 연결이 선명해져요.";
  if (!/(협업|조율|공유|커뮤니케이션|회의|전달)/.test(text)) return "함께 움직인 사람과 본인의 판단 기준을 덧붙이면 협업 신호가 더 잘 보여요.";
  return "이 경험에서 맡은 역할과 결과를 한 문장으로 정리하면 이력서 후보로 바로 이어질 수 있어요.";
}

const PASSMAP_WORK_RECORDS_CHANGED_EVENT = "passmap:work-records-changed";

function hdSafeParsePayload(value) {
  try { return JSON.parse(value); } catch { return {}; }
}

function adaptWorkRecordRowForHomeDashboard(row) {
  const raw =
    row.raw_payload && typeof row.raw_payload === "object"
      ? row.raw_payload
      : hdSafeParsePayload(row.raw_payload);

  const rawRecordType = String(raw?.recordType || "").trim();

  let normalizedRecordType = "weekly";
  let normalizedWorkType = "이번 주 기록";

  if (rawRecordType === "personal") {
    normalizedRecordType = "personal";
    normalizedWorkType = "개인 업무";
  } else if (rawRecordType === "teamProject") {
    normalizedRecordType = "teamProject";
    normalizedWorkType = "팀 프로젝트";
  } else if (row.work_type === "project") {
    normalizedRecordType = "teamProject";
    normalizedWorkType = "팀 프로젝트";
  }

  const today = todayDateStr();

  return {
    id: String(row.id || ""),
    date: String(row.record_date || raw.date || today),
    source: "supabase",
    recordType: normalizedRecordType,
    workType: normalizedWorkType,
    title: String(row.title || raw.title || raw.task || "").trim() || "업무 기록",
    description: String(row.description || raw.description || raw.summary || "").trim(),
    task: String(row.task || raw.task || "").trim(),
    result: String(row.result || raw.result || raw.projectResult || "").trim(),
    summary: String(row.description || raw.summary || [row.task, row.result].filter(Boolean).join(" / ") || "").trim(),
    reflectedSentence: String(raw.reflectedSentence || raw.resumeSentence || row.result || "").trim(),
    strengthTags: Array.isArray(row.strength_tags) ? row.strength_tags
      : Array.isArray(raw.strengthTags) ? raw.strengthTags : [],
    workTags: Array.isArray(row.skill_tags) ? row.skill_tags
      : Array.isArray(raw.workTags) ? raw.workTags : [],
    skillTags: Array.isArray(row.skill_tags) ? row.skill_tags
      : Array.isArray(raw.skillTags) ? raw.skillTags : [],
    rawPayload: raw,
    projectName: String(row.project_name || raw.projectName || "").trim(),
    linkedAssetIds: Array.isArray(raw.linkedAssetIds) ? raw.linkedAssetIds : [],
    startDate: String(raw.startDate || raw.start_date || row.record_date || ""),
    endDate: String(raw.endDate || raw.end_date || raw.startDate || row.record_date || ""),
    projectPeriod: String(raw.projectPeriod || ""),
    googleCalendarEventId: row.google_calendar_event_id ?? null,
    googleCalendarSyncStatus: row.google_calendar_sync_status ?? null,
    googleCalendarSyncedAt: row.google_calendar_synced_at ?? null,
    googleCalendarSyncError: row.google_calendar_sync_error ?? null,
  };
}

function toCalendarMaterialText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(toCalendarMaterialText).find(Boolean) || "";
  }
  if (typeof value === "object") {
    return (
      toCalendarMaterialText(value.candidate) ||
      toCalendarMaterialText(value.resultCandidate) ||
      toCalendarMaterialText(value.result) ||
      toCalendarMaterialText(value.text) ||
      toCalendarMaterialText(value.summary)
    );
  }
  return String(value).trim();
}

function buildCalendarMaterialSentence(card) {
  const suggested = toCalendarMaterialText(card?.suggested_resume_bullet);
  if (suggested) return suggested;

  const action = toCalendarMaterialText(card?.actions);
  const resultText = toCalendarMaterialText(card?.result);
  const task = toCalendarMaterialText(card?.task);
  const situation = toCalendarMaterialText(card?.situation);

  if (action && resultText) return `${action}을 수행해 ${resultText} 성과 신호를 만들었습니다.`;
  if (task && action) return `${task}를 수행하기 위해 ${action}을 진행했습니다.`;
  if (situation && task) return `${situation} 상황에서 ${task}를 맡았습니다.`;
  return "이 경험은 이력서 문장으로 쓰기 전 구체 행동과 결과 보완이 필요합니다.";
}

// CAL-8F-2: awaited Google Calendar event delete before work_record row removal.
// Sends only recordId; Worker reads google_calendar_event_id server-side.
// Never throws — all failures are silently swallowed so PASSMAP delete always proceeds.
async function deleteGoogleCalendarEventForWorkRecord(recordId) {
  if (import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED !== "true") return;
  if (!recordId) return;
  const workerBase = (import.meta.env.VITE_AI_PROXY_URL || "").toString().trim();
  if (!workerBase) return;
  let accessToken = null;
  try {
    const session = await getSession();
    accessToken = session?.access_token ?? null;
  } catch (_) {}
  if (!accessToken) return;
  try {
    const res = await fetch(`${workerBase}/api/calendar/google/delete-record-event`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recordId }),
    });
    if (!res.ok) return;
    const resJson = await res.json();
    if (!resJson.ok) return;
  } catch (_) {}
}

export default function HomeDashboard({
  onOpenRecordInput = null,
  onOpenAiInbox = null,
  onOpenResumeResult = null,
  onOpenReadiness = null,
  onStartFirstRecordTour = null,
  onStartFullProductTour = null,
  records: recordsProp,
}) {
  const [dbRecords, setDbRecords] = useState([]);
  const [, setDbRecordsLoaded] = useState(false);
  const [experienceCardsByWorkRecordId, setExperienceCardsByWorkRecordId] = useState({});
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [firstRecordTourOpen, setFirstRecordTourOpen] = useState(false);

  // Notion import panel state (Round 7-E1: status + source selection only)
  const [notionPanelOpen, setNotionPanelOpen] = useState(false);
  const [notionStatus, setNotionStatus] = useState(null);
  const [notionSources, setNotionSources] = useState([]);
  const [notionSelectedSourceId, setNotionSelectedSourceId] = useState(null);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionError, setNotionError] = useState(null);
  const [notionSchema, setNotionSchema] = useState(null);
  const [notionPropertyMap, setNotionPropertyMap] = useState({
    title: "",
    recordDate: "",
    description: "",
    task: "",
    result: "",
    projectName: "",
    skillTags: "",
    strengthTags: "",
  });
  const [notionPreviewResult, setNotionPreviewResult] = useState(null);
  const [notionCommitResult, setNotionCommitResult] = useState(null);
  const [githubPrPanelOpen, setGithubPrPanelOpen] = useState(false);
  const [githubPrForm, setGithubPrForm] = useState(EMPTY_MANUAL_GITHUB_PR_FORM);
  const [githubPrSaving, setGithubPrSaving] = useState(false);
  const [githubPrError, setGithubPrError] = useState(null);
  const [githubPrResult, setGithubPrResult] = useState(null);
  const [githubConnection, setGithubConnection] = useState(null);
  const [githubConnectionLoading, setGithubConnectionLoading] = useState(false);
  const [githubRepositories, setGithubRepositories] = useState([]);
  const [githubRepoLoading, setGithubRepoLoading] = useState(false);
  const [githubRepoSaving, setGithubRepoSaving] = useState(false);
  const [githubRepoError, setGithubRepoError] = useState(null);
  const [githubRepoMessage, setGithubRepoMessage] = useState(null);
  const [githubConnectStarting, setGithubConnectStarting] = useState(false);
  const [githubRecentPrImporting, setGithubRecentPrImporting] = useState(false);
  const [githubRecentPrResult, setGithubRecentPrResult] = useState(null);
  const [githubDailyReviewLoading, setGithubDailyReviewLoading] = useState(false);
  const [githubDailyReviewResult, setGithubDailyReviewResult] = useState(null);

  // Google Calendar sync UI — hidden unless VITE_GOOGLE_CALENDAR_ENABLED=true (CAL-4B)
  const showGoogleCalendarSync = import.meta.env.VITE_GOOGLE_CALENDAR_ENABLED === "true";
  const [googleCalendarPanelOpen, setGoogleCalendarPanelOpen] = useState(false);
  const [googleCalendarConnecting, setGoogleCalendarConnecting] = useState(false);
  const [googleCalendarError, setGoogleCalendarError] = useState(null);
  const [googleCalendarMessage, setGoogleCalendarMessage] = useState(null);
  const [googleCalendarCreating, setGoogleCalendarCreating] = useState(false);
  const [googleCalendarCreateError, setGoogleCalendarCreateError] = useState(null);
  const [googleCalendarCreateMessage, setGoogleCalendarCreateMessage] = useState(null);
  const [googleCalendarSyncing, setGoogleCalendarSyncing] = useState(false);
  const [googleCalendarSyncError, setGoogleCalendarSyncError] = useState(null);
  const [googleCalendarSyncMessage, setGoogleCalendarSyncMessage] = useState(null);
  const [googleCalendarBackfilling, setGoogleCalendarBackfilling] = useState(false);
  const [googleCalendarBackfillProgress, setGoogleCalendarBackfillProgress] = useState(null);
  const [googleCalendarBackfillMessage, setGoogleCalendarBackfillMessage] = useState("");
  // CAL-8G-1: disconnect state
  const [googleCalendarDisconnecting, setGoogleCalendarDisconnecting] = useState(false);
  const [googleCalendarDisconnectError, setGoogleCalendarDisconnectError] = useState(null);
  const [googleCalendarDisconnectMessage, setGoogleCalendarDisconnectMessage] = useState(null);
  // CAL-8H-1: retry failed state
  const [googleCalendarRetryingFailed, setGoogleCalendarRetryingFailed] = useState(false);
  const [googleCalendarRetryFailedMessage, setGoogleCalendarRetryFailedMessage] = useState(null);
  const [googleCalendarRetryFailedError, setGoogleCalendarRetryFailedError] = useState(null);

  const isNotionRequiredMappingComplete =
    Boolean(notionPropertyMap.title) && Boolean(notionPropertyMap.recordDate);

  const defaultSelectedDate = todayDateStr();
  const [selectedDate, setSelectedDate] = useState(defaultSelectedDate);
  const [selectedProjectAction, setSelectedProjectAction] = useState(null);
  const [projectActionDraft, setProjectActionDraft] = useState(null);
  const [currentViewMonth, setCurrentViewMonth] = useState(() => currentYearMonth());
  const [calendarViewMode, setCalendarViewMode] = useState("grid");
  const [selectedExperienceSignalKey, setSelectedExperienceSignalKey] = useState("all");
  const [calendarToolsOpen, setCalendarToolsOpen] = useState(false);
  const [dateDetailOpen, setDateDetailOpen] = useState(false);
  const [calendarRecordCreateDraft, setCalendarRecordCreateDraft] = useState(null);
  const [monthlyAssetOpen, setMonthlyAssetOpen] = useState(false);
  const calendarDateDrawerRef = useRef(null);
  const githubCallbackHandledRef = useRef(false);
  const { toast } = useToast();

  const resolvedRecords = Array.isArray(recordsProp)
    ? recordsProp
    : authChecked && isLoggedIn
      ? dbRecords
      : homeDashboardMock.records;

  const shouldUseDemoRecords = !Array.isArray(recordsProp) && (!authChecked || !isLoggedIn);

  const realToday = todayDateStr();
  const data = {
    ...homeDashboardMock,
    records: resolvedRecords,
    today: realToday,
    calendarMonth: buildCalendarMonthViewModel({
      year: currentViewMonth.year,
      month: currentViewMonth.month,
      today: realToday,
    }),
    calendarLegend: shouldUseDemoRecords ? homeDashboardMock.calendarLegend : [],
  };

  const safeRecords = Array.isArray(data.records) ? data.records : [];
  const analysisRecords = useMemo(
    () => safeRecords.length > 0
      ? safeRecords.map(adaptExperienceRecordToCareerAssetSignalRecord)
      : EXPERIENCE_DEMO_RECORDS,
    [safeRecords]
  );
  const currentMonthHasRecords = safeRecords.some((record) =>
    recordTouchesMonth(record, data.calendarMonth.year, data.calendarMonth.month)
  );
  const shouldShowMonthEmptyNotice = !shouldUseDemoRecords && !currentMonthHasRecords;
  const monthEmptyNoticeText = safeRecords.length > 0
    ? "다른 달로 이동하거나 리스트 뷰에서 쌓인 경험 흐름을 확인해보세요."
    : "오늘 해결한 문제나 협업한 사람을 한 줄로 남기면 캘린더에 경험 신호가 쌓입니다.";
  // AI 이력서 문장 초안 CTA — 로그인 + 실제 업무기록이 있어야 활성.
  const canTriggerAiResume = !shouldUseDemoRecords && safeRecords.length > 0;

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }
    let cancelled = false;
    async function fetchRecords() {
      if (!cancelled) setDbRecordsLoaded(false);
      try {
        const rows = await listCalendarWorkRecords({ limit: 50 });
        const adaptedRows = rows.map(adaptWorkRecordRowForHomeDashboard);
        const workRecordIds = adaptedRows.map((record) => record.id).filter(Boolean);
        let cardsByRecordId = {};
        try {
          const cards = await listExperienceCardsForWorkRecordIds(workRecordIds);
          cardsByRecordId = cards.reduce((acc, card) => {
            const key = String(card?.work_record_id || "").trim();
            if (!key) return acc;
            if (!acc[key]) acc[key] = [];
            acc[key].push(card);
            return acc;
          }, {});
        } catch (_) {
          cardsByRecordId = {};
        }
        if (!cancelled) {
          setDbRecords(adaptedRows);
          setExperienceCardsByWorkRecordId(cardsByRecordId);
          setDbRecordsLoaded(true);
        }
      } catch (_) {
        if (!cancelled) {
          setDbRecords([]);
          setExperienceCardsByWorkRecordId({});
          setDbRecordsLoaded(false);
        }
      }
    }
    supabase.auth.getUser().then(({ data: authResult }) => {
      if (cancelled) return;
      const user = authResult?.user ?? null;
      setIsLoggedIn(Boolean(user));
      setCurrentUser(user);
      setAuthChecked(true);
      if (user) fetchRecords();
    }).catch(() => {
      if (!cancelled) {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setAuthChecked(true);
      }
    });
    let sub = null;
    try {
      sub = onAuthStateChange((event, session) => {
        if (cancelled) return;
        const user = session?.user ?? null;
        setIsLoggedIn(Boolean(user));
        setCurrentUser(user);
        setAuthChecked(true);
        if (event === "SIGNED_IN" && user) {
          fetchRecords();
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
          setDbRecords([]);
          setDbRecordsLoaded(false);
          setExperienceCardsByWorkRecordId({});
        }
      });
    } catch (_) {}
    const handleWorkRecordsChanged = () => { fetchRecords(); };
    window.addEventListener(PASSMAP_WORK_RECORDS_CHANGED_EVENT, handleWorkRecordsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PASSMAP_WORK_RECORDS_CHANGED_EVENT, handleWorkRecordsChanged);
      try { sub?.unsubscribe?.(); } catch (_) {}
    };
  }, []);

  const handleStartFirstRecordTour = () => {
    if (onStartFirstRecordTour) {
      onStartFirstRecordTour({ date: selectedDate });
      return;
    }
    setFirstRecordTourOpen(true);
  };

  const handleCalendarExport = () => {
    const success = downloadPassmapCalendarIcs(data.records);
    if (success) {
      toast({ title: "캘린더 파일을 다운로드했습니다.", description: "Google Calendar에서 가져오기로 추가할 수 있어요." });
    } else {
      toast({ title: "내보낼 기록이 아직 없습니다.", variant: "destructive" });
    }
  };

  const handleDeleteWorkRecord = async (record) => {
    if (!isLoggedIn) return;
    const recordId = record?.id;
    if (!recordId) return;
    const confirmed = window.confirm("이 기록을 삭제할까요?\n삭제한 기록은 되돌릴 수 없습니다.\nGoogle Calendar에 추가된 일정도 함께 삭제를 시도합니다.\n단, Calendar 삭제에 실패하면 일정이 남을 수 있습니다.");
    if (!confirmed) return;
    try {
      await deleteGoogleCalendarEventForWorkRecord(recordId);
      await deleteWorkRecord(recordId);
      window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
      toast({ title: "기록을 삭제했습니다." });
    } catch (_) {
      toast({ title: "기록을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", variant: "destructive" });
    }
  };

  const handleUpdateCalendarRecord = async (record, patch) => {
    if (!isLoggedIn) throw new Error("로그인이 필요합니다.");
    const recordId = record?.id;
    if (!recordId) throw new Error("수정할 기록을 찾을 수 없습니다.");
    const updatedRow = await updateWorkRecord(recordId, patch);
    const adaptedRow = adaptWorkRecordRowForHomeDashboard(updatedRow);
    setDbRecords((current) =>
      current.map((item) => (String(item?.id || "") === String(recordId) ? adaptedRow : item))
    );
    void updateGoogleCalendarEventForWorkRecord(recordId);
    window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
    toast({ title: "기록을 수정했습니다." });
    return adaptedRow;
  };

  const handleCreateCalendarRecord = async (patch) => {
    if (!isLoggedIn || !currentUser?.id) throw new Error("로그인이 필요합니다.");
    const recordDate = String(patch?.record_date || selectedDate || todayDateStr()).trim() || todayDateStr();
    const savedRow = await createWorkRecord({
      user_id: currentUser.id,
      record_date: recordDate,
      title: String(patch?.title || "").trim(),
      description: patch?.description || null,
      task: patch?.task || null,
      result: patch?.result || null,
      project_name: patch?.project_name || null,
      strength_tags: Array.isArray(patch?.strength_tags) ? patch.strength_tags : [],
      skill_tags: Array.isArray(patch?.skill_tags) ? patch.skill_tags : [],
      raw_payload: {
        source: "calendar-drawer",
      },
    });
    const adaptedRow = adaptWorkRecordRowForHomeDashboard(savedRow);
    setDbRecords((current) => [
      adaptedRow,
      ...current.filter((item) => String(item?.id || "") !== String(adaptedRow.id || "")),
    ]);
    setCalendarRecordCreateDraft(null);
    setSelectedDate(adaptedRow.date || recordDate);
    setDateDetailOpen(true);
    window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
    toast({ title: "새 경험 기록을 저장했어요." });
    return adaptedRow;
  };

  const handleCreateProjectActionRecord = async (payload) => {
    if (!isLoggedIn || !currentUser?.id) throw new Error("로그인이 필요합니다.");
    const savedRow = await createWorkRecord({
      ...payload,
      user_id: currentUser.id,
    });
    const adaptedRow = adaptWorkRecordRowForHomeDashboard(savedRow);
    setDbRecords((current) => [
      adaptedRow,
      ...current.filter((item) => String(item?.id || "") !== String(adaptedRow.id || "")),
    ]);
    setSelectedDate(adaptedRow.date || payload?.record_date || selectedDate);
    window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
    toast({ title: "프로젝트 Action으로 저장했습니다." });
    return adaptedRow;
  };

  const handleDeleteCalendarRecord = async (record) => {
    if (!isLoggedIn) return false;
    const recordId = record?.id;
    if (!recordId) return false;
    const confirmed = window.confirm("이 기록을 삭제할까요?\n삭제하면 캘린더와 기록 목록에서 사라집니다.");
    if (!confirmed) return false;
    try {
      await deleteGoogleCalendarEventForWorkRecord(recordId);
      await deleteWorkRecord(recordId);
      window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
      toast({ title: "기록을 삭제했습니다." });
      return true;
    } catch (error) {
      toast({ title: "기록을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.", variant: "destructive" });
      throw error;
    }
  };

  const getWorkerBase = () => {
    // Notion endpoints are owned by the Worker and must not fall back to Vercel.
    const base = (import.meta.env.VITE_AI_PROXY_URL || "").toString().trim();
    if (!base) {
      throw new Error("Notion 연동용 Worker URL이 설정되어 있지 않습니다. VITE_AI_PROXY_URL을 확인해 주세요.");
    }
    return base.replace(/\/$/, "");
  };

  const getPassmapApiBase = () => {
    const explicit = (import.meta.env.VITE_API_BASE || "").toString().trim();
    const worker = (import.meta.env.VITE_AI_PROXY_URL || "").toString().trim();
    return (explicit || worker).replace(/\/$/, "");
  };

  const postGithubConnectionAction = async (action, body = {}) => {
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      throw new Error("GitHub connection requires sign in.");
    }
    const apiBase = getPassmapApiBase();
    const res = await fetch(`${apiBase}/api/save-analysis-run?action=${action}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      const message = data?.error?.message || data?.warning?.message || `Request failed (${res.status})`;
      throw new Error(message);
    }
    return data;
  };

  const refreshGithubConnectionStatus = async () => {
    if (!isLoggedIn) return;
    setGithubConnectionLoading(true);
    try {
      const data = await postGithubConnectionAction("github_connection_status");
      setGithubConnection(data.connection || null);
    } catch (err) {
      setGithubConnection({
        connected: false,
        status: "unavailable",
        github_login: null,
        repositories_selected: 0,
      });
      setGithubRepoError(err.message || "Could not read GitHub connection status.");
    } finally {
      setGithubConnectionLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !isLoggedIn) return;
    void refreshGithubConnectionStatus();
  }, [authChecked, isLoggedIn]);

  useEffect(() => {
    if (!authChecked || !isLoggedIn || typeof window === "undefined") return;
    if (githubCallbackHandledRef.current) return;

    const callbackQuery = readGithubConnectionCallbackQuery(window.location.search);
    if (!callbackQuery.hasCandidate) return;
    githubCallbackHandledRef.current = true;

    if (!callbackQuery.isComplete) {
      setGithubRepoError(null);
      setGithubRepoMessage(
        "GitHub App 설치가 확인되면 PASSMAP에서 GitHub 연결하기를 다시 눌러 연결을 마무리하세요."
      );
      return;
    }

    let cancelled = false;
    async function finishGithubConnectionCallback() {
      setGithubConnectionLoading(true);
      setGithubRepoError(null);
      setGithubRepoMessage("GitHub 연결을 마무리하고 있어요.");
      try {
        const data = await postGithubConnectionAction(
          "github_connection_callback_stub",
          callbackQuery.payload
        );
        if (cancelled) return;
        await refreshGithubConnectionStatus();
        if (cancelled) return;
        clearGithubConnectionCallbackQuery();
        setGithubRepoMessage(
          data?.callback?.connected
            ? "GitHub 연결이 완료되었습니다. 저장소를 불러올 수 있어요."
            : "GitHub 연결 응답을 확인했습니다. 상태를 새로고침해 주세요."
        );
      } catch (err) {
        if (cancelled) return;
        setGithubConnectionLoading(false);
        setGithubRepoError(getSafeGithubConnectionMessage(
          err?.message,
          "GitHub 연결을 완료하지 못했습니다. 다시 시도해 주세요."
        ));
        setGithubRepoMessage(null);
      }
    }

    void finishGithubConnectionCallback();
    return () => {
      cancelled = true;
    };
    // Keep this callback path one-shot; the action helpers are intentionally local to the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, isLoggedIn]);

  const handleGithubConnectStart = async () => {
    setGithubConnectStarting(true);
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    try {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : "/";
      const data = await postGithubConnectionAction("github_connection_prepare", {
        return_to: returnTo,
      });
      const connect = data?.connect || {};
      const installationUrl = connect.installation_url || connect.install_url || connect.url || null;
      const state = connect.state || null;
      if (!installationUrl || !state) {
        throw new Error(data?.warning?.message || "GitHub 연결 URL을 준비하지 못했습니다.");
      }
      const url = new URL(installationUrl);
      url.searchParams.set("state", state);
      window.location.assign(url.toString());
    } catch (err) {
      setGithubRepoError(err.message || "GitHub 연결을 시작하지 못했습니다.");
    } finally {
      setGithubConnectStarting(false);
    }
  };

  const handleGithubInstalledAuthorizeStart = async () => {
    setGithubConnectStarting(true);
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    try {
      const returnTo =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : "/";
      const data = await postGithubConnectionAction("github_connection_prepare", {
        return_to: returnTo,
      });
      const authorizationUrl = data?.connect?.authorization_url || null;
      if (!authorizationUrl) {
        throw new Error(data?.warning?.message || "GitHub 인증 URL을 준비하지 못했습니다.");
      }
      window.location.assign(authorizationUrl);
    } catch (err) {
      setGithubRepoError(getSafeGithubConnectionMessage(
        err?.message,
        "GitHub 연결을 마무리하지 못했습니다. 다시 시도해 주세요."
      ));
    } finally {
      setGithubConnectStarting(false);
    }
  };

  const handleGithubRepositoryLoad = async () => {
    setGithubRepoLoading(true);
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    try {
      const data = await postGithubConnectionAction("github_repository_access_list");
      setGithubRepositories(Array.isArray(data.repositories) ? data.repositories : []);
      if (data.warning?.message) {
        setGithubRepoMessage(data.warning.message);
      } else {
        setGithubRepoMessage("분석할 저장소를 선택하세요.");
      }
    } catch (err) {
      setGithubRepoError(err.message || "저장소를 불러오지 못했습니다.");
    } finally {
      setGithubRepoLoading(false);
    }
  };

  const toggleGithubRepositorySelection = (repoId, selected) => {
    setGithubRepositories((current) =>
      current.map((repo) =>
        String(repo.github_repo_id) === String(repoId)
          ? { ...repo, selected }
          : repo
      )
    );
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    setGithubRecentPrResult(null);
    setGithubDailyReviewResult(null);
  };

  const handleGithubRepositorySelectionSave = async () => {
    setGithubRepoSaving(true);
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    try {
      const selectedRepoIds = githubRepositories
        .filter((repo) => repo.selected === true)
        .map((repo) => String(repo.github_repo_id));
      const data = await postGithubConnectionAction("github_repository_access_select", {
        selected_repo_ids: selectedRepoIds,
      });
      setGithubRepoMessage(
        `${Number(data.repositories_selected || 0)}개 저장소를 선택했어요. 최근 PR을 불러올 수 있습니다.`
      );
      setGithubRecentPrResult(null);
      setGithubDailyReviewResult(null);
      void refreshGithubConnectionStatus();
    } catch (err) {
      setGithubRepoError(err.message || "저장소 선택을 저장하지 못했습니다.");
    } finally {
      setGithubRepoSaving(false);
    }
  };

  const handleGithubRecentPullRequestsImport = async () => {
    setGithubRecentPrImporting(true);
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    setGithubRecentPrResult(null);
    setGithubDailyReviewResult(null);
    try {
      const data = await postGithubConnectionAction("github_recent_pull_requests_import", {
        lookback_days: 14,
        per_repo_limit: 10,
      });
      setGithubRecentPrResult(data);
      if (data.warning?.message) {
        setGithubRepoMessage(data.warning.message);
      } else {
        setGithubRepoMessage(`업무 후보 ${Number(data.candidates_created || 0)}건을 만들었어요. AI 작업기록함에서 확인하세요.`);
      }
      if (Number(data.candidates_created || 0) > 0) {
        window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
      }
    } catch (err) {
      setGithubRepoError(err.message || "최근 PR을 불러오지 못했습니다.");
    } finally {
      setGithubRecentPrImporting(false);
    }
  };

  const handleGithubDailyReviewRequest = async () => {
    setGithubDailyReviewLoading(true);
    setGithubRepoError(null);
    setGithubRepoMessage(null);
    setGithubDailyReviewResult(null);
    try {
      const data = await postGithubConnectionAction("github_daily_review_request", {
        lookback_days: 1,
        per_repo_limit: 10,
      });
      setGithubDailyReviewResult(data);
      const createdCount = Number(data.candidates_created || 0);
      if (data.warning?.message) {
        setGithubRepoMessage(data.review?.message || data.warning.message);
      } else if (createdCount > 0) {
        setGithubRepoMessage(`오늘 GitHub 활동에서 업무 후보 ${createdCount}건을 만들었어요.`);
      } else {
        setGithubRepoMessage("오늘 새로 찾은 GitHub 업무 후보가 없어요.");
      }
      if (createdCount > 0) {
        window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
      }
    } catch (err) {
      setGithubRepoError(err.message || "오늘 GitHub 업무 후보를 만들지 못했습니다.");
    } finally {
      setGithubDailyReviewLoading(false);
    }
  };

  const setGithubPrFormField = (field, value) => {
    setGithubPrForm((prev) => ({ ...prev, [field]: value }));
    setGithubPrError(null);
  };

  const handleGithubPrManualImport = async () => {
    setGithubPrSaving(true);
    setGithubPrError(null);
    setGithubPrResult(null);

    let payload;
    try {
      payload = buildManualGithubPrImportPayload(githubPrForm);
    } catch (err) {
      setGithubPrSaving(false);
      setGithubPrError(err.message || "필수 입력을 확인해 주세요.");
      return;
    }

    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setGithubPrSaving(false);
      setGithubPrError("인증이 필요합니다. 로그인 후 다시 시도해 주세요.");
      return;
    }

    try {
      const apiBase = getPassmapApiBase();
      const res = await fetch(`${apiBase}/api/save-analysis-run?action=github_pr_preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const message = data?.error?.message || data?.error || `저장 실패 (${res.status})`;
        throw new Error(message);
      }
      setGithubPrResult(buildManualGithubPrImportDisplay(data));
      toast({
        title: "GitHub PR 기반 경력 후보가 생성되었습니다.",
        description: "AI 작업기록 Inbox에서 이력서 문장을 검토할 수 있어요.",
      });
    } catch (err) {
      setGithubPrError(err.message || "GitHub PR 후보 저장에 실패했습니다.");
    } finally {
      setGithubPrSaving(false);
    }
  };

  const handleNotionImportClick = async () => {
    setNotionPanelOpen(true);
    setNotionLoading(true);
    setNotionError(null);
    setNotionSources([]);
    setNotionSelectedSourceId(null);
    setNotionSchema(null);
    setNotionPropertyMap({ title: "", recordDate: "", description: "", task: "", result: "", projectName: "", skillTags: "", strengthTags: "" });
    setNotionPreviewResult(null);
    setNotionCommitResult(null);

    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setNotionLoading(false);
      setNotionError(err.message || "Worker URL이 설정되어 있지 않습니다. .env.local에 VITE_AI_PROXY_URL을 설정해 주세요.");
      return;
    }

    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setNotionLoading(false);
      setNotionError("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }

    try {
      const statusRes = await fetch(`${workerBase}/api/notion/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!statusRes.ok) throw new Error(`상태 확인 실패 (${statusRes.status})`);
      const statusData = await statusRes.json();
      setNotionStatus(statusData);

      if (!statusData.connected) {
        setNotionLoading(false);
        return;
      }

      const sourcesRes = await fetch(`${workerBase}/api/notion/sources`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!sourcesRes.ok) throw new Error(`소스 목록 조회 실패 (${sourcesRes.status})`);
      const sourcesData = await sourcesRes.json();
      setNotionSources(Array.isArray(sourcesData.sources) ? sourcesData.sources : []);
    } catch (err) {
      setNotionError(err.message || "Notion 연결 확인 중 오류가 발생했습니다.");
    } finally {
      setNotionLoading(false);
    }
  };

  const handleNotionAuthUrlClick = async () => {
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setNotionError(err.message || "Notion 가져오기 서버 주소를 확인할 수 없습니다. 배포 환경변수 VITE_AI_PROXY_URL 설정을 확인해 주세요.");
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setNotionError("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    try {
      const res = await fetch(`${workerBase}/api/notion/auth-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`인증 URL 요청 실패 (${res.status})`);
      const data = await res.json();
      if (data.authUrl) {
        window.open(data.authUrl, "_blank", "noopener,noreferrer");
      } else {
        setNotionError("Notion 인증 URL을 받지 못했습니다.");
      }
    } catch (err) {
      setNotionError(err.message || "Notion 연결 URL 요청 중 오류가 발생했습니다.");
    }
  };

  // CAL-5C-HELPER: Google Calendar OAuth connect/start — dev/hidden flag only
  const handleGoogleCalendarConnectStart = async () => {
    setGoogleCalendarConnecting(true);
    setGoogleCalendarError(null);
    setGoogleCalendarMessage(null);
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (_) {
      setGoogleCalendarError("Google Calendar 연결에 실패했습니다. 다시 시도해 주세요.");
      setGoogleCalendarConnecting(false);
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setGoogleCalendarError("로그인이 필요합니다.");
      setGoogleCalendarConnecting(false);
      return;
    }
    try {
      const res = await fetch(`${workerBase}/api/calendar/google/connect/start`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setGoogleCalendarError("Google Calendar 연결에 실패했습니다. 다시 시도해 주세요.");
        setGoogleCalendarConnecting(false);
        return;
      }
      if (json.authUrl) {
        setGoogleCalendarMessage("Google 동의 화면을 열었습니다.");
        window.open(json.authUrl, "_blank", "noopener,noreferrer");
      } else {
        setGoogleCalendarError("Google Calendar 연결에 실패했습니다. 다시 시도해 주세요.");
      }
    } catch (_) {
      setGoogleCalendarError("Google Calendar 연결에 실패했습니다. 다시 시도해 주세요.");
    }
    setGoogleCalendarConnecting(false);
  };

  // CAL-8G-1: Google Calendar disconnect handler — dev/hidden panel only
  const handleGoogleCalendarDisconnect = async () => {
    const confirmed = window.confirm(
      "Google Calendar 연동을 해제할까요?\n앞으로 PASSMAP 기록은 Google Calendar에 자동 동기화되지 않습니다.\n이미 생성된 Google Calendar 일정은 삭제되지 않습니다."
    );
    if (!confirmed) return;
    setGoogleCalendarDisconnecting(true);
    setGoogleCalendarDisconnectError(null);
    setGoogleCalendarDisconnectMessage(null);
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (_) {
      setGoogleCalendarDisconnectError("연동 해제에 실패했습니다. 다시 시도해 주세요.");
      setGoogleCalendarDisconnecting(false);
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {}
    if (!accessToken) {
      setGoogleCalendarDisconnectError("연동 해제에 실패했습니다. 다시 시도해 주세요.");
      setGoogleCalendarDisconnecting(false);
      return;
    }
    try {
      const res = await fetch(`${workerBase}/api/calendar/google/disconnect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const resJson = await res.json();
      if (!res.ok || !resJson.ok) {
        setGoogleCalendarDisconnectError("연동 해제에 실패했습니다. 다시 시도해 주세요.");
        setGoogleCalendarDisconnecting(false);
        return;
      }
      setGoogleCalendarDisconnectMessage("Google Calendar 연동을 해제했습니다. 기존 일정은 유지됩니다.");
    } catch (_) {
      setGoogleCalendarDisconnectError("연동 해제에 실패했습니다. 다시 시도해 주세요.");
    }
    setGoogleCalendarDisconnecting(false);
  };

  // CAL-8H-1: retry failed records — dev/hidden panel only
  const handleGoogleCalendarRetryFailedRecords = async () => {
    setGoogleCalendarRetryingFailed(true);
    setGoogleCalendarRetryFailedError(null);
    setGoogleCalendarRetryFailedMessage(null);
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (_) {
      setGoogleCalendarRetryFailedError("연동 실패 기록 재시도에 실패했습니다. 다시 시도해 주세요.");
      setGoogleCalendarRetryingFailed(false);
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {}
    if (!accessToken) {
      setGoogleCalendarRetryFailedError("연동 실패 기록 재시도에 실패했습니다. 다시 시도해 주세요.");
      setGoogleCalendarRetryingFailed(false);
      return;
    }
    try {
      const res = await fetch(`${workerBase}/api/calendar/google/retry-failed-records`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });
      const resJson = await res.json();
      if (!res.ok || !resJson.ok) {
        setGoogleCalendarRetryFailedError("연동 실패 기록 재시도에 실패했습니다. 다시 시도해 주세요.");
        setGoogleCalendarRetryingFailed(false);
        return;
      }
      const { synced = 0, failed = 0, skipped = 0 } = resJson;
      setGoogleCalendarRetryFailedMessage(
        `연동 실패 기록 재시도를 완료했습니다. 성공 ${synced}건 · 실패 ${failed}건 · 건너뜀 ${skipped}건`
      );
      if (synced > 0) {
        window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
      }
    } catch (_) {
      setGoogleCalendarRetryFailedError("연동 실패 기록 재시도에 실패했습니다. 다시 시도해 주세요.");
    }
    setGoogleCalendarRetryingFailed(false);
  };

  // CAL-6C-HELPER: PASSMAP 전용 Google Calendar 생성 — dev/hidden flag only
  const handleGoogleCalendarCreatePassmapCalendar = async () => {
    setGoogleCalendarCreating(true);
    setGoogleCalendarCreateError(null);
    setGoogleCalendarCreateMessage(null);
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setGoogleCalendarCreateError(err.message || "Worker URL이 설정되어 있지 않습니다. VITE_AI_PROXY_URL을 확인해 주세요.");
      setGoogleCalendarCreating(false);
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setGoogleCalendarCreateError("로그인이 필요합니다.");
      setGoogleCalendarCreating(false);
      return;
    }
    try {
      const res = await fetch(`${workerBase}/api/calendar/google/create-passmap-calendar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const resJson = await res.json();
      if (!res.ok || !resJson.ok) {
        setGoogleCalendarCreateError("캘린더 준비에 실패했습니다. 다시 시도해 주세요.");
        setGoogleCalendarCreating(false);
        return;
      }
      if (resJson.created) {
        setGoogleCalendarCreateMessage("Google Calendar에 'PASSMAP 기록' 캘린더를 만들었습니다.");
      } else {
        setGoogleCalendarCreateMessage("캘린더가 준비되었습니다.");
      }
    } catch (_) {
      setGoogleCalendarCreateError("캘린더 준비에 실패했습니다. 다시 시도해 주세요.");
    }
    setGoogleCalendarCreating(false);
  };

  // CAL-7C: sync-record test — dev/hidden flag only
  const handleGoogleCalendarSyncRecord = async () => {
    const selectedRecordId = activeEntry?.records?.[0]?.id || null;
    if (!selectedRecordId) {
      setGoogleCalendarSyncError("먼저 기록을 선택해 주세요.");
      return;
    }
    setGoogleCalendarSyncing(true);
    setGoogleCalendarSyncError(null);
    setGoogleCalendarSyncMessage(null);
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setGoogleCalendarSyncError(err.message || "Worker URL이 설정되어 있지 않습니다. VITE_AI_PROXY_URL을 확인해 주세요.");
      setGoogleCalendarSyncing(false);
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setGoogleCalendarSyncError("로그인이 필요합니다.");
      setGoogleCalendarSyncing(false);
      return;
    }
    try {
      const res = await fetch(`${workerBase}/api/calendar/google/sync-record`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recordId: selectedRecordId }),
      });
      const resJson = await res.json();
      if (!res.ok || !resJson.ok) {
        setGoogleCalendarSyncError(`Google Calendar 동기화에 실패했습니다: ${resJson.error ?? res.status}`);
        setGoogleCalendarSyncing(false);
        return;
      }
      if (resJson.skipped) {
        setGoogleCalendarSyncMessage("이미 동기화된 기록입니다.");
      } else {
        setGoogleCalendarSyncMessage("Google Calendar에 기록을 추가했습니다.");
        window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
      }
    } catch (err) {
      setGoogleCalendarSyncError(err.message || "Google Calendar 동기화에 실패했습니다.");
    }
    setGoogleCalendarSyncing(false);
  };

  // CAL-8B: backfill — sequentially syncs all currently-loaded records (max 50)
  const handleGoogleCalendarBackfill = async () => {
    const targetRecords = safeRecords.filter((r) => r?.id).slice(0, 50);
    if (!targetRecords.length) {
      setGoogleCalendarBackfillMessage("동기화할 기록이 없습니다.");
      return;
    }
    setGoogleCalendarBackfilling(true);
    setGoogleCalendarBackfillProgress({ done: 0, total: targetRecords.length, synced: 0, skipped: 0, failed: 0 });
    setGoogleCalendarBackfillMessage("");
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setGoogleCalendarBackfillMessage(err.message || "Worker URL이 설정되어 있지 않습니다. VITE_AI_PROXY_URL을 확인해 주세요.");
      setGoogleCalendarBackfilling(false);
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setGoogleCalendarBackfillMessage("로그인이 필요합니다.");
      setGoogleCalendarBackfilling(false);
      return;
    }
    let synced = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of targetRecords) {
      try {
        const res = await fetch(`${workerBase}/api/calendar/google/sync-record`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ recordId: record.id }),
        });
        const resJson = await res.json();
        if (!res.ok || !resJson.ok) {
          failed++;
        } else if (resJson.skipped) {
          skipped++;
        } else {
          synced++;
        }
      } catch (_) {
        failed++;
      }
      const done = synced + skipped + failed;
      setGoogleCalendarBackfillProgress({ done, total: targetRecords.length, synced, skipped, failed });
    }
    setGoogleCalendarBackfillMessage(`완료: ${synced}건 동기화, ${skipped}건 건너뜀, ${failed}건 실패`);
    if (synced > 0) {
      window.dispatchEvent(new CustomEvent(PASSMAP_WORK_RECORDS_CHANGED_EVENT));
    }
    setGoogleCalendarBackfilling(false);
  };

  const handleNotionLoadSchema = async () => {
    if (!notionSelectedSourceId) {
      setNotionError("데이터 소스를 먼저 선택해 주세요.");
      return;
    }
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setNotionError(err.message || "Notion 가져오기 서버 주소를 확인할 수 없습니다. 배포 환경변수 VITE_AI_PROXY_URL 설정을 확인해 주세요.");
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setNotionError("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setNotionLoading(true);
    setNotionError(null);
    setNotionSchema(null);
    setNotionPreviewResult(null);
    setNotionCommitResult(null);
    try {
      const res = await fetch(
        `${workerBase}/api/notion/source-schema?data_source_id=${encodeURIComponent(notionSelectedSourceId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) throw new Error(`스키마 조회 실패 (${res.status})`);
      const schemaData = await res.json();
      if (!schemaData.ok) throw new Error(schemaData.error || "스키마 조회에 실패했습니다.");
      setNotionSchema(schemaData);
      const props = Array.isArray(schemaData.properties) ? schemaData.properties : [];
      const titleProp = props.find((p) => p.type === "title");
      const dateProp = props.find((p) => p.type === "date");
      setNotionPropertyMap((prev) => ({
        ...prev,
        title: titleProp?.name ?? prev.title,
        recordDate: dateProp?.name ?? prev.recordDate,
      }));
    } catch (err) {
      setNotionError(err.message || "스키마 조회 중 오류가 발생했습니다.");
    } finally {
      setNotionLoading(false);
    }
  };

  const handleNotionPreview = async () => {
    if (!isNotionRequiredMappingComplete) {
      setNotionError("제목과 날짜 속성을 먼저 선택해 주세요.");
      return;
    }
    if (!notionSelectedSourceId) {
      setNotionError("데이터 소스를 먼저 선택해 주세요.");
      return;
    }
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setNotionError(err.message || "Notion 가져오기 서버 주소를 확인할 수 없습니다. 배포 환경변수 VITE_AI_PROXY_URL 설정을 확인해 주세요.");
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setNotionError("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setNotionLoading(true);
    setNotionError(null);
    setNotionPreviewResult(null);
    setNotionCommitResult(null);
    try {
      const cleanPropertyMap = Object.fromEntries(
        Object.entries(notionPropertyMap).filter(([, v]) => Boolean(v))
      );
      const res = await fetch(`${workerBase}/api/notion/preview`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataSourceId: notionSelectedSourceId,
          propertyMap: cleanPropertyMap,
          defaults: {
            recordType: "weekly",
            workType: "이번 주 기록",
          },
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `미리보기 요청 실패 (${res.status})`);
      }
      const previewData = await res.json();
      if (!previewData.ok) throw new Error(previewData.error || "미리보기 조회에 실패했습니다.");
      setNotionPreviewResult(previewData);
    } catch (err) {
      setNotionError(err.message || "미리보기 조회 중 오류가 발생했습니다.");
    } finally {
      setNotionLoading(false);
    }
  };

  const handleNotionCommit = async () => {
    if (!notionPreviewResult) return;
    const selectedPreviewIds = notionPreviewResult.items
      .filter((item) => item.commitEligible)
      .map((item) => item.previewId)
      .filter(Boolean);
    if (selectedPreviewIds.length === 0) {
      setNotionError("저장 가능한 새 기록이 없습니다.");
      return;
    }
    let workerBase;
    try {
      workerBase = getWorkerBase();
    } catch (err) {
      setNotionError(err.message || "Notion 가져오기 서버 주소를 확인할 수 없습니다. 배포 환경변수 VITE_AI_PROXY_URL 설정을 확인해 주세요.");
      return;
    }
    let accessToken = null;
    try {
      const session = await getSession();
      accessToken = session?.access_token ?? null;
    } catch (_) {
      accessToken = null;
    }
    if (!accessToken) {
      setNotionError("로그인 세션을 확인할 수 없습니다. 다시 로그인해 주세요.");
      return;
    }
    setNotionLoading(true);
    setNotionError(null);
    try {
      const cleanPropertyMap = Object.fromEntries(
        Object.entries(notionPropertyMap).filter(([, v]) => Boolean(v))
      );
      const res = await fetch(`${workerBase}/api/notion/commit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataSourceId: notionSelectedSourceId,
          propertyMap: cleanPropertyMap,
          defaults: {
            recordType: "weekly",
            workType: "이번 주 기록",
          },
          selectedPreviewIds,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `가져오기 요청 실패 (${res.status})`);
      }
      const commitData = await res.json();
      if (!commitData.ok) throw new Error(commitData.error || "가져오기에 실패했습니다.");
      setNotionCommitResult(commitData);
      if ((commitData.summary?.committed ?? 0) > 0) {
        window.dispatchEvent(new CustomEvent("passmap:work-records-changed"));
      }
    } catch (err) {
      setNotionError(err.message || "가져오기 중 오류가 발생했습니다.");
    } finally {
      setNotionLoading(false);
    }
  };

  const handleGoToday = () => {
    setCurrentViewMonth(currentYearMonth());
    setSelectedDate(todayDateStr());
  };

  const handleSelectCalendarDate = (date) => {
    if (!date) return;
    setSelectedProjectAction(null);
    setProjectActionDraft(null);
    setCalendarRecordCreateDraft(null);
    setSelectedDate(date);
    setDateDetailOpen(true);
    window.requestAnimationFrame(() => {
      calendarDateDrawerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      calendarDateDrawerRef.current?.focus?.({ preventScroll: true });
    });
  };

  const handleSelectProjectAction = (action) => {
    if (!action) return;
    setCalendarRecordCreateDraft(null);
    setProjectActionDraft(null);
    setSelectedProjectAction(action);
    if (action.date) setSelectedDate(action.date);
    setDateDetailOpen(true);
    window.setTimeout(() => {
      calendarDateDrawerRef.current?.focus?.();
      calendarDateDrawerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleOpenProjectActionDraft = (draft) => {
    if (!draft) return;
    setCalendarRecordCreateDraft(null);
    setSelectedProjectAction(null);
    setProjectActionDraft(draft);
    if (draft.date || draft.startDate) setSelectedDate(draft.date || draft.startDate);
    setDateDetailOpen(true);
    window.setTimeout(() => {
      calendarDateDrawerRef.current?.focus?.();
      calendarDateDrawerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const handleOpenCalendarRecordCreateDraft = (draft = {}) => {
    const date = String(draft?.date || selectedDate || todayDateStr()).trim();
    if (!date) return;
    setSelectedProjectAction(null);
    setProjectActionDraft(null);
    setCalendarRecordCreateDraft({
      ...draft,
      date,
      requestId: `${Date.now()}_${Math.random()}`,
    });
    setSelectedDate(date);
    setDateDetailOpen(true);
    window.setTimeout(() => {
      calendarDateDrawerRef.current?.focus?.();
      calendarDateDrawerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const entriesByDate = useMemo(() => buildCalendarEntriesByDate(data.records), [data.records]);
  const weekDates = useMemo(() => getWorkCalendarWeekDays(selectedDate), [selectedDate]);
  const sortedAllRecords = useMemo(
    () =>
      [...(shouldUseDemoRecords ? PASSMAP_DEMO_RANGE_RECORDS : []), ...data.records].sort((a, b) => {
        const aDate = a.startDate || a.date || "";
        const bDate = b.startDate || b.date || "";
        return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
      }),
    [data.records, shouldUseDemoRecords]
  );
  const visibleListRecords = useMemo(() => {
    if (selectedExperienceSignalKey === "all") return sortedAllRecords;
    return [
      ...sortedAllRecords.filter((record) => recordHasExperienceSignal(record, selectedExperienceSignalKey)),
      ...sortedAllRecords.filter((record) => !recordHasExperienceSignal(record, selectedExperienceSignalKey)),
    ];
  }, [sortedAllRecords, selectedExperienceSignalKey]);
  const activeEntry = useMemo(() => entriesByDate[selectedDate] || null, [entriesByDate, selectedDate]);
  const activeEntryMaterialCards = useMemo(() => {
    const recordIds = (activeEntry?.records || [])
      .map((record) => String(record?.id || "").trim())
      .filter(Boolean);
    return recordIds
      .flatMap((id) => experienceCardsByWorkRecordId[id] || [])
      .slice(0, 3);
  }, [activeEntry, experienceCardsByWorkRecordId]);
  const googleCalendarSyncStatusSummary = useMemo(
    () => buildGoogleCalendarSyncStatusSummary(safeRecords),
    [safeRecords]
  );
  const googleCalendarStatusRecord = activeEntry?.records?.[0] || safeRecords[0] || null;
  const googleCalendarStatusLabel = googleCalendarStatusRecord
    ? getGoogleCalendarSyncStatusLabel(googleCalendarStatusRecord.googleCalendarSyncStatus)
    : "동기화할 경험을 기다리는 중";
  const calendarSummary = useMemo(
    () =>
      deriveCalendarSummary({
        records: data.records,
        selectedDate,
        today: data.today,
      }),
    [data.records, selectedDate, data.today]
  );
  const calendarMonthSummary = useMemo(
    () =>
      buildMonthlyCalendarSummary({
        records: data.records,
        cardsByRecordId: experienceCardsByWorkRecordId,
        year: data.calendarMonth.year,
        month: data.calendarMonth.month,
      }),
    [data.records, experienceCardsByWorkRecordId, data.calendarMonth.year, data.calendarMonth.month]
  );
  const calendarWeekSummary = useMemo(
    () =>
      buildWeeklyCalendarSummary({
        records: data.records,
        cardsByRecordId: experienceCardsByWorkRecordId,
        weekDates,
      }),
    [data.records, experienceCardsByWorkRecordId, weekDates]
  );
  const calendarProjectGroups = useMemo(
    () =>
      buildProjectGroupsFromRecords(
        [
          ...(shouldUseDemoRecords
            ? PASSMAP_DEMO_RANGE_RECORDS.filter((record) => (record.rawPayload || record.raw_payload)?.track === "project")
            : []),
          ...data.records,
        ],
        experienceCardsByWorkRecordId,
        data.today
      ),
    [data.records, experienceCardsByWorkRecordId, data.today, shouldUseDemoRecords]
  );
  const activeProjectAction = useMemo(() => {
    if (!selectedProjectAction) return null;
    const selectedRecordId = String(selectedProjectAction.recordId || "").trim();
    const selectedActionId = String(selectedProjectAction.id || "").trim();
    return calendarProjectGroups
      .flatMap((group) => group.actions)
      .find((action) => {
        if (selectedRecordId && String(action.recordId || "") === selectedRecordId) return true;
        return selectedActionId && String(action.id || "") === selectedActionId;
      }) || null;
  }, [calendarProjectGroups, selectedProjectAction]);
  const calendarRecommendedActions = useMemo(
    () =>
      buildCalendarRecommendedActions({
        records: data.records,
        selectedDate,
        monthSummary: calendarMonthSummary,
        weekSummary: calendarWeekSummary,
        projectGroups: calendarProjectGroups,
      }),
    [data.records, selectedDate, calendarMonthSummary, calendarWeekSummary, calendarProjectGroups]
  );
  const recentExperienceAnalysis = useMemo(() => {
    const records = Array.isArray(analysisRecords) ? analysisRecords : [];
    const fallbackPatterns = [
      { label: "문제 정의", pct: 92 },
      { label: "데이터 기반 개선", pct: 85 },
      { label: "의사결정 조율", pct: 68 },
    ];
    const fallbackJobMatch = {
      score: 72,
      label: "기록 기반 연결도",
      positions: [
        { rank: 1, title: "서비스기획 · PM", badge: "연결 높음" },
        { rank: 2, title: "프로덕트 전략", badge: null },
        { rank: 3, title: "운영기획", badge: null },
      ],
    };
    const signals = buildCareerAssetSignals(records, { fallbackJobMatch });
    const patterns = Array.isArray(signals.patterns) && signals.patterns.length
      ? signals.patterns
      : fallbackPatterns;
    const strengths = records.length > 0 ? patterns.slice(0, 3).map((pattern) => ({
      label: pattern.label,
      score: typeof pattern.pct === "number" ? pattern.pct : 68,
    })) : [];
    const roles = (
      records.length > 0 && Array.isArray(signals.jobMatch?.positions) && signals.jobMatch.positions.length
        ? signals.jobMatch.positions
        : fallbackJobMatch.positions
    ).map((position) => position.title).slice(0, records.length > 0 ? 3 : 0);
    const topStrengthLabels = strengths.slice(0, 2).map((item) => item.label);

    return {
      recordCount: records.length,
      strengths,
      roles,
      insightMain:
        records.length > 0
          ? `${topStrengthLabels.join("과 ")} 경험이 강점으로 나타나고 있어요!`
          : "첫 기록을 남기면 경험 신호를 찾아드릴게요!",
      insightSub:
        records.length > 0
          ? `지금까지 기록한 ${records.length}개의 경험이 이력서 후보로 정리될 수 있어요.`
          : "오늘 한 일을 한 줄만 남겨도 경험 흐름이 쌓이기 시작해요.",
    };
  }, [analysisRecords]);
  const activeDateLabel = useMemo(() => {
    const date = new Date(`${selectedDate}T00:00:00`);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  }, [selectedDate]);
  const activeEntryPrimaryTask =
    activeEntry?.tasks?.[0] ||
    activeEntry?.records?.[0]?.title ||
    activeEntry?.records?.[0]?.summary ||
    getCalendarWorkTypeLabel(activeEntry?.records?.[0]?.workType) ||
    getCalendarWorkTypeLabel(activeEntry?.workTypes?.[0]) ||
    "업무 기록";
  const activeEntryWorkTypes = activeEntry?.workTypes?.length
    ? activeEntry.workTypes
    : [activeEntry?.records?.[0]?.workType].filter(Boolean);
  const activeEntrySpecificWorkTypes = activeEntryWorkTypes.filter((type) => !GENERIC_WORK_TYPES.has(type));
  const activeEntryVisibleWorkTypes = (activeEntrySpecificWorkTypes.length ? activeEntrySpecificWorkTypes : activeEntryWorkTypes).slice(0, 2);
  const activeExperienceSignals = useMemo(
    () => deriveExperienceSignalsFromRecords(activeEntry?.records || []),
    [activeEntry]
  );
  const activeConnectableRoles = useMemo(
    () => deriveConnectableRolesFromRecords(activeEntry?.records || []),
    [activeEntry]
  );
  const activeNextAction = useMemo(
    () => deriveExperienceFlowAction(activeEntry?.records || []),
    [activeEntry]
  );
  const monthlyFlowRecords = useMemo(
    () => data.records.filter((record) => recordTouchesMonth(record, data.calendarMonth.year, data.calendarMonth.month)),
    [data.records, data.calendarMonth.year, data.calendarMonth.month]
  );
  const monthlyAssetSummary = useMemo(() => deriveMonthlyAssetSummary(monthlyFlowRecords), [monthlyFlowRecords]);
  const monthlySignalRecords = useMemo(
    () => [
      ...(shouldUseDemoRecords ? PASSMAP_DEMO_RANGE_RECORDS : []),
      ...monthlyFlowRecords,
    ].filter((record) => recordTouchesMonth(record, data.calendarMonth.year, data.calendarMonth.month)),
    [monthlyFlowRecords, shouldUseDemoRecords, data.calendarMonth.year, data.calendarMonth.month]
  );
  const experienceSignalFilterOptions = useMemo(
    () => buildExperienceSignalFilterOptions(monthlySignalRecords),
    [monthlySignalRecords]
  );
  const selectedExperienceSignalOption = experienceSignalFilterOptions.find((item) => item.key === selectedExperienceSignalKey)
    || experienceSignalFilterOptions[0];
  const selectedExperienceSignalCount = selectedExperienceSignalOption?.count ?? 0;
  const selectedExperienceSignalLabel = getExperienceSignalLabel(selectedExperienceSignalKey);
  const selectedExperienceSignalEmptyMessage =
    selectedExperienceSignalKey !== "all" && selectedExperienceSignalCount === 0
      ? getExperienceSignalEmptyMessage(selectedExperienceSignalKey)
      : "";
  const monthlyExperienceSignals = useMemo(
    () => deriveExperienceSignalsFromRecords(monthlyFlowRecords, 3),
    [monthlyFlowRecords]
  );
  const monthlyConnectableRoles = useMemo(
    () => deriveConnectableRolesFromRecords(monthlyFlowRecords, 2),
    [monthlyFlowRecords]
  );
  const monthlyResumeCandidateValue = monthlyAssetSummary.reflectedSentenceCount > 0
    ? `${monthlyAssetSummary.reflectedSentenceCount}개`
    : "후보로 정리할 재료를 쌓는 중";
  const bottomRecentRecords = useMemo(
    () =>
      [...safeRecords]
        .sort((a, b) => String(b?.date || b?.startDate || "").localeCompare(String(a?.date || a?.startDate || "")))
        .slice(0, 3),
    [safeRecords]
  );
  const bottomExperienceSignals = useMemo(
    () => deriveExperienceSignalsFromRecords(bottomRecentRecords, 4),
    [bottomRecentRecords]
  );
  const bottomConnectableRoles = useMemo(
    () => deriveConnectableRolesFromRecords(bottomRecentRecords, 3),
    [bottomRecentRecords]
  );
  const bottomComplementSignals = useMemo(() => {
    const text = bottomRecentRecords.map(getRecordSearchText).join(" ");
    const signals = [];
    if (!/\d/.test(text)) signals.push("정량 성과");
    if (!/(고객|사용자|문의|VOC|피드백|응대)/i.test(text)) signals.push("사용자 반응");
    if (!/(매출|비용|전환|유지|리텐션|효율|비즈니스|성과|임팩트)/.test(text)) signals.push("비즈니스 임팩트");
    if (!/(협업|조율|공유|커뮤니케이션|회의|전달|정렬)/.test(text)) signals.push("협업 맥락");
    return signals.length ? signals.slice(0, 3) : ["정량 성과", "사용자 반응", "비즈니스 임팩트"];
  }, [bottomRecentRecords]);
  const bottomExperienceSummary = bottomRecentRecords.length
    ? `최근 경험에서는 ${(bottomExperienceSignals.length ? bottomExperienceSignals : ["문제 해결", "협업 조율"]).slice(0, 2).join("과 ")} 신호가 반복적으로 보이고 있어요.`
    : "아직 최근 경험 흐름을 만들 기록이 충분하지 않아요. 오늘 해결한 문제나 협업한 내용을 한 줄만 남기면 이곳에 경험 흐름이 쌓이기 시작합니다.";
  const bottomInsightActions = [
    {
      title: "정량 성과 보완하기",
      description: "최근 경험에는 실행 과정은 잘 남아 있지만 결과 수치가 아직 덜 드러납니다.",
      expected: "처리 건수, 개선률, 사용자 반응을 추가하면 PM/운영기획 직무에서 이력서 후보의 설득력이 높아져요.",
      cta: "성과 정보 추가하기",
      onClick: () => handleOpenCalendarRecordCreateDraft({ date: selectedDate, source: "calendar-sidebar-recommendation" }),
    },
    {
      title: "협업 맥락 선명하게 만들기",
      description: "경험에 협업 정황은 보이지만 누구와 어떤 기준을 맞췄는지가 더 드러나면 좋아요.",
      expected: "팀, 부서, 고객, 개발자 등 이해관계자를 함께 적으면 커뮤니케이션 역량이 더 분명해집니다.",
      cta: "협업 맥락 보완하기",
      onClick: () => handleOpenCalendarRecordCreateDraft({ date: selectedDate, source: "calendar-sidebar-recommendation" }),
    },
    {
      title: "이력서 후보로 확인하기",
      description: bottomExperienceSignals.length
        ? `최근 경험에서 ${bottomExperienceSignals.slice(0, 2).join("과 ")} 신호가 보입니다.`
        : "최근 경험이 어떤 후보 문장으로 이어질 수 있는지 확인해보세요.",
      expected: "이 경험이 이력서 후보에서 어떻게 정리되는지 확인해보세요.",
      cta: "이력서 후보 보기",
      onClick: onOpenResumeResult || undefined,
    },
  ].filter((item) => item.onClick).slice(0, 3);

  const githubSelectedRepositoryCount = Number(githubConnection?.repositories_selected || 0);
  const githubHasUnsavedSelectedRepositories = githubRepositories.some((repo) => repo.selected === true);
  const githubHasSelectedRepositories = githubSelectedRepositoryCount > 0 || githubHasUnsavedSelectedRepositories;
  const githubRecentCandidateCount = Number(githubRecentPrResult?.candidates_created || 0);
  const githubHasRecentCandidates = githubRecentCandidateCount > 0;
  const autoCollectionPrimaryLabel = !githubConnection?.connected
    ? "GitHub 연결하기"
    : !githubHasSelectedRepositories
      ? "저장소 선택하기"
      : githubHasRecentCandidates
        ? "업무 후보 확인하기"
        : "최근 PR 불러오기";
  const autoCollectionPrimaryLoading = githubConnectStarting || githubRepoLoading || githubRecentPrImporting;
  const handleAutoCollectionPrimaryAction = () => {
    if (!githubConnection?.connected) {
      return handleGithubConnectStart();
    }
    if (!githubHasSelectedRepositories) {
      return handleGithubRepositoryLoad();
    }
    if (githubHasRecentCandidates) {
      return onOpenAiInbox?.();
    }
    return handleGithubRecentPullRequestsImport();
  };

  const calendarViewMeta = {
    grid: {
      title: "패스맵 그리드 뷰",
      description: "한 달의 경험 기록 밀도와 깊이를 한눈에 확인합니다.",
      cardTitle: `${data.calendarMonth.year}년 ${data.calendarMonth.month}월`,
      cardDescription: "기록 상태에 따라 날짜 색상이 달라집니다.",
      insight: "이번 달 기록 중 일부는 키워드만 남아 있습니다. 면접 답변으로 발전시키기 좋은 경험을 골라 행동과 결과를 보강해보세요.",
      metricLabel: "이번 달 기록률",
      metricValue: calendarMonthSummary.recordRate,
      metricColor: "bg-violet-600",
      actionLabel: "새로운 경험 기록",
    },
    weekly: {
      title: "패스맵 위클리 뷰",
      description: "업무 관리와 경험 정리를 한 주 단위로 모아보는 화면 제안",
      cardTitle: "날짜별 경험 정리",
      cardDescription: "각 날짜 카드에서 업무, 면접 준비, 지원 활동, 회고를 추가합니다.",
      insight: "지원 활동은 꾸준하지만, 경험 기록의 근거 문장이 부족합니다. 이번 주에는 프로젝트별 성과 수치를 한 줄씩 보강해보세요.",
      metricLabel: "이번주 기록 완성도",
      metricValue: calendarWeekSummary.completionRate,
      metricColor: "bg-emerald-500",
      actionLabel: "새로운 경험 기록",
    },
    project: {
      title: "패스맵 프로젝트 뷰",
      description: "지원 준비, 포트폴리오, 면접 준비처럼 기간이 있는 일을 Action으로 관리합니다.",
      cardTitle: "프로젝트 Action 보드",
      cardDescription: "오늘 기준으로 늦어진 일과 다음 Action을 한눈에 확인하세요.",
      insight: "프로젝트별 Action을 날짜 축 위에 놓고 보면 오늘 먼저 정리해야 할 일과 다음에 이어갈 일을 더 빠르게 확인할 수 있습니다.",
      metricLabel: "이번주 Action 달성률",
      metricValue: Math.min(100, Math.max(0, calendarProjectGroups.length ? Math.round((calendarProjectGroups.filter((group) => group.actions.some((action) => action.status === "completed")).length / calendarProjectGroups.length) * 100) : 0)),
      metricColor: "bg-violet-600",
      actionLabel: "이번 주 할 일 추가하기",
    },
  };
  const activeCalendarViewMeta = calendarViewMeta[calendarViewMode] || calendarViewMeta.grid;
  const calendarWeekRangeLabel = formatWeekRangeLabel(weekDates);
  const sidebarRecommendations = (calendarRecommendedActions.length ? calendarRecommendedActions : [
    { id: "fallback-1", title: "비어 있는 날짜에 한 줄 기록 남기기", description: "가장 최근 업무 흐름을 끊기지 않게 이어갑니다." },
    { id: "fallback-2", title: "키워드 기록에 결과 수치 추가하기", description: "면접 답변으로 바꿀 근거를 보강합니다." },
    { id: "fallback-3", title: "프로젝트 Action 기간 정리하기", description: "이번 주 실행 계획을 타임라인에 맞춥니다." },
  ]).slice(0, 3);

  const openCalendarViewHeaderAction = () => {
    if (calendarViewMode === "project") {
      handleOpenProjectActionDraft({
        date: selectedDate,
        startDate: selectedDate,
        endDate: selectedDate,
        mode: "project-action",
        track: "project",
        source: "calendar-view-header",
        actionStatus: "planned",
        raw_payload: {
          mode: "project-action",
          track: "project",
          source: "calendar-view-header",
          actionStatus: "planned",
        },
      });
      return;
    }
    onOpenRecordInput?.({ date: selectedDate, source: "calendar-view-header" });
  };

  const openSidebarRecommendationAction = () => {
    if (calendarViewMode === "project") {
      const recommendedAction = sidebarRecommendations[0] || null;
      handleOpenProjectActionDraft({
        date: selectedDate,
        startDate: selectedDate,
        endDate: selectedDate,
        mode: "project-action",
        track: "project",
        source: "calendar-sidebar-recommendation",
        actionStatus: "planned",
        recommendedAction,
        title: recommendedAction?.title || "",
        description: recommendedAction?.description || "",
        raw_payload: {
          mode: "project-action",
          track: "project",
          source: "calendar-sidebar-recommendation",
          actionStatus: "planned",
          recommendedAction,
        },
      });
      return;
    }
    handleOpenCalendarRecordCreateDraft({ date: selectedDate, mode: "project-action", source: "calendar-sidebar-recommendation" });
  };

  return (
    <div className="space-y-4">
      <FirstRecordGuidedTour
        open={!onStartFirstRecordTour && firstRecordTourOpen}
        variant="web"
        selectedDate={selectedDate}
        onOpenRecordInput={(opts) => {
          if (onOpenRecordInput) onOpenRecordInput({ date: selectedDate, ...opts });
        }}
        onClose={() => setFirstRecordTourOpen(false)}
        onComplete={() => setFirstRecordTourOpen(false)}
      />

      <AiCaptureOnboardingCard
        onOpenAiInbox={onOpenAiInbox}
        primaryActionLabel={autoCollectionPrimaryLabel}
        primaryActionLoading={autoCollectionPrimaryLoading}
        primaryActionDisabled={!isLoggedIn && !githubConnection?.connected}
        onPrimaryAction={handleAutoCollectionPrimaryAction}
      />

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              GitHub
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-950 sm:text-[22px]">
              GitHub PR 자동 분석
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              선택한 저장소의 merged PR을 읽고 업무 후보를 만듭니다.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 rounded-full px-3 text-sm text-slate-500 hover:bg-slate-50"
            disabled={githubConnectionLoading}
            onClick={refreshGithubConnectionStatus}
          >
            상태 새로고침
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">
            {githubConnectionLoading
              ? "GitHub 상태를 확인하고 있어요."
              : githubConnection?.connected
                ? githubHasRecentCandidates
                  ? `업무 후보 ${githubRecentCandidateCount}건을 만들었어요.`
                  : githubHasSelectedRepositories
                    ? "선택한 저장소의 최근 PR을 분석할 수 있습니다."
                    : "GitHub가 연결되었습니다."
                : "아직 GitHub가 연결되지 않았어요."}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {githubConnection?.connected
              ? githubHasRecentCandidates
                ? "AI 작업기록함에서 만든 업무 후보를 확인하세요."
                : githubHasSelectedRepositories
                  ? "선택한 저장소의 merged PR을 분석해 업무 후보를 만들어요."
                  : "분석할 저장소를 선택하세요."
              : "연결하면 최근 PR을 자동으로 분석할 수 있습니다."}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {!githubConnection?.connected ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={githubConnectStarting}
                onClick={handleGithubConnectStart}
              >
                {githubConnectStarting ? "연결 준비 중..." : "GitHub 연결하기"}
              </Button>
            ) : githubHasRecentCandidates ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                onClick={onOpenAiInbox || undefined}
              >
                업무 후보 확인하기
              </Button>
            ) : githubHasSelectedRepositories ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-full border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={githubRecentPrImporting}
                  onClick={handleGithubRecentPullRequestsImport}
                >
                  {githubRecentPrImporting ? "불러오는 중..." : "최근 PR 불러오기"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-4 text-sm font-semibold text-slate-500 hover:bg-white"
                  disabled={githubDailyReviewLoading}
                  onClick={handleGithubDailyReviewRequest}
                >
                  {githubDailyReviewLoading ? "만드는 중..." : "오늘 업무 후보 만들기"}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-full border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={githubRepoLoading}
                onClick={handleGithubRepositoryLoad}
              >
                {githubRepoLoading ? "불러오는 중..." : "저장소 불러오기"}
              </Button>
            )}
          </div>

          {!githubConnection?.connected ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-9 rounded-full px-4 text-sm font-semibold text-slate-500 hover:bg-white"
              disabled={githubConnectStarting}
              onClick={handleGithubInstalledAuthorizeStart}
            >
              이미 설치했다면 연결 마무리
            </Button>
          ) : null}

          {githubRepoError ? (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
              {githubRepoError}
            </p>
          ) : null}
          {githubRepoMessage ? (
            <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-700">
              {githubRepoMessage}
            </p>
          ) : null}
          {githubDailyReviewResult?.ok ? (
            <div className="mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                onClick={onOpenAiInbox || undefined}
              >
                업무 후보 확인하기
              </Button>
            </div>
          ) : null}

          {githubRepositories.length > 0 ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-semibold text-slate-950">분석할 저장소를 선택하세요.</p>
              <div className="grid gap-2 lg:grid-cols-2">
                {githubRepositories.map((repo) => (
                  <label
                    key={repo.github_repo_id}
                    className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-950"
                      checked={repo.selected === true}
                      onChange={(event) => toggleGithubRepositorySelection(repo.github_repo_id, event.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-950">{repo.full_name}</span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {repo.private ? "비공개" : "공개"} 저장소
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-slate-500">
                  저장소 선택 후 최근 merged PR을 분석할 수 있습니다.
                </p>
                <Button
                  size="sm"
                  className="h-9 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
                  disabled={githubRepoSaving}
                  onClick={handleGithubRepositorySelectionSave}
                >
                  {githubRepoSaving ? "저장 중..." : "선택 저장"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              고급 옵션
            </div>
            <h3 className="mt-3 text-lg font-semibold leading-snug text-slate-950 sm:text-[22px]">
              수동 PR 입력
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              GitHub 연결이 어려운 경우에만 PR 정보를 직접 입력합니다.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setGithubPrPanelOpen((prev) => !prev)}
          >
            {githubPrPanelOpen ? "입력 닫기" : "수동 입력 열기"}
          </Button>
        </div>

        {githubPrPanelOpen ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  Repository full name 또는 URL
                  <input
                    value={githubPrForm.repository}
                    onChange={(event) => setGithubPrFormField("repository", event.target.value)}
                    placeholder="owner/repo 또는 https://github.com/owner/repo/pull/123"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  PR number
                  <input
                    value={githubPrForm.prNumber}
                    onChange={(event) => setGithubPrFormField("prNumber", event.target.value)}
                    inputMode="numeric"
                    placeholder="123"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs font-semibold text-slate-600">
                PR title
                <input
                  value={githubPrForm.title}
                  onChange={(event) => setGithubPrFormField("title", event.target.value)}
                  placeholder="예: Add candidate inbox surfacing"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold text-slate-600">
                PR body / summary
                <textarea
                  value={githubPrForm.body}
                  onChange={(event) => setGithubPrFormField("body", event.target.value)}
                  rows={3}
                  placeholder="PR에서 해결한 문제, 구현 범위, 검증 내용을 짧게 입력하세요."
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  merged_at
                  <input
                    value={githubPrForm.mergedAt}
                    onChange={(event) => setGithubPrFormField("mergedAt", event.target.value)}
                    placeholder="2026-06-14T06:00:00Z"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  additions
                  <input
                    value={githubPrForm.additions}
                    onChange={(event) => setGithubPrFormField("additions", event.target.value)}
                    inputMode="numeric"
                    placeholder="140"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                  />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  deletions
                  <input
                    value={githubPrForm.deletions}
                    onChange={(event) => setGithubPrFormField("deletions", event.target.value)}
                    inputMode="numeric"
                    placeholder="5"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-violet-300"
                  />
                </label>
              </div>

              <label className="block space-y-1 text-xs font-semibold text-slate-600">
                changed files summary
                <textarea
                  value={githubPrForm.changedFilesSummary}
                  onChange={(event) => setGithubPrFormField("changedFilesSummary", event.target.value)}
                  rows={4}
                  placeholder="filename, status, additions, deletions"
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-normal text-slate-900 outline-none focus:border-violet-300"
                />
              </label>

              {githubPrError ? (
                <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
                  {githubPrError}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-9 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                  disabled={githubPrSaving}
                  onClick={handleGithubPrManualImport}
                >
                  {githubPrSaving ? "저장 중..." : "경력 후보 만들기"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-4 text-sm text-slate-600 hover:bg-white"
                  onClick={() => {
                    setGithubPrForm(EMPTY_MANUAL_GITHUB_PR_FORM);
                    setGithubPrResult(null);
                    setGithubPrError(null);
                  }}
                >
                  입력 초기화
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              {githubPrResult?.ok ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">GitHub PR 기반 경력 후보가 생성되었습니다.</p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-700">
                      이미 같은 PR 후보가 있으면 기존 후보를 재사용합니다. AI 작업기록 Inbox에서 이력서 문장을 검토할 수 있어요.
                    </p>
                  </div>
                  <div className="space-y-2 rounded-xl border border-emerald-100 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-950">{githubPrResult.workTitle}</p>
                    <p className="text-xs leading-relaxed text-slate-600">{githubPrResult.summary}</p>
                    {githubPrResult.suggestedResumeBullet ? (
                      <p className="rounded-lg bg-slate-50 px-2 py-2 text-xs leading-relaxed text-slate-700">
                        {githubPrResult.suggestedResumeBullet}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">status: {githubPrResult.status || "accepted"}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">evidence {githubPrResult.evidenceCount}</span>
                      {githubPrResult.candidateId ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">candidate {githubPrResult.candidateId.slice(0, 8)}</span>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    onClick={onOpenAiInbox || undefined}
                  >
                    AI 작업기록 Inbox에서 확인하기
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-emerald-900">저장 후 Inbox에서 검토</p>
                  <p className="text-xs leading-relaxed text-emerald-700">
                    저장 응답에는 candidate_id, raw_source_id, dedupe_key, status, preview만 표시합니다. raw PR payload, full diff, token, secret은 화면에 표시하지 않습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

      <Card className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
        <CardHeader className="space-y-2 border-b border-slate-100 bg-slate-50/80 pb-3 sm:space-y-4 sm:pb-6">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 sm:px-2.5 sm:py-1 sm:text-[13px]">
              #경험 정리
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 sm:px-2.5 sm:py-1 sm:text-[13px]">
              #경험 기록
            </span>
          </div>

          <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-[22px] leading-tight tracking-tight text-slate-950 sm:text-[30px]">경력 기록 흐름</CardTitle>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">자동으로 감지된 업무와 직접 기록한 경험이 어떻게 쌓이고 있는지 확인합니다.</p>
            </div>

            <div className="flex flex-wrap gap-1.5 xl:justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 rounded-full px-3 text-sm text-slate-500 hover:bg-white hover:text-violet-700 sm:h-9 sm:px-4 sm:text-[15px]"
                onClick={onStartFullProductTour || handleStartFirstRecordTour}
              >
                PASSMAP 기능 둘러보기
              </Button>
              <Button
                variant="outline"
                size="sm"
                data-tour-id={FIRST_RECORD_TOUR_IDS.homeRecordCta}
                className="h-8 rounded-full border-primary/20 bg-primary/5 px-3 text-sm text-primary shadow-sm hover:bg-primary/10 hover:text-primary sm:h-9 sm:px-4 sm:text-[15px]"
                onClick={onOpenRecordInput ? () => onOpenRecordInput({ date: selectedDate }) : undefined}
              >
                경험 정리하기
              </Button>
              <Button variant="outline" size="sm" className="h-8 rounded-full border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 sm:h-9 sm:px-4 sm:text-[15px]" onClick={onOpenResumeResult || undefined}>
                이력서 후보 보기
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-3 sm:p-5">
          <section className="space-y-4">
            <div className="flex justify-end">
              <Button
                size="sm"
                className="h-10 rounded-full bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 sm:px-5 sm:text-[15px]"
                onClick={onOpenRecordInput ? () => onOpenRecordInput({ date: selectedDate }) : undefined}
              >
                경험 기록하기 +
              </Button>
            </div>

            <div className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-white via-violet-50/40 to-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1.05fr_1.2fr_1fr]">
                <div className="flex min-w-0 flex-col rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-violet-700">이번 주 인사이트</div>
                  <p className="mt-3 text-xl font-semibold leading-snug text-slate-950 sm:text-[24px]">
                    {recentExperienceAnalysis.insightMain}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {recentExperienceAnalysis.insightSub}
                  </p>
                  <div className="mt-5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-full border-violet-200 bg-white px-4 text-sm font-semibold text-violet-700 hover:bg-violet-50"
                      onClick={onOpenResumeResult || (onOpenRecordInput ? () => onOpenRecordInput({ date: selectedDate }) : undefined)}
                    >
                      인사이트 자세히 보기
                    </Button>
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">강하게 나타나는 역량 TOP 3</div>
                  <div className="mt-4 space-y-3">
                    {recentExperienceAnalysis.strengths.length > 0 ? (
                      recentExperienceAnalysis.strengths.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-sm font-semibold text-slate-800">{item.label}</span>
                            <span className="shrink-0 text-sm font-semibold text-violet-700">{item.score}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-violet-500"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm leading-relaxed text-slate-500">
                        기록이 쌓이면 반복해서 드러나는 역량을 TOP 3로 보여드릴게요.
                      </p>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-slate-500">
                    기록 기반 신호 강도이며, 확정 진단이 아닌 방향 참고용입니다.
                  </p>
                </div>

                <div className="min-w-0 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="text-sm font-semibold text-slate-900">연결 가능한 직무</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recentExperienceAnalysis.roles.length > 0 ? (
                      recentExperienceAnalysis.roles.map((role) => (
                        <span key={role} className="rounded-full border border-violet-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm sm:text-sm">
                          {role}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-4 text-sm leading-relaxed text-slate-500">
                        경험 기록을 남기면 연결 가능한 직무를 추려드릴게요.
                      </span>
                    )}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    최근 경험 신호가 위 직무와 연결될 수 있어요.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{activeCalendarViewMeta.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{activeCalendarViewMeta.description}</p>
                {calendarViewMode === "weekly" ? (
                  <span className="mt-3 inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {calendarWeekRangeLabel}
                  </span>
                ) : null}
              </div>
              {onOpenRecordInput || calendarViewMode === "project" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-2xl border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  onClick={openCalendarViewHeaderAction}
                >
                  <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white">+</span>
                  {activeCalendarViewMeta.actionLabel}
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="flex gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-sky-500 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">이번주 주목할만한 인사이트</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{activeCalendarViewMeta.insight}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold text-slate-500">{activeCalendarViewMeta.metricLabel}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{activeCalendarViewMeta.metricValue}%</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className={`h-full rounded-full ${activeCalendarViewMeta.metricColor}`} style={{ width: `${activeCalendarViewMeta.metricValue}%` }} />
                </div>
              </div>
            </div>
          </section>

          <div
            className={[
              "grid gap-3 sm:gap-4",
              calendarViewMode === "project" ? "" : "xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]",
            ].join(" ")}
          >
            <Card className="min-w-0 rounded-2xl border-slate-200 shadow-none">
              <CardHeader className="pb-3">
                <SectionHeader
                  title={activeCalendarViewMeta.cardTitle}
                  description={activeCalendarViewMeta.cardDescription}
                  action={
                    <div className="relative flex flex-col items-end gap-1">
                      <button
                        type="button"
                        data-tour-id="home-calendar-import-export-menu"
                        className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                        onClick={() => setCalendarToolsOpen(v => !v)}
                      >
                        연동 설정
                        <ChevronDown className={`h-3 w-3 transition-transform ${calendarToolsOpen ? "rotate-180" : ""}`} />
                      </button>
                      {calendarToolsOpen && (
                        <div className="absolute right-0 top-full z-20 mt-1 flex flex-col gap-0.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-md min-w-[180px]">
                          <Button
                            variant="ghost"
                            size="sm"
                            data-tour-id="home-calendar-notion-import-button"
                            className="justify-start rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                            onClick={handleNotionImportClick}
                          >
                            Notion에서 가져오기
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="justify-start rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                            onClick={handleCalendarExport}
                          >
                            캘린더 파일(.ics) 다운로드
                          </Button>
                          {showGoogleCalendarSync && (
                            <Button
                              variant="ghost"
                              size="sm"
                              data-tour-id="home-calendar-google-sync-button"
                              className="justify-start rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                              onClick={() => setGoogleCalendarPanelOpen(prev => !prev)}
                            >
                              {googleCalendarPanelOpen ? "Google Calendar 설정 닫기" : "Google Calendar 설정"}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  }
                />
              </CardHeader>
              <CardContent className="space-y-4">
                {notionPanelOpen && (
                  <div data-tour-id="home-notion-import-panel" className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-indigo-900">Notion 기록 가져오기</p>
                      <p className="text-xs text-indigo-700 leading-relaxed">
                        Notion에 쌓아둔 업무 기록을 PASSMAP 커리어 기록으로 가져오기 위한 준비 단계입니다.
                        이번 단계에서는 연결 상태와 가져올 Notion 데이터 소스만 확인합니다.
                      </p>
                    </div>
                    {notionLoading && (
                      <p className="text-xs text-indigo-600">Notion 연결 상태를 확인하는 중...</p>
                    )}
                    {notionError && (
                      <p className="text-xs text-red-600">{notionError}</p>
                    )}
                    {!notionLoading && notionStatus && !notionStatus.connected && (
                      <div className="space-y-2">
                        <p className="text-xs text-indigo-800">
                          Notion 연결이 필요합니다. 연결 후 이 화면으로 돌아와 &quot;상태 다시 확인&quot;을 눌러주세요.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full text-xs border-indigo-300 text-indigo-700 hover:bg-indigo-100"
                            onClick={handleNotionAuthUrlClick}
                          >
                            Notion 연결하기
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-full text-xs"
                            onClick={handleNotionImportClick}
                          >
                            상태 다시 확인
                          </Button>
                        </div>
                      </div>
                    )}
                    {!notionLoading && notionStatus?.connected && (
                      <div className="space-y-2">
                        <p className="text-xs text-indigo-800">
                          연결된 Notion 워크스페이스에서 가져올 데이터 소스를 선택해 주세요.
                        </p>
                        {notionSources.length === 0 && (
                          <p className="text-xs text-slate-500">가져올 수 있는 데이터 소스가 없습니다.</p>
                        )}
                        {notionSources.length > 0 && (
                          <div className="space-y-1">
                            {notionSources.map((src) => {
                              const srcId = src.dataSourceId || src.id;
                              const isDisabled = src.schemaReadable === false;
                              const isSelected = notionSelectedSourceId === srcId;
                              return (
                                <button
                                  key={srcId}
                                  type="button"
                                  disabled={isDisabled}
                                  onClick={() => !isDisabled && setNotionSelectedSourceId(srcId)}
                                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition
                                    ${isDisabled
                                      ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                                      : isSelected
                                        ? "border-indigo-400 bg-indigo-100 text-indigo-900"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50"
                                    }`}
                                >
                                  <span className="font-medium">{src.title || srcId}</span>
                                  {isDisabled && (
                                    <span className="ml-2 text-[10px] text-slate-400">스키마를 읽을 수 없는 항목</span>
                                  )}
                                  {!isDisabled && (
                                    <span className="ml-2 text-[10px] text-slate-400">{srcId}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {notionSchema && !notionLoading && (
                      <div className="space-y-3 border-t border-indigo-100 pt-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-indigo-900">속성 매핑 설정</p>
                          <p className="text-xs text-indigo-700 leading-relaxed">
                            선택한 Notion 데이터 소스의 속성을 PASSMAP 커리어 기록 항목에 연결합니다.
                            이번 단계에서는 어떤 Notion 속성을 제목, 날짜, 업무 내용으로 사용할지만 정합니다.
                          </p>
                          <p className="text-[10px] text-indigo-600">
                            제목과 날짜는 가져오기 미리보기에 반드시 필요합니다.
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-slate-400">
                            감지된 속성 ({(notionSchema.properties || []).length}개)
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(notionSchema.properties || []).slice(0, 12).map((p) => (
                              <span
                                key={p.id ?? p.name}
                                className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600"
                              >
                                {p.name}
                                <span className="text-slate-400">({p.type})</span>
                              </span>
                            ))}
                            {(notionSchema.properties || []).length > 12 && (
                              <span className="text-[10px] text-slate-400">
                                +{(notionSchema.properties || []).length - 12}개
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          {[
                            { fieldKey: "title",        label: "제목",       required: true,  preferredTypes: ["title", "rich_text"] },
                            { fieldKey: "recordDate",   label: "날짜",       required: true,  preferredTypes: ["date"] },
                            { fieldKey: "description",  label: "설명",       required: false, preferredTypes: ["rich_text"] },
                            { fieldKey: "task",         label: "업무 내용",  required: false, preferredTypes: ["rich_text"] },
                            { fieldKey: "result",       label: "성과/결과",  required: false, preferredTypes: ["rich_text"] },
                            { fieldKey: "projectName",  label: "프로젝트명", required: false, preferredTypes: ["rich_text", "select"] },
                            { fieldKey: "skillTags",    label: "스킬 태그",  required: false, preferredTypes: ["multi_select", "select"] },
                            { fieldKey: "strengthTags", label: "강점 태그",  required: false, preferredTypes: ["multi_select", "select"] },
                          ].map(({ fieldKey, label, required, preferredTypes }) => {
                            const currentVal = notionPropertyMap[fieldKey];
                            const currentProp = (notionSchema.properties || []).find((p) => p.name === currentVal);
                            const typeMismatch = currentProp && !preferredTypes.includes(currentProp.type);
                            return (
                              <div key={fieldKey} className="flex items-center gap-2">
                                <label className="w-20 shrink-0 text-[10px] font-medium text-slate-600">
                                  {label}
                                  {required && <span className="ml-0.5 text-red-400">*</span>}
                                </label>
                                <select
                                  value={currentVal}
                                  onChange={(e) =>
                                    setNotionPropertyMap((prev) => ({ ...prev, [fieldKey]: e.target.value }))
                                  }
                                  className="flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 focus:border-indigo-400 focus:outline-none"
                                >
                                  <option value="">매핑 안 함</option>
                                  {(notionSchema.properties || []).map((p) => (
                                    <option key={p.id ?? p.name} value={p.name}>
                                      {p.name} ({p.type}){preferredTypes.includes(p.type) ? " ★" : ""}
                                    </option>
                                  ))}
                                </select>
                                {typeMismatch && (
                                  <span className="text-[9px] text-amber-500 shrink-0">타입 불일치</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {notionPropertyMap.title && notionPropertyMap.recordDate ? (
                          <p className="text-[10px] text-emerald-600">필수 매핑 완료</p>
                        ) : (
                          <p className="text-[10px] text-amber-600">제목과 날짜 속성은 반드시 선택해야 합니다</p>
                        )}
                      </div>
                    )}
                    {notionPreviewResult && !notionLoading && (
                      <div className="space-y-3 border-t border-indigo-100 pt-3">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-indigo-900">가져오기 미리보기</p>
                          <p className="text-xs text-indigo-700 leading-relaxed">
                            선택한 Notion 기록을 PASSMAP 커리어 기록으로 가져오기 전에 미리 확인합니다.
                            아직 저장되지는 않습니다.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {notionPreviewResult.summary.total > 0 && (
                            <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                              전체 {notionPreviewResult.summary.total}건
                            </span>
                          )}
                          {notionPreviewResult.summary.new > 0 && (
                            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                              신규 {notionPreviewResult.summary.new}건
                            </span>
                          )}
                          {notionPreviewResult.summary.duplicate > 0 && (
                            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500">
                              이미 가져옴 {notionPreviewResult.summary.duplicate}건
                            </span>
                          )}
                          {notionPreviewResult.summary.pendingUpdate > 0 && (
                            <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">
                              업데이트 필요 {notionPreviewResult.summary.pendingUpdate}건
                            </span>
                          )}
                          {notionPreviewResult.summary.invalid > 0 && (
                            <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-600">
                              가져올 수 없음 {notionPreviewResult.summary.invalid}건
                            </span>
                          )}
                          {notionPreviewResult.summary.previouslyImportedDeleted > 0 && (
                            <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">
                              이전 기록 삭제됨 {notionPreviewResult.summary.previouslyImportedDeleted}건
                            </span>
                          )}
                          {!notionCommitResult && notionPreviewResult.items.filter((i) => i.commitEligible).length > 0 && (
                            <span className="rounded border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                              저장 가능 {notionPreviewResult.items.filter((i) => i.commitEligible).length}건
                            </span>
                          )}
                        </div>
                        {Array.isArray(notionPreviewResult.items) && notionPreviewResult.items.length > 0 && (
                          <div className="max-h-52 space-y-1 overflow-y-auto">
                            {notionPreviewResult.items.map((item) => {
                              const STATUS_CONFIG = {
                                new:                         { label: "신규",              cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
                                duplicate:                   { label: "이미 가져옴",        cls: "border-slate-200 bg-slate-50 text-slate-500" },
                                pending_update:              { label: "업데이트 필요",      cls: "border-amber-200 bg-amber-50 text-amber-700" },
                                invalid:                     { label: "가져올 수 없음",     cls: "border-red-200 bg-red-50 text-red-600" },
                                previously_imported_deleted: { label: "이전 기록 삭제됨",  cls: "border-slate-200 bg-slate-100 text-slate-400" },
                              };
                              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, cls: "border-slate-200 bg-white text-slate-600" };
                              return (
                                <div key={item.previewId} className="rounded-lg border border-slate-100 bg-white px-3 py-2 space-y-0.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="truncate text-xs font-medium text-slate-800">
                                      {item.mapped?.title || "(제목 없음)"}
                                    </p>
                                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium ${cfg.cls}`}>
                                      {cfg.label}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-400">
                                    {item.mapped?.recordDate || item.mapped?.startDate || "날짜 없음"}
                                  </p>
                                  {item.status === "pending_update" && (
                                    <p className="text-[9px] text-amber-600 leading-relaxed">
                                      Notion 원본 내용이 이전에 가져온 기록과 달라졌습니다. 자동으로 덮어쓰지 않고 다음 단계에서 별도 처리합니다.
                                    </p>
                                  )}
                                  {item.status === "duplicate" && (
                                    <p className="text-[9px] text-slate-400">이미 PASSMAP으로 가져온 기록입니다.</p>
                                  )}
                                  {item.status === "invalid" && (
                                    <p className="text-[9px] text-red-500">제목 또는 날짜 등 필수 정보가 부족해 가져올 수 없습니다.</p>
                                  )}
                                  {item.validation?.errors?.length > 0 && (
                                    <p className="text-[9px] text-red-400">오류: {item.validation.errors.join(", ")}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {notionCommitResult && (
                          <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 space-y-1">
                            {(notionCommitResult.summary?.committed ?? 0) > 0 ? (
                              <>
                                <p className="text-xs font-semibold text-indigo-800">
                                  {notionCommitResult.summary.committed}개의 기록을 PASSMAP 커리어 기록으로 가져왔습니다.
                                </p>
                                <p className="text-[10px] text-indigo-600">날짜별 경험 신호에 반영되었습니다.</p>
                              </>
                            ) : (
                              <p className="text-xs text-slate-600">
                                {(notionCommitResult.summary?.total ?? 0) === 0
                                  ? "가져올 수 있는 항목이 없습니다. 날짜·제목 매핑이나 선택 항목을 다시 확인해 주세요."
                                  : (notionCommitResult.summary?.skipped_duplicate ?? 0) > 0
                                    ? "새로 저장된 항목은 없습니다. 이미 가져온 기록이거나 중복으로 제외된 항목입니다."
                                    : "새로 저장된 기록은 없습니다."}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {(notionCommitResult.summary?.skipped_duplicate ?? 0) > 0 && (
                                <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-500">
                                  이미 가져온 기록 {notionCommitResult.summary.skipped_duplicate}건
                                </span>
                              )}
                              {(notionCommitResult.summary?.skipped_pending_update ?? 0) > 0 && (
                                <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-600">
                                  업데이트 필요 {notionCommitResult.summary.skipped_pending_update}건
                                </span>
                              )}
                              {(notionCommitResult.summary?.skipped_invalid ?? 0) > 0 && (
                                <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] text-red-500">
                                  가져올 수 없음 {notionCommitResult.summary.skipped_invalid}건
                                </span>
                              )}
                              {(notionCommitResult.summary?.failed ?? 0) > 0 && (
                                <span className="rounded border border-red-300 bg-red-50 px-1.5 py-0.5 text-[9px] text-red-600">
                                  실패 {notionCommitResult.summary.failed}건
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full text-xs text-slate-400"
                        onClick={() => setNotionPanelOpen(false)}
                      >
                        닫기
                      </Button>
                      {!notionSchema ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          disabled={!notionSelectedSourceId || notionLoading}
                          onClick={handleNotionLoadSchema}
                        >
                          {notionSelectedSourceId ? "속성 매핑 설정하기" : "가져올 Notion 데이터 소스를 선택해 주세요"}
                        </Button>
                      ) : notionPreviewResult ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          disabled={
                            notionLoading ||
                            notionCommitResult !== null ||
                            notionPreviewResult.items.filter((i) => i.commitEligible).length === 0
                          }
                          onClick={handleNotionCommit}
                        >
                          {notionLoading
                            ? "가져오는 중..."
                            : notionCommitResult !== null
                              ? ((notionCommitResult.summary?.committed ?? 0) > 0
                                  ? "가져오기 완료"
                                  : "새로 반영할 경험을 찾는 중")
                              : notionPreviewResult.items.filter((i) => i.commitEligible).length > 0
                                ? `가져오기 확정 (${notionPreviewResult.items.filter((i) => i.commitEligible).length}건)`
                                : "가져올 경험 후보를 선택해 주세요"}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          disabled={!isNotionRequiredMappingComplete || notionLoading}
                          onClick={handleNotionPreview}
                        >
                          {isNotionRequiredMappingComplete
                            ? "가져오기 미리보기 확인"
                            : "제목과 날짜 속성을 먼저 선택해 주세요"}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {showGoogleCalendarSync && googleCalendarPanelOpen && (
                  <div data-tour-id="home-google-calendar-sync-panel" className="rounded-2xl border border-green-100 bg-green-50/40 px-4 py-3 space-y-2.5">
                    <div>
                      <p className="text-sm font-semibold text-green-900">Google Calendar 연동</p>
                      <p className="text-xs text-green-700 leading-relaxed mt-0.5">
                        업무 기록이 'PASSMAP 기록' 캘린더에 자동으로 추가됩니다. 기존 Google Calendar 일정에는 영향을 주지 않습니다.
                      </p>
                    </div>
                    <div className="text-[11px] text-green-800 space-y-0.5">
                      <p>연결 상태: {googleCalendarStatusLabel}</p>
                      <p>기록 상태: 완료 {googleCalendarSyncStatusSummary.synced}건 · 대기 {googleCalendarSyncStatusSummary.pending}건 · 실패 {googleCalendarSyncStatusSummary.failed}건</p>
                    </div>
                    {googleCalendarError && (
                      <p className="text-xs text-red-600">Google Calendar 연결에 실패했습니다. 다시 시도해 주세요.</p>
                    )}
                    {googleCalendarMessage && !googleCalendarError && (
                      <p className="text-xs text-green-700">{googleCalendarMessage}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        disabled={googleCalendarConnecting}
                        onClick={handleGoogleCalendarConnectStart}
                      >
                        {googleCalendarConnecting ? "연결 준비 중..." : "Google Calendar 연동하기"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full text-xs"
                        disabled={googleCalendarCreating}
                        onClick={handleGoogleCalendarCreatePassmapCalendar}
                      >
                        {googleCalendarCreating ? "캘린더를 확인하는 중..." : "PASSMAP 전용 캘린더 만들기"}
                      </Button>
                    </div>
                    {googleCalendarCreateError && (
                      <p className="text-xs text-red-600">캘린더 준비에 실패했습니다. 다시 시도해 주세요.</p>
                    )}
                    {googleCalendarCreateMessage && !googleCalendarCreateError && (
                      <p className="text-xs text-green-700">{googleCalendarCreateMessage}</p>
                    )}
                    {activeEntry?.records?.[0] && (
                      <div className="space-y-1 pt-0.5">
                        <p className="text-[11px] text-green-800">선택 기록: {activeEntry.records[0].date} · {activeEntry.records[0].title}</p>
                        {googleCalendarSyncError && (
                          <p className="text-xs text-red-600">동기화에 실패했습니다. 다시 시도해 주세요.</p>
                        )}
                        {googleCalendarSyncMessage && !googleCalendarSyncError && (
                          <p className="text-xs text-green-700">{googleCalendarSyncMessage}</p>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          disabled={googleCalendarSyncing}
                          onClick={handleGoogleCalendarSyncRecord}
                        >
                          {googleCalendarSyncing ? "추가하는 중..." : "선택한 기록 추가"}
                        </Button>
                      </div>
                    )}
                    <hr className="border-green-100" />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full text-[11px]"
                        disabled={googleCalendarBackfilling || safeRecords.filter((r) => r?.id).length === 0}
                        onClick={handleGoogleCalendarBackfill}
                      >
                        {googleCalendarBackfilling ? "추가하는 중..." : "이전 기록 Google Calendar에 추가하기"}
                      </Button>
                      {googleCalendarSyncStatusSummary.failed > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-[11px]"
                          disabled={googleCalendarRetryingFailed}
                          onClick={handleGoogleCalendarRetryFailedRecords}
                        >
                          {googleCalendarRetryingFailed ? "재시도 중..." : "연동 실패 기록 다시 시도"}
                        </Button>
                      )}
                    </div>
                    {googleCalendarBackfillProgress && googleCalendarBackfilling && (
                      <p className="text-xs text-green-700">
                        {googleCalendarBackfillProgress.done}/{googleCalendarBackfillProgress.total} 처리 중 · 추가 {googleCalendarBackfillProgress.synced}건 · 건너뜀 {googleCalendarBackfillProgress.skipped}건 · 실패 {googleCalendarBackfillProgress.failed}건
                      </p>
                    )}
                    {googleCalendarBackfillMessage && (
                      <p className="text-xs text-green-700">{googleCalendarBackfillMessage}</p>
                    )}
                    {googleCalendarRetryFailedError && (
                      <p className="text-xs text-red-600">{googleCalendarRetryFailedError}</p>
                    )}
                    {googleCalendarRetryFailedMessage && !googleCalendarRetryFailedError && (
                      <p className="text-xs text-green-700">{googleCalendarRetryFailedMessage}</p>
                    )}
                    {googleCalendarDisconnectError && (
                      <p className="text-xs text-red-600">{googleCalendarDisconnectError}</p>
                    )}
                    {googleCalendarDisconnectMessage && !googleCalendarDisconnectError && (
                      <p className="text-xs text-green-700">{googleCalendarDisconnectMessage}</p>
                    )}
                    <button
                      type="button"
                      className="text-[10px] text-slate-400 hover:text-red-500 disabled:opacity-40"
                      disabled={googleCalendarDisconnecting}
                      onClick={handleGoogleCalendarDisconnect}
                    >
                      {googleCalendarDisconnecting ? "해제 중..." : "연동 해제"}
                    </button>
                  </div>
                )}
                <div data-tour-id="home-experience-flow-calendar" className="space-y-2">
                  <ExperienceSignalFilterBar
                    options={experienceSignalFilterOptions}
                    selectedKey={selectedExperienceSignalKey}
                    onSelect={setSelectedExperienceSignalKey}
                  />
                  {selectedExperienceSignalEmptyMessage ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                      {selectedExperienceSignalEmptyMessage}
                    </div>
                  ) : null}
                  <CalendarViewTabs value={calendarViewMode} onChange={setCalendarViewMode} legacyOptions={CALENDAR_VIEW_OPTIONS} />
                </div>

                {calendarViewMode === "grid" && (
                  <CalendarGridView
                    weeks={data.calendarMonth.weeks}
                    records={data.records}
                    demoRangeRecords={PASSMAP_DEMO_RANGE_RECORDS}
                    useDemoRecords={shouldUseDemoRecords}
                    entriesByDate={entriesByDate}
                    selectedDate={selectedDate}
                    today={data.today}
                    weekdayLabels={WEEKDAY_LABELS}
                    cardsByRecordId={experienceCardsByWorkRecordId}
                    selectedExperienceSignalKey={selectedExperienceSignalKey}
                    selectedExperienceSignalLabel={selectedExperienceSignalLabel}
                    shouldShowMonthEmptyNotice={shouldShowMonthEmptyNotice}
                    monthEmptyNoticeText={monthEmptyNoticeText}
                    monthSummary={calendarMonthSummary}
                    calendarSummary={calendarSummary}
                    getWeekRangeSegments={getWeekRangeSegments}
                    deriveExperienceSignalsFromRecords={deriveExperienceSignalsFromRecords}
                    recordsHaveExperienceSignal={recordsHaveExperienceSignal}
                    getCalendarWorkTypeLabel={getCalendarWorkTypeLabel}
                    normalizeExperienceSignalLabel={normalizeExperienceSignalLabel}
                    onSelectDate={handleSelectCalendarDate}
                  />
                )}

                {SHOW_LEGACY_CALENDAR_GRID_VIEW && calendarViewMode === "grid" && (
                  <>
                    <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                      {WEEKDAY_LABELS.map((label) => (
                        <div key={label} className="px-1 py-0.5 text-center text-xs font-semibold text-slate-400 sm:px-2 sm:py-1">
                          {label}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {data.calendarMonth.weeks.map((week, weekIndex) => {
                        const rangeSegments = getWeekRangeSegments([...(shouldUseDemoRecords ? PASSMAP_DEMO_RANGE_RECORDS : []), ...data.records], week);
                        return (
                          <div key={`week_${weekIndex}`} className="relative">
                            <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                              {week.map((item) => {
                                const entry = entriesByDate[item.date];
                                const rangeRecords = rangeSegments
                                  .filter((segment) => segment.record?.startDate <= item.date && segment.record?.endDate >= item.date)
                                  .map((segment) => segment.record);
                                const dayRecordsForSignals = [...(entry?.records || []), ...rangeRecords];
                                const isActive = item.date === selectedDate;
                                const recordCount = entry?.records?.length || 0;
                                const dateRecordStatus = getDateRecordStatus(dayRecordsForSignals, experienceCardsByWorkRecordId);
                                const experienceSignals = deriveExperienceSignalsFromRecords(dayRecordsForSignals, 3);
                                const matchesSelectedSignal = recordsHaveExperienceSignal(dayRecordsForSignals, selectedExperienceSignalKey);
                                const isDimmedBySignal = selectedExperienceSignalKey !== "all" && !matchesSelectedSignal;
                                const primaryTask =
                                  entry?.tasks?.[0] ||
                                  entry?.records?.[0]?.title ||
                                  entry?.records?.[0]?.summary ||
                                  getCalendarWorkTypeLabel(entry?.records?.[0]?.workType) ||
                                  getCalendarWorkTypeLabel(entry?.workTypes?.[0]) ||
                                  "업무 기록";
                                const workTypes = entry?.workTypes || [];
                                const specificWorkTypes = workTypes.filter((t) => !GENERIC_WORK_TYPES.has(t));
                                const visibleWorkTypes = (specificWorkTypes.length ? specificWorkTypes : workTypes).slice(0, 2);
                                const extraWorkTypeCount = Math.max(0, workTypes.length - visibleWorkTypes.length);
                                const calendarDayStatusLabel = experienceSignals.length
                                  ? `경험 신호: ${experienceSignals.join(", ")}`
                                  : recordCount > 0
                                    ? "기록을 바탕으로 신호 정리 중"
                                    : "경험 기록 대기";
                                const calendarDayAriaLabel = [
                                  item.date,
                                  getDateStatusLabel(dateRecordStatus),
                                  item.isToday ? "오늘" : "",
                                  isActive ? "선택됨" : "",
                                  selectedExperienceSignalKey !== "all" ? `${selectedExperienceSignalLabel}: ${matchesSelectedSignal ? "있음" : "없음"}` : "",
                                  calendarDayStatusLabel,
                                ].filter(Boolean).join(", ");
                                return (
                                  <button
                                    key={item.date}
                                    type="button"
                                    aria-label={calendarDayAriaLabel}
                                    title={calendarDayAriaLabel}
                                    onClick={() => handleSelectCalendarDate(item.date)}
                                    className={[
                                      "min-h-[68px] min-w-0 rounded-xl border px-1 pt-1.5 pb-6 text-left transition sm:min-h-[92px] sm:px-2 sm:pt-2 sm:pb-7",
                                      isActive
                                        ? "border-slate-300 bg-slate-50 shadow-sm ring-1 ring-slate-200/70"
                                        : item.inCurrentMonth
                                          ? "border-slate-200 bg-white hover:border-slate-300"
                                          : "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300",
                                      isDimmedBySignal ? "opacity-35" : "",
                                    ].join(" ")}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className={`text-sm font-semibold ${item.inCurrentMonth ? "text-slate-900" : "text-slate-400"}`}>
                                        {item.day}
                                      </div>
                                      <div className="flex flex-wrap justify-end gap-1">
                                        {experienceSignals.length > 0 ? (
                                          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                            감지된 신호 {experienceSignals.length}
                                          </span>
                                        ) : null}
                                        {item.isToday ? (
                                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                            오늘
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>

                                    {recordCount > 0 ? (
                                      <p className="mt-1.5 min-w-0 truncate text-[11px] font-medium leading-tight text-slate-700">
                                        {primaryTask}
                                      </p>
                                    ) : null}

                                    <div className="mt-3 flex flex-wrap gap-1">
                                      {experienceSignals.map((signal) => (
                                        <span
                                          key={`${item.date}_${signal}`}
                                          className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700"
                                        >
                                          <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                          {signal}
                                        </span>
                                      ))}
                                      {visibleWorkTypes.map((type) => {
                                        const displayType = normalizeExperienceSignalLabel(getCalendarWorkTypeLabel(type));
                                        return (
                                          <span
                                            key={`${item.date}_${type}`}
                                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                          >
                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                            {displayType}
                                          </span>
                                        );
                                      })}
                                      {extraWorkTypeCount > 0 ? (
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                          +{extraWorkTypeCount}
                                        </span>
                                      ) : null}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            {rangeSegments.length > 0 ? (
                              <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 grid grid-cols-7 gap-0.5 sm:gap-2">
                                {rangeSegments.map((segment, segIndex) => {
                                  const isPersonal = segment.record.recordType === "personal" || segment.record.workType === "개인 업무";
                                  const colorClass = isPersonal
                                    ? "bg-slate-100 border-slate-200 text-slate-600"
                                    : "bg-slate-100 border-slate-200 text-slate-700";
                                  const roundClass =
                                    segment.isSegmentStart && segment.isSegmentEnd ? "rounded-full" :
                                    segment.isSegmentStart ? "rounded-l-full rounded-r-sm" :
                                    segment.isSegmentEnd ? "rounded-l-sm rounded-r-full" :
                                    "rounded-sm";
                                  return (
                                    <div
                                      key={`seg_${weekIndex}_${segIndex}`}
                                      className={`h-4 min-w-0 overflow-hidden truncate border px-2 text-[10px] font-medium leading-4 ${colorClass} ${roundClass}`}
                                      style={{
                                        gridColumn: `${segment.startColumn} / ${segment.endColumn}`,
                                        gridRow: segment.lane + 1,
                                      }}
                                    >
                                      {segment.isSegmentStart ? String(segment.record.title || segment.record.summary || "").trim() : ""}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {shouldShowMonthEmptyNotice && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                        {monthEmptyNoticeText}
                      </div>
                    )}

                    <div className="grid gap-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          <div className="text-xs font-semibold text-slate-500">확정한 경험</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {calendarMonthSummary.recordRate}%
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {calendarMonthSummary.recordedDateCount}/{calendarMonthSummary.totalDateCount}일 기록
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
                          <div className="text-xs font-semibold text-slate-500">면접/이력서로 발전 가능</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">
                            {calendarMonthSummary.detailedDateCount}일
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            보완하면 더 좋아요 {calendarMonthSummary.keywordDateCount}일
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        {calendarSummary.weeklySummary}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                        {calendarSummary.todaySummary}
                      </div>
                    </div>
                  </>
                )}

                {calendarViewMode === "weekly" && (
                  <CalendarWeeklyView
                    weekDates={weekDates}
                    records={data.records}
                    demoRangeRecords={PASSMAP_DEMO_RANGE_RECORDS}
                    useDemoRecords={shouldUseDemoRecords}
                    selectedDate={selectedDate}
                    today={data.today}
                    selectedExperienceSignalKey={selectedExperienceSignalKey}
                    selectedExperienceSignalLabel={selectedExperienceSignalLabel}
                    weekSummary={calendarWeekSummary}
                    deriveExperienceSignalsFromRecords={deriveExperienceSignalsFromRecords}
                    recordsHaveExperienceSignal={recordsHaveExperienceSignal}
                    recordHasExperienceSignal={recordHasExperienceSignal}
                    getWorkCalendarRecordTypeLabel={getWorkCalendarRecordTypeLabel}
                    normalizeExperienceSignalLabel={normalizeExperienceSignalLabel}
                    pickUniqueCompact={pickUniqueCompact}
                    formatWeekRangeLabel={formatWeekRangeLabel}
                    onSelectDate={handleSelectCalendarDate}
                    onCreateRecord={handleOpenCalendarRecordCreateDraft}
                  />
                )}

                {SHOW_LEGACY_CALENDAR_WEEKLY_VIEW && calendarViewMode === "weekly" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">이번 주 경험 흐름</p>
                      <p className="text-xs text-slate-400">{formatWeekRangeLabel(weekDates)}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="text-xs font-semibold text-slate-500">주간 기록 완성도</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{calendarWeekSummary.completionRate}%</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="text-xs font-semibold text-slate-500">발전 가능 기록</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{calendarWeekSummary.detailedDateCount}일</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="text-xs font-semibold text-slate-500">기록 부족 날짜</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{calendarWeekSummary.missingDates.length}일</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {weekDates.map((dayStr) => {
                        const parts = dayStr.split("-");
                        const monthNum = Number(parts[1]);
                        const dayNum = Number(parts[2]);
                        const dow = new Date(Number(parts[0]), monthNum - 1, dayNum).getDay();
                        const weekdayLabel = ["일", "월", "화", "수", "목", "금", "토"][dow];
                        const isActive = dayStr === selectedDate;
                        const isToday = dayStr === data.today;
                        const allRecs = [...(shouldUseDemoRecords ? PASSMAP_DEMO_RANGE_RECORDS : []), ...data.records];
                        const dayRecords = allRecs.filter((r) => {
                          if (r.startDate && r.endDate && r.startDate !== r.endDate) {
                            return r.startDate <= dayStr && r.endDate >= dayStr;
                          }
                          return (r.date || r.startDate) === dayStr;
                        });
                        const hasRecords = dayRecords.length > 0;
                        const daySignals = deriveExperienceSignalsFromRecords(dayRecords, 3);
                        const matchesSelectedSignal = recordsHaveExperienceSignal(dayRecords, selectedExperienceSignalKey);
                        const isDimmedBySignal = selectedExperienceSignalKey !== "all" && !matchesSelectedSignal;
                        const orderedDayRecords = selectedExperienceSignalKey === "all"
                          ? dayRecords
                          : [
                              ...dayRecords.filter((record) => recordHasExperienceSignal(record, selectedExperienceSignalKey)),
                              ...dayRecords.filter((record) => !recordHasExperienceSignal(record, selectedExperienceSignalKey)),
                            ];
                        const visible = orderedDayRecords.slice(0, 2);
                        const extra = dayRecords.length > 2 ? dayRecords.length - 2 : 0;
                        const primaryRecord = visible[0] || null;
                        const primaryTitle = String(primaryRecord?.title || primaryRecord?.summary || "").trim() || "제목 없는 기록";
                        const workTypes = pickUniqueCompact(
                          dayRecords.flatMap((record) => [
                            normalizeExperienceSignalLabel(getWorkCalendarRecordTypeLabel(record)),
                            ...(Array.isArray(record.strengthTags) ? record.strengthTags.map(normalizeExperienceSignalLabel) : []),
                          ]),
                          3
                        );
                        const weekDayStatusLabel = daySignals.length
                          ? `경험 신호: ${daySignals.join(", ")}`
                          : hasRecords
                            ? "기록을 바탕으로 신호 정리 중"
                            : "경험 기록 대기";
                        const weekDayAriaLabel = [
                          dayStr,
                          isToday ? "오늘" : "",
                          isActive ? "선택됨" : "",
                          selectedExperienceSignalKey !== "all" ? `${selectedExperienceSignalLabel}: ${matchesSelectedSignal ? "있음" : "없음"}` : "",
                          weekDayStatusLabel,
                        ].filter(Boolean).join(", ");
                        const rowCls = [
                          "grid min-h-[64px] cursor-pointer grid-cols-[56px_36px_minmax(0,1fr)] items-center gap-2 rounded-xl border px-3 py-2.5 transition sm:grid-cols-[64px_40px_minmax(0,1fr)_minmax(120px,auto)] sm:gap-3",
                          isActive
                            ? "border-slate-300 bg-slate-50 shadow-sm ring-1 ring-slate-200/70"
                            : isToday
                              ? "border-slate-300 bg-slate-50"
                              : hasRecords
                                ? "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-50"
                                : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50",
                          isDimmedBySignal ? "opacity-45" : "",
                        ].join(" ");
                        return (
                          <div
                            key={dayStr}
                            role="button"
                            tabIndex={0}
                            aria-label={weekDayAriaLabel}
                            title={weekDayAriaLabel}
                            onClick={() => handleSelectCalendarDate(dayStr)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectCalendarDate(dayStr);
                              }
                            }}
                            className={rowCls}
                          >
                            <div className="text-center">
                              <p className={["text-[10px] font-semibold", isActive ? "text-slate-600" : "text-slate-400"].join(" ")}>{weekdayLabel}</p>
                              <p className={["text-sm font-bold", isActive ? "text-slate-900" : "text-slate-700"].join(" ")}>{monthNum}.{dayNum}</p>
                              {isToday ? (
                                <span className="mt-0.5 inline-block rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">오늘</span>
                              ) : null}
                            </div>
                            <div className="flex justify-center">
                              {hasRecords ? (
                                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-xs font-semibold text-violet-700">
                                  {dayRecords.length}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-slate-300 bg-white text-lg leading-none text-slate-400 transition hover:border-violet-200 hover:text-violet-600"
                                  aria-label={`${dayStr} 기록 추가하기`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenCalendarRecordCreateDraft({ date: dayStr, source: "calendar-weekly-legacy" });
                                  }}
                                >
                                  +
                                </button>
                              )}
                            </div>
                            <div className="min-w-0 space-y-1">
                              {hasRecords ? (
                                <>
                                  <p className="truncate text-sm font-semibold text-slate-900">
                                    {primaryTitle}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {workTypes.map((type) => (
                                      <span key={`${dayStr}_${type}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                        {type}
                                      </span>
                                    ))}
                                    {extra > 0 ? (
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">+{extra}개</span>
                                    ) : null}
                                  </div>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="text-left text-sm font-semibold text-slate-500 transition hover:text-violet-700"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenCalendarRecordCreateDraft({ date: dayStr, source: "calendar-weekly-legacy" });
                                  }}
                                >
                                  기록 추가하기
                                </button>
                              )}
                            </div>
                            <div className="col-span-3 flex flex-col gap-1 sm:col-span-1 sm:items-end">
                              <span className="hidden text-[10px] font-semibold text-slate-400 sm:block">감지된 역량</span>
                              <div className="flex flex-wrap gap-1 sm:justify-end">
                                {daySignals.length > 0 ? (
                                  daySignals.map((signal) => (
                                    <span key={`${dayStr}_${signal}`} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700">
                                      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                                      {signal}
                                    </span>
                                  ))
                                ) : hasRecords ? (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">신호 정리 중</span>
                                ) : (
                                  <span className="rounded-full bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-400">역량 대기</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {calendarViewMode === "project" && (
                  <CalendarProjectView
                    records={data.records}
                    cardsByRecordId={experienceCardsByWorkRecordId}
                    projectGroups={calendarProjectGroups}
                    today={data.today}
                    onSelectDate={handleSelectCalendarDate}
                    onSelectProjectAction={handleSelectProjectAction}
                    onOpenRecordInput={onOpenRecordInput}
                    onOpenProjectActionDraft={handleOpenProjectActionDraft}
                  />
                )}

                {calendarViewMode !== "project" ? (
                  <>
                    <CalendarRecommendationPanel
                      actions={calendarRecommendedActions}
                      selectedDate={selectedDate}
                      today={data.today}
                      isProjectView={false}
                      onOpenRecordInput={onOpenRecordInput}
                      onOpenProjectActionDraft={handleOpenProjectActionDraft}
                    />

                    <GoogleCalendarCandidatePanel
                      selectedDate={selectedDate}
                      isProjectView={false}
                      onOpenRecordInput={onOpenRecordInput}
                      onOpenProjectActionDraft={handleOpenProjectActionDraft}
                    />
                  </>
                ) : null}

                {SHOW_LEGACY_CALENDAR_LIST_VIEW && calendarViewMode === "list" && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">경험 기록 리스트</p>
                      <p className="mt-0.5 text-xs text-slate-500">날짜순 기록에서 경험 신호와 이력서 후보를 빠르게 검토합니다.</p>
                    </div>
                    {visibleListRecords.length === 0 ? (
                      <p className="py-4 text-sm text-slate-500">오늘 해결한 문제나 협업한 사람을 한 줄로 남기면 이곳에 경험 흐름이 쌓입니다.</p>
                    ) : (
                      <ol className="space-y-3">
                        {visibleListRecords.map((record) => {
                          const isRange = record.startDate && record.endDate && record.startDate !== record.endDate;
                          const periodLabel = formatWorkCalendarPeriod(record);
                          const typeLabel = getWorkCalendarRecordTypeLabel(record);
                          const safeTitle = String(record.title || record.summary || "").trim();
                          const safeSummary = String(record.summary || "").trim();
                          const safeReflected = String(record.reflectedSentence || "").trim();
                          const tags = deriveExperienceSignalsFromRecords([record], 3);
                          const matchesSelectedSignal = recordHasExperienceSignal(record, selectedExperienceSignalKey);
                          const isDimmedBySignal = selectedExperienceSignalKey !== "all" && !matchesSelectedSignal;
                          return (
                            <li
                              key={record.id || periodLabel}
                              className={[
                                "rounded-2xl border border-slate-100 bg-white p-4 transition",
                                isDimmedBySignal ? "opacity-45" : "",
                              ].join(" ")}
                            >
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-[10px] font-medium text-slate-400">
                                  {isRange ? "기간" : "날짜"}: <span className="text-slate-600">{periodLabel}</span>
                                </span>
                                <span className="text-[10px] font-medium text-slate-400">
                                  유형: <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-slate-600">{normalizeExperienceSignalLabel(typeLabel)}</span>
                                </span>
                              </div>
                              {safeTitle ? <div className="mt-2 text-sm font-medium text-slate-900">{safeTitle}</div> : null}
                              {safeSummary ? (
                                <div className="mt-1">
                                  <span className="text-[10px] font-medium text-slate-400">요약: </span>
                                  <span className="text-xs leading-relaxed text-slate-600">{safeSummary}</span>
                                </div>
                              ) : null}
                              {safeReflected ? (
                                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                                  <span className="font-medium text-slate-600">이력서 문장 후보: </span>{safeReflected}
                                </div>
                              ) : null}
                              {tags.length > 0 ? (
                                <div className="mt-2">
                                  <span className="text-[10px] font-medium text-slate-400">경험 신호: </span>
                                  <span className="inline-flex flex-wrap gap-1">
                                    {tags.map((tag) => (
                                      <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{tag}</span>
                                    ))}
                                  </span>
                                </div>
                              ) : null}
                              {isLoggedIn && record.id ? (
                                <div className="mt-2 flex justify-end">
                                  <button
                                    type="button"
                                    className="text-[10px] text-slate-400 hover:text-red-500"
                                    onClick={() => handleDeleteWorkRecord(record)}
                                  >
                                    삭제
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {calendarViewMode !== "project" || projectActionDraft || activeProjectAction ? (
            <div
              ref={calendarDateDrawerRef}
              tabIndex={-1}
              className={[
                "min-w-0 scroll-mt-4 space-y-3 rounded-[28px] border border-violet-100 bg-violet-50/40 p-2 shadow-xl shadow-violet-100/70 outline-none transition",
                dateDetailOpen ? "ring-2 ring-violet-400/70 ring-offset-2 ring-offset-white" : "",
              ].join(" ")}
              aria-live="polite"
            >
              {calendarViewMode !== "project" ? (
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-950">이번주 강점과 약점</p>
                <div className="mt-3 grid gap-2">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                    <p className="text-xs font-semibold text-emerald-700">강점</p>
                    <p className="mt-1 text-sm font-semibold text-emerald-950">
                      {(monthlyExperienceSignals[0] || bottomExperienceSignals[0] || "문제 해결").toString()}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-emerald-800">반복 기록에서 강하게 보이는 경험 신호입니다.</p>
                  </div>
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-3">
                    <p className="text-xs font-semibold text-orange-700">약점</p>
                    <p className="mt-1 text-sm font-semibold text-orange-950">
                      {calendarMonthSummary.keywordDateCount > 0 ? "결과 수치 보강" : "기록 공백 줄이기"}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-orange-800">면접 답변으로 쓰려면 행동과 결과를 한 줄 더 붙이면 좋아요.</p>
                  </div>
                </div>
              </section>
              ) : null}

              {calendarViewMode !== "project" ? (
              <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-950">다음주 추천 행동</p>
                <div className="mt-3 space-y-3">
                  {sidebarRecommendations.map((action, index) => (
                    <div key={action.id || index} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{action.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{action.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {onOpenRecordInput || calendarViewMode === "project" ? (
                  <Button
                    size="sm"
                    className="mt-4 h-9 w-full rounded-full bg-violet-600 text-xs font-semibold text-white hover:bg-violet-700"
                    onClick={openSidebarRecommendationAction}
                  >
                    추천 행동으로 계획 만들기
                  </Button>
                ) : null}
              </section>
              ) : null}

              {calendarViewMode === "project" && projectActionDraft ? (
                <CalendarProjectActionCreateDrawer
                  key={`${projectActionDraft.source || "project-action"}_${projectActionDraft.projectName || ""}_${projectActionDraft.date || projectActionDraft.startDate || data.today}`}
                  draft={projectActionDraft}
                  isLoggedIn={isLoggedIn}
                  onCreateRecord={handleCreateProjectActionRecord}
                />
              ) : calendarViewMode === "project" && activeProjectAction ? (
                <CalendarProjectActionDrawer
                  key={activeProjectAction.id || activeProjectAction.recordId || activeProjectAction.date}
                  action={activeProjectAction}
                  onOpenRecordInput={onOpenRecordInput}
                  onUpdateRecord={handleUpdateCalendarRecord}
                  onDeleteRecord={handleDeleteCalendarRecord}
                />
              ) : calendarViewMode !== "project" ? (
                <CalendarDateDrawer
                  key={`${selectedDate}_${calendarRecordCreateDraft?.requestId || "list"}`}
                  selectedDate={selectedDate}
                  records={activeEntry?.records || []}
                  cardsByRecordId={experienceCardsByWorkRecordId}
                  createDraft={calendarRecordCreateDraft}
                  onCreateRecord={handleCreateCalendarRecord}
                  onOpenResumeResult={onOpenResumeResult}
                  onUpdateRecord={handleUpdateCalendarRecord}
                  onDeleteRecord={handleDeleteCalendarRecord}
                />
              ) : null}

              <Card className="hidden rounded-2xl border-slate-200 shadow-none">
                <CardHeader className="pb-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between sm:hidden"
                    onClick={() => setDateDetailOpen(v => !v)}
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-900">이 날짜의 경험 흐름</div>
                      {activeDateLabel && <div className="text-xs text-slate-500">{activeDateLabel}</div>}
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${dateDetailOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className="hidden sm:block">
                    <SectionHeader title="이 날짜의 경험 흐름" description={activeDateLabel} action={<Target className="h-4 w-4 text-slate-400" />} />
                  </div>
                </CardHeader>
                <div className={dateDetailOpen ? "" : "hidden sm:block"}>
                <CardContent className="space-y-3">
                  {activeEntry ? (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-500">기록 요약</div>
                            <div className="mt-1 truncate text-sm font-semibold text-slate-900">{activeEntryPrimaryTask}</div>
                          </div>
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                            {activeExperienceSignals.length > 0 ? `경험 신호 ${activeExperienceSignals.length}` : "경험 신호 정리 중"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {activeExperienceSignals.length ? activeExperienceSignals.map((signal) => (
                            <span key={`signal_${signal}`} className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-white px-3 py-1 text-xs font-medium text-violet-700">
                              <span className="h-2 w-2 rounded-full bg-violet-400" />
                              {signal}
                            </span>
                          )) : (
                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                              기록 맥락을 바탕으로 신호를 정리 중
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="text-xs font-semibold text-slate-500">오늘 남긴 기록에서 아래 신호가 보입니다.</div>
                        <div className="mt-2 text-sm leading-relaxed text-slate-700">{activeEntry.summary || activeEntryPrimaryTask}</div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-500">기록 요약</div>
                        {activeEntry.records.slice(0, 3).map((record) => (
                          <div key={record.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-sm font-semibold text-slate-900">{record.title}</div>
                            <div className="mt-0.5 text-sm leading-relaxed text-slate-600">{record.summary}</div>
                          </div>
                        ))}
                        {onOpenRecordInput && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenCalendarRecordCreateDraft({ date: selectedDate, source: "calendar-grid" })}
                              className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                            >
                              기록 보완하기
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="text-xs font-semibold text-slate-500">이력서 후보 문장</div>
                        <div className="mt-2 text-sm leading-relaxed text-slate-700">
                          {activeEntry.reflectedSentence || "역할, 행동, 결과를 한 줄 더 보완하면 후보 문장으로 정리하기 쉬워요."}
                        </div>
                      </div>

                      {activeEntryMaterialCards.length > 0 ? (
                        <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-violet-700">AI 경험/이력서 재료</div>
                            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                              {activeEntryMaterialCards.length}건
                            </span>
                          </div>
                          <div className="mt-2 space-y-2">
                            {activeEntryMaterialCards.map((card) => (
                              <div key={card.id} className="rounded-lg bg-white px-3 py-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-semibold text-slate-800">
                                    {card.title || "경험 기록"}
                                  </span>
                                  {card.status ? (
                                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                      {card.status}
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                                  {buildCalendarMaterialSentence(card)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-500">감지된 경험 신호</div>
                        {activeExperienceSignals.length ? (
                          <div className="flex flex-wrap gap-2">
                            {activeExperienceSignals.map((tag) => (
                              <span key={tag} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                            문제, 협업, 결과 중 하나를 더 적으면 경험 신호를 더 구체화할 수 있어요.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-500">연결 가능한 역량/직무</div>
                        <div className="flex flex-wrap gap-2">
                          {(activeConnectableRoles.length ? activeConnectableRoles : activeEntryVisibleWorkTypes.map((type) => normalizeExperienceSignalLabel(getCalendarWorkTypeLabel(type)))).slice(0, 3).map((role) => (
                            <span key={role} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                        <div className="text-xs font-semibold text-amber-700">다음 보완 행동</div>
                        <div className="mt-2 text-sm leading-relaxed text-amber-900">{activeNextAction || activeEntry.improvementHint}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {onOpenRecordInput && (
                            <Button variant="outline" size="sm" className="h-8 rounded-full bg-white text-xs" onClick={() => handleOpenCalendarRecordCreateDraft({ date: selectedDate, source: "calendar-grid" })}>
                              기록 보완하기
                            </Button>
                          )}
                          {onOpenResumeResult && (
                            <Button variant="outline" size="sm" className="h-8 rounded-full bg-white text-xs" onClick={onOpenResumeResult}>
                              이력서 후보 보기
                            </Button>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-4 text-center">
                      <p className="text-sm leading-relaxed text-slate-700">괜찮아요. 오늘 해결한 문제, 협업한 사람, 결과로 달라진 점 중 하나만 적어도 경험 신호를 찾을 수 있어요.</p>
                      {onOpenRecordInput && (
                        <button
                          type="button"
                          onClick={() => handleOpenCalendarRecordCreateDraft({ date: selectedDate, source: "calendar-grid" })}
                          className="mt-2 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                        >
                          이 날짜에 경험 남기기
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>
                </div>
              </Card>

              {calendarViewMode !== "project" ? (
              <Card className="rounded-2xl border-slate-200 shadow-none">
                <CardHeader className="pb-3">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between sm:hidden"
                    onClick={() => setMonthlyAssetOpen(v => !v)}
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-900">이번 달 경험 흐름 요약</div>
                      <div className="text-xs text-slate-500">이번 달 신호가 어떤 직무 연결로 이어지는지 봅니다.</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${monthlyAssetOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className="hidden sm:block">
                    <SectionHeader title="이번 달 경험 흐름 요약" description="이번 달 신호가 어떤 직무 연결로 이어지는지 봅니다." action={<Sparkles className="h-4 w-4 text-slate-400" />} />
                  </div>
                </CardHeader>
                <div className={monthlyAssetOpen ? "" : "hidden sm:block"}>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <SummaryMetricCard label="이력서 후보 문장" value={monthlyResumeCandidateValue} />
                    <SummaryMetricCard label="주요 경험 신호" value={monthlyExperienceSignals[0] || "문제·협업·결과를 기록하면 선명해져요"} />
                    <SummaryMetricCard label="연결 업무 맥락" value={monthlyConnectableRoles[0] || monthlyAssetSummary.topWorkType || "다음 기록으로 확인"} />
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="text-xs font-semibold text-slate-500">다음 보완 행동</div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-700">{deriveExperienceFlowAction(monthlyFlowRecords) || monthlyAssetSummary.improvementHint}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-full" onClick={onOpenResumeResult || undefined}>
                      이력서 후보 보기
                    </Button>
                  </div>
                </CardContent>
                </div>
              </Card>
              ) : null}
            </div>
            ) : null}
          </div>

          <section className="space-y-3">
            <SectionHeader
              title="최근 커리어 인사이트"
              description="기록이 어떻게 커리어 자산으로 바뀌고 있는지 확인해보세요."
              action={<Lightbulb className="h-4 w-4 text-slate-400" />}
            />

            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
                <CardHeader className="pb-3">
                  <SectionHeader title="최근 경험 흐름" description={bottomExperienceSummary} />
                </CardHeader>
                <CardContent className="space-y-3">
                  {bottomRecentRecords.length ? (
                    bottomRecentRecords.map((record) => {
                      const recordSignals = deriveExperienceSignalsFromRecords([record], 2);
                      const recordRoles = deriveConnectableRolesFromRecords([record], 1);
                      const title = String(record?.title || record?.summary || "경험 기록").trim();
                      const summary = String(record?.summary || record?.reflectedSentence || "이 경험에서 역할과 결과를 더 보완할 수 있어요.").trim();
                      return (
                        <div key={record.id || `${record.date}_${title}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{summary}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-slate-500">
                              {record.date || record.startDate}
                            </span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(recordSignals.length ? recordSignals : ["경험 신호 정리 중"]).map((signal) => (
                              <span key={`${record.id}_${signal}`} className="rounded-full border border-violet-100 bg-white px-2 py-1 text-[11px] font-medium text-violet-700">
                                {signal}
                              </span>
                            ))}
                            {(recordRoles.length ? recordRoles : bottomConnectableRoles.slice(0, 1)).map((role) => (
                              <span key={`${record.id}_${role}`} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                                {role}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-4">
                      <p className="text-sm leading-relaxed text-slate-700">{bottomExperienceSummary}</p>
                      {onOpenRecordInput && (
                        <Button size="sm" className="mt-3 h-8 rounded-full bg-violet-600 px-3 text-xs text-white hover:bg-violet-700" onClick={() => handleOpenCalendarRecordCreateDraft({ date: selectedDate, source: "calendar-grid" })}>
                          첫 경험 기록하기
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm">
                <CardHeader className="pb-3">
                  <SectionHeader title="현재 강점 및 부족 신호" description="강하게 보이는 신호와 보완하면 더 선명해질 신호를 함께 봅니다." />
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500">강하게 보이는 신호</div>
                    <div className="flex flex-wrap gap-2">
                      {(bottomExperienceSignals.length ? bottomExperienceSignals : ["문제 해결", "협업 조율"]).slice(0, 4).map((signal) => (
                        <span key={signal} className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                          {signal}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      실제 기록의 태그와 설명에서 반복되는 경험 단서를 우선 반영합니다.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-500">보완하면 좋은 신호</div>
                    <div className="flex flex-wrap gap-2">
                      {bottomComplementSignals.map((signal) => (
                        <span key={signal} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                          {signal}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      아직 덜 드러나는 맥락을 보완하면 이력서 후보의 설득력이 높아져요.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-violet-100 bg-violet-50/40 p-0 shadow-sm">
                <CardHeader className="pb-3">
                  <SectionHeader title="다음 추천 행동" description="지금 기록 흐름에서 바로 보완하기 좋은 행동입니다." />
                </CardHeader>
                <CardContent className="space-y-3">
                  {bottomInsightActions.map((item) => (
                    <div key={item.title} className="rounded-xl border border-white/80 bg-white px-3 py-3">
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{item.expected}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 h-8 rounded-full border-violet-200 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                        onClick={item.onClick}
                      >
                        {item.cta}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </section>
        </CardContent>
      </Card>

    </div>
  );
}
