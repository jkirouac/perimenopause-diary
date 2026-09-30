-- Her tracker list (2026-09-30): merged rows, new rows, medication details and
-- measurements. Existing entries move with their row; nothing she recorded is lost.
-- New standard rows are added by the app on sign-in (ensureSetup), not here.

alter table public.diary_rows
  add column category text,
  add column dose text not null default '',
  add column notes text not null default '';

alter table public.diary_rows drop constraint diary_rows_scale_check;
alter table public.diary_rows
  add constraint diary_rows_scale_check check (scale in ('0-4', 'count', 'MLUYZ', 'tick', 'number', 'bp'));

-- Optional details on a day's value: a medication's time and dose, a blood pressure's time.
alter table public.entries add column extra jsonb;

alter table public.profiles add column height_in numeric check (height_in > 0 and height_in < 120);

-- Breast soreness: one row instead of front and side. Where both were recorded
-- on a day, keep the higher value ('0'–'4' compare correctly as text).
insert into public.entries (user_id, date, row_id, value, entered_at)
select s.user_id, s.date, f.id, s.value, s.entered_at
from public.entries s
join public.diary_rows sr on sr.id = s.row_id and sr.key = 'breast_side'
join public.diary_rows f on f.user_id = sr.user_id and f.key = 'breast_front'
on conflict (user_id, date, row_id) do update
  set value = greatest(public.entries.value, excluded.value);

update public.diary_rows set key = 'breast', label = 'Breast soreness' where key = 'breast_front';
update public.diary_rows s set key = 'breast', label = 'Breast soreness'
where key = 'breast_side'
  and not exists (select 1 from public.diary_rows b where b.user_id = s.user_id and b.key = 'breast');
-- Its entries were merged above.
delete from public.diary_rows where key = 'breast_side';

-- Her handwritten rows become the list's standard ones.
update public.diary_rows r set key = 'pain_sleep', label = 'Pain affecting sleep'
where key = 'custom_lbp'
  and not exists (select 1 from public.diary_rows p where p.user_id = r.user_id and p.key = 'pain_sleep');
update public.diary_rows r set key = 'brain_fog', label = 'Brain fog'
where key = 'custom_memory'
  and not exists (select 1 from public.diary_rows p where p.user_id = r.user_id and p.key = 'brain_fog');

update public.diary_rows set label = 'Irritability / anger / rage' where key = 'frustrated';
update public.diary_rows set label = 'Hot flushes / night sweats – night' where key = 'flush_night';
update public.diary_rows set label = '# of flushes / sweats – night' where key = 'flush_night_n';

-- Rows she no longer tracks: removed where nothing was ever recorded, otherwise kept hidden.
delete from public.diary_rows r
where key in ('fluid', 'breast_size', 'bbt', 'cup')
  and not exists (select 1 from public.entries e where e.row_id = r.id);
update public.diary_rows set hidden = true where key in ('fluid', 'breast_size', 'bbt', 'cup');

-- Groups and order, matching STANDARD_ROWS in src/lib/diary.ts.
update public.diary_rows r set category = v.category, sort = v.sort
from (values
  ('flow', 'physical', 10), ('cramps', 'physical', 20), ('breast', 'physical', 30),
  ('headache', 'physical', 40), ('joint_pain', 'physical', 50), ('pain_sleep', 'physical', 60),
  ('vaginal', 'physical', 70), ('acne', 'physical', 80), ('custom_itchy', 'physical', 85),
  ('constipation', 'physical', 90), ('mucus', 'physical', 100),
  ('flush_day', 'flushes', 110), ('flush_day_n', 'flushes', 120),
  ('flush_night', 'flushes', 130), ('flush_night_n', 'flushes', 140),
  ('sleep', 'sleep', 150), ('brain_fog', 'thinking', 160),
  ('frustrated', 'mood', 170), ('mood_swings', 'mood', 180),
  ('depressed', 'mood', 190), ('anxious', 'mood', 200),
  ('appetite', 'compared', 210), ('sex', 'compared', 220), ('energy', 'compared', 230),
  ('self_worth', 'compared', 240), ('stress', 'compared', 250),
  ('weight', 'measures', 300), ('bp', 'measures', 310),
  ('fluid', 'physical', 95), ('breast_size', 'compared', 255),
  ('bbt', 'measures', 320), ('cup', 'measures', 330)
) as v (key, category, sort)
where r.key = v.key;

update public.diary_rows set category = 'meds' where scale = 'tick' and category is null;

-- An entry can only point at a row in the same person's diary.
alter table public.diary_rows add constraint diary_rows_user_id_id_key unique (user_id, id);
alter table public.entries drop constraint entries_row_id_fkey;
alter table public.entries
  add constraint entries_row_same_user_fkey foreign key (user_id, row_id)
  references public.diary_rows (user_id, id) on delete cascade;
