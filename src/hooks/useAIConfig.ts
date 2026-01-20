/**
 * React hook for managing AI configuration
 * @author haiping.yu@zoom.us
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  AIConfig,
  AIProvider,
  OpenAIConfig,
  AnthropicConfig,
  DeepSeekConfig,
  QwenConfig,
  CustomAIConfig,
} from '@/types';

const AI_CONFIG_KEY = 'ai_config';

const DEFAULT_OPENAI_CONFIG: OpenAIConfig = {
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-3.5-turbo',
  embeddingModel: 'text-embedding-3-small',
};

const DEFAULT_ANTHROPIC_CONFIG: AnthropicConfig = {
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-3-sonnet-20240229',
};

const DEFAULT_DEEPSEEK_CONFIG: DeepSeekConfig = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
};

const DEFAULT_QWEN_CONFIG: QwenConfig = {
  apiKey: '',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-plus',
};

const DEFAULT_CUSTOM_CONFIG: CustomAIConfig = {
  name: 'Custom AI',
  baseUrl: '',
  apiKey: '',
  model: '',
};

const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  openai: DEFAULT_OPENAI_CONFIG,
  anthropic: DEFAULT_ANTHROPIC_CONFIG,
  deepseek: DEFAULT_DEEPSEEK_CONFIG,
  qwen: DEFAULT_QWEN_CONFIG,
  custom: DEFAULT_CUSTOM_CONFIG,
  maxTokens: 2048,
  temperature: 0.7,
  timeout: 30000,
};

interface UseAIConfigResult {
  config: AIConfig;
  isLoading: boolean;
  error: Error | null;
  isConfigured: boolean;
  updateConfig: (updates: Partial<AIConfig>) => Promise<void>;
  setProvider: (provider: AIProvider) => Promise<void>;
  updateProviderConfig: <T extends keyof AIConfig>(
    provider: T,
    config: Partial<NonNullable<AIConfig[T]>>
  ) => Promise<void>;
  resetConfig: () => Promise<void>;
  testConnection: () => Promise<{ success: boolean; message: string }>;
}

/**
 * Hook for managing AI service configuration
 */
export function useAIConfig(): UseAIConfigResult {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load config from storage
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const result = await chrome.storage.local.get(AI_CONFIG_KEY);
        const stored = result[AI_CONFIG_KEY];
        if (stored) {
          setConfig({ ...DEFAULT_AI_CONFIG, ...stored });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load AI config'));
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  // Listen for changes
  useEffect(() => {
    const handleChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[AI_CONFIG_KEY]) {
        setConfig({ ...DEFAULT_AI_CONFIG, ...changes[AI_CONFIG_KEY].newValue });
      }
    };

    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  // Check if current provider is configured
  const isConfigured = (() => {
    const provider = config.provider;
    const providerConfig = config[provider];
    if (!providerConfig || typeof providerConfig !== 'object') return false;
    
    if ('apiKey' in providerConfig) {
      return Boolean(providerConfig.apiKey);
    }
    return false;
  })();

  // Update config
  const updateConfig = useCallback(async (updates: Partial<AIConfig>) => {
    const newConfig = { ...config, ...updates };
    await chrome.storage.local.set({ [AI_CONFIG_KEY]: newConfig });
    setConfig(newConfig);
  }, [config]);

  // Set provider
  const setProvider = useCallback(async (provider: AIProvider) => {
    await updateConfig({ provider });
  }, [updateConfig]);

  // Update specific provider config
  const updateProviderConfig = useCallback(async <T extends keyof AIConfig>(
    provider: T,
    providerUpdates: Partial<NonNullable<AIConfig[T]>>
  ) => {
    const currentProviderConfig = config[provider] || {};
    const newProviderConfig = { ...currentProviderConfig, ...providerUpdates };
    await updateConfig({ [provider]: newProviderConfig } as Partial<AIConfig>);
  }, [config, updateConfig]);

  // Reset to defaults
  const resetConfig = useCallback(async () => {
    await chrome.storage.local.set({ [AI_CONFIG_KEY]: DEFAULT_AI_CONFIG });
    setConfig(DEFAULT_AI_CONFIG);
  }, []);

  // Test connection to AI service
  const testConnection = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!isConfigured) {
      return { success: false, message: 'API Key not configured' };
    }

    try {
      const provider = config.provider;
      const providerConfig = config[provider];
      
      if (!providerConfig || typeof providerConfig !== 'object') {
        return { success: false, message: 'Invalid provider configuration' };
      }

      // Get baseUrl and apiKey based on provider type
      let baseUrl = '';
      let apiKey = '';
      
      if ('baseUrl' in providerConfig && 'apiKey' in providerConfig) {
        baseUrl = providerConfig.baseUrl || '';
        apiKey = providerConfig.apiKey || '';
      }

      if (!baseUrl || !apiKey) {
        return { success: false, message: 'Missing baseUrl or apiKey' };
      }

      // Make a simple test request (list models)
      const response = await fetch(`${baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return { success: true, message: 'Connection successful!' };
      } else {
        const error = await response.text();
        return { success: false, message: `API Error: ${response.status} - ${error}` };
      }
    } catch (err) {
      return { 
        success: false, 
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
      };
    }
  }, [config, isConfigured]);

  return {
    config,
    isLoading,
    error,
    isConfigured,
    updateConfig,
    setProvider,
    updateProviderConfig,
    resetConfig,
    testConnection,
  };
}

// Export defaults for reference
export {
  DEFAULT_AI_CONFIG,
  DEFAULT_OPENAI_CONFIG,
  DEFAULT_ANTHROPIC_CONFIG,
  DEFAULT_DEEPSEEK_CONFIG,
  DEFAULT_QWEN_CONFIG,
  DEFAULT_CUSTOM_CONFIG,
};

// Provider display info
export const AI_PROVIDERS: {
  value: AIProvider;
  label: string;
  description: string;
}[] = [
  { value: 'openai', label: 'OpenAI', description: 'GPT-4, GPT-3.5, Embeddings' },
  { value: 'anthropic', label: 'Anthropic', description: 'Claude 3 Opus, Sonnet, Haiku' },
  { value: 'deepseek', label: 'DeepSeek', description: 'DeepSeek-V3, DeepSeek-Coder' },
  { value: 'qwen', label: '通义千问', description: 'Qwen-Max, Qwen-Plus, Qwen-Turbo' },
  { value: 'custom', label: 'Custom', description: 'OpenAI-compatible API' },
];

