// observer.js
// Handles DOM mutation observation with debounce for AutoShorts

const DEBUG = true;

function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function setupMutationObserver(callback, delay = 200) {
  const debouncedCallback = debounce(callback, delay);
  const observer = new MutationObserver(debouncedCallback);
  observer.observe(document.body, { childList: true, subtree: true });
  if (DEBUG) console.log("AutoShorts: MutationObserver set up with debounce:", delay, "ms");
  return observer;
}

export { debounce, setupMutationObserver };
