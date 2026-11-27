import { useEffect, useState } from 'react';
import { useUser } from '@clerk/react';
import { customFetch, apiEndpoint } from '@workspace/api-client-react';
import { z } from 'zod/v4';

const statusSchema = z.object({ data: z.object({ enabled: z.boolean() }) });

export async function readPatrolViewEnabled(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await customFetch<unknown>(apiEndpoint('/v1/patrol-view/status'), { signal });
    return statusSchema.safeParse(response).data?.data.enabled === true;
  } catch {
    return false;
  }
}

/** The Patrol View tab appears only when the server has the private link setting. */
export function usePatrolViewEnabled(): boolean {
  const { isSignedIn, user } = useUser();
  const [enabled, setEnabled] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    if (import.meta.env.DEV) { setEnabled(true); return; }
    if (!isSignedIn) { setEnabled(false); return; }
    const controller = new AbortController();
    void readPatrolViewEnabled(controller.signal).then(value => { if (!controller.signal.aborted) setEnabled(value); });
    return () => controller.abort();
  }, [isSignedIn, userId]);
  return enabled;
}
