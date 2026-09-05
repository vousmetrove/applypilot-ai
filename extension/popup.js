const $ = s => document.querySelector(s);
let apiBase = "";
let savedPayload = null;
let device = null;
let currentPairing = null;
let pairingTimer = null;

function detectPlatform(url = "") {
  if (/jobs?\.feishu\.cn|larksuite/i.test(url)) return "已识别：飞书招聘";
  if (/mokahr\.com/i.test(url)) return "已识别：Moka 招聘";
  return "当前页面：通用表单模式";
}

function updateState(payload) {
  savedPayload = payload;
  const p = payload?.profile;
  const ready = Boolean(p?.name);
  $("#profileState").classList.toggle("ready", ready);
  $("#profileName").textContent = ready ? p.name : "尚未连接";
  $("#profileMeta").textContent = ready ? `${p.school || "学校待补充"} · ${p.targetRole || p.targetRoleFamilies || p.major || "岗位待选择"}` : "用手机授权后，档案会自动同步";
  $("#connectBox").classList.toggle("hidden", ready || !apiBase);
  $("#fillBtn").disabled = !ready;
  $("#disconnectBtn").classList.toggle("hidden", !device && !ready);
}

function normalizeApiBase(raw) {
  const url = new URL(String(raw || "").trim());
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("服务地址必须使用 HTTPS；本机开发可使用 localhost HTTP");
  }
  url.pathname = ""; url.search = ""; url.hash = "";
  return url.origin;
}

function permissionPattern(base) {
  const url = new URL(base);
  return `${url.protocol}//${url.hostname}/*`;
}

function updateBackendState() {
  $("#backendSetup").classList.toggle("hidden", Boolean(apiBase));
  $("#apiBaseInput").value = apiBase;
  $("#connectBox").classList.toggle("hidden", Boolean(savedPayload?.profile?.name) || !apiBase);
}

async function saveApiBase() {
  try {
    const nextBase = normalizeApiBase($("#apiBaseInput").value);
    const granted = await chrome.permissions.request({origins:[permissionPattern(nextBase)]});
    if (!granted) throw new Error("未获得该服务地址的访问权限");
    if (apiBase && apiBase !== nextBase) {
      device = null; savedPayload = null;
      await chrome.storage.local.remove(["applypilotDevice","applypilotPayload","applypilotCommands"]);
    }
    apiBase = nextBase;
    await chrome.storage.local.set({applypilotApiBase:apiBase});
    updateBackendState(); updateState(savedPayload);
    showResult("服务地址已保存，可以开始扫码连接。", false);
  } catch (error) { showResult(error.message || "服务地址无效", true); }
}

function parsePayload(raw) {
  const data = JSON.parse(raw);
  const payload = data.profile ? data : {schema:"applypilot-profile-v1", profile:data, consent:{autoSubmit:false}};
  if (!payload.profile?.name) throw new Error("没有找到姓名字段，请重新从简投复制数据");
  payload.consent = {...payload.consent, autoSubmit:false};
  return payload;
}

async function saveRaw(raw) {
  try {
    const payload = parsePayload(raw.trim());
    await chrome.storage.local.set({applypilotPayload:payload});
    updateState(payload);
    showResult("档案已保存。现在可以填写当前页面。", false);
  } catch (err) { showResult(err.message || "数据格式无法识别", true); }
}

function showResult(message, error = false) {
  const el = $("#result"); el.textContent = message; el.classList.remove("hidden"); el.classList.toggle("error", error);
}

$("#replaceBtn").addEventListener("click", () => saveRaw($("#replaceJson").value));

async function api(path, options = {}) {
  if (!apiBase) throw new Error("请先填写简投服务地址");
  const headers = {...(options.headers || {})};
  if (device?.token) headers.Authorization = `Bearer ${device.token}`;
  const response = await fetch(`${apiBase}${path}`, {...options, headers});
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) throw new Error(data.error || `连接失败（${response.status}）`);
  return {response, data};
}

async function syncProfile() {
  if (!device?.token) return false;
  try {
    const {data} = await api("/api/device/profile");
    if (!data.profile || !Object.keys(data.profile).length) throw new Error("主档案还是空的，请先在简投工作台填写并保存");
    savedPayload = data;
    await chrome.storage.local.set({applypilotPayload:data, applypilotDevice:device});
    updateState(savedPayload);
    return true;
  } catch (error) {
    showResult(error.message || "档案同步失败", true);
    return false;
  }
}

async function startPairing() {
  $("#pairBtn").disabled = true;
  showResult("", false);
  $("#result").classList.add("hidden");
  try {
    const browser = await chrome.runtime.getPlatformInfo();
    const {data} = await api("/api/device/pairings", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({deviceName:`${detectPlatform((await chrome.tabs.query({active:true,currentWindow:true}))[0]?.url || "").replace("已识别：","")} · ${browser.os}`})});
    currentPairing = data;
    $("#pairing").classList.remove("hidden");
    $("#pairingQr").src = `${apiBase}/api/device/pairings/${encodeURIComponent(data.pairingId)}/qr?code=${encodeURIComponent(data.code)}`;
    $("#pairingCode").textContent = data.code;
    $("#pairingState").textContent = "等待手机确认…";
    pairingTimer = setInterval(claimPairing, 2000);
    await claimPairing();
  } catch (error) {
    $("#pairBtn").disabled = false;
    showResult(error.message || "无法生成配对码，请稍后重试", true);
  }
}

async function claimPairing() {
  if (!currentPairing) return;
  try {
    const {response,data} = await api(`/api/device/pairings/${encodeURIComponent(currentPairing.pairingId)}/claim`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({code:currentPairing.code})});
    if (response.status === 202) return;
    if (data.status !== "active" || !data.token) return;
    clearInterval(pairingTimer);
    device = {pairingId:data.pairingId, token:data.token, deviceName:data.deviceName};
    await chrome.storage.local.set({applypilotDevice:device});
    $("#pairingState").textContent = "连接成功，正在同步档案…";
    if (await syncProfile()) showResult("设备已连接，主档案已自动同步。", false);
    await loadCommands();
  } catch (error) {
    clearInterval(pairingTimer);
    $("#pairingState").textContent = error.message || "配对已失效";
    $("#pairBtn").disabled = false;
  }
}

async function reportEvent(type, payload = {}) {
  if (!device?.token) return;
  try {
    const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
    await api("/api/device/events", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({type, platform:detectPlatform(tab?.url || ""), payload})});
  } catch {}
}

async function completeCommand(commandId, status, result = {}) {
  try { await api("/api/device/commands", {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({commandId,status,result})}); } catch {}
  await loadCommands();
}

async function executeRemote(command) {
  try {
    if (command.type === "sync_profile") {
      const ok = await syncProfile(); await completeCommand(command.id, ok ? "completed" : "failed"); return;
    }
    if (command.type === "open_application") {
      const url = String(command.payload?.url || "");
      if (!/^https:\/\//.test(url)) throw new Error("任务链接无效");
      await chrome.tabs.create({url}); await completeCommand(command.id,"completed",{opened:true}); return;
    }
    if (command.type === "analyze_current_form" || command.type === "fill_current_form") {
      const result = await runOnCurrentTab(command.type === "fill_current_form" ? "APPLYPILOT_FILL" : "APPLYPILOT_ANALYZE");
      await completeCommand(command.id,"completed",result); showFillResult(result, command.type === "fill_current_form"); return;
    }
  } catch (error) { await completeCommand(command.id,"failed",{message:error.message || "执行失败"}); showResult(error.message || "执行失败",true); }
}

async function loadCommands() {
  if (!device?.token) return;
  try {
    const {data} = await api("/api/device/commands");
    const commands = data.commands || [];
    $("#remoteBox").classList.toggle("hidden", !commands.length);
    $("#remoteList").innerHTML = commands.map(command => `<div class="remote-item"><span>${({sync_profile:"同步最新档案",open_application:"打开指定申请页",analyze_current_form:"分析当前表单",fill_current_form:"填写当前表单"})[command.type] || "待办任务"}<small>执行前需要你确认</small></span><div><button data-run="${command.id}">执行</button><button data-decline="${command.id}">拒绝</button></div></div>`).join("");
    $("#remoteList").querySelectorAll("[data-run]").forEach(button => button.addEventListener("click", () => executeRemote(commands.find(c => c.id === button.dataset.run))));
    $("#remoteList").querySelectorAll("[data-decline]").forEach(button => button.addEventListener("click", () => completeCommand(button.dataset.decline,"declined")));
    await chrome.action.setBadgeText({text:commands.length ? "!" : ""});
  } catch {}
}

async function runOnCurrentTab(messageType) {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.id || /^chrome|^edge|^about/.test(tab.url || "")) throw new Error("浏览器系统页面不允许读取，请打开招聘申请表后重试");
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
  const response = await chrome.tabs.sendMessage(tab.id,{type:messageType,payload:savedPayload});
  if (!response?.ok) throw new Error(response?.message || "当前页面没有找到可识别字段");
  return response;
}

function showFillResult(response, filled = true) {
  const missing = response.requiredMissing?.length ? ` 仍缺少必填：${response.requiredMissing.slice(0,5).join("、")}。` : "";
  const files = response.attachmentFields?.length ? ` 检测到 ${response.attachmentFields.length} 个附件上传框，需由你选择对应文件。` : "";
  showResult(filled ? `已填写 ${response.filled} 项，跳过 ${response.skipped} 项。${missing}${files}请检查绿色标记；验证码、声明与最终提交必须手动完成。` : `识别到 ${response.recognized} 个可匹配字段。${missing}${files}确认无误后可执行填写。`);
}

$("#pairBtn").addEventListener("click", startPairing);
$("#saveApiBase").addEventListener("click", saveApiBase);
$("#changeBackendBtn").addEventListener("click", () => { $("#backendSetup").classList.remove("hidden"); $("#apiBaseInput").focus(); });
$("#copyLinkBtn").addEventListener("click", async () => {
  if (!currentPairing?.confirmUrl) return;
  await navigator.clipboard.writeText(currentPairing.confirmUrl);
  $("#pairingState").textContent = "连接链接已复制，可发送到微信文件传输助手";
});
$("#disconnectBtn").addEventListener("click", async () => {
  if (!confirm("断开这台浏览器？之后需要重新扫码连接。")) return;
  device = null; savedPayload = null; currentPairing = null; clearInterval(pairingTimer);
  await chrome.storage.local.remove(["applypilotDevice","applypilotPayload","applypilotCommands"]);
  updateState(null); $("#connectBox").classList.remove("hidden"); $("#pairBtn").disabled = false;
});
$("#fillBtn").addEventListener("click", async () => {
  try {
    if (device?.token) await syncProfile();
    const response = await runOnCurrentTab("APPLYPILOT_FILL");
    showFillResult(response, true);
    await reportEvent("form_filled", {filled:response.filled,requiredMissing:response.requiredMissing?.length || 0});
  } catch (err) { showResult(err.message || "填写失败，请刷新申请页面后重试", true); }
});

chrome.tabs.query({active:true,currentWindow:true}).then(([tab]) => $("#platform").textContent = detectPlatform(tab?.url));
chrome.storage.local.get(["applypilotPayload","applypilotDevice","applypilotApiBase"]).then(async ({applypilotPayload,applypilotDevice,applypilotApiBase}) => {
  apiBase = applypilotApiBase || ""; device = applypilotDevice || null; updateState(applypilotPayload || null); updateBackendState();
  if (device?.token) await syncProfile();
  await loadCommands();
  if (device?.token) await reportEvent("page_detected");
  chrome.runtime.sendMessage({type:"APPLYPILOT_POLL_COMMANDS"});
});
