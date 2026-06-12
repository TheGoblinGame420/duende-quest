// ═══════════════════════════════════════════════════════
// DUENDE QUEST — GAME ENGINE (único, compartido)
// Usado por game.html (web) y telegram/index.html (Mini App).
// Las divergencias por plataforma se inyectan via window.DQE,
// definido ANTES de cargar este script:
//   DQE.assetBase        'assets/' | '../assets/'
//   DQE.haptic(type)     vibración (Telegram) — opcional
//   DQE.getSkinBuffs()   {coinMult,atkMult,lifesteal,bonusHp,aura} | null
//   DQE.getPlayerImgKey()clave de IMG_EL para el sprite del jugador
//   DQE.menuOverlayId    'ov-menu' | 'ov-start'
//   DQE.airSlamNeedsKey  true (web: C/↓) | false (tg: cualquier ataque aéreo)
//   DQE.music            ruta mp3 | null
//   DQE.fitCanvas()      override del ajuste de canvas — opcional
//   DQE.onStartGame()    extras al iniciar (inventario web / botones tg)
//   DQE.onEndGame(stats) extras al morir (submit score, fomo, ranking)
//   DQE.onToMenu()       extras al volver al menú
//   DQE.loopTick()       llamado cada frame (ej. refresco de precio)
// ═══════════════════════════════════════════════════════
'use strict';
window.DQE = window.DQE || {};
const _hap = t => { try { DQE.haptic && DQE.haptic(t); } catch (e) {} };
const _buffs = () => { try { return (DQE.getSkinBuffs && DQE.getSkinBuffs()) || null; } catch (e) { return null; } };
const $id = id => document.getElementById(id);

// ── ASSETS ──
const _AB = DQE.assetBase || 'assets/';
const IMG = {
  duende_hero: _AB + 'skins/skin_hero.png',
  enemy: _AB + 'enemigos/enemy.png',
  enemy2: _AB + 'enemigos/enemy2.png',
  enemy_magmar: _AB + 'enemigos/enemy_magmar.png',
  coin: _AB + 'ui/coin.png',
  item_potion: _AB + 'items/item_potion.png',
  item_shield: _AB + 'items/item_shield.png',
  item_skill: _AB + 'items/item_skill.png',
  skill_fire: _AB + 'items/skill_fire.png',
  cofre_comun: _AB + 'cofres/cofre_comun.png',
  cofre_epico: _AB + 'cofres/cofre_epico.png',
  cofre_legendario: _AB + 'cofres/cofrelegendario.png',
  katana_comun: _AB + 'armas/katana_comun_item.png',
  katana_spark: _AB + 'armas/katana_spark_item.png',
  skin_berserker: _AB + 'skins/skin_berserker.png',
  skin_king: _AB + 'skins/skin_king.png',
  skin_tactico: _AB + 'skins/skin_tactico.png',
};
const IMG_EL = {};
Object.entries(IMG).forEach(([k, v]) => { const el = new Image(); el.src = v; IMG_EL[k] = el; });

function setSlotImgs() {
  const keys = ['item_potion', 'item_shield', 'item_skill', 'skill_fire'];
  ['is0', 'is1', 'is2', 'is3'].forEach((id, i) => { const el = $id(id); if (el) el.src = IMG[keys[i]]; });
  ['si0', 'si1', 'si2', 'si3'].forEach((id, i) => { const el = $id(id); if (el) el.src = IMG[keys[i]]; });
}
window.addEventListener('load', setSlotImgs);

// ── CANVAS ──
const cv = $id('gc');
const cx = cv.getContext('2d');
cx.imageSmoothingEnabled = false;
const W = 800, H = 320, GY = 240;
function fitCanvas() {
  if (DQE.fitCanvas) { DQE.fitCanvas(cv, W, H); return; }
  const container = cv.parentElement;
  const maxW = Math.min(container.clientWidth, W);
  const scale = maxW / W;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  cv.style.transform = 'scale(' + scale + ')'; cv.style.transformOrigin = 'top left';
  container.style.height = (H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
document.addEventListener('DOMContentLoaded', fitCanvas);

// ── CONSTANTS ──
const GRAVITY = 0.65, JUMP_FORCE = -14, DJUMP_FORCE = -11;
const DASH_SPEED = 14, DASH_DUR = 14, DASH_CD = 45;
const COMBO_WINDOW = 90;
const ITEM_SHOPS = [
  { name: 'ENERGY', price: 15, maxStock: 5 },
  { name: 'SHIELD', price: 25, maxStock: 3 },
  { name: 'RAYO', price: 35, maxStock: 2 },
  { name: 'FIRE', price: 30, maxStock: 2 },
];

// ── GAME STATE (globals — las páginas leen/escriben estos) ──
let state = 'menu';
let frame = 0, score = 0, hiScore = +localStorage.getItem('dq_hi') || 0, wave = 1;
let gameSpeed = 3.5, baseSpeed = 3.5;
let totalCoins = 0, sessionCoins = 0;
let waveTimer = 0, bossActive = false, bossKilled = 0;
let raf = null, lastTs = 0;
let keys = {};
let mLeft = false, mRight = false;

// ── XP / LEVEL ──
let playerXP = 0, playerLevel = 1;
const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
function getXPNeeded(lvl) { return XP_PER_LEVEL[Math.min(lvl, XP_PER_LEVEL.length - 1)] || 4000 + (lvl - 10) * 600; }
function addXP(amt) {
  playerXP += amt;
  const needed = getXPNeeded(playerLevel);
  if (playerXP >= needed) { playerXP -= needed; playerLevel++; onLevelUp(); }
  updateXPBar();
}
function updateXPBar() {
  const needed = getXPNeeded(playerLevel);
  const pct = Math.min(playerXP / needed, 1) * 100;
  const f = $id('xp-fill'); if (f) f.style.width = pct + '%';
  const b = $id('level-badge'); if (b) b.textContent = 'LVL ' + playerLevel;
  const h = $id('h-level'); if (h) h.textContent = playerLevel;
}
function onLevelUp() {
  saveProgress();
  const bonus = playerLevel % 3;
  if (bonus === 0) { PL.maxHp += 20; PL.hp = Math.min(PL.hp + 20, PL.maxHp); showPUNotif('❤️ MAX HP +20!'); }
  else if (bonus === 1) { comboMultiplier = Math.min(comboMultiplier + .5, 8); showPUNotif('⚡ COMBO MAX +0.5!'); }
  else { PL.items[0][0] = Math.min(PL.items[0][0] + 1, 6); showPUNotif('🧪 +1 POCION!'); }
  spawnFT(PL.x, PL.y - 40, 'LEVEL UP!', '#c084fc', true);
  shake(8); playSound('levelup'); _hap('heavy');
  const badge = $id('level-badge');
  if (badge) { badge.classList.remove('lvlup'); void badge.offsetWidth; badge.classList.add('lvlup'); }
  updateXPBar(); updateHpHUD();
}

// ── POWER-UP NOTIF ──
let puTimer = null;
function showPUNotif(msg) {
  const el = $id('pu-notif'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  clearTimeout(puTimer);
  puTimer = setTimeout(() => el.classList.remove('show'), 2000);
}

// ── AUDIO ──
let audioCtx = null;
function getAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return audioCtx; }
function playSound(type) {
  try {
    const ac = getAudio();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    const now = ac.currentTime;
    if (type === 'jump') { o.frequency.setValueAtTime(220, now); o.frequency.exponentialRampToValueAtTime(440, now + .1); g.gain.setValueAtTime(.15, now); g.gain.exponentialRampToValueAtTime(.001, now + .15); o.start(now); o.stop(now + .15); }
    else if (type === 'attack') { o.type = 'sawtooth'; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(80, now + .08); g.gain.setValueAtTime(.2, now); g.gain.exponentialRampToValueAtTime(.001, now + .1); o.start(now); o.stop(now + .1); }
    else if (type === 'hit') { o.type = 'square'; o.frequency.setValueAtTime(120, now); g.gain.setValueAtTime(.25, now); g.gain.exponentialRampToValueAtTime(.001, now + .12); o.start(now); o.stop(now + .12); }
    else if (type === 'coin') { o.frequency.setValueAtTime(660, now); o.frequency.exponentialRampToValueAtTime(880, now + .06); g.gain.setValueAtTime(.1, now); g.gain.exponentialRampToValueAtTime(.001, now + .1); o.start(now); o.stop(now + .1); }
    else if (type === 'dash') { o.type = 'triangle'; o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(600, now + .12); g.gain.setValueAtTime(.15, now); g.gain.exponentialRampToValueAtTime(.001, now + .15); o.start(now); o.stop(now + .15); }
    else if (type === 'levelup') { [261, 329, 392, 523].forEach((f, i) => { const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.connect(g2); g2.connect(ac.destination); o2.frequency.value = f; g2.gain.setValueAtTime(.12, now + i * .08); g2.gain.exponentialRampToValueAtTime(.001, now + i * .08 + .15); o2.start(now + i * .08); o2.stop(now + i * .08 + .15); }); return; }
    else if (type === 'boss') { o.type = 'sawtooth'; o.frequency.setValueAtTime(60, now); g.gain.setValueAtTime(.3, now); g.gain.exponentialRampToValueAtTime(.001, now + .4); o.start(now); o.stop(now + .4); }
    else if (type === 'die') { o.type = 'sawtooth'; o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(30, now + .5); g.gain.setValueAtTime(.3, now); g.gain.exponentialRampToValueAtTime(.001, now + .5); o.start(now); o.stop(now + .5); }
  } catch (e) {}
}

// ── MUSIC (opcional via DQE.music) ──
let bgMusic = null;
function initMusic() { if (bgMusic || !DQE.music) return; bgMusic = new Audio(DQE.music); bgMusic.loop = true; bgMusic.volume = 0.35; }
function playMusic() { initMusic(); if (bgMusic) bgMusic.play().catch(() => {}); }
function pauseMusic() { if (bgMusic) bgMusic.pause(); }
function stopMusic() { if (bgMusic) { bgMusic.pause(); bgMusic.currentTime = 0; } }

// ── PLAYER ──
const PL = {
  x: 80, y: GY, w: 52, h: 68, vx: 0, vy: 0,
  onGround: false, jumping: false, djUsed: false,
  coyoteTimer: 0, jumpBuffer: 0,
  dashing: false, dashTimer: 0, dashDir: 1, dashCd: 0,
  comboStep: 0, comboTimer: 0, attackTimer: 0, attackCd: 0,
  attackHitbox: { x: 0, y: 0, w: 0, h: 0, active: false },
  slamming: false, slamTimer: 0,
  hp: 100, maxHp: 100, invTimer: 0,
  items: [[3, 0, 90], [2, 0, 120], [1, 0, 150], [1, 0, 180]],
  shieldOn: false, shieldTimer: 0, fireOn: false, fireTimer: 0,
  lightTimer: 0, flashTimer: 0, facing: 1, animTimer: 0, runFrame: 0,
};

// ── ENTITIES ──
let enemies = [], coins = [], bullets = [], particles = [], fTexts = [];
let chests = [], weaponDrops = [];
let bgStars = [], bgMtns = [], bgClouds = [];
let groundX = 0;
let weaponBuff = null;
let comboCount = 0, comboTimer = 0, comboMultiplier = 1;
let killStreak = 0, killStreakTimer = 0;
let shakeAmt = 0, shakeTimer = 0;
function shake(a) { shakeAmt = a; shakeTimer = Math.ceil(a * 1.5); }

function spawnPFX(x, y, color, n, spd, sz = 4) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = spd * (.5 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, life: 1, decay: .035 + Math.random() * .03, sz: sz * (.5 + Math.random()) });
  }
}
function spawnFT(x, y, txt, color, big = false) { fTexts.push({ x, y, txt, color, life: 1, decay: .022, vy: -1.8, big }); }

function initBg() {
  bgStars = []; for (let i = 0; i < 90; i++) bgStars.push({ x: Math.random() * W, y: Math.random() * GY, s: .5 + Math.random() * 2, sp: .1 + Math.random() * .4 });
  bgMtns = []; for (let i = 0; i < 8; i++) bgMtns.push({ x: i * (W / 4), h: 40 + Math.random() * 60, w: 120 + Math.random() * 80, sp: .3 + Math.random() * .3 });
  bgClouds = []; for (let i = 0; i < 5; i++) bgClouds.push({ x: Math.random() * W, y: 20 + Math.random() * 60, w: 80 + Math.random() * 60, h: 20 + Math.random() * 15, sp: .15 + Math.random() * .2, alpha: .04 + Math.random() * .06 });
}

// ── SPAWNS ──
function spawnEnemy(forceBoss = false) {
  const isBoss = forceBoss || (wave >= 4 && Math.random() < .12);
  const isFlyer = !isBoss && wave >= 3 && Math.random() < .35;
  const isCharger = !isBoss && !isFlyer && wave >= 2 && Math.random() < .3;
  const isExploder = !isBoss && !isFlyer && !isCharger && wave >= 5 && Math.random() < .2;
  const isGhost = !isBoss && !isFlyer && !isCharger && !isExploder && wave >= 6 && Math.random() < .15;
  const isMagmar = !isBoss && !isFlyer && !isCharger && !isExploder && !isGhost && wave >= 7 && Math.random() < .25;
  const baseHp = isBoss ? 8 : isMagmar ? 5 : isCharger ? 3 : isExploder ? 1 : 2;
  enemies.push({
    x: W + 30, y: isFlyer ? GY - 80 - Math.random() * 70 : GY,
    w: isBoss ? 96 : isFlyer ? 72 : isMagmar ? 80 : 68,
    h: isBoss ? 90 : isFlyer ? 68 : isMagmar ? 76 : 62,
    hp: baseHp, maxHp: baseHp,
    spd: (gameSpeed + (Math.random() * .8)) * (isBoss ? .75 : isCharger ? 1.6 : isMagmar ? .9 : 1),
    type: isBoss ? 'boss' : isFlyer ? 'flyer' : isCharger ? 'charger' : isExploder ? 'exploder' : isGhost ? 'ghost' : isMagmar ? 'magmar' : 'normal',
    isExploder, isGhost, ghostTimer: 0, ghostAlpha: 1,
    isFlyer, isBoss, isCharger, isMagmar,
    flashTimer: 0, bobTimer: Math.random() * Math.PI * 2,
    chargeTimer: isCharger ? 60 : 0,
    shootTimer: isBoss ? 120 : isMagmar ? 80 : 0,
    facing: -1, alive: true,
  });
  if (isBoss) { bossActive = true; spawnFT(W / 2 - 60, 80, '★ BOSS FIGHT ★', '#ff00cc', true); _hap('heavy'); }
  if (isMagmar) spawnFT(W / 2 - 60, 80, '🔥 MAGMAR!', '#ff4400', true);
}
function spawnChest(x, y, tier = 'comun') { chests.push({ x, y, w: 38, h: 38, spd: gameSpeed * .4, tier, bob: Math.random() * Math.PI * 2, glowTimer: 0 }); }
function spawnWeaponDrop(x, y) { const type = Math.random() < .6 ? 'katana_comun' : 'katana_spark'; weaponDrops.push({ x, y, w: 44, h: 24, spd: gameSpeed * .5, type, bob: Math.random() * Math.PI * 2 }); }
function spawnCoin(x, y) { coins.push({ x: x || W + 10, y: y || GY - 30 - Math.random() * 90, w: 28, h: 28, spd: gameSpeed * .7, bob: Math.random() * Math.PI * 2, magnetic: false }); }
function enemyShoot(e) { bullets.push({ x: e.x, y: e.y + e.h / 2, vx: -6, vy: 0, w: 18, h: 12, enemy: true, life: 1 }); }
function playerShoot() { bullets.push({ x: PL.x + PL.w, y: PL.y + PL.h * .4, vx: 10 + gameSpeed, vy: 0, w: 26, h: 16, enemy: false, life: 1 }); }

// ── ACTIONS ──
function jump() { if (state !== 'playing') return; PL.jumpBuffer = 12; }
function doJump() {
  playSound('jump'); _hap('light');
  if (PL.onGround || PL.coyoteTimer > 0) {
    PL.vy = JUMP_FORCE; PL.djUsed = false;
    spawnPFX(PL.x + PL.w / 2, PL.y + PL.h, '#00ff88', 8, 3.5);
    PL.coyoteTimer = 0;
  } else if (!PL.djUsed) {
    PL.vy = DJUMP_FORCE; PL.djUsed = true;
    spawnPFX(PL.x + PL.w / 2, PL.y + PL.h, '#00eeff', 14, 5);
    spawnFT(PL.x, PL.y - 10, 'DOUBLE!', '#00eeff');
  }
  PL.jumpBuffer = 0;
}
function dash() {
  playSound('dash'); _hap('medium');
  const nearEnemy = enemies.some(e => Math.abs(e.x - PL.x) < 80 && Math.abs(e.y - PL.y) < 60);
  if (nearEnemy && PL.dashCd <= 0) {
    setTimeout(() => { showPUNotif('💨 PERFECT DODGE! +XP'); addXP(15); addScore(50); }, 200);
  }
  if (state !== 'playing' || PL.dashCd > 0 || PL.dashing) return;
  PL.dashing = true; PL.dashTimer = DASH_DUR;
  PL.dashDir = PL.facing;
  PL.invTimer = Math.max(PL.invTimer, DASH_DUR + 4);
  PL.dashCd = DASH_CD;
  spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#7c3aed', 16, 6);
  spawnFT(PL.x, PL.y - 15, 'DASH!', '#a78bfa');
}
function attack() {
  playSound('attack'); _hap('medium');
  if (state !== 'playing' || PL.attackCd > 0 || PL.slamming) return;
  // Aerial slam: web requiere C/↓; en móvil/tg cualquier ataque aéreo cayendo
  const slamKey = DQE.airSlamNeedsKey === false ? true : (keys['KeyC'] || keys['ArrowDown']);
  if (!PL.onGround && PL.vy >= 0 && slamKey) {
    PL.slamming = true; PL.slamTimer = 20; PL.vy = 12;
    spawnFT(PL.x, PL.y - 15, 'SLAM!', '#ff6400', true);
    return;
  }
  if (PL.comboTimer > 0) PL.comboStep = (PL.comboStep + 1) % 3; else PL.comboStep = 0;
  PL.comboTimer = COMBO_WINDOW;
  PL.attackTimer = 14 + PL.comboStep * 2;
  PL.attackCd = 18 + PL.comboStep * 3;
  const reach = [50, 60, 80][PL.comboStep];
  const yOff = [10, 5, -5][PL.comboStep];
  PL.attackHitbox = { x: PL.x + (PL.facing > 0 ? PL.w : -reach), y: PL.y + yOff, w: reach, h: PL.h - yOff * 1.5, active: true };
  const colors = ['#ffe600', '#ff9900', '#ff3333'];
  spawnPFX(PL.attackHitbox.x + reach / 2, PL.y + PL.h / 2, colors[PL.comboStep], 6 + PL.comboStep * 4, 4 + PL.comboStep * 2);
}
function moveLeft(on) { mLeft = on; }
function moveRight(on) { mRight = on; }

// ── ITEMS ──
function useItem(slot) {
  if (state !== 'playing' && state !== 'paused') return;
  const it = PL.items[slot];
  if (it[0] <= 0 || it[1] > 0) return;
  it[0]--; it[1] = it[2];
  updateItemHUD(slot);
  if (slot === 0) { PL.hp = Math.min(PL.maxHp, PL.hp + 50); spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#00ff88', 20, 5); spawnFT(PL.x, PL.y - 20, '+50 HP', '#00ff88', true); }
  if (slot === 1) { PL.shieldOn = true; PL.shieldTimer = 300; PL.invTimer = Math.max(PL.invTimer, 300); spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#00eeff', 25, 6); spawnFT(PL.x, PL.y - 20, 'SHIELD!', '#00eeff', true); }
  if (slot === 2) { killAllEnemies(); PL.lightTimer = 35; shake(10); spawnFT(W / 2 - 80, H / 2 - 30, '⚡ LIGHTNING!', '#00eeff', true); }
  if (slot === 3) { PL.fireOn = true; PL.fireTimer = 360; spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff6400', 20, 5); spawnFT(PL.x, PL.y - 20, 'FIRE MODE!', '#ff6400', true); }
  updateHpHUD();
}
function killAllEnemies() {
  enemies.forEach(e => {
    const pts = (e.isBoss ? 300 : e.isMagmar ? 150 : e.type === 'charger' ? 80 : 60) * comboMultiplier;
    addScore(pts);
    spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#00eeff', 20, 7);
    spawnFT(e.x, e.y - 10, '+' + Math.floor(pts), '#00eeff');
    for (let c = 0; c < (e.isBoss ? 4 : e.isMagmar ? 2 : 1); c++) spawnCoin(e.x + Math.random() * e.w, e.y);
    missionEvent('kill', 1);
    if (e.isBoss) missionEvent('boss', 1);
  });
  enemies = [];
  bossActive = false;
}
function buyItem(slot) {
  const shop = ITEM_SHOPS[slot];
  if (sessionCoins < shop.price) { spawnFT(W / 2 - 60, H / 2, 'SIN MONEDAS', '#ff3333'); showPUNotif('SIN MONEDAS'); return; }
  if (PL.items[slot][0] >= shop.maxStock) { spawnFT(W / 2 - 60, H / 2, 'MÁXIMO', '#ff9900'); return; }
  sessionCoins -= shop.price;
  PL.items[slot][0]++;
  const el = $id('shop-coins-val'); if (el) el.textContent = sessionCoins;
  updateItemHUD(slot);
}

// ── SAVE / LOAD ──
function saveProgress() {
  localStorage.setItem('dq_save', JSON.stringify({
    hiScore, playerLevel, playerXP, totalCoins,
    items: JSON.parse(JSON.stringify(PL.items)),
  }));
}
function loadProgress() {
  const raw = localStorage.getItem('dq_save');
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    hiScore = d.hiScore || hiScore;
    playerLevel = d.playerLevel || 1;
    playerXP = d.playerXP || 0;
    totalCoins = d.totalCoins || 0;
    if (d.items) PL.items = d.items;
  } catch (e) { console.warn('Error loading save'); }
}

// ── SCORE ──
function addScore(pts) { score += pts; if (score > hiScore) { hiScore = score; localStorage.setItem('dq_hi', hiScore); } }
function hitCombo(pts) {
  comboCount++;
  comboTimer = COMBO_WINDOW;
  comboMultiplier = Math.min(1 + Math.floor(comboCount / 3) * .5, 5);
  const total = Math.floor(pts * comboMultiplier);
  addScore(total);
  return total;
}
function missionEvent(type, val) { try { window.DQMissions && DQMissions.event(type, val); } catch (e) {} }

// ── HUD ──
function updateItemHUD(i) {
  const it = PL.items[i];
  const ic = $id('ic' + i); if (ic) ic.textContent = it[0];
  const sl = $id('sl' + i);
  if (sl) { sl.classList.toggle('on-cd', it[1] > 0); sl.classList.toggle('ready', it[1] === 0 && it[0] > 0); }
}
function updateHpHUD() {
  const pct = PL.hp / PL.maxHp;
  const f = $id('hp-fill'); if (!f) return;
  f.style.width = Math.max(0, pct * 100) + '%';
  f.style.background = pct > .5 ? 'linear-gradient(90deg,#00ff88,#00cc6a)' : pct > .25 ? 'linear-gradient(90deg,#ffe600,#cc9900)' : 'linear-gradient(90deg,#ff3333,#cc0000)';
}
function updateHUD() {
  const s = $id('h-score'); if (s) s.textContent = Math.floor(score).toLocaleString();
  const hi = $id('h-hi'); if (hi) hi.textContent = Math.floor(hiScore).toLocaleString();
  const w = $id('h-wave'); if (w) w.textContent = wave;
  const c = $id('h-coins'); if (c) c.textContent = sessionCoins;
  const pct = comboTimer / COMBO_WINDOW;
  const cf = $id('combo-fill'); if (cf) cf.style.width = (pct * 100) + '%';
  const cb = $id('h-combo-x'); if (cb) cb.textContent = comboCount > 1 ? 'x' + comboMultiplier : '';
  for (let i = 0; i < 4; i++) {
    const it = PL.items[i];
    const bar = $id('cb' + i);
    if (bar) bar.style.width = ((it[2] > 0 ? it[1] / it[2] : 0) * 100) + '%';
  }
}
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ── UPDATE ──
function update() {
  if (frame % 300 === 0) saveProgress();
  frame++; waveTimer++;
  const skinBuffs = _buffs();

  // Wave progression
  if (waveTimer % 2400 === 0) {
    wave++;
    gameSpeed = baseSpeed + wave * .35;
    spawnFT(W / 2 - 80, 70, '— WAVE ' + wave + ' —', '#ffe600', true);
    missionEvent('wave', wave);
    showPUNotif('🌊 WAVE ' + wave + ' — VELOCIDAD UP!');
    shake(6);
    if (wave % 3 === 0) spawnEnemy(true);
  }
  if (wave % 3 === 0 && !bossActive && waveTimer % 2400 < 5) spawnEnemy(true);

  // ── PLAYER MOVEMENT ──
  let targetVx = 0;
  if ((keys['ArrowLeft'] || keys['KeyA'] || mLeft) && !PL.dashing) targetVx = -4;
  if ((keys['ArrowRight'] || keys['KeyD'] || mRight) && !PL.dashing) targetVx = 4;
  if (targetVx !== 0) PL.facing = targetVx > 0 ? 1 : -1;
  PL.vx += (targetVx - PL.vx) * .25;

  if (PL.dashing) {
    PL.vx = PL.dashDir * DASH_SPEED;
    PL.dashTimer--;
    if (PL.dashTimer <= 0) { PL.dashing = false; PL.vx = PL.dashDir * 3; }
  }

  PL.x += PL.vx;
  PL.x = Math.max(10, Math.min(W - PL.w - 10, PL.x)); // free movement across the whole map

  if (!PL.dashing) {
    PL.vy += GRAVITY;
    if (PL.vy > 18) PL.vy = 18;
  }
  PL.y += PL.vy;

  const wasOnGround = PL.onGround;
  PL.onGround = false;
  if (PL.y >= GY) { PL.y = GY; PL.vy = 0; PL.onGround = true; PL.djUsed = false; }

  if (wasOnGround && !PL.onGround) PL.coyoteTimer = 10;
  else if (PL.onGround) PL.coyoteTimer = 0;
  if (PL.coyoteTimer > 0) PL.coyoteTimer--;

  // Slam landing
  if (PL.slamming && PL.onGround) {
    PL.slamming = false;
    shake(12);
    enemies.forEach(e => {
      if (Math.abs(e.x - PL.x) < 120) {
        e.hp -= 3; e.flashTimer = 12;
        spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 14, 5);
        const pts = hitCombo(70);
        spawnFT(e.x, e.y - 20, '+' + pts, '#ff6400', true);
      }
    });
    spawnPFX(PL.x + PL.w / 2, GY + 5, '#ff6400', 25, 6, 6);
    particles.push({ x: PL.x + PL.w / 2, y: GY + 4, vx: 0, vy: 0, color: '#ff6400', life: 1, decay: .08, sz: 60, ring: true });
    particles.push({ x: PL.x + PL.w / 2, y: GY + 4, vx: 0, vy: 0, color: '#ffe600', life: 1, decay: .1, sz: 40, ring: true });
  }

  if (PL.jumpBuffer > 0) { PL.jumpBuffer--; if (PL.onGround || PL.coyoteTimer > 0 || !PL.djUsed) doJump(); }

  // ── TIMERS ──
  if (PL.invTimer > 0) PL.invTimer--;
  if (PL.dashCd > 0) PL.dashCd--;
  if (PL.attackCd > 0) PL.attackCd--;
  if (PL.comboTimer > 0) PL.comboTimer--;
  if (PL.attackTimer > 0) { PL.attackTimer--; } else { PL.attackHitbox.active = false; }
  if (PL.flashTimer > 0) PL.flashTimer--;
  if (PL.shieldTimer > 0) PL.shieldTimer--; else PL.shieldOn = false;
  if (PL.fireTimer > 0) PL.fireTimer--; else PL.fireOn = false;
  if (PL.lightTimer > 0) PL.lightTimer--;
  if (PL.slamTimer > 0) PL.slamTimer--;

  for (let i = 0; i < 4; i++) { if (PL.items[i][1] > 0) { PL.items[i][1]--; if (PL.items[i][1] === 0) updateItemHUD(i); } }

  if (comboTimer > 0) comboTimer--; else { comboCount = 0; comboMultiplier = 1; }
  if (killStreakTimer > 0) killStreakTimer--; else killStreak = 0;

  if (PL.fireOn && frame % 10 === 0) playerShoot();

  // ── ENEMIES ──
  const attackBox = PL.attackHitbox;
  enemies = enemies.filter(e => {
    if (e.isBoss) {
      e.x += (W * .4 - e.x) * .015;
    } else if (e.isCharger && e.chargeTimer <= 0) {
      // charge at player: lock direction once so it commits to the pass instead of jittering on top of the player
      if (!e.chargeDir) e.chargeDir = (PL.x > e.x) ? 1 : -1;
      e.spd = Math.min(e.spd + .05, gameSpeed * 2.2);
      e.x += e.chargeDir * e.spd;
    } else {
      e.x -= e.spd;
    }
    if (e.isFlyer) { e.bobTimer += .07; e.y = e.y + (Math.sin(e.bobTimer) * .8); }
    if (e.isMagmar) { e.bobTimer += .04; spawnPFX(e.x + e.w / 2, e.y + e.h * .8, '#ff4400', 1, 1.5, 3); }
    if (e.isCharger && e.chargeTimer > 0) e.chargeTimer--;
    if (e.isExploder) { const dx2 = PL.x - e.x; if (!e.rushDir && Math.abs(dx2) < 180) e.rushDir = dx2 > 0 ? 1 : -1; if (e.rushDir) { e.spd = Math.min(e.spd + .15, gameSpeed * 3); e.x += e.rushDir * e.spd; spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 2, 2, 3); } }
    if (e.isGhost) { e.ghostTimer += .04; e.ghostAlpha = Math.max(.18, .4 + Math.sin(e.ghostTimer) * 0.6); }
    if (e.flashTimer > 0) e.flashTimer--;

    if (e.isBoss || e.isMagmar) {
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        enemyShoot(e);
        if (e.isMagmar) {
          bullets.push({ x: e.x, y: e.y + e.h * .4, vx: -5.5, vy: -1, w: 20, h: 14, enemy: true, fire: true, life: 1 });
          bullets.push({ x: e.x, y: e.y + e.h * .6, vx: -5.5, vy: 1, w: 20, h: 14, enemy: true, fire: true, life: 1 });
        }
        e.shootTimer = e.isBoss ? 90 + Math.random() * 60 : 70 + Math.random() * 40;
      }
    }

    // ── MELEE HIT (con buffs de skin: atkMult, lifesteal) ──
    if (attackBox.active && overlap(attackBox, { x: e.x + 6, y: e.y + 6, w: e.w - 12, h: e.h - 12 })) {
      const atkMult = skinBuffs?.atkMult || 1;
      const dmg = Math.ceil((1 + PL.comboStep) * atkMult);
      e.hp -= dmg; e.flashTimer = 10;
      if (skinBuffs?.lifesteal) { PL.hp = Math.min(PL.maxHp, PL.hp + Math.ceil(dmg * skinBuffs.lifesteal * 10)); updateHpHUD(); }
      const pts = hitCombo(e.isBoss ? 120 : e.isCharger ? 80 : 60);
      spawnPFX(attackBox.x + attackBox.w / 2, e.y + e.h / 2, ['#ffe600', '#ff9900', '#ff3333'][PL.comboStep], 8 + PL.comboStep * 5, 4 + PL.comboStep * 2);
      spawnFT(e.x, e.y - 20, '+' + pts, ['#ffe600', '#ff9900', '#ff3333'][PL.comboStep]);
      updateHUD();
      attackBox.active = false;
      _hap('light');
    }

    // kill check
    if (e.hp <= 0) {
      killStreak++; killStreakTimer = 180;
      if (killStreak === 3) showPUNotif('🔥 3 KILLS - RACHA!');
      else if (killStreak === 5) { showPUNotif('☄️ 5 KILLS - IMPARABLE!'); shake(5); }
      else if (killStreak === 10) { showPUNotif('⚡ 10 KILLS - LEGENDARIO!'); shake(8); addXP(50); }
      missionEvent('kill', 1);
      if (e.isBoss) { bossActive = false; bossKilled++; missionEvent('boss', 1); spawnFT(e.x, e.y - 30, 'BOSS MUERTO!', '#ff00cc', true); playSound('boss'); addXP(80); _hap('heavy'); }
      else { addXP(e.isMagmar ? 30 : e.isCharger ? 20 : e.isExploder ? 15 : 10); playSound('hit'); _hap('medium'); }
      spawnPFX(e.x + e.w / 2, e.y + e.h / 2, e.isBoss ? '#ff00cc' : e.isMagmar ? '#ff4400' : e.isCharger ? '#ff9900' : '#ff3333', e.isBoss ? 35 : e.isMagmar ? 28 : 20, e.isBoss ? 9 : 6);
      const coinDrop = e.isBoss ? 5 : e.isMagmar ? 3 : e.isCharger ? 2 : 1;
      for (let c = 0; c < coinDrop; c++) spawnCoin(e.x + Math.random() * e.w, e.y);
      if (e.isBoss) {
        const r = Math.random();
        spawnChest(e.x + e.w / 2, e.y, r < .3 ? 'legendario' : r < .75 ? 'epico' : 'comun');
      } else if (e.isMagmar && Math.random() < .7) {
        const r = Math.random();
        spawnChest(e.x + e.w / 2, e.y, r < .1 ? 'legendario' : r < .35 ? 'epico' : 'comun');
      } else if (Math.random() < .08) {
        spawnChest(e.x + e.w / 2, e.y, 'comun');
      }
      if (wave >= 4 && Math.random() < .05) spawnWeaponDrop(e.x + e.w / 2, e.y);
      shake(e.isBoss ? 10 : e.isMagmar ? 6 : 4);
      return false;
    }

    // ── PLAYER DAMAGE ──
    if (e.isExploder && overlap({ x: PL.x - 20, y: PL.y - 20, w: PL.w + 40, h: PL.h + 40 }, { x: e.x, y: e.y, w: e.w, h: e.h })) {
      shake(15); e.hp = -1;
      spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 40, 8, 8);
      spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ffe600', 25, 6, 6);
      particles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: 0, vy: 0, color: '#ff6400', life: 1, decay: .06, sz: 80, ring: true });
      if (PL.invTimer <= 0) { PL.hp -= 30; PL.invTimer = 60; PL.flashTimer = 20; shake(12); spawnFT(PL.x, PL.y - 20, '-30 EXPLOSION!', '#ff6400', true); updateHpHUD(); _hap('heavy'); if (PL.hp <= 0) { endGame(); } }
    }
    if (PL.invTimer <= 0 && !e.isExploder && overlap({ x: PL.x + 6, y: PL.y + 6, w: PL.w - 12, h: PL.h - 12 }, { x: e.x + 8, y: e.y + 8, w: e.w - 16, h: e.h - 16 })) {
      const dmg = e.isBoss ? 22 : e.isCharger ? 15 : 12;
      PL.hp -= dmg;
      PL.invTimer = 60; PL.flashTimer = 20;
      comboCount = 0; comboMultiplier = 1;
      shake(8);
      spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff3333', 14, 5);
      spawnFT(PL.x, PL.y - 20, '-' + dmg + ' HP', '#ff3333');
      updateHpHUD();
      _hap('heavy');
      if (PL.hp <= 0) { endGame(); return true; }
    }
    return e.x > -120 && e.x < W + 260; // cull on both sides (chargers/exploders can run off the right edge)
  });

  // ── BULLETS ──
  bullets = bullets.filter(b => {
    b.x += b.vx; b.y += b.vy;
    if (b.life <= 0) return false;
    if (b.x < -30 || b.x > W + 30) return false;

    if (!b.enemy) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (overlap(b, { x: e.x + 6, y: e.y + 6, w: e.w - 12, h: e.h - 12 })) {
          e.hp -= 1.5; e.flashTimer = 8;
          const pts = hitCombo(40);
          spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 8, 4);
          spawnFT(e.x, e.y - 15, '+' + pts, '#ff6400');
          if (e.hp <= 0) {
            spawnPFX(e.x + e.w / 2, e.y + e.h / 2, e.isMagmar ? '#ff4400' : '#ff6400', 20, 6);
            missionEvent('kill', 1);
            if (e.isBoss) { bossActive = false; missionEvent('boss', 1); }
            const cd = e.isBoss ? 4 : e.isMagmar ? 2 : 1;
            for (let c = 0; c < cd; c++) spawnCoin(e.x + Math.random() * e.w, e.y);
            if (e.isBoss || e.isMagmar) {
              const r = Math.random();
              spawnChest(e.x + e.w / 2, e.y, e.isBoss ? (r < .3 ? 'legendario' : r < .75 ? 'epico' : 'comun') : (r < .1 ? 'legendario' : r < .35 ? 'epico' : 'comun'));
            } else if (Math.random() < .06) spawnChest(e.x + e.w / 2, e.y, 'comun');
            if (wave >= 4 && Math.random() < .05) spawnWeaponDrop(e.x + e.w / 2, e.y);
            enemies.splice(i, 1);
          }
          updateHUD();
          return false;
        }
      }
    } else {
      if (PL.invTimer <= 0 && overlap(b, { x: PL.x + 6, y: PL.y + 6, w: PL.w - 12, h: PL.h - 12 })) {
        PL.hp -= 15; PL.invTimer = 45; PL.flashTimer = 15;
        comboCount = 0; comboMultiplier = 1;
        spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff3333', 10, 4);
        spawnFT(PL.x, PL.y - 15, '-15 HP', '#ff3333');
        shake(5);
        updateHpHUD();
        _hap('heavy');
        if (PL.hp <= 0) { endGame(); return false; }
        return false;
      }
    }
    return true;
  });

  // ── COINS (con buff coinMult de skins) ──
  const skinCoinMult = skinBuffs?.coinMult || 1;
  coins = coins.filter(c => {
    c.x -= c.spd > 0 ? c.spd : gameSpeed * .6;
    c.bob += .09; c.y += Math.sin(c.bob) * .7;
    const dx = PL.x + PL.w / 2 - (c.x + c.w / 2);
    const dy = PL.y + PL.h / 2 - (c.y + c.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 90) { c.x += dx * .12; c.y += dy * .12; }
    if (overlap({ x: PL.x + 4, y: PL.y + 4, w: PL.w - 8, h: PL.h - 8 }, c)) {
      const coinVal = Math.ceil(1 * skinCoinMult);
      sessionCoins += coinVal;
      totalCoins += coinVal;
      missionEvent('coin', 1);
      addScore(Math.floor(10 * comboMultiplier * skinCoinMult));
      addXP(5);
      playSound('coin');
      spawnPFX(c.x + c.w / 2, c.y + c.h / 2, '#ffe600', 6, 3, 3);
      if (totalCoins % 10 === 0) spawnFT(PL.x, PL.y - 20, 'x' + comboMultiplier + ' COINS!', '#ffe600');
      updateHUD();
      return false;
    }
    return c.x > -40;
  });

  // ── CHESTS ──
  chests = chests.filter(ch => {
    ch.x -= ch.spd > 0 ? ch.spd : gameSpeed * .4;
    ch.bob += .06; ch.y += Math.sin(ch.bob) * .5;
    ch.glowTimer = (ch.glowTimer || 0) + 1;
    if (overlap({ x: PL.x + 4, y: PL.y + 4, w: PL.w - 8, h: PL.h - 8 }, ch)) {
      if (ch.tier === 'legendario') {
        PL.hp = Math.min(PL.maxHp, PL.hp + 40); sessionCoins += 20; addXP(60); addScore(500);
        shake(10); spawnFT(ch.x, ch.y - 20, '⭐ COFRE LEGENDARIO! +500', '#ffe600', true);
        showPUNotif('⭐ COFRE LEGENDARIO! +20 monedas, +40 HP!');
        spawnPFX(ch.x + ch.w / 2, ch.y + ch.h / 2, '#ffe600', 30, 7, 5);
      } else if (ch.tier === 'epico') {
        PL.hp = Math.min(PL.maxHp, PL.hp + 20); sessionCoins += 10; addXP(30); addScore(250);
        shake(6); spawnFT(ch.x, ch.y - 20, '💜 COFRE ÉPICO! +250', '#cc44ff', true);
        showPUNotif('💜 COFRE ÉPICO! +10 monedas, +20 HP!');
        spawnPFX(ch.x + ch.w / 2, ch.y + ch.h / 2, '#cc44ff', 20, 5, 4);
      } else {
        sessionCoins += 5; addXP(15); addScore(100);
        spawnFT(ch.x, ch.y - 20, '📦 COFRE +100', '#aaffaa', true);
        spawnPFX(ch.x + ch.w / 2, ch.y + ch.h / 2, '#aaffaa', 12, 4, 3);
      }
      missionEvent('chest', 1);
      _hap('medium');
      updateHUD(); updateHpHUD();
      return false;
    }
    return ch.x > -50;
  });

  // ── WEAPON DROPS ──
  weaponDrops = weaponDrops.filter(w => {
    w.x -= w.spd > 0 ? w.spd : gameSpeed * .5;
    w.bob += .07; w.y += Math.sin(w.bob) * .6;
    if (overlap({ x: PL.x + 4, y: PL.y + 4, w: PL.w - 8, h: PL.h - 8 }, w)) {
      const dur = w.type === 'katana_spark' ? 480 : 360;
      weaponBuff = { type: w.type, timer: dur, maxTimer: dur };
      if (w.type === 'katana_spark') { PL.fireOn = true; PL.fireTimer = Math.max(PL.fireTimer, dur); }
      shake(5);
      spawnFT(w.x, w.y - 20, w.type === 'katana_spark' ? '⚡ KATANA SPARK!' : '🗡 KATANA COMÚN!', w.type === 'katana_spark' ? '#00eeff' : '#ffe600', true);
      showPUNotif(w.type === 'katana_spark' ? '⚡ KATANA SPARK — FIRE MODE 8s!' : '🗡 KATANA COMÚN — +COMBO RANGE!');
      spawnPFX(w.x + w.w / 2, w.y + w.h / 2, w.type === 'katana_spark' ? '#00eeff' : '#ffe600', 20, 5, 4);
      _hap('heavy');
      return false;
    }
    return w.x > -60;
  });
  if (weaponBuff) { weaponBuff.timer--; if (weaponBuff.timer <= 0) weaponBuff = null; }

  // ── PARTICLES / TEXT ──
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; if (!p.ring) p.vy += .12; p.life -= p.decay; if (p.ring) p.sz += 4; return p.life > 0; });
  fTexts = fTexts.filter(t => { t.y += t.vy; t.life -= t.decay; return t.life > 0; });

  // ── BG SCROLL ──
  bgStars.forEach(s => { s.x -= s.sp; if (s.x < 0) s.x = W; });
  bgMtns.forEach(m => { m.x -= m.sp; if (m.x < -m.w) m.x = W + m.w; });
  bgClouds.forEach(c => { c.x -= c.sp; if (c.x < -c.w - 20) c.x = W + c.w; });
  groundX = (groundX - gameSpeed) % 40;

  // ── SPAWN RATES ──
  const spawnRate = Math.max(55, 120 - wave * 8);
  if (frame % spawnRate === 0) spawnEnemy();
  if (frame % 70 === 0) spawnCoin();

  addScore(1);

  if (shakeTimer > 0) { shakeTimer--; shakeAmt *= .85; } else shakeAmt = 0;

  PL.animTimer++;
  if (PL.animTimer % 10 === 0 && (Math.abs(PL.vx) > 1 || !PL.onGround)) PL.runFrame ^= 1;

  updateHUD();
  updateHpHUD();
  for (let i = 0; i < 4; i++) updateItemHUD(i);
}

// ── DRAW ──
function _playerImg() {
  let key = 'duende_hero';
  try { key = (DQE.getPlayerImgKey && DQE.getPlayerImgKey()) || 'duende_hero'; } catch (e) {}
  const img = IMG_EL[key];
  return (img && img.naturalWidth > 0) ? img : IMG_EL['duende_hero'];
}

function draw() {
  const sx = (shakeAmt > 0 ? Math.round((Math.random() - .5) * shakeAmt * 2) : 0);
  const sy = (shakeAmt > 0 ? Math.round((Math.random() - .5) * shakeAmt * 2) : 0);
  cx.save();
  if (shakeAmt > 0) cx.translate(sx, sy);

  // BG
  const grad = cx.createLinearGradient(0, 0, 0, GY + 10);
  grad.addColorStop(0, '#010015');
  grad.addColorStop(1, '#050520');
  cx.fillStyle = grad;
  cx.fillRect(0, 0, W, H);

  bgStars.forEach(s => { cx.fillStyle = `rgba(255,255,255,${.2 + Math.sin(frame * .04 + s.x) * .15})`; cx.fillRect(s.x, s.y, s.s, s.s); });

  cx.fillStyle = 'rgba(124,58,237,.07)';
  bgMtns.forEach(m => { cx.beginPath(); cx.moveTo(m.x, GY + 10); cx.lineTo(m.x + m.w / 2, GY + 10 - m.h); cx.lineTo(m.x + m.w, GY + 10); cx.fill(); });

  bgClouds.forEach(c => {
    const cg = cx.createRadialGradient(c.x + c.w / 2, c.y + c.h / 2, 0, c.x + c.w / 2, c.y + c.h / 2, c.w / 2);
    cg.addColorStop(0, `rgba(124,58,237,${c.alpha * 2})`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = cg; cx.fillRect(c.x, c.y, c.w, c.h * 2);
  });

  // Ground
  cx.fillStyle = '#0a1a0f';
  cx.fillRect(0, GY + PL.h, W, H - (GY + PL.h));
  cx.fillStyle = '#00ff88';
  cx.fillRect(0, GY + PL.h, W, 3);
  cx.fillStyle = 'rgba(0,255,136,.1)';
  for (let gx = groundX; gx < W; gx += 40) cx.fillRect(gx, GY + PL.h + 3, 2, H - (GY + PL.h + 3));

  // Coins
  coins.forEach(c => {
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen';
    cx.drawImage(IMG_EL['coin'], c.x, c.y, c.w, c.h); cx.restore();
  });

  // Chests
  chests.forEach(ch => {
    const shadowColors = { comun: '#aaffaa', epico: '#cc44ff', legendario: '#ffe600' };
    const pulse = Math.sin(ch.glowTimer * .08) * .5 + .5;
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen';
    cx.shadowColor = shadowColors[ch.tier];
    cx.shadowBlur = 10 + pulse * 14;
    cx.globalAlpha = .92 + pulse * .08;
    cx.drawImage(IMG_EL['cofre_' + ch.tier], ch.x, ch.y, ch.w, ch.h);
    cx.restore();
  });

  // Weapon drops
  weaponDrops.forEach(w => {
    const pulse = Math.sin(frame * .1) * .4 + .6;
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen';
    cx.shadowColor = w.type === 'katana_spark' ? '#00eeff' : '#ffe600';
    cx.shadowBlur = 8 + pulse * 10;
    cx.globalAlpha = .85 + pulse * .15;
    cx.drawImage(IMG_EL[w.type], w.x, w.y, w.w, w.h);
    cx.restore();
  });

  // Particles
  particles.forEach(p => {
    cx.save(); cx.globalAlpha = p.life;
    if (p.ring) { cx.strokeStyle = p.color; cx.lineWidth = 3; cx.beginPath(); cx.arc(p.x, p.y, p.sz / 2, 0, Math.PI * 2); cx.stroke(); }
    else { cx.fillStyle = p.color; cx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    cx.restore();
  });

  // Enemies
  enemies.forEach(e => {
    const flashAlpha = e.flashTimer > 0 && e.flashTimer % 4 < 2 ? .25 : 1;
    const ghostA = e.isGhost ? (e.ghostAlpha || 1) : 1;
    const alpha = flashAlpha * ghostA;
    const key = e.isBoss ? 'enemy2' : e.isMagmar ? 'enemy_magmar' : 'enemy';
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen'; cx.globalAlpha = alpha;
    if (e.isExploder) { cx.shadowColor = '#ff4400'; cx.shadowBlur = 12 + Math.sin(frame * .2) * 8; }
    if (e.isGhost) { cx.shadowColor = '#9333ea'; cx.shadowBlur = 16; }
    if (e.isMagmar) { cx.shadowColor = '#ff4400'; cx.shadowBlur = 18 + Math.sin(frame * .15) * 10; }
    cx.translate(e.x + e.w / 2, 0); cx.scale(-1, 1);
    cx.drawImage(IMG_EL[key], -e.w / 2, e.y, e.w, e.h);
    cx.restore();
    if (e.maxHp > 2 || e.isBoss) {
      const bw = e.w; const pct = e.hp / e.maxHp;
      cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(e.x, e.y - 12, bw, 7);
      cx.fillStyle = e.isBoss ? '#ff00cc' : pct > .5 ? '#00ff88' : '#ff3333';
      cx.fillRect(e.x, e.y - 12, bw * pct, 7);
      cx.strokeStyle = 'rgba(255,255,255,.2)'; cx.lineWidth = 1; cx.strokeRect(e.x, e.y - 12, bw, 7);
    }
  });

  // Enemy bullets
  bullets.filter(b => b.enemy).forEach(b => {
    cx.save();
    if (b.fire) {
      cx.shadowColor = '#ff4400'; cx.shadowBlur = 10;
      cx.fillStyle = '#ff6600';
      cx.beginPath(); cx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = 'rgba(255,200,0,.5)'; cx.beginPath(); cx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w * .7, b.h * .7, 0, 0, Math.PI * 2); cx.fill();
    } else {
      cx.fillStyle = '#ff00cc';
      cx.beginPath(); cx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); cx.fill();
      cx.fillStyle = 'rgba(255,0,204,.3)'; cx.beginPath(); cx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h, 0, 0, Math.PI * 2); cx.fill();
    }
    cx.restore();
  });

  // Player bullets
  bullets.filter(b => !b.enemy).forEach(b => {
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen'; cx.globalAlpha = .9;
    cx.drawImage(IMG_EL['skill_fire'], b.x, b.y - b.h / 2, b.w * 1.8, b.h * 1.8); cx.restore();
  });

  // ── PLAYER ──
  const plAlpha = PL.invTimer > 0 && PL.invTimer % 8 < 4 ? .3 : 1;
  const _plImg = _playerImg();
  cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen'; cx.globalAlpha = plAlpha;
  if (PL.facing < 0) { cx.translate(PL.x + PL.w, 0); cx.scale(-1, 1); cx.drawImage(_plImg, 0, PL.y, PL.w, PL.h); }
  else cx.drawImage(_plImg, PL.x, PL.y, PL.w, PL.h);
  cx.restore();

  // Aura de skin (legendaria)
  const skinBuffs = _buffs();
  if (skinBuffs?.aura) {
    const aR = Math.max(PL.w, PL.h) * .85;
    const aP = Math.sin(frame * .06) * .2;
    cx.save();
    cx.beginPath(); cx.arc(PL.x + PL.w / 2, PL.y + PL.h / 2, aR * (1 + aP), 0, Math.PI * 2);
    const aGrad = cx.createRadialGradient(PL.x + PL.w / 2, PL.y + PL.h / 2, 0, PL.x + PL.w / 2, PL.y + PL.h / 2, aR);
    aGrad.addColorStop(0, 'rgba(255,0,204,.12)');
    aGrad.addColorStop(.5, 'rgba(192,132,252,.08)');
    aGrad.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = aGrad; cx.fill();
    cx.restore();
  }

  // Dash trail
  if (PL.dashing) {
    for (let t = 1; t <= 4; t++) {
      const tx = PL.x - PL.dashDir * t * 12;
      cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'screen';
      cx.globalAlpha = .15 * (5 - t) / 4;
      cx.drawImage(_plImg, tx, PL.y, PL.w, PL.h); cx.restore();
    }
    cx.save(); cx.strokeStyle = 'rgba(124,58,237,.6)'; cx.lineWidth = 3;
    cx.beginPath(); cx.moveTo(PL.x, PL.y + PL.h / 2); cx.lineTo(PL.x - PL.dashDir * 50, PL.y + PL.h / 2); cx.stroke(); cx.restore();
  }

  // Shield aura
  if (PL.shieldOn) {
    const r = Math.max(PL.w, PL.h) * .7;
    const pulse = Math.sin(frame * .12) * .15;
    cx.save();
    cx.beginPath(); cx.arc(PL.x + PL.w / 2, PL.y + PL.h / 2, r * (1 + pulse), 0, Math.PI * 2);
    cx.strokeStyle = `rgba(0,238,255,${.7 + pulse})`; cx.lineWidth = 3; cx.stroke();
    cx.fillStyle = 'rgba(0,238,255,.06)'; cx.fill();
    cx.restore();
  }

  // Fire aura
  if (PL.fireOn) {
    const foff = Math.sin(frame * .2) * 5;
    cx.save(); cx.globalCompositeOperation = 'screen'; cx.globalAlpha = .7 + Math.sin(frame * .15) * .25;
    cx.imageSmoothingEnabled = false;
    cx.drawImage(IMG_EL['skill_fire'], PL.x + PL.w - 5, PL.y + PL.h * .25 + foff, 38, 22); cx.restore();
  }

  // Attack arc
  if (PL.attackHitbox.active) {
    const colors = ['rgba(255,230,0,.5)', 'rgba(255,153,0,.6)', 'rgba(255,51,51,.7)'];
    cx.save(); cx.strokeStyle = colors[PL.comboStep]; cx.lineWidth = 3 + PL.comboStep;
    const cx2 = PL.x + (PL.facing > 0 ? PL.w : 0);
    cx.beginPath(); cx.arc(cx2, PL.y + PL.h / 2, 40 + PL.comboStep * 12,
      PL.facing > 0 ? -Math.PI * .55 : Math.PI * .45,
      PL.facing > 0 ? Math.PI * .55 : Math.PI * 1.55); cx.stroke();
    cx.restore();
  }

  // Slam vfx
  if (PL.slamming && PL.vy > 0) {
    cx.save(); cx.strokeStyle = 'rgba(255,100,0,.8)'; cx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ty = PL.y - 10 - i * 15;
      cx.globalAlpha = 1 - i * .3;
      cx.beginPath(); cx.moveTo(PL.x + PL.w * .2, ty); cx.lineTo(PL.x + PL.w * .5, ty - 10); cx.lineTo(PL.x + PL.w * .8, ty); cx.stroke();
    }
    cx.restore();
  }

  // Lightning effect
  if (PL.lightTimer > 0) {
    cx.save(); cx.globalAlpha = PL.lightTimer / 35;
    cx.fillStyle = 'rgba(0,238,255,.12)'; cx.fillRect(0, 0, W, H);
    for (let b = 0; b < 6; b++) {
      cx.strokeStyle = `rgba(0,238,255,${.5 + Math.random() * .5})`; cx.lineWidth = 1 + Math.random() * 3;
      cx.beginPath(); let lx = Math.random() * W, ly = 0; cx.moveTo(lx, ly);
      for (let s = 0; s < 10; s++) { lx += (Math.random() - .5) * 70; ly += Math.random() * 30; cx.lineTo(lx, ly); } cx.stroke();
    }
    cx.restore();
  }

  // Weapon buff bar
  if (weaponBuff) {
    const bpct = weaponBuff.timer / weaponBuff.maxTimer;
    const bcolor = weaponBuff.type === 'katana_spark' ? '#00eeff' : '#ffe600';
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(PL.x, PL.y - 26, PL.w, 5);
    cx.fillStyle = bcolor; cx.fillRect(PL.x, PL.y - 26, PL.w * bpct, 5);
    cx.restore();
  }

  // HP bar above player
  const hpPct = PL.hp / PL.maxHp;
  cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(PL.x, PL.y - 14, PL.w, 8);
  cx.fillStyle = hpPct > .5 ? '#00ff88' : hpPct > .25 ? '#ffe600' : '#ff3333';
  cx.fillRect(PL.x, PL.y - 14, PL.w * hpPct, 8);

  // Floating texts
  cx.save();
  fTexts.forEach(t => {
    cx.globalAlpha = t.life;
    cx.fillStyle = t.color;
    cx.font = (t.big ? .55 : .42) + 'rem "Press Start 2P"';
    cx.textAlign = 'center';
    cx.fillText(t.txt, t.x, t.y);
  });
  cx.restore();

  cx.restore(); // shake
}

// ── LOOP ──
function loop(ts) {
  if (state !== 'playing') return;
  lastTs = ts;
  update();
  draw();
  try { DQE.loopTick && DQE.loopTick(); } catch (e) {}
  raf = requestAnimationFrame(loop);
}

// ── LIFECYCLE ──
function startGame() {
  playMusic();
  hideAll();
  score = 0; wave = 1; frame = 0; gameSpeed = baseSpeed; waveTimer = 0; bossActive = false; bossKilled = 0;
  sessionCoins = 0; comboCount = 0; comboMultiplier = 1; comboTimer = 0;
  playerXP = 0; playerLevel = 1;
  killStreak = 0; killStreakTimer = 0;
  enemies = []; coins = []; bullets = []; particles = []; fTexts = [];
  chests = []; weaponDrops = []; weaponBuff = null;
  shakeAmt = 0; shakeTimer = 0;
  const bHp = _buffs()?.bonusHp || 0;
  Object.assign(PL, { x: 80, y: GY, vx: 0, vy: 0, onGround: false, jumping: false, djUsed: false, coyoteTimer: 0, jumpBuffer: 0, dashing: false, dashTimer: 0, dashDir: 1, dashCd: 0, comboStep: 0, comboTimer: 0, attackTimer: 0, attackCd: 0, attackHitbox: { x: 0, y: 0, w: 0, h: 0, active: false }, slamming: false, slamTimer: 0, hp: 100 + bHp, maxHp: 100 + bHp, invTimer: 0, shieldOn: false, shieldTimer: 0, fireOn: false, fireTimer: 0, lightTimer: 0, flashTimer: 0, facing: 1, animTimer: 0, runFrame: 0, items: [[3, 0, 90], [2, 0, 120], [1, 0, 150], [1, 0, 180]] });

  loadProgress();
  try { DQE.onStartGame && DQE.onStartGame(); } catch (e) {}

  initBg();
  updateHpHUD(); updateHUD(); updateXPBar();
  for (let i = 0; i < 4; i++) updateItemHUD(i);
  state = 'playing';
  lastTs = performance.now();
  raf = requestAnimationFrame(loop);
}

function pauseGame() {
  if (state !== 'playing') return;
  pauseMusic();
  state = 'paused';
  cancelAnimationFrame(raf);
  const el = $id('shop-coins-val'); if (el) el.textContent = sessionCoins;
  const ov = $id('ov-pause'); if (ov) ov.classList.add('show');
}

function resumeGame() {
  playMusic();
  const ov = $id('ov-pause'); if (ov) ov.classList.remove('show');
  state = 'playing';
  lastTs = performance.now();
  raf = requestAnimationFrame(loop);
}

function endGame() {
  stopMusic();
  state = 'dead';
  cancelAnimationFrame(raf);
  playSound('die');
  _hap('heavy');
  localStorage.setItem('dq_hi', hiScore);
  saveProgress();
  const fs = $id('final-score'); if (fs) fs.textContent = Math.floor(score).toLocaleString();
  const fh = $id('final-hi'); if (fh) fh.textContent = 'HI-SCORE: ' + Math.floor(hiScore).toLocaleString();
  const ds = $id('dead-stats'); if (ds) ds.innerHTML = `WAVE: ${wave} &nbsp; 🪙 ${sessionCoins} &nbsp; LVL: ${playerLevel}<br>COMBOS: ${comboCount} &nbsp; BOSSES: ${bossKilled}`;
  const ov = $id('ov-dead'); if (ov) ov.classList.add('show');
  try {
    DQE.onEndGame && DQE.onEndGame({ score: Math.floor(score), wave, level: playerLevel, coins: sessionCoins, bosses_killed: bossKilled, combos_max: comboCount });
  } catch (e) {}
}

function toMenu() {
  hideAll();
  cancelAnimationFrame(raf);
  state = 'menu';
  const ov = $id(DQE.menuOverlayId || 'ov-menu'); if (ov) ov.classList.add('show');
  try { DQE.onToMenu && DQE.onToMenu(); } catch (e) {}
}

function hideAll() { document.querySelectorAll('.ov').forEach(o => o.classList.remove('show')); }

// ── INPUT ──
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  keys[e.code] = true;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); jump(); }
  if (e.code === 'KeyZ' || e.code === 'KeyJ') { e.preventDefault(); attack(); }
  if (e.code === 'KeyX' || e.code === 'KeyK') { e.preventDefault(); dash(); }
  if (e.code === 'KeyC' || e.code === 'ArrowDown') { e.preventDefault(); if (!PL.onGround) attack(); }
  if (e.code === 'Digit1') useItem(0);
  if (e.code === 'Digit2') useItem(1);
  if (e.code === 'Digit3') useItem(2);
  if (e.code === 'Digit4') useItem(3);
  if (e.code === 'KeyP' || e.code === 'Escape') { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
  if (e.code === 'Enter' && state === 'menu') startGame();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });
cv.addEventListener('click', () => { if (state === 'menu') startGame(); else if (state === 'playing') attack(); });
