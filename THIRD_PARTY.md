# Third-party components

The application uses the dependencies and versions pinned in `package-lock.json`.

Browser bundles added in v1.1:

| Component | Purpose | License |
|---|---|---|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Local image/PDF conversion | MIT |
| [fflate](https://github.com/101arrowz/fflate) | ZIP packaging and DOCX preservation | MIT |

`npm run assets:build` copies their license files into `public/vendor/` and the extension package. Generated browser bundles are rebuilt from npm dependencies rather than edited manually.
# 文档导入与文字识别

- PDF.js / pdfjs-dist：Apache-2.0，用于文本 PDF 读取与扫描页渲染；许可证随 vendor 和插件包附带。
- Tesseract.js 与 tesseract.js-core：Apache-2.0，用于浏览器本机 OCR；许可证随 vendor 和插件包附带。
- @tesseract.js-data/eng 和 @tesseract.js-data/chi_sim：分发包声明 MIT，来自 naptha/tessdata 的中英文字库。字库随产品静态资源打包，不将用户图片发送到字库来源。
