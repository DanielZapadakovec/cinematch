-- CineMatch database schema for Supabase
-- Paste the whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.

-- ─────────────────────────────────────────────────────────────
-- Profiles: one row per auth user, created automatically
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text not null unique check (handle ~ '^CM-[0-9]{4,6}$'),
  name        text not null check (char_length(name) between 1 and 60),
  color       text not null default '#9D0208',
  genres      text[] not null default '{}',
  xp          integer not null default 0,
  hint_done   boolean not null default false,
  created_at  timestamptz not null default now()
);

create or replace function public.new_handle() returns text
language plpgsql as $$
declare h text;
begin
  loop
    h := 'CM-' || (1000 + floor(random() * 9000))::int;
    exit when not exists (select 1 from public.profiles where handle = h);
  end loop;
  return h;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  palette text[] := array['#9D0208','#6A040F','#DC2F02','#370617','#8E2A1A'];
  nm text := coalesce(nullif(new.raw_user_meta_data->>'name',''),
                      nullif(new.raw_user_meta_data->>'full_name',''),
                      split_part(coalesce(new.email,'Viewer'),'@',1));
begin
  insert into public.profiles (id, handle, name, color)
  values (new.id, public.new_handle(), left(nm, 60), palette[1 + floor(random() * 5)::int]);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Friendships (stored both directions)
-- ─────────────────────────────────────────────────────────────
create table public.friendships (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_id = a and friend_id = b)
$$;

-- ─────────────────────────────────────────────────────────────
-- Swipes (likes / skips) – day is the user's local date
-- ─────────────────────────────────────────────────────────────
create table public.swipes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  movie_id   text not null,
  dir        smallint not null check (dir in (-1, 1)),
  day        date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);
create index swipes_user_day on public.swipes (user_id, day);

-- ─────────────────────────────────────────────────────────────
-- Watched + rating
-- ─────────────────────────────────────────────────────────────
create table public.watched (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  movie_id   text not null,
  seen       boolean not null default true,
  rating     smallint check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- ─────────────────────────────────────────────────────────────
-- Films sent between friends (drives friend streaks + inbox)
-- ─────────────────────────────────────────────────────────────
create table public.film_sends (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  movie_id   text not null,
  day        date not null default current_date,
  handled    boolean not null default false,
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index film_sends_to on public.film_sends (to_id, day);
create index film_sends_from on public.film_sends (from_id, day);

-- ─────────────────────────────────────────────────────────────
-- Movie nights, guests, votes
-- ─────────────────────────────────────────────────────────────
create table public.events (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 80),
  date       date not null,
  cands      text[] not null check (cardinality(cands) between 1 and 20),
  winner     text,
  created_at timestamptz not null default now()
);

create table public.event_guests (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (event_id, user_id)
);

create table public.votes (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  movie_id   text not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create or replace function public.is_event_member(e uuid, u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = e and host_id = u)
      or exists (select 1 from event_guests where event_id = e and user_id = u)
$$;

-- ─────────────────────────────────────────────────────────────
-- XP log: one row per reward key, so rewards can't be farmed
-- ─────────────────────────────────────────────────────────────
create table public.xp_log (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  key        text not null,
  amount     integer not null check (amount between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ─────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────
-- Add a friend by handle (CM-1234). Creates both directions.
create or replace function public.add_friend(friend_handle text) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare f public.profiles; me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  select * into f from profiles where handle = upper(trim(friend_handle));
  if f.id is null then raise exception 'No user with ID %', friend_handle; end if;
  if f.id = me then raise exception 'That is your own ID'; end if;
  insert into friendships (user_id, friend_id) values (me, f.id), (f.id, me) on conflict do nothing;
  return f;
end $$;

create or replace function public.remove_friend(friend uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships
  where (user_id = auth.uid() and friend_id = friend) or (user_id = friend and friend_id = auth.uid());
$$;

-- Award XP once per key. Returns the new total, or null if already claimed.
create or replace function public.gain_xp(reward_key text, amount integer) returns integer
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); total integer;
begin
  if me is null then raise exception 'not signed in'; end if;
  if amount < 1 or amount > 100 then raise exception 'bad amount'; end if;
  insert into xp_log (user_id, key, amount) values (me, reward_key, amount) on conflict do nothing;
  if not found then return null; end if;
  update profiles set xp = xp + amount where id = me returning xp into total;
  return total;
end $$;

-- Create a movie night with its guests in one call
create or replace function public.create_event(p_title text, p_date date, p_cands text[], p_guests uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); eid uuid; g uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into events (host_id, title, date, cands) values (me, p_title, p_date, p_cands) returning id into eid;
  foreach g in array coalesce(p_guests, '{}') loop
    if is_friend(me, g) then insert into event_guests values (eid, g) on conflict do nothing; end if;
  end loop;
  return eid;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.friendships  enable row level security;
alter table public.swipes       enable row level security;
alter table public.watched      enable row level security;
alter table public.film_sends   enable row level security;
alter table public.events       enable row level security;
alter table public.event_guests enable row level security;
alter table public.votes        enable row level security;
alter table public.xp_log       enable row level security;

-- profiles: any signed-in user can find people; you edit only yourself (xp only via gain_xp)
create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name, color, genres, hint_done) on public.profiles to authenticated;

-- friendships: see your own; changes go through add_friend / remove_friend
create policy "friendships own" on public.friendships for select to authenticated using (user_id = auth.uid());

-- swipes: yours fully, friends' readable (for matches)
create policy "swipes own all" on public.swipes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "swipes friends read" on public.swipes for select to authenticated
  using (public.is_friend(auth.uid(), user_id));

-- watched: yours fully, friends' readable (watched together)
create policy "watched own all" on public.watched for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "watched friends read" on public.watched for select to authenticated
  using (public.is_friend(auth.uid(), user_id));

-- film_sends: sender and recipient can read; only to friends; recipient marks handled
create policy "sends read" on public.film_sends for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());
create policy "sends insert" on public.film_sends for insert to authenticated
  with check (from_id = auth.uid() and public.is_friend(auth.uid(), to_id));
create policy "sends handle" on public.film_sends for update to authenticated
  using (to_id = auth.uid()) with check (to_id = auth.uid());
revoke update on public.film_sends from authenticated;
grant update (handled) on public.film_sends to authenticated;

-- events: members read; host edits/deletes; creation via create_event
create policy "events read" on public.events for select to authenticated
  using (public.is_event_member(id, auth.uid()));
create policy "events host update" on public.events for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "events host delete" on public.events for delete to authenticated
  using (host_id = auth.uid());
create policy "events members set winner" on public.events for update to authenticated
  using (public.is_event_member(id, auth.uid())) with check (public.is_event_member(id, auth.uid()));
revoke update on public.events from authenticated;
grant update (winner, title, date) on public.events to authenticated;

create policy "guests read" on public.event_guests for select to authenticated
  using (public.is_event_member(event_id, auth.uid()));

-- votes: members read; you write your own vote
create policy "votes read" on public.votes for select to authenticated
  using (public.is_event_member(event_id, auth.uid()));
create policy "votes own write" on public.votes for all to authenticated
  using (user_id = auth.uid() and public.is_event_member(event_id, auth.uid()))
  with check (user_id = auth.uid() and public.is_event_member(event_id, auth.uid()));

create policy "xp own read" on public.xp_log for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Realtime: new films sent to you and vote changes arrive live
-- ─────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.film_sends, public.votes, public.friendships;

-- Helper functions are for signed-in users only
revoke execute on function public.is_friend(uuid, uuid), public.is_event_member(uuid, uuid),
  public.add_friend(text), public.remove_friend(uuid), public.gain_xp(text, integer),
  public.create_event(text, date, text[], uuid[]), public.new_handle() from public, anon;
grant execute on function public.is_friend(uuid, uuid), public.is_event_member(uuid, uuid),
  public.add_friend(text), public.remove_friend(uuid), public.gain_xp(text, integer),
  public.create_event(text, date, text[], uuid[]) to authenticated;

-- ── grants (same as 0002_grants.sql; needed on newer Supabase projects) ──
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.swipes, public.watched, public.votes
to authenticated;

grant select on public.profiles, public.friendships, public.event_guests, public.xp_log to authenticated;
grant update (name, color, genres, hint_done) on public.profiles to authenticated;

grant select, insert on public.film_sends to authenticated;
grant update (handled) on public.film_sends to authenticated;

grant select, delete on public.events to authenticated;
grant update (winner, title, date) on public.events to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.add_friend(text), public.remove_friend(uuid), public.gain_xp(text, integer),
  public.create_event(text, date, text[], uuid[]), public.is_friend(uuid, uuid), public.is_event_member(uuid, uuid)
to authenticated;

-- the sign-up trigger runs as the table owner, nothing to grant for it
