// 從 xikou-3d-campus 的 js/blocks.js（commit 8cf2eb3）複製並改為獨立方塊風。
import * as THREE from "three";
const BLOCKY = true;
function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shade = (hex, k) => {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return `#${c.getHexString()}`;
};

const S = 64;   // 每格 1 公尺 = 64 像素
function canvasTex(draw, seed = 1, size = S, { smooth = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, rng(seed), size);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = smooth ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
// 柔和的斑駁感：在底色上畫很多半透明小方塊（會繞到另一邊，所以貼起來沒有接縫）
function mottle(c, r, base, { n = 260, amt = 0.06, min = 3, max = 9, alpha = 0.35 } = {}) {
  c.fillStyle = base; c.fillRect(0, 0, S, S);
  c.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    c.fillStyle = shade(base, 1 - amt + r() * amt * 2);
    const w = min + r() * (max - min), x = r() * S, y = r() * S;
    for (const [dx, dy] of [[0, 0], [-S, 0], [0, -S], [-S, -S]]) c.fillRect(x + dx, y + dy, w, w);
  }
  c.globalAlpha = 1;
}


let wool;
function tex() { return wool ||= canvasTex((c,r) => mottle(c,r,"#f2f2f2",{amt:0.04,n:220})); }
export function makeBlockNPC(look) {
  const g = new THREE.Group();
  const cloth = (color) => new THREE.MeshLambertMaterial({ map: BLOCKY ? tex('wool') : null, color });
  const skin = new THREE.MeshLambertMaterial({ color: look.skin });
  const top = cloth(look.top), pants = cloth(look.pants);
  const shoe = new THREE.MeshLambertMaterial({ color: look.shoe });
  const px = (draw) => canvasTex((c) => draw(c), 1, 16, { smooth: false });
  // 表情（參考學生美勞作品「方塊人像」）：從原本的臉自動找出眼睛、嘴巴再改畫，各表情的貼圖用到才做
  const drawFace = faceDrawer(look), faces = {};
  const faceTex = (ex) => (faces[ex] ||= px((c) => drawFace(c, ex)));
  const faceMat = new THREE.MeshLambertMaterial({ map: faceTex('normal') });
  const hair = new THREE.MeshLambertMaterial({ map: px((c) => {
    c.fillStyle = look.hair; c.fillRect(0, 0, 16, 16);
    c.fillStyle = look.pal.h || look.hair;
    if (look.patches) for (const [col, x, y, w, h] of look.patches) { c.fillStyle = col; c.fillRect(x, y, w, h); }   // 三花色塊
    else if (look.cat) for (const y of [1, 5, 9, 13]) c.fillRect(0, y, 16, 2);   // 虎斑條紋
    else { c.fillRect(2, 2, 4, 1); c.fillRect(9, 6, 4, 1); c.fillRect(4, 11, 3, 1); }
  }) });

  const box = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const pivot = (x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); return p; };

  // 短髮：側面露出耳朵、後腦下方露出脖子
  const side = !look.shortHair ? hair : new THREE.MeshLambertMaterial({ map: px((c) => {
    c.fillStyle = look.skin; c.fillRect(0, 0, 16, 16);
    c.fillStyle = look.hair; c.fillRect(0, 0, 16, 5); c.fillRect(0, 5, 5, 3);
    c.fillStyle = look.pal.N || look.skin; c.fillRect(8, 7, 3, 4);           // 耳朵
  }) });
  const back = !look.shortHair ? hair : new THREE.MeshLambertMaterial({ map: px((c) => {
    c.fillStyle = look.skin; c.fillRect(0, 0, 16, 16);
    c.fillStyle = look.hair; c.fillRect(0, 0, 16, 12);
  }) });
  // 頭（含耳朵、鬍鬚、刺刺頭）放在脖子位置的群組裡，headScale 可以把頭放大
  const NECK = 1.32, hg = new THREE.Group();
  hg.position.set(0, NECK, 0); hg.scale.setScalar(look.headScale || 1); g.add(hg);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), [side, side, hair, skin, back, faceMat]);
  head.position.set(0, 1.55 - NECK, 0); head.castShadow = true; hg.add(head);
  if (look.cat) {                                            // 貓耳朵（內側粉紅）＋ 鬍鬚
    [-1, 1].forEach((sx, i) => {
      const ear = look.ears ? new THREE.MeshLambertMaterial({ color: look.ears[i] }) : hair;
      box(hg, 0.13, 0.15, 0.08, ear, sx * 0.15, 1.85 - NECK, -0.06);
      box(hg, 0.07, 0.09, 0.01, new THREE.MeshLambertMaterial({ color: '#f2a7b8' }), sx * 0.15, 1.84 - NECK, -0.105);
      for (const [y, r] of [[1.44, 0.12], [1.41, -0.08]]) {
        const w = box(hg, 0.2, 0.012, 0.012, new THREE.MeshLambertMaterial({ color: look.whisker || '#f5f5f5' }), sx * 0.27, y - NECK, -0.236);
        w.rotation.z = sx * r; w.castShadow = false;
      }
    });
  }
  if (look.spiky) {                                          // 刺刺的短髮
    for (const [x, z, h] of [[-0.14, -0.12, 0.06], [0.02, -0.16, 0.08], [0.15, -0.08, 0.05], [-0.06, 0.05, 0.07], [0.1, 0.12, 0.05]]) box(hg, 0.12, h, 0.12, hair, x, 1.78 - NECK + h / 2, z);
  }
  if (look.beret) {                                         // 貝雷帽：歪一邊、前面有字母 H
    const bm = cloth(look.beret.color), lm = new THREE.MeshLambertMaterial({ color: look.beret.letter });
    const bg = new THREE.Group(); bg.position.set(0.04, 1.8 - NECK, 0); bg.rotation.z = -0.18; hg.add(bg);
    box(bg, 0.5, 0.07, 0.48, bm, 0, 0, 0);
    box(bg, 0.42, 0.06, 0.4, bm, 0.02, 0.06, 0);
    box(bg, 0.05, 0.05, 0.05, bm, 0.02, 0.11, 0);              // 帽頂小蒂頭
    for (const [w, h, x, y] of [[0.022, 0.09, -0.04, 0.03], [0.022, 0.09, 0.04, 0.03], [0.06, 0.02, 0, 0.03]]) box(bg, w, h, 0.01, lm, x, y, -0.245).castShadow = false;
  }
  if (look.cap) {                                           // 棒球帽：帽身、往前伸的帽簷、前面的勾勾標誌、頂上小鈕扣
    const cm = cloth(look.cap.color), lm = new THREE.MeshLambertMaterial({ color: look.cap.logo || '#ffffff' });
    box(hg, 0.5, 0.17, 0.5, cm, 0, 1.79 - NECK, 0.01);
    box(hg, 0.44, 0.12, 0.44, cm, 0, 1.9 - NECK, 0.02);
    box(hg, 0.46, 0.035, 0.24, cm, 0, 1.715 - NECK, -0.33);     // 帽簷
    box(hg, 0.05, 0.03, 0.05, cm, 0, 1.97 - NECK, 0.02);
    const sw = box(hg, 0.15, 0.03, 0.01, lm, 0.01, 1.8 - NECK, -0.252); sw.rotation.z = 0.35; sw.castShadow = false;   // 勾勾
    box(hg, 0.05, 0.03, 0.01, lm, -0.07, 1.785 - NECK, -0.252).castShadow = false;
  }
  if (look.longHair) {
    box(g, 0.5, 0.86, 0.1, hair, 0, 1.36, 0.25);            // 背後長髮
    box(g, 0.08, 0.5, 0.42, hair, -0.255, 1.4, 0.02);       // 兩側
    box(g, 0.08, 0.5, 0.42, hair, 0.255, 1.4, 0.02);
    box(g, 0.1, 0.5, 0.06, hair, -0.19, 1.14, -0.16);       // 披到胸前的兩撮
    box(g, 0.1, 0.42, 0.06, hair, 0.19, 1.18, -0.16);
  }
  if (look.bun) {                                           // 往後綁的低髮髻＋臉旁兩撮
    box(g, 0.22, 0.2, 0.14, hair, 0, 1.42, 0.29);
    box(g, 0.14, 0.12, 0.06, hair, 0, 1.43, 0.38);
    box(g, 0.04, 0.24, 0.04, hair, -0.215, 1.42, -0.19);
    box(g, 0.04, 0.2, 0.04, hair, 0.215, 1.44, -0.19);
  }

  box(g, 0.46, 0.6, 0.26, top, 0, 1.0, 0);                  // 上衣
  box(g, 0.2, 0.05, 0.27, cloth(look.collar || look.top), 0, 1.3, 0);   // 領子
  if (look.collar) box(g, 0.1, 0.12, 0.02, cloth(look.collar), 0, 1.24, -0.13);   // 領口露出的襯衫
  if (look.tie) {                                           // 領帶
    box(g, 0.07, 0.06, 0.02, cloth(look.tie), 0, 1.22, -0.14);
    box(g, 0.06, 0.24, 0.015, cloth(look.tie), 0, 1.07, -0.137);
  }
  if (look.buttons) for (const y of [0.92, 0.78]) box(g, 0.04, 0.04, 0.015, new THREE.MeshLambertMaterial({ color: look.buttons, emissive: '#5a4300' }), 0.09, y, -0.137);
  if (look.badge) look.badge.forEach((c, i) => box(g, 0.1, 0.018, 0.012, cloth(c), 0.13, 1.16 - i * 0.018, -0.136));   // 胸章
  if (look.hoodie) {                                        // 連帽 T：背後的帽子、白色抽繩、前面大口袋
    box(g, 0.4, 0.2, 0.1, top, 0, 1.25, 0.17);
    for (const x of [-0.06, 0.06]) box(g, 0.02, 0.16, 0.012, cloth(look.hoodie), x, 1.18, -0.136);
    box(g, 0.3, 0.13, 0.015, cloth(look.pocket || '#a8161f'), 0, 0.8, -0.137);
  }
  if (look.zip) box(g, 0.02, 0.5, 0.01, cloth(look.zip), 0, 1.0, -0.135);          // 外套拉鍊
  if (look.lanyard) {                                       // 識別證：掛繩斜斜到胸前、白色卡片
    for (const sd of [-1, 1]) { const b = box(g, 0.03, 0.3, 0.012, cloth(look.lanyard), sd * 0.075, 1.15, -0.136); b.rotation.z = sd * 0.25; }
    box(g, 0.14, 0.17, 0.014, new THREE.MeshLambertMaterial({ color: '#ffffff' }), 0, 0.93, -0.14);
    box(g, 0.14, 0.04, 0.016, cloth(look.lanyard), 0, 0.995, -0.14);
  }
  if (look.beanie) {                                        // 毛線帽：帽身＋反折帽緣＋頂端毛球
    const bm = cloth(look.beanie);
    box(hg, 0.5, 0.16, 0.5, bm, 0, 1.84 - NECK, 0);
    box(hg, 0.52, 0.08, 0.52, cloth(look.beanieCuff || look.beanie), 0, 1.76 - NECK, 0);
    box(hg, 0.14, 0.12, 0.14, bm, 0, 1.97 - NECK, 0);
  }
  if (look.scarf) {                                         // 圍巾：繞脖子一圈，兩端垂在胸前
    const [a, b2] = look.scarf.map((c) => cloth(c));
    box(g, 0.5, 0.11, 0.32, a, 0, 1.31, 0);
    box(g, 0.11, 0.42, 0.03, b2, -0.11, 1.08, -0.15); box(g, 0.1, 0.36, 0.03, a, 0.1, 1.11, -0.152);
    box(g, 0.08, 0.06, 0.032, a, -0.11, 1.0, -0.153);                 // 米白那端上的紅色蝴蝶結
  }
  if (look.bag) {                                           // 斜背包：背帶從右肩斜到左腰，小包包在腰側
    const strap = box(g, 0.03, 0.66, 0.015, cloth(look.bag), 0.02, 1.03, -0.14); strap.rotation.z = -0.62;
    box(g, 0.22, 0.17, 0.09, cloth(look.bag), -0.2, 0.76, -0.12);
  }
  if (look.skirt) {
    const h = look.shortSkirt ? 0.32 : 0.62;
    const skirt = box(g, 0.5, h, 0.3, cloth(look.skirt), 0, 0.73 - h / 2, 0);
    skirt.name = look.shortSkirt ? '短裙' : '長裙';
  }
  if (look.whistle) {
    box(g, 0.02, 0.2, 0.01, cloth('#1e88e5'), -0.06, 1.2, -0.135);   // 掛繩
    box(g, 0.02, 0.2, 0.01, cloth('#1e88e5'), 0.06, 1.2, -0.135);
    box(g, 0.08, 0.05, 0.05, new THREE.MeshLambertMaterial({ color: '#d8dde3', emissive: '#555' }), 0, 1.09, -0.15);   // 哨子
  }

  const arm = (side) => {
    const p = pivot(side * 0.33, 1.3);
    if (look.longSleeve) {
      box(p, 0.19, 0.58, 0.21, look.sleeve ? cloth(look.sleeve) : top, 0, -0.29, 0);   // sleeve：背心底下的外套袖子
      box(p, 0.16, 0.1, 0.18, skin, 0, -0.63, 0);
    } else {
      if (look.sleeveless) box(p, 0.17, 0.68, 0.18, skin, 0, -0.34, 0);   // 無袖：整條手臂
      else {
        box(p, 0.2, 0.22, 0.22, top, 0, -0.11, 0);
        box(p, 0.16, 0.46, 0.18, skin, 0, -0.45, 0);
      }
    }
    return p;
  };
  const armL = arm(-1), armR = arm(1);
  // 手上拿的東西（holdL 左手、holdR 右手）：直笛、羽球拍、羽毛球
  const holdItem = (armP, kind) => {
    const rg = new THREE.Group(); armP.add(rg);
    const M = (color) => new THREE.MeshLambertMaterial({ color });
    if (kind === 'recorder') {                              // 白色直笛（斜斜往上）
      rg.position.set(0, -0.6, -0.16); rg.rotation.set(0.25, 0, -0.7);
      const wm = M('#f6f1e8'), hm = M('#2b2b2b');
      box(rg, 0.05, 0.56, 0.05, wm, 0, 0.12, 0);
      box(rg, 0.065, 0.05, 0.065, wm, 0, 0.36, 0);             // 吹嘴那一節
      box(rg, 0.065, 0.04, 0.065, wm, 0, -0.14, 0);            // 尾端
      for (let k = 0; k < 5; k++) box(rg, 0.022, 0.022, 0.01, hm, 0, 0.26 - k * 0.07, -0.027).castShadow = false;
    } else if (kind === 'racket') {                         // 黑色羽球拍（直直立起來）
      rg.position.set(0, -0.64, -0.12); rg.rotation.set(-0.5, 0, 0); rg.add(makeRacket());
    } else if (kind === 'brush') {                          // 水彩筆（木頭筆桿、銀色筆箍、沾了顏料的筆毛）
      rg.position.set(0, -0.64, -0.1); rg.rotation.set(-0.7, 0, 0);
      box(rg, 0.025, 0.3, 0.025, M('#c98b4a'), 0, 0.08, 0);
      box(rg, 0.03, 0.05, 0.03, M('#c9cdd1'), 0, 0.25, 0);
      box(rg, 0.035, 0.07, 0.035, M('#e53935'), 0, 0.31, 0);
    } else if (kind === 'shuttle') {                        // 羽毛球（球頭朝上）
      rg.position.set(0, -0.7, -0.08); rg.add(makeShuttle());
    }
  };
  if (look.holdL) holdItem(armL, look.holdL);
  if (look.holdR) holdItem(armR, look.holdR);


  box(g, 0.47, 0.12, 0.27, pants, 0, 0.72, 0);
  const leg = (side) => {
    const p = pivot(side * 0.12, 0.7);
    // 短褲和裙子底下露出腿；不再讓長褲穿出短裙。
    box(p, 0.19, 0.58, 0.2, skin, 0, -0.29, 0).name = '腿';
    if (!look.skirt) {
      const h = look.shorts ? 0.28 : 0.58;
      box(p, 0.21, h, 0.22, pants, 0, -h / 2, 0).name = look.shorts ? '短褲' : '長褲';
    }
    if (look.stripe) box(p, 0.02, 0.58, 0.06, cloth(look.stripe), side * 0.11, -0.29, 0);   // 運動褲側條
    box(p, 0.21, 0.09, 0.27, shoe, 0, -0.62, -0.03);
    return p;
  };
  const legL = leg(-1), legR = leg(1);

  if (look.cat) {                                            // 尾巴：從背後往上翹（會擺動）
    const tail = new THREE.Group(); tail.position.set(0, 0.78, 0.13); g.add(tail);
    box(tail, 0.08, 0.08, 0.36, hair, 0, 0.06, 0.16).rotation.x = -0.35;
    box(tail, 0.08, 0.3, 0.08, hair, 0, 0.26, 0.33);
    box(tail, 0.085, 0.08, 0.085, cloth(look.pal.h), 0, 0.42, 0.33);
    g.userData.tail = tail;
  }

  g.userData.limbs = { armL, armR, legL, legR };
  g.userData.setFace = (ex) => { const m = faceTex(NPC_FACES.includes(ex) ? ex : 'normal'); if (faceMat.map !== m) faceMat.map = m; };
  g.userData.disposeFaces = () => { Object.values(faces).forEach(t => t.dispose()); };
  return g;
}

// NPC 的表情：平常、眨眼、開心笑、眨眼吐舌、驚訝、難過、想睡、吐舌頭
export const NPC_FACES = ['normal', 'blink', 'happy', 'wink', 'surprised', 'sad', 'sleepy', 'tongue'];
export function faceDrawer(look) {
  const rows = look.face, pal = look.pal;
  const skin = look.cat ? 'W' : 'S', eyeCh = look.cat ? 'Ep' : 'EWep', eyeBg = look.cat ? 'L' : skin;
  // 找出符合條件的像素範圍（左眼、右眼、嘴巴）
  const box = (test) => {
    let b = null;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      if (!test(ch, x, y)) return;
      b ||= { x0: x, x1: x, y0: y, y1: y };
      b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.y0 = Math.min(b.y0, y); b.y1 = Math.max(b.y1, y);
    }));
    return b;
  };
  const eyes = [box((ch, x) => x < 8 && eyeCh.includes(ch)), box((ch, x) => x >= 8 && eyeCh.includes(ch))];
  const mouth = box((ch, x, y) => y >= 9 && 'MT'.includes(ch));
  const dark = pal.E || '#222222', mc = pal.M || dark, tongue = '#e8607a', inside = '#5a1e22';
  return (c, ex) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); }));
    const dot = (col, x, y, w = 1, h = 1) => { if (w > 0 && h > 0) { c.fillStyle = col; c.fillRect(x, y, w, h); } };
    const W = (b) => b.x1 - b.x0 + 1, H = (b) => b.y1 - b.y0 + 1;
    const clear = (b, bg) => dot(pal[bg], b.x0, b.y0, W(b), H(b));
    // 眼睛
    const closed = (b, low) => { if (!b) return; clear(b, eyeBg); dot(dark, b.x0, low ? b.y1 : b.y0 + (H(b) >> 1), W(b), 1); };   // 閉眼：一條線
    const arch = (b) => {                                                  // 笑瞇瞇：∩
      if (!b) return;
      clear(b, eyeBg);
      const y = b.y0 + (H(b) >= 3 ? 1 : 0);
      dot(dark, b.x0, y, W(b), 1); dot(dark, b.x0 - 1, y + 1); dot(dark, b.x1 + 1, y + 1);
    };
    // 嘴巴
    const m = mouth;
    const mw = m ? W(m) : 0, cx = m ? m.x0 + ((mw - 2) >> 1) : 0;
    const grin = () => {                                                   // 張嘴大笑
      clear(m, skin);
      dot(mc, m.x0, m.y0, mw, 1);
      dot(mc, m.x0, m.y0 + 1, mw, 1); dot(inside, m.x0 + 1, m.y0 + 1, mw - 2, 1); dot(tongue, cx, m.y0 + 1, 2, 1);
      dot(mc, m.x0 + 1, m.y0 + 2, mw - 2, 1);
    };
    const oh = () => {                                                     // 驚訝：O
      clear(m, skin);
      const sz = mw >= 4 ? 3 : 2, ox = m.x0 + ((mw - sz) >> 1);
      dot(mc, ox, m.y0, sz, sz); if (sz === 3) dot(inside, ox + 1, m.y0 + 1);
    };
    const frown = () => { clear(m, skin); dot(mc, m.x0 + 1, m.y0, mw - 2, 1); dot(mc, m.x0, m.y0 + 1); dot(mc, m.x1, m.y0 + 1); };
    const flat = () => { clear(m, skin); dot(mc, m.x0 + 1, m.y0 + (H(m) >> 1), Math.max(1, mw - 2), 1); };
    const tongueOut = () => { clear(m, skin); dot(mc, m.x0, m.y0, mw, 1); dot(tongue, cx, m.y0 + 1, 2, 2); };
    if (ex === 'blink') { closed(eyes[0]); closed(eyes[1]); }
    else if (ex === 'happy') { arch(eyes[0]); arch(eyes[1]); if (m) grin(); }
    else if (ex === 'wink') { closed(eyes[1]); if (m) tongueOut(); }
    else if (ex === 'surprised') { if (m) oh(); }
    else if (ex === 'sad') { if (m) frown(); }
    else if (ex === 'sleepy') { closed(eyes[0], true); closed(eyes[1], true); if (m) flat(); }
    else if (ex === 'tongue') { if (m) tongueOut(); }
  };
}

/* ---------- 羽球拍（握把在原點、拍面往 +y）、羽毛球（球頭在下、羽毛往 +y） ---------- */

export function makeRacket() {
  const g = new THREE.Group(), bk = new THREE.MeshLambertMaterial({ color: '#1f1f22' });
  const box = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bk); m.position.set(x, y, 0); g.add(m); return m; };
  box(0.045, 0.2, 0.045, 0, 0);                                // 握把
  box(0.018, 0.26, 0.018, 0, 0.23);                            // 拍桿
  const cy = 0.5, rw = 0.2, rh = 0.26;                          // 拍框（方塊拼成的橢圓）
  box(0.02, rh - 0.08, 0.02, -rw / 2, cy); box(0.02, rh - 0.08, 0.02, rw / 2, cy);
  box(rw - 0.06, 0.02, 0.02, 0, cy + rh / 2); box(rw - 0.06, 0.02, 0.02, 0, cy - rh / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) box(0.04, 0.04, 0.02, sx * (rw / 2 - 0.02), cy + sy * (rh / 2 - 0.02));
  const net = new THREE.Mesh(new THREE.PlaneGeometry(rw - 0.01, rh - 0.01), new THREE.MeshLambertMaterial({ color: '#e8e8e8', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  net.position.set(0, cy, 0); g.add(net);
  return g;
}
export function makeShuttle() {
  const g = new THREE.Group();
  const cork = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), new THREE.MeshLambertMaterial({ color: '#f4f2ec' }));
  cork.position.y = 0.02; g.add(cork);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.052), new THREE.MeshLambertMaterial({ color: '#222222' }));
  band.position.y = 0.045; g.add(band);
  const fe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.09, 8, 1, true), new THREE.MeshLambertMaterial({ color: '#fbfaf5', side: THREE.DoubleSide }));
  fe.position.y = 0.095; g.add(fe);
  return g;
}


export { canvasTex };
