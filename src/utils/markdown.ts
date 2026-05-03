/**
 * Markdown processing utilities
 *
 * Uses markdown-it to parse Markdown into tokens, then provides
 * helpers for exporters to consume.
 *
 * For LaTeX formulas we use KaTeX to generate MathML (used by the
 * Word exporter) or HTML (used by the HTML exporter).
 */

import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

// markdown-it instance with syntax highlighting via highlight.js
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string) => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } catch {
        // fall through
      }
    }
    // Escape HTML for unknown languages
    return md.utils.escapeHtml(str);
  },
});

export { md };

/**
 * Parse Markdown content and return token array
 */
export function parseMarkdown(content: string): any[] {
  return md.parse(content, {});
}

/**
 * Convert Markdown to plain text (stripped of formatting)
 */
export function markdownToPlainText(content: string): string {
  const html = md.render(content);
  // Strip HTML tags
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/**
 * Truncate message content for preview display.
 * Returns first 80 characters of the rendered text.
 */
export function truncateForPreview(content: string, maxLength = 80): string {
  const plain = markdownToPlainText(content);
  if (plain.length <= maxLength) return plain;
  return plain.substring(0, maxLength) + '...';
}

/**
 * Extract all LaTeX formula strings from content.
 * Returns array of { display: boolean, formula: string } objects.
 * Handles both inline ($...$) and display ($$...$$) math.
 */
export interface LatexFormula {
  display: boolean; // true for display math ($$), false for inline ($)
  formula: string;
}

export function extractLatexFormulas(content: string): LatexFormula[] {
  const formulas: LatexFormula[] = [];
  // Display math $$...$$ and \[...\]
  const displayRegex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]/g;
  let match;
  while ((match = displayRegex.exec(content)) !== null) {
    formulas.push({ display: true, formula: (match[1] || match[2]).trim() });
  }
  // Inline math $...$ (avoid matching $$ already caught) and \(...\)
  const inlineRegex = /(?<!\$)\$([^$\n]+?)\$(?!\$)|\\\(([\s\S]*?)\\\)/g;
  while ((match = inlineRegex.exec(content)) !== null) {
    formulas.push({ display: false, formula: (match[1] || match[2]).trim() });
  }
  return formulas;
}

/**
 * Replace LaTeX formulas in content with placeholders,
 * returning the modified string and extracted formulas.
 */
export function replaceLatexWithPlaceholders(content: string): {
  text: string;
  formulas: LatexFormula[];
  placeholders: string[];
} {
  const formulas: LatexFormula[] = [];
  const placeholders: string[] = [];
  let counter = 0;

  // Replace display math first ($$...$$ and \[...\])
  let text = content.replace(/\$\$([\s\S]*?)\$\$/g, (_m, formula) => {
    formulas.push({ display: true, formula: formula.trim() });
    const ph = `%%LATEX_DISPLAY_${counter}%%`;
    placeholders.push(ph);
    counter++;
    return ph;
  });
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_m, formula) => {
    formulas.push({ display: true, formula: formula.trim() });
    const ph = `%%LATEX_DISPLAY_${counter}%%`;
    placeholders.push(ph);
    counter++;
    return ph;
  });

  // Replace inline math ($...$ and \(...\))
  text = text.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_m, formula) => {
    formulas.push({ display: false, formula: formula.trim() });
    const ph = `%%LATEX_INLINE_${counter}%%`;
    placeholders.push(ph);
    counter++;
    return ph;
  });
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_m, formula) => {
    formulas.push({ display: false, formula: formula.trim() });
    const ph = `%%LATEX_INLINE_${counter}%%`;
    placeholders.push(ph);
    counter++;
    return ph;
  });

  return { text, formulas, placeholders };
}

/**
 * Split content into segments: regular text and LaTeX formulas.
 * Used by exporters that need to handle math expressions specially.
 */
export interface ContentSegment {
  type: 'text' | 'latex';
  content: string;
  display?: boolean;
}

export function segmentContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  // Split by display math patterns first ($$...$$ and \[...\])
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/);
  for (const part of parts) {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      segments.push({
        type: 'latex',
        content: part.slice(2, -2).trim(),
        display: true,
      });
    } else if (part.startsWith('\\[') && part.endsWith('\\]')) {
      segments.push({
        type: 'latex',
        content: part.slice(2, -2).trim(),
        display: true,
      });
    } else {
      // Check for inline math in the text part ($...$ and \(...\))
      const inlineParts = part.split(/(?<!\$)\$([^$\n]+?)\$(?!\$)|\\\(([\s\S]*?)\\\)/);
      if (inlineParts.length > 1) {
        for (let i = 0; i < inlineParts.length; i++) {
          if (i % 2 === 0) {
            if (inlineParts[i]) {
              segments.push({ type: 'text', content: inlineParts[i] });
            }
          } else if (inlineParts[i] !== undefined) {
            segments.push({
              type: 'latex',
              content: inlineParts[i],
              display: false,
            });
          }
        }
      } else if (part) {
        segments.push({ type: 'text', content: part });
      }
    }
  }
  return segments;
}
