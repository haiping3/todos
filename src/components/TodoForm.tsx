/**
 * TODO form component for adding/editing todos
 * Smart input: auto-generates title from long content
 * @author haiping.yu@zoom.us
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus, Bell, Tag, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import type { Todo, TodoPriority } from '@/types';
import { Button } from './Button';
import { Input } from './Input';
import { PrioritySelect } from './PrioritySelect';
import { ImageUploader } from './ImageUploader';
import { DateTimePicker } from './DateTimePicker';
import { usePendingAttachments } from '@/hooks/useAttachments';
import { summarizeContent, localSummarize, isAIConfigured } from '@/utils/ai';

interface TodoFormProps {
  mode: 'add' | 'edit';
  todo?: Todo;
  onSubmit: (data: TodoFormData, files: File[]) => Promise<void>;
  onCancel: () => void;
}

export interface TodoFormData {
  title: string;
  description: string;
  priority: TodoPriority;
  deadline?: Date;
  reminder?: Date;
  tags: string[];
}

// Threshold for auto-summarization (characters)
const SUMMARY_THRESHOLD = 80;

export const TodoForm: React.FC<TodoFormProps> = ({
  mode,
  todo,
  onSubmit,
  onCancel,
}) => {
  // For add mode: single content input that may become title or description
  const [content, setContent] = useState('');
  // For edit mode or after AI summary: explicit title/description
  const [title, setTitle] = useState(todo?.title || '');
  const [description, setDescription] = useState(todo?.description || '');
  const [isManualMode, setIsManualMode] = useState(mode === 'edit');
  
  const [priority, setPriority] = useState<TodoPriority>(todo?.priority || 'medium');
  const [deadline, setDeadline] = useState<Date | undefined>(todo?.deadline);
  const [reminder, setReminder] = useState<Date | undefined>(todo?.reminder);
  const [tags, setTags] = useState<string[]>(todo?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(todo?.description || (todo?.tags && todo.tags.length > 0))
  );

  const { pendingFiles, addFiles, removeFile, clearFiles } = usePendingAttachments();
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Focus appropriate input on mount
  useEffect(() => {
    if (isManualMode) {
      titleInputRef.current?.focus();
    } else {
      contentInputRef.current?.focus();
    }
  }, [isManualMode]);

  // Check if content is long enough to need summarization
  const needsSummary = content.length > SUMMARY_THRESHOLD;

  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // Check if AI is configured on mount
  useEffect(() => {
    isAIConfigured().then(setAiConfigured);
  }, []);

  // AI summarization - uses configured AI service or falls back to local
  const handleAISummarize = useCallback(async () => {
    if (!content.trim() || content.length <= SUMMARY_THRESHOLD) return;
    
    setIsSummarizing(true);
    setAiError(null);
    
    try {
      let summary: string;
      
      if (aiConfigured) {
        // Use AI service
        summary = await summarizeContent(content);
      } else {
        // Fallback to local summarization
        summary = localSummarize(content);
      }
      
      setTitle(summary);
      setDescription(content);
      setIsManualMode(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI summarization failed';
      setAiError(message);
      // Still allow using local summary as fallback
      const fallbackSummary = localSummarize(content);
      setTitle(fallbackSummary);
      setDescription(content);
      setIsManualMode(true);
    } finally {
      setIsSummarizing(false);
    }
  }, [content, aiConfigured]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalTitle: string;
    let finalDescription: string;
    
    if (isManualMode) {
      // Use explicit title and description
      finalTitle = title.trim();
      finalDescription = description.trim();
    } else {
      // Determine if content should be title or needs summary
      const trimmedContent = content.trim();
      if (trimmedContent.length <= SUMMARY_THRESHOLD) {
        // Short content - use as title directly
        finalTitle = trimmedContent;
        finalDescription = '';
      } else {
        // Long content - auto generate summary as title (local fallback)
        finalTitle = localSummarize(trimmedContent);
        finalDescription = trimmedContent;
      }
    }
    
    if (!finalTitle) return;

    setIsSubmitting(true);
    try {
      await onSubmit(
        {
          title: finalTitle,
          description: finalDescription,
          priority,
          deadline,
          reminder,
          tags,
        },
        pendingFiles
      );
      clearFiles();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit(e);
    }
  };

  // Switch to manual mode with current content as description
  const handleSwitchToManual = () => {
    if (content.trim()) {
      setDescription(content);
      setContent('');
    }
    setIsManualMode(true);
  };

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-4">
      {/* Header with quick save button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {mode === 'add' ? 'Add TODO' : 'Edit TODO'}
        </h2>
        <div className="flex items-center gap-2">
          {/* Quick save button */}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={isManualMode ? !title.trim() : !content.trim()}
            isLoading={isSubmitting}
          >
            Save
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Smart content input (Add mode) or Title/Description (Edit mode) */}
      {isManualMode ? (
        <>
          {/* Title */}
          <Input
            ref={titleInputRef}
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
          />
          
          {/* Description - shown in advanced */}
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              What needs to be done?
            </label>
            <button
              type="button"
              onClick={handleSwitchToManual}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Split title/description
            </button>
          </div>
          <textarea
            ref={contentInputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter your task... (short text becomes title, long text auto-summarizes)"
            rows={3}
            className="input resize-none"
          />
          
          {/* AI Summary hint/button */}
          {needsSummary && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <div className="flex-1 min-w-0 mr-2">
                  <span className="text-xs text-primary-600 dark:text-primary-400 block">
                    Long content detected. Click to generate AI title.
                  </span>
                  {aiConfigured === false && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      (AI not configured - will use local summary)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAISummarize}
                  disabled={isSummarizing}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600 disabled:opacity-50 flex-shrink-0"
                >
                  {isSummarizing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {aiConfigured ? 'AI Summary' : 'Auto Summary'}
                </button>
              </div>
              
              {/* Error message */}
              {aiError && (
                <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Priority & Deadline row */}
      <div className="flex gap-4">
        {/* Priority */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Priority
          </label>
          <PrioritySelect value={priority} onChange={setPriority} />
        </div>
        
        {/* Deadline - now always visible */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Deadline
          </label>
          <DateTimePicker
            value={deadline}
            onChange={setDeadline}
            placeholder="Set deadline"
          />
        </div>
      </div>

      {/* Reminder - only show if deadline is set */}
      {deadline && (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            <Bell className="w-4 h-4" />
            Reminder
          </label>
          <DateTimePicker
            value={reminder}
            onChange={setReminder}
            placeholder="Set reminder"
            maxDate={deadline}
          />
        </div>
      )}

      {/* Image uploader */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Attachments
        </label>
        <ImageUploader
          files={pendingFiles}
          onAdd={addFiles}
          onRemove={removeFile}
        />
      </div>

      {/* Advanced options toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
      </button>

      {/* Advanced options */}
      {showAdvanced && (
        <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
          {/* Description (only in manual mode) */}
          {isManualMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                rows={3}
                className="input resize-none"
              />
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag"
              />
              <Button type="button" variant="secondary" onClick={handleAddTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isManualMode ? !title.trim() : !content.trim()}
          className="flex-1"
        >
          {mode === 'add' ? 'Add TODO' : 'Save Changes'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-gray-400 text-center">
        Press ⌘ + Enter to submit
      </p>
    </form>
  );
};
