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
  const log = (msg, level='normal') => chrome.runtime.sendMessage({ type: 'MIGRATE_LOG', message: msg, level });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  const clickEl = (selector) => {
    const el = document.querySelector(selector);
    if (el) { el.click(); return true; }
    return false;
  };

  const selectNotebookOption = (nbOpt) => {
    if (!nbOpt) return;
    nbOpt.focus();
    nbOpt.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
    nbOpt.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

    const inner = nbOpt.querySelector('.option-content') || nbOpt.querySelector('.mdc-list-item__content') || nbOpt;
    inner.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    inner.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    inner.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    inner.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };

  const dismissDialog = async () => {
    await sleep(600);
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

  const getThreadButton = (title) => {
    // If sidebar is collapsed, open it
    const openSidebarBtn = document.querySelector('button[aria-label="Open sidebar"]');
    if (openSidebarBtn && openSidebarBtn.offsetWidth > 0 && window.getComputedStyle(openSidebarBtn).display !== 'none') {
      openSidebarBtn.click();
    }

    const btns = Array.from(document.querySelectorAll('button[aria-label^="More options for"]'));
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

    // 1. Go to Library if not there
    if (!clickEl('a[aria-label="Library"]')) {
      log("Could not find Library button, assuming already in Library or layout changed.");
    }
    await sleep(2000);

    // 2. Click New Notebook
    if (!clickEl('a[aria-label="New notebook"]')) {
      log("Could not find New notebook button! Ensure Library is open.", "error");
      continue;
    }
    log("Opened notebook creator...");
    await sleep(3000); // wait for notebook to load

    // 3. Fill Title & Submit
    const titleInput = document.querySelector('input[aria-label="Name of the notebook"]') || document.querySelector('#project-name-input');
    if (titleInput) {
      titleInput.value = proj.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(500);

      // Click the visible Create Notebook button
      const btns = Array.from(document.querySelectorAll('button'));
      const createBtn = btns.find(b => {
        const isCreate = b.getAttribute('aria-label') === 'Create notebook' || b.innerText.trim() === 'Create notebook';
        const isVis = b.offsetWidth > 0 && b.offsetHeight > 0 && window.getComputedStyle(b).display !== 'none';
        return isCreate && isVis;
      });

      if (createBtn) {
        createBtn.click();
        log(`Created notebook: ${proj.title}`);
      } else {
        const form = titleInput.closest('form');
        if (form && form.requestSubmit) form.requestSubmit();
        log(`Submitted notebook form for: ${proj.title}`);
      }
    } else {
      log("Could not find notebook title input.", "error");
    }
    await sleep(4000); // wait for save and redirect to notebook view

    // 4. Instructions
    if (proj.instructions) {
      log("Adding notebook instructions...");
      // Click open notebook actions menu
      const menuBtns = Array.from(document.querySelectorAll('button[aria-label="Open notebook actions menu"]'));
      if (menuBtns.length > 0) {
        menuBtns[0].click();
        await sleep(1000);
        
        // Click Notebook settings
        const settingsOpt = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).find(el => el.innerText.includes('Notebook settings'));
        if (settingsOpt) {
          settingsOpt.click();
          await sleep(1000);
          
          // Fill textarea
          const ta = document.querySelector('mat-dialog-container textarea');
          if (ta) {
            ta.value = proj.instructions;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            await sleep(500);
            
            // Click Save
            const saveBtn = Array.from(document.querySelectorAll('mat-dialog-container button')).find(b => b.innerText.match(/Save/i));
            if (saveBtn) saveBtn.click();
            await sleep(1000);
            log("Saved instructions.", "success");
          } else {
            log("Could not find instructions textarea in settings dialog.");
          }
        } else {
          log("Could not find 'Notebook settings' in menu.");
        }
      }
    }

    // 5. Add Threads
    if (proj.threadTitles && proj.threadTitles.length > 0) {
      log(`Adding ${proj.threadTitles.length} threads to "${proj.title}"...`);
      
      // Expand sidebar or click Library
      const openSidebarBtn = document.querySelector('button[aria-label="Open sidebar"]');
      if (openSidebarBtn && openSidebarBtn.offsetWidth > 0) {
        openSidebarBtn.click();
        await sleep(800);
      }

      let added = 0;
      for (const tTitle of proj.threadTitles) {
        const tBtn = getThreadButton(tTitle);
        if (tBtn) {
          tBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await sleep(300);
          tBtn.click();
          await sleep(800);
          
          const menuItems = Array.from(document.querySelectorAll('.mat-mdc-menu-item, button'));
          const addOpt = menuItems.find(el => (el.innerText || '').includes('Add to notebook'));
          if (addOpt) {
            addOpt.click();
            await sleep(1500); // wait for dialog to populate
            
            const listOptions = Array.from(document.querySelectorAll('mat-list-option, .mat-mdc-list-item, div[role="option"]'));
            const nbOpt = listOptions.find(o => {
              const text = (o.innerText || o.textContent || '').trim().toLowerCase();
              return text.includes(proj.title.toLowerCase());
            });

            if (nbOpt) {
              selectNotebookOption(nbOpt);
              added++;
              log(`Added thread to "${proj.title}": ${tTitle.substring(0, 35)}...`, "success");
              await sleep(2500); // allow Angular to finish move & auto-close dialog
            } else {
              log(`Could not find notebook "${proj.title}" in dialog for: ${tTitle.substring(0, 30)}...`);
              await dismissDialog();
            }
          } else {
             document.body.click();
             log(`'Add to notebook' option missing for: ${tTitle.substring(0, 30)}...`);
          }
        } else {
          log(`Skipped (not found in Recents): ${tTitle.substring(0, 35)}...`);
        }
      }
      log(`Successfully added ${added}/${proj.threadTitles.length} threads to "${proj.title}".`, "success");
    }

    await sleep(2000);
  }

  await dismissDialog();
  chrome.runtime.sendMessage({ type: 'MIGRATE_PROGRESS', current: projects.length, total: projects.length });
  log("Migration completed!", "success");
}
