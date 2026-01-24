/**
 * Main Popup component
 * @author haiping.yu@zoom.us
 */

import React, { useState, useCallback, useEffect } from 'react';
import { ListTodo, BookOpen, Settings, Plus, Sparkles, User, LogOut, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { 
  TodoList, 
  TodoForm, 
  Button,
  SettingsSection,
  SettingsRow,
  ToggleSwitch,
  ThemeSelector,
  AIProviderConfig,
  KnowledgeList,
  KnowledgeForm,
  KnowledgeDetail,
  QuickSaveButton,
  AIAnalysisPanel,
  Auth,
} from '@/components';
import type { TodoFormData } from '@/components';
import { useTodos } from '@/hooks/useTodos';
import { usePendingAttachments } from '@/hooks/useAttachments';
import { useSettings } from '@/hooks/useSettings';
import { useAIConfig } from '@/hooks/useAIConfig';
import { useKnowledge } from '@/hooks/useKnowledge';
import { useAuth } from '@/hooks/useAuth';
import { getSyncStatusInfo, syncTodosToCloud, syncTodosFromCloud, syncKnowledgeToCloud, syncKnowledgeFromCloud } from '@/utils/sync';
import type { Todo, KnowledgeItem } from '@/types';
import { deleteAttachmentsByTodo } from '@/utils/indexeddb';
import { extractCurrentPageContent, getFaviconUrl } from '@/utils/content-extractor';
import {
  generateArticleSummary,
  extractKeywords,
  suggestArticleCategory,
  isAIConfigured,
  localArticleSummary,
  localExtractKeywords,
  analyzeTodoPriorities,
  summarizeTodoList,
  suggestTodoCategories,
} from '@/utils/ai';

type Tab = 'todos' | 'knowledge' | 'settings';

export const Popup: React.FC = () => {
  const { isAuthenticated, isLoading: authLoading, isConfigured, user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('todos');
  const [quickAddMode, setQuickAddMode] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ todos: { lastSync: string | null; pending: boolean }; knowledge: { lastSync: string | null; pending: boolean } } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check for quick-add mode from URL params or storage
  useEffect(() => {
    // Check URL params
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'quick-add') {
      setQuickAddMode(true);
      setActiveTab('todos');
    }

    // Also check if there's pending text from context menu/keyboard shortcut
    chrome.storage.local.get('pending_quick_add').then((result) => {
      if (result.pending_quick_add) {
        setQuickAddMode(true);
        setActiveTab('todos');
        // Clear the pending flag
        chrome.storage.local.remove('pending_quick_add');
      }
    });
  }, []);

  // Show auth if not configured or not authenticated (but allow skipping if not configured)
  useEffect(() => {
    if (!authLoading) {
      if (!isConfigured) {
        // Supabase not configured - allow using app without auth
        setShowAuth(false);
      } else if (!isAuthenticated) {
        // Configured but not authenticated - show auth
        setShowAuth(true);
      } else {
        // Authenticated - hide auth
        setShowAuth(false);
      }
    }
  }, [isAuthenticated, isConfigured, authLoading]);

  const handleAuthSuccess = () => {
    setShowAuth(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setShowAuth(true);
  };

  // Load sync status
  useEffect(() => {
    if (isAuthenticated && isConfigured) {
      getSyncStatusInfo().then(setSyncStatus);
    }
  }, [isAuthenticated, isConfigured]);

  // Manual sync function - bidirectional sync
  const handleManualSync = useCallback(async () => {
    if (!isAuthenticated || !isConfigured) return;
    
    setIsSyncing(true);
    try {
      // Step 1: Push local todos to cloud first
      const localTodosResult = await chrome.storage.local.get('todos');
      const localTodos = (localTodosResult.todos || []).map((t: Record<string, unknown>) => ({
        ...t,
        createdAt: new Date(t.createdAt as string),
        updatedAt: new Date(t.updatedAt as string),
        deadline: t.deadline ? new Date(t.deadline as string) : undefined,
        reminder: t.reminder ? new Date(t.reminder as string) : undefined,
        completedAt: t.completedAt ? new Date(t.completedAt as string) : undefined,
      })) as Todo[];
      
      if (localTodos.length > 0) {
        console.log(`Pushing ${localTodos.length} todos to cloud...`);
        const { error: pushError } = await syncTodosToCloud(localTodos);
        if (pushError) {
          console.error('Failed to push todos to cloud:', pushError);
          alert(`同步失败: ${pushError.message}`);
        } else {
          console.log('Successfully pushed todos to cloud');
        }
      } else {
        console.log('No local todos to sync');
      }

      // Step 2: Pull from cloud and merge
      const { todos: cloudTodos, error: pullError } = await syncTodosFromCloud();
      if (!pullError && cloudTodos.length >= 0) {
        // Update local storage with merged data
        const todosForStorage = cloudTodos.map(t => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
          updatedAt: t.updatedAt.toISOString(),
          deadline: t.deadline?.toISOString(),
          reminder: t.reminder?.toISOString(),
          completedAt: t.completedAt?.toISOString(),
        }));
        await chrome.storage.local.set({ todos: todosForStorage });
      } else if (pullError) {
        console.error('Failed to pull todos from cloud:', pullError);
      }

      // Step 3: Sync knowledge items (similar process)
      // Get local knowledge items from IndexedDB queue
      const localKnowledgeResult = await chrome.storage.local.get('knowledge_queue');
      const localKnowledge = (localKnowledgeResult.knowledge_queue || []).map(
        (item: Record<string, unknown>) => ({
          ...item,
          createdAt: new Date(item.createdAt as string),
          updatedAt: new Date(item.updatedAt as string),
          publishedAt: item.publishedAt ? new Date(item.publishedAt as string) : undefined,
        })
      ) as KnowledgeItem[];

      if (localKnowledge.length > 0) {
        const { error: knowledgePushError } = await syncKnowledgeToCloud(localKnowledge);
        if (knowledgePushError) {
          console.error('Failed to push knowledge to cloud:', knowledgePushError);
        }
      }

      const { items: cloudKnowledge, error: knowledgePullError } = await syncKnowledgeFromCloud();
      if (knowledgePullError) {
        console.error('Failed to pull knowledge from cloud:', knowledgePullError);
      } else {
        console.log(`Pulled ${cloudKnowledge.length} knowledge items from cloud`);
      }
      
      // Refresh sync status
      const status = await getSyncStatusInfo();
      setSyncStatus(status);
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isConfigured]);

  // Show auth screen if needed
  if (showAuth && isConfigured) {
    return (
      <div className="w-[400px] min-h-[500px] max-h-[600px] flex flex-col bg-white dark:bg-gray-900">
        <header className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Assistant
          </h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <Auth onSuccess={handleAuthSuccess} />
        </main>
      </div>
    );
  }

  return (
    <div className="w-[400px] min-h-[500px] max-h-[600px] flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Assistant
        </h1>
        <div className="flex items-center gap-2">
          {/* Sync status indicator */}
          {isAuthenticated && isConfigured && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              title={syncStatus?.todos.pending || syncStatus?.knowledge.pending ? 'Sync pending' : 'Sync now'}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400 animate-spin" />
              ) : syncStatus?.todos.lastSync || syncStatus?.knowledge.lastSync ? (
                <Cloud className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <CloudOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              )}
            </button>
          )}
          {isAuthenticated && (
            <>
              {user?.email && (
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                  {user.email}
                </span>
              )}
              <button
                onClick={handleSignOut}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          )}
          {isConfigured && !isAuthenticated && (
            <button
              onClick={() => setShowAuth(true)}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Sign in"
            >
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {activeTab === 'todos' && (
          <TodosView 
            quickAddMode={quickAddMode} 
            onQuickAddComplete={() => setQuickAddMode(false)} 
          />
        )}
        {activeTab === 'knowledge' && <KnowledgeView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Navigation */}
      <nav className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700">
        <div className="flex">
          <NavButton
            icon={<ListTodo className="w-5 h-5" />}
            label="TODOs"
            isActive={activeTab === 'todos'}
            onClick={() => setActiveTab('todos')}
          />
          <NavButton
            icon={<BookOpen className="w-5 h-5" />}
            label="Knowledge"
            isActive={activeTab === 'knowledge'}
            onClick={() => setActiveTab('knowledge')}
          />
          <NavButton
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            isActive={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </div>
      </nav>
    </div>
  );
};

interface NavButtonProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ icon, label, isActive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex flex-col items-center py-2 transition-colors
        ${isActive 
          ? 'text-primary-600 dark:text-primary-400' 
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        }
      `}
    >
      {icon}
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
};

// Fully implemented TODO view
interface TodosViewProps {
  quickAddMode?: boolean;
  onQuickAddComplete?: () => void;
}

const TodosView: React.FC<TodosViewProps> = ({ quickAddMode = false, onQuickAddComplete }) => {
  const {
    todos,
    isLoading,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleStatus,
  } = useTodos();

  const [showForm, setShowForm] = useState(quickAddMode);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const { saveToTodo } = usePendingAttachments();

  // Handle quick add mode changes
  useEffect(() => {
    if (quickAddMode) {
      setShowForm(true);
    }
  }, [quickAddMode]);

  const handleAddTodo = useCallback(
    async (data: TodoFormData, files: File[]) => {
      const newTodo = await addTodo({
        title: data.title,
        description: data.description,
        status: 'pending',
        priority: data.priority,
        deadline: data.deadline,
        reminder: data.reminder,
        tags: data.tags,
        attachments: [],
      });

      // Save attachments
      if (files.length > 0) {
        await saveToTodo(newTodo.id);
      }

      setShowForm(false);
      onQuickAddComplete?.();
    },
    [addTodo, saveToTodo, onQuickAddComplete]
  );

  const handleEditTodo = useCallback(
    async (data: TodoFormData, files: File[]) => {
      if (!editingTodo) return;

      await updateTodo(editingTodo.id, {
        title: data.title,
        description: data.description,
        priority: data.priority,
        deadline: data.deadline,
        reminder: data.reminder,
        tags: data.tags,
      });

      // Save new attachments
      if (files.length > 0) {
        await saveToTodo(editingTodo.id);
      }

      setEditingTodo(null);
    },
    [editingTodo, updateTodo, saveToTodo]
  );

  const handleDeleteTodo = useCallback(
    async (id: string) => {
      // Delete associated attachments
      await deleteAttachmentsByTodo(id);
      await deleteTodo(id);
    },
    [deleteTodo]
  );

  const handleEdit = useCallback((todo: Todo) => {
    setEditingTodo(todo);
    setShowForm(false);
  }, []);

  // AI handlers
  const handleApplyPriority = useCallback(
    async (todoId: string, priority: Todo['priority']) => {
      await updateTodo(todoId, { priority });
    },
    [updateTodo]
  );

  const handleApplyTags = useCallback(
    async (todoId: string, tags: string[]) => {
      await updateTodo(todoId, { tags });
    },
    [updateTodo]
  );

  // Show AI panel
  if (showAIPanel) {
    return (
      <AIAnalysisPanel
        todos={todos}
        onAnalyzePriorities={analyzeTodoPriorities}
        onSummarize={summarizeTodoList}
        onSuggestCategories={suggestTodoCategories}
        onApplyPrioritySuggestion={handleApplyPriority}
        onApplyTags={handleApplyTags}
        onClose={() => setShowAIPanel(false)}
      />
    );
  }

  // Show form for adding new TODO
  if (showForm) {
    return (
      <TodoForm
        mode="add"
        onSubmit={handleAddTodo}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  // Show form for editing TODO
  if (editingTodo) {
    return (
      <TodoForm
        mode="edit"
        todo={editingTodo}
        onSubmit={handleEditTodo}
        onCancel={() => setEditingTodo(null)}
      />
    );
  }

  // Show TODO list
  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          onClick={() => setShowForm(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add TODO
        </Button>
        <Button
          variant="secondary"
          onClick={() => setShowAIPanel(true)}
          title="AI Analysis"
          disabled={todos.length === 0}
        >
          <Sparkles className="w-4 h-4" />
        </Button>
      </div>

      {/* TODO list */}
      <TodoList
        todos={todos}
        isLoading={isLoading}
        onToggle={toggleStatus}
        onEdit={handleEdit}
        onDelete={handleDeleteTodo}
      />
    </div>
  );
};

const KnowledgeView: React.FC = () => {
  const {
    items,
    isLoading,
    categories,
    addItem,
    deleteItem,
    updateStatus,
  } = useKnowledge();

  const [showForm, setShowForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [isSavingPage, setIsSavingPage] = useState(false);

  // Process a knowledge item with AI
  const processWithAI = useCallback(
    async (id: string, content: string, title: string) => {
      try {
        await updateStatus(id, 'processing');

        const aiConfigured = await isAIConfigured();
        
        let summary: string;
        let keywords: string[];
        let category: string;

        if (aiConfigured) {
          // Use AI for processing
          [summary, keywords, category] = await Promise.all([
            generateArticleSummary(content),
            extractKeywords(content),
            suggestArticleCategory(title),
          ]);
        } else {
          // Use local fallbacks
          summary = localArticleSummary(content);
          keywords = localExtractKeywords(content);
          category = 'Other';
        }

        // Update the item with processed data
        await chrome.runtime.sendMessage({
          type: 'UPDATE_KNOWLEDGE',
          payload: {
            id,
            summary,
            keywords,
            category,
            status: 'ready',
          },
        });

        await updateStatus(id, 'ready');
      } catch (error) {
        console.error('AI processing failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Processing failed';
        await updateStatus(id, 'error', errorMessage);
      }
    },
    [updateStatus]
  );

  // Save current page
  const handleSaveCurrentPage = useCallback(async () => {
    setIsSavingPage(true);
    try {
      const pageContent = await extractCurrentPageContent();
      
      if (!pageContent) {
        throw new Error('Could not extract page content');
      }

      const newItem = await addItem({
        url: pageContent.url,
        title: pageContent.title,
        content: pageContent.content,
        source: pageContent.siteName,
        author: pageContent.author,
        favicon: pageContent.favicon || getFaviconUrl(pageContent.url),
      });

      // Process with AI in background
      if (pageContent.content) {
        processWithAI(newItem.id, pageContent.content, pageContent.title);
      }
    } catch (error) {
      console.error('Failed to save current page:', error);
    } finally {
      setIsSavingPage(false);
    }
  }, [addItem, processWithAI]);

  // Handle form submission
  const handleFormSubmit = useCallback(
    async (data: { type: 'url' | 'note'; url?: string; title?: string; content?: string }) => {
      if (data.type === 'url' && data.url) {
        // For URLs, we need to fetch content via service worker
        const newItem = await addItem({
          url: data.url,
          title: 'Loading...',
          favicon: getFaviconUrl(data.url),
        });

        // Request content extraction from service worker
        chrome.runtime.sendMessage({
          type: 'EXTRACT_AND_PROCESS_URL',
          payload: { id: newItem.id, url: data.url },
        });
      } else if (data.type === 'note' && data.title) {
        // For notes, save directly
        const newItem = await addItem({
          title: data.title,
          content: data.content,
        });

        // Process with AI if content is available
        if (data.content) {
          processWithAI(newItem.id, data.content, data.title);
        } else {
          await updateStatus(newItem.id, 'ready');
        }
      }

      setShowForm(false);
    },
    [addItem, processWithAI, updateStatus]
  );

  // Show form
  if (showForm) {
    return (
      <KnowledgeForm
        onSubmit={handleFormSubmit}
        onCancel={() => setShowForm(false)}
      />
    );
  }

  // Show detail
  if (selectedItem) {
    return (
      <KnowledgeDetail
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onReprocess={async (id) => {
          const item = items.find((i) => i.id === id);
          if (item?.content) {
            await processWithAI(id, item.content, item.title);
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex gap-2">
        <QuickSaveButton
          onSave={handleSaveCurrentPage}
          isLoading={isSavingPage}
        />
        <Button
          variant="secondary"
          onClick={() => setShowForm(true)}
          className="px-3"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Knowledge list */}
      <KnowledgeList
        items={items}
        isLoading={isLoading}
        categories={categories}
        onDelete={deleteItem}
        onOpen={setSelectedItem}
      />
    </div>
  );
};

const SettingsView: React.FC = () => {
  const { settings, setTheme, toggleNotifications, toggleAutoSummarize } = useSettings();
  const { config, updateConfig, updateProviderConfig, testConnection } = useAIConfig();
  const { isAuthenticated, isConfigured, user, signOut } = useAuth();

  const handleExportData = async () => {
    try {
      const data = await chrome.storage.local.get(null);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-assistant-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleClearData = async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      await chrome.storage.local.clear();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Authentication */}
      {isConfigured && (
        <SettingsSection
          title="Account"
          description="Manage your account and sync settings"
        >
          {isAuthenticated ? (
            <div className="space-y-3">
              <SettingsRow label="Email" description={user?.email || 'Not available'}>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {user?.email || 'Not available'}
                </span>
              </SettingsRow>
              <Button variant="secondary" onClick={signOut} className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sign in to enable cloud sync across devices.
              </p>
              <Auth onSuccess={() => {}} />
            </div>
          )}
        </SettingsSection>
      )}

      {/* AI Configuration */}
      <SettingsSection
        title="AI Service"
        description="Configure your AI provider for summarization and Q&A"
      >
        <AIProviderConfig
          config={config}
          onUpdateConfig={updateConfig}
          onUpdateProviderConfig={updateProviderConfig}
          onTestConnection={testConnection}
        />
      </SettingsSection>

      {/* Appearance */}
      <SettingsSection title="Appearance">
        <SettingsRow label="Theme" description="Choose your preferred color scheme">
          <ThemeSelector value={settings.theme} onChange={setTheme} />
        </SettingsRow>
      </SettingsSection>

      {/* Behavior */}
      <SettingsSection title="Behavior">
        <SettingsRow
          label="Notifications"
          description="Receive reminders for TODO deadlines"
        >
          <ToggleSwitch
            checked={settings.notifications}
            onChange={toggleNotifications}
          />
        </SettingsRow>
        <SettingsRow
          label="Auto Summarize"
          description="Automatically generate title from long content"
        >
          <ToggleSwitch
            checked={settings.autoSummarize}
            onChange={toggleAutoSummarize}
          />
        </SettingsRow>
      </SettingsSection>

      {/* Data Management */}
      <SettingsSection title="Data">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExportData} className="flex-1">
            Export Data
          </Button>
          <Button variant="danger" onClick={handleClearData} className="flex-1">
            Clear All
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
};

