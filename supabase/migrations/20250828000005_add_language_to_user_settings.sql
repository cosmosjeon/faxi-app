-- Add language column to user_settings
-- Safe to run multiple times: check existence

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'user_settings'
      and table_schema = 'public'
      and column_name = 'language'
  ) then
    alter table public.user_settings
      add column language text check (language in ('ko','en')) not null default 'ko';
  end if;
end $$;

comment on column public.user_settings.language is 'App language preference (ko|en)';


