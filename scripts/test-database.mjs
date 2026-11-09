import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
const db=new PGlite();
try{
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 grant usage on schema public,auth,storage to anon,authenticated,service_role;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,email_confirmed_at timestamptz,last_sign_in_at timestamptz,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text);
 alter table storage.objects enable row level security;
 grant all on storage.objects to authenticated,service_role;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
 alter default privileges in schema public grant all on tables to service_role;
 `);
 for(const filename of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(n=>n.endsWith('.sql')).sort()){
  await db.exec(await readFile(new URL('../supabase/migrations/'+filename,import.meta.url),'utf8'));
 }
 const results=await db.exec(await readFile(new URL('../tests/platform.sql',import.meta.url),'utf8'));
 const verdict=results.flatMap(r=>r.rows).find(r=>r?.result==='platform transaction assertions passed');
 if(!verdict)throw Error('Test assertions did not complete.');
 console.log(verdict.result);
 console.log('All canonical migrations replayed against isolated PostgreSQL. Auth and Storage schema contracts are local test fixtures.');
}finally{await db.close()}
