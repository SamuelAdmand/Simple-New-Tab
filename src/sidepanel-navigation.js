// Side panel navigation script
(function () {
  console.log('[SidePanel Navigation] Script starting to load');

  // Check if Chrome API is available
  const isChromeExtension = typeof chrome !== 'undefined' &&
    typeof chrome.runtime !== 'undefined' &&
    typeof chrome.storage !== 'undefined';

  // Check if current page is side panel page
  const isSidePanelPage = window.location.pathname.endsWith('sidepanel.html');

  // Check if URL parameters contain side panel flag
  const urlParams = new URLSearchParams(window.location.search);
  const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';

  // Check if current page is main page (newtab)
  const isNewTabPage = window.location.pathname.endsWith('index.html') ||
    window.location.pathname.endsWith('newtab.html') ||
    window.location.href.includes('chrome://newtab') ||
    document.querySelector('#sidebar-container') !== null;

  // Only continue if URL contains side panel parameter, or if this is new tab/side panel home page do not add navigation bar
  if (isSidePanelPage || isNewTabPage || !hasSidePanelParam) {
    console.log('[SidePanel Navigation] Not adding navigation bar: isSidePanelPage=', isSidePanelPage,
      'isNewTabPage=', isNewTabPage, 'hasSidePanelParam=', hasSidePanelParam);
    return;
  }

  // Global variables for state tracking and debugging
  let inSidePanel = false;  // Final result of whether currently in side panel
  let detectionMethods = [];  // Tracking detection method results
  let detectionAttempts = 0;  // Detection attempt count
  let navigationBarAdded = false; // Whether navigation bar has been added

  // After page load, check again if navigation bar needs to be added
  window.addEventListener('load', function () {
    // If navigation bar added, no need to check again
    if (navigationBarAdded) return;

    // Check if URL parameters contain side panel flag
    const urlParams = new URLSearchParams(window.location.search);
    const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' ||
      urlParams.get('is_sidepanel') === 'true';

    // If URL contains side panel parameter but navigation bar not added, add it
    if (hasSidePanelParam && !document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] Detected side panel parameter after page load, adding navigation bar');
      inSidePanel = true;
      initOrRefreshNavigationBar();
      navigationBarAdded = true;

      // Add side panel flag to body class
      document.body.classList.add('is-sidepanel');
    }
  });

  // Add global event listener - signals from directly injected scripts
  document.addEventListener('sidepanel_loaded', (event) => {
    console.log('[SidePanel Navigation] Received custom event:', event.detail);
    inSidePanel = true;

    if (!navigationBarAdded) {
      initOrRefreshNavigationBar();
      navigationBarAdded = true;
    }
  });

  // Chrome message listener - from background.js
  if (isChromeExtension) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[SidePanel Navigation] Received Chrome message:', message);

      try {
        if (message && message.action === 'sidepanelNavigation' && message.isSidePanel === true) {
          console.log('[SidePanel Navigation] Received side panel flag message:', message);

          // Save flag to storage for later use
          try {
            sessionStorage.setItem('sidepanel_view', 'true');
            localStorage.setItem('sidepanel_view', 'true');
          } catch (e) {
            console.log('[SidePanel Navigation] Error saving flag to storage:', e);
          }

          inSidePanel = true;

          if (!navigationBarAdded) {
            initOrRefreshNavigationBar();
            navigationBarAdded = true;
          }

          // Always send a response to prevent "Receiving end does not exist" errors
          if (sendResponse) {
            sendResponse({ success: true, message: 'Sidepanel navigation message received' });
          }
          return true;
        }
      } catch (e) {
        console.error('[SidePanel Navigation] Error handling message:', e);
        if (sendResponse) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
    });
  }

  // Add global link click event listener to show loading indicator
  document.addEventListener('click', function (event) {
    // Find clicked link or link in parents
    let linkElement = event.target.closest('a');

    // If clicked link and not opening in new window
    if (linkElement &&
      linkElement.href &&
      (!linkElement.target || linkElement.target !== '_blank') &&
      !event.ctrlKey &&
      !event.metaKey) {

      // Show loading indicator
      showLoadingSpinner();

      // Add sidepanel_view parameter to link URL
      try {
        // Parse link URL
        const linkUrl = new URL(linkElement.href);

        // Add only if link URL doesn't contain sidepanel_view parameter
        if (!linkUrl.searchParams.has('sidepanel_view')) {
          linkUrl.searchParams.set('sidepanel_view', 'true');
          linkElement.href = linkUrl.toString();
          console.log('[SidePanel Navigation] Added side panel parameter to link:', linkElement.href);
        }
      } catch (e) {
        console.error('[SidePanel Navigation] Error modifying link URL:', e);
      }

      // Record internal navigation history
      if (inSidePanel && isChromeExtension) {
        // Intercept link click and add to navigation history
        try {
          // Get target URL (now contains sidepanel_view parameter)
          const targetUrl = linkElement.href;

          // Send message to background script to update navigation history
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: targetUrl,
            source: 'in_page_navigation'
          }, response => {
            console.log('[SidePanel Navigation] Record internal navigation history response:', response);
          });

          console.log('[SidePanel Navigation] Record internal navigation to:', targetUrl);
        } catch (e) {
          console.error('[SidePanel Navigation] Error recording internal navigation history:', e);
        }
      }

      // Allow default link click behavior to continue
    }
  });

  // Add history change listener
  if (inSidePanel && window.history && window.history.pushState) {
    // Wrap native history.pushState and replaceState methods
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (state, title, url) {
      // If URL provided, ensure it contains sidepanel_view parameter
      if (url) {
        try {
          const newUrl = new URL(url, window.location.href);
          if (!newUrl.searchParams.has('sidepanel_view')) {
            newUrl.searchParams.set('sidepanel_view', 'true');
            url = newUrl.toString();
            console.log('[SidePanel Navigation] Added side panel parameter to pushState URL:', url);
          }
        } catch (e) {
          console.error('[SidePanel Navigation] Error modifying pushState URL:', e);
        }
      }

      // Call original method
      const result = originalPushState.apply(this, arguments.length === 3 ? [state, title, url] : arguments);

      // Record URL change
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'pushState'
          });
          console.log('[SidePanel Navigation] Recorded pushState navigation:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] Error recording pushState navigation:', e);
        }
      }

      return result;
    };

    window.history.replaceState = function (state, title, url) {
      // If URL provided, ensure it contains sidepanel_view parameter
      if (url) {
        try {
          const newUrl = new URL(url, window.location.href);
          if (!newUrl.searchParams.has('sidepanel_view')) {
            newUrl.searchParams.set('sidepanel_view', 'true');
            url = newUrl.toString();
            console.log('[SidePanel Navigation] Added side panel parameter to replaceState URL:', url);
          }
        } catch (e) {
          console.error('[SidePanel Navigation] Error modifying replaceState URL:', e);
        }
      }

      // Call original method
      const result = originalReplaceState.apply(this, arguments.length === 3 ? [state, title, url] : arguments);

      // Record URL change
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'replaceState'
          });
          console.log('[SidePanel Navigation] Recorded replaceState navigation:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] Error recording replaceState navigation:', e);
        }
      }

      return result;
    };

    // Listen for popstate event (user clicks browser back or forward button)
    window.addEventListener('popstate', function () {
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'popstate'
          });
          console.log('[SidePanel Navigation] Recorded popstate navigation:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] Error recording popstate navigation:', e);
        }
      }
    });
  }

  // Show loading animation
  function showLoadingSpinner(position = 'top-right') {
    let loadingIndicator = document.getElementById('side-panel-loading-indicator');

    // If loading indicator doesn't exist, create it
    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'side-panel-loading-indicator';
      loadingIndicator.className = 'loading-indicator';

      // Create simple loading animation
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      loadingIndicator.appendChild(spinner);

      document.body.appendChild(loadingIndicator);
    }

    // Clear all possible position classes
    loadingIndicator.classList.remove('center', 'top-center', 'bottom-right', 'nav-adjacent');

    // Add requested position class (if not default top-right)
    if (position !== 'top-right') {
      loadingIndicator.classList.add(position);
    }

    // Show loading indicator
    loadingIndicator.style.display = 'block';

    // Auto-hide after page leaves or 5s (in case page fails to load)
    setTimeout(() => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }, 5000);
  }

  // Execute multiple detection methods and aggregate results
  runDetectionMethods();

  // Backup detection - check every second for 5 times
  const maxBackupChecks = 5;
  for (let i = 0; i < maxBackupChecks; i++) {
    setTimeout(() => {
      if (!navigationBarAdded) {
        console.log(`[SidePanel Navigation] Backup detection #${i + 1}`);
        runDetectionMethods();
      }
    }, (i + 1) * 1000);
  }

  // Run all detection methods and integrate results
  function runDetectionMethods() {
    detectionAttempts++;
    console.log(`[SidePanel Navigation] Running detection method (attempt #${detectionAttempts})`);

    // Reset detection results array
    detectionMethods = [];

    // Method 1: use chrome.runtime.getContexts API (Chrome 116+)
    if (isChromeExtension && chrome.runtime.getContexts) {
      const apiDetection = new Promise((resolve) => {
        try {
          chrome.runtime.getContexts({
            contextTypes: ["SIDE_PANEL"]
          }, (contexts) => {
            if (chrome.runtime.lastError) {
              console.log('[SidePanel Navigation] API detection error:', chrome.runtime.lastError);
              resolve(false);
              return;
            }

            // No contexts or empty array
            if (!contexts || contexts.length === 0) {
              console.log('[SidePanel Navigation] Side panel context not found');
              resolve(false);
              return;
            }

            // Get all side panel context IDs
            const sidePanelContextIds = contexts.map(context => context.contextId);

            // Check if current context is side panel
            chrome.runtime.getContextId((currentContext) => {
              if (chrome.runtime.lastError) {
                console.log('[SidePanel Navigation] Error getting current context:', chrome.runtime.lastError);
                resolve(false);
                return;
              }

              if (!currentContext) {
                console.log('[SidePanel Navigation] Unable to get current context');
                resolve(false);
                return;
              }

              const isInSidePanel = sidePanelContextIds.includes(currentContext.contextId);
              console.log('[SidePanel Navigation] Chrome API detection result:', isInSidePanel, {
                sidePanelContextIds,
                currentContextId: currentContext.contextId
              });

              // If confirmed in side panel, save flag for later pages
              if (isInSidePanel) {
                saveDetectionResult(true);
              }

              resolve(isInSidePanel);
            });
          });
        } catch (e) {
          console.log('[SidePanel Navigation] Error running API detection:', e);
          resolve(false);
        }
      });

      detectionMethods.push(apiDetection);
    }

    // Method 2: traditional URL and storage detection
    const traditionalDetection = new Promise((resolve) => {
      // Check for flag parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const isSidePanelView = urlParams.has('sidepanel_view');

      // Check for flag in sessionStorage and localStorage
      let isSidePanelSession = false;
      let isSidePanelLocal = false;

      try {
        isSidePanelSession = sessionStorage.getItem('sidepanel_view') === 'true';
      } catch (e) {
        console.log('[SidePanel Navigation] sessionStorage unavailable:', e);
      }

      try {
        isSidePanelLocal = localStorage.getItem('sidepanel_view') === 'true';
      } catch (e) {
        console.log('[SidePanel Navigation] localStorage unavailable:', e);
      }

      // Check chrome.storage.session (more reliable storage)
      if (isChromeExtension && chrome.storage && chrome.storage.session) {
        chrome.storage.session.get(['sidepanel_view', 'sidepanel_last_url'], (result) => {
          const isSidePanelChromeStorage = result && result.sidepanel_view === true;
          const lastUrl = result && result.sidepanel_last_url;

          // Check URL similarity between last and current URL
          const urlMatchScore = lastUrl ? calculateUrlSimilarity(lastUrl, window.location.href) : 0;
          console.log('[SidePanel Navigation] URL similarity score:', urlMatchScore, {
            lastUrl: lastUrl && lastUrl.substring(0, 50) + '...',
            currentUrl: window.location.href.substring(0, 50) + '...'
          });

          // If URLs are very similar (score > 0.7), it might be side panel navigation
          const isUrlMatch = urlMatchScore > 0.7;

          checkTraditionalResults(
            isSidePanelView,
            isSidePanelSession,
            isSidePanelLocal,
            isSidePanelChromeStorage,
            isUrlMatch
          );
        });
      } else {
        checkTraditionalResults(isSidePanelView, isSidePanelSession, isSidePanelLocal, false, false);
      }

      function checkTraditionalResults(fromUrl, fromSession, fromLocal, fromChromeStorage, fromUrlMatch) {
        // Check referrer to see if it navigated from side panel
        const referrerIsSidePanel = document.referrer && (
          document.referrer.includes('sidepanel.html') ||
          document.referrer.includes('sidepanel_view=true') ||
          document.referrer.includes('is_sidepanel=true')
        );

        // Compare current URL with referrer URL to detect internal domain navigation
        const isInternalNavigation = document.referrer &&
          (new URL(document.referrer)).origin === window.location.origin;

        // Force check URL parameters again
        const urlParams = new URLSearchParams(window.location.search);
        const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' ||
          urlParams.get('is_sidepanel') === 'true';

        // If internal domain navigation and referrer is side panel, or direct side panel parameter, consider current page as side panel
        const isDefinitelySidePanel = (isInternalNavigation && referrerIsSidePanel) || hasSidePanelParam;

        // If flag parameter in URL, save to all storage
        if (hasSidePanelParam) {
          saveDetectionResult(true);
        }

        // Consolidate all traditional detection results, but give higher priority to URL parameter and referrer check
        const result = isDefinitelySidePanel || fromUrl || fromSession || fromLocal ||
          fromChromeStorage || fromUrlMatch;

        console.log('[SidePanel Navigation] Traditional detection result:', result, {
          hasSidePanelParam, isInternalNavigation, referrerIsSidePanel, isDefinitelySidePanel,
          fromUrl, fromSession, fromLocal, fromChromeStorage, fromUrlMatch
        });

        // If confirmed side panel, apply side panel style immediately
        if (isDefinitelySidePanel) {
          document.body.classList.add('is-sidepanel');
        }

        resolve(result);
      }
    });

    detectionMethods.push(traditionalDetection);

    // Method 3: DOM feature detection - looking for HTML structure or styles in page that might indicate side panel
    const domDetection = new Promise((resolve) => {
      // Delay execution to wait for full DOM load
      setTimeout(() => {
        // Check for side panel specific elements or styles
        const hasSidePanelClasses = document.body.classList.contains('is-sidepanel') ||
          document.documentElement.classList.contains('is-sidepanel');

        // Check window size - side panel is usually narrow
        const isNarrowViewport = window.innerWidth <= 480;

        console.log('[SidePanel Navigation] DOM detection result:', {
          hasSidePanelClasses,
          isNarrowViewport,
          windowWidth: window.innerWidth
        });

        // If clear side panel features exist
        const result = hasSidePanelClasses || isNarrowViewport;

        if (result) {
          saveDetectionResult(true);
        }

        resolve(result);
      }, 500);
    });

    detectionMethods.push(domDetection);

    // Consolidate all detection results and perform corresponding actions
    Promise.all(detectionMethods).then(results => {
      // If any detection method returns true, consider it in side panel
      const detectionResult = results.some(result => result === true);

      console.log('[SidePanel Navigation] All detection method results:', results);
      console.log('[SidePanel Navigation] Final detection result:', detectionResult);

      // Check URL parameters again to ensure navigation bar is only added in actual side panel view
      const urlParams = new URLSearchParams(window.location.search);
      const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';

      if (detectionResult && hasSidePanelParam && !navigationBarAdded) {
        inSidePanel = true;
        console.log('[SidePanel Navigation] Confirmed in side panel, adding navigation bar');
        initOrRefreshNavigationBar();
        navigationBarAdded = true;
      } else if (!detectionResult || !hasSidePanelParam) {
        console.log('[SidePanel Navigation] Not in side panel, not adding navigation bar (detectionResult=', detectionResult, ', hasSidePanelParam=', hasSidePanelParam, ')');
      }
    });
  }

  // Save detection result to storage
  function saveDetectionResult(isInSidePanel) {
    // Check URL parameters again to ensure state is only saved in actual side panel view
    const urlParams = new URLSearchParams(window.location.search);
    const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';

    if (isInSidePanel && hasSidePanelParam) {
      try {
        sessionStorage.setItem('sidepanel_view', 'true');
        localStorage.setItem('sidepanel_view', 'true');

        if (isChromeExtension && chrome.storage && chrome.storage.session) {
          chrome.storage.session.set({ 'sidepanel_view': true });
        }
      } catch (e) {
        console.log('[SidePanel Navigation] Error storing detection results:', e);
      }
    }
  }

  // Calculate similarity between two URLs
  function calculateUrlSimilarity(url1, url2) {
    // Simplify URL
    const simplifyUrl = (url) => {
      return url.replace(/^https?:\/\//, '')  // Remove protocol
        .replace(/www\./, '')          // Remove www.
        .replace(/\?.*$/, '')          // Remove query parameters
        .replace(/#.*$/, '')           // Remove anchor
        .toLowerCase();                // To lowercase
    };

    const simple1 = simplifyUrl(url1);
    const simple2 = simplifyUrl(url2);

    // If domains different, consider not similar
    const domain1 = simple1.split('/')[0];
    const domain2 = simple2.split('/')[0];

    if (domain1 !== domain2) {
      return 0;
    }

    // If path sections same, highly similar
    const path1 = simple1.substring(domain1.length);
    const path2 = simple2.substring(domain2.length);

    if (path1 === path2) {
      return 1;
    }

    // Calculate path section similarity
    const similarity = calculateStringSimilarity(path1, path2);
    return 0.5 + (similarity * 0.5); // Domain match gives at least 0.5 similarity
  }

  // Calculate string similarity (simplified version of Levenshtein distance)
  function calculateStringSimilarity(str1, str2) {
    // If one is empty string, return 0
    if (str1.length === 0) return 0;
    if (str2.length === 0) return 0;

    // If strings same, similarity is 1
    if (str1 === str2) return 1;

    // Simple method: compare count of characters at same position in both strings
    const minLength = Math.min(str1.length, str2.length);
    let matchCount = 0;

    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        matchCount++;
      }
    }

    // Return similarity (between 0-1)
    return matchCount / Math.max(str1.length, str2.length);
  }

  // Simplify initialize and refresh navigation bar function
  function initOrRefreshNavigationBar() {
    if (document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] Navigation bar already exists, no need to add again');
      return;
    }

    console.log('[SidePanel Navigation] Initializing navigation bar');
    initializeNavigationBar();

    // Secondary check after DOMContentLoaded to ensure navigation bar existence
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureNavigationBar);
    } else {
      ensureNavigationBar();
    }

    // Check again after webpage load, handling some asynchronously loaded sites
    if (document.readyState !== 'complete') {
      window.addEventListener('load', ensureNavigationBar);
    } else {
      ensureNavigationBar();
    }

    // Set a MutationObserver to ensure navigation bar isn't removed
    setupMutationObserver(document.querySelector('.sidepanel-nav-bar'));
  }

  // Function to ensure navigation bar existence
  function ensureNavigationBar() {
    if (!document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] Navigation bar not found, reinitializing');
      initializeNavigationBar();
    }
  }

  // Set a MutationObserver to ensure navigation bar isn't removed
  function setupMutationObserver(navBar) {
    if (!navBar) {
      console.log('[SidePanel Navigation] No navigation bar to observe');
      return null;
    }

    console.log('[SidePanel Navigation] Setting up mutation observer for navigation bar');

    // Create a MutationObserver instance
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const navBarStillExists = document.body.contains(navBar);

          if (!navBarStillExists) {
            console.log('[SidePanel Navigation] Navigation bar was removed, adding it back');
            // If navigation bar removed, recreate and add it
            initializeNavigationBar();

            // If new navigation bar created successfully, set new observer for it
            const newNavBar = document.querySelector('.sidepanel-nav-bar');
            if (newNavBar && newNavBar !== navBar) {
              setupMutationObserver(newNavBar);

              // Disconnect current observer as new one created
              observer.disconnect();
              return;
            }
          }
        }
      }
    });

    // Start observing child node changes of document.body
    observer.observe(document.body, { childList: true, subtree: true });

    // Also, listen for DOM content loaded and load events, ensure navigation bar existence
    const ensureNavBarExists = () => {
      const navBarExists = document.querySelector('.sidepanel-nav-bar');
      if (!navBarExists) {
        console.log('[SidePanel Navigation] Navigation bar not found on page load, adding it');
        initializeNavigationBar();
      }
    };

    if (document.readyState !== 'complete') {
      window.addEventListener('load', ensureNavBarExists, { once: true });
    }

    return observer;
  }

  function initializeNavigationBar() {
    console.log('[SidePanel Navigation] Initializing navigation bar for:', window.location.href);

    // Check if navigation bar already exists, if so do not add again
    if (document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] Navigation bar already exists, not adding again');
      return;
    }

    // Create navigation bar style
    const style = document.createElement('style');
    style.textContent = `
      .sidepanel-nav-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background-color: rgba(248, 249, 250, 0.95);
        border-bottom: 1px solid #dee2e6;
        display: flex;
        align-items: center;
        padding: 0 5px;
        z-index: 99999 !important; /* Increase z-index to ensure display at top layer */
        font-family: Arial, sans-serif;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        transition: transform 0.3s ease, opacity 0.3s ease;
        pointer-events: auto !important;
      }
      
      /* Compact mode styles */
      .sidepanel-nav-bar.compact-mode {
        transform: translateY(-28px);
      }
      
      .sidepanel-nav-bar.compact-mode:hover,
      .sidepanel-nav-bar:has(.url-display:focus) {
        transform: translateY(0);
      }
      
      .sidepanel-nav-bar .toggle-compact {
        position: absolute;
        bottom: -14px;
        left: 50%;
        transform: translateX(-50%);
        width: 28px;
        height: 14px;
        background-color: rgba(248, 249, 250, 0.95);
        border: 1px solid #dee2e6;
        border-top: none;
        border-radius: 0 0 14px 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        z-index: 99998 !important;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar .toggle-compact svg {
        width: 12px;
        height: 12px;
        transition: transform 0.3s ease;
      }
      
      .sidepanel-nav-bar.compact-mode .toggle-compact svg {
        transform: rotate(180deg);
      }
      
      .sidepanel-nav-bar button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px 5px;
        margin-right: 3px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar button:hover {
        background-color: #e9ecef;
      }
      
      .sidepanel-nav-bar button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .sidepanel-nav-bar button svg {
        width: 14px;
        height: 14px;
      }
      
      .sidepanel-nav-bar .url-display {
        flex-grow: 1;
        margin: 0 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: #666;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid transparent;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar .url-display:hover {
        border-color: #dee2e6;
        background-color: white;
      }
      
      /* Add top margin to page content to avoid overlap with navigation bar */
      body {
        margin-top: 32px !important;
        transition: margin-top 0.3s ease;
      }
      
      /* Reduce page top margin when navigation bar is in compact mode */
      body.nav-compact-mode {
        margin-top: 4px !important;
      }
      
      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .sidepanel-nav-bar {
          background-color: rgba(41, 42, 45, 0.95);
          border-bottom-color: #3c4043;
          color: #e8eaed;
        }
        
        .sidepanel-nav-bar .toggle-compact {
          background-color: rgba(41, 42, 45, 0.95);
          border-color: #3c4043;
        }
        
        .sidepanel-nav-bar button {
          color: #e8eaed;
        }
        
        .sidepanel-nav-bar button:hover {
          background-color: #3c4043;
        }
        
        .sidepanel-nav-bar .url-display {
          color: #9aa0a6;
        }
        
        .sidepanel-nav-bar .url-display:hover {
          background-color: #202124;
          border-color: #3c4043;
        }
      }
      
      /* Ensure navigation bar is visible under all conditions */
      .sidepanel-nav-bar {
        opacity: 1 !important;
        visibility: visible !important;
        display: flex !important;
      }
    `;
    document.head.appendChild(style);

    // Create navigation bar
    const navBar = document.createElement('div');
    navBar.className = 'sidepanel-nav-bar';
    navBar.id = 'sidepanel-navigation-bar'; // Add ID for easy indexing

    // Add back to home button
    const homeButton = document.createElement('button');
    homeButton.title = 'Back to Bookmark List';
    homeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
    homeButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.runtime.sendMessage({ action: 'navigateHome' });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for navigateHome');
      }
    });

    // Add back button
    const backButton = document.createElement('button');
    backButton.title = 'Back to previous page';
    backButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
    backButton.disabled = true; // Disabled by default, wait for history load
    backButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.runtime.sendMessage({ action: 'navigateBack' });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for navigateBack');
        // In regular web pages, browser back function can be used
        window.history.back();
      }
    });

    // Add forward button
    const forwardButton = document.createElement('button');
    forwardButton.title = 'Forward to next page';
    forwardButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
    forwardButton.disabled = true; // Disabled by default, wait for history load
    forwardButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.runtime.sendMessage({ action: 'navigateForward' });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for navigateForward');
        // In regular web pages, browser forward function can be used
        window.history.forward();
      }
    });

    // Add refresh button
    const refreshButton = document.createElement('button');
    refreshButton.title = 'Refresh Page';
    refreshButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
    refreshButton.addEventListener('click', () => {
      // Use custom refresh method to ensure navigation bar still displayed after refresh
      refreshWithNavigation();
    });

    // Add open in new tab button
    const openInNewTabButton = document.createElement('button');
    openInNewTabButton.title = 'Open in New Tab';
    openInNewTabButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
    openInNewTabButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.tabs.create({ url: window.location.href });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for openInNewTab');
        // Use window.open in regular web pages
        window.open(window.location.href, '_blank');
      }
    });

    // Add URL display
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'url-display';
    urlDisplay.textContent = window.location.href;

    // Add compact mode toggle button
    const toggleCompact = document.createElement('div');
    toggleCompact.className = 'toggle-compact';
    toggleCompact.title = 'Toggle Navigation Bar Mode';
    toggleCompact.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';
    toggleCompact.addEventListener('click', () => {
      navBar.classList.toggle('compact-mode');
      document.body.classList.toggle('nav-compact-mode');

      // Save user preference, only if Chrome API available
      if (isChromeExtension) {
        chrome.storage.local.set({
          'sidepanel_nav_compact_mode': navBar.classList.contains('compact-mode')
        });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for storage');
        // In regular web pages use localStorage as alternative
        try {
          localStorage.setItem('sidepanel_nav_compact_mode', navBar.classList.contains('compact-mode'));
        } catch (e) {
          console.log('[SidePanel Navigation] localStorage not available:', e);
        }
      }
    });

    // Add buttons to navigation bar
    navBar.appendChild(homeButton);
    navBar.appendChild(backButton);
    navBar.appendChild(forwardButton);
    navBar.appendChild(refreshButton);
    navBar.appendChild(openInNewTabButton);
    navBar.appendChild(urlDisplay);
    navBar.appendChild(toggleCompact);

    // Add navigation bar to page
    document.body.insertBefore(navBar, document.body.firstChild);

    // Set MutationObserver to monitor DOM changes
    const observer = setupMutationObserver(navBar);

    // If Chrome API available, get history state from storage
    if (isChromeExtension) {
      // Get history state from storage, update button state
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex', 'sidepanel_nav_compact_mode'], (result) => {
        // Restore user's compact mode preference
        if (result.sidepanel_nav_compact_mode) {
          navBar.classList.add('compact-mode');
          document.body.classList.add('nav-compact-mode');
        }

        if (result.sidePanelHistory && result.sidePanelCurrentIndex !== undefined) {
          const history = result.sidePanelHistory;
          const currentIndex = result.sidePanelCurrentIndex;

          // Update back button state
          backButton.disabled = currentIndex <= 0;

          // Update forward button state
          forwardButton.disabled = currentIndex >= history.length - 1;

          console.log('[SidePanel Navigation] Loaded history state:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });
        } else {
          console.log('[SidePanel Navigation] No history state found in storage');
        }
      });

      // Listen for messages from background script
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (message && message.action === "updateNavigationState") {
            console.log('[SidePanel Navigation] Received navigation state update:', message);

            // Update navigation button state
            const navBar = document.querySelector('.sidepanel-nav-bar');
            if (navBar) {
              // Find buttons (second button is usually back, third button usually forward)
              const buttons = navBar.querySelectorAll('button');
              const backButton = buttons[1]; // Back button
              const forwardButton = buttons[2]; // Forward button

              if (backButton && forwardButton) {
                backButton.disabled = !message.canGoBack;
                forwardButton.disabled = !message.canGoForward;
                console.log('[SidePanel Navigation] Updated navigation buttons - Back:',
                  !message.canGoBack ? 'disabled' : 'enabled',
                  'Forward:', !message.canGoForward ? 'disabled' : 'enabled');
              } else {
                console.log('[SidePanel Navigation] Could not find navigation buttons');
              }
            } else {
              console.log('[SidePanel Navigation] Navigation bar not found');
              // If navigation bar not found, might need to recreate it
              initOrRefreshNavigationBar();
            }

            // Send a response to prevent "Receiving end does not exist" errors
            if (sendResponse) {
              sendResponse({ success: true, message: 'Navigation state updated' });
            }
          }
        } catch (e) {
          console.error('[SidePanel Navigation] Error processing navigation state update:', e);
          if (sendResponse) {
            sendResponse({ success: false, error: e.message });
          }
        }

        return true; // Keep the message channel open for async response
      });
    } else {
      // When Chrome API unavailable, use browser navigation history
      backButton.disabled = !window.history.length;

      // In regular web pages, cannot accurately judge if forward possible, so disable forward button
      forwardButton.disabled = true;

      // Try getting compact mode setting from localStorage
      try {
        const compactMode = localStorage.getItem('sidepanel_nav_compact_mode') === 'true';
        if (compactMode) {
          navBar.classList.add('compact-mode');
          document.body.classList.add('nav-compact-mode');
        }
      } catch (e) {
        console.log('[SidePanel Navigation] localStorage not available:', e);
      }
    }

    // Use setTimeout to ensure navigation bar properly added, avoiding possible page async load issues
    setTimeout(() => {
      if (!document.body.contains(navBar)) {
        console.log('[SidePanel Navigation] Navigation bar was not properly added, retrying');
        document.body.insertBefore(navBar, document.body.firstChild);
      }
    }, 500);
  }

  // Custom refresh method, ensure navigation bar still displayed after refresh
  function refreshWithNavigation() {
    // First save current session flag
    sessionStorage.setItem('sidepanel_view', 'true');
    try {
      localStorage.setItem('sidepanel_view', 'true');
    } catch (e) {
      console.log('[SidePanel Navigation] localStorage not available:', e);
    }

    // Then refresh page
    // If URL already has parameters, add or update sidepanel_view parameter
    if (window.location.search) {
      // Parse existing URL parameters
      const currentUrl = new URL(window.location.href);
      const searchParams = currentUrl.searchParams;

      // Set sidepanel_view parameter
      searchParams.set('sidepanel_view', 'true');

      // Update URL and refresh
      window.location.href = currentUrl.toString();
    } else {
      // If no parameters, add sidepanel_view parameter
      window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }
  }
})(); 