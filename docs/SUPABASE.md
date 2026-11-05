# Syncing with Supabase (optional, not active)

ATLAS works fully offline. If you want your data on several devices, you can add a cloud backend. This guide describes how to do it with [Supabase](https://supabase.com) without changing any screens.

> **This requires external configuration** — a Supabase project, user sign-in, and a small amount of code. Nothing here runs until you build it.

## 1. Why sign-in is required

A cloud database must know *whose* data it is serving. Without authentication, anyone with your project URL and public key could read your journal. Supabase Auth (email magic link is the simplest) plus Row Level Security (RLS) ensures each person can only read and write their own row.

## 2. Create the table

In the Supabase SQL editor:

```sql
create table public.atlas_documents (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  saved_at   timestamptz not null default now()
);

alter table public.atlas_documents enable row level security;

create policy "Owner can read"   on public.atlas_documents for select using (auth.uid() = user_id);
create policy "Owner can insert" on public.atlas_documents for insert with check (auth.uid() = user_id);
create policy "Owner can update" on public.atlas_documents for update using (auth.uid() = user_id);

create table public.atlas_backups (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  meta       jsonb not null,
  data       jsonb not null
);
alter table public.atlas_backups enable row level security;
create policy "Owner manages backups" on public.atlas_backups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Storing the whole database as one JSON document matches how ATLAS already saves locally and keeps the adapter simple. (A normalised table per collection is possible later if you need server-side queries.)

## 3. Configure the app

Create `.env.local` (git-ignored) with your project's **public** values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

The anon key is designed to be public; RLS is what protects the data. **Never** put the `service_role` key in the frontend.

Install the client: `npm install @supabase/supabase-js`.

## 4. Write the adapter

Implement the `StorageAdapter` interface from `src/storage/adapter.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/data/types'
import type { BackupMeta, StorageAdapter, StoredBackup } from './adapter'

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export class SupabaseAdapter implements StorageAdapter {
  readonly label = 'Supabase (cloud)'
  readonly kind = 'indexeddb' as const // reuse the type or add 'supabase' to the union
  readonly persistent = true
  constructor(private userId: string) {}

  async load() {
    const { data, error } = await supabase.from('atlas_documents').select('data').eq('user_id', this.userId).maybeSingle()
    if (error) throw error
    return data?.data ?? null
  }
  async save(db: Database) {
    const { error } = await supabase.from('atlas_documents').upsert({ user_id: this.userId, data: db, saved_at: new Date().toISOString() })
    if (error) throw error
  }
  async listBackups(): Promise<BackupMeta[]> {
    const { data, error } = await supabase.from('atlas_backups').select('meta').order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => r.meta as BackupMeta)
  }
  async getBackup(id: string): Promise<StoredBackup | null> {
    const { data, error } = await supabase.from('atlas_backups').select('meta, data').eq('id', id).maybeSingle()
    if (error) throw error
    return data ? ({ ...(data.meta as BackupMeta), data: data.data } as StoredBackup) : null
  }
  async putBackup(b: StoredBackup) {
    const { data, ...meta } = b
    const { error } = await supabase.from('atlas_backups').upsert({ id: b.id, user_id: this.userId, created_at: b.createdAt, meta, data })
    if (error) throw error
  }
  async deleteBackup(id: string) {
    const { error } = await supabase.from('atlas_backups').delete().eq('id', id)
    if (error) throw error
  }
}
```

Then, after the user signs in, pass it to `initPersistence({ adapter: new SupabaseAdapter(session.user.id) })` in `src/main.tsx`.

## 5. Things to decide before going live

- **Offline use:** keep IndexedDB as a local cache and sync to Supabase in the background, so the app still works without a connection.
- **Conflicts:** if two devices edit while offline, use `mergeDatabases()` from `src/data/validate.ts` (newest `updatedAt` per record wins) instead of overwriting the whole document. Deletions need tombstones to sync reliably.
- **Encryption:** for the journal, consider encrypting the document client-side with a passphrase (Web Crypto AES-GCM) so even the database host can't read it — at the cost that a forgotten passphrase means lost data.
- **Size:** Postgres `jsonb` comfortably holds years of personal data, but very large documents make every save heavier; split by collection if it grows past a few MB.
