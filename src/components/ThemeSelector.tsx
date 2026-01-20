/**
 * Theme selector component
 * @author haiping.yu@zoom.us
 */

import React from 'react';
import { clsx } from 'clsx';
import { Sun, Moon, Monitor } from 'lucide-react';
import type { ThemeMode } from '@/types';

interface ThemeSelectorProps {
  value: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

const themes: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {themes.map((theme) => {
        const Icon = theme.icon;
        const isActive = value === theme.value;
        
        return (
          <button
            key={theme.value}
            type="button"
            onClick={() => onChange(theme.value)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-all',
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            <Icon className="w-4 h-4" />
            <span>{theme.label}</span>
          </button>
        );
      })}
    </div>
  );
};

