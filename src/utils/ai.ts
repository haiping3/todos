/**
 * AI Service utilities for calling configured AI providers
 * @author haiping.yu@zoom.us
 */

import type { AIConfig, AIProvider, Todo, TodoPriority } from '@/types';

const AI_CONFIG_KEY = 'ai_config';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

/**
 * Get current AI config from storage
 */
async function getAIConfig(): Promise<AIConfig | null> {
  try {
    const result = await chrome.storage.local.get(AI_CONFIG_KEY);
    return result[AI_CONFIG_KEY] || null;
  } catch {
    return null;
  }
}

/**
 * Get API endpoint and headers for the configured provider
 */
function getProviderEndpoint(config: AIConfig): {
  url: string;
  headers: Record<string, string>;
  model: string;
} | null {
  const provider = config.provider;
  const providerConfig = config[provider];

  if (!providerConfig || typeof providerConfig !== 'object') {
    return null;
  }

  let baseUrl = '';
  let apiKey = '';
  let model = '';

  if ('baseUrl' in providerConfig) {
    baseUrl = (providerConfig.baseUrl as string) || '';
  }
  if ('apiKey' in providerConfig) {
    apiKey = (providerConfig.apiKey as string) || '';
  }
  if ('model' in providerConfig) {
    model = (providerConfig.model as string) || '';
  }

  if (!apiKey) {
    return null;
  }

  // Set default base URLs if not specified
  if (!baseUrl) {
    const defaultUrls: Record<AIProvider, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com',
      deepseek: 'https://api.deepseek.com',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      custom: '',
    };
    baseUrl = defaultUrls[provider];
  }

  // Build headers based on provider
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Add custom headers if available
  if (provider === 'custom' && 'headers' in providerConfig) {
    const customHeaders = providerConfig.headers as Record<string, string> | undefined;
    if (customHeaders) {
      Object.assign(headers, customHeaders);
    }
  }

  return {
    url: `${baseUrl}/chat/completions`,
    headers,
    model: model || 'gpt-3.5-turbo',
  };
}

/**
 * Call AI chat completion API
 */
async function chatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const aiConfig = await getAIConfig();
  
  if (!aiConfig) {
    throw new Error('AI service not configured. Please configure it in Settings.');
  }

  const endpoint = getProviderEndpoint(aiConfig);
  
  if (!endpoint) {
    throw new Error('Invalid AI configuration. Please check your API key.');
  }

  const body: Record<string, unknown> = {
    model: endpoint.model,
    messages,
    max_tokens: options?.maxTokens || aiConfig.maxTokens || 500,
    temperature: options?.temperature ?? aiConfig.temperature ?? 0.7,
  };

  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: endpoint.headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  
  if (!data.choices?.[0]?.message?.content) {
    throw new Error('Invalid response from AI service');
  }

  return data.choices[0].message.content.trim();
}

/**
 * Check if AI service is configured and ready
 */
export async function isAIConfigured(): Promise<boolean> {
  const config = await getAIConfig();
  if (!config) return false;
  
  const providerConfig = config[config.provider];
  if (!providerConfig || typeof providerConfig !== 'object') return false;
  
  if ('apiKey' in providerConfig) {
    return Boolean(providerConfig.apiKey);
  }
  
  return false;
}

// ============================================================================
// TODO Functions
// ============================================================================

/**
 * Generate a summary/title from long content
 */
export async function summarizeContent(content: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are a helpful assistant. Generate a concise title (max 60 characters) for the following TODO item. Return ONLY the title, no quotes, no explanation.',
    },
    {
      role: 'user',
      content: content,
    },
  ];

  try {
    const summary = await chatCompletion(messages);
    // Clean up the response - remove quotes if present
    return summary.replace(/^["']|["']$/g, '').trim();
  } catch (error) {
    console.error('AI summarization failed:', error);
    throw error;
  }
}

/**
 * Local fallback summarization (when AI is not configured)
 */
export function localSummarize(text: string): string {
  // Try to find the first sentence
  const sentenceEnd = text.search(/[.!?。！？]\s/);
  if (sentenceEnd > 0 && sentenceEnd < 60) {
    return text.substring(0, sentenceEnd + 1).trim();
  }
  
  // Try to find a natural break point
  const breakPoint = text.substring(0, 60).search(/[,;，；]\s/);
  if (breakPoint > 20) {
    return text.substring(0, breakPoint).trim() + '...';
  }
  
  // Truncate at word boundary
  const words = text.substring(0, 60).split(/\s/);
  if (words.length > 1) {
    words.pop();
    return words.join(' ') + '...';
  }
  
  return text.substring(0, 50) + '...';
}

/**
 * Priority suggestion for a TODO item
 */
export interface PrioritySuggestion {
  todoId: string;
  currentPriority: TodoPriority;
  suggestedPriority: TodoPriority;
  reason: string;
}

/**
 * Analyze TODOs and suggest priority adjustments
 */
export async function analyzeTodoPriorities(todos: Todo[]): Promise<PrioritySuggestion[]> {
  if (todos.length === 0) {
    return [];
  }

  const todoDescriptions = todos.map((todo, index) => {
    const deadline = todo.deadline 
      ? `(deadline: ${new Date(todo.deadline).toLocaleDateString()})` 
      : '';
    return `${index + 1}. [${todo.priority}] ${todo.title} ${deadline}`;
  }).join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a productivity assistant. Analyze the following TODO list and suggest priority adjustments.
Consider:
- Deadlines (closer deadlines = higher priority)
- Task complexity implied by the title
- Dependencies between tasks
- Current vs optimal priority

Return a JSON array with objects: { "index": number, "priority": "low"|"medium"|"high"|"urgent", "reason": "brief explanation" }
Only include items that should be changed. If no changes needed, return [].`,
    },
    {
      role: 'user',
      content: todoDescriptions,
    },
  ];

  try {
    const response = await chatCompletion(messages, { temperature: 0.3 });
    
    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const suggestions = JSON.parse(jsonMatch[0]) as {
      index: number;
      priority: TodoPriority;
      reason: string;
    }[];

    return suggestions
      .filter((s) => s.index >= 1 && s.index <= todos.length)
      .map((s) => {
        const todo = todos[s.index - 1];
        return {
          todoId: todo!.id,
          currentPriority: todo!.priority,
          suggestedPriority: s.priority,
          reason: s.reason,
        };
      });
  } catch (error) {
    console.error('Priority analysis failed:', error);
    throw error;
  }
}

/**
 * Generate a summary of the TODO list
 */
export async function summarizeTodoList(todos: Todo[]): Promise<string> {
  if (todos.length === 0) {
    return 'No TODOs to summarize.';
  }

  const pending = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const completed = todos.filter((t) => t.status === 'completed');
  const urgent = todos.filter((t) => t.priority === 'urgent' || t.priority === 'high');
  const overdue = todos.filter((t) => t.deadline && new Date(t.deadline) < new Date());

  const todoDescriptions = pending.map((todo) => {
    const deadline = todo.deadline 
      ? `(due: ${new Date(todo.deadline).toLocaleDateString()})` 
      : '';
    return `- [${todo.priority}] ${todo.title} ${deadline}`;
  }).join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a productivity assistant. Provide a brief, actionable summary of the TODO list.
Include:
- Key priorities for today
- Any urgent items
- Suggestions for what to focus on

Keep it concise (under 150 words). Use bullet points.`,
    },
    {
      role: 'user',
      content: `Stats: ${pending.length} pending, ${completed.length} completed, ${urgent.length} high priority, ${overdue.length} overdue.

Current TODOs:
${todoDescriptions || 'No pending items'}`,
    },
  ];

  try {
    return await chatCompletion(messages, { maxTokens: 300 });
  } catch (error) {
    console.error('TODO summary failed:', error);
    throw error;
  }
}

/**
 * Suggest categories/tags for a TODO item
 */
export async function suggestTodoCategories(todo: Todo): Promise<string[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a productivity assistant. Suggest 2-4 relevant category tags for the following TODO item.
Return ONLY a JSON array of strings, e.g., ["work", "urgent", "meeting"]
Use lowercase, single words or short phrases.`,
    },
    {
      role: 'user',
      content: `Title: ${todo.title}\nDescription: ${todo.description || 'N/A'}\nCurrent tags: ${todo.tags.join(', ') || 'none'}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, { temperature: 0.5, maxTokens: 100 });
    
    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const suggestions = JSON.parse(jsonMatch[0]) as string[];
    return suggestions.filter((s) => typeof s === 'string' && s.length > 0);
  } catch (error) {
    console.error('Category suggestion failed:', error);
    throw error;
  }
}

// ============================================================================
// Knowledge Base Functions
// ============================================================================

/**
 * Generate a summary for an article
 */
export async function generateArticleSummary(content: string): Promise<string> {
  // Limit content length to avoid token limits
  const truncatedContent = content.slice(0, 8000);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant. Generate a concise summary (100-200 words) of the following article.
Focus on:
- Main topic and key points
- Important insights or conclusions
- Actionable takeaways (if any)

Write in a clear, professional tone.`,
    },
    {
      role: 'user',
      content: truncatedContent,
    },
  ];

  try {
    return await chatCompletion(messages, { maxTokens: 400, temperature: 0.5 });
  } catch (error) {
    console.error('Article summary failed:', error);
    throw error;
  }
}

/**
 * Extract keywords from content
 */
export async function extractKeywords(content: string): Promise<string[]> {
  // Limit content length
  const truncatedContent = content.slice(0, 5000);

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant. Extract 5-10 important keywords or key phrases from the following content.
Return ONLY a JSON array of strings, e.g., ["machine learning", "neural networks", "AI"]
Focus on technical terms, proper nouns, and core concepts.`,
    },
    {
      role: 'user',
      content: truncatedContent,
    },
  ];

  try {
    const response = await chatCompletion(messages, { temperature: 0.3, maxTokens: 200 });
    
    // Parse JSON response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    const keywords = JSON.parse(jsonMatch[0]) as string[];
    return keywords.filter((k) => typeof k === 'string' && k.length > 0);
  } catch (error) {
    console.error('Keyword extraction failed:', error);
    return [];
  }
}

/**
 * Suggest a category for the article
 */
export async function suggestArticleCategory(title: string, summary?: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant. Suggest ONE category for the following article.
Choose from common categories like: Technology, Programming, AI/ML, Web Development, DevOps, Security, Business, Design, Productivity, Health, Science, Other.
Return ONLY the category name, no explanation.`,
    },
    {
      role: 'user',
      content: `Title: ${title}\nSummary: ${summary || 'N/A'}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, { temperature: 0.3, maxTokens: 50 });
    if (typeof response !== 'string' || !response.trim()) return 'Other';
    return response.replace(/['"]/g, '').trim() || 'Other';
  } catch (error) {
    console.error('Category suggestion failed:', error);
    return 'Other';
  }
}

/**
 * Answer a question based on knowledge base content (RAG)
 */
export async function answerFromKnowledge(
  question: string,
  relevantContent: Array<{ title: string; content: string }>
): Promise<{ answer: string; sources: string[] }> {
  if (relevantContent.length === 0) {
    return {
      answer: 'I could not find relevant information in your knowledge base to answer this question.',
      sources: [],
    };
  }

  const context = relevantContent
    .map((item, i) => `[${i + 1}] ${item.title}:\n${item.content.slice(0, 2000)}`)
    .join('\n\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant. Answer the user's question based ONLY on the provided knowledge base content.
If the answer is not in the provided content, say so clearly.
After your answer, list which sources (by number) you used.`,
    },
    {
      role: 'user',
      content: `Knowledge Base Content:\n${context}\n\nQuestion: ${question}`,
    },
  ];

  try {
    const response = await chatCompletion(messages, { maxTokens: 600 });
    
    // Extract source numbers from response
    const sourceMatches = response.match(/\[(\d+)\]/g) || [];
    const sourceIndices = [...new Set(sourceMatches.map((m) => parseInt(m.slice(1, -1)) - 1))];
    const sources = sourceIndices
      .filter((i) => i >= 0 && i < relevantContent.length)
      .map((i) => relevantContent[i]!.title);

    return {
      answer: response,
      sources,
    };
  } catch (error) {
    console.error('Q&A failed:', error);
    throw error;
  }
}

/**
 * Local fallback for article summary (when AI is not configured)
 */
export function localArticleSummary(content: string): string {
  // Extract first few sentences
  const sentences = content.split(/[.!?。！？]+/).filter((s) => s.trim().length > 20);
  const summary = sentences.slice(0, 3).join('. ').trim();
  
  if (summary.length > 200) {
    return summary.slice(0, 200) + '...';
  }
  
  return summary || content.slice(0, 200) + '...';
}

/**
 * Local fallback for keyword extraction (when AI is not configured)
 */
export function localExtractKeywords(content: string): string[] {
  // Simple frequency-based keyword extraction
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4);

  const stopWords = new Set([
    'about', 'after', 'before', 'being', 'between', 'could', 'doing',
    'during', 'every', 'first', 'found', 'great', 'having', 'however',
    'include', 'including', 'itself', 'known', 'large', 'later', 'least',
    'little', 'might', 'often', 'other', 'overall', 'people', 'place',
    'possible', 'present', 'rather', 'really', 'right', 'second', 'several',
    'should', 'since', 'small', 'something', 'state', 'still', 'their',
    'there', 'these', 'thing', 'think', 'third', 'those', 'three', 'through',
    'today', 'together', 'under', 'until', 'using', 'various', 'wants',
    'where', 'which', 'while', 'within', 'without', 'would', 'years',
  ]);

  const wordCount: Record<string, number> = {};
  for (const word of words) {
    if (!stopWords.has(word)) {
      wordCount[word] = (wordCount[word] || 0) + 1;
    }
  }

  const sorted = Object.entries(wordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  return sorted;
}
