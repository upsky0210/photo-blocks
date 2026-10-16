// 從 xikou-3d-campus 的 js/app.js（commit 8cf2eb3）複製；僅含鳥的模型。
import * as THREE from "three";
const BIRD_LOOK = {
  // 麻雀、白頭翁、八哥、斑鳩（臺灣校園常見）
  sparrow: { body: '#9a7350', head: '#7a4a2e', belly: '#e6dcc8', wing: '#6b4a32', beak: '#2b2b2b', size: 0.8 },
  bulbul: { body: '#7f8a5a', head: '#1f1f1f', belly: '#e8e6dc', wing: '#6f7a48', beak: '#1f1f1f', cap: '#ffffff', size: 0.9 },
  myna: { body: '#2b2b2e', head: '#1b1b1d', belly: '#3a3a3e', wing: '#2b2b2e', beak: '#f2c230', patch: '#ffffff', size: 1.05 },
  dove: { body: '#b8a79a', head: '#a8968a', belly: '#d8c8bc', wing: '#9a8678', beak: '#3a3030', collar: '#2b2b2b', size: 1.25 },
};
export function makeBird(kind) {
  const L = BIRD_LOOK[kind], g = new THREE.Group(), s = L.size;
  const m = (c) => new THREE.MeshLambertMaterial({ color: c });
  const box = (p, w, h, d, c, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), m(c)); o.position.set(x * s, y * s, z * s); o.castShadow = true; p.add(o); return o; };
  const body = new THREE.Group(); g.add(body);
  box(body, 0.12, 0.1, 0.18, L.body, 0, 0.1, 0);
  box(body, 0.1, 0.04, 0.14, L.belly, 0, 0.06, -0.01);
  box(body, 0.06, 0.02, 0.12, L.wing, 0, 0.13, 0.13);                    // 尾巴
  const head = new THREE.Group(); head.position.set(0, 0.17 * s, -0.08 * s); body.add(head);
  box(head, 0.09, 0.08, 0.09, L.head, 0, 0, 0);
  box(head, 0.03, 0.025, 0.05, L.beak, 0, -0.01, -0.06);
  for (const x of [-0.046, 0.046]) box(head, 0.006, 0.015, 0.015, '#111111', x, 0.012, -0.02);
  if (L.cap) box(head, 0.092, 0.03, 0.04, L.cap, 0, 0.02, 0.03);         // 白頭翁的白色後腦
  if (L.patch) box(body, 0.13, 0.03, 0.04, L.patch, 0, 0.11, 0.02);       // 八哥翅膀上的白斑
  if (L.collar) box(head, 0.095, 0.02, 0.04, L.collar, 0, -0.04, 0.03);   // 斑鳩脖子的黑點
  const wings = [];
  for (const side of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(side * 0.06 * s, 0.13 * s, 0); body.add(p);
    box(p, 0.16, 0.012, 0.11, L.wing, side * 0.08, 0, 0);
    p.visible = false; wings.push(p);
  }
  for (const x of [-0.025, 0.025]) box(g, 0.01, 0.06, 0.01, '#d9a46a', x, 0.03, 0);
  g.userData = { body, head, wings, kind };
  return g;
}