import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const jd='采购管理培训生，负责采购订单跟进、供应商沟通及资料整理，参与库存核对和跨团队沟通，要求认真细致，有实验室物料采购经历优先。';
test('preview, selected JD capture and undo operate on a simulated form without touching actions',async({page})=>{
  await page.goto('/');await page.setContent(`<p id="job">${jd}</p><label>姓名<input id="name"></label><label>学校<select required id="school"><option value="">请选择</option><option>示例大学</option></select></label><input type="submit" aria-label="姓名" value="提交"><label>邮箱<input id="email"></label>`);
  await page.evaluate(()=>{window.chrome={runtime:{onMessage:{addListener:fn=>window.handle=fn}}};});await page.addScriptTag({content:await readFile('extension/content.js','utf8')});
  const send=type=>page.evaluate(type=>new Promise(resolve=>window.handle({type,payload:{profile:{name:'模拟甲',school:'示例大学',email:'a@example.invalid'}}},null,resolve)),type);
  expect((await send('APPLYPILOT_CAPTURE_JD')).ok).toBe(false);
  await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#job'));getSelection().removeAllRanges();getSelection().addRange(range);});
  expect((await send('APPLYPILOT_CAPTURE_JD')).jd).toBe(jd);
  const preview=await send('APPLYPILOT_ANALYZE');expect(preview.recognized).toBe(3);expect(preview.requiredMissing).toContain('学校');await expect(page.locator('#name')).toHaveValue('');
  expect((await send('APPLYPILOT_FILL')).filled).toBe(3);await page.locator('#email').fill('manual@example.invalid');
  const undo=await send('APPLYPILOT_UNDO');expect(undo.restored).toBe(2);expect(undo.skipped).toBe(1);await expect(page.locator('#name')).toHaveValue('');await expect(page.locator('#school')).toHaveValue('');await expect(page.locator('#email')).toHaveValue('manual@example.invalid');await expect(page.locator('[type=submit]')).toHaveValue('提交');
});

test('successive requests use original facts, and restoration discards an in-flight response',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.setItem('applypilot-guest-profile',JSON.stringify({name:'模拟甲',summary:'具有实验室物料采购与资料整理经历。'})));await page.reload();await page.locator('#jdInput').fill(jd);await page.locator('#analyzeBtn').click();await page.locator('#allowProfileRewrite').check();
  const requests=[];let held,release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/resume/rewrite',async r=>{requests.push(r.request().postDataJSON());if(requests.length===2){held=true;await gate;}await r.fulfill({json:{paragraphs:[{id:0,optimized:'具备资料整理与实验室物料采购经验。'}]}});});
  await page.locator('#rewriteInstruction').fill('前置资料整理');await page.locator('#rewriteProfileVersion').click();await expect(page.locator('#applyProfileDraft')).toBeVisible();expect(requests[0].instruction).toBe('前置资料整理');await expect(page.locator('#resumePreview')).not.toContainText('具备资料整理与实验室物料采购经验。');
  await page.locator('#rewriteInstruction').fill('保留采购经历');await page.locator('#rewriteProfileVersion').click();await expect.poll(()=>held).toBe(true);expect(requests[1].paragraphs[0].original).toBe('具有实验室物料采购与资料整理经历。');expect(requests[1].draft[0].optimized).toBe('具备资料整理与实验室物料采购经验。');
  await page.locator('#restoreProfileVersion').click();release();await expect(page.locator('#profileRewriteStatus')).toContainText('未覆盖');await expect(page.locator('#applyProfileDraft')).toBeHidden();await expect(page.locator('#resumePreview')).not.toContainText('具备资料整理与实验室物料采购经验。');
});
