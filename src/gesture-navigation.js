// Platform detection
const isWindows = navigator.platform.includes('Win');
const isMac = navigator.platform.includes('Mac');

// Navigation control variables
let isNavigating = false;
let lastNavigationTime = 0;
const NAVIGATION_COOLDOWN = 350;
const NAVIGATION_LOCK_TIME = 500; // Reduce lock time
let isTwoFingerSwipe = false;
let touchStartX = 0;
let touchStartY = 0;
let isPointerDown = false;
let hasNavigated = false; // Add flag to prevent multiple navigations from single swipe

// Navigation function
function navigateToParent(currentFolderId, updateDisplay) {
  const now = Date.now();

  // Check navigation state only, remove time lock check
  if (isNavigating) {
    console.log('[Navigation] Skipped - navigation in progress');
    return;
  }

  isNavigating = true;
  lastNavigationTime = now;

  chrome.bookmarks.get(currentFolderId, function (nodes) {
    if (chrome.runtime.lastError) {
      console.error('[Navigation] Error:', chrome.runtime.lastError);
      isNavigating = false;
      return;
    }

    if (nodes && nodes[0] && nodes[0].parentId) {
      const parentId = nodes[0].parentId;
      console.log('[Navigation] Navigating to parent folder:', parentId);

      if (parentId === "0") {
        updateDisplay("1").finally(() => {
          setTimeout(() => {
            isNavigating = false;
            // Reset all navigation flags
            resetNavigationFlags();
          }, NAVIGATION_COOLDOWN);
        });
      } else {
        updateDisplay(parentId).finally(() => {
          setTimeout(() => {
            isNavigating = false;
            // 重置所有导航标志
            resetNavigationFlags();
          }, NAVIGATION_COOLDOWN);
        });
      }
    } else {
      console.log('[Navigation] Failed to get parent folder info');
      isNavigating = false;
    }
  });
}

// Add function to reset navigation flags
function resetNavigationFlags() {
  isNavigating = false;
  hasNavigated = false; // If you need to access this variable externally, declare it globally
}

// Mac touchpad two-finger swipe handling
function initTouchGestures(navigateToParent) {
  const minSwipeDistance = 250; // Significantly increase min swipe distance
  let swipeStartTime = 0;

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      isTwoFingerSwipe = true;
      touchStartX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      swipeStartTime = Date.now();
      hasNavigated = false; // Reset flag at start of each touch

      document.body.style.transition = 'transform 0.2s';
    }
  });

  document.addEventListener('touchmove', function (e) {
    if (!isTwoFingerSwipe) return;
    e.preventDefault();

    const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const deltaX = currentX - touchStartX;

    // Further reduce follow-hand degree
    if (deltaX > 0) {
      const transform = Math.min(deltaX / 6, 150); // Drastically reduce displacement ratio, increase max displacement
      document.body.style.transform = `translateX(${transform}px)`;
    }
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    if (!isTwoFingerSwipe) return;

    const touchEndX = (e.changedTouches[0].clientX + (e.changedTouches[1]?.clientX || e.changedTouches[0].clientX)) / 2;
    const touchEndY = (e.changedTouches[0].clientY + (e.changedTouches[1]?.clientY || e.changedTouches[0].clientY)) / 2;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const swipeTime = Date.now() - swipeStartTime;

    document.body.style.transition = 'transform 0.3s';
    document.body.style.transform = '';

    if (Math.abs(deltaX) > Math.abs(deltaY) &&
      deltaX > minSwipeDistance &&
      Math.abs(deltaY) < minSwipeDistance / 4 && // Further reduce vertical tolerance
      swipeTime > 150 && swipeTime < 1000) { // Expand time window

      const currentFolderId = document.getElementById('bookmarks-list').dataset.parentId;
      if (currentFolderId && currentFolderId !== '1' && !hasNavigated) {
        navigateToParent(currentFolderId);
        hasNavigated = true;
      }
    }

    isTwoFingerSwipe = false;
  });
}

// Optimize wheel handler
function createWheelHandler(navigateToParent) {
  let accumulatedDeltaX = 0;
  let lastWheelTime = 0;

  return _.throttle(function (e) {
    const currentTime = Date.now();

    if (currentTime - lastNavigationTime < NAVIGATION_COOLDOWN) {
      return;
    }

    const SCROLL_THRESHOLD = isWindows ? 30 : 60; // Further increase scroll threshold
    const MIN_DELTA_Y = isWindows ? 20 : 45;
    const HORIZONTAL_RATIO = isWindows ? 1.8 : 2.0; // Significantly increase horizontal ratio requirement

    accumulatedDeltaX += e.deltaX;

    if (currentTime - lastWheelTime > 400) { // Increase reset time window
      accumulatedDeltaX = e.deltaX;
    }
    lastWheelTime = currentTime;

    if (Math.abs(accumulatedDeltaX) > SCROLL_THRESHOLD &&
      Math.abs(e.deltaX) > Math.abs(e.deltaY) * HORIZONTAL_RATIO &&
      Math.abs(e.deltaY) < MIN_DELTA_Y &&
      e.deltaX < 0 &&
      e.deltaMode === 0) {

      if (isWindows && e.deltaMode !== 0) return;

      const currentFolderId = document.getElementById('bookmarks-list').dataset.parentId;
      if (currentFolderId && currentFolderId !== '1') {
        navigateToParent(currentFolderId);
        accumulatedDeltaX = 0;
      }
    }
  }, 200, { // Further increase throttle time
    trailing: false,
    leading: true
  });
}

// Windows touchpad support
function initWindowsTouchpad(navigateToParent) {
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') {
      isPointerDown = true;
      touchStartX = e.clientX;
      touchStartY = e.clientY;
    }
  });

  document.addEventListener('pointermove', function (e) {
    if (!isPointerDown || e.pointerType !== 'touch') return;

    const deltaX = e.clientX - touchStartX;
    const deltaY = e.clientY - touchStartY;
    const MIN_SWIPE_DISTANCE = 220; // Significantly increase min swipe distance

    if (Math.abs(deltaX) > MIN_SWIPE_DISTANCE &&
      Math.abs(deltaX) > Math.abs(deltaY) * 2.0 && // Significantly increase ratio requirement
      deltaX < 0) {
      const currentFolderId = document.getElementById('bookmarks-list').dataset.parentId;
      if (currentFolderId && currentFolderId !== '1') {
        navigateToParent(currentFolderId);
      }
      isPointerDown = false;
    }
  });

  document.addEventListener('pointerup', () => isPointerDown = false);
  document.addEventListener('pointercancel', () => isPointerDown = false);
}

// Modify init function, receive updateDisplay param
function initGestureNavigation(updateDisplay) {
  // Create navigation function bound to updateDisplay
  const boundNavigateToParent = (folderId) => navigateToParent(folderId, updateDisplay);

  // Initialize touchpad gestures, pass navigation function
  initTouchGestures(boundNavigateToParent);

  // Initialize wheel events, use new handler
  const boundWheelHandler = createWheelHandler(boundNavigateToParent);
  document.addEventListener('wheel', boundWheelHandler, { passive: true });

  // If Windows, initialize Windows touchpad support
  if (isWindows) {
    initWindowsTouchpad(boundNavigateToParent);
  }
}

export {
  initGestureNavigation
}; 