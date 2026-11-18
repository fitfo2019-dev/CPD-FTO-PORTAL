import { useState } from 'react';
import { Check, Circle, Lock, RotateCcw } from 'lucide-react';
import { useWorkspace } from '@/state/workspace';
import { PageHead, Panel } from '@/components/bits';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const NOW = [
  'Workspace encrypted in IndexedDB with a passphrase-derived key when you choose "Save locally"',
  'Passphrase and key are never written to storage; forgotten passphrases cannot be recovered',
  'Automatic lock after 15 minutes of inactivity clears decrypted data from the screen',
  'Only the daylight/night theme preference is kept in plain localStorage',
  'Service worker (production builds only) caches the app shell — no API responses, no external assets',
  'Role switch is a UI demonstration; there is no access control. Admin view is read-only',
];
const FUTURE = [
  ['Identity provider', 'Agency SSO (SAML / OIDC) with MFA — not connected'],
  ['Server-side authorization', 'Enforced role-based access per record — not implemented'],
  ['Verified e-signatures', 'Signatures bound to authenticated identity with audit trail — not implemented'],
  ['Sync service', 'Server sync with conflict resolution for queued offline edits — server not connected'],
  ['CJIS Security Policy review', 'Agency assessment of hosting, encryption, logging and personnel controls'],
  ['Hosting & data residency', 'Compliant hosting, backups, retention and records schedule'],
  ['Audit logging', 'Immutable server-side logs of reads, edits and signatures'],
  ['Device management', 'MDC/MDM enrollment, remote wipe, screen-lock policy'],
  ['Accessibility & legal review', 'WCAG audit, union/HR review of evaluation language'],
];

export default function Settings() {
  const w = useWorkspace();
  const [reset, setReset] = useState(false);
  return (
    <div className="max-w-4xl space-y-4">
      <PageHead kicker="Security & readiness" title="What this demo does — and does not do" />
      <Panel title="Local vault">
        <div className="p-4 grid sm:grid-cols-3 gap-4 text-sm">
          <div><div className="label-caps">Status</div><div className="font-bold mt-1" data-testid="text-vault-status">{w.vault === 'unlocked' ? 'Unlocked' : 'Locked / not opened'}</div></div>
          <div><div className="label-caps">Queued locally</div><div className="mono font-bold mt-1">{w.vault==='unlocked' ? w.pending : '—'}</div></div>
          <div><div className="label-caps">Server</div><div className="font-bold mt-1">Not connected</div></div>
        </div>
        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {w.vault === 'unlocked' ? <button data-testid="button-settings-lock" onClick={()=>{ if ((w.dirty || w.editorDirty) && !confirm('Unsaved changes will be cleared from this screen and cannot be recovered. Lock anyway?')) return; w.lockNow(); }} className="h-10 px-3 rounded border text-sm font-semibold inline-flex items-center gap-1.5"><Lock className="h-4 w-4" />Lock now</button>
            : <button data-testid="button-settings-unlock" onClick={()=>w.openVault('restore')} className="h-10 px-3 rounded border text-sm font-semibold">Unlock saved work</button>}
          <button data-testid="button-reset-sample" onClick={()=>setReset(true)} className="h-10 px-3 rounded border text-sm font-semibold inline-flex items-center gap-1.5"><RotateCcw className="h-4 w-4" />Reset to sample data</button>
        </div>
      </Panel>
      <Panel title="Assignment management (future)">
        <div className="p-4 text-sm space-y-1" data-testid="placeholder-assignments"><p><b>Not built.</b> A future admin module will assign recruits to FTOs and sergeants, rotate FTOs between phases and manage precinct rosters. It requires the identity provider and server-side authorization listed below.</p><p className="text-muted-foreground">In this demo the Admin role can only view reports read-only.</p></div>
      </Panel>
      <Panel title="In place in this foundation">
        <ul className="divide-y text-sm">{NOW.map(n => <li key={n} className="px-4 py-2.5 flex gap-2.5"><Check className="h-4 w-4 text-ok shrink-0 mt-0.5" />{n}</li>)}</ul>
      </Panel>
      <Panel title="Required before any operational use">
        <ul className="divide-y text-sm">{FUTURE.map(([t,d]) => <li key={t} className="px-4 py-2.5 flex gap-2.5"><Circle className="h-4 w-4 text-warn shrink-0 mt-0.5" /><div><b>{t}</b><div className="text-muted-foreground">{d}</div></div></li>)}</ul>
      </Panel>
      <p className="text-xs text-muted-foreground">All names, badges and records are fictional. This build makes no authentication, compliance or certification claims.</p>
      <AlertDialog open={reset} onOpenChange={setReset}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset to sample data?</AlertDialogTitle><AlertDialogDescription>Replaces on-screen records with the original fictional seed. {w.vault==='unlocked' ? 'Your open vault will be overwritten with sample data by the next autosave.' : 'Saved vault data is not touched.'}{(w.dirty || w.editorDirty) && ' You have unsaved changes that will be lost.'}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction data-testid="button-confirm-reset" onClick={w.resetToSample}>Reset</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
