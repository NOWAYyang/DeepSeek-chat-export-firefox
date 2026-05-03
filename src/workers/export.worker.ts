/**
 * Export Web Worker
 *
 * Offloads heavy export processing from the popup's main thread.
 * Handles text-based formats (JSON, Markdown, HTML) that don't
 * require DOM access. Word/PDF/PNG formats require DOM APIs and
 * are handled by the main thread.
 *
 * Communication:
 *   Main → Worker: WorkerExportRequest
 *   Worker → Main: WorkerProgressMessage | WorkerResultMessage | WorkerErrorMessage
 *
 * Loaded via browser.runtime.getURL('export.worker.js').
 */

import type {
  WorkerExportRequest,
  WorkerResultMessage,
  WorkerProgressMessage,
  WorkerErrorMessage,
} from '../types';

self.onmessage = async (event: MessageEvent<WorkerExportRequest>) => {
  const request = event.data;

  if (request.type !== 'export') {
    postMessage({ type: 'error', error: `Unknown message type: ${request.type}` } as WorkerErrorMessage);
    return;
  }

  try {
    const { format, messages, options, conversationTitle } = request;
    const total = messages.length;

    const report = (current: number, stage: string) => {
      postMessage({ type: 'progress', current, total, stage } as WorkerProgressMessage);
    };

    report(0, `Preparing ${format} export...`);

    switch (format) {
      case 'json':
        await handleJSON(messages, options, conversationTitle, report);
        break;
      case 'markdown':
        await handleMarkdown(messages, options, conversationTitle, report);
        break;
      case 'html':
        await handleHTML(messages, options, conversationTitle, report);
        break;
      default:
        throw new Error(`Format "${format}" requires DOM access — main thread handles it`);
    }
  } catch (err: any) {
    postMessage({ type: 'error', error: err.message || 'Export worker failed' } as WorkerErrorMessage);
  }
};

async function handleJSON(
  messages: any[], options: any, title: string,
  report: (n: number, s: string) => void,
) {
  const { exportJSON } = await import('../exporters/json');
  const content = exportJSON(messages, options, title);
  report(messages.length, 'Done');
  const encoder = new TextEncoder();
  postMessage({
    type: 'result',
    data: encoder.encode(content).buffer,
    filename: `${sanitize(title)}.json`,
    mimeType: 'application/json',
  } as WorkerResultMessage);
}

async function handleMarkdown(
  messages: any[], options: any, title: string,
  report: (n: number, s: string) => void,
) {
  const { exportMarkdown } = await import('../exporters/markdown');
  const content = exportMarkdown(messages, options, title);
  report(messages.length, 'Done');
  const encoder = new TextEncoder();
  postMessage({
    type: 'result',
    data: encoder.encode(content).buffer,
    filename: `${sanitize(title)}.md`,
    mimeType: 'text/markdown',
  } as WorkerResultMessage);
}

async function handleHTML(
  messages: any[], options: any, title: string,
  report: (n: number, s: string) => void,
) {
  const { exportHTML } = await import('../exporters/html');
  const content = await exportHTML(messages, options, title);
  report(messages.length, 'Done');
  const encoder = new TextEncoder();
  postMessage({
    type: 'result',
    data: encoder.encode(content).buffer,
    filename: `${sanitize(title)}.html`,
    mimeType: 'text/html',
  } as WorkerResultMessage);
}

function sanitize(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_').substring(0, 200) || 'export';
}
