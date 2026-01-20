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
2. Run the migrations in `supabase/migrations/` folder
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

