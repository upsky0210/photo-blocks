import * as THREE from 'three';

// 將相交的零件合成同一份體素表面，移除內部面；小配件至少有一格厚。
export function buildFigureSolid(root, resolution=80) {
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
  const step=Math.max(size.x,size.y,size.z)/resolution;
  const nx=Math.ceil(size.x/step)+4,ny=Math.ceil(size.y/step)+4,nz=Math.ceil(size.z/step)+4;
  const origin=bounds.min.clone().addScalar(-2*step), vox=new Uint8Array(nx*ny*nz);
  const index=(x,y,z)=>(y*nz+z)*nx+x;
  const inside=(x,y,z)=>x>=0&&y>=0&&z>=0&&x<nx&&y<ny&&z<nz&&vox[index(x,y,z)];
  const local=new THREE.Vector3(),world=new THREE.Vector3();
  root.traverseVisible(o=>{
    if(!o.isMesh||!o.visible||o.geometry.type==='PlaneGeometry'||o.geometry.type==='CircleGeometry')return;
    o.geometry.computeBoundingBox();
    const b=o.geometry.boundingBox,wb=b.clone().applyMatrix4(o.matrixWorld),inv=o.matrixWorld.clone().invert();
    const lo=wb.min.clone().sub(origin).divideScalar(step).floor(),hi=wb.max.clone().sub(origin).divideScalar(step).ceil();
    const pad=step*.65/Math.max(.001,Math.min(...new THREE.Vector3().setFromMatrixScale(o.matrixWorld).toArray()));
    const padded=b.clone().expandByScalar(pad);
    for(let y=Math.max(0,lo.y-1);y<Math.min(ny,hi.y+1);y++)for(let z=Math.max(0,lo.z-1);z<Math.min(nz,hi.z+1);z++)for(let x=Math.max(0,lo.x-1);x<Math.min(nx,hi.x+1);x++){
      world.set(x+.5,y+.5,z+.5).multiplyScalar(step).add(origin);local.copy(world).applyMatrix4(inv);
      if(!padded.containsPoint(local))continue;
      // 方塊保留旋轉後的輪廓；圓形零件以封閉的外框實體呈現。
      vox[index(x,y,z)]=1;
    }
  });
  // 為懸空的配件加細支柱，接到展示台，避免列印成散落的小零件。
  const seen=new Uint8Array(vox.length),queue=[];
  let seed=vox.findIndex(Boolean);if(seed<0)throw Error('沒有可列印的模型');
  const flood=start=>{queue.length=0;queue.push(start);seen[start]=1;for(let q=0;q<queue.length;q++){const i=queue[q],x=i%nx,z=Math.floor(i/nx)%nz,y=Math.floor(i/(nx*nz));for(const [dx,dy,dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){const a=x+dx,b=y+dy,c=z+dz;if(inside(a,b,c)&&!seen[index(a,b,c)]){seen[index(a,b,c)]=1;queue.push(index(a,b,c));}}}};
  flood(seed);
  for(let i=0;i<vox.length;i++)if(vox[i]&&!seen[i]){
    const x=i%nx,z=Math.floor(i/nx)%nz,y=Math.floor(i/(nx*nz));
    for(let h=y;h>=2;h--)for(let dx=0;dx<=1;dx++)for(let dz=0;dz<=1;dz++)if(x+dx<nx&&z+dz<nz)vox[index(x+dx,h,z+dz)]=1;
    flood(i);
  }
  // 補齊只以邊或角接觸的格子，避免非流形邊。
  for(let pass=0;pass<4;pass++){
    let changed=0;
    for(let y=1;y<ny-1;y++)for(let z=1;z<nz-1;z++)for(let x=1;x<nx-1;x++)if(inside(x,y,z)){
      for(const [dx,dy,dz] of [[1,1,0],[1,-1,0],[1,0,1],[1,0,-1],[0,1,1],[0,1,-1]])if(inside(x+dx,y+dy,z+dz)){
        const mid=dx?[x+dx,y,z]:[x,y+dy,z],other=dx?[x,y+dy,z+dz]:[x,y,z+dz];
        if(!inside(...mid)&&!inside(...other)){vox[index(...mid)]=1;changed++;}
      }
    }
    if(!changed)break;
  }
  const positions=[];
  const faces=[[[1,0,0],[[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],[[-1,0,0],[[0,0,1],[0,1,1],[0,1,0],[0,0,0]]],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],[[0,0,1],[[1,0,1],[1,1,1],[0,1,1],[0,0,1]]],[[0,0,-1],[[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]];
  for(let y=0;y<ny;y++)for(let z=0;z<nz;z++)for(let x=0;x<nx;x++)if(inside(x,y,z))for(const [d,corners]of faces)if(!inside(x+d[0],y+d[1],z+d[2]))for(const n of [0,1,2,0,2,3]){
    const c=corners[n];positions.push(x+c[0],y+c[1],z+c[2]);
  }
  validateSolid(positions);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.scale(step,step,step);geo.translate(origin.x,origin.y,origin.z);geo.computeVertexNormals();
  return geo;
}
export function validateSolid(p) {
  const edges=new Map();let volume=0;
  const key=i=>`${p[i]},${p[i+1]},${p[i+2]}`;
  for(let i=0;i<p.length;i+=9){
    const ids=[key(i),key(i+3),key(i+6)];
    for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],s=a<b?1:-1,id=a<b?a+'|'+b:b+'|'+a;const e=edges.get(id)||[0,0];e[0]++;e[1]+=s;edges.set(id,e);}
    volume+=p[i]*(p[i+4]*p[i+8]-p[i+5]*p[i+7])+p[i+1]*(p[i+5]*p[i+6]-p[i+3]*p[i+8])+p[i+2]*(p[i+3]*p[i+7]-p[i+4]*p[i+6]);
  }
  if(!edges.size||volume<=0||[...edges.values()].some(([count,direction])=>count!==2||direction!==0))throw Error('這個配件組合還無法合成封閉實體，請更換手拿物再試一次。');
  return {edges:edges.size,triangles:p.length/9,volume:volume/6};
}
