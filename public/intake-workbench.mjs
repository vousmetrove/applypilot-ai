import {readDocument} from './document-input.mjs';
import {parseResumeText} from './resume-import-core.mjs';
const $=s=>document.querySelector(s);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={name:'姓名',email:'邮箱',phone:'电话',targetCities:'意向城市',targetRoleFamilies:'求职意向',school:'最高学历学校',degree:'最高学历',major:'专业',masterStart:'入学时间',graduation:'毕业时间',gpa:'GPA',masterCourses:'课程',bachelorSchool:'本科学校',bachelorDegree:'本科学历',bachelorMajor:'本科专业',bachelorStart:'本科入学',bachelorEnd:'本科毕业',bachelorRank:'本科成绩',bachelorCourses:'本科课程',summary:'个人优势/自我评价',skills:'技能',otherExperience:'校园经历/荣誉及其他经历'};
function label(key){return labels[key]||key.replace(/^project([12])$/,'项目 $1 描述').replace(/^project([12])Title$/,'项目 $1 名称').replace(/^project([12])Role$/,'项目 $1 角色').replace(/^project([12])Dates$/,'项目 $1 日期').replace(/^internship/,'实习').replace(/^experience([12])/,'经历 $1 ').replace(/Org$/,'单位').replace(/Role$/,'职位').replace(/Start$/,'开始时间').replace(/End$/,'结束时间').replace(/Description$/,'描述');}
function render() {
  const result=parseResumeText($('#intakeText').value);
  const current=window.ApplyPilotIntake?.getProfile()||{};
  $('#intakeFields').innerHTML=Object.entries(result.fields).map(([key,value])=>`<article class="rewrite-row"><label><input type="checkbox" data-import-key="${key}" ${current[key]?'':'checked'}> ${escape(label(key))}${current[key]?' · 已有内容，默认不覆盖':''}</label><textarea rows="${value.length>120?5:2}" data-import-value="${key}">${escape(value)}</textarea><small>${escape(result.evidence[key].confidence)}</small><details><summary>查看原文依据${current[key]?'及当前值':''}</summary><p style="white-space:pre-wrap">${escape(result.evidence[key].source)}</p>${current[key]?`<p>当前值：${escape(current[key])}</p>`:''}</details></article>`).join('');
  $('#intakeUnmapped').textContent=result.unmapped.join('\n')||'没有未归类的文字；仍需核对字段内容。';
  $('#intakeStatus').textContent=`识别出 ${Object.keys(result.fields).length} 项字段。${result.warnings.join(' ')}`;
  $('#intakeReview').classList.remove('hidden');
}
$('#resumeIntake').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;e.target.disabled=true;$('#applyIntake').disabled=true;
  try {
    $('#intakeStatus').textContent='正在本机读取…';const result=await readDocument(file,s=>$('#intakeStatus').textContent=s);
    $('#intakeText').value=result.text;render();$('#intakeStatus').textContent=result.method+'。'+$('#intakeStatus').textContent;
    if(result.template)document.dispatchEvent(new CustomEvent('applypilot-template-loaded',{detail:{template:result.template,name:file.name}}));
  }catch(error){$('#intakeStatus').textContent=error.message;}finally{e.target.disabled=false;e.target.value='';$('#applyIntake').disabled=false;}
});
$('#reparseIntake').addEventListener('click',()=>{try{render();}catch(error){$('#intakeStatus').textContent=error.message;}});
$('#applyIntake').addEventListener('click',()=>{
  const fields={};for(const box of document.querySelectorAll('[data-import-key]:checked'))fields[box.dataset.importKey]=$(`[data-import-value="${box.dataset.importKey}"]`).value;
  try{if(!Object.keys(fields).length)throw Error('请勾选要写入的字段');window.ApplyPilotIntake.apply(fields);$('#intakeStatus').textContent='所选字段已写入主档案，请完成最后核对。';$('#intakeReview').classList.add('hidden');}catch(error){$('#intakeStatus').textContent=error.message;}
});
$('#jdImage').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;e.target.disabled=true;$('#applyJdImage').disabled=true;
  try{const result=await readDocument(file,s=>$('#jdImageStatus').textContent=s);$('#jdImageText').value=result.text;$('#jdImageReview').classList.remove('hidden');$('#jdImageStatus').textContent=result.method+'。请核对岗位名称、职责和任职条件。';}catch(error){$('#jdImageStatus').textContent=error.message;}finally{e.target.disabled=false;e.target.value='';$('#applyJdImage').disabled=false;}
});
$('#applyJdImage').addEventListener('click',()=>{$('#jdInput').value=$('#jdImageText').value;$('#jdInput').dispatchEvent(new Event('input',{bubbles:true}));$('#jdImageReview').classList.add('hidden');$('#jdImageStatus').textContent='已填入 JD，可继续编辑并生成岗位版简历。';});
