#!/usr/bin/env bash
# From repository root: bash docs/launch-readiness/rehearse.sh
# No database access, credential inspection, deployment, or browser records.
set -uo pipefail
cd "$(dirname "$0")/../.."
out="generated-artifacts/launch-readiness"
mkdir -p "$out"
{
  date -u +%FT%TZ
  git rev-parse HEAD
  git status --short
  node --version
  pnpm --version
  git diff --stat
  git ls-files 'artifacts/api-server/src/*' 'artifacts/api-server/migrations/*' \
    'artifacts/field-training/src/*' 'artifacts/field-training/*config*' \
    'artifacts/field-training/pwa-plugin.ts' 'scripts/src/bundle-package.ts' \
    'pnpm-lock.yaml' 'package.json' | sort | xargs sha256sum
} > "$out/baseline.txt"
run() {
  local name="$1"; shift
  "$@" > "$out/$name.log" 2>&1
  local code=$?
  printf '%s exit=%s\n' "$name" "$code" | tee -a "$out/results.txt"
}
: > "$out/results.txt"
run api env AUDIT_ID_HMAC_KEY=synthetic-readiness-key-not-used-for-agency-records \
  pnpm --filter @workspace/scripts exec tsx --test \
  ../artifacts/api-server/tests/agency-packets.test.ts \
  ../artifacts/api-server/tests/launch-readiness.test.ts \
  ../artifacts/api-server/src/routes/phase-extension-requests.test.ts \
  ../artifacts/api-server/src/services/patrolViewIncidentIntegration.test.ts \
  ../artifacts/api-server/test/authorization.test.ts \
  ../artifacts/api-server/test/secureRecords.test.ts \
  ../artifacts/api-server/test/resources.test.ts \
  ../artifacts/api-server/test/clerkProxyMiddleware.test.ts
run field env TZ=America/New_York TSX_TSCONFIG_PATH="$PWD/artifacts/field-training/tsconfig.test.json" \
  pnpm --filter @workspace/scripts exec tsx --test \
  ../artifacts/field-training/src/lib/launch-readiness.test.ts \
  ../artifacts/field-training/src/lib/offlineStorage.test.ts \
  ../artifacts/field-training/src/lib/protected-packets.test.ts \
  ../artifacts/field-training/src/lib/training-calendar.test.ts \
  ../artifacts/field-training/src/lib/phase-configuration.test.ts \
  ../artifacts/field-training/src/lib/phase-extension.test.ts \
  ../artifacts/field-training/src/lib/monthly-export.test.ts \
  ../artifacts/field-training/src/lib/narrative-continuation.test.ts \
  ../artifacts/field-training/src/lib/printable-daily-log.test.ts \
  ../artifacts/field-training/src/lib/weekly-log-print.test.ts \
  ../artifacts/field-training/src/lib/substitute-fto.test.ts \
  ../artifacts/field-training/src/lib/dispatch-prefill.test.ts
run typecheck pnpm typecheck
run build pnpm run build
if grep -q '^build exit=0$' "$out/results.txt"; then
  if [[ -f dist-production.zip ]]; then
    sha256sum dist-production.zip > "$out/prior-archive.sha256"
    unzip -Z1 dist-production.zip > "$out/prior-archive-files.txt"
  fi
  run bundle pnpm run bundle:production
  if grep -q '^bundle exit=0$' "$out/results.txt"; then
    sha256sum dist-production.zip > "$out/rebuilt-archive.sha256"
    unzip -Z1 dist-production.zip > "$out/rebuilt-archive-files.txt"
    unzip -t dist-production.zip > "$out/archive-integrity.log"
  fi
fi
if grep -Eq 'exit=[1-9]' "$out/results.txt"; then exit 1; fi
