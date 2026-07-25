import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumeImportMetadata } from "../src/lib/resume/buildResumeImportMetadata.js";
import { buildSaraminCandidateReviewModel } from "../src/lib/resume/buildSaraminCandidateReviewModel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixturePath = path.join(root, "tests", "fixtures", "extract", "saramin_text_resume_anonymized.txt");
const saraminText = fs.readFileSync(fixturePath, "utf8");

assert.equal(buildSaraminCandidateReviewModel(null), null, "metadata 없으면 candidate panel 표시 안 됨");
assert.equal(buildSaraminCandidateReviewModel({}), null, "candidate metadata 없으면 candidate panel 표시 안 됨");

const metadata = buildResumeImportMetadata(saraminText, { kind: "resume" });
const model = buildSaraminCandidateReviewModel(metadata);

assert.ok(model, "metadata 있으면 후보 패널 model이 생성됨");
assert.ok(model.identityItems.length > 0, "identity 후보가 표시됨");
assert.ok(model.educationCount > 0, "education count가 표시됨");
assert.ok(model.experienceCount > 0, "experience count가 표시됨");
assert.ok(model.evidenceCount > 0, "evidence count가 표시됨");
assert.ok(model.separatedEvidenceCount > 0, "자기소개서/지원문항 후보가 EvidenceBank로 분리됨");

const experienceText = [
  ...model.experienceItems,
  ...(metadata.resumeProfileCandidate.experiences || []).flatMap((item) => item.responsibilities || []),
].join("\n");
const evidenceText = (metadata.evidenceBankCandidate.evidenceItems || []).map((item) => item.text).join("\n");
assert.ok(evidenceText.length > 0, "evidence text should exist");
assert.ok(!experienceText.includes("자기소개서"), "자기소개서 후보가 experience로 표시되지 않음");
assert.ok(!experienceText.includes("지원동기"), "지원동기 후보가 experience로 표시되지 않음");

const renderedText = JSON.stringify(model);
for (const forbidden of ["저장 완료", "이력서에 반영됨", "제출 가능", "확정", "내보내기"]) {
  assert.equal(renderedText.includes(forbidden), false, `금지 문구가 나타나지 않음: ${forbidden}`);
}

assert.ok(renderedText.includes("후보"), "후보 문구가 표시됨");
assert.ok(renderedText.includes("검수"), "검수 필요 문구가 표시됨");
assert.ok(renderedText.includes("아직 저장되지 않았습니다"), "저장되지 않음 문구가 표시됨");

console.log("PASS saramin candidate review surface checks");
