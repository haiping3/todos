/**
 * React hook for managing TODOs
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';
import type { Todo, TodoStatus, TodoPriority } from '@/types';
import { syncTodosToCloud, syncTodosFromCloud } from '@/utils/sync';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'todos';

interface UseTodosResult {
  todos: Todo[];
  isLoading: boolean;
  error: Error | null;
  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Todo>;
  updateTodo: (id: string, updates: Partial<Todo>) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  reorderTodos: (todoIds: string[]) => Promise<void>;
  getTodoById: (id: string) => Todo | undefined;
  filterByStatus: (status: TodoStatus | 'all') => Todo[];
  filterByPriority: (priority: TodoPriority | 'all') => Todo[];
}

/**
 * Hook for managing TODOs with Chrome Storage and cloud sync
 */
export function useTodos(): UseTodosResult {
  const { isAuthenticated, isConfigured } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load todos from storage and sync from cloud if authenticated
  useEffect(() => {
    const loadTodos = async () => {
      try {
        setIsLoading(true);
        
        // First load from local storage
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const storedTodos = result[STORAGE_KEY] || [];
        const parsedTodos = storedTodos.map(parseTodoFromStorage);
        setTodos(parsedTodos);

        // If authenticated and Supabase is configured, sync from cloud
        if (isAuthenticated && isConfigured) {
          try {
            const { todos: cloudTodos, error: syncError } = await syncTodosFromCloud();
            if (!syncError && cloudTodos.length > 0) {
              // Merge cloud todos with local (cloud data takes precedence)
              setTodos(cloudTodos);
              // Save merged todos to local storage
              const todosForStorage = cloudTodos.map(prepareTodoForStorage);
              await chrome.storage.local.set({ [STORAGE_KEY]: todosForStorage });
            } else if (syncError) {
              console.warn('Failed to sync todos from cloud:', syncError);
              // Continue with local data if sync fails
            }
          } catch (syncErr) {
            console.warn('Error syncing todos from cloud:', syncErr);
            // Continue with local data if sync fails
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load todos'));
      } finally {
        setIsLoading(false);
      }
    };

    loadTodos();
  }, [isAuthenticated, isConfigured]);

  // Listen for storage changes
  useEffect(() => {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[STORAGE_KEY]) {
        const newTodos = (changes[STORAGE_KEY].newValue || []).map(parseTodoFromStorage);
        setTodos(newTodos);
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  // Save todos to storage
  const saveTodos = useCallback(async (newTodos: Todo[]) => {
    const todosForStorage = newTodos.map(prepareTodoForStorage);
    await chrome.storage.local.set({ [STORAGE_KEY]: todosForStorage });
  }, []);

  // Add a new todo
  const addTodo = useCallback(
    async (todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> => {
      const now = new Date();
      const newTodo: Todo = {
        ...todoData,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };

      const newTodos = [newTodo, ...todos];
      await saveTodos(newTodos);
      
      // Set reminder alarm if deadline is set
      if (newTodo.deadline && newTodo.reminder) {
        await setReminderAlarm(newTodo);
      }

      // Sync to cloud if authenticated (fire and forget)
      if (isAuthenticated && isConfigured) {
        syncTodosToCloud(newTodos).catch((err) => {
          console.warn('Failed to sync todos to cloud:', err);
        });
      }

      return newTodo;
    },
    [todos, saveTodos, isAuthenticated, isConfigured]
  );

  // Update a todo
  const updateTodo = useCallback(
    async (id: string, updates: Partial<Todo>) => {
      const newTodos = todos.map((todo) =>
        todo.id === id
          ? { ...todo, ...updates, updatedAt: new Date() }
          : todo
      );
      await saveTodos(newTodos);

      // Update reminder alarm if deadline changed
      const updatedTodo = newTodos.find((t) => t.id === id);
      if (updatedTodo && (updates.deadline || updates.reminder)) {
        await setReminderAlarm(updatedTodo);
      }

      // Sync to cloud if authenticated (fire and forget)
      if (isAuthenticated && isConfigured) {
        syncTodosToCloud(newTodos).catch((err) => {
          console.warn('Failed to sync todos to cloud:', err);
        });
      }
    },
    [todos, saveTodos, isAuthenticated, isConfigured]
  );

  // Delete a todo
  const deleteTodo = useCallback(
    async (id: string) => {
      const newTodos = todos.filter((todo) => todo.id !== id);
      await saveTodos(newTodos);
      
      // Clear reminder alarm
      await chrome.alarms.clear(`todo-reminder-${id}`);

      // Sync to cloud if authenticated (fire and forget)
      // Note: We sync the updated list, which effectively deletes the item
      if (isAuthenticated && isConfigured) {
        syncTodosToCloud(newTodos).catch((err) => {
          console.warn('Failed to sync todos to cloud:', err);
        });
      }
    },
    [todos, saveTodos, isAuthenticated, isConfigured]
  );

  // Toggle todo status (pending -> completed -> pending)
  const toggleStatus = useCallback(
    async (id: string) => {
      const todo = todos.find((t) => t.id === id);
      if (!todo) return;

      const newStatus: TodoStatus = todo.status === 'completed' ? 'pending' : 'completed';
      await updateTodo(id, { 
        status: newStatus,
        completedAt: newStatus === 'completed' ? new Date() : undefined,
      });
    },
    [todos, updateTodo]
  );

  // Reorder todos
  const reorderTodos = useCallback(
    async (todoIds: string[]) => {
      const todoMap = new Map(todos.map((t) => [t.id, t]));
      const reorderedTodos = todoIds
        .map((id) => todoMap.get(id))
        .filter((t): t is Todo => t !== undefined);
      await saveTodos(reorderedTodos);

      // Sync to cloud if authenticated (fire and forget)
      if (isAuthenticated && isConfigured) {
        syncTodosToCloud(reorderedTodos).catch((err) => {
          console.warn('Failed to sync todos to cloud:', err);
        });
      }
    },
    [todos, saveTodos, isAuthenticated, isConfigured]
  );

  // Get todo by ID
  const getTodoById = useCallback(
    (id: string) => todos.find((t) => t.id === id),
    [todos]
  );

  // Filter by status
  const filterByStatus = useCallback(
    (status: TodoStatus | 'all') => {
      if (status === 'all') return todos;
      return todos.filter((t) => t.status === status);
    },
    [todos]
  );

  // Filter by priority
  const filterByPriority = useCallback(
    (priority: TodoPriority | 'all') => {
      if (priority === 'all') return todos;
      return todos.filter((t) => t.priority === priority);
    },
    [todos]
  );

  return {
    todos,
    isLoading,
    error,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleStatus,
    reorderTodos,
    getTodoById,
    filterByStatus,
    filterByPriority,
  };
}

// Helper: Parse todo from storage (convert date strings to Date objects)
function parseTodoFromStorage(todo: Record<string, unknown>): Todo {
  return {
    ...todo,
    createdAt: new Date(todo.createdAt as string),
    updatedAt: new Date(todo.updatedAt as string),
    deadline: todo.deadline ? new Date(todo.deadline as string) : undefined,
    reminder: todo.reminder ? new Date(todo.reminder as string) : undefined,
    completedAt: todo.completedAt ? new Date(todo.completedAt as string) : undefined,
  } as Todo;
}

// Helper: Prepare todo for storage (convert Date objects to strings)
function prepareTodoForStorage(todo: Todo): Record<string, unknown> {
  return {
    ...todo,
    createdAt: todo.createdAt.toISOString(),
    updatedAt: todo.updatedAt.toISOString(),
    deadline: todo.deadline?.toISOString(),
    reminder: todo.reminder?.toISOString(),
    completedAt: todo.completedAt?.toISOString(),
  };
}

// Helper: Set Chrome alarm for todo reminder
async function setReminderAlarm(todo: Todo): Promise<void> {
  const alarmName = `todo-reminder-${todo.id}`;
  
  // Clear existing alarm
  await chrome.alarms.clear(alarmName);
  
  // Set new alarm if reminder time is in the future
  if (todo.reminder && todo.reminder > new Date()) {
    await chrome.alarms.create(alarmName, {
      when: todo.reminder.getTime(),
    });
  }
}

// Export types
export type { UseTodosResult };

