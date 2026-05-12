create extension if not exists pgcrypto;

create sequence if not exists public.agricultores_codigo_seq;
create sequence if not exists public.acopiadores_codigo_seq;
create sequence if not exists public.colaboradores_codigo_seq;
create sequence if not exists public.productos_codigo_seq;
create sequence if not exists public.lotes_codigo_seq;
create sequence if not exists public.centros_acopio_codigo_seq;
create sequence if not exists public.despachos_codigo_seq;

create or replace function public.generate_agricultor_codigo()
returns text
language plpgsql
as $$
begin
  return 'AGRI-' || lpad(nextval('public.agricultores_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_agricultor_codigo()
returns trigger
language plpgsql
as $$
begin
  -- El código siempre se define en backend para evitar inconsistencias del frontend.
  new.codigo := public.generate_agricultor_codigo();
  return new;
end;
$$;

create or replace function public.generate_acopiador_codigo()
returns text
language plpgsql
as $$
begin
  return 'ACO-' || lpad(nextval('public.acopiadores_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_acopiador_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := public.generate_acopiador_codigo();
  return new;
end;
$$;

create or replace function public.generate_colaborador_codigo()
returns text
language plpgsql
as $$
begin
  return 'COL-' || lpad(nextval('public.colaboradores_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_colaborador_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := public.generate_colaborador_codigo();
  return new;
end;
$$;

create or replace function public.protect_acopiador_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.protect_colaborador_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.protect_agricultor_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_producto_codigo()
returns text
language plpgsql
as $$
begin
  return 'PROD-' || lpad(nextval('public.productos_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_producto_codigo()
returns trigger
language plpgsql
as $$
begin
  -- El codigo siempre se define en backend para evitar inconsistencias del frontend.
  new.codigo := public.generate_producto_codigo();
  return new;
end;
$$;

create or replace function public.protect_producto_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.generate_lote_codigo()
returns text
language plpgsql
as $$
begin
  return 'LOT-' || to_char(current_date, 'YYYYMMDD') || '-' || lpad(nextval('public.lotes_codigo_seq')::text, 3, '0');
end;
$$;

create or replace function public.set_lote_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := public.generate_lote_codigo();
  return new;
end;
$$;

create or replace function public.protect_lote_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.generate_centro_acopio_codigo()
returns text
language plpgsql
as $$
begin
  return 'CA-' || lpad(nextval('public.centros_acopio_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_centro_acopio_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := public.generate_centro_acopio_codigo();
  return new;
end;
$$;

create or replace function public.protect_centro_acopio_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.generate_despacho_codigo()
returns text
language plpgsql
as $$
begin
  return 'DESP-' || lpad(nextval('public.despachos_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_despacho_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := public.generate_despacho_codigo();
  return new;
end;
$$;

create or replace function public.protect_despacho_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create table if not exists public.agricultores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_agricultor_codigo(),
  nombre text not null,
  apellido text not null,
  dni text null,
  telefono text null,
  numero_cuenta text null,
  fecha_alta date not null default current_date,
  ubicacion text null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

create table if not exists public.acopiadores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_acopiador_codigo(),
  nombre text not null,
  apellido text not null,
  dni text null,
  telefono text null,
  numero_cuenta text null,
  fecha_alta date not null default current_date,
  ubicacion text null,  ggn text null,  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

create table if not exists public.colaboradores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_colaborador_codigo(),
  nombre text not null,
  apellido text not null,
  dni text null,
  telefono text null,
  numero_cuenta text null,
  fecha_alta date not null default current_date,
  ubicacion text null,
  rol text not null default 'recepcionista' check (rol in ('recepcionista', 'seleccionador', 'empaquetador')),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

alter table public.acopiadores add column if not exists numero_cuenta text null;
alter table public.acopiadores add column if not exists fecha_alta date not null default current_date;
alter table public.colaboradores add column if not exists numero_cuenta text null;
alter table public.colaboradores add column if not exists fecha_alta date not null default current_date;
alter table public.colaboradores add column if not exists ubicacion text null;
alter table public.colaboradores add column if not exists rol text not null default 'recepcionista';

do $$
begin
  alter table public.agricultores add column if not exists numero_cuenta text null;
  alter table public.agricultores add column if not exists fecha_alta date not null default current_date;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agricultores' and column_name = 'direccion'
  ) then
    alter table public.agricultores add column if not exists ubicacion text;
    update public.agricultores
      set ubicacion = coalesce(nullif(ubicacion, ''), nullif(direccion, ''), nullif(sector, ''));
    alter table public.agricultores drop column if exists direccion;
    alter table public.agricultores drop column if exists sector;
  end if;

  -- Eliminar columna nro_lote si existe
  alter table public.agricultores drop column if exists nro_lote;
end;
$$;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_producto_codigo(),
  nombre text not null,
  variedad text not null default 'snow_peas' check (variedad in ('snow_peas', 'sugar')),
  calidad text not null default 'cat1' check (calidad in ('cat1', 'cat2')),
  tipo_produccion text not null default 'convencional' check (tipo_produccion in ('organico', 'convencional'))
);

alter table public.productos
  add column if not exists variedad text not null default 'snow_peas';
alter table public.productos
  add column if not exists calidad text not null default 'cat1';
alter table public.productos
  add column if not exists tipo_produccion text not null default 'convencional';
alter table public.productos
  drop column if exists estado;
alter table public.productos
  drop column if exists tipo;
alter table public.productos
  drop column if exists unidad_medida;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'productos' and column_name = 'tipo'
  ) then
    update public.productos
      set variedad = case
        when tipo in ('holantao', 'snow_peas') then 'snow_peas'
        else 'sugar'
      end
    where variedad is null or variedad not in ('snow_peas', 'sugar');
  end if;
end;
$$;

alter table public.productos alter column codigo set default public.generate_producto_codigo();

create table if not exists public.agricultor_producto_hectareas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  agricultor_id uuid not null references public.agricultores(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  hectareas numeric(12,2) not null check (hectareas > 0),
  constraint uq_agricultor_producto_hectareas unique (agricultor_id, producto_id)
);

create table if not exists public.agricultor_sublotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  agricultor_id uuid not null references public.agricultores(id) on delete cascade,
  nombre text not null,
  constraint uq_agricultor_sublote unique (agricultor_id, nombre)
);

create or replace function public.replace_agricultor_hectareas(
  p_agricultor_id uuid,
  p_created_by uuid,
  p_items jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.agricultor_producto_hectareas
  where agricultor_id = p_agricultor_id;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    return;
  end if;

  insert into public.agricultor_producto_hectareas (
    created_by,
    agricultor_id,
    producto_id,
    hectareas
  )
  select
    p_created_by,
    p_agricultor_id,
    producto_id,
    max(hectareas)
  from (
    select
      nullif(item ->> 'producto_id', '')::uuid as producto_id,
      (item ->> 'hectareas')::numeric(12,2) as hectareas
    from jsonb_array_elements(p_items) as item
  ) payload
  where producto_id is not null
    and hectareas is not null
    and hectareas > 0
  group by producto_id;
end;
$$;

create table if not exists public.centros_acopio (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_centro_acopio_codigo(),
  nombre text not null,
  ubicacion text null,
  responsable text null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_lote_codigo(),
  agricultor_id uuid not null references public.agricultores(id) on delete restrict,
  recepcionista_id uuid references public.colaboradores(id) on delete restrict,
  acopiador_id uuid references public.acopiadores(id) on delete restrict,
  acopiador_agricultor_id uuid references public.agricultores(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  centro_acopio_id uuid not null references public.centros_acopio(id) on delete restrict,
  fecha_ingreso date not null,
  fecha_cosecha date not null default current_date,
  peso_bruto_kg numeric(12,2) not null,
  peso_tara_kg numeric(12,2) not null default 0 check (peso_tara_kg >= 0),
  peso_neto_kg numeric(12,2) not null default 0 check (peso_neto_kg >= 0),
  num_cubetas integer not null default 0,
  jabas_prestadas integer not null default 0,
  codigo_lote_agricultor text null,
  observaciones text null,
  estado text not null default 'ingresado' check (estado in ('ingresado', 'en_clasificacion', 'clasificado', 'empaquetado', 'en_despacho', 'despachado', 'liquidado'))
);

alter table public.lotes alter column codigo set default public.generate_lote_codigo();
alter table public.centros_acopio alter column codigo set default public.generate_centro_acopio_codigo();
alter table public.lotes add column if not exists recepcionista_id uuid;
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'lotes'
      and tc.constraint_name = 'lotes_recepcionista_id_fkey'
  ) then
    alter table public.lotes
      add constraint lotes_recepcionista_id_fkey
      foreign key (recepcionista_id)
      references public.colaboradores(id)
      on delete restrict;
  end if;
end;
$$;
alter table public.lotes add column if not exists acopiador_id uuid;
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'lotes'
      and tc.constraint_name = 'lotes_acopiador_id_fkey'
  ) then
    alter table public.lotes
      add constraint lotes_acopiador_id_fkey
      foreign key (acopiador_id)
      references public.acopiadores(id)
      on delete restrict;
  end if;
end;
$$;
alter table public.lotes add column if not exists acopiador_agricultor_id uuid;
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'lotes'
      and tc.constraint_name = 'lotes_acopiador_agricultor_id_fkey'
  ) then
    alter table public.lotes
      add constraint lotes_acopiador_agricultor_id_fkey
      foreign key (acopiador_agricultor_id)
      references public.agricultores(id)
      on delete restrict;
  end if;
end;
$$;
alter table public.lotes add column if not exists codigo_lote_agricultor text null;
alter table public.lotes add column if not exists sublote text null;
alter table public.lotes add column if not exists fecha_cosecha date;
update public.lotes
set fecha_cosecha = coalesce(fecha_cosecha, fecha_ingreso)
where fecha_cosecha is null;
alter table public.lotes alter column fecha_cosecha set default current_date;
alter table public.lotes alter column fecha_cosecha set not null;
alter table public.lotes add column if not exists peso_tara_kg numeric(12,2) not null default 0;
alter table public.lotes add column if not exists peso_neto_kg numeric(12,2);
update public.lotes
set peso_neto_kg = coalesce(peso_neto_kg, greatest(peso_bruto_kg - coalesce(peso_tara_kg, 0) * coalesce(num_cubetas, 0), 0))
where peso_neto_kg is null;
alter table public.lotes alter column peso_neto_kg set default 0;
alter table public.lotes alter column peso_neto_kg set not null;
alter table public.lotes add column if not exists jabas_prestadas integer not null default 0;

alter table public.despachos add column if not exists tipo_despacho text not null default 'terrestre';
do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'public' and table_name = 'despachos' and constraint_name = 'despachos_tipo_despacho_check'
  ) then
    alter table public.despachos add constraint despachos_tipo_despacho_check
      check (tipo_despacho in ('maritima', 'aerea', 'terrestre'));
  end if;
end;
$$;
alter table public.despachos drop column if exists numero_senasa;
alter table public.despachos alter column lote_id drop not null;
alter table public.despachos add column if not exists exportador text null;
alter table public.despachos add column if not exists marca_caja text null;
alter table public.despachos alter column precio_venta_kg set default 0;
update public.despachos set precio_venta_kg = coalesce(precio_venta_kg, 0) where precio_venta_kg is null;
alter table public.despachos alter column precio_venta_kg set not null;
alter table public.agricultores drop column if exists ggn;

create table if not exists public.clasificaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  lote_id uuid not null references public.lotes(id) on delete cascade,
  peso_bueno_kg numeric(12,2) not null default 0,
  fecha_clasificacion date not null,
  observaciones text null
);

create table if not exists public.empaquetados (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  lote_id uuid not null references public.lotes(id) on delete cascade,
  colaborador_id uuid null references public.colaboradores(id) on delete set null,
  fecha_empaquetado date not null,
  destino text not null default 'europa' check (destino in ('europa', 'usa')),
  codigo_trazabilidad text not null,
  numero_pallet text not null,
  num_cajas integer not null check (num_cajas > 0),
  observaciones text null
);

alter table public.empaquetados add column if not exists colaborador_id uuid null references public.colaboradores(id) on delete set null;

alter table public.empaquetados drop constraint if exists empaquetados_destino_check;

update public.empaquetados
set destino = case
  when lower(trim(destino)) = 'usa' then 'usa'
  when lower(trim(destino)) = 'europa' then 'europa'
  else destino
end
where destino is not null;

alter table public.empaquetados alter column destino set default 'europa';

alter table public.empaquetados
add constraint empaquetados_destino_check
check (destino in ('europa', 'usa'));

create table if not exists public.despachos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_despacho_codigo(),
  lote_id uuid null references public.lotes(id) on delete cascade,
  fecha_despacho date not null,
  destino text not null check (destino in ('exportacion', 'mercado_local', 'planta_proceso')),
  tipo_despacho text not null default 'terrestre' check (tipo_despacho in ('maritima', 'aerea', 'terrestre')),
  exportador text null,
  marca_caja text null,
  transportista text null,
  placa_vehiculo text null,
  num_cajas_despachadas integer not null default 0,
  peso_neto_kg numeric(12,2) not null,
  precio_venta_kg numeric(12,2) not null default 0,
  observaciones text null
);

alter table public.despachos add column if not exists codigo text;
update public.despachos
set codigo = public.generate_despacho_codigo()
where codigo is null or trim(codigo) = '';
alter table public.despachos alter column codigo set default public.generate_despacho_codigo();
alter table public.despachos alter column codigo set not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'despachos'
      and tc.constraint_name = 'despachos_codigo_key'
  ) then
    alter table public.despachos add constraint despachos_codigo_key unique (codigo);
  end if;
end;
$$;

create table if not exists public.despacho_pallets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  despacho_id uuid not null references public.despachos(id) on delete cascade,
  lote_id uuid not null references public.lotes(id) on delete restrict,
  numero_pallet text not null,
  num_cajas integer not null default 0 check (num_cajas > 0),
  unique (lote_id, numero_pallet)
);

create table if not exists public.liquidaciones_agri (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique,
  agricultor_id uuid not null references public.agricultores(id) on delete restrict,
  fecha_inicio date not null,
  fecha_fin date not null,
  total_kg numeric(12,2) not null default 0,
  total_monto numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'confirmada', 'pagada')),
  observaciones text null,
  fecha_pago date null,
  numero_operacion text null,
  modalidad_pago text null check (modalidad_pago in ('transferencia', 'yape_plin', 'efectivo')),
  numero_senasa text null
);

alter table public.liquidaciones_agri add column if not exists fecha_pago date null;
alter table public.liquidaciones_agri add column if not exists numero_operacion text null;
alter table public.liquidaciones_agri add column if not exists modalidad_pago text null;
alter table public.liquidaciones_agri drop constraint if exists liquidaciones_agri_modalidad_pago_check;
alter table public.liquidaciones_agri add constraint liquidaciones_agri_modalidad_pago_check
  check (modalidad_pago is null or modalidad_pago in ('transferencia', 'yape_plin', 'efectivo'));

create table if not exists public.liquidacion_agri_detalle (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  liquidacion_id uuid not null references public.liquidaciones_agri(id) on delete cascade,
  lote_id uuid not null references public.lotes(id) on delete restrict,
  categoria text not null check (categoria in ('primera', 'segunda', 'descarte')),
  peso_kg numeric(12,2) not null,
  precio_kg numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

create table if not exists public.movimientos_cubetas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  agricultor_id uuid not null references public.agricultores(id) on delete restrict,
  lote_id uuid null references public.lotes(id) on delete set null,
  tipo text not null check (tipo in ('entrega', 'devolucion')),
  cantidad integer not null default 0,
  fecha date not null,
  observaciones text null
);

create index if not exists idx_agricultores_codigo on public.agricultores(codigo);
create index if not exists idx_acopiadores_codigo on public.acopiadores(codigo);
create index if not exists idx_colaboradores_codigo on public.colaboradores(codigo);
create index if not exists idx_productos_codigo on public.productos(codigo);
create index if not exists idx_despacho_pallets_despacho on public.despacho_pallets(despacho_id);
create index if not exists idx_despacho_pallets_lote_pallet on public.despacho_pallets(lote_id, numero_pallet);
create index if not exists idx_agricultor_producto_hectareas_agricultor_id on public.agricultor_producto_hectareas(agricultor_id);
create index if not exists idx_agricultor_producto_hectareas_producto_id on public.agricultor_producto_hectareas(producto_id);
create index if not exists idx_agricultor_sublotes_agricultor_id on public.agricultor_sublotes(agricultor_id);
create index if not exists idx_centros_acopio_codigo on public.centros_acopio(codigo);
create index if not exists idx_lotes_codigo on public.lotes(codigo);
create index if not exists idx_lotes_agricultor_id on public.lotes(agricultor_id);
create index if not exists idx_lotes_acopiador_id on public.lotes(acopiador_id);
create index if not exists idx_lotes_acopiador_agricultor_id on public.lotes(acopiador_agricultor_id);
create index if not exists idx_lotes_producto_id on public.lotes(producto_id);
create index if not exists idx_lotes_centro_acopio_id on public.lotes(centro_acopio_id);
create index if not exists idx_clasificaciones_lote_id on public.clasificaciones(lote_id);
create index if not exists idx_empaquetados_lote_id on public.empaquetados(lote_id);
create index if not exists idx_empaquetados_numero_pallet on public.empaquetados(numero_pallet);
create index if not exists idx_despachos_codigo on public.despachos(codigo);
create index if not exists idx_despachos_lote_id on public.despachos(lote_id);
create index if not exists idx_liquidaciones_agri_agricultor_id on public.liquidaciones_agri(agricultor_id);
create index if not exists idx_liquidacion_agri_detalle_liquidacion_id on public.liquidacion_agri_detalle(liquidacion_id);
create index if not exists idx_movimientos_cubetas_agricultor_id on public.movimientos_cubetas(agricultor_id);

drop trigger if exists trg_agricultores_updated_at on public.agricultores;
create trigger trg_agricultores_updated_at before update on public.agricultores for each row execute function public.set_updated_at();

drop trigger if exists trg_agricultores_protect_codigo on public.agricultores;
create trigger trg_agricultores_protect_codigo before update on public.agricultores for each row execute function public.protect_agricultor_codigo();

drop trigger if exists trg_agricultores_codigo on public.agricultores;
create trigger trg_agricultores_codigo before insert on public.agricultores for each row execute function public.set_agricultor_codigo();

alter table public.agricultores alter column codigo set default public.generate_agricultor_codigo();

drop trigger if exists trg_acopiadores_updated_at on public.acopiadores;
create trigger trg_acopiadores_updated_at before update on public.acopiadores for each row execute function public.set_updated_at();

drop trigger if exists trg_acopiadores_protect_codigo on public.acopiadores;
create trigger trg_acopiadores_protect_codigo before update on public.acopiadores for each row execute function public.protect_acopiador_codigo();

drop trigger if exists trg_acopiadores_codigo on public.acopiadores;
create trigger trg_acopiadores_codigo before insert on public.acopiadores for each row execute function public.set_acopiador_codigo();

alter table public.acopiadores alter column codigo set default public.generate_acopiador_codigo();

drop trigger if exists trg_colaboradores_updated_at on public.colaboradores;
create trigger trg_colaboradores_updated_at before update on public.colaboradores for each row execute function public.set_updated_at();

drop trigger if exists trg_colaboradores_protect_codigo on public.colaboradores;
create trigger trg_colaboradores_protect_codigo before update on public.colaboradores for each row execute function public.protect_colaborador_codigo();

drop trigger if exists trg_colaboradores_codigo on public.colaboradores;
create trigger trg_colaboradores_codigo before insert on public.colaboradores for each row execute function public.set_colaborador_codigo();

alter table public.colaboradores alter column codigo set default public.generate_colaborador_codigo();

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at before update on public.productos for each row execute function public.set_updated_at();

drop trigger if exists trg_productos_protect_codigo on public.productos;
create trigger trg_productos_protect_codigo before update on public.productos for each row execute function public.protect_producto_codigo();

drop trigger if exists trg_productos_codigo on public.productos;
create trigger trg_productos_codigo before insert on public.productos for each row execute function public.set_producto_codigo();

drop trigger if exists trg_lotes_protect_codigo on public.lotes;
create trigger trg_lotes_protect_codigo before update on public.lotes for each row execute function public.protect_lote_codigo();

drop trigger if exists trg_lotes_codigo on public.lotes;
create trigger trg_lotes_codigo before insert on public.lotes for each row execute function public.set_lote_codigo();

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^AGRI-(\d+)$')::bigint), 0)
  into v_max
  from public.agricultores;

  if v_max = 0 then
    perform setval('public.agricultores_codigo_seq', 1, false);
  else
    perform setval('public.agricultores_codigo_seq', v_max, true);
  end if;
end;
$$;

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^ACO-(\d+)$')::bigint), 0)
  into v_max
  from public.acopiadores;

  if v_max = 0 then
    perform setval('public.acopiadores_codigo_seq', 1, false);
  else
    perform setval('public.acopiadores_codigo_seq', v_max, true);
  end if;
end;
$$;

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^COL-(\d+)$')::bigint), 0)
  into v_max
  from public.colaboradores;

  if v_max = 0 then
    perform setval('public.colaboradores_codigo_seq', 1, false);
  else
    perform setval('public.colaboradores_codigo_seq', v_max, true);
  end if;
end;
$$;

do $$
declare
  v_fecha_actual text := to_char(current_date, 'YYYYMMDD');
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^LOT-' || v_fecha_actual || '-(\d+)$')::bigint), 0)
  into v_max
  from public.lotes
  where codigo like 'LOT-' || v_fecha_actual || '-%';

  if v_max = 0 then
    perform setval('public.lotes_codigo_seq', 1, false);
  else
    perform setval('public.lotes_codigo_seq', v_max, true);
  end if;
end;
$$;

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^CA-(\d+)$')::bigint), 0)
  into v_max
  from public.centros_acopio;

  if v_max = 0 then
    perform setval('public.centros_acopio_codigo_seq', 1, false);
  else
    perform setval('public.centros_acopio_codigo_seq', v_max, true);
  end if;
end;
$$;

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^DESP-(\d+)$')::bigint), 0)
  into v_max
  from public.despachos;

  if v_max = 0 then
    perform setval('public.despachos_codigo_seq', 1, false);
  else
    perform setval('public.despachos_codigo_seq', v_max, true);
  end if;
end;
$$;

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at before update on public.productos for each row execute function public.set_updated_at();

drop trigger if exists trg_agricultor_producto_hectareas_updated_at on public.agricultor_producto_hectareas;
create trigger trg_agricultor_producto_hectareas_updated_at before update on public.agricultor_producto_hectareas for each row execute function public.set_updated_at();

drop trigger if exists trg_agricultor_sublotes_updated_at on public.agricultor_sublotes;
create trigger trg_agricultor_sublotes_updated_at before update on public.agricultor_sublotes for each row execute function public.set_updated_at();

drop trigger if exists trg_centros_acopio_protect_codigo on public.centros_acopio;
create trigger trg_centros_acopio_protect_codigo before update on public.centros_acopio for each row execute function public.protect_centro_acopio_codigo();

drop trigger if exists trg_centros_acopio_codigo on public.centros_acopio;
create trigger trg_centros_acopio_codigo before insert on public.centros_acopio for each row execute function public.set_centro_acopio_codigo();

drop trigger if exists trg_centros_acopio_updated_at on public.centros_acopio;
create trigger trg_centros_acopio_updated_at before update on public.centros_acopio for each row execute function public.set_updated_at();

drop trigger if exists trg_lotes_updated_at on public.lotes;
create trigger trg_lotes_updated_at before update on public.lotes for each row execute function public.set_updated_at();

drop trigger if exists trg_clasificaciones_updated_at on public.clasificaciones;
create trigger trg_clasificaciones_updated_at before update on public.clasificaciones for each row execute function public.set_updated_at();

drop trigger if exists trg_empaquetados_updated_at on public.empaquetados;
create trigger trg_empaquetados_updated_at before update on public.empaquetados for each row execute function public.set_updated_at();

drop trigger if exists trg_despachos_protect_codigo on public.despachos;
create trigger trg_despachos_protect_codigo before update on public.despachos for each row execute function public.protect_despacho_codigo();

drop trigger if exists trg_despachos_codigo on public.despachos;
create trigger trg_despachos_codigo before insert on public.despachos for each row execute function public.set_despacho_codigo();

drop trigger if exists trg_despachos_updated_at on public.despachos;
create trigger trg_despachos_updated_at before update on public.despachos for each row execute function public.set_updated_at();

drop trigger if exists trg_despacho_pallets_updated_at on public.despacho_pallets;
create trigger trg_despacho_pallets_updated_at before update on public.despacho_pallets for each row execute function public.set_updated_at();

drop trigger if exists trg_liquidaciones_agri_updated_at on public.liquidaciones_agri;
create trigger trg_liquidaciones_agri_updated_at before update on public.liquidaciones_agri for each row execute function public.set_updated_at();

drop trigger if exists trg_liquidacion_agri_detalle_updated_at on public.liquidacion_agri_detalle;
create trigger trg_liquidacion_agri_detalle_updated_at before update on public.liquidacion_agri_detalle for each row execute function public.set_updated_at();

drop trigger if exists trg_movimientos_cubetas_updated_at on public.movimientos_cubetas;
create trigger trg_movimientos_cubetas_updated_at before update on public.movimientos_cubetas for each row execute function public.set_updated_at();

alter table public.agricultores enable row level security;
alter table public.acopiadores enable row level security;
alter table public.colaboradores enable row level security;
alter table public.productos enable row level security;
alter table public.agricultor_producto_hectareas enable row level security;
alter table public.agricultor_sublotes enable row level security;
alter table public.centros_acopio enable row level security;
alter table public.lotes enable row level security;
alter table public.clasificaciones enable row level security;
alter table public.empaquetados enable row level security;
alter table public.despachos enable row level security;
alter table public.despacho_pallets enable row level security;
alter table public.liquidaciones_agri enable row level security;
alter table public.liquidacion_agri_detalle enable row level security;
alter table public.movimientos_cubetas enable row level security;

drop policy if exists agricultores_authenticated_all on public.agricultores;
create policy agricultores_authenticated_all on public.agricultores for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists acopiadores_authenticated_all on public.acopiadores;
create policy acopiadores_authenticated_all on public.acopiadores for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists colaboradores_authenticated_all on public.colaboradores;
create policy colaboradores_authenticated_all on public.colaboradores for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists productos_authenticated_all on public.productos;
create policy productos_authenticated_all on public.productos for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists agricultor_producto_hectareas_authenticated_all on public.agricultor_producto_hectareas;
create policy agricultor_producto_hectareas_authenticated_all on public.agricultor_producto_hectareas for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists agricultor_sublotes_authenticated_all on public.agricultor_sublotes;
create policy agricultor_sublotes_authenticated_all on public.agricultor_sublotes for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists centros_acopio_authenticated_all on public.centros_acopio;
create policy centros_acopio_authenticated_all on public.centros_acopio for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists lotes_authenticated_all on public.lotes;
create policy lotes_authenticated_all on public.lotes for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists clasificaciones_authenticated_all on public.clasificaciones;
create policy clasificaciones_authenticated_all on public.clasificaciones for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists empaquetados_authenticated_all on public.empaquetados;
create policy empaquetados_authenticated_all on public.empaquetados for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists despachos_authenticated_all on public.despachos;
create policy despachos_authenticated_all on public.despachos for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists despacho_pallets_authenticated_all on public.despacho_pallets;
create policy despacho_pallets_authenticated_all on public.despacho_pallets for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists liquidaciones_agri_authenticated_all on public.liquidaciones_agri;
create policy liquidaciones_agri_authenticated_all on public.liquidaciones_agri for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists liquidacion_agri_detalle_authenticated_all on public.liquidacion_agri_detalle;
create policy liquidacion_agri_detalle_authenticated_all on public.liquidacion_agri_detalle for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists movimientos_cubetas_authenticated_all on public.movimientos_cubetas;
create policy movimientos_cubetas_authenticated_all on public.movimientos_cubetas for all to authenticated using (true) with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLASIFICACIONES: migración a modelo sesión + aportes por seleccionador
-- ─────────────────────────────────────────────────────────────────────────────

-- Eliminar columnas del modelo anterior (solo si existen)
alter table public.clasificaciones drop column if exists personal_id;
alter table public.clasificaciones drop column if exists categoria;
alter table public.clasificaciones drop column if exists num_cajas;
alter table public.clasificaciones drop column if exists peso_kg;

-- Eliminar tablas legacy que ya no usa la aplicación
drop table if exists public.actividades_personal cascade;
drop table if exists public.liquidaciones_personal cascade;
drop table if exists public.personal_campo cascade;
drop table if exists public.clasificacion_mesas cascade;

-- Garantizar una sola sesión por lote
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'clasificaciones'
      and constraint_name = 'uq_clasificacion_lote_id'
  ) then
    alter table public.clasificaciones add constraint uq_clasificacion_lote_id unique (lote_id);
  end if;
end;
$$;

-- Agregar total de kg buenos al registro de sesión (denormalizado desde aportes)
alter table public.clasificaciones add column if not exists peso_bueno_kg numeric(12,2) not null default 0;

-- Tabla de aportes por seleccionador
create table if not exists public.clasificacion_aportes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  clasificacion_id uuid not null references public.clasificaciones(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  peso_bueno_kg numeric(12,2) not null check (peso_bueno_kg >= 0),
  constraint uq_aporte_clasificacion_colaborador unique (clasificacion_id, colaborador_id)
);

create index if not exists idx_clasificacion_aportes_clasificacion_id on public.clasificacion_aportes(clasificacion_id);
create index if not exists idx_clasificacion_aportes_colaborador_id on public.clasificacion_aportes(colaborador_id);

drop trigger if exists trg_clasificacion_aportes_updated_at on public.clasificacion_aportes;
create trigger trg_clasificacion_aportes_updated_at before update on public.clasificacion_aportes for each row execute function public.set_updated_at();

alter table public.clasificacion_aportes enable row level security;
drop policy if exists clasificacion_aportes_authenticated_all on public.clasificacion_aportes;
create policy clasificacion_aportes_authenticated_all on public.clasificacion_aportes for all to authenticated using (true) with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIG PRECIOS — precio/kg por semana + variedad + categoría (Módulo 8 PDF)
-- El Jefe de Planta lo configura antes de cada semana desde el panel admin.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.config_precios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  semana integer not null check (semana between 1 and 53),
  anio integer not null check (anio >= 2024),
  variedad text not null check (variedad in ('snow_peas', 'sugar')),
  categoria text not null check (categoria in ('cat1', 'cat2')),
  precio_kg_sol numeric(10,4) not null check (precio_kg_sol >= 0),
  constraint uq_config_precio unique (semana, anio, variedad, categoria)
);

create index if not exists idx_config_precios_semana_anio on public.config_precios(anio, semana);

drop trigger if exists trg_config_precios_updated_at on public.config_precios;
create trigger trg_config_precios_updated_at before update on public.config_precios for each row execute function public.set_updated_at();

alter table public.config_precios enable row level security;
drop policy if exists config_precios_authenticated_all on public.config_precios;
create policy config_precios_authenticated_all on public.config_precios for all to authenticated using (true) with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIG_SISTEMA — parámetros globales de operación
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.config_sistema (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  clave text not null unique,
  nombre text not null,
  descripcion text null,
  valor_texto text null,
  valor_numerico numeric(12,4) null
);

create index if not exists idx_config_sistema_clave on public.config_sistema(clave);

drop trigger if exists trg_config_sistema_updated_at on public.config_sistema;
create trigger trg_config_sistema_updated_at before update on public.config_sistema for each row execute function public.set_updated_at();

alter table public.config_sistema enable row level security;
drop policy if exists config_sistema_authenticated_all on public.config_sistema;
create policy config_sistema_authenticated_all on public.config_sistema for all to authenticated using (true) with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- CLASIFICACION_APORTES — desglose kg por categoría para pago al seleccionador
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.clasificacion_aportes add column if not exists kg_cat1 numeric(12,2) not null default 0 check (kg_cat1 >= 0);
alter table public.clasificacion_aportes add column if not exists kg_cat2 numeric(12,2) not null default 0 check (kg_cat2 >= 0);

-- Campos ampliados de clasificación por trabajador
alter table public.clasificacion_aportes add column if not exists kg_bruto numeric(12,2) not null default 0 check (kg_bruto >= 0);
alter table public.clasificacion_aportes add column if not exists num_jabas integer not null default 0 check (num_jabas >= 0);
alter table public.clasificacion_aportes add column if not exists peso_tara_kg numeric(12,2) not null default 0 check (peso_tara_kg >= 0);
alter table public.clasificacion_aportes add column if not exists jabas_descartadas integer not null default 0 check (jabas_descartadas >= 0);
alter table public.clasificacion_aportes add column if not exists kg_bruto_descartable numeric(12,2) not null default 0 check (kg_bruto_descartable >= 0);
alter table public.clasificacion_aportes add column if not exists peso_tara_descartable_kg numeric(12,2) not null default 0 check (peso_tara_descartable_kg >= 0);
alter table public.clasificacion_aportes add column if not exists kg_neto_descartable numeric(12,2) not null default 0 check (kg_neto_descartable >= 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANILLA_DETALLES — desglose de pago por selección (Tareo A)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.planilla_detalles') is not null then
    alter table public.planilla_detalles add column if not exists kg_bruto_recepcion numeric(12,2) not null default 0 check (kg_bruto_recepcion >= 0);
    alter table public.planilla_detalles add column if not exists pago_recepcion numeric(10,2) not null default 0 check (pago_recepcion >= 0);
    alter table public.planilla_detalles add column if not exists kg_cat1_seleccion numeric(12,2) not null default 0 check (kg_cat1_seleccion >= 0);
    alter table public.planilla_detalles add column if not exists kg_cat2_seleccion numeric(12,2) not null default 0 check (kg_cat2_seleccion >= 0);
    alter table public.planilla_detalles add column if not exists pago_seleccion numeric(10,2) not null default 0 check (pago_seleccion >= 0);
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- LOTES — constraint de estado sin etapa de hidroculizado
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.lotes drop constraint if exists lotes_estado_check;
alter table public.lotes add constraint lotes_estado_check
  check (estado in ('ingresado', 'en_clasificacion', 'clasificado', 'empaquetado', 'en_despacho', 'despachado', 'liquidado'));

-- ─────────────────────────────────────────────────────────────────────────────
-- LIMPIEZA — retirar hidroculizado del flujo
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.tareo_hidroculizado') is not null then
    execute 'drop trigger if exists trg_tareo_hidroculizado_updated_at on public.tareo_hidroculizado';
    execute 'drop policy if exists tareo_hidroculizado_authenticated_all on public.tareo_hidroculizado';
    execute 'drop table if exists public.tareo_hidroculizado';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANILLAS_QUINCENALES — Módulo 9
-- Cabecera de la planilla de pago quincenal a trabajadores.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.planillas_quincenales (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  periodo_inicio date not null,
  periodo_fin date not null,
  total_monto numeric(12,2) not null default 0 check (total_monto >= 0),
  estado text not null default 'borrador' check (estado in ('borrador', 'confirmada', 'pagada')),
  observaciones text null,
  fecha_pago date null,
  numero_operacion text null,
  modalidad_pago text null check (modalidad_pago in ('transferencia', 'yape_plin', 'efectivo')),
  constraint uq_planilla_periodo unique (periodo_inicio, periodo_fin)
);

alter table public.planillas_quincenales add column if not exists fecha_pago date null;
alter table public.planillas_quincenales add column if not exists numero_operacion text null;
alter table public.planillas_quincenales add column if not exists modalidad_pago text null;
alter table public.planillas_quincenales drop constraint if exists planillas_quincenales_modalidad_pago_check;
alter table public.planillas_quincenales add constraint planillas_quincenales_modalidad_pago_check
  check (modalidad_pago is null or modalidad_pago in ('transferencia', 'yape_plin', 'efectivo'));

update public.planillas_quincenales
set estado = 'confirmada'
where estado = 'pendiente';

alter table public.planillas_quincenales drop constraint if exists planillas_quincenales_estado_check;
alter table public.planillas_quincenales drop constraint if exists planillas_quincenales_estado_check1;
alter table public.planillas_quincenales alter column estado set default 'borrador';
alter table public.planillas_quincenales add constraint planillas_quincenales_estado_check
  check (estado in ('borrador', 'confirmada', 'pagada'));

drop trigger if exists trg_planillas_quincenales_updated_at on public.planillas_quincenales;
create trigger trg_planillas_quincenales_updated_at before update on public.planillas_quincenales for each row execute function public.set_updated_at();

alter table public.planillas_quincenales enable row level security;
drop policy if exists planillas_quincenales_authenticated_all on public.planillas_quincenales;
create policy planillas_quincenales_authenticated_all on public.planillas_quincenales for all to authenticated using (true) with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- PLANILLA_DETALLES — línea por trabajador dentro de la planilla
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if to_regclass('public.planilla_detalles') is not null then
    alter table public.planilla_detalles drop column if exists n_jabas_hidroculizado;
  end if;
end;
$$;

create table if not exists public.planilla_detalles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  planilla_id uuid not null references public.planillas_quincenales(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  kg_bruto_recepcion numeric(12,2) not null default 0 check (kg_bruto_recepcion >= 0),
  pago_recepcion numeric(10,2) not null default 0 check (pago_recepcion >= 0),
  kg_cat1_seleccion numeric(12,2) not null default 0 check (kg_cat1_seleccion >= 0),
  kg_cat2_seleccion numeric(12,2) not null default 0 check (kg_cat2_seleccion >= 0),
  pago_seleccion numeric(10,2) not null default 0 check (pago_seleccion >= 0),
  n_cajas_empaquetado integer not null default 0 check (n_cajas_empaquetado >= 0),
  monto_empaquetado numeric(10,2) not null default 0 check (monto_empaquetado >= 0),
  otros_montos numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  constraint uq_planilla_detalle_colaborador unique (planilla_id, colaborador_id)
);

create index if not exists idx_planilla_detalles_planilla_id on public.planilla_detalles(planilla_id);
create index if not exists idx_planilla_detalles_colaborador_id on public.planilla_detalles(colaborador_id);

drop trigger if exists trg_planilla_detalles_updated_at on public.planilla_detalles;
create trigger trg_planilla_detalles_updated_at before update on public.planilla_detalles for each row execute function public.set_updated_at();

alter table public.planilla_detalles enable row level security;
drop policy if exists planilla_detalles_authenticated_all on public.planilla_detalles;
create policy planilla_detalles_authenticated_all on public.planilla_detalles for all to authenticated using (true) with check (auth.uid() is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT_LOGS — Trazabilidad de acciones por usuario (Módulo Gerencia)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete restrict,
  user_email text not null,
  accion text not null check (accion in ('crear', 'actualizar', 'eliminar')),
  modulo text not null,
  registro_id text not null,
  descripcion text not null,
  datos_anteriores jsonb null,
  datos_nuevos jsonb null
);

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_user_id on public.audit_logs(user_id);
create index if not exists idx_audit_logs_modulo on public.audit_logs(modulo);
create index if not exists idx_audit_logs_registro_id on public.audit_logs(registro_id);

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_authenticated_all on public.audit_logs;
create policy audit_logs_authenticated_all on public.audit_logs for all to authenticated using (true) with check (auth.uid() is not null);

