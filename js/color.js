// 色彩工具：sRGB ↔ 線性 RGB ↔ Lab（D65），以及 k-means 自動取色

export const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linToSrgb8(v) {
  v = Math.min(1, Math.max(0, v));
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(c * 255);
}

const XN = 0.95047, YN = 1.0, ZN = 1.08883;
const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fInv = t => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);

// 線性 RGB（0~1）→ Lab
export function linToLab(r, g, b) {
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / XN;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / YN;
  const z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / ZN;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function rgbToLab(r, g, b) {
  return linToLab(SRGB_TO_LIN[r], SRGB_TO_LIN[g], SRGB_TO_LIN[b]);
}

export function labToRgb(L, a, bb) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - bb / 200;
  const x = fInv(fx) * XN, y = fInv(fy) * YN, z = fInv(fz) * ZN;
  const r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  const g = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  const b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;
  return [linToSrgb8(r), linToSrgb8(g), linToSrgb8(b)];
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// 固定亂數種子，讓同一張照片每次取色結果一樣
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// labs: Float32Array（每 3 個一組），回傳 k 個 Lab 中心
export function kmeans(labs, k, iters = 12) {
  const n = labs.length / 3;
  if (n === 0) return [];
  k = Math.min(k, n);
  const rand = mulberry32(20261016);
  const centers = [];
  // k-means++ 初始化
  let idx = Math.floor(rand() * n);
  centers.push([labs[idx * 3], labs[idx * 3 + 1], labs[idx * 3 + 2]]);
  const d2 = new Float32Array(n).fill(Infinity);
  while (centers.length < k) {
    const c = centers[centers.length - 1];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const dl = labs[i * 3] - c[0], da = labs[i * 3 + 1] - c[1], db = labs[i * 3 + 2] - c[2];
      const d = dl * dl + da * da + db * db;
      if (d < d2[i]) d2[i] = d;
      sum += d2[i];
    }
    if (sum === 0) break; // 顏色比 k 還少
    let r = rand() * sum;
    idx = n - 1;
    for (let i = 0; i < n; i++) { r -= d2[i]; if (r <= 0) { idx = i; break; } }
    centers.push([labs[idx * 3], labs[idx * 3 + 1], labs[idx * 3 + 2]]);
  }
  const assign = new Int32Array(n);
  for (let it = 0; it < iters; it++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    let moved = false;
    for (let i = 0; i < n; i++) {
      const l = labs[i * 3], a = labs[i * 3 + 1], b = labs[i * 3 + 2];
      let best = 0, bd = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const c = centers[j];
        const d = (l - c[0]) ** 2 + (a - c[1]) ** 2 + (b - c[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      if (assign[i] !== best) { assign[i] = best; moved = true; }
      const s = sums[best]; s[0] += l; s[1] += a; s[2] += b; s[3]++;
    }
    for (let j = 0; j < centers.length; j++) {
      const s = sums[j];
      if (s[3]) centers[j] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    }
    if (!moved && it > 0) break;
  }
  return centers;
}
