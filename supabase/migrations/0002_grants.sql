-- CineMatch fix 1: give signed-in users access to the tables.
-- Newer Supabase projects no longer grant table access automatically; row level
-- security (from 0001) still decides which rows each user can see or change.
-- Safe to run more than once.

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
