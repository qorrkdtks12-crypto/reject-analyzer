# AI Inbox / Work Records + Career Core read-only anchor 조사

## 1. 조사 목적

AI Inbox와 업무기록 저장/표시 흐름에 Career Core를 read-only derived signal로 연결할 수 있는지 확인했다.

이번 배치의 범위는 조사/설계 검증이다. `App.jsx`, API, DB/schema, Supabase 설정, 저장/동기화 로직은 수정하지 않았다.

## 2. 확인한 파일

- `src/lib/workTrace/extractExperienceCandidates.js`
- `src/lib/workTrace/saveWorkTraceCandidates.js`
- `src/lib/experience/aiInboxRepository.js`
- `src/lib/experience/browserExtensionExtraction.js`
- `src/components/experience/AiExperienceInboxPanel.jsx`
- `src/lib/workRecordRepository.js`
- `src/components/home/HomeDashboard.jsx`
- `src/components/home/CareerAssetMapMock.jsx`
- `src/components/home/careerAssetSignalUtils.js`
- `src/components/home/experienceDemoRecords.js`
- `src/components/home/homeDashboardCalendarUtils.js`
- `src/lib/resume/recordToResumeCandidate.js`
- `src/lib/resume/buildExperienceSignalsFromRecord.js`
- `src/lib/career-core/index.js`
- `src/lib/career-core/buildCareerProfileFromResumeProfile.js`
- `src/lib/career-core/extractCareerSignalsFromResumeProfile.js`
- `src/lib/career-core/buildCareerFitSummary.js`
- `src/lib/career-core/careerProfileModel.js`
- `src/lib/career-core/analyzeCareerTimeline.js`
- `docs/ai-experience-inbox.md`

## 3. AI Inbox 데이터 흐름

1. 후보 생성
   - `extractExperienceCandidates()`가 `/api/openai-proxy`를 호출해 raw work trace text에서 `experienceCandidates`를 추출한다.
   - `sourceMode === "ai_conversation"`이면 assistant 일반 조언만으로 만들어진 후보를 deterministic filter로 제거한다.
   - 반환 shape는 `{ ok, sourceType, sourceMode, detectedPeriod, summary, candidates }`이다.

2. 후보 저장
   - `saveAcceptedWorkTraceCandidates()`는 사용자가 확정한 `acceptedCandidates`를 `work_records`에 저장한다.
   - 같은 저장 성공 이후 `_saveExperienceTables()`가 보조 테이블 `raw_sources`, `experience_cards`, `experience_evidence`에 저장을 시도한다.
   - 보조 테이블 저장 실패는 `console.warn`만 남기고 primary `work_records` 저장 성공을 깨지 않는다.

3. AI Inbox 조회/표시
   - `aiInboxRepository.js`는 `experience_cards`를 직접 조회한다.
   - `CARD_COLUMNS`는 `raw_sources.raw_text`를 제외한다. Inbox UI에는 raw 원문이 아니라 summary, situation, task, evidence snippets, tags, suggested bullet만 노출된다.
   - `listAiInboxExperiences()`는 `status="accepted"`, `listAiResumeMaterialExperiences()`는 `status="converted"`를 조회한다.
   - `AiExperienceInboxPanel.jsx`는 `items`를 `InboxCard`로 표시하고, Inbox 탭에서만 `updateAiInboxExperienceStatus()`로 `archived` 또는 `converted` 상태 변경을 제공한다.

## 4. Work Records 데이터 흐름

1. 저장 row
   - `saveAcceptedWorkTraceCandidates()`가 `createWorkRecord(record)`를 호출한다.
   - 저장 row의 주요 top-level 필드는 `user_id`, `title`, `record_date`, `source`, `strength_tags`, `skill_tags`, `raw_payload`이다.
   - `raw_payload`에는 `rawText`, `sourceType`, `summary`, `acceptedCandidates`, `differReasons`, `assetSkills`, `assetJobTags`, `assetCollaborationTags`, `experienceSignals` 등이 들어간다.

2. Work Record repository
   - `listWorkRecords()`는 `select("*")`로 raw payload를 포함해 조회한다.
   - `listCalendarWorkRecords()`는 dashboard/calendar용으로 raw payload를 제외하고 제한 컬럼만 조회한다.
   - `listExperienceCardsForWorkRecordIds()`는 `experience_cards`를 work record id 기준으로 read-only 조회한다.

3. Home 표시
   - `HomeDashboard.jsx`는 `listCalendarWorkRecords()` 결과를 `adaptWorkRecordRowForHomeDashboard()`로 CalendarRecord shape로 바꾼다.
   - 이 경로는 raw payload를 읽지 않는다. `reflectedSentence`는 `row.result` fallback까지 사용한다.
   - 같은 화면에서 `listExperienceCardsForWorkRecordIds()`로 연결된 material cards를 별도 조회한다.

4. Career Asset 표시
   - `CareerAssetMapMock.jsx`는 로그인 사용자의 `listWorkRecords()` 결과를 읽고 `buildCareerAssetSignals()`로 patterns/traces/directions/jobMatch를 계산한다.
   - `careerAssetSignalUtils.js`는 `strength_tags`, `skill_tags`, `raw_payload.experienceSignals`를 deterministic derived signal의 입력으로 사용한다.

## 5. ExperienceCandidate shape 요약

`extractExperienceCandidates()` normalized candidate:

```js
{
  title,
  role,
  situation,
  task,
  actions: [],
  result: [],
  resumePotential: "high" | "medium" | "low",
  confidenceLevel: "high" | "medium" | "low",
  missingInfoQuestions: [],
  followUpQuestions: [],
  collaboration: [],
  evidenceTexts: [],
  skills: [],
  job_tags: [],
  industry_tags: [],
  suggestedResumeBullet,
  riskNotes: []
}
```

Browser extension extraction uses a close but not identical shape:

```js
{
  title,
  situation,
  task,
  actions: [],
  resultCandidate,
  skills: [],
  jobTags: [],
  industryTags: [],
  evidenceTexts: [],
  missingInfoQuestions: [],
  riskNotes: [],
  confidenceLevel,
  resumePotential,
  suggestedResumeBullet,
  analysisMethod
}
```

## 6. WorkRecord shape 요약

Stored `work_records` row:

```js
{
  id,
  user_id,
  record_date,
  created_at,
  updated_at,
  title,
  description,
  task,
  result,
  project_name,
  strength_tags: [],
  skill_tags: [],
  work_type,
  source,
  raw_payload
}
```

`raw_payload` for work trace import:

```js
{
  source: "work_trace_paste_import",
  version: "work_trace_v1",
  rawText,
  sourceType,
  detectedPeriod,
  summary,
  acceptedCandidates: [],
  differReasons,
  allCandidateCount,
  acceptedCount,
  savedAt,
  assetSkills: [],
  assetJobTags: [],
  assetCollaborationTags: [],
  experienceSignals: [],
  sourceMode,
  sourceLabel,
  importMethod,
  sourcePlatform
}
```

Dashboard CalendarRecord adapter output:

```js
{
  id,
  date,
  source,
  recordType,
  workType,
  title,
  summary,
  reflectedSentence,
  strengthTags: [],
  workTags: [],
  skillTags: [],
  rawPayload,
  linkedAssetIds: [],
  startDate,
  endDate,
  projectPeriod
}
```

## 7. ExperienceCandidate와 WorkRecord의 관계

- `acceptedCandidates`는 WorkRecord `raw_payload.acceptedCandidates`에 그대로 보존된다.
- 후보의 `skills`는 WorkRecord `strength_tags`의 기반이 된다.
- 후보의 `job_tags`는 WorkRecord `skill_tags`의 기반이 된다.
- 후보의 `result`는 `raw_payload.experienceSignals`로 일부 파생된다.
- 각 accepted candidate는 `_saveExperienceTables()`에서 `experience_cards` row로도 저장된다.
- `experience_cards.work_record_id`가 WorkRecord와 AI Inbox item 사이의 연결 key이다.

## 8. Career Core와 연결 가능한 입력

현재 Career Core ready path는 ResumeProfile 중심이다.

- `buildCareerProfileFromResumeProfile(resumeProfile, options)`
  - `resumeProfile.experiences`를 `analyzeCareerTimeline()`에 넘긴다.
  - `extractCareerSignalsFromResumeProfile()`가 headline, experiences, bullets, skills에서 role/industry/strength/risk/tool signals를 뽑는다.
  - `options.target`이 있으면 `buildCareerFitSummary()`로 fit을 추가한다.

WorkRecord에서 Career Core에 바로 매핑 가능한 입력:

- 기간: `record_date`, `raw_payload.startDate/endDate/projectPeriod` 일부
- 제목/역할 후보: `title`, `task`, `raw_payload.acceptedCandidates[].role`, `job_tags`
- bullet 후보: `suggestedResumeBullet`, `result`, `actions`, `evidenceTexts`
- strength/skill 후보: `strength_tags`, `skill_tags`, `acceptedCandidates[].skills`
- industry 후보: `acceptedCandidates[].industry_tags`, `experience_cards.industry_tags`
- evidence strength 후보: `confidenceLevel`, `riskNotes`, `missingInfoQuestions`

## 9. 바로 연결하기 어려운 이유

- Career Core는 현재 `ResumeProfile` 또는 그와 유사한 `experiences[].bullets[]` 구조를 전제로 한다.
- WorkRecord는 업무 로그/후보 저장 모델이며, 정규 경력 기간, 회사명, 직책, bullet evidence type이 필수적으로 존재하지 않는다.
- `record_date`는 경력 기간이 아니라 기록일이다. 이를 경력 duration으로 사용하면 `buildCareerFitSummary()`의 월 단위 합산이 과장될 수 있다.
- AI Inbox item은 `experience_cards` 중심이고, `raw_sources.raw_text`를 의도적으로 조회하지 않는다.
- `HomeDashboard.jsx`의 안전 조회 경로는 raw payload를 제외하므로 Career Core 입력으로 충분하지 않을 수 있다.
- Browser extension candidate는 `resultCandidate`, `jobTags`, `industryTags`처럼 workTrace candidate와 alias가 다르다.
- 저장 row에 Career Core 결과를 섞으면 raw payload가 UI/분석 상태를 동시에 갖게 되어 write-flow 책임이 넓어진다.

## 10. 안전한 read-only anchor 후보

### 후보 A: Career Core adapter pure helper

- 위치 후보: `src/lib/career-core/buildCareerProfileFromWorkRecords.js`
- 역할: WorkRecord 또는 AI Inbox item 배열을 ResumeProfile-like intermediate로 변환한 뒤 CareerProfile을 만든다.
- 권장 특성:
  - pure function
  - no Supabase
  - no API
  - no AI call
  - no write
  - 입력 alias normalization만 담당
  - duration은 기본적으로 `unknown` 또는 1-month placeholder로 두고 fit month summary에는 경고를 남긴다.

### 후보 B: AI Inbox item card derived signal

- anchor: `src/components/experience/AiExperienceInboxPanel.jsx`의 `InboxCard`
- 입력: `item.title`, `suggestedResumeBullet`, `skills`, `jobTags`, `industryTags`, `evidenceTexts`, `riskNotes`
- 표시 방식: "Career Core 참고 신호" 같은 read-only small block.
- 장점: 저장 데이터 변경 없이 Inbox 후보별로 바로 표시 가능.
- 주의: 현재 `InboxCard`는 component 파일이므로 다음 구현 batch에서만 수정한다.

### 후보 C: Career Asset Map read-only computation

- anchor: `src/components/home/CareerAssetMapMock.jsx`의 `liveAssetSignals` useMemo
- 입력: `listWorkRecords()` raw rows
- 장점: raw payload와 existing asset signal을 모두 볼 수 있다.
- 주의: mock 이름의 화면이라 product surface 여부 확인 필요. UI copy/placement는 후속 batch에서 검증해야 한다.

### 후보 D: Home dashboard limited signal

- anchor: `HomeDashboard.jsx`의 `analysisRecords` 또는 `recentExperienceAnalysis` useMemo
- 입력: `listCalendarWorkRecords()` 결과와 연결 `experience_cards`
- 장점: raw payload 없이 표시 가능해 privacy-safe하다.
- 한계: Career Core adapter에는 정보가 부족할 수 있다. "강점/직무 방향 힌트" 수준만 적합하다.

## 11. 위험한 anchor 후보

- `saveAcceptedWorkTraceCandidates()` 내부에서 Career Core 결과를 `raw_payload`에 저장
  - 저장 흐름 변경이며 write path를 넓힌다.
- `_saveExperienceTables()`에서 `experience_cards.metadata`에 Career Core 결과 저장
  - DB write shape 변경이며 schema/contract 논의가 필요하다.
- `workRecordRepository.updateWorkRecord*` helper로 Career Core 결과를 backfill
  - storage mutation이고 이번 phase 범위 밖이다.
- `App.jsx` routing/state에 Career Core 계산을 직접 추가
  - 금지 파일이며 app-wide blast radius가 크다.
- API route 또는 Supabase function에서 Career Core 계산
  - API/DB/Supabase 변경이며 protected 작업으로 분리해야 한다.
- `raw_sources.raw_text`를 Inbox select에 추가
  - 기존 privacy invariant를 깨는 위험 anchor다.
- `record_date`를 경력 duration으로 확정해 월 단위 fit summary에 넣기
  - Career Core 결과가 사실보다 강하게 보일 수 있다.

## 12. DB schema 변경 필요 여부

이번 read-only phase에는 DB schema 변경이 필요하지 않다.

최소 연결은 기존 `work_records`, `experience_cards`, `experience_evidence` read 결과를 UI에서 계산하는 방식으로 가능하다. Career Core 결과를 저장하거나 검색/집계 대상으로 만들려면 별도 protected batch에서 schema/contract를 설계해야 한다.

## 13. App.jsx/API 없이 가능한지

가능하다.

- AI Inbox 내부 표시는 `AiExperienceInboxPanel.jsx` + pure helper import만으로 가능하다.
- Career Asset Map 표시는 `CareerAssetMapMock.jsx` + pure helper import만으로 가능하다.
- Home dashboard limited signal은 `HomeDashboard.jsx` 내부 useMemo에서 가능하다.

단, 새 route 진입점이나 app-wide navigation 변경은 `App.jsx`가 필요하므로 이번 batch 기준에서는 제외한다.

## 14. 추천 구현 Batch

다음 구현 batch는 2파일 이하로 제한하는 것이 안전하다.

1. `src/lib/career-core/buildCareerProfileFromWorkRecords.js`
   - WorkRecord/ExperienceCard input adapter 추가
   - `buildCareerProfileFromResumeProfile()`와 동일한 CareerProfile schema로 normalize
   - duration 불확실성 warning 포함
   - no write/no API/no AI 보장

2. 선택 surface 1개
   - AI Inbox 카드에 후보별 read-only signal 표시: `src/components/experience/AiExperienceInboxPanel.jsx`
   - 또는 Career Asset Map에 집계 signal 표시: `src/components/home/CareerAssetMapMock.jsx`

권장 우선순위는 AI Inbox card이다. 후보별 `skills/jobTags/industryTags/evidenceTexts/suggestedResumeBullet`가 이미 카드 item에 있고, 저장 전후 데이터 흐름을 변경하지 않는다.

## 15. 추천하지 않는 구현 방식

- Career Core 결과를 `raw_payload.careerCoreSignal`에 즉시 저장
- `experience_cards.metadata.careerCoreSignal` 추가 저장
- `raw_sources.raw_text`를 브라우저로 조회해 adapter 입력으로 사용
- `record_date`를 실제 경력 기간으로 간주해 direct/adjacent month bucket을 강하게 표시
- AI 호출로 WorkRecord를 CareerProfile로 재해석
- `App.jsx`에서 전역 state로 Career Core 결과를 주입
- API route나 Supabase function을 새로 만들어 계산/저장

## 16. 다음 단계 지시안

다음 agent에게 줄 구현 지시:

1. 구현 파일은 최대 2개로 제한한다.
2. 첫 파일은 `src/lib/career-core/buildCareerProfileFromWorkRecords.js` pure adapter로 둔다.
3. `src/lib/career-core/index.js` export 추가가 필요하면 파일 수 제한에 포함해 명시한다.
4. UI surface는 AI Inbox card 하나만 선택한다.
5. 표시 문구는 "참고 신호", "저장/확정 아님", "Career Core v0" 성격을 분명히 한다.
6. 저장 데이터, DB, API, Supabase, env, deploy는 변경하지 않는다.
7. `raw_sources.raw_text`는 계속 조회하지 않는다.
8. `record_date` 기반 duration은 fit summary에 직접 쓰지 않거나 warning과 함께 제한적으로만 쓴다.
9. 테스트는 pure adapter deterministic case와 existing Career Core tests를 실행한다.

## 17. 결론

Career Core를 AI Inbox / Work Records에 연결하는 최소 안전 방식은 저장 데이터에 섞지 않는 read-only derived signal이다.

`buildCareerProfileFromWorkRecords` adapter가 아직 없으므로 먼저 pure helper를 만들고, AI Inbox card 또는 Career Asset Map 중 하나의 UI에서 계산값만 표시하는 것이 가장 안전하다. DB schema 변경은 필요하지 않으며, Career Core 결과 저장은 후속 protected 작업으로 분리해야 한다.
