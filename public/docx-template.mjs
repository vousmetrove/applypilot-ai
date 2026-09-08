import {unzipSync,zipSync,strFromU8,strToU8} from './vendor/fflate.mjs';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export function readTemplate(bytes) {
  if(bytes.byteLength > 20*1024*1024) throw new Error('原 Word 文件不能超过 20 MB');
  let expanded=0,count=0;
  const entries=unzipSync(bytes,{filter:file=>{
    expanded+=file.originalSize;count++;
    if(expanded>80*1024*1024 || count>2000) throw new Error('文档解压后过大');
    if(file.name.includes('..') || file.name.startsWith('/') || /vbaProject|\.bin$/i.test(file.name)) throw new Error('不支持含宏或嵌入程序的文档');
    return true;
  }});
  if(!entries['word/document.xml']) throw new Error('请选择可编辑的 .docx 文件；PDF 和旧版 DOC 不能直接保留版式改写');
  const xml=strFromU8(entries['word/document.xml']);
  if(/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('不支持含外部实体的文档');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('Word 文档结构损坏');
  const paragraphs=[...doc.getElementsByTagNameNS(W,'p')].map((node,id)=>{
    const texts=[...node.getElementsByTagNameNS(W,'t')];
    const original=texts.map(t=>t.textContent).join('');
    const protectedTags=['drawing','object','fldChar','instrText','tab','br','del','ins','sdt'];
    const protectedContent=protectedTags.some(tag=>node.getElementsByTagNameNS(W,tag).length);
    const editable=original.length>=20 && original.length<=2000 && !protectedContent && !/@|https?:\/\//.test(original) && !/^\s*(?:电话|手机|邮箱|姓名|出生|证件)/.test(original);
    return {id,node,texts,original,optimized:original,editable};
  });
  return {entries,doc,paragraphs};
}
function distributeText(nodes, replacement) {
  const original=nodes.map(n=>n.textContent).join('');
  const owner=[];nodes.forEach((n,index)=>{for(let i=0;i<n.textContent.length;i++)owner.push(index);});
  const width=replacement.length+1;
  const lcs=new Uint16Array((original.length+1)*width);
  for(let i=original.length-1;i>=0;i--)for(let j=replacement.length-1;j>=0;j--)lcs[i*width+j]=original[i]===replacement[j]?1+lcs[(i+1)*width+j+1]:Math.max(lcs[(i+1)*width+j],lcs[i*width+j+1]);
  const output=nodes.map(()=> '');let i=0,j=0;
  while(j<replacement.length) {
    if(i<original.length&&original[i]===replacement[j]) {output[owner[i]]+=replacement[j++];i++;}
    else if(i<original.length&&lcs[(i+1)*width+j]>lcs[i*width+j+1]) i++;
    else {output[owner[Math.min(i,owner.length-1)] || 0]+=replacement[j++];}
  }
  nodes.forEach((node,index)=>{node.textContent=output[index];node.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');});
}
export function exportTemplate(template,edits) {
  // Work on a new XML tree for every export; the uploaded original stays unchanged.
  const cloned=readTemplate(zipSync(template.entries));
  for(const edit of edits) {
    const paragraph=cloned.paragraphs.find(p=>p.id===edit.id);
    if(!paragraph?.editable) throw new Error('该段落含特殊布局，无法安全改写');
    if(typeof edit.optimized !== 'string' || edit.optimized.length>3000) throw new Error('段落内容过长');
    if(edit.optimized!==paragraph.original) distributeText(paragraph.texts,edit.optimized);
  }
  cloned.entries['word/document.xml']=strToU8(new XMLSerializer().serializeToString(cloned.doc));
  return zipSync(cloned.entries);
}
