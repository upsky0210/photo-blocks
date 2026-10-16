import { averageCells, quantize, drawMosaic } from './mosaic.js';
import { PALETTES } from './palettes.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = { cols: 48, count: 16, palette: 'auto', grid: true, tab: 'figure', mode: 'bright', mult: 1, rotate: true };
try { Object.assign(state, JSON.parse(localStorage.getItem('photo-blocks') || '{}'), { tab: 'figure' }); } catch (e) {}
const save = () => { try { localStorage.setItem('photo-blocks', JSON.stringify(state)); } catch (e) {} };

let srcData = null;   // 縮小後的照片像素
let cells = null;     // 每格平均色（Lab）
let mosaic = null;    // 對應到調色盤後的結果
let imageId = 0;
let figureApp = null, figureSource = null, figurePromise = null;
let view = null, v3 = null, fitKey = '', dirty3d = true;

// ---------- 小工具 ----------
function busy(text) { $('#busyText').textContent = text; $('#busy').hidden = false; }
function done() { $('#busy').hidden = true; }
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const baseName = () => `照片方塊_${mosaic.cols}x${mosaic.rows}`;
const textColor = hex => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000' : '#fff';
};

// ---------- 讀照片 ----------
const MAX_SIDE = 768; // 先縮小，iPad 才不會記憶體不夠

function setSource(img, w, h) {
  const s = Math.min(1, MAX_SIDE / Math.max(w, h));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); // 透明背景當白色
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  srcData = ctx.getImageData(0, 0, cv.width, cv.height);
  figureSource = cv;
  $('#thumb').src = cv.toDataURL('image/jpeg', 0.8);
  cells = null; imageId++;
  $('#start').hidden = true; $('#work').hidden = false;
  recompute();
  setTab(state.tab);
  if (figureApp && state.tab !== 'figure') figureApp.setFigureSource(cv, imageId);
}

async function loadFile(file) {
  if (!file) return;
  if (file.type && !file.type.startsWith('image/')) { toast('這不是圖片檔，請選照片。'); return; }
  busy('讀取照片中…');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode(); // 瀏覽器會依照片 EXIF 自動轉正
    setSource(img, img.naturalWidth, img.naturalHeight);
  } catch (e) {
    console.error(e);
    alert('這個檔案沒辦法讀取，請換一張 JPG 或 PNG 照片試試。');
  } finally {
    URL.revokeObjectURL(url);
    done();
  }
}

// 範例圖：程式畫的風景（不含人物）
function sampleImage() {
  const W = 640, H = 480, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let g = c.createLinearGradient(0, 0, 0, H * 0.65);
  g.addColorStop(0, '#4f9ee8'); g.addColorStop(1, '#cfe9ff');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(520, 95, 52, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff';
  for (const [x, y, r] of [[120, 90, 30], [155, 80, 38], [195, 95, 28], [300, 60, 22], [330, 55, 28], [360, 64, 20]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#6c7a91';
  c.beginPath(); c.moveTo(0, 300); c.lineTo(150, 150); c.lineTo(260, 250); c.lineTo(380, 130); c.lineTo(560, 290); c.lineTo(W, 260); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  c.fillStyle = '#f5f7fa';
  c.beginPath(); c.moveTo(150, 150); c.lineTo(115, 185); c.lineTo(185, 185); c.fill();
  c.beginPath(); c.moveTo(380, 130); c.lineTo(335, 172); c.lineTo(425, 172); c.fill();
  g = c.createLinearGradient(0, 300, 0, H);
  g.addColorStop(0, '#7cc152'); g.addColorStop(1, '#3e8a2f');
  c.fillStyle = g; c.fillRect(0, 300, W, H - 300);
  c.fillStyle = '#3f6fd8';
  c.beginPath(); c.moveTo(250, 300); c.bezierCurveTo(300, 360, 180, 400, 260, H); c.lineTo(380, H); c.bezierCurveTo(300, 400, 400, 360, 300, 300); c.fill();
  for (const [x, y, s] of [[80, 360, 1], [150, 390, 1.3], [500, 370, 1.2], [580, 400, 0.9]]) {
    c.fillStyle = '#7a4b2a'; c.fillRect(x - 7 * s, y, 14 * s, 50 * s);
    c.fillStyle = '#2f6b2a'; c.beginPath(); c.arc(x, y, 34 * s, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#f2e3c4'; c.fillRect(430, 300, 90, 70);
  c.fillStyle = '#c8312a'; c.beginPath(); c.moveTo(418, 302); c.lineTo(475, 255); c.lineTo(532, 302); c.fill();
  c.fillStyle = '#7a4b2a'; c.fillRect(464, 330, 22, 40);
  return cv;
}

// ---------- 計算與畫面 ----------
let pending = false;
function recompute() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (!srcData) return;
    if (!cells || cells.cols !== state.cols) cells = averageCells(srcData, state.cols);
    mosaic = quantize(cells, state.palette, state.count);
    draw2D();
    renderInfo();
    renderStats();
    updatePrintLabel();
    dirty3d = true;
    if (state.tab === '3d') update3D();
  });
}

function draw2D() {
  if (!mosaic || state.tab !== '2d') return;
  const pane = $('#pane2d'), cv = $('#c2d');
  const dpr = window.devicePixelRatio || 1;
  const w = (pane.clientWidth - 28) * dpr, h = (pane.clientHeight - 28) * dpr;
  const cell = Math.max(1, Math.floor(Math.min(w / mosaic.cols, h / mosaic.rows)));
  cv.width = mosaic.cols * cell; cv.height = mosaic.rows * cell;
  cv.style.width = cv.width / dpr + 'px'; cv.style.height = cv.height / dpr + 'px';
  drawMosaic(cv.getContext('2d'), mosaic, cell, state.grid);
}

function renderInfo() {
  const { cols, rows, colors, paletteSize } = mosaic;
  let note = '';
  if (paletteSize < state.count) note = `（${PALETTES[state.palette].label}只有 ${paletteSize} 色）`;
  $('#info').innerHTML = `<b>寬 ${cols} 格 × 高 ${rows} 格 ＝ ${(cols * rows).toLocaleString()} 格</b>
    <span>用了 ${colors.length} 種顏色${note}</span><span class="note">比例 寬：高 ≈ ${ratio(cols, rows)}</span>`;
}
function ratio(a, b) {
  const gcd = (x, y) => (y ? gcd(y, x % y) : x);
  const g = gcd(a, b);
  return `${a / g}：${b / g}`;
}

function renderStats() {
  const { cols, rows, colors } = mosaic;
  const total = cols * rows, max = colors[0].count;
  const rowsHtml = colors.map(c => `<tr>
      <td><span class="sw" style="background:${c.hex};color:${textColor(c.hex)}">${c.num}</span></td>
      <td>${c.code}</td><td>${c.name}</td>
      <td class="n">${c.count.toLocaleString()} 格</td>
      <td class="n">${(c.count / total * 100).toFixed(1)}%</td>
      <td class="bars"><div class="bar" style="width:${(c.count / max * 100).toFixed(1)}%"></div></td></tr>`).join('');
  $('#paneStats').innerHTML = `<div class="stats-head"><h2>色塊統計：${PALETTES[state.palette].label}</h2>
    <span>寬 ${cols} × 高 ${rows} ＝ 共 ${total.toLocaleString()} 格</span></div>
    <table class="stats"><thead><tr><th>號碼</th><th>色號</th><th>顏色</th><th>格數</th><th>佔全部</th><th>多少</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr><td colspan="3">合計 ${colors.length} 色</td><td class="n">${total.toLocaleString()} 格</td><td class="n">100%</td><td></td></tr></tfoot></table>
    <p class="small">號碼就是 A4 施工圖格子裡標的數字。做拼豆時，每種顏色可以多準備一點備用。</p>`;
}

// ---------- 3D ----------
async function ensure3D() {
  if (view) return view;
  busy('準備 3D 中…');
  try {
    v3 = await import('./view3d.js');
    view = new v3.BlockView($('#pane3d'));
    view.setAutoRotate(state.rotate);
  } finally { done(); }
  return view;
}

function heights() { return v3.cellHeights(mosaic, state.mode, state.mult); }

function update3D() {
  if (!view || !mosaic) return;
  const key = `${imageId}/${mosaic.cols}x${mosaic.rows}`;
  view.update(mosaic, heights(), key !== fitKey);
  fitKey = key;
  dirty3d = false;
}

// ---------- 分頁 ----------
async function setTab(tab) {
  state.tab = tab;
  $$('.tabs button').forEach(b => { const selected = b.dataset.tab === tab; b.classList.toggle('on', selected); b.setAttribute('aria-selected', String(selected)); });
  $('#paneFigure').hidden = tab !== 'figure';
  $('#figurePanel').hidden = tab !== 'figure';
  document.body.classList.toggle('figure-active', tab === 'figure');
  $('#pane2d').hidden = tab !== '2d';
  $('#pane3d').hidden = tab !== '3d';
  $('#paneStats').hidden = tab !== 'stats';
  if (tab === '3d') {
    await ensure3D();
    view.resize();
    if (dirty3d) update3D();
    view.start();
  } else if (view) view.stop();
  if (figureApp) figureApp.showFigure(tab === 'figure');
  if (tab === 'figure') {
    try {
      figurePromise ||= import('./figure/app.js').then(m => { m.initFigure(); figureApp = m; return m; }).catch(e => { figurePromise = null; throw e; });
      const f = await figurePromise;
      f.showFigure(state.tab === 'figure');
      f.setFigureSource(figureSource, imageId);
    } catch(e) { console.error(e); toast('人偶畫面無法開啟，請確認裝置支援 WebGL，再重新點分頁。'); }
  }
  if (tab === '2d') draw2D();
}

// ---------- 匯出 ----------
function exportPNG(grid) {
  const cell = Math.min(32, Math.max(8, Math.floor(2048 / Math.max(mosaic.cols, mosaic.rows))));
  const cv = document.createElement('canvas');
  cv.width = mosaic.cols * cell; cv.height = mosaic.rows * cell;
  drawMosaic(cv.getContext('2d'), mosaic, cell, grid);
  cv.toBlob(b => download(b, `${baseName()}${grid ? '_格線' : ''}.png`), 'image/png');
}

async function export3D(kind) {
  if (!mosaic) return;
  if (!view) await ensure3D();
  busy('產生檔案中…');
  await nextFrame();
  try {
    if (kind === 'png') { if (dirty3d) update3D(); download(await view.screenshot(), `${baseName()}_3D.png`); }
    if (kind === 'glb') download(await v3.exportGLB(mosaic, heights()), `${baseName()}.glb`);
    if (kind === 'stl') download(await v3.exportSTL(mosaic, heights()), `${baseName()}.stl`);
    if (kind === 'usdz') download(await v3.exportUSDZ(mosaic, heights()), `${baseName()}.usdz`);
    if (kind === 'ar') {
      const a = $('#arLink');
      if (a.href) URL.revokeObjectURL(a.href);
      a.href = URL.createObjectURL(await v3.exportUSDZ(mosaic, heights()));
      a.hidden = false; $('#btnAR').hidden = true;
    }
  } catch (e) {
    console.error(e);
    alert('產生檔案時出了問題，可以把格數調少一點再試一次。');
  } finally { done(); }
}

// 作品一改，AR 連結就要重做
function resetAR() {
  const a = $('#arLink');
  if (a.hidden) return;
  a.hidden = true; $('#btnAR').hidden = false;
}

// ---------- A4 施工圖 ----------
const TILE_C = 30, TILE_R = 38;

function buildPrint() {
  const m = mosaic, { cols, rows, colors, idx } = m;
  const tx = Math.ceil(cols / TILE_C), ty = Math.ceil(rows / TILE_R);
  const pages = 1 + tx * ty;
  const today = new Date().toLocaleDateString('zh-TW');

  // 總覽圖：標出每一頁的範圍
  const cell = Math.max(4, Math.floor(1400 / Math.max(cols, rows)));
  const cv = document.createElement('canvas');
  cv.width = cols * cell; cv.height = rows * cell;
  const ctx = cv.getContext('2d');
  drawMosaic(ctx, m, cell, true);
  if (pages > 2) {
    ctx.lineWidth = Math.max(3, cell / 2); ctx.strokeStyle = '#e00';
    ctx.font = `bold ${Math.max(18, cell * 4)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let p = 2;
    for (let y = 0; y < ty; y++) for (let x = 0; x < tx; x++, p++) {
      const x0 = x * TILE_C * cell, y0 = y * TILE_R * cell;
      const w = Math.min(TILE_C, cols - x * TILE_C) * cell, h = Math.min(TILE_R, rows - y * TILE_R) * cell;
      ctx.strokeRect(x0, y0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      const s = Math.max(30, cell * 7);
      ctx.fillRect(x0 + w / 2 - s / 2, y0 + h / 2 - s / 2.6, s, s / 1.3);
      ctx.fillStyle = '#e00'; ctx.fillText('P' + p, x0 + w / 2, y0 + h / 2);
    }
  }

  const sw = c => `<span class="sw" style="background:${c.hex};color:${textColor(c.hex)}">${c.num}</span>`;
  let html = `<section class="pg"><h1>照片轉方塊 施工圖</h1>
    <div class="meta">寬 ${cols} 格 × 高 ${rows} 格 ＝ ${cols * rows} 格｜調色盤：${PALETTES[state.palette].label}｜${colors.length} 種顏色｜共 ${pages} 頁｜${today}</div>
    <img class="overview" src="${cv.toDataURL('image/png')}" alt="">
    <table class="legend"><thead><tr><th>號碼</th><th>色號</th><th>顏色</th><th>格數</th><th>號碼</th><th>色號</th><th>顏色</th><th>格數</th></tr></thead><tbody>`;
  const half = Math.ceil(colors.length / 2);
  for (let i = 0; i < half; i++) {
    const a = colors[i], b = colors[i + half];
    html += `<tr><td>${sw(a)}</td><td>${a.code}</td><td>${a.name}</td><td class="n">${a.count}</td>` +
      (b ? `<td>${sw(b)}</td><td>${b.code}</td><td>${b.name}</td><td class="n">${b.count}</td>` : '<td></td><td></td><td></td><td></td>') + '</tr>';
  }
  html += `</tbody></table><div class="pfoot">格子裡的數字＝號碼。拼豆色、積木色的色號是本工具自訂編號，顏色請對照實物。照片轉方塊｜設計 Upsky（阿喵老師）</div></section>`;

  let p = 2;
  for (let y = 0; y < ty; y++) for (let x = 0; x < tx; x++, p++) {
    const c0 = x * TILE_C, c1 = Math.min(cols, c0 + TILE_C), r0 = y * TILE_R, r1 = Math.min(rows, r0 + TILE_R);
    const used = new Set();
    let g = `<div class="lab"></div>`;
    for (let c = c0; c < c1; c++) g += `<div class="lab${(c + 1) % 10 === 0 ? ' tr' : ''}">${c + 1}</div>`;
    for (let r = r0; r < r1; r++) {
      const tb = (r + 1) % 10 === 0 ? ' tb' : '';
      g += `<div class="lab${tb}">${r + 1}</div>`;
      for (let c = c0; c < c1; c++) {
        const col = colors[idx[r * cols + c]];
        used.add(col);
        const cls = ((c + 1) % 10 === 0 ? ' tr' : '') + tb;
        g += `<div class="${cls.trim()}" style="background:${col.hex};color:${textColor(col.hex)}">${col.num}</div>`;
      }
    }
    const leg = [...used].sort((a, b) => a.num - b.num)
      .map(c => `<span><i style="background:${c.hex};color:${textColor(c.hex)}">${c.num}</i>${c.code} ${c.name}</span>`).join('');
    html += `<section class="pg"><h3><span>P${p}／共 ${pages} 頁</span><span>第 ${c0 + 1}–${c1} 欄、第 ${r0 + 1}–${r1} 列</span></h3>
      <div class="chart" style="grid-template-columns:7mm repeat(${c1 - c0},6mm)">${g}</div>
      <div class="minileg">${leg}</div></section>`;
  }
  $('#print-area').innerHTML = html;
  return pages;
}

async function doPrint() {
  if (!mosaic) return;
  busy('準備施工圖中…');
  await nextFrame();
  const pages = buildPrint();
  done();
  toast(`施工圖共 ${pages} 頁（第 1 頁是總覽和色號表）`);
  // 等總覽圖載入好再印
  const img = $('#print-area img');
  if (img && !img.complete) await new Promise(r => { img.onload = img.onerror = r; });
  await nextFrame();
  window.print();
}
window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });

// ---------- 介面 ----------
function syncControls() {
  $('#cols').value = state.cols; $('#colsOut').textContent = state.cols;
  $('#mult').value = state.mult; $('#multOut').textContent = state.mult + ' 倍';
  $$('#countSeg button').forEach(b => b.classList.toggle('on', +b.dataset.v === state.count));
  $$('#palSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.palette));
  $$('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === state.mode));
  $('#gridT').setAttribute('aria-pressed', state.grid);
  $('#rotT').setAttribute('aria-pressed', state.rotate);
  $('#mult').disabled = state.mode === 'flat';
  updatePrintLabel();
}
function updatePrintLabel() {
  if (!mosaic) return;
  const pages = 1 + Math.ceil(mosaic.cols / TILE_C) * Math.ceil(mosaic.rows / TILE_R);
  $('#btnPrint').textContent = `🖨️ 列印 A4 施工圖（${pages} 頁）`;
}
function changed() { save(); syncControls(); resetAR(); recompute(); }

$('#cols').addEventListener('input', e => { state.cols = +e.target.value; changed(); });
$('#mult').addEventListener('input', e => { state.mult = +e.target.value; changed(); });
$('#countSeg').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) { state.count = +v; changed(); } });
$('#palSeg').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) { state.palette = v; changed(); } });
$('#modeSeg').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (v) { state.mode = v; changed(); } });
$('#gridT').addEventListener('click', () => { state.grid = !state.grid; save(); syncControls(); draw2D(); });
$('#rotT').addEventListener('click', () => { state.rotate = !state.rotate; save(); syncControls(); view?.setAutoRotate(state.rotate); });
$('#btnReset').addEventListener('click', async () => { if (state.tab !== '3d') await setTab('3d'); view.resetView(); });
$$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

$('#dlGrid').addEventListener('click', () => exportPNG(true));
$('#dlPlain').addEventListener('click', () => exportPNG(false));
$('#btnPrint').addEventListener('click', doPrint);
$('#dlShot').addEventListener('click', async () => { if (state.tab !== '3d') await setTab('3d'); export3D('png'); });
$('#dlGLB').addEventListener('click', () => export3D('glb'));
$('#dlSTL').addEventListener('click', () => export3D('stl'));
$('#dlUSDZ').addEventListener('click', () => export3D('usdz'));
$('#btnAR').addEventListener('click', () => export3D('ar'));

// iPad／iPhone 的 Safari 支援 AR Quick Look
const arOK = document.createElement('a').relList.supports?.('ar');
if (arOK) { $('#btnAR').hidden = false; }

// 選照片／拍照
const pick = id => () => { const i = $(id); i.value = ''; i.click(); };
$('#btnCamera').addEventListener('click', pick('#fileCamera'));
$('#btnCamera2').addEventListener('click', pick('#fileCamera'));
$('#btnPick').addEventListener('click', pick('#filePick'));
$('#btnPick2').addEventListener('click', pick('#filePick'));
$('#fileCamera').addEventListener('change', e => loadFile(e.target.files[0]));
$('#filePick').addEventListener('change', e => loadFile(e.target.files[0]));
$('#btnSample').addEventListener('click', () => { const cv = sampleImage(); setSource(cv, cv.width, cv.height); });

// 拖曳、貼上
const drop = $('#drop');
window.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
window.addEventListener('dragleave', e => { if (!e.relatedTarget) drop.classList.remove('over'); });
window.addEventListener('drop', e => {
  e.preventDefault(); drop.classList.remove('over');
  const f = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
  if (f) loadFile(f); else toast('請拖曳圖片檔進來。');
});
window.addEventListener('paste', e => {
  const f = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
  if (f) loadFile(f);
});

let resizeT;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(draw2D, 120); });

syncControls();
// 測試用
window.__pb = { state, get figure() { return figureApp?.inspectFigure(); }, get mosaic() { return mosaic; }, setSource, sampleImage, buildPrint };
