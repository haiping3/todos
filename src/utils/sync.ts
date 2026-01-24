/**
 * Data synchronization utilities for Supabase
 * Implements local-first sync with cloud backup
 * @author haiping.yu@zoom.us
 */

import { getSupabaseClient } from '@/lib/supabase';
import type { Todo, KnowledgeItem } from '@/types';
import type { Database } from '@/types/database';

// Sync status tracking
const SYNC_STATUS_KEY = 'sync_status';

interface SyncStatus {
  todos: {
    lastSync: string | null;
    pending: boolean;
  };
  knowledge: {
    lastSync: string | null;
    pending: boolean;
  };
}

/**
 * Get current sync status
 */
async function getSyncStatus(): Promise<SyncStatus> {
  const result = await chrome.storage.local.get(SYNC_STATUS_KEY);
  return result[SYNC_STATUS_KEY] || {
    todos: { lastSync: null, pending: false },
    knowledge: { lastSync: null, pending: false },
  };
}

/**
 * Update sync status
 */
async function updateSyncStatus(updates: Partial<SyncStatus>): Promise<void> {
  const current = await getSyncStatus();
  await chrome.storage.local.set({
    [SYNC_STATUS_KEY]: { ...current, ...updates },
  });
}

/**
 * Convert Todo from app format to database format
 */
function todoToDb(todo: Todo, userId: string): Database['public']['Tables']['todos']['Insert'] {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    description: todo.description || null,
    status: todo.status,
    priority: todo.priority,
    deadline: todo.deadline?.toISOString() || null,
    reminder: todo.reminder?.toISOString() || null,
    tags: todo.tags || [],
    category: todo.category || null,
    ai_suggestions: todo.aiSuggestions ? (JSON.parse(JSON.stringify(todo.aiSuggestions)) as Record<string, unknown>) : null,
    created_at: todo.createdAt.toISOString(),
    updated_at: todo.updatedAt.toISOString(),
  };
}

/**
 * Convert Todo from database format to app format
 */
function todoFromDb(row: Database['public']['Tables']['todos']['Row']): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    priority: row.priority,
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    reminder: row.reminder ? new Date(row.reminder) : undefined,
    tags: row.tags || [],
    category: row.category || undefined,
    attachments: [], // Attachments are synced separately
    aiSuggestions: row.ai_suggestions ? (row.ai_suggestions as unknown as Todo['aiSuggestions']) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syncedAt: new Date(row.updated_at),
  };
}

/**
 * Convert KnowledgeItem from app format to database format
 */
function knowledgeToDb(
  item: KnowledgeItem,
  userId: string
): Database['public']['Tables']['knowledge_items']['Insert'] {
  return {
    id: item.id,
    user_id: userId,
    type: item.type,
    url: item.url || null,
    title: item.title,
    content: item.content || null,
    summary: item.summary || null,
    tags: item.tags || [],
    keywords: item.keywords || [],
    category: item.category || null,
    source: item.source || null,
    author: item.author || null,
    published_at: item.publishedAt?.toISOString() || null,
    status: item.status,
    processing_error: item.processingError || null,
    created_at: item.createdAt.toISOString(),
    updated_at: item.updatedAt.toISOString(),
  };
}

/**
 * Convert KnowledgeItem from database format to app format
 */
function knowledgeFromDb(
  row: Database['public']['Tables']['knowledge_items']['Row']
): KnowledgeItem {
  return {
    id: row.id,
    type: row.type,
    url: row.url || undefined,
    title: row.title,
    content: row.content || undefined,
    summary: row.summary || undefined,
    tags: row.tags || [],
    keywords: row.keywords || [],
    category: row.category || undefined,
    source: row.source || undefined,
    author: row.author || undefined,
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    status: row.status,
    processingError: row.processing_error || undefined,
    highlights: [], // Highlights are synced separately
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    syncedAt: new Date(row.updated_at),
  };
}

/**
 * Sync todos to cloud
 * Uses upsert to handle both new and existing todos
 */
export async function syncTodosToCloud(todos: Todo[]): Promise<{ error: Error | null }> {
  const client = await getSupabaseClient();
  if (!client) {
    console.error('Supabase client not available');
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError) {
      console.error('Error getting user:', userError);
      return { error: new Error(`Auth error: ${userError.message}`) };
    }
    if (!user) {
      console.error('User not authenticated');
      return { error: new Error('User not authenticated') };
    }

    console.log(`Syncing ${todos.length} todos for user: ${user.id}`);

    // Convert todos to database format
    const todosToSync = todos.map((todo) => todoToDb(todo, user.id));
    
    if (todosToSync.length === 0) {
      console.log('No todos to sync');
      return { error: null };
    }

    // Upsert todos (insert or update)
    // Use type assertion to work around Supabase type inference issues
    const todosTable = client.from('todos') as unknown as {
      upsert: (
        values: Database['public']['Tables']['todos']['Insert'][],
        options?: { onConflict?: string; ignoreDuplicates?: boolean }
      ) => {
        select: () => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
      };
    };
    
    const { data, error } = await todosTable.upsert(todosToSync, {
      onConflict: 'id',
      ignoreDuplicates: false,
    }).select();

    if (error) {
      console.error('Sync todos to cloud error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Todos being synced (first):', JSON.stringify(todosToSync.slice(0, 1), null, 2));
      console.error('User ID:', user.id);
      return { error: new Error(error.message) };
    }

    console.log(`Successfully synced ${todosToSync.length} todos to cloud, returned ${data ? (Array.isArray(data) ? data.length : 1) : 0} records`);

    // Update sync status
    await updateSyncStatus({
      todos: { lastSync: new Date().toISOString(), pending: false },
    });

    return { error: null };
  } catch (error) {
    console.error('Sync todos to cloud exception:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to sync todos'),
    };
  }
}

/**
 * Sync todos from cloud
 * Merges cloud data with local data using Last Write Wins strategy
 */
export async function syncTodosFromCloud(): Promise<{ todos: Todo[]; error: Error | null }> {
  const client = await getSupabaseClient();
  if (!client) {
    return { todos: [], error: new Error('Supabase not configured') };
  }

  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return { todos: [], error: new Error('User not authenticated') };
    }

    // Fetch todos from cloud
    const { data, error } = await client
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Sync todos from cloud error:', error);
      return { todos: [], error: new Error(error.message) };
    }

    // Convert to app format
    const cloudTodos = (data || []).map(todoFromDb);

    // Get local todos
    const localResult = await chrome.storage.local.get('todos');
    const localTodos: Todo[] = (localResult.todos || []).map((t: Record<string, unknown>) => ({
      ...t,
      createdAt: new Date(t.createdAt as string),
      updatedAt: new Date(t.updatedAt as string),
      deadline: t.deadline ? new Date(t.deadline as string) : undefined,
      reminder: t.reminder ? new Date(t.reminder as string) : undefined,
      completedAt: t.completedAt ? new Date(t.completedAt as string) : undefined,
    })) as Todo[];

    // Merge using Last Write Wins (compare updated_at)
    const mergedTodos = new Map<string, Todo>();

    // Add local todos
    for (const todo of localTodos) {
      mergedTodos.set(todo.id, todo);
    }

    // Merge cloud todos (cloud wins if updated_at is newer)
    for (const cloudTodo of cloudTodos) {
      const localTodo = mergedTodos.get(cloudTodo.id);
      if (!localTodo || cloudTodo.updatedAt >= localTodo.updatedAt) {
        mergedTodos.set(cloudTodo.id, cloudTodo);
      }
    }

    const finalTodos = Array.from(mergedTodos.values());

    // Update sync status
    await updateSyncStatus({
      todos: { lastSync: new Date().toISOString(), pending: false },
    });

    return { todos: finalTodos, error: null };
  } catch (error) {
    console.error('Sync todos from cloud exception:', error);
    return {
      todos: [],
      error: error instanceof Error ? error : new Error('Failed to sync todos'),
    };
  }
}

/**
 * Sync knowledge items to cloud
 */
export async function syncKnowledgeToCloud(
  items: KnowledgeItem[]
): Promise<{ error: Error | null }> {
  const client = await getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    // Convert to database format
    const itemsToSync = items.map((item) => knowledgeToDb(item, user.id));

    // Upsert knowledge items
    // Use type assertion to work around Supabase type inference issues
    const knowledgeTable = client.from('knowledge_items') as unknown as {
      upsert: (
        values: Database['public']['Tables']['knowledge_items']['Insert'][],
        options?: { onConflict?: string; ignoreDuplicates?: boolean }
      ) => {
        select: () => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;
      };
    };
    
    const { data: knowledgeData, error } = await knowledgeTable.upsert(itemsToSync, {
      onConflict: 'id',
      ignoreDuplicates: false,
    }).select();

    if (error) {
      console.error('Sync knowledge to cloud error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return { error: new Error(error.message) };
    }

    console.log(`Successfully synced ${itemsToSync.length} knowledge items to cloud, returned ${knowledgeData ? (Array.isArray(knowledgeData) ? knowledgeData.length : 1) : 0} records`);

    // Update sync status
    await updateSyncStatus({
      knowledge: { lastSync: new Date().toISOString(), pending: false },
    });

    return { error: null };
  } catch (error) {
    console.error('Sync knowledge to cloud exception:', error);
    return {
      error: error instanceof Error ? error : new Error('Failed to sync knowledge'),
    };
  }
}

/**
 * Sync knowledge items from cloud
 */
export async function syncKnowledgeFromCloud(): Promise<{
  items: KnowledgeItem[];
  error: Error | null;
}> {
  const client = await getSupabaseClient();
  if (!client) {
    return { items: [], error: new Error('Supabase not configured') };
  }

  try {
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      return { items: [], error: new Error('User not authenticated') };
    }

    // Fetch knowledge items from cloud
    const { data, error } = await client
      .from('knowledge_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Sync knowledge from cloud error:', error);
      return { items: [], error: new Error(error.message) };
    }

    // Convert to app format
    const cloudItems = (data || []).map(knowledgeFromDb);

    // Get local items (from IndexedDB via chrome.storage)
    // Note: Knowledge items are stored in IndexedDB, but we'll sync via a queue
    const localResult = await chrome.storage.local.get('knowledge_queue');
    const localItems: KnowledgeItem[] = (localResult.knowledge_queue || []).map(
      (item: Record<string, unknown>) => ({
        ...item,
        createdAt: new Date(item.createdAt as string),
        updatedAt: new Date(item.updatedAt as string),
        publishedAt: item.publishedAt ? new Date(item.publishedAt as string) : undefined,
      })
    ) as KnowledgeItem[];

    // Merge using Last Write Wins
    const mergedItems = new Map<string, KnowledgeItem>();

    // Add local items
    for (const item of localItems) {
      mergedItems.set(item.id, item);
    }

    // Merge cloud items
    for (const cloudItem of cloudItems) {
      const localItem = mergedItems.get(cloudItem.id);
      if (!localItem || cloudItem.updatedAt >= localItem.updatedAt) {
        mergedItems.set(cloudItem.id, cloudItem);
      }
    }

    const finalItems = Array.from(mergedItems.values());

    // Update sync status
    await updateSyncStatus({
      knowledge: { lastSync: new Date().toISOString(), pending: false },
    });

    return { items: finalItems, error: null };
  } catch (error) {
    console.error('Sync knowledge from cloud exception:', error);
    return {
      items: [],
      error: error instanceof Error ? error : new Error('Failed to sync knowledge'),
    };
  }
}

/**
 * Get sync status
 */
export async function getSyncStatusInfo(): Promise<SyncStatus> {
  return getSyncStatus();
}

/**
 * Mark sync as pending (for retry logic)
 */
export async function markSyncPending(type: 'todos' | 'knowledge'): Promise<void> {
  const current = await getSyncStatus();
  await updateSyncStatus({
    [type]: { ...current[type], pending: true },
  });
}
