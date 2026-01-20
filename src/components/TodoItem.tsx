/**
 * Single TODO item component
 * @author haiping.yu@zoom.us
 */

import React, { useState, useEffect, useMemo } from 'react';
import { clsx } from 'clsx';
import { format, isPast, isToday, isTomorrow, differenceInMilliseconds, formatDistanceToNow } from 'date-fns';
import {
  Check,
  Circle,
  Clock,
  Trash2,
  Edit2,
  Paperclip,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Todo } from '@/types';
import { PriorityBadge } from './PrioritySelect';
import { getAttachmentsByTodo } from '@/utils/indexeddb';
import type { AttachmentMeta } from '@/utils/indexeddb';

/**
 * Calculate deadline progress
 * Returns percentage of time elapsed (0-100) and remaining time info
 */
function useDeadlineProgress(createdAt: Date, deadline: Date | undefined, isCompleted: boolean) {
  const [now, setNow] = useState(new Date());

  // Update every minute
  useEffect(() => {
    if (!deadline || isCompleted) return;
    
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadline, isCompleted]);

  return useMemo(() => {
    if (!deadline || isCompleted) {
      return { progress: 0, remaining: null, isOverdue: false, urgency: 'normal' as const };
    }

    const totalTime = differenceInMilliseconds(deadline, createdAt);
    const elapsed = differenceInMilliseconds(now, createdAt);
    const remaining = differenceInMilliseconds(deadline, now);

    // Calculate progress percentage (how much time has passed)
    let progress = totalTime > 0 ? (elapsed / totalTime) * 100 : 0;
    progress = Math.max(0, Math.min(100, progress));

    const isOverdue = remaining <= 0;

    // Determine urgency level
    let urgency: 'normal' | 'warning' | 'danger' = 'normal';
    if (isOverdue) {
      urgency = 'danger';
    } else if (progress >= 80) {
      urgency = 'danger';
    } else if (progress >= 50) {
      urgency = 'warning';
    }

    // Format remaining time
    const remainingText = isOverdue 
      ? `Overdue by ${formatDistanceToNow(deadline)}`
      : formatDistanceToNow(deadline, { addSuffix: true });

    return {
      progress,
      remaining: remainingText,
      isOverdue,
      urgency,
    };
  }, [createdAt, deadline, now, isCompleted]);
}

/**
 * Deadline progress bar component
 */
const DeadlineProgressBar: React.FC<{
  progress: number;
  urgency: 'normal' | 'warning' | 'danger';
  remaining: string | null;
}> = ({ progress, urgency, remaining }) => {
  if (!remaining) return null;

  const bgColor = {
    normal: 'bg-primary-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
  }[urgency];

  const trackColor = {
    normal: 'bg-primary-100 dark:bg-primary-900/30',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30',
    danger: 'bg-red-100 dark:bg-red-900/30',
  }[urgency];

  return (
    <div className="mt-2">
      {/* Progress bar */}
      <div className={clsx('h-1.5 rounded-full overflow-hidden', trackColor)}>
        <div
          className={clsx('h-full rounded-full transition-all duration-300', bgColor)}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      {/* Remaining time text */}
      <div className="flex justify-between mt-1">
        <span className={clsx(
          'text-xs',
          urgency === 'danger' ? 'text-red-500' : 
          urgency === 'warning' ? 'text-yellow-600 dark:text-yellow-500' : 
          'text-gray-500 dark:text-gray-400'
        )}>
          {remaining}
        </span>
        <span className={clsx(
          'text-xs',
          urgency === 'danger' ? 'text-red-500' : 
          urgency === 'warning' ? 'text-yellow-600 dark:text-yellow-500' : 
          'text-gray-500 dark:text-gray-400'
        )}>
          {Math.round(progress)}% elapsed
        </span>
      </div>
    </div>
  );
};

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (id: string) => void;
}

export const TodoItem: React.FC<TodoItemProps> = ({
  todo,
  onToggle,
  onEdit,
  onDelete,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});

  const isCompleted = todo.status === 'completed';
  const isOverdue = todo.deadline && isPast(todo.deadline) && !isCompleted;

  // Deadline progress
  const deadlineProgress = useDeadlineProgress(todo.createdAt, todo.deadline, isCompleted);

  // Load attachments
  useEffect(() => {
    const loadAttachments = async () => {
      const data = await getAttachmentsByTodo(todo.id);
      const metas = data.map(({ blob: _, thumbnail, ...meta }) => {
        // Create thumbnail URLs
        if (thumbnail) {
          setThumbnailUrls((prev) => ({
            ...prev,
            [meta.id]: URL.createObjectURL(thumbnail),
          }));
        }
        return meta;
      });
      setAttachments(metas);
    };
    loadAttachments();

    // Cleanup thumbnail URLs
    return () => {
      Object.values(thumbnailUrls).forEach(URL.revokeObjectURL);
    };
  }, [todo.id]);

  const formatDeadline = (date: Date) => {
    if (isToday(date)) return `Today, ${format(date, 'HH:mm')}`;
    if (isTomorrow(date)) return `Tomorrow, ${format(date, 'HH:mm')}`;
    return format(date, 'MMM d, HH:mm');
  };

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 rounded-lg border transition-all',
        isCompleted
          ? 'border-gray-200 dark:border-gray-700 opacity-60'
          : isOverdue
          ? 'border-red-300 dark:border-red-700'
          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-3 p-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo.id)}
          className={clsx(
            'flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
            isCompleted
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-gray-300 dark:border-gray-600 hover:border-primary-500'
          )}
        >
          {isCompleted ? (
            <Check className="w-3 h-3" />
          ) : (
            <Circle className="w-3 h-3 opacity-0" />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={clsx(
                'font-medium text-sm',
                isCompleted && 'line-through text-gray-400 dark:text-gray-500'
              )}
            >
              {todo.title}
            </h3>
            <PriorityBadge priority={todo.priority} />
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            {todo.deadline && (
              <span
                className={clsx(
                  'flex items-center gap-1',
                  isOverdue && 'text-red-500'
                )}
              >
                <Clock className="w-3 h-3" />
                {formatDeadline(todo.deadline)}
              </span>
            )}
            {attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {attachments.length}
              </span>
            )}
          </div>

          {/* Deadline progress bar */}
          {todo.deadline && !isCompleted && (
            <DeadlineProgressBar
              progress={deadlineProgress.progress}
              urgency={deadlineProgress.urgency}
              remaining={deadlineProgress.remaining}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {(todo.description || attachments.length > 0) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={() => onEdit(todo)}
            className="p-1 text-gray-400 hover:text-primary-500"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="p-1 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700">
          {todo.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 whitespace-pre-wrap">
              {todo.description}
            </p>
          )}

          {/* Attachment thumbnails */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
                >
                  {attachment.type === 'image' && thumbnailUrls[attachment.id] ? (
                    <img
                      src={thumbnailUrls[attachment.id]}
                      alt={attachment.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Paperclip className="w-6 h-6" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {todo.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {todo.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

