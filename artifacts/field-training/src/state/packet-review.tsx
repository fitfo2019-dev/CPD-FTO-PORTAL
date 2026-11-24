import {createContext,useContext,useEffect,useRef,type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useUser} from '@clerk/react';
import {
  useGetPacketReviewContext,getGetPacketReviewContextQueryKey,
  actOnPacketSubmission,updatePacketCoordinator,
  type PacketReviewContext,type PacketReviewActionInput,type PacketSubmission,type PacketCoordinatorInput,
} from '@workspace/api-client-react';
import {useWorkspace} from './workspace.js';
import {OperatorFacingError,operatorErrorMessage,reportUnexpectedOperatorError} from '@/lib/operator-errors.js';

export function packetReviewError(error:unknown):string {
  if(error&&typeof error==='object'&&'data' in error) {
    const data=error.data as {error_code?:string;message?:string}|undefined;
    if(data?.error_code==='INVALID_SUBMISSION_ID'||data?.error_code==='INVALID_REVIEW_ACTION')
      return 'Check the packet-review details and try again. No records were changed.';
    if(data?.error_code==='AGENCY_STORAGE_UNAVAILABLE')
      return 'The packet-review operation could not be completed. Local drafts were not removed.';
  }
  return operatorErrorMessage(error,'The shared packet service is unavailable. Local drafts have been retained.');
}
interface PacketReviewValue {
  context?:PacketReviewContext;
  loading:boolean;error:string|null;previewOnly:boolean;
  refresh():Promise<void>;
  act(id:string,action:PacketReviewActionInput['action'],note?:string):Promise<PacketSubmission>;
  assign(input:PacketCoordinatorInput):Promise<void>;
  finalizeReport(id:string):Promise<void>;
  openCorrection(id:string):Promise<void>;
}
const Context=createContext<PacketReviewValue|null>(null);
export function PacketReviewProvider({children}:{children:ReactNode}) {
  const {previewOnly,finalizePacket,openPacketCorrection}=useWorkspace();
  const {user,isLoaded,isSignedIn}=useUser();
  const cache=useQueryClient();
  const operations=useRef(new Map<string,string>());
  const query=useGetPacketReviewContext({query:{queryKey:[...getGetPacketReviewContextQueryKey(),user?.id],
    enabled:!previewOnly&&isLoaded&&!!isSignedIn,refetchInterval:5000,refetchOnWindowFocus:true,retry:false,staleTime:0,
    select:data=>{
      if(data.account_id!==user?.id) throw new OperatorFacingError('The packet service returned another account. Sign out and sign back in.');
      return data;
    }}});
  useEffect(()=>{
    if(query.error)reportUnexpectedOperatorError(query.error,'Could not load packet-review information');
  },[query.error]);
  const refresh=async()=>{
    const result=await query.refetch();
    if(result.error) throw result.error;
    await cache.invalidateQueries({queryKey:['/api/v1/packet-review/submissions']});
  };
  const guard=()=>{
    if(previewOnly) throw new Error('Real packet operations are disabled in UI previews.');
    if(!query.data?.available) throw new Error('Agency packet storage is not configured or unavailable.');
  };
  return <Context.Provider value={{
    context:query.data,loading:query.isLoading&&!previewOnly,error:query.error?packetReviewError(query.error):null,previewOnly,refresh,
    act:async(id,action,note='')=>{
      guard();
      const key=JSON.stringify([id,action,note]);
      const operation=operations.current.get(key)??crypto.randomUUID();
      operations.current.set(key,operation);
      try {
        const result=await actOnPacketSubmission(id,{operation_id:operation,action,note});
        operations.current.delete(key);
        await refresh();
        return result;
      }catch(error){void query.refetch();throw error;}
    },
    assign:async input=>{guard();await updatePacketCoordinator(input);await refresh();},
    finalizeReport:async id=>{guard();await finalizePacket(id);await refresh();},
    openCorrection:async id=>{guard();await openPacketCorrection(id);},
  }}>{children}</Context.Provider>;
}
export function usePacketReview():PacketReviewValue {
  const value=useContext(Context);
  if(!value) throw new Error('PacketReviewProvider is required.');
  return value;
}
