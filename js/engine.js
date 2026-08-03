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

// ── SPRITES DERIVADOS ──
// Generamos variantes por código a partir de los PNG que ya existen, sin
// dibujar arte nuevo. Cada variante se calcula UNA vez y se guarda en caché.
const _SPRCACHE = new Map();

function _derive(key, id, paint) {
  const cacheKey = key + '|' + id;
  const hit = _SPRCACHE.get(cacheKey);
  if (hit) return hit;
  const src = IMG_EL[key];
  if (!src || !src.naturalWidth) return src;            // aún no ha cargado
  const c = document.createElement('canvas');
  c.width = src.naturalWidth; c.height = src.naturalHeight;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0);
  paint(g, c.width, c.height);
  _SPRCACHE.set(cacheKey, c);
  return c;
}

// Silueta blanca del sprite, para el destello de impacto.
function whiteSprite(key) {
  return _derive(key, 'white', (g, w, h) => {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
  });
}

// Copia teñida: 'source-atop' aplana el color dentro de la silueta y una
// segunda pasada en 'overlay' devuelve el volumen del pixel art, así el
// enemigo cambia de color sin perder sombras ni contorno.
function tintedSprite(key, hex) {
  return _derive(key, 'tint' + hex, (g, w, h) => {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = .45; g.fillStyle = hex; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = .3; g.fillRect(0, 0, w, h);
  });
}

// Un solo bitmap de enemigo servía para charger, exploder, ghost y flyer: el
// jugador no podía leer de un vistazo qué le venía encima. El color coincide
// con el de sus partículas de muerte, así que el tinte también predice el
// efecto. Boss y magmar ya tienen sprite propio y se dejan sin teñir.
function enemyTint(e) {
  if (e.isBoss || e.isMagmar) return null;
  if (e.isCharger) return '#ff9900';
  if (e.isExploder) return '#ff3333';
  if (e.isGhost) return '#9333ea';
  if (e.isFlyer) return '#00eeff';
  return null;
}

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
// Línea de suelo real: es donde draw() pinta el borde y donde apoyan los pies
// del jugador (PL.y = GY, PL.h = 68). Todo lo que "esté en el suelo" usa esto.
const GROUND = GY + 68;
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
const WAVE_FRAMES = 1800; // ~30s por wave: progresión más adictiva (antes 2400/40s)
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
let reviveUsed = false;
const REVIVE_COST = 75; // DQ — sumidero de economía + segunda oportunidad

// ── TUTORIAL (solo la primera partida de la vida del jugador) ──
// paso 0: saltar · paso 1: atacar · paso 2: terminado
let tutorialStep = localStorage.getItem('dq_tutorial') === 'done' ? 2 : 0;
function tutorialAdvance(action) {
  if (tutorialStep === 0 && action === 'jump') { tutorialStep = 1; showPUNotif('✅ ¡Eso es! Ahora ATACA'); }
  else if (tutorialStep === 1 && action === 'attack') {
    tutorialStep = 2;
    localStorage.setItem('dq_tutorial', 'done');
    showPUNotif('🧝 ¡Listo! Sobrevive y junta monedas');
  }
}
let raf = null;
let keys = {};
let mLeft = false, mRight = false;

// ── XP / LEVEL ──
let playerXP = 0, playerLevel = 1;
const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
function getXPNeeded(lvl) { return XP_PER_LEVEL[Math.min(lvl, XP_PER_LEVEL.length - 1)] || 4000 + (lvl - 10) * 600; }
let runXP = 0;   // XP ganado en la partida actual, para enseñarlo al morir
function addXP(amt) {
  playerXP += amt;
  runXP += amt;
  // while y no if: un boss (+80) o un cofre legendario (+60) sobre un nivel bajo
  // puede cruzar dos niveles de una vez, y antes se perdía el segundo.
  while (playerXP >= getXPNeeded(playerLevel)) { playerXP -= getXPNeeded(playerLevel); playerLevel++; onLevelUp(); }
  updateXPBar();
}

// ── PERKS DE NIVEL ──
// Antes subir de nivel no servía de nada: onLevelUp() mutaba PL en caliente,
// pero startGame() reasignaba hp/maxHp a 100 y hitCombo() recalculaba el tope
// del combo con un 5 fijo. Un LVL 12 empezaba exactamente igual que un LVL 1.
// Ahora los perks se derivan del nivel y se aplican AL EMPEZAR cada partida.
function levelPerks(lvl) {
  return {
    bonusHp: Math.floor(lvl / 3) * 20,
    comboCap: 5 + Math.floor(lvl / 3) * .5,
    potions: Math.min(3 + Math.floor(lvl / 3), 6),
  };
}
function perksLabel(lvl) {
  const p = levelPerks(lvl);
  return 'LVL ' + lvl + ' · +' + p.bonusHp + ' HP · combo x' + p.comboCap + ' · ' + p.potions + ' pociones';
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
  // Efecto inmediato (se nota ya en esta partida) + el perk permanente, que se
  // aplica de verdad al empezar la siguiente.
  const p = levelPerks(playerLevel);
  PL.maxHp = 100 + (_buffs()?.bonusHp || 0) + p.bonusHp;
  PL.hp = Math.min(PL.hp + 20, PL.maxHp);
  comboCap = p.comboCap;
  PL.items[0][0] = Math.max(PL.items[0][0], p.potions);
  showPUNotif('⬆️ NIVEL ' + playerLevel + ' — ' + perksLabel(playerLevel));
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
function playSound(type, power) {
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
    else if (type === 'powerup') { // arpegio ascendente brillante
      [523, 659, 784, 1047].forEach((f, i) => { const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.type = 'triangle'; o2.connect(g2); g2.connect(ac.destination); o2.frequency.value = f; g2.gain.setValueAtTime(.13, now + i * .05); g2.gain.exponentialRampToValueAtTime(.001, now + i * .05 + .18); o2.start(now + i * .05); o2.stop(now + i * .05 + .18); }); return; }
    else if (type === 'achievement') { // fanfarria de logro
      [659, 784, 988, 1319].forEach((f, i) => { const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.type = 'square'; o2.connect(g2); g2.connect(ac.destination); o2.frequency.value = f; g2.gain.setValueAtTime(.1, now + i * .1); g2.gain.exponentialRampToValueAtTime(.001, now + i * .1 + .25); o2.start(now + i * .1); o2.stop(now + i * .1 + .25); }); return; }
    // 'slash' es el corte que CONECTA: sube de tono con el paso del combo, así
    // el oído distingue el 1º del 3º golpe. Antes el melee no sonaba nunca.
    else if (type === 'slash') { const f = [900, 700, 520][PL.comboStep] || 900; o.type = 'square'; o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * .35, now + .06); g.gain.setValueAtTime(.2, now); g.gain.exponentialRampToValueAtTime(.001, now + .08); o.start(now); o.stop(now + .08); }
    // 'crunch' es la muerte del enemigo: grave y con cuerpo, distinto del corte.
    else if (type === 'crunch') { o.type = 'sawtooth'; o.frequency.setValueAtTime(90, now); o.frequency.exponentialRampToValueAtTime(40, now + .16); g.gain.setValueAtTime(.26, now); g.gain.exponentialRampToValueAtTime(.001, now + .18); o.start(now); o.stop(now + .18); }
    // 'land' es el aterrizaje: el volumen escala con la velocidad de caída.
    else if (type === 'land') { o.type = 'triangle'; o.frequency.setValueAtTime(150, now); o.frequency.exponentialRampToValueAtTime(70, now + .07); g.gain.setValueAtTime(Math.min(.22, .05 + (power || 0) * .012), now); g.gain.exponentialRampToValueAtTime(.001, now + .09); o.start(now); o.stop(now + .09); }
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
// ── POWER-UPS temporales que caen del cielo ──
let powerups = [];               // drops en pantalla
let puMagnet = 0, puDouble = 0;  // timers activos (frames)
const PU_TYPES = {
  magnet: { emoji: '🧲', color: '#00eeff', dur: 360, label: '🧲 IMÁN DE MONEDAS!' },
  double: { emoji: '✖️2', color: '#ffe600', dur: 360, label: '✖️2 PUNTOS DOBLES!' },
  shield: { emoji: '🛡️', color: '#00ff88', dur: 300, label: '🛡️ ESCUDO!' },
};
function spawnPowerup() {
  const keys = Object.keys(PU_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  powerups.push({ x: W + 20, y: GY - 60 - Math.random() * 90, w: 34, h: 34, type, bob: Math.random() * Math.PI * 2, spd: gameSpeed * .55 });
}
let comboCount = 0, comboTimer = 0, comboMultiplier = 1, comboCap = 5;
let killStreak = 0, killStreakTimer = 0;
let shakeAmt = 0, shakeTimer = 0;
function shake(a) { shakeAmt = a; shakeTimer = Math.ceil(a * 1.5); }

// Hit-stop: congela unos frames la simulación al conectar un golpe. Es lo que
// hace que pegar se sienta contundente en vez de atravesar niebla. 3 frames
// (50 ms) no se perciben como tirón, se perciben como impacto.
let hitStop = 0;
function freeze(f) { hitStop = Math.max(hitStop, f); }

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
  const eh = isBoss ? 90 : isFlyer ? 68 : isMagmar ? 76 : 62;
  // Los enemigos se alineaban por su borde SUPERIOR a GY, así que cada uno
  // apoyaba a una altura distinta: el normal flotaba 6px, el magmar atravesaba
  // el suelo y al boss se le cortaba la base fuera del canvas. Ahora todos
  // apoyan los pies en la misma línea de suelo que el jugador.
  enemies.push({
    x: W + 30, y: isFlyer ? GY - 80 - Math.random() * 70 : GROUND - eh,
    w: isBoss ? 96 : isFlyer ? 72 : isMagmar ? 80 : 68,
    h: eh,
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
  tutorialAdvance('jump');
  // squash negativo = estirado a lo alto. Al saltar el cuerpo se estira y al
  // caer se aplasta: es el truco clásico que hace que un salto se sienta vivo.
  if (PL.onGround || PL.coyoteTimer > 0) {
    PL.vy = JUMP_FORCE; PL.djUsed = false;
    PL.squash = -.22;
    spawnPFX(PL.x + PL.w / 2, PL.y + PL.h, '#00ff88', 8, 3.5);
    PL.coyoteTimer = 0;
  } else if (!PL.djUsed) {
    PL.vy = DJUMP_FORCE; PL.djUsed = true;
    PL.squash = -.28;
    spawnPFX(PL.x + PL.w / 2, PL.y + PL.h, '#00eeff', 14, 5);
    spawnFT(PL.x, PL.y - 10, 'DOUBLE!', '#00eeff');
  }
  PL.jumpBuffer = 0;
}
function dash() {
  // El PERFECT DODGE se concedía antes del guard y dentro de un setTimeout, así
  // que daba XP aunque el dash se rechazara por cooldown o el jugador ya
  // estuviera muerto. Ahora solo se paga cuando el dash ocurre de verdad.
  if (state !== 'playing' || PL.dashCd > 0 || PL.dashing) return;
  playSound('dash'); _hap('medium');
  if (enemies.some(e => Math.abs(e.x - PL.x) < 80 && Math.abs(e.y - PL.y) < 60)) {
    showPUNotif('💨 PERFECT DODGE! +XP'); addXP(15); addScore(50);
  }
  PL.dashing = true; PL.dashTimer = DASH_DUR;
  PL.dashDir = PL.facing;
  PL.invTimer = Math.max(PL.invTimer, DASH_DUR + 4);
  PL.dashCd = DASH_CD;
  spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#7c3aed', 16, 6);
  spawnFT(PL.x, PL.y - 15, 'DASH!', '#a78bfa');
}
function attack() {
  // El sonido va DESPUÉS del guard: antes, machacar el botón disparaba una
  // ametralladora de sonidos mientras el ataque estaba en cooldown y no pasaba
  // nada. El juego mentía sobre lo que estaba aceptando.
  if (state !== 'playing' || PL.attackCd > 0 || PL.slamming) return;
  playSound('attack'); _hap('medium');
  tutorialAdvance('attack');
  // Aerial slam: web requiere C/↓; en móvil/tg cualquier ataque aéreo cayendo
  const slamKey = DQE.airSlamNeedsKey === false ? true : (keys['KeyC'] || keys['ArrowDown']);
  if (!PL.onGround && PL.vy >= 0 && slamKey) {
    PL.slamming = true; PL.slamTimer = 20; PL.vy = 12;
    spawnFT(PL.x, PL.y - 15, 'SLAM!', '#ff6400', true);
    return;
  }
  if (PL.comboTimer > 0) PL.comboStep = (PL.comboStep + 1) % 3; else PL.comboStep = 0;
  PL.swingId = (PL.swingId || 0) + 1;   // identifica este swing para el multi-golpe
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
    missionEvent('kill', 1); achEvent('onKill');
    if (e.isBoss) { missionEvent('boss', 1); achEvent('onBoss'); }
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
  // El tope venía fijo a 5, lo que pisaba el bonus de combo de subir de nivel.
  comboMultiplier = Math.min(1 + Math.floor(comboCount / 3) * .5, comboCap);
  achEvent('onCombo', comboMultiplier);
  const total = Math.floor(pts * comboMultiplier);
  addScore(total);
  return total;
}
function missionEvent(type, val) { try { window.DQMissions && DQMissions.event(type, val); } catch (e) {} }
function achEvent(fn, val) { try { window.DQAch && DQAch[fn] && DQAch[fn](val); } catch (e) {} }

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
  if (waveTimer % WAVE_FRAMES === 0) {
    wave++;
    gameSpeed = baseSpeed + wave * .35;
    spawnFT(W / 2 - 80, 70, '— WAVE ' + wave + ' —', '#ffe600', true);
    missionEvent('wave', wave);
    achEvent('onWave', wave);
    showPUNotif('🌊 WAVE ' + wave + ' — VELOCIDAD UP!');
    shake(6);
    // Cada 5 waves cambia el bioma: antes el mundo cambiaba de color y el
    // jugador ni se enteraba de que era un sistema.
    if ((wave - 1) % 5 === 0) {
      const b = currentBiome();
      const bi = Math.floor((wave - 1) / 5) % BIOMES.length;
      markBiomeSeen(bi);
      spawnFT(W / 2, 108, '⟡ ' + b.name + ' ⟡', b.line, true);
      showPUNotif('⟡ Entras en ' + b.name);
      shake(9); freeze(4);
    }
    if (wave % 3 === 0) spawnEnemy(true);
  }
  if (wave % 3 === 0 && !bossActive && waveTimer % WAVE_FRAMES < 5) spawnEnemy(true);

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
  if (PL.y >= GY) {
    // Aterrizaje: antes era silencioso e invisible. Ahora suena, levanta polvo
    // y aplasta al duende un instante (squash), que es lo que da sensación de peso.
    if (!PL.onGround && PL.vy > 3) {
      playSound('land', PL.vy);
      PL.squash = Math.min(.34, PL.vy * .022);
      spawnPFX(PL.x + PL.w / 2, GY + PL.h - 2, 'rgba(255,255,255,.55)', Math.min(9, 2 + Math.round(PL.vy / 2)), 2.4, 3);
      if (PL.vy > 11) shake(3);
    }
    PL.y = GY; PL.vy = 0; PL.onGround = true; PL.djUsed = false;
  }

  if (wasOnGround && !PL.onGround) PL.coyoteTimer = 10;
  else if (PL.onGround) PL.coyoteTimer = 0;
  if (PL.coyoteTimer > 0) PL.coyoteTimer--;

  // Slam landing
  if (PL.slamming && PL.onGround) {
    PL.slamming = false;
    shake(12); freeze(7);
    PL.squash = .4;
    playSound('land', 14);
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
  // squash guarda cuánto se aplasta el sprite; decae rápido para que el efecto
  // se lea como un golpe seco y no como una deformación permanente.
  if (PL.squash) { PL.squash *= .78; if (Math.abs(PL.squash) < .01) PL.squash = 0; }
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
  // La hitbox se recalcula CADA frame siguiendo al jugador. Antes se congelaba
  // en la posición donde empezó el ataque mientras el arco dibujado seguía al
  // duende: se separaban hasta 56px y parecía que fallabas cuando acertabas.
  const attackBox = PL.attackHitbox;
  if (PL.attackTimer > 0 && attackBox.active) {
    const reach = [50, 60, 80][PL.comboStep];
    const yOff = [10, 5, -5][PL.comboStep];
    attackBox.x = PL.x + (PL.facing > 0 ? PL.w : -reach);
    attackBox.y = PL.y + yOff;
    attackBox.w = reach;
    attackBox.h = PL.h - yOff * 1.5;
  }
  let swingHits = 0;
  enemies = enemies.filter(e => {
    if (e.knock > 0) { e.x += e.knock; e.knock *= .72; if (e.knock < .4) e.knock = 0; }
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
    // Un swing puede tocar a VARIOS enemigos: antes se desactivaba la hitbox
    // con el primero, así que cortabas a través de tres bichos y solo moría uno.
    // e.hitBy evita que el mismo swing golpee dos veces al mismo enemigo.
    if (attackBox.active && e.hitBy !== PL.swingId && overlap(attackBox, { x: e.x + 6, y: e.y + 6, w: e.w - 12, h: e.h - 12 })) {
      e.hitBy = PL.swingId;
      swingHits++;
      const atkMult = skinBuffs?.atkMult || 1;
      const dmg = Math.ceil((1 + PL.comboStep) * atkMult);
      e.hp -= dmg; e.flashTimer = 10;
      e.knock = (e.knock || 0) + 5 + PL.comboStep * 2;   // retroceso: el golpe empuja
      if (skinBuffs?.lifesteal) { PL.hp = Math.min(PL.maxHp, PL.hp + Math.ceil(dmg * skinBuffs.lifesteal * 10)); updateHpHUD(); }
      const pts = hitCombo(e.isBoss ? 120 : e.isCharger ? 80 : 60);
      spawnPFX(attackBox.x + attackBox.w / 2, e.y + e.h / 2, ['#ffe600', '#ff9900', '#ff3333'][PL.comboStep], 8 + PL.comboStep * 5, 4 + PL.comboStep * 2);
      spawnFT(e.x, e.y - 20, '+' + pts, ['#ffe600', '#ff9900', '#ff3333'][PL.comboStep]);
      updateHUD();
      playSound('slash');              // el impacto melee no sonaba en absoluto
      freeze(3 + PL.comboStep);
      shake(2 + PL.comboStep);
      _hap('light');
    }

    // kill check
    if (e.hp <= 0) {
      killStreak++; killStreakTimer = 180;
      if (killStreak === 3) showPUNotif('🔥 3 KILLS - RACHA!');
      else if (killStreak === 5) { showPUNotif('☄️ 5 KILLS - IMPARABLE!'); shake(5); }
      else if (killStreak === 10) { showPUNotif('⚡ 10 KILLS - LEGENDARIO!'); shake(8); addXP(50); }
      missionEvent('kill', 1); achEvent('onKill');
      if (e.isBoss) { bossActive = false; bossKilled++; missionEvent('boss', 1); achEvent('onBoss'); spawnFT(e.x, e.y - 30, 'BOSS MUERTO!', '#ff00cc', true); playSound('boss'); addXP(80); _hap('heavy'); }
      else { addXP(e.isMagmar ? 30 : e.isCharger ? 20 : e.isExploder ? 15 : 10); playSound('crunch'); _hap('medium'); }
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
      freeze(e.isBoss ? 10 : e.isMagmar ? 6 : 4);
      return false;
    }

    // ── PLAYER DAMAGE ──
    if (e.isExploder && overlap({ x: PL.x - 20, y: PL.y - 20, w: PL.w + 40, h: PL.h + 40 }, { x: e.x, y: e.y, w: e.w, h: e.h })) {
      shake(15); e.hp = -1;
      freeze(8);
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
      shake(8); freeze(6);
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
            missionEvent('kill', 1); achEvent('onKill');
            if (e.isBoss) { bossActive = false; missionEvent('boss', 1); achEvent('onBoss'); }
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

  // Un swing que toca a 2+ enemigos se celebra: es la recompensa a posicionarse
  // bien, y antes era invisible porque el ataque solo golpeaba a uno.
  if (swingHits >= 2) {
    spawnFT(PL.x, PL.y - 42, swingHits >= 3 ? 'TRIPLE!' : 'DOBLE!', '#ff3333', true);
    freeze(5); shake(5);
  }

  // ── COINS (con buff coinMult de skins) ──
  const skinCoinMult = skinBuffs?.coinMult || 1;
  coins = coins.filter(c => {
    c.x -= c.spd > 0 ? c.spd : gameSpeed * .6;
    c.bob += .09; c.y += Math.sin(c.bob) * .7;
    const dx = PL.x + PL.w / 2 - (c.x + c.w / 2);
    const dy = PL.y + PL.h / 2 - (c.y + c.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    // imán activo: rango y fuerza mucho mayores
    const range = puMagnet > 0 ? 320 : 90;
    const pull = puMagnet > 0 ? .25 : .12;
    if (dist < range) { c.x += dx * pull; c.y += dy * pull; }
    if (overlap({ x: PL.x + 4, y: PL.y + 4, w: PL.w - 8, h: PL.h - 8 }, c)) {
      const coinVal = Math.ceil(1 * skinCoinMult);
      sessionCoins += coinVal;
      totalCoins += coinVal;
      missionEvent('coin', 1);
      addScore(Math.floor(10 * comboMultiplier * skinCoinMult * (puDouble > 0 ? 2 : 1)));
      addXP(5);
      playSound('coin');
      spawnPFX(c.x + c.w / 2, c.y + c.h / 2, '#ffe600', 6, 3, 3);
      if (totalCoins % 10 === 0) spawnFT(PL.x, PL.y - 20, 'x' + comboMultiplier + ' COINS!', '#ffe600');
      achEvent('onSessionCoins', sessionCoins);
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

  // ── POWER-UPS ──
  if (puMagnet > 0) puMagnet--;
  if (puDouble > 0) puDouble--;
  if (frame % 900 === 0 && frame > 0) spawnPowerup(); // ~cada 15s
  powerups = powerups.filter(pu => {
    pu.x -= pu.spd > 0 ? pu.spd : gameSpeed * .55;
    pu.bob += .08; pu.y += Math.sin(pu.bob) * .6;
    if (overlap({ x: PL.x, y: PL.y, w: PL.w, h: PL.h }, pu)) {
      const def = PU_TYPES[pu.type];
      if (pu.type === 'magnet') puMagnet = def.dur;
      else if (pu.type === 'double') puDouble = def.dur;
      else if (pu.type === 'shield') { PL.shieldOn = true; PL.shieldTimer = def.dur; PL.invTimer = Math.max(PL.invTimer, def.dur); }
      showPUNotif(def.label);
      spawnFT(pu.x, pu.y - 10, def.emoji, def.color, true);
      spawnPFX(pu.x + pu.w / 2, pu.y + pu.h / 2, def.color, 20, 5, 5);
      playSound('powerup'); _hap('heavy');
      return false;
    }
    return pu.x > -50;
  });

  // ── PARTICLES / TEXT ──
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; if (!p.ring) p.vy += .12; p.life -= p.decay; if (p.ring) p.sz += 4; return p.life > 0; });
  fTexts = fTexts.filter(t => { t.y += t.vy; t.life -= t.decay; return t.life > 0; });

  // ── BG SCROLL ──
  bgStars.forEach(s => { s.x -= s.sp; if (s.x < 0) s.x = W; });
  bgMtns.forEach(m => { m.x -= m.sp; if (m.x < -m.w) m.x = W + m.w; });
  bgClouds.forEach(c => { c.x -= c.sp; if (c.x < -c.w - 20) c.x = W + c.w; });
  groundX = (groundX - gameSpeed) % 40;

  // ── SPAWN RATES ──
  // arranque más vivo (wave 1 ya tiene acción) y techo de densidad para que sea difícil pero justo
  const spawnRate = Math.max(50, 105 - wave * 8);
  if (frame % spawnRate === 0 && enemies.length < 8 + wave) spawnEnemy();
  if (frame % 60 === 0) spawnCoin();

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

// ── BIOMAS: cada 5 waves el mundo cambia de color (sensación de viaje) ──
// Los nombres no son decoracion: convierten un cambio de color que pasaba
// desapercibido en un hito visible cada 5 waves, y en algo que coleccionar.
const BIOMES = [
  { name: 'NOCHE VIOLETA',    top: '#010015', bot: '#050520', mtn: 'rgba(124,58,237,.07)',  cloud: '124,58,237',  ground: '#0a1a0f', line: '#00ff88' },
  { name: 'AMANECER ROJO',    top: '#150005', bot: '#2a0510', mtn: 'rgba(255,68,68,.08)',   cloud: '255,80,40',   ground: '#1a0a0a', line: '#ff6444' },
  { name: 'SELVA ESMERALDA',  top: '#001512', bot: '#03251c', mtn: 'rgba(0,255,170,.06)',   cloud: '0,200,150',   ground: '#06140f', line: '#00ffcc' },
  { name: 'TORMENTA ARCANA',  top: '#0a0a18', bot: '#1c1430', mtn: 'rgba(192,132,252,.09)', cloud: '192,132,252', ground: '#120a1f', line: '#c084fc' },
  { name: 'DESIERTO DORADO',  top: '#181000', bot: '#2e2004', mtn: 'rgba(255,200,0,.07)',   cloud: '255,180,0',   ground: '#1a140a', line: '#ffe600' },
];
// Biomas vistos alguna vez, para poder enseñar "BIOMAS 3/5" como colección.
function markBiomeSeen(i) {
  try {
    const seen = JSON.parse(localStorage.getItem('dq_biomes') || '[]');
    if (!seen.includes(i)) { seen.push(i); localStorage.setItem('dq_biomes', JSON.stringify(seen)); }
  } catch (e) {}
}
function biomesSeen() {
  try { return JSON.parse(localStorage.getItem('dq_biomes') || '[]').length; } catch (e) { return 0; }
}
function currentBiome() { return BIOMES[Math.floor((wave - 1) / 5) % BIOMES.length]; }
let _vignette = null;

function drawPuTimer(x, emoji, pct, color) {
  cx.save();
  cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(x, 8, 38, 22);
  cx.fillStyle = color; cx.fillRect(x, 28, 38 * Math.max(0, pct), 3);
  cx.font = '13px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
  cx.fillStyle = '#fff'; cx.fillText(emoji, x + 19, 18);
  cx.restore();
}
function draw() {
  const sx = (shakeAmt > 0 ? Math.round((Math.random() - .5) * shakeAmt * 2) : 0);
  const sy = (shakeAmt > 0 ? Math.round((Math.random() - .5) * shakeAmt * 2) : 0);
  cx.save();
  if (shakeAmt > 0) cx.translate(sx, sy);

  // BG
  const biome = currentBiome();
  const grad = cx.createLinearGradient(0, 0, 0, GY + 10);
  grad.addColorStop(0, biome.top);
  grad.addColorStop(1, biome.bot);
  cx.fillStyle = grad;
  cx.fillRect(0, 0, W, H);

  bgStars.forEach(s => { cx.fillStyle = `rgba(255,255,255,${.2 + Math.sin(frame * .04 + s.x) * .15})`; cx.fillRect(s.x, s.y, s.s, s.s); });

  cx.fillStyle = biome.mtn;
  bgMtns.forEach(m => { cx.beginPath(); cx.moveTo(m.x, GY + 10); cx.lineTo(m.x + m.w / 2, GY + 10 - m.h); cx.lineTo(m.x + m.w, GY + 10); cx.fill(); });

  bgClouds.forEach(c => {
    const cg = cx.createRadialGradient(c.x + c.w / 2, c.y + c.h / 2, 0, c.x + c.w / 2, c.y + c.h / 2, c.w / 2);
    cg.addColorStop(0, `rgba(${biome.cloud},${c.alpha * 2})`);
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = cg; cx.fillRect(c.x, c.y, c.w, c.h * 2);
  });

  // Ground
  cx.fillStyle = biome.ground;
  cx.fillRect(0, GY + PL.h, W, H - (GY + PL.h));
  cx.fillStyle = biome.line;
  cx.fillRect(0, GY + PL.h, W, 3);
  cx.fillStyle = 'rgba(0,255,136,.1)';
  for (let gx = groundX; gx < W; gx += 40) cx.fillRect(gx, GY + PL.h + 3, 2, H - (GY + PL.h + 3));

  // ── SOMBRAS DE CONTACTO ──
  // Todas juntas y ANTES de cualquier sprite, para que ninguna se pinte encima
  // de otra entidad. Es el truco más barato que existe para dar peso en 2D: la
  // sombra se encoge y se aclara con la altura, así se lee de un vistazo a qué
  // altura está cada cosa (sobre todo el propio salto del jugador).
  cx.save();
  cx.fillStyle = '#000';
  const _shadow = ent => {
    const k = 1 - Math.min(1, (GROUND - (ent.y + ent.h)) / 130);
    if (k <= .05) return;
    cx.globalAlpha = .38 * k;
    cx.beginPath();
    cx.ellipse(ent.x + ent.w / 2, GROUND + 2, ent.w * .42 * k, 5 * k, 0, 0, Math.PI * 2);
    cx.fill();
  };
  enemies.forEach(_shadow);
  chests.forEach(_shadow);
  weaponDrops.forEach(_shadow);
  if (state === 'playing' || state === 'paused') _shadow(PL);
  cx.restore();

  // Coins
  coins.forEach(c => {
    cx.save(); cx.imageSmoothingEnabled = false;
    cx.drawImage(IMG_EL['coin'], c.x, c.y, c.w, c.h); cx.restore();
  });

  // Chests
  chests.forEach(ch => {
    const shadowColors = { comun: '#aaffaa', epico: '#cc44ff', legendario: '#ffe600' };
    const pulse = Math.sin(ch.glowTimer * .08) * .5 + .5;
    cx.save(); cx.imageSmoothingEnabled = false;
    cx.shadowColor = shadowColors[ch.tier];
    cx.shadowBlur = 10 + pulse * 14;
    cx.globalAlpha = .92 + pulse * .08;
    cx.drawImage(IMG_EL['cofre_' + ch.tier], ch.x, ch.y, ch.w, ch.h);
    cx.restore();
  });

  // Weapon drops
  weaponDrops.forEach(w => {
    const pulse = Math.sin(frame * .1) * .4 + .6;
    cx.save(); cx.imageSmoothingEnabled = false;
    cx.shadowColor = w.type === 'katana_spark' ? '#00eeff' : '#ffe600';
    cx.shadowBlur = 8 + pulse * 10;
    cx.globalAlpha = .85 + pulse * .15;
    cx.drawImage(IMG_EL[w.type], w.x, w.y, w.w, w.h);
    cx.restore();
  });

  // Power-ups (burbuja con emoji)
  powerups.forEach(pu => {
    const def = PU_TYPES[pu.type];
    const pulse = Math.sin(frame * .15) * .15 + .9;
    cx.save();
    cx.shadowColor = def.color; cx.shadowBlur = 14;
    cx.fillStyle = 'rgba(0,0,0,.35)';
    cx.beginPath(); cx.arc(pu.x + pu.w / 2, pu.y + pu.h / 2, pu.w / 2 * pulse, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = def.color; cx.lineWidth = 2; cx.stroke();
    cx.shadowBlur = 0; cx.font = '18px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillStyle = '#fff';
    cx.fillText(def.emoji, pu.x + pu.w / 2, pu.y + pu.h / 2 + 1);
    cx.restore();
  });
  // Indicador de power-ups activos (esquina sup. izquierda del canvas)
  let pux = 8;
  if (puMagnet > 0) { drawPuTimer(pux, '🧲', puMagnet / PU_TYPES.magnet.dur, '#00eeff'); pux += 44; }
  if (puDouble > 0) { drawPuTimer(pux, '✖️2', puDouble / PU_TYPES.double.dur, '#ffe600'); pux += 44; }

  // Particles
  particles.forEach(p => {
    cx.save(); cx.globalAlpha = p.life;
    if (p.ring) { cx.strokeStyle = p.color; cx.lineWidth = 3; cx.beginPath(); cx.arc(p.x, p.y, p.sz / 2, 0, Math.PI * 2); cx.stroke(); }
    else { cx.fillStyle = p.color; cx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz); }
    cx.restore();
  });

  // Enemies
  enemies.forEach(e => {
    // El flash de golpe era una bajada de alpha a .25: al pegarle, el enemigo se
    // volvía TRANSPARENTE, que se lee como "está desapareciendo", no como
    // "acaba de encajar un golpe". Ahora destella en BLANCO y mantiene su cuerpo.
    const ghostA = e.isGhost ? (e.ghostAlpha || 1) : 1;
    const key = e.isBoss ? 'enemy2' : e.isMagmar ? 'enemy_magmar' : 'enemy';
    const variant = enemyTint(e);
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalAlpha = ghostA;
    if (e.isExploder) { cx.shadowColor = '#ff4400'; cx.shadowBlur = 12 + Math.sin(frame * .2) * 8; }
    if (e.isGhost) { cx.shadowColor = '#9333ea'; cx.shadowBlur = 16; }
    if (e.isMagmar) { cx.shadowColor = '#ff4400'; cx.shadowBlur = 18 + Math.sin(frame * .15) * 10; }
    cx.translate(e.x + e.w / 2, 0); cx.scale(-1, 1);
    cx.drawImage(variant ? tintedSprite(key, variant) : IMG_EL[key], -e.w / 2, e.y, e.w, e.h);
    if (e.flashTimer > 0) {
      cx.globalAlpha = ghostA * Math.min(1, e.flashTimer / 8);
      cx.drawImage(whiteSprite(key), -e.w / 2, e.y, e.w, e.h);
    }
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

  // Player bullets — el fuego SÍ es aditivo, pero con 'lighter' en vez de
  // 'screen': suma luz sin volver invisible el negro del sprite.
  bullets.filter(b => !b.enemy).forEach(b => {
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = .9;
    cx.drawImage(IMG_EL['skill_fire'], b.x, b.y - b.h / 2, b.w * 1.8, b.h * 1.8); cx.restore();
  });

  // ── PLAYER ──
  const plAlpha = PL.invTimer > 0 && PL.invTimer % 8 < 4 ? .3 : 1;
  const _plImg = _playerImg();
  cx.save(); cx.imageSmoothingEnabled = false; cx.globalAlpha = plAlpha;
  // Squash & stretch: se aplasta al aterrizar y se estira al saltar, siempre
  // conservando el volumen y anclado a los pies para que no "flote".
  const sq = PL.squash || 0;
  const pw = PL.w * (1 + sq * .55), ph = PL.h * (1 - sq);
  const px = PL.x - (pw - PL.w) / 2, py = PL.y + (PL.h - ph);
  if (PL.facing < 0) { cx.translate(px + pw, 0); cx.scale(-1, 1); cx.drawImage(_plImg, 0, py, pw, ph); }
  else cx.drawImage(_plImg, px, py, pw, ph);
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
      cx.save(); cx.imageSmoothingEnabled = false;
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
    cx.save(); cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = .7 + Math.sin(frame * .15) * .25;
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

  // Tutorial hints (primera partida): texto grande y pulsante en el centro
  if (tutorialStep < 2 && state === 'playing') {
    const pulse = .75 + Math.sin(frame * .12) * .25;
    cx.save();
    cx.globalAlpha = pulse;
    cx.fillStyle = '#ffe600';
    cx.font = '.8rem "Press Start 2P"';
    cx.textAlign = 'center';
    cx.shadowColor = '#000'; cx.shadowBlur = 8;
    cx.fillText(tutorialStep === 0 ? '☝️ TOCA / ESPACIO = SALTAR' : '⚔ TOCA EL BOTÓN ⚔ / Z = ATACAR', W / 2, 70);
    cx.restore();
  }

  // Flash rojo al recibir daño. PL.flashTimer ya se ponía a 20 en los tres
  // puntos de daño y se decrementaba cada frame, pero draw() no lo leía en
  // ningún sitio: el estado estaba calculado y no se dibujaba.
  if (PL.flashTimer > 0) {
    cx.fillStyle = 'rgba(255,40,40,' + (PL.flashTimer / 20 * .26).toFixed(3) + ')';
    cx.fillRect(0, 0, W, H);
  }

  // Viñeta: oscurece las esquinas y empuja la mirada al centro de la acción.
  // Se cachea porque crear el gradiente cada frame es caro en móvil.
  if (!_vignette) {
    _vignette = document.createElement('canvas');
    _vignette.width = W; _vignette.height = H;
    const vg = _vignette.getContext('2d');
    const rg = vg.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .62);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,.42)');
    vg.fillStyle = rg; vg.fillRect(0, 0, W, H);
  }
  cx.drawImage(_vignette, 0, 0);

  // Floating texts — con contorno negro para que se lean sobre cualquier bioma.
  cx.save();
  fTexts.forEach(t => {
    cx.globalAlpha = t.life;
    cx.font = (t.big ? .55 : .42) + 'rem "Press Start 2P"';
    cx.textAlign = 'center';
    cx.lineWidth = 4; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.lineJoin = 'round';
    cx.strokeText(t.txt, t.x, t.y);
    cx.fillStyle = t.color;
    cx.fillText(t.txt, t.x, t.y);
  });
  cx.restore();

  cx.restore(); // shake
}

// ── LOOP ──
// Paso fijo con acumulador. Antes se llamaba a update() una vez por
// requestAnimationFrame, así que en un móvil de 120Hz (lo normal hoy, y la Mini
// App de Telegram es la plataforma principal) TODO corría al doble: gravedad,
// velocidad, cooldowns y la duración de las waves. Ahora la simulación siempre
// avanza a 60 pasos por segundo, se pinte a los fps que se pinte.
const STEP = 1000 / 60;
let _acc = 0, _last = 0;

function resetLoopClock() { _acc = 0; _last = 0; }

function loop(ts) {
  if (state !== 'playing') { raf = null; return; }
  if (!_last) _last = ts;
  let dt = ts - _last;
  _last = ts;
  if (dt > 250) dt = STEP;          // volvimos de una pestaña en segundo plano
  _acc += dt;

  let steps = 0;
  while (_acc >= STEP && steps < 5) {
    if (hitStop > 0) {
      // Congelamos la simulación, pero el temblor tiene que seguir bajando
      // o se queda clavado y se ve como un error de dibujo.
      hitStop--;
      if (shakeTimer > 0) { shakeTimer--; shakeAmt *= .85; if (shakeTimer <= 0) shakeAmt = 0; }
    } else {
      update();
    }
    _acc -= STEP; steps++;
  }
  if (steps === 5) _acc = 0;        // no acumular deuda si el móvil no da más

  draw();
  try { DQE.loopTick && DQE.loopTick(); } catch (e) {}
  raf = requestAnimationFrame(loop);
}

// ── LIFECYCLE ──
function startGame() {
  playMusic();
  hideAll();
  score = 0; wave = 1; frame = 0; gameSpeed = baseSpeed; waveTimer = 0; bossActive = false; bossKilled = 0;
  reviveUsed = false;
  sessionCoins = 0; comboCount = 0; comboMultiplier = 1; comboTimer = 0;
  playerXP = 0; playerLevel = 1;
  killStreak = 0; killStreakTimer = 0;
  enemies = []; coins = []; bullets = []; particles = []; fTexts = [];
  chests = []; weaponDrops = []; weaponBuff = null;
  powerups = []; puMagnet = 0; puDouble = 0;
  shakeAmt = 0; shakeTimer = 0; hitStop = 0;
  const bHp = _buffs()?.bonusHp || 0;
  Object.assign(PL, { x: 80, y: GY, vx: 0, vy: 0, onGround: false, jumping: false, djUsed: false, coyoteTimer: 0, jumpBuffer: 0, dashing: false, dashTimer: 0, dashDir: 1, dashCd: 0, comboStep: 0, comboTimer: 0, attackTimer: 0, attackCd: 0, attackHitbox: { x: 0, y: 0, w: 0, h: 0, active: false }, slamming: false, slamTimer: 0, hp: 100 + bHp, maxHp: 100 + bHp, invTimer: 0, shieldOn: false, shieldTimer: 0, fireOn: false, fireTimer: 0, lightTimer: 0, flashTimer: 0, facing: 1, animTimer: 0, runFrame: 0, items: [[3, 0, 90], [2, 0, 120], [1, 0, 150], [1, 0, 180]] });

  loadProgress();
  runXP = 0;

  // Los perks de nivel se aplican AQUÍ, después de loadProgress(), porque es
  // loadProgress() quien restaura playerLevel. Antes el Object.assign de arriba
  // dejaba maxHp en 100 fijo y todo lo ganado subiendo de nivel se perdía.
  const perks = levelPerks(playerLevel);
  PL.maxHp = 100 + bHp + perks.bonusHp;
  PL.hp = PL.maxHp;
  comboCap = perks.comboCap;
  PL.items[0][0] = Math.max(PL.items[0][0], perks.potions);

  try { DQE.onStartGame && DQE.onStartGame(); } catch (e) {}

  initBg();
  updateHpHUD(); updateHUD(); updateXPBar();
  for (let i = 0; i < 4; i++) updateItemHUD(i);
  state = 'playing';
  // Un solo bucle vivo: reanudar sin cancelar el anterior duplicaba el rAF y
  // el juego se aceleraba tras varias pausas o revives.
  if (raf) cancelAnimationFrame(raf);
  resetLoopClock();
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
  // Un solo bucle vivo: reanudar sin cancelar el anterior duplicaba el rAF y
  // el juego se aceleraba tras varias pausas o revives.
  if (raf) cancelAnimationFrame(raf);
  resetLoopClock();
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
  renderDeadNudge();
  const ov = $id('ov-dead'); if (ov) ov.classList.add('show');
  offerRevive();
  try {
    DQE.onEndGame && DQE.onEndGame({ score: Math.floor(score), wave, level: playerLevel, coins: sessionCoins, bosses_killed: bossKilled, combos_max: comboCount });
  } catch (e) {}
}

// ── EL "CASI": el gancho que dispara la segunda partida ──
// Morir mostraba un número y nada más. El momento de máxima intención de
// reintentar es justo ese, y el juego no daba ninguna razón concreta. Todos
// estos datos ya estaban en memoria; solo había que decirlos.
function nearMissLines() {
  const out = [];
  const dHi = Math.ceil(hiScore - score);
  if (score < hiScore && dHi > 0 && dHi < Math.max(400, hiScore * .35)) {
    out.push('🎯 Te faltaron <b>' + dHi.toLocaleString() + '</b> pts para tu récord');
  }
  const nextWave = [5, 10, 15, 20, 30].find(w => wave < w);
  if (nextWave) out.push('🌊 Llegaste a la wave <b>' + wave + '</b> — la <b>' + nextWave + '</b> está cerca');
  const seen = biomesSeen();
  if (seen < BIOMES.length) {
    const nextBiomeWave = (Math.floor((wave - 1) / 5) + 1) * 5 + 1;
    out.push('⟡ Biomas descubiertos: <b>' + seen + '/' + BIOMES.length + '</b> — el siguiente en la wave ' + nextBiomeWave);
  }
  try {
    const m = (DQMissions.state.list || []).filter(x => !x.done)
      .sort((a, b) => (b.progress / b.goal) - (a.progress / a.goal))[0];
    if (m) out.push('📋 ' + m.desc + ': <b>' + m.progress + '/' + m.goal + '</b>');
  } catch (e) {}
  if (runXP > 0) {
    const pct = Math.round(playerXP / getXPNeeded(playerLevel) * 100);
    out.push('⬆️ <b>+' + runXP.toLocaleString() + ' XP</b> → LVL ' + playerLevel + ' (' + pct + '%)');
  }
  return out.slice(0, 3);
}

function renderDeadNudge() {
  const ov = $id('ov-dead'); if (!ov) return;
  let box = $id('dead-nudge');
  if (!box) {
    box = document.createElement('div');
    box.id = 'dead-nudge';
    box.style.cssText = 'font-size:.36rem;line-height:1.9;color:rgba(255,255,255,.8);margin:.5rem 0;text-align:center;max-width:92%';
    const ds = $id('dead-stats');
    if (ds && ds.parentNode) ds.parentNode.insertBefore(box, ds.nextSibling); else ov.appendChild(box);
  }
  box.innerHTML = nearMissLines().join('<br>');
}

// ── REVIVE (una vez por partida, cuesta DQ) ──
function offerRevive() {
  const ov = $id('ov-dead'); if (!ov) return;
  let btn = $id('revive-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'revive-btn';
    btn.className = 'ob';
    btn.style.cssText = 'background:linear-gradient(135deg,#ff00cc,#7c3aed);color:#fff;font-size:.6rem;box-shadow:0 0 24px rgba(255,0,204,.5),4px 4px 0 rgba(0,0,0,.6)';
    btn.onclick = reviveGame;
    const title = ov.querySelector('.ov-title');
    if (title && title.nextSibling) ov.insertBefore(btn, title.nextSibling); else ov.prepend(btn);
  }
  const can = !reviveUsed && totalCoins >= REVIVE_COST;
  btn.style.display = can ? '' : 'none';
  if (can) btn.textContent = '💖 REVIVIR — ' + REVIVE_COST + ' DQ (tienes ' + totalCoins + ')';
}
function reviveGame() {
  if (reviveUsed || totalCoins < REVIVE_COST || state !== 'dead') return;
  reviveUsed = true;
  totalCoins -= REVIVE_COST;
  saveProgress();
  PL.hp = Math.ceil(PL.maxHp * .6);
  PL.invTimer = 150;
  enemies = []; bullets = [];
  spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff00cc', 35, 7, 6);
  spawnFT(PL.x, PL.y - 30, '💖 REVIVIDO!', '#ff00cc', true);
  showPUNotif('💖 SEGUNDA OPORTUNIDAD — ¡dale con todo!');
  _hap('heavy');
  const ov = $id('ov-dead'); if (ov) ov.classList.remove('show');
  updateHpHUD(); updateHUD();
  playMusic();
  state = 'playing';
  // Un solo bucle vivo: reanudar sin cancelar el anterior duplicaba el rAF y
  // el juego se aceleraba tras varias pausas o revives.
  if (raf) cancelAnimationFrame(raf);
  resetLoopClock();
  raf = requestAnimationFrame(loop);
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
