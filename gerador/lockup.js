// Monta "símbolo + nome" quando a banda só tem um ícone sem nome.
// uso: node lockup.js bands/simbolo.png "NOME PRINCIPAL" "SUBNOME" bands/saida_lockup.png
const { chromium } = require('playwright'); const path=require('path'); const fs=require('fs');
const { pathToFileURL } = require('url');
const [sym, l1, l2='', out] = process.argv.slice(2); const F=p=>pathToFileURL(path.resolve(__dirname,p)).href;
(async()=>{const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1600,height:400}});
const h=`<html><head><style>@font-face{font-family:A;src:url('${F('fonts/anton-latin-400-normal.woff2')}')}
body{margin:0;background:transparent}#l{display:inline-flex;align-items:center;gap:26px;padding:12px;font-family:A;color:#fff;line-height:.95;text-transform:uppercase;filter:drop-shadow(0 4px 10px rgba(0,0,0,.6))}
.a{font-size:120px}.b{font-size:63px;letter-spacing:6px}</style></head><body><div id="l"><img src="${F(sym)}" style="height:230px"><div><div class="a">${l1}</div><div class="b">${l2}</div></div></div></body></html>`;
fs.writeFileSync(path.resolve(__dirname,'_lock.html'),h); await p.goto(F('_lock.html')); await p.evaluate(()=>document.fonts.ready);
await (await p.$('#l')).screenshot({path:out,omitBackground:true}); fs.unlinkSync(path.resolve(__dirname,'_lock.html')); await b.close();})();
