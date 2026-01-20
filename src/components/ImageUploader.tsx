/**
 * Image uploader component with paste support
 * @author haiping.yu@zoom.us
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Image, X, Upload, Clipboard } from 'lucide-react';

interface ImageUploaderProps {
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  files,
  onAdd,
  onRemove,
  maxFiles = 10,
  maxSizeMB = 10,
  accept = 'image/*',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Preview URLs for files
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Create preview URLs when files change
  useEffect(() => {
    // Revoke old URLs
    previewUrls.forEach(URL.revokeObjectURL);

    // Create new URLs
    const newUrls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(newUrls);

    return () => {
      newUrls.forEach(URL.revokeObjectURL);
    };
  }, [files]);

  const validateFiles = useCallback(
    (newFiles: File[]): File[] => {
      const validFiles: File[] = [];
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      for (const file of newFiles) {
        // Check if image
        if (!file.type.startsWith('image/')) {
          setError(`${file.name} is not an image`);
          continue;
        }

        // Check size
        if (file.size > maxSizeBytes) {
          setError(`${file.name} exceeds ${maxSizeMB}MB limit`);
          continue;
        }

        // Check total count
        if (files.length + validFiles.length >= maxFiles) {
          setError(`Maximum ${maxFiles} files allowed`);
          break;
        }

        validFiles.push(file);
      }

      // Clear error after 3 seconds
      if (error) {
        setTimeout(() => setError(null), 3000);
      }

      return validFiles;
    },
    [files.length, maxFiles, maxSizeMB, error]
  );

  const handleFileSelect = useCallback(
    (selectedFiles: FileList | null) => {
      if (!selectedFiles) return;
      const validFiles = validateFiles(Array.from(selectedFiles));
      if (validFiles.length > 0) {
        onAdd(validFiles);
      }
    },
    [validateFiles, onAdd]
  );

  // Handle paste event
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // Generate a meaningful filename
            const ext = item.type.split('/')[1] || 'png';
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const namedFile = new File([file], `pasted-image-${timestamp}.${ext}`, {
              type: file.type,
            });
            imageFiles.push(namedFile);
          }
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        const validFiles = validateFiles(imageFiles);
        if (validFiles.length > 0) {
          onAdd(validFiles);
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [validateFiles, onAdd]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = e.dataTransfer.files;
      handleFileSelect(droppedFiles);
    },
    [handleFileSelect]
  );

  return (
    <div className="space-y-2">
      {/* Drop zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer',
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="sr-only"
        />

        <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
          <div className="flex gap-2">
            <Upload className="w-5 h-5" />
            <Clipboard className="w-5 h-5" />
          </div>
          <p className="text-sm text-center">
            <span className="font-medium text-primary-600 dark:text-primary-400">
              Click to upload
            </span>
            , drag & drop, or paste images
          </p>
          <p className="text-xs">Max {maxSizeMB}MB per file, up to {maxFiles} files</p>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
            >
              {previewUrls[index] ? (
                <img
                  src={previewUrls[index]}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-6 h-6 text-gray-400" />
                </div>
              )}

              {/* Remove button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(index);
                }}
                className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>

              {/* File name tooltip */}
              <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/50 text-white text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                {file.name}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

