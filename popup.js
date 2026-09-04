document.addEventListener('DOMContentLoaded', async () => {
  const exportBtn = document.getElementById('exportBtn');
  const migrateBtn = document.getElementById('migrateBtn');
  const statusDiv = document.getElementById('status');
  
  const viewExtract = document.getElementById('view-extract');
  const viewMigrate = document.getElementById('view-migrate');
  const viewIdle = document.getElementById('view-idle');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  const tabUrl = (tab && tab.url) ? tab.url : '';
  if (!tabUrl.includes("perplexity.ai") && !tabUrl.includes("gemini.google.com")) {
    const geminiTabs = await chrome.tabs.query({ url: "*://gemini.google.com/*" });
    if (geminiTabs && geminiTabs.length > 0) {
      tab = geminiTabs[0];
    } else {
      const perplexityTabs = await chrome.tabs.query({ url: "*://*.perplexity.ai/*" });
      if (perplexityTabs && perplexityTabs.length > 0) {
        tab = perplexityTabs[0];
      }
    }
  }

  const effectiveUrl = (tab && tab.url) ? tab.url : '';
  if (!effectiveUrl) {
    viewIdle.classList.remove('hidden');
    return;
  }

  if (effectiveUrl.includes("perplexity.ai")) {
    viewExtract.classList.remove('hidden');
  } else if (effectiveUrl.includes("gemini.google.com")) {
    viewMigrate.classList.remove('hidden');
    
    const projectListContainer = document.getElementById('projectListContainer');
    
    // Check if we have project data saved
    chrome.storage.local.get(['p2gProjects'], (res) => {
      const projects = res.p2gProjects || [];
      if (projects.length === 0) {
        statusDiv.textContent = "No project data found. Did you extract from Perplexity first?";
        return;
      }
      
      projectListContainer.innerHTML = '';
      projectListContainer.classList.remove('hidden');

      projects.forEach(proj => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'project-item';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'project-title';
        const threadCount = proj.threadTitles ? proj.threadTitles.length : 0;
        titleDiv.textContent = `📁 ${proj.title} (${threadCount} thread${threadCount === 1 ? '' : 's'})`;
        itemDiv.appendChild(titleDiv);

        if (proj.threadTitles && proj.threadTitles.length > 0) {
          const ul = document.createElement('ul');
          ul.className = 'project-threads';
          proj.threadTitles.forEach(tTitle => {
            const li = document.createElement('li');
            li.className = 'project-thread-item';
            li.textContent = `• ${tTitle}`;
            li.title = tTitle; // hover tooltip for full title
            ul.appendChild(li);
          });
          itemDiv.appendChild(ul);
        }

        projectListContainer.appendChild(itemDiv);
      });
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
