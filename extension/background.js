async function pollCommands() {
  const { applypilotDevice, applypilotApiBase } = await chrome.storage.local.get(["applypilotDevice", "applypilotApiBase"]);
  if (!applypilotDevice?.token || !applypilotApiBase) return;
  try {
    const response = await fetch(`${applypilotApiBase}/api/device/commands`, { headers: { Authorization: `Bearer ${applypilotDevice.token}` } });
    if (!response.ok) return;
    const data = await response.json();
    const commands = data.commands || [];
    await chrome.storage.local.set({ applypilotCommands: commands });
    await chrome.action.setBadgeText({ text: commands.length ? "!" : "" });
    if (commands.length) await chrome.action.setBadgeBackgroundColor({ color: "#f0a740" });
  } catch {}
}

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") chrome.runtime.openOptionsPage();
  chrome.alarms.create("applypilot-command-poll", { periodInMinutes: 1 });
  pollCommands();
});
chrome.runtime.onStartup.addListener(pollCommands);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "applypilot-command-poll") pollCommands(); });
chrome.runtime.onMessage.addListener(message => { if (message?.type === "APPLYPILOT_POLL_COMMANDS") pollCommands(); });
