/**
 * Content extraction utilities for web pages
 * @author haiping.yu@zoom.us
 */

/**
 * Extracted page content structure
 */
export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  description?: string;
  author?: string;
  publishedAt?: string;
  siteName?: string;
  favicon?: string;
}

/**
 * Extract content from the current page via content script
 */
export async function extractCurrentPageContent(): Promise<ExtractedContent | null> {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id || !tab.url) {
      console.warn('No active tab found');
      return null;
    }

    // Skip non-http pages
    if (!tab.url.startsWith('http')) {
      console.warn('Cannot extract content from non-http page:', tab.url);
      return null;
    }

    // Send message to content script to extract content
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });

    if (!response) {
      console.warn('No response from content script');
      return null;
    }

    return {
      url: response.url || tab.url,
      title: response.title || tab.title || 'Untitled',
      content: response.content || '',
      description: response.metadata?.description,
      author: response.metadata?.author,
      publishedAt: response.metadata?.publishedTime,
      siteName: response.metadata?.siteName,
      favicon: tab.favIconUrl,
    };
  } catch (error) {
    console.error('Failed to extract page content:', error);
    return null;
  }
}

/**
 * Fetch and extract content from a URL (from background/service worker)
 */
export async function fetchAndExtractContent(url: string): Promise<ExtractedContent | null> {
  try {
    // Find a tab with this URL or use active tab
    const tabs = await chrome.tabs.query({ url });
    
    const firstTab = tabs[0];
    if (firstTab?.id) {
      // Content script is available, use it
      const response = await chrome.tabs.sendMessage(firstTab.id, { type: 'GET_PAGE_CONTENT' });
      
      if (response) {
        return {
          url: response.url || url,
          title: response.title || 'Untitled',
          content: response.content || '',
          description: response.metadata?.description,
          author: response.metadata?.author,
          publishedAt: response.metadata?.publishedTime,
          siteName: response.metadata?.siteName,
          favicon: firstTab.favIconUrl,
        };
      }
    }

    // Fallback: Try to fetch the page directly (limited by CORS)
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    return parseHtmlContent(url, html);
  } catch (error) {
    console.error('Failed to fetch and extract content:', error);
    return null;
  }
}

/**
 * Parse HTML content and extract text
 */
function parseHtmlContent(url: string, html: string): ExtractedContent {
  // Create a DOM parser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Extract title
  const title = 
    doc.querySelector('title')?.textContent ||
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    'Untitled';

  // Extract main content
  const content = extractTextContent(doc);

  // Extract metadata
  const getMetaContent = (name: string): string | undefined => {
    const meta = doc.querySelector(
      `meta[name="${name}"], meta[property="${name}"]`
    );
    return meta?.getAttribute('content') || undefined;
  };

  return {
    url,
    title: title.trim(),
    content,
    description: getMetaContent('description') || getMetaContent('og:description'),
    author: getMetaContent('author'),
    publishedAt: getMetaContent('article:published_time'),
    siteName: getMetaContent('og:site_name'),
  };
}

/**
 * Extract main text content from a document
 */
function extractTextContent(doc: Document): string {
  // Remove script and style elements
  const scripts = doc.querySelectorAll('script, style, nav, footer, header, aside');
  scripts.forEach((el) => el.remove());

  // Try to find main content area
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.post-content',
    '.article-content',
    '.entry-content',
    '#content',
    '.content',
  ];

  for (const selector of selectors) {
    const element = doc.querySelector(selector);
    if (element) {
      return cleanText(element.textContent || '');
    }
  }

  // Fallback: get body text
  return cleanText(doc.body?.textContent || '');
}

/**
 * Clean and normalize text content
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')     // Limit consecutive newlines
    .replace(/\t+/g, ' ')           // Replace tabs with spaces
    .trim()
    .slice(0, 50000);               // Limit content length
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return '';
  }
}

/**
 * Get favicon URL for a domain
 */
export function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
  } catch {
    return '';
  }
}

