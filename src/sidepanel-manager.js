// Define global SidePanelManager class
class SidePanelManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.isNavigating = false;

    this.init();
  }

  init() {
    if (!this.isSidePanel()) return;

    // Do not directly add navigation bar on initialization anymore
    // this.addNavigationBar();

    // Initialize event listeners
    this.initEventListeners();

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "navigateBack") {
        this.navigateBack();
        sendResponse({ success: true });
      } else if (message.action === "navigateForward") {
        this.navigateForward();
        sendResponse({ success: true });
      } else if (message.action === "navigateHome") {
        this.navigateHome();
        sendResponse({ success: true });
      } else if (message.action === "getCurrentHistory") {
        sendResponse({
          history: this.history,
          currentIndex: this.currentIndex
        });
      }
      return true; // Keep message channel open for asynchronous response
    });
  }

  // Check if currently in side panel mode
  isSidePanel() {
    return window.location.pathname.endsWith('sidepanel.html');
  }

  addNavigationBar() {
    // Check if navigation bar already exists to avoid duplicate addition
    if (document.querySelector('.side-panel-nav')) return;

    const navBar = document.createElement('div');
    navBar.className = 'side-panel-nav';
    navBar.innerHTML = `
      <div class="nav-controls">
        <button id="back-btn" disabled>
          <span class="material-icons">arrow_back</span>
        </button>
        <button id="forward-btn" disabled>
          <span class="material-icons">arrow_forward</span>
        </button>
        <button id="refresh-btn">
          <span class="material-icons">refresh</span>
        </button>
        <button id="open-in-tab-btn">
          <span class="material-icons">open_in_new</span>
        </button>
      </div>
      <div class="url-container">
        <input type="text" id="url-input" class="url-input">
      </div>
      <div class="toggle-compact-btn">
        <span class="material-icons">expand_more</span>
      </div>
    `;

    document.body.insertBefore(navBar, document.body.firstChild);

    // Initialize navigation button events
    document.getElementById('back-btn').addEventListener('click', () => this.goBack());
    document.getElementById('forward-btn').addEventListener('click', () => this.goForward());
    document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
    document.getElementById('open-in-tab-btn').addEventListener('click', () => this.openInNewTab());

    // URL Input box event
    const urlInput = document.getElementById('url-input');
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.loadUrl(urlInput.value);
      }
    });

    // Add compact mode toggle event
    const toggleCompact = document.querySelector('.toggle-compact-btn');
    if (toggleCompact) {
      toggleCompact.addEventListener('click', () => {
        navBar.classList.toggle('compact-mode');
        document.body.classList.toggle('nav-compact-mode');
        // Toggle icon direction
        const icon = toggleCompact.querySelector('.material-icons');
        icon.textContent = navBar.classList.contains('compact-mode') ? 'expand_less' : 'expand_more';

        // Save user preference
        chrome.storage.local.set({
          'sidepanel_nav_compact_mode': navBar.classList.contains('compact-mode')
        });
      });
    }

    // Restore user preference for compact mode from storage
    chrome.storage.local.get(['sidepanel_nav_compact_mode'], (result) => {
      if (result.sidepanel_nav_compact_mode) {
        navBar.classList.add('compact-mode');
        document.body.classList.add('nav-compact-mode');
        // Update icon
        const icon = toggleCompact.querySelector('.material-icons');
        if (icon) icon.textContent = 'expand_less';
      }
    });
  }

  initEventListeners() {
    // Listen for messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "updateUrl") {
        this.updateUrlBar(message.url);
        this.addToHistory(message.url);
      }
    });

    // Add listener for window message event, handling messages from iframe
    window.addEventListener('message', (event) => {
      console.log('[SidePanelManager] Received message from iframe:', event.data);

      if (!event.data || typeof event.data !== 'object') return;

      const { action } = event.data;

      switch (action) {
        case 'navigateBack':
          console.log('[SidePanelManager] Processing navigateBack from iframe');
          this.navigateBack();
          break;

        case 'navigateForward':
          console.log('[SidePanelManager] Processing navigateForward from iframe');
          this.navigateForward();
          break;

        case 'navigateHome':
          console.log('[SidePanelManager] Processing navigateHome from iframe');
          this.navigateHome();
          break;

        case 'openInNewTab':
          console.log('[SidePanelManager] Processing openInNewTab from iframe');
          this.openInNewTab();
          break;

        case 'navigateToUrl':
          console.log('[SidePanelManager] Processing navigateToUrl from iframe:', event.data.url);
          // Use loadUrl method to load URL and update history
          this.loadUrl(event.data.url);
          break;

        case 'updateHistory':
          console.log('[SidePanelManager] Processing updateHistory from iframe:', event.data.url);
          // Update history without reloading the page
          this.addToHistory(event.data.url);
          this.updateUrlBar(event.data.url);
          break;
      }
    });
  }

  // Load URL using chrome.sidePanel.setOptions API
  loadUrl(url) {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    // Show loading animation
    this.showLoadingSpinner();

    // Add marker parameter to indicate page opened in side panel
    if (!url.includes('sidepanel_view=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }

    console.log('[SidePanelManager] Loading URL with setOptions:', url);

    // Send message to background script for handling
    chrome.runtime.sendMessage({
      action: 'openUrlInSidePanel',
      url: url
    }, (response) => {
      if (response && response.success) {
        console.log('[SidePanelManager] Successfully opened URL in side panel');
        // Hide loading animation after successful load
        setTimeout(() => this.hideLoadingSpinner(), 500);
      } else {
        console.error('[SidePanelManager] Error opening URL in side panel:', response ? response.error : 'Unknown error');
        // Fallback to iframe method if error occurs
        this.loadUrlWithIframe(url);
      }
    });
  }

  // Keep original iframe method as alternative
  loadUrlWithIframe(url) {
    console.log('[SidePanelManager] Falling back to iframe mode for URL:', url);

    // Show loading animation
    this.showLoadingSpinner();

    // Ensure URL contains marker parameter
    if (!url.includes('sidepanel_view=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }

    // Add navigation bar, only when loading content
    this.addNavigationBar();

    // Find or create side panel content container
    let sidePanelContent = document.getElementById('side-panel-content');
    let sidePanelIframe = document.getElementById('side-panel-iframe');

    if (!sidePanelContent) {
      console.log('[SidePanelManager] Creating side panel content container');
      sidePanelContent = document.createElement('div');
      sidePanelContent.id = 'side-panel-content';
      sidePanelContent.className = 'side-panel-content';
      document.body.appendChild(sidePanelContent);
    }

    if (!sidePanelIframe) {
      console.log('[SidePanelManager] Creating side panel iframe');
      sidePanelIframe = document.createElement('iframe');
      sidePanelIframe.id = 'side-panel-iframe';
      sidePanelIframe.className = 'side-panel-iframe';
      sidePanelContent.appendChild(sidePanelIframe);
    }

    // Show side panel content
    sidePanelContent.style.display = 'block';

    // Set iframe src
    sidePanelIframe.src = url;

    // Register one-time load event to ensure history data is sent even if iframe exists
    const loadHandler = () => {
      this.hideLoadingSpinner();

      // Send history data to iframe for updating navigation bar state
      try {
        sidePanelIframe.contentWindow.postMessage({
          action: 'injectNavBarInIframe',
          history: this.history,
          currentIndex: this.currentIndex,
          url: url
        }, '*');
      } catch (e) {
        console.error('[SidePanelManager] Error sending history data to iframe on load:', e);
      }

      // Remove event listener to avoid repetition
      sidePanelIframe.removeEventListener('load', loadHandler);
    };

    sidePanelIframe.addEventListener('load', loadHandler);

    // Add back button
    this.addBackButton();

    // Update URL bar and history
    this.updateUrlBar(url);
  }

  // Show loading indicator
  showLoadingSpinner(position = 'top-right') {
    let loadingIndicator = document.getElementById('side-panel-loading-indicator');

    // If loading indicator doesn't exist, create it
    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'side-panel-loading-indicator';
      loadingIndicator.className = 'loading-indicator';

      // Create simple loading spinner
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
  }

  // Hide loading indicator
  hideLoadingSpinner() {
    const loadingIndicator = document.getElementById('side-panel-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }

  // Navigate back to bookmark list home page
  navigateHome() {
    console.log('[SidePanelManager] Navigating to home page');

    // Use Chrome side panel API to return home
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'src/sidepanel.html'
    }).then(() => {
      console.log('[SidePanelManager] Successfully navigated to home page');
    }).catch(error => {
      console.error('[SidePanelManager] Error navigating to home page:', error);
    });
  }

  // Navigate to previous URL in history
  navigateBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const previousUrl = this.history[this.currentIndex];
      console.log('[SidePanelManager] Navigating back to:', previousUrl);

      // Mark as navigating to avoid duplicate history entry
      this.isNavigating = true;

      // Use Chrome side panel API to navigate back
      chrome.sidePanel.setOptions({
        path: previousUrl
      }).then(() => {
        console.log('[SidePanelManager] Successfully navigated back');

        // Update history state in storage
        chrome.storage.local.set({
          sidePanelNavData: {
            history: this.history,
            currentIndex: this.currentIndex
          }
        });

        // Update iframe navigation bar state via message
        const iframe = document.getElementById('side-panel-iframe');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              action: 'injectNavBarInIframe',
              history: this.history,
              currentIndex: this.currentIndex,
              url: previousUrl
            }, '*');
          } catch (e) {
            console.error('[SidePanelManager] Error sending message to iframe:', e);
          }
        }
      }).catch(error => {
        console.error('[SidePanelManager] Error navigating back:', error);
        this.isNavigating = false;
      });
    } else {
      console.log('[SidePanelManager] Cannot navigate back, already at earliest history entry');
    }
  }

  // Navigate to next URL in history
  navigateForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const nextUrl = this.history[this.currentIndex];
      console.log('[SidePanelManager] Navigating forward to:', nextUrl);

      // Mark as navigating to avoid duplicate history entry
      this.isNavigating = true;

      // Use Chrome side panel API to navigate forward
      chrome.sidePanel.setOptions({
        path: nextUrl
      }).then(() => {
        console.log('[SidePanelManager] Successfully navigated forward');

        // Update history state in storage
        chrome.storage.local.set({
          sidePanelNavData: {
            history: this.history,
            currentIndex: this.currentIndex
          }
        });

        // Update iframe navigation bar state via message
        const iframe = document.getElementById('side-panel-iframe');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              action: 'injectNavBarInIframe',
              history: this.history,
              currentIndex: this.currentIndex,
              url: nextUrl
            }, '*');
          } catch (e) {
            console.error('[SidePanelManager] Error sending message to iframe:', e);
          }
        }
      }).catch(error => {
        console.error('[SidePanelManager] Error navigating forward:', error);
        this.isNavigating = false;
      });
    } else {
      console.log('[SidePanelManager] Cannot navigate forward, already at latest history entry');
    }
  }

  // Add back button
  addBackButton() {
    let backButton = document.querySelector('.back-to-links');

    if (!backButton) {
      backButton = document.createElement('div');
      backButton.className = 'back-to-links';
      backButton.innerHTML = '<span class="material-icons">arrow_back</span>';
      document.body.appendChild(backButton);

      // Add click event
      backButton.addEventListener('click', () => {
        this.closeIframe();
      });
    }

    // Show back button
    backButton.style.display = 'flex';
  }

  // Close iframe
  closeIframe() {
    const sidePanelContent = document.getElementById('side-panel-content');
    const backButton = document.querySelector('.back-to-links');
    const navBar = document.querySelector('.side-panel-nav');

    if (sidePanelContent) {
      sidePanelContent.style.display = 'none';
    }

    if (backButton) {
      backButton.style.display = 'none';
    }

    // Remove navigation bar also
    if (navBar) {
      navBar.remove();
    }
  }

  goBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadUrl(this.history[this.currentIndex]);
      this.updateNavigationButtons();
    }
  }

  goForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.loadUrl(this.history[this.currentIndex]);
      this.updateNavigationButtons();
    }
  }

  refresh() {
    if (this.currentIndex >= 0) {
      this.loadUrl(this.history[this.currentIndex]);
    }
  }

  openInNewTab() {
    if (this.currentIndex >= 0) {
      chrome.tabs.create({ url: this.history[this.currentIndex] });
    }
  }

  addToHistory(url) {
    if (this.isNavigating) {
      this.isNavigating = false;
      return;
    }

    this.currentIndex++;
    this.history = this.history.slice(0, this.currentIndex);
    this.history.push(url);
    this.updateNavigationButtons();

    // Save history to local storage for use in iframe navigation bar
    chrome.storage.local.set({
      sidePanelNavData: {
        history: this.history,
        currentIndex: this.currentIndex
      }
    });

    // If iframe exists, update its navigation bar state
    const iframe = document.getElementById('side-panel-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          action: 'injectNavBarInIframe',
          history: this.history,
          currentIndex: this.currentIndex,
          url: url
        }, '*');
      } catch (e) {
        console.error('[SidePanelManager] Error sending message to iframe:', e);
      }
    }
  }

  updateNavigationButtons() {
    // Update buttons in main UI
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');

    if (backBtn) backBtn.disabled = this.currentIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = this.currentIndex >= this.history.length - 1;

    // Save history state to local storage
    chrome.storage.local.set({
      sidePanelNavData: {
        history: this.history,
        currentIndex: this.currentIndex
      }
    }, () => {
      console.log('[SidePanelManager] Saved navigation state to storage:',
        { history: this.history, currentIndex: this.currentIndex });
    });

    // Update navigation button status in iframe
    const iframe = document.getElementById('side-panel-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          action: 'injectNavBarInIframe',
          history: this.history,
          currentIndex: this.currentIndex,
          url: this.history[this.currentIndex] || document.getElementById('url-input')?.value
        }, '*');
      } catch (e) {
        console.error('[SidePanelManager] Error sending navigation update to iframe:', e);
      }
    }
  }

  updateUrlBar(url) {
    document.getElementById('url-input').value = url;
  }
}

// Create global instance
window.addEventListener('DOMContentLoaded', () => {
  // Create global instance
  window.sidePanelManager = new SidePanelManager();

  // Expose SidePanelManager class to global scope
  window.SidePanelManager = SidePanelManager;
});