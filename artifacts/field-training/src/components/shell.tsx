import { useState, type ReactNode } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Link, useLocation } from 'wouter';
import { LayoutGrid, FileText, ListChecks, Settings, Sun, Moon, Lock, Unlock, Save, Wifi, WifiOff, Plus, ShieldAlert } from 'lucide-react';
import { useTheme, useWorkspace } from '@/state/workspace';
import { ROLES, ROLE_LABEL, type Role } from '@/lib/model';
import { VaultDialog } from './vault-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutGrid },
  { href: '/reports', label: 'Daily reports', icon: FileText },
  { href: '/training', label: 'Training tasks', icon: ListChecks },
  { href: '/settings', label: 'Security & readiness', icon: Settings },
];

function Mark() {
  return <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden><rect width="32" height="32" rx="6" fill="hsl(var(--sidebar-primary))"/><path d="M9 8h14v4H13v3h8v4h-8v5H9z" fill="hsl(var(--sidebar-primary-foreground))"/></svg>;
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { night, toggle } = useTheme();
  const w = useWorkspace();
  const { toast } = useToast();
  const [confirmLock, setConfirmLock] = useState(false);
  const unsaved = w.dirty || w.editorDirty;
  const requestLock = () => unsaved ? setConfirmLock(true) : w.lockNow();
  const isActive = (h: string) => h === '/' ? loc === '/' : loc.startsWith(h);

  async function onSave() {
    try { await w.saveNow(); if (w.vault === 'unlocked') toast({ title: 'Saved locally (encrypted)' }); }
    catch { toast({ title: 'Save failed', description: 'Local storage error. Your on-screen work is unchanged.', variant: 'destructive' }); }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <div className="hazard h-1.5" aria-hidden />
      <div role="note" data-testid="banner-demo" className="sticky top-0 z-40 bg-foreground text-background text-xs sm:text-sm px-3 py-1.5 flex items-center justify-center gap-2 font-semibold tracking-wide">
        <span className="inline-block h-2 w-2 rounded-full bg-accent" />FICTIONAL DEMO — NOT FOR OPERATIONAL DATA. Sample records only. No real identities.
      </div>
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
            <Mark /><div><div className="font-extrabold tracking-tight text-lg leading-none">FieldReady</div><div className="text-[0.65rem] uppercase tracking-[0.18em] opacity-60 mt-1">Field training · demo</div></div>
          </div>
          <nav className="p-2 space-y-0.5 flex-1">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} data-testid={'link-nav-' + n.label.split(' ')[0].toLowerCase()} className={cn('flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium transition-colors', isActive(n.href) ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'hover:bg-sidebar-accent')}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t border-sidebar-border space-y-2">
            <div className="text-[0.65rem] uppercase tracking-[0.16em] opacity-60">Demo role view</div>
            <div className="grid grid-cols-2 gap-1">
              {ROLES.map(r => (
                <button key={r} data-testid={'button-role-' + r} onClick={() => w.setRole(r)} className={cn('rounded py-1.5 text-xs font-semibold transition-colors', w.ws.role === r ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-sidebar-accent hover:opacity-80')}>{ROLE_LABEL[r]}</button>
              ))}
            </div>
            <p className="text-[0.68rem] leading-snug opacity-60">Role switch only changes the UI. It is not access control.</p>
          </div>
        </aside>
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="border-b bg-card/80 backdrop-blur px-3 sm:px-6 py-2.5 flex flex-wrap items-center gap-2">
            <div className="md:hidden flex items-center gap-2 mr-auto"><Mark /><span className="font-extrabold">FieldReady</span></div>
            <div data-testid="status-connection" className={cn('flex items-center gap-2 text-xs font-semibold rounded-full px-3 py-1 border', w.online ? 'border-border' : 'border-accent bg-accent/15')}>
              {w.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {w.online ? 'Online — local demo (server not connected)' : w.vault === 'unlocked' ? (unsaved ? <>Offline — unsaved changes · <span className="mono">{w.pending}</span> pending locally</> : <>Offline — saved locally · <span className="mono">{w.pending}</span> pending</>) : (unsaved ? 'Offline — NOT saved (vault locked)' : 'Offline — sample data, nothing saved')}
            </div>
            <div className="text-xs text-muted-foreground hidden lg:block mono" data-testid="status-vault">
              {w.vault === 'unlocked' ? (unsaved ? 'Vault open · unsaved changes' : 'Vault open · saved on this device') : (unsaved ? 'Unsaved changes · not stored on this device' : 'Not saved · sample data in memory')}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <select aria-label="Demo role" data-testid="select-role-mobile" className="md:hidden h-9 rounded border bg-card px-2 text-sm" value={w.ws.role} onChange={e => w.setRole(e.target.value as Role)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]} view</option>)}
              </select>
              {w.vault === 'unlocked' ? (
                <button data-testid="button-lock" onClick={requestLock} className="h-9 px-3 rounded border text-sm font-semibold flex items-center gap-1.5 hover:bg-muted transition-colors"><Lock className="h-4 w-4" /><span className="hidden sm:inline">Lock</span></button>
              ) : (
                <button data-testid="button-unlock" onClick={() => w.openVault('restore')} className="h-9 px-3 rounded border text-sm font-semibold flex items-center gap-1.5 hover:bg-muted transition-colors"><Unlock className="h-4 w-4" /><span className="hidden sm:inline">Unlock saved work</span></button>
              )}
              <button data-testid="button-save" onClick={onSave} className="h-9 px-3 rounded bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1.5 active:scale-[.97] transition-transform"><Save className="h-4 w-4" /><span className="hidden sm:inline">Save locally</span></button>
              <button data-testid="button-theme" onClick={toggle} aria-label={night ? 'Switch to daylight' : 'Switch to night shift'} className="h-9 px-3 rounded border text-sm font-semibold flex items-center gap-1.5 hover:bg-muted transition-colors">{night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span className="hidden sm:inline">{night ? 'Daylight' : 'Night shift'}</span></button>
            </div>
          </header>
          {w.saveError && (
            <div role="alert" data-testid="notice-save-error" className="mx-3 sm:mx-6 mt-3 rounded border border-destructive bg-destructive/10 p-3 text-sm flex flex-wrap items-center gap-3 text-destructive"><ShieldAlert className="h-4 w-4" /><span className="flex-1"><b>Local save failed.</b> Changes on screen are NOT stored. {w.saveError}</span><button className="font-semibold underline" onClick={onSave} data-testid="button-retry-save">Retry save</button></div>
          )}
          {w.lockedNotice && (
            <div className="mx-3 sm:mx-6 mt-3 rounded border border-accent bg-accent/10 p-3 text-sm flex flex-wrap items-center gap-3" data-testid="notice-locked">
              <Lock className="h-4 w-4" /><span className="flex-1">Locked after 15 minutes of inactivity. Decrypted data was cleared from this screen; sample data is shown.</span>
              <button className="font-semibold underline" onClick={() => w.openVault('restore')} data-testid="button-notice-unlock">Unlock saved work</button>
              <button className="text-muted-foreground" onClick={w.dismissLockedNotice} data-testid="button-notice-dismiss">Dismiss</button>
            </div>
          )}
          <main className="flex-1 px-3 sm:px-6 py-5 pb-24 md:pb-8 max-w-[1400px] w-full">{children}</main>
        </div>
      </div>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-t border-sidebar-border grid grid-cols-5">
        {NAV.slice(0,2).map(n => <MobileLink key={n.href} {...n} active={isActive(n.href) && loc !== '/reports/new'} />)}
        <Link href="/reports/new" data-testid="link-mobile-new" className="flex flex-col items-center justify-center py-2 text-[0.65rem] font-semibold"><span className="h-9 w-9 rounded-full bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center -mt-4 border-4 border-sidebar"><Plus className="h-5 w-5" /></span>New DOR</Link>
        {NAV.slice(2).map(n => <MobileLink key={n.href} {...n} active={isActive(n.href)} />)}
      </nav>
      <VaultDialog />
      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lock with unsaved changes?</AlertDialogTitle><AlertDialogDescription>{w.editorDirty ? 'An open report has edits that were not saved to the workspace. ' : ''}{w.dirty ? 'Workspace changes have not finished saving to the vault. ' : ''}Locking clears them from this screen and they cannot be recovered.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-lock-cancel">Keep working</AlertDialogCancel><AlertDialogAction data-testid="button-lock-discard" onClick={() => w.lockNow()}>Discard and lock</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function MobileLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutGrid; active: boolean }) {
  return <Link href={href} className={cn('flex flex-col items-center justify-center gap-1 py-2 text-[0.65rem] font-semibold', active ? 'text-sidebar-primary' : 'opacity-75')}><Icon className="h-5 w-5" />{label.split(' ')[0]}</Link>;
}
