import { ArrowRight, LockKeyhole, ShieldAlert, Wrench, CheckCircle2 } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits';
import { useWorkspace } from '@/state/workspace';

export default function RoleAccessPage() {
  const { ws } = useWorkspace();

  if (ws.role === 'po') {
    return <div className="mx-auto max-w-3xl">
      <PageHead kicker="Probationary Officer · account access" title="First, confirm your access"/>
      <Panel title="Your training record is not open yet">
        <div className="border-l-4 border-accent bg-accent/5 p-4 sm:p-5" role="status" data-testid="status-po-access-pending">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-warn"><LockKeyhole className="h-5 w-5"/></span>
            <div><p className="font-semibold">Ask your training contact to confirm your account and class.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your own training records appear after your department email is verified and your class and phase are activated.</p>
            </div>
          </div>
          <ol className="mt-5 grid gap-2 border-t border-border pt-4 text-sm sm:grid-cols-3">
            <li className="flex gap-2"><span className="font-mono font-bold text-primary">1</span><span>Verify your department email.</span></li>
            <li className="flex gap-2"><span className="font-mono font-bold text-primary">2</span><span>Confirm your class assignment.</span></li>
            <li className="flex gap-2"><span className="font-mono font-bold text-primary">3</span><span>Wait for class and phase activation.</span></li>
          </ol>
          <p className="mt-4 flex items-center gap-2 rounded border bg-card p-3 text-xs text-muted-foreground"><ShieldAlert className="h-4 w-4 shrink-0 text-warn"/>Ask FTO Office Admin for an invitation or an update on your account status.</p>
        </div>
      </Panel>
    </div>;
  }

  if (ws.role === 'policenet_admin_sgt') {
    return <div className="mx-auto max-w-3xl">
      <PageHead kicker="Technical role · approval status" title="POLICENET ADMIN — SGT"/>
      <Panel title="Training-record deletion needs two approvals">
        <div className="space-y-4 p-4 sm:p-5" role="status" data-testid="status-policenet-sgt-approval">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-warn"><ShieldAlert className="h-5 w-5"/></span>
            <div><p className="font-semibold">Record deletion is not available here.</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Only deleting training records requires separate approvals from two POLICENET admin accounts: one with SGT rank and one with LT rank. No deletion tool is connected here.</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ApprovalStep label="POLICENET admin · SGT rank" state="Not connected"/>
            <ApprovalStep label="POLICENET admin · LT rank" state="Not connected"/>
          </div>
          <div className="rounded border-l-4 border-primary bg-primary/[0.04] p-3 text-sm">
            <p className="font-semibold">Your boundary</p>
            <p className="mt-1 text-muted-foreground">The two-person rule applies only to deleting training records. It does not apply to other technical work. This role cannot change training judgments or bypass operational access rules.</p>
          </div>
        </div>
      </Panel>
    </div>;
  }

  return <div className="mx-auto max-w-3xl">
    <PageHead kicker="POLICENET · technical work" title="Prepare and test changes"/>
    <Panel title="Technical tools are not connected">
      <div className="space-y-4 p-4 sm:p-5" role="status" data-testid="status-policenet-tools-unavailable">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Wrench className="h-5 w-5"/></span>
          <div><p className="font-semibold">Your next step is technical preparation.</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">POLICENET staff prepare and test technical changes. Technical test tools are not available for this account.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <TechStep title="Prepare" detail="Plan the technical change"/>
          <TechStep title="Test" detail="Use an approved test environment"/>
            <TechStep title="Delete records" detail="Requires separate SGT- and LT-rank admin approvals"/>
        </div>
        <p className="flex items-center gap-2 rounded border bg-muted/50 p-3 text-sm text-muted-foreground"><LockKeyhole className="h-4 w-4 shrink-0"/>Operational training records are not available to this technical role.</p>
      </div>
    </Panel>
  </div>;
}

function TechStep({title,detail}:{title:string;detail:string}) {
  return <div className="rounded border bg-card p-3"><div className="flex items-center gap-2 text-sm font-semibold"><ArrowRight className="h-3.5 w-3.5 text-primary"/>{title}</div><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function ApprovalStep({label,state}:{label:string;state:string}) {
  return <div className="flex items-center gap-3 rounded border bg-card p-3"><CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground"/><div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground">{state}</p></div></div>;
}
