(function () {
  "use strict";

  const encoder = new TextEncoder();
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function u16(value) {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  }

  function u32(value) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  }

  function join(parts) {
    const size = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { output.set(part, offset); offset += part.length; }
    return output;
  }

  function zipStore(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
      const crc = crc32(data);
      const local = join([
        u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data,
      ]);
      locals.push(local);
      centrals.push(join([
        u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
        u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(offset), name,
      ]));
      offset += local.length;
    }
    const central = join(centrals);
    return join([
      ...locals,
      central,
      u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
      u32(central.length), u32(offset), u16(0),
    ]);
  }

  function esc(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function p(text, style, bold) {
    if (!String(text || "").trim()) return "";
    const styleXml = style ? `<w:pStyle w:val="${style}"/>` : "";
    const runProps = bold ? "<w:rPr><w:b/></w:rPr>" : "";
    return `<w:p><w:pPr>${styleXml}</w:pPr><w:r>${runProps}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
  }

  function datedRow(title, dates) {
    return `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9360"/></w:tabs><w:spacing w:before="80" w:after="40"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>${esc(title)}</w:t></w:r><w:r><w:tab/><w:t>${esc(dates || "")}</w:t></w:r></w:p>`;
  }

  function entryXml(entry) {
    const bullets = (entry.bullets || []).map((item) => p(`• ${item}`, "Bullet")).join("");
    const detail = entry.detail ? p(entry.detail, "Detail") : "";
    return `${datedRow(entry.title, entry.dates)}${detail}${bullets}`;
  }

  function section(title, content) {
    return content ? `${p(title, "Heading1")}${content}` : "";
  }

  function create(payload) {
    const education = (payload.education || []).map(entryXml).join("");
    const experience = (payload.experience || []).map(entryXml).join("");
    const projects = (payload.projects || []).map(entryXml).join("");
    const skills = (payload.skills || []).map((item) => p(`${item.label}：${item.value}`, "Detail")).join("");
    const attachmentChecklist = (payload.attachments || []).length
      ? (payload.attachments || []).map((item) => p(`□ ${item}`, "Detail")).join("")
      : "";
    const body = [
      p(payload.name || "候选人", "Title"),
      p(payload.subtitle || "", "Subtitle"),
      p(payload.contact || "", "Contact"),
      section("岗位摘要", p(payload.summary || "", "Normal")),
      section("教育背景", education),
      section("相关经历", experience),
      section("核心项目", projects),
      section("技能与成果", skills),
      section("申请材料清单（提交前人工确认）", attachmentChecklist),
    ].join("");

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
    const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Microsoft YaHei" w:hAnsi="Arial"/><w:sz w:val="21"/><w:szCs w:val="21"/><w:color w:val="172235"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="38"/><w:szCs w:val="38"/><w:color w:val="102139"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="344258"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Contact"><w:name w:val="Contact"/><w:pPr><w:spacing w:after="160"/></w:pPr><w:rPr><w:sz w:val="19"/><w:color w:val="68768A"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:spacing w:before="220" w:after="100"/><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="BFC8D4"/></w:pBdr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="23"/><w:color w:val="152640"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Detail"><w:name w:val="Detail"/><w:rPr><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Bullet"><w:name w:val="Bullet"/><w:pPr><w:ind w:left="240" w:hanging="160"/><w:spacing w:after="40"/></w:pPr><w:rPr><w:sz w:val="20"/></w:rPr></w:style></w:styles>`;
    const created = new Date().toISOString();
    const files = [
      { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
      { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
      { name: "word/document.xml", content: documentXml },
      { name: "word/styles.xml", content: stylesXml },
      { name: "word/_rels/document.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: "docProps/core.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(payload.title || "岗位定向简历")}</dc:title><dc:creator>简投 ApplyPilot</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>` },
      { name: "docProps/app.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>简投 ApplyPilot</Application></Properties>` },
    ];
    return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  }

  window.ApplyPilotDocx = { create };
})();
