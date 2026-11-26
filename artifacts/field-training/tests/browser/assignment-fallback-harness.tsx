/**
 * Browser-test entry only. No production route imports this module.
 * The runner serves its own empty document and supplies API route fixtures.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from "@tanstack/react-query";
import { OperationalProfileProvider, useOperationalProfile } from "../../src/state/operational-profile.js";
import { OperationalProfilePanel } from "../../src/components/operational-profile-panel.js";
import { usePatrolViewSync } from "../../src/hooks/use-patrolview-sync.js";
import { applyDispatchPrefill, type DispatchPrefillDraft } from "../../src/lib/dispatch-prefill.js";

const empty: DispatchPrefillDraft = {
  incidentNumber: "", runDateTimeText: "", runTimeText: "", runLocation: "",
  runLocationCity: "", runLocationState: "", runLocationZip: "", runZone: "",
  runCruiserDistrict: "", dispatchedCode: "", clearanceCode: "",
};

export function mount() {
  if (!import.meta.env.DEV) throw new Error("Browser harness requires the development server");
  const cache = new QueryClient();
  let latest: unknown;
  const prefills: unknown[] = [];
  function Probe() {
    const state = useOperationalProfile();
    const [draft, setDraft] = useState(empty);
    const ingress = usePatrolViewSync({
      eventId: "FICTIONAL-FALLBACK-EVENT", enabled: true, draft,
      onPrefill(initial, prefill) {
        prefills.push(prefill);
        setDraft(current => applyDispatchPrefill(current, initial, prefill));
      },
    });
    latest = {
      profile: state.profile, contextKey: state.contextKey, error: state.error,
      pending: state.pending, successfulRead: state.successfulRead,
      draft, prefills: [...prefills], ingress: ingress.status,
    };
    return <OperationalProfilePanel />;
  }
  const host = document.createElement("main");
  document.body.append(host);
  const root = createRoot(host);
  root.render(
    <ClerkProvider
      publishableKey={publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)}
      proxyUrl={import.meta.env.VITE_CLERK_PROXY_URL}
    >
      <QueryClientProvider client={cache}>
        <OperationalProfileProvider
          authSession={{ accountId: "FICTIONAL-BROWSER-USER", sessionId: "FICTIONAL-BROWSER-SESSION" }}
          validateSession={async () => {}}
        ><Probe /></OperationalProfileProvider>
      </QueryClientProvider>
    </ClerkProvider>,
  );
  return {
    snapshot: () => latest,
    cachedProfile: (subject: string) => cache.getQueryData(["operational-profile", subject]),
    profileQueryState: (subject: string) => {
      const query = cache.getQueryCache().find({ queryKey: ["operational-profile", subject] });
      return query ? { status: query.state.status, fetchStatus: query.state.fetchStatus } : null;
    },
    managers: () => ({ focused: focusManager.isFocused(), online: onlineManager.isOnline() }),
    // No manager setters, invalidation, refetch calls, or alternate profile store.
    dispose() { root.unmount(); cache.clear(); host.remove(); },
  };
}
