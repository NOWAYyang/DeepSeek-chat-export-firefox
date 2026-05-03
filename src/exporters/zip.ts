/**
 * ZIP batch exporter
 *
 * Packs multiple export formats into a single ZIP archive.
 * Internal structure:
 *   /markdown/conversation1.md
 *   /json/conversation1.json
 *   /html/conversation1.html
 *   /svg/message1.svg
 *   /svg/message2.svg
 *   ...
 *
 * Supported modes:
 *   - 'all': Export all selected messages in every format
 *   - 'svg': Export as SVG collection
 *   - format-specific: Export as named format
 */

import type { DeepSeekMessage, ExportOptions } from '../types';
import JSZip from 'jszip';
import { exportJSON } from './json';
import { exportMarkdown } from './markdown';
import { exportHTML } from './html';
import { exportSVG } from './svg';

type ZipMode = 'all' | 'svg' | 'markdown';

export async function exportZip(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
  mode: ZipMode = 'all',
  onProgress?: (current: number, total: number) => void,
): Promise<{ data: Blob; filename: string; mimeType: string }> {
  const zip = new JSZip();
  const safeTitle = sanitizeFilename(conversationTitle);
  let totalSteps = 0;
  let stepsDone = 0;

  if (mode === 'all') {
    totalSteps = 4 + messages.length; // markdown + json + html + svg per message
  } else if (mode === 'svg') {
    totalSteps = messages.length;
  } else {
    totalSteps = 1;
  }

  const reportProgress = () => {
    stepsDone++;
    if (onProgress) onProgress(stepsDone, totalSteps);
  };

  if (mode === 'all' || mode === 'markdown') {
    // Markdown
    const mdContent = exportMarkdown(messages, options, conversationTitle);
    zip.file(`markdown/${safeTitle}.md`, mdContent);
    reportProgress();

    // JSON
    const jsonContent = exportJSON(messages, options, conversationTitle);
    zip.file(`json/${safeTitle}.json`, jsonContent);
    reportProgress();

    // HTML
    const htmlContent = await exportHTML(messages, options, conversationTitle);
    zip.file(`html/${safeTitle}.html`, htmlContent);
    reportProgress();

    // SVG per message
    for (let i = 0; i < messages.length; i++) {
      const svgResult = exportSVG([messages[i]], options, `${safeTitle}-msg-${i + 1}`);
      zip.file(`svg/msg-${i + 1}.svg`, svgResult.data);
      reportProgress();
    }
  } else if (mode === 'svg') {
    // SVG only
    for (let i = 0; i < messages.length; i++) {
      const svgResult = exportSVG([messages[i]], options, `${safeTitle}-msg-${i + 1}`);
      zip.file(`svg/msg-${i + 1}.svg`, svgResult.data);
      reportProgress();
    }
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    data: blob,
    filename: `${safeTitle}.zip`,
    mimeType: 'application/zip',
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').substring(0, 200) || 'export';
}
