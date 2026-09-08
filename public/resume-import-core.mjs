// Conservative, source-backed suggestions. Uncertain text stays available for review.
export function parseResumeText(text) {
  if(typeof text!=='string'||text.length>80000)throw new Error('简历文字过多（最多 80000 字）');
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const fields={},evidence={},used=new Set();
  function set(key,value,line,confidence='需核对') {
    if(!value?.trim())return;
    value=value.trim();
    if(fields[key]&&fields[key]!==value){evidence[key].confidence='存在多个候选，请核对';return;}
    fields[key]=value;evidence[key]={source:line,confidence};used.add(line);
  }
  const email=[...new Set(text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)||[])];
  if(email.length)set('email',email[0],lines.find(s=>s.includes(email[0])),email.length>1?'多个邮箱，已选第一个':'格式明确');
  const phones=[...new Set(text.match(/(?<!\d)1[3-9]\d{9}(?!\d)/g)||[])];
  if(phones.length)set('phone',phones[0],lines.find(s=>s.includes(phones[0])),phones.length>1?'多个号码，请核对':'格式明确');
  const named=lines.find(s=>/^(?:姓名|Name)\s*[:：]/i.test(s));
  const name=named?.match(/^(?:姓名|Name)\s*[:：]\s*([^|｜,，]+)/i)?.[1] || lines.slice(0,6).find(s=>/^[\u4e00-\u9fff]{2,4}$/.test(s)&&!/简历|背景|经历|技能|教育|优势|评价/.test(s)) || lines.slice(0,4).find(s=>/^[A-Za-z]+(?:[ -][A-Za-z]+){1,3}$/.test(s)&&!/resume|summary|education|experience/i.test(s));
  if(name)set('name',name,named||name);
  for(const line of lines) {
    const city=line.match(/(?:意向城市|期望城市|目标城市)\s*[:：]\s*([^|｜—]+)/);if(city)set('targetCities',city[1],line);
    const role=line.match(/(?:求职意向|目标岗位|Target Role)\s*[:：]\s*(.+)/i);if(role)set('targetRoleFamilies',role[1],line);
  }
  const heading=s=>{
    const clean=s.replace(/[\s/·]/g,'').toLowerCase();
    if(/^(教育背景|教育经历|education)$/.test(clean))return 'education';
    if(/^(主要项目经历|项目经历|科研经历|projects?|researchprojects)$/.test(clean))return 'project';
    if(/^(实习经历|internshipexperience|internships?)$/.test(clean))return 'internship';
    if(/^(工作经历|职业经历|主要经历|professionalexperience|workexperience|experience)$/.test(clean))return 'experience';
    if(/^(校园经历|社会实践|campusexperience|volunteering)$/.test(clean))return 'other';
    if(/^(技能语言|技能与语言|专业技能|技能|skills|languages?)$/.test(clean))return 'skills';
    if(/^(个人优势|自我评价|个人总结|职业摘要|professionalsummary|summary|profile)$/.test(clean))return 'summary';
    return '';
  };
  const dates=s=>s.match(/(?:19|20)\d{2}[./年-]\s*\d{1,2}(?:月)?\s*[-–—~至]+\s*(?:(?:19|20)\d{2}[./年-]\s*\d{1,2}(?:月)?|至今|现在|Present|Current)/i);
  const splitDates=s=>s?.match(/(?:19|20)\d{2}[./年-]\s*\d{1,2}(?:月)?|至今|现在|Present|Current/gi)||[];
  let section='',entry=null,edu=null;let project=0,experience=0;const sections={skills:[],summary:[],other:[]};
  const flush=()=>{
    if(entry){const {key,body,header}=entry;if(body.length){fields[key]=body.join('\n');evidence[key]={source:[header,...body].join('\n'),confidence:'按章节归类，请核对边界'};}entry=null;}
  };
  for(let i=0;i<lines.length;i++) {
    const line=lines[i],nextSection=heading(line);
    if(nextSection){flush();section=nextSection;edu=null;used.add(line);continue;}
    if(section==='education') {
      if(/大学|学院|University|College|Institute/i.test(line)&&!/^主修|^Relevant|^课程/i.test(line)) {
        const d=dates(line)||dates(lines[i+1]||'');const parts=splitDates(d?.[0]);
        const content=line.replace(d?.[0]||'\u0000','').trim();
        const segments=content.split(/[|｜]/).map(s=>s.trim());
        const school=segments[0].replace(/^\s+/,''),bachelor=/本科|学士|Bachelor/i.test(content);
        edu=bachelor?'bachelor':'master';
        set(bachelor?'bachelorSchool':'school',school,line);
        set(bachelor?'bachelorDegree':'degree',content.match(/硕士|本科|博士|学士|Master[^|｜]*|Bachelor[^|｜]*/i)?.[0],line);
        set(bachelor?'bachelorMajor':'major',segments[1]?.replace(/[（(](?:硕士|本科|博士|学士)[）)]/g,'').replace(/^(?:Master|Bachelor) of /i,'').trim(),line);
        set(bachelor?'bachelorStart':'masterStart',parts[0],line);set(bachelor?'bachelorEnd':'graduation',parts[1],line);
        if(d&&d[0]===lines[i+1])used.add(lines[++i]);
        used.add(line);continue;
      }
      if(edu) {
        const gpa=line.match(/(?:GPA|绩点)\s*[:：]?\s*(\d\.\d+\s*\/\s*\d\.\d+)/i);
        if(gpa)set(edu==='master'?'gpa':'bachelorRank',gpa[1],line);
        if(/主修课程|Relevant coursework/i.test(line))set(edu==='master'?'masterCourses':'bachelorCourses',line.replace(/^.*?(?:课程|coursework)\s*[:：]/i,''),line);
        if(/奖学金|荣誉|优秀|honor|scholarship/i.test(line)){sections.other.push(line);used.add(line);}
      }
      continue;
    }
    if(['project','experience','internship'].includes(section)) {
      const d=dates(line)||((/[|｜]/.test(line)||/大学|学院|实验室|公司|University|Hospital/.test(line))?dates(lines[i+1]||''):null);
      if(d) {
        flush();const parts=splitDates(d[0]);const content=line.replace(d[0],'').trim();const segments=content.split(/[|｜]/).map(s=>s.trim());
        if(section==='project'&&project<2){const prefix=`project${++project}`;set(prefix+'Title',segments[0],line);set(prefix+'Role',segments[1],line);set(prefix+'Dates',d[0],line);entry={key:prefix,header:line,body:[]};}
        else if(section==='internship'&&!fields.internshipOrg){set('internshipOrg',segments[0],line);set('internshipRole',segments[1],line);set('internshipStart',parts[0],line);set('internshipEnd',parts[1],line);entry={key:'internshipDescription',header:line,body:[]};}
        else if(experience<2){const prefix=`experience${++experience}`;set(prefix+'Org',segments[0],line);set(prefix+'Role',segments[1],line);set(prefix+'Start',parts[0],line);set(prefix+'End',parts[1],line);entry={key:prefix+'Description',header:line,body:[]};}
        else {sections.other.push(line);}
        used.add(line);if(d[0]===lines[i+1])used.add(lines[++i]);continue;
      }
      if(entry){entry.body.push(line);used.add(line);}continue;
    }
    if(sections[section]){sections[section].push(line);used.add(line);}
  }
  flush();
  for(const [section,key]of [['skills','skills'],['summary','summary'],['other','otherExperience']])if(sections[section].length){fields[key]=sections[section].join('\n');evidence[key]={source:fields[key],confidence:'按章节提取，请核对'};}
  const unmapped=lines.filter(s=>!used.has(s));
  return {fields,evidence,unmapped,warnings:['自动识别结果均需核对，尤其是多栏、文本框和扫描文字。',...(!fields.name?['未可靠识别姓名，请手动填写。']:[]),...(unmapped.length?['有未归类原文，请核对后补充到对应字段。']:[])]};
}
