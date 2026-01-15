import { ICONS } from './icons.js';

// New feature tips management class
class FeatureTips {
    constructor() {
        this.fadeOutDuration = 300; // Fade out duration (ms)
        this.tipQueue = []; // Tip queue for sequential display
        this.isShowingTip = false; // Is showing tip
        this.tipsInitialized = false; // Tip initialization flag
        this.isProcessing = false; // Prevent duplicate processing
        this.checkTimeout = null; // For debounce processing
        this.hasCheckedSettingsTip = false; // Flag for checking if settings tip has been checked
        this.domReady = false; // Flag for DOM ready
        this.pageLoaded = false; // Flag for page fully loaded
        this.initStarted = false; // Flag for initialization started

        // Immediately hide all tips to prevent flickering
        this.hideAllTipsImmediately();

        // Wait for DOM content loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.domReady = true;
                this.hideAllTipsImmediately();
                this.startInit();
            });
        } else {
            this.domReady = true;
            this.startInit();
        }

        // Listen for page fully loaded
        window.addEventListener('load', () => {
            this.pageLoaded = true;
            this.startInit();
        });
    }

    // Start initialization process
    startInit() {
        if (this.initStarted || !this.domReady || !this.pageLoaded) {
            return;
        }
        this.initStarted = true;
        this.init();
    }

    // Immediately hide all tips
    hideAllTipsImmediately() {
        // Use style tag to immediately hide tips avoiding flicker from CSS load delay
        const style = document.createElement('style');
        style.textContent = `
            .settings-update-tip {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            }
        `;
        document.head.appendChild(style);

        // Remove potential old styles
        const oldStyle = document.getElementById('feature-tips-style');
        if (oldStyle) {
            oldStyle.remove();
        }
        style.id = 'feature-tips-style';
    }

    // Reset tip styles
    resetTipStyle(tipContainer) {
        // Remove inline styles and previously added classes
        tipContainer.style.cssText = '';
        tipContainer.classList.remove('tip-fade-out');

        // Remove !important style influence
        const style = document.getElementById('feature-tips-style');
        if (style) {
            style.remove();
        }

        // Set initial styles
        tipContainer.style.display = 'block';
        tipContainer.style.opacity = '0';
        tipContainer.style.visibility = 'visible';

        // Force reflow to ensure styles apply
        void tipContainer.offsetHeight;
    }

    // Initialize
    async init() {
        try {
            // Get current version
            this.currentVersion = await this.getExtensionVersion();
            console.log('[FeatureTips] Current version:', this.currentVersion);

            // Check for version updates
            await this.checkVersionUpdate();

            // Start processing tip queue
            setTimeout(() => {
                this.processNextTip();
            }, 1000);
        } catch (error) {
            console.error('[FeatureTips] Initialization error:', error);
        }
    }

    // Get extension version
    async getExtensionVersion() {
        const manifest = chrome.runtime.getManifest();
        return manifest.version;
    }

    // Check for version updates
    async checkVersionUpdate() {
        const lastVersion = localStorage.getItem('lastVersion');
        console.log('[FeatureTips] Current version:', this.currentVersion, 'Last version:', lastVersion);

        if (!lastVersion || this.isNewerVersion(this.currentVersion, lastVersion)) {
            // Get all new feature tips for this version
            const features = await this.getVersionFeatures(lastVersion, this.currentVersion);
            console.log('[FeatureTips] New feature list:', features);

            // Add new feature tips to queue
            for (const feature of features) {
                this.queueShowTips(feature);
            }

            // Update stored version number
            localStorage.setItem('lastVersion', this.currentVersion);
        }
    }

    // Compare version numbers
    isNewerVersion(current, last) {
        if (!last) return true;

        const currentParts = current.split('.').map(Number);
        const lastParts = last.split('.').map(Number);

        for (let i = 0; i < currentParts.length; i++) {
            if (currentParts[i] > (lastParts[i] || 0)) return true;
            if (currentParts[i] < (lastParts[i] || 0)) return false;
        }
        return false;
    }

    // Get new features between versions
    getVersionFeatures(lastVersion, currentVersion) {
        // Version feature map
        const versionFeatures = {
            '1.238': ['bookmarkCleanup'],
            '1.239': ['sidebarFeatures'],
            '1.241': ['searchEngineUpdate'],
            '1.243': ['customTab'],
            '1.244': ['shortcuts'],
            '1.245': ['searchSuggestions'],
        };

        const features = [];

        // If new install (lastVersion is null), only show current version features
        if (!lastVersion) {
            const currentFeatures = versionFeatures[currentVersion];
            return currentFeatures ? currentFeatures : [];
        }

        // Get all new features between versions
        for (const [version, featureList] of Object.entries(versionFeatures)) {
            if (this.isNewerVersion(version, lastVersion) &&
                !this.isNewerVersion(version, currentVersion)) {
                features.push(...featureList);
            }
        }

        return features;
    }

    // Add tip to queue
    queueShowTips(featureKey) {
        const storageKey = `hasShown${featureKey}Tips`;
        const hasShownTips = localStorage.getItem(storageKey);

        console.log('[FeatureTips] Check tip:', featureKey, 'Shown:', hasShownTips);

        if (!hasShownTips) {
            this.tipQueue.push({
                featureKey,
                storageKey
            });
        }
    }

    // Process next tip in queue
    processNextTip() {
        // If processing or all tips checked, return
        if (this.isProcessing || (this.hasCheckedSettingsTip)) {
            return;
        }

        console.log('[FeatureTips] Process next tip, queue length:', this.tipQueue.length, 'Is showing:', this.isShowingTip);

        if (this.isShowingTip || this.tipQueue.length === 0) {
            // If no new feature tips or all shown, check if settings tip needed
            if (!this.isShowingTip && this.tipQueue.length === 0 && !this.hasCheckedSettingsTip) {
                console.log('[FeatureTips] New feature tip queue empty, checking settings tip');
                this.isProcessing = true;
                this.checkSettingsTip();
            }
            return;
        }

        this.isProcessing = true;
        const { featureKey, storageKey } = this.tipQueue.shift();
        this.isShowingTip = true;

        requestAnimationFrame(() => {
            this.showTips(featureKey);
            localStorage.setItem(storageKey, 'true');
        });
    }

    // Check if settings tip needs to be displayed
    checkSettingsTip() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }

        // If settings tip already checked, return
        if (this.hasCheckedSettingsTip && localStorage.getItem('settingsUpdateTipShown') === 'true') {
            this.isProcessing = false;
            return;
        }

        this.hasCheckedSettingsTip = true;
        this.checkTimeout = setTimeout(() => {
            const settingsTipShown = localStorage.getItem('settingsUpdateTipShown') === 'true';
            if (!settingsTipShown) {
                console.log('[FeatureTips] Showing settings tip');
                this.showSettingsUpdateTip();
            } else {
                this.isProcessing = false;
            }
        }, 100);
    }

    // Show new feature tip
    showTips(featureKey) {
        console.log('[FeatureTips] Showing tip:', featureKey);

        const tipsElement = document.createElement('div');
        tipsElement.className = 'feature-tips';

        // Get message text and convert \n to <br>
        const messageText = chrome.i18n.getMessage(featureKey + 'Feature').replace(/\n/g, '<br>');

        tipsElement.innerHTML = `
      <div class="feature-tips-content">
        <div class="tip-content">
          ${ICONS.info}
          <div class="tip-text">
            <div class="feature-tips-title">${chrome.i18n.getMessage('newFeatureTitle')}</div>
            <div class="feature-description">${messageText}</div>
          </div>
          <button class="tip-close" aria-label="Close Tip">
            ${ICONS.close}
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(tipsElement);

        // Add close button event listener
        const closeButton = tipsElement.querySelector('.tip-close');
        closeButton.addEventListener('click', () => {
            this.closeTips(tipsElement);
        });
    }

    // Close tip
    closeTips(tipsElement) {
        tipsElement.style.opacity = '0';
        setTimeout(() => {
            tipsElement.remove();
            this.isShowingTip = false;
            this.isProcessing = false; // Reset processing state
            // Process next tip in queue
            this.processNextTip();
        }, this.fadeOutDuration);
    }

    // Initialize all tips
    initAllTips() {
        // Prevent duplicate initialization
        if (this.tipsInitialized) {
            return;
        }
        this.tipsInitialized = true;

        // Reset check state
        this.hasCheckedSettingsTip = false;

        // Ensure DOM fully loaded
        if (!this.domReady || !this.pageLoaded) {
            return;
        }

        // Pre-hide all tips
        this.hideAllTipsImmediately();

        // Start checking tips
        this.startTipsCheck();
    }

    // Show settings update tip
    showSettingsUpdateTip() {
        if (this.isShowingTip || !this.domReady || !this.pageLoaded) {
            return;
        }

        // Check localStorage, if shown return
        if (localStorage.getItem('settingsUpdateTipShown') === 'true') {
            this.isShowingTip = false;
            this.isProcessing = false;
            return;
        }

        this.isShowingTip = true;
        const tipContainer = document.querySelector('.settings-update-tip');
        if (tipContainer) {
            console.log('[FeatureTips] Showing settings update tip');

            // Reset tip styles
            this.resetTipStyle(tipContainer);

            // Use requestAnimationFrame and setTimeout for smooth animation
            requestAnimationFrame(() => {
                setTimeout(() => {
                    tipContainer.style.opacity = '1';
                }, 50);
            });

            const closeButton = tipContainer.querySelector('.tip-close');
            if (closeButton) {
                const newCloseButton = closeButton.cloneNode(true);
                closeButton.parentNode.replaceChild(newCloseButton, closeButton);

                newCloseButton.addEventListener('click', () => {
                    tipContainer.classList.add('tip-fade-out');
                    tipContainer.style.opacity = '0';
                    setTimeout(() => {
                        tipContainer.style.display = 'none';
                        localStorage.setItem('settingsUpdateTipShown', 'true');
                        this.isShowingTip = false;
                        this.isProcessing = false;
                    }, 300);
                });
            } else {
                console.warn('[FeatureTips] Settings tip close button not found');
                this.isShowingTip = false;
                this.isProcessing = false;
            }
        } else {
            console.warn('[FeatureTips] Settings tip container not found');
            this.isShowingTip = false;
            this.isProcessing = false;
        }
    }

    // Start checking tips
    startTipsCheck() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }

        // Ensure page and DOM fully loaded
        if (!this.domReady || !this.pageLoaded) {
            return;
        }

        this.checkTimeout = setTimeout(() => {
            if (this.tipQueue.length === 0 && !this.isShowingTip && !this.isProcessing) {
                this.processNextTip();
            }
        }, 1000);
    }
}

// Export singleton instance
export const featureTips = new FeatureTips();