import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { Save, RotateCw } from "lucide-react";
import { OperationalAssignmentToken, parseOperationalIdentity } from "@workspace/api-zod/operational-profile";
import type { OperationalProfileContext } from "@workspace/api-client-react";
import { Panel } from "@/components/bits.js";
import { useOperationalProfile } from "@/state/operational-profile.js";
import { operatorErrorMessage } from "@/lib/operator-errors.js";

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
  return <ProfileEditor key={profile.subject} profile={profile} save={state.save} refresh={state.refresh} unavailable={state.error}/>;
}

function RetryProfile({ refresh }: { refresh: () => Promise<OperationalProfileContext> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <><button type="button" disabled={pending} className="h-10 rounded border px-3 text-sm font-semibold disabled:opacity-50"
    onClick={async()=>{setPending(true);setError("");try{await refresh();}catch{setError("The profile is still unavailable. Try again when agency access is restored.");}finally{setPending(false);}}}>
    {pending ? "Retrying…" : "Retry profile connection"}
  </button>{error&&<p role="alert">{error}</p>}</>;
}

function ProfileEditor({ profile, save, refresh, unavailable }: {
  profile: OperationalProfileContext;
  save: (token: string, version: number) => Promise<OperationalProfileContext>;
  refresh: () => Promise<OperationalProfileContext>;
  unavailable?: string;
}) {
  const [token, setToken] = useState(profile.identity?.assignmentToken ?? "");
  const [baseToken, setBaseToken] = useState(token);
  const [version, setVersion] = useState(profile.version);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requiresReload, setRequiresReload] = useState(false);
  const mounted = useRef(true);
  const dirty = token !== baseToken;
  const valid = OperationalAssignmentToken.safeParse(token).success;
  const derived = valid ? parseOperationalIdentity(token) : undefined;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    if (!dirty && !pending) {
      const saved = profile.identity?.assignmentToken ?? "";
      setToken(saved); setBaseToken(saved); setVersion(profile.version);
    }
  },[profile,dirty,pending]);

  const accept = (saved: OperationalProfileContext) => {
    const value = saved.identity?.assignmentToken ?? "";
    setToken(value); setBaseToken(value); setVersion(saved.version); setRequiresReload(false);
  };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (unavailable || pending || requiresReload || profile.version !== version) return;
    if (!valid) { setError("Use four cruiser digits, an uppercase company letter, and side -1 or -2, for example 9150E-1."); return; }
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
  return <Panel title="Account Settings · Operational identity" id="operational-profile">
    <form onSubmit={submit} noValidate className="p-4 space-y-4 text-sm" data-testid="form-operational-profile">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><div className="label-caps">Signed account role · read only</div><p className="mt-2 font-bold" data-testid="text-profile-role">{profile.role === "FTO" ? "FTO · Field Training Officer" : "PO · Probationary Officer"}</p>
          <p className="mt-1 text-xs text-muted-foreground">Badge {profile.badge} · This form cannot change roles or badges.</p></div>
        <div><label htmlFor="operational-assignment-token" className="label-caps">Operational assignment token</label>
          <input id="operational-assignment-token" value={token} disabled={pending} maxLength={7} autoCapitalize="characters" autoComplete="off" spellCheck={false}
            aria-invalid={!!error || (dirty && !valid)} aria-describedby="operational-assignment-help"
            onChange={event=>{setToken(event.target.value);setError("");setMessage("");}}
            className="mt-2 h-10 w-full rounded border bg-card px-3 text-sm mono disabled:opacity-50" data-testid="input-operational-assignment"/>
          <p id="operational-assignment-help" className="mt-1 text-xs text-muted-foreground">Four digits, uppercase company letter, hyphen, then side 1 or 2. Example: 9150E-1.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded border bg-muted/30 p-3"><span className="label-caps">Physical cruiser · read only</span><output className="mono ml-3 font-bold" data-testid="text-profile-cruiser">{derived?.cruiserNumber ?? "—"}</output></div>
        <div className="rounded border bg-muted/30 p-3"><span className="label-caps">CAD identifier · read only</span><output className="mono ml-3 font-bold" data-testid="text-profile-cad">{derived?.cadUnit ?? "—"}</output></div>
      </div>
      <p className="border-l-4 border-primary bg-primary/5 p-3"><strong>Future packets only.</strong> Saving changes your account's operational assignment, not your training roster, role, badge or record access. Existing packets and manual Cruiser corrections stay unchanged. A PO profile never replaces the FTO vehicle context.</p>
      {dirty&&profile.version!==version&&<p role="status" className="text-warn">A newer saved assignment is available. Your unsaved entry is retained; reload it before saving.</p>}
      {error&&<p role="alert" className="text-destructive" data-testid="text-profile-error">{error}</p>}
      {unavailable&&<p role="alert" className="text-destructive">{unavailable} Your unsaved entry is retained. Reload to reconnect.</p>}
      {message&&<p role="status" data-testid="text-profile-saved">{message}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending||requiresReload||!!unavailable||!dirty||profile.version!==version}
          className="inline-flex h-10 items-center gap-1.5 rounded bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-operational-profile">
          <Save className="h-4 w-4"/>{pending?"Saving…":"Save assignment"}
        </button>
        <button type="button" disabled={pending} className="inline-flex h-10 items-center gap-1.5 rounded border px-3 font-semibold disabled:opacity-50"
          data-testid="button-reload-operational-profile" onClick={async()=>{
            setPending(true);setError("");setMessage("");
            try{const saved=await refresh();if(mounted.current)accept(saved);}
            catch(cause){if(mounted.current)setError(operatorErrorMessage(cause,"The profile could not be refreshed. Your entry is retained."));}
            finally{if(mounted.current)setPending(false);}
          }}><RotateCw className="h-4 w-4"/>{dirty?"Discard edits and reload":"Reload saved assignment"}</button>
      </div>
    </form>
  </Panel>;
}
