/* ===== Shared type definitions for DeepSeek Chat Exporter ===== */

/** A single conversation from DeepSeek's API */
export interface DeepSeekConversation {
  chat_id: string;
  title: string;
  create_time: number;
  update_time: number;
  model?: string;
}

/** A single message within a conversation */
export interface DeepSeekMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  create_time?: number;
  /** Conversation this message belongs to (set when cross-chat exporting) */
  conversationTitle?: string;
}

/** Full conversation with messages */
export interface DeepSeekChat {
  conversation: DeepSeekConversation;
  messages: DeepSeekMessage[];
}

/** Supported export formats */
export type ExportFormat = 'word' | 'pdf' | 'html' | 'markdown' | 'json' | 'png' | 'svg';

/** Page size options for PDF export */
export type PageSize = 'A4' | 'Letter';
export type PageOrientation = 'portrait' | 'landscape';

/** Code highlight theme for HTML/Word exports */
export type HighlightTheme = 'github' | 'monokai' | 'vs2015' | 'atom-dark' | 'default';

/** Advanced export options */
export interface ExportOptions {
  pageSize: PageSize;
  pageOrientation: PageOrientation;
  margin: number; // in mm
  includeMetadata: boolean;
  highlightTheme: HighlightTheme;
  darkMode: boolean;
  preserveDeepSeekStyle: boolean;
}

/** Filter options for message selection */
export interface FilterOptions {
  role: 'all' | 'user' | 'assistant';
  dateFrom: number | null;
  dateTo: number | null;
  keyword: string;
}

/* ===== API Response Types ===== */

/** List conversation API response */
export interface APIListResponse {
  data?: {
    items?: DeepSeekConversation[];
  };
  result?: Array<{
    chat_id: string;
    title: string;
    create_time: number;
    update_time: number;
    model_name?: string;
  }>;
}

/** Chat history API response */
export interface APIHistoryResponse {
  data?: {
    items?: DeepSeekMessage[];
    messages?: DeepSeekMessage[];
  };
  result?: DeepSeekMessage[];
}

/* ===== Worker message types ===== */

export interface WorkerExportRequest {
  type: 'export';
  format: ExportFormat;
  messages: DeepSeekMessage[];
  options: ExportOptions;
  conversationTitle: string;
}

export interface WorkerProgressMessage {
  type: 'progress';
  current: number;
  total: number;
  stage: string;
}

export interface WorkerErrorMessage {
  type: 'error';
  error: string;
}

export interface WorkerResultMessage {
  type: 'result';
  data: ArrayBuffer | string;
  filename: string;
  mimeType: string;
}

export type WorkerMessage = WorkerProgressMessage | WorkerErrorMessage | WorkerResultMessage;

/** Type for export handler function */
export type ExportHandler = (
  messages: DeepSeekMessage[],
  options: ExportOptions,
  conversationTitle: string,
  onProgress?: (current: number, total: number, stage: string) => void
) => Promise<{ data: Blob | string; filename: string; mimeType: string }>;

/* ===== Storage types ===== */

export interface StoredState {
  conversations: DeepSeekConversation[];
  selectedMessageIds: Set<string>;
  filterOptions: FilterOptions;
  exportOptions: ExportOptions;
}
