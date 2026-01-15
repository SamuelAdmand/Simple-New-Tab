// Triggered when extension is installed or updated
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed or updated:", details.reason);

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "chrome://newtab" });
    chrome.storage.local.set({ defaultBookmarkId: null });
    chrome.storage.sync.set({
      openInNewTab: true, // Open in new tab by default
      sidepanelOpenInNewTab: true, // Open in new tab by default
      sidepanelOpenInSidepanel: false // Do not open in side panel by default
    });
  }

  // Check if commands are correctly registered
  chrome.commands.getAll((commands) => {
    console.log("Registered commands:", commands);

    // Find side panel command
    const sidePanelCommand = commands.find(cmd => cmd.name === "open_side_panel");
    if (sidePanelCommand) {
      console.log("Side panel command registered with shortcut:", sidePanelCommand.shortcut);
    } else {
      console.warn("Side panel command not found! Available commands:", commands.map(cmd => cmd.name).join(", "));

      // Check for other possible side panel commands
      const alternativeCommand = commands.find(cmd =>
        cmd.name === "_execute_action_with_ui" ||
        cmd.name.includes("side") ||
        cmd.name.includes("panel")
      );

      if (alternativeCommand) {
        console.log("Found alternative command that might be for side panel:", alternativeCommand);
      }
    }
  });

  // Register side panel navigation content script
  registerSidePanelNavigationScript();
});

// Register side panel navigation content script
function registerSidePanelNavigationScript() {
  // We no longer use chrome.scripting.registerContentScripts
  // Because content scripts are already statically registered in manifest.json
  console.log('Using static content script registration from manifest.json');
  // No need for dynamic registration as this content script is already in manifest.json:
  // {
  //   "matches": ["<all_urls>"],
  //   "js": ["src/sidepanel-navigation.js"],
  //   "run_at": "document_end"
  // }
}

// Modify debounce mechanism
const openingTabs = new Set();
const DEBOUNCE_TIME = 1000;

function createTab(url, options = {}) {
  return new Promise((resolve, reject) => {
    // Check if the same URL is being opened
    if (openingTabs.has(url)) {
      console.log('Preventing duplicate tab open for URL:', url);
      reject(new Error('Duplicate request'));
      return;
    }

    // Add to opening set
    openingTabs.add(url);

    // Create new tab
    chrome.tabs.create({
      url: url,
      active: true,
      ...options
    }, (tab) => {
      if (chrome.runtime.lastError) {
        openingTabs.delete(url); // Remove immediately on error
        reject(chrome.runtime.lastError);
      } else {
        resolve(tab);
      }

      // Set delay to remove URL
      setTimeout(() => {
        openingTabs.delete(url);
      }, DEBOUNCE_TIME);
    });
  });
}

// Merge all message listening logic into one listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in background:', request);

  // Handle side panel navigation messages
  if (request.action === 'navigateHome') {
    const homePath = 'src/sidepanel.html';

    // Return to side panel home
    chrome.sidePanel.setOptions({
      path: homePath
    }).then(() => {
      console.log('Successfully navigated to sidepanel home');

      // Get current history state
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        let history = result.sidePanelHistory || [];
        let currentIndex = result.sidePanelCurrentIndex || -1;

        console.log('Current history before home navigation:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
        });

        // Initialize history if empty
        if (history.length === 0) {
          history = [homePath];
          currentIndex = 0;
          console.log('Home: Initialized empty history');
        } else {
          // Normal navigation case
          // If navigating in the middle of history, truncate history
          if (currentIndex < history.length - 1) {
            history = history.slice(0, currentIndex + 1);
            console.log('Home: Truncated forward history from', history.length, 'to', currentIndex + 1);
          }

          // Check if the last entry in history is already home page
          if (history[history.length - 1] !== homePath) {
            // Add home page to end of history
            currentIndex++;
            history.push(homePath);
            console.log('Home: Added home page to history at index', currentIndex);
          } else {
            console.log('Home: Last entry is already the home page, not adding duplicate');
          }
        }

        // Update history recording
        chrome.storage.local.set({
          sidePanelHistory: history,
          sidePanelCurrentIndex: currentIndex
        }, () => {
          console.log('Updated history state for home navigation:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            history: history.map(u => u.substring(0, 30) + '...'),
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });

          // Notify content script to update navigation state
          if (sender.tab && sender.tab.id) {
            try {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateNavigationState',
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1,
                url: homePath,
                historyLength: history.length,
                currentIndex: currentIndex
              });
            } catch (error) {
              console.error('Error sending message to tab:', error);
            }
          }

          sendResponse({
            success: true,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });
        });
      });
    }).catch(error => {
      console.error('Error navigating to sidepanel home:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for asynchronous response
  }

  if (request.action === 'navigateBack' || request.action === 'navigateForward') {
    // Get history state
    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      if (!result.sidePanelHistory || result.sidePanelCurrentIndex === undefined) {
        console.error('No history state found for navigation');
        sendResponse({ success: false, error: 'No history state found' });
        return;
      }

      const history = result.sidePanelHistory;
      let currentIndex = result.sidePanelCurrentIndex;

      console.log('Current navigation state before operation:', {
        action: request.action,
        historyLength: history.length,
        currentIndex: currentIndex,
        canGoBack: currentIndex > 0,
        canGoForward: currentIndex < history.length - 1,
        history: history.map(u => u.substring(0, 30) + '...')
      });

      // Update index based on navigation direction
      if (request.action === 'navigateBack' && currentIndex > 0) {
        currentIndex--;
      } else if (request.action === 'navigateForward' && currentIndex < history.length - 1) {
        currentIndex++;
      } else {
        console.log('Cannot navigate in requested direction');
        sendResponse({
          success: false,
          error: 'Cannot navigate in requested direction',
          canGoBack: currentIndex > 0,
          canGoForward: currentIndex < history.length - 1,
          currentIndex: currentIndex,
          historyLength: history.length
        });
        return;
      }

      const targetUrl = history[currentIndex];
      console.log(`Navigating ${request.action === 'navigateBack' ? 'back' : 'forward'} to:`, targetUrl, 'Index:', currentIndex);

      // Update current index in storage
      chrome.storage.local.set({ sidePanelCurrentIndex: currentIndex }, () => {
        // Update side panel URL
        chrome.sidePanel.setOptions({
          path: targetUrl
        }).then(() => {
          console.log('Successfully navigated to:', targetUrl);
          console.log('Updated navigation state:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });

          // Notify content script to update navigation state
          if (sender.tab && sender.tab.id) {
            try {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateNavigationState',
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1,
                url: targetUrl,
                historyLength: history.length,
                currentIndex: currentIndex
              });
            } catch (err) {
              console.log('Error sending message to tab:', err);
            }
          }

          sendResponse({
            success: true,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1,
            url: targetUrl,
            historyLength: history.length
          });
        }).catch(error => {
          console.error('Error navigating:', error);
          sendResponse({ success: false, error: error.message });
        });
      });
    });

    return true; // Keep message channel open for asynchronous response
  }

  // Handle request to get navigation state
  if (request.action === 'getNavigationState') {
    // Get history state
    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      if (!result.sidePanelHistory || result.sidePanelCurrentIndex === undefined) {
        console.log('No history state found for navigation status check, initializing empty state');
        // Initialize history
        const initialHistory = ['src/sidepanel.html'];
        const initialIndex = 0;

        chrome.storage.local.set({
          sidePanelHistory: initialHistory,
          sidePanelCurrentIndex: initialIndex
        }, () => {
          sendResponse({
            success: true,
            canGoBack: false,
            canGoForward: false,
            initialized: true,
            historyLength: 1,
            currentIndex: 0
          });
        });
        return;
      }

      const history = result.sidePanelHistory;
      const currentIndex = result.sidePanelCurrentIndex;
      const url = request.url || (history[currentIndex] || '');
      const canGoBack = currentIndex > 0;
      const canGoForward = currentIndex < history.length - 1;

      console.log('Navigation state requested:', {
        historyLength: history.length,
        currentIndex: currentIndex,
        canGoBack: canGoBack,
        canGoForward: canGoForward,
        history: history.map(u => u.substring(0, 30) + '...')
      });

      // Notify content script to update navigation state
      if (sender.tab && sender.tab.id) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'updateNavigationState',
            canGoBack: canGoBack,
            canGoForward: canGoForward,
            url: url,
            historyLength: history.length,
            currentIndex: currentIndex
          }).catch(error => {
            console.log('Failed to send updateNavigationState message:', error);
          });
        } catch (err) {
          console.error('Error sending message to tab:', err);
        }
      }

      sendResponse({
        success: true,
        currentIndex: currentIndex,
        canGoBack: canGoBack,
        canGoForward: canGoForward,
        url: url,
        historyLength: history.length
      });
    });

    return true; // Keep message channel open for asynchronous response
  }

  // Handle side panel internal link click and record to history
  if (request.action === 'recordAndNavigate') {
    const url = request.url;
    console.log('Recording and navigating to URL in side panel:', url);

    // Get current history state
    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      let history = result.sidePanelHistory || [];
      let currentIndex = result.sidePanelCurrentIndex || -1;

      // Record current state for debugging
      console.log('Before update - History state:', {
        historyLength: history.length,
        currentIndex: currentIndex,
        history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
      });

      // Handle initial case
      if (history.length === 0) {
        // If history is empty, add a home page record first
        history.push('src/sidepanel.html');
        currentIndex = 0;
        console.log('Initialized empty history with homepage');
      }

      // Calculate new index position
      if (currentIndex < history.length - 1) {
        // If navigating in the middle of history, truncate history
        currentIndex++;
        console.log(`Navigating from middle of history: Increasing currentIndex to ${currentIndex} and truncating`);
        history = history.slice(0, currentIndex);
      } else {
        // Add to end of history normally
        currentIndex++;
        console.log(`Adding to end of history: new currentIndex = ${currentIndex}`);
      }

      // Add new URL to history
      history.push(url);

      console.log('Updated history state:', {
        historyLength: history.length,
        currentIndex: currentIndex,
        history: history.map(u => u.substring(0, 30) + '...') // Only show first 30 chars of URL in log
      });

      // Update history state in storage
      chrome.storage.local.set({
        sidePanelHistory: history,
        sidePanelCurrentIndex: currentIndex
      }, () => {
        // Re-get storage state to ensure it's updated correctly
        chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (verifyResult) => {
          console.log('Verified storage update:', {
            historyLength: verifyResult.sidePanelHistory.length,
            currentIndex: verifyResult.sidePanelCurrentIndex,
            history: verifyResult.sidePanelHistory.map(u => u.substring(0, 30) + '...')
          });

          // Update URL using Chrome Side Panel API
          chrome.sidePanel.setOptions({
            path: url
          }).then(() => {
            console.log('Successfully navigated to intercepted link:', url);
            console.log('Current history after navigation:', {
              historyLength: history.length,
              currentIndex: currentIndex,
              canGoBack: currentIndex > 0,
              canGoForward: currentIndex < history.length - 1
            });

            // Notify content script to update navigation state
            if (sender.tab && sender.tab.id) {
              try {
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: 'updateNavigationState',
                  canGoBack: currentIndex > 0,
                  canGoForward: currentIndex < history.length - 1,
                  url: url,
                  historyLength: history.length,
                  currentIndex: currentIndex
                });
              } catch (error) {
                console.error('Error sending message to tab:', error);
              }
            }

            sendResponse({
              success: true,
              currentIndex: currentIndex,
              canGoBack: currentIndex > 0,
              canGoForward: currentIndex < history.length - 1,
              historyLength: history.length
            });
          }).catch(error => {
            console.error('Error navigating to intercepted link:', error);
            sendResponse({ success: false, error: error.message });
          });
        });
      });
    });

    return true; // Keep message channel open for asynchronous response
  }

  // Handle request to open URL from side panel
  if (request.action === 'openUrlInSidePanel') {
    const url = request.url;
    console.log('Opening URL in side panel:', url);

    // Check if history update is needed
    if (request.updateHistory !== false) {
      // Get current history state
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        let history = result.sidePanelHistory || [];
        let currentIndex = result.sidePanelCurrentIndex || -1;

        // Record current state for debugging
        console.log('Before update (direct URL) - History state:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
        });

        // Handle initial case
        if (history.length === 0) {
          // If history is empty, add a home page record first
          history.push('src/sidepanel.html');
          currentIndex = 0;
          console.log('Direct URL: Initialized empty history with homepage');
        }

        // Calculate new index position
        if (currentIndex < history.length - 1) {
          // If navigating in the middle of history, truncate history
          currentIndex++;
          console.log(`Direct URL: Navigating from middle of history: Increasing currentIndex to ${currentIndex} and truncating`);
          history = history.slice(0, currentIndex);
        } else {
          // Add to end of history normally
          currentIndex++;
          console.log(`Direct URL: Adding to end of history: new currentIndex = ${currentIndex}`);
        }

        // Add new URL to history
        history.push(url);

        console.log('Updated history state for direct URL open:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.map(u => u.substring(0, 30) + '...') // Only show first 30 chars of URL in log
        });

        // Update history state in storage
        chrome.storage.local.set({
          sidePanelHistory: history,
          sidePanelCurrentIndex: currentIndex
        }, () => {
          // Re-get storage state to ensure it's updated correctly
          chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (verifyResult) => {
            console.log('Verified direct URL storage update:', {
              historyLength: verifyResult.sidePanelHistory.length,
              currentIndex: verifyResult.sidePanelCurrentIndex,
              history: verifyResult.sidePanelHistory.map(u => u.substring(0, 30) + '...')
            });

            // Update URL using Chrome Side Panel API
            navigateToUrl(url, sender, sendResponse, request.isNavigating);
          });
        });
      });
    } else {
      // Navigate directly without updating history
      navigateToUrl(url, sender, sendResponse, request.isNavigating);
    }

    return true; // Keep message channel open for asynchronous response
  }

  // Helper function: Navigate to URL using Chrome Side Panel API
  function navigateToUrl(url, sender, sendResponse, isNavigating = false) {
    console.log('Navigating to URL in side panel:', url, 'Is navigating:', isNavigating);

    // Send message to current tab indicating page is about to open in side panel
    if (!isNavigating) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          try {
            // Add check for tab existence and catch the error
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'sidepanelNavigation',
              isSidePanel: true,
              url: url,
              phase: 'before_navigation'
            }, (response) => {
              // Handle potential errors with chrome.runtime.lastError
              if (chrome.runtime.lastError) {
                console.log('Message sending failed (expected): ', chrome.runtime.lastError.message);
                // We can still proceed as this error is often expected
              } else {
                console.log('Sending side panel pre-load flag success:', response);
              }
            });
          } catch (e) {
            console.error('Sending side panel pre-load flag failed:', e);
            // Continue with navigation even if message fails
          }
        }
      });
    }

    // Ensure URL includes sidepanel_view flag, unless it's side panel home page
    if (!url.includes('sidepanel.html') && !url.includes('sidepanel_view=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
      console.log('Added sidepanel_view parameter to URL:', url);
    }

    // First save state to Chrome storage
    chrome.storage.session.set({
      'sidepanel_view': true,
      'sidepanel_last_url': url,
      'sidepanel_timestamp': Date.now()
    }, () => {
      console.log('Side panel state saved to chrome.storage.session');
    });

    chrome.sidePanel.setOptions({
      path: url
    }).then(() => {
      console.log('Successfully opened URL in side panel:', url);

      // Get latest history state to update navigation buttons
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        if (result.sidePanelHistory && result.sidePanelCurrentIndex !== undefined) {
          const history = result.sidePanelHistory;
          const currentIndex = result.sidePanelCurrentIndex;

          console.log('Current history state after navigation:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1,
            history: history.map(u => u.substring(0, 30) + '...')
          });

          // Notify content script to update navigation state - add error handling
          if (sender && sender.tab && sender.tab.id) {
            try {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateNavigationState',
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1
              }, (response) => {
                // Handle potential errors with chrome.runtime.lastError
                if (chrome.runtime.lastError) {
                  console.log('Navigation state update failed (expected): ', chrome.runtime.lastError.message);
                  // This is often expected, as content scripts may not be ready
                }
              });
            } catch (e) {
              console.error('Error sending navigation update:', e);
            }
          }

          // Send side panel state flag to it after page loads 
          setTimeout(() => {
            // Get the currently opened tab in side panel
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs && tabs.length > 0) {
                try {
                  // Try sending message multiple times to ensure receipt - add error handling
                  for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'sidepanelNavigation',
                        isSidePanel: true,
                        url: url,
                        phase: 'after_navigation',
                        attempt: i + 1
                      }, (response) => {
                        // Handle potential errors with chrome.runtime.lastError
                        if (chrome.runtime.lastError) {
                          console.log(`Failed to send side panel flag (attempt ${i + 1}): `, chrome.runtime.lastError.message);
                        } else {
                          console.log(`Successfully sent side panel flag (attempt ${i + 1}):`, response);
                        }
                      });
                    }, i * 1000); // Disperse sending time
                  }
                } catch (e) {
                  console.error('Failed to send side panel flag:', e);
                }
              }
            });
          }, 1500); // Longer delay to ensure page is loaded
        }

        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
    }).catch((error) => {
      console.error('Error opening URL in side panel:', error);
      if (sendResponse) {
        sendResponse({ success: false, error: error.toString() });
      }
    });
  }

  switch (request.action) {
    case 'fetchBookmarks':
      chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          try {
            const folders = await new Promise((resolve) => {
              chrome.bookmarks.getTree((tree) => {
                resolve(tree);
              });
            });

            const processedBookmarks = [];

            function processBookmarkNode(node) {
              if (node.url) {
                processedBookmarks.push(node);
              }
              if (node.children) {
                node.children.forEach(processBookmarkNode);
              }
            }

            folders.forEach(folder => {
              processBookmarkNode(folder);
            });

            sendResponse({
              bookmarks: bookmarkTreeNodes,
              processedBookmarks: processedBookmarks,
              success: true
            });
          } catch (error) {
            sendResponse({ error: error.message });
          }
        }
      });
      return true;

    case 'getDefaultBookmarkId':
      sendResponse({ defaultBookmarkId });
      break;

    case 'setDefaultBookmarkId':
      defaultBookmarkId = request.defaultBookmarkId;
      chrome.storage.local.set({ defaultBookmarkId: defaultBookmarkId }, function () {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;

    case 'openMultipleTabsAndGroup':
      handleOpenMultipleTabsAndGroup(request, sendResponse);
      return true;

    case 'updateFloatingBallSetting':
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateFloatingBall',
              enabled: request.enabled
            });
          } catch (error) {
            console.error('Error sending message to tab:', error);
          }
        });
      });
      chrome.storage.sync.set({ enableFloatingBall: request.enabled });
      sendResponse({ success: true });
      return true;

    case 'openSidePanel':
      toggleSidePanel();
      sendResponse({ success: true });
      return true;

    case 'updateSidePanelHistory':
      // Handle history update request from side panel internal navigation
      console.log('Handling updateSidePanelHistory:', request.url, 'source:', request.source);

      // Get current history state
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        let history = result.sidePanelHistory || [];
        let currentIndex = result.sidePanelCurrentIndex || -1;

        // Record current state for debugging
        console.log('Before in-page navigation update - History state:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
        });

        // Handle initial case
        if (history.length === 0) {
          // If history is empty, add home page as first entry
          history.push('src/sidepanel.html');
          currentIndex = 0;
        }

        // Calculate new index position
        if (currentIndex < history.length - 1) {
          // If navigating in the middle of history, truncate history
          currentIndex++;
          history = history.slice(0, currentIndex);
        } else {
          // Add to end of history normally
          currentIndex++;
        }

        // Add new URL to history
        history.push(request.url);

        // Calculate back and forward capabilities
        const canGoBack = currentIndex > 0;
        const canGoForward = currentIndex < history.length - 1;

        console.log('Updated history state for in-page navigation:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          canGoBack: canGoBack,
          canGoForward: canGoForward,
          history: history.map(u => u.substring(0, 30) + '...')
        });

        // Update history state in storage
        chrome.storage.local.set({
          sidePanelHistory: history,
          sidePanelCurrentIndex: currentIndex
        }, () => {
          // Send update message to current active tab, not all tabs
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs && tabs.length > 0) {
              // Use sendMessage callback to handle error instead of try-catch
              chrome.tabs.sendMessage(
                tabs[0].id,
                {
                  action: 'updateNavigationState',
                  canGoBack: canGoBack,
                  canGoForward: canGoForward,
                  url: request.url,
                  historyLength: history.length,
                  currentIndex: currentIndex
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    // Log error but do not throw exception
                    console.log('Message delivery failed (expected for new tabs):', chrome.runtime.lastError.message);
                  } else if (response) {
                    console.log('Navigation state update delivered successfully');
                  }
                }
              );
            }
          });

          if (sendResponse) {
            sendResponse({
              success: true,
              canGoBack: canGoBack,
              canGoForward: canGoForward
            });
          }
        });
      });
      return true;

    case 'reloadExtension':
      chrome.runtime.reload();
      return true;

    case 'openInSidePanel':
      if (openingTabs.has(request.url)) {
        console.log('URL is already being opened:', request.url);
        sendResponse({ success: false, error: 'URL is already being opened' });
        return true;
      }

      // Add to opening set
      openingTabs.add(request.url);

      chrome.tabs.create({
        url: request.url,
        active: true
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create tab:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('Successfully created new tab:', tab);
          sendResponse({ success: true, tabId: tab.id });
        }

        // Set delay to remove URL
        setTimeout(() => {
          openingTabs.delete(request.url);
        }, DEBOUNCE_TIME);
      });
      return true;

    case 'updateBookmarkDisplay':
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateBookmarkDisplay',
              folderId: request.folderId
            });
          } catch (error) {
            console.error('Error sending message to tab:', error);
          }
        });
      });
      sendResponse({ success: true });
      return true;

    case 'getBookmarkFolder':
      chrome.bookmarks.get(request.folderId, (folder) => {
        if (chrome.runtime.lastError) {
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message
          });
          return;
        }

        // If it is a folder, get its children
        if (!folder[0].url) {
          chrome.bookmarks.getChildren(request.folderId, (children) => {
            if (chrome.runtime.lastError) {
              sendResponse({
                success: true,
                folder: folder[0],
                error: chrome.runtime.lastError.message
              });
            } else {
              sendResponse({
                success: true,
                folder: folder[0],
                children: children
              });
            }
          });
          return true; // Keep message channel open for asynchronous response
        } else {
          // If it is a bookmark, return directly
          sendResponse({
            success: true,
            folder: folder[0]
          });
        }
      });
      return true; // Keep message channel open for asynchronous response

    case 'checkSidePanelStatus':
      sendResponse({ isOpen: sidePanelState.isOpen });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

function handleOpenMultipleTabsAndGroup(request, sendResponse) {
  const { urls, groupName } = request;
  const tabIds = [];

  const createTabPromises = urls.map(url => {
    return new Promise((resolve) => {
      chrome.tabs.create({ url: url, active: false }, function (tab) {
        if (!chrome.runtime.lastError) {
          tabIds.push(tab.id);
        }
        resolve();
      });
    });
  });

  Promise.all(createTabPromises).then(() => {
    if (tabIds.length > 1) {
      chrome.tabs.group({ tabIds: tabIds }, function (groupId) {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (chrome.tabGroups) {
          chrome.tabGroups.update(groupId, {
            title: groupName,
            color: 'cyan'
          }, function () {
            if (chrome.runtime.lastError) {
              sendResponse({ success: true, warning: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        } else {
          sendResponse({ success: true, warning: 'tabGroups API not available, cannot set group name and color' });
        }
      });
    } else {
      sendResponse({ success: true, message: 'URL count not greater than 1, open tab directly, do not create tab group' });
    }
  });
}

// Update state when opening and closing side panel
let sidePanelState = { isOpen: false };

// Modify code to open side panel
function toggleSidePanel() {
  // Get current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tabs found");
      return;
    }

    const tabId = tabs[0].id;

    // If side panel is already open, close it
    if (sidePanelState.isOpen) {
      chrome.sidePanel.setOptions({
        enabled: false
      });
      sidePanelState.isOpen = false;
      console.log("Side panel closed");
      return;
    }

    // Try to open side panel
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'src/sidepanel.html'
    });

    // Open side panel
    chrome.sidePanel.open({
      tabId: tabId
    }).then(() => {
      console.log("Side panel opened successfully");
      sidePanelState.isOpen = true;

      // Save side panel state to storage to share between pages
      chrome.storage.session.set({ 'sidepanel_active': true }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving side panel state:', chrome.runtime.lastError);
        } else {
          console.log('Side panel state saved to session storage');
        }
      });

      // Set delay, wait for side panel to load then send message
      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'sidepanelNavigation',
            isSidePanel: true
          }, (response) => {
            // Handle potential errors with chrome.runtime.lastError
            if (chrome.runtime.lastError) {
              console.log('Failed to send side panel open flag (expected):', chrome.runtime.lastError.message);
              // This error is expected if content script is not ready, we can ignore it
            } else {
              console.log('Side panel open flag sent successfully:', response);
            }
          });
        } catch (e) {
          console.error('Failed to send side panel open flag:', e);
          // Continue even if message fails - this doesn't affect functionality
        }
      }, 1000);
    }).catch((error) => {
      console.error("Failed to open side panel:", error);
    });
  });
}

// Modify command listener to use toggle function
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);

  if (command === "open_side_panel") {
    console.log("Toggling side panel with shortcut");
    toggleSidePanel();
  }
});

// Add extension icon click event handler
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked");
  // Toggle side panel when extension icon is clicked
  toggleSidePanel();
});

// Add these variables to top of background.js
let lastOpenedUrl = '';
let lastOpenTime = 0;

