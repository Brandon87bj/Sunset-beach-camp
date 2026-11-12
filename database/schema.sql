-- =========================================================
-- SUNSET BEACH CAMP — Base de datos (Supabase / PostgreSQL)
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar todo > Run
-- Se puede correr varias veces: borra y vuelve a crear las tablas.
-- (Las cuentas de usuario NO se borran aquí; para eso está reset.sql)
--
-- Cómo funciona:
--  * Un guía crea el grupo y queda como admin.
--  * Otros guías y los turistas se unen con el código SBC-####.
--  * El admin asigna a cada guía una de las 5 actividades.
--  * Orden fijo: la actividad 2 se abre cuando termina la 1, etc.
--  * El recorrido dura 2 días: el admin pone la fecha del día 1 y
--    elige en qué día va cada actividad.
--  * El guía abre SU actividad, los turistas le dan "Entrar"
--    y el guía sella solo a los que entraron.
-- =========================================================

-- ---------- Limpieza ----------
drop trigger if exists on_auth_user_created on auth.users;
drop table if exists public.evaluaciones cascade;
drop table if exists public.participaciones cascade;
drop table if exists public.grupo_actividades cascade;
drop table if exists public.grupo_miembros cascade;
drop table if exists public.grupo_guias cascade;
drop table if exists public.grupos cascade;
drop table if exists public.actividades cascade;
drop table if exists public.perfiles cascade;
drop function if exists public.crear_perfil() cascade;
drop function if exists public.al_crear_grupo() cascade;
drop function if exists public.crear_actividades_grupo() cascade;
drop function if exists public.generar_codigo() cascade;
drop function if exists public.es_admin_de(uuid) cascade;
drop function if exists public.es_guia_de(uuid) cascade;
drop function if exists public.es_guia_en(uuid) cascade;
drop function if exists public.es_miembro_de(uuid) cascade;
drop function if exists public.puede_dirigir(uuid, text) cascade;
drop function if exists public.unirse_grupo(text) cascade;
drop function if exists public.salir_grupo(uuid) cascade;
drop function if exists public.asignar_actividad(uuid, text, uuid) cascade;
drop function if exists public.iniciar_recorrido(uuid) cascade;
drop function if exists public.abrir_actividad(uuid, text) cascade;
drop function if exists public.entrar_actividad(uuid, text) cascade;
drop function if exists public.sellar(uuid, text, uuid) cascade;
drop function if exists public.terminar_actividad(uuid, text) cascade;
drop function if exists public.asignar_dia(uuid, text, int) cascade;
drop function if exists public.fijar_fecha(uuid, date) cascade;
drop function if exists public.borrar_mi_cuenta() cascade;

-- =========================================================
-- TABLAS
-- =========================================================

-- Perfil de cada usuario (se crea solo al registrarse con Supabase Auth)
create table public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null,
  rol            text not null check (rol in ('guia','turista')),
  edad_rango     text,
  municipio      text,
  accesibilidad  text[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- Catálogo de las 5 experiencias (lo que entrega cada equipo)
create table public.actividades (
  id                  text primary key,
  orden               int  not null unique,
  dia                 int  not null default 1 check (dia in (1,2)),  -- día sugerido
  nombre              text not null,
  tipo                text not null,
  icono               text not null,            -- clave del ícono en js/app.js (pot, leaf, bike, dice, tent)
  color               text not null,            -- color de la insignia
  hora                time,
  duracion_min        int  not null,
  duracion_texto      text,                     -- cómo se muestra (ej. "De 5:00 p.m. a 8:00 a.m."); si va vacío se usa duracion_min
  lugar               text,
  descripcion         text,
  objetivo            text,
  pasos               text[] not null default '{}',
  materiales          text,
  seguridad           text[] not null default '{}',
  accion_sustentable  text,
  mensaje_final       text,
  sello               text,
  imagen              text,                     -- foto de la actividad (ruta dentro del proyecto)
  insignia            text                      -- imagen redonda del sello; si va vacía se usa el ícono
);

-- Grupo (recorrido). admin_id = el guía que lo creó
create table public.grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  codigo      text not null unique,
  admin_id    uuid not null references public.perfiles(id) on delete cascade,
  estado      text not null default 'esperando' check (estado in ('esperando','en_curso','finalizado')),
  fecha_inicio date,                                  -- fecha del día 1
  inicio      timestamptz,
  created_at  timestamptz not null default now()
);

-- Guías dentro de cada grupo (el admin también está aquí)
create table public.grupo_guias (
  grupo_id  uuid not null references public.grupos(id) on delete cascade,
  guia_id   uuid not null references public.perfiles(id) on delete cascade,
  unido_en  timestamptz not null default now(),
  primary key (grupo_id, guia_id)
);

-- Turistas dentro de cada grupo
create table public.grupo_miembros (
  grupo_id    uuid not null references public.grupos(id) on delete cascade,
  turista_id  uuid not null references public.perfiles(id) on delete cascade,
  unido_en    timestamptz not null default now(),
  primary key (grupo_id, turista_id)
);

-- Cada actividad dentro de cada grupo: qué guía la dirige y en qué estado va
create table public.grupo_actividades (
  grupo_id       uuid not null references public.grupos(id) on delete cascade,
  actividad_id   text not null references public.actividades(id) on delete cascade,
  guia_id        uuid references public.perfiles(id) on delete set null,
  dia            int  not null default 1 check (dia in (1,2)),
  estado         text not null default 'bloqueada' check (estado in ('bloqueada','abierta','completada')),
  abierta_en     timestamptz,
  completada_en  timestamptz,
  primary key (grupo_id, actividad_id)
);

-- Turistas que entraron a cada actividad y si ya los sellaron
create table public.participaciones (
  grupo_id      uuid not null references public.grupos(id) on delete cascade,
  actividad_id  text not null references public.actividades(id) on delete cascade,
  turista_id    uuid not null references public.perfiles(id) on delete cascade,
  entro_en      timestamptz not null default now(),
  sellado_en    timestamptz,
  sellado_por   uuid references public.perfiles(id) on delete set null,
  primary key (grupo_id, actividad_id, turista_id)
);

-- Evaluación rápida del turista después de recibir su sello
create table public.evaluaciones (
  id            uuid primary key default gen_random_uuid(),
  grupo_id      uuid not null references public.grupos(id) on delete cascade,
  actividad_id  text not null references public.actividades(id) on delete cascade,
  turista_id    uuid not null references public.perfiles(id) on delete cascade,
  valor         text not null check (valor in ('Regular','Buena','Excelente')),
  created_at    timestamptz not null default now(),
  unique (grupo_id, actividad_id, turista_id)
);

create index on public.grupos (admin_id);
create index on public.grupo_guias (guia_id);
create index on public.grupo_miembros (turista_id);
create index on public.participaciones (turista_id);
create index on public.evaluaciones (grupo_id, actividad_id);

-- =========================================================
-- FUNCIONES Y TRIGGERS
-- =========================================================

-- Crea el perfil con los datos que manda el registro:
-- supabase.auth.signUp({ email, password, options:{ data:{ nombre, rol, edad_rango, municipio, accesibilidad } } })
create function public.crear_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol, edad_rango, municipio, accesibilidad)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'turista'),
    new.raw_user_meta_data->>'edad_rango',
    new.raw_user_meta_data->>'municipio',
    coalesce(array(select jsonb_array_elements_text(new.raw_user_meta_data->'accesibilidad')), '{}')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- Código tipo SBC-4821 que no se repite
create function public.generar_codigo()
returns text
language plpgsql
as $$
declare c text;
begin
  loop
    c := 'SBC-' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.grupos where codigo = c);
  end loop;
  return c;
end;
$$;

alter table public.grupos alter column codigo set default public.generar_codigo();

-- Al crear un grupo: el admin entra como guía y se crean las 5 actividades bloqueadas
create function public.al_crear_grupo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.grupo_guias (grupo_id, guia_id) values (new.id, new.admin_id);
  insert into public.grupo_actividades (grupo_id, actividad_id, dia)
  select new.id, a.id, a.dia from public.actividades a;
  return new;
end;
$$;

create trigger on_grupo_created
  after insert on public.grupos
  for each row execute function public.al_crear_grupo();

-- ---------- Ayudantes para permisos ----------
create function public.es_admin_de(p_grupo uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.grupos where id = p_grupo and admin_id = auth.uid()); $$;

create function public.es_guia_en(p_grupo uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.grupo_guias where grupo_id = p_grupo and guia_id = auth.uid()); $$;

create function public.es_miembro_de(p_grupo uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.grupo_miembros where grupo_id = p_grupo and turista_id = auth.uid()); $$;

-- El guía asignado a la actividad (o el admin, por si falta un guía)
create function public.puede_dirigir(p_grupo uuid, p_actividad text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.es_admin_de(p_grupo)
      or exists (select 1 from public.grupo_actividades
                 where grupo_id = p_grupo and actividad_id = p_actividad and guia_id = auth.uid());
$$;

-- =========================================================
-- ACCIONES (la app las llama con supabase.rpc)
-- =========================================================

-- Guía o turista se une con el código
create function public.unirse_grupo(p_codigo text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare g public.grupos; r text;
begin
  select rol into r from public.perfiles where id = auth.uid();
  if r is null then raise exception 'Inicia sesión para unirte.'; end if;

  select * into g from public.grupos where codigo = upper(trim(p_codigo));
  if g.id is null then raise exception 'Ese código no coincide. Revísalo con el admin del grupo.'; end if;
  if g.estado = 'finalizado' then raise exception 'Ese recorrido ya terminó.'; end if;

  if r = 'guia' then
    insert into public.grupo_guias (grupo_id, guia_id) values (g.id, auth.uid()) on conflict do nothing;
  else
    insert into public.grupo_miembros (grupo_id, turista_id) values (g.id, auth.uid()) on conflict do nothing;
  end if;
  return g.id;
end;
$$;

-- Salir de un grupo (el admin no puede salir; él cierra el grupo)
create function public.salir_grupo(p_grupo uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.es_admin_de(p_grupo) then
    raise exception 'Eres el admin del grupo. Si ya no se usa, ciérralo.';
  end if;
  update public.grupo_actividades set guia_id = null
   where grupo_id = p_grupo and guia_id = auth.uid() and estado <> 'completada';
  delete from public.grupo_guias where grupo_id = p_grupo and guia_id = auth.uid();
  delete from public.grupo_miembros where grupo_id = p_grupo and turista_id = auth.uid();
end;
$$;

-- El admin asigna (o quita, con p_guia = null) el guía de una actividad
create function public.asignar_actividad(p_grupo uuid, p_actividad text, p_guia uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin_de(p_grupo) then raise exception 'Solo el admin del grupo asigna actividades.'; end if;
  if p_guia is not null and not exists (select 1 from public.grupo_guias where grupo_id = p_grupo and guia_id = p_guia) then
    raise exception 'Ese guía no está en el grupo.';
  end if;
  update public.grupo_actividades set guia_id = p_guia
   where grupo_id = p_grupo and actividad_id = p_actividad and estado = 'bloqueada';
  if not found then raise exception 'Esa actividad ya empezó; ya no se puede reasignar.'; end if;
end;
$$;

-- El admin arranca el recorrido
create function public.iniciar_recorrido(p_grupo uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin_de(p_grupo) then raise exception 'Solo el admin inicia el recorrido.'; end if;
  if exists (select 1 from public.grupo_actividades where grupo_id = p_grupo and guia_id is null) then
    raise exception 'Asigna un guía a cada actividad antes de iniciar.';
  end if;
  if not exists (select 1 from public.grupo_miembros where grupo_id = p_grupo) then
    raise exception 'Todavía no hay turistas en el grupo.';
  end if;
  update public.grupos set estado = 'en_curso', inicio = now() where id = p_grupo and estado = 'esperando';
  if not found then raise exception 'El recorrido ya había iniciado.'; end if;
end;
$$;

-- El guía abre su actividad (orden fijo: la anterior tiene que estar terminada)
create function public.abrir_actividad(p_grupo uuid, p_actividad text)
returns void
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.puede_dirigir(p_grupo, p_actividad) then raise exception 'Esta actividad no está asignada a ti.'; end if;
  if not exists (select 1 from public.grupos where id = p_grupo and estado = 'en_curso') then
    raise exception 'El admin todavía no inicia el recorrido.';
  end if;
  select orden into n from public.actividades where id = p_actividad;
  if exists (select 1 from public.grupo_actividades ga join public.actividades a on a.id = ga.actividad_id
             where ga.grupo_id = p_grupo and a.orden < n and ga.estado <> 'completada') then
    raise exception 'Todavía no termina la actividad anterior.';
  end if;
  update public.grupo_actividades set estado = 'abierta', abierta_en = now()
   where grupo_id = p_grupo and actividad_id = p_actividad and estado = 'bloqueada';
  if not found then raise exception 'Esa actividad ya estaba abierta o terminada.'; end if;
end;
$$;

-- El turista entra a la actividad abierta
create function public.entrar_actividad(p_grupo uuid, p_actividad text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_miembro_de(p_grupo) then raise exception 'No estás en este grupo.'; end if;
  if not exists (select 1 from public.grupo_actividades
                 where grupo_id = p_grupo and actividad_id = p_actividad and estado = 'abierta') then
    raise exception 'Esta actividad no está abierta.';
  end if;
  insert into public.participaciones (grupo_id, actividad_id, turista_id)
  values (p_grupo, p_actividad, auth.uid()) on conflict do nothing;
end;
$$;

-- El guía sella a un turista (o a todos los que entraron si p_turista es null)
create function public.sellar(p_grupo uuid, p_actividad text, p_turista uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if not public.puede_dirigir(p_grupo, p_actividad) then raise exception 'Solo el guía de esta actividad puede sellar.'; end if;
  update public.participaciones
     set sellado_en = now(), sellado_por = auth.uid()
   where grupo_id = p_grupo and actividad_id = p_actividad and sellado_en is null
     and (p_turista is null or turista_id = p_turista);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- El guía termina su actividad; si era la última, el recorrido se finaliza
create function public.terminar_actividad(p_grupo uuid, p_actividad text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.puede_dirigir(p_grupo, p_actividad) then raise exception 'Esta actividad no está asignada a ti.'; end if;
  update public.grupo_actividades set estado = 'completada', completada_en = now()
   where grupo_id = p_grupo and actividad_id = p_actividad and estado = 'abierta';
  if not found then raise exception 'La actividad no está abierta.'; end if;
  if not exists (select 1 from public.grupo_actividades where grupo_id = p_grupo and estado <> 'completada') then
    update public.grupos set estado = 'finalizado' where id = p_grupo;
  end if;
end;
$$;

-- El admin elige en qué día (1 o 2) va una actividad; el orden fijo se respeta
create function public.asignar_dia(p_grupo uuid, p_actividad text, p_dia int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin_de(p_grupo) then raise exception 'Solo el admin del grupo elige los días.'; end if;
  if p_dia not in (1,2) then raise exception 'El día tiene que ser 1 o 2.'; end if;
  update public.grupo_actividades set dia = p_dia
   where grupo_id = p_grupo and actividad_id = p_actividad and estado = 'bloqueada';
  if not found then raise exception 'Esa actividad ya empezó; ya no se puede cambiar de día.'; end if;
  if exists (select 1
               from public.grupo_actividades x join public.actividades ax on ax.id = x.actividad_id,
                    public.grupo_actividades y join public.actividades ay on ay.id = y.actividad_id
              where x.grupo_id = p_grupo and y.grupo_id = p_grupo
                and ax.orden < ay.orden and x.dia > y.dia) then
    raise exception 'El orden es fijo: una actividad no puede quedar en un día antes que la anterior.';
  end if;
end;
$$;

-- El admin pone o cambia la fecha del día 1
create function public.fijar_fecha(p_grupo uuid, p_fecha date)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin_de(p_grupo) then raise exception 'Solo el admin del grupo cambia la fecha.'; end if;
  update public.grupos set fecha_inicio = p_fecha where id = p_grupo and estado <> 'finalizado';
  if not found then raise exception 'El recorrido ya terminó.'; end if;
end;
$$;

grant execute on function public.unirse_grupo(text)                 to authenticated;
grant execute on function public.salir_grupo(uuid)                  to authenticated;
grant execute on function public.asignar_actividad(uuid, text, uuid) to authenticated;
grant execute on function public.iniciar_recorrido(uuid)            to authenticated;
grant execute on function public.abrir_actividad(uuid, text)        to authenticated;
grant execute on function public.entrar_actividad(uuid, text)       to authenticated;
grant execute on function public.sellar(uuid, text, uuid)           to authenticated;
grant execute on function public.terminar_actividad(uuid, text)     to authenticated;
grant execute on function public.asignar_dia(uuid, text, int)       to authenticated;
grant execute on function public.fijar_fecha(uuid, date)            to authenticated;

-- Cada quien puede borrar SU propia cuenta (por ejemplo, si se registró con el rol equivocado).
-- Se borra en cascada su perfil, sus sellos, evaluaciones, su lugar en grupos
-- y, si era admin, los grupos que creó.
create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para borrar tu cuenta.'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;

-- =========================================================
-- SEGURIDAD (RLS)
-- Los cambios de estado solo se hacen con las funciones de arriba.
-- =========================================================
alter table public.perfiles          enable row level security;
alter table public.actividades       enable row level security;
alter table public.grupos            enable row level security;
alter table public.grupo_guias       enable row level security;
alter table public.grupo_miembros    enable row level security;
alter table public.grupo_actividades enable row level security;
alter table public.participaciones   enable row level security;
alter table public.evaluaciones      enable row level security;

create policy "perfiles_ver"    on public.perfiles for select to authenticated using (true);
create policy "perfiles_editar" on public.perfiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- las actividades se ven también sin sesión (pantalla de bienvenida)
create policy "actividades_ver" on public.actividades for select to anon, authenticated using (true);

create policy "grupos_ver"    on public.grupos for select to authenticated using (true);
create policy "grupos_crear"  on public.grupos for insert to authenticated
  with check (admin_id = auth.uid() and exists (select 1 from public.perfiles where id = auth.uid() and rol = 'guia'));
create policy "grupos_borrar" on public.grupos for delete to authenticated using (admin_id = auth.uid());

create policy "guias_ver" on public.grupo_guias for select to authenticated
  using (public.es_guia_en(grupo_id) or public.es_miembro_de(grupo_id));

create policy "miembros_ver" on public.grupo_miembros for select to authenticated
  using (turista_id = auth.uid() or public.es_guia_en(grupo_id));

create policy "gact_ver" on public.grupo_actividades for select to authenticated
  using (public.es_guia_en(grupo_id) or public.es_miembro_de(grupo_id));

create policy "part_ver" on public.participaciones for select to authenticated
  using (turista_id = auth.uid() or public.es_guia_en(grupo_id));

create policy "eval_crear" on public.evaluaciones for insert to authenticated
  with check (turista_id = auth.uid() and exists (
    select 1 from public.participaciones p
     where p.grupo_id = evaluaciones.grupo_id and p.actividad_id = evaluaciones.actividad_id
       and p.turista_id = auth.uid() and p.sellado_en is not null));
create policy "eval_ver" on public.evaluaciones for select to authenticated
  using (turista_id = auth.uid() or public.es_guia_en(grupo_id));

-- =========================================================
-- REALTIME (para que todos vean los cambios sin recargar)
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['grupos','grupo_guias','grupo_miembros','grupo_actividades','participaciones','evaluaciones'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =========================================================
-- DATOS: las 5 experiencias (cámbienlas con la info de cada equipo)
-- =========================================================
insert into public.actividades
  (id, orden, dia, nombre, tipo, icono, color, hora, duracion_min, duracion_texto, lugar, descripcion, objetivo, pasos, materiales, seguridad, accion_sustentable, mensaje_final, sello, imagen, insignia)
values
  ('cyclo', 1, 1, 'Rally Costa de Oro', 'Cyclo Club', 'bike', '#c4502f', '11:00', 120, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Rally recreativo compuesto por cinco estaciones físicas inspiradas en playas de Nayarit. Los participantes superarán retos de coordinación, velocidad, puntería y trabajo en equipo.', 'Promover la actividad física, la convivencia y el conocimiento de los destinos costeros de Nayarit mediante retos recreativos y colaborativos.', array['Integrarse en el equipo asignado.', 'Escuchar las indicaciones generales y de seguridad.', 'Recorrer las cinco estaciones en el orden establecido.', 'Completar cada reto respetando las reglas y colaborando con el equipo.', 'Finalizar el rally y responder la encuesta breve en la aplicación.'], 'Ropa cómoda, calzado deportivo, gorra o sombrero, protector solar y botella de agua.', array['Mantenerse hidratado.', 'Utilizar protección solar.', 'Respetar las áreas delimitadas y seguir las instrucciones de los guías.', 'Las actividades podrán adaptarse según la condición física o las necesidades de movilidad de cada participante.'], null, '¡Completaste el Rally Costa de Oro! Buen trabajo en equipo.', 'Costa de Oro', 'assets/actividades/rally.webp', 'assets/actividades/rally-sello.webp'),

  ('ceramic', 2, 1, 'Essence Ceramic', 'Taller de pintura', 'paint', '#b26a37', '14:30', 90, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Taller de pintura frente al mar donde los participantes crearán un lienzo inspirado en sus recuerdos y experiencias del campamento.', 'Fomentar la creatividad, la expresión personal y la conexión con el entorno mediante una actividad artística y recreativa que permita a los participantes representar sus experiencias, emociones y recuerdos del campamento a través de una pintura elaborada con materiales convencionales y elementos naturales.', array['Dirígete al área asignada para el taller.', 'Recibe tu lienzo y los materiales de pintura.', 'Escucha las indicaciones del instructor sobre la actividad y las técnicas que puedes utilizar.', 'Comienza a pintar libremente y experimenta con los colores y materiales disponibles.', 'Coloca tu nombre y título a tu obra.', 'Deja tu pintura en el espacio indicado para su revisión y exposición.'], 'Mesa de trabajo, lienzos, pintura acrílica, pinceles y servitoallas.', array['Materiales no tóxicos y de fácil manejo.', 'Atención personalizada a quienes la requieran.'], 'Reutilizar materiales y aprovechar responsablemente los elementos naturales, evitando generar residuos y contaminar el entorno.', '¡Tu obra ya forma parte de la exposición!', 'Artista del mar', 'assets/actividades/essence.webp', 'assets/actividades/essence-sello.webp'),

  ('mesa', 3, 1, 'La Mesa del Barrio', 'Juegos de mesa', 'dice', '#3b2a1e', '16:00', 60, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'La mesa del barrio es todo aquel lugar donde se encuentre un juego de mesa y una superficie apta para jugar, en familia o con amigos.', 'Convivir en un entorno tranquilo mediante partidas de distintos juegos de mesa.', array['Seguir y escuchar las recomendaciones de los guías establecidos en esta etapa del campamento.'], 'Juegos de mesa y mobiliario.', array['Mobiliario apropiado.'], 'Los juegos seleccionados fueron reutilizados de la infancia de cada uno de los participantes.', '¡Gracias por jugar en comunidad!', 'Buena racha', null, null),

  ('camp', 4, 1, 'Sunset Beach Camp', 'Campamento en la playa', 'tent', '#b98a2e', '17:00', 900, '15 h (toda la noche)', 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Es un campamento en la playa donde los participantes podrán disfrutar de actividades al aire libre, juegos recreativos, dinámicas grupales, fogatas y contacto con el entorno natural.', 'Ofrecer una experiencia recreativa y segura en la playa, fomentando el contacto con la naturaleza, la convivencia y el trabajo en equipo.', array['Regístrate en el punto de encuentro.', 'Instala tu tienda de campaña en el área asignada.', 'Sigue las indicaciones del personal organizador.', 'Mantén limpia tu área de campamento.', 'Mantén cerrada tu casa de campaña cuando sea momento de dormir.'], 'Cobija, almohadas, bloqueador solar, repelente, pijama o ropa cómoda, artículos de higiene personal y alguna bebida.', array['Contamos con personal capacitado.', 'Botiquín de primeros auxilios disponible.', 'Zonas de campamento señalizadas.', 'Acceso a agua potable.'], 'Cuidar el entorno natural mediante la recolección de residuos, evitar los plásticos de un solo uso y respetar la flora y fauna de la zona.', '¡Pasaste la noche bajo las estrellas! Felicidades.', 'Atardecer', 'assets/actividades/camp.webp', 'assets/actividades/camp-sello.webp'),

  ('spa', 5, 2, 'Spa Brûlé', 'Spa y bienestar', 'leaf', '#5f8250', '10:00', 85, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Spa Brûlé es un establecimiento dedicado al bienestar, la relajación y el cuidado personal, que ofrece diversos tratamientos enfocados en el cuidado de la piel y la revitalización del cuerpo. Se caracteriza por el uso de productos naturales y artesanales elaborados principalmente a base de café de la región de Nayarit, así como de ingredientes como miel de abeja, azúcar natural y aceite de coco. Entre sus servicios se encuentran los masajes relajantes, tratamientos faciales, aromaterapia y exfoliaciones, complementados con productos naturales como jabones y ceras.

Servicio que se ofrece: diversos servicios de relajación y cuidado personal en un espacio tranquilo utilizando productos elaborados de manera natural, como mascarillas, jabones y exfoliantes hechos con ingredientes naturales de la región. La experiencia estará enfocada en el bienestar, la relajación y el cuidado de la piel, evitando el uso de productos químicos agresivos.', 'Ofrecer servicios de relajación y cuidado personal mediante tratamientos y productos naturales que promuevan el bienestar y la salud de la piel.', array[]::text[], 'Azúcar, café, miel, aceite de coco o de bebé, blumen, recipientes para exfoliante, toalla facial y toallitas húmedas.', array[]::text[], null, 'Cuerpo y mente renovados. ¡Gracias por cerrar el recorrido con nosotros!', 'Calma total', 'assets/actividades/spa.webp', 'assets/actividades/spa-sello.webp');
