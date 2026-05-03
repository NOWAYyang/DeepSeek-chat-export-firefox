/**
 * Unit tests for core utility functions
 *
 * Tests the markdown processing, LaTeX conversion, and
 * text-based exporters (JSON, Markdown).
 *
 * Run with: npx vitest run
 */

import { describe, it, expect } from 'vitest';
import {
  truncateForPreview,
  extractLatexFormulas,
  replaceLatexWithPlaceholders,
  segmentContent,
} from '../utils/markdown';
import { latexToMathML, extractMathML } from '../utils/latex';
import { exportJSON } from '../exporters/json';
import { exportMarkdown } from '../exporters/markdown';
import type { DeepSeekMessage, ExportOptions } from '../types';

/* ===== Markdown Utilities ===== */

describe('truncateForPreview', () => {
  it('should return short text as-is', () => {
    const result = truncateForPreview('Hello world');
    expect(result.replace(/\n$/, '')).toBe('Hello world');
  });

  it('should truncate long text to 80 characters', () => {
    const longText = 'a'.repeat(200);
    const result = truncateForPreview(longText, 80);
    expect(result.length).toBe(83); // 80 chars + '...'
    expect(result.endsWith('...')).toBe(true);
  });

  it('should strip HTML tags before truncation', () => {
    const text = '<h1>Hello</h1><p>World</p>';
    const result = truncateForPreview(text);
    expect(result).not.toContain('<h1>');
    expect(result).toContain('Hello');
  });
});

describe('extractLatexFormulas', () => {
  it('should extract inline math formulas', () => {
    const content = 'The formula $E = mc^2$ is famous.';
    const formulas = extractLatexFormulas(content);
    expect(formulas).toHaveLength(1);
    expect(formulas[0].display).toBe(false);
    expect(formulas[0].formula).toBe('E = mc^2');
  });

  it('should extract display math formulas', () => {
    const content = 'Consider: $$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$';
    const formulas = extractLatexFormulas(content);
    expect(formulas).toHaveLength(1);
    expect(formulas[0].display).toBe(true);
    expect(formulas[0].formula).toContain('int');
  });

  it('should extract both inline and display formulas', () => {
    const content = 'Inline $x$ and display $$y$$.';
    const formulas = extractLatexFormulas(content);
    expect(formulas).toHaveLength(2);
    // Display formulas are extracted first (displayRegex runs before inlineRegex)
    expect(formulas[0].display).toBe(true);
    expect(formulas[1].display).toBe(false);
  });

  it('should return empty array when no formulas', () => {
    const content = 'Just some plain text without math.';
    const formulas = extractLatexFormulas(content);
    expect(formulas).toHaveLength(0);
  });
});

describe('replaceLatexWithPlaceholders', () => {
  it('should replace formulas with placeholders', () => {
    const content = 'Formula $a^2 + b^2 = c^2$ is important.';
    const { text, formulas, placeholders } = replaceLatexWithPlaceholders(content);
    expect(formulas).toHaveLength(1);
    expect(placeholders).toHaveLength(1);
    expect(text).toContain(placeholders[0]);
    expect(text).not.toContain('$');
  });
});

describe('segmentContent', () => {
  it('should return text-only segment for plain content', () => {
    const segments = segmentContent('Hello world');
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe('text');
  });

  it('should separate LaTeX from text', () => {
    const segments = segmentContent('Text $$math$$ more text');
    expect(segments.length).toBeGreaterThanOrEqual(2);
    const latexSeg = segments.find(s => s.type === 'latex');
    expect(latexSeg).toBeDefined();
    expect(latexSeg?.content).toBe('math');
  });
});

/* ===== LaTeX Utilities ===== */

describe('latexToMathML', () => {
  it('should convert a simple formula to MathML', () => {
    const result = latexToMathML('E = mc^2', false);
    expect(result).toContain('<math');
    expect(result).toContain('</math>');
  });

  it('should handle display math', () => {
    const result = latexToMathML('\\sum_{i=1}^{n} i', true);
    expect(result).toContain('<math');
  });

  it('should handle errors gracefully', () => {
    const result = latexToMathML('\\invalid{}', false);
    expect(result).toBeDefined();
    // Should return error markup or fallback
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('extractMathML', () => {
  it('should extract math tag from KaTeX output', () => {
    const katexOutput = '<span class="katex"><math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi></math></span>';
    const result = extractMathML(katexOutput);
    expect(result).toContain('<math');
    expect(result).toContain('</math>');
    expect(result).toContain('xmlns');
  });

  it('should return empty string when no math tag', () => {
    const result = extractMathML('<span>no math here</span>');
    expect(result).toBe('');
  });
});

/* ===== Exporters ===== */

const sampleMessages: DeepSeekMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'What is the quadratic formula?',
  },
  {
    id: '2',
    role: 'assistant',
    content: 'The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$.',
  },
];

const defaultOptions: ExportOptions = {
  pageSize: 'A4',
  pageOrientation: 'portrait',
  margin: 20,
  includeMetadata: true,
  highlightTheme: 'github',
  darkMode: false,
  preserveDeepSeekStyle: true,
};

describe('exportJSON', () => {
  it('should produce valid JSON', () => {
    const result = exportJSON(sampleMessages, defaultOptions, 'Test Chat');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('should include all messages in the output', () => {
    const result = JSON.parse(exportJSON(sampleMessages, defaultOptions, 'Test Chat'));
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[1].role).toBe('assistant');
  });

  it('should include export metadata', () => {
    const result = JSON.parse(exportJSON(sampleMessages, defaultOptions, 'Test Chat'));
    expect(result.exportDate).toBeDefined();
    expect(result.title).toBe('Test Chat');
    expect(result.messageCount).toBe(2);
  });
});

describe('exportMarkdown', () => {
  it('should produce markdown output with messages', () => {
    const result = exportMarkdown(sampleMessages, defaultOptions, 'Test Chat');
    expect(result).toContain('User');
    expect(result).toContain('DeepSeek');
    expect(result).toContain('quadratic formula');
  });

  it('should include YAML frontmatter when includeMetadata is true', () => {
    const result = exportMarkdown(sampleMessages, defaultOptions, 'Test Chat');
    expect(result.startsWith('---')).toBe(true);
    expect(result).toContain('title:');
  });

  it('should omit frontmatter when includeMetadata is false', () => {
    const result = exportMarkdown(sampleMessages, { ...defaultOptions, includeMetadata: false }, 'Test Chat');
    expect(result.startsWith('---')).toBe(false);
  });

  it('should preserve LaTeX formulas', () => {
    const result = exportMarkdown(sampleMessages, defaultOptions, 'Test Chat');
    expect(result).toContain('$x = \\frac');
  });
});
