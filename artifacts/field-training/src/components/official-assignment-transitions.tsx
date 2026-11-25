import React, { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  History,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast.js";
import { phaseLabel, type Phase } from "@/lib/model.js";
import {
  assignmentTransitionError,
  loadOfficialAssignmentTransitionContext,
  submitOfficialSuccessorAssignment,
} from "@/lib/assignment-transitions.js";
import { tokens } from "@workspace/fto-law-library-schema";
import type {
  AssignmentTransitionRecord,
  SuccessorAssignmentInput,
} from "@workspace/api-zod";

type View = "edit" | "review" | "complete" | "history";
type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

function hexToHsl(hex: string): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const lightness = (maximum + minimum) / 2;
  let hue = 0;
  let saturation = 0;
  if (maximum !== minimum) {
    const difference = maximum - minimum;
    saturation = lightness > 0.5
      ? difference / (2 - maximum - minimum)
      : difference / (maximum + minimum);
    if (maximum === r) hue = (g - b) / difference + (g < b ? 6 : 0);
    else if (maximum === g) hue = (b - r) / difference + 2;
    else hue = (r - g) / difference + 4;
    hue *= 60;
  }
  return `${hue.toFixed(2)} ${saturation.toFixed(4)}% ${lightness.toFixed(4)}%`;
}

function themeVariableName(name: string): string {
  return name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
    .replace(/^chart(\d)$/, "chart-$1");
}

const assignmentTheme = Object.fromEntries([
  ...Object.entries(tokens.color.light).map(([name, value]) => [
    `--${themeVariableName(name)}`,
    hexToHsl(value),
  ]),
  ["--app-font-heading", tokens.fontFamily.heading.join(", ")],
  ["--app-font-sans", tokens.fontFamily.sans.join(", ")],
  ["--app-font-mono", tokens.fontFamily.mono.join(", ")],
  ["--radius", tokens.radius],
  ["--spacing", tokens.spacing],
]) as ThemeStyle;

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addCalendarDays(value: string, days: number): string {
  const parsed = new Date(`${value}T12:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function displayDate(value: string): string {
  if (!isCalendarDate(value)) return value;
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function displayTimestamp(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) return undefined;
  const status = Number(error.status);
  return Number.isFinite(status) ? status : undefined;
}

export function OfficialAssignmentTransitions() {
  const { isLoaded, isSignedIn, user } = useUser();
  if (!isLoaded || !isSignedIn || !user) return null;
  return <OfficialAssignmentTransitionController key={user.id} userId={user.id} />;
}

export function OfficialAssignmentTransitionController({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [queryKey] = useState(() => ["official-assignment-transitions", userId, crypto.randomUUID()] as const);
  const active = useRef(true);
  const controller = useRef(new AbortController());
  const [view, setView] = useState<View>("edit");
  const [previousAssignmentId, setPreviousAssignmentId] = useState("");
  const [successorFtoId, setSuccessorFtoId] = useState("");
  const [successorPhase, setSuccessorPhase] = useState(1);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [pendingInput, setPendingInput] = useState<SuccessorAssignmentInput | null>(null);
  const [lastTransition, setLastTransition] = useState<AssignmentTransitionRecord | null>(null);
  const [submitError, setSubmitError] = useState("");

  useLayoutEffect(() => {
    active.current = true;
    if (controller.current.signal.aborted) controller.current = new AbortController();
    return () => {
      active.current = false;
      controller.current.abort();
      void queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.removeQueries({ queryKey, exact: true });
      const mutations = queryClient.getMutationCache();
      mutations.findAll({ mutationKey: queryKey, exact: true }).forEach(item => mutations.remove(item));
    };
  }, [queryClient, queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => {
      if (!active.current) throw new Error("This account is no longer active.");
      return loadOfficialAssignmentTransitionContext(
        AbortSignal.any([signal, controller.current.signal]),
      );
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: (input: SuccessorAssignmentInput) => {
      if (!active.current) throw new Error("This account is no longer active.");
      return submitOfficialSuccessorAssignment(input, controller.current.signal);
    },
    retry: false,
    onSuccess: async result => {
      if (!active.current) return;
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!active.current || controller.current.signal.aborted) return;
      const transition = result.data[0];
      if (!transition) {
        setSubmitError("The server response did not include an assignment history record.");
        return;
      }
      setLastTransition(transition);
      setPendingInput(null);
      setSubmitError("");
      setView("complete");
      toast({
        title: "Successor assignment confirmed",
        description: "Existing daily packets were not changed or submitted.",
      });
      void queryClient.invalidateQueries({ queryKey, exact: true });
    },
    onError: error => {
      if (!active.current) return;
      setSubmitError(assignmentTransitionError(error));
    },
  });

  const context = query.data;
  const assignments = context?.assignments ?? [];
  const transitions = context?.transitions ?? [];
  const previousAssignment = assignments.find(item => item.id === previousAssignmentId);
  const ftoChoices = useMemo(
    () => previousAssignment
      ? (context?.ftos ?? []).filter(item => item.class_name === previousAssignment.class_name)
      : [],
    [context?.ftos, previousAssignment],
  );

  useLayoutEffect(() => {
    if (!previousAssignmentId && assignments[0]) {
      setPreviousAssignmentId(assignments[0].id);
    }
  }, [assignments, previousAssignmentId]);

  useLayoutEffect(() => {
    if (!previousAssignment) return;
    setSuccessorFtoId(current => ftoChoices.some(item => item.fto_id === current)
      ? current
      : ftoChoices[0]?.fto_id ?? "");
    setSuccessorPhase(Math.min(previousAssignment.phase + 1, 4));
    setStartsOn("");
    setEndsOn("");
    setPendingInput(null);
    setSubmitError("");
    setView("edit");
  }, [previousAssignment?.id]);

  const dateValid = isCalendarDate(startsOn) && isCalendarDate(endsOn) && startsOn <= endsOn;
  const sourceDateValid = previousAssignment && isCalendarDate(previousAssignment.starts_on)
    ? startsOn > previousAssignment.starts_on
    : false;
  const formValid = Boolean(previousAssignment && successorFtoId &&
    ftoChoices.some(item => item.fto_id === successorFtoId) &&
    successorPhase >= 1 && successorPhase <= 4 && dateValid && sourceDateValid);

  function reviewTransition() {
    if (!formValid || !previousAssignment) return;
    const input = {
      operation_id: crypto.randomUUID(),
      previous_assignment_id: previousAssignment.id,
      fto_id: successorFtoId,
      phase: successorPhase,
      starts_on: startsOn,
      ends_on: endsOn,
    };
    setPendingInput(input);
    setSubmitError("");
    setView("review");
  }

  function resetForNewTransition() {
    setLastTransition(null);
    setPendingInput(null);
    setSubmitError("");
    setView("edit");
    setPreviousAssignmentId("");
  }

  const selectedFto = ftoChoices.find(item => item.fto_id === successorFtoId);
  const affectedPreviousEnd = previousAssignment && isCalendarDate(startsOn) &&
    startsOn <= previousAssignment.ends_on
    ? addCalendarDays(startsOn, -1)
    : previousAssignment?.ends_on ?? "";
  const selectedTransitions = [...transitions, ...(lastTransition &&
    !transitions.some(item => item.operation_id === lastTransition.operation_id)
    ? [lastTransition]
    : [])].filter(item =>
    item.po_badge === previousAssignment?.po_badge ||
    item.po_badge === lastTransition?.po_badge,
  );
  const retryAllowed = mutation.isError &&
    (statusOf(mutation.error) === undefined || statusOf(mutation.error) === 503);

  return (
    <section
      className="mt-5 rounded-lg border border-border bg-card text-foreground shadow-sm"
      style={assignmentTheme}
      aria-labelledby="official-assignment-transition-heading"
      data-testid="official-assignment-transitions"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="label-caps text-muted-foreground">Official server roster</p>
            <h3
              id="official-assignment-transition-heading"
              className="mt-1 text-lg font-bold text-card-foreground"
              style={{ fontFamily: "var(--app-font-heading)" }}
            >
              Successor assignments
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
              Change the FTO and phase scope for new work without waiting for earlier daily paperwork.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-bold uppercase text-card-foreground hover:bg-accent disabled:opacity-50"
          data-testid="button-refresh-official-assignments"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Refresh roster
        </button>
      </div>

      {query.isPending && (
        <p className="px-5 py-5 text-sm text-muted-foreground" role="status">
          Loading the official assignment roster…
        </p>
      )}
      {query.isError && (
        <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-4" role="alert">
          <p className="text-sm font-semibold text-destructive">
            {assignmentTransitionError(query.error)}
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-3 inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-xs font-bold uppercase text-card-foreground hover:bg-accent"
          >
            Retry roster lookup
          </button>
        </div>
      )}
      {context && (
        <div className="space-y-5 p-4 sm:p-5">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm leading-5 text-muted-foreground">
            This server-held roster is separate from the device-only import below. Existing packets keep their original assignment, FTO, phase, and work date; an assignment change does not submit or approve a packet.
          </div>

          {view === "edit" && (
            assignments.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-background p-5">
                <p className="text-sm font-semibold text-card-foreground">
                  No eligible official assignments are available in your Coordinator scope.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Device-only imports do not add to this list.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-card-foreground">
                    PO assignment to succeed
                    <select
                      value={previousAssignmentId}
                      onChange={event => setPreviousAssignmentId(event.target.value)}
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="select-official-predecessor"
                    >
                      {assignments.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.class_name} · PO {item.po_name} #{item.po_badge} · Phase {item.phase} · {item.fto_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-card-foreground">
                    Successor FTO
                    <select
                      value={successorFtoId}
                      onChange={event => setSuccessorFtoId(event.target.value)}
                      disabled={ftoChoices.length === 0}
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      data-testid="select-successor-fto"
                    >
                      {ftoChoices.length === 0 && <option value="">No trusted FTO choices</option>}
                      {ftoChoices.map(item => (
                        <option key={item.fto_id} value={item.fto_id}>
                          {item.fto_name} · {item.fto_badge}
                        </option>
                      ))}
                    </select>
                    {ftoChoices.length === 0 && (
                      <span className="text-xs font-normal text-destructive" role="alert">
                        No active server-rostered FTO is available for this class.
                      </span>
                    )}
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-card-foreground">
                    New work phase scope
                    <select
                      value={String(successorPhase)}
                      onChange={event => setSuccessorPhase(Number(event.target.value))}
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="select-successor-phase"
                    >
                      {[1, 2, 3, 4].map(phase => (
                        <option key={phase} value={phase}>{phaseLabel(phase as Phase)}</option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-1.5 text-sm text-muted-foreground">
                    <span className="font-semibold text-card-foreground">Current assignment range</span>
                    <span>
                      {previousAssignment
                        ? `${displayDate(previousAssignment.starts_on)} – ${displayDate(previousAssignment.ends_on)}`
                        : "Select an official assignment"}
                    </span>
                  </div>
                  <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-card-foreground">
                    Successor begins
                    <span className="relative">
                      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={startsOn}
                        onChange={event => setStartsOn(event.target.value)}
                        className="min-h-11 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-testid="input-successor-start-date"
                      />
                    </span>
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-card-foreground">
                    Successor ends
                    <span className="relative">
                      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="date"
                        value={endsOn}
                        onChange={event => setEndsOn(event.target.value)}
                        className="min-h-11 w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-testid="input-successor-end-date"
                      />
                    </span>
                  </label>
                </div>

                <div className="rounded-md border border-border bg-secondary/50 p-3 text-sm leading-5 text-secondary-foreground">
                  Changing assignment scope does not record a phase approval. If the successor begins during the current assignment range, the earlier assignment remains active through the day before that start date.
                </div>
                {previousAssignment && startsOn && !sourceDateValid && (
                  <p className="text-sm text-destructive" role="alert">
                    Choose a start date after the current assignment begins.
                  </p>
                )}
                {startsOn && endsOn && startsOn > endsOn && (
                  <p className="text-sm text-destructive" role="alert">
                    The successor end date must be on or after its start date.
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">
                    Only a verified Coordinator can change the server-held roster.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTransitions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setView("history")}
                        className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold uppercase text-card-foreground hover:bg-accent"
                        data-testid="button-open-assignment-history"
                      >
                        <History aria-hidden="true" className="size-4" /> View assignment history
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!formValid}
                      onClick={reviewTransition}
                      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      data-testid="button-review-successor-assignment"
                    >
                      Review transition <ArrowRight aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              </>
            )
          )}

          {view === "review" && previousAssignment && selectedFto && pendingInput && (
            <div className="mx-auto max-w-3xl rounded-md border border-border bg-background p-4 sm:p-6" data-testid="successor-assignment-confirmation">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="label-caps text-muted-foreground">Confirm roster change</p>
                  <h4 className="mt-1 text-lg font-bold text-card-foreground" style={{ fontFamily: "var(--app-font-heading)" }}>
                    Review successor assignment
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This action changes assignment scope only. It does not finalize a packet or record phase approval.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <SummaryRow label="PO" value={`${previousAssignment.po_name} · ${previousAssignment.po_badge}`} />
                <SummaryRow label="Class" value={previousAssignment.class_name} />
                <SummaryRow label="Previous assignment" value={`${previousAssignment.fto_name} · Phase ${previousAssignment.phase}`} />
                <SummaryRow label="Successor assignment" value={`${selectedFto.fto_name} · ${phaseLabel(successorPhase as Phase)}`} />
                <SummaryRow label="Successor dates" value={`${displayDate(startsOn)} – ${displayDate(endsOn)}`} />
                <SummaryRow label="Previous assignment ends" value={displayDate(affectedPreviousEnd)} />
              </dl>
              <div className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-sm leading-5 text-muted-foreground">
                Existing daily packets remain attached to their original assignment, FTO, phase, and work date. No packet will be submitted, moved, or approved.
              </div>
              {submitError && (
                <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setSubmitError(""); setView("edit"); }}
                  disabled={mutation.isPending}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold uppercase text-card-foreground hover:bg-accent disabled:opacity-50"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" /> Edit details
                </button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {retryAllowed && (
                    <button
                      type="button"
                      onClick={() => mutation.mutate(pendingInput)}
                      disabled={mutation.isPending}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold uppercase text-card-foreground hover:bg-accent disabled:opacity-50"
                    >
                      Retry same request
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => mutation.mutate(pendingInput)}
                    disabled={mutation.isPending}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    data-testid="button-confirm-successor-assignment"
                  >
                    {mutation.isPending ? "Saving…" : "Confirm successor assignment"}
                    {!mutation.isPending && <Check aria-hidden="true" className="size-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {view === "complete" && lastTransition && (
            <div className="mx-auto max-w-3xl rounded-md border border-border bg-background p-4 sm:p-6" data-testid="successor-assignment-complete">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <CheckCircle2 aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="label-caps text-muted-foreground">Server-confirmed assignment history</p>
                  <h4 className="mt-1 text-lg font-bold text-card-foreground" style={{ fontFamily: "var(--app-font-heading)" }}>
                    Successor assignment recorded
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Existing packet records were not changed or submitted.
                  </p>
                </div>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <SummaryRow label="PO" value={`${lastTransition.po_name} · ${lastTransition.po_badge}`} />
                <SummaryRow label="Class" value={lastTransition.class_name} />
                <SummaryRow label="Previous assignment" value={`${lastTransition.previous_fto_name} · Phase ${lastTransition.previous_phase}`} />
                <SummaryRow label="Successor assignment" value={`${lastTransition.successor_fto_name} · Phase ${lastTransition.successor_phase}`} />
                <SummaryRow label="Previous assignment ends" value={displayDate(lastTransition.previous_ends_on)} />
                <SummaryRow label="Successor dates" value={`${displayDate(lastTransition.successor_starts_on)} – ${displayDate(lastTransition.successor_ends_on)}`} />
              </dl>
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setView("history")}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-bold uppercase text-card-foreground hover:bg-accent"
                  data-testid="button-view-assignment-history"
                >
                  <History aria-hidden="true" className="size-4" /> View history
                </button>
                <button
                  type="button"
                  onClick={resetForNewTransition}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 text-sm font-bold uppercase text-primary-foreground hover:opacity-90"
                >
                  New transition <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          )}

          {view === "history" && (
            <div className="mx-auto max-w-3xl" data-testid="successor-assignment-history">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="label-caps text-muted-foreground">Immutable server audit</p>
                  <h4 className="mt-1 text-lg font-bold text-card-foreground" style={{ fontFamily: "var(--app-font-heading)" }}>
                    Assignment transition history
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setView(lastTransition ? "complete" : "edit")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-bold uppercase text-card-foreground hover:bg-accent"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" /> Back
                </button>
              </div>
              {selectedTransitions.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                  No assignment transitions are recorded for this PO yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {selectedTransitions.map(item => (
                    <li key={item.operation_id} className="rounded-md border border-border bg-background p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-card-foreground">
                          {item.po_name} · {item.po_badge}
                        </p>
                        <time className="text-xs text-muted-foreground">
                          {displayTimestamp(item.occurred_at)}
                        </time>
                      </div>
                      <p className="mt-2 text-sm text-card-foreground">
                        {item.previous_fto_name} · Phase {item.previous_phase}
                        {" → "}
                        {item.successor_fto_name} · Phase {item.successor_phase}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Previous assignment through {displayDate(item.previous_ends_on)} · Successor from {displayDate(item.successor_starts_on)} through {displayDate(item.successor_ends_on)}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-card-foreground">{value}</dd>
    </div>
  );
}
