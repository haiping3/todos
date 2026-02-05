/**
 * Shared type definitions
 * @author haiping.yu@zoom.us
 */

// Re-export database types
export type { Database } from './database';

// TODO Types
export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: TodoStatus;
  priority: TodoPriority;
  deadline?: Date;
  reminder?: Date;
  completedAt?: Date;
  tags: string[];
  category?: string;
  attachments: Attachment[];
  aiSuggestions?: AISuggestion[];
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Attachment {
  id: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  mimeType: string;
  localPath?: string;
  remotePath?: string;
  thumbnailPath?: string;
}

export interface AISuggestion {
  type: 'priority' | 'category' | 'summary';
  suggestion: unknown;
  accepted: boolean;
  createdAt: Date;
}

// Knowledge Base Types
export interface KnowledgeItem {
  id: string;
  type: 'article' | 'note';
  url?: string;
  title: string;
  content?: string;
  summary?: string;
  tags: string[];
  keywords: string[];
  category?: string;
  source?: string;
  author?: string;
  publishedAt?: Date;
  status: KnowledgeStatus;
  processingError?: string;
  highlights?: Highlight[];
  createdAt: Date;
  updatedAt: Date;
  syncedAt?: Date;
}

export type KnowledgeStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface Highlight {
  id: string;
  text: string;
  note?: string;
  position: {
    start: number;
    end: number;
  };
  createdAt: Date;
}

// AI Configuration Types
export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'qwen' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  openai?: OpenAIConfig;
  anthropic?: AnthropicConfig;
  deepseek?: DeepSeekConfig;
  qwen?: QwenConfig;
  custom?: CustomAIConfig;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface OpenAIConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  embeddingModel: string;
}

export interface AnthropicConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface DeepSeekConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface QwenConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

export interface CustomAIConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  embeddingModel?: string;
  headers?: Record<string, string>;
}

// Settings Types
export type ThemeMode = 'light' | 'dark' | 'system';

export interface AutoSyncConfig {
  enabled: boolean;
  intervalMinutes: number; // Periodic sync interval (default: 5)
  debounceSeconds: number; // Change debounce (default: 5)
  syncOnNetworkRestore: boolean; // Sync when network comes back online
}

export interface AppSettings {
  theme: ThemeMode;
  notifications: boolean;
  autoSummarize: boolean;
  summaryThreshold: number;
  syncEnabled: boolean;
  autoSync: AutoSyncConfig;
  reminderDefaults: {
    beforeDeadline: number; // minutes
  };
}

// Legacy alias
export type UserSettings = AppSettings & { aiConfig: AIConfig };

// Message Types for Chrome Extension
export interface ExtensionMessage<T = unknown> {
  type: string;
  payload?: T;
}

export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

