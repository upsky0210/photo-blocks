// 把照片切成格子、每格取平均色，再對應到調色盤（Lab 色彩空間比對）
import { SRGB_TO_LIN, linToLab, labToRgb, rgbToLab, hexToRgb, rgbToHex, kmeans } from './color.js';
import { PALETTES } from './palettes.js';

// src: ImageData。回傳 { cols, rows, labs: Float32Array }
export function averageCells(src, cols) {
  const W = src.width, H = src.height, d = src.data;
  const rows = Math.max(1, Math.round(cols * H / W));
  const labs = new Float32Array(cols * rows * 3);
  for (let cy = 0; cy < rows; cy++) {
    const y0 = Math.floor(cy * H / rows), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * H / rows));
    for (let cx = 0; cx < cols; cx++) {
      const x0 = Math.floor(cx * W / cols), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * W / cols));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1 && y < H; y++) {
        let p = (y * W + x0) * 4;
        for (let x = x0; x < x1 && x < W; x++, p += 4) {
          r += SRGB_TO_LIN[d[p]]; g += SRGB_TO_LIN[d[p + 1]]; b += SRGB_TO_LIN[d[p + 2]]; n++;
        }
      }
      const lab = linToLab(r / n, g / n, b / n);
      const o = (cy * cols + cx) * 3;
      labs[o] = lab[0]; labs[o + 1] = lab[1]; labs[o + 2] = lab[2];
    }
  }
  return { cols, rows, labs };
}

function nearestAssign(labs, pal, out) {
  const n = labs.length / 3;
  for (let i = 0; i < n; i++) {
    const l = labs[i * 3], a = labs[i * 3 + 1], b = labs[i * 3 + 2];
    let best = 0, bd = Infinity;
    for (let j = 0; j < pal.length; j++) {
      const c = pal[j].lab;
      const dd = (l - c[0]) ** 2 + (a - c[1]) ** 2 + (b - c[2]) ** 2;
      if (dd < bd) { bd = dd; best = j; }
    }
    out[i] = best;
  }
  return out;
}

function buildPalette(key, labs, count) {
  if (key === 'auto') {
    const centers = kmeans(labs, count);
    return centers.map((c, i) => {
      const rgb = labToRgb(c[0], c[1], c[2]);
      return { code: '', name: '', hex: rgbToHex(rgb), rgb, lab: rgbToLab(...rgb) };
    });
  }
  if (key === 'gray') {
    // 灰階平均分在照片最暗到最亮之間，選幾色就真的用到幾色
    let lo = 100, hi = 0;
    for (let i = 0; i < labs.length; i += 3) { if (labs[i] < lo) lo = labs[i]; if (labs[i] > hi) hi = labs[i]; }
    if (hi - lo < 1) { lo = Math.max(0, lo - 1); hi = Math.min(100, hi + 1); }
    const out = [];
    for (let i = 0; i < count; i++) {
      const L = lo + (i / (count - 1)) * (hi - lo);
      const rgb = labToRgb(L, 0, 0);
      out.push({ code: 'G' + String(i + 1).padStart(2, '0'), name: `灰 ${Math.round(L)}%`, hex: rgbToHex(rgb), rgb, lab: [L, 0, 0] });
    }
    return out;
  }
  let pal = PALETTES[key].colors.map(c => {
    const rgb = hexToRgb(c.hex);
    return { ...c, rgb, lab: rgbToLab(...rgb) };
  });
  // 調色盤顏色比要求的多：每次拿掉用最少的顏色，直到剩下 count 色
  const idx = new Uint16Array(labs.length / 3);
  while (pal.length > count) {
    nearestAssign(labs, pal, idx);
    const cnt = new Int32Array(pal.length);
    for (const i of idx) cnt[i]++;
    let worst = 0;
    for (let j = 1; j < pal.length; j++) if (cnt[j] < cnt[worst]) worst = j;
    pal = pal.filter((_, j) => j !== worst);
  }
  return pal;
}

// 回傳 { cols, rows, idx: Uint16Array, colors: [{num, code, name, hex, rgb, lab, count}] }
// colors 依用量多到少排序，num 從 1 開始（施工圖上標的號碼）
export function quantize(cells, paletteKey, count) {
  const { cols, rows, labs } = cells;
  const pal = buildPalette(paletteKey, labs, count);
  const raw = nearestAssign(labs, pal, new Uint16Array(cols * rows));
  const cnt = new Int32Array(pal.length);
  for (const i of raw) cnt[i]++;
  const order = pal.map((_, j) => j).filter(j => cnt[j] > 0).sort((a, b) => cnt[b] - cnt[a]);
  const remap = new Int32Array(pal.length).fill(-1);
  const colors = order.map((j, k) => {
    remap[j] = k;
    const c = pal[j];
    return { ...c, num: k + 1, count: cnt[j], code: c.code || ('A' + String(k + 1).padStart(2, '0')), name: c.name || '自動色 ' + (k + 1) };
  });
  const idx = new Uint16Array(raw.length);
  for (let i = 0; i < raw.length; i++) idx[i] = remap[raw[i]];
  return { cols, rows, idx, colors, paletteKey, paletteSize: pal.length };
}

// 把馬賽克畫到 canvas 上。cell: 每格幾像素；grid: 畫格線（每 10 格粗線）
export function drawMosaic(ctx, m, cell, grid, ox = 0, oy = 0) {
  const { cols, rows, idx, colors } = m;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = colors[idx[y * cols + x]].hex;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  }
  if (!grid || cell < 3) return;
  const W = cols * cell, H = rows * cell;
  const thin = Math.max(1, Math.round(cell / 16)), thick = thin * 2 + 1;
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let x = 0; x <= cols; x++) if (x % 10) ctx.fillRect(ox + x * cell - thin / 2, oy, thin, H);
  for (let y = 0; y <= rows; y++) if (y % 10) ctx.fillRect(ox, oy + y * cell - thin / 2, W, thin);
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  for (let x = 0; x <= cols; x += 10) ctx.fillRect(ox + Math.min(x * cell, W - thick / 2) - thick / 2, oy, thick, H);
  for (let y = 0; y <= rows; y += 10) ctx.fillRect(ox, oy + Math.min(y * cell, H - thick / 2) - thick / 2, W, thick);
  if (cols % 10) ctx.fillRect(ox + W - thick, oy, thick, H);
  if (rows % 10) ctx.fillRect(ox, oy + H - thick, W, thick);
}
