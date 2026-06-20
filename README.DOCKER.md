Quick Docker setup for Nutraflow CRM

Prerequisites:
- Docker and Docker Compose v2 installed
- Copy your `.env.local` values or ensure the following env vars are set in your shell:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Build and run locally:

```bash
# Build images and start services
docker compose build
docker compose up

# Or in background
docker compose up -d
```

Production deployment:

```bash
# Pull latest code and rebuild
git pull
docker compose build
# Restart in detached mode
docker compose up -d
# Follow logs
docker compose logs -f web
docker compose logs -f worker
```

If you already have built images and only need to restart:

```bash
docker compose down
docker compose up -d
```

Important:
- This project must run on a Docker host or VM, not on Vercel, because WhatsApp/Baileys requires a long-lived worker process.
- The `web` service proxies `/api/whatsapp` to the running `worker` service.
- Make sure `.env.local` contains:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `USE_WHATSAPP_WORKER=1`

For production, manage secrets securely via environment variables, Docker secrets, or your platform provider.

If the worker is deployed separately under a public host, set `WHATSAPP_WORKER_URL` to that service URL in the web environment.
