import { useUser } from "@clerk/react";
import { useWorkspace } from "@/state/workspace.js";
import { AgencyPacketAccess } from "@/components/agency-packet-access.js";
import "@/components/agency-packet-review.css";

export default function AgencyPacketsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { previewOnly, vault } = useWorkspace();
  return <AgencyPacketAccess userId={user?.id} authenticated={Boolean(isLoaded && isSignedIn)}
    previewOnly={previewOnly} unlocked={vault === "unlocked"} />;
}
