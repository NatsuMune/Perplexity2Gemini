// Helper to format UUIDs for ZIP generation
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function logMsg(msg, type = 'default') {
  const c = document.getElementById('log-container');
  c.classList.remove('hidden');
  const d = document.createElement('div');
  d.className = 'log-entry ' + (type === 'error' ? 'error-text' : type === 'success' ? 'success-text' : '');
  d.textContent = msg;
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
}

// Injected function that executes INSIDE the perplexity.ai tab (same-origin context)
async function performInjectedExtraction() {
  function innerGenerateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function innerExtractAnswer(rawText) {
    if (!rawText) return "";
    if (typeof rawText === 'object') {
      if (rawText.answer) {
        if (typeof rawText.answer === 'string' && rawText.answer.startsWith('{')) {
          let inner = innerExtractAnswer(rawText.answer);
          if (inner && inner !== rawText.answer) return inner;
        }
        return rawText.answer;
      }
      if (rawText.content && rawText.content.answer) {
        if (typeof rawText.content.answer === 'string' && rawText.content.answer.startsWith('{')) {
          let inner = innerExtractAnswer(rawText.content.answer);
          if (inner && inner !== rawText.content.answer) return inner;
        }
        return rawText.content.answer;
      }
    }
    let text = typeof rawText === 'string' ? rawText.trim() : String(rawText);
    
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        for (let i = parsed.length - 1; i >= 0; i--) {
          const step = parsed[i];
          if (step && step.content) {
            if (typeof step.content === 'string' && step.content.startsWith('{')) {
              let inner = innerExtractAnswer(step.content);
              if (inner && inner !== step.content) return inner;
            } else if (typeof step.content === 'object' && step.content.answer) {
              if (typeof step.content.answer === 'string' && step.content.answer.startsWith('{')) {
                let inner = innerExtractAnswer(step.content.answer);
                if (inner && inner !== step.content.answer) return inner;
              }
              return step.content.answer;
            }
            if (typeof step.content === 'string') return step.content;
          }
          if (step && step.answer) return step.answer;
        }
      } else if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.answer) {
          if (typeof parsed.answer === 'string' && parsed.answer.startsWith('{')) {
            let inner = innerExtractAnswer(parsed.answer);
            if (inner && inner !== parsed.answer) return inner;
          }
          return parsed.answer;
        }
        if (parsed.content && parsed.content.answer) {
          if (typeof parsed.content.answer === 'string' && parsed.content.answer.startsWith('{')) {
            let inner = innerExtractAnswer(parsed.content.answer);
            if (inner && inner !== parsed.content.answer) return inner;
          }
          return parsed.content.answer;
        }
        if (parsed.text) return innerExtractAnswer(parsed.text);
      }
    } catch (e) {
      let startIndex = text.indexOf('"answer"');
      if (startIndex !== -1) {
        let colonIndex = text.indexOf(':', startIndex);
        if (colonIndex !== -1) {
          let quoteIndex = text.indexOf('"', colonIndex);
          if (quoteIndex !== -1) {
            let endIndex = -1;
            for (let i = quoteIndex + 1; i < text.length; i++) {
              if (text[i] === '"') {
                let backslashes = 0;
                let j = i - 1;
                while (j >= 0 && text[j] === '\\') {
                  backslashes++;
                  j--;
                }
                if (backslashes % 2 === 0) {
                  endIndex = i;
                  break;
                }
              }
            }
            
            let answerString = text.substring(quoteIndex + 1, endIndex !== -1 ? endIndex : text.length);
            if (answerString.endsWith('\\')) {
              answerString = answerString.slice(0, -1);
            }
            
            let decoded = answerString
              .replace(/\\u([0-9a-fA-F]{4})/g, (m, grp) => String.fromCharCode(parseInt(grp, 16)))
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t')
              .replace(/\\"/g, '"')
              .replace(/\\\\/g, '\\');
              
            return decoded;
          }
        }
      }
    }
    return text;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  let rawRecent = [];
  try {
    const listRes = await fetch("https://www.perplexity.ai/rest/thread/list_recent?limit=500&offset=0");
    const listData = await listRes.json();
    rawRecent = Array.isArray(listData) ? listData : (listData.threads || []);
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'P2G_ERROR', message: "Failed to fetch thread list: " + e.message });
    return;
  }

  let projectThreads = [];
  let projectsMap = [];
  try {
    const collectionsRes = await fetch("https://www.perplexity.ai/rest/collections/list_user_collections");
    if (collectionsRes.ok) {
      const collData = await collectionsRes.json();
      const collectionsArray = Array.isArray(collData) ? collData : (collData.collections || []);
      
      for (const col of collectionsArray) {
        if (!col.slug) continue;
        
        // 1. Get collection details (for instructions)
        const detailRes = await fetch("https://www.perplexity.ai/rest/collections/get_collection?slug=" + col.slug);
        const detail = await detailRes.json();
        
        // 2. Get collection threads
        const threadsRes = await fetch("https://www.perplexity.ai/rest/collections/list_collection_threads?collection_slug=" + col.slug + "&limit=250&offset=0");
        let colThreads = [];
        if (threadsRes.ok) {
          const tData = await threadsRes.json();
          colThreads = Array.isArray(tData) ? tData : (tData.threads || []);
        }
        
        if (colThreads.length > 0) {
          colThreads.forEach(t => {
            projectThreads.push({ ...t, projectName: col.title });
          });
          projectsMap.push({
            title: col.title,
            instructions: detail.instructions || "",
            description: detail.description || "",
            threadTitles: colThreads.map(t => t.title || t.thread_title || t.uuid)
          });
        }
      }
    }
  } catch(e) {
    // Collections fetch optional
  }
  
  // Save projects map via message so extract.js running in extension can save it
  chrome.runtime.sendMessage({ type: 'P2G_PROJECT_DATA', projects: projectsMap });

  // Map threads and track project association
  const threadMap = new Map();
  
  // Add project threads first so they get assigned their project name
  for (const t of projectThreads) {
    if (t.uuid) {
      threadMap.set(t.uuid, t);
    }
  }
  
  // Add standalone recent threads
  for (const t of rawRecent) {
    if (t.uuid && !threadMap.has(t.uuid)) {
      threadMap.set(t.uuid, { ...t, projectName: null });
    }
  }

  const uniqueThreads = Array.from(threadMap.values());
  const total = uniqueThreads.length;
  
  let standaloneCount = 0;
  let projectThreadsCount = 0;
  for (const t of uniqueThreads) {
    if (t.projectName) {
      projectThreadsCount++;
    } else {
      standaloneCount++;
    }
  }

  chrome.runtime.sendMessage({ 
    type: 'P2G_DETECTED', 
    total,
    standaloneCount,
    projectThreadsCount,
    projectsCount: projectsMap.length
  });
  
  if (total === 0) {
    chrome.runtime.sendMessage({ type: 'P2G_COMPLETE', conversations: [] });
    return;
  }

  let extractedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const conversations = [];

  for (let i = 0; i < total; i++) {
    const thread = uniqueThreads[i];
    const uuid = thread.uuid;
    const cachedTitle = thread.title;
    
    chrome.runtime.sendMessage({ 
      type: 'P2G_PROGRESS', 
      index: i + 1, 
      total, 
      currentTitle: cachedTitle || uuid,
      projectName: thread.projectName || "Standalone",
      extractedCount,
      skippedCount,
      errorCount
    });

    try {
      const response = await fetch("https://www.perplexity.ai/rest/thread/" + uuid);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const threadData = data.entries ? data : (data.thread || data);

      if (!threadData.entries || threadData.entries.length === 0) {
        skippedCount++;
        continue;
      }

      const mapping = {};
      let parentNodeId = null;
      let lastNodeId = null;
      const createTime = new Date(threadData.updated_datetime || Date.now()).getTime() / 1000;
      const convUuid = (uuid && uuid.length === 36) ? uuid : innerGenerateUUID();

      const rootNodeId = innerGenerateUUID();
      mapping[rootNodeId] = { id: rootNodeId, message: null, parent: null, children: [] };
      parentNodeId = rootNodeId;
      lastNodeId = rootNodeId;
      
      let hasValidContent = false;

      for (let j = 0; j < threadData.entries.length; j++) {
        const entry = threadData.entries[j];
        const userText = entry.query_str || "";
        if (userText) hasValidContent = true;
        
        const userNodeId = innerGenerateUUID();
        mapping[parentNodeId].children.push(userNodeId);
        mapping[userNodeId] = {
          id: userNodeId,
          message: {
            id: userNodeId,
            author: { role: "user", name: null, metadata: {} },
            create_time: createTime + j * 2,
            update_time: null,
            content: { content_type: "text", parts: [userText] },
            status: "finished_successfully",
            end_turn: null,
            weight: 1.0,
            metadata: {},
            recipient: "all"
          },
          parent: parentNodeId,
          children: []
        };
        parentNodeId = userNodeId;
        lastNodeId = userNodeId;

        const answerText = innerExtractAnswer(entry.text);
        if (answerText) {
          hasValidContent = true;
          const assistantNodeId = innerGenerateUUID();
          mapping[parentNodeId].children.push(assistantNodeId);
          mapping[assistantNodeId] = {
            id: assistantNodeId,
            message: {
              id: assistantNodeId,
              author: { role: "assistant", name: null, metadata: {} },
              create_time: createTime + j * 2 + 1,
              update_time: null,
              content: { content_type: "text", parts: [answerText] },
              status: "finished_successfully",
              end_turn: true,
              weight: 1.0,
              metadata: { finish_details: { type: "stop" }, is_complete: true, model_slug: "gpt-4o" },
              recipient: "all"
            },
            parent: parentNodeId,
            children: []
          };
          parentNodeId = assistantNodeId;
          lastNodeId = assistantNodeId;
        }
      }

      const threadTitle = threadData.thread_title || cachedTitle || threadData.title || (threadData.entries && threadData.entries[0] && threadData.entries[0].query_str) || "Conversation";

      if (hasValidContent) {
        conversations.push({
          title: threadTitle,
          create_time: createTime,
          update_time: createTime,
          mapping: mapping,
          moderation_results: [],
          current_node: lastNodeId,
          conversation_id: convUuid,
          id: convUuid
        });
        extractedCount++;
      } else {
        skippedCount++;
      }
      
    } catch (err) {
      errorCount++;
      chrome.runtime.sendMessage({ type: 'P2G_LOG', message: `Error on ${uuid}: ${err.message}`, isError: true });
    }
    
    await sleep(20);
  }

  chrome.runtime.sendMessage({ 
    type: 'P2G_PROGRESS', 
    index: total, 
    total, 
    currentTitle: "Completed",
    extractedCount,
    skippedCount,
    errorCount
  });

  chrome.runtime.sendMessage({ type: 'P2G_COMPLETE', conversations });
}

// UI Controller in extract.html
let isCancelled = false;

document.getElementById('cancelBtn').addEventListener('click', () => {
  isCancelled = true;
  document.getElementById('current-thread').textContent = "Cancelled by user.";
  document.getElementById('cancelBtn').disabled = true;
});

async function initUI() {
  const urlParams = new URLSearchParams(window.location.search);
  let tabId = parseInt(urlParams.get('tabId'), 10);

  if (isNaN(tabId)) {
    const tabs = await chrome.tabs.query({ url: "*://*.perplexity.ai/*" });
    if (tabs.length > 0) {
      tabId = tabs[0].id;
    }
  }

  if (!tabId) {
    document.getElementById('current-thread').textContent = "Error: Active Perplexity tab not found. Please keep Perplexity open.";
    logMsg("No Perplexity tab available.", "error");
    return;
  }

  document.getElementById('current-thread').textContent = "Connecting to Perplexity tab...";

  // Listen for messages from the injected extraction script
  chrome.runtime.onMessage.addListener(async (msg) => {
    if (isCancelled) return;

    if (msg.type === 'P2G_PROJECT_DATA') {
      chrome.storage.local.set({ p2gProjects: msg.projects }, () => {
        logMsg(`Saved ${msg.projects.length} projects to local storage for Gemini migration.`, "success");
      });
    } else if (msg.type === 'P2G_DETECTED') {
      document.getElementById('stat-detected').textContent = msg.total;
      document.getElementById('stat-standalone').textContent = msg.standaloneCount || 0;
      document.getElementById('stat-project-threads').textContent = msg.projectThreadsCount || 0;
      document.getElementById('stat-projects').textContent = msg.projectsCount || 0;
      if (msg.total === 0) {
        document.getElementById('current-thread').textContent = "No threads found on your account.";
      }
    } else if (msg.type === 'P2G_PROGRESS') {
      const pct = Math.round((msg.index / msg.total) * 100);
      document.getElementById('progress-bar').style.width = `${pct}%`;
      document.getElementById('current-project').textContent = msg.projectName || "Standalone";
      document.getElementById('current-thread').textContent = `[${msg.index}/${msg.total}] Extracting: ${msg.currentTitle}...`;
      document.getElementById('stat-extracted').textContent = msg.extractedCount;
      document.getElementById('stat-skipped').textContent = msg.skippedCount;
      document.getElementById('stat-errors').textContent = msg.errorCount;
    } else if (msg.type === 'P2G_LOG') {
      logMsg(msg.message, msg.isError ? "error" : "default");
    } else if (msg.type === 'P2G_ERROR') {
      document.getElementById('current-thread').textContent = "Extraction failed: " + msg.message;
      logMsg(msg.message, "error");
    } else if (msg.type === 'P2G_COMPLETE') {
      document.getElementById('progress-bar').style.width = '100%';
      document.getElementById('current-thread').textContent = "Zipping extracted data...";

      try {
        const conversations = msg.conversations || [];
        const zip = new JSZip();
        const mappingData = {};
        conversations.forEach(c => { mappingData[c.conversation_id] = c; });
        zip.file("conversations.json", JSON.stringify(conversations, null, 2));
        zip.file("message_feedback.json", "[]");
        zip.file("model_comparisons.json", "[]");
        zip.file("user.json", JSON.stringify({
          id: "user-" + generateUUID(),
          email: "perplexity-export@example.com",
          phone_number: null,
          data_deletion_status: "ACTIVE"
        }, null, 2));
        zip.file("chat.html", "<html><body><h1>Perplexity Export</h1><p>Contains " + conversations.length + " conversations.</p></body></html>");

        const content = await zip.generateAsync({ type: "blob" });

        document.getElementById('current-thread').textContent = "Extraction complete! Ready for download.";
        document.getElementById('cancelBtn').classList.add('hidden');

        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.classList.remove('hidden');
        document.getElementById('next-steps-guide').classList.remove('hidden');

        const url = URL.createObjectURL(content);
        downloadBtn.onclick = () => {
          chrome.downloads.download({
            url: url,
            filename: "perplexity_gemini_export.zip",
            saveAs: true
          });
        };

        logMsg(`Successfully processed ${conversations.length} threads into ZIP.`, "success");
      } catch (e) {
        document.getElementById('current-thread').textContent = "Zipping failed.";
        logMsg("Zipping error: " + e.message, "error");
      }
    }
  });

  // Inject and execute the extraction script into the target tab
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: performInjectedExtraction
    });
  } catch (err) {
    document.getElementById('current-thread').textContent = "Could not inject into tab. Ensure Perplexity tab is open.";
    logMsg("Injection error: " + err.message, "error");
  }
}

initUI();
