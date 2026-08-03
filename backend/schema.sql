create table if not exists users (
  id bigserial primary key, name text not null, username text unique not null,
  email text unique not null, password_hash text not null, avatar_url text default '',
  bio text default '', created_at timestamptz default now()
);
create table if not exists categories (id bigserial primary key, name text unique not null, slug text unique not null);
insert into categories(name,slug) values ('Utilitários','utilitarios'),('Web e APIs','web'),('Dados','dados'),('IA','ia') on conflict do nothing;
create table if not exists packages (
  id bigserial primary key, user_id bigint references users(id), category_id bigint references categories(id),
  name text unique not null, description text not null default '', downloads bigint not null default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists package_versions (
  id bigserial primary key, package_id bigint references packages(id) on delete cascade,
  version text not null, readme text not null default '', license text not null default 'MIT',
  dependencies jsonb not null default '[]', archive_path text default '', created_at timestamptz default now(),
  unique(package_id,version)
);
create table if not exists package_dependencies (package_version_id bigint references package_versions(id) on delete cascade, name text not null, version text default '*', primary key(package_version_id,name));
create table if not exists downloads (id bigserial primary key, package_id bigint references packages(id) on delete cascade, user_id bigint references users(id), created_at timestamptz default now());
create table if not exists history (id bigserial primary key, user_id bigint references users(id) on delete cascade, action text not null, resource text not null, details jsonb default '{}', created_at timestamptz default now());
create table if not exists comments (id bigserial primary key, package_id bigint references packages(id) on delete cascade, user_id bigint references users(id) on delete cascade, body text not null, rating smallint check(rating between 1 and 5), created_at timestamptz default now());
create table if not exists notifications (id bigserial primary key, user_id bigint references users(id) on delete cascade, title text not null, body text not null, read boolean default false, created_at timestamptz default now());
create table if not exists support_tickets (id bigserial primary key, user_id bigint references users(id), subject text not null, message text not null, status text default 'aberto', created_at timestamptz default now());
create table if not exists sessions (id bigserial primary key, user_id bigint not null references users(id) on delete cascade, refresh_token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz default now());
create table if not exists settings (user_id bigint primary key references users(id) on delete cascade, github text default '', website text default '', updated_at timestamptz default now());
alter table settings add column if not exists language text not null default 'pt-BR';
alter table settings add column if not exists theme text not null default 'dark';
alter table settings add column if not exists notifications boolean not null default true;
alter table settings add column if not exists privacy_profile boolean not null default true;
create table if not exists api_tokens (id bigserial primary key, user_id bigint not null references users(id) on delete cascade, label text not null, token_hash text not null unique, last_used_at timestamptz, created_at timestamptz default now(), revoked_at timestamptz);
create table if not exists support_conversations (id bigserial primary key, user_id bigint references users(id) on delete set null, visitor_id text, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists support_messages (id bigserial primary key, conversation_id bigint not null references support_conversations(id) on delete cascade, role text not null check(role in ('user','assistant','system')), content text not null, created_at timestamptz default now());
create table if not exists registry_settings (key text primary key, value text not null, updated_at timestamptz default now());
insert into registry_settings(key,value) values ('support_email','suporte@jlscript.dev'),('support_initial_message','Olá! Sou a IA de suporte do JL Registry. Posso ajudar com login, publicação, instalação e a CLI.'),('support_hours','Segunda a sexta, 09:00 às 18:00') on conflict(key) do nothing;
create index if not exists support_messages_conversation_idx on support_messages(conversation_id,created_at);
create index if not exists history_user_created_idx on history(user_id,created_at desc);
create index if not exists versions_package_created_idx on package_versions(package_id,created_at desc);
