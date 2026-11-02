import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { AI_LEVELS, ZONES, STEP, HEROES, MOVES, teamIds } from './data.js';

import { drawPortrait, drawSkillIcon } from './art.js';

const $ = id => document.getElementById(id), canvas = $('game'), renderer = new Renderer(canvas), audio = new Audio();
const dev = new URLSearchParams(location.search).has('debug'), seed = Number(new URLSearchParams(location.search).get('seed')) || 2026;
let settings = { ai: 'skilled', volume: .5, shake: .7, flash: .5, team: ['swift','stone'] };
try { const saved = JSON.parse(localStorage.getItem('street-duet.settings') || '{}'); for (const k of ['volume', 'shake', 'flash']) if (Number.isFinite(saved[k])) settings[k] = Math.max(0, Math.min(1, saved[k])); if (saved.ai in AI_LEVELS) settings.ai = saved.ai; settings.team = teamIds(saved.team); } catch { /* Local storage is optional. */ }
const world = new World({ seed, ai: settings.ai, team: settings.team });
let screen = 'title', movesReturn = 'title', previous = performance.now(), acc = 0, fps = 60, lastMode = world.mode, debug = dev, lastHud = 0;
let selectedSlot = 0, previewId = settings.team[0], skillGroups = [];
const input = new Input(action => {
  audio.unlock();
  if (screen === 'title') {
    if (action.startsWith('nav')) return titleNavigation(action);
    if (action === 'jump' || action === 'enter') { const focused = document.activeElement; if (focused?.matches('#title-screen button')) focused.click(); else $('select-player').focus(); return; }
    if (action === 'dodge') { selectedSlot = 0; updateCasting(); $('select-player').focus(); return; }
    if (action === 'pause' && input.device === 'gamepad') return start();
    return;
  }
  if (action.startsWith('nav')) return;
  if (action === 'pause') { if (screen === 'playing') pause(); else if (screen === 'pause') show('playing'); else if (screen === 'moves') show(movesReturn); return; }
  if (screen === 'result' && (action === 'enter' || action === 'jump')) return resultAction();
  if (screen !== 'playing') return;
  world.command(action);
  if (action === 'switch') input.keys.clear();
}, () => { if (screen === 'playing') pause('手柄已断开，可连接手柄或使用键盘继续'); });

function show(next) {
  screen = next; input.clear(); acc = 0;
  for (const [id, state] of [['title-screen', 'title'], ['pause-screen', 'pause'], ['moves-screen', 'moves'], ['result-screen', 'result']]) $(id).hidden = next !== state;
  $('hud').hidden = next === 'title' || (next === 'moves' && movesReturn === 'title');
  $('skill-deck').hidden = next === 'title' || (next === 'moves' && movesReturn === 'title');
  resize();
  if (next === 'title') $('select-player').focus({ preventScroll: true });
  if (next === 'playing') canvas.focus({ preventScroll: true });
  hud();
}
function applySettings() {
  world.ai = settings.ai; audio.volume = settings.volume; renderer.settings = matchMedia('(prefers-reduced-motion: reduce)').matches ? { ...settings, shake: 0, flash: 0 } : settings;
  $('title-ai').value = settings.ai; $('ai-setting').value = settings.ai;
  for (const k of ['volume', 'shake', 'flash']) $(k).value = settings[k];
  try { localStorage.setItem('street-duet.settings', JSON.stringify(settings)); } catch { /* Private browsing can disable persistence. */ }
}
function start() { audio.unlock(); world.reset(settings.team); buildSkillDeck(); renderer.reset(); world.ai = settings.ai; lastMode = 'playing'; show('playing'); }
function pause(reason = '休息一下，下一拳更准。') { $('pause-reason').textContent = reason; show('pause'); }
function moves() { movesReturn = screen; show('moves'); }
function resultAction() { if (world.mode === 'won') start(); else { world.retry(); renderer.reset(); lastMode = 'playing'; show('playing'); } }
function home() { world.reset(settings.team); buildSkillDeck(); renderer.reset(); lastMode = 'playing'; updateCasting(); $('selection-hint').textContent='选择主控，再选一位搭档。'; show('title'); }
function results() {
  const won = world.mode === 'won'; $('result-eyebrow').textContent = won ? 'THE STREET REMEMBERS' : 'BACK ON YOUR FEET';
  $('result-title').textContent = won ? '这一街，双响。' : '再响一次。';
  $('result-copy').textContent = won ? '夜市恢复热闹，你们的故事才刚开始。' : '两人倒地。从本场检查点重新上阵。';
  const t = Math.floor(world.time); $('result-stats').replaceChildren();
  for (const [v, label] of [[`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, '战斗用时'], [world.stats.kills, '击倒敌人'], [world.stats.bestCombo, '最高连击'], [world.stats.relays, '双响接力']]) { const d = document.createElement('div'), b = document.createElement('b'); b.textContent = v; d.append(b, label); $('result-stats').append(d); }
  $('result-action').textContent = won ? '再闯一次 ↗' : '重试本场 ↗'; show('result');
}
$('start').onclick = start; $('resume').onclick = () => show('playing'); $('pause-button').onclick = () => pause();
$('title-moves').onclick = moves; $('pause-moves').onclick = moves; $('close-moves').onclick = () => show(movesReturn);
$('restart').onclick = () => { world.retry(); renderer.reset(); lastMode = 'playing'; show('playing'); };
$('home').onclick = home; $('result-home').onclick = home; $('result-action').onclick = resultAction;
for (const id of ['title-ai', 'ai-setting']) $(id).onchange = e => { settings.ai = e.target.value; applySettings(); };
for (const k of ['volume', 'shake', 'flash']) $(k).oninput = e => { settings[k] = Number(e.target.value); applySettings(); };
window.addEventListener('blur', () => { if (screen === 'playing') pause('窗口失焦，游戏已暂停'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'playing') pause('页面切到后台，游戏已暂停'); });
window.addEventListener('keydown', e => {
  if (!dev) return;
  if (e.code === 'Backquote') debug = !debug;
  if (screen === 'playing' && e.code === 'F2') { e.preventDefault(); world.heroes.forEach(h => { h.energy = 100; h.skillCD.fill(0); }); world.meter = 100; world.message('调试：气槽与默契已充满'); }
});

function resize() {
  const compact = innerWidth < 800, deck = screen === 'title' || (screen === 'moves' && movesReturn === 'title') ? 0 : compact ? 95 : 82;
  const availableW = innerWidth - (compact ? 24 : 56), availableH = innerHeight - (compact ? 125 : 150) - deck;
  const raw = Math.min(availableW / 480, availableH / 270, 3);
  const scale = raw >= 2 ? Math.floor(raw) : Math.max(.65, raw);
  document.querySelector('main').style.width = `${Math.round(480 * scale)}px`;
}
function preview(id) {
  previewId = id; const h = HEROES.find(h => h.id === id);
  $('cast-name').textContent = h.name; $('cast-role').textContent = h.role; $('cast-bio').textContent = h.bio;
  $('cast-skills').replaceChildren(...[...h.skills,h.ultimate].map((id,i) => { const e=document.createElement('span'), key=document.createElement('b'); key.textContent=['1','2','3','U'][i]; e.append(key,MOVES[id].name); e.title=MOVES[id].desc || MOVES[id].name; return e; }));
}
function chooseHero(id) {
  if (settings.team[1-selectedSlot] === id) { $('selection-hint').textContent='这位已经在另一位置，请选择不同角色。'; return; }
  settings.team[selectedSlot]=id; previewId=id; applySettings(); updateCasting();
  $('selection-hint').textContent=`${selectedSlot ? '搭档' : '主控'}已选：${HEROES.find(h=>h.id===id).name}。`;
}
function updateCasting() {
  for(let slot=0;slot<2;slot++) {
    const h=HEROES.find(h=>h.id===settings.team[slot]), button=$(slot ? 'select-partner' : 'select-player');
    button.setAttribute('aria-pressed',String(selectedSlot===slot));button.querySelector('b').textContent=h.name;
    drawPortrait($('portrait'+slot),h,slot ? -1 : 1);$('portrait'+slot).setAttribute('aria-label',h.name+'原创像素立绘');$('billing'+slot).textContent=h.name;
  }
  for(const button of $('roster').children){const id=button.dataset.hero,index=settings.team.indexOf(id);button.classList.toggle('selected',index===0);button.classList.toggle('partner',index===1);button.setAttribute('aria-pressed',String(settings.team[selectedSlot]===id));button.querySelector('.cast-tag').textContent=index<0?'':index===0?'主控':'搭档';}
  preview(settings.team[selectedSlot]);
}
function titleNavigation(action) {
  const controls=[$('select-player'),$('select-partner'),...$('roster').children,$('start'),$('title-moves'),$('title-ai')], active=document.activeElement;
  if(active===$('title-ai') && ['navup','navdown'].includes(action)){active.selectedIndex=(active.selectedIndex+(action==='navup'?-1:1)+3)%3;active.dispatchEvent(new Event('change'));return;}
  const index=controls.indexOf(active), step=['navleft','navup'].includes(action)?-1:1;
  controls[(index+step+controls.length)%controls.length].focus();
}
for(const [i,h] of HEROES.entries()) {
  const b=document.createElement('button');b.className='cast-card';b.dataset.hero=h.id;b.setAttribute('aria-label',`选择${h.name}，${h.role}`);
  const art=document.createElement('canvas');art.width=50;art.height=75;art.setAttribute('aria-hidden','true');drawPortrait(art,h);
  const name=document.createElement('strong');name.textContent=h.name;const tag=document.createElement('span');tag.className='cast-tag';
  b.append(art,name,tag);b.onclick=()=>chooseHero(h.id);b.onmouseenter=()=>preview(h.id);b.onfocus=()=>preview(h.id);$('roster').append(b);
  const article=document.createElement('article'), heading=document.createElement('h3');heading.textContent=`${h.name} / ${h.role}`;article.append(heading);
  for(const [slot,id] of [...h.skills,h.ultimate].entries()){const line=document.createElement('p'),key=document.createElement('kbd');key.textContent=['1','2','3','U'][slot];line.append(key,` ${MOVES[id].name} · ${MOVES[id].cooldown ? MOVES[id].cooldown+' 秒' : '满气槽'}：${MOVES[id].desc || '多段范围攻击'}`);article.append(line);}
  $('roster-moves').append(article);
}
$('select-player').onclick=()=>{selectedSlot=0;updateCasting();};$('select-partner').onclick=()=>{selectedSlot=1;updateCasting();};
function buildSkillDeck() {
  $('skill-deck').replaceChildren();skillGroups=[];
  world.heroes.forEach((h,i)=>{
    const group=document.createElement('div');group.className='skill-group';group.style.setProperty('--hero',h.color);
    const owner=document.createElement('div');owner.className='skill-owner';owner.append(h.name);const status=document.createElement('small');owner.append(status);
    const list=document.createElement('div');list.className='skill-list';const buttons=[];
    [...h.skills,h.ultimate].forEach((id,slot)=>{
      const m=MOVES[id],button=document.createElement('button');button.type='button';button.className='skill-button'+(slot===3?' ultimate':'');
      button.setAttribute('aria-label',h.name+' '+m.name);button.title=`${m.name} · ${m.desc || '终极技'} · ${slot===3?'消耗满气槽':m.cooldown+' 秒冷却'}`;
      const icon=document.createElement('canvas');icon.width=icon.height=32;drawSkillIcon(icon,h,slot);icon.setAttribute('aria-hidden','true');
      const key=document.createElement('kbd'),name=document.createElement('strong'),state=document.createElement('span'),mask=document.createElement('i'),number=document.createElement('span');
      name.textContent=m.name;state.className='skill-state';mask.className='cooldown-mask';number.className='cooldown-number';number.setAttribute('aria-hidden','true');
      button.append(icon,key,name,state,mask,number);button.onclick=()=>{if(screen==='playing'&&world.active===i){audio.unlock();world.command(slot===3?'ultimate':'skill'+(slot+1));canvas.focus({preventScroll:true});}};
      list.append(button);buttons.push({button,key,state,mask,number,slot,id});
    });
    group.append(owner,list);$('skill-deck').append(group);skillGroups.push({group,status,buttons});
  });
}
window.addEventListener('resize',resize);applySettings();updateCasting();buildSkillDeck();
function hud() {
  world.heroes.forEach((h, i) => { const box = $('hero' + i); box.style.setProperty('--hero',h.color); box.querySelector('b').textContent=h.name; box.querySelector('small').textContent=h.subtitle; box.classList.toggle('inactive', i !== world.active); box.querySelector('em').textContent = h.hp <= 0 ? 'DOWN' : i === world.active ? 'PLAYER' : 'AI'; box.querySelector('.hp i').style.width = `${h.hp / h.maxHp * 100}%`; box.querySelector('.energy i').style.width = `${h.energy}%`; box.querySelector('.hero-numbers').textContent = `${Math.ceil(h.hp)} / ${h.maxHp}  ·  气 ${Math.floor(h.energy)}${h.energy >= 100 ? '  U 大招就绪' : ''}`; });
  skillGroups.forEach(({group,status,buttons},i)=>{
    const h=world.heroes[i], active=i===world.active;group.classList.toggle('active',active);status.textContent=h.hp<=0?'倒地 / 救援':active?'主控 / PLAYER':'搭档 / AUTO';
    for(const {button,key,state,mask,number,slot,id} of buttons){const cd=slot<3?h.skillCD[slot]:0, ratio=slot<3?cd/MOVES[id].cooldown:1-h.energy/100, reason=world.skillReason(h,slot);
      key.textContent=input.device==='gamepad'?['LT+X','LT+Y','LT+B','LT+A'][slot]:['1','2','3','U'][slot];button.disabled=screen!=='playing'||!active||!!reason;button.classList.toggle('ready',!reason);
      mask.hidden=ratio<=0;mask.style.transform=`scaleY(${Math.max(0,Math.min(1,ratio))})`;number.textContent=cd>0?Math.ceil(cd):'';number.hidden=cd<=0;state.textContent=slot===3?(h.energy>=100?'终极就绪':Math.floor(h.energy)+'% 气'):cd>0?'冷却中':reason?'等待行动':'就绪';}
  });
  $('team-number').textContent = Math.floor(world.meter) + '%'; $('team-fill').style.width = world.meter + '%';
  $('zone-label').textContent = `${ZONES[world.zone].short} / ${world.cleared ? '向右推进 →' : '第 ' + Math.max(1, world.wave + 1) + ' 波'}`;
  $('ai-label').textContent = '搭档：' + AI_LEVELS[settings.ai].name;
  const boss = world.enemies.find(e => e.boss && e.hp > 0); $('boss-hud').hidden = !boss; if (boss) $('boss-hud').querySelector('i').style.width = boss.hp / boss.maxHp * 100 + '%';
  $('device').textContent = input.device === 'gamepad' ? 'GAMEPAD CONNECTED' : 'KEYBOARD READY';
  $('hint').textContent = input.device === 'gamepad' ? 'LT＋X/Y/B 技能 · LT＋A 终极 · RB 切换 · RT 双响' : world.zone === 0 ? 'WASD 移动 · J/K 攻击 · 1/2/3 技能 · U 终极 · Q 切换' : 'E 拾取 / 救援 · K 投掷 · U 大招 · I 接力 / 合击 / 终结';
  if (dev) $('debug-state').textContent = JSON.stringify({ screen, time: world.time, fps: Math.round(fps), active: world.active, zone: world.zone, wave: world.wave, mode: world.mode, meter: Math.round(world.meter), cinema: world.cinematic?.type, heroes: world.heroes.map(h => ({ id: h.id, x: Math.round(h.x), y: Math.round(h.y), z: Math.round(h.z), hp: h.hp, energy: Math.round(h.energy), skillCD: h.skillCD.map(v=>+v.toFixed(2)), action: h.action?.id, ai: h.aiState, decisions: h.decisions })), enemies: world.enemies.map(e => ({ kind: e.kind, x: Math.round(e.x), y: Math.round(e.y), hp: e.hp })), stats: world.stats });
}
function loop(now) {
  const elapsed = (now - previous) / 1000, dt = Math.min(.05, elapsed); previous = now; fps = fps * .95 + .05 / Math.max(.001, elapsed);
  input.poll();
  if (screen === 'playing') {
    const before = world.time;
    acc += dt;
    while (acc >= STEP) { world.player.input = input.movement(); world.update(STEP); acc -= STEP; }
    const events = world.events.splice(0); renderer.handle(events, world); for (const e of events) audio.play(e.type);
    renderer.tick(world.time-before);
    if (world.mode !== lastMode) { lastMode = world.mode; if (['won', 'lost'].includes(world.mode)) results(); }
  } else if (screen === 'title') { renderer.elapsed += dt; }
  renderer.render(world, { debug: dev && debug, fps, title: screen === 'title' || (screen === 'moves' && movesReturn === 'title') }); if (now-lastHud >= 50) { hud(); lastHud=now; } requestAnimationFrame(loop);
}
// Explicitly opt-in local development seam for deterministic QA; absent from normal play.
if (dev) { window.streetDuet = { world, renderer, input, start, pause, home, get team() { return [...settings.team]; }, get screen() { return screen; } }; const out = document.createElement('output'); out.id = 'debug-state'; out.hidden = true; document.body.append(out); }
show('title'); requestAnimationFrame(loop);
