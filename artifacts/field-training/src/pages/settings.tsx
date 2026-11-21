import { useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/state/workspace';
import { PageHead, Panel } from '@/components/bits';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function Settings() {
  const w = useWorkspace();
  const [reset, setReset] = useState(false);
  return (
    <div className="max-w-4xl space-y-4">
      <PageHead kicker="Workspace" title="Device settings" />
      <Panel title="Local vault">
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><div className="label-caps">Status</div><div className="font-bold mt-1" data-testid="text-vault-status">{w.vault === 'unlocked' ? 'Unlocked' : 'Locked / not opened'}</div></div>
          <div><div className="label-caps">Unsent local records</div><div className="mono font-bold mt-1">{w.vault==='unlocked' ? w.pending : '—'}</div></div>
          <div><div className="label-caps">Browser storage</div><div className="font-bold mt-1" data-testid="text-storage-persistence">{w.storagePersistent===true?'Persistent storage granted':w.storagePersistent===false?'May be evicted':'Status unavailable'}</div></div>
          <div><div className="label-caps">Server</div><div className="font-bold mt-1">Not connected</div></div>
        </div>
        <p className="px-4 pb-3 text-xs text-muted-foreground">The local queue is encrypted on this device and is not uploaded. Persistent storage can reduce automatic browser eviction, but it cannot protect against clearing site data, device loss, or storage failure.</p>
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {w.vault === 'unlocked' ? <button data-testid="button-settings-lock" onClick={()=>{ if ((w.dirty || w.editorDirty) && !confirm('Unsaved changes will be cleared from this screen and cannot be recovered. Lock anyway?')) return; w.lockNow(); }} className="h-10 px-3 rounded border text-sm font-semibold inline-flex items-center gap-1.5"><Lock className="h-4 w-4" />Lock now</button>
            : <button data-testid="button-settings-unlock" onClick={()=>{if((w.dirty||w.editorDirty)&&!confirm('Unsaved workspace changes will be replaced when saved work is restored. Continue?'))return;w.openVault('restore');}} className="h-10 px-3 rounded border text-sm font-semibold">Unlock saved work</button>}
          <button data-testid="button-reset-workspace" onClick={()=>setReset(true)} className="h-10 px-3 rounded border text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" />Reset local workspace</button>
        </div>
      </Panel>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset the local workspace?</AlertDialogTitle><AlertDialogDescription>This replaces the current in-memory records with an empty workspace. {w.vault==='unlocked' ? 'The empty workspace will replace the saved local workspace on its next autosave.' : 'The encrypted vault will not be changed until you save a workspace.'}{(w.dirty || w.editorDirty) && ' Unsaved changes will be lost.'} This cannot be undone from this screen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-reset" onClick={w.resetWorkspace}>Reset workspace</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
