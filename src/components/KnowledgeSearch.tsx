/**
 * Knowledge search component with keyword and semantic search support
 * @author haiping.yu@zoom.us
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Search, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import type { KnowledgeItem } from '@/types';
import { semanticSearch, semanticSearchToKnowledgeItems } from '@/utils/semantic-search';
import { searchKnowledge as searchKnowledgeDB } from '@/utils/indexeddb';

interface KnowledgeSearchProps {
  items: KnowledgeItem[];
  onResultsChange: (results: KnowledgeItem[]) => void;
  onSearchTypeChange?: (type: 'keyword' | 'semantic') => void;
  onSimilarityScoresChange?: (scores: Map<string, number>) => void;
  /** Notify parent of current query so list can use items when empty (avoids sync delay after Save) */
  onQueryChange?: (query: string) => void;
  /** External query value for controlled mode (optional) */
  query?: string;
  /** When false, show hint that semantic search requires login + Supabase */
  isAuthenticated?: boolean;
  isSupabaseConfigured?: boolean;
}

type SearchType = 'keyword' | 'semantic';

export const KnowledgeSearch: React.FC<KnowledgeSearchProps> = ({
  items,
  onResultsChange,
  onSearchTypeChange,
  onSimilarityScoresChange,
  onQueryChange,
  query: externalQuery,
  isAuthenticated = true,
  isSupabaseConfigured = true,
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  // Use external query if provided (controlled mode), otherwise use internal state
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const setQuery = (newQuery: string) => {
    setInternalQuery(newQuery);
    onQueryChange?.(newQuery);
  };
  const [searchType, setSearchType] = useState<SearchType>('keyword');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similarityScores, setSimilarityScores] = useState<Map<string, number>>(new Map());
  const [lastSemanticResultCount, setLastSemanticResultCount] = useState<number | null>(null);

  // Sync internal query with external query when in controlled mode
  useEffect(() => {
    if (externalQuery !== undefined && externalQuery !== internalQuery) {
      setInternalQuery(externalQuery);
    }
  }, [externalQuery, internalQuery]);

  // Perform keyword search
  const performKeywordSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        onResultsChange(items);
        setSimilarityScores(new Map());
        setLastSemanticResultCount(null);
        onSimilarityScoresChange?.(new Map());
        return;
      }

      try {
        setIsSearching(true);
        setError(null);
        setLastSemanticResultCount(null);

        const results = await searchKnowledgeDB(searchQuery);
        const knowledgeItems = results.map((item) => ({
          id: item.id,
          type: (item.url ? 'article' : 'note') as 'article' | 'note',
          url: item.url,
          title: item.title,
          content: item.content,
          summary: item.summary,
          keywords: item.keywords || [],
          tags: item.tags || [],
          category: item.category,
          source: item.source,
          author: item.author,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
          status: item.status as KnowledgeItem['status'],
          processingError: item.processingError,
          createdAt: new Date(item.createdAt),
          updatedAt: new Date(item.updatedAt),
        })) as KnowledgeItem[];

        onResultsChange(knowledgeItems);
        setSimilarityScores(new Map());
        onSimilarityScoresChange?.(new Map());
      } catch (err) {
        console.error('Keyword search error:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        onResultsChange([]);
      } finally {
        setIsSearching(false);
      }
    },
    [items, onResultsChange, onSimilarityScoresChange]
  );

  // Perform semantic search
  const performSemanticSearch = useCallback(
    async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        onResultsChange(items);
        setSimilarityScores(new Map());
        setLastSemanticResultCount(null);
        onSimilarityScoresChange?.(new Map());
        return;
      }

      try {
        setIsSearching(true);
        setError(null);

        const { results, error: searchError } = await semanticSearch(searchQuery, {
          threshold: 0.5,
          limit: 20,
        });

        if (searchError) {
          setError(searchError);
          onResultsChange([]);
          setLastSemanticResultCount(null);
          return;
        }

        setLastSemanticResultCount(results.length);

        if (results.length === 0) {
          onResultsChange([]);
          setSimilarityScores(new Map());
          onSimilarityScoresChange?.(new Map());
          return;
        }

        // Convert semantic search results to KnowledgeItem format
        const knowledgeItems = await semanticSearchToKnowledgeItems(results);

        // Create similarity scores map and notify parent
        const scoresMap = new Map<string, number>();
        results.forEach((result) => {
          scoresMap.set(result.id, result.similarity);
        });
        setSimilarityScores(scoresMap);
        onSimilarityScoresChange?.(scoresMap);

        onResultsChange(knowledgeItems);
      } catch (err) {
        console.error('Semantic search error:', err);
        setError(err instanceof Error ? err.message : 'Semantic search failed');
        onResultsChange([]);
        setLastSemanticResultCount(null);
      } finally {
        setIsSearching(false);
      }
    },
    [items, onResultsChange, onSimilarityScoresChange]
  );

  // Handle search input change
  const handleQueryChange = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      setError(null);

      // Debounce search
      const timeoutId = setTimeout(() => {
        if (newQuery.trim()) {
          if (searchType === 'keyword') {
            performKeywordSearch(newQuery);
          } else {
            performSemanticSearch(newQuery);
          }
        } else {
          onResultsChange(items);
          setSimilarityScores(new Map());
          setLastSemanticResultCount(null);
          onSimilarityScoresChange?.(new Map());
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    },
    [searchType, performKeywordSearch, performSemanticSearch, items, onResultsChange, onSimilarityScoresChange]
  );

  // Handle search type change
  const handleSearchTypeChange = useCallback(
    (type: SearchType) => {
      setSearchType(type);
      if (onSearchTypeChange) {
        onSearchTypeChange(type);
      }

      // Re-run search with new type
      if (query.trim()) {
        if (type === 'keyword') {
          performKeywordSearch(query);
        } else {
          performSemanticSearch(query);
        }
      } else {
        onResultsChange(items);
        setSimilarityScores(new Map());
        setLastSemanticResultCount(null);
        onSimilarityScoresChange?.(new Map());
      }
    },
    [query, performKeywordSearch, performSemanticSearch, items, onResultsChange, onSearchTypeChange, onSimilarityScoresChange]
  );

  // Reset search when items change externally (only if no active query)
  useEffect(() => {
    if (!query.trim()) {
      onResultsChange(items);
      setSimilarityScores(new Map());
      setLastSemanticResultCount(null);
      onSimilarityScoresChange?.(new Map());
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset when items change; callbacks intentionally excluded to avoid loops

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            handleQueryChange(e.target.value);
          }}
          placeholder={
            searchType === 'keyword'
              ? 'Search by keywords...'
              : 'Search semantically (e.g., "machine learning concepts")...'
          }
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />
      </div>

      {/* Search type toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => handleSearchTypeChange('keyword')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            searchType === 'keyword'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Search className="h-4 w-4" />
          Keyword
        </button>
        <button
          onClick={() => handleSearchTypeChange('semantic')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            searchType === 'semantic'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Semantic
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hint when semantic is selected but not logged in / Supabase not configured */}
      {searchType === 'semantic' && (!isAuthenticated || !isSupabaseConfigured) && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Sign in and connect Supabase to use semantic search. Set OpenAI API key in Settings for query embeddings.</span>
        </div>
      )}

      {/* Similarity scores info (for semantic search) */}
      {searchType === 'semantic' && similarityScores.size > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Found {similarityScores.size} result{similarityScores.size !== 1 ? 's' : ''} with semantic similarity
        </div>
      )}

      {/* No results (semantic search returned 0, no error) */}
      {searchType === 'semantic' && query.trim() && !isSearching && !error && lastSemanticResultCount === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
          No results. Try different words or add more items and generate embeddings.
        </div>
      )}
    </div>
  );
};

/**
 * Helper component to display similarity score badge
 */
export const SimilarityBadge: React.FC<{ itemId: string; similarityScores: Map<string, number> }> = ({
  itemId,
  similarityScores,
}) => {
  const similarity = similarityScores.get(itemId);
  if (similarity === undefined) return null;

  const percentage = Math.round(similarity * 100);
  const colorClass =
    percentage >= 80
      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      : percentage >= 60
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {percentage}% match
    </span>
  );
};
