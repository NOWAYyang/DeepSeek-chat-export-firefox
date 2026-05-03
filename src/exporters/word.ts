/**
 * Word (docx) exporter
 *
 * Converts Markdown messages into a .docx file using the `docx` npm package.
 *
 * Key features:
 *  - Markdown→docx conversion via custom token processor
 *  - LaTeX formulas rendered as images (KaTeX → canvas → ImageRun)
 *  - Code blocks with syntax-highlighted runs (colored Run elements)
 *  - Tables, lists, headings, bold/italic preserved
 */

import type { DeepSeekMessage, ExportOptions } from '../types';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  AlignmentType,
  WidthType,
  ShadingType,
  ExternalHyperlink,
  ImageRun,
} from 'docx';
import { md, segmentContent } from '../utils/markdown';
import hljs from 'highlight.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import html2canvas from 'html2canvas';

/**
 * Map highlight.js token types to docx Run formatting.
 */
const SYNTAX_COLORS: Record<string, string> = {
  keyword: '#d73a49',
  string: '#032f62',
  number: '#005cc5',
  comment: '#6a737d',
  built_in: '#6f42c1',
  literal: '#005cc5',
  type: '#6f42c1',
  attr: '#22863a',
  attribute: '#22863a',
  title: '#6f42c1',
  'title.function': '#6f42c1',
  'title.class': '#6f42c1',
  params: '#24292e',
  property: '#005cc5',
  punctuation: '#24292e',
  tag: '#22863a',
  'selector-tag': '#22863a',
  'selector-id': '#005cc5',
  'selector-class': '#6f42c1',
  'selector-attr': '#032f62',
  'selector-pseudo': '#032f62',
  meta: '#6a737d',
  'meta-keyword': '#d73a49',
  'meta-string': '#032f62',
  section: '#6f42c1',
  symbol: '#005cc5',
  deletion: '#b31d28',
  addition: '#22863a',
};

export async function exportWord(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
  onProgress?: (current: number, total: number) => void,
): Promise<{ data: Blob; filename: string; mimeType: string }> {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      text: conversationTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  // Metadata
  if (options.includeMetadata) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Exported: ${new Date().toLocaleString()}`,
            size: 20,
            color: '888888',
          }),
        ],
        spacing: { after: 100 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Messages: ${messages.length}`,
            size: 20,
            color: '888888',
          }),
        ],
        spacing: { after: 400 },
      }),
    );
  }

  // Process each message
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    // Role header
    const roleLabel = msg.role === 'user' ? 'User' : 'DeepSeek';
    const roleColor = msg.role === 'user' ? '4F46E5' : '10B981';

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: roleLabel,
            bold: true,
            size: 22,
            color: roleColor,
            font: { name: 'Segoe UI' },
          }),
          ...(msg.conversationTitle && messages.length > 1
            ? [
                new TextRun({
                  text: `  |  ${msg.conversationTitle}`,
                  size: 18,
                  color: '888888',
                  font: { name: 'Segoe UI' },
                }),
              ]
            : []),
        ],
        spacing: { before: i > 0 ? 400 : 200, after: 100 },
        border: msg.role === 'user' ? { left: { style: BorderStyle.SINGLE, size: 6, color: roleColor } } : undefined,
        indent: { left: msg.role === 'user' ? 80 : 0 },
      }),
    );

    // Convert message content to docx elements
    const contentElements = await convertMarkdownToDocx(msg.content, options);
    for (const el of contentElements) {
      children.push(el);
    }

    if (onProgress) {
      onProgress(i + 1, messages.length);
    }
  }

  // Build document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: options.pageOrientation === 'landscape' ? 15840 : 12240, // TWIP
              height: options.pageOrientation === 'landscape' ? 12240 : 15840,
            },
            margin: {
              top: options.margin * 56.7, // mm to TWIP (1mm ≈ 56.7 TWIP)
              bottom: options.margin * 56.7,
              left: options.margin * 56.7,
              right: options.margin * 56.7,
            },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: { font: 'Segoe UI', size: 22, color: '1E293B' },
          paragraph: { spacing: { after: 100 } },
        },
      },
    },
  });

  // Pack to blob
  const blob = await Packer.toBlob(doc);
  return { data: blob, filename: `${sanitizeFilename(conversationTitle)}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}

/**
 * Convert Markdown content to an array of docx Paragraphs/Tables.
 */
async function convertMarkdownToDocx(
  content: string,
  options: ExportOptions,
): Promise<(Paragraph | Table)[]> {
  const segments = segmentContent(content);
  const elements: (Paragraph | Table)[] = [];

  for (const seg of segments) {
    if (seg.type === 'latex') {
      elements.push(await createMathParagraph(seg.content, seg.display || false));
      continue;
    }

    // Parse text segments as Markdown
    const tokens = md.parse(seg.content, {});
    // Link tokens into a linked list for findNextInline navigation
    for (let i = 0; i < tokens.length - 1; i++) {
      tokens[i].next = tokens[i + 1];
    }
    for (const token of tokens) {
      const converted = await convertToken(token, options);
      for (const el of converted) {
        elements.push(el);
      }
    }
  }

  return elements;
}

/**
 * Convert a markdown-it token to docx elements.
 */
async function convertToken(
  token: any,
  options: ExportOptions,
): Promise<(Paragraph | Table)[]> {
  switch (token.type) {
    case 'heading_open': {
      const level = parseInt(token.tag.slice(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
      const headingMap: Record<number, HeadingLevel> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      // Collect inline content from next token
      const inlineToken = findNextInline(token);
      return [
        new Paragraph({
          heading: headingMap[level],
          children: convertInline(inlineToken),
          spacing: { before: 300, after: 100 },
        }),
      ];
    }

    case 'paragraph_open': {
      const inlineToken = findNextInline(token);
      return [
        new Paragraph({
          children: convertInline(inlineToken),
          spacing: { after: 120 },
        }),
      ];
    }

    case 'code_block':
    case 'fence': {
      const codeContent = token.content || '';
      const lang = token.info || '';
      return [createCodeBlock(codeContent, lang)];
    }

    case 'blockquote_open': {
      const inlineToken = findNextInline(token);
      return [
        new Paragraph({
          children: convertInline(inlineToken),
          indent: { left: 400 },
          spacing: { after: 100 },
          shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
        }),
      ];
    }

    case 'hr':
      return [
        new Paragraph({
          thematicBreak: true,
          spacing: { before: 200, after: 200 },
        }),
      ];

    case 'ordered_list_item_open':
    case 'bullet_list_item_open': {
      const inlineToken = findNextInline(token);
      const isOrdered = token.type === 'ordered_list_item_open';
      return [
        new Paragraph({
          children: [
            new TextRun({
              text: isOrdered ? '1.\t' : '•\t',
              size: 22,
            }),
            ...convertInline(inlineToken),
          ],
          indent: { left: 400, hanging: 200 },
          spacing: { after: 60 },
        }),
      ];
    }

    case 'table_open': {
      return [convertTable(token)];
    }

    default:
      // Skip container tokens that are handled by their open/close pairs
      if (token.type.endsWith('_close') || token.type.endsWith('_open')) {
        return [];
      }
      return [];
  }
}

/**
 * Convert inline tokens to TextRun elements.
 */
function convertInline(token: any): (TextRun | ExternalHyperlink)[] {
  if (!token) return [new TextRun({ text: '' })];
  if (token.type === 'inline') {
    return convertInlineChildren(token.children || []);
  }
  return [new TextRun({ text: token.content || '' })];
}

function convertInlineChildren(children: any[]): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];
  for (const child of children) {
    if (child.type === 'text') {
      runs.push(new TextRun({ text: child.content, size: 22 }));
    } else if (child.type === 'strong') {
      for (const c of child.children || []) {
        if (c.type === 'text') {
          runs.push(new TextRun({ text: c.content, bold: true, size: 22 }));
        } else if (c.type === 'code') {
          runs.push(new TextRun({ text: c.content, bold: true, size: 20, font: { name: 'Consolas' }, color: 'D73A49' }));
        }
      }
    } else if (child.type === 'em') {
      for (const c of child.children || []) {
        if (c.type === 'text') {
          runs.push(new TextRun({ text: c.content, italics: true, size: 22 }));
        }
      }
    } else if (child.type === 'code') {
      runs.push(new TextRun({ text: child.content, size: 20, font: { name: 'Consolas' }, color: 'D73A49', shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' } }));
    } else if (child.type === 'link_open') {
      const href = child.attrs?.find((a: any) => a[0] === 'href')?.[1] || '';
      const textChild = children.find((c: any) => c.type === 'text' || c.type === 'inline');
      if (href && textChild) {
        runs.push(new ExternalHyperlink({
          children: [new TextRun({ text: textChild.content || href, style: 'Hyperlink', size: 22 })],
          link: href,
        }));
      }
    } else if (child.type === 'link') {
      // Process inline token children
      for (const c of child.children || []) {
        if (c.type === 'text') {
          const href = child.attrs?.find((a: any) => a[0] === 'href')?.[1] || '';
          if (href) {
            runs.push(new ExternalHyperlink({
              children: [new TextRun({ text: c.content, style: 'Hyperlink', size: 22 })],
              link: href,
            }));
          } else {
            runs.push(new TextRun({ text: c.content, size: 22 }));
          }
        }
      }
    } else if (child.type === 'softbreak') {
      runs.push(new TextRun({ text: ' ', size: 22 }));
    } else if (child.type === 'hardbreak') {
      runs.push(new TextRun({ break: 1, text: '', size: 22 }));
    } else if (child.type === 's') {
      for (const c of child.children || []) {
        if (c.type === 'text') {
          runs.push(new TextRun({ text: c.content, strike: true, size: 22 }));
        }
      }
    } else if (child.type === 'text') {
      // Handle text content from other contexts
      runs.push(new TextRun({ text: child.content || '', size: 22 }));
    }
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text: '' }));
  }
  return runs;
}

/**
 * Create a syntax-highlighted code block.
 */
function createCodeBlock(content: string, lang: string): Paragraph {
  const runs: TextRun[] = [];

  if (lang && hljs.getLanguage(lang)) {
    try {
      const result = hljs.highlight(content, { language: lang, ignoreIllegals: true });
      for (const token of result._emitter.rootNode.children || []) {
        if (typeof token === 'string') {
          pushCodeRun(runs, token, 'default');
        } else if (token.children) {
          flattenHighlightTokens(token, runs);
        }
      }
    } catch {
      // Fallback: plain text
    }
  }

  if (runs.length === 0) {
    pushCodeRun(runs, content, 'default');
  }

  // Add line numbers as prefix for code blocks
  return new Paragraph({
    children: runs.map(r => r),
    spacing: { before: 100, after: 100 },
    indent: { left: 200 },
    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' },
  });
}

function flattenHighlightTokens(node: any, runs: TextRun[]) {
  if (typeof node === 'string') {
    pushCodeRun(runs, node, 'default');
    return;
  }
  if (node.children) {
    const color = SYNTAX_COLORS[node.scope] || SYNTAX_COLORS[node.type] || '1E293B';
    for (const child of node.children) {
      if (typeof child === 'string') {
        pushCodeRun(runs, child, color);
      } else {
        flattenHighlightTokens(child, runs);
      }
    }
  }
}

function createCodeRun(text: string, color: string): TextRun {
  const hexColor = color.startsWith('#') ? color.substring(1) : color;
  return new TextRun({
    text,
    size: 18,
    font: { name: 'Consolas' },
    color: hexColor,
  });
}

/** Push a code TextRun, splitting on \n and inserting Word line breaks. */
function pushCodeRun(runs: TextRun[], text: string, color: string): void {
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      runs.push(new TextRun({ text: '', break: 1, size: 18, font: { name: 'Consolas' }, color: '1E293B' }));
    }
    if (parts[i]) {
      runs.push(createCodeRun(parts[i], color));
    }
  }
}

/**
 * Render a LaTeX formula as a PNG image and embed it in a Word paragraph.
 * Uses KaTeX for rendering and html2canvas for capture.
 */
async function createMathParagraph(latexFormula: string, display: boolean): Promise<Paragraph> {
  const dataUrl = await latexToDataUrl(latexFormula, display);
  if (dataUrl) {
    const imgBuf = dataUrlToBuffer(dataUrl);
    const img = await loadImage(dataUrl);
    // img dimensions are 2x CSS size (canvas scale=2). Halve for display px.
    return new Paragraph({
      children: [
        new ImageRun({
          data: imgBuf,
          transformation: {
            width: Math.round(img.width / 2),
            height: Math.round(img.height / 2),
          },
          type: 'png',
        }),
      ],
      alignment: display ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 100, after: 100 },
    });
  }

  // Fallback: show LaTeX source
  return new Paragraph({
    children: [
      new TextRun({
        text: latexFormula,
        size: 20,
        font: { name: 'Consolas' },
        color: '6A737D',
        italics: true,
      }),
    ],
    alignment: display ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 100, after: 100 },
    shading: { type: ShadingType.CLEAR, fill: 'F8FAFC', color: 'auto' },
  });
}

/** Convert a data URL to a Uint8Array. */
function dataUrlToBuffer(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Load an image from a data URL and return its natural dimensions. */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Render LaTeX formula to a PNG data URL via KaTeX + html2canvas. */
async function latexToDataUrl(latex: string, display: boolean): Promise<string | null> {
  try {
    const container = document.createElement('div');
    container.style.cssText =
      'position:absolute;left:-9999px;top:0;padding:4px 8px;background:#fff;display:inline-block;';

    // Render with KaTeX
    container.innerHTML = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: display,
      output: 'html',
    });
    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      return canvas.toDataURL('image/png');
    } finally {
      container.remove();
    }
  } catch {
    return null;
  }
}

/**
 * Convert a markdown-it table token to a docx Table.
 */
function convertTable(token: any): Table {
  const rows: TableRow[] = [];
  // Find thead and tbody tokens
  let currentRow: any[] = [];

  function findTableRows(t: any): any[] {
    const rows: any[] = [];
    if (t.type === 'tr_open') {
      const rowCells: string[] = [];
      let sibling = t.next;
      while (sibling && sibling.type !== 'tr_close') {
        if (sibling.type === 'th_open' || sibling.type === 'td_open') {
          const cellContent = findNextInline(sibling);
          rowCells.push(cellContent?.content || '');
        }
        sibling = sibling.next;
      }
      if (rowCells.length > 0) rows.push(rowCells);
    }
    if (t.children) {
      for (const child of t.children) {
        rows.push(...findTableRows(child));
      }
    }
    if (t.next) {
      rows.push(...findTableRows(t.next));
    }
    return rows;
  }

  // Walk the token list beginning from this table token
  const tableRows: string[][] = [];
  let walker = token.next;
  while (walker && walker.type !== 'table_close') {
    if (walker.type === 'tr_open') {
      const cells: string[] = [];
      let sibling = walker.next;
      while (sibling && sibling.type !== 'tr_close') {
        if (sibling.type === 'th_open' || sibling.type === 'td_open') {
          const inlineToken = findNextInline(sibling);
          cells.push(inlineToken?.content || '');
        }
        sibling = sibling.next;
      }
      if (cells.length > 0) tableRows.push(cells);
    }
    walker = walker.next;
  }

  if (tableRows.length === 0) {
    return new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: '' })] })] })] })] });
  }

  for (let i = 0; i < tableRows.length; i++) {
    const isHeader = i === 0;
    const cells = tableRows[i].map((cellContent) => {
      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cellContent,
                bold: isHeader,
                size: 20,
              }),
            ],
          }),
        ],
        shading: isHeader
          ? { type: ShadingType.CLEAR, fill: 'F1F5F9', color: 'auto' }
          : undefined,
      });
    });
    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Find the next inline token's content from a given starting token.
 */
function findNextInline(token: any): any {
  let t = token;
  while (t) {
    if (t.type === 'inline') return t;
    if (t.children) {
      for (const child of t.children) {
        if (child.type === 'inline') return child;
      }
    }
    t = t.next;
  }
  return null;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').substring(0, 200) || 'export';
}
