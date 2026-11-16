-- Знімок СТРУКТУРИ схеми public: таблиці, колонки, обмеження, індекси, RLS, політики, тригери, функції, права.
-- Рядків даних і ключів не містить. Лише читання: нічого не змінює.
-- Продакшн: Supabase → SQL Editor → вставити весь файл → Run → скопіювати єдину клітинку результату у файл research/prod-schema.json.
-- Локально той самий запит виконує schema-compare.ts і порівнює результат зі знімком продакшна.
select jsonb_pretty(jsonb_build_object(
  'pg_version', current_setting('server_version'),
  'tables', (
    select jsonb_object_agg(c.relname, jsonb_build_object(
      'rls', c.relrowsecurity,
      'columns', (
        select jsonb_agg(jsonb_build_object(
                 'name', a.attname,
                 'type', format_type(a.atttypid, a.atttypmod),
                 'notnull', a.attnotnull,
                 'default', pg_get_expr(d.adbin, d.adrelid)) order by a.attnum)
          from pg_attribute a
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
         where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)))
      from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'),
  'constraints', (
    select jsonb_agg(jsonb_build_object('table', k.conrelid::regclass::text, 'name', k.conname, 'def', pg_get_constraintdef(k.oid))
                     order by k.conrelid::regclass::text, k.conname)
      from pg_constraint k
     where k.connamespace = 'public'::regnamespace and k.conrelid <> 0),
  'indexes', (
    select jsonb_agg(i.indexdef order by i.indexname) from pg_indexes i where i.schemaname = 'public'),
  'policies', (
    select jsonb_agg(jsonb_build_object('table', p.tablename, 'name', p.policyname, 'cmd', p.cmd, 'roles', to_jsonb(p.roles),
                                        'using', p.qual, 'check', p.with_check) order by p.tablename, p.policyname)
      from pg_policies p where p.schemaname = 'public'),
  'triggers', (
    select jsonb_agg(jsonb_build_object('table', t.tgrelid::regclass::text, 'name', t.tgname, 'def', pg_get_triggerdef(t.oid)) order by t.tgname)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
     where not t.tgisinternal and c.relnamespace = 'public'::regnamespace),
  'functions', (
    select jsonb_agg(jsonb_build_object('name', f.proname, 'args', pg_get_function_identity_arguments(f.oid),
                                        'def', pg_get_functiondef(f.oid), 'acl', f.proacl::text)
                     order by f.proname, pg_get_function_identity_arguments(f.oid))
      from pg_proc f
     where f.pronamespace = 'public'::regnamespace and f.prokind = 'f'),
  'table_grants', (
    select jsonb_agg(jsonb_build_object('table', g.table_name, 'grantee', g.grantee, 'priv', g.privilege_type)
                     order by g.table_name, g.grantee, g.privilege_type)
      from information_schema.role_table_grants g
     where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated', 'service_role'))
)) as schema;
