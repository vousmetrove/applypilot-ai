import {test,expect,chromium} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {unzipSync,strFromU8} from 'fflate';
import {parsePayload} from '../../public/profile-core.mjs';
const profile={name:'模拟设计候选人',englishName:'Simulated Designer',phone:'13800000000',email:'candidate@example.invalid',school:'模拟设计学院',degree:'本科',major:'视觉传达',summary:'完成校园活动的视觉设计。',skills:'Figma，交互设计',project1Title:'模拟社团项目',project1:'完成活动海报和交互设计原型。'};
const jd='交互设计师\n岗位职责：负责用户研究、交互设计和原型设计，与团队协作推进项目。任职要求：本科及以上，掌握 Figma；有设计项目经验者优先。';
async function editProfile(page,data=profile) {
  await page.locator('#openProfile').click();
  for(const [key,value] of Object.entries(data)) await page.locator(`[data-profile="${key}"]`).fill(value);
  await page.locator('#saveProfile').click();
}
async function analyze(page) {
  await page.locator('#jdInput').fill(jd);await page.locator('#companyInput').fill('模拟招聘单位');await page.locator('#roleInput').fill('交互设计师');await page.locator('#analyzeBtn').click();
  await expect(page.locator('#results')).toBeVisible();
}
test('anonymous first run, persistence, truthful output and real DOCX export',async({page})=>{
  const apiRequests=[];const errors=[];
  page.on('request',r=>{if(r.url().includes('/api/'))apiRequests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('#analyzeBtn').click();await expect(page.locator('#profileDialog')).toBeVisible();await page.locator('#saveProfile').click();
  await editProfile(page);await page.reload();await expect(page.locator('#headerName')).toHaveText(profile.name);
  await analyze(page);await expect(page.locator('#resumePreview')).not.toContainText(/制药工程硕士|TCGA|TAM|STING/);
  const payload=JSON.parse(await page.locator('#structuredOutput').textContent());
  expect(parsePayload(payload).profile.name).toBe(profile.name);expect(payload.optimized_resume_content.summary).toContain('视觉设计');
  const pending=page.waitForEvent('download');await page.locator('#exportWord').click();const download=await pending;
  const entries=unzipSync(new Uint8Array(await readFile(await download.path())));
  expect(strFromU8(entries['word/document.xml'])).toContain(profile.name);expect(strFromU8(entries['word/document.xml'])).not.toMatch(/制药工程硕士|TCGA|TAM/);
  expect(apiRequests).toEqual([]);expect(errors).toEqual([]);
});
test('profile change invalidates generated result while history remains immutable',async({page})=>{
  await page.goto('/');await editProfile(page);await analyze(page);
  await editProfile(page,{summary:'更新后的真实描述。'});await expect(page.locator('#results')).toBeHidden();
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('applypilot-guest-applications')));
  expect(records[0].result.optimized_resume_content.summary).toContain('视觉设计');
  await analyze(page);expect(await page.locator('#versionLabel').textContent()).toContain('V02');
});
test('backup round-trip and invalid import do not erase the current profile',async({page})=>{
  await page.goto('/');await editProfile(page);
  const pending=page.waitForEvent('download');await page.locator('#exportBackup').click();const backup=await readFile(await (await pending).path());
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#importBackup').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:backup});
  await expect(page.locator('#profileDialog')).toBeVisible();await page.locator('#saveProfile').click();
  await page.locator('#importBackup').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(page.locator('#headerName')).toHaveText(profile.name);
});
test('PNG + JPEG become a two-page PDF, unsupported upload displays an error',async({page})=>{
  await page.goto('/');
  const png=await page.screenshot({type:'png'});const jpg=await page.screenshot({type:'jpeg'});
  await page.locator('summary').filter({hasText:'照片 / PDF'}).click();
  await page.locator('#pdfFiles').setInputFiles([{name:'one.png',mimeType:'image/png',buffer:png},{name:'two.jpg',mimeType:'image/jpeg',buffer:jpg}]);
  const pending=page.waitForEvent('download');await page.locator('#convertPdf').click();const bytes=await readFile(await (await pending).path());
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);await expect(page.locator('#pdfStatus')).toContainText('未上传');
  await page.locator('#pdfFiles').setInputFiles({name:'renamed.pdf',mimeType:'application/pdf',buffer:Buffer.from('MZ fake')});await page.locator('#convertPdf').click();await expect(page.locator('#pdfStatus')).toContainText('暂不支持');
});
test('content script fills simulated fields, protects manual edits, never submits',async({page})=>{
  await page.goto('/');
  await page.setContent(`<form id="application"><label>姓名<input id="name"></label><label>英文姓名<input id="english"></label><label>邮箱<input id="email"></label><label>最高学历<select id="degree"><option value="">请选择</option><option value="bachelor">本科</option><option value="master">硕士</option></select></label><label>学校名称<input id="school"></label><label>求职状态<select id="state"><option value="">请选择</option><option value="open">不考虑机会</option></select></label><label>身份证号码<input id="idNumber"></label><label>Social security number<input id="ssn"></label><label>验证码<input id="captcha"></label><label>姓名<input id="prefilled" value="已由用户填写"></label><input type="file" id="attachment"><label><input type="checkbox" id="consent">同意声明</label><button type="submit">提交</button></form>`);
  await page.evaluate(()=>{window.submits=0;document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.submits++;});window.chrome={runtime:{onMessage:{addListener:fn=>{window.handle=fn;}}}};});
  await page.addScriptTag({content:await readFile('extension/content.js','utf8')});
  const fill=async data=>page.evaluate(payload=>new Promise(resolve=>window.handle({type:'APPLYPILOT_FILL',payload},null,resolve)),{profile:{...data,status:'考虑机会',idNumber:'SIMULATED-SECRET'}});
  await fill(profile);await expect(page.locator('#name')).toHaveValue(profile.name);await expect(page.locator('#english')).toHaveValue(profile.englishName);await expect(page.locator('#degree')).toHaveValue('bachelor');await expect(page.locator('#school')).toHaveValue(profile.school);
  for(const id of ['state','idNumber','ssn','captcha','attachment']) await expect(page.locator('#'+id)).toHaveValue('');
  await expect(page.locator('#prefilled')).toHaveValue('已由用户填写');await page.locator('#name').fill('手动修改姓名');await fill({...profile,name:'新档案姓名'});await expect(page.locator('#name')).toHaveValue('手动修改姓名');
  await expect(page.locator('#consent')).not.toBeChecked();expect(await page.evaluate(()=>window.submits)).toBe(0);
  const preview=await page.evaluate(()=>new Promise(resolve=>window.handle({type:'APPLYPILOT_ANALYZE',payload:{profile:{name:'新姓名'}}},null,resolve)));
  expect(preview.preview.find(p=>p.label==='姓名').reason).toBe('保留手动内容');
  await page.evaluate(()=>new Promise(resolve=>window.handle({type:'APPLYPILOT_UNDO'},null,resolve)));
  await expect(page.locator('#name')).toHaveValue('手动修改姓名');
  // Undo is one batch only; the second fill restores the previous automatic value.
  await expect(page.locator('#email')).toHaveValue(profile.email);
});
test('mobile viewport can create and reuse a profile without overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await editProfile(page);await analyze(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+2)).toBe(true);
});
test('packaged extension loads offline workbench and shares the chosen profile with popup',async({},testInfo)=>{
  test.skip(testInfo.project.name !== 'chromium','Extension package is tested with isolated Chromium, not branded installation UI');
  const extensionPath=path.resolve('build/extension');
  const context=await chromium.launchPersistentContext('',{channel:process.platform==='win32'?'msedge':'chromium',headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  try {
    const sw=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');const id=new URL(sw.url()).host;
    // Observe the real install-triggered options page instead of racing openOptionsPage.
    const workspaceUrl=`chrome-extension://${id}/workspace.html`;
    await expect.poll(()=>context.pages().some(p=>p.url()===workspaceUrl)).toBe(true);
    const page=context.pages().find(p=>p.url()===workspaceUrl);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.waitForLoadState();await editProfile(page);await analyze(page);await page.locator('#useForFilling').click();
    await expect(page.locator('#toast')).toContainText('已选为填表档案');
    const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html`);await expect(popup.locator('#profileName')).toHaveText(profile.name);await expect(popup.locator('#fillBtn')).toBeEnabled();
    const payload=await sw.evaluate(async()=> (await chrome.storage.local.get('applypilotPayload')).applypilotPayload);
    expect(payload.profile.targetRole).toBe('交互设计师');expect(payload.consent.autoSubmit).toBe(false);expect(errors).toEqual([]);
    await sw.evaluate(async ({jd})=>chrome.storage.session.set({'applypilotJD:simulation':{jd,createdAt:Date.now()}}),{jd});
    const imported=await context.newPage();await imported.goto(workspaceUrl+'?jdImport=simulation');await expect(imported.locator('#jdInput')).toHaveValue(jd);
    expect(await sw.evaluate(async()=>Boolean((await chrome.storage.session.get('applypilotJD:simulation'))['applypilotJD:simulation']))).toBe(false);
    await imported.close();
    await editProfile(page,{summary:'修改后必须重新选择版本。'});await expect(popup.locator('#fillBtn')).toBeDisabled();
    const recognized=await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=220;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,220);ctx.fillStyle='black';ctx.font='36px Arial';ctx.fillText('Procurement supplier orders',20,80);ctx.fillText('Office documentation support',20,140);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve));const {readDocument}=await import('./document-input.mjs');return (await readDocument(new File([blob],'jd.png',{type:'image/png'}))).text;
    });expect(recognized).toMatch(/Procurement/i);
  } finally {await context.close();}
});
