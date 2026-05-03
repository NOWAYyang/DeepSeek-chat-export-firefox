function e(e,r,a){let o=[];for(let n=0;n<e.length;n++){let i=e[n],a={width:600,bgColor:r.darkMode?`#1e1e1e`:`#ffffff`,textColor:r.darkMode?`#e0e0e0`:`#1e293b`,roleColor:i.role===`user`?`#4f46e5`:`#10b981`,roleBg:i.role===`user`?`#eef2ff`:`#d1fae5`,maxTextWidth:520};o.push(t(i,n,a))}return{data:`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="600" viewBox="0 0 600 ${n(e)}">
  <rect width="600" height="${n(e)}" fill="${r.darkMode?`#1e1e1e`:`#f8fafc`}" />
  ${o.join(`
`)}
</svg>`,filename:e.length===1?`${i(a)}-message.svg`:`${i(a)}-messages.svg`,mimeType:`image/svg+xml`}}function t(e,t,n){let i=t*140+20,a=e.role===`user`?`User`:`DeepSeek`,o=r(e.content),s=o.length>300?o.substring(0,300)+`...`:o;return`
  <g transform="translate(20, ${i})">
    <!-- Bubble -->
    <rect x="0" y="0" width="560" rx="8" fill="${n.bgColor}" stroke="#e2e8f0" stroke-width="1" />
    <!-- Left color bar -->
    <rect x="0" y="0" width="4" height="120" rx="2" fill="${n.roleColor}" />
    <!-- Role badge -->
    <rect x="16" y="12" width="${a.length*8+16}" height="20" rx="4" fill="${n.roleBg}" />
    <text x="24" y="26" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="${n.roleColor}" text-transform="uppercase">${a}</text>
    <!-- Message content (simple text) -->
    <foreignObject x="16" y="40" width="528" height="70">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, sans-serif; font-size: 12px; color: ${n.textColor}; line-height: 1.5; overflow: hidden; word-wrap: break-word;">
        ${s}
      </div>
    </foreignObject>
  </g>`}function n(e){return Math.max(e.length*140+40,200)}function r(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&apos;`)}function i(e){return e.replace(/[<>:"/\\|?*]/g,`_`).replace(/\s+/g,`_`).replace(/_+/g,`_`).substring(0,200)||`export`}export{e as exportSVG};