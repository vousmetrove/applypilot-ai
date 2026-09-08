import test from 'node:test';import assert from 'node:assert/strict';import {parseResumeText} from '../public/resume-import-core.mjs';
test('Chinese resume mapping preserves education, project and internship boundaries',()=>{
 const text='模拟甲\n电话：13800000000\n邮箱：candidate@example.com\n教育背景\n示例大学 | 制药工程（硕士） 2023.09-2026.06\n绩点：3.30/4.00\n示例学院 | 制药工程（本科） 2019.09-2023.06\n主要项目经历\n示例实验室 | 技术支持 2023.09-2025.12\n负责试剂采购、供应商沟通和入库核对。\n实习经历\n示例大学 | 行政助理 2026.07-至今\n协助物资采办和文档归档。\n技能/语言\nOffice、CET-6\n自我评价\n具有采购跟进经验。';
 const r=parseResumeText(text);assert.equal(r.fields.name,'模拟甲');assert.equal(r.fields.school,'示例大学');assert.equal(r.fields.bachelorSchool,'示例学院');assert.equal(r.fields.project1Role,'技术支持');assert.equal(r.fields.internshipStart,'2026.07');assert.match(r.fields.project1,/供应商/);assert.doesNotMatch(r.fields.project1,/行政助理/);assert.match(r.evidence.project1.source,/试剂采购/);
});
test('unknown content and missing name are visible, never invented',()=>{const r=parseResumeText('个人简历\n某项不明确的经历\n邮箱：first@example.com second@example.com');assert.equal(r.fields.name,undefined);assert.equal(r.unmapped.includes('某项不明确的经历'),true);assert.match(r.evidence.email.confidence,/多个邮箱/);});
