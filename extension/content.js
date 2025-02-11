function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[CU-Extension ${timestamp}] ${message}`;
    
    // Log to console
    if (data) {
        console.log(logMessage, data);
    } else {
        console.log(logMessage);
    }
    
    // Comment out visual debug overlay
    /*
    const debugDiv = document.getElementById('cu-extension-debug') || createDebugOverlay();
    debugDiv.innerHTML += `<div>${logMessage}</div>`;
    */
}

// Comment out entire createDebugOverlay function since it's not needed
/*
function createDebugOverlay() {
    const div = document.createElement('div');
    div.id = 'cu-extension-debug';
    div.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 300px;
        max-height: 200px;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 10px;
        font-family: monospace;
        font-size: 12px;
        z-index: 9999;
        border-radius: 5px;
    `;
    document.body.appendChild(div);
    return div;
}
*/

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForElement(selector, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const element = document.querySelector(selector);
        if (element) return element;
        await sleep(500);
    }
    throw new Error(`Element ${selector} not found after ${maxAttempts} attempts`);
}

async function simulateClick(element) {
    if (!element) return false;
    
    // Try multiple click methods
    try {
        element.click();
        element.dispatchEvent(new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        }));
        return true;
    } catch (error) {
        console.error('Click simulation failed:', error);
        return false;
    }
}

async function getCaptchaText() {
    try {
        const captchaImg = document.querySelector('#imgCaptcha');
        if (!captchaImg) {
            throw new Error('Captcha image not found');
        }

        debugLog('Capturing captcha image...');

        // Create a canvas element
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas dimensions to match the captcha image
        canvas.width = captchaImg.width;
        canvas.height = captchaImg.height;

        // Draw the captcha image onto the canvas
        ctx.drawImage(captchaImg, 0, 0);

        // Get image data for processing
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const imageDataArray = imageData.data;

        // Improved preprocessing: Apply a Gaussian blur
        ctx.filter = 'blur(1px)';
        ctx.drawImage(canvas, 0, 0);

        // Simple thresholding for better contrast
        for (let i = 0; i < imageDataArray.length; i += 4) {
            const avg = (imageDataArray[i] + imageDataArray[i + 1] + imageDataArray[i + 2]) / 3; // Average for grayscale
            const threshold = 128; // Adjust this value as needed
            const value = avg < threshold ? 0 : 255; // Binary thresholding
            imageDataArray[i] = value;     // Red
            imageDataArray[i + 1] = value; // Green
            imageDataArray[i + 2] = value; // Blue
        }

        // Put the processed image data back to the canvas
        ctx.putImageData(imageData, 0, 0);

        // Get the processed image data
        const processedImageData = canvas.toDataURL('image/png');

        debugLog('Sending processed captcha image to backend for processing...');
        debugLog('Processed Image Data:', processedImageData); // Log the image data

        const response = await fetch('https://cuims-backend-a7801b8625f2.herokuapp.com/process_captcha', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: processedImageData })
        });

        const data = await response.json();
        debugLog('Received response from backend:', data);

        if (data.error) {
            throw new Error(data.error);
        } else {
            debugLog('Captcha text received:', data.captcha);
            return data.captcha;
        }
    } catch (error) {
        console.error('Error in getCaptchaText:', error);
        throw error;
    }
}

// Add a URL change detector
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        debugLog('URL changed to: ' + url);
        onUrlChange();
    }
}).observe(document, { subtree: true, childList: true });

// Handle URL changes
async function onUrlChange() {
    debugLog('Checking page state after URL change');
    const passwordField = document.querySelector('#txtLoginPassword');
    
    if (passwordField) {
        debugLog('Password page detected, continuing login process');
        // Continue with login process automatically
        const data = await chrome.storage.local.get(['cu_userid', 'cu_password']);
        if (data.cu_password) {
            continueWithPasswordPage(data.cu_password);
        }
    }
}

// Separate password page handling
async function continueWithPasswordPage(password) {
    try {
        debugLog('Continuing with password page');
        await sleep(1000); // Wait for page to stabilize

        const pwField = await waitForElement('#txtLoginPassword');
        pwField.value = password;
        pwField.dispatchEvent(new Event('input', { bubbles: true }));
        pwField.dispatchEvent(new Event('change', { bubbles: true }));
        debugLog('✓ Filled password');
        
        // Handle captcha
        try {
            debugLog('Processing captcha...');
            const captchaText = await getCaptchaText();
            debugLog('Captcha text: ' + captchaText);
            
            const captchaField = await waitForElement('#txtcaptcha');
            captchaField.value = captchaText;
            captchaField.dispatchEvent(new Event('input', { bubbles: true }));
            captchaField.dispatchEvent(new Event('change', { bubbles: true }));
            debugLog('✓ Filled captcha');
            
            await sleep(1000);

            const loginButton = await waitForElement('#btnLogin');
            await simulateClick(loginButton);
            debugLog('✓ Clicked login button');
            
        } catch (error) {
            debugLog('❌ Captcha processing failed: ' + error.message);
            throw error;
        }
    } catch (error) {
        debugLog('❌ Error in password page handling: ' + error.message);
        throw error;
    }
}

// Modified autoLogin function
async function autoLogin() {
    try {
        debugLog('Starting auto login process...');
        const data = await chrome.storage.local.get(['cu_userid', 'cu_password']);
        
        if (!data.cu_userid || !data.cu_password) {
            debugLog('❌ Credentials not found');
            throw new Error('Credentials not found. Please save them first.');
        }

        debugLog('✓ Credentials found');
        
        // Check which page we're on
        const passwordField = document.querySelector('#txtLoginPassword');
        const useridField = document.querySelector('#txtUserId');
        
        if (useridField) {
            // We're on the first page
            debugLog('On UserID page');
            useridField.value = data.cu_userid;
            useridField.dispatchEvent(new Event('input', { bubbles: true }));
            useridField.dispatchEvent(new Event('change', { bubbles: true }));
            debugLog('✓ Filled UserID');
            
            const nextButton = await waitForElement('#btnNext');
            await simulateClick(nextButton);
            debugLog('✓ Clicked next button');
            // The URL change observer will handle the password page
        } else if (passwordField) {
            // Already on password page
            await continueWithPasswordPage(data.cu_password);
        } else {
            debugLog('❌ Could not determine page state');
            throw new Error('Could not determine which page we are on');
        }
        
    } catch (error) {
        debugLog('❌ Error in autoLogin: ' + error.message);
        throw error;
    }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "autoLogin") {
        console.log('Received autoLogin request');
        autoLogin().then(() => {
            sendResponse({ success: true });
        }).catch((error) => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }
});

// Add keyboard shortcut message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startLogin") {
        debugLog('Login triggered by keyboard shortcut');
        autoLogin().catch(error => {
            debugLog('❌ Keyboard shortcut login failed: ' + error.message);
        });
    }
});

// You can also add direct keyboard listener as backup
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        debugLog('Login triggered by keyboard shortcut (direct)');
        autoLogin().catch(error => {
            debugLog('❌ Keyboard shortcut login failed: ' + error.message);
        });
    }
});

// Debug helper
function logElementStates() {
    const elements = {
        'UserID field': '#txtUserId',
        'Next button': '#btnNext',
        'Password field': '#txtLoginPassword',
        'Captcha field': '#txtcaptcha',
        'Login button': '#btnLogin'
    };

    debugLog('Current page state:');
    for (const [name, selector] of Object.entries(elements)) {
        const element = document.querySelector(selector);
        if (element) {
            debugLog(`${name}: ✓ Found (${element.tagName}, ${element.type || 'no type'})`);
            debugLog(`Value: "${element.value}"`);
        } else {
            debugLog(`${name}: ❌ Not found`);
        }
    }
}

// Comment out the periodic debug logging
/*
setInterval(logElementStates, 2000);
*/

// Notify that content script is loaded
console.log('Content script loaded successfully');

// Auto-start function that runs when the page loads
async function autoStart() {
    debugLog('Auto-starting login process...');
    
    // Wait a bit for the page to be fully loaded
    await sleep(1000);
    
    // Check if we're on the login page
    if (window.location.href.includes('students.cuchd.in')) {
        debugLog('On CU student portal, starting auto login');
        autoLogin().catch(error => {
            debugLog('❌ Auto-start failed: ' + error.message);
        });
    }
}

// Run autoStart when the script loads
document.addEventListener('DOMContentLoaded', autoStart);
// Also run it immediately in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    autoStart();
}