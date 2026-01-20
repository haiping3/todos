/**
 * Chrome Storage utilities with type safety
 * @author haiping.yu@zoom.us
 */

import type { UserSettings, Todo, KnowledgeItem } from '@/types';

// Storage schema
interface StorageSchema {
  settings: UserSettings;
  todos: Todo[];
  knowledgeItems: KnowledgeItem[];
  syncQueue: SyncQueueItem[];
}

interface SyncQueueItem {
  id: string;
  type: 'todo' | 'knowledge';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: number;
}

/**
 * Get value from Chrome storage
 */
export async function getStorage<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | undefined> {
  const result = await chrome.storage.local.get(key);
  return result[key] as StorageSchema[K] | undefined;
}

/**
 * Set value in Chrome storage
 */
export async function setStorage<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

/**
 * Remove value from Chrome storage
 */
export async function removeStorage<K extends keyof StorageSchema>(
  key: K
): Promise<void> {
  await chrome.storage.local.remove(key);
}

/**
 * Get all storage data
 */
export async function getAllStorage(): Promise<Partial<StorageSchema>> {
  return chrome.storage.local.get() as Promise<Partial<StorageSchema>>;
}

/**
 * Clear all storage data
 */
export async function clearStorage(): Promise<void> {
  await chrome.storage.local.clear();
}

/**
 * Listen for storage changes
 */
export function onStorageChange(
  callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local') {
      callback(changes);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

/**
 * Get storage usage info
 */
export async function getStorageUsage(): Promise<{
  bytesUsed: number;
  bytesRemaining: number;
  percentUsed: number;
}> {
  const bytesUsed = await chrome.storage.local.getBytesInUse();
  const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB default
  
  return {
    bytesUsed,
    bytesRemaining: quota - bytesUsed,
    percentUsed: (bytesUsed / quota) * 100,
  };
}

