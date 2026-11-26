import { Mail, Phone } from "lucide-react";
import { PageHead, Panel } from "@/components/bits";
import { FTO_BY, POS } from "../lib/portal/sample";
import { D, addDays, curFto, fmt, iso, today, usePortal, type Profile } from "../lib/portal/store";

const PHASE = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function ContactCard({ label, person, testId }: { label: string; person: Profile | null; testId: string }) {
  return <Panel title={label} className="h-full">
    <div className="space-y-2 p-4 text-sm" data-testid={testId}>
      {person ? <>
        <b className="block break-words text-base">{person.name}{person.badge ? ` · #${person.badge}` : ""}</b>
        <span className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-muted-foreground" />{person.phone || "—"}</span>
        <span className="flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" />{person.email ? <a className="underline underline-offset-2" href={`mailto:${person.email}`}>{person.email}</a> : "—"}</span>
      </> : <p className="text-muted-foreground">None</p>}
    </div>
  </Panel>;
}

/** PO home: MY FTO and MY COORDINATOR first, then weekly packets released for the PO's review and signature. */
export function PoHome() {
  const s = usePortal();
  const po = POS.find((p) => curFto(s, p.badge, today)?.fto) ?? POS[0];
  const current = po ? curFto(s, po.badge, today) : null;
  const ftoRow = current?.fto ? FTO_BY[current.fto] : undefined;
  const fto: Profile | null = ftoRow ? { name: ftoRow.name, badge: ftoRow.badge, email: ftoRow.email, phone: ftoRow.phone } : null;
  const coordinator = s.coord.name ? s.coord : null;

  const weeks = new Map<string, { start: Date; phase: number; days: number }>();
  for (const p of s.packets.filter((x) => x.po === po?.badge && x.reviewedAt)) {
    const d = D(p.date);
    const start = addDays(d, -d.getDay());
    const k = iso(start);
    const w = weeks.get(k) ?? { start, phase: p.phase, days: 0 };
    w.days += 1;
    weeks.set(k, w);
  }
  const released = [...weeks.values()].sort((a, b) => b.start.getTime() - a.start.getTime());

  return <div className="mx-auto max-w-7xl">
    <PageHead kicker="Probationary Officer" title="My Training" />
    <div className="mb-4 grid items-stretch gap-4 md:grid-cols-2">
      <ContactCard label="My FTO" person={fto} testId="card-my-fto" />
      <ContactCard label="My Coordinator" person={coordinator} testId="card-my-coordinator" />
    </div>
    <Panel title="Weekly Packets for Review and Signature" action={released.length ? <span className="portal-tag is-alert">{released.length}</span> : undefined}>
      {released.length === 0 ? <p className="p-4 text-sm text-muted-foreground">None</p>
        : <ul className="divide-y text-sm" data-testid="list-po-weekly-packets">{released.map((w) => <li key={iso(w.start)} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="portal-tag">Phase {PHASE[w.phase] ?? w.phase + 1}</span>
          <span className="min-w-0 flex-1 break-words">Week of {fmt(w.start)} · {w.days} {w.days === 1 ? "Daily Performance Summary" : "Daily Performance Summaries"}</span>
          <span className="portal-tag is-alert">Ready to sign</span>
        </li>)}</ul>}
    </Panel>
  </div>;
}
