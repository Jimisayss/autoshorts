/**
 * AutoShorts Content Script
 * Handles automatic skipping of YouTube Shorts and tracks viewing statistics.
 * This version includes enhancements for robustness and debug logging.
 *
 * **MODIFIED TO SUPPORT BACKGROUND TAB OPERATION**
 */

import { isShortsPage, getShortId, getVideoElement, getNextButton, skipShort, cleanupVideoListeners } from "./videoHandler.js";
import { updateStats } from "./stats.js";
import { setupMutationObserver } from "./observer.js";

let currentVideo = null;
let videoStartTime = null;
let lastShortId = null;
let lastWheelTime = 0;
window.addEventListener("wheel", () => {
  lastWheelTime = Date.now();
}, { passive: true });

function onVideoPlaying() {
  videoStartTime = Date.now();
  console.log("AutoShorts: Video started playing or resumed. Start time:", videoStartTime, currentVideo);
}

function onVideoTimeUpdate() {
  if (!currentVideo) return;
  const remaining = currentVideo.duration - currentVideo.currentTime;
  if (remaining <= 0.2 && !currentVideo._autoShortsSkipped) {
    currentVideo._autoShortsSkipped = true;
    skipShort(videoStartTime);
    updateStats(videoStartTime ? Date.now() - videoStartTime : (currentVideo.duration * 1000));
  }
}

function cleanupListeners() {
  cleanupVideoListeners(currentVideo, onVideoPlaying, onVideoTimeUpdate);
}

function setupForCurrentShort() {
  if (!isShortsPage()) {
    if (lastShortId) {
      cleanupListeners();
      currentVideo = null;
      lastShortId = null;
    }
    return;
  }

  const shortId = getShortId();
  if (shortId && shortId !== lastShortId) {
    // If a wheel event happened in the last 1s, treat as manual skip
    if (lastWheelTime && Date.now() - lastWheelTime < 1000) {
      incrementManualSkip();
      lastWheelTime = 0;
    }
    console.log(`AutoShorts: New short detected (ID: ${shortId}). Setting up.`);
    cleanupListeners();
    lastShortId = shortId;

    // Robust video element setup with retries
    let attempts = 0;
    const maxAttempts = 15; // Retry for up to 3 seconds (15 * 200ms)
    function trySetupVideo() {
      const video = getVideoElement();
      if (video) {
        cleanupVideoListeners(currentVideo, onVideoPlaying, onVideoTimeUpdate);
        video._autoShortsSkipped = false;
        video.addEventListener("playing", onVideoPlaying);
        video.addEventListener("timeupdate", onVideoTimeUpdate);
        currentVideo = video;
        if (!video.paused) {
          onVideoPlaying();
        }

        // Listen for manual skip: next button click
        const nextBtn = getNextButton();
        if (nextBtn) {
          nextBtn.addEventListener("click", () => {
            skipShort(videoStartTime, true);
            updateStats(videoStartTime ? Date.now() - videoStartTime : (currentVideo.duration * 1000));
          }, { once: true });
        }

        // Listen for manual skip: navigation buttons
        const navUp = document.getElementById("navigation-button-up");
        const navDown = document.getElementById("navigation-button-down");
        [navUp, navDown].forEach(btn => {
          if (btn) {
            btn.addEventListener("click", () => {
              skipShort(videoStartTime, true);
              updateStats(videoStartTime ? Date.now() - videoStartTime : (currentVideo.duration * 1000));
            }, { once: true });
          }
        });

        // Listen for manual skip: ArrowDown key
        window.addEventListener("keydown", function manualSkipListener(e) {
          if (e.key === "ArrowDown" || e.code === "ArrowDown") {
            skipShort(videoStartTime, true);
            window.removeEventListener("keydown", manualSkipListener);
          }
        });
      } else if (attempts < maxAttempts) {
        attempts++;
        cleanupVideoListeners(currentVideo, onVideoPlaying, onVideoTimeUpdate);
        setTimeout(trySetupVideo, 200);
      } else {
        cleanupVideoListeners(currentVideo, onVideoPlaying, onVideoTimeUpdate);
        console.warn(`AutoShorts: Short detected (ID: ${shortId}), but video element not found after retries.`);
      }
    }
    trySetupVideo();
  }
}

// Observe navigation and DOM changes with debounce
setupMutationObserver(setupForCurrentShort, 200);

// Initial setup on script load.
setupForCurrentShort();

// Listen for background script messages to trigger logic.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "autoShortsCheck") {
    console.log("AutoShorts: Received check from background. Page is hidden:", document.hidden);

    if (isShortsPage()) {
      const video = getVideoElement();
      if (video && video.duration > 0 && video.currentTime / video.duration > 0.95) {
        if (!video._autoShortsSkipped) {
          video._autoShortsSkipped = true;
          skipShort(videoStartTime);
          updateStats(videoStartTime ? Date.now() - videoStartTime : (video.duration * 1000));
        }
      }
    }

    setupForCurrentShort();
    sendResponse({ status: "checked" });
    return true;
  }
});
