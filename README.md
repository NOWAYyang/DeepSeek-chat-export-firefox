# DeepSeek Chat Exporter

一款 Firefox 浏览器扩展，用于将 DeepSeek 网页版对话记录导出为 **Word (.docx)**、**PDF**、**HTML**、**Markdown**、**JSON**、**PNG**、**SVG** 和 **ZIP** 八种格式。

## 功能特色

- **API 获取数据** — 直接调用 DeepSeek 后端 API 拉取对话结构，不依赖 DOM 解析，页面改版也不影响使用
- **灵活选取** — 逐条勾选消息、按角色（全部/只看用户/只看助手）筛选、按关键词搜索
- **跨对话导出** — 选中多个对话中的消息，合并到同一个文件导出
- **8 种导出格式**：
  - **Word (.docx)** — Markdown 转 Word，代码块带语法高亮，LaTeX 公式转为 Word 原生数学对象（OMath），可在 Word 中直接编辑
  - **PDF** — 原生生成（非浏览器打印），支持 A4/Letter、横向/纵向、自定义边距
  - **HTML** — 独立离线文件，内嵌 KaTeX 渲染公式、highlight.js 高亮代码，支持深色/浅色主题
  - **Markdown** — 保留原始 Markdown 源码和 LaTeX 公式（$...$ / $$...$$）
  - **JSON** — 包含消息数组、对话 ID、标题、时间、模型名等完整元数据
  - **PNG** — 用 html2canvas 生成高质量截图，支持自定义背景色和宽度
  - **SVG** — 矢量气泡式单条消息快照，适合分享
  - **ZIP** — 多格式批量打包，内部按格式分目录存放
- **大对话处理** — 消息超过 500 条时自动分块处理，弹出窗口不卡死
- **隐私保护** — 所有数据转换在浏览器本地完成，不上传任何聊天内容到外部服务器

## 安装

### 环境要求

- Node.js 18+
- npm
- Firefox 109+

### 构建

```bash
npm install
npm run build
```

构建产物在 `dist/` 目录。

### 在 Firefox 中加载（临时扩展）

1. 打开 Firefox，访问 `about:debugging#/runtime/this-firefox`
2. 点击 **"加载临时附加组件"**
3. 选择 `dist/manifest.json`
4. 工具栏出现 DeepSeek Exporter 图标，点击即可使用

### 永久安装（开发用）

1. `about:config` 中设置 `xpinstall.signatures.required = false`
2. `cd dist && zip -r ../deepseek-exporter.zip *`
3. `about:addons` → 齿轮图标 → **从文件安装附加组件**

## 使用方法

1. 在浏览器中登录 [chat.deepseek.com](https://chat.deepseek.com)
2. 点击工具栏上的 DeepSeek Chat Exporter 图标
3. 左侧面板选择一个对话
4. 勾选需要导出的消息
5. 选择导出格式
6. 点击 **Export** 下载文件

首次使用可点击顶部的 **Guide** 按钮查看分步教程。

## 项目结构

```
deepseek-chat-exporter/
├── manifest.json              # 扩展清单（Manifest V3，Firefox 专用）
├── package.json               # 依赖和构建脚本
├── vite.popup.config.ts       # Vite 构建配置（React 弹出窗口）
├── vitest.config.ts           # 测试配置
├── icons/                     # 扩展图标（SVG）
├── src/
│   ├── types.ts               # 共享 TypeScript 类型定义
│   ├── background.ts          # 后台脚本（API 中继 + 下载管理）
│   ├── content_script.ts      # 内容脚本（检测当前对话 ID）
│   ├── api/
│   │   └── deepseek.ts        # DeepSeek API 客户端
│   ├── exporters/             # 8 种导出格式实现
│   │   ├── word.ts            # Word (.docx) 含 OMath 公式
│   │   ├── pdf.ts             # PDF（jsPDF + html2canvas）
│   │   ├── html.ts            # HTML 独立文件（KaTeX + highlight.js）
│   │   ├── markdown.ts        # Markdown
│   │   ├── json.ts            # JSON
│   │   ├── png.ts             # PNG 截图
│   │   ├── svg.ts             # SVG 气泡快照
│   │   └── zip.ts             # ZIP 批量打包
│   ├── utils/
│   │   ├── markdown.ts        # Markdown 解析（markdown-it + highlight.js）
│   │   └── latex.ts           # LaTeX → MathML（KaTeX）
│   ├── workers/
│   │   └── export.worker.ts   # Web Worker（大对话导出不阻塞 UI）
│   ├── popup/                 # React 弹出窗口
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/        # 7 个 UI 组件
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
│       └── markdown.test.ts   # 22 个单元测试
└── README-zh.md
```

## 测试

```bash
npm test
```

使用 Vitest 运行单元测试，覆盖 Markdown 解析、LaTeX 转换、JSON/Markdown 导出等核心函数。

## API 接口

扩展通过以下接口与 DeepSeek 通信：

| 接口 | 用途 |
|------|------|
| `GET /api/v0/default/chat/list` | 获取对话列表 |
| `GET /api/v0/default/chat/history?chat_id={id}` | 获取指定对话的消息 |

认证通过浏览器已登录的会话 Cookie 自动完成（`credentials: 'include'`）。

## 技术栈

| 库 | 版本 | 用途 |
|----|------|------|
| React 18 | ^18.3.1 | 弹出窗口 UI |
| docx | ^8.5.0 | Word 文档生成 |
| jspdf | ^2.5.2 | PDF 生成 |
| html2canvas | ^1.4.1 | PNG 截图 |
| jszip | ^3.10.1 | ZIP 打包 |
| highlight.js | ^11.9.0 | 代码语法高亮 |
| markdown-it | ^14.1.0 | Markdown 解析 |
| katex | ^0.16.11 | LaTeX 公式渲染 |

## 浏览器兼容

- **Firefox 109+**（Manifest V3）
- 暂未测试 Chrome/Chromium

## 许可

MIT
