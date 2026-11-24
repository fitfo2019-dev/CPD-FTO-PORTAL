import React, { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetOperationalProfile, updateOperationalProfile, type OperationalProfileContext } from "@workspace/api-client-react";
import { OperationalAssignmentToken, OperationalIdentitySnapshot, type OperationalIdentity } from "@workspace/api-zod/operational-profile";
import { OperatorFacingError } from "@/lib/operator-errors.js";
import type { PhaseCaseFolder } from "@/lib/model.js";

type ProfileState = {
  profile?: OperationalProfileContext; editorProfile?: OperationalProfileContext;
  pending: boolean; contextKey: string; error?: string;
  save?(assignmentToken: string, expectedVersion: number): Promise<OperationalProfileContext>;
  refresh?(): Promise<OperationalProfileContext>;
  confirmCadIdentity?(identity: OperationalIdentity, expectedContextKey: string): void;
};
const Context = createContext<ProfileState>({ pending: false, contextKey: "no-operational-session" });
export { Context as OperationalProfileStateContext };
export const useOperationalProfile = () => useContext(Context);
/** No profile is restored from the local vault or a previous account's cache. */
export function OperationalProfileProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const { user, isLoaded, isSignedIn } = useUser();
  const subject = isLoaded && isSignedIn ? user?.id : undefined;
  const subjectRef = useRef(subject); subjectRef.current = subject;
  const controllers = useRef(new Set<AbortController>());
  const channel = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!subject || typeof BroadcastChannel === "undefined") return;
    const messages = new BroadcastChannel(`operational-profile:${subject}`);
    channel.current = messages;
    messages.onmessage = () => { void cache.invalidateQueries({ queryKey: ["operational-profile", subject] }); };
    return () => { messages.close(); channel.current = null; };
  }, [cache, subject]);
  useEffect(() => {
    subjectRef.current = subject;
    return () => {
      subjectRef.current = undefined;
      for (const controller of controllers.current) controller.abort();
      controllers.current.clear();
    };
  }, [subject]);
  const query = useGetOperationalProfile({
    query: {
      queryKey: ["operational-profile", subject], enabled: !!subject, retry: false,
      staleTime: 0, refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 30_000,
    },
    request: { credentials: "include" },
  });
  // Fail closed on a failed refresh rather than retaining a former assignment.
  const profile = !query.isError && query.data?.subject === subject ? query.data : undefined;
  const refresh = useCallback(async () => {
    const current = subjectRef.current;
    const result = await query.refetch();
    if (!current || current !== subjectRef.current || result.isError || result.data?.subject !== current)
      throw new OperatorFacingError("The agency profile could not be refreshed. Saved packets are unchanged.");
    return result.data;
  }, [query.refetch]);
  const save = useCallback(async (assignmentToken: string, expectedVersion: number) => {
    const current = subjectRef.current;
    if (!current || !OperationalAssignmentToken.safeParse(assignmentToken).success)
      throw new OperatorFacingError("Use four district digits, an uppercase shift letter, and optional side -1 or -2.");
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      const result = await updateOperationalProfile({ assignmentToken, expectedVersion },
        { credentials: "include", signal: controller.signal });
      if (controller.signal.aborted || subjectRef.current !== current || result.subject !== current)
        throw new OperatorFacingError("Your account changed. Reopen Account Settings before saving again.");
      await cache.cancelQueries({ queryKey: ["operational-profile", current] });
      if (controller.signal.aborted || subjectRef.current !== current)
        throw new OperatorFacingError("Your account changed. Reopen Account Settings before saving again.");
      cache.setQueryData(["operational-profile", current], result);
      channel.current?.postMessage({ type: "changed" });
      return result;
    } catch (error) {
      if (error instanceof OperatorFacingError) throw error;
      if (error && typeof error === "object" && "status" in error && error.status === 409)
        throw new OperatorFacingError("This assignment changed elsewhere. Reload the saved assignment before retrying.");
      throw new OperatorFacingError("The profile save was not confirmed. Reload the saved assignment before retrying. Existing packets are unchanged.");
    } finally { controllers.current.delete(controller); }
  }, [cache]);
  // Reuse the existing subject/version cache, not another profile store. A
  // confirmed adapter identity can supply tokens only for this exact selection.
  const confirmCadIdentity = useCallback((identity: OperationalIdentity, expectedContextKey: string) => {
    const current = subjectRef.current;
    const parsed = OperationalIdentitySnapshot.safeParse(identity);
    if (!current || !parsed.success || !parsed.data.districtToken) return;
    cache.setQueryData<OperationalProfileContext>(["operational-profile", current], saved =>
      saved?.subject === current && `${current}:${saved.version}` === expectedContextKey
        && saved.identity?.cadUnit === parsed.data.cadUnit
        && saved.identity.assignmentToken === parsed.data.assignmentToken
        ? { ...saved, identity: parsed.data } : saved);
  }, [cache]);
  return <Context.Provider value={{
    profile, editorProfile: query.data?.subject === subject ? query.data : undefined,
    pending: !!subject && query.isPending,
    contextKey: `${subject ?? ""}:${profile?.version ?? "unavailable"}`,
    error: query.isError ? "The agency profile service is unavailable or your account is not authorized. Existing packets are unchanged." : undefined,
    save, refresh, confirmCadIdentity,
  }}>{children}</Context.Provider>;
}
export function activeFtoIdentity(profile: OperationalProfileContext | undefined, folder: PhaseCaseFolder) {
  return profile?.role === "FTO" && profile.badge === folder.ftoBadge ? profile.identity ?? undefined : undefined;
}
