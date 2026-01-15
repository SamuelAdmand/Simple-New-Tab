// 导入所需的依赖
import { ICONS } from './icons.js';

// 设置管理器类
class SettingsManager {
  constructor() {
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsSidebar = document.getElementById('settings-sidebar');
    this.settingsOverlay = document.getElementById('settings-overlay');
    this.settingsIcon = document.querySelector('.settings-icon a');
    this.closeButton = document.querySelector('.settings-sidebar-close');
    this.tabButtons = document.querySelectorAll('.settings-tab-button');
    this.tabContents = document.querySelectorAll('.settings-tab-content');
    this.bgOptions = document.querySelectorAll('.settings-bg-option');
    this.enableFloatingBallCheckbox = document.getElementById('enable-floating-ball');
    this.enableQuickLinksCheckbox = document.getElementById('enable-quick-links');
    this.openInNewTabCheckbox = document.getElementById('open-in-new-tab');

    // Link opening settings elements in Side Panel mode may not exist on all pages
    // Add safety check to avoid error when element does not exist
    const sidepanelOpenInNewTab = document.getElementById('sidepanel-open-in-new-tab');
    const sidepanelOpenInSidepanel = document.getElementById('sidepanel-open-in-sidepanel');

    this.sidepanelOpenInNewTabCheckbox = sidepanelOpenInNewTab;
    this.sidepanelOpenInSidepanelCheckbox = sidepanelOpenInSidepanel;

    this.widthSettings = document.getElementById('floating-width-settings');
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    this.settingsModalContent = document.querySelector('.settings-modal-content');
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.enableWheelSwitchingCheckbox = document.getElementById('enable-wheel-switching');
    this.openSearchInNewTabCheckbox = document.getElementById('open-search-in-new-tab');
    this.init();
  }

  init() {
    this.loadSavedSettings();
    this.initEventListeners();
    this.initTheme();

    // Only call initialization methods when relevant elements exist
    if (this.enableQuickLinksCheckbox) {
      this.initQuickLinksSettings();
    }

    if (this.enableFloatingBallCheckbox) {
      this.initFloatingBallSettings();
    }

    if (this.openInNewTabCheckbox || this.sidepanelOpenInNewTabCheckbox || this.sidepanelOpenInSidepanelCheckbox) {
      this.initLinkOpeningSettings();
    }

    // Check bookmark management related elements
    const bookmarkCleanupButton = document.getElementById('open-bookmark-cleanup');
    if (bookmarkCleanupButton) {
      this.initBookmarkManagementTab();
    }

    // Check width settings related elements
    if (this.widthSlider && this.widthValue) {
      this.initBookmarkWidthSettings();
    }

    // Check height settings related elements
    const heightSlider = document.getElementById('height-slider');
    const heightValue = document.getElementById('height-value');
    if (heightSlider && heightValue) {
      this.initCardHeightSettings();
    }

    // Check container width settings related elements
    const containerWidthSlider = document.getElementById('container-width-slider');
    if (containerWidthSlider) {
      this.initContainerWidthSettings();
    }

    // Check layout settings related elements
    const showSearchBoxCheckbox = document.getElementById('show-search-box');
    const showWelcomeMessageCheckbox = document.getElementById('show-welcome-message');
    const showFooterCheckbox = document.getElementById('show-footer');
    if (showSearchBoxCheckbox || showWelcomeMessageCheckbox || showFooterCheckbox) {
      this.initLayoutSettings();
    }

    // Check search suggestion settings related elements
    if (this.showHistorySuggestionsCheckbox || this.showBookmarkSuggestionsCheckbox) {
      this.initSearchSuggestionsSettings();
    }

    // Check wheel switching settings related elements
    if (this.enableWheelSwitchingCheckbox) {
      this.initWheelSwitchingTab();
    }

    // Check shortcut settings related elements
    const configureShortcuts = document.getElementById('configure-shortcuts');
    if (configureShortcuts) {
      this.initShortcutsSettings();
    }
  }

  initEventListeners() {
    // Open settings sidebar
    this.settingsIcon.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSettingsSidebar();
    });

    // Close settings sidebar
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.closeSettingsSidebar();

        // Update welcome message when closing sidebar
        if (window.WelcomeManager) {
          window.WelcomeManager.updateWelcomeMessage();
        }
      });
    }

    // Tab switching
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // Background color selection
    this.bgOptions.forEach(option => {
      option.addEventListener('click', () => this.handleBackgroundChange(option));
    });

    // Floating ball settings
    if (this.enableFloatingBallCheckbox) {
      this.enableFloatingBallCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({
          enableFloatingBall: this.enableFloatingBallCheckbox.checked
        });
      });
    }

    // Add keyboard event listener, press ESC to close sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsSidebar && this.settingsSidebar.classList.contains('open')) {
        this.closeSettingsSidebar();
      }
    });

    // Add function to close when clicking outside sidebar
    document.addEventListener('click', (e) => {
      // If sidebar is open and click is not inside sidebar
      if (this.settingsSidebar &&
        this.settingsSidebar.classList.contains('open') &&
        !this.settingsSidebar.contains(e.target) &&
        !this.settingsIcon.contains(e.target)) {
        this.closeSettingsSidebar();

        // Update welcome message when closing sidebar
        if (window.WelcomeManager) {
          window.WelcomeManager.updateWelcomeMessage();
        }
      }
    });

    // Prevent click event bubbling from inside sidebar to document
    this.settingsSidebar.addEventListener('click', (e) => {
      // If clicked element is link, do not prevent bubbling
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        return; // Allow link click event to propagate normally
      }
      e.stopPropagation();
    });

    // Prevent settings icon click event bubbling to document
    this.settingsIcon.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Open settings sidebar
  openSettingsSidebar() {
    if (this.settingsSidebar) {
      this.settingsSidebar.classList.add('open');
    }
  }

  // Close settings sidebar
  closeSettingsSidebar() {
    if (this.settingsSidebar) {
      this.settingsSidebar.classList.remove('open');
    }
  }

  switchTab(tabName) {
    // Remove active class from all tabs
    this.tabButtons.forEach(button => {
      button.classList.remove('active');
    });

    // Remove active class from all contents
    this.tabContents.forEach(content => {
      content.classList.remove('active');
    });

    // Add active class to current tab
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-settings`);

    if (selectedButton && selectedContent) {
      selectedButton.classList.add('active');
      selectedContent.classList.add('active');
      // Update UI language
      window.updateUILanguage();

      // Ensure welcome message is also updated
      if (window.WelcomeManager) {
        window.WelcomeManager.updateWelcomeMessage();
      }
    }
  }

  handleBackgroundChange(option) {
    const bgClass = option.getAttribute('data-bg');

    // Remove active state from all background options
    this.bgOptions.forEach(opt => opt.classList.remove('active'));

    // Add active state to current option
    option.classList.add('active');

    document.documentElement.className = bgClass;
    localStorage.setItem('selectedBackground', bgClass);
    localStorage.setItem('useDefaultBackground', 'true');

    // Clear wallpaper related state
    this.clearWallpaper();

    // Update welcome message
    if (window.WelcomeManager) {
      window.WelcomeManager.updateWelcomeMessage();
    }
  }

  clearWallpaper() {
    document.querySelectorAll('.wallpaper-option').forEach(opt => {
      opt.classList.remove('active');
    });

    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.style.backgroundImage = 'none';
      document.body.style.backgroundImage = 'none';
    }
    localStorage.removeItem('originalWallpaper');

    // Update welcome message color
    const welcomeElement = document.getElementById('welcome-message');
    if (welcomeElement && window.WelcomeManager) {
      window.WelcomeManager.adjustTextColor(welcomeElement);
    }
  }

  loadSavedSettings() {
    // Load floating ball settings
    chrome.storage.sync.get(['enableFloatingBall'], (result) => {
      this.enableFloatingBallCheckbox.checked = result.enableFloatingBall !== false;
    });

    // Load background settings
    const savedBg = localStorage.getItem('selectedBackground');
    if (savedBg) {
      document.documentElement.className = savedBg;
      this.bgOptions.forEach(option => {
        if (option.getAttribute('data-bg') === savedBg) {
          option.classList.add('active');
        }
      });
    }
  }

  initTheme() {
    const themeSelect = document.getElementById('theme-select');
    const savedTheme = localStorage.getItem('theme') || 'auto';

    // Set initial value of dropdown menu
    themeSelect.value = savedTheme;

    // If auto mode, set initial theme based on system
    if (savedTheme === 'auto') {
      this.setThemeBasedOnSystem();
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeIcon(savedTheme === 'dark');
    }

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
      if (localStorage.getItem('theme') === 'auto') {
        const isDark = e.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark);
      }
    });

    // Listen for theme selection changes
    themeSelect.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      localStorage.setItem('theme', selectedTheme);

      if (selectedTheme === 'auto') {
        this.setThemeBasedOnSystem();
      } else {
        document.documentElement.setAttribute('data-theme', selectedTheme);
        this.updateThemeIcon(selectedTheme === 'dark');
      }
    });

    // Keep original theme toggle button function
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeSelect.value = newTheme;

        this.updateThemeIcon(newTheme === 'dark');
      });
    }
  }

  setThemeBasedOnSystem() {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcon(isDarkMode);
  }

  updateThemeIcon(isDark) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;

    themeToggleBtn.innerHTML = isDark ? ICONS.dark_mode : ICONS.light_mode;
  }

  initQuickLinksSettings() {
    // Load quick links settings
    chrome.storage.sync.get(['enableQuickLinks'], (result) => {
      this.enableQuickLinksCheckbox.checked = result.enableQuickLinks !== false;
      this.toggleQuickLinksVisibility(this.enableQuickLinksCheckbox.checked);
    });

    // Listen for quick links settings changes
    this.enableQuickLinksCheckbox.addEventListener('change', () => {
      const isEnabled = this.enableQuickLinksCheckbox.checked;
      chrome.storage.sync.set({ enableQuickLinks: isEnabled }, () => {
        this.toggleQuickLinksVisibility(isEnabled);
      });
    });
  }

  toggleQuickLinksVisibility(show) {
    const quickLinksWrapper = document.querySelector('.quick-links-wrapper');
    if (quickLinksWrapper) {
      quickLinksWrapper.style.display = show ? 'flex' : 'none';
    }
  }

  initFloatingBallSettings() {
    // Load floating ball settings
    chrome.storage.sync.get(['enableFloatingBall'], (result) => {
      this.enableFloatingBallCheckbox.checked = result.enableFloatingBall !== false;
    });

    // Listen for floating ball settings changes
    this.enableFloatingBallCheckbox.addEventListener('change', () => {
      const isEnabled = this.enableFloatingBallCheckbox.checked;
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'updateFloatingBallSetting',
        enabled: isEnabled
      }, () => {
        // Save settings to storage
        chrome.storage.sync.set({ enableFloatingBall: isEnabled });
      });
    });
  }

  initLinkOpeningSettings() {
    // Check if element exists
    if (!this.openInNewTabCheckbox) {
      console.log('openInNewTabCheckbox not found, skipping settings initialization');
      return;
    }

    // Check if side panel link opening settings elements exist
    const hasSidepanelSettings = this.sidepanelOpenInNewTabCheckbox && this.sidepanelOpenInSidepanelCheckbox;

    // Load link opening settings
    chrome.storage.sync.get(['openInNewTab'], (result) => {
      this.openInNewTabCheckbox.checked = result.openInNewTab !== false;
    });

    // Listen for settings changes
    this.openInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openInNewTabCheckbox.checked;
      chrome.storage.sync.set({ openInNewTab: isEnabled });
    });

    // If side panel link opening settings elements do not exist, skip
    if (!hasSidepanelSettings) {
      console.log('Sidepanel checkboxes not found, skipping sidepanel settings initialization');
      return;
    }

    // Load side panel link opening settings
    chrome.storage.sync.get(['sidepanelOpenInNewTab', 'sidepanelOpenInSidepanel'], (result) => {
      // Open in new tab by default
      this.sidepanelOpenInNewTabCheckbox.checked = result.sidepanelOpenInNewTab !== false;
      this.sidepanelOpenInSidepanelCheckbox.checked = result.sidepanelOpenInSidepanel === true;

      // Ensure two options are mutually exclusive
      if (this.sidepanelOpenInNewTabCheckbox.checked && this.sidepanelOpenInSidepanelCheckbox.checked) {
        // If both selected, prioritize open in new tab
        this.sidepanelOpenInSidepanelCheckbox.checked = false;
        chrome.storage.sync.set({ sidepanelOpenInSidepanel: false });
      }
    });

    // Listen for side panel link opening settings changes
    this.sidepanelOpenInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.sidepanelOpenInNewTabCheckbox.checked;
      chrome.storage.sync.set({ sidepanelOpenInNewTab: isEnabled });

      // If open in new tab enabled, disable open in side panel
      if (isEnabled && this.sidepanelOpenInSidepanelCheckbox.checked) {
        this.sidepanelOpenInSidepanelCheckbox.checked = false;
        chrome.storage.sync.set({ sidepanelOpenInSidepanel: false });
      }
    });

    this.sidepanelOpenInSidepanelCheckbox.addEventListener('change', () => {
      const isEnabled = this.sidepanelOpenInSidepanelCheckbox.checked;
      chrome.storage.sync.set({ sidepanelOpenInSidepanel: isEnabled });

      // If open in side panel enabled, disable open in new tab
      if (isEnabled && this.sidepanelOpenInNewTabCheckbox.checked) {
        this.sidepanelOpenInNewTabCheckbox.checked = false;
        chrome.storage.sync.set({ sidepanelOpenInNewTab: false });
      }
    });
  }

  initBookmarkManagementTab() {
    const tabButton = document.querySelector('[data-tab="bookmark-management"]');
    if (tabButton) {
      tabButton.addEventListener('click', () => {
        this.switchTab('bookmark-management');
      });
    }
  }

  initWheelSwitchingTab() {
    const tabButton = document.querySelector('[data-tab="wheel-switching"]');
    if (tabButton) {
      tabButton.addEventListener('click', () => {
        this.switchTab('wheel-switching');
      });
    }

    // Load saved settings
    chrome.storage.sync.get({ enableWheelSwitching: false }, (result) => {
      if (this.enableWheelSwitchingCheckbox) {
        this.enableWheelSwitchingCheckbox.checked = result.enableWheelSwitching;

        // Add event listener
        this.enableWheelSwitchingCheckbox.addEventListener('change', () => {
          const isEnabled = this.enableWheelSwitchingCheckbox.checked;
          chrome.storage.sync.set({ enableWheelSwitching: isEnabled });

          // Trigger custom event, notify wheel switching state change
          document.dispatchEvent(new CustomEvent('wheelSwitchingChanged', {
            detail: { enabled: isEnabled }
          }));
        });
      }
    });
  }

  // Add debounce method to optimize performance
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  initBookmarkWidthSettings() {
    // Get element reference
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');

    if (!this.widthSlider || !this.widthValue) {
      console.log('Width slider elements not found, skipping bookmark width settings initialization');
      return;
    }

    // Get saved width from storage
    chrome.storage.sync.get(['bookmarkWidth'], (result) => {
      const savedWidth = result.bookmarkWidth || 190; // Default 190px
      this.widthSlider.value = savedWidth;
      this.widthValue.textContent = savedWidth;
      this.updatePreviewCount(savedWidth);
      this.updateBookmarkWidth(savedWidth);
    });

    // Listen for slider changes
    this.widthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.widthValue.textContent = width;
      this.updatePreviewCount(width);
      this.updateBookmarkWidth(width);
    });

    // Listen for slider mouseup event, save settings
    this.widthSlider.addEventListener('mouseup', () => {
      // Save settings
      chrome.storage.sync.set({ bookmarkWidth: this.widthSlider.value });
    });

    // Add window resize listener
    const debouncedUpdate = this.debounce(() => {
      this.updatePreviewCount(this.widthSlider.value);
    }, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  // New bookmark card height setting function
  initCardHeightSettings() {
    // Get slider and display elements
    this.heightSlider = document.getElementById('height-slider');
    this.heightValue = document.getElementById('height-value');

    if (!this.heightSlider || !this.heightValue) {
      console.log('Height slider elements not found, skipping card height settings initialization');
      return;
    }

    // Get saved height from storage
    chrome.storage.sync.get('bookmarkCardHeight', (result) => {
      const savedHeight = result.bookmarkCardHeight || 48; // Default 48px

      // Set slider and display value
      this.heightSlider.value = savedHeight;
      this.heightValue.textContent = savedHeight;

      // Apply height settings
      this.updateCardHeight(savedHeight);
    });

    // Listen for slider changes
    this.heightSlider.addEventListener('input', (e) => {
      const height = e.target.value;
      this.heightValue.textContent = height;
      this.updateCardHeight(height);
    });

    // Listen for slider mouseup event
    this.heightSlider.addEventListener('mouseup', () => {
      // Save settings
      chrome.storage.sync.set({ bookmarkCardHeight: this.heightSlider.value });
    });
  }

  // Update bookmark card height
  updateCardHeight(height) {
    // Create or update custom style
    let styleElement = document.getElementById('custom-card-height');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-card-height';
      document.head.appendChild(styleElement);
    }

    // Set card height
    styleElement.textContent = `
      .card {
        height: ${height}px !important;
      }
    `;
  }

  updatePreviewCount(width) {
    // Get bookmark list container
    const bookmarksList = document.getElementById('bookmarks-list');
    if (!bookmarksList) return;

    // Ensure container is visible
    const originalDisplay = bookmarksList.style.display;
    if (getComputedStyle(bookmarksList).display === 'none') {
      bookmarksList.style.display = 'grid';
    }

    // Get actual available width of container
    const containerStyle = getComputedStyle(bookmarksList);
    const containerWidth = bookmarksList.offsetWidth
      - parseFloat(containerStyle.paddingLeft)
      - parseFloat(containerStyle.paddingRight);

    // Restore container display state
    bookmarksList.style.display = originalDisplay;

    // Use same calculation logic as CSS Grid
    const gap = 16; // gap: 1rem
    const minWidth = parseInt(width);

    // Calculate max items per row
    // Use Math.floor to ensure not exceeding container width
    const count = Math.floor((containerWidth + gap) / (minWidth + gap));

    // Update display - use localized text
    const previewText = chrome.i18n.getMessage("bookmarksPerRow", [count]) || `${count} items/row`;
    this.widthPreviewCount.textContent = previewText;
  }

  updateBookmarkWidth(width) {
    // Update CSS variable
    document.documentElement.style.setProperty('--bookmark-width', width + 'px');

    // Update Grid layout
    const bookmarksList = document.getElementById('bookmarks-list');
    if (bookmarksList) {
      // Use minmax to ensure min width but allow expansion if space permits
      bookmarksList.style.gridTemplateColumns = `repeat(auto-fit, minmax(${width}px, 1fr))`;
      // Set gap
      bookmarksList.style.gap = '1rem';
    }
  }

  initContainerWidthSettings() {
    // 获取元素引用
    this.containerWidthSlider = document.getElementById('container-width-slider');
    this.containerWidthValue = document.getElementById('container-width-value');

    if (!this.containerWidthSlider || !this.containerWidthValue) {
      console.log('Container width slider elements not found, skipping container width settings initialization');
      return;
    }

    // Get saved width from storage
    chrome.storage.sync.get(['bookmarkContainerWidth'], (result) => {
      const savedWidth = result.bookmarkContainerWidth || 85; // Default 85%
      this.containerWidthSlider.value = savedWidth;
      this.containerWidthValue.textContent = savedWidth;
      this.updateContainerWidth(savedWidth);
    });

    // Listen for slider changes
    this.containerWidthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.containerWidthValue.textContent = width;
      this.updateContainerWidth(width);
    });

    // Listen for slider mouseup event, save settings
    this.containerWidthSlider.addEventListener('mouseup', () => {
      // Save settings
      chrome.storage.sync.set({ bookmarkContainerWidth: this.containerWidthSlider.value });
    });
  }

  // Method to update bookmark container width
  updateContainerWidth(widthPercent) {
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    if (bookmarksContainer) {
      bookmarksContainer.style.width = `${widthPercent}%`;
    }
  }

  initLayoutSettings() {
    // Get element reference
    this.showSearchBoxCheckbox = document.getElementById('show-search-box');
    this.showWelcomeMessageCheckbox = document.getElementById('show-welcome-message');
    this.showFooterCheckbox = document.getElementById('show-footer');

    // Add quick link icon settings
    this.showHistoryLinkCheckbox = document.getElementById('show-history-link');
    this.showDownloadsLinkCheckbox = document.getElementById('show-downloads-link');
    this.showPasswordsLinkCheckbox = document.getElementById('show-passwords-link');
    this.showExtensionsLinkCheckbox = document.getElementById('show-extensions-link');

    // Load saved settings
    chrome.storage.sync.get(
      [
        'showSearchBox',
        'showWelcomeMessage',
        'showFooter',
        'showHistoryLink',
        'showDownloadsLink',
        'showPasswordsLink',
        'showExtensionsLink'
      ],
      (result) => {
        // Set checkbox state - search box defaults to false
        this.showSearchBoxCheckbox.checked = result.showSearchBox === true; // Defaults to false
        this.showWelcomeMessageCheckbox.checked = result.showWelcomeMessage !== false;
        this.showFooterCheckbox.checked = result.showFooter !== false;

        // Set quick link icon state
        this.showHistoryLinkCheckbox.checked = result.showHistoryLink !== false;
        this.showDownloadsLinkCheckbox.checked = result.showDownloadsLink !== false;
        this.showPasswordsLinkCheckbox.checked = result.showPasswordsLink !== false;
        this.showExtensionsLinkCheckbox.checked = result.showExtensionsLink !== false;

        // Apply settings to interface
        this.toggleElementVisibility('#history-link', result.showHistoryLink !== false);
        this.toggleElementVisibility('#downloads-link', result.showDownloadsLink !== false);
        this.toggleElementVisibility('#passwords-link', result.showPasswordsLink !== false);
        this.toggleElementVisibility('#extensions-link', result.showExtensionsLink !== false);

        // Check if all links are hidden
        const linksContainer = document.querySelector('.links-icons');
        if (linksContainer) {
          const allLinksHidden =
            result.showHistoryLink === false &&
            result.showDownloadsLink === false &&
            result.showPasswordsLink === false &&
            result.showExtensionsLink === false;

          linksContainer.style.display = allLinksHidden ? 'none' : '';
        }
      }
    );

    // Listen for settings changes
    this.showSearchBoxCheckbox.addEventListener('change', () => {
      const isVisible = this.showSearchBoxCheckbox.checked;
      chrome.storage.sync.set({ showSearchBox: isVisible });

      // Apply settings immediately
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        searchContainer.style.display = isVisible ? '' : 'none';
      }

      // Immediately update welcome message display
      if (window.WelcomeManager) {
        window.WelcomeManager.updateWelcomeMessage();
      }
    });

    this.showWelcomeMessageCheckbox.addEventListener('change', () => {
      const isVisible = this.showWelcomeMessageCheckbox.checked;
      chrome.storage.sync.set({ showWelcomeMessage: isVisible });

      // Apply settings immediately
      const welcomeMessage = document.getElementById('welcome-message');
      if (welcomeMessage) {
        welcomeMessage.style.display = isVisible ? '' : 'none';
      }
    });

    this.showFooterCheckbox.addEventListener('change', () => {
      const isVisible = this.showFooterCheckbox.checked;
      chrome.storage.sync.set({ showFooter: isVisible });

      // Apply settings immediately
      const footer = document.querySelector('footer');
      if (footer) {
        footer.style.display = isVisible ? '' : 'none';
      }
    });

    // Add event listener
    this.showHistoryLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showHistoryLinkCheckbox.checked;
      chrome.storage.sync.set({ showHistoryLink: isVisible });
      this.toggleElementVisibility('#history-link', isVisible);
    });

    this.showDownloadsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showDownloadsLinkCheckbox.checked;
      chrome.storage.sync.set({ showDownloadsLink: isVisible });
      this.toggleElementVisibility('#downloads-link', isVisible);
    });

    this.showPasswordsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showPasswordsLinkCheckbox.checked;
      chrome.storage.sync.set({ showPasswordsLink: isVisible });
      this.toggleElementVisibility('#passwords-link', isVisible);
    });

    this.showExtensionsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showExtensionsLinkCheckbox.checked;
      chrome.storage.sync.set({ showExtensionsLink: isVisible });
      this.toggleElementVisibility('#extensions-link', isVisible);
    });
  }

  // Helper method: Toggle element visibility
  toggleElementVisibility(selector, isVisible) {
    const element = document.querySelector(selector);
    if (element) {
      element.style.display = isVisible ? '' : 'none';

      // Special handling for links-icons container
      if (selector.includes('link')) {
        const linksContainer = document.querySelector('.links-icons');
        if (linksContainer) {
          // Check if all links are hidden
          const visibleLinks = Array.from(linksContainer.querySelectorAll('a')).filter(
            link => link.style.display !== 'none'
          ).length;

          linksContainer.style.display = visibleLinks === 0 ? 'none' : '';
        }
      }
    }
  }

  initSearchSuggestionsSettings() {
    // 获取元素引用
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.openSearchInNewTabCheckbox = document.getElementById('open-search-in-new-tab');

    // Load search suggestion settings
    chrome.storage.sync.get(
      ['showHistorySuggestions', 'showBookmarkSuggestions', 'showSearchBox', 'openSearchInNewTab'],
      (result) => {
        // If setting does not exist (undefined) or not explicitly set to false, default to true
        this.showHistorySuggestionsCheckbox.checked = result.showHistorySuggestions !== false;
        this.showBookmarkSuggestionsCheckbox.checked = result.showBookmarkSuggestions !== false;
        this.openSearchInNewTabCheckbox.checked = result.openSearchInNewTab !== false;

        // If new user (setting does not exist) at initialization, save default value
        if (!('showHistorySuggestions' in result)) {
          chrome.storage.sync.set({ showHistorySuggestions: true });
        }
        if (!('showBookmarkSuggestions' in result)) {
          chrome.storage.sync.set({ showBookmarkSuggestions: true });
        }
        if (!('showSearchBox' in result)) {
          chrome.storage.sync.set({ showSearchBox: false });
        }
        if (!('openSearchInNewTab' in result)) {
          chrome.storage.sync.set({ openSearchInNewTab: true });
        }
      }
    );

    // Listen for settings changes
    this.showHistorySuggestionsCheckbox.addEventListener('change', () => {
      const isEnabled = this.showHistorySuggestionsCheckbox.checked;
      chrome.storage.sync.set({ showHistorySuggestions: isEnabled });
    });

    this.showBookmarkSuggestionsCheckbox.addEventListener('change', () => {
      const isEnabled = this.showBookmarkSuggestionsCheckbox.checked;
      chrome.storage.sync.set({ showBookmarkSuggestions: isEnabled });
    });

    this.openSearchInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openSearchInNewTabCheckbox.checked;
      chrome.storage.sync.set({ openSearchInNewTab: isEnabled });
    });
  }

  initShortcutsSettings() {
    const shortcutItem = document.getElementById('configure-shortcuts');
    if (shortcutItem) {
      shortcutItem.addEventListener('click', () => {
        chrome.tabs.create({
          url: 'chrome://extensions/shortcuts'
        });
      });
    }
  }
}

// Export settings manager instance
export const settingsManager = new SettingsManager();