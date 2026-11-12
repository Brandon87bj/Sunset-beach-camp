-- =========================================================
-- SUNSET BEACH CAMP — Actualización: información y horarios oficiales de las actividades
-- y opción para que cada quien borre su cuenta
-- Para una base que YA tiene datos. No borra cuentas ni grupos.
-- Supabase > SQL Editor > New query > pegar todo > Run
-- (Incluye lo de migracion_dias.sql, así que no hace falta correr ese.
--  Se puede correr más de una vez sin problema.)
-- =========================================================

-- ---------- 1) Recorrido de 2 días (por si no se había corrido) ----------
-- Día sugerido de cada actividad (cámbienlo cuando decidan los clientes)
alter table public.actividades add column if not exists dia int not null default 1;
do $$ begin
  alter table public.actividades add constraint actividades_dia_check check (dia in (1,2));
exception when duplicate_object then null; end $$;
update public.actividades set dia = case when id = 'spa' then 2 else 1 end;

-- Fecha del día 1 de cada grupo
alter table public.grupos add column if not exists fecha_inicio date;

-- Día de cada actividad dentro de cada grupo
alter table public.grupo_actividades add column if not exists dia int not null default 1;
do $$ begin
  alter table public.grupo_actividades add constraint grupo_actividades_dia_check check (dia in (1,2));
exception when duplicate_object then null; end $$;
update public.grupo_actividades ga set dia = a.dia
  from public.actividades a
 where a.id = ga.actividad_id and ga.estado = 'bloqueada';

-- Los grupos nuevos copian el día sugerido
create or replace function public.al_crear_grupo()
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

-- El admin elige en qué día (1 o 2) va una actividad; el orden fijo se respeta
create or replace function public.asignar_dia(p_grupo uuid, p_actividad text, p_dia int)
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
create or replace function public.fijar_fecha(p_grupo uuid, p_fecha date)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.es_admin_de(p_grupo) then raise exception 'Solo el admin del grupo cambia la fecha.'; end if;
  update public.grupos set fecha_inicio = p_fecha where id = p_grupo and estado <> 'finalizado';
  if not found then raise exception 'El recorrido ya terminó.'; end if;
end;
$$;

grant execute on function public.asignar_dia(uuid, text, int) to authenticated;
grant execute on function public.fijar_fecha(uuid, date)      to authenticated;

-- ---------- 2) Columnas nuevas de las actividades ----------
alter table public.actividades add column if not exists duracion_texto text;
alter table public.actividades add column if not exists imagen text;
alter table public.actividades add column if not exists insignia text;

-- ---------- 3) Información del documento ----------
-- Primero se recorren los números de orden para que no choquen al reordenar
update public.actividades set orden = orden + 100;

insert into public.actividades
  (id, orden, dia, nombre, tipo, icono, color, hora, duracion_min, duracion_texto, lugar, descripcion, objetivo, pasos, materiales, seguridad, accion_sustentable, mensaje_final, sello, imagen, insignia)
values
  ('cyclo', 1, 1, 'Rally Costa de Oro', 'Cyclo Club', 'bike', '#c4502f', '11:00', 120, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Rally recreativo compuesto por cinco estaciones físicas inspiradas en playas de Nayarit. Los participantes superarán retos de coordinación, velocidad, puntería y trabajo en equipo.', 'Promover la actividad física, la convivencia y el conocimiento de los destinos costeros de Nayarit mediante retos recreativos y colaborativos.', array['Integrarse en el equipo asignado.', 'Escuchar las indicaciones generales y de seguridad.', 'Recorrer las cinco estaciones en el orden establecido.', 'Completar cada reto respetando las reglas y colaborando con el equipo.', 'Finalizar el rally y responder la encuesta breve en la aplicación.'], 'Ropa cómoda, calzado deportivo, gorra o sombrero, protector solar y botella de agua.', array['Mantenerse hidratado.', 'Utilizar protección solar.', 'Respetar las áreas delimitadas y seguir las instrucciones de los guías.', 'Las actividades podrán adaptarse según la condición física o las necesidades de movilidad de cada participante.'], null, '¡Completaste el Rally Costa de Oro! Buen trabajo en equipo.', 'Costa de Oro', 'assets/actividades/rally.webp', 'assets/actividades/rally-sello.webp'),

  ('ceramic', 2, 1, 'Essence Ceramic', 'Taller de pintura', 'paint', '#b26a37', '14:30', 90, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Taller de pintura frente al mar donde los participantes crearán un lienzo inspirado en sus recuerdos y experiencias del campamento.', 'Fomentar la creatividad, la expresión personal y la conexión con el entorno mediante una actividad artística y recreativa que permita a los participantes representar sus experiencias, emociones y recuerdos del campamento a través de una pintura elaborada con materiales convencionales y elementos naturales.', array['Dirígete al área asignada para el taller.', 'Recibe tu lienzo y los materiales de pintura.', 'Escucha las indicaciones del instructor sobre la actividad y las técnicas que puedes utilizar.', 'Comienza a pintar libremente y experimenta con los colores y materiales disponibles.', 'Coloca tu nombre y título a tu obra.', 'Deja tu pintura en el espacio indicado para su revisión y exposición.'], 'Mesa de trabajo, lienzos, pintura acrílica, pinceles y servitoallas.', array['Materiales no tóxicos y de fácil manejo.', 'Atención personalizada a quienes la requieran.'], 'Reutilizar materiales y aprovechar responsablemente los elementos naturales, evitando generar residuos y contaminar el entorno.', '¡Tu obra ya forma parte de la exposición!', 'Artista del mar', 'assets/actividades/essence.webp', 'assets/actividades/essence-sello.webp'),

  ('mesa', 3, 1, 'La Mesa del Barrio', 'Juegos de mesa', 'dice', '#3b2a1e', '16:00', 60, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'La mesa del barrio es todo aquel lugar donde se encuentre un juego de mesa y una superficie apta para jugar, en familia o con amigos.', 'Convivir en un entorno tranquilo mediante partidas de distintos juegos de mesa.', array['Seguir y escuchar las recomendaciones de los guías establecidos en esta etapa del campamento.'], 'Juegos de mesa y mobiliario.', array['Mobiliario apropiado.'], 'Los juegos seleccionados fueron reutilizados de la infancia de cada uno de los participantes.', '¡Gracias por jugar en comunidad!', 'Buena racha', null, null),

  ('camp', 4, 1, 'Sunset Beach Camp', 'Campamento en la playa', 'tent', '#b98a2e', '17:00', 900, '15 h (toda la noche)', 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Es un campamento en la playa donde los participantes podrán disfrutar de actividades al aire libre, juegos recreativos, dinámicas grupales, fogatas y contacto con el entorno natural.', 'Ofrecer una experiencia recreativa y segura en la playa, fomentando el contacto con la naturaleza, la convivencia y el trabajo en equipo.', array['Regístrate en el punto de encuentro.', 'Instala tu tienda de campaña en el área asignada.', 'Sigue las indicaciones del personal organizador.', 'Mantén limpia tu área de campamento.', 'Mantén cerrada tu casa de campaña cuando sea momento de dormir.'], 'Cobija, almohadas, bloqueador solar, repelente, pijama o ropa cómoda, artículos de higiene personal y alguna bebida.', array['Contamos con personal capacitado.', 'Botiquín de primeros auxilios disponible.', 'Zonas de campamento señalizadas.', 'Acceso a agua potable.'], 'Cuidar el entorno natural mediante la recolección de residuos, evitar los plásticos de un solo uso y respetar la flora y fauna de la zona.', '¡Pasaste la noche bajo las estrellas! Felicidades.', 'Atardecer', 'assets/actividades/camp.webp', 'assets/actividades/camp-sello.webp'),

  ('spa', 5, 2, 'Spa Brûlé', 'Spa y bienestar', 'leaf', '#5f8250', '10:00', 85, null, 'Centro Recreativo Marclauri, Bahía de Matanchén, San Blas, Nayarit', 'Spa Brûlé es un establecimiento dedicado al bienestar, la relajación y el cuidado personal, que ofrece diversos tratamientos enfocados en el cuidado de la piel y la revitalización del cuerpo. Se caracteriza por el uso de productos naturales y artesanales elaborados principalmente a base de café de la región de Nayarit, así como de ingredientes como miel de abeja, azúcar natural y aceite de coco. Entre sus servicios se encuentran los masajes relajantes, tratamientos faciales, aromaterapia y exfoliaciones, complementados con productos naturales como jabones y ceras.

Servicio que se ofrece: diversos servicios de relajación y cuidado personal en un espacio tranquilo utilizando productos elaborados de manera natural, como mascarillas, jabones y exfoliantes hechos con ingredientes naturales de la región. La experiencia estará enfocada en el bienestar, la relajación y el cuidado de la piel, evitando el uso de productos químicos agresivos.', 'Ofrecer servicios de relajación y cuidado personal mediante tratamientos y productos naturales que promuevan el bienestar y la salud de la piel.', array[]::text[], 'Azúcar, café, miel, aceite de coco o de bebé, blumen, recipientes para exfoliante, toalla facial y toallitas húmedas.', array[]::text[], null, 'Cuerpo y mente renovados. ¡Gracias por cerrar el recorrido con nosotros!', 'Calma total', 'assets/actividades/spa.webp', 'assets/actividades/spa-sello.webp')
on conflict (id) do update set orden = excluded.orden, dia = excluded.dia, nombre = excluded.nombre, tipo = excluded.tipo, icono = excluded.icono, color = excluded.color, hora = excluded.hora, duracion_min = excluded.duracion_min, duracion_texto = excluded.duracion_texto, lugar = excluded.lugar, descripcion = excluded.descripcion, objetivo = excluded.objetivo, pasos = excluded.pasos, materiales = excluded.materiales, seguridad = excluded.seguridad, accion_sustentable = excluded.accion_sustentable, mensaje_final = excluded.mensaje_final, sello = excluded.sello, imagen = excluded.imagen, insignia = excluded.insignia;

-- Los grupos que aún no empiezan esas actividades toman el día nuevo
update public.grupo_actividades ga set dia = a.dia
  from public.actividades a
 where a.id = ga.actividad_id and ga.estado = 'bloqueada';

-- ---------- 4) Borrar mi cuenta ----------
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

-- Para que la app vea las columnas nuevas de inmediato
notify pgrst, 'reload schema';
