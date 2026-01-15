// Import required dependencies
import { ICONS, getIconHtml } from './icons.js';

// Predefined list of all available search engines
const ALL_ENGINES = [
  { name: 'google', icon: '../images/google-logo.svg', label: 'googleLabel', url: 'https://www.google.com/search?q=', aliases: ['Google'] },
  { name: 'bing', icon: '../images/bing-logo.png', label: 'bingLabel', url: 'https://www.bing.com/search?q=' },
  { name: 'baidu', icon: '../images/baidu-logo.svg', label: 'baiduLabel', url: 'https://www.baidu.com/s?wd=', aliases: ['Baidu'] },
  { name: 'kimi', icon: '../images/kimi-logo.svg', label: 'kimiLabel', url: 'https://kimi.moonshot.cn/?q=', aliases: ['Kimi'] },
  { name: 'doubao', icon: '../images/doubao-logo.png', label: 'doubaoLabel', url: 'https://www.doubao.com/?q=', aliases: ['Doubao'] },
  { name: 'chatgpt', icon: '../images/chatgpt-logo.svg', label: 'chatgptLabel', url: 'https://chat.openai.com/?q=', aliases: ['ChatGPT'] },
  { name: 'felo', icon: '../images/felo-logo.svg', label: 'feloLabel', url: 'https://felo.ai/search?q=', aliases: ['Felo'] },
  { name: 'metaso', icon: '../images/metaso-logo.png', label: 'metasoLabel', url: 'https://metaso.cn/?q=', aliases: ['Metaso'] },
  { name: 'perplexity', icon: '../images/perplexity-logo.svg', label: 'perplexityLabel', url: 'https://www.perplexity.ai/?q=', aliases: ['Perplexity'] },
  { name: 'semanticscholar', icon: '../images/semanticscholar-logo.png', label: 'semanticscholarLabel', url: 'https://www.semanticscholar.org/search?q=', aliases: ['Semantic Scholar'] },
  { name: 'deepseek', icon: '../images/deepseek-logo.svg', label: 'deepseekLabel', url: 'https://chat.deepseek.com/?q=', aliases: ['DeepSeek'] },  
  { name: 'grok', icon: '../images/grok-logo.svg', label: 'grokLabel', url: 'https://grok.com/?q=', aliases: ['Grok'] },
  { name: 'yahoo', icon: '../images/yahoo-logo.svg', label: 'yahooLabel', url: 'https://search.yahoo.com/search?p=', aliases: ['Yahoo'] },
  { name: 'duckduckgo', icon: '../images/duckduckgo-logo.svg', label: 'duckduckgoLabel', url: 'https://duckduckgo.com/?q=', aliases: ['DuckDuckGo'] },
  { name: 'yandex', icon: '../images/yandex-logo.svg', label: 'yandexLabel', url: 'https://yandex.com/search/?text=', aliases: ['Yandex'] },
  { name: 'xiaohongshu', icon: '../images/xiaohongshu-logo.svg', label: 'xiaohongshuLabel', url: 'https://www.xiaohongshu.com/search_result?keyword=', aliases: ['Xiaohongshu'] },
  { name: 'jike', icon: '../images/jike-logo.svg', label: 'jikeLabel', url: 'https://web.okjike.com/search?keyword=', aliases: ['Jike'] },
  { name: 'zhihu', icon: '../images/zhihu-logo.svg', label: 'zhihuLabel', url: 'https://www.zhihu.com/search?q=', aliases: ['Zhihu'] },
  { name: 'douban', icon: '../images/douban-logo.svg', label: 'doubanLabel', url: 'https://www.douban.com/search?q=', aliases: ['Douban'] },
  { name: 'bilibili', icon: '../images/bilibili-logo.svg', label: 'bilibiliLabel', url: 'https://search.bilibili.com/all?keyword=', aliases: ['Bilibili'] },
  { name: 'github', icon: '../images/github-logo.svg', label: 'githubLabel', url: 'https://github.com/search?q=', aliases: ['GitHub'] }
];

// Define search engine categories
const ENGINE_CATEGORIES = {
  AI: ['kimi', 'doubao', 'chatgpt', 'perplexity', 'claude', 'felo', 'metaso', 'semanticscholar', 'deepseek', 'grok'],
  SEARCH: ['google', 'bing', 'baidu', 'duckduckgo', 'yahoo', 'yandex'],
  SOCIAL: ['xiaohongshu', 'jike', 'zhihu', 'douban', 'bilibili', 'github']
};

// Storage management related functions
const SearchEngineManager = {
  // Get list of search engines enabled by user
  getEnabledEngines() {
    const stored = localStorage.getItem('enabledSearchEngines');
    if (stored) {
      return JSON.parse(stored);
    }
    // Enable first 8 search engines by default
    const defaultEngines = ALL_ENGINES.slice(0, 8);
    this.saveEnabledEngines(defaultEngines);
    return defaultEngines;
  },

  // Save list of enabled search engines
  saveEnabledEngines(engines) {
    localStorage.setItem('enabledSearchEngines', JSON.stringify(engines));
  },

  // Get list of all available search engines
  getAllEngines() {
    // Merge predefined and custom search engines
    const customEngines = getCustomEngines();
    return [...ALL_ENGINES, ...customEngines];
  },

  // Add search engine to enabled list
  addEngine(engineName) {
    const enabled = this.getEnabledEngines();
    const engine = this.getAllEngines().find(e => e.name === engineName);
    if (engine && !enabled.find(e => e.name === engineName)) {
      enabled.push(engine);
      this.saveEnabledEngines(enabled);
      return true;
    }
    return false;
  },

  // Remove search engine from enabled list
  removeEngine(engineName) {
    const enabled = this.getEnabledEngines();
    const filtered = enabled.filter(e => e.name !== engineName);
    if (filtered.length < enabled.length) {
      this.saveEnabledEngines(filtered);
      return true;
    }
    return false;
  },

  // Get default search engine
  getDefaultEngine() {
    const defaultEngineName = localStorage.getItem('selectedSearchEngine');
    console.log('[Search] Getting default engine, stored name:', defaultEngineName);
    
    if (defaultEngineName) {
      const allEngines = this.getAllEngines();
      const engine = allEngines.find(e => e.name === defaultEngineName);
      if (engine) {
        console.log('[Search] Found engine config:', engine);
        return engine;
      }
    }
    console.log('[Search] Using fallback engine (Google)');
    return ALL_ENGINES[0]; // Return Google by default
  },

  // Set default search engine
  setDefaultEngine(engineName) {
    const allEngines = this.getAllEngines();
    const engine = allEngines.find(e => e.name === engineName);
    
    if (engine) {
      console.log('[Search] Setting default engine to:', engine);
      localStorage.setItem('selectedSearchEngine', engineName);
      return true;
    }
    console.error('[Search] Engine not found:', engineName);
    return false;
  }
};

// Create search engine options
function createSearchEngineOption(engine, isAddButton = false) {
  const option = document.createElement('div');
  option.className = 'search-engine-option';
  
  if (isAddButton) {
    option.innerHTML = `
      <div class="search-engine-option-content add-engine">
        ${getIconHtml('add_circle')}
        <span class="search-engine-option-label">${getLocalizedMessage('addSearchEngine')}</span>
      </div>
    `;
    option.addEventListener('click', () => {
      showSearchEnginesDialog(); // Use new display dialog function
    });
  } else {
    // Create regular search engine options
    option.innerHTML = `
      <div class="search-engine-option-content">
        <img src="${engine.icon}" alt="${getLocalizedMessage(engine.label)}" class="search-engine-option-icon">
        <span class="search-engine-option-label">${getLocalizedMessage(engine.label)}</span>
      </div>
    `;
    option.onclick = () => handleSearchEngineSelection(engine);
  }

  return option;
}

// Handle search engine selection
function handleSearchEngineSelection(engine) {
  console.log('[Search] Selecting engine:', engine);
  
  // Close dropdown menu
  const dropdownContainer = document.querySelector('.search-engine-dropdown');
  if (dropdownContainer) {
    dropdownContainer.style.display = 'none';
  }

  // Set default search engine using SearchEngineManager
  if (SearchEngineManager.setDefaultEngine(engine.name)) {
    console.log('[Search] Default engine set to:', engine);
    
    // Update search engine icon
    updateSearchEngineIcon(engine);

    // Update tabs state
    updateTabsState(engine.name);

    // Immediately update default search engine in search form
    const searchForm = document.querySelector('.search-form');
    if (searchForm) {
      searchForm.setAttribute('data-current-engine', engine.name);
    }

    // Trigger custom event
    const event = new CustomEvent('defaultSearchEngineChanged', {
      detail: { engine: engine }
    });
    document.dispatchEvent(event);
  } else {
    console.error('[Search] Failed to set default engine:', engine);
  }
}

// Update tabs state
function updateTabsState(engineName) {
  const defaultEngine = engineName.toLowerCase();
  const tabs = document.querySelectorAll('.tab');
  
  // First remove all active classes
  tabs.forEach(tab => tab.classList.remove('active'));
  
  // Try to find matching tab and add active class
  const matchingTab = Array.from(tabs).find(tab => {
    const tabEngine = tab.getAttribute('data-engine').toLowerCase();
    return tabEngine === defaultEngine;
  });

  if (matchingTab) {
    matchingTab.classList.add('active');
  }
  // If it's a custom engine, it might not have a matching tab, which is normal
}

// Modify initialization function
function initializeSearchEngine() {
  console.log('[Search] Initializing search engine');
  
  // Ensure DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSearchEngineUI();
    });
  } else {
    initializeSearchEngineUI();
  }
}

// New UI initialization function
function initializeSearchEngineUI() {
  const defaultEngine = SearchEngineManager.getDefaultEngine();
  console.log('[Search] Default engine:', defaultEngine);
  
  if (defaultEngine) {
    console.log('[Search] Updating UI for engine:', defaultEngine.name);
    
    // Ensure search form and icon elements exist
    const searchForm = document.querySelector('.search-form');
    const searchEngineIcon = document.getElementById('search-engine-icon');
    
    if (searchForm && searchEngineIcon) {
      // Update search engine icon
      updateSearchEngineIcon(defaultEngine);
      
      // Update tabs state
      updateTabsState(defaultEngine.name);
      
      // Update default search engine in search form
      searchForm.setAttribute('data-current-engine', defaultEngine.name);
      
      // Ensure icon loads correctly
      if (searchEngineIcon.src !== defaultEngine.icon) {
        searchEngineIcon.src = defaultEngine.icon;
        searchEngineIcon.alt = `${getLocalizedMessage(defaultEngine.label)} Search`;
      }
      
      console.log('[Search] UI successfully updated for engine:', defaultEngine.name);
    } else {
      console.error('[Search] Required DOM elements not found');
    }
  } else {
    console.warn('[Search] No default engine found, using fallback');
  }
}

// Add getSearchUrl function
function getSearchUrl(engine, query) {
  const allEngines = SearchEngineManager.getAllEngines();
  const engineConfig = allEngines.find(e => {
    // Match engine name or alias
    return e.name.toLowerCase() === engine.toLowerCase() || 
           (e.aliases && e.aliases.some(alias => alias.toLowerCase() === engine.toLowerCase()));
  });

  if (!engineConfig) {
    // If matching engine config not found, use default engine
    const defaultEngine = SearchEngineManager.getDefaultEngine();
    return defaultEngine.url + encodeURIComponent(query);
  }

  // Ensure URL contains query parameter placeholder
  const url = engineConfig.url.includes('%s') ? 
    engineConfig.url.replace('%s', encodeURIComponent(query)) :
    engineConfig.url + encodeURIComponent(query);

  return url;
}

// Modify click event handling in createTemporarySearchTabs function
function createTemporarySearchTabs() {
  const tabsContainer = document.getElementById('tabs-container');
  if (!tabsContainer) return;

  // Keep search tip text
  const searchTips = tabsContainer.querySelector('.search-tips');
  tabsContainer.innerHTML = '';
  if (searchTips) {
    tabsContainer.appendChild(searchTips);
  }

  // Get enabled search engines
  const enabledEngines = SearchEngineManager.getEnabledEngines();
  const defaultEngine = SearchEngineManager.getDefaultEngine();

  // Create tabs for each enabled search engine
  enabledEngines.forEach(engine => {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('data-engine', engine.name);
    
    if (engine.name === defaultEngine.name) {
      tab.classList.add('active');
    }

    if (engine.label) {
      const label = getLocalizedMessage(engine.label) || engine.name;
      tab.textContent = label;
    } else {
      tab.textContent = engine.name;
    }

    tab.addEventListener('click', function() {
      const searchInput = document.querySelector('.search-input');
      const searchQuery = searchInput.value.trim();
      
      if (searchQuery) {
        // Remove active state of all tabs
        tabsContainer.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        // Add active state to currently clicked tab
        this.classList.add('active');

        // Execute search
        const searchUrl = getSearchUrl(engine.name, searchQuery);
        window.open(searchUrl, '_blank');
        
        // Hide search suggestions
        const searchSuggestions = document.querySelector('.search-suggestions-wrapper');
        if (searchSuggestions) {
          searchSuggestions.style.display = 'none';
        }
        
        // Delay restoring default search engine state
        setTimeout(() => {
          const defaultEngine = SearchEngineManager.getDefaultEngine();
          tabsContainer.querySelectorAll('.tab').forEach(t => {
            if (t.getAttribute('data-engine') === defaultEngine.name) {
              t.classList.add('active');
            } else {
              t.classList.remove('active');
            }
          });
        }, 300);
      }
    });

    tabsContainer.appendChild(tab);
  });
}

// Modify createSearchEngineDropdown function, add update for temporary search tabs
function createSearchEngineDropdown() {
  console.log('[Search] Creating dropdown menu');
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeSearchEngine();
      createDropdownUI();
      createTemporarySearchTabs();
    });
  } else {
    initializeSearchEngine();
    createDropdownUI();
    createTemporarySearchTabs();
  }
}

// New dropdown menu UI creation function
function createDropdownUI() {
  // Move UI creation code from createSearchEngineDropdown to here
  const existingDropdown = document.querySelector('.search-engine-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
  }
  
  const searchForm = document.querySelector('.search-form');
  const iconContainer = document.querySelector('.search-icon-container');
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'search-engine-dropdown';
  dropdownContainer.style.display = 'none';

  // Create options container
  const optionsContainer = document.createElement('div');
  optionsContainer.className = 'search-engine-options-container';

  // Get enabled search enginesCJK Text
  const enabledEngines = SearchEngineManager.getEnabledEngines();

  // Add enabled search engine options
  enabledEngines.forEach(engine => {
    const option = createSearchEngineOption(engine);
    optionsContainer.appendChild(option);
  });

  // Add "Add Search Engine" option
  const addOption = createSearchEngineOption(null, true);
  optionsContainer.appendChild(addOption);

  // Add event listener
  iconContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdownContainer.style.display === 'block';
    dropdownContainer.style.display = isVisible ? 'none' : 'block';
  });

  // Close dropdown menu when clicking other areas
  document.addEventListener('click', () => {
    dropdownContainer.style.display = 'none';
  });

  dropdownContainer.appendChild(optionsContainer);
  searchForm.appendChild(dropdownContainer);
}

// Add function to display search engine dialog
function showSearchEnginesDialog() {
  const dialog = document.getElementById('search-engines-dialog');
  if (!dialog) return;

  // Generate search engine list
  createSearchEnginesList();

  // Display dialog
  dialog.style.display = 'block';

  // Add close button event
  const closeButton = dialog.querySelector('.close-button');
  if (closeButton) {
    closeButton.onclick = () => {
      dialog.style.display = 'none';
      // Update dropdown menu when closing dialog
      createSearchEngineDropdown();
    };
  }

  // Click outside dialog to close
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      dialog.style.display = 'none';
      // Update dropdown menu when closing dialog
      createSearchEngineDropdown();
    }
  };

  // Prevent click event bubbling in dialog content area
  const modalContent = dialog.querySelector('.modal-content');
  if (modalContent) {
    modalContent.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

// Modify search engine list creation function
function createSearchEnginesList() {
  const aiContainer = document.getElementById('ai-search-engines');
  const searchContainer = document.getElementById('search-engines');
  const socialContainer = document.getElementById('social-media-engines');
  
  if (!aiContainer || !searchContainer || !socialContainer) return;

  // Clear existing contents of all containers
  aiContainer.innerHTML = '';
  searchContainer.innerHTML = '';
  socialContainer.innerHTML = '';

  // Get enabled search engines
  const enabledEngines = SearchEngineManager.getEnabledEngines();
  const enabledEngineNames = enabledEngines.map(e => e.name);

  // Modify search engine item creation function
  const createEngineItem = (engine) => {
    const engineItem = document.createElement('div');
    engineItem.className = 'search-engine-item';

    const checkboxContainer = document.createElement('label');
    checkboxContainer.className = 'custom-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabledEngineNames.includes(engine.name);

    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkmark);

    const engineInfo = document.createElement('div');
    engineInfo.className = 'search-engine-info';

    const engineIcon = document.createElement('img');
    engineIcon.src = engine.icon;
    engineIcon.alt = getLocalizedMessage(engine.label);
    engineIcon.className = 'search-engine-icon';

    const engineName = document.createElement('span');
    engineName.className = 'search-engine-name';
    engineName.textContent = getLocalizedMessage(engine.label);

    engineInfo.appendChild(engineIcon);
    engineInfo.appendChild(engineName);

    engineItem.appendChild(checkboxContainer);
    engineItem.appendChild(engineInfo);

    // Simplify event handling logic
    const toggleEngine = (e) => {
      // Get actual checkbox element
      const checkbox = e.currentTarget.querySelector('input[type="checkbox"]');
      
      // Exclude clicks on delete button and checkbox itself
      if (e.target.closest('.delete-custom-engine') || e.target === checkbox) {
        return;
      }

      // Toggle checkbox state
      checkbox.checked = !checkbox.checked;
      
      // Trigger change event to sync state
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Update styles and state
      e.currentTarget.classList.toggle('selected', checkbox.checked);
      handleEngineToggle(engine, checkbox.checked);
    };

    // Add click event for the whole item
    engineItem.addEventListener('click', toggleEngine);
    
    // Remove checkbox click event prevention
    checkbox.addEventListener('change', (e) => {
      // Update state directly
      engineItem.classList.toggle('selected', e.target.checked);
      handleEngineToggle(engine, e.target.checked);
    });

    return engineItem;
  };

  // Populate each category
  ENGINE_CATEGORIES.AI.forEach(engineName => {
    const engine = ALL_ENGINES.find(e => e.name === engineName);
    if (engine) {
      aiContainer.appendChild(createEngineItem(engine));
    }
  });

  ENGINE_CATEGORIES.SEARCH.forEach(engineName => {
    const engine = ALL_ENGINES.find(e => e.name === engineName);
    if (engine) {
      searchContainer.appendChild(createEngineItem(engine));
    }
  });

  ENGINE_CATEGORIES.SOCIAL.forEach(engineName => {
    const engine = ALL_ENGINES.find(e => e.name === engineName);
    if (engine) {
      socialContainer.appendChild(createEngineItem(engine));
    }
  });
}

// Handle search engine enable/disable
function handleEngineToggle(engine, enabled) {
  if (enabled) {
    SearchEngineManager.addEngine(engine.name);
  } else {
    SearchEngineManager.removeEngine(engine.name);
  }
  // Update dropdown menu and temporary search tabs
  createSearchEngineDropdown();
  createTemporarySearchTabs();
}

// Modify initCustomEngineForm function
function initCustomEngineForm() {
  const addButton = document.getElementById('add-custom-engine');
  if (!addButton) return;

  addButton.addEventListener('click', async () => {
    const nameInput = document.getElementById('custom-engine-name');
    const urlInput = document.getElementById('custom-engine-url');
    const iconInput = document.getElementById('custom-engine-icon');

    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    let icon = iconInput.value.trim();

    if (!name) {
      alert(chrome.i18n.getMessage('searchEngineNameRequired'));
      return;
    }
    if (!url) {
      alert(chrome.i18n.getMessage('searchEngineUrlRequired'));
      return;
    }
    if (!url.includes('%s')) {
      alert(chrome.i18n.getMessage('searchEngineUrlInvalid'));
      return;
    }

    // Replace %s with actual query parameter placeholder
    const processedUrl = url.includes('%s') ? url : `${url}${url.includes('?') ? '&' : '?'}q=%s`;

    const customEngine = {
      name: `custom_${Date.now()}`,
      label: name,
      url: processedUrl,
      icon: icon,
      isCustom: true
    };

    // Save custom search engine
    await saveCustomEngine(customEngine);

    // Clear input boxes
    nameInput.value = '';
    urlInput.value = '';
    iconInput.value = '';

    // Refresh custom search engine list
    refreshCustomEngines();

    // Add success message
    alert(chrome.i18n.getMessage('searchEngineAddSuccess'));
  });

  // Add real-time icon preview for URL input box
  const urlInput = document.getElementById('custom-engine-url');
  const iconInput = document.getElementById('custom-engine-icon');
  
  urlInput.addEventListener('blur', async () => {
    const url = urlInput.value.trim();
    const nameInput = document.getElementById('custom-engine-name');
    const name = nameInput.value.trim();
    
    if (url && !iconInput.value.trim()) {
      // Show loading animation
      const loadingIcon = document.createElement('div');
      loadingIcon.className = 'icon-loading-spinner';
      iconInput.parentNode.insertBefore(loadingIcon, iconInput.nextSibling);
      iconInput.classList.add('loading');

      try {
        const favicon = await getFavicon(url);
        iconInput.value = favicon || generateTextIcon(name || new URL(url).hostname);
      } finally {
        // Remove loading animation
        iconInput.classList.remove('loading');
        if (loadingIcon) {
          loadingIcon.remove();
        }
      }
    }
  });
}

// Modify text icon generation function
function generateTextIcon(name) {
  // Get first valid character
  let firstChar = name.trim().charAt(0);
  
  // If CJK, use directly
  // If English, convert to uppercase
  // If has space, get first letter of first word
  if (/^[\u4e00-\u9fa5]/.test(firstChar)) {
    // Is CJK character
    firstChar = firstChar;
  } else {
    // Not CJK character, get first word and convert to uppercase
    firstChar = name.trim().split(/\s+/)[0].charAt(0).toUpperCase();
  }

  // CJK Text SVG CJK Text
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
      <rect width="40" height="40" rx="8" fill="#f0f0f0"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${/^[\u4e00-\u9fa5]/.test(firstChar) ? '18' : '20'}"
        font-weight="bold"
        fill="#666"
        text-anchor="middle"
        dominant-baseline="central"
      >
        ${firstChar}
      </text>
    </svg>
  `;

  // Convert SVG to data URL
  const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
  return URL.createObjectURL(svgBlob);
}

// Modify getFavicon function
async function getFavicon(url) {
  try {
    // Try getting icon from multiple possible sources
    const domain = new URL(url).hostname;
    const iconSources = [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      `https://icon.horse/icon/${domain}`,
      `https://${domain}/favicon.ico`
    ];

    // Test if icon is available
    for (const src of iconSources) {
      try {
        const response = await fetch(src);
        if (response.ok) {
          return src;
        }
      } catch (e) {
        continue;
      }
    }
    
    // If all icon sources fail, return text icon
    return null;
  } catch (e) {
    return null;
  }
}

// Modify saveCustomEngine function
async function saveCustomEngine(engine) {
  try {
    // If no icon provided, try to get website icon
    if (!engine.icon) {
      const favicon = await getFavicon(engine.url);
      engine.icon = favicon || generateTextIcon(engine.label);
    }

    const customEngines = getCustomEngines();
    customEngines.push(engine);
    localStorage.setItem('customSearchEngines', JSON.stringify(customEngines));
    
    // Automatically enable newly added search engine
    SearchEngineManager.addEngine(engine.name);
    // Update dropdown menu immediately
    createSearchEngineDropdown();
  } catch (error) {
    console.error('Error saving custom engine:', error);
    // Use text icon as fallback
    engine.icon = generateTextIcon(engine.label);
    const customEngines = getCustomEngines();
    customEngines.push(engine);
    localStorage.setItem('customSearchEngines', JSON.stringify(customEngines));
    // Update dropdown menu immediately
    createSearchEngineDropdown();
  }
}

// Get custom search engine list
function getCustomEngines() {
  const stored = localStorage.getItem('customSearchEngines');
  return stored ? JSON.parse(stored) : [];
}

// Modify deleteCustomEngine function
function deleteCustomEngine(engineId) {
  if (confirm(chrome.i18n.getMessage('searchEngineDeleteConfirm'))) {
    const customEngines = getCustomEngines();
    const filtered = customEngines.filter(e => e.name !== engineId);
    localStorage.setItem('customSearchEngines', JSON.stringify(filtered));
    
    // If the engine is enabled, remove it from enabled list
    SearchEngineManager.removeEngine(engineId);
    // Update dropdown menu immediately
    createSearchEngineDropdown();
    
    refreshCustomEngines();
  }
}

// Refresh custom search engine list
function refreshCustomEngines() {
  const container = document.getElementById('custom-engines');
  if (!container) return;

  container.innerHTML = '';
  const customEngines = getCustomEngines();
  const enabledEngines = SearchEngineManager.getEnabledEngines();
  const enabledEngineNames = enabledEngines.map(e => e.name);

  customEngines.forEach(engine => {
    const engineItem = document.createElement('div');
    engineItem.className = 'search-engine-item';

    const checkboxContainer = document.createElement('label');
    checkboxContainer.className = 'custom-checkbox';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = enabledEngineNames.includes(engine.name);

    const checkmark = document.createElement('span');
    checkmark.className = 'checkmark';

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkmark);

    const engineInfo = document.createElement('div');
    engineInfo.className = 'search-engine-info';

    const engineIcon = document.createElement('img');
    engineIcon.src = engine.icon;
    engineIcon.alt = engine.label;
    engineIcon.className = 'search-engine-icon';

    const engineName = document.createElement('span');
    engineName.className = 'search-engine-name';
    engineName.textContent = engine.label;

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-custom-engine';
    deleteButton.innerHTML = '×';
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      deleteCustomEngine(engine.name);
    };

    engineInfo.appendChild(engineIcon);
    engineInfo.appendChild(engineName);
    engineItem.appendChild(checkboxContainer);
    engineItem.appendChild(engineInfo);
    engineItem.appendChild(deleteButton);

    // Simplify event handling logic
    const toggleEngine = (e) => {
      // Get actual checkbox element
      const checkbox = e.currentTarget.querySelector('input[type="checkbox"]');
      
      // Exclude clicks on delete button and checkbox itself
      if (e.target.closest('.delete-custom-engine') || e.target === checkbox) {
        return;
      }

      // Toggle checkbox state
      checkbox.checked = !checkbox.checked;
      
      // Trigger change event to sync state
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Update styles and state
      e.currentTarget.classList.toggle('selected', checkbox.checked);
      handleEngineToggle(engine, checkbox.checked);
    };

    // Add click event for the whole item
    engineItem.addEventListener('click', toggleEngine);
    
    // Remove checkbox click event prevention
    checkbox.addEventListener('change', (e) => {
      // Update state directly
      engineItem.classList.toggle('selected', e.target.checked);
      handleEngineToggle(engine, e.target.checked);
    });

    container.appendChild(engineItem);
  });
}

// Create new initialization function
function initializeSearchEngineDialog() {
  const dialog = document.getElementById('search-engines-dialog');
  if (dialog) {
    const closeButton = dialog.querySelector('.close-button');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        dialog.style.display = 'none';
      });
    }
    
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.style.display = 'none';
      }
    });

    const modalContent = dialog.querySelector('.modal-content');
    if (modalContent) {
      modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }
  }

  // Initialize custom search engine form
  initCustomEngineForm();
  // Refresh custom search engine list
  refreshCustomEngines();
}

// Modify updateSearchEngineIcon function
function updateSearchEngineIcon(engine) {
  if (typeof engine === 'string') {
    setSearchEngineIcon(engine);
  } else if (engine && engine.name) {
    setSearchEngineIcon(engine.name);
  }
}

// Add setSearchEngineIcon function
function setSearchEngineIcon(engineName) {
  const searchEngineIcon = document.getElementById('search-engine-icon');
  if (!searchEngineIcon) return;

  const allEngines = SearchEngineManager.getAllEngines();
  const engine = allEngines.find(e => e.name === engineName);
  
  if (engine) {
    searchEngineIcon.src = engine.icon;
    searchEngineIcon.alt = `${getLocalizedMessage(engine.label)} Search`;
  } else {
    // Use default icon
    searchEngineIcon.src = '../images/placeholder-icon.svg';
    searchEngineIcon.alt = 'Search';
  }
}

// Add this function if it doesn't exist
function getSearchEngineIconPath(engineName) {
  const allEngines = SearchEngineManager.getAllEngines();
  const engine = allEngines.find(e => e.name === engineName);
  return engine ? engine.icon : '../images/placeholder-icon.svg';
}

// Unified export of all required functions and variables
export { 
  SearchEngineManager, 
  updateSearchEngineIcon, 
  setSearchEngineIcon,
  createSearchEngineDropdown, 
  initializeSearchEngineDialog,
  getSearchUrl,
  createTemporarySearchTabs,
  getSearchEngineIconPath
};
