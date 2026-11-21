import { phaseLabel, type WeeklyPacketAcknowledgement } from '@/lib/model';
import { formatDateDMY } from '@/lib/training-calendar';

export function PrintableWeeklyAcknowledgement({ acknowledgement }: { acknowledgement: WeeklyPacketAcknowledgement }) {
  return (
    <section className="print-weekly" aria-hidden="true" data-testid="print-weekly-acknowledgement">
      <header className="print-weekly-header">
        <p>Columbus Division of Police · Field Training Program</p>
        <h1>Weekly Packet Acknowledgement</h1>
        <div className="print-weekly-meta">
          <span><b>Week number</b>{acknowledgement.weekNumber}</span>
          <span><b>Training phase</b>{phaseLabel(acknowledgement.phase)}</span>
          <span><b>Week dates</b>{formatDateDMY(acknowledgement.weekStart)}–{formatDateDMY(acknowledgement.weekEnd)}</span>
        </div>
      </header>

      <div className="print-weekly-person-grid">
        <Person name="Probationary Officer" person={acknowledgement.recruitName} badge={acknowledgement.recruitBadge} assignment={acknowledgement.recruitAssignment} />
        <Person name="Field Training Officer" person={acknowledgement.ftoName} badge={acknowledgement.ftoBadge} assignment={acknowledgement.ftoAssignment} />
      </div>

      <CommentBlock label="Probationary Officer Comments" value={acknowledgement.recruitComments} />
      <SignatureLine label="Probationary Officer signature" signature={acknowledgement.signatures.recruit} />
      <CommentBlock label="FTO Comments" value={acknowledgement.ftoComments} />
      <SignatureLine label="FTO signature" signature={acknowledgement.signatures.fto} />
      <CommentBlock label="Field Training Office Comments" value={acknowledgement.officeComments} />
      <SignatureLine label="Field Training Office signature" signature={acknowledgement.signatures.ftoOffice} />

      <p className="print-certificate-note">
        For the manual’s certificate-signing process, sign this PDF in Adobe Acrobat with a certificate-based Digital ID.
        Validate each signature in Acrobat and retain the signed file with the weekly packet. This browser-generated copy
        is not signed or identity-verified by Field Training Officer Portal; a self-signed certificate must be matched to an approved staff
        identity.
      </p>
      <footer className="print-weekly-footer">
        Weekly Packet Acknowledgement · {formatDateDMY(acknowledgement.weekStart)}–{formatDateDMY(acknowledgement.weekEnd)}
      </footer>
    </section>
  );
}

function Person({ name, person, badge, assignment }: { name: string; person: string; badge: string; assignment: string }) {
  return (
    <div className="print-person">
      <b>{name}</b>
      <span>{person || ' '}</span>
      <span>Badge: {badge || ' '}</span>
      <span>Assignment: {assignment || ' '}</span>
    </div>
  );
}

function CommentBlock({ label, value }: { label: string; value: string }) {
  return <section className="print-comment"><b>{label}</b><p>{value || ' '}</p></section>;
}

function SignatureLine({ label, signature }: { label: string; signature?: { name: string; badge: string; at: string } }) {
  return (
    <div className="print-signature-line">
      <span>{label}</span>
      <div className="print-signature-mark">{signature ? `${signature.name} #${signature.badge}` : ''}</div>
      <span>Date</span>
      <div className="print-signature-date">{signature ? formatDateDMY(signature.at.slice(0, 10)) : ''}</div>
    </div>
  );
}
