import { Mail, Phone } from "lucide-react";
import { Panel } from "@/components/bits";
import { FTO_BY, POS } from "../lib/portal/sample";
import { curFto, today, usePortal, type Profile } from "../lib/portal/store";

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

/** PO contact cards: MY FTO and MY COORDINATOR (sample roster until the server roster is live). */
export function PoContacts() {
  const s = usePortal();
  const po = POS.find((p) => curFto(s, p.badge, today)?.fto) ?? POS[0];
  const current = po ? curFto(s, po.badge, today) : null;
  const ftoRow = current?.fto ? FTO_BY[current.fto] : undefined;
  const fto: Profile | null = ftoRow ? { name: ftoRow.name, badge: ftoRow.badge, email: ftoRow.email, phone: ftoRow.phone } : null;
  const coordinator = s.coord.name ? s.coord : null;
  return <div className="mb-4 grid items-stretch gap-4 md:grid-cols-2">
    <ContactCard label="My FTO" person={fto} testId="card-my-fto" />
    <ContactCard label="My Coordinator" person={coordinator} testId="card-my-coordinator" />
  </div>;
}
