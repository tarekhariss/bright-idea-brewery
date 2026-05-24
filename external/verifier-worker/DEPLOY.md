# Verifier Worker — Auto-Deploy Setup

The worker auto-deploys to the Contabo VPS via GitHub Actions whenever
`external/verifier-worker/**` changes on `main`.

## One-time VPS bootstrap

SSH into the VPS as the deploy user (e.g. `deploy`) and run:

```bash
# 1. Install Docker + git if missing
sudo apt update && sudo apt install -y git docker.io docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 2. Clone the repo (use the GitHub repo connected to Lovable)
sudo mkdir -p /opt/tlbg-verifier-worker
sudo chown $USER:$USER /opt/tlbg-verifier-worker
git clone https://github.com/<org>/<repo>.git /opt/tlbg-verifier-worker
cd /opt/tlbg-verifier-worker/external/verifier-worker

# 3. Create .env from .env.example and fill in secrets
cp .env.example .env
nano .env   # set SUPABASE_URL, WORKER_API_URL, CRON_SECRET, WORKER_ID, etc.

# 4. First boot
docker compose up -d --build
docker compose logs -f
```

## GitHub Secrets required

In the connected GitHub repo → Settings → Secrets and variables → Actions:

| Secret           | Example                              | Notes                                  |
|------------------|--------------------------------------|----------------------------------------|
| `VPS_HOST`       | `verifier.example.com` or IP         | SSH host                               |
| `VPS_USER`       | `deploy`                             | SSH user with docker access            |
| `VPS_SSH_KEY`    | `-----BEGIN OPENSSH PRIVATE KEY----- …` | Private key; public key in VPS `~/.ssh/authorized_keys` |
| `VPS_REPO_PATH`  | `/opt/tlbg-verifier-worker`          | Optional, defaults to that path        |

Generate a deploy key on your machine:
```bash
ssh-keygen -t ed25519 -f tlbg_deploy -C "gh-actions-deploy"
# add tlbg_deploy.pub to ~/.ssh/authorized_keys on the VPS
# paste tlbg_deploy (private) into the VPS_SSH_KEY secret
```

## Manual trigger

GitHub → Actions → "Deploy Verifier Worker to Contabo VPS" → Run workflow.

## Updating worker code

Just edit `external/verifier-worker/worker.mjs` (or anything under that folder)
in Lovable. The change syncs to GitHub → Action fires → VPS pulls + rebuilds
the container. No manual copy/paste anywhere.

## Rollback

```bash
ssh deploy@$VPS_HOST
cd /opt/tlbg-verifier-worker
git log --oneline -n 10
git reset --hard <previous-sha>
cd external/verifier-worker && docker compose up -d --build
```
