let userName = localStorage.getItem('userName') || 'Sowhale';

// 集中管理欢迎消息的颜色逻辑
const WelcomeManager = {
    colorCache: {
        lastBackground: null,
        lastTextColor: null
    },

    // 初始化方法
    initialize() {
        // 先检查欢迎语是否应该显示，再更新内容
        chrome.storage.sync.get(['showWelcomeMessage'], (result) => {
            const welcomeElement = document.getElementById('welcome-message');
            if (welcomeElement) {
                // 立即设置显示状态，避免闪烁
                welcomeElement.style.display = result.showWelcomeMessage !== false ? '' : 'none';

                // 只有在需要显示时才更新内容
                if (result.showWelcomeMessage !== false) {
                    this.updateWelcomeMessage(false); // 传入false表示不再检查显示状态
                }
            }

            // 继续其他初始化
            this.initializeColorCache();
            this.setupEventListeners();
            this.setupThemeChangeListener();
        });
    },

    // 更新欢迎消息
    updateWelcomeMessage(checkVisibility = true) {
        const now = new Date();
        const hours = now.getHours();
        let greeting;

        if (hours < 12) {
            greeting = window.getLocalizedMessage('morningGreeting');
        } else if (hours < 18) {
            greeting = window.getLocalizedMessage('afternoonGreeting');
        } else {
            greeting = window.getLocalizedMessage('eveningGreeting');
        }

        const welcomeMessage = `${greeting}, ${userName}`;
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement) {
            welcomeElement.textContent = welcomeMessage;

            // Only check display status when needed
            if (checkVisibility) {
                chrome.storage.sync.get(['showWelcomeMessage'], (result) => {
                    welcomeElement.style.display = result.showWelcomeMessage !== false ? '' : 'none';
                });
            }

            this.adjustTextColor(welcomeElement);
        }
    },

    // Initialize color cache
    initializeColorCache() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.backgroundColor;
        const backgroundImage = document.body.style.backgroundImage;

        // Calculate initial text color
        if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
            const rgb = backgroundColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const brightness = (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114);
                this.colorCache.lastTextColor = brightness > 128 ? 'rgba(51, 51, 51, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            }
        }

        this.colorCache.lastBackground = backgroundImage !== 'none' ? backgroundImage : backgroundColor;

        // Apply initial color
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement) {
            welcomeElement.style.color = this.colorCache.lastTextColor || 'rgba(51, 51, 51, 0.9)';
        }
    },

    // Adjust text color
    adjustTextColor(element) {
        const computedStyle = window.getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.backgroundColor;
        const backgroundImage = document.body.style.backgroundImage;
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        // Handle solid color background cases
        if (!backgroundImage || backgroundImage === 'none') {
            // If in dark mode, directly use light text
            if (isDarkMode) {
                element.style.color = 'rgba(255, 255, 255, 0.9)';
                this.colorCache.lastTextColor = 'rgba(255, 255, 255, 0.9)';
                return;
            }

            // In light mode, calculate text color based on background color
            let textColor = 'rgba(51, 51, 51, 0.9)'; // Default dark text

            if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
                const rgb = backgroundColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const brightness = (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114);
                    textColor = brightness > 128 ? 'rgba(51, 51, 51, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                }
            }

            this.colorCache.lastTextColor = textColor;
            element.style.color = textColor;
            return;
        }

        // Handle wallpaper background cases
        if (backgroundImage && backgroundImage !== 'none') {
            // First check cache
            if (this.colorCache.lastBackground === backgroundImage && this.colorCache.lastTextColor) {
                element.style.color = this.colorCache.lastTextColor;
                // If cached, still perform new calculation, but do not set temporary white text
            } else {
                // Only set temporary white text if not cached
                element.style.color = 'rgba(255, 255, 255, 0.9)';
            }

            // Perform new calculation...
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = backgroundImage.slice(5, -2);

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const sampleSize = 50;

                // Get the position and size of the welcome text element
                const elementRect = element.getBoundingClientRect();

                // Calculate sampling area
                const sampleArea = {
                    x: Math.max(0, elementRect.x),
                    y: Math.max(0, elementRect.y),
                    width: Math.min(elementRect.width, window.innerWidth),
                    height: Math.min(elementRect.height, window.innerHeight)
                };

                // Set canvas dimensions
                canvas.width = sampleSize;
                canvas.height = sampleSize;

                // Calculate the actual size and position of the image in the background
                const backgroundSize = getComputedStyle(document.body).backgroundSize;
                const backgroundPosition = getComputedStyle(document.body).backgroundPosition;

                // Calculate image scaling ratio
                const scale = {
                    x: img.width / window.innerWidth,
                    y: img.height / window.innerHeight
                };

                // Calculate the actual sampling area based on background properties
                const sourceArea = {
                    x: (sampleArea.x * scale.x),
                    y: (sampleArea.y * scale.y),
                    width: (sampleArea.width * scale.x),
                    height: (sampleArea.height * scale.y)
                };

                // Draw sampling area to canvas
                ctx.drawImage(
                    img,
                    sourceArea.x, sourceArea.y, sourceArea.width, sourceArea.height,  // Source image area
                    0, 0, sampleSize, sampleSize  // Target canvas area
                );

                try {
                    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
                    const data = imageData.data;
                    let r = 0, g = 0, b = 0;
                    let count = 0;

                    // Calculate the average color of the sampling area
                    for (let x = 0, len = data.length; x < len; x += 4) {
                        r += data[x];
                        g += data[x + 1];
                        b += data[x + 2];
                        count++;
                    }

                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
                    console.log('[WelcomeManager] Sampled area color:', {
                        area: sampleArea,
                        color: { r, g, b },
                        brightness
                    });

                    const textColor = brightness > 128 ?
                        'rgba(51, 51, 51, 0.9)' :
                        'rgba(255, 255, 255, 0.9)';

                    // Update cache and apply color
                    this.colorCache.lastBackground = backgroundImage;
                    this.colorCache.lastTextColor = textColor;
                    element.style.color = textColor;
                    element.style.transition = 'color 0.3s ease';
                } catch (error) {
                    console.error('Failed to analyze background color:', error, {
                        sampleArea,
                        sourceArea
                    });
                    element.style.color = 'rgba(255, 255, 255, 0.9)';
                }
            };

            img.onerror = () => {
                console.error('Background image failed to load');
                if (!this.colorCache.lastTextColor) {
                    // Only set default color if no cached color
                    element.style.color = 'rgba(255, 255, 255, 0.9)';
                }
            };

            // Use white text first while image is loading
            element.style.color = 'rgba(255, 255, 255, 0.9)';
            return;
        }
    },

    // Set event listeners
    setupEventListeners() {
        document.getElementById('welcome-message').addEventListener('click', () => {
            // Use chrome.i18n.getMessage to get localized prompt text
            const newUserName = prompt(chrome.i18n.getMessage("namePrompt"), userName);
            if (newUserName && newUserName.trim() !== "") {
                userName = newUserName.trim();
                localStorage.setItem('userName', userName);
                this.updateWelcomeMessage();
            }
        });

        // Add listener for welcome message content changes
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' || mutation.type === 'characterData') {
                        const currentText = welcomeElement.textContent;
                        // Check if username is missing
                        if (currentText && !currentText.includes(userName) &&
                            (currentText.includes('早上好') || currentText.includes('下午好') || currentText.includes('晚上好'))) {
                            this.updateWelcomeMessage();
                        }
                    }
                });
            });

            observer.observe(welcomeElement, {
                childList: true,
                characterData: true,
                subtree: true
            });
        }
    },

    // Add theme change listener method
    setupThemeChangeListener() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    const welcomeElement = document.getElementById('welcome-message');
                    if (welcomeElement) {
                        this.adjustTextColor(welcomeElement);
                    }
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
};

// Export method for other modules
window.WelcomeManager = WelcomeManager;

// Initialize after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    WelcomeManager.initialize();
    // Update welcome message every minute
    setInterval(() => WelcomeManager.updateWelcomeMessage(), 60000);
});
