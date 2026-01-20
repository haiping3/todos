/**
 * TODO list component
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ListTodo } from 'lucide-react';
import type { Todo } from '@/types';
import { TodoItem } from './TodoItem';

interface TodoListProps {
  todos: Todo[];
  isLoading: boolean;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

type FilterOption = 'all' | 'active' | 'completed';

export const TodoList: React.FC<TodoListProps> = ({
  todos,
  isLoading,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const [filter, setFilter] = useState<FilterOption>('active');

  const filteredTodos = todos.filter((todo) => {
    if (filter === 'active') return todo.status !== 'completed';
    if (filter === 'completed') return todo.status === 'completed';
    return true;
  });

  // Sort: incomplete first, then by priority, then by date
  const sortedTodos = [...filteredTodos].sort((a, b) => {
    // Completed items at the bottom
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;

    // Sort by priority (urgent > high > medium > low)
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Sort by deadline (soonest first)
    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;

    // Sort by created date (newest first)
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const counts = {
    all: todos.length,
    active: todos.filter((t) => t.status !== 'completed').length,
    completed: todos.filter((t) => t.status === 'completed').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {(['all', 'active', 'completed'] as FilterOption[]).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={clsx(
              'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              filter === option
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
            <span className="ml-1 text-gray-400">({counts[option]})</span>
          </button>
        ))}
      </div>

      {/* Todo list */}
      {sortedTodos.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="space-y-2">
          {sortedTodos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const EmptyState: React.FC<{ filter: FilterOption }> = ({ filter }) => {
  const messages = {
    all: 'No TODOs yet. Add one to get started!',
    active: 'No active TODOs. Great job!',
    completed: 'No completed TODOs yet.',
  };

  return (
    <div className="text-center py-8">
      <ListTodo className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{messages[filter]}</p>
    </div>
  );
};

