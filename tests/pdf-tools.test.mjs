import test from 'node:test';
import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
import {convertToPdf,detectDocument,PDF_LIMITS} from '../public/pdf-tools.mjs';
const file=(bytes,name='test.pdf')=>({name,size:bytes.length,arrayBuffer:async()=>bytes});
test('PDF conversion preserves number and dimensions of supplied pages',async()=>{
  const source=await PDFLib.PDFDocument.create();source.addPage([300,400]);source.addPage([400,300]);
  const out=await PDFLib.PDFDocument.load(await convertToPdf([file(await source.save())],PDFLib));
  assert.equal(out.getPageCount(),2);assert.equal(out.getPage(0).getWidth(),300);assert.equal(out.getPage(1).getWidth(),400);
});
test('image conversion creates a readable A4 PDF',async()=>{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8h0AAAAASUVORK5CYII=','base64');
  const out=await PDFLib.PDFDocument.load(await convertToPdf([file(png,'image.png')],PDFLib));
  assert.equal(out.getPageCount(),1);assert.equal(out.getPage(0).getWidth(),595.28);
});
test('unknown, renamed executable, corrupt and empty files fail instead of fake PDF',async()=>{
  assert.equal(detectDocument(Buffer.from('MZ pretend.pdf')),'unsupported');
  for(const bytes of [Buffer.from('MZ'),Buffer.from('%PDF-corrupt'),Buffer.alloc(0)]) await assert.rejects(convertToPdf([file(bytes,'bad.pdf')],PDFLib));
  await assert.rejects(convertToPdf([],PDFLib),/选择/);
});
test('batch conversion rejects mixed unsupported input atomically',async()=>{
  const source=await PDFLib.PDFDocument.create();source.addPage();
  await assert.rejects(convertToPdf([file(await source.save()),file(Buffer.from('fake docx'),'bad.docx')],PDFLib),/bad.docx/);
});
test('size and page limits enforced',async()=>{
  await assert.rejects(convertToPdf([{size:PDF_LIMITS.bytes+1}],PDFLib),/20 MB/);
  const source=await PDFLib.PDFDocument.create();for(let i=0;i<51;i++)source.addPage();
  await assert.rejects(convertToPdf([file(await source.save())],PDFLib),/50 页/);
});
