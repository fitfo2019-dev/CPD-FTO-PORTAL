import { useEffect, useRef, useState } from "react";
import { dispatchEventIngress } from "@workspace/api-client-react";
import {
  mapDispatchPrefillResponse,
  type DispatchPrefill,
  type DispatchPrefillDraft,
} from "@/lib/dispatch-prefill.js";
import { useOperationalProfile } from "@/state/operational-profile.js";

export type PatrolViewSyncStatus = "idle" | "loading" | "loaded" | "empty" | "unavailable";

type UsePatrolViewSyncOptions = {
  eventId: string;
  enabled: boolean;
  draft: DispatchPrefillDraft;
  onPrefill: (initial: DispatchPrefillDraft, prefill: DispatchPrefill) => void;
};

export function usePatrolViewSync({
  eventId,
  enabled,
  draft,
  onPrefill,
}: UsePatrolViewSyncOptions): { status: PatrolViewSyncStatus; reset: () => void } {
  const { profile, contextKey } = useOperationalProfile();
  const cadUnit = profile?.role === 'FTO' ? profile.identity?.cadUnit : undefined;
  const [status, setStatus] = useState<PatrolViewSyncStatus>("idle");
  const attemptedEventId = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  const onPrefillRef = useRef(onPrefill);
  draftRef.current = draft;
  onPrefillRef.current = onPrefill;

  useEffect(() => {
    if (!enabled || !eventId || !cadUnit) {
      attemptedEventId.current = null;
      setStatus("idle");
      return;
    }
    if (attemptedEventId.current === eventId) return;

    attemptedEventId.current = eventId;
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    requestController.current = controller;
    const initialDraft = { ...draftRef.current };
    setStatus("loading");

    void dispatchEventIngress(
      { eventId, cadUnit },
      { credentials: "include", signal: controller.signal },
    ).then((response) => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      const prefill = mapDispatchPrefillResponse(response);
      if (!prefill) {
        setStatus("unavailable");
        return;
      }
      // This automatic path may rerun after an account/profile refresh. Existing
      // authored values are not a new empty form, even if unchanged in flight.
      const protectedPrefill = { ...prefill };
      const fields = {
        incidentNumber: "incidentNumber", location: "runLocation", locationAddress: "runLocation",
        locationCity: "runLocationCity", locationState: "runLocationState", locationZip: "runLocationZip",
        zone: "runZone", cruiserDistrict: "runCruiserDistrict", dispatchedCode: "dispatchedCode",
        clearanceCode: "clearanceCode", eventDate: "runDateTimeText", eventIngressAt: "runDateTimeText",
      } as const;
      for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
        if (initialDraft[fields[key]]?.trim()) delete protectedPrefill[key];
      }
      onPrefillRef.current(initialDraft, protectedPrefill);
      setStatus(Object.values(prefill).some((value) => value !== undefined) ? "loaded" : "empty");
    }).catch(() => {
      if (!controller.signal.aborted && sequence === requestSequence.current) {
        setStatus("unavailable");
      }
    });

    return () => {
      controller.abort();
      if (requestController.current === controller) requestController.current = null;
      if (requestSequence.current === sequence) requestSequence.current += 1;
      if (attemptedEventId.current === eventId) attemptedEventId.current = null;
    };
  }, [enabled, eventId, cadUnit, contextKey]);

  const reset = () => {
    requestController.current?.abort();
    requestController.current = null;
    attemptedEventId.current = null;
    requestSequence.current += 1;
    setStatus("idle");
  };

  return { status, reset };
}
