import { customFetch, apiEndpoint } from "@workspace/api-client-react";
import { ListTrainingPacketsResponse } from "@workspace/api-zod";
import { z } from "zod/v4";

const packetRecordSchema = ListTrainingPacketsResponse.shape.data.element;
const fullReportSchema = z.union([
  packetRecordSchema.shape.report.options[0].loose(),
  z.null(),
]);
const schema = ListTrainingPacketsResponse.extend({
  metadata: ListTrainingPacketsResponse.shape.metadata.extend({
    has_more: z.boolean(), next_cursor: z.string().max(256).nullable(),
  }),
  data: packetRecordSchema.extend({ report: fullReportSchema }).array().max(100),
});
export type SharedPacket = ReturnType<typeof schema.parse>["data"][number];
export type PacketHistoryFilters = { recruit?: string; dateFrom?: string; dateTo?: string };
export type SharedPacketPage = { data: SharedPacket[]; hasMore: boolean; nextCursor: string | null };
export type SharedPacketHistory = {
  data: SharedPacket[]; filters: PacketHistoryFilters; nextCursor: string | undefined;
  hasMore: boolean; complete: boolean; blocked: boolean;
  seenCursors: Set<string>; seenPacketIds: Set<string>;
};
export class PacketHistoryCursorError extends Error {
  constructor(message: string) { super(message); this.name = "PacketHistoryCursorError"; }
}
export function createSharedPacketHistory(filters: PacketHistoryFilters = {}): SharedPacketHistory {
  return { data: [], filters: { ...filters }, nextCursor: undefined, hasMore: true,
    complete: false, blocked: false, seenCursors: new Set(), seenPacketIds: new Set() };
}
export async function readSharedPacketsPage(
  cursor?: string, signal?: AbortSignal, filters: PacketHistoryFilters = {},
): Promise<SharedPacketPage> {
  const params = new URLSearchParams();
  if (cursor !== undefined) params.set("cursor", cursor);
  if (filters.recruit) params.set("recruit", filters.recruit);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  const query = params.size ? `?${params}` : "";
  const response = await customFetch<unknown>(apiEndpoint(`/v1/training-packets${query}`), {
    credentials: "same-origin", cache: "no-store", responseType: "json",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
  });
  let page: ReturnType<typeof schema.parse>;
  try { page = schema.parse(response); }
  catch (error) {
    if (error instanceof z.ZodError && error.issues.some(issue => issue.path.at(-1) === "next_cursor"))
      throw new PacketHistoryCursorError("The agency packet history returned an invalid continuation cursor.");
    throw error;
  }
  if (page.metadata.has_more !== Boolean(page.metadata.next_cursor))
    throw new PacketHistoryCursorError("The agency packet history returned invalid continuation metadata.");
  if (page.metadata.has_more && !page.metadata.next_cursor?.trim())
    throw new PacketHistoryCursorError("The agency packet history returned an empty continuation cursor.");
  return { data: page.data, hasMore: page.metadata.has_more, nextCursor: page.metadata.next_cursor };
}
export async function continueSharedPacketHistory(
  history: SharedPacketHistory, signal?: AbortSignal,
  onPage?: (history: SharedPacketHistory) => void, maxPages = Number.POSITIVE_INFINITY,
): Promise<SharedPacketHistory> {
  if (history.blocked)
    throw new PacketHistoryCursorError("The agency packet history has an unsafe page. Refresh it to start over safely.");
  let pagesRead = 0;
  while (!history.complete && pagesRead < maxPages) {
    const cursor = history.nextCursor;
    if (cursor !== undefined && (!cursor.trim() || cursor.length > 256 || history.seenCursors.has(cursor))) {
      history.blocked = true;
      throw new PacketHistoryCursorError("The agency packet history returned a repeated or invalid cursor. Refresh it to start over safely.");
    }
    let page: SharedPacketPage;
    try { page = await readSharedPacketsPage(cursor, signal, history.filters); }
    catch (error) { if (error instanceof PacketHistoryCursorError) history.blocked = true; throw error; }
    const nextCursor = page.nextCursor ?? undefined;
    if (page.hasMore && (!nextCursor || nextCursor === cursor || history.seenCursors.has(nextCursor))) {
      history.blocked = true;
      throw new PacketHistoryCursorError("The agency packet history returned a repeated or invalid cursor. Previously loaded records were preserved.");
    }
    const pageIds = new Set<string>();
    if (page.data.some(packet => {
      if (history.seenPacketIds.has(packet.id) || pageIds.has(packet.id)) return true;
      pageIds.add(packet.id); return false;
    })) {
      history.blocked = true;
      throw new PacketHistoryCursorError("The agency packet history repeated a record. Previously loaded records were preserved.");
    }
    if (cursor !== undefined) history.seenCursors.add(cursor);
    for (const id of pageIds) history.seenPacketIds.add(id);
    history.data = [...history.data, ...page.data]; history.nextCursor = nextCursor;
    history.hasMore = page.hasMore; history.complete = !page.hasMore;
    onPage?.(history); pagesRead++;
  }
  return history;
}
export async function readSharedPackets(signal?: AbortSignal, filters: PacketHistoryFilters = {}): Promise<SharedPacket[]> {
  const history = createSharedPacketHistory(filters);
  await continueSharedPacketHistory(history, signal);
  return history.data;
}
