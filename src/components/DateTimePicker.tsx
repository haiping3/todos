/**
 * Date and time picker component
 * @author haiping.yu@zoom.us
 */

import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { format, addDays, addHours, setHours, setMinutes, startOfDay, isBefore } from 'date-fns';
import { Calendar, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date and time',
  minDate = new Date(),
  maxDate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value);
  const [viewMonth, setViewMonth] = useState(value || new Date());
  const [timeInput, setTimeInput] = useState(value ? format(value, 'HH:mm') : '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Quick select options
  const quickOptions = [
    { label: 'Today', date: startOfDay(new Date()) },
    { label: 'Tomorrow', date: addDays(startOfDay(new Date()), 1) },
    { label: 'In 1 hour', date: addHours(new Date(), 1) },
    { label: 'In 3 hours', date: addHours(new Date(), 3) },
    { label: 'Next week', date: addDays(startOfDay(new Date()), 7) },
  ];

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Update internal state when value changes
  useEffect(() => {
    setSelectedDate(value);
    setTimeInput(value ? format(value, 'HH:mm') : '');
    if (value) {
      setViewMonth(value);
    }
  }, [value]);

  const handleDateSelect = (date: Date) => {
    // Preserve time if already selected
    let newDate = date;
    if (timeInput) {
      const [hours, minutes] = timeInput.split(':').map(Number);
      newDate = setMinutes(setHours(date, hours || 0), minutes || 0);
    } else {
      // Default to 9:00 AM
      newDate = setMinutes(setHours(date, 9), 0);
      setTimeInput('09:00');
    }
    setSelectedDate(newDate);
    onChange(newDate);
  };

  const handleTimeChange = (time: string) => {
    setTimeInput(time);
    if (selectedDate && time) {
      const [hours, minutes] = time.split(':').map(Number);
      const newDate = setMinutes(setHours(selectedDate, hours || 0), minutes || 0);
      setSelectedDate(newDate);
      onChange(newDate);
    }
  };

  const handleQuickSelect = (date: Date) => {
    setSelectedDate(date);
    setTimeInput(format(date, 'HH:mm'));
    setViewMonth(date);
    onChange(date);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSelectedDate(undefined);
    setTimeInput('');
    onChange(undefined);
    setIsOpen(false);
  };

  // Calendar rendering
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    // Add all days in the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && isBefore(date, startOfDay(minDate))) return true;
    if (maxDate && isBefore(maxDate, date)) return true;
    return false;
  };

  const isSelectedDate = (date: Date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input field */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'input flex items-center justify-between cursor-pointer',
          isOpen && 'ring-2 ring-primary-500'
        )}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          {value ? (
            <span>{format(value, 'MMM d, yyyy HH:mm')}</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
          {/* Quick options */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap gap-1">
              {quickOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => handleQuickSelect(option.date)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-primary-100 dark:hover:bg-primary-900 transition-colors"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between p-2 border-b border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setViewMonth(addDays(viewMonth, -30))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium">{format(viewMonth, 'MMMM yyyy')}</span>
            <button
              type="button"
              onClick={() => setViewMonth(addDays(viewMonth, 30))}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="p-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-gray-400 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Days */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(viewMonth).map((date, index) => (
                <div key={index} className="aspect-square">
                  {date && (
                    <button
                      type="button"
                      onClick={() => handleDateSelect(date)}
                      disabled={isDateDisabled(date)}
                      className={clsx(
                        'w-full h-full flex items-center justify-center text-sm rounded transition-colors',
                        isSelectedDate(date)
                          ? 'bg-primary-500 text-white'
                          : isToday(date)
                          ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                        isDateDisabled(date) && 'opacity-30 cursor-not-allowed'
                      )}
                    >
                      {date.getDate()}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Time input */}
          <div className="flex items-center gap-2 p-2 border-t border-gray-100 dark:border-gray-700">
            <Clock className="w-4 h-4 text-gray-400" />
            <input
              type="time"
              value={timeInput}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="flex-1 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 text-sm bg-primary-500 text-white rounded hover:bg-primary-600"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

