export const PDF_LIMITS = { bytes:20 * 1024 * 1024, pages:50, pixels:40000000 };
export function detectDocument(bytes) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (String.fromCharCode(...bytes.slice(0,5)) === '%PDF-') return 'pdf';
  return 'unsupported';
}
export async function convertToPdf(files, PDFLib, normalizeImage) {
  if (!files.length) throw new Error('请先选择 PDF、PNG 或 JPEG 文件');
  if (files.reduce((total,f) => total + f.size, 0) > PDF_LIMITS.bytes) throw new Error('所选文件总大小不能超过 20 MB');
  const out = await PDFLib.PDFDocument.create();
  for (const file of files) {
    try {
      let bytes = new Uint8Array(await file.arrayBuffer());
      let kind = detectDocument(bytes);
      if (kind === 'unsupported') throw new Error('暂不支持该格式；Office 文档请先在原软件中导出 PDF');
      if (kind === 'pdf') {
        const source = await PDFLib.PDFDocument.load(bytes);
        if (!source.getPageCount()) throw new Error('PDF 没有页面');
        if (out.getPageCount() + source.getPageCount() > PDF_LIMITS.pages) throw new Error('最多合并 50 页');
        const pages = await out.copyPages(source, source.getPageIndices());
        pages.forEach(page => out.addPage(page));
      } else {
        if (normalizeImage) { bytes = await normalizeImage(bytes, kind); kind = 'png'; }
        const img = kind === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        if (img.width * img.height > PDF_LIMITS.pixels) throw new Error('单张图片不能超过 4000 万像素');
        if (out.getPageCount() >= PDF_LIMITS.pages) throw new Error('最多合并 50 页');
        const page = out.addPage([595.28,841.89]);
        const size = img.scale(Math.min(547.28 / img.width, 793.89 / img.height));
        page.drawImage(img, {x:(595.28-size.width)/2,y:(841.89-size.height)/2,...size});
      }
    } catch (error) { throw new Error(`${file.name}：${error.message}`); }
  }
  out.setProducer('ApplyPilot local PDF converter');
  const bytes = await out.save();
  if (bytes.byteLength > PDF_LIMITS.bytes) throw new Error('生成的 PDF 超过 20 MB，请减少文件数量');
  return bytes;
}
