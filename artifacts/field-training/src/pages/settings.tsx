import { useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/state/workspace.js';
import { PageHead, Panel } from '@/components/bits.js';
import { OperationalProfilePanel } from '@/components/operational-profile-panel.js';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';

export default function Settings() {
  const w = useWorkspace();
  const [reset, setReset] = useState(false);
  return (
    <div className="max-w-4xl space-y-4">
      <PageHead kicker="Workspace" title="Device settings" />
      {!w.previewOnly && <OperationalProfilePanel/>}
      <Panel title={w.previewOnly ? 'Temporary UI test workspace' : 'Local vault'}>
        <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><div className="label-caps">Status</div><div className="font-bold mt-1" data-testid="text-vault-status">{w.previewOnly ? 'Memory-only preview' : w.vault === 'unlocked' ? 'Unlocked' : 'Locked / not opened'}</div></div>
          <div><div className="label-caps">Unsent local records</div><div className="mono font-bold mt-1">{w.vault==='unlocked' ? w.pending : '—'}</div></div>
          <div><div className="label-caps">Browser storage</div><div className="font-bold mt-1" data-testid="text-storage-persistence">{w.previewOnly?'Not used in preview':w.storagePersistent===true?'Persistent storage granted':w.storagePersistent===false?'May be evicted':'Status unavailable'}</div></div>
          <div><div className="label-caps">Server</div><div className="font-bold mt-1">Not connected</div></div>
        </div>
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {!w.previewOnly && (w.vault === 'unlocked' ? <button data-testid="button-settings-lock" onClick={()=>{ if ((w.dirty || w.editorDirty) && !confirm('Unsaved changes will be cleared from this screen and cannot be recovered. Lock anyway?')) return; w.lockNow(); }} className="h-10 px-3 rounded border text-sm font-semibold inline-flex items-center gap-1.5"><Lock className="h-4 w-4" />Lock now</button>
            : <button data-testid="button-settings-unlock" onClick={()=>{if((w.dirty||w.editorDirty)&&!confirm('Unsaved workspace changes will be replaced when saved work is restored. Continue?'))return;w.openVault('restore');}} className="h-10 px-3 rounded border text-sm font-semibold">Unlock saved work</button>)}
          <button data-testid="button-reset-workspace" onClick={()=>setReset(true)} className="h-10 px-3 rounded border text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" />{w.previewOnly?'Reset test workspace':'Reset local workspace'}</button>
        </div>
      </Panel>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{w.previewOnly?'Reset the UI test preview?':'Reset the local workspace?'}</AlertDialogTitle><AlertDialogDescription>{w.previewOnly?'This restores the fictional phase assignment and clears temporary test entries. No browser data is changed.':'This replaces the current in-memory records with an empty workspace. '}{!w.previewOnly&&w.vault==='unlocked' ? 'The empty workspace will replace the saved local workspace on its next autosave.' : !w.previewOnly?'The encrypted vault will not be changed until you save a workspace.':''}{(w.dirty || w.editorDirty) && ' Unsaved changes will be lost.'} This cannot be undone from this screen.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-reset" onClick={w.resetWorkspace}>{w.previewOnly?'Reset test data':'Reset workspace'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
