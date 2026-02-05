/**
 * React hook for managing knowledge base items
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';
import type { KnowledgeItem, KnowledgeStatus } from '@/types';
import {
  getAllKnowledge,
  saveKnowledge,
  updateKnowledge as updateKnowledgeDB,
  deleteKnowledge as deleteKnowledgeDB,
  searchKnowledge as searchKnowledgeDB,
  getKnowledgeCategories,
  getKnowledgeTags,
  type KnowledgeData,
} from '@/utils/indexeddb';
import { syncKnowledgeToCloud, syncKnowledgeFromCloud, syncKnowledgeDeleteFromCloud } from '@/utils/sync';
import { generateEmbedding } from '@/utils/embeddings';
import { useAuth } from './useAuth';

/**
 * Input for adding a new knowledge item
 */
export interface AddKnowledgeInput {
  url?: string;
  title: string;
  content?: string;
  summary?: string;
  keywords?: string[];
  tags?: string[];
  category?: string;
  source?: string;
  author?: string;
  publishedAt?: Date;
  favicon?: string;
}

/**
 * Convert database format to application format
 */
function dbToKnowledge(data: KnowledgeData): KnowledgeItem {
  return {
    id: data.id,
    type: data.url ? 'article' : 'note',
    url: data.url,
    title: data.title,
    content: data.content,
    summary: data.summary,
    keywords: data.keywords,
    tags: data.tags,
    category: data.category,
    source: data.source,
    author: data.author,
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : undefined,
    status: data.status,
    processingError: data.processingError,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
}

/**
 * Hook for managing knowledge base with cloud sync
 */
export function useKnowledge() {
  const { isAuthenticated, isConfigured } = useAuth();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Load knowledge items from IndexedDB and sync from cloud if authenticated
  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // First load from IndexedDB
      const data = await getAllKnowledge();
      const localItems = data.map(dbToKnowledge);
      setItems(localItems);

      // Load categories and tags
      const cats = await getKnowledgeCategories();
      setCategories(cats);

      const tags = await getKnowledgeTags();
      setAllTags(tags);

      // If authenticated and Supabase is configured, sync from cloud
      if (isAuthenticated && isConfigured) {
        try {
          const { items: cloudItems, error: syncError } = await syncKnowledgeFromCloud();
          if (!syncError) {
            // Merge with local by updatedAt (last-write-wins)
            // Use strict > so local "ready" isn't overwritten by cloud "pending" with same timestamp
            const mergedMap = new Map<string, KnowledgeItem>();
            for (const item of localItems) mergedMap.set(item.id, item);
            for (const item of cloudItems) {
              const local = mergedMap.get(item.id);
              if (!local || item.updatedAt > local.updatedAt) mergedMap.set(item.id, item);
            }
            const merged = Array.from(mergedMap.values());
            setItems(merged);

            for (const item of merged) {
              await saveKnowledge({
                id: item.id,
                url: item.url,
                title: item.title,
                content: item.content || '',
                summary: item.summary,
                keywords: item.keywords || [],
                tags: item.tags || [],
                category: item.category,
                source: item.source,
                author: item.author,
                publishedAt: item.publishedAt?.toISOString(),
                status: item.status,
                processingError: item.processingError,
                createdAt: item.createdAt.toISOString(),
                updatedAt: item.updatedAt.toISOString(),
              });
            }
          } else if (syncError) {
            console.warn('Failed to sync knowledge from cloud:', syncError);
          }
        } catch (syncErr) {
          console.warn('Error syncing knowledge from cloud:', syncErr);
        }
      }
    } catch (error) {
      console.error('Failed to load knowledge items:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, isConfigured]);

  // Initial load
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Add a new knowledge item
  const addItem = useCallback(
    async (input: AddKnowledgeInput): Promise<KnowledgeItem> => {
      const now = new Date();
      const id = crypto.randomUUID();

      const data: KnowledgeData = {
        id,
        url: input.url,
        title: input.title,
        content: input.content || '',
        summary: input.summary,
        keywords: input.keywords || [],
        tags: input.tags || [],
        category: input.category,
        source: input.source,
        author: input.author,
        publishedAt: input.publishedAt?.toISOString(),
        status: 'pending',
        favicon: input.favicon,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      await saveKnowledge(data);

      const newItem = dbToKnowledge(data);
      
      // Use functional update to get latest items and sync with new item
      let latestItems: KnowledgeItem[] = [];
      setItems((prev) => {
        latestItems = [newItem, ...prev];
        return latestItems;
      });

      // Sync to cloud if authenticated
      if (isAuthenticated && isConfigured) {
        // Use latestItems which includes the new item
        syncKnowledgeToCloud(latestItems).catch((err) => {
          console.warn('Failed to sync knowledge to cloud:', err);
        });

        // Generate embedding if content is available and status is ready
        if (input.content && newItem.status === 'ready') {
          generateEmbedding(newItem.id, input.content).catch((err) => {
            console.warn('Failed to generate embedding:', err);
          });
        }
      }

      return newItem;
    },
    [isAuthenticated, isConfigured]
  );

  // Update a knowledge item
  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<Omit<KnowledgeItem, 'id' | 'createdAt'>>
    ): Promise<void> => {
      const now = new Date();
      const dbUpdates: Partial<Omit<KnowledgeData, 'id' | 'createdAt'>> = {
        updatedAt: now.toISOString(), // Always update timestamp
      };

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
      if (updates.keywords !== undefined) dbUpdates.keywords = updates.keywords;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.processingError !== undefined) dbUpdates.processingError = updates.processingError;

      await updateKnowledgeDB(id, dbUpdates);

      // Use functional update to get latest items (avoids stale closure)
      let updatedItems: KnowledgeItem[] = [];
      setItems((prev) => {
        updatedItems = prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: now }
            : item
        );
        return updatedItems;
      });

      if (isAuthenticated && isConfigured) {
        // Why we await when status === 'ready' or 'processing': syncKnowledgeToCloud was previously fire-and-forget.
        // The Supabase write is async; if we don't wait, processWithAI returns and the user can
        // switch to Knowledge tab before the write completes. loadItems() then pulls from cloud,
        // gets stale "processing", and overwrites local "ready". So we await so Supabase has the
        // new status before the caller continues.
        // We pass forceIds to ensure this specific item is synced even if updatedAt <= lastSync (same millisecond edge case).
        if (updates.status === 'ready' || updates.status === 'processing') {
          const { error } = await syncKnowledgeToCloud(updatedItems, [id]);
          if (error) console.warn('Failed to sync knowledge to cloud:', error);
        } else {
          syncKnowledgeToCloud(updatedItems, [id]).catch((err) => {
            console.warn('Failed to sync knowledge to cloud:', err);
          });
        }

        // Generate embedding if status changed to ready and content is available
        if (updates.status === 'ready') {
          const updatedItem = updatedItems.find(item => item.id === id);
          if (updatedItem && updatedItem.content) {
            // Combine title, summary, and content for better embedding
            const contentForEmbedding = [
              updatedItem.title,
              updatedItem.summary || '',
              updatedItem.content,
            ].filter(Boolean).join('\n\n');

            generateEmbedding(id, contentForEmbedding).catch((err) => {
              console.warn('Failed to generate embedding:', err);
            });
          }
        }
      }
    },
    [isAuthenticated, isConfigured]
  );

  // Delete a knowledge item
  const deleteItem = useCallback(async (id: string): Promise<void> => {
    // Use functional update to avoid stale closure
    setItems((prev) => prev.filter((item) => item.id !== id));

    await deleteKnowledgeDB(id);

    // Delete from cloud so it does not reappear on next sync
    if (isAuthenticated && isConfigured) {
      syncKnowledgeDeleteFromCloud(id).catch((err) => {
        console.warn('Failed to delete knowledge from cloud:', err);
      });
    }
  }, [isAuthenticated, isConfigured]);

  // Search knowledge items
  const search = useCallback(
    async (query: string): Promise<KnowledgeItem[]> => {
      if (!query.trim()) {
        return items;
      }

      const results = await searchKnowledgeDB(query);
      return results.map(dbToKnowledge);
    },
    [items]
  );

  // Update item status
  const updateStatus = useCallback(
    async (id: string, status: KnowledgeStatus, error?: string): Promise<void> => {
      await updateItem(id, { status, processingError: error });
    },
    [updateItem]
  );

  // Filter items by status
  const getItemsByStatus = useCallback(
    (status: KnowledgeStatus): KnowledgeItem[] => {
      return items.filter((item) => item.status === status);
    },
    [items]
  );

  // Filter items by category
  const getItemsByCategory = useCallback(
    (category: string): KnowledgeItem[] => {
      return items.filter((item) => item.category === category);
    },
    [items]
  );

  // Filter items by tag
  const getItemsByTag = useCallback(
    (tag: string): KnowledgeItem[] => {
      return items.filter((item) => item.tags.includes(tag));
    },
    [items]
  );

  return {
    items,
    isLoading,
    categories,
    allTags,
    addItem,
    updateItem,
    deleteItem,
    search,
    updateStatus,
    getItemsByStatus,
    getItemsByCategory,
    getItemsByTag,
    refresh: loadItems,
  };
}

/**
 * Hook for managing pending knowledge items (items being added)
 */
export function usePendingKnowledge() {
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addPendingUrl = useCallback((url: string) => {
    setPendingUrls((prev) => {
      if (prev.includes(url)) return prev;
      return [...prev, url];
    });
  }, []);

  const removePendingUrl = useCallback((url: string) => {
    setPendingUrls((prev) => prev.filter((u) => u !== url));
  }, []);

  const clearPending = useCallback(() => {
    setPendingUrls([]);
  }, []);

  return {
    pendingUrls,
    isProcessing,
    setIsProcessing,
    addPendingUrl,
    removePendingUrl,
    clearPending,
  };
}

