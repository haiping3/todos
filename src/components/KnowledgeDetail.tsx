/**
 * Knowledge item detail modal
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Tag,
  Calendar,
  User,
  Globe,
  RefreshCw,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import type { KnowledgeItem } from '@/types';
import { Button } from './Button';
import { getFaviconUrl } from '@/utils/content-extractor';

interface KnowledgeDetailProps {
  item: KnowledgeItem;
  onClose: () => void;
  onReprocess?: (id: string) => Promise<void>;
  onAskQuestion?: (question: string, context: string) => Promise<string>;
}

export const KnowledgeDetail: React.FC<KnowledgeDetailProps> = ({
  item,
  onClose,
  onReprocess,
  onAskQuestion,
}) => {
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const handleReprocess = async () => {
    if (!onReprocess) return;
    setIsReprocessing(true);
    try {
      await onReprocess(item.id);
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!onAskQuestion || !question.trim()) return;
    setIsAsking(true);
    try {
      const result = await onAskQuestion(question, item.content || '');
      setAnswer(result);
    } catch (error) {
      setAnswer('Failed to get answer. Please try again.');
    } finally {
      setIsAsking(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const favicon = item.url ? getFaviconUrl(item.url) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            {favicon && (
              <img
                src={favicon}
                alt=""
                className="w-6 h-6 mt-1 flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {item.title}
              </h2>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  {new URL(item.url).hostname}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Meta info */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Saved {formatDate(item.createdAt)}
            </span>
            {item.author && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {item.author}
              </span>
            )}
            {item.category && (
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                {item.category}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Summary */}
          {item.summary && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Summary
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                {item.summary}
              </p>
            </div>
          )}

          {/* Keywords and tags */}
          {(item.keywords.length > 0 || item.tags.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Keywords & Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm rounded"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
                {item.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm rounded"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Full content */}
          {item.content && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-h-60 overflow-y-auto whitespace-pre-wrap">
                {item.content}
              </div>
            </div>
          )}

          {/* Q&A section */}
          {onAskQuestion && item.content && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                Ask about this article
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your question..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <Button
                  variant="primary"
                  onClick={handleAskQuestion}
                  disabled={isAsking || !question.trim()}
                >
                  {isAsking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ask'}
                </Button>
              </div>
              {answer && (
                <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg text-sm text-gray-700 dark:text-gray-300">
                  {answer}
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {item.status === 'error' && item.processingError && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                Processing Error
              </p>
              <p className="text-sm text-red-500 dark:text-red-400 mt-1">
                {item.processingError}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="secondary" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Original
              </Button>
            </a>
          )}
          {onReprocess && (item.status === 'error' || item.status === 'pending') && (
            <Button
              variant="secondary"
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="flex-1"
            >
              {isReprocessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Reprocess
            </Button>
          )}
          <Button variant="primary" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

