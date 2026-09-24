-- Corrige la generacion de codigos de lote.
--
-- lpad() en PostgreSQL TRUNCA cuando el texto es mas largo que el ancho pedido:
--   lpad('1013', 3, '0')  ->  '101'
-- Con lpad(nextval(...)::text, 3, '0') el codigo se repite a partir del lote
-- numero 1000 del dia, y el unique de lotes.codigo rechaza el insert. Nunca se
-- noto porque nunca se llego a 999 lotes en un dia.
--
-- Se rellena a 3 digitos solo mientras el numero quepa, y de ahi en adelante se
-- escribe completo: LOT-20260923-999, LOT-20260923-1000, LOT-20260923-1001.

create or replace function public.generate_lote_codigo()
returns text
language plpgsql
as $$
declare
  v_num bigint := nextval('public.lotes_codigo_seq');
begin
  return 'LOT-' || to_char(current_date, 'YYYYMMDD') || '-' ||
         case when v_num < 1000 then lpad(v_num::text, 3, '0') else v_num::text end;
end;
$$;

-- Mismo problema latente en el resto, con 6 digitos: recien fallaria en el
-- registro 1.000.000, pero es el mismo defecto.
create or replace function public.generate_agricultor_codigo()
returns text language plpgsql as $$
declare v_num bigint := nextval('public.agricultores_codigo_seq');
begin return 'AGRI-' || case when v_num < 1000000 then lpad(v_num::text, 6, '0') else v_num::text end; end;
$$;

create or replace function public.generate_acopiador_codigo()
returns text language plpgsql as $$
declare v_num bigint := nextval('public.acopiadores_codigo_seq');
begin return 'ACO-' || case when v_num < 1000000 then lpad(v_num::text, 6, '0') else v_num::text end; end;
$$;

create or replace function public.generate_colaborador_codigo()
returns text language plpgsql as $$
declare v_num bigint := nextval('public.colaboradores_codigo_seq');
begin return 'COL-' || case when v_num < 1000000 then lpad(v_num::text, 6, '0') else v_num::text end; end;
$$;

create or replace function public.generate_producto_codigo()
returns text language plpgsql as $$
declare v_num bigint := nextval('public.productos_codigo_seq');
begin return 'PROD-' || case when v_num < 1000000 then lpad(v_num::text, 6, '0') else v_num::text end; end;
$$;

create or replace function public.generate_centro_acopio_codigo()
returns text language plpgsql as $$
declare v_num bigint := nextval('public.centros_acopio_codigo_seq');
begin return 'CA-' || case when v_num < 1000000 then lpad(v_num::text, 6, '0') else v_num::text end; end;
$$;

create or replace function public.generate_despacho_codigo()
returns text language plpgsql as $$
declare v_num bigint := nextval('public.despachos_codigo_seq');
begin return 'DESP-' || case when v_num < 1000000 then lpad(v_num::text, 6, '0') else v_num::text end; end;
$$;

-- Cada insert consumia DOS valores de la secuencia: el default de la columna y
-- el trigger, que igual pisa el valor. Se quita el default y queda solo el
-- trigger, como ya se hizo con agricultores. Los codigos quedan correlativos.
alter table public.lotes alter column codigo drop default;
alter table public.acopiadores alter column codigo drop default;
alter table public.colaboradores alter column codigo drop default;
alter table public.productos alter column codigo drop default;
alter table public.centros_acopio alter column codigo drop default;
alter table public.despachos alter column codigo drop default;

-- Reinicia la secuencia de lotes al maximo realmente usado (0 si esta vacia),
-- para que la numeracion arranque limpia.
do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from 'LOT-\d{8}-(\d+)$')::bigint), 0)
  into v_max from public.lotes;

  if v_max = 0 then
    perform setval('public.lotes_codigo_seq', 1, false);
  else
    perform setval('public.lotes_codigo_seq', v_max, true);
  end if;
end;
$$;
