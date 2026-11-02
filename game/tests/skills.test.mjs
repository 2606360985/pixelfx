import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../world.js';
import { HEROES, MOVES, STEP, teamIds } from '../data.js';

function arena(team) {
  const w=new World({team});w.props=[];w.pickups=[];w.waveDelay=1e6;w.partner.think=1e6;w.player.x=200;w.player.y=210;return w;
}

test('saved team inputs are normalised to two distinct known characters',()=>{
  assert.deepEqual(teamIds(['fan','fan','missing']),['fan','swift']);
  assert.deepEqual(teamIds(null),['swift','stone']);
  assert.deepEqual(teamIds(['roller','fan','stone']),['roller','fan']);
});

for(const def of HEROES) {
  test(`${def.id}: all four skills spend once, hit only once per pulse, and finish`,()=>{
    for(let slot=0;slot<4;slot++) {
      const w=arena([def.id,def.id==='stone'?'swift':'stone']),h=w.player;
      const e=w.spawn('punk',220,210);e.think=1e6;e.hp=e.maxHp=10000;h.energy=100;
      const id=slot===3?h.ultimate:h.skills[slot],m=MOVES[id];
      assert.equal(w.useSkill(h,slot),true);assert.equal(h.action.id,id);
      assert.equal(h.energy,slot===3?0:100);assert.equal(slot<3?h.skillCD[slot]:0,m.cooldown??0);
      assert.equal(w.useSkill(h,slot),false);assert.equal(w.partner.hp,w.partner.maxHp);
      for(let i=0;i<240&&h.action;i++) {
        // Keep the target inside the attack to measure the maximum legal pulse count.
        e.x=h.x+20;e.y=h.y;e.z=0;e.vx=e.vz=0;w.update(STEP);
      }
      assert.equal(h.action,null);assert.equal(10000-e.hp,m.damage*(m.pulses??1));
      assert.equal(w.events.filter(e=>e.type==='active'&&e.move===id).length,1);
      assert.ok(h.skillCD.every(Number.isFinite));
    }
  });
  test(`${def.id}: invalid skill states spend no resources and never queue later`,()=>{
    const invalid=[h=>h.hp=0,h=>h.stun=1,h=>h.grabbedBy={},h=>h.dodge=.2,h=>h.z=.01,h=>h.vz=1,h=>h.carried={},h=>h.grab={},h=>h.action={id:'jab'}];
    for(const setup of invalid) {
      const w=arena([def.id,'stone']),h=w.player;h.energy=100;setup(h);
      for(let slot=0;slot<4;slot++)assert.equal(w.useSkill(h,slot),false);
      assert.deepEqual(h.skillCD,[0,0,0]);assert.equal(h.energy,100);assert.equal(h.buffer,null);
    }
    const w=arena([def.id,'stone']);assert.equal(w.useSkill(w.player,3),false);assert.equal(w.player.action,null);
  });
  test(`${def.id}: AI uses small skills without spending either special meter`,()=>{
    for(const ai of ['basic','skilled','expert']){
      const w=arena(['stone',def.id]);w.ai=ai;const h=w.partner;h.think=0;h.energy=100;w.meter=100;
      w.spawn('punk',h.x+20,h.y).think=1e6;
      w.thinkPartner(h,STEP);assert.ok(h.action,ai);assert.ok(h.skills.includes(h.action.id));
      assert.equal(h.energy,100);assert.equal(w.meter,100);assert.ok(h.skillCD.some(v=>v>0));
    }
  });
}

test('misses and interruptions keep cooldown; switching preserves it and checkpoints restore it',()=>{
  const w=arena(['roller','fan']),a=w.player;
  w.command('skill1');const spent=a.skillCD[0];w.hit({hero:false,x:150},a,3);assert.equal(a.action,null);assert.equal(a.skillCD[0],spent);
  w.switchHero();w.update(STEP);assert.equal(a.skillCD[0],spent,'hitstop freezes cooldown');
  w.hitstop=0;a.stun=0;w.update(STEP);assert.ok(a.skillCD[0]<spent,'inactive character cools down');
  w.saveCheckpoint();const saved=a.skillCD[0];a.skillCD[0]=0;w.team=['swift','stone'];w.retry();
  assert.deepEqual(w.heroes.map(h=>h.id),['roller','fan']);assert.equal(w.heroes[0].skillCD[0],saved);
  w.reset();assert.deepEqual(w.heroes.map(h=>h.id),['roller','fan']);assert.deepEqual(w.heroes[0].skillCD,[0,0,0]);
});

test('cinematics and stopped worlds freeze both cooldowns; skills cannot start during them',()=>{
  const w=arena(),a=w.player;a.skillCD[0]=4;
  w.mode='lost';w.update(STEP);assert.equal(a.skillCD[0],4);assert.equal(w.useSkill(a,1),false);
  w.mode='playing';const e=w.spawn('punk',220,210);e.think=1e6;w.beginCinema('team',e);
  w.update(STEP);assert.equal(a.skillCD[0],4);assert.equal(w.useSkill(a,1),false);
});

for(const first of HEROES)for(const second of HEROES.filter(h=>h.id!==first.id)) {
  test(`${first.id}/${second.id}: switch, throw, rescue, finisher and retry retain team identities`,()=>{
    const w=arena([first.id,second.id]),a=w.player,b=w.partner;
    w.command('light');assert.equal(a.action.id,a.combo[0]);w.switchHero();assert.equal(w.player,b);assert.ok(a.action);
    a.action=null;const e=w.spawn('punk',b.x+20,b.y);e.think=1e6;e.stun=1;
    w.command('heavy');assert.equal(b.grab,e);w.command('heavy');assert.equal(e.grabbedBy,null);assert.ok(e.thrown);
    w.hit({hero:false,x:b.x-10},b,999);assert.equal(w.player,a);a.x=b.x+10;a.y=b.y;a.action=null;a.stun=0;
    for(let i=0;i<121;i++)w.reviveActor(a,b,STEP);assert.equal(b.hp,b.maxHp*.3);
    e.x=a.x+20;e.y=a.y;e.z=0;e.hp=1;e.stun=1;b.x=a.x+25;b.y=a.y;b.action=null;b.stun=0;w.hitstop=0;
    w.cooperate();assert.equal(w.cinematic?.type,'finish');for(let i=0;i<80;i++)w.update(STEP);assert.equal(e.hp,0);assert.equal(w.cinematic,null);
    w.saveCheckpoint();w.heroes.forEach(h=>h.hp=0);w.retry();assert.deepEqual(w.heroes.map(h=>h.id),[first.id,second.id]);
  });
}


test('roller ultimate only sweeps behind the player on its final pulse',()=>{
  const w=arena(['roller','fan']),a=w.player,e=w.spawn('punk',180,210);e.think=1e6;e.hp=e.maxHp=10000;a.energy=100;
  w.useSkill(a,3);
  for(let i=0;i<240&&a.action;i++){e.x=a.x-20;e.y=a.y;e.z=0;e.vx=e.vz=0;w.update(STEP);}
  assert.equal(10000-e.hp,MOVES.meteor.damage);
});
