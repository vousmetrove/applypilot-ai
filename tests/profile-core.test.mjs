import test from 'node:test';
import assert from 'node:assert/strict';
import {createPayload,parsePayload,cleanProfile,truthfulSummary,evidenceText,educationEntries,keywordCoverage,nextVersion} from '../public/profile-core.mjs';
const personas=[
  {name:'模拟设计候选人',degree:'本科',major:'视觉传达',summary:'完成校园社团的海报设计。',skills:'Figma，交互设计'},
  {name:'模拟运营候选人',degree:'专科',summary:'协助整理每周活动报名表。',skills:'Excel'},
  {name:'模拟研发候选人',degree:'博士',summary:'参与材料测试并记录实验过程。',skills:'Python基础'},
];
for (const p of personas) test(`summary preserves actual source: ${p.name}`,()=>{
  const result=truthfulSummary(p,['AI产品','生物信息学']);
  assert.equal(result,p.summary);assert.doesNotMatch(result,/制药工程硕士|TCGA|TAM|STING/);
});
test('empty profile does not fabricate evidence or a score',()=>{
  assert.equal(truthfulSummary({},['Python']),'');assert.equal(keywordCoverage(['Python'],[]),0);assert.equal(keywordCoverage([],[]),0);
  assert.equal(evidenceText({targetRoleFamilies:'Python',targetCompany:'AI产品'}).trim(),'');
});
test('exports round-trip and exclude sensitive/unknown fields regardless of supplied consent',()=>{
  const source={...personas[0],idNumber:'SIMULATED-SECRET',birthDate:'2000-01-01',customQuestions:'身份证=SIMULATED-SECRET',secret:'hidden'};
  const payload=createPayload(source,{targetRole:'设计师'});
  const imported=parsePayload(JSON.stringify({...payload,optimized_resume_content:{summary:'test'},consent:{autoSubmit:true,sensitiveAutofill:true}}));
  assert.equal(imported.profile.targetRole,'设计师');assert.equal(imported.profile.name,source.name);
  assert.doesNotMatch(JSON.stringify(imported),/SIMULATED-SECRET|hidden|2000-01-01/);
  assert.deepEqual(imported.consent,{autoSubmit:false,sensitiveAutofill:false});
});
test('legacy raw profile is accepted; unknown future version, invalid types and missing name reject',()=>{
  assert.equal(parsePayload(personas[0]).profile.name,personas[0].name);
  assert.throws(()=>parsePayload({schema:'applypilot-profile-v99',profile:personas[0]}),/更新/);
  for(const input of [null,[],{}, {profile:{name:{unsafe:'value'}}}]) assert.throws(()=>parsePayload(input));
  assert.throws(()=>cleanProfile({name:'x'.repeat(20001)}),/过长/);
});
test('only supplied education exists and version number does not repeat after history limit',()=>{
  assert.deepEqual(educationEntries({}),[]);assert.equal(educationEntries(personas[0]).length,1);
  assert.equal(nextVersion(Array.from({length:20},(_,i)=>({versionNo:30-i}))),31);
});
