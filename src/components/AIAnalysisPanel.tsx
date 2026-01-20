/**
 * AI Analysis Panel for TODOs
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ListChecks,
  ArrowUpDown,
  Tag,
  Loader2,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from './Button';
import type { Todo, TodoPriority } from '@/types';
import type { PrioritySuggestion } from '@/utils/ai';

interface AIAnalysisPanelProps {
  todos: Todo[];
  onAnalyzePriorities: (todos: Todo[]) => Promise<PrioritySuggestion[]>;
  onSummarize: (todos: Todo[]) => Promise<string>;
  onSuggestCategories: (todo: Todo) => Promise<string[]>;
  onApplyPrioritySuggestion: (todoId: string, priority: TodoPriority) => Promise<void>;
  onApplyTags: (todoId: string, tags: string[]) => Promise<void>;
  onClose: () => void;
}

type AnalysisMode = 'priority' | 'summary' | 'categories';

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({
  todos,
  onAnalyzePriorities,
  onSummarize,
  onSuggestCategories,
  onApplyPrioritySuggestion,
  onApplyTags,
  onClose,
}) => {
  const [mode, setMode] = useState<AnalysisMode>('priority');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Priority analysis state
  const [prioritySuggestions, setPrioritySuggestions] = useState<PrioritySuggestion[]>([]);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());

  // Summary state
  const [summary, setSummary] = useState<string | null>(null);

  // Category state
  const [selectedTodoForCategories, setSelectedTodoForCategories] = useState<Todo | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

  const activeTodos = todos.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  );

  const handleAnalyzePriorities = async () => {
    if (activeTodos.length === 0) {
      setError('No active TODOs to analyze');
      return;
    }

    setIsLoading(true);
    setError(null);
    setPrioritySuggestions([]);
    setAppliedSuggestions(new Set());

    try {
      const suggestions = await onAnalyzePriorities(activeTodos);
      setPrioritySuggestions(suggestions);
      
      if (suggestions.length === 0) {
        setError('No priority changes suggested. Your current priorities look good!');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (todos.length === 0) {
      setError('No TODOs to summarize');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const result = await onSummarize(todos);
      setSummary(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Summary failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestCategories = async (todo: Todo) => {
    setSelectedTodoForCategories(todo);
    setCategorySuggestions([]);
    setIsLoading(true);
    setError(null);

    try {
      const suggestions = await onSuggestCategories(todo);
      setCategorySuggestions(suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Category suggestion failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPriority = async (suggestion: PrioritySuggestion) => {
    try {
      await onApplyPrioritySuggestion(suggestion.todoId, suggestion.suggestedPriority);
      setAppliedSuggestions((prev) => new Set([...prev, suggestion.todoId]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply suggestion');
    }
  };

  const handleApplyAllPriorities = async () => {
    const unapplied = prioritySuggestions.filter(
      (s) => !appliedSuggestions.has(s.todoId)
    );

    for (const suggestion of unapplied) {
      await handleApplyPriority(suggestion);
    }
  };

  const handleApplyCategory = async (tag: string) => {
    if (!selectedTodoForCategories) return;

    try {
      const newTags = [...new Set([...selectedTodoForCategories.tags, tag])];
      await onApplyTags(selectedTodoForCategories.id, newTags);
      setCategorySuggestions((prev) => prev.filter((t) => t !== tag));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply tag');
    }
  };

  const getPriorityColor = (priority: TodoPriority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[priority];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary-500" />
          AI Analysis
        </h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <button
          onClick={() => setMode('priority')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'priority'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpDown className="w-4 h-4" />
          Priority
        </button>
        <button
          onClick={() => setMode('summary')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'summary'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          Summary
        </button>
        <button
          onClick={() => setMode('categories')}
          className={`flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            mode === 'categories'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <Tag className="w-4 h-4" />
          Tags
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">{error}</p>
        </div>
      )}

      {/* Priority Analysis */}
      {mode === 'priority' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analyze your TODOs and get AI-powered priority suggestions based on deadlines and task complexity.
          </p>

          <Button
            variant="primary"
            onClick={handleAnalyzePriorities}
            disabled={isLoading || activeTodos.length === 0}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze Priorities ({activeTodos.length} items)
              </>
            )}
          </Button>

          {/* Suggestions */}
          {prioritySuggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Suggestions ({prioritySuggestions.length})
                </h3>
                {prioritySuggestions.some((s) => !appliedSuggestions.has(s.todoId)) && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyAllPriorities}
                  >
                    Apply All
                  </Button>
                )}
              </div>

              {prioritySuggestions.map((suggestion) => {
                const todo = todos.find((t) => t.id === suggestion.todoId);
                const isApplied = appliedSuggestions.has(suggestion.todoId);

                return (
                  <div
                    key={suggestion.todoId}
                    className={`p-3 rounded-lg border ${
                      isApplied
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {todo?.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(suggestion.currentPriority)}`}>
                            {suggestion.currentPriority}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getPriorityColor(suggestion.suggestedPriority)}`}>
                            {suggestion.suggestedPriority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {suggestion.reason}
                        </p>
                      </div>
                      {isApplied ? (
                        <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleApplyPriority(suggestion)}
                        >
                          Apply
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      {mode === 'summary' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get an AI-generated summary of your TODO list with actionable insights and priorities.
          </p>

          <Button
            variant="primary"
            onClick={handleSummarize}
            disabled={isLoading || todos.length === 0}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating summary...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Summary
              </>
            )}
          </Button>

          {summary && (
            <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <h3 className="text-sm font-medium text-primary-700 dark:text-primary-300 mb-2">
                TODO Summary
              </h3>
              <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {summary}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories */}
      {mode === 'categories' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Select a TODO to get AI-suggested tags and categories.
          </p>

          {/* TODO list for selection */}
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {activeTodos.map((todo) => (
              <button
                key={todo.id}
                onClick={() => handleSuggestCategories(todo)}
                className={`w-full text-left p-2 rounded-lg border transition-colors ${
                  selectedTodoForCategories?.id === todo.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {todo.title}
                </p>
                {todo.tags.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {todo.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Loading */}
          {isLoading && selectedTodoForCategories && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Suggesting tags...
              </span>
            </div>
          )}

          {/* Suggestions */}
          {categorySuggestions.length > 0 && selectedTodoForCategories && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Suggested Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {categorySuggestions.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleApplyCategory(tag)}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                    <Check className="w-3 h-3 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

