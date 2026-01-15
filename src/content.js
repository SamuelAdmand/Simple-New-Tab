(function () {
  function getSelectedText() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Check if selection includes extension's Shadow DOM
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const container = range.commonAncestorContainer;

      // If selection is inside extension's Shadow DOM, return empty string
      if (extensionContainer.contains(container) ||
        (shadow && shadow.contains(container))) {
        return '';
      }
    }

    return selectedText;
  }

  function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') || urlParams.get('p') || urlParams.get('text') || urlParams.get('wd') || '';
  }

  function fetchBookmarks() {
    return new Promise((resolve, reject) => {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'fetchBookmarks' }, (response) => {
          if (response && response.bookmarks) {
            resolve(response.bookmarks);
          } else {
            reject(new Error(response.error || 'Failed to fetch bookmarks'));
          }
        });
      } else {
        reject(new Error('chrome.runtime.sendMessage is not available'));
      }
    });
  }

  function faviconURL(bookmarkUrl) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", bookmarkUrl);
    url.searchParams.set("size", "32");
    return url.toString();
  }

  function createBookmarkElement(bookmark) {
    const bookmarkElement = document.createElement('li');
    bookmarkElement.className = 'bookmark-item';
    const faviconUrl = faviconURL(bookmark.url);
    bookmarkElement.innerHTML = `
      <a href="${bookmark.url}" target="_blank" class="bookmark-link">
        <img src="${faviconUrl}" alt="favicon" class="bookmark-icon">
        <span class="bookmark-title">${bookmark.title}</span>
      </a>
    `;

    bookmarkElement.addEventListener('click', () => {
      window.open(bookmark.url, '_blank');
    });

    return bookmarkElement;
  }

  function displayBookmarksRecursive(bookmarkNode, container) {
    if (bookmarkNode.children) {
      bookmarkNode.children.forEach((child) => {
        if (child.url) {
          container.appendChild(createBookmarkElement(child));
        } else if (child.children) {
          displayBookmarksRecursive(child, container);
        }
      });
    }
  }

  async function displayBookmarks() {
    try {
      // 1. Get all bookmarks
      const bookmarks = await fetchBookmarks();
      const bookmarkListContainer = shadow.getElementById('bookmark-list');
      bookmarkListContainer.innerHTML = '';

      // 2. Get default folder list
      const { defaultFolders } = await chrome.storage.sync.get('defaultFolders');
      const { lastViewedFolder } = await chrome.storage.local.get('lastViewedFolder');

      let folderToShow = null;
      let folderContents = [];

      // 3. Modify logic to match new tab page, but fetch bookmarks via message passing
      if (defaultFolders?.items?.length > 0) {
        // Check if last viewed folder is in default folder list
        let folderToActivate;

        if (lastViewedFolder && defaultFolders.items.some(f => f.id === lastViewedFolder)) {
          folderToActivate = lastViewedFolder;
        } else {
          // Otherwise use first default folder
          folderToActivate = defaultFolders.items[0].id;
        }

        try {
          // Fetch folder info via message passing
          const response = await chrome.runtime.sendMessage({
            action: 'getBookmarkFolder',
            folderId: folderToActivate
          });

          if (response.success && response.folder) {
            folderToShow = response.folder;
            if (response.children) {
              folderContents = response.children;
            }
          }
        } catch (error) {
          console.log('Folder not found:', error);
        }
      }

      // If no valid folder found, fallback to root bookmark folder (id='1')
      if (!folderToShow) {
        try {
          // Fetch root folder info via message passing
          const response = await chrome.runtime.sendMessage({
            action: 'getBookmarkFolder',
            folderId: '1'
          });

          if (response.success && response.folder) {
            folderToShow = response.folder;
            if (response.children) {
              folderContents = response.children;
            }
          }
        } catch (error) {
          console.log('Root folder not found:', error);
        }
      }

      // Display selected folder content
      if (folderToShow) {
        if (folderToShow.url) {
          bookmarkListContainer.appendChild(createBookmarkElement(folderToShow));
        } else if (folderContents.length > 0) {
          // Use fetched folder content
          folderContents.forEach(child => {
            if (child.url) {
              bookmarkListContainer.appendChild(createBookmarkElement(child));
            }
          });
        } else {
          // If no pre-fetched content, try recursive display
          displayBookmarksRecursive(folderToShow, bookmarkListContainer);
        }
      } else {
        // Final fallback: display all bookmarks
        displayBookmarksRecursive(bookmarks[0], bookmarkListContainer);
      }

    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  }

  function findBookmarkNodeById(node, id) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      for (let child of node.children) {
        let result = findBookmarkNodeById(child, id);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  function findBookmarksByParentId(node, parentId) {
    let result = [];
    if (node.id === parentId) {
      return node.children || [];
    }
    if (node.children) {
      for (let child of node.children) {
        result = result.concat(findBookmarksByParentId(child, parentId));
      }
    }
    return result;
  }

  function getDefaultBookmarkId() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getDefaultBookmarkId' }, (response) => {
        if (response && response.defaultBookmarkId !== undefined) {
          resolve(response.defaultBookmarkId);
        } else {
          reject(new Error('Cannot get default bookmark ID'));
        }
      });
    });
  }

  let cachedSelectedText = "";

  const extensionContainer = document.createElement('div');
  document.body.appendChild(extensionContainer);

  const shadow = extensionContainer.attachShadow({ mode: 'open' });

  const floatingButton = document.createElement('div');
  floatingButton.id = 'floating-button';
  floatingButton.innerHTML = `
    <img src="${chrome.runtime.getURL('../images/icon-48.png')}" alt="icon" class="floating-button-icon">
    <div class="floating-tooltip">
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-action">${chrome.i18n.getMessage('floatingBallClickTip')}</span>
          <span class="tooltip-desc">${chrome.i18n.getMessage('floatingBallClickDesc')}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-action">${chrome.i18n.getMessage('floatingBallAltClickTip')}</span>
          <span class="tooltip-desc">${chrome.i18n.getMessage('floatingBallAltClickDesc')}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-action">${chrome.i18n.getMessage('floatingBallShortcutTip')}</span>
          <span class="tooltip-desc">${chrome.i18n.getMessage('floatingBallShortcutDesc')}</span>
        </div>
      </div>
      <button class="tooltip-close" title="${chrome.i18n.getMessage('doNotShowAgain')}">
        <svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 -960 960 960" width="16" fill="currentColor">
          <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
        </svg>
      </button>
    </div>
  `;

  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sidebar-container';
  sidebarContainer.classList.add('collapsed');

  shadow.appendChild(floatingButton);
  shadow.appendChild(sidebarContainer);

  // Add click event handler for close button
  const closeButton = floatingButton.querySelector('.tooltip-close');
  closeButton?.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling
    chrome.storage.local.set({ 'hideFloatingTooltip': true }, () => {
      const tooltip = floatingButton.querySelector('.floating-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    });
  });

  // Check if tooltip needs to be displayed
  chrome.storage.local.get(['hideFloatingTooltip'], (result) => {
    if (result.hideFloatingTooltip) {
      const tooltip = floatingButton.querySelector('.floating-tooltip');
      if (tooltip) {
        tooltip.style.display = 'none';
      }
    }
  });

  function getCurrentSearchEngine() {
    const hostname = window.location.hostname;
    if (hostname.includes('google.com')) {
      return 'google';
    } else if (hostname.includes('bing.com')) {
      return 'bing';
    } else if (hostname.includes('baidu.com')) {
      return 'baidu';
    } else if (hostname.includes('kimi.moonshot.cn')) {
      return 'kimi';
    } else if (hostname.includes('felo.ai')) {
      return 'felo';
    } else if (hostname.includes('metaso.cn')) {
      return 'metaso';
    } else if (hostname.includes('doubao.com')) {
      return 'doubao';
    } else {
      return 'bing';
    }
  }

  const defaultSearchEngine = getCurrentSearchEngine();

  const searchSwitcher = document.createElement('aside');
  searchSwitcher.id = 'search-switcher';
  searchSwitcher.innerHTML = `
<ul>
  <li data-url="https://www.google.com/search?q=" data-shortcut="1" ${defaultSearchEngine === 'google' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/google-logo.svg')}" alt="Google" class="search-icon">
    <span>Google <span class="shortcut-key">Alt+1</span></span>
  </li>
  <li data-url="https://www.bing.com/search?q=" data-shortcut="2" ${defaultSearchEngine === 'bing' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/bing-logo.png')}" alt="Bing" class="search-icon">
    <span>Bing <span class="shortcut-key">Alt+2</span></span>
  </li>
  <li data-url="https://www.baidu.com/s?wd=" data-shortcut="3" ${defaultSearchEngine === 'baidu' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/baidu-logo.svg')}" alt="Baidu" class="search-icon">
    <span>Baidu <span class="shortcut-key">Alt+3</span></span>
  </li>
  <li data-url="https://kimi.moonshot.cn/?q=" data-shortcut="4" ${defaultSearchEngine === 'kimi' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/kimi-logo.svg')}" alt="Kimi" class="search-icon">
    <span>Kimi <span class="shortcut-key">Alt+4</span></span>
  </li>
  <li data-url="https://felo.ai/search?q=" data-shortcut="5" ${defaultSearchEngine === 'felo' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/felo-logo.svg')}" alt="Felo" class="search-icon">
    <span>Felo <span class="shortcut-key">Alt+5</span></span>
  </li>
  <li data-url="https://metaso.cn/?q=" data-shortcut="6" ${defaultSearchEngine === 'metaso' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/sider-icon/metaso-logo.png')}" alt="Metaso" class="search-icon">
    <span>Metaso <span class="shortcut-key">Alt+6</span></span>
  </li>
  <li data-url="https://www.doubao.com/chat/?q=" data-shortcut="7" ${defaultSearchEngine === 'doubao' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/sider-icon/doubao-logo.png')}" alt="Doubao" class="search-icon">
    <span>Doubao <span class="shortcut-key">Alt+7</span></span>
  </li>
  <li data-url="https://chatgpt.com/?q=" data-shortcut="8" ${defaultSearchEngine === 'ChatGPT' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/sider-icon/chatgpt-logo.svg')}" alt="ChatGPT" class="search-icon">
    <span>ChatGPT <span class="shortcut-key">Alt+8</span></span>
  </li>
  <li data-url="https://grok.com/?q=" data-shortcut="9" ${defaultSearchEngine === 'grok' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/grok-logo.svg')}" alt="Grok" class="search-icon">
    <span>Grok <span class="shortcut-key">Alt+9</span></span>
  </li>
</ul>
<ul id="bookmark-list"></ul>
  `;

  sidebarContainer.appendChild(searchSwitcher);

  floatingButton.addEventListener('click', (event) => {
    if (event.altKey) {
      // Alt + Click to open side panel
      chrome.runtime.sendMessage({
        action: 'openSidePanel'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to open side panel:', chrome.runtime.lastError.message);
        }
      });
    } else {
      // Normal click to open search panel
      if (sidebarContainer) {
        sidebarContainer.classList.remove('collapsed');
      }
    }
  });

  sidebarContainer.addEventListener('mouseleave', () => {
    sidebarContainer.classList.add('collapsed');
  });

  function getSearchText() {
    return cachedSelectedText || getSearchQuery() || getSelectedText() || '';
  }

  function openSearch(item) {
    const searchText = getSearchText();
    const baseUrl = item.getAttribute('data-url');
    if (baseUrl) {
      const searchUrl = baseUrl + encodeURIComponent(searchText.trim());
      window.open(searchUrl, '_blank');

      searchSwitcher.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
      item.classList.add('selected');
      localStorage.setItem('selectedSearchEngine', item.textContent.trim().split(' ')[0]);
    }
  }

  function openAllSearches() {
    const searchText = getSearchText();
    if (searchText) {
      searchSwitcher.querySelectorAll('li').forEach(item => {
        const baseUrl = item.getAttribute('data-url');
        if (baseUrl) {
          const searchUrl = baseUrl + encodeURIComponent(searchText.trim());
          window.open(searchUrl, '_blank');
        }
      });
    }
  }

  searchSwitcher.querySelectorAll('li').forEach(item => {
    item.addEventListener('mousedown', () => {
      cachedSelectedText = getSelectedText();
    });

    item.addEventListener('click', (event) => {
      openSearch(event.target.closest('li'));
    });
  });

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    #sidebar-container {
      position: fixed;
      top: 0;
      right: 0;
      width: 280px;
      height: 100vh;
      background-color: #ffffff;
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease;
      transform: translateX(100%);
      z-index: 2147483647;
      padding: 8px;
    }

    #sidebar-container.collapsed {
      transform: translateX(100%);
    }

    #sidebar-container:not(.collapsed) {
      transform: translateX(0);
    }

    #floating-button {
      position: fixed;
      width: 40px;
      height: 40px;
      top: 20%;
      right: 0;
      background-color: #ffffff;
      border-radius: 20px 0 0 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483647;
      font-size: 16px;
      color: #374151;
      user-select: none;
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    img.floating-button-icon {
      width: 24px;
      margin: 0 0 0 4px !important;
    }

    #floating-button:hover {
      background-color: #e2e8f0;
      width: 60px;
    }

    aside {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      background-color: #ffffff;
      overflow: auto;
      padding: 20px 0 0px 0;
    }

    aside ul {
      list-style-type: none;
      padding: 0;
      width: 100%;
      margin: 0;
    }

    aside ul li {
      display: flex;
      position: relative; 
      font-size: 14px;
      font-weight: 600;
      color: #1a202c;
      line-height: 20px;
      padding: 8px 16px;
      margin: 4px 8px !important;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      cursor: pointer;
      border-radius: 8px;
      transition: background-color 0.3s, color 0.3s;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;
    }

    aside ul li:hover {
      background-color: #f0f0f0;
      margin: 4px 8px;
      color: #4285f4;
    }

    aside ul li.selected {
      background-color: #e2e8f0;
      font-weight: bold;
      color: #4285f4;
    }

    aside ul li.selected span {
      font-weight: bold;
    }

    .search-icon {
      height: 16px;
      margin: 0px 8px 0px 0px;
    }
    .shortcut-key {
      color: #717882;
      font-size: 12px;
      margin-left: 10px;
      position: absolute;
      left: 70%;
    }

    .bookmark-item {
      display: flex;
      align-items: center;
      margin: 4px 8px !important;
      padding: 8px 16px;
      cursor: pointer;
      transition: background-color 0.3s, color 0.3s;
    }

    .bookmark-item:hover {
      background-color: #f0f0f0;
      margin: 4px 8px;
      color: #4285f4;
    }

    .bookmark-item:hover .bookmark-title {
      color: #4285f4 !important;
    }

    .bookmark-icon {
      width: 16px;
      height: 16px;
      margin: 0 8px 0 0 !important;
    }

    .bookmark-link {
      display: flex;
      align-items: center;
      width: 100%;
      text-decoration: none;
      color: inherit;
    }

    .bookmark-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none !important;
      font-size: 14px;
      font-weight: 600;
      color: #1a202c !important;
      line-height: 20px;
    }

    .bookmark-link:hover {
      text-decoration: none !important;
    }

    #bookmark-list {
      padding: 16px 0 60px 0 !important;
    }

    a.bookmark-link {
      text-decoration: none;
    }

    .hidden {
      display: none !important;
    }

    .floating-tooltip {
      position: absolute;
      right: 50px;
      top: 50%;
      transform: translateY(-50%);
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      width: 280px;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.2s, visibility 0.2s;
      z-index: 2147483647;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;
    }

    #floating-button:hover .floating-tooltip {
      opacity: 1;
      visibility: visible;
    }

    .tooltip-content {
      font-size: 13px;
      color: #333;
      font-family: inherit;
      padding-right: 24px;
    }

    .tooltip-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 24px;
      align-items: center;
      margin: 8px 0px;
      font-family: inherit;
    }

    .tooltip-action {
      font-weight: 600;
      color: #666;
      font-family: inherit;
      white-space: nowrap;
    }

    .tooltip-desc {
      color: #666;
      font-family: inherit;
      line-height: 1.4;
    }

    /* Arrow style optimization */
    .floating-tooltip:after {
      content: '';
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%) rotate(45deg);
      width: 12px;
      height: 12px;
      background: white;
      box-shadow: 3px -3px 3px rgba(0, 0, 0, 0.05);
    }

    /* Dark mode adaptation */
    [data-theme="dark"] .floating-tooltip {
      background: #1f2937;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    [data-theme="dark"] .tooltip-action {
      color: #e5e7eb;
    }

    [data-theme="dark"] .tooltip-desc {
      color: #9ca3af;
    }

    [data-theme="dark"] .floating-tooltip:after {
      background: #1f2937;
    }

    .tooltip-close {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: none;
      background: transparent;
      border-radius: 4px;
      color: #888;
      transition: all 0.2s;
    }

    .tooltip-close:hover {
      background: rgba(0, 0, 0, 0.05);
      color: #666;
    }

    .tooltip-close svg {
      width: 16px;
      height: 16px;
    }

    .tooltip-close:hover::after {
      content: "${chrome.i18n.getMessage('doNotShowAgain')}";
      position: absolute;
      top: -30px;
      right: 0;
      background: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
    }
  `;
  shadow.appendChild(styleSheet);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'loadDefaultBookmark') {
      displayBookmarks();
    }
    if (request.action === 'updateBookmarkDisplay') {
      const { folderId } = request;
      if (folderId) {
        displayBookmarks();
      }
    }
  });

  displayBookmarks();

  class AutoInputManager {
    constructor(siteConfigs) {
      this.siteConfigs = siteConfigs;
      this.currentConfig = null;
    }

    async sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForElement(selector) {
      return new Promise((resolve) => {
        if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver((mutations) => {
          if (document.querySelector(selector)) {
            observer.disconnect();
            resolve(document.querySelector(selector));
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      });
    }

    async simulateUserInput(inputField, text, isHTML = false) {
      inputField.innerHTML = '';
      inputField.focus();

      let commandSucceeded = false;
      if (!isHTML) {
        try {
          commandSucceeded = document.execCommand('insertText', false, text);
        } catch (e) { }
      }

      if (!commandSucceeded || isHTML) {
        if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
          if (typeof inputField.setSelectionRange === 'function') {
            inputField.setSelectionRange(inputField.value.length, inputField.value.length);
          }
          if (typeof inputField.insertText === 'function' && !isHTML) {
            inputField.insertText(text);
          } else {
            inputField.value = text;
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          if (isHTML) {
            inputField.innerHTML = text;
          } else {
            inputField.textContent = text;
          }

          const eventType = isHTML ? 'innerHTML' : 'insertText';
          inputField.dispatchEvent(new InputEvent('input', {
            inputType: eventType,
            data: text,
            bubbles: true,
            cancelable: true,
          }));
        }
      }

      await this.sleep(this.currentConfig.retryDelay);
      await this.checkAndClick(inputField, text, 0);
    }

    async checkAndClick(inputField, expectedText, retryCount) {
      let inputContent;
      if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
        inputContent = inputField.value.trim();
      } else {
        inputContent = inputField.textContent.trim();
      }

      if (inputContent === expectedText) {
        await this.simulateButtonClick();
      } else if (retryCount < this.currentConfig.maxRetries) {
        await this.sleep(this.currentConfig.retryDelay);
        await this.simulateUserInput(inputField, expectedText);
      } else {
        if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
          inputField.value = expectedText;
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          inputField.textContent = expectedText;
          inputField.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
          }));
        }
        await this.sleep(this.currentConfig.retryDelay);
        await this.simulateButtonClick();
      }
    }

    async simulateButtonClick() {
      const sendButton = await this.waitForElement(this.currentConfig.sendButtonSelector);
      if (sendButton) {
        sendButton.click();
      }
    }

    getUrlParameter(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    }

    async start() {
      const currentUrl = new URL(window.location.href);

      this.currentConfig = this.siteConfigs.find(config => {
        const patternUrl = new URL(config.urlPattern);
        return this.compareUrls(currentUrl, patternUrl);
      });
      if (!this.currentConfig) {
        return;
      }

      const inputField = await this.waitForElement(this.currentConfig.inputFieldSelector);

      const searchTerm = this.getUrlParameter(this.currentConfig.urlParamName);
      if (searchTerm) {
        await this.sleep(this.currentConfig.retryDelay);
        await this.simulateUserInput(inputField, searchTerm);
      }
    }

    compareUrls(currentUrl, patternUrl) {
      if (currentUrl.protocol !== patternUrl.protocol) return false;
      if (currentUrl.hostname !== patternUrl.hostname) return false;

      const currentPath = currentUrl.pathname.replace(/\/$/, '');
      const patternPath = patternUrl.pathname.replace(/\/$/, '');

      return currentPath === patternPath || currentPath.startsWith(patternPath + '/');
    }
  }

  const siteConfigs = [
    {
      urlPattern: 'https://kimi.moonshot.cn/',
      inputFieldSelector: '[role="textbox"]',
      sendButtonSelector: 'div[class="send-button"]',
      urlParamName: 'q',
      maxRetries: 3,
      retryDelay: 1000
    },
    {
      urlPattern: 'https://chatgpt.com/',
      inputFieldSelector: 'textarea[data-id="root"]',
      sendButtonSelector: 'button[data-testid="send_button"]',
      urlParamName: 'q',
      maxRetries: 5,
      retryDelay: 1500
    },
    {
      urlPattern: 'https://www.doubao.com/chat/',
      inputFieldSelector: 'textarea[data-testid="chat_input_input"]',
      sendButtonSelector: 'button#flow-end-msg-send[data-testid="chat_input_send_button"]',
      urlParamName: 'q',
      maxRetries: 2,
      retryDelay: 1500
    },
    {
      urlPattern: 'https://chat.deepseek.com/',
      inputFieldSelector: 'textarea#chat-input',
      sendButtonSelector: 'div.f6d670[role="button"]',
      urlParamName: 'q',
      maxRetries: 2,
      retryDelay: 1500
    },
    {
      urlPattern: 'https://grok.com/',
      inputFieldSelector: 'textarea.grok-chat-input',
      sendButtonSelector: 'button.grok-send-button',
      urlParamName: 'q',
      maxRetries: 3,
      retryDelay: 1000
    }
  ];

  const autoInput = new AutoInputManager(siteConfigs);
  autoInput.start();

  function log(message) {
    console.log(`[Content Script] ${message}`);
  }

  log('Content script initialized');

  // Declare variables at the top of the file
  let isFloatingBallEnabled = true;

  // Function to update floating ball visibility
  function updateFloatingBallVisibility(enabled) {
    isFloatingBallEnabled = enabled;
    if (floatingButton) {
      floatingButton.style.display = enabled ? 'flex' : 'none';
    }
    if (sidebarContainer) {
      if (!enabled) {
        sidebarContainer.classList.add('collapsed');
      }
    }
  }

  // Get settings during initialization
  chrome.storage.sync.get(['enableFloatingBall'], (result) => {
    updateFloatingBallVisibility(result.enableFloatingBall !== false);
  });

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateFloatingBall') {
      updateFloatingBallVisibility(request.enabled);
      sendResponse({ success: true });
    }
    return true;
  });

  // Ensure current settings are applied when creating floating ball
  floatingButton.style.display = isFloatingBallEnabled ? 'flex' : 'none';

  const style = document.createElement('style');
  style.textContent = `
    #sidebar-container, #floating-button {
      user-select: none;
      -webkit-user-select: none;
    }
    
    #bookmark-list {
      user-select: none;
      -webkit-user-select: none;
    }
    
    .bookmark-link, .bookmark-title {
      user-select: none;
      -webkit-user-select: none;
    }
    
    #search-switcher {
      user-select: none;
      -webkit-user-select: none;
    }
  `;

  shadow.appendChild(style);

  function openSidePanel() {
    chrome.runtime.sendMessage({
      action: 'openSidePanel'
    }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        console.error('Failed to open side panel:',
          chrome.runtime.lastError?.message || response?.error || 'Unknown error');

        // If failed, try retrying once with delay
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'openSidePanel',
            retry: true
          });
        }, 500);
      }
    });
  }

})();
