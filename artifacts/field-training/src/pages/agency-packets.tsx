import { useState } from "react";
import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/state/workspace.js";
import { AgencyPacketReview } from "@/components/agency-packet-review.js";
import { createPacketReviewCommand, loadAgencyPackets, performPacketReview, packetReviewError,
  packetCommandSatisfied, type AgencyPacketsEnvelope, type AgencyPacket,
  type PacketReviewCommand, type PacketReviewDraft } from "@/lib/agency-packets.js";

export default function AgencyPacketsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { previewOnly } = useWorkspace();
  // Auth changes unmount the whole controller and discard all report data.
  return <PacketController key={user?.id ?? "signed-out"} userId={user?.id}
    enabled={isLoaded && isSignedIn && !previewOnly} previewOnly={previewOnly} />;
}

function PacketController({ userId, enabled, previewOnly }: {
  userId?: string; enabled: boolean; previewOnly: boolean;
}) {
  const cache = useQueryClient();
  const queryKey = ["agency-packets", userId] as const;
  const [pending, setPending] = useState<PacketReviewCommand | null>(null);
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const query = useQuery({
    queryKey, queryFn: ({ signal }) => loadAgencyPackets(signal), enabled,
    staleTime: 0, gcTime: 0, retry: false, refetchInterval: pending ? false : 30000,
    refetchOnWindowFocus: !pending,
  });
  const mutation = useMutation({
    mutationFn: performPacketReview, retry: false,
    onSuccess: async result => {
      // Cancel an older read before patching the successful server response.
      await cache.cancelQueries({ queryKey });
      cache.setQueryData<AgencyPacketsEnvelope>(queryKey, current => {
        const updated = new Map(result.data.map(packet => [packet.id, packet]));
        const rows = current?.data.map(packet => updated.get(packet.id) ?? packet) ?? result.data;
        return { ...result, data: rows, metadata: { ...result.metadata, total_records: rows.length } };
      });
      setPending(null);
      setActionError("");
      setMessage("The agency server recorded the action. This is not an electronic signature.");
      void cache.invalidateQueries({ queryKey });
    },
    onError: error => {
      setActionError(packetReviewError(error));
      const status = typeof error === "object" && error !== null && "status" in error ? error.status : undefined;
      // Definite rejections can be reviewed afresh; uncertain outcomes must
      // retain their exact body and operation UUID for retry.
      if ([400, 401, 403, 404, 409].includes(Number(status))) {
        setPending(null);
        void cache.invalidateQueries({ queryKey });
      }
    },
  });
  function act(packet: AgencyPacket, draft: PacketReviewDraft) {
    if (!enabled || mutation.isPending || pending) return;
    const command = createPacketReviewCommand(packet, draft);
    setMessage("");
    setActionError("");
    setPending(command);
    mutation.mutate(command);
  }
  async function refresh() {
    if (mutation.isPending) return;
    const result = await query.refetch();
    const packet = result.data?.data.find(item => item.id === pending?.packetId);
    if (pending && packet && packetCommandSatisfied(pending, packet)) {
      setPending(null);
      setActionError("");
      setMessage("Current server state confirmed. No duplicate action was sent.");
    }
  }
  const envelope = enabled && !query.isError ? query.data : undefined;
  return <AgencyPacketReview
    packets={envelope?.data ?? []} role={envelope?.metadata.role ?? null}
    loading={enabled && query.isPending} refreshing={query.isFetching}
    unavailable={previewOnly ? "Agency records are not loaded in the fictional workspace preview. Use the separate approval preview to try the controls." :
      !enabled ? "Sign in with your verified agency account to access packets." :
      query.isError ? packetReviewError(query.error) : ""}
    actionError={actionError} message={message} busy={mutation.isPending}
    pendingAction={pending?.action ?? null} onRefresh={() => void refresh()}
    onAction={act} onRetry={() => { if (pending && !mutation.isPending) mutation.mutate(pending); }}
  />;
}
