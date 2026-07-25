const EVIDENCE_TYPES = new Set(["cover_letter", "motivation", "relatedExperience", "postHirePlan"]);

function compactText(value, limit = 80) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}...`;
}

function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function buildIdentityItems(identity = {}) {
  return [
    ["이름", identity.name],
    ["이메일", identity.email],
    ["전화번호", identity.phone],
    ["주소", identity.address],
  ]
    .filter(([, value]) => String(value || "").trim())
    .map(([label, value]) => ({ label, value: compactText(value, 64) }));
}

function buildEducationItems(education) {
  return list(education).slice(0, 3).map((item) => compactText(
    [item.schoolName, item.major, item.degree, item.rawText].find(Boolean),
    72
  )).filter(Boolean);
}

function buildExperienceItems(experiences) {
  return list(experiences).slice(0, 3).map((item) => compactText(
    [item.companyName, item.title, item.period?.raw].filter(Boolean).join(" · ") || item.rawText,
    84
  )).filter(Boolean);
}

function buildSkillItems(skills) {
  return list(skills).slice(0, 8).map((item) => compactText(item.name || item, 40)).filter(Boolean);
}

function getEvidenceItems(evidenceBankCandidate) {
  return list(evidenceBankCandidate?.evidenceItems);
}

export function buildSaraminCandidateReviewModel(metadata) {
  const resumeProfileCandidate = metadata?.resumeProfileCandidate;
  const evidenceBankCandidate = metadata?.evidenceBankCandidate;
  if (!resumeProfileCandidate && !evidenceBankCandidate) return null;

  const education = list(resumeProfileCandidate?.education);
  const experiences = list(resumeProfileCandidate?.experiences);
  const certificates = list(resumeProfileCandidate?.certificates);
  const evidenceItems = getEvidenceItems(evidenceBankCandidate);
  const separatedEvidenceItems = evidenceItems.filter((item) => EVIDENCE_TYPES.has(item?.type));

  return {
    notice: "검수 후 반영 가능 · 아직 저장되지 않았습니다",
    separationNotice: "자기소개서 문항은 경력 bullet로 자동 반영하지 않고 별도 후보로 보관합니다.",
    identityItems: buildIdentityItems(resumeProfileCandidate?.identity || {}),
    educationCount: education.length,
    educationItems: buildEducationItems(education),
    experienceCount: experiences.length,
    experienceItems: buildExperienceItems(experiences),
    certificateCount: certificates.length,
    skillItems: buildSkillItems(resumeProfileCandidate?.skills),
    evidenceCount: evidenceItems.length,
    separatedEvidenceCount: separatedEvidenceItems.length,
    hasCoverLetterEvidence: separatedEvidenceItems.some((item) => item?.type === "cover_letter"),
    hasMotivationEvidence: separatedEvidenceItems.some((item) => item?.type === "motivation"),
    hasRelatedExperienceEvidence: separatedEvidenceItems.some((item) => item?.type === "relatedExperience"),
    hasPostHirePlanEvidence: separatedEvidenceItems.some((item) => item?.type === "postHirePlan"),
  };
}

export default buildSaraminCandidateReviewModel;
