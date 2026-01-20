/**
 * Priority select component with colored labels
 * @author haiping.yu@zoom.us
 */

import React from 'react';
import { clsx } from 'clsx';
import type { TodoPriority } from '@/types';

interface PriorityConfig {
  value: TodoPriority;
  label: string;
  // Solid background style (for badges)
  solidBg: string;
  solidText: string;
  // Light background style (for selected state)
  lightBg: string;
  lightText: string;
  lightBorder: string;
}

const priorities: PriorityConfig[] = [
  { 
    value: 'low', 
    label: 'Low', 
    solidBg: 'bg-gray-500',
    solidText: 'text-white',
    lightBg: 'bg-gray-100 dark:bg-gray-700',
    lightText: 'text-gray-700 dark:text-gray-200',
    lightBorder: 'border-gray-400',
  },
  { 
    value: 'medium', 
    label: 'Medium', 
    solidBg: 'bg-blue-500',
    solidText: 'text-white',
    lightBg: 'bg-blue-100 dark:bg-blue-900/40',
    lightText: 'text-blue-700 dark:text-blue-200',
    lightBorder: 'border-blue-500',
  },
  { 
    value: 'high', 
    label: 'High', 
    solidBg: 'bg-orange-500',
    solidText: 'text-white',
    lightBg: 'bg-orange-100 dark:bg-orange-900/40',
    lightText: 'text-orange-700 dark:text-orange-200',
    lightBorder: 'border-orange-500',
  },
  { 
    value: 'urgent', 
    label: 'Urgent', 
    solidBg: 'bg-red-500',
    solidText: 'text-white',
    lightBg: 'bg-red-100 dark:bg-red-900/40',
    lightText: 'text-red-700 dark:text-red-200',
    lightBorder: 'border-red-500',
  },
];

interface PrioritySelectProps {
  value: TodoPriority;
  onChange: (priority: TodoPriority) => void;
  size?: 'sm' | 'md';
}

export const PrioritySelect: React.FC<PrioritySelectProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {priorities.map((priority) => {
        const isActive = value === priority.value;
        
        return (
          <button
            key={priority.value}
            type="button"
            onClick={() => onChange(priority.value)}
            className={clsx(
              'rounded-md font-medium transition-all',
              size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
              isActive
                ? `${priority.solidBg} ${priority.solidText} shadow-sm`
                : `${priority.lightBg} ${priority.lightText} opacity-60 hover:opacity-100`
            )}
          >
            {priority.label}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Priority badge component (display only) - solid colored label
 */
export const PriorityBadge: React.FC<{ priority: TodoPriority; size?: 'sm' | 'md' }> = ({
  priority,
  size = 'sm',
}) => {
  const config = priorities.find((p) => p.value === priority) ?? priorities[1]!;
  
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-sm',
        config.solidBg,
        config.solidText
      )}
    >
      {config.label}
    </span>
  );
};

/**
 * Get priority config by value
 */
export function getPriorityConfig(priority: TodoPriority): PriorityConfig {
  return priorities.find((p) => p.value === priority) ?? priorities[1]!;
}

/**
 * Get all priority options
 */
export function getAllPriorities(): PriorityConfig[] {
  return priorities;
}

