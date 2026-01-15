document.addEventListener('DOMContentLoaded', () => {
    // Check if WelcomeManager is loaded
    if (!window.WelcomeManager) {
        console.error('WelcomeManager not found. Make sure welcome.js is loaded before wallpaper.js');
    }
    const wallpaperManager = new WallpaperManager();
});

// WallpaperManager class for handling all wallpaper related operations
class WallpaperManager {
    constructor() {
        // Initialize all necessary properties first
        this.uploadInput = document.getElementById('upload-wallpaper');
        this.mainElement = document.querySelector('main');

        // Initialize preset wallpaper list
        this.initializePresetWallpapers();

        // Initialize preload queue
        this.preloadQueue = new Set();
        this.preloadedImages = new Map();

        // Initialize user wallpaper array
        this.userWallpapers = [];

        // Initialize other properties
        this.activeOption = null;

        // Load user wallpapers
        this.loadUserWallpapers();

        // Initialize event listeners and other settings
        this.initializeEventListeners();
        this.initialize();

        // Initialize Bing wallpapers
        this.bingWallpapers = [];
        this.initBingWallpapers();
    }

    // New method: Initialize preset wallpaper list
    initializePresetWallpapers() {
        this.presetWallpapers = [
            {
                url: './../images/wallpapers/wallpaper-1.jpg',
                title: 'Foggy Forest'
            },
            {
                url: './../images/wallpapers/wallpaper-2.jpg',
                title: 'Mountain Lake'
            },
            {
                url: './../images/wallpapers/wallpaper-3.jpg',
                title: 'Sunset Beach'
            },
            {
                url: '../images/wallpapers/wallpaper-4.jpg',
                title: 'City Night'
            },
            {
                url: './../images/wallpapers/wallpaper-5.jpg',
                title: 'Aurora'
            },
            {
                url: './../images/wallpapers/wallpaper-6.jpg',
                title: 'Desert Dunes'
            },
            {
                url: './../images/wallpapers/wallpaper-7.jpg',
                title: 'Mountain View'
            },
            {
                url: './../images/wallpapers/wallpaper-8.jpg',
                title: 'Forest Lake'
            },
            {
                url: './../images/wallpapers/wallpaper-9.jpg',
                title: 'Sunset Hills'
            },
            {
                url: './../images/wallpapers/wallpaper-10.jpg',
                title: 'Ocean View'
            }
        ];
    }

    // Update loadPresetWallpapers method with error handling
    async loadPresetWallpapers() {
        const wallpaperContainer = document.querySelector('.wallpaper-options');
        if (!wallpaperContainer) {
            console.error('Wallpaper container not found');
            return;
        }

        wallpaperContainer.innerHTML = '';

        // Add preset wallpapers
        if (Array.isArray(this.presetWallpapers)) {
            this.presetWallpapers.forEach(preset => {
                const option = this.createWallpaperOption(preset.url, preset.title);
                wallpaperContainer.appendChild(option);
            });
        }

        // Add user uploaded wallpapers
        if (Array.isArray(this.userWallpapers)) {
            this.userWallpapers.forEach(wallpaper => {
                const option = this.createWallpaperOption(
                    wallpaper.url,
                    chrome.i18n.getMessage('uploadedWallpaperBadge'),
                    true
                );
                wallpaperContainer.appendChild(option);
            });
        }
    }

    initialize() {
        this.preloadWallpapers();
        this.loadPresetWallpapers();
        this.initializeWallpaper().then(() => {
            document.documentElement.classList.remove('loading-wallpaper');
        });
    }

    initializeEventListeners() {
        // Initialize upload event listener
        this.uploadInput.addEventListener('change', (event) => this.handleFileUpload(event));

        // Initialize reset button event listener
        const resetButton = document.getElementById('reset-wallpaper');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.resetWallpaper());
        }

        // Add image loading error handling
        window.addEventListener('error', (e) => this.handleImageError(e), true);

        // Add check cache button event listener
        const checkCacheButton = document.getElementById('check-wallpaper-cache');
        if (checkCacheButton) {
            checkCacheButton.addEventListener('click', () => this.checkWallpaperCache());
        }

        // Pure color background option click event
        document.querySelectorAll('.settings-bg-option').forEach(option => {
            option.addEventListener('click', () => {
                this.handleBackgroundOptionClick(option);
            });
        });

        // Wallpaper option click event
        document.querySelectorAll('.wallpaper-option').forEach(option => {
            option.addEventListener('click', () => {
                this.handleWallpaperOptionClick(option);
            });
        });
    }

    handleBackgroundOptionClick(option) {
        // Remove active state from all options
        this.clearAllActiveStates();

        // Set current option as active
        option.classList.add('active');
        this.activeOption = option;

        // Apply pure color background
        const bgClass = option.getAttribute('data-bg');
        // Check if dark mode
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDarkMode) {
            // Keep dark background in dark mode
            document.documentElement.className = bgClass;
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.className = bgClass;
        }

        // Clear wallpaper
        this.clearWallpaper();
        localStorage.setItem('useDefaultBackground', 'true');

        // Update welcome message color
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement && window.WelcomeManager) {
            window.WelcomeManager.adjustTextColor(welcomeElement);
        }
    }

    handleWallpaperOptionClick(option) {
        // Remove active state from all options
        this.clearAllActiveStates();

        // Set current option as active
        option.classList.add('active');
        this.activeOption = option;

        // Apply wallpaper
        const wallpaperUrl = option.getAttribute('data-wallpaper-url');
        this.setWallpaper(wallpaperUrl);

        // Clear pure color background
        document.documentElement.className = '';
        localStorage.removeItem('useDefaultBackground');
    }

    clearAllActiveStates() {
        // Clear active state of all pure color background options
        document.querySelectorAll('.settings-bg-option').forEach(option => {
            option.classList.remove('active');
        });

        // Clear active state of all wallpaper options
        document.querySelectorAll('.wallpaper-option').forEach(option => {
            option.classList.remove('active');
        });
        // Clear active state of all Bing wallpaper options
        document.querySelectorAll('.bing-wallpaper-item').forEach(option => {
            option.classList.remove('active');
        });
    }

    // Optimize preload method
    preloadWallpapers() {
        this.presetWallpapers.forEach(preset => {
            if (!this.preloadedImages.has(preset.url)) {
                const img = new Image();
                img.src = preset.url;
                this.preloadQueue.add(preset.url);

                img.onload = () => {
                    this.preloadedImages.set(preset.url, img);
                    this.preloadQueue.delete(preset.url);
                };
            }
        });
    }

    // Initialize wallpaper state
    async initializeWallpaper() {
        const savedWallpaper = localStorage.getItem('originalWallpaper');
        const useDefaultBackground = localStorage.getItem('useDefaultBackground');
        const savedBg = localStorage.getItem('selectedBackground');
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';

        // Clear all selected states
        this.clearAllActiveStates();

        if (useDefaultBackground === 'true') {
            // If using pure color background, activate corresponding option
            const bgClass = savedBg || 'gradient-background-7';
            const bgOption = document.querySelector(`.settings-bg-option[data-bg="${bgClass}"]`);

            if (bgOption) {
                bgOption.classList.add('active');
                this.activeOption = bgOption;
                // Keep dark background in dark mode
                if (isDarkMode) {
                    document.documentElement.className = bgClass;
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.className = bgClass;
                }
            }
            return;
        }

        if (savedWallpaper) {
            // If using wallpaper, find corresponding option (including user uploaded wallpapers)
            let wallpaperOption = document.querySelector(`.wallpaper-option[data-wallpaper-url="${savedWallpaper}"]`);

            // If option not found, it might be a user uploaded wallpaper
            if (!wallpaperOption) {
                // Reload wallpaper options
                await this.loadPresetWallpapers();
                wallpaperOption = document.querySelector(`.wallpaper-option[data-wallpaper-url="${savedWallpaper}"]`);
            }

            if (wallpaperOption) {
                wallpaperOption.classList.add('active');
                this.activeOption = wallpaperOption;
            }

            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.applyWallpaper(savedWallpaper);
                    resolve();
                };
                img.onerror = resolve;
                img.src = savedWallpaper;
            });
        } else {
            // If no saved wallpaper and background, use default background
            const defaultBgOption = document.querySelector('.settings-bg-option[data-bg="gradient-background-7"]');
            if (defaultBgOption) {
                defaultBgOption.classList.add('active');
                this.activeOption = defaultBgOption;
                document.documentElement.className = 'gradient-background-7';
                localStorage.setItem('useDefaultBackground', 'true');
                localStorage.setItem('selectedBackground', 'gradient-background-7');
            }
        }
    }

    // Reset wallpaper
    resetWallpaper() {
        // Clear all selected states
        this.clearAllActiveStates();
        this.clearWallpaper();

        // Set default background
        const defaultBgOption = document.querySelector('.settings-bg-option[data-bg="gradient-background-7"]');
        if (defaultBgOption) {
            defaultBgOption.classList.add('active');
            this.activeOption = defaultBgOption;
            document.documentElement.className = 'gradient-background-7';
            // Save default background settings
            localStorage.setItem('useDefaultBackground', 'true');
            localStorage.setItem('selectedBackground', 'gradient-background-7');
        }

        // Use localized success tip
        alert(chrome.i18n.getMessage('wallpaperResetSuccess'));
    }

    // Clear wallpaper styles
    clearWallpaper() {
        document.body.classList.remove('has-wallpaper');
        document.body.style.removeProperty('--wallpaper-image');
        document.body.style.backgroundImage = 'none';
        this.mainElement.style.backgroundImage = 'none';
    }

    // Update apply wallpaper method
    applyWallpaper(url) {
        const backgroundStyle = {
            backgroundImage: `url("${url}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
        };

        // Use requestAnimationFrame to ensure style updates are executed in next frame
        requestAnimationFrame(() => {
            document.body.classList.add('has-wallpaper');
            document.body.style.setProperty('--wallpaper-image', `url("${url}")`);
            Object.assign(this.mainElement.style, backgroundStyle);
            Object.assign(document.body.style, backgroundStyle);

            // Update welcome message color
            const welcomeElement = document.getElementById('welcome-message');
            if (welcomeElement && window.WelcomeManager) {
                window.WelcomeManager.adjustTextColor(welcomeElement);
            }
        });
    }

    // Set new wallpaper
    async setWallpaper(url) {
        if (!url) return;

        try {
            // If Unsplash image, add optimization parameters
            if (url.includes('images.unsplash.com')) {
                url = `${url}?q=80&w=1920&auto=format&fit=crop`;
            }

            localStorage.removeItem('useDefaultBackground');
            document.querySelectorAll('.settings-bg-option').forEach(option => {
                option.classList.remove('active');
            });
            document.documentElement.className = '';
            await this.applyAndSaveWallpaper(url);
        } catch (error) {
            console.error('Failed to set wallpaper:', error);
            alert('Failed to set wallpaper, please try again');
        }
    }

    // Update applyAndSaveWallpaper method
    async applyAndSaveWallpaper(dataUrl) {
        try {
            // Clear all relevant storage before saving new wallpaper
            this.clearWallpaperCache();

            // Compress image data to reduce storage size
            const compressedDataUrl = await this.compressImageForStorage(dataUrl);

            try {
                // Try to save compressed data
                localStorage.setItem('originalWallpaper', compressedDataUrl);
            } catch (storageError) {
                console.warn('Unable to save wallpaper to local storage, will only keep in memory');
            }

            // Update memory cache
            if (this.wallpaperCache) {
                URL.revokeObjectURL(this.wallpaperCache.src);
                this.wallpaperCache.src = '';
            }
            this.wallpaperCache = new Image();
            this.wallpaperCache.src = dataUrl;

            // Apply wallpaper
            await this.applyWallpaper(dataUrl);
        } catch (error) {
            console.error('Failed to save wallpaper:', error);
            alert('Failed to set wallpaper, please try again');
        }
    }

    // Add new method: Compress image data
    async compressImageForStorage(dataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate compressed dimensions, max width 1920px
                const maxWidth = 1920;
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Use lower quality to reduce data size
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 1);

                // Clear memory
                URL.revokeObjectURL(img.src);
                resolve(compressedDataUrl);
            };
            img.src = dataUrl;
        });
    }

    // Create thumbnail
    createThumbnail(dataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const thumbnailSize = { width: 200, height: 200 };

            canvas.width = thumbnailSize.width;
            canvas.height = thumbnailSize.height;
            ctx.drawImage(img, 0, 0, thumbnailSize.width, thumbnailSize.height);

            const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(thumbnailDataUrl);
        };
        img.src = dataUrl;
    }

    // Handle file upload
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!this.validateFile(file)) return;

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                const compressedDataUrl = await this.compressImageForStorage(e.target.result);

                // Save to user wallpaper list
                this.userWallpapers.unshift({
                    url: compressedDataUrl,
                    title: 'Custom Wallpaper',
                    timestamp: Date.now()
                });

                // Modify limit count, e.g. to 10 photos
                const MAX_WALLPAPERS = 1;
                if (this.userWallpapers.length > MAX_WALLPAPERS) {
                    // Delete oldest wallpaper
                    const removedWallpapers = this.userWallpapers.splice(MAX_WALLPAPERS);
                    // Clear resources of deleted wallpapers
                    removedWallpapers.forEach(wallpaper => {
                        if (wallpaper.url) {
                            URL.revokeObjectURL(wallpaper.url);
                        }
                    });
                }

                // Save to localStorage
                try {
                    localStorage.setItem('userWallpapers', JSON.stringify(this.userWallpapers));
                } catch (storageError) {
                    console.warn('Storage quota exceeded, removing oldest wallpapers');
                    // If storage fails, continue deleting old wallpapers until storage is possible
                    while (this.userWallpapers.length > 1) {
                        this.userWallpapers.pop();
                        try {
                            localStorage.setItem('userWallpapers', JSON.stringify(this.userWallpapers));
                            break;
                        } catch (e) {
                            continue;
                        }
                    }
                }

                await this.loadPresetWallpapers();
                await this.setWallpaper(compressedDataUrl);

            } catch (error) {
                console.error('Error processing wallpaper:', error);
                alert('Failed to set wallpaper, please try again');
            }
        };
        reader.onerror = () => alert(chrome.i18n.getMessage('fileReadError'));
        reader.readAsDataURL(file);

        event.target.value = '';
    }

    // Validate uploaded file
    validateFile(file) {
        if (!file) return false;
        if (!file.type.startsWith('image/')) {
            alert(chrome.i18n.getMessage('pleaseUploadImage'));
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert(chrome.i18n.getMessage('imageSizeExceeded'));
            return false;
        }
        return true;
    }

    // Get max screen resolution
    getMaxScreenResolution() {
        const pixelRatio = window.devicePixelRatio || 1;
        let maxWidth = window.screen.width;
        let maxHeight = window.screen.height;

        // Set base resolution to 1920x1080
        const baseWidth = 1920;
        const baseHeight = 1080;

        // If high DPI screen, increase resolution appropriately but not exceeding 2K
        if (pixelRatio > 1) {
            maxWidth = Math.min(maxWidth * pixelRatio, 2560);
            maxHeight = Math.min(maxHeight * pixelRatio, 1440);
        }

        // Return smaller value: actual resolution or base resolution
        return {
            width: Math.min(maxWidth, baseWidth),
            height: Math.min(maxHeight, baseHeight)
        };
    }

    // Calculate max file size
    calculateMaxFileSize() {
        const maxResolution = this.getMaxScreenResolution();
        const pixelCount = maxResolution.width * maxResolution.height;
        const baseSize = pixelCount * 4; // 4 bytes per pixel (RGBA)

        // Simplify compression ratio
        let compressionRatio = 0.7; // Default 70% quality
        if (pixelCount > 1920 * 1080) {
            compressionRatio = 0.5; // Higher resolution use 50% quality
        }

        // Limit final file size between 2MB and 5MB
        const maxSize = Math.round(baseSize * compressionRatio);
        return Math.min(Math.max(maxSize, 2 * 1024 * 1024), 5 * 1024 * 1024);
    }

    // Compress and set wallpaper
    compressAndSetWallpaper(img, maxResolution) {
        // Generate and show low quality preview first
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d');
        const previewWidth = Math.round(img.width * 0.1);
        const previewHeight = Math.round(img.height * 0.1);

        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;
        previewCtx.drawImage(img, 0, 0, previewWidth, previewHeight);

        // Show blurred preview
        const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.5);
        this.setWallpaper(previewUrl);

        // Then asynchronously process high quality version
        requestAnimationFrame(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Keep aspect ratio
            const ratio = Math.min(
                maxResolution.width / img.width,
                maxResolution.height / img.height
            );

            const width = Math.round(img.width * ratio);
            const height = Math.round(img.height * ratio);

            canvas.width = width;
            canvas.height = height;

            // Use better image smoothing algorithm
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, width, height);

            // Use higher compression quality
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            this.setWallpaper(compressedDataUrl);
        });
    }

    // Handle image loading error
    handleImageError(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'IMAGE') {
            console.error('Image failed to load:', e.target.src);
            if (e.target.src !== this.defaultWallpaper) {
                this.setWallpaper(this.defaultWallpaper);
            }
        }
    }

    // Add new method: Create wallpaper option element
    createWallpaperOption(url, title, isUploaded = false) {
        const option = document.createElement('div');
        option.className = 'wallpaper-option';
        option.dataset.wallpaperUrl = url;
        option.title = title;
        option.style.backgroundImage = `url('${url}')`;

        // If it's an uploaded wallpaper, add label
        if (isUploaded) {
            const badge = document.createElement('span');
            badge.className = 'uploaded-wallpaper-badge';
            badge.textContent = chrome.i18n.getMessage('uploadedWallpaperBadge');
            option.appendChild(badge);
        }

        option.addEventListener('click', () => {
            document.querySelectorAll('.settings-bg-option').forEach(opt => {
                opt.classList.remove('active');
            });
            document.querySelectorAll('.wallpaper-option').forEach(opt => {
                opt.classList.remove('active');
            });
            option.classList.add('active');
            document.documentElement.className = '';
            this.setWallpaper(url);
        });

        return option;
    }

    // New: Generate thumbnail method
    generateThumbnail(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Calculate appropriate thumbnail dimensions
                const maxSize = 150; // Smaller thumbnail size
                const ratio = Math.min(maxSize / img.width, maxSize / img.height);
                const width = Math.round(img.width * ratio);
                const height = Math.round(img.height * ratio);

                canvas.width = width;
                canvas.height = height;
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // Use webp format (if browser supports it)
                if (this.supportsWebP()) {
                    resolve(canvas.toDataURL('image/webp', 0.8));
                } else {
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                }
            };

            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    // Check WebP support
    supportsWebP() {
        const canvas = document.createElement('canvas');
        return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }

    // Add clear cache method
    clearWallpaperCache() {
        if (this.wallpaperCache) {
            URL.revokeObjectURL(this.wallpaperCache.src);
            this.wallpaperCache.src = '';
            this.wallpaperCache = null;
        }

        localStorage.removeItem('originalWallpaper');
        localStorage.removeItem('selectedWallpaper');
        localStorage.removeItem('wallpaperThumbnail');
        // Do not clear user wallpaper list
        // localStorage.removeItem('userWallpapers');
    }

    // Add load online wallpapers method
    loadOnlineWallpapers() {
        const container = document.querySelector('.wallpaper-options-container');
        if (!container) return;

        this.onlineWallpapers.forEach(wallpaper => {
            const option = document.createElement('div');
            option.className = 'wallpaper-option';
            option.setAttribute('data-wallpaper-url', wallpaper.url);

            // Create thumbnail
            const img = document.createElement('img');
            img.src = wallpaper.thumbnail;
            img.alt = 'Online Wallpaper';
            img.className = 'wallpaper-thumbnail';

            option.appendChild(img);
            container.appendChild(option);

            // Add click event
            option.addEventListener('click', () => {
                this.setWallpaper(wallpaper.url);
            });
        });
    }

    // Add new method: Load user wallpapers
    loadUserWallpapers() {
        try {
            const savedWallpapers = localStorage.getItem('userWallpapers');
            if (savedWallpapers) {
                this.userWallpapers = JSON.parse(savedWallpapers);
                // Validate each wallpaper
                this.userWallpapers = this.userWallpapers.filter(wallpaper => {
                    return wallpaper && wallpaper.url && typeof wallpaper.url === 'string';
                });
                // Update localStorage
                localStorage.setItem('userWallpapers', JSON.stringify(this.userWallpapers));
            }
        } catch (error) {
            console.error('Failed to load user wallpapers:', error);
            this.userWallpapers = [];
        }
    }

    // Update getLocalizedMessage method to support parameters
    getLocalizedMessage(key, fallback, substitutions = []) {
        try {
            const message = chrome.i18n.getMessage(key, substitutions);
            return message || fallback;
        } catch (error) {
            console.warn(`Failed to get localized message for key: ${key}`, error);
            if (substitutions.length > 0) {
                // If there are replacement parameters, manually replace placeholders in fallback
                return fallback.replace(/\$1/g, substitutions[0])
                    .replace(/\$2/g, substitutions[1]);
            }
            return fallback;
        }
    }

    // Update file read resolution warning code
    handleFileRead(e, file, maxSize) {
        const img = new Image();
        img.onload = () => {
            const maxResolution = this.getMaxScreenResolution();

            if (img.width < maxResolution.width || img.height < maxResolution.height) {
                // Pass resolution parameters
                const warning = this.getLocalizedMessage(
                    'lowResolutionWarning',
                    `Image resolution too low, suggest using at least ${maxResolution.width}x${maxResolution.height} for best results`,
                    [maxResolution.width.toString(), maxResolution.height.toString()]
                );
                alert(warning);
            }

            try {
                if (file.size <= maxSize) {
                    this.setWallpaper(e.target.result);
                } else {
                    this.compressAndSetWallpaper(img, maxResolution);
                }
            } catch (error) {
                console.error('Error processing wallpaper:', error);
                alert(this.getLocalizedMessage('wallpaperSetError', 'Failed to set wallpaper, please try again'));
            } finally {
                URL.revokeObjectURL(img.src);
            }
        };
        img.onerror = () => {
            alert(this.getLocalizedMessage('imageLoadError', 'Image failed to load, please try another image'));
            URL.revokeObjectURL(img.src);
        };
        img.src = e.target.result;
    }

    // Initialize Bing wallpapers
    async initBingWallpapers() {
        try {
            // Get Bing wallpapers
            const wallpapers = await this.fetchBingWallpapers(4);
            this.bingWallpapers = wallpapers;

            // Render wallpapers
            this.renderBingWallpapers();
        } catch (error) {
            console.error('Failed to initialize Bing wallpapers:', error);
        }
    }

    // Get Bing wallpapers
    async fetchBingWallpapers(count = 4) {
        try {
            // Use Chinese Bing API, add UHD parameter for high-def wallpaper
            const response = await fetch(
                `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=${count}&mkt=zh-CN&uhd=1&uhdwidth=3840&uhdheight=2160`
            );
            const data = await response.json();

            if (!data?.images) {
                console.error('No images data in response');
                return [];
            }

            // Use destructuring and arrow functions to simplify code
            return data.images.map(({ url, title, copyright, startdate }) => ({
                // Use Chinese Bing domain
                url: `https://cn.bing.com${url}`,
                title: title || copyright?.split('(')[0]?.trim() || 'Bing Wallpaper',
                copyright,
                date: startdate
            }));
        } catch (error) {
            console.error('Failed to fetch Bing wallpapers:', error);
            return [];
        }
    }

    // Render Bing wallpapers
    renderBingWallpapers() {
        const container = document.querySelector('.bing-wallpapers-grid');
        if (!container) return;

        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        this.bingWallpapers.forEach(wallpaper =>
            fragment.appendChild(this.createBingWallpaperElement(wallpaper))
        );
        container.appendChild(fragment);
    }

    // Create Bing wallpaper element
    createBingWallpaperElement(wallpaper) {
        const { url, title, date } = wallpaper;
        const element = document.createElement('div');
        element.className = 'bing-wallpaper-item';
        element.setAttribute('data-wallpaper-url', url);
        element.title = title;
        element.innerHTML = `
            <div class="bing-wallpaper-thumbnail" style="background-image: url(${url})"></div>
            <div class="bing-wallpaper-info">
                <div class="bing-wallpaper-title">${title}</div>
                <div class="bing-wallpaper-date">${this.formatDate(date)}</div>
            </div>
        `;

        // Modify click event, use handleWallpaperOptionClick
        element.addEventListener('click', () => {
            this.handleWallpaperOptionClick(element);
        });

        return element;
    }

    // Format date
    formatDate(dateStr) {
        try {
            const year = dateStr.slice(0, 4);
            const month = parseInt(dateStr.slice(4, 6));
            const day = parseInt(dateStr.slice(6, 8));
            const date = new Date(year, month - 1, day);
            return `${month}/${day}`;
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateStr;
        }
    }
}

function optimizeMemoryUsage(img) {
    // Release original image memory after compression
    const url = img.src;
    img.onload = null;
    img.src = '';
    URL.revokeObjectURL(url);
}