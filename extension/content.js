(() => {
  if (window.__applyPilotInjected) return;
  window.__applyPilotInjected = true;

  const FIELD_MAP = [
    ["name", ["姓名", "名字", "name", "full name", "candidate name"]],
    ["englishName", ["英文姓名", "英文名", "english name"]],
    ["phone", ["手机", "手机号", "联系电话", "电话", "mobile", "phone", "tel"]],
    ["email", ["邮箱", "电子邮件", "email", "e-mail"]],
    ["gender", ["性别", "gender", "sex"]],
    ["birthDate", ["出生日期", "出生年月", "生日", "date of birth", "birthday"]],
    ["city", ["所在城市", "现居地", "现居城市", "居住地", "location", "city"]],
    ["countryRegion", ["国家地区", "国家/地区", "country", "region"]],
    ["nationality", ["国籍", "nationality"]],
    ["nativePlace", ["籍贯", "native place"]],
    ["householdRegistration", ["户籍所在地", "户口所在地", "户籍地址"]],
    ["currentAddress", ["现居详细地址", "居住地址", "联系地址", "address"]],
    ["postalCode", ["邮政编码", "邮编", "postal code", "zip code"]],
    ["workYears", ["工作年限", "工作经验", "years of experience"]],
    ["school", ["学校名称", "毕业院校", "学校", "院校", "university", "school"]],
    ["degree", ["最高学历", "学历", "学位", "degree", "education level"]],
    ["major", ["专业名称", "所学专业", "专业", "major"]],
    ["masterStart", ["入学时间", "教育开始时间", "start date"]],
    ["graduation", ["毕业时间", "毕业日期", "毕业年份", "graduation", "graduate date"]],
    ["gpa", ["gpa", "绩点", "平均成绩"]],
    ["masterCourses", ["主修课程", "主要课程", "相关课程", "所学课程", "coursework", "courses"]],
    ["english", ["英语水平", "外语水平", "语言能力", "english level"]],
    ["portfolio", ["个人主页", "作品集", "linkedin", "github", "portfolio", "个人网站"]],
    ["targetRole", ["应聘职位", "申请职位", "目标岗位", "期望职位", "position", "job title"]],
    ["targetCities", ["期望城市", "意向城市", "期望工作地点", "preferred location"]],
    ["jobType", ["求职类型", "工作类型", "全职实习", "employment type"]],
    ["availableDate", ["到岗时间", "最早到岗", "入职时间", "available date", "notice period"]],
    ["salaryExpectation", ["期望薪资", "期望月薪", "expected salary"]],
    ["currentSalary", ["当前薪资", "目前薪资", "current salary"]],
    ["noticePeriod", ["离职通知期", "通知期", "notice period"]],
    ["workStartDate", ["首次参加工作时间", "开始工作时间"]],
    ["preferredIndustry", ["期望行业", "意向行业", "preferred industry"]],
    ["currentEmployer", ["当前单位", "现单位", "current employer"]],
    ["travelPreference", ["接受出差", "是否出差", "business travel"]],
    ["relocationPreference", ["接受调动", "接受派驻", "接受异地", "relocation"]],
    ["applicationSource", ["招聘信息来源", "申请渠道", "获知渠道", "source"]],
    ["referrer", ["内推人", "推荐人", "推荐码", "referrer", "referral"]],
    ["workAuthorization", ["工作资格", "合法工作", "work authorization"]],
    ["roleAdjustment", ["服从调剂", "岗位调剂"]],
    ["overseasExperience", ["海外经历", "留学经历", "overseas experience"]],
    ["status", ["到岗时间", "求职状态", "可入职时间", "availability"]],
    ["skills", ["专业技能", "技能", "skills", "核心技能"]],
    ["selfIntroduction", ["自我评价", "个人总结", "个人简介", "自我介绍", "summary", "profile"]],
    ["experience1Org", ["工作单位", "任职公司", "公司名称", "研究单位", "organization", "company"]],
    ["experience1Role", ["职位名称", "担任职务", "岗位名称", "position title"]],
    ["experience1Description", ["工作描述", "工作内容", "科研经历", "responsibilities", "work description"]],
    ["internshipOrg", ["实习单位", "实习公司", "internship company"]],
    ["internshipRole", ["实习岗位", "实习职位", "internship title"]],
    ["internshipDescription", ["实习描述", "实习内容", "internship description"]],
    ["project1Title", ["项目名称", "课题名称", "project name"]],
    ["project1", ["项目经历", "项目描述", "研究内容", "research experience", "project experience"]],
    ["awards", ["获奖经历", "荣誉奖励", "奖学金", "awards", "honors"]],
    ["publications", ["论文", "科研成果", "发表成果", "publications"]],
    ["certifications", ["证书", "资格证书", "certifications"]],
    ["tools", ["软件工具", "计算机技能", "software"]]
  ];

  const normalize = s => String(s || "").toLowerCase().replace(/[\s*：:（）()\[\]_-]/g, "");
  const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0; };
  const forbidden = text => /验证码|captcha|密码|password|身份证|证件号码|承诺|声明|同意|签名|搜索/.test(text);

  function fieldText(el) {
    const direct = [el.name, el.id, el.placeholder, el.getAttribute("aria-label"), el.getAttribute("data-field")].filter(Boolean).join(" ");
    const labels = [...(el.labels || [])].map(x => x.innerText).join(" ");
    const container = el.closest("label, [class*='form-item'], [class*='formItem'], [class*='field'], [role='group'], .ant-form-item, .semi-form-field");
    const nearby = container ? (container.innerText || "").slice(0, 100) : "";
    return normalize(`${direct} ${labels} ${nearby}`);
  }

  function rawFieldText(el) {
    const labels = [...(el.labels || [])].map(x => x.innerText).join(" ");
    const container = el.closest("label, [class*='form-item'], [class*='formItem'], [class*='field'], [role='group'], .ant-form-item, .semi-form-field");
    return [labels, el.getAttribute("aria-label"), el.placeholder, el.name, container?.innerText].filter(Boolean).join(" ").trim().slice(0,120);
  }

  function bestValue(el, profile) {
    const text = fieldText(el);
    if (!text || forbidden(text)) return null;
    const customMatch = String(profile.customQuestions || "").split("\n").map(line => line.trim()).filter(Boolean).map(line => {
      const index = line.search(/[=＝:：]/);
      return index > 0 ? {question:normalize(line.slice(0,index)), value:line.slice(index + 1).trim()} : null;
    }).filter(Boolean).find(item => item.value && text.includes(item.question));
    if (customMatch) return {key:"customQuestions",value:customMatch.value,score:96};
    const educationField = (key, value) => value ? {key, value:String(value), score:92} : null;
    if (/本科|学士|bachelor/.test(text)) {
      if (/学校|院校|university|school/.test(text)) return educationField("bachelorSchool", profile.bachelorSchool);
      if (/专业|major/.test(text)) return educationField("bachelorMajor", profile.bachelorMajor);
      if (/学历|学位|degree/.test(text)) return educationField("bachelorDegree", profile.bachelorDegreeType || profile.bachelorDegree);
      if (/入学|开始|start/.test(text)) return educationField("bachelorStart", profile.bachelorStart);
      if (/毕业|结束|end/.test(text)) return educationField("bachelorEnd", profile.bachelorEnd);
      if (/课程|course/.test(text)) return educationField("bachelorCourses", profile.bachelorCourses);
    }
    if (/硕士|研究生|master/.test(text)) {
      if (/学校|院校|university|school/.test(text)) return educationField("school", profile.school);
      if (/专业|major/.test(text)) return educationField("major", profile.major);
      if (/学历|学位|degree/.test(text)) return educationField("degree", profile.degree);
      if (/入学|开始|start/.test(text)) return educationField("masterStart", profile.masterStart);
      if (/毕业|结束|end/.test(text)) return educationField("graduation", profile.graduation);
      if (/课程|course/.test(text)) return educationField("masterCourses", profile.masterCourses);
    }
    let best = null;
    for (const [key, aliases] of FIELD_MAP) {
      const value = profile[key];
      if (!value) continue;
      let score = 0;
      for (const alias of aliases) {
        const needle = normalize(alias);
        if (!needle) continue;
        if (text === needle) score = Math.max(score, 100);
        else if (text.startsWith(needle)) score = Math.max(score, 78);
        else if (text.includes(needle)) score = Math.max(score, 55);
      }
      if (score && (!best || score > best.score)) best = {key, value:String(value), score};
    }
    return best;
  }

  function setTextValue(el, value) {
    if (el.isContentEditable) { el.focus(); el.textContent = value; el.dispatchEvent(new InputEvent("input", {bubbles:true,inputType:"insertText",data:value})); return true; }
    if (el.tagName === "SELECT") {
      const option = [...el.options].find(o => normalize(o.text).includes(normalize(value)) || normalize(value).includes(normalize(o.text)));
      if (!option) return false;
      el.value = option.value;
    } else {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(el, value);
      else el.value = value;
    }
    el.dispatchEvent(new Event("input", {bubbles:true}));
    el.dispatchEvent(new Event("change", {bubbles:true}));
    el.dispatchEvent(new Event("blur", {bubbles:true}));
    return true;
  }

  function mark(el) {
    el.dataset.applypilotFilled = "true";
    el.style.setProperty("outline", "2px solid #20b88a", "important");
    el.style.setProperty("outline-offset", "2px", "important");
    setTimeout(() => { if (el.dataset.applypilotFilled) el.style.setProperty("outline-color", "rgba(32,184,138,.45)", "important"); }, 1800);
  }

  function fill(payload) {
    const profile = payload?.profile || {};
    const elements = [...document.querySelectorAll("input:not([type='hidden']):not([type='file']):not([type='password']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']")];
    let filled = 0, skipped = 0;
    for (const el of elements) {
      if (el.disabled || el.readOnly || !visible(el)) { skipped++; continue; }
      const match = bestValue(el, profile);
      if (!match || match.score < 55) { skipped++; continue; }
      const current = (el.value || el.textContent || "").trim();
      if (current && !el.dataset.applypilotFilled) { skipped++; continue; }
      if (setTextValue(el, match.value)) { mark(el); filled++; } else skipped++;
    }
    const requiredMissing = elements.filter(el => visible(el) && !el.disabled && (el.required || el.getAttribute("aria-required") === "true" || /\*/.test(rawFieldText(el))) && !(el.value || el.textContent || "").trim()).map(rawFieldText).filter(Boolean);
    const attachmentFields = [...document.querySelectorAll('input[type="file"]')].filter(visible).map(el => ({field_label:rawFieldText(el) || "附件上传",accept:el.accept || "由企业配置决定"}));
    return {ok:filled > 0 || requiredMissing.length > 0 || attachmentFields.length > 0, filled, skipped, requiredMissing:[...new Set(requiredMissing)].slice(0,20), attachmentFields, message:filled ? "填写完成" : "没有识别到可安全填写的常规字段"};
  }

  function analyze(payload) {
    const profile = payload?.profile || {};
    const elements = [...document.querySelectorAll("input:not([type='hidden']):not([type='file']):not([type='password']):not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']")];
    const recognized = elements.filter(el => visible(el) && !el.disabled && bestValue(el, profile)?.score >= 55).length;
    const requiredMissing = elements.filter(el => visible(el) && !el.disabled && (el.required || el.getAttribute("aria-required") === "true" || /\*/.test(rawFieldText(el))) && !(el.value || el.textContent || "").trim()).map(rawFieldText).filter(Boolean);
    const attachmentFields = [...document.querySelectorAll('input[type="file"]')].filter(visible).map(el => ({field_label:rawFieldText(el) || "附件上传",accept:el.accept || "由企业配置决定"}));
    return {ok:recognized > 0 || requiredMissing.length > 0 || attachmentFields.length > 0, recognized, requiredMissing:[...new Set(requiredMissing)].slice(0,20), attachmentFields, message:recognized ? "分析完成" : "没有识别到可安全填写的字段"};
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["APPLYPILOT_FILL", "APPLYPILOT_ANALYZE"].includes(message?.type)) return;
    try { sendResponse(message.type === "APPLYPILOT_FILL" ? fill(message.payload) : analyze(message.payload)); }
    catch (err) { sendResponse({ok:false, filled:0, skipped:0, message:err.message || "页面字段识别失败"}); }
  });
})();
