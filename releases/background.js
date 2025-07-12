/**
 * background.js
 * Handles all chrome.storage operations for AutoShorts.
 * Listens for messages from content scripts and updates stats accordingly.
 * Also periodically checks all YouTube tabs for Shorts.
 */

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

// Listen for messages from content scripts for all storage operations
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("AutoShorts [BG]: Received message", message, "from", sender);

  if (message && message.action === "updateStats" && typeof message.durationMs === "number") {
    // Update shortsWatchedCount and totalTimeWatched
    chrome.storage.local.get(["shortsWatchedCount", "totalTimeWatched"], (data) => {
      const prevCount = data.shortsWatchedCount || 0;
      const prevTime = data.totalTimeWatched || 0;
      const newCount = prevCount + 1;
      const newTime = prevTime + message.durationMs;
      chrome.storage.local.set({
        shortsWatchedCount: newCount,
        totalTimeWatched: newTime
      }, () => {
        console.log(`AutoShorts [BG]: Updated stats - shortsWatchedCount: ${newCount}, totalTimeWatched: ${newTime}ms`);
        sendResponse({ success: true, shortsWatchedCount: newCount, totalTimeWatched: newTime });
      });
    });
    return true; // Keep the message channel open for async sendResponse
  }

  if (message && message.action === "incrementManualSkip") {
    // Update manuallySkippedCount
    chrome.storage.local.get(["manuallySkippedCount"], (data) => {
      const prevManual = data.manuallySkippedCount || 0;
      const newManual = prevManual + 1;
      chrome.storage.local.set({
        manuallySkippedCount: newManual
      }, () => {
        console.log(`AutoShorts [BG]: Incremented manuallySkippedCount: ${newManual}`);
        sendResponse({ success: true, manuallySkippedCount: newManual });
      });
    });
    return true; // Keep the message channel open for async sendResponse
  }

  // Unknown action
  sendResponse({ success: false, error: "Unknown action" });
  return false;
});
