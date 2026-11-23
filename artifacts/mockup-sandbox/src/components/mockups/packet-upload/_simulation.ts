/** Fictional, in-memory preview only. This module has no transport or storage. */
export type PacketState = "pending" | "uploading" | "failed" | "synchronized";
export type Packet = { id: string; date: string; state: PacketState; version?: number };
export const examplePackets = (): Packet[] => [
  { id: "DEMO-1123", date: "Nov 23, 2026", state: "pending" },
  { id: "DEMO-1122", date: "Nov 22, 2026", state: "pending" },
  { id: "DEMO-1121", date: "Nov 21, 2026", state: "synchronized", version: 1 },
];
export const pendingPackets = (packets: Packet[]) =>
  packets.filter(packet => packet.state === "pending" || packet.state === "failed");
export function beginUpload(packets: Packet[]): Packet[] {
  return packets.map(packet => packet.state === "pending" || packet.state === "failed"
    ? { ...packet, state: "uploading" } : packet);
}
export function finishUpload(packets: Packet[], failed: boolean): Packet[] {
  return packets.map(packet => packet.state !== "uploading" ? packet : failed
    ? { ...packet, state: "failed" }
    : { ...packet, state: "synchronized", version: 1 });
}
export function uploadBlockReason(options: {
  online: boolean; unlocked: boolean; unsaved: boolean; ready: boolean; busy: boolean; count: number;
}): string | null {
  if (options.busy) return "An Operation Is in Progress.";
  if (!options.unlocked) return "Unlock Saved Work Before Uploading.";
  if (options.unsaved) return "Save Open Edits Locally Before Uploading.";
  if (!options.online) return "Offline. Save Locally; Reconnect and Choose Upload When Ready.";
  if (!options.ready) return "Agency Service or Verified FTO Assignment Unavailable. Local Drafts Remain on This Device.";
  if (options.count > 100) return "This Queue Exceeds the 100-Packet Batch Limit. Do Not Upload Until It Is Resolved.";
  if (!options.count) return "No Packets Are Waiting to Upload.";
  return null;
}
