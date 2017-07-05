chrome.browserAction.onClicked.addListener(function(tab) {
	chrome.tabs.create({url:chrome.extension.getURL("../main.html")});
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('installed');
});

chrome.runtime.onSuspend.addListener(function() { 
  // Do some simple clean-up tasks.
});
