// AutoShorts Popup Script

const STORAGE_KEY = {
  COUNT: "shortsWatchedCount",
  TIME: "totalTimeWatched",
  MANUAL_SKIP: "manuallySkippedCount"
};

function formatTime(ms) {
  let totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  let str = "";
  if (hours > 0) str += hours + "h ";
  if (minutes > 0 || hours > 0) str += minutes + "m ";
  str += seconds + "s";
  return str.trim();
}

function updateStatsUI(count, timeMs, manualSkipped) {
  document.getElementById("shorts-count").textContent = count;
  document.getElementById("time-watched").textContent = formatTime(timeMs);
  document.getElementById("manual-skipped-count").textContent = manualSkipped;
}

function loadStats() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([STORAGE_KEY.COUNT, STORAGE_KEY.TIME, STORAGE_KEY.MANUAL_SKIP], (data) => {
      const count = Number(data[STORAGE_KEY.COUNT]) || 0;
      const time = Number(data[STORAGE_KEY.TIME]) || 0;
      const manualSkipped = Number(data[STORAGE_KEY.MANUAL_SKIP]) || 0;
      updateStatsUI(count, time, manualSkipped);
    });
  } else {
    // Fallback for local testing
    const count = 0;
    const time = 0;
    const manualSkipped = 0;
    updateStatsUI(count, time, manualSkipped);
  }
}

function resetStats() {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      [STORAGE_KEY.COUNT]: 0,
      [STORAGE_KEY.TIME]: 0,
      [STORAGE_KEY.MANUAL_SKIP]: 0
    }, loadStats);
  } else {
    // Fallback for local testing
    updateStatsUI(0, 0, 0);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadStats();

  document.getElementById("reset-button").addEventListener("click", () => {
    if (confirm("Reset all AutoShorts stats? This cannot be undone.")) {
      resetStats();
    }
  });

});
