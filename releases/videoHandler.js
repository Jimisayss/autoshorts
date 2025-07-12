import { updateStats, incrementManualSkip } from "./stats.js";

// videoHandler.js
// Handles video element detection, skipping, and related logic for AutoShorts

const DEBUG = true;

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

function skipShort(videoStartTime, manual = false) {
  if (DEBUG) console.log("AutoShorts: Attempting to skip short.");
  const video = getVideoElement();
  if (video) {
    // To ensure stats are counted, we simulate the end of the video
    const watchedMs = videoStartTime ? Date.now() - videoStartTime : (video.duration * 1000);
    updateStats(watchedMs || 0);
    if (manual) {
      incrementManualSkip();
    }
  }

  const nextBtn = getNextButton();
  if (nextBtn) {
    if (DEBUG) console.log("AutoShorts: Clicking 'Next' button.", nextBtn);
    nextBtn.click();
  } else {
    if (DEBUG) console.warn("AutoShorts: 'Next' button not found, falling back to ArrowDown simulation.");
    const event = new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
  }
}

function cleanupVideoListeners(currentVideo, onVideoPlaying, onVideoTimeUpdate) {
  if (currentVideo) {
    currentVideo.removeEventListener("playing", onVideoPlaying);
    currentVideo.removeEventListener("timeupdate", onVideoTimeUpdate);
  }
}

export {
  isShortsPage,
  getShortId,
  getVideoElement,
  getNextButton,
  skipShort,
  cleanupVideoListeners
};
