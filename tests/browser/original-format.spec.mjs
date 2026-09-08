import {test,expect} from '@playwright/test';
import {zipSync,unzipSync,strToU8,strFromU8} from 'fflate';
import {readFile} from 'node:fs/promises';
const original='我主要负责的是整理会议材料，还会跟进老师交办的事情，协助完成 3 次活动。';
const xml=`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>模拟候选人</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr><w:tr><w:tc><w:tcPr><w:tcW w:w="9000" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="80"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:rPr><w:b/><w:color w:val="224488"/></w:rPr><w:t>${original.slice(0,9)}</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="宋体"/><w:sz w:val="21"/></w:rPr><w:t>${original.slice(9)}</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="850" w:bottom="900" w:left="850"/></w:sectPr></w:body></w:document>`;
const parts={
  '[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
  '_rels/.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
  'word/document.xml':strToU8(xml),'word/styles.xml':strToU8('<styles>SIMULATED_STYLE_BYTES</styles>'),'word/header1.xml':strToU8('<header>SIMULATED_HEADER</header>'),'word/media/image1.png':new Uint8Array([1,2,3,4]),
};
async function upload(page) {
  await page.goto('/');await page.locator('#originalResume').setInputFiles({name:'original.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync(parts))});
  await expect(page.locator('#templateStatus')).toContainText('1 个可编辑段落');await page.locator('#jdInput').fill('项目运营岗位：负责整理会议材料、协调项目进度、跟进任务执行。要求具备文档整理能力、团队沟通能力及细致的工作习惯。');
}
test('original DOCX content changes while format and every other ZIP part survive',async({page})=>{
  await upload(page);await page.locator('#rewriteLocally').click();await expect(page.locator('[data-rewrite]')).not.toHaveValue(original);
  const downloadEvent=page.waitForEvent('download');await page.locator('#exportOriginalFormat').click();const download=await downloadEvent;
  expect(download.suggestedFilename()).toBe('original-岗位优化.docx');const out=unzipSync(new Uint8Array(await readFile(await download.path())));
  for(const [name,bytes] of Object.entries(parts))if(name!=='word/document.xml')expect(Buffer.from(out[name]).equals(Buffer.from(bytes))).toBe(true);
  const outputXml=strFromU8(out['word/document.xml']);
  const details=await page.evaluate(({a,b})=>{
    const parse=s=>new DOMParser().parseFromString(s,'application/xml');const first=parse(a),second=parse(b);const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';const serialize=(doc,tag)=>[...doc.getElementsByTagNameNS(W,tag)].map(el=>new XMLSerializer().serializeToString(el));
    return {text:[...second.getElementsByTagNameNS(W,'t')].map(el=>el.textContent).join(''),equal:['pPr','rPr','tblPr','tcPr','sectPr'].every(tag=>JSON.stringify(serialize(first,tag))===JSON.stringify(serialize(second,tag)))};
  },{a:xml,b:outputXml});
  expect(details.equal).toBe(true);expect(details.text).toContain('跟进教师交办事项');expect(details.text).toContain('协助完成 3 次活动');
});
test('deep rewrite renders actual replacement paragraphs from simulated provider',async({page})=>{
  await upload(page);let request;
  await page.route('**/api/resume/rewrite',async route=>{request=route.request().postDataJSON();await route.fulfill({json:{paragraphs:[{id:1,optimized:'协助完成 3 次活动，整理会议材料并跟进教师交办事项。'}]}});});
  await page.locator('#allowRewriteUpload').check();await page.locator('#rewriteWithService').click();await expect(page.locator('[data-rewrite]')).toHaveValue('协助完成 3 次活动，整理会议材料并跟进教师交办事项。');
  expect(request.paragraphs[0].original).toBe(original);await expect(page.locator('#templateStatus')).toContainText('完整段落优化稿已生成');
  expect(request.context[0].original).toBe('模拟候选人');
  await expect(page.locator('#templateFullPreview')).toContainText('协助完成 3 次活动');
  await expect(page.locator('#templateReview')).toContainText('已修改 1 段');
  await page.locator('[data-restore="1"]').click();await expect(page.locator('[data-rewrite]')).toHaveValue(original);
  await expect(page.locator('#templateReview')).toContainText('已修改 0 段');
});

test('DOCX compatibility fallbacks and text boxes are read once without duplicated text',async({page})=>{
  const document=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body><mc:AlternateContent><mc:Choice Requires="w14"><w:p><w:r><w:t>Choice section text that should appear once in the resume.</w:t></w:r></w:p></mc:Choice><mc:Fallback><w:p><w:r><w:t>Fallback section text that must not duplicate.</w:t></w:r></w:p></mc:Fallback></mc:AlternateContent><w:p><w:r><w:t>Outer paragraph should not absorb the nested text box contents.</w:t></w:r><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>Text box paragraph that should be read once.</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p></w:body></w:document>`;
  await page.goto('/');await page.locator('#originalResume').setInputFiles({name:'compatibility.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync({...parts,'word/document.xml':strToU8(document)}))});
  await expect(page.locator('#templateStatus')).toContainText('2 个可编辑段落');
  await expect(page.locator('#templateParagraphs')).toContainText('Choice section text that should appear once');
  await expect(page.locator('#templateParagraphs')).not.toContainText('Fallback section text');
  await expect(page.locator('#templateParagraphs')).toContainText('Text box paragraph that should be read once');
});

test('English career-transition draft exports actual text and preserves historical role',async({page})=>{
  const content=['SIMULATED CANDIDATE','Summary','Seeking a Research Assistant position with experience in meeting documentation and procurement follow-up.','Experience','Research Assistant | Example University','Assisted with meeting documentation and procurement follow-up.','Skills','Basic Excel and document management.'];
  const document=`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content.map(s=>`<w:p><w:r><w:t>${s}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;
  await page.goto('/');await page.locator('#originalResume').setInputFiles({name:'synthetic-english.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:Buffer.from(zipSync({...parts,'word/document.xml':strToU8(document)}))});
  await page.locator('#jdInput').fill('Office Coordinator: maintain meeting records, coordinate procurement follow-up and manage office documents.');
  await page.route('**/api/resume/rewrite',route=>{
    const request=route.request().postDataJSON();
    return route.fulfill({json:{paragraphs:request.paragraphs.map(p=>({id:p.id,optimized:p.id===2?'Seeking an Office Coordinator position, bringing experience in meeting documentation and procurement follow-up.':p.id===5?'Assisted with procurement follow-up and maintained meeting documentation.':p.original}))}});
  });
  await page.locator('#allowRewriteUpload').check();await page.locator('#rewriteWithService').click();
  await expect(page.locator('#templateStatus')).toContainText('完整段落优化稿已生成');
  const event=page.waitForEvent('download');await page.locator('#exportOriginalFormat').click();const downloaded=await event;
  const out=unzipSync(new Uint8Array(await readFile(await downloaded.path())));const body=strFromU8(out['word/document.xml']);
  expect(body).toContain('Seeking an Office Coordinator position');expect(body).toContain('Research Assistant | Example University');expect(body).toContain('Assisted with procurement follow-up');expect(body).not.toContain('SHE');
});
test('wrong format and unavailable provider never pretend to produce an optimized resume',async({page})=>{
  await upload(page);await page.locator('#originalResume').setInputFiles({name:'resume.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-')});await expect(page.locator('#templateStatus')).toContainText('需要 .docx');
  await page.route('**/api/resume/rewrite',route=>route.fulfill({status:503,json:{error:'管理员尚未配置内容生成服务'}}));await page.locator('#allowRewriteUpload').check();await page.locator('#rewriteWithService').click();await expect(page.locator('#templateStatus')).toContainText('尚未配置');await expect(page.locator('[data-rewrite]')).toHaveValue(original);
});
