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

  const getThreadButton = (title) => {
    // Finds the button whose aria-label starts with "More options for <title>"
    // Handles truncation by checking startsWith or includes
    const btns = Array.from(document.querySelectorAll('button[aria-label^="More options for"]'));
    return btns.find(b => {
      const label = b.getAttribute('aria-label');
      // Sometimes titles have trailing spaces or ellipsis. Using includes is safer.
      return label.includes(title.substring(0, 20)); // match first 20 chars
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

    // 3. Fill Title
    const titleInput = document.querySelector('input[aria-label="Name of the notebook"]');
    if (titleInput) {
      titleInput.value = proj.title;
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      // Press enter
      titleInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      log("Set notebook title.");
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
      log(`Adding ${proj.threadTitles.length} threads to ${proj.title}...`);
      
      // Ensure "Recents" sidebar is open. 
      // If we are in notebook view, we might need to open the sidebar.
      // We will try finding the threads directly.
      let added = 0;
      for (const tTitle of proj.threadTitles) {
        const tBtn = getThreadButton(tTitle);
        if (tBtn) {
          tBtn.click();
          await sleep(500);
          
          const addOpt = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).find(el => el.innerText.includes('Add to notebook'));
          if (addOpt) {
            addOpt.click();
            await sleep(1000);
            
            const nbOpt = Array.from(document.querySelectorAll('mat-list-option')).find(o => o.innerText.includes(proj.title));
            if (nbOpt) {
              nbOpt.click();
              added++;
              log(`Added thread to notebook: ${tTitle}`);
            } else {
              log(`Could not find notebook name in dialog for: ${tTitle}`);
              // close dialog
              const closeBtn = Array.from(document.querySelectorAll('mat-dialog-container button')).find(b => b.innerText.includes('Close'));
              if (closeBtn) closeBtn.click();
            }
            await sleep(1000);
          } else {
             // Close menu by clicking body
             document.body.click();
             log(`'Add to notebook' option missing for: ${tTitle}`);
          }
        } else {
          log(`Thread not found in recents (might not be imported yet): ${tTitle}`);
        }
      }
      log(`Successfully added ${added}/${proj.threadTitles.length} threads.`, "success");
    }

    await sleep(2000);
  }

  chrome.runtime.sendMessage({ type: 'MIGRATE_PROGRESS', current: projects.length, total: projects.length });
  log("Migration completed!", "success");
}
