/**
 * Form for adding knowledge items (URL or note)
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import { Link, FileText, Loader2, X, Check } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';

interface KnowledgeFormProps {
  onSubmit: (data: { type: 'url' | 'note'; url?: string; title?: string; content?: string }) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

type FormMode = 'url' | 'note';

export const KnowledgeForm: React.FC<KnowledgeFormProps> = ({
  onSubmit,
  onCancel,
  isLoading = false,
}) => {
  const [mode, setMode] = useState<FormMode>('url');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (mode === 'url') {
        // Validate URL
        if (!url.trim()) {
          setError('Please enter a URL');
          return;
        }

        try {
          new URL(url);
        } catch {
          setError('Please enter a valid URL');
          return;
        }

        await onSubmit({ type: 'url', url: url.trim() });
      } else {
        // Validate note
        if (!title.trim()) {
          setError('Please enter a title');
          return;
        }

        await onSubmit({
          type: 'note',
          title: title.trim(),
          content: content.trim(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Add to Knowledge Base
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
            mode === 'url'
              ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Link className="w-4 h-4" />
          Web Page
        </button>
        <button
          type="button"
          onClick={() => setMode('note')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border transition-colors ${
            mode === 'note'
              ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Note
        </button>
      </div>

      {/* URL mode */}
      {mode === 'url' && (
        <div>
          <Input
            label="URL"
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The page content will be extracted and summarized automatically
          </p>
        </div>
      )}

      {/* Note mode */}
      {mode === 'note' && (
        <>
          <Input
            label="Title"
            type="text"
            placeholder="My note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              placeholder="Write your note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>
        </>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="flex-1"
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          className="flex-1"
          isLoading={isLoading}
        >
          <Check className="w-4 h-4 mr-1" />
          Save
        </Button>
      </div>
    </form>
  );
};

/**
 * Quick save current page button
 */
interface QuickSaveButtonProps {
  onSave: () => Promise<void>;
  isLoading?: boolean;
}

export const QuickSaveButton: React.FC<QuickSaveButtonProps> = ({
  onSave,
  isLoading = false,
}) => {
  const [saved, setSaved] = useState(false);

  const handleClick = async () => {
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Quick save failed:', error);
    }
  };

  return (
    <Button
      variant={saved ? 'secondary' : 'primary'}
      onClick={handleClick}
      disabled={isLoading || saved}
      className="w-full"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : saved ? (
        <>
          <Check className="w-4 h-4 mr-2" />
          Saved!
        </>
      ) : (
        <>
          <Link className="w-4 h-4 mr-2" />
          Save Current Page
        </>
      )}
    </Button>
  );
};

