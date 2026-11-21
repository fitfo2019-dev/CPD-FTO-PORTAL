# Project Setup and Agency Handover

This pnpm workspace contains the Express API Server, the React/Vite Component Preview Sandbox, and the Field Training Officer Portal. `callbox\pv3` is an internal-server application and is not included in this source tree.

## Current scope

- The Field Training Officer Portal includes Clerk sign-in and workflow screens. Its drafts are encrypted in device-local IndexedDB; no training-record synchronization or database-backed portal routes are connected.
- The API's `/api/v1/secure-records` route serves validated synthetic records by default. `USE_REAL_API` is fail-secure and defaults to `false`; production live mode requires server-side configuration and an approved authorization grant.
- Clerk authentication is present, but agency employment, role, record-scope, and department identity policies are not configured here. Do not treat the prototype as approved for operational or CJIS-restricted data.
- The XML-to-JSON gateway remains a planned boundary. No live Government System XML or binary integration is active.

## Validation and module format

- The shared workspace Zod catalog is aligned to Zod 4 (`^4.6.7`), including the OpenAPI-generated `@workspace/api-zod` validators. Field Training forms use Zod 4 with `@hookform/resolvers` `7.0.7` and React Hook Form.
- Workspace packages use ECMAScript modules. Local TypeScript and TSX imports use the emitted `.js` suffix (for example, `./model.js`); directory entrypoints specify `/index.js`. TypeScript resolves these source specifiers to `.ts`/`.tsx` files, while compiled Node code keeps valid ESM paths.
- OpenAPI-generated validators and clients live under `lib/api-zod` and `lib/api-client-react`. After code generation, verify local generated imports retain explicit ESM extensions before building.

## Runtime and environment

The workspace targets Node.js `^20.19.0 || >=22.12.0 <25`. Configure values through the agency service manager or a protected environment file. Node does not automatically load `.env` for `npm start`. Never commit secrets or print them in logs.

| Variable | Requirement | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Set to `production` on the agency server | Enables production middleware and startup checks. |
| `PORT` | Optional; defaults to `3000` | Port supplied by the host or service manager. |
| `TRUST_PROXY_HOPS` | Optional; defaults to `1` | Exact count of trusted reverse proxies. The confirmed agency ingress has two hops; set to `2` for that topology and recheck if it changes. |
| `AUDIT_ID_HMAC_KEY` | Required for API startup; at least 32 bytes | Secret-manager key for HMAC-SHA-256 pseudonyms of verified user identifiers and client IP addresses. |
| `CLERK_PUBLISHABLE_KEY` | Required for production API authentication | Clerk publishable key used by the server middleware. |
| `CLERK_SECRET_KEY` | Required for the production Clerk proxy | Server-only Clerk credential. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Required when building the Field Training Officer Portal | Public, build-time Clerk key for the browser application. |
| `VITE_CLERK_PROXY_URL` | Set by the approved Clerk deployment for production proxying | Browser-side Clerk proxy URL; keep empty in development. |
| `USE_REAL_API` | Optional; defaults to `false` | Fail-secure mock-by-default switch. Production live mode requires `REAL_API_URL`, `REAL_API_KEY`, and an approved authorization grant. |
| `REAL_API_URL` | Required when production live mode is enabled | HTTPS endpoint for the upstream records service. |
| `REAL_API_KEY` | Required when production live mode is enabled | Server-only upstream credential; browser authorization headers are never forwarded to this service. |
| `ALLOWED_ORIGINS` | Optional for same-origin hosting; required for a separate browser origin | Comma-separated exact HTTPS origins allowed by CORS. Wildcards are rejected. |
| `LOG_LEVEL` | Optional; defaults to `info` | Pino logging threshold. Structured logs are written to stdout. |
| `DATABASE_URL` | Not used by current API routes | Connection string for the separate database helper if database-backed routes are implemented. |

`TRUST_PROXY_HOPS` is validated and applied before security, request logging, and audit middleware. The confirmed agency ingress uses two trusted hops, so set `TRUST_PROXY_HOPS=2` for that deployment. Do not trust forwarded headers directly or reuse that value for a different proxy topology without verification.

## Build and package

From the workspace root:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run build
pnpm run bundle:production
```

`pnpm run build` type-checks the workspace and builds the API, shared libraries, component preview, and portal. `pnpm run bundle:production` builds and type-checks the API, then recreates `dist-production/` and `dist-production.zip`. The packaging step removes prior generated package output before writing the new archive; do not run a second `zip` command on the same files.

The standalone archive contains the compiled API entry and a production-only `package.json`. Third-party runtime packages remain external and are listed in that manifest; workspace modules are bundled into the API output. No workspace `node_modules` directory is copied. The portal's static build is separate from the API package.

### Agency-managed monorepo startup

Build the workspace from its root, with `VITE_CLERK_PUBLISHABLE_KEY` and any other build-time public settings supplied by the deployment environment:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm run build
```

Inject `AUDIT_ID_HMAC_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` through the agency's secret manager or service environment. Then start the API from the workspace root:

```sh
NODE_ENV=production PORT=3000 TRUST_PROXY_HOPS=2 USE_REAL_API=false pnpm start
```

Set `TRUST_PROXY_HOPS` to the verified number of trusted proxies in front of Express; `2` applies only to the confirmed two-hop Columbus ingress topology. The API binds to `0.0.0.0`, reads `PORT`, and writes structured logs to stdout. The root `pnpm start` command starts the API only. Serve `artifacts/field-training/dist/public` as the static portal with an SPA fallback to `index.html`; the API does not host the portal files.

Configure the reverse proxy to preserve the `/api` prefix when forwarding API traffic and to overwrite, not append to untrusted client-supplied forwarding headers. Express applies the configured hop count before audit and security middleware; the Clerk proxy uses Express-resolved host and client-IP values and replaces forwarded headers before its upstream request.

To run the standalone API package on the agency server:

```sh
unzip dist-production.zip
cd dist-production
npm install --production
npm start
```

Inject the required API secrets and runtime settings through the agency service manager before `npm start`; the archive contains no `.env` file or credentials.

For an offline server, install from a pre-populated npm cache or an agency-controlled package mirror. The archive does not contain `.env` files or credentials. Keep the service in the foreground under systemd, PM2, or the agency's service manager so stdout and stderr can be captured and rotated.

For individual workspace services, use:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/mockup-sandbox run dev
pnpm --filter @workspace/field-training run dev
```

## Operational boundaries

- The Express server reads `PORT` from the environment, defaults to `3000`, and binds to `0.0.0.0`.
- API request logs are structured JSON Lines on stdout. They are not a write-once archive; configure the agency's approved external log collection and retention separately.
- The backend does not persist application data to local files. The Field Training Officer Portal stores encrypted offline drafts in browser IndexedDB using AES-GCM and a passphrase-derived key; it does not sync those drafts to the API.
- The separate database helper uses `DATABASE_URL`, but current API routes do not import it.
- The component preview dev plugin writes a generated registry for previews only; it is not application data.
- `API_BASE_URL` is centralized in the shared API client and points to the same-origin `/api` path.
