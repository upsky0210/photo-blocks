// 3D 方塊：每格一根方塊柱（InstancedMesh），可旋轉縮放，可匯出 PNG／GLB／STL／USDZ
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const BASE_LAYERS = 8; // 倍率 1 時，最高比最低多幾層

// 每格高度（整數層數，至少 1 層）
export function cellHeights(m, mode, mult) {
  const h = new Uint16Array(m.cols * m.rows);
  for (let i = 0; i < h.length; i++) {
    if (mode === 'flat') { h[i] = 1; continue; }
    const L = m.colors[m.idx[i]].lab[0] / 100;
    const t = mode === 'bright' ? L : 1 - L;
    h[i] = 1 + Math.round(t * BASE_LAYERS * mult);
  }
  return h;
}

export class BlockView {
  constructor(container) {
    this.container = container;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f3ecdc');
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(-0.6, 1, 0.45);
    this.scene.add(sun);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    const c = this.controls = new OrbitControls(this.camera, r.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.autoRotateSpeed = 1.6;
    c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this.geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = null;
    this.capacity = 0;
    this.running = false;

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  update(m, heights, fit) {
    const n = m.cols * m.rows;
    if (!this.mesh || n > this.capacity) {
      if (this.mesh) { this.scene.remove(this.mesh); this.mesh.dispose(); }
      this.capacity = n;
      this.mesh = new THREE.InstancedMesh(this.geo, this.mat, n);
      this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(this.mesh);
    }
    this.mesh.count = n;
    const mat = new THREE.Matrix4(), col = new THREE.Color();
    const gap = 0.92;
    const cols3 = m.colors.map(c => new THREE.Color(c.hex));
    let maxH = 1;
    for (let y = 0; y < m.rows; y++) {
      for (let x = 0; x < m.cols; x++) {
        const i = y * m.cols + x, h = heights[i];
        if (h > maxH) maxH = h;
        mat.makeScale(gap, h, gap).setPosition(x - m.cols / 2 + 0.5, 0, y - m.rows / 2 + 0.5);
        this.mesh.setMatrixAt(i, mat);
        this.mesh.setColorAt(i, col.copy(cols3[m.idx[i]]));
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    this.size = { cols: m.cols, rows: m.rows, maxH };
    if (fit) this.resetView();
    this.renderOnce();
  }

  resetView() {
    if (!this.size) return;
    const { cols, rows, maxH } = this.size;
    const span = Math.max(cols, rows);
    const d = span * 1.25;
    this.controls.target.set(0, maxH / 3, 0);
    this.camera.position.set(d * 0.12, d * 0.85, d * 0.9); // 稍微偏一點，避免正對方塊之間的縫
    this.camera.near = span / 100; this.camera.far = span * 20;
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = span * 0.2;
    this.controls.maxDistance = span * 5;
    this.controls.update();
    this.renderOnce();
  }

  setAutoRotate(on) { this.controls.autoRotate = on; }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }

  renderOnce() { this.renderer.render(this.scene, this.camera); }

  screenshot() {
    this.renderOnce();
    return new Promise(res => this.renderer.domElement.toBlob(res, 'image/png'));
  }
}

// ---------- 匯出用：做成一整塊實心模型（相鄰方塊不重疊、底部封起來） ----------

// 回傳 BufferGeometry（單位：1 格 = 1），中心在原點、底在 y=0
function buildSolidGeometry(m, heights, merge = false) {
  const { cols, rows } = m;
  const pos = [], nor = [], uv = [];
  const H = (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? 0 : heights[y * cols + x]);
  const ox = -cols / 2, oz = -rows / 2;
  const v = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();

  // 四個角 + 法線；自動調整繞行方向讓正面朝外
  function quad(a, b, c, d, n, u, w) {
    e1.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    e2.set(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    v.crossVectors(e1, e2);
    const pts = v.x * n[0] + v.y * n[1] + v.z * n[2] >= 0 ? [a, b, c, a, c, d] : [a, c, b, a, d, c];
    for (const p of pts) {
      pos.push(p[0] + ox, p[1], p[2] + oz);
      nor.push(n[0], n[1], n[2]);
      uv.push(u, w);
    }
  }

  for (let y = 0; y < rows; y++) {
    // merge：同一列裡同色同高的頂面合成一長條、底面整列一塊，檔案小很多（給 GLB／USDZ 用；STL 不合併，比較不會有破面）
    if (merge) {
      const w = 1 - (y + 0.5) / rows;
      quad([0, 0, y], [cols, 0, y], [cols, 0, y + 1], [0, 0, y + 1], [0, -1, 0], 0.5 / cols, w);
      for (let x = 0; x < cols;) {
        const i = y * cols + x, h = heights[i], c = m.idx[i];
        let e = x + 1;
        while (e < cols && heights[y * cols + e] === h && m.idx[y * cols + e] === c) e++;
        quad([x, h, y], [x, h, y + 1], [e, h, y + 1], [e, h, y], [0, 1, 0], (x + 0.5) / cols, w);
        x = e;
      }
    }
    for (let x = 0; x < cols; x++) {
      const h = heights[y * cols + x];
      const u = (x + 0.5) / cols, w = 1 - (y + 0.5) / rows;
      const x0 = x, x1 = x + 1, z0 = y, z1 = y + 1;
      if (!merge) {
        quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], u, w);
        quad([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], [0, -1, 0], u, w);
      }
      // 側牆：STL 要每層切一段，轉角才不會有 T 形接縫（切片軟體才會當成封閉實體）
      const wall = (nh, f) => {
        if (nh >= h) return;
        if (merge) return f(nh, h);
        for (let k = nh; k < h; k++) f(k, k + 1);
      };
      wall(H(x + 1, y), (a, b) => quad([x1, a, z0], [x1, b, z0], [x1, b, z1], [x1, a, z1], [1, 0, 0], u, w));
      wall(H(x - 1, y), (a, b) => quad([x0, a, z0], [x0, a, z1], [x0, b, z1], [x0, b, z0], [-1, 0, 0], u, w));
      wall(H(x, y + 1), (a, b) => quad([x0, a, z1], [x1, a, z1], [x1, b, z1], [x0, b, z1], [0, 0, 1], u, w));
      wall(H(x, y - 1), (a, b) => quad([x0, a, z0], [x0, b, z0], [x1, b, z0], [x1, a, z0], [0, 0, -1], u, w));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// 貼圖：每格 8×8 像素，避免縮圖時鄰格顏色混進來
function mosaicTexture(m) {
  const s = 8, cv = document.createElement('canvas');
  cv.width = m.cols * s; cv.height = m.rows * s;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) {
    ctx.fillStyle = m.colors[m.idx[y * m.cols + x]].hex;
    ctx.fillRect(x * s, y * s, s, s);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// 公尺為單位、最長邊 widthM 公尺的上色模型
function exportMesh(m, heights, widthM) {
  const g = buildSolidGeometry(m, heights, true);
  const s = widthM / Math.max(m.cols, m.rows);
  g.scale(s, s, s);
  const mat = new THREE.MeshStandardMaterial({ map: mosaicTexture(m), roughness: 0.85, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.name = '照片方塊';
  return mesh;
}

export async function exportGLB(m, heights) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const mesh = exportMesh(m, heights, 0.4);
  const buf = await new GLTFExporter().parseAsync(mesh, { binary: true });
  return new Blob([buf], { type: 'model/gltf-binary' });
}

export async function exportUSDZ(m, heights) {
  const { USDZExporter } = await import('three/addons/exporters/USDZExporter.js');
  const scene = new THREE.Scene();
  scene.add(exportMesh(m, heights, 0.4));
  const arr = await new USDZExporter().parse(scene);
  return new Blob([arr], { type: 'model/vnd.usdz+zip' });
}

// STL：單位 mm，最長邊 100 mm（3D 列印用，沒有顏色）
export async function exportSTL(m, heights) {
  const { STLExporter } = await import('three/addons/exporters/STLExporter.js');
  const g = buildSolidGeometry(m, heights);
  const s = 100 / Math.max(m.cols, m.rows);
  g.scale(s, s, s);
  g.rotateX(Math.PI / 2); // 3D 列印軟體以 Z 軸朝上
  const data = new STLExporter().parse(new THREE.Mesh(g), { binary: true });
  return new Blob([data], { type: 'model/stl' });
}
