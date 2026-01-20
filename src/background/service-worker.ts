/**
 * Chrome Extension Service Worker (Background Script)
 * @author haiping.yu@zoom.us
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // First-time installation
    console.log('AI Assistant installed');
    
    // Set up context menus
    setupContextMenus();
    
    // Initialize default settings
    initializeSettings();
  } else if (details.reason === 'update') {
    console.log('AI Assistant updated to version', chrome.runtime.getManifest().version);
    // Re-create context menus on update
    setupContextMenus();
  }
});

// Also set up context menus on startup (for development reloads)
chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

// Set up context menus
function setupContextMenus(): void {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Add TODO from selected text
    chrome.contextMenus.create({
      id: 'add-todo',
      title: 'Add to TODO',
      contexts: ['selection'],
    });

    // Save page to knowledge base
    chrome.contextMenus.create({
      id: 'save-to-knowledge',
      title: 'Save to Knowledge Base',
      contexts: ['page', 'link'],
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'add-todo') {
    handleAddTodo(info.selectionText || '', tab);
  } else if (info.menuItemId === 'save-to-knowledge') {
    handleSaveToKnowledge(info.linkUrl || info.pageUrl || '', tab);
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle different message types
  switch (message.type) {
    case 'GET_TODOS':
      handleGetTodos().then(sendResponse);
      return true;

    case 'ADD_TODO':
      handleAddTodo(message.payload.text, sender.tab).then(sendResponse);
      return true;

    case 'SAVE_ARTICLE':
      handleSaveToKnowledge(message.payload.url, sender.tab).then(sendResponse);
      return true;

    case 'EXTRACT_AND_PROCESS_URL':
      handleExtractAndProcess(message.payload.id, message.payload.url).then(sendResponse);
      return true;

    case 'UPDATE_KNOWLEDGE':
      handleUpdateKnowledge(message.payload).then(sendResponse);
      return true;

    case 'OPEN_POPUP_QUICK_ADD':
      chrome.action.openPopup();
      sendResponse({ success: true });
      return false;

    default:
      console.warn('Unknown message type:', message.type);
      sendResponse({ error: 'Unknown message type' });
  }
});

// Handle alarms for reminders
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith('todo-reminder-')) {
    const todoId = alarm.name.replace('todo-reminder-', '');
    showTodoReminder(todoId);
  }
});

// Initialize default settings
async function initializeSettings(): Promise<void> {
  const defaultSettings = {
    theme: 'system',
    aiProvider: 'openai',
    syncEnabled: false,
    notifications: true,
  };

  const existing = await chrome.storage.local.get('settings');
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: defaultSettings });
  }
}

// ============================================================================
// TODO Handlers
// ============================================================================

async function handleGetTodos(): Promise<unknown> {
  const result = await chrome.storage.local.get('todos');
  return result.todos || [];
}

async function handleAddTodo(text: string, _tab?: chrome.tabs.Tab): Promise<unknown> {
  const result = await chrome.storage.local.get('todos');
  const todos = result.todos || [];
  
  const newTodo = {
    id: crypto.randomUUID(),
    title: text,
    status: 'pending',
    priority: 'medium',
    tags: [],
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  todos.push(newTodo);
  await chrome.storage.local.set({ todos });

  // Show notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '/icons/icon128.png',
    title: 'TODO Added',
    message: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    priority: 1,
  });
  
  return { success: true, todo: newTodo };
}

function showTodoReminder(todoId: string): void {
  chrome.storage.local.get('todos').then((result) => {
    const todos = result.todos || [];
    const todo = todos.find((t: { id: string }) => t.id === todoId);
    
    if (todo) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/icons/icon128.png',
        title: 'TODO Reminder',
        message: todo.title,
        priority: 2,
      });
    }
  });
}

// ============================================================================
// Knowledge Base Handlers
// ============================================================================

interface KnowledgeData {
  id: string;
  url?: string;
  title: string;
  content: string;
  summary?: string;
  keywords: string[];
  tags: string[];
  category?: string;
  source?: string;
  author?: string;
  publishedAt?: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
  processingError?: string;
  favicon?: string;
  createdAt: string;
  updatedAt: string;
}

async function handleSaveToKnowledge(url: string, tab?: chrome.tabs.Tab): Promise<unknown> {
  try {
    // Get page content from content script
    let pageContent: {
      url: string;
      title: string;
      content: string;
      metadata?: {
        description?: string;
        author?: string;
        publishedTime?: string;
        siteName?: string;
      };
    } | null = null;

    if (tab?.id) {
      try {
        pageContent = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
      } catch {
        console.warn('Could not get page content from content script');
      }
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const knowledgeItem: KnowledgeData = {
      id,
      url,
      title: pageContent?.title || tab?.title || 'Untitled',
      content: pageContent?.content || '',
      keywords: [],
      tags: [],
      source: pageContent?.metadata?.siteName,
      author: pageContent?.metadata?.author,
      publishedAt: pageContent?.metadata?.publishedTime,
      status: 'pending',
      favicon: tab?.favIconUrl,
      createdAt: now,
      updatedAt: now,
    };

    // Save to IndexedDB via message to popup (since service worker can't access IndexedDB directly in all scenarios)
    // We'll use chrome.storage.local as intermediate storage
    const result = await chrome.storage.local.get('knowledge_queue');
    const queue = result.knowledge_queue || [];
    queue.push(knowledgeItem);
    await chrome.storage.local.set({ knowledge_queue: queue });

    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: 'Saved to Knowledge Base',
      message: knowledgeItem.title.substring(0, 50),
      priority: 1,
    });

    return { success: true, item: knowledgeItem };
  } catch (error) {
    console.error('Failed to save to knowledge base:', error);
    return { success: false, error: String(error) };
  }
}

async function handleExtractAndProcess(id: string, url: string): Promise<unknown> {
  try {
    // Find a tab with this URL
    const tabs = await chrome.tabs.query({ url });
    let pageContent: {
      url: string;
      title: string;
      content: string;
      metadata?: {
        description?: string;
        author?: string;
        publishedTime?: string;
        siteName?: string;
      };
    } | null = null;

    const firstTab = tabs[0];
    if (firstTab?.id) {
      try {
        pageContent = await chrome.tabs.sendMessage(firstTab.id, { type: 'GET_PAGE_CONTENT' });
      } catch {
        console.warn('Could not get page content');
      }
    }

    if (pageContent) {
      // Update the knowledge item with extracted content
      await handleUpdateKnowledge({
        id,
        title: pageContent.title,
        content: pageContent.content,
        source: pageContent.metadata?.siteName,
        author: pageContent.metadata?.author,
        status: 'processing',
      });
    } else {
      await handleUpdateKnowledge({
        id,
        status: 'error',
        processingError: 'Could not extract content from URL',
      });
    }

    return { success: true };
  } catch (error) {
    console.error('Extract and process failed:', error);
    return { success: false, error: String(error) };
  }
}

async function handleUpdateKnowledge(
  updates: Partial<KnowledgeData> & { id: string }
): Promise<unknown> {
  try {
    // Update knowledge item in the queue
    const result = await chrome.storage.local.get('knowledge_queue');
    const queue: KnowledgeData[] = result.knowledge_queue || [];
    
    const index = queue.findIndex((item) => item.id === updates.id);
    const existingItem = queue[index];
    if (index !== -1 && existingItem) {
      queue[index] = {
        ...existingItem,
        ...updates,
        updatedAt: new Date().toISOString(),
      } as KnowledgeData;
      await chrome.storage.local.set({ knowledge_queue: queue });
    }

    return { success: true };
  } catch (error) {
    console.error('Update knowledge failed:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-add-todo') {
    // Get selected text from current tab if any
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab?.id) {
      try {
        const selectedText = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' });
        
        if (selectedText && selectedText.trim()) {
          // Add the selected text as a TODO
          await handleAddTodo(selectedText.trim(), tab);
        } else {
          // Open popup for manual entry
          chrome.action.openPopup();
        }
      } catch {
        // Content script not available, just open popup
        chrome.action.openPopup();
      }
    } else {
      chrome.action.openPopup();
    }
  }
});

export {};
