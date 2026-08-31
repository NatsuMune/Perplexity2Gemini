document.addEventListener('DOMContentLoaded', async () => {
  const exportBtn = document.getElementById('exportBtn');
  const migrateBtn = document.getElementById('migrateBtn');
  const statusDiv = document.getElementById('status');
  
  const viewExtract = document.getElementById('view-extract');
  const viewMigrate = document.getElementById('view-migrate');
  const viewIdle = document.getElementById('view-idle');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url) {
    viewIdle.classList.remove('hidden');
    return;
  }

  if (tab.url.includes("perplexity.ai")) {
    viewExtract.classList.remove('hidden');
  } else if (tab.url.includes("gemini.google.com")) {
    viewMigrate.classList.remove('hidden');
    
    // Check if we have project data saved
    chrome.storage.local.get(['p2gProjects'], (res) => {
      if (!res.p2gProjects || res.p2gProjects.length === 0) {
        statusDiv.textContent = "No project data found. Did you extract from Perplexity first?";
      }
    });
  } else {
    viewIdle.classList.remove('hidden');
  }

  exportBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`extract.html?tabId=${tab.id}`) });
    window.close();
  });
  
  migrateBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL(`migrate.html?tabId=${tab.id}`) });
    window.close();
  });
});
