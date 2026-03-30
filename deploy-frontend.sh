#!/usr/bin/env bash
# Deploy frontend su server: pull, build immagine con NEXT_PUBLIC_*, ricrea solo il servizio compose.
#
# Uso:
#   chmod +x deploy-frontend.sh
#   # Opzione A — variabili in sessione:
#   export NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
#   export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
#   ./deploy-frontend.sh
#
#   # Opzione B — file .env.build (non committare; stesso formato di .env, una riga per chiave):
#   #   NEXT_PUBLIC_API_BASE_URL=https://apppitch.it
#   #   NEXT_PUBLIC_SUPABASE_URL=...
#   #   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
#   ./deploy-frontend.sh
#
set -euo pipefail

FRONTEND_DIR="${FRONTEND_DIR:-/home/pitchadmin/pitch-frontend}"
STACK_DIR="${STACK_DIR:-/home/pitchadmin/pitch-stack}"
IMAGE_NAME="${IMAGE_NAME:-pitch-frontend:latest}"
BRANCH="${BRANCH:-main}"

if [[ -f "${FRONTEND_DIR}/.env.build" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "${FRONTEND_DIR}/.env.build"
  set +a
fi

API_BASE="${NEXT_PUBLIC_API_BASE_URL:-https://apppitch.it}"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Errore: imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY" >&2
  echo "(export o file ${FRONTEND_DIR}/.env.build)" >&2
  exit 1
fi

git -C "${FRONTEND_DIR}" pull origin "${BRANCH}"

docker build -t "${IMAGE_NAME}" \
  --build-arg "NEXT_PUBLIC_API_BASE_URL=${API_BASE}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -f "${FRONTEND_DIR}/Dockerfile" \
  "${FRONTEND_DIR}"

docker compose -f "${STACK_DIR}/docker-compose.yml" --project-directory "${STACK_DIR}" up -d --no-deps --force-recreate frontend

echo "OK: ${IMAGE_NAME} e servizio frontend ricreati."
