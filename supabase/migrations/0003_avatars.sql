-- CineMatch fix 3: profile pictures (Google photo or your own upload). Safe to run more than once.
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles drop constraint if exists profiles_avatar_url_len;
alter table public.profiles add constraint profiles_avatar_url_len check (avatar_url is null or char_length(avatar_url) < 120000);
grant update (name, color, genres, hint_done, avatar_url) on public.profiles to authenticated;

-- new Google accounts start with their Google photo
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  palette text[] := array['#9D0208','#6A040F','#DC2F02','#370617','#8E2A1A'];
  nm text := coalesce(nullif(new.raw_user_meta_data->>'name',''),
                      nullif(new.raw_user_meta_data->>'full_name',''),
                      split_part(coalesce(new.email,'Viewer'),'@',1));
  pic text := coalesce(nullif(new.raw_user_meta_data->>'avatar_url',''), nullif(new.raw_user_meta_data->>'picture',''));
begin
  insert into public.profiles (id, handle, name, color, avatar_url)
  values (new.id, public.new_handle(), left(nm, 60), palette[1 + floor(random() * 5)::int], pic);
  return new;
end $$;
