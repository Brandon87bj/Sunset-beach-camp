/* =========================================================
   CAPA DE DATOS — Supabase
   Aquí está todo lo que habla con la base de datos.
   Las tablas, permisos y funciones están en database/schema.sql
   ========================================================= */

let sb = null;          // cliente de Supabase
let ACTS = [];          // catálogo de actividades (tabla "actividades"), ya en orden

/* Estado que leen las pantallas */
const S = {
  me: null,             // { id, nombre, rol }
  grupo: null,          // { id, nombre, codigo, adminId, estado }
  acts: {},             // { actividad_id: { estado, guiaId, guiaNombre, abiertaEn } }
  guias: [],            // [{ id, nombre }]
  turistas: [],         // solo guías: [{ id, nombre }]
  part: [],             // guías: [{ actividad_id, turista_id, nombre, sellado }]
  miPart: {},           // turista: { actividad_id: { sellado } }
  evals: [],            // guías: [{ actividad_id, valor }]
  misEvals: [],         // turista: [actividad_id]
  abiertos: []          // sin grupo: recorridos disponibles
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Math.random().toString(36).slice(2,9);
const ms = f => f ? new Date(f).getTime() : 0;
const actById = id => ACTS.find(a=>a.id===id);
const estado = id => S.acts[id]?.estado || 'bloqueada';
const terminadas = () => ACTS.filter(a=>estado(a.id)==='completada').length;
const soyAdmin = () => !!(S.grupo && S.me && S.grupo.adminId === S.me.id);
const misActividades = () => ACTS.filter(a => S.acts[a.id]?.guiaId === S.me?.id);
const puedoDirigir = id => soyAdmin() || S.acts[id]?.guiaId === S.me?.id;
const misSellos = () => ACTS.filter(a => S.miPart[a.id]?.sellado).length;

/* ---------- Días del recorrido (2 días) ---------- */
const diaDe = id => S.acts[id]?.dia || actById(id)?.dia || 1;
const diasUsados = () => [...new Set(ACTS.map(a => diaDe(a.id)))].sort();
function fechaDelDia(d){
  const f = S.grupo?.fechaInicio; if (!f) return null;
  const [y, m, dd] = f.split('-').map(Number);
  return new Date(y, m - 1, dd + d - 1);
}
/* "Día 1 · sábado, 21 de noviembre"  |  corto: "Día 1 · sáb 21 nov" */
function etiquetaDia(d, corto){
  const f = fechaDelDia(d);
  if (!f) return `Día ${d}`;
  const txt = corto
    ? f.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' }).replace(/[.,]/g, '')
    : f.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
  return `Día ${d} · ${txt}`;
}

/* La siguiente actividad que toca abrir (orden fijo) */
function siguientePorAbrir(){
  if (ACTS.some(a => estado(a.id)==='abierta')) return null;
  return ACTS.find(a => estado(a.id)==='bloqueada') || null;
}

/* Revisa que js/config.js ya tenga los datos del proyecto */
function configOk(){
  return typeof SUPABASE_URL === 'string' && /^https:\/\/.+/.test(SUPABASE_URL) && !SUPABASE_URL.includes('PEGA-')
      && typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 20 && !SUPABASE_ANON_KEY.includes('PEGA-');
}

/* La sesión se guarda por pestaña (sessionStorage) para poder probar
   varios usuarios en pestañas del mismo navegador. */
function initSupabase(){
  // Limpia lo que guardaba la versión de prueba (antes de Supabase)
  try { localStorage.removeItem('sbc_db_v1'); sessionStorage.removeItem('sbc_user'); } catch(e) {}
  let storage;
  try { window.sessionStorage.setItem('_t','1'); window.sessionStorage.removeItem('_t'); storage = window.sessionStorage; } catch(e) {}
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage, persistSession: true, autoRefreshToken: true }
  });
}

/* Ejecuta una consulta y lanza el error si lo hay */
async function q(promesa){
  const { data, error } = await promesa;
  if (error) throw error;
  return data;
}

/* ---------- Lecturas ---------- */
async function cargarActividades(){
  const rows = await q(sb.from('actividades').select('*').order('orden'));
  ACTS = rows.map(r => ({
    id: r.id, nombre: r.nombre, tipo: r.tipo, icon: r.icono, c: r.color, dia: r.dia || 1,
    hora: (r.hora || '').slice(0,5), dur: r.duracion_min, lugar: r.lugar,
    desc: r.descripcion, obj: r.objetivo, pasos: r.pasos || [], mat: r.materiales,
    seg: r.seguridad || [], eco: r.accion_sustentable, fin: r.mensaje_final, sello: r.sello
  }));
}

async function cargarPerfil(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { S.me = null; return; }
  const p = await q(sb.from('perfiles').select('id, nombre, rol').eq('id', session.user.id).maybeSingle());
  if (!p) { await sb.auth.signOut(); S.me = null; return; }   // la cuenta ya no existe
  S.me = p;
}

function limpiarGrupo(){
  Object.assign(S, { grupo:null, acts:{}, guias:[], turistas:[], part:[], miPart:{}, evals:[], misEvals:[], abiertos:[] });
}

const mapGrupo = g => g ? { id:g.id, nombre:g.nombre, codigo:g.codigo, adminId:g.admin_id, estado:g.estado, fechaInicio:g.fecha_inicio || null } : null;

/* Lee todo lo que necesita la pantalla actual SIN tocar S.
   Así la pantalla nunca ve el estado a medias (eso causaba los parpadeos). */
async function leerEstado(){
  const N = { grupo:null, acts:{}, guias:[], turistas:[], part:[], miPart:{}, evals:[], misEvals:[], abiertos:[] };
  if (!S.me) return N;
  const guia = S.me.rol === 'guia', yo = S.me.id;

  // Grupo más reciente donde está el usuario
  const tabla = guia ? 'grupo_guias' : 'grupo_miembros';
  const col = guia ? 'guia_id' : 'turista_id';
  const m = await q(sb.from(tabla).select(`unido_en, grupo:grupos!${tabla}_grupo_id_fkey(*)`)
    .eq(col, yo).order('unido_en', { ascending:false }).limit(1).maybeSingle());
  N.grupo = mapGrupo(m?.grupo);

  if (!N.grupo) {
    N.abiertos = await q(sb.from('grupos').select('id, nombre, estado, admin:perfiles!grupos_admin_id_fkey(nombre)')
      .neq('estado', 'finalizado').order('created_at', { ascending:false }));
    return N;
  }
  const gid = N.grupo.id;

  // Todas las consultas del grupo en paralelo
  const [gact, gg, extra] = await Promise.all([
    q(sb.from('grupo_actividades').select('*, guia:perfiles!grupo_actividades_guia_id_fkey(nombre)').eq('grupo_id', gid)),
    q(sb.from('grupo_guias').select('guia_id, perfil:perfiles!grupo_guias_guia_id_fkey(nombre)').eq('grupo_id', gid).order('unido_en')),
    guia
      ? Promise.all([
          q(sb.from('grupo_miembros').select('turista_id, perfil:perfiles!grupo_miembros_turista_id_fkey(nombre)').eq('grupo_id', gid).order('unido_en')),
          q(sb.from('participaciones').select('actividad_id, turista_id, sellado_en, perfil:perfiles!participaciones_turista_id_fkey(nombre)').eq('grupo_id', gid).order('entro_en')),
          q(sb.from('evaluaciones').select('actividad_id, valor').eq('grupo_id', gid))
        ])
      : Promise.all([
          q(sb.from('participaciones').select('actividad_id, sellado_en').eq('grupo_id', gid).eq('turista_id', yo)),
          q(sb.from('evaluaciones').select('actividad_id').eq('grupo_id', gid).eq('turista_id', yo))
        ])
  ]);

  gact.forEach(r => {
    N.acts[r.actividad_id] = { estado:r.estado, guiaId:r.guia_id, guiaNombre:r.guia?.nombre || '', abiertaEn:ms(r.abierta_en), dia:r.dia || 1 };
  });
  N.guias = gg.map(r => ({ id:r.guia_id, nombre:r.perfil?.nombre || 'Guía' }));

  if (guia) {
    const [tt, pp, ev] = extra;
    N.turistas = tt.map(r => ({ id:r.turista_id, nombre:r.perfil?.nombre || 'Turista' }));
    N.part = pp.map(r => ({ actividad_id:r.actividad_id, turista_id:r.turista_id, nombre:r.perfil?.nombre || 'Turista', sellado:!!r.sellado_en }));
    N.evals = ev;
  } else {
    const [pp, ev] = extra;
    pp.forEach(r => { N.miPart[r.actividad_id] = { sellado: !!r.sellado_en }; });
    N.misEvals = ev.map(r => r.actividad_id);
  }
  return N;
}

/* Vuelve a leer y cambia todo el estado de golpe.
   Si llega otra petición mientras lee, se encola una sola vuelta más. */
let leyendo = null, otraVez = false;
async function refresh(){
  if (leyendo) { otraVez = true; return leyendo; }
  leyendo = (async () => {
    do {
      otraVez = false;
      const N = await leerEstado();
      Object.assign(S, N);
    } while (otraVez);
  })();
  try { await leyendo; } finally { leyendo = null; }
}

/* Sello que el turista acaba de recibir y todavía no evalúa */
function pendienteDeEvaluar(){
  return ACTS.find(a => S.miPart[a.id]?.sellado && !S.misEvals.includes(a.id));
}

/* ---------- Escrituras ---------- */
async function registrar({ correo, pass, nombre, rol, edad, municipio, acces }){
  const { data, error } = await sb.auth.signUp({
    email: correo, password: pass,
    options: { data: { nombre, rol, edad_rango: edad || null, municipio: municipio || null, accesibilidad: acces || [] } }
  });
  if (error) throw error;
  return !!data.session;   // sin sesión: la app intenta entrar con iniciarSesion()
}

async function iniciarSesion(correo, pass){
  const { error } = await sb.auth.signInWithPassword({ email: correo, password: pass });
  if (error) throw error;
}

async function cerrarSesion(){ await sb.auth.signOut(); S.me = null; limpiarGrupo(); }

const rpc = (fn, args) => q(sb.rpc(fn, args));

async function crearGrupo(nombre, fecha){
  const { error } = await sb.from('grupos').insert({ nombre, admin_id: S.me.id, fecha_inicio: fecha || null });
  // Si la base todavía no tiene la columna de fecha (falta migracion_dias.sql), crea el grupo sin fecha
  if (error && /fecha_inicio/i.test(error.message || '')) { await q(sb.from('grupos').insert({ nombre, admin_id: S.me.id })); return; }
  if (error) throw error;
}
async function cerrarGrupo(){ await q(sb.from('grupos').delete().eq('id', S.grupo.id)); }
async function unirseGrupo(codigo){ await rpc('unirse_grupo', { p_codigo: codigo }); }
async function salirGrupo(){ await rpc('salir_grupo', { p_grupo: S.grupo.id }); }
async function asignar(actividadId, guiaId){ await rpc('asignar_actividad', { p_grupo: S.grupo.id, p_actividad: actividadId, p_guia: guiaId || null }); }
async function iniciarRecorrido(){ await rpc('iniciar_recorrido', { p_grupo: S.grupo.id }); }
async function abrirActividad(id){ await rpc('abrir_actividad', { p_grupo: S.grupo.id, p_actividad: id }); }
async function entrarActividad(id){ await rpc('entrar_actividad', { p_grupo: S.grupo.id, p_actividad: id }); }
async function sellar(id, turistaId){ return rpc('sellar', { p_grupo: S.grupo.id, p_actividad: id, p_turista: turistaId || null }); }
async function asignarDia(actividadId, dia){ await rpc('asignar_dia', { p_grupo: S.grupo.id, p_actividad: actividadId, p_dia: Number(dia) }); }
async function fijarFecha(fecha){ await rpc('fijar_fecha', { p_grupo: S.grupo.id, p_fecha: fecha || null }); }
async function terminarActividad(id){ await rpc('terminar_actividad', { p_grupo: S.grupo.id, p_actividad: id }); }

async function evaluar(actividadId, valor){
  const { error } = await sb.from('evaluaciones').insert({
    grupo_id: S.grupo.id, actividad_id: actividadId, turista_id: S.me.id, valor
  });
  if (error && error.code !== '23505') throw error;   // 23505 = ya la había evaluado
}

/* ---------- Tiempo real ---------- */
let canal = null, refT = null, alCambiar = () => {};

function suscribir(cb){
  alCambiar = cb;
  if (canal) sb.removeChannel(canal);
  canal = sb.channel('sbc-' + uid());
  ['grupos','grupo_guias','grupo_miembros','grupo_actividades','participaciones','evaluaciones'].forEach(t =>
    canal.on('postgres_changes', { event:'*', schema:'public', table:t }, pedirRefresh));
  canal.subscribe();
}

function desuscribir(){ if (canal) { sb.removeChannel(canal); canal = null; } }

function pedirRefresh(){
  clearTimeout(refT);
  refT = setTimeout(async () => {
    try { await refresh(); } catch(e) { console.error(e); }
    alCambiar();
  }, 400);
}

/* Respaldo por si Realtime no está activo: revisa cada 10 s */
setInterval(() => { if (S.me && !document.hidden) pedirRefresh(); }, 10000);
