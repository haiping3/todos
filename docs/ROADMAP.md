# Development Roadmap

> **Author**: haiping.yu@zoom.us  
> **Last Updated**: 2026-01-19  
> **Purpose**: Guide for upcoming feature development with AI tools (Cursor, Claude Code, etc.)

---

## 当前状态总结

### ✅ 已完成功能 (MVP v1.0)

| 模块 | 功能 | 状态 |
|------|------|------|
| TODO | 基础 CRUD（添加、编辑、删除、完成） | ✅ Done |
| TODO | 优先级系统（彩色标签） | ✅ Done |
| TODO | Deadline 和进度条 | ✅ Done |
| TODO | 提醒通知 | ✅ Done |
| TODO | 图片粘贴/上传 | ✅ Done |
| TODO | AI 自动摘要（标题生成） | ✅ Done |
| TODO | AI 优先级建议 | ✅ Done |
| TODO | AI TODO 列表总结 | ✅ Done |
| TODO | 标签输入 | ✅ Done |
| 知识库 | 保存当前页面 | ✅ Done |
| 知识库 | URL 添加 | ✅ Done |
| 知识库 | 列表展示和搜索 | ✅ Done |
| 知识库 | AI 摘要生成 | ✅ Done |
| 知识库 | AI 关键词提取 | ✅ Done |
| 知识库 | AI 分类建议 | ✅ Done |
| 设置 | 主题切换 | ✅ Done |
| 设置 | AI 服务配置 | ✅ Done |
| 通用 | 快捷键支持 | ✅ Done |
| 通用 | 右键菜单 | ✅ Done |

---

## 📋 待开发功能路线图

### Phase 1: 云端同步 (v1.1)

#### 1.1 Supabase 基础集成

**目标**: 实现用户认证和数据云端同步

**优先级**: P0 - Must Have

**预计工时**: 3-5 天

##### 需要完成的任务

| 任务 | 描述 | 相关文件 |
|------|------|---------|
| 1.1.1 Supabase 项目配置 | 创建 Supabase 项目，配置环境变量 | `.env`, `src/lib/supabase.ts` |
| 1.1.2 用户认证 UI | 登录/注册界面，支持 Email + OAuth | `src/components/Auth.tsx` |
| 1.1.3 认证状态管理 | 实现 useAuth Hook | `src/hooks/useAuth.ts` |
| 1.1.4 TODO 数据同步 | 本地 ↔ 云端双向同步 | `src/hooks/useTodos.ts` |
| 1.1.5 知识库数据同步 | 知识库数据同步 | `src/hooks/useKnowledge.ts` |
| 1.1.6 冲突处理 | 同步冲突解决策略 | `src/utils/sync.ts` |
| 1.1.7 离线支持 | 离线时本地存储，上线后自动同步 | `src/utils/sync.ts` |

##### 实现指南

**1.1.1 Supabase 项目配置**

```bash
# 1. 创建 Supabase 项目 (https://supabase.com/dashboard)
# 2. 复制项目 URL 和 anon key
# 3. 创建环境变量文件
```

```typescript
// .env.local
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

```typescript
// src/lib/supabase.ts - 更新客户端配置
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Chrome Extension 需要特殊配置
    storage: {
      getItem: async (key) => {
        const result = await chrome.storage.local.get(key);
        return result[key] ?? null;
      },
      setItem: async (key, value) => {
        await chrome.storage.local.set({ [key]: value });
      },
      removeItem: async (key) => {
        await chrome.storage.local.remove(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

**1.1.2 用户认证 UI**

创建新文件 `src/components/Auth.tsx`:

```typescript
/**
 * User authentication component
 * Supports Email/Password and OAuth (Google, GitHub)
 * @author haiping.yu@zoom.us
 */
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface AuthProps {
  onSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      onSuccess();
    }
    setLoading(false);
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    // OAuth in Chrome Extension requires special handling
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: chrome.identity.getRedirectURL(),
      },
    });
    // Handle redirect flow...
  };

  return (
    <div className="auth-container">
      {/* Auth form UI */}
    </div>
  );
};
```

**1.1.3 useAuth Hook**

创建 `src/hooks/useAuth.ts`:

```typescript
/**
 * Authentication state management hook
 * @author haiping.yu@zoom.us
 */
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isAuthenticated: !!session,
      });
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setState({
          user: session?.user ?? null,
          session,
          isLoading: false,
          isAuthenticated: !!session,
        });
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
```

**1.1.4 TODO 数据同步**

更新 `src/hooks/useTodos.ts`:

```typescript
// Add sync functionality
import { supabase } from '../lib/supabase';

// Sync local todos to cloud
async function syncToCloud(todos: Todo[]) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return;

  const { error } = await supabase
    .from('todos')
    .upsert(
      todos.map(todo => ({
        ...todo,
        user_id: user.user.id,
      })),
      { onConflict: 'id' }
    );

  if (error) console.error('Sync error:', error);
}

// Fetch from cloud
async function fetchFromCloud(): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}
```

---

### Phase 2: 语义搜索 (v1.1)

#### 2.1 向量嵌入生成

**目标**: 为知识库内容生成向量嵌入，支持语义搜索

**优先级**: P1 - Should Have

**预计工时**: 2-3 天

##### 需要完成的任务

| 任务 | 描述 | 相关文件 |
|------|------|---------|
| 2.1.1 Supabase Edge Function | 创建嵌入生成的 Edge Function | `supabase/functions/embed/index.ts` |
| 2.1.2 数据库迁移 | 添加 embedding 向量列和索引 | `supabase/migrations/` |
| 2.1.3 嵌入生成调用 | 保存知识时调用嵌入生成 | `src/utils/ai.ts` |
| 2.1.4 向量搜索函数 | 创建语义搜索的数据库函数 | `supabase/migrations/` |
| 2.1.5 搜索 UI | 添加语义搜索选项 | `src/components/KnowledgeSearch.tsx` |

##### 实现指南

**2.1.1 创建 Supabase Edge Function**

```bash
# 在项目目录运行
supabase functions new embed
```

```typescript
// supabase/functions/embed/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { content, knowledgeId } = await req.json();

    // Use OpenAI embeddings API
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: content,
      }),
    });

    const { data } = await embeddingResponse.json();
    const embedding = data[0].embedding;

    // Store embedding in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase
      .from('knowledge_items')
      .update({ embedding })
      .eq('id', knowledgeId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**2.1.2 数据库迁移**

```sql
-- supabase/migrations/xxx_add_embedding_column.sql

-- Enable pgvector extension
create extension if not exists vector with schema extensions;

-- Add embedding column
alter table knowledge_items 
add column embedding vector(1536);

-- Create index for fast similarity search
create index on knowledge_items 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);
```

**2.1.4 语义搜索函数**

```sql
-- supabase/migrations/xxx_semantic_search_function.sql

create or replace function search_knowledge(
  query_embedding vector(1536),
  match_threshold float default 0.78,
  match_count int default 10
)
returns table (
  id uuid,
  title text,
  summary text,
  url text,
  similarity float
)
language plpgsql
security invoker
set search_path = public
as $$
begin
  return query
  select
    ki.id,
    ki.title,
    ki.summary,
    ki.url,
    1 - (ki.embedding <=> query_embedding) as similarity
  from knowledge_items ki
  where ki.embedding is not null
    and 1 - (ki.embedding <=> query_embedding) > match_threshold
  order by ki.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

---

### Phase 3: AI 问答 RAG (v1.2)

#### 3.1 检索增强生成

**目标**: 基于知识库内容的 AI 问答功能

**优先级**: P1 - Should Have

**预计工时**: 3-4 天

##### 需要完成的任务

| 任务 | 描述 | 相关文件 |
|------|------|---------|
| 3.1.1 RAG UI | 问答界面设计 | `src/components/RAGChat.tsx` |
| 3.1.2 检索模块 | 根据问题检索相关知识 | `src/utils/rag.ts` |
| 3.1.3 上下文构建 | 构建 LLM 上下文 | `src/utils/rag.ts` |
| 3.1.4 答案生成 | 调用 LLM 生成答案 | `src/utils/ai.ts` |
| 3.1.5 来源引用 | 显示答案来源 | `src/components/RAGChat.tsx` |

##### 实现指南

**3.1.1 RAG Chat UI**

```typescript
// src/components/RAGChat.tsx
/**
 * RAG-based Q&A chat component
 * @author haiping.yu@zoom.us
 */
import React, { useState } from 'react';
import { searchKnowledge, generateAnswer } from '../utils/rag';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    id: string;
    title: string;
    url?: string;
  }>;
}

export const RAGChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 1. Search relevant knowledge
      const relevantDocs = await searchKnowledge(input);
      
      // 2. Generate answer with context
      const answer = await generateAnswer(input, relevantDocs);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: answer.content,
        sources: answer.sources,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rag-chat">
      {/* Chat messages */}
      {/* Input form */}
    </div>
  );
};
```

**3.1.2 RAG 工具函数**

```typescript
// src/utils/rag.ts
/**
 * Retrieval-Augmented Generation utilities
 * @author haiping.yu@zoom.us
 */
import { supabase } from '../lib/supabase';
import { getAIConfig, callAI } from './ai';

interface RelevantDoc {
  id: string;
  title: string;
  content: string;
  url?: string;
  similarity: number;
}

/**
 * Search knowledge base using semantic similarity
 */
export async function searchKnowledge(query: string): Promise<RelevantDoc[]> {
  // 1. Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);
  
  // 2. Call Supabase search function
  const { data, error } = await supabase.rpc('search_knowledge', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7,
    match_count: 5,
  });

  if (error) throw error;
  return data ?? [];
}

/**
 * Generate answer using retrieved context
 */
export async function generateAnswer(
  question: string,
  docs: RelevantDoc[]
): Promise<{ content: string; sources: Array<{ id: string; title: string; url?: string }> }> {
  // Build context from retrieved documents
  const context = docs
    .map((doc, i) => `[${i + 1}] ${doc.title}\n${doc.content}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful assistant that answers questions based on the user's personal knowledge base.
Use the following context to answer the question. If the answer cannot be found in the context, say so.
Always cite sources using [1], [2], etc.

Context:
${context}`;

  const config = await getAIConfig();
  const response = await callAI(config, systemPrompt, question);

  return {
    content: response,
    sources: docs.map(doc => ({
      id: doc.id,
      title: doc.title,
      url: doc.url,
    })),
  };
}
```

---

### Phase 4: 多维度统计 (v1.2)

#### 4.1 统计仪表板

**目标**: 提供 TODO 完成率和效率趋势统计

**优先级**: P2 - Nice to Have

**预计工时**: 2-3 天

##### 需要完成的任务

| 任务 | 描述 | 相关文件 |
|------|------|---------|
| 4.1.1 统计数据计算 | 计算日/周/月完成率 | `src/utils/statistics.ts` |
| 4.1.2 图表组件 | 使用 Chart.js 或 Recharts | `src/components/StatsChart.tsx` |
| 4.1.3 统计视图 | 统计页面 UI | `src/popup/Popup.tsx` |
| 4.1.4 分类分布 | 按分类统计任务数量 | `src/utils/statistics.ts` |
| 4.1.5 趋势分析 | 效率趋势线 | `src/components/TrendChart.tsx` |

##### 实现指南

```typescript
// src/utils/statistics.ts
/**
 * TODO statistics calculation utilities
 * @author haiping.yu@zoom.us
 */
import { Todo } from '../types';
import { startOfDay, startOfWeek, startOfMonth, isWithinInterval } from 'date-fns';

interface CompletionStats {
  total: number;
  completed: number;
  rate: number; // 0-100
}

/**
 * Calculate completion rate for a time period
 */
export function calculateCompletionRate(
  todos: Todo[],
  period: 'day' | 'week' | 'month'
): CompletionStats {
  const now = new Date();
  let periodStart: Date;
  
  switch (period) {
    case 'day':
      periodStart = startOfDay(now);
      break;
    case 'week':
      periodStart = startOfWeek(now);
      break;
    case 'month':
      periodStart = startOfMonth(now);
      break;
  }

  const periodTodos = todos.filter(todo => 
    isWithinInterval(new Date(todo.createdAt), {
      start: periodStart,
      end: now,
    })
  );

  const completed = periodTodos.filter(t => t.status === 'completed').length;
  const total = periodTodos.length;
  
  return {
    total,
    completed,
    rate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Get category distribution
 */
export function getCategoryDistribution(todos: Todo[]): Record<string, number> {
  return todos.reduce((acc, todo) => {
    const category = todo.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get daily completion trend (last 7 days)
 */
export function getDailyTrend(todos: Todo[]): Array<{ date: string; completed: number }> {
  // Implementation...
}
```

---

### Phase 5: 标签和分类管理 (v1.2)

#### 5.1 高级分类系统

**目标**: 层级标签和分类管理

**优先级**: P2 - Nice to Have

**预计工时**: 2-3 天

##### 需要完成的任务

| 任务 | 描述 | 相关文件 |
|------|------|---------|
| 5.1.1 标签管理 UI | 标签 CRUD 界面 | `src/components/TagManager.tsx` |
| 5.1.2 分类树 | 层级分类结构 | `src/components/CategoryTree.tsx` |
| 5.1.3 批量操作 | 批量添加/移除标签 | `src/hooks/useTodos.ts` |
| 5.1.4 标签筛选 | 按标签过滤列表 | `src/components/TodoList.tsx` |
| 5.1.5 标签颜色 | 自定义标签颜色 | `src/types/index.ts` |

---

### Phase 6: 数据导入导出 (v1.2)

#### 6.1 数据便携性

**目标**: 支持数据备份和迁移

**优先级**: P2 - Nice to Have

**预计工时**: 1-2 天

##### 需要完成的任务

| 任务 | 描述 | 相关文件 |
|------|------|---------|
| 6.1.1 导出功能 | 导出为 JSON/CSV | `src/utils/export.ts` |
| 6.1.2 导入功能 | 从文件导入 | `src/utils/import.ts` |
| 6.1.3 书签导入 | 导入浏览器书签 | `src/utils/import.ts` |
| 6.1.4 导入 UI | 导入向导界面 | `src/components/ImportWizard.tsx` |

##### 实现指南

```typescript
// src/utils/export.ts
/**
 * Data export utilities
 * @author haiping.yu@zoom.us
 */
import { Todo, KnowledgeItem } from '../types';

interface ExportData {
  version: string;
  exportedAt: string;
  todos: Todo[];
  knowledge: KnowledgeItem[];
  settings: unknown;
}

/**
 * Export all data as JSON
 */
export async function exportToJSON(): Promise<string> {
  const [todos, knowledge, settings] = await Promise.all([
    chrome.storage.local.get('todos'),
    chrome.storage.local.get('knowledge_items'),
    chrome.storage.local.get('app_settings'),
  ]);

  const data: ExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    todos: todos.todos ?? [],
    knowledge: knowledge.knowledge_items ?? [],
    settings: settings.app_settings,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Download exported data
 */
export function downloadJSON(data: string, filename: string) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}
```

---

## 📅 开发时间线

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Development Timeline                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Week 1-2     │  Phase 1: Cloud Sync                                    │
│  ─────────────┼──────────────────────────────────────────────────────   │
│               │  • Supabase auth integration                            │
│               │  • TODO sync                                             │
│               │  • Knowledge sync                                        │
│               │  • Conflict resolution                                   │
│                                                                          │
│  Week 3       │  Phase 2: Semantic Search                               │
│  ─────────────┼──────────────────────────────────────────────────────   │
│               │  • Edge Function for embeddings                         │
│               │  • pgvector setup                                        │
│               │  • Search UI                                             │
│                                                                          │
│  Week 4       │  Phase 3: RAG Q&A                                       │
│  ─────────────┼──────────────────────────────────────────────────────   │
│               │  • RAG pipeline                                          │
│               │  • Chat UI                                               │
│               │  • Source citations                                      │
│                                                                          │
│  Week 5       │  Phase 4-6: Polish                                      │
│  ─────────────┼──────────────────────────────────────────────────────   │
│               │  • Statistics dashboard                                  │
│               │  • Tag management                                        │
│               │  • Import/Export                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 开发命令备忘

```bash
# 开发模式
pnpm dev

# 构建扩展
pnpm build

# 运行测试
pnpm test

# Supabase 本地开发
supabase start
supabase db push
supabase functions serve

# 代码检查
pnpm lint
pnpm format
```

---

## 📚 相关文档

| 文档 | 路径 | 描述 |
|------|------|------|
| 产品需求 | `docs/PRD.md` | 完整功能需求和用户故事 |
| 架构设计 | `docs/ARCHITECTURE.md` | 技术架构和模块设计 |
| 开发规范 | `.cursor/rules/` | 编码规范和最佳实践 |

---

## ⚠️ 注意事项

### Chrome Extension 特殊考虑

1. **Service Worker 生命周期**: 后台脚本会被 Chrome 挂起，不要依赖全局变量
2. **OAuth 重定向**: 使用 `chrome.identity.getRedirectURL()` 获取回调 URL
3. **存储限制**: `chrome.storage.local` 有 10MB 限制，大文件使用 IndexedDB
4. **网络请求**: 使用 `permissions` 声明需要的域名

### Supabase 集成注意

1. **RLS 策略**: 所有表必须启用 RLS 并配置策略
2. **API Key 安全**: anon key 可以暴露，但要配合 RLS 使用
3. **Edge Function 冷启动**: 首次调用可能慢，考虑预热
4. **向量维度**: OpenAI embedding 是 1536 维，其他模型可能不同

### AI 服务注意

1. **成本控制**: 设置 token 上限，避免大量调用
2. **超时处理**: AI API 可能慢，需要设置合理超时
3. **fallback**: 当 AI 不可用时，提供本地降级方案
4. **API Key 存储**: 使用 `chrome.storage.local`，不要硬编码

---

> 💡 **开发建议**: 每个 Phase 开始前，先阅读相关的 `.cursor/rules/` 文件，确保遵循项目规范。

