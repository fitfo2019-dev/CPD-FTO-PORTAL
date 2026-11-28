import {useContext} from 'react';
import {QueryClient,QueryClientContext} from '@tanstack/react-query';
import {useListPacketSubmissions,getListPacketSubmissionsQueryKey} from '@workspace/api-client-react';
import {usePacketReview} from '@/state/packet-review.js';

export interface ReturnedPacket {packetId:string;returnedAt:string|null;reason:string}

/** Returned packets visible to this account, keyed by packet id. The reason
 * stays on the server and is replaced when the FTO resubmits. */
// Used only when no query provider is mounted (offline tests and preview harnesses); it never fetches.
const INERT_CLIENT=new QueryClient({defaultOptions:{queries:{gcTime:Infinity}}});

export function useReturnedPackets():Map<string,ReturnedPacket> {
  const {context,previewOnly}=usePacketReview();
  const client=useContext(QueryClientContext);
  const live=!!client&&!!context?.available&&!previewOnly&&context.role==='FTO';
  const list=useListPacketSubmissions({offset:0},{query:{enabled:live,
    queryKey:[...getListPacketSubmissionsQueryKey({offset:0}),context?.account_id],refetchInterval:30000,retry:false}},client??INERT_CLIENT);
  const map=new Map<string,ReturnedPacket>();
  for(const item of list.data?.items??[]) if(item.state==='correction_requested')
    map.set(item.packet_id,{packetId:item.packet_id,returnedAt:item.reviewed_at,reason:item.review_note});
  return map;
}

export function ReturnedBadge({testId='badge-returned'}:{testId?:string}) {
  return <span data-testid={testId} className="inline-block border-2 border-destructive px-2 py-0.5 text-[0.68rem] font-bold tracking-[0.12em] text-destructive">RETURNED</span>;
}
