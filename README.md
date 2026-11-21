# Project Setup

This workspace contains the Express API Server and the React/Vite Component Preview Server. It does not currently connect to a live identity provider, database-backed application routes, or an upstream Government System.

The API server requires Node.js `^20.19.0 || >=22.12.0 <25`. For an external API-server deployment, run `pnpm run build:api` followed by `pnpm start`; the server reads `PORT` from the environment, falls back to `3000`, and binds to `0.0.0.0`.

## Environment variables

Configure these values through the agency service manager or a protected environment file. Node does not automatically load `.env` for `npm start`; inject values through the service manager or use the host's environment-file facility. Do not commit secrets or print them in logs.

| Variable            | Requirement                                                              | Purpose                                                                                            |
| ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `NODE_ENV`          | Set to `production` on the agency server                                 | Enables production middleware and startup checks.                                                  |
| `PORT`              | Optional; defaults to `3000`                                             | Listening port supplied by the host or service manager.                                            |
| `TRUST_PROXY_HOPS`  | Optional; defaults to `1`                                                | Exact count of trusted proxies before Express. Set to the actual chain length; do not guess.       |
| `AUDIT_ID_HMAC_KEY` | Required; at least 32 bytes                                              | Secret-manager key for pseudonymizing actor and client-IP identifiers in audit events.              |
| `USE_REAL_API`      | Optional; defaults to `false`                                            | `false` serves safe mock records. Set `true` only to enable the live adapter.                      |
| `REAL_API_URL`      | Required only when production live mode is enabled                       | Approved HTTPS origin for the upstream records service.                                            |
| `REAL_API_KEY`      | Required only when production live mode is enabled                       | Server-only upstream credential; never forwarded from the browser.                                 |
| `ALLOWED_ORIGINS`   | Optional for same-origin hosting; required for a separate browser origin | Comma-separated exact HTTPS origins allowed by CORS. Wildcards are not accepted.                   |
| `LOG_LEVEL`         | Optional; defaults to `info`                                             | Pino logging threshold. Logs are JSON to stdout.                                                   |
| `DATABASE_URL`      | Not currently required by API routes                                     | PostgreSQL connection string for the separate database helper if database-backed routes are added. |

The proxy setting is applied before Helmet and request logging. Use `1` when exactly one trusted reverse proxy is in front of the server. For multiple proxies, set the exact count (for example, `2` for a WAF followed by Nginx). The current workspace preview uses two hops; the agency server should use its own verified topology.

The browser client is fixed to the same-origin `/api` route. It rejects external API URLs and redirects. The live adapter uses only `REAL_API_KEY`; it never forwards browser Authorization headers or the mock demonstration token.

## Agency deployment

Build the standalone package from the workspace:

```sh
pnpm install --frozen-lockfile
pnpm run bundle:production
zip -r dist-production.zip dist-production
```

Transfer `dist-production.zip` to the internal server, extract it, and change into `dist-production`. Set the required environment variables through the service manager or a protected environment file, then install and start:

```sh
npm install --production
npm start
```

For an offline server, use a pre-populated npm cache or an agency-controlled package mirror. With a populated cache, install with `npm install --production --offline`; without cached packages or an internal mirror, npm cannot download dependencies while offline. The archive does not contain `.env` files or credentials.

The bundle contains `index.js`, required Pino worker modules, and a standalone production `package.json`. Its start script is `node index.js`; it declares the same Node.js engine range as the workspace (`^20.19.0 || >=22.12.0 <25`). Keep the process in the foreground under systemd, PM2, or the agency’s service manager so it can capture stdout and stderr.

## Workspace checks and runtime boundaries

- `pnpm run typecheck` checks the workspace.
- `pnpm run build:api` builds the API and shared libraries.
- `pnpm run bundle:production` creates `dist-production/`.
- `npm run build` builds the workspace API and component-preview artifacts when the active workflow provides `PORT` and `BASE_PATH`.
- `pnpm start` starts the workspace API build.
- The API server has no local file uploads or persistent session storage. Mock records are in-memory constants.
- The database helper creates a PostgreSQL pool only from `DATABASE_URL`; no current API route imports or uses it.
- The component preview dev plugin writes a generated component registry for development previews only; it is not application data or user-uploaded storage.
- The XML-to-JSON gateway remains a planned architectural boundary, not an active integration.
