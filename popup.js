document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportBtn');
  const statusDiv = document.getElementById('status');

  exportBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes("perplexity.ai")) {
      statusDiv.textContent = "Error: Please open perplexity.ai first.";
      return;
    }
    chrome.tabs.create({ url: chrome.runtime.getURL(`extract.html?tabId=${tab.id}`) });
    window.close();
  });
});
