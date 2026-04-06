-- Enable pgvector extension for document embeddings
create extension if not exists vector;

-- ============================================================
-- Tenants (organizations)
-- ============================================================
create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text default 'free',
  settings jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Tenant users (maps auth.users to tenants)
-- ============================================================
create table tenant_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  role text not null default 'member', -- 'owner', 'admin', 'member'
  created_at timestamptz default now(),
  unique(user_id, tenant_id)
);

-- ============================================================
-- WhatsApp credentials per tenant
-- ============================================================
create table tenant_whatsapp_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade unique,
  phone_number_id text not null,
  whatsapp_business_account_id text not null,
  access_token text not null,
  facebook_app_secret text,
  webhook_verify_token text not null default encode(gen_random_bytes(32), 'hex'),
  status text default 'pending', -- 'pending', 'active', 'revoked'
  raw_oauth_response jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- Conversations (replaces in-memory storage)
-- ============================================================
create table conversations (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_number text not null,
  role text not null, -- 'user', 'assistant', 'system'
  message text not null,
  metadata jsonb default '{}',
  last_interaction_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_conversations_tenant_user on conversations(tenant_id, user_number);
create index idx_conversations_metadata on conversations using gin(metadata jsonb_path_ops);

-- ============================================================
-- Documents (FAQ knowledge base + pgvector embeddings)
-- ============================================================
create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  title text not null,
  content text not null,
  file_url text,
  file_type text, -- 'pdf', 'txt', 'md'
  metadata jsonb default '{}',
  embedding vector(1536), -- text-embedding-3-small dimension
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_documents_tenant on documents(tenant_id);
create index idx_documents_embedding on documents using ivfflat (embedding vector_cosine_ops);

-- ============================================================
-- Learning queue (human feedback for bot improvement)
-- ============================================================
create table learning_queue (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  question text not null,
  answer text not null,
  metadata jsonb default '{}',
  validated boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Escalations (handoff tracking)
-- ============================================================
create table escalations (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id bigint references conversations(id),
  status text default 'pending',
  handoff_type text default 'to_human',
  metadata jsonb default '{}',
  notes text,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table tenants enable row level security;
alter table tenant_users enable row level security;
alter table tenant_whatsapp_credentials enable row level security;
alter table conversations enable row level security;
alter table documents enable row level security;
alter table learning_queue enable row level security;
alter table escalations enable row level security;

-- tenant_users: users can see their own memberships
create policy "Users see own memberships"
  on tenant_users for select
  using (user_id = auth.uid());

-- tenants: users can see tenants they belong to
create policy "Users see own tenants"
  on tenants for select
  using (id in (select tenant_id from tenant_users where user_id = auth.uid()));

-- tenant_whatsapp_credentials: only tenant admins/owners can view
create policy "Tenant admins see credentials"
  on tenant_whatsapp_credentials for select
  using (tenant_id in (
    select tenant_id from tenant_users
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));

-- conversations: tenant members can read
create policy "Tenant members see conversations"
  on conversations for select
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

-- documents: tenant members can manage
create policy "Tenant members read documents"
  on documents for select
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

create policy "Tenant members insert documents"
  on documents for insert
  with check (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

create policy "Tenant members update documents"
  on documents for update
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

create policy "Tenant members delete documents"
  on documents for delete
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

-- learning_queue: tenant members can read
create policy "Tenant members see learning queue"
  on learning_queue for select
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

-- escalations: tenant members can read
create policy "Tenant members see escalations"
  on escalations for select
  using (tenant_id in (select tenant_id from tenant_users where user_id = auth.uid()));

-- ============================================================
-- Vector similarity search function
-- ============================================================
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5,
  p_tenant_id uuid default null
) returns table (id uuid, title text, content text, similarity float)
language plpgsql as $$
begin
  return query
    select d.id, d.title, d.content, 1 - (d.embedding <=> query_embedding) as similarity
    from documents d
    where d.tenant_id = p_tenant_id
    order by d.embedding <=> query_embedding
    limit match_count;
end;
$$;
