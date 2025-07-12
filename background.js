// background.js
// Periodically checks all YouTube tabs for Shorts and sends a message to trigger skip logic.

chrome.alarms.create('checkShorts', { periodInMinutes: 0.1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkShorts') {
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, (tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { action: "autoShortsCheck" }, (response) => {
          if (chrome.runtime.lastError) {
            // Suppress "Could not establish connection" error if no receiver exists
            if (chrome.runtime.lastError.message.includes("Could not establish connection")) {
              if (typeof DEBUG !== "undefined" && DEBUG) {
                console.warn("AutoShorts: No content script in tab", tab.id, "-", chrome.runtime.lastError.message);
              }
            } else {
              console.error("AutoShorts: Error sending message to tab", tab.id, "-", chrome.runtime.lastError.message);
            }
          }
        });
      }
    });
  }
});
