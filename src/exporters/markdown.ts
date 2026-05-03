import type { DeepSeekMessage, ExportOptions } from '../types';

/**
 * Markdown exporter
 *
 * Concatenates messages into a single .md file with:
 * - YAML frontmatter (optional metadata header)
 * - Horizontal rules between messages
 * - Role labels (User / Assistant) as Markdown headings
 * - Raw LaTeX formulas preserved as-is ($...$ / $$...$$)
 */
export function exportMarkdown(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
): string {
  const parts: string[] = [];

  // Optional YAML frontmatter
  if (options.includeMetadata) {
    parts.push('---');
    parts.push(`title: "${escapeYAML(conversationTitle)}"`);
    parts.push(`exportDate: ${new Date().toISOString()}`);
    parts.push(`messageCount: ${messages.length}`);
    parts.push('---');
    parts.push('');
  }

  messages.forEach((msg, idx) => {
    if (idx > 0) {
      parts.push('');
      parts.push('---');
      parts.push('');
    }

    const roleLabel = msg.role === 'user' ? '👤 User' : '🤖 DeepSeek';
    parts.push(`## ${roleLabel}`);
    if (msg.conversationTitle && messages.length > 1) {
      parts.push(`> **Conversation:** ${msg.conversationTitle}`);
    }
    parts.push('');
    parts.push(msg.content);
    parts.push('');
  });

  return parts.join('\n');
}

function escapeYAML(value: string): string {
  if (value.includes(':') || value.includes('#') || value.includes('"')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
