import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { COMMON_RECORD_TAXONOMY } from "@/data/workRecord/commonRecordTaxonomy.js";
import { normalizePmMvpCustomTag } from "@/lib/adapters/normalizePmMvpCustomTag.js";
import { buildWorkRecordAiExamplesPrompt } from "@/lib/resume/buildWorkRecordAiExamplesPrompt.js";

const PROJECT_RESULT_CHIP_OPTIONS = [
  "시간이 줄었어요",
  "반복 업무가 줄었어요",
  "실수가 줄었어요",
  "기준이 생겼어요",
  "협업이 쉬워졌어요",
  "반응이 좋아졌어요",
  "아직 진행 중이에요",
  "잘 모르겠어요",
];

const TRACK_UI_COPY = {
  weekly: {
    title: "이번 주 기록하기",
    description: "이번 주에 처리한 일과 기억할 만한 변화를 짧게 남기면, 이력서에 쓸 수 있는 경험 문장으로 정리됩니다.",
    textLabel: "이번 주에 한 일을 짧게 적어주세요",
    submitLabel: "이번 주 기록 정리하기",
    sampleLabel: "이번 주 샘플 불러오기",
  },
  project: {
    title: "프로젝트 기록하기",
    description: "프로젝트명과 한 줄 메모만 남겨도 됩니다. 나머지는 선택하거나 나중에 자세히 추가해도 괜찮습니다.",
    textLabel: "프로젝트 핵심 내용을 정리해주세요",
    submitLabel: "프로젝트 기록 정리하기",
    sampleLabel: "프로젝트 샘플 불러오기",
  },
};

const EMPTY_SAMPLE_RECORD = {
  text: "",
  roleTags: [],
  collaborationTags: [],
  resultTags: [],
};

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDateKey(dateKey, offsetDays) {
  const base = String(dateKey || todayDateKey()).slice(0, 10);
  const date = new Date(`${base}T00:00:00`);
  if (Number.isNaN(date.getTime())) return todayDateKey();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function formatKoreanDate(dateKey) {
  const [year, month, day] = String(dateKey || "").split("-");
  if (!year || !month || !day) return "날짜를 선택해 주세요";
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일`;
}

function toTagList(value) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function buildImprovementText(context) {
  const record = context?.record || {};
  const raw = record?.rawPayload || record?.raw_payload || {};
  const lines = [
    firstNonEmpty(record.title, raw.title) && `원래 기록: ${firstNonEmpty(record.title, raw.title)}`,
    firstNonEmpty(record.summary, record.description, raw.description, raw.text) && `메모: ${firstNonEmpty(record.summary, record.description, raw.description, raw.text)}`,
    firstNonEmpty(record.task, raw.task, raw.projectActions) && `한 일: ${firstNonEmpty(record.task, raw.task, raw.projectActions)}`,
    firstNonEmpty(record.result, raw.result, raw.projectResult, record.reflectedSentence) && `결과: ${firstNonEmpty(record.result, raw.result, raw.projectResult, record.reflectedSentence)}`,
  ].filter(Boolean);
  return lines.length ? `${lines.join("\n")}\n\n보완할 내용:\n` : "";
}

function getProjectActionStatusFromDates(startDate, endDate) {
  const today = new Date().toISOString().slice(0, 10);
  const start = String(startDate || "").slice(0, 10);
  const end = String(endDate || start || "").slice(0, 10);
  if (start && start > today) return "planned";
  if (start && end && start <= today && today <= end) return "in_progress";
  if (end && end < today) return "completed";
  return "unknown";
}

function buildGoogleCalendarCandidateText(candidate) {
  if (!candidate) return "";
  const period = [firstNonEmpty(candidate.startTime), firstNonEmpty(candidate.endTime)]
    .filter(Boolean)
    .join(" ~ ");
  return [
    firstNonEmpty(candidate.title),
    firstNonEmpty(candidate.description),
    period && `Calendar: ${period}`,
    firstNonEmpty(candidate.location) && `Location: ${firstNonEmpty(candidate.location)}`,
  ].filter(Boolean).join("\n");
}

function compactRecommendedAction(action) {
  if (!action || typeof action !== "object") return null;
  return {
    id: firstNonEmpty(action.id),
    title: firstNonEmpty(action.title),
    description: firstNonEmpty(action.description),
    targetType: firstNonEmpty(action.targetType),
    priority: firstNonEmpty(action.priority),
  };
}

function compactGoogleCalendarCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  return {
    externalEventId: firstNonEmpty(candidate.externalEventId),
    title: firstNonEmpty(candidate.title).slice(0, 160),
    description: firstNonEmpty(candidate.description).slice(0, 280),
    startTime: firstNonEmpty(candidate.startTime),
    endTime: firstNonEmpty(candidate.endTime),
    date: firstNonEmpty(candidate.date),
    location: firstNonEmpty(candidate.location).slice(0, 120),
    attendeeCount: Number.isFinite(Number(candidate.attendeeCount)) ? Number(candidate.attendeeCount) : 0,
    status: "converted",
  };
}

const EMPTY_RECORD_PRESET = {
  workTypeExtensions: [],
  collaborationExtensions: [],
  followUpExtensions: [],
  placeholders: {
    weekly: "예) 채용 공고 업로드를 정리하고, 문의가 반복되는 항목을 FAQ 형태로 묶었습니다.",
    project: {
      projectName: {
        personal: "예) 채용 공고 업로드 정리",
        teamProject: "예) 패스맵 경험 정리하기 화면 UI 문구 개선",
      },
      projectPeriod: "예) 2026년 3월~4월, 3주, 약 1개월",
      projectGoal: "예) 사용자가 기록한 경험이 이력서로 이어지는 흐름을 더 쉽게 이해하도록 화면 구조와 문구를 개선합니다.",
      projectContext: {
        personal: "예) 같은 질문이 반복됐지만 답변 기준이 정리되어 있지 않았습니다.",
        teamProject: "예) 사용자 피드백을 바탕으로 개선 방향을 정리하고, 화면 문구와 입력 구조를 기획했습니다.",
      },
      projectActions: {
        personal: "예) 채용 공고 내용을 정리해 업로드하고, 누락된 정보를 확인했습니다.",
        teamProject: "예) 경험 정리하기 화면의 버튼명, 태그 표현, 프로젝트 기록 입력 방식을 개선했습니다.",
      },
      projectInsight: "예) 팀 업무와 개인 업무를 나누는 방식이 더 직관적인지 추가 확인이 필요합니다.",
      projectResult: "예) 기록 → 정리 → 이력서 연결 흐름이 더 명확해졌습니다.",
    },
  },
  sampleRecords: {
    weekly: EMPTY_SAMPLE_RECORD,
    project: {
      recordType: "teamProject",
      projectName: "패스맵 경험 정리하기 화면 UI 문구 개선",
      projectPeriod: "2026년 4월",
      projectGoal: "사용자가 기록한 경험이 이력서로 이어지는 흐름을 더 쉽게 이해하도록 화면 구조와 문구를 개선합니다.",
      projectContext: "사용자 피드백을 바탕으로 개선 방향을 정리하고, 화면 문구와 입력 구조를 기획했습니다.",
      projectActions: "경험 정리하기 화면의 버튼명, 태그 표현, 프로젝트 기록 입력 방식을 개선했습니다.",
      projectResult: "기록 → 정리 → 이력서 연결 흐름이 더 명확해졌습니다.",
      projectInsight: "팀 업무와 개인 업무를 나누는 방식이 더 직관적인지 추가 확인이 필요합니다.",
      roleTags: [],
      collaborationTags: [],
      resultTags: [],
    },
  },
};

const WORK_RECALL_GUIDE_PRIORITY_PHRASES = [
  {
    key: "NEGOTIATE_OR_CONTRACT",
    phrases: [
      "계약 협의",
      "계약 조건 협의",
      "제안 조건 협의",
      "계약 조건 검토",
      "계약 협상",
      "견적 비교",
      "견적 검토",
      "조건 협의",
      "수익배분 협의",
      "비용 조건 협의",
    ],
  },
  {
    key: "SOLVE_OR_FIX",
    phrases: [
      "오류 수정",
      "화면 오류 수정",
      "ci/cd 오류 수정",
      "버그 수정",
      "버그 재현",
      "오류 재현",
      "결함 재현",
      "장애 대응",
      "이슈 대응",
      "문제 해결",
      "에러 수정",
      "납기 이슈 대응",
    ],
  },
  {
    key: "RESEARCH_OR_DISCOVER",
    phrases: [
      "파트너십 발굴",
      "제휴사 발굴",
      "시장 기회",
      "기회 발굴",
      "경쟁 제품 비교",
      "경쟁사 비교",
      "공급사 비교",
      "시장 파악",
      "고객 니즈 파악",
      "벤치마킹",
      "자료 수집",
    ],
  },
  {
    key: "DOCUMENT_OR_PROPOSE",
    phrases: [
      "요구사항 정리",
      "기능 요구사항 정리",
      "회의 자료 준비",
      "자료 준비",
      "데모 준비",
      "브랜드 메시지 정리",
      "메시지 정리",
      "정책 문구 정리",
      "문구 정리",
      "운영 가이드 정리",
      "가이드 정리",
    ],
  },
  {
    key: "BUILD_OR_CREATE",
    phrases: [
      "api 연동",
      "외부 서비스 연동",
      "데이터 연동",
      "결제 연동",
      "로그인 연동",
      "기능 구현",
      "서버 로직 구현",
      "앱 화면 구현",
    ],
  },
  {
    key: "IMPROVE_OR_OPTIMIZE",
    phrases: [
      "피드백 반영",
      "고객 피드백 반영",
      "사용자 피드백 반영",
      "교육 피드백 정리",
      "개선안 반영",
      "수정사항 반영",
    ],
  },
  {
    key: "REVIEW_OR_QA",
    phrases: [
      "가설 검증",
      "기능 검증",
      "테스트 수행",
      "테스트 케이스 확인",
      "품질 검증",
      "결함 확인",
    ],
  },
];

const WORK_RECALL_GUIDE_KEYWORDS = [
  { key: "BUILD_OR_CREATE", keywords: ["추가", "개발", "제작", "구축", "생성", "구현", "설계"] },
  { key: "IMPROVE_OR_OPTIMIZE", keywords: ["개선", "수정", "고도화", "최적화", "개편", "보완"] },
  { key: "SOLVE_OR_FIX", keywords: ["문제", "오류", "버그", "장애", "해결", "이슈"] },
  { key: "ANALYZE_OR_REPORT", keywords: ["분석", "리포트", "지표", "데이터", "인사이트", "성과"] },
  { key: "RESEARCH_OR_DISCOVER", keywords: ["조사", "리서치", "시장", "경쟁사", "기회", "발굴", "벤치마킹"] },
  { key: "DOCUMENT_OR_PROPOSE", keywords: ["문서", "제안서", "기획서", "보고서", "작성"] },
  { key: "ALIGN_OR_COORDINATE", keywords: ["미팅", "협의", "조율", "커뮤니케이션", "공유", "내부 협업"] },
  { key: "NEGOTIATE_OR_CONTRACT", keywords: ["계약", "조건", "견적", "협상", "협약"] },
  { key: "OPERATE_OR_MANAGE", keywords: ["운영", "관리", "모니터링", "일정", "파이프라인"] },
  { key: "SUPPORT_OR_HANDLE_CUSTOMER", keywords: ["고객", "사용자", "문의", "클레임", "응대"] },
  { key: "REVIEW_OR_QA", keywords: ["검토", "검수", "QA", "품질", "확인", "검증", "테스트"] },
  { key: "PLAN_OR_STRATEGIZE", keywords: ["전략", "계획", "로드맵", "방향", "우선순위"] },
];

const WORK_RECALL_GUIDES = {
  BUILD_OR_CREATE: {
    title: "대충 적어도 됩니다",
    example: "예: 로그인 없이 상담 신청 가능하게 함",
    questions: ["무엇을 새로 만들었나요?", "누구를 위해 필요했나요?", "추가 후 무엇이 가능해졌나요?"],
    placeholder: "예: 로그인 없이 상담 신청 가능하게 함",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["기능 추가", "화면 구현", "API 연동", "자동화", "데이터 연결"] },
      { label: "왜 했나요?", options: ["사용자 편의", "업무 효율", "누락 방지", "신규 흐름 지원"] },
      { label: "뭐가 달라졌나요?", options: ["사용이 쉬워짐", "처리 시간이 줄어듦", "흐름이 연결됨", "반복 작업이 줄어듦"] },
    ],
  },
  IMPROVE_OR_OPTIMIZE: {
    title: "대충 적어도 됩니다",
    example: "예: 신청 화면 문구와 버튼 순서 개선",
    questions: ["무엇을 바꿨나요?", "바꾸기 전 불편은 무엇이었나요?", "바꾼 뒤 뭐가 나아졌나요?"],
    placeholder: "예: 신청 화면 문구와 버튼 순서 개선",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["UI 개선", "문구 수정", "속도 개선", "프로세스 보완", "기준 정리"] },
      { label: "왜 했나요?", options: ["사용자 혼선 감소", "업무 효율 개선", "반복 오류 예방", "전환율 개선"] },
      { label: "뭐가 달라졌나요?", options: ["사용성이 좋아짐", "처리가 빨라짐", "혼선이 줄어듦", "기준이 명확해짐"] },
    ],
  },
  SOLVE_OR_FIX: {
    title: "대충 적어도 됩니다",
    example: "예: 결제 오류 반복 구간 확인 후 대응 기준 정리",
    questions: ["어떤 문제가 있었나요?", "어디를 고쳤나요?", "해결 후 뭐가 나아졌나요?"],
    placeholder: "예: 결제 오류 반복 구간 확인 후 대응 기준 정리",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["오류 수정", "버그 재현", "이슈 대응", "장애 원인 확인", "예외 처리"] },
      { label: "왜 했나요?", options: ["반복 오류 방지", "사용자 불편 해소", "운영 리스크 감소", "납기 이슈 대응"] },
      { label: "뭐가 달라졌나요?", options: ["문제가 재현됨", "원인이 확인됨", "오류가 줄어듦", "대응 기준이 생김"] },
    ],
  },
  ANALYZE_OR_REPORT: {
    title: "대충 적어도 됩니다",
    example: "예: 전환율 하락 구간 분석 후 개선 우선순위 정리",
    questions: ["무엇을 분석했나요?", "어떤 숫자나 근거를 봤나요?", "그래서 어떤 판단을 했나요?"],
    placeholder: "예: 전환율 하락 구간 분석 후 개선 우선순위 정리",
  },
  RESEARCH_OR_DISCOVER: {
    title: "대충 적어도 됩니다",
    example: "예: 경쟁사 가격 정책 조사 후 신규 패키지 기회 정리",
    questions: ["무엇을 찾아봤나요?", "어떤 차이나 기회를 봤나요?", "다음에 뭘 해보면 좋을까요?"],
    placeholder: "예: 경쟁사 가격 정책 조사 후 신규 패키지 기회 정리",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["시장 조사", "경쟁사 비교", "자료 수집", "고객 니즈 파악", "기회 발굴"] },
      { label: "왜 했나요?", options: ["신규 기회 확인", "의사결정 근거 확보", "방향성 검토", "리스크 파악"] },
      { label: "뭐가 달라졌나요?", options: ["비교 기준이 생김", "기회가 정리됨", "다음 액션이 보임", "판단 근거가 생김"] },
    ],
  },
  DOCUMENT_OR_PROPOSE: {
    title: "대충 적어도 됩니다",
    example: "예: 반복 문의 대응 기준 문서화",
    questions: ["무엇을 정리했나요?", "누가 보기 위한 자료였나요?", "정리 후 뭐가 쉬워졌나요?"],
    placeholder: "예: 반복 문의 대응 기준 문서화",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["제안서", "회의자료", "요구사항", "가이드", "보고서"] },
      { label: "왜 했나요?", options: ["외부 공유", "내부 정리", "의사결정", "협업 조율", "업무 기준 정리"] },
      { label: "뭐가 달라졌나요?", options: ["논의가 쉬워짐", "기준이 명확해짐", "다음 액션이 정해짐", "반복 문의가 줄어듦"] },
    ],
  },
  ALIGN_OR_COORDINATE: {
    title: "대충 적어도 됩니다",
    example: "예: 디자인팀·개발팀 배포 범위 조율",
    questions: ["누구와 무엇을 조율했나요?", "어떤 이슈가 있었나요?", "최종적으로 무엇이 정해졌나요?"],
    placeholder: "예: 디자인팀·개발팀 배포 범위 조율",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["미팅 준비", "내부 협업 조율", "일정 조율", "의견 공유", "배포 범위 정리"] },
      { label: "왜 했나요?", options: ["의견 차이 조율", "일정 확정", "역할 분담", "진행 상황 공유"] },
      { label: "뭐가 달라졌나요?", options: ["논의가 정리됨", "담당자가 정해짐", "일정이 맞춰짐", "다음 액션이 정해짐"] },
    ],
  },
  NEGOTIATE_OR_CONTRACT: {
    title: "대충 적어도 됩니다",
    example: "예: 외부 파트너 견적 조건 비교 및 계약 범위 정리",
    questions: ["누구와 무엇을 협의했나요?", "쟁점은 무엇이었나요?", "다음 단계는 무엇인가요?"],
    placeholder: "예: 외부 파트너 견적 조건 비교 및 계약 범위 정리",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["계약 협의", "견적 비교", "조건 정리", "비용 검토", "파트너 논의"] },
      { label: "왜 했나요?", options: ["계약 범위 확정", "비용 조건 확인", "리스크 점검", "다음 협상 준비"] },
      { label: "뭐가 달라졌나요?", options: ["쟁점이 정리됨", "조건이 좁혀짐", "다음 단계가 정해짐", "비교 기준이 생김"] },
    ],
  },
  OPERATE_OR_MANAGE: {
    title: "대충 적어도 됩니다",
    example: "예: 주간 운영 일정 점검 후 누락 업무 재배정",
    questions: ["무엇을 운영하거나 관리했나요?", "어디를 점검했나요?", "어떤 후속 조치를 했나요?"],
    placeholder: "예: 주간 운영 일정 점검 후 누락 업무 재배정",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["운영 일정 점검", "진행 현황 관리", "파이프라인 점검", "공지 운영", "누락 확인"] },
      { label: "왜 했나요?", options: ["일정 지연 방지", "업무 누락 예방", "상태 공유", "운영 기준 유지"] },
      { label: "뭐가 달라졌나요?", options: ["누락을 줄임", "진행 상태가 보임", "담당자가 정해짐", "운영 기준이 유지됨"] },
    ],
  },
  SUPPORT_OR_HANDLE_CUSTOMER: {
    title: "대충 적어도 됩니다",
    example: "예: 고객 문의 유형 분류 및 답변 기준 정리",
    questions: ["누구의 요청을 처리했나요?", "자주 나온 내용은 무엇이었나요?", "어떻게 응대했나요?"],
    placeholder: "예: 고객 문의 유형 분류 및 답변 기준 정리",
  },
  REVIEW_OR_QA: {
    title: "대충 적어도 됩니다",
    example: "예: 배포 전 화면 문구와 주요 기능 검수",
    questions: ["무엇을 확인했나요?", "어떤 기준으로 봤나요?", "발견한 문제는 어떻게 처리했나요?"],
    placeholder: "예: 배포 전 화면 문구와 주요 기능 검수",
  },
  PLAN_OR_STRATEGIZE: {
    title: "대충 적어도 됩니다",
    example: "예: 다음 분기 로드맵 우선순위와 실행 순서 정리",
    questions: ["어떤 방향을 잡았나요?", "우선순위 기준은 무엇이었나요?", "다음 실행은 무엇인가요?"],
    placeholder: "예: 다음 분기 로드맵 우선순위와 실행 순서 정리",
  },
  GENERIC: {
    title: "대충 적어도 됩니다",
    example: "예: 이번 주에 맡은 일과 다음 액션 정리",
    questions: ["무엇을 했나요?", "왜 필요했나요?", "다음에 뭘 이어가면 되나요?"],
    placeholder: "예: 이번 주에 맡은 일과 다음 액션 정리",
    quickDraftChips: [
      { label: "무엇을 했나요?", options: ["자료 정리", "회의 준비", "이슈 대응", "내용 확인", "후속 액션 정리"] },
      { label: "왜 했나요?", options: ["업무 기준 정리", "협업 준비", "문제 예방", "다음 단계 진행"] },
      { label: "뭐가 달라졌나요?", options: ["해야 할 일이 명확해짐", "논의가 쉬워짐", "누락을 줄임"] },
    ],
  },
};

function inferWorkRecallGuideKey(label) {
  const source = String(label || "").trim().toLowerCase();
  if (!source) return "GENERIC";
  const phraseMatched = WORK_RECALL_GUIDE_PRIORITY_PHRASES.find(({ phrases }) =>
    phrases.some((phrase) => source.includes(String(phrase).toLowerCase())),
  );
  if (phraseMatched) return phraseMatched.key;
  const matched = WORK_RECALL_GUIDE_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) => source.includes(String(keyword).toLowerCase())),
  );
  return matched?.key || "GENERIC";
}

function deriveWorkRecallGuide(roleTags = []) {
  if (!Array.isArray(roleTags) || roleTags.length === 0) return null;
  const selectedLabel = String(roleTags[roleTags.length - 1] || "").trim();
  if (!selectedLabel) return null;
  const guideKey = inferWorkRecallGuideKey(selectedLabel);
  return {
    key: guideKey,
    sourceLabel: selectedLabel,
    ...(WORK_RECALL_GUIDES[guideKey] || WORK_RECALL_GUIDES.GENERIC),
  };
}

function ensureSentenceEnding(sentence) {
  const trimmed = String(sentence || "").trim();
  if (!trimmed) return "";
  return /[.!?。？！]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function resolveOpenAiProxyUrl() {
  const toProxy = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      if (url.pathname.endsWith("/api/openai-proxy")) return url.toString();
      if (url.pathname.startsWith("/api/")) return `${url.origin}/api/openai-proxy`;
      return `${url.origin}${url.pathname.replace(/\/$/, "")}/api/openai-proxy`;
    } catch { return ""; }
  };
  const explicit = String(import.meta.env.VITE_AI_PROXY_URL || "").trim();
  const resume = String(import.meta.env.VITE_RESUME_GENERATE_URL || "").trim();
  return toProxy(explicit) || toProxy(resume) || "/api/openai-proxy";
}

function buildQuickDraftText(option, groupLabel) {
  const cleanOption = String(option || "").trim();
  const cleanGroupLabel = String(groupLabel || "").trim();
  if (!cleanOption) return "";
  if (cleanGroupLabel.includes("왜")) {
    return ensureSentenceEnding(`${cleanOption} 목적의 작업이었습니다`);
  }
  if (cleanGroupLabel.includes("달라")) {
    return ensureSentenceEnding(`이후 ${cleanOption}`);
  }
  return ensureSentenceEnding(`${cleanOption} 작업을 진행했습니다`);
}

function appendQuickDraftChipToText(currentText, option, groupLabel) {
  const current = String(currentText || "").trim();
  const cleanOption = String(option || "").trim();
  const draft = buildQuickDraftText(cleanOption, groupLabel);
  if (!draft) return currentText || "";
  if (current.includes(cleanOption) || current.includes(draft)) return currentText || "";
  if (!current) return draft;
  return `${ensureSentenceEnding(current)} ${draft}`;
}

function toggleItem(items, item) {
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

function removeItem(items, item) {
  return items.filter((value) => value !== item);
}

function createTagOptions(items = []) {
  return [...new Set(items.map((item) => String(item || "").trim()).filter(Boolean))];
}

function appendTagOption(items, item) {
  return createTagOptions([...items, item]);
}

function mapLabels(items = []) {
  return items.map((item) => item?.label).filter(Boolean);
}

function TagChip({ tag, selected, onToggle, onRemove }) {
  return (
    <div
      className={[
        "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[14px] font-medium transition-colors",
        selected ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600",
      ].join(" ")}
    >
      <button type="button" onClick={() => onToggle(tag)} className="leading-none">
        {tag}
      </button>
      <button
        type="button"
        onClick={() => onRemove(tag)}
        className={[
          "leading-none text-[13px]",
          selected ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-slate-600",
        ].join(" ")}
        aria-label={`${tag} 제거`}
      >
        ×
      </button>
    </div>
  );
}

function TagEditorSection({
  label,
  options,
  inputValue,
  selected,
  addLabel,
  placeholder,
  onToggle,
  onInputChange,
  onAdd,
  onRemove,
  defaultCollapsed = false,
}) {
  const [expanded, setExpanded] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);
  const previewLimit = 7;
  const visibleOptions = expanded ? options : options.slice(0, previewLimit);
  const hiddenCount = Math.max(options.length - visibleOptions.length, 0);

  const toggleLabel = sectionOpen
    ? "접기"
    : selected.length > 0
    ? `${selected.length}개 선택 · 펼치기`
    : "펼치기";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-base font-semibold text-slate-700">{label}</div>
        {defaultCollapsed ? (
          <button
            type="button"
            onClick={() => setSectionOpen((o) => !o)}
            className="text-[14px] font-medium text-violet-600 transition-colors hover:text-violet-800"
          >
            {toggleLabel}
          </button>
        ) : (
          (hiddenCount > 0 || expanded) ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="text-[14px] font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              {expanded ? "접기" : `+${hiddenCount} 더보기`}
            </button>
          ) : null
        )}
      </div>

      {defaultCollapsed && !sectionOpen ? (
        selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-violet-100 px-2 py-0.5 text-[14px] font-medium text-violet-700">
                {tag}
              </span>
            ))}
            {selected.length > 3 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[14px] text-slate-500">
                +{selected.length - 3}
              </span>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-slate-400">아직 선택 없음</p>
        )
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {visibleOptions.map((tag) => (
              <TagChip
                key={tag}
                tag={tag}
                selected={selected.includes(tag)}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            ))}
          </div>
          {defaultCollapsed && (hiddenCount > 0 || expanded) ? (
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="mt-1.5 text-[14px] font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              {expanded ? "접기" : `+${hiddenCount} 더보기`}
            </button>
          ) : null}
          <div className="mt-2.5 flex flex-wrap gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={placeholder}
              className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-[14px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
            />
            <Button type="button" variant="outline" size="sm" className="h-10 shrink-0 px-3" onClick={onAdd}>
              {addLabel}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const QUICK_PERIOD_LABELS = ["이번 주", "지난주", "이번 달"];

const RECORD_TYPE_OPTIONS = [
  {
    value: "personal",
    label: "개인 업무",
    description: "혼자 처리한 업무, 반복 업무, 간단한 개선 사항을 가볍게 남깁니다.",
  },
  {
    value: "teamProject",
    label: "팀/프로젝트 업무",
    description: "팀 목표 안에서 내가 맡은 역할과 기여를 남깁니다.",
  },
];

export default function PmRecordInput({
  track = "weekly",
  onSubmit,
  isLoading = false,
  recordPreset = EMPTY_RECORD_PRESET,
  collapseStructuredSections = false,
  onOpenResumeView = null,
  canGenerateAiResumeDraft = false,
  onDraftChange = null,
  aiButtonLabel = null,
  aiDescriptionText = null,
  currentJobId = "",
  currentCareerRoleLabel = "",
  initialRecordContext = null,
}) {
  const normalizedTrack = track === "project" ? "project" : "weekly";
  const isProjectTrack = normalizedTrack === "project";
  const isImproveMode = initialRecordContext?.mode === "improve";
  const isProjectActionMode = initialRecordContext?.mode === "project-action";
  const isProjectProgressMode = initialRecordContext?.mode === "project-progress";
  const isRecommendationActionMode = isProjectActionMode && initialRecordContext?.source === "calendar-recommendation";
  const googleCalendarCandidate = initialRecordContext?.googleCalendarCandidate || null;
  const isGoogleCalendarCandidateMode = initialRecordContext?.source === "google-calendar-candidate";
  const isCalendarEventExperienceMode = initialRecordContext?.mode === "calendar-event-experience";
  const copy = TRACK_UI_COPY[normalizedTrack] || TRACK_UI_COPY.weekly;
  const placeholder = isProjectTrack ? "" : (recordPreset.placeholders?.[normalizedTrack] || "");
  const projectPlaceholders = isProjectTrack
    ? (recordPreset.placeholders?.project || EMPTY_RECORD_PRESET.placeholders.project)
    : EMPTY_RECORD_PRESET.placeholders.project;
  const sampleRecord = recordPreset.sampleRecords?.[normalizedTrack] ||
    (isProjectTrack ? EMPTY_RECORD_PRESET.sampleRecords.project : EMPTY_SAMPLE_RECORD);
  const trackPresetOptions = useMemo(
    () => createTagOptions(recordPreset.trackWorkTypePresets?.[normalizedTrack]),
    [normalizedTrack, recordPreset],
  );
  const coreWorkOptions = useMemo(
    () => createTagOptions(mapLabels(recordPreset.workTypeExtensions)),
    [recordPreset],
  );

  const workBaseOptions = useMemo(
    () => createTagOptions([...trackPresetOptions, ...coreWorkOptions]),
    [trackPresetOptions, coreWorkOptions],
  );
  const contextBaseOptions = useMemo(
    () =>
      createTagOptions(
        recordPreset.collaborationExtensions?.length > 0
          ? mapLabels(recordPreset.collaborationExtensions)
          : mapLabels(COMMON_RECORD_TAXONOMY.collaborationContext),
      ),
    [recordPreset],
  );
  const resultBaseOptions = useMemo(
    () =>
      createTagOptions(
        recordPreset.followUpExtensions?.length > 0
          ? mapLabels(recordPreset.followUpExtensions)
          : mapLabels(COMMON_RECORD_TAXONOMY.followUpResult),
      ),
    [recordPreset],
  );

  const [text, setText] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectPeriod, setProjectPeriod] = useState("");
  const [projectGoal, setProjectGoal] = useState("");
  const [projectContext, setProjectContext] = useState("");
  const [projectActions, setProjectActions] = useState("");
  const [projectResult, setProjectResult] = useState("");
  const [projectInsight, setProjectInsight] = useState("");
  const [roleTags, setRoleTags] = useState([]);
  const [collaborationTags, setCollaborationTags] = useState([]);
  const [resultTags, setResultTags] = useState([]);
  const [aiExamples, setAiExamples] = useState([]);
  const [aiExamplesLoading, setAiExamplesLoading] = useState(false);
  const [aiExamplesError, setAiExamplesError] = useState("");
  const [workOptions, setWorkOptions] = useState(() => workBaseOptions);
  const [contextOptions, setContextOptions] = useState(() => contextBaseOptions);
  const [resultOptions, setResultOptions] = useState(() =>
    createTagOptions([...resultBaseOptions, ...PROJECT_RESULT_CHIP_OPTIONS]),
  );
  const [workInput, setWorkInput] = useState("");
  const [contextInput, setContextInput] = useState("");
  const [resultInput, setResultInput] = useState("");
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [projectStartDate, setProjectStartDate] = useState("");
  const [projectEndDate, setProjectEndDate] = useState("");
  const [recordDate, setRecordDate] = useState(() => firstNonEmpty(initialRecordContext?.date, googleCalendarCandidate?.date, todayDateKey()).slice(0, 10));
  const [projectRecordType, setProjectRecordType] = useState("personal");
  const [quickDraftGuideOpen, setQuickDraftGuideOpen] = useState(false);
  const selectedGuide = useMemo(() => deriveWorkRecallGuide(roleTags), [roleTags]);
  const selectedGuideTitle = selectedGuide
    ? selectedGuide.key === "GENERIC"
      ? "업무 기록 가이드"
      : `${selectedGuide.sourceLabel} 기록 가이드`
    : "";
  const weeklyTextPlaceholder = selectedGuide?.placeholder || placeholder;
  const improvementPayload = isImproveMode
    ? {
        improvementMode: true,
        sourceRecordId: initialRecordContext?.recordId || null,
        improvementSource: initialRecordContext?.source || "calendar-drawer",
        sourceRecordTitle: firstNonEmpty(initialRecordContext?.record?.title, initialRecordContext?.record?.summary),
        recommendedAction: compactRecommendedAction(initialRecordContext?.recommendedAction),
      }
    : {};
  const projectActionPayload = isProjectActionMode
    ? {
        source: initialRecordContext?.source || "project-view",
        mode: "project-action",
        actionStatus: getProjectActionStatusFromDates(projectStartDate, projectEndDate),
        recommendedAction: compactRecommendedAction(initialRecordContext?.recommendedAction),
        googleCalendarCandidate: compactGoogleCalendarCandidate(googleCalendarCandidate),
      }
    : {};
  const projectProgressPayload = useMemo(
    () =>
      isProjectProgressMode
        ? {
            source: initialRecordContext?.source || "project-action-drawer",
            mode: "project-progress",
            track: "project",
            recordType: "teamProject",
            progressType: "daily_progress",
            projectName: firstNonEmpty(initialRecordContext?.projectName, projectName),
            sourceRecordId: initialRecordContext?.recordId || null,
            sourceRecordTitle: firstNonEmpty(initialRecordContext?.actionTitle, initialRecordContext?.record?.title, initialRecordContext?.record?.summary),
            improvementSource: "project-action-progress",
            linkedAction: initialRecordContext?.linkedAction || null,
          }
        : {},
    [initialRecordContext, isProjectProgressMode, projectName],
  );
  const googleCalendarCandidatePayload = isGoogleCalendarCandidateMode
    ? {
        source: "google-calendar-candidate",
        mode: initialRecordContext?.mode || "calendar-event-experience",
        googleCalendarCandidate: compactGoogleCalendarCandidate(googleCalendarCandidate),
      }
    : {};

  useEffect(() => {
    setAiExamples([]);
    setAiExamplesError("");
  }, [selectedGuide?.key]);

  useEffect(() => {
    setText("");
    setProjectName("");
    setProjectPeriod("");
    setProjectGoal("");
    setProjectContext("");
    setProjectActions("");
    setProjectResult("");
    setProjectInsight("");
    setRoleTags([]);
    setCollaborationTags([]);
    setResultTags([]);
    setWorkOptions(workBaseOptions);
    setContextOptions(contextBaseOptions);
    setResultOptions(
      isProjectTrack
        ? createTagOptions([...resultBaseOptions, ...PROJECT_RESULT_CHIP_OPTIONS])
        : resultBaseOptions,
    );
    setWorkInput("");
    setContextInput("");
    setResultInput("");
    setShowProjectDetails(false);
    setProjectStartDate("");
    setProjectEndDate("");
    setProjectRecordType("personal");
  }, [track, workBaseOptions, contextBaseOptions, resultBaseOptions, isProjectTrack]);

  useEffect(() => {
    if (!isImproveMode) return;
    const record = initialRecordContext?.record || {};
    const raw = record?.rawPayload || record?.raw_payload || {};
    const roleTagValues = toTagList(record.strengthTags || record.strength_tags || raw.roleTags);
    const collaborationTagValues = toTagList(record.skillTags || record.skill_tags || raw.collaborationTags);
    const resultTagValues = toTagList(raw.resultTags);

    if (isProjectTrack) {
      const nextProjectName = firstNonEmpty(record.projectName, record.project_name, raw.projectName, record.title);
      const nextActions = firstNonEmpty(record.task, raw.projectActions, record.summary, record.description, raw.text);
      const nextResult = firstNonEmpty(record.result, raw.projectResult, record.reflectedSentence);
      setProjectRecordType(record.recordType === "teamProject" || raw.recordType === "teamProject" ? "teamProject" : "personal");
      setProjectName(nextProjectName);
      setProjectPeriod(firstNonEmpty(raw.projectPeriod));
      setProjectGoal(firstNonEmpty(raw.projectGoal));
      setProjectContext(firstNonEmpty(raw.projectContext));
      setProjectActions(nextActions);
      setProjectResult(nextResult);
      setProjectInsight(firstNonEmpty(raw.projectInsight));
      setProjectStartDate(firstNonEmpty(raw.startDate, record.startDate, initialRecordContext?.date, record.date, record.record_date));
      setProjectEndDate(firstNonEmpty(raw.endDate, record.endDate));
      setShowProjectDetails(true);
    } else {
      const recommendationText = firstNonEmpty(initialRecordContext?.recommendedAction?.title, initialRecordContext?.recommendedAction?.description);
      setText((current) => (String(current || "").trim() ? current : buildImprovementText(initialRecordContext) || recommendationText));
    }

    if (roleTagValues.length) {
      setRoleTags(roleTagValues);
      setWorkOptions((current) => createTagOptions([...current, ...roleTagValues]));
    }
    if (collaborationTagValues.length) {
      setCollaborationTags(collaborationTagValues);
      setContextOptions((current) => createTagOptions([...current, ...collaborationTagValues]));
    }
    if (resultTagValues.length) {
      setResultTags(resultTagValues);
      setResultOptions((current) => createTagOptions([...current, ...resultTagValues]));
    }
  }, [initialRecordContext, isImproveMode, isProjectTrack]);

  useEffect(() => {
    const nextDate = firstNonEmpty(initialRecordContext?.date, googleCalendarCandidate?.date, todayDateKey()).slice(0, 10);
    setRecordDate(nextDate || todayDateKey());
  }, [googleCalendarCandidate?.date, initialRecordContext?.date]);

  useEffect(() => {
    if (!isCalendarEventExperienceMode || isProjectTrack) return;
    setText((current) => current || buildGoogleCalendarCandidateText(googleCalendarCandidate));
  }, [googleCalendarCandidate, isCalendarEventExperienceMode, isProjectTrack]);

  useEffect(() => {
    if (!isProjectActionMode || !isProjectTrack) return;
    setProjectRecordType(initialRecordContext?.recordType === "personal" ? "personal" : "teamProject");
    setProjectName((current) => current || firstNonEmpty(initialRecordContext?.projectName, googleCalendarCandidate?.title));
    setProjectActions((current) => current || firstNonEmpty(initialRecordContext?.recommendedAction?.title, initialRecordContext?.recommendedAction?.description, googleCalendarCandidate?.title, googleCalendarCandidate?.description));
    setProjectStartDate((current) => current || firstNonEmpty(recordDate, initialRecordContext?.date, googleCalendarCandidate?.date));
    setProjectEndDate((current) => current || firstNonEmpty(String(googleCalendarCandidate?.endTime || "").slice(0, 10)));
    setShowProjectDetails(true);
  }, [googleCalendarCandidate, initialRecordContext, isProjectActionMode, isProjectTrack, recordDate]);

  useEffect(() => {
    if (!isProjectProgressMode || !isProjectTrack) return;
    const record = initialRecordContext?.record || {};
    const raw = record?.rawPayload || record?.raw_payload || {};
    setProjectRecordType("teamProject");
    setProjectName((current) => current || firstNonEmpty(initialRecordContext?.projectName, record.projectName, record.project_name, raw.projectName));
    setProjectActions((current) => current || firstNonEmpty(initialRecordContext?.actionTitle, record.task, raw.projectActions, record.title));
    setProjectStartDate((current) => current || firstNonEmpty(initialRecordContext?.date, record.date, record.record_date, raw.startDate, record.startDate, recordDate));
    setShowProjectDetails(true);
  }, [initialRecordContext, isProjectProgressMode, isProjectTrack, recordDate]);

  const hasProjectInput =
    projectRecordType === "personal"
      ? projectName.trim().length > 0 || projectActions.trim().length > 0
      : projectName.trim().length > 0 ||
        projectGoal.trim().length > 0 ||
        projectContext.trim().length > 0 ||
        projectActions.trim().length > 0 ||
        projectResult.trim().length > 0 ||
        projectInsight.trim().length > 0;

  const hasWeeklyInput = text.trim().length > 0 || roleTags.length > 0 || collaborationTags.length > 0 || resultTags.length > 0;
  const canSubmit = (isProjectTrack ? hasProjectInput : hasWeeklyInput) && !isLoading;

  useEffect(() => {
    if (typeof onDraftChange !== "function") return;
    const snapshot = isProjectTrack
      ? { text, track: "project", startDate: projectStartDate || recordDate, endDate: projectEndDate, projectName, projectPeriod, projectGoal, projectContext, projectActions, projectResult, projectInsight, roleTags, collaborationTags, resultTags, ...projectProgressPayload }
      : { text, track: "weekly", startDate: recordDate, roleTags, collaborationTags, resultTags };
    onDraftChange({ hasContent: canSubmit, snapshot });
  }, [
    text,
    track,
    projectName,
    projectPeriod,
    projectGoal,
    projectContext,
    projectActions,
    projectResult,
    projectInsight,
    projectStartDate,
    projectEndDate,
    recordDate,
    roleTags,
    collaborationTags,
    resultTags,
    isLoading,
    projectRecordType,
    projectProgressPayload,
    canSubmit,
    isProjectTrack,
    onDraftChange,
  ]);

  function addCustomWorkTag() {
    const normalized = normalizePmMvpCustomTag(workInput);
    if (!normalized) return;
    setWorkOptions((current) => appendTagOption(current, normalized));
    setRoleTags((current) => (current.includes(normalized) ? current : [...current, normalized]));
    setWorkInput("");
  }

  function addCustomContextTag() {
    const normalized = normalizePmMvpCustomTag(contextInput);
    if (!normalized) return;
    setContextOptions((current) => appendTagOption(current, normalized));
    setCollaborationTags((current) => (current.includes(normalized) ? current : [...current, normalized]));
    setContextInput("");
  }

  function addCustomResultTag() {
    const normalized = normalizePmMvpCustomTag(resultInput);
    if (!normalized) return;
    setResultOptions((current) => appendTagOption(current, normalized));
    setResultTags((current) => (current.includes(normalized) ? current : [...current, normalized]));
    setResultInput("");
  }

  function handleLoadSample() {
    if (isProjectTrack) {
      setProjectRecordType(sampleRecord.recordType || "teamProject");
      setProjectName(sampleRecord.projectName || "");
      setProjectPeriod(sampleRecord.projectPeriod || "");
      setProjectGoal(sampleRecord.projectGoal || "");
      setProjectContext(sampleRecord.projectContext || "");
      setProjectActions(sampleRecord.projectActions || "");
      setProjectResult(sampleRecord.projectResult || "");
      setProjectInsight(sampleRecord.projectInsight || "");
      setProjectStartDate("");
      setProjectEndDate("");
    } else {
      setText(sampleRecord.text || "");
    }
    const tags = sampleRecord.roleTags || [];
    const ctxTags = sampleRecord.collaborationTags || [];
    const resTags = sampleRecord.resultTags || [];
    setRoleTags(tags);
    setCollaborationTags(ctxTags);
    setResultTags(resTags);
    setWorkOptions(createTagOptions([...workBaseOptions, ...tags]));
    setContextOptions(createTagOptions([...contextBaseOptions, ...ctxTags]));
    setResultOptions(
      isProjectTrack
        ? createTagOptions([...resultBaseOptions, ...PROJECT_RESULT_CHIP_OPTIONS, ...resTags])
        : createTagOptions([...resultBaseOptions, ...resTags]),
    );
  }

  function handleRecordDateChange(nextDate) {
    const normalizedDate = String(nextDate || "").slice(0, 10) || todayDateKey();
    if (isProjectTrack) {
      setProjectStartDate((currentStartDate) =>
        !currentStartDate || currentStartDate === recordDate ? normalizedDate : currentStartDate
      );
    }
    setRecordDate(normalizedDate);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    if (isProjectTrack) {
      const finalProjectPeriod =
        projectStartDate && projectEndDate
          ? `${projectStartDate} ~ ${projectEndDate}`
          : projectStartDate || projectEndDate || projectPeriod.trim();
      const projectText =
        projectRecordType === "personal"
          ? [
              projectName.trim() && `업무명: ${projectName.trim()}`,
              finalProjectPeriod && `기간: ${finalProjectPeriod}`,
              projectActions.trim() && `한 일: ${projectActions.trim()}`,
              resultTags.length > 0 && `변화 유형: ${resultTags.join(", ")}`,
            ].filter(Boolean).join("\n")
          : [
              projectName.trim() && `프로젝트명: ${projectName.trim()}`,
              finalProjectPeriod && `기간: ${finalProjectPeriod}`,
              projectGoal.trim() && `팀 목표: ${projectGoal.trim()}`,
              projectContext.trim() && `내 역할: ${projectContext.trim()}`,
              projectActions.trim() && `이번에 처리한 일: ${projectActions.trim()}`,
              projectResult.trim() && `결과/성과: ${projectResult.trim()}`,
              projectInsight.trim() && `다음 액션/학습: ${projectInsight.trim()}`,
              resultTags.length > 0 && `변화 유형: ${resultTags.join(", ")}`,
            ].filter(Boolean).join("\n");
      onSubmit({
        track: "project",
        recordType: projectRecordType,
        startDate: projectStartDate || recordDate,
        endDate: projectEndDate || "",
        text: projectText,
        projectName: projectName.trim(),
        projectPeriod: finalProjectPeriod,
        projectGoal: projectGoal.trim(),
        projectContext: projectContext.trim(),
        projectActions: projectActions.trim(),
        projectResult: projectResult.trim(),
        projectInsight: projectInsight.trim(),
        roleTags,
        collaborationTags,
        resultTags,
        ...improvementPayload,
        ...projectActionPayload,
        ...projectProgressPayload,
      });
    } else {
      onSubmit({
        text: text.trim(),
        startDate: recordDate,
        roleTags,
        collaborationTags,
        resultTags,
        track: normalizedTrack,
        ...improvementPayload,
        ...googleCalendarCandidatePayload,
      });
    }
  }

  function getProjectNamePlaceholder() {
    const p = projectPlaceholders.projectName;
    if (p && typeof p === "object") return p[projectRecordType] || p.personal || "";
    return p || "";
  }

  function getProjectActionsPlaceholder() {
    const p = projectPlaceholders.projectActions;
    if (p && typeof p === "object") return p[projectRecordType] || p.personal || "";
    return p || "";
  }

  function getProjectContextPlaceholder() {
    const p = projectPlaceholders.projectContext;
    if (p && typeof p === "object") return p[projectRecordType] || p.personal || "";
    return p || "";
  }

  async function handleAiExamplesRequest() {
    if (!selectedGuide) return;
    setAiExamplesLoading(true);
    setAiExamplesError("");
    setAiExamples([]);
    try {
      const prompt = buildWorkRecordAiExamplesPrompt({
        currentCareerRoleLabel,
        currentJobId,
        guideTitle: selectedGuideTitle,
        guideQuestions: selectedGuide.questions ?? [],
        guideExample: selectedGuide.example ?? "",
        roleTags,
        collaborationTags,
        resultTags,
        draftText: text,
      });
      const proxyUrl = resolveOpenAiProxyUrl();
      const resp = await fetch(proxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }], model: "gpt-4o-mini", temperature: 0.2, max_tokens: 1600 }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.ok) {
        setAiExamplesError("AI 예시를 가져오지 못했습니다. 기존 가이드를 참고해 작성해 주세요.");
        return;
      }
      const content = data?.data?.choices?.[0]?.message?.content ?? "";
      let parsed;
      try { parsed = JSON.parse(content); } catch {
        setAiExamplesError("AI 예시를 가져오지 못했습니다. 기존 가이드를 참고해 작성해 주세요.");
        return;
      }
      const examples = Array.isArray(parsed?.examples)
        ? parsed.examples.filter((ex) => String(ex?.text || "").trim())
        : [];
      if (examples.length === 0) {
        setAiExamplesError("AI 예시를 가져오지 못했습니다. 기존 가이드를 참고해 작성해 주세요.");
        return;
      }
      setAiExamples(examples);
    } catch {
      setAiExamplesError("AI 예시를 가져오지 못했습니다. 기존 가이드를 참고해 작성해 주세요.");
    } finally {
      setAiExamplesLoading(false);
    }
  }

  function applyAiExampleText(exampleText) {
    const trimmed = String(exampleText || "").trim();
    if (!trimmed) return;
    setText((current) => {
      const cur = String(current || "").trim();
      if (!cur) return trimmed;
      if (cur.includes(trimmed)) return current;
      return `${ensureSentenceEnding(cur)} ${trimmed}`;
    });
  }

  function applyAiResultSuggestions(resultSuggestions) {
    if (!Array.isArray(resultSuggestions)) return;
    for (const tag of resultSuggestions) {
      const trimmed = String(tag || "").trim();
      if (!trimmed) continue;
      setResultOptions((current) => appendTagOption(current, trimmed));
      setResultTags((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">{copy.title}</h3>
          <p className="text-sm leading-relaxed text-slate-500">{copy.description}</p>
        </div>
        {selectedGuide?.quickDraftChips?.length ? (
          <button
            type="button"
            onClick={() => setQuickDraftGuideOpen((current) => !current)}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[14px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {quickDraftGuideOpen ? "작성 도우미 닫기" : "작성 도우미 열기"}
          </button>
        ) : (
          <div className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[14px] font-medium text-slate-600">
            빠른 입력
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-slate-950">{formatKoreanDate(recordDate)} 기록</p>
            <p className="mt-1 text-xs leading-relaxed text-violet-700">선택한 날짜에 경험을 남기고 있어요.</p>
          </div>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 sm:min-w-[180px]">
            <span>날짜 바꾸기</span>
            <input
              type="date"
              value={recordDate}
              onChange={(event) => handleRecordDateChange(event.target.value)}
              className="h-10 rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleRecordDateChange(todayDateKey())}
            className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => handleRecordDateChange(shiftDateKey(todayDateKey(), -1))}
            className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
          >
            어제
          </button>
        </div>
      </section>

      {isImproveMode ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
          <p className="font-semibold">기존 기록에 이어 보완 기록을 남깁니다</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            원래 기록은 그대로 보존돼요. 성과 수치나 결과를 한 줄 더 붙이면 설득력이 높아져요.
          </p>
        </div>
      ) : null}

      {isGoogleCalendarCandidateMode ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-sky-900">
          <p className="font-semibold">
            {isProjectActionMode ? "Google Calendar 일정 후보를 프로젝트 Action으로 바꿉니다." : "Google Calendar 일정 후보를 경험 기록으로 바꿉니다."}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-sky-800">
            맞는 내용만 골라 저장해 주세요. 참석자 이메일이나 원본 일정 전체는 저장하지 않아요.
          </p>
        </div>
      ) : null}

      {isProjectActionMode ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
          <p className="font-semibold">{isRecommendationActionMode ? "추천 행동을 프로젝트 Action으로 저장합니다." : "프로젝트 Action으로 남길 일을 적어주세요."}</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-800">
            기간과 결과를 적으면 프로젝트뷰에서 진행 상태를 볼 수 있어요.
          </p>
        </div>
      ) : null}

      {isProjectTrack ? (
        <>
          {/* 기록 유형 선택 */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-700">어떤 기록인가요?</p>
            <div className="grid grid-cols-2 gap-2">
              {RECORD_TYPE_OPTIONS.map((option) => {
                const isSelected = projectRecordType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setProjectRecordType(option.value)}
                    className={[
                      "rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-950 hover:shadow-sm",
                    ].join(" ")}
                  >
                    <p className={["text-sm font-semibold", isSelected ? "text-white" : "text-slate-800"].join(" ")}>
                      {option.label}
                    </p>
                    <p className={["mt-1 text-xs leading-relaxed", isSelected ? "text-white/80" : "text-slate-500"].join(" ")}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 공통 + recordType별 입력 필드 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
            {/* 프로젝트명 / 업무명 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">
                {projectRecordType === "personal" ? "업무명" : "프로젝트명"}
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder={getProjectNamePlaceholder()}
                className="h-9 rounded-md border border-slate-200 px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
              />
            </div>

            {/* 진행 기간 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">진행 기간</label>
              <p className="text-xs text-slate-400">날짜를 선택하거나 빠른 기간을 골라주세요.</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PERIOD_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setProjectPeriod(label);
                      setProjectStartDate("");
                      setProjectEndDate("");
                    }}
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      projectPeriod === label && !projectStartDate && !projectEndDate
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-950 hover:shadow-sm",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={projectStartDate}
                  onChange={(event) => {
                    setProjectStartDate(event.target.value);
                    setProjectPeriod("");
                  }}
                  className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                />
                <span className="text-xs text-slate-400">~</span>
                <input
                  type="date"
                  value={projectEndDate}
                  onChange={(event) => {
                    setProjectEndDate(event.target.value);
                    setProjectPeriod("");
                  }}
                  className="h-9 flex-1 rounded-md border border-slate-200 px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                />
              </div>
            </div>

            {/* teamProject 전용: 팀 목표 */}
            {projectRecordType === "teamProject" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">팀 목표</label>
                <Textarea
                  value={projectGoal}
                  onChange={(event) => setProjectGoal(event.target.value)}
                  placeholder={projectPlaceholders.projectGoal || "예) 사용자가 기록한 경험이 이력서로 이어지는 흐름을 더 쉽게 이해하도록 화면 구조와 문구를 개선합니다."}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            )}

            {/* teamProject 전용: 내 역할 */}
            {projectRecordType === "teamProject" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">내 역할</label>
                <Textarea
                  value={projectContext}
                  onChange={(event) => setProjectContext(event.target.value)}
                  placeholder={getProjectContextPlaceholder()}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            )}

            {/* 무슨 일을 했나요? / 이번에 처리한 일 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">
                {projectRecordType === "personal" ? "무슨 일을 했나요?" : "이번에 처리한 일"}
              </label>
              <Textarea
                value={projectActions}
                onChange={(event) => setProjectActions(event.target.value)}
                placeholder={getProjectActionsPlaceholder()}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {/* teamProject 전용: 완료했거나 다음으로 해야 할 일 */}
            {projectRecordType === "teamProject" && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">완료했거나 다음으로 해야 할 일</label>
                <Textarea
                  value={projectInsight}
                  onChange={(event) => setProjectInsight(event.target.value)}
                  placeholder={projectPlaceholders.projectInsight || "예) 팀 업무와 개인 업무를 나누는 방식이 더 직관적인지 추가 확인이 필요합니다."}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            )}
          </div>

          {/* 업무/기여 유형 칩 */}
          <TagEditorSection
            label={projectRecordType === "personal" ? "어떤 일에 가까웠나요?" : "어떤 기여에 가까웠나요?"}
            options={workOptions}
            inputValue={workInput}
            selected={roleTags}
            addLabel="추가"
            placeholder="직접 추가"
            onToggle={(tag) => setRoleTags((current) => toggleItem(current, tag))}
            onInputChange={setWorkInput}
            onAdd={addCustomWorkTag}
            onRemove={(tag) => {
              setWorkOptions((current) => removeItem(current, tag));
              setRoleTags((current) => removeItem(current, tag));
            }}
          />

          {/* 변화 유형 칩 */}
          <TagEditorSection
            label="어떤 변화가 있었나요?"
            options={resultOptions}
            inputValue={resultInput}
            selected={resultTags}
            addLabel="추가"
            placeholder="직접 추가"
            onToggle={(tag) => setResultTags((current) => toggleItem(current, tag))}
            onInputChange={setResultInput}
            onAdd={addCustomResultTag}
            onRemove={(tag) => {
              setResultOptions((current) => removeItem(current, tag));
              setResultTags((current) => removeItem(current, tag));
            }}
          />

          {/* 자세히 남기기 토글 */}
          <button
            type="button"
            onClick={() => setShowProjectDetails((current) => !current)}
            className="self-start text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 underline-offset-2 hover:underline"
          >
            {showProjectDetails ? "자세히 입력 닫기" : "자세히 남기기"}
          </button>

          {/* 자세히 남기기 내용 */}
          {showProjectDetails && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              {/* personal 전용 상세 필드 */}
              {projectRecordType === "personal" && (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">해결하려던 문제</label>
                    <Textarea
                      value={projectContext}
                      onChange={(event) => setProjectContext(event.target.value)}
                      placeholder={getProjectContextPlaceholder()}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">목표 한 줄</label>
                    <Textarea
                      value={projectGoal}
                      onChange={(event) => setProjectGoal(event.target.value)}
                      placeholder={projectPlaceholders.projectGoal || ""}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">결과나 변화</label>
                    <Textarea
                      value={projectResult}
                      onChange={(event) => setProjectResult(event.target.value)}
                      placeholder={projectPlaceholders.projectResult || ""}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">배운 점/다음 개선</label>
                    <Textarea
                      value={projectInsight}
                      onChange={(event) => setProjectInsight(event.target.value)}
                      placeholder={projectPlaceholders.projectInsight || ""}
                      rows={2}
                      className="resize-none text-sm"
                    />
                  </div>
                </>
              )}

              {/* teamProject 전용 상세 필드 */}
              {projectRecordType === "teamProject" && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700">결과나 변화</label>
                  <Textarea
                    value={projectResult}
                    onChange={(event) => setProjectResult(event.target.value)}
                    placeholder={projectPlaceholders.projectResult || ""}
                    rows={2}
                    className="resize-none text-sm"
                  />
                </div>
              )}

              {/* 공통: 협업 맥락 태그 */}
              <TagEditorSection
                label="협업 맥락"
                options={contextOptions}
                inputValue={contextInput}
                selected={collaborationTags}
                addLabel="추가"
                placeholder="프로젝트 협업 맥락 추가"
                onToggle={(tag) => setCollaborationTags((current) => toggleItem(current, tag))}
                onInputChange={setContextInput}
                onAdd={addCustomContextTag}
                onRemove={(tag) => {
                  setContextOptions((current) => removeItem(current, tag));
                  setCollaborationTags((current) => removeItem(current, tag));
                }}
              />
            </div>
          )}
        </>
      ) : (
        <>
          {collapseStructuredSections && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{copy.textLabel}</label>
              <Textarea
                placeholder={weeklyTextPlaceholder}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={4}
                className="resize-none text-sm"
              />
            </div>
          )}
          <TagEditorSection
            label="이번 주 업무 유형"
            defaultCollapsed={collapseStructuredSections}
            options={workOptions}
            inputValue={workInput}
            selected={roleTags}
            addLabel="추가"
            placeholder="이번 주에 맞는 업무 유형 추가"
            onToggle={(tag) => setRoleTags((current) => toggleItem(current, tag))}
            onInputChange={setWorkInput}
            onAdd={addCustomWorkTag}
            onRemove={(tag) => {
              setWorkOptions((current) => removeItem(current, tag));
              setRoleTags((current) => removeItem(current, tag));
            }}
          />
          {selectedGuide ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-900">{selectedGuideTitle}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-slate-500">
                    이번 주에 한 일만 짧게 남겨도 됩니다. 나중에 이력서 문장으로 바꿀 수 있어요.
                  </p>
                </div>
                <span className="max-w-full break-words rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[14px] font-medium text-slate-500">
                  기준 태그: {selectedGuide.sourceLabel}
                </span>
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="text-[14px] font-semibold text-slate-700">막히면 이것만 적어보세요</div>
                <ol className="mt-2 space-y-1.5">
                  {selectedGuide.questions.map((question, index) => (
                    <li key={question} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[13px] font-semibold text-white">
                        {index + 1}
                      </span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {selectedGuide.quickDraftChips?.length && quickDraftGuideOpen ? (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <div className="text-[14px] font-semibold text-slate-700">작성 도우미</div>
                  <p className="mt-1 text-[14px] leading-relaxed text-slate-400">
                    막히면 아래 선택지를 눌러 초안을 시작할 수 있습니다. 전부 고를 필요는 없습니다.
                  </p>
                  <div className="mt-2 space-y-2">
                    {selectedGuide.quickDraftChips.map((group) => (
                      <div key={group.label} className="space-y-1">
                        <div className="text-[14px] font-medium text-slate-500">{group.label}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {group.options.map((option) => {
                            const isAlreadyInserted = text.includes(option);
                            return (
                              <button
                                key={option}
                                type="button"
                                disabled={isAlreadyInserted}
                                title={isAlreadyInserted ? "이미 초안에 들어갔어요" : `${option} 초안 추가`}
                                className={`rounded-full border px-2.5 py-1 text-[14px] font-medium transition-colors ${
                                  isAlreadyInserted
                                    ? "border-slate-200 bg-slate-100 text-slate-400"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100"
                                }`}
                                onClick={() =>
                                  setText((current) => appendQuickDraftChipToText(current, option, group.label))
                                }
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 border-t border-slate-200 pt-2.5">
                <div className="text-[14px] font-semibold text-slate-400">예시</div>
                <p className="mt-1 text-[14px] leading-relaxed text-slate-500">{selectedGuide.example}</p>
              </div>
              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-[14px] font-semibold text-slate-700">AI 예시</div>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
                      선택한 업무 유형과 직무 맥락을 바탕으로 바로 참고할 수 있는 예시를 만들어드릴게요.
                    </p>
                  </div>
                  {!aiExamplesLoading && (
                    <button
                      type="button"
                      onClick={handleAiExamplesRequest}
                      className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      AI 예시 받기
                    </button>
                  )}
                </div>
                {aiExamplesLoading && (
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                    선택한 업무 유형과 직무 맥락을 바탕으로 예시를 만들고 있어요. 약 10초 정도 걸릴 수 있습니다.
                  </p>
                )}
                {aiExamplesError && !aiExamplesLoading && (
                  <p className="mt-2 text-[13px] leading-relaxed text-red-400">{aiExamplesError}</p>
                )}
                {!aiExamplesLoading && aiExamples.length > 0 && (
                  <div className="mt-2 space-y-2.5">
                    <div className="text-[13px] font-medium text-slate-500">AI가 이렇게 구체화했어요</div>
                    {aiExamples.map((example, index) => (
                      <div key={index} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        {/* top row: index badge + title */}
                        <div className="flex items-center gap-2 border-b border-slate-100 px-3 pb-2 pt-2.5">
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                            예시 {index + 1}
                          </span>
                          {example.title && (
                            <span className="text-[14px] font-semibold text-slate-800">{example.title}</span>
                          )}
                        </div>
                        <div className="space-y-2.5 px-3 py-2.5">
                          {/* fitFor */}
                          {example.fitFor && (
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">이런 상황에 맞아요</div>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">{example.fitFor}</p>
                            </div>
                          )}
                          {/* answers */}
                          {Array.isArray(example.answers) && example.answers.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">질문에 이렇게 답할 수 있어요</div>
                              <div className="mt-1.5 space-y-1.5">
                                {example.answers.map((qa, i) => (
                                  <div key={i}>
                                    <div className="text-[12px] text-slate-400">{qa.question}</div>
                                    <div className="text-[13px] leading-relaxed text-slate-700">{qa.answer}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* record sentence */}
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">기록 문장</div>
                            <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
                              <p className="text-[13px] leading-relaxed text-slate-800">{example.text}</p>
                            </div>
                          </div>
                          {/* result tag chips */}
                          {Array.isArray(example.resultSuggestions) && example.resultSuggestions.length > 0 && (
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">같이 붙이면 좋은 성과</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {example.resultSuggestions.map((s) => (
                                  <span key={s} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[12px] text-slate-600">{s}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* action buttons */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => applyAiExampleText(example.text)}
                              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              이 문장 기록에 추가
                            </button>
                            {Array.isArray(example.resultSuggestions) && example.resultSuggestions.length > 0 && (
                              <button
                                type="button"
                                onClick={() => applyAiResultSuggestions(example.resultSuggestions)}
                                className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[13px] font-medium text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                성과 태그 추가
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <TagEditorSection
            label="협업 맥락"
            defaultCollapsed={collapseStructuredSections}
            options={contextOptions}
            inputValue={contextInput}
            selected={collaborationTags}
            addLabel="추가"
            placeholder="이번 기록에 맞는 협업 맥락 추가"
            onToggle={(tag) => setCollaborationTags((current) => toggleItem(current, tag))}
            onInputChange={setContextInput}
            onAdd={addCustomContextTag}
            onRemove={(tag) => {
              setContextOptions((current) => removeItem(current, tag));
              setCollaborationTags((current) => removeItem(current, tag));
            }}
          />
          <TagEditorSection
            label="기억할 성과나 변화 (선택)"
            defaultCollapsed={collapseStructuredSections}
            options={resultOptions}
            inputValue={resultInput}
            selected={resultTags}
            addLabel="추가"
            placeholder="이번 주에 있었던 성과나 변화 추가"
            onToggle={(tag) => setResultTags((current) => toggleItem(current, tag))}
            onInputChange={setResultInput}
            onAdd={addCustomResultTag}
            onRemove={(tag) => {
              setResultOptions((current) => removeItem(current, tag));
              setResultTags((current) => removeItem(current, tag));
            }}
          />
          {!collapseStructuredSections && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700">{copy.textLabel}</label>
              <Textarea
                placeholder={weeklyTextPlaceholder}
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={normalizedTrack === "weekly" ? 4 : 3}
                className="resize-none text-sm"
              />
            </div>
          )}
        </>
      )}

      {typeof onOpenResumeView === "function" ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
          <p className="text-[14px] leading-relaxed text-slate-400">
            {aiDescriptionText ?? (canGenerateAiResumeDraft
              ? "저장된 업무기록을 바탕으로 AI가 이력서 문장 초안을 만들어드립니다."
              : "업무기록을 먼저 저장하면 AI가 이력서 문장 초안을 만들 수 있습니다.")}
          </p>
          <button
            type="button"
            disabled={!canGenerateAiResumeDraft}
            onClick={canGenerateAiResumeDraft ? onOpenResumeView : undefined}
            className={[
              "mt-2 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
              canGenerateAiResumeDraft
                ? "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400",
            ].join(" ")}
          >
            {aiButtonLabel ?? "AI 초안 만들기"}
          </button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 border-t border-slate-100 pt-1 sm:flex-row">
        <Button type="button" variant="outline" onClick={handleLoadSample} className="w-full sm:flex-1">
          {copy.sampleLabel}
        </Button>
        <Button type="submit" disabled={!canSubmit} className="w-full sm:flex-1">
          {copy.submitLabel}
        </Button>
      </div>
    </form>
  );
}
