// background.js
// Periodically checks all YouTube tabs for Shorts and sends a message to trigger skip logic.

chrome.alarms.create('checkShorts', { periodInMinutes: 0.1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkShorts') {
    chrome.tabs.query({ url: "*://*.youtube.com/shorts/*" }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: "autoShortsCheck" });
      }
    });
  }
});
