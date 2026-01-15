import { featureTips } from './feature-tips.js';

// Bookmark cleanup extension constants
const CLEANUP_EXTENSION = {
  ID: 'aeehapalakdoclgmfeondmephgiandef',
  STORE_URL: 'https://chromewebstore.google.com/detail/lazycat-bookmark-cleaner/aeehapalakdoclgmfeondmephgiandef'
};

// Check if extension is installed
function checkExtensionInstalled() {
  return new Promise((resolve, reject) => {
    chrome.management.get(CLEANUP_EXTENSION.ID, (extensionInfo) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Extension not installed'));
      } else {
        resolve(true);
      }
    });
  });
}

// Add handler to open cleanup tool from settings
function initBookmarkCleanupSettings() {
  const openCleanupButton = document.getElementById('open-bookmark-cleanup');
  if (openCleanupButton) {
    openCleanupButton.addEventListener('click', async () => {
      try {
        await checkExtensionInstalled();
        window.open(`chrome-extension://${CLEANUP_EXTENSION.ID}/index.html`, '_blank');
      } catch (error) {
        const confirmInstall = confirm(chrome.i18n.getMessage('bookmarkCleanupNotInstalled'));
        if (confirmInstall) {
          window.open(CLEANUP_EXTENSION.STORE_URL, '_blank');
        }
      }
    });
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initBookmarkCleanupSettings();
});

export { }; 