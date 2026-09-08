// Shared by the workbench, extension importer and device API.
export const SENSITIVE_FIELDS = new Set([
  'idNumber', 'idType', 'complianceNotes', 'birthDate', 'ethnicity',
  'politicalStatus', 'maritalStatus', 'height', 'emergencyContactName', 'emergencyContactPhone',
]);
export const PROFILE_FIELDS = `name englishName phone email gender birthDate city countryRegion nativePlace nationality householdRegistration currentAddress postalCode workYears portfolio wechat photoStatus socialAccount emergencyContactName emergencyContactPhone targetRoleFamilies targetCities jobType status availableDate salaryExpectation travelPreference relocationPreference applicationSource referrer workAuthorization roleAdjustment preferredIndustry currentEmployer currentSalary noticePeriod workStartDate overseasExperience school degree major masterStart graduation masterStudyType masterCollege gpa masterRank masterFocus masterCourses bachelorSchool bachelorDegree bachelorMajor bachelorStart bachelorEnd bachelorStudyType bachelorRank bachelorCollege bachelorDegreeType bachelorCourses experience1Org experience1Role experience1Department experience1Start experience1End experience1City experience1Description experience2Org experience2Role experience2Department experience2Start experience2End experience2City experience2Description internshipOrg internshipRole internshipDepartment internshipStart internshipEnd internshipCity internshipDescription otherExperience project1Title project1Role project1Dates project1 project1Tags project2Title project2Role project2Dates project2 project2Tags skills english certifications tools awards publications summary idType idNumber ethnicity politicalStatus maritalStatus height complianceNotes customQuestions`.split(' ');
const DERIVED_FIELDS = ['targetRole', 'targetCompany', 'selfIntroduction'];
export function cleanProfile(input, { includeSensitive = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('档案必须是 JSON 对象');
  const result = {};
  for (const key of [...PROFILE_FIELDS, ...DERIVED_FIELDS]) {
    if ((!includeSensitive && SENSITIVE_FIELDS.has(key)) || typeof input[key] !== 'string') continue;
    if (input[key].length > 20000) throw new Error(`字段 ${key} 过长（最多 20000 字）`);
    result[key] = input[key].trim();
  }
  // Free-form answers may contain sensitive values, so they are never transferred automatically.
  if (!includeSensitive) delete result.customQuestions;
  return result;
}
export function educationEntries(p) {
  return [
    {school:p.school, degree:p.degree, major:p.major, start:p.masterStart, end:p.graduation, gpa:p.gpa, studyType:p.masterStudyType, courses:p.masterCourses},
    {school:p.bachelorSchool, degree:p.bachelorDegreeType || p.bachelorDegree, major:p.bachelorMajor, start:p.bachelorStart, end:p.bachelorEnd, rank:p.bachelorRank, studyType:p.bachelorStudyType, courses:p.bachelorCourses},
  ].filter(item => item.school || item.degree || item.major);
}
export function createPayload(input, target = {}) {
  const profile = cleanProfile({...input, ...target});
  return {schema:'applypilot-profile-v5', profile, educationHistory:educationEntries(profile),
    consent:{autoSubmit:false, sensitiveAutofill:false}, updatedAt:new Date().toISOString()};
}
export function parsePayload(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('请选择有效的档案 JSON');
  const version = data.schema?.match(/^applypilot-profile-v(\d+)$/);
  if (version && Number(version[1]) > 5) throw new Error('档案来自更新版本，请先更新简投助手');
  const payload = createPayload(data.profile || data);
  if (!payload.profile.name) throw new Error('没有找到姓名字段，请先填写姓名再导出档案');
  return payload;
}
const EVIDENCE_FIELDS = PROFILE_FIELDS.filter(key => /^(school|degree|major|master|bachelor|experience|internship|project|skills|english|certifications|tools|awards|publications|summary|otherExperience)/.test(key));
export function evidenceText(profile) {
  return EVIDENCE_FIELDS.map(key => typeof profile[key] === 'string' ? profile[key] : '').join(' ').toLowerCase();
}
export function truthfulSummary(profile, keywords = []) {
  // Reorder verbatim source sentences only; never add a degree, skill or achievement.
  const sources = [profile.summary, profile.experience1Description, profile.experience2Description, profile.internshipDescription, profile.project1, profile.project2];
  const sentences = [...new Set(sources.filter(Boolean).flatMap(text => String(text).split(/(?<=[。；;\n])/).map(s => s.trim()).filter(Boolean)))];
  const score = text => keywords.filter(term => text.toLowerCase().includes(term.toLowerCase())).length;
  return sentences.sort((a,b) => score(b) - score(a)).slice(0,3).join(' ');
}
export function keywordCoverage(keywords, matched) {
  return keywords.length ? Math.round(new Set(matched.filter(k => keywords.includes(k))).size / new Set(keywords).size * 100) : 0;
}
export function nextVersion(versions) {
  return Math.max(0, ...versions.map(v => Number.isSafeInteger(v.versionNo) ? v.versionNo : 0)) + 1;
}
