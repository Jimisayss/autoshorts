/**
 * AutoShorts Content Script
 * Handles automatic skipping of YouTube Shorts and tracks viewing statistics.
 * This version includes enhancements for robustness and debug logging.
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
  // Removed DEBUG log from here as it's too frequent.
  return isShort;
}

function getShortId() {
  const match = window.location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]+)/);
  const id = match ? match[1] : null;
  // Removed DEBUG log from here as it's too frequent.
  return id;
}

function getVideoElement() {
  // Prefer the active short's video, fallback to any shorts video, then main video.
  // Based on DOM analysis, these selectors are reasonably stable.
  let video = document.querySelector('ytd-reel-video-renderer[is-active] video') ||
              document.querySelector('ytd-reel-video-renderer video') ||
              document.querySelector('video.html5-main-video');
  if (video) {
    if (DEBUG) console.log("AutoShorts: Video element found.", video);
  } else {
    if (DEBUG) console.warn("AutoShorts: Video element not found.");
  }
  return video;
}

function getNextButton() {
  // Try multiple selectors for robustness, prioritized based on recent DOM analysis.
  // The aria-label "Next video" was found to be current. Others are fallbacks.
  let btn = document.querySelector('button[aria-label="Next video"]') ||
            document.querySelector('button[aria-label="Next short"]') ||
            document.querySelector('button[aria-label="Next"]') ||
            document.querySelector('#navigation-button > ytd-button-renderer > yt-button-shape > button[aria-label="Next video"]') || // More specific version for "Next video"
            document.querySelector('#navigation-button > ytd-button-renderer > yt-button-shape > button[aria-label="Next short"]') || // Original specific selector
            document.querySelector('button[aria-label*="Down"]'); // Generic fallback for down arrow buttons

  if (btn) {
    if (DEBUG) console.log("AutoShorts: Next button found.", btn);
  } else {
    if (DEBUG) console.warn("AutoShorts: Next button not found with any selectors.");
  }
  return btn;
}

function simulateArrowDown() {
  if (DEBUG) console.log("AutoShorts: Simulating ArrowDown keypress as fallback.");
  const event = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40, // Often included for broader compatibility
    which: 40,   // Often included for broader compatibility
    bubbles: true,
    cancelable: true
  });

  // Dispatch on window first, as it's a common target for global shortcuts.
  window.dispatchEvent(event);
  if (DEBUG) console.log("AutoShorts: ArrowDown event dispatched on window.");

  // If there's a specific active element that isn't the body/document,
  // also try dispatching there, as it might be a focused component
  // within the Shorts player that handles key events.
  if (document.activeElement && document.activeElement !== document.body && document.activeElement !== document.documentElement) {
    document.activeElement.dispatchEvent(event);
    if (DEBUG) console.log("AutoShorts: ArrowDown event also dispatched on document.activeElement:", document.activeElement);
  }
  // Removed dispatch on 'video' element directly as it's less likely to handle page navigation keys.
}

function updateStats(durationMs) {
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
  // Adjusted threshold from 0.5 to 0.2 to skip even closer to the end.
  if (remaining <= 0.2 && !currentVideo._autoShortsSkipped) {
    if (DEBUG) console.log("AutoShorts: Short ending, attempting to skip. Remaining:", remaining);
    currentVideo._autoShortsSkipped = true; // Mark as skipped to prevent multiple triggers
    const watchedMs = videoStartTime ? Date.now() - videoStartTime : 0;
    
    updateStats(watchedMs);

    // Try to click "Next" button, fallback to ArrowDown
    const nextBtn = getNextButton();
    if (nextBtn) {
      if (DEBUG) console.log("AutoShorts: Clicking 'Next' button.", nextBtn);
      nextBtn.click();
    } else {
      if (DEBUG) console.warn("AutoShorts: 'Next' button not found, falling back to ArrowDown simulation.");
      simulateArrowDown();
    }
  }
}

function cleanupVideoListeners() {
  if (currentVideo) {
    if (DEBUG) console.log("AutoShorts: Cleaning up video listeners for old video.", currentVideo);
    currentVideo.removeEventListener("playing", onVideoPlaying);
    currentVideo.removeEventListener("timeupdate", onVideoTimeUpdate);
  }
}

function setupForCurrentShort() {
  if (!isShortsPage()) {
    if (lastShortId) { // Only log cleanup if we were previously on a short
      if (DEBUG) console.log("AutoShorts: Not a shorts page or short ended. Cleaning up.");
      cleanupVideoListeners();
      currentVideo = null;
      lastShortId = null;
    }
    return;
  }

  const shortId = getShortId();
  if (shortId && shortId !== lastShortId) {
    if (DEBUG) console.log(`AutoShorts: New short detected (ID: ${shortId}). Previous ID: ${lastShortId}. Setting up.`);
    cleanupVideoListeners();
    lastShortId = shortId;
    currentVideo = getVideoElement();

    if (currentVideo) {
      currentVideo._autoShortsSkipped = false; // Reset skip flag for the new video
      currentVideo.addEventListener("playing", onVideoPlaying);
      currentVideo.addEventListener("timeupdate", onVideoTimeUpdate);
      if (DEBUG) console.log("AutoShorts: Event listeners added to video.", currentVideo);
      // If video is already playing when we attach listeners (e.g. script injected late)
      if (!currentVideo.paused) {
        onVideoPlaying();
      }
    } else {
      if (DEBUG) console.warn(`AutoShorts: Short detected (ID: ${shortId}), but video element not found yet.`);
    }
  } else if (!shortId && lastShortId) {
    // This case handles navigating away from a short (e.g. to main YouTube page)
    // which might not be caught by the !isShortsPage() if URL doesn't change immediately.
    if (DEBUG) console.log("AutoShorts: Navigated away from a short (no shortId, but had lastShortId). Cleaning up.");
    cleanupVideoListeners();
    currentVideo = null;
    lastShortId = null;
  } else if (DEBUG && shortId === lastShortId && shortId !== null) {
    // if (DEBUG) console.log(`AutoShorts: setupForCurrentShort called for same short (ID: ${shortId}). No action needed.`);
    // This can be noisy, so commented out by default even in DEBUG mode.
    // It might indicate the MutationObserver is firing too often without actual content change.
  }
}


// Observe navigation and DOM changes.
// The MutationObserver is the primary mechanism for detecting changes in Shorts.
const observer = new MutationObserver((mutationsList, obs) => {
  if (DEBUG) {
    // To avoid flooding logs, only log if there's a potential state change.
    const currentShortIdGuess = getShortId(); // Quick check without full setup
    if (isShortsPage() && currentShortIdGuess !== lastShortId) {
      console.log("AutoShorts: MutationObserver triggered for a potential new short.");
    } else if (!isShortsPage() && lastShortId) {
      console.log("AutoShorts: MutationObserver triggered, possibly navigating away from shorts.");
    }
  }
  setupForCurrentShort();
});

// Observe the body for child list and subtree changes. This is broad but
// necessary for YouTube's dynamic loading of Shorts.
observer.observe(document.body, {
  childList: true,
  subtree: true
});

 // Initial setup on script load.
 // Subsequent updates will be handled by the MutationObserver.
 setupForCurrentShort();

 // Listen for background script messages to trigger skip logic even when tab is unfocused.
 chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
   if (msg && msg.action === "autoShortsCheck") {
     if (DEBUG) console.log("AutoShorts: Received autoShortsCheck message from background.");
     setupForCurrentShort();
   }
 });
