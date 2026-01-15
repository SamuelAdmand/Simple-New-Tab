// Navigation handler script - for processing navbar in iframe

// Save current URL to detect navigation change
let currentUrl = window.location.href;

// Check if sidebar iframe when document loaded
document.addEventListener('DOMContentLoaded', function () {
  // Check if URL params contain sidebar flag
  const urlParams = new URLSearchParams(window.location.search);
  const isSidePanel = urlParams.get('is_sidepanel') === 'true' ||
    urlParams.get('sidepanel_view') === 'true';

  console.log('[Navigation Handler] Page loaded, is side panel:', isSidePanel);

  // Check if in iframe
  const isInIframe = window !== window.top;

  // If in sidebar iframe
  if (isSidePanel && isInIframe) {
    console.log('[Navigation Handler] This page is loaded in a side panel iframe');

    // Get stored navigation data
    chrome.storage.local.get('sidePanelNavData', function (data) {
      if (data && data.sidePanelNavData) {
        const { history, currentIndex } = data.sidePanelNavData;
        injectNavBarInIframe(history, currentIndex, window.location.href);
      } else {
        // If no data found, use defaults
        injectNavBarInIframe([], 0, window.location.href);
      }
    });

    // Add keyboard shortcut listener
    document.addEventListener('keydown', function (e) {
      // Alt+Home or Alt+H to return home
      if ((e.altKey && e.key === 'Home') || (e.altKey && e.key === 'h')) {
        e.preventDefault();
        console.log('[Navigation Handler] Keyboard shortcut for home detected');

        // Directly call Chrome API to return home
        try {
          chrome.runtime.sendMessage({
            action: 'navigateHome',
            source: 'keyboard-shortcut',
            timestamp: Date.now()
          });
        } catch (err) {
          console.error('[Navigation Handler] Failed to trigger home navigation via keyboard:', err);
        }
      }
      // Alt+Left Arrow - Back
      if (e.altKey && e.key === 'ArrowLeft') {
        window.parent.postMessage({ action: 'navigateBack' }, '*');
      }
      // Alt+Right Arrow - Forward
      else if (e.altKey && e.key === 'ArrowRight') {
        window.parent.postMessage({ action: 'navigateForward' }, '*');
      }
    });

    // Listen for link clicks in page
    document.addEventListener('click', function (e) {
      // Check if clicked element is a link
      let linkElement = e.target;
      while (linkElement && linkElement.tagName !== 'A') {
        linkElement = linkElement.parentElement;
      }

      // If link is clicked
      if (linkElement && linkElement.tagName === 'A') {
        const href = linkElement.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          // Record link click event to notify parent window to update history
          console.log('[Navigation Handler] Link clicked:', href);

          // Convert relative path to absolute path
          const absoluteUrl = new URL(href, window.location.href).href;

          // If open in new window or new tab, let browser handle it
          if (linkElement.target === '_blank' || e.ctrlKey || e.metaKey) {
            return;
          }

          // Otherwise intercept click, notify parent window to navigate
          e.preventDefault();

          // Add sidepanel_view param
          const urlObj = new URL(absoluteUrl);
          urlObj.searchParams.set('sidepanel_view', 'true');
          const urlWithParam = urlObj.toString();

          // Notify parent window to update history and navigate
          window.parent.postMessage({
            action: 'navigateToUrl',
            url: urlWithParam
          }, '*');

          // Directly navigate in current window
          window.location.href = urlWithParam;
        }
      }
    });

    // Listen for URL changes (SPA apps and pushState changes)
    let lastUrl = window.location.href;
    // Create listener to check URL changes
    const urlChangeChecker = setInterval(() => {
      if (lastUrl !== window.location.href) {
        console.log('[Navigation Handler] URL changed from:', lastUrl, 'to:', window.location.href);
        // Notify parent window to update history
        window.parent.postMessage({
          action: 'updateHistory',
          url: window.location.href
        }, '*');
        lastUrl = window.location.href;
      }
    }, 500);

    // Clear checker when page unloads
    window.addEventListener('unload', () => {
      clearInterval(urlChangeChecker);
    });
  } else {
    console.log('[Navigation Handler] Not in side panel iframe, not injecting navigation bar');
  }
});

// Listen for postMessage
window.addEventListener('message', function (event) {
  console.log('[Navigation Handler] Received message:', event.data);

  if (!event.data || typeof event.data !== 'object') return;

  const { action } = event.data;

  // If navigation action, forward to parent window
  if (action === 'navigateHome' || action === 'navigateBack' || action === 'navigateForward') {
    if (window !== window.top) {
      // In iframe, send message to parent window
      window.parent.postMessage(event.data, '*');
    }
  } else if (action === 'injectNavBarInIframe') {
    // Receive message from sidepanel-manager.js, inject navbar in iframe
    const { history, currentIndex, url } = event.data;
    injectNavBarInIframe(history, currentIndex, url);
  }
});

// Inject navbar in iframe
function injectNavBarInIframe(history, currentIndex, url) {
  console.log('[Navigation Handler] Injecting navigation bar in iframe');

  // Check if navbar already exists
  if (document.querySelector('.iframe-sidepanel-nav-bar') ||
    document.querySelector('.sidepanel-nav-bar') ||
    document.querySelector('.simple-nav-bar')) {
    console.log('[Navigation Handler] Navigation bar already exists');
    return;
  }

  // Create styles
  const style = document.createElement('style');
  style.textContent = `
    .iframe-sidepanel-nav-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background-color: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      align-items: center;
      padding: 0 10px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .iframe-sidepanel-nav-bar button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px 8px;
      margin-right: 5px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
    }
    
    .iframe-sidepanel-nav-bar button span {
      font-size: 14px;
      margin-left: 4px;
    }
    
    .iframe-sidepanel-nav-bar button:hover {
      background-color: #e9ecef;
    }
    
    .iframe-sidepanel-nav-bar button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .iframe-sidepanel-nav-bar .url-display {
      flex-grow: 1;
      margin: 0 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      color: #666;
    }
    
    body {
      margin-top: 40px !important;
      padding-top: 10px;
    }
    
    @media (prefers-color-scheme: dark) {
      .iframe-sidepanel-nav-bar {
        background-color: #292a2d;
        border-bottom-color: #3c4043;
        color: #e8eaed;
      }
      
      .iframe-sidepanel-nav-bar button {
        color: #e8eaed;
      }
      
      .iframe-sidepanel-nav-bar button:hover {
        background-color: #3c4043;
      }
      
      .iframe-sidepanel-nav-bar .url-display {
        color: #e8eaed;
      }
    }
  `;

  // Create navbar
  const navBar = document.createElement('div');
  navBar.className = 'iframe-sidepanel-nav-bar';

  // Add home button
  const homeButton = document.createElement('button');
  homeButton.id = 'iframe-home-button'; // Add ID for easier selection
  homeButton.title = 'Return to Bookmark List'; // Add title for selector matching
  homeButton.innerHTML = '<span>Return to Bookmarks</span>';

  // Use Chrome API to navigate home
  const navigateToHome = () => {
    console.log('[Navigation Handler] Executing direct home navigation');

    // Try multiple methods to return home
    let succeeded = false;

    // 1. Try setting URL directly
    try {
      console.log('[Navigation Handler] Attempting direct URL navigation');
      // Get extension root URL
      const extensionUrl = chrome.runtime.getURL('src/sidepanel.html');

      // Since iframe might be restricted, notify parent window to navigate
      window.parent.postMessage({
        action: 'directNavigate',
        url: extensionUrl
      }, '*');

      // Also try navigating self (might be blocked)
      try {
        window.top.location.href = extensionUrl;
        succeeded = true;
      } catch (e) {
        console.log('[Navigation Handler] Could not navigate top window, continuing with other methods');
      }

      return true;
    } catch (e) {
      console.error('[Navigation Handler] Direct URL navigation failed:', e);
    }

    // 2. Prioritize Chrome API
    if (!succeeded && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          action: 'navigateHome',
          source: 'iframe-direct',
          timestamp: Date.now()
        }, (response) => {
          console.log('[Navigation Handler] Direct home navigation response:', response);
        });
        return true;
      } catch (e) {
        console.error('[Navigation Handler] Chrome API navigation failed:', e);
      }
    }

    // 3. Backup method: communication via parent window
    if (!succeeded) {
      try {
        window.parent.postMessage({
          action: 'navigateHome',
          source: 'iframe-backup',
          timestamp: Date.now()
        }, '*');
        console.log('[Navigation Handler] Sent home navigation message to parent');
        return true;
      } catch (e) {
        console.error('[Navigation Handler] Parent window messaging failed:', e);
        return false;
      }
    }
  };

  // Add click and other events
  homeButton.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[Navigation Handler] Home button clicked in iframe');
    navigateToHome();
  });

  // Add double-click as backup
  homeButton.addEventListener('dblclick', (e) => {
    e.preventDefault();
    console.log('[Navigation Handler] Home button double-clicked in iframe');
    navigateToHome();
  });

  // Add back/forward buttons
  const backButton = document.createElement('button');
  backButton.innerHTML = '<span>Back</span>';
  backButton.title = 'Back';
  backButton.disabled = !history || currentIndex <= 0;
  backButton.addEventListener('click', () => {
    // Send message to parent window, requesting back
    window.parent.postMessage({ action: 'navigateBack' }, '*');
  });

  const forwardButton = document.createElement('button');
  forwardButton.innerHTML = '<span>Forward</span>';
  forwardButton.title = 'Forward';
  forwardButton.disabled = !history || currentIndex >= history.length - 1;
  forwardButton.addEventListener('click', () => {
    // Send message to parent window, requesting forward
    window.parent.postMessage({ action: 'navigateForward' }, '*');
  });

  // Add refresh button
  const refreshButton = document.createElement('button');
  refreshButton.innerHTML = '<span>Refresh</span>';
  refreshButton.title = 'Refresh';
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });

  // Add open in new tab button
  const openInTabButton = document.createElement('button');
  openInTabButton.innerHTML = '<span>New Tab</span>';
  openInTabButton.title = 'Open in New Tab';
  openInTabButton.addEventListener('click', () => {
    // Send message to parent window, requesting open in new tab
    window.parent.postMessage({ action: 'openInNewTab' }, '*');
  });

  // Add URL display
  const urlDisplay = document.createElement('div');
  urlDisplay.className = 'url-display';
  urlDisplay.textContent = url || window.location.href.split('?')[0]; // Remove URL params

  // 将元素添加到导航栏
  navBar.appendChild(homeButton);
  navBar.appendChild(backButton);
  navBar.appendChild(forwardButton);
  navBar.appendChild(refreshButton);
  navBar.appendChild(openInTabButton);
  navBar.appendChild(urlDisplay);

  // Add styles and navbar to document
  document.head.appendChild(style);
  document.body.insertBefore(navBar, document.body.firstChild);

  console.log('[Navigation Handler] Navigation bar injected successfully');

  // Add navigation button event listeners
  const iframeHomeButton = document.querySelector('.iframe-sidepanel-nav-bar button[title="Return to Bookmark List"]');
  const iframeBackButton = document.querySelector('.iframe-sidepanel-nav-bar button[title="Back"]');
  const iframeForwardButton = document.querySelector('.iframe-sidepanel-nav-bar button[title="Forward"]');

  if (iframeHomeButton) {
    iframeHomeButton.addEventListener('click', () => {
      console.log('[Navigation Handler] Home button clicked in iframe');
      // Send message to parent window
      window.parent.postMessage({ action: 'navigateHome' }, '*');
      // Also try message via chrome API
      try {
        chrome.runtime.sendMessage({ action: 'navigateHome' });
      } catch (e) {
        console.log('[Navigation Handler] Failed to send message via chrome API:', e);
      }
    });
  }

  if (iframeBackButton) {
    iframeBackButton.addEventListener('click', () => {
      console.log('[Navigation Handler] Back button clicked in iframe');
      window.parent.postMessage({ action: 'navigateBack' }, '*');
      try {
        chrome.runtime.sendMessage({ action: 'navigateBack' });
      } catch (e) {
        console.log('[Navigation Handler] Failed to send message via chrome API:', e);
      }
    });
  }

  if (iframeForwardButton) {
    iframeForwardButton.addEventListener('click', () => {
      console.log('[Navigation Handler] Forward button clicked in iframe');
      window.parent.postMessage({ action: 'navigateForward' }, '*');
      try {
        chrome.runtime.sendMessage({ action: 'navigateForward' });
      } catch (e) {
        console.log('[Navigation Handler] Failed to send message via chrome API:', e);
      }
    });
  }
} 