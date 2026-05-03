/**
 * PDF exporter
 *
 * Uses jsPDF + html2canvas to generate PDFs.
 * The approach: render the conversation as HTML in an offscreen element,
 * capture it as canvas with html2canvas, then add each page to jsPDF.
 *
 * Supports:
 *  - Page size: A4 / Letter
 *  - Orientation: portrait / landscape
 *  - Custom margins
 *  - Code highlighting (via HTML renderer)
 *  - LaTeX rendering (via KaTeX in HTML)
 *  - Long conversation pagination (chunked rendering)
 */

import type { DeepSeekMessage, ExportOptions } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { md } from '../utils/markdown';
import { latexToHTML } from '../utils/latex';
import { segmentContent } from '../utils/markdown';

// Page dimensions in mm
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 215.9, height: 279.4 },
};

export async function exportPDF(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
  onProgress?: (current: number, total: number) => void,
): Promise<{ data: Blob; filename: string; mimeType: string }> {
  const pageSize = PAGE_SIZES[options.pageSize] || PAGE_SIZES.A4;
  const isLandscape = options.pageOrientation === 'landscape';
  const pageWidth = isLandscape ? pageSize.height : pageSize.width;
  const pageHeight = isLandscape ? pageSize.width : pageSize.height;
  const margin = options.margin;

  const contentWidth = pageWidth - 2 * margin;
  const contentHeight = pageHeight - 2 * margin;

  // Build HTML content for the conversation
  const htmlContent = buildHTMLContent(messages, options, conversationTitle);

  // Create offscreen container
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute; left: -9999px; top: 0;
    width: ${contentWidth}mm;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: white;
    color: #1e293b;
    line-height: 1.5;
    font-size: 12pt;
  `;
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    // Render to canvas for each page
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: options.pageSize,
    });

    // Calculate total height and render page by page
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: contentWidth * 3.78, // mm to px at 96dpi
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;
    let page = 0;

    // First page
    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      pdf.addPage();
      page++;
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;

      if (onProgress) {
        onProgress(page, Math.ceil(imgHeight / contentHeight));
      }
    }

    const blob = pdf.output('blob');
    return {
      data: blob,
      filename: `${sanitizeFilename(conversationTitle)}.pdf`,
      mimeType: 'application/pdf',
    };
  } finally {
    document.body.removeChild(container);
  }
}

function buildHTMLContent(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  title: string,
): string {
  const parts: string[] = [];

  // Title
  parts.push(`
    <div style="text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
      <h1 style="font-size:18pt;margin:0;color:#1e293b;">${escapeHtml(title)}</h1>
      ${options.includeMetadata ? `<p style="font-size:10pt;color:#94a3b8;margin:4px 0 0;">Exported: ${new Date().toLocaleString()} | Messages: ${messages.length}</p>` : ''}
    </div>
  `);

  // Messages
  for (const msg of messages) {
    const roleColor = msg.role === 'user' ? '#4f46e5' : '#10b981';
    const roleBg = msg.role === 'user' ? '#eef2ff' : '#d1fae5';
    const roleLabel = msg.role === 'user' ? 'User' : 'DeepSeek';

    parts.push(`
      <div style="margin:12px 0;padding:12px;border-left:3px solid ${roleColor};border-radius:4px;background:#ffffff;border:1px solid #e2e8f0;page-break-inside:avoid;">
        <div style="margin-bottom:8px;">
          <span style="font-size:10pt;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:3px;background:${roleBg};color:${roleColor};">${roleLabel}</span>
        </div>
        <div style="font-size:11pt;line-height:1.6;">
          ${renderHTMLContent(msg.content)}
        </div>
      </div>
    `);
  }

  return parts.join('\n');
}

function renderHTMLContent(content: string): string {
  const segments = segmentContent(content);
  const htmlParts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'latex') {
      try {
        htmlParts.push(latexToHTML(seg.formula, seg.display || false));
      } catch {
        htmlParts.push(`<span style="color:#cc0000;">${escapeHtml(seg.formula)}</span>`);
      }
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
