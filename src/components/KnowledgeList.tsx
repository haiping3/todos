/**
 * Knowledge list component with search and filtering
 * @author haiping.yu@zoom.us
 */

import React, { useState, useMemo } from 'react';
import { Search, Filter, FolderOpen, Loader2 } from 'lucide-react';
import type { KnowledgeItem as KnowledgeItemType, KnowledgeStatus } from '@/types';
import { KnowledgeItem } from './KnowledgeItem';

interface KnowledgeListProps {
  items: KnowledgeItemType[];
  isLoading: boolean;
  categories: string[];
  onDelete: (id: string) => void;
  onOpen?: (item: KnowledgeItemType) => void;
  /** Optional: mark item as ready (for items stuck in Pending) */
  onMarkReady?: (id: string) => void;
  /** Optional similarity scores from semantic search (itemId -> 0..1) */
  similarityScores?: Map<string, number>;
}

type FilterStatus = 'all' | KnowledgeStatus;

export const KnowledgeList: React.FC<KnowledgeListProps> = ({
  items,
  isLoading,
  categories,
  onDelete,
  onOpen,
  onMarkReady,
  similarityScores,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = items;

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(query) ||
          item.summary?.toLowerCase().includes(query) ||
          item.keywords.some((k) => k.toLowerCase().includes(query)) ||
          item.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return result;
  }, [items, statusFilter, categoryFilter, searchQuery]);

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      processing: items.filter((i) => i.status === 'processing').length,
      ready: items.filter((i) => i.status === 'ready').length,
      error: items.filter((i) => i.status === 'error').length,
    };
  }, [items]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search knowledge base..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-10 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
            showFilters || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'text-primary-600 dark:text-primary-400'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
          }`}
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
          {/* Status filter */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
              Status
            </label>
            <div className="flex flex-wrap gap-1">
              {(['all', 'ready', 'pending', 'processing', 'error'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2 py-1 text-xs rounded ${
                    statusFilter === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                  <span className="ml-1 opacity-70">({statusCounts[status]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2 py-1 text-xs rounded ${
                    categoryFilter === 'all'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2 py-1 text-xs rounded ${
                      categoryFilter === cat
                        ? 'bg-primary-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      {searchQuery && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for "{searchQuery}"
        </p>
      )}

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="text-center py-8">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">
            {items.length === 0
              ? 'No items in your knowledge base yet'
              : 'No items match your filters'}
          </p>
          {items.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Save web pages or add notes to get started
            </p>
          )}
        </div>
      )}

      {/* Item list */}
      <div className="space-y-2">
        {filteredItems.map((item) => (
          <KnowledgeItem
            key={item.id}
            item={item}
            onDelete={onDelete}
            onOpen={onOpen}
            onMarkReady={onMarkReady}
            similarity={similarityScores?.get(item.id)}
          />
        ))}
      </div>
    </div>
  );
};

