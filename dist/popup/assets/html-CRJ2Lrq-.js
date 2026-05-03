import{n as e,r as t}from"./index-DgXQRG3t.js";var n={github:`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github.min.css`,monokai:`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/monokai-sublime.min.css`,vs2015:`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/vs2015.min.css`,"atom-dark":`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css`,default:`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/default.min.css`},r=`https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css`,i=`https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js`,a=`https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js`;async function o(e,t,o){let u=t.darkMode?`dark`:`light`,d=n[t.highlightTheme]||n.github,f=[];t.includeMetadata&&f.push(`
      <div class="metadata">
        <h1>${l(o)}</h1>
        <p class="meta-info">Exported: ${new Date().toLocaleString()} | Messages: ${e.length}</p>
      </div>
    `),e.forEach((t,n)=>{let r=t.role===`user`?`user`:`assistant`,i=t.role===`user`?`User`:`DeepSeek`;f.push(`
      <div class="message ${r}">
        <div class="message-header">
          <span class="role-badge ${r}">${i}</span>
          ${t.conversationTitle?`<span class="conv-badge">${l(t.conversationTitle)}</span>`:``}
        </div>
        <div class="message-body">
          ${s(t.content)}
        </div>
      </div>
    `),n<e.length-1&&f.push(`<hr class="message-separator" />`)});let p=c(u,t.preserveDeepSeekStyle);return`<!DOCTYPE html>
<html lang="en" class="theme-${u}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${l(o)} - DeepSeek Export</title>
  <link rel="stylesheet" href="${r}" />
  <link rel="stylesheet" href="${d}" />
  <style>${p}</style>
</head>
<body>
  <div class="container">
    ${f.join(`
`)}
  </div>
  <script src="${i}"><\/script>
  <script src="${a}"><\/script>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Render LaTeX with KaTeX
      document.querySelectorAll('.math-display, .math-inline').forEach(function(el) {
        try {
          katex.render(el.textContent, el, {
            displayMode: el.classList.contains('math-display'),
            throwOnError: false
          });
        } catch(e) { el.style.color = '#cc0000'; }
      });
      // Highlight code blocks
      document.querySelectorAll('pre code').forEach(function(block) {
        hljs.highlightElement(block);
      });
    });
  <\/script>
</body>
</html>`}function s(n){let r=t(n);if(r.length===1&&r[0].type===`text`)return e.render(n);let i=[];for(let t of r)if(t.type===`text`)i.push(e.render(t.content));else{let e=t.display?`math-display`:`math-inline`;i.push(`<span class="${e}">${l(t.content)}</span>`)}return i.join(`
`)}function c(e,t){let n=e===`dark`;return`
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: ${n?`#212121`:`#f8fafc`};
      color: ${n?`#e0e0e0`:`#1e293b`};
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .metadata { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid ${n?`#424242`:`#e2e8f0`}; }
    .metadata h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .meta-info { font-size: 13px; color: ${n?`#9e9e9e`:`#94a3b8`}; }
    .message { margin: 16px 0; padding: 16px; border-radius: 8px; background: ${n?`#2d2d2d`:`#ffffff`}; border: 1px solid ${n?`#424242`:`#e2e8f0`}; }
    .message.user { border-left: 4px solid #4f46e5; }
    .message.assistant { border-left: 4px solid #10b981; }
    .message-header { margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .role-badge { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 4px; }
    .role-badge.user { background: ${n?`#312e81`:`#eef2ff`}; color: #4f46e5; }
    .role-badge.assistant { background: ${n?`#064e3b`:`#d1fae5`}; color: #10b981; }
    .conv-badge { font-size: 11px; padding: 1px 6px; border-radius: 10px; background: ${n?`#374151`:`#f1f5f9`}; color: ${n?`#9ca3af`:`#64748b`}; }
    .message-body { font-size: 14px; }
    .message-body p { margin: 8px 0; }
    .message-body pre { background: ${n?`#1a1a1a`:`#f1f5f9`}; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 8px 0; }
    .message-body code { font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace; font-size: 13px; }
    .message-body p > code, .message-body li > code { background: ${n?`#374151`:`#f1f5f9`}; padding: 1px 4px; border-radius: 3px; }
    .message-body blockquote { border-left: 3px solid ${n?`#6366f1`:`#4f46e5`}; padding-left: 12px; margin: 8px 0; color: ${n?`#9ca3af`:`#64748b`}; }
    .message-body table { border-collapse: collapse; width: 100%; margin: 8px 0; }
    .message-body th, .message-body td { border: 1px solid ${n?`#424242`:`#e2e8f0`}; padding: 6px 10px; text-align: left; }
    .message-body th { background: ${n?`#333`:`#f8fafc`}; font-weight: 600; }
    .message-body img { max-width: 100%; border-radius: 4px; }
    .message-separator { border: none; border-top: 1px solid ${n?`#424242`:`#e2e8f0`}; margin: 8px 0; }
    .math-display { display: block; text-align: center; margin: 12px 0; overflow-x: auto; }
    .math-inline { display: inline; }
  `}function l(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)}export{o as exportHTML};