import {test,expect} from '@playwright/test';import {zipSync,strToU8,unzipSync,strFromU8} from 'fflate';import {readFile} from 'node:fs/promises';import {PDFDocument,StandardFonts} from 'pdf-lib';
const lines=['模拟甲','电话：13800000000','邮箱：candidate@example.com','教育背景','示例大学 | 制药工程（硕士） 2023.09-2026.06','主要项目经历','示例实验室 | 技术支持 2023.09-2025.12','负责实验试剂采购、供应商沟通、订单跟进和入库核对。','实习经历','示例学院 | 行政助理 2026.07-至今','协助教学物资采办和日常文档归档。'];
test('Word upload fills review draft, applies fields and reuses the original document',async({page})=>{
 await page.goto('/');const xml=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${lines.map(t=>`<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
 await page.locator('#resumeIntake').setInputFiles({name:'synthetic.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync({'word/document.xml':strToU8(xml)}))});
 await expect(page.locator('[data-import-value="school"]')).toHaveValue('示例大学');await expect(page.locator('[data-import-value="project1"]')).toContainText('供应商');await expect(page.locator('#templateStatus')).toContainText('复用');
 await page.locator('#applyIntake').click();await expect(page.locator('#headerName')).toHaveText('模拟甲');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('applypilot-guest-profile')));expect(saved.internshipRole).toBe('行政助理');expect(saved.project1).toContain('入库核对');
});
test('real text PDF is extracted locally into review fields',async({page})=>{
 const doc=await PDFDocument.create();const p=doc.addPage();const font=await doc.embedFont(StandardFonts.Helvetica);['Sample Candidate','Email: candidate@example.com','Phone: 13800000000','Summary','Supported procurement follow-up and maintained project documentation.'].forEach((s,i)=>p.drawText(s,{x:30,y:780-i*30,size:14,font}));
 await page.goto('/');await page.locator('#resumeIntake').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});await expect(page.locator('[data-import-value="email"]')).toHaveValue('candidate@example.com',{timeout:20000});await expect(page.locator('[data-import-value="name"]')).toHaveValue('Sample Candidate');
});
test('real OCR recognizes a job image without external requests and requires review',async({page})=>{
 test.setTimeout(90000);const external=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:4174'))external.push(r.url());});await page.goto('/');
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=420;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='black';x.font='32px Arial';['Procurement Trainee','Manage purchase orders and supplier communication.','Maintain delivery records and documentation.','采购培训生：供应商沟通、订单跟进。'].forEach((s,i)=>x.fillText(s,30,65+i*70));return c.toDataURL('image/png').split(',')[1];});
 await page.locator('#jdInput').fill('Existing JD remains until reviewed');await page.locator('#jdImage').setInputFiles({name:'job.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect(page.locator('#jdImageText')).toHaveValue(/Procurement/i,{timeout:75000});await expect(page.locator('#jdImageText')).toHaveValue(/采购/);await expect(page.locator('#jdInput')).toHaveValue('Existing JD remains until reviewed');await page.locator('#applyJdImage').click();await expect(page.locator('#jdInput')).toHaveValue(/supplier/i);expect(external).toEqual([]);
 const scanned=await PDFDocument.create();const image=await scanned.embedPng(Buffer.from(png,'base64'));scanned.addPage([600,210]).drawImage(image,{x:0,y:0,width:600,height:210});
 await page.locator('#resumeIntake').setInputFiles({name:'scanned.pdf',mimeType:'application/pdf',buffer:Buffer.from(await scanned.save())});await expect(page.locator('#intakeText')).toHaveValue(/Procurement/i,{timeout:75000});await expect(page.locator('#intakeStatus')).toContainText('扫描识别');
});

test('existing fields are not overwritten and failed import keeps current data',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('applypilot-guest-profile',JSON.stringify({name:'已有姓名',email:'old@example.com'})));await page.reload();
 const xml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>新用户</w:t></w:r></w:p><w:p><w:r><w:t>邮箱：new@example.com</w:t></w:r></w:p></w:body></w:document>';
 await page.locator('#resumeIntake').setInputFiles({name:'new.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync({'word/document.xml':strToU8(xml)}))});await expect(page.locator('[data-import-key="name"]')).not.toBeChecked();await expect(page.locator('[data-import-key="email"]')).not.toBeChecked();
 await page.locator('#resumeIntake').setInputFiles({name:'bad.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a pdf')});await expect(page.locator('#intakeStatus')).toContainText('检查文件格式');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('applypilot-guest-profile')).email)).toBe('old@example.com');
});

test('profile-based deep rewrite changes exported content without changing master facts',async({page})=>{
 await page.goto('/');await page.evaluate(()=>localStorage.setItem('applypilot-guest-profile',JSON.stringify({name:'模拟甲',school:'示例大学',degree:'硕士',summary:'具有实验室物料采购与资料整理经历。',project1Title:'物料支持',project1Role:'项目成员',project1:'负责供应商沟通、订单跟进和入库核对。'})));await page.reload();
 await page.locator('#jdInput').fill('采购管理培训生\n岗位职责：负责采购订单跟进、供应商沟通及入库核对，整理采购资料并维护记录，要求具备良好沟通能力和 Office 使用能力。');await page.locator('#analyzeBtn').click();
 await page.route('**/api/resume/rewrite',r=>{const input=r.request().postDataJSON();return r.fulfill({json:{paragraphs:input.paragraphs.map(p=>({id:p.id,optimized:p.original==='具有实验室物料采购与资料整理经历。'?'具备资料整理与实验室物料采购经验。':p.original}))}});});
 await page.locator('#allowProfileRewrite').check();await page.locator('#rewriteInstruction').fill('前置资料整理，保留采购经历');await page.locator('#rewriteProfileVersion').click();await expect(page.locator('#profileRewriteStatus')).toContainText('待核对');await expect(page.locator('#rewriteComparison')).toContainText('具备资料整理与实验室物料采购经验。');await expect(page.locator('#resumePreview')).not.toContainText('具备资料整理与实验室物料采购经验。');await page.locator('#applyProfileDraft').click();await expect(page.locator('#profileRewriteStatus')).toContainText('正文已更新');await expect(page.locator('#resumePreview')).toContainText('具备资料整理与实验室物料采购经验。');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('applypilot-guest-profile')).summary)).toBe('具有实验室物料采购与资料整理经历。');
 const event=page.waitForEvent('download');await page.locator('#exportWord').click();const download=await event;expect(download.suggestedFilename()).toContain('采购管理培训生');const zipped=unzipSync(await readFile(await download.path()));expect(strFromU8(zipped['word/document.xml'])).toContain('具备资料整理与实验室物料采购经验。');
});
