import React, { type CSSProperties } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getOperationalProfileHistory, type OperationalProfileHistory } from "@workspace/api-client-react";
import { EmptyState } from "@workspace/fto-law-library-schema/components/library";
import { tokens } from "@workspace/fto-law-library-schema/tokens";

const color = tokens.color.light;
const theme = {
  "--history-primary": color.primary,
  "--history-card": color.card,
  "--history-foreground": color.foreground,
  "--history-muted": color.mutedForeground,
  "--history-border": color.border,
  "--history-secondary": color.secondary,
  "--history-error": color.destructive,
  "--history-radius": tokens.radius,
  "--history-space": tokens.spacing,
  "--history-mono": tokens.fontFamily.mono.join(", "),
  fontFamily: tokens.fontFamily.sans.join(", "),
} as CSSProperties;

export function OperationalProfileHistoryPanel({ subject, version, unavailable = false }: {
  subject: string; version: number; unavailable?: boolean;
}) {
  const query = useInfiniteQuery({
    queryKey: ["operational-profile-history", subject, version],
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam, signal }): Promise<OperationalProfileHistory> => {
      const history = await getOperationalProfileHistory(
        pageParam === undefined ? undefined : { beforeVersion: pageParam },
        { credentials: "include", signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) },
      );
      if (history.subject !== subject) throw new Error("History account mismatch");
      return history;
    },
    getNextPageParam: page => page.nextBeforeVersion ?? undefined,
    enabled: !unavailable, retry: false, staleTime: 0,
    refetchOnWindowFocus: true, refetchOnReconnect: true, refetchInterval: 30_000,
  });
  const failed = unavailable || query.isError;
  const entries = query.data?.pages.flatMap(page => page.entries) ?? [];
  return <section className="fls-scope assignment-history" style={theme}
    aria-labelledby="assignment-history-title" data-testid="operational-profile-history">
    <div className="history-section-heading">
      <div><p className="history-eyebrow">Own account</p><h2 id="assignment-history-title">Assignment history</h2></div>
      <button type="button" disabled={unavailable || query.isFetching} onClick={() => void query.refetch()}>
        {query.isFetching && !query.isPending ? "Refreshing…" : "Refresh history"}
      </button>
    </div>
    {failed ? <div role="alert" className="history-error">
      <p>Assignment history could not be loaded. Check your connection and try again.</p>
      <button type="button" disabled={unavailable || query.isFetching} onClick={() => void query.refetch()}>Retry history</button>
    </div> : query.isPending ? <p role="status">Loading assignment history…</p> : entries.length === 0
      ? <EmptyState title="No assignment history yet" description="No operational assignment has been saved for your account." />
      : <>
        <ol className="history-entry-list">
          {entries.map(entry => <li key={entry.version}>
            <div className="history-entry-heading">
              <h3>{entry.event === "baseline" ? "History tracking started" : entry.event === "created" ? "Assignment saved" : "Assignment changed"}</h3>
              <span>Version {entry.version}</span>
            </div>
            <p className="history-transition"><span>{entry.oldToken ?? (entry.event === "baseline" ? "Not recorded" : "Not assigned")}</span>
              <span aria-label="changed to">→</span><strong>{entry.newToken ?? "Not assigned"}</strong></p>
            <dl className="history-entry-details">
              <div><dt>Recorded</dt><dd><time dateTime={entry.recordedAt}>{new Intl.DateTimeFormat("en-US", {
                dateStyle: "medium", timeStyle: "long", timeZone: "America/New_York",
              }).format(new Date(entry.recordedAt))}</time></dd></div>
              <div><dt>Actor</dt><dd>{entry.actor === "self" ? "Your verified account" : "Agency migration"}</dd></div>
            </dl>
            {entry.event === "baseline" && <p className="history-boundary">Earlier assignments are not recorded. This entry marks the start of history tracking, not the original assignment date.</p>}
          </li>)}
        </ol>
        {query.hasNextPage ? <button type="button" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>
          {query.isFetchingNextPage ? "Loading…" : "Load older history"}
        </button> : <p className="history-boundary">Start of recorded history</p>}
      </>}
  </section>;
}
