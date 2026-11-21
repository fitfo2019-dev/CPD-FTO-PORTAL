import { ArrowRight, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { PageHead, Panel } from '@/components/bits';

export default function CommandReviewPage() {
  return <div className="mx-auto max-w-4xl">
    <PageHead kicker="FTO COC · command review" title="Submitted packets"/>
    <Panel title="Your review queue">
      <div className="p-4 sm:p-5" role="status" data-testid="status-command-access-disabled">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><ClipboardCheck className="h-5 w-5"/></span>
          <div>
            <p className="font-semibold">Only completed and submitted packets belong in this queue.</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Drafts and unfinished packets do not appear here. No submitted packets are available.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 border-y py-4 sm:grid-cols-3">
          <QueueStep number="1" text="A packet is completed"/>
          <QueueStep number="2" text="It is submitted for command review"/>
          <QueueStep number="3" text="It appears in this queue"/>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded border-l-4 border-accent bg-accent/5 p-3 text-sm text-muted-foreground"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn"/>Packet review, export, printing, comments, and return-for-review are unavailable.</p>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><ArrowRight className="h-3.5 w-3.5"/>When a completed packet is submitted, it is meant to show here.</p>
      </div>
    </Panel>
  </div>;
}

function QueueStep({number,text}:{number:string;text:string}) {
  return <div className="flex items-center gap-2 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted font-mono text-xs font-bold">{number}</span><span className="font-medium">{text}</span></div>;
}
