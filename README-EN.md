# DeepSeek Chat Exporter

A Firefox browser extension that exports DeepSeek web chat conversations to multiple formats: **Word (.docx)**, **PDF**, **HTML**, **Markdown**, **JSON**, **PNG**, **SVG**, and **ZIP**.

## Features

- **API-based data fetching** — retrieves conversation data from DeepSeek's backend API (not DOM parsing), ensuring reliability across UI updates
- **Selective export** — choose individual messages, filter by role (user/assistant), search by keyword
- **Cross-conversation export** — select messages from multiple conversations and merge them into one file
- **8 export formats**:
  - **Word (.docx)** — Markdown→Word conversion with syntax-highlighted code blocks and LaTeX→OMath equations
  - **PDF** — Native rendering with page size/orientation/margin options
  - **HTML** — Self-contained offline file with KaTeX + highlight.js
  - **Markdown** — Raw Markdown with preserved LaTeX source
  - **JSON** — Structured conversation data with metadata
  - **PNG** — High-resolution screenshots via html2canvas
  - **SVG** — Vector bubble snapshots for individual messages
  - **ZIP** — Batch export of multiple formats in one archive
- **Advanced options** — page size (A4/Letter), orientation, margins, code highlight theme, dark mode
- **Guide overlay** — first-time user tutorial

## Installation

### Prerequisites

- Node.js 18+
- npm
- Firefox 109+

### Build

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

This produces a `dist/` directory containing the built extension.

### Load in Firefox (Temporary)

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Select the `dist/manifest.json` file from the built output
4. The extension icon will appear in the toolbar

### Permanent Installation (Development)

1. Go to `about:config` and set `xpinstall.signatures.required` to `false`
2. Package the extension: `cd dist && zip -r ../deepseek-exporter.zip *`
3. Install via `about:addons` → Gear icon → **Install Add-on From File...**

## Usage

1. Open [chat.deepseek.com](https://chat.deepseek.com) and log in
2. Click the DeepSeek Chat Exporter icon in the toolbar
3. Select a conversation from the left panel
4. Check the messages you want to export
5. Choose an export format
6. Click **Export** to download

## Project Structure

```
deepseek-chat-exporter/
├── manifest.json              # Extension manifest (MV3, Firefox)
├── package.json               # Dependencies and build scripts
├── vite.popup.config.ts       # Vite config for React popup
├── vitest.config.ts           # Test configuration
├── icons/                     # Extension icons (SVG)
├── src/
│   ├── types.ts               # Shared TypeScript interfaces
│   ├── background.ts          # Background script (API relay + downloads)
│   ├── content_script.ts      # Content script (chat ID detection)
│   ├── api/
│   │   └── deepseek.ts        # DeepSeek API client
│   ├── exporters/
│   │   ├── word.ts            # Word (.docx) exporter with OMath
│   │   ├── pdf.ts             # PDF exporter (jsPDF + html2canvas)
│   │   ├── html.ts            # HTML standalone exporter
│   │   ├── markdown.ts        # Markdown exporter
│   │   ├── json.ts            # JSON exporter
│   │   ├── png.ts             # PNG screenshot exporter
│   │   ├── svg.ts             # SVG bubble exporter
│   │   └── zip.ts             # ZIP batch exporter
│   ├── utils/
│   │   ├── markdown.ts        # Markdown parsing (markdown-it + hljs)
│   │   └── latex.ts           # LaTeX→MathML via KaTeX
│   ├── workers/
│   │   └── export.worker.ts   # Web Worker for large exports
│   ├── popup/                 # React popup UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ConversationList.tsx
│   │   │   ├── MessageTree.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   ├── ExportFormatSelector.tsx
│   │   │   ├── AdvancedOptions.tsx
│   │   │   ├── Guide.tsx
│   │   │   └── Notification.tsx
│   │   ├── hooks/
│   │   │   └── useDeepSeekAPI.ts
│   │   └── styles/
│   │       └── popup.css
│   └── __tests__/
│       └── markdown.test.ts   # Unit tests
└── README.md
```

## Testing

```bash
npm test
```

Runs unit tests for the markdown utilities, LaTeX conversion, and text-based exporters using Vitest.

## API Endpoints

The extension communicates with DeepSeek via these API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v0/default/chat/list` | List all conversations |
| `GET /api/v0/default/chat/history?chat_id={id}` | Get messages for a conversation |

Authentication is handled via the browser's existing session cookies (included via `credentials: 'include'`).

## Privacy

All data processing happens **entirely client-side**:
- No conversation data is uploaded to external servers
- All export conversions run in your browser
- The extension only communicates with DeepSeek's own API

## Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| React 18 | ^18.3.1 | Popup UI |
| docx | ^8.5.0 | Word document generation |
| jspdf | ^2.5.2 | PDF generation |
| html2canvas | ^1.4.1 | PNG screenshots |
| jszip | ^3.10.1 | ZIP archives |
| highlight.js | ^11.9.0 | Code syntax highlighting |
| markdown-it | ^14.1.0 | Markdown parsing |
| katex | ^0.16.11 | LaTeX rendering |

## Browser Compatibility

- **Firefox 109+** (Manifest V3)
- Not tested on Chrome/Chromium (designed for Firefox)

## License

MIT
