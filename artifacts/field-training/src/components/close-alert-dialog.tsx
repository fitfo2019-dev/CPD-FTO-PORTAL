import { useState } from 'react';
import { useUser } from '@clerk/react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.js';
import { ROLE_LABEL, type RecordActor, type Role } from '@/lib/model.js';
import type { AlertSource } from '@/state/training-alerts.js';

const BTN = 'inline-flex h-10 items-center gap-2 rounded-sm border bg-card px-4 text-xs font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex h-10 items-center gap-2 rounded-sm bg-primary px-4 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50';
export const NOTE_MAX = 500;

/** The closer's name comes from the signed-in account; the preview uses the role name. */
export function useAlertActor(role: Role): RecordActor {
  const { user, isSignedIn } = useUser();
  const name = isSignedIn ? (user?.fullName?.trim() || user?.primaryEmailAddress?.emailAddress || ROLE_LABEL[role]) : ROLE_LABEL[role];
  return { name, badge: '', role };
}

/** Open count plus where the alerts are stored: the agency server, or only this device. */
export function AlertPanelStatus({ source, open }: { source: AlertSource; open: number }) {
  return <span className="flex items-center gap-2">
    <span className={`portal-tag${source === 'server' ? ' is-ok' : ''}`} data-testid="tag-alert-source">{source === 'server' ? 'Agency server' : 'This device'}</span>
    {open > 0 && <span className="portal-tag is-alert">{open}</span>}
  </span>;
}

export function CloseAlertDialog({ alertLabel, open, onOpenChange, onClose }: {
  alertLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const trimmed = note.trim();
  return <Dialog open={open} onOpenChange={next => { if (!next) setNote(''); onOpenChange(next); }}>
    <DialogContent className="max-w-lg space-y-4">
      <DialogTitle className="shell-caps text-base font-bold">Close alert</DialogTitle>
      <p className="break-words text-sm font-semibold">{alertLabel}</p>
      <label className="block">
        <span className="label-caps">Note</span>
        <textarea rows={4} maxLength={NOTE_MAX} className="mt-1 w-full rounded-sm border bg-card p-3 text-sm" value={note}
          onChange={event => setNote(event.target.value)} data-testid="textarea-close-alert-note" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN} onClick={() => onOpenChange(false)}>Cancel</button>
        <button type="button" className={BTN_PRIMARY} disabled={!trimmed} title={trimmed ? undefined : 'A note is required'}
          onClick={() => { onClose(trimmed); setNote(''); }} data-testid="button-confirm-close-alert">Close alert</button>
      </div>
    </DialogContent>
  </Dialog>;
}
