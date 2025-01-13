document.getElementById('save').addEventListener('click', () => {
    const userid = document.getElementById('userid').value;
    const password = document.getElementById('password').value;
    
    chrome.storage.local.set({
      'cu_userid': userid,
      'cu_password': password
    }, () => {
      alert('Credentials saved!');
    });
  });
  
  document.getElementById('autoLogin').addEventListener('click', () => {
    // Send message to background script instead of directly to content script
    chrome.runtime.sendMessage({action: "startLogin"});
    window.close(); // Close the popup
  });