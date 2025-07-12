// AutoShorts Popup Script

const STORAGE_KEY = {
  COUNT: "shortsWatchedCount",
  TIME: "totalTimeWatched"
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

function updateStatsUI(count, timeMs) {
  document.getElementById("shorts-count").textContent = count;
  document.getElementById("time-watched").textContent = formatTime(timeMs);
}

function loadStats() {
  chrome.storage.sync.get([STORAGE_KEY.COUNT, STORAGE_KEY.TIME], (data) => {
    const count = Number(data[STORAGE_KEY.COUNT]) || 0;
    const time = Number(data[STORAGE_KEY.TIME]) || 0;
    updateStatsUI(count, time);
  });
}

function resetStats() {
  chrome.storage.sync.set({
    [STORAGE_KEY.COUNT]: 0,
    [STORAGE_KEY.TIME]: 0
  }, loadStats);
}

document.addEventListener("DOMContentLoaded", () => {
  loadStats();

  document.getElementById("reset-button").addEventListener("click", () => {
    if (confirm("Reset all AutoShorts stats? This cannot be undone.")) {
      resetStats();
    }
  });
});
