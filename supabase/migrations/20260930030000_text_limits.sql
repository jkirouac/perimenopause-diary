-- Sensible size limits on free text, so no account can fill the database by accident
-- or on purpose. The app's text boxes carry the same limits (maxLength), so people
-- never meet these as errors. If any existing row were over a limit, this whole
-- migration would fail and change nothing.

alter table public.day_comments
  add constraint day_comments_text_length check (char_length(text) <= 2000);

alter table public.feedback
  add constraint feedback_message_length check (char_length(message) <= 5000),
  add constraint feedback_device_length check (char_length(device) <= 500);

alter table public.entries
  add constraint entries_value_length check (char_length(value) <= 100),
  add constraint entries_extra_size check (extra is null or char_length(extra::text) <= 1000);

alter table public.diary_rows
  add constraint diary_rows_label_length check (char_length(label) <= 80),
  add constraint diary_rows_dose_length check (char_length(dose) <= 80),
  add constraint diary_rows_notes_length check (char_length(notes) <= 300);

alter table public.profiles
  add constraint profiles_display_name_length check (char_length(display_name) <= 80);
