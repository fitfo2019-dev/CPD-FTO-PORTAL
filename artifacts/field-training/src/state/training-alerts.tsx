import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  closeTrainingAlert, createNrtReviewRequest, getListTrainingAlertsQueryKey, saveWeek15Recommendation, useListTrainingAlerts,
  type NrtReviewRequestInput, type TrainingAlert, type Week15RecommendationInput,
} from '@workspace/api-client-react';
import { useWorkspace } from './workspace.js';
import { usePacketReview } from './packet-review.js';
import { deviceAlerts, fromServerAlert, sortAlerts, type AlertView } from '@/lib/training-alerts.js';
import type { RecordActor } from '@/lib/model.js';

export type AlertSource = 'server' | 'device';
const READERS = ['FTO_COORDINATOR', 'FTO_SGT'];

/** Server alerts when the verified agency account and storage are available; otherwise this device's records. */
export function useTrainingAlerts(options: { includeWithdrawals: boolean }) {
  const { ws, previewOnly, closeAlert } = useWorkspace();
  const { context } = usePacketReview();
  const cache = useQueryClient();
  const serverReader = !previewOnly && !!context?.available && READERS.includes(context.role);
  const query = { enabled: serverReader, refetchInterval: 30_000, refetchOnWindowFocus: true, retry: false, staleTime: 0 };
  const open = useListTrainingAlerts({ state: 'open' }, { query: { ...query, queryKey: [...getListTrainingAlertsQueryKey({ state: 'open' }), context?.account_id] } });
  const closed = useListTrainingAlerts({ state: 'closed' }, { query: { ...query, queryKey: [...getListTrainingAlertsQueryKey({ state: 'closed' }), context?.account_id] } });
  const source: AlertSource = serverReader && open.data && closed.data ? 'server' : 'device';
  const alerts = useMemo<AlertView[]>(() => source === 'server'
    ? sortAlerts([...(open.data?.items ?? []), ...(closed.data?.items ?? [])].map((item: TrainingAlert) => fromServerAlert(item)))
    : deviceAlerts(ws, options), [source, open.data, closed.data, ws, options.includeWithdrawals]);
  return {
    source,
    alerts,
    loading: serverReader && (open.isLoading || closed.isLoading),
    async close(alert: AlertView, note: string, actor: RecordActor) {
      if (alert.serverId) {
        await closeTrainingAlert(alert.serverId, { note });
        await cache.invalidateQueries({ queryKey: ['/api/v1/alerts'] });
        return;
      }
      closeAlert({ alertKey: alert.key, note, closedBy: actor, closedAt: new Date().toISOString() });
    },
  };
}

/** Lets the FTO send alerts to the server when the verified agency account and storage are available. */
export function useAlertSender() {
  const { previewOnly } = useWorkspace();
  const { context } = usePacketReview();
  const ready = !previewOnly && !!context?.available && context.role === 'FTO';
  return {
    ready,
    requestNrtReview: (input: NrtReviewRequestInput) => createNrtReviewRequest(input),
    saveWeek15: (input: Week15RecommendationInput) => saveWeek15Recommendation(input),
  };
}
