import {PROFILE_FIELDS, cleanProfile, createPayload, educationEntries, evidenceText, truthfulSummary, keywordCoverage, nextVersion} from './profile-core.mjs';
import {convertToPdf, PDF_LIMITS} from './pdf-tools.mjs';
import {rewriteParagraph,validateRewrite} from './resume-rewrite.mjs';
const CLOUD_MODE = location.protocol !== 'chrome-extension:' && new URLSearchParams(location.search).get('mode') === 'cloud';
const profileStore = CLOUD_MODE ? sessionStorage : localStorage;
const storageKey = key => key.replace('applypilot-', CLOUD_MODE ? 'applypilot-cloud-' : 'applypilot-guest-');
const PROFILE_SCHEMA_VERSION = 4;

const DEFAULT_PROFILE = Object.fromEntries(PROFILE_FIELDS.map(key => [key, ""]));
Object.assign(DEFAULT_PROFILE, {
  __schemaVersion: PROFILE_SCHEMA_VERSION,
  countryRegion: "中国大陆",
  nationality: "中国",
  jobType: "全职",
  photoStatus: "投递时手动上传",
});

const DEMO_JD = `AI 医药产品经理（应届/校招）
岗位职责：
1. 参与 AI 科研助手、知识库和 Agent 产品的需求分析、产品设计与迭代；
2. 深入生命科学与药物研发用户场景，完成用户访谈、竞品分析、PRD 和项目推进；
3. 与算法、研发及生物信息团队协作，持续优化大模型回答质量、知识图谱与多组学分析体验；
4. 基于数据指标评估产品效果，推动功能落地。
任职要求：
1. 生物医药、计算生物学、药学或相关硕士学历；
2. 理解大模型、AI Agent、RAG、知识图谱等技术，有 AI 产品或科研项目经验；
3. 具备优秀的逻辑分析、文献调研、沟通协作与结构化表达能力；
4. 掌握 Python、SQL 或数据分析工具者优先；有单细胞、多组学、靶点发现经验者加分。`;

const KEYWORD_ALIASES = {
  "采购": ["采购","procurement","purchasing"], "供应商沟通":["供应商","supplier"], "订单跟进":["订单","purchase order"], "入库核对":["入库","到货","库存","inventory"], "GMP":["gmp"], "流程规范":["流程规范","记录完整","可追溯"],
  "AI产品": ["ai产品", "ai 产品", "人工智能产品"], "产品经理": ["产品经理", "产品设计"],
  "需求分析": ["需求分析", "需求拆解"], "用户研究": ["用户访谈", "用户研究", "用户需求"],
  "竞品分析": ["竞品分析", "竞品调研"], "PRD": ["prd", "产品需求文档"], "原型设计": ["原型", "axure", "figma"],
  "项目推进": ["项目推进", "项目管理", "推动落地", "项目交付"], "跨团队协作": ["跨团队", "跨部门", "团队协作", "协同"],
  "数据指标": ["数据指标", "产品指标", "数据分析"], "大模型": ["大模型", "llm"], "AI Agent": ["ai agent", "智能体", "agent"],
  "RAG": ["rag", "检索增强"], "知识库": ["知识库"], "知识图谱": ["知识图谱", "knowledge graph"],
  "多组学": ["多组学", "multi-omics"], "单细胞": ["单细胞", "single-cell"], "空间组学": ["空间转录组", "空间组学", "spatial"],
  "计算生物学": ["计算生物学", "computational biology"], "生物信息学": ["生物信息", "bioinformatics"],
  "靶点发现": ["靶点发现", "target discovery"], "靶点优先排序": ["靶点优先", "target priorit"],
  "药物研发": ["药物研发", "药物发现", "制药"], "生命科学": ["生命科学", "生物医药", "药学"],
  "肿瘤免疫": ["肿瘤免疫"], "HCC": ["hcc", "肝癌", "肝细胞癌"], "TAM": ["tam", "肿瘤相关巨噬细胞"],
  "Python": ["python"], "R": ["r语言", " r ", "r/python"], "SQL": ["sql"], "Scanpy": ["scanpy"],
  "机器学习": ["机器学习", "machine learning", "ml模型"], "深度学习": ["深度学习", "deep learning"],
  "可解释AI": ["可解释", "xai"], "统计分析": ["统计分析", "统计学"], "数据可视化": ["数据可视化", "可视化"],
  "流式细胞术": ["流式", "flow cytometry"], "Western Blot": ["western blot", "wb"], "ELISA": ["elisa"],
  "细胞实验": ["细胞实验", "细胞培养"], "动物实验": ["动物实验", "小鼠模型"], "纳米药物": ["纳米药物", "纳米制剂"],
  "文献调研": ["文献调研", "文献检索", "行业研究"], "沟通协作": ["沟通协作", "沟通能力"],
  "结构化表达": ["结构化表达", "逻辑分析", "逻辑能力"], "英语": ["英语", "英文", "cet-6", "六级"],
  "客户需求": ["客户需求", "售前", "解决方案", "客户沟通"], "培训演示": ["产品培训", "产品演示", "技术支持"],
  "注册申报": ["注册申报", "法规", "药品注册"], "Office": ["office", "excel", "powerpoint"], "交互设计":["交互设计","interaction design"], "视觉设计":["视觉设计","ui设计"], "JavaScript":["javascript","typescript"], "React":["react"], "内容运营":["内容运营","社群运营"], "软件测试":["软件测试","自动化测试"], "Java":["java开发","java 后端"]
};

const TRACKS = {
  product: {label:"AI / 产品方向", signals:["产品","需求","用户","prd","迭代","竞品","原型","功能","指标"], positioning:"以档案中已有经历为依据", primaryEvidence:"与岗位关键词相关的已有项目和经历", focus:["AI产品","需求分析","项目推进","跨团队协作","数据指标","大模型","AI Agent","生命科学"], summary:"突出领域理解、复杂问题拆解、AI辅助分析与项目推进，不虚构正式产品经理经历。"},
  computational: {label:"计算生物 / 生信方向", signals:["生物信息","计算生物","多组学","单细胞","python","r语言","算法","模型","数据分析","靶点"], positioning:"以档案中已有经历为依据", primaryEvidence:"与岗位关键词相关的已有项目和经历", focus:["计算生物学","生物信息学","多组学","Python","R","机器学习","靶点优先排序","数据可视化"], summary:"前置数据分析、外部验证和可解释证据链，同时如实标注编程能力层级。"},
  research: {label:"实验研发方向", signals:["细胞实验","动物实验","药效","实验设计","肿瘤","免疫","研发","western","流式","elisa"], positioning:"以档案中已有经历为依据", primaryEvidence:"与岗位关键词相关的已有项目和经历", focus:["肿瘤免疫","HCC","TAM","流式细胞术","Western Blot","ELISA","细胞实验","动物实验"], summary:"前置实验模型、技术平台与机制验证，保留所有实验数字和边界。"},
  solutions: {label:"应用科学 / 解决方案", signals:["应用科学","解决方案","客户","售前","技术支持","培训","演示","交付","scientific"], positioning:"以档案中已有经历为依据", primaryEvidence:"与岗位关键词相关的已有项目和经历", focus:["客户需求","培训演示","沟通协作","文献调研","生命科学","数据可视化","项目推进","英语"], summary:"强调跨学科翻译、文献检索、研究表达和问题定位，不夸大客户项目经验。"},
  operations: {label:"项目运营 / 职能方向", signals:["运营","行政","项目管理","协调","组织","活动","流程","报表","office"], positioning:"以档案中已有经历为依据", primaryEvidence:"与岗位关键词相关的已有项目和经历", focus:["项目推进","沟通协作","Office","数据可视化","文献调研","结构化表达"], summary:"前置组织协调、材料整理和多任务推进，专业研究作为逻辑与学习能力证据。"}
};

if (CLOUD_MODE) { for (const key of ["profile","applications","versions","last-result"]) profileStore.removeItem(storageKey(`applypilot-${key}`)); }
let profile = loadProfile();
let currentResult = null;
let applications = loadLocalApplications();
let attachments = [];
let toastTimer;
let saveLabelTimer;

let cloudSaveTimer;
let cloudAvailable = false;
let cloudReady = !CLOUD_MODE;

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const normalize = value => String(value || "").toLowerCase();

function loadProfile() {
  try {
    const stored = JSON.parse(profileStore.getItem(storageKey("applypilot-profile")) || "{}");
    const migrated = {...DEFAULT_PROFILE, ...cleanProfile(stored, {includeSensitive:true}), __schemaVersion:PROFILE_SCHEMA_VERSION};
    return migrated;
  } catch { return {...DEFAULT_PROFILE}; }
}

function loadLocalApplications() {
  try { return JSON.parse(profileStore.getItem(storageKey("applypilot-applications")) || "[]"); }
  catch { return []; }
}

function saveProfileData() {
  profile.__schemaVersion = PROFILE_SCHEMA_VERSION;
  try {
    profileStore.setItem(storageKey("applypilot-profile"), JSON.stringify(profile));
    updateProfileUI();
    pulseSaved();
    clearTimeout(cloudSaveTimer);
    if (cloudAvailable) cloudSaveTimer = setTimeout(syncProfileToCloud, 650);
    return true;
  } catch {
    $("#saveLabel").textContent = "保存失败";
    $("#profileSaveState").textContent = "当前浏览器无法保存，请检查隐私设置后重试";
    showToast("保存失败，请检查浏览器是否允许本地存储");
    return false;
  }
}

window.ApplyPilotIntake={
  getProfile:()=>({...profile}),
  apply:fields=>{
    if(!cloudReady)throw new Error('正在读取档案，请稍后再试');
    const previous=profile;profile={...profile,...cleanProfile(fields,{includeSensitive:true})};
    if(!saveProfileData()){profile=previous;throw new Error('保存失败，未应用导入结果');}
    invalidateResult();openProfile();
  }
};

let rewriteEpoch=0,pendingDraft=null;
function clearRewriteDraft(){rewriteEpoch++;pendingDraft=null;$('#applyProfileDraft').hidden=true;$('#rewriteComparison').replaceChildren();}
$('#jdInput').addEventListener('input',clearRewriteDraft);
$('#rewriteProfileVersion').addEventListener('click',async()=>{
  const result=currentResult,button=$('#rewriteProfileVersion'),status=$('#profileRewriteStatus');
  if(!result){status.textContent='请先导入并核对主档案、填写 JD，再生成岗位版';return;}
  if(!$('#allowProfileRewrite').checked){status.textContent='请先同意发送简历内容';return;}
  if($('#jdInput').value.trim()!==result.jd){status.textContent='JD 已变化，请先重新生成岗位版';return;}
  button.disabled=true;const source=JSON.stringify(profile),epoch=++rewriteEpoch,instruction=$('#rewriteInstruction').value.trim();
  try {
    const keys=['summary','experience1Description','experience2Description','internshipDescription','project1','project2','skills','english','tools','otherExperience'].filter(k=>profile[k]?.trim());
    if(!keys.length)throw Error('主档案中还没有可改写的经历，请先补充');
    const paragraphs=keys.map((key,id)=>({id,original:profile[key]}));
    const context=[...paragraphs,...['school','major','degree','experience1Role','experience2Role','internshipRole','project1Title','project2Title'].filter(k=>profile[k]).map((k,i)=>({id:100+i,original:`${k}: ${profile[k]}`}))];
    let base='';const configured=$('#profileServiceUrl').value.trim()||$('#rewriteServiceUrl').value.trim()||(location.protocol==='chrome-extension:'?'https://applypilot-ai.meiqi011216.chatgpt.site':'');
    if(configured){const url=new URL(configured);if(url.protocol!=='https:')throw Error('生成服务必须使用 HTTPS');base=url.origin;if(location.protocol==='chrome-extension:'&&!(await chrome.permissions.request({origins:[`${url.protocol}//${url.hostname}/*`]})))throw Error('未授权访问生成服务');}
    else if(location.protocol==='chrome-extension:')throw Error('插件中请填写部署方提供的生成服务地址，或使用网站的生成服务');
    status.textContent='正在生成实际替换内容…';
    const previous=pendingDraft?.result===result?pendingDraft.fields:result.rewrittenFields;
    const draft=previous?keys.map((key,id)=>({id,optimized:previous[key]||profile[key]})):undefined;
    const response=await fetch(`${base}/api/resume/rewrite`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:'applypilot-rewrite-v1',jd:result.jd,paragraphs,context,instruction,draft}),signal:AbortSignal.timeout(55000)});
    const data=await response.json();if(!response.ok)throw Error(data.error||'生成失败');
    if(currentResult!==result||JSON.stringify(profile)!==source||rewriteEpoch!==epoch||$('#jdInput').value.trim()!==result.jd)throw Error('档案或岗位已变化，生成结果未覆盖当前内容');
    if(!Array.isArray(data.paragraphs)||data.paragraphs.length!==keys.length)throw Error('服务返回的段落不完整');
    const next={},ids=new Set();for(const p of data.paragraphs){if(!Number.isInteger(p.id)||!keys[p.id]||ids.has(p.id))throw Error('服务返回段落编号错误');ids.add(p.id);next[keys[p.id]]=validateRewrite(profile[keys[p.id]],p.optimized);}
    if(keys.every(k=>next[k]===profile[k]))throw Error('没有生成实际修改');
    pendingDraft={result,fields:next,source,epoch};
    const comparison=$('#rewriteComparison');comparison.replaceChildren();
    for(const key of keys){const block=document.createElement('section');const label=document.querySelector(`[data-profile="${key}"]`)?.closest('label')?.textContent.trim()||key;const title=document.createElement('h4');title.textContent=label;const before=document.createElement('p');before.textContent='原文：'+profile[key];const after=document.createElement('p');after.textContent='修改稿：'+next[key];block.append(title,before,after);comparison.append(block);}
    const turn=document.createElement('p');turn.textContent=`你的要求：${instruction||'按 JD 优化正文'} → 已生成待核对稿`;$('#rewriteConversation').append(turn);
    $('#applyProfileDraft').hidden=false;status.textContent='已生成待核对正文，尚未替换岗位版。可继续提出修改要求，或核对后应用。';
  }catch(error){status.textContent=error.message;}finally{button.disabled=false;}
});
$('#applyProfileDraft').addEventListener('click',async()=>{
  const draft=pendingDraft;if(!draft)return;
  if(draft.result!==currentResult||draft.source!==JSON.stringify(profile)||draft.epoch!==rewriteEpoch||$('#jdInput').value.trim()!==draft.result.jd){clearRewriteDraft();$('#profileRewriteStatus').textContent='内容已变化，请重新生成';return;}
  currentResult.rewrittenFields=draft.fields;clearRewriteDraft();renderResult();saveApplicationVersion(currentResult);await persistApplication(currentResult);$('#profileRewriteStatus').textContent='岗位版正文已更新。主档案保持原文，请核对后导出 Word。';switchTab('resume');
});
$('#restoreProfileVersion').addEventListener('click',()=>{clearRewriteDraft();if(currentResult){delete currentResult.rewrittenFields;renderResult();saveApplicationVersion(currentResult);persistApplication(currentResult);$('#profileRewriteStatus').textContent='已恢复本机生成版本';}});

async function apiJson(url, options = {}) {
  if (!CLOUD_MODE) throw new Error("当前为本机模式；云端功能需要单独部署和登录");
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload;
}

async function syncProfileToCloud() {
  if (!cloudAvailable) return;
  try {
    $("#saveLabel").textContent = "正在同步…";
    await apiJson("/api/profile", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({profile}) });
    $("#saveLabel").textContent = "档案已同步";
    $("#profileSaveState").textContent = "已实时保存并同步；点击空白处或按 Esc 不会关闭";
  } catch (error) {
    cloudAvailable = false;
    $("#saveLabel").textContent = "仅本机保存";
    $("#profileSaveState").textContent = `本机已保存；云端同步暂不可用（${error.message}）`;
  }
}

async function hydrateCloudData() {
  if (!CLOUD_MODE) return;
  try {
    const [profilePayload, applicationsPayload, attachmentsPayload] = await Promise.all([
      apiJson("/api/profile"), apiJson("/api/applications"), apiJson("/api/attachments"),
    ]);
    if (profilePayload.profile) {
      profile = {...DEFAULT_PROFILE, ...profilePayload.profile, __schemaVersion:PROFILE_SCHEMA_VERSION};
      profileStore.setItem(storageKey("applypilot-profile"), JSON.stringify(profile));
    }
    applications = applicationsPayload.applications || [];
    attachments = attachmentsPayload.attachments || [];
    cloudAvailable = true;
    cloudReady = true;
    profileStore.setItem(storageKey("applypilot-applications"), JSON.stringify(applications));
    updateProfileUI();
    renderApplications();
    renderAttachments();
    await Promise.all([loadDevices(), loadEvents()]);
    $("#saveLabel").textContent = "档案已同步";
  } catch {
    cloudAvailable = false;
    cloudReady = true;
    $("#saveLabel").textContent = "仅本机保存";
    renderApplications();
    renderAttachments();
  }
}

function getProfileText() { return evidenceText(profile); }

function hasTerm(text, term) { return (KEYWORD_ALIASES[term] || [term]).some(alias => normalize(text).includes(normalize(alias))); }

function profileCompleteness() {
  const required = ["name","phone","email","school","degree","major","skills","summary"];
  const filled = required.filter(key => String(profile[key] || "").trim()).length;
  return Math.round(filled / required.length * 100);
}

function priorityMissingFields() {
  const labels = {city:"现居城市",availableDate:"到岗时间",portfolio:"作品集",masterRank:"学习成绩排名",experience2Description:"第二段经历职责（如有）"};
  return Object.entries(labels).filter(([key]) => !String(profile[key] || "").trim()).map(([,label]) => label);
}

function updateProfileUI() {
  const percent = profileCompleteness();
  $("#headerName").textContent = profile.name || "未命名档案";
  $(".avatar").textContent = (profile.name || "求").slice(0,1);
  $("#profilePercent").textContent = percent;
  $(".health-ring").style.setProperty("--profile", percent);
  $("#profileStepMeta").textContent = percent === 100 ? "核心字段完整" : `${percent}% 已完成`;
  const missing = priorityMissingFields();
  $("#profileHint").textContent = missing.length ? `建议补充${missing.slice(0,2).join("、")}` : "可生成完整岗位版本";
}

function pulseSaved() {
  clearTimeout(saveLabelTimer);
  $("#saveLabel").textContent = "正在保存…";
  $("#profileSaveState").textContent = "正在实时保存…";
  saveLabelTimer = setTimeout(() => {
    $("#saveLabel").textContent = cloudAvailable ? "本机已保存 · 等待同步" : "仅本机保存";
    $("#profileSaveState").textContent = cloudAvailable ? "本机已实时保存，正在同步云端…" : "已实时保存在本机；点击空白处或按 Esc 不会关闭";
  }, 350);
}
function showToast(message) { clearTimeout(toastTimer); const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); toastTimer = setTimeout(() => toast.classList.remove("show"), 2500); }

function openProfile() {
  if (!cloudReady) { showToast("正在读取云端档案，请稍后编辑"); return; }
  $$('[data-profile]').forEach(element => element.value = profile[element.dataset.profile] || "");
  $("#profileDialog").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $('[data-profile="name"]').focus();
}
function closeProfile() { $("#profileDialog").classList.add("hidden"); document.body.style.overflow = ""; }

function saveProfileField(element) {
  profile[element.dataset.profile] = element.value;
  if (!saveProfileData()) return;
  invalidateResult();
}

function extractKeywords(jd) { return Object.keys(KEYWORD_ALIASES).filter(term => hasTerm(jd, term)).slice(0, 22); }

function detectTrack(jd, override = "auto") {
  if (override !== "auto" && TRACKS[override]) return override;
  const text = normalize(jd);
  const firstLine = text.split("\n").map(line => line.trim()).find(Boolean) || "";
  if(/采购|供应链|procurement|purchasing/.test(firstLine))return 'operations';
  if (/应用科学|application scientist|解决方案|售前|技术支持/.test(firstLine)) return "solutions";
  if (/产品经理|产品运营|product manager/.test(firstLine)) return "product";
  if (/生物信息|计算生物|bioinformatic|computational/.test(firstLine)) return "computational";
  if (/研发|研究员|实验|药效|research scientist/.test(firstLine)) return "research";
  if (/运营|行政|项目专员|项目管理/.test(firstLine)) return "operations";
  const ranked = Object.entries(TRACKS).map(([key, track]) => ({key, score:track.signals.reduce((sum, signal) => sum + (text.includes(normalize(signal)) ? 1 : 0), 0)})).sort((a,b) => b.score - a.score);
  return ranked[0]?.score ? ranked[0].key : "solutions";
}

function evaluateHardRequirements(jd) {
  const text = normalize(jd);
  const requirements = [];
  const push = (label, status) => requirements.push({label, status});
  if (/博士|phd|doctor/.test(text)) push("博士学历", /博士/.test(profile.degree) ? "met" : "gap");
  else if (/硕士|研究生|master/.test(text)) push("硕士学历", /硕士|博士/.test(profile.degree) ? "met" : "unknown");
  else if (/本科|学士|bachelor/.test(text)) push("本科及以上", /本科|学士|硕士|博士/.test(`${profile.degree} ${profile.bachelorDegree}`) ? "met" : "unknown");
  if (/生物|医药|药学|制药|生命科学/.test(text)) push("生物医药相关专业", /制药|药学|生物/.test(`${profile.major}${profile.bachelorMajor}`) ? "met" : "gap");
  const years = [...text.matchAll(/(\d+)\s*(?:年|年以上).*?(?:经验|经历)/g)].map(match => Number(match[1])).filter(Boolean);
  if (years.length) push(`${Math.max(...years)}年以上经验`, /应届/.test(profile.workYears) ? "gap" : "unknown");
  if (/熟练.{0,8}python|精通.{0,8}python|python.{0,8}(?:熟练|精通)/.test(text)) push("熟练 Python", "unknown");
  else if (/python/.test(text)) push("Python", /python/i.test(profile.skills) ? "met" : "gap");
  if (/\bsql\b/.test(text)) push("SQL", /\bsql\b/i.test(profile.skills) ? "met" : "gap");
  if (/英语|英文|cet-6|六级/.test(text)) push("英语能力", /cet-6|六级|英语/i.test(`${profile.english}${profile.certifications}`) ? "met" : "unknown");
  if (!requirements.length) push("未识别到明确硬门槛", "unknown");
  return requirements.slice(0,6);
}

function nextVersionNumber() {
  try { return nextVersion(JSON.parse(profileStore.getItem(storageKey("applypilot-versions")) || "[]")); }
  catch { return 1; }
}
function scoreResult(keywords, matched) { return keywordCoverage(keywords, matched); }
function invalidateResult() {
  clearRewriteDraft();$('#rewriteConversation').replaceChildren();
  if (currentResult) { currentResult = null; $("#results").classList.add("hidden"); showToast("档案已变化，请重新分析岗位；历史记录保留原版本"); }
  if (globalThis.chrome?.storage?.local) chrome.storage.local.remove('applypilotPayload');
}

function analyzeJD() {
  clearRewriteDraft();$('#rewriteConversation').replaceChildren();
  if (!cloudReady) { showToast("正在读取云端档案，请稍后生成"); return; }
  if (!profile.name.trim()) { showToast("请先填写姓名和真实经历，再生成简历"); openProfile(); return; }
  const jd = $("#jdInput").value.trim();
  if (jd.length < 40) { showToast("请粘贴更完整的岗位 JD（至少 40 字）"); $("#jdInput").focus(); return; }
  const company = $("#companyInput").value.trim() || "目标公司";
  const role = $("#roleInput").value.trim() || inferRole(jd);
  if (!$("#roleInput").value.trim()) $("#roleInput").value = role;
  const track = detectTrack(jd, $("#trackSelect").value);
  const keywords = extractKeywords(jd);
  const profileText = getProfileText();
  const matched = keywords.filter(term => hasTerm(profileText, term));
  const missing = keywords.filter(term => !matched.includes(term));
  const hardRequirements = evaluateHardRequirements(jd);
  const score = scoreResult(keywords, matched, hardRequirements, track);
  currentResult = {id:crypto.randomUUID(), jd, company, role, track, keywords, matched, missing, hardRequirements, score, versionNo:nextVersionNumber(), generatedAt:new Date().toISOString(), status:"待投递", platform:"待确认", applicationUrl:""};
  saveApplicationVersion(currentResult);
  renderResult();
  persistApplication(currentResult);
}

function inferRole(jd) {
  const firstLine = jd.split("\n").map(line => line.trim()).find(Boolean) || "目标岗位";
  if (firstLine.length < 34) return firstLine.replace(/[：:].*$/, "");
  const track = detectTrack(jd);
  return {product:"产品岗位", computational:"计算与数据岗位", research:"研发岗位", solutions:"解决方案岗位", operations:"项目运营岗位"}[track];
}

function saveApplicationVersion(result) {
  try {
    const versions = JSON.parse(profileStore.getItem(storageKey("applypilot-versions")) || "[]");
    versions.unshift({company:result.company, role:result.role, track:result.track, score:result.score, generatedAt:result.generatedAt, jd:result.jd, versionNo:result.versionNo});
    profileStore.setItem(storageKey("applypilot-versions"), JSON.stringify(versions.slice(0,20)));
    profileStore.setItem(storageKey("applypilot-last-result"), JSON.stringify(result));
  } catch {}
}

function renderResult() {
  const result = currentResult;
  const track = TRACKS[result.track];
  $("#results").classList.remove("hidden");
  $("#scoreGauge").style.setProperty("--score", result.score);
  $("#matchScore").textContent = result.score;
  $("#versionLabel").textContent = `岗位专属 V${String(result.versionNo).padStart(2,"0")}`;
  $("#scoreTitle").textContent = `${result.role} · 关键词提及率 ${result.score}%`;
  $("#scoreCopy").textContent = `${result.company}｜规则匹配，仅统计提及，不代表能力熟练度或录用概率`;
  $("#coveredCount").textContent = result.matched.length;
  $("#coveredLabel").textContent = `共识别 ${result.keywords.length} 个核心词`;
  $("#gapCount").textContent = result.missing.length;
  renderChips("#matchedKeywords", result.matched, "暂无明确覆盖，请先完善主档案");
  renderChips("#missingKeywords", result.missing, "关键要求已基本覆盖");
  $("#recommendations").innerHTML = buildRecommendations(result).map(item => `<li>${escapeHtml(item)}</li>`).join("");
  $("#trackBadge").textContent = track.label;
  $("#positioningText").textContent = track.positioning;
  $("#primaryEvidenceText").textContent = track.primaryEvidence;
  $("#changeCountText").textContent = "按岗位词排序已有项目、经历和技能";
  $("#excludeText").textContent = result.missing.length ? `不写 ${result.missing.slice(0,2).join(" / ")}` : "不写无证据能力";
  $("#hardRequirements").innerHTML = result.hardRequirements.map(item => `<span class="requirement-pill ${item.status}">${item.status === "met" ? "✓" : item.status === "gap" ? "!" : "?"} ${escapeHtml(item.label)}</span>`).join("");
  $("#resumeFileName").textContent = `${result.company}-${result.role}-${profile.name || "候选人"}-V${String(result.versionNo).padStart(2,"0")}`;
  $("#resumePreview").innerHTML = buildResumeHTML(result);
  $("#structuredOutput").textContent = JSON.stringify(buildStructuredOutput(result), null, 2);
  $("#results").scrollIntoView({behavior:"smooth", block:"start"});
}

function renderChips(selector, items, emptyText) { $(selector).innerHTML = items.length ? items.map(item => `<span class="chip">${escapeHtml(item)}</span>`).join("") : `<span class="chip">${escapeHtml(emptyText)}</span>`; }

function buildRecommendations(result) {
  const tips = [];
  const hardGaps = result.hardRequirements.filter(item => item.status === "gap");
  if (hardGaps.length) tips.push(`先核对硬门槛：${hardGaps.map(item => item.label).join("、")}。这类缺口不能靠关键词改写解决。`);
  tips.push(TRACKS[result.track].summary);
  if (result.missing.length) tips.push(`JD 提到“${result.missing.slice(0,3).join("、")}”，但主档案暂时没有证据；有真实经历再补充，否则保持缺失。`);
  tips.push("本次已单独生成岗位定位、摘要、项目顺序与技能顺序；导出文件名含公司和岗位，避免错投通用版本。");
  return tips.slice(0,3);
}

function resumeProfile(result) {return {...profile,...(result?.rewrittenFields||{})};}
function projectEntries(result) {
  const profile=resumeProfile(result);
  const entries = [
    {title:profile.project1Title, role:profile.project1Role, dates:profile.project1Dates, description:profile.project1, tags:profile.project1Tags},
    {title:profile.project2Title, role:profile.project2Role, dates:profile.project2Dates, description:profile.project2, tags:profile.project2Tags}
  ].filter(item => item.title && item.description);
  return entries.sort((a,b) => {
    const score = item => result.keywords.reduce((sum, keyword) => sum + (hasTerm(`${item.title} ${item.description} ${item.tags}`, keyword) ? 1 : 0), 0);
    return score(b) - score(a);
  });
}

function experienceEntries(result) {
  const profile=resumeProfile(result);
  const entries = [
    {org:profile.experience1Org, role:profile.experience1Role, department:profile.experience1Department, start:profile.experience1Start, end:profile.experience1End, description:profile.experience1Description},
    {org:profile.experience2Org, role:profile.experience2Role, department:profile.experience2Department, start:profile.experience2Start, end:profile.experience2End, description:profile.experience2Description},
    {org:profile.internshipOrg, role:profile.internshipRole, department:profile.internshipDepartment, start:profile.internshipStart, end:profile.internshipEnd, description:profile.internshipDescription}
  ].filter(item => item.org && item.role);
  const score = item => (result.keywords || []).filter(term => hasTerm(`${item.org} ${item.role} ${item.description}`, term)).length;
  return entries.sort((a,b) => score(b)-score(a));
}

function sentenceBullets(text, result) {
  const bullets = String(text || "").split(/[；;。]/).map(item => item.trim()).filter(Boolean);
  const score = bullet => result.keywords.reduce((sum, keyword) => sum + (hasTerm(bullet, keyword) ? 1 : 0), 0);
  return bullets.sort((a,b) => score(b) - score(a)).map(bullet => rewriteParagraph(bullet,result.jd));
}

function buildProjectsSection(result) {
  return `<section class="resume-section"><h3>核心项目</h3>${projectEntries(result).map(item => `<div class="resume-row"><header><b>${escapeHtml(item.title)}</b><span>${escapeHtml([item.role,item.dates].filter(Boolean).join(" ｜ "))}</span></header><ul>${sentenceBullets(item.description, result).map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul></div>`).join("")}</section>`;
}

function buildExperienceSection(result) {
  const entries = experienceEntries(result).filter(item => item.description || result.track === "operations");
  if (!entries.length) return "";
  return `<section class="resume-section"><h3>相关经历</h3>${entries.map(item => `<div class="resume-row"><header><b>${escapeHtml(item.org)} · ${escapeHtml(item.role)}</b><span>${escapeHtml([item.start,item.end].filter(Boolean).join(" – "))}</span></header>${item.department ? `<p>${escapeHtml(item.department)}</p>` : ""}${item.description ? `<ul>${sentenceBullets(item.description, result).map(bullet => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</section>`;
}

function rankSkills(result) {
  return String(resumeProfile(result).skills||'').split(/[，,、\n]/).map(s=>s.trim()).filter(Boolean).sort((a,b) => {
    const aScore = hasTerm(result.jd, a) ? 2 : TRACKS[result.track].focus.some(term => hasTerm(a, term)) ? 1 : 0;
    const bScore = hasTerm(result.jd, b) ? 2 : TRACKS[result.track].focus.some(term => hasTerm(b, term)) ? 1 : 0;
    return bScore - aScore;
  });
}

function tailoredSummary(result) { return result.rewrittenFields?.summary || rewriteParagraph(truthfulSummary(profile, result.keywords),result.jd); }

function buildResumeHTML(result) {
  const profile=resumeProfile(result);
  const contact = [profile.phone, profile.email, profile.city, profile.portfolio].filter(Boolean).map(escapeHtml).join("<br>") || "请在主档案补充联系方式";

  const skills = rankSkills(result).slice(0,16);
  const projectSection = buildProjectsSection(result);
  const experienceSection = buildExperienceSection(result);
  const mainSections = result.track === "operations" ? experienceSection + projectSection : projectSection + experienceSection;
  return `
    <div class="resume-head"><div><h2>${escapeHtml(profile.name || "姓名")}</h2><p>应聘：${escapeHtml(result.role)}</p></div><div class="contact">${contact}</div></div>
    <section class="resume-section"><h3>岗位摘要</h3><p>${escapeHtml(tailoredSummary(result))}</p></section>
    ${educationEntries(profile).length ? `<section class="resume-section"><h3>教育背景</h3>${educationEntries(profile).map(item => `<div class="resume-row"><header><b>${escapeHtml([item.school,item.major,item.degree].filter(Boolean).join(" · "))}</b><span>${escapeHtml([item.start,item.end].filter(Boolean).join(" – "))}</span></header><p>${escapeHtml([item.gpa,item.rank,item.studyType,item.courses].filter(Boolean).join(" ｜ "))}</p></div>`).join("")}</section>` : ""}
    ${mainSections}
    ${profile.otherExperience?`<section class="resume-section"><h3>校园经历与补充经历</h3><p style="white-space:pre-wrap">${escapeHtml(profile.otherExperience)}</p></section>`:''}
    <section class="resume-section"><h3>技能与成果</h3><div class="skill-line"><b>专业技能</b><span>${escapeHtml(skills.join("、"))}</span></div><div class="skill-line"><b>语言工具</b><span>${escapeHtml([profile.english,profile.tools].filter(Boolean).join("；"))}</span></div>${profile.publications ? `<div class="skill-line"><b>研究成果</b><span>${escapeHtml(profile.publications)}</span></div>` : ""}</section>
  `;
}

function switchTab(name) {
  $$(".tab").forEach(tab => { const active = tab.dataset.tabTarget === name; tab.classList.toggle("active", active); tab.setAttribute("aria-selected", active); });
  [["analysis","#analysisPanel"],["resume","#resumePanel"],["autofill","#autofillPanel"],["json","#jsonPanel"],["status","#statusPanel"]].forEach(([key,selector]) => $(selector).classList.toggle("hidden", key !== name));
  if (["autofill","status"].includes(name) && !currentResult) $("#results").classList.remove("hidden");
  if (name === "status") renderApplications();
}

function resumePlainText() { if (!currentResult) return ""; const temp = document.createElement("div"); temp.innerHTML = buildResumeHTML(currentResult); return temp.innerText; }

function exportWord() {
  if (!currentResult) { showToast("请先分析一个岗位"); return; }
  const version = `V${String(currentResult.versionNo).padStart(2,"0")}`;
  if (!window.ApplyPilotDocx) { showToast("Word 组件加载失败，请刷新后重试"); return; }
  const blob = window.ApplyPilotDocx.create(buildDocxPayload(currentResult));
  downloadBlob(blob, safeFileName(`${currentResult.company}-${currentResult.role}-${profile.name || "候选人"}-${version}.docx`));
  showToast("真正的 .docx 已导出，请提交前人工核对");
}

function safeFileName(name) { return name.replace(/[\\/:*?"<>|]/g, "-"); }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }

function autofillPayload() {
  return createPayload(currentResult?resumeProfile(currentResult):profile, {targetRole:currentResult?.role || "",targetCompany:currentResult?.company || "",selfIntroduction:currentResult ? tailoredSummary(currentResult) : profile.summary});
}

function onlineFormFields(result, source = profile) {
  const profile = cleanProfile(source);
  const fieldMap = [
    ["应聘公司", result.company], ["应聘岗位 / 岗位名称", result.role], ["姓名 / 中文姓名", profile.name], ["英文姓名", profile.englishName],
    ["手机号码", profile.phone], ["邮箱", profile.email], ["性别", profile.gender], ["出生日期", profile.birthDate], ["国籍", profile.nationality],
    ["国家 / 地区", profile.countryRegion], ["现居城市", profile.city], ["户籍所在地", profile.householdRegistration], ["籍贯", profile.nativePlace],
    ["现居详细地址", profile.currentAddress], ["邮政编码", profile.postalCode], ["微信 / 其他联系方式", profile.wechat], ["个人主页 / 作品集", profile.portfolio],
    ["工作年限", profile.workYears], ["当前单位", profile.currentEmployer], ["求职类型", profile.jobType], ["求职状态", profile.status],
    ["期望岗位", profile.targetRoleFamilies], ["期望行业", profile.preferredIndustry], ["期望工作城市", profile.targetCities], ["最早到岗时间", profile.availableDate],
    ["期望薪资", profile.salaryExpectation], ["当前薪资", profile.currentSalary], ["离职通知期", profile.noticePeriod], ["首次参加工作时间", profile.workStartDate],
    ["是否接受出差", profile.travelPreference], ["是否接受调动 / 派驻", profile.relocationPreference], ["是否服从岗位调剂", profile.roleAdjustment],
    ["在华工作资格", profile.workAuthorization], ["海外经历", profile.overseasExperience], ["招聘信息来源", profile.applicationSource], ["内推人 / 推荐码", profile.referrer],
    ["最高学历学校", profile.school], ["最高学历 / 学位", profile.degree], ["最高学历专业", profile.major], ["硕士学院", profile.masterCollege],
    ["硕士入学时间", profile.masterStart], ["硕士毕业时间", profile.graduation], ["硕士培养方式", profile.masterStudyType], ["硕士 GPA", profile.gpa],
    ["硕士成绩 / 排名", profile.masterRank], ["硕士研究方向", profile.masterFocus], ["硕士主修课程", profile.masterCourses],
    ["本科学校", profile.bachelorSchool], ["本科学历 / 学位", profile.bachelorDegreeType || profile.bachelorDegree], ["本科专业", profile.bachelorMajor],
    ["本科入学时间", profile.bachelorStart], ["本科毕业时间", profile.bachelorEnd], ["本科培养方式", profile.bachelorStudyType], ["本科成绩 / 排名", profile.bachelorRank],
    ["本科主修课程", profile.bachelorCourses], ["工作 / 科研经历", experienceEntries(result).map(item => `${item.org}｜${item.role}｜${item.start}-${item.end}\n${item.description}`).join("\n\n")],
    ["项目经历", projectEntries(result).map(item => `${item.title}｜${item.role}\n${item.description}`).join("\n\n")], ["主要技能", rankSkills(result).slice(0,18).join("，")],
    ["自我介绍 / 个人总结", tailoredSummary(result)], ["语言能力", profile.english], ["证书", profile.certifications], ["软件工具", profile.tools],
    ["获奖情况", profile.awards], ["论文 / 专利 / 会议成果", profile.publications], ["紧急联系人", profile.emergencyContactName], ["紧急联系人电话", profile.emergencyContactPhone],
  ];
  return fieldMap.map(([field_label, value]) => ({field_label, value:String(value || "")}));
}

function requiredAttachmentPlan(result) {
  const requested = [{type:"定向 Word 简历", label:"简历附件", generated:true}];
  const rules = [
    [/学历证明|毕业证|学历证/, "学历证明", "学历证明 / 毕业证"], [/学位证|学位证明/, "学位证明", "学位证明 / 学位证"],
    [/成绩单/, "成绩单", "成绩单"], [/证件照|照片/, "证件照", "证件照"], [/英语证书|语言证书|cet|六级/, "语言证书", "语言证书"],
    [/资格证|职业证书|获奖证书/, "资格证书", "资格 / 获奖证书"], [/作品集|portfolio/, "作品集", "作品集"], [/身份证|身份证明/, "身份证明", "身份证明"],
  ];
  rules.forEach(([pattern,type,label]) => { if (pattern.test(result.jd)) requested.push({type,label}); });
  return requested.map(item => {
    if (item.generated) return {type:item.type, upload_field_label:item.label, file_path:safeFileName(`${result.company}-${result.role}-${profile.name || "候选人"}-V${String(result.versionNo).padStart(2,"0")}.docx`), missing:false};
    const match = attachments.find(file => file.type.includes(item.type) || item.type.includes(file.type));
    return {type:item.type, upload_field_label:item.label, file_path:match ? match.fileName : "[缺失：请在材料库上传]", missing:!match};
  });
}

function buildStructuredOutput(result) {
  const projects = projectEntries(result);
  const experiences = experienceEntries(result);
  const hardGaps = result.hardRequirements.filter(item => item.status === "gap").map(item => item.label);
  return {
    ...autofillPayload(),
    reasoning:`先解析 JD，识别到岗位方向“${TRACKS[result.track].label}”；核心关键词为 ${result.keywords.join("、") || "未识别到明确关键词"}。主档案已有证据覆盖 ${result.matched.join("、") || "暂无"}，缺少证据的要求为 ${result.missing.join("、") || "暂无"}。硬性条件缺口为 ${hardGaps.join("、") || "未发现明确缺口"}。据此按关键词相关程度排序已有内容，重排项目、经历和技能，但不新增未经主档案证明的能力。`,
    optimized_resume_content:{
      summary:tailoredSummary(result),
      education:`${profile.school}｜${profile.major}｜${profile.degree}；相关课程：${profile.masterCourses || "未填写"}`,
      experience:experiences.map(item => ({role:item.role, company:item.org, dates:[item.start,item.end].filter(Boolean).join("-") , details:sentenceBullets(item.description,result)})),
      projects:projects.map(item => ({title:item.title, role:item.role, details:sentenceBullets(item.description,result)})),
      skills:rankSkills(result).slice(0,18),
      truthfulness_guard:{unsupported_keywords_excluded:result.missing, hard_requirement_gaps:hardGaps},
    },
    online_form_fields:onlineFormFields(result,resumeProfile(result)),
    attachments:requiredAttachmentPlan(result),
    docx_resume_instructions:`已生成可下载的真实 .docx 文件：${safeFileName(`${result.company}-${result.role}-${profile.name || "候选人"}-V${String(result.versionNo).padStart(2,"0")}.docx`)}。提交前请核对事实、日期、数字和企业要求；材料清单会写入文档末尾供人工确认。`,
    wechat_operation_notes:"在微信手机端打开简投：粘贴 JD → 生成岗位专属结果 → 在材料库一次上传证书 → 在投递进度更新状态。由于微信内置浏览器不能运行 Chrome 扩展，第三方飞书/Moka 页面自动填表需在桌面 Chrome 使用浏览器助手；手机端可复制 JSON/字段值并手动上传，验证码、声明和最终提交始终由本人确认。",
  };
}

function buildDocxPayload(result) {
  const profile=resumeProfile(result);
  return {
    title:`${result.company} ${result.role} 定向简历`, name:profile.name || "候选人",
    subtitle:`应聘：${result.role}`,
    contact:[profile.phone,profile.email,profile.city,profile.portfolio].filter(Boolean).join(" ｜ "),
    summary:tailoredSummary(result),
    education:educationEntries(profile).map(item => ({title:[item.school,item.major,item.degree].filter(Boolean).join(" · "),dates:[item.start,item.end].filter(Boolean).join(" – "),detail:[item.gpa,item.rank,item.courses].filter(Boolean).join(" ｜ ")})),
    experience:experienceEntries(result).filter(item => item.description).map(item => ({title:`${item.org} · ${item.role}`, dates:[item.start,item.end].filter(Boolean).join(" – "), detail:item.department, bullets:sentenceBullets(item.description,result)})),
    projects:projectEntries(result).map(item => ({title:item.title, dates:[item.role,item.dates].filter(Boolean).join(" ｜ "), bullets:sentenceBullets(item.description,result)})),
    skills:[{label:"专业技能",value:rankSkills(result).slice(0,18).join("、")},{label:"语言工具",value:[profile.english,profile.tools].filter(Boolean).join("；")},{label:"研究成果",value:profile.publications},{label:"校园经历与补充经历",value:profile.otherExperience}],
    attachments:[],
  };
}

async function persistApplication(result) {
  const local = {id:result.id, company:result.company, role:result.role, platform:result.platform, applicationUrl:result.applicationUrl, status:result.status, jd:result.jd, result:buildStructuredOutput(result), createdAt:result.generatedAt, updatedAt:result.generatedAt};
  applications = [local, ...applications.filter(item => item.id !== local.id)];
  profileStore.setItem(storageKey("applypilot-applications"), JSON.stringify(applications));
  renderApplications();
  if (!cloudAvailable) return;
  try {
    const payload = await apiJson("/api/applications", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(local)});
    applications = [payload.application, ...applications.filter(item => item.id !== local.id)];
    profileStore.setItem(storageKey("applypilot-applications"), JSON.stringify(applications));
    renderApplications();
  } catch { cloudAvailable = false; }
}

function renderApplications() {
  const container = $("#applicationList");
  if (!container) return;
  if (!applications.length) { container.innerHTML = '<div class="empty-state">还没有岗位记录。分析一个 JD 后会自动建立待投递记录。</div>'; return; }
  container.innerHTML = applications.map(item => `<article class="application-card" data-application-id="${escapeHtml(item.id)}"><div class="application-title"><b>${escapeHtml(item.company || "目标公司")} · ${escapeHtml(item.role || "目标岗位")}</b><small>${escapeHtml(new Date(item.updatedAt || item.createdAt || Date.now()).toLocaleString("zh-CN"))}｜${escapeHtml(item.result?.optimized_resume_content?.skills?.slice(0,3).join("、") || "岗位专属版本")}</small></div><label>平台<select data-app-field="platform"><option ${item.platform === "待确认" ? "selected" : ""}>待确认</option><option ${item.platform === "飞书招聘" ? "selected" : ""}>飞书招聘</option><option ${item.platform === "Moka招聘" ? "selected" : ""}>Moka招聘</option><option ${item.platform === "其他" ? "selected" : ""}>其他</option></select></label><label>状态<select data-app-field="status">${["待投递","已投递","笔试","面试","Offer","已拒绝","已撤回"].map(status => `<option ${item.status === status ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>申请页链接<input data-app-field="applicationUrl" type="url" value="${escapeHtml(item.applicationUrl || "")}" placeholder="粘贴岗位申请页" /></label></article>`).join("");
  $$('[data-app-field]').forEach(control => control.addEventListener("change", () => updateApplicationField(control)));
}

async function updateApplicationField(control) {
  const card = control.closest("[data-application-id]");
  const id = card.dataset.applicationId;
  const field = control.dataset.appField;
  const value = control.value.trim();
  applications = applications.map(item => item.id === id ? {...item,[field]:value,updatedAt:new Date().toISOString()} : item);
  profileStore.setItem(storageKey("applypilot-applications"), JSON.stringify(applications));
  showToast("投递进度已更新");
  if (!cloudAvailable) return;
  try { await apiJson(`/api/applications/${encodeURIComponent(id)}`, {method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({[field]:value})}); }
  catch { cloudAvailable = false; showToast("已保存到本机，云端同步暂不可用"); }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function renderAttachments() {
  const container = $("#attachmentList");
  if (!container) return;
  if (!attachments.length) { container.innerHTML = '<div class="empty-state">尚未上传材料。</div>'; return; }
  container.innerHTML = attachments.map(item => `<div class="attachment-item" data-attachment-id="${escapeHtml(item.id)}"><span><b>${escapeHtml(item.fileName)}</b><small>${escapeHtml(item.type)} · ${formatBytes(item.size || 0)}</small></span><div><a href="/api/attachments/${encodeURIComponent(item.id)}/download">下载</a><button type="button" data-delete-attachment>删除</button></div></div>`).join("");
  $$('[data-delete-attachment]').forEach(button => button.addEventListener("click", () => deleteAttachment(button.closest("[data-attachment-id]").dataset.attachmentId)));
}

function deviceStatusLabel(status) {
  return ({active:"已连接", approved:"等待电脑确认", pending:"等待手机授权", revoked:"已撤销", expired:"已过期"})[status] || status;
}

async function loadDevices() {
  const list = $("#deviceList");
  if (!list) return;
  if (!CLOUD_MODE) { list.textContent = "本机模式：无需连接设备。可直接将档案用于本机填表。"; return; }
  try {
    const payload = await apiJson("/api/devices");
    const devices = payload.devices || [];
    if (!devices.length) {
      list.innerHTML = "<span>还没有连接设备。安装扩展后，用手机扫描扩展内二维码即可。</span>";
      return;
    }
    list.innerHTML = devices.map(device => `<div class="device-item"><span><b>${escapeHtml(device.device_name || "浏览器助手")}</b><small>${escapeHtml(deviceStatusLabel(device.status))}${device.last_seen_at ? ` · 最近在线 ${escapeHtml(new Date(device.last_seen_at).toLocaleString("zh-CN"))}` : ""}</small></span>${device.status === "active" ? `<button data-revoke-device="${escapeHtml(device.id)}">撤销</button>` : ""}</div>`).join("");
    $$('[data-revoke-device]').forEach(button => button.addEventListener("click", async () => {
      if (!window.confirm("确认撤销这台设备？撤销后浏览器助手将无法读取你的档案。")) return;
      try { await apiJson(`/api/devices/${encodeURIComponent(button.dataset.revokeDevice)}`, {method:"DELETE"}); await loadDevices(); showToast("设备连接已撤销"); }
      catch (error) { showToast(error.message || "撤销失败，请重试"); }
    }));
  } catch (error) {
    list.innerHTML = `<span>设备列表暂不可用：${escapeHtml(error.message || "请稍后重试")}</span>`;
  }
}

async function loadEvents() {
  const list = $("#eventList");
  if (!list) return;
  if (!CLOUD_MODE) { list.textContent = "本机模式：投递进度保存在当前浏览器，尚未连接微信通知。"; return; }
  const labels = {page_detected:"打开申请页",form_analyzed:"分析表单",form_filled:"确认填写",status_changed:"更新状态",command_completed:"完成远程任务"};
  try {
    const payload = await apiJson("/api/events");
    const events = payload.events || [];
    if (!events.length) { list.innerHTML = "<span>暂无设备活动。连接浏览器助手后会在这里显示。</span>"; return; }
    list.innerHTML = events.map(event => `<div class="event-item"><b>${escapeHtml(labels[event.type] || event.type)}</b><span>${escapeHtml(event.platform || "通用表单")}${event.message ? ` · ${escapeHtml(event.message)}` : ""}</span><small>${escapeHtml(new Date(event.createdAt).toLocaleString("zh-CN"))}</small></div>`).join("");
  } catch (error) { list.innerHTML = `<span>活动记录暂不可用：${escapeHtml(error.message || "请稍后重试")}</span>`; }
}

async function uploadAttachments() {
  const input = $("#attachmentInput");
  const files = [...input.files];
  if (!files.length) { showToast("请先选择文件"); return; }
  if (!cloudAvailable) { showToast("云端暂不可用，无法安全保存附件"); return; }
  $("#uploadAttachments").disabled = true;
  try {
    for (const file of files) {
      const form = new FormData(); form.append("file", file); form.append("type", $("#attachmentType").value);
      const payload = await apiJson("/api/attachments", {method:"POST",body:form});
      attachments.unshift(payload.attachment);
    }
    input.value = ""; renderAttachments(); if (currentResult) renderResult(); showToast(`已上传 ${files.length} 份材料`);
  } catch (error) { showToast(error.message); }
  finally { $("#uploadAttachments").disabled = false; }
}

async function deleteAttachment(id) {
  if (!window.confirm("确认删除这份申请材料？删除后无法恢复。")) return;
  try {
    await apiJson(`/api/attachments/${encodeURIComponent(id)}`, {method:"DELETE"});
    attachments = attachments.filter(item => item.id !== id); renderAttachments(); if (currentResult) renderResult(); showToast("材料已删除");
  } catch (error) { showToast(error.message); }
}

async function copyText(text, success) {
  try { await navigator.clipboard.writeText(text); showToast(success); }
  catch { const area = document.createElement("textarea"); area.value = text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); showToast(success); }
}

$("#jdInput").addEventListener("input", event => $("#jdCount").textContent = `${event.target.value.trim().length} 字`);
$("#loadDemo").addEventListener("click", () => { $("#companyInput").value = "示例 AI 制药公司"; $("#roleInput").value = "AI 医药产品经理"; $("#trackSelect").value = "auto"; $("#jdInput").value = DEMO_JD; $("#jdCount").textContent = `${DEMO_JD.length} 字`; showToast("已载入示例 JD；示例不会修改你的档案"); });
$("#analyzeBtn").addEventListener("click", analyzeJD);
$("#openProfile").addEventListener("click", openProfile);
$("#profileNav").addEventListener("click", openProfile);
$("#editProfileFromResult").addEventListener("click", openProfile);
$("#closeProfile").addEventListener("click", closeProfile);
$("#profileDialog").addEventListener("click", event => {
  if (event.target === event.currentTarget) showToast("档案不会因误触关闭，内容已实时保存");
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !$("#profileDialog").classList.contains("hidden")) {
    event.preventDefault();
    showToast("为防止误关，请点击右上角 × 或“完成编辑”");
  }
});
$$('[data-profile]').forEach(element => element.addEventListener("input", () => saveProfileField(element)));
$("#saveProfile").addEventListener("click", () => { closeProfile(); if (currentResult) renderResult(); showToast("主档案已保存"); });
$("#resetProfile").addEventListener("click", () => {
  if (!window.confirm("确认清空主档案？当前内容会被覆盖，但此前已导出的文件不会删除。")) return;
  profile = {...DEFAULT_PROFILE};
  $$('[data-profile]').forEach(element => element.value = profile[element.dataset.profile] || "");
  saveProfileData();
  invalidateResult();
  showToast("主档案已清空并保存");
});
$$('[data-jump]').forEach(button => button.addEventListener("click", () => $("#" + button.dataset.jump).scrollIntoView({behavior:"smooth",block:"start"})));
$$(".tab").forEach(tab => tab.addEventListener("click", () => switchTab(tab.dataset.tabTarget)));
$$('[data-tab="autofill"]').forEach(element => element.addEventListener("click", () => { $("#results").classList.remove("hidden"); switchTab("autofill"); $("#results").scrollIntoView({behavior:"smooth"}); }));
$$('[data-tab="status"]').forEach(element => element.addEventListener("click", () => { $("#results").classList.remove("hidden"); switchTab("status"); $("#results").scrollIntoView({behavior:"smooth"}); }));
$("#exportWord").addEventListener("click", exportWord);
$("#exportWord2").addEventListener("click", exportWord);
$("#copyResume").addEventListener("click", () => currentResult ? copyText(resumePlainText(), "岗位专属简历文本已复制") : showToast("请先分析一个岗位"));
$("#copyProfileJson").addEventListener("click", () => copyText(JSON.stringify(autofillPayload(), null, 2), "完整填表数据已复制，可粘贴到浏览器助手"));
$("#refreshDevices").addEventListener("click", loadDevices);
$("#refreshEvents").addEventListener("click", loadEvents);
$("#copyStructuredJson").addEventListener("click", () => currentResult ? copyText(JSON.stringify(buildStructuredOutput(currentResult), null, 2), "结构化 JSON 已复制") : showToast("请先分析一个岗位"));
$("#downloadStructuredJson").addEventListener("click", () => {
  if (!currentResult) { showToast("请先分析一个岗位"); return; }
  downloadBlob(new Blob([JSON.stringify(buildStructuredOutput(currentResult), null, 2)], {type:"application/json"}), safeFileName(`${currentResult.company}-${currentResult.role}-投递数据.json`));
});
$("#uploadAttachments").addEventListener("click", uploadAttachments);
$$('[data-mobile-action]').forEach(button => button.addEventListener("click", () => {
  const action = button.dataset.mobileAction;
  if (action === "workspace") { window.scrollTo({top:0,behavior:"smooth"}); return; }
  if (action === "profile") { openProfile(); return; }
  if (action === "attachments") { openProfile(); setTimeout(() => $("#attachmentSection").scrollIntoView({behavior:"smooth",block:"start"}), 120); return; }
  $("#results").classList.remove("hidden"); switchTab("status"); $("#results").scrollIntoView({behavior:"smooth"});
}));

updateProfileUI();
renderApplications();
renderAttachments();
hydrateCloudData();
loadDevices();
loadEvents();
$("#saveLabel").textContent = CLOUD_MODE ? "正在读取云端档案…" : "本机模式 · 无需注册";
try {
  const last = JSON.parse(profileStore.getItem(storageKey("applypilot-last-result")) || "null");
  if (last?.jd) { $("#companyInput").value = last.company || ""; $("#roleInput").value = last.role || ""; $("#trackSelect").value = TRACKS[last.track] ? last.track : "auto"; $("#jdInput").value = last.jd; $("#jdCount").textContent = `${last.jd.length} 字`; }
} catch {}

if(location.protocol==='chrome-extension:'){
  const importId=new URLSearchParams(location.search).get('jdImport');
  if(importId){
    const key='applypilotJD:'+importId;
    chrome.storage.session.get(key).then(async data=>{
      const item=data[key];await chrome.storage.session.remove(key);
      if(!item||typeof item.jd!=='string'||item.jd.length<40||item.jd.length>20000||Date.now()-item.createdAt>10*60*1000){showToast('选中 JD 已过期，请返回招聘页重新选择');return;}
      $('#jdInput').value=item.jd;$('#jdInput').dispatchEvent(new Event('input'));showToast('已带入选中 JD，请核对后生成岗位版');
    }).catch(()=>showToast('JD 读取失败，请重新选择'));
  }
}

$("#exportBackup").addEventListener("click", () => {
  const backup = {schema:"applypilot-backup-v1",profile:cleanProfile(profile,{includeSensitive:true})};
  downloadBlob(new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),"applypilot-private-backup.json");
  showToast("备份含个人信息，请妥善保管");
});
$("#importBackup").addEventListener("change", async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 1024*1024) throw new Error("档案 JSON 不能超过 1 MB");
    const data = JSON.parse(await file.text());
    if (!data.profile || !["applypilot-backup-v1","applypilot-profile-v5","applypilot-profile-v4"].includes(data.schema)) throw new Error("请选择简投导出的备份或填表数据 JSON");
    const imported = cleanProfile(data.profile,{includeSensitive:true});
    if (!imported.name) throw new Error("档案缺少姓名");
    if (!confirm("导入会替换当前主档案；已有投递记录保留。是否继续？")) return;
    profile = {...DEFAULT_PROFILE,...imported}; saveProfileData(); invalidateResult(); openProfile(); showToast("档案导入完成");
  } catch (error) { showToast(error.message); }
  finally { event.target.value = ""; }
});
$("#useForFilling").addEventListener("click", async () => {
  if (!profile.name) { openProfile(); showToast("请先填写姓名"); return; }
  const payload = autofillPayload();
  if (globalThis.chrome?.storage?.local) {
    await chrome.storage.local.set({applypilotPayload:payload,applypilotSource:"local"});
    showToast("已选为填表档案；打开申请页后点击插件填写");
  } else { downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),"applypilot-fill-profile.json"); showToast("填表数据已下载，可在插件中导入"); }
});
$("#convertPdf").addEventListener("click", async () => {
  const button = $("#convertPdf"); button.disabled = true;
  const status = $("#pdfStatus"); status.textContent = "正在本机转换…";
  try {
    if (!window.PDFLib) throw new Error("PDF 组件未加载，请运行 npm run assets:build 后刷新");
    const bytes = await convertToPdf([...$("#pdfFiles").files],window.PDFLib,async (bytes, kind) => {
      const bitmap = await createImageBitmap(new Blob([bytes],{type:kind === "jpg" ? "image/jpeg" : "image/png"}),{imageOrientation:"from-image"});
      try {
        if (bitmap.width*bitmap.height > PDF_LIMITS.pixels) throw new Error("图片超过 4000 万像素");
        const canvas = document.createElement("canvas"); canvas.width=bitmap.width; canvas.height=bitmap.height;
        canvas.getContext("2d").drawImage(bitmap,0,0);
        const blob = await new Promise(resolve => canvas.toBlob(resolve,"image/png"));
        if (!blob) throw new Error("图片解码失败");
        return new Uint8Array(await blob.arrayBuffer());
      } finally { bitmap.close(); }
    });
    downloadBlob(new Blob([bytes],{type:"application/pdf"}),"applypilot-materials.pdf");
    status.textContent = "PDF 已下载，请打开核对页序和清晰度。文件未上传到服务器。";
  } catch(error) { status.textContent=error.message; }
  finally { button.disabled=false; }
});
$("#printPdf").addEventListener("click", () => {
  if (!currentResult) { showToast("请先分析岗位"); return; }
  switchTab("resume"); window.print();
});
$("#legacyImport").addEventListener("click", () => {
  try {
    const data = JSON.parse(localStorage.getItem("applypilot-profile") || "null");
    if (!data) { showToast("此浏览器没有旧版档案"); return; }
    const imported = cleanProfile(data,{includeSensitive:true});
    if (!confirm("把此浏览器旧版档案复制到本机模式？会替换当前主档案。")) return;
    profile={...DEFAULT_PROFILE,...imported}; saveProfileData(); invalidateResult(); openProfile();
  } catch { showToast("旧版档案无法读取，可通过 JSON 备份导入"); }
});
