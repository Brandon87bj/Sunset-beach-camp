/* =========================================================
   SUNSET BEACH CAMP — Pantallas y lógica
   Los datos vienen de Supabase (ver js/datos.js y database/schema.sql)
   ========================================================= */

const LOGO = "assets/logo.webp";

/* ---------- Íconos (Font Awesome) ---------- */
/* Genera el SVG del ícono al momento para que no "aparezca tarde" en cada redibujo */
function faSvg(prefix, n){
  try {
    const ic = window.FontAwesome && window.FontAwesome.icon({ prefix, iconName: n });
    if (ic && ic.html && ic.html[0]) return ic.html[0];
  } catch(e) {}
  return `<i class="${prefix==='far' ? 'fa-regular' : 'fa-solid'} fa-${n}" aria-hidden="true"></i>`;
}
const fa = n => faSvg('fas', n);
const I = {
  pot:fa('jar'), leaf:fa('spa'), bike:fa('person-biking'), dice:fa('dice'), tent:fa('campground'),
  check:fa('circle-check'), live:fa('circle-dot'), lock:fa('lock'), sun:fa('umbrella-beach'),
  route:fa('route'), medal:fa('medal'), info:fa('circle-info'), ecoleaf:fa('leaf'), phone:fa('mobile-screen-button'),
  logout:fa('right-from-bracket'), back:fa('chevron-left'), arrow:fa('arrow-right'), users:fa('users'),
  clock:fa('clock'), pin:fa('location-dot'), play:fa('play'), key:fa('key'), guide:fa('flag'), tourist:fa('person-hiking'),
  target:fa('bullseye'), hourglass:fa('hourglass-half'), text:fa('align-left'), list:fa('list-ol'), box:fa('toolbox'),
  shield:fa('shield-heart'), recycle:fa('recycle'), book:fa('book-open'), sunglasses:fa('sun'), gear:fa('gear'),
  eye:fa('eye'), close:fa('xmark'), paint:fa('palette'), user:fa('circle-user'), trash:fa('trash-can'), caret:fa('chevron-down'), cal:fa('calendar-days'), warn:fa('triangle-exclamation'), door:fa('door-open'),
  r1:faSvg('far','face-frown'), r2:faSvg('far','face-smile'), r3:faSvg('far','face-grin-hearts')
};
const zig = '<svg class="zig" viewBox="0 0 150 10" aria-hidden="true">' +
  Array.from({length:11},(_,i)=>`<path d="M${7+i*13} 1l5 4-5 4-5-4z" fill="${['#3b2a1e','#cf9a3f','#1f5b5d','#c9774f'][i%4]}"/>`).join('') + '</svg>';
const hills = `<div class="hills" aria-hidden="true"><svg viewBox="0 0 460 120" preserveAspectRatio="none"><path d="M0 70 70 38l60 26 80-40 90 44 60-24 100 30v46H0z" fill="#b9875c"/><path d="M0 88 90 60l90 22 80-26 110 32 90-12v44H0z" fill="#8a5b38"/><path d="M0 104c60-10 120 6 200-4s150 10 260-6v26H0z" fill="#5a3a24"/></svg><span class="hsun"></span></div>`;
const band = '<div class="band" aria-hidden="true"></div>';

/* ---------- Estado de la UI ---------- */
let ui = { screen:'welcome', authTab:'login', rol:'turista', err:'', tab:'ruta', detalle:null, rating:null, confirmClose:false, confirmTerm:null, preview:null, confirmar:null, ver:{}, menu:false, busy:false, cargando:true, errorInicio:'', aviso:'' };
let timerId = null;

function toast(msg){
  const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.hidden = true, 2600);
}
const badge = (a, off=false, size=56) => `<div class="badge${off?' off':''}${a.insignia?' con-img':''}" style="--c:${esc(a.c)};--s:${size}px" aria-hidden="true">${
  a.insignia ? `<img src="${esc(a.insignia)}" alt="" loading="lazy" draggable="false">` : (I[a.icon] || I.medal)}</div>`;

/* Duración como viene en el documento (ej. "De 5:00 p.m. a 8:00 a.m."); si no, se calcula de los minutos */
function duracion(a){
  if(a.durTexto) return a.durTexto;
  const h = Math.floor(a.dur/60), m = a.dur%60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
/* Lugar solo si viene en la información */
const lugar = a => a.lugar ? ` &nbsp; ${I.pin}${esc(a.lugar)}` : '';
/* Foto de la actividad */
const foto = (a, cls) => a.img ? `<img class="${cls}" src="${esc(a.img)}" alt="${esc(a.nombre)}" loading="lazy">` : '';
const dis = () => ui.busy ? 'disabled' : '';

/* Traduce los errores comunes de Supabase */
function mensajeError(e){
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos. Revisa y vuelve a intentar.';
  if (/Email not confirmed/i.test(m)) return 'Tu cuenta se creó, pero Supabase todavía pide confirmar el correo. Hay que apagar "Confirm email" en Authentication.';
  if (/sending confirmation|email rate limit/i.test(m)) return 'Supabase intentó mandar un correo de confirmación. Hay que apagar "Confirm email" en Authentication.';
  if (/already registered/i.test(m)) return 'Ese correo ya tiene cuenta. Inicia sesión.';
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit|only request this after/i.test(m)) return `Supabase bloqueó el registro por límite de intentos (${m}). Revisa que "Confirm email" esté apagado y espera unos minutos.`;
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No hay conexión con Supabase. Revisa tu internet y js/config.js.';
  return m;
}

function topbar(){
  const u = S.me;
  return `<header class="top"><div class="wrap topin">
    <div class="brand"><img class="brand-logo" src="${LOGO}" alt="" width="40" height="40"><span>Sunset Beach Camp</span></div>
    <div class="perfil">
      <button class="perfil-btn" data-act="menu" aria-haspopup="true" aria-expanded="${!!ui.menu}">
        <span class="who"><b>${esc(u.nombre)}</b>${u.rol==='guia'?'Guía':'Turista'}</span>
        <span class="perfil-ic">${I.user}</span>
      </button>
      ${ui.menu ? `<div class="menu-perfil" role="menu">
        <div class="menu-head"><b>${esc(u.nombre)}</b><span>${u.rol==='guia'?'Guía':'Turista'}</span></div>
        <p class="menu-nota">¿Te registraste con el rol equivocado? Borra tu cuenta y vuelve a registrarte con el mismo correo.</p>
        <button class="menu-item peligro" role="menuitem" data-act="borrar-cuenta">${I.trash} Borrar mi cuenta</button>
      </div>` : ''}
    </div>
    <button class="icon-btn" data-act="logout">${I.logout}Salir</button>
  </div></header>`;
}

/* ---------- Pantallas especiales ---------- */
function vConfig(){
  return `<main class="wrap narrow welcome">
    <section class="hero"><img class="logo" src="${LOGO}" alt="Logo de Sunset Beach Camp"><h1>SUNSET BEACH CAMP</h1></section>
    <div class="panel">
      <h3>${I.gear} Falta conectar Supabase</h3>
      <ol class="tight">
        <li>En Supabase abre <b>SQL Editor</b> y corre <code>database/schema.sql</code>.</li>
        <li>Ve a <b>Project Settings → API</b>.</li>
        <li>Abre <code>js/config.js</code> y pega el <b>Project URL</b> y la <b>anon public key</b>.</li>
        <li>Recarga esta página.</li>
      </ol>
    </div>
  </main>${band}`;
}
function vCargando(){
  return `<main class="wrap narrow welcome" style="align-items:center;text-align:center">
    <img class="logo" src="${LOGO}" alt="Logo de Sunset Beach Camp">
    ${ui.errorInicio
      ? `<div class="panel"><p class="err">${esc(ui.errorInicio)}</p><p class="muted">Revisa que hayas corrido <code>database/schema.sql</code> y que <code>js/config.js</code> tenga los datos correctos.</p><button class="btn btn-terra" data-act="reintentar">Reintentar</button></div>`
      : `<p class="muted">Cargando…</p>`}
  </main>`;
}

/* ---------- Bienvenida y acceso ---------- */
function vWelcome(){
  return `<main class="wrap welcome">
    <section class="hero">
      <img class="logo" src="${LOGO}" alt="Logo de Sunset Beach Camp">
      <h1>SUNSET BEACH CAMP</h1>
      <p class="tag">Cinco experiencias, un mismo recorrido</p>
      <p class="camp">Donde cada atardecer se convierte en una aventura</p>
    </section>
    <div class="welcome-side">
      ${ACTS.length ? `<span class="eyebrow">Las ${ACTS.length} experiencias</span>
      <div class="strip">${ACTS.map((a,i)=>`<div>${badge(a,false,48)}<span>${i+1}. ${esc(a.nombre)}</span></div>`).join('')}</div>`
      : `<p class="demo">${I.info} ${esc(ui.aviso || 'Cargando experiencias…')}</p>`}
      <button class="btn btn-terra" data-act="go-register">REGISTRAR MI LLEGADA ${I.arrow}</button>
      <button class="btn btn-ghost" data-act="go-login">Ya tengo cuenta</button>
    </div>
  </main>${hills}${band}`;
}

function vAuth(){
  const reg = ui.authTab==='register';
  const tur = ui.rol==='turista';
  return `<header class="top"><div class="wrap topin"><button class="icon-btn" data-act="go-welcome" aria-label="Volver">${I.back}</button><div class="brand"><img class="brand-logo" src="${LOGO}" alt="" width="40" height="40">Sunset Beach Camp</div></div></header>
  <main class="wrap narrow">
    <div class="tabs" role="group" aria-label="Acceso">
      <button data-act="tab-login" aria-pressed="${!reg}">Iniciar sesión</button>
      <button data-act="tab-register" aria-pressed="${reg}">Crear cuenta</button>
    </div>
    <form class="panel" id="authForm" novalidate>
      ${reg ? `
        <div class="field"><span class="eyebrow">¿Cómo participas?</span>
          <div class="role">
            <button type="button" data-act="rol-turista" aria-pressed="${tur}">${I.tourist}<b>Turista</b><span>Me uno a un recorrido</span></button>
            <button type="button" data-act="rol-guia" aria-pressed="${!tur}">${I.guide}<b>Guía</b><span>Creo y dirijo el grupo</span></button>
          </div></div>
        <div class="field"><label for="f_nombre">Nombre o apodo</label><input id="f_nombre" name="nombre" autocomplete="nickname" required></div>
        ${tur ? `
        <div class="field"><label for="f_edad">Rango de edad</label>
          <select id="f_edad" name="edad" required><option value="">Selecciona</option><option>Menos de 18</option><option>18-25</option><option>26-40</option><option>41-60</option><option>Más de 60</option></select></div>
        <div class="field"><label for="f_mun">Municipio de procedencia</label><input id="f_mun" name="municipio" placeholder="Ej. Tepic" required></div>
        <fieldset class="field"><legend>Necesidades de accesibilidad</legend>
          <div class="checks">
            ${['Movilidad reducida','Visual','Auditiva','Ninguna'].map((t,i)=>`<label><input type="checkbox" id="f_acc${i}" name="acces" value="${t}"> ${t}</label>`).join('')}
          </div></fieldset>` : ''}
      ` : ''}
      <div class="field"><label for="f_correo">Correo electrónico</label><input id="f_correo" name="correo" type="email" autocomplete="email" required></div>
      <div class="field"><label for="f_pass">Contraseña</label><input id="f_pass" name="pass" type="password" autocomplete="${reg?'new-password':'current-password'}" required>${reg?'<span class="meta">Mínimo 6 caracteres.</span>':''}</div>
      ${reg ? `<label class="consent"><input type="checkbox" id="f_ok" name="ok"> <span><b>Acepto el uso de mis datos</b> solo para la organización del evento.</span></label>` : ''}
      ${ui.err ? `<p class="err" role="alert">${esc(ui.err)}</p>` : ''}
      <button class="btn btn-terra" type="submit" ${dis()}>${ui.busy ? 'Un momento…' : reg ? 'Finalizar registro' : 'Entrar'}</button>
    </form>
  </main>${band}`;
}

/* ---------- Guía ---------- */
function vSinGrupo(){
  const guia = S.me.rol === 'guia';
  return topbar() + `<main class="wrap ${guia ? '' : 'narrow'}">
    <div><h2 class="screen-title">${guia ? 'Mi grupo' : 'Recorridos'}</h2>${zig}</div>
    <div class="${guia ? 'espera-grid' : 'stack'}">
      ${guia ? `<form class="panel" id="groupForm">
        <h3>${fa('plus')} Crear un grupo</h3>
        <p class="muted">Quedas como admin: compartes el código y asignas una actividad a cada guía.</p>
        <div class="field"><label for="g_nombre">Nombre del grupo</label><input id="g_nombre" name="nombre" value="Grupo Sunset Beach Camp" required></div>
        <div class="field"><label for="g_fecha">Fecha del día 1</label><input id="g_fecha" name="fecha" type="date" value="${manana()}" required>
          <span class="meta">El recorrido dura 2 días. Después podrás elegir qué actividades van cada día.</span></div>
        <button class="btn btn-terra" type="submit" ${dis()}>Crear grupo</button>
      </form>` : ''}
      <div class="stack">
        ${S.abiertos.length ? `<section class="list" aria-label="Recorridos disponibles">
          ${S.abiertos.map(g=>`<div class="row"><img src="${LOGO}" alt="" width="46" height="46" style="border-radius:50%">
            <div class="grow"><b>${esc(g.nombre)}</b><div class="meta">${I.guide} Admin: ${esc(g.admin?.nombre || '')}</div></div>
            <span class="pill ${g.estado==='esperando'?'activa':'completada'}">${g.estado==='esperando'?'abierto':'en curso'}</span></div>`).join('')}
        </section>` : `<div class="panel" style="text-align:center"><p><b>No hay recorridos abiertos todavía.</b></p><p class="muted">Cuando un guía cree el grupo aparecerá aquí.</p></div>`}
        <form class="panel" id="joinForm">
          ${guia ? `<h3>${I.users} Unirme a un grupo</h3><p class="muted">Pídele el código al admin del grupo.</p>` : ''}
          <div class="field"><label for="j_code">Código del grupo</label><input id="j_code" name="code" placeholder="SBC-0000" autocomplete="off" style="text-transform:uppercase"></div>
          ${ui.err ? `<p class="err" role="alert">${esc(ui.err)}</p>` : ''}
          <button class="btn ${guia ? 'btn-teal' : 'btn-terra'}" type="submit" ${dis()}>Unirme al recorrido</button>
        </form>
      </div>
    </div>
  </main>${hills}${band}`;
}

const pillEstado = st => `<span class="pill ${st==='abierta'?'activa':st}">${st==='abierta'?'abierta':st==='completada'?'terminada':'bloqueada'}</span>`;

function tarjetaActividad(a, comoAdmin){
  const st = estado(a.id), g = S.grupo;
  const parts = S.part.filter(p=>p.actividad_id===a.id);
  const sinSello = parts.filter(p=>!p.sellado).length;
  const prev = ACTS[ACTS.indexOf(a)-1];
  let cuerpo = '';

  if(g.estado==='esperando'){
    cuerpo = `<p class="muted">Se podrá abrir cuando el admin inicie el recorrido.</p>`;
  } else if(st==='bloqueada'){
    cuerpo = siguientePorAbrir()?.id===a.id
      ? `<p>Ya es tu turno. Al abrirla, los turistas la verán a color y podrán entrar.</p>
         <button class="btn btn-terra" data-act="abrir" data-id="${a.id}" ${dis()}>${I.play} Abrir actividad</button>`
      : `<p class="muted">${I.lock} Se abre cuando termine ${esc(prev ? prev.nombre : 'la anterior')}.</p>`;
  } else if(st==='abierta'){
    cuerpo = `<div class="meta">${I.clock} Abierta hace <span data-desde="${S.acts[a.id].abiertaEn}">0 min</span></div>
      ${parts.length ? `<div class="list">${parts.map(p=>`<div class="row" style="padding:8px 10px">
          <div class="grow"><b>${esc(p.nombre)}</b></div>
          ${p.sellado ? `<span class="pill completada">${fa('stamp')} sellado</span>`
            : `<button class="btn btn-sage btn-sm" data-act="sellar" data-id="${a.id}" data-t="${p.turista_id}" ${dis()}>${fa('stamp')} Sellar</button>`}
        </div>`).join('')}</div>`
      : `<p class="muted">Todavía nadie entra. Los turistas tocan "Entrar" en su app.</p>`}
      ${sinSello>1 ? `<button class="btn btn-sage" data-act="sellar-todos" data-id="${a.id}" ${dis()}>${fa('stamp')} Sellar a todos (${sinSello})</button>` : ''}
      ${ui.confirmTerm===a.id
        ? `<div class="confirm"><span style="flex:1;min-width:150px">${sinSello ? `Hay ${sinSello} sin sello y se quedarán sin insignia.` : 'Ya nadie podrá entrar.'} ¿Terminar?</span>
            <button class="btn btn-terra btn-sm" data-act="terminar-si" data-id="${a.id}" ${dis()}>Sí, terminar</button>
            <button class="btn btn-ghost btn-sm" data-act="terminar-no">Cancelar</button></div>`
        : `<button class="btn btn-ghost" data-act="terminar" data-id="${a.id}">Terminar actividad</button>`}`;
  } else {
    cuerpo = `<p class="muted">${I.check} Terminada · ${parts.filter(p=>p.sellado).length} ${parts.filter(p=>p.sellado).length===1?'turista sellado':'turistas sellados'}.</p>`;
  }

  return `<section class="panel mi-act">
    <div class="row" style="border:0;padding:0;background:none">${badge(a, st==='bloqueada', 52)}
      <div class="grow"><span class="eyebrow">${comoAdmin ? 'Como admin' : 'Mi actividad'} · ${ACTS.indexOf(a)+1} de ${ACTS.length} · ${esc(etiquetaDia(diaDe(a.id), true))}</span><h3 style="font-size:19px">${esc(a.nombre)}</h3></div>
      ${pillEstado(st)}</div>
    ${cuerpo}
  </section>`;
}

/* ---------- Fechas ---------- */
function manana(){
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
/* "Día 1 · sáb 21 de nov" y "09:00", cada uno sin partirse */
const cuando = a => `<div class="cuando"><span>${I.cal} ${esc(etiquetaDia(diaDe(a.id), true))}</span><span>${I.clock} ${esc(a.hora)}</span></div>`;
/* Encabezado de día dentro de una lista */
const encabezadoDia = d => `<div class="dia-head">${I.cal} ${esc(etiquetaDia(d))}</div>`;
/* Recorre las actividades agrupadas por día */
function porDia(fn){
  return diasUsados().map(d => encabezadoDia(d) + ACTS.filter(a=>diaDe(a.id)===d).map(a=>fn(a, ACTS.indexOf(a))).join('')).join('');
}
function bloqueFechas(g, admin){
  const editable = admin && g.estado !== 'finalizado';
  return `<div class="sec fechas">
    <h3>${I.cal} Fechas del recorrido</h3>
    ${editable ? `<div class="field"><label for="fecha_g">Fecha del día 1</label><input id="fecha_g" class="fecha-g" type="date" value="${esc(g.fechaInicio || '')}" ${dis()}></div>` : ''}
    ${g.fechaInicio
      ? `<ul class="tight"><li>${esc(etiquetaDia(1))}</li><li>${esc(etiquetaDia(2))}</li></ul>`
      : `<p class="muted" style="font-size:13.5px">${admin ? 'Pon la fecha del día 1.' : 'El admin todavía no pone la fecha.'}</p>`}
  </div>`;
}

/* ---------- Listas de guías y turistas con "Ver más" ---------- */
/* Resumen corto: los primeros nombres y cuántos faltan */
function resumen(nombres){
  if(!nombres.length) return '';
  const vis = nombres.slice(0,3).join(', ');
  return nombres.length > 3 ? `${vis} y ${nombres.length-3} más` : vis;
}
function botonVer(clave, abierta, n){
  return `<button class="ver-mas" data-act="ver" data-id="${clave}" aria-expanded="${abierta}">${abierta ? `Ver menos ${fa('chevron-up')}` : `Ver más (${n}) ${fa('chevron-down')}`}</button>`;
}

function listaGuias(g){
  const abierta = !!ui.ver.guias;
  const actsDe = id => ACTS.filter(a=>S.acts[a.id]?.guiaId===id).map(a=>a.nombre);
  const nombre = x => `${esc(x.nombre)}${x.id===S.me.id?' <span class="meta">(tú)</span>':''}`;
  return `<div class="sec lista">
    <div class="lista-head"><h3>${I.guide} Guías (${S.guias.length})</h3>${S.guias.length ? botonVer('guias', abierta, S.guias.length) : ''}</div>
    ${abierta
      ? `<div class="tabla-scroll" data-scroll-id="guias"><table class="tabla">
          <thead><tr><th>#</th><th>Guía</th><th>Actividad</th></tr></thead>
          <tbody>${S.guias.map((x,i)=>`<tr><td class="num">${i+1}</td>
            <td>${nombre(x)}${x.id===g.adminId?' <span class="pill activa">admin</span>':''}</td>
            <td>${actsDe(x.id).length ? esc(actsDe(x.id).join(', ')) : '<span class="muted">Sin asignar</span>'}</td></tr>`).join('')}</tbody>
        </table></div>`
      : `<p class="resumen">${esc(resumen(S.guias.map(x=>x.nombre)))}</p>`}
  </div>`;
}

function listaTuristas(){
  const abierta = !!ui.ver.turistas;
  const sellos = id => S.part.filter(p=>p.turista_id===id && p.sellado).length;
  return `<div class="sec lista">
    <div class="lista-head"><h3>${I.users} Turistas (${S.turistas.length})</h3>${S.turistas.length ? botonVer('turistas', abierta, S.turistas.length) : ''}</div>
    ${!S.turistas.length ? '<p class="resumen muted">Nadie se ha unido todavía.</p>'
      : abierta
      ? `<div class="tabla-scroll" data-scroll-id="turistas"><table class="tabla">
          <thead><tr><th>#</th><th>Turista</th><th class="num">Sellos</th></tr></thead>
          <tbody>${S.turistas.map((t,i)=>`<tr><td class="num">${i+1}</td><td>${esc(t.nombre)}</td><td class="num">${sellos(t.id)}/${ACTS.length}</td></tr>`).join('')}</tbody>
        </table></div>`
      : `<p class="resumen">${esc(resumen(S.turistas.map(t=>t.nombre)))}</p>`}
  </div>`;
}

function vGuia(){
  const g = S.grupo;
  if(!g) return vSinGrupo();
  const admin = soyAdmin(), total = ACTS.length, n = terminadas();
  const mias = misActividades();
  // El admin también ve la actividad en juego aunque no sea suya, por si falta el guía
  const enJuego = ACTS.find(a=>estado(a.id)==='abierta') || siguientePorAbrir();
  const extra = admin && g.estado==='en_curso' && enJuego && !mias.includes(enJuego) ? [enJuego] : [];
  const sinAsignar = ACTS.filter(a=>!S.acts[a.id]?.guiaId).length;
  const conteo = a => { const p = S.part.filter(x=>x.actividad_id===a.id); const e = S.evals.filter(x=>x.actividad_id===a.id).length;
    return p.length ? ` · ${p.filter(x=>x.sellado).length}/${p.length} sellados${e ? ` · ${e} eval.` : ''}` : ''; };

  return topbar() + `<main class="wrap">
    <div><h2 class="screen-title">${esc(g.nombre)}</h2>${zig}</div>
    ${g.estado==='esperando' ? `<div class="status wait"><span class="dot"></span>Esperando el inicio del recorrido</div>`
      : g.estado==='en_curso' ? `<div class="status live"><span class="dot"></span>Recorrido en curso · ${n} de ${total} terminadas</div>`
      : `<div class="status done"><span class="dot"></span>Recorrido finalizado</div>`}

    <div class="guia-grid">
      <section class="panel">
        ${ui.ver.codigo
          ? `<span class="eyebrow">${I.key} Código del grupo</span>
             <div class="code">${esc(g.codigo)}</div>
             <p class="muted" style="font-size:13.5px">Guías y turistas lo escriben para unirse.</p>
             <button class="btn btn-ghost btn-codigo" data-act="ver" data-id="codigo" aria-expanded="true">${fa('eye-slash')} Ocultar código del grupo</button>`
          : `<button class="btn btn-ghost btn-codigo" data-act="ver" data-id="codigo" aria-expanded="false">${I.key} Mostrar código del grupo</button>`}
        ${bloqueFechas(g, admin)}
        ${listaGuias(g)}
        ${listaTuristas()}
        ${admin && g.estado==='esperando' ? `
          <button class="btn btn-teal" data-act="start" ${!sinAsignar && S.turistas.length && !ui.busy ? '' : 'disabled'}>${I.play} Iniciar recorrido</button>
          ${sinAsignar ? `<p class="muted" style="font-size:13px">Falta asignar guía a ${sinAsignar} ${sinAsignar===1?'actividad':'actividades'}.</p>` : ''}
          ${!S.turistas.length ? `<p class="muted" style="font-size:13px">Espera a que se una al menos un turista.</p>` : ''}` : ''}
        ${admin
          ? `<button class="btn btn-ghost" data-act="close-ask">Cerrar grupo</button>`
          : `<button class="btn btn-ghost" data-act="leave" ${dis()}>Salir del grupo</button>`}
      </section>

      <div class="stack">
        ${mias.length || extra.length ? [...mias.map(a=>tarjetaActividad(a,false)), ...extra.map(a=>tarjetaActividad(a,true))].join('')
          : `<section class="panel"><p><b>Aún no tienes actividad asignada.</b></p><p class="muted">${admin ? 'Asígnate una en la lista de abajo.' : 'El admin del grupo te asignará una.'}</p></section>`}

        ${g.estado!=='esperando' ? `<div class="progress" aria-label="${n} de ${total} terminadas"><span style="width:${total ? n/total*100 : 0}%"></span></div>` : ''}
        <span class="eyebrow">Las ${total} actividades${admin && g.estado==='esperando' ? ' · asigna guía y día a cada una' : ''}</span>
        <section class="list" aria-label="Actividades del grupo">
          ${porDia((a,i)=>{
            const st = estado(a.id), info = S.acts[a.id] || {};
            const asignable = admin && st==='bloqueada' && g.estado!=='finalizado';
            return `<div class="row">${badge(a, st==='bloqueada', 44)}
              <div class="grow"><b>${i+1}. ${esc(a.nombre)}</b>
                ${cuando(a)}
                <div class="meta">${asignable ? '' : `${I.guide}${esc(info.guiaNombre || 'Sin guía')}`}${conteo(a)}</div>
                ${asignable ? `<div class="asignar-fila">
                  <select class="asignar" id="as_${a.id}" data-id="${a.id}" aria-label="Guía de ${esc(a.nombre)}" ${dis()}>
                    <option value="">Sin guía</option>
                    ${S.guias.map(x=>`<option value="${x.id}" ${x.id===info.guiaId?'selected':''}>${esc(x.nombre)}</option>`).join('')}
                  </select>
                  <select class="asignar-dia" id="dia_${a.id}" data-id="${a.id}" aria-label="Día de ${esc(a.nombre)}" ${dis()}>
                    <option value="1" ${diaDe(a.id)===1?'selected':''}>Día 1</option>
                    <option value="2" ${diaDe(a.id)===2?'selected':''}>Día 2</option>
                  </select></div>` : ''}
              </div>
              ${pillEstado(st)}</div>`;
          })}
        </section>
      </div>
    </div>
  </main>${band}`;
}

/* ---------- Turista ---------- */
/* Estado de una actividad desde el punto de vista del turista */
function vistaTurista(id){
  const st = estado(id), p = S.miPart[id];
  if(p?.sellado) return 'sellada';
  if(st==='abierta') return p ? 'dentro' : 'abierta';
  if(st==='completada') return 'perdida';
  return 'bloqueada';
}
const chipTurista = v => ({
  sellada:  `<span class="chip" style="color:#3f5a2e">${I.check} Sellada</span>`,
  dentro:   `<span class="chip" style="color:#9a3c22">${I.live} Estás dentro · espera tu sello</span>`,
  abierta:  `<span class="chip" style="color:#9a3c22">${I.live} Abierta · entra ya</span>`,
  perdida:  `<span class="chip">${fa('xmark')} No participaste</span>`,
  bloqueada:`<span class="chip">${I.lock} Pendiente</span>`
}[v]);
const apagada = v => v==='bloqueada' || v==='perdida';

function vTurista(){
  const g = S.grupo;
  if(!g) return vSinGrupo();
  if(ui.detalle && actById(ui.detalle)) return vDetalle(actById(ui.detalle));

  let body;
  if(g.estado==='esperando') body = vEspera();
  else if(ui.tab==='pasaporte') body = vPasaporte();
  else if(ui.tab==='info') body = vInfo();
  else body = g.estado==='finalizado' ? vFinal() : vRuta();

  const nav = g.estado==='esperando' ? '' : `<nav class="nav" aria-label="Secciones">
    ${[['ruta','route','Ruta'],['pasaporte','medal','Pasaporte'],['info','info','Info']].map(([k,ic,t])=>
      `<button data-act="tab" data-id="${k}" ${ui.tab===k?'aria-current="page"':''}>${I[ic]}${t}</button>`).join('')}
  </nav>`;
  return topbar() + body + nav + (ui.confirmar ? '' : (vModal() || vPreview()));
}

function vEspera(){
  return `<main class="wrap">
    <div class="status wait"><span class="dot"></span>Esperando el inicio del recorrido · ${esc(S.grupo.nombre)}</div>
    <div class="espera-grid">
      <section class="list" aria-label="Las experiencias">
        ${porDia((a,i)=>`<div class="row">${badge(a,true,48)}<div class="grow"><b>${i+1}. ${esc(a.nombre)}</b>
          <div class="meta">${esc(a.tipo)}${S.acts[a.id]?.guiaNombre ? ` · ${I.guide}${esc(S.acts[a.id].guiaNombre)}` : ''}</div>
          ${cuando(a)}
          <div class="meta">${I.hourglass} ${esc(duracion(a))}${lugar(a)}</div></div>
          <button class="btn btn-ghost btn-sm" data-act="preview" data-id="${a.id}" aria-label="Vista previa de ${esc(a.nombre)}">${I.eye} Ver</button></div>`)}
      </section>
      <div class="stack">
        ${vReglas()}
        <button class="btn btn-ghost" data-act="leave" ${dis()}>Salir del recorrido</button>
      </div>
    </div>
  </main>${band}`;
}
function vReglas(){
  return `<section class="panel">
    <div class="sec"><h3>${I.book} Reglamento</h3><ul class="tight"><li>Sigue las indicaciones del guía en cada actividad.</li><li>Toca "Entrar" cuando tu guía abra la actividad; solo así recibes tu sello.</li><li>No dejes basura en la playa.</li></ul></div>
    <div class="sec"><h3>${I.sunglasses} Recomendaciones</h3><ul class="tight"><li>Trae agua, gorra y bloqueador.</li><li>Ropa cómoda que se pueda ensuciar.</li><li>Mantén tu celular con batería para registrar tu avance.</li></ul></div>
  </section>`;
}

function bloqueEntrar(a){
  const v = vistaTurista(a.id);
  if(v==='abierta') return `<button class="btn btn-terra" data-act="entrar" data-id="${a.id}" ${dis()}>${fa('right-to-bracket')} Entrar a la actividad</button>`;
  if(v==='dentro') return `<p class="final-msg" style="font-weight:600">${fa('hourglass-half')} Ya estás dentro. ${esc(S.acts[a.id]?.guiaNombre || 'Tu guía')} te sellará al terminar.</p>`;
  return '';
}

function vRuta(){
  const a = ACTS.find(x=>estado(x.id)==='abierta');
  return `<main class="wrap" style="padding-bottom:0">
    <div><h2 class="screen-title">Ruta del día</h2>${zig}</div>
    <div class="route">
      ${ACTS.map(x=>{
        const v = vistaTurista(x.id);
        return `<div class="stop ${v==='sellada'?'completada':v==='abierta'||v==='dentro'?'activa':'bloqueada'}">${badge(x, apagada(v), 58)}
          <button class="info" data-act="preview" data-id="${x.id}" aria-label="Vista previa de ${esc(x.nombre)}">
            <span class="dia-tag">${esc(etiquetaDia(diaDe(x.id), true))}</span>
            <b>${esc(x.nombre)}</b>${chipTurista(v)}
            <span class="ver">${I.eye} Vista previa</span>
          </button></div>`;
      }).join('')}
    </div>
    ${a ? `<section class="panel now">
      <div class="row" style="border:0;padding:0;background:none">${badge(a,false,60)}
        <div class="grow"><span class="eyebrow">Ahora · ${esc(etiquetaDia(diaDe(a.id), true))}</span><h3 style="font-size:20px">${esc(a.nombre)}</h3>
        <div class="meta">${I.guide}${esc(S.acts[a.id]?.guiaNombre || '')} &nbsp; ${I.hourglass} ${esc(duracion(a))}${lugar(a)}</div></div></div>
      <p class="desc corta">${esc(a.desc)}</p>
      ${bloqueEntrar(a)}
      <button class="btn btn-ghost" data-act="detail" data-id="${a.id}">Ver actividad ${I.arrow}</button>
    </section>` : `<p class="muted" style="text-align:center">Esperando que el guía abra la siguiente experiencia.</p>`}
  </main>${hills}${band}`;
}

function vPasaporte(){
  const total = ACTS.length, n = misSellos();
  return `<main class="wrap">
    <div><h2 class="screen-title">Mi pasaporte</h2>${zig}</div>
    <div class="progress" aria-label="${n} de ${total}"><span style="width:${total ? n/total*100 : 0}%"></span></div>
    <p style="text-align:center;font-weight:700">${n} de ${total} insignias</p>
    <div class="pass">${ACTS.map(a=>{ const v = vistaTurista(a.id); return `<div>${badge(a, v!=='sellada', 96)}
      <b>${esc(a.nombre)}</b><span class="meta">${v==='sellada'?'Sello: '+esc(a.sello):v==='perdida'?'No participaste':v==='bloqueada'?'Pendiente':'En curso'}</span></div>`; }).join('')}</div>
    <p class="leaf">${I.ecoleaf} Recorrido digital · Menos papel</p>
  </main>${band}`;
}

function vInfo(){ return `<main class="wrap narrow"><div><h2 class="screen-title">Información</h2>${zig}</div>${vReglas()}</main>${hills}${band}`; }

function vFinal(){
  const n = misSellos(), total = ACTS.length;
  return `<main class="wrap">
    <div><h2 class="screen-title">Recorrido finalizado</h2>${zig}</div>
    <div class="pass">${ACTS.map(a=>{ const ok = vistaTurista(a.id)==='sellada'; return `<div>${badge(a,!ok,92)}<b>${esc(a.nombre)}</b><span class="meta">${ok?'Sellada':'Sin sello'}</span></div>`; }).join('')}</div>
    <p class="final-msg">${n===total ? `¡Felicidades! Juntaste tus ${total} insignias.` : `Juntaste ${n} de ${total} insignias.`}<br>Gracias por recorrer ${esc(S.grupo.nombre)}.</p>
    <p class="leaf">${I.ecoleaf} Recorrido digital · Menos papel</p>
    <button class="btn btn-ghost" data-act="leave" ${dis()}>Salir del recorrido</button>
  </main>${band}`;
}

function vDetalle(a){
  const i = ACTS.indexOf(a), v = vistaTurista(a.id), st = estado(a.id);
  const barra = { sellada:['Actividad sellada','#7f9a6c'], dentro:['Estás dentro · espera tu sello',''], abierta:['Actividad abierta',''],
                  perdida:['Actividad terminada','#8a7d70'], bloqueada:['Pendiente','#8a7d70'] }[v];
  return `<div class="det-head"><div class="wrap"><button class="back" data-act="back" aria-label="Volver">${I.back}</button>
      <h2>${esc(a.tipo)}</h2><span style="opacity:.85">${esc(a.nombre)} · Experiencia ${i+1} de ${ACTS.length}</span>
      <span style="opacity:.85;font-size:13.5px">${I.cal} ${esc(etiquetaDia(diaDe(a.id)))} · ${esc(a.hora)}</span></div></div>
    <div class="det-bar" style="${barra[1]?`background:${barra[1]}`:''}">${barra[0]}</div>
    <main class="wrap">
      ${foto(a, 'act-foto')}
      ${bloqueEntrar(a)}
      <div class="det-grid">
        <div class="sec"><h3>${I.target} Objetivo</h3><p>${esc(a.obj)}</p></div>
        <div class="sec"><h3>${I.hourglass} Duración</h3>
          ${st==='abierta' ? `<span class="timer" id="timer">00:00:00</span> <span class="meta">de ${esc(duracion(a))}</span>` : `<p>${esc(duracion(a))}</p>`}</div>
        <div class="sec"><h3>${I.text} Descripción</h3><p class="desc">${esc(a.desc)}</p><p class="meta" style="margin-top:4px">${a.lugar ? `${I.pin}${esc(a.lugar)} · ` : ''}${I.guide}${esc(S.acts[a.id]?.guiaNombre || '')}</p></div>
        ${a.pasos.length ? `<div class="sec"><h3>${I.list} Instrucciones</h3><ol class="tight">${a.pasos.map(p=>`<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}
        ${a.mat ? `<div class="sec"><h3>${I.box} Materiales</h3><p>${esc(a.mat)}</p></div>` : ''}
        ${a.seg.length ? `<div class="sec"><h3>${I.shield} Seguridad y accesibilidad</h3><ul class="tight">${a.seg.map(p=>`<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
        ${a.eco ? `<div class="sec"><h3>${I.recycle} Acción sustentable</h3><p>${esc(a.eco)}</p></div>` : ''}
        <div class="phone-tip full"><span class="ph">${I.phone}</span><span>Guarda tu celular para disfrutar la actividad.</span></div>
      </div>
    </main>${hills}${band}`;
}

/* Aviso de confirmación (salir del grupo / cerrar grupo) */
function vConfirmar(){
  if(!ui.confirmar || !S.me || (!S.grupo && ui.confirmar !== 'cuenta')) return '';
  const t = textosConfirmar(ui.confirmar);
  return `<div class="overlay" role="alertdialog" aria-modal="true" aria-labelledby="cfTitle" aria-describedby="cfText">
    <div class="backdrop" data-act="confirm-no"></div>
    <div class="modal dialogo">
      <div class="dlg-icon ${t.peligro?'peligro':''}">${t.peligro ? I.warn : I.door}</div>
      <h2 id="cfTitle">${t.title}</h2>
      <p id="cfText">${t.html}</p>
      <div class="dlg-actions">
        <button class="btn btn-ghost" data-act="confirm-no">Cancelar</button>
        <button class="btn btn-terra" data-act="confirm-yes" ${dis()}>${t.confirm}</button>
      </div>
    </div>
  </div>`;
}

function vPreview(){
  const a = actById(ui.preview);
  if(!a) return '';
  const i = ACTS.indexOf(a), v = vistaTurista(a.id), info = S.acts[a.id] || {};
  return `<div class="overlay sheet-wrap" role="dialog" aria-modal="true" aria-labelledby="pvTitle">
    <div class="backdrop" data-act="preview-close"></div>
    <div class="sheet">
      <div class="grip" aria-hidden="true"></div>
      ${foto(a, 'act-foto pv')}
      <div class="row" style="border:0;padding:0;background:none">${badge(a, apagada(v), 64)}
        <div class="grow"><span class="eyebrow">Vista previa · ${i+1} de ${ACTS.length}</span>
          <h2 id="pvTitle" style="font-size:22px">${esc(a.nombre)}</h2><div class="meta">${esc(a.tipo)}</div></div>
        <button class="icon-btn" data-act="preview-close" aria-label="Cerrar vista previa">${I.close}</button></div>
      <div>${chipTurista(v)}</div>
      <div class="pv-facts">
        <div><b>Cuándo</b>${I.cal} ${esc(etiquetaDia(diaDe(a.id), true))} · ${esc(a.hora)}</div>
        <div><b>Duración</b>${I.hourglass} ${esc(duracion(a))}</div>
        <div><b>Lugar</b>${I.pin} ${esc(a.lugar || 'Por confirmar')}</div>
        <div><b>Guía</b>${I.guide} ${esc(info.guiaNombre || 'Por asignar')}</div>
      </div>
      <p class="desc">${esc(a.desc)}</p>
      <div class="sec"><h3>${I.target} Objetivo</h3><p>${esc(a.obj)}</p></div>
      ${a.mat ? `<div class="sec"><h3>${I.box} Qué llevar</h3><p>${esc(a.mat)}</p></div>` : ''}
      ${a.seg.length ? `<div class="sec"><h3>${I.shield} Seguridad y accesibilidad</h3><ul class="tight">${a.seg.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
      ${bloqueEntrar(a)}
      <button class="btn btn-ghost" data-act="preview-full" data-id="${a.id}">Ver detalle completo ${I.arrow}</button>
    </div>
  </div>`;
}

function vModal(){
  const pend = pendienteDeEvaluar();
  if(!pend) return '';
  const n = misSellos(), total = ACTS.length;
  const opts = [['Regular',I.r1],['Buena',I.r2],['Excelente',I.r3]];
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="mTitle"><div class="modal">
    ${badge(pend,false,110)}
    <h2 id="mTitle">¡Recibiste tu sello!</h2>
    <p>${esc(pend.fin)}</p>
    <span class="pill completada">Sello: ${esc(pend.sello)} · ${n} de ${total}</span>
    <p style="font-weight:700;margin-top:4px">¿Qué te pareció ${esc(pend.nombre)}?</p>
    <div class="rate">${opts.map(([t,e])=>`<button data-act="rate" data-id="${t}" aria-pressed="${ui.rating===t}">${e}${t}</button>`).join('')}</div>
    <button class="btn btn-terra" data-act="ack" data-id="${pend.id}" ${ui.rating && !ui.busy ?'':'disabled'}>Listo</button>
  </div></div>`;
}

/* ---------- Render ---------- */
let ultimoHtml = '';
function vista(){
  if(!configOk()) return vConfig();
  if(ui.cargando) return vCargando();
  if(!S.me) return ui.screen==='auth' ? vAuth() : vWelcome();
  return (S.me.rol==='guia' ? vGuia() : vTurista()) + vConfirmar();
}

function render(){
  clearInterval(timerId);
  const app = document.getElementById('app');
  const html = vista();

  // Si la pantalla quedaría igual, no se toca (evita parpadeos y saltos)
  if(html !== ultimoHtml){
    // Guarda lo que el usuario ya escribió para no perderlo al redibujar
    const prev = {};
    app.querySelectorAll('form input[id], form select[id]').forEach(el=>{
      prev[el.id] = (el.type==='checkbox') ? el.checked : el.value;
    });
    const habiaVentana = !!app.querySelector('.overlay');
    const scrolls = {};
    app.querySelectorAll('[data-scroll-id]').forEach(el=>{ scrolls[el.dataset.scrollId] = el.scrollTop; });

    app.innerHTML = html;
    ultimoHtml = html;

    Object.entries(prev).forEach(([id,val])=>{
      const el = document.getElementById(id);
      if(!el) return;
      if(el.type==='checkbox') el.checked = val; else el.value = val;
    });
    app.querySelectorAll('[data-scroll-id]').forEach(el=>{ if(scrolls[el.dataset.scrollId]) el.scrollTop = scrolls[el.dataset.scrollId]; });
    // La ventana que ya estaba abierta no vuelve a animarse
    if(habiaVentana) app.querySelectorAll('.overlay').forEach(o=>o.classList.add('sin-anim'));
  }
  document.body.classList.toggle('lock', !!app.querySelector('.overlay'));

  const spans = document.querySelectorAll('[data-desde]');
  const tickDesde = ()=>spans.forEach(el=>{ const m = Math.max(0,Math.floor((Date.now()-Number(el.dataset.desde))/60000)); el.textContent = m+' min'; });
  const t = document.getElementById('timer');
  if(t && ui.detalle){
    const since = S.acts[ui.detalle]?.abiertaEn || Date.now();
    const tick = ()=>{ const s = Math.max(0,Math.floor((Date.now()-since)/1000));
      t.textContent = [s/3600,(s%3600)/60,s%60].map(x=>String(Math.floor(x)).padStart(2,'0')).join(':'); };
    tick(); timerId = setInterval(()=>{ tick(); tickDesde(); },1000);
  } else if(spans.length){ tickDesde(); timerId = setInterval(tickDesde, 15000); }
}

/* No redibuja mientras alguien escribe en un formulario */
function renderSeguro(){
  const escribiendo = document.querySelector('#authForm,#groupForm,#joinForm') && document.activeElement?.tagName === 'INPUT';
  if(!escribiendo) render();
}

/* Corre una acción contra Supabase con botón bloqueado y manejo de errores */
async function run(fn, okMsg){
  if(ui.busy) return;
  ui.busy = true; render();
  try {
    await fn();
    await refresh();
    if(okMsg) toast(okMsg);
  } catch(e) {
    console.error(e);
    toast(mensajeError(e));
  } finally {
    ui.busy = false; render();
  }
}

/* Al iniciar o cerrar sesión */
async function entrar(){
  await cargarPerfil();
  if(!S.me) throw new Error('No se encontró tu perfil. Revisa que el trigger de database/schema.sql esté creado.');
  if(!ACTS.length){ await cargarActividades(); ui.aviso = ACTS.length ? '' : ui.aviso; }
  await refresh();
  suscribir(renderSeguro);
  ui = {...ui, err:'', tab:'ruta', detalle:null, screen:'welcome'};
}

/* ---------- Clics ---------- */
document.addEventListener('click', e=>{
  // Cerrar el menú del perfil al tocar fuera de él
  if(ui.menu && !e.target.closest('.menu-perfil, [data-act=menu]')){ ui.menu = false; if(!e.target.closest('[data-act]')) { render(); return; } }
  const b = e.target.closest('[data-act]'); if(!b || b.disabled) return;
  const id = b.dataset.id;
  switch(b.dataset.act){
    case 'go-register': ui = {...ui, screen:'auth', authTab:'register', err:''}; break;
    case 'go-login': ui = {...ui, screen:'auth', authTab:'login', err:''}; break;
    case 'go-welcome': ui.screen = 'welcome'; ui.err=''; break;
    case 'tab-login': ui.authTab = 'login'; ui.err=''; break;
    case 'tab-register': ui.authTab = 'register'; ui.err=''; break;
    case 'rol-turista': ui.rol = 'turista'; break;
    case 'rol-guia': ui.rol = 'guia'; break;
    case 'tab': ui.tab = id; break;
    case 'detail': ui.detalle = id; window.scrollTo(0,0); break;
    case 'back': ui.detalle = null; break;
    case 'ver': ui.ver = {...ui.ver, [id]: !ui.ver[id]}; break;
    case 'preview': ui.preview = id; break;
    case 'preview-close': ui.preview = null; break;
    case 'preview-full': ui.preview = null; ui.detalle = id; window.scrollTo(0,0); break;
    case 'rate': ui.rating = id; break;
    case 'close-ask': preguntar('close'); return;
    case 'confirm-no': ui.confirmar = null; break;
    case 'terminar': ui.confirmTerm = id; break;
    case 'terminar-no': ui.confirmTerm = null; break;
    case 'reintentar': iniciar(); return;

    case 'logout':
      desuscribir();
      run(cerrarSesion);
      ui = {...ui, screen:'welcome', detalle:null, preview:null, tab:'ruta', err:'', confirmClose:false, confirmTerm:null, confirmar:null, menu:false};
      return;
    case 'start':        run(iniciarRecorrido, 'Recorrido iniciado. El guía de la primera actividad ya puede abrirla.'); return;
    case 'abrir':        run(()=>abrirActividad(id), `${actById(id).nombre} abierta`); return;
    case 'sellar':       run(()=>sellar(id, b.dataset.t), 'Sellado'); return;
    case 'sellar-todos': run(()=>sellar(id, null), 'Todos sellados'); return;
    case 'terminar-si':  ui.confirmTerm = null; run(()=>terminarActividad(id), `${actById(id).nombre} terminada`); return;
    case 'entrar':       run(()=>entrarActividad(id), 'Entraste a la actividad'); return;
    case 'leave':        preguntar('leave'); return;
    case 'menu':          ui.menu = !ui.menu; break;
    case 'borrar-cuenta': ui.menu = false; render(); preguntar('cuenta'); return;
    case 'confirm-yes': { const tipo = ui.confirmar; ui.confirmar = null; confirmado(tipo); return; }
    case 'ack': {
      const valor = ui.rating;
      ui.rating = null;
      run(()=>evaluar(id, valor), 'Gracias por tu evaluación');
      return;
    }
  }
  render();
});

/* ---------- Avisos de confirmación con SweetAlert2 ---------- */
function textosConfirmar(tipo){
  const guia = S.me.rol === 'guia', g = S.grupo ? esc(S.grupo.nombre) : '';
  if(tipo === 'cuenta'){
    const admin = soyAdmin();
    return { icon:'warning', title:'¿Borrar tu cuenta?', confirm:'Sí, borrar mi cuenta', peligro:true,
      html:`Se borra la cuenta de <b>${esc(S.me.nombre)}</b> (${guia ? 'guía' : 'turista'}) con ${guia ? 'tu lugar en los grupos' : 'tus sellos, evaluaciones y tu lugar en el recorrido'}.`
        + (admin ? `<br><b>Eres admin de ${g}: ese grupo también se borra.</b>` : '')
        + `<br>Después puedes registrarte otra vez con el mismo correo. <b>No se puede deshacer.</b>` };
  }
  if(tipo === 'close') return { icon:'warning', title:'¿Cerrar el grupo?', confirm:'Sí, cerrar grupo', peligro:true,
    html:`Se borra <b>${g}</b> con todo su avance, sellos y evaluaciones.<br>Los guías y turistas quedarán fuera. <b>No se puede deshacer.</b>` };
  if(guia) return { icon:'question', title:'¿Seguro que quieres salir del grupo?', confirm:'Sí, salir',
    html:`Dejarás de dirigir tu actividad en <b>${g}</b> y el admin tendrá que asignarla a otro guía.<br>Para regresar necesitas el código.` };
  return { icon:'question', title:'¿Seguro que quieres salir del recorrido?', confirm:'Sí, salir',
    html:`Saldrás de <b>${g}</b>. Tus sellos se quedan guardados, pero para regresar tendrás que unirte otra vez con el código.` };
}

function confirmado(tipo){
  ui.tab = 'ruta'; ui.detalle = null; ui.preview = null; ui.menu = false;
  if(tipo === 'cuenta'){
    desuscribir();
    ui = {...ui, screen:'welcome', ver:{}, confirmTerm:null, err:''};
    run(borrarCuenta, 'Tu cuenta se borró');
    return;
  }
  if(tipo === 'close') run(cerrarGrupo, 'Grupo cerrado');
  else run(salirGrupo, 'Saliste del grupo');
}

function preguntar(tipo){
  if(!S.grupo && tipo !== 'cuenta') return;
  // Si SweetAlert2 no cargó (sin internet), se usa el aviso propio de la app
  if(!window.Swal){ ui.confirmar = tipo; render(); return; }
  const t = textosConfirmar(tipo);
  Swal.fire({
    icon: t.icon,
    title: t.title,
    html: t.html,
    showCancelButton: true,
    confirmButtonText: t.confirm,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor: t.peligro ? '#b23a22' : '#d8644a',
    cancelButtonColor: '#7d6a5a',
    heightAuto: false,               // que no le cambie la altura a la página
    customClass: { popup: 'sbc-swal' }
  }).then(r => { if(r.isConfirmed) confirmado(tipo); });
}

/* Esc cierra la vista previa */
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && (ui.preview || ui.confirmar || ui.menu)){ ui.preview = null; ui.confirmar = null; ui.menu = false; render(); }
});

/* El admin asigna guía con el menú de cada actividad */
document.addEventListener('change', e=>{
  const sd = e.target.closest('select.asignar-dia');
  if(sd){ const n = actById(sd.dataset.id).nombre; run(()=>asignarDia(sd.dataset.id, sd.value), `${n} va el día ${sd.value}`); return; }
  const fg = e.target.closest('input.fecha-g');
  if(fg){ if(fg.value) run(()=>fijarFecha(fg.value), 'Fecha actualizada'); return; }
  const sel = e.target.closest('select.asignar'); if(!sel) return;
  const nombre = actById(sel.dataset.id).nombre;
  run(()=>asignar(sel.dataset.id, sel.value), sel.value ? `Guía asignado a ${nombre}` : `${nombre} quedó sin guía`);
});

/* ---------- Formularios ---------- */
document.addEventListener('submit', async e=>{
  e.preventDefault();
  if(ui.busy) return;
  const f = e.target, fd = new FormData(f), v = k => (fd.get(k)||'').toString().trim();

  if(f.id==='authForm'){
    const correo = v('correo').toLowerCase(), pass = v('pass');
    const reg = ui.authTab==='register';
    if(reg){
      const nombre = v('nombre');
      if(!nombre || !correo || pass.length<6){ ui.err = 'Llena nombre, correo y una contraseña de al menos 6 caracteres.'; return render(); }
      if(ui.rol==='turista' && (!v('edad') || !v('municipio'))){ ui.err = 'Falta tu rango de edad o municipio.'; return render(); }
      if(!fd.get('ok')){ ui.err = 'Necesitas aceptar el uso de datos para continuar.'; return render(); }
    } else if(!correo || !pass){ ui.err = 'Escribe tu correo y tu contraseña.'; return render(); }

    ui.busy = true; ui.err = ''; render();
    try{
      if(reg){
        const conSesion = await registrar({ correo, pass, nombre:v('nombre'), rol:ui.rol, edad:v('edad'), municipio:v('municipio'), acces:fd.getAll('acces') });
        if(!conSesion) await iniciarSesion(correo, pass);   // entra directo, sin esperar correo
        toast('Registro completado');
      } else {
        await iniciarSesion(correo, pass);
      }
      await entrar();
    }catch(err){
      console.error(err);
      ui.err = mensajeError(err);
    }finally{
      ui.busy = false; render();
    }
    return;
  }

  if(f.id==='groupForm'){
    if(!v('fecha')){ toast('Elige la fecha del día 1'); return; }
    run(()=>crearGrupo(v('nombre') || 'Grupo Sunset Beach Camp', v('fecha')), 'Grupo creado');
    return;
  }

  if(f.id==='joinForm'){
    const code = v('code');
    if(!code){ ui.err = 'Escribe el código que te dio tu guía.'; return render(); }
    ui.err = ''; ui.busy = true; render();
    try{
      await unirseGrupo(code);
      await refresh();
      toast(S.me?.rol==='guia' ? 'Te uniste al grupo' : 'Te uniste al recorrido');
    }catch(err){
      ui.err = mensajeError(err);
    }finally{
      ui.busy = false; render();
    }
  }
});

/* ---------- Arranque ---------- */
async function iniciar(){
  if(!configOk()) return render();
  ui.cargando = true; ui.errorInicio = ''; ui.aviso = ''; render();
  try{
    if(!sb) initSupabase();
    try{ await cargarActividades(); }catch(e){ console.error(e); }
    await cargarPerfil();
    if(S.me){
      if(!ACTS.length) await cargarActividades();
      await refresh(); suscribir(renderSeguro);
    }
    if(!ACTS.length) ui.aviso = 'No se pudieron cargar las actividades. Revisa que hayas corrido database/schema.sql en Supabase.';
    ui.cargando = false;
  }catch(e){
    console.error(e);
    ui.errorInicio = mensajeError(e);
  }
  render();
}

iniciar();
