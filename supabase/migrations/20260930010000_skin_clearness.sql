-- Skin clearness (compared with usual, M–Z) replaces Pimples/acne (0–4).
-- The app adds the new row on sign-in (ensureSetup). An acne row is removed where
-- nothing was recorded; one with answers stays hidden so they aren't lost.

delete from public.diary_rows r
where key = 'acne'
  and not exists (select 1 from public.entries e where e.row_id = r.id);
update public.diary_rows set hidden = true where key = 'acne';
