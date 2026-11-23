import React, { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AgencyPacketReview } from "./agency-packet-review.js";
import { createPacketReviewCommand, loadAgencyPackets, performPacketReview, packetReviewError,
  packetCommandSatisfied, type AgencyPacketsEnvelope, type AgencyPacket,
  type PacketReviewCommand, type PacketReviewDraft } from "../lib/agency-packets.js";

type AccessProps = { userId?: string; authenticated: boolean; previewOnly: boolean; unlocked: boolean };

/** No query controller exists outside this single eligibility boundary. In
 * particular, imperative refresh cannot override a disabled React Query. */
export function AgencyPacketAccess({ userId, authenticated, previewOnly, unlocked }: AccessProps) {
  const eligible = Boolean(userId) && authenticated && !previewOnly && unlocked;
  if (!eligible) return <AgencyPacketReview packets={[]} role={null} loading={false} refreshing={false}
    canRefresh={false} unavailable={previewOnly
      ? "Agency Records Are Not Loaded in the Fictional Workspace Preview."
      : !authenticated ? "Sign in with Your Verified Agency Account to Access Packets."
      : "Unlock Your Local Workspace to Access Agency Packets."}
    actionError="" message="" busy={false} pendingAction={null}
    onRefresh={() => {}} onRetry={() => {}} onAction={() => {}} />;
  // Lock, sign-out, preview and identity changes destroy the controller. A new
  // mount gets a unique cache scope so late responses cannot reach a new session.
  return <PacketController key={userId} userId={userId!} />;
}

function PacketController({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [queryKey] = useState(() => ["agency-packets", userId, crypto.randomUUID()] as const);
  const active = useRef(true);
  const controller = useRef(new AbortController());
  const [pending, setPending] = useState<PacketReviewCommand | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  useLayoutEffect(() => {
    active.current = true;
    if (controller.current.signal.aborted) controller.current = new AbortController();
    return () => {
      active.current = false;
      controller.current.abort();
      void cache.cancelQueries({ queryKey, exact: true });
      cache.removeQueries({ queryKey, exact: true });
      const mutations = cache.getMutationCache();
      mutations.findAll({ mutationKey: queryKey, exact: true }).forEach(item => mutations.remove(item));
    };
  }, [cache, queryKey]);
  const query = useQuery({
    queryKey, queryFn: ({ signal }) => {
      if (!active.current) throw new Error("Agency Packet Access Is Locked.");
      return loadAgencyPackets(AbortSignal.any([signal, controller.current.signal]));
    },
    staleTime: 0, gcTime: 0, retry: false, refetchInterval: pending ? false : 30000,
    refetchOnWindowFocus: !pending,
  });
  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: (command: PacketReviewCommand) => {
      if (!active.current) throw new Error("Agency Packet Access Is Locked.");
      return performPacketReview(command, controller.current.signal);
    }, retry: false,
    onSuccess: async result => {
      if (!active.current) return;
      await cache.cancelQueries({ queryKey, exact: true });
      if (!active.current || controller.current.signal.aborted) return;
      cache.setQueryData<AgencyPacketsEnvelope>(queryKey, current => {
        const updated = new Map(result.data.map(packet => [packet.id, packet]));
        const rows = current?.data.map(packet => updated.get(packet.id) ?? packet) ?? result.data;
        return { ...result, data: rows, metadata: { ...result.metadata, total_records: rows.length } };
      });
      setPending(null);
      setActionError("");
      setMessage("The agency server recorded the action. This is not an electronic signature.");
      void cache.invalidateQueries({ queryKey, exact: true });
    },
    onError: error => {
      if (!active.current) return;
      setActionError(packetReviewError(error));
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      if ([400, 401, 403, 404, 409].includes(Number(status))) {
        setPending(null);
        void cache.invalidateQueries({ queryKey, exact: true });
      }
    },
  });
  function act(packet: AgencyPacket, draft: PacketReviewDraft) {
    if (!active.current || mutation.isPending || pending) return;
    const command = createPacketReviewCommand(packet, draft);
    setMessage("");
    setActionError("");
    setPending(command);
    mutation.mutate(command);
  }
  async function refresh() {
    if (!active.current || mutation.isPending) return;
    const result = await query.refetch();
    if (!active.current) return;
    const packet = result.data?.data.find(item => item.id === pending?.packetId);
    if (pending && packet && packetCommandSatisfied(pending, packet)) {
      setPending(null);
      setActionError("");
      setMessage("Current server state confirmed. No duplicate action was sent.");
    }
  }
  const envelope = !query.isError ? query.data : undefined;
  return <AgencyPacketReview packets={envelope?.data ?? []} role={envelope?.metadata.role ?? null}
    loading={query.isPending} refreshing={query.isFetching} canRefresh
    unavailable={query.isError ? packetReviewError(query.error) : ""}
    actionError={actionError} message={message} busy={mutation.isPending}
    pendingAction={pending?.action ?? null} onRefresh={() => void refresh()}
    onAction={act} onRetry={() => {
      if (active.current && pending && !mutation.isPending) mutation.mutate(pending);
    }} />;
}
