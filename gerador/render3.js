// Agenda Woodstock — 3 layouts (A tarja, B coluna, C ingresso) × feed/story
// uso: node render3.js shows.json pasta_saida [A,B,C]
// Gera os 3 layouts aprovados da Agenda Woodstock (A Tarja, B Coluna, C Ingresso) em feed 1080x1350 e story 1080x1920.
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const D = __dirname;
const { pathToFileURL } = require('url');
const F = p => pathToFileURL(path.resolve(D, p)).href;   // corrigido: monta file:// valido tambem no Windows
const font = (n, f) => `@font-face{font-family:'${n}';src:url('${F('fonts/' + f.split('/').pop())}')}`;
const FONTS = font('Anton', 'anton/files/anton-latin-400-normal.woff2') +
  font('Bebas', 'bebas-neue/files/bebas-neue-latin-400-normal.woff2') +
  font('Oswald', 'oswald/files/oswald-latin-500-normal.woff2') +
  font('OswaldB', 'oswald/files/oswald-latin-700-normal.woff2');
const NOISE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")`;
const TORN = 'polygon(0 8%,4% 0,9% 6%,15% 1%,22% 7%,28% 0,35% 5%,41% 1%,48% 8%,55% 2%,61% 7%,68% 0,74% 6%,81% 1%,87% 7%,93% 0,100% 6%,100% 92%,96% 100%,90% 94%,84% 100%,77% 93%,71% 99%,64% 94%,58% 100%,51% 93%,45% 99%,38% 94%,31% 100%,25% 93%,18% 99%,12% 94%,6% 100%,0 93%)';
const RED = '#d6121c';
const B = {
  logoRed: F('brand/Woodstock4.png'), logoWhite: F('brand/Woodstock5.png'), tri: F('brand/2WOODSTOCK LOGO ALTERNATIVA.png'),
  door: F('brand/ic_porta.png'), show: F('brand/ic_show.png'), ticket: F('brand/ic_ticket.png'),
};
const ADDR = 'Av. D, 1064 – St. Oeste, Goiânia – GO';
const IG = '@woodstockrockbar';

const base = (W, H) => `${FONTS}*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;height:${H}px;overflow:hidden;position:relative;font-family:Oswald;color:#fff;background:#0a0a0a}
.grain{position:absolute;inset:0;background:${NOISE};opacity:.14;mix-blend-mode:overlay;z-index:50;pointer-events:none}
.abs{position:absolute}`;
const hasLogo = s => s.bandLogo && fs.existsSync(path.resolve(D, s.bandLogo));
let CUR = 'feed';
const bandName = (s, size, extra = '') => hasLogo(s)
  ? `<img src="${F(s.bandLogo)}" style="height:${(s.logoH && s.logoH[CUR]) || size * 1.3}px;max-width:820px;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(0,0,0,.85))">`
  : `<div style="font-family:Anton;font-size:${size}px;line-height:.95;text-transform:uppercase;white-space:nowrap;${extra}">${s.band}</div>`;
// O couvert vem da inscricao. Era um valor fixo escrito na arte; virou dado porque
// cada show cobra o seu, e show sem couvert existe — nesse caso a linha nao aparece,
// em vez de anunciar um preco que ninguem combinou.
const couvert = s => String(s.couvert == null ? '' : s.couvert).trim();
const fit = (s, max, k) => Math.round(Math.min(max, k / Math.max(s.band.length, 1)));

// ---------- A: TARJA RASGADA ----------
function A(s, story) {
  const W = 1080, H = story ? 1920 : 1350;
  const pT = story ? 230 : 140, pH = story ? 840 : 740;
  const nameS = fit(s, story ? 124 : 112, 1500);
  const infoT = pT + pH + (story ? 120 : 60);
  return `<style>${base(W, H)}
.glow{left:50%;top:${pT + pH * .45}px;width:1150px;height:1150px;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(214,18,28,.6),rgba(214,18,28,.15) 40%,transparent 66%)}
.ghost{left:-30px;right:-30px;top:${pT + 10}px;font-family:Anton;font-size:${story ? 320 : 290}px;line-height:.85;color:transparent;-webkit-text-stroke:3px rgba(255,255,255,.09);text-align:center;white-space:nowrap}
.slash{left:-80px;width:1300px;height:${story ? 120 : 100}px;background:${RED};top:${pT + pH - (story ? 250 : 230)}px;transform:rotate(-6deg);clip-path:${TORN};z-index:3;opacity:.93}
.slash2{left:-80px;width:1300px;height:24px;background:#fff;top:${pT + pH - (story ? 250 : 230) + (story ? 172 : 148)}px;transform:rotate(-6deg);clip-path:${TORN};z-index:3;opacity:.9}
.photo{left:50%;transform:translateX(-50%);top:${pT}px;height:${pH}px;max-width:1180px;object-fit:contain;object-position:bottom;z-index:2}
.fade{left:0;right:0;top:${pT + pH - 260}px;height:270px;background:linear-gradient(transparent,#0a0a0a 88%);z-index:4}
.head{top:${story ? 120 : 44}px;left:48px;right:48px;display:flex;justify-content:space-between;align-items:center;z-index:6}
.k{font-family:Bebas;font-size:40px;letter-spacing:6px;line-height:1}.k b{display:block;color:${RED};font-weight:400}
.band{left:0;right:0;top:${hasLogo(s) && (s.logoH||{})[CUR] > 200 ? pT + pH - s.logoH[CUR] + (story ? 70 : 40) : pT + pH - (story ? 120 : 110)}px;display:flex;justify-content:center;z-index:6}
.tape{background:${RED};clip-path:${TORN};padding:22px 56px 26px;transform:rotate(-2deg);text-shadow:3px 3px 0 rgba(0,0,0,.35)}
.info{left:48px;right:48px;top:${infoT}px;display:flex;align-items:center;gap:${story ? 22 : 30}px;flex-wrap:${story ? 'wrap' : 'nowrap'};z-index:6}
.dd{font-family:Anton;font-size:${story ? 230 : 180}px;line-height:.82}
.mm .m{font-family:Anton;font-size:${story ? 78 : 62}px;color:${RED};line-height:.9}
.mm .w{white-space:nowrap;font-family:Bebas;font-size:${story ? 44 : 36}px;letter-spacing:3px;background:#fff;color:#0a0a0a;padding:2px 12px 0;margin-top:8px}
.sep{width:4px;align-self:stretch;background:${RED}}
.row{display:flex;align-items:center;gap:14px;font-family:Bebas;font-size:${story ? 46 : 42}px;white-space:nowrap;letter-spacing:2px;line-height:1;margin:${story ? 10 : 6}px 0}
.row img{height:${story ? 56 : 46}px;width:${story ? 56 : 46}px;object-fit:contain}
.row small{display:block;font-size:.6em;color:rgba(255,255,255,.7);letter-spacing:3px}
.cv{margin-left:auto;transform:rotate(5deg);background:#fff;color:#0a0a0a;text-align:center;padding:12px 20px 8px;font-family:Bebas;letter-spacing:2px;box-shadow:6px 6px 0 ${RED}}
.cv span{display:block;font-size:${story ? 30 : 26}px;line-height:1}.cv b{display:block;font-family:Anton;font-weight:400;font-size:${story ? 62 : 52}px;line-height:1}
.foot{left:0;right:0;bottom:${story ? 150 : 0}px;z-index:8}
.foot .logo{display:flex;justify-content:center;margin-bottom:${story ? 34 : 20}px}
.bar{background:${RED};display:flex;justify-content:space-between;padding:22px 48px;font-size:${story ? 30 : 27}px}.bar b{font-family:OswaldB;font-weight:400}
</style>
<div class="abs glow"></div><div class="abs ghost">AO VIVO<br>AO VIVO</div>
<div class="abs slash"></div><div class="abs slash2"></div>
<img class="abs photo" src="${F(s.photo)}"><div class="abs fade"></div>
<div class="abs head"><div class="k">AGENDA<b>${s.mes||"NOVEMBRO"}</b></div><img src="${B.tri}" style="height:${story ? 110 : 92}px"><div class="k" style="text-align:right">SHOW<b>AO VIVO</b></div></div>
<div class="abs band"><div class="${hasLogo(s) ? '' : 'tape'}">${bandName(s, nameS)}</div></div>
<div class="abs info">
 <div style="display:flex;align-items:flex-end;gap:14px"><div class="dd">${s.day}</div><div class="mm"><div class="m">${s.mesAbrev||"NOV"}</div><div class="w">${s.weekday}</div></div></div>
 <div class="sep"></div>
 <div><div class="row"><img src="${B.door}"><div><small>BAR ABRE</small>18H</div></div>
 <div class="row"><img src="${B.show}"><div><small>SHOW</small>A PARTIR DAS 20H</div></div></div>
 ${couvert(s) ? `<div class="cv"><span>COUVERT</span><b>R$${couvert(s)}</b></div>` : ''}
</div>
<div class="abs foot"><div class="logo"><img src="${B.logoRed}" style="height:${story ? 150 : 108}px"></div>
<div class="bar"><span>${ADDR}</span><b>${IG}</b></div></div>`;
}

// ---------- B: COLUNA VERMELHA (editorial) ----------
function B_(s, story) {
  const W = 1080, H = story ? 1920 : 1350;
  const colW = story ? 250 : 230;
  const top = story ? 170 : 0, bot = story ? 170 : 0;
  const nameS = fit(s, story ? 150 : 132, 1650);
  return `<style>${base(W, H)}
.col{left:0;top:0;bottom:0;width:${colW}px;background:${RED};z-index:5}
.colin{left:0;top:${top}px;bottom:${bot}px;width:${colW}px;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:${story ? 30 : 46}px 0}
.vday{font-family:Anton;font-size:${story ? 210 : 190}px;line-height:.85;color:#fff}
.vmon{font-family:Anton;font-size:${story ? 92 : 84}px;line-height:.9;color:#0a0a0a;margin-top:6px}
.vwk{writing-mode:vertical-rl;transform:rotate(180deg);font-family:Anton;font-size:${story ? 96 : 84}px;letter-spacing:4px;color:#fff;line-height:1;white-space:nowrap}
.photoBox{left:${colW}px;right:0;top:0;bottom:0;overflow:hidden;background:#111}
.photoBox:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 60% 40%,#3a3a3a,#0a0a0a 70%)}
.halftone{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.12) 1.4px,transparent 1.6px);background-size:12px 12px;-webkit-mask-image:linear-gradient(115deg,#000 0%,transparent 55%)}
.photo{position:absolute;left:50%;transform:translateX(-50%);bottom:${story ? 640 : 330}px;height:${story ? 1050 : 900}px;max-width:${W - colW + 120}px;object-fit:contain;object-position:bottom}
.shade{position:absolute;left:0;right:0;bottom:0;height:${story ? 1100 : 640}px;background:linear-gradient(transparent,rgba(10,10,10,.85) 35%,#0a0a0a 60%)}
.top{left:${colW + 40}px;right:40px;top:${story ? 140 : 40}px;display:flex;justify-content:space-between;align-items:flex-start;z-index:7}
.tag{font-family:Bebas;font-size:34px;letter-spacing:7px;border:2px solid #fff;padding:6px 14px 2px}
.name{left:${colW + 40}px;right:40px;bottom:${story ? 590 : 300}px;z-index:7}
.pre{font-family:Bebas;font-size:${story ? 44 : 38}px;letter-spacing:10px;color:${RED}}
.rule{height:6px;width:140px;background:${RED};margin:16px 0 0}
.grid{left:${colW + 40}px;right:40px;bottom:${story ? 300 : 110}px;z-index:7;display:grid;grid-template-columns:${couvert(s) ? '1fr 1fr 1fr' : '1fr 1fr'};border-top:2px solid rgba(255,255,255,.25)}
.cell{padding:20px 0 0;display:flex;gap:12px;align-items:center}
.cell img{height:${story ? 58 : 50}px;width:${story ? 58 : 50}px;object-fit:contain}
.cell small{display:block;font-family:Bebas;font-size:${story ? 28 : 24}px;letter-spacing:3px;color:rgba(255,255,255,.65);line-height:1}
.cell b{display:block;font-family:Anton;font-weight:400;font-size:${story ? 40 : 34}px;line-height:1.05}
.foot{left:${colW + 40}px;right:40px;bottom:${story ? 200 : 34}px;z-index:7;display:flex;justify-content:space-between;font-size:${story ? 27 : 24}px;color:rgba(255,255,255,.85)}
.foot b{font-family:OswaldB;font-weight:400;color:#fff}
</style>
<div class="abs photoBox"><div class="halftone"></div><img class="photo" src="${F(s.photoB || s.photo)}"><div class="shade"></div></div>
<div class="abs col"></div>
<div class="abs colin"><div style="text-align:center"><div class="vday">${s.day}</div><div class="vmon">${s.mesAbrev||"NOV"}</div></div>
<div class="vwk">${s.weekday}</div>
<img src="${B.logoWhite}" style="width:${colW - 40}px"></div>
<div class="abs top"><div class="tag">AGENDA DE ${s.mes||"NOVEMBRO"}</div><img src="${B.tri}" style="height:${story ? 100 : 86}px"></div>
<div class="abs name"><div class="pre">AO VIVO NO WOODSTOCK</div>${bandName(s, nameS, 'color:#fff')}<div class="rule"></div></div>
<div class="abs grid">
 <div class="cell"><img src="${B.door}"><div><small>BAR ABRE</small><b>18H</b></div></div>
 <div class="cell"><img src="${B.show}"><div><small>SHOW</small><b>A PARTIR<br>DAS 20H</b></div></div>
 ${couvert(s) ? `<div class="cell"><img src="${B.ticket}"><div><small>COUVERT</small><b>R$${couvert(s)}</b></div></div>` : ''}
</div>
<div class="abs foot"><span>${ADDR}</span><b>${IG}</b></div>`;
}

// ---------- C: INGRESSO (ticket) ----------
function C(s, story) {
  const W = 1080, H = story ? 1920 : 1350;
  const cardT = story ? 290 : 150, cardH = story ? 760 : 640, cardW = 860;
  const nameS = fit(s, story ? 120 : 108, 1500);
  const stubT = cardT + cardH + (story ? 170 : 150);
  return `<style>${base(W, H)}
body{background:${RED}}
.vign{inset:0;background:radial-gradient(ellipse at 50% 40%,transparent 30%,rgba(0,0,0,.55) 100%)}
.tri{left:50%;top:${story ? 180 : 40}px;height:${story ? 1500 : 1200}px;transform:translateX(-50%);opacity:.10;filter:brightness(0)}
.head{left:0;right:0;top:${story ? 140 : 40}px;display:flex;justify-content:center;z-index:5}
.card{left:${(W - cardW) / 2}px;top:${cardT}px;width:${cardW}px;height:${cardH}px;background:#f2efe8;padding:22px 22px 0;transform:rotate(-2.5deg);box-shadow:0 30px 60px rgba(0,0,0,.45);z-index:4}
.card .ph{position:relative;width:100%;height:${cardH - 120}px;background:#151515;overflow:hidden}
.card .ph:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,#444,#0d0d0d 70%)}
.card .ph img{position:absolute;left:50%;bottom:0;transform:translateX(-50%);height:100%;max-width:120%;object-fit:contain;object-position:bottom}
.card .cap{height:98px;display:flex;align-items:center;justify-content:flex-end;font-family:Bebas;color:#0a0a0a;font-size:38px;letter-spacing:5px}
.card .cap b{font-weight:400;color:${RED}}
.tape1,.tape2{width:220px;height:56px;background:rgba(255,255,255,.55);z-index:6}
.tape1{left:${(W - cardW) / 2 - 50}px;top:${cardT - 10}px;transform:rotate(-38deg)}
.tape2{right:${(W - cardW) / 2 - 50}px;top:${cardT - 18}px;transform:rotate(32deg)}
.name{left:0;right:0;top:${cardT + cardH - 200}px;display:flex;justify-content:center;z-index:7}
.nbox{background:#0a0a0a;padding:18px 46px 22px;transform:rotate(1.5deg);box-shadow:8px 8px 0 #fff}
.stub{left:60px;right:60px;top:${stubT}px;height:${story ? 300 : 250}px;z-index:6;display:flex;background:#0a0a0a;
 -webkit-mask:radial-gradient(circle 22px at 0 50%,transparent 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 22px at 100% 50%,transparent 98%,#000) right/51% 100% no-repeat}
.stub .d{width:${story ? 300 : 270}px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:4px dashed rgba(255,255,255,.35)}
.stub .d .n{font-family:Anton;font-size:${story ? 150 : 128}px;line-height:.85}
.stub .d .m{font-family:Bebas;font-size:${story ? 40 : 34}px;letter-spacing:4px;color:${RED};margin-top:8px;white-space:nowrap}
.stub .i{flex:1;display:flex;flex-direction:column;justify-content:center;gap:${story ? 18 : 12}px;padding:0 40px}
.r{display:flex;align-items:center;gap:16px;font-family:Bebas;font-size:${story ? 48 : 42}px;letter-spacing:2px;line-height:1}
.r img{width:${story ? 52 : 44}px;height:${story ? 52 : 44}px;object-fit:contain}
.r i{font-style:normal;color:rgba(255,255,255,.6);font-size:.7em;margin-right:6px}
.foot{left:0;right:0;bottom:${story ? 170 : 30}px;z-index:6;display:flex;flex-direction:column;align-items:center;gap:${story ? 22 : 14}px}
.foot .t{font-size:${story ? 29 : 25}px;color:#fff}.foot .t b{font-family:OswaldB;font-weight:400}
</style>
<div class="abs vign"></div><img class="abs tri" src="${B.tri}">
<div class="abs head"><div style="font-family:Bebas;font-size:40px;letter-spacing:12px;color:#0a0a0a;background:#fff;padding:6px 22px 2px">AGENDA · ${s.mes||"NOVEMBRO"}</div></div>
<div class="abs card"><div class="ph"><img src="${F(s.photoC || s.photo)}"></div><div class="cap"></div></div>
<div class="abs tape1"></div><div class="abs tape2"></div>
<div class="abs name"><div class="${hasLogo(s) ? '' : 'nbox'}">${bandName(s, nameS)}</div></div>
<div class="abs stub">
 <div class="d"><div class="n">${s.day}</div><div class="m">${s.mesAbrev||"NOV"} · ${s.weekday.replace('-FEIRA', '')}</div></div>
 <div class="i"><div class="r"><img src="${B.door}"><span><i>BAR ABRE</i>18H</span></div>
 <div class="r"><img src="${B.show}"><span><i>SHOW</i>A PARTIR DAS 20H</span></div>
 ${couvert(s) ? `<div class="r"><img src="${B.ticket}"><span><i>COUVERT</i>R$${couvert(s)}</span></div>` : ''}</div>
</div>
<div class="abs foot"><img src="${B.logoWhite}" style="height:${story ? 140 : 96}px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))"><div class="t">${ADDR} &nbsp;|&nbsp; <b>${IG}</b></div></div>`;
}

const L = { A, B: B_, C };
(async () => {
  const shows = JSON.parse(fs.readFileSync(process.argv[2]));
  const out = process.argv[3] || 'out3'; fs.mkdirSync(out, { recursive: true });
  const which = (process.argv[4] || 'A,B,C').split(',');
  const b = await chromium.launch();
  for (const s of shows) for (const k of which) for (const fmt of ['feed', 'story']) {
    const story = fmt === 'story'; CUR = `${k}_${fmt}`;
    const p = await b.newPage({ viewport: { width: 1080, height: story ? 1920 : 1350 } });
    const hf = path.resolve(out, `${s.slug}_${k}_${fmt}.html`);
    fs.writeFileSync(hf, `<!doctype html><html><head><meta charset="utf-8"></head><body>${L[k](s, story)}<div class="grain"></div></body></html>`);
    await p.goto(pathToFileURL(hf).href, { waitUntil: 'load' }); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: hf.replace('.html', '.png') }); fs.unlinkSync(hf);
    console.log(path.basename(hf, '.html')); await p.close();
  }
  await b.close();
})();
