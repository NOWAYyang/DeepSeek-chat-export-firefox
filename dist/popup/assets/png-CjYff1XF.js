import{i as e}from"./chunk-62oNxeRG.js";import{n as t,r as n}from"./index-DgXQRG3t.js";import{t as r}from"./html2canvas-B41CY5Bs.js";import{t as i}from"./latex-BqrBFkM-.js";var a=e(r());async function o(e,t,n,r){let i=t.darkMode?`#1e1e1e`:`#ffffff`,o=t.darkMode?`#e0e0e0`:`#1e293b`,c=s(e,i,o),l=document.createElement(`div`);l.style.cssText=`
    position: absolute; left: -9999px; top: 0;
    width: 800px;
    padding: 20px;
    background: ${i};
    color: ${o};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    font-size: 14px;
  `,l.innerHTML=c,document.body.appendChild(l);try{r&&r(1,1);let e=await(0,a.default)(l,{scale:2,backgroundColor:i,useCORS:!0,logging:!1,allowTaint:!0});return new Promise(t=>{e.toBlob(e=>{if(e)t({data:e,filename:`${u(n)}.png`,mimeType:`image/png`});else throw Error(`Failed to generate PNG blob`)},`image/png`)})}finally{document.body.removeChild(l)}}function s(e,t,n){let r=[];for(let i of e){let e=i.role===`user`?`#4f46e5`:`#10b981`,a=i.role===`user`?`#eef2ff`:`#d1fae5`,o=i.role===`user`?`User`:`DeepSeek`;r.push(`
      <div style="margin:16px 0;padding:16px;border-left:4px solid ${e};border-radius:8px;background:${t};border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <span style="font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:4px;background:${a};color:${e};">${o}</span>
          ${i.conversationTitle?`<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:#f1f5f9;color:#64748b;">${l(i.conversationTitle)}</span>`:``}
        </div>
        <div style="font-size:14px;line-height:1.6;color:${n};">
          ${c(i.content)}
        </div>
      </div>
    `)}return`
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
    <style>
      pre { background: #f1f5f9; padding: 12px; border-radius: 6px; overflow-x: auto; }
      code { font-family: 'Fira Code', Consolas, monospace; }
      p > code { background: #f1f5f9; padding: 1px 4px; border-radius: 3px; }
      table { border-collapse: collapse; width: 100%; margin: 8px 0; }
      th, td { border: 1px solid #e2e8f0; padding: 6px 10px; text-align: left; }
      th { background: #f8fafc; font-weight: 600; }
      img { max-width: 100%; }
      blockquote { border-left: 3px solid #4f46e5; padding-left: 12px; margin: 8px 0; color: #64748b; }
    </style>
    ${r.join(`
`)}
  `}function c(e){let r=n(e),a=[];for(let e of r)e.type===`latex`?a.push(i(e.formula,e.display||!1)):a.push(t.render(e.content));return a.join(`
`)}function l(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`)}function u(e){return e.replace(/[<>:"/\\|?*]/g,`_`).replace(/\s+/g,`_`).replace(/_+/g,`_`).substring(0,200)||`export`}export{o as exportPNG};