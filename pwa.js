/**
 * PWA Install Handler - Optimized for Mobile Browsers
 * Handles all device types: Android Chrome, iOS Safari, Samsung Internet, Firefox, etc.
 */

let deferredPrompt = null;
let installBtn = null;

// Debug function
function addDebugLog(msg) {
    const debugDiv = document.getElementById('pwaDebug');
    const debugMsg = document.getElementById('debugMsg');
    
    if (debugMsg) {
        const timestamp = new Date().toLocaleTimeString();
        debugMsg.innerHTML += `[${timestamp}] ${msg}<br>`;
        
        // Show debug info
        if (debugDiv) {
            debugDiv.style.display = 'block';
        }
    }
    
    console.log(msg);
}

// Get device info
function getDeviceInfo() {
    const ua = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isiOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isChrome = /Chrome/.test(ua) && !/Edge/.test(ua);
    const isSamsung = /SamsungBrowser/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    
    return {
        userAgent: ua.substring(0, 100),
        isMobile,
        isiOS,
        isAndroid,
        isChrome,
        isSamsung,
        isFirefox,
        isSafari
    };
}

// Initialize when DOM is ready
function initPWA() {
    installBtn = document.getElementById('installBtn');
    
    addDebugLog('🚀 PWA Init started');
    
    const device = getDeviceInfo();
    addDebugLog(`📱 Device: ${device.isMobile ? 'MOBILE' : 'DESKTOP'} | Chrome:${device.isChrome} Samsung:${device.isSamsung} Safari:${device.isSafari} FF:${device.isFirefox}`);
    addDebugLog(`🔍 UserAgent: ${device.userAgent}`);
    
    // Setup beforeinstallprompt listener EARLY
    setupBeforeInstallPrompt();
    
    // Register Service Worker
    registerServiceWorker();
    
    // Setup install button and other features after short delay
    setTimeout(() => {
        setupInstallButton();
        setupAppInstalledListener();
        
        // On mobile, show fallback install info if Service Worker is ready
        if (device.isMobile && navigator.serviceWorker.controller) {
            addDebugLog('✅ Mobile device with active Service Worker - ready for install');
        }
    }, 500);
}

// Setup beforeinstallprompt EARLY and globally
function setupBeforeInstallPrompt() {
    window.addEventListener('beforeinstallprompt', function(e) {
        e.preventDefault();
        deferredPrompt = e;
        
        addDebugLog('✅ beforeinstallprompt event FIRED! Installation is available');
        
        if (installBtn) {
            installBtn.style.display = 'block';
            installBtn.disabled = false;
            addDebugLog('✅ Install button shown to user');
        }
    }, { once: false });
}

// Register Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        addDebugLog('✅ Service Worker API available');
        
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(function(registration) {
                    addDebugLog('✅ Service Worker registered successfully');
                    return navigator.serviceWorker.ready;
                })
                .then(function() {
                    addDebugLog('✅ Service Worker is READY for installation');
                })
                .catch(function(error) {
                    addDebugLog('❌ Service Worker registration failed: ' + error.message);
                });
        });
    } else {
        addDebugLog('❌ Service Worker API NOT available');
    }
}

// Setup install button click handler
function setupInstallButton() {
    if (!installBtn) return;
    
    installBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        addDebugLog('📲 Install button CLICKED by user');
        
        if (deferredPrompt) {
            addDebugLog('📲 Showing install prompt...');
            deferredPrompt.prompt();
            
            deferredPrompt.userChoice.then(function(choiceResult) {
                if (choiceResult.outcome === 'accepted') {
                    addDebugLog('✅ User ACCEPTED installation');
                } else {
                    addDebugLog('ℹ️ User DISMISSED installation');
                }
                deferredPrompt = null;
                installBtn.style.display = 'none';
            }).catch(err => {
                addDebugLog('❌ Installation error: ' + err.message);
            });
        } else {
            addDebugLog('⚠️ No deferredPrompt available - showing manual instructions');
            const device = getDeviceInfo();
            if (device.isiOS) {
                showIOSInstructions();
            } else {
                addDebugLog('📚 Showing browser-specific install instructions');
            }
        }
    });
}
// Show iOS installation instructions
function showIOSInstructions() {
   const iosMsg = document.getElementById('iosInstallMsg');
    if (iosMsg) {
        iosMsg.style.display = 'block';
        addDebugLog('✅ iOS install instructions displayed');
    }
}

// Hide install button if app was installed
function setupAppInstalledListener() {
    window.addEventListener('appinstalled', function() {
        addDebugLog('✅ App successfully INSTALLED on device!');
        if (installBtn) {
            installBtn.style.display = 'none';
        }
    });
}

// Initialize when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPWA);
} else {
    initPWA();
}