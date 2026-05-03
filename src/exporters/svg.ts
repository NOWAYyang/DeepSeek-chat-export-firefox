/**
 * SVG snapshot exporter
 *
 * Generates vector-based SVG bubbles for individual messages.
 * Useful for sharing single messages as crisp, scalable graphics.
 *
 * For multiple messages, the caller (useDeepSeekAPI hook) wraps
 * them into a ZIP archive.
 */

import type { DeepSeekMessage, ExportOptions } from '../types';

interface SVGBubbleOptions {
  width: number;
  bgColor: string;
  textColor: string;
  roleColor: string;
  roleBg: string;
  maxTextWidth: number;
}

export function exportSVG(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
): { data: string; filename: string; mimeType: string } {
  const svgParts: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const opts: SVGBubbleOptions = {
      width: 600,
      bgColor: options.darkMode ? '#1e1e1e' : '#ffffff',
      textColor: options.darkMode ? '#e0e0e0' : '#1e293b',
      roleColor: msg.role === 'user' ? '#4f46e5' : '#10b981',
      roleBg: msg.role === 'user' ? '#eef2ff' : '#d1fae5',
      maxTextWidth: 520,
    };

    svgParts.push(generateMessageBubble(msg, i, opts));
  }

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${600}" viewBox="0 0 600 ${calculateTotalHeight(messages)}">
  <rect width="600" height="${calculateTotalHeight(messages)}" fill="${options.darkMode ? '#1e1e1e' : '#f8fafc'}" />
  ${svgParts.join('\n')}
</svg>`;

  const filename = messages.length === 1
    ? `${sanitizeFilename(conversationTitle)}-message.svg`
    : `${sanitizeFilename(conversationTitle)}-messages.svg`;

  return { data: svgContent, filename, mimeType: 'image/svg+xml' };
}

function generateMessageBubble(msg: DeepSeekMessage, index: number, opts: SVGBubbleOptions): string {
  const yOffset = index * 140 + 20;
  const label = msg.role === 'user' ? 'User' : 'DeepSeek';
  // Escape XML special chars in content
  const escapedContent = escapeXml(msg.content);
  // Truncate for SVG display (long text doesn't wrap nicely in SVG foreignObject)
  const previewContent = escapedContent.length > 300
    ? escapedContent.substring(0, 300) + '...'
    : escapedContent;

  return `
  <g transform="translate(20, ${yOffset})">
    <!-- Bubble -->
    <rect x="0" y="0" width="560" rx="8" fill="${opts.bgColor}" stroke="#e2e8f0" stroke-width="1" />
    <!-- Left color bar -->
    <rect x="0" y="0" width="4" height="120" rx="2" fill="${opts.roleColor}" />
    <!-- Role badge -->
    <rect x="16" y="12" width="${label.length * 8 + 16}" height="20" rx="4" fill="${opts.roleBg}" />
    <text x="24" y="26" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="${opts.roleColor}" text-transform="uppercase">${label}</text>
    <!-- Message content (simple text) -->
    <foreignObject x="16" y="40" width="528" height="70">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, sans-serif; font-size: 12px; color: ${opts.textColor}; line-height: 1.5; overflow: hidden; word-wrap: break-word;">
        ${previewContent}
      </div>
    </foreignObject>
  </g>`;
}

function calculateTotalHeight(messages: DeepSeekMessage[]): number {
  return Math.max(messages.length * 140 + 40, 200);
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').substring(0, 200) || 'export';
}
