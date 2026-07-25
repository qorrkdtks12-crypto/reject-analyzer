import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getProjectActionStatusLabel } from "./projectActionAdapter.js";

const STATUS_OPTIONS = [
  { value: "planned", label: "계획" },
  { value: "in_progress", label: "진행 중" },
  { value: "completed", label: "완료" },
  { value: "needs_review", label: "확인 필요" },
];

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeDate(value) {
  return String(value || "").slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getRawPayload(record) {
  const raw = record?.rawPayload || record?.raw_payload;
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

function joinTags(value) {
  return Array.isArray(value) ? value.map((tag) => String(tag || "").trim()).filter(Boolean).join(", ") : "";
}

function splitTags(value) {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildForm(action) {
  const record = action?.record || {};
  const raw = getRawPayload(record);
  return {
    recordDate: firstNonEmpty(record.record_date, record.date, action?.date, action?.startDate),
    projectName: firstNonEmpty(action?.projectName, record.project_name, record.projectName, raw.projectName),
    title: firstNonEmpty(action?.title, record.title, raw.title, raw.projectActions),
    description: firstNonEmpty(record.description, record.summary, action?.summary, raw.description, raw.projectContext),
    task: firstNonEmpty(record.task, raw.task, raw.projectActions, action?.title),
    result: firstNonEmpty(action?.result, record.result, raw.result, raw.projectResult),
    startDate: firstNonEmpty(action?.startDate, raw.startDate, raw.start_date, record.startDate, record.record_date, record.date),
    endDate: firstNonEmpty(action?.endDate, raw.endDate, raw.end_date, record.endDate, raw.startDate, record.record_date, record.date),
    status: firstNonEmpty(raw.actionStatus, action?.status, "planned"),
    projectResult: firstNonEmpty(raw.projectResult, action?.result, record.result),
    projectInsight: firstNonEmpty(raw.projectInsight, raw.nextAction, raw.learning),
    projectGoal: firstNonEmpty(raw.projectGoal),
    projectContext: firstNonEmpty(raw.projectContext, action?.summary, record.description, record.summary),
    strengthTags: joinTags(record.strength_tags || record.strengthTags || raw.strengthTags || raw.roleTags),
    skillTags: joinTags(record.skill_tags || record.skillTags || raw.skillTags || raw.collaborationTags),
  };
}

function buildImprovePayload(action) {
  return {
    date: action?.date,
    recordId: action?.recordId,
    mode: "improve",
    source: "project-action-drawer",
    record: action?.record,
  };
}

function buildProgressPayload(action) {
  return {
    date: todayDate() || action?.date,
    recordId: action?.recordId,
    mode: "project-progress",
    source: "project-action-drawer",
    record: action?.record,
    projectName: action?.projectName,
    recordType: "teamProject",
    actionTitle: action?.title,
    actionId: action?.id,
    linkedAction: {
      recordId: action?.recordId,
      actionId: action?.id,
      projectName: action?.projectName,
      actionTitle: action?.title,
      startDate: action?.startDate,
      endDate: action?.endDate,
      status: action?.status,
    },
  };
}

function buildPatch(action, form) {
  const record = action?.record || {};
  const raw = getRawPayload(record);
  const projectActions = String(form.task || form.title || "").trim();
  const projectResult = String(form.projectResult || form.result || "").trim();
  const projectInsight = String(form.projectInsight || "").trim();
  const projectGoal = String(form.projectGoal || "").trim();
  const projectContext = String(form.projectContext || form.description || "").trim();

  return {
    record_date: normalizeDate(form.recordDate || form.startDate || action?.date),
    title: String(form.title || projectActions || "").trim(),
    description: String(form.description || projectContext || "").trim() || null,
    task: projectActions || null,
    result: String(form.result || projectResult || "").trim() || null,
    project_name: String(form.projectName || "").trim() || null,
    strength_tags: splitTags(form.strengthTags),
    skill_tags: splitTags(form.skillTags),
    raw_payload: {
      ...raw,
      startDate: normalizeDate(form.startDate),
      endDate: normalizeDate(form.endDate || form.startDate),
      projectName: String(form.projectName || "").trim(),
      projectActions,
      projectResult,
      projectInsight,
      projectGoal,
      projectContext,
      actionStatus: String(form.status || action?.status || "planned").trim(),
      mode: "project-action",
      track: "project",
    },
  };
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export default function CalendarProjectActionDrawer({
  action,
  onOpenRecordInput,
  onUpdateRecord,
  onDeleteRecord,
}) {
  const [form, setForm] = useState(() => buildForm(action));
  const [saveStatus, setSaveStatus] = useState("idle");
  const [deleteStatus, setDeleteStatus] = useState("idle");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  if (!action) return null;

  const record = action.record || null;
  const recordDate = firstNonEmpty(record?.record_date, record?.date, action.date);

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!record || typeof onUpdateRecord !== "function") return;
    setSaveStatus("saving");
    setFeedbackMessage("");
    try {
      await onUpdateRecord(record, buildPatch(action, form));
      setSaveStatus("saved");
      setFeedbackMessage("Action 수정 내용을 저장했습니다.");
    } catch {
      setSaveStatus("error");
      setFeedbackMessage("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  async function handleDelete() {
    if (!record || typeof onDeleteRecord !== "function") return;
    setDeleteStatus("deleting");
    setFeedbackMessage("");
    try {
      const deleted = await onDeleteRecord(record);
      if (deleted === false) {
        setDeleteStatus("idle");
        return;
      }
      setDeleteStatus("deleted");
      setFeedbackMessage("기록을 삭제했습니다.");
    } catch {
      setDeleteStatus("error");
      setFeedbackMessage("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <div className="rounded-[24px] border border-violet-200 bg-white shadow-lg shadow-violet-100/60 ring-1 ring-violet-100">
      <div className="border-b border-violet-100 bg-violet-50/70 px-4 py-4">
        <p className="text-lg font-semibold text-slate-950">Action 상세</p>
        <p className="mt-1 text-xs leading-relaxed text-violet-700">{form.projectName || "프로젝트 미지정"}</p>
      </div>

      <form className="space-y-3 px-4 py-4" onSubmit={handleSave}>
        {onOpenRecordInput ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
            <p className="text-sm font-semibold text-emerald-950">오늘 이 Action에서 한 일</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              짧게 남겨도 나중에 이력서·면접 재료로 정리할 수 있어요.
            </p>
            <Button type="button" size="sm" className="mt-3 h-8 rounded-full bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700" onClick={() => onOpenRecordInput(buildProgressPayload(action))}>
              오늘 한 일 기록하기
            </Button>
          </div>
        ) : null}
        <Field label="프로젝트명">
          <input value={form.projectName} onChange={(event) => updateField("projectName", event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </Field>
        <Field label="Action 제목">
          <input value={form.title} onChange={(event) => updateField("title", event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </Field>
        <Field label="한 일">
          <textarea value={form.task} onChange={(event) => updateField("task", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="시작일">
            <input type="date" value={normalizeDate(form.startDate)} onChange={(event) => updateField("startDate", event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400" />
          </Field>
          <Field label="종료일">
            <input type="date" value={normalizeDate(form.endDate)} onChange={(event) => updateField("endDate", event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-slate-400" />
          </Field>
        </div>
        <Field label="상태">
          <select value={form.status} onChange={(event) => updateField("status", event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-slate-400">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="결과/산출물">
          <textarea value={form.projectResult} onChange={(event) => {
            updateField("projectResult", event.target.value);
            updateField("result", event.target.value);
          }} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </Field>
        <Field label="다음 액션/학습">
          <textarea value={form.projectInsight} onChange={(event) => updateField("projectInsight", event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </Field>
        <Field label="기간 정리 메모">
          <textarea value={form.projectContext} onChange={(event) => {
            updateField("projectContext", event.target.value);
            updateField("description", event.target.value);
          }} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400" />
        </Field>
        <Field label="강점 태그">
          <input value={form.strengthTags} onChange={(event) => updateField("strengthTags", event.target.value)} placeholder="문제해결, 협업" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400" />
        </Field>
        <Field label="역량 태그">
          <input value={form.skillTags} onChange={(event) => updateField("skillTags", event.target.value)} placeholder="운영개선, 데이터정리" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400" />
        </Field>

        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <div>원본 기록 날짜: {recordDate || "미지정"}</div>
          <div>현재 상태: {getProjectActionStatusLabel(action.status)}</div>
        </div>

        {feedbackMessage ? (
          <p className={`text-xs ${saveStatus === "error" || deleteStatus === "error" ? "text-red-600" : "text-emerald-700"}`}>{feedbackMessage}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" className="h-8 rounded-full bg-slate-900 px-3 text-xs text-white hover:bg-slate-800" disabled={saveStatus === "saving"}>
            {saveStatus === "saving" ? "저장 중" : "이 Action 수정 저장하기"}
          </Button>
          {onOpenRecordInput ? (
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-full bg-white text-xs" onClick={() => onOpenRecordInput(buildImprovePayload(action))}>
              이 기록 보완하기
            </Button>
          ) : null}
          {onDeleteRecord ? (
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-full bg-white text-xs text-red-600 hover:text-red-700" onClick={handleDelete} disabled={deleteStatus === "deleting"}>
              {deleteStatus === "deleting" ? "삭제 중" : "기록 삭제하기"}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
