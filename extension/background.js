// Use async/await pattern for message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Store the async operation in a variable
    const handleMessage = async () => {
        if (request.action === "startLogin") {
            try {
                const tabs = await chrome.tabs.query({url: "https://students.cuchd.in/*"});
                
                if (tabs.length === 0) {
                    // Create new tab
                    const tab = await chrome.tabs.create({url: "https://students.cuchd.in/"});
                    
                    // Wait for tab to load
                    await new Promise(resolve => {
                        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                            if (tabId === tab.id && info.status === 'complete') {
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        });
                    });
                    
                    // Inject content script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    
                    // Send message
                    await chrome.tabs.sendMessage(tab.id, {action: "autoLogin"});
                    sendResponse({ success: true });
                } else {
                    // Handle existing tab
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ['content.js']
                    });
                    
                    await chrome.tabs.sendMessage(tabs[0].id, {action: "autoLogin"});
                    sendResponse({ success: true });
                }
            } catch (error) {
                console.error('Error:', error);
                sendResponse({ success: false, error: error.message });
            }
        }
    };

    // Execute the async operation
    handleMessage();
    
    // Keep the message channel open
    return true;
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "_execute_action") {
        // Find the CU portal tab
        chrome.tabs.query({url: "https://students.cuchd.in/*"}, function(tabs) {
            if (tabs.length > 0) {
                // If portal is already open, send message to start login
                chrome.tabs.sendMessage(tabs[0].id, {action: "startLogin"});
            } else {
                // If portal isn't open, create new tab and the content script will handle it
                chrome.tabs.create({url: "https://students.cuchd.in/"});
            }
        });
    }
});
  