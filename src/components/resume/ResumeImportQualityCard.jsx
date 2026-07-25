import React from "react";
import { buildSaraminCandidateReviewModel } from "../../lib/resume/buildSaraminCandidateReviewModel.js";

const LEVEL_CLASS = {
  high: "border-emerald-200 bg-emerald-50 text-emerald-950",
  medium: "border-amber-200 bg-amber-50 text-amber-950",
  low: "border-orange-200 bg-orange-50 text-orange-950",
  failed: "border-red-200 bg-red-50 text-red-950",
};

function SaraminCandidateReviewPanel({ metadata }) {
  const model = buildSaraminCandidateReviewModel(metadata);
  if (!model) return null;

  const evidenceFlags = [
    ["자기소개서", model.hasCoverLetterEvidence],
    ["지원동기", model.hasMotivationEvidence],
    ["관련 경험", model.hasRelatedExperienceEvidence],
    ["입사 후 포부", model.hasPostHirePlanEvidence],
  ];

  return (
    <details className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700">
      <summary className="cursor-pointer font-semibold text-slate-900">후보 확인</summary>
      <div className="mt-3 space-y-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
          {model.notice}
        </div>

        <section>
          <div className="font-semibold text-slate-900">기본정보 후보</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {model.identityItems.length ? model.identityItems.map((item) => (
              <span key={item.label} className="rounded-full bg-slate-100 px-2 py-1">
                {item.label}: {item.value}
              </span>
            )) : (
              <span className="text-slate-500">감지된 기본정보 후보가 없습니다. 검수 필요</span>
            )}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-900">학력 후보 {model.educationCount}개</div>
            <ul className="mt-1 space-y-1">
              {model.educationItems.length ? model.educationItems.map((item) => (
                <li key={item}>- {item}</li>
              )) : <li className="text-slate-500">- 검수 필요</li>}
            </ul>
          </div>
          <div>
            <div className="font-semibold text-slate-900">경력 후보 {model.experienceCount}개</div>
            <ul className="mt-1 space-y-1">
              {model.experienceItems.length ? model.experienceItems.map((item) => (
                <li key={item}>- {item}</li>
              )) : <li className="text-slate-500">- 검수 필요</li>}
            </ul>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="font-semibold text-slate-900">자격증 후보 {model.certificateCount}개</div>
            <div className="mt-1 text-slate-600">검수 필요</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">스킬 후보</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {model.skillItems.length ? model.skillItems.map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-2 py-1">{item}</span>
              )) : <span className="text-slate-500">검수 필요</span>}
            </div>
          </div>
        </section>

        <section>
          <div className="font-semibold text-slate-900">
            자기소개서/지원문항 후보 {model.evidenceCount}개
          </div>
          <div className="mt-1 text-slate-600">{model.separationNotice}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evidenceFlags.map(([label, ok]) => (
              <span key={label} className="rounded-full bg-slate-100 px-2 py-1">
                {label}: {ok ? "분리 후보" : "검수 필요"}
              </span>
            ))}
          </div>
        </section>
      </div>
    </details>
  );
}

function compactList(items, limit = 4) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (list.length <= limit) return list;
  return [...list.slice(0, limit), `외 ${list.length - limit}개`];
}

export default function ResumeImportQualityCard({ meta, className = "" }) {
  const quality = meta?.extractionQuality;
  if (!quality) return <SaraminCandidateReviewPanel metadata={meta?.resumeImportMetadata} />;

  const sectionSummary = meta?.sectionSummary || {};
  const counts = sectionSummary.counts || {};
  const issues = Array.isArray(quality.detectedIssues) ? quality.detectedIssues : [];
  const detected = compactList(sectionSummary.detected || [], 5);
  const missing = compactList(sectionSummary.missing || [], 5);
  const levelClass = LEVEL_CLASS[quality.level] || LEVEL_CLASS.medium;

  return (
    <div className={`rounded-xl border px-3 py-3 text-xs ${levelClass} ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">
          가져오기 품질: {Number(quality.score || 0)}점 · {quality.statusLabel || "검토 필요"}
        </div>
        {meta?.name ? <div className="max-w-[180px] truncate opacity-70">{meta.name}</div> : null}
      </div>
      {quality.summary ? <div className="mt-1 opacity-80">{quality.summary}</div> : null}

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <div className="font-semibold">잘 읽힌 항목</div>
          <ul className="mt-1 space-y-1">
            {detected.length ? detected.map((item) => <li key={item}>- {item}</li>) : <li>- 감지된 주요 섹션이 적습니다.</li>}
            {counts.bulletLikeLines ? <li>- 경력/프로젝트 문장 {counts.bulletLikeLines}개</li> : null}
            {counts.dateRanges ? <li>- 기간 정보 {counts.dateRanges}개</li> : null}
            {counts.metricLines ? <li>- 성과 수치 후보 {counts.metricLines}개</li> : null}
          </ul>
        </div>
        <div>
          <div className="font-semibold">확인이 필요한 항목</div>
          <ul className="mt-1 space-y-1">
            {issues.length
              ? issues.slice(0, 4).map((item) => <li key={item.code}>- {item.message}</li>)
              : missing.length
                ? missing.map((item) => <li key={item}>- {item} 정보가 감지되지 않았습니다.</li>)
                : <li>- 큰 위험 신호가 감지되지 않았습니다.</li>}
          </ul>
        </div>
      </div>

      {issues[0]?.suggestion ? (
        <div className="mt-3 rounded-lg bg-white/50 px-2 py-2">
          <span className="font-semibold">추천 행동 </span>
          {issues[0].suggestion}
        </div>
      ) : null}
      <SaraminCandidateReviewPanel metadata={meta?.resumeImportMetadata} />
    </div>
  );
}
