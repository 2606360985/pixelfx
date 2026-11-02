import { pixels } from './art.js';

const C = { ink:'#102a2b', wall:'#35504b', paper:'#f1d69d', gold:'#d6a76a', red:'#ad584c', teal:'#72a69a' };
const SHOPS = [
  {x:0,w:137,name:'老街面馆',type:'noodle',accent:'#dfb77a'},
  {x:140,w:105,name:'声浪唱片',type:'record',accent:'#8eafa0'},
  {x:249,w:164,name:'通宵修理',type:'garage',accent:'#d58a62'},
  {x:418,w:174,name:'巷口供销社',type:'grocer',accent:'#b5bc82'},
  {x:603,w:144,name:'阿荣凉茶',type:'tea',accent:'#84b69b'},
  {x:751,w:206,name:'小满鲜果',type:'melon',accent:'#cbd290'},
  {x:962,w:123,name:'夜市小炒',type:'noodle',accent:'#d7aa73'},
  {x:1089,w:107,name:'旧物交换',type:'grocer',accent:'#a5bc98'},
  {x:1204,w:150,name:'绯绫茶馆',type:'tea',accent:'#d5998d'},
  {x:1358,w:260,name:'双 响 游 艺 会 馆',type:'arcade',accent:'#d67569'},
  {x:1623,w:177,name:'夜归人',type:'garage',accent:'#899b90'},
];

export class Scenery {
  constructor() {
    this.street=document.createElement('canvas'); this.street.width=1800; this.street.height=270;
    this.far=document.createElement('canvas'); this.far.width=640; this.far.height=110;
    this.paintFar(); this.paintStreet();
  }
  paintFar() {
    const c=this.far.getContext('2d'), {r,p}=pixels(c);
    r(0,0,640,110,'#142d30'); r(0,38,640,72,'#1b3637');
    r(467,16,18,17,'#9baf91'); r(464,20,24,9,'#9baf91'); r(469,16,5,4,'#bdc2a0');
    for(let i=0;i<15;i++){
      const x=i*46,y=20+(i*17)%40,w=38+(i%3)*7;
      p([[x,y+8],[x+4,y+8],[x+4,y],[x+w-5,y],[x+w-5,y+5],[x+w,y+5],[x+w,110],[x,110]],i%2?'#253f3e':'#213a3b');
      r(x+9,y-6,1,8,'#284541'); r(x+5,y-5,12,1,'#284541');
      for(let j=0;j<4;j++)for(let k=0;k<3;k++) r(x+7+j*8,y+14+k*16,3,6,(i+j+k)%4===0?'#a59b68':'#36514a');
    }
    // Two sagging utility lines rather than a repeating texture.
    for(let x=0;x<640;x++) { r(x,34+Math.round(Math.sin(x/640*Math.PI)*13),1,1,'#0e252a'); r(x,40+Math.round(Math.sin(x/640*Math.PI)*8),1,1,'#0e252a'); }
  }
  sign(c,x,y,w,h,text,color,size=10) {
    const {r}=pixels(c); r(x+2,y+2,w,h,'#0b2428'); r(x,y,w,h,'#203632'); r(x,y,w,2,color); r(x,y+h-2,w,2,'#0c2427'); r(x+2,y+3,1,h-6,color);
    c.fillStyle=color; c.font=`900 ${size}px "Microsoft YaHei", sans-serif`; c.textAlign='center'; c.fillText(text,x+w/2,y+h-7);
  }
  paintStreet() {
    const c=this.street.getContext('2d'), {r,p,l}=pixels(c);
    // Warm top planes, green shadows and irregular mortar establish material at one pixel.
    for(const [i,s] of SHOPS.entries()) {
      const {x,w,type,accent}=s, top=41+(i%3)*5;
      r(x,top,w,110,'#122d2d'); r(x+3,top+3,w-6,106,i%2?'#3c5146':'#344b44');
      r(x-2,top,w+4,3,'#7c8061'); r(x,top+3,w,2,'#1c3632');
      for(let yy=top+9;yy<79;yy+=7)for(let xx=x+4+(yy%2)*6;xx<x+w-6;xx+=16) {r(xx,yy,13,1,'#4a5b49'); if((xx+yy)%7===0)r(xx,yy+2,1,3,'#293e3c');}
      for(let j=0;j<Math.floor(w/42);j++) { const wx=x+12+j*43; r(wx,top+10,24,24,'#172e2e'); r(wx+2,top+12,20,19,j%2?'#6a7454':'#435f53'); r(wx+11,top+10,2,23,'#18352f'); r(wx,top+22,24,2,'#18352f'); r(wx-2,top+34,28,3,'#879073'); }
      // Air-conditioner and a drainpipe break up the architectural modules.
      r(x+w-25,top+13,20,13,'#6f7962'); r(x+w-22,top+16,13,1,'#344a43'); r(x+w-22,top+19,13,1,'#344a43'); l(x+w-4,top+19,x+w-4,143,'#64755a',2);
      this.sign(c,x+5,79,w-10,25,s.name,accent,type==='arcade'?14:11);
      r(x+7,105,w-14,40,'#172d2b');
      if(type==='garage') {
        r(x+10,107,w-20,38,'#4b5c51'); for(let y=109;y<145;y+=4)r(x+10,y,w-20,1,'#273e38');
        r(x+15,109,3,32,'#7e8770'); r(x+w-19,111,2,29,'#1a322e');
        p([[x+w/2-16,134],[x+w/2-10,118],[x+w/2+8,120],[x+w/2+13,136]],'#273c36');
        r(x+w/2-7,121,12,4,'#819279');
      } else {
        r(x+12,108,w-25,35,'#d1b17a'); r(x+15,110,w-31,32,type==='arcade'?'#502e39':'#6b7252');
        for(let xx=x+17;xx<x+w-16;xx+=25){r(xx,110,2,33,'#263e35');r(xx+2,113,3,25,'#adb67e');}
        r(x+10,143,w-20,3,'#91a17b');
      }
      if(type==='record') {
        for(let j=0;j<3;j++){r(x+19+j*22,115,17,21,['#c49a71','#7e9b83','#a56b62'][j]);r(x+22+j*22,120,11,11,'#233a34');r(x+26+j*22,124,3,3,'#dcb97a');}
      }
      if(type==='noodle'||type==='tea') {
        r(x+18,130,w-37,10,'#7b7350'); r(x+20,130,w-42,2,'#d5bd80');
        for(let j=0;j<3;j++) { r(x+27+j*21,126,10,4,'#e4d3a1');r(x+28+j*21,129,8,2,'#a68b60'); }
        if(type==='tea')for(let j=0;j<3;j++){r(x+28+j*22,115,7,11,'#8f9364');r(x+29+j*22,114,5,2,'#d3bc83');}
        p([[x+12,105],[x+w-12,105],[x+w-17,115],[x+17,115]],type==='tea'?'#567e64':'#b76f50');
        r(x+24,106,3,7,'#d3b67b');r(x+w-29,106,3,7,'#d3b67b');
      }
      if(type==='grocer') {
        for(let j=0;j<5;j++)for(let k=0;k<2;k++){r(x+18+j*17,113+k*14,10,10,['#b7ad75','#a77956','#869b70'][(j+k)%3]);r(x+18+j*17,115+k*14,10,2,'#ddc28a');}
      }
      if(type==='arcade') {
        r(x+21,106,w-42,3,'#b65b55');
        for(let j=0;j<4;j++){const ax=x+35+j*49;p([[ax,119],[ax+22,119],[ax+25,144],[ax-2,144]],'#233637');r(ax+2,113,19,16,'#8c695d');r(ax+5,115,13,9,'#b4bd82');r(ax+7,117,6,3,'#4e776a');r(ax,129,23,3,'#cfb37f');r(ax+5,130,3,2,'#dd7e6d');}
        this.sign(c,x+76,46,108,28,'不 夜 城','#dd806f',16);
        l(x+18,74,x+w-18,74,'#d59f70');
      }
      if(type==='melon') {
        p([[x-4,107],[x+w+3,107],[x+w+9,120],[x-10,120]],'#b4b87c');
        for(let j=0;j<w/12;j++)p([[x+j*12,107],[x+j*12+5,107],[x+j*12+6,120],[x+j*12-2,120]],'#557b5b');
        r(x+4,120,3,33,'#aa9163');r(x+w-8,120,3,33,'#aa9163');r(x+9,137,w-18,14,'#9a784c');r(x+11,139,w-22,2,'#d5b77d');
        for(let j=0;j<12;j++){const mx=x+19+j*14,my=129+(j%2)*3;r(mx-5,my,11,7,'#294f38');r(mx-4,my-2,9,7,'#8ea45d');r(mx-1,my-2,2,7,'#4c7646');}
        r(x+w-42,123,20,3,'#c9bc89');r(x+w-34,125,4,8,'#405c4b');r(x+w-41,133,19,3,'#acb496');
        this.sign(c,x+60,119,57,14,'现切 · 保甜','#e4d19a',7);
      }
      // Doorway curtains and handbills.
      r(x+w-15,107,7,35,'#162f2d');r(x+w-12,110,2,22,'#9ea16c');r(x+3,122,8,12,'#ccbb8a');r(x+4,125,5,1,'#866f4e');r(x+4,128,4,1,'#866f4e');
      r(x,147,w,5,'#8b8d70'); r(x,152,w,3,'#3b5247');
    }
    // Sidewalk and worn, wet asphalt. Decoration avoids the playable lane's contrast range.
    r(0,155,1800,6,'#617367');r(0,161,1800,3,'#192f2d');r(0,164,1800,106,'#314941');
    r(0,164,1800,18,'#3d5549');r(0,183,1800,53,'#354c43');r(0,237,1800,33,'#2b423d');
    for(let x=0;x<1800;x+=24){r(x,155,1,5,'#304a40');r(x+2,156,18,1,'#94a081');}
    for(let i=0;i<130;i++){const x=(i*131)%1790,y=175+(i*29)%81;r(x,y,4+i%17,1,i%3?'#40564a':'#233d36');if(i%4===0)r(x+3,y+2,7,1,'#596953');}
    for(const [x,y,w] of [[60,188,60],[261,230,97],[467,203,52],[706,239,88],[818,189,94],[1023,221,60],[1254,193,83],[1453,229,117],[1670,205,63]]){
      p([[x,y],[x+w-12,y],[x+w,y+3],[x+w-7,y+7],[x+8,y+8],[x-7,y+4]],'#233e39');r(x+8,y+2,w-20,1,'#71806a');r(x+18,y+5,w-36,1,'#5e7a65');
    }
    for(let x=0;x<1800;x+=77){r(x,254,33,2,'#8e8b62');r(x+2,256,29,1,'#53634d');}
    for(let i=0;i<11;i++){ const x=45+i*161; r(x,151,1,7,'#0f2928');r(x-3,155,7,1,'#182f2c');}
    // Street fixtures are intentionally placed rather than tiled.
    for(const x of [108,540,698,1166,1286,1743]) {
      r(x,60,3,96,'#132f2d');r(x+1,62,1,91,'#8b9673');l(x+1,60,x+15,54,'#132f2d',2);r(x+11,53,13,3,'#223b32');r(x+13,56,9,2,'#f5d599');r(x-3,155,10,3,'#1d3730');
    }
    for(const x of [216,440,1047,1660]){r(x,141,14,16,'#294c43');r(x-1,140,16,3,'#7c9976');r(x+3,145,1,10,'#63836c');r(x+10,145,1,10,'#63836c');}
    // A bicycle near the repair shop, stacked crates, and a Boss entrance carpet.
    for(const x of [288,309]){for(let i=0;i<24;i++){const a=i/24*6.28;r(x+Math.cos(a)*8,151+Math.sin(a)*8,1,1,'#99a083');}}
    l(288,151,298,139,'#9a8d66');l(298,139,309,151,'#9a8d66');l(309,151,293,151,'#9a8d66');l(288,151,302,144,'#9a8d66');r(295,137,8,2,'#1b332f');
    for(const [x,y] of [[728,149],[741,151],[1115,148]]){r(x,y-13,13,14,'#8f7950');r(x+1,y-11,11,1,'#c3a46c');l(x+2,y-10,x+10,y-2,'#4c5940');}
    p([[1430,163],[1548,163],[1573,183],[1408,183]],'#704b43');r(1422,178,137,1,'#b18262');
  }
  draw(c,camera,time) {
    c.fillStyle='#142d30';c.fillRect(0,0,480,270);
    const shift=Math.round(camera*.18)%160;c.drawImage(this.far,-shift,0);c.drawImage(this.street,-Math.round(camera),0);
    const {r,p}=pixels(c);
    // Pixel-edged pools of streetlight, with translucent reflected bands.
    for(const wx of [123,555,713,1181,1301,1758]){
      const x=wx-camera;if(x<-70||x>550)continue;
      c.globalAlpha=.07;p([[x-3,58],[x+5,58],[x+53,165],[x-41,165]],'#f2cb85');c.globalAlpha=.16;r(x-14,166,34,1,'#ddba79');r(x-9,174,26,1,'#d7b278');c.globalAlpha=1;
    }
    // Hanging market lamps and irregular string height.
    for(const wx of [632,689,746,803,860,917,974,1031,1088,1145]){
      const x=wx-camera;if(x<-12||x>492)continue;const y=57+Math.round(Math.sin(wx*.008)*5);
      r(x,y-12,1,12,'#142e2a');r(x-4,y,9,12,'#8b4c3d');r(x-3,y+2,7,7,'#d79060');r(x-1,y+3,3,5,'#efc387');r(x-2,y+12,5,1,'#ba8460');
    }
    // Restrained stove steam; fixed formulas never consume the combat RNG.
    c.globalAlpha=.19;
    for(const wx of [57,999])for(let i=0;i<5;i++){
      const phase=(time*.45+i*.2)%1,x=wx-camera+Math.sin(phase*8+i)*4,y=125-phase*32;
      if(x>-12&&x<492){r(x,y,5+phase*6,2,'#c7cfac');r(x+2,y-2,4+phase*5,2,'#c7cfac');}
    }
    c.globalAlpha=1;
    for (const wx of [1385,1598]) {
      const x=wx-camera;if(x<-90||x>570)continue;
      c.globalAlpha=.09;p([[x-8,103],[x+8,103],[x+70,182],[x-62,182]],'#e36e61');
      c.globalAlpha=.22;r(x-19,171,39,1,'#d08065');r(x-11,181,30,1,'#b46c5c');c.globalAlpha=1;
    }
    // The far-right stage gate stays legible at every camera position.
  }
  foreground(c,camera) {
    const {r,p}=pixels(c);
    for(const wx of [9,593,1200,1794]){
      const x=wx-camera;if(x<-25||x>505)continue;
      r(x,246,4,24,'#122e2b');r(x-7,244,18,4,'#25443b');p([[x-11,244],[x-16,232],[x-6,235],[x-4,223],[x+1,235],[x+10,228],[x+8,244]],'#1c3a31');r(x-2,245,1,11,'#6c7e57');
    }
  }
}
