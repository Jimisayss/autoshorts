/**
 * AutoShorts Content Script
 * Handles automatic skipping of YouTube Shorts and tracks viewing statistics.
 * This version includes enhancements for robustness and debug logging.
 *
 * **MODIFIED TO SUPPORT BACKGROUND TAB OPERATION**
 */

// Set to true for verbose console logging, false for quieter operation.
const DEBUG = true;

const STORAGE_KEY = {
  COUNT: "shortsWatchedCount",
  TIME: "totalTimeWatched"
};

let currentVideo = null;
let videoStartTime = null;
let lastShortId = null;

function isShortsPage() {
  const isShort = /^\/shorts\/[A-Za-z0-9_-]+/.test(window.location.pathname);
  return isShort;
}

function getShortId() {
  const match = window.location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function getVideoElement() {
  let video = document.querySelector('ytd-reel-video-renderer[is-active] video') ||
              document.querySelector('ytd-reel-video-renderer video') ||
              document.querySelector('video.html5-main-video');
  if (!video && DEBUG) {
    console.warn("AutoShorts: Video element not found.");
  }
  return video;
}

function getNextButton() {
  let btn = document.querySelector('button[aria-label="Next video"]') ||
            document.querySelector('button[aria-label="Next short"]') ||
            document.querySelector('button[aria-label="Next"]') ||
            document.querySelector('#navigation-button > ytd-button-renderer > yt-button-shape > button[aria-label="Next video"]') ||
            document.querySelector('#navigation-button > ytd-button-renderer > yt-button-shape > button[aria-label="Next short"]') ||
            document.querySelector('button[aria-label*="Down"]');

  if (!btn && DEBUG) {
    console.warn("AutoShorts: Next button not found.");
  }
  return btn;
}

function skipShort() {
    if (DEBUG) console.log("AutoShorts: Attempting to skip short.");
    const video = getVideoElement();
    if (video) {
        // To ensure stats are counted, we simulate the end of the video
        const watchedMs = videoStartTime ? Date.now() - videoStartTime : (video.duration * 1000);
        updateStats(watchedMs || 0);
    }
    
    const nextBtn = getNextButton();
    if (nextBtn) {
      if (DEBUG) console.log("AutoShorts: Clicking 'Next' button.", nextBtn);
      nextBtn.click();
    } else {
      if (DEBUG) console.warn("AutoShorts: 'Next' button not found, falling back to ArrowDown simulation.");
      // The ArrowDown simulation from your original code is a good fallback
      const event = new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true, cancelable: true });
      window.dispatchEvent(event);
    }
}

function updateStats(durationMs) {
  // This function remains the same as your original.
  try {
    chrome.storage.sync.get([STORAGE_KEY.COUNT, STORAGE_KEY.TIME], (data) => {
      if (chrome.runtime.lastError) {
        if (DEBUG) console.error("AutoShorts: Error reading stats:", chrome.runtime.lastError);
        return;
      }
      const count = Number(data[STORAGE_KEY.COUNT]) || 0;
      const time = Number(data[STORAGE_KEY.TIME]) || 0;

      chrome.storage.sync.set({
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

function onVideoPlaying() {
  videoStartTime = Date.now();
  if (DEBUG) console.log("AutoShorts: Video started playing or resumed. Start time:", videoStartTime, currentVideo);
}

function onVideoTimeUpdate() {
  if (!currentVideo) return;
  const remaining = currentVideo.duration - currentVideo.currentTime;
  if (remaining <= 0.2 && !currentVideo._autoShortsSkipped) {
    currentVideo._autoShortsSkipped = true; // Mark as skipped to prevent multiple triggers
    skipShort();
  }
}

function cleanupVideoListeners() {
  if (currentVideo) {
    currentVideo.removeEventListener("playing", onVideoPlaying);
    currentVideo.removeEventListener("timeupdate", onVideoTimeUpdate);
  }
}

function setupForCurrentShort() {
  if (!isShortsPage()) {
    if (lastShortId) {
      cleanupVideoListeners();
      currentVideo = null;
      lastShortId = null;
    }
    return;
  }

  const shortId = getShortId();
  if (shortId && shortId !== lastShortId) {
    if (DEBUG) console.log(`AutoShorts: New short detected (ID: ${shortId}). Setting up.`);
    cleanupVideoListeners();
    lastShortId = shortId;
    
    // Use a timeout to wait for the video element to be available
    setTimeout(() => {
        currentVideo = getVideoElement();
        if (currentVideo) {
          currentVideo._autoShortsSkipped = false;
          currentVideo.addEventListener("playing", onVideoPlaying);
          currentVideo.addEventListener("timeupdate", onVideoTimeUpdate);
          if (!currentVideo.paused) {
            onVideoPlaying();
          }
        } else if (DEBUG) {
          console.warn(`AutoShorts: Short detected (ID: ${shortId}), but video element not found after delay.`);
        }
    }, 500); // Wait 500ms for the DOM to settle
  }
}

// Observe navigation and DOM changes.
const observer = new MutationObserver(() => {
    // The observer only needs to trigger a setup check.
    // The actual logic is handled by setupForCurrentShort and the background pings.
    setupForCurrentShort();
});

observer.observe(document.body, { childList: true, subtree: true });

 // Initial setup on script load.
 setupForCurrentShort();

 // ✅ **MAJOR CHANGE HERE**
 // Listen for background script messages to trigger logic.
 chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
   if (msg && msg.action === "autoShortsCheck") {
     if (DEBUG) console.log("AutoShorts: Received check from background. Page is hidden:", document.hidden);

     // Only run proactive skip logic if the tab is hidden and on a shorts page
     if (document.hidden && isShortsPage()) {
        const video = getVideoElement();
        // If there's a video and its almost done, or if we just can't tell, we skip.
        if (video && video.duration > 0 && video.currentTime / video.duration > 0.95) {
             if (!video._autoShortsSkipped) {
                video._autoShortsSkipped = true;
                skipShort();
             }
        }
     }
     
     // Always run setup in case we just navigated to a shorts page
     // while the tab was active.
     setupForCurrentShort(); 
     sendResponse({status: "checked"}); // Acknowledge message
     return true; // Keep the message channel open for async response
   }
 });
