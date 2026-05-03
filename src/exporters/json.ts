import type { DeepSeekMessage, ExportOptions } from '../types';

/**
 * JSON exporter
 *
 * Exports the complete conversation data as a structured JSON file,
 * including messages array, conversation metadata, and export timestamp.
 */
export function exportJSON(
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
): string {
  const exportData = {
    exportDate: new Date().toISOString(),
    title: conversationTitle,
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.create_time ? new Date(msg.create_time * 1000).toISOString() : undefined,
      conversation: msg.conversationTitle || undefined,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}
