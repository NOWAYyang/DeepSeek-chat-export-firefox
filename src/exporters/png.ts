/**
 * PNG screenshot exporter
 *
 * Uses html2canvas to render selected messages as high-quality PNG images.
 * Supports custom background color and image width.
 *
 * For multiple messages, they are rendered as a single scrollable image
 * or separate images (depending on user preference — currently single image).
 */

import type { DeepSeekMessage, ExportOptions } from '../types';
import html2canvas from 'html2canvas';
import { md } from '../utils/markdown';
import { latexToHTML } from '../utils/latex';
import { segmentContent } from '../utils/markdown';

export async function exportPNG(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
  onProgress?: (current: number, total: number) => void,
): Promise<{ data: Blob; filename: string; mimeType: string }> {
  const bgColor = options.darkMode ? '#1e1e1e' : '#ffffff';
  const textColor = options.darkMode ? '#e0e0e0' : '#1e293b';

  // Build HTML content
  const html = buildPNGContent(messages, bgColor, textColor);

  // Create offscreen container
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute; left: -9999px; top: 0;
    width: 800px;
    padding: 20px;
    background: ${bgColor};
    color: ${textColor};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    font-size: 14px;
  `;
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    if (onProgress) onProgress(1, 1);

    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: bgColor,
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({
            data: blob,
            filename: `${sanitizeFilename(conversationTitle)}.png`,
            mimeType: 'image/png',
          });
        } else {
          throw new Error('Failed to generate PNG blob');
        }
      }, 'image/png');
    });
  } finally {
    document.body.removeChild(container);
  }
}

function buildPNGContent(
  messages: DeepSeekMessage[],
  bgColor: string,
  textColor: string,
): string {
  const parts: string[] = [];

  for (const msg of messages) {
    const roleColor = msg.role === 'user' ? '#4f46e5' : '#10b981';
    const roleBg = msg.role === 'user' ? '#eef2ff' : '#d1fae5';
    const roleLabel = msg.role === 'user' ? 'User' : 'DeepSeek';

    parts.push(`
      <div style="margin:16px 0;padding:16px;border-left:4px solid ${roleColor};border-radius:8px;background:${bgColor};border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:${roleBg};color:${roleColor};">${roleLabel}</span>
          ${msg.conversationTitle ? `<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:#f1f5f9;color:#64748b;">${escapeHtml(msg.conversationTitle)}</span>` : ''}
        </div>
        <div style="font-size:14px;line-height:1.6;color:${textColor};">
          ${renderPNGContent(msg.content)}
        </div>
      </div>
    `);
  }

  // Add KaTeX CSS for formula rendering
  return `
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
    <style>
      pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; }
      code { font-family: 'Fira Code', Consolas, monospace; }
      p > code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
      th { background: #f8fafc; font-weight: 600; }
      img { max-width: 100%; }
      blockquote { border-left: 3px solid #4f46e5; padding-left: 12px; margin: 8px 0; color: #64748b; }
    </style>
    ${parts.join('\n')}
  `;
}

function renderPNGContent(content: string): string {
  const segments = segmentContent(content);
  const htmlParts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'latex') {
      htmlParts.push(latexToHTML(seg.formula, seg.display || false));
    } else {
      htmlParts.push(md.render(seg.content));
    }
  }

  return htmlParts.join('\n');
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').substring(0, 200) || 'export';
}
