/**
 * AutoShorts Content Script
 * Debug logging enabled for diagnosis.
 */

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
  const id = match ? match[1] : null;
  
  return id;
}

function getVideoElement() {
  // Prefer the active short's video, fallback to any shorts video, then main video
  let video = document.querySelector('ytd-reel-video-renderer[is-active] video') ||
              document.querySelector('ytd-reel-video-renderer video') ||
              document.querySelector('video.html5-main-video');
  if (video) {
    
  } else {
    
  }
  return video;
}

function getNextButton() {
  // Try multiple selectors for robustness (v1 logic)
  let btn = document.querySelector('#navigation-button > ytd-button-renderer > yt-button-shape > button[aria-label="Next short"]');
  if (!btn) btn = document.querySelector('[aria-label="Next short"]');
  if (!btn) btn = document.querySelector('button[aria-label="Next"]');
  if (btn) {
    
  } else {
    
  }
  return btn;
}

function simulateArrowDown() {
  
  const event = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    keyCode: 40,
    which: 40,
    bubbles: true,
    cancelable: true
  });
  // Try on video, active element, and window (v1 logic)
  const video = getVideoElement();
  if (video) video.dispatchEvent(event);
  if (document.activeElement) document.activeElement.dispatchEvent(event);
  window.dispatchEvent(event);
}

function updateStats(durationMs) {
  chrome.storage.sync.get([STORAGE_KEY.COUNT, STORAGE_KEY.TIME], (data) => {
    const count = Number(data[STORAGE_KEY.COUNT]) || 0;
    const time = Number(data[STORAGE_KEY.TIME]) || 0;
    
    chrome.storage.sync.set({
      [STORAGE_KEY.COUNT]: count + 1,
      [STORAGE_KEY.TIME]: time + durationMs
    }, () => {
      
    });
  });
}

function onVideoPlaying() {
  videoStartTime = Date.now();
  
}

function onVideoTimeUpdate() {
  if (!currentVideo) return;
  const remaining = currentVideo.duration - currentVideo.currentTime;
  if (remaining <= 0.5 && !currentVideo._autoShortsSkipped) {
    currentVideo._autoShortsSkipped = true;
    const watchedMs = videoStartTime ? Date.now() - videoStartTime : 0;
    
    updateStats(watchedMs);

    // Try to click "Next" button, fallback to ArrowDown
    const nextBtn = getNextButton();
    if (nextBtn) {
    
      nextBtn.click();
    } else {
      simulateArrowDown();
    }
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
    cleanupVideoListeners();
    currentVideo = null;
    lastShortId = null;
    return;
  }
  const shortId = getShortId();
  if (shortId && shortId !== lastShortId) {
    cleanupVideoListeners();
    lastShortId = shortId;
    currentVideo = getVideoElement();
    if (currentVideo) {
      currentVideo._autoShortsSkipped = false;
      currentVideo.addEventListener("playing", onVideoPlaying);
      currentVideo.addEventListener("timeupdate", onVideoTimeUpdate);
      if (!currentVideo.paused) {
        onVideoPlaying();
      }
      
    } else {
      
    }
  }
}


// Observe navigation and DOM changes
const observer = new MutationObserver(() => {
  setupForCurrentShort();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also listen for URL changes (YouTube SPA navigation)
let lastUrl = location.href;
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    
    setTimeout(setupForCurrentShort, 300); // Wait for DOM update
  }
}, 300);

// Initial setup
setupForCurrentShort();
