import { useEffect, useRef, useState } from "react";
import {
  buildAccountLinkingCards,
  buildNotificationChannelCards,
  buildReminderRuleCards,
  formatSchedulerV2SummaryRow,
  hasActiveKakaoIdentity,
  hasKakaoLinkingDbReadiness,
} from "./schedulerV2NotificationSummaryFormat.js";
import { supabase } from "../../lib/supabaseClient.js";
import {
  buildSchedulerV2ReminderRulePayload,
  saveSchedulerV2ReminderRule,
} from "../../lib/schedulerV2NotificationSettingsRepository.js";
import { getCurrentUserIdentities, getSession, linkKakaoIdentity } from "../../lib/auth.js";
import {
  confirmCurrentPersonPhoneVerificationDryRun,
  isPhoneVerificationDryRunUiEnabled,
  startCurrentPersonPhoneVerificationDryRun,
  upsertCurrentPersonNotificationConsent,
  upsertCurrentPersonPhoneContact,
} from "../../lib/schedulerV2ContactConsentRepository.js";
import {
  fetchSchedulerV2NotificationSummary,
  syncCurrentPersonAuthIdentities,
} from "../../lib/schedulerV2NotificationSummaryRepository.js";
import {
  getAuthLinkErrorUserMessage,
  sanitizeAuthLinkError,
} from "../../lib/authErrorDiagnostics.js";
import {
  sanitizeKakaoLinkReturnSyncError,
  syncKakaoLinkReturnIdentityIfNeeded,
} from "../../lib/kakaoLinkReturnIdentitySync.js";
import {
  REQUIRED_CONFIRMATION_TEXT,
  buildSanitizedIdentitySummary,
  getGuardedKakaoUnlinkEligibility,
  isAccountRecoveryHelperEnabled,
  sanitizeKakaoUnlinkError,
  unlinkKakaoIdentityForAccountRecovery,
} from "../../lib/accountRecoveryKakaoUnlink.js";
import { deriveKakaoAlimtalkState } from "./kakaoAlimtalkStateFormat.js";

const KAKAO_LINK_PENDING_KEY = "passmap:kakao-account-link-pending";
const KAKAO_LINK_RETURN_PARAM = "kakao_link";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function fmtSchedule(day, time) {
  return `매주 ${DAY_LABELS[day]}요일 ${(time || "").slice(0, 5)}`;
}

function getPushSummary(pushStatus, pushSubscribed) {
  if (pushStatus === "granted" && pushSubscribed) return "폰/디바이스 알림 수신 중";
  if (pushStatus === "granted" && !pushSubscribed) return "기기 알림 권한 허용됨 · 등록 필요";
  if (pushStatus === "idle" || pushStatus === "error") return "기기 알림 미설정";
  if (pushStatus === "denied") return "기기 알림 차단됨";
  if (pushStatus === "unsupported") return "이 브라우저는 기기 알림 미지원";
  if (pushStatus === "key_missing") return "기기 알림 비활성화됨";
  return "";
}

function getProviderLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "kakao") return "Kakao";
  if (provider === "naver" || provider === "custom:naver") return "Naver";
  return provider || "소셜 로그인";
}

function getAccountSummary(auth) {
  if (!auth?.loggedIn) return "로그인 필요";
  const user = auth?.user || {};
  const primary = user.name || user.email || "로그인 사용자";
  const provider = getProviderLabel(user.provider);
  return user.email && user.name ? `${primary} · ${user.email} · ${provider}` : `${primary} · ${provider}`;
}

function getPermissionSummary(pushStatus) {
  if (pushStatus === "granted") return "권한 켜짐";
  if (pushStatus === "denied") return "권한 차단됨";
  if (pushStatus === "unsupported") return "알림 미지원";
  if (pushStatus === "key_missing") return "서비스 비활성";
  if (pushStatus === "loading") return "확인 중";
  return "권한 꺼짐";
}

function getSubscriptionSummary(pushStatus, pushSubscribed, checkStatus) {
  if (pushStatus === "unsupported" || pushStatus === "key_missing") return "확인 불가";
  if (checkStatus === "checking") return "확인 중";
  if (checkStatus === "error") return "확인 불가";
  if (pushSubscribed && checkStatus === "found") return "등록됨";
  if (pushSubscribed) return "기기 등록 확인 필요";
  return "등록 필요";
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getLastRegisteredSummary(record, checkStatus) {
  if (checkStatus === "error") return "확인 불가";
  if (!record) return "아직 등록 기록 없음";
  return formatDateTime(record.last_seen_at || record.updated_at || record.created_at) || "확인 불가";
}

function getNextReminderSummary(reminderPref) {
  if (!reminderPref) return "저장 후 다음 알림 예정 시간이 표시됩니다";
  if (!reminderPref.is_enabled) return "알림이 꺼져 있어요";
  const timeStr = (reminderPref.preferred_time_local || "").slice(0, 5);
  if (!timeStr || !timeStr.includes(":")) return null;
  const dayOfWeek = reminderPref.preferred_day_of_week;
  const [hh, mm] = timeStr.split(":").map(Number);
  const now = new Date();
  const currentDay = now.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0) {
    daysAhead += 7;
  } else if (daysAhead === 0) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (hh * 60 + mm <= nowMinutes) daysAhead = 7;
  }
  const nextDate = new Date(now);
  nextDate.setDate(now.getDate() + daysAhead);
  const month = nextDate.getMonth() + 1;
  const day = nextDate.getDate();
  return `다음 알림 예정: ${month}월 ${day}일 ${DAY_LABELS[dayOfWeek]}요일 ${timeStr}`;
}

function StatusPill({ children }) {
  const tone =
    children === "연결됨" ||
    children === "활성" ||
    children === "ON" ||
    children === "알림톡 수신 동의 준비됨" ||
    children === "카카오 알림톡 발송 준비됨"
      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
      : children === "인증 필요" ||
          children === "동의 필요" ||
          children === "카카오 계정 연결됨 · 알림톡 동의 필요"
        ? "border-amber-100 bg-amber-50 text-amber-700"
        : children === "카카오 알림톡 사용 불가"
          ? "border-red-100 bg-red-50 text-red-600"
        : "border-slate-200 bg-slate-100 text-slate-500";
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {children}
    </span>
  );
}

function DisabledAction({ children }) {
  return (
    <span className="inline-flex w-fit cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
      {children}
    </span>
  );
}

function ChannelCard({ card }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">{card.label}</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{card.role}</div>
          {card.description ? (
            <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{card.description}</div>
          ) : null}
        </div>
        <StatusPill>{card.status}</StatusPill>
      </div>
      {card.actionLabel ? (
        <div className="mt-2">
          <DisabledAction>{card.actionLabel}</DisabledAction>
        </div>
      ) : null}
    </div>
  );
}

function AccountLinkCard({ card }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-slate-800">{card.label}</div>
        <StatusPill>{card.status}</StatusPill>
      </div>
      {card.description ? (
        <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{card.description}</div>
      ) : null}
      <div className="mt-2">
        <DisabledAction>{card.actionLabel}</DisabledAction>
      </div>
    </div>
  );
}

function getKakaoLinkRedirectTo() {
  if (typeof window === "undefined") return undefined;
  const url = new URL(window.location.href);
  url.searchParams.set(KAKAO_LINK_RETURN_PARAM, "1");
  return url.toString();
}

function hasKakaoLinkReturnSignal() {
  if (typeof window === "undefined") return false;
  const hasReturnParam = new URLSearchParams(window.location.search).get(KAKAO_LINK_RETURN_PARAM) === "1";
  const hasPendingFlag = window.sessionStorage?.getItem(KAKAO_LINK_PENDING_KEY) === "1";
  return hasReturnParam || hasPendingFlag;
}

function clearKakaoLinkReturnSignal() {
  if (typeof window === "undefined") return;
  window.sessionStorage?.removeItem(KAKAO_LINK_PENDING_KEY);
  const url = new URL(window.location.href);
  if (url.searchParams.has(KAKAO_LINK_RETURN_PARAM)) {
    url.searchParams.delete(KAKAO_LINK_RETURN_PARAM);
    window.history.replaceState({}, "", url.toString());
  }
}

function formatProviderSummary(summary) {
  if (!summary?.identityCount) return "identity count 0";
  return summary.providers.map((item) => `${item.provider} ${item.count}`).join(" + ");
}

function AccountRecoveryKakaoUnlinkHelper({ loggedIn }) {
  const [summary, setSummary] = useState(() => buildSanitizedIdentitySummary([]));
  const [loadStatus, setLoadStatus] = useState("idle");
  const [actionStatus, setActionStatus] = useState("idle");
  const [actionResult, setActionResult] = useState(null);
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [unlinkConfirmed, setUnlinkConfirmed] = useState(false);

  const eligibility = getGuardedKakaoUnlinkEligibility(summary, {
    transferCompleted: transferConfirmed,
    confirmationChecked: unlinkConfirmed,
  });

  async function reloadIdentitySummary() {
    if (!loggedIn || !supabase?.auth?.getUserIdentities) {
      setSummary(buildSanitizedIdentitySummary([]));
      return;
    }
    setLoadStatus("loading");
    const response = await supabase.auth.getUserIdentities();
    if (response?.error) throw response.error;
    const identities = Array.isArray(response?.data?.identities)
      ? response.data.identities
      : Array.isArray(response?.identities)
        ? response.identities
        : [];
    setSummary(buildSanitizedIdentitySummary(identities));
    setLoadStatus("ready");
  }

  useEffect(() => {
    let cancelled = false;
    if (!loggedIn) {
      setSummary(buildSanitizedIdentitySummary([]));
      setLoadStatus("idle");
      return undefined;
    }

    setLoadStatus("loading");
    reloadIdentitySummary().catch((error) => {
      if (cancelled) return;
      setLoadStatus("error");
      setActionResult({ status: "error", error: sanitizeKakaoUnlinkError(error) });
    });

    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  async function handleUnlinkKakao() {
    if (!eligibility.canUnlink || actionStatus === "running" || !supabase?.auth) return;
    setActionStatus("running");
    setActionResult(null);
    try {
      const result = await unlinkKakaoIdentityForAccountRecovery(supabase.auth);
      setSummary(result.after || result.before || buildSanitizedIdentitySummary([]));
      setActionResult(result);
      setActionStatus(result.ok ? "success" : result.status || "error");
    } catch (error) {
      const diagnostic = sanitizeKakaoUnlinkError(error);
      setActionResult({ status: "error", error: diagnostic });
      setActionStatus("error");
      try {
        await reloadIdentitySummary();
      } catch {
        setLoadStatus("error");
      }
    }
  }

  const disabled = !loggedIn || !eligibility.canUnlink || actionStatus === "running";
  const providerSummary = formatProviderSummary(summary);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-amber-900">Account recovery Kakao unlink</div>
          <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-amber-800">
            <div>이 작업은 source 계정에서 Kakao 로그인 수단을 제거하는 단계입니다.</div>
            <div>다음 단계에서 target Google 계정으로 로그인해 Kakao 계정을 다시 연결해야 합니다.</div>
            <div>Auth user 삭제나 데이터 삭제는 수행하지 않습니다.</div>
          </div>
        </div>
        <StatusPill>{eligibility.canUnlink ? "ready" : "guarded"}</StatusPill>
      </div>

      <div className="mt-2 rounded-lg border border-amber-100 bg-white/70 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
        <div>provider summary: {providerSummary}</div>
        <div>identity count: {summary.identityCount}</div>
        {loadStatus === "loading" ? <div>identity summary loading</div> : null}
        {eligibility.blockers.length > 0 ? (
          <div>blocked: {eligibility.blockers.join(", ")}</div>
        ) : (
          <div>guard passed</div>
        )}
      </div>

      <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-slate-700">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={transferConfirmed}
            onChange={(event) => setTransferConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          <span>production data transfer after verification PASS를 확인했습니다.</span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={unlinkConfirmed}
            onChange={(event) => setUnlinkConfirmed(event.target.checked)}
            className="mt-0.5"
          />
          <span>{REQUIRED_CONFIRMATION_TEXT}</span>
        </label>
      </div>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleUnlinkKakao}
          disabled={disabled}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            disabled
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-amber-700 text-white hover:bg-amber-800"
          }`}
        >
          {actionStatus === "running" ? "Kakao unlink running..." : "Unlink source Kakao identity"}
        </button>
        {actionResult ? (
          <div className="text-[11px] leading-relaxed text-slate-600">
            {actionResult.ok ? (
              <span>
                success: status {actionResult.status}, after {formatProviderSummary(actionResult.after)}
              </span>
            ) : (
              <span>
                {actionResult.status || "error"}: {actionResult.error?.category || "unknown"} /{" "}
                {actionResult.error?.status || "no-status"} / {actionResult.error?.name || "no-name"} /{" "}
                {actionResult.error?.message || "no-message"}
              </span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function KakaoAccountLinkingEntrypoint({
  loggedIn,
  connected,
  dbReady,
  linkStatus,
  linkMessage,
  onStartLink,
}) {
  if (!loggedIn) return null;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">카카오 계정 연결</div>
          <div className="mt-1 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
            <div>카카오 계정을 연결하면 같은 PASSMAP 계정에서 기록과 알림 설정을 함께 관리할 수 있습니다.</div>
            <div>카카오 계정 연결은 알림톡 수신 동의와 별도입니다.</div>
          </div>
        </div>
        <StatusPill>{!dbReady ? "준비 중" : connected ? "연결됨" : "미연결"}</StatusPill>
      </div>
      {!dbReady ? (
        <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700">
          <div>카카오 계정 연결은 준비 중입니다.</div>
          <div>알림/계정 통합 DB 적용 후 사용할 수 있습니다.</div>
        </div>
      ) : null}
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onStartLink}
          disabled={!dbReady || connected || linkStatus === "linking" || linkStatus === "syncing"}
          className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            dbReady && !connected && linkStatus !== "linking" && linkStatus !== "syncing"
              ? "bg-slate-900 text-white hover:bg-slate-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {!dbReady ? "준비 중" : connected ? "연결됨" : linkStatus === "linking" ? "연결 이동 중" : "카카오 계정 연결"}
        </button>
        {linkMessage ? (
          <span
            className={`text-[11px] font-medium ${
              linkStatus === "error" ? "text-red-500" : "text-slate-500"
            }`}
          >
            {linkMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ReminderRuleCard({ card }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">{card.title}</div>
          <div className="mt-0.5 text-[11px] text-slate-600">{card.schedule}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{card.channelSummary}</div>
        </div>
        <StatusPill>{card.status}</StatusPill>
      </div>
    </div>
  );
}

function hasGrantedReminderConsent(row, channel) {
  const consents = Array.isArray(row?.consents) ? row.consents : [];
  return consents.some((item) => {
    const consentType = item?.consent_type || item?.type || "reminder";
    const status = item?.status || item?.consent_status;
    return (
      item?.channel === channel &&
      consentType === "reminder" &&
      (status === "granted" || status === "agreed" || status === "active")
    );
  });
}

function PhoneContactSaveForm({
  loggedIn,
  phoneValue,
  saveStatus,
  saveMessage,
  onPhoneChange,
  onSave,
}) {
  const canSave = loggedIn && saveStatus !== "saving" && String(phoneValue || "").trim().length > 0;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold text-slate-800">휴대폰 번호</div>
      <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
        알림톡/SMS 준비에 필요해요. 저장만으로 발송이 켜지지는 않아요.
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="tel"
          value={phoneValue}
          onChange={(event) => onPhoneChange(event.target.value)}
          disabled={!loggedIn || saveStatus === "saving"}
          placeholder="휴대폰 번호"
          autoComplete="tel"
          className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            canSave
              ? "bg-slate-900 text-white hover:bg-slate-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {saveStatus === "saving" ? "저장 중..." : "번호 저장"}
        </button>
      </div>
      {saveStatus === "saved" && (
        <div className="mt-1 space-y-0.5">
          <div className="text-[11px] font-medium text-emerald-600">{saveMessage}</div>
          <div className="text-[11px] leading-relaxed text-slate-500">
            다음 단계에서 인증과 수신 동의가 필요해요.
          </div>
        </div>
      )}
      {saveStatus === "error" && (
        <div className="mt-1 text-[11px] font-medium text-red-500">{saveMessage}</div>
      )}
    </div>
  );
}

function PhoneVerificationDryRunPanel({
  loggedIn,
  challengeId,
  codeValue,
  status,
  message,
  onCodeChange,
  onStart,
  onConfirm,
}) {
  const isRunning = status === "starting" || status === "confirming";
  const canStart = loggedIn && !isRunning;
  const canConfirm = loggedIn && !isRunning && Boolean(challengeId);

  return (
    <details className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 sm:col-span-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
        인증 흐름 테스트
      </summary>
      <div className="mt-2 space-y-2">
        <div className="text-[11px] leading-relaxed text-slate-500">
          개발용 dry-run입니다. 실제 문자 발송이나 번호 인증은 이루어지지 않아요.
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              canStart
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            {status === "starting" ? "dry-run 시작 중" : "dry-run 시작"}
          </button>
          <input
            type="text"
            value={codeValue}
            onChange={(event) => onCodeChange(event.target.value)}
            disabled={!loggedIn || isRunning}
            placeholder="인증 코드 입력"
            autoComplete="one-time-code"
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 outline-none placeholder:text-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              canConfirm
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            {status === "confirming" ? "dry-run 확인 중" : "dry-run 확인"}
          </button>
        </div>
        {message ? (
          <div
            className={`text-[11px] font-medium ${
              status === "error" ? "text-red-500" : "text-slate-600"
            }`}
          >
            {message}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function NotificationConsentSplitForm({
  loggedIn,
  consentDraft,
  saveStatus,
  saveMessage,
  onConsentChange,
  onSave,
}) {
  const canSave = loggedIn && saveStatus !== "saving";

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 sm:col-span-2">
      <div className="text-xs font-semibold text-slate-800">수신 동의</div>
      <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
        동의만 저장돼요. 인증과 발송 채널 준비가 끝나기 전까지 알림은 발송되지 않아요.
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
          <input
            type="checkbox"
            checked={Boolean(consentDraft.kakao_alimtalk)}
            onChange={(event) => onConsentChange("kakao_alimtalk", event.target.checked)}
            disabled={!loggedIn || saveStatus === "saving"}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 disabled:cursor-not-allowed"
          />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-slate-700">
              카카오 알림톡 리마인드 수신 동의
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
              운영 알림 주 채널 후보예요. 아직 인증과 채널 준비가 필요해요.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
          <input
            type="checkbox"
            checked={Boolean(consentDraft.sms)}
            onChange={(event) => onConsentChange("sms", event.target.checked)}
            disabled={!loggedIn || saveStatus === "saving"}
            className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-slate-900 disabled:cursor-not-allowed"
          />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold text-slate-700">
              SMS 보조 알림 수신 동의
            </span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
              알림톡 실패나 인증 안내에 쓰는 보조 채널이에요.
            </span>
          </span>
        </label>
      </div>
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            canSave
              ? "bg-slate-900 text-white hover:bg-slate-700"
              : "cursor-not-allowed bg-slate-100 text-slate-400"
          }`}
        >
          {saveStatus === "saving" ? "저장 중..." : "동의 저장"}
        </button>
        {saveMessage ? (
          <span
            className={`text-[11px] font-medium ${
              saveStatus === "error" ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {saveMessage}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function KakaoContactConsentReadyState({ stateModel }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-800">카카오 알림톡</div>
          <div className="mt-0.5 text-[11px] font-semibold text-slate-600">알림톡 수신 설정 준비 중</div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {stateModel.description}
          </div>
          <div className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
            수신 동의 저장과 연락처 확인 방식은 아직 연결되지 않았습니다.
          </div>
        </div>
        <StatusPill>{stateModel.label}</StatusPill>
      </div>
      <div className="mt-2">
        <DisabledAction>{stateModel.actionLabel}</DisabledAction>
      </div>
    </div>
  );
}

function SchedulerV2SummaryPreview({
  loggedIn,
  reminderDraft,
  rows,
  status,
  error,
}) {
  const [summaryRowsOverride, setSummaryRowsOverride] = useState(null);
  const [linkStatus, setLinkStatus] = useState("idle");
  const [linkMessage, setLinkMessage] = useState("");
  const kakaoLinkReturnSyncStartedRef = useRef(false);
  const safeRows = Array.isArray(summaryRowsOverride)
    ? summaryRowsOverride
    : Array.isArray(rows)
      ? rows
      : [];
  const primaryRow = safeRows[0] || null;
  const kakaoState = deriveKakaoAlimtalkState(primaryRow);
  const channelCards = buildNotificationChannelCards(primaryRow);
  const accountCards = buildAccountLinkingCards(primaryRow);
  const reminderRuleCards = buildReminderRuleCards(primaryRow);
  const kakaoIdentityConnected = hasActiveKakaoIdentity(primaryRow);
  const kakaoLinkingDbReady = hasKakaoLinkingDbReadiness(primaryRow);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const [contactSaveStatus, setContactSaveStatus] = useState("idle");
  const [contactSaveMessage, setContactSaveMessage] = useState("");
  const [phoneDryRunChallengeId, setPhoneDryRunChallengeId] = useState("");
  const [phoneDryRunCode, setPhoneDryRunCode] = useState("");
  const [phoneDryRunStatus, setPhoneDryRunStatus] = useState("idle");
  const [phoneDryRunMessage, setPhoneDryRunMessage] = useState("");
  const [notificationConsentDraft, setNotificationConsentDraft] = useState({
    kakao_alimtalk: false,
    sms: false,
  });
  const [notificationConsentSaveStatus, setNotificationConsentSaveStatus] = useState("idle");
  const [notificationConsentSaveMessage, setNotificationConsentSaveMessage] = useState("");
  const canSave = loggedIn && saveStatus !== "saving";

  useEffect(() => {
    setNotificationConsentDraft({
      kakao_alimtalk: hasGrantedReminderConsent(primaryRow, "kakao_alimtalk"),
      sms: hasGrantedReminderConsent(primaryRow, "sms"),
    });
  }, [primaryRow]);

  async function refreshSummaryAfterIdentitySync() {
    if (!supabase) throw new Error("Supabase client is not configured.");
    const result = await syncKakaoLinkReturnIdentityIfNeeded({
      hasReturnSignal: hasKakaoLinkReturnSignal(),
      summaryRows: safeRows,
      getSession,
      loadAuthIdentitySummary: () => getCurrentUserIdentities(supabase),
      syncCurrentPersonAuthIdentities: () => syncCurrentPersonAuthIdentities(supabase),
      fetchSchedulerV2NotificationSummary: () => fetchSchedulerV2NotificationSummary(supabase),
    });
    setSummaryRowsOverride(result.rows);
    return result;
  }

  useEffect(() => {
    if (!loggedIn || !hasKakaoLinkReturnSignal() || kakaoLinkReturnSyncStartedRef.current) return;

    let cancelled = false;
    kakaoLinkReturnSyncStartedRef.current = true;
    setLinkStatus("syncing");
    setLinkMessage("카카오 계정 연결 상태를 확인하고 있습니다.");
    refreshSummaryAfterIdentitySync()
      .then(() => {
        if (cancelled) return;
        clearKakaoLinkReturnSignal();
        setLinkStatus("idle");
        setLinkMessage("");
      })
      .catch((error) => {
        if (cancelled) return;
        clearKakaoLinkReturnSignal();
        setLinkStatus("error");
        sanitizeKakaoLinkReturnSyncError(error);
        setLinkMessage("카카오 계정 연결 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
      });

    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  async function handleStartKakaoLink() {
    if (!loggedIn || !kakaoLinkingDbReady || kakaoIdentityConnected) return;
    setLinkStatus("linking");
    setLinkMessage("");
    try {
      if (typeof window !== "undefined") {
        window.sessionStorage?.setItem(KAKAO_LINK_PENDING_KEY, "1");
      }
      await linkKakaoIdentity({ redirectTo: getKakaoLinkRedirectTo() });
    } catch (error) {
      if (typeof window !== "undefined") {
        window.sessionStorage?.removeItem(KAKAO_LINK_PENDING_KEY);
      }
      const diagnostic = sanitizeAuthLinkError(error);
      console.warn("[kakao-link] linkIdentity failed", diagnostic);
      setLinkStatus("error");
      setLinkMessage(getAuthLinkErrorUserMessage(error));
    }
  }

  async function handleSaveSchedulerV2() {
    if (!loggedIn) return;
    setSaveStatus("saving");
    setSaveMessage("");
    try {
      if (!supabase) throw new Error("Supabase client is not configured.");
      const payload = buildSchedulerV2ReminderRulePayload(reminderDraft);
      await saveSchedulerV2ReminderRule(supabase, payload);
      setSaveStatus("saved");
      setSaveMessage("알림 규칙을 저장했습니다.");
      setTimeout(() => {
        setSaveStatus("idle");
        setSaveMessage("");
      }, 2500);
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(error?.message || "알림 규칙 저장에 실패했습니다.");
      setTimeout(() => {
        setSaveStatus("idle");
        setSaveMessage("");
      }, 3500);
    }
  }

  async function handleSavePhoneContact() {
    if (!loggedIn) return;
    setContactSaveStatus("saving");
    setContactSaveMessage("");
    try {
      if (!supabase) throw new Error("Supabase client is not configured.");
      await upsertCurrentPersonPhoneContact(supabase, smsPhone);
      setContactSaveStatus("saved");
      setContactSaveMessage("저장됨 · 인증 필요");
      setSmsPhone("");
      setTimeout(() => {
        setContactSaveStatus("idle");
        setContactSaveMessage("");
      }, 2500);
    } catch (error) {
      setContactSaveStatus("error");
      setContactSaveMessage(
        error?.message === "A valid phone number is required."
          ? "휴대폰 번호를 확인해 주세요."
          : "번호를 저장하지 못했어요. 잠시 후 다시 시도해 주세요."
      );
      setTimeout(() => {
        setContactSaveStatus("idle");
        setContactSaveMessage("");
      }, 3500);
    }
  }

  async function handleStartPhoneVerificationDryRun() {
    if (!loggedIn || phoneDryRunStatus === "starting" || phoneDryRunStatus === "confirming") return;
    setPhoneDryRunStatus("starting");
    setPhoneDryRunMessage("");
    setPhoneDryRunChallengeId("");
    try {
      if (!supabase) throw new Error("Supabase client is not configured.");
      const result = await startCurrentPersonPhoneVerificationDryRun(supabase);
      setPhoneDryRunChallengeId(result.challengeId || "");
      setPhoneDryRunStatus("started");
      setPhoneDryRunMessage(
        result.expiresAt ? `dry-run 시작됨 · 만료 ${formatDateTime(result.expiresAt)}` : "dry-run 시작됨"
      );
    } catch {
      setPhoneDryRunStatus("error");
      setPhoneDryRunMessage("dry-run을 시작하지 못했어요.");
    }
  }

  async function handleConfirmPhoneVerificationDryRun() {
    if (
      !loggedIn ||
      !phoneDryRunChallengeId ||
      phoneDryRunStatus === "starting" ||
      phoneDryRunStatus === "confirming"
    ) {
      return;
    }
    setPhoneDryRunStatus("confirming");
    setPhoneDryRunMessage("");
    try {
      if (!supabase) throw new Error("Supabase client is not configured.");
      const result = await confirmCurrentPersonPhoneVerificationDryRun(
        supabase,
        phoneDryRunChallengeId,
        { metadata: { code_entered: Boolean(phoneDryRunCode) } }
      );
      setPhoneDryRunStatus(result.status === "confirmed" ? "confirmed" : "started");
      setPhoneDryRunMessage(
        result.status === "confirmed"
          ? "dry-run 확인 완료 · 실제 인증 아님"
          : `dry-run 상태 · ${result.status || "unknown"}`
      );
      setPhoneDryRunCode("");
    } catch {
      setPhoneDryRunStatus("error");
      setPhoneDryRunMessage("dry-run 확인에 실패했어요.");
    }
  }

  function handleNotificationConsentChange(channel, checked) {
    setNotificationConsentDraft((current) => ({
      ...current,
      [channel]: checked,
    }));
    if (notificationConsentSaveStatus !== "saving") {
      setNotificationConsentSaveStatus("idle");
      setNotificationConsentSaveMessage("");
    }
  }

  async function handleSaveNotificationConsent() {
    if (!loggedIn) return;
    setNotificationConsentSaveStatus("saving");
    setNotificationConsentSaveMessage("");
    try {
      if (!supabase) throw new Error("Supabase client is not configured.");
      await upsertCurrentPersonNotificationConsent(
        supabase,
        "kakao_alimtalk",
        notificationConsentDraft.kakao_alimtalk ? "granted" : "revoked"
      );
      await upsertCurrentPersonNotificationConsent(
        supabase,
        "sms",
        notificationConsentDraft.sms ? "granted" : "revoked"
      );
      setNotificationConsentSaveStatus("saved");
      setNotificationConsentSaveMessage(
        notificationConsentDraft.kakao_alimtalk || notificationConsentDraft.sms
          ? "동의 저장됨 · 아직 발송 준비 전"
          : "동의 해제됨"
      );
      setTimeout(() => {
        setNotificationConsentSaveStatus("idle");
        setNotificationConsentSaveMessage("");
      }, 2500);
    } catch {
      setNotificationConsentSaveStatus("error");
      setNotificationConsentSaveMessage("동의를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setTimeout(() => {
        setNotificationConsentSaveStatus("idle");
        setNotificationConsentSaveMessage("");
      }, 3500);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3">
      <div>
        <div className="text-sm font-semibold text-slate-900">알림 연결 상태</div>
        <div className="mt-1 text-xs leading-relaxed text-slate-500">
          PASSMAP이 카카오 알림톡과 현재 기기 알림을 중심으로 리마인드를 보낼 준비 상태를 확인합니다.
        </div>
      </div>

      {!loggedIn ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          로그인 후 알림 연결 상태를 확인할 수 있어요.
        </div>
      ) : status === "loading" ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          알림 설정을 불러오는 중입니다...
        </div>
      ) : status === "error" ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-600">
          알림 설정 정보를 불러오지 못했습니다. 기존 알림 기능은 그대로 사용할 수 있습니다.
          {error?.message ? <span className="sr-only"> {error.message}</span> : null}
        </div>
      ) : (
        <div className="space-y-2">
          {safeRows.length === 0 ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              아직 연결된 알림 설정이 없습니다. 아래 항목은 연결 준비 상태입니다.
            </div>
          ) : null}
          <section className="space-y-2">
            <div>
              <div className="text-xs font-semibold text-slate-900">알림 채널</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                운영 알림은 카카오 알림톡을 우선으로 준비하고, 폰/디바이스 알림은 즉시성 높은 보조 알림으로 둡니다. SMS는 실패나 긴급 상황의 fallback입니다.
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {channelCards.map((card) => (
                <ChannelCard key={card.id} card={card} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <KakaoContactConsentReadyState stateModel={kakaoState} />
              <PhoneContactSaveForm
                loggedIn={loggedIn}
                phoneValue={smsPhone}
                saveStatus={contactSaveStatus}
                saveMessage={contactSaveMessage}
                onPhoneChange={setSmsPhone}
                onSave={handleSavePhoneContact}
              />
              {isPhoneVerificationDryRunUiEnabled() ? (
                <PhoneVerificationDryRunPanel
                  loggedIn={loggedIn}
                  challengeId={phoneDryRunChallengeId}
                  codeValue={phoneDryRunCode}
                  status={phoneDryRunStatus}
                  message={phoneDryRunMessage}
                  onCodeChange={setPhoneDryRunCode}
                  onStart={handleStartPhoneVerificationDryRun}
                  onConfirm={handleConfirmPhoneVerificationDryRun}
                />
              ) : null}
              <NotificationConsentSplitForm
                loggedIn={loggedIn}
                consentDraft={notificationConsentDraft}
                saveStatus={notificationConsentSaveStatus}
                saveMessage={notificationConsentSaveMessage}
                onConsentChange={handleNotificationConsentChange}
                onSave={handleSaveNotificationConsent}
              />
            </div>
          </section>

          <section className="space-y-2 border-t border-slate-100 pt-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">계정 연결</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                Google, Kakao, Naver 로그인을 같은 PASSMAP 사람 계정으로 묶어 알림과 기록을 함께 관리합니다.
              </div>
            </div>
            <KakaoAccountLinkingEntrypoint
              loggedIn={loggedIn}
              connected={kakaoIdentityConnected}
              dbReady={kakaoLinkingDbReady}
              linkStatus={linkStatus}
              linkMessage={linkMessage}
              onStartLink={handleStartKakaoLink}
            />
            {isAccountRecoveryHelperEnabled() ? (
              <AccountRecoveryKakaoUnlinkHelper loggedIn={loggedIn} />
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {accountCards.map((card) => (
                <AccountLinkCard key={card.id} card={card} />
              ))}
            </div>
          </section>

          <section className="space-y-2 border-t border-slate-100 pt-3">
            <div>
              <div className="text-xs font-semibold text-slate-900">알림 규칙</div>
              <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                현재 저장 경로는 유지하며, 향후 카카오 알림톡과 디바이스 알림 중심으로 확장할 예정입니다.
              </div>
            </div>
            <div className="space-y-2">
              {reminderRuleCards.map((card) => (
                <ReminderRuleCard key={card.id} card={card} />
              ))}
            </div>
          </section>

          <details className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700">
              개발용 원본 요약 보기
            </summary>
            <div className="mt-2 space-y-2">
              {safeRows.map((row, index) => {
                const summary = formatSchedulerV2SummaryRow(row, index);
                return (
                  <div key={row?.person_id || index} className="text-xs leading-relaxed text-slate-600">
                    <div className="font-semibold text-slate-800">
                      {row?.person_status ? summary.title : summary.fallbackTitle}
                    </div>
                    <div className="mt-1 break-words">연결 계정: {summary.providers}</div>
                    <div className="break-words">알림 채널: {summary.contactChannels}</div>
                    <div className="break-words">수신 동의: {summary.consents}</div>
                    <div className="break-words">리마인드: {summary.reminderRules}</div>
                    <div className="break-words">디바이스 알림: {summary.webPush}</div>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[11px] leading-relaxed text-slate-400">
          Scheduler v2 RPC 기반 저장입니다. 카카오/디바이스 알림을 우선하고 SMS는 fallback으로만 준비합니다.
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <button
            type="button"
            onClick={handleSaveSchedulerV2}
            disabled={!canSave}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              canSave
                ? "bg-slate-900 text-white hover:bg-slate-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {saveStatus === "saving" ? "알림 규칙 저장 중..." : "알림 규칙 저장"}
          </button>
          {saveStatus === "saved" && (
            <span className="text-[11px] font-medium text-emerald-600">{saveMessage || "Saved."}</span>
          )}
          {saveStatus === "error" && (
            <span className="max-w-[220px] break-words text-[11px] font-medium text-red-500">
              {saveMessage || "Save failed."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpandedCards({
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
  onToggleEnabled,
  onDayChange,
  onTimeChange,
  onSave,
  onRequestPush,
  onRevokePush,
  onSendTestPush,
}) {
  const loggedIn = auth?.loggedIn;
  const accountSummary = getAccountSummary(auth);
  const permissionSummary = getPermissionSummary(pushStatus);
  const subscriptionSummary = getSubscriptionSummary(pushStatus, pushSubscribed, pushSubscriptionCheckStatus);
  const lastRegisteredSummary = getLastRegisteredSummary(pushSubscriptionRecord, pushSubscriptionCheckStatus);
  const hasConfirmedPushRegistration =
    pushSubscriptionCheckStatus === "found" ||
    pushSubscriptionCheckStatus === "registered" ||
    !!pushSubscriptionRecord;
  const showTestPushButton = loggedIn && pushStatus === "granted" && pushSubscribed;
  const canSendTestPush = showTestPushButton && hasConfirmedPushRegistration && typeof onSendTestPush === "function";
  const testPushDisabled = !canSendTestPush || testPushStatus === "sending";
  const testPushStatusGuide =
    pushSubscriptionCheckStatus === "checking"
      ? "등록 상태를 확인하는 중이에요."
      : !hasConfirmedPushRegistration
        ? "현재 기기 등록 확인 후 테스트 알림을 보낼 수 있어요."
        : "";
  const deviceStatusText =
    pushStatus === "granted" && pushSubscribed
      ? "현재 기기에서 즉시 알림을 받을 수 있어요"
      : pushStatus === "denied"
        ? "브라우저나 기기에서 알림이 차단되어 있어요"
        : pushStatus === "unsupported"
          ? "이 브라우저는 기기 알림을 지원하지 않아요"
          : pushStatus === "key_missing"
            ? "알림 설정을 불러오지 못했어요"
            : "현재 기기에서 알림을 켜주세요";
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">주간 기록 알림</div>
            <div className="mt-1 text-xs font-medium text-slate-600">매주 한 번 리마인드를 보내드려요.</div>
            <div className="mt-1 text-sm text-slate-500">매주 한 번, 이번 주 경험을 놓치지 않게 알려드려요.</div>
          </div>
          <button
            type="button"
            onClick={onToggleEnabled}
            disabled={!loggedIn}
            className={`relative flex-shrink-0 h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none ${reminderDraft.is_enabled ? "bg-slate-900" : "bg-slate-200"} ${!loggedIn ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            aria-checked={reminderDraft.is_enabled}
            role="switch"
          >
            <span className={`block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 absolute top-1 ${reminderDraft.is_enabled ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          정한 시간에 “이번 주 경험을 정리해볼까요?”라고 알려드려요.
        </div>
        <div className={`space-y-2 pt-2 border-t border-slate-100 ${!loggedIn ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-10 flex-shrink-0">요일</span>
            <div className="flex gap-1 flex-wrap">
              {DAY_LABELS.map((label, dayIdx) => (
                <button
                  key={dayIdx}
                  type="button"
                  onClick={() => onDayChange(dayIdx)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${reminderDraft.preferred_day_of_week === dayIdx ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 w-10 flex-shrink-0">시간</span>
            <input
              type="time"
              value={(reminderDraft.preferred_time_local || "18:00").slice(0, 5)}
              onChange={(e) => onTimeChange(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none"
            />
          </div>
        </div>
        {loggedIn && (
          <div className="pt-1 space-y-0.5 text-xs text-slate-400">
            <div>
              {reminderPref
                ? `현재 저장된 설정: ${fmtSchedule(reminderPref.preferred_day_of_week, reminderPref.preferred_time_local)}`
                : "현재 저장된 설정: 아직 저장된 일정이 없습니다."}
            </div>
            {reminderPref && reminderPref.is_enabled && (
              <div>{getNextReminderSummary(reminderPref)}</div>
            )}
            {(
              !reminderPref ||
              reminderPref.preferred_day_of_week !== reminderDraft.preferred_day_of_week ||
              (reminderPref.preferred_time_local || "").slice(0, 5) !== (reminderDraft.preferred_time_local || "").slice(0, 5) ||
              reminderPref.is_enabled !== reminderDraft.is_enabled
            ) && (
              <div>{`저장 전 선택: ${fmtSchedule(reminderDraft.preferred_day_of_week, reminderDraft.preferred_time_local)}`}</div>
            )}
            <div>주 1회 알림이며, 새 일정으로 저장하면 기존 일정이 바뀝니다.</div>
            <div>매주 선택한 요일/시간에 한 번 알림을 보냅니다.</div>
          </div>
        )}
        {loggedIn ? (
          <div className="flex items-center justify-end gap-2 pt-1">
            {reminderSaveStatus === "saved" && reminderSavedSnapshot && (
              <span className="text-xs text-emerald-600 font-medium">{`${reminderSavedSnapshot}로 저장됐어요`}</span>
            )}
            {reminderSaveStatus === "error" && (
              <span className="text-xs text-red-500">저장 실패. 다시 시도해 주세요.</span>
            )}
            <button
              type="button"
              onClick={onSave}
              disabled={reminderSaveStatus === "saving"}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${reminderSaveStatus === "saving" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-700"}`}
            >
              {reminderSaveStatus === "saving" ? "저장 중..." : "저장하기"}
            </button>
          </div>
        ) : (
          <div className="pt-1 text-xs text-slate-400">로그인 후 설정을 저장할 수 있습니다.</div>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-2">
        <div className="text-sm font-semibold text-slate-900">폰/디바이스 알림</div>
        <div className="text-sm text-slate-500">현재 브라우저와 기기에서 바로 확인할 수 있는 즉시 알림입니다.</div>
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          {deviceStatusText}
        </div>
        {pushStatus === "unsupported" && (
          <div className="text-xs text-slate-400">다른 브라우저나 기기에서 디바이스 알림을 켤 수 있습니다.</div>
        )}
        {pushStatus === "key_missing" && (
          <div className="space-y-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">
              운영 알림 키를 읽지 못해 현재 기기 알림을 시작할 수 없습니다. 최신 화면으로 다시 불러온 뒤 확인해 주세요.
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              기기 알림 상태 다시 확인
            </button>
          </div>
        )}
        {pushStatus === "denied" && (
          <div className="text-xs text-amber-600">브라우저나 기기 설정에서 알림을 허용한 후 다시 시도해 주세요.</div>
        )}
        {!loggedIn && pushStatus !== "unsupported" && pushStatus !== "key_missing" && (
          <div className="text-xs text-slate-400">로그인 후 이 기기를 등록할 수 있습니다.</div>
        )}
        {loggedIn && pushStatus === "granted" && pushSubscribed && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-emerald-600 font-medium">이 기기에서 알림을 받을 수 있어요</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSendTestPush}
                  disabled={testPushDisabled}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    testPushDisabled
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  {testPushStatus === "sending" ? "테스트 알림 보내는 중..." : "테스트 알림 보내기"}
                </button>
                <button
                  type="button"
                  onClick={onRevokePush}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:border-slate-400 transition"
                >
                  이 기기 알림 끄기
                </button>
              </div>
            </div>
            {(testPushStatusGuide || testPushMessage) && (
              <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center">
                {testPushStatusGuide && <span className="text-slate-400">{testPushStatusGuide}</span>}
                {testPushMessage && (
                  <span className={testPushStatus === "error" ? "text-red-500" : "text-emerald-600"}>
                    {testPushMessage}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        {loggedIn && (pushStatus === "idle" || pushStatus === "error" || (pushStatus === "granted" && !pushSubscribed)) && (
          <button
            type="button"
            onClick={onRequestPush}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 transition sm:w-auto sm:rounded-full sm:py-2"
          >
            이 기기에서 알림 켜기
          </button>
        )}
        {pushStatus === "loading" && (
          <span className="text-xs text-slate-400">연결 중...</span>
        )}
      </div>
      <SchedulerV2SummaryPreview
        loggedIn={loggedIn}
        reminderDraft={reminderDraft}
        rows={schedulerV2SummaryRows}
        status={schedulerV2SummaryStatus}
        error={schedulerV2SummaryError}
      />
      <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          자세한 알림 상태 보기
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase text-slate-400">현재 계정</div>
              <div className="mt-1 truncate text-xs font-medium text-slate-800">{accountSummary}</div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase text-slate-400">폰/디바이스 알림</div>
              <div className="mt-1 text-xs font-medium text-slate-800">{permissionSummary}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">Push subscription: {subscriptionSummary}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">마지막 등록: {lastRegisteredSummary}</div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            알림 시간 저장은 계정 설정이고, 디바이스 알림 허용은 현재 기기 설정입니다.
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
            PC, 모바일, iPhone은 각각 따로 알림을 켜야 합니다. iPhone은 Safari에서 PASSMAP을 홈 화면에 추가한 뒤 알림을 허용해야 할 수 있습니다.
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
            테스트 알림은 현재 기기가 알림을 받을 수 있는지 확인하는 용도입니다. 매일/평일/직접 설정 알림은 이후 지원 예정입니다.
          </div>
        </div>
      </details>
    </>
  );
}

export default function ReminderSettingsPanel({
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
  onToggleEnabled,
  onDayChange,
  onTimeChange,
  onSave,
  onRequestPush,
  onRevokePush,
  onSendTestPush,
  defaultExpanded = true,
}) {
  const [open, setOpen] = useState(defaultExpanded);

  const cardProps = {
    auth, reminderPref, reminderDraft, reminderSaveStatus, reminderSavedSnapshot,
    pushStatus, pushSubscribed, pushSubscriptionRecord, pushSubscriptionCheckStatus,
    testPushStatus, testPushMessage,
    schedulerV2SummaryRows, schedulerV2SummaryStatus, schedulerV2SummaryError,
    onToggleEnabled, onDayChange, onTimeChange, onSave, onRequestPush, onRevokePush, onSendTestPush,
  };

  if (defaultExpanded) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <ExpandedCards {...cardProps} />
      </div>
    );
  }

  const scheduleSummary = reminderPref
    ? `주간 기록 알림 · ${fmtSchedule(reminderPref.preferred_day_of_week, reminderPref.preferred_time_local)}`
    : "아직 저장된 일정이 없습니다";
  const nextSummary = getNextReminderSummary(reminderPref);
  const pushSummary = getPushSummary(pushStatus, pushSubscribed);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">알림 설정</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{scheduleSummary}</div>
          {nextSummary && <div className="mt-0.5 text-xs text-slate-400">{nextSummary}</div>}
          {pushSummary && <div className="mt-0.5 text-xs text-slate-400">{pushSummary}</div>}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 transition active:bg-slate-50"
        >
          {open ? "접기" : "알림 설정하기"}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
          <ExpandedCards {...cardProps} />
        </div>
      )}
    </div>
  );
}
