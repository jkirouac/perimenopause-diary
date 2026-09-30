-- Lets a person delete their own account from Settings. Their diary rows, entries,
-- comments, profile and feedback go with it: every table cascades from auth.users.
-- It can only ever remove the caller's own account; signed out, it removes nothing.

create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
