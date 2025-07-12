// stats.js
// Handles statistics storage and updates for AutoShorts

const STORAGE_KEY = {
  COUNT: "shortsWatchedCount",
  TIME: "totalTimeWatched",
  MANUAL_SKIP: "manuallySkippedCount"
};

const DEBUG = true;

function updateStats(durationMs) {
  try {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      if (DEBUG) console.error("AutoShorts: chrome.storage.local is not available in this context.");
      return;
    }
    chrome.storage.local.get([STORAGE_KEY.COUNT, STORAGE_KEY.TIME], (data) => {
      if (chrome.runtime.lastError) {
        if (DEBUG) console.error("AutoShorts: Error reading stats:", chrome.runtime.lastError);
        return;
      }
      const count = Number(data[STORAGE_KEY.COUNT]) || 0;
      const time = Number(data[STORAGE_KEY.TIME]) || 0;

      chrome.storage.local.set({
        [STORAGE_KEY.COUNT]: count + 1,
        [STORAGE_KEY.TIME]: time + durationMs
      }, () => {
        if (chrome.runtime.lastError) {
          if (DEBUG) console.error("AutoShorts: Error updating stats:", chrome.runtime.lastError);
        } else if (DEBUG) {
          console.log("AutoShorts: Stats updated. Count:", count + 1, "Time (ms):", time + durationMs);
        }
      });
    });
  } catch (e) {
    if (DEBUG) console.error("AutoShorts: Exception in updateStats:", e);
  }
}

function incrementManualSkip() {
  try {
    if (
      typeof chrome === "undefined" ||
      !chrome.storage ||
      !chrome.storage.local
    ) {
      if (DEBUG) console.error("AutoShorts: chrome.storage.local is not available in this context.");
      return;
    }
    chrome.storage.local.get([STORAGE_KEY.MANUAL_SKIP], (data) => {
      if (chrome.runtime.lastError) {
        if (DEBUG) console.error("AutoShorts: Error reading manual skip:", chrome.runtime.lastError);
        return;
      }
      const skips = Number(data[STORAGE_KEY.MANUAL_SKIP]) || 0;
      chrome.storage.local.set({
        [STORAGE_KEY.MANUAL_SKIP]: skips + 1
      }, () => {
        if (chrome.runtime.lastError) {
          if (DEBUG) console.error("AutoShorts: Error updating manual skip:", chrome.runtime.lastError);
        } else if (DEBUG) {
          console.log("AutoShorts: Manual skips updated. Count:", skips + 1);
        }
      });
    });
  } catch (e) {
    if (DEBUG) console.error("AutoShorts: Exception in incrementManualSkip:", e);
  }
}

export { STORAGE_KEY, updateStats, incrementManualSkip };
