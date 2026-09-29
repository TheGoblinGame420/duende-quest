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

// ── ESTADO DE CARGA ──
// Se lanzan 28 imagenes sin ninguna UI, y drawSpr() hace return si una imagen
// no esta lista: con red lenta se podia empezar una partida de sprites
// invisibles. Cada imagen del motor pasa por _vigilar(); el boton JUGAR
// (id btn-jugar) queda deshabilitado ensenando el porcentaje hasta el 100%.
// Un error de red cuenta como cargada: el motor tiene fallbacks para todo y
// quedarse sin boton JUGAR seria peor que un sprite ausente.
let _porCargar = 0, _cargadas = 0;
function _vigilar(img) {
  _porCargar++;
  if (img.complete && img.naturalWidth) { _cargadas++; return; }
  const fin = () => { _cargadas++; _pintarCarga(); };
  img.addEventListener('load', fin, { once: true });
  img.addEventListener('error', fin, { once: true });
}
function cargaCompleta() { return _cargadas >= _porCargar; }
function _pctCarga() { return _porCargar ? Math.round(_cargadas / _porCargar * 100) : 100; }
function _pintarCarga() {
  const b = $id('btn-jugar');
  if (!b) return;
  if (!b.dataset.label) b.dataset.label = b.textContent;
  if (cargaCompleta()) { b.disabled = false; b.style.opacity = ''; b.textContent = b.dataset.label; }
  else { b.disabled = true; b.style.opacity = '.55'; b.textContent = '⌛ CARGANDO ' + _pctCarga() + '%'; }
}
window.addEventListener('DOMContentLoaded', _pintarCarga);

// ── PARALLAX ──
// El fondo eran un degradado, unos triangulos planos y unas nubes radiales.
// Ahora cada bioma tiene dos capas de silueta que se desplazan a distinta
// velocidad, que es lo que crea sensacion de profundidad y de sitio. Pesan
// 11 KB las diez juntas (PNG de paleta), y se generan con
// tools/generar_parallax.py usando la MISMA paleta del array BIOMES.
// Segunda variante para amanecer/tormenta (packs CC0 ya descargados y sin
// usar: Sunny Land y Castle Platformer — ver tools/generar_fondos_variantes.py).
// El motor elige una al azar cada vez que ENTRA a ese bioma (no cada frame:
// ver _bgVarBi mas abajo), asi la campaña no se ve identica en cada vuelta.
const FONDO_VARIANTES = [['noche'], ['amanecer', 'amanecer2'], ['selva', 'selva2'], ['tormenta', 'tormenta2'], ['desierto']];
const FONDOS = FONDO_VARIANTES.map(nombres => nombres.map(n => {
  const lejos = new Image(); lejos.src = _AB + 'fondos/' + n + '_lejos.png';
  const cerca = new Image(); cerca.src = _AB + 'fondos/' + n + '_cerca.png';
  _vigilar(lejos); _vigilar(cerca);
  return { lejos, cerca };
}));
let scrollLejos = 0, scrollCerca = 0;
let _bgVarBi = -1, _bgVarIdx = 0;

// Dibuja una capa repetida en bucle horizontal, anclada al suelo.
function dibujarCapa(img, desplaz, alturaSobreSuelo) {
  if (!img || !img.naturalWidth) return;
  const escala = H / 320;                    // las capas se disenaron para 320 de alto
  const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
  const y = GROUND - h + alturaSobreSuelo * escala;
  let x = -(desplaz % w);
  while (x < W) { cx.drawImage(img, x, y, w, h); x += w; }
}
const IMG = {
  duende_hero: _AB + 'skins/skin_hero.png',
  enemy: _AB + 'enemigos/enemy.png',
  enemy2: _AB + 'enemigos/enemy2.png',
  enemy_magmar: _AB + 'enemigos/enemy_magmar.png',
  sh_goblin_normal: _AB + 'enemigos/sheets/goblin_normal.png',
  sh_esqueleto: _AB + 'enemigos/sheets/esqueleto.png',
  sh_goblin_samurai: _AB + 'enemigos/sheets/goblin_samurai.png',
  sh_goblin_mage: _AB + 'enemigos/sheets/goblin_mage.png',
  sh_hongo: _AB + 'enemigos/sheets/hongo.png',
  sh_goblin_peasant: _AB + 'enemigos/sheets/goblin_peasant.png',
  sh_goblin_assassin: _AB + 'enemigos/sheets/goblin_assassin.png',
  sh_lagarto: _AB + 'enemigos/sheets/lagarto.png',
  sh_goblin_centurion: _AB + 'enemigos/sheets/goblin_centurion.png',
  sh_goblin_battlelord: _AB + 'enemigos/sheets/goblin_battlelord.png',
  sh_serpiente: _AB + 'enemigos/sheets/serpiente.png',
  sh_angel: _AB + 'enemigos/sheets/angel.png',
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
  // Las dos skins mas caras existian en disco y se usaban de foto en la
  // tienda, pero en partida se sustituian por otro personaje: quien pagaba
  // 250 $ veia al berserker. Ahora cada skin usa su propio sprite.
  skin_necromancer: _AB + 'skins/skin_necromancer.png',
  skin_legendariafull: _AB + 'skins/skin_legendariafull.png',
  duende_comun: _AB + 'skins/duende_comun.png',
};
// ── EFECTOS (FX) EN TIRA ──
// Pack CC0 de ansimuz (Sideview Fantasy), unido en tiras por
// tools/generar_fx.py. [ancho, alto, frames, ticks por frame]
const FX = {
  corte_h:      [65, 40, 5, 2],
  corte_arriba: [52, 56, 5, 2],
  corte_giro:   [52, 48, 6, 2],
  muerte:       [64, 64, 8, 3],
  rayo:         [128, 96, 9, 2],
};
Object.keys(FX).forEach(k => { IMG['fx_' + k] = _AB + 'fx/' + k + '.png'; });
const IMG_EL = {};
Object.entries(IMG).forEach(([k, v]) => { const el = new Image(); el.src = v; _vigilar(el); IMG_EL[k] = el; });

// ── ANIMACIÓN DEL DUENDE ──
// En assets/sprite_sheets/ habia una hoja de animacion completa que nadie
// cargaba: el jugador era una imagen congelada, y de hecho el motor calculaba
// PL.animTimer y PL.runFrame sin leerlos jamas. tools/extraer_animacion.py
// convierte esa hoja en un atlas en tira; aqui se reproduce.
const ANIM_IMG = new Image();
ANIM_IMG.src = _AB + 'skins/duende_anim.png';
_vigilar(ANIM_IMG);
_pintarCarga();
let ANIM_META = null;
fetch(_AB + 'skins/duende_anim.json').then(r => r.json()).then(d => { ANIM_META = d; }).catch(() => {});

// Indices dentro del atlas. La primera fila es reposo (4) + caminar (6), la
// segunda ataque (5) + golpe recibido (3). Se salta el fotograma 0 porque su
// recorte sale mas pequeno que el resto y da un salto feo en el bucle.
const ANIM = {
  reposo: [1, 2, 3],
  camina: [4, 5, 6, 7, 8, 9],
  ataca: [10, 11, 12, 13, 14],
  herido: [15, 16, 17],
};

function animFrame() {
  if (!ANIM_META || !ANIM_IMG.naturalWidth) return -1;
  if (PL.attackTimer > 0) {
    const dur = 14 + PL.comboStep * 2;
    const t = 1 - Math.max(0, PL.attackTimer) / dur;
    return ANIM.ataca[Math.min(ANIM.ataca.length - 1, Math.floor(t * ANIM.ataca.length))];
  }
  if (PL.invTimer > 44) return ANIM.herido[Math.floor(frame / 6) % ANIM.herido.length];
  if (PL.onGround && Math.abs(PL.vx) > .6) return ANIM.camina[Math.floor(frame / 5) % ANIM.camina.length];
  return ANIM.reposo[Math.floor(frame / 14) % ANIM.reposo.length];
}

// Dibuja un fotograma del atlas encajado en la caja del jugador. La celda es
// mas alta que el duende erguido, asi que se escala por altoDePie para que la
// animacion se vea del mismo tamano que el sprite estatico de siempre.
function drawAnim(idx, caja, flip) {
  const [cw, ch] = ANIM_META.celda;
  const alto = caja.h / (ANIM_META.altoDePie || 1);
  const ancho = alto * (cw / ch);
  const x = caja.x + (caja.w - ancho) / 2;
  const y = caja.y + caja.h - alto;
  cx.save();
  if (flip) { cx.translate(x + ancho, 0); cx.scale(-1, 1); }
  cx.drawImage(ANIM_IMG, idx * cw, 0, cw, ch, flip ? 0 : x, y, ancho, alto);
  cx.restore();
}

// ── DIBUJADO RESPETANDO LA PROPORCIÓN ──
// Antes se estiraba el PNG entero dentro de la caja de colisión de la entidad.
// Como los sprites venían con enormes márgenes transparentes y proporciones
// distintas a la caja, el personaje salía aplastado al 40-60% de su ancho real:
// el duende (proporción 1.06) metido en una caja de 52x68 (proporción 0.76) se
// veía como un palo. Ahora los PNG están recortados a su dibujo, así que su
// proporción natural es la buena: se dibuja a la altura pedida, con el ancho
// que le corresponda, centrado sobre la caja y con los pies en la base.
function spriteRect(img, caja) {
  const h = caja.h;
  const prop = (img && img.naturalHeight) ? img.naturalWidth / img.naturalHeight
             : (img && img.height ? img.width / img.height : 1);
  // Tope de seguridad: un sprite muy apaisado (el jefe es un oso a cuatro
  // patas) se saldria demasiado de su caja de colisión y el jugador recibiria
  // golpes donde no parece haber nada. 1,7x deja el arte casi intacto y evita
  // el caso extremo.
  const w = Math.min(h * prop, caja.w * 1.7);
  return { x: caja.x + (caja.w - w) / 2, y: caja.y, w: w, h: h };
}

// Dibuja un sprite ajustado a la caja de la entidad, opcionalmente espejado.
function drawSpr(img, caja, flip) {
  if (!img || (img.naturalWidth !== undefined && !img.naturalWidth)) return;
  const r = spriteRect(img, caja);
  if (flip) {
    cx.save();
    cx.translate(r.x + r.w, 0);
    cx.scale(-1, 1);
    cx.drawImage(img, 0, r.y, r.w, r.h);
    cx.restore();
  } else {
    cx.drawImage(img, r.x, r.y, r.w, r.h);
  }
}

// ══ ANIMACION DE ENEMIGOS ══
// No hay hojas de sprites dibujadas para los enemigos, y no puedo dibujar arte
// nuevo. Pero un sprite sheet no es mas que una tabla de transformaciones por
// fotograma, y esas se pueden calcular: cada estado deforma, inclina, escala y
// desplaza el mismo bitmap. Sale mas fluido que una hoja de 4 fotogramas,
// pesa 0 KB y funciona igual para los siete tipos de enemigo.
//
// Estados: aparicion -> reposo -> anticipacion -> ataque -> golpeado -> muerte
function animEnemigo(e) {
  const t = frame * .1 + (e.bobTimer || 0);
  const a = { escalaX: 1, escalaY: 1, giro: 0, dx: 0, dy: 0, alpha: 1 };

  // APARICION: surge del suelo estirandose, con un destello. Antes los
  // enemigos simplemente se materializaban en el borde.
  if (e.aparicion > 0) {
    const k = 1 - e.aparicion / 26;          // 0 -> 1
    a.escalaY = .35 + k * .65;
    a.escalaX = 1.5 - k * .5;
    a.dy = (1 - k) * e.h * .5;
    a.alpha = Math.min(1, k * 1.6);
    return a;
  }

  // MUERTE: se aplasta contra el suelo girando y se desvanece. Los enemigos
  // con hoja de animacion (e.sheet) ya tienen su propio frame de KO dibujado
  // por el artista (un cuerpo colapsado): aplicarles ADEMAS este aplastado
  // por codigo comprimia dos veces y el sprite acababa en 1-2 px, invisible.
  if (e.muriendo > 0) {
    const k = 1 - e.muriendo / 16;
    a.alpha = 1 - k;
    if (e.sheet) return a;
    a.escalaY = 1 - k * .8;
    a.escalaX = 1 + k * .45;
    a.giro = k * (e.facing < 0 ? -.5 : .5);
    a.dy = k * e.h * .4;
    return a;
  }

  // ANTICIPACION del charger: se echa hacia atras antes de embestir. Es el
  // aviso que permite reaccionar, y sin el la embestida se siente injusta.
  if (e.isCharger && e.chargeTimer > 0 && e.chargeTimer < 34) {
    const k = 1 - e.chargeTimer / 34;
    a.dx = k * 12;
    a.escalaX = 1 - k * .18;
    a.escalaY = 1 + k * .16;
    return a;
  }

  // JEFE: se agacha durante el aviso y se tambalea aturdido.
  if (e.jefe) {
    const j = e.jefe;
    if (j.estado === 'aviso') {
      const k = 1 - j.t / j.max;
      a.dx = -k * 10; a.escalaX = 1 - k * .15; a.escalaY = 1 + k * .12;
      return a;
    }
    if (j.estado === 'aturdido') { a.giro = Math.sin(frame * .5) * .08; return a; }
  }

  // ATAQUE a distancia: se hincha justo antes de disparar.
  if (e.shootTimer > 0 && e.shootTimer < 18) {
    const k = 1 - e.shootTimer / 18;
    a.escalaX = 1 + k * .22;
    a.escalaY = 1 + k * .12;
    return a;
  }

  // GOLPEADO: retrocede y se comprime.
  if (e.flashTimer > 0) {
    const k = e.flashTimer / 10;
    a.escalaX = 1 + k * .2;
    a.escalaY = 1 - k * .16;
    a.dx = k * 5;
    return a;
  }

  // REPOSO: respiracion y balanceo. Cada familia se mueve distinto para que se
  // distingan de un vistazo aunque compartan bitmap.
  if (e.isFlyer) {
    a.dy = Math.sin(t * 1.4) * 5;
    a.giro = Math.sin(t * 1.4) * .09;
  } else if (e.isMagmar) {
    a.escalaY = 1 + Math.sin(t * .8) * .07;   // late como una masa
    a.escalaX = 1 - Math.sin(t * .8) * .05;
  } else if (e.isBoss) {
    a.escalaY = 1 + Math.sin(t * .5) * .04;
    a.dy = Math.sin(t * .5) * 2;
  } else {
    a.escalaY = 1 + Math.sin(t) * .05;        // caminar: sube y baja
    a.dy = Math.abs(Math.sin(t)) * -3;
    a.giro = Math.sin(t * .5) * .05;
  }
  return a;
}

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
    // 'overlay' pinta tambien sobre los pixeles transparentes: sin este
    // recorte cada enemigo teñido llevaba un cuadrado de color detras.
    g.globalCompositeOperation = 'destination-in';
    g.globalAlpha = 1; g.drawImage(IMG_EL[key], 0, 0);
  });
}

// Un solo bitmap de enemigo servía para charger, exploder, ghost y flyer: el
// jugador no podía leer de un vistazo qué le venía encima. El color coincide
// con el de sus partículas de muerte, así que el tinte también predice el
// efecto. Boss y magmar ya tienen sprite propio y se dejan sin teñir.
// ── HOJAS DE ANIMACION (sprite sheets) ──
// El enemigo "normal" era un solo bitmap deformado por codigo para simular
// caminar/recibir daño/morir. goblin_normal.png (CC0, Goblin Corps de
// Moikmellah — ver CREDITOS.md) trae un ciclo de verdad: fila 0 = idle (col
// 0) + caminar (col 1-6), fila 1 = daño (col 1-2) + muerte/KO (col 6-7).
// Cada celda mide 32x64 pero el goblin solo ocupa la mitad inferior (es una
// hoja de estilo "RPG Maker"): por eso la escala se calcula contra la altura
// real del dibujo (idealAltoPx), no contra la celda entera.
const SHEETS = {
  goblin_normal: {
    fw: 32, fh: 64, idealAltoPx: 33, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  // Segundo enemigo con hoja de animacion (MV Platformer Skeleton, CC0 —
  // ver tools/generar_esqueleto_cc0.py). Va en NOCHE y TORMENTA junto al
  // goblin, para que esos dos biomas no sean el mismo enemigo repintado.
  esqueleto: {
    fw: 32, fh: 64, idealAltoPx: 45, altoObjetivo: 70,
    filaMov: 0, colMovIni: 0, nMov: 6,
    filaGolpe: 1, colGolpeIni: 0, nGolpe: 2,
    colMuerteIni: 2, nMuerte: 3,
  },
  // Dos variantes MAS del mismo pack Goblin Corps (mismo grid 32x64 y mismas
  // columnas que goblin_normal, solo cambia el bitmap fuente — ver
  // tools/generar_goblin_variantes_cc0.py). idealAltoPx se midio por
  // separado para cada una porque el sombrero/capucha cambia la altura real.
  goblin_samurai: {
    fw: 32, fh: 64, idealAltoPx: 34, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  goblin_mage: {
    fw: 32, fh: 64, idealAltoPx: 36, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  // Primer enemigo animado que NO es un humanoide reskineado: Big Mushroom
  // (Scratchio, CC0 — ver tools/generar_hongo_cc0.py). Rejilla propia 29x28,
  // mas chica que la del goblin/esqueleto (por eso fw/fh distintos), y con
  // solo 1 frame de daño (el pack no trae 2 como el goblin; sheetFrame() ya
  // soporta nGolpe=1 sin cambios).
  hongo: {
    fw: 29, fh: 28, idealAltoPx: 24, altoObjetivo: 70,
    filaMov: 0, colMovIni: 0, nMov: 6,
    filaGolpe: 1, colGolpeIni: 0, nGolpe: 1,
    colMuerteIni: 1, nMuerte: 6,
  },
  // Quinta y sexta variante del mismo pack Goblin Corps (mismo grid 32x64 y
  // mismas columnas que soldier/samurai/mage — ver
  // tools/generar_goblin_variantes2_cc0.py). peasant (tunica marron, sin
  // casco) va a AMANECER ROJO, que hasta esta tanda era el UNICO bioma con
  // un solo enemigo con hoja. assassin (traje azul-morado oscuro, capucha)
  // va a NOCHE junto al esqueleto: un goblin sigiloso vestido de oscuro para
  // acechar de noche.
  goblin_peasant: {
    fw: 32, fh: 64, idealAltoPx: 35, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  goblin_assassin: {
    fw: 32, fh: 64, idealAltoPx: 33, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  // Segundo enemigo no-humanoide, y primero con rejilla propia MUY chica
  // (Grotto Escape 2 - Lizzard, CC0 — ver tools/generar_lagarto_cc0.py). Va
  // a DESIERTO DORADO junto al goblin samurai. El pack no trae frames de
  // muerte: nMuerte=1 reusa el ultimo frame de "hurt" (el mas arqueado) como
  // pose de colapso, y se desvanece con el fade-out por alpha que ya aplica
  // animEnemigo() a todo enemigo con hoja durante e.muriendo.
  lagarto: {
    fw: 64, fh: 32, idealAltoPx: 17, altoObjetivo: 70,
    filaMov: 0, colMovIni: 0, nMov: 6,
    filaGolpe: 1, colGolpeIni: 0, nGolpe: 3,
    colMuerteIni: 3, nMuerte: 1,
  },
  // Septima y octava variante del mismo pack Goblin Corps (mismo grid 32x64
  // y mismas columnas que las 5 variantes previas — ver
  // tools/generar_goblin_variantes3_cc0.py). Van a SELVA ESMERALDA, que era
  // el bioma con menos variedad (solo goblin_normal + hongo): piel canela y
  // vincha/cresta en vez de casco metalico se lee como guerreros tribales de
  // la jungla, distinto de los reskins "uniformados" de los demas biomas.
  goblin_centurion: {
    fw: 32, fh: 64, idealAltoPx: 38, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  goblin_battlelord: {
    fw: 32, fh: 64, idealAltoPx: 35, altoObjetivo: 70,
    filaMov: 0, colMovIni: 1, nMov: 6,
    filaGolpe: 1, colGolpeIni: 1, nGolpe: 2,
    colMuerteIni: 6, nMuerte: 2,
  },
  // Tercer enemigo no-humanoide (Grotto Escape 2 - Snake, CC0, mismo pack que
  // el lagarto — ver tools/generar_serpiente_cc0.py). Va a DESIERTO DORADO
  // junto al goblin samurai y el lagarto (fauna de cañon rocoso). Rejilla
  // propia 27x20; igual que el lagarto, el pack no trae frames de muerte:
  // nMuerte=1 reusa el ultimo frame de "hurt" (el mas replegado) como pose
  // de colapso, y se desvanece con el fade-out por alpha de animEnemigo().
  serpiente: {
    fw: 27, fh: 20, idealAltoPx: 18, altoObjetivo: 70,
    filaMov: 0, colMovIni: 0, nMov: 4,
    filaGolpe: 1, colGolpeIni: 0, nGolpe: 3,
    colMuerteIni: 3, nMuerte: 1,
  },
  // Primer JEFE con silueta propia (GothicVania Church, ansimuz, CC0 — ver
  // tools/generar_angel_cc0.py). Celda mucho mas grande (122x117) que las
  // de arriba: no importa, drawSheet() escala la celda entera por el mismo
  // factor sin recortar, el tamaño en pantalla no cambia frame a frame
  // aunque el aleteo varie mucho de alto (alas plegadas vs bien abiertas).
  // El pack no trae daño/muerte propios: nMuerte=1 reusa el ultimo frame de
  // "attack" como pose de colapso (mismo patron que lagarto/serpiente).
  angel: {
    fw: 122, fh: 117, idealAltoPx: 85, altoObjetivo: 130,
    filaMov: 0, colMovIni: 0, nMov: 8,
    filaGolpe: 1, colGolpeIni: 0, nGolpe: 2,
    colMuerteIni: 2, nMuerte: 1,
  },
};
// Enemigo "normal" (el mas visto, sin afijo): antes SIEMPRE era el goblin;
// ahora varia por bioma para que la campaña completa no se sienta como el
// mismo enemigo repintado 15 veces. NOCHE(0) alterna esqueleto+goblin
// assassin; AMANECER(1) suma al goblin peasant; SELVA(2) suma al hongo y a
// los goblins centurion/battlelord (guerreros tribales); TORMENTA(3) suma
// ademas al goblin mago; DESIERTO(4) suma al goblin samurai, el lagarto y
// la serpiente (fauna de cañon rocoso).
const SHEET_POR_BIOMA = [
  ['goblin_normal', 'esqueleto', 'goblin_assassin'],              // 0 noche
  ['goblin_normal', 'goblin_peasant'],                            // 1 amanecer
  ['goblin_normal', 'hongo', 'goblin_centurion', 'goblin_battlelord'], // 2 selva
  ['goblin_normal', 'esqueleto', 'goblin_mage'],                  // 3 tormenta
  ['goblin_normal', 'goblin_samurai', 'lagarto', 'serpiente'],    // 4 desierto
];
function sheetNormalDeBioma() {
  const bi = nivel ? nivel.bioma : Math.floor((wave - 1) / 3) % BIOMES.length;
  const opciones = SHEET_POR_BIOMA[bi] || ['goblin_normal'];
  return opciones[Math.floor(Math.random() * opciones.length)];
}
function sheetFrame(e, s) {
  if (e.muriendo > 0) {
    const k = 1 - e.muriendo / 16;
    const i = Math.min(s.nMuerte - 1, Math.floor(k * s.nMuerte));
    return { fila: s.filaGolpe, col: s.colMuerteIni + i };
  }
  if (e.flashTimer > 0) {
    const i = Math.floor((10 - e.flashTimer) / 5) % s.nGolpe;
    return { fila: s.filaGolpe, col: s.colGolpeIni + i };
  }
  const i = Math.floor(frame / 6) % s.nMov;
  return { fila: s.filaMov, col: s.colMovIni + i };
}
// Dibuja en el sistema local ya trasladado a los pies del enemigo (origen en
// (0,0) = pies, igual que el resto de drawSpr en este bucle). El tamaño en
// pantalla depende de altoObjetivo, no de la caja de colision: la hoja
// conserva su proporcion 32:64 en vez de estirarse al hitbox.
function drawSheet(img, s, f) {
  if (!img || !img.naturalWidth) return;
  const escala = s.altoObjetivo / s.idealAltoPx;
  const dh = s.fh * escala, dw = s.fw * escala;
  cx.drawImage(img, f.col * s.fw, f.fila * s.fh, s.fw, s.fh, -dw / 2, -dh, dw, dh);
}

function enemyTint(e) {
  if (e.elite) return e.elite.color;
  if (e.tinte) return e.tinte;
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
// ── RESOLUCIÓN LÓGICA ──
// 800x320 es una tira de 2.5:1. En un móvil vertical el canvas se ajusta al
// ancho, así que en una pantalla de 375x812 el juego quedaba en 375x150: el
// 19% del alto, con la mitad de la pantalla vacía y los sprites diminutos.
// En vertical usamos un lienzo más cuadrado: al escalar al mismo ancho, todo
// se dibuja un 33% más grande y el juego ocupa el doble de pantalla.
const _esVertical = window.innerHeight > window.innerWidth * 1.15;
const W = _esVertical ? 520 : 800;
const H = _esVertical ? 400 : 320;
const GY = H - 80;
// Línea de suelo real: es donde draw() pinta el borde y donde apoyan los pies
// del jugador (PL.y = GY, PL.h = 68). Todo lo que "esté en el suelo" usa esto.
const GROUND = GY + 68;
cv.width = W; cv.height = H;
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
const DASH_SPEED = 14, DASH_DUR = 14;
// El dash daba 18 frames de invulnerabilidad cada 45: un 40%% del tiempo eras
// intocable, asi que la estrategia optima era no pelear nunca. Medido con un
// jugador automatico, esquivar sin atacar sobrevivia 300 s y luchar 84 s.
// Con 62 de recarga la invulnerabilidad baja al 29%% y el dash sigue siendo la
// herramienta de habilidad, pero deja de ser un escudo permanente.
const DASH_CD = 62;
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
// Campaña: nivel = null es SIN FIN. Ver LEVELS mas abajo.
let nivel = null, ultimoInicio = null;
let sellos = 0, sellosPuestos = 0, victoriaEn = 0, jefeInvocado = false, jefeOleada = 0;
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
// Eje analogico del pad tactil de 3 zonas: -1..1 (0 parado, ±.5 andar, ±1 correr).
let mAxis = 0;
function setMove(v) { mAxis = v; }

// ── XP / LEVEL ──
let playerXP = 0, playerLevel = 1;
const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
function getXPNeeded(lvl) { return XP_PER_LEVEL[Math.min(lvl, XP_PER_LEVEL.length - 1)] || 4000 + (lvl - 10) * 600; }
let runXP = 0;   // XP ganado en la partida actual, para enseñarlo al morir

// ══ MEJORAS DE PARTIDA ══
// El hueco mas grande frente a los juegos del genero (Vampire Survivors,
// Brotato, Archero) era que aqui NO se construia nada dentro de la partida:
// subir de nivel aplicaba bonus fijos y el XP era progresion permanente, asi
// que la partida 40 se jugaba igual que la 4. Ahora, cada pocos niveles DE
// PARTIDA se ofrecen 3 mejoras al azar que se acumulan y duran solo esa
// partida. Ahi es donde nacen las decisiones y la variedad entre partidas.
let mej = null;
function mejorasBase() {
  return { dano: 1, vidaPorMuerte: 0, cadencia: 1, alcance: 1, velocidad: 1,
           monedas: 1, iman: 0, espinas: 0, dashRapido: 1, critico: 0, curaCombo: 0 };
}

const MEJORAS = [
  { id: 'filo',    icono: '⚔',  nombre: 'FILO AFILADO',  desc: '+35% de dano',            usar: () => { mej.dano += .35; } },
  { id: 'sed',     icono: '🩸', nombre: 'SED DE SANGRE', desc: '+3 vida por muerte',      usar: () => { mej.vidaPorMuerte += 3; } },
  { id: 'furia',   icono: '⚡', nombre: 'FURIA',         desc: '+25% de cadencia',        usar: () => { mej.cadencia += .25; } },
  { id: 'guadana', icono: '🌙', nombre: 'GUADANA',       desc: '+30% de alcance',         usar: () => { mej.alcance += .30; } },
  { id: 'botas',   icono: '👟', nombre: 'BOTAS VELOCES', desc: '+20% de velocidad',       usar: () => { mej.velocidad += .20; } },
  { id: 'corazon', icono: '❤', nombre: 'CORAZON',       desc: '+40 vida maxima y cura',  usar: () => { PL.maxHp += 40; PL.hp = Math.min(PL.maxHp, PL.hp + 40); updateHpHUD(); } },
  { id: 'iman',    icono: '🧲', nombre: 'IMAN',          desc: 'Atrae monedas de lejos',  usar: () => { mej.iman += 1; } },
  { id: 'espinas', icono: '🌵', nombre: 'ESPINAS',       desc: 'Danas a quien te toca',   usar: () => { mej.espinas += 2; } },
  { id: 'critico', icono: '💥', nombre: 'GOLPE CRITICO', desc: '+20% de critico (x2)',    usar: () => { mej.critico += .20; } },
  { id: 'avaro',   icono: '🪙', nombre: 'AVARICIA',      desc: '+50% de monedas',         usar: () => { mej.monedas += .50; } },
  { id: 'sombra',  icono: '💨', nombre: 'SOMBRA',        desc: 'Dash mucho mas rapido',   usar: () => { mej.dashRapido *= .6; } },
  { id: 'sanador', icono: '✨', nombre: 'SEGUNDO ALIENTO', desc: 'Combo x5 te cura 12',   usar: () => { mej.curaCombo += 12; } },
];

let mejorasElegidas = [];
let runLevel = 1, runXPAcc = 0;
function runXPNecesario(l) { return 55 + (l - 1) * 42; }
function addXP(amt) {
  playerXP += amt;
  runXP += amt;
  runXPAcc += amt;
  while (state === 'playing' && runXPAcc >= runXPNecesario(runLevel)) {
    runXPAcc -= runXPNecesario(runLevel);
    runLevel++;
    ofrecerMejoras();
  }
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
  _hW('xp-fill', (Math.round(pct * 10) / 10) + '%');
  _hTxt('level-badge', 'LVL ' + playerLevel);
  _hTxt('h-level', playerLevel);
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
let audioCtx = null, masterGain = null;

// Tres problemas reales del audio, arreglados aqui:
//  1. Cada sonido se conectaba DIRECTO a destination, sin control de volumen
//     ni compresor: en oleadas densas, diez efectos a la vez saturaban.
//  2. No habia ni un solo resume(): en el WebView de iOS y de Telegram el
//     contexto nace suspendido y el juego se quedaba mudo para siempre.
//  3. Varias ramas creaban un oscilador que luego no usaban (fuga silenciosa).
function getAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 8;
    comp.attack.value = .003; comp.release.value = .12;
    masterGain = audioCtx.createGain();
    masterGain.gain.value = .85;
    masterGain.connect(comp); comp.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
// El navegador solo permite arrancar el audio dentro de un gesto del usuario.
['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, () => { try { getAudio(); } catch (e) {} }, { once: false, passive: true }));

// ── EFECTOS GRABADOS ──
// Sustituyen a los bips de oscilador en los eventos que mas se repiten. Son 9
// archivos CC0 del pack retro de Juhani Junkala (dominio publico), convertidos
// a ogg mono de 22 kHz: 37 KB los nueve juntos. Si alguno no carga, el motor
// sigue usando la sintesis de siempre, asi que nunca se queda sin sonido.
const SFX_ARCHIVOS = {
  corte: 'corte', corte2: 'corte2', golpe: 'golpe', muerte: 'muerte',
  explosion: 'explosion', moneda: 'moneda', salto: 'salto', caida: 'caida', boton: 'boton',
};
// Pool fijo de 4 <audio> por efecto, en rotacion. Antes cada reproduccion
// hacia cloneNode(): mas de mil elementos <audio> por partida, y en iOS hay un
// tope de decodificadores de audio — al pasarlo el juego se queda mudo sin
// ningun error. Cuatro bastan para solapar el mismo efecto sin cortarlo.
const SFX = {};
Object.entries(SFX_ARCHIVOS).forEach(([k, f]) => {
  const src = (DQE.audioBase || 'audio/') + 'sfx/' + f + '.ogg';
  const pool = [];
  for (let i = 0; i < 4; i++) {
    const a = new Audio(src);
    a.preload = 'auto'; a.volume = .55;
    pool.push(a);
  }
  SFX[k] = { pool, idx: 0 };
});
function reproducir(clave, volumen) {
  const s = SFX[clave];
  if (!s) return false;
  const a = s.pool[s.idx];
  if (!a.duration && a.readyState < 2) return false;
  s.idx = (s.idx + 1) % s.pool.length;
  try {
    a.currentTime = 0;
    a.volume = Math.max(0, Math.min(1, volumen === undefined ? .55 : volumen));
    a.play().catch(() => {});
    return true;
  } catch (e) { return false; }
}
// Mapa de evento -> efecto grabado. Lo que no este aqui usa la sintesis.
const SFX_POR_EVENTO = {
  slash: 'corte', attack: 'corte2', hit: 'golpe', crunch: 'muerte',
  coin: 'moneda', jump: 'salto', land: 'caida', die: 'explosion',
};
function playSound(type, power) {
  const grabado = SFX_POR_EVENTO[type];
  if (grabado) {
    // El corte alterna entre dos muestras para que machacar el boton no suene
    // a repeticion mecanica.
    const clave = (type === 'slash' && frame % 2) ? 'corte2' : grabado;
    const vol = type === 'land' ? Math.min(.6, .18 + (power || 0) * .03) : undefined;
    if (reproducir(clave, vol)) return;
  }
  return _playSoundSintetico(type, power);
}
function _playSoundSintetico(type, power) {
  try {
    const ac = getAudio();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(masterGain || ac.destination);
    const now = ac.currentTime;
    if (type === 'jump') { o.frequency.setValueAtTime(220, now); o.frequency.exponentialRampToValueAtTime(440, now + .1); g.gain.setValueAtTime(.15, now); g.gain.exponentialRampToValueAtTime(.001, now + .15); o.start(now); o.stop(now + .15); }
    else if (type === 'attack') { o.type = 'sawtooth'; o.frequency.setValueAtTime(180, now); o.frequency.exponentialRampToValueAtTime(80, now + .08); g.gain.setValueAtTime(.2, now); g.gain.exponentialRampToValueAtTime(.001, now + .1); o.start(now); o.stop(now + .1); }
    else if (type === 'hit') { o.type = 'square'; o.frequency.setValueAtTime(120, now); g.gain.setValueAtTime(.25, now); g.gain.exponentialRampToValueAtTime(.001, now + .12); o.start(now); o.stop(now + .12); }
    else if (type === 'coin') { o.frequency.setValueAtTime(660, now); o.frequency.exponentialRampToValueAtTime(880, now + .06); g.gain.setValueAtTime(.1, now); g.gain.exponentialRampToValueAtTime(.001, now + .1); o.start(now); o.stop(now + .1); }
    else if (type === 'dash') { o.type = 'triangle'; o.frequency.setValueAtTime(300, now); o.frequency.exponentialRampToValueAtTime(600, now + .12); g.gain.setValueAtTime(.15, now); g.gain.exponentialRampToValueAtTime(.001, now + .15); o.start(now); o.stop(now + .15); }
    else if (type === 'levelup') { [261, 329, 392, 523].forEach((f, i) => { const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.connect(g2); g2.connect(masterGain || ac.destination); o2.frequency.value = f; g2.gain.setValueAtTime(.12, now + i * .08); g2.gain.exponentialRampToValueAtTime(.001, now + i * .08 + .15); o2.start(now + i * .08); o2.stop(now + i * .08 + .15); }); return; }
    else if (type === 'boss') { o.type = 'sawtooth'; o.frequency.setValueAtTime(60, now); g.gain.setValueAtTime(.3, now); g.gain.exponentialRampToValueAtTime(.001, now + .4); o.start(now); o.stop(now + .4); }
    else if (type === 'die') { o.type = 'sawtooth'; o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(30, now + .5); g.gain.setValueAtTime(.3, now); g.gain.exponentialRampToValueAtTime(.001, now + .5); o.start(now); o.stop(now + .5); }
    else if (type === 'powerup') { // arpegio ascendente brillante
      [523, 659, 784, 1047].forEach((f, i) => { const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.type = 'triangle'; o2.connect(g2); g2.connect(masterGain || ac.destination); o2.frequency.value = f; g2.gain.setValueAtTime(.13, now + i * .05); g2.gain.exponentialRampToValueAtTime(.001, now + i * .05 + .18); o2.start(now + i * .05); o2.stop(now + i * .05 + .18); }); return; }
    else if (type === 'achievement') { // fanfarria de logro
      [659, 784, 988, 1319].forEach((f, i) => { const o2 = ac.createOscillator(), g2 = ac.createGain(); o2.type = 'square'; o2.connect(g2); g2.connect(masterGain || ac.destination); o2.frequency.value = f; g2.gain.setValueAtTime(.1, now + i * .1); g2.gain.exponentialRampToValueAtTime(.001, now + i * .1 + .25); o2.start(now + i * .1); o2.stop(now + i * .1 + .25); }); return; }
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

// ── PLATAFORMAS ──
// La amenaza venia toda por un solo eje y el suelo era una linea, asi que el
// salto, el doble salto y el slam apenas tenian razon de ser: no habia nada
// arriba que alcanzar. Con plataformas hay una segunda altura donde caen
// monedas y desde donde se cae en picado sobre los enemigos.
let plataformas = [];
// Los enemigos muertos siguen unos frames en pantalla reproduciendo su
// animacion de muerte antes de desaparecer.
let cadaveres = [];

function initPlataformas() {
  plataformas = [];
  const alturas = [GROUND - 118, GROUND - 76, GROUND - 150];
  for (let i = 0; i < 3; i++) {
    plataformas.push({
      x: 180 + i * (W / 2.2),
      y: alturas[i % alturas.length],
      w: 96 + Math.random() * 54,
      h: 12,
    });
  }
}

function reciclarPlataforma(pl) {
  pl.x = W + 40 + Math.random() * 160;
  pl.y = GROUND - (70 + Math.random() * 90);
  pl.w = 90 + Math.random() * 60;
  // Premio por subir: casi siempre hay algo que recoger arriba.
  // Sello de campaña (la 3ª estrella): solo arriba de una plataforma. Si se
  // escapa sin recogerlo, vuelve a salir en otra, asi siempre se puede lograr.
  if (pl.sello) { pl.sello = false; sellosPuestos--; }
  if (nivel && sellos + sellosPuestos < 3 && frame > 360 * (sellos + sellosPuestos)) { pl.sello = true; sellosPuestos++; }
  else if (Math.random() < .75) spawnCoin(pl.x + pl.w / 2, pl.y - 34);
  if (Math.random() < .10) spawnChest(pl.x + pl.w / 2, pl.y - 40, 'comun');
}
let bgStars = [], bgMtns = [], bgClouds = [];
let groundX = 0;
// ══ ARMAS ══
// weaponBuff ponia el cartel "+COMBO RANGE!" y no cambiaba nada del juego. Ahora
// cada arma cambia alcance, cadencia, daño y empuje, y dura hasta que coges
// otra: es una decision de build, no un temporizador.
const ARMAS = {
  base:   { id: 'base',   nombre: 'KATANA', alcance: 1,   cd: 1,   dano: 1,   empuje: 1,   alto: 1,   color: null },
  odachi: { id: 'odachi', nombre: 'ODACHI', alcance: 1.5, cd: 1.4, dano: 1.7, empuje: 1.4, alto: 1.5, color: 'rgba(255,255,255,.8)', icono: 'katana_comun', desc: 'lenta, enorme alcance' },
  chispa: { id: 'chispa', nombre: 'CHISPA', alcance: 1,   cd: 1,   dano: 1,   empuje: .8,  alto: 1,   color: 'rgba(0,238,255,.8)', icono: 'katana_spark', desc: 'el rayo salta a otro enemigo' },
  // dano .6 no bajaba nada en la practica: el danio por golpe de combo (1,2,3
  // antes de multiplicar) se redondea con Math.ceil y nunca baja de 1, asi que
  // .6 solo recortaba el 3er golpe (3->2). Con su cd .5 (el doble de rapida),
  // el ciclo de 3 golpes daba 5 danio en 32 frames = 9,4 danio/s: mas que la
  // KATANA (6 en 63f = 5,7/s) y mas que el ODACHI (12 en 88f = 8,2/s), el arma
  // pensada como "rapida pero floja" era la de mas danio bruto del juego. Con
  // .3 el mismo redondeo da 1+1+1=3 danio en 32f = 5,6 danio/s: sigue siendo
  // la mas rapida (mejor para el combo x2 y para encadenar critico/curaCombo)
  // pero ya no le gana en danio a las armas pensadas para pegar fuerte.
  dagas:  { id: 'dagas',  nombre: 'DAGAS',  alcance: .8,  cd: .5,  dano: .3,  empuje: .6,  alto: .9,  color: 'rgba(192,132,252,.8)', icono: 'katana_comun', tinte: '#c084fc', desc: 'rapidisimas, doble combo' },
};
let arma = ARMAS.base;
function alcanceGolpe() { return Math.round([50, 60, 80][PL.comboStep] * mej.alcance * arma.alcance); }
// Efecto propio al conectar un golpe.
function efectoArma(e, dmg) {
  if (arma.id === 'dagas') { comboCount++; if (comboCount > comboMax) comboMax = comboCount; }
  if (arma.id === 'chispa') {
    const cx0 = e.x + e.w / 2, cy0 = e.y + e.h / 2;
    let otro = null, mejor = 150;
    for (const o of enemies) {
      if (o === e || o.hp <= 0 || o.muriendo) continue;
      const d = Math.hypot(o.x + o.w / 2 - cx0, o.y + o.h / 2 - cy0);
      if (d < mejor) { mejor = d; otro = o; }
    }
    if (otro) {
      otro.hp -= Math.max(1, Math.ceil(dmg * .5)); otro.flashTimer = 10;
      const ox = otro.x + otro.w / 2, oy = otro.y + otro.h / 2;
      for (let k = 1; k <= 4; k++) spawnPFX(cx0 + (ox - cx0) * k / 5, cy0 + (oy - cy0) * k / 5, '#00eeff', 2, 1.5, 3);
      lanzarFX('rayo', ox, oy, otro.h / 80, false, false, true);
    }
  }
}
// ── POWER-UPS temporales que caen del cielo ──
let powerups = [];               // drops en pantalla
let puMagnet = 0, puDouble = 0;  // timers activos (frames)
const PU_TYPES = {
  magnet: { emoji: '🧲', color: '#00eeff', rgb: '0,238,255', dur: 360, label: '🧲 IMÁN DE MONEDAS!' },
  double: { emoji: '✖️2', color: '#ffe600', rgb: '255,230,0', dur: 360, label: '✖️2 PUNTOS DOBLES!' },
  shield: { emoji: '🛡️', color: '#00ff88', rgb: '0,255,136', dur: 300, label: '🛡️ ESCUDO!' },
};
function spawnPowerup() {
  const keys = Object.keys(PU_TYPES);
  const type = keys[Math.floor(Math.random() * keys.length)];
  powerups.push({ x: W + 20, y: GY - 60 - Math.random() * 90, w: 34, h: 34, type, bob: Math.random() * Math.PI * 2, spd: gameSpeed * .55 });
}
// Efectos en pantalla. sigue=true: se dibuja pegado al jugador (el corte
// acompaña al duende si se mueve durante el golpe).
let efectos = [];
// Color de corte propio de cada skin de pago: es lo que se ve en cada golpe
// (y en cada captura que se comparte). La skin gratis conserva el azul.
const COLOR_CORTE = {
  skin_tactico: '#00ff88', skin_necromancer: '#b44cff', skin_king: '#ffd84a',
  skin_berserker: '#ff3344', skin_legendariafull: '#ff3cf0',
};
function lanzarFX(tipo, x, y, escala, flip, sigue, aditivo) {
  if (efectos.length > 40) efectos.shift();
  efectos.push({ tipo, x, y, escala, flip, sigue, aditivo, t: 0 });
}
let comboCount = 0, comboTimer = 0, comboMultiplier = 1, comboCap = 5;
// comboCount vuelve a 0 con cada golpe recibido, asi que al morir casi
// siempre valia 0: la pantalla final y el ranking recibian un dato falso.
let comboMax = 0;
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
// ══ ELITES ══
// Un mismo bestiario se vuelve variado si algunos enemigos llegan con un
// modificador visible. Cada afijo tine el sprite (tintedSprite ya cachea) y
// cambia un solo parametro, asi que se leen de un vistazo y no complican el
// motor. La probabilidad sube con la oleada hasta un techo.
const AFIJOS = [
  { id: 'blindado', nombre: 'BLINDADO', color: '#8899bb', hp: 2.6, vel: .75, xp: 2.2, monedas: 2 },
  { id: 'veloz',    nombre: 'VELOZ',    color: '#00eeff', hp: .7,  vel: 1.9,  xp: 1.6, monedas: 1 },
  { id: 'colosal',  nombre: 'COLOSAL',  color: '#ffcc00', hp: 3.4, vel: .6,  xp: 2.8, monedas: 3, escala: 1.45 },
  { id: 'furioso',  nombre: 'FURIOSO',  color: '#ff3344', hp: 1.4, vel: 1.35, xp: 2.0, monedas: 2 },
];

function probabilidadElite() {
  if (nivel) return nivel.elite;
  if (wave < 2) return 0;
  return Math.min(.28, .05 + (wave - 2) * .022);
}

function spawnEnemy(forceBoss = false) {
  // Antes: charger en la 2, flyer en la 3, boss en la 4, exploder en la 5,
  // ghost en la 6 y magmar en la 7. Medido con un jugador automatico, una
  // partida tipica muere en la oleada 2-3, asi que la mayoria de enemigos que
  // programaste NO LOS VEIA NADIE. Ahora todo el bestiario aparece dentro de
  // los dos primeros minutos.
  // El jefe ya no sale al azar (antes un 12% de cada spawn desde la oleada 3):
  // salia como un enemigo mas y dejaba de ser un evento.
  const isBoss = forceBoss;
  const ok = t => !nivel || nivel.pool.includes(t);
  const isFlyer = !isBoss && ok('flyer') && (nivel || wave >= 2) && Math.random() < .35;
  const isCharger = !isBoss && !isFlyer && ok('charger') && (nivel || wave >= 2) && Math.random() < .3;
  const isExploder = !isBoss && !isFlyer && !isCharger && ok('exploder') && (nivel || wave >= 3) && Math.random() < .2;
  const isGhost = !isBoss && !isFlyer && !isCharger && !isExploder && ok('ghost') && (nivel || wave >= 4) && Math.random() < .15;
  const isMagmar = !isBoss && !isFlyer && !isCharger && !isExploder && !isGhost && ok('magmar') && (nivel || wave >= 4) && Math.random() < .25;
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
    // Los normales van por DEBAJO del jugador (4 px/frame) para que se les
    // pueda alcanzar y uno decida cuando entrar; el charger sigue siendo la
    // amenaza rapida, pero avisa antes de embestir.
    // El jugador corre a 4 px/frame. Un enemigo normal NUNCA debe superarlo, o
    // desengancharse se vuelve imposible y la unica opcion es tragar el golpe.
    // El charger si es mas rapido: es la amenaza que obliga a saltar o hacer
    // dash, y por eso avisa 78 frames antes de embestir.
    spd: isCharger ? Math.min(6.4, gameSpeed * 1.25 + Math.random() * .4)
       : isBoss    ? Math.min(2.9, gameSpeed * .58)
       : isMagmar  ? Math.min(3.0, gameSpeed * .62)
       :             Math.min(3.5, gameSpeed * .78 + Math.random() * .3),
    type: isBoss ? 'boss' : isFlyer ? 'flyer' : isCharger ? 'charger' : isExploder ? 'exploder' : isGhost ? 'ghost' : isMagmar ? 'magmar' : 'normal',
    // El "normal" es el enemigo mas visto de largo (sin afijo, aparece desde
    // la oleada 1): es el que mas rentaba pasar de bitmap deformado a un
    // ciclo de animacion de verdad.
    sheet: (!isBoss && !isFlyer && !isCharger && !isExploder && !isGhost && !isMagmar) ? sheetNormalDeBioma() : null,
    isExploder, isGhost, ghostTimer: 0, ghostAlpha: 1,
    isFlyer, isBoss, isCharger, isMagmar,
    flashTimer: 0, bobTimer: Math.random() * Math.PI * 2,
    aparicion: 26, muriendo: 0,
    chargeTimer: isCharger ? 78 : 0,
    shootTimer: isBoss ? 120 : isMagmar ? 80 : 0,
    facing: -1, alive: true,
  });
  // Convertir en elite (nunca los jefes: ya son el evento de la oleada)
  const nuevo = enemies[enemies.length - 1];
  if (!isBoss && Math.random() < probabilidadElite()) {
    const a = AFIJOS[Math.floor(Math.random() * AFIJOS.length)];
    nuevo.elite = a;
    nuevo.hp = nuevo.maxHp = Math.ceil(nuevo.maxHp * a.hp);
    nuevo.spd = Math.min(nuevo.spd * a.vel, nuevo.isCharger ? 7.5 : 4.6);
    if (a.escala) { nuevo.w = Math.round(nuevo.w * a.escala); nuevo.h = Math.round(nuevo.h * a.escala); nuevo.y = GROUND - nuevo.h; }
  }
  if (isBoss) { bossActive = true; spawnFT(W / 2 - 60, 80, '★ BOSS FIGHT ★', '#ff00cc', true); _hap('heavy'); }
  if (isMagmar) spawnFT(W / 2 - 60, 80, '🔥 MAGMAR!', '#ff4400', true);
}
function spawnChest(x, y, tier = 'comun') { chests.push({ x, y, w: 38, h: 38, spd: gameSpeed * .4, tier, bob: Math.random() * Math.PI * 2, glowTimer: 0 }); }
function spawnWeaponDrop(x, y) {
  const tipos = ['odachi', 'chispa', 'dagas'].filter(t => t !== arma.id);
  const type = tipos[Math.floor(Math.random() * tipos.length)];
  weaponDrops.push({ x, y, w: 44, h: 24, spd: gameSpeed * .5, type, bob: Math.random() * Math.PI * 2 });
}
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
  // Aerial slam: web requiere C/↓. En móvil CUALQUIER ataque aéreo cayendo era
  // slam (y el slam atraviesa las plataformas a propósito): atacar a un flyer
  // te tiraba al suelo sin querer. Se exige caer con velocidad de verdad
  // (vy > 5), que es cuando el slam se siente intencional.
  const slamKey = DQE.airSlamNeedsKey === false ? PL.vy > 5 : (keys['KeyC'] || keys['ArrowDown']);
  if (!PL.onGround && PL.vy >= 0 && slamKey) {
    PL.slamming = true; PL.slamTimer = 20; PL.vy = 12; PL.slamY0 = PL.y;
    spawnFT(PL.x, PL.y - 15, 'SLAM!', '#ff6400', true);
    return;
  }
  if (PL.comboTimer > 0) PL.comboStep = (PL.comboStep + 1) % 3; else PL.comboStep = 0;
  PL.swingId = (PL.swingId || 0) + 1;   // identifica este swing para el multi-golpe
  PL.comboTimer = COMBO_WINDOW;
  PL.attackTimer = 14 + PL.comboStep * 2;
  PL.attackCd = Math.round((18 + PL.comboStep * 3) * arma.cd / mej.cadencia);
  // i-frames al atacar: la ventana activa del golpe te hace intocable un
  // instante. Sin esto, acercarse a pegar era SIEMPRE peor que huir, y las
  // pruebas lo confirmaron: esquivar sin atacar sobrevivia 190 s de media y
  // luchar solo 56 s. El juego castigaba su propio verbo principal.
  PL.invTimer = Math.max(PL.invTimer, 10);
  const reach = alcanceGolpe();
  const yOff = [10, 5, -5][PL.comboStep];
  const alto = (PL.h - yOff * 1.5) * arma.alto;
  PL.attackHitbox = { x: PL.x + (PL.facing > 0 ? PL.w : -reach), y: PL.y + yOff - (alto - (PL.h - yOff * 1.5)) / 2, w: reach, h: alto, active: true };
  const colors = ['#ffe600', '#ff9900', '#ff3333'];
  spawnPFX(PL.attackHitbox.x + reach / 2, PL.y + PL.h / 2, colors[PL.comboStep], 6 + PL.comboStep * 4, 4 + PL.comboStep * 2);
  const tipoCorte = ['corte_h', 'corte_arriba', 'corte_giro'][PL.comboStep];
  lanzarFX(tipoCorte, PL.facing > 0 ? PL.w + reach * .35 : -reach * .35, PL.h * .5, reach / 34, PL.facing < 0, true, true);
  efectos[efectos.length - 1].tinte = COLOR_CORTE[_playerKey()] || null;
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
  const jefes = enemies.filter(e => e.jefe && e.hp > 8);
  jefes.forEach(e => { e.hp -= 8; e.flashTimer = 12; spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#00eeff', 20, 7); });
  enemies.filter(e => !jefes.includes(e)).forEach(e => {
    const pts = (e.isBoss ? 300 : e.isMagmar ? 150 : e.type === 'charger' ? 80 : 60) * comboMultiplier;
    addScore(pts);
    spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#00eeff', 20, 7);
    spawnFT(e.x, e.y - 10, '+' + Math.floor(pts), '#00eeff');
    matarEnemigo(e);
  });
  enemies = jefes;
  bossActive = jefes.length > 0;
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
// addScore se llama cada frame, asi que guardar en localStorage aqui suponia
// 60 escrituras sincronas a disco por segundo justo en la partida buena (unas
// 18.000 en una de 5 minutos). El record se persiste al morir y en el
// autoguardado periodico, que es donde toca.
function addScore(pts) { score += pts; if (score > hiScore) hiScore = score; }
function hitCombo(pts) {
  comboCount++;
  if (comboCount > comboMax) comboMax = comboCount;
  comboTimer = COMBO_WINDOW;
  // El tope venía fijo a 5, lo que pisaba el bonus de combo de subir de nivel.
  comboMultiplier = Math.min(1 + Math.floor(comboCount / 3) * .5, comboCap);
  if (mej && mej.curaCombo > 0 && comboCount > 0 && comboCount % 15 === 0 && PL.hp < PL.maxHp) {
    PL.hp = Math.min(PL.maxHp, PL.hp + mej.curaCombo);
    updateHpHUD();
    spawnFT(PL.x + PL.w / 2, PL.y - 40, '+' + mej.curaCombo + ' COMBO', '#00ff88', true);
  }
  achEvent('onCombo', comboMultiplier);
  const total = Math.floor(pts * comboMultiplier);
  addScore(total);
  return total;
}
function missionEvent(type, val) { try { window.DQMissions && DQMissions.event(type, val); } catch (e) {} }
function achEvent(fn, val) { try { window.DQAch && DQAch[fn] && DQAch[fn](val); } catch (e) {} }

// ── HUD ──
// El HUD hacia ~19 getElementById y ~30 escrituras de estilo POR FRAME (unas
// 1.140 busquedas por segundo). Los nodos se cachean la primera vez y solo se
// escribe cuando el valor cambia. La barra de vida usa tres clases CSS
// (.hp-ok/.hp-mid/.hp-low) en vez de reasignar un linear-gradient cada frame:
// esa reasignacion reiniciaba su transition 60 veces por segundo y la barra
// iba siempre 150 ms por detras del golpe.
const _hud = { el: {}, ult: {} };
function _hEl(id) {
  if (!(id in _hud.el)) _hud.el[id] = document.getElementById(id);
  return _hud.el[id];
}
function _hTxt(id, val) {
  if (_hud.ult['t' + id] === val) return;
  _hud.ult['t' + id] = val;
  const el = _hEl(id); if (el) el.textContent = val;
}
function _hW(id, val) {
  if (_hud.ult['w' + id] === val) return;
  _hud.ult['w' + id] = val;
  const el = _hEl(id); if (el) el.style.width = val;
}
function updateItemHUD(i) {
  const it = PL.items[i];
  _hTxt('ic' + i, it[0]);
  const estado = it[1] > 0 ? 'cd' : it[0] > 0 ? 'ready' : 'off';
  if (_hud.ult['sl' + i] !== estado) {
    _hud.ult['sl' + i] = estado;
    const sl = _hEl('sl' + i);
    if (sl) { sl.classList.toggle('on-cd', estado === 'cd'); sl.classList.toggle('ready', estado === 'ready'); }
  }
}
function updateHpHUD() {
  const pct = Math.max(0, PL.hp / PL.maxHp);
  _hW('hp-fill', (Math.round(pct * 1000) / 10) + '%');
  const clase = pct > .5 ? 'hp-ok' : pct > .25 ? 'hp-mid' : 'hp-low';
  if (_hud.ult.hpClase !== clase) {
    _hud.ult.hpClase = clase;
    const f = _hEl('hp-fill');
    if (f) { f.classList.remove('hp-ok', 'hp-mid', 'hp-low'); f.classList.add(clase); }
  }
}
function updateHUD() {
  _hTxt('h-score', Math.floor(score).toLocaleString());
  _hTxt('h-hi', Math.floor(hiScore).toLocaleString());
  _hTxt('h-wave', wave);
  _hTxt('h-coins', sessionCoins);
  _hW('combo-fill', Math.round(comboTimer / COMBO_WINDOW * 100) + '%');
  _hTxt('h-combo-x', comboCount > 1 ? 'x' + comboMultiplier : '');
  for (let i = 0; i < 4; i++) {
    const it = PL.items[i];
    _hW('cb' + i, Math.round((it[2] > 0 ? it[1] / it[2] : 0) * 100) + '%');
  }
}
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ══ JEFES CON ATAQUES TELEGRAFIADOS ══
// El jefe era un enemigo grande con 8 de vida que se acercaba y disparaba una
// bala recta: moria en 4 golpes y no pedia nada distinto. Ahora es una
// maquina de estados con ataques que AVISAN 45-60 frames antes (el novato
// reacciona en ~26) y una ventana de aturdimiento para castigarle.
const JEFES = {
  oso: {
    nombre: 'OSO REY', hp: 70, w: 110, h: 100, fase2: .5,
    ataques: ['embestida', 'salto'], ataquesF2: ['embestida', 'salto', 'rocas'],
    aviso: { embestida: 50, salto: 45, rocas: 60 }, pausa: [70, 45],
  },
  // Jefe final de la campaña (solo etapa 5-3, ver LEVELS): primer jefe con
  // silueta propia en vez del oso reciclado — ver tools/generar_angel_cc0.py.
  // Su ataques/ataquesF2/pausa/vel reales los pisa ESTILO_JEFE[4] igual que
  // al oso (Object.assign en spawnJefe corre ESTILO_JEFE despues), asi que
  // lo que de verdad importa de esta entrada es hp/w/h/fase2/aviso.
  angel: {
    nombre: 'ÁNGEL CAÍDO', hp: 140, w: 130, h: 150, fase2: .5,
    ataques: ['salto', 'rocas'], ataquesF2: ['salto', 'rocas', 'embestida'],
    aviso: { embestida: 50, salto: 50, rocas: 55 }, pausa: [65, 42],
  },
};
// Un nombre por bioma, en el orden del array BIOMES. Lo pisa el 4to
// parametro de spawnJefe cuando el nivel trae su propio nombre (asi el
// jefe final de la campaña, un angel, no sale llamado "FARAON DORADO" solo
// por vivir en el bioma DESIERTO DORADO — pero el oso reciclado que SIN FIN
// sigue mandando a ese mismo bioma cada 15 waves si conserva ese nombre).
const NOMBRES_JEFE = ['OSO REY', 'SEÑOR DEL ALBA', 'TITAN ESMERALDA', 'REY TORMENTA', 'FARAON DORADO'];
// Cada bioma cambia el REPERTORIO del jefe, no solo su vida: asi los cinco
// jefes se pelean distinto con el mismo sprite. 'doble' es una embestida de
// ida y vuelta: al chocar con la pared avisa otra vez (40 f) y regresa.
const ESTILO_JEFE = [
  {},
  { ataques: ['salto', 'rocas'], ataquesF2: ['salto', 'rocas', 'embestida'], rocas: 4 },
  { ataques: ['doble', 'salto'], ataquesF2: ['doble', 'salto', 'rocas'], vel: 10 },
  { ataques: ['rocas', 'embestida'], ataquesF2: ['rocas', 'doble', 'salto'], rocas: 5, pausa: [60, 40] },
  { ataques: ['doble', 'salto', 'rocas'], ataquesF2: ['doble', 'salto', 'rocas'], rocas: 5, vel: 10.5, pausa: [55, 38] },
];

function spawnJefe(tipo, extraHp, bioma, nombreOverride) {
  const bi = bioma || 0;
  const def = Object.assign({}, JEFES[tipo] || JEFES.oso, ESTILO_JEFE[bi] || {});
  def.aviso = Object.assign({ doble: 50 }, def.aviso);
  const nombre = nombreOverride || NOMBRES_JEFE[bi] || def.nombre;
  const hp = def.hp + (extraHp || 0);
  // Jefes con silueta propia (hoja de animacion, SHEETS[tipo] existe) no
  // usan el tinte por bioma: ese tinte es para diferenciar el MISMO bitmap
  // de oso reciclado, y desentonaria pisando la paleta ya propia del sprite.
  const sheet = SHEETS[tipo] ? tipo : null;
  enemies.push({
    x: W + 20, y: GROUND - def.h, w: def.w, h: def.h,
    hp, maxHp: hp, spd: 0, type: 'boss', isBoss: true,
    isExploder: false, isGhost: false, isFlyer: false, isCharger: false, isMagmar: false,
    ghostTimer: 0, ghostAlpha: 1, flashTimer: 0, bobTimer: 0,
    aparicion: 26, muriendo: 0, chargeTimer: 0, shootTimer: 0, facing: -1, alive: true,
    sheet, tinte: (bi && !sheet) ? BIOMES[bi].line : null,
    jefe: { def, nombre, estado: 'entrada', t: 60, max: 60, fase: 1, ataque: null, objX: 0, dir: -1, huecos: [], ultimo: null },
  });
  bossActive = true;
  spawnFT(W / 2, 80, '★ ' + nombre + ' ★', '#ff00cc', true);
  showPUNotif('☠ ¡JEFE! Esquiva cuando veas el rojo');
  shake(10); _hap('heavy');
}

function _jefeElegirAtaque(j) {
  const lista = j.fase === 2 ? j.def.ataquesF2 : j.def.ataques;
  let op = lista.filter(a => a !== j.ultimo);
  if (!op.length) op = lista;
  return op[Math.floor(Math.random() * op.length)];
}

function actualizarJefe(e) {
  const j = e.jefe;
  j.t--;
  if (j.fase === 1 && e.hp < e.maxHp * j.def.fase2) {
    j.fase = 2;
    spawnFT(W / 2, 90, '¡FURIA!', '#ff3344', true);
    shake(12); freeze(8); _hap('heavy');
  }
  const centro = e.x + e.w / 2;
  if (j.estado === 'entrada') {
    e.x += (W * .72 - e.x) * .06;
    if (j.t <= 0) { j.estado = 'pausa'; j.t = j.def.pausa[0]; }
    return;
  }
  if (j.estado === 'pausa') {
    const dir = PL.x + PL.w / 2 > centro ? 1 : -1;
    e.facing = dir;
    e.x = Math.max(20, Math.min(W - e.w - 20, e.x + dir * .8));
    if (j.t <= 0) {
      j.ataque = _jefeElegirAtaque(j); j.ultimo = j.ataque; j.rebotado = false;
      j.estado = 'aviso';
      j.t = j.max = Math.max(40, j.def.aviso[j.ataque] - (j.fase === 2 ? 5 : 0));
      j.dir = dir;
      j.objX = Math.max(e.w / 2, Math.min(W - e.w / 2, PL.x + PL.w / 2));
      if (j.ataque === 'rocas') {
        // 4 columnas, nunca a menos de 120 px del jugador: siempre queda hueco.
        j.huecos = [];
        let intentos = 0;
        while (j.huecos.length < (j.def.rocas || 4) && intentos++ < 80) {
          const x = 20 + Math.random() * (W - 84);
          if (Math.abs(x + 22 - (PL.x + PL.w / 2)) < 120) continue;
          if (j.huecos.some(h => Math.abs(h - x) < 64)) continue;
          j.huecos.push(x);
        }
      }
      _hap('light');
    }
    return;
  }
  if (j.estado === 'aviso') {
    if (j.t <= 0) {
      j.estado = 'ejecuta';
      if (j.ataque === 'salto') { j.t = 40; j.x0 = e.x; }
      else if (j.ataque === 'rocas') {
        j.huecos.forEach(x => bullets.push({ x, y: -40, vx: 0, vy: 9, w: 44, h: 36, enemy: true, roca: true, dmg: 20, life: 1 }));
        j.t = 40;
      } else j.t = 200;
    }
    return;
  }
  if (j.estado === 'ejecuta') {
    if (j.ataque === 'embestida' || j.ataque === 'doble') {
      e.x += j.dir * (j.def.vel || 9);
      if (frame % 3 === 0) spawnPFX(centro, GROUND - 4, 'rgba(255,255,255,.5)', 2, 2, 3);
      if (e.x < 30 || e.x > W - e.w - 30 || j.t <= 0) {
        e.x = Math.max(30, Math.min(W - e.w - 30, e.x));
        shake(10); playSound('land', 14);
        if (j.ataque === 'doble' && !j.rebotado) {
          // Vuelta: nuevo aviso (mas corto, pero nunca menos de 40 f) y al otro lado.
          j.rebotado = true; j.dir = -j.dir; e.facing = j.dir;
          j.estado = 'aviso'; j.t = j.max = 40;
          return;
        }
        spawnFT(e.x + e.w / 2, e.y - 30, 'ATURDIDO', '#ffe600', true);
        j.estado = 'aturdido'; j.t = 55;
      }
    } else if (j.ataque === 'salto') {
      const k = 1 - j.t / 40;
      e.x = j.x0 + (j.objX - e.w / 2 - j.x0) * k;
      e.y = GROUND - e.h - Math.sin(k * Math.PI) * 170;
      if (j.t <= 0) {
        e.y = GROUND - e.h;
        shake(14); freeze(6); playSound('land', 16);
        particles.push({ x: e.x + e.w / 2, y: GROUND, vx: 0, vy: 0, color: '#ff3344', life: 1, decay: .06, sz: 90, ring: true });
        spawnPFX(e.x + e.w / 2, GROUND - 6, '#ffaa66', 24, 6, 5);
        if (PL.invTimer <= 0 && overlap({ x: e.x - 20, y: e.y, w: e.w + 40, h: e.h }, PL)) golpearJugador(30, 'APLASTADO');
        // Dos ondas por el suelo: encima de una plataforma no te tocan. Es la
        // primera razon de verdad para subir a ellas.
        bullets.push({ x: e.x - 26, y: GROUND - 18, vx: -6, vy: 0, w: 26, h: 18, enemy: true, onda: true, dmg: 18, life: 1 });
        bullets.push({ x: e.x + e.w, y: GROUND - 18, vx: 6, vy: 0, w: 26, h: 18, enemy: true, onda: true, dmg: 18, life: 1 });
        j.estado = 'aturdido'; j.t = 50;
      }
    } else if (j.t <= 0) { // rocas: el jefe no se mueve mientras caen
      j.estado = 'pausa'; j.t = j.def.pausa[j.fase - 1];
    }
    return;
  }
  if (j.estado === 'aturdido' && j.t <= 0) {
    j.estado = 'pausa'; j.t = j.def.pausa[j.fase - 1];
  }
}

// Daño al jugador desde una fuente con cantidad propia (jefe, ondas, rocas).
function golpearJugador(dmg, txt) {
  PL.hp -= dmg; PL.invTimer = 60; PL.flashTimer = 20;
  comboCount = 0; comboMultiplier = 1;
  shake(8); freeze(6);
  spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff3333', 14, 5);
  spawnFT(PL.x, PL.y - 20, '-' + dmg + (txt ? ' ' + txt : ' HP'), '#ff3333');
  updateHpHUD(); _hap('heavy');
  if (PL.hp <= 0) endGame();
}

// Avisos en el suelo, por debajo de los sprites. Sin shadowBlur: rectangulos
// y elipses con un parpadeo que se acelera en el ultimo 30% del aviso.
function dibujarAvisosJefe() {
  const e = enemies.find(x => x.jefe && x.jefe.estado === 'aviso');
  if (!e) return;
  const j = e.jefe;
  const k = 1 - j.t / j.max;
  const a = .16 + .26 * ((frame >> (k > .7 ? 1 : 3)) & 1);
  cx.save();
  cx.fillStyle = '#ff2244';
  cx.globalAlpha = a;
  if (j.ataque === 'embestida' || j.ataque === 'doble') {
    const x0 = j.dir > 0 ? e.x + e.w : 0;
    const x1 = j.dir > 0 ? W : e.x;
    cx.fillRect(x0, GROUND - e.h * .8, x1 - x0, e.h * .8);
  } else if (j.ataque === 'salto') {
    cx.beginPath(); cx.ellipse(j.objX, GROUND, e.w * .75, 12, 0, 0, Math.PI * 2); cx.fill();
    cx.fillRect(j.objX - 3, 0, 6, GROUND);
    cx.globalAlpha = a * .6;
    cx.fillRect(0, GROUND - 18, W, 18);   // las ondas barreran el suelo
  } else if (j.ataque === 'rocas') {
    j.huecos.forEach(x => cx.fillRect(x, 0, 44, GROUND));
  }
  cx.globalAlpha = 1;
  cx.font = '22px "Press Start 2P"'; cx.textAlign = 'center';
  cx.lineWidth = 4; cx.lineJoin = 'round'; cx.strokeStyle = '#000';
  cx.strokeText('!', e.x + e.w / 2, e.y - 22);
  cx.fillStyle = '#ffe600'; cx.fillText('!', e.x + e.w / 2, e.y - 22);
  cx.restore();
}

function dibujarBarraJefe() {
  const e = enemies.find(x => x.jefe && !x.muriendo);
  if (!e) return;
  const bw = Math.min(300, W - 80), bx = (W - bw) / 2, by = 34;
  cx.save();
  cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(bx - 2, by - 2, bw + 4, 12);
  cx.fillStyle = e.jefe.fase === 2 ? '#ff3344' : '#ff00cc';
  cx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 8);
  cx.font = '10px "Press Start 2P"'; cx.textAlign = 'center';
  cx.lineWidth = 3; cx.lineJoin = 'round'; cx.strokeStyle = '#000';
  cx.strokeText(e.jefe.nombre, W / 2, by + 24);
  cx.fillStyle = '#fff'; cx.fillText(e.jefe.nombre, W / 2, by + 24);
  cx.restore();
}

// Toda muerte de enemigo pasa por aqui, venga del melee, del slam o de una
// bala. Antes las balas (modo fuego, katana spark) tenian su propia copia
// recortada: no daban XP, no contaban el jefe en bossKilled, no aplicaban la
// vida por muerte y el enemigo desaparecia sin animacion de muerte.
function matarEnemigo(e) {
  killStreak++; killStreakTimer = 180;
  if (killStreak === 3) showPUNotif('🔥 3 KILLS - RACHA!');
  else if (killStreak === 5) { showPUNotif('☄️ 5 KILLS - IMPARABLE!'); shake(5); }
  else if (killStreak === 10) { showPUNotif('⚡ 10 KILLS - LEGENDARIO!'); shake(8); addXP(50); }
  if (e.elite) {
    spawnFT(e.x + e.w / 2, e.y - 40, e.elite.nombre + ' CAIDO', e.elite.color, true);
    addXP(Math.round(12 * e.elite.xp));
    for (let c = 0; c < e.elite.monedas; c++) spawnCoin(e.x + Math.random() * e.w, e.y);
    shake(7); freeze(6);
  }
  // Recompensa por luchar: cada muerte devuelve algo de vida si has
  // invertido en ello. Es lo que convierte el combate en una opcion viable
  // frente a huir, sin regalar nada a quien no elige esas mejoras.
  if (mej.vidaPorMuerte > 0 && PL.hp < PL.maxHp) {
    PL.hp = Math.min(PL.maxHp, PL.hp + mej.vidaPorMuerte);
    updateHpHUD();
    spawnFT(PL.x + PL.w / 2, PL.y - 26, '+' + mej.vidaPorMuerte, '#00ff88');
  }
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
  if (wave >= 2 && Math.random() < .07) spawnWeaponDrop(e.x + e.w / 2, e.y);
  shake(e.isBoss ? 10 : e.isMagmar ? 6 : 4);
  freeze(e.isBoss ? 10 : e.isMagmar ? 6 : 4);
  // El enemigo no desaparece de golpe: se queda 16 frames aplastandose
  // contra el suelo y desvaneciendose. Es lo que hace que matar se sienta.
  e.muriendo = 16; e.hp = 0; e.spd = 0;
  cadaveres.push(e);
  lanzarFX('muerte', e.x + e.w / 2, e.y + e.h / 2, e.h / 38, false, false, true);
  // 90 frames para ver caer monedas y cofre antes de la pantalla de victoria.
  if (e.jefe && nivel) {
    victoriaEn = 90; spawnFT(W / 2, 110, '¡ETAPA SUPERADA!', '#ffe600', true);
    // Ya ganaste: nada de lo que quede en pantalla puede matarte en los 90
    // frames de celebracion (antes un esbirro o una roca en vuelo daban GAME OVER).
    PL.invTimer = 9999;
    bullets = bullets.filter(b => !b.enemy);
  }
}

// ── UPDATE ──
function update() {
  if (frame % 300 === 0) saveProgress();
  frame++;
  // Mientras hay un jefe vivo la oleada no avanza: antes el descanso lo
  // borraba de la pantalla y el jefe se escapaba sin pelear.
  if (!bossActive) waveTimer++;
  const skinBuffs = _buffs();

  // Wave progression
  if (victoriaEn > 0 && --victoriaEn === 0) { ganarNivel(); return; }
  if (waveTimer % WAVE_FRAMES === 0 && waveTimer > 0 && !jefeInvocado) {
    wave++;
    if (nivel && wave > nivel.oleadas) {
      if (nivel.jefe) {
        jefeInvocado = true;
        spawnJefe(nivel.jefe.tipo, nivel.jefe.hp, nivel.bioma, nivel.jefe.tipo !== 'oso' ? JEFES[nivel.jefe.tipo].nombre : null);
        // Medido: el jugador llegaba al jefe con la mitad de la vida gastada en
        // la oleada previa y moria sin haber visto sus ataques. Un respiro antes.
        PL.hp = Math.min(PL.maxHp, PL.hp + 35); updateHpHUD();
        spawnFT(PL.x, PL.y - 30, '+35 HP', '#00ff88', true);
      } else { ganarNivel(); return; }
    } else {
    // La velocidad subia sin techo (+0,35 por oleada): en la oleada 10 los
    // enemigos iban a 7 px/frame y el jugador corre a 4. Ni se les alcanzaba
    // ni se les esquivaba, y encima cruzaban la pantalla tan rapido que habia
    // MENOS en pantalla. Ahora el techo es 6,2 y la dificultad la pone la
    // cantidad y los elites, no la velocidad pura.
    gameSpeed = Math.min(6.2, (nivel ? nivel.vel : baseSpeed) + wave * .28);
    spawnFT(W / 2 - 80, 70, '— WAVE ' + wave + ' —', '#ffe600', true);
    missionEvent('wave', wave);
    achEvent('onWave', wave);
    showPUNotif('🌊 WAVE ' + wave + ' — VELOCIDAD UP!');
    shake(6);
    // Cada 5 waves cambia el bioma: antes el mundo cambiaba de color y el
    // jugador ni se enteraba de que era un sistema.
    if (!nivel && (wave - 1) % 3 === 0) {
      const b = currentBiome();
      const bi = Math.floor((wave - 1) / 3) % BIOMES.length;
      markBiomeSeen(bi);
      spawnFT(W / 2, 108, '⟡ ' + b.name + ' ⟡', b.line, true);
      showPUNotif('⟡ Entras en ' + b.name);
      shake(9); freeze(4);
    }
    // La oleada era un tick: subia la velocidad y el jugador no dejaba de
    // correr nunca. En los juegos del genero la oleada CIERRA — cobras, eliges
    // y compras — y ese hueco es donde vive la decision. A partir de la 2 se
    // abre el descanso; la 1 no, para no cortar el arranque.
    if (wave >= 2) { abrirDescanso(); return; }
    }
  }
  if (!nivel && wave % 3 === 0 && jefeOleada !== wave) {
    jefeOleada = wave;
    spawnJefe('oso', (wave / 3 - 1) * 15, Math.floor((wave - 1) / 3) % BIOMES.length);
  }

  // ── PLAYER MOVEMENT ──
  let targetVx = 0;
  if ((keys['ArrowLeft'] || keys['KeyA'] || mLeft) && !PL.dashing) targetVx = -4;
  if ((keys['ArrowRight'] || keys['KeyD'] || mRight) && !PL.dashing) targetVx = 4;
  if (mAxis !== 0 && !PL.dashing) targetVx = 4 * mAxis;   // pad táctil: andar o correr
  if (targetVx !== 0) PL.facing = targetVx > 0 ? 1 : -1;
  PL.vx += (targetVx - PL.vx) * .25;

  if (PL.dashing) {
    PL.vx = PL.dashDir * DASH_SPEED;
    PL.dashTimer--;
    if (PL.dashTimer <= 0) { PL.dashing = false; PL.vx = PL.dashDir * 3; }
  }

  PL.x += PL.vx * (PL.dashing ? 1 : mej.velocidad);
  PL.x = Math.max(10, Math.min(W - PL.w - 10, PL.x)); // free movement across the whole map

  if (!PL.dashing) {
    PL.vy += GRAVITY;
    if (PL.vy > 18) PL.vy = 18;
  }
  PL.y += PL.vy;

  // Las plataformas se desplazan con el mundo y se reciclan por la derecha.
  // Las plataformas se movian a gameSpeed*.85 mientras el jugador corre a 4
  // px/frame. En la oleada 4 eso da 4,17 > 4,00: quedarse encima era
  // FISICAMENTE IMPOSIBLE por mucho que corrieras. Por eso los 50 jugadores
  // medidos pasaban un 5,2% del tiempo en plataformas, experto y pro exactamente
  // el mismo: no era una decision suya, era un techo del motor. Con el tope,
  // correr a la derecha siempre le gana a la plataforma.
  plataformas.forEach(pl => { pl.x -= Math.min(gameSpeed, 3.7) * .85; if (pl.x + pl.w < -20) reciclarPlataforma(pl); });

  const wasOnGround = PL.onGround;
  PL.onGround = false;

  // Colision con plataformas: solo se aterriza CAYENDO y desde arriba, para
  // poder atravesarlas saltando desde abajo. El slam las ignora a proposito:
  // cae en picado hasta el suelo y eso le da su razon de ser.
  if (PL.vy >= 0) {
    const piesAntes = PL.y + PL.h - PL.vy;
    for (const pl of plataformas) {
      const dentroX = PL.x + PL.w * .75 > pl.x && PL.x + PL.w * .25 < pl.x + pl.w;
      if (dentroX && piesAntes <= pl.y + 4 && PL.y + PL.h >= pl.y) {
        if (PL.vy > 3) {
          playSound('land', PL.vy);
          PL.squash = Math.min(.3, PL.vy * .02);
          spawnPFX(PL.x + PL.w / 2, pl.y, 'rgba(255,255,255,.5)', 5, 2.2, 3);
        }
        PL.y = pl.y - PL.h; PL.vy = 0; PL.onGround = true; PL.djUsed = false;
        if (pl.sello) {
          pl.sello = false; sellosPuestos--; sellos++;
          missionEvent('sello', 1);
          spawnFT(pl.x + pl.w / 2, pl.y - 30, '✦ SELLO ' + sellos + '/3', '#ffe600', true);
          spawnPFX(pl.x + pl.w / 2, pl.y - 10, '#ffe600', 18, 5, 4);
          playSound('powerup'); _hap('medium');
        }
        break;
      }
    }
  }
  if (!PL.onGround && PL.y >= GY) {
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
    // El slam ahora aterriza en la primera superficie y pega mas cuanto mas
    // alto empezo: saltar desde una plataforma lo duplica. Y ya no golpea a los
    // voladores que estan muy por encima del suelo.
    const altura = PL.y - (PL.slamY0 || PL.y);
    const pot = altura > 90 ? 2 : 1;
    if (pot === 2) spawnFT(PL.x, PL.y - 40, '¡SLAM DESDE ALTURA!', '#ff6400', true);
    shake(12 * pot); freeze(7);
    PL.squash = .4;
    playSound('land', 14);
    enemies.forEach(e => {
      if (e.jefe && e.jefe.estado === 'entrada') return;
      if (Math.abs(e.x + e.w / 2 - (PL.x + PL.w / 2)) < 120 + altura * .4 && Math.abs((e.y + e.h) - (PL.y + PL.h)) < 70) {
        e.hp -= Math.ceil(3 * pot * mej.dano); e.flashTimer = 12;
        spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 14, 5);
        const pts = hitCombo(70);
        spawnFT(e.x, e.y - 20, '+' + pts, '#ff6400', true);
      }
    });
    spawnPFX(PL.x + PL.w / 2, PL.y + PL.h, '#ff6400', 25, 6, 6);
    particles.push({ x: PL.x + PL.w / 2, y: PL.y + PL.h, vx: 0, vy: 0, color: '#ff6400', life: 1, decay: .08, sz: 60, ring: true });
    particles.push({ x: PL.x + PL.w / 2, y: PL.y + PL.h, vx: 0, vy: 0, color: '#ffe600', life: 1, decay: .1, sz: 40, ring: true });
  }

  if (PL.jumpBuffer > 0) { PL.jumpBuffer--; if (PL.onGround || PL.coyoteTimer > 0 || !PL.djUsed) doJump(); }

  // ── TIMERS ──
  // squash guarda cuánto se aplasta el sprite; decae rápido para que el efecto
  // se lea como un golpe seco y no como una deformación permanente.
  cadaveres = cadaveres.filter(c => { c.muriendo--; c.y += 1.2; return c.muriendo > 0; });
  if (particles.length > 220) particles.splice(0, particles.length - 220);
  if (PL.squash) { PL.squash *= .78; if (Math.abs(PL.squash) < .01) PL.squash = 0; }
  if (PL.invTimer > 0) PL.invTimer--;
  if (PL.dashCd > 0) PL.dashCd -= (2 - mej.dashRapido);
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
    const reach = alcanceGolpe();
    const yOff = [10, 5, -5][PL.comboStep];
    const alto = (PL.h - yOff * 1.5) * arma.alto;
    attackBox.x = PL.x + (PL.facing > 0 ? PL.w : -reach);
    attackBox.y = PL.y + yOff - (alto - (PL.h - yOff * 1.5)) / 2;
    attackBox.w = reach;
    attackBox.h = alto;
  }
  let swingHits = 0;
  enemies = enemies.filter(e => {
    if (e.knock > 0) { e.x += e.knock; e.knock *= .78; if (e.knock < .4) e.knock = 0; }
    if (e.aparicion > 0) e.aparicion--;
    if (e.jefe) {
      actualizarJefe(e);
    } else if (e.isBoss) {
      e.x += (W * .4 - e.x) * .015;
    } else if (e.isCharger && e.chargeTimer <= 0) {
      // charge at player: lock direction once so it commits to the pass instead of jittering on top of the player
      if (!e.chargeDir) { e.chargeDir = (PL.x > e.x) ? 1 : -1; e.facing = e.chargeDir; }
      // Aceleraba hasta gameSpeed*2,2 = mas de 13 px/frame en oleadas altas:
      // cruzaba media pantalla en 20 frames y no habia reaccion humana posible.
      // 7,5 es rapido pero legible, y con 78 frames de aviso es justo.
      e.spd = Math.min(e.spd + .05, 7.5);
      e.x += e.chargeDir * e.spd;
    } else {
      e.x -= e.spd;
    }
    if (e.isFlyer) { e.bobTimer += .07; e.y = e.y + (Math.sin(e.bobTimer) * .8); }
    if (e.isMagmar) { e.bobTimer += .04; spawnPFX(e.x + e.w / 2, e.y + e.h * .8, '#ff4400', 1, 1.5, 3); }
    if (e.isCharger && e.chargeTimer > 0) e.chargeTimer--;
    if (e.isExploder) { const dx2 = PL.x - e.x; if (!e.rushDir && Math.abs(dx2) < 180) e.rushDir = dx2 > 0 ? 1 : -1; if (e.rushDir) { e.spd = Math.min(e.spd + .15, 6.5); e.x += e.rushDir * e.spd; spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 2, 2, 3); } }
    if (e.isGhost) { e.ghostTimer += .04; e.ghostAlpha = Math.max(.18, .4 + Math.sin(e.ghostTimer) * 0.6); }
    if (e.flashTimer > 0) e.flashTimer--;

    if ((e.isBoss && !e.jefe) || e.isMagmar) {
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
      const critico = Math.random() < mej.critico;
      let dmg = Math.max(1, Math.ceil((1 + PL.comboStep) * atkMult * mej.dano * arma.dano * (critico ? 2 : 1)));
      // Golpe aereo: premia usar el salto y las plataformas para atacar.
      if (!PL.onGround) dmg = Math.ceil(dmg * 1.25);
      if (e.jefe) {
        if (e.jefe.estado === 'entrada') dmg = 0;
        else if (e.jefe.estado === 'aturdido') dmg = Math.ceil(dmg * 1.5);
      }
      if (critico) spawnFT(e.x + e.w / 2, e.y - 34, 'CRITICO!', '#ffe600', true);
      e.hp -= dmg; e.flashTimer = 10;
      // Retroceso fuerte a proposito: con 5 de empuje el desplazamiento total
      // era de ~18 px y el enemigo mide 68, asi que tras golpearlo SEGUIAS
      // pegado a el y comiendo dano por contacto. Con 18 el desplazamiento es
      // de ~64 px y el golpe te saca del peligro: atacar pasa a ser tambien
      // una herramienta defensiva, que es lo que hace viable el cuerpo a cuerpo.
      e.knock = (e.knock || 0) + (18 + PL.comboStep * 6) * arma.empuje * (e.jefe ? .15 : 1);
      efectoArma(e, dmg);
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
    if (e.hp <= 0) { matarEnemigo(e); return false; }

    // ── PLAYER DAMAGE ──
    if (e.isExploder && overlap({ x: PL.x - 20, y: PL.y - 20, w: PL.w + 40, h: PL.h + 40 }, { x: e.x, y: e.y, w: e.w, h: e.h })) {
      shake(15); e.hp = -1;
      freeze(8);
      spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 40, 8, 8);
      spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ffe600', 25, 6, 6);
      particles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: 0, vy: 0, color: '#ff6400', life: 1, decay: .06, sz: 80, ring: true });
      if (PL.invTimer <= 0) { PL.hp -= 30; PL.invTimer = 60; PL.flashTimer = 20; shake(12); spawnFT(PL.x, PL.y - 20, '-30 EXPLOSION!', '#ff6400', true); updateHpHUD(); _hap('heavy'); if (PL.hp <= 0) { endGame(); } }
    }
    const jefeInofensivo = e.jefe && e.jefe.estado !== 'pausa' && e.jefe.estado !== 'ejecuta';
    if (PL.invTimer <= 0 && !e.isExploder && !jefeInofensivo && overlap({ x: PL.x + 6, y: PL.y + 6, w: PL.w - 12, h: PL.h - 12 }, { x: e.x + 8, y: e.y + 8, w: e.w - 16, h: e.h - 16 })) {
      const dmg = e.jefe ? (e.jefe.estado === 'pausa' ? 10 : 25) : e.isBoss ? 22 : e.isCharger ? 15 : 12;
      PL.hp -= dmg;
      PL.invTimer = 60; PL.flashTimer = 20;
      comboCount = 0; comboMultiplier = 1;
      shake(8); freeze(6);
      if (mej.espinas > 0) { e.hp -= mej.espinas; e.flashTimer = 10; e.knock = (e.knock || 0) + 12; }
      spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff3333', 14, 5);
      spawnFT(PL.x, PL.y - 20, '-' + dmg + ' HP', '#ff3333');
      updateHpHUD();
      _hap('heavy');
      if (PL.hp <= 0) { endGame(); return true; }
    }
    return e.x > -120 && e.x < W + 260; // cull on both sides (chargers/exploders can run off the right edge)
  });

  // endGame() puede haber saltado dentro del bucle de enemigos: si la partida
  // acabo, este frame no sigue simulando. Antes seguian naciendo enemigos y
  // monedas, y el score seguia subiendo, con el jugador ya muerto.
  if (state !== 'playing') return;

  // ── BULLETS ──
  bullets = bullets.filter(b => {
    b.x += b.vx; b.y += b.vy;
    if (b.life <= 0) return false;
    if (b.x < -30 || b.x > W + 30 || b.y > H + 30) return false;
    if (b.roca && b.y + b.h >= GROUND) { spawnPFX(b.x + b.w / 2, GROUND - 4, '#aa8866', 10, 4, 4); shake(3); return false; }

    if (!b.enemy) {
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (overlap(b, { x: e.x + 6, y: e.y + 6, w: e.w - 12, h: e.h - 12 })) {
          e.hp -= 1.5; e.flashTimer = 8;
          const pts = hitCombo(40);
          spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#ff6400', 8, 4);
          spawnFT(e.x, e.y - 15, '+' + pts, '#ff6400');
          if (e.hp <= 0) { matarEnemigo(e); enemies.splice(i, 1); }
          updateHUD();
          return false;
        }
      }
    } else {
      if (PL.invTimer <= 0 && overlap(b, { x: PL.x + 6, y: PL.y + 6, w: PL.w - 12, h: PL.h - 12 })) {
        const bd = b.dmg || 15;
        PL.hp -= bd; PL.invTimer = 45; PL.flashTimer = 15;
        comboCount = 0; comboMultiplier = 1;
        spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff3333', 10, 4);
        spawnFT(PL.x, PL.y - 15, '-' + bd + ' HP', '#ff3333');
        shake(5);
        updateHpHUD();
        _hap('heavy');
        if (PL.hp <= 0) { endGame(); return false; }
        return false;
      }
    }
    return true;
  });

  if (state !== 'playing') return;   // muerto por una bala: cortar el frame igual

  // Un swing que toca a 2+ enemigos se celebra: es la recompensa a posicionarse
  // bien, y antes era invisible porque el ataque solo golpeaba a uno.
  if (swingHits >= 2) {
    spawnFT(PL.x, PL.y - 42, swingHits >= 3 ? 'TRIPLE!' : 'DOBLE!', '#ff3333', true);
    freeze(5); shake(5);
  }

  // ── COINS (con buff coinMult de skins) ──
  const skinCoinMult = (skinBuffs?.coinMult || 1) * mej.monedas;
  coins = coins.filter(c => {
    c.x -= c.spd > 0 ? c.spd : gameSpeed * .6;
    c.bob += .09; c.y += Math.sin(c.bob) * .7;
    const dx = PL.x + PL.w / 2 - (c.x + c.w / 2);
    const dy = PL.y + PL.h / 2 - (c.y + c.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    // imán activo: rango y fuerza mucho mayores
    const range = puMagnet > 0 ? 320 : 90 + mej.iman * 110;
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
      arma = ARMAS[w.type] || ARMAS.base;
      shake(5);
      spawnFT(w.x, w.y - 20, '🗡 ' + arma.nombre + '!', arma.color || '#ffe600', true);
      showPUNotif('🗡 ' + arma.nombre + ' — ' + arma.desc);
      spawnPFX(w.x + w.w / 2, w.y + w.h / 2, arma.color || '#ffe600', 20, 5, 4);
      _hap('heavy');
      return false;
    }
    return w.x > -60;
  });

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
  efectos = efectos.filter(f => ++f.t < FX[f.tipo][2] * FX[f.tipo][3]);
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; if (!p.ring) p.vy += .12; p.life -= p.decay; if (p.ring) p.sz += 4; return p.life > 0; });
  fTexts = fTexts.filter(t => { t.y += t.vy; t.life -= t.decay; return t.life > 0; });

  // ── BG SCROLL ──
  bgStars.forEach(s => { s.x -= s.sp; if (s.x < 0) s.x = W; });
  bgMtns.forEach(m => { m.x -= m.sp; if (m.x < -m.w) m.x = W + m.w; });
  bgClouds.forEach(c => { c.x -= c.sp; if (c.x < -c.w - 20) c.x = W + c.w; });
  groundX = (groundX - gameSpeed) % 40;
  // El parallax reacciona a la velocidad real de la partida: cuando el juego
  // acelera, el mundo pasa mas rapido y se nota.
  scrollLejos += gameSpeed * .12;
  scrollCerca += gameSpeed * .38;

  // ── SPAWN RATES ──
  // arranque más vivo (wave 1 ya tiene acción) y techo de densidad para que sea difícil pero justo
  // El suelo de 50 se tocaba en la oleada 7 y ya no se movia nunca mas,
  // mientras gameSpeed seguia subiendo: los enemigos CRUZABAN la pantalla mas
  // rapido, o sea que habia MENOS a la vez. La dificultad bajaba. Ahora la
  // cadencia sigue apretando y el tope de simultaneos crece con la oleada.
  const spawnRate = wave < 7 ? Math.max(50, 105 - wave * 8)
                             : Math.max(22, 50 - (wave - 7) * 3);
  // Con el jefe en pantalla solo acompañan 2: el combate es contra el.
  const ritmo = nivel ? Math.round(spawnRate * nivel.dens) : spawnRate;
  const tope = nivel ? nivel.tope : 8 + wave * 1.5;
  if (frame % ritmo === 0 && enemies.length < tope && !(bossActive && enemies.length >= (nivel ? 2 : 3)) && !victoriaEn) spawnEnemy();
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
// Devuelve la clave de sprite del jugador, ya validada (si la skin equipada
// todavia no ha cargado se cae al duende base).
function _playerKey() {
  let key = 'duende_hero';
  try { key = (DQE.getPlayerImgKey && DQE.getPlayerImgKey()) || 'duende_hero'; } catch (e) {}
  const img = IMG_EL[key];
  return (img && img.naturalWidth > 0) ? key : 'duende_hero';
}
function _playerImg() { return IMG_EL[_playerKey()]; }

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
function currentBiome() { return nivel ? BIOMES[nivel.bioma] : BIOMES[Math.floor((wave - 1) / 3) % BIOMES.length]; }

// ══ CAMPAÑA: 5 biomas × 3 etapas ══
// En el modo sin fin el novato (vive ~101 s) nunca ganaba nada. Una etapa de
// 1-3 oleadas cabe dentro de esa ventana y termina en VICTORIA. La tercera
// etapa de cada bioma es un jefe. Cada bioma presenta un enemigo nuevo en vez
// de soltar el bestiario entero en los primeros dos minutos. SIN FIN queda
// como modo de ranking y se desbloquea al vencer al primer jefe.
const POOLS = [
  ['normal', 'flyer'],
  ['normal', 'flyer', 'charger'],
  ['normal', 'flyer', 'charger', 'exploder'],
  ['normal', 'flyer', 'charger', 'exploder', 'ghost'],
  ['normal', 'flyer', 'charger', 'exploder', 'ghost', 'magmar'],
];
const LEVELS = [];
// dens multiplica el intervalo entre spawns y tope limita los enemigos a la
// vez: la 1-1 es la primera impresion y tiene que poder ganarla un novato.
BIOMES.forEach((b, bi) => {
  const vel = 3.1 + bi * .3, pool = POOLS[bi];
  const dens = Math.max(1, 1.7 - bi * .18), tope = 4 + bi * 2;
  LEVELS.push({ id: (bi + 1) + '-1', bioma: bi, oleadas: 2, vel, pool: bi ? pool.slice(0, -1) : ['normal'], elite: bi * .05, dens: dens + (bi ? .15 : .9), tope: bi ? tope : 2 });
  LEVELS.push({ id: (bi + 1) + '-2', bioma: bi, oleadas: 3, vel: vel + .2, pool, elite: .05 + bi * .05, dens, tope: tope + 1 });
  // El ultimo bioma (DESIERTO DORADO, bi 4) es el cierre de las 15 etapas:
  // en vez de otro oso reciclado, el angel — primer jefe con silueta propia.
  const esFinal = bi === BIOMES.length - 1;
  LEVELS.push({ id: (bi + 1) + '-3', bioma: bi, oleadas: 1, vel: vel + .2, pool, elite: .05 + bi * .05, dens: dens + .15, tope, jefe: { tipo: esFinal ? 'angel' : 'oso', hp: bi * 20 } });
});

function leerCampana() {
  try { return JSON.parse(localStorage.getItem('dq_campana') || '{}').estrellas || {}; } catch (e) { return {}; }
}
function guardarCampana(est) {
  try { localStorage.setItem('dq_campana', JSON.stringify({ estrellas: est })); } catch (e) {}
}
function nivelDesbloqueado(i, est) {
  if (i === 0) return true;
  return (est[LEVELS[i - 1].id] || 0) >= 1;
}
function sinFinDesbloqueado(est) { return (est['1-3'] || 0) >= 1; }

// Recompensa en DQ solo por estrellas NUEVAS, para que repetir la 1-1 no se
// pueda farmear.
function ganarNivel() {
  state = 'victoria';
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  stopMusic();
  playSound('levelup'); _hap('heavy');
  const idx = LEVELS.indexOf(nivel);
  const est = leerCampana();
  const antes = est[nivel.id] || 0;
  const conseguidas = [true, PL.hp / PL.maxHp >= .5 && !reviveUsed, sellos >= 3];
  const n = conseguidas.filter(Boolean).length;
  const nuevas = Math.max(0, n - antes);
  const premio = nuevas * (20 + nivel.bioma * 10);
  if (n > antes) { est[nivel.id] = n; guardarCampana(est); }
  missionEvent('etapa', 1);
  try { window.DQAch && DQAch.onEtapa && DQAch.onEtapa(nivel.id, LEVELS.reduce((t, l) => t + (est[l.id] || 0), 0)); } catch (e) {}
  if (n > antes) missionEvent('estrella', n - antes);
  if (premio) { totalCoins += premio; }
  localStorage.setItem('dq_hi', hiScore);
  saveProgress();
  try { window.DQMissions && DQMissions.flush && DQMissions.flush(); } catch (e) {}
  try { window.DQAch && DQAch.flush && DQAch.flush(); } catch (e) {}

  let ov = $id('ov-victoria');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ov-victoria';
    ov.style.cssText = 'position:fixed;inset:0;z-index:58;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;background:#050510;padding:16px;gap:8px;text-align:center';
    document.body.appendChild(ov);
  }
  const b = BIOMES[nivel.bioma];
  const txt = ['Etapa completada', 'Terminar con 50% de vida o más, sin revivir', 'Recoger los 3 sellos ✦ de las plataformas (' + sellos + '/3)'];
  const siguiente = LEVELS[idx + 1];
  ov.innerHTML =
    '<div style="font-size:.44rem;color:' + b.line + '">' + b.name + ' · ' + nivel.id + '</div>' +
    '<div style="font-size:.70rem;color:#ffe600;text-shadow:3px 3px 0 #000;margin:4px 0">¡VICTORIA!</div>' +
    '<div style="font-size:1.6rem;letter-spacing:.2em;margin:2px 0">' +
      conseguidas.map(c => '<span style="color:' + (c ? '#ffe600' : 'rgba(255,255,255,.18)') + '">★</span>').join('') + '</div>' +
    '<div style="font-size:.40rem;line-height:2;color:rgba(255,255,255,.85);max-width:460px">' +
      conseguidas.map((c, i) => '<span style="color:' + (c ? '#00ff88' : 'rgba(255,255,255,.4)') + '">' + (c ? '★ ' : '☆ ') + txt[i] + '</span>').join('<br>') + '</div>' +
    (premio ? '<div style="font-size:.36rem;color:#00ff88;margin-top:4px">+' + premio + ' DQ por estrellas nuevas</div>' : '') +
    '<div style="display:flex;flex-direction:column;gap:8px;width:min(380px,92%);margin-top:10px">' +
      (siguiente ? '<button class="ob" id="vic-sig">▶ SIGUIENTE · ' + siguiente.id + '</button>' : '<button class="ob" id="vic-sig">∞ MODO SIN FIN</button>') +
      (typeof window.shareScore === 'function' ? '<button class="ob" id="vic-share" style="background:linear-gradient(135deg,#1da1f2,#0077b5);color:#fff">📣 COMPARTIR</button>' : '') +
      '<button class="ob" id="vic-rep" style="background:rgba(255,255,255,.08);color:#fff">↻ REPETIR</button>' +
      '<button class="ob" id="vic-mapa" style="background:rgba(255,255,255,.08);color:#fff">🗺 MAPA</button>' +
    '</div>';
  ov.querySelector('#vic-sig').onclick = () => siguiente ? startGame({ nivel: idx + 1 }) : startGame();
  ov.querySelector('#vic-rep').onclick = () => startGame({ nivel: idx });
  ov.querySelector('#vic-mapa').onclick = () => abrirMapa();
  const vs = ov.querySelector('#vic-share'); if (vs) vs.onclick = () => window.shareScore();
  // Para que la pagina sincronice los DQ ganados (en Telegram, a la nube).
  try { DQE.onVictoria && DQE.onVictoria({ nivel: nivel.id, estrellas: n, premio }); } catch (e) {}
  ultimaVictoria = { id: nivel.id, bioma: b.name, estrellas: n };
  ov.style.display = 'flex';
}

function abrirMapa() {
  hideAll();
  try { DQE.onToMenu && DQE.onToMenu(); } catch (e) {}
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  if (state !== 'menu') { state = 'menu'; arrancarAtraccion(); }
  const est = leerCampana();
  let ov = $id('ov-niveles');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ov-niveles';
    ov.style.cssText = 'position:fixed;inset:0;z-index:58;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;background:#050510;padding:16px;gap:8px;overflow-y:auto';
    document.body.appendChild(ov);
  }
  const total = LEVELS.reduce((s, l) => s + (est[l.id] || 0), 0);
  let html = '<div style="font-size:.56rem;color:#00ff88;text-shadow:3px 3px 0 #000">🗺 MAPA</div>' +
    '<div style="font-size:.42rem;color:#ffe600;margin-bottom:6px">★ ' + total + ' / ' + (LEVELS.length * 3) + '</div>';
  BIOMES.forEach((b, bi) => {
    html += '<div style="width:min(460px,96%);display:flex;align-items:center;gap:6px">' +
      '<div style="flex:1;font-size:.36rem;line-height:1.5;color:' + b.line + ';text-align:left">' + b.name + '</div>';
    for (let k = 0; k < 3; k++) {
      const i = bi * 3 + k, l = LEVELS[i], ok = nivelDesbloqueado(i, est), s = est[l.id] || 0;
      html += '<button data-n="' + i + '" ' + (ok ? '' : 'disabled ') + 'style="width:74px;min-height:52px;border-radius:6px;font-family:inherit;' +
        'border:2px solid ' + (ok ? b.line : 'rgba(255,255,255,.12)') + ';background:' + (ok ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.3)') + ';' +
        'color:#fff;cursor:' + (ok ? 'pointer' : 'default') + ';font-size:.42rem;line-height:1.6">' +
        (ok ? (l.jefe ? '☠ ' : '') + l.id + '<br><span style="color:#ffe600;font-size:.56rem">' + '★'.repeat(s) + '<span style="color:rgba(255,255,255,.2)">' + '★'.repeat(3 - s) + '</span></span>' : '🔒') +
        '</button>';
    }
    html += '</div>';
  });
  const sf = sinFinDesbloqueado(est);
  html += '<button class="ob" id="mapa-sinfin" style="width:min(420px,94%);margin-top:8px' + (sf ? '' : ';opacity:.45') + '">' +
    (sf ? '∞ MODO SIN FIN (RANKING)' : '🔒 SIN FIN · vence al jefe 1-3') + '</button>' +
    '<button class="ob" id="mapa-volver" style="width:min(420px,94%);background:rgba(255,255,255,.08);color:#fff">← VOLVER</button>';
  ov.innerHTML = html;
  ov.querySelectorAll('button[data-n]').forEach(bt => { bt.onclick = () => startGame({ nivel: +bt.dataset.n }); });
  ov.querySelector('#mapa-sinfin').onclick = () => { if (sf) startGame(); };
  ov.querySelector('#mapa-volver').onclick = () => toMenu();
  ov.style.display = 'flex';
}

// JUGAR: la primera etapa sin completar; si ya estan todas, SIN FIN.
// Texto para compartir: tras una victoria habla de la etapa y sus estrellas,
// que es un logro que el amigo puede intentar igualar.
let ultimaVictoria = null;
function textoCompartir() {
  if (state === 'victoria' && ultimaVictoria) {
    return '🧝 Superé la etapa ' + ultimaVictoria.id + ' (' + ultimaVictoria.bioma + ') de DUENDE QUEST con ' +
      '★'.repeat(ultimaVictoria.estrellas) + '☆'.repeat(3 - ultimaVictoria.estrellas) + ' ¿Puedes sacar las 3 estrellas? 👇';
  }
  return '🧝 Hice ' + Math.floor(score).toLocaleString() + ' puntos en DUENDE QUEST (Wave ' + wave + ')! ¿Me superas? 👇';
}

function jugar() {
  const est = leerCampana();
  const i = LEVELS.findIndex(l => !est[l.id]);
  if (i >= 0) startGame({ nivel: i }); else startGame();
}
function reintentar() { startGame(ultimoInicio || undefined); }


let _vignette = null;
// El degradado del cielo se creaba cada frame; solo cambia al cambiar de bioma.
let _gradFondo = { biome: null, grad: null };
// Mancha radial pre-pintada para las nubes: 5 createRadialGradient por frame
// era de lo mas caro del dibujado, y el resultado con un sprite es identico.
const _nubes = new Map();
function _nubeSprite(cloud) {
  let c = _nubes.get(cloud);
  if (c) return c;
  c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  rg.addColorStop(0, 'rgba(' + cloud + ',1)');
  rg.addColorStop(1, 'rgba(' + cloud + ',0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  _nubes.set(cloud, c);
  return c;
}

// Brillo neon barato: el halo radial ya cacheado de las nubes, sumado con
// 'lighter'. Sustituye a shadowBlur, que obliga al navegador a desenfocar la
// silueta de cada sprite en cada frame y en moviles de gama media es de lo
// mas caro que se puede pedir a un canvas.
function brillo(x, y, r, rgb, a) {
  cx.save();
  cx.globalAlpha = a;
  cx.globalCompositeOperation = 'lighter';
  cx.drawImage(_nubeSprite(rgb), x - r, y - r, r * 2, r * 2);
  cx.restore();
}

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
  if (_gradFondo.biome !== biome) {
    const g = cx.createLinearGradient(0, 0, 0, GY + 10);
    g.addColorStop(0, biome.top);
    g.addColorStop(1, biome.bot);
    _gradFondo = { biome, grad: g };
  }
  cx.fillStyle = _gradFondo.grad;
  cx.fillRect(0, 0, W, H);

  bgStars.forEach(s => { cx.fillStyle = `rgba(255,255,255,${.2 + Math.sin(frame * .04 + s.x) * .15})`; cx.fillRect(s.x, s.y, s.s, s.s); });

  // Capas de parallax: la lejana se mueve a un tercio de la cercana, que a su
  // vez va mas lenta que el suelo. Esa diferencia es toda la profundidad.
  const bi = Math.max(0, BIOMES.indexOf(biome)) % FONDOS.length;
  if (_bgVarBi !== bi) { _bgVarBi = bi; _bgVarIdx = Math.floor(Math.random() * FONDOS[bi].length); }
  const _fondo = FONDOS[bi][_bgVarIdx];
  dibujarCapa(_fondo.lejos, scrollLejos, 46);
  dibujarCapa(_fondo.cerca, scrollCerca, 16);

  const _nube = _nubeSprite(biome.cloud);
  bgClouds.forEach(c => {
    cx.save();
    cx.globalAlpha = c.alpha * 2;
    cx.drawImage(_nube, c.x, c.y + c.h / 2 - c.w / 2, c.w, c.w);
    cx.restore();
  });

  // Ground
  cx.fillStyle = biome.ground;
  cx.fillRect(0, GY + PL.h, W, H - (GY + PL.h));
  cx.fillStyle = biome.line;
  cx.fillRect(0, GY + PL.h, W, 3);
  cx.fillStyle = 'rgba(0,255,136,.1)';
  for (let gx = groundX; gx < W; gx += 40) cx.fillRect(gx, GY + PL.h + 3, 2, H - (GY + PL.h + 3));

  // ── PLATAFORMAS ──
  // Se pintan con el color del bioma para que formen parte del sitio, con una
  // franja superior brillante que deja claro donde se puede pisar.
  plataformas.forEach(pl => {
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,.45)';
    cx.fillRect(pl.x + 3, pl.y + 4, pl.w, pl.h);
    cx.fillStyle = biome.ground;
    cx.fillRect(pl.x, pl.y, pl.w, pl.h);
    cx.fillStyle = biome.line;
    cx.fillRect(pl.x, pl.y, pl.w, 3);
    cx.globalAlpha = .30;
    cx.fillStyle = biome.line;
    cx.fillRect(pl.x, pl.y + pl.h, pl.w, 2);
    if (pl.sello) {
      // Estrella de 5 puntas dibujada con path: sin sprite nuevo.
      const sx0 = pl.x + pl.w / 2, sy0 = pl.y - 22 + Math.sin(frame * .08) * 4, r = 11;
      cx.globalAlpha = 1; cx.fillStyle = '#ffe600'; cx.strokeStyle = '#000'; cx.lineWidth = 2;
      cx.beginPath();
      for (let k = 0; k < 10; k++) {
        const ang = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r;
        cx.lineTo(sx0 + Math.cos(ang) * rr, sy0 + Math.sin(ang) * rr);
      }
      cx.closePath(); cx.stroke(); cx.fill();
    }
    cx.restore();
  });

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

  dibujarAvisosJefe();

  // Coins
  coins.forEach(c => {
    cx.save(); cx.imageSmoothingEnabled = false;
    drawSpr(IMG_EL['coin'], c); cx.restore();
  });

  // Chests
  chests.forEach(ch => {
    const brillos = { comun: '170,255,170', epico: '204,68,255', legendario: '255,230,0' };
    const pulse = Math.sin(ch.glowTimer * .08) * .5 + .5;
    brillo(ch.x + ch.w / 2, ch.y + ch.h / 2, ch.w * (.9 + pulse * .3), brillos[ch.tier], .35 + pulse * .25);
    cx.save(); cx.imageSmoothingEnabled = false;
    cx.globalAlpha = .92 + pulse * .08;
    drawSpr(IMG_EL['cofre_' + ch.tier], ch);
    cx.restore();
  });

  // Weapon drops
  weaponDrops.forEach(w => {
    const pulse = Math.sin(frame * .1) * .4 + .6;
    cx.save(); cx.imageSmoothingEnabled = false;
    const def = ARMAS[w.type] || ARMAS.odachi;
    cx.globalAlpha = .85 + pulse * .15;
    drawSpr(def.tinte ? tintedSprite(def.icono, def.tinte) : IMG_EL[def.icono], w);
    cx.font = '8px "Press Start 2P"'; cx.textAlign = 'center'; cx.fillStyle = def.color || '#fff';
    cx.fillText(def.nombre, w.x + w.w / 2, w.y - 6);
    cx.restore();
  });

  // Power-ups (burbuja con emoji)
  powerups.forEach(pu => {
    const def = PU_TYPES[pu.type];
    const pulse = Math.sin(frame * .15) * .15 + .9;
    brillo(pu.x + pu.w / 2, pu.y + pu.h / 2, pu.w * .9, def.rgb, .45);
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,.35)';
    cx.beginPath(); cx.arc(pu.x + pu.w / 2, pu.y + pu.h / 2, pu.w / 2 * pulse, 0, Math.PI * 2); cx.fill();
    cx.strokeStyle = def.color; cx.lineWidth = 2; cx.stroke();
    cx.font = '18px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
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

  // Enemies (los cadaveres se pintan primero, para que queden por detras)
  cadaveres.concat(enemies).forEach(e => {
    // El flash de golpe era una bajada de alpha a .25: al pegarle, el enemigo se
    // volvía TRANSPARENTE, que se lee como "está desapareciendo", no como
    // "acaba de encajar un golpe". Ahora destella en BLANCO y mantiene su cuerpo.
    const ghostA = e.isGhost ? (e.ghostAlpha || 1) : 1;
    const key = e.isBoss ? 'enemy2' : e.isMagmar ? 'enemy_magmar' : 'enemy';
    const variant = enemyTint(e);
    // La animacion transforma el sprite alrededor de sus PIES, que es donde
    // pivota cualquier criatura al agacharse, embestir o caer muerta.
    const an = animEnemigo(e);
    const pies = e.y + e.h;
    const aura = e.isMagmar ? '255,68,0' : e.isExploder ? '255,68,0' : e.isGhost ? '147,51,234' : null;
    if (aura && !e.muriendo) brillo(e.x + e.w / 2, e.y + e.h / 2, e.h * .75, aura, (e.isGhost ? .35 : .45) * ghostA);
    cx.save();
    cx.imageSmoothingEnabled = false;
    cx.globalAlpha = ghostA * an.alpha;
    cx.translate(e.x + e.w / 2 + an.dx, pies + an.dy);
    cx.rotate(an.giro);
    cx.scale((e.facing > 0 ? 1 : -1) * an.escalaX, an.escalaY);
    if (e.sheet) {
      const sh = SHEETS[e.sheet], imgKey = 'sh_' + e.sheet;
      drawSheet(variant ? tintedSprite(imgKey, variant) : IMG_EL[imgKey], sh, sheetFrame(e, sh));
      // Sin destello blanco encima: el propio frame de daño de la hoja ya
      // comunica el golpe, y superponer los dos se leia como un parpadeo raro.
    } else {
      drawSpr(variant ? tintedSprite(key, variant) : IMG_EL[key], { x: -e.w / 2, y: -e.h, w: e.w, h: e.h });
      if (e.flashTimer > 0) {
        cx.globalAlpha = ghostA * Math.min(1, e.flashTimer / 8);
        drawSpr(whiteSprite(key), { x: -e.w / 2, y: -e.h, w: e.w, h: e.h });
      }
    }
    cx.restore();
    if (e.muriendo > 0) return;
    if (e.elite) {
      cx.save();
      // En px absolutos: cx.font en rem se resuelve contra los 16px de la raiz
      // y el nombre del elite acababa midiendo 3px en pantalla.
      cx.font = '10px "Press Start 2P"'; cx.textAlign = 'center';
      cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.85)'; cx.lineJoin = 'round';
      cx.strokeText(e.elite.nombre, e.x + e.w / 2, e.y - 18);
      cx.fillStyle = e.elite.color;
      cx.fillText(e.elite.nombre, e.x + e.w / 2, e.y - 18);
      cx.restore();
    }
    if (e.maxHp > 2 || e.isBoss) {
      const bw = e.w; const pct = e.hp / e.maxHp;
      cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(e.x, e.y - 12, bw, 7);
      cx.fillStyle = e.isBoss ? '#ff00cc' : pct > .5 ? '#00ff88' : '#ff3333';
      cx.fillRect(e.x, e.y - 12, bw * pct, 7);
      cx.strokeStyle = 'rgba(255,255,255,.2)'; cx.lineWidth = 1; cx.strokeRect(e.x, e.y - 12, bw, 7);
    }
  });

  // Balas: una sola pasada para separarlas (antes se hacía bullets.filter dos
  // veces por frame, creando dos arrays intermedios extra).
  const _balasEne = [], _balasJug = [];
  bullets.forEach(b => (b.enemy ? _balasEne : _balasJug).push(b));

  // Enemy bullets
  _balasEne.forEach(b => {
    cx.save();
    if (b.roca) {
      cx.fillStyle = '#6b5544'; cx.fillRect(b.x + 4, b.y, b.w - 8, b.h);
      cx.fillRect(b.x, b.y + 6, b.w, b.h - 12);
      cx.fillStyle = '#9c8068'; cx.fillRect(b.x + 8, b.y + 4, 12, 8);
    } else if (b.onda) {
      cx.fillStyle = 'rgba(255,120,60,.85)';
      cx.beginPath(); cx.moveTo(b.x, b.y + b.h); cx.lineTo(b.x + b.w / 2, b.y); cx.lineTo(b.x + b.w, b.y + b.h); cx.fill();
    } else if (b.fire) {
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
  _balasJug.forEach(b => {
    cx.save(); cx.imageSmoothingEnabled = false; cx.globalCompositeOperation = 'lighter'; cx.globalAlpha = .9;
    cx.drawImage(IMG_EL['skill_fire'], b.x, b.y - b.h / 2, b.w * 1.8, b.h * 1.8); cx.restore();
  });

  // ── PLAYER ──
  const plAlpha = PL.invTimer > 0 && PL.invTimer % 8 < 4 ? .3 : 1;
  const _plKey = _playerKey();
  const _plImg = IMG_EL[_plKey];
  cx.save(); cx.imageSmoothingEnabled = false; cx.globalAlpha = plAlpha;
  // Squash & stretch: se aplasta al aterrizar y se estira al saltar, siempre
  // conservando el volumen y anclado a los pies para que no "flote".
  const sq = PL.squash || 0;
  const pw = PL.w * (1 + sq * .55), ph = PL.h * (1 - sq);
  const px = PL.x - (pw - PL.w) / 2, py = PL.y + (PL.h - ph);
  // La animacion es del duende base: si el jugador lleva una skin de pago,
  // se dibuja su sprite propio (que ahora si es el suyo) en vez de animar.
  const _anim = _plKey === 'duende_hero' ? animFrame() : -1;
  if (_anim >= 0) drawAnim(_anim, { x: px, y: py, w: pw, h: ph }, PL.facing < 0);
  else {
    // Las skins de pago son una sola imagen: sin esto el que PAGABA veia un
    // personaje congelado y el gratis uno animado. Se anima por codigo
    // alrededor de los pies: respira quieto, rebota al andar, se inclina al
    // correr y se lanza hacia delante en cada golpe.
    const mov = Math.abs(PL.vx) > .6 && PL.onGround;
    const rebote = mov ? -Math.abs(Math.sin(frame * .3)) * 4 : Math.sin(frame * .06) * 1.2;
    const respira = mov ? 0 : Math.sin(frame * .06) * .025;
    const empuje = PL.attackTimer > 0 ? PL.facing * 7 * (PL.attackTimer / 16) : 0;
    const giro = mov ? .07 * PL.facing : !PL.onGround ? -.05 * PL.facing : 0;
    cx.translate(px + pw / 2 + empuje, py + ph);
    cx.rotate(giro);
    cx.scale(1 - respira * .5, 1 + respira);
    drawSpr(_plImg, { x: -pw / 2, y: -ph + rebote, w: pw, h: ph }, PL.facing < 0);
  }
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
      drawSpr(_plImg, { x: tx, y: PL.y, w: PL.w, h: PL.h }, PL.facing < 0); cx.restore();
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

  // Efectos en tira (cortes, muertes, descargas). 'lighter' suma luz: sobre
  // el fondo oscuro es lo que les da el aspecto neon sin shadowBlur.
  efectos.forEach(f => {
    const [fw, fh, n, tpf] = FX[f.tipo];
    const base = IMG_EL['fx_' + f.tipo];
    if (!base || !base.naturalWidth) return;
    const img = f.tinte ? tintedSprite('fx_' + f.tipo, f.tinte) : base;
    const i = Math.min(n - 1, Math.floor(f.t / tpf));
    const w = fw * f.escala, h = fh * f.escala;
    const x = f.sigue ? PL.x + f.x : f.x, y = f.sigue ? PL.y + f.y : f.y;
    cx.save();
    cx.imageSmoothingEnabled = false;
    if (f.aditivo) cx.globalCompositeOperation = 'lighter';
    cx.translate(x, y);
    if (f.flip) cx.scale(-1, 1);
    cx.drawImage(img, i * fw, 0, fw, fh, -w / 2, -h / 2, w, h);
    cx.restore();
  });

  // Attack arc (fino: el corte en tira ya da la forma del golpe)
  if (PL.attackHitbox.active && !(IMG_EL.fx_corte_h && IMG_EL.fx_corte_h.naturalWidth)) {
    const colors = ['rgba(255,230,0,.5)', 'rgba(255,153,0,.6)', 'rgba(255,51,51,.7)'];
    cx.save(); cx.strokeStyle = arma.color || colors[PL.comboStep]; cx.lineWidth = 3 + PL.comboStep;
    const cx2 = PL.x + (PL.facing > 0 ? PL.w : 0);
    cx.beginPath(); cx.arc(cx2, PL.y + PL.h / 2, (40 + PL.comboStep * 12) * arma.alcance,
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

  // Arma equipada y sellos de la etapa (esquina inferior izquierda)
  if (state === 'playing' || state === 'paused') {
    cx.save();
    cx.font = '8px "Press Start 2P"'; cx.textAlign = 'left';
    cx.lineWidth = 3; cx.lineJoin = 'round'; cx.strokeStyle = '#000';
    const txtArma = '🗡 ' + arma.nombre + (nivel ? '   ✦ ' + sellos + '/3   ' + nivel.id : '');
    cx.strokeText(txtArma, 8, H - 8);
    cx.fillStyle = arma.color || '#ffe600'; cx.fillText(txtArma, 8, H - 8);
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
    cx.font = '16px "Press Start 2P"';
    cx.textAlign = 'center';
    cx.lineWidth = 4; cx.lineJoin = 'round'; cx.strokeStyle = '#000';
    cx.strokeText(tutorialStep === 0 ? '☝️ TOCA / ESPACIO = SALTAR' : '⚔ TOCA EL BOTÓN ⚔ / Z = ATACAR', W / 2, 70);
    cx.fillText(tutorialStep === 0 ? '☝️ TOCA / ESPACIO = SALTAR' : '⚔ TOCA EL BOTÓN ⚔ / Z = ATACAR', W / 2, 70);
    cx.restore();
  }

  // Progreso hacia la proxima mejora: el jugador necesita ver que le queda
  // poco para elegir, porque esa es la zanahoria de cada partida.
  if (state === 'playing' || state === 'eligiendo') {
    const pct = Math.min(1, runXPAcc / runXPNecesario(runLevel));
    cx.save();
    cx.fillStyle = 'rgba(0,0,0,.45)'; cx.fillRect(W / 2 - 70, 8, 140, 7);
    cx.fillStyle = '#c084fc'; cx.fillRect(W / 2 - 70, 8, 140 * pct, 7);
    cx.strokeStyle = 'rgba(192,132,252,.5)'; cx.lineWidth = 1; cx.strokeRect(W / 2 - 70, 8, 140, 7);
    cx.font = '8px "Press Start 2P"'; cx.textAlign = 'center'; cx.fillStyle = 'rgba(255,255,255,.55)';
    cx.fillText('MEJORA ' + runLevel, W / 2, 26);
    if (mejorasElegidas.length) {
      cx.font = '13px sans-serif'; cx.textAlign = 'right';
      cx.fillText(mejorasElegidas.slice(-8).join(' '), W - 8, 26);
    }
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
  dibujarBarraJefe();

  // Floating texts — con contorno negro para que se lean sobre cualquier bioma.
  cx.save();
  fTexts.forEach(t => {
    cx.globalAlpha = t.life;
    cx.font = (t.big ? 19 : 14) + 'px "Press Start 2P"';
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
      // update() puede abrir el descanso entre oleadas o la eleccion de mejora.
      // Si no cortamos aqui, el acumulador seguiria simulando frames con el
      // juego ya pausado y la partida avanzaria por debajo del menu.
      if (state !== 'playing') { draw(); return; }
    }
    _acc -= STEP; steps++;
  }
  if (steps === 5) _acc = 0;        // no acumular deuda si el móvil no da más

  draw();
  try { DQE.loopTick && DQE.loopTick(); } catch (e) {}
  raf = requestAnimationFrame(loop);
}

// ── MODO ATRACCION ──
// El menu era un rectangulo negro: hasta pulsar JUGAR no se veia ni un pixel
// del juego, porque loop() sale de inmediato si el estado no es 'playing'.
// Ver el bioma con parallax, el suelo y el duende moviendose detras del menu es
// la mejor mejora de primera impresion por linea de codigo, y como vive en el
// motor compartido sirve a la web y a la Mini App a la vez.
let atraccionRaf = null;

function bucleAtraccion() {
  if (state !== 'menu' || document.hidden) { atraccionRaf = null; return; }
  frame++;
  groundX = (groundX - 1.6) % 40;
  scrollLejos += .35;
  scrollCerca += 1.1;
  bgStars.forEach(st => { st.x -= st.sp * .5; if (st.x < 0) st.x = W; });
  bgClouds.forEach(c => { c.x -= c.sp * .5; if (c.x < -c.w - 20) c.x = W + c.w; });
  plataformas.forEach(pl => { pl.x -= 1.4; if (pl.x + pl.w < -20) { pl.x = W + 40; pl.y = GROUND - (70 + Math.random() * 90); } });
  // El duende pasea de un lado a otro para que se le vea la animacion.
  PL.vx = Math.sin(frame * .012) * 2.6;
  PL.x += PL.vx;
  if (PL.x < 40) PL.x = 40;
  if (PL.x > W - PL.w - 40) PL.x = W - PL.w - 40;
  PL.facing = PL.vx < 0 ? -1 : 1;
  PL.onGround = true; PL.y = GY;
  if (PL.squash) PL.squash *= .8;
  // Un salto de vez en cuando para que no parezca un bucle de andar.
  if (frame % 190 === 0) { PL.squash = -.2; spawnPFX(PL.x + PL.w / 2, GY + PL.h, '#00ff88', 6, 3); }
  particles = particles.filter(pp => { pp.x += pp.vx; pp.y += pp.vy; pp.vy += .12; pp.life -= pp.decay; return pp.life > 0; });
  draw();
  atraccionRaf = requestAnimationFrame(bucleAtraccion);
}

function arrancarAtraccion() {
  if (atraccionRaf) return;
  // El menu pintaba los restos de la partida anterior: cadaveres, balas y
  // monedas congelados detras de los botones. El modo atraccion arranca con
  // el escenario limpio y el duende entero.
  enemies = []; coins = []; bullets = []; chests = []; weaponDrops = [];
  powerups = []; fTexts = []; cadaveres = []; particles = []; efectos = [];
  bossActive = false;
  PL.hp = PL.maxHp;
  PL.invTimer = 0; PL.flashTimer = 0; PL.dashing = false; PL.slamming = false;
  PL.attackHitbox.active = false;
  if (!plataformas.length) initPlataformas();
  if (!bgStars.length) initBg();
  atraccionRaf = requestAnimationFrame(bucleAtraccion);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && state === 'menu') arrancarAtraccion(); });

// ── LIFECYCLE ──
function startGame(opts) {
  // Con red lenta se podia empezar sin sprites. El boton JUGAR ya ensena el
  // progreso; este guard cubre ademas el Enter y los botones de reintentar.
  if (!cargaCompleta()) { showPUNotif('⌛ CARGANDO ' + _pctCarga() + '%'); return; }
  opts = (opts && typeof opts === 'object' && !(opts instanceof Event)) ? opts : null;
  nivel = (opts && opts.nivel != null) ? LEVELS[opts.nivel] || null : null;
  ultimoInicio = opts;
  sellos = 0; sellosPuestos = 0; victoriaEn = 0; jefeInvocado = false; jefeOleada = 0;
  arma = ARMAS.base;
  playMusic();
  hideAll();
  score = 0; wave = 1; frame = 0; gameSpeed = nivel ? nivel.vel : baseSpeed; waveTimer = 0; bossActive = false; bossKilled = 0;
  reviveUsed = false;
  sessionCoins = 0; comboCount = 0; comboMax = 0; comboMultiplier = 1; comboTimer = 0;
  playerXP = 0; playerLevel = 1;
  killStreak = 0; killStreakTimer = 0;
  enemies = []; coins = []; bullets = []; particles = []; fTexts = []; cadaveres = []; efectos = [];
  chests = []; weaponDrops = [];
  powerups = []; puMagnet = 0; puDouble = 0;
  shakeAmt = 0; shakeTimer = 0; hitStop = 0;
  mej = mejorasBase(); mejorasElegidas = []; runLevel = 1; runXPAcc = 0;
  monedasAlEmpezarOleada = 0;
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
  initPlataformas();
  updateHpHUD(); updateHUD(); updateXPBar();
  for (let i = 0; i < 4; i++) updateItemHUD(i);
  state = 'playing';
  if (atraccionRaf) { cancelAnimationFrame(atraccionRaf); atraccionRaf = null; }
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
  if (atraccionRaf) { cancelAnimationFrame(atraccionRaf); atraccionRaf = null; }
  // Un solo bucle vivo: reanudar sin cancelar el anterior duplicaba el rAF y
  // el juego se aceleraba tras varias pausas o revives.
  if (raf) cancelAnimationFrame(raf);
  resetLoopClock();
  raf = requestAnimationFrame(loop);
}

function endGame() {
  if (victoriaEn > 0 && nivel) { ganarNivel(); return; }   // el jefe ya cayo
  stopMusic();
  state = 'dead';
  cancelAnimationFrame(raf);
  playSound('die');
  _hap('heavy');
  localStorage.setItem('dq_hi', hiScore);
  saveProgress();
  // Misiones y logros acumulan escrituras pendientes (throttle de 1s): al
  // morir se vuelca todo, que es el momento que no puede perderse.
  try { window.DQMissions && DQMissions.flush && DQMissions.flush(); } catch (e) {}
  try { window.DQAch && DQAch.flush && DQAch.flush(); } catch (e) {}
  const fs = $id('final-score'); if (fs) fs.textContent = Math.floor(score).toLocaleString();
  const fh = $id('final-hi'); if (fh) fh.textContent = 'HI-SCORE: ' + Math.floor(hiScore).toLocaleString();
  const ds = $id('dead-stats'); if (ds) ds.innerHTML = `WAVE: ${wave} &nbsp; 🪙 ${sessionCoins} &nbsp; LVL: ${playerLevel}<br>COMBO MAX: ${comboMax} &nbsp; BOSSES: ${bossKilled}`;
  renderDeadNudge();
  const ov = $id('ov-dead'); if (ov) ov.classList.add('show');
  offerRevive();
  try {
    DQE.onEndGame && DQE.onEndGame({ score: Math.floor(score), wave, level: playerLevel, coins: sessionCoins, bosses_killed: bossKilled, combos_max: comboMax, modo: nivel ? 'campana' : 'sinfin', nivel: nivel ? nivel.id : null });
  } catch (e) {}
}

// ── DESCANSO ENTRE OLEADAS ──
// Cierra la oleada: enseña lo ganado y abre la tienda. ITEM_SHOPS y buyItem ya
// existian, pero solo se llegaba a la tienda abriendo la pausa en mitad de la
// accion, asi que practicamente nadie la usaba y las monedas se acumulaban sin
// tener donde gastarse.
let monedasAlEmpezarOleada = 0;

function abrirDescanso() {
  state = 'descanso';
  localStorage.setItem('dq_hi', hiScore);   // el record ya no se guarda por frame
  saveProgress();
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  playSound('boton');
  _hap('medium');
  // Limpiamos la pantalla de enemigos para que el descanso sea un respiro real.
  enemies.forEach(e => spawnPFX(e.x + e.w / 2, e.y + e.h / 2, '#00ff88', 8, 4));
  enemies = []; bullets = []; bossActive = false;

  const ganadas = sessionCoins - monedasAlEmpezarOleada;
  monedasAlEmpezarOleada = sessionCoins;

  let ov = $id('ov-descanso');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ov-descanso';
    ov.style.cssText = 'position:fixed;inset:0;z-index:58;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;background:rgba(5,5,16,.93);padding:16px;gap:8px';
    document.body.appendChild(ov);
  }
  pintarDescanso(ov, ganadas);
  ov.style.display = 'flex';
}

function pintarDescanso(ov, ganadas) {
  const b = currentBiome();
  ov.innerHTML =
    '<div style="font-size:.56rem;color:' + b.line + ';text-shadow:3px 3px 0 #000">OLEADA ' + (wave - 1) + ' SUPERADA</div>' +
    '<div style="font-size:.34rem;color:#ffe600;margin:2px 0 8px">🪙 +' + ganadas + '  ·  total ' + sessionCoins + '</div>' +
    '<div style="font-size:.26rem;color:rgba(255,255,255,.4);letter-spacing:.1em;margin-bottom:4px">TIENDA</div>' +
    '<div id="tienda-descanso" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;width:min(430px,94%)"></div>' +
    '<button id="seguir-descanso" style="margin-top:12px;width:min(430px,94%);min-height:56px;' +
    'background:linear-gradient(135deg,#00ff88,#00cc6a);color:#000;font-family:inherit;font-size:.42rem;' +
    'border:none;border-radius:8px;cursor:pointer;box-shadow:0 0 20px rgba(0,255,136,.4)">▶ OLEADA ' + wave + '</button>';

  const rejilla = ov.querySelector('#tienda-descanso');
  ITEM_SHOPS.forEach((it, i) => {
    const lleno = PL.items[i][0] >= it.maxStock;
    const puedo = sessionCoins >= it.price && !lleno;
    const btn = document.createElement('button');
    btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 6px;' +
      'background:' + (puedo ? 'rgba(0,255,136,.13)' : 'rgba(255,255,255,.05)') + ';' +
      'border:2px solid ' + (puedo ? 'rgba(0,255,136,.45)' : 'rgba(255,255,255,.12)') + ';' +
      'border-radius:6px;color:#fff;font-family:inherit;cursor:' + (puedo ? 'pointer' : 'default') + ';' +
      'opacity:' + (puedo ? '1' : '.55');
    btn.innerHTML = '<span style="font-size:.32rem;color:#00ff88">' + it.name + '</span>' +
      '<span style="font-size:.26rem;color:rgba(255,255,255,.55)">' +
      (lleno ? 'MAXIMO' : '🪙 ' + it.price) + '  ·  x' + PL.items[i][0] + '</span>';
    if (puedo) btn.onclick = () => { buyItem(i); playSound('boton'); pintarDescanso(ov, ganadas); };
    rejilla.appendChild(btn);
  });

  ov.querySelector('#seguir-descanso').onclick = () => {
    ov.style.display = 'none';
    state = 'playing';
    resetLoopClock();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    spawnFT(W / 2, 80, '— OLEADA ' + wave + ' —', '#ffe600', true);
  };
}

// ── ELEGIR MEJORA (pausa la partida y ofrece 3 al azar) ──
function ofrecerMejoras() {
  // Se podia morir en el MISMO frame en que se abria esta pantalla: quedaban
  // dos overlays superpuestos y al elegir la mejora seguias jugando con 0 de
  // vida detras de un GAME OVER, con el boton de revivir muerto.
  if (state !== 'playing') return;
  const disponibles = MEJORAS.slice();
  // Barajado sencillo; se permite repetir mejoras ya elegidas porque casi
  // todas son acumulables y repetir una es una decision valida.
  for (let i = disponibles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [disponibles[i], disponibles[j]] = [disponibles[j], disponibles[i]];
  }
  const opciones = disponibles.slice(0, 3);

  state = 'eligiendo';
  if (raf) { cancelAnimationFrame(raf); raf = null; }
  pauseMusic();
  playSound('levelup');
  _hap('heavy');

  let ov = $id('ov-mejora');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'ov-mejora';
    ov.className = 'ov';
    ov.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;background:rgba(5,5,16,.94);padding:16px;gap:10px';
    document.body.appendChild(ov);
  }
  ov.innerHTML =
    '<div style="font-size:.62rem;color:#c084fc;text-shadow:3px 3px 0 #000">NIVEL ' + runLevel + '</div>' +
    '<div style="font-size:.34rem;color:rgba(255,255,255,.5);margin-bottom:6px">ELIGE UNA MEJORA</div>' +
    opciones.map((m, i) =>
      '<button data-i="' + i + '" style="width:min(420px,92%);min-height:66px;display:flex;align-items:center;gap:12px;' +
      'background:linear-gradient(135deg,rgba(124,58,237,.28),rgba(0,255,136,.10));border:2px solid rgba(0,255,136,.45);' +
      'border-radius:8px;color:#fff;font-family:inherit;padding:10px 14px;cursor:pointer;text-align:left">' +
        '<span style="font-size:26px;line-height:1">' + m.icono + '</span>' +
        '<span><span style="font-size:.38rem;color:#00ff88">' + m.nombre + '</span><br>' +
        '<span style="font-size:.30rem;color:rgba(255,255,255,.65)">' + m.desc + '</span></span>' +
      '</button>').join('');

  ov.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      if (state !== 'eligiendo') { ov.style.display = 'none'; return; }
      const m = opciones[+b.dataset.i];
      try { m.usar(); } catch (e) {}
      mejorasElegidas.push(m.icono);
      spawnFT(PL.x, PL.y - 46, m.nombre, '#00ff88', true);
      showPUNotif(m.icono + ' ' + m.nombre + ' — ' + m.desc);
      ov.style.display = 'none';
      state = 'playing';
      playMusic();
      resetLoopClock();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
  });
  ov.style.display = 'flex';
}

// ── EL "CASI": el gancho que dispara la segunda partida ──
// Morir mostraba un número y nada más. El momento de máxima intención de
// reintentar es justo ese, y el juego no daba ninguna razón concreta. Todos
// estos datos ya estaban en memoria; solo había que decirlos.
function nearMissLines() {
  const out = [];
  if (nivel) {
    const tot = nivel.oleadas * WAVE_FRAMES;
    if (jefeInvocado) {
      const j = enemies.find(x => x.jefe);
      if (j) out.push('☠ Al jefe le quedaba un <b>' + Math.round(j.hp / j.maxHp * 100) + '%</b> de vida');
    } else out.push('🏁 Te faltaron <b>' + Math.max(1, Math.ceil((tot - waveTimer) / 60)) + ' s</b> para acabar la etapa ' + nivel.id);
    out.push('💡 Los avisos rojos del jefe dicen dónde va a golpear');
    return out;
  }
  const dHi = Math.ceil(hiScore - score);
  if (score < hiScore && dHi > 0 && dHi < Math.max(400, hiScore * .35)) {
    out.push('🎯 Te faltaron <b>' + dHi.toLocaleString() + '</b> pts para tu récord');
  }
  const nextWave = [5, 10, 15, 20, 30].find(w => wave < w);
  if (nextWave) out.push('🌊 Llegaste a la wave <b>' + wave + '</b> — la <b>' + nextWave + '</b> está cerca');
  const seen = biomesSeen();
  if (seen < BIOMES.length) {
    const nextBiomeWave = (Math.floor((wave - 1) / 3) + 1) * 3 + 1;
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
  // El jefe se queda (antes se borraba con el resto y la partida quedaba
  // atascada: bossActive seguia en true, la oleada congelada y la etapa sin
  // final). Vuelve a su pausa y se aleja para dar un respiro.
  enemies = enemies.filter(e => e.jefe && !e.muriendo);
  enemies.forEach(e => { e.jefe.estado = 'pausa'; e.jefe.t = 90; e.x = PL.x < W / 2 ? W - e.w - 40 : 40; e.y = GROUND - e.h; });
  bossActive = enemies.length > 0;
  bullets = [];
  spawnPFX(PL.x + PL.w / 2, PL.y + PL.h / 2, '#ff00cc', 35, 7, 6);
  spawnFT(PL.x, PL.y - 30, '💖 REVIVIDO!', '#ff00cc', true);
  showPUNotif('💖 SEGUNDA OPORTUNIDAD — ¡dale con todo!');
  _hap('heavy');
  const ov = $id('ov-dead'); if (ov) ov.classList.remove('show');
  updateHpHUD(); updateHUD();
  playMusic();
  state = 'playing';
  if (atraccionRaf) { cancelAnimationFrame(atraccionRaf); atraccionRaf = null; }
  // Un solo bucle vivo: reanudar sin cancelar el anterior duplicaba el rAF y
  // el juego se aceleraba tras varias pausas o revives.
  if (raf) cancelAnimationFrame(raf);
  resetLoopClock();
  raf = requestAnimationFrame(loop);
}

function toMenu() {
  hideAll();
  nivel = null;
  state = 'menu';
  arrancarAtraccion();
  cancelAnimationFrame(raf);
  state = 'menu';
  const ov = $id(DQE.menuOverlayId || 'ov-menu'); if (ov) ov.classList.add('show');
  try { DQE.onToMenu && DQE.onToMenu(); } catch (e) {}
}

function hideAll() {
  document.querySelectorAll('.ov').forEach(o => o.classList.remove('show'));
  // ov-descanso y ov-mejora se muestran con display inline (que le gana a la
  // regla .ov{display:none}): sin cerrarlos aqui quedaban abiertos encima del
  // menu o de la siguiente partida.
  const od = $id('ov-descanso'); if (od) od.style.display = 'none';
  const om = $id('ov-mejora'); if (om) om.style.display = 'none';
  ['ov-victoria', 'ov-niveles'].forEach(id => { const o = $id(id); if (o) o.style.display = 'none'; });
}

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
  if (e.code === 'Enter' && state === 'menu') jugar();
});
document.addEventListener('keyup', e => { keys[e.code] = false; });
cv.addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });
cv.addEventListener('click', () => { if (state === 'menu') jugar(); else if (state === 'playing') attack(); });

// ══ CONTROLES TÁCTILES DE 3 ZONAS ══
// El esquema anterior eran 5 botones en fila: el pulgar derecho tenia que
// servir a la marcha (▶), el ataque (⚔) y el dash (💨) con 129 px de recorrido
// entre extremos, y el dash perdia siempre esa subasta (de 0 usos por partida
// en novatos a 12,9 en pros, medido). Ademas el ataque —la accion mas pulsada,
// 322 veces en una partida pro— era el objetivo mas pequeno y mas lejano.
// Ahora cada pulgar tiene UNA casa:
//   · izquierdo: pad flotante (el origen es donde tocas; la distancia decide
//     parado/andar/correr, y un flick horizontal es dash — el dash es un
//     modificador de la DIRECCION, asi que vive en el pulgar del movimiento)
//   · derecho: dos circulos grandes; el ataque es el mayor y el mas cercano al
//     reposo del pulgar. El item solo aparece cuando de verdad hace falta.
(function () {
  const esTactil = matchMedia('(pointer:coarse)').matches &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  if (!esTactil) return;
  document.body.classList.add('ctl3');

  const css = document.createElement('style');
  css.textContent = `
  body.ctl3 #mbtns{display:none !important;}
  body.ctl3{justify-content:flex-start;}
  body.ctl-jugando #play-panel{overflow:hidden;pointer-events:none;}
  #ctl3{position:fixed;left:0;right:0;bottom:0;height:270px;z-index:35;pointer-events:none;display:none;}
  body.ctl-jugando #ctl3{display:block;}
  #ctl-pad{position:absolute;left:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));width:164px;height:186px;border-radius:18px;pointer-events:auto;touch-action:none;background:rgba(255,255,255,.025);border:1px solid rgba(0,255,136,.13);}
  #ctl-pad .pista{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:"Press Start 2P",monospace;font-size:8px;color:rgba(255,255,255,.18);letter-spacing:.1em;pointer-events:none;}
  #ctl-base{position:absolute;width:68px;height:68px;margin:-34px 0 0 -34px;border-radius:50%;border:2px solid rgba(0,255,136,.35);background:rgba(0,255,136,.05);display:none;pointer-events:none;}
  #ctl-nub{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(0,255,136,.55);box-shadow:0 0 10px rgba(0,255,136,.5);display:none;pointer-events:none;}
  .ctl-btn{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;border:2px solid;display:flex;align-items:center;justify-content:center;font-family:"Press Start 2P",monospace;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;padding:0;transition:transform .06s;}
  .ctl-btn:active{transform:scale(.92);}
  #ctl-atk{right:13px;bottom:calc(34px + env(safe-area-inset-bottom,0px));width:112px;height:112px;font-size:34px;background:rgba(255,230,0,.13);border-color:rgba(255,230,0,.5);color:#ffe600;box-shadow:0 0 18px rgba(255,230,0,.2);}
  #ctl-jmp{right:95px;bottom:calc(148px + env(safe-area-inset-bottom,0px));width:96px;height:96px;font-size:26px;background:rgba(0,255,136,.13);border-color:rgba(0,255,136,.5);color:#00ff88;box-shadow:0 0 16px rgba(0,255,136,.2);}
  #ctl-item{right:6px;bottom:calc(192px + env(safe-area-inset-bottom,0px));width:68px;height:68px;background:rgba(0,238,255,.13);border-color:rgba(0,238,255,.55);box-shadow:0 0 14px rgba(0,238,255,.3);display:none;}
  #ctl-item img{width:38px;height:38px;image-rendering:pixelated;pointer-events:none;}`;
  document.head.appendChild(css);

  const capa = document.createElement('div');
  capa.id = 'ctl3';
  capa.innerHTML =
    '<div id="ctl-pad"><div class="pista">◂ MOVER ▸</div><div id="ctl-base"></div><div id="ctl-nub"></div></div>' +
    '<button class="ctl-btn" id="ctl-jmp">▲</button>' +
    '<button class="ctl-btn" id="ctl-atk">⚔</button>' +
    '<button class="ctl-btn" id="ctl-item"><img alt=""></button>';
  document.body.appendChild(capa);

  const pad = $id('ctl-pad'), base = $id('ctl-base'), nub = $id('ctl-nub');
  const btnItem = $id('ctl-item'), imgItem = btnItem.querySelector('img');

  // ── PAD: origen relativo al dedo, zonas por distancia, dash por flick ──
  let padId = null, origen = null, rectPad = null, hist = [];

  function pintarStick(dx) {
    base.style.left = (origen.x - rectPad.left) + 'px';
    base.style.top = (origen.y - rectPad.top) + 'px';
    nub.style.left = (origen.x - rectPad.left + dx) + 'px';
    nub.style.top = (origen.y - rectPad.top) + 'px';
  }

  function soltarPad() {
    padId = null; origen = null; hist = [];
    setMove(0);
    base.style.display = 'none'; nub.style.display = 'none';
  }

  pad.addEventListener('touchstart', e => {
    e.preventDefault();
    if (padId !== null) return;
    const t = e.changedTouches[0];
    padId = t.identifier;
    rectPad = pad.getBoundingClientRect();
    origen = { x: t.clientX, y: t.clientY };
    hist = [{ x: t.clientX, t: performance.now() }];
    base.style.display = 'block'; nub.style.display = 'block';
    pintarStick(0);
  }, { passive: false });

  // preventDefault en touchmove es OBLIGATORIO: sin el, el arrastre vertical
  // hace scroll de la pagina en mitad de la pelea.
  pad.addEventListener('touchmove', e => {
    e.preventDefault();
    if (padId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== padId) continue;
      const ahora = performance.now();
      hist.push({ x: t.clientX, t: ahora });
      while (hist.length > 1 && ahora - hist[0].t > 150) hist.shift();
      // FLICK = dash: mas de 55 px recorridos en menos de 140 ms.
      const viejo = hist[0];
      if (state === 'playing' && !PL.dashing && PL.dashCd <= 0 &&
          Math.abs(t.clientX - viejo.x) > 55 && ahora - viejo.t < 140) {
        PL.facing = t.clientX > viejo.x ? 1 : -1;   // el flick manda la direccion
        dash();                                      // dash() confirma con haptica media
        origen.x = t.clientX; origen.y = t.clientY;  // reanclar: se sigue corriendo
        hist = [{ x: t.clientX, t: ahora }];
      }
      // El origen persigue al dedo si se aleja mas de 60 px: asi invertir la
      // marcha responde al instante en vez de exigir volver al punto inicial.
      let dx = t.clientX - origen.x;
      if (Math.abs(dx) > 60) { origen.x = t.clientX - 60 * Math.sign(dx); dx = 60 * Math.sign(dx); }
      const adx = Math.abs(dx);
      // zona muerta ≤12 · andar 12..34 · correr >34
      setMove(adx <= 12 ? 0 : (adx <= 34 ? .5 : 1) * Math.sign(dx));
      pintarStick(dx);
    }
  }, { passive: false });

  ['touchend', 'touchcancel'].forEach(ev => pad.addEventListener(ev, e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === padId) soltarPad();
  }, { passive: false }));

  // ── BOTONES ──
  function alTocar(el, fn) {
    el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener('mousedown', e => { e.preventDefault(); fn(); });
  }
  alTocar($id('ctl-jmp'), jump);
  alTocar($id('ctl-atk'), attack);
  alTocar(btnItem, () => { if (_slotCtx >= 0) useItem(_slotCtx); });

  // ── ITEM CONTEXTUAL + VISIBILIDAD ──
  // El boton de item solo existe cuando hay algo usable Y la situacion lo
  // pide: vida baja, jefe en pantalla o la pantalla llena. El resto del tiempo
  // no roba espacio ni atencion.
  const CLAVES_ITEM = ['item_potion', 'item_shield', 'item_skill', 'skill_fire'];
  function slotContextual() {
    const listo = i => PL.items[i][0] > 0 && PL.items[i][1] <= 0;
    if (PL.hp < 40 && listo(0)) return 0;   // primero curarse
    if (listo(2)) return 2;                 // rayo: limpia la pantalla
    if (listo(1)) return 1;                 // escudo
    if (listo(3)) return 3;                 // fuego
    return listo(0) ? 0 : -1;
  }
  let _slotCtx = -1, _jugando = false, _bloqueado = false;
  setInterval(() => {
    const jugando = state === 'playing';
    if (jugando !== _jugando) {
      _jugando = jugando;
      document.body.classList.toggle('ctl-jugando', jugando);
      if (!jugando) soltarPad();
    }
    // Mientras la partida vive (jugando o en sus pausas) la pagina no puede
    // hacer scroll: en la Mini App el html/body llevan overflow-y:auto y un
    // arrastre movia la pagina entera en mitad de la pelea.
    const bloquear = jugando || state === 'paused' || state === 'descanso' || state === 'eligiendo';
    if (bloquear !== _bloqueado) {
      _bloqueado = bloquear;
      document.documentElement.style.overflow = bloquear ? 'hidden' : '';
      document.body.style.overflow = bloquear ? 'hidden' : '';
    }
    const urgencia = jugando && (PL.hp < 40 || bossActive || enemies.length >= 6);
    const s = urgencia ? slotContextual() : -1;
    if (s !== _slotCtx) {
      _slotCtx = s;
      if (s < 0) { btnItem.style.display = 'none'; }
      else { imgItem.src = IMG[CLAVES_ITEM[s]]; btnItem.style.display = 'flex'; }
    }
  }, 150);
})();

// Arrancar el mundo del menu en cuanto la pagina y las imagenes esten listas.
window.addEventListener('load', () => { if (state === 'menu') arrancarAtraccion(); });
