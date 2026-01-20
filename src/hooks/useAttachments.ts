/**
 * React hook for managing TODO attachments
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';
import {
  saveAttachment,
  getAttachmentsByTodo,
  deleteAttachment,
  deleteAttachmentsByTodo,
  createThumbnail,
  getAttachmentUrl,
  getThumbnailUrl,
  type AttachmentData,
  type AttachmentMeta,
} from '@/utils/indexeddb';

interface UseAttachmentsResult {
  attachments: AttachmentMeta[];
  isLoading: boolean;
  error: Error | null;
  addAttachment: (file: File) => Promise<AttachmentMeta>;
  addAttachments: (files: File[]) => Promise<AttachmentMeta[]>;
  removeAttachment: (id: string) => Promise<void>;
  removeAllAttachments: () => Promise<void>;
  getUrl: (id: string) => Promise<string | null>;
  getThumbnail: (id: string) => Promise<string | null>;
}

/**
 * Hook for managing attachments for a specific TODO
 */
export function useAttachments(todoId: string): UseAttachmentsResult {
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load attachments for this todo
  useEffect(() => {
    const loadAttachments = async () => {
      try {
        setIsLoading(true);
        const data = await getAttachmentsByTodo(todoId);
        const metas: AttachmentMeta[] = data.map(({ blob: _, thumbnail: __, ...meta }) => meta);
        setAttachments(metas);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load attachments'));
      } finally {
        setIsLoading(false);
      }
    };

    if (todoId) {
      loadAttachments();
    }
  }, [todoId]);

  // Add a single attachment
  const addAttachment = useCallback(
    async (file: File): Promise<AttachmentMeta> => {
      const id = crypto.randomUUID();
      const isImage = file.type.startsWith('image/');

      // Read file as blob
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });

      // Create thumbnail for images
      let thumbnail: Blob | undefined;
      if (isImage) {
        try {
          thumbnail = await createThumbnail(blob);
        } catch (err) {
          console.warn('Failed to create thumbnail:', err);
        }
      }

      const attachmentData: AttachmentData = {
        id,
        todoId,
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
        blob,
        thumbnail,
        createdAt: new Date().toISOString(),
      };

      await saveAttachment(attachmentData);

      const meta: AttachmentMeta = {
        id,
        todoId,
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
        createdAt: attachmentData.createdAt,
      };

      setAttachments((prev) => [...prev, meta]);
      return meta;
    },
    [todoId]
  );

  // Add multiple attachments
  const addAttachments = useCallback(
    async (files: File[]): Promise<AttachmentMeta[]> => {
      const results = await Promise.all(files.map(addAttachment));
      return results;
    },
    [addAttachment]
  );

  // Remove an attachment
  const removeAttachment = useCallback(
    async (id: string) => {
      await deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    },
    []
  );

  // Remove all attachments for this todo
  const removeAllAttachments = useCallback(async () => {
    await deleteAttachmentsByTodo(todoId);
    setAttachments([]);
  }, [todoId]);

  // Get blob URL for an attachment
  const getUrl = useCallback(async (id: string): Promise<string | null> => {
    return getAttachmentUrl(id);
  }, []);

  // Get thumbnail URL for an attachment
  const getThumbnail = useCallback(async (id: string): Promise<string | null> => {
    return getThumbnailUrl(id);
  }, []);

  return {
    attachments,
    isLoading,
    error,
    addAttachment,
    addAttachments,
    removeAttachment,
    removeAllAttachments,
    getUrl,
    getThumbnail,
  };
}

/**
 * Hook for managing attachments during TODO creation (before save)
 * Uses temporary IDs that will be updated after TODO is saved
 */
export function usePendingAttachments(): {
  pendingFiles: File[];
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  saveToTodo: (todoId: string) => Promise<AttachmentMeta[]>;
} {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const addFiles = useCallback((files: File[]) => {
    setPendingFiles((prev) => [...prev, ...files]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearFiles = useCallback(() => {
    setPendingFiles([]);
  }, []);

  const saveToTodo = useCallback(async (todoId: string): Promise<AttachmentMeta[]> => {
    if (pendingFiles.length === 0) return [];

    const results: AttachmentMeta[] = [];

    for (const file of pendingFiles) {
      const id = crypto.randomUUID();
      const isImage = file.type.startsWith('image/');
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });

      let thumbnail: Blob | undefined;
      if (isImage) {
        try {
          thumbnail = await createThumbnail(blob);
        } catch (err) {
          console.warn('Failed to create thumbnail:', err);
        }
      }

      const attachmentData: AttachmentData = {
        id,
        todoId,
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
        blob,
        thumbnail,
        createdAt: new Date().toISOString(),
      };

      await saveAttachment(attachmentData);

      results.push({
        id,
        todoId,
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
        createdAt: attachmentData.createdAt,
      });
    }

    setPendingFiles([]);
    return results;
  }, [pendingFiles]);

  return {
    pendingFiles,
    addFiles,
    removeFile,
    clearFiles,
    saveToTodo,
  };
}

// Export types
export type { UseAttachmentsResult };

