import { getDateRecordStatus, getDateStatusClassName, getDateStatusLabel } from "./calendarRecordStatus.js";

const DEFAULT_WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const GENERIC_WORK_TYPES = new Set(["이번 주 기록", "개인 업무", "팀 프로젝트"]);

export default function CalendarGridView({
  weeks = [],
  entriesByDate = {},
  selectedDate = "",
  today = "",
  weekdayLabels = DEFAULT_WEEKDAY_LABELS,
  cardsByRecordId = {},
  selectedExperienceSignalKey = "all",
  selectedExperienceSignalLabel = "",
  shouldShowMonthEmptyNotice = false,
  monthEmptyNoticeText = "",
  monthSummary = null,
  calendarSummary = null,
  deriveExperienceSignalsFromRecords,
  recordsHaveExperienceSignal,
  getCalendarWorkTypeLabel,
  normalizeExperienceSignalLabel,
  onSelectDate,
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
        {weekdayLabels.map((label) => (
          <div key={label} className="px-1 py-0.5 text-center text-xs font-semibold text-slate-400 sm:px-2 sm:py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {weeks.map((week, weekIndex) => {
          return (
            <div key={`week_${weekIndex}`} className="relative">
              <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                {week.map((item) => {
                  const entry = entriesByDate[item.date];
                  const dayRecordsForSignals = entry?.records || [];
                  const isActive = item.date === selectedDate;
                  const recordCount = entry?.records?.length || 0;
                  const dateRecordStatus = getDateRecordStatus(dayRecordsForSignals, cardsByRecordId);
                  const isOutOfMonth = !item.inCurrentMonth;
                  const dateCellClass = isOutOfMonth
                    ? dateRecordStatus === "detailed"
                      ? "border-violet-100 bg-violet-50/50 text-slate-500"
                      : "border-slate-200 bg-slate-50/70 text-slate-400"
                    : dateRecordStatus === "detailed"
                      ? "border-violet-700 bg-violet-700 text-white shadow-sm"
                      : dateRecordStatus === "keyword"
                        ? "border-violet-200 bg-violet-50 text-violet-950"
                        : "border-slate-200 bg-white text-slate-900";
                  const statusBadgeClass = dateRecordStatus === "detailed"
                    ? isOutOfMonth
                      ? "border-violet-100 bg-white/60 text-violet-500"
                      : "border-white/30 bg-white/15 text-white"
                    : dateRecordStatus === "keyword"
                      ? getDateStatusClassName(dateRecordStatus)
                      : isActive
                        ? "border-slate-200 bg-white text-slate-500"
                        : "border-transparent bg-transparent px-0 text-slate-400";
                  const statusLabel = dateRecordStatus === "detailed"
                    ? "상세 기록"
                    : dateRecordStatus === "keyword"
                      ? "키워드 기록"
                      : "기록 전";
                  const maxCellChips = 2;
                  const experienceSignals = typeof deriveExperienceSignalsFromRecords === "function"
                    ? deriveExperienceSignalsFromRecords(dayRecordsForSignals, maxCellChips)
                    : [];
                  const visibleExperienceSignals = experienceSignals.slice(0, maxCellChips);
                  const matchesSelectedSignal = typeof recordsHaveExperienceSignal === "function"
                    ? recordsHaveExperienceSignal(dayRecordsForSignals, selectedExperienceSignalKey)
                    : true;
                  const isDimmedBySignal = selectedExperienceSignalKey !== "all" && !matchesSelectedSignal;
                  const primaryTask =
                    entry?.tasks?.[0] ||
                    entry?.records?.[0]?.title ||
                    entry?.records?.[0]?.summary ||
                    getCalendarWorkTypeLabel?.(entry?.records?.[0]?.workType) ||
                    getCalendarWorkTypeLabel?.(entry?.workTypes?.[0]) ||
                    "업무 기록";
                  const workTypes = entry?.workTypes || [];
                  const specificWorkTypes = workTypes.filter((type) => !GENERIC_WORK_TYPES.has(type));
                  const visibleWorkTypes = (specificWorkTypes.length ? specificWorkTypes : workTypes).slice(0, Math.max(0, maxCellChips - visibleExperienceSignals.length));
                  const extraChipCount = Math.max(0, experienceSignals.length - visibleExperienceSignals.length) + Math.max(0, workTypes.length - visibleWorkTypes.length);
                  const calendarDayStatusLabel = experienceSignals.length
                    ? `경험 신호: ${experienceSignals.join(", ")}`
                    : recordCount > 0
                      ? "보완하면 더 좋아요"
                      : "기록 전";
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
                      data-grid-day-card={item.date}
                      aria-label={calendarDayAriaLabel}
                      title={calendarDayAriaLabel}
                      onClick={() => onSelectDate?.(item.date)}
                      style={{ contain: "paint" }}
                      className={[
                        "relative isolate aspect-square min-h-[76px] min-w-0 cursor-pointer overflow-hidden rounded-2xl border px-2 pt-2 pb-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:min-h-[108px] sm:px-3 sm:pt-3 sm:pb-5",
                        isActive
                          ? "border-violet-500 ring-2 ring-violet-500/70"
                          : "",
                        dateCellClass,
                        !isActive && !isOutOfMonth ? "hover:border-violet-300 hover:bg-violet-50/80" : "",
                        !isActive && isOutOfMonth ? "hover:border-slate-300 hover:bg-slate-50" : "",
                        isDimmedBySignal ? "opacity-35" : "",
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-1">
                        <div className={`shrink-0 text-sm font-semibold ${dateRecordStatus === "detailed" && !isOutOfMonth ? "text-white" : isActive ? "text-violet-900" : ""}`}>
                          {item.day}
                        </div>
                        <div className="flex min-w-0 flex-wrap justify-end gap-1 overflow-hidden">
                          {isActive ? (
                            <span className="max-w-full truncate rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              선택됨
                            </span>
                          ) : null}
                          {experienceSignals.length > 0 ? (
                            <span className="max-w-full truncate rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                              신호 {experienceSignals.length}
                            </span>
                          ) : null}
                          {item.isToday || item.date === today ? (
                            <span className="max-w-full truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              오늘
                            </span>
                          ) : null}
                          <span className={[
                            "max-w-full truncate rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                            statusBadgeClass,
                          ].join(" ")}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {recordCount > 0 ? (
                        <p className={`mt-1.5 min-w-0 truncate text-[11px] font-medium leading-tight ${dateRecordStatus === "detailed" && !isOutOfMonth ? "text-violet-50" : "text-slate-600"}`}>
                          {primaryTask}
                        </p>
                      ) : null}

                      <div className="mt-2 grid min-w-0 max-w-full gap-1 overflow-hidden">
                        {visibleExperienceSignals.map((signal) => (
                          <span
                            key={`${item.date}_${signal}`}
                            data-grid-record-chip
                            className="block w-full max-w-full min-w-0 truncate rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700"
                          >
                            {signal}
                          </span>
                        ))}
                        {visibleWorkTypes.map((type) => {
                          const displayType = normalizeExperienceSignalLabel?.(getCalendarWorkTypeLabel?.(type)) || type;
                          return (
                            <span
                              key={`${item.date}_${type}`}
                              data-grid-record-chip
                              className="block w-full max-w-full min-w-0 truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                            >
                              {displayType}
                            </span>
                          );
                        })}
                        {extraChipCount > 0 ? (
                          <span
                            data-grid-record-chip
                            className="block w-full max-w-full min-w-0 truncate rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                          >
                            +{extraChipCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {shouldShowMonthEmptyNotice ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
          {monthEmptyNoticeText}
        </div>
      ) : null}

      <div className="grid gap-3">
        {monthSummary ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <div className="text-xs font-semibold text-slate-500">월간 기록률</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{monthSummary.recordRate}%</div>
              <div className="mt-1 text-xs text-slate-500">
                {monthSummary.recordedDateCount}/{monthSummary.totalDateCount}일 기록
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700">
              <div className="text-xs font-semibold text-slate-500">면접/이력서로 발전 가능</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{monthSummary.detailedDateCount}일</div>
              <div className="mt-1 text-xs text-slate-500">
                보완하면 더 좋아요 {monthSummary.keywordDateCount}일
              </div>
            </div>
          </div>
        ) : null}
        {calendarSummary?.weeklySummary ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            {calendarSummary.weeklySummary}
          </div>
        ) : null}
        {calendarSummary?.todaySummary ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            {calendarSummary.todaySummary}
          </div>
        ) : null}
      </div>
    </>
  );
}
