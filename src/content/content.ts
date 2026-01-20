/**
 * Content Script - Injected into web pages
 * @author haiping.yu@zoom.us
 */

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'GET_PAGE_CONTENT':
      sendResponse(getPageContent());
      break;

    case 'GET_SELECTED_TEXT':
      sendResponse(getSelectedText());
      break;

    default:
      console.warn('Unknown message type in content script:', message.type);
  }
});

/**
 * Extract main content from the current page
 */
function getPageContent(): PageContent {
  return {
    url: window.location.href,
    title: document.title,
    content: extractMainContent(),
    metadata: extractMetadata(),
  };
}

/**
 * Get currently selected text
 */
function getSelectedText(): string {
  return window.getSelection()?.toString() || '';
}

/**
 * Extract main content from the page (simplified version)
 * In production, consider using a library like Readability.js
 */
function extractMainContent(): string {
  // Try to find the main content area
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return cleanText(element.textContent || '');
    }
  }

  // Fallback: get body text
  return cleanText(document.body.textContent || '');
}

/**
 * Extract metadata from the page
 */
function extractMetadata(): PageMetadata {
  const getMetaContent = (name: string): string | undefined => {
    const meta = document.querySelector(
      `meta[name="${name}"], meta[property="${name}"]`
    ) as HTMLMetaElement | null;
    return meta?.content;
  };

  return {
    description: getMetaContent('description') || getMetaContent('og:description'),
    author: getMetaContent('author'),
    publishedTime: getMetaContent('article:published_time'),
    siteName: getMetaContent('og:site_name'),
    image: getMetaContent('og:image'),
  };
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')  // Limit consecutive newlines
    .trim();
}

// Types
interface PageContent {
  url: string;
  title: string;
  content: string;
  metadata: PageMetadata;
}

interface PageMetadata {
  description?: string;
  author?: string;
  publishedTime?: string;
  siteName?: string;
  image?: string;
}

// Mark as module
export {};

