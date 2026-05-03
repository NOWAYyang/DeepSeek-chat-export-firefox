/**
 * LaTeX processing utilities
 *
 * Uses KaTeX to convert LaTeX formulas to MathML (for Word export)
 * and HTML (for HTML/PNG export).
 */

import katex from 'katex';

/**
 * Convert a LaTeX formula to MathML string.
 * Used by the Word exporter to embed math as OMML-compatible MathML.
 *
 * @param formula - The LaTeX formula without delimiters
 * @param display - Whether this is display math ($$...$$) or inline ($...$)
 */
export function latexToMathML(formula: string, display: boolean): string {
  try {
    return katex.renderToString(formula, {
      output: 'mathml',
      throwOnError: false,
      displayMode: display,
      errorColor: '#cc0000',
    });
  } catch (err) {
    console.warn('KaTeX MathML conversion failed for:', formula, err);
    return `<math><mtext>${escapeXml(formula)}</mtext></math>`;
  }
}

/**
 * Convert a LaTeX formula to HTML string.
 * Used by the HTML exporter.
 */
export function latexToHTML(formula: string, display: boolean): string {
  try {
    return katex.renderToString(formula, {
      throwOnError: false,
      displayMode: display,
      errorColor: '#cc0000',
    });
  } catch (err) {
    console.warn('KaTeX HTML conversion failed for:', formula, err);
    return `<span class="katex-error" style="color:#cc0000">${escapeXml(formula)}</span>`;
  }
}

/**
 * Extract MathML tags from a KaTeX MathML string.
 * Returns only the <math>...</math> content.
 */
export function extractMathML(mathmlStr: string): string {
  const match = mathmlStr.match(/<math[\s\S]*?<\/math>/);
  return match ? match[0] : '';
}

/**
 * Simple XML escape
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
