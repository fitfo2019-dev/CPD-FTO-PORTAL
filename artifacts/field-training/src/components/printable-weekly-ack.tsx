import { phaseLabel, type WeeklyPacketAcknowledgement } from '@/lib/model.js';
import { formatDateDMY } from '@/lib/training-calendar.js';
import { PrintableColumbusFooterMarks, PrintableColumbusHeader } from '@/components/printable-columbus-header.js';
import { PrintDocument, PrintFieldGrid, PrintField } from '@/components/print-template.js';
import { needsRunNarrativeContinuation, splitNarrativeContinuation } from '@/lib/narrative-continuation.js';

export function PrintableWeeklyAcknowledgement({ acknowledgement }: { acknowledgement: WeeklyPacketAcknowledgement }) {
  const comments=[
    {label:'Probationary Officer Comments',value:acknowledgement.recruitComments,signatureLabel:'Probationary Officer signature',signature:acknowledgement.signatures.recruit},
    {label:'FTO Comments',value:acknowledgement.ftoComments,signatureLabel:'FTO signature',signature:acknowledgement.signatures.fto},
    {label:'Field Training Office Comments',value:acknowledgement.officeComments,signatureLabel:'Field Training Office signature',signature:acknowledgement.signatures.ftoOffice},
  ];
  const attachments=comments.filter(item=>needsRunNarrativeContinuation(item.value));
  const inline=(value:string)=>needsRunNarrativeContinuation(value)?'See the labeled narrative attachment following this acknowledgement.':value;
  return (
    <>
    <PrintDocument as="section" className="print-weekly print-weekly-acknowledgement" aria-hidden="true" data-testid="print-weekly-acknowledgement">
      <header className="print-weekly-header">
        <PrintableColumbusHeader formId="weekly_acknowledgement" />
        <h1>Weekly Packet Acknowledgement</h1>
      </header>
      <AcknowledgementMetadata acknowledgement={acknowledgement}/>
      <div className="print-ack-role-grid">
        {comments.map(item=><section className="print-ack-role" key={item.label}>
          <CommentBlock label={item.label} value={inline(item.value)}/>
          <SignatureLine label={item.signatureLabel} signature={item.signature}/>
        </section>)}
      </div>

      <p className="print-certificate-note">
        For the manual’s certificate-signing process, sign this PDF in Adobe Acrobat with a certificate-based Digital ID.
        Validate each signature in Acrobat and retain the signed file with the weekly packet. This browser-generated copy
        is not signed or identity-verified by Field Training Officer Portal; a self-signed certificate must be matched to an approved staff
        identity.
      </p>
      <footer className="print-weekly-footer">
        Weekly Packet Acknowledgement · {formatDateDMY(acknowledgement.weekStart)}–{formatDateDMY(acknowledgement.weekEnd)}
        <PrintableColumbusFooterMarks />
      </footer>
    </PrintDocument>
    {attachments.flatMap(item=>{
      const parts=splitNarrativeContinuation(item.value);
      return parts.map((text,index)=><PrintDocument as="section" className="print-weekly print-weekly-narrative" aria-hidden="true" key={`${item.label}-${index}`}>
        <header className="print-weekly-header">
          <PrintableColumbusHeader formId="weekly_acknowledgement"/>
          <h1>Weekly Packet Acknowledgement</h1>
          <b>Narrative Attachment · {item.label} · Part {index+1} of {parts.length}</b>
        </header>
        <AcknowledgementMetadata acknowledgement={acknowledgement}/>
        <section className="print-notes-area"><b>{item.label}</b><p style={{whiteSpace:'pre-wrap'}}>{text}</p></section>
        <footer className="print-weekly-footer">Narrative attachment · Original signatures remain on the acknowledgement form · Not digitally signed<PrintableColumbusFooterMarks/></footer>
      </PrintDocument>);
    })}
    </>
  );
}

function AcknowledgementMetadata({acknowledgement:a}:{acknowledgement:WeeklyPacketAcknowledgement}) {
  return <PrintFieldGrid className="print-ack-meta">
    <PrintField label="Probationary Officer">{a.recruitName||' '}</PrintField>
    <PrintField label="PO Badge">{a.recruitBadge||' '}</PrintField>
    <PrintField label="PO Assignment">{a.recruitAssignment||' '}</PrintField>
    <PrintField label="Field Training Officer">{a.ftoName||' '}</PrintField>
    <PrintField label="FTO Badge">{a.ftoBadge||' '}</PrintField>
    <PrintField label="FTO Assignment">{a.ftoAssignment||' '}</PrintField>
    <PrintField label="Training Phase">{phaseLabel(a.phase)}</PrintField>
    <PrintField label="Training Week">{a.weekNumber}</PrintField>
    <PrintField label="Week Dates">{formatDateDMY(a.weekStart)}–{formatDateDMY(a.weekEnd)}</PrintField>
  </PrintFieldGrid>;
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
