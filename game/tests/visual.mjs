// A separate local visual harness. Never imported by the production game.
import { World } from '../world.js';
import { Renderer } from '../render.js';
import { HEROES, MOVES, STEP, ZONES } from '../data.js';
import { drawPortrait } from '../art.js';
const $=id=>document.getElementById(id), renderer=new Renderer($('stage'));
renderer.settings={shake:0,flash:0};
let world, playing=false, previous=performance.now(), accumulator=0, benchmark=null;
for(const h of HEROES){const option=document.createElement('option');option.value=h.id;option.textContent=h.name;$('hero').append(option);const canvas=document.createElement('canvas');canvas.width=100;canvas.height=150;canvas.setAttribute('aria-label',h.name+'立绘');drawPortrait(canvas,h);$('portraits').append(canvas);}
function listMoves(){const h=HEROES.find(h=>h.id===$('hero').value);$('move').replaceChildren(...[...h.skills,h.ultimate].map((id,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=MOVES[id].name;return o;}));}
function reset(){
  const id=$('hero').value;world=new World({team:[id,id==='stone'?'swift':'stone']});world.zone=Number($('zone').value);world.waveDelay=1e6;world.setupProps();world.pickups=[];
  const start=ZONES[world.zone].start;world.heroes.forEach((h,i)=>{h.x=start+180-i*42;h.y=214+i*15;h.think=1e6;h.energy=100;});
  for(let i=0;i<6;i++){const e=world.spawn(i%2?'guard':'punk',start+220+i*34,207+(i%2)*20);e.hp=e.maxHp=10000;e.think=1e6;}
  renderer.reset();renderer.camera=Math.max(0,start+10);world.events=[];world.useSkill(world.player,Number($('move').value));accumulator=0;
}
function step(){world.update(STEP);renderer.handle(world.events.splice(0),world);if(world.hitstop<=0)renderer.tick(STEP);}
function seek(){playing=false;reset();for(let i=0;i<Number($('time').value)/STEP;i++)step();renderer.render(world);$('report').textContent=`${world.player.name} / ${world.player.action?.move.name??'收招'} / FX ${renderer.fx.length}`;}
function change(){benchmark=null;seek();}
$('hero').onchange=()=>{listMoves();change();};$('move').onchange=change;$('zone').onchange=change;$('time').oninput=change;
$('replay').onclick=()=>{benchmark=null;reset();playing=true;};$('freeze').onclick=()=>{playing=false;};
$('benchmark').onclick=async()=>{
  benchmark={samples:[],maxFx:0};playing=false;const controls=[...document.querySelectorAll('button,select,input')];controls.forEach(c=>c.disabled=true);
  try {
    for(let i=0;i<1800;i++){
      if(i%90===0){const index=Math.floor(i/90)%4;$('hero').value=HEROES[index].id;listMoves();$('move').value='3';$('zone').value=String(index%3);reset();}
      const begin=performance.now();step();renderer.render(world);benchmark.samples.push(performance.now()-begin);benchmark.maxFx=Math.max(benchmark.maxFx,renderer.fx.length);
      if(i%60===59){$('report').textContent=`固定步长压测 ${i+1} / 1800 帧（30 秒游戏模拟）`;await new Promise(resolve=>setTimeout(resolve,0));}
    }
    const samples=benchmark.samples.slice(10).sort((a,b)=>a-b),mean=samples.reduce((a,b)=>a+b,0)/samples.length;
    $('report').textContent=JSON.stringify({simulatedSeconds:30,frames:samples.length,meanFrameMs:+mean.toFixed(2),p95FrameMs:+samples[Math.floor(samples.length*.95)].toFixed(2),cpuFrameCapacityFPS:+(1000/mean).toFixed(1),maxFX:benchmark.maxFx,fxLimit:18,measurement:'同步模拟与Canvas提交耗时；吞吐上限不等于屏幕刷新率'});
  } finally {benchmark=null;controls.forEach(c=>c.disabled=false);}
};
function tile(label,columns=4){const box=document.createElement('div'),caption=document.createElement('p'),cv=document.createElement('canvas');cv.width=480;cv.height=270;cv.style.cssText='width:100%;image-rendering:pixelated';cv.getContext('2d').drawImage($('stage'),0,0);caption.textContent=label;caption.style.cssText='font-size:11px;margin:4px 0';box.append(caption,cv);$('overview-grid').style.gridTemplateColumns=`repeat(${columns},1fr)`;$('overview-grid').append(box);}
$('overview').onclick=()=>{benchmark=null;playing=false;$('overview-grid').replaceChildren();for(const h of HEROES){$('hero').value=h.id;listMoves();for(let i=0;i<4;i++){$('move').value=String(i);const m=MOVES[[...h.skills,h.ultimate][i]];$('time').value=String(m.startup+.16);seek();tile(h.name+' / '+m.name);}}};
$('streets').onclick=()=>{benchmark=null;playing=false;$('overview-grid').replaceChildren();for(let i=0;i<3;i++){$('zone').value=String(i);$('time').value='0';seek();world.events=[];world.heroes.forEach(h=>h.action=null);renderer.reset();renderer.camera=Math.max(0,ZONES[i].start+10);renderer.render(world);tile(ZONES[i].name,1);}};
function loop(now){
  const elapsed=now-previous;previous=now;
  if(playing){accumulator+=Math.min(elapsed/1000,.05);while(accumulator>=STEP){step();accumulator-=STEP;}renderer.render(world);}
  requestAnimationFrame(loop);
}
listMoves();seek();requestAnimationFrame(loop);
