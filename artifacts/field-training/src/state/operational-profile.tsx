import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetOperationalProfile, updateOperationalProfile, type OperationalProfileContext, clearOperationalProfile, getOperationalProfile } from "@workspace/api-client-react";
import { OperationalAssignmentToken, OperationalIdentitySnapshot, type OperationalIdentity } from "@workspace/api-zod/operational-profile";
import { OperatorFacingError } from "@/lib/operator-errors.js";
import type { PhaseCaseFolder } from "@/lib/model.js";
import { AUTHENTICATION_REQUIRED_MESSAGE, AuthenticationRequiredError, isAuthenticationRejection, validateClerkSession, type ClerkSessionIdentity, type ValidateClerkSession } from "@/lib/auth-session.js";
import { useWorkspace } from "./workspace.js";

type ProfileState = {
  profile?: OperationalProfileContext; editorProfile?: OperationalProfileContext;
  pending: boolean; contextKey: string; error?: string;
  successfulRead?: number;
  save?(assignmentToken: string, expectedVersion: number): Promise<OperationalProfileContext>;
  clear?(expectedVersion: number): Promise<OperationalProfileContext>;
  refresh?(): Promise<OperationalProfileContext>;
  confirmCadIdentity?(identity: OperationalIdentity, expectedContextKey: string): void;
  setEditorDirty?(dirty: boolean): void;
  saveAuthRecoverySnapshot?(accountId?: string, fields?: Array<{ form: string; field: string; value: string }>): Promise<void>;
};
const Context = createContext<ProfileState>({ pending: false, contextKey: "no-operational-session" });
export { Context as OperationalProfileStateContext };
export const useOperationalProfile = () => useContext(Context);
/** No profile is restored from the local vault or a previous account's cache. */
export function OperationalProfileProvider({
  children, authSession, validateSession,
}: { children: ReactNode; authSession: ClerkSessionIdentity; validateSession: ValidateClerkSession }) {
  const { user, isLoaded, isSignedIn } = useUser();
  const workspace = useWorkspace();
  const subject = isLoaded && isSignedIn ? user?.id : undefined;
  return <OperationalProfileSessionProvider subject={subject} authSession={authSession}
    validateSession={validateSession} saveAuthRecoverySnapshot={workspace.saveAuthRecoverySnapshot}
    setEditorDirty={workspace.setEditorDirty}>
    {children}
  </OperationalProfileSessionProvider>;
}
/** Subject is session context only; the API independently verifies ownership. */
export function OperationalProfileSessionProvider({
  subject, children, authSession, validateSession, saveAuthRecoverySnapshot, setEditorDirty,
}: {
  subject?: string; children: ReactNode; authSession?: ClerkSessionIdentity;
  validateSession?: ValidateClerkSession;
  saveAuthRecoverySnapshot?: (accountId?: string, fields?: Array<{ form: string; field: string; value: string }>) => Promise<void>;
  setEditorDirty?: (dirty: boolean) => void;
}) {
  const cache = useQueryClient();
  const subjectRef = useRef(subject); subjectRef.current = subject;
  const authSessionRef = useRef(authSession); authSessionRef.current = authSession;
  const [successfulRead, setSuccessfulRead] = useState(0);
  const controllers = useRef(new Set<AbortController>());
  const channel = useRef<BroadcastChannel | null>(null);
  const [suspendedSubject, setSuspendedSubject] = useState<string>();
  useEffect(() => {
    subjectRef.current = subject;
    return () => {
      subjectRef.current = undefined;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
    };
  }, [subject, authSession?.accountId, authSession?.sessionId]);
  const query = useGetOperationalProfile({
    query: {
      queryKey: ["operational-profile", subject], enabled: !!subject, retry: false,
      staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 30_000,
      queryFn: async ({ signal }) => {
        const saved = await getOperationalProfile({ credentials: "include", signal });
        if (!subject || signal.aborted || subjectRef.current !== subject || saved.subject !== subject)
          throw new OperatorFacingError("The agency profile could not be refreshed. Saved packets are unchanged.");
        // Only a confirmed GET establishes read recovery, not a PUT or CAD cache update.
        setSuccessfulRead(read => read + 1);
        return saved;
      },
    },
    request: { credentials: "include" },
  });
  // Fail closed on a failed refresh rather than retaining a former assignment.
  const profile = suspendedSubject !== subject && !query.isError && query.data?.subject === subject ? query.data : undefined;
  const refresh = useCallback(async () => {
    const current = subject;
    if (!current || subjectRef.current !== current) throw new OperatorFacingError("Your account changed. Reopen Account Settings.");
    if (controllers.current.size) throw new OperatorFacingError("Wait for the profile change before reloading.");
    await cache.cancelQueries({ queryKey: ["operational-profile", current] });
    const result = await query.refetch();
    if (!current || current !== subjectRef.current || controllers.current.size || result.isError || result.data?.subject !== current)
      throw new OperatorFacingError("The agency profile could not be refreshed. Saved packets are unchanged.");
    setSuspendedSubject(undefined);
    return result.data;
  }, [cache, query.refetch, subject]);
  useEffect(() => {
    if (!subject || typeof BroadcastChannel === "undefined") return;
    const messages = new BroadcastChannel(`operational-profile:${subject}`);
    channel.current = messages;
    messages.onmessage = () => {
      setSuspendedSubject(subject);
      void refresh().catch(() => { /* Remain manual-only until an explicit successful refresh. */ });
    };
    return () => { messages.close(); channel.current = null; };
  }, [refresh, subject]);
  const mutate = useCallback(async (assignmentToken: string | null, expectedVersion: number) => {
    const current = subject;
    if (!current || subjectRef.current !== current)
      throw new OperatorFacingError("Your account changed. Reopen Account Settings before saving again.");
    if (assignmentToken !== null && !OperationalAssignmentToken.safeParse(assignmentToken).success)
      throw new OperatorFacingError("Use four district digits, an uppercase shift letter, and optional side -1 or -2.");
    const controller = new AbortController();
    const operationSession = authSessionRef.current;
    controllers.current.add(controller);
    // Stop dispatch consumers before sending either write; a lost response may
    // still have committed. Editor data remains available for explicit recovery.
    setSuspendedSubject(current);
    try {
      await cache.cancelQueries({ queryKey: ["operational-profile", current] });
      if (subjectRef.current !== current || controller.signal.aborted)
        throw new OperatorFacingError("Your account changed. Reopen Account Settings before saving again.");
      const request = { credentials: "include" as const, signal: controller.signal };
      await validateClerkSession(validateSession, operationSession);
      if (subjectRef.current !== current || controller.signal.aborted ||
        operationSession?.accountId !== current || authSessionRef.current?.sessionId !== operationSession.sessionId)
        throw new AuthenticationRequiredError();
      const result = assignmentToken === null
        ? await clearOperationalProfile({ expectedVersion, confirmedNoVehicle: true }, request)
        : await updateOperationalProfile({ assignmentToken, expectedVersion }, request);
      if (assignmentToken === null ? result.identity !== null : result.identity?.assignmentToken !== assignmentToken)
        throw new OperatorFacingError("The profile change was not confirmed. Reload the saved assignment before retrying.");
      if (controller.signal.aborted || subjectRef.current !== current || result.subject !== current)
        throw new OperatorFacingError("Your account changed. Reopen Account Settings before saving again.");
      await cache.cancelQueries({ queryKey: ["operational-profile", current] });
      if (controller.signal.aborted || subjectRef.current !== current)
        throw new OperatorFacingError("Your account changed. Reopen Account Settings before saving again.");
      const newer = cache.getQueryData<OperationalProfileContext>(["operational-profile", current]);
      if (newer && newer.version > result.version)
        throw new OperatorFacingError("This assignment changed elsewhere. Reload the saved assignment before retrying.");
      cache.setQueryData(["operational-profile", current], result);
      setSuspendedSubject(undefined);
      channel.current?.postMessage({ type: "changed" });
      return result;
    } catch (error) {
      if (isAuthenticationRejection(error)) {
        try { await saveAuthRecoverySnapshot?.(operationSession?.accountId); } catch { /* Workspace reports local persistence failures. */ }
        throw new OperatorFacingError(AUTHENTICATION_REQUIRED_MESSAGE);
      }
      if (subjectRef.current === current) {
        setSuspendedSubject(current);
        channel.current?.postMessage({ type: "changed" });
      }
      if (error instanceof OperatorFacingError) throw error;
      if (error && typeof error === "object" && "status" in error && error.status === 409)
        throw new OperatorFacingError("This assignment changed elsewhere. Reload the saved assignment before retrying.");
      throw new OperatorFacingError("The profile save was not confirmed. Reload the saved assignment before retrying. Existing packets are unchanged.");
    } finally { controllers.current.delete(controller); }
  }, [cache, subject, validateSession, saveAuthRecoverySnapshot]);
  const save = useCallback((token: string, version: number) => mutate(token, version), [mutate]);
  const clear = useCallback((version: number) => mutate(null, version), [mutate]);
  // Reuse the existing subject/version cache, not another profile store. A
  // confirmed adapter identity can supply tokens only for this exact selection.
  const confirmCadIdentity = useCallback((identity: OperationalIdentity, expectedContextKey: string) => {
    const current = subjectRef.current;
    const parsed = OperationalIdentitySnapshot.safeParse(identity);
    if (!current || !parsed.success || !parsed.data.districtToken) return;
    cache.setQueryData<OperationalProfileContext>(["operational-profile", current], saved =>
      saved?.subject === current && `${current}:${saved.version}` === expectedContextKey
        && saved.identity?.cadUnit === parsed.data.cadUnit
        ? { ...saved, identity: { ...saved.identity, districtToken: parsed.data.districtToken } } : saved);
  }, [cache]);
  return <Context.Provider value={{
    profile, editorProfile: query.data?.subject === subject ? query.data : undefined,
    pending: !!subject && query.isPending, successfulRead,
    contextKey: `${subject ?? ""}:${profile?.version ?? "unavailable"}`,
    error: query.isError ? "The agency profile service is unavailable or your account is not authorized. Existing packets are unchanged." : undefined,
    save, clear, refresh, confirmCadIdentity, setEditorDirty, saveAuthRecoverySnapshot,
  }}>{children}</Context.Provider>;
}
export function activeFtoIdentity(profile: OperationalProfileContext | undefined, folder: PhaseCaseFolder) {
  // During reconnect/reload, do not carry a possibly inactive prior cruiser.
  if (!profile) return null;
  return profile?.role === "FTO" && profile.badge === folder.ftoBadge ? profile.identity : undefined;
}
