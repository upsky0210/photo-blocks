// 從 xikou-3d-campus 的 js/extras.js（commit 8cf2eb3）複製；獨立動物模型。
import * as THREE from "three";
function canvasTex(w,h,draw) { const c=document.createElement("canvas"); c.width=w; c.height=h; draw(c.getContext("2d"),w,h); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
function tabbyTex() {
  return canvasTex(64, 64, (c, w, h) => {
    c.fillStyle = '#e39a45'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c4762b';
    for (let i = 0; i < 6; i++) c.fillRect(0, 4 + i * 11, w, 4);
  });
}
export function makeCat() {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ map: tabbyTex() });
  const light = new THREE.MeshLambertMaterial({ color: '#f6d7a8' });
  const dark = new THREE.MeshLambertMaterial({ color: '#2a2a2a' });
  const pink = new THREE.MeshLambertMaterial({ color: '#f29ca8' });
  const box = (m, w, h, d, x, y, z, parent = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  // 坐著的身體
  box(fur, 0.26, 0.3, 0.34, 0, 0.17, 0.02);
  box(light, 0.16, 0.18, 0.02, 0, 0.2, -0.16);            // 胸前淺色
  box(fur, 0.07, 0.16, 0.07, -0.07, 0.08, -0.13); box(fur, 0.07, 0.16, 0.07, 0.07, 0.08, -0.13);   // 前腳
  box(light, 0.075, 0.03, 0.08, -0.07, 0.015, -0.14); box(light, 0.075, 0.03, 0.08, 0.07, 0.015, -0.14);
  // 頭
  const head = new THREE.Group(); head.position.set(0, 0.4, -0.08); g.add(head);
  box(fur, 0.22, 0.18, 0.18, 0, 0, 0, head);
  box(fur, 0.06, 0.07, 0.04, -0.07, 0.12, 0.02, head); box(fur, 0.06, 0.07, 0.04, 0.07, 0.12, 0.02, head);   // 耳朵
  box(pink, 0.03, 0.04, 0.01, -0.07, 0.12, -0.002, head); box(pink, 0.03, 0.04, 0.01, 0.07, 0.12, -0.002, head);
  box(dark, 0.035, 0.035, 0.01, -0.05, 0.02, -0.092, head); box(dark, 0.035, 0.035, 0.01, 0.05, 0.02, -0.092, head);   // 眼睛
  box(light, 0.09, 0.05, 0.02, 0, -0.04, -0.095, head);
  box(pink, 0.025, 0.02, 0.01, 0, -0.02, -0.106, head);   // 鼻子
  // 尾巴（會擺動）
  const tail = new THREE.Group(); tail.position.set(0.1, 0.04, 0.18); g.add(tail);
  box(fur, 0.05, 0.05, 0.28, 0.06, 0, 0.12, tail);
  g.userData.anim = (t) => {
    tail.rotation.y = Math.sin(t * 2.2) * 0.5;
    head.rotation.y = Math.sin(t * 0.5) * 0.45;
    head.rotation.x = Math.max(0, Math.sin(t * 0.31)) * 0.15;
  };
  return g;
}

/* ---------- 蜜袋鼯 ----------
   cream：奶油色、窩在藍色保暖袋裡抱著點心（五年四班，依照片）
   grey ：灰毛、白肚子、臉上黑色條紋從鼻子到背、黑眼圈、蓬蓬灰尾巴（花花，依照片：趴在毯子上、尾巴捲在旁邊）
   pale ：比較白的灰毛、黑條紋、手上抱著點心、尾巴拖在後面（泡泡，依照片） */

/**
 * 倉鼠（依照片：灰褐色背、深色背線、白臉頰白肚子、黑亮眼睛、粉紅鼻子）從粉紅色熊頭陶瓷小屋的圓洞探出頭；前面是 -z
 */
export function makeHamster() {
  const g = new THREE.Group();
  const M = (color, e) => new THREE.MeshLambertMaterial(e ? { color, emissive: e } : { color });
  const pink = M('#f3b6c6'), pinkD = M('#e79cb0'), hole = M('#3a2430'), nose = M('#e08a96'), eye = M('#0d0a0a', '#080505');
  const fur = M('#8d8a86'), furD = M('#5e5a57'), white = M('#f2efe9'), paw = M('#f6dcd8');
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const box = (m, w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  // 小屋：圓圓的蛋形（下面平）＋兩個圓耳朵
  const shell = add(new THREE.SphereGeometry(0.11, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), pink, 0, 0.1, 0);
  shell.scale.set(1, 1.25, 0.95);
  add(new THREE.CylinderGeometry(0.105, 0.1, 0.1, 20), pink, 0, 0.05, 0);
  for (const sx of [-1, 1]) {
    const ear = add(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 16), pink, sx * 0.075, 0.225, 0);
    ear.rotation.x = Math.PI / 2;
    const inner = add(new THREE.CylinderGeometry(0.02, 0.02, 0.031, 12), pinkD, sx * 0.075, 0.225, -0.002);
    inner.rotation.x = Math.PI / 2;
  }
  const door = add(new THREE.CircleGeometry(0.06, 20), hole, 0, 0.1, -0.1);   // 前面的圓洞（裡面暗暗的）
  door.rotation.y = Math.PI;
  box(M('#f5e3c9'), 0.035, 0.035, 0.004, 0, 0.03, -0.103);   // 下面的小倉鼠貼紙
  // 倉鼠：頭從洞口探出來，兩隻小手扶在洞口
  box(fur, 0.085, 0.075, 0.07, 0, 0.105, -0.095);             // 頭頂、背
  box(furD, 0.02, 0.06, 0.071, 0, 0.115, -0.095);             // 深色背線
  box(white, 0.09, 0.04, 0.06, 0, 0.075, -0.1);               // 白臉頰、下巴
  box(nose, 0.016, 0.014, 0.01, 0, 0.098, -0.132);            // 粉紅鼻子
  for (const sx of [-1, 1]) {
    box(eye, 0.016, 0.018, 0.006, sx * 0.022, 0.118, -0.131); // 黑亮眼睛
    box(fur, 0.022, 0.022, 0.012, sx * 0.03, 0.15, -0.09);    // 小耳朵
    box(paw, 0.018, 0.012, 0.02, sx * 0.022, 0.05, -0.122);   // 扶在洞口的小手
  }
  return g;
}

/* ---------- 生態池的烏龜（前面是 -z）：綠色龜殼（六角花紋）、黃綠色頭和腳；腳可以划水 ---------- */
export function makeTurtle(shellColor = '#4f7f3a') {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = shellColor; c.fillRect(0, 0, 64, 64);
  c.strokeStyle = '#2f4f22'; c.lineWidth = 2;
  for (const [x, y] of [[16, 16], [48, 16], [32, 32], [16, 48], [48, 48], [0, 32], [64, 32]]) {
    c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11); } c.closePath(); c.stroke();
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const skin = new THREE.MeshLambertMaterial({ color: '#8fae4a' }), dark = new THREE.MeshLambertMaterial({ color: '#2f4f22' });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex }));
  shell.scale.set(1, 0.6, 1.25); shell.position.y = 0.02; g.add(shell);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.03, 16), dark); rim.scale.set(1, 1, 1.25); rim.position.y = 0.02; g.add(rim);
  const box = (m, w, h, d, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
  const head = new THREE.Group(); head.position.set(0, 0.04, -0.2); g.add(head);
  const hb = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.1), skin); hb.position.z = -0.03; head.add(hb);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.018, 0.015), new THREE.MeshLambertMaterial({ color: '#111', emissive: '#080808' })); e.position.set(sx * 0.041, 0.012, -0.05); head.add(e); }
  const legs = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const l = new THREE.Group(); l.position.set(sx * 0.13, 0.01, sz * 0.12); g.add(l);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.06), skin); m.position.x = sx * 0.04; l.add(m);
    legs.push(l);
  }
  box(skin, 0.03, 0.025, 0.06, 0, 0.01, 0.21);                       // 尾巴
  g.userData.head = head; g.userData.legs = legs;
  return g;
}

export function makeGlider(look = 'cream') {
  const g = new THREE.Group();
  const M = (color, e) => new THREE.MeshLambertMaterial(e ? { color, emissive: e } : { color });
  const pink = M('#f0a8a8'), eye = M('#160808', '#120404');
  const box = (m, w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  if (look === 'cream') {
    const fur = M('#f3e2b8'), furD = M('#e8d09c'), blue = M('#2346b8'), blueD = M('#15287a');
    // 藍色保暖袋（開口朝上，裡面比較暗）
    box(blue, 0.3, 0.14, 0.26, 0, 0.07, 0);
    box(blueD, 0.24, 0.01, 0.2, 0, 0.145, 0);
    box(blue, 0.32, 0.04, 0.03, 0, 0.16, -0.13);               // 袋口前緣捲邊
    box(fur, 0.15, 0.12, 0.16, 0, 0.2, 0.01);                  // 身體：從袋子裡探出來
    box(fur, 0.12, 0.1, 0.11, 0, 0.29, -0.06);                 // 頭（前面是 -z）
    box(pink, 0.04, 0.03, 0.03, 0, 0.27, -0.125);              // 粉紅鼻子
    for (const s of [-1, 1]) {
      box(eye, 0.03, 0.03, 0.01, s * 0.035, 0.305, -0.116);    // 黑亮大眼睛
      box(fur, 0.045, 0.05, 0.015, s * 0.06, 0.355, -0.04);    // 耳朵
      box(pink, 0.028, 0.034, 0.005, s * 0.06, 0.352, -0.049); // 耳朵內側
    }
    box(pink, 0.025, 0.025, 0.025, -0.03, 0.235, -0.13);       // 兩隻粉紅小手抱著點心
    box(pink, 0.025, 0.025, 0.025, 0.03, 0.235, -0.13);
    box(M('#d9a05a'), 0.03, 0.03, 0.03, 0, 0.245, -0.14);
    box(furD, 0.07, 0.06, 0.08, 0.1, 0.17, 0.12);              // 蓬蓬的大尾巴：從袋口垂到外面
    box(fur, 0.08, 0.16, 0.08, 0.16, 0.09, 0.15);
    return g;
  }
  // 灰色系：趴在桌上（前面是 -z）
  const pale = look === 'pale';
  const fur = M(pale ? '#b9b6b4' : '#9c9a9c'), white = M('#f4f1ea'), stripe = M('#3b3537'), tailM = M(pale ? '#a8a4a2' : '#7d7a7c');
  const earM = M('#8a7466');
  box(fur, 0.13, 0.08, 0.2, 0, 0.05, 0.02);                    // 身體
  box(white, 0.11, 0.02, 0.17, 0, 0.012, 0.0);                  // 白肚子
  box(white, 0.1, 0.05, 0.03, 0, 0.05, -0.08);                  // 白胸口
  box(stripe, 0.025, 0.006, 0.2, 0, 0.093, 0.02);               // 背上一條黑線
  // 頭
  box(white, 0.11, 0.09, 0.09, 0, 0.09, -0.12);
  box(stripe, 0.025, 0.092, 0.06, 0, 0.09, -0.13).scale.set(1, 1.01, 1.6);   // 鼻子到頭頂的黑條紋
  box(pink, 0.03, 0.025, 0.02, 0, 0.075, -0.17);                // 粉紅鼻子
  for (const s of [-1, 1]) {
    box(stripe, 0.035, 0.035, 0.006, s * 0.035, 0.1, -0.166);   // 黑眼圈
    box(eye, 0.024, 0.024, 0.008, s * 0.035, 0.1, -0.169);      // 黑亮大眼睛
    box(earM, 0.035, 0.045, 0.012, s * 0.05, 0.155, -0.105);    // 耳朵
    box(pink, 0.02, 0.028, 0.004, s * 0.05, 0.153, -0.112);     // 耳朵內側
    box(pink, 0.03, 0.015, 0.035, s * 0.055, 0.008, -0.1);      // 粉紅前腳
    box(pink, 0.03, 0.015, 0.035, s * 0.06, 0.008, 0.1);        // 後腳
    box(fur, 0.01, 0.012, 0.15, s * 0.07, 0.03, 0.01);          // 身體兩側的飛膜
  }
  if (pale) {
    // 泡泡：手上抱著點心，尾巴直直拖在後面
    box(pink, 0.025, 0.025, 0.025, -0.025, 0.05, -0.17);
    box(pink, 0.025, 0.025, 0.025, 0.025, 0.05, -0.17);
    box(M('#f2e3b0'), 0.04, 0.035, 0.03, 0, 0.055, -0.19);
    box(tailM, 0.045, 0.045, 0.22, 0, 0.03, 0.22);
    box(stripe, 0.04, 0.04, 0.06, 0, 0.03, 0.35);
  } else {
    // 花花：尾巴往旁邊捲過來，尾巴尖是深色
    box(tailM, 0.05, 0.05, 0.12, 0.03, 0.025, 0.17);
    box(tailM, 0.12, 0.05, 0.05, 0.1, 0.025, 0.22);
    box(tailM, 0.05, 0.05, 0.12, 0.16, 0.025, 0.17);
    box(stripe, 0.05, 0.05, 0.06, 0.16, 0.025, 0.09);
  }
  return g;
}