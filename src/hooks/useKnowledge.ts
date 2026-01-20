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
 * Hook for managing knowledge base
 */
export function useKnowledge() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  // Load knowledge items from IndexedDB
  const loadItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAllKnowledge();
      setItems(data.map(dbToKnowledge));

      // Load categories and tags
      const cats = await getKnowledgeCategories();
      setCategories(cats);

      const tags = await getKnowledgeTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load knowledge items:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // Add a new knowledge item
  const addItem = useCallback(
    async (input: AddKnowledgeInput): Promise<KnowledgeItem> => {
      const now = new Date().toISOString();
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
        createdAt: now,
        updatedAt: now,
      };

      await saveKnowledge(data);

      const newItem = dbToKnowledge(data);
      setItems((prev) => [newItem, ...prev]);

      return newItem;
    },
    []
  );

  // Update a knowledge item
  const updateItem = useCallback(
    async (
      id: string,
      updates: Partial<Omit<KnowledgeItem, 'id' | 'createdAt'>>
    ): Promise<void> => {
      const dbUpdates: Partial<Omit<KnowledgeData, 'id' | 'createdAt'>> = {};

      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
      if (updates.keywords !== undefined) dbUpdates.keywords = updates.keywords;
      if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.processingError !== undefined) dbUpdates.processingError = updates.processingError;

      await updateKnowledgeDB(id, dbUpdates);

      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, ...updates, updatedAt: new Date() }
            : item
        )
      );
    },
    []
  );

  // Delete a knowledge item
  const deleteItem = useCallback(async (id: string): Promise<void> => {
    await deleteKnowledgeDB(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

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

