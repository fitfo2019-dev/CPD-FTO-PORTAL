import { useEffect, useState } from 'react';
import { MessageSquare, Save, Trash2 } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits.js';
import { useToast } from '@/hooks/use-toast.js';
import { useWorkspace } from '@/state/workspace.js';
import type { LocalChatDraft } from '@/lib/offlineStorage.js';

export default function FtoForumPage() {
  const {
    ws, epoch, vault, online, loadLocalChatDrafts, saveLocalChatDraft,
    deleteLocalChatDraft, saveNow,
  } = useWorkspace();
  const { toast } = useToast();
  const [body, setBody] = useState('');
  const [drafts, setDrafts] = useState<LocalChatDraft[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canOpen = ws.role === 'fto' || ws.role === 'fto_coordinator';

  useEffect(() => {
    if (!canOpen || vault !== 'unlocked') {
      setDrafts([]);
      setBody('');
      setError('');
      return;
    }
    let active = true;
    loadLocalChatDrafts()
      .then(items => {
        if (active) setDrafts(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      })
      .catch(() => {
        if (active) setError('Could not open local drafts. Unlock the correct device vault and try again.');
      });
    return () => { active = false; };
  }, [canOpen, vault, epoch, loadLocalChatDrafts]);

  if (!canOpen) {
    return <Panel title="FTO Forum access"><p className="p-4 text-sm">This forum is available to FTOs and the FTO Coordinator.</p></Panel>;
  }

  async function saveDraft() {
    const text = body.trim();
    if (!text || busy) return;
    if (vault !== 'unlocked') {
      await saveNow();
      toast({ title: 'Unlock the local vault', description: 'Your text remains in this page. After unlocking, select Save unsent draft again.' });
      return;
    }
    const item: LocalChatDraft = {
      id: crypto.randomUUID(),
      sender: ws.role === 'fto_coordinator' ? 'FTO Coordinator · local draft' : 'FTO · local draft',
      body: text,
      createdAt: new Date().toISOString(),
    };
    setBusy(true);
    setError('');
    try {
      await saveLocalChatDraft(item);
      setDrafts(current => [item, ...current]);
      setBody('');
      toast({ title: 'Saved on this device', description: 'This message is encrypted, unsent, and not in the upload queue.' });
    } catch {
      setError('Could not save this draft to the encrypted local vault. The text remains in the editor.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(item: LocalChatDraft) {
    if (!window.confirm('Delete this unsent message from this device? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await deleteLocalChatDraft(item.id);
      setDrafts(current => current.filter(draft => draft.id !== item.id));
      toast({ title: 'Local draft deleted', description: 'It was removed from this device and was never uploaded.' });
    } catch {
      setError('Could not delete this local draft. Unlock the local vault and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="mx-auto max-w-4xl">
    <PageHead kicker="Staff communication" title="FTO Forum">
      <span className="inline-flex min-h-10 items-center gap-2 rounded border bg-card px-3 text-xs font-semibold"><MessageSquare className="h-4 w-4"/>FTOs and FTO Coordinator</span>
    </PageHead>
    <Panel title="Unsent message drafts · this device only" data-testid="panel-fto-forum">
      <div className="border-b bg-warn/5 px-4 py-3 text-sm">
        <b>{online ? 'Chat is not connected.' : 'You are offline.'}</b> These are unsent drafts; they are not delivered to other FTOs or the FTO Coordinator. You can delete them at any time.
      </div>
      <div className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{vault === 'unlocked' ? 'Local vault unlocked' : 'Unlock the local vault to save or view drafts'}</span>
          <span>{drafts.length} saved unsent {drafts.length === 1 ? 'draft' : 'drafts'}</span>
        </div>
        <label className="block text-sm font-semibold">Message draft
          <textarea value={body} onChange={event => setBody(event.target.value)} rows={3} placeholder="Write a message to save on this device. Do not include sensitive case details." className="mt-1 w-full rounded border bg-background p-3 text-sm font-normal" data-testid="input-fto-forum-message"/>
        </label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={saveDraft} disabled={!body.trim() || busy} className="inline-flex min-h-11 items-center gap-2 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50" data-testid="button-save-fto-forum-draft"><Save className="h-4 w-4"/>Save unsent draft</button>
        </div>
        {error && <p role="alert" className="mt-3 rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 space-y-3" aria-live="polite" data-testid="fto-forum-messages">
          {vault !== 'unlocked'
            ? <p className="rounded border bg-muted/20 p-4 text-sm text-muted-foreground">Saved drafts are hidden while the vault is locked.</p>
            : drafts.length === 0
              ? <p className="rounded border bg-muted/20 p-4 text-sm text-muted-foreground">No saved unsent drafts on this device.</p>
              : drafts.map(item => <article key={item.id} className="rounded border bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <b>{item.sender}</b><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">{item.body}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">UNSENT · LOCAL ONLY</span>
                  <button type="button" onClick={() => void deleteDraft(item)} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded border border-destructive/40 px-3 text-sm font-semibold text-destructive disabled:opacity-50" data-testid={`button-delete-fto-forum-draft-${item.id}`}><Trash2 className="h-4 w-4"/>Delete draft</button>
                </div>
              </article>)}
        </div>
      </div>
    </Panel>
  </div>;
}
