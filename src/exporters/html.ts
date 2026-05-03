import type { DeepSeekMessage, ExportOptions, HighlightTheme } from '../types';
import { md } from '../utils/markdown';
import { latexToHTML } from '../utils/latex';
import { segmentContent } from '../utils/markdown';

/**
 * HTML exporter
 *
 * Generates a standalone, offline-viewable HTML file containing:
 * - Embedded CSS with dark/light theme support
 * - KaTeX for LaTeX formula rendering (loaded from CDN, cached)
 * - highlight.js for code syntax highlighting
 * - DeepSeek-original or custom styling
 */

// Map our theme names to highlight.js CSS filenames
const HIGHLIGHT_CSS: Record<HighlightTheme, string> = {
  github: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css',
  monokai: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/monokai-sublime.min.css',
  vs2015: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/vs2015.min.css',
  'atom-dark': 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css',
  default: 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/default.min.css',
};

const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
const HIGHLIGHT_JS = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js';

export async function exportHTML(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
): Promise<string> {
  const theme = options.darkMode ? 'dark' : 'light';
  const hlCss = HIGHLIGHT_CSS[options.highlightTheme] || HIGHLIGHT_CSS.github;

  const bodyParts: string[] = [];

  // Metadata header
  if (options.includeMetadata) {
    bodyParts.push(`
      <div class="metadata">
        <h1>${escapeHtml(conversationTitle)}</h1>
        <p class="meta-info">Exported: ${new Date().toLocaleString()} | Messages: ${messages.length}</p>
      </div>
    `);
  }

  // Messages
  messages.forEach((msg, idx) => {
    const roleClass = msg.role === 'user' ? 'user' : 'assistant';
    const roleLabel = msg.role === 'user' ? 'User' : 'DeepSeek';

    bodyParts.push(`
      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="role-badge ${roleClass}">${roleLabel}</span>
          ${msg.conversationTitle ? `<span class="conv-badge">${escapeHtml(msg.conversationTitle)}</span>` : ''}
        </div>
        <div class="message-body">
          ${renderContent(msg.content)}
        </div>
      </div>
    `);

    if (idx < messages.length - 1) {
      bodyParts.push('<hr class="message-separator" />');
    }
  });

  const css = getStyles(theme, options.preserveDeepSeekStyle);

  return `<!DOCTYPE html>
<html lang="en" class="theme-${theme}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(conversationTitle)} - DeepSeek Export</title>
  <link rel="stylesheet" href="${KATEX_CSS}" />
  <link rel="stylesheet" href="${hlCss}" />
  <style>${css}</style>
</head>
<body>
  <div class="container">
    ${bodyParts.join('\n')}
  </div>
  <script src="${KATEX_JS}"><\/script>
  <script src="${HIGHLIGHT_JS}"><\/script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Render LaTeX with KaTeX
      document.querySelectorAll('.math-display, .math-inline').forEach(function(el) {
        try {
          katex.render(el.textContent, el, {
            displayMode: el.classList.contains('math-display'),
            throwOnError: false
          });
        } catch(e) { el.style.color = '#cc0000'; }
      });
      // Highlight code blocks
      document.querySelectorAll('pre code').forEach(function(block) {
        hljs.highlightElement(block);
      });
    });
  <\/script>
</body>
</html>`;
}

function renderContent(content: string): string {
  // Split content into segments (text and LaTeX)
  const segments = segmentContent(content);

  if (segments.length === 1 && segments[0].type === 'text') {
    // No LaTeX found — render normally as Markdown
    return md.render(content);
  }

  // Build HTML with KaTeX placeholders
  const htmlParts: string[] = [];
  for (const seg of segments) {
    if (seg.type === 'text') {
      htmlParts.push(md.render(seg.content));
    } else {
      const cls = seg.display ? 'math-display' : 'math-inline';
      htmlParts.push(`<span class="${cls}">${escapeHtml(seg.content)}</span>`);
    }
  }
  return htmlParts.join('\n');
}

function getStyles(theme: string, preserveDeepSeek: boolean): string {
  const isDark = theme === 'dark';

  const baseStyles = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: ${isDark ? '#212121' : '#f8fafc'};
      color: ${isDark ? '#e0e0e0' : '#1e293b'};
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .metadata { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${isDark ? '#424242' : '#e2e8f0'}; }
    .metadata h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .meta-info { font-size: 13px; color: ${isDark ? '#9e9e9e' : '#94a3b8'}; }
    .message { margin: 16px 0; padding: 16px; border-radius: 8px; background: ${isDark ? '#2d2d2d' : '#ffffff'}; border: 1px solid ${isDark ? '#424242' : '#e2e8f0'}; }
    .message.user { border-left: 4px solid #4f46e5; }
    .message.assistant { border-left: 4px solid #10b981; }
    .message-header { margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .role-badge { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 4px; }
    .role-badge.user { background: ${isDark ? '#312e81' : '#eef2ff'}; color: #4f46e5; }
    .role-badge.assistant { background: ${isDark ? '#064e3b' : '#d1fae5'}; color: #10b981; }
    .conv-badge { font-size: 11px; padding: 1px 6px; border-radius: 10px; background: ${isDark ? '#374151' : '#f1f5f9'}; color: ${isDark ? '#9ca3af' : '#64748b'}; }
    .message-body { font-size: 14px; }
    .message-body p { margin: 8px 0; }
    .message-body pre { background: ${isDark ? '#1a1a1a' : '#f1f5f9'}; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
    .message-body code { font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace; font-size: 13px; }
    .message-body p > code, .message-body li > code { background: ${isDark ? '#374151' : '#f1f5f9'}; padding: 1px 4px; border-radius: 3px; }
    .message-body blockquote { border-left: 3px solid ${isDark ? '#6366f1' : '#4f46e5'}; padding-left: 12px; margin: 8px 0; color: ${isDark ? '#9ca3af' : '#64748b'}; }
    .message-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    .message-body th, .message-body td { border: 1px solid ${isDark ? '#424242' : '#e2e8f0'}; padding: 6px 10px; text-align: left; }
    .message-body th { background: ${isDark ? '#333' : '#f8fafc'}; font-weight: 600; }
    .message-body img { max-width: 100%; border-radius: 4px; }
    .message-separator { border: none; border-top: 1px solid ${isDark ? '#424242' : '#e2e8f0'}; margin: 8px 0; }
    .math-display { display: block; text-align: center; margin: 12px 0; overflow-x: auto; }
    .math-inline { display: inline; }
  `;

  if (preserveDeepSeek) {
    return baseStyles;
  }

  return baseStyles;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
