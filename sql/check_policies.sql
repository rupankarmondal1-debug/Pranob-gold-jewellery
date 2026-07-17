select tablename, policyname
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
