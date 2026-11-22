// ═══════════════════════════════════════════════════════
// TEMA GLOBAL: copia css/tema.css (los colores de todo el sitio) dentro de cada
// pagina, en un <style id="dq-tema"> justo antes de </head>, seguido del
// «puente» de esa pagina: sus nombres de siempre (--bg, --panel, --pri, --oro…)
// apuntando a los del tema. Asi cada pagina conserva su CSS y todas comparten
// una sola paleta sin pedir un archivo mas.
//
//   node tools/tema.mjs               copia el tema en todas las paginas
//   node tools/tema.mjs --comprobar   falla si alguna pagina tiene una copia vieja
//   node tools/tema.mjs --retinte [--probar]
//        (una sola vez por archivo nuevo) pasa a la gama esmeralda los fondos,
//        grises y lavandas frios que estan escritos a mano en el CSS.
// ═══════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const args = new Set(process.argv.slice(2));

// ── Puentes: nombres viejos de cada pagina → nombres del tema ──
const COMUN = '--bg:var(--bg-dark);--panel:var(--surface);--panel2:var(--surface-2);--borde:var(--border);'
  + '--txt:var(--text);--txt2:var(--text-2);--txt3:var(--text-3);'
  + '--pri:var(--primary-strong);--pri2:var(--primary-deep);--pri-txt:var(--primary-soft);'
  + '--ok:var(--success);--warn:var(--warning);--err:var(--danger);'
  + '--oro:var(--accent);--oro2:var(--accent-strong);--oro-tinta:var(--accent-ink);'
  + '--verde:var(--success);--green:var(--success);--amarillo:var(--accent);--yellow:var(--accent);'
  + '--rosa:var(--secondary);--purple:var(--secondary);--pink:var(--secondary);'
  + '--cian:var(--primary-soft);--cyan:var(--primary-soft);--rojo:var(--danger);--red:var(--danger);'
  + '--dark:var(--bg-dark);--card:var(--surface);--sombra:var(--shadow);';
const PUENTES = {
  'index.html': COMUN + '--marco:var(--border-gold);',
  'mmo/index.html': COMUN,
  'telegram/index.html': COMUN,
  'game.html': COMUN,
  'guia.html': COMUN, 'novedades.html': COMUN, 'seguridad.html': COMUN, 'terminos.html': COMUN, 'privacidad.html': COMUN, 'reembolsos.html': COMUN,
  // ORIGINS: sus paneles son de vidrio sobre el mundo 3D y su --cian es el azul de la informacion.
  'mundo/index.html': '--bg:var(--bg-dark);--panel:var(--glass);--borde:var(--border-soft);--txt:var(--text);--txt2:var(--text-2);--txt3:var(--text-3);'
    + '--ok:var(--success);--err:var(--danger);--warn:var(--warning);--oro:var(--accent);--oro2:var(--accent-strong);'
    + '--pri:var(--primary-strong);--cian:var(--info);--marco:var(--border-gold);--vidrio:var(--glass-soft);',
  'mundo/galeria.html': '',
  'jugar/index.html': '--bg:var(--bg-dark);--txt:var(--text);--txt2:var(--text-2);--oro:var(--accent);--mor:var(--primary-soft);--ros:var(--accent);',
  'inicio/index.html': '--bg:var(--bg-dark);--txt:var(--text);--txt2:var(--text-2);--oro:var(--accent);--mor:var(--primary-soft);--ros:var(--accent);--cian:var(--primary-soft);',
  'token/index.html': '--f:var(--bg-dark);--p:var(--surface);--b:var(--border);--t:var(--text);--t2:var(--text-2);--o:var(--accent);',
  // La chicha es morada: sus dos paginas conservan su color y solo reciben los nombres del tema.
  'chicha/index.html': '', 'chicha-wars/index.html': '',
  '404.html': '', 'offline.html': '',
};

const INI = '<!-- tema:inicio (lo escribe tools/tema.mjs desde css/tema.css; no editar aqui) -->';
const FIN = '<!-- tema:fin -->';
const compacto = css => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,])\s*/g, '$1').replace(/;}/g, '}').trim();

function bloque(f) {
  const tema = compacto(leer('css/tema.css'));
  const p = PUENTES[f];
  return INI + '<style id="dq-tema">' + tema + (p ? ':root{' + p.replace(/;$/, '') + '}' : '') + '</style>' + FIN;
}
function conTema(f, txt) {
  const b = bloque(f);
  const i = txt.indexOf(INI), j = txt.indexOf(FIN);
  if (i >= 0 && j > i) return txt.slice(0, i) + b + txt.slice(j + FIN.length);
  // Alguna pagina vieja no cierra el <head>: alli va justo antes del <body>.
  let h = txt.indexOf('</head>');
  if (h < 0) h = txt.search(/<body[\s>]/i);
  if (h < 0) throw new Error(f + ': no tiene </head> ni <body>');
  const nl = txt.includes('\r\n') ? '\r\n' : '\n';
  return txt.slice(0, h) + b + nl + txt.slice(h);
}

// ── Retinte ──
const hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
};
const rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map(v => Math.round((v + m) * 255));
};
// Valores exactos de las paletas viejas → tema (el resto sale por la regla de abajo).
const EXACTO = {
  '11,15,23': [7, 12, 11], '18,24,38': [13, 22, 20], '24,32,51': [19, 32, 28], '38,48,73': [33, 56, 50],
  '230,233,240': [236, 247, 241], '154,163,181': [169, 189, 179], '138,147,166': [127, 149, 138],
  '10,4,24': [7, 12, 11], '242,239,255': [236, 247, 241], '184,176,216': [169, 189, 179], '125,118,153': [127, 149, 138],
  '9,6,21': [7, 12, 11], '18,14,36': [13, 22, 20], '26,21,51': [19, 32, 28], '44,37,80': [33, 56, 50],
  '241,238,251': [236, 247, 241], '182,176,207': [169, 189, 179],
  '12,11,15': [7, 12, 11], '22,20,26': [13, 22, 20], '31,28,37': [19, 32, 28], '57,50,60': [33, 56, 50],
  // Azul de los botones y brillos de la paleta vieja → esmeralda.
  '37,99,235': [10, 132, 87], '29,78,216': [8, 107, 71], '59,130,246': [34, 227, 154], '96,165,250': [109, 245, 189], '147,197,253': [167, 249, 214],
  // Violeta de botones y bordes de la portada y de la cuenta → esmeralda / menta.
  '124,58,237': [16, 185, 129], '109,40,217': [8, 107, 71], '106,63,192': [16, 185, 129], '109,63,192': [10, 132, 87],
  '196,181,253': [109, 245, 189], '203,189,243': [109, 245, 189], '160,140,255': [109, 245, 189],
};
function nuevoColor(r, g, b, soloExacto) {
  const e = EXACTO[r + ',' + g + ',' + b];
  if (e) return e;
  if (soloExacto) return null;
  const [h, s, l] = hsl(r, g, b);
  if (s < 0.06 || h < 200 || h > 300) return null;           // grises puros y todo lo que no es azul/violeta
  if (l <= 0.24) return rgb(162, Math.min(s, 0.45) * 0.9, l);  // fondos oscuros → negro esmeralda
  if (s <= 0.35 && l < 0.55) return rgb(158, s * 0.9, l);     // bordes y grises medios
  if (s <= 0.45 && l >= 0.55) return rgb(150, Math.min(s, 0.25), l);   // textos lavanda/pizarra → salvia
  return null;                                                 // violetas y azules vivos: son rarezas, mana, etc.
}
const hex2 = n => n.toString(16).padStart(2, '0');
function retintarCss(css, cuenta, soloExacto) {
  css = css.replace(/#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?(?![0-9a-fA-F])/g, (m, c, a) => {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16));
    const n = nuevoColor(r, g, b, soloExacto);
    if (!n) return m;
    const out = '#' + n.map(hex2).join('') + (a || '');
    cuenta(m.toLowerCase(), out);
    return out;
  });
  return css.replace(/(rgba?\(\s*)(\d{1,3})(\s*,\s*)(\d{1,3})(\s*,\s*)(\d{1,3})/g, (m, a, r, s1, g, s2, b) => {
    const n = nuevoColor(+r, +g, +b, soloExacto);
    if (!n) return m;
    const out = a + n[0] + s1 + n[1] + s2 + n[2];
    cuenta(m.replace(/\s/g, ''), out.replace(/\s/g, ''));
    return out;
  });
}
// Donde hay CSS: hojas enteras, modulos de interfaz (su CSS va en cadenas) y, en las paginas,
// solo <style> y style="…" (los <script> pintan el juego en el lienzo: no se tocan).
const RETINTE = {
  css: ['css/portada.css'],
  js: ['js/cuenta.js', 'js/cuenta-portada.js', 'js/tienda-portada.js', 'js/portada-orden.js', 'mundo/js/menu.js', 'mundo/js/dios3.js'],
  html: ['index.html', 'mmo/index.html', 'mundo/index.html', 'telegram/index.html', 'game.html', 'jugar/index.html', 'inicio/index.html', 'token/index.html',
    'guia.html', 'novedades.html', 'seguridad.html', 'terminos.html', 'privacidad.html', 'reembolsos.html', '404.html', 'offline.html'],
  // En el cliente del juego solo los valores exactos de la paleta vieja (botones, paneles); nada por regla.
  exacto: [],
};
function retinte(probar) {
  let total = 0;
  const pasar = (f, tipo) => {
    if (!fs.existsSync(path.join(RAIZ, f))) return;
    const antes = leer(f);
    const vistos = new Map();
    const cuenta = (a, b) => vistos.set(a + ' → ' + b, (vistos.get(a + ' → ' + b) || 0) + 1);
    let txt;
    if (tipo === 'html') {
      txt = antes.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (m, a, css, c) => (a.includes('dq-tema') ? m : a + retintarCss(css, cuenta) + c))
        .replace(/(\sstyle=")([^"]*)(")/gi, (m, a, css, c) => a + retintarCss(css, cuenta) + c);
    } else txt = retintarCss(antes, cuenta, tipo === 'exacto');
    const n = [...vistos.values()].reduce((a, b) => a + b, 0);
    total += n;
    console.log(`${f}: ${n} colores` + (args.has('--detalle') ? '\n  ' + [...vistos].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join('\n  ') : ''));
    if (!probar && txt !== antes) fs.writeFileSync(path.join(RAIZ, f), txt);
  };
  for (const f of RETINTE.css) pasar(f, 'css');
  for (const f of RETINTE.js) pasar(f, 'js');
  for (const f of RETINTE.html) pasar(f, 'html');
  for (const f of RETINTE.exacto) pasar(f, 'exacto');
  console.log(`${probar ? 'Cambiaría' : 'Cambió'} ${total} colores`);
}

if (args.has('--retinte')) { retinte(args.has('--probar')); process.exit(0); }

let viejas = 0, hechas = 0;
for (const f of Object.keys(PUENTES)) {
  if (!fs.existsSync(path.join(RAIZ, f))) continue;
  const antes = leer(f), despues = conTema(f, antes);
  if (antes === despues) continue;
  if (args.has('--comprobar')) { viejas++; console.log('  copia vieja del tema: ' + f); }
  else { fs.writeFileSync(path.join(RAIZ, f), despues); hechas++; }
}
if (args.has('--comprobar')) { console.log(viejas ? `${viejas} página(s) con el tema viejo: node tools/tema.mjs` : `Tema al día en ${Object.keys(PUENTES).length} páginas`); process.exit(viejas ? 1 : 0); }
console.log(`Tema copiado: ${hechas} página(s) cambiadas de ${Object.keys(PUENTES).length}`);
