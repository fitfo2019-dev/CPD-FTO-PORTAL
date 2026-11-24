import { useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.js';
import { Link, useLocation } from 'wouter';
import { LayoutGrid, FileText, Settings, Sun, Moon, Lock, Unlock, Save, Wifi, WifiOff, ShieldAlert, AlertTriangle, Users, FolderOpen, ClipboardList, BookOpen, Clock3, FileClock, RotateCcw, ShieldCheck } from 'lucide-react';
import { useTheme, useWorkspace } from '@/state/workspace.js';
import columbusLogoSvg from '@/assets/columbus-logo.svg?raw';
import { isTechnicalRole, ROLES, ROLE_LABEL, type Role } from '@/lib/model.js';
import { VaultDialog } from './vault-dialog.js';
import { cn } from '@/lib/utils.js';
import { useToast } from '@/hooks/use-toast.js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.js';

type NavItem = { href: string; label: string; icon: typeof LayoutGrid };

const HOME: NavItem = { href: '/', label: 'Home', icon: LayoutGrid };
const RESOURCES: NavItem = { href: '/resources', label: 'Resources', icon: BookOpen };
const ROLE_NAV: Record<Role, NavItem[]> = {
  fto: [
    HOME,
    { href: '/class-overview', label: 'My POs', icon: Users },
    { href: '/reports/new', label: 'Shifts & Runs', icon: ClipboardList },
    { href: '/reports', label: 'Daily Records', icon: FileText },
    { href: '/reports/weekly-summary', label: 'Weekly Packets', icon: ClipboardList },
    { href: '/agency-packets', label: 'Agency packets', icon: FileText },
    { href: '/packet-submissions', label: 'Packet Submissions', icon: ClipboardList },
    RESOURCES,
  ],
  fto_coordinator: [
    HOME,
    { href: '/packet-submissions', label: 'Packet Submission Inbox', icon: ClipboardList },
    { href: '/class-overview', label: 'Classes & Rosters', icon: Users },
    { href: '/phase-setup', label: 'Assignments', icon: FolderOpen },
    { href: '/substitute-fto', label: 'Coverage', icon: Users },
    { href: '/reports/weekly-summary', label: 'Packet Monitor', icon: ClipboardList },
    { href: '/agency-packets', label: 'Agency packets', icon: FileText },
    RESOURCES,
  ],
  fto_coc: [
    { href: '/command-review', label: 'Submitted Packets', icon: ClipboardList },
    RESOURCES,
  ],
  po: [
    { href: '/agency-packets', label: 'Agency packets', icon: FileText },
    { href: '/packet-submissions', label: 'Packet Status', icon: ClipboardList },
    { href: '/role-access', label: 'Account Access', icon: Lock },
    RESOURCES,
  ],
  policenet: [
    { href: '/technical-access', label: 'Technical Access', icon: Settings },
    RESOURCES,
  ],
  policenet_admin_sgt: [
    { href: '/technical-access', label: 'Technical Access', icon: Settings },
    RESOURCES,
  ],
};

const navTestId = (href: string) => `link-nav-${href === '/' ? 'home' : href.slice(1).replaceAll('/', '-')}`;

export function Shell({ children }: { children: ReactNode }) {
  const [loc,setLocation] = useLocation();
  const { night, toggle } = useTheme();
  const w = useWorkspace();
  const queryClient = useQueryClient();
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const { toast } = useToast();
  const [confirmLock, setConfirmLock] = useState(false);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [recoveryReviewOpen, setRecoveryReviewOpen] = useState(false);
  const [restoringRecoveryId, setRestoringRecoveryId] = useState<string | null>(null);
  const [leavePage,setLeavePage]=useState<string|null>(null);
  const unsaved = w.dirty || w.editorDirty;
  const otherUnlockedSessions = w.otherSessions.filter(session => session.unlocked);
  const otherDirtySessions = otherUnlockedSessions.filter(session => session.dirty);
  const showSessionConflict = !w.previewOnly && otherUnlockedSessions.length > 0
    && (unsaved || otherDirtySessions.length > 0);
  const requestLock = () => unsaved ? setConfirmLock(true) : w.lockNow();
  const requestRestore = () => {
    if (unsaved && !window.confirm('Unsaved workspace changes will be replaced when saved work is restored. Continue?')) return;
    w.openVault('restore');
  };
  const guardInternalLink=(event:ReactMouseEvent<HTMLDivElement>)=>{
    if(!w.editorDirty||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const target=event.target instanceof Element?event.target.closest('a'):null;
    if(!target||target.getAttribute('target')==='_blank')return;
    const href=target.getAttribute('href');
    if(!href||href==='#'||/^(mailto:|tel:|https?:)/i.test(href))return;
    const base=import.meta.env.BASE_URL.replace(/\/$/,'');
    const pathname=new URL(href,window.location.href).pathname;
    const nextPath=base&&pathname.startsWith(base)?pathname.slice(base.length)||'/':pathname;
    if(nextPath===loc)return;
    event.preventDefault();
    setLeavePage(nextPath);
  };
  const isActive = (h: string) => {
    if(h==='/') return loc==='/';
    if(h==='/reports/weekly-summary') return loc==='/reports/weekly-summary'||loc==='/reports/weekly-ack';
    if(h==='/reports/monthly-summary') return loc==='/reports/monthly-summary';
    if(h==='/reports/weekly-log') return loc==='/reports/weekly-log';
    if(h==='/reports/new') return loc==='/reports/new';
    if(h==='/reports') return loc==='/reports'||(/^\/reports\/[^/]+$/.test(loc)&&!['/reports/new','/reports/weekly-summary','/reports/monthly-summary','/reports/weekly-ack','/reports/weekly-log'].includes(loc));
    return loc===h;
  };
  const isCommand=w.ws.role==='fto_coc';
  const visibleNav = ROLE_NAV[w.ws.role];
  const mobileNav = visibleNav.length > 5 ? visibleNav.slice(0, 5) : visibleNav;
  const activePage = visibleNav.find(n => isActive(n.href)) ?? visibleNav[0];
  const currentPage = isCommand && loc!=='/resources'
    ? 'Submitted packets'
    : loc === '/reports/weekly-ack'
      ? 'Weekly packet acknowledgement'
      : loc === '/reports/monthly-summary'
        ? 'Monthly performance summary'
        : activePage.label;
  const selectPreviewRole = (role: Role) => {
    if (!w.previewOnly) return;
    w.setRole(role);
    setLocation(role === 'fto_coc'
      ? '/command-review'
      : role === 'po'
        ? '/role-access'
        : isTechnicalRole(role)
          ? '/technical-access'
          : '/');
  };

  async function onSave() {
    try { await w.saveNow(); if (w.vault === 'unlocked') toast({ title: 'Saved locally (encrypted)' }); }
    catch { toast({ title: 'Save failed', description: 'Local storage error. Your on-screen work is unchanged.', variant: 'destructive' }); }
  }

  async function onSignOut() {
    queryClient.clear();
    w.lockNow();
    try {
      await signOut({ redirectUrl: import.meta.env.BASE_URL || '/' });
    } catch {
      toast({ title: 'Sign out could not be completed', description: 'Your local workspace was cleared. Please try signing out again.', variant: 'destructive' });
    }
  }

  async function onRestoreRecoverySnapshot(id: string) {
    setRestoringRecoveryId(id);
    try {
      await w.restoreRecoverySnapshot(id);
      setRecoveryReviewOpen(false);
      toast({ title: 'Previous version restored locally', description: 'Agency-sync status was not changed.' });
    } catch (error) {
      toast({
        title: 'Could not restore the previous version',
        description: error instanceof Error ? error.message : 'The local workspace was not changed.',
        variant: 'destructive',
      });
    } finally {
      setRestoringRecoveryId(null);
    }
  }

  async function openRecoveryReview() {
    try {
      await w.refreshRecoverySnapshots();
      setRecoveryReviewOpen(true);
    } catch (error) {
      toast({
        title: 'Could not review recovery copies',
        description: error instanceof Error ? error.message : 'The local recovery list is unavailable.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div data-app-shell className="min-h-[100dvh] flex flex-col bg-background" onClickCapture={guardInternalLink}>
      <div role="note" data-testid="banner-operational-status" className="sticky top-0 z-40 border-t-[3px] border-accent bg-[#f1f3f5] px-3 py-2 text-center text-xs sm:text-sm font-semibold text-[#202934]">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent align-middle" />{w.previewOnly
          ? `Fictional ${w.previewLabel} only. Do not enter operational identifiers. Changes are temporary and clear on refresh.`
          : 'Patrol View and report submission are unavailable. Do not enter operational incident identifiers. Records saved here are local drafts, not submitted or server-confirmed.'}
      </div>
      <header className="bg-sidebar text-sidebar-foreground shadow-sm">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <div className="portal-masthead">
            <div className="portal-masthead-logos">
              <div className="portal-masthead-badge-wrap">
                <img src={`${import.meta.env.BASE_URL}branding/silver-police-badge.png`} alt="Silver Columbus Police badge" className="portal-masthead-badge" data-testid="img-police-badge" />
                <span className="portal-badge-easter-egg portal-badge-easter-egg-left" aria-hidden="true">27</span>
                <span className="portal-badge-easter-egg portal-badge-easter-egg-right" aria-hidden="true">37</span>
              </div>
              <div className="portal-masthead-city" aria-label="City of Columbus">
                <span role="img" aria-label="The City of Columbus" className="city-wordmark block w-full" data-testid="img-columbus-logo" dangerouslySetInnerHTML={{__html:night?columbusLogoSvg.replaceAll('#E10012','#0070c0'):columbusLogoSvg}} />
              </div>
              <img src={`${import.meta.env.BASE_URL}branding/columbus-police-patch-white-eagle.png`} alt="Columbus Police patch with white eagle" className="portal-masthead-patch" data-testid="img-police-patch" />
            </div>
            <div className="portal-masthead-lockup" style={{ color: night ? '#4da3ff' : '#ffffff' }}>
              <div className="portal-masthead-division">
                DIVISION OF POLICE:
              </div>
              <Link href="/" className="portal-masthead-name" aria-label="Field Training Officer Portal home" data-testid="link-portal-home">
                Field Training Officer Portal
              </Link>
            </div>
          </div>
          <nav aria-label="Main navigation" className="hidden min-h-12 flex-wrap items-stretch gap-x-4 gap-y-2 border-t border-white/15 py-2 md:flex" data-testid="nav-desktop">
            {visibleNav.map(n => (
              <Link key={n.href} href={n.href} data-testid={navTestId(n.href)} aria-current={isActive(n.href) ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-2 border-b-[3px] px-1 pt-1 text-sm font-semibold transition-colors', isActive(n.href) ? 'border-accent text-white' : 'border-transparent text-white/80 hover:text-white')}>
                <n.icon className="h-4 w-4" />{n.label}
              </Link>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {!w.previewOnly && isLoaded && isSignedIn ? (
                <>
                  <span className="hidden max-w-48 break-words text-[0.65rem] font-semibold text-white/80 xl:inline" title="Signed-in account">
                    {user?.fullName || user?.primaryEmailAddress?.emailAddress}
                  </span>
                  <button type="button" onClick={() => void onSignOut()} className="h-8 rounded-sm border border-white/30 px-2 text-xs font-semibold text-white hover:bg-white/10">Sign out</button>
                </>
              ) : !w.previewOnly ? (
                <Link href="/sign-in" className="h-8 rounded-sm border border-white/30 px-2 py-1.5 text-xs font-semibold text-white hover:bg-white/10">Sign in</Link>
              ) : null}
              {w.previewOnly && <label className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-white/70">
                <span>Preview role</span>
                <select aria-label="Fictional role preview" data-testid="select-role-desktop" className="h-8 min-w-44 max-w-56 rounded-sm border border-white/30 bg-white px-2 text-xs font-semibold normal-case tracking-normal text-[#172b46]" value={w.ws.role} onChange={e => selectPreviewRole(e.target.value as Role)}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]} · fictional</option>)}
                </select>
              </label>}
            </div>
          </nav>
        </div>
      </header>
      <div className="border-b border-border bg-card shadow-sm">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <div data-testid="status-connection" aria-live="polite" className={cn('flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs font-semibold', w.online ? 'border-border bg-background' : 'border-accent bg-accent/10')}>
            {w.online ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <WifiOff className="h-3.5 w-3.5 text-accent" />}
            {w.previewOnly
              ? <>{w.previewLabel} · changes stay in memory until refresh</>
              : w.vault === 'unlocked'
              ? unsaved
                ? <>{w.online ? 'Online' : 'Offline'} · changes not yet saved · <span className="mono">{w.pending}</span> local records not uploaded</>
                : <>{w.online ? 'Online' : 'Offline'} · saved on this device · <span className="mono">{w.pending}</span> local records not uploaded</>
              : unsaved
                ? <>{w.online ? 'Online' : 'Offline'} · NOT saved · unlock the local vault to keep changes</>
                : <>{w.online ? 'Online' : 'Offline'} · report service not connected</>}
          </div>
          <div className="hidden text-xs text-muted-foreground lg:block" data-testid="status-vault">
            {w.previewOnly
              ? `Fictional ${w.previewLabel} · refresh clears test changes`
              : w.vault === 'unlocked'
                ? (unsaved ? 'Vault open · unsaved changes' : 'Vault open · saved on this device')
                : (unsaved ? 'Unsaved changes · not stored on this device' : 'Not saved · local changes in memory')}
          </div>
          <div className="ml-auto flex w-full min-w-0 items-center gap-1.5 md:w-auto">
            {!w.previewOnly && isLoaded && isSignedIn ? (
              <button type="button" onClick={() => void onSignOut()} aria-label="Sign out" className="h-9 shrink-0 rounded-sm border px-2 text-xs font-semibold md:hidden">
                Sign out
              </button>
            ) : !w.previewOnly ? (
              <Link href="/sign-in" className="h-9 shrink-0 rounded-sm border px-2 py-2 text-xs font-semibold md:hidden">Sign in</Link>
            ) : null}
            {w.previewOnly && <label className="flex min-w-0 flex-1 items-center gap-1.5 md:hidden">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Role</span>
              <select aria-label="Fictional role preview" data-testid="select-role-mobile" className="h-9 min-w-0 w-full rounded-sm border border-input bg-card px-2 text-xs font-semibold" value={w.ws.role} onChange={e => selectPreviewRole(e.target.value as Role)}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]} · fictional</option>)}
              </select>
            </label>}
            {w.previewOnly ? (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Reset the fictional ${w.previewLabel.toLowerCase()}? All in-memory test entries will be cleared.`)) w.resetWorkspace();
                }}
                className="flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Reset {w.previewLabel === 'UI test workspace' ? 'test data' : w.previewLabel}
              </button>
            ) : (
              <>
                {w.vault === 'unlocked' ? (
                  <button data-testid="button-lock" onClick={requestLock} className="flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold transition-colors hover:bg-muted"><Lock className="h-4 w-4" /><span className="hidden sm:inline">Lock</span></button>
                ) : (
                  <button data-testid="button-unlock" onClick={requestRestore} className="flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold transition-colors hover:bg-muted"><Unlock className="h-4 w-4" /><span className="hidden sm:inline">Unlock saved work</span></button>
                )}
                <button data-testid="button-save" onClick={onSave} className="flex h-9 items-center gap-1.5 rounded-sm bg-primary px-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[.97]"><Save className="h-4 w-4" /><span className="hidden sm:inline">Save locally</span></button>
              </>
            )}
            <button data-testid="button-theme" onClick={toggle} aria-label={night ? 'Switch to daylight' : 'Switch to night shift'} className="flex h-9 items-center gap-1.5 rounded-sm border px-3 text-sm font-semibold transition-colors hover:bg-muted">{night ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span className="hidden sm:inline">{night ? 'Daylight' : 'Night shift'}</span></button>
          </div>
        </div>
      </div>
      {w.saveError && (
        <div role="alert" data-testid="notice-save-error" className="mx-auto mt-3 flex w-full max-w-[1180px] flex-wrap items-center gap-3 rounded-sm border border-destructive bg-destructive/10 p-3 text-sm text-destructive"><ShieldAlert className="h-4 w-4" /><span className="flex-1"><b>Local save failed.</b> Changes on screen are NOT stored. {w.saveError}</span><button className="font-semibold underline" onClick={onSave} data-testid="button-retry-save">Retry save</button></div>
      )}
      {w.overwrittenElsewhere && (
        <div role="alert" data-testid="notice-workspace-overwritten" className="mx-auto mt-3 flex w-full max-w-[1180px] flex-wrap items-center gap-3 rounded-sm border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4" />
          <span className="flex-1"><b>This workspace was replaced in another tab.</b> This tab was locked so stale edits cannot overwrite the newer saved version. Unlock to continue with the latest saved work or review a recovery copy. Recovery copies expire after 7 days and are deleted after restoration.</span>
          <button className="font-semibold underline" onClick={() => w.openVault('restore')} data-testid="button-restore-overwritten-workspace">Unlock latest saved work</button>
          <button className="text-muted-foreground" onClick={w.dismissOverwrittenElsewhere} data-testid="button-dismiss-overwritten-notice">Dismiss</button>
        </div>
      )}
      {w.recoverySnapshots.length > 0 && (
        <div role="note" data-testid="notice-recovery-snapshot" className="mx-auto mt-3 flex w-full max-w-[1180px] flex-wrap items-center gap-3 rounded-sm border border-[#bad6ed] bg-[#f2f8fd] p-3 text-sm text-[#233b51]">
          <FileClock className="h-5 w-5 shrink-0 text-[#075a9c]" />
          <span className="min-w-0 flex-1">
            <b>{w.recoverySnapshots.length} encrypted recovery {w.recoverySnapshots.length === 1 ? 'copy is' : 'copies are'} available.</b>
            {' '}Each expires 7 days after capture and is deleted after restoration.
          </span>
          <button type="button" onClick={() => void openRecoveryReview()} data-testid="button-review-recovery-snapshot" className="min-h-9 rounded-sm border border-[#075a9c] px-3 font-semibold text-[#075a9c] underline hover:bg-white">
            Review recovery {w.recoverySnapshots.length === 1 ? 'copy' : 'copies'}
          </button>
        </div>
      )}
      {w.recoverySyncReviewRequired && (
        <div role="alert" data-testid="notice-recovery-sync-review" className="mx-auto mt-3 flex w-full max-w-[1180px] flex-wrap items-center gap-3 rounded-sm border border-[#b77912] bg-[#fff8e8] p-3 text-sm text-[#382b14]">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1"><b>Restored work is saved only on this device.</b> Packet sync is paused until you save this version locally, so existing agency-sync operations remain unchanged.</span>
          <button type="button" onClick={() => void onSave()} data-testid="button-save-restored-workspace" className="min-h-9 rounded-sm border border-[#8a5a00] px-3 font-semibold underline">
            Save restored version locally
          </button>
        </div>
      )}
      {showSessionConflict && (
        <div role="alert" aria-live="polite" data-testid="notice-session-conflict" className="mx-auto mt-3 flex w-full max-w-[1180px] flex-wrap items-center gap-3 rounded-sm border border-[#b77912] bg-[#fff8e8] p-3 text-sm text-[#382b14]">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[#8a5a00]" />
          <span className="min-w-0 flex-1">
            <b>{unsaved && otherDirtySessions.length ? 'Two sessions have unsaved changes.' : otherDirtySessions.length ? 'Another session has unsaved changes.' : 'This workspace is open in another session.'}</b>
            <span className="block mt-1">{otherUnlockedSessions.length} other tab{otherUnlockedSessions.length === 1 ? ' is' : 's are'} open{otherDirtySessions.length ? `; ${otherDirtySessions.length} has unsaved edits` : ''}. Saving over another tab replaces its current workspace. Both sessions stay on this device; no agency upload occurs.</span>
            {w.editorDirty && <span className="block mt-1 font-semibold">Save the open form before choosing an overwrite.</span>}
          </span>
          {w.dirty && !w.editorDirty && w.vault === 'unlocked' && (
            <button type="button" onClick={() => setConfirmOverwrite(true)} data-testid="button-overwrite-other-session" className="h-9 rounded-sm border border-destructive bg-destructive px-3 text-sm font-semibold text-destructive-foreground hover:opacity-90">
              Overwrite other session
            </button>
          )}
        </div>
      )}
      {w.lockedNotice && (
        <div className="mx-auto mt-3 flex w-full max-w-[1180px] flex-wrap items-center gap-3 rounded-sm border border-accent bg-accent/10 p-3 text-sm" data-testid="notice-locked">
          <Lock className="h-4 w-4" /><span className="flex-1">{w.lockedWithUnsaved ? 'Locked after 15 minutes of inactivity. Unsaved form edits may have been lost; unlock to recover the last successful encrypted save.' : 'Locked after 15 minutes of inactivity. Decrypted data was cleared from this screen; local changes are not displayed.'}</span>
          <button className="font-semibold underline" onClick={() => w.openVault('restore')} data-testid="button-notice-unlock">Unlock saved work</button>
          <button className="text-muted-foreground" onClick={w.dismissLockedNotice} data-testid="button-notice-dismiss">Dismiss</button>
        </div>
      )}
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-5 pb-24 sm:px-6 md:pb-8">
        <nav aria-label="Breadcrumb" className="mb-5 flex flex-wrap items-center gap-2 bg-primary px-4 py-3 text-sm text-primary-foreground">
          <Link href="/" className="underline-offset-4 hover:underline">Home</Link>
          <span aria-hidden>/</span>
          <span aria-current="page" className="font-bold">{currentPage}</span>
        </nav>
        {children}
      </main>
      <nav aria-label="Mobile navigation" data-testid="nav-mobile" className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden">
        {mobileNav.map(item => (
          <MobileLink key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>
      <VaultDialog />
      <Dialog open={recoveryReviewOpen} onOpenChange={setRecoveryReviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto" data-testid="dialog-recovery-snapshot">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileClock className="h-5 w-5 text-primary" />Review the previous version</DialogTitle>
            <DialogDescription>This encrypted copy was saved before another tab replaced the workspace. Choose a version to restore.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {w.recoverySnapshots.map(snapshot => (
              <section key={snapshot.id} className="rounded-sm border border-border p-3" data-testid="recovery-snapshot-item">
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Captured</div>
                    <div className="mt-1 font-semibold">{new Date(snapshot.capturedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contents</div>
                    <div className="mt-1 font-semibold">{snapshot.reportCount} daily {snapshot.reportCount === 1 ? 'record' : 'records'} · {snapshot.taskCount} tasks · {snapshot.assignmentCount} assignments</div>
                  </div>
                </div>
                <div className="mt-3 rounded-sm border border-[#bad6ed] bg-[#f2f8fd] p-3 text-sm leading-5 text-[#233b51]">
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#075a9c]" />
                    <p>Restoring replaces the current local workspace. It does not upload records or change agency-sync status.</p>
                  </div>
                </div>
                <p className="mt-3 flex gap-2 text-sm leading-5 text-muted-foreground">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Expires {new Date(snapshot.expiresAt).toLocaleString()}, or is deleted sooner after restoration.</span>
                </p>
                {(w.dirty || w.editorDirty) && (
                  <p className="mt-3 text-sm font-semibold text-destructive">Save current changes before restoring this version.</p>
                )}
                <button
                  type="button"
                  disabled={w.dirty || w.editorDirty || restoringRecoveryId !== null}
                  onClick={() => void onRestoreRecoverySnapshot(snapshot.id)}
                  data-testid="button-restore-recovery-snapshot"
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  {restoringRecoveryId === snapshot.id ? 'Restoring…' : 'Restore this version'}
                </button>
              </section>
            ))}
            {w.recoverySnapshots.length === 0 && (
              <p className="text-sm text-muted-foreground">No recovery copies are available. Expired copies are deleted automatically.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmLock} onOpenChange={setConfirmLock}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Lock with unsaved changes?</AlertDialogTitle><AlertDialogDescription>{w.editorDirty ? 'An open report has edits that were not saved to the workspace. ' : ''}{w.dirty ? 'Workspace changes have not finished saving to the vault. ' : ''}Locking clears them from this screen and they cannot be recovered.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-lock-cancel">Keep working</AlertDialogCancel><AlertDialogAction data-testid="button-lock-discard" onClick={() => w.lockNow()}>Discard and lock</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite the other session?</AlertDialogTitle>
            <AlertDialogDescription>
              Before replacing the other tab, the portal saves its unsaved workspace as an encrypted recovery copy on this device. The copy expires after 7 days or is deleted after restoration. If the other tab has an open unsaved form or is synchronizing packets, the overwrite will not proceed. This only changes local workspace data; it does not upload to the agency service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-overwrite-session">Keep both tabs open</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-overwrite-session" onClick={async event => {
              event.preventDefault();
              try {
                await w.overwriteOtherSessions();
                setConfirmOverwrite(false);
                toast({ title: 'Saved locally', description: 'The other tab was locked and must unlock to continue.' });
              } catch (error) {
                setConfirmOverwrite(false);
                toast({ title: 'Could not overwrite the other session', description: error instanceof Error ? error.message : 'Your local work was not replaced.', variant: 'destructive' });
              }
            }}>Overwrite other session</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={leavePage!==null} onOpenChange={open=>{if(!open)setLeavePage(null);}}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Keep this shift sheet?</AlertDialogTitle><AlertDialogDescription>An open report or run has unsaved edits. Stay on this page and finish or save the draft before leaving. If you leave, those open edits will not be kept.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="button-stay-on-shift">Stay and keep working</AlertDialogCancel><AlertDialogAction data-testid="button-leave-unsaved" onClick={()=>{if(leavePage)setLocation(leavePage);setLeavePage(null);}}>Leave without saving</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
function MobileLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutGrid; active: boolean }) {
  const shortLabel = label === 'Help & Resources' ? 'Help' : label;
  return <Link href={href} data-testid={`link-mobile-nav-${href === '/' ? 'home' : href.slice(1).replaceAll('/', '-')}`} aria-current={active ? 'page' : undefined} className={cn('flex min-h-16 min-w-[76px] shrink-0 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[0.65rem] font-semibold leading-tight', active ? 'text-sidebar-primary' : 'opacity-80')}>
    <Icon className="h-5 w-5 shrink-0" /><span>{shortLabel}</span>
  </Link>;
}
