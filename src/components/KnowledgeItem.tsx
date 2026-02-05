/**
 * Knowledge item card component
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import { 
  ExternalLink, 
  Trash2, 
  ChevronDown, 
  ChevronUp,
  Tag,
  Clock,
  AlertCircle,
  Loader2,
  Check,
} from 'lucide-react';
import type { KnowledgeItem as KnowledgeItemType } from '@/types';
import { getFaviconUrl } from '@/utils/content-extractor';

interface KnowledgeItemProps {
  item: KnowledgeItemType;
  onDelete: (id: string) => void;
  onOpen?: (item: KnowledgeItemType) => void;
  /** Optional: mark as ready (for items stuck in Pending) */
  onMarkReady?: (id: string) => void;
  /** Optional similarity score from semantic search (0..1), shown as match % */
  similarity?: number;
}

/**
 * Status indicator component
 */
const STATUS_TITLE: Record<KnowledgeItemType['status'], string> = {
  pending: 'Pending: waiting for AI summary/keywords/category, or not yet processed',
  processing: 'Processing: AI is generating summary and keywords',
  ready: 'Ready: processed and available for semantic search',
  error: 'Error: processing failed (e.g. AI or embedding error)',
};

const StatusBadge: React.FC<{ status: KnowledgeItemType['status'] }> = ({ status }) => {
  const config = {
    pending: { icon: Clock, text: 'Pending', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    processing: { icon: Loader2, text: 'Processing', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    ready: { icon: Check, text: 'Ready', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    error: { icon: AlertCircle, text: 'Error', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };

  const { icon: Icon, text, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      title={STATUS_TITLE[status]}
    >
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {text}
    </span>
  );
};

export const KnowledgeItem: React.FC<KnowledgeItemProps> = ({
  item,
  onDelete,
  onOpen,
  onMarkReady,
  similarity,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete(item.id);
    } else {
      setShowDeleteConfirm(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const favicon = item.url ? getFaviconUrl(item.url) : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-2">
        {/* Favicon */}
        {favicon && (
          <img
            src={favicon}
            alt=""
            className="w-4 h-4 mt-1 flex-shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

        {/* Title and meta */}
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onOpen?.(item)}
            className="text-left w-full group"
          >
            <h3 className="font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
              {item.title}
            </h3>
          </button>

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 truncate block"
            >
              {new URL(item.url).hostname}
            </a>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {similarity != null && (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                similarity >= 0.8
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  : similarity >= 0.6
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {Math.round(similarity * 100)}% match
            </span>
          )}
          <StatusBadge status={item.status} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {item.status === 'pending' && onMarkReady && (
            <button
              onClick={() => onMarkReady(item.id)}
              className="p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400"
              title="Mark as ready (skip AI processing). Saves status, syncs to cloud, and generates embedding if signed in."
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={handleDelete}
            className={`p-1 ${
              showDeleteConfirm
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-400 hover:text-red-600 dark:hover:text-red-400'
            }`}
            title={showDeleteConfirm ? 'Click again to confirm' : 'Delete'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary preview */}
      {item.summary && (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {item.summary}
        </p>
      )}

      {/* Tags and keywords */}
      {(item.tags.length > 0 || item.keywords.length > 0) && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {item.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs rounded"
            >
              <Tag className="w-3 h-3" />
              {tag}
            </span>
          ))}
          {item.keywords.slice(0, 2).map((keyword) => (
            <span
              key={keyword}
              className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
            >
              {keyword}
            </span>
          ))}
          {(item.tags.length + item.keywords.length > 5) && (
            <span className="text-xs text-gray-400">
              +{item.tags.length + item.keywords.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Expand/collapse button */}
      {item.content && item.content.length > 100 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show more
            </>
          )}
        </button>
      )}

      {/* Expanded content */}
      {isExpanded && item.content && (
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm text-gray-600 dark:text-gray-300 max-h-40 overflow-y-auto">
          {item.content.slice(0, 500)}
          {item.content.length > 500 && '...'}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{formatDate(item.createdAt)}</span>
        {item.category && (
          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
            {item.category}
          </span>
        )}
      </div>

      {/* Error message */}
      {item.status === 'error' && item.processingError && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400">
          {item.processingError}
        </div>
      )}
    </div>
  );
};

