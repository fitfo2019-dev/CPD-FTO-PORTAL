// Adapter between the new-run dialog and the agency dispatch incident lookup.
// Called ONLY after the FTO submits an incident number. Never on page load or URL params.
import { dispatchIncidentLookup } from '@workspace/api-client-react';
import { mapDispatchIncidentResponse, selectDispatchIncidentMatch, type DispatchIncidentPrefill } from '@/lib/dispatch-prefill.js';

export const DISPATCH_LOOKUP_TIMEOUT_MS = 15_000;

export type IncidentLookupResult =
  | { status: 'matched'; match: DispatchIncidentPrefill }
  | { status: 'empty' }
  | { status: 'choose'; reason: 'choose_unit' | 'ambiguous'; matches: DispatchIncidentPrefill[] }
  | { status: 'unavailable'; message: string }
  | { status: 'aborted' };

export async function lookupDispatchIncident(incidentNumber: string, unitNumber: string, signal: AbortSignal): Promise<IncidentLookupResult> {
  if(signal.aborted)return {status:'aborted'};
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), DISPATCH_LOOKUP_TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    const raw = await dispatchIncidentLookup(
      { incidentNumber, ...(unitNumber ? { unitNumber } : {}) },
      { signal: timeout.signal, credentials: 'include' },
    );
    if (signal.aborted) return { status: 'aborted' };
    const matches = mapDispatchIncidentResponse(raw);
    if (!matches) return { status: 'unavailable', message: 'The dispatch service returned data the portal could not verify.' };
    const selection = selectDispatchIncidentMatch(matches, incidentNumber, unitNumber);
    if (selection.status === 'matched') return { status: 'matched', match: selection.match };
    if (selection.status === 'empty') return { status: 'empty' };
    return { status: 'choose', reason: selection.status, matches: selection.matches };
  } catch {
    if (signal.aborted) return { status: 'aborted' };
    if (timeout.signal.aborted) return { status: 'unavailable', message: 'Dispatch lookup timed out after 15 seconds.' };
    return { status: 'unavailable', message: 'Dispatch lookup is unavailable or not configured.' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}
