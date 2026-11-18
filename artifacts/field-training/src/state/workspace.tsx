import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { OfflineStorage } from '@/lib/offlineStorage';
import { seedWorkspace } from '@/lib/seed';
import { findInvalidRatings, type Report, type Role, type Task, type Workspace } from '@/lib/model';

export type VaultState = 'none' | 'unlocked';
type VaultIntent = 'save' | 'restore' | null;

interface Ctx {
  ws: Workspace; epoch: number; saveError: string | null; editorDirty: boolean; setEditorDirty(d: boolean): void; vault: VaultState; restored: boolean; pending: number; dirty: boolean; online: boolean; lockedNotice: boolean;
  setRole(r: Role): void; upsertReport(r: Report): void; deleteReport(id: string): void; toggleTask(id: string, by: string): void;
  intent: VaultIntent; openVault(i: Exclude<VaultIntent, null>): void; closeVault(): void;
  setupAndSave(pass: string): Promise<void>; unlockAndRestore(pass: string): Promise<void>; saveNow(): Promise<void>; lockNow(reason?: string): void; dismissLockedNotice(): void;
  resetToSample(): void;
}
const C = createContext<Ctx | null>(null);
const IDLE_MS = 15 * 60 * 1000;
const enc = (p: string) => new TextEncoder().encode(p);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const storage = useRef<OfflineStorage>(null as unknown as OfflineStorage);
  if (!storage.current) storage.current = new OfflineStorage('fieldready-demo');
  const [ws, setWs] = useState<Workspace>(seedWorkspace);
  const [epoch, setEpoch] = useState(0);
  const [vault, setVault] = useState<VaultState>('none');
  const [restored, setRestored] = useState(false);
  const [pending, setPending] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [intent, setIntent] = useState<VaultIntent>(null);
  const [lockedNotice, setLockedNotice] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const rev = useRef(0);
  const wsRef = useRef(ws); wsRef.current = ws;

  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);

  const refreshPending = useCallback(async () => { try { if (storage.current.isUnlocked) setPending(await storage.current.pendingCount()); } catch { /* ignore */ } }, []);

  const persist = useCallback(async (w: Workspace) => {
    const at = rev.current;
    try { await storage.current.save<Workspace>('workspace', w); }
    catch (e) { setSaveError(e instanceof Error ? e.message : 'Local save failed'); throw e; }
    setSaveError(null);
    if (rev.current === at) setDirty(false);
    await refreshPending();
  }, [refreshPending]);

  const mutate = useCallback((fn: (w: Workspace) => Workspace) => { rev.current++; setWs(w => fn(w)); setDirty(true); }, []);

  // autosave when vault unlocked
  const saveTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (vault !== 'unlocked' || !dirty) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => { persist(wsRef.current).catch(() => { /* surfaced via saveError banner */ }); }, 800);
    return () => window.clearTimeout(saveTimer.current);
  }, [ws, vault, dirty, persist]);

  const lockNow = useCallback((reason?: string) => {
    storage.current.lock();
    setVault('none'); setRestored(false); setPending(0); setDirty(false); setEditorDirty(false); setSaveError(null);
    setWs(seedWorkspace()); setEpoch(e => e + 1);
    if (reason) setLockedNotice(true);
  }, []);

  // inactivity
  useEffect(() => {
    if (vault !== 'unlocked') return;
    let t = window.setTimeout(() => lockNow('idle'), IDLE_MS);
    const reset = () => { window.clearTimeout(t); t = window.setTimeout(() => lockNow('idle'), IDLE_MS); };
    const ev = ['pointerdown','keydown','scroll','touchstart'];
    ev.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => { window.clearTimeout(t); ev.forEach(e => window.removeEventListener(e, reset)); };
  }, [vault, lockNow]);

  const setupAndSave = useCallback(async (pass: string) => {
    const s = storage.current;
    await s.unlock(enc(pass));
    let existing: Workspace | undefined;
    try { existing = await s.get<Workspace>('workspace'); }
    catch { s.lock(); throw new Error('A saved vault already exists on this device and this passphrase does not open it. Use "Unlock saved work" instead — nothing was overwritten.'); }
    if (existing) { s.lock(); throw new Error('Saved work already exists on this device. Use "Unlock saved work" to restore it first — nothing was overwritten.'); }
    const w = { ...wsRef.current, version: wsRef.current.version + 1 };
    try { await persist(w); } catch (e) { s.lock(); throw e; }
    setWs(w); setVault('unlocked'); setRestored(true);
  }, [persist]);

  const unlockAndRestore = useCallback(async (pass: string) => {
    const s = storage.current;
    await s.unlock(enc(pass));
    let data: Workspace | undefined;
    try { data = await s.get<Workspace>('workspace'); }
    catch { s.lock(); throw new Error('Could not decrypt saved work. The passphrase may be wrong, or the data is damaged.'); }
    if (!data) { s.lock(); throw new Error('No saved work found on this device. Use "Save locally" to create a vault.'); }
    const bad = Array.isArray(data.reports) ? findInvalidRatings(data.reports) : ['(unreadable report list)'];
    if (bad.length) { s.lock(); throw new Error('Restore refused: legacy numeric evaluation data requires manual review (' + bad.join(', ') + '). Ratings are not converted automatically. The saved vault was left unchanged and nothing was loaded. Contact your training coordinator before using this vault.'); }
    setWs({ ...data, reports: data.reports.map(r => ({ ...r, precinct: r.precinct ?? '', recruitComments: r.recruitComments ?? '' })) }); setEpoch(e => e + 1); setVault('unlocked'); setRestored(true); setDirty(false); setLockedNotice(false);
    await refreshPending();
  }, [refreshPending]);

  const saveNow = useCallback(async () => {
    if (vault !== 'unlocked') { setIntent('save'); return; }
    await persist(wsRef.current);
  }, [vault, persist]);

  const value = useMemo<Ctx>(() => ({
    ws, epoch, saveError, editorDirty, setEditorDirty, vault, restored, pending, dirty, online, intent, lockedNotice,
    setRole: (role) => setWs(w => ({ ...w, role })),
    upsertReport: (r) => mutate(w => ({ ...w, reports: w.reports.some(x => x.id === r.id) ? w.reports.map(x => x.id === r.id ? r : x) : [r, ...w.reports] })),
    deleteReport: (id) => mutate(w => ({ ...w, reports: w.reports.filter(r => r.id !== id) })),
    toggleTask: (id, by) => mutate(w => ({ ...w, tasks: w.tasks.map((t: Task) => t.id !== id ? t : t.done ? { ...t, done: false, by: undefined, at: undefined } : { ...t, done: true, by, at: new Date().toISOString() }) })),
    openVault: (i) => setIntent(i), closeVault: () => setIntent(null),
    setupAndSave, unlockAndRestore, saveNow, lockNow, dismissLockedNotice: () => setLockedNotice(false),
    resetToSample: () => { rev.current++; setWs(seedWorkspace()); setDirty(true); setEditorDirty(false); setEpoch(e => e + 1); },
  }), [ws, epoch, saveError, editorDirty, setEditorDirty, vault, restored, pending, dirty, online, intent, lockedNotice, mutate, setupAndSave, unlockAndRestore, saveNow, lockNow]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useWorkspace() { const c = useContext(C); if (!c) throw new Error('WorkspaceProvider missing'); return c; }

export function useTheme() {
  const [night, setNight] = useState(() => { try { return localStorage.getItem('fieldready.theme') === 'night'; } catch { return false; } });
  useEffect(() => { document.documentElement.classList.toggle('dark', night); try { localStorage.setItem('fieldready.theme', night ? 'night' : 'day'); } catch { /* ignore */ } }, [night]);
  return { night, toggle: () => setNight(n => !n) };
}
