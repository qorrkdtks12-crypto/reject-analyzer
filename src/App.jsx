// FINAL PATCHED FILE: src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildSimulationViewModel } from "./lib/simulation/buildSimulationViewModel.js";
import { safeReadTransitionLiteLastAudience, saveTransitionLiteLastAudience, clearTransitionLiteDraft } from "./lib/transitionLite/transitionLiteDraftStorage.js";
import { buildRejectionAiCacheKeyPayload, readRejectionAiCache, writeRejectionAiCache } from "./lib/rejectionAnalysis/aiResultCache.js";
import { deriveRejectionAnalysisProgress } from "./lib/rejectionAnalysis/analysisProgress.js";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithGoogle,
  signInWithKakao,
  signInWithNaver,
  signOut,
  getSession,
  onAuthStateChange,
  getCurrentUserIdentities,
  buildAccountRecoveryHelperState,
  getAccountRecoveryRedirectTo,
  GOOGLE_LINK_CONFIRMATION_TOKEN,
  ACCOUNT_RECOVERY_TRANSFER_CONFIRMATION_TEXT,
  ACCOUNT_RECOVERY_KAKAO_UNLINK_CONFIRMATION_TEXT,
  runGuardedAuxiliaryGoogleLink,
  runGuardedKakaoUnlink,
} from "./lib/auth";
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle,
  Clipboard,
  Download,
  FileCheck2,
  FileText,
  Home,
  Lightbulb,
  Lock,
  MessageSquareText,
  PenLine,
  Send,
  Sparkles,
  Target,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ChevronDown,
  User,
} from "lucide-react";
import {
  semanticMatchJDResume,
  splitToUnits,
  getSemanticDisplayThreshold,
  hasSemanticDomainBlockSignal,
  pickSemanticBestScore,
} from "./lib/semantic/match.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UploadPanel from "./components/upload/UploadPanel.jsx";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";

import { SECTION, ORDER, defaultState } from "@/lib/schema";
import { analyze, buildHypotheses, buildReport, buildKeywordSignals, buildCareerSignals } from "@/lib/analyzer";
import { usePersistedState } from "@/hooks/usePersistedState";
import HypothesisCard from "@/components/HypothesisCard";
import RadarSelfCheck from "@/components/RadarSelfCheck";
import ReportSectionView from "@/components/report/ReportSection";
import ReportV2Container from "@/components/report/ReportV2Container";
import TransitionLiteResult from "@/components/report/TransitionLiteResult";
import SimulatorLayout from "./components/SimulatorLayout.jsx";
import ComparisonSummary from "./components/ComparisonSummary.jsx";
import InputFlow from "./components/input/InputFlow";
import PreciseAnalysisFlow from "./components/input/PreciseAnalysisFlow.jsx";
import GlassHeroCard from "./components/ui/GlassHeroCard";
import ParsedFieldsPanel from "./components/parse/ParsedFieldsPanel.jsx";
import ResumeIoStudioPanel from "./components/resume/ResumeIoStudioPanel.jsx";
import TransitionLiteInput from "./components/input/TransitionLiteInput.jsx";
import NewgradTransitionLiteInput from "./components/input/NewgradTransitionLiteInput.jsx";
import PmMvpView from "./components/mvp/PmMvpView.jsx";
import WebWorkTraceRecordPage from "./components/workTrace/WebWorkTraceRecordPage.jsx";
import HomeDashboard from "./components/home/HomeDashboard.jsx";
import CareerAssetMapMock from "./components/home/CareerAssetMapMock.jsx";
import useIsMobile from "./hooks/useIsMobile.js";
import MobileAppShell from "./components/mobile/MobileAppShell.jsx";
import ReminderSettingsPanel from "./components/reminder/ReminderSettingsPanel.jsx";
import McpConnectionPanel from "./components/mcp/McpConnectionPanel.jsx";
import ChatgptConnectionPanel from "./components/chatgpt/ChatgptConnectionPanel.jsx";
import ChatgptOAuthConsentPage from "./components/chatgpt/ChatgptOAuthConsentPage.jsx";
import AiCaptureGuideModal from "./components/onboarding/AiCaptureGuideModal.jsx";
import FirstRecordOnboardingModal from "./components/onboarding/FirstRecordOnboardingModal.jsx";
import FirstRecordGuidedTour from "./components/onboarding/FirstRecordGuidedTour.jsx";
import FullProductGuidedTour from "./components/onboarding/FullProductGuidedTour.jsx";
import PostSaveContextTour from "./components/onboarding/PostSaveContextTour.jsx";
import { AUTH_PROMPT } from "./lib/passmapAuthPolicy.js";
import { buildTransitionLiteResult } from "./lib/transitionLite/buildTransitionLiteResult.js";
import { buildNewgradTransitionLiteResult } from "./lib/transitionLite/buildNewgradTransitionLiteResult.js";
import { parseWithAI, emptyParsed } from "./lib/parse/parseWithAI.js";
import { buildResumeProfileFromParsedResume } from "./lib/resume/buildResumeProfileFromParsedResume.js";
import { REPORT_UI_FLAGS } from "./config/reportUiFlags.js";
import { buildJdResumeFit } from "@/lib/fit/jdResumeFit";
import { buildMustRequirementsGapRisk } from "./lib/preciseAnalysis/buildMustRequirementsGapRisk.js";
import { buildExperienceLevelGapRisk }  from "./lib/preciseAnalysis/buildExperienceLevelGapRisk.js";
import { buildAchievementEvidenceGapRisk } from "./lib/preciseAnalysis/buildAchievementEvidenceGapRisk.js";
import { buildJdKeywordCoverageGapRisk }  from "./lib/preciseAnalysis/buildJdKeywordCoverageGapRisk.js";
import { buildGapExplanationMissingRisk } from "./lib/preciseAnalysis/buildGapExplanationMissingRisk.js";
import { buildCompositeRisk }           from "./lib/preciseAnalysis/buildCompositeRisk.js";
import { buildRejectionCareerCoreSignal } from "./lib/preciseAnalysis/buildRejectionCareerCoreSignal.js";
import { saveAnalysisRun } from "./lib/persistence/saveAnalysisRun.js";
import { buildRecruiterReadContext } from "./lib/adapters/buildRecruiterReadContext.js";
import {
  JOB_TAXONOMY_OPTIONS,
  getJobOntologyItemByMajorSubcategory,
  getJobTaxonomyOptionByMajorKey,
} from "./data/job/jobOntology.index.js";
import { resolveLegacyJobKeyToTaxonomyPath } from "./data/job/jobMigrationMap.js";
import {
  getReminderPreference,
  upsertReminderPreference,
  getDefaultWeeklyExperienceRecallPreference,
  WEEKLY_EXPERIENCE_RECALL_REMINDER_TYPE,
} from "./lib/reminderPreferenceRepository.js";
import {
  getCareerBaseline,
  upsertCareerBaseline,
} from "./lib/careerBaselineRepository.js";
import {
  isWebPushSupported,
  isPublicKeyConfigured,
  registerServiceWorker,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  getCurrentSubscription,
} from "./lib/webPushClient.js";
import {
  loadPushSubscription,
  upsertPushSubscription,
  deletePushSubscription,
} from "./lib/pushSubscriptionRepository.js";
import { supabase } from "./lib/supabaseClient.js";
import { fetchSchedulerV2NotificationSummaryWithBootstrap } from "./lib/schedulerV2NotificationSummaryRepository.js";
import { listCalendarWorkRecords } from "./lib/workRecordRepository.js";

const PASSMAP_CALENDAR_RECORD_CONTEXT_STORAGE_KEY = "passmap:calendarRecordContext";

function persistPassmapCalendarRecordContext(context) {
  if (typeof window === "undefined") return;
  try {
    if (context) {
      window.sessionStorage.setItem(PASSMAP_CALENDAR_RECORD_CONTEXT_STORAGE_KEY, JSON.stringify(context));
    } else {
      window.sessionStorage.removeItem(PASSMAP_CALENDAR_RECORD_CONTEXT_STORAGE_KEY);
    }
  } catch {
    return;
  }
}

function isAccountRecoveryHelperRequested() {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search || "").get("account_recovery") === "1";
  } catch {
    return false;
  }
}

function AccountRecoveryHelperPanel({ auth }) {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [diagnostic, setDiagnostic] = useState(null);
  const [auxGoogleConfirmed, setAuxGoogleConfirmed] = useState(false);
  const [dataTransferConfirmed, setDataTransferConfirmed] = useState(false);
  const [kakaoUnlinkConfirmed, setKakaoUnlinkConfirmed] = useState(false);
  const state = buildAccountRecoveryHelperState(summary, {
    enableGoogleLinkAction: true,
    explicitConfirmation: auxGoogleConfirmed ? GOOGLE_LINK_CONFIRMATION_TOKEN : "",
    dataTransferConfirmed,
    kakaoUnlinkConfirmed,
  });
  const providerLabel = auth?.user?.provider ? String(auth.user.provider) : "unknown";

  async function refreshIdentities() {
    setStatus("loading");
    setMessage("");
    setDiagnostic(null);
    try {
      const nextSummary = await getCurrentUserIdentities();
      setSummary(nextSummary);
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error?.code || "account_recovery_identity_lookup_failed");
    }
  }

  async function handleKakaoUnlink() {
    if (!state.canAttemptKakaoUnlink) return;
    setStatus("loading");
    setMessage("");
    setDiagnostic(null);
    try {
      const result = await runGuardedKakaoUnlink({
        identitySummary: summary,
        dataTransferConfirmed,
        kakaoUnlinkConfirmed,
      });
      if (result?.summary) setSummary(result.summary);
      setStatus("ready");
      setMessage(result?.started ? "kakao_unlink_completed" : "kakao_unlink_guarded");
    } catch (error) {
      setStatus("error");
      setMessage(error?.code || "account_recovery_kakao_unlink_failed");
      setDiagnostic(error?.diagnostic || null);
    }
  }

  async function handleGoogleLink() {
    if (!state.canAttemptGoogleLink) return;
    setStatus("loading");
    setMessage("");
    setDiagnostic(null);
    try {
      const result = await runGuardedAuxiliaryGoogleLink({
        identitySummary: summary,
        confirmed: auxGoogleConfirmed,
        redirectTo: getAccountRecoveryRedirectTo(),
        reloadIdentities: getCurrentUserIdentities,
      });
      if (result?.summary) setSummary(result.summary);
      setStatus("ready");
      setMessage("google_link_started");
    } catch (error) {
      setStatus("error");
      setMessage(error?.code || "account_recovery_google_link_failed");
      setDiagnostic(error?.diagnostic || null);
    }
  }

  useEffect(() => {
    refreshIdentities();
  }, []);

  return (
    <div className="fixed bottom-5 left-5 z-[2147483646] w-[min(420px,calc(100vw-40px))]">
      <Card className="rounded-2xl border-amber-200 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur">
        <CardHeader className="space-y-1 pb-3">
          <CardTitle className="text-base text-slate-950">Account recovery helper</CardTitle>
          <div className="text-xs leading-relaxed text-slate-600">
            이 단계는 source 계정에 보조 로그인 수단을 추가하기 위한 준비 단계입니다.
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-500">현재 로그인 provider</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{providerLabel}</div>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <div className="font-semibold text-slate-500">identity count</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{state.identityCount}</div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">
            <div className="font-semibold text-slate-900">provider summary</div>
            <div className="mt-1">
              {state.providers.length ? state.providers.join(", ") : status === "loading" ? "loading" : "unknown"}
            </div>
            <button
              type="button"
              className="mt-2 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
              onClick={refreshIdentities}
              disabled={status === "loading"}
            >
              상태 다시 확인
            </button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            <div className="font-semibold">보조 identity 추가 준비</div>
            <div className="mt-1">
              target Google 계정과 같은 Google 계정을 보조 identity로 사용하면 안 됩니다.
            </div>
            <div className="mt-1">
              보조 Google identity 연결은 Kakao unlink를 가능하게 만들기 위한 준비 단계입니다.
            </div>
            <label className="mt-3 flex items-start gap-2 rounded-md bg-white/70 px-3 py-2 text-xs font-semibold text-amber-950">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={auxGoogleConfirmed}
                onChange={(event) => setAuxGoogleConfirmed(event.target.checked)}
              />
              <span>이 Google 계정은 target Google 계정과 다른 보조 계정입니다.</span>
            </label>
            <button
              type="button"
              className="mt-2 w-full rounded-md bg-slate-300 px-3 py-2 text-sm font-semibold text-slate-600"
              onClick={handleGoogleLink}
              disabled={!state.canAttemptGoogleLink || status === "loading"}
            >
              Google 보조 identity 연결 준비
            </button>
          </div>

          <div
            className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
              state.canAttemptKakaoUnlink
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-100 bg-red-50 text-red-700"
            }`}
          >
            <div className="font-semibold">
              {state.canAttemptKakaoUnlink ? "Kakao unlink 실행 가능" : "Kakao unlink 비활성화"}
            </div>
            {!state.canAttemptKakaoUnlink ? (
              <div className="mt-1">blocked: {state.kakaoUnlinkBlockers.join(", ") || "identity_summary_loading"}</div>
            ) : null}
            <label className="mt-3 flex items-start gap-2 rounded-md bg-white/70 px-3 py-2 text-xs font-semibold">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={dataTransferConfirmed}
                onChange={(event) => setDataTransferConfirmed(event.target.checked)}
              />
              <span>{ACCOUNT_RECOVERY_TRANSFER_CONFIRMATION_TEXT}</span>
            </label>
            <label className="mt-2 flex items-start gap-2 rounded-md bg-white/70 px-3 py-2 text-xs font-semibold">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={kakaoUnlinkConfirmed}
                onChange={(event) => setKakaoUnlinkConfirmed(event.target.checked)}
              />
              <span>{ACCOUNT_RECOVERY_KAKAO_UNLINK_CONFIRMATION_TEXT}</span>
            </label>
            <button
              type="button"
              className={`mt-2 w-full rounded-md px-3 py-2 text-sm font-semibold ${
                state.canAttemptKakaoUnlink && status !== "loading"
                  ? "bg-emerald-700 text-white"
                  : "cursor-not-allowed bg-red-100 text-red-400"
              }`}
              onClick={handleKakaoUnlink}
              disabled={!state.canAttemptKakaoUnlink || status === "loading"}
            >
              {status === "loading" ? "Kakao unlink 확인 중" : "Kakao unlink 실행"}
            </button>
          </div>

          {message ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {message}
              {diagnostic ? (
                <div className="mt-2 space-y-1">
                  <div>category: {diagnostic.category || "unknown"}</div>
                  <div>status: {diagnostic.status || "unknown"}</div>
                  <div>name: {diagnostic.name || "unknown"}</div>
                  <div>message: {diagnostic.message || "unknown"}</div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ✅ DEBUG HOOKS (append-only): catch ReferenceError stack reliably
// - place: after last import, before App component definition
// - goal: capture exact stack/line for "__key is not defined" (or any error)
// PASSMAP TRACE (P0-2) — App.jsx module BOOT (must run if this file is loaded)
try {
  const __t = {
    at: Date.now(),
    where: "App.jsx:module_boot",
    href: String(window?.location?.href || ""),
    ua: String(navigator?.userAgent || ""),
  };
  window.__PASSMAP_BOOT__ = __t;
} catch { }
try {
  if (typeof window !== "undefined" && !window.__ERR_HOOK_INSTALLED__) {
    window.__ERR_HOOK_INSTALLED__ = true;
    window.__DBG_ERR_LAST__ = window.__DBG_ERR_LAST__ || null;
    window.__DBG_REJ_LAST__ = window.__DBG_REJ_LAST__ || null;
    window.__DBG_AI_ERR__ = window.__DBG_AI_ERR__ || null;
    window.__DBG_FETCH__ = window.__DBG_FETCH__ || { rows: [] };

    const __packErr = (err, extra) => {
      const e = err && (err.error || err.reason || err);
      const msg =
        (e && (e.message || String(e))) ||
        (err && (err.message || String(err))) ||
        "unknown_error";

      const stack =
        (e && e.stack) ||
        (err && err.error && err.error.stack) ||
        (err && err.reason && err.reason.stack) ||
        null;

      return {
        at: Date.now(),
        message: msg,
        name: (e && e.name) || null,
        stack,
        filename: err && err.filename ? err.filename : null,
        lineno: err && typeof err.lineno === "number" ? err.lineno : null,
        colno: err && typeof err.colno === "number" ? err.colno : null,
        extra: extra || null,
      };
    };

    window.addEventListener(
      "error",
      (ev) => {
        try {
          window.__DBG_ERR_LAST__ = __packErr(ev, { type: "window.error" });
          // 콘솔에서 바로 눈에 띄게
          console.error("[DBG][window.error]", window.__DBG_ERR_LAST__);
        } catch { }
      },
      true
    );

    window.addEventListener(
      "unhandledrejection",
      (ev) => {
        try {
          window.__DBG_REJ_LAST__ = __packErr(ev, { type: "window.unhandledrejection" });
          console.error("[DBG][unhandledrejection]", window.__DBG_REJ_LAST__);
        } catch { }
      },
      true
    );

    // (선택) fetch 래핑: 어떤 요청 직후 터지는지 타임라인 확보
    if (!window.__DBG_FETCH_PATCHED__ && typeof window.fetch === "function") {
      window.__DBG_FETCH_PATCHED__ = true;
      const __origFetch = window.fetch.bind(window);

      window.fetch = async (...args) => {
        const t0 = Date.now();
        const url = (() => {
          try {
            const a0 = args && args[0];
            if (typeof a0 === "string") return a0;
            if (a0 && typeof a0.url === "string") return a0.url;
            return "(unknown_url)";
          } catch {
            return "(unknown_url)";
          }
        })();

        try {
          const res = await __origFetch(...args);
          const row = {
            at: Date.now(),
            ms: Date.now() - t0,
            url,
            ok: !!res.ok,
            status: res.status,
          };
          try {
            window.__DBG_FETCH__.rows = window.__DBG_FETCH__.rows || [];
            window.__DBG_FETCH__.rows.push(row);
          } catch { }
          return res;
        } catch (e) {
          const row = {
            at: Date.now(),
            ms: Date.now() - t0,
            url,
            ok: false,
            status: null,
            error: { message: e?.message || String(e), stack: e?.stack || null },
          };
          try {
            window.__DBG_FETCH__.rows = window.__DBG_FETCH__.rows || [];
            window.__DBG_FETCH__.rows.push(row);
          } catch { }
          throw e;
        }
      };
    }
  }
} catch { }
// ✅ DEBUG STAMP (append-only): verify latest App.jsx is running
try { if (typeof window !== "undefined") window.__APP_STAMP__ = "appjsx_keyfix_stamp_20260302"; } catch { }
// ✅ DEBUG ERR HOOK (append-only): capture stack for "__key is not defined"
try {
  if (typeof window !== "undefined" && !window.__ERR_HOOK_INSTALLED__) {
    window.__ERR_HOOK_INSTALLED__ = true;

    window.addEventListener("error", (ev) => {
      try {
        window.__DBG_ERR_LAST__ = {
          type: "error",
          message: String(ev?.message || ""),
          filename: String(ev?.filename || ""),
          lineno: ev?.lineno ?? null,
          colno: ev?.colno ?? null,
          stack: String(ev?.error?.stack || ""),
          at: new Date().toISOString(),
        };
      } catch { }
    });

    window.addEventListener("unhandledrejection", (ev) => {
      try {
        const r = ev?.reason;
        window.__DBG_ERR_LAST__ = {
          type: "unhandledrejection",
          message: String(r?.message || r || ""),
          stack: String(r?.stack || ""),
          at: new Date().toISOString(),
        };
      } catch { }
    });
  }
} catch { }

const FIRST_RECORD_ONBOARDING_DISMISSED_KEY = "passmap:first-record-premium-onboarding-dismissed:v1";

function hasDismissedFirstRecordOnboarding() {
  try {
    return window.localStorage.getItem(FIRST_RECORD_ONBOARDING_DISMISSED_KEY) === "1";
  } catch (_) {
    return false;
  }
}

function dismissFirstRecordOnboarding() {
  try {
    window.localStorage.setItem(FIRST_RECORD_ONBOARDING_DISMISSED_KEY, "1");
  } catch (_) {}
}

function getTodayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function scoreToLabel(n) {
  if (n === 1) return "매우 낮음";
  if (n === 2) return "낮음";
  if (n === 3) return "보통";
  if (n === 4) return "높음";
  if (n === 5) return "매우 높음";
  return "";
}

function __pmPad2(n) {
  return String(n).padStart(2, "0");
}

function __pmCurrentYm() {
  const now = new Date();
  const y = Number(now.getFullYear());
  const m = Number(now.getMonth()) + 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return `${y}-${__pmPad2(m)}`;
}

function __pmNormalizeTimelineYm(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^present$/i.test(raw)) return "present";

  const m = raw.match(/^(\d{4})[-./](\d{1,2})$/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return `${y}-${__pmPad2(mo)}`;
}

function __pmMonthsBetween(startYm, endYm) {
  const s = __pmNormalizeTimelineYm(startYm);
  const eRaw = __pmNormalizeTimelineYm(endYm);
  const e = eRaw === "present" ? __pmCurrentYm() : eRaw;
  if (!s || !e) return null;

  const sm = s.match(/^(\d{4})-(\d{2})$/);
  const em = e.match(/^(\d{4})-(\d{2})$/);
  if (!sm || !em) return null;

  const sy = Number(sm[1]);
  const smo = Number(sm[2]);
  const ey = Number(em[1]);
  const emo = Number(em[2]);
  if (!Number.isFinite(sy) || !Number.isFinite(smo) || !Number.isFinite(ey) || !Number.isFinite(emo)) return null;

  const months = (ey - sy) * 12 + (emo - smo) + 1;
  return months > 0 ? months : null;
}

function isNewgradTransitionLitePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  if (Boolean(source.entryLevelMode || source.newgradMode || source.isEntryCandidate)) return true;

  const currentJobId = String(source.currentJobId || "").trim();
  const currentIndustryId = String(source.currentIndustryId || "").trim();
  const targetJobId = String(source.targetJobId || "").trim();
  const targetIndustryId = String(source.targetIndustryId || "").trim();

  return Boolean(!currentJobId && !currentIndustryId && targetJobId && targetIndustryId);
}

function resolveTransitionLiteAudience({ appAudience, payload }) {
  const source = payload && typeof payload === "object" ? payload : {};
  if (Boolean(source.entryLevelMode || source.newgradMode || source.isEntryCandidate)) return "newgrad";

  const audience = String(appAudience || "").trim();
  if (audience === "experienced" || audience === "newgrad") return audience;

  return isNewgradTransitionLitePayload(source) ? "newgrad" : "experienced";
}

function __pmHasCareerHistoryValue(stateLike) {
  if (!stateLike || typeof stateLike !== "object") return false;
  const direct = Array.isArray(stateLike.careerHistory) ? stateLike.careerHistory : null;
  if (direct && direct.length > 0) return true;
  const nested = Array.isArray(stateLike.career?.history) ? stateLike.career.history : null;
  return !!(nested && nested.length > 0);
}

function __pmNormalizeTimelineType(rawType) {
  if (typeof rawType !== "string") return null;
  const t = rawType.trim().toLowerCase();
  if (!t) return null;
  if (t.includes("인턴") || t.includes("intern") || t.includes("현장실습")) return "intern";
  if (t.includes("정규") || t.includes("fulltime") || t.includes("full-time") || t.includes("full time")) return "fulltime";
  if (t.includes("계약") || t.includes("contract") || t.includes("기간제")) return "contract";
  if (t.includes("프로젝트") || t.includes("project") || t.includes("캡스톤") || t.includes("공모전")) return "project";
  if (t.includes("프리랜서") || t.includes("freelance") || t.includes("외주")) return "freelance";
  if (t.includes("아르바이트") || t.includes("part-time") || t.includes("파트타임") || t.includes("parttime")) return "parttime";
  if (t.includes("기타") || t.includes("other")) return "other";
  return null;
}

function __pmBuildCanonicalCareerHistory(parsedResume) {
  const timeline = Array.isArray(parsedResume?.timeline) ? parsedResume.timeline : null;
  if (!timeline || timeline.length === 0) return null;

  const out = timeline.map((item) => {
    const row = item && typeof item === "object" ? item : {};
    const startDate = __pmNormalizeTimelineYm(row.start);
    const rawEnd = __pmNormalizeTimelineYm(row.end);
    const endDate = rawEnd;
    const months = __pmMonthsBetween(startDate, endDate);

    return {
      company: typeof row.company === "string" ? row.company : null,
      role: typeof row.role === "string" ? row.role : null,
      startDate,
      endDate,
      months,
      bullets: Array.isArray(row.bullets) ? row.bullets.filter((x) => typeof x === "string") : [],
      industry: null,
      detectedIndustry: null,
      employmentType: __pmNormalizeTimelineType(row.type),
      type: __pmNormalizeTimelineType(row.type),
      source: "parsedResume.timeline",
    };
  });

  return out.length > 0 ? out : null;
}

function __pmInjectCareerHistoryBridge(stateLike, parsedResume) {
  if (!stateLike || typeof stateLike !== "object") return;
  if (__pmHasCareerHistoryValue(stateLike)) return;

  const canonical = __pmBuildCanonicalCareerHistory(parsedResume);
  if (Array.isArray(canonical) && canonical.length > 0) {
    stateLike.careerHistory = canonical;
  }
}

function __pmNormalizeRoleHeadingText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, "");
}

function __pmScopeJdByTargetRole(jdText, targetRoleInPosting) {
  if (!targetRoleInPosting || !jdText) return jdText;
  const normalizedTarget = __pmNormalizeRoleHeadingText(targetRoleInPosting);
  if (!normalizedTarget) return jdText;

  const headingRegex = /^\s*\[([^\]\n]{2,120})\]\s*$/gm;
  const headings = [];
  let m;
  while ((m = headingRegex.exec(jdText)) !== null) {
    headings.push({ text: m[1], start: m.index, end: m.index + m[0].length });
  }
  if (headings.length === 0) return jdText;

  let matchedIdx = -1;
  for (let i = 0; i < headings.length; i++) {
    const normalizedHeading = __pmNormalizeRoleHeadingText(headings[i].text);
    if (normalizedHeading.includes(normalizedTarget) || normalizedTarget.includes(normalizedHeading)) {
      matchedIdx = i;
      break;
    }
  }
  if (matchedIdx === -1) return jdText;

  const sectionStart = headings[matchedIdx].start;
  const sectionEnd = matchedIdx + 1 < headings.length ? headings[matchedIdx + 1].start : jdText.length;
  const scoped = jdText.slice(sectionStart, sectionEnd).trim();
  if (scoped.length < 30) return jdText;

  try {
    if (typeof window !== "undefined") {
      window.__PM_SCOPED_JD_DEBUG__ = {
        targetRoleInPosting,
        originalLength: jdText.length,
        scopedLength: scoped.length,
        scopedApplied: scoped.length !== jdText.length,
      };
    }
  } catch { }

  return scoped;
}

function __canAnalyzeStateLike(stateLike, imeDraftLike) {
  const s = (() => {
    const merged = { ...(stateLike || {}) };
    const d = imeDraftLike && typeof imeDraftLike === "object" ? imeDraftLike : {};
    for (const k of Object.keys(d)) {
      const v = d[k];
      merged[k] = v === undefined || v === null ? "" : String(v);
    }
    return merged;
  })();

  const pickText = (...vals) => {
    for (const v of vals) {
      const t = (v ?? "").toString().trim();
      if (t) return t;
    }
    return "";
  };

  const jd = pickText(
    s.jd, s.jdText, s.jobDescription, s.job_desc
  );
  const resume = pickText(
    s.resume, s.resumeText, s.cv, s.resume_text
  );
  const hasRole = !!pickText(s.roleTarget, s.targetRole, s.role, s.jobRole);
  const hasIndustry = !!pickText(s.industryTarget, s.targetIndustry, s.industry);
  const totalYears = s?.career?.totalYears;
  const hasYears =
    totalYears !== null &&
    totalYears !== undefined &&
    String(totalYears).trim() !== "" &&
    Number.isFinite(Number(totalYears));

  return Boolean(jd && resume);
}

// ------------------------------
// Self-check UX helpers
// - Rubrics: 점수별 의미(의구심 해소)
// - Checklists: 질문형 체크리스트 -> 자동 점수(1~5)
// ------------------------------
const SELF_CHECK_RUBRICS = {
  coreFit: {
    1: "직무 관련 경험이 거의 없거나, JD 필수요건을 대부분 설명 못 함",
    2: "일부 요건은 닿지만, 핵심 요건에서 빠지는 구멍이 큼",
    3: "필수 요건은 충족하나 우대 사항/실전 경험은 부족함",
    4: "필수+우대 일부까지 충족, 즉시 전력으로 투입 가능",
    5: "JD 요건을 상회하고, 바로 성과를 만들 근거가 명확함",
  },
  proofStrength: {
    1: "성과가 전부 '했다' 수준(수치/전후/기여도/검증이 거의 없음)",
    2: "수치는 조금 있으나 맥락이 약함(왜/어떻게/결과가 흐림)",
    3: "핵심 경험 일부는 전후/기여도/결과가 보이지만 일관되진 않음",
    4: "대부분 경험이 수치+전후+내 기여로 설명되고 검증 가능함",
    5: "핵심 성과 2~3개가 '숫자+맥락+검증'으로 매우 탄탄함",
  },
  roleClarity: {
    1: "나는 뭘 잘하는지/어떤 역할인지 한 문장으로 말하기 어렵다",
    2: "방향은 있으나 직무 정체성이 흐리고 표현이 흔들린다",
    3: "내 역할/강점을 말할 수는 있으나 JD 언어로 연결이 약하다",
    4: "내 강점이 JD 핵심업무와 자연스럽게 이어진다",
    5: "포지셔닝이 아주 선명하고, '이 사람을 뽑아야 할 이유'가 바로 보인다",
  },
  storyConsistency: {
    1: "이직사유-지원사유-경험이 서로 따로 놀고, 질문에 막힌다",
    2: "큰 줄기는 있으나 세부에서 모순/구멍이 자주 보인다",
    3: "기본 논리는 성립하지만, 설득력 있는 '한 줄'이 약하다",
    4: "논리 흐름이 매끄럽고 반례 질문에도 흔들리지 않는다",
    5: "스토리가 간결·설득·검증 가능하고, 면접관이 의심할 지점이 적다",
  },
  riskSignals: {
    1: "공백/짧은 근속/잦은 이직을 설명할 구조가 없고 질문이 두렵다",
    2: "설명은 가능하지만, 사실 검증/일관성/대안이 약하다",
    3: "기본 방어는 가능하나, 꼬리 질문에서 흔들릴 수 있다",
    4: "사실-의도-행동-증거로 방어가 가능하고 리스크가 관리된다",
    5: "리스크가 거의 없거나, 리스크가 있어도 대응 논리가 매우 탄탄하다",
  },
};

const SELF_CHECK_CHECKLISTS = {
  coreFit: [
    "면접관이 '당신은 어떤 문제를 해결하는 사람인가요?'라고 물으면 10초 안에 답할 수 있다",
    "공고(JD)의 '주요 업무'를 보고 첫 출근 날 무엇을 해야 할지 구체적으로 그려진다",
    "내 강점 3가지가 이 회사 JD 핵심 키워드와 1:1로 맞물린다",
    "(경력 전환이면) 이전 직무의 능력이 이 포지션에서 어떻게 돈/성과가 되는지 설득할 수 있다",
  ],
  proofStrength: [
    "대표 성과 1~2개가 숫자(%, 원, 시간 등)로 말할 수 있다",
    "성과에 '내 기여도'가 분명하다(내가 무엇을 했는지 구분 가능)",
    "전후 비교(문제-행동-결과)가 한 문단으로 정리돼 있다",
    "성과를 증명할 자료/링크/산출물이 있다(문서/대시보드/포트폴리오 등)",
  ],
  roleClarity: [
    "내 직무 정체성을 한 문장으로 말할 수 있다(예: 'OO 문제를 OO로 해결하는 사람')",
    "지원 포지션에서 '내가 맡을 역할'이 구체적으로 그려진다",
    "내 강점이 JD 업무 문장 2~3개와 1:1로 연결된다",
    "경력 전환이면 '전이 가능한 능력'을 사례로 설득할 준비가 되어 있다",
  ],
  storyConsistency: [
    "이직 사유가 불만이 아니라 '확장/정렬'로 설명된다",
    "지원 사유가 회사/직무의 구체 요소(업무/제품/팀)와 연결된다",
    "내 경험이 그 지원 사유를 증명하는 순서로 배열되어 있다",
    "꼬리 질문(왜 지금? 왜 우리? 왜 이전 회사는?)에도 논리가 끊기지 않는다",
  ],
  riskSignals: [
    "공백/짧은 근속/잦은 이직 이슈를 '사실-의도-행동-증거'로 설명할 수 있다",
    "조건 제약(연봉/근무지/비자 등)이 있어도 해결책/우선순위가 정리되어 있다",
    "커뮤니케이션에서 과장/모순이 생길 여지가 적다(사실 검증이 가능하다)",
    "레퍼런스/평판에서 문제가 될 만한 포인트가 없다(또는 선제 대응이 준비됐다)",
  ],
};

function StepPill({ active, done, icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "group inline-flex items-center gap-2 px-2 py-2 text-sm font-medium transition-colors select-none border-b-2 " +
        (active
          ? "text-slate-900 border-primary"
          : "text-slate-500 border-transparent hover:text-slate-900 hover:border-slate-200")
      }
    >
      <span className={"grid h-7 w-7 place-items-center rounded-lg bg-slate-50 text-slate-500 group-hover:text-slate-900 " + (active ? "bg-primary/10 text-primary" : "")}>
        {done ? (
          <Check className="h-4 w-4 text-emerald-600" />
        ) : (
          <Icon className={"h-4 w-4 " + (active ? "text-primary" : "text-muted-foreground")} />
        )}
      </span>
      <span className={"font-medium tracking-tight " + (active ? "" : "text-muted-foreground group-hover:text-foreground")}>
        {label}
      </span>
    </button>
  );
}

function SliderRow({ label, value, onChange, hint, descriptions }) {
  const tone = value <= 2 ? "destructive" : value === 3 ? "secondary" : "default";
  const desc = descriptions ? descriptions[value] : null;

  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-background/70 backdrop-blur p-4 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">{label}</div>
          {hint ? <div className="text-sm text-muted-foreground/80 mt-1 leading-relaxed">{hint}</div> : null}
        </div>
        <Badge variant={tone} className="shrink-0 rounded-full px-3 py-1 text-xs shadow-sm">
          {value} / 5 · {scoreToLabel(value)}
        </Badge>
      </div>

      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value), 1, 5))}
        className="w-full accent-primary"
      />

      {desc ? (
        <div className="rounded-2xl border border-border/70 bg-background/70 backdrop-blur p-4 text-xs leading-relaxed text-foreground/80 shadow-sm">
          <span className="font-medium text-foreground">지금 점수 기준:</span> {desc}
        </div>
      ) : null}
    </div>
  );
}

function ChecklistRow({ label, value, onChange, hint, questions, rubric }) {
  const q = Array.isArray(questions) ? questions : [];
  const size = q.length || 4;

  const [checked, setChecked] = useState(() => {
    const count = clamp(Number(value ?? 1) - 1, 0, size);
    return Array.from({ length: size }, (_, i) => i < count);
  });

  React.useEffect(() => {
    setChecked((prev) => {
      const currentScore = clamp(prev.filter(Boolean).length + 1, 1, 5);
      if (currentScore === value) return prev;

      const desiredCount = clamp(Number(value ?? 1) - 1, 0, size);
      return Array.from({ length: size }, (_, i) => i < desiredCount);
    });
  }, [value, size]);

  const checkedCount = checked.filter(Boolean).length;
  const score = clamp(checkedCount + 1, 1, 5);

  React.useEffect(() => {
    if (score !== value) onChange(score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedCount]);

  const tone = score <= 2 ? "destructive" : score === 3 ? "secondary" : "default";
  const desc = rubric ? rubric[score] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{label}</div>
          {hint ? <div className="text-sm text-muted-foreground mt-0.5">{hint}</div> : null}
        </div>
        <Badge variant={tone} className="shrink-0">
          {score} / 5 · {scoreToLabel(score)}
        </Badge>
      </div>

      <div className="space-y-2">
        {q.slice(0, size).map((text, i) => (
          <label
            key={i}
            className="flex items-start gap-2 rounded-xl border bg-muted/20 p-3 cursor-pointer hover:bg-muted/30"
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4"
              checked={Boolean(checked[i])}
              onChange={(e) => {
                const nextVal = e.target.checked;
                setChecked((prev) => {
                  const next = prev.slice();
                  next[i] = nextVal;
                  return next;
                });
              }}
            />
            <span className="text-xs leading-relaxed text-foreground/85">{text}</span>
          </label>
        ))}
      </div>

      {desc ? (
        <div className="rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed text-foreground/80">
          <span className="font-medium text-foreground">현재 판단(면접관 시점):</span> {desc}
        </div>
      ) : null}
    </div>
  );
}

function Shell({ children, leftRail = null, isJobRailLayout = false, isJobDashboardLayout = false, isAssetMapLayout = false, isJobAnalysisLandingLayout = false }) {
  const jobRailMaxWidthClass = "max-w-[1720px]";
  const jobRailPaddingClass = "px-1.5 py-5 sm:px-4 sm:py-8 xl:px-4 2xl:px-6";
  const jobRailGapClass = "gap-3";

  return (
    <main className="min-h-screen bg-slate-50 text-foreground">
      {isJobRailLayout ? (
        <div className={`mx-auto w-full ${jobRailMaxWidthClass} ${jobRailPaddingClass}`}>
          <div className={`grid grid-cols-1 ${jobRailGapClass} lg:grid-cols-[196px_minmax(0,1fr)] lg:items-start`}>
            <div className="order-last min-w-0 pt-2 lg:order-none lg:pt-0 lg:sticky lg:top-6">
              {leftRail}
            </div>
            <div className="order-first min-w-0 lg:order-none">
              <div className="relative w-full min-w-0">{children}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto w-full max-w-6xl px-1.5 py-6 sm:px-6 sm:py-10">{children}</div>
      )}
    </main>
  );
}

/**
 * Deep copy(structuredClone/JSON stringify) 제거
 * - path에 해당하는 "경로만" 얕게 복사하며 불변 업데이트
 * - 데이터가 커져도 타이핑 성능 저하가 훨씬 덜함
 */
function setIn(obj, keys, value) {
  if (keys.length === 0) return obj;
  const [head, ...rest] = keys;

  const isIndex = String(Number(head)) === head;

  // obj가 null/undefined일 수 있으므로 안전 베이스
  const baseObj = obj && typeof obj === "object" ? obj : (isIndex ? [] : {});

  if (rest.length === 0) {
    if (Array.isArray(baseObj)) {
      const nextArr = baseObj.slice();
      nextArr[isIndex ? Number(head) : head] = value;
      return nextArr;
    }
    return { ...baseObj, [head]: value };
  }

  const cur = baseObj?.[head];

  // 다음 키가 index면 배열, 아니면 객체를 기본으로 생성
  const nextIsIndex = String(Number(rest[0])) === rest[0];
  const childBase = cur ?? (nextIsIndex ? [] : {});

  const nextChild = setIn(childBase, rest, value);

  if (Array.isArray(baseObj)) {
    const nextArr = baseObj.slice();
    nextArr[isIndex ? Number(head) : head] = nextChild;
    return nextArr;
  }

  return { ...baseObj, [head]: nextChild };
}

function buildExpertAdvice(state, analysis) {
  if (!analysis) return [];

  const msgs = [];
  const sc = state?.selfCheck || {};

  const norm5 = (v) => clamp((Number(v ?? 3) - 1) / 4, 0, 1);

  const selfFit = norm5(sc.coreFit);
  const selfRisk = norm5(sc.riskSignals);

  const keywordMatch = Number(analysis.keywordSignals?.matchScore ?? 0);
  const careerRisk = Number(analysis.careerSignals?.careerRiskScore ?? 0);

  const diffFit = selfFit - keywordMatch;
  if (diffFit >= 0.25) {
    msgs.push(
      "본인 평가는 ‘핏이 높다’ 쪽인데, 이력서 텍스트 기준 키워드 매칭은 낮은 편이에요. JD 문장에 맞춰 단어/표현을 먼저 맞추는 게 제일 빠른 개선 포인트예요."
    );
  } else if (diffFit <= -0.25) {
    msgs.push(
      "키워드 매칭은 나쁘지 않은데 본인 평가는 낮게 잡았네요. 스스로 강점을 과소평가했을 수도 있어요. ‘내가 한 일/기여도/결과’만 더 선명하게 정리해 보세요."
    );
  } else {
    msgs.push(
      "자가진단과 객관 지표(키워드 매칭)가 크게 어긋나진 않아요. 이제는 ‘증거 문장(숫자+맥락)’을 더 탄탄하게 만드는 쪽이 효율적입니다."
    );
  }

  const diffRisk = selfRisk - careerRisk;
  if (diffRisk <= -0.25) {
    msgs.push(
      "리스크를 낮게 보고 계신데, 커리어 신호(공백/짧은 근속/이직 빈도) 관점에선 경계 구간이에요. 리스크 설명 문장을 ‘사실-의도-행동-증거’로 고정해두면 방어력이 확 올라갑니다."
    );
  } else if (diffRisk >= 0.25) {
    msgs.push(
      "리스크를 꽤 높게 보고 계신데, 숫자상으로는 ‘치명적’까진 아닐 수 있어요. 과하게 위축되기보다, 질문 예상 5개만 정해서 답변 구조를 고정하는 쪽으로 가봅시다."
    );
  }

  if (analysis.keywordSignals?.hasKnockoutMissing) {
    msgs.unshift(
      "지금 상태에선 ‘필수요건 누락’이 가장 위험해요. 평균점으로 커버가 안 되는 구간이라, 누락 키워드를 ‘경험 문장’에 사실 기반으로 넣거나, 없으면 짧은 결과물(미니 프로젝트)로 증거를 먼저 만들어야 해요."
    );
  }

  return msgs;
}

// ------------------------------
// AI proxy call
// ------------------------------
async function fetchAiEnhance({ jd, resume, signal, ruleContext } = {}) {
  const base = import.meta.env.VITE_PARSE_API_BASE || import.meta.env.VITE_AI_PROXY_URL || import.meta.env.VITE_API_BASE;
  // ✅ PATCH (append-only): define __key safely (prevent ReferenceError)
  const __key = (import.meta.env.VITE_AI_PROXY_KEY || "").toString().trim();
  const key = __key;
  if (!base) return { ok: false, error: "VITE_AI_PROXY_URL is missing (.env 확인 + dev 서버 재시작)" };

  const url = base.replace(/\/$/, "") + "/api/enhance";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  const onAbort = () => controller.abort();

  // ✅ PATCH: only treat `signal` as AbortSignal when it really is one
  const __isAbortSignal =
    signal &&
    typeof signal === "object" &&
    typeof signal.addEventListener === "function" &&
    typeof signal.removeEventListener === "function";

  try {
    if (__isAbortSignal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    // ✅ 기존 payload + ruleContext 확장 (유지)
    const body = {
      jd: jd || "",
      resume: resume || "",

      ruleRole: ruleContext?.ruleRole ?? "unknown",
      ruleIndustry: ruleContext?.ruleIndustry ?? "unknown",
      roleSignals: Array.isArray(ruleContext?.roleSignals) ? ruleContext.roleSignals : [],
      industrySignals: Array.isArray(ruleContext?.industrySignals) ? ruleContext.industrySignals : [],

      ruleRoleConfidence: typeof ruleContext?.ruleRoleConfidence === "number" ? ruleContext.ruleRoleConfidence : null,
      ruleIndustryConfidence:
        typeof ruleContext?.ruleIndustryConfidence === "number" ? ruleContext.ruleIndustryConfidence : null,

      structureAnalysis: ruleContext?.structureAnalysis ?? null,
    };

    // ✅ PATCH (append-only): optional api key header (only if provided)
    const __headers = { "Content-Type": "application/json" };
    if (key) {
      __headers["x-api-key"] = key;
    }

    const resp = await fetch(url, {
      method: "POST",
      headers: __headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }

    if (!resp.ok || !data) return { ok: false, error: data?.error || "bad response" };

    return data;
  } catch (e) {
    const msg = String(e || "");
    if (msg.includes("AbortError") || msg.includes("aborted")) return { ok: false, error: "aborted" };
    try {
      if (typeof window !== "undefined") {
        window.__DBG_AI_FETCH_FAIL__ = { at: Date.now(), msg: String(e?.message || e), stack: String(e?.stack || "") };
        console.error("[DBG][AI_FETCH_FAIL]", window.__DBG_AI_FETCH_FAIL__);
      }
    } catch { }
    return { ok: false, error: "fetch_failed", detail: msg };
  } finally {
    clearTimeout(timeout);
    if (__isAbortSignal) {
      try {
        signal.removeEventListener("abort", onAbort);
      } catch {
        // ignore
      }
    }
  }
}

// ✅ P0 (append-only): schema parse call (worker /api/parse)
async function fetchAiSchemaParse({ kind, text } = {}) {
  const base = import.meta.env.VITE_PARSE_API_BASE || import.meta.env.VITE_AI_PROXY_URL || import.meta.env.VITE_API_BASE;
  if (!base) return { ok: false, error: "VITE_PARSE_API_BASE is missing (.env 확인 + dev 서버 재시작)" };

  const url = base.replace(/\/$/, "") + "/api/parse";

  const __kind = kind === "jd" ? "jd" : "resume";
  const __text = typeof text === "string" ? text : "";

  let resJson = null;

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: "SCHEMA_PARSE",
        kind: __kind,
        text: __text,
      }),
    });

    resJson = await resp.json().catch(() => null);

    // ✅ DEBUG mirror
    try { if (typeof window !== "undefined") window.__LAST_SCHEMA_RES__ = resJson; } catch { }

    if (!resp.ok) {
      return { ok: false, error: resJson || { status: resp.status } };
    }

    return resJson || { ok: false, error: "Empty JSON from /api/parse" };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}


function buildAiCardsData(ai) {
  const summary = typeof ai?.summary === "string" ? ai.summary.trim() : "";
  const advice = Array.isArray(ai?.advice) ? ai.advice.filter(Boolean).map((x) => String(x).trim()).filter(Boolean) : [];

  const jdMustHave = Array.isArray(ai?.jdMustHave)
    ? ai.jdMustHave.filter(Boolean).map((x) => String(x).trim()).filter(Boolean)
    : [];

  const conflicts = Array.isArray(ai?.conflicts) ? ai.conflicts : [];
  const suggestedBullets = Array.isArray(ai?.suggestedBullets) ? ai.suggestedBullets : [];

  const semanticMatches = Array.isArray(ai?.semanticMatches) ? ai.semanticMatches : [];
  const mustHaveObjects = Array.isArray(ai?.mustHaveObjects) ? ai.mustHaveObjects : [];

  const keywordSynonyms = ai?.keywordSynonyms && typeof ai.keywordSynonyms === "object" ? ai.keywordSynonyms : null;
  const confidenceDeltaByHypothesis =
    ai?.confidenceDeltaByHypothesis && typeof ai?.confidenceDeltaByHypothesis === "object"
      ? ai.confidenceDeltaByHypothesis
      : null;

  return {
    summary,
    advice,
    jdMustHave,
    conflicts,
    suggestedBullets,
    semanticMatches,
    mustHaveObjects,
    keywordSynonyms,
    confidenceDeltaByHypothesis,
  };
}

function makeAiCacheKey(jd, resume) {
  const j = (jd ?? "").toString();
  const r = (resume ?? "").toString();
  const jHead = j.slice(0, 160);
  const jTail = j.slice(Math.max(0, j.length - 160));
  const rHead = r.slice(0, 160);
  const rTail = r.slice(Math.max(0, r.length - 160));
  // NOTE: 일부 환경/에디터 설정에서 템플릿 리터럴 파싱 이슈가 날 수 있어 문자열 결합 사용
  return (
    String(j.length) +
    ":" +
    jHead +
    ":" +
    jTail +
    "||" +
    String(r.length) +
    ":" +
    rHead +
    ":" +
    rTail
  );
}

// ------------------------------
// Login gate + sample mode (local only / GitHub Pages safe)
// - 실제 OAuth는 다음 단계: 지금은 "더미 로그인"만.
// - 기존 입력(localStorage/state) 절대 덮어쓰기 금지.
// ------------------------------
const LS_AUTH_KEY = "reject_analyzer_auth_v1";
const LS_PENDING_ACTION_KEY = "reject_analyzer_pending_action_v1";
const LS_SAMPLE_MODE_KEY = "reject_analyzer_sample_mode_v1";
const LS_NEWGRAD_RECENT_INPUTS_KEY = "passmap:newgrad:recent-inputs:v1";
const LS_LAST_SOCIAL_PROVIDER_KEY = "passmap:lastSocialLoginProvider";

function safeReadLastSocialLoginProvider() {
  try { return localStorage.getItem(LS_LAST_SOCIAL_PROVIDER_KEY) || null; } catch { return null; }
}
function safeWriteLastSocialLoginProvider(provider) {
  try { localStorage.setItem(LS_LAST_SOCIAL_PROVIDER_KEY, provider); } catch {}
}

function safeParseLocal(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function toSafeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toRecentInputMajorMeta(major) {
  if (!major || typeof major !== "object") return "";
  const subcategory = toTrimmedString(major.subcategory);
  const category = toTrimmedString(major.category);
  return subcategory || category;
}

function normalizeNewgradRecentInputRecord(payload = {}) {
  const safePayload = payload && typeof payload === "object" ? payload : {};
  const contractExperiences = toSafeArray(safePayload.contractExperiences);
  const partTimeExperience = toSafeArray(safePayload.partTimeExperience);
  const strengthsSelected = toSafeArray(safePayload.strengthsSelected);
  const strengths = toSafeArray(safePayload.strengths);
  const workStyleSelected = toSafeArray(safePayload.workStyleSelected);
  const workStyleNotes = toTrimmedString(safePayload.workStyleNotes);
  const normalizedWorkStyleSelected =
    workStyleSelected.length > 0
      ? workStyleSelected.map((item) => toTrimmedString(item)).filter(Boolean)
      : workStyleNotes
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
  const assets = {
    certifications: toSafeArray(safePayload.certifications),
    projects: toSafeArray(safePayload.projects),
    internships: toSafeArray(safePayload.internships),
    contractExperiences: contractExperiences.length > 0 ? contractExperiences : partTimeExperience,
    strengthsSelected: (strengthsSelected.length > 0 ? strengthsSelected : strengths).map((item) => toTrimmedString(item)).filter(Boolean),
    workStyleSelected: normalizedWorkStyleSelected,
  };
  const signature = JSON.stringify(assets);
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    savedAt: new Date().toISOString(),
    meta: {
      targetJobId: toTrimmedString(safePayload.targetJobId),
      targetIndustryId: toTrimmedString(safePayload.targetIndustryId),
      major: toRecentInputMajorMeta(safePayload.major),
    },
    assets,
    signature,
  };
}

function saveNewgradRecentInputRecord(payload = {}) {
  if (typeof window === "undefined") return;
  try {
    const nextRecord = normalizeNewgradRecentInputRecord(payload);
    const raw = window.localStorage.getItem(LS_NEWGRAD_RECENT_INPUTS_KEY);
    const parsed = safeParseLocal(raw);
    const recentRecords = Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
    if (recentRecords[0]?.signature && recentRecords[0].signature === nextRecord.signature) return;
    const nextRecords = [nextRecord, ...recentRecords].slice(0, 5);
    window.localStorage.setItem(LS_NEWGRAD_RECENT_INPUTS_KEY, JSON.stringify(nextRecords));
  } catch {
    // ignore local-only persistence failure
  }
}

function loadAuthState() {
  if (typeof window === "undefined") return { loggedIn: false, user: null };
  const raw = window.localStorage.getItem(LS_AUTH_KEY);
  const parsed = safeParseLocal(raw);
  if (!parsed || typeof parsed !== "object") return { loggedIn: false, user: null };
  return {
    loggedIn: Boolean(parsed.loggedIn),
    user: parsed.user && typeof parsed.user === "object" ? parsed.user : null,
  };
}

function saveAuthState(next) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_AUTH_KEY, JSON.stringify(next || { loggedIn: false, user: null }));
  } catch {
    // ignore
  }
}

function loadPendingAction() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(LS_PENDING_ACTION_KEY);
  const parsed = safeParseLocal(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const type = (parsed.type || "").toString();
  if (!type) return null;
  return parsed;
}

function savePendingAction(next) {
  if (typeof window === "undefined") return;
  try {
    if (!next) window.localStorage.removeItem(LS_PENDING_ACTION_KEY);
    else window.localStorage.setItem(LS_PENDING_ACTION_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function isChatgptAiInboxDeeplink() {
  if (typeof window === "undefined") return false;
  try {
    const hash = String(window.location.hash || "").toLowerCase();
    const params = new URLSearchParams(window.location.search || "");
    const view = String(params.get("view") || "").toLowerCase();
    if (hash !== "#ai-inbox" && view !== "ai-inbox") return false;
    const source = String(params.get("utm_source") || "").toLowerCase();
    return !source || source === "chatgpt" || source === "chatgpt.com";
  } catch {
    return false;
  }
}

function loadSampleMode() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(LS_SAMPLE_MODE_KEY);
  return raw === "1";
}

function saveSampleMode(on) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_SAMPLE_MODE_KEY, on ? "1" : "0");
  } catch {
    // ignore
  }
}

// 샘플 리포트는 "입력 덮어쓰기"가 아니라, 별도 state로만 생성/표시.
const SAMPLE_STATE = {
  ...defaultState,
  company: "영풍정밀",
  role: "기획팀 (6년차)",
  stage: "서류",
  applyDate: "",
  career: {
    totalYears: 6,
    gapMonths: 0,
    jobChanges: 2,
    lastTenureMonths: 18,
  },
  jd:
    "주요업무: 연간 사업계획/예산 수립, KPI 관리, 손익(P/L) 분석, 시장/경쟁사 리서치, 경영진 보고자료 작성\n" +
    "자격요건(필수): 제조업 또는 B2B 산업재 사업기획/전략기획 경력 5년+, Excel 고급(피벗/함수), 데이터 기반 의사결정, 유관부서 협업\n" +
    "우대사항: ERP/원가/공급망(SCM) 이해, 프로젝트 리딩 경험, 영어 커뮤니케이션",
  resume:
    "경력요약: B2B 제조업 유관 부서에서 기획/운영 6년. 연간 KPI 대시보드 운영 및 개선, 신규 프로젝트 기획 지원 경험 보유.\n" +
    "핵심경험: (1) 월간 KPI 리포트 자동화(Excel)로 보고 리드타임 단축. (2) 제품군별 판매 데이터 정리 및 인사이트 공유로 현업 의사결정 지원.\n" +
    "강점: 데이터 정리/분석 기반 커뮤니케이션, 유관부서 협업, 문서화/보고 역량.\n" +
    "보완: P/L 직접 운영 경험은 제한적이며, 제조 원가/SCM 도메인 경험은 일부 학습 수준.",
  portfolio:
    "성과물: KPI 리포트 템플릿(샘플), 회의록/보고서 목차 예시, 데이터 정리 방식 문서화",
  interviewNotes: "",
  selfCheck: {
    coreFit: 3,
    proofStrength: 3,
    roleClarity: 3,
    storyConsistency: 3,
    riskSignals: 3,
  },
};

function getPassmapTargetRoleKey(stateLike) {
  const safeState = stateLike && typeof stateLike === "object" ? stateLike : {};
  if (Object.prototype.hasOwnProperty.call(safeState, "roleTarget")) return "roleTarget";
  if (Object.prototype.hasOwnProperty.call(safeState, "targetRole")) return "targetRole";
  return "role";
}

function buildPassmapRoleTaxonomyContextFromItem(item) {
  if (!item || typeof item !== "object") return null;
  const majorOption = getJobTaxonomyOptionByMajorKey(item.majorCategory);
  const majorKey = String(majorOption?.key || item.majorCategory || "").trim();
  const majorLabel = String(majorOption?.label || item.majorCategory || "").trim();
  const subKey = String(item.subcategory || "").trim();
  const subLabel = String(item.label || item.subcategory || "").trim();
  if (!majorKey || !majorLabel || !subKey || !subLabel) return null;

  return {
    majorKey,
    majorLabel,
    subKey,
    subLabel,
    jobId: String(item.id || "").trim(),
    resolved: item,
  };
}

function getPassmapCurrentCareerRoleContext(stateLike) {
  const safeState = stateLike && typeof stateLike === "object" ? stateLike : {};
  const taxonomy = safeState?.roleTargetTaxonomy;
  if (taxonomy && typeof taxonomy === "object") {
    const majorKey = String(taxonomy.majorKey || "").trim();
    const majorLabel = String(taxonomy.majorLabel || "").trim();
    const subKey = String(taxonomy.subKey || "").trim();
    const subLabel = String(taxonomy.subLabel || "").trim();
    if (majorKey && majorLabel && subKey && subLabel) {
      const resolved =
        getJobOntologyItemByMajorSubcategory(majorKey, subKey) ||
        getJobOntologyItemByMajorSubcategory(majorLabel, subKey);
      return {
        majorKey,
        majorLabel,
        subKey,
        subLabel,
        jobId: String(taxonomy.jobId || resolved?.id || "").trim(),
        resolved: resolved || null,
      };
    }
  }

  if (safeState?.roleTargetResolved && typeof safeState.roleTargetResolved === "object") {
    const resolvedContext = buildPassmapRoleTaxonomyContextFromItem(safeState.roleTargetResolved);
    if (resolvedContext) return resolvedContext;
  }

  const targetRoleKey = getPassmapTargetRoleKey(safeState);
  const candidate = String(
    safeState?.[targetRoleKey] ||
      safeState?.roleTarget ||
      safeState?.targetRole ||
      safeState?.role ||
      ""
  ).trim();
  const legacyPath = resolveLegacyJobKeyToTaxonomyPath(candidate);
  if (legacyPath) {
    const resolved = getJobOntologyItemByMajorSubcategory(
      legacyPath.majorCategory,
      legacyPath.subcategory
    );
    const legacyContext = buildPassmapRoleTaxonomyContextFromItem(resolved);
    if (legacyContext) return legacyContext;
  }

  return {
    majorKey: "",
    majorLabel: "",
    subKey: "",
    subLabel: "",
    jobId: "",
    resolved: null,
  };
}

function getPassmapCurrentCareerRoleLabel(roleContextLike) {
  const safeContext =
    roleContextLike && typeof roleContextLike === "object" ? roleContextLike : {};
  const majorLabel = String(safeContext.majorLabel || "").trim();
  const subLabel = String(safeContext.subLabel || "").trim();
  if (majorLabel && subLabel) return `${majorLabel} > ${subLabel}`;
  if (subLabel) return subLabel;
  if (majorLabel) return majorLabel;
  return "미선택";
}

// ------------------------------
// Sections (HOISTED OUTSIDE App) - IME 안정화(리마운트 방지)
// ------------------------------
function BasicInfoSection({
  state,
  setTab,
  getImeValue,
  imeOnChange,
  imeOnCompositionStart,
  imeOnCompositionEnd,
  imeCommit,
  set,
  companySizeCandidateValue,
  companySizeTargetValue,
  normalizeCompanySizeValue,
  __parsedJD,
  __parsedResume,
  __setParsedJD,
  __setParsedResume,
}) {
  // ✅ append-only: 간단/상세 토글(로컬 UI 상태, state shape 변경 없음)
  const [__basicMode, __setBasicMode] = React.useState("simple"); // "simple" | "detail"
  // ✅ append-only: 상세 모드 섹션 접기/펼치기
  const __hasCompanySignals = !!(
    String(state?.companyTarget || "").trim() ||
    String(state?.companyCurrent || "").trim() ||
    String(companySizeCandidateValue || "").trim() ||
    String(companySizeTargetValue || "").trim() ||
    String(state?.stage || "").trim()
  );

  const __hasCompSignals = !!(
    String(state?.age || "").trim() ||
    String(state?.salaryCurrent || "").trim() ||
    String(state?.salaryTarget || state?.salaryExpected || "").trim() ||
    String(state?.levelCurrent || "").trim() ||
    String(state?.levelTarget || "").trim()
  );
  const __isNewbie = (() => {
    const lv = [
      String(state?.careerLevel || ""),
      String(state?.levelCurrent || ""),
      String(state?.levelTarget || ""),
    ]
      .join(" ")
      .trim();

    // 텍스트 기반(가장 안전한 1차)
    if (/(^|\s)(신입|인턴|주니어)(\s|$)/i.test(lv)) return true;

    // 숫자 기반(있는 경우만)
    const yRaw =
      state?.yearsOfExperience ??
      state?.yearsExperience ??
      state?.years ??
      state?.expYears ??
      0;

    const y = Number(String(yRaw || "").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(y) && y === 0) return true;

    return false;
  })();
  const [__openCompany, __setOpenCompany] = React.useState(__hasCompanySignals);
  const [__openComp, __setOpenComp] = React.useState(__hasCompSignals);

  React.useEffect(() => {
    if (__basicMode !== "detail") return;
    if (__hasCompanySignals) __setOpenCompany(true);
    if (__hasCompSignals) __setOpenComp(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [__basicMode, __hasCompanySignals, __hasCompSignals]);

  function __labelSize(v) {
    const s = String(v || "").trim();
    if (!s || s === "unknown") return "모름";
    return s;
  }

  function __companySummary() {
    const cur = String(state?.companyCurrent || "").trim();
    const targ = String(state?.companyTarget || "").trim();
    const cSize = __labelSize(companySizeCandidateValue);
    const tSize = __labelSize(companySizeTargetValue);
    const stage = String(state?.stage || "").trim();

    const parts = [];
    if (cur || targ) parts.push(`${cur || "현재회사"} → ${targ || "지원회사"}`);
    if (cSize || tSize) parts.push(`규모: ${cSize} → ${tSize}`);
    if (stage) parts.push(`단계: ${stage}`);
    return parts.length ? parts.join(" / ") : "회사/규모/단계 입력(선택)";
  }

  function __compSummary() {
    const age = String(state?.age || "").trim();
    const salCur = String(state?.salaryCurrent || "").trim();
    const salT = String(state?.salaryTarget || state?.salaryExpected || "").trim();
    const lvCur = String(state?.levelCurrent || "").trim();
    const lvT = String(state?.levelTarget || "").trim();

    const parts = [];
    if (age) parts.push(`나이: ${age}`);
    if (salCur || salT) parts.push(`연봉: ${salCur || "—"} → ${salT || "—"}`);
    if (lvCur || lvT) parts.push(`레벨: ${lvCur || "—"} → ${lvT || "—"}`);
    return parts.length ? parts.join(" / ") : "연봉/직급/나이 입력(선택)";
  }

  // ✅ append-only: 기존 키 우선 재사용(없으면 target은 role 키로 fallback, currentRole은 표시만)
  const __targetRoleKey = getPassmapTargetRoleKey(state); // 기존 입력이 이미 role을 사용 중

  // ✅ 결정적 패치: null 금지, 항상 문자열 key 보장
  const __currentRoleKey =
    Object.prototype.hasOwnProperty.call(state || {}, "roleCurrent")
      ? "roleCurrent"
      : "currentRole";

  const __industryCurrentKey =
    Object.prototype.hasOwnProperty.call(state || {}, "industryCurrent")
      ? "industryCurrent"
      : Object.prototype.hasOwnProperty.call(state || {}, "currentIndustry")
        ? "currentIndustry"
        : "industryCurrent"; // ✅ current는 반드시 채워야 하므로 industryCurrent로 고정(기존 후보에 포함)

  const __industryTargetKey =
    Object.prototype.hasOwnProperty.call(state || {}, "industryTarget")
      ? "industryTarget"
      : Object.prototype.hasOwnProperty.call(state || {}, "targetIndustry")
        ? "targetIndustry"
        : "industryTarget";

  // ✅ append-only: 산업 옵션(코드값 저장, 한글 라벨 표시)
  const __INDUSTRY_OPTIONS = [
    { v: "unknown", t: "모름/기타" },
    { v: "tech", t: "IT/테크/SaaS" },
    { v: "finance", t: "금융" },
    { v: "commerce", t: "커머스/리테일" },
    { v: "manufacturing", t: "제조/산업" },
    { v: "healthcare", t: "헬스케어/바이오" },
    { v: "public", t: "공공/교육" },
    { v: "media", t: "미디어/콘텐츠/게임" },
    { v: "hr", t: "HR/컨설팅" },
  ];

  // ✅ append-only: KSCO(간이) 대분류 + 사무(ksco_3) 세부
  const __KSCO_MAJOR_OPTIONS = [
    { v: "unknown", t: "모름/기타" },
    { v: "ksco_2", t: "전문가 및 관련 종사자 (IT 개발, 기획, 연구, 의료, 교육 전문직)" },
    { v: "ksco_3", t: "사무 종사자 (일반 사무, 행정, 회계, 인사, 경영 지원)" },
    { v: "ksco_5", t: "판매영업 (보험영업, 매장 관리, 온/오프라인 판매)" },
    { v: "ksco_8", t: "장치·기계 조작 및 조립 (공장 생산, 기계 운전, 조립, 운전원)" },
  ];
  const __kscoMajorSubLabels = {
    unknown: "직무가 애매하면 먼저 선택",
    ksco_2: "개발 / 데이터 / 엔지니어 / 연구 / 전략기획",
    ksco_3: "회계 / 인사 / 총무 / 영업관리 / 운영관리",
    ksco_5: "세일즈 / 영업 / 고객 유치",
    ksco_8: "생산 / 설비 / 공정 / 기계조작",
  };

  const __KSCO_OFFICE_SUB_OPTIONS = [
    { v: "office_general", t: "일반 사무" },
    { v: "office_admin", t: "행정" },
    { v: "office_accounting", t: "회계" },
    { v: "office_hr", t: "인사" },
    { v: "office_bizsupport", t: "경영 지원" },
    { v: "office_finance", t: "재무" },
    { v: "office_planning", t: "기획" },
    { v: "office_opsSupport", t: "운영 지원" },
    { v: "office_sales", t: "영업(국내/해외/기술)" },
    { v: "office_marketing", t: "마케팅" },
    { v: "office_procurement", t: "구매/조달" },
  ];

  const __kscoMajorKey = "roleKscoMajor";
  const __kscoOfficeSubKey = "roleKscoOfficeSub";
  const [__showKscoGuide, __setShowKscoGuide] = React.useState(false);

  function __setKscoMajor(v) {
    set(__kscoMajorKey, v);

    // ksco_3(사무)가 아니면 세부는 비움
    if (v !== "ksco_3") set(__kscoOfficeSubKey, "");

    // ✅ KSCO → 기존 role 힌트(보수적 매핑, 확장 여지 남김)
    // - 지금은 확실한 2개만 연결
    // - 나중에 ksco_2/ksco_3/사무중분류까지 확장 시, 여기 테이블만 키우면 됨
    try {
      const __KSCO_TO_ROLE_FAMILY = {
        ksco_5: "sales",        // 판매 종사자 → 영업/세일즈 계열
        ksco_8: "engineering",  // 장치·기계 조작/조립 → 엔지니어링/생산 계열(룰 엔진에서 engineering로 묶이게)
      };

      const mapped = __KSCO_TO_ROLE_FAMILY[String(v || "").trim()] || "";

      // 기존 role이 비어있거나, KSCO 매핑이 확실한 경우에만 role을 채움
      // (다른 ksco_2/ksco_3는 애매해서 role에 자동 반영하지 않음)
      if (mapped) {
        set("role", mapped);
      }
    } catch { }
  }

  const __renderKscoGuide = () => {
    const __selectedMajor = String(state?.[__kscoMajorKey] || "unknown");
    const __isUnknownMajor =
      __selectedMajor === "unknown" ||
      __selectedMajor === "" ||
      __selectedMajor === "모름/기타";
    const __exampleText =
      __isUnknownMajor
        ? "예: 회사마다 직무명이 달라 공식 분류와 다르게 보일 수 있습니다."
        : __selectedMajor === "ksco_3"
          ? "예: 회계 사무, 인사 사무, 경영 지원"
          : __selectedMajor === "ksco_5"
            ? "예: 영업, 세일즈, 고객 발굴"
            : __selectedMajor === "ksco_8"
              ? "예: 설비 운영, 기계 조작, 생산 관리"
              : "예: 개발자, 데이터 분석가, PM";

    return (
      <div className="mt-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
        <div className="text-xs text-slate-600">
          회사 직무명과 공식 분류가 다르게 보일 수 있어요.
        </div>
        <button
          type="button"
          className="mt-2 inline-flex items-center text-xs font-medium text-slate-700 underline underline-offset-2 hover:text-slate-900"
          onClick={() => __setShowKscoGuide((v) => !v)}
        >
          {__showKscoGuide ? "분류 기준 닫기" : "분류 기준 보기"}
        </button>
        {__showKscoGuide ? (
          <div className="mt-2 space-y-1 text-xs text-slate-600 leading-relaxed">
            <div>개발자처럼 현업 표현과 분류명이 다를 수 있습니다.</div>
            <div>분석은 선택한 KSCO 기준을 우선 사용합니다.</div>
            <div>{__exampleText}</div>
          </div>
        ) : null}
      </div>
    );
  };
  const __onExtractFile = (kind, text, meta) => {
    const k = String(kind || "").toLowerCase();
    const v = String(text || "");
    const failed = meta?.ok === false || !!meta?.error || (!!meta?.message && !v.trim());

    if (failed) {
      try {
        if (typeof window !== "undefined") {
          window.__PASSMAP_RESUME_IMPORT_STATE__ = {
            status: "failure",
            kind: k,
            fileName: meta?.name || null,
            error: meta?.error || null,
            message: meta?.message || null,
            warnings: Array.isArray(meta?.warnings) ? meta.warnings : [],
            updatedAt: Date.now(),
          };
        }
      } catch { }
      return;
    }

    try {
      if (k === "jd") {
        imeCommit("jd", v);
      } else if (k === "resume") {
        imeCommit("resume", v);

        // ✅ PATCH (append-only): resume attachment flag sync
        // - 파일에서 추출된 텍스트가 "있으면" 첨부로 간주
        try {
          const __t = String(v || "").trim();
          __setResumeAttached(Boolean(__t));
        } catch { }
      }
      try {
        if (typeof window !== "undefined") {
          window.__PASSMAP_RESUME_IMPORT_STATE__ = {
            status: "success",
            kind: k,
            fileName: meta?.name || null,
            charCount: Number(meta?.charCount || v.length || 0),
            preview: v.slice(0, 240),
            updatedAt: Date.now(),
          };
        }
      } catch { }
    } catch (e) {
      // 안전 폴백: IME 커밋 경로가 실패하면 아무 것도 안 함(상태 깨짐 방지)
    }
  };
  // -------------------------------
  // P1: AI로 JD/이력서 핵심 필드 추출 + 정정 UI
  // -------------------------------
  const [__parseOpen, __setParseOpen] = React.useState(false);
  const [__parseLoading, __setParseLoading] = React.useState(false);
  const [__parseMeta, __setParseMeta] = React.useState(null);
  const resumeIoProfile = useMemo(() => {
    const parsed = (__parsedResume && typeof __parsedResume === "object") ? __parsedResume : null;
    if (!parsed) return null;
    const hasParsedData = Boolean(
      parsed.summary ||
      (Array.isArray(parsed.timeline) && parsed.timeline.length > 0) ||
      (Array.isArray(parsed.skills) && parsed.skills.length > 0) ||
      (Array.isArray(parsed.achievements) && parsed.achievements.length > 0) ||
      (Array.isArray(parsed.projects) && parsed.projects.length > 0)
    );
    if (!hasParsedData) return null;
    try {
      return buildResumeProfileFromParsedResume({
        parsedResume: parsed,
        rawText: state.resume,
        importMeta: __parseMeta,
        sourceLabel: "가져온 이력서",
      });
    } catch {
      return null;
    }
  }, [__parsedResume, state.resume, __parseMeta]);
  // ✅ P1.5 (append-only): hard mirror sync via effect (works even when panel closed)
  // - window.__PARSED_* 가 null로 남는 케이스(파싱 미실행/패널 미오픈/클로저 이슈)를 안정적으로 방지
  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.__PARSED_JD__ = (() => {
          try {
            const v = window.__SCHEMA_PARSE_VALID__ && typeof window.__SCHEMA_PARSE_VALID__ === "object"
              ? window.__SCHEMA_PARSE_VALID__
              : null;

            const blocked = !!(v && v.jd && v.jd.ok === false);
            const good = window.__PARSED_JD_GOOD__ && typeof window.__PARSED_JD_GOOD__ === "object"
              ? window.__PARSED_JD_GOOD__
              : null;

            if (blocked && good) return good;
            return (__parsedJD && typeof __parsedJD === "object") ? __parsedJD : null;
          } catch {
            return (__parsedJD && typeof __parsedJD === "object") ? __parsedJD : null;
          }
        })();

        window.__PARSED_RESUME__ = (() => {
          try {
            const v = window.__SCHEMA_PARSE_VALID__ && typeof window.__SCHEMA_PARSE_VALID__ === "object"
              ? window.__SCHEMA_PARSE_VALID__
              : null;

            const blocked = !!(v && v.resume && v.resume.ok === false);
            const good = window.__PARSED_RESUME_GOOD__ && typeof window.__PARSED_RESUME_GOOD__ === "object"
              ? window.__PARSED_RESUME_GOOD__
              : null;

            if (blocked && good) return good;
            return (__parsedResume && typeof __parsedResume === "object") ? __parsedResume : null;
          } catch {
            return (__parsedResume && typeof __parsedResume === "object") ? __parsedResume : null;
          }
        })();
      }
    } catch { }
  }, [__parsedJD, __parsedResume]);
  // ✅ AI 호출 래퍼 (문자/객체 응답 모두 수용)
  // - 서버/프록시가 어떤 형태로 주더라도 "문자열"로 normalize
  // ✅ P0 (append-only): schema parse fallback guard (worker template 방지)
  function __schemaAiLooksFallback(ai, kind) {
    try {
      if (!ai || typeof ai !== "object") return { ok: false, reason: "ai_not_object" };

      const summary = String(ai.summary || "");
      const fit = ai.fitExtract && typeof ai.fitExtract === "object" ? ai.fitExtract : {};
      const role = String(fit.role || "");
      const industry = String(fit.industry || "");

      // 1) summary 기반 (가장 강한 시그널)
      const badSummary =
        summary.includes("기본 안내") ||
        summary.includes("안정적으로 구성하지 못해") ||
        summary.includes("기본") && summary.includes("반환");

      // 2) fitExtract unknown 조합
      const unknownFit =
        (role.toLowerCase() === "unknown" || role === "") &&
        (industry.toLowerCase() === "unknown" || industry === "");

      // 3) mustHave/jdMustHave 안내문 패턴
      const arr =
        kind === "jd"
          ? (Array.isArray(ai.jdMustHave) ? ai.jdMustHave : [])
          : (Array.isArray(ai.resumeMustHave) ? ai.resumeMustHave : []);
      const joined = arr.map((v) => String(v || "")).join(" | ");

      const guidePattern =
        /포함하세요|작성하세요|넣으세요|기재하세요|Must\s*Have|Preferred|Requirements|자격요건|우대사항|mustHave\s*:|preferred\s*:/i;

      const looksGuide = guidePattern.test(joined);

      // 4) semanticMatches 비어있음은 단독으로는 약하지만, 위와 결합하면 강화
      const semanticEmpty =
        Array.isArray(ai.semanticMatches) && ai.semanticMatches.length === 0;

      // 판정 로직(보수적으로)
      // - summary가 bad면 거의 확정
      // - unknownFit + looksGuide 조합도 강함
      if (badSummary) return { ok: false, reason: "bad_summary" };
      if (unknownFit && looksGuide) return { ok: false, reason: "unknown_fit_and_guide" };
      if (unknownFit && looksGuide && semanticEmpty) return { ok: false, reason: "unknown_fit_guide_semantic_empty" };

      // 추가 안전: mustHave에 헤더 조각이 섞이면 무효
      if (/^\s*\[.*(Requirements|자격요건|우대사항).*?\]\s*$/i.test(joined)) {
        return { ok: false, reason: "header_noise" };
      }

      return { ok: true, reason: "ok" };
    } catch (e) {
      return { ok: false, reason: "exception_in_guard" };
    }
  }

  // ✅ P0 (append-only): schema parse validity mirror (debug)
  function __setSchemaParseValidity(kind, ok, reason, meta) {
    try {
      window.__SCHEMA_PARSE_VALID__ = window.__SCHEMA_PARSE_VALID__ || {};
      window.__SCHEMA_PARSE_VALID__[kind] = {
        ok: !!ok,
        reason: String(reason || ""),
        at: Date.now(),
        meta: meta || null,
      };
    } catch { }
  }

  function __pushSchemaParseWarning(kind, message, detail) {
    try {
      window.__SCHEMA_PARSE_WARNINGS__ = window.__SCHEMA_PARSE_WARNINGS__ || [];
      window.__SCHEMA_PARSE_WARNINGS__.push({
        kind,
        message,
        detail: detail || null,
        at: Date.now(),
      });
    } catch { }
  }
  // ✅ PATCH (append-only): schema parse fallback detector + validity mirror (global)
  // - 목적: 워커/AI가 템플릿/기본안내(fallback) 같은 "쓸모없는 JSON"을 반환할 때 감지
  // - 결과는 window.__SCHEMA_PARSE_VALID__ 에 { ok, reason, at } 형태로 기록
  function __schemaAiLooksFallback(ai, kind) {
    try {
      if (!ai || typeof ai !== "object") return { ok: false, reason: "ai_not_object" };

      const k = kind === "jd" ? "jd" : "resume";

      // 1) 대표 fallback 문구(당신 프로젝트에서 실제로 나온 케이스)
      const summary = typeof ai.summary === "string" ? ai.summary.trim() : "";
      const hasFallbackSummary =
        !!summary &&
        (summary.includes("기본 안내") ||
          summary.includes("안정적으로 구성하지 못해") ||
          summary.includes("기본") && summary.includes("반환"));

      // 2) 내용이 비어있는 parsed 형태 감지 (형식은 객체인데 실질 정보가 거의 없음)
      // - resume/jd 공통으로 "비어있음"을 보수적으로 잡되, 과탐을 줄이기 위해 몇 가지 신호를 같이 봄
      const arr = (v) => (Array.isArray(v) ? v : null);
      const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

      const skills = arr(ai.skills);
      const projects = arr(ai.projects);
      const achievements = arr(ai.achievements);
      const timeline = arr(ai.timeline);
      const mustHave = arr(ai.mustHave);
      const jdMustHave = arr(ai.jdMustHave);
      const advice = arr(ai.advice);

      const emptySignals =
        (!skills || skills.length === 0) &&
        (!projects || projects.length === 0) &&
        (!achievements || achievements.length === 0) &&
        (!timeline || timeline.length === 0);

      // 3) fallback 패턴(요약만 있고 나머지가 텅 비었거나, 안내 문구+advice만 있는 형태)
      const onlyAdviceStyle =
        hasFallbackSummary &&
        emptySignals &&
        ((advice && advice.length > 0) || (jdMustHave && jdMustHave.length > 0) || (mustHave && mustHave.length > 0));

      // 최종 판정
      if (onlyAdviceStyle) {
        return { ok: false, reason: `fallback_${k}_only_advice_style` };
      }
      if (hasFallbackSummary && emptySignals) {
        return { ok: false, reason: `fallback_${k}_summary_empty_payload` };
      }

      return { ok: true, reason: "ok" };
    } catch (e) {
      return { ok: false, reason: "detector_exception" };
    }
  }

  // ✅ PATCH (append-only): helper to write validity mirror safely
  function __setSchemaParseValid(kind, payload) {
    try {
      if (typeof window === "undefined") return;
      window.__SCHEMA_PARSE_VALID__ = window.__SCHEMA_PARSE_VALID__ || {};
      const k = kind === "jd" ? "jd" : "resume";
      window.__SCHEMA_PARSE_VALID__[k] = { ...payload, at: Date.now() };
    } catch { }
  }
  // ✅ P0 (append-only): schema source text ref (JD/Resume raw text)
  const __schemaSourceTextRef = React.useRef({ jd: "", resume: "" });
  const __callAiForParse = async ({ prompt, kind, rawText }) => {
    // App.jsx 내부에 이미 있는 fetchAiEnhance를 재사용 (추가 API/키 없음)

    // ✅ IMPORTANT: worker에는 "원문 텍스트(rawText)"를 보내야 한다.
    // - parseWithAI의 prompt는 템플릿(지시문)이므로, rawText가 있으면 무조건 rawText 우선.
    const __raw =
      (typeof rawText === "string" && rawText.trim())
        ? rawText
        : "";

    const __prompt =
      (typeof prompt === "string" && prompt.trim())
        ? prompt
        : "";

    // ✅ PATCH (append-only): mirror last schema request payload (debug)
    try {
      if (typeof window !== "undefined") {
        window.__LAST_SCHEMA_REQ__ = window.__LAST_SCHEMA_REQ__ || {};
        const __k = kind === "jd" ? "jd" : "resume";
        window.__LAST_SCHEMA_REQ__[__k] = {
          at: Date.now(),
          kind,
          rawLen: String(__raw || "").length,
          rawSample: String(__raw || "").slice(0, 160),
          promptLen: String(__prompt || "").length,
          promptSample: String(__prompt || "").slice(0, 160),
        };
      }
    } catch { }

    const res = await fetchAiSchemaParse({
      kind,
      text: String(__raw || ""),
    });
    // ✅ DEBUG MARKER (append-only)
    // fallback 판정 로직이 아예 실행 안 되는지 확인용
    try {
      if (typeof window !== "undefined") {
        window.__SCHEMA_PARSE_VALID__ = window.__SCHEMA_PARSE_VALID__ || {};
        window.__SCHEMA_PARSE_VALID__[kind] = {
          ok: true,
          reason: "worker_called_marker",
          at: Date.now(),
        };
      }
    } catch { }

    // ⚠️ 여기서 return res 하지 말고,
    // 아래의 기존 코드(로그/adapter/stringify/fallback 판정)가 계속 실행되게 유지해야 함.

    // ✅ P0 (append-only): mirror last schema raw response at the point we KNOW runs
    try {
      if (typeof window !== "undefined") {
        window.__SCHEMA_PARSE_VALID__ = window.__SCHEMA_PARSE_VALID__ || {};
        window.__LAST_SCHEMA_RAW__ = window.__LAST_SCHEMA_RAW__ || {};

        const __k = kind === "jd" ? "jd" : "resume";

        window.__SCHEMA_PARSE_VALID__[__k] = {
          ok: true,
          reason: "raw_res_received",
          at: Date.now(),
        };

        window.__LAST_SCHEMA_RAW__[__k] = res;
      }
    } catch { }
    try { window.__LAST_SCHEMA_RES__ = res; } catch { }
    if (typeof res === "string") return res;

    if (res && typeof res === "object") {
      // ✅ ADAPTER: worker returns { ok:true, ai:{...}, meta:{...} }
      // parseWithAI expecfts a JSON string matching its schema.
      const ai = res.ai && typeof res.ai === "object" ? res.ai : null;
      // ✅ PATCH (append-only): fallback 판단 + validity mirror (commit은 후단에서 막기 위한 단서 제공)
      let __schemaValid = { ok: true, reason: "ok" };
      try {
        if (ai) {
          __schemaValid = __schemaAiLooksFallback(ai, kind);
          __setSchemaParseValid(kind, __schemaValid);
        } else {
          __schemaValid = { ok: false, reason: "ai_null" };
          __setSchemaParseValid(kind, __schemaValid);
        }
      } catch {
        __schemaValid = { ok: false, reason: "valid_check_exception" };
        __setSchemaParseValid(kind, __schemaValid);
      }
      // ✅ P0 (append-only): detect worker fallback template BEFORE adapter stringify
      const __ai = ai;
      const __meta = (res && typeof res === "object") ? res.meta : null;

      const __chk = __schemaAiLooksFallback(__ai, kind);
      __setSchemaParseValidity(kind, __chk.ok, __chk.reason, __meta);
      // ✅ P0 (append-only): meta에 blocked 단서 주입 (후단/로그/디버그 소비용)
      // - 목표: fallback이면 meta.__schemaBlocked === true 로 남겨서 commit 스킵 판단에 재사용 가능
      // - res/meta를 덮어쓰기 형태로만 안전 주입
      try {
        const __blocked = !__chk.ok;
        const __m0 = (__meta && typeof __meta === "object") ? __meta : {};
        const __m1 = { ...__m0, __schemaValid: __chk, __schemaBlocked: __blocked };

        // worker 원본 객체(res)에도 meta 주입 (혹시 stringify가 res/meta를 사용하면 같이 따라가게)
        if (res && typeof res === "object") {
          res.meta = __m1;
        }

      } catch { }
      if (!__chk.ok) {
        __pushSchemaParseWarning(
          kind,
          "AI schema fallback/template 감지 → parsed 적용 스킵 예정",
          { reason: __chk.reason, meta: __meta, summary: String(__ai?.summary || "") }
        );
      }
      if (ai) {
        const k = kind === "jd" ? "jd" : "resume";

        // helper: array normalize
        const __arr = (x) => (Array.isArray(x) ? x : []);
        const __pickStr = (...xs) => {
          for (const v of xs) {
            if (typeof v === "string" && v.trim()) return v.trim();
          }
          return null;
        };
        const __pickList = (...xs) => {
          for (const v of xs) {
            if (Array.isArray(v) && v.length) return v;
          }
          return [];
        };
        const __objListToText = (list) =>
          __arr(list)
            .map((o) => (o && typeof o === "object" ? (o.text || o.item || o.name || o.label || "") : ""))
            .map((s) => String(s || "").trim())
            .filter(Boolean);

        if (k === "jd") {
          const mustHave = __pickList(ai.mustHave, ai.jdMustHave, ai.mustHaves);
          const preferred = __pickList(ai.preferred, ai.jdPreferred, ai.prefer);
          const coreTasks = __pickList(ai.coreTasks, ai.jdCoreTasks, ai.tasks);
          const tools = __pickList(ai.tools, ai.jdTools, ai.techStack);
          const constraints = __pickList(ai.constraints, ai.jdConstraints);
          const domainKeywords = __pickList(ai.domainKeywords, ai.keywords);

          const mustHave2 = mustHave.length ? mustHave : __objListToText(ai.mustHaveObjects);
          const preferred2 = preferred.length ? preferred : __objListToText(ai.preferredObjects);
          const coreTasks2 = coreTasks.length ? coreTasks : __objListToText(ai.coreTaskObjects);
          const tools2 = tools.length ? tools : __objListToText(ai.toolObjects);

          const keywordSynonymsKeys =
            ai.keywordSynonyms && typeof ai.keywordSynonyms === "object"
              ? Object.keys(ai.keywordSynonyms || {})
              : [];

          const out = {
            jobTitle: __pickStr(ai.jobTitle, ai.jdJobTitle, ai.title),
            mustHave: mustHave2,
            preferred: preferred2,
            coreTasks: coreTasks2,
            tools: tools2,
            constraints: __arr(constraints),
            domainKeywords: (domainKeywords.length ? domainKeywords : keywordSynonymsKeys).slice(0, 40),
          };
          // ✅ P0 (append-only): mirror schema parse validity + last text (inline, no helper dependency)
          let __txt = "";
          try { __txt = JSON.stringify(out); } catch { __txt = String(out); }

          try {
            window.__SCHEMA_PARSE_VALID__ = window.__SCHEMA_PARSE_VALID__ || {};
            if (__chk.ok) {
              window.__SCHEMA_PARSE_VALID__.jd = {
                ok: true,
                reason: "callAi_text_built",
                at: Date.now(),
              };
            }
            window.__LAST_SCHEMA_AI_TEXT__ = window.__LAST_SCHEMA_AI_TEXT__ || {};
            window.__LAST_SCHEMA_AI_TEXT__.jd = __txt;
          } catch { }
          try {
            return __txt;
          } catch {
            return String(out);
          }
        }

        // resume
        const out = {
          summary: __pickStr(ai.summary, ai.resumeSummary),
          timeline: __pickList(ai.timeline, ai.careerTimeline, ai.experienceTimeline),
          skills: __pickList(ai.skills, ai.resumeSkills),
          achievements: __pickList(ai.achievements, ai.resumeAchievements),
          projects: __pickList(ai.projects, ai.resumeProjects),
          // optional: if worker provides these, parseWithAI will ignore unknown fields safely
          education: __pickList(ai.education, ai.resumeEducation),
          certifications: __pickList(ai.certifications, ai.resumeCertifications),
        };
        // ✅ P0 (append-only): mirror schema parse validity + last text (inline, no helper dependency)
        let __txt = "";
        try { __txt = JSON.stringify(out); } catch { __txt = String(out); }

        try {
          window.__SCHEMA_PARSE_VALID__ = window.__SCHEMA_PARSE_VALID__ || {};
          if (__chk.ok) {
            window.__SCHEMA_PARSE_VALID__.resume = {
              ok: true,
              reason: "callAi_text_built",
              at: Date.now(),
            };
          }
          window.__LAST_SCHEMA_AI_TEXT__ = window.__LAST_SCHEMA_AI_TEXT__ || {};
          window.__LAST_SCHEMA_AI_TEXT__.resume = __txt;
        } catch { }
        try {
          return __txt;
        } catch {
          return String(out);
        }
      }

      // fallback: keep legacy fields
      if (typeof res.text === "string") return res.text;
      if (typeof res.content === "string") return res.content;
      if (typeof res.raw === "string") return res.raw;
      if (typeof res.output === "string") return res.output;

      try {
        return JSON.stringify(res);
      } catch {
        return String(res);
      }
    }

    return String(res ?? "");
  };

  const __runSchemaParse = async () => {
    // ✅ PATCH (safe): allow manual paste keys (jdText/resumeText/resumeRaw) as aliases
    // - 테스트 단계에서 "업로드 없이 붙여넣기"도 동일하게 파싱/분석되게 함
    const jdText =
      String(state?.jd ?? "").trim() ||
      String(state?.jdText ?? "").trim() ||
      String(state?.jdRaw ?? "").trim();

    const resumeText =
      String(state?.resume ?? "").trim() ||
      String(state?.resumeText ?? "").trim() ||
      String(state?.resumeRaw ?? "").trim();

    __setParseLoading(true);
    __setParseMeta(null);

    try {
      const out = { jd: null, resume: null, warnings: [] };
      // ✅ PATCH (append-only): shared fallback detector for JD/Resume commit guard
      const __isSchemaParsedFallbackShared = (kind, p) => {
        try {
          if (!p || typeof p !== "object") return true;

          const summary = String(p.summary ?? "").trim();
          const __hasFallbackPhrase =
            summary.includes("기본 안내") ||
            summary.includes("안정적으로 구성하지 못해") ||
            summary.includes("기본 응답") ||
            summary.includes("템플릿") ||
            summary.includes("다시 시도");

          // placeholder/깨짐 방지(??, TBD, N/A 등)
          const __hasPlaceholder =
            summary.includes("??") ||
            summary.toLowerCase().includes("tbd") ||
            summary.toLowerCase().includes("n/a") ||
            summary.toLowerCase().includes("unknown");

          let itemCount = 0;
          for (const k of Object.keys(p)) {
            const v = p[k];
            if (Array.isArray(v)) itemCount += v.length;
            else if (v && typeof v === "object") {
              try {
                const kk = Object.keys(v);
                if (kk.length) itemCount += 1;
              } catch { }
            } else if (typeof v === "string") {
              const s = v.trim();
              if (k !== "summary" && s.length >= 12) itemCount += 1;
            } else if (typeof v === "number" || typeof v === "boolean") {
              itemCount += 1;
            }
          }

          if (__hasFallbackPhrase || __hasPlaceholder) return true;

          // kind별 최소 payload 요구
          if (kind === "jd") return itemCount <= 0;
          if (kind === "resume") return itemCount <= 0;

          return itemCount <= 0;
        } catch {
          return true;
        }
      };
      if (jdText) {
        // ✅ PATCH (append-only): snapshot previous parsed JD before calling AI parse
        const __prevParsedJD = __parsedJD;
        const __prevWinJD =
          (typeof window !== "undefined" && typeof window.__PARSED_JD__ !== "undefined")
            ? window.__PARSED_JD__
            : undefined;
        const __isSchemaParsedFallback = (kind, p) => {
          try {
            if (!p || typeof p !== "object") return true;

            const summary = String(p.summary ?? "").trim();
            const __hasFallbackPhrase =
              summary.includes("기본 안내") ||
              summary.includes("안정적으로 구성하지 못해") ||
              summary.includes("기본 응답") ||
              summary.includes("템플릿") ||
              summary.includes("다시 시도");

            // 배열/객체 안에 실질 payload가 있는지(보수적으로) 탐색
            let itemCount = 0;
            for (const k of Object.keys(p)) {
              const v = p[k];
              if (Array.isArray(v)) itemCount += v.length;
              else if (v && typeof v === "object") {
                // 1-depth만 카운트 (과도한 비용 방지)
                try {
                  const kk = Object.keys(v);
                  if (kk.length) itemCount += 1;
                } catch { }
              } else if (typeof v === "string") {
                const s = v.trim();
                // summary 외 의미있는 문자열
                if (k !== "summary" && s.length >= 12) itemCount += 1;
              } else if (typeof v === "number" || typeof v === "boolean") {
                itemCount += 1;
              }
            }

            // kind별 보정(너무 공격적으로 막지 않기)
            if (kind === "jd") {
              // JD는 최소한 뭔가 배열 1개라도 채워지는 게 정상인 케이스가 많음
              // 템플릿 문구가 있거나, payload가 사실상 비었으면 fallback 취급
              if (__hasFallbackPhrase) return true;
              if (itemCount <= 0) return true;
              return false;
            }

            if (kind === "resume") {
              // resume도 템플릿 문구면 차단, 그 외엔 기존 __looksEmpty 로직이 주로 잡음
              if (__hasFallbackPhrase) return true;
              // payload가 사실상 비었으면 fallback
              if (itemCount <= 0) return true;
              return false;
            }

            // unknown kind
            if (__hasFallbackPhrase) return true;
            return itemCount <= 0;
          } catch {
            // 판정 실패 시 보수적으로 fallback 취급 (깨진 payload 커밋 방지)
            return true;
          }
        };
        const r = await parseWithAI({
          kind: "jd",
          text: jdText,
          callAi: (args) => __callAiForParse({ ...(args || {}), rawText: jdText }),
        });

        // ✅ P0 (append-only): apply guard — do NOT commit parsed when worker fallback detected
        const __vJD = (window.__SCHEMA_PARSE_VALID__ && window.__SCHEMA_PARSE_VALID__.jd)
          ? window.__SCHEMA_PARSE_VALID__.jd
          : null;

        if (__vJD && __vJD.ok === false) {
          // ✅ blocked/fallback: restore previous (and LAST GOOD if available)
          try { __setParsedJD(__prevParsedJD); } catch { }
          try {
            if (typeof window !== "undefined") {
              if (typeof __prevWinJD !== "undefined") window.__PARSED_JD__ = __prevWinJD;

              const __good = window.__PARSED_JD_GOOD__;
              if (__good && typeof __good === "object") {
                try { __setParsedJD(__good); } catch { }
                try { window.__PARSED_JD__ = __good; } catch { }
              }
            }
          } catch { }
        } else {
          const __p = r?.parsed || null;
          const __looksBad = __isSchemaParsedFallback("jd", __p);

          if (__looksBad) {
            // fallback/empty payload: keep previous (and LAST GOOD if available)
            try { __setParsedJD(__prevParsedJD); } catch { }
            try {
              if (typeof window !== "undefined") {
                if (typeof __prevWinJD !== "undefined") window.__PARSED_JD__ = __prevWinJD;

                const __good = window.__PARSED_JD_GOOD__;
                if (__good && typeof __good === "object") {
                  try { __setParsedJD(__good); } catch { }
                  try { window.__PARSED_JD__ = __good; } catch { }
                }
              }
            } catch { }
          } else {
            __setParsedJD(__p);

            // ✅ PATCH (append-only): mirror parsed JD for runAnalysis scope safety
            try {
              if (typeof window !== "undefined") window.__PARSED_JD__ = __p || null;
            } catch { }

            // ✅ PATCH (append-only): persist LAST GOOD JD parsed
            try {
              if (typeof window !== "undefined" && __p && typeof __p === "object") {
                window.__PARSED_JD_GOOD__ = __p;
              }
            } catch { }
          }
        }


        out.jd = r.meta;
        if (Array.isArray(r.meta?.warnings) && r.meta.warnings.length) out.warnings.push(...r.meta.warnings);
      } else {
        out.warnings.push("JD 텍스트가 비어 있어요");
      }

      if (resumeText) {
        // ✅ PATCH (append-only): snapshot previous parsed Resume before calling AI parse
        const __prevParsedResume = __parsedResume;
        const __prevWinResume =
          (typeof window !== "undefined" && typeof window.__PARSED_RESUME__ !== "undefined")
            ? window.__PARSED_RESUME__
            : undefined;

        const r = await parseWithAI({
          kind: "resume",
          text: resumeText,
          callAi: (args) => __callAiForParse({ ...(args || {}), rawText: resumeText }),
        });

        const __vR = (window.__SCHEMA_PARSE_VALID__ && window.__SCHEMA_PARSE_VALID__.resume)
          ? window.__SCHEMA_PARSE_VALID__.resume
          : null;

        if (__vR && __vR.ok === false) {
          // ✅ blocked/fallback: restore previous (and LAST GOOD if available)
          try { __setParsedResume(__prevParsedResume); } catch { }
          try {
            if (typeof window !== "undefined") {
              if (typeof __prevWinResume !== "undefined") window.__PARSED_RESUME__ = __prevWinResume;

              const __good = window.__PARSED_RESUME_GOOD__;
              if (__good && typeof __good === "object") {
                try { __setParsedResume(__good); } catch { }
                try { window.__PARSED_RESUME__ = __good; } catch { }
              }
            }
          } catch { }
        } else {
          // ✅ commit only when valid AND non-empty
          const __p = r?.parsed || null;
          const __looksEmpty =
            !__p ||
            __isSchemaParsedFallbackShared("resume", __p) ||
            (__p.summary == null &&
                Array.isArray(__p.timeline) && __p.timeline.length === 0 &&
                Array.isArray(__p.skills) && __p.skills.length === 0 &&
                Array.isArray(__p.achievements) && __p.achievements.length === 0 &&
                Array.isArray(__p.projects) && __p.projects.length === 0);

          if (__looksEmpty) {
            // empty payload: keep previous (and LAST GOOD if available)
            try { __setParsedResume(__prevParsedResume); } catch { }
            try {
              if (typeof window !== "undefined") {
                if (typeof __prevWinResume !== "undefined") window.__PARSED_RESUME__ = __prevWinResume;

                const __good = window.__PARSED_RESUME_GOOD__;
                if (__good && typeof __good === "object") {
                  try { __setParsedResume(__good); } catch { }
                  try { window.__PARSED_RESUME__ = __good; } catch { }
                }
              }
            } catch { }
          } else {
            __setParsedResume(__p);

            // ✅ PATCH (append-only): mirror parsed Resume for runAnalysis scope safety
            try { if (typeof window !== "undefined") window.__PARSED_RESUME__ = __p || null; } catch { }

            // ✅ PATCH (append-only): persist LAST GOOD Resume parsed
            try {
              if (typeof window !== "undefined" && __p && typeof __p === "object") {
                window.__PARSED_RESUME_GOOD__ = __p;
              }
            } catch { }
          }
        }

        out.resume = r.meta;
        if (Array.isArray(r.meta?.warnings) && r.meta.warnings.length) out.warnings.push(...r.meta.warnings);
      } else {
        out.warnings.push("이력서 텍스트가 비어 있어요");
      }
      // ✅ PATCH (append-only): JD↔Resume local fit → warnings 반영 (no analyzer touch)
      try {
        if (false && jdText && resumeText) {
          const __fit = buildJdResumeFit({ jdText, resumeText });

          // debug / later connection
          try { window.__JD_RESUME_FIT__ = __fit; } catch { }

          const __fitWarnings = Array.isArray(__fit?.warnings) ? __fit.warnings : [];
          if (__fitWarnings.length) {
            const __tagged = __fitWarnings.map((w) => `JD↔이력서 매칭: ${w}`);
            // out.warnings는 "문자열 배열"이므로 문자열로만 append
            const prev = Array.isArray(out.warnings) ? out.warnings : [];
            out.warnings = Array.from(new Set([...prev, ...__tagged].filter(Boolean)));
          }
        }
      } catch { }
      __setParseMeta(out);
      __setParseOpen(true);
    } catch (e) {
      __setParseMeta({ warnings: ["AI 필드 추출 중 오류가 발생했어요."], error: String(e?.message || e) });
      __setParseOpen(true);
    } finally {
      __setParseLoading(false);
    }
  };
  return (
    <Card className="bg-background/70 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg">기본 정보</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ✅ 간단/상세 토글 */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={__basicMode === "simple" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => __setBasicMode("simple")}
            >
              간단
            </Button>
            <Button
              type="button"
              variant={__basicMode === "detail" ? "default" : "outline"}
              className="rounded-full"
              onClick={() => __setBasicMode("detail")}
            >
              상세
            </Button>
          </div>
        </div>
        {/* ✅ 간단 모드: 산업/직무만 */}
        {__basicMode === "simple" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">현재 산업(선택)</div>
              <Select
                value={state?.[__industryCurrentKey] || "unknown"}
                onValueChange={(v) => set(__industryCurrentKey, v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {__INDUSTRY_OPTIONS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">지원 산업(선택)</div>
              <Select
                value={state?.[__industryTargetKey] || "unknown"}
                onValueChange={(v) => set(__industryTargetKey, v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {__INDUSTRY_OPTIONS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ✅ KSCO 기반 지원 직무 (간단 모드에서는 KSCO만 노출) */}
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium">지원 직무</div>
              <div className="text-xs text-slate-500">지원 직무를 선택하세요</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {__KSCO_MAJOR_OPTIONS.map((o) => {
                  const __active = String(state?.[__kscoMajorKey] || "unknown") === String(o.v);
                  return (
                    <button
                      key={`ksco_btn_simple_${o.v}`}
                      type="button"
                      onClick={() => __setKscoMajor(o.v)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${__active
                        ? "border-slate-900 bg-slate-900/5"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                    >
                      <div className="leading-tight">
                        <div>{o.t}</div>
                        <div className="mt-1 text-[11px] text-slate-500 leading-tight">
                          {__kscoMajorSubLabels[o.v] || ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <Select
                value={state?.[__kscoMajorKey] || "unknown"}
                onValueChange={(v) => __setKscoMajor(v)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {__KSCO_MAJOR_OPTIONS.map((o) => (
                    <SelectItem key={o.v} value={o.v}>
                      {o.t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {String(state?.[__kscoMajorKey] || "") === "ksco_3" ? (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">사무 중분류(선택)</div>
                  <Select
                    value={state?.[__kscoOfficeSubKey] || "office_general"}
                    onValueChange={(v) => set(__kscoOfficeSubKey, v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {__KSCO_OFFICE_SUB_OPTIONS.map((o) => (
                        <SelectItem key={o.v} value={o.v}>
                          {o.t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {__renderKscoGuide()}
            </div>

            <div className="mt-3 text-sm text-slate-500 md:col-span-2">
              더 정교한 분석을 원하시면 ‘상세’ 모드에서 JD·이력서를 함께 입력해보세요.
            </div>
          </div>
        ) : null}

        {/* ✅ 상세 모드: (1) 산업/직무 + (2) 접기 섹션 2개 */}
        {__basicMode === "detail" ? (
          <div className="space-y-4">
            {/* (필수) 산업/직무 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">현재 산업(선택)</div>
                <Select value={state?.[__industryCurrentKey] || "unknown"} onValueChange={(v) => set(__industryCurrentKey, v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {__INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">지원 산업(선택)</div>
                <Select value={state?.[__industryTargetKey] || "unknown"} onValueChange={(v) => set(__industryTargetKey, v)}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {__INDUSTRY_OPTIONS.map((o) => (
                      <SelectItem key={o.v} value={o.v}>
                        {o.t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                {/* ✅ append-only: KSCO(간이) 직무 분류 */}
                {/* ✅ KSCO 기반 지원 직무 (상세 모드에서도 KSCO만 노출) */}
                <div className="space-y-2 md:col-span-2">
                  <div className="text-sm font-medium">지원 직무</div>
                  <div className="text-xs text-slate-500">지원 직무를 선택하세요</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {__KSCO_MAJOR_OPTIONS.map((o) => {
                      const __active = String(state?.[__kscoMajorKey] || "unknown") === String(o.v);
                      return (
                        <button
                          key={`ksco_btn_detail_${o.v}`}
                          type="button"
                          onClick={() => __setKscoMajor(o.v)}
                          className={`rounded-xl border px-3 py-2 text-left transition-colors ${__active
                            ? "border-slate-900 bg-slate-900/5"
                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                            }`}
                        >
                          <div className="leading-tight">
                            <div>{o.t}</div>
                            <div className="mt-1 text-[11px] text-slate-500 leading-tight">
                              {__kscoMajorSubLabels[o.v] || ""}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <Select
                    value={state?.[__kscoMajorKey] || "unknown"}
                    onValueChange={(v) => __setKscoMajor(v)}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {__KSCO_MAJOR_OPTIONS.map((o) => (
                        <SelectItem key={o.v} value={o.v}>
                          {o.t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {String(state?.[__kscoMajorKey] || "") === "ksco_3" ? (
                    <div className="mt-2">
                      <div className="text-xs text-slate-500 mb-1">사무 중분류(선택)</div>
                      <Select
                        value={state?.[__kscoOfficeSubKey] || "office_general"}
                        onValueChange={(v) => set(__kscoOfficeSubKey, v)}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {__KSCO_OFFICE_SUB_OPTIONS.map((o) => (
                            <SelectItem key={o.v} value={o.v}>
                              {o.t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {__renderKscoGuide()}
                </div>
              </div>

            </div>

            {/* (접기) 회사/규모/단계 */}
            <Card className="rounded-2xl border bg-background/70 backdrop-blur">
              <CardHeader className="pb-3">
                <button
                  type="button"
                  onClick={() => __setOpenCompany((v) => !v)}
                  className="w-full flex items-start justify-between gap-3 text-left"
                >
                  <div className="space-y-1">
                    <CardTitle className="text-base">회사/규모/단계</CardTitle>
                    <div className="text-xs text-muted-foreground">{__companySummary()}</div>
                  </div>
                  <ChevronDown className={"h-5 w-5 text-muted-foreground transition " + (__openCompany ? "rotate-180" : "")} />
                </button>
              </CardHeader>

              {__openCompany ? (
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">지원 회사(채용 회사)</div>
                      <Input
                        value={getImeValue("companyTarget", state.companyTarget)}
                        onChange={(e) => imeOnChange("companyTarget", e.target.value)}
                        onCompositionStart={() => imeOnCompositionStart("companyTarget")}
                        onCompositionEnd={() => imeOnCompositionEnd("companyTarget")}
                        onBlur={(e) => imeCommit("companyTarget", e.currentTarget.value)}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">현재 회사</div>
                      <Input
                        value={getImeValue("companyCurrent", state.companyCurrent)}
                        onChange={(e) => imeOnChange("companyCurrent", e.target.value)}
                        onCompositionStart={() => imeOnCompositionStart("companyCurrent")}
                        onCompositionEnd={() => imeOnCompositionEnd("companyCurrent")}
                        onBlur={(e) => imeCommit("companyCurrent", e.currentTarget.value)}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">이번 지원 탈락 단계</div>
                      <Select value={state.stage} onValueChange={(v) => set("stage", v)}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {["서류", "1차 면접", "1차+2차 면접", "최종 면접", "오퍼 직전/협상", "기타"].map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">내 회사 규모 (선택)</div>
                      <Select value={companySizeCandidateValue} onValueChange={(v) => set("companySizeCandidate", normalizeCompanySizeValue(v))}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="스타트업">스타트업</SelectItem>
                          <SelectItem value="중소/강소기업">중소/강소기업</SelectItem>
                          <SelectItem value="중견기업">중견기업</SelectItem>
                          <SelectItem value="대기업">대기업</SelectItem>
                          <SelectItem value="unknown">모름</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <div className="text-sm font-medium">지원 회사 규모 (선택)</div>
                      <Select value={companySizeTargetValue} onValueChange={(v) => set("companySizeTarget", normalizeCompanySizeValue(v))}>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="스타트업">스타트업</SelectItem>
                          <SelectItem value="중소/강소기업">중소/강소기업</SelectItem>
                          <SelectItem value="중견기업">중견기업</SelectItem>
                          <SelectItem value="대기업">대기업</SelectItem>
                          <SelectItem value="unknown">모름</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>

            {/* (접기) 연봉/직급/나이 */}
            <Card className="rounded-2xl border bg-background/70 backdrop-blur">
              <CardHeader className="pb-3">
                <button
                  type="button"
                  onClick={() => __setOpenComp((v) => !v)}
                  className="w-full flex items-start justify-between gap-3 text-left"
                >
                  <div className="space-y-1">
                    <CardTitle className="text-base">연봉/직급/나이</CardTitle>
                    <div className="text-xs text-muted-foreground">{__compSummary()}</div>
                  </div>
                  <ChevronDown className={"h-5 w-5 text-muted-foreground transition " + (__openComp ? "rotate-180" : "")} />
                </button>
              </CardHeader>

              {__openComp ? (
                <CardContent className="pt-0 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium">나이</div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={state?.age ?? ""}
                        onChange={(e) => set("age", e.target.value)}
                        placeholder="예: 30"
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">현재 연봉(만원)</div>
                      <Input
                        inputMode="numeric"
                        placeholder="예: 4500"
                        value={getImeValue("salaryCurrent", state.salaryCurrent)}
                        onChange={(e) => imeOnChange("salaryCurrent", e.target.value)}
                        onCompositionStart={() => imeOnCompositionStart("salaryCurrent")}
                        onCompositionEnd={() => imeOnCompositionEnd("salaryCurrent")}
                        onBlur={(e) => imeCommit("salaryCurrent", e.currentTarget.value)}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">목표 연봉(만원)</div>
                      <Input
                        inputMode="numeric"
                        placeholder="예: 6000"
                        value={getImeValue("salaryTarget", state.salaryTarget)}
                        onChange={(e) => imeOnChange("salaryTarget", e.target.value)}
                        onCompositionStart={() => imeOnCompositionStart("salaryTarget")}
                        onCompositionEnd={() => imeOnCompositionEnd("salaryTarget")}
                        onBlur={(e) => imeCommit("salaryTarget", e.currentTarget.value)}
                        className="rounded-xl"
                      />

                      {__isNewbie && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          신입 지원자는 연봉 입력 없이 진행 가능합니다.
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">현재 직급/레벨</div>
                      <Input
                        placeholder="예: 대리 / L3"
                        value={getImeValue("levelCurrent", state.levelCurrent)}
                        onChange={(e) => imeOnChange("levelCurrent", e.target.value)}
                        onCompositionStart={() => imeOnCompositionStart("levelCurrent")}
                        onCompositionEnd={() => imeOnCompositionEnd("levelCurrent")}
                        onBlur={(e) => imeCommit("levelCurrent", e.currentTarget.value)}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">목표 직급/레벨</div>
                      <Input
                        placeholder="예: 과장 / L4"
                        value={getImeValue("levelTarget", state.levelTarget)}
                        onChange={(e) => imeOnChange("levelTarget", e.target.value)}
                        onCompositionStart={() => imeOnCompositionStart("levelTarget")}
                        onCompositionEnd={() => imeOnCompositionEnd("levelTarget")}
                        onBlur={(e) => imeCommit("levelTarget", e.currentTarget.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              ) : null}
            </Card>
          </div>
        ) : null}
        <UploadPanel onExtract={__onExtractFile} />
        <ResumeIoStudioPanel
          profile={resumeIoProfile}
          parsedResume={resumeIoProfile ? __parsedResume : null}
          rawResumeText={state.resume}
          importMeta={__parseMeta}
          onRequestParse={__runSchemaParse}
          parseLoading={__parseLoading}
          parseDisabled={!String(state.resume || "").trim()}
        />

        {__parseOpen ? (
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4">
            {Array.isArray(__parseMeta?.warnings) && __parseMeta.warnings.length ? (
              <div className="mb-3 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[11px] text-amber-900/80">
                <div className="font-semibold">주의</div>
                <ul className="mt-1 list-disc pl-4">
                  {__parseMeta.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {__parseMeta?.error ? (
                  <div className="mt-1 text-amber-900/70">error: {String(__parseMeta.error)}</div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4">
              <ParsedFieldsPanel
                kind="jd"
                parsed={__parsedJD}
                onChange={(next) => {
                  __setParsedJD(next);
                  try { if (typeof window !== "undefined") window.__PARSED_JD__ = next || null; } catch { }
                  try { if (typeof window !== "undefined") window.__PARSED_JD_GOOD__ = next || null; } catch { }
                }}
              />
              <ParsedFieldsPanel
                kind="resume"
                parsed={__parsedResume}
                onChange={(next) => {
                  __setParsedResume(next);
                  try { if (typeof window !== "undefined") window.__PARSED_RESUME__ = next || null; } catch { }
                  try { if (typeof window !== "undefined") window.__PARSED_RESUME_GOOD__ = next || null; } catch { }
                }}
              />
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => __setParseOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        ) : null}
        {/* (공통) JD/이력서 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">JD(채용공고) 핵심 문장</div>
              <Badge variant="outline" className="text-xs">
                가능하면 그대로
              </Badge>
            </div>
            <Textarea
              value={getImeValue("jd", state.jd)}
              onChange={(e) => imeOnChange("jd", e.target.value)}
              onCompositionStart={() => imeOnCompositionStart("jd")}
              onCompositionEnd={(e) => imeCommit("jd", e.currentTarget.value)}
              onBlur={(e) => imeCommit("jd", e.currentTarget.value)}
              rows={14}
              className="min-h-[280px] resize-y"
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">이력서 핵심 문장(지원용 요약/경험 일부)</div>

            <Textarea
              value={getImeValue("resume", state.resume)}
              onChange={(e) => imeOnChange("resume", e.target.value)}
              onCompositionStart={() => imeOnCompositionStart("resume")}
              onCompositionEnd={(e) => imeCommit("resume", e.currentTarget.value)}
              onBlur={(e) => imeCommit("resume", e.currentTarget.value)}
              placeholder="헤더/요약/대표 경험 2~3개 문장을 붙여 넣어 주세요"
              className="rounded-xl min-h-[360px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" className="rounded-full" disabled>
            <ChevronLeft className="h-4 w-4 mr-2" />
            이전
          </Button>
          <Button className="rounded-full" onClick={() => { setTab(SECTION.RESUME); maybeShowHiddenRiskTeaser("nav_resume"); }}>
            다음
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card >
  );
}





// career block guard — InputFlow으로 이동했으므로 RESUME 탭에서 숨김
const SHOW_RESUME_CAREER = false;

function DocSection({
  state,
  setTab,
  getImeValue,
  imeOnChange,
  imeOnCompositionStart,
  imeOnCompositionEnd,
  imeCommit,
  set,
  selfCheckMode,
  setSelfCheckMode,
}) {
  return (
    <Card className="bg-background/70 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg">서류</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* career inputs — InputFlow CareerQuestions로 이동. SHOW_RESUME_CAREER=false로 숨김 */}
        {SHOW_RESUME_CAREER && <Card className="rounded-2xl bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">경력 정보 (분석 핵심)</CardTitle>
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">지원 시점 기준</span>의 전체 커리어(공백/이직/근속)입니다
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">총 경력 연차 (년)</div>
              <div className="text-sm text-muted-foreground -mt-1">전체 커리어 누적(정규직/계약직 포함, 본인 기준으로 합산)</div>
              <Input
                type="number"
                min={0}
                max={60}
                value={state.career.totalYears}
                onChange={(e) => set("career.totalYears", Number(e.target.value || 0))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">최근 공백기 (개월)</div>
              <div className="text-sm text-muted-foreground -mt-1">최근 이직 전후에 생긴 공백(무직/준비 기간)을 월 기준으로 입력</div>
              <Input
                type="number"
                min={0}
                max={240}
                value={state.career.gapMonths}
                onChange={(e) => set("career.gapMonths", Number(e.target.value || 0))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">총 이직 횟수</div>
              <div className="text-sm text-muted-foreground -mt-1">회사 변경 횟수(동일 회사 내 부서 이동은 보통 제외)</div>
              <Input
                type="number"
                min={0}
                max={60}
                value={state.career.jobChanges}
                onChange={(e) => set("career.jobChanges", Number(e.target.value || 0))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">직전/현재 회사 근속 (개월)</div>
              <div className="text-sm text-muted-foreground -mt-1">
                지금 근무중이면 <span className="text-foreground font-medium">현재 회사</span>, 퇴사했으면{" "}
                <span className="text-foreground font-medium">가장 최근 회사</span> 기준
              </div>
              <Input
                type="number"
                min={0}
                max={600}
                value={state.career.lastTenureMonths}
                onChange={(e) => set("career.lastTenureMonths", Number(e.target.value || 0))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <div className="text-sm font-medium">지원서 제출일 (선택)</div>
              <div className="text-sm text-muted-foreground -mt-1">
                합불 통보일이 아니라, <span className="text-foreground font-medium">지원서 제출(또는 지원 완료) 날짜</span>를 의미합니다
              </div>
              <Input
                type="date"
                value={getImeValue("applyDate", state.applyDate || "")}
                onChange={(e) => imeOnChange("applyDate", e.target.value)}
                onCompositionStart={() => imeOnCompositionStart("applyDate")}
                onCompositionEnd={(e) => imeCommit("applyDate", e.currentTarget.value)}
                onBlur={(e) => imeCommit("applyDate", e.currentTarget.value)}
                className="rounded-xl"
              />
            </div>
          </CardContent>
        </Card>}

        <div className={"flex items-center justify-between"}>
          <Button variant="outline" className="rounded-full" onClick={() => setTab(SECTION.JOB)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            이전
          </Button>
          <Button
            className="rounded-full"
            onClick={() => {
              setTab(SECTION.INTERVIEW);
              maybeShowHiddenRiskTeaser("nav_interview");
            }}
          >
            다음
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function InterviewSection({
  state,
  setTab,
  getImeValue,
  imeOnChange,
  imeOnCompositionStart,
  imeCommit,
  imeOnCompositionEnd,
  set,
  selfCheckMode,
  canAnalyze,
  isAnalyzing,
  auth,
  openLoginGate,
  runAnalysis,
}) {
  return (
    <Card className="bg-background/70 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-lg">면접</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 먼저: 면접 질문/답변 메모 */}
        <div className="space-y-2">
          <div className="text-sm font-medium">면접 질문/답변 메모</div>
          <div className="text-xs text-muted-foreground -mt-1">
            기억나는 질문, 내가 한 답변의 핵심, 면접관 반응(표정/꼬리질문/딜레이) 등을 적어주세요
          </div>
          <Textarea
            value={getImeValue("interviewNotes", state.interviewNotes)}
            onChange={(e) => imeOnChange("interviewNotes", e.target.value)}
            onCompositionStart={() => imeOnCompositionStart("interviewNotes")}
            onCompositionEnd={(e) => imeCommit("interviewNotes", e.currentTarget.value)}
            onBlur={(e) => imeCommit("interviewNotes", e.currentTarget.value)}
            placeholder="기억나는 질문..."
            className="rounded-xl min-h-[260px]"
          />
        </div>

        {/* 다음: 자가진단(면접) */}
        <Card className="rounded-2xl bg-muted/30 border-dashed">
          <CardHeader className="pb-3 space-y-2">
            <CardTitle className="text-base">자가진단(면접) · 최소 항목</CardTitle>
            <div className="text-xs text-muted-foreground">
              면접관이 걸어볼 만한 리스크 신호를{" "}
              <span className="text-foreground font-medium">내 기준으로만</span> 빠르게 체크합니다.
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {(() => {
              const scIvAxes = state?.selfCheck?.interview?.axes || {};


              const IV_AXES = [
                {
                  key: "roleFit",
                  label: "직무적합성",
                  hint: "나는 직무 중심으로 답했는가?",
                  checks: [
                    { key: "c1", text: "직무 핵심 업무와 직접 연결되는 사례를 최소 1개 이상 말했다." },
                    { key: "c2", text: "실무 질문에 대해 실제 경험 사례로 답했다." },
                    { key: "c3", text: "“내가 무엇을 했는지”가 직무 기준으로 설명되었다." },
                  ],
                },
                {
                  key: "orgFit",
                  label: "기업·조직 적합성",
                  hint: "나는 왜 이 회사인지 설득했는가?",
                  checks: [
                    { key: "c1", text: "회사의 사업/제품/서비스를 구체적으로 언급했다." },
                    { key: "c2", text: "“왜 이 회사인가” 질문에 다른 회사와 구분되는 이유를 말했다." },
                    { key: "c3", text: "협업 방식이나 업무 태도에 대해 구체적 사례로 설명했다." },
                  ],
                },
                {
                  key: "structure",
                  label: "답변 구조·논리성",
                  hint: "질문에 정확히 답했는가?",
                  checks: [
                    { key: "c1", text: "질문에 대한 결론을 먼저 말하고 설명했다." },
                    { key: "c2", text: "질문과 다른 이야기로 벗어나지 않았다." },
                    { key: "c3", text: "하나의 질문에 2분 이상 장황하게 말하지 않았다." },
                  ],
                },
                {
                  key: "evidence",
                  label: "성과·경험의 구체성",
                  hint: "경험이 검증 가능한 형태였는가?",
                  checks: [
                    { key: "c1", text: "성과를 수치 또는 결과 중심으로 말했다." },
                    { key: "c2", text: "팀 성과와 내 기여를 구분해 설명했다." },
                    { key: "c3", text: "문제 해결 과정을 단계적으로 설명했다." },
                  ],
                },
                {
                  key: "delivery",
                  label: "전달력·태도·상호작용",
                  hint: "전달이 안정적이었는가?",
                  checks: [
                    { key: "c1", text: "답변 중 목소리 속도와 톤이 급격히 흔들리지 않았다." },
                    { key: "c2", text: "질문을 끝까지 듣고 답변했다." },
                    { key: "c3", text: "면접관의 반응에 맞춰 답변 길이를 조절했다." },
                  ],
                },
                {
                  key: "environment",
                  label: "면접 상황/경쟁 환경",
                  hint: "이번 결과에 외부 변수가 컸는가(참고용, 점수/가중치 반영 없음)",
                  checks: [
                    { key: "c1", text: "채용 인원이 매우 적은 상황이었다." },
                    { key: "c2", text: "나보다 직무 경험이 더 많은 지원자가 있었다." },
                    { key: "c3", text: "면접관의 평가 기준이 일관되지 않다고 느꼈다." },
                  ],
                },
              ];

              const IV_EXTERNAL = {
                key: "external",
                label: "면접 상황·경쟁 환경 요인",
                hint: "(※ 내부 역량과 분리 해석) 이번 결과에 외부 변수가 컸는가?",
                checks: [
                  { key: "c1", text: "채용 인원이 매우 적은 상황이었다." },
                  { key: "c2", text: "나보다 직무 경험이 더 많은 지원자가 있었다." },
                  { key: "c3", text: "면접관의 평가 기준이 일관되지 않다고 느꼈다." },
                ],
              };



              return (
                <>
                  <div className="space-y-4">
                    {IV_AXES.map((axis) => {
                      const v = scIvAxes?.[axis.key] ?? 3;

                      return (
                        <div key={axis.key} className="space-y-2">
                          <SliderRow
                            label={axis.label}
                            value={v}
                            onChange={(nv) => set(`selfCheck.interview.axes.${axis.key}`, nv)}
                            hint={axis.hint}
                            descriptions={[]}
                          />

                          <div className="rounded-xl border bg-background/60 p-3">
                            <div className="text-xs font-medium mb-2">아래 사항을 참고하세요
                            </div>
                            <div className="space-y-2">
                              {axis.checks.map((c) => {
                                return (
                                  <div key={c.key} className="flex items-start gap-2 rounded-lg px-2 py-2">
                                    <div className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                                    <div className="text-sm leading-snug">{c.text}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
            <RadarSelfCheck selfCheck={state.selfCheck} mode="interview" />
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="outline" className="rounded-full" onClick={() => setTab(SECTION.RESUME)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            이전
          </Button>
          <Button
            className="rounded-full"
            onClick={() => {
              requestAnalyzeOnce({ goResult: true, source: "interview_card" });
            }}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "분석 중..." : "분석하기"}
            <Sparkles className={"h-4 w-4 ml-2 " + (isAnalyzing ? "animate-spin" : "")} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Phase 12.7: ReportV2 exclusive activation readiness gate
// Pure, conservative — falls back to legacy SimulatorLayout path if any signal is missing
function __isReportV2Ready(vm) {
  if (!REPORT_UI_FLAGS?.showReportV2) return false;
  const r2 = vm?.reportV2;
  if (!r2 || typeof r2 !== "object") return false;
  // dev-only: allow ReportV2Container mount for section shell inspection even when core surfaces are unavailable
  if (!!(import.meta && import.meta.env && import.meta.env.DEV)) return true;
  // topRiskRead must be non-unavailable (has headline/posture renderable content)
  const trStatus = typeof r2.topRiskRead?.status === "string" ? r2.topRiskRead.status : "unavailable";
  if (trStatus === "unavailable") return false;
  // typeReadV2 must be non-unavailable (TypeReadV2 component renders null for unavailable)
  const tyStatus = typeof r2.typeReadV2?.status === "string" ? r2.typeReadV2.status : "unavailable";
  if (tyStatus === "unavailable") return false;
  // top3 must exist for Blocker 1 risk affordance
  if (!Array.isArray(vm.top3) || vm.top3.length === 0) return false;
  return true;
}

const TRANSITION_LITE_ANALYSIS_TYPE = "transition_lite";

function __buildTransitionLiteTransitionPair(payload) {
  const currentJobId = String(payload?.currentJobId || payload?.current_job_id || "").trim();
  const currentIndustryId = String(payload?.currentIndustryId || payload?.current_industry_id || "").trim();
  const targetJobId = String(payload?.targetJobId || payload?.target_job_id || "").trim();
  const targetIndustryId = String(payload?.targetIndustryId || payload?.target_industry_id || "").trim();
  if (!currentJobId || !currentIndustryId || !targetJobId || !targetIndustryId) return "";
  return `${currentJobId}__${currentIndustryId}__TO__${targetJobId}__${targetIndustryId}`;
}

async function __getAiAuthHeaders() {
  try {
    const sess = await getSession();
    const token = String(sess?.access_token || "").trim();
    if (token) return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  } catch { }
  return { "Content-Type": "application/json" };
}

async function runRejectionAnalysisAI({ jdText, resumeText, requestId, compositeRiskContext = null, structuredSummaryContext = null, groundingMode = 'raw', recruiterReadContext = null, targetRoleInPosting = null }) {
  if (!jdText || !resumeText) {
    return {
      ok: false,
      data: null,
      error: { code: 'MISSING_INPUT', message: 'jdText and resumeText are required' },
      meta: { ok: false, errorCode: 'MISSING_INPUT' },
    };
  }

  // ✅ PATCH (fix): reuse existing AI proxy base resolver chain
  // - Use same fallback sequence as fetchAiSchemaParse so it works with existing AI infrastructure
  // - Does NOT fallback to window.location.origin (GitHub Pages has no AI endpoints)
  const base = import.meta.env.VITE_PARSE_API_BASE || import.meta.env.VITE_AI_PROXY_URL || import.meta.env.VITE_API_BASE;
  if (!base) {
    return {
      ok: false,
      data: null,
      error: { code: 'NO_PROXY_URL', message: 'AI proxy URL not configured' },
      meta: { ok: false, errorCode: 'NO_PROXY_URL' },
    };
  }

  const __cacheKeyPayload = buildRejectionAiCacheKeyPayload({
    jdText,
    resumeText,
    targetRoleInPosting,
    groundingMode,
    compositeRiskContext,
  });
  if (__cacheKeyPayload) {
    const __cachedResult = readRejectionAiCache(__cacheKeyPayload);
    if (__cachedResult) {
      return {
        ...__cachedResult,
        meta: {
          ...(__cachedResult.meta || {}),
          cacheHit: true,
          cacheSource: 'client-localstorage',
        },
      };
    }
  }

  const t0 = Date.now();
  const req = {
    jdText,
    resumeText,
    requestId: requestId || `ai-${Date.now()}`,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 1800,
    ...(compositeRiskContext != null ? { compositeRiskContext, structuredSummaryContext, groundingMode } : {}),
    ...(recruiterReadContext != null ? { recruiterReadContext } : {}),
    ...(String(targetRoleInPosting || '').trim() ? { targetRoleInPosting: String(targetRoleInPosting).trim() } : {}),
  };

  const aiHeaders = await __getAiAuthHeaders();

  try {
    const url = base.replace(/\/$/, '') + '/api/rejection-analysis-ai';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(url, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return {
        ok: false,
        data: null,
        error: { code: 'API_ERROR', message: `API returned ${response.status}` },
        meta: { ok: false, errorCode: 'API_ERROR', ms: Date.now() - t0 },
      };
    }

    const result = await response.json();
    const __normalizedResult = {
      ...result,
      meta: {
        ...result.meta,
        ok: Boolean(result.ok),
        errorCode: result.ok ? undefined : (result.error?.code || 'UNKNOWN_ERROR'),
      },
    };
    if (__cacheKeyPayload) {
      writeRejectionAiCache(__cacheKeyPayload, __normalizedResult);
    }
    return __normalizedResult;
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        ok: false,
        data: null,
        error: { code: 'TIMEOUT', message: 'AI request timed out after 60 seconds' },
        meta: { ok: false, errorCode: 'TIMEOUT', ms: Date.now() - t0 },
      };
    }

    return {
      ok: false,
      data: null,
      error: { code: 'FETCH_FAILED', message: error.message || 'Network request failed' },
      meta: { ok: false, errorCode: 'FETCH_FAILED', ms: Date.now() - t0 },
    };
  }
}

// ✅ PATCH (append-only, P1-A): Resume career interpreter — fire-and-forget, returns null on failure
// - Does NOT compare against JD; pure resume structuring only
// - 10s timeout; result stored in preciseAnalysis.resumeCareerInterpretation via setAnalysis
async function runResumeCareerInterpreterAI({ resumeText, parsedResume = null, targetRole = null }) {
  if (!resumeText) return null;

  const base = import.meta.env.VITE_PARSE_API_BASE || import.meta.env.VITE_AI_PROXY_URL || import.meta.env.VITE_API_BASE;
  if (!base) return null;

  const t0 = Date.now();
  const aiHeaders = await __getAiAuthHeaders();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const url = base.replace(/\/$/, '') + '/api/p1-analysis';
    const res = await fetch(url, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify({
        action: 'career',
        resumeText,
        parsedResume,
        targetRole,
        requestId: `career-${Date.now()}`,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.ok || !json?.data) return null;
    return json.data;
  } catch (err) {
    console.warn('[CAREER-AI] fetch error:', err?.message, 'ms:', Date.now() - t0);
    return null;
  }
}

// ✅ PATCH (append-only, P1-C): Role-fit career matcher helper
// - Calls /api/role-fit-career-matcher; returns full envelope { ok, data, error, meta }
// - Requires P1-A resumeCareerInterpretation and P1-B jdRequirementDecomposition as inputs
// - 90s timeout; result stored in preciseAnalysis.roleFitCareerMatch via useEffect+setAnalysis
async function runRoleFitCareerMatcherAI({ resumeCareerInterpretation, jdRequirementDecomposition, targetRole, targetRoleMajorCategory, targetRoleSubcategory, requestId }) {
  if (!resumeCareerInterpretation || !jdRequirementDecomposition || !targetRole) {
    return { ok: false, data: null, error: { code: 'MISSING_INPUT', message: 'resumeCareerInterpretation, jdRequirementDecomposition, and targetRole are required' }, meta: { ok: false, errorCode: 'MISSING_INPUT' } };
  }

  const base = import.meta.env.VITE_PARSE_API_BASE || import.meta.env.VITE_AI_PROXY_URL || import.meta.env.VITE_API_BASE;
  if (!base) {
    return { ok: false, data: null, error: { code: 'NO_PROXY_URL', message: 'AI proxy base URL not configured' }, meta: { ok: false, errorCode: 'NO_PROXY_URL' } };
  }

  const t0 = Date.now();
  const reqBody = {
    action: 'rolefit',
    resumeCareerInterpretation,
    jdRequirementDecomposition,
    targetRole,
    targetRoleMajorCategory: targetRoleMajorCategory || null,
    targetRoleSubcategory: targetRoleSubcategory || null,
    requestId: requestId || `role-fit-${Date.now()}`,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2500,
  };

  const aiHeaders = await __getAiAuthHeaders();

  try {
    const url = base.replace(/\/$/, '') + '/api/p1-analysis';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    const response = await fetch(url, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      await response.text().catch(() => '');
      return { ok: false, data: null, error: { code: 'API_ERROR', message: `HTTP ${response.status}` }, meta: { ok: false, errorCode: 'API_ERROR', ms: Date.now() - t0 } };
    }
    const result = await response.json();
    return {
      ...result,
      meta: {
        ...result.meta,
        ok: Boolean(result.ok),
        errorCode: result.ok ? undefined : (result.error?.code || 'UNKNOWN_ERROR'),
      },
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, data: null, error: { code: 'TIMEOUT', message: 'Request timed out after 90s' }, meta: { ok: false, errorCode: 'TIMEOUT', ms: Date.now() - t0 } };
    }
    return { ok: false, data: null, error: { code: 'FETCH_FAILED', message: String(error?.message || 'fetch failed') }, meta: { ok: false, errorCode: 'FETCH_FAILED', ms: Date.now() - t0 } };
  }
}

// ✅ PATCH (append-only, P1-B): JD requirement decomposer helper
// - Calls /api/jd-requirement-decomposer; returns full envelope { ok, data, error, meta }
// - 60s timeout; result stored in preciseAnalysis.jdRequirementDecomposition via setAnalysis
async function runJdRequirementDecomposerAI({ jdText, compactJdModel, parsedJD, requestId }) {
  if (!jdText) {
    return { ok: false, data: null, error: { code: 'MISSING_INPUT', message: 'jdText is required' }, meta: { ok: false, errorCode: 'MISSING_INPUT' } };
  }

  const base = import.meta.env.VITE_PARSE_API_BASE || import.meta.env.VITE_AI_PROXY_URL || import.meta.env.VITE_API_BASE;
  if (!base) {
    return { ok: false, data: null, error: { code: 'NO_PROXY_URL', message: 'AI proxy base URL not configured' }, meta: { ok: false, errorCode: 'NO_PROXY_URL' } };
  }

  const t0 = Date.now();
  const reqBody = {
    action: 'jd',
    jdText,
    compactJdModel: compactJdModel || null,
    parsedJD: parsedJD || null,
    requestId: requestId || `jd-decomp-${Date.now()}`,
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 2000,
  };

  const aiHeaders = await __getAiAuthHeaders();

  try {
    const url = base.replace(/\/$/, '') + '/api/p1-analysis';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const response = await fetch(url, {
      method: 'POST',
      headers: aiHeaders,
      body: JSON.stringify(reqBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      await response.text().catch(() => '');
      return { ok: false, data: null, error: { code: 'API_ERROR', message: `HTTP ${response.status}` }, meta: { ok: false, errorCode: 'API_ERROR', ms: Date.now() - t0 } };
    }
    const result = await response.json();
    return {
      ...result,
      meta: {
        ...result.meta,
        ok: Boolean(result.ok),
        errorCode: result.ok ? undefined : (result.error?.code || 'UNKNOWN_ERROR'),
      },
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { ok: false, data: null, error: { code: 'TIMEOUT', message: 'Request timed out after 60s' }, meta: { ok: false, errorCode: 'TIMEOUT', ms: Date.now() - t0 } };
    }
    return { ok: false, data: null, error: { code: 'FETCH_FAILED', message: String(error?.message || 'fetch failed') }, meta: { ok: false, errorCode: 'FETCH_FAILED', ms: Date.now() - t0 } };
  }
}

export default function App() {
  if (typeof window !== "undefined") {
    window.onerror = function (message, source, lineno, colno, error) {
      console.error("GLOBAL_RUNTIME_ERROR");
      console.error(message);
      console.error(source, lineno, colno);
      console.error(error);
    };

    window.onunhandledrejection = function (event) {
      console.error("UNHANDLED_PROMISE_REJECTION");
      console.error(event.reason);
    };
  }
  const { toast } = useToast();
  const isChatgptOAuthConsentRoute = (() => {
    if (typeof window === "undefined") return false;
    const pathname = String(window.location.pathname || "");
    return pathname === "/chatgpt-oauth/consent" ||
      pathname === "/chatgpt-oauth/consent/" ||
      pathname === "/reject-analyzer/chatgpt-oauth/consent" ||
      pathname === "/reject-analyzer/chatgpt-oauth/consent/";
  })();
  const __appRenderCountRef = useRef(0);
  const __appUiStatePushCountRef = useRef(0);
  const __pushLoopTrace = React.useCallback((source, payload) => {
    try {
      if (typeof window === "undefined") return;
      if (!Array.isArray(window.__PASSMAP_LOOP_TRACE__)) window.__PASSMAP_LOOP_TRACE__ = [];
      const row = { source, ts: Date.now(), payload: payload || null };
      window.__PASSMAP_LOOP_TRACE__.push(row);
      if (window.__PASSMAP_LOOP_TRACE__.length > 200) {
        window.__PASSMAP_LOOP_TRACE__ = window.__PASSMAP_LOOP_TRACE__.slice(-200);
      }
    } catch { }
  }, []);

  const [step, setStep] = useState(SECTION.JOB);
  const [activeTab, setActiveTab] = useState(SECTION.JOB);
  const [selfCheckMode, setSelfCheckMode] = useState("slider");
  const [jobSidebarView, setJobSidebarView] = useState("analysis");
  const [pmDemoView, setPmDemoView] = useState("result");
  const [pmLastInput, setPmLastInput] = useState(null);
  const [pendingRecordDate, setPendingRecordDate] = useState(null);
  const [pendingRecordContext, setPendingRecordContext] = useState(null);
  const [aiInboxOpenSignal, setAiInboxOpenSignal] = useState(0);

  const [state, setState, resetState] = usePersistedState("reject_analyzer_state_v3.2", defaultState);
  useEffect(() => {
    setState((prev) => {
      const current = (prev && typeof prev === "object") ? prev : {};
      if (Object.prototype.hasOwnProperty.call(current, "__entryLevelRestoreSnapshot")) {
        return current;
      }
      return {
        ...current,
        __entryLevelRestoreSnapshot: null,
      };
    });
  }, []);
  // ------------------------------
  // IME(한글 조합) 깨짐 방지용 draft 버퍼
  // ------------------------------
  const [imeDraft, setImeDraft] = useState({});
  const latestStateRef = useRef(state);
  const latestImeDraftRef = useRef(imeDraft);
  useEffect(() => {
    latestStateRef.current = state;
  }, [state]);
  useEffect(() => {
    latestImeDraftRef.current = imeDraft;
  }, [imeDraft]);
  const [__parsedJD, __setParsedJD] = React.useState(() => emptyParsed("jd"));
  const [__parsedResume, __setParsedResume] = React.useState(() => emptyParsed("resume"));
  const latestParsedJDRef = useRef(__parsedJD);
  const latestParsedResumeRef = useRef(__parsedResume);
  const [currentFlowResumeIoParseLoading, setCurrentFlowResumeIoParseLoading] = React.useState(false);
  const [currentFlowResumeIoParseMeta, setCurrentFlowResumeIoParseMeta] = React.useState(null);
  const currentFlowResumeRawText = String(state?.resume ?? state?.resumeText ?? state?.resumeRaw ?? "");
  const currentFlowResumeIoProfile = useMemo(() => {
    const parsed = (__parsedResume && typeof __parsedResume === "object") ? __parsedResume : null;
    if (!parsed) return null;
    const hasParsedData = Boolean(
      parsed.summary ||
      (Array.isArray(parsed.timeline) && parsed.timeline.length > 0) ||
      (Array.isArray(parsed.skills) && parsed.skills.length > 0) ||
      (Array.isArray(parsed.achievements) && parsed.achievements.length > 0) ||
      (Array.isArray(parsed.projects) && parsed.projects.length > 0)
    );
    if (!hasParsedData) return null;
    try {
      return buildResumeProfileFromParsedResume({
        parsedResume: parsed,
        rawText: currentFlowResumeRawText,
        importMeta: currentFlowResumeIoParseMeta,
        sourceLabel: "가져온 이력서",
      });
    } catch {
      return null;
    }
  }, [__parsedResume, currentFlowResumeRawText, currentFlowResumeIoParseMeta]);
  const runCurrentFlowResumeSchemaParse = React.useCallback(async () => {
    const resumeText = String(latestStateRef.current?.resume ?? latestStateRef.current?.resumeText ?? latestStateRef.current?.resumeRaw ?? "").trim();
    if (!resumeText) {
      setCurrentFlowResumeIoParseMeta({ warnings: ["이력서 텍스트가 비어 있어요"] });
      return;
    }

    setCurrentFlowResumeIoParseLoading(true);
    try {
      const result = await parseWithAI({
        kind: "resume",
        text: resumeText,
        callAi: () => fetchAiSchemaParse({ kind: "resume", text: resumeText }),
      });
      const parsed = result?.parsed || null;
      const hasParsedData = Boolean(
        parsed?.summary ||
        (Array.isArray(parsed?.timeline) && parsed.timeline.length > 0) ||
        (Array.isArray(parsed?.skills) && parsed.skills.length > 0) ||
        (Array.isArray(parsed?.achievements) && parsed.achievements.length > 0) ||
        (Array.isArray(parsed?.projects) && parsed.projects.length > 0)
      );
      if (hasParsedData) {
        __setParsedResume(parsed);
        try {
          if (typeof window !== "undefined") {
            window.__PARSED_RESUME__ = parsed;
            window.__PARSED_RESUME_GOOD__ = parsed;
          }
        } catch { }
      }
      setCurrentFlowResumeIoParseMeta(result?.meta || null);
    } catch (error) {
      setCurrentFlowResumeIoParseMeta({ warnings: ["AI 필드 추출 중 오류가 발생했어요."], error: String(error?.message || error) });
    } finally {
      setCurrentFlowResumeIoParseLoading(false);
    }
  }, []);
  useEffect(() => {
    latestParsedJDRef.current = __parsedJD;
  }, [__parsedJD]);
  useEffect(() => {
    latestParsedResumeRef.current = __parsedResume;
  }, [__parsedResume]);
  const imeComposingRef = useRef(new Set());
  // ------------------------------
  // [PATCH] One-time localStorage key migration (v3 -> v3.2)
  // - 안정성 원칙:
  //   1) v3.2가 이미 채워져 있으면 절대 덮어쓰지 않음
  //   2) v3.2가 비어 있고 v3에 데이터가 있으면 "복사"만 수행
  //   3) v3는 그대로 둬서 백업 역할 유지
  // ------------------------------
  useEffect(() => {
    try {
      const KEY_V32 = "reject_analyzer_state_v3.2";
      const KEY_V3 = "reject_analyzer_v3";

      const parse = (raw) => {
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      };

      const hasMeaningfulInput = (s) => {
        const jdLen = String(s?.jd ?? s?.jdText ?? "").length;
        const resumeLen = String(s?.resume ?? s?.resumeText ?? "").length;
        return jdLen > 0 || resumeLen > 0;
      };

      // 1) 이미 state에 입력이 있으면: 아무것도 하지 않음(덮어쓰기 금지)
      if (hasMeaningfulInput(state)) return;
      // ✅ UI helper (display-only): remove "유사도 0.xx" fragments from text
      const __stripSimilarity = (v) => {
        try {
          const s = (v ?? "").toString();
          if (!s) return s;

          return s
            // (유사도 0.42) 형태
            .replace(/\s*\(\s*유사도\s*[-+]?\d+(?:\.\d+)?\s*\)\s*/g, " ")
            // 유사도 0.42 형태
            .replace(/\s*유사도\s*[-+]?\d+(?:\.\d+)?\s*/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();
        } catch {
          return (v ?? "").toString();
        }
      };
      // 2) localStorage 확인: v3.2가 비었고 v3에 데이터가 있으면 복사
      const raw32 = localStorage.getItem(KEY_V32);
      const raw3 = localStorage.getItem(KEY_V3);

      const s32 = parse(raw32);
      if (hasMeaningfulInput(s32)) return;

      const s3 = parse(raw3);
      if (!hasMeaningfulInput(s3)) return;

      // 3) v3.2 백업(있다면)
      try {
        localStorage.setItem(KEY_V32 + "__backup", raw32 || "");
      } catch { }

      // 4) v3 -> v3.2 복사 + 즉시 state 반영
      localStorage.setItem(KEY_V32, raw3);
      setState((prev) => ({ ...(prev || {}), ...(s3 || {}) }));
    } catch { }
  }, []); // intentionally one-time only

  const imeOnCompositionEnd = (field) => {
    const v = getImeValue(field, state?.[field] ?? "");
    imeCommit(field, v);
    try { window.__DBG_PROXY_HIT__ = { at: new Date().toISOString(), from: "imeCommit", field: String(field || "") }; } catch { }
    scheduleProxyTeaser(`ime:${String(field || "")}`);
  };



  function _hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function getImeValue(key, fallback) {
    // ✅ 절대 undefined/null을 반환하지 않게: 항상 문자열로
    const has = _hasOwn(imeDraft, key);
    const v = has ? imeDraft[key] : fallback;
    return v === undefined || v === null ? "" : String(v);
  }

  function imeSetDraft(key, value) {
    // ✅ draft도 문자열로 통일 (undefined/null 방지)
    const v = value === undefined || value === null ? "" : String(value);

    setImeDraft((prev) => {
      if (_hasOwn(prev, key) && prev[key] === v) return prev;
      return { ...prev, [key]: v };
    });
  }

  function imeOnChange(key, value) {
    // ✅ onChange로 들어오는 값도 문자열로 통일
    const v = value === undefined || value === null ? "" : String(value);

    imeSetDraft(key, v);

    // composing 중에는 전역 state 업데이트 금지(IME 깨짐 방지)
    if (!imeComposingRef.current.has(key)) {
      setState((prev) => ({ ...prev, [key]: v }));
    }
  }


  function imeOnCompositionStart(key) {
    imeComposingRef.current.add(key);
  }

  function imeCommit(key, value) {
    imeComposingRef.current.delete(key);
    const v = value === undefined || value === null ? "" : String(value);
    imeSetDraft(key, v);
    setState((prev) => ({ ...prev, [key]: v }));
  }

  useEffect(() => {
    const stateJd = String(state?.jd ?? "");
    const viewJd = getImeValue("jd", stateJd);
    const draftJd = String(imeDraft?.jd ?? "");
  }, [state?.jd, imeDraft?.jd]);

  function __base64UrlEncodeUtf8(str) {
    try {
      const utf8 = encodeURIComponent(String(str));
      const bin = utf8.replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
      const b64 = btoa(bin);
      return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    } catch {
      try {
        const b64 = btoa(unescape(encodeURIComponent(String(str))));
        return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      } catch {
        return "";
      }
    }
  }

  function __legacyCopyText(text) {
    try {
      const t = String(text || "");
      if (!t) return false;

      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.left = "-1000px";
      ta.style.opacity = "0";

      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.value.length);

      const ok = document.execCommand && document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch {
      return false;
    }
  }

  function __base64UrlDecodeUtf8(b64url) {
    try {
      if (!b64url) return "";
      let s = String(b64url).replace(/-/g, "+").replace(/_/g, "/");
      // pad
      const pad = s.length % 4;
      if (pad === 2) s += "==";
      else if (pad === 3) s += "=";
      else if (pad !== 0) {
        // invalid length -> best effort
        while (s.length % 4 !== 0) s += "=";
      }

      const bin = atob(s);
      // binary string -> percent encoding
      let pct = "";
      for (let i = 0; i < bin.length; i++) {
        const c = bin.charCodeAt(i);
        pct += "%" + c.toString(16).padStart(2, "0");
      }
      return decodeURIComponent(pct);
    } catch {
      return "";
    }
  }

  function __parseSharePayloadFromUrl() {
    try {
      if (typeof window === "undefined") return null;
      const sp = new URLSearchParams(window.location.search || "");
      const r = sp.get("r");
      if (!r) return null;
      const json = __base64UrlDecodeUtf8(r);
      if (!json) return null;
      const obj = JSON.parse(json);
      if (!obj || typeof obj !== "object") return null;
      if (obj.v !== 1) return null;
      return obj;
    } catch {
      return null;
    }
  }

  function __parseShareSidFromUrl() {
    try {
      if (typeof window === "undefined") return "";
      const sp = new URLSearchParams(window.location.search || "");
      return String(sp.get("sid") || "").trim();
    } catch {
      return "";
    }
  }

  function __shareAppBasePath() {
    try {
      const origin = String(window?.location?.origin || "").trim();
      const pathname = String(window?.location?.pathname || "").trim();
      if (origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173") return "";
      if (origin === "https://true-hr.github.io") return "/reject-analyzer";
      if (pathname.includes("/reject-analyzer")) return "/reject-analyzer";
      const baseRaw = String(import.meta.env.BASE_URL || "/").trim();
      const baseTrimmed = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;
      return baseTrimmed === "/" ? "" : (baseTrimmed || "");
    } catch {
      return "";
    }
  }

  function __shareApiBase() {
    try {
      const b = (
        import.meta.env.VITE_SHARE_API_BASE ||
        import.meta.env.VITE_PARSE_API_BASE ||
        import.meta.env.VITE_AI_PROXY_URL ||
        window.location.origin ||
        ""
      ).toString().trim();
      return b;
    } catch {
      return "";
    }
  }

  async function __createShareSid(sharePack) {
    const base = __shareApiBase();
    const url = base.replace(/\/$/, "") + "/api/share";
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sharePack }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok || !data?.id) {
      throw new Error(data?.error?.message || data?.error || "share_create_failed");
    }
    return String(data.id);
  }

  async function __loadSharePackBySid(sid) {
    const base = __shareApiBase();
    const safeSid = encodeURIComponent(String(sid || "").trim());
    const url = base.replace(/\/$/, "") + `/api/share/${safeSid}`;
    const resp = await fetch(url, { method: "GET" });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data?.ok || !data?.sharePack) {
      throw new Error(data?.error?.message || data?.error || "share_load_failed");
    }
    return data.sharePack;
  }

  function buildSharePackV1(a) {
    try {
      const payload = buildSharePayloadV1(a);
      const simVM = payload?.simVM || null;
      const reportEntryMode = String(payload?.reportEntryMode || "").trim();
      const transitionLiteResultVm =
        payload?.transitionLiteResultVm && typeof payload.transitionLiteResultVm === "object"
          ? payload.transitionLiteResultVm
          : null;
      const preciseAnalysis =
        payload?.preciseAnalysis && typeof payload.preciseAnalysis === "object"
          ? payload.preciseAnalysis
          : null;
      const passProbability = Number(simVM?.passProbability);
      const top3 = Array.isArray(simVM?.top3)
        ? simVM.top3.slice(0, 3).map((r) => ({
          id: r?.id || null,
          priority: Number.isFinite(Number(r?.priority)) ? Number(r.priority) : null,
          title: r?.title || r?.explain?.title || null,
          layer: r?.layer || null,
        }))
        : [];
      const userTypeCode = String(simVM?.userType?.code || "").trim();
      const passmapTypeId = String(simVM?.passmapType?.id || "").trim();
      const passmapTypeLabel = String(simVM?.passmapType?.label || "").trim();
      const displayType = (simVM?.displayType && typeof simVM.displayType === "object")
        ? simVM.displayType
        : null;

      return {
        v: 1,
        createdAt: Date.now(),
        ...(reportEntryMode ? { reportEntryMode } : {}),
        ...(transitionLiteResultVm ? { transitionLiteResultVm } : {}),
        ...(preciseAnalysis ? { preciseAnalysis } : {}),
        simVM: {
          passProbability: Number.isFinite(passProbability) ? passProbability : null,
          userType: userTypeCode ? { code: userTypeCode } : null,
          passmapType:
            passmapTypeId || passmapTypeLabel
              ? {
                ...(passmapTypeId ? { id: passmapTypeId } : {}),
                ...(passmapTypeLabel ? { label: passmapTypeLabel } : {}),
              }
              : null,
          displayType: displayType
            ? {
              id: String(displayType?.id || "").trim() || null,
              title: String(displayType?.title || "").trim() || null,
              description: String(displayType?.description || "").trim() || null,
              hint: String(displayType?.hint || "").trim() || null,
              source: String(displayType?.source || "").trim() || null,
            }
            : null,
          top3,
        },
      };
    } catch {
      return { v: 1, createdAt: Date.now(), simVM: null };
    }
  }

  // 카카오 인앱 브라우저(IAB) 감지
  function __isKakaoInApp() {
    const ua = String(navigator.userAgent || "").toLowerCase();
    return ua.includes("kakaotalk");
  }

  // 카카오 공유용 public origin (dev에서도 배포 URL 강제)
  function __getPublicShareOrigin() {
    const envOrigin = String(import.meta.env.VITE_PUBLIC_APP_ORIGIN || "").trim();
    if (envOrigin) return envOrigin;
    return "https://true-hr.github.io";
  }

  async function __buildShareUrlWithSid(a) {
    const sharePack = buildSharePackV1(a);
    try {
      if (typeof window !== "undefined") {
        window.__PASSMAP_SHARE_SAVE_DEBUG__ = {
          at: Date.now(),
          sourceReportEntryMode: String(a?.reportEntryMode || "").trim(),
          sourceTransitionLiteVmExists: !!(a?.transitionLiteResultVm && typeof a.transitionLiteResultVm === "object"),
          savedReportEntryMode: String(sharePack?.reportEntryMode || "").trim(),
          savedTransitionLiteVmExists: !!(sharePack?.transitionLiteResultVm && typeof sharePack.transitionLiteResultVm === "object"),
          savedHasSimVM: !!sharePack?.simVM,
          savedKeys: Object.keys((sharePack && typeof sharePack === "object") ? sharePack : {}),
        };
      }
    } catch { }
    const sid = await __createShareSid(sharePack);
    const appBase = __shareAppBasePath();
    const origin = String(window.location.origin || "");
    return `${origin}${appBase}/?sid=${encodeURIComponent(sid)}`;
  }

  function buildSharePayloadV1(a) {
    try {
      const reportEntryMode = String(a?.reportEntryMode || "").trim();
      const transitionLiteResultVm =
        reportEntryMode === "transition-lite" && a?.transitionLiteResultVm && typeof a.transitionLiteResultVm === "object"
          ? a.transitionLiteResultVm
          : null;
      const preciseAnalysis =
        reportEntryMode === "precise-analysis"
          ? {
            reportPack: a?.reportPack || null,
            decisionPack: a?.decisionPack || null,
            state: a?.state && typeof a.state === "object"
              ? {
                jd: typeof a.state.jd === "string" ? a.state.jd : "",
                resume: typeof a.state.resume === "string" ? a.state.resume : "",
              }
              : null,
          }
          : null;
      const dp = a?.decisionPack || a?.reportPack?.decisionPack || null;

      // ✅ PATCH (append-only): share payload는 UI 표준 입력을 따른다
      // 우선순위: riskFeed(전체) → refinedRiskResults(있으면) → riskResults(legacy)
      const __riskFeed =
        (Array.isArray(dp?.riskFeed) && dp.riskFeed.length > 0 && dp.riskFeed) ||
        null;

      const __refined =
        (Array.isArray(dp?.refinedRiskResults) && dp.refinedRiskResults.length > 0 && dp.refinedRiskResults) ||
        null;

      const __legacy =
        (Array.isArray(dp?.riskResults) ? dp.riskResults : []);

      const rr = __riskFeed || __refined || __legacy;
      const __careerHistoryForSimVM =
        (Array.isArray(a?.state?.careerHistory) && a.state.careerHistory.length > 0 && a.state.careerHistory) ||
        (Array.isArray(a?.__passmapSnap?.state?.careerHistory) && a.__passmapSnap.state.careerHistory.length > 0 && a.__passmapSnap.state.careerHistory) ||
        (Array.isArray(a?.state?.career?.history) && a.state.career.history.length > 0 && a.state.career.history) ||
        null;
      const __ssotSimVM =
        a?.reportPack?.simulationViewModel ||
        a?.reportPack?.simVM ||
        a?.simulationViewModel ||
        a?.simVM ||
        null;
      const vmFull = __ssotSimVM || buildSimulationViewModel(rr, { careerHistory: __careerHistoryForSimVM });
      const simVM = { ...vmFull };

      if (simVM) {
        // logs: max 6, each max 140 chars, one-line
        if (Array.isArray(simVM.logs)) {
          simVM.logs = simVM.logs
            .slice(0, 6)
            .map((x) => {
              const s = String(x ?? "");
              const oneLine = s.replace(/\s+/g, " ").trim();
              return oneLine.length > 140 ? oneLine.slice(0, 140) : oneLine;
            })
            .filter((s) => !!s);
        }

        // top3: mini (drop long explain arrays)
        if (Array.isArray(simVM.top3)) {
          simVM.top3 = simVM.top3.slice(0, 3).map((r) => {
            const explainTitle =
              (r && r.explain && typeof r.explain.title !== "undefined" ? r.explain.title : undefined) ??
              (typeof r?.title !== "undefined" ? r.title : undefined);

            return {
              id: r?.id,
              group: r?.group,
              layer: r?.layer,
              priority: r?.priority,
              score: r?.score,
              severityTier: r?.severityTier,
              gateTriggered: r?.gateTriggered,
              title: r?.title,
              explain: { title: explainTitle },
            };
          });
        }
      }

      return {
        v: 1,
        ...(reportEntryMode ? { reportEntryMode } : {}),
        ...(transitionLiteResultVm ? { transitionLiteResultVm } : {}),
        ...(preciseAnalysis ? { preciseAnalysis } : {}),
        simVM,
      };
    } catch {
      return { v: 1, simVM: null };
    }
  }

  function getCurrentShareCopySet(shareUrl = "") {
    const safeUrl = String(shareUrl || "").trim();
    const isTransitionLiteShare = resultEntryMode === "transition-lite";
    const isPreciseAnalysisShare = resultEntryMode === "precise-analysis";

    if (isTransitionLiteShare) {
      return {
        title: "PASSMAP 직무산업 전환 간단 분석",
        description: "내 현재 직무와 목표 직무 사이의 전환 리스크와 설득 포인트를 바로 확인해봤어요.",
        buttonTitle: "분석 결과 보기",
        nativeText: "PASSMAP에서 직무산업 전환 간단 분석 결과를 확인했어요. 내 전환 리스크와 설득 포인트를 링크로 볼 수 있어요.",
        copyText: safeUrl
          ? `PASSMAP 직무산업 전환 간단 분석 결과\n내 전환 리스크와 설득 포인트를 링크로 확인해보세요.\n${safeUrl}`
          : "PASSMAP 직무산업 전환 간단 분석 결과\n내 전환 리스크와 설득 포인트를 링크로 확인해보세요.",
      };
    }

    if (isPreciseAnalysisShare) {
      return {
        title: "PASSMAP 서류 탈락 원인 분석 결과",
        description: "JD와 이력서를 비교해 서류 단계에서 걸릴 수 있는 리스크를 분석한 결과입니다.",
        buttonTitle: "분석 결과 보기",
        nativeText: "내 JD/이력서 기준 서류 탈락 원인 분석 결과를 공유합니다. PASSMAP에서 바로 확인해보세요.",
        copyText: safeUrl
          ? `PASSMAP 서류 탈락 원인 분석 결과\nJD와 이력서를 비교해 서류 단계에서 걸릴 수 있는 리스크를 분석했습니다.\n결과 확인:\n${safeUrl}`
          : "PASSMAP 서류 탈락 원인 분석 결과\nJD와 이력서를 비교해 서류 단계에서 걸릴 수 있는 리스크를 분석했습니다.\n결과 확인:",
      };
    }

    return {
      title: "PASSMAP 분석 리포트",
      description: "합격 리스크 TOP3랑 개선 포인트 정리했어요. 링크로 확인해요.",
      buttonTitle: "리포트 보기",
      nativeText: "합격 리스크 TOP3랑 개선 포인트 정리했어요. 링크로 확인해요.",
      copyText: safeUrl,
    };
  }

  function getCurrentShareSource() {
    const isTransitionLiteShare =
      resultEntryMode === "transition-lite" &&
      transitionLiteResultVm &&
      typeof transitionLiteResultVm === "object";
    const isPreciseAnalysisShare = resultEntryMode === "precise-analysis";

    if (isTransitionLiteShare) {
      return {
        reportEntryMode: "transition-lite",
        transitionLiteResultVm,
      };
    }

    if (isPreciseAnalysisShare) {
      const preciseSource = activeAnalysis || analysis || null;
      if (preciseSource && typeof preciseSource === "object") {
        return {
          ...preciseSource,
          reportEntryMode: "precise-analysis",
          state: state && typeof state === "object"
            ? {
              jd: typeof state.jd === "string" ? state.jd : "",
              resume: typeof state.resume === "string" ? state.resume : "",
            }
            : null,
        };
      }
      return preciseSource;
    }

    return activeAnalysis || analysis || null;
  }

  // ✅ PATCH (append-only): SSOT bridge for SimulatorLayout display
  // - decisionScore.capped가 있어도 interpretation 기반 passProbability는 보존
  // - 표시용 pass.percent/percentText만 보강
  // - 없으면 기존 simVM 그대로 유지
  function __bridgeSimVmWithDecisionScore(simVMInput, decisionPackInput) {
    try {
      const vm = (simVMInput && typeof simVMInput === "object") ? simVMInput : null;
      if (!vm) return simVMInput || null;

      const scoreRaw = Number(
        decisionPackInput?.decisionScore?.capped ??
        decisionPackInput?.decisionScore?.scoreCapped ??
        NaN
      );
      if (!Number.isFinite(scoreRaw)) return vm;

      const score = Math.max(0, Math.min(100, Math.round(scoreRaw)));
      const passBase = (vm.pass && typeof vm.pass === "object") ? vm.pass : {};

      return {
        ...vm,
        pass: {
          ...passBase,
          percent: score,
          percentText: `${score}%`,
        },
      };
    } catch {
      return simVMInput || null;
    }
  }

  // append-only: semantic card display policy bridge (UI-only)
  function __bridgeSimVmWithSemanticPolicy(simVMInput, analysisInput) {
    try {
      const vm = (simVMInput && typeof simVMInput === "object") ? simVMInput : null;
      if (!vm) return simVMInput || null;

      const a = (analysisInput && typeof analysisInput === "object") ? analysisInput : null;

      const __pickSemanticPair = (...sources) => {
        for (const src of sources) {
          if (!src || typeof src !== "object") continue;
          const hasMatch = typeof src.match !== "undefined";
          const hasMeta = typeof src.meta !== "undefined";
          if (hasMatch && hasMeta) {
            return {
              semanticMatch: src.match ?? null,
              semanticMeta: src.meta ?? null,
            };
          }
        }
        return null;
      };

      const __semanticPair =
        __pickSemanticPair(
          { match: vm?.semanticMatch, meta: vm?.semanticMeta },
          { match: a?.semanticMatch, meta: a?.semanticMeta },
          { match: vm?.semantic?.match, meta: vm?.semantic?.meta },
          { match: a?.semantic?.match, meta: a?.semantic?.meta },
        ) || null;

      const semanticMatch =
        __semanticPair?.semanticMatch ??
        vm?.semanticMatch ??
        a?.semanticMatch ??
        vm?.semantic?.match ??
        a?.semantic?.match ??
        null;
      const semanticMeta =
        __semanticPair?.semanticMeta ??
        vm?.semanticMeta ??
        a?.semanticMeta ??
        vm?.semantic?.meta ??
        a?.semantic?.meta ??
        null;

      const __collectSignalIds = () => {
        const ids = [];
        const pushId = (v) => {
          const s = String(v || "").trim().toUpperCase();
          if (s) ids.push(s);
        };
        const walk = (rows) => {
          const list = Array.isArray(rows) ? rows : [];
          for (const r of list) {
            pushId(r?.canonicalKey);
            pushId(r?.rawRiskId);
            pushId(r?.id);
            pushId(r?.raw?.id);
          }
        };

        walk(a?.decisionPack?.riskResults);
        walk(a?.decisionPack?.refinedRiskResults);
        walk(a?.reportPack?.decisionPack?.riskResults);
        walk(a?.reportPack?.decisionPack?.refinedRiskResults);
        walk(vm?.top3);
        return ids;
      };

      const __readJobFamily = (parsed) => {
        const p = (parsed && typeof parsed === "object") ? parsed : null;
        if (!p) return "";
        const candidates = [
          p?.jobFamily,
          p?.job_family,
          p?.domain?.jobFamily,
          p?.domain?.job_family,
          p?.role?.jobFamily,
          p?.role?.job_family,
          p?.normalized?.jobFamily,
          p?.normalized?.job_family,
        ];
        for (const c of candidates) {
          const s = String(c || "").trim();
          if (s) return s;
        }
        return "";
      };

      const parsedJD =
        a?.__passmapSnap?.state?.__parsedJD ||
        a?.state?.__parsedJD ||
        (typeof window !== "undefined" ? window.__PARSED_JD__ : null) ||
        null;
      const parsedResume =
        a?.__passmapSnap?.state?.__parsedResume ||
        a?.state?.__parsedResume ||
        (typeof window !== "undefined" ? window.__PARSED_RESUME__ : null) ||
        null;

      const jdJobFamily = __readJobFamily(parsedJD);
      const resumeJobFamily = __readJobFamily(parsedResume);
      const signalIds = __collectSignalIds();
      const domainMismatch = hasSemanticDomainBlockSignal(signalIds);
      const semanticPath = String(vm?.semanticPath || semanticMeta?.semanticPath || "background").trim().toLowerCase();
      const semanticThreshold = getSemanticDisplayThreshold(semanticPath);
      const semanticScoreRaw =
        (typeof vm?.semanticScore === "number" ? vm.semanticScore : null) ??
        (typeof semanticMeta?.avgSimilarity === "number" ? semanticMeta.avgSimilarity : null) ??
        pickSemanticBestScore(semanticMatch);
      const semanticScore = Number.isFinite(Number(semanticScoreRaw)) ? Number(semanticScoreRaw) : null;
      const semanticConfidence = (!jdJobFamily && !resumeJobFamily) ? "low" : "normal";

      return {
        ...vm,
        semanticMatch: semanticMatch ?? null,
        semanticMeta: semanticMeta ?? null,
        semanticPath,
        semanticThreshold,
        semanticScore,
        semanticConfidence,
        domainMismatch,
      };
    } catch {
      return simVMInput || null;
    }
  }


  async function onShareCopyCurrentReport() {
    try {
      const shareSource = getCurrentShareSource();
      const url = await __buildShareUrlWithSid(shareSource);
      const shareCopySet = getCurrentShareCopySet(url);
      const copyText = String(shareCopySet?.copyText || url || "").trim() || url;
      let copied = false;

      // 1) modern clipboard API
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(copyText);
          copied = true;
        }
      } catch { }

      // 2) legacy fallback (textarea 방식)
      if (!copied) {
        try {
          copied = __legacyCopyText(copyText);
        } catch { }
      }

      // 3) 마지막 fallback
      if (!copied) {
        try { window.prompt("공유 내용을 복사하세요:", copyText); } catch { }
        try {
          window.alert("자동 복사가 차단되어 공유 내용을 직접 복사해야 합니다.");
        } catch { }
      }

      setShareCopied(true);
      try {
        if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
      } catch { }
      shareCopiedTimerRef.current = setTimeout(() => {
        setShareCopied(false);
      }, 900);
    } catch (err) {
      // 임시 디버그: 원인 확인 후 삭제
      globalThis.__DBG_SHARE_CREATE__ = {
        ts: Date.now(),
        channel: "copy",
        message: err?.message || String(err),
      };
    }
  }

  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // ✅ PATCH (append-only): require resume attachment before analysis
  // - "resumeText"만으로는 첨부 여부를 알 수 없어서 별도 플래그로 강제합니다.
  const [__resumeAttached, __setResumeAttached] = useState(false);
  // InputFlow file-extract warnings (JD/Resume)
  const [__inputFlowWarnings, __setInputFlowWarnings] = useState({ jd: [], resume: [] });
  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimerRef = useRef(null);
  const [sharePayload, setSharePayload] = useState(null);
  const sharePayloadAiRetryRef = useRef({ sid: "", attempted: false });
  const [shareMode, setShareMode] = useState(false);
  const [showInputFlow, setShowInputFlow] = useState(false);
  const [inputEntryMode, setInputEntryMode] = useState("default");
  const [showBetaEntryBanner, setShowBetaEntryBanner] = useState(false);
  const [transitionLiteAudience, setTransitionLiteAudience] = useState("experienced");
  const [resultEntryMode, setResultEntryMode] = useState("passmap");
  const [transitionLiteResultVm, setTransitionLiteResultVm] = useState(null);
  const [newgradSourceInput, setNewgradSourceInput] = useState(null);
  const [activeExplanationRowKey, setActiveExplanationRowKey] = useState(null);
  const [__tlResetKey, __setTlResetKey] = useState(0);
  const [transitionLiteEntryStep, setTransitionLiteEntryStep] = useState("audience-select");
  const __transitionLiteSelectionRef = useRef(null);
  const __transitionLiteLandingViewedRef = useRef(false);
  const __transitionLiteResultViewedKeyRef = useRef("");
  const __lastInputFlowPropRef = useRef(null);
  const [__inputFlowUiState, __setInputFlowUiState] = useState(() => ({
    flowStep: 0,
    roleMajorStep: "current-major",
    roleMajorSelected: "",
    currentMajorSelected: "",
  }));
  const __handleInputFlowUiStateChange = React.useCallback((nextUi) => {
    const n = (nextUi && typeof nextUi === "object") ? nextUi : {};
    __setInputFlowUiState((prev) => {
      const p = (prev && typeof prev === "object") ? prev : {};
      const merged = { ...p, ...n };
      const fieldSame = {
        flowStep: p.flowStep === merged.flowStep,
        roleMajorStep: p.roleMajorStep === merged.roleMajorStep,
        roleMajorSelected: p.roleMajorSelected === merged.roleMajorSelected,
        currentMajorSelected: p.currentMajorSelected === merged.currentMajorSelected,
      };
      const allSame =
        fieldSame.flowStep &&
        fieldSame.roleMajorStep &&
        fieldSame.roleMajorSelected &&
        fieldSame.currentMajorSelected;
      __appUiStatePushCountRef.current += 1;
      try { if (typeof window !== "undefined") window.__APP_UISTATE_PUSH_COUNT__ = __appUiStatePushCountRef.current; } catch { }
      __pushLoopTrace("APP_UISTATE_PRECHECK", {
        count: __appUiStatePushCountRef.current,
        prev: p,
        next: n,
        merged,
        fieldSame,
        allSame,
      });
      __pushLoopTrace("APP_UISTATE_DECISION", {
        count: __appUiStatePushCountRef.current,
        allSame,
        willReturnPrev: allSame,
      });
      try {
        if (typeof window !== "undefined") {
          if (!Array.isArray(window.__PASSMAP_LOOP_TRACE__)) window.__PASSMAP_LOOP_TRACE__ = [];
          window.__PASSMAP_LOOP_TRACE__.push({
            source: "APP_UISTATE_IN",
            ts: Date.now(),
            payload: { count: __appUiStatePushCountRef.current, prev: p, next: n, merged, same: allSame },
          });
          if (window.__PASSMAP_LOOP_TRACE__.length > 200) {
            window.__PASSMAP_LOOP_TRACE__ = window.__PASSMAP_LOOP_TRACE__.slice(-200);
          }
        }
      } catch { }
      return allSame ? prev : merged;
    });
  }, []);

  function __pushGaDebug(entry) {
    try {
      if (typeof window === "undefined") return;
      if (!Array.isArray(window.__PASSMAP_GA_DEBUG__)) window.__PASSMAP_GA_DEBUG__ = [];
      window.__PASSMAP_GA_DEBUG__.push({
        ts: Date.now(),
        ...entry,
      });
      if (window.__PASSMAP_GA_DEBUG__.length > 50) {
        window.__PASSMAP_GA_DEBUG__ = window.__PASSMAP_GA_DEBUG__.slice(-50);
      }
    } catch { }
  }

  function __getSafeGaDebugParams(params = {}) {
    const safeParams = {};
    for (const [key, value] of Object.entries((params && typeof params === "object") ? params : {})) {
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && !value.trim()) continue;
      if (typeof value === "function") continue;
      safeParams[key] = value;
    }
    return safeParams;
  }

  function __trackGa4Event(name, params = {}) {
    try {
      if (typeof window === "undefined" || typeof window.gtag !== "function") return;
      const safeParams = __getSafeGaDebugParams(params);
      if (!Object.prototype.hasOwnProperty.call(safeParams, "debug_mode")) {
        safeParams.debug_mode = true;
      }
      __pushGaDebug({
        source: "__trackGa4Event",
        eventName: name,
        params: safeParams,
        location: window.location?.href || "",
      });
      window.gtag("event", name, safeParams);
    } catch (err) {
      __pushGaDebug({
        source: "__trackGa4Event",
        eventName: name,
        params: __getSafeGaDebugParams(params),
        location: (typeof window !== "undefined" && window.location?.href) || "",
        error: String(err?.message || err || "unknown_track_error"),
      });
    }
  }

  function __openTrackedExternal(url, eventName, params, onOpenError) {
    const safeUrl = String(url || "").trim();
    if (!safeUrl) return;
    const safeParams = __getSafeGaDebugParams(params);
    const currentLocation = (typeof window !== "undefined" && window.location?.href) || "";
    __pushGaDebug({
      source: "__openTrackedExternal",
      eventName,
      params: safeParams,
      href: safeUrl,
      location: currentLocation,
      stage: "enter",
    });

    let popupRef = null;
    try {
      popupRef = window.open("", "_blank");
      if (popupRef) {
        try { popupRef.opener = null; } catch { }
      }
    } catch (err) {
      __pushGaDebug({
        source: "__openTrackedExternal",
        eventName,
        params: safeParams,
        href: safeUrl,
        location: currentLocation,
        stage: "popup_preopen_error",
        error: String(err?.message || err || "unknown_preopen_error"),
      });
    }

    let opened = false;
    const openTarget = () => {
      if (opened) return;
      opened = true;
      __pushGaDebug({
        source: "__openTrackedExternal",
        eventName,
        params: safeParams,
        href: safeUrl,
        location: (typeof window !== "undefined" && window.location?.href) || currentLocation,
        stage: "fallback_openTarget",
      });
      try {
        if (popupRef && !popupRef.closed) {
          popupRef.location.replace(safeUrl);
          return;
        }
      } catch (err) {
        __pushGaDebug({
          source: "__openTrackedExternal",
          eventName,
          params: safeParams,
          href: safeUrl,
          location: (typeof window !== "undefined" && window.location?.href) || currentLocation,
          stage: "popup_replace_error",
          error: String(err?.message || err || "unknown_replace_error"),
        });
      }
      try {
        window.open(safeUrl, "_blank", "noopener,noreferrer");
        return;
      } catch (err) {
        __pushGaDebug({
          source: "__openTrackedExternal",
          eventName,
          params: safeParams,
          href: safeUrl,
          location: (typeof window !== "undefined" && window.location?.href) || currentLocation,
          stage: "popup_open_error",
          error: String(err?.message || err || "unknown_open_error"),
        });
        try { onOpenError?.(err); } catch { }
      }
    };

    let fallbackTimer = null;
    try {
      fallbackTimer = window.setTimeout(openTarget, 120);
    } catch {
      fallbackTimer = null;
    }

    try {
      if (typeof window.gtag === "function") {
        window.gtag("event", eventName, {
          ...((params && typeof params === "object") ? params : {}),
          debug_mode:
            (params && typeof params === "object" && Object.prototype.hasOwnProperty.call(params, "debug_mode"))
              ? params.debug_mode
              : true,
          event_callback: () => {
            __pushGaDebug({
              source: "__openTrackedExternal",
              eventName,
              params: safeParams,
              href: safeUrl,
              location: (typeof window !== "undefined" && window.location?.href) || currentLocation,
              stage: "event_callback",
            });
            try {
              if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
            } catch { }
            openTarget();
          },
        });
      } else {
        openTarget();
      }
    } catch (err) {
      __pushGaDebug({
        source: "__openTrackedExternal",
        eventName,
        params: safeParams,
        href: safeUrl,
        location: (typeof window !== "undefined" && window.location?.href) || currentLocation,
        stage: "gtag_error",
        error: String(err?.message || err || "unknown_gtag_error"),
      });
      try {
        if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      } catch { }
      openTarget();
    }
  }

  function __getTransitionLiteAnalyticsContext(extra = {}) {
    const selection = (__transitionLiteSelectionRef.current && typeof __transitionLiteSelectionRef.current === "object")
      ? __transitionLiteSelectionRef.current
      : {};
    const currentJobId = String(selection.currentJobId || "").trim();
    const currentIndustryId = String(selection.currentIndustryId || "").trim();
    const targetJobId = String(selection.targetJobId || "").trim();
    const targetIndustryId = String(selection.targetIndustryId || "").trim();
    const transitionPair = __buildTransitionLiteTransitionPair(selection);
    const topRiskKey = String(transitionLiteResultVm?.topRisks?.[0]?.key || "").trim();

    return {
      analysis_type: TRANSITION_LITE_ANALYSIS_TYPE,
      current_job_id: currentJobId || undefined,
      current_industry_id: currentIndustryId || undefined,
      target_job_id: targetJobId || undefined,
      target_industry_id: targetIndustryId || undefined,
      transition_pair: transitionPair || undefined,
      top_risk_key: topRiskKey || undefined,
      ...extra,
    };
  }

  function handleTransitionLiteStepCompleted(payload = {}) {
    const stepName = String(payload.step_name || "").trim();
    const stepIndex = Number(payload.step_index);
    const currentJobId = String(payload.current_job_id || "").trim();
    const currentIndustryId = String(payload.current_industry_id || "").trim();
    const targetJobId = String(payload.target_job_id || "").trim();
    const targetIndustryId = String(payload.target_industry_id || "").trim();
    if (!stepName || !Number.isFinite(stepIndex)) return;
    if (!currentJobId && !currentIndustryId && !targetJobId && !targetIndustryId) return;

    __trackGa4Event("analysis_step_completed", {
      analysis_type: String(payload.analysis_type || TRANSITION_LITE_ANALYSIS_TYPE).trim() || TRANSITION_LITE_ANALYSIS_TYPE,
      step_name: stepName,
      step_index: stepIndex,
      current_job_id: currentJobId || undefined,
      current_industry_id: currentIndustryId || undefined,
      target_job_id: targetJobId || undefined,
      target_industry_id: targetIndustryId || undefined,
    });
  }

  function handleTransitionLiteInputsCompleted(payload = {}) {
    __trackGa4Event("analysis_inputs_completed", {
      analysis_type: String(payload.analysis_type || TRANSITION_LITE_ANALYSIS_TYPE).trim() || TRANSITION_LITE_ANALYSIS_TYPE,
      current_job_id: payload.current_job_id,
      current_industry_id: payload.current_industry_id,
      target_job_id: payload.target_job_id,
      target_industry_id: payload.target_industry_id,
      transition_pair: payload.transition_pair,
    });
  }

  function handleTransitionLiteStartAnalysis(payload = {}) {
    __trackGa4Event("start_analysis", {
      analysis_type: String(payload.analysis_type || TRANSITION_LITE_ANALYSIS_TYPE).trim() || TRANSITION_LITE_ANALYSIS_TYPE,
      page_type: String(payload.page_type || "landing").trim() || "landing",
      entry_cta_name: String(payload.entry_cta_name || "").trim() || "transition_lite_result_submit",
    });
  }

  useEffect(() => {
    __appRenderCountRef.current += 1;
    const count = __appRenderCountRef.current;
    try { if (typeof window !== "undefined") window.__APP_RENDER_COUNT__ = count; } catch { }
    __pushLoopTrace("APP_RENDER", {
      count,
      inputFlowUiState: __inputFlowUiState,
      activeTab,
      showInputFlow,
    });
  });
  // JOB 탭 진입 시 InputFlow 자동 활성화, 이탈 시 비활성화
  useEffect(() => {
    if (activeTab === SECTION.JOB) {
      setShowInputFlow(true);
      setJobSidebarView("analysis");
    } else setShowInputFlow(false);
  }, [activeTab]);
  useEffect(() => {
    if (jobSidebarView === "result") {
      setJobSidebarView("resume");
    } else if (jobSidebarView === "readiness") {
      setJobSidebarView("resume-update");
    }
  }, [jobSidebarView]);
  useEffect(() => {
    if (activeTab !== SECTION.JOB && inputEntryMode !== "default") {
      setInputEntryMode("default");
    }
  }, [activeTab, inputEntryMode]);
  useEffect(() => {
    if (__transitionLiteLandingViewedRef.current) return;
    if (shareMode) return;
    if (activeTab !== SECTION.JOB || !showInputFlow || inputEntryMode !== "transition-lite") return;

    __transitionLiteLandingViewedRef.current = true;
    __trackGa4Event("view_landing", {
      analysis_type: TRANSITION_LITE_ANALYSIS_TYPE,
      page_type: "landing",
    });
  }, [activeTab, inputEntryMode, shareMode, showInputFlow]);
  useEffect(() => {
    if (shareMode) return;
    if (activeTab !== SECTION.RESULT || resultEntryMode !== "transition-lite" || !transitionLiteResultVm) return;

    const analyticsContext = __getTransitionLiteAnalyticsContext({ page_type: "result" });
    const transitionPair = String(analyticsContext.transition_pair || "").trim();
    if (!transitionPair) return;
    if (__transitionLiteResultViewedKeyRef.current === transitionPair) return;

    const rafId = window.requestAnimationFrame(() => {
      if (__transitionLiteResultViewedKeyRef.current === transitionPair) return;
      __transitionLiteResultViewedKeyRef.current = transitionPair;
      __trackGa4Event("view_result", analyticsContext);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activeTab, resultEntryMode, shareMode, transitionLiteResultVm]);
  // 자가진단 순차 공개 인덱스 (UI-only, 비지속성)
  const [selfCheckOpenIdx, setSelfCheckOpenIdx] = useState(0);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLoadError, setShareLoadError] = useState("");
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [sharePanelPos, setSharePanelPos] = useState({ top: 0, left: 0 });
  const shareAnchorRef = useRef(null);
  // ------------------------------
  // AI state (UX merge only)
  // - 룰 엔진 결과는 즉시 렌더
  // - AI는 "뒤에서 보강"만(merge)
  // ------------------------------
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiMeta, setAiMeta] = useState(null);

  const aiAbortRef = useRef(null);
  const aiInFlightRef = useRef({ key: "", controller: null });
  const aiCacheRef = useRef(new Map());
  const aiLastCallRef = useRef({ key: "", at: 0 });
  const analysisKeyRef = useRef("");
  const lastRejectionAiInputsRef = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
      }
    } catch { }
  }, [analysis]);
  useEffect(() => {
    return () => {
      try {
        if (shareCopiedTimerRef.current) clearTimeout(shareCopiedTimerRef.current);
      } catch { }
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sid = __parseShareSidFromUrl();
        if (sid) {
          if (!cancelled) {
            setShareMode(true);
            setShareLoading(true);
            setShareLoadError("");
          }
          const pack = await __loadSharePackBySid(sid);
          if (!cancelled && pack) {
            // 성공 시점에 shareMode 재확인 (첫 setShareMode 후 다른 렌더가 끼어들었을 경우 대비)
            try {
              if (typeof window !== "undefined") {
                window.__PASSMAP_SHARE_DEBUG__ = {
                  at: Date.now(),
                  sid,
                  loadedReportEntryMode: String(pack?.reportEntryMode || "").trim(),
                  loadedTransitionLiteVmExists: !!(pack?.transitionLiteResultVm && typeof pack.transitionLiteResultVm === "object"),
                  loadedHasSimVM: !!pack?.simVM,
                  willSetShareMode: true,
                  willSetSharePayload: true,
                };
              }
            } catch { }
            setShareMode(true);
            setSharePayload(pack);
            setShareLoading(false);
            setShareLoadError("");
            try { globalThis.__DBG_SHARE_BOOT__ = { at: Date.now(), sid, ok: true, hasSimVM: !!pack?.simVM, passProbability: pack?.simVM?.passProbability ?? null }; } catch { }
            return;
          }
          // pack이 falsy인 경우 디버그
          try { globalThis.__DBG_SHARE_BOOT__ = { at: Date.now(), sid, ok: false, reason: "pack_falsy", pack }; } catch { }
        }
        const p = __parseSharePayloadFromUrl();
        if (!cancelled && p) {
          setSharePayload(p);
          setShareMode(true);
        }
      } catch (err) {
        if (!cancelled) {
          setShareMode(true);
          setShareLoading(false);
          setShareLoadError("불러오지 못했습니다.");
        }
        // 임시 디버그: 원인 확인 후 삭제
        globalThis.__DBG_SHARE_LOAD__ = {
          ts: Date.now(),
          message: err?.message || String(err),
          search: typeof window !== "undefined" ? String(window.location.search || "") : "",
        };
        try { globalThis.__DBG_SHARE_BOOT__ = { at: Date.now(), ok: false, reason: "exception", message: err?.message || String(err) }; } catch { }
        try {
          const p = __parseSharePayloadFromUrl();
          if (!cancelled && p) {
            setSharePayload(p);
            setShareLoadError("");
          }
        } catch { }
      } finally {
        if (!cancelled) setShareLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ✅ PATCH (append-only): Trigger AI deep analysis for restored/shared precise analysis results
  useEffect(() => {
    if (!sharePayload || !sharePayload.preciseAnalysis) return;

    const pa = sharePayload.preciseAnalysis;
    const state = sharePayload.preciseAnalysis?.state || sharePayload.__passmapSnap?.state || sharePayload.state;
    const jdText = String(state?.jd || "").trim();
    const resumeText = String(state?.resume || "").trim();

    // Guard: only proceed if inputs are available and AI result is not yet loaded
    if (!jdText || !resumeText) return;
    if (pa.aiDeepAnalysis && typeof pa.aiDeepAnalysis === "object") return;
    if (pa.aiMeta && pa.aiMeta.ok === true) return;

    // ✅ PATCH (B4: grounded 전용): compositeRiskContext 를 sharePayload 의
    // deterministic 결과로부터 derive 한다. 만들 수 없으면 AI 호출 자체를
    // skip 한다 (raw 모드로 떨어져 deterministic 결과를 덮는 흐름 차단).
    const __spCompositeSource = (pa.compositeRisk && typeof pa.compositeRisk === "object")
      ? pa.compositeRisk
      : null;
    const __spCompositeRiskContext = __spCompositeSource
      ? {
          summary: (__spCompositeSource.summary && typeof __spCompositeSource.summary === "object")
            ? __spCompositeSource.summary
            : null,
          topRisks: Array.isArray(__spCompositeSource.topRisks) ? __spCompositeSource.topRisks : [],
        }
      : null;
    if (
      !__spCompositeRiskContext
      || (!__spCompositeRiskContext.summary && __spCompositeRiskContext.topRisks.length === 0)
    ) {
      sharePayloadAiRetryRef.current = { sid: String(sharePayload.sid || Date.now()), attempted: true };
      return;
    }

    // Guard: check if we already attempted for this sharePayload
    const sidKey = String(sharePayload.sid || Date.now());
    if (sharePayloadAiRetryRef.current.sid === sidKey && sharePayloadAiRetryRef.current.attempted) {
      return;
    }

    // Mark attempt
    sharePayloadAiRetryRef.current = { sid: sidKey, attempted: true };

    // Fire AI request
    (async () => {
      try {
        const portfolio = String(state?.portfolio || "").trim();
        const fullResumeText = portfolio ? (resumeText + "\n\n" + portfolio) : resumeText;
        const aiRequestId = `rejection-ai-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const __spTargetRole = String(state?.targetRoleInPosting || '').trim();
        const __spScopedJd = __pmScopeJdByTargetRole(jdText, __spTargetRole);
        try {
          if (typeof window !== "undefined") {
            window.__PM_AI_SCOPED_JD_DEBUG__ = { targetRoleInPosting: __spTargetRole, originalLength: jdText.length, scopedLength: __spScopedJd.length, scopedApplied: __spScopedJd.length !== jdText.length, source: "sharePayload" };
          }
        } catch { }
        const aiResult = await runRejectionAnalysisAI({
          jdText: __spScopedJd,
          resumeText: fullResumeText,
          requestId: aiRequestId,
          compositeRiskContext: __spCompositeRiskContext,
          groundingMode: 'grounded',
          targetRoleInPosting: __spTargetRole || null,
        });

        if (!aiResult) return;

        // Update sharePayload with AI result
        setSharePayload((prev) => {
          if (!prev || !prev.preciseAnalysis) return prev;

          const aiMeta = {
            ok: Boolean(aiResult.ok),
            grounded: true,
            groundingSource: 'compositeRisk',
            provider: aiResult.meta?.provider || 'gemini',
            model: aiResult.meta?.model || 'gemini-2.5-flash',
            ms: aiResult.meta?.ms || 0,
            requestId: aiRequestId,
          };
          if (!aiResult.ok) {
            aiMeta.errorCode = aiResult.error?.code || 'UNKNOWN_ERROR';
          }

          return {
            ...prev,
            preciseAnalysis: {
              ...prev.preciseAnalysis,
              ...(aiResult.ok && aiResult.data ? { aiDeepAnalysis: aiResult.data } : {}),
              aiMeta,
            },
          };
        });
      } catch (err) {
        // Silent failure: deterministic result remains available
        setSharePayload((prev) => {
          if (!prev || !prev.preciseAnalysis) return prev;
          return {
            ...prev,
            preciseAnalysis: {
              ...prev.preciseAnalysis,
              aiMeta: {
                ok: false,
                grounded: true,
                groundingSource: 'compositeRisk',
                provider: 'gemini',
                model: 'gemini-2.5-flash',
                ms: 0,
                errorCode: 'INTERNAL_ERROR',
              },
            },
          };
        });
      }
    })();
  }, [sharePayload]);

  const semanticCacheRef = useRef(new Map());
  useEffect(() => {
    const k = analysis?.key;
    if (!k) return;

    const __hasSemanticPair = (obj) =>
      typeof obj?.semanticMeta !== "undefined" &&
      typeof obj?.semanticMatch !== "undefined";

    const already =
      __hasSemanticPair(analysis);
    if (already) return;

    const cached = semanticCacheRef.current.get(k);
    if (!cached) return;

    setAnalysis((prev) => {
      if (!prev || prev.key !== k) return prev;

      const alreadyPrev =
        __hasSemanticPair(prev);
      if (alreadyPrev) return prev;

      const next = {
        ...prev,
        semanticMatch: typeof cached.semanticMatch === "undefined" ? null : cached.semanticMatch,
        semanticMeta: typeof cached.semanticMeta === "undefined" ? null : cached.semanticMeta,

        // ✅ PATCH (append-only): semanticMeta.avgSimilarity -> ai.semanticMatches.matchRate
        ai: (() => {
          try {
            const nextAi = (prev?.ai && typeof prev.ai === "object") ? prev.ai : {};
            const meta = (typeof cached.semanticMeta === "undefined") ? null : cached.semanticMeta;

            const avg =
              meta && typeof meta.avgSimilarity === "number" ? meta.avgSimilarity :
                meta && typeof meta.averageSimilarity === "number" ? meta.averageSimilarity :
                  meta && typeof meta.avg === "number" ? meta.avg :
                    null;

            if (typeof avg !== "number") return nextAi;

            const sm =
              (nextAi.semanticMatches && typeof nextAi.semanticMatches === "object")
                ? nextAi.semanticMatches
                : [];

            if (typeof sm.matchRate === "number") return nextAi;

            if (Array.isArray(sm)) {
              const smNext = sm.slice(0);
              smNext.matchRate = avg;
              return { ...nextAi, semanticMatches: smNext };
            }

            return {
              ...nextAi,
              semanticMatches: {
                ...sm,
                matchRate: avg,
              },
            };
          } catch {
            return (prev?.ai && typeof prev.ai === "object") ? prev.ai : {};
          }
        })(),
      };

      // ✅ DEBUG SYNC (최신 analysis를 window에 반영)
      try {
        if (typeof window !== "undefined") window.__DBG_ANALYSIS__ = next;
        if (typeof window !== "undefined") window.__DBG_ACTIVE__ = next;
      } catch { }

      return next;
    });
  }, [analysis?.key]);
  // ✅ PATCH (append-only): semanticMeta.avgSimilarity -> ai.semanticMatches.matchRate (sync)
  // - 목적: semantic은 성공했는데(ai overwrite/timing 등) matchRate가 빠지는 케이스 방지
  // - 정책: 이미 matchRate가 숫자면 절대 덮지 않음
  React.useEffect(() => {
    const k = analysis?.key;
    if (!k) return;

    const avg = typeof analysis?.semanticMeta?.avgSimilarity === "number"
      ? analysis.semanticMeta.avgSimilarity
      : null;

    if (typeof avg !== "number" || !Number.isFinite(avg)) return;

    const cur = analysis?.ai?.semanticMatches;
    const has =
      cur && typeof cur === "object" && typeof cur.matchRate === "number" && Number.isFinite(cur.matchRate);

    if (has) return;

    setAnalysis((prev) => {
      if (!prev || prev.key !== k) return prev;

      const avg2 = typeof prev?.semanticMeta?.avgSimilarity === "number"
        ? prev.semanticMeta.avgSimilarity
        : null;

      if (typeof avg2 !== "number" || !Number.isFinite(avg2)) return prev;

      const next = { ...prev };
      if (!next.ai || typeof next.ai !== "object") next.ai = {};

      // 배열/객체 모두 허용(append-only). 배열이어도 속성 부여 가능.
      if (!next.ai.semanticMatches || typeof next.ai.semanticMatches !== "object") {
        next.ai.semanticMatches = [];
      }

      if (typeof next.ai.semanticMatches.matchRate !== "number") {
        next.ai.semanticMatches.matchRate = avg2;
      }

      return next;
    });
  }, [analysis?.key, analysis?.semanticMeta?.avgSimilarity]);

  // ✅ PATCH (append-only, P1-C): Fire role-fit career matcher when P1-A+P1-B both ready
  const roleFitP1cRef = useRef({ key: null, fired: false });
  useEffect(() => {
    const careerInterp = analysis?.preciseAnalysis?.resumeCareerInterpretation;
    const jdDecomp = analysis?.preciseAnalysis?.jdRequirementDecomposition;
    const alreadyDone = analysis?.preciseAnalysis?.roleFitCareerMatch;
    const analysisKey = analysis?.key;
    if (!careerInterp || !jdDecomp || alreadyDone || !analysisKey) return;
    const targetRole = state?.roleTarget || state?.targetRole || null;
    if (!targetRole) return;
    if (roleFitP1cRef.current.key === analysisKey && roleFitP1cRef.current.fired) return;
    roleFitP1cRef.current = { key: analysisKey, fired: true };
    const targetRoleMajorCategory = state?.roleTargetTaxonomy?.majorKey || state?.roleTargetResolved?.majorCategory || null;
    const targetRoleSubcategory = state?.roleTargetTaxonomy?.subKey || state?.roleTargetResolved?.subcategory || null;
    const requestId = `role-fit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    (async () => {
      try {
        const result = await runRoleFitCareerMatcherAI({ resumeCareerInterpretation: careerInterp, jdRequirementDecomposition: jdDecomp, targetRole, targetRoleMajorCategory, targetRoleSubcategory, requestId });
        if (!result) return;
        setAnalysis((prev) => {
          if (!prev || prev.key !== analysisKey) return prev;
          return {
            ...prev,
            preciseAnalysis: {
              ...(prev.preciseAnalysis || {}),
              ...(result.ok && result.data ? { roleFitCareerMatch: result.data } : {}),
              roleFitCareerMatchMeta: { ok: Boolean(result.ok), ms: result.meta?.ms || 0, requestId, ...(result.ok ? {} : { errorCode: result.error?.code || 'UNKNOWN_ERROR' }) },
            },
          };
        });
      } catch (err) {
        try {
          setAnalysis((prev) => {
            if (!prev || prev.key !== analysisKey) return prev;
            return { ...prev, preciseAnalysis: { ...(prev.preciseAnalysis || {}), roleFitCareerMatchMeta: { ok: false, ms: 0, requestId, errorCode: 'INTERNAL_ERROR' } } };
          });
        } catch { }
      }
    })();
  }, [analysis?.key, analysis?.preciseAnalysis?.resumeCareerInterpretation, analysis?.preciseAnalysis?.jdRequirementDecomposition]);

  // ✅ PATCH (append-only, P2-1+P2-2a): Recompute compositeRisk with P1-A/B/C context
  // - Fires once per analysis key after roleFitCareerMatch becomes available
  // - P1-A (resumeCareerInterpretation) → achievement engine; P1-B (jdRequirementDecomposition) + P1-C → keyword engine
  // - Uses window.__JD_RESUME_FIT__ and window.__PARSED_RESUME__ set during analyze callback
  const roleFitContextRef = useRef({ key: null, done: false });
  const aiGroundingRef = useRef({ key: null, done: false });
  useEffect(() => {
    const __roleFitMatch = analysis?.preciseAnalysis?.roleFitCareerMatch;
    const __jdDecomp     = analysis?.preciseAnalysis?.jdRequirementDecomposition ?? null;
    const __analysisKey  = analysis?.key;
    if (!__roleFitMatch || !__analysisKey) return;
    if (roleFitContextRef.current.key === __analysisKey && roleFitContextRef.current.done) return;
    roleFitContextRef.current = { key: __analysisKey, done: true };
    try {
      const __precFit = (typeof window !== "undefined" && window.__JD_RESUME_FIT__) ? window.__JD_RESUME_FIT__ : null;
      if (!__precFit) return;
      const __precParsed = (typeof window !== "undefined" && window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object")
        ? window.__PARSED_RESUME__ : null;
      const __reBase      = String(state?.resume || "").trim();
      const __rePort      = String(state?.portfolio || "").trim();
      const __resumeText  = (__rePort ? (__reBase + "\n\n" + __rePort) : __reBase).trim();
      const __careerInterp = analysis?.preciseAnalysis?.resumeCareerInterpretation ?? null;
      const __mustGap  = buildMustRequirementsGapRisk(__precFit, __resumeText, __roleFitMatch, __jdDecomp);
      const __expGap   = buildExperienceLevelGapRisk(__precFit, __roleFitMatch);
      const __kwGap    = buildJdKeywordCoverageGapRisk(__precFit, __precParsed, __resumeText, __jdDecomp, __roleFitMatch);
      const __achGap   = buildAchievementEvidenceGapRisk(__precParsed, __careerInterp, {
        domainKeywords: __precFit?.jdModel?.domainKeywords,
        keywordBuckets: __kwGap?.raw?.keywordBuckets,
        jdText: String(state?.jd || "").trim(),
        targetRoleInPosting: String(state?.targetRoleInPosting || "").trim(),
      });
      const __gapGap   = buildGapExplanationMissingRisk(__precFit, __precParsed, __careerInterp);
      const __composite = buildCompositeRisk([__mustGap, __expGap, __achGap, __kwGap, __gapGap]);
      setAnalysis((prev) => {
        if (!prev || prev.key !== __analysisKey) return prev;
        return {
          ...prev,
          preciseAnalysis: {
            ...(prev.preciseAnalysis || {}),
            compositeRisk: __composite,
          },
        };
      });
      // ✅ PATCH (P3-1): Grounded AI explanation — fires once per analysis key after compositeRisk is ready
      if (aiGroundingRef.current.key !== __analysisKey || !aiGroundingRef.current.done) {
        aiGroundingRef.current = { key: __analysisKey, done: true };
        const __groundingReqId = `rejection-ai-grounded-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const __jdText = String(state?.jd || "").trim();
        const __compositeRiskContext = {
          summary: __composite.summary,
          topRisks: (__composite.topRisks || []).map((r) => ({
            key: r.key,
            title: r.title,
            severity: r.severity,
            summaryText: r.summaryText,
            detailText: r.detailText,
            evidence: r.evidence,
          })),
        };
        const __structuredSummaryContext = {
          careerSummary: __careerInterp?.careerSummary ?? null,
          jdProfile: __jdDecomp?.jdProfile ?? null,
          effectiveCareerSummary: __roleFitMatch?.effectiveCareerSummary ?? null,
          riskHints: __roleFitMatch?.riskHints ?? null,
        };
        const recruiterContextJobId =
          state?.preciseTargetJobTaxonomy?.jobId
          ?? state?.roleTargetTaxonomy?.jobId
          ?? null;
        const recruiterContextIndustryId =
          state?.preciseTargetIndustryResolved?.id
          ?? state?.industryTargetResolved?.id
          ?? null;
        const __recruiterReadContext = buildRecruiterReadContext({
          jobId: recruiterContextJobId,
          industryId: recruiterContextIndustryId,
        });
        (async () => {
          try {
            const __groundedTargetRole = String(state?.targetRoleInPosting || '').trim();
            const __groundedScopedJd = __pmScopeJdByTargetRole(__jdText, __groundedTargetRole);
            try {
              if (typeof window !== "undefined") {
                window.__PM_AI_SCOPED_JD_DEBUG__ = { targetRoleInPosting: __groundedTargetRole, originalLength: __jdText.length, scopedLength: __groundedScopedJd.length, scopedApplied: __groundedScopedJd.length !== __jdText.length, source: "grounded" };
              }
            } catch { }
            lastRejectionAiInputsRef.current = {
              jdText: __groundedScopedJd,
              resumeText: __resumeText,
              compositeRiskContext: __compositeRiskContext,
              structuredSummaryContext: __structuredSummaryContext,
              recruiterReadContext: __recruiterReadContext,
              groundingMode: 'grounded',
              targetRoleInPosting: __groundedTargetRole || null,
              analysisKey: __analysisKey,
            };
            const __aiResult = await runRejectionAnalysisAI({
              jdText: __groundedScopedJd,
              resumeText: __resumeText,
              requestId: __groundingReqId,
              compositeRiskContext: __compositeRiskContext,
              structuredSummaryContext: __structuredSummaryContext,
              recruiterReadContext: __recruiterReadContext,
              groundingMode: 'grounded',
              targetRoleInPosting: __groundedTargetRole || null,
            });
            if (!__aiResult) return;
            setAnalysis((prev) => {
              if (!prev || prev.key !== __analysisKey) return prev;
              return {
                ...prev,
                preciseAnalysis: {
                  ...(prev.preciseAnalysis || {}),
                  ...(__aiResult.ok && __aiResult.data ? { aiDeepAnalysis: __aiResult.data } : {}),
                  aiMeta: {
                    ok: Boolean(__aiResult.ok),
                    grounded: true,
                    groundingSource: 'compositeRisk',
                    provider: __aiResult.meta?.provider || 'openai',
                    model: __aiResult.meta?.model || 'gpt-4o-mini',
                    ms: __aiResult.meta?.ms || 0,
                    requestId: __groundingReqId,
                    ...(__aiResult.ok ? {} : { errorCode: __aiResult.error?.code || 'UNKNOWN_ERROR' }),
                  },
                },
              };
            });
          } catch (err) {
            console.warn("[P3-1] grounded AI explanation failed:", err?.message);
          }
        })();
      }
    } catch (err) {
      console.warn("[P2-1] role-fit context re-run failed:", err?.message);
    }
  }, [analysis?.key, analysis?.preciseAnalysis?.roleFitCareerMatch]);

  // ------------------------------
  // AI-only retry for rejection deep analysis
  // - 전체 분석 흐름을 다시 돌리지 않고 grounded AI 호출만 재시도한다.
  // - 마지막 P3-1 호출에 사용된 입력을 lastRejectionAiInputsRef 로 보관해두고
  //   같은 analysis.key 일 때만 머지한다. 다른 analysis 로 전환된 뒤 retry 가
  //   들어오면 staleness guard 가 무시한다.
  // - aiMeta 를 ok: undefined 로 잠깐 되돌려 UI 가 pending 카드를 그릴 수
  //   있게 한다 (deterministic compositeRisk 등 다른 필드는 그대로 둔다).
  // ------------------------------
  const handleRetryRejectionAiDeepAnalysis = React.useCallback(async () => {
    const __inputs = lastRejectionAiInputsRef.current;
    if (!__inputs || !__inputs.analysisKey) return;
    const __retryReqId = `ai-retry-${Date.now()}`;
    const __keyAtRetry = __inputs.analysisKey;
    setAnalysis((prev) => {
      if (!prev || prev.key !== __keyAtRetry) return prev;
      return {
        ...prev,
        preciseAnalysis: {
          ...(prev.preciseAnalysis || {}),
          aiMeta: {
            ok: undefined,
            grounded: true,
            groundingSource: 'compositeRisk',
            requestId: __retryReqId,
            retrying: true,
          },
        },
      };
    });
    try {
      const __aiResult = await runRejectionAnalysisAI({
        jdText: __inputs.jdText,
        resumeText: __inputs.resumeText,
        requestId: __retryReqId,
        compositeRiskContext: __inputs.compositeRiskContext,
        structuredSummaryContext: __inputs.structuredSummaryContext,
        recruiterReadContext: __inputs.recruiterReadContext,
        groundingMode: __inputs.groundingMode || 'grounded',
        targetRoleInPosting: __inputs.targetRoleInPosting,
      });
      if (!__aiResult) return;
      setAnalysis((prev) => {
        if (!prev || prev.key !== __keyAtRetry) return prev;
        return {
          ...prev,
          preciseAnalysis: {
            ...(prev.preciseAnalysis || {}),
            ...(__aiResult.ok && __aiResult.data ? { aiDeepAnalysis: __aiResult.data } : {}),
            aiMeta: {
              ok: Boolean(__aiResult.ok),
              grounded: true,
              groundingSource: 'compositeRisk',
              provider: __aiResult.meta?.provider || 'openai',
              model: __aiResult.meta?.model || 'gpt-4o-mini',
              ms: __aiResult.meta?.ms || 0,
              requestId: __retryReqId,
              retrying: false,
              ...(__aiResult.ok ? {} : { errorCode: __aiResult.error?.code || 'UNKNOWN_ERROR' }),
            },
          },
        };
      });
    } catch (err) {
      console.warn("[P3-1-retry] grounded AI explanation failed:", err?.message);
      setAnalysis((prev) => {
        if (!prev || prev.key !== __keyAtRetry) return prev;
        return {
          ...prev,
          preciseAnalysis: {
            ...(prev.preciseAnalysis || {}),
            aiMeta: {
              ok: false,
              grounded: true,
              groundingSource: 'compositeRisk',
              requestId: __retryReqId,
              retrying: false,
              errorCode: 'INTERNAL_ERROR',
            },
          },
        };
      });
    }
  }, []);

  // ------------------------------
  // Login gate + sample mode states
  // ------------------------------
  const [auth, setAuth] = useState(() => loadAuthState());
  const latestAuthRef = useRef(auth);
  const authSyncReadyRef = useRef(false);
  // 세션 조회/onAuthStateChange 1회 완료 여부만 의미합니다.
  // 분석에 필요한 모든 후속 auth-dependent restore 완료를 보장하는 플래그는 아닙니다.
  const [authSyncReady, setAuthSyncReady] = useState(false);
  useEffect(() => {
    latestAuthRef.current = auth;
  }, [auth]);
  useEffect(() => {
    authSyncReadyRef.current = authSyncReady;
  }, [authSyncReady]);
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(() => loadPendingAction());
  const [sampleMode, setSampleMode] = useState(() => loadSampleMode());
  const [sampleAnalysis, setSampleAnalysis] = useState(null);
  const activeAnalysis = sampleMode ? sampleAnalysis : analysis;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const SHOW_TOP_RIGHT_CTA = false;
  const SHOW_STEPPER_CARD = false;
  const progress = useMemo(() => {
    const idx0 = ORDER.indexOf(step);
    return ((idx0 + 1) / ORDER.length) * 100;
  }, [step]);
  const canAnalyze = useMemo(() => {
    return __canAnalyzeStateLike(state, imeDraft);
  }, [state, imeDraft]);

  const reportRef = useRef(null);
  const firstScreenRef = useRef(null);
  const basicSectionRef = useRef(null);
  const __pendingResultScrollRef = useRef(false);
  const __resultScrollBehaviorRef = useRef("smooth");

  const nav = [
    { id: SECTION.JOB, label: "기본정보", icon: FileText },
    { id: SECTION.RESUME, label: "서류", icon: FileText },
    { id: SECTION.INTERVIEW, label: "면접", icon: FileText },
    { id: SECTION.RESULT, label: "리포트", icon: Sparkles },
  ];

  const idx = ORDER.indexOf(step);
  const canNext = idx < ORDER.length - 1;

  function set(path, value) {
    const keys = path.split(".");
    setState((prev) => {
      const next = setIn(prev, keys, value);
      return next;
    });
    try { window.__DBG_PROXY_HIT__ = { at: new Date().toISOString(), from: "set", path: String(path || "") }; } catch { }
    scheduleProxyTeaser(`set:${String(path || "")}`);
  }
  // ----------------------------------------------
  // ✅ Proxy teaser (input-time lightweight)
  // ----------------------------------------------
  const __proxyTeaserTimerRef = React.useRef(null);
  const __proxyLastShownCountRef = React.useRef(0);
  const __proxyLastShownAtRef = React.useRef(0);

  function __clearProxyTeaserTimer() {
    try {
      if (__proxyTeaserTimerRef.current) clearTimeout(__proxyTeaserTimerRef.current);
      __proxyTeaserTimerRef.current = null;
    } catch { }
  }

  function __computeProxyRiskCount(s) {
    try {
      const st = (s && typeof s === "object") ? s : {};
      let n = 0;

      // 1) 근속/공백/이직
      const gapMonths = Number(st?.career?.gapMonths ?? st?.gapMonths ?? 0);
      const jobChanges = Number(st?.career?.jobChanges ?? st?.jobChanges ?? 0);
      const lastTenure = Number(st?.career?.lastTenureMonths ?? st?.lastTenureMonths ?? 0);

      if (Number.isFinite(gapMonths) && gapMonths >= 6) n += 1;
      if (Number.isFinite(jobChanges) && jobChanges >= 3) n += 1;
      if (Number.isFinite(lastTenure) && lastTenure > 0 && lastTenure <= 12) n += 1;

      // 2) 도메인/직무 전환
      const indC = String(st?.industryCandidate ?? "unknown");
      const indT = String(st?.industryTarget ?? "unknown");
      if (indC !== "unknown" && indT !== "unknown" && indC !== indT) n += 1;

      const roleC = String(st?.roleCandidate ?? "unknown");
      const roleT = String(st?.roleTarget ?? "unknown");
      if (roleC !== "unknown" && roleT !== "unknown" && roleC !== roleT) n += 1;

      // 3) JD/이력서 길이
      const jdLen = String(st?.jd ?? "").trim().length;
      const resumeLen = String(st?.resume ?? "").trim().length;
      if (jdLen > 0 && jdLen < 400) n += 1;
      if (resumeLen > 0 && resumeLen < 600) n += 1;

      return Math.max(0, Math.min(5, n));
    } catch {
      return 0;
    }
  }

  function __showProxyTeaserNow(triggerKey) {
    try {
      const c = __computeProxyRiskCount(state);
      try { window.__DBG_PROXY_C__ = { at: new Date().toISOString(), triggerKey: String(triggerKey || ""), c }; } catch { }
      try { window.__DBG_PROXY_NOW__ = { at: new Date().toISOString(), triggerKey: String(triggerKey || ""), c }; } catch { }
      if (!Number.isFinite(c) || c <= 0) return;

      const now = Date.now();
      const lastAt = Number(__proxyLastShownAtRef.current || 0);
      const lastC = Number(__proxyLastShownCountRef.current || 0);

      if (now - lastAt < 500) return;
      if (c <= lastC) return;

      __proxyLastShownAtRef.current = now;
      __proxyLastShownCountRef.current = c;

      __clearHrTeaserTimer();
      __setHrTeaser({ open: true, count: c, at: now, key: `proxy:${String(triggerKey || "")}` });

      __hrTeaserTimerRef.current = setTimeout(() => {
        try { __setHrTeaser((prev) => ({ ...(prev || {}), open: false })); } catch { }
        __hrTeaserTimerRef.current = null;
      }, 20000);
    } catch { }
  }

  function scheduleProxyTeaser(triggerKey) {
    try {
      try { window.__DBG_PROXY_SCHED__ = { at: new Date().toISOString(), triggerKey: String(triggerKey || "") }; } catch { }
      __clearProxyTeaserTimer();
      __proxyTeaserTimerRef.current = setTimeout(() => {
        __proxyTeaserTimerRef.current = null;
        __showProxyTeaserNow(triggerKey);
      }, 900);
    } catch { }
  }
  function resetAll() {
    resetState();
    __transitionLiteSelectionRef.current = null;
    setStep(SECTION.JOB);
    setActiveTab(SECTION.JOB);
    if (inputEntryMode === "transition-lite") {
      setInputEntryMode("transition-lite");
      __setTlResetKey(k => k + 1);
    } else {
      setInputEntryMode("default");
    }
    setResultEntryMode("passmap");
    setTransitionLiteResultVm(null);
    setNewgradSourceInput(null);
    setActiveExplanationRowKey(null);
    setAnalysis(null);
    setIsAnalyzing(false);
    __setResumeAttached(false);

    // AI 관련 상태도 초기화(안전)
    try {
      aiAbortRef.current?.abort?.();
    } catch {
      // ignore
    }
    aiAbortRef.current = null;

    // in-flight 추적도 초기화
    aiInFlightRef.current = { key: "", controller: null };

    setAiResult(null);
    setAiLoading(false);
    setAiError(null);
    setAiMeta(null);
    __setInputFlowUiState({
      flowStep: 1,
      roleMajorStep: "current-major",
      roleMajorSelected: "",
      currentMajorSelected: "",
    });


    aiCacheRef.current = new Map();
    aiLastCallRef.current = { key: "", at: 0 };
    analysisKeyRef.current = "";

    // 샘플 모드/샘플 분석은 "입력 덮어쓰기"가 아니라 표시만이므로, 초기화 시에는 표시도 초기화
    setSampleMode(false);
    setSampleAnalysis(null);
    saveSampleMode(false);

    toast({ title: "초기화 완료", description: "입력값을 기본값으로 되돌렸습니다." });
  }

  function resetTransitionAnalysis() {
    setState((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      company: defaultState.company,
      role: defaultState.role,
      roleTarget: defaultState.roleTarget,
      roleKscoMajor: defaultState.roleKscoMajor,
      roleKscoOfficeSub: defaultState.roleKscoOfficeSub,
      industryCurrent: defaultState.industryCurrent,
      industryCurrentSub: defaultState.industryCurrentSub,
      industryTarget: defaultState.industryTarget,
      industryTargetSub: defaultState.industryTargetSub,
      roleCurrent: defaultState.roleCurrent,
      roleCurrentSub: defaultState.roleCurrentSub,
      roleTargetSub: defaultState.roleTargetSub,
      roleMarketSub: defaultState.roleMarketSub,
      currentRole: defaultState.currentRole,
      currentRoleKscoMajor: defaultState.currentRoleKscoMajor,
      currentRoleKscoOfficeSub: defaultState.currentRoleKscoOfficeSub,
    }));
    clearTransitionLiteDraft(transitionLiteAudience);
    __transitionLiteSelectionRef.current = null;
    setTransitionLiteResultVm(null);
    setNewgradSourceInput(null);
    setActiveExplanationRowKey(null);
    setTransitionLiteEntryStep("input");
    __setTlResetKey((k) => k + 1);
    if (activeTab === SECTION.RESULT) {
      setActiveTab(SECTION.JOB);
      setResultEntryMode("passmap");
    }
    toast({ title: "분석 초기화", description: "직무·산업 분석을 다시 시작합니다." });
  }

  function resetPreciseAnalysis() {
    setState((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      jd: defaultState.jd,
      resume: defaultState.resume,
      portfolio: defaultState.portfolio,
      interviewNotes: defaultState.interviewNotes,
    }));
    setAnalysis(null);
    setIsAnalyzing(false);
    try {
      aiAbortRef.current?.abort?.();
    } catch { }
    aiAbortRef.current = null;
    aiInFlightRef.current = { key: "", controller: null };
    setAiResult(null);
    setAiLoading(false);
    setAiError(null);
    setAiMeta(null);
    aiCacheRef.current = new Map();
    aiLastCallRef.current = { key: "", at: 0 };
    analysisKeyRef.current = "";
    if (activeTab === SECTION.RESULT && resultEntryMode === "precise-analysis") {
      setActiveTab(SECTION.JOB);
      setResultEntryMode("passmap");
    }
    toast({ title: "분석 초기화", description: "서류 탈락 원인 분석을 다시 시작합니다." });
  }

  // ------------------------------
  // Login gate persistence (localStorage)
  // ------------------------------
  useEffect(() => {
    saveAuthState(auth);
  }, [auth]);

  useEffect(() => {
    savePendingAction(pendingAction);
  }, [pendingAction]);

  useEffect(() => {
    saveSampleMode(sampleMode);
  }, [sampleMode]);

  // 로그인 성공 후 "펜딩 액션" 자동 이어가기
  useEffect(() => {
    let sub = null;
    let cancelled = false;

    async function syncInitialSession() {
      try {
        const session = await getSession();
        let __sess = await getSession();

        try {
          const __code = typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("code")
            : null;

          if (!__sess && __code) {
            const { supabase } = await import("./lib/supabaseClient");
            const { data, error } = await supabase.auth.exchangeCodeForSession(__code);

            if (!error) {
              __sess = data?.session || (await getSession());

              try {
                const url = new URL(window.location.href);
                url.searchParams.delete("code");
                if (!isChatgptOAuthConsentRoute) {
                  url.searchParams.delete("state");
                }
                window.history.replaceState({}, "", url.toString());
              } catch { }
            } else {
            }
          }
        } catch (e) {
        }
        if (cancelled) return;

        if (session?.user) {
          const u = session.user;
          setAuth({
            loggedIn: true,
            user: {
              provider: u?.app_metadata?.provider || "google",
              name: u?.user_metadata?.name || u?.user_metadata?.full_name || u?.email || "사용자",
              email: u?.email || "",
            },
          });
        }
      } catch (e) {
        console.error("[AUTH] getSession failed:", e);
        // 여기서 굳이 토스트로 방해하지 않는 게 UX 안정적
      } finally {
        if (!cancelled) {
          setAuthSyncReady(true);
        }
      }
    }

    syncInitialSession();

    try {
      sub = onAuthStateChange((event, session) => {
        if (cancelled) return;
        setAuthSyncReady(true);

        if (session?.user) {
          const u = session.user;
          setAuth({
            loggedIn: true,
            user: {
              provider: u?.app_metadata?.provider || "google",
              name: u?.user_metadata?.name || u?.user_metadata?.full_name || u?.email || "사용자",
              email: u?.email || "",
            },
          });
          try {
            const __ctx = JSON.parse(sessionStorage.getItem("passmap:authReturn") || "null");
            if (__ctx?.source === "pm_mvp_view" && Date.now() - (__ctx.createdAt || 0) < 600000) {
              const __track = __ctx.track === "project" ? "project" : "weekly";
              setPmDemoView(__track);
              setJobSidebarView("resume-update");
              sessionStorage.removeItem("passmap:authReturn");
            } else if (__ctx?.source === "work_trace" && Date.now() - (__ctx.createdAt || 0) < 600000) {
              // Return to the experience-record screen after a work-trace login.
              // sourceMode is read back from the pending review by WebWorkTraceRecordPage.
              setJobSidebarView("resume-update");
              sessionStorage.removeItem("passmap:authReturn");
            }
          } catch (_) {}
        } else {
          setAuth({ loggedIn: false, user: null });
        }
      });
    } catch (e) {
      console.error("[AUTH] onAuthStateChange setup failed:", e);
    }

    return () => {
      cancelled = true;
      try {
        sub?.unsubscribe?.();
      } catch (_) { }
    };
  }, []);
  useEffect(() => {
    if (!auth?.loggedIn) return;
    if (!pendingAction || !pendingAction.type) return;

    const t = (pendingAction.type || "").toString();

    if (t === "go_report") {
      setPendingAction(null);
      setLoginOpen(false);
      // Guard: only navigate to result if there's a valid analysis result in this session.
      // Prevents stale "go_report" pendingAction from showing an empty SimulatorLayout on login.
      if (!activeAnalysis) return;
      __pendingResultScrollRef.current = true;
      __resultScrollBehaviorRef.current = "auto";
      setTimeout(() => {
        goTo(SECTION.RESULT);
      }, 0);
      return;
    }

    if (t === "open_ai_inbox") {
      setPendingAction(null);
      setLoginOpen(false);
      setActiveTab(SECTION.JOB);
      setJobSidebarView("resume-update");
      setMobileShellActive(true);
      setAiInboxOpenSignal((n) => n + 1);
      return;
    }

    if (t === "run_analysis_go_result") {
      setPendingAction(null);
      setLoginOpen(false);
      __pendingResultScrollRef.current = true;
      __resultScrollBehaviorRef.current = "auto";
      setTimeout(() => {
        requestAnalyzeOnce({ goResult: true, source: "pending_action" });
      }, 0);
      return;
    }

    // reject_analysis_run: precise-analysis auth gate → resume after login
    if (t === "reject_analysis_run") {
      setPendingAction(null);
      setLoginOpen(false);
      // Guard: block auto-run only when state has zero meaningful analysis input.
      // "미확인"/"unknown"/""/null/undefined do not count as meaningful.
      // JD or resume alone is sufficient — role/industry are optional.
      const __s = latestStateRef.current || state || {};
      const __pickStr = (...vs) => vs.map(v => String(v ?? "").trim()).find(Boolean) || "";
      const __hasMeaningful = !!(
        __pickStr(__s.resume, __s.resumeText, __s.cv, __s.resume_text) ||
        __pickStr(__s.jd, __s.jdText, __s.jobDescription, __s.job_desc) ||
        __pickStr(__s.roleTarget, __s.targetRole, __s.role, __s.jobRole) ||
        __pickStr(__s.industryTarget, __s.targetIndustry, __s.industry)
      );
      if (!__hasMeaningful) return;
      __pendingResultScrollRef.current = true;
      __resultScrollBehaviorRef.current = "auto";
      setTimeout(() => {
        requestAnalyzeOnce({ goResult: true, source: "precise_analysis" });
      }, 0);
      return;
    }

    if (t === "open_sample_report") {
      setPendingAction(null);
      setLoginOpen(false);
      __pendingResultScrollRef.current = true;
      __resultScrollBehaviorRef.current = "auto";
      setTimeout(() => {
        openSampleReport({ goResult: true });
      }, 0);
      return;
    }

    // work_record_save: return to the experience-record screen after login,
    // but only when a work-trace review is actually pending restoration.
    // (Other work_record_save callers without a pending review are unaffected.)
    if (t === "work_record_save") {
      setPendingAction(null);
      setLoginOpen(false);
      let __hasPendingReview = false;
      try {
        __hasPendingReview = !!sessionStorage.getItem("PASSMAP_PENDING_WORK_TRACE_REVIEW");
      } catch (_) {}
      if (__hasPendingReview) {
        setTimeout(() => {
          setJobSidebarView("resume-update");
        }, 0);
      }
      return;
    }
  }, [auth?.loggedIn, pendingAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // External intake auto-nav: if PASSMAP_EXTERNAL_INTAKE was written into
  // sessionStorage before the app mounted (e.g. by the Chrome selection-import
  // extension), jump straight to the work-trace recording screen so the
  // receiver in WorkTraceInput.jsx can pick up the payload immediately. We do
  // NOT clear the payload here — that is the receiver's job. One-shot via ref
  // so a re-render cannot re-navigate after the user has moved on.
  const externalIntakeAutoNavAppliedRef = useRef(false);
  useEffect(() => {
    if (externalIntakeAutoNavAppliedRef.current) return;
    if (typeof window === "undefined") return;
    let payload = null;
    try {
      const raw = sessionStorage.getItem("PASSMAP_EXTERNAL_INTAKE");
      if (!raw) return;
      payload = JSON.parse(raw);
    } catch (_) {
      return;
    }
    if (!payload || payload.version !== 1) return;
    if (payload.sourceMode !== "ai_conversation") return;
    if (typeof payload.rawText !== "string" || payload.rawText.trim().length < 30) return;
    if (typeof payload.savedAt !== "number") return;
    if (Date.now() - payload.savedAt > 60 * 60 * 1000) return;
    externalIntakeAutoNavAppliedRef.current = true;
    setActiveTab(SECTION.JOB);
    setJobSidebarView("resume-update");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push notification deeplink auto-nav: when the app opens via a weekly push
  // notification URL (?push=weekly_experience_recall&sourceMode=ai_conversation&recordDate=…),
  // write PASSMAP_PUSH_NOTIFICATION_INTAKE to sessionStorage so WebWorkTraceRecordPage
  // can resolve "ai_conversation" mode on mount, then navigate to the recording screen.
  const pushNotifAutoNavAppliedRef = useRef(false);
  useEffect(() => {
    if (pushNotifAutoNavAppliedRef.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const pushType = params.get("push");
    if (pushType !== "weekly_experience_recall" && pushType !== "test_experience_recall") return;
    if (params.get("sourceMode") !== "ai_conversation") return;
    const recordDate = params.get("recordDate") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) return;
    pushNotifAutoNavAppliedRef.current = true;
    try {
      sessionStorage.setItem(
        "PASSMAP_PUSH_NOTIFICATION_INTAKE",
        JSON.stringify({
          version: 1,
          type: "weekly_experience_recall",
          sourceMode: "ai_conversation",
          recordDate,
          source: "weekly_experience_recall_push",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          savedAt: Date.now(),
        })
      );
    } catch (_) {}
    setPendingRecordDate(recordDate);
    setPendingRecordContext(null);
    persistPassmapCalendarRecordContext(null);
    setActiveTab(SECTION.JOB);
    setJobSidebarView("resume-update");
    setMobileShellActive(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chatgptAiInboxAutoNavAppliedRef = useRef(false);
  useEffect(() => {
    if (chatgptAiInboxAutoNavAppliedRef.current) return;
    if (!isChatgptAiInboxDeeplink()) return;
    chatgptAiInboxAutoNavAppliedRef.current = true;

    setActiveTab(SECTION.JOB);
    setJobSidebarView("resume-update");
    setMobileShellActive(true);

    if (auth?.loggedIn) {
      setLoginOpen(false);
      setAiInboxOpenSignal((n) => n + 1);
      return;
    }

    setPendingAction({ type: "open_ai_inbox", meta: { source: "chatgpt_action_save_link" } });
    setAiInboxOpenSignal((n) => n + 1);
    const isLikelyMobile =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (!isLikelyMobile) {
      setLoginOpen(true);
    }
  }, [auth?.loggedIn]);

  // Screen normalization: if on RESULT tab with no renderable analysis, redirect to JOB.
  // Covers stale resultEntryMode or stale RESULT navigation with no actual data.
  useEffect(() => {
    if (activeTab !== SECTION.RESULT) return;
    if (isAnalyzing) return; // analysis in flight — result will arrive shortly
    if (sampleMode) return;  // sample report always renderable
    // Check each mode against its actual renderable data condition.
    // Mode string alone is not sufficient — stale resultEntryMode must not cause early return.
    if (resultEntryMode === "transition-lite" && transitionLiteResultVm) return;
    if (resultEntryMode === "precise-analysis" && activeAnalysis) return;
    if (activeAnalysis) return; // passmap / ReportV2 path with a valid result
    setActiveTab(SECTION.JOB);
  }, [activeTab, isAnalyzing, sampleMode, resultEntryMode, transitionLiteResultVm, activeAnalysis]); // eslint-disable-line react-hooks/exhaustive-deps

  function openLoginGate(next) {
    // next: { type: "...", meta?: {...} }
    setUserMenuOpen(false);
    setPendingAction(next || null);
    setLoginOpen(true);
  }

  function __queueResultScroll(behavior = "smooth") {
    __pendingResultScrollRef.current = true;
    if (behavior === "auto") {
      __resultScrollBehaviorRef.current = "auto";
      return;
    }
    if (__resultScrollBehaviorRef.current === "auto") return;
    __resultScrollBehaviorRef.current = "smooth";
  }

  useEffect(() => {
    if (activeTab !== SECTION.RESULT || step !== SECTION.RESULT) return;
    if (loginOpen) return;
    if (!__pendingResultScrollRef.current) return;

    const behavior = __resultScrollBehaviorRef.current || "auto";
    __pendingResultScrollRef.current = false;
    __resultScrollBehaviorRef.current = "smooth";

    const timer = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        reportRef.current?.scrollIntoView?.({ behavior, block: "start" });
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab, step, loginOpen]);

  async function doLogout() {
    try {
      await signOut();
    } catch (e) {
      console.error("[AUTH] signOut failed:", e);
    } finally {
      setAuth({ loggedIn: false, user: null });
      // Reset result screen state on logout to prevent stale "미확인" display on re-login.
      setActiveTab(SECTION.JOB);
      setAnalysis(null);
      toast("로그아웃 완료");
    }
  }

  async function doDummyLogin() {
    try {
      safeWriteLastSocialLoginProvider("google");
      // ✅ 더미 대신 Supabase Google OAuth redirect 트리거
      await signInWithGoogle();
    } catch (e) {
      console.error("[AUTH] signInWithGoogle failed:", e);
      toast({
        title: "로그인 실패 (Google)",
        description: e?.message || "설정(URL / Provider / Allow list)을 확인해주세요."
      });
    }
  }

  async function doKakaoLogin() {
    try {
      safeWriteLastSocialLoginProvider("kakao");
      await signInWithKakao();
    } catch (e) {
      console.error("[AUTH] signInWithKakao failed:", e);
      toast({
        title: "로그인 실패 (Kakao)",
        description: e?.message || "설정(URL / Provider / Allow list)을 확인해주세요."
      });
    }
  }

  async function doNaverLogin() {
    try {
      safeWriteLastSocialLoginProvider("naver");
      await signInWithNaver();
    } catch (e) {
      console.error("[AUTH] signInWithNaver failed:", e);
      toast({
        title: "로그인 실패 (Naver)",
        description: e?.message || "설정(URL / Provider / Allow list)을 확인해주세요."
      });
    }
  }

  function ensureReportGate({ actionType }) {
    if (auth?.loggedIn) return true;
    openLoginGate({ type: actionType || "go_report" });
    return false;
  }

  function __buildLatestAnalyzeStateSnapshot() {
    const merged = { ...(latestStateRef.current || state || {}) };
    const d = latestImeDraftRef.current && typeof latestImeDraftRef.current === "object"
      ? latestImeDraftRef.current
      : {};
    for (const k of Object.keys(d)) {
      const v = d[k];
      merged[k] = v === undefined || v === null ? "" : String(v);
    }
    try {
      const parsedJd = latestParsedJDRef.current && typeof latestParsedJDRef.current === "object"
        ? latestParsedJDRef.current
        : null;
      const parsedResume = latestParsedResumeRef.current && typeof latestParsedResumeRef.current === "object"
        ? latestParsedResumeRef.current
        : null;
      if (parsedJd) merged.__parsedJD = parsedJd;
      if (parsedResume) {
        merged.__parsedResume = parsedResume;
        __pmInjectCareerHistoryBridge(merged, parsedResume);
      }
    } catch (e) {
      try {
        if (typeof window !== "undefined") {
          window.__DBG_ANALYZE_ONCE = {
            ...(window.__DBG_ANALYZE_ONCE || {}),
            snapshotError: String(e?.message || e),
            snapshotErrorAt: Date.now(),
          };
        }
      } catch { }
    }
    return merged;
  }

  async function __ensureAnalyzeSessionReady() {
    // 여기서 보장하는 범위는 "세션 존재 확인 완료"까지입니다.
    // 분석은 이 값을 로그인 게이트 오케스트레이션 용도로만 사용합니다.
    if (authSyncReadyRef.current) {
      return { loggedIn: !!latestAuthRef.current?.loggedIn };
    }
    try {
      const session = await getSession();
      if (session?.user) {
        const u = session.user;
        setAuth({
          loggedIn: true,
          user: {
            provider: u?.app_metadata?.provider || "google",
            name: u?.user_metadata?.name || u?.user_metadata?.full_name || u?.email || "사용자",
            email: u?.email || "",
          },
        });
        return { loggedIn: true };
      }
      return { loggedIn: false };
    } catch (e) {
      try {
        if (typeof window !== "undefined") {
          window.__DBG_ANALYZE_ONCE = {
            ...(window.__DBG_ANALYZE_ONCE || {}),
            sessionError: String(e?.message || e),
            sessionErrorAt: Date.now(),
          };
        }
      } catch { }
      return { loggedIn: !!latestAuthRef.current?.loggedIn };
    } finally {
      setAuthSyncReady(true);
    }
  }

  async function requestAnalyzeOnce({ goResult = false, source = "manual" } = {}) {
    const nextResultMode = source === "precise_analysis" ? "precise-analysis" : "passmap";
    setResultEntryMode(nextResultMode);
    try {
      if (typeof window !== "undefined") {
        window.__DBG_ANALYZE_ONCE = {
          ...(window.__DBG_ANALYZE_ONCE || {}),
          click: {
            at: Date.now(),
            source,
            goResult,
            authSyncReady: !!authSyncReadyRef.current,
            authLoggedIn: !!latestAuthRef.current?.loggedIn,
          },
        };
      }
    } catch { }

    const snapshotState = __buildLatestAnalyzeStateSnapshot();
    try {
      if (typeof window !== "undefined") {
        const __jdText =
          String(snapshotState?.jd ?? "").trim() ||
          String(snapshotState?.jdText ?? "").trim() ||
          String(snapshotState?.jdRaw ?? "").trim();
        const __resumeText =
          String(snapshotState?.resume ?? "").trim() ||
          String(snapshotState?.resumeText ?? "").trim() ||
          String(snapshotState?.resumeRaw ?? "").trim();
        window.__PASSMAP_ANALYZE_INPUT_SNAPSHOT__ = {
          jdLen: __jdText.length,
          resumeLen: __resumeText.length,
          resumePreview: __resumeText.slice(0, 240),
          parsedResumeExists: Boolean(window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object"),
          source,
          at: Date.now(),
        };
      }
    } catch { }

    runAnalysis({ goResult, snapshotState, source });
  }

  function openSampleReport({ goResult = false } = {}) {
    setResultEntryMode("passmap");
    // 샘플 모드: 기존 사용자 입력(state/localStorage) 절대 덮어쓰기 금지
    // => SAMPLE_STATE로만 분석 생성, UI는 sampleAnalysis로만 표시
    try {

      // 1) 룰 엔진(로컬 analyzer) "최종 analyze"로 즉시 생성 → 즉시 렌더
      // ✅ 여기서 riskLayer/decisionPressure/hiddenRisk/structural까지 같이 들어옵니다.
      const base = analyze(SAMPLE_STATE, null);

      setSampleAnalysis({
        ...base,
        ai: null,
        aiMeta: null,
        aiCards: null,
        at: new Date().toISOString(),
        key: makeAiCacheKey(SAMPLE_STATE.jd, SAMPLE_STATE.resume),
      });


      setSampleMode(true);

      // 샘플은 AI 호출/표시를 하지 않음
      setAiResult(null);
      setAiLoading(false);
      setAiError(null);
      setAiMeta(null);
      setAiCardOpen(false);
      setAiAdvancedOpen(false);

      toast({ title: "샘플 리포트 준비 완료", description: "샘플 모드로 안전하게 표시합니다." });

      if (goResult) {
        goTo(SECTION.RESULT);
      }
    } catch (e) {
      console.error(e);
      toast({ title: "샘플 생성 실패", description: "콘솔 로그를 확인해 주세요.", variant: "destructive" });
    }
  }

  function clearSampleMode() {
    setSampleMode(false);
    setSampleAnalysis(null);
  }

  function shouldSkipAiCall({ jd, resume, key, manual = false } = {}) {
    try {
      // ✅ manual 호출은 길이 체크 우회(항상 시도)
      if (manual) {
        return { skip: false, reason: "" };
      }

      const jdLen = String(jd || "").trim().length;
      const resumeLen = String(resume || "").trim().length;

      const MIN_JD = 20;
      const MIN_RESUME = 20;

      if (jdLen < MIN_JD || resumeLen < MIN_RESUME) {
        return { skip: true, reason: "too_short" };
      }

      // (기존 로직 유지) 아래는 원래 있던 캐시/쿨다운/중복키/에러상태 등 판단이 있으면 그대로 두세요.
      // return { skip:false, reason:"" } 로 끝나는 구조만 유지하면 됩니다.

    } catch (e) {
      // 실패 시 스킵하지 않음(=best-effort로 AI 시도)
      return { skip: false, reason: "" };
    }

    // ✅ 기존 로직이 뒤에 더 있다면 그 흐름 유지
    return { skip: false, reason: "" };
  }

  async function requestAiEnhance({ jd, resume, key, manual = false } = {}) {
    // ✅ PATCH (append-only): ensure __key is always defined in this scope (prevent ReferenceError)
    // ✅ SAFETY (append-only): ensure identifier exists even if some stale code still references "__key"
    // ✅ SAFETY (append-only): ensure identifier exists even if some stale code still references "__key"
    const __key = (key || "").toString().trim();
    // (was duplicate) const __key = key;
    // ✅ DEBUG (append-only): wrap setAiMeta to capture exact callsite + payload
    const __dbgSetAiMeta = (meta, tag) => {
      try {
        if (typeof window !== "undefined") {
          window.__DBG_AI_META_SET__ = {
            at: Date.now(),
            tag: String(tag || ""),
            meta,
            // stack = "누가 setAiMeta를 불렀는지"를 박제
            stack: String(new Error("AI_META_SET").stack || ""),
          };
          console.error("[DBG][AI_META_SET]", window.__DBG_AI_META_SET__);
        }
      } catch { }
      return setAiMeta(meta);
    };
    const inFlight = aiInFlightRef.current;

    // 같은 key로 이미 AI 요청이 진행 중이면 중복 호출 방지 (절대 abort 금지)
    if (inFlight?.controller && inFlight.key === key) {
      return { ok: true, inFlight: true, manual };
    }

    // Abort: 다른 요청이 진행 중이면 취소 (key가 바뀐 경우에만)
    try {
      if (aiAbortRef.current && (!inFlight?.controller || inFlight.key !== key)) {
        aiAbortRef.current?.abort?.();
      }
    } catch {
      // ignore
    }
    aiAbortRef.current = null;

    // 캐시: in-memory Map
    const cached = aiCacheRef.current?.get?.(key);
    if (cached && cached.ai && typeof cached.ai === "object") {
      setAiResult(cached.ai);
      __dbgSetAiMeta(cached.meta || null, "cache_hit");
      setAiError(null);
      setAiLoading(false);

      // 현재 분석 키와 일치하면 merge
      if (analysisKeyRef.current === key) {
        setAnalysis((prev) => {
          if (!prev || prev.key !== key) return prev;
          const aiCards = buildAiCardsData(cached.ai);
          let next = { ...prev, ai: cached.ai, aiMeta: cached.meta || null, aiCards };

          // ✅ PATCH (append-only): preserve semantic matchRate even if ai object is overwritten
          try {
            const __sr =
              (typeof prev?.ai?.semanticMatches?.matchRate === "number" ? prev.ai.semanticMatches.matchRate : null) ??
              (typeof prev?.semanticMeta?.avgSimilarity === "number" ? prev.semanticMeta.avgSimilarity : null) ??
              (typeof next?.semanticMeta?.avgSimilarity === "number" ? next.semanticMeta.avgSimilarity : null);

            if (typeof __sr === "number" && Number.isFinite(__sr)) {
              if (!next.ai || typeof next.ai !== "object") next.ai = {};
              if (!next.ai.semanticMatches || typeof next.ai.semanticMatches !== "object") next.ai.semanticMatches = [];
              if (typeof next.ai.semanticMatches.matchRate !== "number") next.ai.semanticMatches.matchRate = __sr;
            }
          } catch { }
          // ✅ PATCH (fundamental, append-only): 2-pass reanalyze inside setAnalysis merge (anti-timing)
          // - 조건: AI가 matchRate를 제공했고, 1차 분석 스냅샷(prev.__passmapSnap)이 있으며,
          //         아직 이 key에 대해 재분석을 한 번도 안 했을 때만 실행
          try {
            const __k2 = (key || "").toString().trim();
            const __mr =
              (aiResp && aiResp.ai && aiResp.ai.semanticMatches && typeof aiResp.ai.semanticMatches.matchRate === "number")
                ? aiResp.ai.semanticMatches.matchRate
                : null;

            if (__k2 && typeof __mr === "number" && Number.isFinite(__mr)) {
              if (typeof window !== "undefined") {
                if (!window.__PASSMAP_AI_REANALYZE_DONE__ || typeof window.__PASSMAP_AI_REANALYZE_DONE__ !== "object") {
                  window.__PASSMAP_AI_REANALYZE_DONE__ = {};
                }
              }

              const __done =
                (typeof window !== "undefined" && window.__PASSMAP_AI_REANALYZE_DONE__ && window.__PASSMAP_AI_REANALYZE_DONE__[__k2])
                  ? true
                  : false;

              const __snap = prev && prev.__passmapSnap && typeof prev.__passmapSnap === "object" ? prev.__passmapSnap : null;
              const __snapState = __snap && __snap.state && typeof __snap.state === "object" ? __snap.state : null;
              const __snapAiLocal = __snap && __snap.aiLocal && typeof __snap.aiLocal === "object" ? __snap.aiLocal : null;

              if (!__done && __snapState) {
                // mark done first (anti-loop)
                try {
                  if (typeof window !== "undefined" && window.__PASSMAP_AI_REANALYZE_DONE__) {
                    window.__PASSMAP_AI_REANALYZE_DONE__[__k2] = { at: Date.now() };
                  }
                } catch { }

                const __aiMerged2 = {
                  ...(__snapAiLocal || {}),
                  ...(aiResp.ai || {}),
                };

                const __rerun2 = analyze(__snapState, __aiMerged2) || {};
                // ✅ PATCH (append-only): proof that reanalyze actually happened
                try {
                  if (typeof window !== "undefined") {
                    window.__PASSMAP_AI_REANALYZE_TRACE__ = {
                      at: Date.now(),
                      key: __k2,
                      matchRate: __mr,
                      rerunHasDecisionPack: !!(__rerun2 && __rerun2.decisionPack),
                      rerunMatchRate01: __rerun2?.decisionPack?.decisionScore?.meta?.matchRate01 ?? null,
                    };
                  }
                } catch { }
                // next에 rerun 결과를 overlay (append-only)
                next = {
                  ...next,
                  ...__rerun2,
                  // keep snapshot for future debugging
                  __passmapSnap: __snap,
                };
              }
            }
          } catch { }
          return next;

        });
      }

      return { ok: true, fromCache: true };
    }

    const controller = new AbortController();
    aiAbortRef.current = controller;
    aiInFlightRef.current = { key, controller };

    setAiLoading(true);
    setAiError(null);

    // meta 상태를 UI에 그대로 보여주기 위해 초기값도 넣어둠
    __dbgSetAiMeta((prev) => prev || { usedAI: false, status: "loading" }, "loading_begin");

    try {
      aiLastCallRef.current = { key, at: Date.now() };

      // ✅ 현재 분석(activeAnalysis)에서 룰 기반 힌트를 뽑아 ruleContext로 구성
      // - 구조가 프로젝트마다 조금씩 달라서, 후보 경로를 넓게 잡고 모두 안전하게 optional 처리
      const a = activeAnalysis && activeAnalysis.key === key ? activeAnalysis : null;

      const fit = a?.fitExtract || a?.base?.fitExtract || a?.result?.fitExtract || a?.analysis?.fitExtract || null;

      const ruleContext = {
        ruleRole: (fit?.role || fit?.detectedRole || "unknown").toString(),
        ruleIndustry: (fit?.industry || fit?.detectedIndustry || "unknown").toString(),

        roleSignals: Array.isArray(fit?.roleSignals)
          ? fit.roleSignals
          : Array.isArray(fit?.roleKeywords)
            ? fit.roleKeywords
            : [],

        industrySignals: Array.isArray(fit?.industrySignals)
          ? fit.industrySignals
          : Array.isArray(fit?.industryKeywords)
            ? fit.industryKeywords
            : [],

        ruleRoleConfidence: typeof fit?.roleConfidence === "number" ? fit.roleConfidence : null,
        ruleIndustryConfidence: typeof fit?.industryConfidence === "number" ? fit.industryConfidence : null,

        // (선택) analyzer 결과에 구조분석이 있으면 같이 전달
        structureAnalysis: a?.structureAnalysis ?? null,
      };

      // ✅ 여기만 변경: ruleContext를 함께 전달
      const aiResp = await fetchAiEnhance({
        jd,
        resume,
        signal: controller.signal,
        ruleContext,
      });

      if (aiResp?.ok && aiResp.ai && typeof aiResp.ai === "object") {
        const meta = aiResp.meta && typeof aiResp.meta === "object" ? aiResp.meta : null;
        // PASSMAP TRACE (P0) — requestAiEnhance success branch HIT
        try {
          const __t = {
            at: Date.now(),
            where: "requestAiEnhance:success_if",
            ok: !!aiResp?.ok,
            hasAi: !!aiResp?.ai,
            aiKeys: aiResp?.ai && typeof aiResp.ai === "object" ? Object.keys(aiResp.ai).slice(0, 30) : null,
          };
          window.__PASSMAP_TRACE_HIT__ = __t;
          window.PASSMAP_TRACE_HIT = __t; // alias
        } catch { }
        // 캐시 저장
        try {
          aiCacheRef.current.set(key, { ai: aiResp.ai, meta });
        } catch {
          // ignore
        }

        setAiResult(aiResp.ai);

        // ✅ PATCH (append-only): ensure meta.usedAI reflects actual success even when backend omits meta
        const __m =
          meta && typeof meta === "object"
            ? meta
            : { usedAI: true, status: "success" };

        const __m2 = {
          ...__m,
          usedAI: typeof __m.usedAI === "boolean" ? __m.usedAI : true,
          status: (__m.status || "success").toString(),
        };

        __dbgSetAiMeta(__m2, "success_meta");

        setAiError(null);

        // 현재 분석과 일치하면 ai 섹션만 merge
        if (analysisKeyRef.current === key) {
          setAnalysis((prev) => {
            let __saLastStage = "A_enter";
            // PASSMAP TRACE (P0) — setAnalysis callback ENTER
            try {
              const __t = {
                at: Date.now(),
                where: "setAnalysis:callback_enter",
                prevKeys: prev && typeof prev === "object" ? Object.keys(prev).slice(0, 30) : null,
              };
              window.__PASSMAP_TRACE_SETANALYSIS__ = __t;
              window.PASSMAP_TRACE_SETANALYSIS = __t; // alias
              // ✅ DEBUG SNAPSHOT (append-only): A. callback 진입 직후
              window.__DBG_SETANALYSIS_PIPE__ = window.__DBG_SETANALYSIS_PIPE__ || {};
              window.__DBG_SETANALYSIS_PIPE__.A = {
                at: Date.now(),
                stage: "A_enter",
                key,
                prevKey: prev?.key ?? null,
                hasPrevSemantic: !!prev?.semantic,
                hasPrevSemanticMatch: !!prev?.semanticMatch,
                prevSemanticMatchCount: Array.isArray(prev?.semanticMatch?.matches) ? prev.semanticMatch.matches.length : 0,
                hasPrevDecisionPack: !!prev?.decisionPack,
                hasPrevSimVM: !!(prev?.simVM || prev?.simulationViewModel || prev?.reportPack?.simVM || prev?.reportPack?.simulationViewModel),
              };
            } catch { }
            if (!prev || prev.key !== key) return prev;
            const aiCards = buildAiCardsData(aiResp.ai);
            let next = { ...prev, ai: aiResp.ai, aiMeta: meta || null, aiCards };
            __saLastStage = "B_after_ai_merge";
            try {
              // ✅ DEBUG SNAPSHOT (append-only): B. semantic 관련 데이터 병합 직후
              window.__DBG_SETANALYSIS_PIPE__ = window.__DBG_SETANALYSIS_PIPE__ || {};
              window.__DBG_SETANALYSIS_PIPE__.B = {
                at: Date.now(),
                stage: "B_after_ai_merge",
                key,
                hasSemantic: !!next?.semantic,
                hasSemanticMatch: !!next?.semanticMatch,
                semanticMatchCount: Array.isArray(next?.semanticMatch?.matches) ? next.semanticMatch.matches.length : 0,
                semanticBestCount: Array.isArray(next?.semanticMatch?.matches)
                  ? next.semanticMatch.matches.filter((m) => !!m?.best).length
                  : 0,
                semanticTotalCandidates: Array.isArray(next?.semanticMatch?.matches)
                  ? next.semanticMatch.matches.reduce((acc, m) => acc + (Array.isArray(m?.candidates) ? m.candidates.length : 0), 0)
                  : 0,
                hasDecisionPack: !!next?.decisionPack,
                hasSimVM: !!(next?.simVM || next?.simulationViewModel || next?.reportPack?.simVM || next?.reportPack?.simulationViewModel),
              };
            } catch { }

            // ✅ PATCH (fundamental, append-only): 2-pass reanalyze using prev.key + window.__PASSMAP_LAST_SNAP__
            // - avoid key mismatch (analysisKeyRef/current) by using prev.key as canonical key
            // - always emit trace (even when snap is missing)
            try {
              const __k = String(prev?.key || "").trim();
              const __mr =
                (aiResp && aiResp.ai && aiResp.ai.semanticMatches && typeof aiResp.ai.semanticMatches.matchRate === "number")
                  ? aiResp.ai.semanticMatches.matchRate
                  : null;

              if (__k && typeof __mr === "number" && Number.isFinite(__mr) && typeof window !== "undefined") {
                if (!window.__PASSMAP_AI_REANALYZE_DONE__ || typeof window.__PASSMAP_AI_REANALYZE_DONE__ !== "object") {
                  window.__PASSMAP_AI_REANALYZE_DONE__ = {};
                }

                const __already = !!window.__PASSMAP_AI_REANALYZE_DONE__[__k];

                const __snap = (window.__PASSMAP_LAST_SNAP__ && typeof window.__PASSMAP_LAST_SNAP__ === "object")
                  ? window.__PASSMAP_LAST_SNAP__
                  : null;

                const __snapState = __snap && __snap.state && typeof __snap.state === "object" ? __snap.state : null;
                const __snapAiLocal = __snap && __snap.aiLocal && typeof __snap.aiLocal === "object" ? __snap.aiLocal : null;

                if (!__already && __snapState) {
                  // mark done FIRST (anti-loop)
                  window.__PASSMAP_AI_REANALYZE_DONE__[__k] = { at: Date.now(), matchRate: __mr };

                  const __aiMerged = {
                    ...(__snapAiLocal || {}),
                    ...(aiResp.ai || {}),
                  };

                  const __rerun = analyze(__snapState, __aiMerged) || {};

                  // overlay rerun results
                  next = {
                    ...next,
                    ...__rerun,
                  };

                  // trace (proof)
                  try {
                    window.__PASSMAP_AI_REANALYZE_TRACE__ = {
                      at: Date.now(),
                      key: __k,
                      matchRate: __mr,
                      rerunHasDecisionPack: !!(__rerun && __rerun.decisionPack),
                      rerunMatchRate01: __rerun?.decisionPack?.decisionScore?.meta?.matchRate01 ?? null,
                      rerunHasMatchRate: __rerun?.decisionPack?.rejectProbability?.basis?.hasMatchRate ?? null,
                    };
                  } catch { }
                } else {
                  // trace even when skipped (already done or snap missing)
                  try {
                    window.__PASSMAP_AI_REANALYZE_TRACE__ = {
                      at: Date.now(),
                      key: __k,
                      matchRate: __mr,
                      skipped: true,
                      reason: __already ? "already_done" : (__snapState ? "unknown" : "snap_missing"),
                    };
                  } catch { }
                }
              }
            } catch (__e_sa_reanalyze) {
              // ✅ DEBUG SNAPSHOT (append-only): D. catch 진입 시 에러/스택/마지막 단계
              try {
                window.__DBG_SETANALYSIS_PIPE__ = window.__DBG_SETANALYSIS_PIPE__ || {};
                window.__DBG_SETANALYSIS_PIPE__.D = {
                  at: Date.now(),
                  stage: "D_reanalyze_catch",
                  key,
                  lastStage: __saLastStage,
                  message: __e_sa_reanalyze?.message || String(__e_sa_reanalyze || ""),
                  stack: String(__e_sa_reanalyze?.stack || ""),
                };
              } catch { }
            }

            // ✅ PATCH (append-only): keep window.__DBG_ACTIVE__ in sync with latest analysis object
            try {
              if (typeof window !== "undefined") {
                window.__DBG_ACTIVE__ = next;
                window.__DBG_ACTIVE_AT__ = Date.now();
              }
            } catch { }
            __saLastStage = "C_before_return";
            try {
              // ✅ DEBUG SNAPSHOT (append-only): C. return 직전 최종 analysis shape 핵심 키
              window.__DBG_SETANALYSIS_PIPE__ = window.__DBG_SETANALYSIS_PIPE__ || {};
              window.__DBG_SETANALYSIS_PIPE__.C = {
                at: Date.now(),
                stage: "C_before_return",
                key,
                hasSemantic: !!next?.semantic,
                hasSemanticMatchesArray: Array.isArray(next?.semantic?.matches),
                hasSemanticBest: !!next?.semantic?.best,
                semanticTotalCandidates: Number(next?.semantic?.totalCandidates ?? 0),
                hasSemanticMatch: !!next?.semanticMatch,
                semanticMatchCount: Array.isArray(next?.semanticMatch?.matches) ? next.semanticMatch.matches.length : 0,
                semanticMatchBestCount: Array.isArray(next?.semanticMatch?.matches)
                  ? next.semanticMatch.matches.filter((m) => !!m?.best).length
                  : 0,
                semanticMatchTotalCandidates: Array.isArray(next?.semanticMatch?.matches)
                  ? next.semanticMatch.matches.reduce((acc, m) => acc + (Array.isArray(m?.candidates) ? m.candidates.length : 0), 0)
                  : 0,
                hasDecisionPack: !!next?.decisionPack,
                hasSimVM: !!(next?.simVM || next?.simulationViewModel || next?.reportPack?.simVM || next?.reportPack?.simulationViewModel),
              };
            } catch { }
            return next;
          });
        }
        // ✅ PATCH (fundamental, append-only): 2-pass reanalyze after AI meta arrives (fix matchRate timing)
        // - 1st pass: runAnalysis() produces decisionPack immediately (AI may be missing at this time)
        // - 2nd pass: when AI success_meta arrives, re-run analyze() ONCE using stored snapshot + aiResp.ai
        // - prevents "matchRate01:null / hasMatchRate:false" due to timing
        try {
          const __k = (key || "").toString().trim();
          const __hasNewMatchRate =
            typeof aiResp?.ai?.semanticMatches?.matchRate === "number" &&
            Number.isFinite(aiResp.ai.semanticMatches.matchRate);

          if (__k && __hasNewMatchRate && typeof window !== "undefined") {
            if (!window.__PASSMAP_AI_REANALYZE_DONE__ || typeof window.__PASSMAP_AI_REANALYZE_DONE__ !== "object") {
              window.__PASSMAP_AI_REANALYZE_DONE__ = {};
            }

            // already done for this key? (anti-loop)
            if (!window.__PASSMAP_AI_REANALYZE_DONE__[__k]) {
              const __snapMap = window.__PASSMAP_ANALYZE_SNAP_MAP__ && typeof window.__PASSMAP_ANALYZE_SNAP_MAP__ === "object"
                ? window.__PASSMAP_ANALYZE_SNAP_MAP__
                : null;

              const __snap = __snapMap ? __snapMap[__k] : null;
              const __snapState = __snap && __snap.state && typeof __snap.state === "object" ? __snap.state : null;
              const __snapAiLocal = __snap && __snap.aiLocal && typeof __snap.aiLocal === "object" ? __snap.aiLocal : null;

              if (__snapState) {
                // mark done BEFORE reanalyze to avoid accidental loops even if something throws
                window.__PASSMAP_AI_REANALYZE_DONE__[__k] = { at: Date.now(), responseId: aiResp?.ai?.responseId || null };

                const __aiMerged = {
                  ...(__snapAiLocal || {}),
                  ...(aiResp.ai || {}),
                };

                const __rerun = analyze(__snapState, __aiMerged) || {};

                // update analysis only if still the same key (avoid race)
                if (analysisKeyRef.current === __k) {
                  setAnalysis((prev) => {
                    if (!prev || prev.key !== __k) return prev;

                    const aiCards2 = buildAiCardsData(aiResp.ai);
                    const next2 = {
                      ...prev,
                      ...__rerun,
                      key: __k,
                      ai: aiResp.ai,
                      aiMeta: meta || null,
                      aiCards: aiCards2,
                    };

                    // ✅ keep semantic matchRate stable (append-only)
                    try {
                      const __sr2 =
                        (typeof next2?.ai?.semanticMatches?.matchRate === "number" ? next2.ai.semanticMatches.matchRate : null) ??
                        (typeof prev?.ai?.semanticMatches?.matchRate === "number" ? prev.ai.semanticMatches.matchRate : null);

                      if (typeof __sr2 === "number" && Number.isFinite(__sr2)) {
                        if (!next2.ai || typeof next2.ai !== "object") next2.ai = {};
                        if (!next2.ai.semanticMatches || typeof next2.ai.semanticMatches !== "object") next2.ai.semanticMatches = [];
                        if (typeof next2.ai.semanticMatches.matchRate !== "number") next2.ai.semanticMatches.matchRate = __sr2;
                      }
                    } catch { }

                    return next2;
                  });
                }
              }
            }
          }
        } catch { }
        return { ok: true, manual };
      }

      // 실패도 meta/status로 보여주기
      const meta = aiResp?.meta && typeof aiResp.meta === "object" ? aiResp.meta : null;
      const err = aiResp?.error || "ai_bad_response";

      setAiResult(null);
      // ✅ DEBUG (append-only): preserve original error object for "__key is not defined"
      try {
        if (typeof window !== "undefined") {
          window.__DBG_AI_KEYERR__ = {
            at: Date.now(),
            where: "requestAiEnhance.error_meta",
            message: err?.message || String(err),
            stack: String(err?.stack || ""),
            name: err?.name || null,
          };
          console.error("[DBG][AI_KEYERR]", window.__DBG_AI_KEYERR__);
        }
        // ✅ DEBUG (TEMP): force throw to get the REAL origin stack for "__key is not defined"
        try {
          const __msg = String((err && err.message) ? err.message : err);
          if (__msg.includes("__key is not defined")) {
            const __e = new ReferenceError(__msg);
            // attach original (best-effort)
            try { __e.cause = err; } catch { }
            throw __e;
          }
        } catch (_) {
          // ignore
        }
      } catch { }
      __dbgSetAiMeta(meta || { usedAI: false, status: err }, "error_meta");
      setAiError(err);

      // 분석과 일치하면, ai 섹션은 비우되 meta만 반영
      if (analysisKeyRef.current === key) {
        setAnalysis((prev) => {
          if (!prev || prev.key !== key) return prev;
          return { ...prev, ai: null, aiMeta: meta || { usedAI: false, status: err }, aiCards: null };
        });
      }

      return { ok: false, manual, error: err };
    } catch (e) {
      // ✅ DEBUG (append-only): capture original thrown error (message + stack)
      try {
        if (typeof window !== "undefined") {
          window.__DBG_AI_THROWN__ = {
            at: Date.now(),
            message: e?.message || String(e),
            stack: String(e?.stack || ""),
            name: e?.name || null,
            where: "requestAiEnhance.catch",
          };
          console.error("[DBG][AI_THROWN]", window.__DBG_AI_THROWN__);
        }
      } catch { }
      try { window.__DBG_AI_ERR__ = { msg: String(e?.message || e), stack: String(e?.stack || ""), at: Date.now() }; } catch { }
      // ✅ DEBUG (append-only): capture stack for swallowed errors
      try {
        if (typeof window !== "undefined") {
          window.__DBG_AI_ERR__ = {
            at: Date.now(),
            where: "requestAiEnhance.catch",
            message: e?.message || String(e),
            stack: e?.stack || null,
            name: e?.name || null,
          };
          console.error("[DBG][AI][requestAiEnhance.catch]", window.__DBG_AI_ERR__);
        }
      } catch { }
      const err = String(e || "");
      const reason = err.includes("AbortError") || err.includes("aborted") ? "aborted" : "ai_fetch_failed";

      if (reason !== "aborted") {
        setAiResult(null);
        __dbgSetAiMeta({ usedAI: false, status: reason }, "requestAiEnhance");
        setAiError(reason);

        if (analysisKeyRef.current === key) {
          setAnalysis((prev) => {
            if (!prev || prev.key !== key) return prev;
            return { ...prev, ai: null, aiMeta: { usedAI: false, status: reason }, aiCards: null };
          });
        }
      }

      return { ok: false, manual, error: reason };
    } finally {
      setAiLoading(false);

      if (aiAbortRef.current === controller) {
        aiAbortRef.current = null;
      }

      if (aiInFlightRef.current?.controller === controller) {
        aiInFlightRef.current = { key: "", controller: null };
      }
    }
  }

  function runAnalysis({ goResult = false, snapshotState = null, source = "direct" } = {}) {
    if (isAnalyzing) return;
    const __latestState = (snapshotState && typeof snapshotState === "object")
      ? snapshotState
      : ((latestStateRef.current && typeof latestStateRef.current === "object")
        ? latestStateRef.current
        : {});
    const __latestImeDraft = latestImeDraftRef.current && typeof latestImeDraftRef.current === "object"
      ? latestImeDraftRef.current
      : {};
    const __latestParsedJD =
      (latestParsedJDRef.current && typeof latestParsedJDRef.current === "object")
        ? latestParsedJDRef.current
        : null;
    const __latestParsedResume =
      (latestParsedResumeRef.current && typeof latestParsedResumeRef.current === "object")
        ? latestParsedResumeRef.current
        : null;

    // GA4 - analysis run event (best-effort, no-throw)
    try {
      window.gtag?.("event", "run_analysis", {
        event_category: "engagement",
        event_label: "reject_analyzer",
      });
    } catch { }

    if (!__canAnalyzeStateLike(__latestState, __latestImeDraft)) {
      // ✅ PATCH (append-only): show actionable missing-field guidance instead of silent disable
      const __missing = [];
      try {
        // runAnalysis는 IME draft까지 반영한 스냅샷을 쓰므로, 여기서도 동일하게 best-effort로 합칩니다.
        const merged = { ...(__latestState || {}) };
        const d = __latestImeDraft && typeof __latestImeDraft === "object" ? __latestImeDraft : {};
        for (const k of Object.keys(d)) {
          const v = d[k];
          merged[k] = v === undefined || v === null ? "" : String(v);
        }

        // analyzer가 실제로 쓰는 키: jd/resume (alias도 허용)
        const __jd =
          String(merged?.jd ?? "").trim() ||
          String(merged?.jdText ?? "").trim() ||
          String(merged?.jdRaw ?? "").trim();

        const __resume =
          String(merged?.resume ?? "").trim() ||
          String(merged?.resumeText ?? "").trim() ||
          String(merged?.resumeRaw ?? "").trim();


        if (!__jd) __missing.push("JD를 입력해 주세요.");
        if (!__resume) __missing.push("이력서를 업로드하거나 붙여넣어 주세요.");
      } catch {
        __missing.push("JD와 이력서를 입력해 주세요.");
        __missing.push("이력서를 업로드하거나 붙여넣어 주세요.");
      }

      // ✅ PATCH (safe): only block when something is actually missing
      if (__missing.length) {
        const __desc = __missing.join(" ");

        toast({
          title: "입력 부족",
          description: __desc,
          variant: "destructive",
        });

        return;
      }

      // 여기까지 왔다는 건 alias 기준으로 JD/이력서가 둘 다 있음 → 통과
    }

    setIsAnalyzing(true);
    try {
      if (typeof window !== "undefined") {
        window.__DBG_ANALYZE_ONCE = {
          ...(window.__DBG_ANALYZE_ONCE || {}),
          analyzeBefore: {
            at: Date.now(),
            source,
            goResult,
            jdLen: String(__latestState?.jd ?? __latestState?.jdText ?? "").trim().length,
            resumeLen: String(__latestState?.resume ?? __latestState?.resumeText ?? "").trim().length,
            hasParsedJD: !!__latestParsedJD,
            hasParsedResume: !!__latestParsedResume,
            authSyncReady: !!authSyncReadyRef.current,
            authLoggedIn: !!latestAuthRef.current?.loggedIn,
          },
        };
      }
    } catch { }

    const delayMs = 350;
    window.setTimeout(async () => {
      // ✅ [PATCH] PRECISE-ANALYSIS: declare vars at callback top-level for scope access (append-only)
      // - Variables declared here are accessible throughout the callback, including setAnalysis
      let __preciseAnalysisComposite = null;
      let __preciseAnalysisError = null;
      let __aiDeepAnalysis = null;
      let __aiDeepAnalysisMeta = null;
      let __rejectionCareerCoreSignal = null;

      try {
        // ✅ 1) 룰 엔진(로컬 analyzer) "최종 analyze"로 즉시 생성 → 즉시 렌더
        // 여기서 riskLayer / decisionPressure / hiddenRisk / structural 등이 같이 생성됩니다.
        // [PATCH] IME draft flush for analysis snapshot (append-only)
        // - state가 아직 최신이 아닐 수 있어, 분석 시점에는 imeDraft를 우선 반영한 스냅샷을 사용
        const __stateForAnalyze = (() => {
          const merged = { ...(__latestState || {}) };
          const d = __latestImeDraft && typeof __latestImeDraft === "object" ? __latestImeDraft : {};
          for (const k of Object.keys(d)) {
            const v = d[k];
            merged[k] = v === undefined || v === null ? "" : String(v);
          }
          // [PATCH] alias normalize for analyzer input (append-only)
          // - analyzer는 state.jd/state.resume만 읽음
          // - UI/저장에는 jdText/resumeText로 들어올 수 있어, 분석 시점에만 안전하게 복사
          try {
            const jd = String(merged?.jd ?? "").trim();
            const jdText = String(merged?.jdText ?? "").trim();
            if (!jd && jdText) merged.jd = jdText;

            const resume = String(merged?.resume ?? "").trim();
            const resumeText = String(merged?.resumeText ?? "").trim();
            if (!resume && resumeText) merged.resume = resumeText;
            // ✅ PATCH: fallback from legacy localStorage key if v3.2 state is missing (append-only)
            // - 현재 화면 state에 jd/resume 중 하나라도 비어있을 때만, reject_analyzer_v3에서 백필
            // - 실패해도 크래시 금지
            const __jdNow = String(merged?.jd ?? "").trim();
            const __resumeNow = String(merged?.resume ?? "").trim();

            if (!__jdNow || !__resumeNow) {
              try {
                const rawV3 = localStorage.getItem("reject_analyzer_v3");
                if (rawV3) {
                  const objV3 = JSON.parse(rawV3) || {};

                  const v3jd = String(
                    objV3?.jd ??
                    objV3?.jdText ??
                    objV3?.jobDescription ??
                    objV3?.jdRaw ??
                    objV3?.jdInput ??
                    ""
                  ).trim();

                  const v3resume = String(
                    objV3?.resume ??
                    objV3?.resumeText ??
                    objV3?.cvText ??
                    objV3?.resumeRaw ??
                    objV3?.resumeInput ??
                    ""
                  ).trim();

                  if (!String(merged?.jd ?? "").trim() && v3jd) merged.jd = v3jd;
                  if (!String(merged?.resume ?? "").trim() && v3resume) merged.resume = v3resume;
                }
              } catch { }
            }
          } catch { }
          // ✅ PATCH: ensure analysis mode is explicit (append-only)
          // - UI가 아직 mode를 state에 안 넣어도, "간단 모드" 기본값으로 엔진을 태움
          // - 나중에 UI에서 mode/analysisMode/...를 넣으면 그 값을 우선
          // [PATCH] preserve selfCheck for analyzer input snapshot (append-only)
          // - selfCheck is a UI-only auxiliary signal but must reach decision engine for priority adjust
          try {
            const sc = __latestState?.selfCheck;
            if (sc && typeof sc === "object") {
              if (!merged.selfCheck || typeof merged.selfCheck !== "object") {
                merged.selfCheck = sc;
              } else {
                if (sc?.doc && !merged.selfCheck.doc) merged.selfCheck.doc = sc.doc;
                if (sc?.interview && !merged.selfCheck.interview) merged.selfCheck.interview = sc.interview;
              }
            }
          } catch { }

          // [PATCH] fill missing selfCheck axes with defaults for analyzer input (append-only)
          // - UI shows default=3 even if user didn't touch sliders; ensure analyzer sees full 6+6 axes
          try {
            const __ensureObj = (v) => (v && typeof v === "object" ? v : {});
            const __ensureAxes = (axesObj, keys, defV = 3) => {
              const a = __ensureObj(axesObj);
              for (const k of keys) {
                if (!Object.prototype.hasOwnProperty.call(a, k)) a[k] = defV;
              }
              return a;
            };

            if (!merged.selfCheck || typeof merged.selfCheck !== "object") merged.selfCheck = {};
            if (!merged.selfCheck.doc || typeof merged.selfCheck.doc !== "object") merged.selfCheck.doc = {};
            if (!merged.selfCheck.interview || typeof merged.selfCheck.interview !== "object") merged.selfCheck.interview = {};

            const __docKeys = ["logic", "roleFit", "evidence", "expression", "consistency", "tailoring"];
            const __ivKeys = ["roleFit", "orgFit", "structure", "evidence", "delivery", "environment"];

            const __docAxesNow = __ensureObj(merged.selfCheck.doc.axes);
            const __ivAxesNow = __ensureObj(merged.selfCheck.interview.axes);

            merged.selfCheck.doc.axes = __ensureAxes(__docAxesNow, __docKeys, 3);
            merged.selfCheck.interview.axes = __ensureAxes(__ivAxesNow, __ivKeys, 3);
          } catch { }
          // ✅ PATCH (append-only): preserve resolved selection objects → analyzer payload
          // - InputFlow에서 저장된 lookup resolved 결과를 명시적으로 보존
          // - __latestImeDraft loop의 String() 변환으로 object가 clobber되는 것을 방지
          // - 기존 primitive 필드는 건드리지 않음
          try {
            const __resolvedKeys = ["roleCurrentResolved", "roleTargetResolved", "industryCurrentResolved", "industryTargetResolved"];
            for (const __k of __resolvedKeys) {
              const __v = __latestState?.[__k];
              if (__v && typeof __v === "object") merged[__k] = __v;
            }
          } catch { }
          return merged;
        })();
        let base = null;
        let __semanticUnifiedOpts = null;
        try {


          // ✅ PATCH: restore single analyze() call to produce decisionPack/reportPack

          // ✅ PATCH (append-only): precompute semantic JD↔Resume matches in UI layer (async) and inject as ai.semanticSimilarity
          // - analyzer()는 sync 유지
          // - resumeModel 새로 만들지 않음: __stateForAnalyze.resume + portfolio 등 "이미 입력된 텍스트"만 합쳐서 사용
          // - 비용 상한: JD max 12 units, Resume max 120 units, topK=1
          let __aiForAnalyze = {
            semanticSimilarity: null,
            semanticMatches: {
              jdResume: {
                ok: false,
                model: null,
                jdCount: null,
                resumeCount: null,
                topK: null,
                semanticPath: "precompute_unavailable",
                displayThreshold: getSemanticDisplayThreshold("precompute"),
              },
              summary: null,
            },
          };
          // append-only: unify semantic pipeline options between precompute/background
          __semanticUnifiedOpts = null;

          // ✅ PATCH (append-only): parsed fields (P1.5) -> analyzer input
          // - parsed가 없으면 null로 들어가서 기존 로직 100% 동일
          // ✅ PATCH (append-only): parsed fields (P1.5) -> analyzer input (window-mirrored)
          try {
            if (__stateForAnalyze && typeof __stateForAnalyze === "object") {
              const __pjd =
                __latestParsedJD ||
                ((typeof window !== "undefined" && window.__PARSED_JD__ && typeof window.__PARSED_JD__ === "object")
                  ? window.__PARSED_JD__
                  : null);

              const __pres =
                __latestParsedResume ||
                ((typeof window !== "undefined" && window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object")
                  ? window.__PARSED_RESUME__
                  : null);

              __stateForAnalyze.__parsedJD = __pjd;
              __stateForAnalyze.__parsedResume = __pres;
              __pmInjectCareerHistoryBridge(__stateForAnalyze, __pres);
            }
          } catch { }
          try {
            const __jdText = String(__stateForAnalyze?.jd || "").trim();

            // "merged resume 텍스트"는 새 모델이 아니라, 이미 입력된 텍스트를 단순 합성(append-only)
            const __resumeBase = String(__stateForAnalyze?.resume || "").trim();
            const __portfolio = String(__stateForAnalyze?.portfolio || "").trim();
            const __resumeMerged =
              (__portfolio ? (__resumeBase + "\n\n" + __portfolio) : __resumeBase).trim();

            if (__jdText && __resumeMerged) {
              // ✅ PATCH (append-only): JD↔Resume local fit on [Analyze] click
              // - no analyzer touch, only compute + store
              try {
                const __targetRoleForFit = String(__stateForAnalyze?.targetRoleInPosting || "").trim();
                const __scopedJdForFit = __pmScopeJdByTargetRole(__jdText, __targetRoleForFit);
                const __fit = buildJdResumeFit({ jdText: __scopedJdForFit, resumeText: __resumeMerged });
                try { window.__JD_RESUME_FIT__ = __fit; } catch { }

                // optional: keep a simple string list for later UI
                try {
                  const __fitWarnings = Array.isArray(__fit?.warnings) ? __fit.warnings : [];
                  if (__fitWarnings.length) {
                    const prev = Array.isArray(window.__SCHEMA_PARSE_WARNINGS__) ? window.__SCHEMA_PARSE_WARNINGS__ : [];
                    const tagged = __fitWarnings.map((w) => `JD↔이력서 매칭: ${w}`);
                    // window.__SCHEMA_PARSE_WARNINGS__는 "객체 push"도 섞여있을 수 있어서 문자열만 따로 붙입니다.
                    // (안전하게 문자열만 append)
                    const onlyStr = prev.filter((x) => typeof x === "string");
                    window.__SCHEMA_PARSE_WARNINGS__ = Array.from(new Set([...onlyStr, ...tagged].filter(Boolean)));
                  }
                } catch { }
              }
              catch (e) {
                try {
                  window.__DBG_FIT_ERR__ = {
                    message: String(e && e.message ? e.message : e),
                    stack: String(e && e.stack ? e.stack : ""),
                    at: Date.now(),
                  };
                  console.error("[FIT][ERROR]", e);
                } catch { }
              }
              // ✅ PRECISE-ANALYSIS-DEBUG — phase-tracked build so silent failures surface in window debug
              // Hotfix 4 (2026-05-24): the old empty catch swallowed any builder throw, leaving
              // analysis.preciseAnalysis.compositeRisk undefined with no signal anywhere. Now every
              // builder call advances __preciseBuildPhase and any throw is captured into
              // window.__PRECISE_ANALYSIS_BUILD_ERR__ + __preciseAnalysisError so the UI can render
              // an explicit error card instead of the generic empty fallback.
              let __preciseBuildPhase = "init";
              try {
                const __precFit    = window.__JD_RESUME_FIT__;
                const __precParsed = (window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object")
                  ? window.__PARSED_RESUME__ : null;
                if (__precFit) {
                  __preciseBuildPhase = "must_requirements_gap";
                  const __mustGap = buildMustRequirementsGapRisk(__precFit, __resumeMerged);
                  __preciseBuildPhase = "experience_level_gap";
                  const __expGap  = buildExperienceLevelGapRisk(__precFit);
                  __preciseBuildPhase = "jd_keyword_coverage_gap";
                  const __kwGap   = buildJdKeywordCoverageGapRisk(__precFit, __precParsed, __resumeMerged);
                  __preciseBuildPhase = "achievement_evidence_gap";
                  const __achGap  = buildAchievementEvidenceGapRisk(__precParsed, null, {
                    domainKeywords: __precFit?.jdModel?.domainKeywords,
                    keywordBuckets: __kwGap?.raw?.keywordBuckets,
                    jdText: __jdText,
                    targetRoleInPosting: __targetRoleForFit,
                  });
                  __preciseBuildPhase = "gap_explanation_missing";
                  const __gapGap  = buildGapExplanationMissingRisk(__precFit, __precParsed);
                  __preciseBuildPhase = "composite_risk";
                  const __riskResults = [__mustGap, __expGap, __achGap, __kwGap, __gapGap];
                  const __composite   = buildCompositeRisk(__riskResults);
                  __preciseBuildPhase = "debug_snapshot";
                  window.__PRECISE_ANALYSIS_DEBUG__ = {
                    at: Date.now(),
                    riskVersion: "precise-risk-v1",
                    mustRequirementsGap:    __mustGap,
                    experienceLevelGap:     __expGap,
                    achievementEvidenceGap: __achGap,
                    jdKeywordCoverageGap:   __kwGap,
                    gapExplanationMissing:  __gapGap,
                    riskResults:            __riskResults,
                    compositeRisk:          __composite,
                    fitSummary: {
                      mustTotal: __precFit?.summary?.must_total ?? 0,
                      mustHit:   __precFit?.summary?.must_hit   ?? 0,
                      mustMiss:  __precFit?.summary?.must_miss  ?? 0,
                    },
                    mustPolicyMode: __mustGap?.raw?.mustPolicyMode ?? "raw-fit",
                    fitUnderstandingPack: __precFit?.fitUnderstandingPack ?? null,
                    aiDeepAnalysis: __aiDeepAnalysis,
                    aiMeta: __aiDeepAnalysisMeta,
                  };
                  __preciseBuildPhase = "done";
                } else {
                  __preciseBuildPhase = "skipped_no_fit";
                }
              } catch (e) {
                try {
                  const __err = {
                    at: Date.now(),
                    phase: __preciseBuildPhase,
                    message: String(e?.message ?? e),
                    stack: String(e?.stack ?? ""),
                    hasFit: Boolean(typeof window !== "undefined" && window.__JD_RESUME_FIT__),
                    hasParsedResume: Boolean(typeof window !== "undefined" && window.__PARSED_RESUME__),
                  };
                  if (typeof window !== "undefined") {
                    window.__PRECISE_ANALYSIS_BUILD_ERR__ = __err;
                  }
                  console.error("[PRECISE-ANALYSIS][BUILD-ERROR]", __err);
                  __preciseAnalysisError = "서류탈락 정밀 분석 결과를 생성하지 못했습니다.";
                } catch { }
              }
              // ✅ [PATCH] PRECISE-ANALYSIS: extract compositeRisk for UI rendering (append-only)
              // - Assign to top-level variables declared at callback start
              // - UI (PreciseAnalysisFlow) reads from analysis.preciseAnalysis.compositeRisk
              try {
                __preciseAnalysisComposite = window.__PRECISE_ANALYSIS_DEBUG__?.compositeRisk ?? null;
                // If no composite data but FIT error exists, track it for UI fallback
                if (!__preciseAnalysisComposite && !__preciseAnalysisError && window.__DBG_FIT_ERR__) {
                  __preciseAnalysisError = "JD↔이력서 정밀 매칭을 불러오지 못했습니다.";
                }
              } catch { }
              // Read-only Career Core reference signal for the rejection result UI.
              // It is stored separately from compositeRisk and never participates in scoring.
              try {
                const __careerCoreParsedResume =
                  (__stateForAnalyze?.__parsedResume && typeof __stateForAnalyze.__parsedResume === "object")
                    ? __stateForAnalyze.__parsedResume
                    : ((typeof window !== "undefined" && window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object")
                      ? window.__PARSED_RESUME__
                      : null);
                const __careerCoreHasParsedResumeData = Boolean(
                  __careerCoreParsedResume?.summary ||
                  (Array.isArray(__careerCoreParsedResume?.timeline) && __careerCoreParsedResume.timeline.length > 0) ||
                  (Array.isArray(__careerCoreParsedResume?.skills) && __careerCoreParsedResume.skills.length > 0) ||
                  (Array.isArray(__careerCoreParsedResume?.achievements) && __careerCoreParsedResume.achievements.length > 0) ||
                  (Array.isArray(__careerCoreParsedResume?.projects) && __careerCoreParsedResume.projects.length > 0)
                );
                const __careerCoreResumeProfile = __careerCoreHasParsedResumeData
                  ? buildResumeProfileFromParsedResume({
                    parsedResume: __careerCoreParsedResume,
                    rawText: __resumeMerged,
                    sourceLabel: "서류탈락 분석 이력서",
                  })
                  : null;
                const __careerCoreTargetIndustry =
                  __stateForAnalyze?.industryTarget ||
                  __stateForAnalyze?.targetIndustry ||
                  __stateForAnalyze?.industry ||
                  __stateForAnalyze?.preciseTargetIndustryResolved?.label ||
                  __stateForAnalyze?.preciseTargetIndustryResolved?.sub ||
                  null;
                __rejectionCareerCoreSignal = buildRejectionCareerCoreSignal({
                  resumeProfile: __careerCoreResumeProfile,
                  jdText: __jdText,
                  fit: (typeof window !== "undefined" && window.__JD_RESUME_FIT__) ? window.__JD_RESUME_FIT__ : null,
                  targetRole:
                    __stateForAnalyze?.targetRoleInPosting ||
                    __stateForAnalyze?.roleTarget ||
                    __stateForAnalyze?.targetRole ||
                    null,
                  targetCompany: __stateForAnalyze?.companyTarget || __stateForAnalyze?.company || null,
                  targetIndustry: __careerCoreTargetIndustry,
                  currentDate: new Date().toISOString().slice(0, 10),
                });
              } catch {
                __rejectionCareerCoreSignal = null;
              }
              // ✅ PATCH (append-only): jdModel 기반 structured JD units 브리지
              // - __fit은 try{} 스코프 밖 — window.__JD_RESUME_FIT__으로 접근
              // - jdModel 없으면 undefined → semanticMatchJDResume 내부 raw split fallback 유지
              const __jdUnits = (() => {
                try {
                  const __m = __fit?.jdModel || window.__JD_RESUME_FIT__?.jdModel;
                  if (!__m) return undefined;
                  return [
                    ...(__m.mustHave || []),
                    ...(__m.sections?.requiredLines || []),
                    ...(__m.responsibilities || []),
                  ].filter(Boolean);
                } catch {
                  return undefined;
                }
              })();
              const __sem = await semanticMatchJDResume(__jdText, __resumeMerged, {
                maxJdUnits: 12,
                maxResumeUnits: 120,
                topK: 1,
                concurrency: 3,
                device: "cpu",
                dtype: "q8",
                useLocalStorageCache: true,
                jdUnits: __jdUnits,
              });
              __semanticUnifiedOpts = {
                maxJdUnits: 12,
                maxResumeUnits: 120,
                topK: 1,
                concurrency: 3,
                device: "cpu",
                dtype: "q8",
                useLocalStorageCache: true,
                jdUnits: Array.isArray(__jdUnits) ? __jdUnits.slice(0, 12) : undefined,
              };
              __aiForAnalyze = {
                ...__aiForAnalyze,
                semanticMatches: {
                  ...((__aiForAnalyze?.semanticMatches && typeof __aiForAnalyze.semanticMatches === "object")
                    ? __aiForAnalyze.semanticMatches
                    : {}),
                  jdResume: {
                    ok: Boolean(__sem?.ok),
                    model: __sem?.model || null,
                    jdCount: __sem?.jdCount ?? null,
                    resumeCount: __sem?.resumeCount ?? null,
                    topK: __sem?.topK ?? null,
                    semanticPath: "precompute",
                    displayThreshold: getSemanticDisplayThreshold("precompute"),
                  },
                  summary: (__sem?.summary && typeof __sem.summary === "object")
                    ? __sem.summary
                    : null,
                },
              };

              try {
                // jd unit -> score 맵 (정규화 키)
                const __norm = (s) =>
                  String(s || "")
                    .replace(/\u00A0/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .toLowerCase();

                const __scoreMap = new Map();
                if (__sem && __sem.ok && Array.isArray(__sem.matches)) {
                  for (const m of __sem.matches) {
                    const k = __norm(m?.jd);
                    const sc = Number(m?.best?.score);
                    if (!k) continue;
                    if (Number.isFinite(sc)) __scoreMap.set(k, sc);
                  }
                }

                // analyzer.js가 이미 탐지하는 경로: ai.semanticSimilarity (function)
                __aiForAnalyze = {
                  ...__aiForAnalyze,
                  semanticSimilarity: (jdLine /* , resumeText */) => {
                    const k = __norm(jdLine);
                    if (!k) return null;
                    const v = __scoreMap.get(k);
                    return (typeof v === "number" && Number.isFinite(v)) ? v : null;
                  },
                };
              } catch { }
            }
          } catch {
            // PATCH R82 (append-only): preserve semantic handoff skeleton on precompute failure
            __aiForAnalyze =
              (__aiForAnalyze && typeof __aiForAnalyze === "object")
                ? {
                  ...__aiForAnalyze,
                  semanticMatches: {
                    ...((__aiForAnalyze.semanticMatches && typeof __aiForAnalyze.semanticMatches === "object")
                      ? __aiForAnalyze.semanticMatches
                      : {}),
                    jdResume: {
                      ...((__aiForAnalyze?.semanticMatches?.jdResume && typeof __aiForAnalyze.semanticMatches.jdResume === "object")
                        ? __aiForAnalyze.semanticMatches.jdResume
                        : {}),
                      semanticPath: String(__aiForAnalyze?.semanticMatches?.jdResume?.semanticPath || "precompute_failed_preserved"),
                      displayThreshold: getSemanticDisplayThreshold("precompute"),
                    },
                  },
                }
                : {
                  semanticSimilarity: null,
                  semanticMatches: {
                    jdResume: {
                      ok: false,
                      model: null,
                      jdCount: null,
                      resumeCount: null,
                      topK: null,
                      semanticPath: "precompute_failed_preserved",
                      displayThreshold: getSemanticDisplayThreshold("precompute"),
                    },
                    summary: null,
                  },
                };
          }
          // ✅ P1.5 (append-only): parsed mirror re-inject RIGHT BEFORE analyze()
          // - runAnalysis 클로저/스코프 이슈로 parsed가 누락되는 케이스를 막기 위한 안전 주입
          try {
            const __wJd =
              __latestParsedJD ||
              ((window && window.__PARSED_JD__ && typeof window.__PARSED_JD__ === "object")
                ? window.__PARSED_JD__
                : null);

            const __wResume =
              __latestParsedResume ||
              ((window && window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object")
                ? window.__PARSED_RESUME__
                : null);

            if (__stateForAnalyze && typeof __stateForAnalyze === "object") {
              // 기존 값이 있으면 덮어쓰지 않음(append-only / 보수적)
              if (!__stateForAnalyze.__parsedJD && __wJd) __stateForAnalyze.__parsedJD = __wJd;
              if (!__stateForAnalyze.__parsedResume && __wResume) __stateForAnalyze.__parsedResume = __wResume;
              __pmInjectCareerHistoryBridge(__stateForAnalyze, __stateForAnalyze.__parsedResume || __wResume);
            }
          } catch { }
          // ✅ PATCH (append-only): store last analysis snapshot for 2-pass reanalyze after AI meta arrives
          // - AI 결과(aiResp.ai)는 requestAiEnhance에서 "나중에" 도착할 수 있으므로,
          //   analyze 시점의 입력 스냅샷을 key 기준으로 보관해 두었다가 success_meta 시 1회 재분석한다.
          try {
            const __snapKey = String((analysisKeyRef && analysisKeyRef.current) ? analysisKeyRef.current : "").trim();
            if (__snapKey && typeof window !== "undefined") {
              if (!window.__PASSMAP_ANALYZE_SNAP_MAP__ || typeof window.__PASSMAP_ANALYZE_SNAP_MAP__ !== "object") {
                window.__PASSMAP_ANALYZE_SNAP_MAP__ = {};
              }
              window.__PASSMAP_ANALYZE_SNAP_MAP__[__snapKey] = {
                at: Date.now(),
                state: __stateForAnalyze,
                aiLocal: __aiForAnalyze,
              };
            }
          } catch { }
          // ✅ PATCH (fundamental, append-only): always store LAST snapshot for AI 2-pass reanalyze
          // - do NOT depend on analysisKeyRef timing
          try {
            if (typeof window !== "undefined") {
              window.__PASSMAP_LAST_SNAP__ = {
                at: Date.now(),
                state: __stateForAnalyze,
                aiLocal: __aiForAnalyze,
              };
            }
          } catch { }
          base = analyze(__stateForAnalyze, __aiForAnalyze) || {};
          // ✅ PATCH (fundamental, append-only): embed analysis snapshot into base for 2-pass reanalyze
          // - requestAiEnhance(success)에서 setAnalysis merge 시점에 prev.__passmapSnap을 읽어 재분석한다.
          // - key/전역 타이밍 의존 제거
          try {
            if (base && typeof base === "object") {
              base.__passmapSnap = {
                at: Date.now(),
                state: __stateForAnalyze,
                aiLocal: __aiForAnalyze,
              };
            }
          } catch { }
          // ✅ TMP_DEBUG: parsed state visibility check (REMOVE AFTER FIX)
          try {
            window.__DBG_PARSED_SNAP__ = "HIT_" + new Date().toISOString();

            try {
              const jdIsObj = !!(__latestParsedJD && typeof __latestParsedJD === "object");
              const resumeIsObj = !!(__latestParsedResume && typeof __latestParsedResume === "object");

              window.__DBG_PARSED_SNAP__ = {
                jdType: typeof __latestParsedJD,
                resumeType: typeof __latestParsedResume,
                jdIsObj,
                resumeIsObj,
                jdKeys: jdIsObj ? Object.keys(__latestParsedJD) : null,
                resumeKeys: resumeIsObj ? Object.keys(__latestParsedResume) : null,
              };
              window.__DBG_PARSED_SNAP_ERR__ = null;
            } catch (e) {
              try { window.__DBG_PARSED_SNAP_ERR__ = "INNER_" + String(e?.message || e); } catch { }
            }
          } catch (e) {
            try { window.__DBG_PARSED_SNAP_ERR__ = "OUTER_" + String(e?.message || e); } catch { }
          }
          maybeShowHiddenRiskTeaser("run_analysis", base);


          // normalize just in case
          if (!base || typeof base !== "object") base = {};
          // ✅ PATCH (append-only): expose latest analysis snapshot for console debugging
          // - window.__DBG_ACTIVE__가 없으면 dev/튜닝이 막히므로, runAnalysis에서 최신 base를 best-effort로 연결
          // - 실패해도 앱은 계속 동작해야 하므로 try/catch
          try {
            if (typeof window !== "undefined") {
              // ✅ PATCH (append-only): attach input state snapshot for console debugging
              // - analyze 결과(base)에 state가 없어서 디버깅이 불가하므로, best-effort로만 붙임
              try {
                base = base || {};
                base.state = __stateForAnalyze || null;
              } catch { }
              window.__DBG_ACTIVE__ = base || null;
            }
          } catch { }
        } catch (e) {

          try { window.__DBG_ANALYZE_THROW__ = { msg: String(e?.message || e), at: new Date().toISOString() }; } catch { }
          throw e;
        }
        // analyze(__stateForAnalyze, null); // [PATCH] disable duplicate call (can break downstream steps like semantic)
        // analyze(__stateForAnalyze, null); // [PATCH] removed duplicate call (it can break downstream steps like semantic)
        try {
          const sc = __stateForAnalyze?.salaryCurrent;
          const st = __stateForAnalyze?.salaryTarget;
          const cur = Number(String(sc || "").replace(/[^0-9.]/g, ""));
          const exp = Number(String(st || "").replace(/[^0-9.]/g, ""));
          const ratio = cur > 0 && exp > 0 ? exp / cur : null;
          const diff = cur > 0 && exp > 0 ? exp - cur : null;
        } catch { }

        try {
          const rr = base?.decisionPack?.riskResults;
          // debug globals (__DBG_BASE__/__DBG_DECISIONPACK__) disabled

          const gates = Array.isArray(rr)
            ? rr.filter(r => r?.layer === "gate").map(r => ({ id: r?.id, pr: r?.priority, score: r?.score }))
            : null;


        } catch { }


        const key = makeAiCacheKey(__stateForAnalyze.jd, __stateForAnalyze.resume);
        analysisKeyRef.current = key;
        const __analysisNext = {
          ...base,
          ai: null,
          aiMeta: null,
          aiCards: null,
          at: new Date().toISOString(),
          key,
          // Hotfix 4 (2026-05-24): always emit preciseAnalysis so the result tab can distinguish
          // "still loading" from "build failed silently". Previously the 3rd branch ({}) dropped
          // the key entirely when both composite and error were falsy, leaving the empty-result
          // fallback as the only signal. Now a missing composite always carries an error message
          // (synthesizing one from window.__PRECISE_ANALYSIS_BUILD_ERR__ when needed) so the
          // PreciseAnalysisFlow error card can render with a debuggable hint.
          preciseAnalysis: (() => {
            const __hasComposite = typeof __preciseAnalysisComposite === "object" && __preciseAnalysisComposite;
            const __buildErr = (typeof window !== "undefined" && window.__PRECISE_ANALYSIS_BUILD_ERR__) || null;
            const __resolvedError = __hasComposite
              ? null
              : (__preciseAnalysisError
                || (__buildErr ? "서류탈락 정밀 분석 결과를 생성하지 못했습니다." : null));
            return {
              compositeRisk: __hasComposite ? __preciseAnalysisComposite : null,
              ...(__resolvedError ? { error: __resolvedError } : {}),
              ...(__hasComposite && typeof __aiDeepAnalysis === "object" && __aiDeepAnalysis
                ? { aiDeepAnalysis: __aiDeepAnalysis }
                : {}),
              // ✅ PATCH (append-only): initialize aiMeta to "pending" state so pending UI shows
              // - AI result will arrive asynchronously and update this via setAnalysis
              // - Initial state indicates AI analysis is in flight (ok: undefined, not false)
              aiMeta: __aiDeepAnalysisMeta ? __aiDeepAnalysisMeta : { ok: undefined },
              // ✅ PATCH (append-only, P1-A): resume career interpretation slot; populated async
              resumeCareerInterpretation: null,
              // ✅ PATCH (append-only, P1-B): JD requirement decomposition slot; populated async
              jdRequirementDecomposition: null,
              // ✅ PATCH (append-only, P1-C): role-fit career match slot; populated via useEffect after P1-A+P1-B ready
              roleFitCareerMatch: null,
              // Read-only Career Core v0 reference signal; not used by rejection scoring.
              careerCoreSignal: __rejectionCareerCoreSignal,
            };
          })(),
        };
        // analysis key snapshot (disabled)
        setAnalysis((prev) => {
          const next = {
            ...(prev || {}),
            ...__analysisNext,
          };

          // expose latest analysis snapshot
          try {
            if (typeof window !== "undefined") {
              window.__DBG_BASE__ = base || null;
              window.__DBG_ANALYSIS_NEXT__ = next || null;
              window.__DBG_ANALYSIS__ = next;
            }
          } catch { }

          return next;
        });
        try {
          void saveAnalysisRun({
            state: __stateForAnalyze,
            analysis: {
              ...(analysis || {}),
              ...__analysisNext,
            },
            source,
            analysisKey: key,
            authSnapshot: latestAuthRef.current,
          }).catch((err) => {
            console.warn("[PASSMAP][saveAnalysisRun] failed:", err?.message || err);
          });
        } catch (err) {
          console.warn("[PASSMAP][saveAnalysisRun] failed:", err?.message || err);
        }

        // ✅ PATCH (B4: raw AI 호출 제거 / grounded 통일)
        // - 기존 P0 raw fire-and-forget AI 호출(this block)을 제거한다.
        // - 분석 결과가 매번 흔들리던 원인 중 하나는 raw AI 가 P3-1 grounded 보다
        //   먼저 도착해 잠깐 표시되거나, deterministic 결과를 독립적으로 다시
        //   판단하던 데 있었다. 이제 AI 심화 해석은 compositeRiskContext 가
        //   준비된 P3-1 grounded 호출(아래 role-fit 후속 useEffect) 한 곳에서만
        //   발사한다.
        // - aiMeta pending 초기화(__aiDeepAnalysisMeta 또는 { ok: undefined })는
        //   위 setAnalysis 단계에서 이미 들어가 있어, UI 는 그 시점부터 pending
        //   카드를 그릴 수 있다.

        // ✅ PATCH (append-only, P1-A): Fire-and-forget resume career interpreter
        // - Pure resume structuring; no JD comparison, no engine connection
        // - Result merged into preciseAnalysis.resumeCareerInterpretation via stale-safe setAnalysis
        (async () => {
          const __careerKey = key;
          const __cResumeBase = String(__stateForAnalyze?.resume || "").trim();
          const __cPortfolio = String(__stateForAnalyze?.portfolio || "").trim();
          const __cResumeText = (__cPortfolio ? (__cResumeBase + "\n\n" + __cPortfolio) : __cResumeBase).trim();
          const __cParsedResume = (typeof window !== "undefined" && window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object")
            ? window.__PARSED_RESUME__ : null;
          const __cTargetRole = __stateForAnalyze?.roleTarget || __stateForAnalyze?.targetRole || null;

          if (!__cResumeText) return;
          try {
            const __careerResult = await runResumeCareerInterpreterAI({
              resumeText: __cResumeText,
              parsedResume: __cParsedResume,
              targetRole: __cTargetRole,
            });
            if (!__careerResult) return;

            setAnalysis((prev) => {
              if (!prev || prev.key !== __careerKey) return prev;
              return {
                ...prev,
                preciseAnalysis: {
                  ...(prev.preciseAnalysis || {}),
                  resumeCareerInterpretation: __careerResult,
                },
              };
            });
          } catch (err) {
            console.warn('[CAREER-AI] interpreter failed:', err?.message);
          }
        })();

        // ✅ PATCH (append-only, P1-B): Fire-and-forget JD requirement decomposer
        // - Pure JD structuring; no resume comparison, no engine connection
        // - Result merged into preciseAnalysis.jdRequirementDecomposition via stale-safe setAnalysis
        (async () => {
          const __jdKey = key;
          const __jdText = String(__stateForAnalyze?.jd || "").trim();
          if (!__jdText) return;

          const __targetRoleForDecomp = String(__stateForAnalyze?.targetRoleInPosting || "").trim();
          const __scopedJdForDecomp = __pmScopeJdByTargetRole(__jdText, __targetRoleForDecomp);

          const __compactJdModel = (typeof window !== "undefined" && window.__JD_RESUME_FIT__?.jdModel)
            ? {
                mustHave: window.__JD_RESUME_FIT__.jdModel.mustHave || [],
                responsibilities: window.__JD_RESUME_FIT__.jdModel.responsibilities || [],
                preferred: window.__JD_RESUME_FIT__.jdModel.preferred || [],
                domainKeywords: window.__JD_RESUME_FIT__.jdModel.domainKeywords || [],
                tools: window.__JD_RESUME_FIT__.jdModel.tools || [],
              }
            : null;
          const __parsedJD = (typeof window !== "undefined" && window.__PARSED_JD__) ? window.__PARSED_JD__ : null;
          const __jdDecompRequestId = `jd-decomp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

          try {
            const __jdDecompResult = await runJdRequirementDecomposerAI({
              jdText: __scopedJdForDecomp,
              compactJdModel: __compactJdModel,
              parsedJD: __parsedJD,
              requestId: __jdDecompRequestId,
            });
            if (!__jdDecompResult) return;

            setAnalysis((prev) => {
              if (!prev || prev.key !== __jdKey) return prev;
              return {
                ...prev,
                preciseAnalysis: {
                  ...(prev.preciseAnalysis || {}),
                  ...(__jdDecompResult.ok && __jdDecompResult.data
                    ? { jdRequirementDecomposition: __jdDecompResult.data }
                    : {}),
                  jdRequirementDecompositionMeta: {
                    ok: Boolean(__jdDecompResult.ok),
                    ms: __jdDecompResult.meta?.ms || 0,
                    requestId: __jdDecompRequestId,
                    ...(__jdDecompResult.ok ? {} : { errorCode: __jdDecompResult.error?.code || 'UNKNOWN_ERROR' }),
                  },
                },
              };
            });
          } catch (err) {
            try {
              setAnalysis((prev) => {
                if (!prev || prev.key !== __jdKey) return prev;
                return {
                  ...prev,
                  preciseAnalysis: {
                    ...(prev.preciseAnalysis || {}),
                    jdRequirementDecompositionMeta: { ok: false, ms: 0, requestId: __jdDecompRequestId, errorCode: 'INTERNAL_ERROR' },
                  },
                };
              });
            } catch { }
          }
        })();

        // ✅ PATCH: semantic(embedding) JD↔Resume matching (background, append-only)
        // - 배포 사용자도 사용 가능(브라우저 내 임베딩)
        // - 실패/타임아웃 시에도 앱이 죽지 않도록 "조용히 폴백"
        // - 번들 증가 최소화를 위해 dynamic import로 "분석 실행할 때만" 로드
        // semantic trace snapshot
        try {
          if (typeof window !== "undefined") {
            window.__DBG_SEMANTIC_LAST__ = {
              phase: "start",
              key: key,
              jdLen: String(__stateForAnalyze?.jd ?? "").length,
              resumeLen: String(__stateForAnalyze?.resume ?? "").length,
              at: new Date().toISOString(),
            };
          }
        } catch { }
        (async () => {
          const __key = key;
          const __jd = (__stateForAnalyze?.jd ?? "").toString();
          const __resume = (__stateForAnalyze?.resume ?? "").toString();
          const __cacheSet = (semanticMatch, semanticMeta) => {
            try {
              const m = semanticCacheRef.current;
              m.set(key, { semanticMatch, semanticMeta });
              // 간단 prune (최대 30개)
              if (m.size > 30) {
                const firstKey = m.keys().next().value;
                m.delete(firstKey);
              }
            } catch {
              // ignore
            }
          };

          // 입력이 너무 짧으면 스킵

          if (__jd.trim().length < 20 || __resume.trim().length < 20) {
            try {
              if (typeof window !== "undefined") {
                window.__DBG_SEMANTIC__ = { ...(window.__DBG_SEMANTIC__ || {}), phase: "skipped:short_input", at: new Date().toISOString() };
              }
            } catch { }
            // semantic skipped due to short input
            try {
              if (typeof window !== "undefined") {
                window.__DBG_SEMANTIC_LAST__ = {
                  ...(window.__DBG_SEMANTIC_LAST__ || {}),
                  phase: "skipped:short_input",
                  at: new Date().toISOString(),
                };
              }
            } catch { }
            __cacheSet(null, { ok: false, status: "skipped:short_input" });
            setAnalysis((prev) => {
              if (!prev || prev.key !== key) return prev;

              const next = {
                ...prev,
                semanticMatch: null,
                semanticMeta: { ok: false, status: "skipped:short_input" },
              };

              // keep __DBG_ACTIVE__ in sync
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_ANALYSIS__ = next;
                }
              } catch { }

              return next;
            });
            return;
          }

          const __timeoutMs = 7000;

          try {
            const mod = await import("./lib/semantic/match.js");
            const fn = mod?.semanticMatchJDResume;
            try {
              if (typeof window !== "undefined") {
                window.__DBG_SEMANTIC__ = { ...(window.__DBG_SEMANTIC__ || {}), phase: "imported", at: new Date().toISOString() };
              }
            } catch { }
            if (typeof fn !== "function") throw new Error("semanticMatchJDResume_not_found");
            const __semanticBackgroundTopK = 1;
            const __backgroundJdUnits = (() => {
              const __base = Array.isArray(__semanticUnifiedOpts?.jdUnits)
                ? __semanticUnifiedOpts.jdUnits.filter(Boolean)
                : [];
              if (__base.length !== 1) return __base.length ? __base : undefined;

              const __norm = (s) =>
                String(s || "")
                  .replace(/\u00A0/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .toLowerCase();
              const __seen = new Set(__base.map(__norm).filter(Boolean));
              const __extraRaw = splitToUnits(__jd, { maxUnits: 10, isJd: true });
              const __extra = [];

              for (const line of __extraRaw) {
                const t = String(line || "").trim();
                if (!t) continue;
                if (t.length < 20) continue;
                if (/^(담당업무|주요업무|자격요건|우대사항|requirements|responsibilities|preferred)\:?$/i.test(t)) continue;
                const k = __norm(t);
                if (!k || __seen.has(k)) continue;
                __seen.add(k);
                __extra.push(t);
                if (__extra.length >= 2) break;
              }

              return [...__base, ...__extra].slice(0, 3);
            })();

            const p = fn(__jd, __resume, {
              ...(__semanticUnifiedOpts || {}),
              jdUnits: __backgroundJdUnits,
              topK: __semanticBackgroundTopK,
              maxJdUnits: (__semanticUnifiedOpts?.maxJdUnits ?? 12),
              maxResumeUnits: (__semanticUnifiedOpts?.maxResumeUnits ?? 120),
              concurrency: (__semanticUnifiedOpts?.concurrency ?? 3),
              useLocalStorageCache: (__semanticUnifiedOpts?.useLocalStorageCache ?? true),
              device: (__semanticUnifiedOpts?.device ?? "cpu"),
              dtype: (__semanticUnifiedOpts?.dtype ?? "q8"),
            });
            try {
              if (typeof window !== "undefined") {
                window.__DBG_SEMANTIC__ = { ...(window.__DBG_SEMANTIC__ || {}), phase: "running", at: new Date().toISOString() };
              }
            } catch { }
            const out = await Promise.race([
              p,
              new Promise((_, reject) =>
                window.setTimeout(() => reject(new Error("semantic_timeout")), __timeoutMs)
              ),
            ]);

            // 최신 분석 key가 바뀌었으면 결과 무시
            if (analysisKeyRef.current !== key) {
              // semantic ignored due to key mismatch
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_SEMANTIC_LAST__ = {
                    ...(window.__DBG_SEMANTIC_LAST__ || {}),
                    phase: "ignored:key_mismatch",
                    cur: analysisKeyRef.current,
                    at: new Date().toISOString(),
                  };
                }
              } catch { }
              return;
            }
            // ✅ PATCH (append-only): compute avgSimilarity + map to ai.semanticMatches.matchRate
            const __avgFromOut = (() => {
              const toNum01 = (v) => {
                try {
                  if (v === undefined || v === null) return null;

                  let n = v;
                  if (typeof n === "string") {
                    const s = n.trim();
                    if (!s) return null;
                    const cleaned = s.replace(/[^0-9.\-]/g, "");
                    if (!cleaned) return null;
                    n = Number(cleaned);
                  }

                  if (typeof n !== "number" || !Number.isFinite(n)) return null;

                  // percent heuristic
                  if (n > 1.2 && n <= 100) n = n / 100;

                  return Math.max(0, Math.min(1, n));
                } catch {
                  return null;
                }
              };

              try {
                const ms = out?.matches;
                if (!Array.isArray(ms) || ms.length === 0) return null;

                const nums = ms
                  .map((m) => {
                    // ✅ current match.js output shape: { jd, candidates: [...], best: { text, score } }
                    const bestScore = m?.best?.score;
                    if (bestScore !== undefined && bestScore !== null) return toNum01(bestScore);

                    // fallback: max candidate score
                    const cs = Array.isArray(m?.candidates) ? m.candidates : null;
                    if (cs && cs.length) {
                      let max = null;
                      for (const c of cs) {
                        const s = toNum01(c?.score);
                        if (typeof s === "number" && (max === null || s > max)) max = s;
                      }
                      return max;
                    }

                    // legacy fallbacks (append-only)
                    const legacy = m?.similarity ?? m?.score ?? m?.sim ?? null;
                    return toNum01(legacy);
                  })
                  .filter((v) => typeof v === "number" && Number.isFinite(v));

                if (nums.length === 0) return null;

                const sum = nums.reduce((a, b) => a + b, 0);
                const avg = sum / nums.length;
                return toNum01(avg);
              } catch {
                return null;
              }
            })();

            const __metaOk = {
              ok: true,
              status: "ok",
              at: new Date().toISOString(),
              // append-only meta fields
              avgSimilarity: __avgFromOut,
              matchedCount: Array.isArray(out?.matches) ? out.matches.length : null,
              semanticPath: "background",
              displayThreshold: getSemanticDisplayThreshold("background"),
            };

            // ✅ SUCCESS finalize (append-only): cache + setAnalysis + mapping
            __cacheSet(out, __metaOk);

            setAnalysis((prev) => {
              if (!prev || prev.key !== key) return prev;

              const next = {
                ...prev,
                semanticMatch: out,
                semanticMeta: __metaOk,
              };

              // ✅ 3-B (append-only): meta.avgSimilarity -> next.ai.semanticMatches.matchRate
              try {
                const avg = typeof __metaOk?.avgSimilarity === "number" ? __metaOk.avgSimilarity : null;
                if (avg !== null) {
                  if (!next.ai || typeof next.ai !== "object") next.ai = {};
                  // ai.semanticMatches는 배열일 수도 있음(기존 UI). 배열이어도 속성 추가 가능.
                  if (!next.ai.semanticMatches) next.ai.semanticMatches = [];
                  if (typeof next.ai.semanticMatches !== "object") next.ai.semanticMatches = [];
                  if (typeof next.ai.semanticMatches.matchRate !== "number") {
                    next.ai.semanticMatches.matchRate = avg;
                  }
                }
              } catch { }

              // keep __DBG_ACTIVE__ in sync
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_ANALYSIS__ = next;
                }
              } catch { }

              return next;
            });

            // DBG markers (best-effort)
            try {
              if (typeof window !== "undefined") {
                const mlen = out?.matches?.length;
                window.__DBG_SEMANTIC__ = {
                  ...(window.__DBG_SEMANTIC__ || {}),
                  phase: "success",
                  matchesLen: typeof mlen === "number" ? mlen : null,
                  at: new Date().toISOString(),
                };
                window.__DBG_SEMANTIC_LAST__ = window.__DBG_SEMANTIC__;
              }
            } catch { }

            return;
          } catch (e) {
            // 최신 분석 key가 바뀌었으면 에러도 무시
            if (analysisKeyRef.current !== key) {
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_SEMANTIC__ = {
                    ...(window.__DBG_SEMANTIC__ || {}),
                    phase: "ignored:key_mismatch",
                    cur: analysisKeyRef.current,
                    at: new Date().toISOString()
                  };
                }
              } catch { }
              return;
            }
            if (analysisKeyRef.current !== key) {
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_SEMANTIC_LAST__ = {
                    ...(window.__DBG_SEMANTIC_LAST__ || {}),
                    phase: "ignored:key_mismatch",
                    cur: analysisKeyRef.current,
                    at: new Date().toISOString(),
                  };
                }
              } catch { }
              return;
            }
            __cacheSet(null, { ok: false, status: "error", error: String(e?.message || e || "unknown"), at: new Date().toISOString() });
            setAnalysis((prev) => {
              if (!prev || prev.key !== key) return prev;

              const next = {
                ...prev,
                semanticMatch: null,
                semanticMeta: {
                  ok: false,
                  status: "error",
                  error: String(e?.message || e || "unknown"),
                  at: new Date().toISOString(),
                },
              };

              // keep __DBG_ACTIVE__ in sync
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_ANALYSIS__ = next;
                }
              } catch { }

              return next;
            });
            try {
              if (typeof window !== "undefined") {
                window.__DBG_SEMANTIC__ = { ...(window.__DBG_SEMANTIC__ || {}), phase: "error", error: String(e?.message || e || "unknown"), at: new Date().toISOString() };
              }
            } catch { }
          }
        })();
        // 샘플 모드가 켜져 있었다면, "내 분석"을 실행하는 순간 샘플 모드 표시만 해제(입력은 건드리지 않음)
        if (sampleMode) {
          clearSampleMode();
        }

        // ✅ 디버그(원하면 유지): 리스크/구조가 결과에 실제로 들어왔는지 확인
        // console.log("RISK CHECK:", base?.riskLayer, base?.decisionPressure, base?.hiddenRisk, base?.structural);

        // 2) AI는 뒤에서 보강(merge)
        // - 호출 정책: 짧은 입력/30초 중복/샘플 모드면 스킵
        const sk = shouldSkipAiCall({ jd: __stateForAnalyze.jd, resume: __stateForAnalyze.resume, key, manual: false });
        if (!sk.skip) {
          const sk = shouldSkipAiCall({ jd: __stateForAnalyze.jd, resume: __stateForAnalyze.resume, key, manual: false });
          if (!sk.skip) {
            try {
              const __p = requestAiEnhance({ jd: __stateForAnalyze.jd, resume: __stateForAnalyze.resume, key, manual: false });
              Promise.resolve(__p).catch((e) => {
                try {
                  if (typeof window !== "undefined") {
                    window.__DBG_AI_CALLSITE_THROW__ = {
                      at: Date.now(),
                      where: "runAnalysis.requestAiEnhance.callsite",
                      message: e?.message || String(e),
                      stack: String(e?.stack || ""),
                      name: e?.name || null,
                    };
                    console.error("[DBG][AI_CALLSITE_THROW]", window.__DBG_AI_CALLSITE_THROW__);
                  }
                } catch { }
              });
            } catch (e) {
              try {
                if (typeof window !== "undefined") {
                  window.__DBG_AI_CALLSITE_THROW__ = {
                    at: Date.now(),
                    where: "runAnalysis.requestAiEnhance.callsite.sync",
                    message: e?.message || String(e),
                    stack: String(e?.stack || ""),
                    name: e?.name || null,
                  };
                  console.error("[DBG][AI_CALLSITE_THROW_SYNC]", window.__DBG_AI_CALLSITE_THROW__);
                }
              } catch { }
            }
          } else {
            // 스킵 사유도 meta/status로 노출(디버깅/체감)
            const meta = { usedAI: false, status: "skipped:" + String(sk.reason || "") };
            setAiMeta(meta);
            setAiError(null);
            setAiResult(null);

            setAnalysis((prev) => {
              if (!prev || prev.key !== key) return prev;
              return { ...prev, ai: null, aiMeta: meta, aiCards: null };
            });
          }
        } else {
          // 스킵 사유도 meta/status로 노출(디버깅/체감)
          const meta = { usedAI: false, status: "skipped:" + String(sk.reason || "") };
          setAiMeta(meta);
          setAiError(null);
          setAiResult(null);

          setAnalysis((prev) => {
            if (!prev || prev.key !== key) return prev;
            return { ...prev, ai: null, aiMeta: meta, aiCards: null };
          });
        }

        // 기본 deterministic 분석이 끝난 시점이지만 AI 심화 해석이 아직 보강 중일 수 있으므로
        // 흐름을 막는 native alert/toast로 "분석 완료"를 띄우지 않는다. 진행 상태는 화면 내 로딩 UI가 안내한다.
        try {
          if (typeof window !== "undefined") {
            window.__DBG_ANALYZE_ONCE = {
              ...(window.__DBG_ANALYZE_ONCE || {}),
              analyzeAfter: {
                at: Date.now(),
                source,
                goResult,
                key,
                hasDecisionPack: !!base?.decisionPack,
                hasSimulationViewModel: !!base?.reportPack?.simulationViewModel,
              },
            };
          }
        } catch { }

        if (goResult) {
          goTo(SECTION.RESULT);
        }
      } catch (e) {
        try {
          if (typeof window !== "undefined") {
            window.__DBG_ANALYZE_ONCE = {
              ...(window.__DBG_ANALYZE_ONCE || {}),
              analyzeError: {
                at: Date.now(),
                source,
                goResult,
                message: String(e?.message || e),
                stack: String(e?.stack || ""),
              },
            };
          }
        } catch { }
        try { window.__DBG_AI_ERR__ = { msg: String(e?.message || e), stack: String(e?.stack || ""), at: Date.now() }; } catch { }
        // ✅ DEBUG (append-only): preserve stack when status is stringified
        try {
          if (typeof window !== "undefined") {
            window.__DBG_AI_ERR__ = {
              at: Date.now(),
              where: "aiMeta.status.catch",
              message: e?.message || String(e),
              stack: e?.stack || null,
              name: e?.name || null,
            };
            console.error("[DBG][AI][aiMeta.status.catch]", window.__DBG_AI_ERR__);
          }
        } catch { }
        console.error(e);
        toast({ title: "분석 실패", description: "콘솔 로그를 확인해 주세요.", variant: "destructive" });
      } finally {
        setIsAnalyzing(false);
      }
    }, delayMs);
  }


  async function copyReport() {
    try {
      const active = sampleMode ? sampleAnalysis : analysis;
      if (!active) throw new Error("no analysis");

      const toReportText = (v) => {
        if (typeof v === "string") return v;
        if (v === null || v === undefined) return "";
        try {
          return JSON.stringify(v, null, 2);
        } catch {
          return String(v);
        }
      };

      const text = toReportText(active?.report);
      if (!text) throw new Error("no report");

      await navigator.clipboard.writeText(text);
      toast({ title: "복사 완료", description: "리포트가 클립보드에 복사됐습니다." });
    } catch {
      toast({ title: "복사 실패", description: "브라우저 권한을 확인해 주세요.", variant: "destructive" });
    }
  }


  function downloadReport() {
    try {
      const active = sampleMode ? sampleAnalysis : analysis;
      const activeState = sampleMode ? SAMPLE_STATE : state;
      if (!active) throw new Error("no analysis");

      const toReportText = (v) => {
        if (typeof v === "string") return v;
        if (v === null || v === undefined) return "";
        try {
          return JSON.stringify(v, null, 2);
        } catch {
          return String(v);
        }
      };

      const text = toReportText(active?.report);
      if (!text) throw new Error("no report");

      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "reject_report_" +
        String(activeState.companyTarget || activeState.company || "company").split(" ").join("_") +
        ".txt";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "다운로드 시작", description: "텍스트 파일로 저장됩니다." });
    } catch {
      toast({ title: "다운로드 실패", variant: "destructive" });
    }
  }

  async function copyAnalyzeDebugJson() {
    try {
      const __lastDebug = globalThis.__PASSMAP_ANALYZE_LAST_DEBUG__;
      if (!__lastDebug) throw new Error("no analyze debug snapshot");
      await navigator.clipboard.writeText(JSON.stringify(__lastDebug, null, 2));
      toast({ title: "복사 완료", description: "analyze debug snapshot JSON이 복사됐습니다." });
    } catch (e) {
      console.error("[PASSMAP_DEBUG_UI][copyAnalyzeDebugJson]", e);
      toast({ title: "복사 실패", description: "브라우저 권한을 확인해 주세요.", variant: "destructive" });
    }
  }

  function clearAnalyzeDebugSnapshot() {
    try {
      globalThis.__PASSMAP_ANALYZE_LAST_DEBUG__ = null;
      globalThis.__PASSMAP_ANALYZE_DEBUG_LOG__ = [];
    } catch (e) {
      console.error("[PASSMAP_DEBUG_UI][clearAnalyzeDebugSnapshot]", e);
    } finally {
      setAnalysis((prev) => (prev ? { ...prev } : prev));
    }
  }


  function goTo(nextId) {
    setStep(nextId);
    setActiveTab(nextId);
    if (nextId === SECTION.RESULT) {
      __queueResultScroll(loginOpen ? "auto" : "smooth");
    }
  }

  // TEMP DEBUG UI: expose analyze debug snapshot on the result screen only.
  const __lastAnalyzeDebug = globalThis.__PASSMAP_ANALYZE_LAST_DEBUG__;
  const __analyzeDebugLog = Array.isArray(globalThis.__PASSMAP_ANALYZE_DEBUG_LOG__)
    ? globalThis.__PASSMAP_ANALYZE_DEBUG_LOG__
    : [];

  // ------------------------------
  // ✅ HiddenRisk Teaser Toast (append-only / input-stage only)
  // - 내용 노출 금지: count만 표시
  // - 스팸 방지: 같은 count 반복 노출 금지, 증가했을 때만 노출
  // - RESULT(리포트) 탭에서는 숨김
  // ------------------------------
  const [__hrTeaser, __setHrTeaser] = React.useState({ open: false, count: 0, at: 0 });
  // TMP_DEBUG: teaser state mirror (remove after verification)
  React.useEffect(() => {
    try { window.__DBG_HR_STATE__ = __hrTeaser || null; } catch { }
  }, [__hrTeaser]);
  const __hrTeaserTimerRef = React.useRef(null);
  const __hrLastShownCountRef = React.useRef(0);

  function __clearHrTeaserTimer() {
    try {
      if (__hrTeaserTimerRef.current) clearTimeout(__hrTeaserTimerRef.current);
      __hrTeaserTimerRef.current = null;
    } catch { }
  }

  function maybeShowHiddenRiskTeaser(triggerKey, analysisOverride) {
    try {
      try { window.__DBG_HR_CALL__ = { at: new Date().toISOString(), triggerKey: String(triggerKey || ""), hasOverride: !!analysisOverride }; } catch { }
      const a = analysisOverride || activeAnalysis || null;
      const hr =
        a?.decisionPack?.hiddenRisk ??
        a?.reportPack?.decisionPack?.hiddenRisk ??
        null;

      // 1) v11Stable 형태 (riskCount가 있으면 그대로 사용)
      const cRaw = hr?.riskCount ?? null;
      let c = (typeof cRaw === "number") ? cRaw : Number(cRaw);

      // 2) 레거시 형태 fallback: items가 "객체(map)"인 경우가 많음
      // - 각 key가 리스크 카테고리, value는 { score, level, drivers } 같은 객체
      // - 내용 노출 금지: count만 계산
      if (!Number.isFinite(c) || c <= 0) {
        const it = hr?.items;

        let n = NaN;

        // (a) items가 배열이면 길이
        if (Array.isArray(it)) {
          n = it.length;
        }
        // (b) items가 객체(map)면: "유효한 항목"만 카운트
        else if (it && typeof it === "object") {
          const keys = Object.keys(it || {});
          if (keys.length > 0) {
            const validCount = keys.reduce((acc, k) => {
              const v = it[k];

              // value가 객체일 때: score/level/drivers 기준으로 "감지됨" 판단
              const score = (v && typeof v === "object") ? v.score : null;
              const level = (v && typeof v === "object") ? v.level : null;
              const drivers = (v && typeof v === "object") ? v.drivers : null;

              const hasScore = (typeof score === "number") ? (score > 0) : false;
              const hasLevel = (typeof level === "string") ? (level !== "none" && level !== "off" && level !== "unknown" && level !== "") : false;
              const hasDrivers = Array.isArray(drivers) ? (drivers.length > 0) : false;

              // 레거시 신호는 보통 score/level/drivers 중 하나라도 있으면 "감지"로 본다
              const isValid = hasScore || hasLevel || hasDrivers;

              return acc + (isValid ? 1 : 0);
            }, 0);

            // 모두 무효면, 최후 fallback: 키 개수 자체를 count로 사용(과대추정 가능하지만 teaser 목적)
            n = (validCount > 0) ? validCount : keys.length;
          }
        }

        if (Number.isFinite(n) && n > 0) {
          c = Math.min(5, n); // MAX_COUNT_SHOWN = 5 동일 정책
        }
      }
      if (!Number.isFinite(c) || c <= 0) {
        try { window.__DBG_HR_RETURN__ = { at: new Date().toISOString(), reason: "no_count", triggerKey: String(triggerKey || ""), cRaw, c, hrKeys: hr ? Object.keys(hr) : null }; } catch { }
        return;
      }

      // 같은 count는 재노출 금지, 증가했을 때만 노출
      const last = Number(__hrLastShownCountRef.current || 0);

      // run_analysis 트리거는 항상 1회 허용
      if (triggerKey !== "run_analysis" && c <= last) {
        try { window.__DBG_HR_RETURN__ = { at: new Date().toISOString(), reason: "not_increased", triggerKey: String(triggerKey || ""), c, last }; } catch { }
        return;
      }
      __hrLastShownCountRef.current = c;

      __clearHrTeaserTimer();
      __setHrTeaser({ open: true, count: c, at: Date.now(), key: String(triggerKey || "") });
      try { window.__DBG_HR_SET__ = { at: new Date().toISOString(), triggerKey: String(triggerKey || ""), c }; } catch { }
      __hrTeaserTimerRef.current = setTimeout(() => {
        try { __setHrTeaser((prev) => ({ ...(prev || {}), open: false })); } catch { }
        __hrTeaserTimerRef.current = null;
      }, 3800);
    } catch { }
  }

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;

      const __fallbackFromWindow =
        (window.__DBG_ANALYSIS__ || window.__TMP_LAST_ANALYSIS__ || null);

      // ✅ current VM SSOT: reportPack.simulationViewModel
      // - analyzer가 실제로 채우는 경로를 우선 사용
      // - legacy/top-level/external simVM은 뒤로 보냄
      const __simVM =
        (typeof sharePayload !== "undefined" ? (sharePayload?.reportPack?.simulationViewModel || null) : null) ||
        (typeof sharePayload !== "undefined" ? (sharePayload?.reportPack?.simVM || null) : null) ||
        (typeof sharePayload !== "undefined" ? (sharePayload?.simulationViewModel || null) : null) ||
        (typeof sharePayload !== "undefined" ? (sharePayload?.simVM || null) : null) ||
        (typeof simVM !== "undefined" && simVM) ||
        null;

      const __bridgeFromSimVM = __simVM
        ? { simulationViewModel: __simVM, reportPack: { simulationViewModel: __simVM } }
        : null;

      const __dbgA =
        activeAnalysis ||
        analysis ||
        __fallbackFromWindow ||
        __bridgeFromSimVM ||
        null;

      // 마지막 안전장치: null로 덮어쓰기 금지
      if (__dbgA) {
        window.__DBG_ACTIVE__ = __dbgA;
        window.__DBG_ACTIVE_SET_AT__ = new Date().toISOString();
      } else {
        try {
          if (!window.__DBG_ACTIVE_SET_AT__) {
            window.__DBG_ACTIVE_SET_AT__ = new Date().toISOString();
          }
        } catch { }
      }
    } catch { }
  }, [activeAnalysis, analysis, typeof simVM !== "undefined" ? simVM : null]);
  try {
    if (typeof window !== "undefined") {
    }
  } catch { }
  // debug flags disabled
  const activeCareer = sampleMode ? SAMPLE_STATE.career : state.career;
  const expertAdvice = useMemo(() => {
    const activeState = sampleMode ? SAMPLE_STATE : state;
    return buildExpertAdvice(activeState, activeAnalysis);
  }, [sampleMode, state, activeAnalysis]);
  const activeAiMeta = useMemo(() => {
    const m = activeAnalysis?.aiMeta || aiMeta;
    if (!m || typeof m !== "object") return null;
    return {
      usedAI: typeof m.usedAI === "boolean" ? m.usedAI : Boolean(m.usedAI),
      status: (m.status || "").toString() || "",
    };
  }, [activeAnalysis?.aiMeta, aiMeta]);

  const aiStatusLabel = useMemo(() => {
    if (!activeAiMeta) return "";
    const s = (activeAiMeta.status || "").toString();
    if (!s) return "";
    return s;
  }, [activeAiMeta]);

  const aiConnected = useMemo(() => {
    if (!activeAiMeta) return false;
    if (activeAiMeta.usedAI) return true;
    const s = (activeAiMeta.status || "").toString();
    return s === "success" || s.includes("success");
  }, [activeAiMeta]);

  function AiDisclosureCard({ title, subtitle, open, onToggle, children }) {
    return (
      <Card className="rounded-2xl border bg-background/70 backdrop-blur">
        <CardHeader className="pb-3">
          <button type="button" onClick={onToggle} className="w-full flex items-start justify-between gap-3 text-left">
            <div className="space-y-1">
              <CardTitle className="text-base">{title}</CardTitle>
              {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : null}
            </div>
            <ChevronDown className={"h-5 w-5 text-muted-foreground transition " + (open ? "rotate-180" : "")} />
          </button>
        </CardHeader>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              key="ai-card-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0">{children}</CardContent>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Card>
    );
  }

  function normalizeCompanySizeValue(v) {
    const s = (v || "").toString().trim();
    if (!s) return "unknown";
    if (s === "스타트업" || s === "중소/강소기업" || s === "중견기업" || s === "대기업" || s === "unknown") return s;
    return "unknown";
  }

  function isDisplayableValue(v) {
    const s = (v ?? "").toString().trim().toLowerCase();
    return !!s && s !== "unknown" && s !== "null" && s !== "undefined";
  }

  function sanitizeStructureDetail(input) {
    const seen = new WeakSet();

    function walk(x, depth) {
      if (depth > 4) return "[…]";
      if (x === null || x === undefined) return null;

      const t = typeof x;
      if (t === "string") {
        const s = x.toString();
        if (s.length > 600) return s.slice(0, 600) + "…";
        return s;
      }
      if (t === "number") return "[num]";
      if (t === "boolean") return x;
      if (t === "function") return "[fn]";
      if (t === "bigint") return "[bigint]";
      if (t === "symbol") return "[symbol]";

      if (Array.isArray(x)) {
        const arr = x.slice(0, 12).map((v) => walk(v, depth + 1));
        if (x.length > 12) arr.push("…+" + String(x.length - 12));
        return arr;
      }

      if (t === "object") {
        try {
          if (seen.has(x)) return "[circular]";
          seen.add(x);
        } catch {
          // ignore
        }
        const out = {};
        const keys = Object.keys(x).slice(0, 20);
        keys.forEach((k) => {
          const v = x[k];
          out[k] = walk(v, depth + 1);
        });
        if (Object.keys(x).length > 20) out.__more = "…+" + String(Object.keys(x).length - 20);
        return out;
      }

      return "[unknown]";
    }

    return walk(input, 0);
  }

  const [structureOpen, setStructureOpen] = useState(false);

  // 🔧 추가 (AI 카드 setter 복구 — 샘플 생성 에러 해결용)
  const [aiCardOpen, setAiCardOpen] = useState(false);
  const [aiAdvancedOpen, setAiAdvancedOpen] = useState(false);

  const structureInfo = useMemo(() => {

    const a = activeAnalysis;
    const ai = a?.ai && typeof a.ai === "object" ? a.ai : null;

    const s1 = ai?.structureExplanation ?? null;
    const s2 = ai?.structureAnalysis ?? null;
    const s3 = ai?.structure ?? null;
    const s4 = ai?.fitExtract?.structureExplanation ?? null;

    const raw = s1 ?? s2 ?? s3 ?? s4 ?? null;

    let oneLine = "";
    if (typeof raw === "string" && raw.trim()) {
      oneLine = raw.trim().split("\n").slice(0, 1).join(" ");
      if (oneLine.length > 140) oneLine = oneLine.slice(0, 140) + "…";
    } else if (raw && typeof raw === "object") {
      const keys = Object.keys(raw);
      oneLine = keys.length
        ? "구조분석 요약: " + keys.slice(0, 6).join(", ") + (keys.length > 6 ? "…" : "")
        : "구조분석 요약: 데이터 있음";
    } else {
      oneLine = "구조분석 요약: 데이터 없음";
    }

    const detail = raw ? sanitizeStructureDetail(raw) : null;

    return { oneLine, detail, raw };
  }, [activeAnalysis]);

  function setTab(nextId) {
    setActiveTab(nextId);
    setStep(nextId);
    if (nextId === SECTION.RESULT) {
      __queueResultScroll(loginOpen ? "auto" : "smooth");
    }
  }
  function goToFirstScreen() {
    setTab(SECTION.JOB);
    window.requestAnimationFrame(() => {
      const el = basicSectionRef.current || firstScreenRef.current || null;
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
  function goToHomeScreen() {
    setActiveTab(SECTION.JOB);
    setStep(SECTION.JOB);
    setShowInputFlow(true);
    setInputEntryMode("default");
    setResultEntryMode("passmap");
    setJobSidebarView("analysis");
    setSharePanelOpen(false);
    __setInputFlowUiState({
      flowStep: 0,
      roleMajorStep: "current-major",
      roleMajorSelected: "",
      currentMajorSelected: "",
    });
    window.requestAnimationFrame(() => {
      const el = basicSectionRef.current || firstScreenRef.current || null;
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function handleOpenTransitionLiteEntry() {
    setActiveTab(SECTION.JOB);
    setStep(SECTION.JOB);
    setShowInputFlow(true);
    setInputEntryMode("transition-lite");
    setTransitionLiteEntryStep("audience-select");
    const lastAudience = safeReadTransitionLiteLastAudience();
    setTransitionLiteAudience(lastAudience || (Boolean(state?.entryLevelMode) ? "newgrad" : "experienced"));
    window.requestAnimationFrame(() => {
      basicSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleOpenPreciseAnalysisEntry() {
    setActiveTab(SECTION.JOB);
    setStep(SECTION.JOB);
    setShowInputFlow(true);
    setJobSidebarView("analysis");
    setInputEntryMode("precise-analysis");
    setResultEntryMode("precise-analysis");
    window.requestAnimationFrame(() => {
      basicSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleOpenDefaultInputFlow() {
    setActiveTab(SECTION.JOB);
    setStep(SECTION.JOB);
    setShowInputFlow(true);
    setInputEntryMode("default");
    setResultEntryMode("passmap");
  }

  function openJobSidebarDestination(nextView, nextPmView = "weekly") {
    handleOpenDefaultInputFlow();
    setPmDemoView(nextPmView);
    setJobSidebarView(nextView);
  }

  function handleOpenExampleOnboarding() {
    setExampleOnboardingStep(0);
    setIsExampleOnboardingOpen(true);
  }

  function openAiInboxConnectionTarget() {
    setActiveTab(SECTION.JOB);
    setJobSidebarView("resume-update");
    setPmDemoView("weekly");
    setMobileShellActive(true);
    setAiInboxOpenSignal((n) => n + 1);
  }

  function handleOpenAiCaptureGuide() {
    setIsAiCaptureGuideOpen(true);
  }

  function handleStartFirstRecordTour(opts = {}) {
    setFirstRecordTourDate(opts?.date ?? null);
    setFirstRecordTourVariant(opts?.variant === "mobile" ? "mobile" : "web");
    setIsFirstRecordTourOpen(true);
  }

  function handleStartFullProductTour() {
    handleOpenDefaultInputFlow();
    setPmDemoView("weekly");
    setJobSidebarView("work");
    setIsFullProductTourOpen(true);
  }

  function handleNavigateFullProductTour(action) {
    if (!action) return;
    if (action === "home") {
      handleOpenDefaultInputFlow();
      setPmDemoView("weekly");
      setJobSidebarView("work");
      return;
    }
    if (action === "asset-map") {
      openJobSidebarDestination("asset-map", "weekly");
      return;
    }
    if (action === "resume") {
      openJobSidebarDestination("resume", "result");
      return;
    }
    if (action === "analysis") {
      handleOpenDefaultInputFlow();
      setJobSidebarView("analysis");
    }
  }

  function handleOpenRecordInputFromFirstRecordTour(opts = {}) {
    setPendingRecordDate(opts?.date ?? firstRecordTourDate ?? null);
    setPendingRecordContext(null);
    persistPassmapCalendarRecordContext(null);
    setPmDemoView("weekly");
    setJobSidebarView("resume-update");
  }

  function handleDismissFirstRecordOnboarding() {
    dismissFirstRecordOnboarding();
    setIsFirstRecordOnboardingOpen(false);
  }

  function handleStartFirstRecordOnboarding() {
    const date = getTodayDateKey();
    dismissFirstRecordOnboarding();
    setIsFirstRecordOnboardingOpen(false);
    setPendingRecordDate(date);
    setPendingRecordContext(null);
    persistPassmapCalendarRecordContext(null);
    handleOpenDefaultInputFlow();
    setPmDemoView("weekly");
    setJobSidebarView("resume-update");
    setMobileShellActive(true);
  }

  function handleStartFirstRecordOnboardingTour() {
    const date = getTodayDateKey();
    dismissFirstRecordOnboarding();
    setIsFirstRecordOnboardingOpen(false);
    setFirstRecordTourDate(date);
    setFirstRecordTourVariant(isMobile || window.innerWidth < 768 ? "mobile" : "web");
    handleOpenDefaultInputFlow();
    setPmDemoView("weekly");
    setJobSidebarView("work");
    setMobileShellActive(true);
    window.setTimeout(() => setIsFirstRecordTourOpen(true), 0);
  }

  function handleStartFirstRecordOnboardingFullProductTour() {
    dismissFirstRecordOnboarding();
    setIsFirstRecordOnboardingOpen(false);
    handleOpenDefaultInputFlow();
    setPmDemoView("weekly");
    setJobSidebarView("work");
    setMobileShellActive(true);
    window.setTimeout(() => setIsFullProductTourOpen(true), 0);
  }

  function handleNavigateFirstRecordTour(next) {
    if (next !== "record") return;
    if (firstRecordTourVariant === "mobile") {
      setMobileShellActive(true);
      setMobileFirstRecordTourRecordSignal((n) => n + 1);
    }
  }

  function handleGoToAiInboxFromGuide() {
    setIsAiCaptureGuideOpen(false);
    openAiInboxConnectionTarget();
  }

  function handleOpenTransitionLiteShare() {
    __trackGa4Event("share_result", {
      ...__getTransitionLiteAnalyticsContext(),
      share_type: "open_share_panel",
    });
    setSharePanelOpen(true);
  }

  function handleOpenTransitionLiteNextStep() {
    __openTrackedExternal(
      "https://coachingezig.mycafe24.com/contact/",
      "click_consulting_cta",
      {
        ...__getTransitionLiteAnalyticsContext({ page_type: "result" }),
        cta_type: "strategy_design",
      },
      () => {
        toast({
          title: "ì „ëžµ ì„¤ê³„ ì—°ê²° ì‹¤íŒ¨",
          description: "ë¬¸ì˜ íŽ˜ì´ì§€ë¥¼ ì—´ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.",
          variant: "destructive",
        });
      }
    );
    return;
    __trackGa4Event("click_consulting_cta", {
      ...__getTransitionLiteAnalyticsContext({ page_type: "result" }),
      cta_type: "strategy_design",
    });
    try {
      window.open("https://coachingezig.mycafe24.com/contact/", "_blank", "noopener,noreferrer");
    } catch {
      toast({
        title: "전략 설계 연결 실패",
        description: "문의 페이지를 열지 못했습니다.",
        variant: "destructive",
      });
    }
  }

  function handleOpenTransitionLitePrecisePath() {
    __openTrackedExternal(
      "https://m.expert.naver.com/mobile/expert/product/detail?storeId=100049372&productId=100149761",
      "click_consulting_cta",
      {
        ...__getTransitionLiteAnalyticsContext({ page_type: "result" }),
        cta_type: "interview_consulting",
      },
      () => {
        toast({
          title: "ì •ë°€ë¶„ì„ ì—°ê²° ì‹¤íŒ¨",
          description: "ìƒí’ˆ íŽ˜ì´ì§€ë¥¼ ì—´ì§€ ëª»í–ˆìŠµë‹ˆë‹¤.",
          variant: "destructive",
        });
      }
    );
    return;
    __trackGa4Event("click_consulting_cta", {
      ...__getTransitionLiteAnalyticsContext({ page_type: "result" }),
      cta_type: "interview_consulting",
    });
    try {
      window.open(
        "https://m.expert.naver.com/mobile/expert/product/detail?storeId=100049372&productId=100149761",
        "_blank",
        "noopener,noreferrer"
      );
    } catch {
      toast({
        title: "정밀분석 연결 실패",
        description: "상품 페이지를 열지 못했습니다.",
        variant: "destructive",
      });
    }
  }

  function handleSubmitTransitionLite(payload) {
    const nextPayload = (payload && typeof payload === "object") ? payload : {};
    const transitionLiteAudienceResolved = resolveTransitionLiteAudience({
      appAudience: transitionLiteAudience,
      payload: nextPayload,
    });
    const isNewgradMode = transitionLiteAudienceResolved === "newgrad";
    const nextSelection = {
      currentJobId: String(nextPayload.currentJobId || "").trim(),
      currentIndustryId: String(nextPayload.currentIndustryId || "").trim(),
      targetJobId: String(nextPayload.targetJobId || "").trim(),
      targetIndustryId: String(nextPayload.targetIndustryId || "").trim(),
    };
    const nextTargetIndustryId = String(nextPayload.targetIndustryId || "").trim();
    __transitionLiteSelectionRef.current = nextSelection;
    try {
      if (typeof window !== "undefined") {
        window.__TRANSITION_LITE_LAST_SUBMIT__ = {
          audience: transitionLiteAudienceResolved,
          entryLevelMode: isNewgradMode,
          bridgeCandidate: Boolean(nextPayload.bridgeCandidate),
          currentJobId: nextSelection.currentJobId,
          currentIndustryId: nextSelection.currentIndustryId,
          targetJobId: nextSelection.targetJobId,
          targetIndustryId: nextSelection.targetIndustryId,
        };
      }
    } catch { }

    try {
      const nextVm = isNewgradMode
        ? buildNewgradTransitionLiteResult({
            ...nextPayload,
            entryLevelMode: true,
            targetJobId: String(nextPayload.targetJobId || "").trim(),
            targetIndustryId: nextTargetIndustryId,
          })
        : buildTransitionLiteResult({
            currentJobId: String(nextPayload.currentJobId || "").trim(),
            currentIndustryId: String(nextPayload.currentIndustryId || "").trim(),
            targetJobId: String(nextPayload.targetJobId || "").trim(),
            targetIndustryId: nextTargetIndustryId,
          });
      setTransitionLiteResultVm(nextVm);
      if (isNewgradMode) {
        setNewgradSourceInput({
          ...nextPayload,
          entryLevelMode: true,
          targetJobId: String(nextPayload.targetJobId || "").trim(),
          targetIndustryId: nextTargetIndustryId,
        });
        saveNewgradRecentInputRecord(nextPayload);
      } else {
        setNewgradSourceInput(null);
      }
      setActiveExplanationRowKey(null);
      setResultEntryMode("transition-lite");
      setStep(SECTION.RESULT);
      setActiveTab(SECTION.RESULT);
      __queueResultScroll("smooth");
    } catch (err) {
      toast({
        title: "간단 분석 결과 생성 실패",
        description: err?.message || "결과 VM을 만들지 못했습니다.",
        variant: "destructive",
      });
    }
  }
  const shouldUseWideTransitionLiteLayout =
    activeTab === SECTION.RESULT &&
    resultEntryMode === "transition-lite" &&
    !!transitionLiteResultVm;
  const shouldUseWidePreciseAnalysisLayout =
    (activeTab === SECTION.JOB && showInputFlow && inputEntryMode === "precise-analysis") ||
    (activeTab === SECTION.RESULT && resultEntryMode === "precise-analysis");
  const shouldUseWideDefaultInputFlowLanding =
    showInputFlow &&
    inputEntryMode === "default" &&
    activeTab === SECTION.JOB &&
    Number(__inputFlowUiState?.flowStep) === 0;
  const isJobSidebarShellActive =
    showInputFlow &&
    activeTab === SECTION.JOB &&
    inputEntryMode === "default";
  const isMobile = useIsMobile();
  const [mobileShellActive, setMobileShellActive] = useState(true);
  const [mobileAnalysisMode, setMobileAnalysisMode] = useState(null);

  function handleMobileStartJobAnalysis() {
    if (isMobile) { setMobileAnalysisMode("job"); return; }
    setMobileShellActive(false);
    goToHomeScreen();
  }
  function handleMobileStartRejectAnalysis() {
    if (isMobile) { setMobileAnalysisMode("reject"); return; }
    setMobileShellActive(false);
    handleOpenPreciseAnalysisEntry();
  }
  function handleMobileViewResults() {
    if (isMobile) { setMobileAnalysisMode("results"); return; }
    setMobileShellActive(false);
    setStep(SECTION.RESULT);
    setActiveTab(SECTION.RESULT);
  }
  function handleMobileExecuteAnalysis() {
    if (mobileAnalysisMode === "job") { setMobileShellActive(false); goToHomeScreen(); }
    else if (mobileAnalysisMode === "reject") { setMobileShellActive(false); handleOpenPreciseAnalysisEntry(); }
    else if (mobileAnalysisMode === "results") { setMobileShellActive(false); setStep(SECTION.RESULT); setActiveTab(SECTION.RESULT); }
    setMobileAnalysisMode(null);
  }
  function handleMobileSubmitTransitionLite(payload) {
    handleSubmitTransitionLite(payload);
    setMobileShellActive(false);
  }

  const REMINDER_DAY_LABELS = ["일","월","화","수","목","금","토"];
  const fmtReminderSchedule = (day, time) => `매주 ${REMINDER_DAY_LABELS[day]}요일 ${(time || "").slice(0, 5)}`;

  async function handleSaveReminderPreference() {
    if (!auth.loggedIn) return;
    setReminderSaveStatus("saving");
    try {
      const session = await getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("no user id");
      const tz = reminderDraft.timezone || (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Asia/Seoul";
      const saved = await upsertReminderPreference({
        existingRecord: reminderPref,
        userId,
        reminderType: WEEKLY_EXPERIENCE_RECALL_REMINDER_TYPE,
        isEnabled: reminderDraft.is_enabled,
        preferredDayOfWeek: reminderDraft.preferred_day_of_week,
        preferredTimeLocal: reminderDraft.preferred_time_local,
        timezone: tz,
      });
      setReminderPref(saved);
      setReminderSavedSnapshot(fmtReminderSchedule(saved.preferred_day_of_week, saved.preferred_time_local));
      setReminderSaveStatus("saved");
      setTimeout(() => setReminderSaveStatus("idle"), 2000);
    } catch (_) {
      setReminderSaveStatus("error");
      setTimeout(() => setReminderSaveStatus("idle"), 3000);
    }
  }

  async function handleSaveCareerBaseline(draftSettings) {
    if (!auth.loggedIn) return;
    setCareerBaselineStatus("saving");
    try {
      const session = await getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("no user id");
      const saved = await upsertCareerBaseline({ existingRecord: careerBaseline, userId, settings: draftSettings });
      setCareerBaseline(saved);
      setCareerBaselineStatus("saved");
      setTimeout(() => setCareerBaselineStatus("idle"), 2000);
    } catch (_) {
      setCareerBaselineStatus("error");
      setTimeout(() => setCareerBaselineStatus("idle"), 3000);
    }
  }

  const isShellLevelJobRailLayout = isJobSidebarShellActive;
  const isJobDashboardShellLayout =
    isJobSidebarShellActive &&
    (jobSidebarView === "work" || jobSidebarView === "resume" || jobSidebarView === "resume-update");
  const isAssetMapLayout = isJobSidebarShellActive && jobSidebarView === "asset-map";
  const showSharedLandingHeader =
    !isJobSidebarShellActive &&
    inputEntryMode !== "precise-analysis" &&
    resultEntryMode !== "precise-analysis";
  const showJobAnalysisLandingHeader =
    isJobSidebarShellActive && jobSidebarView === "analysis";
  const companySizeCandidateValue = normalizeCompanySizeValue(state.companySizeCandidate || "unknown");
  const companySizeTargetValue = normalizeCompanySizeValue(state.companySizeTarget || "unknown");
  const __targetRoleKey = getPassmapTargetRoleKey(state);
  // [PATCH] 현재 입력 요약 카드 추가 항목 — read-path only
  const __INDUSTRY_SUMMARY_LABEL = {
    tech: "IT/테크",
    finance: "금융",
    commerce: "커머스/리테일",
    manufacturing: "제조/산업",
    healthcare: "헬스케어/바이오",
    public: "공공/교육",
    media: "미디어/콘텐츠",
    hr: "HR/컨설팅",
  };
  const industryTargetLabel = (() => {
    const transitionLiteLabel = String(transitionLiteResultVm?.targetIndustryLabel || "").trim();
    if (
      resultEntryMode === "transition-lite" &&
      transitionLiteResultVm &&
      transitionLiteLabel
    ) {
      return transitionLiteLabel;
    }
    const k = String(state.industryTarget || "").trim();
    if (!k || k === "unknown") return "";
    return __INDUSTRY_SUMMARY_LABEL[k] || k;
  })();
  const currentCareerRoleContext = getPassmapCurrentCareerRoleContext(state);
  const currentCareerRoleLabel = getPassmapCurrentCareerRoleLabel(currentCareerRoleContext);
  const defaultRoleTaxonomyMajorKey = String(JOB_TAXONOMY_OPTIONS?.[0]?.key || "").trim();
  const [jobSidebarRoleDraftMajorKey, setJobSidebarRoleDraftMajorKey] = useState(
    currentCareerRoleContext.majorKey || defaultRoleTaxonomyMajorKey
  );
  useEffect(() => {
    setJobSidebarRoleDraftMajorKey(
      currentCareerRoleContext.majorKey || defaultRoleTaxonomyMajorKey
    );
  }, [currentCareerRoleContext.majorKey, defaultRoleTaxonomyMajorKey]);
  const currentCareerRoleMajorOption =
    getJobTaxonomyOptionByMajorKey(jobSidebarRoleDraftMajorKey) ||
    getJobTaxonomyOptionByMajorKey(currentCareerRoleContext.majorKey) ||
    null;
  const currentCareerRoleSubOptions = Array.isArray(currentCareerRoleMajorOption?.subs)
    ? currentCareerRoleMajorOption.subs
    : [];
  const currentCareerRoleSubValue =
    currentCareerRoleContext.majorKey === jobSidebarRoleDraftMajorKey
      ? currentCareerRoleContext.subKey
      : "";

  const [reminderPref, setReminderPref] = useState(null);
  const [reminderDraft, setReminderDraft] = useState(() => getDefaultWeeklyExperienceRecallPreference());
  const [reminderSaveStatus, setReminderSaveStatus] = useState("idle");

  const [careerBaseline, setCareerBaseline] = useState(null);
  const [careerBaselineStatus, setCareerBaselineStatus] = useState("idle");

  const [pushStatus, setPushStatus] = useState("idle");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushSubscriptionRecord, setPushSubscriptionRecord] = useState(null);
  const [pushSubscriptionCheckStatus, setPushSubscriptionCheckStatus] = useState("idle");
  const [testPushStatus, setTestPushStatus] = useState("idle");
  const [testPushMessage, setTestPushMessage] = useState("");
  const [schedulerV2SummaryRows, setSchedulerV2SummaryRows] = useState([]);
  const [schedulerV2SummaryStatus, setSchedulerV2SummaryStatus] = useState("idle");
  const [schedulerV2SummaryError, setSchedulerV2SummaryError] = useState(null);
  const [reminderSettingsOpen, setReminderSettingsOpen] = useState(false);
  const [provisionInfoOpen, setProvisionInfoOpen] = useState(false);
  const [reminderSavedSnapshot, setReminderSavedSnapshot] = useState(null);
  const [isExampleOnboardingOpen, setIsExampleOnboardingOpen] = useState(false);
  const [exampleOnboardingStep, setExampleOnboardingStep] = useState(0);
  const [isAiCaptureGuideOpen, setIsAiCaptureGuideOpen] = useState(false);
  const [isFirstRecordOnboardingOpen, setIsFirstRecordOnboardingOpen] = useState(false);
  const [firstRecordOnboardingChecked, setFirstRecordOnboardingChecked] = useState(false);
  const [isFirstRecordTourOpen, setIsFirstRecordTourOpen] = useState(false);
  const [isFullProductTourOpen, setIsFullProductTourOpen] = useState(false);
  const [firstRecordTourDate, setFirstRecordTourDate] = useState(null);
  const [firstRecordTourVariant, setFirstRecordTourVariant] = useState("web");
  const [mobileFirstRecordTourRecordSignal, setMobileFirstRecordTourRecordSignal] = useState(0);
  useEffect(() => {
    if (isMobile) {
      setIsFirstRecordOnboardingOpen(false);
      setFirstRecordOnboardingChecked(true);
      return undefined;
    }
    if (!authSyncReady) return undefined;
    if (hasDismissedFirstRecordOnboarding()) {
      setIsFirstRecordOnboardingOpen(false);
      setFirstRecordOnboardingChecked(true);
      return undefined;
    }
    if (!auth?.loggedIn) {
      setIsFirstRecordOnboardingOpen(true);
      setFirstRecordOnboardingChecked(true);
      return undefined;
    }

    let cancelled = false;
    setFirstRecordOnboardingChecked(false);
    listCalendarWorkRecords({ limit: 1 })
      .then((rows) => {
        if (cancelled) return;
        setIsFirstRecordOnboardingOpen(Array.isArray(rows) && rows.length === 0);
        setFirstRecordOnboardingChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        setIsFirstRecordOnboardingOpen(false);
        setFirstRecordOnboardingChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [auth?.loggedIn, authSyncReady, isMobile]);
  const exampleOnboardingPanelRef = useRef(null);
  const exampleOnboardingSteps = useMemo(() => {
    const baseUrl = import.meta.env.BASE_URL || "/";
    return [
      {
        title: "가장 편한 방식으로 기록해요",
        description: "ChatGPT에 부탁하거나, 웹에서 선택 후 우클릭으로 바로 PASSMAP에 보낼 수 있어요.",
        image: `${baseUrl}onboarding/passmap-step-1.png`,
        alt: "ChatGPT 또는 웹에서 PASSMAP으로 업무 기록을 보내는 예시 화면",
      },
      {
        title: "PASSMAP이 경험 초안으로 정리해줘요",
        description: "흩어진 업무 내용을 읽고, 경험·역할·성과 포인트 중심으로 정리합니다.",
        image: `${baseUrl}onboarding/passmap-step-2.png`,
        alt: "PASSMAP 기록 화면에서 업무 내용이 경험 초안으로 정리되는 예시 화면",
      },
      {
        title: "기록은 자산맵으로 연결돼요",
        description: "반복된 경험이 내 강점과 연결 가능한 직무 방향으로 보입니다.",
        image: `${baseUrl}onboarding/passmap-step-3.png`,
        alt: "PASSMAP 좌측 탭과 커리어 자산맵 구조가 연결된 예시 화면",
      },
      {
        title: "이력서와 상담에 활용할 수 있어요",
        description: "정리된 기록은 이력서 문장 후보와 상담 준비 자료로 다시 활용할 수 있어요.",
        image: `${baseUrl}onboarding/passmap-step-4.png`,
        alt: "정리된 경험이 이력서 문장 후보와 상담 준비 자료로 이어지는 예시 화면",
      },
    ];
  }, []);
  const currentExampleOnboardingStep =
    exampleOnboardingSteps[exampleOnboardingStep] || exampleOnboardingSteps[0];
  const isLastExampleOnboardingStep = exampleOnboardingStep === exampleOnboardingSteps.length - 1;
  const closeExampleOnboarding = () => setIsExampleOnboardingOpen(false);
  const goNextExampleOnboardingStep = () => {
    setExampleOnboardingStep((step) => Math.min(step + 1, exampleOnboardingSteps.length - 1));
  };
  const goPrevExampleOnboardingStep = () => {
    setExampleOnboardingStep((step) => Math.max(step - 1, 0));
  };
  const finishExampleOnboarding = () => {
    setIsExampleOnboardingOpen(false);
    openJobSidebarDestination("resume-update", "weekly");
  };
  useEffect(() => {
    if (!isExampleOnboardingOpen) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyOverflowX = document.body.style.overflowX;
    const previousHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = "hidden";
    document.body.style.overflowX = "hidden";
    document.documentElement.style.overflowX = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsExampleOnboardingOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => {
      exampleOnboardingPanelRef.current?.focus?.();
    });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.overflowX = previousBodyOverflowX;
      document.documentElement.style.overflowX = previousHtmlOverflowX;
    };
  }, [isExampleOnboardingOpen]);
  useEffect(() => {
    if (!isWebPushSupported()) { setPushStatus("unsupported"); return; }
    if (!isPublicKeyConfigured()) { setPushStatus("key_missing"); return; }
    getCurrentSubscription().then(async (sub) => {
      if (sub) {
        setPushSubscribed(true);
        setPushStatus(getNotificationPermission() === "granted" ? "granted" : "idle");
        setPushSubscriptionCheckStatus("checking");
        try {
          const record = await loadPushSubscription(sub.endpoint);
          setPushSubscriptionRecord(record);
          setPushSubscriptionCheckStatus(record ? "found" : "missing");
        } catch (_) {
          setPushSubscriptionCheckStatus("error");
        }
      } else {
        setPushSubscriptionRecord(null);
        setPushSubscriptionCheckStatus("missing");
        const perm = getNotificationPermission();
        if (perm === "denied") setPushStatus("denied");
        else if (perm === "granted") setPushStatus("granted");
        else setPushStatus("idle");
      }
    }).catch(() => {});
  }, []);
  async function handleRequestPushPermission() {
    if (!auth.loggedIn) return;
    setPushStatus("loading");
    try {
      await registerServiceWorker();
      const permission = await requestNotificationPermission();
      if (permission !== "granted") { setPushStatus(permission === "denied" ? "denied" : "idle"); return; }
      const sub = await subscribeToPush();
      const session = await getSession();
      const userId = session?.user?.id;
      if (userId) {
        const savedSubscription = await upsertPushSubscription({
          userId,
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
          expirationTime: sub.expirationTime,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        });
        setPushSubscriptionRecord(savedSubscription);
        setPushSubscriptionCheckStatus("found");
      } else {
        setPushSubscriptionCheckStatus("error");
      }
      setPushSubscribed(true);
      setPushStatus("granted");
    } catch (_) {
      setPushStatus("error");
      setTimeout(() => setPushStatus(getNotificationPermission() === "denied" ? "denied" : "idle"), 3000);
    }
  }
  async function handleRevokePushSubscription() {
    if (!auth.loggedIn) return;
    setPushStatus("loading");
    try {
      const sub = await getCurrentSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushSubscribed(false);
      setPushSubscriptionRecord(null);
      setPushSubscriptionCheckStatus("missing");
      setPushStatus("idle");
    } catch (_) {
      setPushStatus("error");
      setTimeout(() => setPushStatus("granted"), 3000);
    }
  }
  async function handleSendTestPushNotification() {
    if (!auth.loggedIn) return;
    setTestPushStatus("sending");
    setTestPushMessage("");
    try {
      if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
      const sub = await getCurrentSubscription();
      if (!sub?.endpoint) throw new Error("ENDPOINT_MISSING");
      const session = await getSession();
      const token = session?.access_token;
      if (!token) throw new Error("AUTH_REQUIRED");

      const { data, error } = await supabase.functions.invoke("send-test-experience-recall-push", {
        body: { endpoint: sub.endpoint },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error) {
        const code = data?.error || error?.context?.error || error?.message || "SERVER_FAILED";
        throw new Error(String(code));
      }

      setTestPushStatus("sent");
      setTestPushMessage("테스트 알림을 보냈어요. 알림을 클릭하면 AI 업무기록 화면으로 이동합니다.");
      setTimeout(() => setTestPushStatus("idle"), 5000);
    } catch (err) {
      const code = String(err?.message || "");
      let message = "테스트 알림을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
      if (code.includes("ENDPOINT")) message = "현재 브라우저 알림 등록을 찾지 못했어요. 이 기기에서 알림을 다시 켜 주세요.";
      else if (code.includes("AUTH") || code.includes("JWT")) message = "로그인 확인이 필요해요. 다시 로그인한 뒤 시도해 주세요.";
      else if (code.includes("SUBSCRIPTION_NOT_FOUND")) message = "현재 계정에 등록된 이 기기 알림을 찾지 못했어요.";
      else if (code.includes("SUBSCRIPTION_INCOMPLETE")) message = "현재 기기 알림 등록 정보가 완전하지 않아요. 알림을 다시 켜 주세요.";
      setTestPushStatus("error");
      setTestPushMessage(message);
    }
  }
  useEffect(() => {
    if (!auth.loggedIn) return;
    let cancelled = false;
    async function loadPref() {
      try {
        const pref = await getReminderPreference(WEEKLY_EXPERIENCE_RECALL_REMINDER_TYPE);
        if (cancelled) return;
        if (pref) {
          setReminderPref(pref);
          setReminderDraft({
            reminder_type: pref.reminder_type,
            is_enabled: pref.is_enabled,
            preferred_day_of_week: pref.preferred_day_of_week,
            preferred_time_local: String(pref.preferred_time_local || "18:00").slice(0, 5),
            timezone: pref.timezone,
          });
        } else {
          setReminderPref(null);
          setReminderDraft(getDefaultWeeklyExperienceRecallPreference());
        }
      } catch (_) {}
    }
    loadPref();
    return () => { cancelled = true; };
  }, [auth.loggedIn]);
  useEffect(() => {
    if (!auth.loggedIn) {
      setSchedulerV2SummaryRows([]);
      setSchedulerV2SummaryStatus("idle");
      setSchedulerV2SummaryError(null);
      return undefined;
    }

    let cancelled = false;
    async function loadSchedulerV2Summary() {
      setSchedulerV2SummaryStatus("loading");
      setSchedulerV2SummaryError(null);
      try {
        if (!supabase) throw new Error("Supabase client is not configured.");
        const rows = await fetchSchedulerV2NotificationSummaryWithBootstrap(supabase);
        if (cancelled) return;
        setSchedulerV2SummaryRows(rows);
        setSchedulerV2SummaryStatus(rows.length > 0 ? "success" : "empty");
      } catch (error) {
        if (cancelled) return;
        setSchedulerV2SummaryRows([]);
        setSchedulerV2SummaryError(error);
        setSchedulerV2SummaryStatus("error");
      }
    }

    loadSchedulerV2Summary();
    return () => { cancelled = true; };
  }, [auth.loggedIn]);
  useEffect(() => {
    if (!auth.loggedIn) {
      setCareerBaseline(null);
      setCareerBaselineStatus("idle");
      return;
    }
    let cancelled = false;
    async function loadCareer() {
      setCareerBaselineStatus("loading");
      try {
        const data = await getCareerBaseline();
        if (cancelled) return;
        setCareerBaseline(data);
      } catch (_) {}
      if (!cancelled) setCareerBaselineStatus("idle");
    }
    loadCareer();
    return () => { cancelled = true; };
  }, [auth.loggedIn]);
  const totalYearsLabel = (() => {
    const y = Number(state.career?.totalYears || 0);
    if (!y || y <= 0) return "";
    return `${y}년`;
  })();
  const leadershipLabel = (() => {
    const raw = String(state?.career?.leadershipLevel ?? state?.leadershipLevel ?? "").trim();
    if (!raw) return "";
    if (raw === "manager" || raw === "executive" || raw === "LEAD") return "있음";
    return "";
  })();
  const educationLabel = (() => {
    const edu = __parsedResume?.education;
    if (!Array.isArray(edu) || edu.length === 0) return "";
    const first = edu[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof first === "object") {
      return String(first.degree || first.school || first.name || "").trim();
    }
    return "";
  })();
  const showCompanySizeCandidate = isDisplayableValue(companySizeCandidateValue);
  const showCompanySizeTarget = isDisplayableValue(companySizeTargetValue);
  const showInputSummaryAiNotice =
    !aiLoading &&
    (!!aiError ||
      (activeAiMeta &&
        (activeAiMeta.usedAI === false ||
          (activeAiMeta.status &&
            String(activeAiMeta.status).trim() &&
            String(activeAiMeta.status).trim().toLowerCase() !== "success"))));

  // ✅ PATCH: 아래 구간을 통째로 교체하세요.
  // 위치: ReportSection() 끝난 직후 ~ App()의 return( 시작 직전까지
  // 목적: ReportSection 밖에 튀어나온 JSX/닫는 태그/중복 블록 제거(문법 에러 원인)

  function ReportSection__LEGACY() {
    // ------------------------------
    // ✅ NEW (append-only): section open/close state (React)
    // - DOM attribute 토글 제거
    // - 클릭 안 되는 문제 근본 해결
    // ------------------------------
    const [__openSections, __setOpenSections] = useState({
      document: false,
      interview: false,
      other: false,
    });

    const __toggleOpen = (key) => {
      __setOpenSections((prev) => ({
        ...prev,
        [key]: !prev?.[key],
      }));
    };
    const leadershipGap = activeAnalysis?.reportPack?.internalSignals?.leadershipGap || null;
    const showLeadershipHint = (leadershipGap?.gap ?? 0) >= 1;
    return (
      <Card ref={reportRef} className="bg-background/70 backdrop-blur">
        <CardHeader className="space-y-3">
          {/* --- Semantic Match (Beta) : status-only (append-only) --- */}
          {/* (moved) Semantic Match UI is now rendered under Top3 in SimulatorLayout.jsx */}
          {null}
          {showLeadershipHint ? (
            <div className="text-sm text-slate-600">
              💡 이 JD는 리드/오너십 요구 신호가 있는데, 이력서에서 주도/책임/의사결정 근거가 더 있으면 분석이 더 정밀해져요.
            </div>
          ) : null}
          {/* ✅ append-only: leadership 채용 해석 포인트 (점수 무영향) */}
          {(() => {
            const lr = activeAnalysis?.leadershipRisk ?? null;
            if (!lr || lr.riskLevel === "none" || !lr.type) return null;
            const mainMsg = {
              leadership_gap: "지원 역할은 리더 경험을 요구하는 방향으로 해석될 수 있어, 실제 리딩 경험 여부를 추가 확인받을 가능성이 있습니다.",
              scope_mismatch: "현재 리더십 수준과 지원 역할 범위 사이에 차이가 있어, 채용 측이 역할 적합성을 추가로 확인할 수 있습니다.",
              overqualified: "현재 리더십 수준 대비 지원 역할이 더 실무 중심으로 보여, 오버스펙 또는 역할 불일치로 해석될 수 있습니다.",
            }[lr.type] ?? null;
            if (!mainMsg) return null;
            const scaleNote = lr.scaleDirection === "upgrade"
              ? " 상향 이동 맥락에서는 일부 완화될 수 있습니다."
              : lr.scaleDirection === "downgrade"
                ? " 하향 이동 맥락에서는 의문이 더 커질 수 있습니다."
                : null;
            return (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="text-xs font-medium text-slate-400 block mb-1">채용 해석 포인트</span>
                {mainMsg}{scaleNote}
              </div>
            );
          })()}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg">분석 리포트</CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                이 결과는 <span className="text-foreground font-medium">가설</span>입니다. 내부 기준/경쟁자/예산/타이밍으로
                달라질 수 있어요.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-slate-200/80 bg-white/60 shadow-sm hover:bg-white"
                onClick={copyReport}
                disabled={!activeAnalysis?.report || isAnalyzing}
              >
                <Clipboard className="h-4 w-4 mr-2" />
                복사
              </Button>

              <Button
                className="rounded-xl bg-slate-900 text-white shadow-sm hover:bg-slate-800"
                onClick={downloadReport}
                disabled={!activeAnalysis?.report || isAnalyzing}
              >
                <Download className="h-4 w-4 mr-2" />
                다운로드
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-full bg-slate-50/70 border border-slate-200/80 text-slate-700">
              단정 금지
            </Badge>

            <Badge className="rounded-full bg-slate-50/70 border border-slate-200/80 text-slate-700">
              객관 스코어 기반
            </Badge>

            <Badge className="rounded-full bg-slate-50/70 border border-slate-200/80 text-slate-700">
              가설-근거-액션
            </Badge>

            {sampleMode ? (
              <Badge className="rounded-full bg-slate-50/70 border border-slate-200/80 text-slate-700">
                샘플 모드
              </Badge>
            ) : null}

            {isAnalyzing ? (
              <Badge className="rounded-full bg-slate-100 text-slate-700">
                분석 중…
              </Badge>
            ) : null}

            {aiLoading ? (
              <Badge className="rounded-full bg-slate-100 text-slate-700">
                AI 준비 중…
              </Badge>
            ) : null}

            {!aiLoading && aiConnected ? (
              <Badge className="rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-700">
                AI 연결됨
              </Badge>
            ) : null}

            {aiError ? (
              <Badge className="rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-700">
                AI 오류
              </Badge>
            ) : null}

            {activeAiMeta?.status ? (
              <Badge className="rounded-full bg-slate-50/70 border border-slate-200/80 text-slate-700">
                AI: {String(activeAiMeta.status)}
              </Badge>
            ) : null}

            {typeof activeAiMeta?.usedAI === "boolean" ? (
              <Badge className="rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-700">
                usedAI: {activeAiMeta.usedAI ? "true" : "false"}
              </Badge>
            ) : null}
          </div>

          {aiError ? (
            <div className="text-xs text-muted-foreground">
              AI 보강이 실패해도 분석은 정상 동작합니다. (사유: {String(aiError)})
            </div>
          ) : null}

          {sampleMode ? (
            <div className="text-xs text-muted-foreground">
              샘플 리포트는 사용자 입력(state/localStorage)을 덮어쓰지 않습니다. (표시만 샘플로 전환)
              <Button
                variant="outline"
                size="sm"
                className="rounded-full ml-2"
                onClick={() => {
                  clearSampleMode();
                  toast({ title: "샘플 모드 해제", description: "내 입력 기반 화면으로 돌아갑니다." });
                }}
              >
                샘플 모드 해제
              </Button>
            </div>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-6">
          {isAnalyzing && !activeAnalysis ? (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin" />
              입력을 바탕으로 가설을 구성하는 중입니다…
            </div>
          ) : !activeAnalysis ? (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              아직 분석이 실행되지 않았습니다. 상단 또는 면접 단계에서 <b>분석하기</b>를 눌러 주세요.
            </div>
          ) : (
            <>
              <Card className="relative rounded-2xl border-0 bg-white shadow-lg shadow-black/5 ring-1 ring-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold tracking-tight">
                    핵심 판단 요약
                  </CardTitle>

                  <div className="text-xs text-muted-foreground">가장 먼저 보는 객관 신호(요약)입니다</div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      키워드 매칭 {Math.round((activeAnalysis.keywordSignals?.matchScore ?? 0) * 100)}/100
                    </Badge>
                    <Badge variant="outline">공백 {activeCareer.gapMonths}개월</Badge>
                    <Badge variant="outline">이직 {activeCareer.jobChanges}회</Badge>
                    <Badge variant="outline">직전근속 {activeCareer.lastTenureMonths}개월</Badge>
                    <Badge variant="outline">내회사규모 {normalizeCompanySizeValue(state.companySizeCandidate || "unknown")}</Badge>
                    <Badge variant="outline">지원회사규모 {normalizeCompanySizeValue(state.companySizeTarget || "unknown")}</Badge>
                  </div>
                  {activeAnalysis.keywordSignals?.missingKeywords?.length ? (
                    <div className="text-xs text-muted-foreground">
                      누락 키워드(상위): {activeAnalysis.keywordSignals.missingKeywords.slice(0, 8).join(", ")}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-slate-200/60 bg-background/70 backdrop-blur
  transition-[border-color,box-shadow] duration-200
  hover:border-violet-300/60 hover:ring-1 hover:ring-violet-400/15 hover:shadow-md
  focus-within:border-violet-300/60 focus-within:ring-1 focus-within:ring-violet-400/15">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">전문가 제언</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    자가진단(주관)과 객관 신호(텍스트 분석)를{" "}
                    <span className="text-foreground font-medium">교차 검증</span>해서, 다음 액션을 더 선명하게 잡아드립니다.
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {expertAdvice.length ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {expertAdvice.map((t, i) => (
                        <li key={i} className="text-foreground/85 leading-relaxed">
                          {t}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      비교할 데이터가 부족합니다. JD/이력서 입력 후 다시 분석해 주세요.
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence>
                  {(() => {

                    const decisionToHypothesis = (r) => {
                      if (!r) return null;

                      // ------------------------------
                      // ✅ 출력 정제(append-only): 제외/한글화/기본 액션/기본 반례
                      // ------------------------------
                      const _t = (v) => (v == null ? "" : String(v));
                      const _lc = (v) => _t(v).toLowerCase();

                      const id = r.id || r.key || r.name;
                      const rawTitle = _t(r.title || r.label || r.name || id || "decisionRisk");
                      const rawSummary = _t(r.summary || r.reason || r?.explain?.summary || "");
                      // ✅ explain.actionsV2/actions 우선 사용(append-only)
                      const __explainActions =
                        (Array.isArray(r?.explain?.actionsV2) && r.explain.actionsV2.length)
                          ? r.explain.actionsV2
                          : (Array.isArray(r?.explain?.actions) && r.explain.actions.length)
                            ? r.explain.actions
                            : null;
                      // ✅ 요청 제외 4종(안전하게 2중 필터: id + 텍스트 포함)
                      const _EXCLUDE_ID = new Set([
                        "LOW_CONTENT_DENSITY_RISK",
                        "RESUME_STRUCTURE__LOW_CONTENT_DENSITY",
                        "OWNERSHIP__NO_DECISION_AUTHORITY_SIGNAL",
                        "IMPACT__LOW_IMPACT_VERBS",
                        "ROLE_SKILL__LOW_SEMANTIC_SIMILARITY",
                      ]);
                      const _EXCLUDE_TEXT = [
                        "low content density",
                        "ownership no decision authority",
                        "impact low impact verbs",
                        "role skill low semantic similarity",
                      ];
                      const _blob = (_lc(id) + " " + _lc(rawTitle) + " " + _lc(rawSummary)).trim();
                      const _shouldExclude =
                        (id && _EXCLUDE_ID.has(String(id))) ||
                        _EXCLUDE_TEXT.some((k) => _blob.includes(k));

                      if (_shouldExclude) return null;

                      const group = r.group || r.category || null;
                      const layer = r.layer || r.riskLayer || null;
                      const priority = typeof r.priority === "number" ? r.priority : null;
                      const __num = (v) => {
                        const n = Number(v);
                        return isFinite(n) ? n : 0;
                      };

                      const __clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

                      // priority(원본)이 0~100일 수도, 0~1일 수도 있으니 0~1로 정규화
                      const __prioRaw = priority == null ? 0 : __num(priority);
                      const _prio = __clamp01(__prioRaw <= 1 ? __prioRaw : (__prioRaw / 100));

                      // score도 마찬가지로 0~1 또는 0~100 혼재 가능하니 0~1로 만든 다음 0~100으로 변환
                      const __scoreRaw = r && typeof r.score === "number" ? __num(r.score) : _prio;
                      const __score01 = __clamp01(__scoreRaw <= 1 ? __scoreRaw : (__scoreRaw / 100));
                      const _score100 = Math.round(__score01 * 100);
                      // ✅ 한글 타이틀 매핑 (필요시 계속 확장)
                      const _TITLE_MAP = {
                        // ownershipLeadership


                        // senioritySalary
                        SENIORITY_SALARY_RISK: "연차/연봉 정합성 리스크",
                        SENIORITY__SALARY_JUMP: "연봉 점프(시장 대비) 리스크",

                        // gates (표시되는 경우 대비)
                        HARD_MUST_HAVE_MISSING_GATE: "필수 요건 미충족(게이트)",
                        CRITICAL_EXPERIENCE_GAP_GATE: "핵심 경력 공백(게이트)",
                        EXPERIENCE_GAP_GATE: "경력 공백/불일치(게이트)",
                        EDUCATION_GATE_RISK: "학력 요건(게이트)",
                        AGE_GATE_RISK: "연령 요건(게이트)",
                      };

                      // ✅ 표시용 title/why는 "id 매핑 → 키워드 → group fallback" 순서로 결정
                      const _ID = id ? String(id) : "";
                      const _ID_LC = _lc(_ID);

                      let displayTitle =
                        (_ID && _TITLE_MAP[_ID]) ||
                        // id가 소문자/다른 포맷이면 텍스트로도 잡기
                        (_ID_LC.includes("seniority") && _ID_LC.includes("salary") ? "연차/연봉 정합성 리스크" : null) ||
                        (_ID_LC.includes("companyspecificity") ? "회사 맞춤화 부족 리스크" : null) ||
                        (_ID_LC.includes("rolespecificity") ? "직무 맞춤화 부족 리스크" : null) ||
                        null;

                      // ✅ group 기반 fallback (지금처럼 title이 다 똑같아지는 것 방지)
                      if (!displayTitle) {
                        if (group === "senioritySalary") displayTitle = "연차/연봉 정합성 리스크";
                        else if (group === "signal") displayTitle = "회사 맞춤화 부족 리스크";
                        else if (group === "role") displayTitle = "직무 맞춤화 부족 리스크";
                        else if (group === "ownershipLeadership") displayTitle = "오너십/주도성 근거 부족";
                        else if (group === "impactEvidence") displayTitle = "성과 임팩트 근거 약함";
                        else if (group === "roleSkillFit") displayTitle = "직무-스킬 적합성 리스크";
                        else displayTitle = (/[\u3131-\uD79D]/.test(rawTitle) ? rawTitle : "의사결정 리스크(가설)");
                      }

                      // ✅ why(설명)도 group에 따라 기본 텍스트를 달리해서 "같은 문장 반복"을 줄임
                      // ------------------------------
                      // [PATCH] prefer profile explain payload (append-only)
                      // ------------------------------
                      const __profileExplain =
                        r && typeof r.explain === "function"
                          ? r.explain(state ? { state, objective } : {})
                          : r && typeof r.explain === "object"
                            ? r.explain
                            : null;

                      const __explainTitle =
                        __profileExplain && typeof __profileExplain.title === "string"
                          ? __profileExplain.title
                          : null;

                      const __explainWhy =
                        __profileExplain && Array.isArray(__profileExplain.why)
                          ? __profileExplain.why.join(" ")
                          : __profileExplain && typeof __profileExplain.why === "string"
                            ? __profileExplain.why
                            : null;

                      const __explainSignals =
                        __profileExplain && Array.isArray(__profileExplain.signals)
                          ? __profileExplain.signals
                          : null;

                      const __explainActionsFromProfile =
                        __profileExplain && Array.isArray(__profileExplain.action)
                          ? __profileExplain.action
                          : null;

                      const __explainCounter =
                        __profileExplain && Array.isArray(__profileExplain.counter)
                          ? __profileExplain.counter.join(" ")
                          : null;
                      let baseWhy = rawSummary;

                      if (!baseWhy) {
                        if (group === "senioritySalary") baseWhy = "연봉/직급/나이 조합에서 리스크 신호가 일부 감지됨";
                        else if (group === "signal") baseWhy = "지원 회사에 맞춘 ‘회사 특이성’ 근거가 부족해 보입니다.";
                        else if (group === "role") baseWhy = "지원 직무에 맞춘 ‘직무 특이성’ 근거가 부족해 보입니다.";
                        else baseWhy = "단정이 아닌 가설입니다. 입력 정보가 많을수록 품질이 올라갑니다.";
                      }

                      // ✅ 너무 흔한 문구만 들어오는 경우(중복 체감) 최소 보정
                      if (_lc(baseWhy) === _lc("단정이 아닌 가설입니다. 입력 정보가 많을수록 품질이 올라갑니다.")) {
                        if (group === "signal") baseWhy = "지원 회사 맞춤형 근거(왜 이 회사인지/왜 지금인지)가 약해 보입니다.";
                        if (group === "role") baseWhy = "지원 직무 핵심 요구(JD) 대비 ‘내가 했던 일’ 연결 고리가 약해 보입니다.";
                      }


                      // ✅ 기본 액션/반례 템플릿 (비어있을 때만 채움)
                      const baseActionsCommon = [
                        "JD 핵심 요구 3개를 뽑고, 이력서에 ‘성과/수치/범위’로 1:1 매핑해 보세요.",
                        "최근 1년 내 대표 성과 2개를 ‘문제–행동–결과’ 포맷으로 고정해 보세요.",
                      ];
                      const baseCounterCommon = [
                        "이 신호는 지원 회사/직무/연차/시장 상황에 따라 무력화될 수 있습니다.",
                        "면접/포트폴리오에서 수치·산출물로 근거를 제시하면 영향이 크게 줄어듭니다.",
                      ];

                      const baseActionsByGroup = (() => {
                        if (group === "senioritySalary") {
                          return [
                            "목표 연봉/직급의 근거를 ‘시장·규모·역할’ 기준으로 숫자(성과/범위)로 제시해 보세요.",
                            "직무 난이도 상승(혹은 하향 지원) 사유를 3문장 스토리로 고정하고, JD 기준 핵심 성과 증거를 붙이세요.",
                          ];
                        }
                        if (group === "ownershipLeadership") {
                          return [
                            "‘내가 주도해서 시작한 일(initiated)’ 2개를 뽑고, 왜 시작했는지(문제)→어떻게 밀었는지(의사결정)→무슨 결과가 났는지(수치)로 정리해 보세요.",
                            "의사결정 권한이 약했다면, ‘영향 범위(팀/매출/지표)’와 ‘실제 기여(내가 한 결정/조율/설득)’를 분리해서 증빙해 보세요.",
                          ];
                        }
                        if (group === "impactEvidence") {
                          return [
                            "성과 문장에서 ‘행동 동사’ 대신 ‘결과 지표(%, 원, 건, 시간)’를 앞에 배치해 보세요.",
                            "임팩트가 작아 보이는 경우, 규모(트래픽/사용자/매출/비용) 기준을 먼저 제시하고 개선 폭을 붙이세요.",
                          ];
                        }
                        if (group === "roleSkillFit") {
                          return [
                            "JD의 must-have 5개 키워드를 뽑고, 이력서 문장에 같은 용어/동의어로 명시해 보세요.",
                            "직무 핵심 역량 2개에 대해 ‘내가 실제로 한 일 + 결과’ 예시를 1개씩 추가해 보세요.",
                          ];
                        }
                        return baseActionsCommon;
                      })();
                      const actions =
                        (Array.isArray(r?.actions) && r.actions.length)
                          ? r.actions
                          : (__explainActionsFromProfile && __explainActionsFromProfile.length)
                            ? __explainActionsFromProfile
                            : (__explainActions && __explainActions.length)
                              ? __explainActions
                              : baseActionsByGroup;
                      const counterExamples =
                        Array.isArray(r.counterExamples) && r.counterExamples.length
                          ? r.counterExamples
                          : baseCounterCommon;

                      const signals = [
                        group ? `group: ${group}` : null,
                        layer ? `layer: ${layer}` : null,
                        priority !== null ? `priority: ${priority}` : null,
                      ].filter(Boolean);

                      const _score = priority !== null ? priority : 0;

                      return {
                        id: `DECISION_${id || Math.random().toString(36).slice(2)}`,
                        title: __explainTitle || rawTitle,
                        why: __explainWhy || rawSummary || baseWhy,
                        signals,
                        actions,
                        // ✅ 반례/예외 표시 호환(컴포넌트별 키 차이 방어: append-only)
                        counterExamples,
                        counterexamples: counterExamples,
                        counterExample: counterExamples,
                        counterexample: counterExamples,
                        exceptions: counterExamples,
                        counter: counterExamples,
                        // ✅ "우선순위 0/100" 방지용 표시 점수(컴포넌트가 score류를 쓰는 경우 대비)
                        score: _score100,
                        priorityScore: _score100,
                        priority: _prio,
                        raw: r,
                        _type: "decisionRisk",
                      };
                    };

                    const __decisionRisksRaw =
                      (activeAnalysis?.decisionPack?.riskResults
                        || activeAnalysis?.reportPack?.decisionPack?.riskResults
                        || []);
                    const __decisionHypothesesRaw = __decisionRisksRaw
                      .map(decisionToHypothesis)
                      .filter(Boolean);
                    // ----------------------------------------------
                    // ✅ initiative V2 우선/비교 표시(append-only)
                    // - V2 카드가 있으면 리스트에서 우선 노출(정렬 전에 점프)
                    // - V1(OWNERSHIP__NO_PROJECT_INITIATION_SIGNAL) 카드에 V2 요약 2줄을 덧붙임
                    // ----------------------------------------------
                    const __initV2RiskRaw = __decisionRisksRaw.find((x) => (x?.id || x?.key || x?.name) === "RISK__INITIATIVE_V2") || null;
                    const __initV2Explain = __initV2RiskRaw?.explain || null;
                    const __initV2Score = __initV2Explain?.initiativeScoreV2 || null;

                    const __initV2Band = __initV2Score?.band ? String(__initV2Score.band) : "";
                    const __initV2Norm =
                      typeof __initV2Score?.norm === "number"
                        ? Math.round(__initV2Score.norm * 100)
                        : null;

                    const __initV2Missing = Array.isArray(__initV2Explain?.missingSignals)
                      ? __initV2Explain.missingSignals.slice(0, 4).join(", ")
                      : "";

                    const __v2HintLine =
                      __initV2RiskRaw
                        ? `\n\n[V2 비교] band=${__initV2Band || "-"} · norm=${__initV2Norm == null ? "-" : (__initV2Norm + "/100")}`
                        : "";

                    const __v2MissingLine =
                      (__initV2RiskRaw && __initV2Missing)
                        ? `\n[V2 부족 신호] ${__initV2Missing}`
                        : "";

                    // V1 카드에 V2 비교 문구 붙이기(append-only)
                    const __decisionHypothesesWithV2Compare = __decisionHypothesesRaw.map((h) => {
                      const rid = h?.raw?.id || h?.raw?.key || h?.raw?.name || "";
                      if (String(rid) !== "OWNERSHIP__NO_PROJECT_INITIATION_SIGNAL") return h;
                      if (!__initV2RiskRaw) return h;
                      const why0 = (h?.why ?? "").toString();
                      if (why0.includes("[V2 비교]")) return h; // 중복 방지
                      return {
                        ...h,
                        why: `${why0}${__v2HintLine}${__v2MissingLine}`,
                      };
                    });

                    // V2 카드를 맨 앞으로 당기기(append-only)
                    const __decisionHypotheses = (() => {
                      const list = Array.isArray(__decisionHypothesesWithV2Compare) ? __decisionHypothesesWithV2Compare.slice() : [];
                      const idx = list.findIndex((h) => String(h?.raw?.id || h?.raw?.key || "") === "RISK__INITIATIVE_V2");
                      if (idx <= 0) return list;
                      const v2 = list.splice(idx, 1)[0];
                      list.unshift(v2);
                      return list;
                    })();
                    // ✅ dedupe(append-only): 같은 성격의 카드 반복 방지
                    const __dedupedDecisionHypotheses = (() => {
                      const bestByKey = new Map();
                      for (const h of __decisionHypotheses) {
                        if (!h) continue;
                        const g = h?.raw?.group ?? "";
                        const l = h?.raw?.layer ?? "";
                        const t = h?.title ?? "";
                        const key = `${g}::${l}::${t}`;
                        const cur = bestByKey.get(key);
                        // [CONTRACT] dedup 우승자 선택 기준: priority 단독. score fallback 제거.
                        const curScore = typeof cur?.priority === "number" ? cur.priority : -1;
                        const nextScore = typeof h?.priority === "number" ? h.priority : -1;
                        if (!cur || nextScore > curScore) bestByKey.set(key, h);
                      }
                      return Array.from(bestByKey.values());
                    })();
                    // ----------------------------------------------
                    // ✅ NEW (append-only): refinedRiskResults 우선 적용
                    // - decisionPack.refinedRiskResults가 "배열 + 길이>0"이면 그걸 사용
                    // - 아니면 기존 deduped 로직 fallback
                    // - (운영 안정성) refined가 비정상 타입이면 무조건 fallback
                    // ----------------------------------------------

                    const __refinedDecisionRisksRaw =
                      (activeAnalysis?.decisionPack?.refinedRiskResults
                        || activeAnalysis?.reportPack?.decisionPack?.refinedRiskResults);

                    // ✅ normalize: always array for view model input (append-only, view-only)
                    const __refinedDecisionRisks =
                      Array.isArray(__refinedDecisionRisksRaw)
                        ? __refinedDecisionRisksRaw
                        : (Array.isArray(__refinedDecisionRisksRaw?.items) ? __refinedDecisionRisksRaw.items : null);

                    const __decisionSourceRaw =
                      __refinedDecisionRisks && __refinedDecisionRisks.length > 0
                        ? __refinedDecisionRisks
                        : __dedupedDecisionHypotheses;

                    // ✅ final normalize (defensive): if somehow object sneaks in, fallback to empty array
                    // ✅ final normalize (defensive): if somehow object sneaks in, fallback to empty array
                    const __decisionSource = Array.isArray(__decisionSourceRaw) ? __decisionSourceRaw : [];

                    // ----------------------------------------------
                    // ✅ NEW (append-only): Top3 fallback from riskLayer.drivers (view-only)
                    // - decisionPack/refined/deduped가 비었을 때도 Top3가 "체감"되게
                    // - score/gate/riskProfiles/engine 무영향
                    // ----------------------------------------------
                    const __docDriversRaw = activeAnalysis?.reportPack?.riskLayer?.documentRisk?.drivers;
                    const __intDriversRaw = activeAnalysis?.reportPack?.riskLayer?.interviewRisk?.drivers;

                    const __docDrivers = Array.isArray(__docDriversRaw) ? __docDriversRaw : [];
                    const __intDrivers = Array.isArray(__intDriversRaw) ? __intDriversRaw : [];

                    const __fallbackDrivers = __docDrivers.concat(__intDrivers);

                    // drivers(string[]) -> riskResults(object[]) adapter (UI only)
                    const __fallbackDriverRisks =
                      __fallbackDrivers.length > 0
                        ? __fallbackDrivers.map((t, idx) => {
                          const isDoc = idx < __docDrivers.length;
                          const layer = isDoc ? "document" : "interview";
                          const priority = 60 - idx; // view-only heuristic (no engine impact)
                          const id = `DRIVER__${layer.toUpperCase()}__${idx}`;
                          return {
                            id,
                            layer,
                            priority,
                            group: "DRIVER",
                            title: String(t || ""),
                            message: String(t || ""),
                            raw: { id, layer, priority, group: "DRIVER" },
                          };
                        })
                        : [];

                    // ✅ simVM input: decisionSource가 비면 fallback risks 사용
                    const __simSource =
                      __decisionSource.length > 0 ? __decisionSource : __fallbackDriverRisks;

                    // (TMP_DEBUG) 원하면 잠깐 켜서 확인 후 지우세요
                    // console.log("[TMP_DEBUG] simSource:", __simSource.length, __simSource[0] || null);

                    const __careerHistoryForSimVM =
                      (Array.isArray(activeAnalysis?.state?.careerHistory) && activeAnalysis.state.careerHistory.length > 0 && activeAnalysis.state.careerHistory) ||
                      (Array.isArray(activeAnalysis?.__passmapSnap?.state?.careerHistory) && activeAnalysis.__passmapSnap.state.careerHistory.length > 0 && activeAnalysis.__passmapSnap.state.careerHistory) ||
                      (Array.isArray(analysis?.state?.careerHistory) && analysis.state.careerHistory.length > 0 && analysis.state.careerHistory) ||
                      (Array.isArray(activeAnalysis?.state?.career?.history) && activeAnalysis.state.career.history.length > 0 && activeAnalysis.state.career.history) ||
                      null;
                    const __ssotSimVM =
                      activeAnalysis?.reportPack?.simulationViewModel ||
                      activeAnalysis?.reportPack?.simVM ||
                      activeAnalysis?.simulationViewModel ||
                      activeAnalysis?.simVM ||
                      analysis?.reportPack?.simulationViewModel ||
                      analysis?.reportPack?.simVM ||
                      analysis?.simulationViewModel ||
                      analysis?.simVM ||
                      null;
                    const __simVM = __ssotSimVM || buildSimulationViewModel(__simSource, { careerHistory: __careerHistoryForSimVM });
                    const __dpForSimVM =
                      activeAnalysis?.decisionPack ||
                      activeAnalysis?.reportPack?.decisionPack ||
                      analysis?.decisionPack ||
                      analysis?.reportPack?.decisionPack ||
                      null;
                    const __simVMBridgedBase = __bridgeSimVmWithDecisionScore(__simVM, __dpForSimVM);
                    const __simVMBridged = __bridgeSimVmWithSemanticPolicy(
                      __simVMBridgedBase,
                      activeAnalysis || analysis || null
                    );
                    try {
                      if (typeof window !== "undefined") {
                        const __analysisForSimDbg = activeAnalysis || analysis || null;
                        window.__SIM_INPUT_DBG__ = {
                          simLayoutProp: __simVMBridged || null,
                          analysisSimulationViewModel: __analysisForSimDbg?.simulationViewModel || null,
                          reportPackSimulationViewModel: __analysisForSimDbg?.reportPack?.simulationViewModel || null,
                          reportPackTop3Ids: Array.isArray(__analysisForSimDbg?.reportPack?.simulationViewModel?.top3)
                            ? __analysisForSimDbg.reportPack.simulationViewModel.top3.map((x) => x?.id)
                            : [],
                        };
                      }
                    } catch { /* silent */ }
                    // ✅ VIEW-ONLY LIMIT (trust protection): show at most 2 gates + 5 normals
                    // engine/scoring/storage remains untouched
                    // [CONTRACT] gate 분류 기준: 정규화된 h.layer 단독.
                    // raw.layer fallback 금지 — raw가 layer보다 먼저 평가되면 정규화 결과가 무시됨.
                    // id prefix("GATE__") 기반 gate 추론 금지.
                    const __getLayerSafe = (h) => String(h?.layer || "").toLowerCase();

                    // [CONTRACT] 정렬 기준: 정규화된 priority 단독.
                    // raw.priority / priorityScore / score fallback 체인 전부 제거.
                    const __getPrioritySafe = (h) => {
                      const num = typeof h?.priority === "number" ? h.priority : Number(h?.priority);
                      return Number.isFinite(num) ? num : 0;
                    };
                    // ----------------------------------------------
                    // ✅ displayRankBoost (append-only, view-only)
                    // - engine score/priority untouched
                    // - only affects UI ordering in this local sort
                    // - supports legacy selfCheck + future v3_6axis
                    // ----------------------------------------------
                    const __sc = (state && state.selfCheck && typeof state.selfCheck === "object") ? state.selfCheck : {};

                    const __getSelfAxis = (axisKey) => {
                      try {
                        // v3_6axis (future): selfCheck.doc.* / selfCheck.interview.*
                        const doc = (__sc?.doc && typeof __sc.doc === "object") ? __sc.doc : null;
                        if (doc && typeof doc[axisKey] !== "undefined") {
                          const v = Number(doc[axisKey]);
                          return Number.isFinite(v) ? v : 3;
                        }
                        // doc axisKey alias support (append-only)
                        const alias = {
                          domainLogic: ["domainLogic", "domain", "domainFit"],
                          roleClarity: ["roleClarity", "role", "roleFit"],
                          jdFit: ["jdFit", "coreFit", "fit"],
                          evidence: ["evidence", "proofStrength", "proof"],
                          metrics: ["metrics", "metric", "quant", "numbers"],
                          writingStructure: ["writingStructure", "storyConsistency", "structure"],
                        };

                        const keys = alias[axisKey] || [axisKey];
                        for (const k of keys) {
                          if (doc && typeof doc[k] !== "undefined") {
                            const v = Number(doc[k]);
                            return Number.isFinite(v) ? v : 3;
                          }
                        }

                        const interview = (__sc?.interview && typeof __sc.interview === "object") ? __sc.interview : null;
                        const interviewAxes = (interview?.axes && typeof interview.axes === "object") ? interview.axes : null;
                        if (interviewAxes && typeof interviewAxes[axisKey] !== "undefined") {
                          const v = Number(interviewAxes[axisKey]);
                          return Number.isFinite(v) ? v : 3;
                        }
                        if (interview && typeof interview[axisKey] !== "undefined") {
                          const v = Number(interview[axisKey]);
                          return Number.isFinite(v) ? v : 3;
                        }
                        // legacy fallback mapping
                        // - metrics/evidence: proofStrength
                        // - roleClarity: roleClarity
                        // - jdFit: coreFit
                        // - writingStructure: storyConsistency (closest legacy proxy)
                        if (axisKey === "metrics" || axisKey === "evidence") {
                          const v = Number(__sc?.proofStrength);
                          return Number.isFinite(v) ? v : 3;
                        }
                        if (axisKey === "roleClarity") {
                          const v = Number(__sc?.roleClarity);
                          return Number.isFinite(v) ? v : 3;
                        }
                        if (axisKey === "jdFit") {
                          const v = Number(__sc?.coreFit);
                          return Number.isFinite(v) ? v : 3;
                        }
                        if (axisKey === "domainLogic") {
                          // legacy에는 domainLogic이 없어서 가장 가까운 proxy로 coreFit 사용
                          const v = Number(__sc?.coreFit);
                          return Number.isFinite(v) ? v : 3;
                        }
                        if (axisKey === "writingStructure") {
                          const v = Number(__sc?.storyConsistency);
                          return Number.isFinite(v) ? v : 3;
                        }
                        return 3;
                      } catch {
                        return 3;
                      }
                    };

                    const __axisBoost = (v) => {
                      // v: 1~5 (default 3)
                      if (v <= 2) return 6;     // low => pull up
                      if (v >= 4) return -1;    // high => push down slightly
                      return 0;                 // mid => no change
                    };

                    const __displayRankBoost = (h) => {
                      try {
                        const rid = String(h?.raw?.id || h?.raw?.key || h?.id || h?.key || "");
                        // 0) role shift는 SHIFT 문자열 때문에 domain 조건에 먼저 걸릴 수 있어서 우선 처리
                        if (rid.includes("SIMPLE__ROLE_SHIFT") || rid.includes("ROLE_SHIFT")) {
                          return __axisBoost(__getSelfAxis("roleClarity"));
                        }
                        // 1) quantified impact / 숫자 성과 부족
                        if (rid.includes("QUANT") || rid.includes("METRIC") || rid.includes("NUMBER")) {
                          return __axisBoost(__getSelfAxis("metrics"));
                        }
                        // 2) resume structure / 글 구조
                        if (rid.includes("STRUCT") || rid.includes("CLARITY") || rid.includes("FORMAT") || rid.includes("WRITE")) {
                          return __axisBoost(__getSelfAxis("writingStructure"));
                        }
                        // 3) domain shift / 도메인 논리
                        if (rid.includes("DOMAIN") || rid.includes("SHIFT") || rid.includes("INDUSTR")) {
                          return __axisBoost(__getSelfAxis("domainLogic"));
                        }
                        // 4) JD fit / 핵심요건 핏
                        if (rid.includes("JD") || rid.includes("FIT") || rid.includes("REQUIRE")) {
                          return __axisBoost(__getSelfAxis("jdFit"));
                        }
                        return 0;
                      } catch {
                        return 0;
                      }
                    };
                    try {
                      window.__DBG_SC__ = __sc;
                      window.__DBG_BOOST__ = (h) => __displayRankBoost(h);
                    } catch { }
                    const __limitDecisionForView = (arr) => {
                      const list = Array.isArray(arr) ? arr.slice() : [];
                      // [CONTRACT] 정렬 기준: priority 단독.
                      // __displayRankBoost(selfCheck 가중치)를 sort key에 가산하는 것은 계약 위반 — 제거.
                      list.sort((a, b) => __getPrioritySafe(b) - __getPrioritySafe(a));

                      const gates = [];
                      const normals = [];

                      for (const h of list) {
                        const layer = __getLayerSafe(h);
                        if (layer === "gate") {
                          if (gates.length < 2) gates.push(h);
                        } else {
                          if (normals.length < 5) normals.push(h);
                        }
                        if (gates.length >= 2 && normals.length >= 5) break;
                      }

                      // [PATCH] Detail Dedupe v1 — display-level only (riskResults 원본 보존)
                      // buildSimulationViewModel Top3 Dedupe v1과 동일 의도를 상세 섹션에 적용.
                      // h.raw?.id (hypothesis path) 또는 h.id (raw path) 양쪽 모두 처리.
                      const __getRawId = (h) => String(h?.raw?.id || h?.id || "");
                      const __allViewIds = new Set([...gates, ...normals].map(__getRawId));
                      const __normalsDeduped = __allViewIds.has("GATE__CRITICAL_EXPERIENCE_GAP")
                        ? normals.filter((h) => __getRawId(h) !== "ROLE_SKILL__MUST_HAVE_MISSING")
                        : normals;

                      return gates.concat(__normalsDeduped);
                    };

                    const __decisionRisksForView = __limitDecisionForView(__decisionSource);

                    // ----------------------------------------------
                    // 기존 hypotheses merge 구조 유지
                    // ----------------------------------------------

                    const mergedHypotheses = [
                      ...__decisionRisksForView,
                      ...(activeAnalysis?.hypotheses || []),
                    ];


                    // ✅ TopN + 더보기(append-only): 핵심만 먼저 보여주고 나머지는 접기
                    // [CONTRACT] 정렬 기준: priority 단독.
                    // score / priorityScore fallback 제거.
                    const __getScore = (h) => {
                      const n = typeof h?.priority === "number" ? h.priority : Number(h?.priority);
                      return Number.isFinite(n) ? n : 0;
                    };
                    const __isDecision = (h) => h?._type === "decisionRisk" || String(h?.id || "").startsWith("DECISION_");

                    // [CONTRACT] 정렬 기준: priority 단독.
                    // __displayRankBoost(selfCheck 가중치) 가산 제거.
                    const __decisionSorted = mergedHypotheses
                      .filter(__isDecision)
                      .slice()
                      .sort((a, b) => __getScore(b) - __getScore(a));

                    const __others = mergedHypotheses.filter((h) => !__isDecision(h));


                    // decision을 먼저 + 나머지
                    const __allSorted = [...__decisionSorted, ...__others];

                    // ✅ layer 기반 섹션 분리(append-only)
                    const __getLayer = (h) => (h?.raw?.layer ?? "").toString();
                    const __layerBucket = (h) => {
                      const l = __getLayer(h);
                      if (l === "document") return "document";
                      if (l === "decision" || l === "hireability") return "interview";
                      return "other";
                    };

                    const __docList = __allSorted.filter((h) => __layerBucket(h) === "document");
                    const __interviewList = __allSorted.filter((h) => __layerBucket(h) === "interview");
                    const __otherList = __allSorted.filter((h) => __layerBucket(h) === "other");
                    // ✅ 섹션별 TopN + 더보기 (append-only)
                    const __TOP_PER_SECTION = 3;

                    const __splitTopMore = (arr) => {
                      const list = Array.isArray(arr) ? arr : [];
                      const top = list.slice(0, __TOP_PER_SECTION);
                      const more = list.slice(__TOP_PER_SECTION);
                      return { top, more };
                    };

                    const __doc = __splitTopMore(__docList);
                    const __interview = __splitTopMore(__interviewList);
                    const __other = __splitTopMore(__otherList);

                    // ✅ local-only toggle(append-only): 섹션별로 data-open 키 분리

                    // ----------------------------------------------
                    // ✅ NEW (append-only): severityTier 기반 그룹핑 + 섹션 생성
                    // ----------------------------------------------
                    const __normSeverityTier = (x) => {
                      const t = (x ?? "").toString().trim().toUpperCase();
                      return t === "S" || t === "A" || t === "B" || t === "C" || t === "D" ? t : null;
                    };

                    const __tierOrder = ["S", "A", "B", "C", "D"];

                    const __groupBySeverity = (arr) => {
                      const g = { S: [], A: [], B: [], C: [], D: [], _unknown: [] };
                      const list = Array.isArray(arr) ? arr : [];
                      for (const h of list) {
                        const t = __normSeverityTier(h?.severityTier);
                        if (t) g[t].push(h);
                        else g._unknown.push(h);
                      }
                      return g;
                    };
                    // ----------------------------------------------
                    // ✅ NOTE (append-only): 중복 선언 방지
                    // - __tierLabel / __buildTierSectionProps / __decisionTierSections 가
                    //   동일 스코프 내 다른 위치에서 이미 선언되어 "Cannot redeclare"가 발생했습니다.
                    // - 이 구간은 "중복 세트"로 판단하여 선언을 제거합니다.
                    // - 실제 decision tier 섹션 생성/렌더는 아래(또는 다른 위치)의 단일 선언 블록을 사용하세요.
                    // ----------------------------------------------

                    // (중복 선언 제거: 의도적으로 아무 것도 선언하지 않음)

                    // ----------------------------------------------
                    // ✅ 섹션 렌더 컴포넌트 (기존 유지)
                    // ----------------------------------------------
                    const __Section = ({ title, itemsTop, itemsMore, sectionKey }) => {
                      if (!itemsTop?.length && !itemsMore?.length) return null;
                      const moreCount = itemsMore?.length || 0;

                      return (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">{title}</div>
                          </div>

                          <div className="space-y-3">
                            {itemsTop.map((h, i) => (
                              <HypothesisCard key={h?.id || `${sectionKey}_top_${i}`} h={h} />
                            ))}
                          </div>

                          {moreCount > 0 ? (
                            <div className={`mt-3 space-y-3 hidden data-[open-${sectionKey}='1']:block`}>
                              {itemsMore.map((h, i) => (
                                <HypothesisCard key={h?.id || `${sectionKey}_more_${i}`} h={h} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    };

                    /* ------------------------------------------------
                    ✅ 중요: 아래 JSX는 "return ( ... )" 내부, 
                    결정 리스크(Decision) 섹션을 렌더링하던 자리에서 사용해야 합니다.
                    
                    예: <div className="space-y-3">{__decisionSource.map(...)}...</div>
                    이걸 아래로 교체/삽입
                    
                    {__decisionTierSections.map((sec) => (
                      <__Section
                        key={sec.sectionKey}
                        title={sec.title}
                        itemsTop={sec.itemsTop}
                        itemsMore={sec.itemsMore}
                        sectionKey={sec.sectionKey}
                      />
                    ))}
                    ------------------------------------------------- */

                    // ----------------------------------------------
                    // ✅ NEW (append-only): severityTier 정책 분배
                    // - S/A: 기본 펼침 (Top에 전부)
                    // - B/C: 기본 접힘 (More에 전부)
                    // - D: 기본 숨김(기본 미노출)
                    // ----------------------------------------------
                    // ✅ NEW (append-only): tier 섹션 생성이 참조하는 severityGroups를 이 스코프에 보장
                    const __severityGroups = __groupBySeverity(__decisionSource);

                    const __tierLabel = (t) =>
                      t === "S"
                        ? "긴급 리스크"
                        : t === "A"
                          ? "중요 리스크"
                          : t === "B"
                            ? "주의 리스크"
                            : t === "C"
                              ? "관찰 리스크"
                              : t === "D"
                                ? "낮은 리스크"
                                : "기타";

                    const __buildTierSectionProps = (tierKey) => {
                      const rawItems =
                        (__severityGroups && __severityGroups[tierKey]) ? __severityGroups[tierKey] : [];
                      if (!rawItems.length) return null;

                      let itemsTop = [];
                      let itemsMore = [];

                      if (tierKey === "S" || tierKey === "A") {
                        itemsTop = rawItems;
                        itemsMore = [];
                      } else if (tierKey === "B" || tierKey === "C") {
                        itemsTop = [];
                        itemsMore = rawItems;
                      } else if (tierKey === "D") {
                        // 기본 숨김 정책: 섹션 자체를 기본적으로 안 만들기
                        return null;
                      }
                      return {
                        title: __tierLabel(tierKey),
                        itemsTop,
                        itemsMore,
                        sectionKey: `decision_${tierKey}`,
                      };
                    };

                    const __decisionTierSections = Array.isArray(__tierOrder)
                      ? __tierOrder.map(__buildTierSectionProps).filter(Boolean)
                      : [];

                    return (
                      <div
                        className="space-y-5"
                        data-sections-root
                        data-open-document="0"
                        data-open-interview="0"
                        data-open-other="0"
                      >
                        {__isReportV2Ready(__simVMBridged) ? (
                          <ReportV2Container simVM={__simVMBridged} />
                        ) : (
                          <SimulatorLayout simVM={__simVMBridged} hideNextStep />
                        )}
                        <ComparisonSummary
                          parsedJD={__parsedJD}
                          parsedResume={__parsedResume}
                          state={state}
                          analysis={activeAnalysis}
                        />

                      </div>
                    );
                  })()}
                </AnimatePresence>
              </div>

              <Separator />

              <Card className="rounded-2xl border bg-background/70 backdrop-blur">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">다음 단계 제안</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="text-foreground leading-relaxed font-medium">
                    {(() => {
                      const a = activeAnalysis;

                      // 1) 룰 기반: 필수요건 누락은 최우선(즉시 컷)이라 무조건 fit으로 본다
                      const hasKnockoutMissing = Boolean(a?.keywordSignals?.hasKnockoutMissing);
                      if (hasKnockoutMissing) {
                        return (
                          <>
                            지금 상태에선 <span className="font-semibold">“필수요건 누락(즉시 컷)”</span>이 가장 위험합니다.
                          </>
                        );
                      }

                      // 2) 점수 기반(안전한 휴리스틱)
                      // - matchScore: 높을수록 좋음 => risk로 바꾸려면 1 - (score/100)
                      // - careerRiskScore: 높을수록 나쁨(리스크)로 가정
                      const matchScore = Number(a?.keywordSignals?.matchScore ?? 0);
                      const careerRiskScore = Number(a?.careerSignals?.careerRiskScore ?? 0);

                      const fitRisk = 1 - Math.max(0, Math.min(100, matchScore)) / 100;
                      const careerRisk = Math.max(0, Math.min(100, careerRiskScore)) / 100;

                      // 증거(성과) 관련 신호가 있으면 쓰고, 없으면 "텍스트 기반"으로 보조
                      const evidenceScoreCandidate =
                        a?.evidenceSignals?.evidenceStrengthScore ??
                        a?.evidenceSignals?.strengthScore ??
                        a?.objectiveSignals?.evidenceStrengthScore ??
                        a?.objectiveSignals?.evidenceStrength ??
                        null;

                      const evidenceRisk =
                        typeof evidenceScoreCandidate === "number"
                          ? 1 - Math.max(0, Math.min(100, evidenceScoreCandidate)) / 100
                          : (() => {
                            // 3) 텍스트 fallback (구조 몰라도 동작)
                            const raw =
                              typeof a?.report === "string"
                                ? a.report
                                : a?.report
                                  ? JSON.stringify(a.report)
                                  : JSON.stringify(a ?? "");
                            if (/성과|증거|수치|기여도|전후|검증/i.test(raw)) return 0.8;
                            if (/공백|근속|이직|퇴사|짧은/i.test(raw)) return 0.6;
                            if (/JD|필수|우대|요건|핏|매칭/i.test(raw)) return 0.6;
                            return 0.5;
                          })();

                      // 4) 가장 큰 risk를 top으로 선택
                      let top = "evidence";
                      let topRisk = evidenceRisk;

                      if (careerRisk > topRisk) {
                        top = "career";
                        topRisk = careerRisk;
                      }
                      if (fitRisk > topRisk) {
                        top = "fit";
                        topRisk = fitRisk;
                      }

                      if (top === "evidence") {
                        return (
                          <>
                            지금 상태에서 가장 먼저 바뀌어야 할 건{" "}
                            <span className="font-semibold">“성과 증명 구조”</span>입니다.
                          </>
                        );
                      }

                      if (top === "career") {
                        return (
                          <>
                            면접관 해석을 바꾸려면{" "}
                            <span className="font-semibold">“이직/근속 리스크 설명 구조”</span>를 고정해야 합니다.
                          </>
                        );
                      }

                      // top === "fit"
                      return (
                        <>
                          현재 리스크의 핵심은{" "}
                          <span className="font-semibold">“JD 직접 연결 부족”</span>입니다.
                        </>
                      );
                    })()}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    지금 상태로 지원을 반복하면 같은 구조로 해석될 가능성이 있습니다.
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      🔒 해석이 바뀌는 핵심 설계 (잠김)
                    </div>
                    <ul className="space-y-1 text-sm text-foreground/80">
                      <li>• JD 기준으로 재번역된 이력서 문장 구조</li>
                      <li>• 탈락 논리를 차단하는 면접 답변 프레임</li>
                    </ul>
                    <div className="text-xs text-muted-foreground">
                      상세 전략은 전략 설계 세션에서 제공합니다.
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button asChild variant="default" className="w-full">
                      <a href="https://coachingezig.mycafe24.com/contact/" target="_blank" rel="noreferrer">
                        🔵 내 통과 전략 설계받기 (30분)
                      </a>
                    </Button>

                    <Button asChild variant="outline" className="w-full">
                      <a
                        href="https://m.expert.naver.com/mobile/expert/product/detail?storeId=100049372&productId=100149761"
                        target="_blank"
                        rel="noreferrer"
                      >
                        면접 전략만 점검하기
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  onShareCopyCurrentReport();
                }}
              >
                {shareCopied ? "링크 복사됨" : "리포트 공유"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }


  if (shareMode || sharePayload) {
    const __shareReportEntryMode = String(sharePayload?.reportEntryMode || "").trim();
    const __shareTransitionLiteVm =
      __shareReportEntryMode === "transition-lite" &&
      sharePayload?.transitionLiteResultVm &&
      typeof sharePayload.transitionLiteResultVm === "object"
        ? sharePayload.transitionLiteResultVm
        : null;
    const __sharePreciseAnalysis =
      __shareReportEntryMode === "precise-analysis" &&
      sharePayload?.preciseAnalysis &&
      typeof sharePayload.preciseAnalysis === "object"
        ? sharePayload.preciseAnalysis
        : null;
    // ✅ current VM SSOT: reportPack.simulationViewModel
    const simVM =
      sharePayload?.reportPack?.simulationViewModel ||
      sharePayload?.reportPack?.simVM ||
      sharePayload?.simulationViewModel ||
      sharePayload?.simVM ||
      null;
    const __shareDP = sharePayload?.decisionPack || null;
    const __simVMBridgedBase = __bridgeSimVmWithDecisionScore(simVM, __shareDP);
    const __simVMBridged = __bridgeSimVmWithSemanticPolicy(
      __simVMBridgedBase,
      sharePayload || activeAnalysis || analysis || null
    );
    try {
      if (typeof window !== "undefined") {
        const __analysisForSimDbg = sharePayload || activeAnalysis || analysis || null;
        window.__SIM_INPUT_DBG__ = {
          simLayoutProp: __simVMBridged || null,
          analysisSimulationViewModel: __analysisForSimDbg?.simulationViewModel || null,
          reportPackSimulationViewModel: __analysisForSimDbg?.reportPack?.simulationViewModel || null,
          reportPackTop3Ids: Array.isArray(__analysisForSimDbg?.reportPack?.simulationViewModel?.top3)
            ? __analysisForSimDbg.reportPack.simulationViewModel.top3.map((x) => x?.id)
            : [],
        };
      }
    } catch { /* silent */ }

    // [ComparisonSummary] share 경로용 parsed fallback
    const __shareParsedJD =
      sharePayload?.__passmapSnap?.state?.__parsedJD ||
      sharePayload?.state?.__parsedJD ||
      (typeof window !== "undefined" ? window.__PARSED_JD__ : null) ||
      null;
    const __shareParsedResume =
      sharePayload?.__passmapSnap?.state?.__parsedResume ||
      sharePayload?.state?.__parsedResume ||
      (typeof window !== "undefined" ? window.__PARSED_RESUME__ : null) ||
      null;
    const __shareState =
      sharePayload?.__passmapSnap?.state ||
      sharePayload?.state ||
      null;
    const __shareSelectedRenderBranch =
      shareLoading
        ? "share-loading"
        : __sharePreciseAnalysis
          ? "precise-analysis"
          : __simVMBridged
          ? (__shareTransitionLiteVm ? "transition-lite" : (__isReportV2Ready(__simVMBridged) ? "precise-report-v2" : "precise-simulator-layout"))
          : (shareLoadError ? "share-error" : "share-empty");
    const shouldRenderShareComparisonSummary = !__shareTransitionLiteVm && !__sharePreciseAnalysis;
    try {
      if (typeof window !== "undefined") {
        window.__PASSMAP_SHARE_RENDER_DEBUG__ = {
          at: Date.now(),
          shareMode: !!shareMode,
          hasSharePayload: !!sharePayload,
          loadedReportEntryMode: __shareReportEntryMode,
          loadedTransitionLiteVmExists: !!__shareTransitionLiteVm,
          loadedHasSimVM: !!simVM,
          actualSelectedRenderBranch: __shareSelectedRenderBranch,
        };
      }
    } catch { }

    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="PASSMAP 첫 화면으로 이동"
            className="inline-flex items-center"
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/passmap-logo-horizontal-purple-small.png`}
              alt="PASSMAP"
              className="h-7 w-auto object-contain"
            />
          </button>
        </header>
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">공유된 리포트</div>
              <div className="text-xl font-semibold text-foreground">면접관 판단 시뮬레이터</div>
            </div>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                try {
                  const url = `${window.location.origin}${window.location.pathname}`;
                  window.location.href = url;
                } catch { }
              }}
            >
              내 리포트 만들기
            </Button>
          </div>
        </div>

        {__isKakaoInApp() && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">
            {(() => { try { globalThis.__DBG_IAB__ = { at: Date.now(), ua: navigator.userAgent, href: window.location.href }; } catch { } return null; })()}
            <div className="rounded-2xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm flex items-center justify-between gap-3">
              <span className="text-yellow-800">카카오톡 앱 내 브라우저에서 화면이 안 열릴 수 있어요. Chrome(외부 브라우저)로 열어주세요.</span>
              <button
                className="shrink-0 rounded-lg bg-yellow-400 px-3 py-1.5 text-xs font-semibold text-yellow-900 active:bg-yellow-500"
                onClick={() => {
                  const url = window.location.href;
                  try { window.open(url, "_blank", "noopener,noreferrer"); } catch { }
                  setTimeout(() => { try { window.location.href = url; } catch { } }, 50);
                }}
              >
                외부 브라우저로 열기
              </button>
            </div>
          </div>
        )}

        {shareLoading ? (
          <div className="mx-auto w-full max-w-3xl px-4 pb-10">
            <div className="rounded-2xl border bg-background/70 p-4 text-sm">
              <div className="font-semibold">공유 리포트를 불러오는 중입니다.</div>
            </div>
          </div>
        ) : __sharePreciseAnalysis ? (
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 space-y-5">
            <PreciseAnalysisFlow
              mode="result"
              state={__sharePreciseAnalysis?.state || null}
              setState={() => { }}
              analysis={__sharePreciseAnalysis}
              isAnalyzing={false}
              onOpenShare={handleOpenTransitionLiteShare}
              shareAnchorRef={shareAnchorRef}
            />
          </div>
        ) : __simVMBridged ? (
          <div className="mx-auto w-full max-w-6xl px-4 pb-8 space-y-5">
            {__shareTransitionLiteVm ? (
              <TransitionLiteResult
                viewModel={{
                  ...__shareTransitionLiteVm,
                  onOpenShare: handleOpenTransitionLiteShare,
                  onOpenTransitionLiteNextStep: handleOpenTransitionLiteNextStep,
                  onOpenTransitionLitePrecisePath: handleOpenTransitionLitePrecisePath,
                  shareAnchorRef,
                }}
              />
            ) : __isReportV2Ready(__simVMBridged) ? (
              <ReportV2Container simVM={__simVMBridged} />
            ) : (
              <SimulatorLayout simVM={__simVMBridged} hideNextStep />
            )}
            {shouldRenderShareComparisonSummary ? (
              <ComparisonSummary
                parsedJD={__shareParsedJD}
                parsedResume={__shareParsedResume}
                state={__shareState}
                analysis={sharePayload}
              />
            ) : null}
          </div>
        ) : shareLoadError ? (
          <div className="mx-auto w-full max-w-3xl px-4 pb-10">
            <div className="rounded-2xl border bg-background/70 p-4 text-sm">
              <div className="font-semibold">{shareLoadError}</div>
              <div className="mt-1 text-muted-foreground leading-relaxed">
                공유 링크를 다시 확인하거나, 홈에서 새 리포트를 생성해 주세요.
              </div>
              <div className="mt-3">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    try {
                      const url = `${window.location.origin}${window.location.pathname}`;
                      window.location.href = url;
                    } catch { }
                  }}
                >
                  홈으로 이동
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 pb-10">
            <div className="rounded-2xl border bg-background/70 p-4 text-sm">
              <div className="font-semibold">공유 데이터가 부족합니다.</div>
              <div className="mt-1 text-muted-foreground leading-relaxed">
                이 링크는 구버전(payload에 simVM 없음)이거나, 생성 과정에서 데이터가 누락됐을 수 있어요.
                <br />
                원본 화면에서 다시 <span className="font-medium text-foreground">리포트 공유</span>를 눌러 새 링크를 생성해 주세요.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // UI 가시성 guard — false로 설정 시 해당 레거시 블록 숨김 (코드 삭제 아님, 복원 용이)
  // SHOW_RESUME_CAREER는 모듈 레벨 선언 (DocSection이 App 바깥에 정의되므로)
  const SHOW_INPUT_SUMMARY = false;
  const SHOW_LEGACY_JOB_INPUTS = false;
  const SHOW_LEGACY_INTERVIEW = false;

  const renderLoginModal = () => (
    <AnimatePresence>
      {loginOpen ? (
        <motion.div
          key="login-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-16"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setLoginOpen(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="w-full max-w-md"
          >
            <Card className="bg-background/95 backdrop-blur">
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">소셜 계정으로 계속</CardTitle>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {AUTH_PROMPT[pendingAction?.type] || "로그인 전에도 입력한 JD/이력서/자가진단은 절대 날아가지 않습니다."}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                  <div className="flex items-center gap-2 text-foreground font-semibold">
                    <Lock className="h-4 w-4" />
                    안내
                  </div>
                  <div className="mt-1">
                    소셜 계정으로 로그인하면 기록과 분석 결과를 안전하게 저장하고 다시 확인할 수 있습니다.
                  </div>
                  <div className="mt-2 border-t border-muted pt-2 text-[11px] leading-relaxed">
                    Google·카카오·네이버는 각각 별도 계정으로 관리됩니다. 처음 가입하신 소셜 계정으로 로그인해 주세요. 다른 방식으로 로그인하면 기존 기록이 보이지 않을 수 있습니다.
                  </div>
                  {(() => {
                    const _lp = safeReadLastSocialLoginProvider();
                    const _lpLabel = { google: "Google", kakao: "카카오", naver: "네이버" }[_lp];
                    if (!_lpLabel) return null;
                    return (
                      <div className="mt-2 border-t border-muted pt-2 text-[11px] leading-relaxed">
                        이 브라우저에서 이전에 <span className="font-medium text-foreground">{_lpLabel}</span>로 로그인하신 적이 있습니다. 기존 기록을 보려면 같은 방식으로 로그인해 주세요.
                      </div>
                    );
                  })()}
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    className="relative flex h-14 w-full items-center justify-center rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800 shadow-sm transition-colors active:bg-gray-50"
                    onClick={() => { doDummyLogin(); }}
                  >
                    <span className="absolute left-4 flex items-center" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    </span>
                    Google로 계속하기
                  </button>
                  <button
                    type="button"
                    className="relative flex h-14 w-full items-center justify-center rounded-xl text-sm font-medium text-[#191600] transition-colors active:brightness-95"
                    style={{ backgroundColor: "#FEE500" }}
                    onClick={() => { doKakaoLogin(); }}
                  >
                    <span className="absolute left-4 flex items-center" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                        <path d="M12 3C6.48 3 2 6.91 2 11.73c0 3.08 1.87 5.79 4.72 7.37l-1.19 4.42 4.83-3.05c.53.08 1.08.12 1.64.12 5.52 0 10-3.91 10-8.34C22 6.91 17.52 3 12 3z" fill="#191600"/>
                      </svg>
                    </span>
                    카카오로 계속하기
                  </button>
                  <button
                    type="button"
                    className="relative flex h-14 w-full items-center justify-center rounded-xl text-sm font-medium text-white transition-colors active:brightness-90"
                    style={{ backgroundColor: "#03C75A" }}
                    onClick={() => { doNaverLogin(); }}
                  >
                    <span className="absolute left-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center" aria-hidden="true">
                      <span className="text-[20px] font-black leading-none tracking-[-0.08em] text-white">N</span>
                    </span>
                    네이버로 계속하기
                  </button>
                  <button
                    type="button"
                    className="mt-1 w-full py-1 text-sm text-muted-foreground"
                    onClick={() => setLoginOpen(false)}
                  >
                    취소
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  ※ 로그인 성공 직후, 방금 누른 액션(리포트 보기/샘플 보기/분석 후 리포트)을 자동으로 이어갑니다.
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (isChatgptOAuthConsentRoute) {
    return (
      <TooltipProvider delayDuration={120}>
        <ChatgptOAuthConsentPage />
      </TooltipProvider>
    );
  }

  if (isMobile && mobileShellActive) {
    return (
      <TooltipProvider delayDuration={120}>
        <MobileAppShell
          onStartJobAnalysis={handleMobileStartJobAnalysis}
          onStartRejectAnalysis={handleMobileStartRejectAnalysis}
          onViewResults={handleMobileViewResults}
          recordCareerLabel={currentCareerRoleLabel}
          recordJobId={currentCareerRoleContext?.jobId}
          onRecordSubmit={setPmLastInput}
          onRecordLogin={() => openLoginGate({ type: "work_record_save" })}
          resumeLastInput={pmLastInput}
          resumeCareerLabel={currentCareerRoleLabel}
          resumeJobId={currentCareerRoleContext?.jobId}
          onResumeLogin={() => openLoginGate({ type: "work_record_save" })}
          auth={auth}
          onHomeLogin={() => openLoginGate({ type: "work_record_save" })}
          onSettingsLogin={() => openLoginGate({ type: "go_report" })}
          onSettingsLogout={doLogout}
          mobileAnalysisMode={mobileAnalysisMode}
          onExecuteAnalysis={handleMobileExecuteAnalysis}
          onClearMobileAnalysisMode={() => setMobileAnalysisMode(null)}
          onSubmitTransitionLite={handleMobileSubmitTransitionLite}
          aiInboxOpenSignal={aiInboxOpenSignal}
          firstRecordTourRecordSignal={mobileFirstRecordTourRecordSignal}
          onStartFirstRecordTour={(opts = {}) => handleStartFirstRecordTour({ ...opts, variant: "mobile" })}
          initialRecordDate={pendingRecordDate}
          reminderProps={{
            auth,
            reminderPref,
            reminderDraft,
            reminderSaveStatus,
            reminderSavedSnapshot,
            pushStatus,
            pushSubscribed,
            pushSubscriptionRecord,
            pushSubscriptionCheckStatus,
            testPushStatus,
            testPushMessage,
            schedulerV2SummaryRows,
            schedulerV2SummaryStatus,
            schedulerV2SummaryError,
            onToggleEnabled: () => setReminderDraft((d) => ({ ...d, is_enabled: !d.is_enabled })),
            onDayChange: (dayIdx) => setReminderDraft((d) => ({ ...d, preferred_day_of_week: dayIdx })),
            onTimeChange: (value) => setReminderDraft((d) => ({ ...d, preferred_time_local: value })),
            onSave: handleSaveReminderPreference,
            onRequestPush: handleRequestPushPermission,
            onRevokePush: handleRevokePushSubscription,
            onSendTestPush: handleSendTestPushNotification,
          }}
          careerBaselineProps={{
            value: careerBaseline,
            status: careerBaselineStatus,
            onSave: handleSaveCareerBaseline,
          }}
        />
        <FirstRecordGuidedTour
          open={isFirstRecordTourOpen}
          variant="mobile"
          selectedDate={firstRecordTourDate}
          onNavigate={handleNavigateFirstRecordTour}
          onClose={() => setIsFirstRecordTourOpen(false)}
          onComplete={() => setIsFirstRecordTourOpen(false)}
        />
        {renderLoginModal()}
      </TooltipProvider>
    );
  }

  const renderExampleOnboardingModal = () => {
    if (typeof document === "undefined") return null;
    return createPortal(
      <AnimatePresence>
        {isExampleOnboardingOpen ? (
          <motion.div
            className="fixed inset-0 z-[2147483646] flex w-screen max-w-[100vw] items-center justify-center overflow-x-hidden bg-slate-950/45 px-4 py-5 backdrop-blur-[2px] sm:px-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              ref={exampleOnboardingPanelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="example-onboarding-title"
              tabIndex={-1}
              className="flex max-h-[calc(100vh-32px)] w-full max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)] outline-none ring-1 ring-violet-100 sm:max-w-5xl"
              initial={{ opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="relative flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 pr-14 sm:px-7 sm:py-5 sm:pr-16">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 id="example-onboarding-title" className="text-[22px] font-semibold tracking-tight text-slate-950 sm:text-[26px]">
                      30초만에 PASSMAP 이해하기
                    </h2>
                    <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[12px] font-semibold text-violet-700">
                      {exampleOnboardingStep + 1} / {exampleOnboardingSteps.length}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-600 sm:text-[15px]">
                    오늘 한 일이 커리어 자산과 이력서 문장으로 이어지는 흐름을 보여드릴게요.
                  </p>
                </div>
                <button
                  type="button"
                  className="absolute right-4 top-4 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-[22px] leading-none text-slate-500 shadow-sm transition hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700 sm:right-6 sm:top-5"
                  onClick={closeExampleOnboarding}
                  aria-label="온보딩 닫기"
                >
                  ×
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={exampleOnboardingStep}
                    className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-center"
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                  >
                    <div className="overflow-hidden rounded-[24px] border border-violet-100 bg-violet-50/50 p-2 shadow-[0_18px_44px_rgba(88,28,135,0.12)]">
                      <img
                        src={currentExampleOnboardingStep.image}
                        alt={currentExampleOnboardingStep.alt}
                        className="h-auto max-h-[52vh] w-full rounded-[18px] bg-white object-contain sm:max-h-[58vh]"
                      />
                    </div>
                    <div className="rounded-[22px] border border-slate-100 bg-white p-1 lg:p-0 lg:border-0">
                      <div className="inline-flex h-9 items-center rounded-full bg-violet-50 px-3 text-[13px] font-semibold text-violet-700 ring-1 ring-violet-100">
                        Step {exampleOnboardingStep + 1}
                      </div>
                      <h3 className="mt-4 text-[24px] font-semibold tracking-tight text-slate-950 sm:text-[30px]">
                        {currentExampleOnboardingStep.title}
                      </h3>
                      <p className="mt-3 text-[15px] leading-7 text-slate-600 sm:text-[16px]">
                        {currentExampleOnboardingStep.description}
                      </p>
                      {isLastExampleOnboardingStep ? (
                        <p className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-[14px] font-semibold leading-6 text-violet-800">
                          이제 오늘 한 일을 적어보면, 같은 흐름으로 정리됩니다.
                        </p>
                      ) : null}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                {exampleOnboardingStep === 0 || isLastExampleOnboardingStep ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-slate-200 bg-white px-5 text-[14px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                    onClick={closeExampleOnboarding}
                  >
                    닫기
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-violet-100 bg-white px-5 text-[14px] font-semibold text-violet-700 shadow-sm hover:bg-violet-50 hover:text-violet-800"
                    onClick={goPrevExampleOnboardingStep}
                  >
                    이전
                  </Button>
                )}
                <Button
                  type="button"
                  className="h-11 rounded-full bg-violet-700 px-6 text-[14px] font-semibold text-white shadow-[0_12px_24px_rgba(124,58,237,0.22)] hover:bg-violet-800"
                  onClick={isLastExampleOnboardingStep ? finishExampleOnboarding : goNextExampleOnboardingStep}
                >
                  {isLastExampleOnboardingStep ? "오늘 한 일 기록하기" : "다음"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>,
      document.body
    );
  };

  return (
    <TooltipProvider delayDuration={120}>
      {isAccountRecoveryHelperRequested() ? <AccountRecoveryHelperPanel auth={auth} /> : null}
      {isMobile && !mobileShellActive && (
        <button
          type="button"
          onClick={() => setMobileShellActive(true)}
          className="fixed left-3 top-3 z-[60] flex items-center gap-1 rounded-full border border-violet-100 bg-white/95 px-3 py-2 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          앱 홈으로
        </button>
      )}
      <Shell
        isJobRailLayout={isShellLevelJobRailLayout}
        isJobDashboardLayout={isJobDashboardShellLayout}
        isAssetMapLayout={isAssetMapLayout}
        isJobAnalysisLandingLayout={showJobAnalysisLandingHeader}
        leftRail={
          isShellLevelJobRailLayout ? (
            <aside className="rounded-[28px] border border-violet-100/80 bg-white/92 p-3 shadow-[0_18px_45px_rgba(88,28,135,0.08)]">
              <div className="px-2 pb-3 pt-1">
                <img
                  src={`${import.meta.env.BASE_URL}brand/passmap-logo-horizontal-purple-small.png`}
                  alt="PASSMAP"
                  className="h-6 w-auto object-contain"
                />
              </div>
              <div className="space-y-5">
                {[
                  {
                    title: null,
                    items: [
                      { key: "analysis", label: "홈" },
                      { key: "resume-update", label: "오늘 기록하기", icon: PenLine },
                      { key: "work", label: "경험 흐름", icon: RotateCcw },
                      { key: "asset-map", label: "내 커리어 자산", icon: Clipboard },
                      { key: "resume", label: "이력서 후보 보기", icon: FileText },
                    ],
                  },
                  {
                    title: "분석 도구",
                    items: [
                      { key: "analysis", label: "직무산업 분석", icon: BarChart3, action: handleOpenTransitionLiteEntry },
                      { key: "analysis", label: "서류 탈락 원인 분석", icon: Target, action: handleOpenPreciseAnalysisEntry },
                    ],
                  },
                  {
                    title: "상담",
                    items: [
                      { key: "consulting", label: "전문가 상담 신청", icon: MessageSquareText },
                    ],
                  },
                ].map((section, sectionIndex) => (
                  <div key={`job-menu-section-${sectionIndex}`} className="space-y-1.5">
                    {section.title ? (
                      <div className="px-2 pb-1 text-[12px] font-semibold tracking-tight text-violet-400">{section.title}</div>
                    ) : null}
                    {section.items.map((item) => {
                      const isActionActive =
                        item.action === handleOpenTransitionLiteEntry
                          ? inputEntryMode === "transition-lite"
                          : item.action === handleOpenPreciseAnalysisEntry
                            ? inputEntryMode === "precise-analysis"
                            : false;
                      const isActive = isActionActive || (jobSidebarView === item.key && !item.action);
                      const ItemIcon = item.icon || Home;
                      return (
                        <button
                          key={`${sectionIndex}-${item.label}`}
                          type="button"
                          onClick={() => {
                            if (typeof item.action === "function") {
                              item.action();
                              return;
                            }
                            setJobSidebarView(item.key);
                          }}
                          className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-3 text-left text-[15px] font-semibold leading-5 transition ${
                            isActive
                              ? "bg-violet-100 text-violet-800 shadow-[0_10px_24px_rgba(124,58,237,0.12)]"
                              : "text-slate-650 hover:bg-violet-50 hover:text-violet-800"
                          }`}
                        >
                          <ItemIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-violet-700" : "text-slate-400"}`} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="my-2 border-t border-slate-200/50" />
              <details className="rounded-2xl border border-slate-200/50 bg-white/30 p-2.5 shadow-none">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">현재 기준 직무</div>
                    <div className="mt-0.5 truncate text-[13px] font-semibold text-slate-600">{currentCareerRoleLabel}</div>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200/70 bg-white/60 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                    변경
                  </span>
                </summary>
                <div className="mt-2 text-[12px] leading-relaxed text-slate-400">경험 정리와 이력서 문장 생성의 기준이 되는 직무입니다.</div>
                <div className="mt-2 rounded-xl border border-slate-200/70 bg-white/70 px-3 py-2">
                  <div className="text-[13px] font-semibold text-slate-700">
                    {currentCareerRoleContext.majorLabel || "대분류를 선택하세요"}
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">
                    {currentCareerRoleContext.subLabel || "중분류를 선택하면 기준 직무가 확정됩니다."}
                  </div>
                </div>
                <select
                  value={jobSidebarRoleDraftMajorKey}
                  onChange={(event) => {
                    const nextMajorKey = String(event.target.value || "").trim();
                    setJobSidebarRoleDraftMajorKey(nextMajorKey);
                  }}
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400"
                >
                  {JOB_TAXONOMY_OPTIONS.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
                <select
                  value={currentCareerRoleSubValue}
                  onChange={(event) => {
                    const nextMajorKey = String(jobSidebarRoleDraftMajorKey || "").trim();
                    const nextSubKey = String(event.target.value || "").trim();
                    const nextMajorOption = getJobTaxonomyOptionByMajorKey(nextMajorKey);
                    const nextResolved = getJobOntologyItemByMajorSubcategory(nextMajorKey, nextSubKey);
                    if (!nextMajorKey || !nextSubKey || !nextMajorOption || !nextResolved) return;

                    const nextTaxonomy = {
                      majorKey: nextMajorOption.key,
                      majorLabel: nextMajorOption.label,
                      subKey: nextResolved.subcategory,
                      subLabel: nextResolved.label,
                      jobId: nextResolved.id,
                    };

                    setState((prev) => ({
                      ...prev,
                      [__targetRoleKey]: nextResolved.label,
                      role: nextResolved.label,
                      roleTarget: nextResolved.label,
                      targetRole: nextResolved.label,
                      roleTargetSub: nextResolved.subcategory,
                      roleTargetResolved: nextResolved,
                      roleTargetTaxonomy: nextTaxonomy,
                    }));
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="">중분류 선택</option>
                  {currentCareerRoleSubOptions.map((item) => (
                    <option key={item.id || item.key} value={item.key}>{item.label}</option>
                  ))}
                </select>
              </details>
              <div className="my-2 border-t border-slate-200/50" />
              <div className="space-y-1">
                <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">설정</div>
                <button
                  type="button"
                  onClick={() => {
                    setJobSidebarView("settings");
                  }}
                  className={`w-full rounded-xl px-2.5 py-2 text-left text-[13px] leading-5 transition ${
                    jobSidebarView === "settings"
                      ? "bg-slate-100 text-slate-800 shadow-none"
                      : "bg-transparent text-slate-500 hover:bg-slate-100/70 hover:text-slate-800"
                  }`}
                >
                  설정
                </button>
              </div>
            </aside>
          ) : null
        }
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          ref={firstScreenRef}
          id="passmap-first-screen"
          className="relative overflow-visible space-y-10 bg-white/80 backdrop-blur p-1.5 sm:p-6 rounded-xl sm:rounded-3xl border border-slate-200/70 shadow-lg"
        >
          <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goToFirstScreen}
              aria-label="PASSMAP 첫 화면으로 이동"
              className="inline-flex items-center"
            >
              <img
                src={`${import.meta.env.BASE_URL}brand/passmap-logo-horizontal-purple-small.png`}
                alt="PASSMAP"
                className="h-7 w-auto object-contain"
              />
            </button>

            <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
              {activeTab === SECTION.JOB && jobSidebarView !== "work" ? (
                <Button
                  variant="outline"
                  onClick={() => openJobSidebarDestination("resume-update", "weekly")}
                  className="h-9 rounded-full border border-primary/20 bg-primary/5 px-3 text-[13px] font-medium text-primary shadow-sm hover:bg-primary/10 hover:text-primary"
                  disabled={isAnalyzing}
                >
                  경험 정리하기
                </Button>
              ) : null}

              <div className="relative flex items-center gap-2">
                {auth?.loggedIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setUserMenuOpen((v) => !v)}
                      className="group inline-flex h-9 items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 text-[13px] text-foreground/80 shadow-sm backdrop-blur transition-colors duration-150 hover:bg-background/80"
                      aria-label="계정 메뉴"
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-muted/50 text-foreground/70 border border-border/60">
                        <User className="h-3.5 w-3.5" />
                      </span>
                      <span className="max-w-[128px] truncate leading-none">{auth?.user?.name || "로그인 사용자"}</span>
                      <ChevronDown className={"h-3.5 w-3.5 text-muted-foreground transition " + (userMenuOpen ? "rotate-180" : "")} />
                    </button>

                    <AnimatePresence>
                      {userMenuOpen ? (
                        <>
                          <motion.button
                            key="user-menu-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            type="button"
                            className="fixed inset-0 z-40 cursor-default"
                            onMouseDown={() => setUserMenuOpen(false)}
                            aria-label="닫기"
                          />
                          <motion.div
                            key="user-menu"
                            initial={{ opacity: 0, y: 6, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 6, scale: 0.98 }}
                            className="absolute right-0 top-10 z-50 w-64"
                          >
                            <Card className="bg-background/80 backdrop-blur-xl border border-border/70 shadow-xl">
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm">계정</CardTitle>
                                <div className="text-xs text-muted-foreground leading-relaxed">
                                  로그인 상태는 이 기기(브라우저)에만 저장됩니다.
                                  <span className="block">로그인되어 있습니다.</span>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="rounded-2xl border border-border/70 bg-background/70 backdrop-blur p-4 text-xs shadow-sm">
                                  <div className="text-foreground font-medium">{auth?.user?.name || "로그인 사용자"}</div>
                                  <div className="text-muted-foreground mt-0.5">
                                    {auth?.user?.email || "email 미설정"} {auth?.user?.provider ? "· " + String(auth.user.provider) : ""}
                                  </div>
                                </div>

                                <Button
                                  variant="outline"
                                  className="rounded-full w-full bg-background/70 backdrop-blur border border-border/70 shadow-sm hover:shadow-md transition-all duration-200"
                                  onClick={() => {
                                    setUserMenuOpen(false);
                                    doLogout();
                                  }}
                                  disabled={isAnalyzing}
                                >
                                  로그아웃
                                </Button>
                              </CardContent>
                            </Card>
                          </motion.div>
                        </>
                      ) : null}
                    </AnimatePresence>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    className="h-9 rounded-full border border-border/60 bg-background/60 px-3 text-[13px] shadow-sm hover:bg-background/80"
                    onClick={() => openLoginGate({ type: "go_report" })}
                    disabled={isAnalyzing}
                  >
                    <Lock className="mr-1.5 h-3.5 w-3.5" />
                    로그인
                  </Button>
                )}
              </div>

            </div>
          </header>
          {/* <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-white via-white to-slate-50/70" /> */}          {/* Header */}
          {showSharedLandingHeader ? (
          <div className={SHOW_TOP_RIGHT_CTA ? "grid gap-6 md:grid-cols-[minmax(0,1fr)_290px] md:items-start" : "space-y-6"}>
            <div>
              <div className="mt-2.5">
                <h1 className="text-[34px] font-semibold leading-[1.25] tracking-tight text-slate-900 md:text-[46px]">
                  오늘 한 일을, 이력서에 쓸 수 있는 경험으로
                </h1>
              </div>

              <div className="mt-5 max-w-4xl space-y-2">
                <p className="text-[17px] leading-[1.65] text-slate-700 md:text-lg">
                  PASSMAP은 흩어진 업무기록을 모아 경력기술서·면접 답변·상담에 활용할 커리어 자산으로 정리해줍니다.
                </p>
                <p className="text-[17px] leading-[1.65] text-slate-700 md:text-lg">
                  대단한 성과가 아니어도 괜찮아요. 오늘 처리한 일부터 기록하면 됩니다.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  className="h-11 rounded-full bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
                  onClick={() => openJobSidebarDestination("resume-update", "weekly")}
                >
                  오늘 한 일 기록하기
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-slate-200 bg-white px-5 text-[15px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                  onClick={() => openJobSidebarDestination("work", "weekly")}
                >
                  예시 먼저 보기
                </Button>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-4">
                {[
                  "1. 오늘 한 일 적기",
                  "2. AI가 경험 초안 정리",
                  "3. 맞는 내용만 확정",
                  "4. 이력서·면접에 활용",
                ].map((label) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {SHOW_TOP_RIGHT_CTA ? (
              <div className="w-full md:w-auto md:self-start md:mt-[46px]">
                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => {
                      requestAnalyzeOnce({ goResult: true, source: "result_gate_button" });
                    }}
                    className="h-11 w-full md:w-[280px] rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 active:scale-[0.98]"
                    disabled={isAnalyzing}
                  >
                    <Sparkles className={"h-4 w-4 mr-2 " + (isAnalyzing ? "animate-spin" : "")} />
                    {isAnalyzing ? "분석 중..." : "합격 확률 확인하기"}
                  </Button>

                  <Button
                    variant="outline"
                    className="h-11 w-full md:w-[280px] rounded-full bg-background/80 border border-border/70 shadow-sm hover:shadow-md hover:bg-background/90 transition-all duration-200"
                    onClick={() => {
                      openSampleReport({ goResult: true });
                    }}
                  >
                    샘플 리포트 보기
                  </Button>

                  {sampleMode ? (
                    <Badge
                      variant="outline"
                      className="w-fit rounded-full bg-background/70 border border-border/70 shadow-sm"
                    >
                      샘플 모드
                    </Badge>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          ) : null}

          {/* Stepper */}
          {SHOW_STEPPER_CARD ? (
            <Card className="overflow-hidden rounded-2xl border border-border/70 bg-background/75 backdrop-blur shadow-md">
              <CardHeader className="pb-5">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <CardTitle className="text-base">탭</CardTitle>
                  </div>
                  <div className="w-full md:w-[360px]">
                    <Progress value={progress} className="h-2" />
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Math.round(progress)}%</span>
                      <span>
                        {idx + 1} / {ORDER.length}
                      </span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 border-b border-slate-200/70 pb-2">
                  {nav.map((n) => (
                    <StepPill
                      key={n.id}
                      active={activeTab === n.id}
                      done={ORDER.indexOf(n.id) < idx}
                      icon={n.icon}
                      label={n.label}
                      onClick={() => {
                        // 리포트 탭은 로그인 게이트 통과 필요
                        setTab(n.id);
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Login modal */}
          {renderLoginModal()}

          {/* Main layout */}
          {showBetaEntryBanner && showInputFlow && inputEntryMode === "precise-analysis" && activeTab === SECTION.JOB ? (
            <div className="mb-2 flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50 px-4 py-2.5">
              <span className="text-xs leading-5 text-violet-700">베타 기능입니다. 일부 결과는 아직 정교화 중입니다.</span>
              <button
                type="button"
                className="ml-3 shrink-0 text-xs text-violet-400 hover:text-violet-700"
                onClick={() => setShowBetaEntryBanner(false)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
          ) : null}
          <div
            ref={basicSectionRef}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            <div className={`${isJobSidebarShellActive || (showInputFlow && inputEntryMode === "transition-lite" && activeTab === SECTION.JOB) || shouldUseWideTransitionLiteLayout || shouldUseWideDefaultInputFlowLanding || shouldUseWidePreciseAnalysisLayout ? "lg:col-span-3" : "lg:col-span-2"} space-y-6`}>
              {/* ✅ Gate summary (append-only): 탈락 직결 신호는 최상단에서 경고 */}
              {(() => {
                const dp = activeAnalysis?.decisionPack || null;
                if (!dp) return null;

                const gateTriggered = !!dp.gateTriggered;

                // gateResults에서 triggered 항목을 뽑아 요약(있으면)
                const gateItemsRaw = Array.isArray(dp.gateResults) ? dp.gateResults : [];
                const gateItemsTriggered = gateItemsRaw.filter((g) => g && (g.triggered === true || g.isTriggered === true));

                const topGate = gateItemsTriggered[0] || null;
                const topTitle =
                  (topGate?.explain?.title && String(topGate.explain.title)) ||
                  (topGate?.title && String(topGate.title)) ||
                  (topGate?.id && String(topGate.id)) ||
                  "";

                // 표시 텍스트(짧게)
                const headline = gateTriggered
                  ? "⚠️ 탈락 직결 가능성이 높은 조건이 감지됐어요"
                  : "";

                const sub =
                  topTitle
                    ? `우선 확인: ${topTitle}`
                    : "필수요건/핵심경험/연령·학력 등 ‘게이트’ 조건은 먼저 해소해야 합니다.";

                // gateTriggered가 아니면 렌더링 안 함
                if (!gateTriggered) return null;

                return (
                  <div className="lg:col-span-3">
                    <div className="rounded-2xl border bg-destructive/5 p-4">
                      <div className="text-sm font-semibold text-foreground">{headline}</div>
                      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
                      <div className="mt-3 text-xs text-foreground/90 space-y-1">
                        <div>• 먼저: JD의 “필수 요건”을 3개만 뽑고, 이력서에서 1:1로 근거 문장을 붙이세요.</div>
                        <div>• 다음: 면접에서 반례(예외) 2개를 준비해 “왜 나는 예외인지”를 숫자/사례로 증명하세요.</div>
                      </div>
                      {gateItemsTriggered.length > 1 ? (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          추가 게이트 {gateItemsTriggered.length - 1}개가 더 감지됐습니다. (상세는 아래 카드에서 확인)
                        </div>
                      ) : null}
                    </div>

                    {/* APPEND-ONLY: decisionScore / rejectProbability badges */}
                    {activeAnalysis?.decisionPack?.decisionScore ? (
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <Badge variant="secondary" className="rounded-full">
                          DecisionScore: {activeAnalysis.decisionPack.decisionScore.capped}
                          {activeAnalysis.decisionPack.decisionScore.capReason ? " (cap)" : ""}
                        </Badge>

                        {activeAnalysis?.decisionPack?.rejectProbability ? (
                          <Badge variant="outline" className="rounded-full">
                            RejectProb: {Math.round(activeAnalysis.decisionPack.rejectProbability.p * 100)}%
                            <span className="ml-2 text-muted-foreground">
                              conf {Math.round(activeAnalysis.decisionPack.rejectProbability.confidence * 100)}%
                            </span>
                          </Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );

              })()}
              {/* InputFlow는 JOB 탭에서만 렌더. RESUME/INTERVIEW/RESULT는 항상 기존 UI 유지 */}
              <div>
                {showInputFlow && activeTab === SECTION.JOB ? (
                  <>
                    {inputEntryMode === "transition-lite" ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 -mt-1">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleOpenDefaultInputFlow}
                            className="h-10 rounded-full border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 hover:text-slate-900"
                          >
                            <Home className="mr-2 h-4 w-4" />
                            홈으로
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={resetTransitionAnalysis}
                            disabled={isAnalyzing}
                            className="h-10 rounded-full border-slate-300 bg-white px-4 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50 hover:text-slate-800"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            분석 다시 시작
                          </Button>
                        </div>
                        {transitionLiteEntryStep === "audience-select" ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:p-4">
                            <div className="text-sm font-semibold text-slate-900">분석 대상 선택</div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              현재 상황에 맞는 입력 경로를 선택해주세요.
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              <button
                                type="button"
                                className={
                                  transitionLiteAudience === "experienced"
                                    ? "rounded-2xl border border-violet-600 bg-violet-600 px-4 py-3 text-left text-sm font-semibold text-white"
                                    : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                }
                                onClick={() => {
                                  saveTransitionLiteLastAudience("experienced");
                                  setTransitionLiteAudience("experienced");
                                  setState((prev) => ({
                                    ...(prev && typeof prev === "object" ? prev : {}),
                                    entryLevelMode: false,
                                  }));
                                  setTransitionLiteEntryStep("input");
                                }}
                              >
                                <div>경력/이직</div>
                                <div className={`mt-1 text-xs ${transitionLiteAudience === "experienced" ? "text-violet-100" : "text-slate-500"}`}>
                                  현재 직무와 산업을 기준으로 전환 연결성을 읽습니다.
                                </div>
                              </button>
                              <button
                                type="button"
                                className={
                                  transitionLiteAudience === "newgrad"
                                    ? "rounded-2xl border border-violet-600 bg-violet-600 px-4 py-3 text-left text-sm font-semibold text-white"
                                    : "rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                }
                                onClick={() => {
                                  saveTransitionLiteLastAudience("newgrad");
                                  setTransitionLiteAudience("newgrad");
                                  setState((prev) => ({
                                    ...(prev && typeof prev === "object" ? prev : {}),
                                    entryLevelMode: true,
                                  }));
                                  setTransitionLiteEntryStep("input");
                                }}
                              >
                                <div>신입</div>
                                <div className={`mt-1 text-xs ${transitionLiteAudience === "newgrad" ? "text-violet-100" : "text-slate-500"}`}>
                                  전공, 프로젝트, 인턴, 강점 기준으로 신입 적합성을 읽습니다.
                                </div>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                onClick={() => setTransitionLiteEntryStep("audience-select")}
                              >
                                대상 변경
                              </button>
                              <span className="text-xs text-slate-500">
                                {transitionLiteAudience === "newgrad" ? "신입" : "경력/이직"}
                              </span>
                            </div>
                            {transitionLiteAudience === "newgrad" ? (
                              <NewgradTransitionLiteInput
                                key={`newgrad-${__tlResetKey}`}
                                onStartAnalysis={handleTransitionLiteStartAnalysis}
                                onInputsCompleted={handleTransitionLiteInputsCompleted}
                                onSubmit={handleSubmitTransitionLite}
                              />
                            ) : (
                              <TransitionLiteInput
                                key={`experienced-${__tlResetKey}`}
                                onBackToDefault={handleOpenDefaultInputFlow}
                                onStartAnalysis={handleTransitionLiteStartAnalysis}
                                onStepCompleted={handleTransitionLiteStepCompleted}
                                onInputsCompleted={handleTransitionLiteInputsCompleted}
                                onSubmit={handleSubmitTransitionLite}
                              />
                            )}
                          </>
                        )}
                      </div>
                    ) : inputEntryMode === "precise-analysis" ? (
                      <div className="space-y-4">
                        <ResumeIoStudioPanel
                          profile={currentFlowResumeIoProfile}
                          parsedResume={currentFlowResumeIoProfile ? __parsedResume : null}
                          rawResumeText={currentFlowResumeRawText}
                          importMeta={currentFlowResumeIoParseMeta}
                          onRequestParse={runCurrentFlowResumeSchemaParse}
                          parseLoading={currentFlowResumeIoParseLoading}
                          parseDisabled={!String(currentFlowResumeRawText || "").trim()}
                        />
                        <PreciseAnalysisFlow
                          mode={isAnalyzing ? "loading" : "input"}
                          state={state}
                          setState={setState}
                          isAnalyzing={isAnalyzing}
                          analysis={activeAnalysis || analysis || null}
                          onBack={handleOpenDefaultInputFlow}
                          onGoHome={goToHomeScreen}
                          onReset={resetPreciseAnalysis}
                          onRetryAiDeepAnalysis={handleRetryRejectionAiDeepAnalysis}
                          onAnalyze={() => {
                            try {
                              if (typeof window !== "undefined") {
                                const snapshotState = __buildLatestAnalyzeStateSnapshot();
                                const __jdText =
                                  String(snapshotState?.jd ?? "").trim() ||
                                  String(snapshotState?.jdText ?? "").trim() ||
                                  String(snapshotState?.jdRaw ?? "").trim();
                                const __resumeText =
                                  String(snapshotState?.resume ?? "").trim() ||
                                  String(snapshotState?.resumeText ?? "").trim() ||
                                  String(snapshotState?.resumeRaw ?? "").trim();
                                window.__PASSMAP_ANALYZE_INPUT_SNAPSHOT__ = {
                                  jdLen: __jdText.length,
                                  resumeLen: __resumeText.length,
                                  resumePreview: __resumeText.slice(0, 240),
                                  parsedResumeExists: Boolean(window.__PARSED_RESUME__ && typeof window.__PARSED_RESUME__ === "object"),
                                  source: "precise_analysis",
                                  at: Date.now(),
                                };
                              }
                            } catch { }
                            // reject_analysis_run requires login (resume/JD is personal data)
                            if (!auth?.loggedIn) {
                              openLoginGate({ type: "reject_analysis_run" });
                              return;
                            }
                            requestAnalyzeOnce({ goResult: true, source: "precise_analysis" });
                          }}
                        />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <aside className="hidden">
                          <div className="px-2 pb-3 pt-2">
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">PASSMAP 메뉴</div>
                            <div className="mt-1 text-sm text-slate-500">왼쪽 메뉴에서 선택한 내용을 중앙에서 확인합니다.</div>
                          </div>
                          <div className="space-y-1">
                            {[
                              { key: "analysis", label: "직무산업 전환 분석" },
                              { key: "work", label: "경험 정리" },
                              { key: "resume", label: "이력서 후보 보기" },
                              { key: "resume-update", label: "경험 정리하기" },
                            ].map((item) => {
                              const isActive = jobSidebarView === item.key;
                              return (
                                <button
                                  key={item.key}
                                  type="button"
                                  onClick={() => setJobSidebarView(item.key)}
                                  className={`w-full rounded-2xl px-3 py-3 text-left text-sm transition ${
                                    isActive
                                      ? "bg-slate-900 text-white shadow-sm"
                                      : "bg-slate-50 text-slate-700 hover:bg-slate-200 hover:text-slate-950 hover:shadow-sm"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </aside>

                        <div className="min-w-0">
                          {jobSidebarView === "analysis" ? (
                            <div data-tour-id="post-save-analysis-context-root" className="w-full max-w-none">
                              <PostSaveContextTour type="analysis" variant="web" />
                              {showJobAnalysisLandingHeader ? (
                                <div className="space-y-5">
                                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
                                    <div className="px-1 py-2 md:px-3 md:py-4">
                                      <div className="inline-flex rounded-full border border-violet-100 bg-violet-50 px-4 py-1.5 text-[13px] font-semibold text-violet-700">
                                        기록에서 시작하는 커리어 관리
                                      </div>
                                      <h1 className="mt-5 text-[40px] font-semibold leading-[1.08] tracking-tight text-slate-950 md:text-[52px]">
                                        오늘 한 일을,<br />
                                        <span className="whitespace-nowrap">이력서에 쓸 수 있는 <span className="text-violet-700">경험</span>으로</span>
                                      </h1>
                                      <div className="mt-5 max-w-4xl space-y-2">
                                        <p className="text-[17px] leading-[1.65] text-slate-700">
                                          PASSMAP은 흩어진 업무기록을 모아 경력기술서·면접 답변·상담에 활용할 커리어 자산으로 정리해줍니다.
                                        </p>
                                        <p className="text-[15px] leading-[1.65] text-slate-600">
                                          대단한 성과가 아니어도 괜찮아요.<br />
                                          오늘 처리한 일부터 기록하면 됩니다.
                                        </p>
                                      </div>
                                      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                        <Button
                                          type="button"
                                          className="h-12 rounded-full bg-violet-700 px-6 text-[15px] font-semibold text-white shadow-[0_12px_24px_rgba(124,58,237,0.22)] hover:bg-violet-800"
                                          onClick={() => openJobSidebarDestination("resume-update", "weekly")}
                                        >
                                          <PenLine className="mr-2 h-4 w-4" />
                                          오늘 한 일 기록하기
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          className="h-12 rounded-full border-violet-100 bg-white px-6 text-[15px] font-semibold text-violet-700 shadow-sm hover:bg-violet-50 hover:text-violet-800"
                                          onClick={handleOpenExampleOnboarding}
                                        >
                                          예시로 이해하기
                                        </Button>
                                      </div>
                                      <div className="mt-4 rounded-[24px] border border-violet-100 bg-white/90 p-4 shadow-[0_12px_28px_rgba(88,28,135,0.08)]">
                                        <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[12px] font-semibold text-violet-700">
                                          <Sparkles className="h-3.5 w-3.5" />
                                          AI 작업 자동 회수
                                        </div>
                                        <p className="mt-2 text-[15px] font-semibold leading-6 text-slate-900">
                                          ChatGPT에서 한 업무도 PASSMAP으로 바로 저장할 수 있어요
                                        </p>
                                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-9 rounded-full bg-slate-950 px-4 text-[13px] font-semibold text-white hover:bg-slate-800"
                                            onClick={handleOpenAiCaptureGuide}
                                          >
                                            AI 연동 시작하기
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-9 rounded-full border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                                            onClick={handleOpenAiCaptureGuide}
                                          >
                                            어떻게 쓰는지 보기
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-9 rounded-full border-violet-100 bg-white px-4 text-[13px] font-semibold text-violet-700 hover:bg-violet-50 hover:text-violet-800"
                                            onClick={openAiInboxConnectionTarget}
                                          >
                                            연결 코드 발급하기
                                          </Button>
                                        </div>
                                      </div>
                                    </div>

                                    <div id="passmap-conversion-example" className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_16px_38px_rgba(88,28,135,0.09)]">
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="text-[22px] font-semibold tracking-tight text-slate-950">이렇게 바뀝니다 ✨</div>
                                        <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-[12px] font-semibold text-violet-600">예시</span>
                                      </div>
                                      <div className="mt-5 flex gap-3 rounded-3xl border border-violet-100 bg-violet-50/70 p-4">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100">
                                          <PenLine className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[13px] font-semibold text-violet-700">1. 한 줄로 남기면</div>
                                          <p className="mt-1.5 text-[15px] leading-7 text-slate-800">고객 문의 12건을 분류하고 반복 이슈를 정리함</p>
                                        </div>
                                      </div>
                                      <div className="my-5 flex items-center gap-3">
                                        <span className="h-px flex-1 bg-violet-100" />
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-[12px] font-semibold text-violet-700 shadow-[0_8px_18px_rgba(124,58,237,0.08)]">
                                          <Sparkles className="h-3.5 w-3.5" />
                                          AI가 경험 초안으로 정리
                                          <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                                        </span>
                                        <span className="h-px flex-1 bg-violet-100" />
                                      </div>
                                      <div className="flex gap-3 rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                                          <FileCheck2 className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[13px] font-semibold text-emerald-700">2. 경험으로 바뀌고</div>
                                          <p className="mt-1.5 text-[15px] leading-7 text-slate-800">고객 VOC 12건을 유형화하고 반복 이슈를 도출해 CS 대응 우선순위 정리에 기여</p>
                                        </div>
                                      </div>
                                      <div className="mt-4 flex gap-3 rounded-3xl border border-amber-100 bg-amber-50/80 p-4">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-100">
                                          <Lightbulb className="h-4 w-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[13px] font-semibold text-amber-700">3. 자산으로 쌓입니다</div>
                                          <p className="mt-1.5 text-[15px] leading-7 text-slate-800">이력서·경력기술서·상담에 활용할 수 있는 커리어 기록으로 저장돼요.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid gap-4 md:grid-cols-4">
                                    {[
                                      { step: "1", title: "기록", desc: "오늘 한 일을 짧게 남깁니다.", icon: PenLine },
                                      { step: "2", title: "초안", desc: "AI가 경험으로 정리합니다.", icon: Sparkles },
                                      { step: "3", title: "확정", desc: "맞는 내용만 고릅니다.", icon: CheckCircle },
                                      { step: "4", title: "활용", desc: "이력서·면접·상담에 씁니다.", icon: Send },
                                    ].map((item, index) => {
                                      const StepIcon = item.icon;
                                      return (
                                      <div key={item.title} className="relative min-h-[142px] rounded-[28px] border border-violet-100 bg-white p-6 shadow-[0_16px_34px_rgba(88,28,135,0.08)]">
                                        {index < 3 ? (
                                          <div className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-violet-100 bg-white text-violet-300 shadow-sm md:flex">
                                            <ChevronRight className="h-4 w-4" />
                                          </div>
                                        ) : null}
                                        <div className="mb-5 flex items-center gap-2">
                                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
                                            <StepIcon className="h-4 w-4" />
                                          </div>
                                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-[12px] font-bold text-violet-600 ring-1 ring-violet-100">
                                            {item.step}
                                          </span>
                                        </div>
                                        <div className="text-[17px] font-semibold text-slate-950">{item.title}</div>
                                        <p className="mt-3 text-[14px] leading-6 text-slate-600">{item.desc}</p>
                                      </div>
                                      );
                                    })}
                                  </div>

                                  <div className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_14px_36px_rgba(88,28,135,0.07)] md:p-7">
                                    <div>
                                      <h2 className="text-[24px] font-semibold tracking-tight text-slate-950">기록이 쌓이면 다음 단계로 이어집니다</h2>
                                      <p className="mt-2 text-[15px] leading-6 text-slate-600">쌓인 기록을 바탕으로 분석하고, 상담까지 연결할 수 있어요.</p>
                                    </div>
                                    <div className="mt-6 grid gap-4 md:grid-cols-3">
                                      {[
                                        {
                                          title: "직무산업 분석",
                                          desc: "내 경험이 목표 직무·산업과 얼마나 맞는지 확인합니다.",
                                          button: "직무산업 분석하기",
                                          tone: "violet",
                                          icon: BarChart3,
                                          onClick: handleOpenTransitionLiteEntry,
                                        },
                                        {
                                          title: "서류 탈락 원인 분석",
                                          desc: "JD와 이력서를 함께 보고 서류에서 걸릴 수 있는 지점을 확인합니다.",
                                          button: "서류 탈락 원인 보기",
                                          tone: "sky",
                                          icon: Target,
                                          onClick: handleOpenPreciseAnalysisEntry,
                                        },
                                        {
                                          title: "전문가 상담 신청",
                                          desc: "정리된 기록을 바탕으로 이력서·면접 상담을 받을 수 있습니다.",
                                          button: "상담 신청하기",
                                          tone: "emerald",
                                          icon: MessageSquareText,
                                          onClick: () => setJobSidebarView("consulting"),
                                        },
                                      ].map((item) => {
                                        const toneClass = item.tone === "sky"
                                          ? "bg-sky-50 border-sky-100 text-sky-700"
                                          : item.tone === "emerald"
                                            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                            : "bg-violet-50 border-violet-100 text-violet-700";
                                        const buttonToneClass = item.tone === "sky"
                                          ? "border-sky-100 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                                          : item.tone === "emerald"
                                            ? "border-emerald-100 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                            : "border-violet-100 text-violet-700 hover:bg-violet-50 hover:text-violet-800";
                                        const ToolIcon = item.icon;
                                        return (
                                          <div key={item.title} className="flex min-h-[198px] flex-col rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                                            <div className={`mb-4 grid h-11 w-11 place-items-center rounded-2xl border shadow-sm ${toneClass}`}>
                                              <ToolIcon className="h-5 w-5" />
                                            </div>
                                            <div className="text-[17px] font-semibold text-slate-950">{item.title}</div>
                                            <p className="mt-2 flex-1 text-[14px] leading-6 text-slate-600">{item.desc}</p>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              className={`mt-5 h-10 w-full rounded-full bg-white text-sm font-semibold shadow-sm ${buttonToneClass}`}
                                              onClick={item.onClick}
                                            >
                                              {item.button}
                                            </Button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {SHOW_TOP_RIGHT_CTA ? (
                                    <div className="w-full md:w-auto md:self-start md:mt-[46px]">
                                      <div className="flex flex-col gap-3">
                                        <Button
                                          onClick={() => {
                                            requestAnalyzeOnce({ goResult: true, source: "result_gate_button" });
                                          }}
                                          className="h-11 w-full rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:shadow-primary/20 md:w-[280px]"
                                          disabled={isAnalyzing}
                                        >
                                          <Sparkles className={"mr-2 h-4 w-4 " + (isAnalyzing ? "animate-spin" : "")} />
                                          {isAnalyzing ? "\uBD84\uC11D \uC911..." : "\uD569\uACA9 \uD655\uB960 \uD655\uC778\uD558\uAE30"}
                                        </Button>

                                        <Button
                                          variant="outline"
                                          className="h-11 w-full rounded-full border border-border/70 bg-background/80 shadow-sm transition-all duration-200 hover:bg-background/90 hover:shadow-md md:w-[280px]"
                                          onClick={() => {
                                            openSampleReport({ goResult: true });
                                          }}
                                        >
                                          {"\uC0D8\uD50C \uB9AC\uD3EC\uD2B8 \uBCF4\uAE30"}
                                        </Button>

                                        {sampleMode ? (
                                          <Badge
                                            variant="outline"
                                            className="w-fit rounded-full border border-border/70 bg-background/70 shadow-sm"
                                          >
                                            {"\uC0D8\uD50C \uBAA8\uB4DC"}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {false && showJobAnalysisLandingHeader ? (
                                <div className="space-y-6">
                                  <div>
                                    <div className="mt-2.5">
                                      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                                        'í´ë¦­ 4ë²ˆ'ìœ¼ë¡œ ì§ë¬´/ì‚°ì—…, <br />
                                        ì˜ˆìƒ ë¦¬ìŠ¤í¬ ì§„ë‹¨
                                      </h1>
                                    </div>

                                    <div className="mt-4 space-y-2">
                                      <p className="text-sm text-slate-700 md:text-base">
                                        ìž…ë ¥ì€ ê°„ë‹¨í•˜ì§€ë§Œ, ì§„ë‹¨ì€ ê°€ë³ì§€ ì•Šê²Œ. <br />
                                        ì§ë¬´ êµ¬ì¡°ì™€ ì‚°ì—… ë§¥ë½ì˜ ì°¨ì´ë¥¼ ë°”íƒ•ìœ¼ë¡œ ì „í™˜ ë¦¬ìŠ¤í¬ë¥¼ ë¹ ë¥´ê²Œ ì§šì–´ë“œë¦½ë‹ˆë‹¤.
                                      </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <span className="inline-flex cursor-default items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-violet-600/80">
                                        #ì§ë¬´ êµ¬ì¡° ë¶„ì„
                                      </span>
                                      <span className="inline-flex cursor-default items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-violet-600/80">
                                        #ì‚°ì—… ë§¥ë½ ë¶„ì„
                                      </span>
                                      <span className="inline-flex cursor-default items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-violet-600/80">
                                        #ì „í™˜ ë¦¬ìŠ¤í¬ ì§„ë‹¨
                                      </span>
                                    </div>
                                  </div>

                                  {SHOW_TOP_RIGHT_CTA ? (
                                    <div className="w-full md:w-auto md:self-start md:mt-[46px]">
                                      <div className="flex flex-col gap-3">
                                        <Button
                                          onClick={() => {
                                            requestAnalyzeOnce({ goResult: true, source: "result_gate_button" });
                                          }}
                                          className="h-11 w-full rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-200 active:scale-[0.98] hover:shadow-lg hover:shadow-primary/20 md:w-[280px]"
                                          disabled={isAnalyzing}
                                        >
                                          <Sparkles className={"mr-2 h-4 w-4 " + (isAnalyzing ? "animate-spin" : "")} />
                                          {isAnalyzing ? "ë¶„ì„ ì¤‘..." : "í•©ê²© í™•ë¥  í™•ì¸í•˜ê¸°"}
                                        </Button>

                                        <Button
                                          variant="outline"
                                          className="h-11 w-full rounded-full border border-border/70 bg-background/80 shadow-sm transition-all duration-200 hover:bg-background/90 hover:shadow-md md:w-[280px]"
                                          onClick={() => {
                                            openSampleReport({ goResult: true });
                                          }}
                                        >
                                          ìƒ˜í”Œ ë¦¬í¬íŠ¸ ë³´ê¸°
                                        </Button>

                                        {sampleMode ? (
                                          <Badge
                                            variant="outline"
                                            className="w-fit rounded-full border border-border/70 bg-background/70 shadow-sm"
                                          >
                                            ìƒ˜í”Œ ëª¨ë“œ
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              {!showJobAnalysisLandingHeader ? (
                              <>
                              {(() => {
                                const prevPropRef = __lastInputFlowPropRef.current;
                                const currPropRef = __inputFlowUiState;
                                const p = (prevPropRef && typeof prevPropRef === "object") ? prevPropRef : {};
                                const c = (currPropRef && typeof currPropRef === "object") ? currPropRef : {};
                                const fieldSame = {
                                  flowStep: p.flowStep === c.flowStep,
                                  roleMajorStep: p.roleMajorStep === c.roleMajorStep,
                                  roleMajorSelected: p.roleMajorSelected === c.roleMajorSelected,
                                  currentMajorSelected: p.currentMajorSelected === c.currentMajorSelected,
                                };
                                const allSame =
                                  fieldSame.flowStep &&
                                  fieldSame.roleMajorStep &&
                                  fieldSame.roleMajorSelected &&
                                  fieldSame.currentMajorSelected;
                                const objectIdentityChanged = prevPropRef !== currPropRef;
                                __pushLoopTrace("APP_TO_INPUTFLOW_PRECHECK", {
                                  prev: p,
                                  next: c,
                                  objectIdentityChanged,
                                  fieldSame,
                                  allSame,
                                });
                                __lastInputFlowPropRef.current = currPropRef;
                                __pushLoopTrace("APP_TO_INPUTFLOW", {
                                  inputFlowUiState: __inputFlowUiState,
                                  cbStableMarker: "__handleInputFlowUiStateChange",
                                });
                                return null;
                              })()}
                              <InputFlow
                                state={state}
                                setState={setState}
                                inputFlowUiState={__inputFlowUiState}
                                onInputFlowUiStateChange={__handleInputFlowUiStateChange}
                                onOpenTransitionLite={handleOpenTransitionLiteEntry}
                                onOpenPreciseAnalysis={handleOpenPreciseAnalysisEntry}
                                onAnalyze={() => { requestAnalyzeOnce({ goResult: true, source: "result_sheet" }); }}
                                onGoDoc={() => setTab(SECTION.RESUME)}
                                onExtract={(kind, text, meta) => {
                                  const k = String(kind || "").toLowerCase();
                                  const v = String(text || "");
                                  const failed = meta?.ok === false || !!meta?.error || (!!meta?.message && !v.trim());
                                  const failureMessage =
                                    String(meta?.message || "").trim() ||
                                    String(Array.isArray(meta?.warnings) ? meta.warnings.find(Boolean) || "" : "").trim() ||
                                    "파일에서 텍스트를 추출하지 못했어요. DOCX/TXT로 다시 업로드하거나 파일 내용을 복사해 붙여넣어 주세요.";
                                  if (import.meta.env.DEV) console.log("[App.onExtract]", {
                                    k,
                                    valueLen: typeof v === "string" ? v.length : null,
                                    preview: typeof v === "string" ? v.slice(0, 120) : null,
                                  });
                                  const warnings = failed
                                    ? Array.from(new Set([failureMessage, ...((Array.isArray(meta?.warnings) ? meta.warnings : []).filter(Boolean))]))
                                    : (Array.isArray(meta?.warnings) ? meta.warnings.filter(Boolean) : []);
                                  if (failed) {
                                    try {
                                      if (typeof window !== "undefined") {
                                        window.__PASSMAP_RESUME_IMPORT_STATE__ = {
                                          status: "failure",
                                          kind: k,
                                          fileName: meta?.name || null,
                                          error: meta?.error || null,
                                          message: failureMessage,
                                          warnings,
                                          charCount: Number(meta?.charCount || 0),
                                          updatedAt: Date.now(),
                                        };
                                      }
                                    } catch { }
                                    if (k === "jd") {
                                      __setInputFlowWarnings((prev) => ({ ...prev, jd: warnings }));
                                    } else if (k === "resume") {
                                      __setInputFlowWarnings((prev) => ({ ...prev, resume: warnings }));
                                    }
                                    return;
                                  }
                                  if (k === "jd") {
                                    if (import.meta.env.DEV) console.log("[App.onExtract]", {
                                      field: "jd",
                                      len: v?.length
                                    });
                                    try {
                                      window.__PASSMAP_JD_COMMIT_DEBUG__ = {
                                        at: Date.now(),
                                        step: "before",
                                        kind: k,
                                        incomingTextLength: typeof v === "string" ? v.length : null,
                                        incomingPreview: typeof v === "string" ? v.slice(0, 120) : null,
                                      };
                                    } catch { }
                                    imeCommit("jd", v);
                                    try {
                                      if (typeof window !== "undefined") {
                                        window.__PASSMAP_RESUME_IMPORT_STATE__ = {
                                          status: "success",
                                          kind: k,
                                          fileName: meta?.name || null,
                                          charCount: Number(meta?.charCount || v.length || 0),
                                          preview: v.slice(0, 240),
                                          updatedAt: Date.now(),
                                        };
                                      }
                                    } catch { }
                                    try {
                                      window.__PASSMAP_JD_COMMIT_DEBUG__ = {
                                        ...window.__PASSMAP_JD_COMMIT_DEBUG__,
                                        step: "after",
                                        committedLength: typeof v === "string" ? v.length : null,
                                      };
                                    } catch { }
                                    __setInputFlowWarnings((prev) => ({ ...prev, jd: warnings }));
                                  } else if (k === "resume") {
                                    if (import.meta.env.DEV) console.log("[App.onExtract]", {
                                      field: "resume",
                                      len: v?.length
                                    });
                                    imeCommit("resume", v);
                                    __setResumeAttached(Boolean(v.trim()));
                                    try {
                                      if (typeof window !== "undefined") {
                                        window.__PASSMAP_RESUME_IMPORT_STATE__ = {
                                          status: "success",
                                          kind: k,
                                          fileName: meta?.name || null,
                                          charCount: Number(meta?.charCount || v.length || 0),
                                          preview: v.slice(0, 240),
                                          updatedAt: Date.now(),
                                        };
                                      }
                                    } catch { }
                                    __setInputFlowWarnings((prev) => ({ ...prev, resume: warnings }));
                                  }
                                }}
                              />
                              {(Array.isArray(__inputFlowWarnings?.jd) && __inputFlowWarnings.jd.length) ||
                                (Array.isArray(__inputFlowWarnings?.resume) && __inputFlowWarnings.resume.length) ? (
                                <div className="mt-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[11px] text-amber-900/80">
                                  <div className="font-semibold">파일 추출 안내</div>
                                  {Array.isArray(__inputFlowWarnings?.jd) && __inputFlowWarnings.jd.length ? (
                                    <ul className="mt-1 list-disc pl-4">
                                      {__inputFlowWarnings.jd.slice(0, 3).map((w, i) => (
                                        <li key={`jd_${i}`}>JD: {String(w)}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                  {Array.isArray(__inputFlowWarnings?.resume) && __inputFlowWarnings.resume.length ? (
                                    <ul className="mt-1 list-disc pl-4">
                                      {__inputFlowWarnings.resume.slice(0, 3).map((w, i) => (
                                        <li key={`resume_${i}`}>이력서: {String(w)}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              ) : null}
                              </>
                              ) : null}
                            </div>
                          ) : null}

                          {jobSidebarView === "work" ? (
                            <HomeDashboard
                              onOpenReports={() => setTab(SECTION.RESULT)}
                              onOpenRecordInput={(opts) => {
                                const source = String(opts?.source || "");
                                const calendarLocalSources = new Set([
                                  "calendar-drawer",
                                  "calendar-weekly",
                                  "calendar-grid",
                                  "calendar-project",
                                  "calendar-sidebar-recommendation",
                                ]);
                                if (calendarLocalSources.has(source)) {
                                  return;
                                }
                                const recordContext = opts && (opts.recordId || opts.mode || opts.source || opts.record)
                                  ? {
                                      date: opts?.date ?? null,
                                      recordId: opts?.recordId ?? null,
                                      mode: opts?.mode ?? "create",
                                      source: opts?.source ?? "home-dashboard",
                                      record: opts?.record ?? null,
                                      projectName: opts?.projectName ?? null,
                                      recordType: opts?.recordType ?? null,
                                      actionTitle: opts?.actionTitle ?? null,
                                      actionId: opts?.actionId ?? null,
                                      linkedAction: opts?.linkedAction ?? null,
                                      recommendedAction: opts?.recommendedAction ?? null,
                                      googleCalendarCandidate: opts?.googleCalendarCandidate ?? null,
                                    }
                                  : null;
                                setPendingRecordDate(opts?.date ?? null);
                                setPendingRecordContext(recordContext);
                                persistPassmapCalendarRecordContext(recordContext);
                                setPmDemoView(opts?.mode === "project-action" || opts?.mode === "project-progress" ? "project" : "weekly");
                                setJobSidebarView("resume-update");
                              }}
                              onOpenAiInbox={() => {
                                setPmDemoView("weekly");
                                setJobSidebarView("resume-update");
                                setAiInboxOpenSignal((n) => n + 1);
                              }}
                              onOpenResumeResult={() => {
                                setPmDemoView("result");
                                setJobSidebarView("resume");
                              }}
                              onOpenReadiness={() => {
                                setPmDemoView("weekly");
                                setJobSidebarView("resume-update");
                              }}
                              onStartFirstRecordTour={handleStartFirstRecordTour}
                              onStartFullProductTour={handleStartFullProductTour}
                            />
                          ) : null}

                          {jobSidebarView === "asset-map" ? (
                            <div className="w-full min-w-0">
                              <CareerAssetMapMock
                                onOpenRecordInput={(opts) => {
                                  const source = String(opts?.source || "");
                                  const calendarLocalSources = new Set([
                                    "calendar-drawer",
                                    "calendar-weekly",
                                    "calendar-grid",
                                    "calendar-project",
                                    "calendar-sidebar-recommendation",
                                  ]);
                                  if (calendarLocalSources.has(source)) {
                                    return;
                                  }
                                  const recordContext = opts && (opts.recordId || opts.mode || opts.source || opts.record)
                                    ? {
                                        date: opts?.date ?? null,
                                        recordId: opts?.recordId ?? null,
                                        mode: opts?.mode ?? "create",
                                        source: opts?.source ?? "asset-map",
                                        record: opts?.record ?? null,
                                        projectName: opts?.projectName ?? null,
                                        recordType: opts?.recordType ?? null,
                                        actionTitle: opts?.actionTitle ?? null,
                                        actionId: opts?.actionId ?? null,
                                        linkedAction: opts?.linkedAction ?? null,
                                        recommendedAction: opts?.recommendedAction ?? null,
                                        googleCalendarCandidate: opts?.googleCalendarCandidate ?? null,
                                      }
                                    : null;
                                  setPendingRecordDate(opts?.date ?? null);
                                  setPendingRecordContext(recordContext);
                                  persistPassmapCalendarRecordContext(recordContext);
                                  setPmDemoView(opts?.mode === "project-action" || opts?.mode === "project-progress" ? "project" : "weekly");
                                  setJobSidebarView("resume-update");
                                }}
                                onOpenResumeResult={() => {
                                  setPmDemoView("result");
                                  setJobSidebarView("resume");
                                }}
                              />
                            </div>
                          ) : null}

                          {jobSidebarView === "resume" ? (
                            <div className="w-full min-w-0">
                              <PmMvpView
                                entryView={pmDemoView}
                                mode="preview"
                                currentCareerRoleLabel={currentCareerRoleLabel}
                                currentJobId={currentCareerRoleContext?.jobId}
                                onOpenAnalysis={() => setJobSidebarView("analysis")}
                                onOpenUpdateView={(nextView = "weekly") => {
                                  setPmDemoView(nextView);
                                  setJobSidebarView("resume-update");
                                }}
                                externalLastInput={pmLastInput}
                                onOpenLogin={() => openLoginGate({ type: "work_record_save" })}
                              />
                            </div>
                          ) : null}

                          {jobSidebarView === "resume-update" ? (
                            <div className="w-full min-w-0">
                              {pendingRecordContext?.mode === "project-progress" ? (
                                <PmMvpView
                                  entryView="project"
                                  mode="update"
                                  currentCareerRoleLabel={currentCareerRoleLabel}
                                  currentJobId={currentCareerRoleContext?.jobId}
                                  onRecordSubmit={setPmLastInput}
                                  onOpenLogin={() => openLoginGate({ type: "work_record_save" })}
                                  onOpenResumeView={() => {
                                    setPmDemoView("result");
                                    setJobSidebarView("resume");
                                  }}
                                  onOpenAnalysis={() => setJobSidebarView("analysis")}
                                  initialRecordContext={pendingRecordContext}
                                />
                              ) : (
                                <WebWorkTraceRecordPage
                                  currentCareerRoleLabel={currentCareerRoleLabel}
                                  currentJobId={currentCareerRoleContext?.jobId}
                                  onRecordSubmit={setPmLastInput}
                                  onOpenLogin={() => openLoginGate({ type: "work_record_save" })}
                                  onOpenResumeView={() => {
                                    setPmDemoView("result");
                                    setJobSidebarView("resume");
                                  }}
                                  onOpenAnalysis={() => setJobSidebarView("analysis")}
                                  onOpenAssetMap={() => setJobSidebarView("asset-map")}
                                  initialRecordDate={pendingRecordDate}
                                  initialRecordContext={pendingRecordContext}
                                  isLoggedIn={!!auth?.loggedIn}
                                  aiInboxOpenSignal={aiInboxOpenSignal}
                                />
                              )}
                            </div>
                          ) : null}

                          {jobSidebarView === "consulting" ? (
                            <div className="rounded-[32px] border border-violet-100 bg-white p-6 shadow-[0_14px_36px_rgba(88,28,135,0.07)] md:p-7">
                              <div className="max-w-3xl">
                                <div className="text-[13px] font-semibold text-violet-600">상담</div>
                                <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">전문가 상담 신청</h2>
                                <p className="mt-2 text-[15px] leading-6 text-slate-600">
                                  정리된 기록과 분석 결과를 바탕으로 이력서·면접 상담을 받을 수 있습니다.
                                </p>
                              </div>
                              <div className="mt-6 grid gap-4 md:grid-cols-3">
                                {[
                                  { title: "미니 상담", desc: "현재 고민을 빠르게 점검하고 다음 행동을 정합니다.", href: "/reject-analyzer/?page=consulting-lead&type=mini" },
                                  { title: "원포인트 상담", desc: "이력서나 면접에서 막힌 지점을 집중적으로 다룹니다.", href: "/reject-analyzer/?page=consulting-lead&type=onepoint" },
                                  { title: "커리어 상담", desc: "목표 직무와 전환 방향을 함께 정리합니다.", href: "/reject-analyzer/?page=consulting-lead&type=care" },
                                ].map((item) => (
                                  <a
                                    key={item.title}
                                    href={item.href}
                                    className="flex min-h-[166px] flex-col rounded-3xl border border-slate-200 bg-slate-50/70 p-5 transition hover:border-violet-200 hover:bg-violet-50/60"
                                  >
                                    <div className="text-[17px] font-semibold text-slate-950">{item.title}</div>
                                    <p className="mt-2 flex-1 text-[14px] leading-6 text-slate-600">{item.desc}</p>
                                    <span className="mt-5 text-sm font-semibold text-violet-700">상담 신청하기</span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {jobSidebarView === "settings" ? (
                            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="mb-4">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">설정</div>
                                <div className="mt-1 text-xl font-semibold text-slate-950">설정</div>
                              </div>

                              <div className="space-y-3">
                                <section className="rounded-xl border border-slate-200 bg-white p-4">
                                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">계정</div>
                                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                        로그인 계정과 상태를 확인합니다.
                                      </p>
                                    </div>
                                    {auth?.loggedIn && auth?.user ? (
                                      <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                                        {(auth.user.name || "이름 정보 없음")} / {auth.user.email || "이메일 정보 없음"} /{" "}
                                        {auth.user.provider === "google" ? "Google"
                                          : auth.user.provider === "kakao" ? "Kakao"
                                          : (auth.user.provider === "custom:naver" || auth.user.provider === "naver") ? "Naver"
                                          : auth.user.provider || "소셜 로그인"} 로그인 중
                                      </div>
                                    ) : null}
                                  </div>
                                  {auth?.loggedIn && auth?.user ? (
                                    <details className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                      <summary className="cursor-pointer text-[11px] font-semibold text-slate-600">
                                        자세히 보기
                                      </summary>
                                      <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                          <span className="text-xs text-slate-500">회원이름</span>
                                          <span className="text-xs font-medium text-slate-800">{auth.user.name || "이름 정보 없음"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                          <span className="text-xs text-slate-500">이메일 주소</span>
                                          <span className="text-xs font-medium text-slate-800">{auth.user.email || "이메일 정보 없음"}</span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                          <span className="text-xs text-slate-500">로그인 방식</span>
                                          <span className="text-xs font-medium text-slate-800">
                                            {auth.user.provider === "google" ? "Google"
                                              : auth.user.provider === "kakao" ? "Kakao"
                                              : (auth.user.provider === "custom:naver" || auth.user.provider === "naver") ? "Naver"
                                              : auth.user.provider || "소셜 로그인"}
                                          </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
                                          <span className="text-xs text-slate-500">계정 상태</span>
                                          <span className="text-xs font-medium text-slate-800">로그인됨</span>
                                        </div>
                                      </div>
                                    </details>
                                  ) : (
                                    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                                      로그인하면 계정 식별 정보와 저장된 분석 결과를 확인할 수 있습니다. 소셜 로그인 후 제공되는 회원이름과 이메일 주소는 계정 식별 및 분석 결과 저장/재조회에 사용됩니다.
                                    </div>
                                  )}
                                </section>

                                <section className="rounded-xl border border-slate-200 bg-white p-4">
                                  <button
                                    type="button"
                                    onClick={() => setReminderSettingsOpen((v) => !v)}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                  >
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">알림</div>
                                      <div className="mt-0.5 text-xs text-slate-500">
                                        {auth.loggedIn
                                          ? `주간 경험 회수 시간을 관리합니다. 매주 ${["일","월","화","수","목","금","토"][reminderDraft.preferred_day_of_week]}요일 ${reminderDraft.preferred_time_local}`
                                          : "로그인 후 주간 경험 회수 시간을 관리할 수 있어요"}
                                      </div>
                                    </div>
                                    <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${reminderSettingsOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {reminderSettingsOpen && (
                                    <div className="mt-3">
                                      <ReminderSettingsPanel
                                        auth={auth}
                                        reminderPref={reminderPref}
                                        reminderDraft={reminderDraft}
                                        reminderSaveStatus={reminderSaveStatus}
                                        reminderSavedSnapshot={reminderSavedSnapshot}
                                        pushStatus={pushStatus}
                                        pushSubscribed={pushSubscribed}
                                        pushSubscriptionRecord={pushSubscriptionRecord}
                                        pushSubscriptionCheckStatus={pushSubscriptionCheckStatus}
                                        testPushStatus={testPushStatus}
                                        testPushMessage={testPushMessage}
                                        schedulerV2SummaryRows={schedulerV2SummaryRows}
                                        schedulerV2SummaryStatus={schedulerV2SummaryStatus}
                                        schedulerV2SummaryError={schedulerV2SummaryError}
                                        onToggleEnabled={() => setReminderDraft((d) => ({ ...d, is_enabled: !d.is_enabled }))}
                                        onDayChange={(dayIdx) => setReminderDraft((d) => ({ ...d, preferred_day_of_week: dayIdx }))}
                                        onTimeChange={(value) => setReminderDraft((d) => ({ ...d, preferred_time_local: value }))}
                                        onSave={handleSaveReminderPreference}
                                        onRequestPush={handleRequestPushPermission}
                                        onRevokePush={handleRevokePushSubscription}
                                        onSendTestPush={handleSendTestPushNotification}
                                      />
                                    </div>
                                  )}
                                </section>

                                <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <div className="mb-3">
                                    <div className="text-sm font-semibold text-slate-900">AI 연결</div>
                                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                      ChatGPT, Claude, 브라우저 확장에서 PASSMAP으로 업무기록을 보낼 수 있어요.
                                    </p>
                                  </div>
                                  <div className="space-y-3">
                                    <ChatgptConnectionPanel
                                      compact
                                      onOpenInbox={() => {
                                        setJobSidebarView("resume-update");
                                        setAiInboxOpenSignal((n) => n + 1);
                                      }}
                                    />
                                    <McpConnectionPanel compact isLoggedIn={!!auth?.loggedIn} />
                                  </div>
                                </section>

                                <section className="rounded-xl border border-slate-200 bg-white p-4">
                                  <button
                                    type="button"
                                    onClick={() => setProvisionInfoOpen((v) => !v)}
                                    className="flex w-full items-center justify-between gap-2 text-left"
                                  >
                                    <div>
                                      <div className="text-sm font-semibold text-slate-900">개인정보</div>
                                      <div className="mt-0.5 text-xs text-slate-500">PASSMAP이 사용하는 정보와 목적을 확인합니다.</div>
                                    </div>
                                    <ChevronDown className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform duration-200 ${provisionInfoOpen ? "rotate-180" : ""}`} />
                                  </button>
                                  {provisionInfoOpen && (
                                    <>
                                      <div className="mb-3 mt-3 text-xs text-slate-500">PASSMAP은 소셜 로그인으로 제공받은 정보를 아래 목적에 한해 사용합니다.</div>
                                      <div className="space-y-2">
                                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed">
                                          <span className="font-semibold text-slate-700">회원이름</span>
                                          <span className="text-slate-500"> 로그인 계정 식별 및 맞춤 안내에 사용합니다.</span>
                                        </div>
                                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed">
                                          <span className="font-semibold text-slate-700">이메일 주소</span>
                                          <span className="text-slate-500"> 로그인 계정 식별, 분석 결과 저장, 재조회 및 계정 관련 안내에 사용합니다.</span>
                                        </div>
                                        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed">
                                          <span className="font-semibold text-slate-700">소셜 로그인 정보</span>
                                          <span className="text-slate-500"> PASSMAP 서비스 이용 상태 유지와 계정 관리에 사용합니다.</span>
                                        </div>
                                      </div>
                                      <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-400">
                                        회원 정보는 서비스 제공 목적 외로 임의 판매하거나 공개하지 않으며, 관련 법령과 개인정보처리방침에 따라 관리됩니다.
                                      </div>
                                    </>
                                  )}
                                </section>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <AnimatePresence mode="wait">
                    {/* BASICINFO */}

                    {SHOW_LEGACY_JOB_INPUTS && activeTab === SECTION.JOB && (
                      <motion.div key="basicinfo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <BasicInfoSection
                          state={state}
                          setTab={setTab}
                          getImeValue={getImeValue}
                          imeOnChange={imeOnChange}
                          imeOnCompositionStart={imeOnCompositionStart}
                          imeOnCompositionEnd={imeOnCompositionEnd}
                          imeCommit={imeCommit}
                          set={set}
                          companySizeCandidateValue={companySizeCandidateValue}
                          companySizeTargetValue={companySizeTargetValue}
                          normalizeCompanySizeValue={normalizeCompanySizeValue}
                          __parsedJD={__parsedJD}
                          __parsedResume={__parsedResume}
                          __setParsedJD={__setParsedJD}
                          __setParsedResume={__setParsedResume}
                        />
                      </motion.div>
                    )}

                    {/* DOC */}
                    {activeTab === SECTION.RESUME && (
                      <motion.div key="doc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        <DocSection
                          state={state}
                          setTab={setTab}
                          getImeValue={getImeValue}
                          imeOnChange={imeOnChange}
                          imeOnCompositionStart={imeOnCompositionStart}
                          imeCommit={imeCommit}
                          set={set}
                          selfCheckMode={selfCheckMode}
                          setSelfCheckMode={setSelfCheckMode}
                        />
                        {/* 자가진단 — 서류 탭 인라인 (면접 탭과 동일한 순차 공개 UI) */}
                        {(() => {
                          const SC_ITEMS = [
                            {
                              key: "coreFit",
                              label: "핵심 역량 적합도",
                              hint: "JD 필수 요건을 얼마나 충족하나요? 경험·강점·키워드 일치도를 기준으로 선택하세요.",
                            },
                            {
                              key: "proofStrength",
                              label: "증거·성과 강도",
                              hint: "대표 성과가 수치·전후비교·기여도로 설명되는지 기준으로 선택하세요.",
                            },
                            {
                              key: "roleClarity",
                              label: "직무 명확도",
                              hint: "내 직무 정체성을 한 문장으로 말할 수 있나요? JD 업무와의 연결성을 기준으로 선택하세요.",
                            },
                            {
                              key: "storyConsistency",
                              label: "경력 스토리 일관성",
                              hint: "이직사유·지원사유·경험이 하나의 논리로 이어지는지 기준으로 선택하세요.",
                            },
                            {
                              key: "riskSignals",
                              label: "리스크 신호 적음",
                              hint: "공백·짧은 근속·잦은 이직 이슈를 사실-의도-행동-증거로 설명할 수 있나요?",
                            },
                            {
                              key: "cultureFit",
                              label: "조직 문화 적합도",
                              hint: "지원 조직의 일하는 방식·가치관이 본인의 커리어 방향과 얼마나 맞나요?",
                            },
                          ];
                          return (
                            <div className="mt-4 rounded-2xl border bg-background/70 p-5">
                              <div className="text-base font-semibold mb-4">자가진단</div>
                              <div className="space-y-0">
                                {SC_ITEMS.map(({ key, label, hint }, idx) => {
                                  const currentScore = state.selfCheck?.[key] ?? 3;
                                  const isOpen = idx <= selfCheckOpenIdx;
                                  const rubric = SELF_CHECK_RUBRICS[key]?.[currentScore];
                                  return (
                                    <div key={key} className="border-b last:border-b-0">
                                      <div className="flex items-center justify-between gap-3 py-2.5">
                                        <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
                                        <div className="flex gap-1">
                                          {[1, 2, 3, 4, 5].map((n) => (
                                            <button
                                              key={n}
                                              className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${currentScore === n
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                }`}
                                              onClick={() => {
                                                setState((prev) => ({
                                                  ...prev,
                                                  selfCheck: { ...(prev.selfCheck || {}), [key]: n },
                                                }));
                                                setSelfCheckOpenIdx((prev) => Math.max(prev, idx + 1));
                                              }}
                                            >
                                              {n}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      {isOpen && (
                                        <div className="pb-3 space-y-1">
                                          <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>
                                          {rubric && (
                                            <p className="text-xs text-slate-400 italic">현재 선택: {rubric}</p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="pt-4">
                                <button
                                  className="w-full rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                                  disabled={!canAnalyze || isAnalyzing}
                                  onClick={() => requestAnalyzeOnce({ goResult: true, source: "inputflow_primary" })}
                                >
                                  {isAnalyzing ? "분석 중…" : "분석 시작"}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* INTERVIEW */}
                    {activeTab === SECTION.INTERVIEW && (
                      <motion.div
                        key="interview"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                      >
                        {SHOW_LEGACY_INTERVIEW && (
                          <InterviewSection
                            state={state}
                            setTab={setTab}
                            getImeValue={getImeValue}
                            imeOnChange={imeOnChange}
                            imeOnCompositionStart={imeOnCompositionStart}
                            imeCommit={imeCommit}
                            set={set}
                            selfCheckMode={selfCheckMode}
                            canAnalyze={canAnalyze}
                            isAnalyzing={isAnalyzing}
                            auth={auth}
                            openLoginGate={openLoginGate}
                            runAnalysis={runAnalysis}
                          />
                        )}
                        {/* 자가진단 — 면접 준비도(Progressive Disclosure) */}
                        {(() => {
                          const SC_ITEMS = [
                            {
                              key: "jobFit",
                              label: "직무 적합성",
                              hint: "면접 답변 기준으로 이 직무에 맞는 사람처럼 읽히는 정도",
                              subHint: "현재 선택: 경험강점핵심 역량 연결 기준으로 선택하세요",
                            },
                            {
                              key: "orgFit",
                              label: "기업조직 적합성",
                              hint: "왜 이 회사인지, 어떤 방식으로 함께 일할 사람인지 설득되는 정도",
                              subHint: "현재 선택: 회사 이해도지원동기조직 적합성 기준으로 선택하세요",
                            },
                            {
                              key: "answerLogic",
                              label: "답변 구조화논리성",
                              hint: "질문 의도 파악과 결론-근거-사례 흐름의 명확성",
                              subHint: "현재 선택: 질문 적중도와 답변 구조 기준으로 선택하세요",
                            },
                            {
                              key: "evidenceImpact",
                              label: "성과경험의 구체성",
                              hint: "본인 역할, 수치, 결과가 선명하게 드러나는 정도",
                              subHint: "현재 선택: 사례 구체성기여도성과 근거 기준으로 선택하세요",
                            },
                            {
                              key: "deliveryPresence",
                              label: "전달력태도상호작용",
                              hint: "말의 명확성, 태도, 긴장 관리, 상호작용 품질",
                              subHint: "현재 선택: 전달력태도상호작용 기준으로 선택하세요",
                            },
                            {
                              key: "contextResponse",
                              label: "면접 상황경쟁 환경 대응",
                              hint: "변수 많은 면접 상황에서도 흔들리지 않고 대응하는 정도",
                              subHint: "현재 선택: 경쟁 강도면접관 변수돌발 질문 대응 기준으로 선택하세요",
                            },
                          ];
                          return (
                            <div className="rounded-2xl border bg-background/70 p-5">
                              <div className="text-base font-semibold mb-4">자가진단</div>
                              <div className="space-y-0">
                                {SC_ITEMS.map(({ key, label, hint, subHint }, idx) => {
                                  const currentScore = state?.selfCheck?.interview?.axes?.[key] ?? 3;
                                  const isOpen = idx <= selfCheckOpenIdx;
                                  return (
                                    <div key={key} className="border-b last:border-b-0">
                                      <div className="flex items-center justify-between gap-3 py-2.5">
                                        <span className="text-sm font-medium text-slate-700 flex-1">{label}</span>
                                        <div className="flex gap-1">
                                          {[1, 2, 3, 4, 5].map((n) => (
                                            <button
                                              key={n}
                                              className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${currentScore === n
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                }`}
                                              onClick={() => {
                                                setState((prev) => ({
                                                  ...prev,
                                                  selfCheck: {
                                                    ...(prev.selfCheck || {}),
                                                    interview: {
                                                      ...(prev.selfCheck?.interview || {}),
                                                      axes: {
                                                        ...(prev.selfCheck?.interview?.axes || {}),
                                                        [key]: n,
                                                      },
                                                    },
                                                  },
                                                }));
                                                setSelfCheckOpenIdx((prev) => Math.max(prev, idx + 1));
                                              }}
                                            >
                                              {n}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      {isOpen && (
                                        <div className="pb-3 space-y-1">
                                          <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>
                                          <p className="text-xs text-slate-400 italic">{subHint}</p>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="pt-4">
                                <button
                                  className="w-full rounded-full bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                                  disabled={!canAnalyze || isAnalyzing}
                                  onClick={() => requestAnalyzeOnce({ goResult: true, source: "inputflow_secondary" })}
                                >
                                  {isAnalyzing ? "분석 중…" : "분석 시작"}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </motion.div>
                    )}

                    {/* REPORT */}
                    {activeTab === SECTION.RESULT && (
                      <motion.div
                        key="report"
                        ref={reportRef}
                        id="analysis-report-section"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                      >
                        {(() => {
                          if (resultEntryMode === "transition-lite" && transitionLiteResultVm) {
                            return (
                              <TransitionLiteResult
                                viewModel={{
                                  ...transitionLiteResultVm,
                                  activeExplanationRowKey,
                                  onGoHome: goToHomeScreen,
                                  onSelectExplanationRow: setActiveExplanationRowKey,
                                  onOpenShare: handleOpenTransitionLiteShare,
                                  onOpenTransitionLiteNextStep: handleOpenTransitionLiteNextStep,
                                  onOpenTransitionLitePrecisePath: handleOpenTransitionLitePrecisePath,
                                  shareAnchorRef,
                                }}
                                sourceInput={newgradSourceInput}
                              />
                            );
                          }

                          // ✅ current VM SSOT: reportPack.simulationViewModel
                          if (resultEntryMode === "precise-analysis") {
                            // Hotfix 2 (2026-05-24): readiness must NOT trust reportPack alone — it is
                            // populated by the generic analyzer even when the precise-analysis
                            // compositeRisk has not arrived yet, which made the result tab flip out of
                            // loading too early and surface the empty-result fallback.
                            // PreciseAnalysisFlow.compositeData reads strictly from
                            // analysis.preciseAnalysis.compositeRisk (with a window debug fallback),
                            // so gate readiness on precise-analysis-specific shapes only.
                            const __analysisForPreciseMode = activeAnalysis || analysis || null;
                            const __preciseAnalysisSlice = __analysisForPreciseMode?.preciseAnalysis || null;
                            const __hasPreciseRiskResults = Boolean(
                              __preciseAnalysisSlice?.compositeRisk ||
                              (Array.isArray(__preciseAnalysisSlice?.riskResults) && __preciseAnalysisSlice.riskResults.length) ||
                              (Array.isArray(__preciseAnalysisSlice?.reportSectionItems) && __preciseAnalysisSlice.reportSectionItems.length) ||
                              (Array.isArray(__preciseAnalysisSlice?.topItems) && __preciseAnalysisSlice.topItems.length) ||
                              (Array.isArray(__preciseAnalysisSlice?.insufItems) && __preciseAnalysisSlice.insufItems.length) ||
                              (Array.isArray(__preciseAnalysisSlice?.lowItems) && __preciseAnalysisSlice.lowItems.length) ||
                              // graceful fallback: deterministic engine recorded a precise error so the
                              // result branch is allowed to show the error card instead of loading forever
                              Boolean(__preciseAnalysisSlice?.error)
                            );
                            const __preciseFlowMode = isAnalyzing && !__hasPreciseRiskResults ? "loading" : "result";
                            return (
                              <PreciseAnalysisFlow
                                mode={__preciseFlowMode}
                                state={state}
                                setState={setState}
                                analysis={__analysisForPreciseMode}
                                isAnalyzing={isAnalyzing}
                                onBack={handleOpenPreciseAnalysisEntry}
                                onGoHome={goToHomeScreen}
                                onReset={resetPreciseAnalysis}
                                onPrimaryCta={handleOpenTransitionLiteNextStep}
                                onSecondaryCta={handleOpenTransitionLitePrecisePath}
                                onOpenShare={handleOpenTransitionLiteShare}
                                onRetryAiDeepAnalysis={handleRetryRejectionAiDeepAnalysis}
                                shareAnchorRef={shareAnchorRef}
                              />
                            );
                          }

                          const __simVM =
                            activeAnalysis?.reportPack?.simulationViewModel ||
                            activeAnalysis?.reportPack?.simVM ||
                            activeAnalysis?.simulationViewModel ||
                            activeAnalysis?.simVM ||
                            ((typeof simVM !== "undefined" && simVM) ? simVM : null) ||
                            null;
                          // ✅ PATCH (append-only): L6133과 동일한 4-depth fallback으로 통일
                          const __dpForSimVM =
                            activeAnalysis?.decisionPack ||
                            activeAnalysis?.reportPack?.decisionPack ||
                            analysis?.decisionPack ||
                            analysis?.reportPack?.decisionPack ||
                            null;
                          const __simVMBridgedBase = __bridgeSimVmWithDecisionScore(__simVM, __dpForSimVM);
                          const __simVMBridged = __bridgeSimVmWithSemanticPolicy(
                            __simVMBridgedBase,
                            activeAnalysis || analysis || null
                          );
                          try {
                            if (typeof window !== "undefined") {
                              const __analysisForSimDbg = activeAnalysis || analysis || null;
                              window.__SIM_INPUT_DBG__ = {
                                simLayoutProp: __simVMBridged || null,
                                analysisSimulationViewModel: __analysisForSimDbg?.simulationViewModel || null,
                                reportPackSimulationViewModel: __analysisForSimDbg?.reportPack?.simulationViewModel || null,
                                reportPackTop3Ids: Array.isArray(__analysisForSimDbg?.reportPack?.simulationViewModel?.top3)
                                  ? __analysisForSimDbg.reportPack.simulationViewModel.top3.map((x) => x?.id)
                                  : [],
                              };
                            }
                          } catch { /* silent */ }

                          // Belt-and-suspenders: never render SimulatorLayout with empty data.
                          // If __simVMBridged is null, there is no analysis result to display.
                          if (!__simVMBridged) return null;

                          // Guard: block rendering when all 4 context labels would show "미확인".
                          // Occurs when analysis ran with JD/resume only (role/industry not provided).
                          if (!sampleMode) {
                            const __ctxHdr = __simVMBridged?.reportPack?.contextHeader;
                            const __pickCtx = (obj) => String(obj?.label ?? obj?.value ?? "").trim();
                            const __hasCtxResult = !!(
                              __pickCtx(__ctxHdr?.currentJob) ||
                              __pickCtx(__ctxHdr?.targetJob) ||
                              __pickCtx(__ctxHdr?.currentIndustry) ||
                              __pickCtx(__ctxHdr?.targetIndustry)
                            );
                            if (!__hasCtxResult) return null;
                          }

                          return (
                            <>
                              {__isReportV2Ready(__simVMBridged) ? (
                                <ReportV2Container simVM={__simVMBridged} />
                              ) : (
                                <SimulatorLayout simVM={__simVMBridged} hideNextStep />
                              )}
                              {(() => {
                                const __resultParsedJD =
                                  state?.__parsedJD ||
                                  activeAnalysis?.state?.__parsedJD ||
                                  activeAnalysis?.__passmapSnap?.state?.__parsedJD ||
                                  (typeof window !== "undefined" ? window.__PARSED_JD__ : null) ||
                                  null;
                                const __resultParsedResume =
                                  state?.__parsedResume ||
                                  activeAnalysis?.state?.__parsedResume ||
                                  activeAnalysis?.__passmapSnap?.state?.__parsedResume ||
                                  (typeof window !== "undefined" ? window.__PARSED_RESUME__ : null) ||
                                  null;
                                return (
                                  <ComparisonSummary
                                    parsedJD={__resultParsedJD}
                                    parsedResume={__resultParsedResume}
                                    state={state}
                                    analysis={activeAnalysis}
                                  />
                                );
                              })()}
                              {(() => {
                                // TEMP DEBUG UI: remove after buildDecisionPack_throw root cause is fixed.
                                if (!__lastAnalyzeDebug && __analyzeDebugLog.length === 0) return null;

                                const __stackPreview = String(__lastAnalyzeDebug?.stack || "")
                                  .split("\n")
                                  .slice(0, 3)
                                  .join("\n");
                                const __recentLogs = __analyzeDebugLog.slice(-3).reverse();

                                return (
                                  <Card className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 backdrop-blur">
                                    <CardHeader className="pb-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <CardTitle className="text-base text-amber-900">Analyze Debug Snapshot</CardTitle>
                                          <p className="mt-1 text-xs text-amber-800/80">
                                            `__PASSMAP_ANALYZE_LAST_DEBUG__` / `__PASSMAP_ANALYZE_DEBUG_LOG__`
                                          </p>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button type="button" variant="outline" size="sm" onClick={copyAnalyzeDebugJson}>
                                            Copy JSON
                                          </Button>
                                          <Button type="button" variant="outline" size="sm" onClick={clearAnalyzeDebugSnapshot}>
                                            Clear
                                          </Button>
                                        </div>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                      <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                                        <div>
                                          <span className="font-semibold text-slate-900">stage:</span>{" "}
                                          {String(__lastAnalyzeDebug?.stage || "-")}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-slate-900">ts:</span>{" "}
                                          {String(__lastAnalyzeDebug?.ts || "-")}
                                        </div>
                                        <div className="sm:col-span-2">
                                          <span className="font-semibold text-slate-900">message:</span>{" "}
                                          {String(__lastAnalyzeDebug?.message || "-")}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-slate-900">stateSummary:</span>{" "}
                                          {__lastAnalyzeDebug?.stateSummary ? "yes" : "no"}
                                        </div>
                                        <div>
                                          <span className="font-semibold text-slate-900">logCount:</span>{" "}
                                          {__analyzeDebugLog.length}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                                          stack first 3 lines
                                        </div>
                                        <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white/90 p-3 text-xs leading-relaxed text-slate-700">
                                          {__stackPreview || "-"}
                                        </pre>
                                      </div>

                                      <div>
                                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                                          recent log
                                        </div>
                                        <div className="space-y-2">
                                          {__recentLogs.map((__item, __index) => (
                                            <div
                                              key={`${String(__item?.ts || "no-ts")}_${__index}`}
                                              className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700"
                                            >
                                              <div><span className="font-semibold text-slate-900">stage:</span> {String(__item?.stage || "-")}</div>
                                              <div><span className="font-semibold text-slate-900">message:</span> {String(__item?.message || "-")}</div>
                                              <div><span className="font-semibold text-slate-900">ts:</span> {String(__item?.ts || "-")}</div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })()}

                              {(() => {
                                const __nextActionVm =
                                  activeAnalysis?.simulationViewModel ||
                                  activeAnalysis?.reportPack?.simulationViewModel ||
                                  null;
                                const __primaryNextActions = Array.isArray(__nextActionVm?.nextActions)
                                  ? __nextActionVm.nextActions.filter(Boolean)
                                  : [];
                                const __hasPrimaryNextActions = __primaryNextActions.length > 0;
                                const __riskDisplayMode = String(__nextActionVm?.riskDisplayMode || "normal").trim() || "normal";
                                if (REPORT_UI_FLAGS.showNextActions === false) {
                                  return null;
                                }
                                if (__hasPrimaryNextActions) {
                                  return null;
                                }
                                if (__riskDisplayMode === "no_material_risk") {
                                  return null;
                                }
                                const dp =
                                  activeAnalysis?.decisionPack ||
                                  activeAnalysis?.reportPack?.decisionPack ||
                                  null;
                                const __recVM =
                                  activeAnalysis?.simulationViewModel ||
                                  activeAnalysis?.reportPack?.simulationViewModel ||
                                  null;
                                const __recRiskResults =
                                  Array.isArray(dp?.riskResults)
                                    ? dp.riskResults
                                    : Array.isArray(activeAnalysis?.reportPack?.riskLayer?.riskResults)
                                      ? activeAnalysis.reportPack.riskLayer.riskResults
                                      : [];

                                const __sanitizeRecommendationSentence = (text) => {
                                  const s = String(text || "").replace(/\s+/g, " ").trim();
                                  if (!s) return null;
                                  if (String(text || "").includes("  ")) return null;
                                  if (!String(s || "").trim()) return null;
                                  return s;
                                };

                                const __buildRewriteRecommendationLine = () => {
                                  const candidates = __recVM?.explanationPack?.taskRewriteCandidates;
                                  const weak = Array.isArray(candidates?.weak) ? candidates.weak : [];
                                  const first = weak.find((x) => __sanitizeRecommendationSentence(x?.rewriteExample));
                                  const line = first ? __sanitizeRecommendationSentence(first.rewriteExample) : null;
                                  return line || "이력서에 JD 핵심 과업과 직접 연결되는 행동 문장이 약합니다. 실제 수행한 업무를 행동, 도구/환경, 결과 구조로 다시 정리해 보세요.";
                                };

                                const __buildBridgeRecommendationLine = () => {
                                  const sourceRisk = __recRiskResults.find((r) => {
                                    const meta = r?.taskOntologyMeta;
                                    return meta && typeof meta === "object" &&
                                      ((Array.isArray(meta?.weakMatchedTasks) && meta.weakMatchedTasks.length > 0) ||
                                        (Array.isArray(meta?.missingCriticalTasks) && meta.missingCriticalTasks.length > 0));
                                  }) || null;
                                  const meta = sourceRisk?.taskOntologyMeta && typeof sourceRisk.taskOntologyMeta === "object"
                                    ? sourceRisk.taskOntologyMeta
                                    : {};
                                  const weak = Array.isArray(meta?.weakMatchedTasks) ? meta.weakMatchedTasks : [];
                                  const missing = Array.isArray(meta?.missingCriticalTasks) ? meta.missingCriticalTasks : [];
                                  const weakItem = weak.find((x) => String(x?.sentence || x?.original || "").trim());
                                  if (weakItem) {
                                    const exp = String(weakItem?.sentence || weakItem?.original || "").trim();
                                    const task = String(weakItem?.label || weakItem?.id || "").trim();
                                    return __sanitizeRecommendationSentence(`이 경험을 ${task} 같은 JD 핵심 과업과 직접 이어지는 사례로 설명해야 합니다.`);
                                  }
                                  const missingItem = missing.find((x) => String(x?.label || x?.id || "").trim());
                                  if (missingItem) {
                                    const task = String(missingItem?.label || missingItem?.id || "").trim();
                                    return __sanitizeRecommendationSentence(`기존 경험 중 가장 가까운 사례를 골라 ${task} 과업과 연결되는 브릿지 설명을 먼저 제시해야 합니다.`);
                                  }
                                  return "이전 경험이 JD 핵심 과업과 어떻게 연결되는지 설명이 부족합니다. 업무 나열보다 해당 경험이 직무 성과에 어떻게 기여했는지 중심으로 설명해 보세요.";
                                };

                                const __presentRecommendation = (item) => {
                                  const actionType = String(item?.actionType || "").trim();
                                  if (actionType === "rewrite_jd_link") {
                                    return {
                                      targetSnippet: "",
                                      rewritePreview: {
                                        line: __buildRewriteRecommendationLine(),
                                        templateId: "REWRITE_PRESENTATION_V1",
                                        confidence: "B",
                                        placeholders: {},
                                        safetyNotes: ["NO_JD_NOUN_LIST"],
                                      },
                                    };
                                  }
                                  if (actionType === "domain_bridge") {
                                    return {
                                      targetSnippet: "",
                                      rewritePreview: {
                                        line: __buildBridgeRecommendationLine(),
                                        templateId: "BRIDGE_PRESENTATION_V1",
                                        confidence: "B",
                                        placeholders: {},
                                        safetyNotes: ["NO_JD_NOUN_LIST"],
                                      },
                                    };
                                  }
                                  return {
                                    targetSnippet: item?.targetSnippet || "",
                                    rewritePreview: item?.rewritePreview || null,
                                  };
                                };

                                // ✅ PATCH (append-only): v1(actionCatalog) 우선 + legacy fallback
                                const recsV1Raw = dp?.recommendations?.actionCatalogV1?.items;
                                const recsLegacyRaw = dp?.recommendations?.items;

                                const recs =
                                  Array.isArray(recsV1Raw) && recsV1Raw.length
                                    ? recsV1Raw.map((x) => {
                                      const __present = __presentRecommendation(x);
                                      return ({
                                        // 기존 UI 호환 필드
                                        type: x?.actionType || "action",
                                        title: x?.title || "",
                                        strength:
                                          typeof x?.score === "number"
                                            ? (x.score >= 0.82 ? "A" : x.score >= 0.68 ? "B" : "C")
                                            : "B",
                                        signalText: x?.title || x?.actionType || "",
                                        // v1 확장 필드(지금 UI에서 바로 써도 됨)
                                        why: x?.why || "",
                                        how: Array.isArray(x?.how) ? x.how : [],
                                        evidenceChecklist: Array.isArray(x?.evidenceChecklist) ? x.evidenceChecklist : [],
                                        because: x?.because || "",
                                        targetSnippet: __present.targetSnippet,
                                        rewritePreview: __present.rewritePreview,
                                        debug: {
                                          score: typeof x?.score === "number" ? x.score : null,
                                          category: x?.category ?? null,
                                          effort: x?.effort ?? null,
                                          roi: x?.roi ?? null,
                                        },
                                      });
                                    })
                                    : (Array.isArray(recsLegacyRaw) ? recsLegacyRaw : []);

                                if (recs.length === 0) return null;

                                const typeLabel = (t) => {
                                  if (t === "project") return "프로젝트";
                                  if (t === "learning") return "학습";
                                  if (t === "certification") return "자격증";
                                  if (t === "portfolio") return "포트폴리오";
                                  if (t === "negotiation") return "협상";
                                  if (t === "repositioning") return "포지셔닝";
                                  return "추천";
                                };
                                const strengthClass = (s) => {
                                  const k = String(s || "").toUpperCase();

                                  if (k === "S") return "bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/20";
                                  if (k === "A") return "bg-indigo-600/10 text-indigo-700 ring-1 ring-indigo-600/20";

                                  return "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300/60";
                                };

                                // ✅ UI helper (display-only): remove "유사도 0.xx" fragments from text
                                const __stripSimilarity = (v) => {
                                  try {
                                    const s = (v ?? "").toString();
                                    if (!s) return s;

                                    return s
                                      .replace(/\s*\(\s*유사도\s*[-+]?\d+(?:\.\d+)?\s*\)\s*/g, " ")
                                      .replace(/\s*유사도\s*[-+]?\d+(?:\.\d+)?\s*/g, " ")
                                      .replace(/\s{2,}/g, " ")
                                      .trim();
                                  } catch {
                                    return (v ?? "").toString();
                                  }
                                };

                                return (
                                  <Card className="rounded-2xl border bg-background/70 backdrop-blur mt-6">
                                    <CardHeader className="pb-3">
                                      <CardTitle className="text-base">다음 액션 추천</CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-3">
                                      {recs.slice(0, 5).map((it) => {
                                        // -------------------------------
                                        // Top3 ↔ 추천 UI 연결 계산 (표시 전용)
                                        // -------------------------------
                                        // -------------------------------
                                        // Top3 추천 UI 연결 계산 (임시 유틸)
                                        // -------------------------------

                                        // ✅ PATCH: vm 스코프 누락 방지 (전역/상위 스코프 의존 없이 안전 폴백)
                                        const vm =
                                          analysis?.simulationViewModel ||
                                          analysis?.reportPack?.simulationViewModel ||
                                          analysis?.reportPack?.simVM ||
                                          null;

                                        // ✅ vm 폴백(브라우저 전용)
                                        const __vm = (vm ?? (typeof window !== "undefined" ? window.__LAST_SIM_VM__ : null)) || null;

                                        // ✅ top3를 "리스크 키 문자열" 배열로 정규화
                                        const top3Raw = Array.isArray(__vm?.top3) ? __vm.top3 : [];
                                        const top3 = top3Raw
                                          .map((x) => {
                                            if (typeof x === "string") return x;
                                            // top3가 객체 배열일 때 후보 키들(있는 걸로 자동 사용)
                                            return x?.id || x?.key || x?.signalKey || x?.riskKey || x?.code || x?.name || null;
                                          })
                                          .filter(Boolean);

                                        // 1) riskGroup 매핑
                                        const riskGroupFromKey = (key) => {
                                          if (!key) return null;
                                          if (key.startsWith("GATE__")) return "GATE";
                                          if (key.includes("DOMAIN_SHIFT")) return "TRANSITION";
                                          if (key.includes("ROLE_SHIFT")) return "ROLE";
                                          if (key.startsWith("SIMPLE__")) return "COMPETE";
                                          return null;
                                        };

                                        // 2) 추천 그룹 매핑
                                        const recGroup = (() => {
                                          if (it?.type === "certification") return "COMPETE";
                                          if (it?.type === "project") return "ROLE";
                                          const text = `${it?.signalText || ""} ${it?.jdText || ""}`;
                                          if (/SAP|ERP|Tool|시스템/i.test(text)) return "TRANSITION";
                                          if (it?.type === "learning") return "TRANSITION";
                                          return "COMPETE";
                                        })();

                                        // 3) 연결 판정
                                        let linkType = "none";
                                        let viaRiskKey = null;

                                        for (const rk of top3) {
                                          const rg = riskGroupFromKey(rk);
                                          if (!rg) continue;

                                          // direct
                                          if (rg === recGroup && (rg === "TRANSITION" || rg === "ROLE")) {
                                            linkType = "direct";
                                            viaRiskKey = rk;
                                            break;
                                          }

                                          // indirect
                                          if (
                                            (rg === "GATE" && ["COMPETE", "TRANSITION", "ROLE"].includes(recGroup)) ||
                                            (rg === "TRANSITION" && recGroup === "COMPETE") ||
                                            (rg === "ROLE" && recGroup === "COMPETE")
                                          ) {
                                            linkType = "indirect";
                                            viaRiskKey = rk;
                                          }
                                        }

                                        const showDirect = linkType === "direct";
                                        const showIndirect = linkType === "indirect";
                                        const strength = String(it?.strength || "B").toUpperCase();
                                        const title = String(it?.title || "추천 항목");
                                        // ✅ PATCH: reason fallback (v1: why)
                                        const reason = String(it?.reason || it?.why || "");
                                        const tLabel = typeLabel(it?.type);

                                        const effort = it?.effort ? String(it.effort) : "";
                                        const eta = it?.eta ? String(it.eta) : "";
                                        /* =========================
          PATCH 1) strengthClass 교체
          - 원색 blue/emerald → muted indigo/emerald (ring 기반)
        ========================= */
                                        const strengthClass = (s) => {
                                          const k = String(s || "").toUpperCase();
                                          // S: strong (emerald muted)
                                          if (k === "S") return "bg-emerald-600/10 text-emerald-700 ring-1 ring-emerald-600/20";
                                          // A: attention (indigo muted)  ✅ 기존 blue 원색 제거
                                          if (k === "A") return "bg-indigo-600/10 text-indigo-700 ring-1 ring-indigo-600/20";
                                          // B or others: neutral
                                          return "bg-slate-200/60 text-slate-700 ring-1 ring-slate-300/60";
                                        };


                                        /* =========================
                                           PATCH 2) recs.map 카드 1개 블록 교체
                                           - 앵커: <div key={String(it?.id || title)} className="rounded-xl border bg-background/60 p-3">
                                           - 교체: 해당 div 시작 ~ 기존 카드 div 닫힘(현재 6378줄 근처)
                                        ========================= */
                                        return (
                                          <div
                                            key={String(it?.id || title)}
                                            className="rounded-2xl bg-white/70 p-4 backdrop-blur shadow-[0_10px_30px_rgba(2,6,23,0.06)] ring-1 ring-slate-200/70"
                                          >
                                            {/* 연결 배지 (Top3 direct/indirect) */}
                                            {showDirect && (
                                              <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-500/20">
                                                🔗 Top3 리스크 직접 완화
                                              </div>
                                            )}

                                            {!showDirect && showIndirect && (
                                              <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-300/25">
                                                🧩 지금 가장 먼저 고칠 3가지
                                              </div>
                                            )}

                                            {/* 헤더 라인: 아이콘 + 제목 */}
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                  {/* strength chip */}
                                                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${strengthClass(strength)}`}>
                                                    {strength}
                                                  </span>

                                                  {/* type chip */}
                                                  <span className="inline-flex items-center rounded-full bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
                                                    {tLabel}
                                                  </span>

                                                  {effort ? (
                                                    <span className="inline-flex items-center rounded-full bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
                                                      effort {effort}
                                                    </span>
                                                  ) : null}

                                                  {eta ? (
                                                    <span className="inline-flex items-center rounded-full bg-slate-100/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/70">
                                                      ETA {eta}
                                                    </span>
                                                  ) : null}
                                                </div>

                                                <div className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
                                                  {title}
                                                </div>

                                                {it?.targetSnippet ? (
                                                  <div className="mt-1 text-[11px] text-slate-500">
                                                    {__stripSimilarity(String(it.targetSnippet))}
                                                  </div>
                                                ) : null}

                                                {it?.because ? (
                                                  <div className="mt-1 text-[11px] text-slate-700">
                                                    <span className="font-semibold text-slate-800">맞춤 근거:</span>{" "}
                                                    {__stripSimilarity(String(it.because))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            </div>

                                            {/* Solution (Before/After 느낌) */}
                                            {it?.rewritePreview?.line ? (
                                              <div className="mt-3 rounded-2xl bg-indigo-600/5 px-4 py-3 ring-1 ring-indigo-600/10">
                                                <div className="text-[11px] font-semibold text-indigo-800">
                                                  💡 이렇게 바꾸면 좋습니다
                                                </div>
                                                <div className="mt-1 text-sm leading-relaxed text-slate-900">
                                                  {String(it.rewritePreview.line)}
                                                </div>
                                              </div>
                                            ) : null}

                                            {reason ? (
                                              <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                                                {__stripSimilarity(reason)}
                                              </div>
                                            ) : null}

                                            {/* ✅ "지금 당장 할 일" 체크리스트 UI (상태 저장 없음) */}
                                            {Array.isArray(it?.how) && it.how.length ? (
                                              <div className="mt-3">
                                                <div className="text-[11px] font-semibold text-slate-600">
                                                  지금 당장 할 일
                                                </div>

                                                <div className="mt-2 space-y-2">
                                                  {it.how.slice(0, 2).map((h, idx) => (
                                                    <div
                                                      key={idx}
                                                      className="group flex items-start gap-2 rounded-xl bg-slate-50/80 px-3 py-2 ring-1 ring-slate-200/70 hover:bg-white hover:ring-indigo-600/20 transition"
                                                    >
                                                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md bg-white ring-1 ring-slate-300 group-hover:ring-indigo-600/30">
                                                        <span className="h-2 w-2 rounded-[3px] bg-slate-300 group-hover:bg-indigo-500" />
                                                      </span>

                                                      <div className="min-w-0 flex-1">
                                                        <div className="text-sm text-slate-800 leading-relaxed">
                                                          {String(h || "")}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                    </CardContent>
                                  </Card>
                                );
                              })()}
                              {(() => {
                                // ✅ PATCH (append-only): The Finisher CTA (Top3 1위 맞춤) — report bottom
                                const __top1Key = (() => {
                                  const t = Array.isArray(__simVM?.top3) ? __simVM.top3 : [];
                                  const x = t && t.length ? t[0] : null;
                                  if (!x) return null;
                                  if (typeof x === "string") return x;
                                  return x?.id || x?.key || x?.signalKey || x?.riskKey || x?.code || x?.name || null;
                                })();

                                const __finisherLead = (() => {
                                  const k = String(__top1Key || "").toUpperCase();

                                  // Gate 계열
                                  if (k.startsWith("GATE__")) {
                                    return "경험 문제가 아니라 “컷 논리”가 먼저 보입니다. 면접관이 걸고 넘어지는 프레임을 먼저 차단해야 합니다.";
                                  }

                                  // 전환/핏 계열
                                  if (k.includes("DOMAIN_SHIFT") || k.includes("ROLE_SHIFT") || k.includes("TRANSITION")) {
                                    return "경험은 좋은데, “이 직무에서 바로 쓰이는 가치”로 번역이 부족합니다. JD 언어로 연결해 주면 판단이 바뀝니다.";
                                  }

                                  // 증거/성과/정량 계열(키 네이밍이 다를 수 있어 넓게 잡음)
                                  if (k.includes("EVID") || k.includes("PROOF") || k.includes("IMPACT") || k.includes("METRIC") || k.includes("QUANT") || k.includes("SCORE")) {
                                    return "경험 자체보다 “증거의 형태”가 문제입니다. 숫자/전후/기여도를 면접관이 읽는 문장으로 바꿔야 합니다.";
                                  }

                                  // 문서/가독성/구조 계열(키 네이밍 방어)
                                  if (k.includes("DOC") || k.includes("STRUCT") || k.includes("CLARITY") || k.includes("READ")) {
                                    return "내용보다 “읽히는 방식”이 불리합니다. 같은 경험도 구조가 바뀌면 합격 확률이 달라집니다.";
                                  }

                                  // 기본값
                                  return "이미 가진 경험은 훌륭합니다. 다만, 면접관의 언어로 번역이 필요할 뿐입니다.";
                                })();

                                return (
                                  <Card className="rounded-2xl border bg-background/70 backdrop-blur mt-6">
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-lg font-bold text-slate-900 leading-snug">
                                        분석 결과를 실제 합격 전략으로 바꿔보세요
                                      </CardTitle>
                                      <div className="mt-1 text-sm text-slate-500 leading-relaxed">
                                        현재 분석 결과를 바탕으로, 지원 직무에 맞는 표현으로 정리하고 합격 관점에서 더 설득력 있게 보완할 수 있습니다.
                                      </div>
                                    </CardHeader>

                                    <CardContent className="pt-0">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {/* Card 1: QUICK CHECK */}
                                        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                                          <div className="text-[10px] font-semibold tracking-widest text-blue-500 uppercase mb-2">QUICK CHECK</div>
                                          <div className="text-sm font-bold text-slate-900 mb-1">미니 컨설팅</div>
                                          <div className="text-xs text-slate-500 mb-4">지금 내 상태가 궁금할 때</div>
                                          <div className="text-3xl font-bold text-slate-900 mb-5">무료</div>
                                          <ul className="space-y-2 mb-5 flex-1">
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-400 shrink-0">✓</span>15분 빠른 점검</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-400 shrink-0">✓</span>핵심 포인트 피드백</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-400 shrink-0">✓</span>온라인 진행</li>
                                          </ul>
                                          <a
                                            className="mt-auto block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                            href="/reject-analyzer/?page=consulting-lead&type=mini"
                                          >
                                            무료로 먼저 문의하기
                                          </a>
                                        </div>

                                        {/* Card 2: EMERGENCY (emphasized) */}
                                        <div className="relative flex flex-col rounded-2xl border-2 border-blue-600 bg-blue-50/20 p-5 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap">인기</span>
                                          </div>
                                          <div className="text-[10px] font-semibold tracking-widest text-blue-600 uppercase mb-2">EMERGENCY</div>
                                          <div className="text-sm font-bold text-slate-900 mb-1">원포인트 컨설팅</div>
                                          <div className="text-xs text-slate-500 mb-4">당장 제출이나 면접이 급할 때</div>
                                          <div className="text-3xl font-bold text-slate-900 mb-5">100,000원</div>
                                          <ul className="space-y-2 mb-5 flex-1">
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-500 shrink-0">✓</span>1회 60분 집중 진행</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-500 shrink-0">✓</span>서류 혹은 면접 택 1</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-500 shrink-0">✓</span>합격 맞춤형 정밀 첨삭</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-500 shrink-0">✓</span>집중 모의 면접 (선택 시)</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-blue-500 shrink-0">✓</span>온라인 진행</li>
                                          </ul>
                                          <a
                                            className="mt-auto block w-full rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                                            href="/reject-analyzer/?page=consulting-lead&type=onepoint"
                                          >
                                            1:1 원포인트 신청하기
                                          </a>
                                        </div>

                                        {/* Card 3: MASTER CLASS */}
                                        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                                          <div className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-2">MASTER CLASS</div>
                                          <div className="text-sm font-bold text-slate-900 mb-1">1:1 집중 밀착 케어</div>
                                          <div className="text-xs text-slate-500 mb-4">이직의 판을 바꾸고 싶을 때</div>
                                          <div className="text-2xl font-bold text-slate-700 mb-5">상담 후 결정</div>
                                          <ul className="space-y-2 mb-5 flex-1">
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-slate-400 shrink-0">✓</span>1시간 x 4회 완성</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-slate-400 shrink-0">✓</span>커리어 전환/합격 전략 설계</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-slate-400 shrink-0">✓</span>입사서류 + 면접 + 산업분석</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-slate-400 shrink-0">✓</span>1:1 멘탈 관리 및 동기부여</li>
                                            <li className="flex items-start gap-2 text-sm text-slate-700"><span className="mt-0.5 text-slate-400 shrink-0">✓</span>온·오프라인 하이브리드</li>
                                          </ul>
                                          <a
                                            className="mt-auto block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                                            href="/reject-analyzer/?page=consulting-lead&type=care"
                                          >
                                            커스텀 견적 문의하기
                                          </a>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })()}

                              {/* ✅ 공유 버튼 → 공유 패널 열기 */}
                              <div className="flex justify-center pt-2" ref={shareAnchorRef}>
                                <Button
                                  variant="outline"
                                  className="rounded-full h-11 px-5"
                                  onClick={() => setSharePanelOpen(true)}
                                >
                                  📤 공유하기
                                </Button>
                              </div>

                            </>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </div>

            {/* ✅ 공유 패널 — motion.div 바깥으로 이동 (fixed가 transform에 갇히는 문제 해결) */}
            {sharePanelOpen && activeTab === SECTION.RESULT && createPortal(
              <div
                className="fixed inset-0 z-[9999] bg-black/40"
                onClick={() => setSharePanelOpen(false)}
              >
                <div
                  className="absolute inset-x-0 bottom-[120px] bg-white rounded-t-2xl shadow-2xl p-5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
                  <div className="text-base font-semibold text-center text-slate-900 mb-4">공유하기</div>
                  <div className="flex justify-center gap-6">
                    <button
                      className="flex flex-col items-center gap-1"
                      onClick={async () => {
                        __trackGa4Event("share_result", {
                          ...__getTransitionLiteAnalyticsContext(),
                          share_type: "kakao_share",
                        });
                        try {
                          const shareSource = getCurrentShareSource();
                          const url = await __buildShareUrlWithSid(shareSource);
                          const shareCopySet = getCurrentShareCopySet(url);
                          // 카카오 공유: public origin 강제 (dev/localhost에서도 배포 URL로 전송)
                          const __kakaoSid = (() => { try { return new URL(url).searchParams.get("sid") || ""; } catch { return url.split("sid=")[1] || ""; } })();
                          const linkUrl = `${__getPublicShareOrigin()}/reject-analyzer/?sid=${__kakaoSid}`;
                          try { globalThis.__DBG_KAKAO_LINK__ = { at: Date.now(), linkUrl }; } catch { }
                          const kakao = window?.Kakao;
                          if (kakao?.Share?.sendDefault && kakao?.isInitialized?.()) {
                            kakao.Share.sendDefault({
                              objectType: "feed",
                              content: {
                                title: shareCopySet.title,
                                description: shareCopySet.description,
                                imageUrl: "https://true-hr.github.io/reject-analyzer/og.jpg",
                                link: { mobileWebUrl: linkUrl, webUrl: linkUrl },
                              },
                              buttons: [
                                {
                                  title: shareCopySet.buttonTitle,
                                  link: { mobileWebUrl: linkUrl, webUrl: linkUrl },
                                },
                              ],
                            });
                          } else {
                            await onShareCopyCurrentReport();
                          }
                        } catch (err) {
                          // 임시 디버그: 원인 확인 후 삭제
                          globalThis.__DBG_SHARE_CREATE__ = {
                            ts: Date.now(),
                            channel: "kakao",
                            message: err?.message || String(err),
                          };
                        }
                        setSharePanelOpen(false);
                      }}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-300 text-xl">💬</span>
                      <span className="text-xs text-slate-600">카카오톡</span>
                    </button>
                    <button
                      className="flex flex-col items-center gap-1"
                      onClick={() => {
                        __trackGa4Event("share_result", {
                          ...__getTransitionLiteAnalyticsContext(),
                          share_type: "copy_link",
                        });
                        onShareCopyCurrentReport();
                        setSharePanelOpen(false);
                      }}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">🔗</span>
                      <span className="text-xs text-slate-600">{shareCopied ? "복사됨" : "복사"}</span>
                    </button>
                    <button
                      className="flex flex-col items-center gap-1"
                      onClick={async () => {
                        __trackGa4Event("share_result", {
                          ...__getTransitionLiteAnalyticsContext(),
                          share_type: "native_share",
                        });
                        try {
                          const shareSource = getCurrentShareSource();
                          const url = await __buildShareUrlWithSid(shareSource);
                          const shareCopySet = getCurrentShareCopySet(url);
                          if (navigator?.share) {
                            await navigator.share({ title: shareCopySet.title, text: shareCopySet.nativeText, url });
                          }
                        } catch (err) {
                          // 임시 디버그: 원인 확인 후 삭제
                          globalThis.__DBG_SHARE_CREATE__ = {
                            ts: Date.now(),
                            channel: "native",
                            message: err?.message || String(err),
                          };
                        }
                        setSharePanelOpen(false);
                      }}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">↗️</span>
                      <span className="text-xs text-slate-600">다른앱</span>
                    </button>
                  </div>
                  <button
                    className="w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50"
                    onClick={() => setSharePanelOpen(false)}
                  >
                    닫기
                  </button>
                </div>
              </div>,
              document.body
            )}

            {/* Right sticky summary */}
            {!isJobSidebarShellActive && !shouldUseWidePreciseAnalysisLayout ? (
            <div className="space-y-6">
              {/* buyingMotion 상세는 비교표 inline으로 이동됨 */}

              {SHOW_INPUT_SUMMARY ? (
                <Card className="border border-slate-200 bg-white lg:sticky lg:top-6">
                  {SHOW_INPUT_SUMMARY ? (
                    <CardHeader className="space-y-1">
                      <CardTitle className="text-base">현재 입력 요약</CardTitle>
                      <div className="text-xs text-muted-foreground">필요한 만큼만 채워도 됩니다</div>
                    </CardHeader>
                  ) : null}
                  <CardContent className="text-sm">
                    {SHOW_INPUT_SUMMARY ? (
                      <>
                        <div className="flex items-center justify-between border-b border-slate-200/70 py-2">
                          <span className="text-slate-600">지원포지션</span>
                          <span className="font-semibold text-slate-900">{currentCareerRoleLabel}</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-slate-200/70 py-2">
                          <span className="text-slate-600">지원 산업</span>
                          <span className="font-semibold text-slate-900">{industryTargetLabel || "-"}</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-slate-200/70 py-2">
                          <span className="text-slate-600">총 경력</span>
                          <span className="font-semibold text-slate-900">{totalYearsLabel || "-"}</span>
                        </div>

                        <div className="flex items-center justify-between border-b border-slate-200/70 py-2">
                          <span className="text-slate-600">리더 경험</span>
                          <span className="font-semibold text-slate-900">{leadershipLabel || "-"}</span>
                        </div>

                        {educationLabel ? (
                          <div className="flex items-center justify-between border-b border-slate-200/70 py-2">
                            <span className="text-slate-600">최종 학력</span>
                            <span className="font-semibold text-slate-900">{educationLabel}</span>
                          </div>
                        ) : null}

                        {showCompanySizeCandidate ? (
                          <div className="flex items-center justify-between border-b border-slate-200/70 py-2">
                            <span className="text-slate-600">내회사규모</span>
                            <span className="font-semibold text-slate-900">{companySizeCandidateValue}</span>
                          </div>
                        ) : null}

                        {showCompanySizeTarget ? (
                          <div className="flex items-center justify-between py-2">
                            <span className="text-slate-600">지원회사규모</span>
                            <span className="font-semibold text-slate-900">{companySizeTargetValue}</span>
                          </div>
                        ) : null}

                        <Separator />

                        {!canAnalyze ? (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed flex gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            “JD 입력 + 이력서 파일 첨부
                          </div>
                        ) : null}

                        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                          <div className="flex items-center gap-2 text-foreground font-semibold">
                            <Lock className="h-4 w-4" />
                            개인정보/법적 주의
                          </div>
                          <div className="mt-1">
                            기본값은 로컬 저장만 사용합니다.
                          </div>
                        </div>

                        {aiLoading ? (
                          <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed flex gap-2">
                            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />
                            AI 보강을 준비 중입니다. (룰 엔진 결과는 이미 반영됨)
                          </div>
                        ) : null}

                        {showInputSummaryAiNotice ? (
                          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed flex gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            현재 입력 기준으로 분석을 진행합니다.
                          </div>
                        ) : null}
                      </>
                    ) : null}

                  </CardContent>
                </Card>
              ) : null}

            </div>
            ) : null}
          </div>
          {isJobSidebarShellActive && jobSidebarView !== "analysis" && jobSidebarView !== "settings" ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:px-5">
              <div className="flex flex-col gap-4">
                <div className="space-y-1">
                  <div className="text-[22px] font-semibold leading-snug text-slate-950">기록이 쌓이면 이런 곳에 쓰입니다</div>
                  <p className="max-w-3xl text-base leading-relaxed text-slate-600">
                    오늘 남긴 기록은 이력서 후보 문장, 직무 분석, 상담 준비 자료로 이어집니다.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-start">
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-slate-200 bg-white px-4 text-[14px] text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => openJobSidebarDestination("resume-update", "weekly")}
                  >
                    오늘 한 일 기록하기
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-slate-200 bg-white px-4 text-[14px] text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => openJobSidebarDestination("resume", "result")}
                  >
                    이력서에 쓸 기록 보기
                  </Button>
                  <Button
                    variant="outline"
                    className="h-10 rounded-full border-slate-200 bg-white px-4 text-[14px] text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
                    onClick={() => openJobSidebarDestination("work", "weekly")}
                  >
                    내 업무기록 흐름 보기
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="pt-2 text-xs text-muted-foreground">i 문의&디버그 요청: 010-3368-4823 | qorrkdtks12@naver.com</div>

          <footer className="pt-12 pb-8 border-t text-xs text-muted-foreground text-center">
            <div>(c) 2026 Baek Gangsan / All rights reserved.</div>
            <div>본 서비스의 분석 알고리즘 및 리포트 구조는 저작권 보호를 받습니다.</div>
            <a
              href={`${import.meta.env.BASE_URL || "/"}privacy`}
              className="mt-2 inline-block text-violet-700 hover:text-violet-900"
            >
              개인정보처리방침
            </a>
          </footer>
        </motion.div>

        {/* ✅ HiddenRisk teaser toast (append-only) */}

      </Shell>
      {renderExampleOnboardingModal()}
      <FirstRecordOnboardingModal
        open={firstRecordOnboardingChecked && isFirstRecordOnboardingOpen}
        onClose={handleDismissFirstRecordOnboarding}
        onStart={handleStartFirstRecordOnboarding}
        onStartGuidedTour={handleStartFirstRecordOnboardingFullProductTour}
      />
      <AiCaptureGuideModal
        open={isAiCaptureGuideOpen}
        onClose={() => setIsAiCaptureGuideOpen(false)}
        onGoToInbox={handleGoToAiInboxFromGuide}
      />
      <FirstRecordGuidedTour
        open={isFirstRecordTourOpen}
        variant={firstRecordTourVariant}
        selectedDate={firstRecordTourDate}
        onOpenRecordInput={handleOpenRecordInputFromFirstRecordTour}
        onNavigate={handleNavigateFirstRecordTour}
        onClose={() => setIsFirstRecordTourOpen(false)}
        onComplete={() => setIsFirstRecordTourOpen(false)}
      />
      <FullProductGuidedTour
        open={isFullProductTourOpen}
        variant="web"
        onNavigate={handleNavigateFullProductTour}
        onClose={() => setIsFullProductTourOpen(false)}
        onComplete={() => setIsFullProductTourOpen(false)}
      />
      {__hrTeaser?.open ? (
        <div className="fixed bottom-5 right-5 z-[2147483647] pointer-events-none">
          <div className="pointer-events-auto w-[320px] rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-amber-50 shadow-2xl shadow-rose-500/20 ring-1 ring-rose-300/40">
            {/* top accent */}
            <div className="h-1.5 w-full rounded-t-2xl bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400" />

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {/* alert dot */}
                  <div className="mt-0.5">
                    <div className="relative h-9 w-9 rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 flex items-center justify-center">
                      <span className="text-lg leading-none">!</span>
                      <span className="absolute -inset-1 rounded-full border border-rose-500/40 animate-ping" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-sm font-semibold tracking-tight text-rose-900">
                      지금 입력 기준으로 <span className="underline decoration-rose-400/60 underline-offset-2">리스크 {Math.min(5, Number(__hrTeaser.count || 0))}개</span> 감지됨
                    </div>
                    <div className="text-xs text-rose-900/70 leading-relaxed">
                      <b className="text-rose-900">구체적으로 입력할 수록</b> 정확도가 올라갑니다.
                    </div>

                    {/* urgency microcopy (no causes) */}
                    <div className="mt-2 rounded-xl bg-rose-50 border border-rose-200/70 px-3 py-2">
                      <div className="text-[11px] leading-relaxed text-rose-900/80">
                        <span className="font-semibold">이 상태로 제출하면</span> 탈락 확률이 높아질 수 있어요.
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="h-8 w-8 rounded-full border border-rose-200 bg-white/80 hover:bg-white flex items-center justify-center text-rose-900/80"
                  onClick={() => { __clearHrTeaserTimer(); __setHrTeaser((p) => ({ ...(p || {}), open: false })); }}
                  aria-label="닫기"
                >
                  <span className="text-base leading-none">×</span>
                </button>
              </div>

              {/* CTA row (still safe: no reveal) */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-rose-600 text-white text-xs font-semibold py-2.5 shadow-lg shadow-rose-600/25 hover:bg-rose-700"
                  onClick={() => { __clearHrTeaserTimer(); __setHrTeaser((p) => ({ ...(p || {}), open: false })); }}
                >
                  계속 입력해서 정확도 올리기
                </button>
                <div className="text-[11px] text-rose-900/60 whitespace-nowrap">
                  {String(__hrTeaser.key || "").startsWith("proxy:") ? "입력 기반" : "분석 기반"}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TooltipProvider>
  );
}
