import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { Save, RotateCw } from "lucide-react";
import { OperationalAssignmentToken, parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import type { OperationalProfileContext } from "@workspace/api-client-react";
import { Panel } from "@/components/bits.js";
import { useOperationalProfile } from "@/state/operational-profile.js";
import { operatorErrorMessage } from "@/lib/operator-errors.js";
import { OperationalProfileHistoryPanel } from "./operational-profile-history.js";
import { OperationalProfileClearDialog, profileClearTheme } from "./operational-profile-clear-dialog.js";

/** Approved addition only; existing vault controls and form presentation stay intact. */
export function OperationalProfilePanel() {
  const state = useOperationalProfile();
  const profile = state.editorProfile ?? state.profile;
  if (state.pending) return <Panel title="Account Settings"><p className="p-4 text-sm" role="status">Loading your operational assignment…</p></Panel>;
  if (!profile || !state.save || !state.refresh) {
    if (!state.error) return null;
    return <Panel title="Account Settings"><div className="p-4 space-y-3 text-sm">
      <p role="alert">{state.error}</p>
      {state.refresh && <RetryProfile refresh={state.refresh}/>}
    </div></Panel>;
  }
  return <React.Fragment key={profile.subject}>
    <ProfileEditor profile={profile} save={state.save} clear={state.clear} refresh={state.refresh} unavailable={state.error} successfulRead={state.successfulRead}
      setEditorDirty={state.setEditorDirty} saveAuthRecoverySnapshot={state.saveAuthRecoverySnapshot}/>
    <OperationalProfileHistoryPanel subject={profile.subject} version={profile.version} unavailable={!!state.error}/>
  </React.Fragment>;
}

function RetryProfile({ refresh }: { refresh: () => Promise<OperationalProfileContext> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <><button type="button" disabled={pending} className="h-10 rounded border px-3 text-sm font-semibold disabled:opacity-50"
    onClick={async()=>{setPending(true);setError("");try{await refresh();}catch{setError("The profile is still unavailable. Try again when agency access is restored.");}finally{setPending(false);}}}>
    {pending ? "Retrying…" : "Retry profile connection"}
  </button>{error&&<p role="alert">{error}</p>}</>;
}

function ProfileEditor({ profile, save, clear, refresh, unavailable, successfulRead = 0,
  setEditorDirty, saveAuthRecoverySnapshot }: {
  profile: OperationalProfileContext;
  save: (token: string, version: number) => Promise<OperationalProfileContext>;
  clear?: (version: number) => Promise<OperationalProfileContext>;
  refresh: () => Promise<OperationalProfileContext>;
  unavailable?: string;
  successfulRead?: number;
  setEditorDirty?: (dirty: boolean) => void;
  saveAuthRecoverySnapshot?: (accountId?: string, fields?: Array<{ form: string; field: string; value: string }>) => Promise<void>;
}) {
  const [token, setToken] = useState(profile.identity?.assignmentToken ?? "");
  const [baseToken, setBaseToken] = useState(token);
  const [version, setVersion] = useState(profile.version);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState<{ message: string; successfulRead: number }>();
  const [message, setMessage] = useState("");
  const [requiresReload, setRequiresReload] = useState(false);
  const [confirmVersion, setConfirmVersion] = useState<number>();
  const [confirmed, setConfirmed] = useState(false);
  const mounted = useRef(true);
  const dirty = token !== baseToken;
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const tokenRef = useRef(token); tokenRef.current = token;
  const valid = OperationalAssignmentToken.safeParse(token).success;
  const derived = valid ? parseOperationalIdentity(token) : undefined;
  const visibleRefreshError = refreshError && (unavailable || successfulRead <= refreshError.successfulRead)
    ? refreshError.message : "";
  const visibleError = error || visibleRefreshError;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{setEditorDirty?.(dirty);},[dirty,setEditorDirty]);
  useEffect(()=>()=> {
    if (!dirtyRef.current) {
      setEditorDirty?.(false);
      return;
    }
    const recovery = saveAuthRecoverySnapshot?.(profile.subject, [{
      form: "operational-profile", field: "operational-assignment-token", value: tokenRef.current,
    }]);
    if (recovery) void recovery.catch(()=>{}).finally(()=>setEditorDirty?.(false));
    else setEditorDirty?.(false);
  },[profile.subject,saveAuthRecoverySnapshot,setEditorDirty]);
  useEffect(()=>{
    if (!unavailable && refreshError && successfulRead > refreshError.successfulRead) setRefreshError(undefined);
  },[unavailable,successfulRead,refreshError]);
  useEffect(()=>{
    if (!dirty && !pending) {
      const saved = profile.identity?.assignmentToken ?? "";
      setToken(saved); setBaseToken(saved); setVersion(profile.version);
    }
  },[profile,dirty,pending]);

  const accept = (saved: OperationalProfileContext) => {
    const value = saved.identity?.assignmentToken ?? "";
    setToken(value); setBaseToken(value); setVersion(saved.version); setRequiresReload(false);
    setError(""); setRefreshError(undefined);
  };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setRefreshError(undefined); setMessage("");
    if (unavailable || pending || requiresReload || confirmVersion !== undefined || profile.version !== version) return;
    if (!valid) { setError("Use four district digits, an uppercase shift letter, and optional side -1 or -2, for example 9150E or 9150E-1."); return; }
    setPending(true);
    try {
      const saved=await save(token,version);
      if(mounted.current){accept(saved);setMessage("Assignment saved. It will apply to future packets only.");}
    } catch(cause) {
      if(mounted.current){
        setRequiresReload(true);
        setError(operatorErrorMessage(cause,"The profile save was not confirmed. Reload the saved assignment before retrying."));
      }
    } finally { if(mounted.current)setPending(false); }
  }
  async function clearAssignment() {
    if (!clear || !confirmed || confirmVersion === undefined || dirty || pending || unavailable || requiresReload) return;
    if (profile.version !== confirmVersion || version !== confirmVersion) {
      setConfirmVersion(undefined); setConfirmed(false); setRequiresReload(true);
      setError("This assignment changed elsewhere. Reload the saved assignment before retrying.");
      return;
    }
    setPending(true); setError(""); setMessage("");
    try {
      const saved = await clear(confirmVersion);
      if (mounted.current) { accept(saved); setMessage("No vehicle assigned. Future packets will use manual vehicle entry."); }
    } catch (cause) {
      if (mounted.current) {
        setRequiresReload(true);
        setError(operatorErrorMessage(cause, "The profile clear was not confirmed. Reload the saved assignment before retrying."));
      }
    } finally {
      if (mounted.current) { setPending(false); setConfirmVersion(undefined); setConfirmed(false); }
    }
  }
  return <Panel title="Account Settings · Operational identity" id="operational-profile">
    <form onSubmit={submit} noValidate className="p-4 space-y-4 text-sm" data-testid="form-operational-profile" data-auth-recovery-form="operational-profile">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><div className="label-caps">Signed account role · read only</div><p className="mt-2 font-bold" data-testid="text-profile-role">{profile.role === "FTO" ? "FTO · Field Training Officer" : "PO · Probationary Officer"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Badge {profile.badge} · This form cannot change roles or badges.</p></div>
        <div><label htmlFor="operational-assignment-token" className="label-caps">Operational assignment token</label>
          <input id="operational-assignment-token" value={token} disabled={pending} maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            aria-invalid={!!visibleError || (dirty && !valid)} aria-describedby="operational-assignment-help"
            onChange={event=>{setToken(event.target.value);setError("");setRefreshError(undefined);setMessage("");}}
            className="mt-2 h-10 w-full rounded border bg-card px-3 text-sm mono disabled:opacity-50" data-testid="input-operational-assignment"/>
          <p id="operational-assignment-help" className="mt-1 text-xs text-muted-foreground">Four district digits and an uppercase shift letter; optional side -1 or -2. Examples: 9150E, 9150E-1, 9150E-2.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border bg-muted/30 p-3"><span className="label-caps">Physical cruiser · read only</span><output className="mono ml-3 font-bold" data-testid="text-profile-cruiser">Not supplied</output></div>
        <div className="rounded border bg-muted/30 p-3"><span className="label-caps">CAD identifier · read only</span><output className="mono ml-3 font-bold" data-testid="text-profile-cad">{derived?.cadUnit ?? ""}</output></div>
      </div>
      <p className="border-l-4 border-primary bg-primary/5 p-3"><strong>Future packets only.</strong> Saving changes your account's operational assignment, not your training roster, role, badge or record access. Existing packets and manual Cruiser corrections stay unchanged. A PO profile never replaces the FTO vehicle context.</p>
      {dirty&&profile.version!==version&&<p role="status" className="text-warn">A newer saved assignment is available. Your unsaved entry is retained; reload it before saving.</p>}
      {visibleError&&<p role="alert" className="text-destructive" data-testid="text-profile-error">{visibleError}</p>}
      {unavailable&&<p role="alert" className="text-destructive">{unavailable} Your unsaved entry is retained. Reload to reconnect.</p>}
      {message&&<p role="status" data-testid="text-profile-saved">{message}</p>}
      {!profile.identity&&!message&&<p role="status" data-testid="text-profile-empty">No vehicle assigned</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending||requiresReload||!!unavailable||!dirty||profile.version!==version}
          className="inline-flex h-10 items-center gap-1.5 rounded bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-operational-profile">
          <Save className="h-4 w-4"/>{pending?"Saving…":"Save assignment"}
        </button>
        <button type="button" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded border px-3 font-semibold disabled:opacity-50"
          data-testid="button-reload-operational-profile" onClick={async()=>{
            setPending(true);setRefreshError(undefined);setMessage("");
            try{const saved=await refresh();if(mounted.current)accept(saved);}
            catch(cause){if(mounted.current)setRefreshError({
              message:operatorErrorMessage(cause,"The profile could not be refreshed. Your entry is retained."),successfulRead,
            });}
            finally{if(mounted.current)setPending(false);}
          }}><RotateCw className="h-4 w-4"/>{dirty?"Discard edits and reload":"Reload saved assignment"}</button>
        {clear&&<button type="button" className="op-clear-scope op-clear-button" style={profileClearTheme}
          disabled={pending||requiresReload||!!unavailable||dirty||!profile.identity||profile.version!==version}
          data-testid="button-clear-operational-profile" onClick={() => {
            setConfirmed(false); setConfirmVersion(version); setError(""); setMessage("");
          }}>Clear assignment</button>}
      </div>
    </form>
    <OperationalProfileClearDialog open={confirmVersion!==undefined} onOpenChange={open => {
      if (!open) { setConfirmVersion(undefined); setConfirmed(false); }
    }} confirmed={confirmed} onConfirmedChange={setConfirmed} pending={pending} onConfirm={() => { void clearAssignment(); }}/>
  </Panel>;
}
