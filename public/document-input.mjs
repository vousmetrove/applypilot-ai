import {readTemplate} from './docx-template.mjs';
const asset=name=>new URL(`./vendor/${name}`,import.meta.url).href;
let ocrLoading;
async function recognize(image,progress) {
  if(!globalThis.Tesseract) {
    ocrLoading ||= new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=asset('tesseract.min.js');script.onload=resolve;script.onerror=()=>reject(Error('OCR 组件加载失败，请检查安装包'));document.head.append(script);});
    await ocrLoading;
  }
  const worker=await globalThis.Tesseract.createWorker('chi_sim+eng',1,{workerPath:asset('ocr-worker.min.js'),corePath:asset('tesseract-core-lstm.wasm.js'),langPath:asset('ocr-data'),workerBlobURL:false,logger:m=>progress(`图片识别：${m.status} ${Math.round((m.progress||0)*100)}%`)});
  try {const {data}=await worker.recognize(image);return {text:data.text,confidence:data.confidence};}finally{await worker.terminate();}
}
export async function readDocument(file,progress=()=>{}) {
  if(!file||file.size>20*1024*1024)throw Error('文件最多 20 MB');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(/\.docx$/i.test(file.name)) {
    const template=readTemplate(bytes);
    return {text:template.paragraphs.map(p=>p.original).filter(Boolean).join('\n'),method:'Word 文本提取',template};
  }
  if(/\.doc$/i.test(file.name))throw Error('旧版 .doc 暂不能直接解析，请在 Word/WPS 另存为 .docx 或 PDF 后上传');
  if(String.fromCharCode(...bytes.slice(0,5))==='%PDF-') {
    const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=asset('pdf.worker.mjs');
    const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,cMapUrl:asset('cmaps/'),cMapPacked:true,standardFontDataUrl:asset('standard_fonts/')});
    let pdf;
    try {
      pdf=await task.promise;if(pdf.numPages>20)throw Error('简历 PDF 最多 20 页');
      const pages=[];let scans=0;
      for(let i=1;i<=pdf.numPages;i++) {
        progress(`读取 PDF 第 ${i}/${pdf.numPages} 页`);const page=await pdf.getPage(i);const content=await page.getTextContent();
        const rows=[];let current='',lastY;
        for(const item of content.items){if(!('str'in item))continue;const y=item.transform[5];if(lastY!==undefined&&Math.abs(y-lastY)>3&&current){rows.push(current);current='';}current+=item.str+' ';lastY=y;if(item.hasEOL){rows.push(current);current='';}}
        if(current)rows.push(current);let text=rows.join('\n');
        if(text.replace(/\s/g,'').length<30){if(++scans>5)throw Error('扫描 PDF 最多识别 5 页，请拆分后导入');const initial=page.getViewport({scale:1});const scale=Math.min(2,2200/Math.max(initial.width,initial.height));const viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;text=(await recognize(canvas,progress)).text;canvas.width=canvas.height=0;}
        pages.push(text);page.cleanup();
      }
      const text=pages.join('\n');if(text.trim().length<10)throw Error('未能识别有效文字，请使用清晰的文件或粘贴原文');
      return {text,method:scans?'PDF 文本与扫描识别，请重点核对 OCR':'PDF 文本提取，请核对多栏阅读顺序'};
    }finally{await task.destroy();}
  }
  const isPNG=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,isJPEG=bytes[0]===255&&bytes[1]===216;
  if(isPNG||isJPEG) {
    const bitmap=await createImageBitmap(file);try{if(bitmap.width*bitmap.height>40000000)throw Error('图片分辨率过大，最多 4000 万像素');const canvas=document.createElement('canvas');const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const result=await recognize(canvas,progress);canvas.width=canvas.height=0;if(result.text.trim().length<10)throw Error('图片文字不足或不清晰，请重新上传');return {...result,method:`图片 OCR（识别置信度 ${Math.round(result.confidence)}%，仍需核对）`};}finally{bitmap.close();}
  }
  throw Error('支持 DOCX、PDF、PNG、JPEG；请检查文件格式');
}
