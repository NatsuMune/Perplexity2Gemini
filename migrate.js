const logContainer = document.getElementById('log-container');
const currentTask = document.getElementById('current-task');
const progressBar = document.getElementById('progress-bar');
const statProjects = document.getElementById('stat-projects');

function logMsg(msg, type = 'normal') {
  const el = document.createElement('div');
  el.className = 'log-entry';
  if (type === 'success') el.classList.add('success-text');
  if (type === 'error') el.classList.add('error-text');
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logContainer.appendChild(el);
  logContainer.scrollTop = logContainer.scrollHeight;
  currentTask.textContent = msg;
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const tabId = parseInt(params.get('tabId'), 10);
  
  if (!tabId) {
    logMsg("Error: No tab ID provided.", "error");
    return;
  }

  chrome.storage.local.get(['p2gProjects'], async (res) => {
    const projects = res.p2gProjects || [];
    if (projects.length === 0) {
      logMsg("No projects found in storage to migrate.", "error");
      return;
    }
    
    statProjects.textContent = `0 / ${projects.length}`;
    logMsg(`Starting migration for ${projects.length} projects...`);
    
    // Inject the executor script into the Gemini tab
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: performMigration,
        args: [projects]
      });
    } catch (e) {
      logMsg("Failed to inject script: " + e.message, "error");
    }
  });

  // Listen for progress from the injected script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'MIGRATE_LOG') {
      logMsg(msg.message, msg.level);
    } else if (msg.type === 'MIGRATE_PROGRESS') {
      statProjects.textContent = `${msg.current} / ${msg.total}`;
      progressBar.style.width = `${(msg.current / msg.total) * 100}%`;
    }
  });
});

async function performMigration(projects) {
  const log = (msg, level='normal') => {
    chrome.runtime.sendMessage({ type: 'MIGRATE_LOG', message: msg, level });
    updateToast(msg);
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  const waitFor = async (selectorOrFn, timeout = 8000, interval = 200) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const res = typeof selectorOrFn === 'function' ? selectorOrFn() : document.querySelector(selectorOrFn);
      if (res) return res;
      await sleep(interval);
    }
    return null;
  };

  const updateToast = (text) => {
    let toast = document.getElementById('p2g-status-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'p2g-status-toast';
      toast.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#1e1e1e;color:#fff;padding:12px 18px;border-radius:8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.3);border:1px solid #444;max-width:350px;pointer-events:none;transition:all 0.3s ease;';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
  };

  const clickEl = (selector) => {
    const el = document.querySelector(selector);
    if (el) { el.click(); return true; }
    return false;
  };

  const dismissDialog = async () => {
    await sleep(400);
    const dialogs = document.querySelectorAll('mat-dialog-container');
    if (dialogs.length > 0) {
      dialogs.forEach(dialog => {
        const closeBtn = Array.from(dialog.querySelectorAll('button')).find(b => {
          const label = (b.getAttribute('aria-label') || b.innerText || '').toLowerCase();
          return label.includes('close') || b.querySelector('mat-icon[data-mat-icon-name="close"]');
        });
        if (closeBtn) {
          closeBtn.click();
        }
      });
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
  };

  const getThreadButton = async (title) => {
    let btns = Array.from(document.querySelectorAll('button[aria-label^="More options for"]'));
    if (btns.length === 0) {
      const openSidebarBtn = document.querySelector('button[aria-label="Open sidebar"]');
      if (openSidebarBtn && openSidebarBtn.offsetWidth > 0) {
        openSidebarBtn.click();
        await sleep(1000);
        btns = Array.from(document.querySelectorAll('button[aria-label^="More options for"]'));
      }
    }

    return btns.find(b => {
      const label = (b.getAttribute('aria-label') || '').replace("More options for ", "").trim().toLowerCase();
      const cleanTitle = (title || '').trim().toLowerCase();
      if (!cleanTitle || !label) return false;
      const subLen = Math.min(15, cleanTitle.length);
      const sub = cleanTitle.substring(0, subLen);
      return label.includes(sub) || cleanTitle.includes(label.substring(0, subLen));
    });
  };

  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    log(`[Project ${i+1}/${projects.length}] Migrating: ${proj.title}`);
    chrome.runtime.sendMessage({ type: 'MIGRATE_PROGRESS', current: i, total: projects.length });

    // Check if notebook already exists
    const existingNb = Array.from(document.querySelectorAll('a, button')).find(el => {
      const label = (el.getAttribute('aria-label') || el.innerText || '').trim().toLowerCase();
      return label === proj.title.toLowerCase();
    });

    if (existingNb) {
      log(`Notebook "${proj.title}" already exists, proceeding to threads.`);
    } else {
      // 1. Click New Notebook
      const newNbBtn = await waitFor('a[aria-label="New notebook"], button[aria-label="New notebook"]', 3000);
      if (newNbBtn) {
        newNbBtn.click();
      } else {
        clickEl('a[aria-label="Library"]');
        await sleep(1500);
        const retryNewNb = await waitFor('a[aria-label="New notebook"], button[aria-label="New notebook"]', 3000);
        if (retryNewNb) retryNewNb.click();
      }
      log("Opened notebook creator...");

      // 2. Fill Title & Submit
      const titleInput = await waitFor('#project-name-input, input[aria-label="Name of the notebook"]', 6000);
      if (titleInput) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(titleInput, proj.title);
        titleInput.dispatchEvent(new Event('input', { bubbles: true }));
        titleInput.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(600);

        const createBtn = await waitFor('button[aria-label="Create notebook"]', 4000);
        if (createBtn) {
          createBtn.click();
          log(`Created notebook: ${proj.title}`, "success");
        } else {
          const form = titleInput.closest('form');
          if (form && form.requestSubmit) form.requestSubmit();
          log(`Submitted notebook form for: ${proj.title}`);
        }
      } else {
        log("Could not find notebook title input.", "error");
      }
      await sleep(3500); // wait for redirect to notebook view
    }

    // 3. Instructions
    if (proj.instructions) {
      log("Adding notebook instructions...");
      const menuBtn = await waitFor('button[aria-label="Open notebook actions menu"]', 3000);
      if (menuBtn) {
        menuBtn.click();
        await sleep(800);
        
        const settingsOpt = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).find(el => el.innerText.includes('Notebook settings'));
        if (settingsOpt) {
          settingsOpt.click();
          await sleep(1000);
          
          const ta = await waitFor('mat-dialog-container textarea', 4000);
          if (ta) {
            ta.value = proj.instructions;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(500);
            
            const saveBtn = Array.from(document.querySelectorAll('mat-dialog-container button')).find(b => b.innerText.match(/Save/i));
            if (saveBtn) saveBtn.click();
            await sleep(1000);
            log("Saved instructions.", "success");
          }
        }
      }
    }

    // 4. Add Threads
    if (proj.threadTitles && proj.threadTitles.length > 0) {
      log(`Adding ${proj.threadTitles.length} threads to "${proj.title}"...`);
      
      let added = 0;
      for (const tTitle of proj.threadTitles) {
        try {
          const tBtn = await getThreadButton(tTitle);
          if (tBtn) {
            tBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
            tBtn.click();
            await sleep(800);
            
            const menuItems = Array.from(document.querySelectorAll('.mat-mdc-menu-item, [role="menuitem"], button'));
            const addOpt = menuItems.find(el => (el.innerText || '').includes('Add to notebook'));
            if (addOpt) {
              addOpt.click();
              
              const dialog = await waitFor('mat-dialog-container', 4000);
              if (dialog) {
                await sleep(500);
                const listOptions = Array.from(dialog.querySelectorAll('mat-list-option, .mat-mdc-list-item, div[role="option"]'));
                const nbOpt = listOptions.find(o => {
                  const text = (o.innerText || o.textContent || '').trim().toLowerCase();
                  return text.includes(proj.title.toLowerCase());
                });

                if (nbOpt) {
                  nbOpt.click();
                  added++;
                  log(`Added thread to "${proj.title}": ${tTitle.substring(0, 35)}...`, "success");
                  
                  // Wait for dialog to auto-close
                  await waitFor(() => !document.querySelector('mat-dialog-container'), 3000);
                } else {
                  log(`Could not find notebook "${proj.title}" in dialog for: ${tTitle.substring(0, 30)}...`);
                  await dismissDialog();
                }
              }
            } else {
              document.body.click();
              log(`'Add to notebook' option missing for: ${tTitle.substring(0, 30)}...`);
            }
          } else {
            log(`Skipped (already moved or not in Recents): ${tTitle.substring(0, 35)}...`);
          }
        } catch (err) {
          log(`Error adding thread "${tTitle.substring(0, 30)}...": ${err.message}`, "error");
          await dismissDialog();
        }
        await sleep(600);
      }
      log(`Successfully processed threads for "${proj.title}".`, "success");
    }

    await sleep(1500);
  }

  await dismissDialog();
  chrome.runtime.sendMessage({ type: 'MIGRATE_PROGRESS', current: projects.length, total: projects.length });
  log("Migration completed!", "success");
  
  setTimeout(() => {
    const toast = document.getElementById('p2g-status-toast');
    if (toast) toast.remove();
  }, 6000);
}
