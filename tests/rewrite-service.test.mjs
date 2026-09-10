import test from 'node:test';
import assert from 'node:assert/strict';
import {rewriteParagraph,validateRewrite,createRewriteRequest} from '../public/resume-rewrite.mjs';
import {validateRequest,validateResponse,generateRewrite} from '../lib/rewrite-service.mjs';
const original='我主要负责的是整理会议材料，还会跟进老师交办的事情，协助完成 3 次活动。';
const jd='项目运营岗位：需要整理会议材料、协调工作进度并跟进项目执行。要求具备细致的文档整理能力和团队沟通能力。';

test('conversational revisions preserve original evidence and reject contaminated drafts',()=>{
  const request={jd,instruction:'精简表达，突出会议跟进',paragraphs:[{id:0,original}],draft:[{id:0,optimized:rewriteParagraph(original,jd)}]};
  assert.equal(validateRequest(request).paragraphs[0].original,original);
  assert.throws(()=>validateRequest({...request,instruction:'a'.repeat(2001)}),/2000/);
  assert.throws(()=>validateRequest({...request,draft:[{id:0,optimized:'主导完成 30 次活动。'}]}),/数字/);
  assert.throws(()=>validateRequest({...request,draft:[{id:3,optimized:original}]}),/编号/);
});
test('local rewrite produces a concrete replacement without manufacturing results',()=>{
  const output=rewriteParagraph(original,jd);assert.notEqual(output,original);assert.match(output,/文档整理：负责整理会议材料；跟进教师交办事项/);assert.match(output,/协助完成 3 次活动/);assert.equal(validateRewrite(original,output),output);
});

test('full-document context retains section headings and validates source consistency',()=>{
  const request=createRewriteRequest([{id:0,original:'Summary',editable:false},{id:1,original,editable:true}],jd);
  assert.equal(request.context[0].original,'Summary');assert.equal(request.paragraphs.length,1);validateRequest(request);
  assert.throws(()=>validateRequest({...request,context:[{id:1,original:'different evidence'}]}),/不一致/);
  assert.throws(()=>validateRequest({...request,context:[{id:1,original},{id:1,original}]}),/无效/);
});

test('English rewrite rejects unsupported safety credentials and inflated ownership',()=>{
  const text='Assisted with meeting documentation and procurement follow-up.';
  assert.throws(()=>validateRewrite(text,'Led meeting documentation and procurement follow-up.'),/限定/);
  assert.throws(()=>validateRewrite(text,'Assisted with SHE documentation and procurement follow-up.'),/SHE/);
  assert.throws(()=>validateRewrite(text,'You should rewrite the meeting experience.'),/正文/);
  assert.equal(validateRewrite(text,'Assisted with procurement follow-up and meeting documentation.'),'Assisted with procurement follow-up and meeting documentation.');
});

test('unchanged model output is not reported as an optimized resume',()=>{
  assert.throws(()=>validateResponse({paragraphs:[{id:1,original}]},{paragraphs:[{id:1,optimized:original}]}),/未生成实际/);
});
test('guard rejects changed numbers and responsibility inflation',()=>{
  assert.throws(()=>validateRewrite(original,'主导完成 30 次活动。'),/数字/);
  assert.throws(()=>validateRewrite(original,'负责整理会议材料，完成 3 次活动。'),/协助/);
  assert.throws(()=>validateRewrite('使用 Python基础整理数据','精通 Python 并主导研发'),/基础/);
});
test('provider contract rejects missing or duplicate paragraphs',()=>{
  const input={jd,paragraphs:[{id:1,original}]};assert.equal(validateRequest(input),input);
  assert.throws(()=>validateResponse(input,{paragraphs:[]}),/缺少/);
  assert.throws(()=>validateRequest({jd,paragraphs:[{id:1,original},{id:1,original}]}),/无效/);
});
test('mock provider returns complete text; endpoint errors surface without fake success',async()=>{
  const input={jd,paragraphs:[{id:1,original}]};let sent;
  const result=await generateRewrite(input,{endpoint:'https://example.invalid/chat/completions',model:'simulation',apiKey:'simulation-only'},async(_url,options)=>{
    sent=JSON.parse(options.body);return Response.json({choices:[{message:{content:JSON.stringify({paragraphs:[{id:1,optimized:'协助完成 3 次活动，整理会议材料并跟进教师交办事项。'}]})}}]});
  });
  assert.equal(result.paragraphs[0].optimized,'协助完成 3 次活动，整理会议材料并跟进教师交办事项。');assert.equal(result.needsReview,true);assert.match(sent.messages[0].content,/不输出建议/);
  await assert.rejects(generateRewrite(input,{endpoint:'https://example.invalid',model:'test',apiKey:'test'},async()=>new Response('',{status:503})),/503/);
});
