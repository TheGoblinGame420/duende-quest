// ═══════════════════════════════════════════════════════
// Paso 1 del video promocional: graba tomas REALES del juego.
//
//   node tools/promo/grabar.mjs                    (todas las tomas)
//   node tools/promo/grabar.mjs mazmorra,arcade    (solo esas tomas)
//
// Levanta su propio servidor local del MMO (tools/mmo_local.mjs en el puerto
// 8796, mundo nuevo en promo/_trabajo/), abre Chrome sin ventana en vertical
// (540x960 CSS a 2x = 1080x1920 reales), prepara cada escena con /__dev
// (niveles, monstruos, grupo, mazmorra, duelo, temporada) y deja que un
// "cerebro" juegue con las teclas del juego. Cada toma sale en
// promo/_trabajo/tomas/<id>.mp4 (30 fps constantes). El arcade se graba en
// horizontal (1920x1080).
//
// Solo hay UN Chrome abierto a la vez (el que graba): los demas personajes
// (compañeros de mazmorra, gente del pueblo, el rival del duelo) son
// clientes WebSocket ligeros que el servidor mueve con los mismos mensajes que
// manda el juego ('mv', 'hab', 'atk', 'chat'). Con varios Chrome a 2x el
// portatil grababa a 5-15 fps.
//
// Ajustes SOLO de este servidor de grabacion (nada toca el juego publicado ni
// el servidor :8787):
//  - el daño que reciben los jugadores baja al 20% (nadie muere a mitad de
//    una toma) y nadie queda "inactivo";
//  - las tomas de temporada adelantan el reloj del servidor a la fecha real
//    del evento (Noche de Duendes 25-oct / Navidad 18-dic, data.js TEMPORADAS);
//  - la de chicha trata a los personajes como cuentas de Telegram (a los
//    invitados no les suma puntos) y oculta el aviso de invitado del panel.
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { iniciarServidor, navegador, entrar, cerebro, grabar, limpiar, esperar, TRABAJO } from './lib.mjs';

const FILTROS = (process.argv[2] || '').split(',').filter(Boolean);
const vale = id => !FILTROS.length || FILTROS.some(f => id.includes(f));
const quiere = (...ids) => ids.some(vale);
const TOMAS = path.join(TRABAJO, 'tomas');
fs.mkdirSync(TOMAS, { recursive: true });

const srv = await iniciarServidor(8796);
const dev = srv.dev;
const log = (...a) => console.log('[grabar]', ...a);
const abiertos = new Set();   // navegadores y bots, para cerrarlos al final

function aClip(id, dirFotos) {
  const out = path.join(TOMAS, id + '.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dirFotos, 'lista.txt'),
    '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-an', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg falló en la toma ' + id);
  fs.rmSync(dirFotos, { recursive: true, force: true });
}
// Graba una toma. Antes, 2,5 s de "calentamiento" (la primera grabacion tras
// cargar sale lenta) y luego op.prep (lo que debe empezar justo al grabar).
// Si sale a menos de 24 fps se repite (op.repetir deja la escena como al
// principio).
async function toma(id, nav, ms, op = {}) {
  if (!vale(id)) return;
  const dir = path.join(TRABAJO, 'fotos_' + id);
  for (let intento = 1; intento <= 3; intento++) {
    await grabar(nav, dir + '_calienta', 2500);
    fs.rmSync(dir + '_calienta', { recursive: true, force: true });
    await limpiar(nav, !op.panel);
    if (op.prep) await op.prep();
    const r = await grabar(nav, dir, ms, op);
    log(id, r.fotos + ' fotos', r.segundos.toFixed(1) + ' s', r.fps.toFixed(1) + ' fps', intento > 1 ? '(intento ' + intento + ')' : '');
    if (r.fps >= 24 || intento === 3) break;
    if (op.repetir) await op.repetir();
    await esperar(1000);
  }
  aClip(id, dir);
}

// ── Personajes ──
async function abrir(nombre, clase, op) {
  const nav = await navegador(op);
  abiertos.add(nav);
  await entrar(nav, srv.base, nombre, clase);
  return nav;
}
async function cerrar(x) { abiertos.delete(x); await x.cerrar(); await esperar(400); }
// Personaje sin navegador: un WebSocket que dice 'hola' como el juego.
async function bot(nombre, clase) {
  const ws = new WebSocket(srv.base.replace('http', 'ws') + '/mmo/ws');
  await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
  let listo;
  const bien = new Promise(r => { listo = r; });
  ws.onmessage = ev => { try { if (JSON.parse(ev.data).t === 'bienvenido') listo(); } catch (e) {} };
  ws.send(JSON.stringify({ t: 'hola', auth: { k: 'inv', tok: crypto.randomBytes(16).toString('hex') }, nombre }));
  await Promise.race([bien, esperar(10000)]);
  ws.send(JSON.stringify({ t: 'clase', id: clase }));
  await esperar(300);
  const b = { cerrar: async () => { try { ws.close(); } catch (e) {} } };
  abiertos.add(b);
  return b;
}

// ── Ayudas del servidor ──
const S = n => `jug(${JSON.stringify(n)})`;
async function nivel(n, nv) {
  await dev(`(()=>{const s=${S(n)};s.c.nivel=${nv};s.c.xp=0;s.c.oro=Math.max(s.c.oro,5000);mundo.recalcular(s);s.hp=s.st.maxHp;s.rec=s.st.recMax;mundo.actualizarYo(s);return s.c.nivel})()`);
}
async function aMapa(n, mapa, x) { await dev(`(()=>{const s=${S(n)};mundo.entrarMapa(s,'${mapa}',${x});return 1})()`); }
async function curar(n) { await dev(`(()=>{const s=${S(n)};if(s.muerto)mundo.revivir(s);s.hp=s.st.maxHp;s.rec=s.st.recMax;mundo.actualizarYo(s);return 1})()`); }
// Monstruos agresivos alrededor del jugador.
async function monstruos(n, tipos, cuantos, dx0, paso, nv) {
  await dev(`(()=>{const s=${S(n)};const t=${JSON.stringify(tipos)};for(let i=0;i<${cuantos};i++)mundo.crearMonstruo(s.k,t[i%t.length],Math.round(s.x+${dx0}+i*${paso}),{nv:${nv},agresivo:true,radioAgro:400});return 1})()`);
}
// Quita los monstruos del mapa del jugador (menos los jefes de zona).
async function vaciar(n) {
  await dev(`(()=>{const s=${S(n)};const w=mundo.mundoK(s.k);for(const o of [...w.mons.values()]){if(o.jefe&&!o.mazmorra)continue;w.mons.delete(o.id);mundo.aClave(s.k,{t:'md',id:o.id,pr:[]});}return 1})()`);
}
// Lleva a alguien a un mapa, limpia la zona y pone monstruos.
async function escenaCaza(n, nav, mapa, x, tipos, cuantos, nv) {
  await aMapa(n, mapa, x);
  await esperar(1500); await limpiar(nav);
  const prep = async () => { await vaciar(n); await curar(n); await monstruos(n, tipos, cuantos, 130, 58, nv); };
  await prep();
  return prep;
}
const tecla = (nav, code) => nav.js(`dispatchEvent(new KeyboardEvent('keydown',{code:'${code}',bubbles:true}))`);

try {
  await dev(`(()=>{if(mundo.__promo)return 1;mundo.__promo=1;const h=mundo.herir;mundo.herir=function(s,d,f){return h.call(this,s,Math.max(1,Math.round(d*0.2)),f)};const vivos=()=>{for(const s of mundo.sesiones.values())s.actT=Date.now()};globalThis.__vivos=vivos;setInterval(vivos,5000);return 1})()`);

  // ── 1. AMARU (mago): gancho, su toma de clase y la chicha ──
  if (quiere('gancho', 'clase_mago', 'chicha')) {
    const amaru = await abrir('Amaru', 'mago');
    await nivel('Amaru', 60);
    if (quiere('gancho')) {
      const prep = await escenaCaza('Amaru', amaru, 'acantilados', 1200, ['paladin_goblin', 'aguila', 'zarigueya', 'fantasma_halo'], 7, 45);
      await cerebro(amaru, { modo: 'cazar', habs: [7, 1, 0, 2, 7], ritmo: 450, dist: 200 });
      await toma('gancho', amaru, 7000, { repetir: prep });
      await cerebro(amaru, { modo: 'nada' });
    }
    if (quiere('clase_mago')) {
      const prep = await escenaCaza('Amaru', amaru, 'tormenta', 1300, ['goblin_mage', 'esqueleto_arcano', 'ghoul_ardiente'], 5, 40);
      await cerebro(amaru, { modo: 'cazar', habs: [0, 2, 1, 7, 0], ritmo: 500, dist: 220 });
      await toma('clase_mago', amaru, 5500, { repetir: prep });
      await cerebro(amaru, { modo: 'nada' });
    }
    if (quiere('chicha')) {
      // Cazar suma puntos (+🥤 sobre cada presa) y el panel del premio.
      await dev(`(()=>{mundo.elegibilidad=c=>({cuenta:true,nivel:c.nivel>=15,edad:true});const s=${S('Amaru')};s.c.chicha={p:7346,d:'',hoy:0,rec:[]};mundo.actualizarYo(s);return 1})()`);
      const prep = await escenaCaza('Amaru', amaru, 'acantilados', 1500, ['zarigueya', 'paladin_goblin', 'aguila'], 6, 60);
      await cerebro(amaru, { modo: 'cazar', habs: [7, 1, 0, 0, 2], ritmo: 450, dist: 200 });
      await toma('chicha_caza', amaru, 6000, { repetir: prep });
      await cerebro(amaru, { modo: 'nada', panel: true });
      await esperar(400);
      await amaru.js(`(()=>{document.querySelectorAll('.modal.on').forEach(m=>m.classList.remove('on'));document.getElementById('b-inv').click();return 1})()`);
      await esperar(600);
      await amaru.js(`(()=>{document.querySelector('[data-itab=chicha]').click();const st=document.getElementById('promo-css');st.textContent+='#inv-lista .seguridad{display:none!important}';return 1})()`);
      await esperar(700);
      await toma('chicha_panel', amaru, 3000, { panel: true });
    }
    await cerrar(amaru);
  }

  // ── 2. CLASES: sacerdote y pícaro (el guerrero va con la mazmorra) ──
  for (const [id, n, clase, mapa, tipos, br] of [
    ['clase_sacerdote', 'Killa', 'sacerdote', 'castillo', ['guardia_real', 'caballero_negro', 'hechicero_corte'], { habs: [0, 3, 0, 1, 6], ritmo: 550, dist: 220 }],
    ['clase_picaro', 'Sombra', 'picaro', 'amanecer', ['goblin_knight', 'goblin_guard', 'goblin_peasant'], { habs: [0, 1, 4, 0], ritmo: 420 }],
  ]) {
    if (!quiere(id)) continue;
    const nav = await abrir(n, clase);
    await nivel(n, 60);
    const prep = await escenaCaza(n, nav, mapa, 1300, tipos, 5, 40);
    await cerebro(nav, { modo: 'cazar', ...br });
    await toma(id, nav, 5500, { repetir: prep });
    await cerrar(nav);
  }

  // ── 3. KUNTUR (guerrero): su toma de clase, la mazmorra y los sets ──
  if (quiere('clase_guerrero', 'mazmorra', 'sets')) {
    const kuntur = await abrir('Kuntur', 'guerrero');
    await nivel('Kuntur', 60);
    if (quiere('clase_guerrero')) {
      const prep = await escenaCaza('Kuntur', kuntur, 'desierto', 1300, ['goblin_samurai', 'lagarto', 'serpiente'], 5, 40);
      await cerebro(kuntur, { modo: 'cazar', habs: [4, 0, 3, 4, 0], ritmo: 500 });
      await toma('clase_guerrero', kuntur, 5500, { repetir: prep });
      await cerebro(kuntur, { modo: 'nada' });
    }
    // Mazmorra: los cuatro en grupo contra el Dragón Carmesí. Graba el
    // guerrero (cuerpo a cuerpo: el jefe se ve enorme); sus compañeros son
    // bots que el servidor hace jugar.
    if (quiere('mazmorra')) {
      const equipo = [['Amaru', 'mago'], ['Killa', 'sacerdote'], ['Sombra', 'picaro']];
      const bots = [];
      for (const [n, c] of equipo) { bots.push(await bot(n, c)); await nivel(n, 60); }
      for (const n of ['Kuntur', 'Amaru', 'Killa', 'Sombra']) { await aMapa(n, 'pueblo', 795); await curar(n); }
      await esperar(1500);
      await dev(`(()=>{const l=${S('Kuntur')};for(const n of ['Amaru','Killa','Sombra']){const t=jug(n);mundo.invitar(l,{p:t.id});mundo.respuestaGrupo(t,{si:true});}return 1})()`);
      // El líder entra desde su cliente, como un jugador (los del grupo junto al portal entran con él).
      await kuntur.js(`__dq.mandar({t:'mazmorra',id:'ciudadela'})`);
      await esperar(1500);
      log('mazmorra:', await dev(`['Amaru','Kuntur','Killa','Sombra'].map(n=>n+':'+jug(n).k+'@'+Math.round(jug(n).x)).join(' ')`));
      for (const n of ['Amaru', 'Killa', 'Sombra']) {
        if ((await dev(`${S(n)}.k`)).includes('#')) continue;
        await aMapa(n, 'pueblo', 795); await esperar(600);
        log('mazmorra (tarde):', n, await dev(`(()=>{mundo.entrarMazmorra(${S(n)},{id:'ciudadela'});return ${S(n)}.k})()`));
      }
      // Directo a la sala del jefe final: sin barreras ni grupos por el camino.
      const sala = async () => log('dragón:', await dev(`(()=>{const l=${S('Kuntur')};const w=mundo.mundoK(l.k);w.muros=[4200];mundo.aClave(l.k,{t:'muros',muros:w.muros,hechos:2});
        for(const o of [...w.mons.values()]){if(o.k==='mz_dragon'&&!o.muere)continue;w.mons.delete(o.id);mundo.aClave(l.k,{t:'md',id:o.id,pr:[]});}
        let d=[...w.mons.values()].find(o=>o.k==='mz_dragon');
        if(!d){d=mundo.crearMonstruo(l.k,'mz_dragon',3950,{nv:62,hpX:150,atkX:1.2,agresivo:true,radioAgro:400,mazmorra:true,jefeMaz:2});d.final=true;d.atk0=d.atk;d.vel0=d.vel;}
        d.hp=Math.round(d.max*0.2);
        const xs={Kuntur:3820,Sombra:3850,Amaru:3600,Killa:3560};for(const n in xs){const s=jug(n);if(!s)continue;if(s.muerto)mundo.revivir(s);mundo.entrarMapa(s,s.c.mapa,xs[n],false,s.k);s.hp=s.st.maxHp;s.rec=s.st.recMax;}
        return d.hp+'/'+d.max})()`));
      await sala();
      await esperar(1500);
      await dev(`(()=>{clearInterval(globalThis.__equipo);const H={Amaru:['bola_fuego','misiles','meteoros','bola_fuego'],Killa:['castigo','dolor','renovar','escudo_poder'],Sombra:['siniestro','siniestro','eviscerar','abanico']};
        const R=(s,o)=>Promise.resolve(mundo.recibir(s,JSON.stringify(o))).catch(()=>{});
        globalThis.__equipo=setInterval(()=>{const l=jug('Kuntur');if(!l)return;const w=mundo.mundoK(l.k);const d=[...w.mons.values()].find(o=>o.k==='mz_dragon'&&!o.muere);if(!d)return;
          for(const n in H){const s=jug(n);if(!s||s.muerto||s.k!==l.k)continue;s.cuenta=0;s.f=d.x>s.x?1:-1;
            if(n==='Sombra'&&Math.abs(d.x-s.x)>90){s.movT=Date.now()-100;R(s,{t:'mv',x:Math.round(s.x+Math.sign(d.x-s.x)*30),y:400,f:s.f,a:1});}
            const id=H[n][Math.floor(Math.random()*H[n].length)];const aliado=id==='renovar'||id==='escudo_poder';
            R(s,{t:'hab',id,tg:aliado?l.id:d.id});
            if(n==='Sombra')R(s,{t:'atk',s:(s.__p=((s.__p||0)+1)%3),tg:d.id});}
        },380);return 1})()`);
      await cerebro(kuntur, { modo: 'cazar', habs: [0, 3, 4, 2, 5], ritmo: 450 });
      await toma('mazmorra', kuntur, 11000, { repetir: sala, prep: () => kuntur.js(`document.getElementById('chat-log').innerHTML=''`) });
      await dev(`(()=>{clearInterval(globalThis.__equipo);for(const n of ['Amaru','Kuntur','Killa','Sombra']){const s=jug(n);if(s)mundo.salirGrupo(s);}return 1})()`);
      await cerebro(kuntur, { modo: 'nada' });
      for (const b of bots) await cerrar(b);
    }
    // Sets: el panel de equipo con el conjunto «Escamas del Dragón» puesto.
    if (quiere('sets')) {
      await dev(`(()=>{const s=${S('Kuntur')};const mk=(sl,b)=>({id:Math.random().toString(36).slice(2,10),s:sl,nv:60,r:3,b,cj:'ciudadela'});
        s.c.eq={casco:mk('casco',{def:20,hp:150,atk:9}),armadura:mk('armadura',{def:31,hp:230}),botas:mk('botas',{def:13,hp:110,crit:0.03}),amuleto:mk('amuleto',{atk:15,hp:190,crit:0.02})};
        mundo.recalcular(s);return 1})()`);
      await cerebro(kuntur, { modo: 'nada', panel: true });
      await aMapa('Kuntur', 'pueblo', 1150);
      await esperar(1200); await limpiar(kuntur);
      await kuntur.js(`(()=>{document.getElementById('b-inv').click();return 1})()`);
      await esperar(600);
      await kuntur.js(`(()=>{document.querySelector('[data-itab=equipo]').click();return 1})()`);
      await esperar(700);
      await toma('sets', kuntur, 3000, { panel: true });
    }
    await cerrar(kuntur);
  }

  // ── 4. ONLINE: el pueblo con gente, chat y un duelo (graba Sombra) ──
  if (quiere('online')) {
    const sombra = await abrir('Sombra', 'picaro');
    await nivel('Sombra', 60);
    const gente = [['Kuntur', 'guerrero', 60], ['Amaru', 'mago', 60], ['Killa', 'sacerdote', 60], ['Wayra', 'guerrero', 32], ['Ñusta', 'sacerdote', 41], ['Inti', 'mago', 27]];
    const bots = [];
    for (const [n, c, nv] of gente) { bots.push(await bot(n, c)); await nivel(n, nv); }
    const pos = { Sombra: 1040, Kuntur: 1150, Amaru: 900, Killa: 1290, Wayra: 820, 'Ñusta': 1360, Inti: 980 };
    const prep = async () => {
      for (const n in pos) { await aMapa(n, 'pueblo', pos[n]); await curar(n); }
      await esperar(1500);
      await limpiar(sombra);
      await dev(`(()=>{for(const n of ['Kuntur','Sombra']){const s=jug(n);s.duelo=null;s.retoDuelo=null;s.retosT={};s.combateT=0;}mundo.retarDuelo(${S('Kuntur')},{p:${S('Sombra')}.id});mundo.respuestaDuelo(${S('Sombra')},{si:true});return !!${S('Sombra')}.duelo})()`);
    };
    await prep();
    // El rival (bot) pelea desde el servidor: se acerca y pega/usa habilidades.
    await dev(`(()=>{clearInterval(globalThis.__rival);const R=(s,o)=>Promise.resolve(mundo.recibir(s,JSON.stringify(o))).catch(()=>{});
      globalThis.__rival=setInterval(()=>{const k=jug('Kuntur'),s=jug('Sombra');if(!k||!s||k.muerto)return;k.cuenta=0;const dx=s.x-k.x;k.f=dx>0?1:-1;
        if(Math.abs(dx)>60){k.movT=Date.now()-100;R(k,{t:'mv',x:Math.round(k.x+Math.sign(dx)*24),y:400,f:k.f,a:1});}
        else{R(k,{t:'atk',s:(k.__p=((k.__p||0)+1)%3),tg:s.id,tk:'p'});if(Math.random()<0.3)R(k,{t:'hab',id:Math.random()<0.5?'golpe_heroico':'zurrar',tg:s.id});}
      },300);return 1})()`);
    const charla = async () => {
      const frases = [['Wayra', '¿Alguien para la Ciudadela?'], ['Ñusta', '¡Yo curo! 💚'], ['Inti', '¡Vamos Kuntur!'], ['Killa', 'Sombra gana 😎'], ['Amaru', 'gg']];
      for (const [n, m] of frases) { await dev(`(()=>{const s=${S(n)};s.chatT=0;mundo.chat(s,{canal:'decir',m:${JSON.stringify(m)}});return 1})()`); await esperar(1100); }
    };
    await cerebro(sombra, { modo: 'jugador', rival: 'Kuntur', habs: [0, 1], ritmo: 500 });
    await toma('online', sombra, 9000, { antes: () => { charla(); }, repetir: prep });
    await dev(`(()=>{clearInterval(globalThis.__rival);return 1})()`);
    await cerebro(sombra, { modo: 'nada' });
    for (const b of bots) await cerrar(b);
    await cerrar(sombra);
  }

  // ── 5. TEMPORADA + MONTURAS: Noche de Duendes 🎃 y Navidad 🎄 ──
  // Se adelanta el reloj de ESTE servidor a la fecha del evento (siempre
  // hacia delante: atrasarlo dejaria esperas de dias en los cooldowns).
  const fecha = async iso => dev(`(()=>{const o=globalThis.__ahoraReal||(globalThis.__ahoraReal=Date.now);const off=Date.parse('${iso}')-o();if(Date.now()<o()+off)Date.now=()=>o()+off;globalThis.__vivos();for(const s of mundo.sesiones.values())if(s.c)mundo.actualizarYo(s);return new Date(Date.now()).toISOString()})()`);
  const montar = async (n, nav, montura) => {
    await dev(`(()=>{const s=${S(n)};s.c.montura='${montura}';s.c.monturas=['${montura}'];s.combateT=0;mundo.actualizarYo(s);return 1})()`);
    await esperar(400);
    await tecla(nav, 'KeyY');
    await esperar(2000);
    log('montado:', n, await dev(`${S(n)}.montado||'no'`));
  };
  if (quiere('halloween')) {
    await fecha('2026-10-27T18:00:00Z');
    const amaru = await abrir('Amaru', 'mago');
    await nivel('Amaru', 60);
    await aMapa('Amaru', 'acantilados', 300);
    await esperar(1500); await limpiar(amaru); await vaciar('Amaru');
    await montar('Amaru', amaru, 'dragon');
    await toma('halloween_montura', amaru, 3200, {
      prep: () => cerebro(amaru, { modo: 'andar', dir: 1, saltar: 1700 }),
      repetir: async () => { await cerebro(amaru, { modo: 'nada' }); await aMapa('Amaru', 'acantilados', 300); await esperar(1200); },
    });
    await cerebro(amaru, { modo: 'nada' });
    // Caza con calabazas: con el evento los monstruos sueltan 🎃.
    await tecla(amaru, 'KeyY');
    await esperar(500);
    await aMapa('Amaru', 'acantilados', 1150);   // la montura corre: puede haber cruzado el portal del final
    await esperar(1200);
    const prep = async () => { await vaciar('Amaru'); await curar('Amaru'); await monstruos('Amaru', ['zarigueya', 'aguila'], 6, 140, 50, 30); };
    await prep();
    await cerebro(amaru, { modo: 'cazar', habs: [7, 1, 0, 0], ritmo: 420, dist: 200 });
    await toma('halloween_caza', amaru, 6000, { repetir: prep });
    await cerrar(amaru);
  }
  if (quiere('navidad')) {
    await fecha('2026-12-21T18:00:00Z');
    const sombra = await abrir('Sombra', 'picaro');
    await nivel('Sombra', 60);
    await aMapa('Sombra', 'pueblo', 300);
    await esperar(1500); await limpiar(sombra);
    await montar('Sombra', sombra, 'hellhound');
    await toma('navidad_montura', sombra, 4000, {
      prep: () => cerebro(sombra, { modo: 'andar', dir: 1, saltar: 2100 }),
      repetir: async () => { await cerebro(sombra, { modo: 'nada' }); await aMapa('Sombra', 'pueblo', 300); await esperar(1200); },
    });
    await cerrar(sombra);
  }

  // ── 6. ARCADE: unos segundos del modo arcade (horizontal, 1920x1080) ──
  if (quiere('arcade')) {
    const nav = await navegador({ ancho: 960, alto: 540, escala: 2, movil: false });
    abiertos.add(nav);
    await nav.ir(srv.base + '/game.html');
    await esperar(3000);
    // Sin el precio del token en el HUD: el video es del juego.
    await nav.js(`(()=>{[...document.querySelectorAll('.hl')].forEach(e=>{if(/DUENDE/.test(e.textContent))e.parentElement.style.visibility='hidden'});return 1})()`);
    await nav.js(`jugar()`);
    await esperar(2500);
    await nav.js(`(()=>{const k=(c,on)=>document.dispatchEvent(new KeyboardEvent(on?'keydown':'keyup',{code:c,bubbles:true}));let t=0;window.__arc=setInterval(()=>{t++;k('ArrowRight',(t%40)<28);k('ArrowLeft',(t%40)>=30);k('KeyZ',true);setTimeout(()=>k('KeyZ',false),40);if(t%9===0){k('Space',true);setTimeout(()=>k('Space',false),60);}if(t%23===0){k('KeyX',true);setTimeout(()=>k('KeyX',false),60);}},110);return 1})()`);
    await toma('arcade', nav, 6000);
    await cerrar(nav);
  }
  log('listo: tomas en', TOMAS);
} finally {
  for (const x of abiertos) await x.cerrar().catch(() => {});
  srv.cerrar();
}
