# Workspace Instructions

**Read `PROJECT_MANIFEST.md` before modifying the codebase.** It is the current reference for architecture, API contracts, environment configuration, and scope.

## Current workspace

- `artifacts/api-server/` — Express API Server.
- `artifacts/mockup-sandbox/` — React/Vite Component Preview Sandbox.
- `lib/` — shared API client, OpenAPI contract, generated Zod schemas, and an unconnected database foundation.

No connected product frontend, live identity provider, or database-backed application route is present in this workspace. The `callbox\pv3` application exists on the internal server, but its source and runtime are outside this Repl. The XML-to-JSON gateway is planned only. The audit dashboard is an isolated preview mockup.

## Run and verify

- `pnpm run typecheck` — TypeScript checks for workspace packages.
- `PORT=8080 BASE_PATH=/__mockup pnpm run build` — workspace type checks and production builds.
- `pnpm run bundle:production` — creates the standalone API package and ZIP archive.
- `pnpm --filter @workspace/api-server run dev` — API Server workflow.
- `pnpm --filter @workspace/mockup-sandbox run dev` — Component Preview Server workflow.

Use the artifact-managed workflows for preview services; do not create duplicate workflows.

## Security and naming

- Keep `AUDIT_ID_HMAC_KEY`, `REAL_API_KEY`, and other credentials in the environment secret manager. Never print or log their values.
- Keep live API access disabled unless approved server-side configuration is present. Never forward browser credentials to the upstream service.
- Do not claim production readiness, regulatory compliance, or immutable audit retention from the current mock-first implementation.
- Use the project names documented in `PROJECT_MANIFEST.md`; do not introduce alternate product terminology or numerical performance ratings.

## Legacy documents

Some descriptions in `docs/PROJECT_STRUCTURE.md` and `docs/SECURITY.md` refer to the internal-server `callbox\pv3` application. Its source/runtime is outside this Repl; do not infer that referenced files or routes exist in the current source tree.
