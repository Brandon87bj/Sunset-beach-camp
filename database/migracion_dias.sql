-- =========================================================
-- SUNSET BEACH CAMP — Actualización: recorrido de 2 días
-- Para una base que YA tiene datos. No borra nada.
-- Supabase > SQL Editor > New query > pegar todo > Run
-- (Se puede correr más de una vez sin problema)
-- =========================================================

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

-- Para que la app vea las columnas nuevas de inmediato
notify pgrst, 'reload schema';
