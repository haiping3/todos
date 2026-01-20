/**
 * IndexedDB utilities for storing large data (attachments, knowledge content)
 * @author haiping.yu@zoom.us
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Database schema
interface AppDB extends DBSchema {
  attachments: {
    key: string;
    value: {
      id: string;
      todoId: string;
      name: string;
      type: 'image' | 'file';
      mimeType: string;
      size: number;
      blob: Blob;
      thumbnail?: Blob;
      createdAt: string;
    };
    indexes: {
      'by-todo': string;
    };
  };
  knowledge: {
    key: string;
    value: {
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
    };
    indexes: {
      'by-status': string;
      'by-category': string;
      'by-created': string;
    };
  };
}

const DB_NAME = 'ai-assistant-db';
const DB_VERSION = 2; // Bumped version for knowledge store

let dbInstance: IDBPDatabase<AppDB> | null = null;

/**
 * Get or create the database instance
 */
async function getDB(): Promise<IDBPDatabase<AppDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<AppDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Create attachments store
      if (!db.objectStoreNames.contains('attachments')) {
        const store = db.createObjectStore('attachments', { keyPath: 'id' });
        store.createIndex('by-todo', 'todoId');
      }

      // Create knowledge store (version 2+)
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('knowledge')) {
          const store = db.createObjectStore('knowledge', { keyPath: 'id' });
          store.createIndex('by-status', 'status');
          store.createIndex('by-category', 'category');
          store.createIndex('by-created', 'createdAt');
        }
      }
    },
  });

  return dbInstance;
}

// ============================================================================
// Attachment Functions
// ============================================================================

/**
 * Attachment data without blob (for listing)
 */
export interface AttachmentMeta {
  id: string;
  todoId: string;
  name: string;
  type: 'image' | 'file';
  mimeType: string;
  size: number;
  createdAt: string;
}

/**
 * Full attachment data with blob
 */
export interface AttachmentData extends AttachmentMeta {
  blob: Blob;
  thumbnail?: Blob;
}

/**
 * Save an attachment to IndexedDB
 */
export async function saveAttachment(attachment: AttachmentData): Promise<void> {
  const db = await getDB();
  await db.put('attachments', attachment);
}

/**
 * Get an attachment by ID
 */
export async function getAttachment(id: string): Promise<AttachmentData | undefined> {
  const db = await getDB();
  return db.get('attachments', id);
}

/**
 * Get all attachments for a TODO
 */
export async function getAttachmentsByTodo(todoId: string): Promise<AttachmentData[]> {
  const db = await getDB();
  return db.getAllFromIndex('attachments', 'by-todo', todoId);
}

/**
 * Get attachment metadata only (without blob) for a TODO
 */
export async function getAttachmentMetasByTodo(todoId: string): Promise<AttachmentMeta[]> {
  const attachments = await getAttachmentsByTodo(todoId);
  return attachments.map(({ blob: _, thumbnail: __, ...meta }) => meta);
}

/**
 * Delete an attachment by ID
 */
export async function deleteAttachment(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('attachments', id);
}

/**
 * Delete all attachments for a TODO
 */
export async function deleteAttachmentsByTodo(todoId: string): Promise<void> {
  const db = await getDB();
  const attachments = await db.getAllFromIndex('attachments', 'by-todo', todoId);
  const tx = db.transaction('attachments', 'readwrite');
  
  await Promise.all([
    ...attachments.map((a) => tx.store.delete(a.id)),
    tx.done,
  ]);
}

/**
 * Get a blob URL for an attachment (for displaying images)
 */
export async function getAttachmentUrl(id: string): Promise<string | null> {
  const attachment = await getAttachment(id);
  if (!attachment) return null;
  return URL.createObjectURL(attachment.blob);
}

/**
 * Get a thumbnail URL for an attachment
 */
export async function getThumbnailUrl(id: string): Promise<string | null> {
  const attachment = await getAttachment(id);
  if (!attachment?.thumbnail) return null;
  return URL.createObjectURL(attachment.thumbnail);
}

/**
 * Create a thumbnail from an image blob
 */
export async function createThumbnail(
  blob: Blob,
  maxSize: number = 200
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate thumbnail dimensions
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      // Create canvas and draw thumbnail
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (thumbnailBlob) => {
          if (thumbnailBlob) {
            resolve(thumbnailBlob);
          } else {
            reject(new Error('Failed to create thumbnail'));
          }
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Get total storage usage for attachments
 */
export async function getStorageUsage(): Promise<{
  count: number;
  totalSize: number;
}> {
  const db = await getDB();
  const attachments = await db.getAll('attachments');
  
  return {
    count: attachments.length,
    totalSize: attachments.reduce((sum, a) => sum + a.size, 0),
  };
}

/**
 * Clear all attachments (for debugging/reset)
 */
export async function clearAllAttachments(): Promise<void> {
  const db = await getDB();
  await db.clear('attachments');
}

// ============================================================================
// Knowledge Functions
// ============================================================================

/**
 * Knowledge item data stored in IndexedDB
 */
export interface KnowledgeData {
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

/**
 * Save a knowledge item to IndexedDB
 */
export async function saveKnowledge(item: KnowledgeData): Promise<void> {
  const db = await getDB();
  await db.put('knowledge', item);
}

/**
 * Get a knowledge item by ID
 */
export async function getKnowledge(id: string): Promise<KnowledgeData | undefined> {
  const db = await getDB();
  return db.get('knowledge', id);
}

/**
 * Get all knowledge items
 */
export async function getAllKnowledge(): Promise<KnowledgeData[]> {
  const db = await getDB();
  const items = await db.getAll('knowledge');
  // Sort by createdAt descending (newest first)
  return items.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get knowledge items by status
 */
export async function getKnowledgeByStatus(
  status: KnowledgeData['status']
): Promise<KnowledgeData[]> {
  const db = await getDB();
  return db.getAllFromIndex('knowledge', 'by-status', status);
}

/**
 * Get knowledge items by category
 */
export async function getKnowledgeByCategory(category: string): Promise<KnowledgeData[]> {
  const db = await getDB();
  return db.getAllFromIndex('knowledge', 'by-category', category);
}

/**
 * Update a knowledge item
 */
export async function updateKnowledge(
  id: string,
  updates: Partial<Omit<KnowledgeData, 'id' | 'createdAt'>>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('knowledge', id);
  
  if (!existing) {
    throw new Error(`Knowledge item not found: ${id}`);
  }

  await db.put('knowledge', {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Delete a knowledge item
 */
export async function deleteKnowledge(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('knowledge', id);
}

/**
 * Search knowledge items by title or content (simple text search)
 */
export async function searchKnowledge(query: string): Promise<KnowledgeData[]> {
  const db = await getDB();
  const items = await db.getAll('knowledge');
  const lowerQuery = query.toLowerCase();

  return items.filter((item) => {
    const searchableText = [
      item.title,
      item.content,
      item.summary,
      ...item.keywords,
      ...item.tags,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(lowerQuery);
  });
}

/**
 * Get all unique categories from knowledge items
 */
export async function getKnowledgeCategories(): Promise<string[]> {
  const db = await getDB();
  const items = await db.getAll('knowledge');
  const categories = new Set(items.map((i) => i.category).filter(Boolean));
  return Array.from(categories) as string[];
}

/**
 * Get all unique tags from knowledge items
 */
export async function getKnowledgeTags(): Promise<string[]> {
  const db = await getDB();
  const items = await db.getAll('knowledge');
  const tags = new Set(items.flatMap((i) => i.tags));
  return Array.from(tags);
}

/**
 * Get knowledge stats
 */
export async function getKnowledgeStats(): Promise<{
  total: number;
  byStatus: Record<KnowledgeData['status'], number>;
}> {
  const db = await getDB();
  const items = await db.getAll('knowledge');

  const byStatus: Record<KnowledgeData['status'], number> = {
    pending: 0,
    processing: 0,
    ready: 0,
    error: 0,
  };

  for (const item of items) {
    byStatus[item.status]++;
  }

  return {
    total: items.length,
    byStatus,
  };
}

/**
 * Clear all knowledge items (for debugging/reset)
 */
export async function clearAllKnowledge(): Promise<void> {
  const db = await getDB();
  await db.clear('knowledge');
}
