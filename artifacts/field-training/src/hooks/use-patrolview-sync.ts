import { useEffect, useRef, useState } from "react";
import { dispatchEventIngress } from "@workspace/api-client-react";
import {
  mapDispatchPrefillResponse,
  type DispatchPrefill,
  type DispatchPrefillDraft,
} from "@/lib/dispatch-prefill.js";

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
  const [status, setStatus] = useState<PatrolViewSyncStatus>("idle");
  const attemptedEventId = useRef<string | null>(null);
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  const onPrefillRef = useRef(onPrefill);
  draftRef.current = draft;
  onPrefillRef.current = onPrefill;

  useEffect(() => {
    if (!enabled || !eventId) {
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
      { eventId },
      { credentials: "include", signal: controller.signal },
    ).then((response) => {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      const prefill = mapDispatchPrefillResponse(response);
      if (!prefill) {
        setStatus("unavailable");
        return;
      }
      onPrefillRef.current(initialDraft, prefill);
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
  }, [enabled, eventId]);

  const reset = () => {
    requestController.current?.abort();
    requestController.current = null;
    attemptedEventId.current = null;
    requestSequence.current += 1;
    setStatus("idle");
  };

  return { status, reset };
}
