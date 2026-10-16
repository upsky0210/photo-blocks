import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createFigure } from './model.js';

function dispose(g){g.userData.disposeFaces?.();const textures=new Set(),materials=new Set();g.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material||[])){materials.add(m);if(m.map)textures.add(m.map);}});textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}
export class FigureView {
  constructor(container) {
    this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#f3ecdc');
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x82705f,2));
    const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-3,5,-4);this.scene.add(sun);
    this.camera=new THREE.PerspectiveCamera(36,1,.01,100);this.camera.position.set(2.8,2.2,-4.2);
    this.renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label','可旋轉的方塊人偶');container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,1,0);this.controls.enableDamping=true;this.controls.autoRotate=true;this.controls.autoRotateSpeed=1.5;this.controls.minDistance=1.7;this.controls.maxDistance=9;this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
    this.group=new THREE.Group();this.scene.add(this.group);
    const base=new THREE.Mesh(new THREE.BoxGeometry(1.7,.16,1.7),new THREE.MeshLambertMaterial({color:'#70965a'}));base.position.y=-.08;this.group.add(base);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    let down;this.renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});this.renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<6)this.animate('wave');down=null;});
  }
  update(look){if(this.figure){this.group.remove(this.figure);dispose(this.figure);}this.figure=createFigure(look);this.group.add(this.figure);this.restY=this.figure.position.y;this.motion=null;this.render();}
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.render();}
  render(){this.renderer.render(this.scene,this.camera);}
  animate(kind){this.motion={kind,start:performance.now()};}
  start(){if(this.running)return;this.running=true;const tick=t=>{if(!this.running)return;this.controls.update();if(this.motion&&this.figure){const dt=(t-this.motion.start)/1000;const arm=this.figure.userData.limbs?.armR;if(this.motion.kind==='wave'&&arm)arm.rotation.z=dt<1.5?2.5+Math.sin(dt*14)*.3:0;else this.figure.position.y=this.restY+(dt<.85?Math.sin(dt/.85*Math.PI)*.35:0);if(dt>1.6)this.motion=null;}this.render();this.frame=requestAnimationFrame(tick);};this.frame=requestAnimationFrame(tick);}
  stop(){this.running=false;cancelAnimationFrame(this.frame);}
  reset(){this.camera.position.set(2.8,2.2,-4.2);this.controls.target.set(0,1,0);this.controls.update();}
  async export(kind,name) {
    if(kind==='png'){
      const position=this.camera.position.clone(),target=this.controls.target.clone();this.camera.position.set(2.8,2.2,-4.2);this.controls.target.set(0,.95,0);this.controls.update();this.render();
      const card=document.createElement('canvas');card.width=1000;card.height=1200;const c=card.getContext('2d');c.fillStyle='#fbf6ea';c.fillRect(0,0,1000,1200);
      const source=this.renderer.domElement,scale=Math.min(960/source.width,980/source.height);c.drawImage(source,(1000-source.width*scale)/2,35,source.width*scale,source.height*scale);
      c.textAlign='center';c.fillStyle='#2b2b2b';c.font='bold 46px "Microsoft JhengHei",sans-serif';c.fillText(name||'我的方塊人偶',500,1080,920);c.font='25px "Microsoft JhengHei",sans-serif';c.fillText('照片轉方塊 · 我的創意角色',500,1150);
      this.camera.position.copy(position);this.controls.target.copy(target);this.controls.update();this.render();return new Promise(r=>card.toBlob(r,'image/png'));
    }
    const clone=this.group.clone(true);clone.traverse(o=>{if(o.isMesh){o.material=[].concat(o.material).map(m=>new THREE.MeshStandardMaterial({color:m.color,map:m.map,roughness:.85,side:THREE.DoubleSide}));if(o.material.length===1)o.material=o.material[0];}});
    // 匯出保持站立姿勢，不帶暫時的揮手或跳躍動作。
    const figure=clone.children[1];figure.position.y=this.restY;figure.children.forEach(o=>{if(o.type==='Group'&&Math.abs(o.position.x)===.33)o.rotation.set(0,0,0);});
    try {
      if(kind==='stl') {
        const {buildFigureSolid}=await import('./solid.js'),{STLExporter}=await import('three/addons/exporters/STLExporter.js');
        const geo=buildFigureSolid(clone);const b=new THREE.Box3().setFromBufferAttribute(geo.attributes.position),s=100/Math.max(...b.getSize(new THREE.Vector3()).toArray());geo.scale(s,s,s);geo.rotateX(Math.PI/2);
        const out=new STLExporter().parse(new THREE.Mesh(geo),{binary:true});geo.dispose();return new Blob([out],{type:'model/stl'});
      }
      clone.scale.setScalar(.2);const scene=new THREE.Scene();scene.add(clone);
      if(kind==='glb'){const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');return new Blob([await new GLTFExporter().parseAsync(scene,{binary:true})],{type:'model/gltf-binary'});}
      const {USDZExporter}=await import('three/addons/exporters/USDZExporter.js');return new Blob([await new USDZExporter().parse(scene)],{type:'model/vnd.usdz+zip'});
    } finally {clone.traverse(o=>{for(const m of [].concat(o.material||[]))m.dispose();});}
  }
}
