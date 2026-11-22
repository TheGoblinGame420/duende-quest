// ═══════════════════════════════════════════════════════
// CUENTA RÁPIDA — un solo formulario para todos los juegos del Duende
//
// Antes, ORIGINS (3D) mandaba a CLASSIC (2D) a crear la cuenta y el
// formulario pedía usuario, correo y la contraseña dos veces. Ahora:
//  - crear cuenta = correo + contraseña (con «Ver»), sin salir del juego;
//  - el nombre de usuario sale del correo (si ya existe, se le pone un número);
//  - la misma cuenta (Supabase Auth) vale para CLASSIC, ORIGINS, Chicha Wars y
//    el arcade: todos están en el mismo dominio y comparten la sesión del
//    navegador, y el servidor del mundo (functions/mmo/world.js) los conoce
//    como 'web:<id>';
//  - el duende de invitado de este navegador viaja en la cuenta (dq_inv) y al
//    entrar el servidor ofrece pasarlo, igual que antes.
//
// Uso:
//   formCuenta(contenedor, { modo: 'crear' | 'entrar', sb, alListo, nota })
//   abrirCuenta({ ...lo mismo })   → ventana flotante encima del juego
//   sb: () => cliente de supabase-js de la página (si falta, se crea uno)
//   alListo(): sesión iniciada (el juego reconecta o recarga)
// La contraseña nueva tras «¿Olvidaste?» se pone en CLASSIC (/mmo/), que ya
// tiene esa pantalla (PASSWORD_RECOVERY).
// ═══════════════════════════════════════════════════════

const ERR = [
  [/invalid login/i, 'Correo o contraseña incorrectos.'],
  [/not confirmed/i, 'Confirma tu correo: abre el enlace que te enviamos (revisa también spam).'],
  [/already registered|already exists/i, 'Ese correo ya tiene cuenta: entra con él.'],
  [/password should be|weak/i, 'La contraseña es muy débil: usa al menos 8 caracteres.'],
  [/rate limit|only request this after|too many/i, 'Demasiados intentos: espera un minuto y vuelve a probar.'],
  [/signups not allowed|signup is disabled/i, 'El registro está cerrado por ahora.'],
  [/failed to fetch|network/i, 'Sin conexión. Vuelve a intentarlo.'],
];
const textoError = m => (ERR.find(([r]) => r.test(m || '')) || [0, 'No se pudo completar: ' + (m || 'error de red')])[1];
const correoValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };

// Nombre de usuario a partir del correo: 'maria.lopez99@x' → 'marialopez99'.
// El perfil exige nombre único: el segundo intento lleva un número (maria_4821).
function usuarioDe(email, conNumero) {
  let u = String(email.split('@')[0] || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 15);
  if (u.length < 3) u = 'Duende' + u;
  return conNumero ? u.slice(0, 15) + '_' + (1000 + Math.floor(Math.random() * 9000)) : u;
}
// Código de quien te invitó (?ref=, guardado 14 días en dq_ref por CLASSIC y ORIGINS).
function refGuardado() {
  try { const x = JSON.parse(ls('dq_ref') || 'null'); if (x && /^[a-z0-9]{6}$/.test(x.r) && Date.now() - x.t < 14 * 86400000) return x.r; } catch (e) {}
  return '';
}

async function cliente(op) {
  const propio = op.sb && op.sb();
  if (propio) return propio;
  // El SDK se carga con defer: se espera un poco.
  for (let i = 0; i < 50 && !(window.supabase && window.SUPABASE_URL); i++) await new Promise(r => setTimeout(r, 100));
  if (!window.supabase || !window.SUPABASE_URL) return null;
  return (window.__dqSb = window.__dqSb || window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY));
}

function estilos() {
  if (document.getElementById('dqc-css')) return;
  const s = document.createElement('style');
  s.id = 'dqc-css';
  s.textContent = `
.dqc{font:500 15px system-ui,-apple-system,'Segoe UI',sans-serif;color:#ecf7f1;text-align:left}
.dqc h3{margin:0 0 4px;font-size:19px;color:#ffd84a;text-align:center}
.dqc .dqc-sub{margin:0 0 12px;font-size:13px;line-height:1.4;color:#a9bdb3;text-align:center}
.dqc label{display:block;font-size:12px;color:#a9bdb3;margin:8px 0 4px}
.dqc .dqc-campo{position:relative}
.dqc input{box-sizing:border-box;width:100%;min-height:46px;padding:10px 12px;border-radius:10px;border:1px solid #0a8457;background:#070c0b;color:#fff;font:inherit;font-size:16px}
.dqc input:focus{outline:2px solid #ffd84a;outline-offset:1px}
.dqc .dqc-ver{position:absolute;right:6px;top:50%;transform:translateY(-50%);min-height:34px;padding:0 10px;border-radius:8px;border:1px solid #0a8457;background:#13201c;color:#d6efe3;font:600 13px system-ui,sans-serif;cursor:pointer}
.dqc .dqc-con-ver input{padding-right:64px}
.dqc .dqc-btn{display:block;width:100%;min-height:48px;margin-top:14px;border:0;border-radius:10px;background:linear-gradient(180deg,#6ff8c0,#1ad68a);color:#03150d;box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 0 0 1px rgba(34,227,154,.4),0 8px 22px rgba(16,185,129,.28);font:800 16px system-ui,sans-serif;cursor:pointer}
.dqc .dqc-btn:disabled{opacity:.6;cursor:wait}
.dqc .dqc-ligas{margin:12px 0 0;font-size:13px;text-align:center;line-height:1.8}
.dqc .dqc-ligas button{background:none;border:0;padding:4px 2px;color:#6df5bd;text-decoration:underline;font:inherit;cursor:pointer}
.dqc .dqc-msg{min-height:1.2em;margin:10px 0 0;font-size:13px;line-height:1.4;text-align:center}
.dqc .dqc-msg.err{color:#fca5a5}.dqc .dqc-msg.ok{color:#86efac}
.dqc .dqc-juegos{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:0 0 10px}
.dqc .dqc-juegos span{font-size:11px;padding:3px 8px;border-radius:999px;background:#13201c;border:1px solid #213832;color:#d6efe3}
#dqc-fondo{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(7,12,11,.82)}
#dqc-fondo .dqc-caja{position:relative;max-width:380px;width:100%;max-height:calc(100% - 16px);overflow:auto;background:#0d1614;border:1px solid #0a8457;border-radius:14px;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
#dqc-fondo .dqc-x{position:absolute;right:8px;top:8px;width:36px;height:36px;border-radius:50%;border:1px solid #0a8457;background:#13201c;color:#fff;font:700 16px system-ui;cursor:pointer}
`;
  document.head.appendChild(s);
}

export function formCuenta(cont, op = {}) {
  estilos();
  const modo = op.modo === 'entrar' || op.modo === 'olvido' || op.modo === 'enlace' ? op.modo : 'crear';
  const otro = m => formCuenta(cont, { ...op, modo: m });
  cont.classList.add('dqc');
  const pass = (id, ac) => `<label for="${id}">Contraseña${ac === 'new-password' ? ' (mínimo 8)' : ''}</label><div class="dqc-campo dqc-con-ver"><input id="${id}" type="password" autocomplete="${ac}" enterkeyhint="go" minlength="8"><button type="button" class="dqc-ver" aria-label="Mostrar contraseña">Ver</button></div>`;
  const correo = '<label for="dqc-email">Correo</label><input id="dqc-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" placeholder="tucorreo@gmail.com">';
  let h = '';
  if (modo === 'crear') {
    h = '<h3>Crea tu cuenta gratis</h3><p class="dqc-sub">' + (op.nota || 'Solo correo y contraseña. Tu duende de invitado pasa contigo.') + '</p>'
      + '<div class="dqc-juegos"><span>CLASSIC 2D</span><span>ORIGINS 3D</span><span>Chicha Wars</span><span>Arcade</span></div>'
      + correo + pass('dqc-pass', 'new-password')
      + '<button type="button" class="dqc-btn" data-acc="crear">Crear cuenta</button>'
      + '<p class="dqc-ligas">¿Ya tienes cuenta? <button type="button" data-m="entrar">Entrar</button></p>';
  } else if (modo === 'entrar') {
    h = '<h3>Entra con tu cuenta</h3><p class="dqc-sub">La misma cuenta para todos los juegos del Duende.</p>'
      + correo + pass('dqc-pass', 'current-password')
      + '<button type="button" class="dqc-btn" data-acc="entrar">Entrar</button>'
      + '<p class="dqc-ligas"><button type="button" data-m="olvido">¿Olvidaste tu contraseña?</button> · <button type="button" data-m="enlace">Entrar con un enlace al correo</button><br>¿No tienes cuenta? <button type="button" data-m="crear">Crear una gratis</button></p>';
  } else {
    h = '<h3>' + (modo === 'olvido' ? 'Recupera tu contraseña' : 'Entra sin contraseña') + '</h3><p class="dqc-sub">'
      + (modo === 'olvido' ? 'Te enviamos un enlace para poner una contraseña nueva.' : 'Te enviamos un enlace que te deja dentro.') + ' Ábrelo en este mismo navegador.</p>'
      + correo + '<button type="button" class="dqc-btn" data-acc="' + modo + '">Enviarme el enlace</button>'
      + '<p class="dqc-ligas"><button type="button" data-m="entrar">Volver</button></p>';
  }
  h += '<p class="dqc-msg" role="status" aria-live="polite"></p>';
  cont.innerHTML = h;

  const $ = s => cont.querySelector(s);
  const msg = (t, ok) => { const p = $('.dqc-msg'); p.textContent = t; p.className = 'dqc-msg ' + (ok ? 'ok' : 'err'); };
  const em = $('#dqc-email');
  if (op.email) em.value = op.email;
  cont.querySelectorAll('[data-m]').forEach(b => b.onclick = () => otro(b.dataset.m));
  const ver = $('.dqc-ver');
  if (ver) ver.onclick = () => { const i = $('#dqc-pass'); const v = i.type === 'password'; i.type = v ? 'text' : 'password'; ver.textContent = v ? 'Ocultar' : 'Ver'; ver.setAttribute('aria-label', v ? 'Ocultar contraseña' : 'Mostrar contraseña'); i.focus(); };
  const btn = $('[data-acc]');
  // Las teclas no llegan al juego (moverse, atacar, abrir ventanas) mientras escribe.
  cont.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => {
    if (e.key !== 'Escape') e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); if (i.id === 'dqc-email' && $('#dqc-pass') && !$('#dqc-pass').value) $('#dqc-pass').focus(); else btn.click(); }
  }));
  btn.onclick = async () => {
    const email = em.value.trim().toLowerCase(), clave = ($('#dqc-pass') || {}).value || '';
    if (!correoValido(email)) { em.focus(); return msg('Escribe un correo válido.'); }
    if (modo === 'crear' && clave.length < 8) { $('#dqc-pass').focus(); return msg('La contraseña necesita al menos 8 caracteres.'); }
    if (modo === 'entrar' && !clave) { $('#dqc-pass').focus(); return msg('Escribe tu contraseña.'); }
    const cli = await cliente(op);
    if (!cli) return msg('No se pudo cargar el inicio de sesión. Recarga la página.');
    btn.disabled = true; msg(modo === 'crear' ? 'Creando tu cuenta…' : 'Un momento…', true);
    const vuelta = location.origin + location.pathname;
    try {
      if (modo === 'crear') {
        const meta = { username: usuarioDe(email) };
        const r = refGuardado(); if (r) meta.ref = r;
        // El invitado de este navegador viaja en la cuenta (solo lo ve su dueño): al entrar se ofrece pasarlo.
        const inv = ls('dq_mmo_tok'); if (/^[a-f0-9]{32}$/.test(inv || '')) meta.dq_inv = inv;
        let res = await cli.auth.signUp({ email, password: clave, options: { data: meta, emailRedirectTo: vuelta } });
        // "Database error saving new user": el nombre de usuario ya existe → otro intento con número.
        if (res.error && /database error/i.test(res.error.message || '')) { meta.username = usuarioDe(email, true); res = await cli.auth.signUp({ email, password: clave, options: { data: meta, emailRedirectTo: vuelta } }); }
        if (res.error) return msg(textoError(res.error.message));
        // Correo ya registrado con la confirmacion activada: Supabase no da error, devuelve un usuario sin identidades.
        if (res.data && res.data.user && Array.isArray(res.data.user.identities) && !res.data.user.identities.length) return msg('Ese correo ya tiene cuenta: entra con él.');
        if (res.data && res.data.session) { msg('¡Cuenta creada! Entrando…', true); if (op.alListo) setTimeout(op.alListo, 400); }
        else msg('¡Listo! Te enviamos un correo para confirmar la cuenta. Ábrelo y entrarás directo (revisa también spam).', true);
      } else if (modo === 'entrar') {
        const { error } = await cli.auth.signInWithPassword({ email, password: clave });
        if (error) return msg(textoError(error.message));
        msg('¡Dentro! Cargando tu duende…', true); if (op.alListo) setTimeout(op.alListo, 300);
      } else if (modo === 'olvido') {
        const { error } = await cli.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/mmo/' });
        if (error) return msg(textoError(error.message));
        msg('Si ese correo tiene cuenta, te llegó un enlace para cambiar la contraseña (revisa también spam).', true);
      } else {
        const { error } = await cli.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: vuelta } });
        if (error) return msg(textoError(error.message));
        msg('Si ese correo tiene cuenta, te llegó un enlace para entrar (revisa también spam).', true);
      }
    } catch (e) { msg('Sin conexión. Vuelve a intentarlo.'); }
    finally { btn.disabled = false; }
  };
  // Foco en el correo solo con teclado físico (en el celular abriría el teclado tapando el formulario).
  if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => { if (cont.isConnected) (em.value ? $('#dqc-pass') || em : em).focus(); }, 60);
}

// Ventana flotante encima del juego (ORIGINS, Chicha Wars...). Devuelve una función para cerrarla.
export function abrirCuenta(op = {}) {
  estilos();
  const viejo = document.getElementById('dqc-fondo'); if (viejo) viejo.remove();
  const fondo = document.createElement('div');
  fondo.id = 'dqc-fondo';
  fondo.innerHTML = '<div class="dqc-caja" role="dialog" aria-modal="true" aria-label="Cuenta"><button type="button" class="dqc-x" aria-label="Cerrar">✕</button><div class="dqc-cuerpo"></div></div>';
  const cerrar = () => { fondo.remove(); removeEventListener('keydown', esc, true); if (op.alCerrar) op.alCerrar(); };
  const esc = e => { if (e.key === 'Escape') { e.stopPropagation(); cerrar(); } };
  addEventListener('keydown', esc, true);
  fondo.querySelector('.dqc-x').onclick = cerrar;
  fondo.addEventListener('pointerdown', e => { if (e.target === fondo) cerrar(); });
  // Ni los toques ni las teclas llegan al juego de debajo.
  ['keydown', 'keyup', 'touchstart', 'touchmove', 'wheel'].forEach(t => fondo.addEventListener(t, e => e.stopPropagation(), { passive: true }));
  document.body.appendChild(fondo);
  formCuenta(fondo.querySelector('.dqc-cuerpo'), { ...op, alListo: () => { fondo.remove(); removeEventListener('keydown', esc, true); if (op.alListo) op.alListo(); } });
  return cerrar;
}

// ── RECORDATORIO A INVITADOS ──
// El duende de invitado vive solo en este navegador: si se borran los datos, se pierde.
// Una franja pequeña (no tapa el juego ni bloquea) con «Crear cuenta» y «Luego»:
//  - la primera a los ~3 min de juego, luego cada 10 min, como mucho 4 por visita;
//  - también al subir a los niveles de RECORDAR_NV (si no hay otra en pantalla);
//  - nunca con una ventana abierta, en combate o muerto (op.ocupado): se reintenta a los 20 s.
// op: { esInvitado(), nivel(), ocupado(), abrir() }. Devuelve { subio(nv), quitar() }.
const RECORDAR_NV = [2, 4, 6, 8, 10, 15, 20, 25, 30];
export function recordarInvitado(op) {
  estilos();
  if (!document.getElementById('dqr-css')) {
    const s = document.createElement('style'); s.id = 'dqr-css';
    s.textContent = `#dqr{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 58px);transform:translate(-50%,-12px);opacity:0;transition:opacity .25s,transform .25s;z-index:2147482000;width:min(360px,calc(100% - 24px));box-sizing:border-box;padding:10px 12px;border-radius:12px;background:#0d1614;border:1px solid #ffd84a;box-shadow:0 6px 24px rgba(0,0,0,.5);font:500 13px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;color:#ecf7f1}
#dqr.on{opacity:1;transform:translate(-50%,0)}#dqr b{color:#ffd84a}#dqr .dqr-b{display:flex;gap:8px;margin-top:8px}
#dqr button{flex:1;min-height:40px;border-radius:9px;font:700 14px system-ui,sans-serif;cursor:pointer}
#dqr .dqr-si{border:0;background:linear-gradient(180deg,#8b5cf6,#086b47);color:#fff}#dqr .dqr-no{flex:0 0 auto;padding:0 14px;border:1px solid #0a8457;background:#13201c;color:#a9bdb3}`;
    document.head.appendChild(s);
  }
  const t0 = Date.now(); let n = 0, proxima = t0 + 3 * 60000, timer = 0, oculto = 0;
  const quitar = () => { const d = document.getElementById('dqr'); clearTimeout(oculto); if (d) { d.classList.remove('on'); setTimeout(() => d.remove(), 260); } };
  const mostrar = forzado => {
    if (!op.esInvitado() || n >= 4 || document.getElementById('dqr') || document.getElementById('dqc-fondo')) return false;
    if (op.ocupado && op.ocupado()) return false;
    n++; proxima = Date.now() + 10 * 60000;
    const nv = op.nivel ? op.nivel() : 0;
    const d = document.createElement('div'); d.id = 'dqr'; d.setAttribute('role', 'status');
    d.innerHTML = '<b>Juegas como invitado.</b> Tu duende' + (nv > 1 ? ' (Nv ' + nv + ')' : '') + ' vive solo en este navegador: si se borra, lo pierdes. Crea tu cuenta gratis con tu correo y lo guardas en todos los juegos.'
      + '<div class="dqr-b"><button type="button" class="dqr-si">Crear cuenta</button><button type="button" class="dqr-no">Luego</button></div>';
    ['keydown', 'touchstart', 'pointerdown'].forEach(t => d.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    d.querySelector('.dqr-si').onclick = () => { quitar(); op.abrir(); };
    d.querySelector('.dqr-no').onclick = quitar;
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('on'));
    oculto = setTimeout(quitar, forzado ? 15000 : 20000);
    return true;
  };
  const vuelta = () => { if (!op.esInvitado()) return; if (Date.now() >= proxima) mostrar(); timer = setTimeout(vuelta, 20000); };
  timer = setTimeout(vuelta, 20000);
  return {
    subio(nv) { if (RECORDAR_NV.includes(nv) && op.esInvitado()) setTimeout(() => mostrar(true), 2500); },
    quitar() { clearTimeout(timer); quitar(); },
  };
}
