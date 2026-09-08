const CATEGORIES = [
  {label:'技术资料整理',source:/文献|论文|资料检索|技术资料/,jd:/技术|资料|文献|信息|方案/},
  {label:'数据处理',source:/数据|统计|报表|图表/,jd:/数据|分析|报表/},
  {label:'项目执行',source:/方案|实验|项目|进度/,jd:/项目|方案|执行|研发/},
  {label:'资源协调',source:/采购|供应商|耗材|协调/,jd:/采购|供应商|协调|项目/},
  {label:'文档整理',source:/文件|会议材料|文档|归档/,jd:/文档|商务|运营|行政|材料/},
  {label:'设计产出',source:/设计|原型|海报/,jd:/设计|原型|产品/},
];
export function rewriteParagraph(source,jd='') {
  let text=String(source || '').trim();
  // Remove filler without upgrading responsibility or claiming an unrecorded outcome.
  text=text.replace(/我(?:在.{0,8}期间)?(?:主要)?负责(?:的(?:工作|内容|事情)?)?是[：:]?/g,'负责')
    .replace(/我(?:主要)?(?:参与|协助)/g,m=>m.includes('协助')?'协助':'参与')
    .replace(/在(?:这个|该)(?:项目|工作)中[，,]?/g,'')
    .replace(/(?:并且|同时还|还会)/g,'；')
    .replace(/(?:进行了)(整理|分析|统计|记录|汇总|设计|核对)/g,'$1')
    .replace(/负责了/g,'负责').replace(/进行(?:相关的)?(整理|分析|统计|记录|汇总|核对)工作/g,'$1')
    .replace(/(?:相关的|一些)(?=资料|文件|数据|材料)/g,'')
    .replace(/老师交办的事情/g,'教师交办事项')
    .replace(/[，,；;]\s*[；;]/g,'；').replace(/^[；;\s]+|[；;\s]+$/g,'');
  const category=CATEGORIES.find(c=>c.source.test(source)&&c.jd.test(jd));
  if(category && !/^[^：:]{1,16}[：:]/.test(text)) text=`${category.label}：${text}`;
  return text;
}
export function validateRewrite(source,optimized) {
  if(typeof optimized !== 'string' || !optimized.trim()) throw new Error('优化段落不能为空');
  if(optimized.length > Math.max(source.length*2,source.length+80)) throw new Error('优化内容过长，请压缩到接近原文长度');
  const facts=source.match(/\d+(?:[.,/-]\d+)*(?:%|％)?/g)||[];
  const nextFacts=optimized.match(/\d+(?:[.,/-]\d+)*(?:%|％)?/g)||[];
  if(JSON.stringify([...facts].sort()) !== JSON.stringify([...nextFacts].sort())) throw new Error('数字或日期发生变化，请保留原有事实');
  const qualifications=['基础','入门','协助','参与','学习中','了解'];
  for(const word of qualifications) if(source.includes(word)&&!optimized.includes(word)) throw new Error(`请保留原文中的“${word}”，避免夸大职责或熟练度`);
  const stronger=['主导','独立负责','精通','专家','显著提升','大幅提升'];
  for(const word of stronger) if(!source.includes(word)&&optimized.includes(word)) throw new Error(`新增了“${word}”，需要原始事实支持`);
  return optimized.trim();
}
export function createRewriteRequest(paragraphs,jd) {
  return {schema:'applypilot-rewrite-v1',jd,paragraphs:paragraphs.filter(p=>p.editable).map(p=>({id:p.id,original:p.original}))};
}
