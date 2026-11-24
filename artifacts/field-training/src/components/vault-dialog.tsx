import { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { useWorkspace } from '@/state/workspace.js';
import { useToast } from '@/hooks/use-toast.js';
import { operatorErrorMessage, reportUnexpectedOperatorError } from '@/lib/operator-errors.js';

export function VaultDialog() {
  const { intent, closeVault, setupAndSave, unlockAndRestore } = useWorkspace();
  const { toast } = useToast();
  const [pass, setPass] = useState(''); const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [ack, setAck] = useState(false);
  useEffect(() => { setPass(''); setConfirm(''); setErr(''); setAck(false); }, [intent]);
  const setup = intent === 'save';
  const valid = setup ? pass.length >= 12 && pass === confirm && ack : pass.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!valid || busy) return;
    setBusy(true); setErr('');
    try {
      if (setup) { await setupAndSave(pass); toast({ title: 'Saved locally (encrypted)', description: 'Stored on this device only. Not sent to any server.' }); }
      else { await unlockAndRestore(pass); toast({ title: 'Saved work restored', description: 'Decrypted from this device.' }); }
      setPass(''); setConfirm(''); closeVault();
    } catch (x) {
      reportUnexpectedOperatorError(x,'Could not save or restore the local vault');
      setErr(operatorErrorMessage(x,setup
        ?'Saved work could not be saved. Your current workspace remains on screen.'
        :'Saved work could not be opened. Check the passphrase and try again.'));
      setPass(''); setConfirm('');
    }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={intent !== null} onOpenChange={(o) => { if (!o && !busy) { setPass(''); setConfirm(''); closeVault(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-accent" />{setup ? 'Create local vault' : 'Unlock saved work'}</DialogTitle>
          <DialogDescription>{setup ? 'Your local workspace is encrypted in this browser with a passphrase you choose. The passphrase is never stored.' : 'Enter the passphrase you chose when saving on this device.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <label className="label-caps" htmlFor="vault-pass">Passphrase</label>
            <Input id="vault-pass" data-testid="input-passphrase" type="password" autoComplete={setup ? 'new-password' : 'current-password'} value={pass} onChange={e => setPass(e.target.value)} autoFocus />
            {setup && <p className={'text-xs mono ' + (pass.length >= 12 ? 'text-ok' : 'text-muted-foreground')}>{pass.length}/12 minimum characters</p>}
          </div>
          {setup && <>
            <div className="space-y-1">
              <label className="label-caps" htmlFor="vault-confirm">Confirm passphrase</label>
              <Input id="vault-confirm" data-testid="input-passphrase-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              {confirm && confirm !== pass && <p className="text-xs text-destructive">Passphrases do not match</p>}
            </div>
            <label className="flex gap-2 items-start rounded border border-accent/50 bg-accent/10 p-3 text-sm cursor-pointer">
              <input type="checkbox" data-testid="checkbox-ack" className="mt-1 accent-[hsl(var(--accent))]" checked={ack} onChange={e => setAck(e.target.checked)} />
              <span><b>A forgotten passphrase cannot be recovered.</b> There is no reset. Encrypted drafts on this device would be unreadable.</span>
            </label>
          </>}
          {err && <div role="alert" className="flex gap-2 rounded border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"><ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />{err}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={closeVault} disabled={busy} data-testid="button-vault-cancel">Cancel</Button>
            <Button type="submit" disabled={!valid || busy} data-testid="button-vault-submit">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{setup ? 'Encrypt & save' : 'Unlock'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
