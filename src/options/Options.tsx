/**
 * Options page component
 * @author haiping.yu@zoom.us
 */

import React from 'react';

export const Options: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          AI Assistant Settings
        </h1>

        <div className="space-y-6">
          {/* AI Provider Settings */}
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">AI Provider</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Configure your AI service provider settings here.
            </p>
          </section>

          {/* Sync Settings */}
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Cloud Sync</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Configure Supabase sync settings here.
            </p>
          </section>

          {/* Notification Settings */}
          <section className="card">
            <h2 className="text-lg font-semibold mb-4">Notifications</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Configure reminder and notification preferences here.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

