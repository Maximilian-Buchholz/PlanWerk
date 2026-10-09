-- Avatar-Farben: dunkle Töne (weiße Initialen bleiben lesbar), möglichst ohne
-- Dopplungen, und nach der Vergabe unveränderlich.
-- Die Liste muss zu avatarColors in src/theme/colors.ts passen.
-- Im Supabase SQL Editor in einem Rutsch ausführen.

create or replace function public.avatar_palette()
returns text[]
language sql
immutable
as $$
  select array[
    '#B3261E', '#3F6212', '#0369A1', '#15803D', '#0F766E', '#0E7490',
    '#1D4ED8', '#4338CA', '#6D28D9', '#A21CAF', '#BE185D', '#475569'
  ]
$$;

-- Wählt die Farbe, die bisher am seltensten vergeben ist (bei Gleichstand zufällig).
-- Solange die Palette nicht ausgeschöpft ist, bekommt so jede Person eine eigene Farbe.
create or replace function public.pick_avatar_color()
returns text
language sql
volatile
as $$
  select c.color
  from unnest(public.avatar_palette()) as c(color)
  left join public.profiles p on p.avatar_color = c.color
  group by c.color
  order by count(p.id), random()
  limit 1
$$;

-- Sperre vorübergehend entfernen, damit bestehende Farben neu vergeben werden dürfen
-- (wird unten wieder angelegt).
drop trigger if exists profiles_lock_avatar_color on public.profiles;

-- Bestehende Profile, deren Farbe nicht (mehr) in der Palette liegt, einmalig neu vergeben.
do $$
declare
  r record;
begin
  for r in
    select id from public.profiles
    where avatar_color is null or avatar_color <> all (public.avatar_palette())
    order by id
  loop
    update public.profiles set avatar_color = public.pick_avatar_color() where id = r.id;
  end loop;
end $$;

-- Neue Profile: Farbe immer automatisch vergeben, egal was der Registrierungs-Trigger setzt.
create or replace function public.assign_avatar_color()
returns trigger
language plpgsql
as $$
begin
  new.avatar_color := public.pick_avatar_color();
  return new;
end $$;

drop trigger if exists profiles_assign_avatar_color on public.profiles;
create trigger profiles_assign_avatar_color
  before insert on public.profiles
  for each row execute function public.assign_avatar_color();

-- Spätere Änderungen an der Farbe werden verworfen.
create or replace function public.lock_avatar_color()
returns trigger
language plpgsql
as $$
begin
  new.avatar_color := old.avatar_color;
  return new;
end $$;

drop trigger if exists profiles_lock_avatar_color on public.profiles;
create trigger profiles_lock_avatar_color
  before update on public.profiles
  for each row execute function public.lock_avatar_color();
