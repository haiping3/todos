# AI Assistant Chrome Extension

> AI-powered TODO management and personal knowledge base

**Author**: haiping.yu@zoom.us

## Features

### TODO List Management
- ✅ Quick add TODOs from popup or context menu
- ✅ Multi-image paste support
- ✅ Deadline and reminder notifications
- ✅ AI-powered priority suggestions
- ✅ AI-generated summaries and categorization

### AI Knowledge Base
- ✅ One-click save web articles
- ✅ AI auto-extraction and summarization
- ✅ Semantic search with vector embeddings
- ✅ RAG-based Q&A over your knowledge

## Tech Stack

| Category | Technology |
|----------|------------|
| Platform | Chrome Extension (Manifest V3) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Backend | Supabase (Auth, Database, Storage) |
| Vector DB | Supabase pgvector |
| AI | OpenAI / Anthropic / DeepSeek / Qwen / Custom |
| Build | Vite |
| Package Manager | pnpm |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Supabase CLI (optional, for local development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd chromeplugin

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Build for Production

```bash
# Build the extension
pnpm build

# The built extension will be in the `dist` folder
```

### Load in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `dist` folder

## Project Structure

```
chromeplugin/
├── .cursor/rules/         # Cursor AI rules
├── docs/
│   └── PRD.md            # Product requirements
├── public/
│   ├── manifest.json     # Chrome extension manifest
│   └── icons/            # Extension icons
├── src/
│   ├── popup/            # Popup UI (React)
│   ├── options/          # Options page (React)
│   ├── background/       # Service worker
│   ├── content/          # Content script
│   ├── components/       # Shared React components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Library configs (Supabase)
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript types
│   └── styles/           # Global styles
├── supabase/
│   ├── config.toml       # Local Supabase config
│   ├── migrations/       # Database migrations
│   └── functions/        # Edge Functions
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Supabase Setup

### Option 1: Supabase Cloud

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migrations: ensure the project is linked (e.g. `supabase link --project-ref <your-ref>`), run `supabase login` if needed, then `pnpm run db:push` to apply all migrations in `supabase/migrations/`.
3. Set environment variables:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Option 2: Local Development

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Stop when done
supabase stop
```

### Deploy Edge Function `generate-embedding`

The Knowledge semantic search uses an Edge Function with **Supabase built-in gte-small** (no OpenAI or other external API). A **404** on `/functions/v1/generate-embedding` means it is not deployed yet.

1. **Login and link** (one-time):

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF   # project id is in .supabase/config.toml (e.g. smcpizabepxxsydyqfwk)
   ```

2. **Apply migration** (switches embeddings to 384-dim gte-small):

   ```bash
   pnpm run db:push
   ```
   Or `supabase db push` if you use the CLI directly.

3. **Deploy the function** (no secrets required for gte-small):

   ```bash
   supabase functions deploy generate-embedding
   ```

   校验在函数内完成：使用 Supabase JWKS（`/auth/v1/.well-known/jwks.json`）对 `Authorization: Bearer <access_token>` 做 JWT 校验，再通过 `getUser()` 取身份。`config.toml` 里 `verify_jwt = false` 仅用于让请求先到达 handler，避免平台侧与 JWKS 不一致导致 401。若部署后仍 401，可尝试带 `--no-verify-jwt` 再部署一次。

4. **Verify**: `https://<project-ref>.supabase.co/functions/v1/generate-embedding` should respond (e.g. 400 for missing body when unauthenticated, or 401 when token is missing/invalid; 404 means not deployed).

## Configuration

### AI Provider Setup

The extension supports multiple AI providers. Configure in the Options page:

| Provider | API Endpoint | Notes |
|----------|-------------|-------|
| OpenAI | api.openai.com | GPT-4, GPT-3.5, Embeddings |
| Anthropic | api.anthropic.com | Claude 3 models |
| DeepSeek | api.deepseek.com | DeepSeek-V3, DeepSeek-Coder |
| Qwen | dashscope.aliyuncs.com | Qwen-Max, Qwen-Plus |
| Custom | User-defined | Any OpenAI-compatible API |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Y` / `Cmd+Shift+Y` | Open popup |
| `Ctrl+Shift+T` / `Cmd+Shift+T` | Quick add TODO |

## Development

### Scripts

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm lint:fix     # Fix ESLint issues
pnpm format       # Format with Prettier
pnpm type-check   # TypeScript check
pnpm test         # Run tests
```

### Code Style

- Follow [.cursor/rules/code-style.mdc](.cursor/rules/code-style.mdc)
- Use TypeScript strict mode
- Prefer functional components and hooks
- Always add JSDoc comments with `@author` tag

## Security

This extension follows security best practices. See [.cursor/rules/security-security-baseline.mdc](.cursor/rules/security-security-baseline.mdc) for details:

- API keys are encrypted in Chrome storage
- All inputs are validated and sanitized
- RLS policies protect all database tables
- No tracking or analytics

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm lint && pnpm type-check`
5. Submit a pull request

