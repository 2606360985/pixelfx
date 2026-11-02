// All timing is in seconds, distances in art pixels. Controllers share these definitions.
export const WIDTH = 480, HEIGHT = 270, STEP = 1 / 60;
export const AI_LEVELS = { basic: { name: '基础', interval: .45 }, skilled: { name: '熟练', interval: .25 }, expert: { name: '高手', interval: .12 } };
export const HEROES = [
  { id: 'swift', name: '凌风', subtitle: '疾腿 · 追击', role: '长腿快攻', bio: '话少，脚快。修车铺打烊之后，他替老街守最后一盏灯。', age: 32, hp: 110, speed: 96, color: '#69c2b2', dark: '#253b43', trim: '#cf8a51', style: 'kick', combo: ['jab', 'elbow', 'kick'], heavy: 'launch', aerial: 'airkick', rush: 'rushkick', ultimate: 'flurry', throwPower: 210, throwDamage: 16, skills: ['streetkick', 'lampkick', 'turnkick'], profile: { metrics: { pelvis: 22.5, thigh: 10, shin: 9.8, upper: 8.2, fore: 8.3, shoulderOut: 5.3 }, thickness: .88 } },
  { id: 'stone', name: '磐石', subtitle: '重拳 · 破阵', role: '重拳破防', bio: '围裙没摘，摊子还热。拳头有分量，做人的道理也一样。', age: 41, hp: 160, speed: 76, color: '#e5a161', dark: '#293b52', trim: '#b6603f', style: 'power', combo: ['fist', 'body', 'palm'], heavy: 'shoulder', aerial: 'airslam', rush: 'rushbody', ultimate: 'quake', throwPower: 260, throwDamage: 24, skills: ['opener', 'pilefist', 'alleystomp'], profile: { metrics: { pelvis: 18.8, thigh: 8.2, shin: 7.6, shoulderOut: 7.2, upper: 8, fore: 7.8 }, thickness: 1.22 } },
  { id: 'roller', name: '小满', subtitle: '轮舞 · 连击', role: '轮滑快攻', bio: '24 岁。送完最后一单，轮子不停；这条街的快乐，由她加速。', age: 24, hp: 115, speed: 108, color: '#ef9c9c', dark: '#346b68', trim: '#efd69b', style: 'roller', combo: ['rollerjab', 'rollerkick', 'rollerheel'], heavy: 'rollerlaunch', aerial: 'rollerair', rush: 'rollerslide', ultimate: 'meteor', throwPower: 200, throwDamage: 16, skills: ['slidestrike', 'wheelkick', 'wheelspin'], profile: { metrics: { pelvis: 20.2, thigh: 9, shin: 8.7, shoulderOut: 4.6, hipOut: 3.2, upper: 7.2, fore: 7.3 }, thickness: .83 } },
  { id: 'fan', name: '绯绫', subtitle: '扇影 · 控场', role: '扇术控场', bio: '29 岁。茶馆老板娘，笑里有风。扇开是人情，扇合是规矩。', age: 29, hp: 125, speed: 88, color: '#cf7181', dark: '#322c40', trim: '#e1b877', style: 'fan', combo: ['fantap', 'fancross', 'fansweep'], heavy: 'fanheavy', aerial: 'fanair', rush: 'fanrush', ultimate: 'scarlet', throwPower: 215, throwDamage: 18, skills: ['swallow', 'returnwind', 'fanwheel'], profile: { metrics: { pelvis: 22, thigh: 10.1, shin: 9.5, shoulderOut: 4.5, hipOut: 3.5, upper: 7.5, fore: 7.8 }, thickness: .84 } },
];
export function teamIds(ids) {
  const valid = Array.isArray(ids) ? ids.filter(id => HEROES.some(h => h.id === id)) : [];
  const result = [...new Set(valid)].slice(0, 2);
  for (const h of HEROES) if (result.length < 2 && !result.includes(h.id)) result.push(h.id);
  return result;
}
const move = (name, startup, active, recovery, damage, reach, extra = {}) => ({ name, startup, active, recovery, duration: startup + active + recovery, damage, reach, push: 38, depth: 15, ...extra });
export const MOVES = {
  jab: move('直拳', .1, .07, .16, 10, 29, { combo: true }),
  elbow: move('肘击', .1, .07, .18, 12, 29, { combo: true }),
  kick: move('侧踢', .14, .09, .24, 19, 43, { push: 115 }),
  fist: move('短拳', .15, .07, .18, 14, 28, { combo: true }),
  body: move('腹拳', .15, .08, .19, 17, 29, { combo: true }),
  palm: move('重掌', .22, .09, .28, 27, 35, { push: 160, heavy: true }),
  launch: move('上挑踢', .2, .12, .3, 25, 38, { launch: 150, heavy: true, push: 30 }),
  shoulder: move('破阵肩撞', .25, .14, .3, 34, 38, { push: 200, heavy: true, travel: 125 }),
  airkick: move('飞踢', .07, .16, .2, 20, 43, { push: 110 }),
  airslam: move('坠地压击', .16, .22, .3, 28, 38, { heavy: true, push: 120, radial: true, depth: 26 }),
  rushkick: move('疾步冲踢', .12, .12, .26, 23, 44, { travel: 175, push: 140 }),
  rushbody: move('铁山靠', .19, .14, .32, 32, 36, { travel: 155, push: 190, heavy: true }),
  tool: move('折凳挥击', .18, .12, .26, 25, 47, { heavy: true, push: 125 }),
  flurry: move('疾影连踢', .15, .85, .35, 13, 66, { pulses: 5, heavy: true, push: 28, launch: 90, armor: true, depth: 26 }),
  quake: move('震街重踏', .35, .18, .5, 65, 90, { radial: true, depth: 55, heavy: true, push: 240, launch: 110, armor: true }),
  enemyjab: move('挥拳', .42, .12, .55, 10, 29),
  enemyheavy: move('板凳横扫', .65, .16, .7, 17, 43, { heavy: true, push: 90 }),
  charge: move('冲锋', .8, .5, .7, 19, 30, { travel: 190, push: 145, heavy: true }),
  sweep: move('招牌横扫', .75, .2, .65, 23, 65, { heavy: true, depth: 25, radial: true, push: 140 }),
  bosscharge: move('暴走冲撞', .85, .65, .6, 27, 36, { travel: 205, push: 190, heavy: true }),
  bossslam: move('震地猛击', .95, .16, .8, 28, 85, { radial: true, depth: 50, heavy: true, launch: 80, push: 120 }),
  rollerjab: move('滑拳', .09, .08, .15, 10, 30, { combo: true, pose: 'punch' }),
  rollerkick: move('轮踢', .1, .1, .17, 12, 37, { combo: true, pose: 'kick' }),
  rollerheel: move('翻轮踢', .15, .12, .22, 20, 44, { pose: 'kick', push: 115 }),
  rollerlaunch: move('跃轮挑', .2, .12, .3, 24, 37, { pose: 'kick', launch: 145, heavy: true, push: 25 }),
  rollerair: move('空中轮踢', .08, .16, .2, 20, 43, { pose: 'kick', push: 95 }),
  rollerslide: move('滑轮追击', .1, .14, .25, 22, 43, { pose: 'kick', travel: 180, push: 110 }),
  fantap: move('点扇', .12, .07, .17, 11, 36, { combo: true, pose: 'fan' }),
  fancross: move('折扇挑', .12, .09, .19, 13, 40, { combo: true, pose: 'fan' }),
  fansweep: move('拂袖扫', .2, .12, .25, 22, 48, { pose: 'fan', push: 130 }),
  fanheavy: move('合扇破', .24, .12, .3, 29, 45, { pose: 'fan', heavy: true, push: 150 }),
  fanair: move('凌空扇', .1, .14, .22, 21, 46, { pose: 'fan', push: 100 }),
  fanrush: move('穿花步', .15, .14, .28, 25, 45, { pose: 'fan', travel: 135, push: 130 }),
  streetkick: move('穿街踢', .15, .2, .28, 28, 48, { cooldown: 5, pose: 'kick', fx: 'cleave', travel: 190, push: 155, heavy: true, purpose: 'dash', desc: '突进踢击，撞开前方敌人' }),
  lampkick: move('挑灯腿', .2, .14, .3, 30, 43, { cooldown: 7, pose: 'kick', fx: 'uppercut', launch: 175, push: 20, heavy: true, purpose: 'launch', desc: '挑空近敌，创造接力机会' }),
  turnkick: move('回身扫', .22, .2, .32, 32, 57, { cooldown: 9, pose: 'spin', fx: 'spin', radial: true, depth: 30, heavy: true, push: 140, purpose: 'crowd', desc: '周身扫腿，击退包围' }),
  opener: move('开路靠', .22, .24, .32, 36, 42, { cooldown: 6, pose: 'shoulder', fx: 'cleave', travel: 150, heavy: true, armor: true, push: 180, purpose: 'dash', desc: '霸体肩撞，正面破防' }),
  pilefist: move('落桩拳', .28, .14, .35, 38, 36, { cooldown: 8, pose: 'punch', fx: 'uppercut', heavy: true, launch: 155, push: 25, purpose: 'launch', desc: '沉重上勾拳，击飞近敌' }),
  alleystomp: move('震巷踏', .32, .2, .4, 40, 66, { cooldown: 10, pose: 'slam', fx: 'slam', radial: true, depth: 38, heavy: true, push: 180, purpose: 'crowd', desc: '重踏地面，震退周围敌人' }),
  slidestrike: move('滑步撞', .1, .22, .24, 25, 43, { cooldown: 4, pose: 'slide', fx: 'cleave', travel: 215, heavy: true, push: 120, purpose: 'dash', desc: '低身滑撞，快速切入战场' }),
  wheelkick: move('跃轮踢', .16, .18, .3, 29, 42, { cooldown: 7, pose: 'wheel', fx: 'uppercut', heavy: true, launch: 160, push: 20, purpose: 'launch', desc: '跃起轮踢，挑飞前方敌人' }),
  wheelspin: move('旋轮舞', .18, .48, .28, 11, 55, { cooldown: 9, pose: 'spin', fx: 'spin', pulses: 3, radial: true, depth: 30, heavy: true, push: 25, finalPush: 130, purpose: 'crowd', desc: '三段旋转踢，扫开近身包围' }),
  swallow: move('燕返扇', .16, .3, .26, 16, 65, { cooldown: 5, pose: 'fan', fx: 'double', pulses: 2, depth: 23, push: 22, finalPush: 85, heavy: true, purpose: 'launch', desc: '交叉双扇，连续攻击前方' }),
  returnwind: move('回风步', .13, .26, .28, 27, 72, { cooldown: 7, pose: 'fan', fx: 'cleave', travel: -95, push: 160, heavy: true, purpose: 'retreat', desc: '后撤拂扇，拉开安全距离' }),
  fanwheel: move('绯扇圆舞', .24, .22, .34, 35, 72, { cooldown: 10, pose: 'spin', fx: 'spin', radial: true, depth: 38, push: 145, heavy: true, purpose: 'crowd', desc: '圆舞扫扇，令周围敌人失衡' }),
  meteor: move('满街流星', .2, .95, .4, 14, 75, { pose: 'wheel', fx: 'spin', finalRadial: true, pulses: 5, travel: 100, depth: 30, heavy: true, armor: true, push: 20, finalPush: 190, launch: 100, desc: '滑行五段连踢，末段周身横扫' }),
  scarlet: move('绯影千叠', .3, .85, .4, 17, 105, { pose: 'fan', fx: 'double', pulses: 4, depth: 40, heavy: true, armor: true, push: 20, finalPush: 210, desc: '宽范围四段扇击，末段强力击退' }),
};
Object.assign(MOVES.flurry, { fx: 'double', pose: 'kick', desc: '五段疾踢，末段挑飞' });
Object.assign(MOVES.quake, { fx: 'slam', pose: 'slam', desc: '蓄力重踏，大范围震街' });
export const ENEMIES = {
  punk: { name: '快拳仔', hp: 90, speed: 57, color: '#c28bd7', dark: '#634365', move: 'enemyjab' },
  guard: { name: '板凳壮汉', hp: 135, speed: 40, color: '#a9c775', dark: '#4b5844', move: 'enemyheavy', guard: true, profile: HEROES[1].profile },
  charger: { name: '冲锋客', hp: 105, speed: 51, color: '#e99a83', dark: '#713746', move: 'charge' },
  boss: { name: '招牌王', hp: 720, speed: 42, color: '#ef7180', dark: '#6f3048', move: 'sweep', boss: true, profile: { metrics: { pelvis: 22, shoulderOut: 8, upper: 9, fore: 9, thigh: 10, shin: 9 }, thickness: 1.38 } },
};
export const ZONES = [
  { name: '街口 · 初来乍到', short: '街口', start: 0, end: 600, waves: [['punk', 'punk', 'punk', 'punk'], ['punk', 'guard', 'punk', 'punk'], ['charger', 'punk', 'punk', 'guard']] },
  { name: '瓜摊 · 今晚不打烊', short: '瓜摊', start: 600, end: 1200, waves: [['guard', 'punk', 'charger', 'punk', 'punk'], ['charger', 'guard', 'punk', 'guard', 'punk'], ['punk', 'charger', 'guard', 'punk', 'charger', 'punk']] },
  { name: '街尾 · 招牌之争', short: '街尾', start: 1200, end: 1800, waves: [['boss', 'punk', 'charger']] },
];
export const neutral = () => ({ x: 0, y: 0, held: false });
