/**
 * AI Provider configuration component
 * @author haiping.yu@zoom.us
 */

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Loader2, 
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { AIConfig, AIProvider } from '@/types';
import { Button } from './Button';
import { Input } from './Input';
import { AI_PROVIDERS } from '@/hooks/useAIConfig';

interface AIProviderConfigProps {
  config: AIConfig;
  onUpdateConfig: (updates: Partial<AIConfig>) => Promise<void>;
  onUpdateProviderConfig: <T extends keyof AIConfig>(
    provider: T,
    config: Partial<NonNullable<AIConfig[T]>>
  ) => Promise<void>;
  onTestConnection: () => Promise<{ success: boolean; message: string }>;
}

export const AIProviderConfig: React.FC<AIProviderConfigProps> = ({
  config,
  onUpdateConfig,
  onUpdateProviderConfig,
  onTestConnection,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const currentProvider = AI_PROVIDERS.find((p) => p.value === config.provider);
  const providerConfig = config[config.provider];
  const hasApiKey = providerConfig && 'apiKey' in providerConfig && Boolean(providerConfig.apiKey);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection();
      setTestResult(result);
    } finally {
      setIsTesting(false);
    }
  };

  const handleProviderChange = async (provider: AIProvider) => {
    await onUpdateConfig({ provider });
    setTestResult(null);
  };

  const getCurrentApiKey = (): string => {
    const pc = config[config.provider];
    if (pc && typeof pc === 'object' && 'apiKey' in pc) {
      return (pc as { apiKey: string }).apiKey || '';
    }
    return '';
  };

  const getCurrentBaseUrl = (): string => {
    const pc = config[config.provider];
    if (pc && typeof pc === 'object' && 'baseUrl' in pc) {
      return (pc as { baseUrl?: string }).baseUrl || '';
    }
    return '';
  };

  const getCurrentModel = (): string => {
    const pc = config[config.provider];
    if (pc && typeof pc === 'object' && 'model' in pc) {
      return (pc as { model: string }).model || '';
    }
    return '';
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {currentProvider?.label || 'Select Provider'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {hasApiKey ? (
                <span className="text-green-600 dark:text-green-400">✓ Configured</span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">Not configured</span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="p-3 space-y-4 border-t border-gray-200 dark:border-gray-700">
          {/* Provider selection */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AI_PROVIDERS.map((provider) => (
                <button
                  key={provider.value}
                  type="button"
                  onClick={() => handleProviderChange(provider.value)}
                  className={clsx(
                    'p-2 rounded-lg border text-left transition-all',
                    config.provider === provider.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {provider.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {provider.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={getCurrentApiKey()}
                onChange={(e) => 
                  onUpdateProviderConfig(config.provider, { apiKey: e.target.value } as never)
                }
                placeholder="Enter your API key..."
                className="input pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Base URL (for custom or advanced users) */}
          {(config.provider === 'custom' || getCurrentBaseUrl()) && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                API Base URL
              </label>
              <Input
                value={getCurrentBaseUrl()}
                onChange={(e) =>
                  onUpdateProviderConfig(config.provider, { baseUrl: e.target.value } as never)
                }
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}

          {/* Model */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Model
            </label>
            <Input
              value={getCurrentModel()}
              onChange={(e) =>
                onUpdateProviderConfig(config.provider, { model: e.target.value } as never)
              }
              placeholder="gpt-3.5-turbo"
            />
          </div>

          {/* Custom provider name */}
          {config.provider === 'custom' && config.custom && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Display Name
              </label>
              <Input
                value={config.custom.name || ''}
                onChange={(e) =>
                  onUpdateProviderConfig('custom', { name: e.target.value })
                }
                placeholder="My Custom AI"
              />
            </div>
          )}

          {/* Test connection */}
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <Button
              type="button"
              variant="secondary"
              onClick={handleTestConnection}
              disabled={!hasApiKey || isTesting}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            {testResult && (
              <div
                className={clsx(
                  'mt-2 p-2 rounded-lg text-sm flex items-start gap-2',
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                )}
              >
                {testResult.success ? (
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

