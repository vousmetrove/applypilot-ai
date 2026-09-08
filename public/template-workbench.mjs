import {readTemplate,exportTemplate} from './docx-template.mjs';
import {rewriteParagraph,validateRewrite,createRewriteRequest} from './resume-rewrite.mjs';
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let template=null,fileName='',generation=0;
const status=text=>{$('#templateStatus').textContent=text;};
function review() {
  const paragraphs=template?.paragraphs || [];
  const changed=paragraphs.filter(p=>p.optimized!==p.original);
  const longer=changed.filter(p=>p.optimized.length>p.original.length*1.15);
  $('#templateFullPreview').textContent=paragraphs.map(p=>p.optimized).filter(Boolean).join('\n\n');
  $('#templateReview').textContent=`已修改 ${changed.length} 段，保留 ${paragraphs.length-changed.length} 段原文。${longer.length?`其中 ${longer.length} 段文字增长超过 15%，请重点检查换行与分页。`:'仍需在 Word / WPS 核对分页。'} 此检查不等于事实审核或版面渲染通过。`;
}
function render() {
  const entries=template?.paragraphs.filter(p=>p.original.trim()) || [];
  $('#templateParagraphs').innerHTML=entries.map(p=>`<article class="rewrite-row" data-paragraph="${p.id}"><b>段落 ${p.id+1}${p.editable?'':' · 保留原文'}</b><div class="rewrite-columns"><div><small>原文</small><p>${escape(p.original)}</p></div><label>优化后${p.editable?`<textarea rows="4" data-rewrite="${p.id}">${escape(p.optimized)}</textarea>`:`<p>${escape(p.original)}</p>`}</label></div></article>`).join('');
  $('#templateActions').classList.toggle('hidden',!template);
  document.querySelectorAll('[data-rewrite]').forEach(el=>{
    el.addEventListener('input',()=>{template.paragraphs.find(p=>p.id===Number(el.dataset.rewrite)).optimized=el.value;generation++;review();});
    const restore=document.createElement('button');restore.type='button';restore.className='secondary-button';restore.textContent='恢复本段原文';restore.dataset.restore=el.dataset.rewrite;
    restore.addEventListener('click',()=>{const p=template.paragraphs.find(p=>p.id===Number(el.dataset.rewrite));p.optimized=p.original;generation++;render();});
    el.parentElement.append(restore);
  });
  review();
}
$('#originalResume').addEventListener('change',async event=>{
  try {
    const file=event.target.files[0];if(!file)return;
    if(!/\.docx$/i.test(file.name))throw new Error('保留原格式需要 .docx 原件；PDF、图片和旧版 DOC 请先在 Word / WPS 转为 DOCX 并核对版式');
    const next=readTemplate(new Uint8Array(await file.arrayBuffer()));
    template=next;fileName=file.name;generation++;render();
    status(`已读取 ${file.name}，识别 ${template.paragraphs.filter(p=>p.editable).length} 个可编辑段落。只在本机内存处理，刷新后需重新选择原文件。`);
  } catch(error) {status(error.message);} finally {event.target.value='';}
});
$('#rewriteLocally').addEventListener('click',()=>{
  if(!template)return;
  const jd=$('#jdInput').value.trim();if(jd.length<40){status('请先在岗位 JD 输入框粘贴至少 40 字的职位描述');return;}
  try {
  const updates=template.paragraphs.filter(p=>p.editable).map(p=>({p,text:validateRewrite(p.original,rewriteParagraph(p.original,jd))}));
  updates.forEach(({p,text})=>p.optimized=text);
  generation++;render();status('已生成本机精简稿：删除冗词并按岗位添加内容标签。需要深度改写时，请使用已配置的内容生成服务，或在右侧直接编辑。');
  }catch(error){status(error.message);}
});
$('#rewriteWithService').addEventListener('click',async()=>{
  if(!template)return;
  if(!$('#allowRewriteUpload').checked){status('请先勾选同意将选中段落发送到部署方的内容生成服务');return;}
  const button=$('#rewriteWithService');button.disabled=true;
  const requestGeneration=generation;
  try {
    let base='';
    const configured=$('#rewriteServiceUrl').value.trim();
    if(configured) {
      const url=new URL(configured);if(url.protocol!=='https:')throw new Error('内容生成服务必须使用 HTTPS');base=url.origin;
      if(location.protocol==='chrome-extension:') {
        const granted=await chrome.permissions.request({origins:[`${url.protocol}//${url.hostname}/*`]});if(!granted)throw new Error('未授权访问内容生成服务');
      }
    } else if(location.protocol==='chrome-extension:') {throw new Error('请填写部署者提供的内容生成服务地址');}
    const response=await fetch(`${base}/api/resume/rewrite`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(createRewriteRequest(template.paragraphs,$('#jdInput').value)),signal:AbortSignal.timeout(55000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error || '内容生成失败');
    if(generation!==requestGeneration)throw new Error('等待生成时原稿已变更，结果未覆盖，请重新生成');
    const requested=template.paragraphs.filter(p=>p.editable);const ids=new Set();
    if(!Array.isArray(data.paragraphs)||data.paragraphs.length!==requested.length)throw new Error('服务返回的段落不完整');
    const updates=data.paragraphs.map(edit=>{const p=requested.find(p=>p.id===edit.id);if(!p||ids.has(edit.id))throw new Error('服务返回段落编号错误');ids.add(edit.id);return {p,text:validateRewrite(p.original,edit.optimized)};});
    if(updates.every(({p,text})=>text===p.original.trim()))throw new Error('服务未生成实际内容修改，原简历已保留');
    updates.forEach(({p,text})=>p.optimized=text);generation++;render();status('完整段落优化稿已生成。请逐段核对事实和表达后下载。');
  } catch(error){status(error.message);} finally {button.disabled=false;}
});
$('#jdInput').addEventListener('input',()=>{generation++;});
$('#exportOriginalFormat').addEventListener('click',()=>{
  try {
    const edits=template.paragraphs.filter(p=>p.editable&&p.optimized!==p.original).map(p=>({id:p.id,optimized:validateRewrite(p.original,p.optimized)}));
    if(!edits.length){status('还没有修改内容，请先生成优化稿或在右侧编辑');return;}
    const bytes=exportTemplate(template,edits);
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}));
    const link=document.createElement('a');link.href=url;link.download=fileName.replace(/\.docx$/i,'-岗位优化.docx');link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
    status(`已替换 ${edits.length} 段，沿用原文件的字体、表格、图片、页眉页脚与页边距。文字长度可能影响换行分页，请用 Word / WPS 打开核对后另存 PDF。`);
  }catch(error){status(error.message);}
});
