# FieldReady source map

```text
artifacts/
  field-training/             React + Vite responsive portal / PWA
    src/
      App.tsx                 Application entry and routing
      components/             Dashboard, forms and shared UI
      lib/
        offlineStorage.ts     AES-GCM IndexedDB vault and injectable sync queue
    public/                   Locally hosted PWA assets
  api-server/                 Existing Express + TypeScript service
    src/security/
      authorization.ts        Fail-closed session contract / role policy
      audit.ts                Append-only transactional audit writer
database/
  migrations/
    001_field_training.sql    Portable schema and protective triggers
docs/
  SECURITY.md                 Implemented boundaries and production prerequisites
  PROJECT_STRUCTURE.md        This source map
lib/
  api-spec/                   API contract (health endpoint; DOR API not live yet)
  api-client-react/           Generated API hooks
  api-zod/                    Generated validation
  db/                         PostgreSQL / Drizzle infrastructure
```

Frontend seed records are fictional. The working portal uses encrypted local
drafts, not the PostgreSQL schema yet. Live report APIs and identity integration
are deliberately disconnected until the security requirements are implemented.

## Development commands

- `pnpm --filter @workspace/field-training run typecheck`
- `pnpm --filter @workspace/api-server run typecheck`
- Start the configured FieldReady workflow to view the app.

The PWA service worker is production-only; a development preview is not proof
of installability or offline cold-start support on all target devices.
