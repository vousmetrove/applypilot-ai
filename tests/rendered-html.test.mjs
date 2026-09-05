import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/workspace.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const install = await readFile(new URL("../public/install.html", import.meta.url), "utf8");
const wechat = await readFile(new URL("../public/wechat.html", import.meta.url), "utf8");
const extensionManifest = JSON.parse(await readFile(new URL("../extension/manifest.json", import.meta.url), "utf8"));
const extensionPopup = await readFile(new URL("../extension/popup.js", import.meta.url), "utf8");

test("ships the resume workflow entry points", () => {
  assert.match(html, /岗位 JD/);
  assert.match(html, /硕士主修课程/);
  assert.match(html, /本科主修课程/);
  assert.match(html, /结构化 JSON/);
  assert.match(html, /投递进度/);
  assert.match(html, /证书与申请材料库/);
  assert.match(html, /已连接设备/);
  assert.match(html, /微信端进度页/);
});

test("preserves editing and truthful application guards", () => {
  assert.match(app, /不会因误触关闭/);
  assert.match(app, /unsupported_keywords_excluded/);
  assert.match(app, /autoSubmit:false/);
  assert.match(app, /\.docx/);
});

test("ships a real cross-browser pairing and mobile monitoring flow", () => {
  assert.equal(extensionManifest.manifest_version, 3);
  assert.match(extensionManifest.optional_host_permissions.join(" "), /https:\/\/\*/);
  assert.doesNotMatch(extensionPopup, /meiqi011216/);
  assert.match(extensionPopup, /api\/device\/pairings/);
  assert.match(extensionPopup, /api\/device\/profile/);
  assert.match(install, /Chrome/);
  assert.match(install, /Microsoft Edge/);
  assert.match(install, /QQ 浏览器/);
  assert.match(install, /夸克浏览器/);
  assert.match(wechat, /每 15 秒同步一次/);
  assert.match(wechat, /fill_current_form/);
  assert.match(wechat, /需要\[已认证服务号或小程序\]/);
});
