## Goal

Replace the current blank Lovable starter with the full `fuelspark-ai-lab-main` codebase from your uploaded zip so you can continue making changes here.

## What I'll do

1. **Extract and copy source** from `/mnt/user-uploads/fuelspark-ai-lab-main.zip` into `/dev-server`, excluding any `.git` metadata to protect the repo.
   - Copy: `src/`, `supabase/`, `package.json`, `bun.lock`, `bunfig.toml`, `components.json`, `eslint.config.js`, `tsconfig.json`, `vite.config.ts`.
   - Overwrite the existing starter files (`src/routes/index.tsx`, `__root.tsx`, `styles.css`, `router.tsx`, etc.) with the project's versions.
   - Skip `package-lock.json` (this workspace uses bun).

2. **Install dependencies** with `bun install` so the new packages (Supabase, AI SDK, jspdf, etc.) are available.

3. **Enable Lovable Cloud** (Supabase) since the project ships with `supabase/` migrations and a Supabase integration. The three migration files from the zip will be applied so tables/policies are created in this project's backend.

4. **Verify** the dev preview boots — check the home route renders and there are no missing-import or build errors. Fix any path/env issues that surface.

## Notes / things to confirm

- This wipes the current blank starter routes — that's expected since you want the full project loaded.
- Any **secrets/API keys** the original project relied on (e.g. AI provider keys, third-party APIs) won't carry over from the zip. After load, if the app calls a service that needs a key, I'll prompt you to add it via the secrets tool.
- The GitHub repo link is just for reference; the zip is the source of truth for the load.

## Technical details

- Extraction: `unzip` to `/tmp`, then `rsync -a --exclude='.git' --exclude='.git/**' --exclude='package-lock.json' /tmp/fuelspark-ai-lab-main/ /dev-server/`.
- Migrations go to `supabase/migrations/` with their original timestamps — they'll be applied on Cloud enable.
- After install, the TanStack Router plugin regenerates `routeTree.gen.ts` automatically.
