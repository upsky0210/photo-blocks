// 參考紙袋方塊人像的圓眼、笑嘴與俏皮表情；只畫模板，不使用參考照片貼圖。
const rows=Array.from({length:16},(_,y)=>Array(16).fill(y<3?'H':'S'));
for(const [x,w,h]of [[0,3,2],[4,3,1],[9,2,1],[13,3,2]])for(let y=3;y<3+h;y++)for(let i=x;i<x+w;i++)rows[y][i]='H';
for(const x of [2,10]){
  for(let y=5;y<=8;y++)for(let i=x;i<x+4;i++)if(y===6||y===7||i===x+1||i===x+2)rows[y][i]='W';
  for(let y=6;y<=7;y++)for(let i=x+1;i<=x+2;i++)rows[y][i]='E';
}
for(const [x,y]of [[4,11],[5,11],[10,11],[11,11],[6,12],[7,12],[8,12],[9,12]])rows[y][x]='M';
export const PAPER_FACE=rows.map(row=>row.join(''));

export function drawPaperFace(c,look,expression) {
  const pal=look.pal;
  look.face.forEach((row,y)=>[...row].forEach((ch,x)=>{c.fillStyle=pal[ch];c.fillRect(x,y,1,1);}));
  c.fillStyle=pal.S;c.fillRect(0,5,16,11);
  const dot=(color,x,y,w=1,h=1)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
  const dark=pal.E||'#28232c',mouth=pal.M||'#95414c',white='#fff9ed',pink='#ee879b';
  const eye=(x,closed=false,sleepy=false)=>{
    if(closed){dot(dark,x,7,4,1);return;}
    // 以階梯邊緣保留像素風，同時讓眼白與瞳孔有紙藝作品的大小。
    dot(white,x+1,5,2,4);dot(white,x,6,4,2);
    dot(dark,x+1,6,2,2);
    if(sleepy){dot(pal.S,x,5,4,2);dot(dark,x,7,4,1);}
  };
  const arch=x=>{dot(dark,x+1,6,2,1);dot(dark,x,7);dot(dark,x+3,7);};
  if(expression==='happy'){arch(2);arch(10);}
  else if(expression==='wink'){eye(2);dot(dark,10,6);dot(dark,11,7);dot(dark,12,6);}
  else {eye(2,expression==='blink',expression==='sleepy');eye(10,expression==='blink',expression==='sleepy');}
  if(expression==='sad'){dot(dark,2,4,2);dot(dark,4,3,2);dot(dark,10,3,2);dot(dark,12,4,2);}
  else if(expression==='surprised'){dot(dark,3,3,2);dot(dark,11,3,2);}
  // 嘴巴共用同一位置，讓眼鏡、鼻子與表情不會互相跑位。
  if(expression==='happy'){
    dot(mouth,4,10,8,2);dot(mouth,5,12,6,2);dot(white,5,10,6,1);dot(pink,6,12,4,1);
  }else if(expression==='surprised'){
    dot(mouth,6,10,4,4);dot('#552a30',7,11,2,2);
  }else if(expression==='sad'){
    dot(mouth,6,11,4);dot(mouth,5,12);dot(mouth,10,12);
  }else if(expression==='sleepy')dot(mouth,6,12,4);
  else if(expression==='tongue'||expression==='wink'){
    dot(mouth,5,11,6);dot(pink,7,12,3,2);
  }else{
    dot(mouth,4,11,2);dot(mouth,10,11,2);dot(mouth,6,12,4);
  }
}
